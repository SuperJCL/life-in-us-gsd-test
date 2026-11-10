---
phase: 10-offline-realtime-sync
verified: 2026-11-10T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/10-offline-realtime-sync/10-01-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-01-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-02-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-02-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-03-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-03-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-04-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-04-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-05-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-05-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-06-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-06-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-07-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-07-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-08-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-08-SUMMARY.md"
  - ".planning/phases/10-offline-realtime-sync/10-09-PLAN.md"
  - ".planning/phases/10-offline-realtime-sync/10-09-SUMMARY.md"
  - "tests/KNOWN-BUGS.md"
  - "tests/cloud/offline-sync.spec.ts"
  - "tests/cloud/realtime-sync.spec.ts"
  - "tests/cloud/reconcile-gate.spec.ts"
  - "tests/cloud/remote-update.spec.ts"
  - "tests/cloud/session.spec.ts"
  - "tests/cloud/writer-id.spec.ts"
  - "tests/mocks/pb-server.ts"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:e65c3cc0b6d0b8e447cdb7d6ce34f13c78294b73c742637d8f62974ee13d368a"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "在两台真实设备（一台在中国大陆网络，一台在美国网络）上登录同一个账号，设备 A 记一笔，用秒表看设备 B 多久出现这条记录；再让设备 B 在文本框里写着草稿时重复一次"
    expected: "几秒内出现；B 正在写草稿时，先出现“其他设备有新的修改，稍后会自动更新。”横幅，草稿不丢，空闲后才应用"
    why_human: "“几秒内”的真实网络延迟（国内到香港往返约 300–400 毫秒、SSE 经过 nginx）只有在真实设备和真实网络上才能量；假服务器用例证明了机制（订阅、事件触发整份对账、回声抑制、挂起槽），但量不出真实延迟。按 10-CONTEXT 与 ROADMAP，这项归 Phase 13 的真机验收"
  - test: "决定状态栏在“没有待上传修改”时的文案：本机是干净的、只是后台拉取失败（断网或服务器报错）时，现在会显示“离线，修改已存在本机，联网后自动上传”或“保存失败，修改仍在本机，N 秒后自动重试”"
    expected: "所有者选择：A) 保持现状（逐字沿用 09-UI-SPEC 的 S2，没有任何修改丢失）；B) 先在契约里加入“无修改”的中性文案（例如“离线，联网后自动检查更新”“连不上服务器，N 秒后自动再试”），再改代码和用例"
    why_human: "这是 UI 契约文案的取舍，需要所有者确认，不能由实现者擅自改字。代码层面状态切换本身是对的（离线与重试按“请求有没有到达服务器”区分），只是文字在 n=0 且本机不脏时说了多余的内容（见 10-UI-REVIEW 第 1、2 条）。没有数据丢失风险"
---

# Phase 10: 离线与实时同步 验证报告

**阶段目标：** 断网时照常记录，联网后自动上传。同一账号在另一台设备上的修改，几秒内出现在这台设备上，并且不打断正在写的草稿或打开的编辑框。状态栏始终如实显示同步状态，保存失败和登录过期都不会丢数据。
**验证时间：** 2026-11-10
**状态：** human_needed（自动检查全部通过，剩 2 项需要人来定）
**是否复验：** 否，首次验证

## 目标达成情况

