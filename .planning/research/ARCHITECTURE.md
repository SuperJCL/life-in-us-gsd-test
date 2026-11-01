# Architecture Research

**Domain:** 单文件原生 JS 网页应用的黑盒浏览器测试工程（Playwright Test + Claude Artifact 运行时 mock）
**Researched:** 2026-11-01
**Confidence:** MEDIUM（`window.claude` 契约来自本地 0.2.96 类型定义，可信度 HIGH；Playwright API 来自 playwright.dev 官方文档，按 gsd 的 provider 分级为 LOW，因为是 WebFetch 摘要；有 4 处需要在阶段 1 用探针测试验证，见“需要实测验证的假设”）

## 结论速览（对应 8 个问题）

| 问题 | 结论 | 理由 |
|------|------|------|
| 目录布局 | `tests/e2e/`（用例）、`tests/support/`（harness）、`tests/mocks/`（mock）、`tests/fixtures/`（数据）；**不建** `tests/pages/` | 669 行的应用不值得一个 view 一个类的 page object，见“page object 取舍” |
| mock 如何注入 | 单个自包含函数 `installClaudeMock(cfg)`，用 `page.addInitScript(fn, cfg)` 注入；**真正的数据存储和记录放在 Node 侧**，页面里的 mock 通过一个 `page.exposeBinding` 做 RPC | `exposeBinding` 文档明确“跨导航存活”，所以刷新后 db 内容和记录都还在；测试直接读 Node 内存，不需要 `page.evaluate` |
| 两种运行模式 | `mode: 'local' \| 'account'` 作为 option fixture，用 `test.use()` 设默认值，`app.open({mode, seed})` 可覆盖 | local：不装 mock，只往 localStorage 播种；account：装 mock，往 Node 侧 `MockBackend` 播种 |
| Playwright fixtures | 一个出口 `tests/support/test.ts`：auto fixture `guard`（网络+报错）、`frozenClock`；option fixture `mode/seed/userId/capabilities/now`；`backend`、`app` | 用例只能 import 这一个 `test`，护栏不会被绕过 |
| page object | 不做 POM 类层级；只做一个 `ui.ts`，放“多个用例共用或选择器不直观”的 locator/动作函数 | 见下文 |
| 页面加载方式 | `webServer` + 自写的零依赖 Node 静态服务器（只服务这一个 HTML）；`file://` 只留一个可选冒烟 | 真 HTTP 源，可 `route`，可固定 origin；服务器只暴露一个文件 |
| 持久化断言 | 先轮询“已落盘”（account：Node 记录；local：localStorage），再 `reload`，再断言 DOM | `pagehide` 会触发 `flush()`，不先等防抖就刷新会测到错误的路径 |
| 构建顺序 | 阶段 1 = 配置+服务器+护栏+冻结时钟+1 条 local 模式端到端；阶段 2 = mock；阶段 3 = 合成数据；阶段 4+ = 各视图 | 见“建议构建顺序” |

## Standard Architecture

### System Overview

