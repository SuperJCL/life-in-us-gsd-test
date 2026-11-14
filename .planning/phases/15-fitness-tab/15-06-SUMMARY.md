---
phase: 15-fitness-tab
plan: 06
subsystem: fitness-tab
tags: [plan-editor, cardio-items, lift-limit-20, training-history, planCommit-workouts-cleanup, sample-picker, playwright, playwright-cloud]

requires:
  - phase: 15-fitness-tab
    provides: 15-01 的 plan.cardio 形状、CARDIO_ID_RE、planCardio、planUsedIds、DEFAULT_PLAN.cardio（r-run、r-bike、r-walk）；15-02..15-05 的记录区、woMap / woPut、训练历史；12、14 的编辑页、归档、示例挑选
provides:
  - "编辑计划页「健身」分区的有氧项区：peCardioCard、peAddCardio、peCTarget、peCardioSum、peCardioList、peCardio；planProblems 的 cname / ctarget / climit；PLAN_MAX.cardio 20；PE_ERR 三条文案"
  - "PLAN_MAX.lifts 放宽到 20，所有带 8 的文案改成 20（T_PE_LIM_LIFTS 字面 20，T_PK_LIM_L / T_PK_FULL_L 用 PLAN_MAX 拼）"
  - "训练算作历史：liftHistoryCount 含训练天数，纯函数 cardioHistoryCount、liftSetCount；有历史只能归档，彻底删除连训练里的条目一起删（planCommit 的 wclean）"
  - "有氧项的删除 / 归档 / 恢复 / 彻底删除、已归档区的有氧项组、D-08 复查的有氧项一行"
  - "示例挑选的有氧栏：pickSample 的 r: 键和 cardio 返回值、#pk-lim-r、三段式提示和 toast（pkParts(g,l,c)）、pkSave / pkAddToDraft 的有氧项"
affects: [15-07 收尾（完整套件、csp.spec、恶意计划夹具加有氧项名称、勾选 FIT-01..FIT-05）, Phase 16 总体验收]

actuals:
  tokens: 17358
  tasks: 3
  commits: 3

plan_head_before: a717a81e1fbec3e0f1b58dca8e211e0409a7fa7d
plan_head_after: 0ca066447372553f9c492ee46a03f48ecdf624f9

tech-stack:
  added: []
  patterns:
    - "编辑页按键首字符分派种类：g 组、l 力量项、r 有氧项、其余任务（p 是预设标签）；有氧项每一处都和力量项并列，没有新的分派机制"
    - "草稿里 cardio 可以没有这个键：读用 (d.cardio||[])，写前经 peCardioList() 补成数组；peCanon 把空 cardio 当没有这个键，所以「加了又删」不算修改"
    - "planCommit 的 state 清理在同一个 commit 里连 workouts 一起清：离开计划的 id 集合（outWL、outWR）→ 受影响日期（outWd）→ wo:<日期> 键；fn 按 id 过滤，用 woPut 写回，两个数组都空的天整天去掉"

key-files:
  created:
    - tests/cloud/plan-editor-cardio.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/support/plan-editor.ts
    - tests/support/plan-picker.ts
    - tests/cloud/plan-editor-fit.spec.ts
    - tests/cloud/plan-editor-archive.spec.ts
    - tests/cloud/plan-onboarding.spec.ts
    - tests/e2e/data/plan-normalize.spec.ts

key-decisions:
  - "每次目标三选一：同一种再点保留原来的数值，换种或从「不设目标」过来是空串（保存前要填，大于 0）；摘要在数值为空时写「没有目标」，不写「每次  公里」"
  - "有氧项卡的上移 / 下移 aria-label 写「上移有氧项：{名称}」「下移有氧项：{名称}」，已归档区按钮的动词写「有氧项」，照力量项的写法（UI-SPEC 没写，列入 UI-SPEC 之外的文案）"
  - "T_PE_LIM_CARDIO 用 PLAN_MAX.cardio 拼；T_PE_LIM_LIFTS 按 verify 要求写成字面「最多 20 个」，两者都与 PLAN_MAX 一致"
  - "归档不清训练、彻底删除才清；清理只针对这次离开计划的 id，已不在计划里的旧条目（只含计划的导入留下的）不动（计划里的显式假设）"

