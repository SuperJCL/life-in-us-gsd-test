---
phase: 10-offline-realtime-sync
plan: 08
subsystem: sync
tags: [realtime, pocketbase-sse, startRealtime, onDocEvent, PB_CONNECT, data-rt, echo-suppression, playwright, fake-pocketbase]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-01 的 requestSync Promise 语义；10-02 的 dropRealtime、refuseRealtime、emit、connectionCount 和 PROBE-10；10-06 的挂起槽与 takeRemote；10-07 的 rebaseState"
provides:
  - "应用的实时订阅：startRealtime（journey_docs/* 的 id、kind、writer、updated 加 PB_CONNECT，订阅后补一次整份对账，之后 data-rt 为 live）、ensureRealtime（只在 off 时订阅）、onDocEvent（回声抑制，其余走 requestSync）、onPbConnect、resetSession 里退订"
  - "AppHarness.open 的 realtime 选项；cloud 应用视图的 ready() 等 body[data-rt=live]"
  - "两条实时用例，受实时影响的既有 spec 改为确定写法；完整 test:cloud 149 条通过"
affects: [10-09]

actuals:
  tokens: 2950
  tasks: 2
  commits: 2
plan_head_before: e76e23a8fa73fbfb210b0a66722d7e500d8e6ce7
plan_head_after: c8e8d4205edecafbfba61f9dc5afd0ef252f3b93

tech-stack:
  added: []
  patterns:
    - "事件只是触发器：fields 只带四个元数据字段，事件里的 record 从不当作文档内容，一律经 requestSync 整份对账，再按挂起槽、isBusy、D-04、D-05、D-06 的既有规则应用"
    - "订阅顺序：先文档订阅、再 PB_CONNECT、再补一次对账，最后才置 live；补对账用 requestSync 的 Promise（覆盖本次请求的那一轮同步结束才 resolve）"
    - "用例要“听不到”另一台设备时：打开前 refuseRealtime(true, page) 加 open({ realtime:false })；离线构造里 refuseRealtime 加 dropRealtime，恢复时放开"

key-files:
  created:
    - tests/cloud/realtime-sync.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/app.ts
    - tests/cloud/remote-update.spec.ts
    - tests/cloud/conflict-snapshot.spec.ts
    - tests/cloud/offline-sync.spec.ts

key-decisions:
  - "ensureRealtime 的调用点放在启动对账 reconcileOnce 成功收尾（startPoll 之后），这时 run 已清空、门控已撤，requestSync 不会被提前挡掉；10-09 再扩到每次 syncOnce 成功收尾"
  - "会话变化时的退订分两种：resetSession 已退订一切，启动中的 startRealtime 发现 epoch 变了只有在 rt 仍为 off（没有更新的会话接手）时才再退订一次，否则直接返回，不误杀新会话的订阅"
  - "onPbConnect 只在 rt 不为 off 时置 live，所以首次连接失败后到达的任何回调都不会把 off 改成 live"
  - "回声抑制两层都保留：writer 等于本页就忽略；updated 等于基线也忽略（本页自己的写入答复先到时基线已移动）"

requirements-completed: [SYNC-02]

coverage:
  - id: D1
    description: "设备一记一笔上传后，设备二不推进任何时钟就在默认断言超时内显示这条记录并提示已更新，没有横幅，状态已同步"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/realtime-sync.spec.ts#SYNC-02 a change on one device appears on the other device within seconds"
        status: pass
    human_judgment: false
  - id: D2
    description: "本页自己的保存和写入方为本页的事件不引起对账；写入方不是本页、updated 不同的哨兵事件之后列表请求恰好多一次，没有已更新提示和横幅"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/realtime-sync.spec.ts#SYNC-02 this device's own save never comes back as a remote update"
        status: pass
    human_judgment: false
  - id: D3
    description: "实时连上之后既有 cloud 用例仍然确定：完整 test:cloud 149 条通过、无 flaky；默认配置 app-integrity、storage、smoke 22 条通过（含 SAFE-02）"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "npm run test:cloud（BELOW_NORMAL，workers=1）：REPORT OK expected=149 flaky=0 unexpected=0；npm test app-integrity、storage、smoke：REPORT OK expected=22"
        status: pass
    human_judgment: false
  - id: D4
    description: "首次实时连接失败时清掉 SDK 里登记的监听、data-rt 为 off，应用靠 60 秒拉取工作（设备二被拒绝实时的用例靠拉取、回到前台、重新联网的触发通过）"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 a change from another device is applied at the next poll when this device is idle"
        status: pass
    human_judgment: false
  - id: D5
    description: "真实 PocketBase 0.41.1 在真实网络下的“几秒内”延迟"
    requirement: "SYNC-02"
    verification: []
    human_judgment: true
    rationale: "本计划只在固定时钟和本机假服务器上验证；真实网络延迟和真实服务器接受 PB_CONNECT 订阅串由 Phase 13 的真机验收确认"

