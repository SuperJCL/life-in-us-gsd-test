---
phase: 13-deploy-hardening-acceptance
verified: 2026-11-17T21:00:00Z
status: human_needed
score: 9/9 must-haves verified
covered_files:
  - .planning/phases/13-deploy-hardening-acceptance/13-01-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-01-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-02-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-02-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-03-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-03-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-04-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-04-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-05-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-05-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-06-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-06-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-07-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-07-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-08-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-08-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-09-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-09-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-10-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-10-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-11-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-11-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-12-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-12-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-13-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-13-SUMMARY.md
  - .planning/phases/13-deploy-hardening-acceptance/13-14-PLAN.md
  - .planning/phases/13-deploy-hardening-acceptance/13-14-SUMMARY.md
  - deploy/README.md
  - deploy/build-site.mjs
  - deploy/pb_hooks/backup-watch.pb.js
  - deploy/pb_migrations/1794096200_server_settings.js
  - deploy/server-check.mjs
  - deploy/server-config-check.mjs
  - deploy/server/03-configure-pocketbase.sh
  - deploy/server/04-start-pocketbase.sh
  - deploy/server/05-nginx-app.sh
  - deploy/server/06-install-site.sh
  - deploy/server/pocketbase.service
  - deploy/server/restore-drill.sh
  - deploy/site/manifest.webmanifest
  - deploy/site/sw.js
  - deploy/verify-site.mjs
  - us-journey-tracker.html
covered_digest: "v4:sha256:f98d8cf99547a68fe73c38593aa3523b96f91c8bb1e2fb85ca73faa9351f7fa3"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "升级步骤在真实服务器上演练过一次（13-14 计划假设 3 个路径的无害升级）"
    reason: "Phase 14、15 在 13-09 之后改了应用，所有者选择「部署现在的新版本」，升级实际换了 5 个路径（BUILD_VERSION、usj-csp.conf、index.html、manifest、sw.js）而不是 3 个；比较规则、上传集合和 06 的期望输出（CSP_CONF=installed）已随之修订并记在 13-14-SUMMARY.md"
    accepted_by: "所有者（13-14-SUMMARY.md 记录原话：「部署现在的新版本」）"
    accepted_at: "2026-11-17"
human_verification:
  - test: "设备甲（升级前已打开过应用）回到应用，看更新提示，再点「点此更新」（13-ACCEPTANCE E-1 至 E-3）"
    expected: "出现「有新版本」和「点此更新」，点之前页面不自己刷新；有草稿时先弹确认框；确认后刷新一次，记录都在，缓存换成新版本 0ba1339903f1"
    why_human: "更新提示和缓存换新在本机用静态服务器模拟的版本切换下已有测试覆盖（sw-update 三条用例通过），但线上这一次真实升级后真实设备上的表现只能真机看。13-14 部署后设备甲的横幅按所有者的要求保留到验收时才点"
  - test: "手机冷启动离线：打开过一次后开飞行模式，关掉所有标签页或从主屏幕重新进入，再记一笔，然后恢复联网（C-1 至 C-4）"
    expected: "能进入应用，状态行显示本机待上传的数量；联网后自动上传，另一台设备几秒内看到"
    why_human: "Service Worker 在真实手机浏览器（iOS Safari、Android Chrome）下的行为和 Playwright 里的不完全相同；该项属于 OPS-04 的真机部分，已随总体验收移到 Phase 16"
  - test: "把应用添加到主屏幕（D-1 Android、D-2 iPhone）"
    expected: "名称「计划手记」，深色底白色「记」字图标，从主屏幕打开是独立窗口；iPhone 的 7 天清理提醒读得明白"
    why_human: "清单和 4 个图标线上返回 200 且类型正确（verify-site F-05、F-06），但「添加到主屏幕」本身是操作系统界面，只能真机验证；已移到 Phase 16"
  - test: "R2 次日回看和演练残留（I-4、K-2）"
    expected: "R2 里持续出现新的 @auto_pb_backup_ 文件，邮箱没有备份失败或「计划手记：备份异常」的信；R2 里没有 drill_ 开头的演练备份"
    why_human: "13-13 证明了到 2026-11-17 为止每天一份（共 5 份）和 DRILL_R2_DELETE=ok，但「30 份之后会清理」和「没有残留」要在控制台上看；已安排在 Phase 16"
  - test: "后台超级用户口令强度、退出后再登录（I-1，可选 I-2）"
    expected: "走完「口令、邮件码」两步；故意错几次很快被限流"
    why_human: "两步验证开关（DB_SU_OTP=on、DB_SU_MFA=on）和限流（verify-site F-16）有机器证据，但「口令是强口令」是所有者在自己的网页终端里设的，没有任何脚本也不应该有脚本能核对"
  - test: "接近上限的合成大文件在真实线路上保存一次（F-4，RESEARCH A11）"
    expected: "保存成功，另一台设备能看到；出现容量提醒属正常"
    why_human: "nginx 请求体上限 5m、应用文档上限 4 MiB 在本机有检查，真实线路下的一次存储只能线上做；属 Phase 16"
