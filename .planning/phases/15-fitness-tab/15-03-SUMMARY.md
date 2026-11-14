---
phase: 15-fitness-tab
plan: 03
subsystem: fitness-tab
tags: [charts, inline-svg, line-chart, bar-chart, paging, matchMedia, ResizeObserver, edit-gate, playwright, playwright-cloud]

requires:
  - phase: 15-fitness-tab
    provides: 15-01 的 woMap / planCardio、#tab-fit 外壳、#fc-live、CSS 骨架的 S7 部分、GATE_ALLOW 里的 [data-fit-ro]；15-02 的记录区和 liftLast
provides:
  - 纯函数 rangeStart、seriesOf、niceMax、cardioWeeks（都在纯函数段里，可直接 loadAppPure）
  - "#fc 面板：指标 / 范围芯片、翻页器、每个力量项一张手画 SVG 折线图（目标虚线、手填空心点、徒手改看次数、指针读数、查看数据表格）、每周有氧总时长柱形图"
  - 范围按设备记在 localStorage 的 usj:fit:range；视口跨 560 px 重新算页号；ResizeObserver 只重画图组
  - 门控收窄：GATE_BLOCK 里的 [data-lift],[data-liftsave] 改成 #goals 内才拦
affects: [15-04 目标页力量卡搬家（要删门控里的两条）, 15-07 收尾（完整套件、csp.spec、恶意数据、勾选需求）, Phase 16 总体验收]

actuals:
  tokens: 15915
  tasks: 3
  commits: 3

plan_head_before: 2de8b70d22b4f698dcfb9b6e5132d8e3ccddcd21
plan_head_after: ff4364fced8e35e025839d67ab08e258fd43ebde

tech-stack:
  added: []
  patterns:
    - "图只由纯函数给出的点画出：fcDraw / fcDrawCd 把 seriesOf / cardioWeeks 的结果换成 SVG 属性（x、y、width、height、points、cx、cy、stroke-dasharray、viewBox），颜色和线宽走 class，没有任何 style 属性"
    - "每个 figure 里 .fc-pl（svg 或 .fc-empty 的容器，宽度从它量）和 .fc-notes（图例、只有一次记录的说明）是两个无样式的空 div；fcInfo（WeakMap）按 figure 记下点的坐标和默认读数，指针读数只查它"
    - "renderFc 重画前记下焦点（fcFocusKey）和已展开的「查看数据」，重画后放回去；#tab-fit 隐藏时 renderFc 把 #fc 清空，显示时 showTab → renderFit 再画"

key-files:
  created:
    - tests/e2e/fitness/charts-data.spec.ts
    - tests/e2e/fitness/charts.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/support/fitness.ts
    - tests/cloud/fitness-log.spec.ts

key-decisions:
  - "一张图的宽度从 .fc-pl 的 clientWidth 取（不是 svg 自己），svg 的 width 和 viewBox 宽度都是这个整数，所以 1 个单位就是 1 px，指针位置不用换算"
  - "renderFc 只写当前页的图（电脑 4 张、手机 3 张），翻页是原地替换，不是把全部图都画出来再隐藏"
  - "柱形图卡片是否渲染看「计划里有未归档有氧项」或「全部历史里有有氧记录」，范围只影响里面是画图还是写一句说明"
  - "门控收窄只改 GATE_BLOCK 里的两条选择器，写成 #goals [data-lift],#goals [data-liftsave]；健身页写入控件仍由 [data-fl] 拦"

requirements-completed: []
requirements-advanced: [FIT-03, FIT-04]

