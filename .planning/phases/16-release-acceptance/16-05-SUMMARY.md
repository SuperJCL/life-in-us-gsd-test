---
phase: 16-release-acceptance
plan: 05
subsystem: deploy
tags: [release, deploy, pocketbase, nginx, csp, restore-drill]
requires:
  - phase: 16-04
    provides: 本机全量回归通过、验收清单和合成数据
provides:
  - 修复版本 84d1fc754072 已上线（D-02、D-03），同时是验收 E 项要用的新版本
  - 新恢复演练脚本已装到服务器（只安装，未运行）
affects: [16-06, 16-07, 16-08]
tech-stack:
  added: []
  patterns: [批准清单加命令原文逐条当场确认, 上传目录用后即删]
key-files:
  created: []
  modified: []
key-decisions:
  - "命令原文由命令文件逐条提取后执行，没有重新键入或改动"
requirements-completed: []
metrics:
  duration: 约 1 小时（含等待所有者批准）
  completed: 2026-11-18
status: complete
actuals:
  tokens: 0
  tasks: 3
  commits: 0
plan_head_before: 5618c7cdabf793296c5e6545d5210c77d667c8d2
plan_head_after: 5618c7cdabf793296c5e6545d5210c77d667c8d2
---

# Phase 16 Plan 05: 修复版本上线 Summary

**把 16-01 到 16-03 的修复和新恢复演练脚本发布为 84d1fc754072：批准的 22 个文件上传后逐字节核对，03 在 PocketBase 运行中只装工具文件，06 分两步 reload 换页面和 CSP，线上全量检查 VERIFY OK (19 checks)。**

## 完成情况

- Task 1（tracer，只读）：构建 `BUILD OK 84d1fc754072 (33 files)`，`BUNDLE OK (9 checks)`；与线上批准清单逐行比较，变化的路径恰好九个：BUILD_VERSION、server/03-configure-pocketbase.sh、server/04-start-pocketbase.sh、server/06-install-site.sh、server/nginx/usj-csp.conf、server/restore-drill.sh、site/index.html、site/manifest.webmanifest、site/sw.js，其余 23 个逐字节相同。发布前只读状态和 HTTPS 基线（VERIFY OK (3 checks)）正常。四个服务器脚本的完整改动在被忽略的 `test-results/16-05-diff.txt`（458 行，186 增 45 删）。
- Task 2（blocking-human）：所有者批准清单并当场确认七条命令原文（见下面的批准记录）。
- Task 3：执行前核对——命令文件 sha256、SHA256SUMS sha256、BUILD_VERSION、`16-05-U.txt` 的 `sha256sum -c --strict` 全部与批准时相同，22 行清单与命令文件开头 22 行逐行一致；之后命令 1 到 7 在同一个脚本会话里按编号执行（命令文字从命令文件逐条提取，只让 UPDIR 在各条之间传递），没有任何一步失败、没有重试、没有改脚本、没有停服务。

## 发布批准清单

```
b6faf9434b25ab0c2925a73e45c6c9a4d64b6c7f1e8833bb2b700e1d5b851704  SHA256SUMS
1c73b1443e978183c361a0a6069c266b105e02dded200ae370946b83c49fce38  BUILD_VERSION
2cd8b049d0bfa6170d7e377fdfc573505427a2147585940e56b76f9e60645597  pb_hooks/backup-watch.pb.js
ff2557719b77e78494a3af336e145b0ed18d323f9b8b0c80d758a09bfdec8cb0  pb_migrations/1794096000_users_lockdown.js
ea29dc74b91fa87c3d1f9e238f097e23d89babe31bfb91669eb7ed09dec600c9  pb_migrations/1794096100_journey_docs.js
5d6c721ca38d70943aa6b06f19afdc10bc20d171364b1e1f7714b83bbcd9feaa  pb_migrations/1794096150_retire_probe.js
e0a058ab64cf7c1b87e41e37642f0cff287988deeea59039d4b47e7f39981cbc  pb_migrations/1794096200_server_settings.js
dced56fdc7babba4e8cbcfb7de4d610ad167ca48e59855cd4a09273619ef2b8c  server/03-configure-pocketbase.sh
92a38b9138c12febb05fbe978c307fb93acf4ba8f852a7f69e24a2416ce95ca8  server/04-start-pocketbase.sh
75d8633b0c418f7d5c0a5204ccef27f760444754ae992696c7817bd9a3be1af1  server/06-install-site.sh
cff14dd6c62251e4c83475b2c58a507f3a4a3e2e245786ea7e4f1f361103123d  server/nginx/usj-csp.conf
73d2028df59182ba9101b6b3adf3d1d2c3fccf9415ec05cdf675f31747b3cd11  server/pb-admin.sh
d051eec72a7bf0ed5039b01304048933b00ce611ad2f6fe5b4338a328d7fda73  server/restore-drill.sh
8f9cb81cceaa04c738186b0c72b954d3b88fe24ec54dd7d999ba053e8d0bc9ce  site/icons/apple-touch-icon-180.png
5e9f9659c244fe29e9d39b5abc26405e6fca17b90cef01694cb784b1b0e30adc  site/icons/icon-192.png
06b1d903c463d6904cbbc1c7938634494e430ef5ca6265ba32031c9869bf9c1a  site/icons/icon-512.png
a5898b8f7b920e14bc7c13d3d8ee6f1bd0e4433d7197c9f91d3e1470c811ac91  site/icons/icon-maskable-512.png
588b7c6d067ecfce08e4437afb308ce96ac4ebe3e6336e3031696f1e6d090e9b  site/index.html
0eeaea7526bde4de2b19a105c89498731c271842fc6b7bd17f2b57c874e4c661  site/manifest.webmanifest
97f8ca9688bd3ab8b8bb473069ca7c3623c7847fb33a09d9d3f8f7586d65b4ec  site/sw.js
b799f1c9c9fb20e77f9ffe693a05ed17cbf2123dc6315bdeb8f9106dc363311a  site/vendor/SHA256SUMS
94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f  site/vendor/pocketbase.iife.js
```

