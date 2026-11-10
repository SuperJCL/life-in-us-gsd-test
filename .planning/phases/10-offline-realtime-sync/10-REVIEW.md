---
phase: 10-offline-realtime-sync
reviewed: 2026-11-10T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - tests/KNOWN-BUGS.md
  - tests/PROBES.md
  - tests/README.md
  - tests/cloud/capacity.spec.ts
  - tests/cloud/conflict-snapshot.spec.ts
  - tests/cloud/logout.spec.ts
  - tests/cloud/offline-sync.spec.ts
  - tests/cloud/pb-faults.spec.ts
  - tests/cloud/probes-cloud.spec.ts
  - tests/cloud/realtime-sync.spec.ts
  - tests/cloud/reconcile-gate.spec.ts
  - tests/cloud/remote-update.spec.ts
  - tests/cloud/session.spec.ts
  - tests/cloud/writer-id.spec.ts
  - tests/mocks/PB-CONTRACT.md
  - tests/mocks/pb-runtime.ts
  - tests/mocks/pb-server.ts
  - tests/support/app.ts
  - tests/support/constants.ts
  - tests/support/edits.ts
  - tests/support/online.ts
  - tests/support/strings.ts
  - us-journey-tracker.html
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 10: 代码审查报告

**Reviewed:** 2026-11-10
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

审查范围是 Phase 10 在云端路径上的改动：`requestSync`/`syncOnce` 的退避重试、`commit`/`ops`/`sentOps`/`opsOk`、挂起槽 `pendRemote`（`takeRemote`、`docAfter`、`applyView`、`isBusy`）、`rebaseState`、登录过期（`checkAuth`、`goExpired`）、每个标签页一个写入方 id、实时订阅，以及 `adoptTab` 和 `storage` 监听。我逐个调用点核对了 `git diff cc26092` 里 `persist()` 到 `commit()` 的改写，没有发现旧路径行为变化：预设删除、编辑保存、拖拽、任务勾选、力量值、复盘这几处新旧语义一致。D-01 到 D-07 的主干逻辑也都说得通：

- 上传成功时只有 `seq` 没变才清 `dirty`。
- `sentOps` 在两个分支里都在计算 body 的同一刻取得。
- 失败路径一律不清脏标记。
- 每个 `await` 之后都检查了 `sessionEpoch`。
- 状态栏五种文案与 09-UI-SPEC S2 逐字一致。

没有发现 BLOCKER 级问题。有 3 项 WARNING，主要是退出登录与会话中途发现过期这两条路径上的竞态、状态行里“立即重试”按钮每秒被重建，以及整轮同步共用一个 15 秒超时。另有 6 项 INFO。测试代码和假服务器的改动（`dropRealtime`、`refuseRealtime`、`fault({context})`、`writes[].writer`）没有发现会让用例失去判断力的缺陷。

## Warnings

### WR-01: 进行中的 `syncOnce` 不会被退出登录或会话重置中止，`authRefresh` 的迟到应答可以把令牌重新存回来

**File:** `us-journey-tracker.html:1096-1098, 1080-1084, 1424-1431, 1446-1459`
**Issue:** `syncOnce` 的 `AbortController` 是函数内的局部变量。`resetSession()` 只能 `endRun(run)` 中止启动对账那一轮，中止不到后台同步这一轮。`syncOnce` 里有三处会发 `authRefresh`：`needRefresh` 分支、缺文档时的 `checkAuth`、4xx 之后的 `checkAuth`。PocketBase SDK 的 `authRefresh` 成功后会无条件 `authStore.save(newToken)`。

如果用户在这类请求还在路上时点了“退出登录”，顺序是这样的：

1. `logout()` 清掉缓存，再 `pb.authStore.clear()`，然后 `resetSession()`，页面显示登录页。
2. 随后迟到的 `authRefresh` 应答返回 200，SDK 把令牌重新写进 `localStorage`。`authQuiet` 此时已是 `false`，但 `onAuthChange` 因为 `!me` 直接返回，没人察觉。
3. 刷新页面后，`cloudInit` 发现令牌有效，直接 `enterApp`，退出登录被悄悄撤销。

`checkAuth` 里的 `goExpired()` 也没有 `ep===sessionEpoch` 检查。若在退出之后收到 401，`expireToken()` 会把 `EXPIRED_KEY` 写回，`net="expired"` 并在登录页弹出“登录已过期”横幅。

