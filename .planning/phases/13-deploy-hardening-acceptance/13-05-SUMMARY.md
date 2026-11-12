---
phase: 13-deploy-hardening-acceptance
plan: 05
subsystem: server-config
tags: [pocketbase, rate-limit, trusted-proxy, backups, pb-hooks, encryption-key, probe-retire, sec-02, ops-01]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-04 的站点构建输出布局（本计划的迁移和钩子之后会加进同一个构建输出）
  - phase: 8-local-pocketbase
    provides: tools/pb/lib/instance.mjs 的 withInstance、已批准且 sha256 钉死的 0.41.1 程序、pb/rules.expected.json、pb:isolation
provides:
  - deploy/pb_migrations/1794096200_server_settings.js：无凭据的服务器设置迁移
  - deploy/pb_migrations/1794096150_retire_probe.js：探针集合和探针账号的清理迁移（保留路线）
  - deploy/pb_hooks/backup-watch.pb.js：usj-backup-watch 看门狗
  - deploy/server-config-check.mjs：settings、watchdog、retire、rotate 四个场景共 24 项本机检查，加 --self-test（32 条）
  - tools/pb/lib/instance.mjs：withInstance 的可选 opts.hooksFrom，加导出 copyHooks
affects: [13-06 服务器模板, 13-07 nginx（X-Real-IP 头名）, 13-08 README 和 verify-site, 13-09 探针数据决定, 13-12 超级用户两步验证, 13-13 恢复演练]

actuals:
  tokens: 11000
  tasks: 3
  commits: 3
plan_head_before: fc5805bd9562756f79aaa4601165ca79a79c4cd1
plan_head_after: 5c6ac1e777195c78322d88270cfa3d507307df44

tech-stack:
  added: []
  patterns:
    - "服务器设置走 deploy/pb_migrations/ 下的迁移，不放进 pb/pb_migrations/（后者是应用契约，打开限流会干扰隔离脚本）"
    - "限流和日志按 trustedProxy.headers=[X-Real-IP] 解出的客户端 IP 算，头名必须与 nginx 的 proxy_set_header 一致"
    - "看门狗的一切逻辑写在 cronAdd 回调里（JSVM 处理函数看不到外层变量）；收件人运行时从 _superusers 取"
    - "本机检查脚本用零依赖的假 SMTP 收件端证明邮件真的发出，用 node:sqlite 读 data.db 证明设置是密文"
    - "实例数据目录放在 test-results/server-config-check/ 下（运行时把 TEMP 指过去），结束后整个删除"

key-files:
  created:
    - deploy/pb_migrations/1794096200_server_settings.js
    - deploy/pb_migrations/1794096150_retire_probe.js
    - deploy/pb_hooks/backup-watch.pb.js
    - deploy/server-config-check.mjs
  modified:
    - tools/pb/lib/instance.mjs

key-decisions:
  - "日志里“客户端 IP”看 data.userIP（取自代理头），data.remoteIP 是直连对端（回环地址）；S-09 同时核对两者"
  - "钥匙轮换的步骤只写本机实测过的那一套：停服务 → 删 _params 里 id 为 settings 的行 → 换新钥匙 → 以新时间戳重放服务器设置迁移 → 启动"
  - "轮换会丢掉所有者在后台填过的 SMTP 和 S3 设置（整行被删），轮换后必须重新填并发测试邮件"
  - "超级用户的 OTP/MFA 不放进迁移，等 13-12 收到测试邮件后由所有者手动打开"
  - "13-09 若选“保留数据库”，清理迁移 1794096150 与应用迁移、服务器设置迁移一起装；选“清空”时它在全新库上什么也不做"

requirements-completed: [SEC-02, OPS-01]

