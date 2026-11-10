---
phase: "10"
slug: "offline-realtime-sync"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-10"
---

# Phase 10 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只在本机的假 PocketBase 上测试，不连接任何真实服务器。判断依据：
- 9 份计划的 `<threat_model>` 威胁登记（计划阶段写好，`register_authored_at_plan_time: true`）；
- 各 SUMMARY 的 Threat Flags 和执行记录；
- 编排者在 HEAD bc53620 上对应用 `us-journey-tracker.html`（最后一次改动在 098bcb0）和测试源码的逐条 grep 核对（ASVS L1 深度）；
- 10-09 在 098bcb0 之后跑完的完整套件：`npm run test:cloud` 152 条、默认 `npm test` 176 条全部通过（之后只改了文档）。

ASVS L1、计划阶段已有登记、核对后没有未关闭的威胁，按 secure-phase 流程的短路规则直接写本文件，没有另派审计代理。
本阶段没有改动 `package.json`、`package-lock.json` 或 Playwright 配置（`git diff 8d98f8c..HEAD` 为空）。

本文件不含服务器地址、域名、邮箱、口令或令牌。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 浏览器 → 同源 PocketBase（列表、创建、更新、authRefresh） | 离线修改在联网后整份上传；令牌失效只看 authRefresh 的 401 | 账号的 state 和 plan 文档、令牌 |
| PocketBase 实时（SSE）→ 页面 | 事件只用来触发一次经过鉴权的列表读取，内容不进入 state | 记录的 id、kind、writer、updated |
| 远端文档 → 工作 state → DOM | 远端版本先进挂起槽，空闲时经 normalize 并入；渲染沿用 `esc()`，横幅和提示用 textContent | 记录文字、计划 |
| 同一浏览器的另一个标签页 → 本页（storage 事件） | 只处理本账号、文档 id 相同的 state 记录；内容只进挂起槽 | 本机缓存里的 state 记录 |
| 本机缓存（localStorage、sessionStorage）→ 页面 | 待上传的修改、touched 集合、写入方 id | 本账号的未上传修改 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-10-01 | Tampering | 云端保存的脏标记（B5） | high | mitigate | 单线程 `requestSync`/`syncOnce`，只在上传成功且 seq 没变时清 dirty 和 `touched`；失败保留并按 `RETRY_STEPS=[1,2,5,10,30,60]` 退避；offline-sync 用例覆盖 | closed |
| T-10-02 | Denial of Service | 挂住的保存请求（WR-02） | medium | mitigate | `SYNC_MS` 超时加 `AbortController` 中止，转 retrying；`resetSession` 复位 `saving=false` 和定时器；hold 用例覆盖 | closed |
| T-10-03 | Denial of Service | 自动重试对服务器的压力 | low | mitigate | 单线程合并请求，退避封顶 60 秒；用例断言间隔 | closed |
| T-10-04 | Repudiation | 缓存写不进去时状态行仍说“已存在本机” | medium | mitigate | `cacheFull` 时改用 `T_NOCACHE` 那句；capacity 用例断言 | closed |
| T-10-05 | Tampering | 上传覆盖别的设备的新版本 | medium | mitigate | 上传前比对基线 updated，真冲突静默 `keepConflict` 留底、上传成功后提示 | closed |
| T-10-06 | Tampering | 假服务器的新开关被当成真实契约 | medium | mitigate | PB-CONTRACT §10 每行标明“测试设施，没有录制样本”；`INTENTIONAL_DEVIATIONS` 仍为空数组；契约自测照跑 | closed |
| T-10-07 | Information Disclosure | 用例输出里出现合成口令或令牌 | low | mitigate | 新用例只用假服务器的合成账号，不打印口令和令牌；每次提交前隐私检查通过 | closed |
| T-10-08 | Tampering | 过期缓存离线编辑后整份覆盖别的设备（D-01） | medium | accept | 所有者在 D-01 接受；被覆盖的版本按 D-03 留底并提示，见 AR-01 | closed |
| T-10-09 | Spoofing | 离线可编辑期间令牌已失效 | medium | mitigate | 第一次后台同步先 authRefresh（`needRefresh`），401 走过期处理且不清缓存（`checkAuth`、`goExpired`） | closed |
| T-10-10 | Tampering | `commit` 重构改变旧路径行为 | high | mitigate | run 按 id 定位；10-04 与 10-09 的完整默认套件 176 条通过 | closed |
| T-10-11 | Tampering | 本机缓存里的 touched 被篡改 | low | accept | touched 只影响状态行的数字，不参与上传和冲突判断，见 AR-02 | closed |
| T-10-12 | Spoofing | 依据空列表或 404 误判（PB-CONTRACT §9） | high | mitigate | 空列表、404 和非 413/429 的 4xx 一律先 `checkAuth`；只有 authRefresh 401 或本地 exp 才 `goExpired`；令牌有效才重建文档 | closed |
| T-10-13 | Tampering | 登录过期时丢掉本机修改 | high | mitigate | `goExpired` 不清 state、缓存、touched、ops、留底；session 用例断言过期后仍可记、同账号重新登录后上传 | closed |
| T-10-14 | Denial of Service | 过期后仍不停发请求 | low | mitigate | `net==="expired"` 时 `requestSync` 直接返回；用例断言 60 秒内没有新请求 | closed |
| T-10-15 | Spoofing | 复制标签页共用写入方 id，对方写入被当成回声 | medium | mitigate | `sessionStorage` 的 `usj:v2:writer` 加 `BroadcastChannel` 占用声明，重复时重新生成；writer-id 用例 | closed |
| T-10-16 | Repudiation | 刷新后把自己的写入误判为另一台设备（WR-01） | medium | mitigate | 写入方 id 刷新不变；用例覆盖答复丢失后刷新不再误留底 | closed |
| T-10-17 | Tampering | 远端数据里的恶意字符串（XSS） | high | mitigate | 远端 state 和 plan 经 `normalize`、`normalizePlan`；渲染沿用 `esc()`；横幅和提示只用 textContent | closed |
| T-10-18 | Tampering | 远端更新冲掉草稿或编辑框里的输入 | medium | mitigate | 远端版本留在 `pendRemote`，空闲、现在更新或 D-04 操作时才经 `takeRemote` 并入；`isBusy` 覆盖弹窗、草稿、输入框焦点；remote-update 用例 | closed |
| T-10-19 | Tampering | 执行本机操作时改错条目 | medium | mitigate | run 只按 id 或键在传入的 state 上定位；用例断言两边修改都保留 | closed |
| T-10-20 | Tampering | 在线晚一步保存时覆盖别的设备 | medium | mitigate | `opsOk` 为真时 `rebaseState` 以挂起槽里的服务器版本为底重做；任何一步离线失败后为假，退回 D-03 留底；四条用例 | closed |
| T-10-21 | Information Disclosure | 收到别的账号的事件 | high | mitigate | 服务器规则只投递本人记录（Phase 8 隔离 48/48）；`onDocEvent` 不信任事件内容，只触发经过鉴权的列表读取 | closed |
| T-10-22 | Spoofing | 同账号客户端伪造 writer，让某个标签页忽略更新 | low | accept | 只有同一账号能写 writer；被忽略的更新仍由 60 秒拉取和 PB_CONNECT 对账补上，见 AR-03 | closed |
| T-10-23 | Tampering | 重复订阅导致一个事件处理两次 | low | mitigate | `ensureRealtime` 只在 rt 为 off 时订阅；首次失败先退订；`stopRealtime` 在会话重置时退订；回声用例断言恰好一次列表请求 | closed |
| T-10-24 | Denial of Service | 断线重连时的请求风暴 | low | mitigate | SDK 重连间隔封顶 2 秒；每次 PB_CONNECT 只经单线程 `requestSync` 合并成一次对账 | closed |
| T-10-25 | Repudiation | 断线期间的修改被漏掉 | medium | mitigate | `onPbConnect` 整份对账、`onDisconnect` 标记连接中，另有 60 秒拉取；realtime-sync 用例覆盖重连后补上断开期间的修改 | closed |
| T-10-26 | Repudiation | 带下载入口的冲突提示被“已更新”提示替换（IN-01） | low | mitigate | `cfShown`：同一次同步或启动对账弹过冲突提示就不弹“已更新”；去掉检查后用例失败（10-03 的变异核对） | closed |
| T-10-27 | Tampering | 重做时再次执行服务器已收到的操作（检查器 blocker） | high | mitigate | 上传时记下 `sentOps`，成功后 `ops.splice(0,sentOps)` 只移除已上传的前缀；所有 run 幂等 | closed |
| T-10-28 | Tampering | 重放造成同 id 重复记录、勾选被翻转、已上传的修改盖掉之后的远端修改（检查器 blocker） | high | mitigate | 同 T-10-27；remote-update 用例“上传途中又记的一笔只重做自己”“超时但已送达的一批不重复”断言 id 不重复、七类条目无重复项 | closed |
| T-10-29 | Information Disclosure | 文档里写进服务器地址、域名或真实数据 | medium | mitigate | tests/README.md、KNOWN-BUGS.md 只写合成示例和开关名；暂存后隐私检查通过 | closed |
| T-10-30 | Tampering | 两个标签页离线时互相覆盖缓存，关掉一页后丢修改 | medium | mitigate | storage 事件交给 `adoptTab`：另一页的记录进挂起槽、叠加本页剩余 ops、内容不同才写回；两标签页用例 | closed |
| T-10-31 | Tampering | 另一页写入的缓存未经校验进入本页 | low | mitigate | 采纳的内容只进挂起槽，并入时经 `normUnder`/`docAfter` 的 normalize；只处理本账号、id 相同的记录 | closed |
| T-10-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本阶段没有安装或下载任何包，依赖文件无改动，见 AR-04 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-10-08 | 打开应用时连不上服务器也允许离线编辑；缓存已旧时联网后以本机为准整份上传，别的设备的修改只在本机留一份底（只保留 1 份，09 D-09）。所有者看过风险说明后选择放开 | 所有者（10-CONTEXT D-01） | 2026-11-10 |
| AR-02 | T-10-11 | touched 只决定状态行里的数字，篡改它不影响上传内容和冲突判断 | 计划阶段登记（low），待所有者确认 | 2026-11-10 |
| AR-03 | T-10-22 | 伪造 writer 需要同一账号的凭据，效果只是某个标签页晚一点看到更新，拉取和重连对账会补上 | 计划阶段登记（low），待所有者确认 | 2026-11-10 |
| AR-04 | T-10-SC | 本阶段不安装、不下载任何包 | 计划阶段登记（low） | 2026-11-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-10 | 32 | 32 | 0 | 编排者（/gsd-secure-phase 10，ASVS L1 grep 核对，短路规则，未另派审计代理） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-10（AR-02、AR-03 待所有者确认）
