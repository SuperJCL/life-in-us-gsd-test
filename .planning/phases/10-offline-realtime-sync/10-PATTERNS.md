# Phase 10: 离线与实时同步 - Pattern Map

**Mapped:** 2026-11-09
**Files analyzed:** 9 个（1 个应用文件 + 8 个测试相关文件）
**Analogs found:** 9 / 9（应用内都是同文件内的现有函数；无整体新文件）

说明：本阶段只改 `us-journey-tracker.html` 的云端路径。行号是读取时的近似值，改动前请重新 grep 确认。所有类比文件都是 git 跟踪的源码。UI 文字逐字取自 `.planning/phases/09-login-cloud-storage/09-UI-SPEC.md` 的 S2、S4、S5、S6，本文件不复制文案。

## File Classification

| 新增/修改 | 角色 | 数据流 | 最接近的类比 | 匹配度 |
|---|---|---|---|---|
| `us-journey-tracker.html` 保存与重试（`persist`/`flush`/`cloudSave`） | service | CRUD + 退避重试 | 同文件 `flush`(:597) + `cloudSave`(:988) + `startReconcile` 的 `later/attempt`(:842-866) | exact |
| 同上：实时订阅、`online`/`visibilitychange`/60 秒拉取 | service | event-driven | 同文件 `logout` 里的 `pb.realtime.unsubscribe`(:1064) + `startReconcile`；`tests/mocks/PB-CONTRACT.md` §6 | role-match |
| 同上：远端更新挂起/应用（`isBusy`、D-04 重做） | controller | event-driven | `reconcileOnce` 末尾的同步提交块(:914-934) + composer `refresh`(:1120) | partial |
| 同上：状态栏五状态与横幅 | component | request-response | `setStatus`(:605)、`SB_ORDER/drawBar/showBar/hideBar`(:814-824)、`unreachBar`(:839) | exact |
| 同上：待上传条目集合与缓存字段（D-07） | model | CRUD | `cachePut/cacheGet`(:772-773)、`persist`(:596)、`settle`(:922-926) | role-match |
| 同上：登录过期（保留本机修改） | controller | request-response | `expireToken`(:651)、`onAuthChange`(:655)、`startReconcile` 的 401 分支(:861)、`unsentOf`(:664) | exact |
| 同上：`WRITER` 每标签页一个（WR-01） | utility | transform | `WRITER=uid()`(:632) + `LAST_USER_KEY` 的 localStorage 用法(:770) | role-match |
| `tests/cloud/offline-sync.spec.ts`（新）：离线编辑与待上传数量、重试退避、状态栏五状态 | test | request-response | `tests/cloud/pb-faults.spec.ts`、`tests/cloud/reconcile-gate.spec.ts` | role-match |
| `tests/cloud/realtime-sync.spec.ts`（新）：挂起/应用/重放/回声、重连与可见性对账 | test | event-driven | `tests/cloud/multi-device.spec.ts` + `FakePbServer.emit()` | role-match |
| 登录过期用例（并入 `tests/cloud/session.spec.ts` 或新建） | test | request-response | `tests/cloud/session.spec.ts` | exact |
| `tests/support/strings.ts`、`tests/support/constants.ts` | config | - | 现有常量（`BTN_ACK`、`STATUS_SAVE_FAILED_CLOUD`、`APP_SHA256`） | exact |

## Pattern Assignments

### 应用：保存与退避重试（`flush`、`cloudSave`）

**类比：** `us-journey-tracker.html` 的 `flush`、`cloudSave`、`startReconcile`。

**B5 的根源与要改的点**（`flush`，:597-604）：在 `await` 之前就 `dirty=false`，失败后不会再试。云端路径要改为只在 `docs.state.seq` 未变的成功之后清 `dirty`，失败保留并启动退避定时器。

```js
async function flush(){
  savePending=false;
  if(CLOUD&&document.body.hasAttribute("data-gate"))return;
  if(!store||saving||!dirty)return;saving=true;dirty=false;
  const ep=sessionEpoch;
  try{await store.save(JSON.parse(JSON.stringify(state)));if(ep===sessionEpoch)setStatus(store.label,store.state)}catch(e){...}
  saving=false;if(dirty)flush();
}
```

**成功后只在 seq 没变时清脏**（`cloudSave`，:1003-1005，已有，保持）：

```js
docs.state.base=r.updated;if((docs.state.seq||0)===seq)docs.state.dirty=false;
if(!cachePut("state",{...docs.state,data:state})&&!docs.state.dirty)dropCache("state");
if(!docs.state.dirty)cacheNote(true);
```

