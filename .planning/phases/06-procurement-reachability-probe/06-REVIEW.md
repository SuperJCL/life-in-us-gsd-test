---
phase: 06-procurement-reachability-probe
reviewed: 2026-11-08T00:00:00Z
depth: standard
files_reviewed: 32
files_reviewed_list:
  - .claude/CLAUDE.md
  - .gitattributes
  - .gitignore
  - PRIVACY.md
  - tools/privacy/hook-drill.mjs
  - tools/privacy/privacy-check.mjs
  - tools/privacy/redact.mjs
  - tools/probe/README.md
  - tools/probe/page/config.example.js
  - tools/probe/page/index.html
  - tools/probe/page/probe.js
  - tools/probe/page/vendor/LICENSE.md
  - tools/probe/page/vendor/README.md
  - tools/probe/page/vendor/SHA256SUMS
  - tools/probe/page/vendor/pocketbase.iife.js
  - tools/probe/schema-check.mjs
  - tools/probe/schema.json
  - tools/probe/server/00-status.sh
  - tools/probe/server/01-swap.sh
  - tools/probe/server/02-install-pocketbase.sh
  - tools/probe/server/03-configure-pocketbase.sh
  - tools/probe/server/04-start-pocketbase.sh
  - tools/probe/server/05-nginx-probe.sh
  - tools/probe/server/06-install-probe-page.sh
  - tools/probe/server/export-results.py
  - tools/probe/server/nginx/anchor-block.awk
  - tools/probe/server/nginx/usj-probe-locations.conf
  - tools/probe/server/pb_migrations/probe_schema.js
  - tools/probe/server/pb_migrations/probe_user.js.tpl
  - tools/probe/server/pocketbase.service
  - tools/probe/summarize.mjs
  - tools/probe/verify-site.mjs
findings:
  critical: 2
  warning: 10
  info: 12
  total: 24
status: issues_found
---

# Phase 6: 代码审查报告

**审查时间：** 2026-11-08
**深度：** standard
**审查文件数：** 32
**状态：** issues_found

## 摘要

本次审查覆盖隐私工具链（privacy-check、redact、hook-drill）、探针页、服务器脚本 00–06、迁移、nginx 片段、unit、导出和汇总脚本。

整体情况：

- 隐私工具链写得扎实，三个离线自检均通过（privacy-check 193 项、summarize 77 项、verify-site 32 项）。输出不泄露原值的约定在各规则里都落实了。
- SDK 固定和加载一致：`vendor/SHA256SUMS` 与 `pocketbase.iife.js` 的 sha256 实测相符（`sha256sum -c` 通过，40539 字节，文件无 CR）。`.gitattributes` 里 `vendor/** -text` 排在 `tools/probe/**` 之后，`git ls-files --eol` 显示 `attr/-text`，换行不会被改写。06 脚本在服务器上用同一份 SHA256SUMS 复核，链条完整。
- 两个问题会直接损坏实测数据，需要在继续收集结果前处理：**探针页把负时区偏移截成 0**（CR-01），以及**登录失败这个最关键的可达性结果在结构上无法上传、即使上传也会被汇总排除**（CR-02）。两者都在探针页和汇总逻辑里，不涉及已执行的服务器脚本。
- 服务器脚本 01–06 已按批准的哈希执行，下面的脚本类发现都标明了是否只在重跑（例如 Phase 13 重装）时才有影响。没有发现会让这次已执行的结果出错的脚本缺陷。
- 本报告没有写入任何地址、域名、邮箱、口令或令牌，也没有读取 `private/`。

## Critical Issues

### CR-01: 探针页把负的 tz_offset_min 截成 0，美国侧运行的本地时间全部算错

