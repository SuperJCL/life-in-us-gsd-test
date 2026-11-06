---
phase: 01-harness-local-slice
verified: 2026-11-02T05:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/01-harness-local-slice/01-01-PLAN.md
  - .planning/phases/01-harness-local-slice/01-01-SUMMARY.md
  - .planning/phases/01-harness-local-slice/01-02-PLAN.md
  - .planning/phases/01-harness-local-slice/01-02-SUMMARY.md
  - .planning/phases/01-harness-local-slice/01-03-PLAN.md
  - .planning/phases/01-harness-local-slice/01-03-SUMMARY.md
  - .planning/phases/01-harness-local-slice/01-04-PLAN.md
  - .planning/phases/01-harness-local-slice/01-04-SUMMARY.md
  - package-lock.json
  - package.json
  - playwright.config.ts
  - tests/PROBES.md
  - tests/README.md
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/environment.spec.ts
  - tests/e2e/platform/guardrails.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/e2e/platform/repo-hygiene.spec.ts
  - tests/e2e/smoke.spec.ts
  - tests/fixtures/local-seed.json
  - tests/support/app.ts
  - tests/support/constants.ts
  - tests/support/static-server.cjs
  - tests/support/strings.ts
  - tests/support/test.ts
covered_digest: "v4:sha256:d6369b055ad9106185a3c162464669e40331328da63d5ecd1e6cf67c0ea4d657"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items:
  - truth: "MOCK-01：本地模式下，任何记录之前 localStorage 里没有应用的键"
    reason: incidental-ordering
    harden: "目前只在状态行就绪时采样一次，而保存有 600 ms 防抖，所以即使启动路径以后会写存储，这条断言也会先通过（WR-06）。当前通过的原因是应用的 init 不调用 persist（已读源码确认）。要固定这个前提，需要持续观察一个超过防抖的窗口，或用 manual 时钟 runFor(700) 后再断言"
---

# Phase 1：测试环境、护栏与本地切片 验证报告

**阶段目标：** 开发者在项目目录运行 `npm test`，就能用本机 Edge 跑通一条本地模式的端到端用例。网络拦截、固定时钟、页面错误和应用完整性这几道护栏从第一条用例起就自动生效，后续阶段依赖的运行时假设都已经用探针验证过。
**验证时间：** 2026-11-02
**状态：** passed（有 6 条非阻塞警告，见下）
**重新验证：** 否，首次验证

结论依据的是代码和我自己的运行结果，不是 SUMMARY 的说法。验证者独立运行了两次 `npm test`（均 25 passed，0 unexpected，0 flaky，0 次重试，两次的用例标题、状态、结果数逐项相同），并重新计算了应用文件的 sha256。

## 目标达成情况

