---
phase: 14-plan-onboarding
fixed_at: 2026-11-12T00:00:00Z
review_path: .planning/phases/14-plan-onboarding/14-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-11-12
**Source review:** .planning/phases/14-plan-onboarding/14-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3（fix_scope: all）
- Fixed: 3
- Skipped: 0

## Fixed Issues

### CR-01: 保存成功或选「用新版」后，挑选对话框的确认和取消按钮一直是 disabled

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`
**Commit:** 253f31f
**Applied fix:** 在 `openSamplePicker` 里 `pk={...}` 赋值之后、`pkRender()` 之前调用 `pkBusy(false)`（一并恢复 `disabled`、`aria-busy` 和确认按钮文字，并把 `pk.busy` 置回 false）；在 `pkDlg` 的 `close` 监听开头（`pk=null` 之前）也调用 `pkBusy(false)`，这样 `resetSession` 等任何关闭路径都不留脏状态。没有新增用户可见文案，`style="` 仍为 0。`APP_SHA256` 已重录并在同一次提交里更新，`tests/e2e/platform/app-integrity.spec.ts` 7 条通过。

### IN-01: 容量超限的提示在取消勾选后不会消失

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`
**Commit:** d8d5656
**Applied fix:** `$("pk-body")` 的 `change` 监听里，勾选变化时先 `if(pk&&pk.tooLarge){pk.tooLarge=false;peClearTooLarge()}` 再 `pkRoom();pkHint()`。和评审建议的差别：除了清 `pk.tooLarge`，同时调用 `peClearTooLarge()`。原因是 `close` 监听只在 `s.tooLarge` 为真时才收起「容量超限」横幅，如果只清标志，取消后横幅会留着；现在勾选一变化就收起横幅（容量没超时才会收起，规则同 `peClearTooLarge`），再次保存超限时 `planCommit` 会重新显示。`APP_SHA256` 已重录，app-integrity 7 条通过。

### WR-01: 测试缺口——对话框状态只测了「取消后重新打开」，没测「保存后重新打开」

**Files modified:** `tests/cloud/plan-onboarding.spec.ts`
**Commit:** a2289ed
**Applied fix:** 两处补断言，都用已有的 `readPicker` 字段 `okDisabled`、`cancelDisabled`、`okBusy`：
1. 「卡片挑选并保存」那条用例末尾：进编辑页、打开「从示例添加」，断言三个字段都为 false 且确认文字是编辑页模式的 `BTN_PK_OK_EDIT`，再勾 `g:P3` 点确认，断言添加到草稿的 toast。
2. 「用新版」那条用例末尾：新增 helper `expectReopenedPickerClean`（进编辑页、打开对话框、断言同样三个字段，再点 `#pkCancel` 确认取消按钮可点、对话框关闭）。

**验证：** 先把应用临时还原到修复前的版本，第 1 处断言按预期失败（确认和取消仍是 disabled），然后恢复修复后的应用（sha256 与基线一致，工作区除测试文件外无改动）；修复后 `tests/cloud/plan-onboarding.spec.ts` 18 条全部通过，`tests/cloud/plan-editor.spec.ts` 9 条全部通过。

## Verification

- 验证在主工作区（main checkout）里运行，`workflow.use_worktrees=false`，没有建 worktree，没有恢复标记文件。
- 只跑了定向用例：`tests/e2e/platform/app-integrity.spec.ts`（每次改应用之后）、`tests/cloud/plan-onboarding.spec.ts`、`tests/cloud/plan-editor.spec.ts`，均通过低优先级、单 worker 的方式运行。没有跑全量，留给编排器。

## 注意事项（需要人工知道）

- **`APP_SHA256` 的换行问题：** `.gitattributes` 把 `us-journey-tracker.html` 固定为 `eol=lf`，但开始时工作区里的文件是 CRLF（和 HEAD 里已提交的基线 `31165b05…` 对不上任何一种换行方式的 HEAD 内容，HEAD blob 的 LF 哈希是 `24f02d96…`）。修复过程中经过一次 `git stash`/`pop`，工作区文件变成了 LF，与 git 里的内容一致。重录的基线 `44889d57…` 是这份 LF 内容的哈希，也是干净克隆能得到的内容的哈希；`app-integrity` 在当前工作区通过。如果你的其他工具又把工作区文件转回 CRLF，该用例会失败。
- 14 个 msedge 进程存在，不确定是否属于其他会话，没有清理（本次运行的 playwright 已正常退出）。

---

_Fixed: 2026-11-12_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