**文件：** `tools/probe/page/probe.js:67,151,300-304`
**问题：** `num` 是为“毫秒数”写的，会做 `Math.max(0, v)`（第 67 行）。组装上传记录时，所有数字类型的字段都过 `num`（第 302 行），`tz_offset_min`（第 151 行，`-new Date().getTimezoneOffset()`）也在其中。美国时区的偏移是负数（-480、-420、-300 等），上传前被改写成 0。schema 明明允许 -840 到 840。

后果：

- `summarize.mjs` 的 `localTime`、`slotOf`、`nightOf` 用 `started_at + tz_offset_min` 还原测试人的本地时间。偏移被截成 0 之后，美国运行的“本地时间”变成了 UTC 时间。表 2 的“时段”（美国本地晚高峰）和“夜”两列对美国运行全部错误；D-18 要求“至少 3 个晚上”“美国本地 20:00–23:00”的覆盖判断因此无法从数据里核对。
- 原始偏移没有别的地方可以恢复（`started_at` 是 `toISOString()` 的 UTC 串），数据是不可逆地丢了信息。
- `summarize.mjs` 的合成数据里美国行用了 `tz_offset_min: -480`，这是探针页永远产生不了的值，所以自检把这个缺陷盖住了。

北京（+480）的值不受影响，所以国内的测试看不出问题。

**修复：** 只对非负的耗时字段取整并截零，时区偏移单独处理：

```js
// 数字字段：取整；耗时类字段不小于 0；tz_offset_min 允许为负
const num = (v, allowNegative = false) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(allowNegative ? v : Math.max(0, v)) : undefined;
...
RESULT_FIELDS.forEach((k) => {
  let v = m[k];
  if (typeof v === 'number') v = num(v, k === 'tz_offset_min');
  if (v !== undefined && v !== null) record[k] = v;
});
```

同时给 `summarize.mjs` 增加一条自检：美国行经过探针页同一套组装逻辑后偏移仍为负。如果美国侧测试已经跑过，补救办法是在汇总时对 `carrier === 'us'` 且 `tz_offset_min === 0` 的行按测试人的实际时区手工标注，并在结果文档里说明。注意探针页文件已部署到服务器，改页面需要重新走所有者批准和哈希核对。

### CR-02: 登录失败的结果无法上传，即使上传也会被汇总排除，登录达标率因此虚高

**文件：** `tools/probe/page/probe.js:172-185,306-314`；`tools/probe/summarize.mjs:102-109,134`
**问题：** 登录是可达性探针里最关键的一项，但失败结果在结构上无法进入数据：

1. 登录失败时 `pb.authStore` 是空的（第 174 行刚清过）。随后第 311 行用这个未登录的客户端调 `probe_results` 的 `create`，而 `createRule` 是 `@request.auth.id != ""`，会被拒绝。重试 3 次也一样（重试不会重新登录）。所以 `login_ok = false` 的记录永远写不进库，库里的 `login_ok` 在实践中只会是真。
2. 退一步说，就算记录以某种方式进了库，登录失败时 `dur_s` 被设为 0（第 286 行），`summarize.mjs` 的 `isValidRun` 把 `dur_s < 590` 判成 `short` 无效，不计入任何达标率分母。

净效果：一家运营商如果大部分测试都登录不上，库里看到的只有少数成功的记录，登录达标率仍然接近 100%，分级可能给出“合格”或“样本不足”，而不是“不合格”。这会直接歪曲 D-06 / D-18 的判定，而这些判定是 Phase 10、13 的输入。屏幕上的“上传失败”提示和截图转录是唯一的补救，但汇总脚本和 `--json` 输出都不会体现它们。

**修复：** 两处都要改。

- 探针页：登录失败时也要有办法留下结果。可选做法：保留一个只允许匿名新建、字段受限的专用集合（需要新迁移，当前已部署的服务器要重新批准）；或者至少把失败结果保存在 `localStorage`，下次成功登录时补传；或者让页面在登录失败时把摘要显示得足够醒目，由组织测试的人手工登记并在 06-10 里单独计数。
- 汇总：把“登录失败的运行”从 `short` 里单独拎出来。例如 `isValidRun` 在 `login_ok === false` 且 `dur_s === 0` 时返回 `{ valid: true }`（或新增 `login-failed` 原因并计入登录达标率分母），首屏和实时两项对这种运行按“未达标”处理。同时在附注里单列“手工登记的登录失败次数”，避免被误读为样本不足。

