---
phase: 13-deploy-hardening-acceptance
plan: 12
subsystem: admin-hardening-and-reboot
tags: [deploy, pocketbase, otp, mfa, smtp, r2-backup, reboot, ops-02]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-11 的第二批结果（PocketBase 正式运行、站点和 nginx 已装好、线上全量检查 19 项通过）
provides:
  - 重启前的只读基线（Task 1）和两次重启前预检（第一次未通过、第二次通过）
  - 所有者完成的后台加固：邮件（465 + TLS Always）、_superusers 的 OTP 和 MFA、R2 备份已连通、测试账号和几条测试记录
  - 一次真重启后，PocketBase、nginx、证书续期定时器、swap、两步验证和加密设置全部自己回来；线上全量检查 19 项通过
affects: [13-13, 13-14, 13-15]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2
plan_head_before: 7d259b3fd9e5f60f9cca0d497fc9564e191a5835
plan_head_after: 0d56503f23156567bd698adbc716ba3502c57997

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-12-SUMMARY.md
  modified: []

requirements-completed: []

completed: 2026-11-12
status: complete
---

# Phase 13 Plan 12: 后台加固与一次真重启 Summary

**服务器真重启一次，全部服务、定时器、swap、两步验证和加密设置都自己回来了，重启后 `verify-site --stage full` 19 项全部通过（VERIFY OK (19 checks)）。**

`commits: 2` 是写这份 SUMMARY 时用 git 实测的数（`7d259b3..0d56503`：847810a 第一次受阻记录、0d56503 重启前记录第二次确认）；本 SUMMARY 自己的提交和 STATE/ROADMAP 提交在它之后。计划 Task 1、2、3 按设计不产生代码提交。

## 执行经过

| 任务 | 内容 | 结果 |
|------|------|------|
| 1 | 只读：重启前状态与 HTTPS 基线，记录 uptime，写好重启命令文件 | 通过（见下面基线） |
| 2 | 所有者做后台步骤并给出即时确认 | 第一次回复时步骤未做完，预检没过，没有重启；第二次做完并再次确认 |
| 3 | 重启一次、等回来、只读确认、线上全量检查一次 | 通过 |

## 即时确认（重启）第一次（没有用于重启）

- 确认时间：2026-11-12
- 所有者原话：“都完成了，确认重启”
- 措辞说明：比计划里的回复口令（“测试邮件已收到，两步验证登录成功；R2 和测试账号都好了；确认重启”）简短；这里按原样记录。
- 确认前所有者看到的内容：步骤 1–9 原文，以及重启命令原文 `ssh -o BatchMode=yes usj 'sudo -n systemctl reboot'` 和它的效果（站点中断约一两分钟；之后每 15 秒试连一次、最多 10 分钟；只读检查，不做手动修复；`--stage full` 会让所有者的 IP 约 60 秒登不了后台）。
- 结果：紧接着的只读预检（22:05Z）显示 DB_SU_OTP=off、DB_SU_MFA=off、DB_USERS_COUNT=0、DB_DOCS_COUNT=0，所以这次确认没有被用于重启。原因是所有者当时误以为这些后台步骤由别人做；说明之后所有者自己做了。

## 即时确认（重启）第二次（用于重启）

- 确认时间：2026-11-12（所有者完成后台步骤之后）
- 所有者原话：“确认重启”
- 确认前所有者看到的内容：通过的预检表、重启命令原文 `ssh -o BatchMode=yes usj 'sudo -n systemctl reboot'`，以及它的效果（站点中断约一两分钟；之后每 15 秒试连一次、最多 10 分钟；只读检查，不做手动修复；`--stage full` 会让所有者的 IP 约 60 秒登不了后台；10 分钟还没回来就停下，请所有者去阿里云控制台查看）。
- 所有者做完的步骤（所有者自述，不含密钥）：邮件通过所有者的邮箱服务商走 465 端口、TLS 加密选 “Always”；测试邮件收到了，在垃圾邮件夹里；_superusers 开启 OTP 和 MFA，带验证码重新登录成功；R2 私有桶和只限该桶的读写令牌填在 Settings → Backups，后台提示 “S3 connected successfully”，cron `0 19 * * *` 和保留 30 份没改，没有手动建备份；建了测试账号 `test-…@example.com`；在手机上记了几条。
- 命令文件 `test-results/13-12-reboot.txt` 的 sha256 本机核对是 `2b382ecc379d53d77473e1500312055ed54960da8a48deedc79b914196916e37`，与记录一致。
- 记录提交：0d56503，在重启之前提交。

## 重启前基线（Task 1，只读，2026-11-12T22:02Z）

UPTIME_S=509065；PB_SERVICE_ACTIVE=active、PB_SERVICE_ENABLED=enabled、PB_HEALTH=ok、PB_LISTEN_LOOPBACK_ONLY=yes；NGINX_ACTIVE=active、NGINX_ENABLED=enabled；CERTBOT_TIMER=active、CERTBOT_TIMER_ENABLED=enabled；SWAPFILE_ACTIVE=yes、SWAP_FSTAB=present；DB_SU_OTP=off、DB_SU_MFA=off、DB_SUPERUSERS_COUNT=1；DB_USERS_COUNT=0、DB_DOCS_COUNT=0；DB_SETTINGS_ENCRYPTED=yes；SITE_VERSION=a1159ad93165；基线 VERIFY OK (3 checks)。

