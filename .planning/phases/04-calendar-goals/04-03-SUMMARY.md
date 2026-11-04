---
phase: 04-calendar-goals
plan: 03
subsystem: testing
status: complete
tags: [goals, task-check, due-date, overdue, custom-todo, blank-add, known-bug, N1, readme, privacy-masking, manual-clock, account-mock, playwright]

requires:
  - phase: 04-calendar-goals
    provides: "04-01 的 check-report.mjs verify 形状、calendar.ts 的 gotoCalendar 与 readMonth、expectedMonthCells；04-02 的 goals.ts 的 gotoGoals 与 readGroups、expectedGroup、toast 后缀和片段 helper"
  - phase: 03-composer-editor-week
    provides: "composer(page, 'w' | 'c')、toast helper、app.saved/expectSaved、knownBug 与登记护栏、manual 时钟加写入次数加哨兵的模板"
provides:
  - "tests/support/goals.ts：checkTask、setDue、readTaskRow；内置任务只在页面内按位置 id 勾选、设置截止日期和读回，读回只有布尔、日期、固定文案和 id"
  - "tests/support/strings.ts 新增 TOAST_TASK_DONE、GOAL_DONE_ON_PREFIX、GOAL_DUE_LABEL"
  - "tests/e2e/goals/tasks.spec.ts：两条 GOAL-03、两条 GOAL-04、三条 GOAL-05 用例（一条在 manual 时钟下）"
  - "N1 的两种新触发各一对用例并登记：tests/e2e/calendar/known-bugs.spec.ts（日面板删除记录）、tests/e2e/goals/known-bugs.spec.ts（目标页勾选任务）"
  - "tests/KNOWN-BUGS.md 与 tests/README.md 的约定更新（D-16、Phase 3 审查 IN-08、IN-05）"
affects: [phase-05]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3
plan_head_before: f82a3005aaa2a1ebf1321afd8009c2b3c19c0eae
plan_head_after: 9d226a87d413c17965cce6e55de873a58f869219

tech-stack:
  added: []
  patterns:
    - "内置任务的勾选和截止日期都在 page.evaluate 里按 id 完成（元素自己的 click()、设值加派发 change），Node 侧只断言返回值，失败消息只含 id"
    - "组计数、进度条和日历整月格子都由 await app.saved() 的保存后状态经 expectedGroup、expectedMonthCells 推导，勾选和改日期的连带变化（今天的完成数、原来的到期日）由推导带出来，不写死数字"
    - "N1 新触发沿用 B1 的一对用例写法：对照用例证明草稿确实输入、触发确实走了对应分支，标记用例第一句 knownBug 且只断言草稿仍在"
    - "合成自定义待办 c-synth-1、c-synth-3 和用例新加的 SYNTH- 待办用真实的点击和填写，内置任务一律不用定位器动作"

key-files:
  created:
    - tests/e2e/goals/tasks.spec.ts
    - tests/e2e/goals/known-bugs.spec.ts
  modified:
    - tests/support/goals.ts
    - tests/support/strings.ts
    - tests/e2e/calendar/known-bugs.spec.ts
    - tests/KNOWN-BUGS.md
    - tests/README.md

key-decisions:
  - "N1 的日面板删除、目标页勾选两种触发都先去掉标记亲眼复现，再恢复标记，最终用 test.fail，没有用 test.fixme，也没有出现未复现的触发，所以没有走计划里的退路"
  - "目标页勾选的对照用例在本周标签上先断言草稿值和记录按钮可用，再切到目标页触发，准备函数只负责输入草稿，让标记用例的准备与触发和对照用例完全一致"
  - "取消勾选后日期框回到 fixture 的原截止日期、重新显示已过期，这是由推导和读回共同确认的，不写进断言之外的假设"
  - "README 的 manual 时钟说明改为三类用途，已知 bug 写法改为一条或多条对照用例加一条 test.fail，标记用例的预期现象改为列表带 x 但汇总计为通过（IN-05、IN-08）"

requirements-completed: [GOAL-03, GOAL-04, GOAL-05]