### 可观察的真值（ROADMAP 的 5 条成功标准，不可缩减）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 断网后照常记一笔、改记录、勾选任务，状态栏显示“离线”和待上传数量；连不上服务器时刷新页面，待上传的修改和数量还在；联网后自动上传、数量归零、另一台设备随后能看到 | ✓ VERIFIED | `us-journey-tracker.html`：`commit(keys,fn)`（行 607）把每次修改记进 `ops` 并以条目键调用 `persist(...keys)`（行 597，写入缓存的 `touched` 集合）；`showSync()`（行 1061）在 `net==="offline"` 时用 `T_OFFLINE(n)` 显示数量；`goBootOffline`（行 909）让有缓存的启动直接可编辑；`window online` 监听（行 1229）立即 `requestSync`。用例 `SYNC-03 an entry made while the server is unreachable…`（断言 `data-state=offline`、文案含数量 1、缓存 `dirty=true` 且 `touched=[log:<id>]`、联网后 `synced`、服务器上有这条、第二台设备能看到）、`SYNC-03 an offline edit survives a reload with its pending count…`（刷新后数量与记录仍在，联网后上传、`touched` 归零）、`SYNC-03 the pending count counts each changed item once`、`SYNC-03 opening the app with a cache while the browser reports offline…` 全部在编排者的 `test:cloud` 报告里为 expected。按 D-08，“刷新”验证的是“服务器连不上时刷新”，真正断网刷新归 Phase 13 |
| 2 | 设备 A 的修改几秒内出现在设备 B；B 正在写草稿、打开编辑框或焦点在输入框时，远端更新先挂起并提示，空闲后再应用，草稿和编辑框内容不丢；B 自己的保存不回声成远端更新 | ✓ VERIFIED（真实网络延迟见人工项 1） | `startRealtime`（行 1306）订阅 `journey_docs/*`（只取 `id,kind,writer,updated`）和 `PB_CONNECT`；`onDocEvent`（行 1326）在 `writer===WRITER` 或 `updated===base` 时忽略；60 秒 `pollTick` 兜底；`pendRemote` 挂起槽加 `isBusy`（行 1383：打开的弹窗、两个 composer 草稿、新标签输入框、聚焦的文本框、未提交复盘、未保存力量值）、`maybeApplyView` 显示 info 横幅“现在更新”；`applyView` 经 `renderKeep` 保留草稿和光标；D-04（`commit` 先 `takeRemote` 再做本机操作）、D-05、D-06 均有代码。用例 `a change on one device appears on the other device within seconds`、`this device's own save never comes back as a remote update`（用 writer 相同但 updated 不同的事件加哨兵证明回声被忽略）、`a remote change waits with a notice while this device is busy…`（草稿、焦点不变，横幅 info，空闲后应用并有 toast）、D-04（含编辑弹窗，`editor` 辅助）、D-05、D-06、两条“重做不重复”用例全部 expected |
| 3 | 实时断开再重连、页面回到前台、重新联网时都整份对账，断开期间别的设备的修改不会漏 | ✓ VERIFIED | `onPbConnect`（行 1335）每次连接（含 SDK 自动重连）都 `requestSync("connect")`；`pb.realtime.onDisconnect=onPbDisconnect` 把 `data-rt` 退回 `connecting`；`visibilitychange`（行 1260）和 `online`（行 1229）立即对账；`startRealtime` 订阅后补一次对账以关闭首次读取与订阅之间的空档；首次连接失败则 `ensureRealtime` 在下一次成功同步后重试。用例 `a realtime reconnect reconciles and picks up a change made while it was down`（拒绝重连、断开期间设备一写入、放开后设备二出现该记录并回到 live）、`a first realtime connection that fails is retried by the app`、`coming back online or to the foreground reconciles at once` 全部 expected |
| 4 | 状态栏在已同步、保存中、离线、失败重试、登录过期五种状态间如实切换，每种都有用例检查文案；服务器出错时自动退避重试、修改不丢（修 B5）；加载完成前的修改不丢（修 B3） | ✓ VERIFIED（文案取舍见人工项 2） | `showSync()` 覆盖五种状态；`syncOnce` 失败分类（请求没到达服务器→`offline`；5xx、429、其他 4xx、超时→`retrying`；超限→`toolarge` 不重试）；`RETRY_STEPS=[1,2,5,10,30,60]`，永不放弃，失败不清脏标记；`syncLimit()` 随文档大小放宽时限。用例：`synced`/`saving`（`a save shows saving and then synced`）、`offline`（SYNC-03 首条）、`retrying`（`a server error is retried automatically at growing intervals…` 逐档断言 1、2、5、10、30、60 秒倒计时与请求次数，点“立即重试”立即多一次请求，撤掉故障后上传成功且服务器上恰好一条）、`expired`（ACCT-05 用例）。B5：同一条退避用例。B3：云端路径由 Phase 9 的门控（`reconcile-gate` 用例“clicks, keys and drags … change nothing and send no write”）加本阶段 `SYNC-03 a reconcile not finished after about 15 seconds with a cache turns to offline editing and uploads the edits made meanwhile (B3)`；`tests/KNOWN-BUGS.md` 已登记。旧路径（Claude、localStorage）上 B3、B5 的修复不在本里程碑，已在 `10-CONTEXT` 与 KNOWN-BUGS 明示 |
| 5 | 登录过期时状态栏提示重新登录，本机未上传的修改保留；同一账号重新登录后继续上传，服务器数据含过期期间的修改 | ✓ VERIFIED | `checkAuth`（行 1092）只有 `authRefresh` 返回 401 才算过期（记录接口对失效令牌返回 200 空列表、404、400，PB-CONTRACT §9）；`goExpired`（行 1097）只设 `net="expired"`、停重试、停轮询、退订实时、显示 warn 横幅“重新登录”，不动 state、缓存、`touched`、`ops`；`relogin()` 进登录页（邮箱预填）。用例 `ACCT-05 an expiry found while saving keeps editing here…`：过期前后各记一条、`#w-text` 仍可用、过期期间零请求、点“重新登录”邮箱预填且提示两行、同账号登录后服务器 state 含两条、无换账号确认框；另有 `a token that passes its local expiry…` 和两条“退出后迟到的 401/authRefresh 不得重新存令牌或弹过期提示”用例，全部 expected |

