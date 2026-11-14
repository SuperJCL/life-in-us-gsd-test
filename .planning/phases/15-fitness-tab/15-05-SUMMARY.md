---
phase: 15-fitness-tab
plan: 05
subsystem: fitness-tab
tags: [training-history, fh-panel, woDeleteDay, calendar-chip, day-panel-row, timeline-row, calendar-csv, backupCounts, import-summary, playwright, playwright-cloud]

requires:
  - phase: 15-fitness-tab
    provides: 15-01 的 woMap / woSummary / eventsOn(date).wo / [data-wo] 捕获委托、CSS 骨架（.fh-item、.fh-body、.fh-act、.wo-go）；15-02 的 flDelete、goWo、记录区；15-04 的 renderFit 三块
provides:
  - "#fh 训练历史面板：renderFh（按月分组、日期倒序、details.fh-item 展开看各组、修改、删除、显示更早的记录）、fhOpen / fhN、fhDelete、woDeleteDay(date,discard,back)"
  - "日历格 .chip.k-fit、日面板 li.k-fit.wo[data-wo]、时间线 .tl-item.k-fit.wo[data-wo]（items 新增 cls、aria 字段）、日历 CSV 的「[健身] 」行"
  - "backupCounts().workouts（训练天数）和导入摘要的「训练 {n} 天」一行（T_IMP_WO，完整备份和旧备份两条路径）"
affects: [15-06 力量项上限 20, 15-07 收尾（完整套件、csp.spec、恶意训练夹具 expectClean、勾选需求）, Phase 16 总体验收]

actuals:
  tokens: 9150
  tasks: 3
  commits: 3

plan_head_before: 191f8ef23528aba02f3fcae2531b72b395a360bc
plan_head_after: 9a67498209a22e4037e56f55b21b8058b9f9c9bf

tech-stack:
  added: []
  patterns:
    - "删除一整天训练只有一个入口 woDeleteDay：记录区和历史共用，撤销用同一个键 woPut(s,date,gone) 整天写回，back 回调决定撤销后的焦点"
    - "历史的展开状态放在模块级 Set（fhOpen，日期键），捕获 toggle 事件增删，重画时带 open；与 goalsArchOpen 同一写法"
    - "三个视图的训练行各一种写法，但都靠 data-wo 交给 15-01 的捕获委托（点击、Enter、Space）进健身页那一天；训练行不带 editable、不可拖动"

key-files:
  created:
    - tests/e2e/fitness/history.spec.ts
    - tests/e2e/fitness/views.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/support/fitness.ts
    - tests/e2e/io/export.spec.ts
    - tests/e2e/data/backup-format.spec.ts
    - tests/cloud/fitness-sync.spec.ts

key-decisions:
  - "历史里删除一次训练后焦点到下一条（更早的）历史的 summary，没有就上一条，再没有就「训练历史」标题；撤销后焦点回到这一条的 summary（UI-SPEC 没写，按就近原则定）"
  - "历史删除不丢记录区草稿：记录区正在这一天且有未保存内容时只更新基准、保留草稿；记录区自己的「删除这次训练」仍然丢弃草稿（woDeleteDay 的 discard 参数）"
  - "历史在健身页没显示时不画（和趋势图一样），#fh 的焦点在重画前后按 #fhMore 或某条 summary 恢复"
  - "日历 CSV 的训练行加在文字记录和计划行之后，每个训练日一行，经现有 csvCell；Subject 以 [ 开头所以不会被转义，Description 里以 = 开头的动作名会加 '"

requirements-completed: []
requirements-advanced: [FIT-02, FIT-04, FIT-05]

duration: 约 30 分钟的任务提交跨度（Task 1 提交 2026-11-13 19:45 -0800，Task 3 提交 20:12 -0800），之后原执行器会话中断，由续跑执行器验证和收尾
completed: 2026-11-13
status: complete
---

# Phase 15 Plan 05: 训练历史、其他视图的训练行、导入导出 Summary

**健身页底部有了训练历史（按月分组、一次 20 条、展开看各组、修改、删除并可撤销），训练日在日历格、日面板、时间线和日历 CSV 里各有一行，JSON 备份带着训练，导入摘要在有训练时多一行「训练 {n} 天」；三个任务都通过本地和云端定向运行。**

## 收尾说明（执行器中断）