```
┌────────────────────────────── Node 进程（Playwright Test runner / worker）──────────────────────────────┐
│                                                                                                         │
│  tests/e2e/*.spec.ts    只写“用户故事”，只 import tests/support/test.ts                                 │
│        │                                                                                                │
│        ▼                                                                                                │
│  tests/support/test.ts  test.extend(...)                                                                │
│   ├─ auto  guard        context.route 拦截 + pageerror/console 收集（teardown 时断言为空）                │
│   ├─ auto  frozenClock  page.clock.setFixedTime(now)                                                    │
│   ├─ option mode/seed/userId/capabilities/now                                                           │
│   ├─ backend            MockBackend（Node 内存：docs、reads、writes、downloads、calls）                   │
│   ├─ app                AppHarness：open/reload/persisted/expectPersisted/dialogs/downloads             │
│   └─ ui                 locator 与动作 helper（composer、editor、toast、tabs、日历格…）                   │
│        │ exposeBinding("__claudeMockBackend")            ▲ 直接读内存，无需 evaluate                     │
└────────┼─────────────────────────────────────────────────┼──────────────────────────────────────────────┘
         │  (RPC：JSON 字符串进、JSON 字符串出，跨 reload 存活)  │
┌────────▼─────────────────────────────────────────────────┴──────────────────────────────────────────────┐
│  Edge（channel: 'msedge'）  一个 BrowserContext = 一个测试 = 干净的 localStorage                          │
│   ┌─ init script（每次导航都在页面脚本前运行）                                                           │
│   │    account 模式： installClaudeMock(cfg) → window.claude = {use}（冻结，use 异步、按名字记忆化）        │
│   │    local 模式：   （不装 window.claude）+ 可选的“若无则播种 localStorage”                              │
│   └─ us-journey-tracker.html（原样、未修改）                                                             │
│        init() → use("db")/use("user") → user.id() → db.doc(path).get() → 渲染                            │
│        persist() → 600ms → flush() → ref.set(state)  | localStorage.setItem                              │
│        导出：window.__dl.save({filename,data})                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
         ▲  http://127.0.0.1:<PORT>/      （其余一切外部请求：abort + 记录 + 让测试失败）
┌────────┴────────────────────────────────┐
│ tests/support/static-server.mjs         │  由 playwright.config.ts 的 webServer 拉起；只服务一个文件
└─────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | 与谁通信 | 实现方式 |
|-----------|----------------|----------|----------|
| `playwright.config.ts` | `channel:'msedge'`、`baseURL`、`webServer`、locale/时区/配色固定、浏览器级网络封锁参数、HTML 报告 | runner、static-server | `defineConfig` |
| `static-server.mjs` | 只在 `127.0.0.1` 服务 `us-journey-tracker.html`（`/` 与 `/us-journey-tracker.html`），`/favicon.ico` 返回 204，其余 404 | 浏览器 | `node:http` + `node:fs`，零依赖 |
| `test.ts`（fixtures） | 把护栏、时钟、模式、播种、backend、app 打包；是用例的唯一入口 | 全部 | `base.extend` |
| `guard`（auto fixture） | 单个 catch-all `context.route('**/*')`：放行应用 origin；字体请求返回空 CSS/204；其余 abort 并记录。teardown 断言“没有外部请求、没有未捕获异常” | context、page | 见模式 2 |
| `frozenClock`（auto fixture） | 在任何导航前 `page.clock.setFixedTime(now)` | page | 见模式 4 |
| `AppHarness` | `open()`、`reload()`、`persisted()`、`expectPersisted()`、确认框策略、`downloads`、`status` 等“应用级”读回口 | page、backend | 普通 TS 类，由 `app` fixture 构造 |
| `MockBackend`（Node 侧） | 内存文档库 + 调用记录（`reads/writes/downloads/calls`）+ 可选延迟 + 同文档并发写检测 | 页面内 mock（经 binding）、`AppHarness` | 普通 TS 类 |
| `installClaudeMock`（页面侧） | 实现 `window.claude.use()` 及 `db/user/downloads` 命名空间；本身**无状态**，全部走 binding | 应用代码、binding | 单个自包含函数 |
| `ui.ts` | 共享 widget 的 locator/动作：tabs、composer（`w`/`c` 两个实例）、editor 对话框、toast、周视图某天、日历格、任务行 | page | 函数返回 locator，不用类 |
| `fixtures/` | `synthetic-state.json`（大而全的合成状态）+ 边界数据 + `state.ts` 构造器 | `AppHarness`、`MockBackend`、用例 | 纯数据 + 小函数 |
| `e2e/*.spec.ts` | 行为用例；已知 bug 用 `test.fail` / `test.fixme` 标注 | `test.ts` | Playwright Test |

## Recommended Project Structure

```
package.json                   # devDependency: @playwright/test（项目内安装）；scripts: test / test:headed / report
playwright.config.ts
.gitignore                     # 增加 node_modules/ test-results/ playwright-report/（不是应用文件）
tests/
├── support/                   # Node 侧 harness，不是用例
│   ├── test.ts                # 唯一出口：export { test, expect }
│   ├── constants.ts           # APP_ORIGIN、STATE_KEY、FROZEN_NOW、USER_ID、两个状态栏文案、BINDING 名
│   ├── app.ts                 # AppHarness
│   ├── ui.ts                  # locator/动作 helper
│   ├── static-server.mjs      # webServer 命令
│   └── check-imports.mjs      # （可选）扫描 e2e/ 里有没有直接 import '@playwright/test'
├── mocks/
│   ├── claude-runtime.ts      # 页面侧：installClaudeMock(cfg)  ← 必须自包含
│   └── claude-backend.ts      # Node 侧：MockBackend
├── fixtures/
│   ├── data/
│   │   ├── synthetic-state.json     # 五类别、完成/到期/过期、自定义待办、力量历史、本周复盘
│   │   ├── legacy-categories.json   # 学习/活动社交/生活/里程碑 → 迁移
│   │   ├── minimal-state.json       # 缺可选字段
│   │   └── malformed-*.json         # 导入失败用（不是 JSON、顶层类型错误等）
│   └── state.ts               # EMPTY_STATE、makeState(overrides)、日期相对 FROZEN_NOW 的小工具
└── e2e/
    ├── smoke.spec.ts                  # 阶段 1 的垂直切片
    ├── platform/                      # harness 自测（防止“测试通过是因为 mock 错了”）
    │   ├── guardrails.spec.ts         # 外部请求被拦、没有真实文件被读
    │   ├── mock-contract.spec.ts      # use() 异步/记忆化/冻结/未知名返回 null/路径文法
    │   └── app-integrity.spec.ts      # （可选）应用文件 sha256 与基线一致
    ├── storage/
    │   ├── local-mode.spec.ts
    │   └── account-mode.spec.ts
    ├── views/
    │   ├── week.spec.ts   calendar.spec.ts   goals.spec.ts   timeline.spec.ts
    └── flows/
        ├── composer.spec.ts   editor.spec.ts   export-import.spec.ts
```

### Structure Rationale

- **`support/` 与 `mocks/` 分开：** `support` 是“测试怎么跑”，`mocks` 是“被测环境长什么样”。以后换成别的应用，`mocks/` 的 Claude 运行时仍可复用。
- **`e2e/` 按关注点分组而不是只按视图：** 视图（`views/`）测“这个页面渲染/交互对不对”；跨视图的复用能力（composer、editor、导入导出）放 `flows/`，避免 week 和 calendar 里各写一份 composer 测试；存储语义放 `storage/`。
- **`platform/` 自测：** mock 与护栏本身是新代码，必须有测试，否则后面 60 条用例的信任基础没有人验证。
- **TypeScript，无构建：** Playwright Test 原生转译 TS，不需要打包。注意页面侧函数会被 `toString()` 序列化，必须自包含（见模式 1）。是否安装 `typescript`/`@types/node` 只为编辑器提示，交给 STACK 决定，不影响运行。
- **不建 `tests/pages/`：** 理由见下一节。

## Architectural Patterns

### Pattern 1: 单个自包含 init script + Node 侧 backend（RPC）

**What:** 页面里的 `window.claude` 只负责“长得像真的”：`use()` 异步、按名字记忆化、命名空间 `Object.freeze`、未知名字或未授权的能力返回 `null`、`doc(path)` 校验路径文法并对奇数段抛 `TypeError`。所有会变的东西（文档内容、写入记录、下载记录）都在 Node 侧，经 `page.exposeBinding` 往返。
**When to use:** 需要“刷新后 mock 数据仍在”和“测试直接读记录”的任何场景，就是本项目。
**Trade-offs:**
- 好：刷新（`page.reload()`）后 binding 仍在，文档库在 Node 内存里自然保留；读回不需要 `evaluate`；可在 Node 侧加延迟（`setTimeout` 不受页面假时钟影响）；同一个 `backend` 可以挂到两个页面，以后测多标签最后写入者胜出。
- 代价：每次 `get/set` 是一次进程间往返（毫秒级，可忽略）；页面函数必须自包含。
- 纯页面内存实现的反例：数据放在 `window.__mockDb`，`reload` 后 init script 重新跑，数据清零，“持久化后刷新”测的是空库。把它存到 localStorage 里可以活下来，但会和应用自己的 localStorage 回退路径混在一起，无法断言“account 模式不碰 localStorage”。

**Example:**
```typescript
// tests/mocks/claude-runtime.ts —— 必须自包含：不能引用本文件以外的任何变量或 import
export interface MockConfig {
  binding: string;
  userId: string | null;
  capabilities: { db: boolean; user: boolean; downloads: boolean };
}

export function installClaudeMock(cfg: MockConfig) {
  const w = window as any;
  // 只在调用时才去取 binding（不要在 init 阶段取：多个 init script 的执行顺序文档未定义）
  const rpc = async (op: string, arg?: unknown) => {
    const r = JSON.parse(await w[cfg.binding](op, JSON.stringify(arg ?? null)));
    if (!r.ok) throw r.error;                      // 契约：拒绝值是普通对象 {code, message}
    return r.value;
  };
  const segOk = (s: string) => /^[A-Za-z0-9_.~:@+-]+$/.test(s) && s !== '.' && s !== '..';
  const deepFreeze = (o: any): any => {
    if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); }
    return o;
  };

  const db = Object.freeze({
    doc(path: string) {
      const segs = path.split('/');
      // 契约：文档路径必须是偶数段，段文法固定；违反则同步抛 TypeError（例如把未 await 的 Promise 拼进路径）
      if (segs.length % 2 !== 0 || !segs.every(segOk)) throw new TypeError('bad doc path: ' + path);
      return Object.freeze({
        id: segs[segs.length - 1], path,
        async get() {
          const { exists, data } = await rpc('db.get', { path });
          return deepFreeze({
            id: segs[segs.length - 1], exists,
            data: () => (exists ? data : undefined),
            metadata: { fromCache: false, hasPendingWrites: false },
          });
        },
        async set(data: Record<string, unknown>) { await rpc('db.set', { path, data }); },
      });
    },
  });
  const user = Object.freeze({ id: async () => cfg.userId });       // 应用只用 id()；多写的成员都是未验证的代码
  const downloads = Object.freeze({
    async save(req: { filename: string; data: unknown }) {
      const text = typeof req.data === 'string' ? req.data
        : req.data instanceof Blob ? await req.data.text()
        : new TextDecoder().decode(req.data as ArrayBuffer);
      await rpc('downloads.save', { filename: req.filename, data: text });
      return { status: 'saved' as const };
    },
  });

  const served: Record<string, unknown> = {
    db: cfg.capabilities.db ? db : null,
    user: cfg.capabilities.user ? user : null,
    downloads: cfg.capabilities.downloads ? downloads : null,
  };
  const memo = new Map<string, Promise<unknown>>();
  Object.defineProperty(window, 'claude', {
    value: Object.freeze({
      use(name: string) {                           // 永不同步完成回调；不用 setTimeout，避免被假时钟卡住
        if (served[name] == null) return Promise.resolve(null);
        if (!memo.has(name)) memo.set(name, Promise.resolve(served[name]));
        return memo.get(name)!;
      },
    }),
    configurable: false,
  });
}
```

```typescript
// tests/mocks/claude-backend.ts —— Node 侧
export class MockBackend {
  docs = new Map<string, unknown>();
  reads: string[] = [];
  writes: { path: string; data: any }[] = [];
  downloads: { filename: string; data: string }[] = [];
  private inflight = 0; overlappingWrites = 0;                       // 契约：同一文档一次只写一次
  constructor(readonly userId: string, private opts: { latencyMs?: number } = {}) {}

  get docPath() { return `data/users/${this.userId}/state`; }
  seed(state: unknown) { this.docs.set(this.docPath, structuredClone(state)); }
  lastState(): any { return this.docs.get(this.docPath) ?? null; }

  async handle(op: string, json: string): Promise<string> {
    const arg = JSON.parse(json);
    const ok = (value: unknown) => JSON.stringify({ ok: true, value });
    if (this.opts.latencyMs) await new Promise(r => setTimeout(r, this.opts.latencyMs));
    switch (op) {
      case 'db.get':
        this.reads.push(arg.path);
        return ok({ exists: this.docs.has(arg.path), data: this.docs.get(arg.path) });
      case 'db.set':
        if (this.inflight++ > 0) this.overlappingWrites++;
        try { this.writes.push({ path: arg.path, data: structuredClone(arg.data) }); this.docs.set(arg.path, structuredClone(arg.data)); }
        finally { this.inflight--; }
        return ok(null);
      case 'downloads.save':
        this.downloads.push({ filename: arg.filename, data: arg.data });
        return ok(null);
      default:
        return JSON.stringify({ ok: false, error: { code: 'unavailable', message: 'unknown op ' + op } });
    }
  }
}
```

### Pattern 2: 单一 catch-all 路由 + 浏览器级封锁 + 失败式 tripwire（三层网络护栏）

**What:**
1. **L1 路由层：** 只注册**一个** `context.route('**/*', handler)`，在 handler 里分支。不要注册多个路由再依赖优先级（文档没有写明多个路由的先后顺序）。
2. **L2 浏览器层：** 在 `playwright.config.ts` 的 `launchOptions.args` 里加 `--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`。理由：应用 `<head>` 里有 `<link rel="preconnect" href="https://fonts.googleapis.com">`，预连接是浏览器发起的 socket 提示，不一定走 `route`；这一层保证“即使 route 漏了，也解析不出任何外部域名”。如果本机有系统代理（国内很常见），主机名可能交给代理解析，所以建议再配 `use.proxy = { server: 'http://127.0.0.1:9', bypass: '127.0.0.1' }` 作为死代理（Chromium 默认对回环地址绕过代理，需在探针里确认）。
3. **L3 tripwire：** 被拦的外部请求不是静默吞掉，而是记录下来，在 fixture teardown 里 `expect(blocked).toEqual([])`，让测试**失败**。字体请求例外（返回空 CSS / 204，保持控制台干净）。

