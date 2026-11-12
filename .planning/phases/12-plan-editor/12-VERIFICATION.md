---
phase: 12-plan-editor
verified: 2026-11-12T00:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files: [".planning/phases/12-plan-editor/12-01-PLAN.md",".planning/phases/12-plan-editor/12-01-SUMMARY.md",".planning/phases/12-plan-editor/12-02-PLAN.md",".planning/phases/12-plan-editor/12-02-SUMMARY.md",".planning/phases/12-plan-editor/12-03-PLAN.md",".planning/phases/12-plan-editor/12-03-SUMMARY.md",".planning/phases/12-plan-editor/12-04-PLAN.md",".planning/phases/12-plan-editor/12-04-SUMMARY.md",".planning/phases/12-plan-editor/12-05-PLAN.md",".planning/phases/12-plan-editor/12-05-SUMMARY.md",".planning/phases/12-plan-editor/12-06-PLAN.md",".planning/phases/12-plan-editor/12-06-SUMMARY.md",".planning/phases/12-plan-editor/12-07-PLAN.md",".planning/phases/12-plan-editor/12-07-SUMMARY.md",".planning/phases/12-plan-editor/12-08-PLAN.md",".planning/phases/12-plan-editor/12-08-SUMMARY.md","tests/support/constants.ts","us-journey-tracker.html"]
covered_digest: "v4:sha256:b628379b0307ca6f5ea802943f58189914f624f41bd2dc65d712703aaca44797"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "在本机真实 Edge 里打开云端版（假服务器、合成账号），桌面宽度和 375 px 各走一遍 12-08 的 human-check：编辑计划、增删改、上移下移、归档确认、已归档区恢复和彻底删除、离开确认和返回键、保存后第二个浏览器窗口几秒内同步、另一窗口的三选一、读不出来的账号计划的提示和留底 toast、带孤儿待办的旧备份导入摘要"
    expected: "界面和文案与 12-UI-SPEC 一致：只有「保存计划」一个深色块，按钮在 375 px 下不挤压、触控目标够大，粘性栏不遮内容；归档、恢复、彻底删除、离开确认、三选一的文字清楚；另一台设备几秒内显示新计划"
    why_human: "真实浏览器里的视觉与触控、「几秒内」的实际感受、新文案是否读起来清楚，自动套件证明不了（workflow.human_verify_mode = end-of-phase，12-08 的 human-check 尚未执行）"
  - test: "UI-SPEC 的三条 backstop（E2、E3、E10）：20 个组每组 50 项的编辑页、375 px 下 50 行任务、375 px 下两条带按钮的 toast"
    expected: "各自满足 UI-SPEC 的描述（不挤压、不溢出、可操作）"
    why_human: "UI-SPEC 明确要求人眼核对，自动用例无法判断视觉质量"
  - test: "暗色主题下的编辑页（含展开的卡片）、三选一对话框、目标页「已归档」区"
    expected: "文字对比度够用，没有用警告色当底色"
    why_human: "视觉对比度判断"
  - test: "所有者对本阶段新写的三句文案表态：自定义待办的导入摘要句（和迁移报告同步句）、读不出来的计划提示、留底 toast"
    expected: "读起来清楚，所有者同意或给出修改意见（不同意的记为问题，交给后续修复）"
    why_human: "文案取舍由所有者决定"
  - test: "IN-02 的返回键行为在真实浏览器里：从目标页点「编辑计划」后点浏览器返回，再试有未保存修改时的返回键和刷新（#plan 刷新后打开新草稿）"
    expected: "返回键退回上一页且历史里没有重复记录；有未保存修改时先确认；刷新后打开空白的新草稿"
    why_human: "Playwright 的历史栈行为不等于真实 Edge（含手机浏览器的 beforeunload 弹出不保证）"
---

# Phase 12: 编辑计划页 Verification Report

