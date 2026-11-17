---
phase: 13-deploy-hardening-acceptance
plan: 14
subsystem: deploy
tags: [upgrade-drill, site, csp, ops-03, ops-04]
status: complete
requirements: [OPS-03, OPS-04]
provides:
  - 线上站点已升级到 BUILD_VERSION 0ba1339903f1（Phase 14 加 Phase 15 的应用），页面和 CSP 头一起换
  - 真实服务器上的升级流程走通：批准清单、上传 13 个文件、服务器端核对、06、删上传目录、只读状态、线上全量检查
  - 旧版本 a1159ad93165 的版本目录按 06 的保留规则留作回滚
affects: [13-15]
actuals:
  tokens: 4000
  tasks: 3
  commits: 3
plan_head_before: 38c667f9b0e0d35d615a4c2107477746c546721a
plan_head_after: 901883fc105a232c847d953e8b465ea7cf324a91
key-files:
  modified:
    - deploy/site/manifest.webmanifest
---

# Phase 13 Plan 14: 真实服务器升级演练 Summary

**线上站点已从 `a1159ad93165` 升级到 `0ba1339903f1`：批准的 13 个文件上传并在服务器上核对通过，06 一次成功（`CSP_CONF=installed`、`SITE_SWAP=done`、`NGINX_RELOAD=done`），上传目录已删除，升级后只读状态健康，线上全量检查 `VERIFY OK (19 checks)`。**

（`commits: 3` 是从 `plan_head_before` 到写本文件前的 HEAD 量出来的，不含本文件自己的提交。）

## 所有者的范围决定（已批准的偏离，2026-11-17）

计划写于 Phase 14、15 之前，假设线上站点等于仓库里的应用，因此给清单加一个 `description` 只会让 3 个文件变化（BUILD_VERSION、`site/manifest.webmanifest`、`site/sw.js`），页面和 CSP 不变。实际上：

- 线上仍是 13-09 批准、13-11 部署的版本 `a1159ad93165`。
- 13-09（提交 d45af01）之后，参与构建的输入里只有 `us-journey-tracker.html` 变了（Phase 14、Phase 15，最后一次应用提交 427395e）。`deploy/`、`pb/pb_migrations/`、`pb_hooks` 逐字节不变。
- 编排者在临时目录里试构建（不含清单改动）：与批准清单相比恰好 4 个路径不同（BUILD_VERSION、`server/nginx/usj-csp.conf`、`site/index.html`、`site/sw.js`）；加上清单改动是 5 个。
- 当前应用字节的全量回归已在 Phase 15 收尾时通过（默认 238、cloud 286，见 15-VERIFICATION.md），应用自 427395e 起没有变过。

编排者给了两个选项，所有者选择（原话）：**「部署现在的新版本」**——升级演练部署的是当前应用（Phase 14 加 Phase 15）加计划里的清单 `description` 字段。

### 由此对本计划的改动（每一条都是偏离）

1. **比较规则：** 与 13-09 批准清单相比，变化的路径必须恰好是这 5 个（排序后）：`BUILD_VERSION server/nginx/usj-csp.conf site/index.html site/manifest.webmanifest site/sw.js`；其余 27 行必须逐字节相同；两边都恰好 32 行。任何别的差异就停下报告，不请批准。
2. **上传集合不变：** 仍是同样的 13 个文件。其中 `server/06-install-site.sh` 和 SDK 与 13-09 相同；`site/index.html` 和 `server/nginx/usj-csp.conf` 这次会变（计划文字里“相同”的说法不再适用）。
3. **06 的期望输出：** `CSP_CONF=installed`（不是 `same`），因为 CSP 头随页面一起变。
4. **Phase 16 的更新顺序：** 部署后，打开过应用的设备会看到「有新版本」「点此更新」，所有者先不要点，留到 Phase 16（原 13-15）总体验收的 E 项。计划里写 13-15 的地方，读作 Phase 16（原 13-15）。

## 已完成的任务

