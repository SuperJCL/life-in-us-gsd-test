---
phase: 10-offline-realtime-sync
plan: 09
subsystem: sync
tags: [realtime, onDisconnect, ensureRealtime, storage-event, adoptTab, two-tabs, offline, playwright, docs]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-08 的 startRealtime、ensureRealtime、onPbConnect、resetSession 退订；10-06 的挂起槽 pendRemote、takeRemote、docAfter、maybeApplyView；10-05 的 goExpired；10-03 的 goBootOffline；10-01 的缓存记录与 showSync"
provides:
  - "应用：pb.realtime.onDisconnect（live 时回到 connecting）、每次成功 syncOnce 后 ensureRealtime、goExpired 里 stopRealtime 与 ensureRealtime、rtStale 的过期判断"
  - "应用：window storage 监听与 adoptTab(rec)，两个标签页的本机数据收敛到双方修改的并集"
  - "三条新 cloud 用例（两条实时、一条两标签页离线）；tests/README.md 的 Phase 10 小节与已知限制；tests/KNOWN-BUGS.md 的 B3、B5 登记"
  - "阶段末尾完整运行：test:cloud 152 条、默认 npm test 176 条，都 REPORT OK、无 flaky"
affects: [Phase 11, Phase 13]

actuals:
  tokens: 7325
  tasks: 3
  commits: 3
plan_head_before: b5503fbf75a002728a83cc8204e1695e90488fbb
plan_head_after: 41acced5c222ab151de616f9f45cb3c4f8bffe32

tech-stack:
  added: []
  patterns:
    - "每次成功的 syncOnce 都调用 ensureRealtime（只在 rt 为 off 时订阅）：首次连接失败、离线启动之后的第一次成功对账都会重新订阅，不依赖 SDK 重试（PROBE-10b）"
    - "另一个标签页写的缓存记录当成一份远端版本放进挂起槽（adoptTab），本页剩余 ops 在它上面重做；只有并集与记录内容不同才写回，对方采纳后算出同样内容，所以不来回写"
    - "同一 context 的两个标签页共用一个时钟（page.clock 就是 context.clock）：只 install 一次，两页都登录后再 pauseAt"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/realtime-sync.spec.ts
    - tests/cloud/offline-sync.spec.ts
    - tests/README.md
    - tests/KNOWN-BUGS.md

key-decisions:
  - "onDisconnect 只在 rt 为 live 时把 data-rt 改成 connecting；重连后的 PB_CONNECT 整份对账再回到 live（SDK 的显式 unsubscribe 也会触发 onDisconnect，但 stopRealtime 随后置 off，不受影响）"
  - "goExpired 里 stopRealtime，ensureRealtime 和 rtStale 都认 net==='expired'，所以过期期间进行中的订阅不会再把 data-rt 改成 live，也不会重新订阅；同一账号重新登录后由初次对账之后的 ensureRealtime 订阅"
  - "adoptTab 在 d.dirty 且本页没有待执行的保存防抖时，加一个 5 秒的补传定时器（TAB_UPLOAD_MS）：另一个标签页随时可能被关掉，不补传的话本页会一直停在“保存中”；干净记录到达（对方已上传）时取消。5 秒比 600 毫秒的防抖长，所以对方正常上传时本页不会多传一份并集"
  - "采纳干净记录时 opsOk 保持原值（计划原文只在脏记录时置假），没有把它改成真，以保持与计划一致；代价是之后遇到别的设备的新版本可能走 D-03 而不是重做，属已知限制"

requirements-completed: [SYNC-02, SYNC-03, SYNC-04, SYNC-06, ACCT-05]

