# 在美国的日子 — 本地测试实验

## What This Is

「在美国的日子」是一个从 Claude Artifact 导出的个人单文件网页应用（`us-journey-tracker.html`），用来每天记录语言、专业、健身、求职方面的进展，有本周、日历、目标、时间线四个视图。本项目是一次 **GSD 工作流学习实验**：在本地副本上为它搭建 Playwright 浏览器测试环境和 Claude Artifact API（`db` / `user` / `downloads`）的 mock，用合成数据验证现有功能。原托管的 Claude Artifact 始终保持不动。

**v1.0（2026-11-05 交付）：** 本地测试环境已完成，`npm test` 一条命令跑 154 条用例，覆盖四个视图、导入导出和窄屏布局。

**v2.0（进行中）：** 把它做成 3 个人各自登录的网页应用。数据存在用户自己的云服务器上（PocketBase），手机和电脑实时同步，中国和美国都能访问。原 Claude Artifact 仍然不动。

## Core Value

3 个人各自在手机和电脑上随时记一笔：记录按账号隔离、不会丢失，并且在设备之间实时同步，中国和美国都能访问。

（v1.0 的核心价值是：不改应用、不接触真实数据，一条命令自动验证四个视图。这套测试在 v2.0 继续当回归防线。）

## Current Milestone: v2.0 多账号云端版（Multi-account Cloud）

**Goal:** 把「在美国的日子」做成 3 个人各自登录、数据存在自己云服务器上、手机和电脑实时同步的网页应用，中国和美国都能访问。

**Target features:**
- 账号：用户在 PocketBase 后台开 3 个账号，不开放注册；每个账号只能看、只能改自己的数据
- 数据：每个账号一份记录（沿用现有状态格式），同一账号的多台设备实时同步
- 个人计划：目标组、任务、力量项、预设标签存进各自账号，应用里新增“编辑计划”页面
- 导出导入：按账号下载 JSON 备份、导入恢复；用户在原 Artifact 里的数据靠导出再导入搬到新账号
- 断网：先存本地，联网后自动上传；冲突时以最后上传为准
- 界面：保留现有四个视图，只加登录页和编辑计划页
- 部署：腾讯云 Lighthouse 香港加 PocketBase，Porkbun 域名，HTTPS 和数据备份自动完成
- 仓库：去掉个人计划后的应用程序放进公开仓库，克隆后能跑但没有任何用户数据
- 测试：v1.0 的测试改用模拟后端继续跑，不连真实服务器

## Requirements

### Validated

<!-- 现有应用已具备的能力（从代码推断，见 .planning/codebase/）。本里程碑只测试，不改动。 -->

- ✓ 设置抵达日期，页头显示“来美国第 N 天”或“还有 N 天出发” — existing
- ✓ 本周视图：五个类别的本周统计和目标、7 天记录列、点选某天补记、拖拽记录换日期、本周复盘文本 — existing
- ✓ 日历视图：月历格子显示记录/到期/完成标记，切换月份，选中某天后在日面板记录和查看 — existing
- ✓ 目标视图：四项力量目标的当前值和历史，P1–P7 目标组的任务勾选、截止日期、过期提示、自定义待办增删、进度条 — existing
- ✓ 时间线视图：按月倒序列出记录和完成的计划，按类别筛选 — existing
- ✓ 记一笔：类别切换、预设标签一键记录或预填、标签的添加/删除/撤销 — existing
- ✓ 编辑弹窗：修改记录的文字、类别、日期，删除并可撤销；修改完成计划的日期或改回未完成 — existing
- ✓ 存储：在 Claude 中用 `db` 按用户保存一个文档，没有 `window.claude` 时回退到 `localStorage` — existing
- ✓ 导出日历 CSV 和 JSON 备份（需要 `downloads`），从 JSON 备份恢复 — existing
- ✓ 本地 Playwright 测试环境：项目内 `@playwright/test@1.64.1`（精确版本，`--ignore-scripts`），用本机 Edge 156，`npm test` 一条命令跑完全部用例并生成本地 HTML 报告（不自动弹出）；没有下载浏览器，也没有全局安装 — Phase 1
- ✓ 测试安全护栏：网络有三层（route 拦截、`--host-resolver-rules`、死代理），后两层都有用例证明；另有固定时钟和时区、页面错误护栏、应用 sha256 完整性基线、`.gitignore` 和合成数据标记检查。preconnect 的拦截是根据两层证明推断的，没有直接观察到；非 HTTP 的出网尝试会被代理层挡住，但不会让用例失败（见 01-REVIEW WR-05） — Phase 1