## Warnings

### WR-01: PocketBase 的数字字段缺值时存成 0，汇总把“没测到”当成真实的 0

**文件：** `tools/probe/summarize.mjs:61-65,133-134,176`；`tools/probe/server/export-results.py:73-78`
**问题：** `summarize.mjs` 的注释和 `normalizeRow` 假设“缺失一律是 null（不是 0）”。但数据是从 PocketBase 的 SQLite 里导出的，我对 PocketBase 的理解是 number 和 bool 列是 `NOT NULL DEFAULT 0/FALSE`：探针页没有上传的字段（例如 FCP 和导航条目都拿不到时的 `first_screen_ms`，或 `tls_ms`、`sdk_ms` 被省略时）在库里就是 0，导出后也是 0。`runVerdict` 里 `finite(0) && 0 <= 5000` 为真，所以“没测到首屏”被判为首屏达标，并拉低首屏中位数和 P90。这一条依赖 PocketBase 的列定义，建议在服务器上用 `.schema probe_results` 的只读结果核实（只看列定义，不涉及数据）。

**修复：** 汇总里把 `first_screen_ms === 0` 当作缺失（FCP 和 DCL 都不可能是 0），其余只作诊断用途的字段（`tls_ms`、`sdk_ms`、`rt_connect_ms`）在表 2 里对 0 显示为 `-`。`normalizeRow` 的注释也要改成与实际一致。

### WR-02: verify-site 的 F-11 用不存在的记录 id，无法证明 view、update、delete 规则是锁死的

**文件：** `tools/probe/verify-site.mjs:381-395`
**问题：** F-11 用随机的 `fakeId` 去 GET、PATCH、DELETE `probe_results`。对一个不存在的记录，规则如果被改成“已登录即可”（威胁模型里正是要防的情况），PocketBase 会返回 404，检查仍然通过。只有 `listRule` 那一项（列表请求）是真实可检出的。这条检查给出了比它实际证明的更多的保证。（我对 PocketBase 行为的理解：规则为 null 时先返回 403，规则放开但记录不存在时返回 404；两者对检查来说都是“非 2xx”。）

**修复：** 先在 F-10 里解析创建响应拿到真实记录 id，F-11 用这个 id 请求；规则锁死时应是 403（或至少不是 200/204），规则放开时会是 200/204，检查才有区分力。同时把期望状态码写成 403 而不是“非 2xx”。

### WR-03: 重复记录没有去重；同一页面第二次测试会复用首次加载的计时

**文件：** `tools/probe/page/probe.js:100-124,306-314,331-335`；`tools/probe/summarize.mjs:212-238`
**问题：** 有两个会产生重复或失真样本的路径：

1. 上传重试（第 308-314 行）：如果某次请求其实已经在服务器上建好了记录、只是响应丢了（这正是被测的不稳定网络下最可能发生的情况），重试会再建一条，`run_id` 相同。`probe_results` 没有 `run_id` 唯一索引，`summarize.mjs` 也没有按 `run_id` 去重，该次运行被重复计数。
2. 一次测试结束后“开始”按钮被重新启用（第 331-335 行）。在同一个页面里再测一次，`readTimings()` 读到的仍然是页面首次加载的首屏、TTFB、DNS、TLS 数据，`nav_type` 仍是 `navigate`，所以会被判为有效的冷加载样本，但其实只是复制了第一次的数字。README 靠“每次新开一个标签页”的口头要求规避，页面本身没有防护。

**修复：** 汇总里按 `run_id` 去重（保留 `created` 最早的一条）。探针页在一次测试结束后不要重新启用按钮，改为提示“如需再测，请刷新页面”，或者在第二次起把 `nav_type` 记为 `repeat` 让汇总自动排除。

