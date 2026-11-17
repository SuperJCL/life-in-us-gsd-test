---
phase: 13-deploy-hardening-acceptance
reviewed: 2026-11-17T00:00:00Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - .gitattributes
  - PRIVACY.md
  - deploy/README.md
  - deploy/build-site.mjs
  - deploy/make-acceptance-data.mjs
  - deploy/make-icons.mjs
  - deploy/pb_hooks/backup-watch.pb.js
  - deploy/pb_migrations/1794096150_retire_probe.js
  - deploy/pb_migrations/1794096200_server_settings.js
  - deploy/server-check.mjs
  - deploy/server-config-check.mjs
  - deploy/server/00-status.sh
  - deploy/server/01-swap.sh
  - deploy/server/02-install-pocketbase.sh
  - deploy/server/03-configure-pocketbase.sh
  - deploy/server/04-start-pocketbase.sh
  - deploy/server/05-nginx-app.sh
  - deploy/server/06-install-site.sh
  - deploy/server/07-retire-probe.sh
  - deploy/server/logrotate/usj-nginx
  - deploy/server/nginx/anchor-block.awk
  - deploy/server/nginx/usj-app.conf
  - deploy/server/nginx/usj-headers-common.conf
  - deploy/server/nginx/usj-headers-proxy.conf
  - deploy/server/nginx/usj-log-format.conf
  - deploy/server/pb-admin.sh
  - deploy/server/pocketbase.service
  - deploy/server/restore-drill.sh
  - deploy/site/manifest.webmanifest
  - deploy/site/sw.js
  - deploy/verify-site.mjs
  - tests/README.md
  - tests/cloud/csp.spec.ts
  - tests/cloud/same-origin.spec.ts
  - tests/cloud/sw-offline.spec.ts
  - tests/cloud/sw-update.spec.ts
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/deploy-tools.spec.ts
  - tests/e2e/platform/site-assets.spec.ts
  - tests/support/constants.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/goals.ts
  - tests/support/static-server.cjs
  - tests/support/strings.ts
  - tests/support/test.ts
  - tools/pb/lib/instance.mjs
  - tools/probe/README.md
  - us-journey-tracker.html
findings:
  critical: 0
  warning: 8
  info: 11
  total: 19
status: issues_found
---

# Phase 13: Code Review Report

**Reviewed:** 2026-11-17
**Depth:** standard
**Files Reviewed:** 48
**Status:** issues_found

## Summary

本次审查覆盖 Phase 13 的 Service Worker、构建脚本、服务器模板（01–07、pb-admin、restore-drill、nginx、logrotate、systemd）、PocketBase 迁移和钩子、本机检查脚本及其测试。`us-journey-tracker.html` 只看了 Service Worker 注册、「有新版本 / 点此更新」和 `swUnsaved`、云端开关这几处。

没有发现需要阻止发布的缺陷（0 个 BLOCKER）：这些脚本在真实服务器上已经跑通，回滚路径和守卫写得相当严。主要风险集中在「下一次升级」和「Phase 16」：

- 页面、CSP 头和 Service Worker 缓存三者的一致性在部署瞬间有一个窗口，而且 SW 版本号不覆盖 CSP 头本身（WR-01、WR-02）。
- 升级路径里有几处文档和脚本互相矛盾，或者被硬编码清单卡住（WR-03 至 WR-06、WR-08）。
- 恢复演练可以空转通过（WR-07）。

范围说明：`deploy/server-check.mjs` 只读到第 1126 行（检查函数、清单和前半部分自检夹具），后面是自检用的合成夹具，没有逐行读；`tests/support/strings.ts` 只是常量表，没有逐行读；`tests/support/expect-from-fixture.ts` 和 `goals.ts` 与 Phase 13 关系很小，只做了浏览。没有运行任何测试、脚本或 ssh，也没有读 `private/`。

## Warnings

### WR-01: 06 先换页面再 reload nginx，窗口内的新页面带着旧 CSP，而 SW 预缓存可能把这份坏页面永久缓存

**File:** `deploy/server/06-install-site.sh:206-230`，`deploy/site/sw.js:15-18`
**Issue:** 06 的顺序是：把新 `usj-csp.conf` 写进 `/etc/nginx/snippets/`（nginx 还没读），`mv -T` 切换 `site` 符号链接（对新请求立刻生效），最后 `nginx -t` 加 `reload`（新 CSP 这时才生效）。`mv` 到 reload 完成之间，`location = /` 返回的是新页面、旧 CSP：新的内联脚本和样式哈希不在旧策略里，浏览器拦下它们，白屏。

