# Phase 10: 离线与实时同步（Offline & Realtime Sync） - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段只改云端路径（`USJ_CONFIG.backend = "pocketbase"`），交付五件事：

- **断网照常记录**：断网时照样能记录，修改先存本机，联网后自动上传；状态栏显示“离线”和待上传数量。
- **多设备几秒内同步**：同一账号在另一台设备上的修改几秒内出现在这台设备上，不打断正在写的草稿、打开的编辑框或获得焦点的输入框。
- **状态栏如实切换**：在已同步、保存中、离线、失败重试、登录过期五种状态之间切换。
- **保存失败不丢**：保存失败自动退避重试（修 B5），加载完成前的修改不丢（修 B3）。
- **登录过期不丢**：登录过期时本机修改保留，重新登录后继续上传。

需求：ACCT-05、SYNC-02、SYNC-03、SYNC-04、SYNC-06。

**不在本阶段：**
- 断网时首次打开页面（Service Worker 和 manifest），在 Phase 13；
- logs 按 id 合并（SYNC-F1）；
- 导出、导入和迁移，在 Phase 11；
- 编辑计划页，在 Phase 12；
- 旧路径（Claude、localStorage）上 B3 和 B5 的修复，见 `tests/KNOWN-BUGS.md`。

</domain>

<decisions>
## Implementation Decisions

### 沿用的决定（来自路线图、调研和前几个阶段，本次不再讨论）

- **冲突策略：** 整份文档最后保存的为准，加三项保护：
  - 联网打开时，对账完成前禁止编辑；
  - 上传前比对基线 `updated`；
  - 真冲突时，被覆盖的版本在本机留底，可以下载（09-CONTEXT D-08 到 D-11：只留 1 份，下载即删，退出时清掉）。
- **比较新旧：** 一律用服务器签发的 `updated`，不用客户端时钟。
- **以后再做：** logs 按 id 合并（SYNC-F1）。
- **回声抑制：** 用每次写入的 `writer` 标记，订阅回调里 `writer` 等于自己就忽略（ARCHITECTURE §Q2）。
- **实时：** PocketBase SSE。实时断线期间错过的事件不补发，所以每次 `PB_CONNECT`（包括重连）都整份对账一次。
- **兜底拉取（06-PROBE-RESULTS“给 Phase 10 的输入”）：**
  - 页面可见时每 60 秒拉一次；
  - 页面重新可见、`online` 事件、`PB_CONNECT`、重试定时器到期时，立即对账；
  - 请求尽量合并，因为国内到香港往返约 300–400 毫秒；
  - 拉取是基线，实时只是加速。
- **远端更新的应用顺序：**
  - 先挂起，空闲时再应用；先 plan 后 state；
  - 应用时界面游标保持不变：`wk`、`sel`、`view`、`filter`。
- **界面：** 状态栏五种状态的文字、横幅优先级、远端更新的横幅和 toast，全部逐字沿用 `09-UI-SPEC.md` 的 S2、S4、S5、S6，不另做 UI 设计契约。
  - Phase 9 的临时状态 `savefailed` 由 `retrying` 取代。
- **本机缓存：** 沿用 Phase 9 的键和格式，`usj:v2:<id>:state` 和 `:plan`，值为 `{ id, base, dirty, seq, data }`，可以加字段。
  - 上传成功时只有 `seq` 没变才清 `dirty`。
  - 保存失败不清脏标记（修 B5）。
- **登录过期的判断：** 只看 `authRefresh` 返回 401（或本地令牌的 `exp`），记录接口对失效令牌返回 200 空列表、404 或 400（PB-CONTRACT §9）。
- **测试：**
  - 全部在假服务器上做，多设备用独立浏览器上下文；
  - 断网、5xx、超时、丢应答、SSE 断开都用假服务器的开关制造。`context.setOffline` 只改浏览器的在线状态，管不到假服务器（PROBE-9）；
  - 只用合成数据，不连真实服务器。

### 打开应用时连不上服务器

- **D-01:** 打开应用时连不上服务器、但本机有缓存时，放开编辑，按离线处理。修改先存本机，联网后自动上传。
  - 所有者知道这样做的风险：缓存已经旧了（例如手机几天没开）时，联网后会以本机这份为准整份上传，别的设备那几天的修改只剩本机的一份留底。
  - 这取代 09-CONTEXT D-03 的“有缓存也只读”。D-03 当时就写明 Phase 10 再升级。
  - 没有缓存时（这台设备第一次登录），仍按 Phase 9 显示“连不上服务器”和“重试”，因为没有内容可显示、可编辑。
  - **Reversibility:** reversible — 只涉及启动对账失败后的分支。
