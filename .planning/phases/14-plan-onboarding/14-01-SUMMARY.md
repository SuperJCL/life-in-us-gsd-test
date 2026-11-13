---
phase: 14-plan-onboarding
plan: 01
subsystem: plan-onboarding
tags: [empty-plan, sample-picker, planCommit, dialog, playwright-cloud]

requires:
  - phase: 12-plan-editor
    provides: savePlanDraft 的写入步骤、confirmBox、peBlock、keepConflict 留底、编辑计划页
  - phase: 13-pwa-offline
    provides: 云端同步骨架（reconcileOnce、requestSync、缓存）
provides:
  - 云端新账号首次登录建出空计划（emptyPlan），已有计划的账号登录时不写计划文档
  - planCommit / planSavedToast：编辑页「保存计划」和卡片「添加并保存」共用的唯一写入核心
  - dialog#sample 卡片模式：从示例里挑目标组（整组）和力量项（逐个），勾选后直接保存，新 id（g-/t-/l-）
  - 空计划卡片的两个入口「自己建一份」（主）和「从示例里挑」
  - pickSample、planUsedIds、emptyPlan 三个纯函数及单元用例
affects: [14-02 卡片模式的断网/过期/冲突/容量, 14-03 编辑页「从示例添加」和同名标记, Phase 16 总体验收]

actuals:
  tokens: 13000
  tasks: 3
  commits: 3

plan_head_before: 784c9e1feb46a2c1194f5a407b869b377d0da774
plan_head_after: 86e92afe25718d5bfc91b15a3fc80513650d3d04

tech-stack:
  added: []
  patterns:
    - "写入核心提炼：savePlanDraft 的写入步骤原样搬进 planCommit(np,overwrite)，调用方只管窗口、忙碌状态和 toast；两个入口之外没有第二条保存路径"
    - "卡片模式不造 pe 草稿：对话框自己的状态 pk，避免 isBusy 恒真、beforeunload 拦截、closePlanEditor 切标签"
    - "示例 id 只当复选框的 data-pk 键，从不写进计划；写进计划的项一律由 pickSample 换新 id"

key-files:
  created:
    - tests/cloud/plan-onboarding.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/cloud/login.spec.ts
    - tests/cloud/plan-editor-archive.spec.ts
    - tests/cloud/import.spec.ts
    - tests/cloud/import-sync.spec.ts
    - tests/cloud/import-undo.spec.ts
    - tests/e2e/data/plan-normalize.spec.ts

key-decisions:
  - "选 PATTERNS 路线 2：提炼 planCommit，不给卡片模式临时造 pe 草稿"
  - "pkSave 在并入挂起的远端版本之后，以最新的 plan 为基准往末尾追加（只追加，别的设备的修改不会丢）；冲突三选一由 14-02 插在并入之后"
  - "首次建档只在「没有服务器文档且没有缓存」时用 emptyPlan；有缓存走缓存，撞唯一索引重读服务器，syncOnce 的 make 不动"

requirements-completed: [PLAN-06, PLAN-07]