原执行器提交了全部三个任务（1b4464e、ae5213b、9a67498），然后在写 SUMMARY 之前会话卡住（流看门狗，600 秒没有进展），没有写 SUMMARY.md，也没有更新 STATE.md 和 ROADMAP.md。本文件由接手的续跑执行器写成：没有重做任何任务；先核对工作区干净、三个提交的 `Co-Authored-By` 和 `APP_SHA256`，再重跑各任务 verify 的静态检查，然后按几个文件一批、每批单独报告把定向运行全部重跑了一遍（原执行器留下的报告只剩一份，其余已被清掉，所以不引用）；没有发现失败，没有改应用。

## Performance

- **Duration:** 任务提交跨度约 27 分钟（19:45 到 20:12，-0800），不含中断和续跑
- **Tasks:** 3（Task 1 是 tracer，Task 2、3 是 auto）
- **Files:** 9 个文件有改动（2 个新增：history.spec.ts、views.spec.ts；7 个修改）
- **Commits:** 3 个任务提交，measured：`git rev-list --count 191f8ef..HEAD` = 3（写本文件时）
- **actuals.tokens:** 9150，按 chars/4 估算，新增行 36601 个字符（`git diff 191f8ef..9a67498` 的 `+` 行，含测试和应用改动）

## 规模说明

计划估算 120k（无校准样本，factor 1，置信度 low），超过 100k 的建议线。仍然是一个计划，原因：三个任务是同一条纵向切片（训练历史，然后同一份训练数据在三个视图和导入导出里出现），每个任务各自提交、各自定向运行，Task 2、3 只是在 Task 1 的数据模型和 15-01 的 `woMap` / `woSummary` 之上加几行渲染和一个计数；拆成两个计划会多一次状态交接，而不会让任何一个任务更小。实际新增 36601 个字符（约 9.2k token），远低于估算，这个估算偏高，和 15-04 一样。

## Accomplishments

### 训练历史（Task 1，1b4464e，S8、A21）

- **`renderFh()`：** 在 `renderFit` 里排在 `renderFc` 之后；健身页没显示时清空不画。`woMap(state)` 的日期倒序，取前 `fhN` 条（模块变量，默认 `FH_PAGE=20`），按 `yyyy-mm` 分组插 `.tl-month`「{Y} 年 {M} 月」，只出现有训练的月份。没有训练时 `<p class="empty">` 写 T_FH_EMPTY，也不渲染「显示更早的记录」。只列 `state.workouts`，不列 `state.lifts` 里以前手填的点。
- **每次训练：** `details.fh-item[data-fh]`，summary 一行（`<b>` 「{M月D日} 周{一}」加 `woSummary` 摘要，`data-fit-ro` 所以门控期间也能展开），默认折叠。展开后 `fhBody(day)`：每个力量动作一行「名称：重量 × 次数，…」（重量 0 写「徒手」），每个有氧一行「名称：{m} 分钟」或「名称：{m} 分钟，{d} 公里」，名称查不到用「已删除的力量项」/「已删除的有氧项」（T_FIT_GONE_L / T_FIT_GONE_C）；所有文字经 `esc()`。
- **展开状态：** `fhOpen`（日期键 Set）；`#fh` 上捕获 `toggle` 事件增删，重画时带 `open`，页面打开期间跨重画保留。
- **分页和焦点规则：** 「显示更早的记录」每点一次 `fhN += 20`；重画后焦点回到新的 `#fhMore`，没有更多时按钮不渲染，焦点改到最后一条的 summary；`#fl-live` 写「已显示更早的 {n} 次训练」，n 是这一次新显示的条数（`min(fhN,总数) - 点击前已显示数`）。重画前如果焦点在 `#fhMore` 或某条 summary 上，重画后恢复到同一个元素。
- **修改：** 「修改这次训练」带 `data-wo`，由 15-01 的捕获委托交给 `goWo`（已有换日期确认、显示健身页、聚焦 `#fl-title`、滚到顶部），没有新增修改代码。
- **删除和撤销：** 15-02 的 `flDelete` 主体提炼成 `woDeleteDay(date,discard,back)`，记录区和历史共用；`#fh` 上的 `[data-fhdel]` 走 `fhDelete(date)`，toast「已删除 {M月D日} 的训练」加「撤销删除」（6000 ms），撤销用 `woPut(s,date,gone)`，撤销后只写 `#fl-live`。焦点规则见 key-decisions。`flDelete` 改成调用它再把焦点放到 `#fl-date`，15-02 的删除用例照常通过。
- **测试：** `history.spec.ts` 两条用例（主用例按计划的 behavior 写：25 天种子、20 条、月份顺序、徒手和有氧距离明细、显示更早、修改进记录区、展开跨重画保留、删除与撤销回到原位置；另一条覆盖空状态和没有更多按钮）；`tests/support/fitness.ts` 的 `readHistory(page)`。

### 其他视图的训练行（Task 2，ae5213b，D-05、S9、A15）

