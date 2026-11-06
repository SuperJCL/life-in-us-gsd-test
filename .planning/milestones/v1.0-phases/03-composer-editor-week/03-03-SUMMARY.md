---
phase: 03-composer-editor-week
plan: 03
subsystem: testing
status: complete
tags: [editor, dialog, edit-entry, delete-undo, completed-task, manual-clock, readme, privacy-masking, account-mode, playwright]

requires:
  - phase: 03-composer-editor-week
    provides: "03-01 的 toast helper 和 app.saved/expectSaved；03-02 的 mdLabel、weekCountsByCategory 等推导函数；03-04 的 knownBug 与登记护栏"
provides:
  - "tests/support/editor.ts：editor(page)，封装 dialog#editor 的打开、修改、保存、删除、取消、标记为未完成和开关断言"
  - "tests/support/expect-from-fixture.ts 的 timelineDateLabel"
  - "tests/support/strings.ts 新增 EDITOR_TITLE_LOG、EDITOR_TITLE_TASK、TOAST_SAVED、TOAST_SAVED_MOVED_PREFIX、TOAST_EMPTY_TEXT、TOAST_LOG_DELETED、TOAST_RESTORED、TOAST_MARKED_UNDONE"
  - "tests/e2e/editor/edit-entry.spec.ts：四条 EDIT-01 用例；delete-entry.spec.ts：两条 EDIT-02 用例；task-editor.spec.ts：两条 EDIT-03 用例"
  - "tests/README.md 的“共享 helper”和“已知 bug”两节，以及更新后的目录表"
affects: [phase-04, phase-05]

actuals:
  tokens: 11000
  tasks: 3
  commits: 3
plan_head_before: badaa2e9012f6d92b198c3ad79cee23557a56e5f
plan_head_after: b9c0e8c6c0ad5e01ffb04833a298a6b6ed3d275f

tech-stack:
  added: []
  patterns:
    - "editor(page) 只返回定位器和动作，类别按钮会重绘整个表单，所以每一步都重新定位，不持有元素句柄"
    - "三个入口共用 expectLogInEveryView：保存后依次检查本周、日历、时间线三个视图里的文字、类别和日期位置，只按合成 id 定位"
    - "“没有保存”只在 manual 时钟下断言：runFor(2_000) 后比较 app.backend.writes.length，再用哨兵写入证明窗口确实推进了防抖"
    - "已完成计划的弹窗只为合成的自定义计划 c-synth-2 打开，内置计划不碰"

key-files:
  created:
    - tests/support/editor.ts
    - tests/e2e/editor/edit-entry.spec.ts
    - tests/e2e/editor/delete-entry.spec.ts
    - tests/e2e/editor/task-editor.spec.ts
  modified:
    - tests/support/strings.ts
    - tests/support/expect-from-fixture.ts
    - tests/README.md

key-decisions:
  - "弹窗打开和关闭只看 dialog 的 open 属性，不用可见性断言"
  - "保存后的其余记录与 fixture 的比较用 JSON 全等（布尔），第一次运行就通过，没有改成字段投影"
  - "完成计划弹窗的用例只用 c-synth-2，用 ed.text 个数为 0 证明它没有文本框"

requirements-completed: [EDIT-01, EDIT-02, EDIT-03]

