---
phase: 04-calendar-goals
plan: 01
subsystem: testing
status: complete
tags: [calendar, month-grid, day-panel, delete-undo, toast-expiry, manual-clock, known-bug, json-report-checker, privacy-masking, account-mode, playwright]

requires:
  - phase: 03-composer-editor-week
    provides: "composer(page, 'c')、toast helper、app.saved/expectSaved、knownBug 与登记护栏、manual 时钟约定"
provides:
  - "tools/test-report/check-report.mjs：零依赖的 Playwright json 报告检查，要求没有失败、没有 flaky、指定标题都实际运行并通过，带 --self-test 反向对照；本阶段所有跑测试的 verify 共用"
  - "tests/support/calendar.ts：gotoCalendar、readMonth、readCellLogClasses、readDayPanelLogClasses、readDayPanel，只读日期、类名、aria-label、数量、id 和组号"
  - "tests/support/expect-from-fixture.ts 的日历推导：monthGrid、eventsOnDate、cellAriaLabel、monthTitle、expectedMonthCells、dayPanelTitle、dayPanelSub、expectedDayPanel；类型 DayState"
  - "tests/support/strings.ts 新增月份标题、格子 aria-label 后缀、日面板分区、空提示和副标题常量"
  - "tests/e2e/calendar/：grid.spec.ts 五条 CAL-01 用例、navigation.spec.ts 三条 CAL-02 用例、day-panel.spec.ts 三条 CAL-03 加两条 CAL-04 用例、known-bugs.spec.ts 的 B1 日历实例一对用例"
  - "tests/KNOWN-BUGS.md 的 B1 行补登日历日面板实例"
affects: [phase-04-plan-02, phase-04-plan-03, phase-05]

actuals:
  tokens: 12000
  tasks: 3
  commits: 3
plan_head_before: 2e943f6d66c3e37c13e4deeede408981f611d741
plan_head_after: 304a7ade52e6dd7288e7688fe70a3c0830f1842c

tech-stack:
  added: []
  patterns:
    - "整月网格和整个日面板各用一次 page.evaluate 读回，再与 expectedMonthCells、expectedDayPanel 的独立推导做 expect.poll 加 toEqual"
    - "calendar.ts 与 expect-from-fixture.ts 各自声明同形类型，互不导入，靠 toEqual 比较"
    - "用例内存里构造 fixture 变体（改一个合成计划的日期），不改 fixture 文件"
    - "跑测试的 verify 一律写 json 报告再由 check-report.mjs 判定，retries: 1 下的 flaky 不会被退出码掩盖"

key-files:
  created:
    - tools/test-report/check-report.mjs
    - tests/support/calendar.ts
    - tests/e2e/calendar/grid.spec.ts
    - tests/e2e/calendar/navigation.spec.ts
    - tests/e2e/calendar/day-panel.spec.ts
    - tests/e2e/calendar/known-bugs.spec.ts
  modified:
    - tests/support/expect-from-fixture.ts
    - tests/support/strings.ts
    - tests/KNOWN-BUGS.md

key-decisions:
  - "35 和 42 格先用只依赖 Date.UTC 的脚本核对（输出 35,42,35），再写成路标断言，同时保留由 monthGrid 推导的整月比较"
  - "到期、完成 chip 和日面板计划条目只经 page.evaluate 读回种类、id、组号和数量，不做定位器动作、文字断言或可见性断言"
  - "B1 日历实例按 Phase 3 的约定写成一对用例，先去掉标记亲眼复现，最终用 test.fail"
  - "撤销 toast 过期和删除加撤销都放在 manual 时钟下，用 runFor 推进，不用固定睡眠"

requirements-completed: [CAL-01, CAL-02, CAL-03, CAL-04]

