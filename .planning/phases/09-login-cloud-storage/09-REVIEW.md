---
phase: 09-login-cloud-storage
reviewed: 2026-11-09T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - tests/KNOWN-BUGS.md
  - tests/PROBES.md
  - tests/README.md
  - tests/cloud/account-data.spec.ts
  - tests/cloud/capacity.spec.ts
  - tests/cloud/cloud-harness.spec.ts
  - tests/cloud/conflict-snapshot.spec.ts
  - tests/cloud/guard-cloud.spec.ts
  - tests/cloud/login.spec.ts
  - tests/cloud/logout.spec.ts
  - tests/cloud/multi-device.spec.ts
  - tests/cloud/pb-faults.spec.ts
  - tests/cloud/probes-cloud.spec.ts
  - tests/cloud/reconcile-gate.spec.ts
  - tests/cloud/same-origin.spec.ts
  - tests/cloud/session.spec.ts
  - tests/e2e/platform/guardrails.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/mocks/PB-CONTRACT.md
  - tests/mocks/pb-server.ts
  - tests/support/app.ts
  - tests/support/cloud-data.ts
  - tests/support/constants.ts
  - tests/support/devices.ts
  - tests/support/guard-ack.ts
  - tests/support/strings.ts
  - tests/support/test.ts
  - us-journey-tracker.html
findings:
  critical: 2
  warning: 7
  info: 6
  total: 15
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-11-09
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

审查范围是 `us-journey-tracker.html` 的云端路径（登录、对账门控、本机缓存、冲突留底、退出登录、跨标签页登出）加上配套的 cloud 测试与假 PocketBase。没有提供 structural findings 和 external reviewer evidence，所以只有叙述性发现。

做得对的部分（已逐条核实，不再列为问题）：

- XSS：所有服务器来源的计划文字、记录文字、id、邮箱都经 `esc()` 或 `textContent`；`normalizePlan` 的 id 正则和 `hasCat` 把属性注入面堵住了，`drawBar`、`loginNotice`、`confirmBox`、`toast`、`showWho` 全部用 `textContent`。
- 传统路径（无后端、`window.claude`）：与 diff_base 的 `init()` 逐行相同；`persist`/`flush` 的新增分支都以 `CLOUD` 或 `data-gate` 为前提，传统路径不会进入。
- 对账：网络阶段和提交阶段分离，`live()` 检查保证被放弃的 run 不会半途提交；`canon` 相等判断让“放弃后重试”不会重复留底。
- 隐私：范围内文件没有真实风格的邮箱（只有 `example.com`）、域名、IP（只有 `127.0.0.1`）、令牌或口令字面量；令牌和口令都是运行时生成。`APP_SHA256` 与当前应用文件的实际哈希一致，`SDK_SRI` 与 `PB_SDK_SHA256` 的 base64 一致。

主要问题集中在三处：退出登录只看本标签页的未保存状态，会静默清掉另一个标签页的未上传修改；计划文档不合格时的回落会把状态里的任务进度永久改写到服务器上；`cloudSave` 的冲突判断会把自己的写入误判为他人覆盖，并且会冲掉真正的留底。

## Critical Issues

### CR-01: 退出登录只检查本标签页的未保存状态，另一个标签页没上传的修改被静默清掉