duration: 35min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 08: 实时订阅 Summary

**同一账号的另一台设备的写入不再要等下一次拉取：应用订阅 `journey_docs/*`（只带 id、kind、writer、updated）和 `PB_CONNECT`，收到不是自己写的事件就走和 60 秒拉取同一条 requestSync 整份对账，再由 10-06、10-07 的挂起、重做规则决定何时显示；订阅成功后补一次对账，data-rt 到 live 才算就绪，既有 cloud 用例照旧确定通过。**

## Performance

- **Duration:** 约 35 min
- **Started:** 2026-11-10T08:47Z（第一次读文件）
- **Completed:** 2026-11-10T09:25Z
- **Tasks:** 2
- **Files modified:** 7（应用 1、constants 1、harness 1、cloud 用例 4，其中 realtime-sync.spec.ts 为新建）

## Accomplishments

### 订阅顺序与补对账

- `startRealtime()`：记 `ep=sessionEpoch`，`rt="connecting"`、`body[data-rt]="connecting"`；先 `await pb.collection("journey_docs").subscribe("*", onDocEvent, {fields:"id,kind,writer,updated"})`，再 `await pb.realtime.subscribe("PB_CONNECT", onPbConnect)`（首次连接时不会在文档订阅提交之前触发对账）；两步都成功后 `await requestSync("connect")`，补对账真正跑完（10-01 的 Promise 语义，没有另加等待）才 `rt="live"`。
- 任一步 reject（首次连接失败，SDK 不重试，PROBE-10b）：`rtUnsub()` 清掉 SDK 里已登记的监听，`rt="off"`、data-rt 为 off，应用照常靠拉取工作。每个 await 之后 epoch 变了就按 `rtStale` 处理（见 key-decisions）。
- `ensureRealtime()`：`CLOUD && me && rt==="off"` 才调用 startRealtime，绝不重复订阅。调用点是启动对账 `reconcileOnce` 成功收尾（`startPoll()` 之后）。
- `onDocEvent(e)`：没有 record、action 为 delete、`record.writer===WRITER`（回声）、或 `docs[kind].base===record.updated`（已持有的版本）都忽略；否则 `requestSync("event")`。事件里的 record 从不直接应用。
- `onPbConnect()`：`requestSync("connect")` 之后，`rt` 不为 off 才置 live（重连时 SDK 会再次调用，PROBE-10a）。
- `resetSession` 里 `stopRealtime()`：退订（忽略错误、不等待）、`rt="off"`、删除 data-rt；`logout` 里已有的“先退订”顺序不变，随后的 resetSession 再退订一次没有请求（SDK 已断开）。60 秒拉取不因实时连上而停止。

### 测试设施

- `AppHarness.open()` 加 `realtime?: boolean`（缺省 true）；cloud 应用视图的 `ready()` 在已有条件之外再等 `body` 的 `data-rt` 为 `live`，`realtime:false` 不等，注释写明原因（订阅成功后的补对账完成之前用例的下一步可能与它竞争）。

### 两条实时用例（tests/cloud/realtime-sync.spec.ts）

