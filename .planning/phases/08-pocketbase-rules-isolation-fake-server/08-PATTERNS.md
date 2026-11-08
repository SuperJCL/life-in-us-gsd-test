# Phase 8: PocketBase 规则、隔离与假服务器 - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 27（新建 23，修改 6，其中 `package.json`、`.gitignore` 为小改）
**Analogs found:** 22 / 27（5 个只有部分类比或无类比，见末尾）

> 隐私：本文件不含任何 IP、域名、邮箱、口令或令牌。所有路径都已用 `git ls-files` 确认是被 git 跟踪的源码（`tools/probe/page/vendor/*`、`tools/probe/server/*`、`tests/*` 均已确认）。
> D-05 以修订版为准：普通账号只能自己改密码，邮箱只能由所有者在后台改。所以没有 `users_self_email.js` 迁移，`manageRule = null`，隔离断言用 D5-5（改邮箱得 400 `validation_values_mismatch`），不用 D5-6、D5-7。

## File Classification

| 新建/修改文件 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `pb/pb_migrations/<ts>_users_lockdown.js` | migration | batch（一次性结构变更） | `tools/probe/server/pb_migrations/probe_schema.js` 第 9-15 行 | exact |
| `pb/pb_migrations/<ts>_journey_docs.js` | migration | CRUD 规则定义 | `tools/probe/server/pb_migrations/probe_schema.js` 第 19-73 行 | exact |
| `pb/rules.expected.json` | config（规则快照） | transform | `tools/probe/schema.json`（由 `schema-check.mjs` 读取） | role-match |
| `tools/pb/migration-check.mjs` | utility（静态检查） | transform | `tools/probe/schema-check.mjs`（`node:vm` 沙箱） | exact |
| `tools/pb/lib/instance.mjs` | utility（进程管理） | file-I/O + request-response | `tools/probe/server/02-install-pocketbase.sh`（钉死 sha256 与失败策略）；无进程管理类比 | partial |
| `tools/pb/fetch-local-pb.mjs` | utility | file-I/O（下载、核对、解压） | `tools/probe/server/02-install-pocketbase.sh` 第 30-92 行 | role-match |
| `tools/pb/PB-LOCAL.md` | docs | — | `tools/probe/page/vendor/README.md` + `SHA256SUMS` | role-match |
| `tools/pb/isolation-check.mjs` | utility（断言脚本） | request-response + event-driven（SSE） | `tools/probe/schema-check.mjs`（零依赖、`--self-test`、退出码约定） | role-match |
| `tools/pb/lib/sse-client.mjs` | utility | streaming | 无（研究文档 Code Examples 有骨架） | none |
| `tools/pb/lib/normalize.cjs` | utility | transform | `tools/privacy/privacy-check.mjs` 的纯函数风格（`findTokenShapes`、`scanText`） | role-match |
| `tools/pb/lib/scenarios.cjs` | config（场景表） | transform | 无 | none |
| `tools/pb/record-samples.mjs` | utility | batch + file-I/O | `tools/probe/schema-check.mjs`（CLI 外壳） | partial |
| `tests/mocks/pb-server.ts`（FakePbServer） | service（Node 侧 mock） | CRUD + event-driven | `tests/mocks/claude-backend.ts` | exact（门面）/ role-match（协议） |
| `tests/mocks/pb-runtime.ts`（假 EventSource） | provider（页面侧注入） | event-driven | `tests/mocks/claude-runtime.ts`（自包含函数、`addInitScript(fn, arg)`） | exact |
| `tests/mocks/pb-samples/*.json` | fixture | — | `tests/fixtures/*.json`（带 `_synthetic` 标记） | partial |
| `tests/mocks/PB-CONTRACT.md` | docs | — | `tests/mocks/CONTRACT.md` | exact |
| `tests/support/app.ts`（改：加 cloud 模式） | harness | request-response | 自身，`account` 分支第 62-76 行 | exact |
| `tests/support/test.ts`（改：`classifyRequest`、`attachGuard`、cloud 策略） | middleware（护栏） | request-response | 自身，第 90-110 行 | exact |
| `tests/support/constants.ts`（改：加 `PB_*` 常量） | config | — | 自身，`MOCK_BINDING_NAME`、`CLAUDE_CONTRACT_VERSION` | exact |
| `tests/support/static-server.cjs`（改：放行 SDK 路径，启动校验哈希） | middleware | request-response | 自身，第 11-19、48-67 行 | exact |
| `tests/e2e/platform/app-integrity.spec.ts`（改：ENV-03） | test | request-response | 自身，第 35-56 行 | exact |
| `tests/cloud/pb-contract.spec.ts` | test | transform（样本对 `handle()`） | `tests/e2e/platform/mock-contract.spec.ts` | role-match |
| `tests/cloud/cloud-harness.spec.ts` | test | request-response + event-driven | `tests/e2e/platform/mock-contract.spec.ts`（`app.open` 加 `page.evaluate`） | role-match |
| `tests/cloud/guard-cloud.spec.ts` | test | request-response | `tests/e2e/platform/guardrails.spec.ts`（故意违规自检、`guard.remove`） | exact |
| `tests/cloud/probes-cloud.spec.ts` | test | event-driven | `tests/e2e/platform/probes.spec.ts` + `tests/PROBES.md` | exact |
| `playwright.cloud.config.ts` | config | — | `playwright.config.ts` | exact |
| `package.json`（改：加脚本） | config | — | 自身第 6-9 行 | exact |
| `.gitignore`（改：加 `/tools/pb/bin/`） | config | — | 现有 `pocketbase.exe`、`/pocketbase` 规则 | exact |