这个窗口只有几十毫秒到一两秒，对普通访问影响很小。真正的问题是 Service Worker：`sw.js` 的 `install` 用 `fetch('/', {cache:'reload'})` 把响应连同响应头一起 `cache.put`。如果某个用户的浏览器恰好在这个窗口里取 sw.js 并安装（升级后第一批回前台的用户都会触发），缓存里就是「新页面 + 旧 CSP」。之后 `/` 一律从缓存答，带着缓存里的旧 CSP 头，白屏，线上和离线都一样，直到下一次外壳变化才会自愈。`verify-site --stage full` 的 F-02 只检查服务器当前返回的内容，发现不了某个客户端已经缓存了坏页面。

**Fix:** 让切换对 CSP 是原子的。最简单的做法是分两步 reload：
```bash
# 1) 先装「旧哈希 ∪ 新哈希」的过渡 CSP 并 reload（本构建同时产出，或由 06 从旧 usj-csp.conf 里取出哈希拼接）
# 2) 切换符号链接
# 3) 装只含新哈希的最终 CSP 并 reload
```
更省事的补救是让 SW 在 `install` 里拒绝不一致的外壳：取回 `/` 之后核对响应头 `content-security-policy` 里含有页面每个内联块的 sha256，不含就 `throw`（安装失败，旧版本继续用，下次再试）。至少应在 README 第 8 节写明「部署后立刻跑 `--stage full`，并在两台设备上各看一次页面」。

### WR-02: 外壳版本号不包含 CSP 头，只改 CSP 策略的发布不会到达老用户

**File:** `deploy/build-site.mjs:128-135`（`shellVersion`），`deploy/build-site.mjs:172`
**Issue:** `shellVersion` 只对页面、SDK、清单、4 个图标取哈希。SW 会把 `/` 的响应头（含 `Content-Security-Policy`）一起缓存，页面始终从缓存答。如果以后只改 `buildCsp`（例如给 `connect-src` 加一项、收紧某个指令）或 nginx 头文件，页面内联块没变，版本号不变，`sw.js` 的字节也不变，浏览器不会触发更新，老用户一直拿着缓存里的旧 CSP。反过来，策略放宽后再收紧，已缓存的页面也收不回去。
**Fix:** 把 CSP 头文本喂进版本号：
```js
export function shellVersion({ indexHtml, sdk, manifest, icons, cspConfText }) {
  const h = createHash('sha256');
  h.update(Buffer.from(indexHtml, 'utf8'));
  h.update(Buffer.from(cspConfText, 'utf8')); // 新增
  ...
}
// buildSite 里先算 cspConfText，再传给 shellVersion
```
并在自检里加一条：「只改 buildCsp 的一个指令，版本号变」。

### WR-03: 03 只要有工具文件变化就要求停掉线上 PocketBase

**File:** `deploy/server/03-configure-pocketbase.sh:128-131,171-175`
**Issue:** `NEED_CHANGE` 在 `pb-admin.sh` 或 `restore-drill.sh` 与服务器上的版本不同时置为 `yes`，随后只要服务在运行就退出 1。也就是说，修一个恢复演练脚本的 bug、或者 `pb-admin.sh` 的措辞，也得先停掉线上服务。这两个文件装在 `/usr/local/sbin`，更新它们和 PocketBase 进程毫无关系。三个人在用的站点为了换一个演练脚本要停机，会逼着以后的操作者绕过 03（手工 `install`），绕过就脱离了批准清单和 sha256 核对。
**Fix:** 只在会改迁移、钩子（它们要靠重启生效）或环境文件时才检查服务状态：
```bash
NEED_RESTART_SAFE=no
# 迁移、钩子有 new，或 ENV_STATE=missing 时才置 yes
if [ "$NEED_RESTART_SAFE" = yes ] && systemctl is-active --quiet pocketbase ...; then ... fi
```
`pb-admin.sh` 和 `restore-drill.sh` 的安装放在检查之外。

### WR-04: 迁移清单在 6 处硬编码，新增迁移会被静默漏装，而本机检查却会测到它

