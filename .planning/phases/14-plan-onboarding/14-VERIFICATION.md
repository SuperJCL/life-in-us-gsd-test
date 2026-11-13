---
phase: 14-plan-onboarding
verified: 2026-11-13T07:45:00Z
status: passed
score: 4/4 roadmap success criteria verified on their automated parts; 3 UI-SPEC backstop truths deferred to Phase 16 (human_needed)
covered_files:
  - .planning/phases/14-plan-onboarding/14-01-PLAN.md
  - .planning/phases/14-plan-onboarding/14-01-SUMMARY.md
  - .planning/phases/14-plan-onboarding/14-02-PLAN.md
  - .planning/phases/14-plan-onboarding/14-02-SUMMARY.md
  - .planning/phases/14-plan-onboarding/14-03-PLAN.md
  - .planning/phases/14-plan-onboarding/14-03-SUMMARY.md
  - tests/README.md
  - tests/cloud/plan-onboarding.spec.ts
  - tests/e2e/data/plan-normalize.spec.ts
  - tests/support/constants.ts
  - tests/support/plan-picker.ts
  - tests/support/strings.ts
  - us-journey-tracker.html
covered_digest: "v4:sha256:e669662e32db6048dd32e2f4b99f0d360d10788e0f667be27d9032f6dc7a12d6"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "375 px 底部面板：打开「从示例里挑」，11 行加两个图例时列表可滚动，最后一行不被底部按钮盖住，底部按钮在 iOS 安全区之上"
    expected: "面板贴底，列表在固定的页眉和页脚之间滚动，到底后最后一行完整可见，按钮不压在 Home 指示条上"
    why_human: "env(safe-area-inset-bottom) 在桌面 Chromium 里恒为 0，自动用例只证明了尺寸（贴底、可滚动、按钮 ≥44 px、等宽、最后一行在页脚之上），看不到真机安全区（UI-SPEC backstop，所有者已决定推迟到 Phase 16 总体验收）"
  - test: "浅色和深色主题下，选中行（--s 底加 --ink 文字）、复选框对勾、焦点环是否清楚，类别色没有被当文字底"
    expected: "两种主题下选中态和焦点环都一眼能看清，文字对比度足够"
    why_human: "颜色对比和观感无法用 DOM 断言证明（UI-SPEC backstop，推迟到 Phase 16）"
  - test: "手机宽度下的长 toast：「已加到草稿：3 个目标组、2 个力量项，点「保存计划」后生效」和「已加入 …，计划已保存」"
    expected: "完整显示、能自然换行、不被截断或压出屏幕（UI-SPEC backstop，推迟到 Phase 16）"
    why_human: "视觉换行和遮挡需要真实窄屏截图"
  - test: "本阶段全部新文案的观感通读（空计划卡片正文和两个按钮、两句不可用原因、对话框两种标题和说明、「添加并保存」「添加所选项」「先不添加」、同名和名额提示、冲突框四行和三个按钮、四句 toast、编辑页入口说明、本周页空计划提示、T_PK_INVALID「这次没能加进计划，请关掉后重新打开再试」），含深色主题整体清晰度"
    expected: "措辞自然、没有歧义、与产品其他文案风格一致"
    why_human: "文案质量是主观判断；自动用例只逐字比对常量是否一致（所有者 2026-11-12 决定不做阶段验收，统一在 Phase 16）"
---

# Phase 14: 新账号的计划起步（Plan Onboarding）验证报告

**Phase Goal:** 朋友的新账号第一次登录时，目标页是空计划和两个入口（自己建一份、从示例里挑），而不是一整份示例计划；从示例里挑时，只把勾选的目标组和力量项放进自己的计划。已有计划的账号和不配服务器的本地路径都不受影响。
**Verified:** 2026-11-13
**Status:** human_needed（除已推迟的人工视觉检查外，其余全部通过，没有缺口）
**Re-verification:** No，首次验证

## 结论（给编排者）