coverage:
  - id: D1
    description: "实时连接断开后 data-rt 为 connecting，断开期间设备一的修改在设备二的 SDK 重连成功、PB_CONNECT 整份对账后出现，data-rt 回到 live，连接数恢复"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/realtime-sync.spec.ts#SYNC-02 a realtime reconnect reconciles and picks up a change made while it was down"
        status: pass
    human_judgment: false
  - id: D2
    description: "登录前被拒绝的首次实时连接：data-rt 为 off、连接数 0；放开并有一次成功对账（回到前台）后应用自己重新订阅，data-rt 为 live、连接数恰好 1，之后另一台设备的修改几秒内到达"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/realtime-sync.spec.ts#SYNC-02 a first realtime connection that fails is retried by the app"
        status: pass
    human_judgment: false
  - id: D3
    description: "同一浏览器两个标签页同时离线：缓存和内存收敛到 X、Y 的并集（touched 恰好 2 个 log 键，两页数量相同），不来回写缓存；关掉一页、断网刷新另一页后 X、Y 和数量 2 还在；联网后服务器上 X、Y 各恰好一条，没有留底、没有冲突提示"
    requirement: "SYNC-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-06 two tabs editing offline at the same time keep each other's edits after one tab is closed"
        status: pass
    human_judgment: false
  - id: D4
    description: "登录过期时退订（data-rt 删除）、同一账号重新登录后重新订阅并回到 live（ready 等 data-rt 为 live）；离线启动的页面在第一次成功后台对账后订阅"
    requirement: "ACCT-05"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-05 an expiry found while saving keeps editing here, shows the expired status and banner, and uploads after signing in again with the same account"
        status: pass
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 opening the app with a cache while the browser reports offline allows editing at once"
        status: pass
    human_judgment: false
  - id: D5
    description: "阶段末尾完整运行：test:cloud 152 条、默认 npm test 176 条（含 SAFE-02），REPORT OK，flaky 0，unexpected 0"
    requirement: "SYNC-04"
    verification:
      - kind: e2e
        ref: "npm run test:cloud（BELOW_NORMAL，workers=1）：REPORT OK expected=152；npm test --workers=1：REPORT OK expected=176"
        status: pass
    human_judgment: false
  - id: D6
    description: "tests/README.md 的 Phase 10 云端用例小节和已知限制（含 D-08：真正断网刷新由 Phase 13 的 Service Worker 提供）、KNOWN-BUGS 的 B3、B5 云端修复登记的措辞和准确性"
    requirement: "SYNC-06"
    verification: []
    human_judgment: true
    rationale: "文档措辞是否准确、是否符合所有者对 D-08 映射的原意，没有自动用例断言，由人审阅"
  - id: D7
    description: "真实 PocketBase 实例和真实网络下的重连、事件补发和“几秒内”延迟"
    requirement: "SYNC-02"
    verification: []
    human_judgment: true
    rationale: "本计划只在本机假服务器和固定时钟下验证；真实服务器是否补发断线期间的事件、真实延迟由 Phase 13 的真机验收确认（设计不依赖补发：每次 PB_CONNECT 整份对账加 60 秒拉取）"

duration: 22min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 09: 实时恢复、两标签页收敛与阶段收尾 Summary

**实时连接断开会显示 connecting 并在 SDK 重连的 PB_CONNECT 上整份补对账，首次连接失败或离线启动之后由下一次成功对账自动重新订阅，过期时退订；同一浏览器的两个标签页靠 storage 事件把对方的缓存写入当成远端版本放进挂起槽，两页收敛到双方离线修改的并集；README、KNOWN-BUGS 收尾，完整 test:cloud 152 条和默认 npm test 176 条全部通过。**

## Performance

- **Duration:** 约 22 min
- **Started:** 2026-11-10T09:25:24Z
- **Completed:** 2026-11-10T09:47:49Z
- **Tasks:** 3
- **Files modified:** 6（应用 1、constants 1、两个 cloud spec、两份文档）

## Accomplishments

### Task 1：断开、重新订阅、过期退订（SC3）

- `pb.realtime.onDisconnect`（在 `startPb` 里设置）：`rt` 为 live 时改为 connecting，`body[data-rt]` 同步；SDK 自己按 200 到 2000 毫秒重连，重连后的 `PB_CONNECT` 走 10-08 的 `onPbConnect`（整份对账，回到 live）。
- `ensureRealtime()` 在每次 `syncOnce` 成功收尾（`showSync()` 之后）调用，仍然只在 `rt` 为 off 时订阅：首次连接失败（PROBE-10b，SDK 不重试）和离线启动（`goBootOffline` 之后的第一次成功后台对账）都会重新订阅，不重复订阅。
- `goExpired()` 里 `stopRealtime()`（退订、`rt="off"`、删除 `data-rt`）；`ensureRealtime` 和 `rtStale` 都认 `net==="expired"`，所以过期期间进行中的订阅不会又把 data-rt 改成 live。同一账号重新登录后初次对账末尾的 `ensureRealtime` 重新订阅。
- 两条用例：
  - `SYNC-02 a realtime reconnect reconciles and picks up a change made while it was down`：设备二 `refuseRealtime` 加 `dropRealtime`，data-rt 为 connecting、连接数 1；设备一记录并上传；设备二推进几秒重连尝试（被拒次数大于 0）仍看不到、仍是 connecting；放开后每轮推进 2 秒直到记录出现，data-rt 回到 live、状态已同步、连接数 2。
  - `SYNC-02 a first realtime connection that fails is retried by the app`：登录前 `refuseRealtime(true, page)` 加 `realtime:false` 打开、自己等已同步；data-rt 为 off、连接数 0、被拒次数大于 0；放开后派发 visibilitychange，data-rt 变为 live、连接数恰好 1；之后另一台设备记一笔，这页（时钟已暂停，不可能来自 60 秒拉取）显示它。
