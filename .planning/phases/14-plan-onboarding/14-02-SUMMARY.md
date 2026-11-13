---
phase: 14-plan-onboarding
plan: 02
subsystem: plan-onboarding
tags: [sample-picker, offline-gate, conflict-three-way, planCommit, playwright-cloud]

requires:
  - phase: 14-plan-onboarding
    provides: planCommit / planSavedToast、dialog#sample 卡片模式、pkSave、#planSampleWhy 占位
  - phase: 12-plan-editor
    provides: peBlock、confirmBox 三选一、T_PE_HINT_*、keepConflict 留底
provides:
  - 断网、连不上服务器、登录过期时空计划卡片的「从示例里挑」变灰（aria-disabled）加说明，点它只弹同一句 toast
  - 挑选对话框的提示行三档（过期、断网、容量）和被挡住的「添加并保存」
  - pkSave 的冲突三选一（挑选版措辞）：回去继续挑 / 放弃我的选择，用新版 / 用我的覆盖（对方的版本在本机留底）
  - tests/support/plan-picker.ts（openPicker、pick、readPicker、readCardEntry）
affects: [14-03 编辑页「从示例添加」, Phase 16 总体验收]

actuals:
  tokens: 14000
  tasks: 3
  commits: 3

plan_head_before: cfd65427f5dc6f3888d3c48b842b39d2a74e7d42
plan_head_after: 020fd81c5046b1a4d952deec7e2f2d11d0c73e2b

tech-stack:
  added: []
  patterns:
    - "状态行一变就重算：setStatus（和 setGate、空计划卡片渲染）末尾调用 pkWhy()，pk 存在时调用 pkHint()，不依赖整页重画"
    - "卡片模式的覆盖以打开对话框时看到的计划（pk.base）为底追加，不叠加到对方的新版；被盖掉的版本由 planCommit 在写入前留底"

key-files:
  created:
    - tests/support/plan-picker.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/cloud/plan-onboarding.spec.ts

key-decisions:
  - "冲突三选一里，pk.base 保持为打开对话框时看到的计划，不再像 14-01 那样在保存时重置为并入后的计划；新 id 的占用集合取 base 和当前计划的并集"
  - "放弃新版和覆盖两个出口都先并入挂起的远端版本，再各自处理（放弃：renderAll 后关闭；覆盖：并入后交给 planCommit 留底）"

requirements-completed: []

