---
phase: 16-release-acceptance
plan: 06
subsystem: acceptance
tags: [acceptance, checklist, owner-decision, d-19]
requires:
  - phase: 16-05
    provides: 修复版本 84d1fc754072 已上线，新恢复演练脚本已装到服务器
provides:
  - 16-ACCEPTANCE.md 已按 D-19 填写：J 之前的检查记为不适用，A0 前置报告和 J-0 通过
  - J 可以开始的前提已明确：所有者确认 E-5（所有设备换成新版本）
affects: [16-07, 16-08]
tech-stack:
  added: []
  patterns: [所有者决定覆盖计划时记为 D-19 并逐项落到清单]
key-files:
  created: []
  modified:
    - .planning/phases/16-release-acceptance/16-ACCEPTANCE.md
key-decisions:
  - "D-19：所有者 2026-11-18 决定不做总体验收；E-5 保留为 J 的前提，J、K、次日演练、全量套件照常"
requirements-completed: []
metrics:
  duration: 约 40 分钟（Task 1 和本次收尾，不含等待所有者）
  completed: 2026-11-18
status: complete
actuals:
  tokens: 12000
  tasks: 3
  commits: 1
plan_head_before: b1a31ff0b4f38163c52f58abf5a2e067304f7961
plan_head_after: 4273a88e15967751a84b53d252e5ee560268d483
---

# Phase 16 Plan 06: 总体验收（按 D-19 收口） Summary

**所有者决定跳过总体验收（D-19），16-ACCEPTANCE.md 里 J 之前的检查项全部记为「不适用」，A0 前置报告和 J-0（合成文件跑 IO-09 三条）通过；J 只等所有者确认 E-5（所有设备换成新版本）。**

`commits: 1` 是用 git 实测的数（`b1a31ff..4273a88`）：只有填写 16-ACCEPTANCE.md 的那一次提交；本 SUMMARY 和 STATE/ROADMAP 的提交在它之后。Task 1 没有改仓库文件。

## 完成情况

- **Task 1（tracer，只读，已完成）：** 只读状态 `SITE_VERSION=84d1fc754072`、`PB_SERVICE_ACTIVE=active`、`DRILL_TOOL=present`、`DRILL_DIR=absent`、`UPLOAD_DIRS=0`、`DB_USERS_NONTEST=0`、`STATUS_DONE=1`（输出都经脱敏，`--check` 干净）；HTTPS 基线 `VERIFY OK`（3 项）；合成文件 `private/acceptance/synth-large.json`（3307555 字节）和 `synth-backstop.json`（52254 字节）已生成，都被 git 忽略；D-12 范围内的 cloud 用例 `tests/cloud/migration.spec.ts tests/cloud/import.spec.ts -g "IO-09"` 报告 `REPORT OK expected=3 flaky=0 unexpected=0`，三条 IO-09 标题都在，含健身页「全部」范围里旧力量历史是空心点的断言。本次接手时又用 `node tools/test-report/check-report.mjs test-results/16-06-mig.json` 复核，仍是 `REPORT OK expected=3`。
- **Task 2（checkpoint:human-action，blocking-human）：** 没有按原计划做。所有者 2026-11-18 回复"我决定不做测试"，并选择"只跳过验收，照常上线"，记为 CONTEXT 决定 D-19（commit b1a31ff）。
- **Task 3（已按 D-19 调整）：** 填写 `16-ACCEPTANCE.md`：
  - A0-1 到 A0-6：「通过」，依据 16-05-SUMMARY（`VERIFY OK (19 checks)`、`DRILL_TOOL=installed`、演练脚本 sha256 与批准清单一致）、13-12-SUMMARY（真重启、邮件、两步验证、R2、第一个测试账号）、13-13-SUMMARY（`DRILL_RESULT=PASS`）。备注写明这是 Claude 核对过的报告，所有者没有另行确认。
  - A0-7：「不适用」（没有建第二个测试账号）；A0-8：「通过」（已生成，验收跳过未使用）。
  - E-1 到 E-4、E-6：「不适用」；**E-5 留空**，E 节结论写明"E-5 由所有者在 J 之前确认（16-07，D-19）"。
  - A、B、C、H-2、D、N、W、G、H、F、I 所有项：「不适用（所有者 2026-11-18 决定跳过验收，D-19）」，各节结论同一句话。
  - J-0：「通过」，写入 D-12 结果；J 的其余项、K、L 和总体结论留给 16-07、16-08。
  - 待修复：「无。」并说明按 D-19 没有做真机检查，「无」不代表没有问题。
  - 清单开头加了一段 D-19 说明。

