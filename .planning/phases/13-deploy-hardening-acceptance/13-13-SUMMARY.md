---
phase: 13-deploy-hardening-acceptance
plan: 13
subsystem: restore-drill
tags: [deploy, pocketbase, r2-backup, restore-drill, ops-01]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-12 的结果（后台加固、R2 备份已连通、一次真重启后全部自己回来）
provides:
  - 恢复演练前的只读前置检查和即时确认记录

affects: [13-14]

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-13-SUMMARY.md
  modified: []

requirements-completed: []

status: in-progress
---

# Phase 13 Plan 13: 恢复演练 Summary

（进行中：本节之后的演练结果在演练运行后补全。）

## 即时确认（恢复演练）

- 确认日期：2026-11-17；演练在 19:20 UTC 之后运行（所有者在 19:00 UTC 左右、拒绝窗内给出确认，编排器告知所有者只会在 19:20 UTC 之后运行，并等到 19:21 UTC 才派发执行）。
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