### 可观察的真值（来自 ROADMAP 成功标准 1 到 5）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | `npm test` 用本机 Edge 跑完全部用例并生成本地 HTML 报告（不自动弹出）；只新增精确版本的 `@playwright/test` devDependency 和 lockfile，没有下载浏览器，没有全局安装或改全局配置 | ✓ VERIFIED | `package.json` 的 `test` 脚本是 `playwright test`，devDependency 为 `"@playwright/test": "1.64.1"`（无 `^` 或 `~`）。`playwright.config.ts` 的 `channel` 默认 `msedge`，HTML 报告器配置为 `open: 'never'`，`playwright-report/index.html` 在运行后存在。`package-lock.json` 只有三个包条目（`@playwright/test`、`playwright`、`playwright-core`），都是 1.64.1，来源是 npm 官方 registry。`git log` 显示 `package.json` 和 lockfile 只在 12d6bd9 一次提交里新增。`npm ls -g --depth=0` 里没有 playwright。浏览器缓存目录 `ms-playwright` 存在但是空的（大小 0，只有一个空的 `.settings` 子目录，没有任何浏览器），见下面的信息项 |
| 2 | 本地模式端到端用例：页面来自只监听 127.0.0.1、只提供应用文件的服务器；无 `window.claude`；四个标签能切换；记一笔后 localStorage 有数据，刷新后仍在；导出按钮不出现；预置合成种子启动同样通过，且刷新后新数据不被种子覆盖 | ✓ VERIFIED | `tests/e2e/smoke.spec.ts` 四条用例全部通过：IO-01 往返（fill、add、`expectPersisted`、`reload`、断言 DOM）；IO-01 导出按钮带 `hidden` 类且不可见；MOCK-01 `'claude' in window` 为 false，四个标签逐个点击后 `aria-selected` 和对应 `#tab-*` 可见性正确；MOCK-01 种子用例（种子条目可见、再记一笔、两条都落盘、reload 后两条仍在，且落盘状态同时含两条）。服务器部分见真值表后的“服务器证据”。种子“没有才写”是行为型真值，由该用例的 reload 步骤实际执行：若去掉“没有才写”，reload 会用种子覆盖新数据，用例会失败 |
| 3 | “今天”固定为 2026-03-18（周三），时区 `America/New_York`，语言 zh-CN；连续两次运行结果完全一致 | ✓ VERIFIED | `environment.spec.ts` 断言 `Date.now()` 等于 `Date.UTC(2026, 2, 18, 12)`、年月日 2026-3-18、星期 3、时区、`navigator.language`；另一条断言应用渲染的周范围 `3月16日 – 22日`，且恰好一个 `.today` 列是 2026-03-18。`frozenClock` 是 auto fixture，在导航前 `setFixedTime`。PROBE-3 证明 reload 后仍然冻结。我连续运行两次，用 JSON 报告器对比，25 条用例的文件、标题、状态、结果数完全相同 |
| 4 | 护栏自检全部通过：外部地址请求使测试失败；未预期 JS 错误使测试失败；sha256 与基线一致；`.gitignore` 忽略测试产物和备份类 JSON；合成标记检查对缺标记 fixture 报错 | ✓ VERIFIED | `guardrails.spec.ts` 四条：fetch `https://example.com/` 被拒绝并记入 `unexpectedRequests`，`guardViolations` 非空；字体主机只记入 `expectedAborts`；`queueMicrotask` 抛出的异常进入 `pageErrors`；`console.error` 被记录而字体噪音被显式信号过滤。teardown 与自检共用同一个 `guardViolations`，teardown 在 `use()` 之后断言其为空，所以自检证明的就是真实用例走的失败路径。`app-integrity.spec.ts` 的 SAFE-02 用 `createHash` 比对基线。`repo-hygiene.spec.ts` 用 `git check-ignore` 检查 8 个应忽略路径并有 2 个“不应忽略”的对照，另有合成标记检查和“缺标记会被报告”的反向自检（`notes.txt`、`unmarked.json` 被报出） |
| 5 | 六项运行时探针都有结论并记录在仓库里 | ✓ VERIFIED | `tests/e2e/platform/probes.spec.ts` 有 PROBE-1 到 PROBE-6 共 8 条用例，每次 `npm test` 都运行并通过；`tests/PROBES.md` 逐项记录结论、证据和采用的方案。PROBE-1：`browser.version()` 为 156.0.4314.58（我的运行输出一致）。PROBE-2：分解析层、代理层、route 看不到的流量三条，且如实写明 preconnect 没有被直接观察到、解析层的证明边界。PROBE-3、4、5、6 都有硬断言（reload 后 `Date.now()` 不变；防抖耗时在 500 到 5000 ms；`dragTo` 后落盘日期改变；暂停时钟后可操作性检查正常、toast 的 `on` 类按 `runFor(1800)` 消失） |

**得分：** 5/5 真值通过，0 个“存在但行为未证明”的真值。

### 服务器证据（ENV-03，是 STATE.md 里被接受的警告之一）