coverage:
  - id: D1
    description: "3 月、5 月、2 月、1 月整月网格（周日起始表头、out、today、sel、arr、aria-label、日号、前 3 个 chip 种类和 +N）与 fixture 推导逐格一致；35 和 42 格有写死的路标；2 月最后一行 7 格全是 out；抵达日只在 1 月带 arr"
    requirement: "CAL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/grid.spec.ts#CAL-01 the March grid starts on Sunday and every cell matches the fixture-derived dates, classes, aria-labels and chips"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/grid.spec.ts#CAL-01 May 2026 needs six rows and renders 42 cells that match the derivation"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/grid.spec.ts#CAL-01 February 2026 renders 35 cells and its last row lies entirely in March"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/grid.spec.ts#CAL-01 the arrival day carries the arrival class only in the January grid"
        status: pass
    human_judgment: false
  - id: D2
    description: "chip 顺序是记录、到期、完成（合成变体让 3 月 16 日恰好三种各一个）；已完成的计划不再作为到期出现；格子里记录 chip 的类别类与日面板同一天记录的类别类按顺序一致"
    requirement: "CAL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/grid.spec.ts#CAL-01 chips are ordered entries, then due, then done, and their category class matches the day panel"
        status: pass
    human_judgment: false
  - id: D3
    description: "上个月、下个月跨年时标题正确且选中日不变；今天按钮回到当月并选中今天；点格子选中并更新日面板标题和 composer 记录日期；点当月以外的格子跳到那个月"
    requirement: "CAL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/navigation.spec.ts#CAL-02 previous and next move the month across a year boundary without changing the selected day"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/navigation.spec.ts#CAL-02 the today button returns to the current month and selects today"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/navigation.spec.ts#CAL-02 clicking a cell selects it and clicking a cell outside the month jumps to that month"
        status: pass
    human_judgment: false
  - id: D4
    description: "日面板的标题、副标题（来美国第 N 天或年份）、分区、记录 id、完成计划 id、到期条目的组号和空提示与推导一致，覆盖今天、空白日、只有计划的日、抵达前和抵达当天；在日面板记一笔后记录保存在选中日并出现在该格和日面板"
    requirement: "CAL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/day-panel.spec.ts#CAL-03 the day panel for today shows the title, the arrival day count and three sections derived from the fixture"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/day-panel.spec.ts#CAL-03 a day without entries shows the empty hint and days before and on arrival show the year or day one"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/day-panel.spec.ts#CAL-03 recording from the day panel composer saves the entry on the selected day and shows it in the cell"
        status: pass
    human_judgment: false
  - id: D5
    description: "日面板删除按钮不打开编辑弹窗、不改选中日，撤销后记录回到原位置且保存后的 id 顺序与 fixture 相同；撤销 toast 在 manual 时钟下 5 秒后失去 on 和 act、撤销按钮消失、删除保持保存且之后没有新写入"
    requirement: "CAL-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/day-panel.spec.ts#CAL-04 the delete button in the day panel deletes without opening the editor and undo restores the entry"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/day-panel.spec.ts#CAL-04 the undo toast expires after five seconds and the deletion stays saved"
        status: pass
    human_judgment: false
  - id: D6
    description: "B1 在日历日面板的实例：对照用例证明草稿确实输入、点另一个格子确实移动了选中日、编辑弹窗没有打开；标记用例（test.fail）只断言草稿仍在；两条标题登记在 KNOWN-BUGS.md 的 B1 行，登记护栏通过"
    requirement: "CAL-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/calendar/known-bugs.spec.ts#BUG-01 B1 calendar control: the day-panel draft is typed and picking another cell moves the selection"
        status: pass
      - kind: e2e
        ref: "tests/e2e/calendar/known-bugs.spec.ts#BUG-01 B1 calendar expected: the day-panel draft survives picking another cell"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/known-bugs-registry.spec.ts#BUG-01 every known-bug test is registered in tests/KNOWN-BUGS.md and every registered title exists"
        status: pass
    human_judgment: false
  - id: D7
    description: "json 报告检查器：干净的报告通过，flaky、unexpected、errors、缺标题、只以 unexpected 出现的标题和没有注解的 skipped 都被判为失败，带 known-bug 注解的 skipped 通过"
    verification:
      - kind: other
        ref: "node tools/test-report/check-report.mjs --self-test"
        status: pass
    human_judgment: false
  - id: D8
    description: "失败输出里确实不会出现到期、完成 chip 和日面板计划条目的原文（包括 Playwright 调用日志里的元素预览）"
    verification: []
    human_judgment: true
    rationale: "所有用例都通过，没有触发失败路径；脱敏靠结构约束保证（计划条目只经 page.evaluate 读 id、组号和数量，点格子和点删除按钮的元素预览只有属性，toast 在 Node 侧比较），是否真的不泄露要靠人在一次故意失败的运行里核对"