deferred:
  - truth: "两台真实设备（中国大陆、美国）总体验收、旧数据迁移、npm test / test:cloud 全量收尾（原 13-15）"
    addressed_in: "Phase 16"
    evidence: "ROADMAP Phase 13 备注：原第 5 条已移到 Phase 16 的成功标准 2、4、5；所有者 2026-11-12 的决定；13-ACCEPTANCE.md 仍在 Phase 13 目录作为 Phase 16 的起点"
  - truth: "OPS-04 的真机部分（断网冷启动、添加到主屏幕在真实手机上）"
    addressed_in: "Phase 16"
    evidence: "REQUIREMENTS.md 追踪表 OPS-04 对应 Phase 16；ROADMAP Phase 16 成功标准 2"
---

# Phase 13: 部署与加固 验证报告

**阶段目标：** 应用正式部署到所有者的服务器：重启后自动恢复，每天自动备份并复制到异地，网站和后台入口都已加固。页面打开过一次后断网也能打开（包括断网时刷新页面，承接 Phase 10 的 D-08），也能添加到手机主屏幕。升级步骤在真实服务器上演练过一次。两台真实设备的总体验收和旧数据迁移改到 Phase 16。
**验证时间：** 2026-11-17
**状态：** human_needed（没有失败的真值，没有阻塞项；剩下的全是需要真机或所有者本人的、已经推迟到 Phase 16 总体验收的项目）
**重新验证：** 否，首次验证

## 方法与证据范围

- 本次只读：读代码、读文档、读 git；没有运行 Playwright/npm，没有 ssh，没有读 `private/`。
- **线上服务器的结果**（部署、真重启、恢复演练、升级演练）只能以 SUMMARY 里引用的、经 redact 的服务器输出和所有者的即时确认原话为证据。逐字原始输出文件（`test-results/13-1x-*.txt`）已不在本机（被后来的回归运行覆盖），所以这些证据无法由我独立重放。这是证据的上限，不是缺陷：编排器已说明不得也不必重跑服务器。
- **本机可核对的证据**：模板和脚本的源码、迁移、钩子、Service Worker、清单、应用里的注册和更新代码、测试，以及本次会话的回归报告（HEAD 57718a1，应用 sha256 前缀 `cc2b07d6`）：`test:cloud` 3 个分片共 286 条预期通过、0 失败、0 flaky；默认套件 2 个分片共 238 条、0 失败、0 flaky。和阶段 13 相关的 13 条用例（OPS-03、OPS-04、SEC-02）在报告里逐条为 ok。
- 应用文件自最后一次应用提交 427395e 以来未变（sha256 前缀 `cc2b07d6` 一致），线上版本 `0ba1339903f1` 部署的就是这个字节。

## 目标达成情况

