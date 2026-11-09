---
phase: 09-login-cloud-storage
verified: 2026-11-09T15:00:00Z
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
covered_digest: "v4:sha256:e50519b256333753932cd4fa8f6b6b7ef2b3ef7fabab9782a2603bfc3085c251"
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
  - test: "把窗口缩到 375 px 宽，制造一次真冲突，让最长的提示（冲突提示加“下载留底”按钮）出现。UI 审查提出的 toast 被挤窄问题已有修复（8a8f026：`.toast[data-cloud]{width:max-content;max-width:calc(100vw - 32px)}` 与按钮 `flex:none`），请直接看修复后的效果"
    expected: "提示完整显示、可以换行，宽度不再被压到约 187 px，“下载留底”按钮仍然可点（UI-SPEC E4 long-text backstop）"
    why_human: "UI-SPEC 明确标为 backstop：需要在手机宽度截图核对，toast 的排版测不出；修复只是代码层面的推断，还没有人在 375 px 下看过"
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
**重新验证：** 是（第 2 次）。上一份报告在 `us-journey-tracker.html` 和 `tests/support/constants.ts` 变动之后失效。变动来自提交 8a8f026（UI 审查警告修复）：只改了 CSS，外加退出确认框的一个 class 钩子。

## 重新验证方法

没有采信 SUMMARY 和提交说明。步骤如下。

1. 读 `git diff d5e884b..8a8f026 -- us-journey-tracker.html tests/support/constants.ts` 的完整内容。应用文件只有 8 行增删，常量文件只有 `APP_SHA256` 一行。
2. 整个范围的文件清单（`git diff d5e884b..8a8f026 --stat`）只有 4 个文件：`09-SECURITY.md`、`09-UI-REVIEW.md`、`tests/support/constants.ts`、`us-journey-tracker.html`。`tests/cloud/*.spec.ts`、`tests/mocks/`、`tools/probe/page/vendor/` 都没有变。
3. 重算应用文件 sha256，与 `APP_SHA256` 比对。
4. 在 HEAD 上读 `confirmBox`、`onLogoutClick`、`confirmBox` 的全部调用点。
5. 重跑隐私检查，重扫应用里的外部地址和标记注释。
6. 没有跑 Playwright。按本次约束，采用编排器在这个 HEAD 上跑的证据：默认 `npm test` 175 通过（含 v1 的 154 条），完整 `npm run test:cloud` 114 通过，0 失败，没有 pocketbase.exe 在运行。

## 8a8f026 的逐行核对

| 变动 | 性质 | 对已验证真值的影响 |
|------|------|--------------------|
| `.toast[data-cloud] button{…;flex:none}`、`.toast[data-cloud]{width:max-content;max-width:calc(100vw - 32px)}` | 纯 CSS，只作用于云端 toast | 无。没有改 `toast()`、`conflictNotice`、`snapPending` 的任何逻辑。 |
| `#cf-body p:first-child` 改为 `#cf-body p.cf-who` | 纯 CSS 选择器 | 无逻辑影响。换账号确认框（第 754 行，只有一行正文）不再被弱化，符合 UI-SPEC S7。 |
| `confirmBox` 里 `if(i===0&&o.who)p.className="cf-who"`；`onLogoutClick` 传入 `who:true` | 一个 class 钩子 | 无。只改 `<p>` 的 class，文本仍用 `textContent`，不涉及 innerHTML。`lines[0]` 在退出框里确实是 `T_CF_ACCOUNT+账号邮箱` 这一行。`confirmBox` 只有 2 个调用点（换账号、退出），换账号不传 `who`。`logout.spec.ts` 里所有对 `#cf-body` 的断言都是文字断言（`toContainText` / `toHaveText`），不依赖颜色。 |
| `:is(#syncbar,#boot,dialog#confirm) button{font-size:14px}` | 纯 CSS | 无。 |
| `#boot .bar{margin:12px 0 8px}` | 纯 CSS | 无。 |
| `APP_SHA256` 更新 | 随应用同提交更新 | 重算 sha256 为 `c4f37e1b…99005f`，与常量完全一致。 |

diff 里没有任何一行触及 `reconcileOnce`、`resolve`、`settle`、`cloudSave`、`keepConflict`、`resetSession`、`sizeCheck`、`startPb`、SDK 路径与 SRI、登录或退出的逻辑。所以上一份报告里所有基于源码行为和用例的真值，结论原样保留。

## 目标达成情况