coverage:
  - id: D1
    description: "从本周视图打开记录：文本框预填原文并获得焦点，日期和类别是原值，选中日不变；先改文字再改类别时文字保留，改日期保存后 toast 为已保存，移到 M月D日；保存后的记录是新值、其余记录与 fixture 相同；本周五类计数等于对修改后状态的推导；三个视图都显示新文字、新类别，位置在新日期"
    requirement: "EDIT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/edit-entry.spec.ts#EDIT-01 editing an entry from the week view updates text, category and date in every view and saves them"
        status: pass
    human_judgment: false
  - id: D2
    description: "从日历日面板的记录文字处打开，Ctrl+Enter 保存；从时间线打开、不改日期时 toast 只是已保存、日期保持原值；两个入口保存后三个视图都同步更新"
    requirement: "EDIT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/edit-entry.spec.ts#EDIT-01 editing an entry from the calendar day panel saves with Ctrl+Enter and updates every view"
        status: pass
      - kind: e2e
        ref: "tests/e2e/editor/edit-entry.spec.ts#EDIT-01 editing an entry from the timeline without changing its date keeps it in place and updates every view"
        status: pass
    human_judgment: false
  - id: D3
    description: "取消、Escape、点遮罩三种方式都关闭弹窗并丢弃修改，重新打开是原文；manual 时钟推过防抖后写入次数不变，哨兵写入随后到达 mock"
    requirement: "EDIT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/edit-entry.spec.ts#EDIT-01 cancel, Escape and a backdrop click close the editor and save nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "在弹窗里删除记录后弹窗关闭，toast 为已删除这条记录并带撤销按钮，保存后的 logs 里没有它；撤销后 toast 为已恢复，记录回到原来的列，保存后 logs 的 id 顺序与 fixture 完全相同"
    requirement: "EDIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/delete-entry.spec.ts#EDIT-02 deleting an entry from the editor removes it and undo restores it at its original position"
        status: pass
    human_judgment: false
  - id: D5
    description: "文字只剩空白时点保存，弹窗仍打开、toast 提示内容不能为空、文本框获得焦点；manual 时钟推过防抖后写入次数不变、记录文字不变；随后用合法文字保存，哨兵写入到达 mock"
    requirement: "EDIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/delete-entry.spec.ts#EDIT-02 saving empty text keeps the editor open, shows the hint and writes nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "完成计划的弹窗（合成的自定义计划 c-synth-2）：标题、完成日期预填原值、没有文本框；改日期保存后 tasks 里 done 为 true、doneDate 为新日期，其余计划不变，条目移到新日期那一列，时间线日期标签更新"
    requirement: "EDIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/task-editor.spec.ts#EDIT-03 the completed-task editor moves the completion date and saves it"
        status: pass
    human_judgment: false
  - id: D7
    description: "标记为未完成：toast 为已改回未完成，tasks 里 done 为 false、doneDate 为空字符串，条目从时间线和本周消失，目标页复选框仍在且未勾选"
    requirement: "EDIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/editor/task-editor.spec.ts#EDIT-03 the completed-task editor can mark the task as not done"
        status: pass
    human_judgment: false
  - id: D8
    description: "失败输出里确实不会出现内置计划文字（包括 Playwright 调用日志里的元素预览和 strict mode 报错）"
    verification: []
    human_judgment: true
    rationale: "所有用例都通过，没有触发失败路径；脱敏靠结构约束保证（只按合成 id 定位、动作只落在合成条目、日历格、标签页和弹窗控件上、不对整个容器做文字断言、toast 在 Node 侧比较），是否真的不泄露要靠人在一次故意失败的运行里核对"

duration: 19min
completed: 2026-11-03
---

# Phase 3 Plan 03: 编辑弹窗 helper 与 EDIT-01、EDIT-02、EDIT-03 用例 Summary

**`editor(page)` helper 封装了编辑弹窗；用它从本周、日历、时间线三个入口修改记录并检查三个视图同步，在 manual 时钟下证明取消、Escape、点遮罩和空文字都不会保存，验证了删除加撤销和合成自定义计划的完成日期、改回未完成；README 补全了共享 helper 与已知 bug 约定。**

## 执行情况

- 3 个任务（1 个 tracer、2 个 auto），3 个提交，新建 4 个文件，修改 3 个文件，8 条新用例（4 条 EDIT-01、2 条 EDIT-02、2 条 EDIT-03），没有新增依赖，没有运行任何安装命令。
- `us-journey-tracker.html` 全程未改、未被跟踪，sha256 为基线值 `2a954fd0…8a1872`。
- 开始约 2026-11-03T23:02Z，结束 2026-11-03T23:21Z。

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 482b57d | editor.ts、timelineDateLabel、四个文案常量、本周入口的 EDIT-01 tracer 用例 |
| 2 | a9adcda | 日历和时间线两个入口、三种丢弃修改（manual 时钟加哨兵）、EDIT-02 的删除加撤销与空文字 |
| 3 | b9c0e8c | EDIT-03 两条用例、TOAST_MARKED_UNDONE、README 两节新内容和目录表 |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式）：提交前重跑 `tests/e2e/editor`、grep 组合和完整 `npm test`（91 条）全部通过，记录 “Tracer verified end-to-end — expanding” 后展开 Task 2。

