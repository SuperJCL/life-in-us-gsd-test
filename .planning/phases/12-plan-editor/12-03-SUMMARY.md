---
phase: 12-plan-editor
plan: 03
subsystem: plan-editor-shell-and-leave-rules
tags: [plan-editor, draft, route, beforeunload, confirmBox, busy, unreadable-plan, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-01 的 groupLabels、归档与空计划规则；12-02 的 activeLifts、归档区
  - phase: 10-sync
    provides: pendRemote、takeRemote、isBusy、maybeApplyView、renderKeep 的远端更新挂起规则
  - phase: 11-import-export
    provides: applyImport 整份替换计划的写法、计划留底包装（snapDownload）
provides:
  - 目标页「编辑计划」入口（#planEditBtn，只在云端有会话时渲染）和 #plan 路由，不加第五个标签
  - section#tab-plan 外壳：页头、粘性保存栏 #pe-bar、#pe-notice、#pe-unread、#pe-main、#pe-live；目标组折叠卡里的名称字段
  - 草稿 pe（计划的深拷贝）、planDirty、peBar、savePlanDraft（直接生效，写计划缓存并同步）
  - 离开的规矩：标签、返回键、放弃按钮三条路径先确认；beforeunload；退出登录的条件行；重新登录先确认；resetSession 收拾编辑页
  - confirmBox 的 okClass、scope 两个可选参数
  - 编辑页算“忙”：isBusy、无按钮的远端横幅、离开后应用挂起的更新
  - planRoute：刷新重开、本地版和未登录回到目标页
  - 账号的计划读不出来时：编辑页照常可用，保存先留本机留底再替换，留底存不下就不保存
affects: [12-04, 12-05, 12-06, 12-07, 12-08]

actuals:
  tokens: 12850
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "编辑页只由自己的函数渲染（renderPlanEditor），renderAll 的函数体里没有它；事件委托在 #tab-plan 上，输入就地写草稿、不整页重画"
    - "离开路径统一经 peLeave()，每处 await 之后核对 pe 还是同一个会话"
    - "保存直接生效：usePlan(normalizePlan(草稿)) → docs.plan.dirty、seq 加 1、cachePut(plan) → requestSync(save)，上传失败走现有脏标记加退避重试"

key-files:
  created:
    - tests/support/plan-editor.ts
    - tests/cloud/plan-editor.spec.ts
    - tests/e2e/goals/plan-entry.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts

key-decisions:
  - "pe 会话对象的字段：{draft, orig, base, from, open, seen, tried, gone, busy}；draft 是 plan 的深拷贝，orig 是打开时的 canon(plan)，base 是打开时的 docs.plan.base（12-07 的 D-07 判断用），from 是进来之前的标签键，open 是展开的卡片键 Set，seen/tried/gone 留给 12-04 和 12-07，busy 是保存中"
  - "「有没有未保存的修改」= canon(draft) !== orig；展开、折叠只改 pe.open，改了又改回原样不算修改"
  - "#plan 在未登录时（登录页可见）和本地版一样去掉 hash 回到目标页；刷新带 #plan 且会话有效时，对账结束后才打开（门控期间等待）"
  - "读不出来的账号计划（所有者 2026-11-11）：保存时 keepConflict(\"plan\", 本机计划缓存里服务器原样的那一份) 先成功，才写计划；写不进留底就 toast 说明并整个不保存"

requirements-completed: [PLAN-04, PLAN-02]

coverage:
  - id: D1
    description: "目标页「编辑计划」进入 #plan，改组名并保存，服务器和另一台设备都按新名称显示，组和任务的 id 不变"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 a group renamed in the plan editor is saved to the server and another device shows the new name (D-10)"
        status: pass
    human_judgment: true
    rationale: "粘性保存栏、折叠卡的外观、窄屏和深色主题下的样子没有用例断言，需要人看一眼（12-08 的真实浏览器验收）"
  - id: D2
    description: "切换标签、返回键、放弃按钮在有修改时先确认，没有修改时直接离开；beforeunload；退出登录和重新登录先问，拒绝后草稿原样"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 leaving the plan editor with unsaved changes asks first from a tab, the back button and the discard button, and leaves at once without changes (D-09, A7)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 closing the page with unsaved plan changes raises the browser leave prompt (D-09)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 logout and re-login from the plan editor with unsaved changes ask first (D-09, D-12)"
        status: pass
    human_judgment: false
  - id: D3
    description: "编辑页打开期间远端更新挂起（无按钮横幅，草稿不变），离开后应用；刷新重开新草稿；上传失败重试只落一次"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 a remote change that arrives while the plan editor is open waits with the no-button banner and is applied after leaving (S9)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 a reload on #plan in the cloud version opens a fresh draft after the reconcile (A19)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 a saved plan whose upload fails is retried and reaches the server once"
        status: pass
    human_judgment: false
  - id: D4
    description: "账号的计划读不出来时编辑页可用并说明，保存先把服务器上那份存成本机留底（可下载）再替换；留底存不下就不保存"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 an unreadable account plan is kept here as a downloadable copy before the editor replaces it (owner decision)"
        status: pass
    human_judgment: true
    rationale: "提示句 T_PE_UNREAD、T_PE_UNREAD_NOKEEP 和保存后的 toast 是按 UI-SPEC 语气新写的文案，不是所有者定的原文，12-08 的真实浏览器验收里请所有者过目"
  - id: D5
    description: "本地版（不登录）没有「编辑计划」入口，#plan 回到目标页，不弹提示"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "tests/e2e/goals/plan-entry.spec.ts#PLAN-02 the local version shows no plan editor entry and #plan shows the goals view (D-13)"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-11-12
status: complete
plan_head_before: d444ecd463e8c0ada64c3f948276291a8531be02
plan_head_after: d89eb05e029c7fbc7aabf84b0e9bdd60b1619757
commits: 3
---

# Phase 12 Plan 03: 编辑页骨架、离开的规矩、与同步的配合 Summary

**目标页「编辑计划」进入 #plan，在折叠卡里改目标组名称，点「保存计划」直接生效并同步到另一台设备；草稿只在页面开着时存在，三条离开路径、退出、重新登录都先问，编辑期间远端更新挂起不碰草稿，账号的计划读不出来时保存先留本机底再替换。**

## Performance

- **Duration:** 约 28 min
- **Started:** 2026-11-12T00:18Z（约）
- **Completed:** 2026-11-12T00:46Z
- **Tasks:** 3（Task 1 为 tracer）
- **Files modified:** 7（三个新文件）

## Accomplishments

- **Tracer（Task 1）：** 入口 → `#plan` → 外壳 → 草稿 → `savePlanDraft` → 回到目标页 → 另一台设备显示新名称，一次通过。tracer 的 verify（cloud 的 plan-editor 与 multi-device、默认套件的 app-integrity、goals、security）重跑通过，记为“Tracer verified end-to-end — expanding”，再做 Task 2、3。
- **pe 会话对象：** `{draft, orig, base, from, open, seen, tried, gone, busy}`，声明在 `let pendRemote…` 那一行之后（避免 setStatus 等早期调用碰到暂时性死区）。`seen`、`tried`、`gone` 目前没有人写，留给 12-04（校验）和 12-07（直接移除的项）。
- **路由和离开的调用关系：**
  - 进入：`#planEditBtn` 点击（`#goals` 的 click 监听）→ `goPlan()`（门控、没有 me 或 docs.plan 时什么都不做）→ `history.pushState(null,"","#plan")` → `openPlanEditor(当前标签键)`。
  - 刷新或直接打开 `#plan`、手动改 hash：hashchange（hash 为 `#plan`）或 init、showLogin 末尾、reconcileOnce 收尾 `renderAll()` 之后、goBootOffline 的 `renderAll()` 之后 → `planRoute()`：云端、有 me 和 docs.plan、登录页隐藏、没有门控 → `openPlanEditor("goal")`（不再 pushState）；云端门控中就等；本地版和未登录 → `replaceState` 去掉 hash 并 `showTab("goal")`，不弹提示。
  - 离开：nav.tabs 点击、`#pe-discard`、hashchange（hash 不再是 `#plan`）三条路径都先 `peLeave()`（没有修改直接 true，否则 `confirmBox({scope:"plan"})`），true 才 `closePlanEditor(标签键)`；返回键被拒绝时 `pushState(null,"","#plan")` 恢复地址栏。
  - `closePlanEditor(tab)`：pe 置 null、清 `#pe-main`、隐藏 `#pe-notice` 和 `#pe-unread`、hash 是 `#plan` 时 `replaceState`、`showTab`、`renderAll`、回目标页时焦点给 `#planEditBtn`（没有就给 `#goals`）、最后 `if(remoteView)maybeApplyView()`。
  - `resetSession()`：记下编辑页是否开着，pe 置 null，清空并隐藏编辑页，去掉 `#plan`，原来开着就 `showTab("goal")`。
- **`savePlanDraft` 的步骤顺序（12-04、12-06、12-07 在这里插入）：** ① pe 为空、busy、没有修改则返回；busy 置真 + `peBar()` → ② 并入挂起的远端版本（`takeRemote()` + `renderKeep()`）→ ③ `normalizePlan(草稿)`，为 null 则 busy 置假返回（**12-04 的校验放在 ③ 之前，12-07 的“计划被改过”三选一放在 ② 之后、③ 之前，D-08 询问框和容量检查接着排，读不出来的计划留底排在容量检查之后、写入之前**）→ ④ `keepOrphans` 仍为真时先 `keepConflict("plan", …)`，失败就 toast `T_PE_UNREAD_NOKEEP` 并返回 → ⑤ `usePlan(np); keepOrphans=false; docs.plan.dirty=true; docs.plan.seq++; cachePut("plan",…)`（失败 `cacheNote(false)`）→ ⑥ `showSync(); requestSync("save")` → ⑦ `closePlanEditor("goal")` → ⑧ toast（读不出来的计划那一路是 `snapShow()` + 带「下载留底」的 8000 ms toast + `snapTold()`）。**12-06 的状态清理（归档、彻底删除）在 ⑤ 之后用 `commit([...],fn)` 做。**
- **属性和字段键的格式：** `data-peact`（按钮动作，现有 `toggle`）、`data-pekey`（卡片键 `g:<组 id>`）、`data-pecat`（12-05 的预设类别，现在没人写）、`data-pefield`（字段键 `g:<组 id>:name`，用 `:` 拆分；id 不含 `:`）。元素 id：`pe-b-g-<id>`、`pe-n-g-<id>`、`pe-f-g-<id>-name`。
- **confirmBox：** 新增可选 `okClass`（`"primary"` 时确认按钮用 `.primary`，缺省 `danger`）和 `scope`（`"plan"` 时给 `dialog#confirm` 加 `pe`），都在 close 监听里恢复；现有调用不传，行为和外观不变（默认套件和 cloud 套件里的退出、换账号、导入、撤销用例全部通过）。`mid`（三选一）留给 12-07。
- **忙与横幅：** `isBusy` 第一行 `if(pe)return true;`；`maybeApplyView` 忙时在编辑页开着时显示无按钮的 info 变体 `T_REMOTE_PE`，`sbs.remote.pe` 记着是哪一种，进出编辑页时横幅跟着换；`setStatus` 末尾 `if(pe)peBar()`；`GATE_BLOCK` 加 `[data-peact]`，`#planEditBtn` 不在 `GATE_ALLOW`。
- **用例条数：** 完整 `npm run test:cloud` 为 **209 条，全部通过**（HEAD 196 + 12-01 的 2 条 + 12-02 的 3 条 + 本计划 8 条，REPORT OK，flaky 0，unexpected 0，≥ 209）。完整默认套件 **191 条全部通过**（HEAD 190 + 本计划 1 条）。

## Task Commits

1. **Task 1（tracer）：入口、#plan 路由、草稿、savePlanDraft、改组名同步到另一台设备** - `f312ff5`（feat）
2. **Task 2：离开的规矩、beforeunload、退出和重新登录、confirmBox 的 okClass 与 scope** - `4320774`（feat）
3. **Task 3：忙、无按钮横幅、planRoute、读不出来的账号计划先留底** - `d89eb05`（feat）

**Plan metadata:** 见下一次 docs 提交

## Files Created/Modified

- `us-journey-tracker.html` - 编辑页外壳、CSS 骨架、pe 与编辑页函数、离开规则、isBusy 和横幅、planRoute、读不出来的计划留底
- `tests/support/constants.ts` - 每个任务重新记录 APP_SHA256
- `tests/support/strings.ts` - 三批文案常量，逐字同步应用
- `tests/support/plan-editor.ts` - 新，编辑页 helper（openEditor、card、expand、field、act、savePlan、discardPlan、readEditor）
- `tests/cloud/plan-editor.spec.ts` - 新，8 条 cloud 用例
- `tests/e2e/goals/plan-entry.spec.ts` - 新，1 条默认套件用例

## Decisions Made

见 frontmatter 的 key-decisions。另：

- 入口按钮在 `renderGoals` 里随 `CLOUD&&me` 渲染（本地版整行不输出，D-13）。
- `#pe-bar` 的两个按钮另加 `flex:none;white-space:nowrap`（UI-SPEC 说“按钮不换行”，CSS 骨架里没有这一行）。
- 读不出来的计划留底取本机计划缓存里服务器原样的那一份（reconcileOnce 把读不出来的计划按服务器原样放进计划缓存）；留底只含计划本身，对应的任务进度按 Phase 7 的规则在下一次加载时丢弃（计划里已写明，与导入只含计划的文件相同）。

## Deviations from Plan

### 计划内的小调整（没有触碰计划之外的测试，也没有放宽断言）

**1. [Rule 2 - 缺失的必要行为] planRoute 把“登录页可见”也当作未登录，并在无效后端配置的分支里也调用**
- **Found during:** Task 3
- **Issue:** 计划只写“云端没有 me 时去掉 hash”。但 enterApp 失败时 `showLogin(ERR_NET)` 被调用时 `me` 可能已设置（缓存还在），此时只看 `me` 和 `docs.plan` 会在登录页后面打开编辑页；init 里“存储配置无效”的分支也是本地式的，会留着 `#plan`。
- **Fix:** `planRoute` 的条件多一项 `$("login").classList.contains("hidden")`；该分支也调用 `planRoute()`。
- **Files modified:** `us-journey-tracker.html`
- **Commit:** `d89eb05`

**2. [Rule 1 - 用例自己的问题] 上传失败重试用例不能在保存之后先推进时钟**
- **Found during:** Task 3 的第一次运行（用例失败，应用没问题）
- **Issue:** 保存不经防抖，请求立刻发出；我按 IO-08 的写法先 `runFor(1_000)`，结果被拒之后的 1 秒退避重试在同一次推进里就成功了，缓存已经不脏。
- **Fix:** 保存之后先等 `fault.hits` 为 1（真实时间），时钟保持暂停，核对缓存仍脏，再推进时钟到重试。
- **Files modified:** `tests/cloud/plan-editor.spec.ts`
- **Commit:** `d89eb05`

### 额外验证（不是偏差）

- 除计划要求的子集外，我多跑了一遍完整默认套件（191 条全部通过），因为 `confirmBox`、`isBusy`、`setStatus`、`resetSession` 是共用代码。没有为此改动任何其他文件。

**Total deviations:** 2（都是计划内小调整，没有所有者决定的使用）
**Impact on plan:** 没有放宽任何断言，没有改动计划之外的测试文件；本计划没有用到所有者预先批准的两项测试改动（readGroupIds、SEC-01 的 `#goalsArch` 排除），也没有新增应用自有元素冲突到 SEC-01 的检测器（`#tab-plan` 里没有被检测的标签）。

## Issues Encountered

- 第一次同时写字符串、测试和应用改动的 Bash 命令里 heredoc 引号解析出错，整条命令没有运行；之后改用 Write 工具写脚本文件再运行。没有影响结果。
- Task 3 的上传失败用例见上面的偏差 2。

## Known Stubs

无。`pe.seen`、`pe.tried`、`pe.gone`、`data-pecat` 是为后续计划预留的字段或属性，目前没有界面把空值显示出来。

## Threat Flags

无新增的安全相关面。T-12-07：`isBusy` 在编辑页打开时为真，`renderAll` 的函数体里没有 `renderPlanEditor`（verify 的 grep），远端用例证明草稿输入框的值不变；T-12-08：三条离开路径、退出、重新登录都先经 `planDirty`，每个 await 之后核对会话；T-12-09：每处插值 `esc(...)`，卡片名称就地更新只用 `textContent`，SEC-01 源码门槛和页面用例在默认套件里通过；T-12-10：`planRoute` 只做全等比较；T-12-11：`[data-peact]` 在 `GATE_BLOCK`，入口不在 `GATE_ALLOW`；T-12-27：读不出来的计划先留底、留底失败不保存，两条路径都有用例。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

外壳、草稿、保存、离开规则、与同步的配合都已就绪。12-04 在同一外壳里加目标组和任务的增改、排序、移除与校验（校验放在 `savePlanDraft` 的 ③ 之前）；12-07 在 ②③ 之间加“计划在别的设备上改过了”的三选一，并给 `confirmBox` 加 `mid`。12-08 的真实浏览器验收里请所有者看一眼：保存栏和折叠卡的外观（窄屏、深色主题），以及三句新文案（`T_PE_UNREAD`、`T_PE_UNREAD_NOKEEP`、`T_PE_SAVED_UNREAD`）。

## Self-Check: PASSED

- 文件存在：`tests/support/plan-editor.ts`、`tests/cloud/plan-editor.spec.ts`、`tests/e2e/goals/plan-entry.spec.ts` 都在磁盘上并已提交。
- 提交存在：`f312ff5`、`4320774`、`d89eb05` 都在当前分支上。
- 验收：三个任务的 grep 门槛、五个锚点各一次、`.tag{` 恰好一条、APP_SHA256 与文件一致、cloud 命令（3 条、23 条、完整 209 条）REPORT OK 且含各任务标题、默认子集（33 条、7 条、24 条）和完整默认套件 191 条 REPORT OK（含 SAFE-02 和 SEC-01）、暂存隐私检查三次通过。