coverage:
  - id: D1
    description: "tracer：每个未归档力量项一张最大重量折线图，顺序同编辑计划；点、折线、目标虚线、读数行、role=img 摘要、查看数据表格；viewBox 宽度等于容器宽度；#fc 里没有 style 属性"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-03 the fitness tab draws one line chart per lift in plan order with heaviest-set points, the dashed target line and the latest reading (D-08, D-10)"
        status: pass
      - kind: unit
        ref: "tests/e2e/fitness/charts-data.spec.ts#FIT-03 seriesOf gives the heaviest set, the Epley estimate and the volume per training day and keeps hand-entered history only for the heaviest set (D-08, 15-CONTEXT)"
        status: pass
    human_judgment: false
  - id: D2
    description: "指标和范围：三个指标全局生效、总训练量不画目标线、范围默认 1 个月并按设备记住（不认识的值回到 1m）、起点当天包含、徒手动作改看次数"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-03 the metric chips switch every chart and the time range chips default to one month and are remembered on this device (D-08, D-11)"
        status: pass
      - kind: unit
        ref: "tests/e2e/fitness/charts-data.spec.ts#FIT-03 seriesOf charts reps for a lift whose every set is 0, keeps the range start inclusive and the day before out, and orders points by date (D-09, D-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "分页：电脑 4 张、375 px 3 张，翻页按钮边缘真 disabled 且焦点移到另一个按钮，视口跨 560 px 按序号重新算页，只有一页时不渲染翻页器"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-03 charts are paged four at a time on a desktop and three at 375 px with previous and next and the group number (D-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "三种空状态（从来没有 / 范围里没有 / 只有一个点）、徒手图不画目标线、40 点画点 41 点只画折线加最后一点"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-03 a lift with no records, none in the range or a single point shows its explanation, and a bodyweight lift charts reps without a target line (D-09, S7)"
        status: pass
    human_judgment: false
  - id: D5
    description: "以前手填的力量历史作为空心点留在最大重量图上，带图例，数据表来源写「手填」，同一天有训练时只画训练点，切到别的指标就消失"
    requirement: "FIT-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-04 hand-entered lift history appears as hollow points on the heaviest-set chart with the legend and in the data table (15-CONTEXT)"
        status: pass
    human_judgment: false
  - id: D6
    description: "指针读数只改属性和文字、不写 style；查看数据表格键盘可聚焦；窗口宽度变化后 viewBox 跟着变"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-03 the charts carry no style attribute, show the value under the pointer and offer a data table for keyboard and screen reader users (A8)"
        status: pass
    human_judgment: false
  - id: D7
    description: "每周有氧总时长柱形图：每周一个槽位、没有有氧的周高 0、范围和折线图共用、表格给出每周总时长和有氧天数；没有有氧项也没有记录时整张卡不渲染"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/charts.spec.ts#FIT-03 the weekly cardio chart totals minutes per week across items, keeps empty weeks and shares the time range (D-12)"
        status: pass
      - kind: unit
        ref: "tests/e2e/fitness/charts-data.spec.ts#FIT-03 niceMax and cardioWeeks give clean axis tops and one slot per week with empty weeks at 0 (A6, D-12)"
        status: pass
    human_judgment: false
  - id: D8
    description: "门控期间（对账中、连不上）图表的指标、范围、翻页、查看数据仍可用，记录区的写入控件真 disabled；目标页的力量输入仍被拦"
    requirement: "FIT-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/fitness-log.spec.ts#FIT-03 while the edit gate is on the chart controls, paging and data tables still work and the logging controls stay disabled"
        status: pass
    human_judgment: false
  - id: D9
    description: "浅色和深色主题下折线、空心点、目标虚线、柱形、读数竖线都清楚；375 px 下三张图上下排整页可读"
    requirement: "FIT-03"
    verification: []
    human_judgment: true
    rationale: "backstop：需要目视，交给 Phase 16 总体验收；CSP 零违规由 15-07 的 csp.spec 证明"

duration: 约 30 分钟任务执行（2026-11-13 22:04Z 到 22:33Z），加续跑收尾
completed: 2026-11-13
status: complete
---

# Phase 15 Plan 03: 趋势图 Summary

**健身页 #fc 面板做完：每个力量项一张手画内联 SVG 折线图（最大重量 / 估算单次最大 / 总训练量，目标虚线，手填历史空心点，徒手改看次数），五档时间范围按设备记住，电脑 4 张 / 手机 3 张翻页，加一张每周有氧总时长柱形图；图表控件在编辑门控期间照常可用，没有内联样式属性。**

## 收尾说明（执行器中断）

原执行器提交完 Task 3（ff4364f）后会话卡住（流看门狗，600 秒没有进展），没来得及写 SUMMARY.md、更新 STATE.md 和 ROADMAP.md。本文件由接手的续跑执行器写成：没有重做任何任务，核对了三个提交和应用源码，重新跑了 Task 3 的静态检查、云端定向运行（原报告 `15-03-t3c.json` 被后面的运行清掉，没有证明）和默认套件定向运行，结果见「定向运行结果」，然后做状态和路线图更新。

