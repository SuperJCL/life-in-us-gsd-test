# Phase 1: 测试环境、护栏与本地切片（Harness & Local Slice） - Context

**Gathered:** 2026-11-01
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段在项目内搭起 Playwright Test，用本机 Edge 跑通**一条本地模式（没有 `window.claude`）的端到端用例**，内容包括：

- 一个零依赖的本地静态服务器；
- 自动生效的几道护栏：网络拦截、固定时钟和时区、页面错误、应用文件 sha256 完整性、`.gitignore` 和合成数据标记检查；
- 只支持 local 模式的 `AppHarness`；
- 6 项运行时探针，结论写进仓库。

对应需求：ENV-01..04、SAFE-01..04、MOCK-01、IO-01。

**不在本阶段：**
- `window.claude` mock 和账户模式（Phase 2）；
- 完整的合成 fixture（Phase 2）；
- 各视图的完整用例（Phase 3–5）；
- 修改 `us-journey-tracker.html`（本里程碑第 1–5 阶段都禁止）；
- 推送到 GitHub（由单独的 `/gsd-quick` 任务完成，见 Deferred）。

</domain>

<decisions>
## Implementation Decisions

### 运行体验
- **D-01:** `npm test` 默认无界面（headless）跑完全部用例。另外只加一个快捷脚本 `test:ui`（Playwright UI 模式）。不加 `test:headed`、`test:debug`、`report` 脚本；需要看报告时，在 tests/README 里写明用项目内的 `npx playwright show-report`（不会安装任何东西）。
- **D-02:** 只在失败时保留证据：`trace: 'retain-on-failure'`、`screenshot: 'only-on-failure'`。证据只存在本地 `test-results/`，并被 `.gitignore` 忽略。截图和 trace 会拍到应用源码里写死的个人计划文字，所以绝不能上传或提交。
- **D-03:** 报告器用“终端列表 + HTML”：`[['list'], ['html', { open: 'never' }]]`，HTML 报告不自动弹出。
- **D-04:** `retries: 1`（用户选择）。报告里被标为 flaky（重试后才通过）的用例都算缺陷，必须在本阶段查明原因并修好，不能靠重试掩盖，这样才满足 ENV-04“连续运行结果一致”。

### 语言与命名
- **D-05:** 测试标题（`test()`/`test.describe()` 的名字）用**英文**，开头带需求编号，例如 `IO-01 saves an entry to localStorage and keeps it after reload`。护栏和探针类用例用 `SAFE-0x`、`ENV-0x` 或 `PROBE` 前缀。
- **D-06:** 代码注释，以及 `tests/README.md`、`tests/PROBES.md`、`tests/KNOWN-BUGS.md`（后者 Phase 3 起使用）这些说明文档用**中文**。变量名、函数名、文件名、目录名一律用英文。
- **D-07:** 测试代码用 **TypeScript**（`.ts`），由 Playwright 直接转译，不加 tsconfig，也不做构建。`@types/node` 和 `typescript` 不作为默认依赖。
- **D-08:** 界面上的中文文案（状态栏文字、标签名、按钮文字）集中放在 `tests/support/strings.ts`，用例从这里引用，不在各处散写中文字符串。

### GitHub 与隐私（影响本阶段的部分）
- **D-09:** 仓库会以**公开**仓库推送到 GitHub（账号 SuperJCL）。本阶段新增的所有文件都必须适合公开：没有本机绝对路径（如 `C:/Users/...`），没有真实邮箱，没有真实数据，也不复制应用源码里的个人计划文字（目标任务文本、力量目标数值、预设标签文本）。 — **Reversibility:** one-way — 公开推送后，内容可能已被缓存、fork 或索引，删除也无法收回。
- **D-10:** `us-journey-tracker.html` **不进 git**，只留在本机。SAFE-02 用记录在测试里的 sha256 基线证明它没被改动（当前基线 `2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`）。如果克隆下来的仓库里没有这个文件，测试在启动阶段就要给出清楚的中文提示（例如“请把本地的 us-journey-tracker.html 放到仓库根目录”）并失败，不能报出看不懂的错误。
- **D-11:** 推送前会先运行一个 `/gsd-quick` 任务，内容是：
  - 基础 `.gitignore`；
  - git pre-commit 隐私检查钩子；
  - 清理已提交文档里的本机路径和真实备份文件名；
  - 提交作者改为 `49228728+SuperJCL@users.noreply.github.com`，并重写尚未推送的本地提交。

  本阶段要在这个基础上**追加** `.gitignore` 条目（`node_modules/`、`test-results/`、`playwright-report/`、`blob-report/`、`.planning/research/.cache/` 等）。本阶段的每次提交都必须通过隐私钩子。如果到本阶段执行时这个 quick 任务还没做，执行者要先停下来提醒用户。