### 可观察的真值

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 部署和升级按写好的步骤和 `deploy/` 模板完成；PocketBase 固定 0.41.1、安装前核对校验和；每个脚本执行前经所有者批准；真重启后 PocketBase 和 HTTPS 自动恢复（SC1） | ✓ VERIFIED | 模板齐全（`deploy/server/00` 至 `07`、`pb-admin.sh`、`pocketbase.service`、nginx 与 logrotate 片段，均在 git 中）。`02-install-pocketbase.sh` 默认 `PB_VERSION=0.41.1` 并钉死 zip 的 sha256，其他版本一律拒绝。`pocketbase.service` 有 `Restart=always`，04 负责 enable。13-10、13-11 的 SUMMARY 记录每批命令文件和 SHA256SUMS 的 sha256、所有者即时确认原话（「确认执行第一批」「完成，钥匙已存好；确认执行第二批」）。13-10 的 `PB_ZIP_SHA256_MATCH=yes`、`PB_BINARY_MATCHES_ZIP=yes`、`PB_BINARY_VERSION=0.41.1`。13-12：重启命令只发了一次，重启后 `UPTIME_S=84`（小于重启前 514689），`PB_SERVICE_ACTIVE`/`ENABLED`、`NGINX_ACTIVE`/`ENABLED`、`CERTBOT_TIMER`、`SWAPFILE_ACTIVE` 都回来，`DB_USERS_COUNT=1`、`DB_DOCS_COUNT=2` 数据没丢，重启后 `verify-site --stage full` 为 `VERIFY OK (19 checks)`，没有任何手动修复。 |
| 2 | 服务器每天自动备份并复制一份到 Cloudflare R2；做过恢复演练：用异地备份恢复出新实例，合成账号数据完整（SC2） | ✓ VERIFIED | `deploy/pb_migrations/1794096200_server_settings.js` 设 `backups.cron="0 19 * * *"`、`cronMaxKeep=30`；R2 凭据由所有者在后台填（`S3 connected successfully`）。13-13 的所有者截图显示 2026-11-13 到 11-16 每天 19:00 UTC 一份，演练时 `DRILL_AUTO_BACKUPS=5`（含当天一份）。演练输出 `DRILL_R2_WRITE=ok`、`DRILL_R2_DELETE=ok`、`DRILL_RESTORE=ok`、`DRILL_INTEGRITY=ok`、`DRILL_RESTORED_TEST_ONLY=yes`、`DRILL_USERS_MATCH=yes`、`DRILL_DOCS_COMPARED=2`、`DRILL_DOCS_MISMATCH=0`、`DRILL_USERS_WITH_BOTH_DOCS=1`、`DRILL_CLEANUP=done`、`DRILL_RESULT=PASS`；演练后线上服务全程 active（`UPTIME_S=416779`，没有重启）。**不是空转通过**：WR-07 担心的两个缺口（备份过旧、逐份比对为 0）在这次运行里都不成立（`DRILL_NEWEST_AGE_H=0`，`DRILL_DOCS_COMPARED=2`）。守卫（只有测试账号才跑）在演练前通过。 |
| 3a | 网站响应带 CSP 和安全响应头；CSP 下四个视图（现为五个）、登录和编辑计划都正常（SC3 前半） | ✓ VERIFIED | `deploy/build-site.mjs` 生成哈希放行的 CSP（`style-src-attr 'none'`、`frame-ancestors 'none'`、无 `unsafe-*`）；线上 `verify-site` F-01（头齐全）、F-02（CSP 哈希与线上页面内联块一一对应）、F-03（含 `style-src-attr 'none'`、无 `unsafe-`）在 13-11、13-12、13-14 三次运行都 PASS，最后一次是升级后的新版本。行为证据：`tests/cloud/csp.spec.ts` 两条用例（在构建出的页面和它的 CSP 下走完登录、五个视图及图表、计划编辑，零违规；故意删掉一个哈希则被拦下并上报，所以零违规检查不是空转），回归报告中均为 ok。 |
| 3b | 后台超级用户使用强密码和两步验证，登录有限流，代理 IP 头配置正确（SC3 后半） | ✓ VERIFIED（强口令见人工项） | 两步验证：13-12 重启后状态 `DB_SU_OTP=on`、`DB_SU_MFA=on`，13-13 演练后状态仍为 on。限流：迁移写入 `_superusers:auth` 每 IP 60 秒 5 次，线上 F-16 连发 6 次第 6 次 429（三次线上全量检查都 PASS）。代理 IP 头：迁移 `trustedProxy.headers=["X-Real-IP"]`，`usj-app.conf` 三处反代位置都用 `proxy_set_header X-Real-IP $remote_addr` 覆盖客户端同名头，8090 只绑回环（`PB_LISTEN_LOOPBACK_ONLY=yes`、B-03 外部连不上）。「按真实 IP 计数」在本机一次性实例上实测过（13-05 的 S-07、日志 IP 一致性检查）；线上 F-16 本身分不出「按真实 IP」和「按 127.0.0.1」，这一点靠配置和本机实测，不是线上独立证据。强口令是所有者自己设的，没有机器证据，列入人工项。 |
| 3c | 用与线上相同的版本和迁移，在一次性实例上重跑隔离脚本（只用合成账号），全部通过（SC3 末句） | ✓ VERIFIED | 13-05：`npm run pb:isolation` 最后一行 `ISOLATION OK 48/48`（同一个钉死的 0.41.1、同一组应用迁移）。自 13-05 提交 5c6ac1e 之后 `pb/pb_migrations/`、`pb/rules.expected.json` 在 git 里再没有改动，所以结论对线上（`PB_MIGRATIONS_APP=4`，BD-03 证明包内迁移与仓库逐字节相同）仍然有效。 |
| 4a | 页面打开过一次后断网也能进入并记录（冷启动离线）；断网刷新也能打开，待上传的修改和数量还在（SC4 前半，承接 10-CONTEXT D-08） | ✓ VERIFIED（真机见人工项） | `deploy/site/sw.js` 只缓存同源外壳 7 个路径，导航只在路径是 `/` 时回缓存，`/api/`、`/_/`、`/sw.js` 不 `respondWith`。`us-journey-tracker.html` 里有注册和更新代码（`serviceWorker`、`swOffer`、`swUnsaved`、`SKIP_WAITING`）。行为测试（回归报告 ok）：`sw-offline.spec.ts` 第一条在断网状态下 `page.reload()`，断言页面标题、状态行 `statusOffline(1)`、localStorage 里的待上传记录和 `dirty=true`，联网后自动上传；第二条关掉原页面，在断网下开新标签冷启动，记一笔，联网后上传；第三条断言缓存里只有外壳、没有任何 `/api/` 条目，且 `/api/health` 不被 worker 代答。线上 F-04 确认 `/sw.js` 带版本号、`no-cache`。这是行为型真值，有单条可点名的通过用例，所以不是「只有符号存在」。 |
| 4b | 手机上可以添加到主屏幕（SC4 中段） | ✓ VERIFIED（真机见人工项） | `manifest.webmanifest`：名称「计划手记」、`display: standalone`、192、512 和 maskable 图标，4 个 PNG 在 `deploy/site/icons/`；页面 `<head>` 有 manifest、apple-touch-icon、noindex 链接。`site-assets.spec.ts` 两条用例通过；线上 F-05（类型 `application/manifest+json`、name 正确）、F-06（4 个图标 200 且 `image/png`）PASS。真正「添加」的操作在手机系统里，属 Phase 16 的 D 项。 |
| 4c | 应用更新后，缓存会换成新版本（SC4 末句） | ✓ VERIFIED（真机见人工项） | sw.js 缓存名 `usj-shell-<构建版本>`，activate 时删旧缓存，只在页面发来 `SKIP_WAITING` 时才 `skipWaiting`。`sw-update.spec.ts` 四条用例通过：出现横幅并换到新缓存后刷新进入新版本；有草稿或未保存计划修改时先确认、取消后保留；两个标签页互不干扰；连点两次只刷新一次。线上：13-14 升级后 F-04 确认线上 sw.js 的 12 位版本等于新构建 `0ba1339903f1`，F-02 确认页面与 CSP 一起换。 |
| 5 | 升级步骤在真实服务器上演练过一次（阶段目标） | ✓ VERIFIED（PASSED（override）：范围偏离，所有者已批准） | 13-14：上传 13 个批准文件，`UPLOAD_CHECK=ok FILES=13`，06 输出 `SITE_VERSION=0ba1339903f1`、`SITE_FILES=9`、`SITE_SWAP=done`、`CSP_CONF=installed`、`NGINX_RELOAD=done`，上传目录已删（`UPLOAD_DIRS=0`），线上 `VERIFY OK (19 checks)`，`DB_USERS_NONTEST=0`、`DB_DOCS_NONTEST=0`。偏离：计划假设 3 个路径的无害升级，因为 Phase 14、15 改了应用，所有者选择「部署现在的新版本」，实际换了 5 个路径，且其余 27 行与 13-09 批准清单逐字节相同（SUMMARY 记录了比较）。这是已批准的偏离，不是缺口，记在 frontmatter overrides。回滚只有文档（README 第 9 节）没有实际演练，但阶段目标和 SC1 只要求「升级演练过一次」。 |

