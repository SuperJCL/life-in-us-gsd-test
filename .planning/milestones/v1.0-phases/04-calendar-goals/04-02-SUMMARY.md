---
phase: 04-calendar-goals
plan: 02
subsystem: testing
status: complete
tags: [goals, goal-groups, lift-cards, lift-save, history, reached-toast, manual-clock, privacy-masking, account-mock, playwright]

requires:
  - phase: 04-calendar-goals
    provides: "04-01 的 check-report.mjs verify 形状、calendar.ts 的页面内读回加 Node 侧比较的写法"
  - phase: 03-composer-editor-week
    provides: "toast helper、app.saved/expectSaved、manual 时钟加写入次数加哨兵的模板"
provides:
  - "tests/support/goals.ts：gotoGoals、readGroups、readLifts、liftHistoryEquals；只读组号、计数、id、进度条数值和布尔"
  - "tests/support/expect-from-fixture.ts 的目标推导：expectedGroup、liftHistoryText；类型 GoalState、GroupExpectation"
  - "tests/support/toast.ts 的 expectToastSuffix、expectToastContains，失败消息固定为“内容已隐藏”"
  - "tests/support/strings.ts 新增 LIFT_REACHED_SUFFIX、LIFT_UPDATED_INFIX、LIFT_HISTORY_SEPARATOR"
  - "tests/e2e/goals/：overview.spec.ts 两条 GOAL-01 用例，lifts.spec.ts 四条固定时钟和一条 manual 时钟的 GOAL-02 用例"
affects: [phase-04-plan-03, phase-05]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 2c7a461e1ca72b9ce9fea4e35cf34f4e6dd8adbc
plan_head_after: 4fe8095ec5645533f11b58d60a646f237d6a1034

tech-stack:
  added: []
  patterns:
    - "七个目标组和四张力量卡各用一次 page.evaluate 读回，Node 侧与独立推导整体 toEqual 比较"
    - "goals.ts 与 expect-from-fixture.ts 各自声明同形类型（GroupRead、GroupExpectation），互不导入"
    - "含个人计划文字的 toast 只经后缀或片段 helper 在 Node 侧比较，失败消息固定"
    - "力量卡上的定位器动作只限 bench、squat 的输入框和保存按钮四个豁免元素，其余只经 readLifts 读回布尔和数值"

key-files:
  created:
    - tests/support/goals.ts
    - tests/e2e/goals/overview.spec.ts
    - tests/e2e/goals/lifts.spec.ts
  modified:
    - tests/support/expect-from-fixture.ts
    - tests/support/toast.ts
    - tests/support/strings.ts

key-decisions:
  - "每组的总数取 DOM 里的内置任务个数，内置 id 由 expectedGroup 按位置 id 1 到 N 构造，这样既不复制任务原文，也把 B10（位置 id）特征化进了整体 toEqual"
  - "很小的值用常量 1 和 2、极大值用 999999，不写任何目标数值；不达标分支由“已更新为 ”片段加进度条在 0 到 100 之间（不含两端）证明，达标分支由后缀加进度条正好 100 证明"
  - "readLifts 对另外两张卡只返回序号和布尔，id 不带回 Node；当前值只取 .lv 里目标子元素之前的文字节点，在页面内与输入框比较"

requirements-completed: [GOAL-01, GOAL-02]

