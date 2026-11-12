---
phase: 13-deploy-hardening-acceptance
plan: 09
subsystem: deploy-approval
tags: [pre-deploy-gate, upload-bundle, sha256-manifest, owner-approval, probe-retire, read-only-status, ops-03]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-08 的完整上传包构建、verify-site（--check-bundle、--stage baseline）、运行手册和验收清单
  - phase: 6-procurement-reachability-probe
    provides: 服务器上的 PocketBase 0.41.1、swap、nginx 探针位置块、探针数据库和 Phase 6 的超级用户
provides:
  - 部署前本机全量验证的结果（两个完整套件和三个部署检查）
  - 经所有者批准的上传包清单（SHA256SUMS 原文加它自己的 sha256、BUILD_VERSION），13-10、13-11 只按它执行
  - 服务器现状的只读快照（已脱敏）和 HTTPS 基线
  - 所有者对探针数据库的决定（A12：保留）和对整批部署的批准（全部批准）
affects: [13-10, 13-11, 13-12, 13-13, 13-14, 13-15]

actuals:
  tokens: 3000
  tasks: 3
  commits: 0
plan_head_before: cdb239cd4ee7ca6dda384109e28007c566622c40
plan_head_after: cdb239cd4ee7ca6dda384109e28007c566622c40

tech-stack:
  added: []
  patterns:
    - "批准清单就是上传包的 SHA256SUMS 原文加它自己的 sha256；批准之后任何字节变化都要重新请批准"
    - "本计划只读：不上传、不改服务器、不改被跟踪的仓库文件；上传包只在本机 private/deploy-out/"

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-09-SUMMARY.md
  modified: []

key-decisions:
  - "A12 保留（keep）：保留探针时期的数据库和 Phase 6 的超级用户，探针集合和探针账号由清理迁移在第一次启动时删除（所有者原话：“保留”）"
  - "整批部署全部批准（approve-all）：上传、01、02、07 --keep、03、04、06、05、删上传目录、线上全量检查、一次真重启、一次恢复演练（所有者原话：“全部批准”）；之后每个改动服务器的步骤仍要在执行前由所有者即时确认"

requirements-completed: [OPS-03]

coverage:
  - id: D1
    description: "部署前本机全量验证：完整 cloud 套件、完整默认套件、server-check、server-config-check、pb:isolation"
    requirement: OPS-03
    verification:
      - kind: e2e
        ref: "npm run test:cloud（check-report --min-expected 248）：REPORT OK 248；npm test（--min-expected 197）：REPORT OK 197"
        status: pass
      - kind: other
        ref: "node deploy/server-check.mjs（SERVER-CHECK OK (22 checks)）；node deploy/server-config-check.mjs --local（SERVER-CONFIG OK (24 checks)）；npm run pb:isolation（ISOLATION OK 48/48）"
        status: pass
    human_judgment: false
  - id: D2
    description: "上传包构建并离线核对：BUILD OK a1159ad93165（33 个文件），BUNDLE OK (9 checks)，sha256sum -c --strict 通过"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "node deploy/build-site.mjs；node deploy/verify-site.mjs --check-bundle private/deploy-out；(cd private/deploy-out && sha256sum -c --strict SHA256SUMS)"
        status: pass
    human_judgment: false
  - id: D3
    description: "服务器现状只读确认（00-status.sh 经标准输入，输出脱敏）和 HTTPS 基线 VERIFY OK (3 checks)"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "ssh -o BatchMode=yes usj 'bash -s' < deploy/server/00-status.sh | node tools/privacy/redact.mjs（STATUS_DONE=1）；node deploy/verify-site.mjs --stage baseline"
        status: pass
    human_judgment: false
  - id: D4
    description: "所有者的两个决定：A12 保留；整批部署全部批准（批准清单见 ## 部署批准清单）"
    requirement: OPS-03
    verification: []
    human_judgment: true
    rationale: "批准和选择只能由所有者本人给出，原话已逐字记录；每个改动服务器的后续步骤仍要再即时确认"

duration: 28min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 09: 部署前的最后一道关 Summary