**epoch 守卫**（每个 await 之后都要，:990-993、1000）：`const ep=sessionEpoch; ... if(ep!==sessionEpoch)return;`。订阅回调、重试定时器、拉取也照做。

**WR-02：** `cloudSave` 现在没有超时。可参照 `startReconcile` 的 `AbortController` + `setTimeout` 写法（:844、:830）：`pb.collection(...).getOne(id,{signal})` / `update(id,body,{signal})`，超时就 abort。`resetSession`(:1039) 需要补 `saving=false`。

**重试节奏：** 沿用 `later()` 的写法（:846），`r.timers` 由 `endRun` 统一清理（:830）；新增的退避定时器要在 `resetSession` 里清掉。

**错误分类：** 现在 `cloudSave` 的 catch 把所有失败都变成 `savefailed`（:999）。要按“请求没到达（网络错误或 `status===0`）→ offline；5xx 或超时 → retrying；容量超限 → 保持 `toolarge`，不重试”区分，具体判定由规划定。

### 应用：实时订阅与对账入口

**类比：** `startReconcile`/`reconcileOnce`（:842-935）作为唯一对账入口；退订在 `logout`（:1064）。

**对账入口模式**（:842-866）：一个 `run` 对象、`alive()` 检查、`later()` 计时、401 时 `expireToken(); resetSession(); showLogin("","expired")`。

```js
const attempt=async()=>{ r.tries++;
  try{await reconcileOnce(r)}
  catch(e){ if(!alive())return;
    if(e&&e.status===401){endRun(r);expireToken();resetSession();showLogin("","expired");return}
    if(r.tries<3)later(attempt,RETRY_MS);
  }};
```

新增的 `online`、`visibilitychange`、`PB_CONNECT`、60 秒定时器、重试到期，都汇到同一个入口。重连对账**不重新加门控**（见 CONTEXT 的 Claude's Discretion），所以 `startReconcile` 需要一个“后台、不加门控”的模式，不能直接复用 `setGate("reconciling")`（:848）。

**回声抑制：** `writer` 字段已随每次写入发送（`coll.update(id,{data,writer:WRITER})`，:997；`mk` 在 :886）。订阅回调里 `record.writer===WRITER` 就忽略。`cloudSave` 里已有同样的自写判断（:996 `cur.writer!==WRITER`）。

**订阅格式、SSE 与 `fields`：** 见 `tests/mocks/PB-CONTRACT.md` §6。页面侧的假 EventSource 在 `tests/mocks/pb-runtime.ts`。

### 应用：远端更新的挂起与应用（D-04、D-05）

**类比：** `reconcileOnce` 末尾那段“一次同步提交”（:914-934）：先 plan 后 state，一次性替换、`renderAll()`。远端应用函数照抄这个顺序，并且保持界面游标 `wk/sel/view/filter` 不变（这几个是顶层 `let`，见 `resetSession` :1046 里的列表）。

```js
const planOk=usePlan(pr.data);keepOrphans=!planOk;
state=normalize(sr.data);
...
docs.plan=settle("plan",pr,pdata);docs.state=settle("state",sr,state);
...renderAll();snapShow();
if(changed)toast("已更新为其他设备上的最新内容",null,4000);
```

**保留草稿：** composer 的 `refresh`（:1120）重绘时保留文字：

```js
const refresh=focusAdd=>{const keep=ta.value;rerenderComp(p);const t2=document.getElementById(p+"-text");t2.value=keep;t2.dispatchEvent(new Event("input"));...
```

“忙”的判定需要新写 `isBusy`：编辑弹窗 `dlg.open`、composer 草稿非空、`document.activeElement` 是输入框、`rvPending`（复盘防抖）、`compEdit/compAdding`（`resetSession` :1047 里列出的状态）。

**D-04 的重做：** 约定的处理函数模式是“改 `state` → `persist()` → `renderAll()`”。要把每个结束忙碌的处理函数（发出草稿、编辑弹窗保存/删除、复盘、力量值、开始日期）改为先应用挂起的远端、再按 id 重做。无现成类比，参照 `deleteLog`/`addLog` 的 undo 写法，并避免保留旧 `state` 的对象引用。

### 应用：状态栏和横幅

**类比（精确）：** `setStatus(text, state)`（:605）写 `data-state`；横幅按固定优先级一次显示一条（:814-824）。