### 可观察的真值（ROADMAP 的 5 条成功标准）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 登录页输入账号密码进入应用，刷新或重开浏览器仍保持登录；登录页没有注册入口；密码错误有明确提示 | ✓ VERIFIED（回归检查） | 本次 diff 不涉及登录和会话逻辑。`login.spec.ts`、`session.spec.ts` 在编排器的完整 cloud 套件（114 通过）里通过。 |
| 2 | 退出后本机没有该账号的记录缓存、计划缓存、留底和令牌；另一个账号在同一浏览器登录看不到前一个账号的内容 | ✓ VERIFIED（回归检查） | `resetSession`、`logout()` 没有变动。`onLogoutClick` 只多传了 `who:true`，判断条件（`unsaved||snap`）和 `logout()` 调用顺序不变。`logout.spec.ts` 在完整套件里通过。 |
| 3 | 账号 A 在一台设备记录、复盘、勾选任务、保存力量值后，另一台设备登录 A 看到同一份数据，四个视图按 A 自己的计划显示；账号 B 看到自己的计划和记录 | ✓ VERIFIED（回归检查） | `reconcileOnce` 未变。`multi-device.spec.ts`、`account-data.spec.ts` 在完整套件里通过。 |
| 4 | 联网打开时对账完成前不能编辑；缓存比服务器旧时以服务器为准、旧缓存不被上传；真冲突时最后保存的为准，被覆盖的那版在本机留底且可下载 | ✓ VERIFIED（回归检查） | 上一轮对 T-09-18、T-09-21 的源码核对结论不变：上传前先留底，公告推迟到上传成功之后，启动对账有容量检查。`conflict-snapshot`、`capacity`、`reconcile-gate` 用例在完整套件里通过。8a8f026 没有触及这些函数。 |
| 5 | 浏览器只向同源发请求：Google 字体 `<link>` 已去掉，PocketBase SDK 从同源加载、版本固定；v1 的 154 条用例仍通过 | ✓ VERIFIED | 应用里 `http(s)://` 字面量仍是 0 个，无 googleapis / gstatic。`tools/probe/page/vendor/` 没有变，SRI 与上次一致。默认套件 175 通过含 v1 的 154 条（编排器证据）。 |

**得分：** 5/5 真值通过（0 条仅“存在但行为未验证”）。

### 对 09-CONTEXT 锁定决定的核对

D-01 到 D-11 的状态与上一份报告一致，全部 ✓。本次 diff 没有碰任何一条决定对应的代码。

### 必需产物

| 产物 | 状态 |
|------|------|
| `us-journey-tracker.html` | ✓ VERIFIED，已接线。sha256 `c4f37e1b…99005f` 与 `APP_SHA256` 一致 |
| `tests/cloud/*.spec.ts` | ✓ VERIFIED。未改动；编排器的完整 cloud 套件 114 条全部通过 |
| `tests/support/constants.ts` | ✓ `APP_SHA256` 与实际文件一致 |
| `tests/mocks/pb-server.ts`、`PB-CONTRACT.md`、`pb-faults.spec.ts` | ✓ 未改动 |

### 关键连线

与上一份报告一致，均 ✓ WIRED：`cloudSave` → `keepConflict` → `snapPending` → `conflictNotice`；`reconcileOnce` → `resolve` → `sizeOf`/`CLOUD_MAX` → `held` → `settle` → `showTooLarge`；`resetSession` 清 `snapPending`；`init()` → `cloudInit()` → `startPb` → `enterApp` → `startReconcile`。新增的 `confirmBox({who})` → `<p class="cf-who">` → `#cf-body p.cf-who` 连线完整，选择器与类名一致。

### 数据流（第 4 层）

未变。四个视图的 `state` / `plan` 来自 `getFullList("journey_docs")` 按 `kind` 取，保存走 `update({data, writer})`。✓ FLOWING。

### 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 应用基线 | `sha256sum us-journey-tracker.html` | 与 `APP_SHA256` 一致 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` | 通过（368 个文件） | ✓ PASS |
| 同源 | `grep -c "https\?://" us-journey-tracker.html` | 0 | ✓ PASS |
| 标记注释 | `grep -E "TBD|FIXME|XXX|TODO|HACK"` | 无命中 | ✓ PASS |
| 全部用例（编排器在 HEAD 上跑，我没有重跑） | `npm run test:cloud` / `npm test` | 114 通过 / 175 通过 | ✓ PASS（采信编排器证据） |

### 探针执行

本阶段没有声明 `probe-*.sh` 类探针。Step 7c：跳过。

### 需求覆盖

