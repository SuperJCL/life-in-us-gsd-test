---
phase: 09-login-cloud-storage
verified: 2026-11-09T12:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/09-login-cloud-storage/09-01-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-01-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-02-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-02-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-03-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-03-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-04-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-04-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-05-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-05-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-06-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-06-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-07-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-07-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-08-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-08-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-09-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-09-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-10-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-10-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-11-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-11-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-12-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-12-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-13-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-13-SUMMARY.md"
  - ".planning/phases/09-login-cloud-storage/09-14-PLAN.md"
  - ".planning/phases/09-login-cloud-storage/09-14-SUMMARY.md"
  - "tests/cloud/account-data.spec.ts"
  - "tests/cloud/conflict-snapshot.spec.ts"
  - "tests/cloud/login.spec.ts"
  - "tests/cloud/logout.spec.ts"
  - "tests/cloud/multi-device.spec.ts"
  - "tests/cloud/reconcile-gate.spec.ts"
  - "tests/cloud/same-origin.spec.ts"
  - "tests/cloud/session.spec.ts"
  - "tests/support/constants.ts"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:52a20b08ba4545d62688ca0a22a0d15ddd02686a1b748cd386e48cb0befe7f62"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "在深色主题（prefers-color-scheme: dark）下打开登录页，触发各类横幅（对账中、网络较慢、连不上、容量警告、本机空间不够）和退出确认框"
    expected: "文字对比度足够，色调（info / warn / error）能区分，确认框和登录卡片与四个视图的深色风格一致"
    why_human: "视觉外观，UI-SPEC 把它列为验收时人工核对项，自动化用例只能断言文字和 data-state，不能判断观感"
  - test: "把窗口缩到 375 px 宽，制造一次真冲突，让最长的提示（冲突提示加“下载留底”按钮）出现"
    expected: "提示完整显示、可以换行，“下载留底”按钮仍然可点（UI-SPEC E4 long-text backstop）"
    why_human: "UI-SPEC 明确标为 backstop：需要在手机宽度截图核对，toast 的排版测不出"
  - test: "375 px 宽下让容量警告横幅出现（数据超过 70%）"
    expected: "横幅文字自动换行，按钮折到下一行，不挤压文字（UI-SPEC E10）"
    why_human: "窄屏换行效果属于视觉判断，计划已把它交给验收"
  - test: "在真实浏览器里点“下载留底”（Edge），再试一次让浏览器拦截或取消保存框"
    expected: "能得到一个不含账号标识的 JSON 文件；取消保存时用户明白留底已按 D-10 删除（已知并接受的风险）"
    why_human: "真实的浏览器下载交互无法在 Playwright 假环境里完整复现，D-10 本身承认页面无法确认文件存好"
---

# Phase 9: 登录与云端存储 验证报告

**阶段目标：** 用户用所有者在后台开好的账号登录后，记录、复盘、任务进度、力量历史和自己的个人计划都从服务器读写，换一台设备登录看到的是同一份数据。打开应用时先和服务器对账，再允许编辑，过期缓存不会覆盖别处的新数据。页面只加载同源资源。
**验证时间：** 2026-11-09
**状态：** human_needed
**重新验证：** 否（首次验证）

## 验证方法

没有采信 SUMMARY。我读了 `us-journey-tracker.html` 里云端部分的源码（登录、对账、门控、缓存、留底、退出），核对 SDK 的 sha256 与 SRI，核对应用的 sha256 基线，跑了隐私检查，并且自己跑了两批定向的 Playwright 用例（below-normal 优先级、单 worker）。没有重跑完整的默认套件和完整的 cloud 套件，采用编排器给出的证据（默认 175 通过，cloud 110 通过，0 失败，0 flaky）。

## 目标达成情况

