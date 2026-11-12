---
phase: 12-plan-editor
plan: 05
subsystem: plan-editor-fitness-and-presets
tags: [plan-editor, fitness, lifts, presets, validation, archive, undo, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-04 的 pe 会话字段（pe.origIds、pe.gone）、planProblems 与 PLAN_MAX、就近错误和 pe.seen/pe.tried 规则、归档确认写法、savePlanDraft 的 state 清理；12-03 的 confirmBox、renderPlanEditor、保存栏
provides:
  - 编辑页的健身分区：每周健身目标（最少、最多）、健身说明、力量项折叠卡（增改、上移下移、删除或归档）
  - 编辑页的基础预设标签分区：五张类别卡，每个标签一行，增改删、上移下移、去重、每类 20 个
  - 纯函数段的 liftHistoryCount，以及 planProblems 的力量项、健身天数、标签规则
  - 打开编辑页时就标出计划里已有的规则问题（pe.preErr），保存被挡住直到改好
  - 保存时清掉离开计划的力量项的 state.lifts；presetsFor 对两层重名去重
affects: [12-06, 12-07, 12-08]

actuals:
  tokens: 12099
  tasks: 3
  commits: 3
plan_head_before: 80370529fd54d9f13a0033350a967a9b5ebe9e78
plan_head_after: 8959ccc90c19cb76fd1a3ff858fe1af8401d4ee5

tech-stack:
  added: []
  patterns:
    - "数字输入框写回草稿：空串存空串，否则存 Number(值)，不取整；数值规则只在 planProblems（编辑页）里，normalizePlan 不收紧"
    - "打开编辑页时先跑一次 planProblems：问题的字段键进 pe.seen、所在卡展开、pe.preErr 让提示行显示数量；pe.tried 不变，新加的空行仍按“失焦后或点过保存”显示"
    - "标签行的键带下标 p:<类别键>:<下标>，结构变化后重画时重新编号，pe.seen 里同类别的下标用 peSeenTag 同步改，避免“失焦过”的状态落到别的行上"
    - "字段键到所在折叠卡的映射集中在 peCardOf（保存挡住时和打开时共用）"

key-files:
  created:
    - tests/cloud/plan-editor-fit.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/plan-editor.ts
    - tests/e2e/data/plan-normalize.spec.ts

key-decisions:
  - "基础标签原样写进草稿，保存时不 trim（计划写“原样”）；重复和空白的判断才用 trim。避免改动 state.presets 里按原字符串隐藏的基础标签"
  - "删除标签不进 pe.gone（标签没有进度，12-07 的 D-08 复查只关心任务、组、力量项）；撤销用 toast 的闭包按原下标放回，满 20 个时不放回"
  - "readEditor 的 groups 现在只读 data-key 以 g: 开头的卡，力量项卡和预设卡各有 lifts 和后续字段，避免力量项、预设卡混进组列表"
  - "打开时已有问题的提示行数量算整份草稿的全部问题（含用户之后新加的空行）；按钮 保存计划 仍按“有没有修改”决定是否可点，所以用例用一个不相干的修改去点保存"

requirements-completed: [PLAN-02, PLAN-03]

coverage:
  - id: D1
    description: "每周健身目标、健身说明和新加的力量项（新 id、目标值、不取整的起始值）保存后，目标页力量卡和本周健身目标行按新计划显示"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-fit.spec.ts#PLAN-02 the weekly fitness goal, the fitness note and a new lift edited in the plan editor are saved and shown on the goals and week views (D-15)"
        status: pass
    human_judgment: false
  - id: D2
    description: "力量项和健身字段的规则（名称、单位、目标值大于 0、起始值不小于 0、天数 0–7 整数、最少不大于最多）就近提示并挡住保存，力量项 8 个封顶，单位 8、名称 40、备注 200 字截断"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-fit.spec.ts#PLAN-02 lift and weekly fitness values outside the rules block saving with the error next to the field, and the add button stops at 8 lifts (D-15, D-17)"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-02 planProblems checks lift values and weekly fitness days and ignores archived lifts (D-15, D-17)"
        status: pass
    human_judgment: true
    rationale: "错误行、两个天数框同时标红、8 张力量卡的折叠外观（窄屏、深色主题）没有用例断言（12-08 验收）"
  - id: D3
    description: "已经违反编辑页规则的计划（起始值为负、天数颠倒）在目标页照常显示，打开编辑页就标出字段、展开卡片、提示行写数量，保存被挡住直到改好"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-fit.spec.ts#PLAN-02 a loaded plan whose values break the editor rules is shown as it is, and the editor marks those fields at once and blocks saving until they are fixed (owner decision)"
        status: pass
    human_judgment: false
  - id: D4
    description: "没有历史的力量项直接移除可撤销；有历史的只能确认后归档，历史在服务器上保留；离开计划的力量项的 state.lifts 保存时被删掉"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-fit.spec.ts#PLAN-03 deleting a lift without history removes it with an undo, and with history asks and archives it (D-01)"
        status: pass
    human_judgment: true
    rationale: "归档确认框的措辞、「撤销移除」toast 的位置和读屏句子是按 UI-SPEC 写的，真实浏览器和读屏下的体验没有用例断言（12-08 验收）"
  - id: D5
    description: "基础预设标签按类别增改删、上移下移，重复和空标签挡住保存，每类 20 个封顶；用户在「记一笔」里自己的标签保存前后一字不变，两层重名只显示一个"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-fit.spec.ts#PLAN-02 base preset tags are added, renamed, reordered and deleted per category, a duplicate or empty tag blocks saving, the user's own composer tags stay and a tag in both lists shows once (D-15, A20)"
        status: pass
    human_judgment: false

duration: 约 37min（含完整 cloud 约 10 分钟、完整默认约 6 分钟）
completed: 2026-11-11
status: complete
commits: 3
---

# Phase 12 Plan 05: 健身分区与基础预设标签 Summary

**编辑页多了健身分区（每周健身目标、健身说明、力量项）和基础预设标签分区：力量项的增改、上移下移，没有历史的直接移除可撤销、有历史的确认后归档；数值和空值就近提示并挡住保存，已有计划里违反规则的值打开编辑页就标出；预设只改计划里的基础列表，「记一笔」里用户自己的标签不动，两层重名只显示一个。**

## Performance

- **Duration:** 约 37 min（含等待套件；开始 17:31，结束 18:08）
- **Tasks:** 3（Task 1 为 tracer，一次通过，记为“Tracer verified end-to-end — expanding”）
- **Files modified:** 6（一个新文件）
- **实际规模：** 新增约 48K 字符（chars/4 约 12.1K），估计 110K 差得很远；三个任务都没有失败重跑，每个任务一次改应用、一次改测试。

## Accomplishments

- **Task 1（tracer）：** 「健身」分区：「每周健身目标」面板（最少、最多是 0–7 的整数输入，宽 96px，后缀「天」）、「健身说明」文本域、力量项折叠卡（`.k-fit` 左边框，摘要「{目标值} {单位}」，名称 40、单位 8、备注 200、目标值与起始值 `type=number`）、「＋ 添加力量项」（新 id `l-` 加 `uid()`，单位空、目标值空、起始值 0，展开并聚焦名称）。保存后服务器计划的 fitGoal、fitNote、力量项都对，起始值 2.5 不取整，目标页多出一张力量卡，本周健身目标行写新天数。
- **Task 2：** 力量项上移下移（只在未归档之间）、`dellift`（没有历史或草稿里新加的直接移除并撤销，有历史的归档确认）；`planProblems` 补力量项、健身规则；`liftHistoryCount`；打开编辑页就标出已有问题（`pe.preErr`）；力量项 8 个封顶；保存时删离开计划的 `state.lifts[id]`。
- **Task 3：** 基础预设标签分区（五张类别卡，没有上移下移，每个标签一行，`addtag`、行内上移下移删除、20 个封顶、重复和空标签的错误）；`presetsFor` 两层去重。

### 字段键和动作名（12-06、12-07 沿用）

| 类别 | 值 |
|------|----|
| 动作 `data-peact` | 新增 `addlift`、`dellift`、`addtag`；`up`、`down`、`del` 对标签行（键以 `p:` 开头）走标签的处理；`toggle` 对 `l:<id>`、`p:<类别键>` 照旧；12-04 已有的 `cat` 没有复用 |
| 卡片键 `data-pekey` / `data-key` | 力量项 `l:<id>`；预设类别 `p:<lang|pro|fit|job|oth>`；标签行 `p:<类别键>:<下标>` |
| 字段键 `data-pefield` | `fit:min`、`fit:max`、`fit:note`；`l:<id>:n`、`l:<id>:unit`、`l:<id>:target`、`l:<id>:def`、`l:<id>:note`；`p:<类别键>:<下标>` |
| 元素 id | 字段 `pe-f-` 加键用 `-` 连接（如 `pe-f-fit-min`、`pe-f-l-<id>-n`、`pe-f-p-lang-0`）；错误段落同后缀换成 `pe-e-`；计数 `pe-c-`；卡片内容 `pe-b-l-<id>`、`pe-b-p-<类别键>`；力量项摘要 `pe-s-l-<id>` |
| 读屏句子 | `已添加：新的力量项`、`已添加：新的标签`；移动、移除、恢复、归档沿用 12-04 的句子 |
| 应用常量 | `T_PE_FIT_*`、`T_PE_LIFTS_TITLE`、`T_PE_ADD_LIFT`、`T_PE_UNIT_EXAMPLE`、`T_PE_LIFT_UNIT/TARGET/DEF`、`T_PE_DEL_LIFT`、`T_PE_LIM_LIFTS`、`T_PE_ARCH_LIFT_TITLE/YES/BODY`、`T_PE_PRESETS_TITLE/NOTE/EMPTY`、`T_PE_ADD_TAG`、`T_PE_LIM_TAGS`、`T_PE_TAG_COUNT`；`PE_ERR` 补六加二条 |
| 函数 | 渲染 `peFitHTML`、`peLiftCard`、`pePresetsHTML`、`peTagRow`；动作 `peAddLift`、`peAddTag`、`peMoveTag`、`peDelTag`、`peUndoTag`；辅助 `peLift`、`peItem(kind,id)`（kind 为 group、task、lift）、`peNum`、`peCardOf(key)`、`peSeenTag`、`peTagAt` |

### planProblems 的完整代码表

返回按页面顺序：组与任务，再健身天数，再力量项，再标签。

| 代码 | 字段键 | 条件 | 文案（`PE_ERR`） |
|------|--------|------|------------------|
| `gname` | `g:<组 id>:name` | 未归档的组，名称 trim 后为空 | 请填写目标组名称 |
| `ttext` | `t:<任务 id>:text` | 未归档组里未归档的任务，文字 trim 后为空 | 请填写任务内容 |
| `fitint` | `fit:min` 或 `fit:max` | 这个数不是 0–7 的整数（含空串、小数、非数） | 请填 0 到 7 之间的整数 |
| `fitorder` | `fit:min` 和 `fit:max`（两个都报） | 两个数都合法而最少大于最多 | 最少天数不能大于最多天数 |
| `lname` | `l:<id>:n` | 未归档的力量项，名称 trim 后为空 | 请填写力量项名称 |
| `lunit` | `l:<id>:unit` | 单位 trim 后为空 | 请填写单位 |
| `ltarget` | `l:<id>:target` | 目标值不是大于 0 的有限数（含空串） | 目标值要大于 0 |
| `ldef` | `l:<id>:def` | 默认起始值不是不小于 0 的有限数（含空串） | 起始值不能小于 0 |
| `tag` | `p:<类别键>:<下标>` | 标签 trim 后为空 | 请填写标签内容 |
| `tagdup` | `p:<类别键>:<下标>` | trim 后与同类别前面某个标签相等（区分大小写），标在后出现的那一行 | 这个分类里已经有这个标签了 |

归档的组、任务、力量项不报。数值规则只在这里；`normalizePlan` 仍接受任何有限的 def 和两个有限的 fitGoal 数（目标值不大于 0 仍被它拒绝，与以前相同）。

### 其他落点

- **presetsFor 去重：** 约 1958 行，在 `.concat(s.add)` 之后接 `.filter((x,i,a)=>a.indexOf(x)===i)`（基础的在前，重名时留基础的那个）；隐藏、添加两层的其余逻辑不动。
- **savePlanDraft：** 差集里补力量项：新计划里不再有的力量项 id 且 `state.lifts[id]` 存在时，和任务、自定义待办一起放进同一个 `commit`（键 `lift:<id>`）里删除；归档的力量项仍在计划里，历史不动。同样只在 `keepOrphans` 为假时做。挡住保存时展开卡片用 `peCardOf`。
- **pe.gone：** 现在除 `task`、`group` 外还会出现 `kind:"lift"`（`item` 是力量项对象的深拷贝，`parent` 为 `null`，`index` 是它在 `pe.draft.lifts` 里的位置，含归档项）。12-07 的 D-08 复查要读它。标签的删除不进 `pe.gone`。
- **pe.preErr：** `openPlanEditor` 里设；`peBar` 在 `pe.tried||pe.preErr` 时显示第 4 条提示。

### 用例条数

- 新增 cloud 用例 **5 条**（`tests/cloud/plan-editor-fit.spec.ts`：Task 1 一条、Task 2 三条、Task 3 一条），默认套件单元用例 **1 条**（`planProblems` 的力量项与健身规则，加 `liftHistoryCount`）。
- 完整 `npm run test:cloud` **221 条全部通过**（12-04 的 216 条加本计划 5 条，REPORT OK，flaky 0，unexpected 0）；完整默认套件 **193 条全部通过**（192 加 1，REPORT OK，flaky 0，unexpected 0）。

## Task Commits

1. **Task 1（tracer）：每周健身目标、健身说明、添加力量项** - `39c88c9`（feat）
2. **Task 2：力量项排序、删除与归档、校验与上限、打开即标出已有问题、保存清理 state.lifts** - `a273cf6`（feat）
3. **Task 3：基础预设标签分区、presetsFor 去重** - `8959ccc`（feat）

**Plan metadata:** 见下一次 docs 提交

## Files Created/Modified

- `us-journey-tracker.html` - 纯函数段 liftHistoryCount、planProblems 的新规则；编辑页的健身和预设分区、力量项与标签的动作、打开即标出已有问题、保存清理；presetsFor 去重；少量样式
- `tests/support/constants.ts` - 每个任务重新记录 APP_SHA256
- `tests/support/strings.ts` - 三批文案常量和 `weekFitGoalLine`，逐字同步应用
- `tests/support/plan-editor.ts` - readEditor 的 groups 只读组卡，新增 `fit`、`lifts`
- `tests/cloud/plan-editor-fit.spec.ts` - 新，5 条 cloud 用例
- `tests/e2e/data/plan-normalize.spec.ts` - NAMES 加 `liftHistoryCount`，加 1 条单元用例

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### 计划内的小调整（没有触碰计划之外的测试，也没有放宽断言）

**1. [Rule 3 - 阻塞] readEditor 的 groups 要按 `data-key^="g:"` 取卡**
- **Found during:** Task 1
- **Issue:** 新增的力量项卡和预设卡也是 `.pe-card`，不改的话它们会混进 `readEditor().groups`，12-04 的用例（组数、顺序断言）会读错。
- **Fix:** `tests/support/plan-editor.ts`（本计划列出的文件）里把选择器限定为组卡；12-04 的 spec 一行没改，8 条 12-04 的 cloud 用例照常通过。
- **Commit:** `39c88c9`

**2. [Rule 1 - 用例自己的问题] 打开时已有问题的用例不能“不做修改就点保存”**
- **Issue:** 保存按钮在没有修改时是 disabled（12-03 的规则，没有改），计划里写的“点保存 → 服务器计划不变”无法在没有修改时点。
- **Fix:** 用例先改一处不相干的字段（健身说明），再点保存，断言被挡住、错误还在、服务器计划不变；改好后再保存。应用的规则没变。
- **Files modified:** `tests/cloud/plan-editor-fit.spec.ts`
- **Commit:** `a273cf6`

### 没有按计划原样执行的地方

- **Task 2 标了 `tdd="true"`，但本计划 `type: execute`**，没有计划级的 RED/GREEN 门禁。我先写了单元用例并对着当时的应用跑了一次（`liftHistoryCount` 不存在，整个文件失败，是预期的 RED），然后实现，应用和用例在同一次提交里（没有拆成 `test(...)`、`feat(...)` 两次提交，沿用 12-04 的做法）。
- 估计里的“拆分风险”没有触发：三个任务都在一个上下文里完成，没有拆开。

### 额外验证（不是偏差）

- 三个任务的 verify 之外，另外跑了 `plan-editor.spec.ts`、`plan-editor-groups.spec.ts`（共 15 条）、完整 cloud（221 条）和完整默认套件（193 条）。没有为此改动任何其他文件。
- **没有用到所有者预先批准的两项测试改动**（`readGroupIds` 和 SEC-01 的 `#goalsArch` 排除没有再次使用）。编辑页新增的元素是 `h4`、`ul`、`label`、`input`、`textarea`、`button`、`p`、`span`，没有 `s`、`details`、`img`、`iframe`、`svg`、`object`、`embed`，SEC-01 的检测没有受影响。
- 一次想中止慢速的完整 cloud 运行时，结束进程的命令被权限系统拒绝，没有绕过；那次运行自己跑完了（它在后半段明显变快，总共约 10 分钟）。

**Total deviations:** 2 条记录（一条阻塞性的测试辅助调整，一条用例自己的问题），1 条流程说明（tdd 标记）。

## Issues Encountered

- 工作区文件是 CRLF（`core.autocrlf=true`）：改应用的脚本读入后统一成 LF 做替换，写回时用 CRLF，APP_SHA256 按工作区文件的字节记录（同 12-04）。测试文件在工作区是 LF。
- 带多个单引号的 Python 多行字符串放进 Bash heredoc 解析失败，改用 Write 工具写脚本文件再运行（同 12-03、12-04）。

## Known Stubs

无。

## Threat Flags

无新增的安全相关面。T-12-16：标签分区只写 `pe.draft.presets`，保存路径不 commit presets，cloud 用例断言服务器 state 的 presets 保存前后逐字相同；T-12-17：数值规则只在 `planProblems`，`normalizePlan` 不收紧，已有计划在目标页、本周页照常显示，编辑页打开就标出并挡住保存，单元用例和“打开就标出”的 cloud 用例各证明一层；T-12-18：删除前看 `liftHistoryCount`，有历史只走确认后的归档，保存清理只删离开计划的 id，cloud 用例证明归档后服务器上的历史（3 条、当前值）还在，没有历史的力量项的 state 键被删掉；每处插值 `esc(...)`，toast 和读屏句子只用 `textContent`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

健身、力量项、基础预设标签的编辑和校验已就绪。12-06 的「已归档」区读 `archived:true` 的组、任务和力量项：恢复只需把草稿里 `archived` 去掉（力量项排到最后），彻底删除力量项只需从 `pe.draft.lifts` 去掉，保存清理已经会删 `state.lifts[id]`；恢复一个归档力量项会超过 8 个时要禁用恢复按钮（`PLAN_MAX.lifts`，只数未归档的）。12-07 的 D-08 复查读 `pe.gone`（现在会有 `kind:"lift"`），力量项的进度判断用 `liftHistoryCount(state,id)`。12-08 的真实浏览器验收请所有者看：力量项卡的折叠外观与 8 张卡的滚动、两个天数框同时标红、预设类别卡的行布局（窄屏）、「撤销移除」toast 的位置。

## Self-Check: PASSED

- 文件存在：`tests/cloud/plan-editor-fit.spec.ts`、`12-05-SUMMARY.md` 在磁盘上，前者已提交。
- 提交存在：`39c88c9`、`a273cf6`、`8959ccc` 都在当前分支上；`git rev-list --count` 从 plan_head_before 到 HEAD 为 3。
- 验收：三个任务的 grep 门槛、五个锚点各一次、APP_SHA256 与文件一致、migrate-backup 自检通过（59 项）、各任务 cloud 命令（8 条、9 条、12 条）与默认命令（50 条、12 条、48 条）REPORT OK 且含各任务标题（含 SAFE-02、WEEK-04 两条、SEC-01）、完整 cloud 221 条和完整默认 193 条 REPORT OK、暂存隐私检查三次通过。