duration: 11min
completed: 2026-11-04
---

# Phase 4 Plan 01: 日历视图 CAL-01 到 CAL-04、B1 日历实例与撤销 toast 过期 Summary

**用 Date.UTC 独立推导月历网格和日面板，一次页面内读回整月逐格比较，覆盖 35、42 格、chip 顺序、月份导航、日面板分区、记一笔、删除加撤销和 5 秒过期，B1 在日历日面板的实例按成对用例登记，并新增 json 报告检查器让 flaky 无处藏身。**

## 执行情况

- 3 个任务（1 个 tracer、2 个 auto），3 个提交，新建 6 个文件，修改 3 个文件，新增 15 条用例（5 条 CAL-01、3 条 CAL-02、3 条 CAL-03、2 条 CAL-04、2 条 B1 日历实例），没有新增依赖，没有运行任何安装命令，没有运行除 `npx --no playwright` 以外的 npx。
- `us-journey-tracker.html` 全程未改、未被跟踪，sha256 为基线值 `2a954fd0…8a1872`。
- 开始 2026-11-04T01:40Z，结束 01:51Z 左右。

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 346f5d0 | check-report.mjs、月历推导、calendar.ts 的 gotoCalendar 与 readMonth、3 月整月网格用例 |
| 2 | 86fd9a5 | 5 月 42 格、2 月 35 格边界、抵达日、chip 顺序与类别色、CAL-02 三条导航用例 |
| 3 | 304a7ad | 日面板推导与读回、CAL-03 三条、CAL-04 两条（manual 时钟）、B1 日历一对用例、KNOWN-BUGS.md |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式）：重跑 grid.spec.ts 并由 check-report.mjs 判定为 `REPORT OK`，记录 “Tracer verified end-to-end — expanding” 后展开 Task 2。

## 观察值

