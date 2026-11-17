---
phase: 13-deploy-hardening-acceptance
plan: 14
subsystem: deploy
tags: [upgrade-drill, site, csp, ops-03, ops-04]
status: in_progress
requirements: [OPS-03, OPS-04]
key-files:
  modified:
    - deploy/site/manifest.webmanifest
---

# Phase 13 Plan 14: 真实服务器升级演练 Summary（草稿，Task 1 完成，停在 Task 2）

**状态：进行中。** Task 1（tracer，本机加只读状态）已完成；Task 2（所有者批准）等待中；Task 3（上传、06、线上检查）尚未执行。本文件是草稿，Task 3 之后补全。

## 所有者的范围决定（已批准的偏离，2026-11-17）

计划写于 Phase 14、15 之前，假设线上站点等于仓库里的应用，因此给清单加一个 `description` 只会让 3 个文件变化（BUILD_VERSION、`site/manifest.webmanifest`、`site/sw.js`），页面和 CSP 不变。实际上：

- 线上仍是 13-09 批准、13-11 部署的版本 `a1159ad93165`。
- 13-09（提交 d45af01）之后，参与构建的输入里只有 `us-journey-tracker.html` 变了（Phase 14、Phase 15，最后一次应用提交 427395e）。`deploy/`、`pb/pb_migrations/`、`pb_hooks` 逐字节不变。
- 编排者在临时目录里试构建（不含清单改动）：与批准清单相比恰好 4 个路径不同（BUILD_VERSION、`server/nginx/usj-csp.conf`、`site/index.html`、`site/sw.js`）；加上清单改动是 5 个。
- 当前应用字节的全量回归已在 Phase 15 收尾时通过（默认 238、cloud 286，见 15-VERIFICATION.md），应用自 427395e 起没有变过。

编排者给了两个选项，所有者选择（原话）：**「部署现在的新版本」**——升级演练部署的是当前应用（Phase 14 加 Phase 15）加计划里的清单 `description` 字段。

### 由此对本计划的改动（每一条都是偏离）

1. **比较规则：** 与 13-09 批准清单相比，变化的路径必须恰好是这 5 个（排序后）：`BUILD_VERSION server/nginx/usj-csp.conf site/index.html site/manifest.webmanifest site/sw.js`；其余 27 行必须逐字节相同；两边都恰好 32 行。第二条自动验证里的 `$ch` 比较相应换成这 5 个。任何别的差异就停下报告，不请批准。
2. **上传集合不变：** 仍是同样的 13 个文件。其中 `server/06-install-site.sh` 和 SDK 与 13-09 相同；`site/index.html` 和 `server/nginx/usj-csp.conf` 这次**会**变（计划文字里“相同”的说法不再适用）。
3. **06 的期望输出：** `CSP_CONF=installed`（不是 `same`），因为 CSP 头随页面一起变；`SITE_SWAP=done`、`NGINX_RELOAD=done`、`SITE_VERSION=0ba1339903f1`。
4. **SUMMARY 草稿额外展示：** CSP 的新旧差异、新页面带来什么的一句话、清单 diff（见下）。
5. **Phase 16 的更新顺序：** 部署后，打开过应用的设备会看到「有新版本」「点此更新」，所有者先不要点，留到 Phase 16（原 13-15）总体验收的 E 项。服务器上现在只有测试账号，旧页面丢弃 `workouts`（T-15-04）伤不到真实数据；但 Phase 16 的真实数据迁移必须在所有设备都升到新版本之后才做。计划里写 13-15 的地方，读作 Phase 16（原 13-15）。

## 已完成的任务

| 任务 | 名称 | 提交 | 文件 |
|------|------|------|------|
| 1 | tracer：清单加 description、相关用例、构建、与批准清单比较、只读状态 | 897f496 | deploy/site/manifest.webmanifest |
| 2 | 所有者批准（blocking-human） | 等待中 | — |
| 3 | 上传、核对、06、删上传目录、线上全量检查 | 未开始 | — |

## Task 1 结果

- **清单 diff**（`897f496`，仅此一行）：
  ```diff
     "short_name": "计划手记",
  +  "description": "计划手记",
     "lang": "zh-CN",
  ```
- **相关用例：** `site-assets` 与 `deploy-tools` 两个 spec，BELOW_NORMAL 优先级，1 个 worker，4 条全部通过；`check-report`：`REPORT OK expected=4 flaky=0 unexpected=0`；暂存后隐私检查通过。
- **构建：** `BUILD OK 0ba1339903f1 (33 files)`；`--check-bundle`：`BUNDLE OK (9 checks)`。
- **BUILD_VERSION：** 旧 `a1159ad93165` → 新 `0ba1339903f1`。
- **旧清单的来源：** 取自 13-09-SUMMARY.md `## 部署批准清单` 的第一个代码块（32 行）；重建前的 `private/deploy-out/SHA256SUMS` 的 sha256 也等于批准值 `ac686d29…198b7`，两者逐行一致。

### 与 13-09 批准清单的比较（修订后的 5 路径规则）

两边都是 32 行。变化的路径恰好是：`BUILD_VERSION`、`server/nginx/usj-csp.conf`、`site/index.html`、`site/manifest.webmanifest`、`site/sw.js`。其余 27 行逐字节相同，包括服务器上已经装好的全部 21 个服务器、迁移、钩子文件，4 个图标和 SDK。结论：**符合偏离后的规则，可以请批准。**