**得分：** 5/5 真值已验证；0 项“代码在、行为未验证”（所有行为型真值——状态转换、取消、清理、顺序——都有通过的行为用例）。

### 额外的行为型不变量（来自 PLAN 的 must_haves，抽查）

| 不变量 | 状态 | 证据 |
|--------|------|------|
| 上传成功只移除这一次上传的 `ops` 前缀（`sentOps`），上传期间新增的修改仍待上传 | ✓ VERIFIED | `syncOnce`（行 1155、1164、1193 `ops.splice(0,sentOps)`）；用例 `an edit made while an upload is in flight stays pending alone after that upload succeeds` |
| 落后一步的保存不覆盖另一台设备，而是在其版本上重做 | ✓ VERIFIED | `rebaseState`（行 1348）加 `opsOk`；用例 `an edit on a device that had not yet seen another device's change keeps both edits without a kept version`、`replaying edits whose upload timed out but reached the server adds nothing twice` |
| 离线失败后退回 D-03（以本机为准，被覆盖版本留底并提示） | ✓ VERIFIED | `opsOk=false` 与 `keepConflict`；用例 `SYNC-05 an offline edit over a newer server version is uploaded and the other version is kept here (D-03)` |
| 每标签页一个写入方 id，复制标签页重新取号 | ✓ VERIFIED | 行 653 起；用例 `a duplicated tab gets its own writer id and a reload keeps it` |
| 同浏览器两标签页离线并行编辑后收敛到并集 | ✓ VERIFIED | `adoptTab`（行 1280）；用例 `two tabs editing offline at the same time keep each other's edits after one tab is closed` |
| 退出时先中止同步，迟到的 authRefresh 不会恢复令牌（WR-01） | ✓ VERIFIED | `abortSync`/`mkCtrl`；两条 ACCT-02/05 用例 |

### 必需产物（三层检查）

| 产物 | 预期 | 状态 | 说明 |
|------|------|------|------|
| `us-journey-tracker.html`（云端同步层） | 同步循环、退避、过期、实时、挂起槽、重做、标签页同步 | ✓ VERIFIED | 实质内容，无占位；所有入口汇到 `requestSync`；由用例驱动 |
| `tests/mocks/pb-server.ts` | `dropRealtime`、`refuseRealtime`、`context` 限定故障、`writes[].writer` | ✓ VERIFIED | 被 realtime/offline 用例使用 |
| `tests/cloud/{offline-sync,remote-update,realtime-sync,session,writer-id,reconcile-gate}.spec.ts` | 覆盖 5 个需求 | ✓ VERIFIED | 断言真实状态、缓存内容、服务器内容，不是空壳；`verify.artifacts` 九份计划均 全部通过（3/3、4/4 等） |
| `tests/KNOWN-BUGS.md`、`tests/README.md` | B3、B5 登记，Phase 10 已知限制 | ✓ VERIFIED | B3、B5 条目指向具体用例 |

### 关键链接

`verify.key-links` 对九份计划都返回 0/N，原因是计划里的 `from` 字段写的是描述而不是文件路径（工具报“from must be a relative file path”），是计划文档格式问题，不是代码缺陷。已人工逐条核对布线：

| 从 | 到 | 方式 | 状态 |
|----|----|------|------|
| 60 秒轮询、visibilitychange、online、实时事件、PB_CONNECT、重试定时器、标签页 storage | `requestSync` → `syncOnce` | 行 1229、1258、1260、1268、1326、1335、1087 | WIRED |
| 所有改 state 的处理函数 | `commit` → `persist` → `flush` → `requestSync("save")` | 行 597、607 | WIRED |
| `syncOnce` 失败 | `scheduleRetry` + `showSync` | 行 1226 | WIRED |
| `syncOnce` 的 401 检测 | `checkAuth` → `goExpired` → 状态行与横幅 → `relogin` | 行 1092–1105 | WIRED |
| 远端版本 | `pendRemote` → `maybeApplyView`/`commit` → `takeRemote` → `renderKeep` | 行 1364–1428 | WIRED |

### 数据流（第 4 层）

状态行、数量、横幅都从真实状态推出：`n=docs.state.touched.length`（`touched` 来自 `ops` 的键），远端内容来自 `coll.getFullList` 的真实列表响应，缓存读回的是 `docAfter()`。没有硬编码空值。FLOWING。

### 行为抽查

不再重跑全套（编排者已在 HEAD 65ce241 上顺序运行）：

