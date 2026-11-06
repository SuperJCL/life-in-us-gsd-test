# Stack Research

**Domain:** 给单文件原生 JS HTML 应用（Claude Artifact 导出）加本地 Playwright Test 黑盒测试 + `window.claude` mock（Windows 11，系统 Edge，无框架，无浏览器下载）
**Researched:** 2026-11-01
**Confidence:** HIGH（版本、安装行为来自 npm registry 直接查询）/ MEDIUM（Playwright 行为来自官方文档，部分细节未在本机实跑验证）

> 置信度说明：GSD 的 `classify-confidence` 对 `webfetch`/`websearch` 这类 provider 给出 LOW（`websearch --verified` 为 MEDIUM），因为抓取内容经过小模型摘要。下文的标注规则是：npm registry 的元数据是一手数据，标 HIGH；官方文档的原文引用（同时用渲染页和仓库内 `docs/src/*.md` 交叉核对过）标 MEDIUM 到 HIGH；没有核实到的行为明确标 LOW / 未验证，并列入"Gaps"。本次研究没有运行任何安装命令，也没有实跑 Playwright，所有"实跑才能确认"的点都留给第一个 phase 的冒烟测试。

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@playwright/test` | **1.64.1**（npm `latest`，2026-11-01 查询；`engines.node >=20`） | 测试运行器 + 断言 + 浏览器自动化，一个包全包含 | 用户明确要求 Playwright Test。它只依赖 `playwright` → `playwright-core` 1.64.1，没有第三方运行时依赖。**HIGH**（registry） |
| Microsoft Edge（系统已装） | 156.0.4314.58（本机实测）；Playwright 1.64 发布说明里"测试过的稳定通道"是 Edge 155 | 被测浏览器，通过 `channel: 'msedge'` 启动 | 不需要下载任何浏览器；Playwright 直接找系统 Edge（本机 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` 存在）。**HIGH**（路径实测）/ **MEDIUM**（Edge 156 比 1.64 测过的 155 新一个大版本，CDP 向后兼容，风险低，但要在冒烟测试里确认） |
| Node.js | 24.20.0（本机）；Playwright 要求 >=20 | 运行 Playwright + 零依赖静态服务器 | 已满足，不需要升降级。**HIGH** |
| 零依赖 Node 静态服务器（`node:http`） | 自己写，约 15 行，`tests/support/static-server.cjs` | 通过 Playwright 的 `webServer` 在 `http://127.0.0.1:<port>` 提供 `us-journey-tracker.html` | 稳定的 http origin（localStorage、`baseURL`、`route` 都可靠）；不增加任何 npm 依赖。详见下文"serving the page"。**MEDIUM-HIGH** |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| （无） | — | 最小方案只需要 `@playwright/test` 一个 devDependency | 默认就这样 |
| `@types/node` | `^24`（可选） | 给 `playwright.config.ts` 里的 `process`/`path` 提供编辑器类型 | 只有当你想在编辑器里去掉 `process` 红线、或以后加 `tsc --noEmit` 时才装。Playwright 运行 `.ts` 不依赖它（Playwright 自己转译，不做类型检查）。**MEDIUM** |
| `typescript` | `^5`（可选） | 仅用于 `npx tsc --noEmit` 类型检查 | 不建议第一个里程碑装。Playwright 不需要它，编辑器（VS Code）自带 TS 语言服务。 |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx playwright test` / `npm test` | 一条命令跑全部测试 | `package.json` 的 `scripts.test = "playwright test"`。 |
| `npx playwright show-report` | 打开 HTML 报告 | 在本机起一个 localhost 静态服务看 `playwright-report/`，不联网。 |
| `npx playwright test --ui` / `--headed` / `--debug` | 本地调试 | 默认 headless；这些是可选的调试开关。 |
| Trace Viewer | 失败后看 DOM 快照、网络、控制台 | `trace: 'retain-on-failure'`，用 `npx playwright show-trace test-results/<dir>/trace.zip`。 |
| `.gitignore`（仓库里目前没有） | 忽略 `node_modules/`、`test-results/`、`playwright-report/`、`blob-report/` | 需要在搭建 phase 一并加上，否则 `git status` 会被噪音淹没。 |

## 最小 `package.json` 与安装

```json
{
  "name": "us-journey-tracker-tests",
  "private": true,
  "version": "0.0.0",
  "description": "Local Playwright black-box tests for us-journey-tracker.html (synthetic data only)",
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "1.64.1"
  }
}
```

- 不写 `"type"` 字段（保持 CommonJS 默认）。理由：Playwright 对 `.ts` 的转译在 CJS 下最省心，相对路径导入不用写扩展名；ESM 下的相对导入扩展名规则我没在官方文档里核实到（**LOW**），没必要冒险。静态服务器用显式的 `.cjs` 扩展名。
- **精确锁版本**（不带 `^`），并提交 `package-lock.json`。理由：Playwright 与浏览器协议版本绑定，小版本也可能改行为；这个实验要的是可重复。

```bash
# 在仓库根目录（项目内安装，不加 -g）
npm install --save-dev --save-exact @playwright/test@1.64.1

