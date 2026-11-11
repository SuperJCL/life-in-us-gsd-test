---
phase: 12-plan-editor
plan: 01
subsystem: plan-data-and-goals-view
tags: [normalizePlan, archived, empty-plan, group-labels, goals-view, playwright]

requires:
  - phase: 11-import-export
    provides: classifyBackup 和 importProblem 的导入白名单、backupOf 的备份格式、迁移脚本
provides:
  - normalizePlan 在组、任务、力量项上保留布尔 archived，并接受空计划（groups 和 lifts 为 []）
  - 纯函数段的 groupLabel、planMeta、isArchived、activeTasks、activeGroups、T_GROUP_UNKNOWN、GROUP_NONE
  - 目标页主列表按 P1、P2…自动编号并只显示未归档的组和任务
  - 目标页底部默认折叠、灰色只读的「已归档（n）」区
  - 日面板、时间线、日历 CSV、完成计划编辑框的组标签（P 编号、归档组的组名、未知目标组）
affects: [12-02, 12-03, 12-05, 12-06]

actuals:
  tokens: 12912
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "派生数据按 plan 对象身份做缓存（archMemo），withPlan 和 normUnder 不用改"
    - "只读的归档区：data-arch 属性加 details#goalsArch，展开状态存模块变量 goalsArchOpen"

key-files:
  created:
    - tests/cloud/plan-archive-view.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/goals.ts
    - tests/e2e/data/plan-normalize.spec.ts
    - tests/e2e/data/backup-format.spec.ts
    - tests/e2e/security/escaping.spec.ts
    - tools/plan/migrate-backup.mjs
    - tests/cloud/account-data.spec.ts
    - tests/cloud/import.spec.ts
    - tests/cloud/import-undo.spec.ts

key-decisions:
  - "数值规则（力量项起始值、每周健身目标）不进 normalizePlan，只在编辑页（12-05）执行；已有的、远端的、导入的计划不会因新规则退回示例计划（所有者 2026-11-11）"
  - "GROUP_NONE 是 \"-\"：不合 GROUP_ID_RE，所以不会有真实的组叫这个 id，找不到组的自定义待办不会悄悄挂到真实的组上"
  - "组编号 P{n} 只数未归档的组；归档的组在日面板、时间线、CSV 里显示组名"
  - "云端用例按组 id 而不是标题编号核对“哪个组在哪个位置”：新增 readGroupIds（所有者 2026-11-11 批准）"

requirements-completed: [PLAN-03, PLAN-02]

coverage:
  - id: D1
    description: "normalizePlan 保留组、任务、力量项的布尔 archived，非布尔的让整份计划不合格"
    requirement: PLAN-03
    verification:
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-03 normalizePlan keeps archived on groups and lifts and accepts an empty plan (D-06, D-16)"
        status: pass
    human_judgment: false
  - id: D2
    description: "目标页主列表只显示未归档的组和任务，编号按顺序生成；归档项出现在底部默认折叠的灰色只读区"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-archive-view.spec.ts#PLAN-03 a plan with an archived group from the server hides it from the goals list, numbers the other groups in order and shows it greyed in the archived area (D-03, D-06, D-14)"
        status: pass
    human_judgment: true
    rationale: "灰色外观、窄屏和深色主题下的样子没有用例断言，需要人看一眼"
  - id: D3
    description: "空计划合格；空计划下 normalize 不抛错；GROUP_NONE 标记的待办能导回；数值规则保持今天的接受范围"
    requirement: PLAN-02
    verification:
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-02 normalizePlan keeps accepting any finite lift start value and any two finite weekly fitness numbers (editor rules apply in the editor only)"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/backup-format.spec.ts#IO-07 classifyBackup reads the agreed wrapper as a full backup or a plan-only file and rejects a wrapper with any invalid part"
        status: pass
    human_judgment: false
  - id: D4
    description: "日面板、时间线、日历 CSV、完成计划编辑框的组标签按 D-14、A17 显示，.tag 单行省略"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-archive-view.spec.ts#PLAN-03 the day panel, the timeline and the calendar CSV show P numbers for groups in use, the name of an archived group and the unknown-group label (D-14, A17)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/security/escaping.spec.ts#SEC-01 with the entry checks bypassed every renderer still escapes ids, dates and values"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-11-11