**File:** `deploy/build-site.mjs:49-73`，`deploy/server/03-configure-pocketbase.sh:77,236`，`deploy/server/04-start-pocketbase.sh:117`，`deploy/server/00-status.sh:180`，`deploy/server-config-check.mjs:98-109`，`deploy/verify-site.mjs:51-62`
**Issue:** 迁移文件名同时写死在 `BUNDLE_SOURCES`、`BUNDLE_COUNT`（32）、03 的 `MIGRATIONS` 和 `PB_MIGRATIONS_APP=4`、04 的检查循环、00-status 的循环、README 的文件数里。而 `server-config-check.mjs` 的 `makeMigrationsDir` 用 `readdirSync` 复制 `pb/pb_migrations/` 和 `deploy/pb_migrations/` 下的全部文件。结果是：以后在 `pb/pb_migrations/` 加一个新迁移（Phase 16 之前如果还有集合变化），本机检查和隔离脚本会把它一起测，通过，而上传包不含它、03 不装它、04 不检查它，服务器上线后缺集合，应用只会表现为同步失败。当前两个目录里的文件恰好和清单一致（`pb/pb_migrations/` 只有 2 个，`deploy/pb_migrations/` 只有 2 个），所以现在没有出错，但没有任何检查守着这个一致性。
**Fix:** 在 `build-site.mjs` 里让 `BUNDLE_SOURCES` 的迁移部分从两个目录自动枚举（排序后），或者至少加一项检查（放进 `verify-site --check-bundle` 的 BD-02，或 `server-check`）：`pb/pb_migrations/*.js` 和 `deploy/pb_migrations/*.js` 的文件名集合必须等于 `BUNDLE_SOURCES` 里 `pb_migrations/` 开头的目标集合。03、04、00-status 的清单可以改成读上传目录的 `pb_migrations/` 列表。

### WR-05: README 第 8 节写的 PocketBase 升级办法，被 02 自己拒绝，也过不了 C-10

**File:** `deploy/server/02-install-pocketbase.sh:34-48,103-104`，`deploy/server-check.mjs:277-297`（`c10`），`deploy/README.md:128`
**Issue:** README 说「改 `02-install-pocketbase.sh` 里钉死的下载地址和 sha256、改版本号，所有者批准下载」。照做之后在服务器上运行 02：已装版本（旧）不等于新的 `PB_VERSION`，走到第 103-104 行报「本脚本不做升级」退出 1，根本不下载。同时 `c10` 要求脚本里钉死的两个 sha256 与 `tools/probe/server/02-install-pocketbase.sh`（Phase 6 的历史文件）逐个相同，改了钉死值，`server-check` 自己就会 FAIL。换句话说，文档里唯一的升级路径无法执行。再叠加 04 在失败时执行 `disable --now`（见 WR-08），一次 PocketBase 升级没有可用的演练过的路径。
**Fix:** 要么在 README 里如实写「PocketBase 升级目前没有自动化脚本，需要新增一个批准后的 `02b-upgrade-pocketbase.sh`（备份 pb_data、停服务、换二进制、04）」，要么现在就把升级路径做出来：允许 `PB_UPGRADE_FROM=<旧版本>` 之类的显式参数，并把 `c10` 的「与 Phase 6 相同」改成「与脚本里的版本表自洽」。

### WR-06: README 说 HSTS 之后改一下头文件就行，但 verify-site 和 server-check 都把 86400 写死了

**File:** `deploy/verify-site.mjs:109`，`deploy/server-check.mjs:522-542`（`c17`），`deploy/server/nginx/usj-headers-common.conf:18`，`deploy/README.md:129`
**Issue:** README 第 8、12 节和头文件注释都计划「验收通过、见过一次真实续期之后提高 HSTS」，操作说明只有「改 `usj-headers-common.conf` 和 `usj-headers-proxy.conf` 里的值」。但 `checkPageHeaders` 要求 `max-age=86400`，`c17` 要求每条 HSTS 恰好是 `add_header Strict-Transport-Security "max-age=86400" always;`，`server-check --self-test` 里也有对应的反例。提高 HSTS（Phase 16 验收后的计划动作）会让 `--stage full` 的 F-01 和 `server-check` 的 C-17 变红，操作者很可能为了让检查通过而改回去，或者随手放宽检查。
**Fix:** 把期望值提成一个常量（比如 `HSTS_MAX_AGE`），`verify-site.mjs`、`server-check.mjs`、两个头文件的检查都用它，README 第 8 节写明「改这个常量和两个头文件，同一次批准」。

