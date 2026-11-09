# Phase 9: 登录与云端存储 - Pattern Map

**Mapped:** 2026-11-08
**Files analyzed:** 17（应用 1、测试设施 8、新 spec 约 7 组，另有文档/基线）
**Analogs found:** 16 / 17（缺口：假服务器的错误注入没有现成接口）

注意：所有路径都已确认是 git 跟踪的源码（`tests/` 下 79 个跟踪文件；`us-journey-tracker.html` 在仓库根）。应用行号基于当前 825 行版本，编辑后会漂移，计划里用函数名定位。DEFAULT_PLAN 只引用名字和位置（`us-journey-tracker.html` 约 308 行起），不抄内容。

## File Classification

| 新增/修改文件 | 角色 | 数据流 | 最近的类比 | 匹配度 |
|---|---|---|---|---|
| `us-journey-tracker.html` `<head>` 字体 link（第 7-9 行，删除）+ `--serif`（第 19 行） | config | 静态资源 | 自身 | 修改 |
| `us-journey-tracker.html` 云端 store（`makeDocStore(kind)`） | service/adapter | CRUD + request-response | `localStore()`（第 514-517 行）、account 分支 store（第 528 行） | 角色完全一致 |
| `us-journey-tracker.html` 云端 boot / `init()` 分支 + 对账 | controller | request-response | `init()`（第 523-535 行） | 同函数扩展 |
| `us-journey-tracker.html` `persist()/flush()` 改为先写本机缓存 | service | event-driven（防抖） | 自身（第 506-512 行） | 修改 |
| `us-journey-tracker.html` `#login`、`#boot`、`#syncbar`、`dialog#confirm`、`#logoutBtn`、`#snapshotBtn` | component | 事件 + 渲染 | `<dialog id="editor">`（第 294 行）、`.toolbar`（第 245-247 行）、`#toast`（第 292 行）、`toast()`（第 816-819 行） | 角色匹配 |
| `us-journey-tracker.html` `applyGate()` + `body[data-gate]` | utility | 渲染层统一处理 | `renderAll()`（第 596 行） | 部分匹配 |
| `us-journey-tracker.html` `readConfig()`（第 518-521 行） | config | 配置缝 | 自身 | 修改 |
| `tests/support/app.ts`（cloud 模式的 `ready()`、登录 helper） | test util | request-response | 自身 account/cloud 分支 | 修改 |
| `tests/support/test.ts`（`classifyRequest`、`FONT_HOSTS` 噪音过滤） | test util | request-response | 自身 | 修改 |
| `tests/support/static-server.cjs` | test util | 文件 I/O | 自身 | 基本不改 |
| `tests/support/constants.ts`（`APP_SHA256`，第 41 行） | config | -- | 自身 | 修改 |
| `tests/mocks/pb-server.ts`（错误注入） | test mock | request-response | 自身 `handle()`/`attach()` | 无注入接口，需新增 |
| `tests/support/strings.ts`（新文案常量） | test util | -- | 自身（`STATUS_LOCAL` 第 6 行等） | 角色匹配 |
| `tests/cloud/login.spec.ts`、`logout.spec.ts`、`multi-device.spec.ts`、`reconcile-gate.spec.ts`、`conflict-snapshot.spec.ts`、`same-origin.spec.ts` | test | request-response | `tests/cloud/cloud-harness.spec.ts` | 角色匹配 |
| `tests/e2e/platform/guardrails.spec.ts`（SAFE-01，第 72-88 行）、`probes.spec.ts`（PROBE-2c） | test | -- | 自身 | 修改 |
| `tests/PROBES.md` PROBE-2 | doc | -- | 自身 | 修改 |
| `tests/e2e/platform/app-integrity.spec.ts`（SAFE-02） | test | -- | 自身 | 不改，只靠常量 |

## Pattern Assignments

### 应用：云端 store 适配器 `makeDocStore(kind)`（adapter, CRUD）

**类比：** `us-journey-tracker.html` 第 514-517 行 `localStore()` 与第 528 行 account store。契约是 `{label, load, save}`，`load` 返回对象或 null，`save` 失败要抛错。