**得分：** 9/9 真值通过（0 个仅「在场但行为未验证」）

### 延后项（不是缺口）

| # | 项目 | 去向 | 依据 |
|---|------|------|------|
| 1 | 两台真实设备验收、旧数据迁移、全量 `npm test`/`test:cloud` 收尾（原 13-15） | Phase 16 | ROADMAP 备注和所有者 2026-11-12 的决定 |
| 2 | OPS-04 的真机部分 | Phase 16 | REQUIREMENTS 追踪表 OPS-04 对应 Phase 16 |

### 必需的产物

| 产物 | 期望 | 状态 | 详情 |
|------|------|------|------|
| `deploy/site/sw.js` | 外壳 Service Worker | ✓ VERIFIED | 37 行，真实实现，被构建脚本换入版本号；测试 3+4 条覆盖 |
| `deploy/site/manifest.webmanifest`、`deploy/site/icons/*.png` | 添加到主屏幕 | ✓ VERIFIED | 内容完整，4 个图标在 git 中；线上 200 |
| `deploy/build-site.mjs` | 生成页面、CSP 头、带版本号的 sw.js 和上传包 | ✓ VERIFIED | 自测、`--check-bundle` 在 `deploy-tools.spec.ts` 中通过；线上页面与 CSP 一致 |
| `deploy/server/00`–`07`、`pb-admin.sh`、`pocketbase.service`、nginx、logrotate | 服务器模板 | ✓ VERIFIED | 都在 git 中，在真实服务器上执行成功（输出见 13-10 至 13-14） |
| `deploy/pb_migrations/1794096150_retire_probe.js`、`1794096200_server_settings.js` | 探针清理、日志、限流、代理 IP、备份计划 | ✓ VERIFIED | 内容与声称一致；线上 `DB_COLLECTIONS_PROBE=no`、`DB_SETTINGS_ENCRYPTED=yes`、`PB_MIGRATIONS_APP=4` |
| `deploy/pb_hooks/backup-watch.pb.js` | 备份看门狗 | ✓ VERIFIED | 线上 `PB_HOOKS=1`；邮件发送在本机 W-02、W-05 测过 |
| `deploy/server/restore-drill.sh` | 带「只有测试账号」守卫的恢复演练 | ✓ VERIFIED | 线上运行 `DRILL_RESULT=PASS`；缺口见 WR-07（后续） |
| `deploy/verify-site.mjs`、`server-check.mjs`、`server-config-check.mjs` | 线上和本机检查 | ✓ VERIFIED | 自测在 `deploy-tools.spec.ts` 通过；线上三次 19 项全过 |
| `deploy/README.md`、`13-ACCEPTANCE.md` | 运行手册和总体验收清单 | ✓ VERIFIED（含已知的文档缺陷） | 见 WR-05、WR-06、IN-11 |