## Performance

- **Duration:** 三个任务提交在 14:18、14:25、14:33（-0800）；从 15-02 收尾到 Task 3 提交约 30 分钟，再加续跑的两次运行
- **Tasks:** 3（Task 1 是 tracer，Task 2、3 是 auto）
- **Files:** 7 个（2 个新增，5 个修改）
- **Commits:** 3 个任务提交，measured：`git rev-list --count 2de8b70..ff4364f` = 3
- **actuals.tokens:** 15915，按 chars/4 估算，新增行 63660 个字符（`git diff 2de8b70..ff4364f` 的 `+` 行，含测试）

## 规模说明

计划估算 140k，超过 100k 的建议线。仍然是一个计划、三个任务，原因照计划「规模」段：这是本阶段唯一没有同类代码可抄的部分（15-PATTERNS「No Analog Found」），三个任务各自提交、各自定向运行，Task 2、3 都在 Task 1 的 seriesOf / fcDraw 上继续写，拆开会让第二个计划在半成品图表上开工。实际改动约 16k tokens，远低于估算，原因同 15-01、15-02：用 `sed` 取片段、grep 定位，没有整段读取应用文件。

## Accomplishments

### 纯函数（Task 1、2、3，全部在纯函数段里）

- **`rangeStart(range,t)`：** `1m/3m/6m/1y` 分别往前 1、3、6、12 个日历月的同一天，那个月没有这一天就取它的最后一天（3 月 31 日 1m → 2 月 28 日）；`all` 返回 null；不认识的值（含 `hasOwnProperty` 之外的键）当 `1m`。结果是 YYYY-MM-DD，起点当天包含。
- **`seriesOf(s,p,id,metric,range,t)`：** 返回 `{mode,pts,any}`。训练点来自 `woMap`，日期不晚于 t，只收 w、r 都是有限数的组。取整规则：`max` 取当天最大 w（原样，22.5 不补零）；`e1rm` 每组 `Math.round(w*(1+r/30)*10)/10`（1 位小数）后取当天最大；`vol` 取 `Math.round(Σw*r*100)/100`（2 位小数）。`mode` 是 `reps` 当且仅当有训练组、全部训练组 w 都是 0、手填历史里没有大于 0 的有限值，看全部历史不看范围；`reps` 下 max 和 e1rm 取当天最多次数，vol 取次数之和。手填点只在 weight 且 max 下加入（日期合法、不晚于 t、v 有限、当天没有训练），带 `old:true`。点按日期升序，再按 rangeStart 过滤。`any` 不看范围。
- **`niceMax(v)`：** v 不是正的有限数返回 1；`t=v*1.05`，`n=10^floor(log10 t)`，在 1、2、4、5、10 乘 n 里取第一个不小于 t 的（容忍 1e-9）。
- **`cardioWeeks(s,range,t)`：** 起点是 `monday(rangeStart)`（`all` 是最早有氧那天的周一，没有有氧返回 `[]`），终点 `monday(t)`，每 7 天一个槽位；m 是这周所有有氧条目分钟数之和（不分项目），k 是有有氧条目的天数，空周 m、k 都是 0 但槽位保留，晚于 t 的不计。

### 图的几何（`fcDraw` / `fcDrawCd`）

- 宽度 W 取 `.fc-pl` 的 `clientWidth` 取整，为 0（标签隐藏）时记 `fc.stale=true` 并返回；svg 的 `width`、`viewBox="0 0 W 160"`、`height=160`，`preserveAspectRatio="none"`。
- 绘图区 `L=40, R=W-12, T=12, B=136`；横轴按日期天数比例（起点终点同一天，或 `all` 下只有一个点时，点放在水平正中）；纵轴从 0 起到 `niceMax(最大值，显示目标线时与目标取大)`，三条参考线（上限、一半、0）和刻度；所有坐标 `Math.round(x*10)/10`，值用 `fcFmt`（最多 2 位小数，不补零）。
- 目标虚线只在 weight 模式、metric 为 max 或 e1rm、目标是正数时画（`stroke-dasharray="6 4"`），标注靠右，离顶太近（y<20）放到线下面；总训练量和徒手图不画。
- 点超过 40 个只画折线和最后一个点，恰好 40 个全画；只有一个点时不画折线，图下写「只有一次记录……」。
- 柱形图：`slot=(R-Lx)/周数`，`bw=slot<8?slot:slot-4`（槽宽小于 8 不留缝），柱高 `(B-T)*m/top`，空周高 0；横轴左端最早一周的周一，右端「本周」。
- 空状态时图区是 `.fc-empty`（CSS 骨架里 160 px 高），三种句子都从 `.fc-pl` 里出。

