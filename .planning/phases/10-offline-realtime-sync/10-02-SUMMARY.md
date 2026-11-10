---
phase: 10-offline-realtime-sync
plan: 02
subsystem: testing
tags: [fake-pocketbase, realtime, sse, probe, playwright, sdk-reconnect]

requires:
  - phase: 09-login-cloud-storage
    provides: "假服务器的 fault 开关（refuse、status、hold、lose-answer）、PROBE-9、openDevice"
  - phase: 10-offline-realtime-sync
    provides: "10-01 的离线保存和退避重试（本计划不改应用，只共用 test:cloud 的运行次序）"
provides:
  - "FakePbServer.dropRealtime(target?)：先注销连接再让页面里的假 EventSource 触发 error，真实 SDK 走自己的重连"
  - "FakePbServer.refuseRealtime(on, target?) 与只读计数 realtimeRefusals：握手被拒、不派发 PB_CONNECT"
  - "PbFault.context：只匹配某个浏览器上下文发出的请求；未带 context 的规则行为不变"
  - "writes[].writer：每次成功的创建或更新记下请求里的 writer"
  - "PROBE-10a、10b、10c 和 tests/PROBES.md 的 PROBE-10 一节：ROADMAP 四个调研问题的本地答案"
affects: [10-03, 10-04, 10-05, 10-06, 10-07, 10-08, 10-09]

actuals:
  tokens: 10500
  tasks: 2
  commits: 2
plan_head_before: ff9c02f04360732f67fded0c5cd6d9b7f9aaf98e
plan_head_after: d60801c29eb8896873b127a5bb947b4c10b3e09a

tech-stack:
  added: []
  patterns:
    - "实时故障只用假服务器的开关制造（dropRealtime、refuseRealtime、fault.context），不用计时器、不用 setOffline"
    - "探针观察值先进 testInfo.annotations 和终端（PROBE-10 前缀），再把断言写死"
    - "包一层 window.fetch 数 POST /api/realtime 的 204，让 PB_CONNECT 回调能证明‘回调触发时订阅已生效’"

key-files:
  created: []
  modified:
    - tests/mocks/pb-server.ts
    - tests/mocks/pb-runtime.ts
    - tests/mocks/PB-CONTRACT.md
    - tests/cloud/pb-faults.spec.ts
    - tests/cloud/probes-cloud.spec.ts
    - tests/PROBES.md

key-decisions:
  - "fault 的 context 直接取 attach 的那个 context（路由本来就是按 context 注册的），不再从 request.frame().page().context() 反推，语义相同且不会因取不到 frame 而漏匹配"
  - "同时订阅 PB_CONNECT 与 journey_docs/* 要用 Promise.all 并发：SDK 只握手一次、一次 POST 带两个订阅串，PB_CONNECT 计数和 204 计数才与计划一致"
  - "每次 PB_CONNECT 都整份对账；首次连接失败后应用自己重新订阅；两条结论都不依赖真实服务器是否补发"

patterns-established:
  - "dropRealtime 先在 Node 侧注销连接再在页面里触发 error：断开期间的写入和 emit 不投给它，重连后也不补发"
  - "refuseRealtime 的握手结果 { refused: true } 在页面侧置 readyState 2 并异步派发 error，不派发 PB_CONNECT"

requirements-completed: [SYNC-02, SYNC-03]

coverage:
  - id: D1
    description: "dropRealtime 之后连接数立即为 0，真实 SDK 0.28.1 随后重连（PB_CONNECT 计数 2、POST /api/realtime 的 204 共 2 次），重连后推送的一条事件恰好送达一次"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 dropping the realtime connection makes the SDK reconnect and resubmit its subscriptions"
        status: pass
    human_judgment: false
  - id: D2
    description: "refuseRealtime 期间 realtimeRefusals 持续增加而 PB_CONNECT 计数不变，放开后连接数回到 1"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 refusing realtime keeps the SDK retrying until realtime is allowed again"
        status: pass
    human_judgment: false
  - id: D3
    description: "带 context 的 refuse 规则只让第二台设备的列表请求失败（faultHits 恰好 1），第一台设备成功；pb-contract.spec.ts 的 38 条契约自测照旧通过，未带 context 的规则行为不变"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 a fault limited to one browser context leaves the other context untouched"
        status: pass
      - kind: e2e
        ref: "tests/cloud/pb-contract.spec.ts（10-02 verify 中 49 条全部通过，REPORT OK expected=49 flaky=0 unexpected=0）"
        status: pass
    human_judgment: false
  - id: D4
    description: "writes 的最后一条带着请求里的 writer，path 为 journey_docs:state"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 every write records the writer id it was sent with"
        status: pass
    human_judgment: false
  - id: D5
    description: "PROBE-10a、10b、10c 在假服务器上可重复通过并把观察值记进 annotations：每次重连后 PB_CONNECT 监听都再被调用一次且回调触发时订阅已生效；首次连接失败时 SDK 不再自己尝试；断开期间的事件重连后没有补发"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/probes-cloud.spec.ts#PROBE-10a the SDK calls PB_CONNECT listeners again after every reconnect"
        status: pass
      - kind: e2e
        ref: "tests/cloud/probes-cloud.spec.ts#PROBE-10b the SDK does not retry a first realtime connection that fails"
        status: pass
      - kind: e2e
        ref: "tests/cloud/probes-cloud.spec.ts#PROBE-10c events sent while realtime is down are not replayed after the reconnect"
        status: pass
    human_judgment: false
  - id: D6
    description: "tests/PROBES.md 的 PROBE-10 一节逐条回答 ROADMAP 的四个调研问题并注明本地来源"
    requirement: "SYNC-02"
    verification: []
    human_judgment: true
    rationale: "文档内容是否准确、够后续计划引用，没有测试断言；只有结论总表三行和 PB_CONNECT 关键词由 verify 里的 grep 检查"

