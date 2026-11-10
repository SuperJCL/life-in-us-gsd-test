---
phase: 10-offline-realtime-sync
plan: 01
subsystem: sync
tags: [offline, retry-backoff, requestSync, touched-set, status-line, playwright, fake-pocketbase]

requires:
  - phase: 09-login-cloud-storage
    provides: "云端登录、本机缓存 usj:v2:<id>:state、cloudSave 的冲突留底规则、假服务器故障开关"
provides:
  - "requestSync / syncOnce 单线程同步入口：列表 GET 比对基线 → PATCH 上传；请求合并；Promise 在覆盖本次请求的那一轮结束后才 resolve"
  - "失败分类：请求没到达 → offline；5xx、429、其他 4xx、15 秒无答复 → retrying；超限 → toolarge 不重试"
  - "退避重试 1、2、5、10、30、60 秒（封顶 60），永不放弃，不清脏标记（修 B5）；online 事件立即重试；立即重试按钮"
  - "缓存记录新字段 touched（待上传条目键集合）；persist(...keys)；记一笔按 log:<id> 计 1 项"
  - "状态行 saving / synced / offline / retrying 如实切换，setStatus 第三参数（行内按钮）"
affects: [10-02, 10-03, 10-04, 10-05, 10-06, 10-07, 10-08, 10-09]

actuals:
  tokens: 12155
  tasks: 3
  commits: 3
plan_head_before: 8d98f8c018fcfe1c677afe688ce6255f38cfe59d
plan_head_after: d2713e0bbd9e9342e7d87118e21c2e79ad97bf2e

tech-stack:
  added: []
  patterns:
    - "云端保存只发起同步（requestSync），脏标记只在上传成功且 seq 没变时清除"
    - "倒计时用 1 秒 setInterval 的计数器驱动，不用 Date.now（用例会冻结 Date）"
    - "持续故障下的页面用 manual 时钟，console.error 条数 = 实际被拒请求数"

key-files:
  created:
    - tests/cloud/offline-sync.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/capacity.spec.ts
    - tests/cloud/conflict-snapshot.spec.ts
    - tests/cloud/logout.spec.ts
    - tests/cloud/reconcile-gate.spec.ts
    - tests/cloud/session.spec.ts

key-decisions:
  - "syncOnce 失败分类：timedOut 或 status 不是 0 → retrying；status 为 0 且不是本页超时 → offline；其余未知异常也按 retrying（不说成离线）"
  - "离线时的后台尝试不改状态行；retrying 期间重试进行中显示 保存中…；缓存写不进去时 offline 和 retrying 都显示完整的 保存失败：本机空间不够… 一句且不带行内按钮"
  - "persist 在状态行当前是 toolarge 时不改状态行，避免 toolarge 与 保存中… 来回闪"
  - "requestSync 的循环用 sessionEpoch 守卫：换会话后旧循环不会再跑 syncOnce，也不会把新会话的 syncing 标志清掉"
  - "settle 只给 state 记录加 touched（plan 记录形状不变）"

patterns-established:
  - "requestSync 返回的 Promise 只在覆盖本次请求的那一轮 syncAgain 循环结束后 resolve，从不 reject"
  - "状态行 = 一个文字节点 + 至多一个行内按钮；用例取第一个文字节点比对句子，按钮文字单独比对"

requirements-completed: [SYNC-03, SYNC-04, SYNC-06]

coverage:
  - id: D1
    description: "断网（服务器连不上）时照常记一笔，修改先写进本机缓存（dirty、touched=[log:<id>]），状态行 offline 并带数量，不弹横幅；online 事件后自动上传，数量归零，状态回到已同步，第二台设备读到这条记录"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 an entry made while the server is unreachable is kept on this device, counted in the offline status and uploaded when the connection returns"
        status: pass
    human_judgment: false
  - id: D2
    description: "云端保存失败不清脏标记并自动退避重试（1、2、5、10 秒…，封顶 60 秒），retrying 状态行带倒计时和 立即重试 按钮，去掉故障后上传成功且服务器只有一条（修 B5）"
    requirement: "SYNC-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-06 a server error is retried automatically at growing intervals and the retry-now button tries at once"
        status: pass
    human_judgment: false
  - id: D3
    description: "挂住的保存请求约 15 秒后中止，转 retrying 而不是一直停在上一个状态（WR-02）；放行后下一次重试成功，服务器上只有一条记录，没有留底"
    requirement: "SYNC-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-06 a save that gets no answer is abandoned after about 15 seconds and retried instead of hanging"
        status: pass
    human_judgment: false
  - id: D4
    description: "状态行在 保存中…、已同步 之间如实切换；本机缓存写不进去时不说假话（不说修改已存在本机）；Phase 9 的临时保存失败状态键从应用和用例里退役"
    requirement: "SYNC-04"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-04 a save shows saving and then synced"
        status: pass
      - kind: e2e
        ref: "tests/cloud/capacity.spec.ts#SYNC-01 an edit that could not be written to the local cache is reported and never described as kept on this device"
        status: pass
    human_judgment: false
  - id: D5
    description: "旧路径（Claude / localStorage）保存行为和状态文案不变：完整的默认 npm test 176 条全部通过，含 SAFE-02"
    requirement: "SYNC-04"
    verification:
      - kind: e2e
        ref: "npm test（默认配置，workers=1，BELOW_NORMAL）：176 passed，REPORT OK expected=176 flaky=0 unexpected=0"
        status: pass
    human_judgment: false