| 任务 | 名称 | 提交 | 文件 |
|------|------|------|------|
| 1 | tracer：清单加 description、相关用例、构建、与批准清单比较、只读状态 | 897f496（清单），0c050ec（草稿） | deploy/site/manifest.webmanifest |
| 2 | 所有者批准（blocking-human） | 901883f（批准记录） | 本文件 |
| 3 | 上传、核对、06、删上传目录、只读状态、线上全量检查 | 无提交（只改服务器；输出在 `test-results/`，被 git 忽略） | — |

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

两边都是 32 行。变化的路径恰好是：`BUILD_VERSION`、`server/nginx/usj-csp.conf`、`site/index.html`、`site/manifest.webmanifest`、`site/sw.js`。其余 27 行逐字节相同，包括服务器上已经装好的全部 21 个服务器、迁移、钩子文件，4 个图标和 SDK。结论：符合偏离后的规则。

| 路径 | 旧 sha256（前 12 位） | 新 sha256（前 12 位） |
|------|------|------|
| BUILD_VERSION | afb24694f1e7 | 20c12aada927 |
| server/nginx/usj-csp.conf | e3ff830612ef | 204d0316e34c |
| site/index.html | e02477ca2812 | da611cc3fc6d |
| site/manifest.webmanifest | 0eeaea7526bd | 7556bbf423d0 |
| site/sw.js | 2d446342a7cb | 56521687841b |

### CSP 的差异（`usj-csp.conf` 第 2 行，只有指令和哈希）

只有两个哈希变了，指令本身一个字都没有改：

- `script-src`：云端开关那个小内联脚本（`window.USJ_CONFIG`）的哈希不变；主内联脚本哈希 `5WQanO09…` → `HFklbF7n…`。（构建只给不带 `src` 的内联块算哈希，SDK 外链脚本由 `'self'` 放行，不占哈希。）
- `style-src`：`'sha256-Y40/XeuL…'` → `'sha256-ZoEzSrTt…'`。
- 其余（`default-src 'none'`、`connect-src 'self'`、`frame-ancestors 'none'` 等）逐字相同。

原因：页面里内联脚本和样式变了，所以页面和 CSP 必须一起换（06 就是这样做的）。

### 新页面带来什么（一句话）

Phase 14：新账号的计划起点；Phase 15：第五个标签「健身」（力量目标卡片搬到这里），以及 Phase 15 评审修复的若干小改动。

### 升级前的只读状态（`test-results/13-14-status-before.txt`）

`SITE_VERSION=a1159ad93165`、`PB_SERVICE_ACTIVE=active`、`PB_HEALTH=ok`、`NGINX_TEST=ok`、`UPLOAD_DIRS=0`、`STATUS_DONE=1`。

## 升级批准清单

所有者在聊天里看过旧/新 BUILD_VERSION、5 个变化路径、CSP 变化、只读状态、下面 13 行清单原文和六条命令之后，回复：**「批准」**。更早在范围问题上，所有者的选择是：**「部署现在的新版本」**。

批准的新 BUILD_VERSION：`0ba1339903f1`（旧：`a1159ad93165`）。批准的清单（13 行，与 `test-results/13-14-upgrade-cmd.txt` 逐字节相同）：

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

命令文件 `test-results/13-14-upgrade-cmd.txt`（被 git 忽略）sha256 `44a96deb8a503d48a4bde94f736ad55c36c0ed22b0db02bac55ec848e892c5e5`；`private/deploy-out/SHA256SUMS` sha256 `d9bfcc20f1b13e5a932b33d505bff031074402c7daf6b3b2604b8e652fc36884`。执行前重新核对，两者都没变。

## Task 3 结果（2026-11-17）

只执行了命令文件里的命令 1 到 5，写成一个脚本一次跑完（先从本文件的批准清单取出 13 行作为 `U`，确认恰好 13 行并与命令文件逐行相同；任何一步失败就先执行命令 5 删除上传目录再停止，没有触发）。脚本退出码 0。命令 6 和只读状态是单独调用的。每个服务器输出都先过 `redact.mjs`，下面所有 `--check` 都是干净的。

