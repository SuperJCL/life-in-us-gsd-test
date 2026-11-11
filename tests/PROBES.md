# 运行时探针结论（PROBE-1 到 PROBE-10）

这些探针验证后续阶段依赖的运行时假设。PROBE-1 到 PROBE-8 对应 `tests/e2e/platform/probes.spec.ts`，每次 `npm test` 都会运行；PROBE-9、PROBE-10 对应 `tests/cloud/probes-cloud.spec.ts`，在 `npm run test:cloud` 里运行。假设哪天不成立，用例会变红。

## 运行环境

| 项目 | 值 |
|------|----|
| 记录日期 | 2026-11-02（PROBE-9 于 2026-11-08、PROBE-10 于 2026-11-10 记录，浏览器和 Playwright 版本不变） |
| @playwright/test | 1.64.1（精确锁定） |
| `browser.version()` | 156.0.4314.58（本机 Edge，`channel: 'msedge'`，无界面） |
| Node 主版本 | 24 |
| 系统 | Windows 11 |

不记录任何本机路径，包括 Edge 的安装路径。

## 结论总表

| 编号 | 探针 | 用例标题 | 结论 | 证据（观察值） | 采用的方案 |
|------|------|----------|------|----------------|------------|
| PROBE-1 | Edge 无界面启动并报告版本 | `PROBE-1 msedge launches headless and reports browser.version()` | 通过 | 156.0.4314.58 | 保持 `channel: 'msedge'` |
| PROBE-2a | 解析层：`--host-resolver-rules` | `PROBE-2 --host-resolver-rules makes non-excluded hostnames unresolvable` | 通过 | `localhost` 与 `probe.localhost` 都是 `ERR_NAME_NOT_RESOLVED`；`127.0.0.1` 返回 404；去掉规则的对照浏览器里 `localhost` 返回 404 | 保留规则；对直连的名字有效 |
| PROBE-2b | 代理层：死代理 | `PROBE-2 the dead-end proxy rejects non-loopback traffic and still lets 127.0.0.1 load` | 通过 | `http://` 和 `https://` 的 `probe.invalid` 都是 `ERR_PROXY_CONNECTION_FAILED`；`127.0.0.1` 返回 404 | 保留死代理 `127.0.0.1:9`，端口无需更换 |
| PROBE-2c | route 看不到的 WebSocket 会交给代理，应用不再连字体主机 | `PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy and the app opens no font-host connection` | 通过 | WebSocket 对照行 `CONNECT probe.invalid:80` 出现在录制代理；字体主机的 CONNECT 为 0 条，且现在是断言 | Phase 9 起应用没有字体 link 和 preconnect，字体主机行由“只记录”改为断言为 0（INFRA-03 的回归检查），见下文 |
| PROBE-3 | `setFixedTime` 在 reload 后保持 | `PROBE-3 setFixedTime survives page.reload()` | 通过 | reload 前后 `Date.now()` 都是 1773835200000 | 无需在 reload 前重新冻结 |
| PROBE-4 | `expect.poll` 读取防抖保存 | `PROBE-4 expect.poll observes the debounced localStorage save` | 通过 | 三次耗时 1012、960、975 ms（都在 500 到 5000 ms 之间） | 默认的 `expectPersisted` 即可 |
| PROBE-5 | `dragTo` 驱动 HTML5 拖放 | `PROBE-5 dragTo drives HTML5 drag and drop in the week view` | 通过（方案 A） | 条目从 2026-03-16 拖到 2026-03-19，落盘日期变化，目标列可见 | 方案 A：`dragTo(..., { steps: 10 })` |
| PROBE-6 | `clock.install` 加 `pauseAt` 后的稳定性检查 | `PROBE-6 clock.install with pauseAt keeps actionability checks working` | 通过 | 暂停后点击标签、记一笔、toast 出现，`runFor(1800)` 后消失，保存落盘 | install、open、pauseAt、runFor 的顺序可用 |
| PROBE-7 | `exposeBinding` 在页面脚本运行前可调用 | `PROBE-7 exposeBinding is callable from an init script before any page script runs` | 通过 | init 阶段 `typeof` 为 `function`，init 阶段调用返回 `pong`；账户 tracer 里应用调用 `get()` 时 binding 也可用 | 采用 `exposeBinding`，不启用 `sessionStorage` 退路 |
| PROBE-8 | 取消导入确认后，`setInputFiles` 再选同一个文件 | `PROBE-8 re-selecting the same file with setInputFiles after a cancelled import` | 通过 | 取消后 change 计数 1；Phase 11 之前 `#importJson` 的 value 仍是浏览器的 fakepath 形式加合成文件名，Phase 11 起取消路径也清空，取消后 value 为空；再选同一个文件后 change 计数 2、确认框再次出现 | Playwright 复现不了“再选同一个文件没有反应”，B2 的期望断言改用确定性的 value 为空字符串；B2 已在 Phase 11 修复 |
| PROBE-9a | `context.setOffline` 对 `navigator.onLine` 和 online、offline 事件的影响 | `PROBE-9a what context.setOffline does to navigator.onLine and the online and offline events` | 通过 | 初始 onLine 为 true、两个计数 0；`setOffline(true)` 之后 onLine 为 false、offline 计数 1、online 计数 0；`setOffline(false)` 之后 onLine 为 true、online 计数 1、offline 计数 1 | 离线状态下 `navigator.onLine` 和两个事件都由 Playwright 真实改变和派发，应用的断网分支可以直接用 `setOffline` 触发 |
| PROBE-9b | route 接住的同源 fetch 在离线时是否成功 | `PROBE-9b whether a route-fulfilled same-origin fetch still succeeds while the context is offline` | 通过（离线不影响 route） | 离线时对 `/api/collections/journey_docs/records` 的 fetch 为 `resolved:200`，假服务器收到了这条请求，没有 console.error 也没有违规记录 | 不能靠 `setOffline` 让假服务器的请求失败；网络失败要由假服务器自己的开关制造 |
| PROBE-9c | 假 EventSource 在离线时是否仍然投递 | `PROBE-9c whether the fake EventSource still delivers while the context is offline` | 通过（离线不影响投递） | 离线时 Node 侧用第 0 个账号更新自己的文档，页面订阅回调收到恰好 1 条 `update`，投递错误为空 | 假 EventSource 由 Node 经 `page.evaluate` 投递，不走浏览器网络栈；SSE 断开必须由假服务器显式触发
| PROBE-10a | SDK 每次重连后是否再次调用 `PB_CONNECT` 监听，回调触发时订阅是否已经生效 | `PROBE-10a the SDK calls PB_CONNECT listeners again after every reconnect` | 通过 | 连续两次 `dropRealtime` 之后监听共被调用 3 次，3 个 clientId 互不相同；每次回调触发时 `POST /api/realtime` 的 204 已经是第几次调用（回调时已得 204 的次数依次为 1、2、3），SDK 已提交的订阅里有 `journey_docs/*`；204 共 3 次 | 在 `PB_CONNECT` 回调里立即发起后台对账即可，那时订阅已经生效 |
| PROBE-10b | 首次实时连接失败时 SDK 是否自己再试 | `PROBE-10b the SDK does not retry a first realtime connection that fails` | 通过（不重试） | `refuseRealtime` 期间订阅的 Promise 被 reject（`ClientResponseError`，status 0）；真实等 3 秒后被拒次数仍为 1、连接数为 0；放开之后不再订阅，再等 1.5 秒被拒次数仍为 1、连接数仍为 0 | 应用必须在之后一次成功的对账后自己重新订阅 |
| PROBE-10c | 实时断开期间推送的事件重连后是否补发 | `PROBE-10c events sent while realtime is down are not replayed after the reconnect` | 通过（不补发） | 断开且被拒期间 `emit` 两条 update，页面一条没收到；放开后 PB_CONNECT 第二次到来、连接数回到 1，再等 0.5 秒页面仍是 0 条；之后新 `emit` 一条，恰好收到 1 条 | 每次 `PB_CONNECT` 都整份对账，不指望补发（假服务器不补发是简化，真实服务器的行为本地无法录制） |

