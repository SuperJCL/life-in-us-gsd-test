---
phase: 09-login-cloud-storage
verified: 2026-11-09T23:30:00Z
status: passed
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
  - "tests/support/strings.ts"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:61544a435889ad478572a24cfb30d6184d15a61e4a23f7bb1383f86c08feddfe"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 9: 登录与云端存储 验证报告

**阶段目标：** 用户用所有者在后台开好的账号登录后，记录、复盘、任务进度、力量历史和自己的个人计划都从服务器读写，换一台设备登录看到的是同一份数据。打开应用时先和服务器对账，再允许编辑，过期缓存不会覆盖别处的新数据。页面只加载同源资源。
**验证时间：** 2026-11-09
**状态：** passed
**重新验证：** 是（第 3 次）。上一份报告（human_needed）在快速任务 261109-inq 之后失效：应用改名为“计划手记”，`us-journey-tracker.html` 和 `tests/support/constants.ts` 随之变动。

## 本次重新验证做了什么

没有采信 SUMMARY 或提交说明。按下面几步核对，全部是静态检查。没有运行 Playwright、没有启动 PocketBase 或服务器（本机资源约束，且编排器刚在这个代码上跑过全部用例）。

1. 读 `git diff 2da28ea..HEAD -- us-journey-tracker.html` 的全部增删行。改名之外的应用变动是 0 行。
2. 整个范围（`git diff 2da28ea..HEAD --stat`）：17 个文件，应用相关的只有 `us-journey-tracker.html`、`tests/support/*`、三个 e2e 用例（`day-panel`、`synthetic-data`、`repo-hygiene`、`week-view`）、`tools/privacy/privacy-check.mjs`、`.gitignore`、`PRIVACY.md`。`tests/cloud/*.spec.ts`、`tests/mocks/`、`tools/probe/page/vendor/` 都没有变。
3. 重算 `us-journey-tracker.html` 的 sha256：`9a33cbed…986cdba0`，与 `tests/support/constants.ts` 的 `APP_SHA256` 完全一致。
4. 用 `gsd-tools query verification.fingerprint` 重新计算覆盖指纹，写进本报告 frontmatter（两个字段是命令输出的原文）。这次在覆盖清单里加了 `tests/support/strings.ts`，因为它在改名里被改了。
5. 重读云端关键函数是否仍存在并连线、重扫外部地址、标记注释、注册入口，重跑隐私检查。
6. 读 09-UAT.md（4/4 通过）、09-REVIEW.md 与 09-REVIEW-DISPOSITION.md、09-SECURITY.md、261109-inq-SUMMARY.md，并与代码对照。

### 改名 diff 的逐行核对（`us-journey-tracker.html`，24 行改动，12 处）

| 位置 | 变动 | 影响 |
|------|------|------|
| `<title>`、登录页 `#login-title`、页头 `<h1>` | “在美国的日子” 改为 “计划手记” | 只是可见文字。登录、会话、同步逻辑没碰 |
| `label.arrival` 与计数器初值 | “抵达美国”“先设置抵达日期” 改为 “开始日期”“先设置开始日期” | 只是可见文字。输入框 `id="arrival"` 和 `state.arrival` 字段没改，存储格式不变 |
| 计数器、周标题、日面板副标题 | “来美国第 N 天 / N 周”“天出发” 改为 “第 N 天 / N 周”“天开始” | 只是文案。日期计算表达式没有变化 |
| 导出文件名 4 处（留底、日历 CSV、备份 JSON） | 前缀改为 “计划手记-” | 只是文件名。留底仍然不含账号标识；新前缀已进隐私规则和 `.gitignore` |

diff 里没有任何一行触及 `reconcileOnce`、`resolve`、`settle`、`cloudSave`、`keepConflict`、`resetSession`、`logout`、`startPb`、SDK 路径和 SRI。上一轮基于这些函数得出的结论原样保留。这些函数在当前文件里都仍然存在（`startPb` 643 行、`startReconcile` 842、`enterApp` 867、`reconcileOnce` 882、`keepConflict` 941、`cloudSave` 988、`resetSession` 1039、`logout` 1059、`onLogoutClick` 1075）。

## 目标达成情况