requirements-completed: []
requirements-advanced: [FIT-01, FIT-02]

duration: 三个任务提交跨度约 17 分钟（22:53 到 23:10，-0800），不含读代码和测试批次
completed: 2026-11-13
status: complete
---

# Phase 15 Plan 06: 编辑页有氧项、力量项上限 20、训练算历史、示例挑选的有氧栏 Summary

**编辑计划页「健身」分区有了有氧项（名称、备注、每次目标三选一、校验、上限 20、删除 / 归档 / 恢复 / 彻底删除），力量项上限放宽到 20，训练记录算作力量项和有氧项的历史（彻底删除时训练里的条目一起清），示例挑选对话框多了「有氧项」一栏。**

## Performance

- **Tasks:** 3（Task 1 是 tracer，Task 2、3 是 auto，都 tdd="true"，每个任务测试和实现在同一次提交里）
- **Files:** 10 个文件有改动（1 个新增：plan-editor-cardio.spec.ts；9 个修改），`git diff a717a81..HEAD` 共 +930 −96
- **Commits:** 3 个任务提交，measured：`git rev-list --count a717a81..HEAD` = 3（写本文件时）
- **actuals.tokens:** 17358，按 chars/4 估算，新增行 69432 个字符（`git diff` 的 `+` 行，含测试和应用改动）

## 规模说明

计划估算 150000，超过 100000 的建议线；实际按 chars/4 估算约 17k，远低于估算（估算按「整段读取应用文件加多轮回归」计，实际用 grep 和 sed 取片段、定向批次运行）。仍然保持一个计划、三个任务，原因同计划的「规模」一段：编辑页的分派代码（按键的第一个字符区分组、任务、力量项）是一个整体，有氧项必须在同一个计划里接进全部分支（点击分派、输入写回、移动、删除、撤销移除、归档、恢复、彻底删除、D-08 复查、字段所在卡的映射）；三个任务各自独立提交、各自定向运行，没有出现半成品互相依赖。

## Accomplishments

### 编辑页按键前缀分派的全部改动点（r 是有氧项）

`pe.open`、`pe.gone`、`data-key`、`data-pefield` 的键前缀：`g:` 组、`t:` 任务、`l:` 力量项、`r:` 有氧项、`p:` 预设标签、`fit:` 每周目标。有氧项接进了下面每一处：

- **建立和 id：** `openPlanEditor` 的 `origIds`（加 `planCardio(plan)` 的 id）、`peUsedIds`（加草稿有氧项 id，`pe.gone` 的 id 本来就在）、`peCanon`（空 cardio 数组当没有这个键）。
- **渲染：** `peCardioCard`（`.pe-card.k-fit`，头部名称 / 摘要 / 上移下移，body 里名称、备注、每次目标 `.seg`、数值框、删除）、`peFitHTML`（力量项之后的小标题 + `{n}/20` + 卡片 + 添加按钮 + 满了的说明）、`peArchivedHTML`（已归档区的有氧项组）。
- **点击分派（peRoot click）：** `addcardio`、`ctarget`（用 `data-pekind`）、`delcardio`；`up` / `down` 经 `peMove`，其中 `key.charAt(0)==="r"` → `"cardio"`；`restore` / `purge` 经 `peRestore`、`pePurge` 的 `k==="r"`。
- **输入写回（peRoot input）：** `p[0]==="r"` 分支，`n`、`note` 写字符串，`tv` 用 `peNum` 写进 `target.v`，就地更新卡片头的名称、摘要和按钮的 aria-label。
- **查找：** `peList("cardio")`、`peItem("cardio")`、`peCardio(id)`、`peCardioList()`、`peCardOf("r:…")`（保存时出错的卡自动展开）、`peFocusNear`（焦点落到下一张卡或「＋ 添加有氧项」）、`peUndoRemove`。
- **删除 / 归档：** `peDelete`（`cardioHistoryCount(state,id)>0` 才归档，否则直接移除加撤销 toast）、`peArchive`（`T_PE_ARCH_CD_*` 确认框）、`peRestore`（满 20 个不做）、`pePurge`（`T_PE_PG_CD_*`）。
- **D-08 复查：** `peGoneHit`（`cardioHistoryCount>0`）、`peD8Line`（`T_PE_RECHECK_CD`）、`peArchiveGone`（放回草稿并标 archived）。
- **保存：** `savePlanDraft` 在 normalizePlan 之后对有氧项名称和备注去首尾空格。