### 可观察的真值（来自 ROADMAP 的 5 条成功标准）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 登录页输入账号密码进入应用，刷新或重开浏览器仍保持登录；登录页没有注册入口；密码错误有明确提示 | ✓ VERIFIED | `#login` 段（html 第 285–300 行）只有邮箱、密码、登录按钮和“账号由管理员开通”的说明，没有任何链接。`onLogin` 区分 400（`ERR_CRED`）、429、超时和网络错误；令牌存在 SDK 的 LocalAuthStore 里，启动时 `authRefresh`。用例通过：`login.spec.ts` 里的登录、刷新保持登录、错误密码、无注册入口，以及 `session.spec.ts` 的“重开浏览器保持登录”（后两批我跑了其中 logout/reconcile/conflict 三个 spec，session 和 login 用例由编排器全量运行覆盖）。 |
| 2 | 退出后本机没有该账号的记录缓存、计划缓存、留底和令牌；另一个账号在同一浏览器登录看不到前一个账号的内容 | ✓ VERIFIED | `logout()`（第 1043–1057 行）顺序为：退订（带 3 秒上限）→ 删除 `usj:v2:<id>:state/plan/snapshot` 和 `lastUser` → `pb.authStore.clear()` → `resetSession()` → 登录页；D-07 的邮箱预填保留。换账号登录时 `onLogin` 清掉前一账号的缓存，有未上传内容先确认。我跑的 `logout.spec.ts` 10 条全部通过，含“A 退出后无缓存无令牌、B 看不到 A 的内容”“退订先于清缓存先于清令牌”“跨标签页退出”“保存中退出”。 |
| 3 | 账号 A 在一台设备记录、复盘、勾选任务、保存力量值后，另一台设备登录 A 看到同一份数据，四个视图按 A 自己的计划显示；账号 B 看到自己的计划和记录 | ✓ VERIFIED | `reconcileOnce` 按 `kind` 取 plan 和 state 文档（不依赖列表顺序），`usePlan(pr.data)` 先于 `normalize(sr.data)`。我跑的 `account-data.spec.ts`（4 条）和 `multi-device.spec.ts`（2 条）全部通过，包括“两个账号列表顺序相反时各看各的”“一台设备保存、另一台设备在四个视图看到”。 |
| 4 | 联网打开时对账完成前不能编辑；缓存比服务器旧时以服务器为准、旧缓存不被上传；真冲突时最后保存的为准，被覆盖的那版在本机留底且可下载 | ✓ VERIFIED | `setGate("reconciling")` + `applyGate`（禁用控件）+ 捕获阶段的 `gateGuard`（挡键盘、拖拽、脚本事件），`flush` 在门控期间直接返回；`same()` 只在“缓存干净且 base 等于服务器 updated”时用缓存，否则用服务器版本，不上传；`cloudSave` 在上传成功后才 `keepConflict` 并弹带下载按钮的提示，单份留底、点下载即删、文件名不含账号标识。3 秒“网络较慢”、15 秒只读加重试都在源码里。我跑的 `reconcile-gate.spec.ts`（12 条）和 `conflict-snapshot.spec.ts`（9 条）全部通过。 |
| 5 | 浏览器只向同源发请求：Google 字体 `<link>` 已去掉，PocketBase SDK 从同源加载、版本固定；v1 的 154 条用例仍通过 | ✓ VERIFIED | 应用里没有任何 `http(s)://` 字面量，也没有 fonts.googleapis / gstatic；`--serif` 回落为 `Songti SC / STSong / Georgia`。SDK 路径 `/vendor/pocketbase.iife.js`，`integrity` 是 `sha256-lMHgMreDlS9pif90JW7JdEDQ7PDCTtuVdfjIcWywSp8=`，我独立用 `sha256sum` 加 base64 算出的值与它完全一致，且与 `SHA256SUMS` 一致；静态服务器启动时也核对。`same-origin.spec.ts` 4 条通过（含“被篡改的 SDK 被拒绝，不回退到其他来源或本机存储”）。回归：编排器的默认 `npm test` 175 通过，含 v1 的 154 条；应用文件 sha256 `2fddc13b…f765` 与 `tests/support/constants.ts` 的 `APP_SHA256` 一致。 |

**得分：** 5/5 真值通过（0 条仅“存在但行为未验证”）。

### 对 09-CONTEXT 锁定决定的核对

| 决定 | 状态 | 证据 |
|------|------|------|
| D-01 对账期间只读加状态栏 | ✓ | `setGate("reconciling")`、`T_RECON` |
| D-02 约 3 秒变慢，15 秒才判连不上 | ✓ | `SLOW_MS=3000`、`FAIL_MS=15000` |
| D-03 连不上只读加重试，不放开编辑 | ✓ | `setGate("readonly")` + `unreachBar` 的重试按钮；`init()` 云端路径不再有静默回退（`CLOUD` 分支提前 return） |
| D-04 对账后内容确有不同才提示 | ✓ | `differs()`/`changed` → toast“已更新为其他设备上的最新内容” |
| D-05 退出前有未保存修改或留底时确认 | ✓ | `onLogoutClick` + `confirmBox`；CR-01 修复后也读取其他标签页写下的脏缓存 |
| D-06 退出顺序 | ✓ | 见真值 2 |
| D-07 登录页预填上次邮箱 | ✓ | `LAST_EMAIL_KEY`、`prefillLogin()` |
| D-08..D-11 留底、单份、点即删、JSON、无账号标识 | ✓ | `keepConflict`/`snapDownload`；文件名只含日期；blob 地址 30 秒后才释放（WR-03 修复） |