**File:** `us-journey-tracker.html:983, 1024-1034, 1015`（对照 `651-656` 的 `unsentOf`）
**Issue:** `hasUnsaved()` 只读本标签页的内存变量（`savePending`、`saving`、`rvPending`、`docs.state.dirty`）。缓存键 `usj:v2:<id>:state` 是同一浏览器所有标签页共用的，另一个标签页在服务器连不上时留下的 `dirty:true` 缓存（以及它的内存状态）对本标签页不可见。结果：标签页 1 点“退出登录”，`hasUnsaved()` 为假、没有留底，于是不弹确认框直接 `logout()`，把 `state`/`plan`/`snapshot` 缓存全部删除；标签页 2 随后收到令牌清空的 storage 事件，`resetSession()` 丢掉内存状态。标签页 2 里没上传的修改就此消失，而且全程没有任何提示，违反 D-05（“有修改还没保存到服务器时必须先问”）。`tests/cloud/logout.spec.ts:201-239` 的跨标签页用例正是在标签页 2 留着一条待上传修改的情况下断言“没有任何确认框、没有 A 的键”，把这个行为固化成了期望。
**Fix:** 退出前同时看共享缓存里的脏位，复用已有的 `unsentOf`：
```js
async function onLogoutClick(){
  if(loggingOut||!me)return;
  const u=unsentOf(me);
  const unsaved=hasUnsaved()||u.edits,snap=!!snapGet()||u.snap;
  ...
}
```
并在跨标签页用例里先让标签页 2 的保存失败（`PATCH` 用 `refuse` 注入）留下 `dirty:true` 缓存，再断言标签页 1 点退出时弹出确认框。

### CR-02: 计划文档不合格时回落到示例计划，随后第一次保存会把状态里的任务进度永久改写到服务器

**File:** `us-journey-tracker.html:486-491, 569, 885-892, 944-957`
**Issue:** `usePlan()` 在服务器（或缓存）的计划通不过 `normalizePlan` 时静默改用示例计划，`planIds` 随之变成示例计划的 id。紧接着 `state=normalize(sr.data)` 按“进度键必须对应 `planIds` 或自定义待办”过滤 `state.tasks`，个人计划里的 `t-…` 任务和示例计划没有的 `P<n>-<i>` 进度键全部被丢弃；`settle("state",…)` 把丢弃后的状态写进缓存并标成干净。用户下一次任何编辑都会让 `cloudSave` 把这份缺了进度的整份 state 上传，覆盖服务器上原来的完整进度，且没有留底、没有提示。`tests/cloud/account-data.spec.ts:138-170` 声称“计划文档从不被改写”，但种子 state 里没有任何任务进度，所以测不到这条路径；PLAN-01 的保证只覆盖了 plan 文档，没有覆盖 state 文档。触发条件需要计划文档不合格（后台误改、后续阶段的计划编辑缺陷、格式版本升级），概率不高，但一旦发生是服务器端不可恢复的丢失。
**Fix:** 计划回落时不要让 `normalize` 丢进度键。最小改法：`usePlan` 返回 `ok`，`reconcileOnce` 在 `ok===false` 时对 state 只做不丢键的修正（保留未知进度键，或者跳过 `planIds` 过滤），并且在回落期间不把 `normalize` 后的 state 当作干净缓存；更稳妥的做法是计划不合格时进入只读（`setGate("readonly")`）并提示，直到计划可用。补一条用例：服务器计划不合格、state 带个人计划任务进度，编辑后断言服务器 state 的 `tasks` 键集合不变。

## Warnings

### WR-01: `cloudSave` 把自己的写入误判成他人覆盖，会冲掉真正的留底，并且在覆盖成功之前就报“已被覆盖”

**File:** `us-journey-tracker.html:944-957, 903-912`
**Issue:** 冲突判断只比较 `cur.updated!==docs.state.base`。三种情况会误报：(1) 上一次 `PATCH` 在服务器上成功、但响应丢了，`docs.state.base` 没更新，下一次保存 `getOne` 看到的是自己写的版本，被当成“另一台设备的修改”；(2) `cur.data` 与要上传的 `s` 相同，没有任何东西会丢；(3) `keepConflict` 在 `update` 之前执行，`update` 失败时服务器版本其实没被覆盖，toast 却说“已被覆盖，已在本机留底”。对账路径用了 `canon(c.data)!==canon(sv.data)` 兜底，保存路径没有。更糟的是留底只有一份（D-09），情况 (1) 会用“自己的旧版本”替换掉此前真正有价值的另一台设备的留底，用户还会因为多出一份留底而在退出时被多问一次。`writer` 字段（`WRITER=uid()`）本来就能识别自己的写入，但没有用于这里。
**Fix:**
```js
const cur=await coll.getOne(docs.state.id);
if(ep!==sessionEpoch)return;
if(cur.updated!==docs.state.base&&cur.writer!==WRITER&&canon(cur.data)!==canon(s))keepConflict("state",cur);
```
并把 `keepConflict` 的 toast 挪到 `update` 成功之后（先只写留底，成功后再提示）。补用例：`PATCH` 先放行后丢响应，再保存一次，断言没有留底。

