---
phase: 15-fitness-tab
verified: 2026-11-16T12:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/15-fitness-tab/15-01-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-01-SUMMARY.md"
  - ".planning/phases/15-fitness-tab/15-02-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-02-SUMMARY.md"
  - ".planning/phases/15-fitness-tab/15-03-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-03-SUMMARY.md"
  - ".planning/phases/15-fitness-tab/15-04-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-04-SUMMARY.md"
  - ".planning/phases/15-fitness-tab/15-05-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-05-SUMMARY.md"
  - ".planning/phases/15-fitness-tab/15-06-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-06-SUMMARY.md"
  - ".planning/phases/15-fitness-tab/15-07-PLAN.md"
  - ".planning/phases/15-fitness-tab/15-07-SUMMARY.md"
  - "tests/cloud/csp.spec.ts"
  - "tests/cloud/fitness-sync.spec.ts"
  - "tests/e2e/fitness/log.spec.ts"
  - "tests/support/constants.ts"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:184c588ba1ae6d68e0edd8c50d65d8cd06484fd693139dd9e10e2b770eae0e1b"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "375 px 下记训练：组行（序号、重量、×、次数、删除）一行放得下；记到 20 组时页面可滚动，虚拟键盘不盖住底部保存栏；手指按住「保存训练」时输入框失焦不会把按钮挤走"
    expected: "一行放得下 122.5 和 999；保存栏始终可点；所有按钮、输入框、芯片至少 44 px 高，手指能点中"
    why_human: "自动化用例只量 DOM 和属性，没有真机虚拟键盘、手指触控和目视"
  - test: "浅色和深色主题下看趋势图（折线、空心点、目标虚线、柱形、读数竖线）和本周七个日点、力量卡进度条"
    expected: "两种主题下都清楚；375 px 下三张图上下排整页可读；平板宽度下一页 4 张排得下；五个范围芯片折成两行、不横向滚动"
    why_human: "颜色对比和版面观感只能目视"
  - test: "在真机上用手指按住图表左右拖动读数，同时竖向滑动页面"
    expected: "读数竖线跟手，竖向滑动不被吃掉（touch-action:pan-y）"
    why_human: "指针事件和手势冲突只在真机触屏上出现"
  - test: "375 px 真机上看五个标签、长 toast（已加入 3 个目标组、4 个力量项、3 个有氧项，计划已保存 等）、示例挑选对话框最多 14 行、窄屏保存栏的上下顺序"
    expected: "五个标签一行、点击区域够大；长 toast 完整换行；示例列表只滚中间、最后一行不被底部按钮盖住；保存栏从上到下是 保存训练 / 放弃未保存的内容 / 删除这次训练"
    why_human: "字号、换行和触控区域只能目视；窄屏保存栏用 CSS order 重排，视觉顺序与 DOM / Tab 顺序不同，需要真键盘确认"
  - test: "系统回收页面后重新打开，看未保存的训练草稿（wodraft）是否带回；手机浏览器关闭页面时 beforeunload"
    expected: "已填的组被带回；beforeunload 在手机上不保证弹出（所有者已接受，同编辑计划页）"
    why_human: "用例只覆盖刷新，不覆盖系统回收页面和手机浏览器行为"
  - test: "两台真实设备（中国大陆和美国网络）：A 记训练，看 B 的健身页、训练历史、趋势图和本周页几秒内出现；手机真正断网记训练再联网"
    expected: "几秒内同步；断网能记、联网后上传"
    why_human: "真机网络体感；路线图 Phase 16 成功标准 2 和 3"
  - test: "所有者通读全部新文案，特别是 15-07-SUMMARY 列出的 UI-SPEC 之外的文案（已删除的力量项、已删除的有氧项、已添加动作：…、已删除 {M月D日} 的训练、已移除：…、已撤销：…、每周有氧总时长柱形图的 aria-label、单组最多次数 / 总次数 等）和 IN-07 导入摘要的「，有氧项 n 个」"
    expected: "措辞和语气合适，读屏播报清楚"
    why_human: "文案好不好只有所有者能判断"
  - test: "读屏和键盘：健身说明按钮的箭头方向和聚焦、日点整组读成一句话、进度条读「{名称}进度」、历史里删除后焦点去向（下一条、上一条、再没有到标题）、日历格末尾「，有训练」"
    expected: "播报和焦点顺序合理"
    why_human: "UI-SPEC 没写的焦点去向需要用真实键盘和读屏确认"