**Phase Goal:** 用户在应用的“编辑计划”页管理自己的目标组、任务、力量项、每周健身目标和基础预设标签，可以增删改，也可以调整顺序。编辑是草稿式的，点保存才生效，也可以取消。删除有进度的项时改为归档，历史不丢。保存后，同一账号的其他设备同步更新。
**Verified:** 2026-11-12
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths（路线图成功标准）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 从应用里进入「编辑计划」页（`#plan` 路由，不新增第五个标签），能新增、改名、删除目标组、任务、力量项、每周健身目标和基础预设标签，并上移下移排序；保存后四个视图按新计划显示 | ✓ VERIFIED | `us-journey-tracker.html`：`goPlan`/`openPlanEditor`/`planRoute`/`hashchange`（约 2319–2361、2782–2787），`renderPlanEditor`（2420）画目标组、任务、力量项、健身分区、基础预设标签；`peAddGroup/peAddTask/peAddLift/peAddTag`、`peMove`、`peMoveTag`、`peDelete`、`peDelTag` 是真实实现，不是占位。`showTab` 的标签列表里 `plan` 是第五个面板而不是新标签按钮。用例：`plan-editor-groups.spec.ts`（增、移动、上限、转义）、`plan-editor-fit.spec.ts`（健身目标、力量项、预设标签）。我单独跑了 `plan-editor-groups` 的两条用例（含「导出再导入后进度对应正确」），均通过 |
| 2 | 删除有进度的组、任务、力量项时改为归档而不是硬删：日历和时间线里已完成的记录、力量历史仍然显示；归档项可以恢复 | ✓ VERIFIED | `normalizePlan` 在组、任务、力量项上保留布尔 `archived`（573–603）；`isArchived/activeTasks/activeGroups/activeLifts/planMeta`（617–627）；`peDelete` 按进度分流；`peRestore`、`pePurge`（彻底删除二次确认）；`eventsOn` 和 CSV 只对未归档任务出截止行，完成记录不看归档（CSV 在 2924–2926）。用例 `plan-archive-view.spec.ts`（6 条，归档显示、完成记录保留、截止提醒隐藏和恢复）和 `plan-editor-archive.spec.ts`（4 条）。我单独跑了「permanently deleting …」（D-02）和「deleting a task or a group without progress … with progress asks and archives」（D-01），均通过 |
| 3 | 点取消后计划完全不变；有未保存修改时离开页面先确认；空名称或超出规模上限的输入不能保存，并有提示 | ✓ VERIFIED | `planDirty`（草稿与 `pe.orig` 的规范化比较，含 IN-01 备注空串处理）、`peLeave`、`pe-discard`、`beforeunload`（2789）、`hashchange` 返回键拦截；`planProblems`（800）和 `PE_ERR`（D-17 上限与空名称），`savePlanDraft` 在有问题时拒绝保存并展开出错的卡，保存时还按 `PLAN_MAX` 复查并 trim（WR-02）。用例 `plan-editor.spec.ts`（离开确认、beforeunload、登出、IN-02）、`plan-editor-groups.spec.ts`（空名称、上限、超限的已有计划）。我单独跑了 `plan-editor.spec.ts` 的「leaving …」匹配的 3 条，均通过 |
| 4 | 一台设备保存计划后，同一账号的另一台设备几秒内按新计划显示；另一台设备正在编辑时，草稿不被冲掉 | ✓ VERIFIED（自动化层面；真实双设备感受见人工项） | `savePlanDraft` 做 `docs.plan.dirty=true; seq++; cachePut; requestSync("save")`；`isBusy` 把编辑页算作忙，远端计划进 `pendRemote` 不改草稿，`peRemote`/`peChanged` 显示提示，保存时 `confirmBox` 三选一（覆盖留底、用新版、回去继续改）。用例 `plan-editor.spec.ts` 的「a group renamed … another device shows the new name」和 `plan-editor-sync.spec.ts`（9 条，含 D-07、D-08、离线与过期、4 MB 上限、同浏览器另一标签、CR-01/CR-02）。我单独跑了「renamed」和「leaves the draft unchanged」两条，均通过 |
| 5 | 新增项拿到 `g-`/`t-`/`l-` 前缀的新 id，已有 id 不变；编辑计划后导出再导入，任务进度仍对应正确的任务 | ✓ VERIFIED | `peAddGroup/peAddTask/peAddLift` 用 `"g-"/"t-"/"l-"+uid()` 并经 `peUsedIds` 避开已用 id；保存不改已有 id；用例「a group and a task added … get new g- and t- ids」和「after editing the plan an exported backup imports back with every task progress on the right task」（后者我单独跑过，通过） |