**passed except deferred human checks。** 代码层面没有发现任何缺口、桩或未接上的链路。唯一未闭合的是 UI-SPEC 的三条 `backstop` 视觉项加文案通读，它们是所有者 2026-11-12 明确推迟到 Phase 16 总体验收的，按规则列为 human_needed，没有标成通过。

## 对抗式核查说明

我没有信任 SUMMARY，直接读了应用源码，并对照 JSON 报告核对用例是否真的存在、通过。关键证据：

- `us-journey-tracker.html` 的 sha256 是 `bea05849…`，与 `tests/support/constants.ts` 的 `APP_SHA256` 一致；85fb682 之后的 HEAD（e5b8f0c）没有再改应用，所以回归报告对应当前版本。
- 回归报告 `p14-reg/cloud.json` stats：expected 266、unexpected 0、flaky 0、skipped 0；`default.json`：expected 199、unexpected 0、flaky 0、skipped 0。逐条读了 spec 标题和状态，共 266 条和 199 条全部 `expected`（通过）。没有重跑套件。
- 5 个纯函数段标记各恰好出现 1 次；`style="` 在应用里 0 次；`TBD/FIXME/XXX` 在本阶段改动范围内 0 次；本阶段 spec 里没有 skip、fixme、only。

## 观察到的真相（Observable Truths）

| # | 真相 | 状态 | 证据 |
|---|------|------|------|
| SC1 | 新账号首登：服务器建空计划（无组、无力量项、无基础快捷词，fitGoal 保留 [2,4]），目标页显示空计划卡片和两个入口，空计划下能记一笔 | VERIFIED | `emptyPlan()`（html:907）深拷贝示例后 `groups=[]`、`lifts=[]`、`presets={}` 再 `normalizePlan`，保留 fitGoal 与 fitNote；`resolve()` 里 `c?c.data:kind==="plan"?emptyPlan():normalize({})`（html:1285），旧表达式 `normalizePlan(DEFAULT_PLAN)` 计数 0。`renderGoals` 空分支（html:2242）渲染 `#planEditBtn2`（T_PE_BTN2「自己建一份」，primary）和 `#planSampleBtn`（「从示例里挑」）。cloud 报告中通过：PLAN-01 首登建空计划、PLAN-06 空计划下本周和日历记一笔到达时间线和服务器、PLAN-07 tracer |
| SC2a | 已有计划文档的账号登录后计划不变、不写计划文档 | VERIFIED | 只有 `!sv` 才走 `mk`；有缓存时用缓存，撞唯一索引改为重读。cloud 报告通过：PLAN-06 已有计划不变且零计划写入、PLAN-06 缺文档按缓存重建（不是空计划）、reconcile-gate 原有用例 |
| SC2b | 不配服务器的本地路径仍显示示例计划，v1 用例照常通过（SEC-04） | VERIFIED | `usePlan(DEFAULT_PLAN)` 在脚本求值时（html:673）和退出登录时（html:2022）保留；`emptyPlan` 只在云端 `resolve` 里用。默认报告 199 条全过，含 GOAL-01 七个组、PLAN-02 本地版、SAFE-02、SEC-01 全套 |
| SC3a | 「从示例里挑」列出 7 个目标组（带任务数）和 4 个力量项，打开时全不勾，一项没勾时不能确认 | VERIFIED | `pkRender`（html:3065）数据来自 `DEFAULT_PLAN`，每行 `data-pk="g:<id>"`、`T_PK_TASKS`、`T_PK_TARGET`、插值全经 `esc()`；`pkHint`（html:3093）0 项时 `aria-disabled="true"` 加 T_PK_NONE；`#pkOk` 点击在 aria-disabled 时直接返回。cloud 用例：tracer（11 个复选框全未勾、force 点击不保存）、键盘与关闭用例（每次打开全不勾）通过 |
| SC3b | 从空计划卡片挑：确认后直接保存，目标页马上显示，断网或登录过期时不能挑 | VERIFIED | `pkSave`（html:3126）走 `planCommit`，`renderAll()` 后关对话框并 `planSavedToast`；`peBlock()` 在 `pkSave`、点击委托、`openSamplePicker`、`pkWhy`、`pkHint` 五处挡住断网和过期。cloud 用例通过：offline（按钮 aria-disabled 加说明、对话框内挡住、恢复后保存成功）、expired（过期优先、卡片与对话框都挡住） |
| SC3c | 编辑页「从示例添加」：勾选项加进草稿，点「保存计划」才生效，可放弃 | VERIFIED | `pkAddToDraft`（html:3111）只 `pe.draft.groups/lifts.push`，函数体无 `planCommit(`、`savePlanDraft(`（我读源码确认）；`#peSampleBtn` 入口行在 `renderPlanEditor` 开头，不受 peBlock 影响。cloud 用例通过：编辑页模式（追加末尾、折叠、焦点、保存前零写入、保存后新 id）、断网可用加示例顺序加放弃后零写入 |
| SC3d | 冲突处理、容量、会话结束 | VERIFIED | `pkSave` 并入远端后与 `pk.orig` 比较，不同则三选一（回去继续挑/放弃用新版/用我的覆盖），覆盖由 `planCommit` 先 `keepConflict` 留底；`planCommit` 先 `sizeOf>CLOUD_MAX`；`resetSession` 关闭 `pkDlg`（html:2019）；`isBusy` 含 `pkDlg.open`（html:1950）。cloud 用例通过：两条冲突、容量、跨标签页退出、启动门控 |
| SC4a | 换一台设备登录看到同一份计划 | VERIFIED | cloud 用例通过：PLAN-07 卡片挑完后第二台设备看到相同的组 id、1 张力量卡、有 `#planEditBtn`、无 `.pe-empty` |
| SC4b | cloud 全量和新增用例通过 | VERIFIED | cloud.json：266 条，0 unexpected，0 flaky；本阶段新增用例共 18 条全部在内且通过 |
| SC4c | 新文案在桌面和 375 px 窄屏、深浅色主题下都清楚 | PARTIAL → human_needed | 窄屏几何部分已自动证明：375 px 用例通过（面板贴底、列表可滚动、按钮 ≥44 px、等宽、入口按钮占满宽）。深浅色清晰度、真机安全区、手机宽度长 toast 视觉没有自动证据，按所有者决定推迟到 Phase 16，见 human_verification |
| B1 | UI-SPEC backstop：375 px 底部面板外观与 iOS 安全区 | HUMAN_NEEDED | 推迟，见上 |
| B2 | UI-SPEC backstop：浅色和深色主题选中态、对勾、焦点环 | HUMAN_NEEDED | 推迟，见上 |
| B3 | UI-SPEC backstop：手机宽度长 toast | HUMAN_NEEDED | 推迟，见上 |