## Pattern Assignments

### 迁移：`pb/pb_migrations/<ts>_users_lockdown.js` 与 `<ts>_journey_docs.js`

**Analog:** `tools/probe/server/pb_migrations/probe_schema.js`

**写法约束**（第 8、84-86 行）：单个 `migrate((app) => {...}, (app) => {/* 不写回滚 */})`，没有 `import`，不含凭据，不放应用级设置（限流、代理头、日志保留属于 Phase 13）。
```js
migrate((app) => {
  // ...
}, (app) => {
  // 探针站点可以重装……所以不写回滚。
})
```

**users 加固**（第 11-15 行，已在 0.41.1 上跑通）。Phase 8 在此基础上扩展：`listRule`/`viewRule = "id = @request.auth.id"`，`updateRule` 加 `:isset = false` 防改 `verified`、`emailVisibility`，`authToken.duration = 7776000`，`authAlert/otp/mfa/oauth2` 关闭。`manageRule = null`（D-05 修订）。
```js
const users = app.findCollectionByNameOrId("users")
users.createRule = null
users.updateRule = null   // Phase 8 改为 "id = @request.auth.id && @request.body.verified:isset = false && ..."
users.deleteRule = null
app.save(users)
```
`users.authToken.duration`、`users.fields.removeByName(...)` 在 JSVM 里的写法未在 0.41.1 上运行过（研究 Assumptions），要靠 `migration-check.mjs` 加真实实例快照证实。

**集合定义**（第 19-30 行，`new Collection({...fields:[...]})` 写法）：
```js
app.save(new Collection({
  type: "base",
  name: "probe_results",
  listRule: null,
  createRule: "@request.auth.id != \"\"",
  updateRule: null,
  deleteRule: null,
  fields: [
    { type: "text", name: "run_id", required: true, max: 40 },
    { type: "select", name: "carrier", required: true, maxSelect: 1, values: [...] },
    { type: "json", name: "push_ms", maxSize: 4000 },
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
  ],
}))
```
`journey_docs` 直接按 RESEARCH.md 第 694-720 行的 Code Example 写：五条规则、`owner` relation（`cascadeDelete: true`）、`kind` select（`state`、`plan`）、`data` json（`maxSize: 4194304`，不勾 required）、`writer` text（`max: 40`）、两个 autodate、唯一索引 `(owner, kind)`。`deleteRule: null`。

**注意（探针先例里的经验）**：number/bool 字段不设 `required`（`probe_schema.js` 第 17-18 行的注释）；JSON 字段同理，所以 `data` 不勾必填。