coverage:
  - id: D1
    description: "页面内勾选已过期的内置任务后 toast 为完成，保存的 done 为真、doneDate 为冻结的今天、due 保持 fixture 原值；行带 isdone、截止日期框消失、显示完成于 M月D日；所在组的已完成数比 fixture 推导的多 1，七个组与推导逐项一致；日历整月格子与推导逐格一致"
    requirement: "GOAL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-03 checking a built-in task records today as the done date and updates the group count and bar"
        status: pass
    human_judgment: false
  - id: D2
    description: "取消勾选今天完成的内置任务后 done 为假、doneDate 为空字符串、截止日期保留；因为截止日期早于今天，该行重新显示已过期，日期框回到原值；组和日历整月格子与推导一致"
    requirement: "GOAL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-03 unchecking a done task clears the done date, keeps its due date and shows it as overdue again"
        status: pass
    human_judgment: false
  - id: D3
    description: "内置任务的截止日期改到早于今天后保存、显示已过期；截止日期等于今天的行显示截止且不过期；已过期 id 集合由推导带出"
    requirement: "GOAL-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-04 a due date before today marks the task as overdue and a due date of today does not"
        status: pass
    human_judgment: false
  - id: D4
    description: "合成自定义待办 c-synth-1 的截止日期填过去、将来和清空，每次都保存，行的已过期状态随之变化，日历到期 chip 跟着移动（整月格子与推导逐格一致）"
    requirement: "GOAL-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-04 setting and clearing a due date on a custom todo saves it and moves the due chip in the calendar"
        status: pass
    human_judgment: false
  - id: D5
    description: "在 P1 用 Enter、在 P2 用添加按钮各新增一条 c- 开头的自定义待办并保存；七个组的任务数和计数与推导一致，总数加 2；新行 aria-label 是各自的合成文字、各有删除按钮；输入框随重绘清空"
    requirement: "GOAL-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-05 adding a todo with Enter or the add button creates a custom task in that group and saves it"
        status: pass
    human_judgment: false
  - id: D6
    description: "删除 fixture 的合成待办和一条先设过截止日期的新待办后，custom 和 tasks 里都没有它；内置任务的行没有删除按钮（五个内置 id 逐个计数为 0），删除按钮总数等于保存后 custom 的条数"
    requirement: "GOAL-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-05 deleting a custom todo removes it with its task state and built-in tasks have no delete button"
        status: pass
    human_judgment: false
  - id: D7
    description: "manual 时钟下空白文字按 Enter 或点添加都不新增，推过防抖后写入次数和任务个数不变；之后的合成哨兵使写入次数恰好加 1"
    requirement: "GOAL-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/tasks.spec.ts#GOAL-05 a blank todo is not added and nothing is saved"
        status: pass
    human_judgment: false
  - id: D8
    description: "N1 的日面板删除触发：对照用例证明草稿确实输入、删除按钮走了 deleteLog（toast 为已删除并带撤销、记录消失、弹窗没打开、保存里没有该记录）；标记用例（test.fail）只断言草稿仍在"
    requirement: "GOAL-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/known-bugs.spec.ts#BUG-01 N1 delete control: the day-panel draft is typed and the delete button removes the entry"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/known-bugs.spec.ts#BUG-01 N1 delete expected: the day-panel draft survives deleting an entry"
        status: pass
    human_judgment: false
  - id: D9
    description: "N1 的目标页勾选触发：对照用例证明草稿确实输入、勾选走了勾选分支（toast 为完成、保存里合成待办已完成、切回本周 composer 仍恰好一个）；标记用例（test.fail）只断言草稿仍在；四条新标题登记在 KNOWN-BUGS.md 的 N1 行，登记护栏通过"
    requirement: "GOAL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/known-bugs.spec.ts#BUG-01 N1 goals control: the week draft is typed and checking a task saves it as done"
        status: pass
      - kind: e2e
        ref: "tests/e2e/goals/known-bugs.spec.ts#BUG-01 N1 goals expected: the week draft survives checking a task"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/known-bugs-registry.spec.ts#BUG-01 every known-bug test is registered in tests/KNOWN-BUGS.md and every registered title exists"
        status: pass
    human_judgment: false
  - id: D10
    description: "README 与 KNOWN-BUGS 的约定更新：manual 时钟三类用途、一条或多条对照用例加一条 test.fail、check-report.mjs 用法、calendar 和 goals 两个目录与两个 helper"
    verification:
      - kind: other
        ref: "tests/README.md 和 tests/KNOWN-BUGS.md 的 grep 验收（含旧句子已删除）"
        status: pass
    human_judgment: false
  - id: D11
    description: "失败输出里确实不会出现内置任务原文（包括 Playwright 调用日志里的元素预览）"
    verification: []
    human_judgment: true
    rationale: "所有用例都通过，没有触发失败路径；脱敏靠结构约束保证（内置任务只经 checkTask、setDue、readTaskRow 在页面内按 id 操作和读回，grep 护栏拒绝勾选类方法、可见性断言和固定睡眠，真实点击和填写只用于合成待办），是否真的不泄露要靠人在一次故意失败的运行里核对"

