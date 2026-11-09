---
phase: 09-login-cloud-storage
verified: 2026-11-09T13:00:00Z
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
  - "tests/cloud/capacity.spec.ts"
  - "tests/cloud/conflict-snapshot.spec.ts"
  - "tests/cloud/login.spec.ts"
  - "tests/cloud/logout.spec.ts"
  - "tests/cloud/multi-device.spec.ts"
  - "tests/cloud/reconcile-gate.spec.ts"
  - "tests/cloud/same-origin.spec.ts"
  - "tests/cloud/session.spec.ts"
  - "tests/support/constants.ts"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:737791669fa7252d018bf0cb456e8c158a296bbacf7d0f3f8ce4b2c86900b35c"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "在深色主题（prefers-color-scheme: dark）下打开登录页，触发各类横幅（对账中、网络较慢、连不上、容量警告、本机空间不够）和退出确认框"
    expected: "文字对比度足够，色调（info / warn / error）能区分，确认框和登录卡片与四个视图的深色风格一致"
    why_human: "视觉外观，UI-SPEC 把它列为验收时人工核对项，自动化用例只能断言文字和 data-state，不能判断观感"
  - test: "把窗口缩到 375 px 宽，制造一次真冲突，让最长的提示（冲突提示加“下载留底”按钮）出现"
    expected: "提示完整显示、可以换行，“下载留底”按钮仍然可点（UI-SPEC E4 long-text backstop）"
    why_human: "UI-SPEC 明确标为 backstop：需要在手机宽度截图核对，toast 的排版测不出"
  - test: "375 px 宽下让容量警告横幅出现（数据超过 70%）；再让“超过上限”横幅（启动对账时发现本机未上传的缓存超限，T-09-21 之后新增的路径）出现"
    expected: "横幅文字自动换行，按钮折到下一行，不挤压文字（UI-SPEC E10）；超限横幅在启动路径下同样不遮挡内容"
    why_human: "窄屏换行效果属于视觉判断，计划已把它交给验收"
  - test: "在真实浏览器里点“下载留底”（Edge），再试一次让浏览器拦截或取消保存框"
    expected: "能得到一个不含账号标识的 JSON 文件；取消保存时用户明白留底已按 D-10 删除（已知并接受的风险）"
    why_human: "真实的浏览器下载交互无法在 Playwright 假环境里完整复现，D-10 本身承认页面无法确认文件存好"
---

# Phase 9: 登录与云端存储 验证报告

**阶段目标：** 用户用所有者在后台开好的账号登录后，记录、复盘、任务进度、力量历史和自己的个人计划都从服务器读写，换一台设备登录看到的是同一份数据。打开应用时先和服务器对账，再允许编辑，过期缓存不会覆盖别处的新数据。页面只加载同源资源。
**验证时间：** 2026-11-09
**状态：** human_needed
**重新验证：** 是。上一份报告在 `us-journey-tracker.html`、`tests/support/constants.ts`、`tests/cloud/conflict-snapshot.spec.ts` 变动之后失效。变动来自两个安全审计修复：43c8b90（T-09-18）和 6a214d8（T-09-21）。

## 重新验证方法

没有采信 SUMMARY 和 09-SECURITY-FIX.md。步骤如下。

1. 读两次提交的完整 diff，再读 HEAD 上 `reconcileOnce`、`keepConflict`、`conflictNotice`、`cloudSave`、`sizeCheck` 的源码。
2. 重算应用文件 sha256，与 `APP_SHA256` 比对。
3. 重算 SDK 的 SRI，与页面里的 `SDK_SRI` 比对。
4. 跑隐私检查。
5. 定向跑 Playwright 用例（below-normal 优先级，单 worker，一次一批）：
   - `conflict-snapshot`：10 条，全部通过。
   - `capacity`：5 条，全部通过。
   - `reconcile-gate`、`multi-device`、`logout`：合计 24 条，全部通过。
6. 没有跑默认套件和完整 cloud 套件，采用编排器的证据：默认 `npm test` 175 通过（含 v1 的 154 条），完整 `npm run test:cloud` 114 通过，0 失败。没有 pocketbase.exe 在运行。

## 目标达成情况