### 可观察的真值（ROADMAP 的 5 条成功标准）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 登录页输入账号密码进入应用，刷新或重开浏览器仍保持登录；登录页没有注册入口；密码错误有明确提示 | ✓ VERIFIED | 应用里没有注册、重置密码入口（grep 无命中）。登录和会话代码在本轮没有改动。`login.spec.ts`、`session.spec.ts` 在编排器的完整云端套件（114 通过）里通过 |
| 2 | 退出后本机没有该账号的记录缓存、计划缓存、留底和令牌；另一个账号在同一浏览器登录看不到前一个账号的内容 | ✓ VERIFIED | `resetSession`、`logout`、`onLogoutClick` 没有变动；`logout.spec.ts` 在完整套件里通过 |
| 3 | 账号 A 在一台设备记录、复盘、勾选任务、保存力量值后，另一台设备登录 A 看到同一份数据，四个视图按 A 自己的计划显示；账号 B 看到自己的计划和记录 | ✓ VERIFIED | 数据读写走 `journey_docs`（按 `kind` 取 `state` 和 `plan`，`create` 和 `update` 在 886 到 997 行）。`multi-device.spec.ts`、`account-data.spec.ts` 在完整套件里通过 |
| 4 | 联网打开时对账完成前不能编辑；缓存比服务器旧时以服务器为准、旧缓存不被上传；真冲突时最后保存的为准，被覆盖的那版在本机留底且可下载 | ✓ VERIFIED | `reconcileOnce` 里按 `c.base`、`sv.updated`、`sv.writer`、`canon` 判断冲突，上传前先 `keepConflict` 留底（907 到 908 行；保存路径 996 到 997 行）。`reconcile-gate`、`conflict-snapshot`、`capacity` 在完整套件里通过。UAT 第 4 项（真实 Edge 下载留底）所有者已确认 |
| 5 | 浏览器只向同源发请求：Google 字体 `<link>` 已去掉，PocketBase SDK 从同源加载、版本固定；v1 的 154 条用例仍通过 | ✓ VERIFIED | 应用里 `http(s)://` 字面量 0 个，没有 `<link>`、googleapis、gstatic、`@import`。SDK 从 `/vendor/pocketbase.iife.js` 加载并带 SRI（632、637 行）；`tools/probe/page/vendor/` 没有变。默认套件 176 通过（含 v1 的 154 条），0 失败 |

**得分：** 5/5 真值通过。0 条“存在但行为未验证”。

### 人工验证（UAT）

上一份报告列出的 4 条人工项，现在 09-UAT.md（status complete）记录所有者 4/4 通过，0 个问题：

| # | 项目 | 结果 |
|---|------|------|
| 1 | 深色主题下的登录页、横幅、退出确认框 | pass |
| 2 | 375 px 宽下最长的提示（UI-SPEC E4，含 8a8f026 的宽度修复） | pass |
| 3 | 375 px 宽下的容量横幅（UI-SPEC E10，含启动路径的“超过上限”横幅） | pass |
| 4 | 真实浏览器（Edge）里下载留底，D-10 | pass |

UAT 在改名之前开始，更新于改名之后（改名只改文字，不影响这 4 项的布局判断依据；所有者在更新时间点之前已确认）。没有剩余的人工验证项。

### 必需产物

| 产物 | 状态 |
|------|------|
| `us-journey-tracker.html` | ✓ 已接线。sha256 与 `APP_SHA256` 一致 |
| `tests/cloud/*.spec.ts`（登录、会话、退出、多设备、账号数据、对账门控、冲突留底、容量、同源） | ✓ 未改动；完整云端套件 114 通过 |
| `tests/support/constants.ts`、`tests/support/strings.ts` | ✓ 随应用更新，`APP_SHA256` 与实际文件一致 |
| `tests/mocks/pb-server.ts`、`PB-CONTRACT.md` | ✓ 未改动 |
| `tools/probe/page/vendor/pocketbase.iife.js` 及校验和 | ✓ 未改动，与 SRI 对应 |

### 关键连线

`init()` → `cloudInit()` → `startPb` → `enterApp` → `startReconcile` → `reconcileOnce`（`resolve` → `settle`）；`cloudSave` → `keepConflict` → `conflictNotice`；`logout` → `resetSession`。函数都存在，调用关系没有变化。✓ WIRED。

### 数据流（第 4 层）