### 必修项（ROADMAP）

`pb.autoCancellation(false)`（第 640 行）、联网启动 `authRefresh`（第 881 行）、退出顺序、去掉静默回退、保存前检查文档大小（`sizeCheck` 在 70% 提示，超过 4 MiB 拒绝上传）都已落地。

### 必需产物

| 产物 | 说明 | 状态 |
|------|------|------|
| `us-journey-tracker.html` | 云端开关、同源 SDK + SRI、登录页、对账、门控、缓存、留底、退出 | ✓ VERIFIED，且已接线 |
| `tests/cloud/*.spec.ts`（14 个 spec） | 登录、会话、对账门控、冲突留底、容量、跨设备、账号数据、退出、同源 | ✓ VERIFIED（我定向跑了其中 41 条，全部通过） |
| `tests/support/constants.ts` | `APP_SHA256` 基线 | ✓ 与实际文件一致 |

### 关键连线

| 起点 | 终点 | 方式 | 状态 |
|------|------|------|------|
| `init()` | `cloudInit()` | `CLOUD` 开关（`USJ_CONFIG.backend==="pocketbase"`），旧路径不变 | ✓ WIRED |
| `cloudInit` | `loadSdk` → `startPb` → `enterApp(true)` | SDK 带 SRI，`startPb` 里注册 `onAuthChange`（WR-02 已修） | ✓ WIRED |
| `persist()` | 本机缓存和 `cloudSave` | `persist` 同步写缓存（脏位、seq），600 毫秒后 `flush` → `store.save` | ✓ WIRED |
| `reconcileOnce` | 门控解除、`setStatus("已同步")` | 一次同步提交，过期的 run 通过 `live()` 抛 STALE | ✓ WIRED |

### 数据流（第 4 层）

| 产物 | 数据 | 来源 | 真实数据 | 状态 |
|------|------|------|----------|------|
| 四个视图 | `state` / `plan` | `getFullList("journey_docs")` 按 `kind` 取，经 `usePlan`、`normalize` | 是（跨设备用例读到另一台设备写入的值） | ✓ FLOWING |
| 保存 | `docs.state.id` 的 `update({data, writer})` | 假服务器（PocketBase 契约），PATCH 只带 `data` 和 `writer` | 是 | ✓ FLOWING |