# 不要运行：npx playwright install（见 What NOT to Use）
```

### 会不会下载浏览器？不会（HIGH，registry 直接核实）

- `@playwright/test`、`playwright`、`playwright-core` 三个包在 registry 里**都没有 `install`/`postinstall` 脚本**（`@playwright/test` 的 `scripts` 为 `{}`，另外两个没有 `scripts` 字段），也没有 `optionalDependencies`。所以 `npm install` 本身不会下载任何浏览器。
- 官方 Browsers 文档的措辞一致：浏览器要用 Playwright CLI 另外安装；branded Chrome/Edge 是"机器上已有的"，Playwright "默认不安装它们"。
- 因此 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` 在当前版本里**不需要设置**（官方浏览器文档没有提到它；它是旧版本 postinstall 时代的开关）。设了也无害，但不要把它当成安全措施——真正的保证是"不运行 `npx playwright install`"。**HIGH**（无安装脚本）/ **MEDIUM**（该变量的历史背景来自经验，未在文档核实）
- 依赖体积：`playwright-core` 解包约 13.7 MB，`playwright` 约 5 MB，`@playwright/test` 约 28 KB。`node_modules` 很小，因为不含浏览器。

## `playwright.config.ts` 要点

```ts
import { defineConfig } from '@playwright/test';

const PORT = 4789;                      // 固定的非常用端口
const ORIGIN = `http://127.0.0.1:${PORT}`;  // 用 127.0.0.1，不用 localhost（避开 IPv4/IPv6 解析差异）

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 30_000,                      // 默认值，显式写出来
  expect: { timeout: 5_000 },           // 默认值；保存是 600 ms 防抖，轮询用 expect.poll
  fullyParallel: true,                  // 每个测试一个全新 context，天然隔离
  retries: 0,                           // 本地实验不重试，避免掩盖不稳定
  forbidOnly: true,
  // workers 不设：默认是逻辑核数的一半；Edge 实例偏重，若出现超时再显式降到 2
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: ORIGIN,
    channel: process.env.PW_CHANNEL ?? 'msedge',   // 'chrome' 作为备用通道
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale: 'zh-CN',
    timezoneId: 'America/New_York',     // 固定时区，让 today() 的本地日期可重复
    serviceWorkers: 'block',            // 官方建议：用 route 时关掉 Service Worker
    acceptDownloads: false,             // 导出走 mock 的 downloads，不应出现真实下载
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: {
      // 第二层网络保险：除 127.0.0.1 外所有主机名解析失败（见"Network blocking"）
      args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'],
    },
  },
  webServer: {
    command: 'node tests/support/static-server.cjs',
    url: `${ORIGIN}/`,                  // 用 url，不用已弃用的 port
    reuseExistingServer: false,         // 故意：端口被占就报错，绝不复用来路不明的服务
    timeout: 15_000,
    env: { PORT: String(PORT) },
  },
});
```

逐项理由：

| 配置 | 值 | 为什么 | 置信度 |
|------|----|--------|--------|
| `use.channel` | `'msedge'` | 官方文档给出的用法 `channel: 'msedge'`，Playwright 用系统 Edge，不装浏览器。不要用 `projects[].use.devices[...]` 之外的任何下载型浏览器项目。 | HIGH |
| `use.baseURL` | `http://127.0.0.1:4789` | 官方文档对 `webServer` 的建议是自己在 `use` 里设 `baseURL`（页面没说 `port` 会自动设）；这样 `page.goto('/')` 即可。 | MEDIUM |
| `webServer.url` | `…/` | 官方：`port` 已弃用，用 `url`；就绪判断为返回 2xx/3xx/400/401/402/403。 | HIGH |
| `webServer.reuseExistingServer` | `false` | 官方文档建议常写成 `!process.env.CI`，这里本地也设 `false` 是刻意的安全选择：宁可失败也不要连到别的服务。 | MEDIUM |
| `webServer.gracefulShutdown` | 不设 | 官方：Windows 不支持 `SIGTERM`/`SIGINT`，这个选项在 Windows 被忽略；默认强杀进程组，对一个无状态静态服务器没有问题。 | HIGH |
| `webServer.stdout/stderr` | 默认 | 默认 `stdout: 'ignore'`、`stderr: 'pipe'`。服务器起不来时 stderr 会显示。 | HIGH |
| `reporter` | `list` + `html`（`open: 'never'`） | 官方：本地默认就是 `list`；`html` 的 `open` 默认是 `'on-failure'`（会自动弹浏览器），实验里改 `'never'` 更可控。HTML 报告满足"一条命令生成报告"。 | HIGH |
| `trace` | `'retain-on-failure'` | 官方定义：每次都录，只保留失败的；比 `on-first-retry` 适合 `retries: 0`。 | HIGH |
| `screenshot` | `'only-on-failure'` | 官方值。 | HIGH |
| `timeout` / `expect.timeout` | 30 s / 5 s | 都是官方默认值；应用有 600 ms（复盘文本 800 + 600 ms）防抖保存，5 s 足够，不要为此加长全局超时。 | HIGH |
| `workers` | 默认（核数的一半） | `fullyParallel` + 每个测试独立 context，没有共享状态；不需要硬写。 | MEDIUM |
| `timezoneId` / `locale` | `America/New_York` / `zh-CN` | `today()` 取的是本地日期，时区不固定会让"冻结的今天"在跨日边界处漂移。`locale` 跟应用的 `lang="zh-CN"` 一致。具体选哪个时区无所谓，关键是固定。 | MEDIUM |
| `serviceWorkers` | `'block'` | 官方：`BrowserContext.route` 不会拦截被 Service Worker 处理的请求，用拦截时建议 `'block'`。应用本身没有 SW，这是防御。 | HIGH |