**行为类真相：** 所有涉及状态转换、取消、清理、顺序的真相（容量不写、三选一三个出口、覆盖留底、放弃用新版不写、会话结束关闭、草稿放弃零写入、新 id 不复用、示例顺序追加）都有对应的、已在回归报告里通过的行为用例，所以没有 PRESENT_BEHAVIOR_UNVERIFIED（`behavior_unverified: 0`）。

**coincidental-reliance 检查：** 没有发现。示例 id 只当复选框键、从不写入计划；用例里的 SEED_PLAN 是显式传入的（`plan: SEED_PLAN`），不是靠夹具暗含的前提。

## 禁止项（prohibitions）

| 禁止项 | 层级 | 状态 | 证据 |
|--------|------|------|------|
| PLAN-06：登录时不得改动已有计划文档 | test | VERIFIED（非「未验证」） | `!sv` 才建档；报告里 PLAN-06「已有计划不变、零计划写入」和「缺文档按缓存重建」通过 |
| PLAN-07：不得把没勾选的示例项或示例快捷词放进计划 | test | VERIFIED | `pickSample` 只拷贝 `ks.has(...)` 的项，返回 `{groups,lifts}` 没有 presets；单元用例「pickSample copies only the chosen…」、tracer（presets 仍为 []）、PLAN-02 全选后 presets/fitGoal/fitNote 不变，均通过 |
| PLAN-07：不得复用示例 id | test | VERIFIED | `pickSample` 用 `nid("g-"/"t-"/"l-")` 的 do-while 避开 used；tracer 和单元用例断言前缀、不等于示例 id、互不重复；`pkSave` 的 used 集合合并了 `s.base` 和当前 `plan` |
| PLAN-07：不得在卡片模式静默覆盖别设备的计划 | test | VERIFIED | `peCanon(plan)!==s.orig` 先三选一；`planCommit(np,true)` 先 `keepConflict`；冲突用例通过（覆盖后 `#snapshotBtn` 可见且 toast 带下载留底） |
| PLAN-07：编辑页模式不得单独保存计划 | test | VERIFIED | `pkAddToDraft` 函数体无 `planCommit`/`savePlanDraft`；用例断言添加后到点保存之前计划写入条数不变 |

