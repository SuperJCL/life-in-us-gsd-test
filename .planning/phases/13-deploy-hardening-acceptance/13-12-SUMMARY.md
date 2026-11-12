---
phase: 13-deploy-hardening-acceptance
plan: 12
subsystem: admin-hardening-and-reboot
tags: [deploy, pocketbase, otp, mfa, reboot, ops-02, blocked]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-11 的第二批结果（PocketBase 正式运行、站点和 nginx 已装好、线上全量检查 19 项通过）
provides:
  - 重启前的只读基线（Task 1）
  - 重启前只读预检的结果：后台加固和测试数据在库里还没有，所以没有重启
affects: [13-12, 13-13, 13-14, 13-15]

actuals:
  tokens: 4000
  tasks: 1
  commits: 0
plan_head_before: 7d259b3fd9e5f60f9cca0d497fc9564e191a5835
plan_head_after: 7d259b3fd9e5f60f9cca0d497fc9564e191a5835

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-12-SUMMARY.md
  modified: []

requirements-completed: []

completed: 2026-11-12
status: blocked
---

# Phase 13 Plan 12: 后台加固与一次真重启 Summary（未完成，已暂停）

**状态：blocked。Task 3 的只读预检没有通过（两步验证两项仍是 off，库里没有测试账号和测试记录），所以没有重启服务器。服务器没有任何改动。**

## 即时确认（重启）

- 确认时间：2026-11-12
- 所有者原话：“都完成了，确认重启”
- 措辞说明：比计划里的回复口令（“测试邮件已收到，两步验证登录成功；R2 和测试账号都好了；确认重启”）简短；这里按原样记录。
- 确认前所有者看到的内容：步骤 1–9 原文，以及重启命令原文 `ssh -o BatchMode=yes usj 'sudo -n systemctl reboot'` 和它的效果（站点中断约一两分钟；之后每 15 秒试连一次、最多 10 分钟；只读检查，不做手动修复；`--stage full` 会让所有者的 IP 约 60 秒登不了后台）。
- 命令文件 `test-results/13-12-reboot.txt` 的 sha256：`2b382ecc379d53d77473e1500312055ed54960da8a48deedc79b914196916e37`，本机核对与记录一致。
- 结果：这次确认**没有被用于重启**，因为紧接着的只读预检显示它所确认的前置步骤在服务器上看不到（见下）。

## 重启前只读预检（2026-11-12T22:05Z，经 redact）

| 键 | 值 | 要求 | 是否满足 |
|----|----|------|----------|
| UPTIME_S | 509237 | （参考） | - |
| PB_SERVICE_ACTIVE | active | active | 是 |
| STATUS_DONE | 1 | 1 | 是 |
| DB_SU_OTP | off | on | **否** |
| DB_SU_MFA | off | on | **否** |
| DB_SETTINGS_ENCRYPTED | yes | yes | 是 |
| DB_USERS_COUNT | 0 | 不小于 1 | **否** |
| DB_DOCS_COUNT | 0 | 不小于 2 | **否** |
| DB_USERS_NONTEST | 0 | 0 | 是 |
| DB_DOCS_NONTEST | 0 | 0 | 是 |

其余键与 Task 1 的基线一致（PB_HEALTH=ok、PB_LISTEN_LOOPBACK_ONLY=yes、NGINX 和 certbot 定时器 active/enabled、swap 在 fstab 里、SITE_VERSION=a1159ad93165、DB_SUPERUSERS_COUNT=1）。00-status.sh 用 `mode=ro` 直接读正在使用的库文件，不是缓存值。

可能原因（未诊断，只读）：所有者回复时第 4、7、8 步还没做完或没有保存成功；或者登录的是另一个站点。需要所有者在后台重新核对：Collections → _superusers 的 Options 里 OTP 和 MFA 是否保存成功；Collections → users 里是否有 `test-…@example.com` 账号；设备甲上是否登录成功并记了内容（`journey_docs` 里要有至少 2 条）。

## Task 1 基线（只读，2026-11-12T22:02Z）

UPTIME_S=509065；PB_SERVICE_ACTIVE=active、PB_SERVICE_ENABLED=enabled、PB_HEALTH=ok、PB_LISTEN_LOOPBACK_ONLY=yes；NGINX_ACTIVE=active、NGINX_ENABLED=enabled；CERTBOT_TIMER=active、CERTBOT_TIMER_ENABLED=enabled；SWAPFILE_ACTIVE=yes、SWAP_FSTAB=present；DB_SU_OTP=off、DB_SU_MFA=off、DB_SUPERUSERS_COUNT=1；DB_USERS_COUNT=0、DB_DOCS_COUNT=0；DB_SETTINGS_ENCRYPTED=yes；SITE_VERSION=a1159ad93165；基线 VERIFY OK (3 checks)。

## 首次自动备份预计时间

备份 cron `0 19 * * *`（UTC），保留 30 份：首次预计 2026-11-13 19:00 UTC，即北京时间 2026-11-14 03:00。（所有者在计划里写的是“今晚 03:00”，实际应是 2026-11-14 凌晨，因为今天 03:00 已过，且 R2 尚未配置。）

## Deviations from Plan

None（没有对服务器做任何改动；Task 3 按计划的预检规则停下）。

## 未做的事

- 没有重启，没有运行 `--stage full`，没有写任何服务器状态。
- Task 3 全部待做：预检通过后才能重启。OPS-02、SEC-02、OPS-01 保持 Pending。

## Self-Check: PASSED

本文件只记录事实；`git` 提交数为 0（计划 Task 1 和 Task 2 按设计没有提交）。