### 分页和 ResizeObserver

- `fcMq=matchMedia("(max-width:560px)")`，`fcPer()` 为 3 或 4；`renderFc` 只写当前页的图；只有一页时不渲染 `.fc-pager`；`#fcPrev` / `#fcNext` 边缘真 disabled，`fcGo` 点到边缘后把焦点移到另一个按钮、写 `#fc-live`、不滚动。
- `fcMqChange`（`change` 事件，`addListener` 作旧浏览器后备）：新页号 `floor(旧页号 × 旧每页张数 ÷ 新每页张数)`，也就是当前第一张图的序号除以新张数，再 renderFc（页号在里面夹到最后一页）。翻页位置不记住，`resetSession` 把页号和指标复位。
- `ResizeObserver` 观察 `#fc`（不可用时退回 `resize` 事件加 150 ms 节流）：`fcResize` 宽度为 0 什么都不做；宽度没变且不是 stale 不重画；stale 时整组 renderFc，否则只对现有 figure 调 `fcDrawAny`，不重画整页。
- 指标和范围芯片、翻页器、每张图和柱形图的「查看数据」都带 `data-fit-ro`。指标每次打开页面回到最大重量，范围读 `usj:fit:range`，只认五个值，其余用 `1m`，写入 try/catch，键不在退出登录的清理列表里。

### 门控收窄（15-04 要删的两条）

`GATE_BLOCK` 里原来的 `[data-lift],[data-liftsave]` 现在是 **`#goals [data-lift],#goals [data-liftsave]`**（应用里恰好 1 处各一，都在 `GATE_BLOCK` 常量里）。**15-04 把目标页的力量卡搬到健身页时，这两条一起删掉**；健身页的 `.fc[data-lift]` 不再被 `closest(GATE_BLOCK)` 吞掉，`.fl-ex[data-lift]` 里的写入控件仍由 `[data-fl]` 拦。

## 定向运行结果

续跑时重新跑的两次（`npm` 低优先级、单 worker 包装，报告跑完立刻核对），Task 3 的静态检查（无 CR、六个标记、旧门控选择器 0 处、cardioWeeks 在纯函数段、`style="` 0 处、五个纯函数标记各 1 处、`APP_SHA256` 与文件一致）也都通过：

| 套件 | 内容 | 结果 |
|------|------|------|
| cloud（`npm run test:cloud`） | tests/cloud/fitness-log、reconcile-gate、plan-editor-fit | 22 条，0 失败（`REPORT OK expected=22 flaky=0 unexpected=0`，含云端门控用例和 15-02 的离线 / 门控用例） |
| 默认（`npm test -- --workers=1`） | tests/e2e/fitness、tests/e2e/goals、app-integrity | 47 条，0 失败（`REPORT OK expected=47 flaky=0 unexpected=0`，含 niceMax / cardioWeeks 单元用例、柱形图页面用例、SAFE-02） |

Task 1、Task 2 的定向运行由原执行器完成（各自的 verify 通过后才提交，三个提交都在），它们的报告在后面的运行里被清掉了，这里不引用数字。两个完整套件按计划在 15-07 的最后一个任务各跑一次，本计划没有跑。

## 本计划新增的用户可见文案（交给 Phase 16 总体验收由所有者过目）

全部镜像在 `tests/support/strings.ts`（「Phase 15-03」段）。含屏幕阅读器专用的文字（图的 `aria-label`、播报）。