---

# Phase 15: 健身页（Fitness Tab）Verification Report

**Phase Goal:** 健身从「目标」页和文字记录里独立出来，成为第五个标签「健身」：在这里看每个力量项的目标和每周训练次数，按组记录当天的训练（重量 × 次数），按动作看趋势图。训练和其他数据一样按账号存在服务器上，离线可记、跨设备同步，导出导入不丢。
**Verified:** 2026-11-16
**Status:** human_needed
**Re-verification:** No — initial verification

**结论一句话：** 除了所有者已决定推迟到 Phase 16 总体验收的人工目视和真机检查之外，本阶段全部通过：5 条路线图成功标准全部由应用代码和已通过的用例证实，没有缺口（gap）。`human_needed` 完全来自下面「Human Verification Required」里推迟的项目，不是真实缺口。

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | 标签栏多出「健身」，桌面和 375 px 放得下，可键盘切换；页面从上到下是今天的训练、本周训练和力量目标、趋势图、训练历史；每个力量项显示由训练算出的当前值、目标、进度；目标页不再有力量卡片；力量项上限 20 | ✓ VERIFIED | `us-journey-tracker.html:614` 第五个 `button[role=tab][data-tab=fit]`（原生 button，Tab 聚焦、Enter / 空格激活）；`:666-675` 面板顺序 `#fl`、`#fw`、`#fc`、`#fh`；`liftNow`（`:928`）取最近一次训练最重一组，无训练回落手填 cur；`renderFw`（`:2813`）画值、目标、进度条；`renderGoals`（`:2580`）只剩目标组，`saveLift` 全文件无匹配；`PLAN_MAX.lifts=20`（`:1188`）。用例：`narrow.spec`「at 375 px the five tabs fit without horizontal scroll…」、`goals.spec`「the goals tab no longer shows lift cards…」、`plan-editor-fit.spec`「…add button stops at 20 lifts」均通过 |
| 2 | 记录训练：选日期（默认今天，一天一次，再记并进当天）和力量项，逐组记重量 × 次数（徒手填 0），可复制上一组、删某一组；记录时看到该动作上次的各组；可记有氧（时长必填、距离可选）；保存后可整次修改和删除，删除可撤销 | ✓ VERIFIED | `renderFl`（`:2789`）日期框 `max=today`；`workoutProblems`（`:889`）校验时长必填、距离可选、重量 0 合法；`flSave`（`:2921`）经 `commit(["wo:"+date],woPut)` 整天覆盖（同日并入）；`woDeleteDay`（`:2944`）删除带 6000 ms 撤销 toast；`liftLast`（`:910`）供「上次训练」参考行和照上次填。用例 `log.spec`「sets are added, copied…filled from the last training and deleted with an undo」、「recording again on a day… merges」、「a cardio item needs a duration…」、`history.spec`「…opens a training for editing or deletes」全部通过 |
| 3 | 趋势图：每个力量项一张折线图，默认最大重量并画目标虚线，可切估算单次最大重量和总训练量，徒手改看次数；按组翻页（电脑 4、手机 3）；每周有氧总时长柱形图；时间范围 1 个月（默认）、3 个月、半年、1 年、全部；无数据或单点显示说明；严格 CSP 下正常（无内联样式属性），深浅色可读 | ✓ VERIFIED（深浅色观感归人工项） | `seriesOf`（`:952`）三个指标和 `reps` 模式（徒手）；`fcPer=()=>fcMq.matches?3:4`（`:3070`，`max-width:560px`）；`cardioWeeks`（`:979`）按周、`all` 范围钳到 520 周；`rangeStart`（`:943`）五档。用例 `charts-data.spec` 三条、`charts.spec` 七条（含默认 1 个月、4 / 3 张翻页、徒手无目标线、「carry no style attribute」）、`csp.spec`「…five views with a training and its charts…」零违规，均通过 |
| 4 | 和现有视图衔接：记过训练的那天在本周、日历和时间线里出现一条「健身」记录并计入本周健身次数；手填力量历史作为趋势图上的点保留；当前值随训练更新 | ✓ VERIFIED | `trainDays`（`:920`，训练日与健身文字日取并集，本周页 `:2534` 和健身页 `:2814` 共用）；本周行 `:2542`、日历 chip 和日面板 `:2562-2574`、时间线 `:2631` 都经 `woSummary` 直接按 `state.workouts` 显示（D-05，不生成文字记录）；`seriesOf` 在 `weight`+`max` 下把 `hist` 作为 `old:true` 空心点。用例 `views.spec`、`goals.spec`（trainDays 并集、liftNow）、`charts.spec`「hand-entered lift history appears as hollow points」、`export.spec`「calendar CSV has one fitness row per training day」通过 |
| 5 | 训练按账号存在服务器上，离线可记、联网后上传、几秒内同步到另一台设备；JSON 导出导入含训练，导入按白名单校验、恶意文字被转义；无训练的旧备份照常导入；v1 154 条和 cloud 全量通过 | ✓ VERIFIED（真机网络体感归人工项） | 同步键 `wo:<日期>`（`:2932`、`:2947`、`:2951`、`:3946`）走 Phase 10 的 `commit` 重放；`normalize`（`:1090-1106`）对 workouts 按日期键、`LIFT_ID_RE` / `CARDIO_ID_RE`、数值范围白名单修正，空则不输出键（旧备份不受影响）；`importProblem` 对坏日期键和坏 id 返回 `"workout"` 整份拒绝；`LEGACY_KEYS` 含 `workouts`；`syncOnce` 的 `heldSlot`（`:1897-1901`）和 `swapSlot`（`:2272`）修了重试上传丢本机操作。用例 `fitness-sync.spec` 7 条（含两台设备同天、不同天、实时到达、WR-01）、`workouts-data.spec`、`backup-format.spec`、`escaping.spec`「SEC-01 malicious cardio names and malformed workouts…」通过 |