**本机全部检查通过，上传包（BUILD_VERSION a1159ad93165，32 个文件加 SHA256SUMS）已构建并离线核对，服务器现状只读确认为干净的 Phase 6 探针状态；所有者选了保留探针数据库（A12：keep），并整批批准部署（approve-all），批准清单记在本文件，13-10 起只按它执行。全程没有改动服务器。**

## Performance

- **Duration:** 约 28 分钟（Task 1 从 20:58 UTC 开始，含等待所有者回答的时间）
- **Tasks:** 3（1 个 tracer，2 个所有者决定）
- **Files:** 0 个被跟踪的源文件改动（上传包只在本机 `private/deploy-out/`，不进仓库）
- **Task commits:** 0（本计划按设计不改仓库文件；`commits: 0` 由计划起点 `cdb239c` 到提交 SUMMARY 之前的 `HEAD` 实测，两者相同）

## Accomplishments

### Task 1（tracer）：本机全量验证、上传包、只读状态、HTTPS 基线

| 检查 | 结果 |
|------|------|
| 完整 `npm run test:cloud`（低优先级、1 个 worker） | REPORT OK，248 条；SEC-02 的 CSP 用例、OPS-04 的离线用例和更新横幅用例都在通过之列 |
| 完整默认 `npm test`（低优先级、1 个 worker） | REPORT OK，197 条；含 SAFE-02 的基线哈希用例和 OPS-03 的上传包用例 |
| `node deploy/server-check.mjs` | SERVER-CHECK OK (22 checks) |
| `node deploy/server-config-check.mjs --local` | SERVER-CONFIG OK (24 checks) |
| `npm run pb:isolation` | ISOLATION OK 48/48 |
| `node deploy/build-site.mjs` | BUILD OK a1159ad93165 (33 files) |
| `node deploy/verify-site.mjs --check-bundle private/deploy-out` | BUNDLE OK (9 checks) |
| `sha256sum -c --strict SHA256SUMS` | 32 行全部通过；`SHA256SUMS` 自己的 sha256 为 `ac686d29b5f3b8c4a99f0fb4cc037d7e9132c73fd05f4acd7d9e0be9b56198b7` |
| `git status --porcelain -- private` | 无输出 |
| `verify-site --stage baseline`（只读请求，输出脱敏） | VERIFY OK (3 checks) |

### 服务器现状（只读，经标准输入运行 `00-status.sh`，输出经 `redact.mjs` 脱敏，没有敏感值）

```text
PB_BINARY_VERSION=0.41.1
SWAPFILE_ACTIVE=yes
NGINX_ANCHOR_COUNT=1
NGINX_CONFD_INCLUDED=yes
NGINX_TEST=ok
NGINX_PROBE_INCLUDE=present
NGINX_APP_INCLUDE=absent
PB_ENV_FILE=absent
PROBE_PAGE_DIR=present
UPLOAD_DIRS=0
NGINX_SERVER_ADD_HEADER=no
DB_SUPERUSERS_COUNT=1
DB_USERS_COUNT=1
DB_USERS_NONTEST=1
DB_DOCS_NONTEST=0
DB_SETTINGS_ENCRYPTED=no
DB_SU_OTP=off
DB_SU_MFA=off
STATUS_DONE=1
```

说明：`DB_USERS_NONTEST=1` 就是 Phase 6 的那个合成探针账号（库里只有合成数据，没有记录文档，`DB_DOCS_NONTEST=0`）；`NGINX_SERVER_ADD_HEADER=no`，所以证书块里没有会被位置块覆盖的 server 层响应头，不需要在批准文本里额外提醒；`NGINX_CONFD_INCLUDED=yes`，05 的前置条件满足；`DB_SETTINGS_ENCRYPTED=no` 对应下面“保留模式的两个风险”里的第一条。

### Task 2：所有者决定探针数据库怎么处理

所有者的原话：**“保留”**（2026-11-12，在对话里回答“服务器上第 6 阶段留下的探针数据库怎么处理？”）。

