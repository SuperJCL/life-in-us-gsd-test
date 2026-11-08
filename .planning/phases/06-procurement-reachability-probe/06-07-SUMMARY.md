---
phase: 06-procurement-reachability-probe
plan: 07
subsystem: infra
tags: [verify-site, nginx, sse, certbot, systemd, pocketbase, anchor-block, batch-b, d-02, d-03, d-13, d-14, privacy]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-03 的 tools/probe/schema.json（F-10、F-13 的数据按它组装和校验）
  - phase: 06-procurement-reachability-probe
    provides: 06-04 的 redact.mjs、LF 规则
  - phase: 06-procurement-reachability-probe
    provides: 06-05 的探针页和 vendor/SHA256SUMS（06-install-probe-page.sh 安装的就是它们）
  - phase: 06-procurement-reachability-probe
    provides: 06-06 的批次 A 脚本约定和已批准的 5 个文件
provides:
  - "tools/probe/verify-site.mjs：--stage baseline（B-01..B-03）、--stage full（F-01..F-14，06-09 用）、--self-test（32 条）；baseline 已在真实域名上跑通"
  - "批次 B 的 6 个服务器文件（nginx 片段、anchor-block.awk、05-nginx-probe.sh、pocketbase.service、04-start-pocketbase.sh、06-install-probe-page.sh），已通过本机检查，没有上传、没有执行"
  - "只读确认：真实服务器上锚点恰好 1 行，且在 listen 443 ssl 的 server 块里"
affects: [06-08, 06-09, 06-10]

actuals:
  tokens: 12300
  tasks: 3
  commits: 3
plan_head_before: 41f9b8de005148dc1c5dc5316619ee678d083399
plan_head_after: 5a074a9b311d9a00d924c8586e4f59035faa6790

tech-stack:
  added: []
  patterns:
    - "外部检查只输出检查编号和 PASS/FAIL，异常只给类名或 code；域名和 IP 只在运行时从 private/server.env 读，输出仍再经 redact.mjs"
    - "改配置之前先做两项只读断言（锚点恰好 1 行；锚点块是 listen 443 ssl），不通过就什么都不改；备份目录不在 nginx 加载的目录里；nginx -t 或 certbot dry-run 失败自动回滚"
    - "POSIX awk 判定程序可经 ssh 标准输入只读运行，不在服务器上存文件"

key-files:
  created:
    - tools/probe/verify-site.mjs
    - tools/probe/server/nginx/usj-probe-locations.conf
    - tools/probe/server/nginx/anchor-block.awk
    - tools/probe/server/05-nginx-probe.sh
    - tools/probe/server/pocketbase.service
    - tools/probe/server/04-start-pocketbase.sh
    - tools/probe/server/06-install-probe-page.sh
  modified: []

key-decisions:
  - "D-13 优先于研究稿：nginx 片段把 /_/ 反代给 PocketBase，不写任何返回 404 的位置（研究稿是三个 404 位置）"
  - "不在 server 层加任何指令：研究稿的 server_tokens、add_header、access_log 都挪到每个位置里自带；探针站点关闭访问日志（D-09），所以也不需要 conf.d/usj-probe.conf 的 log_format"
  - "04 脚本的超级用户只读查询用 pocketbase 用户运行（sudo -u pocketbase），不用 root：避免 root 在 pb_data 里留下 root 所有的 -shm/-wal 文件让服务起不来"
  - "06 脚本最后删除整个上传目录，所以它必须是批次 B 的最后一步（04、05 还要用上传目录里的文件）"

patterns-established:
  - "判定程序先在五种合成配置上测、再在真实服务器上只读跑一次，然后才允许修改脚本去依赖它"

requirements-completed: []  # INFRA-01、INFRA-02 要等 06-09 在真实服务器上执行批次 B 并跑 verify-site --stage full、06-10 的实测之后才能判定，本计划只写脚本，未满足

