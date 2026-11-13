---
phase: 14-plan-onboarding
reviewed: 2026-11-12T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - us-journey-tracker.html
  - tests/cloud/plan-onboarding.spec.ts
  - tests/support/plan-picker.ts
  - tests/cloud/login.spec.ts
  - tests/cloud/plan-editor-archive.spec.ts
  - tests/cloud/import.spec.ts
  - tests/cloud/import-sync.spec.ts
  - tests/cloud/import-undo.spec.ts
  - tests/e2e/data/plan-normalize.spec.ts
  - tests/support/strings.ts
  - tests/support/constants.ts
  - tests/README.md
findings:
  critical: 1
  warning: 1
  info: 1
  total: 3
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-11-12
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

本次是静态审查，没有运行测试。范围是 `git diff 784c9e1..HEAD` 里 Phase 14 的改动：`emptyPlan`、`resolve()` 首次建档分支、`pickSample`、`planUsedIds`、`planCommit`、`planSavedToast`、`savePlanDraft` 改用 `planCommit`、`openSamplePicker` 和 `pk*` 系列函数、`dialog#sample` 的标记和 CSS、`resetSession` 的改动、空计划卡片、编辑页 `.pe-tools` 行，以及相关测试。

做过核对、没有发现问题的地方：

- 新增模板里的用户文字和示例 id 都过了 `esc()`，新增 CSS 和模板没有内联 style 属性（CSP `style-src-attr 'none'`）。
- `APP_SHA256` 基线（`tests/support/constants.ts:38`）与当前 `us-journey-tracker.html` 的 sha256 一致。
- `savePlanDraft` 改用 `planCommit` 之后，容量超限、读不出来的计划留底、覆盖留底、按 id 差集清理 state 这几条路径与改动前逐段对得上。
- `tests/README.md` 写的「18 条用例」与 `plan-onboarding.spec.ts` 里的用例数一致。
- 首次建档只在没有服务器文档且没有本机缓存时用空计划（D-01），其余分支行为没变。

主要问题是一个会让编辑页「从示例添加」的确认按钮永久失效的状态泄漏（CR-01），现有 18 条用例都没有覆盖到它。

## Critical Issues

### CR-01: 保存成功或选「用新版」后，挑选对话框的确认和取消按钮一直是 disabled

**File:** `us-journey-tracker.html:3101-3107`（`pkBusy`），`3130`（`pkBusy(true)`），`3144`、`3162`（`pkDlg.close()`），`3044-3058`（`openSamplePicker`），`3171-3176`（`close` 监听）
**Issue:** `pkSave` 一开始调用 `pkBusy(true)`，它给 `#pkOk` 和 `#pkCancel` 设 `disabled=true`，并给 `#pkOk` 设 `aria-busy`、文字改成「保存中…」。`#pkOk`、`#pkCancel` 是 `dialog#sample` 里的静态节点，不会随对话框重建。`pkBusy(false)` 只在三条失败或回去继续挑的路径里被调用（`3139`、`3156`、`3158`）。保存成功（`3162`）和三选一选「放弃我的选择，用新版」（`3144`）这两条路径直接 `pkDlg.close()`，没有恢复。`close` 监听也不恢复，`openSamplePicker` 重新打开时只重设了 `textContent`，没有重设 `disabled`、`aria-busy`。

后果：

- 从空计划卡片挑选并保存成功后，计划已经不空。用户进「编辑计划」点「从示例添加」（`#peSampleBtn`），对话框里的「添加所选项」是 `disabled`，点了没反应，「先不添加」也是 `disabled`。只能用 Esc 或点遮罩关闭。这是 14-03 的功能，在同一个页面会话里先用过卡片入口就用不了。
- 选「放弃我的选择，用新版」之后，如果对方的计划仍然为空，卡片入口再次打开同样卡死。
- 保存过程中被 `resetSession` 关掉（别的标签页退出登录，`2017`）也会留下 `disabled`。同一个页面里再次登录后，两个模式的确认按钮都是坏的，要刷新页面才恢复。

现有 18 条用例都没有「保存成功后再次打开对话框」的步骤（`plan-onboarding.spec.ts` 里的第 826 行用例只覆盖取消后重新打开），所以没有被发现。

**Fix:** 在 `openSamplePicker` 里（`pkRender()` 之前）统一恢复按钮状态，保证每次打开都是干净的，不依赖各条关闭路径：

```js
// openSamplePicker 里，pk={...} 赋值之后、pkRender() 之前
const ok=$("pkOk"),c=$("pkCancel");ok.disabled=false;c.disabled=false;ok.removeAttribute("aria-busy");
$("pkOk").textContent=pkOkText();$("pkCancel").textContent=T_PK_CANCEL;
```

同时建议在 `close` 监听里也调用 `pkBusy(false)`（放在 `pk=null` 之前），这样 `resetSession` 路径关闭对话框时也不留脏状态。另外给 `plan-onboarding.spec.ts` 补一条用例：从卡片保存成功后进编辑页，打开「从示例添加」，断言 `readPicker` 的 `okDisabled`、`cancelDisabled`、`okBusy` 都为 false，勾一项后能添加到草稿。再补一条覆盖「用新版」后再次打开。

## Warnings

### WR-01: 测试缺口——对话框状态只测了「取消后重新打开」，没测「保存后重新打开」

**File:** `tests/cloud/plan-onboarding.spec.ts:826-892`，`tests/support/plan-picker.ts:34-37`
**Issue:** `readPicker` 已经读回了 `okDisabled`、`okBusy`、`cancelDisabled`，但整个 spec 里没有一处在保存成功或选 `mid` 之后重新打开对话框再读这些字段，导致 CR-01 能带着 18 条全绿的用例交付。`PLAN-07 ... opens unchecked again` 那条只走取消、Esc、点遮罩，这些路径不经过 `pkBusy(true)`。
**Fix:** 见 CR-01 的补用例建议。至少让第 78 行用例（卡片挑选并保存）在末尾进编辑页打开 `openPickerFromEditor`，并断言 `okDisabled === false`、`cancelDisabled === false`、`okBusy === false`。

## Info

### IN-01: 容量超限的提示在取消勾选后不会消失

**File:** `us-journey-tracker.html:3092-3100`（`pkHint`），`3128`、`3158`（`s.tooLarge`）
**Issue:** `pk.tooLarge` 在一次因超限失败之后一直为真，`pkHint` 里它的优先级高于「已选…」，用户取消几项勾选、实际已经能存下之后，提示行仍然写「保存失败：计划超过容量上限」。确认按钮并没有被挡住，再点一次能保存，只是提示在说假话。
**Fix:** 在 `$("pk-body")` 的 `change` 监听里，勾选变化时先 `if(pk)pk.tooLarge=false;` 再调用 `pkHint()`（同时 `pk.tooLarge` 为真时的横幅由 close 监听里的 `peClearTooLarge()` 收起，行为不变）。

---

_Reviewed: 2026-11-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