| 常量 | 文案 |
|------|------|
| `T_FC_TITLE` / `T_FC_DATA` | 趋势图 / 查看数据 |
| `T_FC_GRP_METRIC` / `T_FC_GRP_RANGE`（芯片组 `aria-label`，读屏） | 指标 / 时间范围 |
| `T_FC_METRIC` | 最大重量 / 估算单次最大 / 总训练量 |
| `T_FC_RANGE` | 最近 1 个月 / 3 个月 / 半年 / 1 年 / 全部 |
| `T_FC_SUB`（图小标） | 最大重量 · {unit} / 估算单次最大 · {unit} / 总训练量 · {unit}×次 / 单组最多次数 · 次 / 总次数 · 次 |
| `T_FC_MNOTE` | 每个训练日取最重的一组。虚线是计划里的目标重量。 / 按「重量 ×（1 + 次数 ÷ 30）」估算只做一次能举多重，只是估算。虚线是计划里的目标重量。 / 每个训练日所有组的「重量 × 次数」加起来。 |
| `T_FC_MNOTE_BW` | 徒手动作（重量都是 0）改看次数。 |
| `T_FC_TARGET` / `T_FC_TODAY` | 目标 {target} {unit} / 今天 |
| `T_FC_READ` / `T_FC_READ_AT` / `T_FC_HAND` | 最新：{M月D日}　{值} {单位} / {M月D日}　{值} {单位}（指针读数）/（手填） |
| `T_FC_ARIA`（svg `aria-label`，读屏） | {动作名}{指标}折线图，{范围}，共 {n} 次训练，最新 {值} {单位}，最高 {值} {单位} |
| `T_FC_COL_DATE` / `T_FC_COL_SRC` / `T_FC_SRC_WO` / `T_FC_SRC_HAND`（数据表） | 日期 / 来源 / 训练 / 手填（指标列的表头用图小标） |
| `T_FC_EMPTY_NONE` / `T_FC_EMPTY_RANGE` / `T_FC_ONCE` | 还没有{动作名}的训练记录。记一次训练后，这里会出现曲线。 / 这段时间没有记录，可以选更长的时间范围。 / 只有一次记录，再练几次就能看出变化。 |
| `T_FC_LEGEND` | 空心点是以前手填的记录，没有次数。 |
| `T_FC_PREV` / `T_FC_NEXT` / `T_FC_PAGE` | 上一组 / 下一组 / 第 {p} / {n} 组 |
| `T_FC_LIVE_PAGE`（`#fc-live`，读屏） | 第 {p} / {n} 组：{动作名用顿号连} |
| `T_FC_LIVE_SWITCH`（`#fc-live`，读屏） | 已切换：{指标}，{范围} |
| `T_FC_CD_TITLE` / `T_FC_CD_UNIT` / `T_FC_CD_NOTE` | 每周有氧总时长 / 分钟 / 按周合计，周一到周日算一周。 |
| `T_FC_CD_READ` / `T_FC_CD_READ_WK` | 本周：共 {m} 分钟，{k} 天有氧 / {M月D日}起的一周：共 {m} 分钟，{k} 天有氧 |
| `T_FC_CD_EMPTY` / `T_FC_CD_EMPTY_RANGE` | 还没有有氧记录。在上面记一次有氧，这里会出现每周的柱形图。 / 这段时间没有有氧记录，可以选更长的时间范围。 |
| `T_FC_CD_COL_WK` / `T_FC_CD_COL_M` / `T_FC_CD_COL_K`（表头） | 周（起始日） / 总时长（分钟） / 有氧天数 |
| `T_FC_CD_THIS` | 本周（柱形图横轴右端） |

复用 15-02 的 `T_GOALS_NO_LIFTS`（没有力量项时的一句话），不算新增。

### UI-SPEC 之外的文案（需要所有者特别确认）

15-UI-SPEC 的 Copywriting Contract 里没有逐字写出下面这些，只有读屏用户听得到，界面上看不到：

| 位置 | 文案 | 说明 |
|------|------|------|
| 柱形图 svg 的 `aria-label`（`T_FC_CD_ARIA`） | 每周有氧总时长柱形图，{范围}，共 {n} 周，本周 {m} 分钟 | UI-SPEC 只给了折线图摘要的写法，柱形图的摘要由计划正文定了这句，照折线图的格式写 |
| 徒手图 svg 的 `aria-label` 里的指标名（`T_FC_REPS`） | 单组最多次数 / 总次数 | 用了 UI-SPEC 里小标的名字（去掉「 · 次」），拼进折线图摘要，UI-SPEC 的摘要例子只有重量图 |

其余文案（含 `已切换：…` 和 `第 p / n 组：…` 的播报）在 UI-SPEC 的无障碍一节和 Copywriting Contract 里都有。

## UI-SPEC 的 backstop 项（交给 Phase 16 总体验收，目视核对）