```js
function localStore(){const K="us-journey-tracker-v1";return {label:"...",
  load:async()=>{try{const v=localStorage.getItem(K);return v?JSON.parse(v):null}catch(e){return null}},
  save:async s=>{try{localStorage.setItem(K,JSON.stringify(s))}catch(e){throw new Error("浏览器存储不可用")}}}}
```

account 分支的 `load` 做 `JSON.parse(JSON.stringify(...))` 深拷贝再交给 `normalize`；云端 `load` 同样先深拷贝，state 走 `normalize()`，plan 走 `normalizePlan()`（失败回落 `DEFAULT_PLAN` 的逻辑在第 400-407 行 `usePlan`）。服务器数据一律走校验和 `esc()`（第 423 行）。

要点（CONTEXT 决定，非现有代码）：
- 按 `kind` 取文档，不依赖列表顺序；更新请求只发 `{data, writer}`（PB-CONTRACT §9）。
- SDK 用 `new PocketBase(location.origin)`，之后立刻 `pb.autoCancellation(false)`。测试里的写法见 `tests/cloud/cloud-harness.spec.ts` 第 33-46 行（`pb.autoCancellation(false)`、`authWithPassword`、`getFullList`、`create({owner, kind, data, writer})`、`update(id, {data, writer})`）。
- 首次登录创建两份文档，遇 400 `validation_not_unique` 就重读再更新。
- 脚本引入：`<script src="/vendor/pocketbase.iife.js">`，路径与 `PB_SDK_PATH`（constants.ts）一致，同源、sha256 钉死。

### 应用：`init()` 云端分支（controller, request-response）

**类比：** `init()` 第 523-535 行。现状顺序是：`renderAll()`、检查 `USJ.backend`、解析能力、选 `store`、`load`、`setStatus(store.label)`、`renderAll()`。

```js
if(USJ.backend!==null){setStatus("存储配置无效：...");return}   // 第 525 行：云端接入点
...
try{const s=await store.load();if(s)state=normalize(s)}catch(e){store=localStore();const s=await store.load();if(s)state=normalize(s)}   // 第 531 行：静默回退，云端路径必须没有
```

规划要点：
- 第 525 行的“配置无效”只对未知 backend 保留，`backend` 为云端配置时分流到 cloud boot；`backend===null` 的旧路径逐字节行为不变（v1 的 154 条用例依赖 `STATUS_LOCAL` / `STATUS_ACCOUNT`，见下文约束）。
- 第 531 行的 catch 回退只在旧路径保留；云端路径 load 失败按 D-03 处理（只读 + 重试），不回退本机。
- cloud boot 顺序：读缓存先渲染（有缓存时）、`applyGate("reconciling")`、`authRefresh()`（401 才判过期）、按 `kind` 取两份文档、对账表、放开门控。3 秒、15 秒阈值（D-02）用 `setTimeout`，不要 3 秒就判失败。
- `readConfig()`（第 518-521 行）目前只透传 `backend`；云端要读的字段（例如 `backend:"pocketbase"`）在这里加白名单，其余字段继续忽略（`config-seam.spec.ts` 断言 USJ_CONFIG 带 plan 也被忽略，不能破坏）。

### 应用：`persist()/flush()`（service, event-driven）

**类比：** 第 506-512 行。

```js
let saveTimer=null,saving=false,dirty=false;
function persist(){dirty=true;clearTimeout(saveTimer);saveTimer=setTimeout(flush,600)}
async function flush(){
  if(!store||saving||!dirty)return;saving=true;dirty=false;
  try{await store.save(JSON.parse(JSON.stringify(state)));setStatus(store.label)}catch(e){setStatus("保存失败："+(e&&e.message||"未知错误"))}
  saving=false;if(dirty)flush();
}
```

规划要点：
- `dirty=false` 在 `save` 之前清掉就是 B5（Phase 10 才修），本阶段只需在 `flush` 进入云端 store 前先同步写本机缓存（`usj:v2:<userId>:state|plan`），并保存“未上传”标记，供 D-05 的退出确认判断“防抖中 / 保存中 / 失败”。
- `pagehide` 处理（第 820 行 `window.addEventListener("pagehide",flush)`）：云端路径必须同步写缓存（`flush` 是 async，上传来不及；只有 `localStorage.setItem` 同步可靠）。
- 保存前检查文档大小，超过 4 MiB 的 70% 时提示（UI-SPEC S9）。测试用常量 `PB_DOC_MAX_BYTES` 已在 constants.ts，cloud-harness.spec.ts 已经用过。
- 上传前比较基线 `updated`（服务器签发），真冲突按 D-08 留底后覆盖上传。