**目录**：必须是 `pb/pb_migrations/`，不能是 `pocketbase/`（被 `.gitignore` 第 52 行 `/pocketbase` 整体忽略）。

---

### `tools/pb/migration-check.mjs`（utility，transform）

**Analog:** `tools/probe/schema-check.mjs`

**文件头约定**（第 1-24 行）：shebang；零依赖，只用 `node:` 内置模块；文件头写用法、输出格式、退出码；隐私约定（输出只含模式名、集合名、字段名和差异种类，不打印被检查文件内容）。
```js
#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
```
退出码：0 一致；1 不一致；2 用法错误或读不到文件。有 `--self-test`。

**对象键序不敏感的比较**（第 40-49 行）：
```js
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
```
做法：在 `node:vm` 沙箱里提供假的 `migrate`、`Collection`、`app`（`findCollectionByNameOrId` 返回一个可记录赋值的对象，`save` 记录快照），执行迁移后与 `pb/rules.expected.json` 比对。比对 `users` 时额外检查 `createRule === null`、`deleteRule === null`、`authToken.duration === 7776000`、`manageRule === null`。快照里不放 `authToken.secret`、随机 id、时间戳。

---

### `tools/pb/fetch-local-pb.mjs` 与 `tools/pb/PB-LOCAL.md`（file-I/O，一次性批准后运行）

**Analog:** `tools/probe/server/02-install-pocketbase.sh`，`tools/probe/page/vendor/README.md` / `SHA256SUMS`

**钉死哈希加两道核对**（第 79-92 行）。照抄这个结构：下载 zip 和 `checksums.txt`，第一道比 zip 哈希与钉死值，第二道从 `checksums.txt` 里取该文件名那一行、要求恰好一行且等于钉死值，任何不符就中止、什么都不解出。
```bash
ACTUAL_SHA256=$(sha256sum "$T/pb.zip" </dev/null | awk '{print $1}')
if [ "$ACTUAL_SHA256" != "$PINNED_SHA256" ]; then
  echo "HASH MISMATCH: ... 已中止，什么都没有安装。" >&2
  exit 1
fi
LISTED_SHA256=$(awk -v n="$ZIP_NAME" '$2 == n || $2 == "*" n {print $1}' "$T/checksums.txt" ...)
if [ "$(printf '%s\n' "$LISTED_SHA256" | grep -c .)" != "1" ] || [ "$LISTED_SHA256" != "$PINNED_SHA256" ]; then ... exit 1; fi
```
**下载参数**（第 75-76 行）：只允许 https、`--tlsv1.2`、`--max-redirs 5`、超时。Node 里对应用 `fetch` 加 `redirect` 次数限制和 `AbortSignal.timeout`。

**差异**：
- Windows 包只有 `checksums.txt` 一个来源，GitHub 上没有 v0.41.1（研究 OWNER-DECISION-2），要在 PB-LOCAL.md 里如实写信任模型，不要写成“交叉核对过”。
- 只解出 `pocketbase.exe` 一个文件到 `tools/pb/bin/`；再算出 exe 的 sha256 记进 PB-LOCAL.md；`instance.mjs` 每次运行前核对 exe。
- 批准点：本脚本不能在所有者批准前运行，脚本的参数和文件头要写明这一点。批准时贴出来源、文件名、大小（13,012,018 字节）、sha256（见 RESEARCH.md 第 157 行；这个值是哈希，不是密钥，可以写进仓库）。

---

### `tools/pb/lib/instance.mjs`（一次性实例）

**Analog:** 无进程管理类比。参考 RESEARCH.md Pattern 2 和 Code Examples 第 724-741 行。仓库内能借用的只有两点：

1. 失败策略和“不打印路径、不打印内容”的风格，取自 `tests/support/static-server.cjs` 第 70-74 行：
```js
server.on('error', (e) => {
  process.stderr.write(`静态服务器启动失败：${e && e.code}\n`);
  process.exit(1);
});
```
2. 只绑定回环地址，取自第 76-77 行 `server.listen(PORT, '127.0.0.1')`。PocketBase 同理：`--http=127.0.0.1:<随机端口>`。