| 检查 | 结果 |
|------|------|
| 只提供应用文件 | `/` 与 `/us-journey-tracker.html` 返回 200、`text/html`、`no-store`；`/package.json`、`/tests/support/static-server.cjs`、`/.git/config`、`/favicon.ico`、`/%2e%2e/package.json` 全部 404。服务器代码是精确路径白名单，不拼接文件路径 |
| 穿越检查不是空操作 | 用 `node:http` 发原始请求（不经过客户端规范化）：`/%2e%2e/`、`/%2E%2E/`、`/../`、`/..%2f`、`/us-journey-tracker.html/../`、`/%2e%2e/%2e%2e/.git/config` 都得到 404，且响应体不含 `playwright` |
| 只监听 127.0.0.1 | 有运行时证据：回环连通作对照；本机的非回环 IPv4 地址全部连不上；`::1` 连不上。该用例在本机实际执行，没有被 `test.skip` 跳过（JSON 报告 `skipped: 0`）。服务器代码是 `listen(PORT, '127.0.0.1')` |
| 端口被占用不复用 | `reuseExistingServer: false` |

### 必需的产物

| 产物 | 预期 | 状态 | 细节 |
|------|------|------|------|
| `package.json` / `package-lock.json` | 精确版本 devDependency 与 lockfile | ✓ VERIFIED | 见真值 1 |
| `playwright.config.ts` | Edge 通道、两层浏览器级网络兜底、固定语言时区、HTML 报告 `open: 'never'`、`workers: 2`、`retries: 1` | ✓ VERIFIED | `launchOptions` 同时配了 `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1` 和死代理 `127.0.0.1:9`（bypass 只有 `127.0.0.1,localhost`）；`serviceWorkers: 'block'`、`acceptDownloads: false`；`PW_JSON_REPORT` 才追加 json 报告器 |
| `tests/support/static-server.cjs` | 零依赖、只绑 127.0.0.1、白名单 | ✓ VERIFIED | 缺应用文件时在 `listen` 之前以中文提示退出 |
| `tests/support/test.ts` | 唯一的 `test` 出口，auto fixture：`guard`、`frozenClock` | ✓ VERIFIED | 全部 spec 只从这里导入（grep 确认 `tests/e2e` 下没有 spec 直接导入 `@playwright/test`，类型也经由它导出） |
| `tests/support/app.ts` | `AppHarness`（open、ready、reload、persisted、expectPersisted）与“没有才写”的种子函数 | ✓ VERIFIED | 被 smoke 与探针使用 |
| `tests/support/constants.ts`、`strings.ts` | 常量与文案集中 | ✓ VERIFIED | 没有抄入应用里的个人计划文字 |
| `tests/e2e/smoke.spec.ts`、`tests/e2e/platform/*.spec.ts`（4 个） | 本地切片、护栏、时钟、完整性、卫生、探针 | ✓ VERIFIED | 共 25 条，全部通过 |
| `tests/fixtures/local-seed.json` | 带 `_synthetic` 的合成种子 | ✓ VERIFIED | 顶层 `_synthetic` 为非空字符串，内容为 `SYNTH-` 前缀的合成文本 |
| `tests/PROBES.md`、`tests/README.md` | 探针结论与中文说明 | ✓ VERIFIED | 内容与用例一致；README 有一处措辞偏强，见 WR-04 |

### 关键链接

| 从 | 到 | 方式 | 状态 | 细节 |
|----|----|------|------|------|
| `npm test` | Edge | `channel: 'msedge'`，`playwright test` | ✓ WIRED | 运行输出 `browser.version() = 156.0.4314.58` |
| `playwright.config.ts` | 静态服务器 | `webServer.command` 运行 `node tests/support/static-server.cjs` | ✓ WIRED | 页面都来自 `http://127.0.0.1:4789` |
| `test.ts` guard | 所有用例 | `{ auto: true }`，teardown 的 `guardViolations` 断言 | ✓ WIRED | 自检与 teardown 共用函数 |
| `test.ts` frozenClock | 所有用例 | `{ auto: true }`，`page.clock.setFixedTime`；`clockMode: 'manual'` 时让路 | ✓ WIRED | PROBE-6 走 manual 路径并通过 |
| `AppHarness.open({ seed })` | 应用 localStorage | `addInitScript(seedLocalStorageIfAbsent, arg)` | ✓ WIRED | 种子用例证明 reload 不覆盖 |
| `launchOptions` | 手动创建的 context（探针） | 浏览器级参数继承 | ✓ WIRED | PROBE-2 的无 route context 仍被死代理拒绝 |