记录：`A12 选择：keep`。13-10 的 07 用 `--keep`：停 PocketBase、删两个探针迁移文件和 `/var/www/usj/probe/`，保留数据库和 Phase 6 的超级用户；探针集合和探针账号由清理迁移 `1794096150_retire_probe.js` 在第一次启动时删除。选了保留，所以 13-11 里所有者不用再建超级用户。建议所有者部署后在后台把 Phase 6 的后台口令改一次（那个口令曾在探针阶段对公网开放的后台上用过）。

### Task 3：所有者批准整批部署

所有者的原话：**“全部批准”**（2026-11-12，在对话里回答“是否批准整批部署？（上传包清单 sha256 ac686d29…98b7；每一步执行前还会把命令原文贴给你再确认）”）。

批准之前所有者看到的内容：`SHA256SUMS` 原文（32 行）和它自己的 sha256；与上传包里的服务器文件逐字节相同的 21 个仓库源文件的链接（BD-03 由上一段续跑重新核对，21 个全部 SAME），加上生成的一行 `usj-csp.conf`；页面里唯一的差别（插入一行 `window.USJ_CONFIG={backend:"pocketbase"};`）；保留模式的执行顺序；重启和演练的命令原文；后续每一步的即时确认；回滚；风险清单；部署后改一次 Phase 6 后台口令的建议。

### 保留模式的两个风险，已经关闭

**1. 保留数据库加新加密钥匙，而设置行目前是明文——已在本机演练通过（2026-11-12）。** 用一次性脚本（`test-results/keep-key-rehearsal/run.mjs`，已被 git 忽略，数据目录已删除）按服务器的真实顺序演练：一次性 0.41.1 实例带着探针时期的迁移、不带钥匙创建；创建超级用户、保存设置（确认 `_params` 行是明文）；然后删掉探针迁移文件，装入四个应用迁移和 `backup-watch` 钩子，用新的 32 位钥匙通过 `--encryptionEnv=PB_ENCRYPTION_KEY` 启动。结果全部通过：

- 健康检查 200，日志里没有错误
- 超级用户登录正常
- 之前保存的设置保留，`server_settings` 迁移的值也已生效：日志保留 30 天且带 IP、trustedProxy 为 `X-Real-IP`、限流已开启且 `_superusers:auth` 5 次每 60 秒排在最前、备份 cron `0 19 * * *` 保留 30 份；`appName` 设为 `usj`
- 探针集合和探针账号已删除
- `_params` 行现在是加密的
- 用同一把钥匙重启，结果相同
- 对照：不带钥匙启动会以退出码 1 失败，报错 `invalid settings db data or missing encryption key ""`

**2. 探针账号邮箱是否匹配清理迁移的正则 `^probe-[0-9a-f]{8}@example\.com$`——按构造关闭。** Phase 6 的 `tools/probe/server/03-configure-pocketbase.sh` 在服务器上用 `probe-$(openssl rand -hex 4)@example.com` 生成这个账号，并检查了 8 位长度，所以必然匹配。13-11 在第一次启动之后仍会只读确认 `DB_USERS_NONTEST=0`。

## 部署批准清单

下面的代码块是 `private/deploy-out/SHA256SUMS` 的原文（32 行，覆盖上传包里除它自己之外的全部文件）。13-10 上传前先核对 `SHA256SUMS` 自己的 sha256 等于下面记下的值；13-10、13-11 只按这一节执行。