coverage:
  - id: D1
    description: "断网、连不上服务器时空计划卡片的「从示例里挑」aria-disabled 加说明，点击只弹 toast；挑选对话框开着时断网，提示行和确认按钮被挡住，恢复后保存成功"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 while offline the pick button on the empty plan card is greyed with the reason and the picker refuses to save until the connection is back (D-07, 12 D-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "挑选期间别的设备保存了计划：保存时三选一，回去继续挑保留勾选且不写，用我的覆盖以打开时的计划为底并在本机留底，放弃我的选择改用新版且本页不写"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 a plan saved on another device while picking asks on save, going back keeps the picks and overwriting keeps the other version here (D-07)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 taking the other device's new plan while picking adds nothing and shows that plan (D-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "超过容量上限的挑选不保存，对话框留着并显示容量提示和横幅，关闭后横幅收起"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 picks that would push the plan over the cloud limit are not saved and the picker says so (D-07, 12 D-17)"
        status: pass
    human_judgment: false
  - id: D4
    description: "登录过期时卡片按钮和开着的对话框都挡住；启动对账门控时按钮是真 disabled 且没有说明行；别的标签页退出时对话框被关闭"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 with an expired login the empty plan card and the open picker refuse to save and say why (D-07, 12 D-12)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 while the startup reconcile runs the pick button is disabled by the edit gate without a reason line (S1)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 signing out in another tab while the picker is open closes it (S1, D-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "新文案（两句不可用原因、冲突框四行和两个按钮、放弃新版的 toast）和变灰、说明行的视觉观感"
    verification: []
    human_judgment: true
    rationale: "所有者决定本阶段不做人工验收；文案和视觉观感没有自动用例判断，交给 Phase 16 总体验收"

duration: 约 14 min（开始 2026-11-13T05:56Z，结束 06:10Z）
completed: 2026-11-13
status: complete
---

# Phase 14 Plan 02: 卡片模式的断网、过期、冲突和容量 Summary

**空计划卡片「从示例里挑」的直接保存套用了编辑页保存的全部规则：断网或登录过期时变灰加说明且保存被挡住，挑选期间别的设备改了计划时先三选一，覆盖时对方那一版在本机留底，超过容量上限时不写、对话框不关。**

## Performance

- **Duration:** 约 14 min
- **Tasks:** 3/3
- **Commits:** 3（用 `plan_head_before..HEAD` 实测）
- **Files:** 应用 1 个、测试和支撑文件 4 个（含新建 plan-picker.ts）

## Accomplishments

- **断网和过期（Task 1，tracer）：** 新增 `pkWhy()`，根据 `peBlock()` 给 `#planSampleBtn` 设 `aria-disabled="true"`（不用 disabled，留在 Tab 顺序里）并在 `#planSampleWhy` 写原因（过期优先于断网）。`body[data-gate]` 存在时清说明、去掉 aria-disabled（真 disabled 由 applyGate 设，原因在顶部横幅）。挂钩在 `setStatus` 末尾（`pkWhy()`，pk 存在时再 `pkHint()`）、`setGate` 末尾、空计划卡片渲染末尾；`peBlock` 非空时点卡片按钮只弹同一句 toast（3000 ms），`openSamplePicker("card")` 开头同样防御。
- **pkHint 三档：** 过期 > 断网（逐字复用 12 的 `T_PE_HINT_*`，`data-tone="warn"`）> 容量（`T_PE_HINT_TOOLARGE`，`error`）> 没勾 > 已选。`#pkOk` 的 aria-disabled = 被挡住或没勾；被挡住时点它只弹同一句 toast，对话框不关、勾选保留。
- **冲突三选一（Task 2）：** `pkSave` 并入挂起远端版本后，`peCanon(plan)!==s.orig` 就 `confirmBox`（标题复用 `T_PE_CF_TITLE`，四行 `T_PK_CF_L1..L4`，取消「回去继续挑」，中间「放弃我的选择，用新版」，确认复用「用我的覆盖」）。出口：回去继续挑（Esc、点遮罩同）→ `pkBusy(false)`、焦点回 `#pkOk`、勾选和 `s.orig` 不变；放弃 → 并入、`renderAll()`、焦点 `#planEditBtn`、关闭对话框、toast 6000 ms、不写；覆盖 → 以 `s.base`（打开时看到的计划）加挑的项构造，`planCommit(np,true)` 先 `keepConflict` 留底，`planSavedToast` 显示「计划已保存，别的设备上的那一版已在本机留底」带「下载留底」（8000 ms），取代成功 toast。每处 await 后核对 `pk` 和 `sessionEpoch`。
- **忙碌状态：** `pkBusy(true)` 在 peBlock 检查之后、并入之前生效并贯穿三选一；14-01 的 cancel 和点背景处理已核对无需改动。
- **Task 3 没有改应用：** 容量、过期、门控、跨标签页退出四条用例对 14-01 和前两个任务的实现一次通过，us-journey-tracker.html 和 constants.ts 没有暂存。

## Task Commits

1. **Task 1（tracer）** — `b0631aa` feat(14-02): grey out the pick button and block saving offline or when expired, picker hint tiers
2. **Task 2** — `4047320` feat(14-02): three-way conflict, kept copy and busy state for saving from the pick dialog
3. **Task 3** — `020fd81` test(14-02): PLAN-07 capacity, expired login, startup gate and other-tab sign-out cases for the pick dialog

tracer 反馈门（`⚡ Tracer verified end-to-end — expanding`）：断网 tracer 用例、14-01 的 tracer 用例、plan-editor-sync 和 offline-sync 两个 spec 共 30 条 REPORT OK 后才进入 Task 2。

## 定向运行结果（低优先级、1 个 worker、不并发；完整套件在 14-03 Task 3 跑，本计划不声称全绿）

| 运行 | 范围 | 结果 |
|------|------|------|
| Task 1 cloud | plan-onboarding、plan-editor-sync、offline-sync | 30 条，REPORT OK |
| Task 1 默认 | app-integrity、escaping、e2e/goals | 29 条，REPORT OK |
| Task 2 cloud | plan-onboarding、plan-editor-sync、conflict-snapshot | 26 条，REPORT OK |
| Task 2 默认 | app-integrity（SAFE-02） | 7 条，REPORT OK |
| Task 3 cloud | plan-onboarding、capacity、reconcile-gate、logout | 39 条，REPORT OK |

运行结束后没有遗留的 playwright 浏览器进程（机器上剩下的 msedge.exe 是所有者自己的 Edge 默认配置进程，没有动）。

## 实际做法的说明

- **对话框开着时让状态行断网：** 60 秒轮询确实在对话框开着时运行（pollTick 不看「忙」）。用例在 `page.clock.runFor(60_000)` 之前对列表读取加拒绝故障并 `context.setOffline(true)`，被拒后状态行进入 `offline`，没有改用 offline-sync.spec 里的触发方式。
- **覆盖的基准：** 14-01 的 pkSave 在并入后把 `s.base` 重置为最新计划；14-02 起 `s.base` 保持为打开时的计划（计划原文「不做 A9 里叠加到新版的做法」），用 `peCanon` 比较时内容相同不算改过，所以无冲突路径的结果不变。
- **挑选版的另一处注意：** 新 id 避开 `s.base` 和当前计划两份里已有的 id，防止覆盖时和对方的新增项撞 id。

## Deviations from Plan

None - plan executed exactly as written。

## 流程说明

- **TDD 与提交粒度：** 三个任务标了 `tdd="true"` 但计划是 `type: execute`，且每个任务的 verify 把应用和测试放进同一个提交，所以每个任务一次提交，没有拆成 test → feat 两次，也没有单独的 RED 运行（为了少占本机资源）。新用例都是在实现之后第一次运行，七条用例都一次通过。
- **APP_SHA256：** Task 1、Task 2 各重新记录一次（沿用工作副本字节的 sha256 约定）；Task 3 没有改应用。
- **不在本计划做的：** `.planning/REQUIREMENTS.md` 里的 PLAN-06、PLAN-07 没有勾选（14-03 也声明了这两条，等 14-03 完成再标）。

## Known Stubs

无。`pkRender` 里同名标记和名额限制的位置仍留给 14-03（`readPicker` 已预留 `dup`、`limG`、`limL` 字段，目前没有对应界面，返回空数组和 null）；不影响本计划目标。

## Threat Flags

无新的对外面：只新增本机界面状态和对现有 planCommit 的调用，没有新的网络端点、认证路径或文件访问。T-14-07 到 T-14-10 的缓解由用例证明（两条冲突用例证明三个出口且覆盖留底；断网和过期用例检查没有计划写入；容量用例检查不写；跨标签页退出用例检查对话框关闭）。

## 交给 Phase 16 总体验收的新文案和视觉（所有者决定本阶段不做人工验收）

- 卡片按钮不可用的两句原因：「联网后才能从示例里挑」「登录已过期，重新登录后才能从示例里挑」（显示在「从示例里挑」下方，点按钮弹同一句 toast，3000 ms）。
- 对话框里被挡住时的提示行：「登录已过期，重新登录后再保存」「联网后再保存」（沿用编辑页的原句）。
- 冲突框：标题「计划在别的设备上改过了」；四行「你挑选示例的这段时间里，别的设备保存了新的计划。」「用我的覆盖：把你挑的项加进你看到的这份计划再保存；别的设备上的那一版会在本机留一份，可以下载。」「放弃我的选择，用新版：不加你挑的项，改用别的设备上的新计划。」「回去继续挑：回到挑选列表，什么都不变。」；按钮「回去继续挑」「放弃我的选择，用新版」「用我的覆盖」。
- 放弃新版的 toast：「已改用别的设备上的新计划，你挑的项没有加」（6000 ms）。
- 视觉 backstop（没有自动用例）：说明行的小圆点和灰显、375 px 下冲突框三个按钮的排布。

## Self-Check: PASSED

- 创建的文件存在：`tests/support/plan-picker.ts`、`.planning/phases/14-plan-onboarding/14-02-SUMMARY.md`。
- 三个提交都在 HEAD 的祖先里：`b0631aa`、`4047320`、`020fd81`。
- 三个任务的验收脚本（函数和文案存在、五个纯函数段标记各一次、`style="` 为 0、APP_SHA256 与文件一致、REPORT OK）和三次暂存后的隐私检查（「隐私检查通过」）都已通过。