### 应用：`toast()` 与 `setStatus()`（component）

**类比：** 第 513 行 `setStatus`、第 816-819 行 `toast`。

```js
function setStatus(t){$("status").textContent=t}
let tt;function toast(m,act){const t=$("toast");t.textContent="";const s=document.createElement("span");s.textContent=m;t.appendChild(s);
  t.classList.toggle("act",!!act);
  if(act){const b=document.createElement("button");b.type="button";b.textContent=act.label;b.onclick=()=>{clearTimeout(tt);t.classList.remove("on","act");act.fn()};t.appendChild(b)}
  t.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>t.classList.remove("on","act"),act?5000:1800)}
```

- D-04 更新提示和 D-08 冲突提示直接用 `toast(m,{label,fn})`，5 秒后消失；常驻入口是 `#snapshotBtn`。
- `setStatus` 只是 `textContent`，UI-SPEC S2 要求同时设 `data-state`：应该在 `setStatus` 外新增 `setStatus(t, state)` 的可选第二参数，旧调用不变。
- 约束：v1 测试断言 `#status` 的精确文本（`toHaveText(STATUS_LOCAL)`），旧路径文案不得改动。

### 应用：对话框与工具栏（component）

**类比：**
- `<dialog id="editor" aria-labelledby="ed-title"><form method="dialog" id="ed-form"></form></dialog>`（第 294 行）及其 CSS（`.ed-h h3` 第 215 行附近、窄屏底部抽屉）。`dialog#confirm` 沿用同一写法和样式；也可以用原生 `confirm()`（导入流程用，`import.spec.ts` 已有处理 dialog 的写法），但 UI-SPEC 选定了 `dialog#confirm`。
- 工具栏第 245-247 行：

```html
<div class="toolbar">
  <button class="ghost hidden" id="exportCsv" ...>导出日历 CSV</button>
  <button class="ghost hidden" id="exportJson">备份</button>
```

`#logoutBtn`、`#snapshotBtn` 以 `ghost hidden` 的写法加在同一栏；只在云端路径显示。导出按钮的显示由 `window.__dl`（Claude `downloads` 能力）决定，云端没有该能力，D-08 的留底下载用 Blob + `<a download>`，文件名不含邮箱（D-11）。

### 应用：`applyGate()` 与全量重绘

**类比：** `renderAll()`（第 596 行）：`renderHeader();renderWeek();renderCal();renderDay();renderGoals();renderTimeline()`。每次变更都全量重绘，所以门控不能逐个按钮打补丁：用 `body[data-gate]` + CSS 选择器统一禁用，并在 `renderAll()` 末尾重新应用（或用 `inert`/`disabled` 的事件委托层拦截）。注意事件委托在 `document` 上（`data-edit`、`data-task` 等），门控要在捕获阶段拦截。B3（加载完成前的编辑被丢弃）在云端路径由此修复，见 `tests/KNOWN-BUGS.md`。

### 应用：删除字体 link 与 `--serif`

第 7-9 行三条 link 全部删除（preconnect x2 + 样式表）。第 19 行改为：

```css
--serif:"Songti SC","STSong",Georgia,serif;   /* 去掉 "Noto Serif SC" */
```

`--serif` 被约 12 处使用，不用逐处改。

### 测试：`tests/support/app.ts`（cloud 模式）