- 变异检查（等同 RED）：在 Task 1 之前的应用上单独运行两条新用例，第一条失败在 `data-rt` 期望 connecting、实际 live，第二条失败在期望 live、实际 off；都是计划断言，不是语法、夹具或零用例问题。

### Task 2：两个标签页同时离线（SYNC-06 / SC4）

- `window.addEventListener("storage")`：只在云端、`me` 存在、`e.storageArea===localStorage` 时处理。本账号 `:plan` 键变化只 `requestSync("tab")`；本账号 `:state` 键且能解析成 id 与本页 `docs.state.id` 相同的记录才 `adoptTab(rec)`；其他键（令牌、过期标记、别的账号）一律忽略。浏览器只把 storage 事件发给其他标签页。
- `adoptTab(rec)` 的规则：
  1. 启动对账进行中（`run.live`）不处理。
  2. 记录当成远端版本放进挂起槽（`pendRemote.state={data:rec.data,updated:rec.base}`），`docs.state.base=rec.base`，`touched` 取记录的 touched 与本页剩余 ops 的键的并集，`dirty=rec.dirty||ops.length>0`，`seq` 加一（进行中的上传成功后不会清脏标记）；记录是脏的时 `opsOk=false`（之后遇到别的设备按 D-03 整份覆盖加留底）。
  3. 算 `docAfter()`：与 `rec.data` 内容不同（`canon` 比较）才写回缓存；内容相同且记录干净（对方已上传并集）时清空 ops、touched 为空、dirty 为假。
  4. `remoteView=remoteDiffers()`：与本页屏幕相同时清掉槽，不显示横幅；不同则 `maybeApplyView()`（空闲时应用、忙时挂起，10-06 的不变式不变）。
  5. 记录是脏的时，本页没有待执行的保存防抖就加一个 5 秒的补传定时器（偏差 1）；记录干净时取消。
- 来回写入：**没有观察到。** 用例用 init script 数每个页面对 state 缓存键的写入次数，两页都记完并看到并集之后，稍等 600 毫秒两页的写入次数都不再变化（`toEqual(settled)`）。
- 用例 `SYNC-06 two tabs editing offline at the same time keep each other's edits after one tab is closed`：标签页一（`context.newPage()` 加 `login:'session'`）记 X，标签页二（fixture 页面）经 storage 事件显示 X；标签页二记 Y，共用缓存同时含 X、Y、touched 恰好两个 `log:` 键、dirty 为真，标签页一也显示 Y、数量 2；关掉标签页一，标签页二在初始化脚本报告断网、服务器仍被拒、不推进时钟的条件下刷新，X、Y 可见、状态 `statusOffline(2)`；`clearFaults()` 加 `setPageOnline(true)` 后已同步，服务器上 X、Y 各恰好一条，`usj:v2:<id>:snapshot` 不存在，toast 不是 TOAST_CONFLICT，`#snapshotBtn` 隐藏，被拒条数按故障命中数确认。
- 变异检查（等同 RED）：Task 2 之前的应用上用例失败在“标签页二应当显示 X”（`element(s) not found`），而不是只在末尾失败；也就是改动前标签页二根本不会知道 X。

### Task 3：README、KNOWN-BUGS 和完整运行

- `tests/README.md` 在第 13 节 Phase 9 小节之后加“Phase 10 的云端用例”（新 spec、假服务器的新开关、`online.ts`、`edits.ts`、`open({ realtime })`、manual 时钟写法、缓存新字段、挂起槽、两标签页收敛）和“Phase 10 的已知限制”：D-08（真正断网刷新由 Phase 13 的 Service Worker 提供）、采纳脏记录之后一律按 D-03、每次整份读取两份文档，外加实时“几秒内”只在假服务器上验证一条。
- `tests/KNOWN-BUGS.md`：B3 在 Phase 9 的门控用例之后补 Phase 10 的 `SYNC-03 a reconcile not finished after about 15 seconds ...(B3)`；B5 补“云端路径由 Phase 10 修复（`SYNC-06 a server error is retried ...`），旧路径维持现状”。旧路径的已知 bug 标记用例不动。
- 完整运行（依次、不并发、BELOW_NORMAL、workers=1）：
  - `npm run test:cloud`：**REPORT OK expected=152 flaky=0 unexpected=0**（约 2.9 分钟；10-08 之后 149，加本计划 3 条；计划的下限 150）；含四个指定标题。
  - `npm test`：**REPORT OK expected=176 flaky=0 unexpected=0**（约 3.1 分钟），含 SAFE-02。