## PROBE-1：Edge 无界面启动

- **怎么测的：** 断言 `browserName` 为 chromium，`browser.version()` 以数字开头（只断言版本号格式，不设主版本下限，依据见 01-REVIEW 的 IN-01），把版本记成 `browser-version` annotation 并打印。
- **观察到什么：** 156.0.4314.58。Playwright 1.64.1 直接驱动本机 Edge，没有下载任何浏览器。
- **备选方案：** `PW_CHANNEL=chrome` 改用本机 Chrome；两者都失败时停下来询问用户，不运行 install。本次没有用到。
- **对后续阶段的影响：** 每次运行都会重新记录版本，只断言版本号格式，不设主版本下限（依据见 01-REVIEW 的 IN-01）；换一台 Edge 较旧的机器不会无故变红。

## PROBE-2：两层浏览器网络兜底

背景：`context.route` 只拦截 HTTP 请求，浏览器直接发起的 socket 连接（例如 WebSocket）route 看不到。Phase 9 起应用不再有字体 link 和 `preconnect`（INFRA-03），页头不再引用任何外部主机。`playwright.config.ts` 的 `launchOptions` 因此配了两层浏览器级兜底：

- **解析层：** `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`；
- **代理层：** 死代理 `127.0.0.1:9`，`bypass` 只有 `127.0.0.1,localhost`。