要点（研究已给出，这里只列规划必须执行的）：先核对 exe sha256（不符退出码 2）；`fs.mkdtempSync(path.join(os.tmpdir(), 'usj-pb-'))`；超级用户必须先于 `serve` 创建，用 `spawn(bin, [数组], ...)` 形式，**命令的完整文本不得出现在被跟踪文件里**（规则 G）；输出重定向到日志文件，不回显；`child.kill()` 后等 `exit` 再 `rmSync(..., {maxRetries:10, retryDelay:300})`；`try/finally` 加 `SIGINT`/`exit` 三处都停止。

---

### `tools/pb/isolation-check.mjs`、`tools/pb/lib/sse-client.mjs`

**Analog:** 约定取自 `tools/probe/schema-check.mjs`（零依赖、`--self-test`、一行结论、退出码 0/1/2）。断言矩阵直接用 RESEARCH.md Pattern 3 表格（ACCT03-1…5、ACCT04-1…26、RT-1…6、TOK-1/2、D5-1…5、REPLAY-1、NEG-1）；D5-6、D5-7 因 D-05 修订不写。

**输出约定**：`PASS|FAIL <编号> <规则名>`，失败时只附状态码和错误码；永不打印令牌、口令、请求体、响应体、邮箱。凭据用 `crypto.randomBytes` 运行时生成，邮箱用保留域名（`example.com` 系列）运行时拼接。每条断言同时检查状态码和“超级用户回读数据没变”。

**SSE**：无仓库内类比，复制 RESEARCH.md 第 743-775 行的骨架（`fetch` 加 `ReadableStream`，按 `\n\n` 切块，解析 `id:`、`event:`、`data:`）。

**需要正向对照和反向对照**（NEG-1：故意写错规则的临时集合，必须让对应断言失败），这与仓库“每条规则配一条故意违规自检”的约定一致。

---

### `tests/mocks/pb-server.ts`（FakePbServer）

**Analog:** `tests/mocks/claude-backend.ts`

**门面**（第 6-25 行）：同名同义的 `reads`、`writes`、`downloads`、`seed()`、`lastState()`，状态在 Node 侧，每个 `AppHarness` 新建一个实例，用例之间不共享。
```ts
export class MockBackend {
  reads: string[] = [];
  writes: Array<{ path: string; data: any }> = [];
  downloads: Array<{ filename: string; data: string }> = [];
  private docs = new Map<string, unknown>();
  seed(state: unknown): void { this.docs.set(ACCOUNT_DOC_PATH, JSON.parse(JSON.stringify(state))); }
  lastState(): any { ... return JSON.parse(JSON.stringify(this.docs.get(ACCOUNT_DOC_PATH))); }
```
**深拷贝约定**：进出都 `JSON.parse(JSON.stringify(...))`，之后改原对象不影响内部状态（第 18、24、37-38 行）。

**单一入口加纯函数**（第 28-48 行）：`handle(...)` 是同步纯函数，`switch` 分发，**未知操作抛错**。
```ts
handle(op: string, json: string): string {
  const arg = JSON.parse(json);
  switch (op) { ... default: throw new Error('MockBackend: unknown op ' + op); }
}
```
**与 v1 的差异（必须照研究改）**：v1 对未知 op 抛错；FakePbServer 对未实现的 `/api/*` 返回 `null`，由 `context.route` 调 `route.fallback()`，落到 guard 记违规（这是“假服务器覆盖应用全部调用”的执行办法）。错误路径：v1 只做正常路径，Phase 8 要做 401（仅 `auth-refresh`）和唯一索引冲突 400。

**令牌**：三段在运行时拼接，源码里不出现 `eyJ` 字面量（规则 F）；`exp` 用假时钟（基于 `FROZEN_NOW`），不用真实时间。

---

### `tests/mocks/pb-runtime.ts`（页面侧假 EventSource）