duration: 21min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 01: 离线保存与退避重试 Summary

**云端路径的保存改成“先存本机、单线程 requestSync/syncOnce 同步、失败按 1/2/5/10/30/60 秒退避重试且永不清脏标记”，状态行如实显示 saving / synced / offline（带待上传数量）/ retrying（倒计时 + 立即重试），修掉 B5 和 WR-02。**

## Performance

- **Duration:** 21 min
- **Started:** 2026-11-10T06:52:05Z
- **Completed:** 2026-11-10T07:13:14Z
- **Tasks:** 3
- **Files modified:** 9（应用 1、支撑文件 2、cloud 用例 6，其中 offline-sync.spec.ts 新建）

## Accomplishments

- **同步入口：** `requestSync(reason)` 保证同一时刻只有一个同步在跑，期间到来的请求合并成随后的一次补跑；返回的 Promise 只在覆盖本次请求的那一轮循环结束后 resolve，从不 reject（10-07、10-08 依赖这一点）。`syncOnce()` 每次新建 AbortController，15 秒（`SYNC_MS=FAIL_MS`）到期中止；先对脏的本机 state 做 `sizeCheck`（超限不发请求，toolarge，不重试），再 `getFullList` 取回 state 文档，真冲突照 Phase 9 规则先静默 `keepConflict`，上传成功后才提示；只有 seq 没变才清 dirty 和 touched。
- **失败分类与重试规则（最终）：** 超限 → toolarge（不重试）；`timedOut`、任何 HTTP 状态（5xx、429、其他 4xx，含找不到 state 文档的 404）、其他非网络异常 → `retrying`；status 为 0 且不是本页超时 → `offline`。两种都按 `RETRY_STEPS[min(retryIdx,5)]` 排下一次，成功后 retryIdx 归零。`online` 事件、`立即重试` 按钮都会清掉定时器并立刻 `requestSync`。
- **touched 集合（D-07 接通第一条路径）：** `persist(...keys)` 把键并入缓存记录的 `touched`，`addLog` 先生成 id 再 `persist("log:"+id)`；enterApp 还原、settle 在 held 时保留、干净时清为空数组。其余调用点留给 10-04。
- **状态行：** `showSync()` 统一写 saving / synced / offline / retrying；`setStatus` 增加第三参数（行内按钮）；CSS 加 `.status button`，去掉旧的临时失败状态键。缓存写不进去时 offline 和 retrying 都改成完整的 `保存失败：本机空间不够…` 一句（WR-05 不说假话）。
- **旧代码移除：** `cloudSave` 连同 `cloudStore()` 里的 `save` 字段整词移除（grep 0 次）；Phase 9 的 `STATUS_SAVE_FAILED_CLOUD` 从 strings.ts 和 7 个用例中退役。
- **用例基线：** 动手前实测 cloud 114 条（14 个文件）、默认 176 条（40 个文件），与计划一致；现在 cloud 为 118 条（新增 SYNC-03 一条 + Task 2 三条，其余为迁移）。

## Task Commits

1. **Task 1：tracer（断网记一笔 → offline 状态与数量 → online 事件 → 上传、数量归零 → 第二台设备读到）** - `7efd027` (feat)
2. **Task 2：失败分类与 retrying、退避、15 秒中止、保存中到已同步、缓存写不进去的文案** - `91468c2` (feat)
3. **Task 3：把 Phase 9 依赖旧保存失败状态的用例迁到新状态** - `d2713e0` (test)

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## 迁移了哪些 Phase 9 用例