```js
const SB_ORDER=["expired","unreachable","slow","toolarge","cachefail","snapfail","remote","sizewarn"],sbs={};
function showBar(key,b){sbs[key]=b;drawBar()}
function hideBar(key){if(sbs[key]){delete sbs[key];drawBar()}}
// b = {tone, msg, btns:[{text, cls, fn, disabled}]}
```

新状态（`offline`、`retrying`、`expired`、`remote`）沿用这个横幅对象结构；`remote` 键已在 `SB_ORDER` 里。如需新键（如 `retrying`），按 S2 的优先级插入 `SB_ORDER`。`savefailed` 被 `retrying` 取代，检索 `"savefailed"` 的所有调用点：`cloudSave` 抛出(:999)、`flush` 的 `e.state`(:602)。

**“立即重试”按钮**照抄 `unreachBar`（:839）：`{text, cls:"primary", disabled:busy, fn:()=>...}`，忙时显示 `T_RETRYING`（:827）。

**文本常量集中成 const**（如 `T_RECON/T_SLOW/T_UNREACH`，:827），并同步到 `tests/support/strings.ts`。

### 应用：待上传条目集合（D-07）

**类比：** 缓存记录 `{id, base, dirty, seq, data}`：`persist`（:596）每次 `docs.state.seq+1`、`cachePut("state",{...docs.state,data:state})`；`settle`（:922-926）重建记录。可以给记录加字段（如 `touched:[...]`）。

```js
function persist(){dirty=true;savePending=true;if(CLOUD&&me&&docs.state){docs.state.seq=(docs.state.seq||0)+1;docs.state.dirty=true;cacheNote(cachePut("state",{...docs.state,data:state}))}...}
```

要点：`persist()` 加参数（如 `persist("log:"+id)`）把条目键放入集合；成功上传且 `seq` 未变时清空；`enterApp`（:874）读缓存时要还原集合，`settle` 也要保留或清空。数量只在 `offline` 状态行显示。

### 应用：登录过期

**类比（精确）：** `expireToken`（:651）、`onAuthChange`（:655）、401 分支（:861）、`unsentOf`（:664）、`T_EXPIRED_UNSENT`（:662）。

```js
function expireToken(){
  try{localStorage.setItem(EXPIRED_KEY,"1")}catch(e){}
  authQuiet=true;pb.authStore.clear();authQuiet=false;
}
```

与现在的差别：当前的 401 路径会 `resetSession(); showLogin(...)`，会清掉内存里的 `state`（缓存仍在）。本阶段要求“过期后仍可继续记，修改存在本机”，所以在会话中途发现 401（保存或读取失败后调用 `authRefresh`）时，不要 `resetSession`：只显示 `expired` 状态与横幅，继续 `persist` 写缓存；点“重新登录”才进入登录页。同一账号重新登录会走 `enterApp`（:867）读脏缓存、对账上传。

### 应用：`WRITER` 每标签页一个（WR-01）

**类比：** :632 `WRITER=uid()` 在 SDK 常量那一行。改为读写 `sessionStorage`（键名自定，如 `usj:v2:writer`）。复制标签页会复制 `sessionStorage`，所以需要额外探测。例如用 `BroadcastChannel`/`storage` 事件做占用声明，重复就重新生成。无现成类比，`LAST_USER_KEY`（:770）是 localStorage 读写+try/catch 的写法：`try{...}catch(e){}`。

### `tests/cloud/realtime-sync.spec.ts`（新）

**类比：** `tests/cloud/multi-device.spec.ts`（60 行）。

**导入与多设备模式**（multi-device.spec.ts:1-8、24-37）：

```ts
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { openDevice } from '../support/devices';
import { acknowledgeConsoleErrors } from '../support/guard-ack';

await app.open({ mode: 'cloud', login: 0 });
const entry = composer(page, 'w');
await entry.type('SYNTH-... text');
await entry.submit();
await expect.poll(() => (app.fake.lastState(0)?.logs ?? []).some(...)).toBe(true);
const second = await openDevice({ browser, guard, fake: app.fake });
try { await second.app.open({ mode: 'cloud', login: 0 }); ... } finally { await second.context.close(); }
```

**推送远端事件：** `await app.fake.emit(0, 'update', record)`（`pb-server.ts:217`），由测试显式调用，不靠计时器；`emit` 和写入走同一套订阅判定和 `fields` 裁剪。

**时钟：** `openDevice` 默认 `clock:'fixed'`（devices.ts:41-43）。要测 60 秒拉取，用 `clock:'none'` 自己安装 `page.clock`。

**后保存的一方发现 `updated` 变了（冲突用例）：** 参照 `tests/cloud/conflict-snapshot.spec.ts` 的 `openDevice` + `expectToast` + `syntheticState('base')` 的用法（该文件的导入：`syntheticState`、`expectToast`、`strings` 常量）。