### WR-02: SDK 首次加载失败后再登录，`onAuthChange` 从未注册，跨标签页登出和换账号重载都失效

**File:** `us-journey-tracker.html:689-692, 717`
**Issue:** `pb.authStore.onChange(onAuthChange)` 只在 `cloudInit` 里 `loadSdk()` 成功之后注册。`loadSdk()` 失败时 `cloudInit` 走 `showLogin(ERR_NET); return`，此时 `pb` 为 `null`；用户之后在登录页重试，`onLogin` 里 `if(!pb){await loadSdk();startPb()}` 创建了 `pb` 却没有注册监听。这个会话里：另一个标签页退出登录不会让本标签页登出，另一个标签页换账号登录也不会触发重载，本标签页会继续用旧账号的内存状态（令牌已换成另一个账号）。`tests/cloud/same-origin.spec.ts:73-106` 只测了篡改 SDK 后停在登录页，没有测“之后重试成功”。
**Fix:** 把监听注册放进 `startPb()`：
```js
function startPb(){pb=new window.PocketBase(location.origin);pb.autoCancellation(false);pb.authStore.onChange(onAuthChange)}
```
并从 `cloudInit` 里删掉重复的注册。

### WR-03: 留底下载在 `a.click()` 之后立即销毁 blob 地址并删除本机唯一副本

**File:** `us-journey-tracker.html:913-929`
**Issue:** `a.click()` 之后 `setTimeout(()=>URL.revokeObjectURL(url),0)`，紧接着同步 `localStorage.removeItem(snapKey())` 并弹“已开始下载留底，本机不再保留副本”。这份留底是被覆盖的另一台设备数据的唯一副本。0 毫秒后回收 blob 地址在 Firefox、Safari 以及浏览器弹出“是否允许多个下载”提示的情况下可能让下载失败，而应用既检测不到下载是否真的发生，又已经把副本删了。D-10 规定“点下载就删”，但这里还是该把竞态收窄。
**Fix:** 延后回收（例如 `setTimeout(...,30000)`）；如果要保持“点下载就删”，至少在删除前不要依赖刚被回收的地址，并考虑在 toast 里提示“如果没有看到下载，请检查浏览器的下载提示”。

### WR-04: 退出登录对 `realtime.unsubscribe()` 没有超时，Phase 10 接上实时之后会卡死退出并让 `authQuiet` 一直为真

**File:** `us-journey-tracker.html:1011-1013`
**Issue:** `logout()` 先设 `authQuiet=true`，再 `await pb.realtime.unsubscribe()` 且没有超时。现在没有订阅所以立即返回，`logout.spec.ts:150-181` 的“服务器连不上也不会挡住退出”因此成立（但这条用例其实不发任何请求，见 IN-04）。Phase 10 订阅之后，`unsubscribe` 会向 `/api/realtime` 发请求，断网时没有应用侧超时，按钮会一直停在“正在退出…”，`loggingOut` 一直为真，`authQuiet` 一直为真，期间跨标签页登出被忽略。
**Fix:**
```js
try{await Promise.race([pb.realtime.unsubscribe(),new Promise(r=>setTimeout(r,3000))])}catch(e){}
```

### WR-05: `persist()` 忽略缓存写入失败，“修改仍在本机”的提示可能不是真的

