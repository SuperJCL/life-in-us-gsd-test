---
phase: 01-harness-local-slice
reviewed: 2026-11-02T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - package.json
  - playwright.config.ts
  - tests/PROBES.md
  - tests/README.md
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/environment.spec.ts
  - tests/e2e/platform/guardrails.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/e2e/platform/repo-hygiene.spec.ts
  - tests/e2e/smoke.spec.ts
  - tests/fixtures/local-seed.json
  - tests/support/app.ts
  - tests/support/constants.ts
  - tests/support/static-server.cjs
  - tests/support/strings.ts
  - tests/support/test.ts
findings:
  critical: 0
  warning: 6
  info: 7
  total: 13
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-11-02
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

本次审查覆盖 Playwright 测试平台的配置、fixture、静态服务器、探针与护栏自检。应用文件按要求没有审查，也没有被修改。

整体评价：设计思路扎实。静态服务器用精确白名单，不拼接文件路径，穿越在结构上不可能发生。护栏有自检用例，并且 teardown 与自检共用 `guardViolations`。网络兜底有三层（`context.route`、`--host-resolver-rules`、死代理）。我核对了 `launchOptions` 的继承：`playwright.chromium.launch()` 会合并 `_defaultLaunchOptions`，所以 PROBE-2 的对照浏览器确实仍带死代理。

没有发现 BLOCKER。主要问题集中在两类：

1. 有几处保护看上去很强，实际对某类回归不会报警，容易让人产生虚假的安全感。
2. 静态服务器缺少 Host 头校验。该服务器会把含个人内容的应用文件提供出去。

结构化预检（fallow）未提供，因此没有 Structural Findings 小节。

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: 静态服务器不校验 Host 头，存在 DNS rebinding 读取应用文件的窗口