duration: 12min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 02: 实时断开、实时拒绝与 PROBE-10 Summary

**假服务器新增 dropRealtime、refuseRealtime、按上下文限定的 fault 和 writes 的 writer，四个开关各有自检；PROBE-10a/10b/10c 证明 SDK 0.28.1 每次重连都会再调用 PB_CONNECT 监听（回调时订阅已生效）、首次连接失败不重试、断开期间的事件不补发，四个调研问题的本地答案写进 tests/PROBES.md。**

## Performance

- **Duration:** 约 12 min
- **Started:** 2026-11-10T07:15Z（按上一个提交时间推算）
- **Completed:** 2026-11-10T07:25Z
- **Tasks:** 2
- **Files modified:** 6（测试设施 3、用例 2、文档 PROBES.md；PB-CONTRACT.md 计入设施）

## Accomplishments

### 四个开关的接口与自检

| 开关 | 接口 | 自检用例（pb-faults.spec.ts） | 结果 |
|---|---|---|---|
| 实时断开 | `await fake.dropRealtime(target?: Page \| BrowserContext): Promise<number>`，返回断开的连接数；先 `connections.delete` 再 `page.evaluate(__pbEsFail)`，异常记进 `deliveryErrors` | `TEST-02 dropping the realtime connection makes the SDK reconnect and resubmit its subscriptions` | 通过；断开后连接数立即 0，PB_CONNECT 计数 2，204 共 2 次，重连后 emit 的一条事件恰好 1 条 |
| 实时拒绝 | `fake.refuseRealtime(on, target?)`、只读 `fake.realtimeRefusals`；`es.open` 命中目标时返回 `{ refused: true }` 并计数；`clearFaults()` 一并撤销 | `TEST-02 refusing realtime keeps the SDK retrying until realtime is allowed again` | 通过；被拒至少 2 次时 PB_CONNECT 计数仍为 1，放开后为 2、连接数 1 |
| 按上下文限定的故障 | `fault({ ..., context })`；`matchFault(method, path, context)` 只匹配同一上下文，无 context 的规则不变 | `TEST-02 a fault limited to one browser context leaves the other context untouched` | 通过；第二台设备列表失败（status 0）、第一台成功，faultHits 恰好 1，ERR_CONNECTION_REFUSED 1 条已确认 |
| writes 的 writer | `writes[]` 元素新增 `writer: string`（创建和更新两处，没有时为空串） | `TEST-02 every write records the writer id it was sent with` | 通过 |

页面侧（`pb-runtime.ts`，仍自包含）：握手 `{ refused: true }` 时 readyState 置 2 并异步派发 `error`（同时调用 `onerror`），不派发 PB_CONNECT；新增 `window.__pbEsFail(connectionId)`：从 `live` 删除、置 readyState 2、派发 `error`，返回是否找到。`PB-CONTRACT.md` §10 加四行（都标明“测试设施，没有录制样本”），§4 把“SSE 断开、乱序事件留给 Phase 10”改成“断开和拒绝由 dropRealtime、refuseRealtime 提供；乱序不模拟，应用每次按服务器 updated 与基线比较并整份读取”。`INTENTIONAL_DEVIATIONS` 保持为空。

四条新自检用 `--repeat-each=4` 连跑 16 次全部通过，没有出现不稳定。

### PROBE-10 的观察值

| 探针 | 观察值 |
|---|---|
| 10a | `connectLog` 三项：`rtOk` 依次为 1、2、3，`sentJourney` 全为 true；`distinctClientIds=3`；`posts204=3` |
| 10b | 订阅 reject（`ClientResponseError`，status 0）；等 3 秒后 `refusals=1, connections=0`；放开后再等 1.5 秒仍是 `refusals=1, connections=0` |
| 10c | 断开期间 emit 两条后页面 0 条；重连后（再等 0.5 秒）`eventsAfterReconnect=0`；再 emit 一条后 `eventsAfterNewEmit=1` |

用例里把 `window.fetch` 包了一层，在 SDK 处理响应之前给 `POST /api/realtime` 的 204 计数，所以 PB_CONNECT 回调里读到的 `rtOk` 就是回调触发时已经得到的 204 次数。

### 四个调研问题的结论（供 10-03 到 10-09 引用）