### 关键连接

| 从 | 到 | 方式 | 状态 | 详情 |
|----|----|------|------|------|
| `us-journey-tracker.html` | `/sw.js` | `navigator.serviceWorker.register` | WIRED | 注册、`swOffer` 横幅、`swUnsaved` 确认、`SKIP_WAITING` 消息都在；`sw-update` 用例覆盖 |
| 页面 `<head>` | manifest 与图标 | `rel="manifest"`、`apple-touch-icon` | WIRED | `site-assets.spec.ts` 断言 |
| `build-site.mjs` | 页面内联块与 `usj-csp.conf` | 哈希 | WIRED | 线上 F-02 逐个比对 |
| nginx `usj-app.conf` | PocketBase 的 `trustedProxy` | `X-Real-IP $remote_addr` | WIRED | 三处反代位置；迁移里头名一致 |
| 迁移 `server_settings` | R2 备份 | `backups.cron` 加所有者填的 S3 设置 | WIRED | 每天一份，R2 里有 5 份 |
| `restore-drill.sh` | R2 与线上库 | 只读副本加最新自动备份 | WIRED | 线上运行 PASS |
| `06-install-site.sh` | 站点和 CSP 一起换 | 符号链接加 reload | WIRED | 13-11、13-14 两次实测；窗口风险见 WR-01 |

### 数据流追踪（第 4 层）

本阶段是部署和外壳，不新增渲染动态数据的组件；离线路径的数据来自 Phase 10 的本机缓存（`usj:v2:<id>:state`），`sw-offline` 用例直接读取它并断言待上传记录与 `dirty=true`，状态为 FLOWING。

### 行为抽查

