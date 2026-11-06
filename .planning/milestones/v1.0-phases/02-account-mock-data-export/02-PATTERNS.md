# Phase 2: 账户模式、合成数据与导出 - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 20（新建 15，修改 5）
**Analogs found:** 18 / 20（`tests/mocks/*` 两个文件只有设计稿，没有现成代码，用 ARCHITECTURE.md Pattern 1 的示例）

注意：不要把应用 `CATS`、`GROUPS`、`LIFTS`（`us-journey-tracker.html` 约 329-346 行附近的常量）的任何文字写进计划、fixture 或期望文件。内置任务文字只在运行时从 DOM 读。

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最近的 analog | 匹配度 |
|---|---|---|---|---|
| `tests/mocks/claude-runtime.ts`（新） | 注入脚本（utility） | request-response（RPC） | `tests/support/app.ts` 的 `seedLocalStorageIfAbsent`（自包含注入函数）+ ARCHITECTURE.md Pattern 1 | role-match |
| `tests/mocks/claude-backend.ts`（新） | service（Node 侧内存库） | CRUD + 记录 | ARCHITECTURE.md Pattern 1 的 `MockBackend`（无仓库内 analog） | design-only |
| `tests/mocks/CONTRACT.md`（新） | 文档 | - | `tests/PROBES.md` | role-match |
| `tests/support/test.ts`（改） | fixture 出口 | event-driven | 自身（`guard`、`app` fixture） | exact |
| `tests/support/app.ts`（改） | harness | request-response | 自身 | exact |
| `tests/support/constants.ts`（改） | config | - | 自身 | exact |
| `tests/support/strings.ts`（改） | config | - | 自身 | exact |
| `tests/support/expect-from-fixture.ts`（新，名字可由规划者定） | utility | transform | `tests/e2e/platform/repo-hygiene.spec.ts` 的导出 helper 写法 | partial |
| `tests/support/task-ids.ts`（新，D-05 的位置 id 常量） | config | - | `tests/support/constants.ts` | role-match |
| `tests/fixtures/full-state.json`、`legacy-categories.json`、`minimal-state.json`（新） | fixture | - | `tests/fixtures/local-seed.json` | exact |
| `tests/fixtures/malformed-imports.ts`（新） | fixture（内存） | - | `tests/support/constants.ts` 的纯常量风格 | partial |
| `tests/e2e/platform/mock-contract.spec.ts`（新） | test | request-response | `tests/e2e/platform/guardrails.spec.ts` | role-match |
| `tests/e2e/storage/account-mode.spec.ts`（新） | test | CRUD | `tests/e2e/smoke.spec.ts`（IO-01 持久化用例） | exact |
| `tests/e2e/io/export.spec.ts`（新，目录名可调整，在 `tests/e2e/` 下即会被收进） | test | file-I/O | `tests/e2e/smoke.spec.ts` | role-match |
| `tests/support/static-server.cjs`（改，WR-01 校验 Host） | middleware | request-response | 自身 | exact |
| `tests/support/test.ts` 的 `guard.reset()`（改，WR-02） | fixture | - | 自身 | exact |
| `tests/e2e/platform/probes.spec.ts`（改，WR-03/05/06 相关） | test | - | 自身 | exact |
| `tests/README.md`、`tests/PROBES.md`（改，WR-04 与 exposeBinding 结论） | 文档 | - | 自身 | exact |
| `tests/e2e/platform/guardrails.spec.ts`（改，WR-02、WR-05 自检） | test | - | 自身 | exact |
| `.planning/phases/01-*/01-REVIEW-DISPOSITION.md`（改） | 文档 | - | 自身 | exact |

## Pattern Assignments

### `tests/mocks/claude-runtime.ts`（注入脚本，RPC）

**Analog:** `tests/support/app.ts` 第 8-15 行（自包含注入函数，配 `addInitScript(fn, arg)`）；整体结构按 `.planning/research/ARCHITECTURE.md` 第 132-199 行的 `installClaudeMock`。

**自包含约束**（`tests/support/app.ts:8-15`）：
```typescript
// 函数体必须自包含，不能引用模块里的任何变量：addInitScript 会把函数序列化成源码发给浏览器。
export function seedLocalStorageIfAbsent(arg: { key: string; json: string }) {
  if (localStorage.getItem(arg.key) === null) {
    localStorage.setItem(arg.key, arg.json);
  }
}
```