coverage:
  - id: D1
    description: "服务器设置迁移在本机真实 0.41.1 实例上生效并能读回；后台登录同一 IP 第 6 次 429、换 IP 不受影响；日志里的客户端 IP 是代理头给的值"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "node deploy/server-config-check.mjs --local settings (SERVER-CONFIG OK (9 checks))"
        status: pass
    human_judgment: false
  - id: D2
    description: "看门狗在没有自动备份时给超级用户发「计划手记：备份异常」，有新备份时不发；备份上传失败时 PocketBase 自带告警邮件发给超级用户（本机假 SMTP 收件端证明）"
    requirement: OPS-01
    verification:
      - kind: other
        ref: "node deploy/server-config-check.mjs --local watchdog (SERVER-CONFIG OK (6 checks))"
        status: pass
    human_judgment: false
  - id: D3
    description: "探针清理迁移按服务器真实顺序演练：两个集合和探针账号删除、别的用户保留、集合规则与 rules.expected.json 一致"
    requirement: OPS-01
    verification:
      - kind: other
        ref: "node deploy/server-config-check.mjs --local retire (SERVER-CONFIG OK (5 checks))"
        status: pass
    human_judgment: false
  - id: D4
    description: "加密钥匙：带钥匙时设置存成密文，无钥匙或错钥匙时进程退出；轮换步骤实测可用"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "node deploy/server-config-check.mjs --local rotate (SERVER-CONFIG OK (4 checks))"
        status: pass
    human_judgment: false
  - id: D5
    description: "同版本、同应用迁移的隔离重跑"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "npm run pb:isolation (ISOLATION OK 48/48)"
        status: pass
    human_judgment: false
  - id: D6
    description: "线上真实服务器上的限流、日志 IP、备份、邮件（本计划只到本机层面）"
    requirement: OPS-01
    verification: []
    human_judgment: true
    rationale: "线上由 13-08 的 verify-site、13-13 的恢复演练和 13-15 总体验收核对；邮件能否到所有者邮箱要所有者自己看"

duration: 11min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 05: 服务器设置、备份看门狗、探针清理与钥匙轮换 Summary

**无凭据的服务器设置迁移（后台登录每 IP 60 秒 5 次、记代理头给的 IP、每天 03:00 北京时间自动备份留 30 份）、备份看门狗钩子、探针清理迁移和加密钥匙轮换，都在本机一次性 0.41.1 实例上实测通过，共 24 项检查，隔离重跑 48/48。**

## Performance

- **Duration:** 11 min（三个场景跑了十余次一次性实例）
- **Completed:** 2026-11-12
- **Tasks:** 3（1 个 tracer，2 个 auto）
- **Files:** 5（4 个新增，1 个修改）

## Accomplishments

- **设置迁移（Task 1，tracer）：** `s.logs.maxDays=30`、`logIP=true`、`logAuthId=false`、`trustedProxy.headers=["X-Real-IP"]`、5 条限流规则、`backups.cron="0 19 * * *"`、`cronMaxKeep=30`、`appName="usj"`；非注释代码行里没有 smtp、s3、otp、mfa。
- **看门狗（Task 2）：** `cronAdd("usj-backup-watch","30 20 * * *")`，`STALE_H = 40`，收件人运行时取，发信失败只记日志。
- **探针清理和轮换（Task 3）：** 清理迁移只删两个固定名字的集合和严格匹配 `probe-<8 位十六进制>@example.com` 的用户；轮换步骤实测可用。
- **本机检查脚本：** `deploy/server-config-check.mjs --self-test` 最后一行 `SELF-TEST OK (32 cases)`；`--local`（全部场景）最后一行 `SERVER-CONFIG OK (24 checks)`。

### 四个场景的 PASS 行

```
PASS S-01 日志保留 30 天、记客户端 IP、不记账号 id
PASS S-02 只信任 X-Real-IP 这一个代理头
PASS S-03 限流已启用
PASS S-04 限流规则恰好是 5 条且数值一致
PASS S-05 自动备份每天 19:00 UTC（北京时间 03:00）、保留 30 份
PASS S-06 应用名为 usj
PASS S-07 同一 IP 后台登录前 5 次 400、第 6 次 429
PASS S-08 换一个 IP 的后台登录不受影响（400，不是 429）
PASS S-09 请求日志里的客户端 IP（userIP）是代理头给的值，不是回环地址
SERVER-CONFIG OK (9 checks)

PASS W-01 定时任务里有看门狗（30 20 * * *）和内置自动备份（0 19 * * *）
PASS W-02 没有自动备份时看门狗恰好给超级用户发 1 封「计划手记：备份异常」
PASS W-03 运行内置自动备份任务后出现 @auto_pb_backup_usj_ 开头的备份
PASS W-04 有新备份时再运行看门狗，5 秒内没有新信
PASS W-05 备份上传失败时 PocketBase 自带告警邮件发给超级用户
PASS W-06 钩子运行后实例仍然健康
SERVER-CONFIG OK (6 checks)

PASS R-01 两个探针集合都已删除
PASS R-02 探针账号已删除
PASS R-03 别的用户保留
PASS R-04 清理后集合规则与 pb/rules.expected.json 一致
PASS R-05 服务器设置迁移也已应用（日志保留 30 天）
SERVER-CONFIG OK (5 checks)

PASS K-01 带钥匙启动后设置存成密文（不是合法 JSON）
PASS K-02 不带钥匙启动时进程以非 0 退出、从未健康
PASS K-03 轮换后新钥匙可以启动、超级用户能登录、设置读回正确且又是密文
PASS K-04 轮换后用旧钥匙启动时进程以非 0 退出、从未健康
SERVER-CONFIG OK (4 checks)
```