**When to use:** 这是本项目的硬约束（“拦截所有外部网络”“绝不连接 claude.ai”），所以必须是 auto fixture，用例无法忘记它。
**Trade-offs:** L2 的参数来自 Chromium 通用知识而非 Playwright 文档，只能当作“纵深防御”，并且必须由 `platform/guardrails.spec.ts` 里一条测试验证：页面里 `fetch('https://example.com')` 必须失败，且不出现在 `blocked` 以外的路径。`data:`/`blob:` 不经过网络，不受影响。

**Example:**
```typescript
guard: [async ({ context, page }, use) => {
  const blocked: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin === APP_ORIGIN) return route.continue();
    if (u.hostname === 'fonts.googleapis.com') return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    if (u.hostname === 'fonts.gstatic.com') return route.fulfill({ status: 204 });
    blocked.push(u.href);
    return route.abort('blockedbyclient');
  });
  await use();
  expect(blocked, '出现了外部请求').toEqual([]);
  expect(pageErrors, '页面抛出未捕获异常').toEqual([]);
}, { auto: true }],
```

### Pattern 3: “account 模式必须自证”：就绪条件 = 状态栏文案

**What:** 应用有一个静默回退：account 的 `load()` 抛错就悄悄换成 localStorage，只有状态栏文案变化（`已同步保存到你的账户` ↔ `已保存在此浏览器中（换设备不会同步）`）。如果 mock 有 bug，account 模式的用例会在 local 模式下“通过”。因此 `app.open()` 的就绪条件**必须**等到与所选模式对应的状态栏文案，等不到就超时失败，错误信息说明“期望 account 实际回退”。同时 account 冒烟用例断言：`backend.reads` 恰好 1 次且路径为 `data/users/<id>/state`；`open()` 之后 `backend.writes.length === 0`（启动不写）；localStorage 里没有 `us-journey-tracker-v1`。
**When to use:** 所有 account 模式用例（由 fixture 统一做，不靠每个用例自觉）。
**Trade-offs:** 文案是中文常量，应用改文案时测试会红，这恰好是想要的信号；常量集中在 `constants.ts`。