coverage:
  - id: D1
    description: "verify-site.mjs 自检通过，baseline 三项（HTTPS 可达、http 跳转、8090 关闭）在真实域名上通过，过滤后输出无敏感值"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "node tools/probe/verify-site.mjs --self-test (SELF-TEST OK, 32 cases); --stage baseline | redact.mjs (VERIFY OK (3 checks)); redact.mjs --check clean"
        status: pass
    human_judgment: false
  - id: D2
    description: "anchor-block.awk 在五种合成配置上判定正确，真实服务器上只读确认锚点 1 行且在 listen 443 ssl 块里"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "awk --posix 五种合成配置（443ssl/other/other/none/multiple）；ssh usj 只读 grep -c = 1；ssh usj 只读 awk -f /dev/stdin = ANCHOR_BLOCK=443ssl"
        status: pass
    human_judgment: false
  - id: D3
    description: "批次 B 的 6 个文件通过本机静态检查（bash -n、LF、无 set -x、必要内容、顺序约束）和隐私检查；批次 A 的 5 个哈希未变"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "Task 2、Task 3 的 verify；node tools/privacy/privacy-check.mjs --staged；sha256sum -c --strict 对批次 A 清单 5 项 OK"
        status: pass
    human_judgment: false
  - id: D4
    description: "full 阶段的 14 项检查、05 脚本的挂载与回滚、04 脚本的启动与停机、06 脚本的安装在真实服务器上的行为"
    requirement: INFRA-02
    verification: []
    human_judgment: true
    rationale: "本计划只写脚本，不上传、不执行；这些只能在 06-09 经所有者批准执行批次 B 并跑 verify-site --stage full 后判定。certbot 的 nginx 插件能否解析 ^~ 和 = 位置块、systemd 沙箱项是否影响 Go 运行时、SDK 0.28.1 与服务端 0.41.1 的兼容性都还是假设"

duration: 约 25min
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 07: 外部检查工具与批次 B 服务器文件 Summary

**写好 verify-site.mjs（baseline 已经真实域名跑通，full 的 14 项检查等 06-09）和批次 B 的 6 个服务器文件：SSE 友好的 nginx 位置块、只用 POSIX awk 的锚点块判定（已在真实服务器上只读确认锚点唯一且在 listen 443 ssl 块里）、带备份和 certbot dry-run 回滚的挂载脚本、systemd unit、启动脚本和探针页安装脚本；服务器上没有任何改动。**

## Performance

- **Duration:** 约 25 分钟
- **Completed:** 2026-11-08T06:50Z 前后
- **Tasks:** 3（Task 1 为 tracer）
- **Files modified:** 7（全部为新建）

## Accomplishments

- tracer：baseline 阶段从本机经真实域名跑通，证明“本机 -> DNS -> nginx -> TLS”这条外部链路和“输出里没有域名、IP、凭据”的做法。
- 判定程序 anchor-block.awk 先在 gawk `--posix` 下过五种合成配置，再经 ssh 标准输入在真实服务器上只读跑一次（服务器上不留文件），结果与研究稿一致。
- 05 脚本在任何备份、安装、改写之前先做两项断言；nginx -t、reload、certbot renew --dry-run 任何一步失败都自动恢复。

## verify-site 的结果

自检：`SELF-TEST OK (32 cases)`（取凭据、SHA256SUMS 两种分隔、四个响应头、Location 判定、payloadFitsSchema 的合格和不合格情形、SSE 跨块拼接与多行 data、异常标签不带 message 等）。

baseline，经 `node tools/privacy/redact.mjs` 过滤后原样：

```text
PASS B-01 HTTPS 可达（DNS 和 TLS 正常）
PASS B-02 http 跳转到 https
PASS B-03 8090 从外面连不上 CLOSED
VERIFY OK (3 checks)
```

`redact.mjs --check` 对这份输出退出码 0。full 阶段只实现、没有运行（会往探针库里新建 1 条 `verify-` 开头的 probe_results 和 1 条 probe_pings，探针账号没有删除权限，汇总时按前缀剔除）。

## 锚点只读检查（真实服务器）

