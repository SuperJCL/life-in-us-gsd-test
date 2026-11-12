---
phase: 12-plan-editor
plan: 07
subsystem: plan-editor-concurrency-and-save-gates
tags: [plan-editor, conflict, three-choice, kept-copy, d08, offline, expired, capacity, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-03 的 pe 会话（base、busy）、savePlanDraft 的步骤顺序、confirmBox（okClass、scope）、读不出来的计划先留底；12-04、12-05 的 pe.gone 与 planProblems；12-06 的差集清理
  - phase: 09-cloud-sync
    provides: keepConflict、snapShow、snapTold、snapDownload（计划留底包装）、conflictNotice、showTooLarge、sizeOf、CLOUD_MAX
  - phase: 10-sync
    provides: takeRemote、pendRemote、adoptPlanTab、syncOnce 的挂起槽规则
provides:
  - confirmBox 的第三个按钮（mid，返回 "mid"）、#cfMid、.ed-foot.three
  - peRemote 与 #pe-notice：编辑期间别的设备或同一浏览器另一个标签页保存了计划时，草稿不动，提示行和横幅告知
  - 保存时的三选一（回去继续改 / 放弃我的修改，用新版 / 用我的覆盖）；覆盖前把被盖掉的那一版按计划留底包装存在本机并可下载
  - D-08：草稿里直接移除的项在别的设备上刚有了进度时，保存前一个框列出，全部归档 / 连进度一起删
  - 保存按钮在断网、过期时 aria-disabled（D-11、D-12）；4 MB 容量检查；提示行七级优先级
affects: [12-08]

actuals:
  tokens: 10400
  tasks: 3
  commits: 3
plan_head_before: 0ef14746c0a3e2fe691da19aad3a9604889a5793
plan_head_after: 7d5e8bb180ff2113234d4bddc19098fee2e53c9c

tech-stack:
  added: []
  patterns:
    - "判断“被改过”用打开时记下的版本 pe.base 加内容比较（canon(现在的计划) !== pe.orig），不用被挂起槽前移的 docs.plan.base；版本变了而内容相同不算"
    - "savePlanDraft 变成 async，每处 await 之后用 live()（pe 与 sessionEpoch 都没变）核对会话"
    - "留底（读不出来的计划、用我的覆盖）都排在容量检查之后、写入之前，容量不够时两种留底都不会先写下"

key-files:
  created:
    - tests/cloud/plan-editor-sync.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/confirm.ts
    - tests/cloud/plan-editor.spec.ts

key-decisions:
  - "peRemote 在 syncOnce 的 finally（而不是只在 gotRemote 之后）和 adoptPlanTab 末尾调用：计划进了挂起槽之后同一遍里后面的步骤抛错时，下一遍不会再有 gotRemote，只放在 gotRemote 之后会漏掉提示"
  - "D-08 询问框之后再并入一次挂起版本；没有选过覆盖而计划又被改过，就回到编辑页（提示出来），下次点保存再按三选一问，不在两个对话框之间悄悄覆盖"
  - "全部归档放回任务时，如果它所属的组也被直接移除了，就把那个组一起放回（archived），否则保存时的差集清理会删掉这个任务的进度"
  - "tooLarge 横幅只在 state 和计划本身都没超限时才由编辑页收起（state 超限的横幅归同步所有）"

requirements-completed: [PLAN-04]

coverage:
  - id: D1
    description: "编辑期间另一台设备保存了计划：草稿不动，提示行和 #pe-notice 告知，内容相同不算改过；点保存弹三选一，三个按钮的顺序、样式和默认焦点；回去继续改什么都不变"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts#PLAN-04 a plan saved on another device while the editor is open leaves the draft unchanged, shows the notice and asks on save (D-07)"
        status: pass
    human_judgment: true
    rationale: "三选一对话框在 375px 下三个按钮竖排全宽、#cf-body 的 50vh 滚动、#pe-notice 的外观没有用例断言（12-08 真实浏览器验收）"
  - id: D2
    description: "用我的覆盖：被盖掉的那一版在本机留底（计划类型、可下载为只含计划的备份文件）；放弃我的修改，用新版：草稿丢弃、回目标页、这台设备不上传计划"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts#PLAN-04 overwriting the other device's plan keeps it here as a downloadable plan kept copy, and taking the new version discards the draft (D-07, A14)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-08：草稿里移除的项在别的设备上刚有了进度时，保存前一个框列出（最多 8 段加「还有 n 项」），全部归档保留进度，连进度一起删清掉进度，没有这种项不弹"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts#PLAN-04 items removed in the draft that gained progress on another device are listed before saving and can be archived or deleted with their progress (D-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "断网和登录过期时保存按钮 aria-disabled（没有 disabled、能聚焦、aria-describedby 指向提示行），点击和 Enter 只弹同一句 toast，草稿和服务器计划不变，联网后恢复"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts#PLAN-04 the save button is unavailable offline and with an expired login and the draft stays (D-11, D-12)"
        status: pass
    human_judgment: false
  - id: D5
    description: "计划超过 4 MB 时不保存、不上传，提示行和容量超限横幅说明，留在编辑页；删到不超限后能保存且横幅收起"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts#PLAN-04 a plan over the cloud limit is not saved and the editor says so"
        status: pass
    human_judgment: true
    rationale: "最长的容量超限提示在 375px 下换到 3 行、保存栏随之长高、按钮垂直居中没有用例断言（12-08 验收）"
  - id: D6
    description: "同一浏览器另一个标签页保存了计划时，这个标签页的编辑页同样出现提示，点保存仍走三选一"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor-sync.spec.ts#PLAN-04 a plan saved in another tab of the same browser shows the notice in this tab's editor"
        status: pass
    human_judgment: false

duration: 约 35min（含完整 cloud 套件两次，每次约 7 分钟）
completed: 2026-11-12
status: complete
commits: 3
---

# Phase 12 Plan 07: 两台设备同时改计划、断网过期容量时的保存 Summary

**编辑期间别的设备或另一个标签页保存了计划时，草稿不动、提示行和 #pe-notice 告知，点保存先三选一（覆盖时被盖掉的那一版在本机留底可下载，用新版时丢草稿不上传）；草稿里移除的项刚在别处有了进度时保存前一个框问归档还是连进度一起删；断网、过期时保存按钮 aria-disabled，超过 4 MB 不保存。**

## Performance

- **Duration:** 约 35 min（开始 02:50 UTC，结束约 03:30 UTC）
- **Tasks:** 3（Task 1 为 tracer，一次通过，记为“Tracer verified end-to-end — expanding”）
- **Files modified:** 6（一个新文件）
- **实际规模：** 三个提交合计新增约 41.7K 字符（chars/4 约 10.4K），估计 115K 差得很远；没有拆分计划。

## Accomplishments

- **Task 1（tracer）：** `confirmBox` 加可选 `mid`：`<dialog id="confirm">` 里 `#cfMid`（缺省 hidden），有 `mid` 时 `.ed-foot` 加 `three` 类、点它返回 `"mid"`、close 时恢复；没有 `mid` 的现有调用不变。`peRemote()` 用 `pe.base` 和内容比较判断，显示 `#pe-notice` 和提示行；`savePlanDraft` 在 takeRemote 之后弹三选一。覆盖时 `keepConflict("plan", 工作计划深拷贝)` 在写入之前，成功则 toast `T_PE_SAVED_KEPT` 带「下载留底」（8000 ms），存不下则 `conflictNotice(false)` 加 `计划已保存`。
- **Task 2：** `peGoneHit` 按最新 state 判断 `pe.gone` 的项（任务已完成或设了截止日期，组的三项统计之和大于 0，力量项有历史）；一个框列出至多 8 段加 `还有 {n} 项`；全部归档由 `peArchiveGone` 放回草稿并写 `archived:true`；连进度一起删由已有的差集清理处理。
- **Task 3：** `peBlock()` 与 `peBar` 的七级优先级；过期或断网时保存按钮 `aria-disabled`（`disabled` 仅在 busy 时），`savePlanDraft` 开头 toast 同一句并返回；容量检查 `sizeOf(np)>CLOUD_MAX` 置 `pe.tooLarge`、`showTooLarge()`、留在编辑页；两种留底都排在容量检查之后。
- **savePlanDraft 最终顺序：** busy 检查 → 过期/断网拦截 → 没有修改则返回 → 校验（planProblems）→ busy 置真、takeRemote → 三选一（仅当 `peChanged()`；`"mid"` 用新版并返回，`true` 覆盖再并入一次）→ D-08 复查与询问框（询问之后再并入一次，没有覆盖而计划又变则回编辑页）→ `normalizePlan(草稿)` → 4 MB 容量检查 → 读不出来的计划先留底 → 覆盖留底 → 写计划（usePlan、dirty、seq、cachePut）→ id 差集清理 → showSync、requestSync → closePlanEditor → toast。
- **peBar 七级优先级：** 登录已过期 > 断网/连不上（data-state 为 offline、retrying、unreachable、slow）> 容量超限 > 校验错误 > 别的设备改过 > 有没保存的修改 > 还没有修改。
- **peRemote 的调用点：** `syncOnce` 的 `finally`（仅当会话没变）和 `adoptPlanTab` 末尾；另外 `openPlanEditor` 渲染后调用一次（打开时总是假）。
- **留底写入的时机：** 容量检查通过之后、写入计划之前。
- **用例条数：** 完整 `npm run test:cloud` 为 **231 条，全部通过**（REPORT OK，flaky 0，unexpected 0；209 + 7 + 5 + 4 + 本计划 6）。tests/cloud/plan-editor-sync.spec.ts 6 条：Task 1 两条、Task 2 一条、Task 3 三条。

## Task Commits

1. **Task 1（tracer）：三选一、留底、用新版、peRemote 与第三个按钮** - `bd8ed15`（feat）
2. **Task 2：D-08 复查与询问框** - `b45d042`（feat）
3. **Task 3：断网、过期、容量与另一个标签页** - `7d5e8bb`（feat）

## Deviations from Plan

### 所有者已批准

**1. [所有者批准 2026-11-11] plan-editor.spec 的 PLAN-04 退出/重新登录用例改为期待过期提示**
- **Found during:** Task 3 的完整 cloud 套件（231 条里 1 条失败，其余 230 条通过）
- **Issue:** `tests/cloud/plan-editor.spec.ts` 里该用例在登录已过期之后断言提示行为「有没保存的修改」，与本计划要求的 D-12 过期提示矛盾。该文件不在本计划列出的文件里，我先停下报告，所有者回复“改成新提示”。
- **Fix:** 只改「先不登录」之后的那一处断言，`PE_HINT_DIRTY` 改为 `PE_HINT_EXPIRED`，并导入它；过期之前的 `PE_HINT_DIRTY` 断言不动。
- **Files modified:** `tests/cloud/plan-editor.spec.ts`
- **Commit:** `7d5e8bb`

### 计划内的小调整

**2. [Rule 2] peRemote 同时放在 syncOnce 的 finally 里**（计划写在 gotRemote 之后）：避免计划进了挂起槽之后后面步骤抛错、下一遍没有 gotRemote 时漏掉提示。Commit `bd8ed15`。

**3. [Rule 2] D-08 询问框之后再并入一次挂起版本**，没有选过覆盖而计划又被改过就回到编辑页：防止在两个对话框之间悄悄覆盖对方。Commit `b45d042`。

**4. [Rule 2] 全部归档时所属组也被直接移除就一并放回**：否则差集清理会删掉该任务的进度。Commit `b45d042`。

**5. [Rule 2] 编辑页自己显示的容量超限横幅由 `peClearTooLarge()` 收起**，只在 state 和计划都不超限时；离开编辑页和保存成功都会调用。Commit `7d5e8bb`。

**6. [测试写法] aria-disabled 的按钮在 Playwright 看来“不可用”**，断网和过期用例的点击用 `{ force: true }`；按 Enter 的那一步先手动收起上一条 toast，免得分不清。Commit `7d5e8bb`。

**7. [测试 helper] `readConfirm` 多返回 `buttons` 和 `focused`**（计划要求），`confirmMid` 新增；现有调用只读 `lines`、`title`，全部通过。Commit `bd8ed15`。

没有用到所有者预先批准的两项测试改动（readGroupIds、SEC-01 的 `#goalsArch` 排除）。

**Total deviations:** 1 条所有者批准的测试改动，5 条计划内小调整，1 条测试写法说明。
**Impact on plan:** 没有放宽断言；唯一一处既有测试的改动是上面所有者批准的那一行。

## Issues Encountered

- 两次含多个 heredoc 的 Bash 命令因引号解析失败、没有运行，之后改用 Write 工具写脚本和测试片段再运行，没有影响结果。
- 应用文件在本机工作区是 CRLF（git 里是 LF，`APP_SHA256` 记录的是工作区哈希），用保留 CRLF 的脚本编辑，基线保持一致。

## Known Stubs

无。

## Threat Flags

无新增的安全相关面。T-12-22：用打开时的版本加内容判断被改过，必须经三选一，覆盖前留底（存不下时显示「留底没存上」横幅），cloud 用例覆盖三个出口；T-12-23：保存前 takeRemote 后复查 `pe.gone`，命中就弹 D-08，用例覆盖归档、删除、不弹；T-12-24：写入前 `sizeOf` 检查，超限不写不上传；T-12-25：断网、过期时保存按钮 aria-disabled 加提示行和 toast，用例证明服务器计划没变。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

保存流程的五步已完整走通。12-08 的真实浏览器验收请所有者看：三选一和 D-08 对话框在 375px 下三个按钮竖排全宽的样子、`#pe-notice` 横幅、最长的容量超限提示换行后保存栏的高度，以及新写的文案（`T_PE_D8_*` 的措辞、`计划已保存，别的设备上的那一版已在本机留底`）。

## Self-Check: PASSED

- 文件存在：`tests/cloud/plan-editor-sync.spec.ts` 在磁盘上并已提交。
- 提交存在：`bd8ed15`、`b45d042`、`7d5e8bb` 都在当前分支上。
- 验收：三个任务的 grep 门槛、五个锚点各一次、APP_SHA256 与文件一致、cloud 命令（29 条、15 条、完整 231 条）REPORT OK 且含各任务标题（完整套件 expected=231、flaky 0、unexpected 0）、app-integrity 每个任务 REPORT OK（含 SAFE-02）、暂存隐私检查三次通过。