### Pattern 4: 冻结时间用 `setFixedTime`，真实计时器照常跑；需要控制计时器时再显式 opt-in

**What:** 默认 `page.clock.setFixedTime(FROZEN_NOW)`（文档：只固定 `Date.now`/`new Date()`，计时器照常运行，且是文档推荐的首选）。防抖 600 ms 就用真实时间 + 轮询等待落盘，不用 `waitForTimeout`。个别用例（如撤销 toast 5 秒后消失、复盘的 800 ms + 600 ms 双防抖）可通过 option `clockMode: 'controlled'` 改用 `clock.install({time})` + `pauseAt` + `runFor`。两者都必须在 `goto` 之前调用。
**Trade-offs:** 真实计时器让每条“保存后检查”的用例多花 0.6–1.5 秒，80 条用例并行跑仍在一分钟量级；换来的是不需要理解假时钟与应用 `setTimeout` 的交互。`FROZEN_NOW` 选 **2026-03-18（周三）10:00**（该周周一到周日为 3/16–3/22，不跨月），到访日期用例另用 `now` option 覆盖（跨月周、月历 6 行月等）。同时在配置里固定 `timezoneId: 'America/New_York'`、`locale: 'zh-CN'`、`colorScheme: 'light'`、`reducedMotion: 'reduce'`，保证与开发机时区/主题无关。

### Pattern 5: 播种只在“首次”生效（刷新不能重复播种）

**What:** `addInitScript` 在**每次导航**（包括 `reload`）前都会重新执行。如果 local 模式的播种脚本无条件写 localStorage，`reload` 会用种子覆盖应用刚保存的新状态，所有“保存后刷新”的测试都会假通过或假失败。播种脚本必须是“若无则写入”：

```typescript
export function seedLocalStorage(a: { key: string; json: string }) {
  if (localStorage.getItem(a.key) === null) localStorage.setItem(a.key, a.json);
}
await page.addInitScript(seedLocalStorage, { key: STATE_KEY, json });   // 函数 + 参数形式，文档支持
```
account 模式没有这个问题：种子写进 Node 侧 `backend.seed()` 一次，刷新不会重置它。`seed` 既可以是对象也可以是原始字符串（用来测 localStorage 里是坏 JSON 时应用静默回退到空状态）。
**备选：** `storageState` 的 `origins[].localStorage` 只在 context 创建时应用一次，也可行，但需要在 context 创建前就知道 origin 和内容，与“每个用例各自的种子”配合不如“若无则写入”直接。