## J 能不能做

J 可以在所有者确认 E-5 之后开始。按 D-19，计划原来的"C-1 到 C-4、D-1、D-2 必须通过"这一条被覆盖；"E-5 通过""J-0 之后迁移相关代码没变"两条照旧要求（迁移相关代码自 16-05 上线后没有改动，`git status --porcelain -- us-journey-tracker.html deploy tests tools` 为空）。

## OPS-04 的真机部分

**没有经过真机验证，是所有者接受的风险（D-19）。** 自动化覆盖是 cloud 的 OPS-04 用例（离线冷启动、更新提示流程）和 16-04 全量运行里的 SEC-02 CSP（cloud 287 passed）。没有人确认的内容：两台真机的同步速度、断网和冷启动、添加到主屏幕（尤其 iPhone 的 7 天清理）、中国大陆网络下的打开速度，以及 Phase 10–15 推迟下来的人工检查（文案、暗色主题、375 px、读屏）。这些问题在日常使用中发现后由所有者再报。OPS-04 和 TEST-02 本计划不标完成，由 16-08 收口（按"自动化覆盖加所有者放弃真机验收"记录）。

## must_haves 的变化

| 原条目 | 状态 |
|--------|------|
| 成功标准 2：两台真机 C、D 通过 | 被 D-19 覆盖，没有做，作为接受的风险登记 |
| D-06：每台设备先做 E | 保留为安全步骤，但缩成所有者在 J 之前确认 E-5 |
| D-07、D-08：同时在场、第二个测试账号、各阶段推迟的人工项 | 被 D-19 覆盖，不做 |
| D-09：所有者按节回报 | 被 D-19 覆盖，各节由 D-19 一句话代替 |
| D-10、D-11：问题分类、挡迁移的问题停在 J 之前 | 没有问题可分类（没有做检查），不适用 |
| D-12：J 之前重跑迁移用例，三条 IO-09 通过 | 仍成立，已通过，填进 J-0 |
| 隐私：清单里没有账号、邮箱、网址和真实内容 | 仍成立，提交前隐私检查通过 |

## Deviations from Plan

**1. [Rule 1 - Bug] D-12 范围加上 `tests/cloud/import.spec.ts`**
- **Found during:** Task 1
- **Issue:** 计划的 check-report 要求 D-07 的 IO-09 标题，而它在 `import.spec.ts` 里；`migration.spec.ts` 里有两条 IO-09（STATE 已知问题 2）。只跑 migration.spec 会少一条。
- **Fix:** 范围改为 `tests/cloud/migration.spec.ts tests/cloud/import.spec.ts -g "IO-09"`，三条都通过。
- **Files modified:** 无

**2. [Owner decision D-19] Task 2 不做，Task 3 按 D-19 调整**
- 所有者决定不做总体验收；计划里"C、D 必须通过""逐项填所有者结论"的要求按 D-19 改为"不适用"，E-5 不替所有者填值。16-06-PLAN 的 Task 3 automated 校验（C-1 到 C-4、D-1、D-2 为「通过」）因此不会通过，这是 D-19 覆盖的结果，不是缺陷。

## Known Stubs

None。

## Threat Flags

None。本计划只改了一个清单文件，没有新的网络入口、认证路径或存取面；清单里没有账号、邮箱、网址和真实内容。

## 下一步

16-07：所有者先确认 E-5（所有设备、所有标签页都已换成新版本），再做 J（迁移真实数据）和 K（删除测试账号）；次日做导入后恢复演练，之后 16-08 收口。

## Self-Check: PASSED

- 16-ACCEPTANCE.md 存在，A0 到 J-0 已填，E-5 按设计留空，待修复已写。
- 提交 4273a88 在当前 HEAD 的历史里。
