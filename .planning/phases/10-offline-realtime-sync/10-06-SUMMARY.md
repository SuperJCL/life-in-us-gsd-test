---
phase: 10-offline-realtime-sync
plan: 06
subsystem: sync
tags: [pull-baseline, pending-slot, isBusy, applyView, takeRemote, docAfter, d-04, d-05, d-06, visibilitychange, playwright, fake-pocketbase]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-01 的 requestSync/syncOnce/showSync/net；10-03 的 cfShown 与 IN-01 规则；10-04 的 commit(keys, run)、ops、幂等 run；10-05 的 goExpired、WRITER；Phase 9 的 SB_ORDER 里的 remote 横幅位"
provides:
  - "60 秒拉取（pollTick）、visibilitychange 与 online 立即对账，全部汇到 requestSync"
  - "挂起槽 pendRemote、takeRemote()、docAfter()、normUnder()、remoteDiffers()：远端版本不进工作 state 和 plan，直到空闲或本机操作"
  - "isBusy(next?)、maybeApplyView()、applyView(fromCommit)、renderKeep()：忙碌时 info 横幅加“现在更新”，空闲或点按钮时应用并保留草稿和输入"
  - "D-04：commit 先 takeRemote 再执行这一个本机操作；D-06：编辑弹窗保存被删记录时按同一个 id 加回并提示"
affects: [10-07, 10-08, 10-09]

actuals:
  tokens: 10800
  tasks: 2
  commits: 3
plan_head_before: d97a5918d79e813110bef4b4c09abe82cff702fc
plan_head_after: 495ddb4b1feeb53c442481db61a9458a4dab4690

tech-stack:
  added: []
  patterns:
    - "远端版本进挂起槽，工作 state 只经 takeRemote() 一个入口改变；所有渲染函数照旧只读工作 state，所以局部重绘（时间线筛选、日历今天、力量校验失败）读不到挂起的内容"
    - "上传和 state 缓存一律经 docAfter()：槽里有服务器 state 时 = 服务器版本加 ops 里每个 run 重做一遍；槽为空时就是当前 state"
    - "applyView 由 commit 触发时，提示延后一个微任务，留在屏幕上的是更新提示而不是处理函数自己的“已记录”"

key-files:
  created:
    - tests/cloud/remote-update.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts

key-decisions:
  - "轮询只在没有别的同步在做时才拉：net 为 ok、没有同步在跑、没有待保存、本机不脏时才 requestSync(\"poll\")；有待保存的修改、重试倒计时、离线都各自会对账，不需要再叠一次（否则登录后第一个 60 秒轮询会落进既有用例的第一次 runFor，多出一次请求）"
  - "commit 里的 takeRemote 与 applyView 提前到任务 1：挂起槽一旦存在而 commit 不先并入，本机修改会落在旧基线上、再带着新基线上传，等于覆盖远端；所以任务 1 的提交里就必须有"
  - "applyView 在画任何东西之前先把 remoteView 置假：点“现在更新”后按钮被移除会立即触发 focusout，处理函数必须发现没有东西可应用，否则 drawBar 重入并抛异常"
  - "isBusy 的焦点判断只认文字输入元素（textarea，type 为 text、number、date、search、email、tel、url、password 或无 type 的 input），复选框和按钮不算"
  - "docs.plan/docs.state 的基线和缓存在挂起时就写成服务器版本（干净），挂起期间刷新页面直接显示新内容，不会把旧内容配上新基线"

patterns-established:
  - "拉取与实时订阅同走 syncOnce 的远端分支；10-08 的订阅只是让同一条路径提前几秒发生"
  - "结束忙碌的本机操作 = commit(keys, run)：先 takeRemote、再 run、再 persist、最后 applyView(true)"

requirements-completed: [SYNC-02, SYNC-03]