### WR-04: 上传失败后结果只能靠截图，没有本地留存或更久的重试

**文件：** `tools/probe/page/probe.js:306-314`
**问题：** 10 分钟的测试做完后，只有 3 次、每次间隔 2 秒的上传重试，也就是不到十秒的窗口。被测的恰恰是不稳定的线路，在这个窗口里网络抖一下，一次 10 分钟的有效样本就丢了，只能靠测试人按页面提示截图再手工转录。这会系统性地让最差的线路样本偏少。

**修复：** 上传失败时把记录写进 `localStorage`（同源、不含个人信息），页面再次打开或点击“重新上传”按钮时补传；重试改成指数退避并拉长到约 1 分钟。

### WR-05: schema-check 不验证迁移里最关键的安全设置，“SCHEMA MATCH”会给出虚假的放心

**文件：** `tools/probe/schema-check.mjs:93-99,142-158`；`tools/probe/server/pb_migrations/probe_schema.js:8-15,75-83`
**问题：** `execMigration` 对 `findCollectionByNameOrId` 返回空对象、对 `settings()` 返回无限深的代理，只收集 `new Collection` 的定义。所以以下内容改错或被删掉，`--migration` 仍输出 `SCHEMA MATCH`：

- `users.createRule / updateRule / deleteRule = null`（关掉自助注册、改口令、删号；探针账号口令是公开的，这是整个探针站点最重要的一道防线）；
- `logs.logIP = false`、`logs.logAuthId = false`、`logs.maxDays`；
- `trustedProxy.headers`、`rateLimits.enabled`。

自检的合成迁移甚至省略了 `users.updateRule` 和 `deleteRule`，结果仍然通过，说明这是设计上的盲区而不是疏漏。`00-status.sh` 能在服务器上读出其中一部分（`DB_USERS_RULES_LOCKED`、`DB_SETTINGS_*`），但本机的比对器不能。

**修复：** 让桩对象记录对 `users` 和 `settings()` 的赋值（用 Proxy 的 `set` 记录路径和值），在 schema.json 里加 `usersRules` 和 `settings` 两段期望值，并在 `checkMigration` 里比对。至少要覆盖 users 三条规则、`logs.logIP`、`rateLimits.enabled`。

### WR-06: redact.mjs 在 private 文件存在但没有任何值时放行原文（fail open）

**文件：** `tools/privacy/redact.mjs:198-209,221-243`
**问题：** `loadValues` 的 `found` 只看文件是否存在。如果 `private/server.env` 存在但键为空或写坏了、且 `private/denylist.txt` 不存在或全是注释，`found` 为真，但没有任何域名或 IP 可替换。默认模式会把包含域名的文本原样输出（退出码 0），`--check` 也会输出 `clean`。头注释承诺的是“没有可替换的值就拒绝输出（fail closed）”，这条路径违背了它。真正的服务器 IP 仍会被通用公网 IPv4 规则替换，但域名会漏出去，而这个工具存在的意义就是保护域名。

**修复：** 把 `found` 改成“至少有一个域名、IP 或词条”：

```js
return { found: Boolean(env.domain || env.ip || terms.length > 0), domain: env.domain, ip: env.ip, terms };
```

没有值时走现有的退出码 2 分支。自检里补一条：只有空 `server.env` 时 `found` 为假。

### WR-07: 01-swap.sh 在 swap 已启用时直接退出，不补写 fstab（只在重跑时有影响）

**文件：** `tools/probe/server/01-swap.sh:20-25,46-55`
**问题：** 脚本先 `swapon`，再写 `/etc/fstab`。如果在 `swapon` 之后、写 fstab 之前出错（磁盘满、sudo 超时），重跑时第 21 行发现 `/swapfile` 已启用，输出 `SWAP=already` 并退出 0，永远不会补写 fstab。服务器重启后 swap 就消失了，而脚本报告的是成功。这次已执行的运行结果是正常的（fstab 已写入），所以只在重跑（Phase 13 重装、灾后重建）时有影响。