**File:** `tests/support/static-server.cjs:21-47`
**Issue:** 服务器只绑定了 127.0.0.1，这能挡住局域网访问，但挡不住 DNS rebinding。测试运行期间，如果浏览器里打开了某个恶意页面，它可以把自己控制的主机名重绑定到 127.0.0.1:4789。该页面随后以同源身份读取 `/`，也就是读到含个人计划内容的应用 HTML。服务器没有检查 `req.headers.host`，对任意 Host 都返回 200。此外，它对任何 HTTP 方法（POST、PUT 等）都返回文件，没有限制为 GET 和 HEAD。服务器只在测试期间存活，窗口很短，概率低。但这个仓库的核心约束就是保护这个文件，而修复成本只有几行。
**Fix:**
```js
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`]);
const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  if (!ALLOWED_HOSTS.has(String(req.headers.host))) { res.writeHead(421); res.end(); return; }
  // ……其余不变
});
```
同时在 `app-integrity.spec.ts` 的 ENV-03 里补一条用 `host: 'evil.example'` 头发请求并期望 421 的断言。

### WR-02: `guard.reset()` 会清空全部五个数组，会同时吞掉同一用例里真正的违规

**File:** `tests/support/test.ts:70-77`，调用点 `tests/e2e/platform/guardrails.spec.ts:34,72,95`
**Issue:** 自检用例为了让 teardown 通过而调用 `reset()`。但 `reset()` 清掉的是全部状态，不只是那一条故意制造的违规。如果在这几个用例里，应用本身同时发出了真实的外部请求或抛出了真实异常，它们也会被一并清掉，teardown 不会报错。这几个用例恰好是护栏的自检，应当是最不容许有盲区的地方。注释里“只清掉故意制造的违规”与实现不符。
**Fix:** 提供按条件删除的 API，只移除故意制造的那一条：
```ts
removeWhere(pred: { url?: string; message?: string }) { /* 按内容过滤 splice */ }
```
或者在自检里先断言“除故意违规外数组为空”再 reset，例如 `expect(guard.state.unexpectedRequests).toEqual(['https://example.com/'])`。

### WR-03: PROBE-2c 的标题和说明声称“只会到达代理”，但用例无法对泄漏回归报警

**File:** `tests/e2e/platform/probes.spec.ts:115-171`（尤其 157 行）
**Issue:** 唯一真正的断言是 WebSocket 对照行出现在录制代理里。字体主机的探测被 `.catch(() => {})` 吞掉。`otherLines`、`fontHostLines` 只写进 annotation，不做断言。录制代理只能看到“到达它的”连接，所以如果某个版本的 Edge 绕过代理直连，这个用例照样通过。标题 `route-invisible traffic only ever reaches the proxy` 把“只”字写成了已验证的结论，而它只验证了“WebSocket 会走代理”。PROBES.md 已经如实写了 preconnect 未观察到，但用例标题与 README 第 7 节容易被读成更强的保证。此外 `.catch(() => {})` 会连同真正的异常（例如页面已关闭）一起吞掉。
**Fix:** 把标题改成与断言一致，例如 `PROBE-2 WebSocket traffic (invisible to route) is delivered to the proxy`。把对字体主机的有限等待改成显式分支：只吞超时错误，其余错误重新抛出。并把“无法检测直连泄漏”写进用例注释。

### WR-04: README 对解析层的描述与 PROBES.md 的实测结果矛盾

**File:** `tests/README.md:57-58`
**Issue:** README 写“解析层已证明：不在代理名单里的名字都是 `ERR_NAME_NOT_RESOLVED`”。PROBES.md 的实测是：这一层只对 bypass 里的回环名（`localhost`、`probe.localhost`）出现 `ERR_NAME_NOT_RESOLVED`；经过代理的名字（`.invalid`）得到的是 `ERR_PROXY_CONNECTION_FAILED`，并且 PROBES.md 明确写了“没有一个会经过代理、又能证明解析层的名字”。README 的措辞把证明范围说大了，会让读者以为所有非回环主机名都被解析层挡住。
**Fix:** 改成与 PROBES.md 一致：“解析层已证明：直连的名字（只有 bypass 里的回环名）解析失败；经过代理的名字由代理层保证，表现为 `ERR_PROXY_CONNECTION_FAILED`。”

### WR-05: 对第 2 层、第 3 层的违规，护栏不会让任何用例失败

**File:** `tests/support/test.ts:66-123`
**Issue:** guard 只在 `context.route` 里记录 HTTP 请求。WebSocket 不经过 route；被死代理或解析规则拒绝的连接只会表现为请求失败，不进入 guard 状态。结果：如果应用以后新增了一个指向外部主机的 WebSocket、EventSource 之外的非 HTTP 连接，或某个 `fetch` 因为 route 之外的路径发出，它会被兜底层悄悄挡住，而所有用例仍然绿色。这样网络“被挡住了”，但没有人知道应用在尝试出网，而 CLAUDE.md 要求的正是出网尝试可见。guard 的 `console`、`pageerror` 监听器也只挂在 `page` fixture 上，弹出窗口、额外的 page 不受监控。
**Fix:** 在 guard 里补充：
```ts
page.on('websocket', (ws) => state.unexpectedRequests.push(ws.url()));
page.on('requestfailed', (req) => {
  const err = req.failure()?.errorText ?? '';
  if (/ERR_PROXY_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(err) && !req.url().startsWith(APP_ORIGIN + '/'))
    state.unexpectedRequests.push(req.url());
});
context.on('page', attachListeners); // 弹窗同样监听
```
并加一条自检：页面里 `new WebSocket('ws://probe.invalid/')` 会被记为违规。

### WR-06: MOCK-01 对“启动时不写 localStorage”只做了单次采样的否定断言

**File:** `tests/e2e/smoke.spec.ts:50`
**Issue:** `expect(await page.evaluate(...)).toBeNull()` 在状态行就绪的那一刻采样一次。应用的保存有 600 ms 防抖，如果启动路径之后会触发一次保存，这个断言会在写入之前通过，永远测不到它。否定断言需要在足够长的窗口内持续成立才有意义。这是典型的“单次采样”类假绿，也是本次审查要求重点关注的类型。
**Fix:** 要么删除这条断言，只保留 `claude` 不在 window 里的断言；要么用持续观察：
```ts
await page.waitForTimeout(800); // 超过 600 ms 防抖，仅此处允许固定等待
expect(await app.persisted()).toBeNull();
```
更好的做法是用 `page.clock.runFor(700)`（manual 时钟模式）确定性地推过防抖，再断言。

## Info

### IN-01: PROBE-1 硬编码了最低浏览器主版本 155

**File:** `tests/e2e/platform/probes.spec.ts:16`
**Issue:** 155 是记录当天本机 Edge 版本（156）减一得到的魔法数字。换一台 Edge 稍旧的机器，或用 `PW_CHANNEL=chrome`，平台自检会变红，但这与平台的正确性无关。PROBES.md 把它描述成“Edge 升级到小于 155 时会变红”，方向也写反了（升级不会变小）。
**Fix:** 只断言版本形如 `^\d+\.` 并记录 annotation，或把最低版本放到 `constants.ts` 并写明依据（例如 `page.clock` 所需的最低 Chromium 版本）。

### IN-02: 端口在多处重复写死，没有从 `PORT` 派生

**File:** `tests/support/constants.ts:7`、`tests/e2e/platform/probes.spec.ts:75-76`、`tests/support/static-server.cjs:9`
**Issue:** `APP_ORIGIN` 是字面量 `http://127.0.0.1:4789`，没有用 `PORT` 拼出来。probes.spec 里还有两个 `localhost:4789` 字面量，静态服务器自己又有默认值 4789。改端口要改四处，漏改一处会出现难排查的失败。
**Fix:** `export const APP_ORIGIN = \`http://127.0.0.1:${PORT}\`;`，探针里用 `http://localhost:${PORT}/probe-404`。静态服务器的默认值保持，但注释里注明要与 constants 一致。