| 需求 | 来源计划 | 状态 | 证据 |
|------|----------|------|------|
| ACCT-01 | 09-12 | ✓ SATISFIED | 登录和会话用例；`onLogin`、`cloudInit` 未变 |
| ACCT-02 | 09-14 | ✓ SATISFIED | `logout()` 未变；`logout.spec.ts` 通过 |
| SYNC-01 | 09-10 | ✓ SATISFIED | `account-data`、`multi-device`；容量守卫覆盖启动路径 |
| SYNC-05 | 09-09 | ✓ SATISFIED | `reconcile-gate`、`conflict-snapshot`、`capacity` |
| PLAN-01 | 09-10 | ✓ SATISFIED | 示例计划全是合成内容，两账号计划隔离用例通过，隐私检查通过 |
| INFRA-03 | 09-02 | ✓ SATISFIED | 见成功标准 5 |

6 个 ID 都出现在计划的 `requirements` 字段里，REQUIREMENTS.md 里都是 Complete，没有孤立需求。TEST-02 仍是 Pending（Phase 13 收口），ACCT-05 仍是 Pending（Phase 10），符合预期。

### 反模式扫描

本阶段修改的应用和测试文件里，没有 TBD / FIXME / XXX / TODO / HACK。8a8f026 新增的 8 行没有引入空实现或占位内容。其余仍是上次的 6 条 info（IN-01 到 IN-06，不阻塞）。

### 观察（不是缺口）

- **09-SECURITY.md 已更新：** 现在是 `status: verified`、`threats_open: 0`。上一份报告里“台账未更新”的那条文档同步项已经关闭。
- **09-UI-REVIEW.md 里的 4 条代码级警告已处理：** toast 被挤窄、换账号框正文被弱化、新界面按钮字号 13px、启动进度条 10px 边距，都在 8a8f026 里按 UI-SPEC 修了。另外两条警告没有改代码：深色主题对比度没有证据（对应人工项 1）、旧视图标题字体变化未记录为已接受（IN-06，仍是 info，不阻塞）。toast 的修复是代码推断，没有人在 375 px 下实际看过，所以人工项 2 保留。
- 留底已写但还没公告时，工具栏入口一直隐藏，到提示出现才显示。用例明确断言了这一点，属于有意设计。
- 保存失败后 `flush` 在发起保存前就清了内存里的 `dirty`（B5，CONTEXT 已写明由 Phase 10 修，SYNC-06）。本阶段由本机脏缓存保证数据不丢。
- 掉线后的编辑、状态栏的完整行为和实时同步属于 Phase 10。

## 需要人工验证

阶段计划把下列项目明确留给验收（UI-SPEC 的 backstop），自动化测不出。条目与 `09-UAT.md` 一致，只有第 2 条补充了 toast 宽度修复。

### 1. 深色主题外观
**测试：** 深色主题下打开登录页，触发各类横幅和退出确认框
**预期：** 对比度足够，色调可区分，风格一致
**为什么要人看：** 视觉判断，UI 审查也指出深色对比度没有任何计算或截图证据

### 2. 375 px 宽下最长的提示（UI-SPEC E4）
**测试：** 手机宽度下制造一次真冲突，看修复后的 toast
**预期：** 提示不再被压到约 187 px 宽，可换行，“下载留底”按钮可点，不遮挡状态行
**为什么要人看：** UI-SPEC 标为 backstop，需截图核对。8a8f026 已加 `width:max-content;max-width:calc(100vw - 32px)` 和按钮 `flex:none`，这是现在要看的内容

### 3. 375 px 宽下的容量横幅（UI-SPEC E10）
**测试：** 让容量警告出现，再让启动时的“超过上限”横幅出现
**预期：** 文字换行，按钮折到下一行，不挤压文字
**为什么要人看：** 窄屏排版

### 4. 真实浏览器里下载留底
**测试：** Edge 里点“下载留底”，再试拦截或取消保存框
**预期：** 得到不含账号标识的 JSON；取消时留底按 D-10 已删除（已知并接受的代价）
**为什么要人看：** 真实浏览器下载交互

## 缺口摘要

没有缺口。5 条成功标准、6 个需求、D-01 至 D-11 都有源码和通过的用例作证。8a8f026 只改了样式和一个确认框的 class 钩子，没有触及任何云端读写、对账、冲突留底、会话或同源逻辑，上一轮的结论逐条保留，没有回归。剩下的是阶段计划自己声明的 4 项视觉和真实浏览器的人工核对。

---

_验证时间：2026-11-09_
_验证者：Claude（gsd-verifier）_