### Pattern 6: 持久化断言 = 等“已落盘”，再刷新，再断言 DOM

**What:** `AppHarness.persisted()` 在 account 模式读 `backend.lastState()`（Node 内存），在 local 模式 `page.evaluate` 读 localStorage 并 `JSON.parse`。`expectPersisted(predicate)` 用 `expect.poll` 等条件成立（默认 5 秒足够覆盖 600 ms，复盘 800+600 ms）。**之后**才 `app.reload()`。
**为什么不能直接刷新：** `window.addEventListener("pagehide", flush)` 会在刷新时立刻保存。local 模式下 localStorage 同步写入，所以“不等防抖就刷新”也能通过，但测到的是 `pagehide` 路径而不是防抖路径；account 模式下，`pagehide` 里发起的 `db.set` 可能在页面卸载前完不成，用例会间歇性失败。`pagehide` 本身可以单独写一条 local 模式用例专门测。

```typescript
test('记一笔后经防抖保存，刷新仍在', async ({ app, ui }) => {
  await app.open();
  await ui.composer('w').log('语言', '合成测试：练习自我介绍');
  await app.expectPersisted(s => s.logs.some((l: any) => l.text.includes('自我介绍')));
  await app.reload();
  await expect(ui.week.entries).toContainText('练习自我介绍');
});
```

### Pattern 7: 确认框与下载走“记录 + 策略”，不碰真实浏览器下载

**What:** 应用的导出是 `window.__dl.save(...)`，**不会**触发浏览器下载事件，所以不用 `page.waitForEvent('download')`，读 `backend.downloads`（或 `app.downloads`）即可：断言 `filename`（`在美国的日子-日历.csv`、`在美国的日子-备份-2026-03-18.json`，日期来自冻结时钟）和 `data`（CSV 表头、`MM/DD/YYYY`、引号转义；JSON 备份与 `persisted()` 相等）。导入用 `locator('#importJson').setInputFiles({ name, mimeType, buffer })`，不需要磁盘文件。`confirm()` 由 `AppHarness` 在构造时注册**唯一一个** `page.on('dialog')`：按策略队列 `accept/dismiss`，默认 `dismiss`（与 Playwright 无监听器时的行为一致），并记录 `{type, message}`。文档警告：监听器如果既不 accept 也不 dismiss，触发对话框的点击会卡死，所以 handler 必须总是处理对话框。

## Page object 取舍

**结论：不要 `tests/pages/` 目录和每视图一个类；只保留一个 `tests/support/ui.ts`，里面是返回 locator 的函数，按“共享”或“选择器不直观”才收录。**

理由：
1. 应用才 669 行，4 个视图，选择器大多是稳定的 ARIA 名（`getByRole('tab', {name:'日历'})`、`aria-label="编辑：…"`、`aria-label="删除这条记录"`）和 `data-*`（`[data-date="2026-03-18"]`、`[data-wday]`、`[data-task="P1-2"]`）。读一个 spec 就能看懂，不需要再跳一层类。
2. 真正会重复的是三类 widget：**composer**（`w` 与 `c` 两个实例，id 前缀 `w-`/`c-`：`#w-text`、`#w-add`、`[data-ccat="w|语言"]`、`[data-preset]`、`[data-pedit]`、`[data-padd]`）、**editor 对话框**（`#editor`、`#ed-text`、`#ed-date`、`#ed-save`、`#ed-del`、`#ed-undone`、`[data-edcat]`）、**toast**（`#toast` 与其中的“撤销”按钮）。这三个值得抽。
3. 每个视图的 locator 必须**限定作用域**：应用每次 `renderAll()` 渲染四个 tab，隐藏 tab 只是加 `.hidden`，同一条记录会同时出现在周视图、日历格、日面板、时间线里。`getByRole` 默认会排除不可见元素，但 `locator('text=…')`/CSS 选择器不会，容易触发严格模式冲突。所以 helper 一律从 `#tab-wk`、`#tab-cal`、`#tab-goal`、`#tab-tl` 出发。
4. 引入规则：同一选择器被 ≥2 个 spec 使用，或者需要动作封装（拖拽、日历格按日期定位、任务勾选 + 截止日期）时才加入 `ui.ts`；阶段推进时增量增长，不预先写满。

## Data Flow

### Request Flow（一次“记一笔 → 保存 → 刷新”）

```
[test]  ui.composer('w').log('语言','…')
   │  click #w-add（真实浏览器事件）
   ▼
[app]  addLog → persist() → 600ms debounce → flush() → store.save(clone(state))
   │                                    │
   │ local 模式                         │ account 模式
   ▼                                    ▼
localStorage.setItem(KEY)          window.claude.use("db") → db.doc("data/users/<id>/state").set(state)
   │                                    │  rpc('db.set')  —— exposeBinding ——▶ Node: MockBackend.handle
   │                                    │                                         ├ writes.push / docs.set
   │                                    ◀──────────────── {ok:true} ──────────────┘
   ▼                                    ▼
[test]  app.expectPersisted(pred)  ── expect.poll ──▶ local: page.evaluate(localStorage)
                                                      account: backend.lastState()（Node 内存）
   ▼
[test]  app.reload()  → init script 再跑一遍（mock 重新装；local 播种“若无则写”，不覆盖）
   ▼
[app]  init() → store.load()（account: rpc('db.get') 读回 Node 里的文档）→ normalize → renderAll
   ▼
[test]  expect(ui.week.entries).toContainText(…)
```