| 文件 | 用例（标题不变） | 故障路径 | 时钟 | 状态断言 | 实测 console.error |
|---|---|---|---|---|---|
| session.spec.ts | ACCT-01 an auth-refresh 401 at startup…、ACCT-01 signing in again…（共用 leaveUnsentEditThenRevoke） | refuse 列表 GET + 单条 PATCH（原为单条 GET + PATCH） | manual（原本即是） | `statusOffline(1)`，data-state offline | ERR_CONNECTION_REFUSED 1（只有列表 GET 被拒，PATCH 没发出） |
| logout.spec.ts | ACCT-02 logging out in one tab asks first…（第二个标签页） | PATCH refuse | 第二个标签页由 setFixedTime 改为 install + pauseAt + runFor(1000) | `statusOffline(1)` | ERR_CONNECTION_REFUSED 1 |
| logout.spec.ts | ACCT-02 signing in as another account after an expiry… | refuse 列表 GET + 单条 PATCH | manual（原本即是） | `statusOffline(1)` | ERR_CONNECTION_REFUSED 1 |
| conflict-snapshot.spec.ts | SYNC-05 a conflict is kept silently before the upload…（被拒的上传） | PATCH refuse times:1 | 设备二 `openDevice({clock:'none'})` + install/pauseAt，之后的成功上传由 runFor(1000) 触发 | `statusOffline(1)` | ERR_CONNECTION_REFUSED 1 |
| conflict-snapshot.spec.ts | SYNC-05 a conflict whose overwrite reached the server but whose answer was lost… | PATCH lose-answer times:1 | 同上 | `statusOffline(1)` | ERR_CONNECTION_RESET 1 |
| reconcile-gate.spec.ts | SYNC-05 an edit kept in the cache on top of the current server version is uploaded by the reconcile | PATCH refuse（原本即是 PATCH，列表 GET 正常） | manual（原本即是） | `statusOffline(1)` | ERR_CONNECTION_REFUSED 1 |
| capacity.spec.ts | SYNC-01 an edit that could not be written to the local cache…（Task 2） | PATCH refuse times:1 | 包进 describe + manual 时钟，两次提交后各 runFor(1000) | `STATUS_SAVE_FAILED_NO_CACHE`，data-state offline；改用 `not.toContainText('已存在本机'/'修改仍在本机')` | ERR_CONNECTION_REFUSED 1 |

offline-sync.spec.ts 新用例的实测计数：SYNC-03 为 ERR_CONNECTION_REFUSED 1；SYNC-06 退避用例的 `status of 503 ` 条数等于 faultHits（共 6：初次失败 1、四个退避等待各 1、立即重试 1）。完整默认 `npm test`：176 条，REPORT OK（expected=176 flaky=0 unexpected=0），含 SAFE-02。迁移后的五个 spec 加 offline-sync 共 41 条，`--retries=0` 一次通过，REPORT OK（expected=41 flaky=0 unexpected=0）。

## TDD 记录（Task 2，tdd="true"）

- **RED：** 先把三条新用例写进 offline-sync.spec.ts，用 Task 1 的应用跑（未提交，因为计划约束“每个任务一次提交”，verify 里的 git add 也是一次性暂存）。两条目标用例在计划断言上失败：`SYNC-06 a server error is retried automatically…` 和 `SYNC-06 a save that gets no answer is abandoned…` 都报 `toHaveAttribute('data-state','retrying')` 期望 `retrying`、实际 `offline`（5xx 和 15 秒无答复在 Task 1 都被当作离线）。`SYNC-04 a save shows saving and then synced` 在 Task 1 已经通过，作为回归守护保留。
- **语义评估：** 失败的是目标用例本身，失败在计划里写明的“状态应是 retrying”这一断言上；不是语法、夹具或零用例问题。因为没有按 format 产出独立 RED 记录，未运行 `gsd_run check tdd-red-evidence`。
- **GREEN：** 同一提交 `91468c2` 里实现分类和 retrying 状态行，三条用例加 Task 1 的两条和 capacity 的用例全部通过。
- **REFACTOR：** 无。
- 因为计划把三个任务各限定为一次提交，没有单独的 `test(10-01)` RED 提交；`test(10-01)` 前缀只出现在 Task 3 的迁移提交上。

## Decisions Made

