---
phase: 12-plan-editor
plan: 04
subsystem: plan-editor-groups-and-tasks
tags: [plan-editor, groups, tasks, reorder, archive, undo, validation, limits, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-03 的 pe 会话、renderPlanEditor、savePlanDraft、confirmBox 的 okClass 与 scope；12-01、12-02 的归档规则和归档区
provides:
  - 编辑页里目标组和任务的增、改（名称、类别、备注、任务文字）、上移下移、删除（直接移除可撤销，有进度改为确认后归档）
  - 纯函数段的 PLAN_MAX、planProblems、taskHasProgress、groupProgress
  - 校验与上限：空名称、空任务不能保存，错误就近显示，组 20、每组任务 50，字数计数
  - savePlanDraft 保存时清掉离开计划的任务和组的进度键、自定义待办
affects: [12-05, 12-06, 12-07, 12-08]

actuals:
  tokens: 11819
  tasks: 3
  commits: 3
plan_head_before: b5b442b5b893ab91c9e1ea92bf6071627561596c
plan_head_after: 0bca998b684061053359a8cfe7b2f41f7e89bdcc

tech-stack:
  added: []
  patterns:
    - "新项的 id 在加进草稿时生成一次（g-、t- 加 uid()，先查 pe.origIds、草稿和 pe.gone 里的 id 避免相撞），保存和重试都不再生成"
    - "删除按“有没有进度”分流：没有进度或草稿里新加的直接移除并记进 pe.gone，有进度只能确认后写 archived:true"
    - "错误显示用就地更新（peShowErrors），不整页重画；鼠标或手指按下期间的错误显示推迟到 click 结束，避免错误行把按钮顶走"

key-files:
  created:
    - tests/cloud/plan-editor-groups.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/plan-editor.ts
    - tests/e2e/data/plan-normalize.spec.ts

key-decisions:
  - "保存时的 state 清理只在 keepOrphans 为假（账号的计划读得出来）时做：计划读不出来时页面显示的是示例计划，对不上的进度键下一次加载本来就会丢，这里不动 state"
  - "清理的自定义待办只限“所属组在旧计划里、不在新计划里”的；本来就找不到所属组的待办（GROUP_NONE 或未知组）不在保存时被删"
  - "错误行出现时机：失焦后显示，但鼠标或手指按在编辑页上（pointerdown）时推迟到这次点击结束（最多 600 ms），键盘 Tab 立刻显示"

requirements-completed: [PLAN-02, PLAN-03]

coverage:
  - id: D1
    description: "新增目标组和任务拿 g-、t- 新 id，已有 id、顺序和进度不变；改已完成任务的文字，时间线显示新文字、进度键还在"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-02 a group and a task added in the plan editor get new g- and t- ids, keep the existing ids and show on the goals view after saving (D-15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "组和任务只在各自列表里上移下移，不改 id，保存后目标页 P 编号按新顺序"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-02 groups and tasks move up and down within their own list, keep their ids and the goals view numbers the groups in the new order (D-14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "没有进度的任务和组直接移除并可撤销；有进度的只能确认后归档；归档项的进度和自定义待办在服务器上保留，离开计划的进度键被清掉"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-03 deleting a task or a group without progress removes it from the draft with an undo, and with progress asks and archives it (D-01)"
        status: pass
    human_judgment: true
    rationale: "归档确认框的措辞、「撤销移除」toast 的位置和读屏句子是按 UI-SPEC 写的，真实浏览器和读屏下的体验没有用例断言（12-08 验收）"
  - id: D4
    description: "空名称和空任务不能保存，错误就近显示，自动展开并聚焦；组 20、任务 50 的上限；字数计数"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-02 an empty group name or task text blocks saving with the error next to the field and opens the card (D-17)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-02 the add buttons stop at 20 groups and 50 tasks in a group (D-17)"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-02 planProblems reports empty names and texts of groups and tasks in use and ignores archived ones (D-17)"
        status: pass
    human_judgment: true
    rationale: "错误行、计数和上限提示的外观（窄屏、深色主题、20 个组加 50 项任务时的滚动）没有用例断言"
  - id: D5
    description: "计划文字里的标记在编辑页的输入框、卡片标题、确认框和 toast 里只显示为文字；编辑后导出再导入，进度仍对应到正确的任务"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-02 plan text with markup is shown as text in the plan editor"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor-groups.spec.ts#PLAN-02 after editing the plan an exported backup imports back with every task progress on the right task"
        status: pass
    human_judgment: false

duration: 约 55min
completed: 2026-11-12
status: complete
commits: 3
---

# Phase 12 Plan 04: 目标组和任务的增改、排序、删除与校验 Summary

**编辑页里目标组和任务能增、改（名称、类别、备注、任务文字）、上移下移、删除：没有进度的直接移除并可撤销，有进度的确认后归档；空名称、空任务保存不了，错误就近显示，组 20、每组任务 50 封顶；新项拿 g-、t- 新 id，已有 id 一个不变，保存时只清掉离开计划的项的进度。**

## Performance

- **Duration:** 约 55 min
- **Tasks:** 3（Task 1 为 tracer，一次通过，记为“Tracer verified end-to-end — expanding”）
- **Files modified:** 6（一个新文件）
- **实际规模：** 新增约 47K 字符（chars/4 约 11.8K），估计 115K 差得很远；估计是按含大量读文件的路径算的，实际三个任务没有失败重跑，一次改应用一次改测试。

## Accomplishments

- **Task 1（tracer）：** 「＋ 添加目标组」「＋ 添加任务」、类别 `.seg`、备注文本域、任务行（`pe-f-t-<id>-text`）、空任务提示；新组默认类别「其他」、名称空、自动展开并聚焦名称；保存后服务器计划末尾多出 `g-`、`t-` 前缀的新项，已有 id 与顺序不变，改过文字的已完成任务进度键还在，目标页新组是 P3、时间线显示新文字。
- **Task 2：** 上移下移（同级、与最近的未归档邻居交换、归档项原地不动、焦点留在同一个按钮或落到同行另一个排序按钮）；删除分流；归档确认（`.primary`、`scope:"plan"`）；保存时 state 清理。
- **Task 3：** `planProblems`、`PLAN_MAX`；就近错误、卡片头 `有 {n} 处要改`、提示行 `有 {n} 处需要修改，已标在对应位置`、自动展开、聚焦第一个错误；组 20、任务 50 的上限和字数计数；标记载荷只显示为文字；编辑后导出再导入进度对得上。

### 字段键和动作名的完整清单（12-05 到 12-07 沿用）

| 类别 | 值 |
|------|----|
| 动作 `data-peact` | `toggle`、`cat`（带 `data-pecat`）、`addgroup`、`addtask`、`up`、`down`、`del`、`delgroup` |
| 卡片和行的键 `data-pekey` | 组 `g:<组 id>`；任务 `t:<任务 id>` |
| 字段键 `data-pefield` | `g:<id>:name`、`g:<id>:note`、`t:<tid>:text` |
| 元素 id | 字段 `pe-f-<g|t>-<id>-<name|note|text>`；错误段落 `pe-e-…`（同后缀）；计数 `pe-c-…`；卡片内容 `pe-b-g-<id>`；卡片名称 `pe-n-g-<id>` |
| 读屏句子 | `已添加：新的目标组`、`已上移：{名称}，现在是第 {k} 项，共 {n} 项`（下移同理）、`已从草稿移除：{名称}`、`已恢复：{名称}`、`已归档：{名称}` |
| 应用常量 | `T_PE_ADD_GROUP`、`T_PE_ADD_TASK`、`T_PE_TASKS_EMPTY`、`T_PE_LIVE_ADDED_GROUP`、`T_PE_LABEL_NAME`、`T_PE_LABEL_NOTE`、`T_PE_TASKS_TITLE`、`T_PE_UP/DOWN/DEL/DEL_GROUP`、`T_PE_REMOVED`、`T_PE_UNDO_REMOVE`、`T_PE_LIVE_RESTORED`、`T_PE_LIVE_ARCHIVED`、`T_PE_ARCH_*`、`PE_ERR`、`T_PE_BAD(n)`、`T_PE_HINT_ERRORS(n)`、`T_PE_LIM_GROUPS`、`T_PE_LIM_TASKS` |

### pe.gone 的记录格式（12-07 的 D-08 复查读它）

`pe.gone` 是数组，每一项 `{kind:"task"|"group", id, item, parent, index}`：`item` 是被移除对象的深拷贝（组带着它当时的全部任务），`parent` 是任务所属组的 id（组为 `null`），`index` 是它在原数组里的位置（含归档项，撤销时用 `Math.min(index, length)` 放回）。只记“直接移除”的项（没有进度，或草稿里新加的）；归档不进 pe.gone（归档是在草稿里写 `archived:true`）。撤销移除时找不到 parent 组就什么都不做，成功才从 pe.gone 去掉。`pe.origIds` 是打开时计划里全部组、任务、力量项 id 的 Set，`peUsedIds()` 把它、草稿里的 id 和 pe.gone 里的 id 合起来，新 id 生成时避开。

### savePlanDraft 里校验和 state 清理插在哪一步

顺序（接 12-03 的步骤编号）：**校验（新）** → ① pe 为空、busy、没有修改则返回 → 校验：`planProblems(s.draft)` 有问题就 `pe.tried=true`、展开含错误的卡、重画、提示行、聚焦第一个错误并返回（此时 busy 还没置真，不并入远端、不存计划）→ `busy` 置真 → ② 并入挂起的远端版本 → ③ `normalizePlan` → ④ 读不出来的计划先留底 → **state 清理的差集（新，在 ⑤ 之前、旧计划还在时算）** → ⑤ `usePlan(np)`、`docs.plan.dirty`、`seq`、`cachePut` → **`commit(["task:"+id…,"custom:"+id…], fn)`（新，仅当有要删的才做）** → ⑥ `showSync`、`requestSync("save")` → ⑦ 离开 → ⑧ toast。12-07 的“计划被改过”三选一放在 ② 之后、③ 之前；12-06 的彻底删除不用另加清理，差集已经覆盖离开计划的 id，力量项的清理 12-05 在同一处补。

### planProblems 的代码表

| 代码 | 字段键 | 条件 | 文案（`PE_ERR`） |
|------|--------|------|------------------|
| `gname` | `g:<组 id>:name` | 未归档的组，名称 trim 后为空 | `请填写目标组名称` |
| `ttext` | `t:<任务 id>:text` | 未归档的组里未归档的任务，文字 trim 后为空 | `请填写任务内容` |

返回按页面顺序（组，再它的任务）；归档的组和任务不报；长度上限不在这里查（靠 `maxlength`，UTF-16 码元与 `String.length` 一致）。12-05 往这个函数里补力量项、健身天数、标签的规则（`PLAN_MAX` 里 lifts、tags、tag、unit 已备好）。

### 用例条数

- 新增 cloud 用例 **7 条**（`tests/cloud/plan-editor-groups.spec.ts`，Task 1 一条、Task 2 两条、Task 3 四条），默认套件单元用例 **1 条**（`planProblems`）。
- 完整 `npm run test:cloud` 为 **216 条，全部通过**（12-03 的 209 条 + 本计划 7 条，REPORT OK，flaky 0，unexpected 0）。完整默认套件 **192 条全部通过**（12-03 的 191 条 + 本计划 1 条，REPORT OK，flaky 0，unexpected 0）。

## Task Commits

1. **Task 1（tracer）：添加目标组和任务、类别、备注、任务文字** - `a41e055`（feat）
2. **Task 2：上移下移、删除（直接移除与撤销、确认后归档）、保存时清理离开计划的进度** - `5c8fac7`（feat）
3. **Task 3：校验与上限、标记只显示为文字、导出再导入** - `0bca998`（feat）

**Plan metadata:** 见下一次 docs 提交

## Files Created/Modified

- `us-journey-tracker.html` - 纯函数段 4 项、编辑页的组卡完整字段与任务行、动作与撤销、归档确认、校验与计数、保存时的校验和 state 清理
- `tests/support/constants.ts` - 每个任务重新记录 APP_SHA256
- `tests/support/strings.ts` - 三批文案常量，逐字同步应用
- `tests/support/plan-editor.ts` - readEditor 多返回 `cat`、`taskKeys`、`bad`、`errors`、`addGroupDisabled`
- `tests/cloud/plan-editor-groups.spec.ts` - 新，7 条 cloud 用例
- `tests/e2e/data/plan-normalize.spec.ts` - NAMES 加 `planProblems`、`PLAN_MAX`，加 1 条单元用例

## Decisions Made

见 frontmatter 的 key-decisions。另：

- 归档的确认之后在草稿里只写 `archived:true`，不弹 toast（UI-SPEC 的 S14 里没有归档的 toast，用读屏区一句）；整份草稿放弃（「放弃这次修改」）可以找回。
- 字数计数 `aria-hidden`：上限由 maxlength 保证，避免计数混进输入框的无障碍名字；分区标题旁和任务小标题旁的 `{n}/20`、`{n}/50` 是普通文字（标题的名字因此是“目标组 3/20”）。
- 备注文本域的内容前面补一个换行（HTML 解析会吃掉第一个换行），这样以换行开头的备注重画后不丢。

## Deviations from Plan

### 计划内的小调整（没有触碰计划之外的测试，也没有放宽断言）

**1. [Rule 1 - Bug] 失焦时出现的错误行把下面的按钮顶走，点击丢了**
- **Found during:** Task 3 的第一次运行（两条 cloud 用例失败，应用的问题，不是用例的问题）
- **Issue:** 空的组名或任务框失焦时马上显示错误行，页面下面的内容下移约 20px；鼠标按下和抬起落在不同元素上，点击没有发生（点「＋ 添加任务」、点另一张卡的开关都会丢点击）。真实的鼠标和触屏用户会一样碰到。
- **Fix:** 鼠标或手指按在编辑页上（`pointerdown`）时，失焦的错误显示推迟到这次点击结束（`click` 后下一个任务，最多 600 ms 兜底）；键盘 Tab 照旧立刻显示。`seen` 记录不推迟。
- **Files modified:** `us-journey-tracker.html`
- **Commit:** `0bca998`

**2. [Rule 1 - 用例自己的问题] 三处断言按错了页面行为**
- Task 2：直接移除组前要先展开那张卡（折叠的卡里 `删除这个目标组` 不可见）；「已归档」区会把归档组连同它的任务和自定义待办一起列出，所以 `taskIds` 断言写成排序后的三项。
- Task 3：用例里 `readEditor` 只列未归档的组，上限用例的组数断言按 20 写。
- **Files modified:** `tests/cloud/plan-editor-groups.spec.ts`

### 没有按计划原样执行的地方

- **Task 3 标了 `tdd="true"`，但本计划 `type: execute`**，没有计划级的 RED/GREEN 门禁。我是应用和用例在同一个任务里一起写、一起提交的，没有先单独提交一次失败的测试（`planProblems` 在 HEAD 上不存在，单元用例读不到它，天然会失败）。没有 `test(...)`、`feat(...)` 两次提交的拆分。
- **清理 state 时的两处保守条件**见 key-decisions（`keepOrphans` 时不清理；只清理“所属组在旧计划里、不在新计划里”的自定义待办）。计划原文是“新计划里不再有的组 → 删它的待办”，没有写这两个边界；这两个条件让数据更不容易被误删，没有放宽任何断言。

### 额外验证（不是偏差）

- 三个任务的 verify 之外，提交后多跑了完整 cloud 套件和完整默认套件各一遍（共用代码：纯函数段、`savePlanDraft`、`peBar`）。没有为此改动任何其他文件。

**Total deviations:** 2 条记录（一条应用 bug 的修正，一条用例自己的问题），1 条流程说明（tdd 标记）；**没有用到所有者预先批准的两项测试改动**（`readGroupIds` 和 SEC-01 的 `#goalsArch` 排除没有再次使用），编辑页没有新增被检测的元素（`s`、`details`、`img`、`iframe`、`svg`、`object`、`embed`）。

## Issues Encountered

- 带三个连续单引号的 Python 多行字符串放进 Bash heredoc 会解析失败，改用 Write 工具写脚本文件再运行（同 12-03）。
- 工作区文件是 CRLF（`core.autocrlf=true`），改应用文件的脚本用 `newline='\r\n'` 写回，APP_SHA256 按工作区文件的字节记录。

## Known Stubs

无。`data-pecat` 现在由类别按钮使用；12-05 的预设类别卡要换一个动作名，不要复用 `cat`（`cat` 这个动作在 `peRoot` 的 click 里写的是组的类别）。

## Threat Flags

无新增的安全相关面。T-12-12：新 id 一律 `g-`/`t-` 加 `uid()`，先避开 `pe.origIds`、草稿、`pe.gone` 里的 id，用例断言已有 id 与顺序不变、新 id 匹配前缀，`normalizePlan` 仍拒绝重复 id；T-12-13：删除前用 `taskHasProgress`/`groupProgress` 判断，有进度只走确认后的归档，用例证明归档任务的进度和组里的自定义待办在服务器上保留，保存清理只删“离开计划”的 id；T-12-14：每处插值 `esc(...)`，确认框和 toast 只用 `textContent`，带标记载荷的用例按五项检查（flag、marked、foreign、handlers、scripts）通过，SEC-01 源码门槛通过；T-12-15：添加按钮在满时 `disabled`，名称和文字靠 `maxlength`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

组和任务的增改排删与校验已就绪。12-05 在同一个 `renderPlanEditor` 里加力量项、健身和基础预设标签，往 `planProblems` 里补规则（`PLAN_MAX` 已备好）、用 `pe.origIds` 判断新加的力量项、在 `savePlanDraft` 的清理处补力量项的 `state.lifts`；12-06 的「已归档」区读 `archived:true` 的组和任务，恢复、彻底删除只需改草稿，保存清理已经覆盖离开计划的 id；12-07 的 D-08 复查读 `pe.gone`（格式见上）。12-08 的真实浏览器验收请所有者看：错误行出现的时机（失焦后）、「撤销移除」toast 在窄屏的位置、归档确认框的措辞、20 个组加 50 项任务时的滚动。

## Self-Check: PASSED

- 文件存在：`tests/cloud/plan-editor-groups.spec.ts`、`tests/support/plan-editor.ts` 在磁盘上并已提交。
- 提交存在：`a41e055`、`5c8fac7`、`0bca998` 都在当前分支上；`git rev-list --count` 从 plan_head_before 到 HEAD 为 3。
- 验收：三个任务的 grep 门槛、五个锚点各一次、APP_SHA256 与文件一致、migrate-backup 自检通过（59 项）、cloud 命令（9 条、8 条、34 条）REPORT OK 且含各任务标题、默认子集（17 条、17 条、21 条）REPORT OK（含 SAFE-02 和 SEC-01）、完整 cloud 216 条和完整默认 192 条 REPORT OK、暂存隐私检查三次通过。