**修复：** 把“确保 fstab 有这一行”挪到 `already` 分支之前，或者在 `already` 分支里也执行同样的 fstab 检查和追加。

### WR-08: 04-start-pocketbase.sh 的失败路径只 stop 不 disable，重跑也不会重启服务（只在重跑时有影响）

**文件：** `tools/probe/server/04-start-pocketbase.sh:55-57,62,73-89`
**问题：** 两个问题：

1. 健康检查超时和“8090 不是只绑 127.0.0.1”两条失败路径都只调用 `stop_service`，而第 62 行已经 `enable --now`。服务仍是 enabled，机器重启后会自动再起来，尤其是绑定检查失败时，等于把一个被判为不安全的状态在下次开机时恢复。头注释写的“不让它反复重启”只对当前这一轮成立。unit 里写死了 `--http=127.0.0.1:8090`，所以实际暴露风险低，但失败路径的行为与脚本自己声明的回滚（`disable --now`）不一致。
2. 重跑时 `install` 覆盖 unit、`daemon-reload` 后，`enable --now` 不会重启已在运行的服务，新的 unit 设置（内存上限、沙箱选项）不会生效，而脚本最后仍报告 `PB_START=done`。

**修复：** 失败路径改成 `systemctl disable --now pocketbase`。unit 内容有变化时用 `systemctl restart pocketbase`（先比较旧 unit 的哈希）。

### WR-09: 05-nginx-probe.sh 没有 ERR trap，中途出错会留下半改状态（只在重跑时有影响）

**文件：** `tools/probe/server/05-nginx-probe.sh:73-96`
**问题：** 脚本在 `set -e` 下运行，`rollback` 只在特定检查失败处被显式调用。从第 87 行（装片段）到第 98 行之间任何命令失败（`mktemp`、`awk`、`install` 到站点文件），脚本直接退出，不会调用 `rollback`：片段已装好，站点文件可能已被改了一半。`install` 覆盖 `$SITE` 不是原子的，中途失败会留下被截断的站点文件，而 certbot 的续期会读它。另外第 92 行的 `$TMP` 在失败路径上不会被删除。已执行的这次运行成功了，没有受影响。

**修复：** 备份之后加 `trap 'rollback' ERR`（成功路径末尾 `trap - ERR`），并用 `install` 到同目录的临时文件再 `mv` 的方式原子替换站点文件，`$TMP` 用 `trap ... EXIT` 清理。

### WR-10: 探针账号口令公开，任何人都能无限新建 probe_results，汇总没有异常检测

**文件：** `tools/probe/server/pb_migrations/probe_schema.js:19-25,60-66`；`tools/probe/summarize.mjs`
**问题：** 这是已知并接受的设计（口令公开、权限收到最小、靠限流保护）。但风险没有落到数据完整性这一侧：拿到 `config.js` 的任何人都能登录并 POST 任意数量、任意取值（字段范围内）的 `probe_results`，这些记录会被 `summarize.mjs` 当作真实运行计入达标率，从而左右“服务器继续用”之后的限制和兜底参数。限流只能减缓，不能阻止。`/_/` 后台对公网开放（D-13）也依赖口令强度。

**修复：** 不需要改已部署的服务器。在汇总输出里加两项只读检查：每个分组的运行数与“测试安排”（每晚每运营商至少 2 次）对不上时给出提示；`created` 与 `started_at` 相差过大、`run_id` 重复或格式不是 16 位十六进制的行单列出来。06-10 在写结论时人工对照测试日程。

## Info

### IN-01: 源码里含字面的 BOM 字符

