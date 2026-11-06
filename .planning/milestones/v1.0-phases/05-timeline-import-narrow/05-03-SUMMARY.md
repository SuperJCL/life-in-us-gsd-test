---
phase: 05-timeline-import-narrow
plan: 03
subsystem: testing
status: complete
tags: [narrow, responsive, viewport, readme, known-bugs, milestone-close, playwright]

requires:
  - phase: 05-timeline-import-narrow
    provides: "05-01 的 timeline.ts，05-02 的 import-file.ts，05-04 的 B2、N3 已知 bug 和 PROBE-8"
  - phase: 03-composer-editor-week
    provides: "editor(page).openLog 等编辑弹窗 helper"
  - phase: 04-calendar-goals
    provides: "gotoCalendar 等日历 helper"
provides:
  - "tests/e2e/narrow/narrow.spec.ts：RESP-01 的四条窄屏用例（底部面板、圆点、纵向排列、选日滚动）"
  - "tests/README.md：timeline、narrow 目录，timeline.ts、import-file.ts 说明，第 15 节注意事项，探针 PROBE-1 到 PROBE-8"
  - "tests/KNOWN-BUGS.md：“里程碑收尾时的状态”一节（已覆盖与仍未验证）"
affects: [milestone-close]

actuals:
  tokens: 9500
  tasks: 3
  commits: 3
plan_head_before: f79075d6394fd9cd764a4d63ea1c080bc76e71ff
plan_head_after: 3418baaf96391a4b33fb9f33f1c30d778e026178

tech-stack:
  added: []
  patterns:
    - "窄屏断言只在 page.evaluate 里读计算样式和 getBoundingClientRect，再在 Node 侧比较，不读 chip 或条目文字"
    - "滚动用例先由布局读回选目标日，瞬时滚到 #wkComp 在视口下方 40px 处，点击后用 expect.poll 等平滑滚动"

key-files:
  created:
    - tests/e2e/narrow/narrow.spec.ts
  modified:
    - tests/README.md
    - tests/KNOWN-BUGS.md

key-decisions:
  - "三条用例的前提在 520 × 900 下全部成立，没有改视口、没有去掉前提断言"
  - "Task 1 的提交只含 tracer 一条用例，Task 2 再补另外三条，保持每个任务单独提交"

requirements-completed: [RESP-01]

coverage:
  - id: D1
    description: "520 × 900 下编辑弹窗是底部面板：宽度等于视口、贴住左边和底部、上圆下直"
    requirement: "RESP-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/narrow/narrow.spec.ts#RESP-01 at phone width the editor opens as a bottom sheet"
        status: pass
    human_judgment: false
  - id: D2
    description: "日历 chip 变成圆点：三种 chip 都存在，font-size 为 0px、圆角 50%、尺寸约 7px"
    requirement: "RESP-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/narrow/narrow.spec.ts#RESP-01 at phone width calendar chips shrink to dots"
        status: pass
    human_judgment: false
  - id: D3
    description: "本周日期纵向排列：#days 一列，7 个日期列 left 相同、top 严格递增、宽度等于 #days"
    requirement: "RESP-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/narrow/narrow.spec.ts#RESP-01 at phone width the week days stack in a single column"
        status: pass
    human_judgment: false
  - id: D4
    description: "选中某天后平滑滚动到“记一笔”：由布局选出目标日，前提断言后点击，poll 到平滑滚动结束；终态要求 #wkComp 顶部贴近视口上沿（block:start），或页面已到底且 composer 顶部在视口内（后一支不区分 block 取值）"
    requirement: "RESP-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/narrow/narrow.spec.ts#RESP-01 at phone width picking a day scrolls the composer into view"
        status: pass
    human_judgment: false
  - id: D5
    description: "阶段收尾：完整套件 154 条通过、0 flaky；sha256 与基线一致；隐私全量检查通过；README 和 KNOWN-BUGS 已更新"
    requirement: "RESP-01"
    verification:
      - kind: e2e
        ref: "check-report.mjs --min-expected 154（本阶段 22 条新标题、登记护栏、SAFE-02）"
        status: pass
    human_judgment: false

duration: 约 25 min
completed: 2026-11-04
---