**Score:** 5/5 truths verified（0 条存在但行为未验证）

### Deferred Items

无。没有缺口需要推迟；下面 Human Verification 里的项目是所有者 2026-11-12 决定推迟到 Phase 16 总体验收的人工检查，不是后续阶段要补的缺口。

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `us-journey-tracker.html` | 第五个标签、`#fl/#fw/#fc/#fh` 四块、`state.workouts` 数据层、`plan.cardio`、趋势图纯函数、训练行、导入导出 | ✓ VERIFIED | 4229 行；SHA-256 前 12 位 `cc2b07d63d1f`，等于 `tests/support/constants.ts` 的 `APP_SHA256`，也等于回归套件跑的版本；工作区干净（`git status` 对应用和 tests 无改动） |
| `tests/e2e/fitness/*.spec.ts`（log、history、charts、charts-data、goals、views、workouts-data） | FIT-01..FIT-05 的默认套件用例 | ✓ VERIFIED | 回归报告里这些 spec 标题全部是 `expected`（通过） |
| `tests/cloud/fitness-log.spec.ts`、`fitness-sync.spec.ts`、`plan-editor-cardio.spec.ts`、`csp.spec.ts` | 云端的草稿保护、两台设备合并、实时、严格 CSP | ✓ VERIFIED | 同上，全部通过 |
| `tests/e2e/security/escaping.spec.ts`、`state-validation.spec.ts`、`tests/fixtures/malicious-state.ts` | SEC-01 延续到训练和有氧项 | ✓ VERIFIED | escaping 用例在回归里通过；state-validation 在默认分片里通过（分片 `reg-v-s2c` 在 e1dfc1d 之后重跑） |
| `.planning/phases/15-fitness-tab/15-SECURITY.md`、`15-REVIEW*.md`、`15-UI-REVIEW.md` | 阶段收尾记录 | ✓ VERIFIED | 29 条威胁 `threats_open: 0`；代码评审 12 条（4 warning、8 info）全部 fixed，`open: 0` |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| 记录区保存 `flSave` | `state.workouts` 与服务器 | `commit(["wo:"+date], woPut)` → Phase 10 的 `syncOnce` | WIRED | `:2932`；`woPut` 整天覆盖、重复执行结果相同，只碰这一天 |
| 删除整次训练 / 撤销 | `state.workouts` | `commit(["wo:"+date], woDel / woPut)` | WIRED | `:2947`、`:2951` |
| 计划里彻底删除力量项或有氧项 | 训练记录里对应条目 | `planCommit` 里的 `wclean` + `wo:<日期>` 键 | WIRED | `:3946` 附近 |
| `state.workouts` | 本周、日历、日面板、时间线 | `woSummary` + `data-wo` 点击 / 键盘进入 `goWo` | WIRED | `:2542`、`:2562`、`:2574`、`:2631`、`:3239-3240` |
| `state.workouts` | 本周训练次数 | `trainDays`（本周页 `:2534`、健身页 `:2814`） | WIRED | 同一个函数，只有一个口径 |
| `state.workouts` + `state.lifts[id].hist` | 趋势图 | `seriesOf` → `fcSer` → `renderFc` → `fcDrawAny` | WIRED | `:952`、`:3078` |
| `state.workouts` | 力量目标卡当前值 | `liftNow` → `renderFw` | WIRED | `:928`、`:2813` |
| 导入文件 / 服务器文档 / 本机缓存 | `state` | `importProblem`（拒绝）+ `normalize`（修正） | WIRED | `:1015`、`:1090-1106`；载入和导入共用 `normalize` |
| `state` | JSON 备份 / 日历 CSV | `JSON.stringify(state)`；CSV 经 `woSummary` | WIRED | `:4199-4206`；`backupCounts` 统计训练天数（`:1156`） |
| 编辑门控 `applyGate` | 健身页写入控件 | `GATE_ALLOW` 放行 `[data-wo],[data-fit-ro]`，其余禁用 | WIRED | `:1493`；WR-04 的 `renderFit` 后再 `applyGate` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `renderFw` 力量卡 | `liftNow(state,L)` | `state.workouts`（用户保存、服务器同步） | 是；无训练时回落 `state.lifts[id].cur` 再回落计划 `def` | ✓ FLOWING |
| `renderFc` 折线图和数据表 | `seriesOf(state,…)` | `state.workouts` + `state.lifts[id].hist` | 是 | ✓ FLOWING |
| `renderFc` 有氧柱形图 | `cardioWeeks(state,range,today)` | `state.workouts[*].cardio` | 是 | ✓ FLOWING |
| `renderFh` 训练历史 | `woMap(state)` | `state.workouts` | 是 | ✓ FLOWING |
| 本周 / 日历 / 时间线训练行 | `woSummary(e.wo, plan)` | `woMap(state)[date]`，名称取 `plan.lifts` / `plan.cardio` | 是；找不到的 id 显示「已删除的力量项 / 有氧项」 | ✓ FLOWING |
| 记录区草稿 | `fl.draft` | `flOpen(date)` 从 `state.workouts` 载入，本机留底 `wodraft` 恢复 | 是 | ✓ FLOWING |