status: complete
plan_head_before: fb163fa6c72f0e2421b99d72dde6f737c855eb50
plan_head_after: f54cabcfd4daaf3e461b58477191b46942256545
commits: 3
---

# Phase 12 Plan 01: 归档和空计划的数据规则与读侧显示 Summary

**normalizePlan 保留组、任务、力量项的 archived 并接受空计划；目标页按 P1、P2… 自动编号，归档项进底部灰色只读的「已归档」区，日面板、时间线、日历 CSV 的组标签改用编号或组名。**

## Performance

- **Duration:** 19 min（含一次等待所有者决定的检查点）
- **Started:** 2026-11-11T23:27:15Z
- **Completed:** 2026-11-11T23:48:37Z
- **Tasks:** 3
- **Files modified:** 12（一个新文件）

## Accomplishments

- **normalizePlan 的改动：** 组和力量项照任务的写法保留布尔 archived（非布尔拒绝整份计划，缺省不写键）；去掉“groups 不能为空”这一条，空计划合格；力量项起始值和每周健身目标的校验一个字没改。
- **新纯函数（放在 usePlan 之后，不碰 DOM）：** `groupLabels(p)` 返回 Map（未归档的组 `P{序号}`、归档的组用组名）；`planMeta()` 返回 `{p, garch, arch, label}`，按 `plan` 的对象身份缓存在模块变量 `archMemo` 里，所以 withPlan 和云端段的 normUnder 不用改，也没有新的需要保存恢复的模块变量；`groupLabel(id)` 找不到返回 `T_GROUP_UNKNOWN`；`isArchived(t)`（任务自身归档，或所在组归档，归档组里的自定义待办因此跟着组走）、`activeTasks()`、`activeGroups()`。
- **目标页：** 主列表只画 `activeGroups()`，每组只数未归档的任务；组标题编号取 `groupLabel`；添加待办输入框的 aria-label 改成 `给「组名」添加待办`。底部 `details#goalsArch` 在 n>0 时渲染（n 目前 = 归档组数 + 所在组没归档的单独归档任务数，12-02 再加力量项和找不到组的待办），默认折叠，展开状态存在 `goalsArchOpen`，重画不收起；区里没有任何 input 和按钮。
- **GROUP_NONE（`"-"`）的理由和三处用法：** 空计划（或没有未归档的组）时，组不合格的自定义待办找不到可挂的组。`-` 不合 GROUP_ID_RE，所以 normalizePlan 永远不会接受叫这个 id 的真实组，待办不会悄悄挂到真实的组上。三处：normalize 在选组时写它，并且对已是它的待办不再改组；importProblem 对它放行，所以空计划时导出的备份能导回；12-02 把这种待办列进「已归档」区的「没有所属目标组的待办」。
- **组标签：** renderDay 两处、renderTimeline、openTaskEditor、日历 CSV 两行都用 `groupLabel(t.group)`；`.tag` 并入 `max-width:12em` 和单行省略。
- **用例条数（`--list` 实数）：** 默认套件 HEAD 为 188，现在 190（加 2 条单元用例，全部通过）；`test:cloud` 全套 198 条全部通过，其中本计划新增 2 条。迁移脚本自检打印“自检通过：59 项”，不含合成文字。

## Task Commits

1. **Task 1（tracer）：归档的组和任务读侧显示** - `97005a2`（feat）
2. **Task 2：空计划、GROUP_NONE** - `77e10ab`（feat）
3. **Task 3：组标签改用编号或组名** - `f54cabc`（feat）

**Plan metadata:** 见下一次 docs 提交

Task 2 标了 `tdd="true"`：先写用例并确认它们先失败（backup-format 的 `empty plan, full` 断言收到 null；plan-normalize 的两条因 `GROUP_NONE` 尚未定义而在加载时抛 ReferenceError，PLAN-02 那条因此不是在断言上失败，只算部分的 RED 证据），再实现。按计划“每个任务一次提交”的约定，测试和实现在同一次提交里，没有单独的 RED 提交。

## Files Created/Modified