**核心结构**（取自 ARCHITECTURE.md 第 142-198 行，要点）：
- `rpc(op, arg)` 在调用时才取 `window[cfg.binding]`（懒调用，D-01），JSON 字符串进出。
- `db.doc(path)`：奇数段或段文法不合法时同步抛 `TypeError`；`get()` 返回 `{id, exists, data(), metadata}` 并深冻结；`set(data)` 整体替换。
- `user.id()` 返回 `cfg.userId`（可为 `null`，D-07 反向用例用）。
- `downloads.save({filename, data})` 把 `data` 转成文本后走 `rpc('downloads.save')`，返回 `{status:'saved'}`。
- `use(name)` 返回 memoized 的 `Promise.resolve`，未知名字返回 `null`；`window.claude` 用 `Object.defineProperty(... configurable:false)` + `Object.freeze`。
- 不写 reject、错误码、限流、延迟（D-02）。

**应用端的调用点**（`us-journey-tracker.html:368-379`，只引用行号）：`Promise.all([use("db"), use("user")])`，`await user.id()`，`db.doc("data/users/"+id+"/state")`，`load` 用 `s.exists ? s.data()`，`save` 用 `ref.set(s)`；最后 `await use("downloads")` 之后才显示导出按钮。

---

### `tests/mocks/claude-backend.ts`（Node 侧 MockBackend）

**无仓库内 analog。** 用 ARCHITECTURE.md 第 204-236 行的 `MockBackend`：`docs`、`reads`、`writes`、`downloads`，`seed()`、`lastState()`、`handle(op, json)`。按 D-02 去掉 `latencyMs` 和 `overlappingWrites`（或保留但不用），`default` 分支直接 `throw new Error('unknown op ' + op)`。`docPath` 用 `constants.ts` 里新增的常量。

---

### `tests/support/test.ts`（加 mock fixture）

**Analog:** 自身。

**加 fixture 的位置与写法**（第 39-43、144-147 行）：
```typescript
type Fixtures = { guard: GuardHandle; frozenClock: void; app: AppHarness; };
...
app: async ({ page }, use) => {
  await use(new AppHarness(page));
},
```
做法：新增 `backend: MockBackend` fixture（每个用例一个新实例），让 `app` 依赖它：`app: async ({ page, backend }, use) => use(new AppHarness(page, backend))`。用例通过 `({ backend })` 直接读 `backend.reads / writes / downloads`（D-09，不用 `page.evaluate`）。

**WR-02：`guard.reset()` 改成只清一类/一条**（现在是第 69-77 行，一次清五个数组）：
```typescript
reset() {
  state.unexpectedRequests.length = 0;
  state.expectedAborts.length = 0;
  ...
}
```
改成例如 `reset(kind?: keyof GuardState)`，调用点在 `tests/e2e/platform/guardrails.spec.ts` 第 34、72、95 行，各自只清自己制造的那一类。

**Option fixture 写法**（第 62 行，`clockMode: ['fixed', { option: true }]`）可照抄，用于需要默认账户模式的 spec（可选）。

---

### `tests/support/app.ts`（加 `mode: 'account'`）

**Analog:** 自身（第 17-57 行）。

**现有 open/ready**：
```typescript
async open(opts: { seed?: unknown } = {}) {
  if (opts.seed !== undefined) {
    await this.page.addInitScript(seedLocalStorageIfAbsent, { key: STATE_KEY, json: JSON.stringify(opts.seed) });
  }
  await this.page.goto('/');
  await this.ready();
}
async ready() {
  await expect(this.page.locator('#status')).toHaveText(STATUS_LOCAL);
}
```
改法（D-08、D-09）：
- `open({ mode = 'local', seed, userId = ACCOUNT_USER_ID })`。`mode === 'local'` 走原来的分支，Phase 1 用例不动。
- `mode === 'account'`：先 `page.exposeBinding(BINDING, (_src, op, json) => backend.handle(op, json))`（只在第一次调用时注册，同一 page 重复注册会抛错，要记一个标记），`backend.seed(seed)`（写 Node 侧，不写 localStorage），再 `addInitScript(installClaudeMock, { binding, userId, capabilities })`。
- `ready()` 按模式分支：account 要同时满足 `#status` 为 `STATUS_ACCOUNT` 和 `#exportCsv`、`#exportJson` 可见（`toBeVisible()`，因为应用先 `setStatus` 再 `await use("downloads")`）。
- 新增 `expectAccountMode()`：断言状态栏文案、`backend.reads` 恰好一条且等于账户路径、localStorage 里没有 `STATE_KEY`（D-07）。反向对照用例用 `userId: null` 打开（此时应用退回本地模式，`ready` 要能用本地条件通过，所以 `open` 需要允许“账户 mock 已装但应用走了本地”的就绪条件，例如传 `expectReady: 'local'`，或者让用例直接 `goto` 再自己等 `STATUS_LOCAL`），然后断言 `expectAccountMode()` 会 reject。
- `persisted()` 在 account 模式下改读 `backend.lastState()`（保持 D-18 的 `expect.poll` -> `reload` -> 断言 DOM 顺序）。
- 保持 `import { expect, type Page } from '@playwright/test'`，不要从 `./test` 导入（循环引用，第 2 行注释）。