### 可观察的真值（ROADMAP 的 5 条成功标准）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 登录页输入账号密码进入应用，刷新或重开浏览器仍保持登录；登录页没有注册入口；密码错误有明确提示 | ✓ VERIFIED（回归检查） | 两次修复没有改登录路径。`login.spec.ts`、`session.spec.ts` 在编排器的完整 cloud 套件里通过。`logout.spec.ts`（10 条）由我重跑，全部通过。 |
| 2 | 退出后本机没有该账号的记录缓存、计划缓存、留底和令牌；另一个账号在同一浏览器登录看不到前一个账号的内容 | ✓ VERIFIED | T-09-18 在 `resetSession` 里新增 `snapPending=null`（第 1036 行），退出和 401 重置会丢掉“待公告”的状态，不跨账号泄露。`logout.spec.ts` 全部通过。 |
| 3 | 账号 A 在一台设备记录、复盘、勾选任务、保存力量值后，另一台设备登录 A 看到同一份数据，四个视图按 A 自己的计划显示；账号 B 看到自己的计划和记录 | ✓ VERIFIED | `reconcileOnce` 按 `kind` 取文档的逻辑没变。`multi-device.spec.ts` 由我重跑通过，`account-data.spec.ts` 在编排器的完整套件里通过。 |
| 4 | 联网打开时对账完成前不能编辑；缓存比服务器旧时以服务器为准、旧缓存不被上传；真冲突时最后保存的为准，被覆盖的那版在本机留底且可下载 | ✓ VERIFIED（本次重点，见下） | 第 993 行：`cloudSave` 在 `getOne` 判定真冲突后、`update` 之前就静默 `keepConflict`。提示由 `snapPending` 推迟到第一次上传成功之后，只公告一次。T-09-21 的容量判断让超限缓存不被上传，也不让页面落到“连不上”。 |
| 5 | 浏览器只向同源发请求：Google 字体 `<link>` 已去掉，PocketBase SDK 从同源加载、版本固定；v1 的 154 条用例仍通过 | ✓ VERIFIED | 应用里 `http(s)://` 字面量 0 个，没有 googleapis / gstatic。`SDK_PATH="/vendor/pocketbase.iife.js"`，`SDK_SRI` 的值我用 openssl 对 `tools/probe/page/vendor/pocketbase.iife.js` 重算，与页面里的完全一致。该目录自 e35a38a 之后没有改动。默认套件 175 通过含 v1 的 154 条（编排器证据）。 |

**得分：** 5/5 真值通过（0 条仅“存在但行为未验证”）。

### 本次重点：两个修复对 SC4 和 D-08..D-11 的影响

**T-09-18（冲突留底的时机，原先是 high 阻塞项）：**

- **先留底，再上传：** 第 993 行的条件是 `cur.updated!==docs.state.base && cur.writer!==WRITER && canon(cur.data)!==canon(s)`，三项与 WR-01 的约束一致。命中后同步写 `keepConflict("state",cur)`，之后才执行第 994 行的 `update`。写入在上传之前，所以 PATCH 已在服务器生效但响应丢了的路径，也留下了另一台设备的版本。
- **公告推迟到成功之后：** 结果存进模块变量 `snapPending`（null、true、false）。第 999 行在上传成功后调用 `conflictNotice` 并清空。更早的提示、状态栏和下载入口都不会在上传失败时出现。
- **留底单份（D-09）：** 更新的冲突会覆盖同一个存储键，同时替换 `snapPending`。
- **下载后不再公告（D-10）：** 公告条件是 `!kept||snapGet()`。留底已被下载删除时，成功的留底不再提示。
- **会话切换：** `resetSession` 清掉 `snapPending`。保存里每个 await 之后仍检查 `sessionEpoch`，所以过期会话的保存不会碰到新会话的状态。
- **用例证据：**
  - `conflict-snapshot.spec.ts` 第 379 行：被拒绝的 PATCH 之后，留底存在且内容是设备一的版本，没有提示，工具栏入口隐藏。下一次成功保存之后才出现提示和下载入口，留底是同一份。
  - 第 435 行：新用例 `lose-answer`。服务器上已是设备二的版本，设备一的版本已留在本机，此时无提示。下一次保存（同一写入者、同一内容，不再触发冲突判定）成功后出现带“下载留底”按钮的提示，留底与之前完全相同（`toEqual`）。
  - 修复者称两个用例对修复前的应用会失败。我没有复现这一点，因为不能改源码。
  - 用例读的是本机存储的真实内容，不是只看界面文字，所以不是只靠文字的弱断言。
- **假服务器新增开关：** `lose-answer`。它让 `handle()` 先应用请求，再中止答复，用 `pb-faults.spec.ts` 自测，并在 PB-CONTRACT 第 10 节登记为“未记录的测试专用行为”，没有伪装成真实服务器的行为。

**T-09-21（启动对账的容量检查，medium）：**