- **日历格：** `renderCal` 的 chips 在文字记录之后、到期之前加 `<span class="chip k-fit">`「健身 · {woSummary}」（T_FIT_ROW）；chip 上没有 `data-wo`，点格子仍然是选中那一天；格子的 `aria-label` 在这一天有训练时末尾多「，有训练」，没有训练的格子逐字不变。
- **日面板：** 「做过的事」在文字记录之后加 `li.k-fit.wo[data-wo]`（`.tag`「健身」、摘要、`.wo-go`「›」，`role="button"`、`tabindex="0"`，`aria-label` 为 T_FIT_ROW_ARIA）；不带 `editable`、没有删除按钮；有文字记录或有训练时渲染 `ul.items`，两者都没有才显示「这天还没有记录。」。
- **时间线：** items 元素新增可选 `cls`、`aria`；「全部」和「健身」筛选下对 `woMap` 的每一天 push 一行（`cls:"wo"`、`attr:'data-wo="…"'`），push 在最后，稳定排序让它排在同一天的文字记录之后；「完成的计划」不含；行模板 `class="tl-item k-${it.k} ${it.cls||"editable"}"`，cls 为 wo 时末尾加 `›`。
- **点击：** 日面板和时间线的训练行都靠 `data-wo` 走 15-01 的捕获委托（点击和 Enter / Space）到 `goWo`；`GATE_ALLOW` 已含 `[data-wo]`，门控期间仍可点进去查看。本周页的训练行 15-01 就有，本任务只验证它不可拖动、没有 `data-edit`。
- **日历 CSV（A17）：** `exportCsv` 在文字记录和计划行之后，对每个训练日 `rows.push(["[健身] "+摘要, usDate(日期), "True", 摘要])`，经现有 `csvCell`（以 `= + - @` 开头的单元格前面加 `'`）；Subject 以 `[` 开头，所以只有 Description 里以 `=` 开头的动作名会被加 `'`。只有训练没有文字记录时也能导出（`rows.length===1` 的空导出提示自然把训练算进去）。
- **测试：** `views.spec.ts` 两条用例（三个视图的写法、点击和 Enter 进健身页那一天、不可拖动、同一天两行且训练天数只算一次、没有训练的日子与没有 workouts 的种子逐项一致）；`export.spec.ts` 的 CSV 训练行用例（含 `=SYNTH-cmd` 动作名的转义）。

### 备份计数和导入摘要（Task 3，9a67498，FIT-05、IO-08）

- **`backupCounts`：** 返回值加 `workouts: Object.keys(woMap(s)).length`（训练天数，没有 workouts 键是 0），旁边一条注释。迁移脚本经 `COMPOSE_EXPR` 求值同一个 `backupCounts`，多出的计数不影响它的自检，IO-09 自检用例通过。
- **导入摘要：** 新常量 `T_IMP_WO=n=>"训练 "+n+" 天"`；`importLines` 里完整备份和旧备份两条路径，都在 `T_IMP_MORE(…)` 之后用 `...(c.workouts>0?[T_IMP_WO(c.workouts)]:[])` 插入，为 0 时一行不多，所以没有训练的旧备份摘要逐字不变（`T_IMP_WO(c.workouts)` 恰好 2 处）。
- **导出不用改：** JSON 备份经 `backupOf` 序列化 state，`workouts` 随 `normalize` 的结果在非空时自动带上；本任务只用用例证明。
- **测试：** `backup-format.spec.ts` 的 IO-08 计数用例三处逐字比较各加 `workouts: 0`（标题不变），新增单元用例 `FIT-05 backupCounts counts training days and classifyBackup reads back…`（三天训练计数为 3、完整备份 JSON 往返后 state.workouts 深度相等、importPreview 的 state 和计数都带训练）；`tests/cloud/fitness-sync.spec.ts` 新增云端用例（账号里两天训练，下载备份里 state.workouts 等于服务器上的；导入只有 2026-03-15 一天训练的完整备份，摘要含「训练 1 天」，确认后服务器 workouts 只剩这一天；撤销导入回到 03-10、03-12 两天；没有训练的旧备份摘要不多出训练行）。

## 本计划新增的用户可见文案（交给 Phase 16 总体验收由所有者过目）

应用里是 `T_FH_*`、`T_CAL_WO`、`T_IMP_WO`，镜像在 `tests/support/strings.ts` 的「Phase 15-05」段。

### 在 15-UI-SPEC 的 Copywriting Contract 里（逐字取自表格）

