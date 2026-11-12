---
phase: 12-plan-editor
plan: 06
subsystem: plan-editor-archive-and-empty-plan
tags: [plan-editor, archive, restore, purge, empty-plan, sample-plan, limits, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-05 的 liftHistoryCount、PLAN_MAX、pe 会话（origIds、gone）、归档确认的写法、savePlanDraft 的差集清理（任务进度、组的自定义待办、state.lifts）；12-01、12-02 的归档规则、目标页「已归档」区和 archStatus；12-03 的 confirmBox（scope、okClass）
provides:
  - 编辑页底部的 details#pe-archived：按「目标组」「任务」「力量项」列出草稿里的归档项，恢复（不需要确认）和彻底删除（再确认一次）
  - 彻底删除的三种确认框（任务、目标组含自定义待办数、力量项含历史条数）；保存时由已有的差集清理连进度一起删掉
  - 恢复受数量上限约束（20 个组、每组 50 项任务、8 个力量项），上限时「恢复」disabled 并写明原因
  - 空计划（没有未归档的组和力量项）：目标页「计划是空的」卡片、力量项或目标组为空的说明行、本周页 #wkEmpty、编辑页目标组分区的空状态
  - loadSampleDraft：把示例的目标组和力量项以全新 id 载入草稿
affects: [12-07, 12-08]

actuals:
  tokens: 10179
  tasks: 3
  commits: 3
plan_head_before: 768532e7f1c25494ada258ae6f56bf2367a08b3f
plan_head_after: 0492da5e2d8c3826781554e27c7a61ff8ef2f86b

tech-stack:
  added: []
  patterns:
    - "恢复 = 删掉草稿里的 archived 键（不写 false），组和力量项 push 到数组末尾，任务 push 到原组 tasks 末尾；id 不变，进度、截止日期、力量历史随 id 回来"
    - "彻底删除只改草稿：从数组里 splice 掉，不进 pe.gone；保存时由 savePlanDraft 按保存前后计划的 id 差集清理，所以不需要另一条清理路径，「放弃这次修改」也就能撤回"
    - "区里的聚焦：peArchOrder 在重画前记下「恢复」按钮的键顺序，peArchFocus 在重画后找下一个可用的「恢复」，没有就到摘要，区消失就到 #pe-h-groups（加了 tabindex=-1）"
    - "空计划 = planEmpty()（没有未归档的组、也没有未归档的力量项）；normalizePlan 本来就接受 groups:[]、lifts:[]，空计划刷新后仍是空的，不会换成示例计划"

key-files:
  created:
    - tests/cloud/plan-editor-archive.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/plan-editor.ts

key-decisions:
  - "恢复上限的说明行不用编辑页已有的 .pe-lim 类，用 .pe-arch-lim（样式相同）：12-04、12-05 的两条用例按 #pe-main .pe-lim 读上限提示，沿用同一个类会让它们多读到已归档区里的行（第一次运行就因此失败了一条 12-04 的用例）；改应用而不是改那些用例"
  - "彻底删除的项不进 pe.gone，所以 12-07 的 D-08 复查不会再问一遍（用户在确认框里已经明确选了连进度一起删）"
  - "已归档区的行用 data-row 属性（g:/t:/l: 加 id）标记，按钮用 data-peact 和 data-pekey；行本身不叫 data-key，不会被 readEditor 的 .pe-card[data-key^=g:] 读成组卡"
  - "力量项卡之外，没有力量项时目标页只在力量目标卡里加一行 .empty，保留空的 .lifts 容器（多出约 12px 上边距），没有为此重排模板"
  - "载入示例计划在编辑页里发起时把焦点放到「目标组」标题，从目标页的卡片发起时不抢焦点（编辑页打开时的焦点在页标题）"

requirements-completed: [PLAN-03, PLAN-02]

coverage:
  - id: D1
    description: "归档的、设了截止日期的任务能在编辑页「已归档」区恢复：回到原组末尾，不弹确认，toast「已恢复：…」，保存后服务器计划没有 archived 键、截止日期原样，目标页有它的日期输入框，日历上的截止提醒回来"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-archive.spec.ts#PLAN-03 an archived task is restored from the editor's archived area to the end of its group with its progress and due reminder (D-02, D-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "彻底删除任务、目标组、力量项各再确认一次（.danger 按钮、默认焦点在「不删除」、写明进度和完成记录会消失、组写明自定义待办数）；保存后进度、组的自定义待办、力量历史都被清掉，留下的项原样；放弃这次修改可以撤回"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-archive.spec.ts#PLAN-03 permanently deleting an archived task, group or lift asks again and after saving removes its progress, custom to-dos and lift history (D-02)"
        status: pass
    human_judgment: true
    rationale: "确认框的措辞、红色按钮外观、窄屏下按钮落到第二行的布局没有用例断言（12-08 验收）"
  - id: D3
    description: "归档组带着它的自定义待办一起恢复；组里单独归档的任务在组恢复后留在「任务」里；组满 20、任务满 50、力量项满 8 时「恢复」disabled 并写明原因，删掉一个后可用"
    requirement: PLAN-03
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-archive.spec.ts#PLAN-03 an archived group carries its custom to-dos, a task archived on its own stays archived when the group is restored, and restore is disabled when the list is full (D-05, A10, A11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "计划可以删光：目标页换成「计划是空的」卡片（编辑计划、载入示例计划），本周页显示说明且记一笔照常；刷新后仍是空计划；载入示例计划把示例的组和力量项以全新的 g-、t-、l- id 放进草稿，预设和健身目标不动，保存后编号 P1 到 P7、本周页说明隐藏"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-archive.spec.ts#PLAN-02 an emptied plan shows the empty plan card and the week hint, and the sample plan loads into the draft with new ids (D-16, A16)"
        status: pass
    human_judgment: true
    rationale: "空计划卡片和本周说明在 375px 下的换行外观、「已归档」区长名称的单行省略没有用例断言（12-08 验收）"

duration: 约 34min（含完整默认套件约 6 分钟、完整 cloud 约 9 分钟）
completed: 2026-11-12
status: complete
commits: 3
---

# Phase 12 Plan 06: 已归档区的恢复与彻底删除、空计划 Summary

**编辑页底部多了默认折叠的「已归档（n）」区：归档的组、任务、力量项可以一键恢复（组和力量项排到最后、任务排到原组末尾，进度和截止提醒随 id 回来），也可以再确认一次后连进度一起彻底删除；恢复受 20/50/8 的上限约束；计划删光后目标页换成「计划是空的」卡片，本周页多一行说明，「载入示例计划」把示例以全新 id 放进草稿。**

## Performance

- **Duration:** 约 34 min（开始 02:11 UTC，结束 02:46 UTC；含等待套件）
- **Tasks:** 3（Task 1 为 tracer，一次通过，记为“Tracer verified end-to-end — expanding”）
- **Files modified:** 5（一个新文件）
- **实际规模：** 新增约 40.7K 字符（chars/4 约 10.2K），估计 105K 差得很远；三个任务都是一次改应用、一次改测试，只有 Task 2 因为一条上限提示的类名撞了 12-04 的用例重跑过一次。计划里“执行时可能要拆分”的风险没有触发，三个任务在一个上下文里做完。

## Accomplishments

- **Task 1（tracer）：** `details#pe-archived` 只在 n>0 时渲染，n = 草稿里归档的组 + 所在组没归档的单独归档任务 + 归档的力量项（所属组也归档的任务不单独列出，A11）。每行名称单行省略（title 放全名）、一行 12px 说明（组 `{类别} · {n} 项任务，其中 {m} 项已完成`、任务 `来自「{组名}」· {状态}`、力量项 `{n} 条力量记录`），右边「恢复」「彻底删除」。恢复：删掉 `archived` 键，组和力量项 push 到数组末尾，任务 push 到原组末尾；toast `已恢复：{短名}`（3000 ms）、读屏区、焦点到区里下一个可用的「恢复」/摘要/目标组标题。展开状态存在 `pe.archOpen`。
- **Task 2：** `pePurge`：三种确认框（文案与 UI-SPEC S7 逐字一致，组的确认框在有自定义待办时多一段 `组里的 {c} 个自定义待办也会一起删除。`），确认按钮用默认的 `.danger`，`scope:"plan"`；确认后从草稿 splice 掉，不进 `pe.gone`，读屏区 `已彻底删除：{名称}`；每处 await 之后核对 `pe` 还是同一个会话。保存时 12-04、12-05 的差集清理已经覆盖离开计划的任务（含归档组里的任务）、组的自定义待办和它们的进度、力量项的 `state.lifts`，没有另加清理。恢复的上限：20 个组、原组 50 项未归档任务、8 个力量项，满了「恢复」disabled，旁边写 `目标组已满（20 个），先删掉一个再恢复`（任务、力量项同理，数字和单位换掉）。
- **Task 3：** `planEmpty()`；目标页空计划卡片（`#planEditBtn2` .primary、`#planSampleBtn` .ghost，只在云端有会话时输出，卡片之后仍显示「已归档」区）；只缺力量项时力量卡里一行 `.empty`，只缺目标组时力量卡之后一行 `.empty`；本周页 `p#wkEmpty`；编辑页目标组分区 `.empty` 加「＋ 添加目标组」和「载入示例计划」（`data-peact="sample"`）；`loadSampleDraft`：DEFAULT_PLAN 深拷贝后组 `g-`、任务 `t-`、力量项 `l-` 加 `uid()`，避开 `peUsedIds()`，追加到草稿末尾，预设和健身目标不动，toast（4000 ms）。

### 落点和命名（12-07、12-08 沿用）

| 类别 | 值 |
|------|----|
| 动作 `data-peact` | 新增 `restore`、`purge`、`sample`（键 `data-pekey` 为 `g:<id>`、`t:<tid>`、`l:<id>`） |
| 元素 | `details#pe-archived`（`.pe-arch`）、`.pe-arch-h`、`.pe-arch-list`、`li.pe-arch-row[data-row]`、`.pe-arch-name`、`.pe-arch-desc`、`.pe-arch-lim`（上限说明，不是 `.pe-lim`）；目标页 `.panel.pe-empty`、`#planEditBtn2`、`#planSampleBtn`；本周页 `#wkEmpty` |
| 会话字段 | `pe.archOpen`（新） |
| 函数 | `peArch`、`peArchRow`、`peArchivedHTML`、`peArchFocus`、`peArchOrder`、`peRestore`、`pePurge`、`loadSampleDraft(fromEditor)`、纯函数段的 `planEmpty()` |
| 应用常量 | `T_PE_AR_*`、`T_PE_PG_*`、`T_PE_LIVE_PURGED`、`T_PE_EMPTY_TITLE`、`T_PE_EMPTY_BODY`、`T_PE_SAMPLE_BTN`、`T_PE_SAMPLE_LOADED`、`T_GOALS_NO_LIFTS`、`T_GOALS_NO_GROUPS`、`T_PE_GROUPS_EMPTY` |
| 测试设施 | `readEditor` 多返回 `archived: {present, open, summary, groups, tasks, lifts}` 和 `restoreDisabled`；strings.ts 的 `BTN_RESTORE`、`BTN_PURGE`、`toastRestored`、`PE_ARCH_*`、`PE_PURGE_*`、`BTN_PURGE_*`、`PE_RESTORE_LIMIT_*`、`PE_EMPTY_*`、`BTN_LOAD_SAMPLE`、`TOAST_SAMPLE_LOADED`、`GOALS_NO_*`、`WEEK_EMPTY_PLAN`、`PE_GROUPS_EMPTY` |

### 用例条数

- 新增 cloud 用例 **4 条**（`tests/cloud/plan-editor-archive.spec.ts`：Task 1 一条、Task 2 两条、Task 3 一条），默认套件没有新增。
- 完整 `npm run test:cloud` **225 条全部通过**（12-05 的 221 条加本计划 4 条，REPORT OK，flaky 0，unexpected 0）；完整默认套件 **193 条全部通过**（REPORT OK，flaky 0，unexpected 0，目标页和本周页的渲染改了，本地版不变）。

## Task Commits

1. **Task 1（tracer）：编辑页「已归档」区与恢复** - `f4e08a3`（feat）
2. **Task 2：彻底删除、恢复的上限、组与自定义待办同进同退** - `404f492`（feat）
3. **Task 3：空计划、本周说明、载入示例计划** - `0492da5`（feat）

**Plan metadata:** 见下一次 docs 提交

## Files Created/Modified

- `us-journey-tracker.html` - 编辑页「已归档」区的渲染、恢复、彻底删除和上限；目标页空计划卡片和说明行；本周页 #wkEmpty；loadSampleDraft；少量样式
- `tests/support/constants.ts` - 每个任务重新记录 APP_SHA256
- `tests/support/strings.ts` - 三批文案常量，逐字同步应用
- `tests/support/plan-editor.ts` - readEditor 多返回 `archived` 和 `restoreDisabled`
- `tests/cloud/plan-editor-archive.spec.ts` - 新，4 条 cloud 用例

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 恢复上限的说明行用了 `.pe-lim`，让 12-04 的上限用例多读到一行**
- **Found during:** Task 2 的第一次 cloud 运行（`plan-editor-groups.spec.ts` 的「the add buttons stop at 20 groups and 50 tasks」失败：`#pe-main .pe-lim` 多读到 `目标组已满（20 个），先删掉一个再恢复`）
- **Issue:** Task 1 里我给已归档区的说明行加了 `pe-lim` 类。12-04、12-05 的几条用例（`#pe-main .pe-lim`）用它读各分区的上限提示，已归档区里的行混进去后读数就变了。
- **Fix:** 改应用，不改那条用例（它不在本计划的文件清单里）：说明行改用 `.pe-arch-lim`，样式相同（12px、muted、整行）；本计划的用例按 `.pe-arch-lim` 读。重新记录 APP_SHA256。
- **Files modified:** `us-journey-tracker.html`、`tests/support/constants.ts`、`tests/cloud/plan-editor-archive.spec.ts`
- **Commit:** `404f492`

### 没有按计划原样执行的地方

- **Task 1 提交时「彻底删除」按钮已经渲染但没有接线：** 计划把按钮放在 Task 1、确认框放在 Task 2，所以 `f4e08a3` 里点它没有反应，`404f492` 才接上。这是计划自己的任务顺序，没有单独补一个提交。
- **用例的组织方式和计划描述略有不同（标题与要验证的行为不变）：** 上限用例用一个会话完成——19 个未归档组加两个归档组，恢复其中一个后组满、另一个的「恢复」disabled，删掉一个没有进度的组后可用、撤销移除后又 disabled；计划写的是“另一个账号的计划有 20 个组”，但每个用例只能 `app.open` 一次，所以没有开第二个账号。任务和力量项的上限在同一个计划里一起覆盖（第 1 组 50 项加一个归档任务，8 个力量项加一个归档的）。组 id 用 `g-gaz`、`g-gby` 而不是计划里的 `g-ga9`（避开 `syntheticPlan('ga', 19)` 自己的第 9 组）。
- **没有用到所有者预先批准的两项测试改动**（`readGroupIds` 和 SEC-01 的 `#goalsArch` 排除没有再次使用）。`details#pe-archived` 是新的应用自有 `details`：现有的两处注入检测（`escaping.spec.ts`、`plan-editor-groups.spec.ts` 的 `readInjection`）都在没有归档项的状态下运行，完整默认套件和完整 cloud 套件都通过，没有需要所有者另行决定的失败。若以后有用例在编辑页有归档项时跑注入检测，会被 `details:not(#goalsArch)` 当成外来元素，那时需要所有者决定。

**Total deviations:** 1 条自动修复（应用里的一个类名选择），2 条流程说明。

## Issues Encountered

- 工作区的应用文件是 CRLF（`core.autocrlf=true`）：改应用的脚本读入后统一成 LF 做替换，写回时用 CRLF，APP_SHA256 按工作区文件的字节记录（同 12-04、12-05）。测试文件在工作区是 LF。
- 一次想中止慢速测试的需求没有出现；三次套件（完整默认、完整 cloud、各任务子集）都自己跑完，没有并发。

## Known Stubs

无。

## Threat Flags

无新增的安全相关面。T-12-19：三种彻底删除都先经确认框（写明会丢失的内容，默认焦点在「不删除」，Esc 等同取消），确认后只改草稿，保存才生效，「放弃这次修改」可撤回，用例覆盖「不删除」和放弃两条撤回路径；T-12-20：保存清理只按保存前后计划的 id 差集，归档和恢复都不改 id，用例断言恢复的组里的任务和自定义待办的进度都还在、留下的归档任务的截止日期原样；T-12-21：载入示例时每个组、任务、力量项都换成 `g-`、`t-`、`l-` 加 `uid()` 的新 id（避开 `peUsedIds()`），用例断言没有 P 开头和示例力量 id；每处插值 `esc(...)`，确认框和 toast 只用 `textContent`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

归档、恢复、彻底删除三条路径和“删光计划”的界面已就绪。12-07 的 D-08 复查读 `pe.gone`（`task`、`group`、`lift` 三种，彻底删除的项不在里面）。12-08 的真实浏览器验收请所有者看：编辑页「已归档」区的折叠外观与长名称单行省略（含窄屏下按钮落到第二行、各占一半宽）、三种彻底删除确认框的措辞和红色按钮、上限时「恢复」旁边的说明、空计划卡片和本周说明在 375px 下的换行、载入示例计划之后的草稿外观。

## Self-Check: PASSED

- 文件存在：`tests/cloud/plan-editor-archive.spec.ts`、`12-06-SUMMARY.md` 在磁盘上，前者已提交。
- 提交存在：`f4e08a3`、`404f492`、`0492da5` 都在当前分支上；`git rev-list --count` 从 plan_head_before 到 HEAD 为 3。
- 验收：三个任务的 grep 门槛、五个锚点各一次、APP_SHA256 与文件一致、GATE_ALLOW 不含新按钮、migrate-backup 自检通过（59 项）、各任务 cloud 命令（6 条、15 条、8 条）与默认命令（7 条、7 条、50 条）REPORT OK 且含各任务标题（含 SAFE-02、GOAL-01、WEEK-02、PLAN-01 回落用例）、完整 cloud 225 条和完整默认 193 条 REPORT OK、暂存隐私检查三次通过。