### State Management

```
测试状态（每个用例独立，随 fixture teardown 销毁）
  MockBackend ─┬─ docs（Map）           ← seed() 写入；db.set 覆盖
               ├─ reads / writes / downloads / calls   ← 测试读回
               └─ overlappingWrites     ← 契约“一次一写”的自检
  浏览器 BrowserContext ── localStorage（local 模式的被测存储）
  AppHarness ── 确认框队列 / 已记录对话框
被测应用状态（页面内，刷新即重建）：state、view、sel、wk、wsel、filter、compCat…
```

### Key Data Flows

1. **启动与存储选择（account）：** `use("db")`/`use("user")` → `user.id()` → `db.doc(path).get()`（一次）→ 渲染 → `use("downloads")` → 揭示导出按钮。`AppHarness.ready()` 等“状态栏=account 文案”，若 account 设了 `downloads:true` 再等 `#exportJson` 可见，因为导出按钮在状态文案之后才出现。
2. **local 模式：** 不安装 `window.claude`（应用的 `window.claude?` 分支走 `null`）；种子用“若无则写入”的 init script 写入 localStorage；导出按钮保持 `hidden`，用例可断言不可见。
3. **能力变体（便宜，都不是错误路径）：** `capabilities:{downloads:false}`（有 db 无下载，导出按钮隐藏）；`userId:null`（有 db 但无 id，应用回退到 localStorage）；`db/user/downloads` 全为 `false`（顶层页面里 `window.claude` 存在但 `use()` 全返回 `null`，契约明确描述的真实情形）。这几个只是配置位，不增加 mock 代码。
4. **导入：** `setInputFiles` → `FileReader` → `normalize` → `confirm()`（走 `AppHarness` 的策略）→ 整体替换 `state` → `persist()`。
5. **导出：** 点击 → `window.__dl.save` → mock → binding → `backend.downloads`。

## 测试隔离与时间线

- 每个用例一个 `BrowserContext`（Playwright 默认），所以 localStorage、`backend`、确认框队列、路由都是用例私有的，`fullyParallel: true` 安全；没有 `globalSetup` 状态，没有跨用例的共享可变对象。
- 唯一共享的是静态服务器，它无状态，每次请求读文件。
- 种子数据一律是**不可变常量**，进入 fixture 前 `structuredClone`，防止某个用例改坏对象影响别的用例。

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| ~20 条用例（阶段 1–3） | 单个 `desktop-edge` project，`fullyParallel`，运行在十几秒量级；`ui.ts` 只有 tabs/composer |
| ~80–120 条用例（全部视图 + 导入导出） | 仍是一个 project；`ui.ts` 控制在 ~150 行；`test.describe` 里用 `test.use({seed})` 分组避免每条重复播种；可加 `mobile-edge` project（viewport ≤560px，`hasTouch`）只跑 `@mobile` 标签的少数用例 |
| 以后应用被修改（后续里程碑） | 加 `app-integrity` 基线哈希的更新流程；内置任务 id 是位置式的（`P<n>-<i>`），种子里的任务 id 要跟随 `GROUPS` 变化；考虑把“选择器契约”集中，减少改动面 |

**第一个瓶颈：** 每条“保存后检查”的用例要等 0.6–1.5 秒真实防抖。缓解：并行度；或对少数用例用 `clockMode:'controlled'`。**第二个瓶颈：** 中文文案常量散落在各 spec。缓解：集中到 `constants.ts`/`ui.ts`，spec 里只写用户可见的业务文本。

## Anti-Patterns

### Anti-Pattern 1: mock 状态放在页面里

**What people do:** `window.__mockDb = {...}`，用 `page.evaluate` 读写入记录。
**Why it's wrong:** `reload()` 后 init script 重跑，记录和文档清零，“持久化”变成对空库的断言；`pagehide`、导航还可能丢掉最后一次写入的记录。
**Do this instead:** Pattern 1，状态放 Node 侧，经 `exposeBinding`（文档：跨导航存活）。

### Anti-Pattern 2: 无条件播种 localStorage

**What people do:** `addInitScript(() => localStorage.setItem(K, seed))`。
**Why it's wrong:** 每次导航都重播，刷新会覆盖应用刚保存的状态。
**Do this instead:** Pattern 5，“若无则写入”，或者 account 模式的 Node 侧播种。

### Anti-Pattern 3: 保存后立刻 `reload()` 或 `waitForTimeout(700)`

**What people do:** 做完操作马上刷新，或睡 700 ms。
**Why it's wrong:** 前者测到的是 `pagehide` 的补救写入，account 下会间歇失败；后者既慢又在慢机器上不稳（复盘是 800 + 600 ms）。
**Do this instead:** Pattern 6，轮询“已落盘”再刷新。

### Anti-Pattern 4: account 用例不验证“真的在 account 模式”

**What people do:** 只注入 mock，不看状态栏。
**Why it's wrong:** 应用在 `load()` 抛错时静默回退到 localStorage，所有用例照样通过。
**Do this instead:** Pattern 3，就绪条件包含对应模式的状态栏文案，并断言 `backend.reads` 与 localStorage 无状态键。

### Anti-Pattern 5: 用例直接 `import { test } from '@playwright/test'`

**What people do:** 在某个 spec 里绕开自定义 `test`。
**Why it's wrong:** auto fixture（网络护栏、时钟冻结）不会生效，这条用例可能真的发出外部请求。
**Do this instead:** 唯一出口 `tests/support/test.ts`；加一个 10 行的 `check-imports.mjs` 作为 `pretest` 脚本，发现 `e2e/` 里有 `from '@playwright/test'` 就失败。