coverage:
  - id: D1
    description: "P1 到 P7 七个目标组的组号顺序、.cnt、进度条数值、任务 id 序列（内置位置 id 连续加自定义在后）、已完成行、已过期行、截止日期输入框和删除按钮都与 expectedGroup 的推导一致；防空转断言保证 fixture 的每个任务都出现、有已完成和已过期的组、删除按钮总数等于自定义任务数"
    requirement: "GOAL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/overview.spec.ts#GOAL-01 the seven goal groups show done counts and progress bars derived from the fixture"
        status: pass
    human_judgment: false
  - id: D2
    description: "恰好 4 张力量卡，每张保存按钮带 hidden 类、输入框的值等于显示的当前值、进度条在 0 到 100 之间；fixture 里有状态的两张卡的值和历史行与推导一致，另外两张卡没有历史前缀"
    requirement: "GOAL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/overview.spec.ts#GOAL-01 every lift card hides its save button and shows a value, bar and history consistent with the fixture"
        status: pass
    human_judgment: false
  - id: D3
    description: "改值后保存按钮才去掉 hidden 类，改回当前值后又带上"
    requirement: "GOAL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/lifts.spec.ts#GOAL-02 the save button appears only after the value changes and hides again for the current value"
        status: pass
    human_judgment: false
  - id: D4
    description: "点保存和按 Enter 都保存新值，历史在 fixture 之后追加冻结的今天，历史行是最近 3 条用全角逗号连接，toast 含已更新为加新值"
    requirement: "GOAL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/lifts.spec.ts#GOAL-02 saving with the button appends today to the history, shows the last three and saves the value"
        status: pass
      - kind: e2e
        ref: "tests/e2e/goals/lifts.spec.ts#GOAL-02 pressing Enter saves a small value with the updated toast"
        status: pass
    human_judgment: false
  - id: D5
    description: "极大值保存后 toast 以达标了结尾，进度条宽度正好 100%"
    requirement: "GOAL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/lifts.spec.ts#GOAL-02 a very large value reaches the target, caps the bar at 100% and shows the reached toast"
        status: pass
    human_judgment: false
  - id: D6
    description: "manual 时钟下失焦、输入负数按 Enter 推过防抖后写入次数不变，负数后输入框恢复当前值；哨兵保存使写入次数恰好加 1"
    requirement: "GOAL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/lifts.spec.ts#GOAL-02 blurring the field or entering a negative value saves nothing"
        status: pass
    human_judgment: false
  - id: D7
    description: "失败输出里确实不会出现力量名称、目标、备注、内置任务原文、组标题和组说明（包括 Playwright 调用日志里的元素预览）"
    verification: []
    human_judgment: true
    rationale: "所有用例都通过，没有触发失败路径；脱敏靠结构约束保证（读回只有 id、数值和布尔，toast 只在 Node 侧比较固定片段，定位器动作只限四个豁免元素，grep 护栏拒绝名称、目标和历史行选择器），是否真的不泄露要靠人在一次故意失败的运行里核对"

duration: 6min
completed: 2026-11-04
---

# Phase 4 Plan 02: 目标视图 GOAL-01、GOAL-02 与力量值保存 Summary

**用独立的 expectedGroup 从 fixture 推导七个目标组，一次页面内读回整体比较；四张力量卡只读序号、LIFT_IDS 里的 id、数值和布尔，点保存、按 Enter、达标与不达标的 toast（只比较后缀和片段）、100% 上限和 manual 时钟下的“失焦和负数不保存”都有用例，全程不出现任何力量名称和目标数值。**

## 执行情况

- 2 个任务（1 个 tracer、1 个 auto），2 个提交，新建 3 个文件，修改 3 个文件，新增 7 条用例（2 条 GOAL-01、5 条 GOAL-02），没有新增依赖，没有运行任何安装命令，没有运行除 `npx --no playwright` 以外的 npx。
- `us-journey-tracker.html` 全程未改、未被跟踪，sha256 为基线值 `2a954fd0…8a1872`。
- 开始 2026-11-04T01:54Z，结束 02:00Z 左右。

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 69bf7b6 | goals.ts 的 gotoGoals 与 readGroups、expectedGroup 推导、七个目标组用例 |
| 2 | 4fe8095 | 三个文案常量、两个 toast helper、liftHistoryText、readLifts 与 liftHistoryEquals、力量卡用例和 lifts.spec.ts |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式）：重跑 overview.spec.ts 并由 check-report.mjs 判定为 `REPORT OK`，记录 “Tracer verified end-to-end — expanding” 后展开 Task 2。

## 观察值