## 重启前预检

第一次（2026-11-12T22:05Z，经 redact）：UPTIME_S=509237；DB_SU_OTP=off、DB_SU_MFA=off、DB_USERS_COUNT=0、DB_DOCS_COUNT=0（不满足）；其余满足。没有重启。

第二次（2026-11-12T23:36Z，经 redact，全部满足）：

| 键 | 值 | 要求 |
|----|----|------|
| UPTIME_S | 514689（重启前新值） | 参考 |
| PB_SERVICE_ACTIVE | active | active |
| STATUS_DONE | 1 | 1 |
| DB_SU_OTP | on | on |
| DB_SU_MFA | on | on |
| DB_SETTINGS_ENCRYPTED | yes | yes |
| DB_USERS_COUNT | 1 | 不小于 1 |
| DB_DOCS_COUNT | 2 | 不小于 2 |
| DB_USERS_NONTEST | 0 | 0 |
| DB_DOCS_NONTEST | 0 | 0 |

## 重启（Task 3）

- 重启命令只发了一次：23:37:06Z 发出，ssh 返回码 0（命令文件里的 `|| true` 保留）。
- 先等 45 秒再开始每 15 秒试连，第一次试连就通了（约 23:38:00Z，重启后约 1 分钟）；之后再等 30 秒才做只读检查。没有第二次重启，没有任何修复。
- 重启后只读状态（2026-11-12T23:38:41Z，经 redact）：

| 键 | 值 | 要求 | 是否满足 |
|----|----|------|----------|
| UPTIME_S | 84 | 小于 900 且小于 514689 | 是 |
| PB_SERVICE_ACTIVE / PB_SERVICE_ENABLED | active / enabled | active / enabled | 是 |
| PB_HEALTH | ok | ok | 是 |
| PB_LISTEN_LOOPBACK_ONLY | yes | yes | 是 |
| NGINX_ACTIVE / NGINX_ENABLED | active / enabled | active / enabled | 是 |
| NGINX_TEST | ok | ok | 是 |
| CERTBOT_TIMER / CERTBOT_TIMER_ENABLED | active / enabled | active / enabled | 是 |
| SWAPFILE_ACTIVE / SWAP_FSTAB | yes / present（SWAP_TOTAL_MB=1023） | yes / present | 是 |
| DB_SU_OTP / DB_SU_MFA | on / on | on / on | 是 |
| DB_SETTINGS_ENCRYPTED | yes | yes | 是 |
| DB_SUPERUSERS_COUNT / DB_USERS_COUNT / DB_DOCS_COUNT | 1 / 1 / 2 | 数据没丢 | 是 |
| DB_USERS_NONTEST / DB_DOCS_NONTEST | 0 / 0 | 0 / 0 | 是 |
| PB_KEY_LEN_OK | yes | yes | 是 |
| SITE_VERSION | a1159ad93165 | a1159ad93165 | 是 |
| STATUS_DONE | 1 | 1 | 是 |

- 重启后线上全量检查，运行一次（2026-11-12T23:38:50Z，经 redact）：

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

## 给 README 和验收说明的发现

- **邮件（SMTP）**：服务器连所有者的邮箱服务商，465 端口要把 TLS 加密设为 “Always”；默认的 StartTLS 设置第一次测试超时。从服务器出去，465、587、994 能通，25 端口不通。写部署说明和验收说明时要写明这一点，不要指望 25 端口。
- **垃圾邮件夹**：测试邮件落在垃圾邮件夹里。以后 OTP 验证码邮件也可能这样，所有者要把发件地址标为“不是垃圾邮件”；验收时提醒家人注意。
- **首次自动备份**：备份 cron `0 19 * * *`（UTC），保留 30 份。首次预计 2026-11-13 19:00 UTC，即北京时间 2026-11-14 03:00（计划里写的是“今晚 03:00”，实际是 2026-11-14 凌晨）。13-13 到 13-15 要在这之后核对备份确实出现在 R2。

## Deviations from Plan

**1. [格式说明] 状态键的取值格式与计划写法不同。** `PB_HEALTH=ok`（不是 `200`），`PB_ENV_MODE=root:pocketbase 640`（计划里的写法略有不同）。这是 00-status.sh 实际输出的格式，含义与计划要求一致；不改脚本。

**2. [流程] Task 2 的第一次确认被作废，没有重启。** 原因见上；所有者做完后给了第二次即时确认。服务器没有因第一次尝试发生任何改动。

除此之外没有对服务器做任何改动：只有一次重启，没有 sudo 的其他用法，没有改服务、文件、后台设置或账号，没有手动备份。

## 未做的事

- OPS-01、OPS-02、SEC-02 在 REQUIREMENTS.md 里保持 Pending：13-13 到 13-15 仍声明它们。
- 没有登录后台或应用；没有读取密钥、邮箱地址、验证码或备份。

## Known Stubs

None。

## Threat Flags

None（没有新增代码或网络面）。

## Self-Check: PASSED

- 命令文件 sha256 核对与记录一致。
- 计划账本 `gsd-plan-head-before-13-12` = 7d259b3fd9e5f60f9cca0d497fc9564e191a5835；`git rev-list --count` 实测 2；提交 847810a 和 0d56503 都在 main 上。
- 重启只发了一次；uptime 84 秒证明确实重启过；`VERIFY OK (19 checks)` 只跑了一次。
