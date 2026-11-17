---
phase: 13-deploy-hardening-acceptance
plan: 13
subsystem: restore-drill
tags: [deploy, pocketbase, r2-backup, restore-drill, ops-01]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-12 的结果（后台加固、R2 备份已连通、一次真重启后全部自己回来）
provides:
  - 一次恢复演练 DRILL_RESULT=PASS：R2 里 5 份自动备份、演练备份写入后删除成功、最新自动备份恢复进临时实例且完整、合成账号和文档与线上一致、临时实例已清理、线上始终正常
  - 恢复演练前的只读前置检查和即时确认记录

affects: [13-14]

actuals:
  tokens: 6000
  tasks: 3
  commits: 2
plan_head_before: 94e5b92e9a696f5e3e18232aa4f52132aef423c5
plan_head_after: 24fad7fb73e13399a286b5eafd93ce2a218c8968

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-13-SUMMARY.md
  modified: []

requirements-completed: []

completed: 2026-11-17
status: complete
---

# Phase 13 Plan 13: 恢复演练 Summary

**在还没有真实数据时，服务器上的恢复演练一次通过（`DRILL_RESULT=PASS`）：最新的 R2 自动备份恢复进临时实例，合成账号和文档与线上一致，临时实例已删除，线上 PocketBase 全程 active 且健康。**

`commits: 2` 是写这份 SUMMARY 时的预期数：`94e5b92..24fad7f` 已实测 1 个（24fad7f，演练前的即时确认记录），加上本 SUMMARY 自己的提交（它的哈希只能在提交之后才知道，所以 `plan_head_after` 记的是演练前那次提交）。计划 Task 1、3 按设计不产生代码提交；STATE/ROADMAP/REQUIREMENTS 由编排器之后写。

## 执行经过

| 任务 | 内容 | 结果 |
|------|------|------|
| 1 | tracer（只读）：自动备份时间已过、时间窗合适、还没有真实数据、演练工具与批准的字节一致 → 拼出演练命令 | 通过 |
| 2 | 所有者确认：邮箱无告警信、R2 有自动备份；即时确认演练命令 | 通过（两项正常，命令已确认） |
| 3 | 运行一次恢复演练 → 只读确认已清理、线上照常 | 通过（DRILL_RESULT=PASS） |

## 即时确认（恢复演练）

- 确认日期：2026-11-17；演练在 19:20 UTC 之后运行（所有者在 19:00 UTC 左右、拒绝窗内给出确认，编排器告知所有者只会在 19:20 UTC 之后运行，并等到 19:21 UTC 才派发执行；实际运行时间 19:23 UTC）。
- Task 1（只读，2026-11-17 03:06 UTC 检查）：PB_SERVICE_ACTIVE=active、DRILL_DIR=absent、DRILL_UNIT 不存在或 inactive、DB_USERS_NONTEST=0、DB_DOCS_NONTEST=0、STATUS_DONE=1。
- 批准清单里 `server/restore-drill.sh` 那一行（13-09 批准）：`57a24b237a46cbc2bb2a7dbe1f8d1f11c9d7e4f52649e3bd7ad033997e639513  server/restore-drill.sh`
- 服务器上 `sha256sum /usr/local/sbin/usj-restore-drill`：`57a24b237a46cbc2bb2a7dbe1f8d1f11c9d7e4f52649e3bd7ad033997e639513`，与批准值一致。
- 所有者看到的演练命令原文：`ssh -o BatchMode=yes usj 'sudo -n /usr/local/sbin/usj-restore-drill' </dev/null 2>&1 | node tools/privacy/redact.mjs > test-results/13-13-drill.txt`
- 演练的效果（确认前已向所有者说明）：先检查线上库只有测试账号（否则拒绝、什么都不复制）；用线上库的只读副本在另一个端口起临时实例；在 R2 里写入并删掉一个 `drill_` 开头的演练备份；把最新的自动备份恢复进临时实例并核对；最后删掉临时实例；线上服务不停、不重启。命令从本机项目目录经已配置的 SSH 别名运行，输出经 `redact.mjs` 过滤后写进被 git 忽略的 `test-results/`。

所有者的回复（原话，按顺序，第 1、3、5 项按编排器转述）：

