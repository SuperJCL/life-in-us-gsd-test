---
phase: 16-release-acceptance
plan: 07
subsystem: acceptance
tags: [acceptance, checklist, owner-decision, d-20]
requires:
  - phase: 16-06
    provides: 16-ACCEPTANCE.md 已按 D-19 填写，J 只等 E-5
provides:
  - 16-ACCEPTANCE.md 的 E-5、J、K 已填写：E-5 通过（所有者确认换版），J-1 到 J-7、K-1 到 K-3 按 D-20 不适用，J-0 通过
  - 16-CONTEXT.md 新增 D-20（先不迁移旧数据，J、K、L 都先不做，阶段现在收尾）
affects: [16-08]
tech-stack:
  added: []
  patterns: [所有者决定覆盖计划时新增一条 D-xx 并逐项落到清单]
key-files:
  created: []
  modified:
    - .planning/phases/16-release-acceptance/16-ACCEPTANCE.md
    - .planning/phases/16-release-acceptance/16-CONTEXT.md
key-decisions:
  - "D-20：所有者 2026-11-22 决定先不迁移旧数据，只轻量试用；J、K 不做，导入后恢复演练也先不做，Phase 16 现在收尾"
requirements-completed: []
metrics:
  duration: 约 20 分钟（不含等待所有者）
  completed: 2026-11-22
status: complete
actuals:
  tokens: 15000
  tasks: 2
  commits: 1
plan_head_before: 208e1da7eaed76f47ba0359c1b290591ba27c20a
---

# Phase 16 Plan 07: 迁移真实数据和收尾（按 D-20 不做） Summary

**所有者 2026-11-22 决定先不迁移旧数据，只轻量试用这个记录系统（D-20）。J-1 到 J-7、K-1 到 K-3 记为「不适用」，J-0（合成数据的迁移用例）通过。E-5 记为通过：所有者确认每台设备都已换成新版本。**

## 完成情况

| 任务 | 结果 |
|------|------|
| Task 1：所有者做 J、K 并回报（blocking-human） | 不适用：所有者原话"我觉得这个可以先不做，我们就是轻量的试用一下这个记录系统" |
| Task 2：把 J、K 的结论填进清单，只读状态确认线上只剩真实账号 | 按 D-20 填写，每一项都有结论。没有另跑只读状态，用的是 2026-11-22 quick 261121-uax 上线前后的两次结果（见下） |

## 线上现状

2026-11-22 quick 261121-uax 上线前后各跑了一次只读状态，输出都经过 redact：

- `DB_USERS_COUNT=1`、`DB_USERS_NONTEST=1`：线上已经没有测试账号，只剩一个非测试账号。
- 上线时 PocketBase 一直在运行。

K-1 的结论里写了这一条。所有者没有回报做过 K，所以 K-1 仍然记为「不适用」，不写「通过」。

## Deviations from Plan

**1. [所有者决定] J、K 不做（D-20）**
- **计划写的：** 所有者迁移旧数据、删除测试账号，回报 J-1 到 J-7、K-1 到 K-3 的结论；Task 2 的第二条 verify 要求 J-1、J-3 到 J-7、K-1 都是「通过」。
- **实际做的：** 所有者决定先不迁移。这些项都记为「不适用（所有者 2026-11-22 决定先不做，D-20）」。第二条 verify 按设计不成立，由 D-20 覆盖。
- **影响：** 正式账号里没有旧数据。旧数据仍在所有者自己的旧备份里，原 Artifact 不动，以后可以按 J、K 节补做。

**2. E-5 在安全核对时确认**
- E-5 原本是 J 的前提，所有者一开始没有单独回报。
- 做安全核对时问到 T-16-24（旧页面保存会冲掉训练数据），所有者 2026-11-22 确认每台设备、每个标签页都能看到「健身」标签和 kg/lb 开关，E-5 据此记为通过。

## Known Stubs

无。

## Threat Flags

无新增。本计划没有碰服务器，也没有读取任何真实数据。

## 下一步

16-08 按 D-20 不跑演练，只填 L 节和总体结论，再跑两条全量套件，然后收口 OPS-04、TEST-02。

## Self-Check: PASSED

- 16-ACCEPTANCE.md 的 J、K 两节没有空的「结论：」行，每一项都以「通过」或「不适用」开头。
- 清单里没有网址、账号、邮箱和真实内容。