### `/api/crons` 能否运行内置备份任务

可用。`POST /api/crons/__pbAutoBackup__` 返回 204，备份在几秒内出现，`GET /api/crons` 里该任务的表达式是 `0 19 * * *`。`usj-backup-watch` 同样用 `POST /api/crons/usj-backup-watch` 触发。所以 W-03、W-05 没有退回“把 `backups.cron` 改成 `* * * * *` 等 70 秒”的办法，也没有改 `STALE_H`。

### 钥匙轮换的实测步骤原文（13-08 的 README 照抄）

前提：新旧钥匙都是 32 个十六进制字符，只放在 `/etc/usj/pocketbase.env`，不打印。

1. **停服务。** `systemctl stop pocketbase`。
2. **删掉 `_params` 里的 settings 行。** 库在停着的状态下，对 `pb_data/data.db` 执行 `DELETE FROM _params WHERE id = 'settings'`（本机演练用 `node:sqlite`；服务器上用 `sqlite3` 或同等工具，在 `pocketbase` 用户下操作）。
3. **换新钥匙。** 把 `/etc/usj/pocketbase.env` 里的 `PB_ENCRYPTION_KEY` 换成新值。
4. **以新时间戳重放一次服务器设置迁移。** 把 `1794096200_server_settings.js` 复制成 `<当前秒数>_server_settings_reapply.js`（`date +%s` 作前缀，放进 `pb_migrations/`）。
5. **启动。** `systemctl start pocketbase`；PocketBase 用默认设置重建 settings 行，再被重放的迁移写成密文。

实测结果：新钥匙启动成功、超级用户（在 `_superusers` 里，不受影响）能登录、`/api/settings` 读回 `logs.maxDays=30` 和 5 条限流规则、`_params` 里 settings 又是密文；之后再用旧钥匙启动，进程以非 0 退出。

**必须写进 README 的后果：** 第 2 步删掉的是整行设置，所有者在后台填过的 SMTP、S3（R2）凭据、发件人、两步验证开关之类的设置都会丢；轮换后要重新填写，并重新发测试邮件确认。备份文件里带的设置是用旧钥匙加密的，恢复旧备份时要用旧钥匙。

### A13 / A15 / A16 / A6 的结论

- **A13（已应用的探针迁移文件被删掉不让 PocketBase 报错）：成立。** retire 场景 B 段启动正常。
- **A15（前缀更小、尚未应用的应用迁移会在已应用的探针迁移之后照常执行）：成立。** B 段启动后 `journey_docs` 存在，集合规则与 `pb/rules.expected.json` 一致（R-04）。
- **A16（删掉 `_params` 的 settings 行后 PocketBase 启动时重建默认设置）：成立。** K-03 不必手动补任何东西。
- **A6（`$app.findAllRecords("_superusers")` 在钩子里可用）：成立。** W-02 的收件人正是那个超级用户。
- SMTP：PocketBase 的邮件客户端对不宣告 STARTTLS 和 AUTH、没有用户名口令的本机收件端照常发信。

### 隔离重跑

`npm run pb:isolation`（同一个 0.41.1、同一组应用迁移、只用合成账号）：最后一行 `ISOLATION OK 48/48`。成功标准 3 的隔离部分成立。

## Task Commits

1. **Task 1（tracer）：设置迁移和 settings 场景** - `d0c2d12`（feat）
2. **Task 2：看门狗钩子、hooksFrom、假 SMTP 收件端和 watchdog 场景** - `f034a1b`（feat）
3. **Task 3：探针清理迁移、retire 与 rotate 场景、隔离重跑** - `5c6ac1e`（feat）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] S-09 的日志字段：客户端 IP 在 `data.userIP`，不是 `data.remoteIP`**
- **Found during:** Task 1
- **Issue:** 计划写“`data.remoteIP` 等于 `198.51.100.7`”。0.41.1 的请求日志里 `remoteIP` 是直连对端（本机实测是 `127.0.0.1`），按代理头解出的真实客户端 IP 在 `userIP`。按计划的字段名检查永远找不到。
- **Fix:** S-09 核对同一条日志里 `userIP` 是 `198.51.100.7` 且 `remoteIP` 是 `127.0.0.1`，既证明日志记的是代理头给的值，也证明字段含义。
- **Files modified:** deploy/server-config-check.mjs
- **Verification:** `--local settings` 9 项通过
- **Committed in:** d0c2d12