---

### `tests/support/constants.ts` 与 `strings.ts`（加常量和文案）

**Analog:** 自身，格式是一行中文注释加一个 `export const`（`constants.ts:12-13`、`strings.ts:4-5`）。

要加的内容：
- constants：`ACCOUNT_USER_ID = 'synth-user-0001'`、`ACCOUNT_DOC_PATH = 'data/users/synth-user-0001/state'`（D-06）、binding 名称、`ARRIVAL_FIXTURE_DATE`（`2026-01-12`，D-05）、本周范围 `2026-03-16` 到 `2026-03-22`。constants.ts 必须保持“纯常量，不导入任何东西”。
- strings：`STATUS_ACCOUNT = '已同步保存到你的账户'`、`TOAST_EXPORTED = '已导出'`、`FILENAME_CSV = '在美国的日子-日历.csv'`、`filenameBackupJson(date)` 或常量 `在美国的日子-备份-2026-03-18.json`、`TOAST_NOTHING_TO_EXPORT = '还没有可导出的日期'`。strings.ts 的约定是“应用源码逐字复制”，不抄 `CATS` 等个人文字。

---

### `tests/support/task-ids.ts`（D-05）

**Analog:** `tests/support/constants.ts`（纯常量，文件头中文注释）。写明“这些 `P<n>-<i>` id 会随应用源码里任务顺序变化”，只放 id 字符串，不放任务文字。fixture 里 `tasks` 用这些 id，所以 JSON 文件里是 id，不是文字。

---

### `tests/fixtures/full-state.json`、`legacy-categories.json`、`minimal-state.json`

**Analog:** `tests/fixtures/local-seed.json`（整个文件）：
```json
{
  "_synthetic": "合成数据：仅供本地测试，不含任何真实信息",
  "arrival": "",
  "tasks": {},
  "custom": [],
  "logs": [ { "id": "synth-seed-1", "date": "2026-03-17", "text": "SYNTH-SEED seeded entry", "cat": "其他" } ],
  "lifts": {}, "reviews": {}, "presets": {}
}
```
照这个结构：顶层 `_synthetic`（SAFE-03，`repo-hygiene.spec.ts` 用文本包含检查），`logs[].id/date/text/cat`，所有文字以 `SYNTH-` 开头。`full-state.json` 要补：五个类别（中文显示名，用应用持久化的名字，从 fixture/normalize 行为取，不抄预设标签）、本周和非本周的 logs、`tasks` 里已完成/过期/今天到期/将来到期、`custom` 待办、`lifts` 历史、`reviews`、`presets` 增删（虚构标签名）、`arrival: "2026-01-12"`。含特殊字符的记录（`"`、`,`、换行、`<`、`&`、`'`、超过 80 字符）见 D-12。`legacy-categories.json` 里的旧类别名按 `LEGACY` 映射（`us-journey-tracker.html` 约 329-346 行），只在 fixture 里写旧名字，期望值通过 helper 或用例里断言“映射后落在应用显示的类别”。文件名不要像备份或导出文件（隐私检查会拦）。

---

### `tests/fixtures/malformed-imports.ts`

**Analog:** `tests/support/constants.ts` 的纯常量风格。文件内必须出现 `_synthetic` 字面量（`repo-hygiene.spec.ts` 对非 JSON 文件用文本包含判断）。例如文件头注释写 `// _synthetic：畸形导入内容，只在内存里使用`，然后 `export const NOT_JSON = '...'`。

---

### `tests/support/expect-from-fixture.ts`（期望值推导 helper）

**Analog:** `tests/e2e/platform/repo-hygiene.spec.ts` 第 28-40 行，一个带中文注释、导出的纯函数 helper（`findUnmarkedFixtures`）。helper 从 fixture 推导：按日期和类别计数、找出过期任务、构造 CSV 期望文本（D-15）。