### 数据流追踪（第 4 级）

这是纯测试工程，没有渲染动态数据的产物。持久化链路是：UI 输入、应用 `persist`（600 ms 防抖）、localStorage、`AppHarness.persisted()` 读回、reload 后 DOM。smoke 用例逐段断言了这条链路，状态为 ✓ FLOWING。

### 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 全部用例通过 | `npm test`（运行两次） | 25 passed，0 unexpected，0 flaky，无重试，两次结果逐项相同 | ✓ PASS |
| 应用文件未被改动 | `sha256sum us-journey-tracker.html` | `2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`，与基线一致 | ✓ PASS |
| 应用文件未被跟踪 | `git ls-files`、`git check-ignore -v` | 不在跟踪列表；被 `.gitignore` 第 5 行 `/us-journey-tracker.html` 忽略 | ✓ PASS |
| 隐私全量检查 | `node tools/privacy/privacy-check.mjs --all` | 通过，56 个文件 | ✓ PASS |
| 全局没有安装 Playwright | `npm ls -g --depth=0` | 没有 playwright | ✓ PASS |

### 探针执行

SUMMARY 对探针的陈述没有被当作证据。六项探针就是 `probes.spec.ts` 里的用例，我在自己的进程里运行了整套，8 条探针用例全部通过。

| 探针 | 命令 | 结果 | 状态 |
|------|------|------|------|
| PROBE-1 | `npm test` | 156.0.4314.58 | PASS |
| PROBE-2（解析层） | `npm test` | `localhost`、`probe.localhost` 为 `ERR_NAME_NOT_RESOLVED`，`127.0.0.1` 返回 404，对照浏览器里 `localhost` 返回 404 | PASS |
| PROBE-2（代理层） | `npm test` | `http://` 与 `https://` 的 `.invalid` 地址为 `ERR_PROXY_CONNECTION_FAILED` | PASS |
| PROBE-2（route 看不到的流量） | `npm test` | 录制代理看到 `www.bing.com:443` 3 条、`edge.microsoft.com:443` 2 条、`probe.invalid:80` 1 条（WebSocket 对照），字体主机 0 条 | PASS（preconnect 未被直接观察到，文档已如实记录） |
| PROBE-3 | `npm test` | reload 前后 `Date.now()` 不变 | PASS |
| PROBE-4 | `npm test` | 防抖保存可被 `expect.poll` 稳定观察 | PASS |
| PROBE-5 | `npm test` | `dragTo` 驱动 HTML5 拖放成功 | PASS |
| PROBE-6 | `npm test` | `install`、`pauseAt`、`runFor` 顺序可用 | PASS |

### 需求覆盖

PLAN 前置信息里声明的需求编号并集为：01-01 的 ENV-01、ENV-02、ENV-03、ENV-04、SAFE-01、IO-01；01-02 的 SAFE-01、SAFE-02、SAFE-03、SAFE-04、ENV-03、ENV-04；01-03 的 MOCK-01、IO-01、ENV-01、ENV-04、SAFE-01；01-04 的 ENV-01、ENV-04。并集恰为 ROADMAP 声明的 10 个编号，无遗漏。`REQUIREMENTS.md` 中映射到 Phase 1 的编号也是这 10 个，没有孤立需求。

