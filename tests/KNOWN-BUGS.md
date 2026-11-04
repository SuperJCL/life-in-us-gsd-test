# 已知 bug 约定和登记表

本文件登记测试里已确认的应用已知 bug（BUG-01）。应用保持只读：已知 bug 只在测试侧标记和登记，不修改 `us-journey-tracker.html`。

## 约定

- **一条或多条对照用例加一条标记用例：** 每个已知 bug 是同一个 `test.describe` 里的若干条用例（多数是一对，B4 有两条对照用例）。
  - 对照用例（不带标记）：走完全相同的准备和触发，断言前提成立（草稿确实输入了、按钮可用、触发动作确实生效）。
  - 标记用例：第一句调用 `knownBug(id, summary)`（来自 `tests/support/test.ts`），只断言一条期望的正确行为。
  - 分成两条，是因为 `test.fail` 会把同一条用例里任何原因的失败都当成“预期失败”，前提放在标记用例里，坏了也看不出来。
- **`test.fail` 与 `test.fixme`：** 默认用 `test.fail`（`knownBug` 的默认行为）。只有无法稳定复现、或期望行为未定时才用 `test.fixme`（传 `{ fixme: '<原因>' }`），并在“现状”一栏写明原因。
- **先确认复现再标记：** 标记前先去掉标记运行一次，确认失败点正是那条期望断言，再恢复标记。没有亲眼复现的问题不标成已知 bug。
- **不修改应用：** 已知 bug 保持现状，期望行为在标记用例里表达；等应用修好后，`test.fail` 用例会变红，提醒去掉标记。
- **失败输出不含个人计划文字：** 标记用例只用合成草稿和 fixture 里的合成标签，不碰内置预设、任务或力量项目的元素，也不把它们写进注解。
- **N2（复盘防抖期间的重绘还原文本框）：** 不写用例（D-03），只立规则：输入复盘后先用 `app.expectSaved` 等保存完成，再做别的操作；规则写在 `tests/e2e/week/review.spec.ts` 的文件头。
- **新增一条要同时改 spec 和本表：** `tests/e2e/platform/known-bugs-registry.spec.ts` 的护栏用例会双向核对编号和用例标题，漏登记或写错标题都会变红。每行以 `| <编号> |` 开头，用例标题用反引号括起、与 spec 里的标题逐字相同。

## 登记表

| 编号 | CONCERNS.md 出处 | 对照用例 | 标记用例 | 期望行为 | 现状 |
|------|------------------|----------|----------|----------|------|
| B1 | `.planning/codebase/CONCERNS.md` 的 Known Bugs 一节 “Composer draft lost when choosing another day”（覆盖两处：本周视图的草稿，和日历日面板的草稿；日历日面板那一处在 Phase 4 的 04-01 计划登记） | `BUG-01 B1 control: the week draft is typed and picking another day moves the selection`；`BUG-01 B1 calendar control: the day-panel draft is typed and picking another cell moves the selection` | `BUG-01 B1 expected: the week draft survives picking another day`；`BUG-01 B1 calendar expected: the day-panel draft survives picking another cell` | 点另一天后，本周记一笔的草稿仍在，记录按钮可用；日历日面板点另一个格子后，日面板记一笔的草稿仍在，记录按钮可用 | 已复现（`test.fail`）：点另一天后草稿被清空，实际值为空字符串。日历实例同样已复现（`test.fail`）：先去掉标记运行（`--retries=0`），失败点正是草稿断言，实际值为空字符串；对照用例证明草稿确实输入、点另一个格子确实移动了选中日、编辑弹窗没有打开 |
| N1 | CONCERNS.md 没有单独的 N1 条目；同源条目是 `.planning/codebase/CONCERNS.md` Known Bugs 一节的 “Composer draft lost when choosing another day”（即上面的 B1），根因相同（整页重绘 renderAll / renderWeek 重建 composer，草稿随之丢失），触发不同（B1 是点另一天，N1 是点直接记录的预设，走 addLog → renderAll）；触发的出处是 `.planning/research/FEATURES.md` 已知 bug 对照表的 N1 | `BUG-01 N1 control: the week draft is typed and the direct-record preset saves its entry`；`BUG-01 N1 delete control: the day-panel draft is typed and the delete button removes the entry`；`BUG-01 N1 goals control: the week draft is typed and checking a task saves it as done` | `BUG-01 N1 expected: the week draft survives a direct-record preset`；`BUG-01 N1 delete expected: the day-panel draft survives deleting an entry`；`BUG-01 N1 goals expected: the week draft survives checking a task` | 点直接记录的预设后，本周记一笔的草稿仍在，记录按钮可用；在日面板删除一条记录后，日面板记一笔的草稿仍在；在目标页勾选任务后，本周记一笔的草稿仍在，记录按钮可用 | 已复现（`test.fail`）：点预设记了一条并保存后草稿被清空，实际值为空字符串。日面板删除记录同样已复现（`test.fail`，04-03 计划）：先去掉标记运行（`--retries=0`），失败点正是草稿断言，实际值为空字符串；对照用例证明草稿确实输入、删除按钮确实走了 deleteLog（toast 为已删除并带撤销、记录消失、弹窗没有打开、保存里没有该记录）。目标页勾选任务同样已复现（`test.fail`，04-03 计划）：失败点同样是草稿断言，实际值为空字符串；对照用例证明草稿确实输入、勾选确实走了勾选分支（toast 为完成、保存里该合成待办已完成）。FEATURES.md 对照表里 N1 的另外 2 种触发（拖拽、改抵达日期）仍未验证，留给后续阶段 |
| B4 | `.planning/codebase/CONCERNS.md` 的 Known Bugs 一节 “Last ~1.4 s of review text can be lost on close” | `BUG-01 B4 control: the review typed under a paused clock is saved once the debounces run and survives reload`；`BUG-01 B4 reload path: the page reloads and becomes ready while the debounce timers are still pending`（证明标记用例走的“计时器未触发就刷新”这条路径本身可用，只断言与 bug 无关的前提） | `BUG-01 B4 expected: the review typed right before reload survives the reload` | 输入复盘后立刻刷新，刷新后复盘文字仍在 | 已复现（`test.fail`）：manual 时钟暂停后输入复盘、不推进防抖就刷新，刷新后文本框显示保存里的旧复盘，刚输入的文字丢失。对照用例证明把时钟推过 800 ms 加 600 ms 两段防抖后保存和刷新读回都正常。三条用例都在 manual 时钟下运行，不靠真实时间的竞态；刷新后 page.clock 仍保持安装和暂停状态 |

## 以后的阶段

- N1：已登记（Phase 3 的 03-04 计划，直接记录的预设这一种触发）。N1 的日面板删除、目标页勾选两种触发由 Phase 4 的 04-03 计划登记；拖拽和改抵达日期两种触发仍未验证。
- B4：已登记（Phase 3 的 03-02 计划，manual 时钟下的一对用例）。
- Phase 4：B1 的日历日面板实例已登记（04-01 计划，成对用例在 `tests/e2e/calendar/known-bugs.spec.ts`）。
- Phase 5：登记 B2（取消导入后重选同一文件）和 N3（导入 `{}`）。