- **D-02:** 什么时候转入“离线也能记”：
  - 浏览器明确显示断网（`navigator.onLine === false`）时，打开就进入离线可编辑，不等对账超时；
  - 浏览器显示联网时，仍先对账：约 3 秒显示“网络较慢”，约 15 秒还没完成才转为离线可编辑（09-CONTEXT D-02 的节奏不变）。
  - 转为离线后，状态栏用契约里的 `offline` 状态，后台自动重试对账。
- **D-03:** 离线记录后重新联网，如果发现服务器上有另一台设备更新的修改（本机脏、服务器 `updated` 比基线新，即真冲突），照 Phase 9 已定的规则处理：
  - 以本机这份为准上传；
  - 被覆盖的服务器版本在本机留底，并弹冲突提示，带下载入口。
  - 不改为服务器优先，也不新增让用户选择的对话框。

### 远端更新遇上正在写的内容

- **D-04:** 远端更新挂起期间，如果用户在这台设备上完成了一个结束忙碌状态的操作，先应用挂起的远端更新，再在新数据上重做这一个本机操作，然后上传。两边的修改都保留，不触发真冲突。
  - 这类操作包括：发出草稿（记一笔）、在编辑弹窗里保存或删除、写复盘（停笔防抖到期）、保存力量值、修改开始日期。
  - 只重做结束忙碌的那一个操作，不是通用的合并。
  - 重做按 id 或键定位目标（记录 id、复盘的周、力量项名、任务 id），不能沿用旧 `state` 里的对象引用。
  - 同一条目两边都改了时，以本机这次操作为准（条目级别最后写入为准）；其他条目照常保留远端的修改。
  - 没有本机操作就结束的忙碌（关闭编辑框、清空草稿、离开输入框），直接应用远端更新。
  - **Reversibility:** costly — 每个结束忙碌的操作处理函数都要改成“先应用远端、再按 id 重做”，牵涉的调用点较多。
- **D-05:** 点横幅上的“现在更新”时，保留草稿：
  - 两个 composer 的草稿文字和选中的类别都保留；
  - 可以复用现有的 `refresh()`，它重绘 composer 时保留文字。
  - 编辑弹窗是模态的，开着时点不到横幅，所以这一条只涉及草稿和输入框。
- **D-06:** 编辑弹窗里正在改的记录在另一台设备上被删了时，用户点“保存”，就按编辑框里的内容把这条记录加回来（id 不变），并弹提示说明它在另一台设备上被删除过。
  - 提示文案按 09-UI-SPEC 的语气新写一条，例如“这条记录在另一台设备上被删除，已按你的修改重新加回”，最终文字由规划确定。
  - 用户点的是“删除”时，结果就是删除，不需要提示。

### 待上传数量

- **D-07:** 状态栏 `离线，{n} 项修改已存在本机，联网后自动上传` 里的 `{n}`，按自上次上传成功以来改动过的条目去重计数：
  - 每条记录（按记录 id）、每个任务的进度（按任务 id）、每周的复盘（按周）、每个力量项、每个自定义待办、每个预设标签、开始日期，各算 1 项；
  - 同一条目改几次都只算 1 项；勾选后又取消、删除后撤销，也算 1 项；
  - 上传成功后归零。
  - 改动过的条目集合要写进本机缓存，断网期间刷新页面后数量照旧（成功标准 1）。
  - 不和上次上传的版本逐项比较，因为那要在本机多存一份整份文档，接近容量上限时会存不下。
  - **Reversibility:** costly — 每个调用 `persist()` 的地方都要报告改动了哪个条目。

### Claude's Discretion

所有者没有选择讨论“用着用着断网、服务器出错或登录过期”，以下由规划按此执行，可以微调：

- **断网和服务器出错时照常能记：** 修改存在本机，自动重试一直进行、不放弃，间隔逐步拉长（例如 1、2、5、10、30 秒），最长 60 秒；状态行带“立即重试”按钮（契约 `retrying`）。
- **两种状态怎么区分：**
  - 请求没到达服务器（网络错误、浏览器断网），显示 `offline`；
  - 服务器回了错误（5xx）或请求超时，显示 `retrying`；
  - 具体判定规则由规划定。
  - 4xx 中的容量超限继续走 Phase 9 的 `toolarge`，不重试。