三条用例手动创建 context，所以继承浏览器级参数和死代理，但没有 guard 的 route。所有地址只有三类：回环地址下的 404 路径、RFC 6761 保留的 `.invalid` 域名、以及只放行应用来源的本机录制代理。没有任何探针直接请求真实外部主机，包括两个字体主机。

### PROBE-2a 解析层（已证明）

- **怎么测的：** 没有 route 的 context 里访问 `localhost:4789/probe-404` 和 `probe.localhost:4789/probe-404`，再访问 `127.0.0.1:4789/probe-404`。另外启动一个只去掉解析规则的对照浏览器（死代理仍然沿用，所以 Edge 的后台流量仍然到不了外网），再访问 `localhost:4789/probe-404`。
- **观察到什么：** 两个名字都是 `ERR_NAME_NOT_RESOLVED`；`127.0.0.1` 收到 404，说明 `EXCLUDE 127.0.0.1` 生效；对照浏览器里 `localhost` 收到 404。
- **为什么证明了解析层：** 证人不只是 `localhost`。两个名字在没有规则时都会解析到回环地址，对照浏览器也实际解析成功了，所以失败只能归因于规则，不是 DNS 本来就查不到。
- **边界，如实写明：** `localhost` 在 `PROXY_BYPASS` 里，所以它测的是“直连时的解析层”。`probe.localhost` 的结果和 `localhost` 一致，说明这一层对不在 bypass 名单里的名字同样生效。但凡是经过死代理的主机名，浏览器不会在本机解析目标名（交给代理），所以没有一个会经过代理、又能证明解析层的名字。这类主机名的保证由代理层（下面两小节）提供，不由解析层提供。
- **没有采用任何回退：** 没有把断言改写成“观察到什么就断言什么”。

### PROBE-2b 代理层（已证明）

- **怎么测的：** 没有 route 的 context 里依次访问 `http://probe.invalid/` 和 `https://probe.invalid/`，再访问 `127.0.0.1:4789/probe-404`。
- **观察到什么：** 两个 `.invalid` 地址都是 `ERR_PROXY_CONNECTION_FAILED`（不是 `ERR_NAME_NOT_RESOLVED`），说明名字没有在本机解析，而是交给了死代理并在本机被拒绝；`127.0.0.1` 照常收到 404。
- **端口 9 的应急办法：** 没有触发。结果不是超时，死代理端口没有被占用，`DEAD_PROXY_SERVER` 保持不变。

### PROBE-2c：PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy and the app opens no font-host connection