### 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 同源、SRI、账号数据、跨设备 | `playwright test --config=playwright.cloud.config.ts` 对 same-origin / multi-device / account-data | 10 通过 | ✓ PASS |
| 退出、对账门控、冲突留底 | 同上，对 logout / reconcile-gate / conflict-snapshot | 31 通过 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` | 隐私检查通过（363 个文件） | ✓ PASS |
| 应用文件基线 | `sha256sum us-journey-tracker.html` | 与 `APP_SHA256` 一致 | ✓ PASS |

### 探针执行

本阶段没有声明 `probe-*.sh` 类探针；字体相关的 PROBE-2 和网络护栏断言已按成功标准 5 调整（`guard-cloud`、`probes-cloud` 在编排器的全量运行中通过）。Step 7c：跳过（无声明的探针脚本）。

### 需求覆盖

| 需求 | 来源计划 | 说明 | 状态 | 证据 |
|------|----------|------|------|------|
| ACCT-01 | 09-12（骨架 09-01、09-11） | 账号密码登录，刷新或重开浏览器仍保持登录 | ✓ SATISFIED | 登录、会话、表单状态用例，源码 `onLogin`/`cloudInit` |
| ACCT-02 | 09-14（骨架 09-13） | 退出后本机不留该账号缓存 | ✓ SATISFIED | `logout()`，`logout.spec.ts` 10 条通过 |
| SYNC-01 | 09-10（骨架 09-01/04/07/08） | 记录、复盘、任务进度、力量历史存服务器，换设备同一份数据 | ✓ SATISFIED | `account-data`/`multi-device` 通过 |
| SYNC-05 | 09-09（骨架 09-05/06/07/08） | 先对账再编辑，真冲突留底可下载 | ✓ SATISFIED | `reconcile-gate`/`conflict-snapshot`/`capacity` |
| PLAN-01 | 09-10（骨架 09-01/05） | 每个账号的计划存在自己账号里，代码里只剩一份合成示例计划 | ✓ SATISFIED | `DEFAULT_PLAN` 全是合成内容；首次登录建 plan 文档；两账号计划隔离用例通过；隐私检查通过 |
| INFRA-03 | 09-02 | 去掉 Google 字体，SDK 同源固定版本 | ✓ SATISFIED | 见成功标准 5 |

没有孤立需求：REQUIREMENTS.md 映射到 Phase 9 的 6 个 ID 都出现在计划的 `requirements` 字段里（09-01、03 至 08、11、13 为骨架计划，`requirements: []`，由收口计划声明）。TEST-02 仍是 Pending（Phase 13 收口），ACCT-05 属于 Phase 10，符合预期。

### 反模式扫描

| 文件 | 行 | 模式 | 严重度 | 影响 |
|------|----|------|--------|------|
| `us-journey-tracker.html`、`tests/cloud/*`、`tests/support/*`、`tests/mocks/*` | - | TBD / FIXME / XXX / TODO / HACK | 无 | 没有发现 |
| `us-journey-tracker.html` | 811 | `SB_ORDER` 里的 `expired`、`remote` 从未被设置（IN-01） | ℹ️ Info | 死条目，不影响行为，Phase 10 会用到 |
| `tests/support/strings.ts` | - | 两个只定义未使用的常量（IN-02，部分已被 WR-04 用到） | ℹ️ Info | 无影响 |
| `tests/support/app.ts` | 顶部 | 注释块位置不对（IN-03） | ℹ️ Info | 无影响 |
| 若干用例 | - | 标题强于实际证明内容（IN-04）；同一用例混用 `clock.install` 与 `setFixedTime`（IN-05） | ℹ️ Info | 轻微的测试可信度问题，不阻塞 |
| `us-journey-tracker.html` | `<head>` | 字体 `<link>` 移除后，旧路径（Claude Artifact）标题字体也变了（IN-06） | ℹ️ Info | 与 INFRA-03 一致，所有者已在调研阶段接受外观变化 |

九条严重和警告级的评审发现（CR-01、CR-02、WR-01..WR-07）在 `09-REVIEW-DISPOSITION.md` 里都是 fixed；我读了对应的源码，修复都在：CR-01 的 `unsentOf`、CR-02 的 `keepOrphans`、WR-01 的写入者与内容判断、WR-02 的 `startPb` 里注册监听、WR-03 的 30 秒释放、WR-04 的 `Promise.race`、WR-05 的 `cacheNote`、WR-06 的 `expireToken`。六条 info 保持 open，不阻塞。

### 观察（不是缺口）

- 保存失败后，`flush` 在发起保存前已清掉内存里的 `dirty`（B5，CONTEXT 已写明由 Phase 10 修）；本阶段由本机脏缓存保证数据不丢，重试留给 Phase 10（SYNC-06）。
- 掉线后的编辑、状态栏五种状态的完整行为、实时同步属于 Phase 10，本阶段没有要求。

## 需要人工验证

阶段计划把下列项目明确留给验收（UI-SPEC 的 backstop），自动化测不出。其余真值都有自动化证据，所以整体状态是 `human_needed`，不是 `gaps_found`。

### 1. 深色主题外观
**测试：** 深色主题下打开登录页，触发各类横幅和退出确认框
**预期：** 对比度足够，色调可区分，风格一致
**为什么要人看：** 视觉判断

### 2. 375 px 宽下最长的提示（UI-SPEC E4）
**测试：** 手机宽度下制造一次真冲突
**预期：** 提示可换行，“下载留底”按钮可点
**为什么要人看：** UI-SPEC 标为 backstop，需截图核对

### 3. 375 px 宽下容量警告横幅（UI-SPEC E10）
**测试：** 让容量警告出现
**预期：** 文字换行，按钮折到下一行
**为什么要人看：** 窄屏排版

### 4. 真实浏览器里下载留底
**测试：** Edge 里点“下载留底”，再试拦截或取消保存框
**预期：** 得到不含账号标识的 JSON；取消时留底按 D-10 已删除（已知并接受的代价）
**为什么要人看：** 真实浏览器下载交互

## 缺口摘要

没有缺口。5 条成功标准、6 个需求、D-01 至 D-11 都有源码和通过的用例作证。剩下的只是阶段计划自己声明的 4 项视觉与真实浏览器的人工核对。

---

_验证时间：2026-11-09_
_验证者：Claude（gsd-verifier）_
