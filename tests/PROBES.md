# 运行时探针结论（PROBE-1 到 PROBE-6）

这些探针验证后续阶段依赖的运行时假设。每一项都对应 `tests/e2e/platform/probes.spec.ts` 里以 `PROBE-n` 开头的用例，每次 `npm test` 都会运行；假设哪天不成立，用例会变红。

## 运行环境

| 项目 | 值 |
|------|----|
| 记录日期 | 2026-11-02 |
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
| PROBE-2c | route 看不到的 WebSocket 会交给代理 | `PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy (preconnect not observed on this Edge)` | 通过，但 preconnect 本身没有被观察到 | WebSocket 对照行 `CONNECT probe.invalid:80` 出现在录制代理；字体主机的 CONNECT 为 0 条 | 标题按应急办法改写，见下文 |
| PROBE-3 | `setFixedTime` 在 reload 后保持 | `PROBE-3 setFixedTime survives page.reload()` | 通过 | reload 前后 `Date.now()` 都是 1773835200000 | 无需在 reload 前重新冻结 |
| PROBE-4 | `expect.poll` 读取防抖保存 | `PROBE-4 expect.poll observes the debounced localStorage save` | 通过 | 三次耗时 1012、960、975 ms（都在 500 到 5000 ms 之间） | 默认的 `expectPersisted` 即可 |
| PROBE-5 | `dragTo` 驱动 HTML5 拖放 | `PROBE-5 dragTo drives HTML5 drag and drop in the week view` | 通过（方案 A） | 条目从 2026-03-16 拖到 2026-03-19，落盘日期变化，目标列可见 | 方案 A：`dragTo(..., { steps: 10 })` |
| PROBE-6 | `clock.install` 加 `pauseAt` 后的稳定性检查 | `PROBE-6 clock.install with pauseAt keeps actionability checks working` | 通过 | 暂停后点击标签、记一笔、toast 出现，`runFor(1800)` 后消失，保存落盘 | install、open、pauseAt、runFor 的顺序可用 |

## PROBE-1：Edge 无界面启动

- **怎么测的：** 断言 `browserName` 为 chromium，`browser.version()` 以数字开头（只断言版本号格式，不设主版本下限，依据见 01-REVIEW 的 IN-01），把版本记成 `browser-version` annotation 并打印。
- **观察到什么：** 156.0.4314.58。Playwright 1.64.1 直接驱动本机 Edge，没有下载任何浏览器。
- **备选方案：** `PW_CHANNEL=chrome` 改用本机 Chrome；两者都失败时停下来询问用户，不运行 install。本次没有用到。
- **对后续阶段的影响：** 每次运行都会重新记录版本，只断言版本号格式，不设主版本下限（依据见 01-REVIEW 的 IN-01）；换一台 Edge 较旧的机器不会无故变红。

## PROBE-2：两层浏览器网络兜底

背景：`context.route` 只拦截 HTTP 请求。应用 head 里的两条 `<link rel="preconnect">` 是浏览器直接发起的 socket 连接，route 看不到。`playwright.config.ts` 的 `launchOptions` 因此配了两层浏览器级兜底：

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

### PROBE-2c：PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy (preconnect not observed on this Edge)

- **怎么测的：** 在 Node 侧用 `node:net` 起一个只监听 `127.0.0.1` 随机端口的录制代理，每个连接只读第一行后立即销毁，不转发、不发起任何对外连接。新建 context，代理指向录制代理，`bypass` 用 `PROXY_BYPASS`，route 只放行应用来源。打开应用页面，等状态行就绪，然后在页面里执行 `new WebSocket('ws://probe.invalid/')` 作为对照。对字体主机的 CONNECT 只等 3 秒，且只吞掉 `expect.poll` 的超时错误，其他错误照常抛出；是否观察到记成 `fontHostObserved` annotation。
- **录到的行（只写主机名和端口）：** `www.bing.com:443`（3 条）、`edge.microsoft.com:443`（2 条）、`probe.invalid:80`（1 条，WebSocket 对照）。
- **字体主机的 CONNECT：0 条。** 所以 preconnect 没有被直接观察到。按计划的应急办法，用例标题改为 `...(preconnect not observed on this Edge)`，断言只保留对照行：route 看不到的页面流量会交给代理。
- **`www.bing.com` 和 `edge.microsoft.com` 是什么：** 既不是字体主机也不是 `probe.invalid`，是 Edge 自己的后台服务流量。它们同样只到达了本机录制代理。这说明连浏览器自己发起的、和页面无关的连接，在这个配置下也会被交给代理，而不是直接出网。
- **边界：** 录制代理只能看到到达它的连接，所以这条用例发现不了绕过代理的直连，也就不能证明“只会”到达代理；它只证明 route 看不到的 WebSocket 会交给代理。直连的保证来自解析层（PROBE-2a）。
- **为什么没有看到 preconnect：** 只做了两次一次性诊断（没有保留为用例）：把 `rel=preconnect` 指向 `.invalid` 主机，以及指向本机一个监听端口的回环地址，两种情况下这台无界面 Edge 都没有发出任何连接。结论是这台 Edge 在无界面模式下不发 preconnect（或观察不到），而不是 preconnect 绕过了代理。

### 网络兜底结论（只写已被用例证明的层）

- **解析层：已证明**，依据 PROBE-2a。
- **代理层：已证明**，依据 PROBE-2b 和 PROBE-2c 的 WebSocket 对照行。
- **preconnect：没有被直接观察到。** 不把它写成已观察的事实。它的保证是推断：如果某个 Edge 版本发出 preconnect，它和 WebSocket、Edge 后台服务连接一样是浏览器发起的 socket，这两类连接已经被证明只会到达代理。规则写的是 `MAP *`，对任何直连的主机名都生效，这一点只用回环名（`localhost`、`probe.localhost`）实测过，对字体主机名没有直接测，这部分是推断。
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

## PROBE-6：`clock.install` 加 `pauseAt`

- **怎么测的：** 用 `test.use({ clockMode: 'manual' })` 让 `frozenClock` 什么都不做，用例自己调用 `page.clock.install({ time: FROZEN_NOW })`，再 `app.open()`，然后 `pauseAt(FROZEN_NOW + 60_000)`。暂停后点击“日历”标签并断言 `aria-selected`，切回“本周”，记一笔，断言 `#toast` 带 `on`，`runFor(1800)` 后 toast 不再带 `on`，并且保存已落盘。
- **观察到什么：** 全部通过。暂停时钟没有破坏 Playwright 的可操作性检查；600 ms 的保存计时器和 1800 ms 的 toast 计时器都由同一次 `runFor` 触发。
- **备选方案：** 无需。若以后卡在稳定性检查，去掉 `pauseAt` 改用 install 加 `runFor`，或在动作前调用 `page.clock.resume()`。
- **对后续阶段的影响：** Phase 4 撤销 toast 过期的用例沿用这个写法：manual 模式、install、open、pauseAt、动作、`runFor`。同一个用例不混用 `install` 和 `setFixedTime`。

## 未覆盖的事项

`exposeBinding` 在页面脚本运行前是否可用，由 Phase 2 的账户冒烟用例验证，不在本阶段探针范围内。