**Score:** 5/5 路线图成功标准已验证（0 项 present-but-behavior-unverified）

### 补充的计划级 truths（抽查）

| Truth | Status | Evidence |
|-------|--------|----------|
| D-16 空计划被 `normalizePlan` 接受，`usePlan` 不回退示例计划，目标页和本周页有空状态 | ✓ VERIFIED | `normalizePlan` 对 `groups: []`、`lifts: []` 不拒绝；`planEmpty()`（629）；用例「an emptied plan shows the empty plan card …」 |
| 所有者决定：数值规则只在编辑页，`normalizePlan` 对起始值和健身目标保持原有接受范围 | ✓ VERIFIED | `normalizePlan` 只检查 `pNum`、`target>0`；规则在 `planProblems`，打开时标出（`pe.preErr`）；用例「a loaded plan whose values break the editor rules …」 |
| 读不出来的账号计划先留底再替换（所有者决定、CR-01） | ✓ VERIFIED | `savePlanDraft` 中 `keepOrphans` 分支调用 `keepConflict("plan",…)`，留底失败则不保存；用例「an unreadable account plan is kept …」和 CR-01 用例 |
| D-13 本地版没有入口，`#plan` 回到目标页 | ✓ VERIFIED | `goPlan` 要求 `CLOUD&&me&&docs.plan`，`planRoute` 否则 `replaceState` 并 `showTab("goal")`；默认套件用例存在（编排者报告默认套件 193 条全部通过） |
| 应用基线哈希与记录一致 | ✓ VERIFIED | `us-journey-tracker.html` 的 sha256 前 16 位 `9dd0fbe4f68c6b98`，与 `tests/support/constants.ts` 的 `APP_SHA256` 一致 |
| 迁移脚本自检 | ✓ VERIFIED | `node tools/plan/migrate-backup.mjs --self-test` 输出「自检通过：59 项」 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `us-journey-tracker.html` | 编辑页、草稿、保存、归档规则 | ✓ VERIFIED | 存在、实质内容、与路由/同步/commit 接线（见上） |
| `tests/cloud/plan-editor*.spec.ts`（5 个）、`plan-archive-view.spec.ts` | 阶段用例 | ✓ VERIFIED | 共 43 条 `test(`，无 skip/fixme/only |
| `tests/support/plan-editor.ts`、`tests/support/goals.ts` | 帮助函数 | ✓ VERIFIED | 存在并被用例使用 |
| `tools/plan/migrate-backup.mjs` | 迁移脚本同步新规则 | ✓ VERIFIED | 自检通过 |
| `tests/KNOWN-BUGS.md` | WR-02、IN-05 已修复记录 | ✓ VERIFIED | 12-02 记录，BUG-01 登记护栏随默认套件通过（编排者报告） |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| 编辑页保存 | 服务器和其他设备 | `savePlanDraft` → `docs.plan.dirty/seq` → `requestSync("save")` | ✓ WIRED（「renamed … another device」用例证明） |
| `renderGoals`/日面板/时间线/CSV | 归档与组编号 | `groupLabel`、`isArchived`、`activeGroups`、`details#goalsArch` | ✓ WIRED（`groupLabel(t.group)` 出现在 CSV 与各视图） |
| 编辑页 | 同步与远端挂起 | `isBusy`、`pendRemote`、`takeRemote` | ✓ WIRED |
| 基础预设标签 | 「记一笔」 | `presetsFor` 合并 `plan.presets` 与 `state.presets` 并去重（1999） | ✓ WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real Data | Status |
|----------|------|--------|-----------|--------|
| 编辑页 | `pe.draft` | `JSON.parse(JSON.stringify(plan))`，`plan` 来自账号计划文档（`usePlan`） | 是 | ✓ FLOWING |
| 目标页 | `plan`/`activeGroups()` | 保存后 `usePlan(np)`，并由同步写回服务器 | 是 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 单条用例：改组名后另一设备显示 | `playwright --config=playwright.cloud.config.ts plan-editor.spec -g renamed`（低优先级、1 worker） | 1 passed | ✓ PASS |
| 单条用例：另一设备改计划，草稿不变 | `… plan-editor-sync -g leaves` | 1 passed | ✓ PASS |
| 单条用例：彻底删除 | `… plan-editor-archive -g permanently` | 1 passed | ✓ PASS |
| 离开确认与返回键（3 条） | `… plan-editor.spec -g leaving` | 3 passed | ✓ PASS |
| 删除分流与导出再导入（2 条） | `… plan-editor-groups -g progress` | 2 passed | ✓ PASS |
| 完整套件 | 按编排者说明未重跑；编排者在 HEAD 6f6d314 的结果：cloud 239 条、default 193 条，flaky 0、unexpected 0 | 采信编排者记录 | ✓ |

