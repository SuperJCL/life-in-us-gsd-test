# Phase 3: 记一笔、编辑弹窗与本周视图（Composer, Editor & Week） - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Mode:** smart discuss（自动模式）。用户在 2026-11-03 选择第 3–5 阶段的灰区“直接采用推荐”，以下推荐答案全部按已接受记录。

<domain>
## Phase Boundary

本阶段交付三样东西：
- 第 4、5 阶段直接复用的测试 helper：记一笔（composer）、编辑弹窗（editor）、toast、统一的“已保存”断言；
- 统一的已知 bug 标记约定和 `tests/KNOWN-BUGS.md`；
- 用这些 helper 完整验证本周视图的渲染和交互，以及编辑弹窗从本周、日历、时间线三个入口打开、修改、删除和撤销。

本阶段不做：
- 日历月格、日面板、目标视图的深入用例（Phase 4）；
- 时间线筛选、导入和窄屏（Phase 5）；
- 修改应用。

需求：WEEK-01、WEEK-02、WEEK-03、WEEK-04、WEEK-05、WEEK-06、EDIT-01、EDIT-02、EDIT-03、BUG-01。

</domain>

<decisions>
## Implementation Decisions

### 沿用的已定决定（来自 ROADMAP、research 和前两个阶段，不再讨论）
- **D-01:** 记一笔 helper 用根节点参数化：本周视图和日历日面板各有一个 composer 实例（应用里的 `p` 为 `"w"` 和 `"c"`），Phase 4 直接复用。所有视图共用的 `expectSaved(predicate)` 也在本阶段建立。
- **D-02:** 拖放按顺序尝试：
  - 先用 `dragTo`；
  - 不行就改用手动鼠标序列；
  - 再不行就用 `dispatchEvent` 加 `DataTransfer`。

  用了合成事件的用例要在注释里写明“合成事件，没有走真实指针路径”，并把结论写进 `tests/PROBES.md`。