- `resolve()` 在 `create`（第 897 行）和 `update`（第 902 行）之前先测本机版本的 UTF-8 字节数，超过 `CLOUD_MAX` 时不发请求，返回 `held`。
- `settle()` 对 held 文档保持缓存记录不变：`dirty:true`、旧 `base`、旧 `seq`。之后的保存仍会对着更新的服务器版本检测冲突。
- 提交后页面显示已有的 `toolarge` 横幅和状态“保存失败：数据超过容量上限（4 MB）”（`data-state="toolarge"`），门控放开，可编辑。不再抛错，所以不会重试，也不会显示“连不上服务器”。
- `sizeCheck` 拆成 `sizeOf`、`showTooLarge` 和原来的抛错逻辑，保存路径行为不变。`capacity.spec.ts` 的两条新用例（第 113、151 行）断言：没有 PATCH，没有 POST，服务器内容不变，缓存仍 dirty，横幅内容正确，没有“连不上”横幅和按钮，门控已放开。
- 修复者记录的局限：计划文档（不是 state 文档）超限时，下一次 state 保存会清掉 `toolarge` 横幅，因为 `sizeCheck` 只测 state。Phase 9 没有编辑计划的入口，达不到这一状态。我认同不阻塞。

**回归扫描（修复有没有破坏别的路径）：**

- 启动对账路径本身没动（先留底、上传后才公告，仍是第 904–906 行）。
- 对账的 24 条门控用例（含“缓存上的编辑在服务器当前版本之上被上传”“两台设备同时创建首批文档只留一份”）全部通过。
- `held` 分支返回的 `sv` 对没有服务器文档的情形是 `{id:c.id,updated:c.base}`，只用于 `settle` 的 id；`differs()` 要求缓存不脏，所以对 held 记录不会误报“已更新为其他设备上的最新内容”。

### 对 09-CONTEXT 锁定决定的核对

| 决定 | 状态 | 证据 |
|------|------|------|
| D-01 对账期间只读加状态栏 | ✓ | `setGate("reconciling")`，对账门控用例通过 |
| D-02 约 3 秒变慢，15 秒才判连不上 | ✓ | `SLOW_MS=3000`、`FAIL_MS=15000` |
| D-03 连不上只读加重试，不放开编辑 | ✓ | `setGate("readonly")`；T-09-21 之后，容量超限不再被当作连不上 |
| D-04 对账后内容确有不同才提示 | ✓ | `differs()` / `changed` |
| D-05 退出前有未保存修改或留底时确认 | ✓ | `onLogoutClick` + `confirmBox` |
| D-06 退出顺序 | ✓ | `logout()`，用例通过 |
| D-07 登录页预填上次邮箱 | ✓ | `LAST_EMAIL_KEY`、`prefillLogin()` |
| D-08 真冲突时被覆盖的那版留在本机 | ✓（比上次更强） | 普通保存路径现在也是上传前留底 |
| D-09 单份 | ✓ | 同一个存储键，`snapPending` 同步替换 |
| D-10 点下载即删 | ✓ | `snapDownload` 调用 `removeItem`；已下载的留底不再公告 |
| D-11 JSON、不含账号标识 | ✓ | 文件名只含日期，内容是 state 形状，用例断言 |

### 必需产物

| 产物 | 状态 |
|------|------|
| `us-journey-tracker.html` | ✓ VERIFIED，已接线。sha256 `b55b472c…acc354` 与 `APP_SHA256` 一致 |
| `tests/cloud/*.spec.ts` | ✓ VERIFIED。本次重跑 conflict-snapshot 10 条、capacity 5 条、reconcile-gate / multi-device / logout 24 条，共 39 条，全部通过 |
| `tests/support/constants.ts` | ✓ `APP_SHA256` 随应用同提交更新，与实际文件一致 |
| `tests/mocks/pb-server.ts`、`PB-CONTRACT.md`、`pb-faults.spec.ts` | ✓ `lose-answer` 已实现、自测并登记 |

### 关键连线

| 起点 | 终点 | 状态 |
|------|------|------|
| `cloudSave`（`getOne` 判冲突）| `keepConflict` → `snapPending` → 上传成功后 `conflictNotice` | ✓ WIRED |
| `reconcileOnce` → `resolve` | `sizeOf` 与 `CLOUD_MAX` → `held` → `settle` → `showTooLarge` 和状态 `toolarge` | ✓ WIRED |
| `resetSession` | 清 `snapPending` | ✓ WIRED |
| `init()` → `cloudInit()` → `startPb` → `enterApp` → `startReconcile` | 未变，用例通过 | ✓ WIRED |

### 数据流（第 4 层）

四个视图的 `state` / `plan` 来自 `getFullList("journey_docs")` 按 `kind` 取，经 `usePlan`、`normalize`；保存走 `update({data, writer})`。跨设备用例读到另一台设备写入的值。held 路径里页面显示的是本机缓存的真实数据，不是静态值。✓ FLOWING。