- ✓ Claude Artifact API mock：页面侧 `installClaudeMock` 加 Node 侧 `MockBackend`（经 `exposeBinding`，刷新后数据还在），按运行时契约 0.2.96 提供 `db`、`user`、`downloads` 的正常路径；8 条契约自测；`tests/mocks/CONTRACT.md` 记录已实现和未实现的条目 — Phase 2
- ✓ 能被证明的账户模式：`expectAccountMode()` 检查三项（只读一次且路径正确、状态栏账户文案、localStorage 无应用键），每一项都有常驻反向对照；记一笔后能读到写入，刷新后从 mock 读回 — Phase 2
- ✓ 合成测试数据：完整状态 fixture（五个类别、各状态任务、自定义待办、力量历史、本周复盘、预设增删）加边界 fixture（旧类别名、最小状态、只放在内存里的畸形导入），期望值由 helper 从 fixture 推导 — Phase 2
- ✓ 导出验证：日历 CSV 与独立生成器逐字一致，另有手写金标准行；JSON 备份深度相等；内置任务文字只在运行时从 DOM 读取，断言失败时也不会打印出来 — Phase 2

- ✓ 可复用的测试 helper：
  - `composer(page, 'w' | 'c')` 负责记一笔；内置预设在页面内按序号操作，失败时不打印原文；
  - `editor(page)` 负责编辑弹窗；
  - `toast` 读回状态后在 Node 侧比较；
  - `app.saved()` 和 `expectSaved()` 统一账户和本地两种模式。

  — Phase 3
- ✓ 本周视图：渲染结果与从 fixture 推导的期望一致，周导航和选日正常；记一笔、类别、预设（直接记录或预填、添加、删除、撤销）、Ctrl+Enter 都覆盖；拖放后保存的日期确实变了；复盘刷新后仍在 — Phase 3
- ✓ 编辑弹窗：从本周、日历、时间线三个入口修改后三个视图同步；取消、Escape、点遮罩都不保存；删除后可撤销；空文字不能保存；完成计划可以改日期，也可以改回未完成 — Phase 3
- ✓ 已知 bug 约定：每个 bug 是一条对照用例加一条窄断言的 `test.fail`，带 `known-bug` 注解，登记在 `tests/KNOWN-BUGS.md`；登记护栏双向核对。B1、N1、B4 都已复现并标记 — Phase 3
- ✓ 日历视图：
  - 月份网格：35 格、42 格和 2 月边界的期望都由独立推导得出；今天、抵达日、chip 顺序、“+N”都有断言；
  - 导航：跨年和点相邻月份的格子都覆盖；
  - 日面板：分区、记一笔、删除后撤销，撤销窗口卡在 5 秒；
  - B1 的日历实例已复现并标记。

  — Phase 4
- ✓ 目标视图：
  - 7 个目标组的计数和进度条与推导一致，4 张力量卡都检查与名称、目标无关的状态；
  - 力量值只在点保存或按 Enter 时保存，历史、达标和未达标都覆盖；
  - 勾选和取消勾选任务、截止日期和“已过期”、自定义待办的增删都覆盖；
  - N1 的日面板删除和目标页勾选两种触发已复现并标记。

  — Phase 4
- ✓ 报告检查脚本 `tools/test-report/check-report.mjs`：读 JSON 报告，只有满足以下全部条件才算通过，并带 22 条自检：
  - 没有失败、没有 flaky、没有不带注解的 skipped；
  - 列出的标题都实际跑过；
  - 跑过的用例数达到 `--min-expected`。

  — Phase 4