| 需求 | 来源计划 | 描述 | 状态 | 证据 |
|------|----------|------|------|------|
| ENV-01 | 01-01、01-03、01-04 | `npm test` 用本机 Edge 跑完并得到本地 HTML 报告，不自动弹出 | ✓ SATISFIED | 配置 `open: 'never'`；25 条通过；报告文件生成 |
| ENV-02 | 01-01 | 只增加项目内精确版本 devDependency 和 lockfile，不下载浏览器、不全局安装 | ✓ SATISFIED | 见真值 1。浏览器数据为 0 字节 |
| ENV-03 | 01-01、01-02 | 本地静态服务器只监听 127.0.0.1、只提供应用文件 | ✓ SATISFIED | 见“服务器证据”（含运行时证据和原始穿越检查） |
| ENV-04 | 01-01、01-02、01-03、01-04 | 固定今天、时区、语言，结果可重复 | ✓ SATISFIED | `environment.spec.ts` 加连续两次相同结果 |
| SAFE-01 | 01-01、01-02、01-03 | 外部网络请求被拦截，白名单之外的外部请求让测试失败 | ✓ SATISFIED | HTTP 请求由 route 拦截并使测试失败；非 HTTP 的出网尝试被兜底层挡住但不会使测试失败，见 WR-05 |
| SAFE-02 | 01-02 | 能证明应用文件没被改动（sha256 基线） | ✓ SATISFIED | `app-integrity.spec.ts`；我的独立计算一致 |
| SAFE-03 | 01-02 | `.gitignore` 忽略测试产物和备份类 JSON；fixture 带合成标记并有测试检查 | ✓ SATISFIED | `repo-hygiene.spec.ts` 三条，含反向自检 |
| SAFE-04 | 01-02 | 未预期的 JS 错误使测试失败 | ✓ SATISFIED | `pageerror` 与 `console.error` 都被 guard 记录并在 teardown 失败 |
| MOCK-01 | 01-03 | 本地模式打开应用：无 `window.claude`，可预置 localStorage | ✓ SATISFIED | smoke 的两条 MOCK-01 用例 |
| IO-01 | 01-01、01-03 | 本地模式保存到 localStorage，刷新后仍在；导出按钮隐藏 | ✓ SATISFIED | smoke 的两条 IO-01 用例 |

### STATE.md 里被接受的 6 条计划检查警告：实际处理情况

| 警告 | 实际处理 | 结论 |
|------|----------|------|
| ENV-03 缺运行时证据 | 增加了 LAN 地址与 `::1` 的连接检查，带回环对照，本机实际执行未跳过 | 已解决（`::1` 一项没有对照，见 IN-03） |
| `/%2e%2e/` 可能被客户端规范化而变成空操作 | 增加了 `node:http` 原始请求用例，6 种原始路径全部 404 | 已解决 |
| SAFE-04 控制台过滤应急路径覆盖不全 | 过滤按 `msg.location().url` 的主机是否在字体白名单判断，不按通用文本；自检先轮询到 `filteredConsoleNoise` 非空再断言 `consoleErrors` 为空。favicon 应急没有被触发 | 已解决 |
| PROBE-2 证人是 localhost（在 bypass 里），回退可能让探针在保证失效时仍通过 | 增加了 `probe.localhost` 证人、去掉规则的对照浏览器，并在 PROBES.md 写明边界。解析层和代理层的断言是硬断言。但 PROBE-2c 仍然不能对“直连泄漏”报警，见 WR-03 | 部分解决：解析层、代理层已证明，“只会到达代理”这条没有被证明 |
| 01-03 Task 2 范围过大 | 按计划完成，4 项自动修复都在探针内部 | 已执行完毕，无后果 |
| 01-01 的部分真值是配置字面量 | 后续由 PROBE-2、环境用例、护栏自检用实际行为证明 | 已解决 |

### 代码审查警告对真值的影响

01-REVIEW.md（0 个严重、6 个警告、7 个信息，全部 open）是建议性输入。下面只列对必需真值有影响的几条，均不构成阻塞：