### 训练算作历史之后的最终行为

- 力量项的历史 = 手填历史点数 + 训练里含这个动作且有组的天数（`liftHistoryCount`）；有氧项的历史 = 含它的天数（`cardioHistoryCount`）；`liftSetCount` = 训练里这个动作的组数之和。三个函数都在纯函数段，只读 state。
- **删除：** 没有历史（也不在 `pe.origIds` 里的新项）直接从草稿移除加「撤销移除」（5000 ms）；有历史只能确认后归档。
- **归档：** 只在计划里打 `archived:true`，**不动 workouts**；归档的项不占 20 个名额、不出现在记录区芯片里，旧训练里仍显示并带「已归档」。
- **彻底删除**（只在「已归档」区）：先确认；力量项在有训练组时写「「{名称}」的 {n} 条力量记录，和训练历史里它的 {m} 组会一起删除。」，没有训练组时是原句；有氧项写「「{名称}」的 {n} 次有氧记录会一起删除。」。保存后计划里没有它，workouts 里它的全部条目一起删。

### planCommit 清理 workouts 的写法

在原来「按 id 差集清理 state」的同一个 commit 里：

```js
// planCommit 里（非 keepOrphans 时），旧计划的 plan.lifts / planCardio(plan) 减去新计划的 id 集合
outWL（离开计划的力量项 id）、outWR（离开计划的有氧项 id）
outWd = woMap(state) 里含这些 id 的日期
commit([...任务/待办/力量键, ...outWd.map(d=>"wo:"+d)], st=>{ ...原清理...; wclean(st) })
// wclean：对每个日期 woPut(st,d,{lifts:过滤掉 wl, cardio:过滤掉 wr})
```

`wclean` 按 id 过滤、重复执行结果相同（commit 的 fn 会在远端合并后重放）；一天的两个数组都空了 `woPut` 整天去掉，删到最后一天时 `workouts` 键也去掉；只有「离开计划」才清，归档不是离开。

### 示例挑选的三段式文字

`pkParts(g,l,c)` 依次拼「{g} 个目标组」「{l} 个力量项」「{c} 个有氧项」，为 0 的部分省略，`、` 连接；`T_PK_PICKED` / `T_PK_DONE` / `T_PK_DRAFTED` / `T_PK_LIVE` 都带第三个参数，调用处传 `pkPicked()` 里新增的 `c`（`r:` 键的个数）。`tests/support/strings.ts` 里 `pkPicked`、`pkDone`、`pkDrafted`、`pkLive` 的第三个参数缺省为 0，所以旧的两参数调用不变。

### 改了标题的用例

`tests/cloud/plan-editor-fit.spec.ts` 的 `PLAN-02 lift and weekly fitness values outside the rules block saving with the error next to the field, and the add button stops at 8 lifts (D-15, D-17)` 改为 `… and the add button stops at 20 lifts (D-15, D-17, 15 D-04)`，合成 20 个力量项、计数 `20/20`、`PE_LIMIT_LIFTS` 新值；其余三个旧用例（plan-editor-archive 的恢复上限、plan-onboarding 的名额、plan-normalize 的 PLAN_MAX）标题不变，数据和文案改成 20。

