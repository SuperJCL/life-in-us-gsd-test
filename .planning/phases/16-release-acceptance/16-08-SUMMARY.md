---
phase: 16-release-acceptance
plan: 08
subsystem: acceptance
tags: [acceptance, regression, owner-decision, d-20]
requires:
  - phase: 16-07
    provides: J、K 按 D-20 记为不适用，E-5 通过
provides:
  - 16-ACCEPTANCE.md 的 L 节和总体结论已填写，每一项都有结论
  - 两条全量套件通过（cloud 288、默认 247），OPS-04、TEST-02 收口
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/phases/16-release-acceptance/16-ACCEPTANCE.md
    - .planning/REQUIREMENTS.md
key-decisions:
  - "D-20：导入后恢复演练也先不做，L-1 到 L-3 不适用；以后迁移了旧数据再补做"
requirements-completed: [OPS-04, TEST-02]
metrics:
  duration: 约 40 分钟（两条全量套件在后台跑，不含等待）
  completed: 2026-11-22
status: complete
actuals:
  tokens: 20000
  tasks: 3
  commits: 1
plan_head_before: 2801351
---

# Phase 16 Plan 08: 次日回看、导入后演练和收口（演练按 D-20 不做） Summary

**所有者 2026-11-22 选择导入后恢复演练也先不做（D-20），L-1 到 L-3 记为「不适用」，总体结论已填写。两条全量套件在 HEAD 208e1da 的代码上通过：cloud 288 条、默认 247 条，flaky 0、unexpected 0。OPS-04、TEST-02 收口。**

## 完成情况

| 任务 | 结果 |
|------|------|
| Task 1：tracer（只读），写好演练命令原文 | 不适用（D-20）：没有连服务器，也没有写演练命令 |
| Task 2：所有者回报 L-1，当场确认演练命令 | 不适用（D-20） |
| Task 3：运行演练 → 只读状态 → 填完清单 → 两条全量套件 | 演练和演练后的只读状态没有做。清单已填完，两条全量套件通过，需求表已更新 |

## 全量套件

都按项目约束运行：低优先级、1 个 worker、不并发，先跑 cloud 再跑默认，测试全程不连接真实服务器。

| 套件 | 命令 | 结果 | check-report 的关键用例 |
|------|------|------|------------------------|
| cloud | `npm run test:cloud`（配置自带 `--workers=1`） | `REPORT OK expected=288 flaky=0 unexpected=0` | SEC-02 CSP、OPS-04 离线冷启动、OPS-04 更新先确认、OPS-04 IN-02 兜底刷新、SYNC-01、IO-09 合成迁移，都在而且通过（`--min-expected 287`） |
| 默认 | `npm test -- --workers=1` | `REPORT OK expected=247 flaky=0 unexpected=0` | SAFE-02 基线、OPS-03 上传包、OPS-03 部署工具自检、ENV-03 版本开关、BUG-01 已知问题登记，都在而且通过（`--min-expected 247`） |

跑测试的这段时间里，提交的只有 `.planning/` 下的文档，应用、deploy、tests、tools 都没有改动。所以测过的就是线上 f99fb5fa3d7d 这一版用的代码。

## 需求表

- `- [x] **OPS-04**`、`- [x] **TEST-02**`。
- 追踪表：`| OPS-04 | Phase 16 | Complete |`；`| TEST-02 | Phase 16 | Complete |`，原来写的是 Phase 8，实际在本阶段收口。
- Last updated 一行已更新。
- OPS-04 按"自动化覆盖 + 所有者放弃真机验收"标为完成（D-19）。真机上的离线冷启动和添加到主屏幕都没有经过所有者确认，作为接受的风险登记在 16-CONTEXT D-19。

## Deviations from Plan

**1. [所有者决定] 导入后恢复演练不做（D-20）**
- **计划写的：** 等删完测试账号后的第一次 19:00 UTC 自动备份，所有者当场确认后运行 `sudo usj-restore-drill --with-real-data`，结果要 `DRILL_RESULT=PASS`。
- **实际做的：** 所有者选择"也先不做，现在收尾"，Task 1 和 Task 2 没有做，Task 3 的第一条 verify 也不成立，都由 D-20 覆盖。
- **影响：** 含真实数据的备份没有在真实数据上演练过恢复（D-20 新增的接受风险）。现在的保障有两条：13-13 的只测模式演练（`DRILL_RESULT=PASS`），以及每天的自动备份和失败邮件。

**2. 总体结论的写法**
- 计划要求写"J 计数一致、K 已完成、导入后演练通过、OPS-04 的真机部分通过"。实际按 D-19、D-20 如实写成「不适用」或「没有做」，没有写成通过。

## 待修复

16-ACCEPTANCE.md 的 `## 待修复` 仍为「无」，因为按 D-19 没有做真机检查。16-REVIEW.md 的 4 个 WARNING 和 4 个 INFO 记在 16-REVIEW-DISPOSITION.md 里，目前都是 open，交给所有者决定要不要修。

## Known Stubs

无。

## Threat Flags

无新增。本计划没有连服务器，也没有读取任何真实数据。

## Self-Check: PASSED

- 16-ACCEPTANCE.md 没有空的「结论：」行，每一项都以「通过」「问题」或「不适用」开头；`## 总体结论` 不少于三行；没有网址。
- 两份报告都是 `REPORT OK`，条数不少于计划要求，关键用例都通过。
- REQUIREMENTS.md 里 OPS-04、TEST-02 都已勾选，追踪表为 `Phase 16 | Complete`。