触发窗口不大，因为这三个分支都不是每轮必走（离线启动后的第一轮最容易遇到），但后果是退出登录失效，属于安全相关行为。

**Fix:** 把当前这一轮的控制器放到模块级，在 `resetSession` 和 `logout` 开头中止它，并给 `checkAuth` 加上会话检查：
```js
let syncCtrl=null;
// syncOnce 开头：const ctrl=new AbortController();syncCtrl=ctrl;
// finally 里：if(syncCtrl===ctrl)syncCtrl=null;
// resetSession() 开头，以及 logout() 的 authQuiet=true 之后：
try{syncCtrl&&syncCtrl.abort()}catch(e){}
async function checkAuth(signal,ep){
  try{await pb.collection("users").authRefresh({signal})}
  catch(e){if(e&&e.status===401&&ep===sessionEpoch){goExpired();return false}throw e}
  return ep===sessionEpoch;
}
```

### WR-02: 重试倒计时每秒重建一次“立即重试”按钮，键盘焦点丢失，慢一点的点击会落空

**File:** `us-journey-tracker.html:617, 1057, 1076`
**Issue:** `scheduleRetry` 的 1 秒 `cdTimer` 在 `net==="retrying"` 时每秒调用 `showSync()`。`showSync` 走到 `setStatus(text,"retrying",btn)`，而 `setStatus` 先 `e.textContent=t` 清空整个状态行，再 `createElement` 新建按钮。后果有两点：

- 键盘用户用 Tab 聚焦到“立即重试”后，最多 1 秒就丢焦点。
- 鼠标 `mousedown` 与 `mouseup` 之间如果刚好换了节点，`click` 不会触发。按住按钮的时间越长，落空的概率越高。

这个按钮是用户在服务器出错时唯一的主动手段，D 里写明“状态行带立即重试按钮”。

**Fix:** 倒计时只更新文字节点，按钮保持不动：
```js
function setStatus(t,st,btn){
  const e=$("status");
  const keep=btn&&e.querySelector("button");   // 同一个按钮已经在，只改前面的文字
  if(keep&&e.firstChild&&e.firstChild.nodeType===3){e.firstChild.nodeValue=t}
  else{e.textContent=t;if(btn){/* 原有的创建逻辑 */}}
  if(st)e.setAttribute("data-state",st);else e.removeAttribute("data-state");
}
```
测试里 `tests/support/strings.ts` 说句子是 `#status` 的第一个文字节点，这个改法保持该结构。

### WR-03: 一轮同步（读两份完整文档加上传）共用一个 15 秒超时，大文档在慢线路上会永远超时

**File:** `us-journey-tracker.html:1043, 1096-1098, 1207`
**Issue:** `SYNC_MS=FAIL_MS` 对 `syncOnce` 的整轮请求计时：必要时的 `authRefresh`，加上 `getFullList`（计划和状态两份文档的完整内容），再加 `update`。上限是 4 MB（`CLOUD_MAX`），按 15 秒算，只要链路有效吞吐低于约 0.3 到 0.5 MB/s（读 + 写加起来要搬 2 倍文档大小以上），这一轮就必然超时。超时后被分类为 `retrying`，退避重试的还是同一个请求，超时时间不会放宽。

结果是文档大到一定程度后，修改永远留在本机，用户只看到“保存失败，修改仍在本机”循环，没有任何自愈。README 的“已知限制”只提到了流量，没提这个后果。

**Fix:** 让超时随要搬的数据量缩放，或每次重试放宽：
```js
const tmo=SYNC_MS+Math.min(60000,Math.round(sizeOf(state)/1024*60)); // 每 KB 再给约 60 ms，上限再加 60 s
// 或：连续超时 n 次后用 SYNC_MS*Math.min(4,1+n)
```
同时把“慢线路上的大文档”写进 README 的已知限制。

## Info

### IN-01: 带缓存时已经没有路径能到达“连不上、只读”的横幅，相关代码已成死代码

**File:** `us-journey-tracker.html:873, 884, 865`
**Issue:** D-01 之后，带缓存的启动在约 15 秒或浏览器明确断网时一律走 `goBootOffline`。`showBar("unreachable",unreachBar(r,true))` 只在 `cached&&retrying` 时才会出现，而 `retrying` 只能由 `onRetry` 传入。带缓存时 `onRetry` 的唯一入口正是这个横幅上的按钮，而这个横幅从未先显示过。剩下的 `bootRetry` 按钮只服务无缓存的首次登录。因此 `unreachBar`、`startReconcile` 里的 `if(retrying)showBar("unreachable",…)`，以及 `SB_ORDER` 中的 `"unreachable"` 对带缓存的路径都是死代码。
**Fix:** 删掉 `unreachBar` 和这一句分支，`SB_ORDER` 里的 `"unreachable"` 也可去掉；或者在 CONTEXT 里注明保留是为了以后别的用途。

