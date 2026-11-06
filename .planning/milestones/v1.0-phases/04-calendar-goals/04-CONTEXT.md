# Phase 4: 日历与目标视图（Calendar & Goals） - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Mode:** smart discuss（自动模式）。用户在 2026-11-03 选择第 3–5 阶段的灰区“直接采用推荐”，以下推荐答案全部按已接受记录。

<domain>
## Phase Boundary

本阶段要让开发者能自动验证日历和目标两个视图的渲染与交互，直接复用 Phase 3 的 `composer`、`editor`、`toast`、`expectSaved` 和 `knownBug` 约定。范围包括：
- 日历月份网格：35 格和 42 格两种月份、今天高亮、抵达日标记、chips 和 “+N”；
- 切换月份、回到今天、点格子选中，点相邻月份的格子会跳到那个月；
- 日面板：分区显示，在日面板记一笔，删除后可以撤销，点删除按钮不会误开编辑弹窗；
- 目标视图：力量卡片和 P1–P7 目标组的完成计数与进度条；
- 力量值的更新、历史和达标；
- 勾选和取消勾选任务；截止日期和“已过期”；
- 添加和删除自定义待办，内置任务没有删除按钮。

本阶段还要补上从 Phase 3 推迟过来的两件事：
- 日历日面板那一处 B1；
- 撤销 toast 过期的用例。

需求：CAL-01、CAL-02、CAL-03、CAL-04、GOAL-01、GOAL-02、GOAL-03、GOAL-04、GOAL-05。

本阶段不做：
- 时间线筛选、导入、窄屏（Phase 5）；
- 修改应用。

</domain>

<decisions>
## Implementation Decisions

### 沿用的已定决定（来自 ROADMAP、research 和前三个阶段，不再讨论）
- **D-01:** 开始之前，先用脚本核对两个固定月份的格子数，一个 35 格、一个 42 格。
  - 应用的规则：从当月 1 日所在周的周日开始画格子，最多 42 格；第 36 格（下标 35）如果已经不在当月，就停在 35 格。
  - 2026-03（今天所在月，1 日是周日）应该是 35 格；2026-08 或 2026-05 应该是 42 格。
  - 期望值由测试里独立的日期计算推导，不从应用读。
- **D-02:** 力量值只在点“保存”或按 Enter 时保存，失焦不保存。
  - 达标用一个极大值触发，不达标用一个很小但合法的值。
  - 不写死目标数字；力量名称、目标数值和备注都属于个人计划文字，不写进仓库，断言失败时也不打印。
  - 达标 toast 的文案是“<名称>达标了”，所以只在 Node 侧做后缀比较，失败消息里不带名称。
- **D-03:** 期望值从 fixture 推导，不复制任务原文。内置任务只通过位置 id 引用，比如 `[data-task="P1-1"]`，并且集中在 `tests/support/task-ids.ts`。
- **D-04:** 只有撤销 toast 过期这类用例才单独启用 `clock.install`；“没有保存”的证明也用手动时钟加写入次数（Phase 3 D-15）。同一个用例里不和 `setFixedTime` 混用。
- **D-05:** 失败输出不能打印个人计划文字（Phase 3 D-14，Phase 2 审查得出的约定）。以下元素都带着个人计划文字：
  - 内置任务的复选框（`aria-label` 是任务原文）；
  - `.tt` 任务文字；
  - 日历里到期和完成的 chip（显示任务原文）；
  - 日面板“完成的计划”和“这天到期”列表；
  - 力量卡片的名称、目标和备注。

  对这些元素：
  - 不用定位器做动作，也不用文字断言或可见性断言；
  - 改用 `page.evaluate` 按 id 或序号操作，或者只用 `toHaveCount`，或者在 Node 侧做布尔比较；
  - 格子的计数优先读格子的 `aria-label`（“M月D日，N 条记录，N 项到期，N 项完成”）。
- **D-06:** 默认用账户模式加 `full-state.json` 种子，保存用 `app.expectSaved` 断言；测试标题用英文并以需求编号开头，注释和文档用中文，界面文案只放在 `strings.ts`。