没有硬编码空值、静态返回或 mock 流向界面。

### Behavioral Spot-Checks

按任务要求，没有重跑套件，引用已有 JSON 报告（`p15-reg2`，应用 SHA 与当前 HEAD e1dfc1d 一致）。

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| cloud 全量（分片 3 份） | 读 `reg-c-s1/s2/s3.json` 的 `stats` | expected 96 + 95 + 95 = 286，unexpected 0，flaky 0，skipped 0 | ✓ PASS |
| 默认全量（分片 2 份，含 v1 的 154 条） | 读 `reg-v-s1.json`、`reg-v-s2c.json` 的 `stats` | expected 119 + 119 = 238，unexpected 0，flaky 0，skipped 0 | ✓ PASS |
| 应用版本与测试固定的哈希一致 | `sha256sum us-journey-tracker.html` 对 `APP_SHA256` | 前缀 `cc2b07d63d1f` 一致 | ✓ PASS |
| 每条 FIT 相关用例在报告里是通过状态 | 遍历报告 `suites`，筛 fitness / FIT- / csp / narrow 标题 | 全部 `expected` | ✓ PASS |

### Probe Execution

SKIPPED：本阶段的 PLAN 和 SUMMARY 没有声明 `probe-*.sh`，`scripts/` 下也没有对应约定的探针。