coverage:
  - id: D1
    description: "设备二空闲：下一次拉取后，设备一的记录出现在对应视图并弹“已更新为其他设备上的最新内容”，没有横幅，周范围和时间线筛选保持不变"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 a change from another device is applied at the next poll when this device is idle"
        status: pass
    human_judgment: false
  - id: D2
    description: "设备二忙碌（草稿且焦点在文本框）：info 横幅加唯一按钮“现在更新”，草稿和焦点不变；横幅期间时间线筛选和日历“今天”两次局部重绘都画不出新记录；清空草稿并离开文本框后立即应用"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 a remote change waits with a notice while this device is busy and is applied once it is idle"
        status: pass
    human_judgment: false
  - id: D3
    description: "页面重新可见（visibilitychange）和重新联网（online）时立即对账，时钟不推进"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-03 coming back online or to the foreground reconciles at once"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-04：挂起期间发出草稿、编辑弹窗保存同一条、复盘防抖到期、保存力量值、修改开始日期，服务器同时保留两边的修改，没有留底，留在屏幕上的是更新提示"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 finishing an action while a remote change waits applies it first and keeps both edits (D-04)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-06：被另一台设备删除的记录在编辑弹窗里点保存，以同一个 id 和编辑框文字加回并弹所有者确认的文案；点删除不提示，远端更新直接应用"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 saving a record that another device deleted adds it back with the same id and says so (D-06)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-05：点“现在更新”后两个 composer 的草稿文字和选中的类别都保留，新记录显示"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 update now applies the waiting change and keeps both drafts and their categories (D-05)"
        status: pass
    human_judgment: false
  - id: D7
    description: "旧路径和 Phase 9、10 既有行为不变：app-integrity（含 SAFE-02）、storage、smoke 22 条通过；完整 test:cloud 143 条通过、无 flaky"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "npm test（默认配置，workers=1，BELOW_NORMAL）app-integrity、storage、smoke：REPORT OK expected=22；npm run test:cloud：REPORT OK expected=143"
        status: pass
    human_judgment: false
  - id: D8
    description: "加预设输入框、待办输入框里未保存内容在“现在更新”后保留：renderKeep 实现了，但没有专门用例；复盘先提交再应用的 applyView 分支只经 D-04 的复盘防抖路径间接覆盖"
    requirement: "SYNC-02"
    verification: []
    human_judgment: true
    rationale: "计划的行为描述只要求两个 composer 的草稿和类别；加预设、待办、力量输入框的保留靠代码审阅，没有断言"

duration: 约 55min（未在开始时记录时间，按提交时间和会话估计）
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 06: 远端更新先挂起、空闲再应用 Summary

**服务器上的新版本先放进挂起槽 pendRemote，不碰工作 state 和计划：用户空闲时（或点“现在更新”）才经 takeRemote 并入并整页重绘、保留草稿和输入；忙碌时只显示 info 横幅；结束忙碌的本机操作先并入远端再按 id 执行（D-04）；被别处删掉的记录按编辑框内容以同一个 id 加回并提示（D-06）；60 秒拉取、回到前台和重新联网都汇到 requestSync。**

## Performance

- **Duration:** 约 55 min
- **Started:** 约 2026-11-10T07:50Z（未记录，估计）
- **Completed:** 2026-11-10T08:44Z
- **Tasks:** 2（任务 2 按 TDD 拆成 RED 与 GREEN 两个提交）
- **Files modified:** 4（应用 1、支撑文件 2、cloud 用例 1 个新建）

## Accomplishments

### isBusy 的完整条件

任一为真即忙：`dlg.open`（编辑弹窗）、`cfDlg.open`（确认框）、`rvPending`（复盘防抖未到期）、`#w-text` 或 `#c-text` 去空白后非空、`compAdding.w` 或 `compAdding.c`（加预设的输入框打开）、焦点（或 focusout 传进来的 `relatedTarget`）在 `.wrap` 里的文字输入元素上（textarea，或 type 为 text、number、date、search、email、tel、url、password、无 type 的 input；复选框和按钮不算）、存在未隐藏的 `[data-liftsave]`、任一 `[data-addto]` 去空白后非空。

### 挂起槽、takeRemote、docAfter 的规则与全部调用点

- `pendRemote={plan,state}`，各为 `{data,updated}` 或 null，后来的服务器版本替换先来的。syncOnce 的远端分支只写槽：计划槽同时把 `docs.plan` 的基线和缓存写成服务器版本（干净），state 槽同时把 `docs.state.base`、`touched=[]` 和缓存写成服务器版本（按槽里的计划 normalize）。随后 `remoteView=remoteDiffers()`；内容其实没变就清空槽、隐藏横幅，不打扰用户。
- `takeRemote()`：槽为空什么都不做；否则先用槽里的 state 算出 `docAfter()`（在槽里的计划下临时 normalize，算完立即恢复），再 `usePlan`/`keepOrphans`，最后 `state=…` 并清空槽（只有计划槽时对当前 state 重新 normalize）。调用点：`applyView`、`commit` 开头、编辑弹窗保存、`deleteLog` 开头。
- `docAfter()`：槽里有 state 时 = `normUnder(槽里的计划, 服务器 state)` 加 ops 里每个 run 按原顺序重做；否则就是当前 state。调用点：`persist` 的 state 缓存、`syncOnce` 的上传正文（含创建 state 文档）、上传成功后的缓存、`takeRemote`、`remoteDiffers`。槽非空时本机一定是干净的（任何 commit 先 takeRemote），所以现有上传路径没有可见变化。
- `resetSession` 清空槽并置 `remoteView=false`；`reconcileOnce` 提交时同样清空。