### Anti-Pattern 6: 未限定作用域的 locator 与 ElementHandle

**What people do:** `page.getByText('合成测试：…')`、保存 `$()` 返回的 ElementHandle。
**Why it's wrong:** 同一文本同时出现在周视图、日历、日面板、时间线；`renderAll()` 用 `innerHTML` 重建全部 DOM，句柄立刻失效。
**Do this instead:** 从 `#tab-*` 容器出发的 `Locator`（惰性重新解析），不持有 ElementHandle。

### Anti-Pattern 7: 在 mock 里写“聪明”的错误/限流逻辑

**What people do:** 为了“完整”实现 `rate_limited`、`declined`、`quota_exceeded`。
**Why it's wrong:** 本里程碑只做正常路径（用户已确认）；未经应用验证的错误分支会变成无人使用的代码，还会稀释 mock 的可信度。
**Do this instead:** 只实现正常路径；保留 `capabilities` 配置位和 `handle()` 的 `default` 分支作为以后扩展点。

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude Artifact 运行时 (`db`/`user`/`downloads`) | 页面内 `installClaudeMock` + Node 侧 `MockBackend` | 契约来源：0.2.96 类型定义。`use()` 永不在页面脚本首次同步运行期间完成；resolved 命名空间冻结；`get()` 返回 `{id, exists, data(), metadata}`；`set()` 整体替换；`save()` 返回 `{status:'saved'}` |
| Google Fonts | `guard` 里返回空 CSS / 204 | 保持控制台干净；L2 保证预连接也出不去 |
| claude.ai / 生产存储 | **永不连接** | 不在任何路径上；L1+L2+L3 三层都会让这类请求失败测试 |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| spec ↔ `test.ts` | fixtures（`app`、`ui`、`backend`、options） | spec 不直接操作 `page.route`/`addInitScript` |
| `AppHarness` ↔ 页面 | `goto/reload/evaluate`（仅 localStorage 读取）+ DOM | 其余全部用 locator |
| 页面 mock ↔ `MockBackend` | `exposeBinding("__claudeMockBackend", (source, op, json) => backend.handle(op, json))`，JSON 字符串进出 | 懒调用；错误编码为 `{ok:false,error:{code,message}}`，页面侧原样 `throw` |
| 测试 ↔ 应用 | **仅黑盒**：DOM、ARIA、`data-*`、localStorage 键、状态栏文案、`window.claude` 边界 | 不读也不依赖应用的内部变量；`window.__dl` 是应用的内部旁路，不要断言它 |
| 应用文件 ↔ 测试工程 | 只读：静态服务器读文件；`app-integrity` 对其 sha256 做基线 | 应用是未跟踪文件，`git diff` 无法发现改动，哈希是唯一的“没改应用”硬证据 |

## 建议构建顺序（给路线图）

依赖关系：

```
包与配置 ──▶ 静态服务器 ──▶ guard + frozenClock ──▶ AppHarness(local) ──▶ 端到端冒烟 [阶段 1]
                                                   │
                        ┌──────────────────────────┤
                        ▼                          ▼
            seed（local/账户共用的状态构造）   MockBackend + installClaudeMock + 契约自测 [阶段 2]
                        │                          │
                        └─────────────┬────────────┘
                                      ▼
                       合成 fixtures（大而全 + 边界）[阶段 3]
                                      ▼
            composer/editor/toast helper ──▶ week ─▶ calendar ─▶ goals ─▶ timeline [阶段 4–5]
                                      ▼
                  导入/导出（需要 mock 的 downloads + 确认框策略）[阶段 6]
                                      ▼
              可选：mobile project、file:// 冒烟、app-integrity、check-imports [阶段 7]
```

| 阶段 | 内容 | 交付物 | 为什么在这个位置 |
|------|------|--------|------------------|
| 1 垂直切片 | `package.json` + 项目内 `@playwright/test`（当前 npm latest 为 1.64.1，实施时再确认并锁定）、`playwright.config.ts`、`static-server.mjs`、`guard` + `frozenClock`、`AppHarness`（local 模式）、`smoke.spec.ts`、HTML 报告 | `npm test` 一条命令：起服务器 → 开 Edge → 无网络 → 冻结时间 → 记一笔 → 等 localStorage 落盘 → 刷新 → 断言 → 出报告 | 用最少的零件打通全链路，且**不依赖 mock**；护栏在第一天就生效，之后每一行测试都受保护。同时验证“需要实测验证的假设”里的 L2 与 setFixedTime |
| 2 mock | `MockBackend`、`installClaudeMock`、`exposeBinding`、`mode:'account'` 的 `open()`、状态栏就绪条件、`platform/mock-contract.spec.ts`、`storage/account-mode.spec.ts` | 账户模式冒烟：读 1 次、启动不写、写入被记录、刷新后读回、localStorage 无状态键 | 依赖阶段 1 的 harness；是导出/导入和 account 存储测试的前提 |
| 3 合成数据 | `synthetic-state.json`、`legacy-categories.json`、`minimal-state.json`、`malformed-*.json`、`state.ts`；`seed` option 通吃两种模式 | 一份能同时点亮四个视图的状态（五类别、完成/到期/过期任务、自定义待办、四项力量历史、本周复盘、预设标签增删） | 视图测试需要数据；先于视图，否则每个 spec 各造数据 |
| 4 composer + editor + 周/日历 | `ui.ts` 的 tabs/composer/editor/toast；`flows/composer.spec.ts`、`flows/editor.spec.ts`；`views/week.spec.ts`、`views/calendar.spec.ts` | 记录、预设标签、编辑弹窗（改文字/类别/日期、删除+撤销）、周统计、补记某天、拖拽换日、复盘文本、月历切换与日面板 | composer 与 editor 被周/日历/时间线共用，先抽共享件 |
| 5 目标 + 时间线 | `views/goals.spec.ts`、`views/timeline.spec.ts` | 勾选任务（今日完成）、截止日期与过期样式、自定义待办增删、力量值更新与历史、进度条；按类别筛选、按月倒序、点击条目进入编辑 | 与 4 相互独立，可并行；时间线依赖 editor |
| 6 导入导出 | `flows/export-import.spec.ts`，确认框策略、`setInputFiles`、`backend.downloads` | CSV 表头/日期格式/转义、JSON 备份、导入替换/取消确认/坏文件；local 模式下导出按钮不可见 | 依赖阶段 2 的 downloads mock 与阶段 3 的边界数据 |
| 7 收尾（可选） | `mobile-edge` project（≤560px）、`file://` 冒烟、`app-integrity`、`check-imports.mjs`、已知 bug 清单（`test.fail`/`test.fixme`） | 回归网和护栏的“防呆” | 价值高但不阻塞；`app-integrity` 建议尽早加（成本只是一个哈希） |