| 行为 | 依据 | 结果 | 状态 |
|------|------|------|------|
| 断网刷新与冷启动离线 | 回归报告 `sw-offline` 三条 | ok | ✓ PASS |
| 更新横幅和换缓存 | 回归报告 `sw-update` 四条 | ok | ✓ PASS |
| CSP 下零违规加反向对照 | 回归报告 `csp.spec.ts` 两条 | ok | ✓ PASS |
| 清单与图标、外壳预缓存集合 | 回归报告 `site-assets` 两条 | ok | ✓ PASS |
| 上传包完整性与自测 | 回归报告 `deploy-tools` 两条 | ok | ✓ PASS |

没有重跑任何测试，只读取了本次会话保存的回归报告。

### 探针执行

本阶段没有声明 `probe-*.sh`；Phase 6 的探针已在 13-10 退役（`PROBE_RETIRE=done`）。步骤跳过。

### 需求覆盖

交叉核对 PLAN 前言里的 `requirements` 与 REQUIREMENTS.md：14 份计划涉及 OPS-01、OPS-02、OPS-03、OPS-04、SEC-02，没有计划之外的孤立需求映射到 Phase 13（REQUIREMENTS 追踪表里 Phase 13 只有 SEC-02、OPS-01、OPS-02、OPS-03；OPS-04 映射到 Phase 16）。

| 需求 | 来源计划 | 描述 | 状态 | 是否建议标记完成 |
|------|----------|------|------|------------------|
| OPS-01 | 13-05、07、08、12、13 | 每天自动备份并复制到 R2；做过一次恢复演练 | ✓ SATISFIED | **建议标记完成**。备份每天一份且在 R2（5 份）、恢复演练 `DRILL_RESULT=PASS` 且不是空转。「次日回看」的 I-4、K-2 属 Phase 16 复核，不影响这条需求的字面要求。 |
| OPS-02 | 13-06、10、11、12 | 重启后 PocketBase 和 HTTPS 自动恢复 | ✓ SATISFIED | **建议标记完成**。真重启一次（uptime 84 秒），所有服务和定时器自己回来，`verify-site` 19 项全过，无手动修复。 |
| OPS-03 | 13-06、07、08、09、10、11、14 | 部署和升级有写好的步骤和脚本；PocketBase 固定版本，安装前核对校验和 | ✓ SATISFIED（有一条文档缺口） | **建议标记完成，并带一条后续**：部署、站点升级、回滚都有脚本或步骤，站点升级在真服务器上走通，PocketBase 固定 0.41.1 且核对 sha256。缺口：README 第 8 节写的「PocketBase 版本升级」办法被 02 自己拒绝（WR-05），也就是说**升级 PocketBase 二进制**目前没有一条能执行的路径；站点升级、回滚站点没有这个问题。这不影响阶段目标和 SC1，但应当在下一次需要升级 PocketBase 之前补上。 |
| SEC-02 | 13-04、05、07、08、11、12 | 网站发出 CSP 和安全响应头；后台强密码、两步验证、登录限流 | ✓ SATISFIED（强口令为所有者自述） | **建议标记完成**。CSP 和安全响应头线上逐项验证；两步验证状态为 on；限流线上 429；隔离 48/48。强口令不可机器核对，所有者已在 13-ACCEPTANCE I-1 之外自己设定，列入人工项供总体验收时顺带确认，不阻塞。 |
| OPS-04（本机部分） | 13-01、02、03、04、08、14 | 打开过一次后断网也能打开；可添加到手机主屏幕 | 本机部分 ✓ SATISFIED，真机部分未验 | **不建议在 Phase 13 标记完成**。REQUIREMENTS 追踪表已把 OPS-04 对应到 Phase 16；本阶段只完成了服务端和 Playwright 层面（Service Worker、清单、图标、更新提示、线上头和清单检查），断网冷启动和添加到主屏幕必须在真实手机上看，所以保持 Pending 并留给 Phase 16，与 ROADMAP 的安排一致。 |

### 反模式扫描

在本阶段改动的文件里（`sw.js`、清单、`build-site.mjs`、`verify-site.mjs`、两个 check 脚本、`deploy/server/*.sh`、钩子、迁移、README、`us-journey-tracker.html`、sw 和 csp 用例）没有 `TBD`、`FIXME`、`XXX` 标记。没有空实现、占位返回或只打印日志的处理函数。

### 代码评审（13-REVIEW.md，仅作参考）的影响判断

0 个 BLOCKER、8 个 WARNING、11 个 INFO，在 `13-REVIEW-DISPOSITION.md` 里全部为 `open`。逐条判断它们是否使某条成功标准**今天**不成立：