| 路径 | 旧 sha256（前 12 位） | 新 sha256（前 12 位） |
|------|------|------|
| BUILD_VERSION | afb24694f1e7 | 20c12aada927 |
| server/nginx/usj-csp.conf | e3ff830612ef | 204d0316e34c |
| site/index.html | e02477ca2812 | da611cc3fc6d |
| site/manifest.webmanifest | 0eeaea7526bd | 7556bbf423d0 |
| site/sw.js | 2d446342a7cb | 56521687841b |

### CSP 的差异（`usj-csp.conf` 第 2 行，只有指令和哈希）

只有两个哈希变了，指令本身一个字都没有改：

- `script-src`：`'sha256-y2yfoHfD…'`（SDK 外链脚本的哈希，不变）；内联脚本哈希 `5WQanO09…` → `HFklbF7n…`。
- `style-src`：`'sha256-Y40/XeuL…'` → `'sha256-ZoEzSrTt…'`。
- 其余（`default-src 'none'`、`connect-src 'self'`、`frame-ancestors 'none'` 等）逐字相同。

原因：页面里内联脚本和样式变了，所以页面和 CSP 必须一起换（06 就是这样做的）。`usj-csp.conf` 经 `redact.mjs --check` 干净。

### 新页面带来什么（一句话）

Phase 14：新账号的计划起点；Phase 15：第五个标签「健身」（力量目标卡片搬到这里），以及 Phase 15 评审修复的若干小改动。全量回归已在 Phase 15 收尾时通过。

### 这次要上传的 13 个文件

（`SHA256SUMS` 一行是完整的 32 行 `private/deploy-out/SHA256SUMS` 本身的 sha256。）

```text
d9bfcc20f1b13e5a932b33d505bff031074402c7daf6b3b2604b8e652fc36884  SHA256SUMS
20c12aada92706df468ec40425df883b2892bc97b90634c124384b0e26b93755  BUILD_VERSION
bea80fb81885a18d8809f9923a56dd291872fc7efa9b27a7c5f955a53cae2fb1  server/06-install-site.sh
204d0316e34ce29f107679605f48d8b810d66d90394957ec59339fafbe760fa3  server/nginx/usj-csp.conf
8f9cb81cceaa04c738186b0c72b954d3b88fe24ec54dd7d999ba053e8d0bc9ce  site/icons/apple-touch-icon-180.png
5e9f9659c244fe29e9d39b5abc26405e6fca17b90cef01694cb784b1b0e30adc  site/icons/icon-192.png
06b1d903c463d6904cbbc1c7938634494e430ef5ca6265ba32031c9869bf9c1a  site/icons/icon-512.png
a5898b8f7b920e14bc7c13d3d8ee6f1bd0e4433d7197c9f91d3e1470c811ac91  site/icons/icon-maskable-512.png
da611cc3fc6d7aed9dcc175a6acbf3ed3b7b42209ee7d6f783d5c2783db4b79b  site/index.html
7556bbf423d07a55d08c90a7ee994cc1d649cccad921ac327ed09dd4e7f6968e  site/manifest.webmanifest
56521687841b4e03dfaf27c7082405227c5b2e1ecea70e44afaa1bfcb3ef9b78  site/sw.js
b799f1c9c9fb20e77f9ffe693a05ed17cbf2123dc6315bdeb8f9106dc363311a  site/vendor/SHA256SUMS
94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f  site/vendor/pocketbase.iife.js
```

其中 `server/06-install-site.sh`、`site/icons/*`（4 个）、`site/vendor/*`（SDK 和它的 SHA256SUMS）与 13-09 批准时逐字节相同；变了的是 `BUILD_VERSION`、`server/nginx/usj-csp.conf`、`site/index.html`、`site/manifest.webmanifest`、`site/sw.js`。

### 06 的期望输出（Task 3）

`SITE_VERSION=0ba1339903f1`、`SITE_FILES=9`、`SITE_SWAP=done`、`CSP_CONF=installed`、`NGINX_RELOAD=done`。（`CSP_CONF=installed` 而不是计划里的 `same`，见上面的偏离 3。）

### 命令文件

`test-results/13-14-upgrade-cmd.txt`（被 git 忽略，35 行：13 条清单行加六条命令原文加说明）；sha256 `44a96deb8a503d48a4bde94f736ad55c36c0ed22b0db02bac55ec848e892c5e5`。命令里 06 不带外层 sudo：脚本自己对需要 root 的步骤调用 `sudo -n`，并且要求上传目录属于调用者，外层再加 sudo 会让这个检查失败（与 13-10、13-11 的写法一致）。

### 只读状态（升级前，`test-results/13-14-status-before.txt`，经 redact，`--check` 干净）

`SITE_VERSION=a1159ad93165`（仍是旧版本）、`PB_SERVICE_ACTIVE=active`、`PB_HEALTH=ok`、`NGINX_TEST=ok`、`UPLOAD_DIRS=0`、`STATUS_DONE=1`。

## 接下来

Task 2 等待所有者回复「批准」（或要求修改）；批准后由接手的执行者在本文件加 `## 升级批准清单`（上面那 13 行原文、新 BUILD_VERSION、所有者的原话），再执行 Task 3。

## 未决事项

- 部署后设备上出现的「有新版本」「点此更新」先不要点，留到 Phase 16（原 13-15）总体验收的 E 项。
- Phase 16 的真实数据迁移必须在所有设备升到新版本之后。