**File:** `us-journey-tracker.html:592, 758, 889-892`
**Issue:** `cachePut` 在 localStorage 配额不足时返回 `false`，`persist()` 和 `settle` 都不看返回值。接近 4 MB 上限的大文档在 plan、state、snapshot 三份缓存同时存在时可能触顶。写入失败时：缓存里没有这次编辑，内存里的 `docs.state.dirty` 为真，上传若再失败，状态行说“保存失败：修改仍在本机，下次修改或重新打开时会再上传”，但刷新页面后这条修改既不在本机缓存也不在服务器上。`hasUnsaved()`/`unsentOf()` 看缓存的脏位，也会漏判。
**Fix:** `persist()` 检查 `cachePut` 的结果，失败时显示一条横幅（类似 `snapfail`：“本机空间不够，没能在本机保存这次修改”），并且不要再用“修改仍在本机”的文案。

### WR-06: 令牌过期（401）分支绕过 `resetSession()`，状态和界面残留，原始错误文字会漏到状态行

**File:** `us-journey-tracker.html:836`
**Issue:** `reconcile` 收到 `authRefresh` 的 401 时只做 `endRun; authStore.clear; me=null; docs={...}; showLogin(...)`。和 `logout`/其他标签页登出走的 `resetSession()` 相比：`sessionEpoch` 没加、`store` 还是 `cloudStore()`、内存里的 `state`（上一个账号的记录）、`compCat`、同步横幅、toast、`loggingOut` 等都没重置。之后只要有残留的 `flush`（例如先前的防抖计时器），`cloudSave` 会在 `docs.state.seq` 处抛 `TypeError`，`flush` 的 `catch` 把 `e.message` 原文写进状态行（“保存失败：Cannot read properties of null (reading 'seq')”）。在换账号登录（B）时这些残留内存状态也不是干净的，只是被随后的提交覆盖，没有结构性保证。另外 `authStore.clear()` 带着 `authQuiet` 只对本标签页安静，其他标签页会收到令牌清空事件并显示“已在另一个标签页退出登录”，把过期误报成登出。
**Fix:** 这条分支改成 `endRun(r);authQuiet=true;pb.authStore.clear();authQuiet=false;resetSession();showLogin("","expired");`（`resetSession` 不清缓存，符合“过期时保留本机修改”）；`flush` 的 `catch` 里对非 `e.state` 的异常用固定文案，不要显示 `e.message`。

### WR-07: “SYNC-05 clicks, keys and drags…” 的第 6、7 步在守卫失效时也会通过，用例没有证明标题声称的内容

**File:** `tests/cloud/reconcile-gate.spec.ts:187-213`（对应应用 `us-journey-tracker.html:593-595, 886, 896`）
**Issue:** 第 6、7 步给复盘框、抵达日期赋值并派发合成事件，然后推过防抖窗口、放行服务器，最后断言服务器没有写入、页面值等于种子。问题是即使 `gateGuard` 完全不存在也会得到同样结果：`persist()` 触发的 `flush()` 在门控期间直接 `return`（`data-gate`），不会上传；放行之后 `reconcileOnce` 用服务器数据整体替换 `state` 并重绘，篡改值被丢弃，`#review`、`#arrival` 被重置。所以这两步实际上没有守住“守卫拦下了合成事件”。（第 4 步 `.dragging` 为 0 和 `editorOpen` 的断言才真正依赖守卫，另一半靠的是 `disabled` 和 `openEditor` 里自带的门控判断。）
**Fix:** 在 `hold.release()` 之前断言门控期间本机缓存没有被弄脏：读 `usj:v2:<id>:state`，`dirty` 仍为 `false` 且 `seq` 等于进入前的值。守卫失效时 `persist()` 会把缓存写成 `dirty:true`，这条断言才会变红。

## Info

### IN-01: `SB_ORDER` 里的 `expired`、`remote` 没有任何地方设置

**File:** `us-journey-tracker.html:789`
**Issue:** 全文没有 `showBar("expired"`、`showBar("remote"` 调用，这两个键是死代码（可能为 Phase 10 预留）。
**Fix:** 删掉，或加一行注释说明预留给哪个阶段。