### Probe Execution

SKIPPED（本阶段计划没有声明 probe 脚本）。

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| PLAN-02 | 12-01, 03, 04, 05, 06, 08 | 增删改目标组、任务、力量项、每周健身目标和基础预设标签，并调整顺序 | ✓ SATISFIED | 成功标准 1、5；`plan-editor-groups/fit` 用例 |
| PLAN-03 | 12-01, 02, 04, 05, 06, 08 | 有进度的项改为归档，日历和时间线里的完成记录不消失 | ✓ SATISFIED | 成功标准 2；`plan-archive-view`、`plan-editor-archive` 用例 |
| PLAN-04 | 12-03, 07, 08 | 草稿式、点保存才生效、可取消、离开提示、保存后其他设备同步 | ✓ SATISFIED | 成功标准 3、4；`plan-editor`、`plan-editor-sync` 用例 |

阶段计划 frontmatter 里出现的需求 ID 只有 PLAN-02、PLAN-03、PLAN-04，REQUIREMENTS.md 把这三条映射到 Phase 12，没有遗漏。REQUIREMENTS.md 里映射到本阶段的其他 ID：无，没有 ORPHANED 项（PLAN-01 属 Phase 9，PLAN-05 属 Phase 7）。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 应用和阶段测试文件 | — | TBD/FIXME/XXX、`test.skip`/`fixme`/`.only` | — | 未发现（`tools/plan/extract-plan.mjs:265` 的 `TBD` 是正则里的占位词检测，不是遗留标记，且不在本阶段修改范围） |

阶段后审查：12-SECURITY.md（28/28 威胁已关闭，`threats_open: 0`）、12-REVIEW.md 的 7 条发现全部已修（`12-REVIEW-FIX.md` status all_fixed，`12-REVIEW-DISPOSITION.md` 无遗留）；12-UI-REVIEW.md 17/24，三项首要修复已在 56a6dea 应用。

### Deferred Items

无。路线图已排除的跨组移动、拖拽排序（PLAN-F1）和「恢复默认计划」不属于本阶段。

### Human Verification Required

见 frontmatter 的 `human_verification`（共 5 项）：真实 Edge 桌面与 375 px 的完整验收（12-08 的 human-check）、三条 UI-SPEC backstop（E2/E3/E10）、暗色主题、三句新文案的所有者表态、IN-02 返回键在真实浏览器里的表现。这些项都是视觉、触控和文案判断，自动用例证明不了，因此状态是 `human_needed`，而不是 `passed`。

### Gaps Summary

没有发现阻塞目标达成的缺口：五条路线图成功标准都有对应的实质实现、接线和通过的用例，三个需求 ID 全部满足，已记录的所有者批准偏差（`readGroupIds` 代替表头比较、SEC-01 检测只排除 `details#goalsArch`、`plan-editor.spec` 的过期提示断言、2026-11-11 的所有者决定）与实现一致。剩余的只有 12-08 里尚未执行的真实浏览器人工验收。

---

_Verified: 2026-11-12_
_Verifier: Claude (gsd-verifier)_

## 所有者批准的绕过（2026-11-12）

自动核对已全部通过（5/5 成功标准、PLAN-02..PLAN-04、回归 cloud 239/239 与默认 193/193、安全 28/28、代码审查 7/7 已修、UI 审查首要修复已应用）。上面 `human_verification` 的 5 项人工验收**没有执行**：所有者 2026-11-12 决定“后续都不参与验收，到时候总体完成并部署到服务器上以后再来做总体的验收”。这 5 项记为推迟（见 12-UAT.md 的 Deferred Follow-Ups），并入 Phase 13 部署后的总体验收；本报告的 `status: passed` 是所有者批准的绕过，不表示这些人工项已通过。