- **D-03:** 输入复盘后，先等保存完成，再做别的操作（N2），避免防抖期间的重绘把文本框还原。N2 不单独写用例。
- **D-04:** toast 用 `#toast` 的 `.on` 类断言，不用可见性断言。
- **D-05:** 默认时钟是 `setFixedTime`。只有需要推进定时器的用例才单独启用 `clock.install`，例如证明“没有保存”、撤销 toast 过期。同一个用例里两者不混用。
- **D-06:** 测试标题用英文并以需求编号开头；注释和 tests/*.md 用中文；界面文案只放在 `tests/support/strings.ts`；spec 只从 `tests/support/test.ts` 导入（Phase 1 D-05..D-08、D-17）。

### 共享 helper
- **D-07:** `tests/support/composer.ts` 导出 `composer(page, p: 'w' | 'c')`，内部以应用生成的 id 为准，比如 `#w-text`、`#w-add`，以及 `#c-` 前缀的对应元素，具体选择器由执行者核对。它提供这些操作：
  - 切换类别；
  - 输入文字；
  - 提交（点“记录”按钮或按 Ctrl+Enter）；
  - 按序号点选预设标签（直接记录或预填）；
  - 添加预设标签；
  - 进入编辑模式；
  - 删除预设标签；
  - 读出当前草稿。

  它只依赖 `@playwright/test` 和 `./strings` 这类纯模块，不从 `./test` 导入，避免循环引用。
- **D-08:** `tests/support/editor.ts` 封装编辑弹窗：
  - 从记录（`[data-edit]`）或完成计划（`[data-edittask]`）打开；
  - 修改文字、类别、日期；
  - 保存、删除，以及断言弹窗已关闭或仍打开。

  `tests/support/toast.ts` 封装两件事：`expectToast(text)`（`.on` 类加文案）和 `undo()`（点 toast 里的撤销按钮）。
- **D-09:** `AppHarness.expectSaved(predicate, message?)` 统一两种模式：
  - 账户模式读 `app.backend` 里最新一次写入的文档；
  - 本地模式读 localStorage；
  - 都用 `expect.poll`，不用固定睡眠。

  另提供 `app.saved()` 返回最新保存的状态，没有保存过时返回 null。
- **D-10:** 视图用例默认用账户模式加 `full-state.json` 种子，期望值都由 `tests/support/expect-from-fixture.ts` 的 helper 从 fixture 推导，例如本周统计、7 天记录列。缺少的推导函数就加在那里，不在用例里抄数字。

### 已知 bug 约定（BUG-01）
- **D-11:** 每个已知 bug 写成同一个 `test.describe` 里的**一对用例**：
  - 一条普通的对照用例：走同样的准备步骤，断言前提成立。比如草稿确实已经输进 `#w-text`，目标日期按钮存在且可点。
  - 一条 `test.fail()` 用例：重复同样的准备和触发动作，只断言一条期望的正确行为，并加注解 `{ type: 'known-bug', description: '<编号>：<一句话>' }`。

  分成两条，是因为 `test.fail` 会把同一条用例里的任何失败都当成“预期失败”。前提如果放在同一条用例里，坏掉也看不出来。
- **D-12:** `tests/KNOWN-BUGS.md`（中文）用一张表登记每个已知 bug：编号、`.planning/codebase/CONCERNS.md` 里的出处、对照用例和 `test.fail`/`test.fixme` 用例的完整标题、期望行为、现状。只有无法稳定复现、或期望行为未定的才用 `test.fixme`，并写明原因。可选：加一个护栏用例，检查每条带 `known-bug` 注解的用例都在 KNOWN-BUGS.md 里登记过。
- **D-13:** 本阶段处理的已知 bug 编号沿用 `.planning/research/FEATURES.md` 的“已知 bug 对照表”：
  - **B1**：本周视图在 `#w-text` 输入草稿后点另一天，草稿被清空。日历日面板那一处放在 Phase 4。
  - **N1**：带草稿时点“直接记录”的预设标签等操作，草稿也被清空。并入 B1，或另写一条 `test.fail`，用例说明里写明。
  - **B4**：输入复盘后立即 `reload`，末尾内容丢失。期望刷新后文字仍在。

  执行时要先确认每个 bug 能复现：能复现就用 `test.fail`，不能就用 `test.fixme` 并写明原因。

### 本周视图与编辑弹窗细节
- **D-14:** 内置预设标签是个人计划文字（Phase 1 D-09，Phase 2 D-12）：
  - 用例只按“第 n 个，以及是否以 `：` 结尾（预填还是直接记录）”来选，文字在运行时从 DOM 读；
  - 新增的标签用 `SYNTH-` 开头的文字；
  - 任何会带上内置预设标签或任务原文的断言，失败时都不能打印这些文字。做法是用布尔或计数断言，或对文字脱敏，这是 Phase 2 代码审查得出的约定；
  - 不把预设标签原文写进任何文件、注解或 SUMMARY。
- **D-15:** 证明“没有保存”或“内容为空时不能保存”：
  - 在单独启用 `clock.install` 的用例里，把时间推过保存防抖（600 ms，复盘还要再加 800 ms），然后断言写入次数不变、弹窗仍打开；
  - 不用固定 sleep。
- **D-16:** EDIT-01 的三个入口：
  - 在本周、日历、时间线各点一条记录打开编辑弹窗；
  - 修改文字、类别、日期并保存后，切换三个标签页，断言三个视图都同步更新，并且 `expectSaved` 读到新值；
  - 日历和时间线在这里只当入口用，深入的渲染和交互用例放在 Phase 4、5。
- **D-17:** EDIT-02 和 EDIT-03 的要求：
  - 在弹窗里删除记录后，toast 出现撤销按钮，点了之后记录恢复，并且已保存；
  - 文字为空时点保存，弹窗不关、状态不变（按 D-15）；
  - 完成计划的弹窗可以修改完成日期，也可以改回未完成，两种结果都要断言保存后的 `tasks[id]`。

### Claude's Discretion
- helper 的具体 API 形状、文件拆分、spec 的目录和文件名（建议放在 `tests/e2e/week/` 和 `tests/e2e/editor/`），由规划者决定。
- 每个 bug 是并入一对用例，还是拆成多对，由规划者按复现结果决定。
- 是否加“known-bug 注解必须登记”的护栏用例，由规划者决定。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/support/test.ts`：唯一的 test/expect 出口，提供以下 fixture：
  - `guard`：网络、页面错误和控制台护栏，用 `guard.remove` 定向删除记录；
  - `frozenClock`：`test.use({ clockMode: 'manual' })` 切到手动时钟；
  - `app`。
- `tests/support/app.ts`：`AppHarness`，提供以下能力：
  - `open({ mode: 'local' | 'account', seed, userId, expectStore })`；
  - `ready()`；
  - `reload()`；
  - `persisted()`；
  - `expectPersisted()`；
  - `backend`（reads/writes/downloads）；
  - `expectAccountMode()`；
  - 同一页面第二次调用 `open()` 会直接报错（Phase 2 WR-04）。
- `tests/support/expect-from-fixture.ts`：从 fixture 推导期望值（`logsInWeek`、`taskBuckets`、`expectedCategory`、CSV 生成与脱敏 `maskTaskTexts`/`csvMismatch`）。
- `tests/support/fixture-files.ts`（`loadFixture`、`withoutSynthetic`）、`tests/support/task-ids.ts`（内置任务位置 id）、`tests/fixtures/full-state.json`（本周 03-16..03-22 有五类记录、复盘、预设增删）。
- `tests/support/strings.ts`：界面文案、类别显示名、旧类别名（D-12 例外）。

### Established Patterns
- 应用的记一笔组件由 `composer(p, date)` 生成，`bindComposer(root, p, getDate)` 负责接线：
  - 两个实例 `p="w"` 和 `p="c"`；
  - UI 状态放在 `compCat[p]`、`compEdit[p]`、`compAdding[p]`；
  - 预设标签通过 `presetsFor(cat)` 取得，以 `：` 结尾的标签只预填、不直接记录。
- 本周视图：
  - 用 `wk`（周一）和 `wsel`（选中日）；
  - `[data-wday="YYYY-MM-DD"]` 是日期列，`[data-edit]` 是记录；
  - 拖放只依赖模块内的 `dragId`；
  - 复盘 `#review` 先 800 ms 防抖写入 state，再 600 ms 防抖落盘；
  - `renderWeek` 在 `#review` 失焦时会用 state 覆盖文本框的值（N2）。
- 处理函数的顺序是：先改 `state`，再 `persist()`（600 ms 防抖），最后 `renderAll()`（全量重绘，草稿会丢，即 B1/N1）。
- 删除操作会弹出带撤销按钮的 toast：有操作时显示 5 s，否则 1.8 s。

### Integration Points
- 编辑弹窗（`us-journey-tracker.html` 约 556–594 行）：`<dialog>` 加 `showModal()`，窄屏下是底部面板（窄屏放在 Phase 5）。
- 本周视图（约 449–479 行）、composer（约 389–437 行）、日历与时间线的记录入口（约 481–541 行）。读源码时用 grep 定位后按行号区间读，不整文件读。
- `tests/README.md` 要补充 helper 的用法和已知 bug 约定；新增 `tests/KNOWN-BUGS.md`。

</code_context>

<specifics>
## Specific Ideas

- B1 的期望断言：点另一天之后草稿仍在，并且“记录”按钮可用。现状是草稿为空、按钮禁用。
- 拖放用例断言保存后的状态里那条记录的 `date` 确实变了，不只看 DOM。

</specifics>

<deferred>
## Deferred Ideas

- 日历日面板的 B1 实例、撤销 toast 过期用例：Phase 4。
- B2（取消导入后重选同一文件）、N3（导入 `{}`，用户已决定算已知 bug）、窄屏：Phase 5。
- B3（加载完成前的编辑被丢弃）需要 mock 的加载延迟，属于 v2（ERR/延迟）。

</deferred>