## 本计划新增的用户可见文案（交给 Phase 16 总体验收由所有者过目）

以下全部在 15-UI-SPEC 的 Copywriting Contract 里（S11、S12），应用里是 `T_…` 常量，`tests/support/strings.ts` 的「Phase 15-06」段逐字镜像。

- **编辑页有氧项：** `有氧项`（小标题）、`{n}/20`（计数）、`＋ 添加有氧项`、`最多 20 个`、`每次目标`（.seg 的 aria-label）、`不设目标` / `每次距离` / `每次时长`、`目标距离（公里）`、`目标时长（分钟）`、摘要 `每次 {v} 公里` / `每次 {v} 分钟` / `没有目标`、`删除这个有氧项`、读屏 `已添加：新的有氧项`、错误 `请填写有氧项名称`、`目标要大于 0`。
- **有氧项归档 / 彻底删除：** `归档这个有氧项？`、`「{名称}」有 {n} 次有氧记录。`、`归档后不能再用它记录训练，训练历史里的旧记录照常保留。`、`归档有氧项`、`彻底删除这个有氧项？`、`「{名称}」的 {n} 次有氧记录会一起删除。`、`彻底删除有氧项`；已归档区小标题 `有氧项`、每行 `{n} 次有氧记录`、恢复上限 `有氧项已满（20 个），先删掉一个再恢复`；D-08 复查一行 `有氧项「{名称}」（{n} 次记录）`。
- **力量项改动：** `最多 20 个`、`力量项最多 20 个，请先删掉或归档多余的`、`力量项已满（20 个），先删掉一个再恢复`、新的 `归档后它不再出现在健身页的记录和趋势图里，只在目标页底部的「已归档」里保留历史；训练历史里的旧记录照常保留。`、彻底删除 `「{名称}」的 {n} 条力量记录，和训练历史里它的 {m} 组会一起删除。`（没有训练组时仍是原句）。
- **示例挑选：** 图例 `有氧项` + `共 3 个`、每行说明 `每次 5 公里` / `每次 10 公里` / `每次 30 分钟`、`计划里已有同名有氧项`、`有氧项最多 20 个，还能再加 {k} 个`、`有氧项已满（20 个），先删掉一个再添加`、`力量项最多 20 个，还能再加 {k} 个`、`力量项已满（20 个），先删掉一个再添加`；底部提示 `已选 …、{c} 个有氧项`、toast `已加入 …、{c} 个有氧项，计划已保存`、`已加到草稿：…、{c} 个有氧项，点「保存计划」后生效`、读屏 `已添加到草稿：…、{c} 个有氧项`（为 0 的部分省略）。

### 不在 15-UI-SPEC 里的文案（本计划新增，需要所有者特别过目）

- **`有氧项最多 20 个，请先删掉或归档多余的`**：保存时有氧项超过 20 个（导入或别的设备带来）的错误行，照力量项 `llimit` 的写法补上（计划里的显式假设；UI-SPEC 只写了按钮旁的「最多 20 个」）。
- **`上移有氧项：{名称}`、`下移有氧项：{名称}`**（读屏专用，按钮 aria-label）和已归档区按钮的读屏名 `恢复有氧项：{名称}`、`彻底删除有氧项：{名称}`：UI-SPEC 只写了按钮文字「上移」「下移」「恢复」「彻底删除」，读屏名照力量项的写法补的。

## 定向运行结果

全部通过低优先级、单 worker 的包装运行（`os.setPriority(BELOW_NORMAL)`，本地 `--workers=1`，云端 `npm run test:cloud`），一次只跑一个批次。计划里两个完整套件留给 15-07 最后一个任务。「首次失败」是改测试或应用后重跑到全绿的记录。