- `SYNC-02 a change on one device appears on the other device within seconds`：两台设备都是 manual 时钟，连接数为 2，设备一记一笔上传，设备二不推进任何时钟就显示这条记录、提示已更新、没有横幅、状态已同步。
- `SYNC-02 this device's own save never comes back as a remote update`：记一笔上传后先 emit 一条写入方就是本页（取自上传时带的 writer）、updated 不同的事件，再 emit 写入方为 `synth-other-writer`、updated 不同的哨兵；断言自 PATCH 200 起列表 GET 恰好 1 次，没有横幅，toast 不是“已更新”。
- 用例有效性经过变异检查：把应用里 `r.writer===WRITER` 的回声判断临时去掉后，第二条用例失败（列表请求为 2，不是 1）；还原后通过。原计划只用哨兵事件，这个变异检查证明仅靠它分不出 writer 判断（本页写入答复先到时 `updated` 已等于基线，另一层判断也会挡住回声），所以加了“写入方为本页、updated 不同”的这一步。

### 受实时影响而调整的既有用例

| 用例（文件） | 调整 |
|---|---|
| `SYNC-02 a change from another device is applied at the next poll when this device is idle`（remote-update） | 设备二 `refuseRealtime` 加 `realtime:false` 打开，拉取是唯一途径 |
| `SYNC-03 coming back online or to the foreground reconciles at once`（remote-update） | 同上 |
| `SYNC-02 an edit on a device that had not yet seen another device's change keeps both edits without a kept version`（remote-update） | 同上：设备二必须在没看到 first 时上传 |
| `SYNC-02 finishing an action while a remote change waits applies it first and keeps both edits (D-04)`（remote-update） | 同上（偏差 1：计划原以为可保留实时） |
| `SYNC-05 an edit whose sync failed at the list request keeps the other device's version here after reconnecting (D-03)`（remote-update） | 离线期间本页 `refuseRealtime` 加 `dropRealtime`，恢复时放开 |
| `makeOfflineConflict`（conflict-snapshot，8 条用例共用） | 设备二离线期间 `refuseRealtime` 加 `dropRealtime`，恢复时放开 |
| D-03 用例和 IN-01 用例（offline-sync） | 同上（设备二，和单页） |
| reconcile-gate | 没有修改：所有用例的请求断言只数写入请求（POST、PATCH）和故障命中数，不受订阅后补对账的那一次列表请求影响，改前改后都全部通过 |

### 完整运行结果

- 完整 `npm run test:cloud`（BELOW_NORMAL、workers=1）：**REPORT OK expected=149 flaky=0 unexpected=0**（不少于 147：计划的“147”把 10-01 到 10-08 的新增标题写成 33 个，实际 Phase 9 末尾 114 条加上 10-01 到 10-07 的 33 条是 147，再加本计划的 2 条是 149）。
- 默认配置 app-integrity、storage、smoke：**REPORT OK expected=22**（含 SAFE-02）。

## Task Commits

1. **Task 1（tracer）：实时订阅、事件触发整份对账、回声抑制、AppHarness 等 data-rt、两条用例** - `ad515a2`（feat）
2. **Task 2：需要“听不到”另一台设备的既有用例改成确定写法，完整 test:cloud** - `c8e8d42`（test）

**Plan metadata:** 本提交之后的 docs 提交（SUMMARY、STATE、ROADMAP）

## Files Created/Modified

- `us-journey-tracker.html` - startRealtime、ensureRealtime、stopRealtime、onDocEvent、onPbConnect、顶层 `rt`、`body[data-rt]`；reconcileOnce 收尾调用 ensureRealtime；resetSession 退订；APP_SHA256 重新记录
- `tests/support/constants.ts` - APP_SHA256
- `tests/support/app.ts` - `open()` 的 `realtime` 选项，`ready()` 等 `data-rt=live`
- `tests/cloud/realtime-sync.spec.ts` - 新，2 条用例
- `tests/cloud/remote-update.spec.ts` - `openBoth` 的 `realtime` 参数；四条用例和 D-03 用例的确定写法
- `tests/cloud/conflict-snapshot.spec.ts` - `makeOfflineConflict` 的实时拒绝与放开
- `tests/cloud/offline-sync.spec.ts` - D-03 用例和 IN-01 用例的实时拒绝与放开

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