```text
afb24694f1e7c42f4643a255c3fdcff645d9e0765fc3e41b0d756246e911f478  BUILD_VERSION
2cd8b049d0bfa6170d7e377fdfc573505427a2147585940e56b76f9e60645597  pb_hooks/backup-watch.pb.js
ff2557719b77e78494a3af336e145b0ed18d323f9b8b0c80d758a09bfdec8cb0  pb_migrations/1794096000_users_lockdown.js
ea29dc74b91fa87c3d1f9e238f097e23d89babe31bfb91669eb7ed09dec600c9  pb_migrations/1794096100_journey_docs.js
5d6c721ca38d70943aa6b06f19afdc10bc20d171364b1e1f7714b83bbcd9feaa  pb_migrations/1794096150_retire_probe.js
e0a058ab64cf7c1b87e41e37642f0cff287988deeea59039d4b47e7f39981cbc  pb_migrations/1794096200_server_settings.js
fb3fbbdfc9f09ed00be67c192410dd93c7f77bab9f36b17ac7ff2281df114b56  server/01-swap.sh
dfba645216c331f48ccb7447ab492d6d55005c73db889c0b389a628c96ce2743  server/02-install-pocketbase.sh
313b26a947f2563d44838a22ab68bcd30b967e309721c1315bf39453abf11b9a  server/03-configure-pocketbase.sh
d2f9fd625e436ae822ecac825d423fb03e5f9724b723c0604c66fc12231fc799  server/04-start-pocketbase.sh
4586cbe6540d1f5a7a00e18bd262dff658bc056696f10c4335f1b908a7c0d9e1  server/05-nginx-app.sh
bea80fb81885a18d8809f9923a56dd291872fc7efa9b27a7c5f955a53cae2fb1  server/06-install-site.sh
a9d35959f2dda9aa76d9757e9e4513f70226f708e3ad63ede71158a0c6dd9e27  server/07-retire-probe.sh
66e224ccfcaa8bfdc8e9e82bb915173b2a86117684edda91c05ad95e61e8586d  server/logrotate/usj-nginx
87d929b5a1adabe0dc10b7eb3fbd13feb085f83951a965156716946c7b9e8928  server/nginx/anchor-block.awk
b2519c90aeb06e2fc2fa8861b97961e9970f5dc33f9a27ec099ac74df3a9663b  server/nginx/usj-app.conf
e3ff830612ef1dd54e95fea191d55da2bd2179d86b1d459e0b163deaca448a3b  server/nginx/usj-csp.conf
c20175a745b50666475161569130916f800f28915c566f0524907291d0bd4347  server/nginx/usj-headers-common.conf
5542e2d3ba695ccc15d4066fc9902dfa72e21e1ae798b7077b1df53085fd02f9  server/nginx/usj-headers-proxy.conf
5e428b4926df9b0b126cc6658d640127e6deea95d03d86e89aa7180aa2619b3e  server/nginx/usj-log-format.conf
73d2028df59182ba9101b6b3adf3d1d2c3fccf9415ec05cdf675f31747b3cd11  server/pb-admin.sh
76e2b6573f5db6f5f7510a2bc463a543a9292298b958618dd48b017d7cfdbbef  server/pocketbase.service
57a24b237a46cbc2bb2a7dbe1f8d1f11c9d7e4f52649e3bd7ad033997e639513  server/restore-drill.sh
8f9cb81cceaa04c738186b0c72b954d3b88fe24ec54dd7d999ba053e8d0bc9ce  site/icons/apple-touch-icon-180.png
5e9f9659c244fe29e9d39b5abc26405e6fca17b90cef01694cb784b1b0e30adc  site/icons/icon-192.png
06b1d903c463d6904cbbc1c7938634494e430ef5ca6265ba32031c9869bf9c1a  site/icons/icon-512.png
a5898b8f7b920e14bc7c13d3d8ee6f1bd0e4433d7197c9f91d3e1470c811ac91  site/icons/icon-maskable-512.png
e02477ca2812d4d881e20d1ae3d15721cb808784289cc07a51d301736c465775  site/index.html
0eeaea7526bde4de2b19a105c89498731c271842fc6b7bd17f2b57c874e4c661  site/manifest.webmanifest
2d446342a7cb1a45f8ba5a10fdbd23aecb955dc38a145ce41f34359b9b9caf31  site/sw.js
b799f1c9c9fb20e77f9ffe693a05ed17cbf2123dc6315bdeb8f9106dc363311a  site/vendor/SHA256SUMS
94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f  site/vendor/pocketbase.iife.js
```

SHA256SUMS 自己的 sha256：ac686d29b5f3b8c4a99f0fb4cc037d7e9132c73fd05f4acd7d9e0be9b56198b7
BUILD_VERSION：a1159ad93165
批准选项：approve-all（所有者原话：“全部批准”，2026-11-12）
A12 选择：keep（所有者原话：“保留”，2026-11-12）

### 批准的执行顺序（保留模式）