### 日历
- **D-07:** 用例放在 `tests/e2e/calendar/`，网格期望由新的独立 helper 计算，例如在 `expect-from-fixture.ts` 里加 `monthGrid(year, month)` 和 `eventsOnDate(date)`。断言这些内容：
  - 表头是周日在前（`WD` 顺序）；
  - 当月以外的格子带 `.out`；
  - 今天带 `.today`，选中日带 `.sel`；
  - 抵达日（fixture 的 2026-01-12）带抵达日的类，在 1 月才看得到；
  - 每格最多 3 个 chip，超出时显示“+N”；
  - chip 顺序是记录、到期、完成。

  fixture 里如果没有某天 4 个以上事件的情况，规划者可以给 `full-state.json` 加合成记录或合成自定义任务。加了之后，要确认 Phase 2 和 Phase 3 依赖 fixture 推导的用例照样通过，因为它们的期望都是推导出来的。
- **D-08:** 导航的用例覆盖：
  - 上个月、下个月：跨年时标题要正确，而且不改变选中日；
  - “今天”按钮：回到当月，选中今天；
  - 点格子：日面板标题变成“M月D日 周X”；点当月以外的格子会跳到那个月。
- **D-09:** 日面板的用例覆盖：
  - 三个分区：做过的事，没有记录时显示空提示；完成的计划；这天到期；
  - 用 `composer(page, 'c')` 在日面板记一笔，记录出现在当天，并且已保存；
  - 删除：点 × 只删除，不打开编辑弹窗，也不改变选中日；之后可以用 toast 撤销。
- **D-10:** 日历日面板的 B1 实例（`#c-text` 输入草稿后点另一个格子，草稿被清空），按 Phase 3 的约定写成一对用例：一条对照用例，一条 `test.fail`。在 `tests/KNOWN-BUGS.md` 的 B1 行补上这一处，登记护栏要照样通过。执行时先去掉标记确认能复现。
- **D-11:** 撤销 toast 过期用一条用例覆盖：删除记录后用手动时钟把时间推过 5 s，toast 失去 `.on`，撤销按钮不再可用，并且删除已保存。

### 目标
- **D-12:** 用例放在 `tests/e2e/goals/`，覆盖 GOAL-01：
  - 4 张力量卡；
  - P1–P7 共 7 个目标组；
  - 每组的完成计数 `.cnt`（“已完成/总数”）和进度条宽度，都与从 fixture 推导的结果一致。总数用 DOM 里该组 `[data-task]` 的个数，这样不必复制任务原文。
- **D-13:** GOAL-02 的用例：
  - 输入框改值后才出现“保存”按钮；
  - 点保存或按 Enter 后，历史显示“最近：”加最近 3 条，用“，”连接，并且已保存；
  - 失焦不保存（手动时钟加写入次数）；
  - 达标用极大值，不达标用小值，两种 toast 文案都在 Node 侧比较（按 D-02）；
  - 进度条宽度最多 100%。
- **D-14:** GOAL-03 和 GOAL-04 的用例：
  - 勾选任务：`tasks[id].done = true`，`doneDate` 是冻结的今天，所在组的计数和进度条随之更新；
  - 取消勾选：`done = false`，`doneDate` 清空，原来的截止日期保留；
  - 设置一个早于今天的截止日期后，这个任务行显示“已过期”（`.od`）；
  - 勾选和截止日期都通过 `page.evaluate` 按 `data-task` 或 `data-due` 的 id 操作内置任务，或者只用合成的自定义任务（按 D-05）。
- **D-15:** GOAL-05 的用例：
  - 用 `[data-addto=P<n>]` 输入合成文字，按 Enter 或点“添加”，新增一条自定义待办，并且已保存；
  - 点自定义待办的 ×（`[data-deltask]`）可以删除，它的 `tasks[id]` 也一起删掉；
  - 内置任务所在的行没有删除按钮（`toHaveCount(0)`）。

### 文档与遗留
- **D-16:** 顺手更新 `tests/README.md`，也就是 Phase 3 审查的 IN-08：
  - 手动时钟的使用范围改为三类：证明没有保存、撤销窗口和 toast 过期、带计时器的刷新；
  - 已知 bug 的写法改为“一条或多条对照用例，加一条 `test.fail`”；
  - 再补上日历和目标两个目录的说明。
- **D-17:** N1 还有几种触发没有验证，例如在目标页勾选任务、在日面板删除记录，这两种正好在本阶段的视图里。规划者可以决定是否顺手给它们各补一对已知 bug 用例并更新 KNOWN-BUGS.md；不补的话，在 SUMMARY 的“假设”一节里照旧写明“未验证”。