- **D-12:** `.claude/settings.local.json` 和 `.claude/` 下的 GSD 安装文件（agents、commands、gsd-core、hooks、scripts 等）不进 git，只有 `.claude/CLAUDE.md` 进 git。

### 沿用的项目级决定（已锁定，见 research/SUMMARY.md 的 Research Conflicts Resolved）
- **D-13:** `@playwright/test` 精确锁定为 `1.64.1`，装在项目内，并提交 `package-lock.json`。浏览器用 `channel: 'msedge'`。严禁 `npx playwright install`、`npm init playwright@latest` 和任何 `-g` 安装。
- **D-14:** 页面由 `tests/support/static-server.cjs`（零依赖 `node:http`）提供：监听 `127.0.0.1`，只提供 `us-journey-tracker.html`；`webServer.reuseExistingServer: false`；不用 `file://` 作为主路径。
- **D-15:** 冻结时间用 `page.clock.setFixedTime(Date.UTC(2026, 2, 18, 12))`，配合 `timezoneId: 'America/New_York'` 和 `locale: 'zh-CN'`。只有少数需要推进定时器的用例才单独启用 `clock.install`。
- **D-16:** 网络护栏：用一个兜底的 `context.route` 只放行应用自己的来源；字体主机（`fonts.googleapis.com`、`fonts.gstatic.com`）直接 abort，并记为“已预期拦截”；其他任何外部请求都让用例失败。再加 `--host-resolver-rules` 作为第二层（由探针验证）。不使用 `setOffline`。
- **D-17:** 所有用例只能从 `tests/support/test.ts` 导入 `test` 和 `expect`。这个出口挂两个 auto fixture：`guard`（网络护栏和页面错误收集，teardown 时断言两者都为空）和 `frozenClock`。注入脚本只用 `addInitScript(fn, arg)` 形式。`workers: 2`。
- **D-18:** local 模式的种子数据用“没有才写入”的 init 函数写进 localStorage，防止 `reload` 时覆盖刚保存的数据。持久化断言的顺序是：先 `expect.poll` 到 localStorage 里有数据，再 `reload`，最后断言 DOM。

### Claude's Discretion
- **探针失败怎么办**（用户没选这个话题，由 Claude 决定）：
  - Edge 无法在不下载任何东西的情况下被驱动：**停下来问用户**（可以提议改用 `PW_CHANNEL=chrome` 调用本机 Chrome），绝不运行安装命令。这一条已锁定。
  - 其他 5 项探针（`--host-resolver-rules`、`reload` 后 `setFixedTime` 是否保持、`expect.poll` 时序、`dragTo`、`clock.install` + `pauseAt`）失败时：**直接改用 SUMMARY.md 里定好的备选方案**，不用问用户。结论、证据、采用的方案写进 `tests/PROBES.md`（中文）。
- 目录细节（`tests/support/`、`tests/e2e/platform/` 等）、helper 怎么拆、`browser.version()` 记在哪，由规划者按 research/ARCHITECTURE.md 决定。
- `tests/README.md` 的结构由 Claude 决定，但至少要写清楚：怎么运行、怎么看报告、应用文件不在仓库里的说明、隐私规则。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 范围与需求
- `.planning/PROJECT.md` — 核心价值、约束（不改应用、不全局安装、只用合成数据、拦截网络）、Out of Scope
- `.planning/REQUIREMENTS.md` — 本阶段需求 ENV-01..04、SAFE-01..04、MOCK-01、IO-01 的原文
- `.planning/ROADMAP.md` §Phase 1 — 目标、5 条成功标准、Notes（探针清单、Edge 失败时的停止规则）