| 常量 | 文案 | 位置 |
|------|------|------|
| `T_FH_TITLE` | 训练历史 | `#fh` 面板标题（可见 h3） |
| `T_FH_MONTH` | {Y} 年 {M} 月 | 历史的月份分组标题 |
| `T_FH_DAY` | {M月D日} 周{一} | 每次训练 summary 的日期 |
| `T_FH_LIFT` | {名称}：{重量} × {次数}，… | 展开后每个力量动作一行（重量 0 写「徒手」，复用 `T_FL_BW`） |
| `T_FH_CARDIO` | {名称}：{m} 分钟 / {名称}：{m} 分钟，{d} 公里 | 展开后每个有氧一行 |
| `T_FH_EDIT` | 修改这次训练 | 展开后的按钮 |
| `T_FH_MORE` | 显示更早的记录 | 历史底部按钮 |
| `T_FH_MORE_LIVE`（读屏） | 已显示更早的 {n} 次训练 | `#fl-live` |
| `T_FH_EMPTY` | 还没有训练记录。在上面记下第一次训练吧。 | 没有训练时 |

复用的已有文案：`T_FL_DELETE`（删除这次训练）、`T_FL_DELETED`（已删除 {M月D日} 的训练）、`T_FL_UNDO_DEL`（撤销删除）、`T_FIT_ROW`（健身 · {摘要}，日历 chip）、`T_FIT_ROW_ARIA`（打开健身页查看这次训练：{摘要}，日面板和时间线）、日面板和时间线训练行的 tag「健身」、`›`（`aria-hidden`，不读）。

### UI-SPEC 之外的文案（需要所有者特别确认）

| 常量 | 文案 | 说明 |
|------|------|------|
| `T_CAL_WO` | ，有训练 | 日历格 `aria-label` 在这一天有训练时的末尾，只给读屏用户，界面上看不到 |
| `T_IMP_WO` | 训练 {n} 天 | 导入确认框摘要的一行，只在备份里训练天数大于 0 时出现，排在「复盘…力量记录…」之后 |

日历 CSV 里训练行的 Subject 前缀「[健身] 」不是界面文案，沿用文字记录行「[类别] 」的写法，也不在 UI-SPEC 的文案表里，所有者在 Phase 16 导出看一次即可。

## 定向运行结果

每批单独写报告（`test-results/15-05-*.json`，已被后一批清掉），跑完立刻用 `tools/test-report/check-report.mjs` 核对；低优先级、单 worker，没有两批同时跑。全部由续跑执行器重跑。

| 批 | 套件 | 内容 | 结果 |
|----|------|------|------|
| t3c-1 | 云端 | fitness-sync、import | 14 条，`REPORT OK expected=14 flaky=0 unexpected=0` |
| t3c-2 | 云端 | import-undo、import-sync、export、migration | 26 条，`REPORT OK expected=26 flaky=0 unexpected=0`（含 IO-09 迁移自检） |
| t2v-1 | 默认 | tests/e2e/fitness（含 history、views、log、workouts-data 等） | 34 条，`REPORT OK expected=34 flaky=0 unexpected=0` |
| t2v-2 | 默认 | tests/e2e/calendar、tests/e2e/timeline | 24 条，`REPORT OK expected=24 flaky=0 unexpected=0` |
| t2v-3 | 默认 | tests/e2e/week、tests/e2e/io（含 IO-02 黄金 CSV 和新 CSV 训练行用例） | 50 条，`REPORT OK expected=50 flaky=0 unexpected=0` |
| t2v-4 | 默认 | csv-masking、app-integrity（SAFE-02）、security/escaping（SEC-01） | 18 条，`REPORT OK expected=18 flaky=0 unexpected=0` |
| t3v-2 | 默认 | tests/e2e/data、tests/e2e/io、app-integrity | 55 条，`REPORT OK expected=55 flaky=0 unexpected=0`（和原执行器留下的 t3v-1 同一个数字） |

三个任务 verify 里点名的用例都在上面某一批的 `check-report` 里逐条核对过；Task 1 的目录（tests/e2e/fitness、app-integrity、escaping）由 t2v-1、t2v-4 覆盖。云端批里没有出现 PLAN-07 那条已知抖动的用例（不在本计划的文件里）。两个完整套件按计划在 15-07 的最后一个任务各跑一次，本计划不跑。