- ✓ 时间线视图：
  - 按月倒序、月份标题、空状态、类别筛选和“完成的计划”筛选都覆盖，记一笔后时间线实时更新；
  - 期望值由独立的 `expectedTimeline` 推导；
  - 完成的计划条目只读 id、日期和月份标题，不读文字。

  — Phase 5
- ✓ JSON 备份导入：
  - 确认后全部替换；
  - 取消后数据不变，用 manual 时钟、写入次数和哨兵写入证明没有保存；
  - 非 JSON 文件提示错误；
  - 导出的原文再导入，往返一致；
  - 旧类别名迁移到新类别。
  - 导入文件只在内存里构造，文件名都以 `synth-` 开头。

  — Phase 5
- ✓ 窄屏（520 × 900）：编辑弹窗变成底部面板，日历 chip 变成圆点，本周日期纵向排列，选日后滚到“记一笔”。滚动这条只能证明页面滚到底、composer 进入视口，分不出 `block` 取值（IN-10，黑盒约束下无法消除） — Phase 5
- ✓ 已知 bug B2、N3 已复现并标记：
  - B2：PROBE-8 证明 Playwright 的 `setInputFiles` 每次都会重新触发 `change`，所以只断言 `#importJson` 的值没被清空；
  - N3：期望出现格式错误提示，不弹确认框，数据保持不变。

  `npm test` 一次跑完 154 条用例，覆盖四个视图，0 flaky — Phase 5
- ✓ 个人计划移出应用代码：应用只内置一份与原计划同形状、措辞完全不同的合成示例计划（所有者检查后才提交）；内置任务 id 冻结为 `P<n>`/`P<n>-<i>`，新增项用 `g-`/`t-`/`l-`；所有插值进页面的值都转义；导入时 id 或日期不合格就整份拒绝，读取本机数据时自动修正、不删记录文字；原计划只存在被 git 忽略的本地种子里，隐私检查从种子读词条，没有种子时含应用文件的提交一律拦下。去个人化的应用已进入仓库（本机提交，尚未推送），全套 173 条用例通过 — Phase 7

### Active

<!-- v2.0 的范围。正式需求和编号在 REQUIREMENTS.md。 -->

- [ ] 3 个账号由用户在后台创建，登录后只能访问自己的数据
- [ ] 记录按账号存在服务器上，同一账号多设备实时同步
- [ ] 个人计划按账号存储，并能在应用里编辑
- [ ] 按账号导出和导入 JSON 备份，并能从原 Artifact 迁移数据
- [ ] 断网时记录先存本地，联网后自动上传
- [ ] 部署到香港或东京的云服务器，带域名、HTTPS 和自动备份，中美都能访问
- [ ] v1.0 测试套件改用模拟后端，继续作为回归防线

### Out of Scope

- 开放注册、邀请码注册 — 用户选择由自己在后台开 3 个账号
- 查看别人的记录 — 用户选择各看各的，账号之间完全隔离
- 重做界面 — 保留现有四个视图，只加登录页和编辑计划页
- 放在中国大陆的服务器 — 需要 ICP 备案；改用香港或东京
- 访问、修改、重新发布托管的 Claude Artifact — 保护原应用；迁移数据只靠用户自己导出 JSON
- 引入 React、Next.js 等前端框架 — 前端保持原生单文件；后端用 PocketBase
- 原生手机 App、付费功能、广告 — 3 个人自用，浏览器就够
- 修复 `.planning/codebase/CONCERNS.md` 里的其他问题（XSS、草稿丢失、导入重置等） — 除非新功能必须碰到，否则留作后续
- 全局安装或改本机全局配置 — 未经批准不做

## Context