**类比：** 自身。要改的点：
- `ready()` 的 cloud 分支（约第 108-111 行）现在等 `STATUS_LOCAL` 并手动 `addScriptTag(PB_SDK_PATH)`。应用自己加载 SDK 后，要改成等登录页或云端就绪状态，不再手动注入 SDK。
- `open()` 的 cloud 分支已有：`fake.addUser()`、`fake.seed(seed,{plan})`、`await fake.attach(context)`。登录要新增 helper（例如 `app.login(userIndex)`：填 `#login` 表单、点登录、等对账完成），用 `app.fake.users[i].email/password`（`cloud-harness.spec.ts` 第 29 行用到）。邮箱和密码只来自假服务器的合成账号，不得出现真实值。
- `resolveHarnessMode` 把 `account` 换算成 `cloud`（USJ_TEST_MODE=cloud 时），所以 v1 的 account 用例在 `npm run test:cloud` 下会走云端路径；相关用例需要预登录的缓存或 helper 才能映射（08-CONTEXT 的“云端测试入口的范围”）。
- `persisted()` / `saved()` 的 cloud 分支读 `fake.lastState()`、`fake.writes` 中 `path==='journey_docs:state'`；它们已就绪，可复用。
- 多设备：`open()` 每个 AppHarness 只能调一次，且 `attach` 每个 context 只能调一次。第二台设备要用 `browser.newContext()` 新建 context、`attachGuard(context2, guard.state, guardPolicy())`（`test.ts` 注释“研究 Pitfall 8”提到的复用方式）、再 `new AppHarness(page2)`；两台设备要共享同一个 `FakePbServer`，目前 `AppHarness.fake` 是每个实例自己的，需要让构造函数或 `open` 接受外部传入的 fake（修改点，规划要明确）。

### 测试：`tests/support/test.ts`（请求护栏）

**类比：** 自身。`classifyRequest` 的字体分支（`FONT_HOSTS.includes(parsed.hostname) ? 'font' : 'violation'`）。去掉 link 后应用不再请求字体：
- 云端策略下字体主机应当变成 `violation`（INFRA-03 的断言：页面只加载同源资源）；v1 策略可保留字体分支以免改动 v1 行为，但 `guard-cloud.spec.ts` 第 15 行 `expect(classifyRequest('https://fonts.googleapis.com/css2','cloud')).toBe('font')` 要同步改，第 27 行 v1 的保持。
- console 噪音过滤（`target.on('console')`）仍按 `FONT_HOSTS` 主机过滤，不用动。
- `CLOUD_APP_PATHS = ['/', '/us-journey-tracker.html', PB_SDK_PATH]` 已含 SDK 路径；`/api/*` 由假服务器路由先接，接不住的 `route.fallback()` 回到 guard 记为违规。

### 测试：`guardrails.spec.ts` 与 PROBE-2

- SAFE-01（第 72-88 行）“打开应用只会 abort 字体主机”依赖应用请求字体：`await expect.poll(() => guard.state.expectedAborts.length).toBeGreaterThanOrEqual(1)` 会在删除 link 后永远等不到。需要改为断言 `expectedAborts` 为空、`unexpectedRequests` 为空（成功标准 5），旧意图“字体请求被拦并记录”改用 `page.evaluate` 主动 `fetch` 一个字体主机 URL 做自证。注意 v1 路径也跑这条（同一个 HTML 文件）。
- SAFE-04（第 112 行起）“字体噪音被过滤”的“显式信号”同样依赖字体请求产生噪音，要改成由用例主动制造被拦的字体请求。
- `probes.spec.ts` PROBE-2c（第 119-190 行）：注释说“字体样式表请求在 route 层就被拦下，所以到达录制代理的字体主机连接只可能来自 preconnect”，其断言 `fontHostObserved`/`fontHostLines` 是观察性的（PROBES.md 记载为 0 条，标题含 “preconnect not observed”）。删除 link 后这条本来就观察不到 preconnect，应把用例说明改写为“应用不再发出字体主机连接”，对照行（WebSocket 到 `probe.invalid`）保持不变。PROBES.md 的 PROBE-2c 小节和结论段（第 65-80 行）同步更新，不能再说 “route 层拦下字体样式表”。
- `tests/README.md` 第 80、86 行提到 head 里的 `preconnect`，同步更新措辞。

### 测试：`static-server.cjs`

不用改：`SDK_PATH='/vendor/pocketbase.iife.js'` 已同源提供，启动时核对 `tools/probe/page/vendor/SHA256SUMS`，白名单之外 404、Host 白名单 421。登录和 same-origin 用例的参照点：`app-integrity.spec.ts` 第 49-55 行（SDK 的类型、nosniff、no-store、sha256 等于常量）。