- **推导与应用的一致性：** 七个目标组的整体比较第一次运行就与 expectedGroup 一致（组号、计数、进度条数值、任务 id 序列、已完成行、已过期行、截止日期输入框、删除按钮），没有重试，没有调整任何期望，没有登记新的应用 bug。内置位置 id 从 1 开始连续，自定义任务按 fixture 的顺序排在内置任务之后。
- **很小的值落在不达标分支：** 是。保存 1 和 2 之后 toast 含“已更新为 ”加该值，进度条宽度严格大于 0 且小于 100；极大值保存后 toast 以“达标了”结尾，进度条宽度正好 100。
- **历史追加而不是替换：** fixture 里两项力量的最后一条历史都不是冻结的今天，所以保存后历史长度加 1、最后一条是冻结的今天，前面各条不变；同一天替换和 30 条上限仍按 04-CONTEXT 的 Deferred 不验证。
- **manual 时钟：** 失焦和输入负数按 Enter 后各推 2 秒，写入次数不变；负数后输入框恢复为 fixture 的当前值、保存按钮带 hidden 类；哨兵保存之后写入次数恰好加 1。没有时序问题。
- **阶段收尾检查：**
  - 目标目录的低优先级单 worker 运行：7 条通过，`REPORT OK expected=7 flaky=0 unexpected=0`。
  - 本计划唯一一次完整套件：`REPORT OK expected=121 flaky=0 unexpected=0`（114 条加 7 条新增），check-report.mjs 对本计划七个标题和 SAFE-02 标题都通过。
  - `node tools/privacy/privacy-check.mjs --all` 退出 0（133 个文件）；两次提交的 pre-commit 隐私检查都一次通过。
  - toast 可见性、固定睡眠、勾选类方法和力量名称、目标、历史行选择器的四项 grep 护栏全部通过；`git ls-files us-journey-tracker.html` 输出为空；SAFE-02 的 sha256 用例通过。

## Deviations from Plan

None - plan executed exactly as written.

执行中的小说明（不是偏离）：expect-from-fixture.ts 是 CRLF 行尾，追加内容和修改导入都用脚本保持 CRLF，改动后全文件仍是 497/498 行全 CRLF；其余新文件为 LF，与仓库既有同类文件一致。提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`。

## 假设（有意不验证的边界行为，是假设，不是已验证的行为）

- 组标题、组说明、任务文字和力量名称、目标、单位、备注都不验证（个人计划文字）；P2 组的说明文字只存在、不读；健身那一组的说明同样不读。
- 力量历史 30 条上限和同一天替换已推迟（04-CONTEXT 的 Deferred），本计划没有构造专门的 fixture。
- 空值和非数字输入只由负数这一种代表；与当前值相同的保存（不重绘以外的无操作）不单独验证。
- “很小的值低于目标、极大值高于目标”是假设；不成立时用例会在片段比较或进度条断言上失败，失败消息不含名称。
- fixture 里没有状态的另外两张卡只验证不变量（保存按钮隐藏、值等于当前值、进度条在 0 到 100 之间、没有历史前缀），不保存、不比较具体值。

## Known Stubs

None。本计划只产出测试 helper、用例和文案常量，没有占位数据或未接线的组件。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-04-06：力量卡的定位器动作只限四个豁免元素，其余经 readLifts 读回序号、LIFT_IDS 里的 id、数值和布尔，toast 只经后缀或片段 helper 比较；T-04-07：readGroups 只读组号、计数、id、进度条数值和类名，grep 护栏拒绝勾选类方法；T-04-08：manual 时钟下推过防抖后比较写入次数，再用哨兵保存证明窗口推进且没有多余写入；T-04-09：不写目标数值，两个分支分别由后缀加 100% 和固定片段加进度条区间证明；T-04-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

GOAL-01、GOAL-02 都有用例。04-03 可以复用 goals.ts 的 gotoGoals、readGroups（含已完成、已过期、截止日期和删除按钮的读回）和 expectedGroup 的推导来验证勾选、截止日期、自定义待办的增删，并补 N1 的两种新触发、README 与 KNOWN-BUGS 约定更新。

## Self-Check: PASSED

- tests/support/goals.ts、tests/e2e/goals/overview.spec.ts、tests/e2e/goals/lifts.spec.ts 存在
- 提交 69bf7b6、4fe8095 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 2
- 两个任务的验收命令全部通过；完整套件 121 条通过且 flaky 为 0；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