可选的移动端：TESTING.md 提到 560 px 布局。等需要时再加第二个 project（同样 `channel: 'msedge'`，用 `viewport` 或 `devices['Pixel 7']` 覆盖），并用 `grep`/`testMatch` 限制只跑布局相关的测试；HTML5 拖拽只在桌面 project 跑。注意 Playwright 1.64 起，设备描述符会转发 `screen`（`window.screen` 和媒体查询会看到模拟尺寸，需要时设 `screen: undefined` 退出）。**MEDIUM**

## TypeScript 还是 JavaScript

**推荐：测试和配置都用 TypeScript（`playwright.config.ts`、`*.spec.ts`），不需要 tsconfig、不需要构建。**

- 官方：Playwright 自己把 TS 转成 JS 再运行（"You just write tests in TypeScript, and Playwright will read them, transform to JavaScript and run"）。没有 `tsconfig.json` 也能跑。**HIGH**
- Playwright **不做类型检查**，类型错误不会让测试失败。tsconfig 里只有 `allowJs`、`baseUrl`、`paths`、`jsx*`、`references`、`extends` 这些选项会被 Playwright 读取。因此 tsconfig 对运行时几乎无意义，只服务编辑器。**HIGH**
- 好处：`@playwright/test` 自带完整类型，写 `locator`/`expect`/fixture 时有补全；mock 的接口形状（`db.doc(path).get()/set()`、`user.id()`、`downloads.save()`）可以用 interface 固定下来。
- 这是个保守选择，不是硬要求。若想零类型噪音，用 `.js` + `// @ts-check` 同样可行，Playwright 对 `.js` 同样直接运行。
- 唯一要小心的地方：通过 `page.addInitScript(fn, arg)` 注入的函数会被**序列化成源码**发给浏览器，必须自包含（不能引用模块作用域里的变量或 import）。TS 类型标注会在转译时被去掉，所以没问题。**MEDIUM-HIGH**