### 测试：sha256 基线

`tests/support/constants.ts` 第 39-41 行：`APP_SHA256` 是唯一的基线常量，注释写明“每次改应用都要在同一次提交里有意识地更新”。`app-integrity.spec.ts` 第 17-22 行的 SAFE-02 读磁盘上的应用文件算 sha256 比较；第 29-36 行有“改一个字节则哈希不同”的对照。做法：每个修改应用的计划，最后一步算出新哈希、更新常量，同一次提交完成。最终基线只在最后一次应用改动之后更新一次（中间的计划里 SAFE-02 会失败，规划时要么每个计划都更新，要么明确放在 wave 末尾）。

### 测试：新 cloud spec（login / logout / multi-device / reconcile / conflict / same-origin）

**类比：** `tests/cloud/cloud-harness.spec.ts`。

导入与结构（第 1-5 行）：

```ts
import { test, expect, type GuardHandle, type Page } from '../support/test';
import { APP_ORIGIN, PB_DOC_MAX_BYTES } from '../support/constants';
import { resolveHarnessMode } from '../support/app';
```

合成数据（第 24-30 行）：

```ts
function syntheticState(label: string) {
  return { _synthetic: true, logs: [{ id: `synthetic-${label}`, date: '2026-03-17', cat: '语言', text: `合成记录 ${label}` }] };
}
```

故意制造 4xx 时（第 7-18 行）必须用 `acknowledgeHttpErrors(guard, {401: 1})` 先断言恰好条数再 `guard.remove('consoleErrors', ...)`，否则 guard teardown 会让用例失败。登录失败（400）、`authRefresh` 401、`validation_not_unique` 400 都会产生 console.error，需要这样确认。

断言放在 Node 侧：`app.fake.reads / writes / requests / lastState() / lastPlan()`，页面内只用 `page.evaluate` 返回可序列化值。用 `expect.poll`，不用固定睡眠（保存有 600 ms 防抖）。toast 断言用 `tests/support/toast.ts` 的 `expectToast`（只看 `#toast` 的 `on` 类，失败消息不含文字）；新文案常量加到 `tests/support/strings.ts`。

各 spec 的特殊点：
- logout / ACCT-02（按 D-07 写）：A 退出后，断言 `localStorage` 里没有 `usj:v2:<A>:*` 键、没有留底、没有令牌（SDK 默认键 `pocketbase_auth`）；登录页预填 A 的邮箱是预期行为；B 登录后看不到 A 的内容。
- multi-device：两个 `browser.newContext()`，共享同一 `FakePbServer`，各自 attach；后保存的一台触发真冲突，断言服务器内容是后保存的、本机有留底、`#snapshotBtn` 出现，点下载后留底消失且文件名不含邮箱（`page.waitForEvent('download')`）。
- reconcile gate：慢响应和 5xx 需要假服务器的注入（见“没有类比”）；`context.setOffline` 不能用（PROBE-9）。
- 时钟：`frozenClock` 是 auto fixture，3 秒和 15 秒阈值要用 `page.clock`（`clockMode:'manual'` 选项）推进，不能真的等。
- same-origin（INFRA-03）：`guard.state.expectedAborts` 和 `unexpectedRequests` 都为空，页面请求只有 `/`、`/vendor/pocketbase.iife.js` 和 `/api/*`；页面 HTML 里不含 `googleapis`、`gstatic`。

## Shared Patterns

### 全部 cloud 用例的 guard 约定
**来源：** `tests/support/test.ts`、`tests/cloud/guard-cloud.spec.ts`。所有 spec 只从 `../support/test` 导入 `test`/`expect`；任何未被确认的 console.error、页面异常、外部请求都会在 teardown 让用例失败。

### 转义与校验
**来源：** `us-journey-tracker.html` 第 423 行 `esc()`，第 456 行 `normalize()`，第 370 行 `normalizePlan()`。云端来的 state 和 plan 同样先校验再渲染；新界面里的邮箱、错误文案用 `textContent` 或 `esc()`（`toast()` 用的是 `textContent`，不要改成 innerHTML）。