- **D-01 脚本输出：** `35,42,35`（依次是 2026-03、2026-05、2026-02），退出码 0；写进 grid.spec.ts 的路标断言，推导函数 monthGrid 与它一致。
- **推导与应用的一致性：** 四个月（1、2、3、5 月）加 2025 年 12 月和 4 月，整月网格第一次运行就与推导逐格一致，没有重试，没有调整任何期望，没有登记新的应用 bug。
- **计划核对提示的修正：** 核对提示说 fixture 里 `c-synth-2` 已完成但没有 doneDate。实际读取 fixture 发现它有 doneDate（2026-03-10），所以 3 月 10 日的日面板有一个完成的自定义计划和一个到期的内置计划；用例的期望仍然全部由 expectedDayPanel 从 fixture 推导，没有受影响。chip 顺序用例用的内存变体把 `c-synth-2` 的 doneDate 改到 3 月 16 日。
- **check-report.mjs 字段核对：** 第一次真实运行后打开报告确认字段：`stats` 有 expected、skipped、unexpected、flaky；`suites[].specs[].tests[]` 的 `status` 为 expected 等；`annotations` 在 test 和每个 result 上都有。结构与脚本假设一致，没有改脚本。`--self-test` 覆盖十种情形，全部符合。
- **B1 日历实例：** 临时注释掉 `knownBug` 后用 `--retries=0` 只跑该文件一次：对照用例通过，标记用例失败，失败点正是 `c.text` 的 `toHaveValue` 草稿断言，实际值为空字符串（超时 2 秒）。随后恢复标记，最终用 `test.fail`，没有用 `test.fixme`。
- **撤销窗口：** manual 时钟下删除后只 `runFor(1_000)` 推过 600 ms 防抖，撤销按钮仍在；撤销后的 id 顺序与 fixture 完全相同。过期用例 `runFor(5_000)` 之后 toast 失去 on 和 act，`#toast.act button` 为 0 个，再推 2 秒写入次数不变，保存里和日面板里都没有被删除的记录。没有出现时序问题，没有 flaky。
- **阶段收尾检查：**
  - 完整低优先级单 worker 套件 114 条通过，json 报告里 expected 为 114、flaky 为 0、unexpected 为 0；check-report.mjs 对本计划十五个标题、登记护栏和 SAFE-02 输出 `REPORT OK`；B1 日历标记用例以预期失败计为通过。
  - `node tools/privacy/privacy-check.mjs --all` 退出 0（129 个文件）；三次提交的 pre-commit 隐私检查都一次通过。
  - toast 可见性和固定睡眠两步检查通过：tests/e2e/calendar 下引用 toast 的 spec、calendar.ts 和 toast.ts 都没有 `toBeVisible` 或 `toBeHidden`，calendar 目录和 calendar.ts 里没有 `waitForTimeout`。
  - `git ls-files us-journey-tracker.html` 输出为空；SAFE-02 的 sha256 用例通过。

## Deviations from Plan

None - plan executed exactly as written.

执行中的小说明（不是偏离）：expect-from-fixture.ts 是 CRLF 行尾，追加内容时用脚本转成 CRLF，改动后全文件仍是 399/443 行全 CRLF；其余新文件为 LF，与仓库既有同类文件一致。提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`。

## 假设（有意不验证的边界行为，是假设，不是已验证的行为）

- 只验证 1、2、3、5 月加 2025 年 12 月和 4 月的网格；窄屏下 chip 变圆点留给 Phase 5。
- chip 和日面板计划条目的文字不验证（是任务原文），只比较种类、id、组号和数量。
- 键盘操作格子（XTRA-01，v2）不验证；跨午夜后“今天”不更新（B9）不验证。
- “这天到期”条目不可点击不单独验证。
- N1（带草稿时的其他触发）在日面板删除记录这一触发下的草稿丢失留给 04-03 计划；连续删除两条后再撤销的行为不验证。

## Known Stubs

None。本计划只产出测试 helper、用例、文案常量、报告检查脚本和文档，没有占位数据或未接线的组件。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-04-01：计划条目只经 page.evaluate 读 id、组号和数量，点格子与点删除按钮的元素预览只有属性；T-04-02：推导独立实现，35 和 42 有 D-01 脚本核对的路标，每条比较有防空转断言；T-04-03：两条撤销窗口用例都在 manual 时钟下，没有固定睡眠；T-04-04：B1 一对用例先去掉标记亲眼复现，登记护栏双向通过；T-04-05：应用文件只读且 sha256 不变；T-04-15、T-04-16：每次跑测试都写 json 报告并由检查器判定，只打印计数和标题；T-04-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

CAL-01 到 CAL-04 都有用例，Phase 3 推迟过来的 B1 日历实例和撤销 toast 过期已完成。04-02、04-03 可以复用 check-report.mjs 的 verify 形状、calendar.ts 的读回模式（页面内读回加 Node 侧比较）和 tests/e2e/calendar/known-bugs.spec.ts 的成对写法。

## Self-Check: PASSED

- tools/test-report/check-report.mjs、tests/support/calendar.ts、tests/e2e/calendar/grid.spec.ts、navigation.spec.ts、day-panel.spec.ts、known-bugs.spec.ts 存在
- 提交 346f5d0、86fd9a5、304a7ad 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 3
- 三个任务的验收命令全部通过；完整套件 114 条通过且 flaky 为 0；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
