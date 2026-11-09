---
phase: 09-login-cloud-storage
reviewed: 2026-11-09T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - .gitignore
  - PRIVACY.md
  - tests/README.md
  - tests/cloud/account-data.spec.ts
  - tests/cloud/capacity.spec.ts
  - tests/cloud/conflict-snapshot.spec.ts
  - tests/cloud/logout.spec.ts
  - tests/cloud/pb-faults.spec.ts
  - tests/cloud/reconcile-gate.spec.ts
  - tests/cloud/same-origin.spec.ts
  - tests/cloud/session.spec.ts
  - tests/e2e/calendar/day-panel.spec.ts
  - tests/e2e/data/synthetic-data.spec.ts
  - tests/e2e/platform/repo-hygiene.spec.ts
  - tests/e2e/week/week-view.spec.ts
  - tests/mocks/PB-CONTRACT.md
  - tests/mocks/pb-server.ts
  - tests/support/constants.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/strings.ts
  - tools/privacy/privacy-check.mjs
  - us-journey-tracker.html
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 9: Code Review Report（复审）

**Reviewed:** 2026-11-09
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

这是对 7ec0409 之后改动的复审：上一轮审查修复（CR-01、CR-02、WR-01 到 WR-07）、两处安全修复（T-09-18 保存路径先静默留底、T-09-21 启动对账先做容量检查）、四处 UI 的 CSS 修复，以及把应用改名为“计划手记”并把“抵达”改成“开始日期”。没有 structural findings，也没有 external reviewer evidence。全程只读静态审查，没有运行测试。

**上一轮 9 条（2 个 BLOCKER、7 个 WARNING）在代码里都已核实修好，不再重复报告：**

- CR-01：`onLogoutClick` 现在用 `unsentOf(me)` 读共用缓存里的脏位和留底，另一个标签页没上传的修改会触发确认框（行 1077 附近），对应用例也改成了断言“先问”。
- CR-02：`keepOrphans` 在计划回落时让 `normalize` 保留格式合格的进度键；不合格的计划按服务器原样缓存，不会把回落计划写成“干净缓存”。`resetSession` 清掉该标志，传统路径从不置位。
- WR-01：保存路径和对账路径都加了 `writer` 与 `canon` 判断，通知挪到上传成功之后；留底先静默写，T-09-18 把“上传可能到达服务器但答复丢失”的情况也盖住了。
- WR-02：`onAuthChange` 的注册移进了 `startPb()`。
- WR-03：回收下载地址的延迟改为 30 秒。
- WR-04：退订加了 3 秒上限。
- WR-05：`persist()` 看 `cachePut` 的结果，写失败时有横幅和不同的状态行文案。
- WR-06：401 分支走 `resetSession()`；过期标记键让其他标签页能区分过期和退出。
- WR-07：门控用例在放行前断言缓存原样不变。

其他核实结果：

- `APP_SHA256` 与应用文件当前内容的 sha256 一致。
- 改名后应用里不再有“美国”“抵达”“出发”字样（只剩测试注释里的历史说法）。
- 隐私：范围内没有新的绝对路径、域名、IP、邮箱或密钥。`.gitignore`、`PRIVACY.md`、`privacy-check.mjs` 三处对新旧导出文件名前缀保持一致，并且都有正反例用例。
- XSS：新增的 `cf-who` 只是给已经用 `textContent` 写入的段落加 class；新横幅文案走 `drawBar` 的 `textContent`。
- CSS：`.toast[data-cloud]` 的 `width:max-content` 配合 `left:50%` 加 `translateX(-50%)`，宽度上限是 `100vw - 32px`，居中时不会溢出。

没有 BLOCKER。剩下的是两条 WARNING（都是边界情况下的体验或健壮性问题，不丢数据）和几条 INFO。上一轮的 IN-01、IN-02（`BOOT_SUB_LOADING`）、IN-05 没有被改动，仍然存在，见下面的 IN-03。

## Warnings

### WR-01: 重新打开页面之后，自己上一次页面的写入会被当成“另一台设备”，并替换掉可能真正有用的留底

**File:** `us-journey-tracker.html:632, 907`（对照 `996`）
**Issue:** 上一轮修复用 `sv.writer!==WRITER` 区分“自己的写入”和“别的设备”，但 `WRITER=uid()` 每次页面加载都重新生成。同一个标签页刷新、或手机上浏览器把页面丢掉再恢复之后，服务器版本的 `writer` 是上一次加载的值，对不上。触发路径：保存在服务器上成功但答复丢了（手机弱网很常见），用户接着又改了一笔（还没上传），然后刷新。启动对账看到：缓存是脏的、`c.base!==sv.updated`、`sv.writer` 不等于新的 `WRITER`、内容不同，于是判成冲突：把自己上一次的上传当作“另一台设备的版本”写进唯一的留底，弹出“另一台设备上的修改被覆盖”的提示，并给出下载入口。唯一的留底副本会因此被替换，如果里面原来是真正的别的设备留底且还没下载，它就丢了。内容上没有数据丢失（留底的内容是本机内容的子集），但提示是错的，而且 D-09 只留一份，所以会冲掉真留底。
**Fix:** 让 `writer` 在同一个标签页的重新加载之间保持不变，同时不同标签页仍然不同：
```js
const WRITER=(()=>{try{let w=sessionStorage.getItem("usj:v2:writer");if(!w){w=uid();sessionStorage.setItem("usj:v2:writer",w)}return w}catch(e){return uid()}})();
```
（`sessionStorage` 在同一标签页的刷新中保留，新标签页是空的。）补一条用例：保存答复丢失，再改一笔，刷新，断言没有留底、没有“已被覆盖”提示。