- **怎么测的：** 在 Node 侧用 `node:net` 起一个只监听 `127.0.0.1` 随机端口的录制代理，每个连接只读第一行后立即销毁，不转发、不发起任何对外连接。新建 context，代理指向录制代理，`bypass` 用 `PROXY_BYPASS`，route 只放行应用来源。打开应用页面，等状态行就绪，然后在页面里执行 `new WebSocket('ws://probe.invalid/')` 作为对照。对字体主机的 CONNECT 只等 3 秒，且只吞掉 `expect.poll` 的超时错误，其他错误照常抛出；是否观察到记成 `fontHostObserved` annotation。Phase 9 起这一项从“只记录”改为断言：`fontHostObserved` 必须为 false，录制代理里字体主机的行必须为 0 条。
- **录到的行（只写主机名和端口）：** `www.bing.com:443`（3 条）、`edge.microsoft.com:443`（2 条）、`probe.invalid:80`（1 条，WebSocket 对照）。
- **字体主机的 CONNECT：0 条。** Phase 9 之前，应用页头有字体 link 和 `preconnect`，这台 Edge 也没有发出 preconnect，用例标题当时带 `(preconnect not observed on this Edge)`，断言只保留对照行。Phase 9 删掉了字体 link 和 `preconnect`，标题改为 `...and the app opens no font-host connection`，字体主机行变成断言为 0 条：应用以后要是重新引入字体或 `preconnect`，这条用例会变红。WebSocket 对照行的断言不变：route 看不到的页面流量会交给代理。
- **`www.bing.com` 和 `edge.microsoft.com` 是什么：** 既不是字体主机也不是 `probe.invalid`，是 Edge 自己的后台服务流量。它们同样只到达了本机录制代理。这说明连浏览器自己发起的、和页面无关的连接，在这个配置下也会被交给代理，而不是直接出网。
- **边界：** 录制代理只能看到到达它的连接，所以这条用例发现不了绕过代理的直连，也就不能证明“只会”到达代理；它只证明 route 看不到的 WebSocket 会交给代理。直连的保证来自解析层（PROBE-2a）。
- **为什么当时没有看到 preconnect（历史记录）：** 只做了两次一次性诊断（没有保留为用例）：把 `rel=preconnect` 指向 `.invalid` 主机，以及指向本机一个监听端口的回环地址，两种情况下这台无界面 Edge 都没有发出任何连接。结论是这台 Edge 在无界面模式下不发 preconnect（或观察不到），而不是 preconnect 绕过了代理。

### 网络兜底结论（只写已被用例证明的层）

- **解析层：已证明**，依据 PROBE-2a。
- **代理层：已证明**，依据 PROBE-2b 和 PROBE-2c 的 WebSocket 对照行。
- **应用不再有 preconnect：** Phase 9 起应用没有字体 link 和 `preconnect`，PROBE-2c 断言字体主机连接为 0。route 看不到的 socket 连接（例如 WebSocket、Edge 后台流量）的保证仍是推断加证明：它们是浏览器发起的 socket，这两类连接已经被证明只会到达代理。规则写的是 `MAP *`，对任何直连的主机名都生效，这一点只用回环名（`localhost`、`probe.localhost`）实测过，对字体主机名没有直接测，这部分是推断。
- **route 看不到的连接由哪一层保证不会离开本机：** 经过代理的连接（非回环主机名、IP 字面量、WebSocket、Edge 后台流量）由代理层保证，只会连到本机端口 9 并失败；直连的名字（只有 bypass 里的回环名）由解析层保证，除 `127.0.0.1` 外全部解析失败。
- **仍然存在的前提：** 这两层都写在 `launchOptions` 里，PROBE-2 每次运行都会重新断言，配置被改掉时用例会变红。

## PROBE-3：`setFixedTime` 在 reload 后保持

- **怎么测的：** `app.open()` 后读页面里的 `Date.now()`，`app.reload()` 后再读一次。
- **观察到什么：** 两次都等于 `FROZEN_NOW`（1773835200000，即 2026-03-18 12:00 UTC）。
- **备选方案：** 无需。若以后失效，改为给 `AppHarness` 加 `refreezeClock` 选项，reload 前重新调用 `setFixedTime`。
- **对后续阶段的影响：** Phase 2 到 5 可以放心用 `app.reload()`，不必再手动冻结时钟。

## PROBE-4：防抖保存的时序

- **怎么测的：** 连续三次记一笔，用 Node 侧 `Date.now()` 计时（起点在点击之前），量 `app.expectPersisted` 通过所需时间，每次断言在 500 ms 到 5000 ms 之间。
- **观察到什么：** 1012、960、975 ms。下限证明走的是 600 ms 防抖而不是立即保存；耗时比 600 ms 多出的部分来自 `expect.poll` 的轮询间隔。
- **备选方案：** 无需。若以后不稳定，给 `expectPersisted` 显式设置 `timeout: 10_000`，需要确定性的用例改用 `clock.install` 加 `runFor(1500)`。
- **对后续阶段的影响：** 持久化断言一律用 `app.expectPersisted`，不要用固定睡眠。

## PROBE-5：`dragTo` 与 HTML5 拖放

