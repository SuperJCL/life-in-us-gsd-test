---
phase: 05-timeline-import-narrow
plan: 01
subsystem: testing
status: complete
tags: [timeline, filters, month-headings, empty-state, year-boundary, privacy-readback, account-mock, playwright]

requires:
  - phase: 04-calendar-goals
    provides: "calendar.ts 的页面内读回写法、expectedMonthCells 一类独立推导、timelineDateLabel、monthTitle、builtinTaskIds、goals.ts 的 gotoGoals、check-report.mjs 的 --min-expected 判定"
  - phase: 03-composer-editor-week
    provides: "composer(page, 'w')、expectToast、app.saved/expectSaved"
provides:
  - "tests/support/timeline.ts：gotoTimeline、pickFilter、readTimeline；一次 page.evaluate 读回筛选按钮、月份标题、条目（attr、id、所属月份、M/D 日期、记录的类别标签）和空提示，完成计划条目不读文字和标签"
  - "tests/support/expect-from-fixture.ts：expectedTimeline(state, filter)，类型 TimelineRow、TimelineExpectation；按应用的规则独立推导，同日先记录后计划的稳定倒序"
  - "tests/support/strings.ts：FILTER_ALL、FILTER_DONE_TASKS"
  - "tests/e2e/timeline/timeline.spec.ts：四条 TL-01、三条 TL-02 用例；05-02 的导入用例可直接复用 readTimeline 与 expectedTimeline 证明各视图已按新数据重绘"
affects: [phase-05]

actuals:
  tokens: 4500
  tasks: 2
  commits: 2
plan_head_before: ddd70045da8a29c2d4fed9f0857e90c6463b5e34
plan_head_after: f623938aad3fdfe77c04fdd190158a8c970df02e

tech-stack:
  added: []
  patterns:
    - "时间线只经一次 page.evaluate 读回纯数据，Node 侧用 expect.poll(...).toEqual(expectedTimeline(...)) 比较，失败 diff 里只有 id、日期、月份标题、类别名和固定文案"
    - "expectedTimeline 与应用同样先收记录再收完成的计划，再做稳定倒序，所以同一天的相对顺序由推导自然得出，不写死"
    - "没有记录的类别和跨年记录都在用例内存里改 loadFixture 返回的新对象，tests/fixtures 不动"

key-files:
  created:
    - tests/support/timeline.ts
    - tests/e2e/timeline/timeline.spec.ts
  modified:
    - tests/support/strings.ts
    - tests/support/expect-from-fixture.ts

key-decisions:
  - "类别筛选下的读回既比较条目 id，也比较记录条目的 .tag（类别名，固定界面文案），所以类别筛选的正确性有两处证据"
  - "新增记录后的联动用例用 app.saved() 取保存后的状态作为推导输入，而不是自己拼状态，这样新记录的 id 和日期都来自应用的保存结果"

requirements-completed: [TL-01, TL-02]

coverage:
  - id: D1
    description: "全部筛选下时间线按日期倒序、三个月份标题各一次、同日先记录后完成的计划、M/D 日期，整体等于独立推导"
    requirement: "TL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-01 the timeline lists entries and done plans newest first under month headings"
        status: pass
    human_judgment: false
  - id: D2
    description: "五个类别筛选各自只留下该类别的记录，只有被点的按钮 aria-pressed 为 true，切换标签后筛选保持"
    requirement: "TL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-02 each category filter shows only the entries of that category and only its button is pressed"
        status: pass
    human_judgment: false
  - id: D3
    description: "完成的计划筛选只剩 data-edittask 条目（内置和自定义都有），回到全部后恢复完整列表"
    requirement: "TL-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-02 the done-plans filter shows only done plans and the all filter brings everything back"
        status: pass
    human_judgment: false
  - id: D4
    description: "最小状态下七个筛选都显示空提示；内存变体里没有记录的类别显示空提示，其余筛选仍有条目"
    requirement: "TL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-01 an empty state shows the empty hint for every filter"
        status: pass
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-02 a category without entries shows the empty hint while the other filters still list items"
        status: pass
    human_judgment: false
  - id: D5
    description: "跨年记录获得自己的月份标题且按倒序；新增记录和勾选合成待办后的时间线与保存后状态的推导一致，两条新条目都落在 3/18"
    requirement: "TL-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-01 entries across a year boundary get their own month heading in descending order"
        status: pass
      - kind: e2e
        ref: "tests/e2e/timeline/timeline.spec.ts#TL-01 a new entry and a newly checked custom todo appear in the timeline in date order"
        status: pass
    human_judgment: false

duration: 约 20 min
completed: 2026-11-04
---

# Phase 5 Plan 1: 时间线 Summary

**时间线用一次页面内读回加独立推导 expectedTimeline 做比较：“全部”按月倒序、五个类别、“完成的计划”、两种空状态、跨年月份、新增记录和勾选待办后的联动共七条用例，完整套件 139 条全部通过、0 flaky。**

## Accomplishments

- tracer：strings、expectedTimeline、readTimeline、spec 四层一次打通，提交 `c96c1cb`；“全部”筛选下读回（筛选按钮、月份标题、条目、空提示）整体等于独立推导，推导本身带防空转断言（条目数等于记录数加 3、三个月份、同日先记录后计划、两种 attr 都出现）。
- 补齐类别筛选、“完成的计划”筛选、最小状态的空提示、没有记录的类别、跨年月份、新增记录与勾选合成待办后的联动，提交 `f623938`。
- 完整套件（低优先级、单 worker，本计划唯一一次）：139 条 expected、0 flaky、0 unexpected，`check-report.mjs --min-expected 139` 输出 `REPORT OK`；七个 TL 标题、登记护栏和 SAFE-02 都实际运行并通过。

## 与计划的差异

None - plan executed exactly as written.

- 推导与应用没有不一致：七条用例首次运行即通过，没有改动任何期望。
- HEAD 上的基线实测为 132 条（`--list` 计数），与计划假设一致，所以 `--min-expected` 取 139（132 加 7）。
- 计划里没有登记已知 bug，本计划也没有发现需要登记的应用行为。

## 隐私与保护路径

- readTimeline 对完成计划条目只读 `data-edittask` 的 id、`.tl-date` 和所属月份标题，不读文字节点和标签；记录条目只额外读 `.tag`（类别显示名）。grep 确认 spec 与 timeline.ts 没有可见性断言、固定睡眠、对 data-edittask 的定位器，也没有在 querySelector 里取条目文字。
- tests/fixtures、tests/support/test.ts、tests/support/app.ts、tests/mocks、playwright.config.ts、package.json、package-lock.json 的 HEAD 对象哈希与计划开始前相同，工作区无改动；`us-journey-tracker.html` 未被跟踪，sha256 等于基线。
- 没有新增依赖，没有运行任何安装命令。
- 提交经过隐私钩子，两次都通过，没有绕过。

## 假设（有意不验证的边界）

- 完成计划条目的文字（“完成：”加原文）不验证。
- 从时间线打开编辑弹窗已由 Phase 3 的 EDIT-01 覆盖，这里不重复；Enter、Space 键盘激活属于 v2 的 XTRA-01。
- 编辑后条目移到新月份只由 EDIT-01 的同步间接覆盖；导入后筛选是否保持不单独验证。

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

readTimeline 与 expectedTimeline 已可供 05-02 的导入用例复用。

## Self-Check: PASSED

- FOUND: tests/support/timeline.ts、tests/e2e/timeline/timeline.spec.ts
- FOUND: c96c1cb、f623938（均为 HEAD 的祖先）
- expect-from-fixture.ts 整份 CRLF，无混合行尾；新文件为 LF