## Serving the page：静态服务器 vs `file://`

**推荐：`webServer` + 零依赖 `node:http` 静态服务器，绑定 `127.0.0.1`。不推荐 `file://` 作为主路径。**

| 维度 | `http://127.0.0.1:4789`（推荐） | `file://…/us-journey-tracker.html` |
|------|-------------------------------|------------------------------------|
| localStorage origin | 一个明确的 origin；每个测试是新的 browser context，所以 localStorage 天然隔离 | Chromium 里所有 `file://` 页面共享同一个 origin 键，来源语义因浏览器而异（`STACK.md`/codebase 也指出"file:// origin 行为不同"）；通常能用，但没有在本机验证（**LOW**） |
| 用 `storageState` 预置 localStorage | 支持：`origins: [{ origin: ORIGIN, localStorage: [...] }]`，在首次导航前就预置好 | origin 为 `file://` 时我没有核实到支持（**LOW**） |
| `addInitScript` | 在文档创建后、页面脚本运行前执行；**每次导航和 `reload` 都会重新执行**（见下面的坑） | 同样会执行；官方只保证"文档创建后、脚本前" |
| `baseURL` / `page.goto('/')` | 可用 | 不可用，要拼 `pathToFileURL` |
| `context.route` 拦截 | 对 http(s) 请求有明确文档 | `file://` 请求是否进入 route 我没有核实到（**LOW**），所以不能把它当作"网络阻断已生效"的证据 |
| 与真实宿主的相似度 | 安全上下文（127.0.0.1 属于 potentially trustworthy），与 https 宿主较接近 | 可以，但差异更多 |
| 成本 | 一个 15 行的文件 + `webServer` 配置 | 零 |

### 静态服务器（建议实现形态）

```js
// tests/support/static-server.cjs  —— 零依赖，只服务一个文件
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const APP = path.resolve(__dirname, '..', '..', 'us-journey-tracker.html');
const PORT = Number(process.env.PORT || 4789);

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  if (pathname === '/' || pathname === '/us-journey-tracker.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    fs.createReadStream(APP).pipe(res);      // 每次请求都读文件，应用源码不会被缓存
  } else {
    res.writeHead(404).end();                // favicon 等一律 404，不暴露仓库其他文件
  }
}).listen(PORT, '127.0.0.1');
```

要点：**白名单只服务一个文件**，不要把仓库根目录当静态目录（会暴露 `.planning/`、`.claude/`、以后可能出现的任何备份文件）；只绑定 `127.0.0.1`，不绑 `0.0.0.0`。这对 Windows 也没有特殊问题。**MEDIUM-HIGH**

### 备选：不起服务器，用 `route.fulfill` 做虚拟 origin

`context.route('https://app.test/**', r => r.fulfill({ path: APP_FILE, contentType: 'text/html; charset=utf-8' }))`，其余一律 abort。优点是没有进程、没有端口；缺点是"服务页面"和"拦截网络"混在一处、`https://app.test` 不是真实服务、出问题时更难排查。作为 `webServer` 方案遇到 Windows 端口/进程问题时的退路，不作为首选。**MEDIUM**

## `window.claude` mock 的注入行为（影响选型的几条）

