---
phase: 10-offline-realtime-sync
plan: 07
subsystem: sync
tags: [rebaseState, replay, opsOk, d-03, sentOps, idempotent-runs, pending-slot, playwright, fake-pocketbase]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-04 的 commit/ops/opsOk/sentOps 与幂等 run；10-06 的挂起槽 pendRemote、takeRemote、docAfter、applyView；10-03 的 D-03 离线重连路径"
provides:
  - "syncOnce 的重做分支 rebaseState(sv)：state 脏、服务器更新、写入方不是本页、opsOk 为真时，服务器版本进挂起槽，在同一次同步里上传 docAfter()（槽里的版本加 ops 里尚未上传的操作）"
  - "opsOk 为假时仍走 D-03（静默 keepConflict、整份上传本机版本、成功后冲突提示）"
  - "四条重做/分界用例，Phase 9 九条留底用例和退出确认的留底用例迁到离线构造（makeOfflineConflict）"
affects: [10-08, 10-09]

actuals:
  tokens: 11000
  tasks: 2
  commits: 2
plan_head_before: 419a41455407cb8da694213f38d281202dee3c79
plan_head_after: 10c8cbd14a0f554a5d33a319909abbbe9ff72dc6

tech-stack:
  added: []
  patterns:
    - "重做 = 槽里放服务器版本、基线移到它的 updated、缓存先写 docAfter() 的结果（脏）、上传 docAfter() 并记 sentOps；成功后槽里仍是同一个对象就换成已上传的内容，被取走就不动"
    - "在线晚一步 = 重做（两边保留、不留底）；任何一步离线失败过 = D-03（整份覆盖加留底）；两条路径以 opsOk 为界"
    - "Phase 9 的冲突用例造冲突的唯一方式是 makeOfflineConflict：设备二列表请求被拒（context 故障）→ 离线记一笔 → 设备一保存 → 撤故障并派发 online"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/remote-update.spec.ts
    - tests/cloud/conflict-snapshot.spec.ts
    - tests/cloud/logout.spec.ts

key-decisions:
  - "rebaseState 只负责槽、基线和脏缓存；构造上传数据（docAfter 的深拷贝）和 sentOps 仍在 syncOnce 里、紧接着同一段同步代码，列表返回之后到上传之间没有 await"
  - "clash 的判断不变（服务器 updated 与基线不同、写入方不是本页、内容不同），只是 opsOk 为真走重做、为假走 keepConflict；本页自己写入而答复丢失的情形 clash 为假，路径与 Phase 9 一致"
  - "上传失败时槽保留服务器版本、基线是它的 updated、缓存是 docAfter() 的脏版本；这时槽非空而本机脏，是 10-06“槽非空时本机干净”不变式的唯一例外，commit 的 takeRemote 本来就以 docAfter() 并入，所以安全"
  - "超时用例不在 15 秒后再放行，而是在重试的列表钩子里先 release 再让另一个参与者写：被放弃的上传和另一个参与者的写入在重试的列表读取之前依次生效，不依赖时钟边界"

requirements-completed: [SYNC-02, SYNC-03]

coverage:
  - id: D1
    description: "设备二干净、还没拉到设备一的记录时记一笔：服务器同时含两条，设备二没有留底和冲突提示，空闲时显示设备一的记录并提示已更新"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 an edit on a device that had not yet seen another device's change keeps both edits without a kept version"
        status: pass
    human_judgment: false
  - id: D2
    description: "上传途中又记的一笔只重做自己：E、F、X 各恰好一条、记录 id 不重复、已上传的 S local 没有盖掉之后的 S remote；另一台设备登录后看到同样的结果"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 an edit made while an earlier upload is in flight is replayed alone when another device's change arrives, with no duplicate entries"
        status: pass
    human_judgment: false
  - id: D3
    description: "上传超时被放弃、服务器已处理的七类操作在重做里再执行一次不产生重复项，任务仍未完成、力量历史当天一条、复盘和开始日期一致，另一参与者的 X 还在"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-02 replaying edits whose upload timed out but reached the server adds nothing twice"
        status: pass
    human_judgment: false
  - id: D4
    description: "同步在列表请求就离线失败后重新联网仍走 D-03：服务器是本机这份、另一台设备的版本在本机留底、冲突提示带下载入口"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/remote-update.spec.ts#SYNC-05 an edit whose sync failed at the list request keeps the other device's version here after reconnecting (D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Phase 9 的留底用例（单份替换、存不下、下载、下载失败、静默留底后提示、答复丢失）在离线构造下标题和断言不变地通过；完整 test:cloud 147 条通过、无 flaky；默认配置 app-integrity、storage、smoke 22 条通过（含 SAFE-02）"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "npm run test:cloud（BELOW_NORMAL，workers=1）：REPORT OK expected=147 flaky=0 unexpected=0；npm test app-integrity、storage、smoke：REPORT OK expected=22"
        status: pass
    human_judgment: false
  - id: D6
    description: "结果未知的上传之后若另一台设备又改了同一条目，重做会以本机这次操作为准把它改回本机的值（计划的 Edge 探针，D-04 条目级最后写入为准）"
    requirement: "SYNC-02"
    verification: []
    human_judgment: true
    rationale: "计划明确只断言不重复，不断言这一点；留给所有者对 D-04 的取舍确认"