## 观察值

- **三个入口和三种关闭方式：** 都是第一次运行就通过，没有重试，没有改动应用，也没有调整任何期望。保存后的“其余记录与 fixture 相同”用 JSON 全等比较，也是第一次就通过。
- **撤销与 toast 计时：** 没有出现过时序问题。删除后只等一次保存再点撤销，中间不做别的操作；`undo` 先断言 `act` 类；两次完整运行和三次单独运行 `tests/e2e/editor` 都没有重试。
- **manual 时钟：** 只用在两条证明“没有保存”的用例里（丢弃修改、空文字），install 加 pauseAt 之后输入，runFor(2_000) 后写入次数不变，再用哨兵写入证明窗口推进了防抖；同一个用例里没有混用 setFixedTime。
- **没有应用与 FEATURES.md 描述不一致的情况**，所以没有登记任何已知 bug。
- **阶段收尾检查：**
  - 完整 `npm test` 连续两次各 98 条通过，汇总里都没有 flaky，退出码 0（计划开始前是 90 条，新增 8 条）；B1、N1、B4 的标记用例在列表里显示为预期失败，计为通过。
  - `node tools/privacy/privacy-check.mjs --all` 退出 0（111 个文件）；三次提交的 pre-commit 隐私检查都一次通过。
  - toast 可见性两步检查通过：`tests/e2e/week`、`tests/e2e/editor` 下引用 toast 的 spec 和 `tests/support/toast.ts` 都没有可见性断言；`tests/e2e/editor` 里没有固定睡眠。
  - `git ls-files us-journey-tracker.html` 输出为空；SAFE-02 的 sha256 用例通过。

## Deviations from Plan

None - plan executed exactly as written.

提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`。第一次完整 `npm test` 运行超过工具的前台超时，被转入后台完成；其间我写了 task-editor.spec.ts，但 Playwright 在启动时就确定了用例列表，该运行是 96 条，没有包含它，后面的两次收尾运行是串行的。

## 假设（有意不验证的边界行为，是假设，不是已验证的行为）

- 清空日期输入时保留原日期（ED-4 的后半）：不验证。
- 在日期框里按 Ctrl+Enter 不保存（ED-5 的后半）：不验证。
- 改回未完成后保留截止日期（ED-10 的后半）：不验证。
- 内置计划的完成弹窗：只靠合成自定义计划间接覆盖（两者走同一个 openTaskEditor），为了不在失败输出里带出个人计划原文，不单独打开。
- 撤销 toast 过期后不能再撤销、日面板 × 删除：留给 Phase 4。
- 窄屏下的底部面板：留给 Phase 5。

## Known Stubs

None。本计划只产出测试 helper、用例、文案常量和文档，没有占位数据或未接线的组件。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-03-11：只打开合成记录和 `c-synth-2`，所有定位器精确到合成 id，不对 `#timeline`、`#dayPanel`、`#grid` 做文字断言，task-editor.spec.ts 里没有内置任务 id 的入口，toast 经 helper 在 Node 侧比较；T-03-12：两条否定用例都在 manual 时钟下推过防抖后比较写入次数，再用哨兵证明窗口有效；T-03-13：撤销前不做别的操作，连续运行没有 flaky；T-03-14：应用文件只读，没有为迁就应用改期望；T-03-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

Phase 3 的十项需求（WEEK-01 到 WEEK-06、EDIT-01 到 EDIT-03、BUG-01）都有用例。Phase 4、5 可以直接调用 `composer`、`editor`、toast helper 和 `app.saved/expectSaved`，并照 README 第 13、14 节的约定写用例和登记已知 bug。

## Self-Check: PASSED

- tests/support/editor.ts、tests/e2e/editor/edit-entry.spec.ts、delete-entry.spec.ts、task-editor.spec.ts、tests/support/strings.ts、tests/support/expect-from-fixture.ts、tests/README.md 存在
- 提交 482b57d、a9adcda、b9c0e8c 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 3
- 三个任务的验收命令全部通过；`npm test` 连续两次退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