**Analog:** `tests/mocks/claude-runtime.ts`（经 `addInitScript(fn, arg)` 注入的自包含函数）。`app.ts` 第 72-75 行的注入方式：
```ts
await this.page.addInitScript(installClaudeMock, {
  binding: MOCK_BINDING_NAME,
  userId: opts.userId === undefined ? ACCOUNT_USER_ID : opts.userId,
});
```
**约束**：函数体不引用模块变量，文件里没有 `import`（函数会被序列化成源码发到浏览器；见 `app.ts` 第 11-12 行的同样说明）。骨架用 RESEARCH.md 第 777-808 行。注意 `EventTarget` 不会自动调 `onerror` 等属性处理函数，要手动调用；`PB_CONNECT` 必须异步派发。

**binding**：`app.ts` 第 35 行和第 63-68 行的“同一个 page 只能注册一次 binding”约束（`bindingExposed` 标志位）要沿用；研究建议改用 `context.exposeBinding`，则标志位按 context 记。

---

### `tests/support/app.ts`（改：cloud 模式）

**Analog:** 自身 `account` 分支（第 46-89 行）。

```ts
async open(opts: { mode?: 'local' | 'account'; seed?: unknown; userId?: string | null; expectStore?: ... } = {}) {
  if (this.opened) { throw new Error('AppHarness.open 每个用例只能调用一次；...'); }
  this.opened = true;
  const mode = opts.mode ?? 'local';
  if (mode === 'account') {
    if (!this.bindingExposed) { await this.page.exposeBinding(...); this.bindingExposed = true; }
    if (opts.seed !== undefined) { this.backend.seed(opts.seed); }
    await this.page.addInitScript(installClaudeMock, {...});
    this.store = opts.expectStore ?? 'account';
  } else { ... }
  await this.page.goto('/');
  await this.ready();
}
```
**照做**：`mode` 联合类型加 `'cloud'`；新增只读属性 `readonly fake = new FakePbServer()`，与 `backend` 并列；`opened` 一次性防护和 `bindingExposed` 防重复注册沿用；`process.env.USJ_TEST_MODE === 'cloud'` 时把 `mode: 'account'` 映射成 cloud。
**`ready()` 要改**（第 95-103 行）：cloud 在 Phase 8 的条件是“页面可调用 `PocketBase`”（`addScriptTag({url: PB_SDK_PATH})`），不要给页面设置 `USJ_CONFIG.backend`（Phase 7 决定：backend 非 null 会让应用停在加载前并显示“存储配置无效”）。
**同步更新**：`persisted()`、`saved()`、`expectAccountMode()` 里按 `this.store` 分支的地方，cloud 也要有对应分支，否则 `store` 联合类型扩大后 TypeScript 的穷尽性会被悄悄绕过。

---

### `tests/support/test.ts`（改：护栏收紧）

**Analog:** 自身第 90-110 行（单个 `context.route('**/*')` 分流）。

```ts
await context.route('**/*', (route) => {
  const url = route.request().url();
  if (url.startsWith(APP_ORIGIN + '/')) { return route.continue(); }   // v1：应用来源下全放行（WR-05 缺口）
  let host = '';
  try { host = new URL(url).hostname; } catch (e) { host = ''; }
  if (FONT_HOSTS.includes(host)) { state.expectedAborts.push(url); }
  else { state.unexpectedRequests.push(url); }
  return route.abort('blockedbyclient');
});
```
**照做**：抽成纯函数 `classifyRequest(url, policy)` 返回 `'allow' | 'font' | 'violation'`，导出，做法同已导出的 `guardViolations`（第 37-43 行：teardown 和自检共用同一个函数，所以自检证明的失败路径就是真实路径）。`cloud` 策略下应用来源只放行 `/`、`/us-journey-tracker.html`、`PB_SDK_PATH`。示意代码见 RESEARCH.md 第 810-822 行。
**route 顺序**：后注册的 route 先匹配。假服务器的 `/api/` route 要在 guard 之后注册，未实现的路径 `route.fallback()` 才会落回 guard。
**抽出 `attachGuard(context, state)`**：第 121-150 行的 `attach(page)` 监听（`pageerror`、`console`、`websocket`）一起抽出，供第二个 context 复用。
**自检风格**：`guard.remove(kind, match)` 只能在故意违规的自检里用，调用前先断言记录恰好是预期的几条（第 25-32 行）。

---

