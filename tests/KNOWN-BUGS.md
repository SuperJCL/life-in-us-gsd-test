# 已知 bug 约定和登记表

本文件登记测试里已确认的应用已知 bug（BUG-01）。应用保持只读：已知 bug 只在测试侧标记和登记，不修改 `us-journey-tracker.html`。

## 约定

- **成对用例：** 每个已知 bug 是同一个 `test.describe` 里的一对用例。
  - 对照用例（不带标记）：走完全相同的准备和触发，断言前提成立（草稿确实输入了、按钮可用、触发动作确实生效）。
  - 标记用例：第一句调用 `knownBug(id, summary)`（来自 `tests/support/test.ts`），只断言一条期望的正确行为。
  - 分成两条，是因为 `test.fail` 会把同一条用例里任何原因的失败都当成“预期失败”，前提放在标记用例里，坏了也看不出来。
- **`test.fail` 与 `test.fixme`：** 默认用 `test.fail`（`knownBug` 的默认行为）。只有无法稳定复现、或期望行为未定时才用 `test.fixme`（传 `{ fixme: '<原因>' }`），并在“现状”一栏写明原因。
- **先确认复现再标记：** 标记前先去掉标记运行一次，确认失败点正是那条期望断言，再恢复标记。没有亲眼复现的问题不标成已知 bug。
- **不修改应用：** 已知 bug 保持现状，期望行为在标记用例里表达；等应用修好后，`test.fail` 用例会变红，提醒去掉标记。
- **失败输出不含个人计划文字：** 标记用例只用合成草稿和 fixture 里的合成标签，不碰内置预设、任务或力量项目的元素，也不把它们写进注解。
- **新增一条要同时改 spec 和本表：** `tests/e2e/platform/known-bugs-registry.spec.ts` 的护栏用例会双向核对编号和用例标题，漏登记或写错标题都会变红。每行以 `| <编号> |` 开头，用例标题用反引号括起、与 spec 里的标题逐字相同。

## 登记表

| 编号 | CONCERNS.md 出处 | 对照用例 | 标记用例 | 期望行为 | 现状 |
|------|------------------|----------|----------|----------|------|
| B1 | `.planning/codebase/CONCERNS.md` 的 Known Bugs 一节 “Composer draft lost when choosing another day”（本周视图那一处；日历日面板那一处在 Phase 4 登记） | `BUG-01 B1 control: the week draft is typed and picking another day moves the selection` | `BUG-01 B1 expected: the week draft survives picking another day` | 点另一天后，本周记一笔的草稿仍在，记录按钮可用 | 已复现（`test.fail`）：点另一天后草稿被清空，实际值为空字符串 |

## 以后的阶段

- N1：由 Phase 3 的 03-04 计划 Task 2 登记。
- B4（复盘末尾内容丢失）：由 Phase 3 的 03-02 计划登记。
- Phase 4：登记日历日面板的 B1 实例。
- Phase 5：登记 B2（取消导入后重选同一文件）和 N3（导入 `{}`）。