- **WR-02（09-REVIEW）：** `cloudSave` 加超时和中止（可参考 Phase 9 的 15 秒）；`resetSession` 复位 `saving`；保存卡住时不能看不到失败提示。
- **WR-01（09-REVIEW）：** 写入方 id 改为每个标签页一个、刷新后不变（例如存在 `sessionStorage`）。同一浏览器的两个标签页仍要互相同步，不能共用 id；还要处理“复制标签页”会复制 `sessionStorage` 的情况。
- **用着用着登录过期：**
  - 检测：保存或读取失败后调用 `authRefresh`，返回 401 就算过期；
  - 过期后仍可继续记，修改存在本机；状态行和横幅用契约的 `expired`；
  - 点“重新登录”进入 Phase 9 的登录页，邮箱预填；
  - 同一账号重新登录后对账，并上传过期期间的修改（成功标准 5）；
  - 换账号走 Phase 9 的换账号确认。
- **重连时的对账：** 重连、回到前台、重新联网时不重新加门控。服务器上的新内容作为远端更新进入，用户忙时挂起；本机有脏数据就带冲突检查上传。
- **上传等待期间到达的远端更新：** 本机刚改完、还在防抖或上传中（在线状态）时远端更新到达，如果还没上传的本机操作能按 D-04 的方式重做，就同样先应用远端再重做；做不到时退回已锁定的整份覆盖加留底。离线重连按 D-03。
- **同一浏览器两个标签页同时离线：** 两个标签页写的是同一个缓存。规划可以用 `storage` 事件让两个标签页的本机数据保持一致；代价太大时就写进已知限制。
- **数量的显示位置：** 只在 `offline` 状态行里显示数量（契约如此）；`saving` 和 `retrying` 不显示数量。
- **实时订阅：** 是否只订阅元数据字段（`fields`）、`PB_CONNECT` 之后什么时候对账、订阅和首次读取的先后，交给阶段调研和规划。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段范围与需求
- `.planning/ROADMAP.md` §Phase 10：目标、5 条成功标准、调研问题、Notes（先离线后实时；拉取是基线；冲突仍整份最后保存为准）
- `.planning/REQUIREMENTS.md`：ACCT-05、SYNC-02、SYNC-03、SYNC-04、SYNC-06 的原文

### 上一阶段的决定与界面契约
- `.planning/phases/09-login-cloud-storage/09-CONTEXT.md`：
  - D-01 到 D-04：对账门控和超时；本阶段的 D-01 取代其中的 D-03；
  - D-08 到 D-11：冲突留底；
  - Claude's Discretion：登录过期后的缓存。
- `.planning/phases/09-login-cloud-storage/09-UI-SPEC.md`，必须逐字沿用：
  - §S2 状态栏和“状态文案总表”：五种状态的文字、横幅优先级、`{n}` 和 `{s}` 的规则；
  - §S4 横幅组件；
  - §S5 提示；
  - §S6 远端更新提示。
- `.planning/phases/09-login-cloud-storage/09-REVIEW.md` 和 `09-REVIEW-DISPOSITION.md`：WR-01（写入方 id）和 WR-02（保存没有超时、`saving` 不复位），本阶段处理。
- `.planning/phases/09-login-cloud-storage/09-SECURITY.md`：T-09-36 和 AR-02，先读后写之间的空窗；实时同步应进一步缩小这个空窗。

### 调研与实测
- `.planning/research/ARCHITECTURE.md`：
  - §Q2“订阅与回声抑制”“把远端合并进全局 state”：`writer`、`isBusy`、挂起再应用；
  - §Q3“脏位，不是队列”“重连检测”“对账表”。
  - §Q3 写的“约 3 秒超时就放开编辑”，以本文件 D-02 为准：明确断网时立即放开，联网时约 15 秒才放开。§Q2 里“写入方 id 每次页面加载一个”的写法，按 WR-01 改成每个标签页一个、刷新不变。
- `.planning/research/PITFALLS.md`：B5（保存前清脏标记）、离线队列、实时断线补拉的相关条目。
- `.planning/phases/06-procurement-reachability-probe/06-PROBE-RESULTS.md` §“给 Phase 10 的输入”：60 秒兜底拉取、断开后必然补拉、请求合并。

### 协议、假服务器与测试约定
- `tests/mocks/PB-CONTRACT.md`：
  - §6 实时的线上格式；
  - §9 给后续阶段的输入：失效令牌的表现、`authRefresh` 返回 401；
  - §10 错误注入开关。