## 09-REVIEW 遗留条目的最终状态（按 10-03 的归属表）

| 条目 | 归属 | 最终状态 |
|---|---|---|
| WR-01 写入方 id | 10-05 Task 2 | 已处理（`usj:v2:writer`、复制标签页重新生成，完整运行中的 writer-id.spec.ts 两条通过） |
| WR-02 保存无超时、saving 不复位 | 10-01 | 已处理（15 秒放弃并重试的用例通过） |
| IN-01 冲突提示被“已更新”替换 | 10-03 | 已处理（cfShown，IN-01 用例通过） |
| IN-02 多余提升的 cur | 10-01 | 随 `cloudSave` 移除消失 |
| IN-03 三项 | 10-05、10-06；其余留后 | `expired`、`remote` 横幅已接上；`BOOT_SUB_LOADING` 和同一用例混用 `clock.install`、`setFixedTime` 属测试整洁项，按归属表不处理，留给以后清理 |
| IN-04 超限且文档被删后一直失败 | 10-05 Task 1 | 已处理（404 先 checkAuth） |
| IN-05 过期标记键无失效时间 | 不处理 | 09-REVIEW 自己的结论；`goExpired` 仍用 `expireToken()` |
| IN-06 旧路径标题字体 | 不处理 | 属旧路径外观，Phase 9 已登记 |

## Task Commits

1. **Task 1：onDisconnect、每次成功同步后 ensureRealtime、过期退订、两条实时用例** - `db94410`（feat）
2. **Task 2：storage 事件让两个标签页收敛、一条两标签页离线用例** - `098bcb0`（feat）
3. **Task 3：README、KNOWN-BUGS** - `41acced`（docs）

**Plan metadata:** 本提交之后的 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）

计划约束“每个任务一次提交”，所以没有单独的 `test(...)` 提交；RED 以“在改动前的应用上运行新用例”的方式验证（见上），没有产出独立的 RED 记录，未运行 `gsd_run check tdd-red-evidence`。

## Files Created/Modified

- `us-journey-tracker.html` - `onPbDisconnect`、syncOnce 成功收尾的 `ensureRealtime`、`goExpired` 退订、`rtStale`/`ensureRealtime` 的过期判断、storage 监听、`adoptTab`、`TAB_UPLOAD_MS`；APP_SHA256 两次重新记录
- `tests/support/constants.ts` - APP_SHA256
- `tests/cloud/realtime-sync.spec.ts` - 加 2 条（共 4 条）
- `tests/cloud/offline-sync.spec.ts` - 加 1 条（两标签页离线）和 `countStateWrites` init script，导入 `AppHarness`
- `tests/README.md`、`tests/KNOWN-BUGS.md` - 见上

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

**1. [Rule 2 - 缺失的关键行为] 采纳脏记录后的补传定时器**
- **Found during:** Task 2（设计 adoptTab 时）
- **Issue:** 计划的 adoptTab 把本页置为 dirty，但没有任何东西会触发上传：另一个标签页随时可能被关掉，之后本页会一直停在“保存中…”，修改虽在缓存里但要等下一次编辑或刷新才上传
- **Fix:** `d.dirty` 且本页没有待执行的保存防抖时，加一个 5 秒的 `flush` 定时器（`TAB_UPLOAD_MS`）；采纳干净记录时取消。比 600 毫秒防抖长，所以对方正常上传时本页不会多传一份并集；用例的 manual 时钟只推进约 2 秒，不触发它
- **Files modified:** us-journey-tracker.html
- **Committed in:** 098bcb0

**2. [用例设计] 两标签页用例不再对标签页二采纳 X 之后的状态行断言文案**
- **Found during:** Task 2（第一次运行）
- **Issue:** 采纳后标签页二自己还没试过上传，状态行是“保存中…”而不是离线，原先写的 `statusOffline(1)` 断言不成立
- **Fix:** 只断言 X 在标签页二里可见；离线数量和文案在标签页二记 Y 之后（它自己的上传被拒）和标签页一采纳 Y 之后断言（都是 `statusOffline(2)`）
- **Files modified:** tests/cloud/offline-sync.spec.ts
- **Committed in:** 098bcb0