### WR-07: 恢复演练可以空转通过：不检查备份新旧，也不要求真的逐份比对过文档

**File:** `deploy/server/restore-drill.sh:238-243,321-335,361-373`
**Issue:** 三个缺口叠加：
1. `DRILL_NEWEST_AGE_H` 只输出，不判断。R2 里最新的自动备份是 100 小时前也照样「通过」，而演练的目的之一正是证明「昨天的备份能恢复」。
2. 逐份比对只在 `row[0] <= ts`（线上文档在备份时间之前更新过）时才算 `compared`；之后更新过的算 `changed`，不比。如果测试账号的文档在备份之后都被改过，`compared` 为 0、`mismatch` 为 0，仍然通过。通过条件只有 `DRILL_DOCS_MISMATCH=0` 和「至少 1 个用户同时有 state 和 plan」，不看 `compared >= 1`。
3. `ts` 取的是备份文件的 `modified`（上传完成时间），不是数据快照时间。快照之后、上传完成之前更新的文档会被算进 `compared` 并因内容不同判成 `mismatch`，出现偶发的假失败。

另外，线上文档被删除时 `row is None` 也被计为 mismatch，同样是假失败。
**Fix:** 在 shell 里加：`AGE_H` 大于 40 就 `die`；`DRILL_DOCS_COMPARED` 小于 1 时输出警告并失败，或把条件写成「`compared + changed == len(rdocs)` 且 `compared >= 1`」。对 `row is None` 和备份时间边界这两种情况，改成单独计数（`DRILL_DOCS_MISSING_LIVE`），不混进 mismatch。

### WR-08: 04 覆盖旧 unit 时不留备份，README 的回滚步骤「恢复旧 unit 文件」无处可恢复

**File:** `deploy/server/04-start-pocketbase.sh:138-149,129-135`，`deploy/README.md:135`
**Issue:** 04 在 `NEW_SUM != OLD_SUM` 时直接 `install` 覆盖 `/etc/systemd/system/pocketbase.service`，没有备份旧文件（06 保留 3 个版本目录，05 备份到 `/etc/nginx/usj-backup/`，04 是三个改动脚本里唯一不留后路的）。随后 `restart` 如果起不来，`fail_and_disable` 执行 `disable --now`：线上站点停了，也不会开机自启，而旧 unit 已经没有了。README 第 9 节的回滚是「恢复旧 unit 文件」，操作者只能靠 git 历史重新构建旧提交的包再上传，而旧提交的包未必能原样重建。
**Fix:** 覆盖前先 `sudo cp -p "$UNIT_DST" "$UNIT_DST.usj-backup.$(date -u +%Y%m%dT%H%M%SZ)"`，在 `fail_and_disable` 里把备份放回并 `daemon-reload`，再尝试用旧 unit 起一次（或至少在错误信息里打印备份文件名）。

## Info

### IN-01: 导入真实数据之后恢复演练永久被守卫挡住，Phase 16 之后没有任何办法再证明「备份能恢复」

**File:** `deploy/server/restore-drill.sh:106-124`，`deploy/README.md:151`
**Issue:** 这是所有者 2026-11-12 的决定，不是缺陷，但值得在 Phase 16 之前明确：守卫要求线上库里只有 `test-…@example.com` 账号，导入真实数据之后 `usj-restore-drill` 永远输出 `DRILL_GUARD=refused`。从此「R2 里的备份能恢复」只在导入之前证明过一次，之后只剩 `backup-watch` 的「有新文件」和看 R2。真实恢复（后台 restore）将是第一次在真实数据上做。
**Fix:** 考虑加一个只读的备份校验替代：定期（或手动）把最新备份下载到临时目录，在一次性实例上只跑 `PRAGMA integrity_check` 和文档计数，不比对内容、不要求测试账号。或者在 README 里把「导入真实数据前最后一次演练的日期」当作验收记录保留。

### IN-02: 点「点此更新」后如果 SKIP_WAITING 没有引发 controllerchange，横幅会一直停在「正在更新…」且按钮不可点