duration: 11min
completed: 2026-11-04
---

# Phase 4 Plan 03: 目标视图的任务交互 GOAL-03 到 GOAL-05、N1 两种新触发与约定文档更新 Summary

**内置任务只在页面内按位置 id 勾选、改截止日期并读回布尔、日期和固定文案，组计数、进度条和日历整月格子全部由保存后的状态推导；取消勾选、过去今天将来和清空的截止日期、自定义待办的增删（连同任务状态）和空白不添加都有用例，N1 在日面板删除记录和目标页勾选任务两种触发各补一对 test.fail 用例并登记，README 与 KNOWN-BUGS 的约定同步更新，Phase 4 的九项需求全部有用例。**

## 执行情况

- 3 个任务（1 个 tracer、2 个 auto），3 个提交，新建 2 个文件，修改 5 个文件，新增 11 条用例（2 条 GOAL-03、2 条 GOAL-04、3 条 GOAL-05、4 条 N1），没有新增依赖，没有运行任何安装命令，没有运行除 `npx --no playwright` 以外的 npx（用的是 `npm test`）。
- `us-journey-tracker.html` 全程未改、未被跟踪，sha256 为基线值 `2a954fd0…8a1872`。
- 开始 2026-11-04T02:03Z，结束 02:15Z 左右。

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 75a7f0a | checkTask、readTaskRow、三个文案常量、勾选内置任务的 GOAL-03 用例（组和日历同步） |
| 2 | cc6e9c7 | setDue、取消勾选、截止日期（过去、今天、将来、清空）、自定义待办增删、manual 时钟下空白不添加 |
| 3 | 9d226a8 | N1 两对用例、KNOWN-BUGS.md 登记和约定、README 更新 |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式）：重跑 tasks.spec.ts 并由 check-report.mjs 判定为 `REPORT OK`，记录 “Tracer verified end-to-end — expanding” 后展开 Task 2。

## 观察值

- **N1 两种新触发的复现（D-17）：** 两条标记用例都先临时注释掉 `knownBug`，用低优先级加 `--retries=0` 跑对应文件各一次：对照用例都通过，标记用例都失败，失败点正是 `toHaveValue` 的草稿断言，实际值都是空字符串（超时 2 秒）。日面板删除触发失败在日面板 composer（`#dayPanel` 内的文本框），目标页勾选触发失败在本周 composer（`#wkComp` 内的文本框）。随后恢复标记，两处最终都是 `test.fail`，没有用 `test.fixme`，没有出现“未复现、已删除”的情形，所以没有走计划里的退路，verify 的标题清单保持不变。
- **推导与应用的一致性：** 勾选、取消勾选、改截止日期、添加和删除之后，七个组的整体 toEqual 和日历整月格子与由保存后状态推导的结果都第一次运行就一致，没有重试，没有调整任何期望，没有登记新的应用 bug。
- **核对提示的验证：** 勾选已过期的内置任务（位于 3 月 10 日到期）会让 3 月 10 日那格的到期少一个、今天那格的完成多一个（今天原来已有一个完成），这些都由推导带出，用例没有写死数字；取消勾选的内置任务保留 fixture 的原截止日期（早于今天），所以重新显示已过期。
- **日期框清空：** `fill('')` 对日期框会清空并触发保存，`expectSaved` 等到 due 为空字符串，不需要退回页内设值加派发 change 的写法（用例注释里保留了这条退路）。
- **空白不添加：** manual 时钟下三个空格按 Enter 和点添加之后推过 2 秒，写入次数和任务个数都不变；哨兵之后写入次数恰好加 1，没有时序问题。
- **完整套件（本计划唯一一次）：** 低优先级单 worker，`REPORT OK expected=132 flaky=0 unexpected=0`（121 条加 11 条新增，用时约 2.8 分钟）；check-report.mjs 对本计划十一个标题、登记护栏标题和 SAFE-02 标题都通过，标记用例以预期失败计为通过。
- **其它收尾检查：**
  - `node tools/privacy/privacy-check.mjs --all` 退出 0（136 个文件）；三次提交的 pre-commit 隐私检查都一次通过。
  - toast 可见性、固定睡眠、勾选类方法三项 grep 护栏全部通过。
  - `git ls-files us-journey-tracker.html` 输出为空；SAFE-02 的 sha256 用例通过，应用文件哈希与基线一致。