### IN-02: `strings.ts` 里有两个只定义、没人用的常量

**File:** `tests/support/strings.ts:283, 329`
**Issue:** `BOOT_SUB_LOADING` 和 `BTN_LOGGING_OUT` 没有任何 spec 引用，意味着“正在退出…”的中间态和等待卡片副标题的初始文案没有被任何用例断言。
**Fix:** 要么补断言（退出过程中按钮文字、禁用状态），要么删掉常量。

### IN-03: `tests/support/app.ts` 顶部的注释块贴错了位置

**File:** `tests/support/app.ts:9-15`
**Issue:** 第 9-13 行描述 `seedLocalStorageIfAbsent` 的注释，被后插入的 `installUsjConfig`（第 14-18 行）隔开，`seedLocalStorageIfAbsent` 反而没有头注释，`installUsjConfig` 上方挂着一段不相干的种子说明。
**Fix:** 把种子说明挪到 `seedLocalStorageIfAbsent` 上方。

### IN-04: 几条用例的标题强于它们实际证明的内容

**File:** `tests/cloud/logout.spec.ts:150-181, 361-388, 201-239`，`tests/cloud/guard-cloud.spec.ts:97`
**Issue:**
- “a double click on logout signs out once and an unreachable server does not block it”：当前没有订阅，`logout()` 根本不发请求，所以“服务器连不上不挡退出”的半句是空的（WR-04 说明了它将来才会成立或失败）。
- “logout during a save leaves no cache behind…”：即使 `cloudSave` 没有 `ep!==sessionEpoch` 检查，`docs` 已被重置为 `null`，`docs.state.base` 会抛 `TypeError` 而不是写缓存，用例同样通过，分不清是 epoch 守卫还是空引用在起作用。
- 跨标签页用例的“不会为旧账号写任何缓存”：`resetSession()` 清了计时器，再加上 `persist()` 受 `me` 保护、`flush` 在 `store` 为空时返回，三道保护里去掉任何一道仍然通过。
- `guard-cloud.spec.ts:97` 断言整条 console 文本逐字等于 `'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector'`，换 Edge 版本可能就变红；上面几处已经按 `ERR_BLOCKED_BY_CLIENT` 片段断言了。
**Fix:** 收窄标题，或补一个能区分保护层的断言（例如在保存应答之后直接断言 `usj:v2:*` 里没有 `dirty:false` 的新写入）；`guard-cloud` 那一行改成 `toContain('ERR_BLOCKED_BY_CLIENT')`。

### IN-05: `session.spec.ts` 同一用例里混用 `clock.install` 和 `setFixedTime`

**File:** `tests/cloud/session.spec.ts:96-100`
**Issue:** `tests/README.md` 第 153 行和 `test.ts` 注释都写着“同一个用例不混用 install 和 setFixedTime（D-15）”，这条用例先 `page.clock.install` 再 `setFixedTime(FROZEN_NOW + 91 天)`。目前能通过，但违反项目自己的约定，Playwright 版本一升就可能变化。
**Fix:** 改成不用 `install`（让 `frozenClock` 固定在 `FROZEN_NOW`，登录后用 `setFixedTime` 一次跳到 91 天后），或者在注释里写明为什么这里要例外。

### IN-06: 字体链接从应用里移除，传统路径（Claude Artifact）的标题字体也变了

**File:** `us-journey-tracker.html:16`（diff 里删掉了 Google Fonts 三行 link 和 `--serif` 里的 `"Noto Serif SC"`）
**Issue:** 删字体是 INFRA-03（cloud 页面只请求同源）的需要，但同一份文件也是传统路径用的，所以 Artifact 里的标题和数字字体会改成系统宋体回退。这和“四个视图的界面不变”的约束有细微出入。属于所有者决定范围，只是需要有意识地记录。
**Fix:** 在 09 的 SUMMARY/验证记录里写明这是接受的视觉变化；或者只在 `CLOUD` 为真时才去掉字体。

---

_Reviewed: 2026-11-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