### 调研结论（已裁决）
- `.planning/research/SUMMARY.md` — §Research Conflicts Resolved（必须照做的裁决），§Phase 1（交付物和 6 项探针），§Gaps to Address
- `.planning/research/STACK.md` — `package.json`、`playwright.config.ts`、静态服务器草案，What NOT to Use
- `.planning/research/ARCHITECTURE.md` — `test.extend` fixture 结构、`AppHarness`、网络护栏的三层设计、构建顺序
- `.planning/research/PITFALLS.md` — 本阶段需要防范的 C4、C5、C6、C8、C9、C11、C12、M5、M7、M10、M15

### 被测应用（只读，绝不修改）
- `us-journey-tracker.html` — 本机文件，不在 git 里。重点位置：
  - L7-9：Google Fonts；
  - L245-249：导出和恢复按钮；
  - L291：状态行 `#status`；
  - L356-379：存储选择和 `init()`；
  - L365-367：localStorage 键 `us-journey-tracker-v1`；
  - L408-436：composer。
- `.planning/codebase/TESTING.md` — 原先的测试建议（错误路径部分已延到 v2）
- `.planning/codebase/INTEGRATIONS.md` — store 的选择流程和状态结构

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 仓库里还没有测试代码、`package.json` 或 `.gitignore`，一切从零开始。
- 应用自带稳定的 DOM 钩子可以直接用：
  - 标签：`nav.tabs [data-tab="wk|cal|goal|tl"]`，配合 `aria-selected`；
  - 视图区块：`#tab-wk`、`#tab-cal`、`#tab-goal`、`#tab-tl`；
  - 状态行：`#status`；
  - 导出按钮：`#exportCsv`、`#exportJson`，没有 downloads 时带 `hidden` 类；
  - toast：`#toast`，显示时带 `.on` 类；
  - 本周 composer：`#wkComp` 里的 `#w-text` 和 `#w-add`。

### Established Patterns
- 应用每次改动都会 `renderAll()`，用 `innerHTML` 重建全部 DOM，所以测试不能持有 ElementHandle，只能用 locator。
- 保存有 600 ms 防抖；本地模式下，状态行文案是“已保存在此浏览器中（换设备不会同步）”。
- 四个视图的 DOM 一直都在，只是隐藏，所以 locator 要限定在 `#tab-*` 范围里。

### Integration Points
- 测试只通过 HTTP 加载 `us-journey-tracker.html`，并在页面脚本运行前注入 init script。除此之外，不和应用代码发生任何联系。

</code_context>

<specifics>
## Specific Ideas

- 用户在学习 GSD：`test:ui` 让用户能逐步回放用例；说明文档用中文，方便用户自己读懂。
- 仓库要公开：测试文件和说明文档本身就是展示的一部分，要写得清楚易懂，并且完全不含个人信息。

</specifics>

<deferred>
## Deferred Ideas

- **新增第 6 阶段（当前里程碑）：个人内容外置 + 本地私有目录与查看页**
  - 外置：把应用里写死的个人计划（目标组任务、力量目标、预设标签）搬到本地私有文件（不进 git），应用运行时读取；仓库里只放示例数据，这样克隆的人也能跑测试。
  - 私有目录：本地 `private/` 目录（不进 git）存放真实备份和个人笔记，配一个本地查看页。
  - 这个阶段需要修改应用，要放宽“不改应用”的约束，并同步更新 SAFE-02 的基线。用户已同意把它放进当前里程碑；还没加入 ROADMAP，下一步用 `/gsd-phase` 添加。
- **GitHub 公开推送与隐私护栏**（`/gsd-quick`，在第 1 阶段执行之前做）：内容是 `.gitignore`、pre-commit 隐私检查、清理文档、noreply 作者地址、重写本地提交、创建公开仓库并推送。推送前要再次向用户确认。

</deferred>

---

*Phase: 01-harness-local-slice*
*Context gathered: 2026-11-01*
