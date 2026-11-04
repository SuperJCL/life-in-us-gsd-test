---
phase: 05-timeline-import-narrow
fixed_at: 2026-11-03T00:00:00Z
review_path: .planning/phases/05-timeline-import-narrow/05-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/05-timeline-import-narrow/05-REVIEW.md
**Iteration:** 2

**Summary:**
- 范围内发现：1（WR-01；9 条 INFO 不在 critical_warning 范围内）
- 已修复：1
- 已跳过：0

## Fixed Issues

### WR-01: 窄屏滚动用例的终态条件 `|| atBottom` 在这个页面上过宽

**Files modified:** `tests/e2e/narrow/narrow.spec.ts`, `.planning/phases/05-timeline-import-narrow/05-03-SUMMARY.md`
**Commit:** 7074ac5
**Applied fix:** 采用审查给出的最小改法，没有改页面 DOM 或布局，也没有动 `us-journey-tracker.html`。
- 终态读回改为只读数字：`compTop`、`compBottom`、`innerHeight`、`scrollY`、`scrollHeight`、`atBottom`。
- 通过条件拆成两支：`atTop`（`|compTop| <= 2`，能锁定 `block:"start"`）；或 `atBottom` 加 `compTop >= -2 && compTop < innerHeight`（页面已到底，且 composer 顶部在视口内）。
- 注释和 05-03-SUMMARY 的用例描述如实写明：第二支不区分 `block` 取值（`"nearest"` 或 `"end"` 在这里同样会停在页面底部），已知弱点，本用例不通过改页面来消除。
- 实际走了哪一支，只以数字写进 `test.info().annotations`（类型 `scroll-end`），失败信息里也只有数字，不含页面文字。

**逻辑类修复，需人工确认：** fixed: requires human verification。条件改动是语义变化，语法检查和用例通过都不能证明它的强度。

## 验证

- 验证位置：主工作区（`workflow.use_worktrees=false`，没有创建 worktree）。
- 只跑了窄屏 spec 一次，低优先级、单 worker：4 条全部通过。
- `check-report.mjs`：`REPORT OK expected=4 flaky=0 unexpected=0`。
- 本次运行实际走的是 `atBottom` 分支，数字为 compTop,compBottom,innerHeight,scrollY,scrollHeight = 449,793,900,948,1848。页面已滚到底，composer 整体在视口内。所以这一次运行**没有**锁定 `block:"start"`，与审查的判断一致：这条用例证明的是“选日后页面滚到 composer 并在视口内”，不是 `block` 取值。
- `us-journey-tracker.html` 的 sha256 与基线 `2a954fd0…8a1872` 一致。
- 提交前 `privacy-check.mjs --staged` 通过（2 个文件）。

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