| 编号 | 对真值的影响 |
|------|--------------|
| WR-03 | PROBE-2c 的标题写成“only ever reaches the proxy”，而实际断言只证明 WebSocket 对照行进入代理，直连泄漏时它也会通过。PROBES.md 已如实写“preconnect 没有被直接观察到、结论是推断”，所以成功标准 5 的“有结论并记录”成立，只是用例标题的措辞比证据强 |
| WR-04 | `tests/README.md` 第 7 节写“解析层已证明：不在代理名单里的名字都是 `ERR_NAME_NOT_RESOLVED`”，与 PROBES.md 的实测矛盾（实测只对 bypass 里的回环名成立，经过代理的名字是 `ERR_PROXY_CONNECTION_FAILED`）。我核对过，这是一处真实的文档夸大，会误导后续阶段对网络保证范围的判断 |
| WR-05 | guard 只在 `context.route` 里记录 HTTP 请求。非 HTTP 出网尝试（如 WebSocket）会被代理层挡住，但不会让任何用例变红。SAFE-01 的“外部请求被拦截”成立，“出现白名单外的外部请求则测试失败”只对 HTTP 请求成立 |
| WR-02 | `guard.reset()` 清空全部五个数组，自检用例里同时出现的真实违规会被一并清掉。只影响三个自检用例，不影响普通用例 |
| WR-01 | 静态服务器不校验 Host 头也不限制方法，存在 DNS rebinding 的理论窗口。ENV-03 的“只监听 127.0.0.1、只提供应用文件”仍然成立 |
| WR-06 | 见前置信息的 `coincidental_reliance_items` |

### 发现的反模式

| 文件 | 行 | 模式 | 严重性 | 影响 |
|------|----|------|--------|------|
| 本阶段修改的文件 | - | `TBD`、`FIXME`、`XXX` 债务标记 | 无 | 没有发现 |
| `tests/e2e/platform/probes.spec.ts` | 约 166 | `.catch(() => {})` 吞掉所有错误，而不只是超时 | ⚠️ 警告 | 已在 WR-03 中记录，不影响通过 |
| `tests/e2e/platform/probes.spec.ts` | 18、166 | 探针里的 `console.log` | ℹ️ 信息 | 项目约定代码不打 console，探针留痕用途，已有 annotation |
| `tests/PROBES.md` | 12 | 记录日期写 2026-11-02 | ℹ️ 信息 | 与运行日期一致（UTC），无影响 |
| `tests/PROBES.md` | PROBE-1 一节 | “Edge 升级到主版本小于 155 时会变红”方向写反（IN-01） | ℹ️ 信息 | 仅文档措辞 |

### 需要人工验证的事项

无未完成项。阶段末的人工验收（01-04 Task 2）已由用户亲自完成并批准：`npm run test:ui` 打开并逐步回放了 IO-01；`npx playwright show-report` 在 http://localhost:9323 提供了报告，内嵌终端没有自动打开浏览器，手动打开地址后报告正常加载，README 已补充这一说明。

### 信息项：Playwright 缓存目录

`01-01-SUMMARY.md` 记录“安装后 `ms-playwright` 目录不存在”，这是当时的事实。现在该目录存在（创建时间对应 01-04 的 UI 模式人工验收阶段），但它是空的：只有一个空的 `.settings` 子目录，没有任何浏览器，总大小 0 字节。这是 Playwright 自己（最可能是 UI 模式）创建的，位于仓库之外，不含下载内容。ENV-02 的意图（不下载浏览器、不全局安装）成立；01-01 计划里“没有出现缓存目录”的字面表述已不再成立，仅作记录，不构成缺口。

## 缺口总结

没有缺口。五条成功标准全部有代码和运行结果支撑，10 个需求编号全部满足，没有孤立需求，应用文件的 sha256 与基线一致且未被跟踪，隐私全量检查通过。

后续阶段开始前建议处理（都不阻塞 Phase 2）：
1. 修正 `tests/README.md` 第 7 节解析层措辞（WR-04），否则会把网络保证的范围说大。
2. 把 PROBE-2c 的标题改成与断言一致（WR-03），并让 guard 记录 WebSocket 与被兜底层拒绝的请求（WR-05），使“出网尝试可见”对非 HTTP 流量也成立。
3. 给 `guard.reset()` 换成按条件移除（WR-02），给静态服务器加 Host 与方法校验（WR-01），把 MOCK-01 的“启动时不写存储”改成持续观察（WR-06）。

---

_验证时间：2026-11-02_
_验证者：Claude（gsd-verifier）_