CSV 期望规格（D-15），按 `us-journey-tracker.html:639-653` 的行为独立实现，不 import 应用代码：
- 表头：`Subject,Start Date,All Day Event,Description`。
- 记录行：`[类别] 首行前80字`、`MM/DD/YYYY`、`True`、全文。
- 任务行：已完成且有完成日期用 `完成：` + 任务文字，否则有截止日期用 `截止：` + 任务文字，描述是 `<group> 计划`。
- 单元格含 `"`、`,`、`\n` 时加引号，内部 `"` 写成 `""`；行之间用 `\n` 连接。
- 任务文字和 group 名在运行时从目标页 DOM 读取（`[data-task="<id>"]` 的 `aria-label`，D-14），helper 接收一个 `taskText(id)` 回调，不写死。
- 另加手写金标准行（只用合成记录），其中至少一行同时含引号、逗号、换行且超过 80 字符。

---

### `tests/e2e/platform/mock-contract.spec.ts`

**Analog:** `tests/e2e/platform/guardrails.spec.ts`（引用 test/expect、常量，直接 `page.goto` 和 `page.evaluate`）。

**Imports 和风格**（`guardrails.spec.ts:1-3`）：
```typescript
import { test, expect, guardViolations } from '../../support/test';
import { FONT_HOSTS } from '../../support/constants';
import { STATUS_LOCAL } from '../../support/strings';
```
用例：用 `app.open({ mode: 'account', ... })` 后，用 `page.evaluate` 检查 `use('db')` 返回 Promise、同名两次 `===`、`Object.isFrozen(window.claude)` 和 resolved 命名空间、`use('nope')` 为 `null`、`db.doc('a/b/c')` 抛 `TypeError`、合法偶数段路径不抛。evaluate 里只返回可序列化值。

---

### `tests/e2e/storage/account-mode.spec.ts`

**Analog:** `tests/e2e/smoke.spec.ts` 的 IO-01 用例（第 13-31 行）和 seeded 用例（第 55-79 行）。

**记一笔、poll、reload、断言 DOM 的顺序**（`smoke.spec.ts:13-31`）：
```typescript
await page.locator('#wkComp #w-text').fill(ENTRY_TEXT);
await page.locator('#wkComp #w-add').click();
await app.expectPersisted((s) => s.logs.some((l: Log) => l.text === ENTRY_TEXT && l.date === FROZEN_TODAY && l.cat === CAT_LANGUAGE));
await app.reload();
await expect(page.locator(`#tab-wk [data-wday="2026-03-18"] [data-edit]`).filter({ hasText: ENTRY_TEXT })).toBeVisible();
```
用例清单（D-09）：启动读一次且不写（`backend.reads.length === 1`、`backend.writes.length === 0`，写入在 600 ms 防抖之后才发生，所以“不写”要在就绪后断言，并且要避免固定睡眠，可以结合 `expect.poll` 等写入或先做一次无变更的 reload）；记一笔后 `backend.writes` 出现；`reload` 后数据读回；localStorage 里没有 `STATE_KEY`；`userId: null` 的反向对照（`expectAccountMode` 会失败）。

---

### `tests/e2e/io/export.spec.ts`（CSV 与 JSON 导出，IO-02、IO-03）

**Analog:** `tests/e2e/smoke.spec.ts`（用 `app.open({ mode:'account', seed })`、`page.locator`、`expect.poll`）。

**读 fixture 的写法**（`smoke.spec.ts:55-56`）：
```typescript
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/local-seed.json'), 'utf8'));
```
注意新 spec 在 `tests/e2e/io/` 下，相对路径是 `../../fixtures/...`。

做法：点击 `#exportCsv`，`expect.poll(() => backend.downloads.length)` 等到有记录，然后比较 `backend.downloads[i].filename` 和 `data` 与 helper 算出的期望文本，逐字相等；toast `已导出` 出现。JSON：`JSON.parse(download.data)` 同时 `toEqual(backend.lastState())` 和 `toEqual(去掉 _synthetic 的 fixture)`。全程只在内存里比较，不写盘，不用 Playwright 的 `download` 事件（`acceptDownloads: false`）。

---

### WR-01：`tests/support/static-server.cjs` 校验 Host 头

**Analog:** 自身，第 22-32 行（请求入口，先解析 pathname 再判断白名单）：
```javascript
const server = http.createServer((req, res) => {
  let pathname = '';
  try { pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname; } catch (e) { pathname = ''; }
  if (pathname !== '/' && pathname !== '/us-journey-tracker.html') { res.writeHead(404); res.end(); return; }
```
在 pathname 检查前加：`req.headers.host` 必须等于 `127.0.0.1:${PORT}`（或 `localhost:${PORT}`），否则 `res.writeHead(421)`（或 403）并结束。测试放在 `tests/e2e/platform/app-integrity.spec.ts`，写法照第 63-75 行的 `rawGet`（`node:http` 原始请求，可以传 `headers: { host: 'evil.example' }`）。