coverage:
  - id: D1
    description: "新账号首次登录建出空计划（groups、lifts 为 []，5 个类别快捷词为 []，fitGoal [2,4]，保留示例的健身说明），目标页显示「计划是空的」卡片和两个入口"
    requirement: "PLAN-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#PLAN-01 a first sign-in creates the state document and an empty plan document that keeps the weekly fitness goal and note (D-01)"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-06 emptyPlan has no groups, lifts or base tags and keeps the weekly fitness goal and note (D-01, D-02, D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "已有计划文档的账号登录时计划逐字不变且不写计划文档；文档缺失而本机有缓存时按缓存重建"
    requirement: "PLAN-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-06 an account that already has a plan document keeps it unchanged at sign-in and no plan is written (D-01)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-06 a missing plan document is recreated from this device's cached plan, not from the empty plan (D-01)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts（撞唯一索引重读，原有用例，16 条一起通过）"
        status: pass
    human_judgment: false
  - id: D3
    description: "从空计划卡片挑示例：对话框默认一项不勾、确认不可用；勾选后直接保存到服务器，新 id，不带快捷词，目标页立刻显示，焦点回 #planEditBtn"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 a new account picks one sample group and one lift from the empty plan card and they are saved with new ids and shown on the goals page (D-01, D-07, D-08)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor-archive.spec.ts#PLAN-02 an emptied plan shows the empty plan card with its two entries and the week hint, and sample groups and lifts picked from the card are saved with new ids (D-16, D-04, D-08)"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-07 pickSample copies only the chosen sample groups and lifts in sample order with new ids and no tags (D-05, D-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "planCommit 提炼后编辑页保存行为不变（覆盖留底、容量超限、读不出来留底、D-08 复查）"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts、tests/cloud/plan-editor.spec.ts（共 29 条，Task 1 定向运行全部通过）"
        status: pass
    human_judgment: false
  - id: D5
    description: "空计划下本周和日历的「记一笔」照常记录、记一笔类别下没有基础快捷词、记录上传到服务器并出现在时间线"
    requirement: "PLAN-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-06 with the empty plan the composer has no base tags and entries recorded in the week and calendar views reach the timeline and the server (D-01, D-02)"
        status: pass
    human_judgment: false
  - id: D6
    description: "新文案和视觉（空计划卡片两个按钮、对话框标题和说明、两句 toast、本周页提示、375 px 底部面板、深浅色选中态、手机宽度长 toast）的观感"
    verification: []
    human_judgment: true
    rationale: "所有者决定本阶段不做人工验收；视觉和文案观感没有自动用例判断，交给 Phase 16 总体验收"

duration: 约 100 min（执行器未在开始时记录起点，按提交时间估算）
completed: 2026-11-13
status: complete
---

# Phase 14 Plan 01: 新账号的空计划起步和从示例里挑 Summary

**云端新账号第一次登录建出空计划，空计划卡片的「从示例里挑」打开对话框，勾选后经共用写入核心 planCommit 直接保存，新增的组、任务、力量项一律换成全新的 g-/t-/l- id，不带任何快捷词；编辑页保存也改走同一个 planCommit，行为不变。**

## Performance

- **Duration:** 约 100 min（估算，开始时没有记录起点）
- **Tasks:** 3/3
- **Commits:** 3（用 `plan_head_before..HEAD` 实测，不是叙述）
- **Files:** 应用 1 个、测试和支撑文件 9 个（含新建 1 个）

## Accomplishments

- **D-01 空计划建档：** `resolve()` 的 mk 调用把计划默认值换成 `emptyPlan()`（纯函数段，示例计划深拷贝后 groups、lifts 清空，presets 换成 `{}` 由 normalizePlan 补成 5 个空数组，保留 fitGoal [2,4] 和示例的 fitNote）。有缓存走缓存、撞唯一索引重读服务器、syncOnce 的 make、脚本求值和退出登录时的示例计划都没动（SEC-04：本地版仍显示 7 个组、4 个力量项，GOAL-01 七个组用例通过）。
- **planCommit 签名与返回值：** `planCommit(np, overwrite)` 返回 `{ok:false, why:"toolarge"}`（容量超限，已调用 `showTooLarge()`，什么都没写）、`{ok:false, why:"nokeep"}`（计划读不出来又没留住底，已弹 `T_PE_UNREAD_NOKEEP`，什么都没写）或 `{ok:true, unread, kept}`。`planSavedToast(r, overwrite, msg, ms)` 负责成功后的三种 toast（读不出来被替换、覆盖了别的设备的版本、普通成功）。
- **savePlanDraft 改动前后对照：** 改前，容量检查、读不出来留底、覆盖留底、id 差集、`usePlan`、脏标记和缓存、`requestSync` 全写在函数体里，随后 `closePlanEditor("goal")` 再弹 toast。改后，这一段原样（顺序不变）搬进 planCommit；savePlanDraft 只剩：校验、并入远端版本、三选一、D-08 复查、normalizePlan 和去空格，然后 `planCommit` → 按返回值清 `s.tooLarge`/记 `s.tooLarge=true`/`back()` → `closePlanEditor("goal")` → `planSavedToast(r,overwrite,T_PE_SAVED,3000)`。用户看到的顺序和提示与改前一致；savePlanDraft 和 pkSave 的函数体里都不再有 `usePlan(`（验证脚本检查）。编辑页的 29 条 PLAN-04 回归用例全部通过。
- **dialog#sample（卡片模式）：** 静态外壳加 `openSamplePicker("card")`、`pkRender`、`pkPicked`、`pkHint`、`pkBusy`、`pkSave`；两块列表（目标组整组挑、力量项逐个挑，每次打开都重新生成、一项都不勾），确认按钮 `aria-disabled` 在没勾时不可用；保存中 Esc 和点背景被忽略；挑选期间远端更新挂起（`isBusy` 含 `pkDlg.open`），退出登录时对话框被关掉；成功后 `renderAll()`、对话框关闭、焦点到 `#planEditBtn`、toast `已加入 …，计划已保存`（4000 ms）。CSS 照 UI-SPEC 骨架，`dialog#sample::backdrop` 并进现有遮罩选择器，应用里 `style="` 计数仍为 0。
- **D-04：** 编辑页的「载入示例计划」按钮、点击分支、整份载入函数和它的 toast 常量已删除（编辑页的「从示例添加」在 14-03 用 pickSample 重做）；本周页空计划提示改为「…可以在「目标」页建一份计划，或从示例里挑。」。
- **D-01 波及的旧用例：** login.spec 的 PLAN-01 改写成断言空计划；plan-editor-archive.spec 的 PLAN-02 改写成「空计划卡片两个入口 + 从卡片挑全部 11 项并保存」；import.spec 的 12 个首台设备 `app.open` 显式放示例计划文档。

## Task Commits

1. **Task 1（tracer）** — `e3345a0` feat(14-01): empty plan on first sign-in and pick-from-sample dialog with direct save
2. **Task 2** — `060fc8c` refactor(14-01): remove whole-sample loader from the plan editor and fix first-sign-in specs for the empty plan
3. **Task 3** — `86e92af` test(14-01): PLAN-06 first-sign-in cases and emptyPlan/pickSample unit cases

tracer 反馈门（`⚡ Tracer verified end-to-end — expanding`）：tracer 用例、改写后的 PLAN-01 和 5 条编辑页回归用例定向运行 REPORT OK 后才进入 Task 2。

## 两个套件的定向运行结果（低优先级、1 个 worker、不并发；完整套件在 14-03 Task 3 跑，本计划不声称全绿）

| 运行 | 范围 | 结果 |
|------|------|------|
| Task 1 cloud | plan-onboarding、login、plan-editor-sync、plan-editor | 30 条，REPORT OK |
| Task 1 默认 | app-integrity（SAFE-02）、escaping（SEC-01 源码门槛）、e2e/goals | 29 条，REPORT OK |
| Task 2 cloud（最终） | plan-editor-archive、import、import-undo、import-sync、migration、export、account-data、remote-update、plan-onboarding | 60 条，REPORT OK（含 Task 3 的三条 PLAN-06 cloud 用例） |
| Task 2 默认 | app-integrity、e2e/week | 33 条，REPORT OK |
| Task 3 cloud | plan-onboarding、reconcile-gate | 16 条，REPORT OK |
| Task 3 默认 | plan-normalize | 7 条，REPORT OK |

Task 2 第一次定向运行有 8 条失败（见下面的偏差 2），修好后重跑 import-undo、import-sync 共 17 条通过，再重跑完整的 9 个 spec 得到上表的 60 条。运行结束后没有遗留的 playwright 浏览器进程。

## Task 2 实际改过的 cloud spec 清单

- 规划清单内：`plan-editor-archive.spec.ts`（PLAN-02 改写）、`import.spec.ts`（12 个首台设备 open 加 `plan: SEED_PLAN`；第二台设备的 open 不加）。
- **规划清单之外新发现的：** `import-sync.spec.ts`（`openManual` 辅助函数默认放示例计划，另有 IN-05 用例的 open）、`import-undo.spec.ts`（4 个用例的首台设备 open：udl、udm、udr、udw 的「撤销恢复了等待中的远端改动」那一条）。它们都用 `P2-1` 之类的旧格式备份，D-01 之后账号没有示例计划，导入时这些进度被当成孤儿丢掉。
- 只运行、没有改动并通过：`migration.spec.ts`、`export.spec.ts`、`account-data.spec.ts`、`remote-update.spec.ts`（SYNC-02 用例经 `syntheticPlan` 放置了带一个力量项的计划，不受影响，与计划预期一致）、`reconcile-gate.spec.ts`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tracer 用例里「没有计划写入」的基准写错**
- **Found during:** Task 1
- **Issue:** 用例断言点击前后 `journey_docs:plan` 写入条数为 0，但首次登录建空计划文档本身就是一次写入（`writes` 只排除种子），所以条数是 1。
- **Fix:** 改成和点击前的条数比较（点击没勾选的确认按钮后条数不变）。
- **Files modified:** tests/cloud/plan-onboarding.spec.ts
- **Commit:** e3345a0

**2. [Rule 3 - Blocking] import-sync.spec 和 import-undo.spec 也依赖首登示例计划**
- **Found during:** Task 2 定向运行（8 条失败：import-sync 4 条、import-undo 4 条，原因是 P2-1 进度被丢）
- **Issue:** 计划预期这两个 spec 风险低、不改，实际它们的旧备份用例带 `P2-1`，需要账号已有示例计划。
- **Fix:** 按计划第 5 步的同一规则，给需要示例计划的首台设备 open 加 `plan: SEED_PLAN`（文件里照 login.spec 生成 SEED_PLAN，注释写明代表 Phase 14 之前建的账号）。没有改任何断言。
- **Files modified:** tests/cloud/import-sync.spec.ts、tests/cloud/import-undo.spec.ts
- **Commit:** 060fc8c

**3. [说明，非缺陷] pkSave 的基准计划**
- 计划写「用 pk.base 的深拷贝接新项」。实现里 pkSave 先并入挂起的远端版本，再把 `pk.base` 重置为并入之后最新的 `plan` 的深拷贝，然后追加。这样只往末尾追加，别的设备的修改不会丢；`pk.base` 打开时的快照和 `pk.orig` 留给 14-02 的冲突三选一比较。

### 流程说明

- **TDD 与提交粒度：** 三个任务都标了 `tdd="true"`，但计划是 `type: execute`，且每个任务的 verify 把应用和测试放进同一个提交，所以每个任务一次提交，没有拆成 `test(...)` → `feat(...)` 两次，也没有单独的 RED 运行（为了少占本机资源）。新用例都是在实现之后第一次运行，通过前只发生过上面偏差 1 一次失败。
- **规模：** 计划的估算 120k 超过 100k 的建议线。保留为一个计划的理由：D-01 一落地，login、plan-editor-archive、import 三个 spec 立刻失败，必须在同一个计划里改好并跑绿，不把已知失败留给下一个计划（实际又多出 import-sync、import-undo 两个）。实际 diff 按 chars/4 约 13k tokens，估算偏高。
- **成功标准 1 的口径：** 「四个视图在空计划下都能正常记一笔」在有「记一笔」的地方验证——本周和日历两个 composer，时间线只用来读回结果（记录出现在时间线并上传到服务器）；目标页没有「记一笔」。
- **APP_SHA256 的算法：** 沿用现有约定，对工作副本的字节取 sha256（本机工作副本是 CRLF，提交进仓库的是 LF）；每次改应用都在同一次提交里重新记录。
- **不在本计划做的：** `.planning/REQUIREMENTS.md` 里的 PLAN-06、PLAN-07 没有勾选（14-03 也声明了这两条，等 14-03 完成再标）。

**Total deviations:** 2 auto-fixed（1 个测试写法错误，1 个被 D-01 波及的 spec），1 条实现说明，0 条架构变更。**Impact:** 无范围蔓延，只多改了两个 spec 的 open 调用。

## Known Stubs

无。`#planSampleWhy` 始终为空是计划内的占位（断网、过期说明在 14-02 填），`pkHint` 目前只有「没勾」「已勾」两档（断网、过期、容量三档在 14-02），`pkRender` 里同名标记和名额限制的位置已留好（14-03）。这三处都不影响本计划目标，已写进 14-02、14-03 的计划。

## Threat Flags

无新的对外面：对话框只读示例常量，写入走现有 planCommit 和现有同步通道；没有新的网络端点、认证路径或文件访问。T-14-01 到 T-14-05 的缓解由上面的用例证明（已有计划写入为 0、缺文档按缓存重建、示例文字全经 `esc()` 且 SEC-01 门槛通过、新 id 不复用示例 id 且不带快捷词、planCommit 回归用例）。

## 交给 Phase 16 总体验收的新文案和视觉（所有者决定本阶段不做人工验收）

- 空计划卡片：主按钮「自己建一份」、次按钮「从示例里挑」，正文「目标页还没有目标组和力量项。你可以自己建一份，也可以从示例里挑需要的，没挑的不会加进来。」
- 对话框（卡片模式）：标题「从示例里挑」；说明「示例是一份通用的样本计划。勾选要用的，点「添加并保存」就加进你的计划；没勾的不会加。」；分区「目标组 共 7 个」「力量项 共 4 个」；行说明「{n} 项任务」「目标 {target} {unit}」；提示行「先勾选要加入的项」「已选 {g} 个目标组、{l} 个力量项」；按钮「先不添加」「添加并保存」（保存中「保存中…」）。
- toast：「已加入 {g} 个目标组、{l} 个力量项，计划已保存」（4000 ms，为 0 的部分省略）。
- 本周页空计划提示：「当前计划是空的，这里只统计你记下的内容。可以在「目标」页建一份计划，或从示例里挑。」
- UI-SPEC 的 backstop 项（没有自动用例，请在 Phase 16 手工看）：375 px 宽度下的底部面板外观、深浅色下的选中态、手机宽度下长 toast 的显示。

## Self-Check: PASSED

- 创建的文件存在：`tests/cloud/plan-onboarding.spec.ts`、`.planning/phases/14-plan-onboarding/14-01-SUMMARY.md`。
- 三个提交都在 HEAD 的祖先里：`e3345a0`、`060fc8c`、`86e92af`。
- 三个任务的验收脚本（函数存在、`style="` 为 0、纯函数段五个标记各一次、APP_SHA256 与文件一致、REPORT OK）和三次暂存后的隐私检查（「隐私检查通过」）都已通过。