| 检查 | 命令（只读） | 结果 |
|------|-------------|------|
| 锚点行数 | `ssh -o BatchMode=yes usj 'sudo -n grep -cE "<锚点正则>" "$(readlink -f /etc/nginx/sites-enabled/default)"'` | `1` |
| 锚点块 | `ssh -o BatchMode=yes usj 'sudo -n awk -f /dev/stdin "$(readlink -f …)"' < tools/probe/server/nginx/anchor-block.awk` | `ANCHOR_BLOCK=443ssl` |

与研究稿的判断一致，批次 B 的挂载方式不需要重新设计。

## 批次 B 的 sha256 清单（给 06-08 请求批准用）

`sha256sum --text` 格式，两个空格，路径相对 `tools/probe`（解析时同时接受两个空格和空格加星号）：

```text
dee8b5458804313034d8b7cc4e8301e55f49494feeea5a04ae733fc57ebabeef  server/nginx/usj-probe-locations.conf
87d929b5a1adabe0dc10b7eb3fbd13feb085f83951a965156716946c7b9e8928  server/nginx/anchor-block.awk
e665e58eb657c3eb3168f28d29127b470664aba873bdfd4f77c45784076bf6b7  server/05-nginx-probe.sh
fb60e1755ff13f118c3b257e29c29829d271816b3c18c21079612d35f1c5f172  server/pocketbase.service
e9974aedb785b206a1238352bcfa4a1d7313e9c34448982bd9bb4fc269155c8a  server/04-start-pocketbase.sh
8a1d8295fd39932dcbbb1f76d02911310db834f69d37206d81fe61c389a82705  server/06-install-probe-page.sh
```

批次 A 的 5 个已批准文件的 sha256 仍然不变：`sha256sum -c --strict` 全部 OK。执行顺序（06-09）是 04、05、06：06 最后删除上传目录，所以必须是最后一步；批次 B 之前批次 A 要先跑完，所有者在 D-05 建好超级用户之后才能跑 04。

## Task Commits

1. **Task 1: tracer——verify-site.mjs，baseline 经真实域名跑通** - `8ab1ea8`（feat）
2. **Task 2: nginx 片段、anchor-block.awk、05-nginx-probe.sh** - `5960365`（feat）
3. **Task 3: pocketbase.service、04-start-pocketbase.sh、06-install-probe-page.sh** - `5a074a9`（feat）

**Plan metadata:** 见随后的 docs 提交（STATE、ROADMAP）

## Files Created/Modified

- `tools/probe/verify-site.mjs` - 外部检查；导出纯函数 `parseConfigJs`、`parseSha256Sums`、`checkProbeHeaders`、`isHttpsRedirect`、`payloadFitsSchema`、`SseParser`、`errTag`
- `tools/probe/server/nginx/usj-probe-locations.conf` - 四个位置块：`= /api/realtime`、`^~ /api/`、`^~ /_/`、`^~ /probe/`
- `tools/probe/server/nginx/anchor-block.awk` - 输出 `ANCHOR_BLOCK=443ssl|other|none|multiple`，只有 443ssl 退出码 0
- `tools/probe/server/05-nginx-probe.sh` - 两项断言、备份、include、nginx -t、reload、certbot dry-run、自动回滚
- `tools/probe/server/pocketbase.service` - 非 root、127.0.0.1:8090、内存上限、沙箱项
- `tools/probe/server/04-start-pocketbase.sh` - 超级用户前置检查、启动、健康等待、绑定检查、日志可疑行计数
- `tools/probe/server/06-install-probe-page.sh` - 核对 SHA256SUMS 后安装探针页，不碰 config.js，最后删除上传目录

## Decisions Made

见 frontmatter 的 key-decisions。与研究稿的差异：

- **D-13：** `/_/` 反代给 PocketBase，不是 404；也没有按集合名或集合 id 挡 `_superusers` 的 404 位置。
- **不在 server 层加指令：** 研究稿在 server 层写了 `server_tokens off`、`access_log`、三条 `add_header`；现在这些都写进每个位置里（add_header 不继承，位置自己带全）。
- **访问日志关闭：** 每个位置 `access_log off`（D-09，不在日志里留客户端 IP），所以没有 `conf.d/usj-probe.conf` 和 `log_format`，片段是唯一的 nginx 文件。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 加固] 04 脚本的超级用户只读查询改用 pocketbase 用户运行**
- **Found during:** Task 3
- **Issue:** 计划写的是 `sudo -n python3 -I -`（root 运行）。root 以只读方式打开一个 WAL 模式的 sqlite 库，可能在 pb_data 里留下 root 所有的 -shm 文件，之后 pocketbase 用户打不开数据库，服务起不来。
- **Fix:** 改成 `sudo -n -u pocketbase python3 -I -`，仍然是 heredoc、只读打开（`mode=ro`）。
- **Files modified:** tools/probe/server/04-start-pocketbase.sh
- **Commit:** 5a074a9