**静态检查（三个任务 verify 的 grep 部分，HEAD 上重跑）：** 应用无 CR；各任务点名的标记全部存在（`id="fh" aria-labelledby="fh-title"`、`function renderFh(`、`function woDeleteDay(`、`class="fh-item"`、`data-fhdel=`、`id="fhMore"`、T_FH_EMPTY 原文、`woPut(s,date,gone)`、`cls:"wo"`、`"[健身] "+`、`class="k-fit wo" data-wo=`、`T_CAL_WO="，有训练"`、`it.cls||"editable"`、`workouts:Object.keys(woMap(s)).length`、`T_IMP_WO` 定义）；`T_IMP_WO(c.workouts)` 恰好 2 处；`style="` 0 处；五个纯函数段标记各恰好 1 处；`APP_SHA256` 与 HEAD 的应用文件一致。三个提交各自的暂存隐私检查由原执行器在提交时通过（提交已落地，pre-commit 钩子放行）。

## UI-SPEC 的 backstop 项（交给 Phase 16 总体验收，目视核对）

- **375 px 下历史的版面：** 「修改这次训练」和「删除这次训练」各占一半宽、44 px 高（CSS 骨架的窄屏块 `.fh-act button{flex:1}`）；展开明细 12 px 换行、长摘要不截断。用例只量 DOM 和属性，没有目视。
- **浅色和深色主题：** 日历 chip 的健身色（`--c-fit`）、历史的分隔线和灰色明细文字清楚可读；≤560 px 时训练 chip 和其他 chip 一样缩成点。
- **读屏：** 日历格末尾的「，有训练」、训练行「打开健身页查看这次训练：…」、「已显示更早的 {n} 次训练」的播报；`details` 展开状态读成展开 / 收起。
- **焦点：** 历史里删除后焦点到下一条（没有就上一条，再没有就标题）、撤销后回到这一条、「显示更早的记录」后焦点在新按钮上；这是 UI-SPEC 没有写的部分，请所有者按真实键盘操作确认体验。
- **门控期间（正在同步或离线只读）：** 历史可展开（summary 带 `data-fit-ro`），「删除这次训练」被 `[data-fl]` 拦住，「修改这次训练」仍可点；目视确认提示和灰态合理。
- **CSP：** 本计划没有新增内联样式（`style="` 仍是 0 处），严格 CSP 的零违规由 15-07 的 `csp.spec` 证明。
- **导入摘要和日历 CSV：** 在表格软件里打开导出的日历 CSV，看「[健身] …」行的日期和全天事件是否正常；导入一份带训练的真实备份时，摘要多一行「训练 {n} 天」读起来是否自然。

## Deviations from Plan

None - 三个任务按计划执行，续跑期间没有发现失败，也没有改应用或测试。

计划之内的小取舍（原执行器在提交里做的，续跑核对过）：
- 历史里的删除由 `fhDelete` 调 `woDeleteDay(date,false,back)`，记录区正在这一天且有未保存内容时保留草稿，只更新基准（计划只写了「flOpen(date)」的情形，这是同一规则对草稿的自然延伸）。
- `T_CAL_WO` 加在 `aria-label` 末尾、没有训练的格子逐字不变，由 views.spec 的「没有训练的日子与没有 workouts 的种子逐项一致」断言。

**Total deviations:** 0。**Impact:** 无范围蔓延。

## 已知问题和遗留

- 云端 `PLAN-07 while offline the pick button on the empty plan card…` 的偶发抖动本计划没有碰到（不在跑过的文件里），留给 15-07 完整套件观察。
- `tests/README.md` 对训练历史、视图训练行的说明由 15-07 改写。
- 15-07 的恶意训练夹具要在 `#fh`、日历 chip、日面板行、时间线行四处做 `expectClean`（T-15-16）。

## Known Stubs

无。

## Threat Flags

无新增攻击面：摘要、名称、日期在 `#fh`、日历 chip、日面板行、时间线行里全部经 `esc()`，`data-wo` 的值经 `esc()`（T-15-16，SEC-01 的 escaping 套件通过）；CSV 训练行经 `csvCell`（T-15-17，用例用 `=SYNTH-cmd` 动作名证明 Description 加 `'`）；导入摘要写明训练天数、确认后才替换、撤销导入把训练放回（T-15-18，云端用例证明）；历史一次只渲染 20 条（T-15-19）。

## Self-Check: PASSED

- 应用和测试文件存在：`us-journey-tracker.html`、`tests/e2e/fitness/history.spec.ts`、`tests/e2e/fitness/views.spec.ts`、`tests/e2e/io/export.spec.ts`、`tests/e2e/data/backup-format.spec.ts`、`tests/cloud/fitness-sync.spec.ts`、`tests/support/{strings,constants,fitness}.ts`。
- 三个提交都在 HEAD 的祖先里：1b4464e、ae5213b、9a67498。
- `plan_head_before` 191f8ef 到 `plan_head_after` 9a67498 之间 `git rev-list --count` = 3，与 `commits: 3` 一致。