### 需要实测验证的假设（阶段 1–2 用探针测试确认，不要靠推理）

1. **`exposeBinding` 在页面脚本之前可用：** 文档只写了“跨导航存活”，没写与页面脚本的先后。设计上已规避（懒调用，只在 `get/set/save` 时才用），阶段 2 的 account 冒烟会直接验证。
2. **`--host-resolver-rules` 与死代理（L2）：** 不在 Playwright 文档里。阶段 1 的 `guardrails.spec.ts` 里必须有一条“页面 `fetch('https://example.com')` 失败”的测试；若有系统代理影响，再加 `use.proxy`。
3. **`setInputFiles` 对隐藏的 `<input type=file class="hidden">` 是否可用**，以及 Playwright 是否能复现 CONCERNS 里的“取消导入后再选同一个文件没反应”（Playwright 会主动派发 `change`，很可能复现不了；若复现不了，该用例用 `test.fixme` 并注明原因，不要为它改应用）。
4. **`locator.dragTo` 对原生 HTML5 拖拽的行为：** 官方 `dragTo` 文档只描述 mousedown → mousemove → mouseup，没提 HTML5 拖放。应用在 `#days` 上用 `dragstart/dragover/drop`，且只依赖模块内的 `dragId` 变量，不读 `dataTransfer`，所以有稳妥的备选：用 `page.evaluateHandle(() => new DataTransfer())` 取一个 `DataTransfer`，依次对源条目 `dispatchEvent('dragstart', {dataTransfer})`、目标日 `dispatchEvent('dragover'/'drop', {dataTransfer})`、源条目 `dispatchEvent('dragend')`。拖拽用例只在桌面 project 跑。

另外两条不确定、**不要依赖**的信息：
- 有一份文档摘要提到 `addInitScript` 在 v1.62 增加了 `exposeFunctions` 选项，另一份发布说明摘要只说“`addInitScript` 现在接受函数作为参数”，两者不一致，可信度 LOW。本设计只用 `exposeBinding`（早于 v1.9，稳定）。
- `page.route` 与 service worker：文档建议 `serviceWorkers: 'block'`，应用本身没有 service worker，配置里加上只是防御。

## Sources

- 本地：`.planning/PROJECT.md`、`.planning/codebase/ARCHITECTURE.md`、`INTEGRATIONS.md`、`TESTING.md`；`us-journey-tracker.html`（只读，重点是 356–379、368–379 的 `init()`、559–594 的 editor、598–605 的拖拽、639–658 的导出/导入）— 可信度 HIGH
- 本地：Artifact 运行时 0.2.96 类型定义 `claude.d.ts`、`db.d.ts`、`user.d.ts`、`downloads.d.ts`（`use()` 时序、命名空间冻结、路径文法、`DocumentSnapshot`、`save()` 结果、`id()` 永不 reject）— 可信度 HIGH
- https://playwright.dev/docs/api/class-page — `addInitScript`（导航时运行；多个 init script 的执行顺序“未定义”；`arg` 仅在 script 为函数时可用）、`exposeBinding`（“survive navigations”，首个参数 `{browserContext, page, frame}`）— gsd 分级 LOW（WebFetch 摘要），官方文档
- https://playwright.dev/docs/clock — `setFixedTime`（文档推荐、计时器照常运行）、`install`/`pauseAt`/`runFor`/`fastForward` — gsd 分级 LOW，官方文档
- https://playwright.dev/docs/test-fixtures — `test.extend`、auto fixture、option fixture、teardown、覆盖内置 fixture、`mergeTests` — gsd 分级 LOW，官方文档
- https://playwright.dev/docs/test-webserver — `command/url/reuseExistingServer/timeout/env`；`url` 仅用于就绪探测，导航用 `baseURL`；`gracefulShutdown` 在 Windows 上被忽略 — gsd 分级 LOW，官方文档
- https://playwright.dev/docs/network、https://playwright.dev/docs/dialogs — 路由、`serviceWorkers:'block'`；无 `dialog` 监听器时对话框自动 dismiss，监听器不处理会卡住 — gsd 分级 LOW，官方文档
- https://playwright.dev/docs/api/class-locator — `dragTo` 的鼠标序列描述 — gsd 分级 LOW，官方文档
- `npm view @playwright/test`（只读查询，2026-11-01）：latest = 1.64.1 — 可信度 MEDIUM

---
*Architecture research for: Playwright 测试工程 + Claude Artifact 运行时 mock（单文件原生 JS 应用）*
*Researched: 2026-11-01*