### 上传核对（命令 3，`test-results/13-14-upload-check.txt`）

```text
UPLOAD_CHECK=ok FILES=13
```

命令 1 创建上传目录通过形状检查，命令 2 本机 `sha256sum -c --strict` 通过后上传，命令 3 在服务器上逐行核对通过且文件数是 13。

### 06 的输出（命令 4，`test-results/13-14-06.txt`，原样）

```text
SITE_VERSION=0ba1339903f1
SITE_FILES=9
SITE_SWAP=done
CSP_CONF=installed
NGINX_RELOAD=done
```

06 自己的清单行在服务器上先核对通过才执行。与期望完全一致（`CSP_CONF=installed` 是偏离 3 预料到的）。

### 删上传目录（命令 5）

脚本输出 `CMD5_DELETE=done`；升级后的状态里 `UPLOAD_DIRS=0`。

### 升级后的只读状态（`test-results/13-14-status-after.txt`）

关键行：

```text
NGINX_ACTIVE=active
NGINX_TEST=ok
PB_SERVICE_ACTIVE=active
PB_HEALTH=ok
PB_LISTEN_LOOPBACK_ONLY=yes
SITE_VERSION=0ba1339903f1
SITE_FILES=9
UPLOAD_DIRS=0
DB_USERS_NONTEST=0
DB_DOCS_NONTEST=0
STATUS_DONE=1
```

（`PB_HEALTH=ok` 是已知的输出格式。）服务器上仍然只有测试账号和测试数据（`DB_USERS_NONTEST=0`、`DB_DOCS_NONTEST=0`）。`redact.mjs --check` 干净。

### 线上全量检查（命令 6，`test-results/13-14-verify-full.txt`，过滤后原样）

```text
PASS B-01 HTTPS 可达（DNS 和 TLS 正常）
PASS B-02 http 跳转到 https
PASS B-03 8090 从外面连不上 CLOSED
PASS F-01 / 返回 200 且响应头齐全（CSP、nosniff、Referrer-Policy、Permissions-Policy、HSTS 一天、noindex、DENY、no-cache）
PASS F-02 线上 CSP 的哈希与线上页面内联块一一对应，页面恰好一处云端开关
PASS F-03 线上策略含 style-src-attr 'none'、frame-ancestors 'none'，没有 unsafe- 关键字
PASS F-04 /sw.js 200、JavaScript 类型、no-cache、带 default-src none 的 CSP、含 12 位版本号
PASS F-05 /manifest.webmanifest 的类型是 application/manifest+json，name 是「计划手记」
PASS F-06 4 个主屏图标都是 200 且 image/png
PASS F-07 SDK 文件的 sha256 等于钉死值
PASS F-08 探针路径和未知路径都是 404（D-10）
PASS F-09 /api/health 返回 200 且带 X-Robots-Tag
PASS F-10 /_/ 返回 200，带 PocketBase 自己的 CSP（含 frame-ancestors）而不是页面的 CSP
PASS F-11 匿名注册被拒，匿名读不到任何文档
PASS F-12 SSE：10 秒内收到带 clientId 的 PB_CONNECT
PASS F-13 CORS：别的源不被放行，本站源得到同值
PASS F-14 www 跳转到裸域名（www 能解析且证书覆盖它时；否则不适用）
PASS F-15 页面带 Accept-Encoding: gzip 时返回 gzip
PASS F-16 后台登录连发 6 次，前 5 次不是 429，第 6 次 429（本机 IP 的后台登录会等 60 秒）
VERIFY OK (19 checks)
```

F-04 核对的是线上版本等于本机新的 BUILD_VERSION，通过；F-02 说明新页面的内联块和新 CSP 的哈希一一对应，即页面和 CSP 确实一起换了。`redact.mjs --check` 干净。全量检查故意把后台密码输错 6 次，所以所有者这台机器的 IP 约 60 秒内登不上管理后台，现已过去。

### 计划的 Task 3 自动验证