1. 13-10：上传（服务器上 `mktemp -d /tmp/usj-deploy.XXXXXXXX` 建 0700 目录；本机上传前 `sha256sum -c --strict`；只打包清单里的 32 个文件加 SHA256SUMS；服务器上再 `sha256sum -c --strict`，确认文件数是 33）。
2. 01-swap → 02-install-pocketbase（已是 0.41.1，只核对钉死的 sha256）→ 07-retire-probe `--keep` → 03-configure-pocketbase（在服务器上生成加密钥匙，不打印）。
3. **所有者的操作：只有一件事——把 `PB_ENCRYPTION_KEY` 存进密码管理器。** 保留模式下不重建超级用户。
4. 13-11：04-start-pocketbase → 06-install-site → 05-nginx-app（站点会短暂 reload，不中断证书）→ 删上传目录 → `verify-site --stage full`（其中一项会故意错 6 次后台口令，所有者这边的 IP 之后 60 秒内登不了后台）。第一次启动后只读确认 `DB_USERS_NONTEST=0`。
5. 13-12：所有者配 SMTP、收到测试邮件后才开两步验证、开 R2、建按约定命名的测试账号；然后真重启一次，命令原文 `ssh -o BatchMode=yes usj 'sudo -n systemctl reboot'`，之后只读确认 PocketBase 和 HTTPS 自动恢复。
6. 13-13：恢复演练运行一次，命令原文 `sudo -n /usr/local/sbin/usj-restore-drill`，避开 18:40–19:20 UTC；演练在 R2 里写入并删掉一个 `drill_` 开头的演练备份；用线上库的只读副本起临时实例，复制之前先检查线上库只有测试账号（邮箱 `test-…@example.com`）和它们的文档，否则拒绝运行、什么都不复制（D-05 按所有者 2026-11-12 修订）。
7. 13-14：升级演练（只跑 06）；13-15：总体验收（先测试账号，后真实数据，再删测试账号）。

**每一步改动服务器的命令（13-10 的上传和 01、02、07、03；13-11 的 04、06、05、删上传目录、线上全量检查；13-12 的重启；13-13 的恢复演练；13-14 的 06）执行前，仍要由执行者把命令原文和对应清单行贴给所有者，所有者回复确认才执行；所有者说“停”，这一步就不执行。** 整批批准不等于每条命令都已经过目。

回滚：站点指回上一个版本；nginx 从 `/etc/nginx/usj-backup/` 恢复；PocketBase `disable --now`。保留模式下数据库没有被清空，所以没有不可回滚的步骤；保留数据库的代价是库里留着探针迁移的历史记录和两天的探针日志。

## Task Commits

本计划没有任务提交（Task 1 只在本机生成 `private/deploy-out/`，该目录被 git 忽略；Task 2、3 是所有者的决定）。本 SUMMARY 和 STATE.md、ROADMAP.md 的更新各自在计划元数据提交里。

## Deviations from Plan

None - plan executed exactly as written.

补充说明（不是偏差）：Task 1 里 `NGINX_SERVER_ADD_HEADER=no`，计划里“yes 时要在 Task 3 告诉所有者”的分支没有触发。Task 3 之前由上一段续跑重新核对 BD-03（21 个仓库源文件与包内逐字节相同，全部 SAME）；本段续跑在写本文件前重新核对 `SHA256SUMS` 的 sha256 仍等于批准时的值，且 `sha256sum -c --strict` 通过，上传包没有变化。

## Issues Encountered

无阻塞问题。两个保留模式的风险（明文设置行加新钥匙、探针账号邮箱匹配）都已关闭，见上。

## Known Stubs

None.

## Threat Flags

None. 本计划没有新增网络端点、认证路径或信任边界上的文件访问；T-13-27（批准文本与上传字节不一致）由批准清单加 13-10 的三次核对缓解，T-13-SC 不装新包。

## Next Phase Readiness

13-10 可以开始：先核对 `SHA256SUMS` 的 sha256 等于 `ac686d29…98b7`，再把上传命令原文贴给所有者即时确认。

## Self-Check: PASSED

- 上传包 `SHA256SUMS` 的 sha256 等于批准值，`sha256sum -c --strict` 通过
- 计划起点 `cdb239c` 之后没有 13-09 的任务提交（`commits: 0` 由 `git rev-list --count` 实测）