---

### WR-03 到 WR-06（`probes.spec.ts`、`guardrails.spec.ts`、`README.md`、`PROBES.md`）

- 这些是对现有文件的小修，具体行号以 `.planning/phases/01-*/01-REVIEW.md` 为准。
- WR-05 的“让护栏能对第 2、3 层的违规报警”可参照 `guardrails.spec.ts` 第 8-36 行的自证写法（故意制造违规，断言 `guardViolations` 非空，最后清掉自己制造的那一类）。
- WR-06 沿用 `smoke.spec.ts:44-46` 的采样方式，改成 poll 后再断言，或在导航前后各断言一次。
- exposeBinding 时序结论写进 `tests/PROBES.md`，沿用该文件已有的 PROBE 编号格式；退回方案的 `sessionStorage` 键名必须带前缀，不和 `us-journey-tracker-v1` 冲突。

---

## Shared Patterns

### 所有 spec 只从 support 出口导入
**Source:** `tests/support/test.ts` 第 1-6、150-152 行
**Apply to:** 所有新 spec
```typescript
import { test, expect } from '../../support/test';
```
不要直接从 `@playwright/test` 导入（`app.ts` 例外，因为避免循环引用）。

### 护栏和时钟自动生效
**Source:** `tests/support/test.ts` 第 64-142 行（`guard`、`frozenClock` 是 `{ auto: true }`）
**Apply to:** 所有 spec。新增的 mock 不改网络护栏；所有请求仍只放行 `APP_ORIGIN`（`binding` 不走网络）。固定时间 `FROZEN_NOW = 2026-03-18 12:00 UTC`，时区 `America/New_York`。

### 持久化断言顺序（D-18）
**Source:** `tests/support/app.ts` 第 50-57 行 + `smoke.spec.ts:13-31`
**Apply to:** 所有写后读回的用例：先 `expect.poll`（600 ms 防抖），再 `reload`，最后断言 DOM。不用固定睡眠。

### 就绪条件
**Source:** `tests/support/app.ts` 第 35-37 行
**Apply to:** account 模式下改为状态栏文案加两个导出按钮可见（D-08）。

### 合成数据标记和隐私
**Source:** `tests/e2e/platform/repo-hygiene.spec.ts`（SAFE-03）、`tools/privacy/privacy-check.mjs`
**Apply to:** 所有 `tests/fixtures/` 文件：带 `_synthetic`；文字以 `SYNTH-` 开头；不抄应用个人计划文字；不写本机绝对路径和邮箱；磁盘上不放名字像备份或导出的 `.json`/`.csv`。

### 中文注释与文案
**Source:** `tests/support/*.ts` 的文件头注释风格（中文，引用 D-xx 编号）
**Apply to:** 新文件。界面文案只放 `strings.ts`，常量只放 `constants.ts`。

## No Analog Found

| 文件 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| `tests/mocks/claude-backend.ts` | service | CRUD + 记录 | 仓库里还没有 Node 侧有状态对象；用 ARCHITECTURE.md 第 204-236 行 |
| `tests/mocks/claude-runtime.ts` | 注入脚本 | RPC | 只有 `seedLocalStorageIfAbsent` 作为“自包含注入函数”的局部 analog；主体用 ARCHITECTURE.md 第 132-199 行 |
| `tests/mocks/CONTRACT.md` | 文档 | - | 没有契约文档；格式参照 `tests/PROBES.md`，内容按 D-02（版本 0.2.96、已实现、未实现，条目原文抄进仓库，不引用临时目录路径） |

## Metadata

**Analog search scope:** `tests/support/`、`tests/e2e/`、`tests/fixtures/`、`playwright.config.ts`、`.planning/research/ARCHITECTURE.md`，以及 `us-journey-tracker.html` 的 init/store 和导出段（只读，引用行号，没有复制个人计划文字）
**Files scanned:** 约 14
**Pattern extraction date:** 2026-11-03
**Tracked-source check:** 上面所有 analog 路径都来自 `git ls-files tests tools playwright.config.ts` 的输出，均为已跟踪文件；`us-journey-tracker.html` 未跟踪，只作为只读集成点引用，不作为 analog。