### Requirements Coverage

PLAN frontmatter 合计声明 FIT-01..FIT-05（15-01：01/02/04/05；15-02：02/05；15-03：03/04；15-04：01/04；15-05：02/04/05；15-06：01/02；15-07：全部五个）。REQUIREMENTS.md 里 FIT-01..FIT-05 都映射到 Phase 15，没有 ORPHANED 的需求。

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| FIT-01 | 15-01、04、06、07 | 第五个标签「健身」，力量项当前值（由训练算出）、目标、进度，本周训练次数对目标；目标页无力量卡；上限 20 | ✓ SATISFIED | 真值 1：`:614`、`renderFw`、`liftNow`、`PLAN_MAX.lifts=20`；`goals.spec`、`plan-editor-fit.spec` 通过 |
| FIT-02 | 15-01、02、05、06、07 | 按天记训练，逐组重量 × 次数，复制上一组，上次各组，有氧，整次修改和删除 | ✓ SATISFIED | 真值 2：`flSave`、`woDeleteDay`、`liftLast`、`workoutProblems`；`log.spec` 九条、`history.spec`、`fitness-log.spec` 通过 |
| FIT-03 | 15-03、07 | 趋势图（三个指标、徒手看次数、目标虚线、翻页 4 / 3、有氧周柱图、五档范围） | ✓ SATISFIED | 真值 3：`seriesOf`、`cardioWeeks`、`fcPer`；`charts.spec`、`charts-data.spec`、`csp.spec` 通过 |
| FIT-04 | 15-01、03、04、05、07 | 本周、日历、时间线显示「健身」行并计入次数；手填历史作为点保留；当前值随训练更新 | ✓ SATISFIED | 真值 4：`trainDays`、`woSummary`、`seriesOf` 的 `old` 点；`views.spec`、`goals.spec` 通过 |
| FIT-05 | 15-01、02、05、07 | 按账号存服务器，离线可记、跨设备同步；JSON 导出导入含训练，白名单校验并转义；旧备份照常导入 | ✓ SATISFIED（含一条已知限制，见下） | 真值 5：`wo:<日期>` 同步键、`normalize`、`importProblem`；`fitness-sync.spec`、`workouts-data.spec`、`escaping.spec` 通过 |

**FIT-05 已知限制（所有者已认可，不是缺口）：** 真正断网（连接被拒绝）一段时间后重连，如果两台设备有真冲突，走 Phase 10 的 D-03：本机整份上传，另一台设备的版本作为可下载留底保存在本机；「两台设备的离线编辑都保留」是 `10-CONTEXT` 里的延后想法。15-07 的跨设备用例用 503（重试状态）而不是拒绝连接，两边的训练日都会保留。请所有者知晓：真断网期间对方记的训练只在留底里。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `us-journey-tracker.html` | — | `TODO / FIXME / XXX / TBD` 债务标记 | — | 无匹配（全文件 grep 为空） |
| `us-journey-tracker.html` | — | 占位文字、空实现、硬编码空数据流向界面 | — | 无；`return []` 一类都是类型判断后的空容器，数据由 `state` 填充（Level 4 已追踪） |
| `us-journey-tracker.html` | 3239-3240 | `data-wo` 点击在捕获阶段 `stopPropagation` | ℹ️ Info | 与代码库既有约定一致（CLAUDE.md 说明部分监听器在捕获阶段并 `stopPropagation`），用例覆盖 |