| 发现 | 对本阶段成功标准的影响 | 归类 |
|------|------------------------|------|
| WR-01 06 先换页面再 reload nginx，窗口内的 SW 预缓存可能存下「新页面加旧 CSP」 | 不推翻 SC4：窗口只有几十毫秒到一两秒，13-11 和 13-14 两次切换后 `verify-site` F-02 都过。但它是一个已知的、会在 Phase 16 的设备甲上最先暴露的风险：设备甲在升级窗口附近取过 sw.js 才可能中招。 | 后续；列入人工项 E，真机更新后看一次页面是否白屏 |
| WR-02 外壳版本号不含 CSP 头 | 未来只改 CSP 的发布到不了老用户。当前版本 CSP 与页面一起变，没有影响。 | 后续 |
| WR-03 03 在工具文件变化时要求停 PocketBase | 只影响以后换演练脚本的操作方式 | 后续 |
| WR-04 迁移清单在 6 处硬编码 | 现在两个目录与清单恰好一致，没有错；Phase 16 之前若新增迁移会被静默漏装 | 后续，**进 Phase 16 前先决定** |
| WR-05 README 的 PocketBase 升级办法被 02 拒绝 | 见上，OPS-03 的后续项 | 后续 |
| WR-06 提高 HSTS 会让 verify-site 和 server-check 变红 | Phase 16 验收后要提高 HSTS 时才触发 | 后续 |
| WR-07 恢复演练可以空转通过 | 对**这一次**演练不成立：`DRILL_NEWEST_AGE_H=0`、`DRILL_DOCS_COMPARED=2`、`DRILL_DOCS_MISMATCH=0`，所以 SC2 的证据是真的。该缺陷只影响以后的演练。 | 后续，但建议在下一次演练之前修 |
| WR-08 04 覆盖旧 unit 时不留备份 | 只影响以后改 unit 时的回滚 | 后续 |
| IN-01 导入真实数据后恢复演练被守卫永久挡住 | 所有者 2026-11-12 的决定，不是缺陷；真实数据导入之后再没有「备份能恢复」的证明。建议 Phase 16 在导入前把「最后一次演练日期（2026-11-17）」记入验收记录，或另做只读校验 | 后续（Phase 16 相关） |
| IN-02 `SKIP_WAITING` 不引发 `controllerchange` 时横幅卡在「正在更新…」 | 低概率，不影响 SC4 | 后续 |
| IN-03 备份看门狗在没配好 SMTP 时静默 | 现有的人工兜底（次日看 R2）已写进验收清单 I-4 | 后续 |
| IN-04 至 IN-11 | 文字、常量、占位、防护强化；IN-08（manifest 的 `description` 与 `name` 相同，是升级演练留下的占位）会在下一次发布时换版本号 | 后续 |

结论：没有一条评审发现使 SC1 至 SC4 或阶段目标今天不成立。8 个 WARNING 都是「下一次升级」或「Phase 16 之后」的风险。

### 人工验证项

见 frontmatter `human_verification`（6 项）。全部属于所有者 2026-11-12 的决定：「我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收」，对应 `13-ACCEPTANCE.md` 的 C、D、E、I、K、F-4 和 Phase 16 的成功标准 2、4、5。它们不是缺口，也不阻止进入 Phase 14、15、16 之后的流程。

### 缺口总结

没有缺口。9 条真值全部有证据：线上服务器结果有 SUMMARY 引用的过滤输出和所有者原话，本机行为有通过的回归用例，源码已读过确认与声称一致。证据的最大限制是：服务器侧输出无法由本次验证独立重放（原始文件不在本机），所以它们的可信度等于 SUMMARY 里逐字引用的程度；三次独立的 `VERIFY OK (19 checks)` 在三个不同时间点（部署后、重启后、升级后）互相印证，降低了这个风险。

后续跟进（不属于本阶段缺口，供编排器记录）：
1. 进入 Phase 16 之前处理或明确接受：WR-04（新增迁移会被漏装）、IN-01（导入后无法再演练，建议把 2026-11-17 记为最后一次演练）。
2. 下一次升级之前处理：WR-01、WR-02、WR-05、WR-06、WR-07、WR-08。
3. 对所有 19 条评审发现，所有者仍需在 `13-REVIEW-DISPOSITION.md` 里做处置决定（现在全是 `open`）。

---

_验证时间：2026-11-17_
_验证者：Claude（gsd-verifier）_