**2. [Rule 2 - 加固] 05 脚本多备份了原来就存在的片段，回滚时恢复而不是直接删除**
- **Found during:** Task 2
- **Issue:** 重跑 05 时片段可能已经存在，回滚时直接删除会丢掉上一次成功安装的片段。
- **Fix:** 片段已存在时先备份到备份目录，回滚时恢复它；不存在才删除。
- **Commit:** 5960365

**3. [Rule 2 - 加固] 06 脚本在核对哈希前先确认 SHA256SUMS 里有 SDK 条目**
- **Issue:** `sha256sum -c` 对一个没有对应条目的清单可能在别的情形下空通过。
- **Fix:** 先 grep 条目再核对。
- **Commit:** 5a074a9

**4. [Rule 1 - 隐私检查拦下自检里的合成邮箱] Task 1 第一次暂存时规则 C 命中自检里写死的合成邮箱字面量**
- **Fix:** 邮箱在运行时用 `['…', 'probe.example'].join('@')` 拼出，与隐私检查的“样本运行时拼接”约定一致；重新暂存后通过，提交只含修复后的版本。
- **Commit:** 8ab1ea8

**Total deviations:** 4 个自动加固或修正（3 个 Rule 2，1 个 Rule 1）。**Impact:** 都在计划意图之内，没有改变范围，也没有触碰已批准的批次 A 文件。

## Authentication Gates

无。服务器访问只用了免密 sudo 的只读命令。

## Issues Encountered

- 计划里 Task 3 的 verify 命令里 `printf "%s\n"` 的换行被写成了真实换行，直接运行会出错；改用等价的逐项检查（同样的关键字、bash -n、CR、eol 属性、暂存、隐私检查）。结果全部通过，没有放宽任何检查。

## Known Stubs

无。

## Threat Flags

无新增：本计划新增的信任边界（公网经 nginx 到 PocketBase、nginx 配置与 certbot 续期、verify-site 输出）都在计划的威胁登记里（T-06-18、19、20、21、32、SC）。T-06-21（公开的 /_/ 被猜口令）按 D-13 接受，缓解靠强口令和限流，F-14 在 06-09 验证 429。

## User Setup Required

无。下一步是 06-08：把批次 A 和批次 B 的文件按上面的 sha256 清单交给所有者批准、上传并执行批次 A；批次 B 在 06-09 执行，之后用 `verify-site --stage full` 验收。

## Next Phase Readiness

- 06-08、06-09 可以直接使用上面的批次 B 清单；批次 B 的 6 个文件批准之后不得再改（任何改动都要重新批准）。
- 仍是假设的部分：certbot 的 nginx 插件能解析带 `^~`、`=` 修饰的位置块（05 的 dry-run 会暴露）；`add_header` 不继承的行为由 F-01 验证；systemd 沙箱项不影响 Go 运行时（04 启动失败会停下）；F-14 依赖 PocketBase 默认限流（迁移里已打开）；`verify-site` full 阶段的 SSE 检查和 04 脚本在真实环境的行为都要到 06-09 才第一次运行。
- INFRA-01、INFRA-02 不在这里标记完成，等 06-09 之后。

## Self-Check: PASSED

- 7 个文件均存在（verify-site.mjs、nginx 两个文件、05、04、06、pocketbase.service）；提交 8ab1ea8、5960365、5a074a9 都是 HEAD 的祖先，`git rev-list --count` 实测为 3。
- 批次 A 的 5 个哈希 `sha256sum -c --strict` 全部 OK；批次 B 的哈希已记录。