## Deviations from Plan

None - plan executed exactly as written.

执行中的小说明（不是偏离）：
- 本仓库 `core.autocrlf=true`，工作区文件的行尾有 LF 和 CRLF 两种（`tests/support/expect-from-fixture.ts` 是 CRLF，其余多数是 LF，索引里全是 LF）。执行中追加内容时一度把 goals.ts 和 strings.ts 的新增部分写成了 CRLF，在提交之前已整体恢复为 LF，三次提交都经 pre-commit 隐私检查；`tests/support/expect-from-fixture.ts` 本计划没有改动。`grep -c $'\r'` 在这个环境里会把每一行都数进去，行尾核对改用 node 脚本。
- 目标页勾选的对照用例把准备函数拆成“在本周输入草稿”和“切到目标页取复选框”两步，这样对照用例能在切页之前断言草稿值和记录按钮可用，标记用例的准备与触发和对照用例仍然完全一致。
- 提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`。

## 假设（有意不验证的边界行为，是假设，不是已验证的行为）

- 取消勾选后再勾选时完成日期是新的今天不单独验证；本周类别计数和时间线与任务勾选的联动只由 Phase 3 的推导间接覆盖。
- 已完成任务的截止日期仍留在状态里但不显示，只由取消勾选的用例间接覆盖；原生日期选择器不操作。
- 新待办添加后立刻勾选不验证，只验证了先设日期再删除；删除没有撤销是应用现状，不作为期望行为。
- N1 的拖拽和改抵达日期两种触发仍未验证，留给后续阶段（登记表里写明）。
- 内置任务的文字、组标题和说明都不验证（个人计划文字）。

## Known Stubs

None。本计划只产出测试 helper、用例、文案常量和文档，没有占位数据或未接线的组件。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-04-10：内置任务只经 checkTask、setDue、readTaskRow 在页面内按 id 操作和读回，grep 护栏拒绝勾选类方法，真实点击和填写只用于合成待办；T-04-11：空白不添加在 manual 时钟下推过防抖后比较写入次数和任务个数，再用合成哨兵证明窗口推进；T-04-12：两条标记用例都先去掉标记亲眼复现，每条都有对照用例，登记护栏双向通过；T-04-13：README 与 KNOWN-BUGS 的约定与实际用法一致，旧说法已删除；T-04-14：所有新文字只用合成文字、id 和固定文案，提交经隐私钩子，收尾 `privacy-check --all` 通过；T-04-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

Phase 4 的九项需求（CAL-01 到 CAL-04、GOAL-01 到 GOAL-05）都有用例，B1 日历实例、撤销 toast 过期和 N1 两种新触发都已登记。Phase 5 可以复用 check-report.mjs 的 verify 形状、goals.ts 与 calendar.ts 的页面内读回模式，以及更新后的 README 与 KNOWN-BUGS 约定；待办是 B2、N3 和视觉窄屏等 Phase 5 范围。

## Self-Check: PASSED

- tests/support/goals.ts、tests/e2e/goals/tasks.spec.ts、tests/e2e/goals/known-bugs.spec.ts、tests/e2e/calendar/known-bugs.spec.ts、tests/KNOWN-BUGS.md、tests/README.md 存在
- 提交 75a7f0a、cc6e9c7、9d226a8 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 3
- 三个任务的验收命令全部通过；完整套件 132 条通过且 flaky 为 0；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