- **怎么测的：** 合成种子里只有一条 2026-03-16 的记录，把它拖到 2026-03-19 那一列。
- **方案 A（`dragTo`，`steps: 10`）：可行。** 落盘的日期变为 2026-03-19，目标列里能看到该条目。
- **方案 B（hover、mouse.down、hover 目标两次、mouse.up）：** 没有尝试，A 已可行。
- **方案 C（合成 `DataTransfer` 事件）：** 没有尝试，A 已可行。
- **对后续阶段的影响：** Phase 3 的拖放用例直接用方案 A。拖放前源条目必须有 `data-edit`，目标是带 `data-wday` 的整列。
- **Phase 3 结论（WEEK-05）：** 用例 `WEEK-05 dragging an entry to another day changes its saved date` 在账户模式加完整 fixture 下，把 2026-03-16 的一条合成记录用 `dragTo`（方案 A，`steps: 10`）拖到 2026-03-19，一次通过，没有改用方案 B 或 C，所以没有用合成事件，走的是真实指针路径。断言以保存后的状态为准：这条记录的 `date` 变为目标日期，其余记录的 `date` 都没变；toast 为“已移到 ”加目标日期；目标列里有它、原列里没有；完成的计划条目没有 `draggable` 属性（只计数）。没有出现需要退路的失败现象。

## PROBE-6：`clock.install` 加 `pauseAt`

- **怎么测的：** 用 `test.use({ clockMode: 'manual' })` 让 `frozenClock` 什么都不做，用例自己调用 `page.clock.install({ time: FROZEN_NOW })`，再 `app.open()`，然后 `pauseAt(FROZEN_NOW + 60_000)`。暂停后点击“日历”标签并断言 `aria-selected`，切回“本周”，记一笔，断言 `#toast` 带 `on`，`runFor(1800)` 后 toast 不再带 `on`，并且保存已落盘。
- **观察到什么：** 全部通过。暂停时钟没有破坏 Playwright 的可操作性检查；600 ms 的保存计时器和 1800 ms 的 toast 计时器都由同一次 `runFor` 触发。
- **备选方案：** 无需。若以后卡在稳定性检查，去掉 `pauseAt` 改用 install 加 `runFor`，或在动作前调用 `page.clock.resume()`。
- **对后续阶段的影响：** Phase 4 撤销 toast 过期的用例沿用这个写法：manual 模式、install、open、pauseAt、动作、`runFor`。同一个用例不混用 `install` 和 `setFixedTime`。

## PROBE-7：`exposeBinding` 的时序（D-01）

- **怎么测的：** 先 `page.exposeBinding('__probeBinding', () => 'pong')`，再用 `page.addInitScript(fn, '__probeBinding')` 注入一个函数：它在 init 阶段把 `typeof window[name]` 记到 `window.__probeTypeAtInit`；如果是函数就立即调用，把结果写到 `window.__probeInitCall`。导航到应用后，先读出 `typeAtInit` 记成 probe annotation，再断言它为 `'function'`；然后 poll 到 `__probeInitCall` 为 `'pong'`，`initCall` 在 `finally` 里记成 annotation。观察值先记再断言，所以失败时报告里也有观察值。
- **观察到什么：** `typeAtInit=function`，`initCall=pong`。也就是说 init script 运行的时候 binding 已经是可调用的函数，调用能拿到 Node 侧的返回值。
- **断言是写死的：** 两条断言的期望值固定为 `'function'` 和 `'pong'`，不随观察值改写，所以 binding 在 init 阶段不可调用时这条探针会失败，不会静默通过。
- **和账户 tracer 的分工：** 账户 tracer（`MOCK-03 account mode saves a new entry to the mock and reads it back after reload`）证明的是应用自己调用 `get()` 时 binding 可用，并且 reload 之后 Node 侧的数据仍在；PROBE-7 证明的是更早的 init 阶段也可用。
- **D-01 的最终结论：** `exposeBinding` 方案可用（证据：PROBE-7 和上面的 tracer 用例）。**没有启用 `sessionStorage` 退路。** mock 的页面侧代码仍然只在 `get`、`set`、`save` 被调用时才去取 binding（懒调用），不依赖 init 阶段的顺序。
- **退路备忘（没有启用）：** 如果以后某个 Edge 或 Playwright 版本让 PROBE-7 变红，D-01 的退路是把 mock 数据放到页面侧的 `sessionStorage`。键名必须带固定前缀（例如 `__claude-mock:`），不能和应用的 `us-journey-tracker-v1` 冲突。但这条退路和“用例不用 `page.evaluate` 读记录”（D-09）冲突，需要重新规划，不能在用例里临时改。
- **对后续阶段的影响：** Phase 2 到 5 的账户模式用例直接读 `app.backend`（`reads`、`writes`、`downloads`、`lastState()`），不需要 `page.evaluate`。