- 新 BUILD_VERSION：84d1fc754072（线上旧版本 0ba1339903f1）
- 命令文件 `test-results/16-05-release-cmd.txt` 的 sha256：412c5d7a958d3d8506240e9439eed64621a89b64d46a9c7ef80a5f33c83ddf0f（22 行清单加命令 1 到 7 和只读 a、b）
- 所有者的批准：2026-11-18 06:23 UTC 展示清单、九个变化路径的白话说明、七条命令原文和影响说明；06:54 UTC 回复“批准”，即批准 22 行清单并当场确认命令 1 到 7 的原文。

## 命令 1 到 7 的过滤后输出

命令 1、2、6 无输出（命令 2 的本机核对 22 行 OK）；命令 3：

```
UPLOAD_CHECK=ok FILES=22
```

命令 4（03，`test-results/16-05-03.txt`，PocketBase 全程运行，没有被要求停服务）：

```
PB_ENV_FILE=kept
PB_KEY_LEN_OK=yes
PB_ORIGIN_SET=yes
PB_MIGRATIONS_APP=4
PB_HOOKS=1
PB_ADMIN_TOOL=same
DRILL_TOOL=installed
PB_CONFIGURE=done
```

命令 5（06，`test-results/16-05-06.txt`，两步 reload）：

```
SITE_VERSION=84d1fc754072
SITE_FILES=9
SITE_SWAP=done
CSP_CONF=installed
CSP_TRANSITION=done
NGINX_RELOAD=done
```

命令 7（线上全量检查，`test-results/16-05-verify-full.txt`）：第一次运行即通过，没有重跑，所以没有需要第二次确认的情况。

```
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

命令 7 故意输错后台口令，所有者的 IP 约 60 秒内登不了后台，之后恢复。

## 发布前后只读状态（`00-status.sh`）

| 键 | 发布前 | 发布后 |
|----|--------|--------|
| SITE_VERSION | 0ba1339903f1 | 84d1fc754072 |
| SITE_FILES | 9 | 9 |
| PB_SERVICE_ACTIVE | active | active |
| PB_HEALTH | ok | ok |
| PB_MIGRATIONS_APP | 4 | 4 |
| PB_HOOKS | 1 | 1 |
| PB_ADMIN_TOOL | present | present |
| DRILL_TOOL | present | present |
| DRILL_UNIT | inactive | inactive |
| DRILL_DIR | absent | absent |
| UPLOAD_DIRS | 0 | 0 |
| NGINX_TEST | ok | ok |
| DB_USERS_NONTEST | 0 | 0 |
| DB_DOCS_NONTEST | 0 | 0 |
| STATUS_DONE | 1 | 1 |

发布后 `STATUS_DONE=1`；`test-results/16-05-status-after.txt` 经 `redact --check` 干净。

## 演练脚本哈希

服务器上 `/usr/local/sbin/usj-restore-drill` 的 sha256 为 `d051eec72a7bf0ed5039b01304048933b00ce611ad2f6fe5b4338a328d7fda73`，等于批准清单里 `server/restore-drill.sh` 那一行，一致。演练脚本只安装、未运行（`DRILL_UNIT=inactive`、`DRILL_DIR=absent`）。

## 版本

- 旧版本：0ba1339903f1
- 新版本：84d1fc754072（`SITE_VERSION=84d1fc754072`，06 输出和发布后状态一致）；旧版本目录按 06 的设计保留以便回滚。

## Deviations from Plan

无——计划按原文执行。命令 7 一次通过，没有重跑。执行用的脚本在 scratchpad 里把命令文件里的命令逐条原样提取并 eval，只加了输出过滤的 tee 和失败时的命令 6 清理，没有触发。

## Auth gates

无。所有服务器访问经 `ssh -o BatchMode=yes usj`，没有输入口令，没有读 `private/server.env`、`/etc/usj/*`，没有登录后台。

## Known Stubs

无。本计划不改仓库文件。

## 给所有者

修复版本已上线，验收可以开始（16-06 会把清单和准备事项交给你）。后台登录的 60 秒限流已过。

## 备注

- 仓库文件没有改动，所以本计划没有任务提交（`commits: 0` 是实测值，发布发生在服务器上）。
- requirements 里的 OPS-04 没有标记完成，留给 16-08 收口。
- 工作文件在被忽略的 `test-results/16-05-*` 里（命令文件、清单、差异、前后状态、03/06/全量检查输出、运行日志）。