**3. [用例设计] 实时重连用例的设备二暂停点**
- **Found during:** Task 1（第一次运行）
- **Issue:** 设备二按其它用例的写法 `pauseAt(FROZEN_NOW + 60_000)` 之后，它的 60 秒拉取从登录那一刻起算，用例推进 3 秒时拉取落进范围，设备二靠拉取而不是重连看到了记录，“断开期间看不到”的断言失败
- **Fix:** 设备二暂停在“现在”之后一点点（`Date.now() + 100`），拉取距离还有约 60 秒；已写进 README 的 manual 时钟一节
- **Files modified:** tests/cloud/realtime-sync.spec.ts
- **Committed in:** db94410

**4. [计划与实际] 第二个标签页不再自己 install 时钟**
- 计划写“第二个标签页自己 install manual 时钟”。`page.clock` 就是 `context.clock`，同一 context 的两个标签页共用一个时钟，所以只 install 一次（在第一个页面上），两页都登录后再 `pauseAt`；其余照计划。标签页一用新开的页面、标签页二用 fixture 页面（被关闭和被刷新的分别是它们），避免关闭 fixture 的页面。

**5. [计划数字] 完整 test:cloud 是 152 条**
- 10-08 之后 149，加本计划 3 条；计划的 `--min-expected 150` 是下限，实际 152。

---

**Total deviations:** 5（1 Rule 2、4 用例设计或计划与实际的说明）。**Impact:** 没有改未列出的文件；完整运行没有失败，不需要后续补救计划。

## Issues Encountered

无阻塞。实时重连用例第一次运行失败的原因见偏差 3；两标签页用例第一次运行失败的原因见偏差 2。logout、multi-device 两个 spec 在 Task 2 之后单独跑过（12 条通过），因为 adoptTab 会让“另一个标签页留下脏缓存”的 logout 用例里的第一个标签页也变成脏的；结果没有变化，完整运行也通过。

## Known Stubs

无。

## Threat Flags

无新增网络端点或认证路径。新增的 storage 监听是计划里 T-10-30、T-10-31 覆盖的跨标签页信任边界：只处理本账号、`me` 存在、记录 id 与本页文档 id 相同的 state 记录；内容只进挂起槽，并入时经 `normUnder` 的 normalize；渲染沿用 `esc()`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 10 的九个计划都已完成：实时订阅、断开重连、首次失败重订阅、过期退订、两标签页收敛、README 和 KNOWN-BUGS 都在，完整 cloud 152 条和默认 176 条通过。留给后面的事：

- Phase 13：真正断网时刷新（Service Worker）、真实 PocketBase 上的重连和事件补发、真实网络延迟、`fields` 参数的流量优化。
- 已知限制（README 已写）：采纳了另一个标签页的脏记录之后遇到别的设备的新版本，按 D-03 整份覆盖加留底。
- 本阶段的两个遗留测试整洁项（IN-03 的两小项）按归属表留给以后清理。

## Self-Check: PASSED

- 修改的文件都在：us-journey-tracker.html、tests/support/constants.ts、tests/cloud/realtime-sync.spec.ts、tests/cloud/offline-sync.spec.ts、tests/README.md、tests/KNOWN-BUGS.md；本 SUMMARY 存在
- 提交：db94410、098bcb0、41acced 在 HEAD 的祖先链上；`git rev-list --count b5503fb..HEAD` 在写本文件前为 3
- 验收：应用含 `onDisconnect`、`addEventListener("storage"`、`adoptTab`；五个锚点各恰好一次；APP_SHA256 等于文件 sha256；README 含 `Phase 10 的云端用例`、`refuseRealtime`、`usj:v2:writer`、`Service Worker`、`已知限制`；KNOWN-BUGS 含 `Phase 10`
- 验证：Task 1 test:cloud 四个 spec 33 条 REPORT OK；Task 2 三个 spec 30 条 REPORT OK（另跑 logout、multi-device 12 条通过）；默认配置 app-integrity、storage、smoke 22 条 REPORT OK（含 SAFE-02，两次）；完整 test:cloud 152 条 REPORT OK；完整 npm test 176 条 REPORT OK
- 三次暂存后隐私检查都打印“隐私检查通过”；Task 3 只暂存两份文档

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
