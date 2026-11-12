---
phase: 12-plan-editor
plan: 02
subsystem: archived-area-and-deadline-reminders
tags: [archived, lifts, deadline-reminders, orphan-todos, goals-view, import-summary, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-01 的 isArchived、activeTasks、activeGroups、archivedHTML、readArchived、GROUP_NONE
provides:
  - activeLifts()：力量目标卡只画未归档的力量项
  - 「已归档」区的力量项（.lift.arch-l，完整历史，只读）和找不到所属组的自定义待办（带删除按钮）
  - 归档任务不计入本周分类计数；截止提醒（日历格子、日面板、日历 CSV）跳过归档任务
  - 导入摘要和迁移报告里自定义待办那一句改为说明放在「已归档」里
  - tests/KNOWN-BUGS.md 记下 Phase 7 的 WR-02、IN-05 已修复
affects: [12-03, 12-05, 12-06]

actuals:
  tokens: 4000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "只读归档区里唯一可操作的东西复用目标页现有的 data-deltask 监听，不新增删除路径"
    - "截止提醒只在 eventsOn 和 CSV 两处按 isArchived 过滤，截止日期本身留在数据里"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/goals.ts
    - tests/cloud/plan-archive-view.spec.ts
    - tests/cloud/import.spec.ts
    - tests/KNOWN-BUGS.md
    - tools/plan/migrate-backup.mjs
    - tests/e2e/security/escaping.spec.ts

key-decisions:
  - "找不到所属组的自定义待办不算归档：它们的截止提醒照常显示在日历上，在本周计数里按「其他」类别算（所有者 2026-11-11 确认）"
  - "SEC-01 注入检测器排除应用自己的 details#goalsArch，第二个及以后的 #goalsArch 仍算外来元素（所有者 2026-11-11 批准）"

requirements-completed: [PLAN-03]

coverage:
  - id: D1
    description: "归档的力量项在「已归档」区灰色只读显示完整历史，不在力量目标卡里；归档任务不计入本周和目标页的数字"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-archive-view.spec.ts#PLAN-03 archived tasks and lifts are listed read-only in the archived area and left out of the goals and week counts (D-03)"
        status: pass
    human_judgment: true
    rationale: "灰色外观、窄屏和深色主题下的样子没有用例断言，需要人看一眼"
  - id: D2
    description: "归档任务的截止提醒从日历格子、日面板、日历 CSV 里隐藏，不再归档后回来；完成记录照常显示"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-archive-view.spec.ts#PLAN-03 an archived task keeps its done record in the calendar and the timeline while its due date leaves the calendar and the calendar CSV until the plan no longer archives it (D-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "找不到所属组的自定义待办列在「已归档」区并能删除（WR-02）；导入摘要和迁移报告的句子与新行为一致"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-archive-view.spec.ts#PLAN-03 WR-02 a custom to-do whose group is not in the plan is listed in the archived area and can be deleted there (D-05)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 WR-01 a custom to-do whose group is not in the plan is highlighted in the summary and kept in the records"
        status: pass
      - kind: unit
        ref: "node tools/plan/migrate-backup.mjs --self-test（自检通过：59 项）"
        status: pass
    human_judgment: true
    rationale: "新的导入摘要句子不是所有者定的文案，12-08 的真实浏览器验收里请所有者过目"

duration: 24min
completed: 2026-11-12
status: complete
plan_head_before: 67ff7bd340d20b79e9fb2afee69b6c800a8a28e6
plan_head_after: 17991f607172b34833e8994b4fb142d7dea1ea21
commits: 2
---

# Phase 12 Plan 02: 已归档区补齐、归档任务的截止提醒、找不到组的待办 Summary

**归档的力量项在「已归档」区灰色只读显示完整历史，归档任务不再计入本周和目标页的数字、截止提醒不再出现在日历和日历 CSV，找不到所属组的自定义待办在「已归档」区可见可删（修 Phase 7 的 WR-02、IN-05）。**

## Performance

- **Duration:** 约 24 min（含一次等待所有者决定的检查点）
- **Started:** 2026-11-11T23:52:29Z
- **Completed:** 2026-11-12T00:16Z
- **Tasks:** 2
- **Files modified:** 9（没有新文件）

## Accomplishments

- **「已归档」区四类内容的顺序和 n 的算法：** 自上而下依次是 归档的组（`data-arch="g:"`）、单独归档的任务（小标题「已归档的任务」，`t:`）、归档的力量项（`.lift.arch-l`，`l:`）、找不到所属组的自定义待办（小标题「没有所属目标组的待办」，`o:`）。`n = 归档的组 + 所在组没归档的单独归档任务 + 归档的力量项 + 找不到组的自定义待办`，n 为 0 时整块不渲染。
- **力量项（D-03）：** `activeLifts()` 让力量目标卡只画未归档的力量项；归档的力量项显示名称、当前值 / 目标值、进度条和完整历史（不只最近三条，历史值和日期逐项 `esc`），没有历史就显示备注，没有任何输入和按钮。
- **计数（D-03、S12）：** 「本周」的完成任务改用 `activeTasks()`，分类比较写成 `(planCat[t.group]||"其他")===C.n`，找不到组的自定义待办算「其他」，不抛错。目标页的完成数 12-01 已经只数未归档任务。
- **截止过滤的两处位置（D-04）：** `eventsOn` 的 due 分支写成 `else if(!s.done&&s.due===date&&!isArchived(t))due.push(t)`；日历 CSV 的截止分支写成 `else if(s.due&&!isArchived(t))rows.push(...)`。完成分支都不看归档；截止日期本身不改不删，计划不再归档它之后提醒自然回来，cloud 用例用“另一个写入方改计划后刷新”证明。
- **找不到组的待办（D-05、WR-02）：** 每行 `.task.ro`（文字、状态和 `×` 按钮，`data-deltask`，`aria-label="删除待办"`），复用目标页现有的 `data-deltask` 点击处理（commit 删掉待办和它的进度），不新增删除路径；按钮在 `GATE_BLOCK` 里，对账门控期间被禁用。
- **改过的两句文案原文：**
  - 导入摘要醒目行 `T_IMP_ORPHAN_CUSTOM`：旧 `n+" 条自定义待办的目标组不在计划里，导入后在目标页看不到。"`，新 `n+" 条自定义待办的目标组不在计划里，导入后放在目标页底部的「已归档」里。"`（`tests/support/strings.ts` 的 `importOrphanCustomLine` 逐字同步）。
  - 迁移脚本报告行：旧 `目标组不在计划里的自定义待办 {n} 条（保留在记录里，导入后目标页看不到）`，新 `目标组不在计划里的自定义待办 {n} 条（保留在记录里，导入后在目标页的「已归档」里）`（自检里逐字比较的期望同步）。
- **KNOWN-BUGS：** 「已修复」一节加了 `WR-02（已修复，Phase 7 代码审查）` 和 `IN-05（已修复，Phase 7 代码审查）` 两条列表项（不进登记表），含修复阶段、修法和回归用例标题；BUG-01 登记护栏保持通过。
- **用例条数：** 完整默认套件 190 条全部通过（REPORT OK，flaky 0，unexpected 0；含 SAFE-02 和 BUG-01 登记护栏），本计划不新增默认用例，条数与 12-01 之后相同。`test:cloud` 的 plan-archive-view、import、migration 共 19 条通过，plan-archive-view 现有 5 条（本计划新增 3 条）。迁移脚本自检打印“自检通过：59 项”，不含合成文字。

## Task Commits

1. **Task 1（tracer）：归档的力量项和计数（D-03）** - `81b8303`（feat）
2. **Task 2：截止提醒、找不到组的待办、文案、KNOWN-BUGS** - `17991f6`（feat）

**Plan metadata:** 见下一次 docs 提交

## Files Created/Modified

- `us-journey-tracker.html` - activeLifts、归档力量项和找不到组的待办、eventsOn 与 CSV 的截止过滤、本周计数、T_IMP_ORPHAN_CUSTOM 新文案
- `tests/support/constants.ts` - 每个任务重新记录 APP_SHA256
- `tests/support/strings.ts` - importOrphanCustomLine 新文案、ORPHAN_TASKS_TITLE
- `tests/support/goals.ts` - readArchived 多返回 liftHistCounts（只返回数字）
- `tests/cloud/plan-archive-view.spec.ts` - 3 条新 cloud 用例
- `tests/cloud/import.spec.ts` - IO-08 WR-01 用例多断言 orphanIds 含 `c-wr1-2`
- `tests/KNOWN-BUGS.md` - WR-02、IN-05 的已修复记录
- `tools/plan/migrate-backup.mjs` - 报告行和自检期望
- `tests/e2e/security/escaping.spec.ts` - 见下面的偏差

## Decisions Made

见 frontmatter 的 key-decisions。另：归档力量项的历史值和日期都过 `esc(...)`（主列表里的旧写法对日期没有 esc，没有动它）。

## Deviations from Plan

### 所有者批准的偏差

**1. [Rule 4 - 所有者决定 2026-11-11] SEC-01 注入检测器排除应用自己的 details#goalsArch（owner-approved 2026-11-11: SEC-01 detector excludes the app's own details#goalsArch; a second #goalsArch still counts as foreign）**
- **Found during:** Task 2 的完整默认套件（`tests/e2e/security/escaping.spec.ts` 的 `SEC-01 with the entry checks bypassed every renderer still escapes ids, dates and values` 失败，`foreign: 1`）
- **Issue:** 恶意状态里 `c-synth-3` 的 group 是载荷、不在计划里，按新规则它列在「已归档」区，于是页面里有了应用自己的 `details#goalsArch`；检测器 `readInjection` 把所有 `details` 都算外来元素。该文件不在计划的 files_modified 里，已停下向所有者报告。
- **Fix:** `foreign` 改为 `querySelectorAll('s, details:not(#goalsArch), img, iframe, svg, object, embed').length + Math.max(0, querySelectorAll('#goalsArch').length - 1)`，注释同步；第二个及以后的 `#goalsArch` 仍算外来元素，借用这个 id 的注入照样被检测到。
- **Files modified:** `tests/e2e/security/escaping.spec.ts`
- **Verification:** tests/e2e/security 10 条全过（含反向对照 `SEC-01 the injection detector reports elements injected by a variant without escaping`）；完整默认套件 190 条 REPORT OK
- **Committed in:** `17991f6`

### 计划内的小修正

- Task 1 的新用例一开始漏给第 1 组第 2 个任务设 `archived: true`，本周计数读到 2；是用例自己的准备漏了，补上后通过，应用没有问题。

**Total deviations:** 1（所有者批准的测试检测器改动）
**Impact on plan:** 只放宽了对应用自己的、固定 id 的元素的检测，其余检测照旧；没有放宽任何其他断言。

## Issues Encountered

- 第一次完整默认套件有 1 条失败（SEC-01，原因同上），已按所有者决定处理，第二次 190 条全过。

## Known Stubs

无。

## Threat Flags

无新增的安全相关面。T-12-04：删除只复用现有 `data-deltask` 分支，门控期间被 applyGate 禁用；T-12-05：截止日期留在数据里，cloud 用例证明恢复后提醒回来；T-12-06：力量名称、历史值、日期和待办文字都经 `esc(...)`，SEC-01 的页面用例和源码门槛在完整套件里通过。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

读侧全部就绪：「已归档」区的四类内容、归档任务的计数和提醒规则都已落地，编辑页（12-03 起）可直接沿用 `archived` 数据规则。12-08 的真实浏览器验收里请所有者看一眼新的导入摘要句子和归档区的灰色外观（窄屏、深色主题）。

## Self-Check: PASSED

- 文件存在：本计划修改的 9 个文件都在磁盘上并已提交（没有新建文件）。
- 提交存在：`81b8303`、`17991f6` 都在当前分支上。
- 验收：Task 1 和 Task 2 的 grep 门槛、五个锚点各一次、APP_SHA256 与文件一致、cloud 命令（3 条、19 条）REPORT OK、默认全套 190 条 REPORT OK（含 SAFE-02 和 BUG-01 登记护栏）、迁移自检通过、暂存隐私检查两次通过。