### 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 冲突留底（含上传前留底、丢失答复） | `playwright test --config=playwright.cloud.config.ts --workers=1 tests/cloud/conflict-snapshot.spec.ts` | 10 通过 | ✓ PASS |
| 容量（含启动对账的两条新用例） | 同上，`capacity.spec.ts` | 5 通过 | ✓ PASS |
| 对账门控、跨设备、退出 | 同上，三个 spec | 24 通过 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` | 通过（367 个文件） | ✓ PASS |
| 应用基线 | `sha256sum us-journey-tracker.html` | 与 `APP_SHA256` 一致 | ✓ PASS |
| SDK SRI | `openssl dgst -sha256 -binary … | openssl base64` | 与 `SDK_SRI` 一致 | ✓ PASS |

### 探针执行

本阶段没有声明 `probe-*.sh` 类探针。Step 7c：跳过。

### 需求覆盖

| 需求 | 来源计划 | 状态 | 证据 |
|------|----------|------|------|
| ACCT-01 | 09-12 | ✓ SATISFIED | 登录和会话用例；源码 `onLogin`、`cloudInit` |
| ACCT-02 | 09-14 | ✓ SATISFIED | `logout()`；`logout.spec.ts` 重跑通过 |
| SYNC-01 | 09-10 | ✓ SATISFIED | `account-data`、`multi-device`；容量守卫现在也覆盖启动路径 |
| SYNC-05 | 09-09 | ✓ SATISFIED | `reconcile-gate`、`conflict-snapshot`、`capacity`；真冲突在普通保存路径和启动路径上都先留底 |
| PLAN-01 | 09-10 | ✓ SATISFIED | 示例计划全是合成内容，两账号计划隔离用例通过，隐私检查通过 |
| INFRA-03 | 09-02 | ✓ SATISFIED | 见成功标准 5 |

6 个 ID 都出现在计划的 `requirements` 字段里（其余 8 个骨架计划为 `requirements: []`），没有孤立需求。REQUIREMENTS.md 里这 6 个 ID 都是 Complete；TEST-02 仍是 Pending（Phase 13 收口），ACCT-05 仍是 Pending（Phase 10），符合预期。

### 反模式扫描

本阶段修改的应用和测试文件里，没有 TBD / FIXME / XXX / TODO / HACK。其余仍是上次的 6 条 info（IN-01 到 IN-06，不阻塞）。

### 观察（不是缺口）

- **09-SECURITY.md 仍写 `threats_open: 1`、`status: open`。** T-09-18 和 T-09-21 已在 HEAD 的代码里修好，台账尚未更新。需要安全审计员重新核对后关闭（审计员正在读文件）。这是文档状态，不是代码缺口。
- 修复者在复核说明里提醒：留底已写但还没公告时，工具栏入口一直隐藏，到提示出现才显示。用例 379、435 明确断言了这一点，属于有意设计。重新打开页面后 `snapShow` 会直接显示入口（不依赖 `snapPending`）。
- 保存失败后 `flush` 在发起保存前就清了内存里的 `dirty`（B5，CONTEXT 已写明由 Phase 10 修，SYNC-06）。本阶段由本机脏缓存保证数据不丢。
- 掉线后的编辑、状态栏的完整行为和实时同步属于 Phase 10。

## 需要人工验证

阶段计划把下列项目明确留给验收（UI-SPEC 的 backstop），自动化测不出。它们已保存在 `09-UAT.md`，条目没变，只是第 3 条加了 T-09-21 新增的启动超限横幅。

### 1. 深色主题外观
**测试：** 深色主题下打开登录页，触发各类横幅和退出确认框
**预期：** 对比度足够，色调可区分，风格一致
**为什么要人看：** 视觉判断

### 2. 375 px 宽下最长的提示（UI-SPEC E4）
**测试：** 手机宽度下制造一次真冲突
**预期：** 提示可换行，“下载留底”按钮可点
**为什么要人看：** UI-SPEC 标为 backstop，需截图核对

### 3. 375 px 宽下的容量横幅（UI-SPEC E10）
**测试：** 让容量警告出现，再让启动时的“超过上限”横幅出现
**预期：** 文字换行，按钮折到下一行，不挤压文字
**为什么要人看：** 窄屏排版

### 4. 真实浏览器里下载留底
**测试：** Edge 里点“下载留底”，再试拦截或取消保存框
**预期：** 得到不含账号标识的 JSON；取消时留底按 D-10 已删除（已知并接受的代价）
**为什么要人看：** 真实浏览器下载交互

## 缺口摘要

没有缺口。5 条成功标准、6 个需求、D-01 至 D-11 都有源码和通过的用例作证。两个安全修复经源码和用例核对，对成功标准 4 只有加强，没有发现回归。剩下的是阶段计划自己声明的 4 项视觉和真实浏览器的人工核对，加一条文档同步项（09-SECURITY.md 的 `threats_open` 待审计员更新）。

---

_验证时间：2026-11-09_
_验证者：Claude（gsd-verifier）_