- `us-journey-tracker.html` - normalizePlan、新助手、GROUP_NONE、renderGoals 和归档区、组标签、CSS
- `tests/support/constants.ts` - 每个任务重新记录 APP_SHA256
- `tests/support/strings.ts` - 8 个新文案常量，逐字同步应用
- `tests/support/goals.ts` - readGroups 跳过 `.arch`；新增 readArchived、readGroupIds
- `tests/cloud/plan-archive-view.spec.ts` - 新，2 条 cloud 用例
- `tests/e2e/data/plan-normalize.spec.ts`、`tests/e2e/data/backup-format.spec.ts` - 空计划、archived、数值照旧接受、GROUP_NONE
- `tests/e2e/security/escaping.spec.ts` - SEC-01 页面用例按新标签改断言
- `tools/plan/migrate-backup.mjs` - 自检里“空组数”那条改成 groups 不是数组
- `tests/cloud/account-data.spec.ts`、`tests/cloud/import.spec.ts`、`tests/cloud/import-undo.spec.ts` - 见下面的偏差

## Decisions Made

见 frontmatter 的 key-decisions。另：归档组头部的进度条始终渲染（沿用 `.group` 结构），没有按“有备注才显示”理解。

## Deviations from Plan

### 所有者批准的偏差

**1. [Rule 4 - 所有者决定 2026-11-11] 云端用例的断言从标题编号改成组 id（owner-approved 2026-11-11: assertions moved from header code to group id after D-14）**
- **Found during:** Task 1 verify（`tests/cloud/import.spec.ts` 和 `tests/cloud/account-data.spec.ts` 共 4 条失败）
- **Issue:** 这些用例用 `readGroups(...).map(g => g.code)` 核对“哪个组在哪个位置”，期望值是组 id（如 `g-a1`）。D-14 之后标题显示 `P1`、`P2`，不再是组 id，这些文件不在计划的 files_modified 里。已停下并向所有者报告。
- **Fix:** `tests/support/goals.ts` 新增 `readGroupIds(page)`（只读主列表，按页面顺序，取每组添加待办输入框的 `data-addto`）；`GroupRead` 形状不变。`account-data.spec.ts`（3 处）、`import.spec.ts`（`not.toContain('g-fb1')` 那条现在不再空转，另外 3 处）、`import-undo.spec.ts`（`groupCodes()`）改读组 id。
- **Files modified:** `tests/support/goals.ts`、`tests/cloud/account-data.spec.ts`、`tests/cloud/import.spec.ts`、`tests/cloud/import-undo.spec.ts`
- **Verification:** Task 1 的 cloud 命令 17 条全过；末尾又跑了一遍完整 `npm run test:cloud`（198 条全过），没有别的文件因同样原因失败
- **Committed in:** `97005a2`

### 其他说明

- 计划里 Task 3 的 CSV 用例写“说明列依次是 `P1 计划`、`<组名> 计划`、`未知目标组 计划`”，实现按这个顺序通过。
- 完整 cloud 套件不在计划的 verify 里，是我为排查同类问题多跑的一遍，没有改动任何其他文件。

**Total deviations:** 1（所有者批准的测试断言改动）
**Impact on plan:** 只改读法，没有放宽任何断言；`import.spec.ts` 里原先空转的负向断言现在真正起作用。

## Issues Encountered

- 第一次 cloud 运行有 4 条失败，原因同上，已按所有者决定处理。
- 任务里用 `heredoc` 写大段文件时 Bash 工具的引号解析出错过两次，改用 Write 工具写脚本文件，没有影响结果。

## Known Stubs

无。

## Threat Flags

无新增的安全相关面。T-12-02 的缓解到位：新插值都写成 `esc(...)`，组 id 不再作为文字进入页面（SEC-01 页面用例更严），源码门槛 BARE_TOKENS 通过。T-12-01：GROUP_NONE 的三处用法有单元用例覆盖。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

读侧已就绪：12-02 可以直接把力量项和找不到组的待办加进「已归档」区（`readArchived` 的 `liftIds`、`orphanIds` 已留好），编辑页（12-03 起）可沿用 normalizePlan 的 archived 和空计划规则。

## Self-Check: PASSED

- 文件存在：`tests/cloud/plan-archive-view.spec.ts` 已在磁盘上并已提交。
- 提交存在：`97005a2`、`77e10ab`、`f54cabc` 都在当前分支上。
- 验收：Task 1 到 3 的 grep 门槛、APP_SHA256 与文件一致、cloud 命令（17 条、17 条中的本任务标题、9 条）REPORT OK、默认全套 190 条 REPORT OK（含 SAFE-02 和两条 SEC-01）、迁移自检通过、暂存隐私检查三次通过。