1. **SSE 断线后补不补发？** SDK 重连是新建 EventSource、新 clientId、重新提交订阅，没有续传；假服务器也不补发（10c）。真实服务器行为本地无法录制，设计不依赖它：**每次 PB_CONNECT 都整份对账**（与 06-PROBE-RESULTS 一致）。
2. **PB_CONNECT 之后何时对账？** SDK 在订阅提交成功之后才调用监听（10a），所以**在 PB_CONNECT 回调里立即发起后台对账**就关闭了“读取之后、订阅之前”的空窗；订阅放在首次对账完成之后，由第一次 PB_CONNECT 触发的对账补空窗（10-08）。真实 0.41.1 接受 `PB_CONNECT` 订阅串的依据是 Phase 6 探针页 `tools/probe/page/probe.js` 在真实实例上的同样写法。
3. **fields 对事件载荷：** 更新事件的 record 只剩 `id`、`kind`、`writer`、`updated`（PB-CONTRACT realtime-update-fields、RT-4），应用只用这四个字段判断是否需要对账，整份数据用列表读取。
4. **manual 时钟下怎么测断网和退避：** SDK 重连间隔（200–2000 毫秒）、应用退避、60 秒拉取都是页面定时器，用 `runFor` 推进；服务器侧故障和 SSE 断开只用假服务器开关；`setOffline` 只改 `navigator.onLine` 和 online/offline 事件（PROBE-9a），管不到假服务器的请求和假 EventSource（9b、9c）。
5. **额外：** 首次连接失败 SDK 不重试（10b），应用必须在之后一次成功的对账后自己重新订阅（10-09）；已连上之后的断开 SDK 自己无限次重试。

## Task Commits

1. **Task 1：假服务器的实时断开、实时拒绝、按上下文限定的故障和 writes 的 writer，各带自检** - `b264f93` (feat)
2. **Task 2：PROBE-10 证明 SDK 0.28.1 的重连行为，并把四个调研问题的本地答案写进 tests/PROBES.md** - `d60801c` (test)

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

None - 计划按原样执行。一处实现上的细化（不是偏差）：计划写“用 `route.request().frame().page().context()` 取发起请求的上下文”，实现里直接用 `attach(context)` 闭包里的 `context`，因为路由本来就是逐 context 注册的，二者等价，且不依赖 frame 能否取到。

**Total deviations:** 0
**Impact on plan:** 无。

## Issues Encountered

- 无阻塞问题。运行单个 spec 的临时命令在 Windows 上要避开 `|` 和 `shell:true`（`-g` 里的竖线会被 cmd 当成管道），改用 `node node_modules/@playwright/test/cli.js` 直接调用做重复运行验证；plan 里的 verify 命令不受影响，已按原样跑过两次并通过。
- 提交署名按执行环境给出的 `Co-Authored-By: Claude Sonnet 5.5`，与 10-01 一致。
- 工作区里 `tests/mocks/*`、`tests/PROBES.md`、`probes-cloud.spec.ts` 是 CRLF，`pb-faults.spec.ts` 编辑时按原行尾保留。

## Known Stubs

无。

## Threat Flags

无。本计划只改测试设施和文档，没有新增网络端点、认证路径或应用侧信任边界。T-10-06（开关被当成真实契约）：PB-CONTRACT §10 每行标明“测试设施，没有录制样本”，`INTENTIONAL_DEVIATIONS` 为空，38 条契约自测在 verify 里照常通过；T-10-07：新用例只用合成账号，没有打印口令或令牌，两次提交前的隐私检查都通过。

## User Setup Required

无——不需要任何外部服务配置。

## Next Phase Readiness

- 10-03 起可以在假服务器上制造 SSE 断开、实时拒绝和“只有一台设备连不上”，并断言写入方 id（ROADMAP SC3 和 WR-01 的测试前提）。
- 本计划没有跑完整 test:cloud 和默认 `npm test`（计划约定在 10-08、10-09 运行）；跑过的 spec 为 pb-faults、pb-contract、cloud-harness（49 条）和 probes-cloud（6 条），全部通过。

## Self-Check: PASSED

- 文件都在：tests/mocks/pb-server.ts、tests/mocks/pb-runtime.ts、tests/mocks/PB-CONTRACT.md、tests/cloud/pb-faults.spec.ts、tests/cloud/probes-cloud.spec.ts、tests/PROBES.md。
- 提交都在当前分支：b264f93、d60801c（`git rev-list --count ff9c02f..HEAD` 为 2）。
- 验收：pb-server.ts 含 dropRealtime、refuseRealtime、realtimeRefusals；pb-runtime.ts 含 __pbEsFail；PB-CONTRACT.md 含 dropRealtime、refuseRealtime；PROBES.md 含 PROBE-10a、10b、10c、PB_CONNECT；Task 1 的 check-report 为 REPORT OK expected=49 flaky=0 unexpected=0（含 Phase 9 的 hold 开关自检），Task 2 为 REPORT OK expected=6 flaky=0 unexpected=0（含 PROBE-9a）；两次暂存后隐私检查都打印“隐私检查通过”；应用文件未改动、APP_SHA256 未动。

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