| 项 | 来源 | 结果 | 状态 |
|----|------|------|------|
| 默认 `npm test` | `test-results/p10-reg-default.json`（编排者） | expected=176 flaky=0 unexpected=0 | ✓ PASS |
| `npm run test:cloud` | `test-results/p10-reg-cloud.json`（本人读取并复核） | 158 条全部 expected，无失败；32 条与 ACCT-05/SYNC-02/03/04/06 相关的用例逐条列出，状态均为 expected | ✓ PASS |

### 探针执行

本阶段计划没有声明 `probe-*.sh`；PROBE-10a/10b/10c 是 Playwright 用例（`tests/cloud/probes-cloud.spec.ts`），包含在上面的 `test:cloud` 里。不适用。

### 需求覆盖

| 需求 | 来源计划 | 描述 | 状态 | 证据 |
|------|----------|------|------|------|
| ACCT-05 | 10-05、10-09 | 登录过期时本机未上传的修改不丢；重新登录后继续上传 | ✓ SATISFIED | 成功标准 5 的证据 |
| SYNC-02 | 10-02、04、06、07、08、09 | 另一台设备的修改几秒内出现，不打断草稿或编辑框 | ✓ SATISFIED（真实延迟见人工项 1） | 成功标准 2、3 的证据 |
| SYNC-03 | 10-01、02、03、04、06、07、09 | 断网照常记录、显示待上传数量、联网自动上传 | ✓ SATISFIED | 成功标准 1 的证据 |
| SYNC-04 | 10-01、05、09 | 状态栏如实显示五种状态 | ✓ SATISFIED（文案取舍见人工项 2） | 成功标准 4 的证据 |
| SYNC-06 | 10-01、03、09 | 保存失败自动重试（B5）；加载完成前的编辑不丢（B3） | ✓ SATISFIED | 成功标准 4 的证据 |

计划 frontmatter 声明的需求 ID 并集 = {ACCT-05, SYNC-02, SYNC-03, SYNC-04, SYNC-06}，与阶段需求清单一致，`REQUIREMENTS.md` 里这五项均已勾选并在追踪表里映射到 Phase 10。无孤立需求。

### 反模式扫描

对 `us-journey-tracker.html`、`tests/cloud/*.ts`、`tests/support/*.ts`、`tests/mocks/*.ts`、`tests/README.md` 搜索 `TBD|FIXME|XXX`：无匹配。无占位实现。

| 文件 | 行 | 模式 | 严重度 | 影响 |
|------|----|------|--------|------|
| `us-journey-tracker.html` | 1052、1053、1068 | n=0 且本机不脏时，离线与重试文案仍说“修改已存在本机”“保存失败” | 警告 | 仅文案；无数据丢失；见人工项 2 |
| `us-journey-tracker.html` | 约 876 | `unreachBar` 文案在有缓存启动路径上几乎不可达 | 提示 | 不影响用户（10-UI-REVIEW INFO） |

代码审查（10-REVIEW 0 严重、3 警告、6 提示）的修复已落地（WR-01、WR-02、WR-03、IN-02、IN-03、IN-04，提交 83adc9d、9321601、4311d01、4b6298b、938ed46、97e0b35）；IN-01、IN-05、IN-06 按理由跳过，处置表 0 项未决。安全核查 10-SECURITY 威胁未决 0 项。

### 需要人工验证

#### 1. 真实设备上的“几秒内”延迟

**测试：** 两台真实设备（国内网络和美国网络）登录同一账号，设备 A 记一笔，计时设备 B 出现的时间；B 写着草稿时再来一次。
**预期：** 几秒内出现；B 写草稿时先出横幅、草稿不丢、空闲后再应用。
**为什么需要人：** 真实网络延迟和 nginx 上的 SSE 行为在假服务器里无法测量。机制已由用例证明；按 10-CONTEXT 与 ROADMAP，真机验收归 Phase 13，这是真实环境项，不是缺口。

#### 2. 无待上传修改时的状态栏文案

**测试：** 所有者在两个方案中选一个：A) 保持逐字沿用 09-UI-SPEC S2 的现状；B) 先在契约里加入“无修改”文案，再改代码和用例。
**预期：** 状态栏文字不对没有发生的事做声明。
**为什么需要人：** 这是 UI 契约文案，必须由所有者确认；没有数据丢失，状态本身切换正确。

### 缺口总结

没有阻断性缺口。五条成功标准、五个需求在代码里都有实质实现，并有在假服务器上通过的行为用例（编排者运行的 `test:cloud` 158 条、默认套件 176 条，均无失败、无 flaky）。剩下两项是人工决定：真实网络上的延迟（Phase 13 真机验收）和无修改时的状态栏文案（UI 契约取舍）。

---

_验证时间：2026-11-10_
_验证者：Claude（gsd-verifier）_