### `tests/support/static-server.cjs`（改：同源提供 SDK）

**Analog:** 自身。

**启动前缺文件检查**（第 11-19 行）：缺文件在 `listen` 之前失败，中文提示，不打印绝对路径。SDK 哈希校验照这个形态做：启动时读 `tools/probe/page/vendor/pocketbase.iife.js` 算 sha256，与 `SHA256SUMS` 钉死值不符就 `process.exit(1)`。
```js
if (!fs.existsSync(APP_FILE)) {
  process.stderr.write(MISSING_APP_MESSAGE + '\n');
  process.exit(1);
}
```
**白名单**（第 48-52 行）：现在只有 `/` 和 `/us-journey-tracker.html`，要加 `/vendor/pocketbase.iife.js`，响应头 `content-type: text/javascript; charset=utf-8`、`cache-control: no-store`、`x-content-type-options: nosniff`。`405`、`421`（Host 白名单）、客户端断开时 `stream.destroy()`（第 55 行）、`stream.on('error')` 的处理都原样保留。不复制第二份 SDK，保持单一 sha256 钉子。

---

### `tests/e2e/platform/app-integrity.spec.ts`（改：ENV-03）

**Analog:** 自身第 35-56 行。新增路径的断言写在同一模式里（200、`content-type` 含 `javascript`、`nosniff`、内容 sha256 等于钉死值），`404` 清单保持，其中 `/favicon.ico` 继续 404。SAFE-02（应用文件基线）不受影响，不要动 `APP_SHA256`。

---

### `tests/mocks/PB-CONTRACT.md` 与 `tests/cloud/pb-contract.spec.ts`

**Analog:** `tests/mocks/CONTRACT.md` 加 `tests/e2e/platform/mock-contract.spec.ts`

**契约自测约定**（`mock-contract.spec.ts` 第 10-14 行）：“对照的条目和原文摘录都写在 CONTRACT.md 里”；页面用例先 `app.open` 再 `page.evaluate`，evaluate 只返回可序列化结果，断言都在 Node 侧做。
```ts
const result = await page.evaluate(async () => { ... return { keys: Object.keys(claude), frozen: Object.isFrozen(claude), ... }; });
```
**导入与版本核对**（第 1-4 行）：`CLAUDE_CONTRACT_VERSION` 来自 `constants.ts`，契约自测核对常量和契约文档一致。`PB_SDK_VERSION`、`PB_SERVER_VERSION`、`PB_SDK_SHA256` 照此做。

**差异**：PB 的契约自测大部分不需要浏览器，在 Node 里直接 `handle()` 对样本做状态码、键集合、归一化后正文的比较，所以放在 `tests/cloud/`，用 `test` 但不用 `page`。另加三条归一化自检（RESEARCH.md Pattern 4）：写文件前 `findTokenShapes` 为零、用运行时拼接的 JWT 形状做反向对照、扫描 `pb-samples/` 里每个文件的规则 F、G、H 命中为零。

---

### `tests/cloud/guard-cloud.spec.ts`、`tests/cloud/probes-cloud.spec.ts`

**Analog:** `tests/e2e/platform/guardrails.spec.ts`、`tests/e2e/platform/probes.spec.ts`、`tests/PROBES.md`（未逐行读，规划时先读这三个文件再动手）。约定取自 `test.ts`：
- 故意违规后 `guard.remove('unexpectedRequests', match)`，同时处理 Chromium 为被 abort 的 fetch 写的 `console.error`（`ERR_BLOCKED_BY_CLIENT`，`guardrails.spec.ts` 里有现成做法）。
- 探针结论先记录观察值，再断言，不随观察值改写断言（PROBE-7、PROBE-8 的做法）。`PROBES.md` 开头“每次 `npm test` 都会运行”要改成 PROBE-1 到 8 在 `npm test`，PROBE-9 起在 `npm run test:cloud`。

---

### `playwright.cloud.config.ts`