### 错误呈现
**来源：** 第 513、816 行。用户可见错误只走 `toast` 或 `setStatus`；代码里没有 `console.*`，云端路径同样不要加。可选能力用 `try{...}catch(e){}` 包裹。

### 处理函数顺序
先改 `state`，再 `persist()`，最后 `renderAll()`。云端路径保持这个顺序。

### 隐私
测试和文档里不出现真实邮箱、令牌、服务器地址、个人计划文字；账号只来自 `FakePbServer.addUser()`，数据带 `_synthetic`。

## No Analog Found

| 文件/能力 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| `tests/mocks/pb-server.ts` 的错误注入（连不上/超时/5xx/`authRefresh` 401/真冲突/唯一索引冲突） | test mock | request-response | 现有 `FakePbServer` 公共接口只有 `addUser/seed/lastState/lastPlan/handle/login/request/emit/openConnection/closeConnection/attach`，没有按路径注入失败或延迟的机制。`handle()`（第 152 行）已是单一入口，可在它之前加“规则表”（`fake.inject({method,path,status|delay|once})`）；`attach()` 里的 `route.fulfill` 前也可加延迟。`emit()`/`request()` 可作“另一台设备”模拟真冲突（服务器侧直接写入使 `updated` 前进）。PB-CONTRACT §9 注明这些都必须由假服务器显式触发。 |
| 云端登录页、`#syncbar`、`#boot`、`dialog#confirm` | component | 渲染 | 应用里没有登录相关界面，按 UI-SPEC S1-S10 的契约实现；CSS 复用现有 token 和 `dialog#editor` 的写法 |
| 同一浏览器两标签页的登出联动 | utility | event-driven | 没有类比，用 SDK 的 `authStore.onChange` 与 storage 事件（CONTEXT 酌处项） |
| 多设备 harness（共享 FakePbServer 的第二个 AppHarness） | test util | -- | `AppHarness` 目前每个实例自带一个 `FakePbServer`，需要小改造 |

## v1 约束清单（修改时不能破坏）

- `#status` 精确文本：`STATUS_LOCAL`、`STATUS_ACCOUNT`、`STATUS_BACKEND_UNSUPPORTED` 在 `tests/support/strings.ts`，约 20 个 v1 spec 通过 `toHaveText` 或 helper 依赖（calendar、editor、goals、io、storage、timeline、week 等）。云端文案放新的常量，旧路径不改。
- toast：无按钮 1800 ms、带按钮 5000 ms，`#toast` 的 `on`/`act` 类，按钮和 `span` 的结构（`tests/support/toast.ts` 的 `readToast` 依赖 `#toast span` 和 `#toast button`）。
- 工具栏：`#exportCsv`、`#exportJson` 初始 `hidden`，只有 `downloads` 能力存在才显示（`account-mode.spec.ts` 的 ready 条件检查两个按钮可见）。新增按钮不能改变这两个按钮的显示条件。
- `config-seam.spec.ts`：`backend:null` 走旧路径、未知 backend 显示 `STATUS_BACKEND_UNSUPPORTED`、配置里的 plan 被忽略。
- `app-variant.ts` 用字符串锚点改应用：`function normalize(s){`、`const esc=s=>String(s).replace(`、`function normalizePlan(`，每个必须恰好出现一次。重构应用时不能改动这三处的字面写法或让它们重复出现。
- 第 7-9 行的 font link 与 `FONT_HOSTS` 常量：常量要保留（console 噪音过滤和 guard 的字体分支还在用），只是应用不再请求。

## Metadata

**Analog search scope:** `us-journey-tracker.html`、`tests/support`、`tests/mocks`、`tests/cloud`、`tests/e2e/platform`、`tests/e2e/storage`、`playwright*.ts`、`package.json`、`tests/PROBES.md`
**Files scanned:** 约 30
**Pattern extraction date:** 2026-11-08
**未读：** `.planning/research/ARCHITECTURE.md` 与 `09-UI-SPEC.md` 的全文（只取了 UI-SPEC 的小节目录和 UI Considerations 表）。缓存键名 `usj:v2:<userId>:state|plan` 和 7 行对账表引自 CONTEXT 的转述，规划时需回读 ARCHITECTURE §Q3 核对。