**2. [Rule 1 - Bug] 密文判断把 BLOB 当成了逗号分隔的数字，K-01 本来会空转通过**
- **Found during:** Task 3（对照实验）
- **Issue:** `node:sqlite` 把 `_params.value` 读成 `Uint8Array`，我最初的 `isEncryptedSettings` 用 `String(value)` 去 `JSON.parse`，明文设置也会被判成“密文”，K-01 和 K-03 的“又是密文”都是空转通过。
- **Fix:** 先 `Buffer.from(value).toString('utf8')` 再解析；加自检用例（BLOB 里的 JSON 是明文、随机字节是密文）；另在一次性实例上做了对照：不带钥匙的实例判为明文，带钥匙的判为密文，然后重跑 rotate 4 项通过。
- **Files modified:** deploy/server-config-check.mjs
- **Verification:** `--self-test` 32 条通过；`--local rotate` `SERVER-CONFIG OK (4 checks)`
- **Committed in:** 5c6ac1e

**3. [Rule 2 - 项目规则] 实例数据目录放在 test-results/ 下**
- **Found during:** Task 1
- **Issue:** `instance.mjs` 用系统临时目录；项目规则要求一次性实例的数据目录放在 `test-results/` 下并在用完后删除。
- **Fix:** `--local` 运行时把 `TEMP`/`TMP` 指向 `test-results/server-config-check/`，结束时整个删除（`withInstance` 和 `runPb` 都落在那里）。没有改 `instance.mjs` 的默认行为。
- **Files modified:** deploy/server-config-check.mjs
- **Verification:** 每次运行结束后 `test-results/server-config-check` 不存在，没有遗留 `pocketbase.exe`
- **Committed in:** d0c2d12

---

**Total deviations:** 3 auto-fixed（2 个 Rule 1，1 个 Rule 2）
**Impact on plan:** 都是为了让计划要证明的事真的被证明；没有加范围。

## Issues Encountered

- 用 shell 的 here-document 往文件里打补丁时，反斜杠转义被吃掉过两次（一次改坏了 `instance.mjs` 里的字符串，已用 `--self-test` 发现并改正；没有提交过坏文件），之后改用编辑工具。
- `tools/pb/lib/instance.mjs` 在工作区里是 CRLF（`core.autocrlf`），提交时会提示换行转换，属于既有状态，diff 只有新增的 25 行。
- 测试结束后没有遗留 `pocketbase.exe` 或 `find.exe` 进程；本计划没有启动 Playwright。

## Known Stubs

无。

## Threat Flags

无新增攻击面：本计划新增的是将在 13-06 之后装到服务器上的迁移和钩子（计划的威胁登记 T-13-09 到 T-13-13 已覆盖）和只在本机运行、只连 127.0.0.1 的检查脚本。T-13-09（后台口令爆破）的本机证据是 S-07；T-13-10 的本机证据是 S-08/S-09；T-13-11 是 W-02/W-05；T-13-12 是 R-03；T-13-13 是 S-01（`logAuthId=false`）。

## User Setup Required

None - 本计划没有任何外部服务配置；SMTP、S3 凭据、超级用户邮箱仍由所有者在后台填（13-12）。

## Next Phase Readiness

- 13-07 的 nginx 每个反代位置必须 `proxy_set_header X-Real-IP $remote_addr;`，头名要与迁移里的 `X-Real-IP` 一致。
- 13-08 的 README 照抄上面的轮换步骤和“轮换会丢后台设置”的提醒；`pb-admin.sh` 要带 `--encryptionEnv`。
- 13-09 若选“保留数据库”，把 `1794096150_retire_probe.js` 与应用迁移、`1794096200_server_settings.js` 一起装；前缀 1794096150 比服务器上已应用的探针迁移小，已演练证明照常执行。
- 手动备份不带 `@auto_pb_backup_` 前缀，不会被保留数清理，演练产生的手动备份要手动删（13-13）。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/pb_migrations/1794096200_server_settings.js、deploy/pb_migrations/1794096150_retire_probe.js、deploy/pb_hooks/backup-watch.pb.js、deploy/server-config-check.mjs、tools/pb/lib/instance.mjs
- FOUND: commits d0c2d12、f034a1b、5c6ac1e（都在 HEAD 的祖先里）；`git rev-list --count` 实测 3
- 三个任务的验收命令全部通过；`--local` 全部场景 `SERVER-CONFIG OK (24 checks)`；`ISOLATION OK 48/48`；`pb/` 与 HEAD 相同；隐私检查通过