按计划原文运行了状态部分（`STATUS_DONE=1` 是最后一行，`SITE_VERSION=0ba1339903f1`、`PB_SERVICE_ACTIVE=active`、`NGINX_TEST=ok`、`UPLOAD_DIRS=0`，`--check` 干净），通过。验证里的第二次全量检查**跳过了**：上面刚成功跑过一次命令 6，再跑会再触发一次后台登录锁定 60 秒，没有新信息。

## 版本与回滚

- **版本：** 旧 `a1159ad93165` → 新 `0ba1339903f1`。
- **回滚：** 按 06 的规则保留最近 3 个版本目录，旧版本目录 `a1159ad93165` 应仍在 `/var/www/usj/releases/` 下（没有单独在服务器上列目录确认，因为只读状态不含这一项，也不允许额外的服务器命令）。回滚步骤见 `deploy/README.md` 的「9. 回滚」：把 `/var/www/usj/site` 链接指回上一个版本（`ln -sfn` 加 `mv -T`，同 06），页面的 CSP 从 `/etc/nginx/usj-backup/` 里恢复对应版本，`nginx -t` 后 reload。这次 06 一次成功，没有用到回滚。

## Deviations from Plan

1. **[范围偏离，所有者已批准] 5 个变化路径而不是 3 个。** 见上面「所有者的范围决定」。所有者原话「部署现在的新版本」。
2. **[随之而来] 06 输出是 `CSP_CONF=installed`，不是计划写的 `same`。** 页面和 CSP 一起换，符合预期。
3. **[格式] 状态里是 `PB_HEALTH=ok`。** 已知的输出格式，不是问题。
4. **[省略] 计划自动验证里的第二次全量检查没有重跑。** 理由见上；状态部分照常通过。
5. **[记录] 本计划写 13-15 的地方读作 Phase 16（原 13-15）。**
6. **[备注] 回滚用的旧版本目录没有在服务器上单独列出确认。** 只读状态不含这项，且命令集合不允许额外的服务器命令。

除此之外计划按批准的命令原样执行；没有用到 `--no-verify`、`git add -A`，没有读 `private/server.env`、`private/plan-seed.json` 等，没有推送，也没有改 `STATE.md`、`ROADMAP.md`、`REQUIREMENTS.md`。

## 需求进度（不在这里标记完成）

- **OPS-03（站点升级、回滚）：** 真实服务器上的升级流程已走通并通过线上全量检查。回滚只有文档，没有实际演练。是否标记完成由编排者决定。
- **OPS-04（线上检查）：** 升级后的线上全量检查 `VERIFY OK (19 checks)`。是否标记完成由编排者决定。

## 接下来

- **新版本已经上线**（`0ba1339903f1`，含第五个标签「健身」和新账号的计划起点）。
- 之前打开过应用的设备（设备甲）现在会看到「有新版本」「点此更新」。**先不要点**，留到 Phase 16（原 13-15）总体验收的 E 项，在设备甲上看更新提示。
- Phase 16 的真实数据迁移只在所有设备都升到新版本之后才做。旧页面会丢弃 `workouts`（T-15-04），服务器上现在只有测试账号，旧页面伤不到真实数据。

## Threat Flags

None（没有新增网络端点、认证路径或信任边界；上线的页面和 CSP 头出自同一次构建，服务器脚本、迁移和钩子与 13-09 批准时逐字节相同。T-13-33 的缓解见 13-SECURITY.md）。

## 未决事项

- 部署后设备上出现的更新提示先不要点，留到 Phase 16 总体验收的 E 项。
- Phase 16 的真实数据迁移必须在所有设备升到新版本之后。

## Self-Check: PASSED

- 提交存在：897f496、0c050ec、901883f 都在当前历史里。
- 输出文件存在（本机，被 git 忽略）：`test-results/13-14-upload-check.txt`、`13-14-06.txt`、`13-14-status-after.txt`、`13-14-verify-full.txt`。
- 上传目录已删除（`UPLOAD_DIRS=0`）；线上版本等于 `private/deploy-out/BUILD_VERSION`。