- `tests/mocks/pb-server.ts`：假服务器，错误注入模式有 `refuse`、`status`、`hold`、`lose-answer`，`emit()` 推实时事件。
- `tests/PROBES.md`：PROBE-9，`setOffline` 管不到假服务器。
- `tests/KNOWN-BUGS.md`：B3、B5 的登记；本阶段修复云端路径，旧路径保持现状。
- `.planning/codebase/CONCERNS.md`：B5 的成因，`flush` 在保存前清 `dirty`。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `persist()` 和 `flush()`（`us-journey-tracker.html:596-604`）：
  - 云端路径已经在 `persist` 里增加 `docs.state.seq`、置 `dirty` 并写缓存；
  - `flush` 在 `await` 之前就把内存里的 `dirty` 清掉（B5 的根源）；对账门控期间 `flush` 直接返回。
- `cloudSave()`（`us-journey-tracker.html:988`）：
  - 已有保存前 `getOne` 比对基线、真冲突留底（`keepConflict`）、`sessionEpoch` 防止迟到的应答写错账号；
  - 没有超时，失败统一抛 `savefailed`。
- 对账：`startReconcile`、`reconcileOnce`、`enterApp`（`:842-940`）实现了 Phase 9 的对账表，以及 3 秒、15 秒、手动重试（`SLOW_MS`、`FAIL_MS`、`RETRY_MS` 在 `:826`）。重连、回到前台、重新联网可以复用这套对账。
- 门控：`applyGate`、`setGate`（`:789-795`）和 `body[data-gate]`。D-01 转离线时要放开门控。
- 横幅：`showBar`、`hideBar`、`drawBar`，按优先级一次只显示一条（`:815-824`）；Phase 9 已经登记了 `remote` 等键。
- 状态行：`setStatus(text, state)`（`:605`），写 `data-state`。
- 缓存：`cacheGet`、`cachePut`、`dropCache`、`cacheNote`（`:772-779`）；`canon()`（`:784`）用于比较内容是否相同。
- 留底：`keepConflict`、`snapGet`、`conflictNotice`（`:938-946`）。
- composer 的 `refresh()`（`:1120`）重绘时保留草稿文字，D-05 可以复用。
- 判断有没有未上传的修改：`hasUnsent()`（`:672`）和 `hasUnsaved()`（`:1033`）。
- 退出流程已经调用 `pb.realtime.unsubscribe`（`:1064`），D-06 的“先退订”顺序已就位。

### Established Patterns
- 处理函数直接改全局 `state`，然后调用 `persist()` 和 `renderAll()`。D-04 的重做和 D-07 的条目计数都要在这条路径上加钩子。
- `WRITER=uid()` 在 `:632`，每次加载页面都重新生成，见 WR-01。
- 每次 `await` 之后都检查 `sessionEpoch`；新加的异步路径（订阅回调、重试定时器、拉取）也要遵守。
- 界面文字集中成常量（如 `T_CF_OUT`），用例从 `tests/support/strings.ts` 读取。

### Integration Points
- 现在没有 `online` 监听和实时订阅，可见性变化也只在 `pagehide` 时做 `flush`。本阶段新增订阅、`online` 和 `visibilitychange` 处理以及 60 秒拉取，都要汇到同一个对账入口。
- cloud 用例在 `tests/cloud/` 下，已有 `multi-device.spec.ts`、`conflict-snapshot.spec.ts`、`pb-faults.spec.ts`、`session.spec.ts`、`reconcile-gate.spec.ts`。多设备用 `tests/support/devices.ts` 的 `openDevice`。
- 应用的 sha256 基线（`APP_SHA256`）要随应用改动有意识地更新。

</code_context>

<specifics>
## Specific Ideas

- 典型场景是一个人用手机和电脑两台设备，而且在国内连香港服务器可能不稳。所有者更看重“随时能记一笔”，愿意承担缓存过期时整份覆盖的风险，因为有留底兜底。
- “现在更新”不能让正在写的字丢掉。
- 正在编辑的记录在别处被删时，宁可加回来，也不要丢掉用户刚写的内容。

</specifics>

<deferred>
## Deferred Ideas

- **离线重连也改成重做本机操作：** 离线重连时，用“先应用远端、再重做本机离线期间的操作”代替整份覆盖，这样离线期间两台设备的修改都能保留。和 SYNC-F1（logs 按 id 合并）有关，留到以后。本阶段按 D-03 整份覆盖加留底。
- **断网冷启动：** 断网时首次打开页面（Service Worker 和 manifest），已排在 Phase 13。

</deferred>

---

*Phase: 10-offline-realtime-sync*
*Context gathered: 2026-11-10*