| 任务 | 批次 | 结果 |
|------|------|------|
| 1 | 本地：plan-normalize、app-integrity、escaping | 22 通过 |
| 1 | 云端：plan-editor-cardio | 2 通过 |
| 1 | 云端：plan-editor-fit、plan-editor、plan-editor-sync | 24 通过（`REPORT OK expected=24 flaky=0 unexpected=0`）；首次 1 失败：旧用例的 `#pe-h-fit ~ h4.pe-sub .pe-count` 现在匹配两个计数，改 `.first()` |
| 2 | 云端：plan-editor-cardio | 5 通过（`REPORT OK expected=5`）；首次 1 失败：测试里重复点开「已归档」区把它收起了，改成断言保持展开 |
| 2 | 云端：plan-editor-fit、plan-editor-archive | 10 通过（`REPORT OK expected=10`）；首次 1 失败：`readEditor().archived` 多了 `cardio` 键，旧用例的整体 `toEqual` 补 `cardio: []` |
| 2 | 云端：plan-onboarding、plan-archive-view | 24 通过（`REPORT OK expected=24`） |
| 2 | 本地：plan-normalize、tests/e2e/fitness 目录、app-integrity、escaping | 56 通过（`REPORT OK expected=56`） |
| 3 | 本地：plan-normalize、app-integrity、escaping | 22 通过（`REPORT OK expected=22`） |
| 3 | 云端：plan-onboarding | 20 通过（`REPORT OK expected=20`） |
| 3 | 云端：plan-editor-archive | 4 通过（`REPORT OK expected=4`）；首次 1 失败：「清空后从卡片挑示例」用例写死 11 个复选框，改 14 并带上 3 个有氧项 |

- 已知偶发用例 plan-onboarding「while offline the pick button on the empty plan card…」本计划每次都一次通过，没有出现超时。
- Task 1 的两个报告（云端 cardio 批次、本地批次）在我核对前被下一次运行清掉（Playwright 每次运行清空 test-results/），计数取自当时的控制台输出，其余批次都在运行后立刻用 `check-report.mjs` 核对。

## UI-SPEC 的 backstop 项（交给 Phase 16 总体验收，目视核对）

- **375 px 长 toast（E17）：** `已加入 3 个目标组、4 个力量项、3 个有氧项，计划已保存` 和 `已加到草稿：3 个目标组、4 个力量项、3 个有氧项，点「保存计划」后生效`（带撤销按钮的 `已从草稿移除：…` 也一样）要在手机宽度下完整显示、可以换行。本计划没有截图核对。
- **示例挑选对话框 375 px：** 现在最多 7 + 4 + 3 = 14 行加三个图例，列表区只滚动中间部分，最后一行不被底部按钮盖住。现有的 375 px 底部抽屉用例仍通过，但没有专门量最后一行。
- **编辑页有氧项卡 375 px：** 名称很长时卡片头名称单行省略、摘要和上移下移不挤出；每次目标三个按钮（`.seg`）折行；已归档区新一组的说明行 `{n} 次有氧记录`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 旧用例的力量项计数定位器被有氧项计数撞成两个**
- **Found during:** Task 1（plan-editor-fit 批次）
- **Issue:** `plan-editor-fit.spec.ts` 用 `#pe-main #pe-h-fit ~ h4.pe-sub .pe-count` 取力量项计数，健身分区多了有氧项的 `h4.pe-sub` 之后匹配两个元素（strict mode 报错）。
- **Fix:** 加 `.first()`（力量项计数在前）；Task 2 改成 `peCount(20, 20)` 时一并保留。这个文件不在计划 Task 1 的文件清单里，但它在 Task 1 的 verify 批次里。
- **Files modified:** tests/cloud/plan-editor-fit.spec.ts
- **Commit:** 5a741c7