- **现有代码：** 只有一个文件 `us-journey-tracker.html`（669 行，HTML、CSS、JS 都在里面，没有构建、没有依赖、没有测试）。详细分析在 `.planning/codebase/`（STACK、INTEGRATIONS、ARCHITECTURE、STRUCTURE、CONVENTIONS、TESTING、CONCERNS）。
- **Claude API 依赖：** `window.claude.use("db")` 读写 `data/users/<id>/state` 一个文档；`use("user")` 只用 `id()`；`use("downloads")` 只用 `save({filename, data})`。三者都可能是 `null`，应用已有回退逻辑。真实接口契约参考了 Artifact 运行时 0.2.96 的类型定义。
- **本地行为：** 直接打开文件时没有 `window.claude`，应用用 `localStorage`（key `us-journey-tracker-v1`），导出按钮不会出现，只有“恢复”可用。
- **已知问题会影响测试：** 比如在本周视图打草稿后再点别的日期，草稿会丢失；取消导入后再选同一个文件没反应。测试应该描述当前真实行为，碰到已知 bug 时标记出来（例如 Playwright 的 `test.fail` / `test.fixme`），而不是去改应用。
- **界面语言：** 全中文，测试选择器会用到中文文本和 ARIA 标签。
- **环境：** Windows 11，Node v24.20.0，npm 11.19.0，已安装 Microsoft Edge 和 Google Chrome。Phase 1 已证明 Playwright 1.64.1 可以直接驱动 Edge 156.0.4314.58。
- **Git 与 GitHub：** 公开仓库，主分支是 `main`。提交身份是 SuperJCL 加 noreply 地址（只在本仓库设置），首次推送前已清理过提交历史。`.githooks` 里的 pre-commit 和 pre-push 隐私检查（`tools/privacy/privacy-check.mjs`）会拦截应用原文件、真实备份、本机路径、真实邮箱和个人计划文字，规则见 `PRIVACY.md`。应用文件不进 git，克隆下来的仓库跑测试时会给出中文提示。
- **测试工程现状（Phase 5 后）：** 共 154 条用例（含 B1×2、N1×3、B4、B2、N3 八条预期失败），分为：
  - 护栏自检；
  - 7 项探针；
  - 契约自测；
  - 本地和账户两种模式的端到端用例；
  - 合成数据覆盖；
  - CSV 和 JSON 导出；
  - 本周视图与记一笔；
  - 编辑弹窗；
  - 已知 bug 的成对用例和登记护栏；
  - 日历视图（网格、导航、日面板）；
  - 目标视图（目标组、力量卡、任务和自定义待办）；
  - 时间线视图；
  - JSON 备份导入；
  - 窄屏布局。

  文件分布：
  - `tests/support/`：共享 helper，包括 `AppHarness`（`open({ mode, seed })`、`backend`、`expectAccountMode()`、`saved()`/`expectSaved()`）、`guard`（`guard.remove` 定向删除）、`frozenClock`、`knownBug()`、`composer`、`editor`、`toast`，以及 fixture 期望值 helper；
  - `tests/KNOWN-BUGS.md`：已知 bug 登记表；
  - `tests/mocks/`：mock；
  - `tests/fixtures/`：合成数据。

  探针结论在 `tests/PROBES.md`，用法在 `tests/README.md`。代码审查还剩几条 INFO 没处理：Phase 1 有 3 个，Phase 2 有 7 个，Phase 3 有 8 个，Phase 4 有 4 个，Phase 5 有 10 个。
- **之前存在过的真实备份文件**（文件名不记录）现在已不在目录中，从未被读取；测试中禁止使用任何真实备份。

## Constraints

