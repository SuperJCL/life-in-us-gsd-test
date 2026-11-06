---
phase: 02-account-mock-data-export
fixed_at: 2026-11-03T00:00:00Z
review_path: .planning/phases/02-account-mock-data-export/02-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/02-account-mock-data-export/02-REVIEW.md
**Iteration:** 3（最后一轮）

**Summary:**
- Findings in scope: 1（WR-01；fix_scope 为 critical_warning）
- Fixed: 1
- Skipped: 0
- 另外顺手处理了范围外的 IN-07（csvMismatch 兜底分支用例），见下文

## 前两轮历史

- 第 1 轮（备份在 `02-REVIEW-FIX.iter2.md`）：处理第 1 次复审的 WR-01 到 WR-05。
- 第 2 轮（备份在 `02-REVIEW-FIX.iter3.md`）：处理第 2 次复审的 WR-01（导出断言泄漏内置任务文字）和 IN-07（脱敏逻辑的常驻反向对照，即 `csv-masking.spec.ts`）。
- 第 3 轮（本报告）：处理第 3 次复审的 WR-01。下面的编号都指本轮复审。

## Fixed Issues

### WR-01: 目标视图断言失败时，Playwright 的元素预览会把内置任务文字和力量项目备注打印出来

**Files modified:** `tests/e2e/data/synthetic-data.spec.ts`
**Commit:** 75fe18d
**Applied fix:**
- 已完成任务的断言：把 `toBeChecked()` 改成 `page.locator('#goals [data-task="ID"]:checked')` 加 `toHaveCount(1)`。失败日志里只有元素个数，不再有复选框的 `aria-label`（内置任务文字）。
- 力量项目历史行：把 `toContainText(LIFT_HISTORY_PREFIX)` 改成 `expect.poll` 在 Node 侧读 `textContent` 并判断 `startsWith(LIFT_HISTORY_PREFIX)`，再 `toBe(true)`。失败消息只写“内容已隐藏”，不会带出备注全文。
- 加了中文注释说明原因（D-14）。

**对 `tests/e2e/` 其余 spec 的审计：** 没有发现同类问题，没有改动。
- 个人计划文字（内置任务文字、力量项目名称和备注）只在使用 `full-state.json` 的页面里才会渲染，而这份 fixture 只用于 `synthetic-data.spec.ts` 和 `export.spec.ts`。
- `synthetic-data.spec.ts` 其余断言：作用的元素要么只含合成文字（记录条目、`#review`、预设标签、自定义待办的 `aria-label`），要么属性是固定文案（`.od`、`[data-due]`、`#lf-*` 数字输入框），要么是 `toHaveCount`。
- `export.spec.ts` 的 toast 断言文字固定；第 57 行 `getAttribute('aria-label')` 的 `toBeTruthy()` 只在值为 `null` 时失败，不会打印任务文字。上一轮已把 CSV 正文相关断言都改成布尔值。
- 其余 spec（`smoke`、`account-mode`、`environment`、`guardrails`、`probes`、`mock-contract`、`app-integrity`、`repo-hygiene`、`csv-masking`）只用 `local-seed.json`、合成种子或空状态，页面上没有个人计划文字。

### IN-07（范围外，可选项，已做）: csvMismatch 的兜底分支没有用例

**Files modified:** `tests/e2e/platform/csv-masking.spec.ts`
**Commit:** 1cfc02f
**Applied fix:**
- 新增用例 `IO-02 csvMismatch still reports a difference that hides entirely inside masked task text`：期望把任务文字里的双引号写成两个，实际只写一个，`maskTaskTexts` 把两种写法换成同一个占位符，脱敏后两边相同，必须由兜底分支返回非空诊断。用例先断言两份 CSV 原始不同、脱敏后相同（前置条件），再断言诊断非空且不含任务文字。只用合成文字。
- 第 5 条用例改名为 `IO-02 csvMismatch still reports a difference that sits right after masked task text`，注释改成它实际验证的内容。

## Skipped Issues

None。

## 验证

- 验证环境：主工作区（`workflow.use_worktrees` 为 `false`，没有创建 worktree），可以直接复现。
- `npm test`：64 条全部通过，0 flaky（上一轮是 63 条，本轮新增 1 条）。
- `node tools/privacy/privacy-check.mjs --all`：通过（85 个文件）。
- `us-journey-tracker.html` 的 sha256 仍是 `2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`，没有被改动、暂存或提交。
- 两个提交都只按路径暂存了对应的一个文件；没有暂存 `.agents/`、`.codex/`、`AGENTS.md`、`.planning/state.json` 和任何 `*.iter*.md` 备份。改动的文件保持 LF 行尾，扫描过没有多余控制字符。
- 逻辑上的说明：两处断言改动只改变失败时打印的内容，不改变通过条件，所以没有标 “requires human verification”。

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