见 frontmatter 的 key-decisions。要点：失败分类里未知异常也归 retrying，避免把代码错误说成“离线”；showSync 在 toolarge 状态下由 persist 触发时让位；循环和 finally 都用 sessionEpoch 守卫，换会话时旧循环不会和新会话的循环并行。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 我自己写的退避用例里，立即重试失败后的下一次等待写成了 30 秒**
- **Found during:** Task 2（GREEN 验证）
- **Issue:** 用例期望点 `立即重试` 失败后显示 30 秒，实际按 RETRY_STEPS 顺序是 60 秒（第六次失败）；是用例推算错，不是应用问题
- **Fix:** 期望改为 `statusRetrying(60)`，并注明是封顶值
- **Files modified:** tests/cloud/offline-sync.spec.ts
- **Verification:** 该用例在 `--retries=0` 下通过，全套再跑通过
- **Committed in:** 91468c2

**2. [Rule 3 - Blocking] 用例里 `-g "A|B"` 在 Windows 下被 shell 当作管道**
- **Found during:** Task 2 RED 运行
- **Issue:** `spawnSync(... shell:true)` 经 cmd 执行，`|` 被当成管道；只影响我自己的过滤命令，不影响计划里的 verify
- **Fix:** 改用 `-g "SYNC-0[46]"`；日志写到临时目录（Playwright 会清空 test-results，会把放在那里的日志删掉）
- **Files modified:** 无（只是运行方式）

### 计划执行中的取舍（非偏差，记录备查）

- **提交署名：** 编排器的补充规则要求署名行为 `Co-Authored-By: Claude Opus 5.5`，而执行环境的 attribution 说明给的是 `Claude Sonnet 5.5`，计划正文也写“按执行环境的 attribution 说明写，计划里不写死模型名”。三个任务提交都按执行环境给出的署名（Sonnet 5.5）写，这是实际执行的模型。如所有者要统一成别的写法，需要改写提交信息，我没有改写历史。
- **TDD 提交形态：** 见上一节，RED 只在本地运行验证，没有单独提交，遵守“每个任务一次提交”。

---

**Total deviations:** 2 auto-fixed（1 个用例推算错误，1 个运行方式问题）
**Impact on plan:** 无范围变化；应用行为与计划一致。

## Issues Encountered

- 无阻塞问题。`tests/cloud/logout.spec.ts` 在工作区是 CRLF 行尾，其余文件是 LF；编辑时按原行尾保留（git 有 autocrlf，提交内容不受影响）。
- 持续故障下用 `runFor` 做时序断言时，每一步都先等响应处理完（`expect.poll` 状态行或 faultHits）再继续推进时钟，避免“请求结果还没回来时钟已走远”的不确定性；本计划的新用例连续运行没有出现不稳定。

## Known Stubs

无。

## Threat Flags

无。本计划只在已有的云端同步路径上改动，没有新增网络端点、认证路径或信任边界。T-10-01 到 T-10-05 的缓解都有对应用例。

## User Setup Required

无——不需要任何外部服务配置。

## Next Phase Readiness

- 10-02 起可以直接沿用 `requestSync` / `syncOnce` / `showSync` / `touched` / `net`；10-03 要补“服务器上找不到 state 文档时重建”（现在按失败处理，404 → retrying），以及“打开应用时连不上”。
- 10-04 把其余 `persist()` 调用点接上条目键，并把成功后的清空改成“只保留上传开始之后才做的操作的键”。
- 本计划没有跑完整的 test:cloud（计划要求在 10-08、10-09 运行）。

## Self-Check: PASSED

- 文件都在：us-journey-tracker.html、tests/cloud/offline-sync.spec.ts、tests/support/strings.ts、tests/support/constants.ts、tests/cloud/capacity.spec.ts、session.spec.ts、logout.spec.ts、conflict-snapshot.spec.ts、reconcile-gate.spec.ts。
- 提交都在当前分支：7efd027、91468c2、d2713e0（`git merge-base --is-ancestor` 均成立）。
- 验收：应用含 requestSync、syncOnce、RETRY_STEPS、`离线，`、`addEventListener("online"`、`touched`、`立即重试`、`秒后自动重试`、`.status button`；`cloudSave`、`savefailed`、`STATUS_SAVE_FAILED_CLOUD` 都是 0 次；五个锚点各一次；APP_SHA256 等于文件 sha256；cloud `--list` Task 1 后是 115 条；每个提交暂存后隐私检查都打印“隐私检查通过”。

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