**文件：** `tools/privacy/redact.mjs:66`；`tools/probe/verify-site.mjs:46`
**问题：** `.replace(/^<BOM 字符>/, '')` 里的 BOM 是一个肉眼看不见的字面字符（`grep` 在这两个文件里各命中一次 `EF BB BF`），代码审查工具和编辑器会把它当作可疑的隐形字符，也容易在编辑时被删掉。
**修复：** 改写成 带转义的写法（反斜杠加 u 加 FEFF）。

### IN-02: PRIVACY.md 章节顺序是 7、9、8

**文件：** `PRIVACY.md:97,106`
**问题：** “## 9. 夹具里怎么写假令牌和假口令”排在“## 8. 后续计划”之前。
**修复：** 把两节对调，或把“夹具”一节改编为 8、“后续计划”改编为 9。

### IN-03: redact.mjs 和 verify-site.mjs 只在当前仓库根目录找 private/，与 privacy-check 不一致

**文件：** `tools/privacy/redact.mjs:189-195`；`tools/probe/verify-site.mjs:186-192`
**问题：** `privacy-check.mjs` 会同时在当前目录和主工作树根目录找 `private/`（它已经考虑了 git worktree，因为 `private/` 被忽略，不会出现在其他工作树里）。`redact.mjs` 和 `verify-site.mjs` 只看 `git rev-parse --show-toplevel`。在 GSD 用的链接工作树里运行它们，会因为找不到 `private/` 而拒绝输出（fail closed，所以不泄露，但流程会卡住）。
**修复：** 抽出共用的 `findPrivateRoot()`，沿用 privacy-check 里 `mainWorktreeRoot` 的做法。

### IN-04: verify-site.mjs 用 process.exit 结束，输出被管道时最后几行可能丢失

**文件：** `tools/probe/verify-site.mjs:566-572`
**问题：** 这个脚本的标准用法是 `2>&1 | node tools/privacy/redact.mjs`。`process.exit(code)` 在标准输出是管道时可能截断尚未刷出的数据，最后一行 `VERIFY OK (N checks)` 是判定依据。`redact.mjs`、`summarize.mjs` 等其余脚本都用 `process.exitCode`。
**修复：** 改成 `process.exitCode = code`。

### IN-05: F-13 的“收到推送”条件会被别人的打点满足

**文件：** `tools/probe/verify-site.mjs:432`
**问题：** 条件 `ev.event === 'probe_pings/*' || ev.data.includes(runId)` 的前半部分对任何打点事件都成立，测试期间如果别人正在跑探针，会把别人的打点当成自己的推送。订阅本身没有按 `run` 过滤。
**修复：** 只接受 `ev.data.includes(runId)`，或订阅时带 `filter`。

### IN-06: README 里的超级用户命令把口令放在了命令行参数里

**文件：** `tools/probe/README.md:66`
**问题：** `superuser upsert "$EM" "$PW"` 让口令成为 `pocketbase` 进程的命令行参数，同一台机器上的其他用户在命令执行的短时间内能从 `ps` 或 `/proc/<pid>/cmdline` 读到。这台服务器是单人使用，风险很低；但文中“口令不进任何文件”的表述没有说明它会短暂出现在进程参数里。PocketBase 的该子命令只接受位置参数，没有更好的办法。
**修复：** 在 README 里如实写明这一点，并建议只在确认没有其他登录用户时执行。

### IN-07: nginx 片段的两个小缺口

**文件：** `tools/probe/server/nginx/usj-probe-locations.conf:4,71-83`
**问题：** 一是访问 `/probe`（不带斜杠）不会命中任何位置，会落到站点默认位置，通常是 404，给测试人的链接如果少打一个斜杠就打不开；二是 `access_log off` 只关了访问日志，nginx 的错误日志仍会记录客户端 IP（文件头已说明“错误日志保持 nginx 默认”，但 README 的隐私约定没有提这一点）。
**修复：** 加 `location = /probe { return 301 /probe/; }`；README 隐私一节补一句错误日志的现状。（已部署，改动需要重新批准。）