### `tests/cloud/offline-sync.spec.ts`（新，离线/重试/五状态）

**类比：** `tests/cloud/pb-faults.spec.ts`（假服务器开关）、`tests/cloud/reconcile-gate.spec.ts`（对账门控与状态行）。

**制造故障**（pb-faults.spec.ts:20-37）：

```ts
const f = app.fake.fault({ method: 'POST', path: '/api/collections/users/auth-with-password', mode: 'refuse' });
...
expect(f.hits).toBe(1);
await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
```

模式 `refuse | status | hold | lose-answer`；`times` 可限定次数，`release()` 释放 `hold`，`remove()` 撤销规则。保存列表路径：`LIST_PATH = '/api/collections/journey_docs/records'`（pb-faults.spec.ts:10）；单条更新路径：`/\/api\/collections\/journey_docs\/records\/[^/]+$/`（conflict-snapshot.spec.ts:30）。

**重要：** 不用 `context.setOffline` 来模拟服务器断网（PROBE-9，`tests/PROBES.md`）。要测 `navigator.onLine===false` 的冷启动分支（D-02），才单独用 `setOffline`，并与假服务器故障区分。被拒绝的请求会让 Chromium 写 `console.error`，必须用 `acknowledgeConsoleErrors` 登记，否则护栏会让用例失败。

**落盘断言：** `app.expectPersisted(predicate)`、`app.expectSaved(...)`（support/app.ts:258、288），读取假服务器 `app.fake.lastState(0)`。

### 登录过期用例

**类比：** `tests/cloud/session.spec.ts`（已有过期、令牌、其他标签页的用例）。失效令牌的服务器侧表现：`revokeTokens`（`pb-server.ts` 注释 :10 列出）。判定只看 `authRefresh` 的 401（PB-CONTRACT §9）。

### `tests/support/constants.ts`

`APP_SHA256`（:38）在应用文件每次变化后都要更新，是有意识的更新（见 CONTEXT）。

## Shared Patterns

### 会话代号守卫
**来源：** `us-journey-tracker.html` `sessionEpoch`（:868、990-1000、1040）。
**应用于：** 所有新异步路径（订阅回调、重试定时器、60 秒拉取、`online`/`visibilitychange` 处理）。每次 `await` 之后检查 `ep!==sessionEpoch`；`resetSession` 里要清掉新增的定时器和订阅状态。

### 对账 run 的“存活”判断
**来源：** :829-831、846 `alive()/later()/endRun()`。
**应用于：** 退避重试、后台对账。

### 缓存写失败的处理
**来源：** :776-783 `cacheNote(ok)`；写失败时 `cacheFull` 为真，横幅 `cachefail`。
**应用于：** 每个新的 `cachePut` 调用点（离线记录、条目集合）。

### 用户文字
**来源：** 全部沿用 09-UI-SPEC 的 S2/S4/S5/S6；横幅用 `textContent` 和 `createElement` 构建（:813-822），不用 `innerHTML`。`toast(m, act, ms)`（:1369）第三个参数非空即标成云端 toast。

### 测试护栏
**来源：** `tests/support/test.ts` 的 guard，只在 `npm run test:cloud`，只用合成账号；单 worker、不并发。

## No Analog Found

| 内容 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| 实时订阅（`pb.realtime.subscribe`）及 `PB_CONNECT` 处理 | service | event-driven | 应用里只有退订，没有订阅；协议见 `PB-CONTRACT.md` §6，页面侧假 EventSource 在 `pb-runtime.ts` |
| `isBusy` 与 D-04 的“应用远端再按 id 重做” | controller | event-driven | 现有处理函数全都是直接改全局 `state`；参考 ARCHITECTURE §Q2 |
| 每标签页 writer id（含复制标签页探测） | utility | - | 应用里没有 `sessionStorage` 用法 |
| `online`/`visibilitychange` 监听与 60 秒拉取 | hook | event-driven | 现在只有 `pagehide`（:702、:1373） |
| 两个标签页同时离线的 `storage` 事件同步 | service | pub-sub | 只有 `onAuthChange` 一个 `storage` 类相关用法（:655），可作形式参考 |

## Metadata

**Analog search scope:** `us-journey-tracker.html`（:594-1070 及 composer、toast 附近）；`tests/cloud/`、`tests/support/`、`tests/mocks/`。
**Files scanned:** 约 14
**Pattern extraction date:** 2026-11-09