- `addInitScript` 在"文档创建后、页面任何脚本运行前"执行（官方原文），满足"应用启动时 `window.claude` 已存在"的真实契约。**HIGH**
- 它在**每次导航、每次 `reload`** 都会重新运行。两个后果：
  1. **在 init script 里无条件 `localStorage.setItem(seed)` 会在 `page.reload()` 时覆盖掉应用刚保存的数据**，让"刷新后数据还在"的测试永远失败或误判。预置 localStorage 请用 `storageState`（首次导航前，只一次），或者 init script 里加 `if (localStorage.getItem(KEY) === null)`。**HIGH**（由官方语义推出）
  2. 页面内的内存 mock（`window.__mockDb = {}`）在刷新后会被重置。account 模式的"刷新后仍在"需要让 mock 把文档备份到 `sessionStorage`（同标签页、同 origin、刷新后保留，且不是应用用的 `localStorage`），或用 `exposeFunction` 把存储放到 Node 侧。**MEDIUM**
- 多个 init script 的执行顺序，官方只说 context 级和 page 级之间"未定义"。所以不要用"先注册配置脚本、再注册 mock 脚本"这种依赖顺序的做法：**只注册一个**，用 `page.addInitScript(installClaudeMock, config)`（函数 + 可序列化参数）。**HIGH**（官方原文）
- `window.claude` 缺失的"本地模式"就是什么都不注入。
- mock 里记录 `downloads.save({filename,data})` 的调用到 `window.__claudeMock.downloads`，测试用 `page.evaluate` / `expect.poll` 读取；断言 CSV 表头、`MM/DD/YYYY`、引号转义等。

## Clock：冻结"今天"

- `page.clock`（以及 `browserContext.clock`）API：`install`、`setFixedTime`、`setSystemTime`、`pauseAt`、`fastForward`、`runFor`、`resume`。官方文档确认的语义：
  - `setFixedTime(time)`：`Date.now()`/`new Date()` 恒定返回假时间，**所有定时器照常运行**。官方定位为简单场景的首选。
  - `install({time})`：安装整套假时钟（`Date`、定时器、rAF、idle callback、`performance`），作用于整个 BrowserContext；**必须在其他时钟调用之前调用**。`pauseAt`/`fastForward`/`runFor` 在 `goto` 之后用。
  - 时间参数可以是数字（毫秒）、字符串或 `Date`；官方没有说明"只有日期的字符串"的时区解析规则，所以**用不带 `Z` 的完整本地时间 + 固定 `timezoneId`**（如 `new Date('2026-03-18T12:00:00')`，2026-03-18 是周三）。**MEDIUM**
- **推荐默认：`await page.clock.setFixedTime(new Date('2026-03-18T12:00:00'))`，在 `page.goto` 之前调用。**理由：应用的保存防抖（600 ms / 800+600 ms）用真实 `setTimeout`，定时器继续运行就意味着测试可以用 `expect.poll` 等存储变化，不用手动推进时间。选周中的日期，这样"本周"、前后周、过期/未到期任务都容易造数据。
- 需要加速防抖（比如本周复盘文本）或让动画/Toast 超时可控时，对那几个测试改用 `clock.install` + `clock.runFor(1500)`。
- 未在文档里核实的点（**LOW**，第一个 phase 的冒烟测试必须验证）：`setFixedTime` 设置后是否在 `page.reload()` 之后仍然有效。如果不是，在 fixture 里每次导航前重新调用。
- 另外：`expect.poll` 和 Playwright 自己的等待用的是真实时间，不受页面假时钟影响。**MEDIUM**

## Network blocking：拦截所有外部网络

三层，由上到下：

1. **`context.route('**/*', handler)`（放在 `context` fixture 里，页面创建之前注册）**：放行 `http://127.0.0.1:4789`，其余全部 `route.abort('blockedbyclient')`，同时把被拦截的 URL 记到数组里。
   - 官方：`browserContext.route` 对上下文里所有页面生效（含弹窗/新开链接）；同一请求匹配多个路由时按**与注册相反的顺序**执行（后注册先执行），页面级 `page.route` 优先于上下文级。所以不要在测试里随手加会放行外网的 `page.route`。**HIGH**
   - 被拦的应当只有 Google Fonts（`fonts.googleapis.com`，以及 `preconnect` 的 `fonts.gstatic.com`）。加一条守卫测试：被拦 URL 集合 ⊆ 已知白名单；以后应用若多了新的外部依赖，测试会立刻暴露。