### Claude's Discretion
- spec 文件怎么拆分、helper 叫什么名字、是否需要在 fixture 里加合成数据（D-07），由规划者决定。
- D-17 是否顺手补上，由规划者决定。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/support/composer.ts`：`composer(page, 'c')` 是日面板的记一笔，根节点 `#dayPanel`。内置预设只能通过 `presetIndexes`、`clickPreset` 这类页面内 helper 操作。
- `tests/support/editor.ts`：`editor(page)`，可以从日面板的 `li[data-edit]` 或 `li[data-edittask]` 打开。
- `tests/support/toast.ts`：`expectToast`、`expectToastPrefix`、`expectUndoOffered`、`undo`、`expectToastGone`。都是在页面里读回 `#toast` 的状态，然后在 Node 侧比较。
- `tests/support/test.ts`：`knownBug(id, summary, opts?)`、`guard`、`frozenClock`（`clockMode: 'manual'`）。
- `tests/support/app.ts`：`open({ mode: 'account', seed })`、`saved()`、`expectSaved()`、`backend`。
- `tests/support/expect-from-fixture.ts`：`logsInWeek`、`taskBuckets`、`expectedCategory`、`timelineDateLabel`，以及本周视图的推导函数。
- `tests/support/task-ids.ts`：内置任务的位置 id。
- `tests/KNOWN-BUGS.md` 和 `tests/e2e/platform/known-bugs-registry.spec.ts`：登记表和双向护栏。

### Established Patterns
- 应用的日历由 `renderCal`（`us-journey-tracker.html` 约 481–494 行）渲染：
  - 格子是 `<button class="cell …">`，带 `.out`、`.today`、`.sel` 和抵达日的类；
  - `aria-label` 带记录、到期、完成三类数量；
  - `.chips` 最多显示 3 个 chip，超出的显示“+N”；
  - 日志 chip 带类别色类，到期 chip 是 `.chip.due`，完成 chip 是 `.chip.done`。
- 日面板由 `renderDay`（约 495–505 行）渲染，根节点是 `#dayPanel`。
- 目标视图由 `renderGoals`（约 507–527 行）渲染，包括：
  - 力量卡 `.lift`，输入框 `#lf-<id>` 和保存按钮 `[data-liftsave]`；历史 `.hist`；
  - 组 `.group`，组里有 `.cnt` 和 `.bar i`；
  - 任务 `.task`：`[data-task]` 是复选框，`.tt` 是文字，`[data-due]` 是截止日期，`.od` 是已过期，`[data-deltask]` 只在自定义任务上；
  - 添加区是 `[data-addto]` 加添加按钮。
- `saveLift`（约 626 行）和 `addTask`（约 633 行）。

  读源码时，用 grep 定位后按行号区间读，**不要读约 298–330 行的个人计划常量**。
- toast 的显示时间：带撤销按钮的是 5000 ms，普通的是 1800 ms；只有一个共享计时器 `tt`。保存防抖是 600 ms。

### Integration Points
- 新目录 `tests/e2e/calendar/` 和 `tests/e2e/goals/`。
- 资源限制（用户的电脑在长时间运行时会卡）：
  - 测试一律用低优先级、1 个 worker 的方式运行，比如 `node -e "…os.setPriority(BELOW_NORMAL)… npm test -- --workers=1 …"`；
  - 每份计划最多跑一次全套，平时只跑相关的 spec；
  - 不做 `--repeat-each` 压测，不做全盘扫描；
  - 除了 `npx --no playwright`，不跑任何 npx。

</code_context>

<specifics>
## Specific Ideas

- 2026-02 正好 28 天，1 日是周日。按应用规则，第 29 格（下标 28）就已经是 3 月，循环会一直画到第 35 格才停，所以这个月可能显示 35 格，其中最后一行全部是 `.out`。可以选做一条边界用例，期望值由独立计算得出。
- 达标 toast 的名称部分不能出现在任何失败信息里，只比较后缀“达标了”和前缀“已更新为 ”这类固定文案。

</specifics>

<deferred>
## Deferred Ideas

- 时间线筛选、导入（B2、N3）和窄屏：Phase 5。
- 力量历史 30 条上限和同一天替换（research 里的 D-7）：需要专门的 fixture，留作后续。
- N1 的拖拽和改抵达日期这两种触发：留作后续，Phase 5 可以复用同样的模式。

</deferred>