**1. [Rule 3 - 阻塞] D-04 用例也要让设备二听不到设备一**
- **Found during:** Task 2（四个 spec 的第一次运行，实时已连上）
- **Issue:** 计划说 D-04、D-05、D-06 和 10-07 的重做用例“可以保留实时”。实测 `SYNC-02 finishing an action while a remote change waits…(D-04)` 的第二段（编辑弹窗保存同一条）在设备一改 X 的那一刻，设备二还空闲，事件直接把远端应用了，设备二随后才打开弹窗，用例要的“远端更新挂起”局面不存在，`expect(bar).toBeVisible()` 失败。其余 D-05、D-06 和 10-07 的重做用例保留实时仍通过
- **Fix:** 该用例同样 `openBoth(..., { realtime: false })`，断言不变
- **Files modified:** tests/cloud/remote-update.spec.ts（Task 2 的文件范围内）
- **Verification:** 四个 spec 共 44 条通过；完整 test:cloud 149 条通过
- **Committed in:** c8e8d42

**2. [用例设计] 回声用例比计划多一步**
- **Found during:** Task 1（变异检查）
- **Issue:** 只发写入方不是本页的哨兵事件，去掉应用里的 writer 判断后用例仍通过（两层判断冗余），不能证明 writer 抑制
- **Fix:** 哨兵之前先 emit 一条写入方取自本页上传 writer、updated 不同的事件；变异后用例失败，还原后通过
- **Files modified:** tests/cloud/realtime-sync.spec.ts
- **Committed in:** ad515a2

**3. [计划数字] 完整 test:cloud 的条数是 149，不是 147**
- 计划的 `--min-expected 147` 是下限，实际 149（Phase 9 的 114、10-01 到 10-07 的 33、本计划的 2）。不是失败，只记录；10-09 的 +3 应以 149 为基数得到 152

---

**Total deviations:** 3（1 Rule 3、2 用例/数字说明）。**Impact:** 没有范围扩大，没有改未列出的文件（reconcile-gate.spec.ts 在列表里但无需修改，所以没有出现在提交里）。

## Issues Encountered

无阻塞。第一次完整运行四个 spec 时 4 条失败，全部在 remote-update.spec.ts（依赖设备二“听不到”的三条加 D-04 的一条），按计划的写法改完后全部通过。

## Known Stubs

无。

## Threat Flags

无新增网络端点、认证路径或信任边界。T-10-21（别的账号的事件）：应用不信任事件内容，只用它触发经过鉴权的列表读取；T-10-23（重复订阅）：只在 rt 为 off 时订阅，首次失败先 unsubscribe 清监听，回声用例断言哨兵之后恰好一次列表请求。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 10-09（onDisconnect 与重连后的状态、首次连接失败后的自动重新订阅、离线启动后的订阅、过期时退订、README 与 KNOWN-BUGS、完整默认 npm test）。需要留意：

- 首次连接失败后 `rt` 停在 off，目前只在启动对账成功时调用过 ensureRealtime；10-09 把调用点扩到每次 syncOnce 成功收尾，才会自动重新订阅。
- goBootOffline（离线启动）路径还没有订阅，也在 10-09。
- 完整 test:cloud 现为 149 条（计划预计的基数为 147）。

## Self-Check: PASSED

- 修改的文件都在：us-journey-tracker.html、tests/support/constants.ts、tests/support/app.ts、tests/cloud/realtime-sync.spec.ts（新）、tests/cloud/remote-update.spec.ts、tests/cloud/conflict-snapshot.spec.ts、tests/cloud/offline-sync.spec.ts；本 SUMMARY 存在
- 提交：ad515a2、c8e8d42 在 HEAD 的祖先链上；`git rev-list --count e76e23a..HEAD` 在写本文件前为 2
- 验收：应用含 `startRealtime`、`ensureRealtime`、`onDocEvent`、`PB_CONNECT`、`dataset.rt`；五个锚点各一次；APP_SHA256 等于文件 sha256；app.ts 含 `data-rt` 和 `realtime`；remote-update.spec.ts、conflict-snapshot.spec.ts 含 `refuseRealtime`
- 验证：test:cloud realtime-sync、multi-device、logout、session：REPORT OK expected=21，含三个指定标题；四个 spec：44 条通过；完整 test:cloud：REPORT OK expected=149 flaky=0 unexpected=0，含四个指定标题；默认配置 app-integrity、storage、smoke：REPORT OK expected=22（含 SAFE-02）
- 两次暂存后隐私检查都打印“隐私检查通过”

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