2. **`serviceWorkers: 'block'`**：见上，防止 SW 绕过 route。**HIGH**
3. **`--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`（`launchOptions.args`）**：Chromium 层面让除 127.0.0.1 外的所有域名解析失败，兜住 `route` 看不到的请求（如 `<link rel="preconnect">`、WebSocket、浏览器自身的页面级旁路）。限制：只挡 DNS 解析，直接用 IP 字面量的外网地址不受影响，那由第 1 层 abort 负责。这是常用的 Chromium 开关，但我没有在 Edge 156 上实跑验证（**MEDIUM**）。
- 不要把 `context.setOffline(true)` 当主方案：它会让 `127.0.0.1` 也受影响（官方：对导航、`fetch`、XHR、WebSocket 的常规网络栈生效），本地页面都加载不了。
- 页面里 `<link href="https://fonts.googleapis.com/...">` 被 abort 后 `load` 事件仍会触发，应用回退到系统衬线字体，不影响断言。不要用 `waitUntil: 'networkidle'`（官方不推荐，且这里没意义）。**MEDIUM**

## Playwright 里与该应用交互相关的几条确认

- `confirm()`（导入前）：官方 `Dialog` 文档——**没有 `page.on('dialog')` 监听器时，对话框会被自动 dismiss**，`confirm()` 返回 `false`。所以"确认导入"的测试必须先 `page.once('dialog', d => d.accept())`，"取消导入"用 `d.dismiss()`。这是个高频踩坑。**HIGH**
- 编辑弹窗是 HTML `<dialog>` 元素，不是 JS 对话框，用普通 locator（`getByRole('dialog')`）。**MEDIUM**
- 文件导入：`locator.setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(...) })`，用内存 buffer，不需要在磁盘放文件（也杜绝误放真实备份）；对隐藏的 `input[type=file]` 也有效。**MEDIUM**
- HTML5 拖拽：先试 `locator.dragTo(target)`（真实鼠标事件，Chromium 会触发原生拖拽）；如果 `dataTransfer` 没传好，再退到 `page.mouse.move/down/up` 分步，或 `dispatchEvent('dragstart', { dataTransfer })`（配合 `page.evaluateHandle(() => new DataTransfer())`）。**MEDIUM**，需要在 phase 里实测。
- 已知 bug 的标记：`test.fail()`（预期失败，修好后会提示）或 `test.fixme()`，与 PROJECT.md 一致。**HIGH**

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@playwright/test` + `channel: 'msedge'` | `channel: 'chrome'`（Chrome 也已安装） | Edge 升级后与 Playwright 1.64.1 出现兼容问题时，用 `PW_CHANNEL=chrome` 切换，配置里已留口子 |
| `webServer` + `node:http` 静态服务器 | `context.route` + `route.fulfill({path})` 虚拟 origin | Windows 上端口/进程清理出问题，或想要零进程方案 |
| `webServer` + `node:http` 静态服务器 | `file://` | 只在想验证"双击打开文件"的真实场景时，作为单独的、不带网络保证的冒烟测试 |
| TypeScript 测试（无 tsconfig） | JavaScript + `// @ts-check` | 不想要任何类型文件时 |
| 只装 `@playwright/test` | 加 `typescript` + `@types/node` 并跑 `tsc --noEmit` | mock/fixture 变得复杂、需要强类型防回归时 |
| `setFixedTime` | `clock.install` + `runFor` | 需要精确推进防抖/动画/Toast 计时的测试 |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `npx playwright install`（含 `install msedge`/`chromium`/`--with-deps`） | 违反"不下载浏览器、不全局安装"。官方：这类安装放在**操作系统默认的全局位置**；`install msedge` 还会运行 Microsoft 安装器，可能覆盖系统 Edge。浏览器默认缓存也在用户级目录（Windows 下是 `%LOCALAPPDATA%\ms-playwright`，经验值，**MEDIUM**） | 系统 Edge + `channel: 'msedge'`，不运行任何 install 命令 |
| `npm init playwright@latest` | 会生成示例测试、可能生成 GitHub Actions 工作流、并提示下载浏览器（**MEDIUM**，经验） | 手写 `package.json` 和 `playwright.config.ts`（见上） |
| `-g` / `npm install -g playwright`、全局 `npx playwright` 之外的全局配置 | 违反项目约束 | 项目内 devDependency，通过 `npm test` 调用 |
| `playwright` 或 `playwright-core` 单独装 | 没有测试运行器、没有 `expect` | `@playwright/test`（它已依赖前两者） |
| `@playwright/experimental-ct-*`（组件测试）、`@playwright/mcp` | 面向 React/Vue 等框架或 AI 代理，都不适用于单文件黑盒 | 普通 e2e 测试 |
| `http-server` / `serve` / `live-server` / `express` / `vite preview` | 多一个依赖就多一份供应链与升级面；`live-server` 还会往页面里注入热重载脚本，改变被测页面；通用静态服务器会暴露仓库目录 | 15 行 `node:http` 白名单服务器 |
| `cross-env`、`dotenv`、`rimraf`、`ts-node`、`tsx` | Playwright 已经能转译 TS、读 `process.env`；脚本里不需要设环境变量 | 不装 |
| `jest-playwright`、Puppeteer、Cypress、Vitest browser mode | 用户明确要求 Playwright Test；多套工具只会增加依赖 | `@playwright/test` |
| 把 `file://` 当主路径，或加 `--allow-file-access-from-files`、`--disable-web-security` | 网络拦截是否对 `file://` 生效未验证；放宽浏览器安全开关违背"测试应安全可控"的目标 | `http://127.0.0.1` |
| 在 init script 里无条件写 localStorage 种子 | 每次 `reload` 都会重置数据 | `storageState` 预置，或"仅当键不存在才写" |
| `page.waitForTimeout()`、`waitUntil: 'networkidle'` | 固定睡眠脆弱；防抖保存应当等"存储里出现期望值" | `expect.poll(() => page.evaluate(...))`、web-first `expect(locator)` |
| `reuseExistingServer: true`（本项目） | 可能连到别的程序占用的同端口服务，破坏"只测这个文件"的保证 | `false` |
| 访问 claude.ai、使用真实备份文件、`storageState` 里放真实数据 | 项目硬约束 | 合成 fixture，内存 buffer |