**Analog:** `playwright.config.ts`（第 11-84 行）。展开基础配置，只改 `testDir` 和 `workers`：
```ts
import { defineConfig } from '@playwright/test';
import base from './playwright.config';
process.env.USJ_TEST_MODE = 'cloud';
export default defineConfig({ ...base, testDir: './tests/cloud', workers: 1 });
```
基础配置里的 `retries: 1`、本机 Edge 通道、死代理、`--host-resolver-rules`、`serviceWorkers: 'block'`、`webServer`（`reuseExistingServer: false`，端口 4789）全部继承，所以 `npm test` 与 `npm run test:cloud` 天然不能并发。**不改** `playwright.config.ts`。

---

### `package.json`、`.gitignore`、`tests/support/constants.ts`

- `package.json` 第 6-9 行 `scripts` 里加 `test:cloud`、`pb:isolation`、可选 `pb:record`，不新增依赖。
- `.gitignore`：显式加 `/tools/pb/bin/`（现有 `pocketbase.exe`、`pocketbase_*.zip` 规则只挡这两个文件名，解压出的其他文件挡不住）。隐私检查规则 A 对 `pocketbase.exe`、`.zip` 按文件名拦。
- `constants.ts`：照 `MOCK_BINDING_NAME`（第 50 行附近）的写法，纯常量、不导入任何东西，加 `PB_SDK_PATH`、`PB_SDK_VERSION`（`0.28.1`）、`PB_SDK_SHA256`、`PB_SERVER_VERSION`（`0.41.1`）、cloud 的 binding 名。

## Shared Patterns

### 纯函数加两处调用（真实路径与自检共用同一函数）
**Source:** `tests/support/test.ts` 第 34-43 行 `guardViolations`
**Apply to:** `classifyRequest`、`normalize`、`FakePbServer.handle()`。凡是需要“故意违规自检”的逻辑，都抽成导出的纯函数，真实路径和自检走同一份代码。

### 零依赖工具脚本约定
**Source:** `tools/probe/schema-check.mjs` 第 1-24 行
**Apply to:** `isolation-check.mjs`、`migration-check.mjs`、`record-samples.mjs`、`fetch-local-pb.mjs`。只用 `node:` 内置模块；文件头写用法、输出、退出码（0/1/2）；有 `--self-test`；输出只含名字和差异种类，不打印内容。

### 失败时在副作用之前中止，中文提示，不打印绝对路径
**Source:** `tests/support/static-server.cjs` 第 11-19、70-74 行；`02-install-pocketbase.sh` 第 80-83 行
**Apply to:** 所有下载、哈希核对、实例启动的入口。

### 隐私检查（规则 C、F、G）
**Source:** `tools/privacy/privacy-check.mjs`（`findTokenShapes` 第 150 行、`scanText` 第 265 行，均已导出）
**Apply to:** 所有样本、契约文档、脚本。
- 样本里不能有三段 JWT、真实邮箱、写着真实值的口令。归一化结果用 `<JWT>`、`<PASSWORD>`、`user-a@…` 这类占位。
- 测试里要用到的 JWT 形状、口令等，在运行时拼接，源码里不出现完整字面量。
- 不要把 `superuser create|upsert|update` 加口令的完整命令写进被跟踪文件（规则 G 第四种模式）。
- 不接受放行名单（07-CONTEXT D-04）。

### 合成数据标记
**Source:** `tests/support/constants.ts` 的 `SYNTHETIC_MARKER = '_synthetic'`
**Apply to:** `tests/mocks/pb-samples/` 和任何 `seed()` 用的 fixture；SAFE-03 对 `tests/fixtures` 下的文件强制带它。`pb-samples` 不在 `tests/fixtures` 下，规划时决定样本是否带标记，并让 `PB-CONTRACT.md` 写明。

### 低资源运行
**Source:** `playwright.config.ts` 第 20 行，`package.json` 脚本，memory 里的本机限制
**Apply to:** `test:cloud` 加一个手动运行的隔离脚本。单 worker，不并发，以低于正常的优先级启动；`instance.mjs` 用 `os.setPriority(child.pid, PRIORITY_BELOW_NORMAL)`。

## Anti-Patterns（不要照抄）

### 来自 `tools/probe/page/probe.js`