duration: 18min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 07: 在线晚一步先应用远端再重做本机操作 Summary

**在线时晚一步看到别的设备修改的那台设备，不再整份覆盖对方：ops 完整（opsOk 为真）时服务器版本进挂起槽、本机尚未上传的操作按原顺序在它上面重做并在同一次同步里上传，两边都保留、不留底；任何一步离线失败过（opsOk 为假）仍走 D-03 整份覆盖加留底。**

## Performance

- **Duration:** 约 18 min
- **Started:** 2026-11-10T08:47Z
- **Completed:** 2026-11-10T09:06Z
- **Tasks:** 2
- **Files modified:** 5（应用 1、constants 1、cloud 用例 3）

## Accomplishments

### rebaseState 与 D-03 的分界

syncOnce 脏路径里，先照旧算出 `body=docAfter()` 的深拷贝和 `clash`（服务器 updated 与基线不同、写入方不是本页、内容不同），然后：

- `clash && opsOk`：`slot=rebaseState(ssv)`——槽里放服务器版本，`docs.state.base` 移到它的 updated，缓存先写 `docAfter()` 的脏版本；随后重新构造 `body=docAfter()` 并记 `sentOps=ops.length`（中间没有 await），上传。上传成功后若 `pendRemote.state===slot`（没人取走），槽换成 `{data:body, updated:up.updated}`，`gotRemote=true`，走 10-04 的收尾（`ops.splice(0,sentOps)`、touched 改为剩余操作的键、seq 没变才清 dirty），随后 `remoteDiffers()` 与 `maybeApplyView()` 决定是立即应用还是挂起横幅。上传失败：槽、新基线和脏缓存留着，下一次同步按普通脏数据处理（上传仍用 `docAfter()`）。
- `clash && !opsOk`：不变，静默 `keepConflict`、上传本机版本、成功后 `conflictNotice`。
- 没有做 logs 按 id 的通用合并或字段级合并（SYNC-F1 留到以后），只重做 ops 里尚未上传的操作。

### 两条重放用例的观察值

- **上传途中又记一笔：** 第一次上传带走 E 和把 S 改成 `S local`（`sentOps=2`），上传被挂住期间记 F；放行后上传成功、`ops.splice(0,2)` 之后 ops 里只剩 F，紧接着的同步在列表钩子里看到另一个参与者加了 X、把 S 改成 `S remote`：重做的只有 F（1 个操作），上传的是 `S remote`、E、F、X。最终服务器上 E、F、X 各恰好一条、记录 id 互不相同、S 是 `S remote`，没有留底；另一台设备登录后看到同样的结果，缓存里记录 id 互不相同。
- **超时已送达：** 七类共用序列按用例里的顺序共 12 个操作（8 个键，由序列推出，没有在页面里单独计数），都在同一次上传里，上传被挂住、约 15 秒后放弃；重试的列表钩子里先放行这次上传（服务器处理，此时已含全部修改），再由另一个参与者加 X；重试时 opsOk 仍为真（超时只置 retrying），于是以服务器版本为底把 12 个操作各再执行一次（run 幂等），上传。服务器这一段共 3 次 PATCH（被放弃的上传、另一个参与者的写入、重试的重做上传），结果：记录 id、自定义待办 id 都互不相同；A（改后文字）、B、X 各一条；自定义待办和预设标签各恰好一个；任务仍未完成；力量历史当天恰好一条且值等于保存的值；复盘和开始日期一致；没有留底。被中止的请求没有产生 console.error（没有需要确认的片段）。

### 迁移的留底用例

`conflict-snapshot.spec.ts` 新增 `openSecond`（设备二 manual 时钟，可装 init 脚本、可开下载）、`oneSaves`、`makeOfflineConflict`（设备二的列表请求被拒 → 离线记一笔 → 设备一保存 → 撤故障并可只对设备二的下一次 PATCH 再加 refuse 或 lose-answer 故障 → `setOffline(true)` 再 `(false)` 派发 online），迁了 8 条用例，标题和断言的留底内容、提示、下载入口、文件名都不变：单份替换（含第二轮冲突：设备一重新打开再记 third，设备二离线记 fourth）、下载、下载地址的回收、存不下、下载失败、静默留底后提示（PATCH refuse）、答复丢失（PATCH lose-answer）、保存覆盖。被拒连接的 console.error 一律按故障 `hits` 精确确认。`SYNC-05 a server version written by this same page…` 和启动时冲突两条没有改。另外 `logout.spec.ts` 里 `ACCT-02 logout with a kept version that was not downloaded names it in the confirmation` 也靠“设备二直接保存”造留底，改成同样的离线构造（见偏差）。