## PROBE-8：取消导入后再选同一个文件（B2 的 spike，D-01）

- **怎么测的：** 账户模式加 full-state.json 开局，页面里给 `#importJson` 加一个只计数的 change 监听（计数放在带 probe 前缀的 window 属性上，只计数、不阻止事件、不改应用的处理函数）。先 `answerNextDialog(page, 'dismiss')` 再选内存文件 `synth-probe8.json`，等确认框出现，读回 change 计数和 `#importJson` 的 value；再注册一次 dismiss，选同一个文件，读回第二次的 change 计数和确认框是否再次出现。
- **观察到什么：** 取消后 change 计数为 1；`#importJson` 的 value 没有被清空，形式是浏览器的 fakepath 形式加合成文件名（文档里不照抄带盘符的字符串）。第二次选同一个文件时 change 计数变成 2，确认框再次出现。
- **断言是写死的：** 四条断言的期望值固定（第一次计数 1、取消后 value 为空、第二次确认框出现、第二次计数 2），先记 annotations 和终端输出，再断言，不随观察值改写。Phase 11 之前第二条断言写的是“value 为 fakepath 形式加合成文件名”，B2 修好之后（取消路径清空 input）按计划改为“取消后 value 为空”，其余三条不变。
- **对 B2 的结论：** Phase 11 之前应用的取消路径在 `e.target.value=""` 之前就 `return`，value 确实没有清空（这是 B2 的确定性证据）；Phase 11 起取消路径也清空，取消后 value 为空（11-07 修复）。但 Playwright 的 `setInputFiles` 每次都自己派发 input 和 change，不依赖 value 是否变化，所以用户在真实浏览器里遇到的“再选同一个文件没有反应”在这里复现不了。因此 B2 的期望断言不写“change 会再次触发”，只断言取消后 `#importJson` 的 value 为空字符串（回归用例见 `tests/e2e/io/import.spec.ts` 的 `IO-10 the file input is cleared after cancelling the import confirm (B2 fixed)`）。

## PROBE-9：`context.setOffline` 与假服务器、假 EventSource

- **怎么测的：** 三条用例都在 `tests/cloud/probes-cloud.spec.ts`，用 cloud 模式打开应用（真实 SDK 加 Node 侧假服务器）。9a 在页面脚本运行前注入 online、offline 计数器，读 `setOffline(true)` 和 `setOffline(false)` 前后的 `navigator.onLine` 与计数；9b 在离线时对假服务器已实现的列表路径发一次同源 fetch；9c 订阅后离线，在 Node 侧更新这个账号自己的文档，读页面收到的事件。观察值先记进 `probe` annotation 和终端，看清之后把断言写死，再连跑两次确认稳定。
- **观察到什么：** 见上表。`setOffline` 会真实改 `navigator.onLine` 并各派发一次 offline、online 事件；但被 `context.route` 接住并 fulfill 的请求、以及由 Node 经 `page.evaluate` 投递的假 EventSource 事件，都不受它影响。
- **给 Phase 10 的结论：**
  - 9b 证明 route 接住的请求不受 `setOffline` 影响，所以“请求失败、5xx、超时”这类网络故障要由假服务器自己的开关来模拟（例如让某类请求 `route.abort()` 或返回 5xx），不能指望 `setOffline`。
  - 9a 证明 `setOffline` 能让应用看到真实的 `offline`、`online` 事件和 `navigator.onLine` 的变化，所以应用里“网络断开后的提示、恢复后重连”这类依赖浏览器在线状态的分支，可以用 `setOffline` 加假服务器的开关组合起来测；但这两者要分别触发，才能说清是哪一个导致的行为。
  - 9c 证明假 EventSource 不受影响，所以 SSE 断开和重连必须由假服务器显式触发（`app.fake` 上的开关），`setOffline` 不会让它断开。
- **边界：** 结论只对本机 Edge 156 和 Playwright 1.64.1 成立；版本变化要重跑 PROBE-9。在 Phase 8 的其他用例里没有使用 `setOffline`，只有这三条探针用了。

## PROBE-10：SDK 0.28.1 的实时重连（Phase 10 的本地调研）