# Phase 5 Plan 3: 窄屏用例与阶段收尾 Summary

**520 × 900 视口下四条 RESP-01 用例（底部面板、圆点、纵向排列、选日滚动）全部通过，只读计算样式和位置；README 和 KNOWN-BUGS 做了里程碑收尾更新；最后一次完整套件 154 条通过、0 flaky。**

## Accomplishments

- tracer（提交 `206f9a4`）：新建 narrow.spec.ts，打通 viewport、应用 560px 断点、弹窗、页面内读回。
- 提交 `10595d8`：补上圆点、纵向排列、选日滚动三条，文件恰好 4 条 RESP-01 用例。
- 提交 `3418baa`：README（目录、helper、第 15 节、PROBE-1 到 PROBE-8）和 KNOWN-BUGS（“里程碑收尾时的状态”）。
- 完整套件（低优先级、单 worker，本计划唯一一次）：154 条 expected、0 flaky、0 unexpected，`check-report.mjs --min-expected 154` 输出 `REPORT OK`；本阶段 22 条新标题、登记护栏和 SAFE-02 都实际运行并通过。

## 观察值

- **弹窗 rect：** left 0、top 约 528.75、width 520、bottom 900（innerWidth 520、innerHeight 900）；圆角左上、右上 14px，左下、右下 0px。
- **chip（3 月）：** 记录 9 个、到期 3 个、完成 2 个；三种宽高都是 7 × 7；font-size 都是 0px，圆角 50%。
- **本周日期列：** `#days` 的 grid-template-columns 是单个 480px；7 列 left 都是 20、width 都是 480；top 依次约 584、662、785、948、996、1074、1123（严格递增）。
- **滚动用例：** 目标日是冻结周的周二（2026-03-17，日期头到 `#wkComp` 的 gap 约 727，离“记一笔”最远）；`#wkComp` 文档顶部约 1397、innerHeight 900，满足 `> innerHeight + 40`（前提成立，没有停下交给用户）；算出的瞬时滚动位置约 457；前提断言读到日期头视口顶约 214、底约 238（完整在视口里），`#wkComp` 视口顶约 940（不小于 900），点击前 scrollY 457；点击后 poll 通过，scrollY 到 882、`#wkComp` 视口顶约 515（页面滚到底，受页面最大滚动高度限制）。

## 与计划的差异

None - plan executed exactly as written.

- 实现细节：Task 1 先在本地把四条一起写完并通过，提交时把文件裁成只含 tracer 一条再提交，Task 2 恢复完整文件再提交，所以两个任务的提交内容与计划一致。

## 隐私与保护路径

- 窄屏用例只读类名、日期属性、计算样式和位置；没有对 chip 或条目取文字，没有截图、设备描述符、拖拽或固定睡眠（grep 确认）。弹窗只为合成记录打开。
- 两处文档只写合成文字、编号和固定文案；三次提交都经过隐私钩子并通过，没有绕过。
- 收尾核对：`us-journey-tracker.html` 的 sha256 等于 constants.ts 的基线（`SHA OK`）；`privacy-check --all` 通过（157 个文件）；应用文件未被跟踪；tests/fixtures、tests/support/test.ts、playwright.config.ts、package.json、package-lock.json 的 HEAD 对象哈希不变。
- 没有新增依赖，没有运行安装命令，除 `npx --no playwright` 外没有运行 npx。

## 里程碑收尾的边界

- **没有运行 `complete-milestone`**，没有归档任何阶段目录，没有推送，没有改 ROADMAP 的阶段结构。
- Phase 6（个人内容外置）已获用户同意但尚未加进 ROADMAP，里程碑收尾等用户决定。

## 假设（有意不验证的边界）

- 820px 断点的日历单列布局、560px 下目标页任务行的另一种布局、`.more` 和抵美角标在窄屏下隐藏、安全区内边距都不验证（D-13）。
- 窄屏下的拖拽按 D-03 不测；真实手机和设备描述符不测。

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: tests/e2e/narrow/narrow.spec.ts、tests/README.md、tests/KNOWN-BUGS.md
- FOUND: 206f9a4、10595d8、3418baa（均为 HEAD 的祖先）
- 完整套件 154 条通过、0 flaky；sha256、隐私、保护路径检查通过