**File:** `us-journey-tracker.html:2437-2439`
**Issue:** `swUpdate` 在 `swGo=true` 之后只 `postMessage({type:"SKIP_WAITING"})`，靠 `controllerchange` 触发刷新。如果等待中的 worker 刚好被更新的版本顶替成 redundant，或消息没有被处理，页面没有任何兜底，`swGo` 置位后 `swOffer` 也不再显示横幅，用户只能手动刷新。概率很低，测试里也没有覆盖。
**Fix:** 在 `postMessage` 之后加一个兜底：
```js
setTimeout(()=>{if(!swReloaded){swReloaded=true;location.reload()}},4000);
```

### IN-03: 备份看门狗在没配好 SMTP 时静默，首次部署当天还会误报

**File:** `deploy/pb_hooks/backup-watch.pb.js:14-45`
**Issue:** 看门狗的目的是在备份悄悄失效时发邮件，但发信失败只写 `logger().error`（PocketBase 日志保留 30 天，没人会去看）。SMTP 没配好或授权码过期恰好是「备份失败 + 没人知道」最可能同时发生的情形。另外部署当天 20:30 UTC 如果还没到第一次 19:00 的自动备份（服务器在 19:00–20:30 之间部署），`newest===0` 会发一封误报。README 第 10、12 节已经把「次日去 R2 看」写成人工兜底，这里只是提醒：这个钩子在最需要它的场景里是哑的。
**Fix:** 无需改代码也可以：在验收清单里加一项「验收后第二天确认 R2 有新备份且收到过一次看门狗测试邮件」（可以用后台手动触发 `/api/crons/usj-backup-watch` 配合一次性删掉备份来演练，本机 `server-config-check --local watchdog` 已经覆盖这个流程）。如果想消除首日误报，可以在 `newest === 0` 且应用运行时间小于 26 小时时跳过。

### IN-04: nginx 错误日志会记完整请求行，包括后台下载备份链接里的 `?token=`

**File:** `deploy/server/nginx/usj-log-format.conf:6-12`，`deploy/README.md:18`
**Issue:** 访问日志用 `$uri` 避开查询串，这点做对了。但 nginx 的 `error_log` 在上游错误（502、504、连接被拒）时会写 `request: "GET /api/…?token=… HTTP/1.1"`，原文含查询串。04 每次 `restart` 都会让正在进行的请求报上游错误。README 第 2 节只说错误日志「也会记客户端 IP」，没提它会带令牌，「令牌不会进日志」的说法不完整。令牌是短时有效的文件令牌，风险很低。
**Fix:** README 第 2 节改成「访问日志不含查询串；错误日志在上游出错时含完整请求行（含 `?token=`，短时有效），保留约 14 天」，或把应用站点的 `error_log` 也指到 `/var/log/usj/error.log` 并按 7 天轮转。

### IN-05: `process.env.TEMP = undefined` 会变成字符串 "undefined"

**File:** `deploy/server-config-check.mjs:847-866`
**Issue:** `runLocal` 保存 `oldTemp = {TEMP: process.env.TEMP, ...}`，结束时无条件赋回。在 Node 里把 `undefined` 赋给 `process.env.X` 会得到字符串 `"undefined"`。这个脚本只在 Windows 上用（`pocketbase.exe`），TEMP 总是有值，所以现在不出错；移到别的环境就会让之后的 `os.tmpdir()` 指向一个叫 `undefined` 的目录。
**Fix:**
```js
for (const k of ['TEMP', 'TMP']) { if (oldTemp[k] === undefined) delete process.env[k]; else process.env[k] = oldTemp[k]; }
```

### IN-06: SW 的 activate 删除源下所有不叫当前名字的缓存，并且「不留半套缓存」的注释不准确

**File:** `deploy/site/sw.js:16-21`
**Issue:** `activate` 用 `ks.filter(k => k !== CACHE)`，没有限定 `usj-shell-` 前缀，会删掉同源下别的缓存（现在没有别的，以后加了就会误删）。另外 `install` 里 `caches.open(CACHE)` 先建了缓存再逐个 `put`，某个文件取失败时已经 `put` 的条目仍留在 `usj-shell-<版本>` 里，注释说「不留半套缓存」并不成立。当前不会造成错误（同名版本重试会覆盖，不同版本 activate 会删），只是说法和行为不一致。
**Fix:** `ks.filter((k) => k.startsWith('usj-shell-') && k !== CACHE)`；注释改成「安装失败，旧版本继续用；残留的半套缓存在下次 activate 时删除」，或在失败时 `caches.delete(CACHE)`。