### IN-03: `canConnect('::1')` 在 IPv6 被禁用的机器上是空转；`test.skip` 会连带跳过其后的 IPv6 检查

**File:** `tests/e2e/platform/app-integrity.spec.ts:97-103`
**Issue:** 中途调用 `test.skip(...)` 会把整个用例标成 skipped，而前面的回环对照其实已经通过。IPv6 回环检查没有对照组：本机没有 `::1` 时它会直接“连不上”而通过，不能证明服务器没监听 `::1`。
**Fix:** 不要在中途 `test.skip`，改成 `if (lanAddresses.length > 0) { ... }`。IPv6 一项加上对照（例如先在 `::1` 临时起一个监听以确认本机支持 IPv6）或在注释里说明它是弱断言。

### IN-04: 静态服务器没有 `error` 处理，客户端中途断开时文件流不会被销毁

**File:** `tests/support/static-server.cjs:35-50`
**Issue:** `server.listen` 没有 `server.on('error')`。端口被占用时进程以未捕获异常和一大段堆栈退出，不如缺少应用文件时那样给出清楚的中文提示。客户端中途断开时，`stream.pipe(res)` 不会销毁源流，文件描述符要等 GC 才释放。服务器寿命很短，影响很小。
**Fix:**
```js
server.on('error', (e) => { process.stderr.write(`静态服务器启动失败：${e.code}\n`); process.exit(1); });
res.on('close', () => stream.destroy());
```

### IN-05: `seedLocalStorageIfAbsent` 没有保护 `localStorage` 访问；PROBE-5 内联了一份与 fixture 文件重复的种子

**File:** `tests/support/app.ts:11-15`，`tests/e2e/platform/probes.spec.ts:215-224`
**Issue:** `addInitScript` 会在每个 frame、每次导航时执行。如果之后某个用例导航到 opaque origin（例如 `about:blank` 的跨源 iframe 或 data: URL），`localStorage` 访问会抛 `SecurityError`，变成页面错误并被 guard 报出来，错误来源会让人困惑。另外 PROBE-5 手写了一份和 `tests/fixtures/local-seed.json` 结构相同的种子，将来应用的 schema 变化要改两处。
**Fix:** 函数体用 `try { ... } catch (e) {}` 包住；PROBE-5 改为读取 fixture 文件并覆盖 `logs`。

### IN-06: `findUnmarkedFixtures` 从 spec 文件里导出；`expectPersisted` 的谓词抛错会终止轮询

**File:** `tests/e2e/platform/repo-hygiene.spec.ts:34`，`tests/support/app.ts:51-57`
**Issue:** 从 `*.spec.ts` 导出函数，一旦别处 import 它，会把整个 spec 的用例重复注册。`expectPersisted` 里谓词访问不存在的字段（例如 `s.logs` 为 undefined，或存档里没有该字段）会抛 TypeError，我没有验证 `expect.poll` 是否会因此立即终止，但无论如何错误信息会指向谓词内部而不是“保存尚未发生”。
**Fix:** 把 `findUnmarkedFixtures` 挪到 `tests/support/` 下。`check` 里对谓词加 `try { return predicate(state); } catch { return false; }`。

### IN-07: 其他小问题

**File:** `package.json`，`playwright.config.ts:42`，`tests/e2e/platform/probes.spec.ts:18,166`
**Issue:**
- README 要求 Node 20 以上，但 `package.json` 没有 `engines` 字段，旧版本 Node 下不会有提示。
- `PW_CHANNEL=''`（空串）会得到 `channel: ''`，`??` 不会回退到 `msedge`，行为取决于 Playwright 如何处理空串。
- 探针里两处 `console.log` 与项目“代码不打 console”的约定不一致，但探针需要留痕，且已有 annotation，可以去掉。
**Fix:** 加 `"engines": { "node": ">=20" }`；配置里用 `process.env.PW_CHANNEL || 'msedge'`；删掉重复的 `console.log`，只保留 annotation。

---

_Reviewed: 2026-11-02_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