### D-04 与 D-06 在 commit 和编辑弹窗里的接法

- `commit(keys,run)`：`takeRemote()` → `run(state)` → 记入 ops → `persist` → 若 `remoteView` 为真 `applyView(true)`。所以 composer 发出草稿、复盘防抖到期、保存力量值、改开始日期、勾选、拖动等所有经 commit 的处理函数都自动得到 D-04。applyView 里若 `rvPending`，先清掉 rvT 并立即执行 `rvJob`（经 commit 并入并应用），回到外层时 `remoteView` 已为假就直接返回。
- 编辑弹窗保存：`close()` → `takeRemote()` → `gone=CLOUD&&!state.logs.some(id)` → `commit`，run 按 id 找到就写入编辑框的值，找不到就以同一个 id、编辑框里的文字、类别和日期新加一条（幂等）；`gone` 时再 `queueMicrotask` 弹 `这条记录在另一台设备上被删除，已按你的修改重新加回`（4000 ms）。
- `deleteLog`：开头 `takeRemote()`；记录已不存在就不 commit、不提示，`remoteView` 为真则 `applyView()`（没有本机操作的结束忙碌，直接应用远端）。

### 提示的先后顺序

处理函数自己的提示（`已记录`、`已保存`）在同一段同步代码里先弹；`applyView(true)` 的更新提示延后一个微任务，排在它之后，所以留在屏幕上的是 `已更新为其他设备上的最新内容`；D-06 的加回提示在 commit 之后再排一个微任务，排在更新提示之后，所以留在屏幕上的是加回提示。空闲应用和“现在更新”不经 commit，更新提示同步弹出；`syncing` 为真且 `cfShown` 为真时（同一次同步已弹过冲突提示）只重绘不弹（沿用 IN-01）。

### 触发

`pollTick` 每 `POLL_MS=60000` 一次，页面可见时由 `startPoll()` 启动（初次对账成功提交后、`goBootOffline` 之后、visibilitychange 变为可见时），`stopPoll()` 在 `resetSession`、`goExpired`、页面隐藏时调用。`visibilitychange` 变为可见立即 `requestSync("visible")`，`online` 沿用 10-01 的监听。

## Task Commits

1. **Task 1（tracer）：60 秒拉取、挂起槽、空闲应用、忙碌横幅** - `af600c0`（feat）
2. **Task 2 RED：D-04、D-05、D-06 三条用例** - `a26d92c`（test）
3. **Task 2 GREEN：D-04 微任务延后提示、D-06 加回、applyView 重入修复** - `495ddb4`（feat）

**Plan metadata:** 本提交之后的 docs 提交（SUMMARY、STATE、ROADMAP）

## Files Created/Modified

- `us-journey-tracker.html` - 远端更新全部逻辑（槽、isBusy、applyView、renderKeep、拉取与触发、D-04、D-06）；APP_SHA256 两次重新记录
- `tests/support/constants.ts` - APP_SHA256
- `tests/support/strings.ts` - `BANNER_REMOTE`、`BTN_APPLY_NOW`、`TOAST_LOG_READDED`
- `tests/cloud/remote-update.spec.ts` - 新建，6 条用例（SYNC-02 五条、SYNC-03 一条）

## Decisions Made

见 frontmatter 的 key-decisions。另：焦点离开文本框时 `focusout` 触发空闲检查，会在鼠标按下的那一刻就应用并整页重绘；若用户这一下点的是会被重绘的元素（日期列、日历格、筛选按钮），这次点击可能落空，需要再点一次。这是计划规定的触发方式（relatedTarget 传给 isBusy），没有额外处理，留给 10-09 的整体验证关注。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 缺失的关键功能] commit 先 takeRemote 再 applyView 提前到任务 1**
- **Found during:** Task 1
- **Issue:** 计划把“commit 接上 D-04”放在任务 2，但任务 1 的提交里一旦有挂起槽而 commit 不先并入，本机修改会落在旧基线上、再带着新基线上传，静默覆盖远端修改
- **Fix:** 任务 1 的 commit 就加 `takeRemote()` 与 `if(remoteView)applyView()`；任务 2 只补微任务延后（`applyView(true)`）、编辑弹窗与删除
- **Files modified:** us-journey-tracker.html
- **Commit:** af600c0（微任务延后在 495ddb4）

