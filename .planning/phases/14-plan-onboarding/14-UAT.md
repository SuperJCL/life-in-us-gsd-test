---
status: complete
phase: 14-plan-onboarding
source: [14-VERIFICATION.md]
started: 2026-11-13T07:50:00Z
updated: 2026-11-13T07:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. 375 px 底部面板：打开「从示例里挑」，11 行加两个图例时列表可以滚动，最后一行不被底部按钮盖住，底部按钮在 iOS 安全区之上
expected: 面板贴底；列表在固定的页眉和页脚之间滚动，滚到底时最后一行完整可见；按钮不压在 Home 指示条上
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 2. 浅色和深色主题下，挑选列表的选中行（--s 底加 --ink 文字）、复选框对勾和焦点环是否清楚，类别色没有被拿来当文字底色
expected: 两种主题下选中态和焦点环都一眼能看清，文字对比度足够
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 3. 手机宽度下的长 toast：「已加到草稿：3 个目标组、2 个力量项，点「保存计划」后生效」和「已加入 …，计划已保存」
expected: 两条 toast 都完整显示，需要时换行，不被截断
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

### 4. 所有者通读本阶段的新文案，并看一眼深色主题的整体清晰度
新文案包括：
- 空计划卡片的「自己建一份」「从示例里挑」和正文；
- 本周页的空计划提示；
- 挑选对话框的标题、说明和提示行，含 `T_PK_INVALID`；
- 同名标记和名额说明；
- 断网和过期时的两句说明；
- 冲突框的四行和三个按钮，以及「用新版」之后的提示；
- 编辑页「从示例添加」那一行和它的说明。

expected: 读起来清楚，所有者同意或给出修改意见。不同意的记为问题，交给后续修复
result: skipped
reason: "Deferred follow-up: 所有者 2026-11-12 决定：各阶段不再单独验收，全部完成并部署到服务器后由所有者做总体验收（Phase 16 的总体验收）"

## Summary

total: 4
passed: 0
issues: 0
pending: 0
skipped: 4
blocked: 0

## Gaps

None. 14-VERIFICATION.md 写明：除上面 4 项推迟的人工检查外全部通过，没有缺口。

## Deferred Follow-Ups

```yaml
- test: 1
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 2
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 3
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
- test: 4
  idea: "所有者 2026-11-12：我后续都不参与验收，到时候总体完成并部署到服务器上以后我再来做总体的验收"
  deferred_at: 2026-11-12
```