- **怎么测的：** 三条用例在 `tests/cloud/probes-cloud.spec.ts`，cloud 模式打开应用，harness 在页面里用真实 SDK 0.28.1 订阅（`backend: null` 的设施用法），实时连接由假服务器的 `dropRealtime`、`refuseRealtime` 断开或拒绝（见 `tests/mocks/PB-CONTRACT.md` §10），不使用 `setOffline`。10a 并发订阅 `PB_CONNECT` 和 `journey_docs/*`，包一层 `window.fetch` 数 `POST /api/realtime` 得到的 204，在每次 `PB_CONNECT` 回调里记下当时的 204 次数；10b 在首次订阅之前就拒绝实时；10c 在断开且被拒期间 `emit` 事件。观察值先记进 `probe` annotation 和终端，看清之后把断言写死。
- **观察到什么：** 见上表。SDK 的重连间隔（200、300、500、1000、1200、1500、2000 毫秒，次数不限）和 `PB_CONNECT` 的处理顺序来自 `tools/probe/page/vendor/pocketbase.iife.js` 里 `RealtimeService` 的源码：`PB_CONNECT` 到来后先 `submitSubscriptions()`，成功之后才调用 `PB_CONNECT` 的监听；`connectErrorHandler` 在“没有 clientId 且重连次数为 0”时 reject 并 `disconnect()`，不重试。
- **四个调研问题的本地答案（供 10-03 到 10-09 引用）：**
  1. **SSE 断线后会不会补发错过的事件？** SDK 重连时新建 EventSource、拿到新的 clientId、重新提交订阅，源码里没有续传（10a 里三次连接的 clientId 互不相同）；假服务器不补发（10c）。真实服务器的行为本地无法录制，所以设计不依赖它：**每次 `PB_CONNECT` 都整份对账**，与 `06-PROBE-RESULTS` 的“重连后必须整份补拉”一致。
  2. **`PB_CONNECT` 之后什么时候对账？** SDK 在订阅提交成功之后才调用 `PB_CONNECT` 监听（10a：回调触发时 204 已经得到、`journey_docs/*` 已在 SDK 已提交的订阅里），所以**在回调里立即发起一次后台对账**，就能关闭“读取之后、订阅之前”的空窗。订阅放在首次对账完成之后，由第一次 `PB_CONNECT` 触发的对账补上这个空窗（10-08 采用）。真实 0.41.1 接受 `PB_CONNECT` 订阅串的依据是 Phase 6 探针页（`tools/probe/page/probe.js`）在真实实例上的同样写法（`pb.realtime.subscribe('PB_CONNECT', …)`）。
  3. **`fields` 对事件载荷的影响？** `PB-CONTRACT.md` §6 的 `realtime-update-fields` 样本和 §7 的 RT-4（`fields=id,kind,writer,updated`）证明更新事件的 record 只剩 `id`、`kind`、`writer`、`updated` 这 4 个键。应用只用这四个字段判断是否需要对账，整份数据一律用列表读取。
  4. **断网和退避在 manual 时钟下怎么测？** SDK 的重连间隔（200 到 2000 毫秒）、应用的退避和 60 秒拉取都是页面定时器，manual 时钟下用 `runFor` 推进；服务器侧故障和 SSE 断开只用假服务器的开关（`dropRealtime`、`refuseRealtime`、按上下文限定的 `fault({ context })`、`refuse`、`status`、`hold`、`lose-answer`）；`context.setOffline` 只改 `navigator.onLine` 和 online、offline 事件（PROBE-9a），管不到假服务器的请求和假 EventSource（PROBE-9b、9c）。
- **额外结论：** 首次连接失败时 SDK 不重试（10b）：订阅的 Promise 被 reject，SDK 之后不会自己再试，所以应用必须在之后一次成功的对账后自己重新订阅（10-09 采用）。已经连上之后的断开则由 SDK 自己无限次重试（10a、`pb-faults.spec.ts` 里 `refusing realtime` 那条自检）。
- **边界：** 结论对本机 Edge 156、Playwright 1.64.1、SDK 0.28.1 成立；“不补发”在假服务器上是构造出来的，真实服务器是否补发无法本地验证，设计因此不依赖它（SYNC-02 保持为显式假设）。

## 未覆盖的事项

目前没有。`exposeBinding` 的时序已由 PROBE-7 和账户 tracer 覆盖。