- **浅色和深色主题：** 折线、空心点、目标虚线、柱形、读数竖线都清楚（折线 / 柱 `--c-fit`，参考线 `--line`，目标线 `--muted`）。用例只量属性和 DOM，不量颜色。
- **375 px 下三张图：** 上下排整页可读；五个范围芯片折成两行不横向滚动、每个 44 px 高（样式是 15-01 的 CSS 骨架，页面用例验证了 3 张和页号，没有目视）。
- **真机：** 手指按住图时的读数竖线和 `touch-action:pan-y` 竖向滑动不被吃掉（用例用鼠标指针）。
- 严格 CSP 的零违规由 15-07 的 `csp.spec` 证明；本计划里 `style="` 在应用里是 0 处，用例断言 `#fc` 里没有带 style 属性的元素。

## Deviations from Plan

### Auto-fixed Issues

无：任务的 `<verify>` 都在提交前通过，续跑的两次运行也一次通过，没有需要修的地方。

### 计划之外的实现取舍

**1. 图的容器多了两层空 div（`.fc-pl`、`.fc-notes`）：** 计划把 svg 直接放在 figure 里，实际 svg（或 `.fc-empty`）放在 `.fc-pl` 里，图例和「只有一次记录」说明放在 `.fc-notes` 里，两者都没有样式规则。原因：宽度从 `.fc-pl` 量，三种空状态能整块替换图区而不碰读数行和标题。**Commit:** a09e334、06efefa

**2. `renderFc` 在 `#tab-fit` 隐藏时清空 `#fc`：** 计划写「只写 HTML、fcDraw 因宽度 0 直接返回」。实际隐藏时 `#fc` 直接 `textContent=""`（隐藏的标签里不留旧图、也不白算），显示时 `showTab` → `renderFit` 重画；`fc.stale` 仍保留给「显示了但宽度还是 0」的情况。**Commit:** a09e334

**3. 柱形图卡片显示条件：** 实现为「计划里有未归档有氧项」或「全部历史里有有氧记录」（`fcCd().show`），与计划一致；范围里没有时用 `data` 区分写哪句说明。无偏差，记在这里是为 15-04 / 15-07 查阅。

**Total deviations:** 0 个 bug 修复，2 个实现取舍（容器层级、隐藏时清空）。**Impact:** 没有范围蔓延；goals、week、narrow、escaping 的现有用例一行没改。

## Authentication Gates

无。

## Known Stubs

无。

## Threat Flags

无新增的网络端点、认证路径或信任边界。T-15-10（SVG 属性只来自 `Math.round` / `fcFmt` 算出的数字，日期、值、动作名、周起始日都经 `esc()`，`seriesOf` 只收有限数，没有 style 属性）、T-15-11（`usj:fit:range` 只认五个值，其余回落 1m，用例证明）、T-15-12（门控只把两条选择器收窄到 `#goals` 内，云端用例证明图表控件可用、记录区禁用，plan-editor-fit 证明目标页输入仍被拦）已按计划缓解并有用例；恶意数据和 csp.spec 在 15-07 再证明；T-15-SC 为 accept（没有安装任何包）。

## Next Phase Readiness

趋势图完整。15-04 可以直接在 `#fl` 和 `#fc` 之间插 `#fw`，并把目标页力量卡搬走时删掉 `GATE_BLOCK` 里的 `#goals [data-lift]`、`#goals [data-liftsave]` 两条。`seriesOf`、`cardioWeeks`、`rangeStart`、`niceMax` 都在纯函数段，可以直接 `loadAppPure`。15-07 要补恶意数据用例、严格 CSP 用例、375 px 五个标签，并在最后跑两个完整套件和勾选 FIT-01 到 FIT-05。

## Self-Check: PASSED

- 新增文件存在：`tests/e2e/fitness/charts.spec.ts`、`tests/e2e/fitness/charts-data.spec.ts`；`tests/support/fitness.ts`、`strings.ts`、`constants.ts`、`tests/cloud/fitness-log.spec.ts` 已更新
- 提交都在当前分支：a09e334（Task 1）、06efefa（Task 2）、ff4364f（Task 3），都带 Co-Authored-By 结尾
- Task 3 的静态检查、云端定向运行（22 条）和默认定向运行（47 条）续跑时都通过；`style="` 仍为 0，五个纯函数标记各恰好一次，`APP_SHA256` 与应用文件一致