### 已接受的风险和已关闭的评审

- **T-15-04（旧版本页面会丢 `workouts` / `plan.cardio`）：** 已接受（15-SECURITY AR-01），由 ROADMAP Phase 16 的「上线前提」（commit dcb9a0f）承接：部署后先确认所有设备和标签页都换成新版本，才能记第一条训练、迁移真实数据。ROADMAP 里该条存在，已核对。
- **代码评审：** 15-REVIEW 的 12 条（WR-01..04、IN-01..08）都在代码里能找到对应修复（例如 `heldSlot` / `swapSlot`、IN-03 的 `normalize` 先校验再登记 id、WR-03 的 520 周钳制、WR-04 的 `applyGate`），`15-REVIEW-DISPOSITION.md` 记 `open: 0`。
- **UI 评审三项修复（427395e）：** 已在代码里：历史摘要用 `::before` 画 ▸ / ▾，窄屏保存栏用 `order` 让保存训练在最上，力量卡 ≤560 px 两列。其视觉效果归下面的人工项。
- **15-07 已知小问题：** 手改的坏数据里同一天第一个 bench 条目的 `sets` 不是数组时，同天后面合法的 bench 条目会被丢。界面不会产生这种数据；IN-03 后 `normalize` 先校验再登记 id，此情形已缓解。非缺口。

### Human Verification Required

下面 8 项都是所有者 2026-11-12 明确推迟到 Phase 16 总体验收的人工检查（无逐阶段 UAT）。自动化用例只量 DOM 和属性，不能代替目视和真机。完整文字见本文件开头 frontmatter 的 `human_verification`。

1. **375 px 记训练**：组行一行放得下，20 组时虚拟键盘不盖住保存栏，44 px 触控区域，手指按住保存训练不被挤走。
2. **深浅色主题和图表版面**：折线、空心点、目标虚线、柱形、读数竖线；375 px 三张图、平板 4 张图、范围芯片折行。
3. **真机手指拖动读数**：竖向滑动和读数竖线互不吃掉。
4. **375 px 的五个标签、长 toast、示例挑选对话框、窄屏保存栏顺序**（CSS order 与 DOM / Tab 顺序不同，需真键盘确认）。
5. **系统回收页面后的草稿恢复，手机上的 beforeunload**。
6. **两台真实设备（中国大陆和美国）的同步体感、真断网再联网**（路线图 Phase 16 成功标准 2、3）。
7. **所有者通读全部新文案**：15-07-SUMMARY 列出的 UI-SPEC 之外的字符串，加上 IN-07 导入摘要的「，有氧项 n 个」。
8. **读屏和键盘细节**：说明按钮箭头与聚焦、日点读法、进度条读法、历史里删除后焦点去向、日历格「，有训练」。

### Gaps Summary

没有缺口。路线图 5 条成功标准全部由应用代码（逐项读过实现和数据流）加已通过的用例证实；FIT-01..FIT-05 全部有实现证据，没有孤立需求；v1 的 154 条用例仍在默认套件中通过（238 条，0 失败、0 flaky），cloud 全量 286 条通过。逃过自动检查、需要所有者在 Phase 16 做的，只有上面 8 项人工目视和真机检查。因此状态是 `human_needed`，不是 `gaps_found`：可以带着这 8 项待办进入 Phase 16。

对 Phase 16 的提醒：部署前务必遵守 ROADMAP 里的上线顺序（先让所有设备换成新版本，再记第一条训练和迁移真实数据）。

---

_Verified: 2026-11-16_
_Verifier: Claude (gsd-verifier)_