## Task Commits

1. **Task 1（tracer）：rebaseState 与四条用例** - `f507577`（feat）
2. **Task 2：留底用例迁移** - `10c8cbd`（test）

**Plan metadata:** 本提交之后的 docs 提交（SUMMARY、STATE、ROADMAP）

## Files Created/Modified

- `us-journey-tracker.html` - rebaseState 与脏路径的重做分支；APP_SHA256 重新记录
- `tests/support/constants.ts` - APP_SHA256
- `tests/cloud/remote-update.spec.ts` - 4 条新用例（共 10 条）及辅助函数
- `tests/cloud/conflict-snapshot.spec.ts` - openSecond、oneSaves、makeOfflineConflict，8 条用例迁移
- `tests/cloud/logout.spec.ts` - 留底确认用例迁移

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 阻塞] logout.spec.ts 的留底用例也依赖“设备二直接保存就冲突”**
- **Found during:** Task 2 的 verify（计划的命令把 logout.spec.ts 一起跑）
- **Issue:** `ACCT-02 logout with a kept version that was not downloaded names it in the confirmation` 靠设备二基线过期后直接保存造留底；重做分支上线后不再冲突，用例失败（41 过 1 败）。计划的文件列表没有它，但验收要求这四个 spec 全部 REPORT OK
- **Fix:** 同样的离线构造（设备二 manual 时钟、列表请求被拒、离线记一笔、设备一保存、撤故障派发 online），标题和断言不变，加被拒条数的确认
- **Files modified:** tests/cloud/logout.spec.ts
- **Verification:** 四个 spec 共 42 条 REPORT OK；完整 test:cloud 147 条 REPORT OK
- **Committed in:** 10c8cbd

**2. [用例设计] 超时用例的时序与计划字面不同**
- **Found during:** Task 1
- **Issue:** 计划写“runFor(15_000) 后状态 retrying，放行，再登记钩子，runFor 越过退避”。实测一秒一步推进时放弃与重试落在相邻两步里，状态 `retrying` 只在一步之间可见；`times:1` 的挂起放过了重试的上传，重试在钩子登记之前就以普通上传成功，用例没有走到重做
- **Fix:** 在被挂住的请求命中之后、放弃之前就登记列表钩子；钩子里先 `held.release()`（服务器处理被放弃的上传）再让另一个参与者写 X，然后一秒一步推进到钩子执行且已同步；用 PATCH 总数 3（被放弃的上传、另一个参与者、重试的重做上传）证明上传确实超时重试过。没有断言中间的 `retrying` 状态（它在 10-01 的超时用例里已断言）
- **Files modified:** tests/cloud/remote-update.spec.ts
- **Committed in:** f507577

---

**Total deviations:** 2（1 Rule 3、1 用例设计）。**Impact:** 没有范围扩大；第 1 条是计划自己的验收要求所需。

## Issues Encountered

无阻塞。第一次跑超时用例时因为上面第 2 条在“重试之前没有登记钩子”而没有走到重做，改时序后四条新用例和既有 remote-update、offline-sync 全部通过。

## Known Stubs

无。

## Threat Flags

无新增网络端点、认证路径或信任边界。T-10-20（在线晚一步覆盖别的设备）由 opsOk 分界加四条用例覆盖；T-10-28（重放服务器已收到的操作）由 sentOps 前缀移除加 run 幂等承担，“上传途中又记一笔”和“超时但已送达”两条用例精确复现并断言 id 不重复、远端之后的修改保留、七类条目无重复项。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 10-08（实时订阅，让同一条 syncOnce 路径提前发生）和 10-09（整体验证）。需要留意的两点：上传失败时槽非空而本机脏（见 key-decisions），commit 的 takeRemote 以 docAfter() 并入所以安全，但 10-08 的订阅若在这个状态下触发应用，应沿用 takeRemote 而不是直接替换 state；结果未知的上传之后的重做以本机操作为准（coverage D6），留给所有者确认。

## Self-Check: PASSED

- 修改的文件都在：us-journey-tracker.html、tests/support/constants.ts、tests/cloud/remote-update.spec.ts、tests/cloud/conflict-snapshot.spec.ts、tests/cloud/logout.spec.ts；本 SUMMARY 存在
- 提交：f507577、10c8cbd 在 HEAD 的祖先链上；`git rev-list --count 419a414..HEAD` 在写本文件前为 2
- 验收：应用含 `rebaseState`；五个锚点各一次；APP_SHA256 等于文件 sha256；conflict-snapshot.spec.ts 含 `makeOfflineConflict`
- 验证：test:cloud remote-update + offline-sync：REPORT OK expected=22；conflict-snapshot + offline-sync + logout + remote-update：REPORT OK expected=42；完整 test:cloud：REPORT OK expected=147 flaky=0 unexpected=0；默认配置 app-integrity、storage、smoke：REPORT OK expected=22（含 SAFE-02）
- 两次暂存后隐私检查都打印“隐私检查通过”

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