## 必要产物（三级核查）

| 产物 | 预期 | 状态 | 细节 |
|------|------|------|------|
| `us-journey-tracker.html` 纯函数段 `emptyPlan`、`pickSample`、`planUsedIds` | 在 `const CATS=` 与 saving 横幅之间 | VERIFIED | 行 907–918，均在纯函数段内，各出现 1 次 |
| `planCommit`、`planSavedToast` | 编辑页和卡片共用的唯一写入核心 | VERIFIED / WIRED | `savePlanDraft`（html:3013）和 `pkSave`（html:3160）都调用；`usePlan(np)` 只在 `planCommit` 里（html:2950），两个调用者里没有 `usePlan(` |
| `dialog#sample` 外壳与 pk* 系列 | 对话框、列表、提示行、忙碌、保存、事件 | VERIFIED / WIRED | html:555 外壳；事件、close 回焦、cancel 在忙碌时 preventDefault 均已接上 |
| 空计划卡片两个按钮、`#planSampleWhy`、`pkWhy` | 按钮、说明行、状态行刷新 | VERIFIED / WIRED | html:2242 渲染；点击委托 `openSamplePicker("card")`（html:2397） |
| 编辑页 `.pe-tools`、`#peSampleBtn`、`pkAddToDraft`、`pkRoom`、同名标记 | 编辑页入口和限制 | VERIFIED / WIRED | html:2548、2567、3077、3071–3072 |
| 旧的「载入示例计划」 | 删除 | VERIFIED | `loadSampleDraft`、`T_PE_SAMPLE_LOADED`、`data-peact="sample"` 均为 0 次 |
| `tests/cloud/plan-onboarding.spec.ts`、`tests/support/plan-picker.ts`、`tests/e2e/data/plan-normalize.spec.ts`、`tests/README.md`、`strings.ts`、`constants.ts` | 新用例与支撑 | VERIFIED | 文件均存在；报告里 18 条 cloud 与 2 条单元用例标题齐全并通过 |
| `#wkEmpty` 本周页提示 | S5 新文案 | VERIFIED | html:506 含「可以在「目标」页建一份计划，或从示例里挑。」 |

## 关键链路

| 从 | 到 | 方式 | 状态 |
|----|----|------|------|
| `reconcileOnce` 的 `resolve` | `emptyPlan()` | 无服务器文档且无缓存时 | WIRED（html:1285） |
| 目标页点击委托 `#planSampleBtn` | `openSamplePicker("card")` | 先 `peBlock()` | WIRED（html:2397） |
| `savePlanDraft` 和 `pkSave` | `planCommit` | 同一写入核心 | WIRED（html:3013、3160） |
| `setStatus` | `pkWhy()`、`pkHint()` | 状态行变化时刷新 | WIRED（断网、过期、门控用例通过） |
| `isBusy` | `pkDlg.open` | 挑选期间远端更新挂起 | WIRED（html:1950） |
| `resetSession` | 关闭 `pkDlg` | 别处退出登录 | WIRED（html:2019，跨标签页用例通过） |
| `#peSampleBtn` | `openSamplePicker("edit")` → `pkAddToDraft` | peRoot 委托开头按 id 处理 | WIRED（html:2567、3170） |