四个视图的 `state` 和 `plan` 来自服务器 `journey_docs` 文档，保存走 `coll.update(id, {data, writer})`。示例计划全是合成内容。✓ FLOWING。

### 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 应用基线 | `sha256sum us-journey-tracker.html`，对照 `APP_SHA256` | 一致 | ✓ PASS |
| 同源 | `grep -c "https\?://" us-journey-tracker.html` | 0 | ✓ PASS |
| 标记注释 | `grep -E "TBD\|FIXME\|XXX\|TODO\|HACK"`，覆盖应用、云端用例、常量 | 无命中 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` | 通过（370 个文件） | ✓ PASS |
| 全部用例（编排器在当前代码上跑，我没有重跑） | `npm test` / `npm run test:cloud` | 176 通过 / 114 通过，0 失败 | ✓ PASS（采信编排器证据） |

### 探针执行

本阶段没有声明 `probe-*.sh` 类探针。Step 7c：跳过。

### 需求覆盖

| 需求 | 来源计划 | 状态 | 证据 |
|------|----------|------|------|
| ACCT-01 | 09-12 | ✓ SATISFIED | 登录、会话用例；无注册入口 |
| ACCT-02 | 09-14 | ✓ SATISFIED | `logout`、`resetSession`；`logout.spec.ts` |
| SYNC-01 | 09-10 | ✓ SATISFIED | `account-data`、`multi-device`；`journey_docs` 读写 |
| SYNC-05 | 09-09 | ✓ SATISFIED | `reconcile-gate`、`conflict-snapshot`、`capacity`；UAT 第 4 项 |
| PLAN-01 | 09-10 | ✓ SATISFIED | 计划存在账号自己的 `plan` 文档；示例计划为合成内容；隐私检查通过 |
| INFRA-03 | 09-02 | ✓ SATISFIED | 成功标准 5：同源、SRI、无字体外链 |

6 个需求 ID 都在计划的 `requirements` 字段里，REQUIREMENTS.md 里都是 `[x]` 且追踪表为 Complete，没有孤立需求。

### 反模式扫描

本阶段修改的应用和测试文件里，没有 TBD、FIXME、XXX、TODO、HACK。改名 diff 没有引入空实现、占位或 `console.log`。

### 代码审查与安全

- **代码审查（09-REVIEW.md）：** 0 个 critical，2 个 warning，5 个 info。上一轮的 2 个 critical 和 7 个 warning 复审时已核实修好。
- **安全（09-SECURITY.md）：** `status: verified`，`threats_open: 0`。

### 已知的残余项（警告，不是缺口，不阻塞）

这两条 warning 在审查里是 open。它们都不使任何一条成功标准失败：

- **WR-01：** `WRITER=uid()` 每次页面加载重新生成（632 行）。窄路径下（保存已成功但答复丢了，之后又改了一笔，然后刷新），自己上次的写入会被当成“另一台设备”，误弹“已被覆盖”提示并替换唯一的留底。审查明确写了内容不丢，留底内容是本机内容的子集。这是已知残余，推迟到 Phase 10（实时同步按 `writer` 做回声抑制，正是 `writer` 语义落定的阶段）。建议 Phase 10 把 `writer` 放进 `sessionStorage`，并补一条用例。
- **WR-02：** `cloudSave` 的请求没有超时，挂住的 PATCH 会让后面的保存排队，`resetSession()` 不重置 `saving`。修改仍在本机缓存里，不丢，但用户一段时间看不到失败提示。Phase 10 的 SYNC-06（失败自动退避重试）覆盖这一类问题（ROADMAP Phase 10 第 4 条成功标准）。

5 条 info（IN-01 到 IN-05，加上上一轮的 IN-06 字体变化）都是体验或整洁性问题，不阻塞。

## 缺口摘要

没有缺口。5 条成功标准、6 个需求都有源码和通过的用例作证。自上一份报告以来只发生了应用改名（纯文字和导出文件名），没有触及任何云端读写、对账、留底、会话或同源逻辑，没有回归。上一份报告里 4 项人工验证已由所有者全部通过，状态因此从 human_needed 变为 passed。WR-01 和 WR-02 是已记录的残余，留给 Phase 10。

---

_验证时间：2026-11-09_
_验证者：Claude（gsd-verifier）_