1. 问告警邮件会发到哪个邮箱；编排器说明：发到 PocketBase 超级用户的邮箱（PocketBase 的备份失败邮件和看门狗的「计划手记：备份异常」都只发到那里）。这里不记录任何邮箱地址。
2. 关于备份失败邮件（编排器说明备份每天 19:00 UTC，即 GMT-8 的 11:00 运行，PocketBase 只在失败时发信）：「那我好像没收到」
3. 所有者提供 R2 控制台截图：4 份自动备份（2026-11-13 至 2026-11-16，每天 19:00 UTC 一份）。不记录桶名、账号信息或截图里的其他内容。
4. 被问到垃圾邮件夹里是否也没有「备份失败」或「计划手记：备份异常」的信：「是的 没有」
5. 问命令在哪里运行；编排器说明：从本机项目目录经已配置的 SSH 别名运行，输出经 `redact.mjs` 过滤后进入被 git 忽略的 `test-results/`。
6. 最终确认：「确认运行恢复演练」

结论：邮箱（含垃圾邮件夹）没有备份失败或「备份异常」的信；R2 里有 4 份自动备份；演练命令和清单行已确认，两项都正常，Task 3 可以开始。

## 恢复演练输出（Task 3，只运行一次，2026-11-17 19:23 UTC，经 redact）

命令按即时确认过的原文运行，ssh 返回码 0，用时约 9 秒。没有重跑。`test-results/13-13-drill.txt` 的完整内容：

```
DRILL_WINDOW_OK=yes
DRILL_GUARD=ok
DRILL_TEMP_ISOLATED=yes
DRILL_AUTO_BACKUPS=5
DRILL_NEWEST_AGE_H=0
DRILL_R2_WRITE=ok
DRILL_R2_DELETE=ok
DRILL_RESTORE=ok
DRILL_INTEGRITY=ok
DRILL_RESTORED_TEST_ONLY=yes
DRILL_USERS_MATCH=yes
DRILL_DOCS=2
DRILL_DOCS_COMPARED=2
DRILL_DOCS_MISMATCH=0
DRILL_DOCS_CHANGED_SINCE=0
DRILL_USERS_WITH_BOTH_DOCS=1
DRILL_CLEANUP=done
DRILL_RESULT=PASS
```

逐项对照计划的期望：

| 键 | 值 | 要求 | 是否满足 |
|----|----|------|----------|
| DRILL_WINDOW_OK | yes | yes | 是 |
| DRILL_GUARD | ok | ok（线上库只有测试账号） | 是 |
| DRILL_TEMP_ISOLATED | yes | yes | 是 |
| DRILL_AUTO_BACKUPS | 5 | 不小于 1（所有者的截图 4 份，加上当天 19:00 UTC 的一份） | 是 |
| DRILL_NEWEST_AGE_H | 0 | 不大于 26 | 是 |
| DRILL_R2_WRITE / DRILL_R2_DELETE | ok / ok | ok / ok（令牌有删除权限，假设 A1 成立） | 是 |
| DRILL_RESTORE | ok | ok | 是 |
| DRILL_INTEGRITY | ok | ok | 是 |
| DRILL_RESTORED_TEST_ONLY | yes | yes | 是 |
| DRILL_USERS_MATCH | yes | yes | 是 |
| DRILL_DOCS_COMPARED | 2 | 不小于 1 | 是 |
| DRILL_DOCS_MISMATCH | 0 | 0 | 是 |
| DRILL_USERS_WITH_BOTH_DOCS | 1 | 不小于 1 | 是 |
| DRILL_CLEANUP | done | done | 是 |
| 最后一行 | DRILL_RESULT=PASS | PASS | 是 |

另：每一行都是 `DRILL_` 键；`node tools/privacy/redact.mjs --check` 对输出通过（clean）。`DRILL_NEWEST_AGE_H=0` 是因为当天 19:00 UTC 的自动备份刚在 23 分钟前生成，说明备份在演练当天照常运行。`DRILL_DOCS=2`、`DRILL_DOCS_CHANGED_SINCE=0` 表示恢复时 2 份文档都被比较，备份后没有再改过的。

## 演练后只读状态（2026-11-17 19:23 UTC，经 redact）

`test-results/13-13-status-after.txt`，`redact.mjs --check` 通过。相关行：