### WR-02: 云端保存没有超时，一个挂住的 PATCH 会让后面的保存全部排队，`resetSession()` 也不重置 `saving`

**File:** `us-journey-tracker.html:597-604, 988-1008, 1039-1058`
**Issue:** `flush()` 用 `saving` 标志保证同时只有一个保存。`cloudSave` 里的 `getOne` 和 `update` 没有任何应用侧超时或中止信号（对账有 `AbortController`，保存没有）。网络半断（请求发出去、连接不报错也不回应）时，请求一直挂到浏览器自己的超时，`saving` 一直为真：之后所有修改只写进缓存、状态行停在上一个状态，没有“保存失败”，也不会重试。`resetSession()` 里重置了 `dirty`、`savePending`，却没有重置 `saving`；退出再换账号登录时，新账号的修改要等旧账号挂住的请求结束才会上传。修改没有丢（缓存里是脏的，请求结束后 `flush` 会递归继续），但用户会在一段时间里看不到任何失败提示。Phase 10 的 SYNC-06 自动重试大概会处理，但目前没有任何保护，也没有注释说明这是留给后面的。
**Fix:** 给 `cloudSave` 的两个请求加上中止信号和超时（例如 `FAIL_MS`），超时按保存失败处理：
```js
const ctrl=new AbortController(),tm=setTimeout(()=>ctrl.abort(),FAIL_MS);
try{ cur=await coll.getOne(id,{signal:ctrl.signal}); … r=await coll.update(id,body,{signal:ctrl.signal}) } finally{clearTimeout(tm)}
```
并在 `resetSession()` 里让旧的保存按 `sessionEpoch` 失效后重置 `saving=false`（旧请求返回时 `ep!==sessionEpoch` 已经不会碰页面）。如果这条按计划留给 Phase 10，请在代码或 `PROBES.md` 里写明。

## Info

### IN-01: 对账里先弹“已被覆盖”的 toast，随后可能被“已更新为其他设备上的最新内容”替换掉

**File:** `us-journey-tracker.html:907-911, 934`
**Issue:** 计划是脏缓存且和服务器冲突（`conflictNotice` 弹出带“下载留底”的 toast），同时状态文档是干净缓存、服务器更新（`changed` 为真）时，`toast()` 只有一个节点，后弹的“已更新为其他设备上的最新内容”会替换前一条，带下载入口的提示消失。留底本身还在、`#snapshotBtn` 也会显示，所以只是提示丢了。条件很窄（需要同时两种情形），后续阶段有计划编辑之后才可能出现。
**Fix:** `changed` 的提示在 `snapGet()` 存在且刚刚弹过冲突提示时不再弹，或者两句合并成一条。

### IN-02: `cloudSave` 里的 `cur` 声明在 try 外面但只在 try 里用

**File:** `us-journey-tracker.html:990`
**Issue:** `let r,cur;` 里的 `cur` 没有在 try 之外使用，是 T-09-18 修改后留下的多余提升。
**Fix:** 把 `cur` 改回 `const cur=await …`，放在 try 里面。

### IN-03: 上一轮未处理的 INFO 仍然存在

**File:** `us-journey-tracker.html:814`（`SB_ORDER` 里的 `"expired"`、`"remote"`），`tests/support/strings.ts:305`（`BOOT_SUB_LOADING`），`tests/cloud/session.spec.ts:96-100`、README 的“不混用 install 和 setFixedTime”约定
**Issue:** 这三项在 diff 里没有变化：`showBar("expired"…)`、`showBar("remote"…)` 仍然没有调用点；`BOOT_SUB_LOADING` 仍然没有任何用例引用；`session.spec.ts` 同一条用例里仍然先 `clock.install` 再 `setFixedTime`。上一轮这几条本来就是 INFO，未修属于预期，这里只做记录。
**Fix:** 同上一轮：删掉或写明预留给哪个阶段；补断言或删常量；改用同一种时钟方式。

### IN-04: 对账里“超限且服务器文档已被删除”的情况下，之后每次保存都读不到记录，直到重新打开

**File:** `us-journey-tracker.html:898-900, 921-926`
**Issue:** 这种情况下 `held` 返回的 `docs.state.id` 是缓存里旧的记录 id，但服务器上已经没有这条记录。用户把数据删到容量以内之后，`cloudSave` 的 `getOne` 会得到 404，一直报“保存失败：修改仍在本机，下次修改或重新打开时会再上传”。文案本身是准确的（重新打开会走“没有服务器文档就用缓存创建”的分支），所以不丢数据，只是在重新打开之前一直保存不上。条件很窄（管理员删了文档，同时本机缓存超限）。
**Fix:** 可以接受并写进注释；或者在 `cloudSave` 收到 404 时重新触发一次对账。

### IN-05: 过期标记键没有失效时间

**File:** `us-journey-tracker.html:651-654, 765`
**Issue:** `usj:v2:authExpired` 只在下一次登录成功时删除。如果用户在发现过期后既不再登录、也有另一个标签页之后因为别的原因清了令牌（例如另一个标签页走了“换账号选不换”分支，令牌被安静清掉，但这时没有别的标签页在等通知），该标记一直留着，不会造成错误显示（它只在令牌被清且标签页有 `me` 时才被读），所以影响只是理论上的。写在这里是为了记录这个“只靠成功登录清理”的隐含约定。
**Fix:** 不需要改动；如果以后加了别的清令牌路径（例如 Phase 10 的服务器端踢出），记得同时处理标记。

---

_Reviewed: 2026-11-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