### IN-02: 离线或保存失败期间，每次编辑都会立即发起一次请求，并推进退避档位

**File:** `us-journey-tracker.html:611, 1071-1077`
**Issue:** `flush()` 在 `net` 为 `offline` 或 `retrying` 时仍然调用 `requestSync("save")`，不看重试计时器。失败后 `scheduleRetry()` 又会 `retryIdx++`。边记边失败时，退避会被编辑次数推到 60 秒，而不是按 1、2、5、10、30、60 秒走。这也使 `retrying` 档位里每次编辑都会对一个已知出错的服务器多打一枪，最多挂 15 秒。这类试探本身对“记完马上上传”是有用的，所以不算缺陷，只是和 CONTEXT 描述的间隔不完全一致。
**Fix:** 编辑触发的尝试失败时不推进 `retryIdx`：给 `requestSync` 加一个 `bump` 参数，只有定时器和“立即重试”触发的失败才 `retryIdx++`。

### IN-03: `sizeCheck` 量的是 `state`，上传的却是 `docAfter()`

**File:** `us-journey-tracker.html:1106, 1141, 1151`
**Issue:** 有挂起槽时，实际上传的 body 是“服务器版本 + 尚未上传的操作”，大小可能和工作 `state` 不同。`sizeCheck(state)` 通过但 body 超限时，请求会收到服务器的 4xx（不一定是 413），于是被当作 `retrying` 无限重试，状态行不会显示 `toolarge`。另外超限且脏的设备在 `sizeCheck` 之前不会读列表，`pollTick` 又因为 `dirty` 而跳过，所以这台设备在把数据缩小之前看不到任何远端更新。
**Fix:** 先算出 `body`，再 `sizeCheck(body)`；创建分支同理。

### IN-04: 一个标签页发现登录过期，其他标签页会被直接送到登录页，草稿丢失

**File:** `us-journey-tracker.html:684-696`
**Issue:** `expireToken()` 清掉共享的令牌，其他标签页的 `onAuthChange` 看到空令牌就 `resetSession(); showLogin("", "expired")`。缓存里的修改不丢，但这些标签页里没提交的草稿、编辑框内容和内存里的 `ops` 会被丢掉。D 里“过期后仍可继续记”只对发现过期的那个标签页成立。
**Fix:** 在 README 的“已知限制”里写明；或者让其他标签页在 `EXPIRED_KEY` 为 `"1"` 时也进入 `net="expired"` 状态而不是回登录页。

### IN-05: 导入路径绕过 `commit`，以后若在云端放开导入会和挂起槽冲突

**File:** `us-journey-tracker.html:1758`
**Issue:** `importJson` 的处理还是 `state=s;persist("import");renderAll()`，没经过 `commit`，所以没有 `ops`，也不会 `takeRemote()`。云端路径目前把导入入口隐藏（`cloudInit` 里 `classList.add("hidden")`），所以现在不触发。但 Phase 11 如果放开，挂起槽里有远端版本时 `docAfter()` 会返回“槽 + ops”而不是刚导入的 `state`，导入内容会被丢掉。
**Fix:** 在 Phase 11 放开导入时，改成 `commit(["import"], s=>Object.assign(s, imported))` 并清掉 `pendRemote`，或者在这里先 `pendRemote={plan:null,state:null};ops=[];opsOk=false`。

### IN-06: `normalize` 对非法 id 的记录每次生成新的随机 id，`remoteDiffers()` 会永远为真

**File:** `us-journey-tracker.html:556, 1340-1361`
**Issue:** `docAfter()` 每次都对服务器数据重新 `normalize`，遇到没有合法 `id` 的日志就 `r.id=uid()`。只要服务器文档里有这样的记录（例如以后迁移写入的），每次 `canon(docAfter())!==canon(state)` 都为真，横幅反复出现，每轮对账都弹“已更新为其他设备上的最新内容”。应用自己写的文档 id 总是合法的，所以现在不触发。
**Fix:** 迁移（Phase 11）写入前就补齐 id；或在 `remoteDiffers` 里比较前先把两边的 id 规范化。

---

_Reviewed: 2026-11-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