1. **`num()` 把所有数字截成 ≥0**（第 67 行，06-REVIEW CR-01）
   ```js
   const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(0, v)) : undefined);
   ```
   负数被悄悄改成 0，会掩盖真实值。Phase 8 的假服务器、归一化、`exp` 差值、时间戳顺序判断里**不要**写任何这种夹紧；需要范围检查就显式断言并报错，保留原值。
2. **登录失败时结果无法上传**（第 178-185 行，06-REVIEW CR-02）：`try { await pb.collection('users').authWithPassword(...); loginOk = true } catch (e) {}` 把失败吞掉，而结果上传又依赖已登录令牌，所以失败的登录恰好没有数据可看。Phase 8 的假服务器与契约自测里，登录失败（400）必须是一等样本，断言要直接对错误状态码和错误体做，不要吞异常。
3. **空的 `catch (e) {}`**（第 181、243 行）。这是 v1 应用代码的写法（CLAUDE.md “Error Handling”），在测试设施里会让失败变成沉默。测试设施里 catch 之后要么记录到可断言的地方，要么重抛。（`test.ts` 第 98-100 行的 `catch` 里把 `host=''` 作为明确的降级值，是可以接受的例外。）

### 可参考的 SDK 用法（不是缺陷）
`probe.js` 第 173-174 行：`new PocketBase('/')`、`pb.autoCancellation(false)`、`pb.authStore.clear()`，以及第 229-240 行 `collection(...).subscribe('*', cb, { filter })`。cloud 模式的页面测试可以参考这个调用形态，但 `filter` 写法要换成 `journey_docs` 的字段。

### 其他
- 在 `PB-CONTRACT.md` 里“引用一下”真实令牌（规则 F 会拦，且不接受放行名单）。
- 只断言状态码不回读（规则同时是过滤器；拒绝有四种形态：锁定规则 403、列表不满足 200 空、查看和更新不满足 404、创建不满足 400）。
- 在假服务器里补全 PocketBase 没做的事：样本没有的行为返回 `null`，让 guard 报违规。
- 客户端更新 `journey_docs` 时带 `owner` 或 `kind`（`:isset = false` 连相同值也拒，404）；更新只发 `data` 和 `writer`。
- 目录用 `pocketbase/`（被 `.gitignore` 整体忽略）。

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tools/pb/lib/sse-client.mjs` | utility | streaming | 仓库里没有 Node 侧 SSE 客户端；用 RESEARCH.md 第 743-775 行骨架 |
| `tools/pb/lib/scenarios.cjs` | config | transform | 没有“录制与契约自测共用场景表”的先例；按 RESEARCH.md Pattern 4 设计 |
| `tools/pb/lib/instance.mjs`（进程部分） | utility | process mgmt | 仓库里没有 spawn 外部程序的脚本；用 RESEARCH.md Pattern 2 和 Code Examples |
| `tests/mocks/pb-samples/*.json` | fixture | — | 现有 fixtures 是应用状态，不是协议样本 |
| `tools/pb/record-samples.mjs` | utility | batch | 只有 CLI 外壳可借用；录制逻辑按 RESEARCH.md Pattern 4 |

## Metadata

**Analog search scope:** `tools/probe/`、`tools/privacy/`、`tests/mocks/`、`tests/support/`、`tests/e2e/platform/`、`playwright.config.ts`、`package.json`
**Files read in full or in targeted ranges:** `probe_schema.js`、`claude-backend.ts`、`test.ts`、`app.ts`、`static-server.cjs`、`playwright.config.ts`、`constants.ts`（前 50 行）、`schema-check.mjs`（前 60 行）、`02-install-pocketbase.sh`（相关段）、`probe.js`（相关段）、`mock-contract.spec.ts`（前 45 行）、`app-integrity.spec.ts`（ENV-03 段）、`privacy-check.mjs`（导出列表）
**未读（规划时先读）：** `tests/mocks/claude-runtime.ts`、`tests/mocks/CONTRACT.md`、`tests/e2e/platform/guardrails.spec.ts`、`tests/e2e/platform/probes.spec.ts`、`tests/PROBES.md`、`tools/probe/schema.json`
**Pattern extraction date:** 2026-11-08