## Stack Patterns by Variant

**如果测试"本地模式"（无 `window.claude`）：**
- 不注入任何东西；用 `test.use({ storageState: { cookies: [], origins: [{ origin: ORIGIN, localStorage: [{ name: 'us-journey-tracker-v1', value: JSON.stringify(fixture) }] }] } })` 预置合成数据。
- 因为 storageState 只在 context 创建时应用一次，刷新后应用写入的新数据不会被覆盖。

**如果测试 account 模式（mock 的 `db`/`user`/`downloads`）：**
- 一个 `page.addInitScript(installClaudeMock, { userId: 'u_test', initialDoc: fixture, downloads: true })`。
- mock 的 `db` 文档备份到 `sessionStorage` 以支持刷新；`downloads` 调用记录挂在 `window.__claudeMock`。

**如果 Edge 升级后异常：**
- `PW_CHANNEL=chrome npm test` 换 Chrome 复核，判断是浏览器兼容还是应用问题。

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@playwright/test@1.64.1` | `playwright@1.64.1` → `playwright-core@1.64.1`（自动、同版本） | 三个包版本必须一致，不要单独升级其中一个。**HIGH** |
| `@playwright/test@1.64.1` | Node `>=20`（本机 24.20.0） | HIGH |
| `@playwright/test@1.64.1` | Edge 156.0.4314.58（本机）；官方"测试过"的是 Edge 155，随包捆绑的 Chromium 是 156.0.8078.4 | 相差一个大版本，基于 CDP，风险低；用 `channel: 'chrome'` 可交叉验证。**MEDIUM** |
| `page.clock` | 1.45 起可用（经验值，文档页未写版本） | 远低于 1.64，没有问题。**MEDIUM** |
| Playwright 1.64 的变化 | `screen` 随设备描述符转发；测试文件里的 JSX 遵循 `tsconfig.json`；`--update-snapshots=missing` 语义变化 | 对本项目基本无影响（不用 JSX、不做截图快照对比） |
| Playwright 1.61 的变化 | 移除 `videosPath`/`videoSize` 上下文选项 | 本项目 `video: 'off'`，无影响 |

## Gaps（第一个 phase 的冒烟测试里要实测确认）

1. `channel: 'msedge'` 在 Edge 156 + Windows 11 上能否 headless 启动、无需任何下载（预期可以）。
2. `clock.setFixedTime` 是否在 `page.reload()` 后保持（官方文档没写）。
3. `--host-resolver-rules` 在 Edge 156 上是否生效；以及被拦截请求集合是否只有 Google Fonts。
4. `storageState` 预置 localStorage 在 `http://127.0.0.1:4789` 下是否按预期工作。
5. `dragTo` 能否触发该应用的 HTML5 `dragstart`/`drop` 并带上正确的 `dataTransfer`。
6. 如果将来想支持 `file://` 作为补充路径：`route` 是否拦截 `file://`、`storageState` 是否支持，需要实测，这次没有核实到。