**2. [Rule 1 - Bug] 轮询落进既有用例的第一次 runFor，多出一次同步**
- **Found during:** Task 1（跑 offline-sync）
- **Issue:** 登录后 pauseAt 到 FROZEN_NOW+60000，而轮询从登录那一刻起 60 秒到期，正好落在 pause 之后几百毫秒，即第一次 `runFor(1_000)` 里：SYNC-03 离线、SYNC-06 两条重试用例多一次请求或倒计时差一秒（3 条失败）
- **Fix:** `pollTick` 只在 `net==="ok"`、没有同步在跑、没有待保存、本机不脏时才 `requestSync("poll")`；有待保存的修改、重试倒计时、离线各自会对账
- **Files modified:** us-journey-tracker.html
- **Verification:** offline-sync 全部通过，完整 test:cloud 143 条无 flaky
- **Commit:** af600c0

**3. [Rule 1 - Bug] 点“现在更新”后按钮被移除触发 focusout，drawBar 重入抛异常，横幅留在屏幕上**
- **Found during:** Task 2 RED（D-05 用例）
- **Issue:** applyView 先 `hideBar` 后 `remoteView=false`；`drawBar` 移除获得焦点的按钮时同步触发 focusout，处理函数见 `remoteView` 仍为真又 `showBar`，嵌套的 `drawBar` 先把按钮删掉，外层再删就抛 NotFoundError，横幅卡住
- **Fix:** `takeRemote()` 之后、画任何东西之前先 `remoteView=false`
- **Files modified:** us-journey-tracker.html
- **Commit:** 495ddb4

**4. [用例设计] 两处与计划字面不同**
- 空闲应用的用例不用一次 `runFor(60_000)`：轮询在推进的前几秒就触发，响应随后到达时 toast 的 4 秒计时会在同一次推进里走完，toast 断言偶发失败（观察到 1/4 次失败）。改成每步 1 秒推进、条件一成立就停（`advanceUntil`），用 `--repeat-each=5`、`--retries=0` 验证稳定。忙碌用例的 `runFor(60_000)` 不受影响（横幅没有计时器）。
- D-04 用例的“修改开始日期”一段不断言草稿保留：开始日期处理函数自己在 commit 之后调用 `renderAll()`，会重建 composer 清掉草稿，这是 Phase 9 以前就有的行为（本任务没有改它）；该段只断言服务器同时保留开始日期和远端记录、横幅消失。

**Total deviations:** 3 auto-fixed（1 Rule 2、2 Rule 1）加 1 条用例设计说明。**Impact:** 前三条都是为了让任务 1 的提交自身就安全、既有 offline 用例不被轮询打乱；没有范围扩大。

## TDD Gate Compliance

任务 2 是 `tdd="true"`：RED 提交 `a26d92c`，GREEN 提交 `495ddb4`，没有 REFACTOR 提交。

- **RED 证据（语义评估，自检）：** 在任务 1 的应用上跑三条新用例（`--retries=0`）：D-04 在“留在屏幕上的是更新提示”的断言（`expectToast`，第 194 行）超时失败，D-06 在“加回提示”的断言（第 304 行）超时失败，两者都是计划行为的断言失败；D-05 在“点现在更新后横幅消失”的断言失败，原因是上面第 3 条的 pageerror（drawBar 重入），属于被用例发现的真实缺陷，不是夹具或语法错误。三条目标用例都真正执行并在计划断言上失败。
- **RED 的局限：** Playwright 的 JSON 报告不在 `check tdd-red-evidence` 支持的报告格式之列，所以没有跑机器分类器，上面是人工核对失败位置和原因；没有伪造记录。
- 任务 1 是 tracer，三条用例随提交一起通过，不走 RED/GREEN。

## Issues Encountered

无阻塞。需要在 10-08、10-09 留意的两点：`focusout` 触发应用时点击可能落空（见 Decisions Made）；加预设、待办、力量输入框的保留只靠代码审阅（见 coverage D8）。

## Known Stubs

无。

## Threat Flags

无新增网络端点、认证路径或信任边界。远端 state 和 plan 仍只经 `normalize`、`normalizePlan` 入口，横幅和提示用 textContent（T-10-17）；挂起槽加 isBusy 加 renderKeep 对应 T-10-18；run 按 id 或键定位对应 T-10-19。

## Next Phase Readiness

Ready for 10-07（上传等待期间到达的远端更新：先应用远端再重做尚未上传的 ops，以及 Phase 9 留底用例的迁移）。`docAfter()` 和 `ops` 已经是它的基础。

## Self-Check: PASSED

- 创建的文件：`tests/cloud/remote-update.spec.ts`、本 SUMMARY 存在
- 提交：af600c0、a26d92c、495ddb4 均在 HEAD 的祖先链上
- 完整 `npm run test:cloud`：REPORT OK expected=143 flaky=0 unexpected=0；默认配置 app-integrity、storage、smoke：REPORT OK expected=22（含 SAFE-02）
- 暂存隐私检查三次都打印“隐私检查通过”