**2. [Rule 1 - Bug] Task 1 的 D-08 复查遇到有氧项会崩**
- **Found during:** Task 1 设计时（`peRemove` 会把新加又删掉的项也记进 `pe.gone`，保存时 `peGoneHit` 走到 `groupProgress(state, r.item)`，有氧项没有 `tasks`）
- **Fix:** Task 1 先加 `if(r.kind==="cardio")return false`（和 `peDelete` 的 `prog=false`），Task 2 换成 `cardioHistoryCount(state,r.id)>0` 并补 `peD8Line`、`peArchiveGone`。
- **Commit:** 5a741c7、f6f3eb3

**3. [Rule 1 - Bug] 两处旧用例写死了数量**
- **Found during:** Task 2、Task 3 的定向批次
- **Issue:** `readEditor().archived` 新增 `cardio` 键后，plan-editor-archive 里整体 `toEqual` 的那条用例要补 `cardio: []`；plan-editor-archive 的「清空后从卡片挑示例」用例（计划和 PATTERNS 的清单都没列）写死 11 个复选框和 `pkPicked(7, 4)`。
- **Fix:** 补 `cardio: []`；改成 14 个复选框、`pkPicked(7, 4, 3)`、`pkDone(7, 4, 3)`，并断言保存后有 3 个新的 r- 有氧项。
- **Commit:** f6f3eb3、0ca0664

### 与计划文字不同的地方（不是缺陷）

- **用例数：** 计划写 plan-editor-cardio 有 4 条云端用例，实际 5 条（多了「恢复在 20 个未归档时 disabled」）；plan-onboarding 多了一条 `PLAN-07 the picker stops at the cardio limit and says how many more fit, archived cardio items not counting (D-04, S12)`（计划里「19 个未归档有氧项时 #pk-lim-r 为 pkLimR(1)」的部分单独成一条，更清楚）。
- **strings.ts 镜像：** `peCardioSum` 写成 `(kind, v?)`（计划的示例写法 `peCardioSum('每次 5 公里')` 只是简写）；`pkCardioTarget(s)` 直接返回传入的说明。
- **D-08 的有氧项用例** 并进了 Task 2 的力量项训练用例的第二轮（同一次保存里既彻底删除力量项又复查有氧项），没有单独成条。

## 已知问题和遗留

- 本计划只做定向运行；两个完整套件（`npm test`、`npm run test:cloud`）和恶意计划夹具（有氧项名称进 escaping）留给 15-07。
- 375 px 下的 toast、示例对话框最后一行、有氧项卡的版面没有截图核对，列在上面的 backstop 里。
- 只含计划的导入替换计划时不清理 workouts 里已不在计划的条目（计划里的显式假设，与 Phase 11 对 state.lifts 的处理一致）；这些条目在界面上显示「已删除的力量项 / 有氧项」。

## Known Stubs

None。扫描过本计划新增的应用和测试代码，没有空值硬编码流向界面、占位文字或 TODO / FIXME。

## Threat Flags

None。本计划新增的安全相关面都在计划的 threat_model 里：T-15-20（有氧项名称、备注、id 全部经 `esc()`，SEC-01 源码门槛在 Task 1、Task 3 的 verify 里通过）、T-15-21（planCommit 只清离开计划的 id，经 `wo:<日期>` 键，用例证明归档不清、彻底删除才清）、T-15-22（有训练的项只能先归档再彻底删除，D-08 复查覆盖有氧项）、T-15-23（力量项和有氧项各 20 个上限，按钮禁用加 llimit / climit）。

## Self-Check: PASSED

- 新增 / 改动的文件都存在：tests/cloud/plan-editor-cardio.spec.ts、us-journey-tracker.html、tests/support/plan-picker.ts、tests/support/plan-editor.ts。
- 三个任务提交都在当前 HEAD 的祖先里：5a741c7（Task 1）、f6f3eb3（Task 2）、0ca0664（Task 3）。
- 应用文件无 CR、`style="` 计数 0、纯函数段五个标记各恰好一次、`APP_SHA256` 已按 LF 字节重新记录（SAFE-02 通过）。