## Sources

- npm registry（直接 `npm view`，2026-11-01）：`@playwright/test@1.64.1` 为 `latest`；`engines.node >=20`；依赖链 `@playwright/test → playwright → playwright-core`（均 1.64.1）；三个包均无 `install` 类脚本；`@playwright/test` 许可证 Apache-2.0。**HIGH**
- https://playwright.dev/docs/browsers — `channel` 用法；branded Chrome/Edge 不默认安装；全局位置安装警告。MEDIUM
- https://playwright.dev/docs/release-notes — 1.64（Chromium 156.0.8078.4，Edge 155 稳定通道）、1.63、1.62、1.61 的变化。MEDIUM
- https://playwright.dev/docs/clock 与 `docs/src/api/class-clock.md`（microsoft/playwright 仓库）— `setFixedTime`/`install`/`runFor` 语义。MEDIUM
- https://playwright.dev/docs/test-webserver — `webServer` 选项、`port` 已弃用、Windows 下 `gracefulShutdown` 被忽略。MEDIUM
- https://playwright.dev/docs/test-typescript 与 `docs/src/test-typescript-js.md` — TS 直接运行、不做类型检查、受支持的 tsconfig 选项。MEDIUM-HIGH
- https://playwright.dev/docs/network、`docs/src/api/class-browsercontext.md`、`docs/src/api/class-route.md` — `route` 顺序、页面级优先于上下文级、Service Worker 绕过、`addInitScript` 时机、`abort` errorCode、`setOffline` 语义。MEDIUM-HIGH
- https://playwright.dev/docs/test-reporters — 内置 reporter、`html` 的 `open` 默认 `'on-failure'`。MEDIUM
- `docs/src/test-api/class-testoptions.md`、`class-testconfig.md` — `trace`/`screenshot`/`timeout`/`workers` 等默认值。MEDIUM
- `docs/src/api/class-dialog.md` — 没有 `dialog` 监听器时自动 dismiss。HIGH
- 本机实测：Edge 路径存在、版本 156.0.4314.58；Node v24.20.0；npm 11.19.0；仓库根目录目前没有 `package.json`、没有 `.gitignore`。HIGH
- 两次 WebSearch 关于 `file://` 下的 localStorage 与 `route` 拦截：没有找到权威结论，因此相关结论标 LOW，没有作为依据。

---
*Stack research for: 单文件原生 JS HTML 应用的 Playwright Test 黑盒测试环境（Windows，系统 Edge）*
*Researched: 2026-11-01*