- **应用源码**：v2.0 可以修改 `us-journey-tracker.html`，但四个视图的界面和操作方式不变，只加登录、编辑计划和服务器存储 — 用户选择保留现有界面
- **托管 Artifact**：不访问、不修改、不发布 — 原应用只存在于 claude.ai 上
- **数据**：真实数据只存在用户自己的服务器上；测试仍然只用合成数据，不连接真实服务器 — 隐私
- **技术栈**：前端保持原生 HTML/JS，不引入 React、Next.js；后端倾向 PocketBase（以调研结论为准）；测试用 Playwright Test — 用户明确要求
- **部署**：腾讯云 Lighthouse 香港（不需要 ICP 备案，先买 1 个月实测），Porkbun 域名，都由用户本人购买；HTTPS 证书自动申请和续期 — 中美都能访问
- **费用**：服务器大约每月 4–8 美元，域名大约每年 10 美元 — 用户要便宜
- **账号和付款**：服务器、域名的购买和注册由用户本人完成；Claude 不代为注册、付款或输入密码
- **安装**：本机只装项目内的 npm devDependency，用本机 Edge，不下载浏览器；服务器上的安装由部署脚本完成，执行前经用户批准
- **网络**：测试运行时拦截所有外部请求 — 结果可重复，不碰线上服务
- **隐私**：公开仓库里不放服务器地址、域名、密钥、后台密码、真实数据和个人计划文字；应用程序在去掉个人计划之后才能进仓库
- **资源**：本机测试低优先级、单 worker、不并发 — 用户的电脑容易卡
- **流程**：生成需求和路线图后停下，等用户批准再执行 — 用户明确要求

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 第一个里程碑只做测试，不改应用代码 | 学习完整 GSD 流程，同时保证原 Artifact 和应用代码安全 | ✓ Good — v1.0 全程没有改动应用，sha256 一直等于基线 |
| 用本机 Edge（`channel: 'msedge'`）跑 Playwright | 不下载浏览器、不做全局安装 | ✓ Good — Phase 1 第一次运行就驱动成功，Edge 检查点没有触发 |
| 仓库公开到 GitHub，靠本地隐私钩子守住个人内容 | 用户要求公开上库并长期维护隐私 | ✓ Good — 推送前清理了历史，每次提交都经过钩子 |
| 死代理作为第三层网络护栏（浏览器级 `launchOptions.proxy`） | route 管不到 preconnect 这类连接，需要一层不依赖 DNS 的兜底 | ✓ Good — PROBE-2 证明有效，本机页面不受影响 |
| 执行智能体在主工作区顺序执行（`workflow.use_worktrees: false`） | 应用文件不进 git，独立工作树里看不到它 | ✓ Good — 4 份计划都顺序完成 |
| 允许直接提交到默认分支 | 一个人的学习项目，不需要分支流程 | ✓ Good |
| 关闭每阶段调研（`workflow.research: false`） | 用户要求；项目级调研已经覆盖关键问题 | ✓ Good — 未知点改用探针（PROBE-1..8）当场验证 |
| Mock 只做正常路径 | 用户选择；错误路径的测试留到后续 | ✓ Good — 正常路径全部覆盖，错误路径留作后续 |
| 视图交互覆盖尽量完整 | 用户选择；包括编辑弹窗、拖拽、撤销、导入导出 | ✓ Good — 43 条需求全部交付，154 条用例 |
| 只用合成数据 | 隐私，不触碰真实个人数据 | ✓ Good — fixture 都带 `_synthetic`，隐私检查全程通过 |
| 已知 bug 不修，在测试里标记 | 控制范围；修复留到后续里程碑 | ✓ Good — B1、N1、B4、B2、N3 共 8 条标记用例，登记在 KNOWN-BUGS.md |
| mock 状态放在 Node 侧，用 `exposeBinding` 连接 | 刷新后数据还在；测试直接读 Node 内存；不和应用的 localStorage 混在一起 | ✓ Good — PROBE-7 证明应用调用 `get()` 时 binding 已可用，不需要 sessionStorage 退路 |
| 类别显示名和旧类别名可以写进仓库 | 这些是结构性标签，已经出现在公开文档里，而且 `normalize()` 必须用到；个人计划文字仍然禁止 | ✓ Good — 只放在 `tests/support/strings.ts`，隐私检查照常通过 |
| 断言失败时的输出也不能泄漏个人计划文字 | 失败信息会进入终端和 HTML 报告 | ✓ Good — 代码审查 3 轮后，涉及任务文字的断言都改成布尔或脱敏比较 |
| Phase 3–5 讨论题直接采用推荐答案 | 用户希望长时间无人值守地运行 | ✓ Good — 三个阶段都跑完了，只在 N3、T-03-SC 和人工验证项这些真正该用户决定的地方停下 |
| 已知 bug 的对照用例和 `test.fail` 用例分成两条 | `test.fail` 会把同一条用例里的任何失败都当成“预期失败”，对照放在里面会被掩盖 | ✓ Good — B1、N1、B4 去掉标记后，都只在那条窄断言上失败 |
| 测试运行一律低优先级、1 个 worker，配置文件不改 | 用户的电脑在长时间运行时会卡；用户选择不改 `playwright.config.ts` 的默认值 | ✓ Good — 全套用时从约 1.7 分钟变成 2.2 分钟 |
| N3（导入 `{}` 会清空数据）算已知 bug | 用户决定：不像备份的文件不应该能清空数据 | ✓ Good — Phase 5 去掉标记复现后，用一条对照用例加一条 `test.fail` 标记，并登记到 KNOWN-BUGS.md |
| 窄屏和导入用例不改页面 DOM，只用视口、计算样式和内存文件 | 坚持黑盒约束，结果只反映应用本身 | ⚠️ Revisit — 选日滚动这条在这种布局下分不出 `block` 取值（IN-10），已如实记录 |
| v1.0 收尾时 Phase 1–4 的验证报告被判过期，记录后直接收尾 | 过期是因为后续阶段改过共享文件；最终全套 154 条在 HEAD 上通过，包含 Phase 1–4 的用例；用户选择不重验 | ⚠️ Revisit — 记为 override，写进 MILESTONES.md |
| 原 Phase 6（本地私有文件加查看页）改为下一个里程碑的多账号云端版 | 用户希望 3 个人用各自账号，手机和电脑都能用，实时更新 | — Pending |
| v2.0 用香港或东京的便宜云服务器加 PocketBase，不用免费托管 | 用户有中国的使用者；`*.vercel.app` 在中国大陆不稳，Firebase 不可用 | — Pending（服务器商在调研后由用户选） |
| 账号由用户在后台开，不开放注册；账号之间完全隔离 | 只有 3 个人用，安全最省事 | — Pending |
| 个人计划在应用里直接编辑 | 用户选择；工作量最大，但最方便 | — Pending |
| 断网先存本地、联网自动上传，冲突以最后上传为准 | 不丢记录，同时控制复杂度 | — Pending |
| 服务器用腾讯云 Lighthouse 香港（2 核 2 GB，约 6 美元/月），先买 1 个月实测线路 | 调研对比后用户选择：配置在同价位最高，官方价格可信，按天退款；国内云厂商的香港机房口碑上到大陆线路更好（未实测） | — Pending（Phase 6 实测后决定是否续费） |
| 域名在 Porkbun 买 `.com` | 注册续费同价（官方价 11.81 美元/年），免费 WHOIS 隐私，域名与服务器商分开、换服务器只改一条解析；Cloudflare 便宜约 1.4 美元但强制用其 DNS、且不能开代理 | — Pending |
| 去掉个人计划后的应用程序放进公开仓库；计划和记录只存在服务器数据库 | 用户确认：仓库只放程序，克隆后能跑但是空的；现在的文件含写死的个人计划，要等计划外置后才能上传 | — Pending |
| 调研的其余推荐全部采纳 | 用户选择：整份 LWW 加三项防丢保护、示例计划同形状、预设两层不变、去掉 Google 字体、导入快照与冲突留底本里程碑做、冷启动离线放部署阶段最后 | — Pending |
| 示例计划写成通用、像样的例子，原计划里 4 字以上的词条全部改写、不设放行名单 | Phase 7 讨论时所有者确认；克隆者和新账号都会以它为初始计划 | ✓ Good — `--check` 判定零撞车，所有者在提交前检查并改了两处文字 |
| 读取本机数据时，找不到对应任务的进度键丢弃 | Phase 7 规划复核时所有者再次确认（不保留“孤儿”进度） | ✓ Good — Phase 7 实现；Phase 9 计划和记录分开加载后，这一步必须等账号的计划加载完再跑 |
| 隐私钩子文件不改，规则更新都放在 `privacy-check.mjs` 里 | 两个钩子只调用检查器；所有者确认（D-13） | ✓ Good — 钩子哈希不变，种子闸门和规则 A 都在检查器里验收 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-07 after Phase 7*