### IN-08: anchor-block.awk 的边界和 05 脚本里没有用到的变量

**文件：** `tools/probe/server/nginx/anchor-block.awk:34,36`；`tools/probe/server/05-nginx-probe.sh:26,54`
**问题：** 一是 awk 靠“`server` 和 `{` 在同一行”识别 server 块，`server` 与 `{` 分行写的配置会被判成 `other`，属于 fail closed，安全但会误拒；`sub(/#.*/, "")` 也会把引号字符串里的 `#` 当注释；二是 `05` 里定义了 `AWK_SRC`，只用于检查文件存在，实际调用写死了 `/tmp/usj-probe-upload/server/nginx/anchor-block.awk`。
**修复：** 第二点改成 `-f "$AWK_SRC"`。第一点在文件头补一句局限说明。

### IN-09: 上传目录放在固定的 /tmp 路径，核对哈希到 sudo 使用之间有窗口（只在重跑时有影响）

**文件：** `tools/probe/server/03-configure-pocketbase.sh:26`；`04-start-pocketbase.sh:22`；`05-nginx-probe.sh:24,54`；`06-install-probe-page.sh:18,52`
**问题：** 脚本以 root 身份（经 `sudo`）使用 `/tmp/usj-probe-upload/...` 里的文件，而批准流程里的哈希核对发生在上传之后、执行之前。如果同一台机器上还有别的本地用户，他们可以在核对和使用之间替换文件。这台服务器是单人使用，实际风险很低。
**修复：** Phase 13 重装时，用 `mktemp -d` 建一个 0700 的目录，并在脚本入口再核对一次哈希（`sha256sum -c` 对照批准清单）。

### IN-10: 隐私检查器规则 C 和 G 的两个放行口子

**文件：** `tools/privacy/privacy-check.mjs:41-44,122-124,178`
**问题：** 一是规则 C 把“顶级域是常见文件扩展名”的邮箱放行（为的是 `icon@2x.png`），列表里的 `md` 同时是摩尔多瓦的真实顶级域，`name@company.md` 会被放行；二是 `isPlaceholder` 把以 `$` 开头的值一律视为占位，bcrypt 哈希（`$2a$10$…`）会因此漏报。这两处都是已写进 PRIVACY.md 的取舍，风险很低。
**修复：** 对 `md` 要求本地部分以 `@2x` 之类的文件名形态出现才放行；`$` 开头的占位只放行 `$VAR`、`${VAR}` 形态（`/^\$\{?[A-Za-z_]/`）。

### IN-11: 02-install-pocketbase.sh 的头注释与实际顺序不符（只在重跑时有影响）

**文件：** `tools/probe/server/02-install-pocketbase.sh:16-17,112-119`
**问题：** 头注释写“两项核对和 `--version` 检查都在改动系统之前完成”。实际的 `--version` 检查在第 115 行，在第 103-113 行建用户、建目录、装二进制之后。核对失败的后果是：二进制和用户已留在系统里，重跑时第 60-69 行因为“版本不是 $PB_VERSION”拒绝继续，必须手动回滚。注释和回滚说明需要对齐。
**修复：** 更正注释；或在 `install` 到 `/opt/pocketbase/pocketbase` 之前，对解压出的二进制先用普通用户权限运行一次 `--version`。

### IN-12: privacy-check 静默忽略不以 -- 开头的多余参数

**文件：** `tools/privacy/privacy-check.mjs:1120-1126`
**问题：** `process.argv.slice(2).filter((a) => a.startsWith('--'))` 之后只检查 `--` 开头的参数，`--staged foo` 的 `foo` 被悄悄丢掉。钩子调用时不会出现，只是手工运行时写错参数得不到提示。
**修复：** 对 `process.argv.slice(2)` 整体检查长度和内容。

---

_审查时间：2026-11-08_
_审查者：Claude (gsd-code-reviewer)_
_深度：standard_