### IN-07: 测试静态服务器的版本开关是一个会改状态的 GET

**File:** `tests/support/static-server.cjs:145-155`
**Issue:** `GET /__test/sw-version/<v>` 改内存里的版本号。Host 白名单挡得住 DNS rebinding，但开发者在测试运行期间打开的任何网页都可以向 `http://127.0.0.1:4789/__test/sw-version/x` 发一个 `<img>` 请求，Host 头合法，版本就被改了，会让正在跑的 SW 用例出现莫名其妙的失败。没有安全影响。
**Fix:** 改成 `POST`（`405` 已经对非 GET/HEAD 生效，需要为这个路径放开），或要求一个固定的自定义请求头（跨站页面发不出带自定义头的简单请求）。

### IN-08: manifest 的 description 与 name 相同，是升级演练留下的占位

**File:** `deploy/site/manifest.webmanifest:4`
**Issue:** `"description": "计划手记"` 与 `name` 重复，提交说明显示它是为 13-14 的升级演练专门加的字段。字段合法，但对用户没有信息量，并且它已经进了线上版本号。
**Fix:** 要么写一句真正的说明（例如「每天记一笔，三个人各自登录、多设备同步」），要么删掉；任何改动都会换版本号，可以和下一次功能发布合并。

### IN-09: verify-site 的 F-11 在锁定失效时会在线上真的创建一个账号

**File:** `deploy/verify-site.mjs:675-678`
**Issue:** F-11 向线上 `/api/collections/users/records` POST 一个随机邮箱的注册请求，期望被拒。如果 `users.createRule` 被误改成放开，这个检查本身就会创建一个 `anon-<hex>@example.com` 账号，F-11 会报 FAIL，但账号留在库里，而且后续恢复演练的守卫会把它当测试账号放行（邮箱是 `example.com` 但不以 `test-` 开头，所以其实会被守卫拒绝，导致演练不可用）。
**Fix:** 失败分支的 note 里提醒「请在后台删除 `anon-` 开头的账号」，或者改用 `OPTIONS`/带校验错误的请求（例如缺字段）来探测规则：`createRule` 不放开时返回 403，放开时返回 400（校验失败）且不创建记录。

### IN-10: inlineBlocks 的 `\bsrc=` 判断会把 `data-src=` 之类的属性误当成外部脚本

**File:** `deploy/build-site.mjs:89`
**Issue:** `(?![^>]*\bsrc=)` 中 `\b` 在 `-` 和 `s` 之间也成立，所以 `<script data-src="x">…</script>` 会被排除在内联块之外，它的哈希就不会进 CSP，浏览器会拦下它。当前页面里没有这种标签，BD-04 会在出现时立刻报错，所以只是个潜在坑。
**Fix:** 改成 `(?![^>]*\ssrc\s*=)`。

### IN-11: 若干文档和测试里的陈旧引用与重复常量

**File:** `tests/README.md:86`，`tests/e2e/platform/site-assets.spec.ts:2`，`PRIVACY.md:91,110-119`，`deploy/README.md:201`，`tests/e2e/platform/deploy-tools.spec.ts:20`
**Issue:**
- `tests/README.md` 第 86 行说 cloud 策略「只放行 `/`、`/us-journey-tracker.html` 和 `/vendor/pocketbase.iife.js`」，实际 `CLOUD_APP_PATHS` 还含 `/sw.js`、清单和 4 个图标。
- `site-assets.spec.ts` 和 `deploy/README.md` 第 201 行提到「13-15 总体验收」和 `13-ACCEPTANCE.md`，验收现在是 Phase 16；`PRIVACY.md` 第 91 行也说真实迁移「由所有者在 Phase 13 于本机运行」。
- `PRIVACY.md` 的小节顺序是 §7、§9、§8。
- `tests/README.md` 第 283 行说 CSP 用例走完「四个视图」，`csp.spec.ts` 实际走五个视图；`deploy-tools.spec.ts` 里写死 `(33 files)`，文件总数在 `BUNDLE_COUNT`、README、该 spec 三处各写一遍。
**Fix:** 逐条改文字；`deploy-tools.spec.ts` 可以 `import { BUNDLE_COUNT } from '../../../deploy/build-site.mjs'` 后写 `${BUNDLE_COUNT + 1}`。

---

_Reviewed: 2026-11-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
