---
phase: 04-calendar-goals
fixed_at: 2026-11-03T00:00:00Z
review_path: .planning/phases/04-calendar-goals/04-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/04-calendar-goals/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5（fix_scope 为 critical_warning，IN-01 到 IN-04 不在范围内）
- Fixed: 5
- Skipped: 0

## Fixed Issues

### WR-01: 撤销 toast 的“5 秒”从未被钉住

**Files modified:** `tests/e2e/calendar/day-panel.spec.ts`
**Commit:** 34c090d
**Applied fix:** 过期用例在 t=1000 保存之后，不再一次推 5000 ms，而是分段推进：t=1900 仍带撤销按钮（排除与普通 toast 相同的 1800 ms），t=4900 仍带撤销按钮，t=5100 toast 已消失。仍使用手动时钟，没有固定等待。

### WR-02: N1 对照用例没有排除“标签往返本身清草稿”

**Files modified:** `tests/e2e/goals/known-bugs.spec.ts`
**Commit:** 3986b1d
**Applied fix:** 在 N1 对照用例里、触发之前加一段基线：只做“切到目标页再切回本周”，不勾选，断言草稿仍在。对照和标记两条用例保持分开；标记用例未改动，仍然只在“勾选后草稿还在”这一条期望上预期失败（定向运行结果为 2 passed，其中标记用例按预期失败）。登记表标题没变，`tests/KNOWN-BUGS.md` 与登记表守卫无需改动。

### WR-03: `check-report.mjs` 对跳过、过滤、中断的用例没有设防

**Files modified:** `tools/test-report/check-report.mjs`, `tests/README.md`
**Commit:** e139323
**Applied fix:** 仍只用 node: 内置模块，原有 `<报告> [标题 …]` 用法保持兼容。新增判定：
- 任何 skipped 的 test 必须带 known-bug 注解，不再依赖是否列了标题；`stats.skipped` 超过带注解的 skipped 数量也判失败（覆盖被过滤或被中断、报告里没有对应 test 的情况）；
- 新增可选参数 `--min-expected N`（也接受 `--min-expected=N`），全量运行用它固定“至少跑了 N 条”；参数不合法时失败；
- 没有 test 的 spec、同一标题一部分通过一部分没通过，判失败；缺 `stats` 或 `errors` 不是数组也判失败。

`--self-test` 从 10 个用例扩到 22 个，每个新增的拒绝路径都有反向用例：无标题时 skipped 无注解、`stats.skipped` 偏大、`--min-expected` 过高、同标题一过一败、空 `tests` 的 spec（含列出标题的情况）、缺少 `tests` 字段、缺 `stats`、`errors` 非数组，并各配一个应当通过的对照。`tests/README.md` 的对应说明同步更新。

### WR-04: `expectedCategory` 用 `in` 判断旧类别

**Files modified:** `tests/support/expect-from-fixture.ts`
**Commit:** b53ef57
**Applied fix:** 改为 `Object.prototype.hasOwnProperty.call(legacy, cat)`，原型链上的键（`constructor`、`toString`、`__proto__` 等）现在落到“其他”。该文件实际是 LF 行尾（不是任务说明里预期的 CRLF），已保持原状。

### WR-05: chip 类别类只证明两处互相一致

**Files modified:** `tests/e2e/calendar/grid.spec.ts`
**Commit:** 4879429
**Applied fix:** 在原有“格子与日面板一致”断言之后，对今天的记录两两比较：类别类的等价关系必须与 fixture 的类别分组（经 `expectedCategory`）一致，格子和日面板各检查一次。没有写任何类名字面量或类别文字，失败消息是固定的中文说明。该断言需要逻辑核对，见下。

## Verification

**运行位置：** 全部在主工作树里运行（`workflow.use_worktrees` 为 false，没有创建 worktree）。

- 全量套件（below-normal 优先级，1 个 worker，仅一次，带 `PW_JSON_REPORT`）：132 passed（2.8 分钟），退出码 0。
- `node tools/test-report/check-report.mjs test-results/review-fix-04.json --min-expected 132`：`REPORT OK expected=132 flaky=0 unexpected=0`。
- `node tools/test-report/check-report.mjs --self-test`：`SELF-TEST OK`。
- `node tools/privacy/privacy-check.mjs --all`：隐私检查通过（138 个文件）。
- `us-journey-tracker.html` 的 sha256 未变：`2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`。
- 项目没有 `tsc` 或 typecheck 脚本，TypeScript 文件只做了重读加相关 spec 的实际运行（Tier 1 加运行验证）。

**fixed: requires human verification：** WR-05 属于断言逻辑（类别分组与类名等价关系的映射），WR-03 属于判定逻辑；两者通过了运行和自检，但建议人工确认语义。WR-05 依赖“今天的三条记录类别互不相同”这一 fixture 事实（来自评审说明），若将来 fixture 变更，断言仍成立但强度会变化。

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