## 数据流（Level 4）

| 产物 | 数据 | 来源 | 真实数据 | 状态 |
|------|------|------|----------|------|
| 挑选列表 | 示例组和力量项 | `DEFAULT_PLAN` 常量（公开合成样本） | 是 | FLOWING |
| 卡片保存后的目标页 | `plan` | `planCommit` → `usePlan(np)` → `renderAll()`，并经 `requestSync` 写服务器 | 是（假服务器用例读回 lastPlan） | FLOWING |
| 编辑页草稿 | `pe.draft` | `pickSample` 的返回值 | 是 | FLOWING |

## 行为抽查

回归报告已覆盖，没有重跑套件（所有者的电脑资源受限）。抽查的是报告里的具体用例状态（全部 `expected`），见上表。静态检查命令：对 5 个纯函数段标记和 21 个新符号、旧符号计数的 grep，结果全部符合计划的验收值。

## 探针执行

本阶段无 `probe-*.sh` 探针，不适用。

## 需求覆盖

| 需求 | 来源计划 | 描述 | 状态 | 证据 |
|------|----------|------|------|------|
| PLAN-06 | 14-01、14-03 | 新账号从空计划开始，不再自动放入整份示例计划，基础快捷词清空；空计划卡片给两个入口；已有计划账号和本地路径不受影响 | SATISFIED | SC1、SC2a、SC2b 证据；REQUIREMENTS.md 第 40 行已勾选，追溯表标 Complete |
| PLAN-07 | 14-01、14-02、14-03 | 从示例计划勾选目标组和力量项，只把勾选项加进计划；卡片挑时确认后直接保存，编辑页挑时加进草稿 | SATISFIED | SC3a–SC3d、SC4a 证据；REQUIREMENTS.md 第 41 行已勾选，追溯表标 Complete |

**孤立需求（ORPHANED）：** 无。REQUIREMENTS.md 里映射到 Phase 14 的只有 PLAN-06 和 PLAN-07，三份 PLAN 的 `requirements` 字段都已覆盖。14-02 的 SUMMARY 写 `requirements-completed: []` 是有意的（等 14-03 收尾再标），不影响覆盖。

## 反模式扫描

| 文件 | 行 | 模式 | 严重度 | 影响 |
|------|----|------|--------|------|
| 无 | – | 在本阶段改动范围内没有 TBD、FIXME、XXX、TODO、HACK，没有 `style="`，没有 test.skip、fixme、only，没有空实现或硬编码空数据流向渲染 | – | – |

阶段收尾产物也核对了：`14-SECURITY.md` `threats_open: 0`、`status: verified`；`14-REVIEW-DISPOSITION.md` 三个发现（CR-01、WR-01、IN-01）全部 fixed、`open: 0`；UI 评审后的 85fb682 修复（含 T_PK_INVALID 的错误提示）在当前源码里可见（html:3026、3159）。

## 延后项（Step 9b）

没有。三条 backstop 不是「被后续阶段的范围覆盖的缺口」，而是所有者明确要求在 Phase 16 总体验收里人工核对的验收项（ROADMAP Phase 16 的备注里已有同类安排），所以放在 human_verification，不放 deferred。

## 需要人工验证的项目

见文件头 `human_verification` 的 4 项：375 px 底部面板外观与 iOS 安全区、浅色和深色主题的选中态与焦点环、手机宽度长 toast、全部新文案观感通读。它们全部推迟到 Phase 16 总体验收，不阻塞 Phase 14 收尾。

## 缺口总结

没有缺口。必须成立的真相、产物、链路、需求和禁止项都在当前代码和回归报告里得到证据。状态是 `human_needed`，原因只有已推迟的视觉和文案检查；这与「真实缺口」不同，编排者可以按「Phase 14 通过，人工项转交 Phase 16」处理。

---

_Verified: 2026-11-13_
_Verifier: Claude (gsd-verifier)_