```
PB_SERVICE_ACTIVE=active
PB_SERVICE_ENABLED=enabled
PB_HEALTH=ok
PB_LISTEN_LOOPBACK_ONLY=yes
PB_KEY_LEN_OK=yes
DRILL_TOOL=present
DRILL_DIR=absent
DRILL_UNIT=inactive
NGINX_ACTIVE=active
CERTBOT_TIMER=active
DB_USERS_COUNT=1
DB_DOCS_COUNT=2
DB_USERS_NONTEST=0
DB_DOCS_NONTEST=0
DB_SU_OTP=on
DB_SU_MFA=on
DB_SETTINGS_ENCRYPTED=yes
STATUS_DONE=1
```

| 键 | 值 | 要求 | 是否满足 |
|----|----|------|----------|
| PB_SERVICE_ACTIVE | active | active | 是 |
| PB_HEALTH | ok | 健康（见下面的格式说明） | 是 |
| DRILL_DIR | absent | absent | 是 |
| DRILL_UNIT | inactive | absent 或 inactive | 是 |
| 最后一行 | STATUS_DONE=1 | STATUS_DONE=1 | 是 |

线上库的账号和文档数与演练前一致（1 个账号、2 份文档，都在测试约定之内），线上服务没有停、没有重启（演练后 UPTIME_S=416779，约 4 天 19 小时，与 11 月 12 日那次重启之后连续运行一致）。

## Deviations from Plan

**1. [格式说明] `PB_HEALTH=ok`，不是计划写的 `PB_HEALTH=200`。** 这是 `00-status.sh` 实际输出的格式，含义与计划要求一致（健康）；与 13-12 里记录的相同，不改脚本。同理 `PB_ENV_MODE=root:pocketbase 640` 的写法也与计划略有不同。

**2. [工具限制] Bash 超时设为 600000 毫秒，不是计划里的 900000。** 工具的上限就是 600000；实际运行只用了约 9 秒，没有影响。

**3. [流程] 所有者的最终确认是在 18:40–19:20 UTC 拒绝窗内给出的，演练在窗外运行。** 编排器已告诉所有者只会在 19:20 UTC 之后运行，并等到 19:21 UTC 才派发；实际运行是 19:23 UTC，`DRILL_WINDOW_OK=yes`。

除此之外没有对服务器做任何改动：只有这一次演练运行（`sudo -n /usr/local/sbin/usj-restore-drill`）和只读的 `00-status.sh`；没有登录后台，没有下载任何备份，没有重跑，没有读取密钥或邮箱地址。

## 下一步与未完成的事

- **OPS-01：** 只记录进展，不在这里标记完成；由编排器在 13-14 之后决定。按计划的成功标准，每日自动备份到 R2 和一次恢复演练通过都已成立（R2 里 5 份自动备份、演练 PASS）。
- **R2 里没有残留的 `drill_` 演练备份：** 由 `DRILL_R2_DELETE=ok` 证明；按计划，所有者在 Phase 16（原 13-15）整体验收时再去 R2 控制台看一眼确认没有 `drill_` 文件。
- **30 天保留：** `cronMaxKeep=30`，第 31 份（约 2026-12-14）时才会第一次清理，本阶段内看不到；靠 `DRILL_R2_DELETE=ok` 的实测和可选的 35 天生命周期规则兜底，事后回看 R2 即可。
- **真实数据导入：** 演练守卫要求线上库里只有测试账号，所以这次演练必须在 Phase 16（原 13-15）的真实数据导入之前完成——现在已经完成；导入之后再做演练会被守卫拒绝（`DRILL_GUARD=refused`）。
- **没有登录后台或应用：** 没有读取密钥、邮箱地址、验证码或备份。

## Known Stubs

None。

## Threat Flags

None（没有新增代码或网络面）。

## Self-Check: PASSED

- 提交 24fad7f（演练前的即时确认记录）在 main 上；它在演练运行之前提交。
- 计划账本 `gsd-plan-head-before-13-13` = 94e5b92e9a696f5e3e18232aa4f52132aef423c5。
- 演练只运行了一次（19:23:13Z 开始，19:23:22Z 结束）；输出 18 行全是 `DRILL_` 键，最后一行 `DRILL_RESULT=PASS`；`redact.mjs --check` 对演练输出和演练后状态都通过。
- 演练后状态：DRILL_DIR=absent、DRILL_UNIT=inactive、PB_SERVICE_ACTIVE=active、PB_HEALTH=ok、STATUS_DONE=1。
