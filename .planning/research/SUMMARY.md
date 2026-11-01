# Project Research Summary

**Project:** 在美国的日子 — 本地测试实验
**Domain:** 用本地 Playwright Test 对一个单文件原生 JS 网页应用（从 Claude Artifact 导出）做黑盒测试，并 mock `window.claude`（db / user / downloads）
**Researched:** 2026-11-01
**Confidence:** MEDIUM-HIGH。应用行为和版本信息是 HIGH；Playwright 运行时细节是 MEDIUM，要靠 Phase 1 的探针确认。

## Executive Summary

被测应用是一个个人追踪器：没有构建步骤，只有一个 669 行的文件（HTML、CSS、JS 都在里面），界面全中文，有本周、日历、目标、时间线四个视图。它最关键的特点是“能力缺失就降级”：没有 `window.claude` 时改用 `localStorage`，账户模式加载失败时也会悄悄回退。

这类应用的常见测试做法是：
- 把应用当黑盒；
- 用一个统一的 Playwright Test 出口挂上网络护栏和冻结时钟；
- 在页面脚本运行前，用 `addInitScript` 注入一个自包含的 `window.claude` mock；
- 持久化状态放在 Node 侧；
- 断言只依赖 DOM、ARIA 和 `data-*` 属性。

推荐方案：
- `@playwright/test` 精确锁定为 1.64.1，装在项目内，用本机 Edge（`channel: 'msedge'`），全程不运行 `playwright install`。
- `webServer` 启动一个零依赖的 `node:http` 服务器，绑定 `127.0.0.1`，只提供这一个 HTML 文件。主路径不用 `file://`。
- mock 是一个函数 `installClaudeMock(cfg)`，通过 `exposeBinding` 和 Node 侧的 `MockBackend` 通信，所以刷新后数据还在。
- 时间用 `page.clock.setFixedTime` 固定在 2026-03-18（周三）UTC 中午，时区固定为 `America/New_York`。
- 测试用 TypeScript，不加 tsconfig。所有用例只能从一个自定义的 `test` 出口导入。

主要风险有两类。

第一类是**假信心**，测试通过了却什么也没证明：
- 静默回退：mock 坏了，测试照样能通过；
- `test.fail` 会掩盖无关的失败；
- toast 是 `opacity:0` 时，Playwright 仍然认为它可见；
- 没有监听器时，`confirm()` 会被自动取消；
- `addInitScript` 每次刷新都会重新执行，用种子数据覆盖刚保存的数据。

第二类是**范围和安装**：脚手架命令会下载浏览器；真实备份文件可能被提交进仓库。

对应的缓解办法：
- 账户模式以状态栏文案作为就绪条件，并做变异检查；
- 已知 bug 用一条窄断言加一条对照断言来标记；
- toast 只用 `.on` 类断言；
- 导入前先注册对话框监听；
- 写入种子的函数加“没有才写”的守卫；
- 用 `.gitignore` 和合成数据标记防止真实数据进仓库；
- 对 `us-journey-tracker.html` 做 sha256 基线校验。

## Key Findings

### Recommended Stack

四份调研在版本和安装方式上没有分歧。整个方案只需要一个 devDependency，没有运行时依赖。

本机已有 Node 24.20.0 和 Edge 156.0.4314.58，Playwright 1.64 要求 Node >=20。Edge 比 Playwright 官方测过的 155 新一个大版本，因为 CDP 向后兼容，风险低，但要在冒烟测试里记录 `browser.version()`。

**Core technologies:**
- **`@playwright/test@1.64.1`**：测试运行器、断言和浏览器自动化。
  - 精确版本，不带 `^`，并提交 `package-lock.json`；
  - 三个相关包的版本必须一致；
  - npm 元数据确认三个包都没有 install 脚本，所以 `npm install` 不会下载浏览器。
- **系统 Microsoft Edge**，通过 `use.channel: 'msedge'` 启动：不下载浏览器。需要时可以用环境变量 `PW_CHANNEL=chrome` 切到本机 Chrome，同样不用安装。
- **零依赖 `node:http` 静态服务器**（约 15 行，`tests/support/static-server.cjs`）：白名单里只有 `us-journey-tracker.html`，绑定 `127.0.0.1`，`/favicon.ico` 等其他路径一律 404。
- **TypeScript，不构建、不加 tsconfig**：Playwright 自己转译。`@types/node` 和 `typescript` 不作为默认依赖，编辑器需要时再加。

**不要使用：**
- `npx playwright install`，包括 `install msedge`：会运行 Edge 安装器，还可能覆盖系统 Edge。
- `npm init playwright@latest`：会生成示例和 CI 工作流，并提示下载浏览器。
- 任何 `-g` 全局安装。
- `http-server`、`serve`、`live-server`：会注入脚本或暴露整个仓库目录。
- `cross-env`、`dotenv`、`tsx` 等额外依赖。
- `@axe-core/playwright`：新依赖，还会带出与本里程碑无关的告警。
- `reuseExistingServer: true`。
- 指向真实 Edge 配置目录的 `launchPersistentContext`。
- `context.setOffline(true)`：会把 `127.0.0.1` 也一起断掉。

### Expected Features

功能清单来自逐行阅读源码（HIGH），每条行为期望都能对应到代码位置。Playwright 行为（`setFixedTime`、`dragTo` 能否驱动 HTML5 拖放、`setInputFiles` 是否派发 `change`）是 MEDIUM，需要探针确认。

**Must have（table stakes，本里程碑“做完”的标准）：**
- **基础设施**（F-1 到 F-5）：网络护栏（自动 fixture，所有测试都带）、固定时钟和时区、页面错误护栏（`pageerror` 和 `console.error`）、`openApp` 辅助函数、空存储冒烟测试。
- **本周视图**（WK-1 到 WK-11）：
  - 默认渲染、标题的三种状态、上一周 / 下一周 / 本周按钮；
  - 类别计数和目标行；
  - 选中某天，以及每天列里的条目；
  - 点击条目打开编辑器，而不是选中那一天；
  - 拖拽记录换日期、本周复盘；
  - 本周视图没有删除按钮。
- **记一笔 composer**（CMP-1 到 CMP-12；本周视图和日历日面板各有一个实例）：
  - 切换类别、按钮的可用状态、记录、`Ctrl+Enter`；
  - 预设标签直接记录或预填；
  - 添加、删除、撤销标签，编辑模式；
  - 草稿保留。
- **日历**（CAL-1 到 CAL-11）：35 或 42 个格子、切换月份、今天按钮、点击格子、chip 渲染、日面板分区、日面板删除和撤销。
- **目标**（GL-1 到 GL-12）：四项力量的更新和历史、达标、勾选和取消勾选任务、截止日期和过期、自定义待办增删、进度条。
- **时间线**（TL-1 到 TL-5）：按月倒序、筛选、空状态、打开编辑器、编辑后重新排序。
- **共享和数据相关**：
  - 编辑弹窗（`<dialog>`，三处入口）；
  - toast（TST-1、TST-2）；
  - 两种存储模式下的持久化；
  - 导出 CSV 和 JSON；
  - 导入：确认、取消、非 JSON 文件、导出再导入的往返；
  - 对应 ED、PER、EXP、IMP 系列。
- **跨视图**：3 到 4 条代表性的联动用例（X-1），各视图的选中状态互相独立（X-2）。

**Should have（differentiators，有时间再做）：**
- 窄屏布局专项（D-1）：用 `viewport`，不用设备描述符，不测拖拽。
- 键盘路径（D-2，不把方向键当作期望行为）和暗色模式的 computed style 检查（D-4）。
- 美东时区跨夏令时的天数计算（D-6）、`localStorage` 损坏时回退为空（D-8）、力量历史最多 30 条（D-7）。
- 导入安全探针（D-10，对应 B6、B8）和 CSV 公式注入（D-11，对应 B7）。载荷只设置一个标志位，不发任何请求。

**Defer（v2 或以后的里程碑）：**
- mock 错误路径：B5（保存失败不重试）、B11（加载失败回退）、B12（256 KiB 上限），以及 `declined`、`rate_limited`、`db.set` 被拒绝。PROJECT.md 已经明确排除。
- 加载延迟和 B3（首次加载完成前的编辑被丢弃）：虽然属于正常路径，但会增加 mock 的配置项，接近“只做正常路径”的边界，建议延后（D-9）。
- 跨午夜（D-12，对应 B9）：构造起来很牵强，优先级最低。
- 标签页方向键导航：这需要改应用，不属于测试。
- 多标签页并发、像素截图对比、行覆盖率、跨浏览器矩阵，以及“5 个类别 × 3 个视图 × 每个动作”的全组合。

### Architecture Approach

架构的核心是**所有测试只走一个出口**：用例只能从 `tests/support/test.ts` 导入 `test`。这个出口挂了两个 auto fixture：
- `guard`：网络护栏和页面错误收集，teardown 时断言两者都为空；
- `frozenClock`：在导航之前调用 `setFixedTime`。

`mode`、`seed`、`now` 等是 option fixture；`backend`、`app`、`ui` 提供给用例使用。

mock 在页面里只负责“表现得和真的一样”：`use()` 是异步的，同一个名字返回同一个结果，命名空间被冻结，未知名字返回 `null`。所有会变的数据都放在 Node 侧。

**Major components:**
1. **`playwright.config.ts`**：
   - `channel:'msedge'`、`baseURL`、`webServer`（`reuseExistingServer:false`）；
   - 固定 locale、时区、配色方案和减少动效；
   - HTML 报告 `open:'never'`，`trace:'retain-on-failure'`。
2. **`tests/support/static-server.cjs`**：只提供一个 HTML 文件，每次请求都重新读取，不缓存。
3. **`tests/support/` 下的辅助文件**：
   - `test.ts`：唯一出口；
   - `app.ts`：`AppHarness`，提供 `open`、`reload`、`persisted`、`expectPersisted`、对话框策略和 `downloads`；
   - `ui.ts`：共享控件的 locator 函数，不用 Page Object 类层级；
   - `constants.ts`；
   - `strings.ts`：集中存放中文文案。
4. **`tests/mocks/claude-runtime.ts`**：一个自包含函数 `installClaudeMock(cfg)`，只能通过 `addInitScript(fn, arg)` 注入，函数内部不能引用模块外的变量。
5. **`tests/mocks/claude-backend.ts`**：Node 侧的 `MockBackend`，即内存文档库加调用记录（`reads`、`writes`、`downloads`、`overlappingWrites`）。只实现正常路径；`handle()` 保留一个 `default` 分支作为以后扩展的入口。
6. **`tests/fixtures/`**：`synthetic-state.json` 和边界数据（旧类别名、最小状态、畸形导入文件），以及 `state.ts` 构造器。所有数据都是合成的，并带 `_synthetic` 标记。
7. **`tests/e2e/`**：按 `platform/`（测试框架自检）、`storage/`、`views/`、`flows/` 分组。

**Key patterns:**
- **持久化断言**：先轮询确认数据已保存（account 模式读 Node 内存，local 模式读 `localStorage`），再 `reload`，最后断言 DOM。不要保存后立刻刷新，也不要用 `waitForTimeout`。
- **种子只在第一次生效**：local 模式用“没有才写”的 init 函数；account 模式直接调用 `backend.seed()`。
- **account 模式必须能证明自己真的在 account 模式**：
  - 就绪条件是等到状态行显示 `已同步保存到你的账户`；
  - 断言 `backend.reads` 恰好一次，路径为 `data/users/<id>/state`；
  - 断言 `localStorage` 里没有 `us-journey-tracker-v1` 键。
- **只看黑盒**：不读应用内部变量（包括 `window.__dl`），也不断言 `data-edit` 的值，因为它是运行时用 `uid()` 生成的。

### Critical Pitfalls

1. **静默回退掩盖 mock 故障（C1）**：账户模式的测试在 local 模式下也能通过。
   - 预防：账户 fixture 在 `goto` 之后等待状态行文案；至少一条断言检查 mock 的 `get` 和 `set` 被调用过。
   - 变异检查：临时让 `user.id()` 返回 `null`，账户用例必须变红。
2. **mock 的时序和契约与真实运行时不一致（C2）**：同步或在微任务里 resolve、直接在 `window.claude` 上挂 `db`、返回可变对象，都会掩盖“加载完成前的编辑”这类问题。
   - 预防：只暴露 `use`；缓存 promise；用 `Object.freeze`；`use()` 至少隔一个宏任务再 resolve。
   - 把契约写进 `tests/mocks/CONTRACT.md`，并加一组 `contract` 自测。
3. **`addInitScript` 每次导航都会重新执行（C4）**：无条件写 `localStorage` 会用种子覆盖刚保存的数据。
   - 预防：加“没有才写”的守卫；account 模式的种子只在 Node 侧写一次。
4. **`confirm()` 被自动取消，以及 `test.fail` 掩盖失败（C7、C10）**：
   - 如果导入测试在 `setInputFiles` 之后才注册对话框监听，会把测试问题误判为应用问题；
   - 如果已知 bug 直接整条用 `test.fail`，任何无关的失败都会显示为“按预期失败”。
   - 预防：对话框监听在动作之前注册，并断言 `message()`；`test.fail` 只包住一条窄断言，前面放一条普通的对照断言证明前提成立，并用 `test.info().annotations` 标注 `known-bug`。
5. **toast 和拖放的假阳性（C8、M1）**：
   - `toBeVisible` 对 `opacity:0` 的元素总是通过；
   - 拖放如果只派发事件、不检查数据，会漏掉“日期其实没变”的情况。
   - 预防：toast 用 `.on` 类加 `toContainText` 断言；拖放的结果要断言保存后的 `state`，不能只看界面。

另外还要注意：
- **时区和夏令时（C5）**：`setFixedTime` 的字符串解析依赖主机时区，而本机是太平洋时间；
- **中文选择器（M5）**：会匹配到重复文本和隐藏页签里的元素；
- **捕获阶段监听器（M4）**：导致点击落到哪个元素有歧义；
- **真实数据进仓库（C11）**：需要 `.gitignore` 和合成数据标记检查。

## Implications for Roadmap

### Research Conflicts Resolved

四份调研在下面几点上给出了不同方案。以下是裁决和理由，路线图应直接采用。

| 议题 | 备选方案 | 裁决 | 理由 |
|------|----------|------|------|
| mock 状态放在哪里 | A：`exposeBinding` 连到 Node 侧 `MockBackend`（ARCHITECTURE）；B：页面内 mock，备份到带前缀的 `sessionStorage` 键（STACK、PITFALLS C3） | **A**。如果 Phase 1 探针证明页面脚本运行前 binding 不可用，就退回 B，且键名不能和应用的 `us-journey-tracker-v1` 冲突 | 官方文档明确说 A 能跨导航保留；测试可以直接读 Node 内存，不需要 `evaluate`；还能断言 account 模式从不写 localStorage。B 会把 mock 数据和应用的回退存储混在一起 |
| 已知 bug 怎么标记 | A：整条用例 `test.fail`（FEATURES、ARCHITECTURE、STACK）；B：特征化测试，断言当前的错误行为（PITFALLS C10） | **混合**：`test.fail` 只包住一条期望正确行为的窄断言，前面放一条不带 fail 的对照断言证明前提成立，再加 `known-bug` 注解，并登记到 `tests/KNOWN-BUGS.md`。`test.fixme` 只用于无法稳定复现或期望行为未定的情况（如 N3，以及可能无法复现的 B2） | 纯特征化测试会在 bug 修好时让正常用例变红，还要人工对照；纯 `test.fail` 会掩盖无关失败。窄断言加对照是两者的折中 |
| 页面从哪里加载 | A：`webServer` 加 `127.0.0.1` 静态服务（STACK、ARCHITECTURE）；B：`file://`（PITFALLS M7） | **A 作为主路径**。`file://` 只做一条可选冒烟，并明确说明网络拦截在那里不一定有效 | `route` 对 `file://` 的行为没有验证过；`storageState` 在 `file://` 下的 origin 语义不明确。`http://127.0.0.1` 的 origin 稳定，和 `baseURL` 配合也简单 |
| `reuseExistingServer` | true 或 false | **false** | 端口被占用时直接失败，避免连到来路不明的服务，保证只测这一个文件 |
| 外部字体请求 | A：`route.fulfill` 返回空 CSS 或 204（ARCHITECTURE）；B：直接 `abort`（STACK、FEATURES） | **B（abort）**。“已拦截”允许列表里只有 `fonts.googleapis.com` 和 `fonts.gstatic.com` 两个主机，其他任何外部主机都让测试失败；字体被 abort 产生的控制台错误在收集器里过滤掉 | 统一成“外部请求一律失败”，不用为字体写特例 |
| 注入方式 | `addInitScript(fn, arg)` 或 `addInitScript({ path })` | **只用函数加参数的方式**，不用路径方式 | 路径方式不转译、不能传参，相对路径还依赖工作目录（PITFALLS M10） |
| 冻结时间怎么构造日期 | A：本地时间字符串 `new Date('2026-03-18T12:00:00')`（STACK、FEATURES）；B：`Date.UTC(2026, 2, 18, 12)`（PITFALLS C5） | **B**，配合 `timezoneId: 'America/New_York'`。日期固定为 2026-03-18（周三） | 字符串解析依赖主机时区；UTC 中午在 UTC-11 到 UTC+11 之间都落在同一个日历日 |
| 拖放怎么实现 | A：`dragTo(target, {steps:10})`；B：手动 `mouse` 序列；C：`dispatchEvent` 加 `DataTransfer` | **按 A → B → C 的顺序尝试**。用 C 的用例必须在注释里写明“合成事件，没有走真实指针路径”。拖放 spike 放在 Phase 1 末尾或 Phase 4 开头 | 应用只依赖模块内的 `dragId`，所以 C 可行；但 A 更接近真实操作 |
| worker 数量 | 默认（CPU 核数的一半）（STACK）；`workers: 2`（PITFALLS C12） | **先用 `workers: 2`**，稳定后再评估 | Edge 实例比较重，这套测试以正确性优先 |
| 冻结时钟的方式 | 默认 `setFixedTime`，需要时用 `install`（各份调研一致） | **同意**：默认用 `setFixedTime`；只有撤销 toast 过期、复盘双重防抖等少数用例单独启用 `clock.install` 加 `runFor`；同一个用例里不混用 | `install` 会冻结所有定时器，全局使用会让保存防抖永远不触发 |

### Scope Check（对照 PROJECT.md）

**符合范围：**
- 只写测试，不改 `us-journey-tracker.html`。用 sha256 基线（`platform/app-integrity.spec.ts`）证明它没被改过。应用文件没有被 git 跟踪，所以哈希是唯一的硬证据。
- 只装项目内 devDependency，不全局安装，不下载浏览器。
- 只用合成数据。`setInputFiles` 用内存 buffer，磁盘上不放任何备份类文件。
- 不访问 claude.ai，外部请求由护栏拦截并让测试失败。
- 已知 bug 只标记，不修复。

**需要标为延期（与 PROJECT.md 的 Out of Scope 冲突或接近边界）：**
- mock 错误路径全部延期：`db.get` 或 `set` 被拒绝、`downloads` 被拒绝、限流、`declined`、`rate_limited`，以及 TESTING.md 里的“加载失败回退”和 `Error Testing` 示例。mock 里不写任何 `reject` 逻辑（PITFALLS M13）。
- B5、B11、B12 登记为“留给后续里程碑”。
- D-9 加载延迟（B3）和 `latencyMs` 配置：会扩大 mock 的配置项，而且这种测试设计接近错误路径，建议延期。
- B8（导入校验太浅）和 N3（导入 `{}` 并确认后会清空全部数据）：属于应用的输入校验，不是 mock 错误路径。可以作为 P2 的特征化测试或 `test.fixme` 保留，但需要在 M15 页面错误护栏里显式豁免，载荷也必须无害。N3 的期望行为还没定，只能用 `test.fixme`。

**需要注意，但不冲突：**
- 窄屏（D-1）、键盘、暗色模式、安全探针都属于 P2，不影响里程碑完成。
- `tests/mocks/CONTRACT.md` 和 `tests/KNOWN-BUGS.md` 是测试工程里的文档，不是应用文件，可以创建。
- 契约来源文件在 Claude Code 的临时目录里（路径带版本号和哈希），升级后会消失。所以要把用到的契约条目抄进仓库里的 `CONTRACT.md`，不要引用临时目录路径。

### Suggested Phase Structure

建议分 7 个阶段。Phase 1 只用本地模式，不依赖 mock，是后续所有工作的基础。

#### Phase 1：环境、护栏与垂直切片（仅本地模式）

**Rationale：** 不依赖 mock 就能打通整条链路；网络护栏和时钟从第一天起就对所有用例生效；所有运行时探针也在这一阶段完成，避免后面的阶段建立在没验证过的假设上而返工。

**Delivers：**
- 项目文件：
  - `package.json`：精确版本 1.64.1，脚本 `test`、`test:headed`、`report`；
  - `package-lock.json`；
  - `.gitignore`：忽略 `node_modules/`、`test-results/`、`playwright-report/`、`blob-report/` 和备份类 JSON。
- `playwright.config.ts`（按上面 Research Conflicts 的裁决配置）和 `static-server.cjs`。
- 测试支撑：
  - `test.ts` 出口，含两个 auto fixture：`guard` 和 `frozenClock`；
  - `AppHarness`（只支持 local 模式）、`constants.ts`、`strings.ts`。
- 用例：
  - `platform/guardrails.spec.ts`：页面里 `fetch('https://example.com')` 必须失败，被拦截的主机必须都在允许列表里；
  - `platform/app-integrity.spec.ts`：应用文件的 sha256 与基线一致；
  - `smoke.spec.ts`：空存储启动，四个标签都能切换，状态行显示本地文案，记一笔后轮询到 `localStorage` 已保存，刷新后数据还在。
- 记录 `browser.version()`。

**Addresses：** F-1 到 F-4、PER-1，以及 CMP-1 等基础交互的最小切片。

**Avoids：** C5（时区和时钟）、C6（等待保存）、C8（toast 断言）、C9（网络）、C11（真实数据）、C12（安装和版本）、M5（中文选择器）、M7（加载来源和隔离）、M8（动态 id）、M10（注入方式）、M15（页面错误）。

**Probes**（必须在本阶段完成，结果写进 `tests/KNOWN-BUGS.md` 或 README 的环境一节）：
1. `channel:'msedge'` 能否在不下载任何东西的情况下 headless 启动。失败就先试 `PW_CHANNEL=chrome`；两个都失败就停下来问用户，不运行 install。
2. `--host-resolver-rules` 在 Edge 156 上是否生效。如果系统设置了代理，再考虑把 `use.proxy` 指向一个不通的端口。
3. `page.reload()` 之后 `setFixedTime` 是否仍然有效。如果无效，就在 `AppHarness.open()` 和 `reload()` 里每次重新调用。
4. 用 `expect.poll` 读取 `localStorage` 时，防抖保存的时序是否稳定。
5. `dragTo` 能否驱动 HTML5 拖放（只做 spike，不写完整用例）。
6. `clock.install` 加 `pauseAt` 之后，Playwright 的元素稳定性检查是否仍然正常（为后面单独启用的用例做准备）。

**Research flag：** 需要。上面的探针都是 MEDIUM 或 LOW 置信度。

#### Phase 2：Claude Artifact mock 与账户模式

**Rationale：** 所有 account 模式用例，以及导出导入中对 downloads 的断言，都依赖 mock。它建立在 Phase 1 关于 binding 和时序的探针结果之上。

**Delivers：**
- `tests/mocks/claude-runtime.ts`，即 `installClaudeMock(cfg)`：
  - 自包含，只暴露 `use`；
  - 缓存 promise，冻结命名空间，未知名字返回 `null`；
  - `doc(path)` 校验路径语法。
- `tests/mocks/claude-backend.ts`：`MockBackend`，只实现正常路径。
- `AppHarness` 接入 `exposeBinding`。account 模式下 `open()` 的就绪条件是状态行文案。
- `platform/mock-contract.spec.ts`：`use` 是异步的、同名返回同一个 promise、命名空间被冻结、未知名字为 `null`、路径语法错误时抛 `TypeError`。
- `storage/account-mode.spec.ts`：启动时读取一次、启动时不写入、保存被记录下来、刷新后能读回、localStorage 里没有应用的键。
- 变异检查：`user.id()` 返回 `null` 时，账户用例必须变红。
- `tests/mocks/CONTRACT.md`：对齐的契约版本 0.2.96、已实现的条目、明确没实现的条目（`onSnapshot`、错误码、限流），以及重新核对的步骤。
- PER-2、PER-3、PER-4 用例。

**Addresses：** PER-2、PER-3、PER-4，以及 downloads 能力存在时的行为（为 Phase 6 做准备）。

**Avoids：** C1、C2、C3、C4、M10、M12、M13。

**Research flag：** 需要，取决于 Phase 1 的 binding 探针。如果 binding 不可用，就改用 `sessionStorage` 方案，但仍然不能使用应用的键名。

#### Phase 3：合成数据与 fixture 体系

**Rationale：** 视图测试需要数据。先统一构造数据，避免每个 spec 各自造一套，也避免期望值依赖真实的个人计划内容。

**Delivers：**
- `synthetic-state.json`，包含：
  - 日志：
    - 五个类别都有日志，本周的日志分布在至少 4 个日期；
    - 健身在本周有 3 天（达标），在另一周只有 1 到 2 天（未达标）；
    - 特殊文本：`<b>&"'`、逗号、双引号、换行、超过 80 个字符、以 `=` 开头；
    - 某一天有 4 个以上事件（触发 “+N”）；
    - 一个跨月的周（03-30 到 04-05），以及跨多个月或跨年的日志。
  - 任务：
    - 已完成任务（本周的和更早月份的）；
    - 过期、今天到期、将来到期三种任务；
    - 自定义待办。
  - 四项力量的历史：一项超过 4 条，一项达到目标，一项没有记录。
  - 本周复盘（键为周一的日期）和预设标签的增删。
- `legacy-categories.json`、`minimal-state.json`，以及 `malformed-*.json`（非 JSON、`null`、缺 `date`、`{}`）。
- `state.ts` 构造器和 `_synthetic` 标记；一条标记测试遍历 fixtures 目录，断言每个文件都带标记。
- 固定日期：今天是 2026-03-18（周三），本周是 03-16 到 03-22，抵达日期是 2026-01-12（周一），另有几种抵达日期的变体。
- 任务的位置 id（`P<n>-<i>`）集中放在一个常量文件里，并注明“会随源码顺序变化”。

**Addresses：** 所有视图的数据需求。

**Avoids：** C11（真实数据）、C5（日期）、M11（期望值从 fixture 推导，不抄任务文字）。

**Research flag：** 不需要，是标准做法。

#### Phase 4：共享组件与本周视图

**Rationale：** 本周视图是使用最频繁的交互；composer、编辑器和 toast 会被其他视图复用，应该先抽出这些共享件。B1（草稿丢失）也在这个视图里。

**Delivers：**
- `ui.ts`：tabs、composer（用 `w` 和 `c` 两个根节点参数化）、编辑器对话框、toast、本周视图的日期和条目 locator，以及拖放 helper。
- `views/week.spec.ts`（WK-1 到 WK-11）、`flows/composer.spec.ts`（CMP-1 到 CMP-12）、`flows/editor.spec.ts`（ED-1 到 ED-10）。
- 所有视图共用的 `expectSaved(predicate)` helper。
- 拖放用例：先用 `dragTo`，失败就按上面裁决的顺序回退，并断言保存后的 `state` 里日期确实变了。
- `KNOWN-BUGS.md`：
  - B1 和 N1：窄 `test.fail` 加对照断言；
  - B4：输入后立即刷新的 `test.fail`；
  - N2：只写说明，不单独写用例。

**Addresses：** WK、CMP、ED、TST 系列。

**Avoids：** C6、C8、M1、M2、M4、M8、M5。

**Research flag：** 需要对拖放和 `<dialog>` 焦点做小 spike，但不需要单独的 research phase。

#### Phase 5：日历与目标视图

**Rationale：** 两个视图都依赖 Phase 4 的 composer 和编辑器，彼此独立，可以并行。

**Delivers：**
- `views/calendar.spec.ts`（CAL-1 到 CAL-11）：
  - 周日起始；
  - 用脚本核对过的两个固定月份，分别对应 35 格和 42 格；
  - 日面板的捕获阶段行为：点删除不会打开编辑器；
  - 撤销 toast 的过期，用单独启用的 `clock.install` 验证。
- `views/goals.spec.ts`（GL-1 到 GL-12）：
  - 力量值只在点击“保存”或按 `Enter` 时保存，失焦不保存；
  - 用极大值和极小值触发达标，不写死目标数字；
  - 过期和今天到期的边界；
  - 只有自定义待办可以删除。
- D-6（美东跨夏令时的天数计算）可以放在本阶段。

**Addresses：** CAL、GL 系列。

**Avoids：** C5（周日起始和周一起始分开断言）、M4（日面板点击歧义）、M11（任务状态从 fixture 推导）、C11（不复制任务文字）。

**Research flag：** 不需要。

#### Phase 6：时间线、导入导出与跨视图

**Rationale：** 导入导出依赖 Phase 2 的 downloads mock 和 Phase 3 的边界数据；对话框和文件输入需要专门的处理策略，适合集中在一个阶段完成。

**Delivers：**
- `AppHarness` 的对话框策略：一个统一的 `page.on('dialog')` 队列，默认 `dismiss`；导入用例先排入一个 `accept`，并断言 `message()`。
- `views/timeline.spec.ts`（TL-1 到 TL-5）。
- `flows/export-import.spec.ts`：
  - EXP-1 到 EXP-3：CSV 精确比较（含特殊字符），文件名包含冻结日期，JSON 深度相等；
  - IMP-1：确认后整体替换；
  - IMP-3：非 JSON 文件弹出 toast；
  - IMP-4：导出再导入的往返。
- IMP-2（取消后 `input.value` 应为空，用 `test.fail`）：先做一个 spike，确认 `setInputFiles` 对同一个文件是否派发 `change`。如果无法复现，就改成 `test.fixme` 并写明原因，不为它改应用。
- PER-5（local 模式下导出按钮是隐藏的，要等初始化完成后再断言）和 PER-6（旧类别迁移）。
- `flows/cross-view.spec.ts`：X-1 的 3 到 4 条代表性联动，以及 X-2 的选中状态独立性。

**Addresses：** TL、EXP、IMP、X 系列，以及 PER-5、PER-6。

**Avoids：** C7（先注册对话框监听）、M3（直接对隐藏 input 调用 `setInputFiles`）、M9（断言隐藏状态的时机）、M14（CSV 精确比较）、M15（畸形导入的显式豁免）。

**Research flag：** 需要，包括 `setInputFiles` 与 `change` 的行为，以及 IMP-2 的 spike。

#### Phase 7：收尾与可选增强

**Rationale：** 这些都是 P2 或收尾工作，不影响里程碑完成。

**Delivers：**
- 窄屏项目（D-1）：`viewport` 约 520 × 900，不用设备描述符，只跑少量带 `@narrow` 标签的用例（本周视图选日和滚动、编辑弹窗的底部面板形态、目标任务的网格）。
- D-2 键盘路径（Enter 和 Space 激活、`Ctrl+Enter` 保存、`Escape` 关闭）、D-4 暗色模式 computed style、D-7、D-8。
- D-10、D-11 安全探针：载荷只设置一个标志位，断言标志没有被设置（B6）；CSV 公式注入（B7）；B8 的 `test.fail` 需要在页面错误护栏里豁免。
- 可选的 `file://` 冒烟测试，并明确说明网络拦截在那里不一定有效。
- `pretest` 阶段的 `check-imports` 脚本：扫描 `tests/e2e/`，发现直接 `import '@playwright/test'` 就失败。
- 对照 Confidence 和 Gaps 两节做最终验收，确认 KNOWN-BUGS.md 和 CONCERNS.md 一一对应。

**Addresses：** D-1、D-2、D-4、D-7、D-8、D-10、D-11，以及质量收尾。

**Avoids：** M6（响应式）、C10（已知 bug 登记一致）、M15（豁免范围）。

**Research flag：** 窄屏和安全探针不需要调研；`file://` 冒烟需要验证。

### Phase Ordering Rationale

- **Phase 1 必须最先**：护栏、时钟、页面加载方式和所有运行时探针都在这里定下来，后面的阶段不应建立在没验证过的假设上。
- **Phase 2** 依赖 Phase 1 的 binding 探针结果，又是导出导入和 account 用例的前提。
- **Phase 3** 在视图测试之前完成，避免各个 spec 各自造数据。它和 Phase 2 有依赖，但主要是数据构造，可以部分并行。
- **Phase 4 在 Phase 5 之前**：composer、编辑器、toast 是共享件。Phase 5 的两个视图可以并行。
- **Phase 6** 依赖 Phase 2、3、4：它需要 downloads mock、边界数据和编辑器。
- **Phase 7** 是收尾，放在最后，不影响里程碑完成。

这个顺序避免了三类风险：
- 在账户模式完成之前出现静默回退（由 Phase 2 的变异检查兜住）；
- 在约定好对照断言之前就到处铺开已知 bug 标记（Phase 4 先定约定）；
- 拖放和对话框的假设在大量用例依赖它们之前一直没被验证（由 Phase 1 和 Phase 4 的 spike 解决）。

### Research Flags

**需要在 Phase 1 用探针验证**（不需要单独的 research phase，但必须在本阶段完成）：
- 页面脚本运行前 `exposeBinding` 是否可用（ARCHITECTURE 里标为待验证）。
- `--host-resolver-rules` 在 Edge 156 上的效果，以及 `preconnect` 是否会被挡住（LOW）。
- `reload` 之后 `setFixedTime` 是否保持（官方文档没写，LOW）。
- `clock.install` 加 `pauseAt` 与 Playwright 稳定性检查是否兼容（LOW）。

**需要在 Phase 4 或 Phase 6 做小 spike：**
- `dragTo` 能否触发 HTML5 拖放的 `dragstart` 和 `drop`，以及 `dataTransfer` 的传递（MEDIUM）。
- `<dialog>` 的焦点与重绘（M2）。
- `setInputFiles` 对隐藏 input 的行为，以及同一个文件是否会派发 `change`（决定 IMP-2 的写法，LOW）。

**标准做法，可以跳过 research phase：**
- Phase 3（构造 fixture）、Phase 5（日历和目标，纯 DOM 断言），以及 Phase 7 的键盘和暗色检查。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH（版本和安装）/ MEDIUM（运行时行为） | 版本和“没有安装脚本”来自 npm registry 直接查询；`channel:'msedge'`、`setFixedTime`、host-resolver 等行为来自官方文档，部分没有在本机实际运行过 |
| Features | HIGH（应用行为）/ MEDIUM（Playwright 行为） | 行为期望逐行取自 `us-journey-tracker.html`（669 行）；`dragTo`、`setInputFiles`、`opacity:0` 可见性等 Playwright 相关结论来自已有知识，需要探针确认 |
| Architecture | MEDIUM | `window.claude` 契约来自本地 0.2.96 类型定义（HIGH）；Playwright 的 `exposeBinding`、`addInitScript`、`test.extend` 来自用 WebFetch 读到的文档摘要（按 LOW 分级），已列出 4 个需要验证的假设 |
| Pitfalls | MEDIUM-HIGH | 应用层的坑基于源码（HIGH）；Playwright 语义基于官方文档（HIGH）；少数与 Edge 和 Chromium 相关的条目（host-resolver、preconnect、同一文件的 `change`）是 LOW，已列入 Phase 1 和 Phase 6 的探针 |

**Overall confidence:** MEDIUM-HIGH

这次调研全程只读：没有安装依赖，没有运行 Playwright，也没有在 Edge 上实际跑过任何用例。所有需要实际运行才能确认的点，都已列入 Phase 1 和后续的 spike。

### Gaps to Address

- **`exposeBinding` 和页面脚本谁先谁后：** 文档只说它能跨导航保留，没说和 `addInitScript` 或页面脚本的先后顺序。
  - 处理：mock 只在 `get`、`set`、`save` 被调用时才访问 binding（懒调用）；Phase 2 的账户冒烟测试直接验证；如果失败，就退回带前缀的 `sessionStorage` 键方案。
- **`--host-resolver-rules` 在 Edge 156 上的效果，以及能否挡住 `preconnect`：** 没在 Edge 上验证过。
  - 处理：`guardrails.spec.ts` 必须有一条 `fetch` 失败的断言；字体请求被 abort 加上控制台过滤，保证没有外部请求漏出去。如果系统代理有干扰，再加 `use.proxy`。
- **`reload` 之后 `setFixedTime` 是否保持：** 文档没有说明。
  - 处理：Phase 1 探针；如果不保持，`AppHarness` 在 `open` 和 `reload` 时每次重新调用。
- **拖放的 HTML5 行为：** `dragTo` 的文档只描述了鼠标序列，没提 HTML5 拖放。
  - 处理：按 `dragTo(steps)` → 手动鼠标序列 → `dispatchEvent` 加 `DataTransfer` 的顺序回退；用合成事件的路径要在注释里写明；断言保存后的数据。
- **B2（取消导入后无法重选同一个文件）能否复现：** 不确定，Playwright 可能总是派发 `change`。
  - 处理：Phase 6 先做 spike；无法复现就用 `test.fixme` 并写明原因，不为它改应用。
- **N2（复盘防抖被重绘还原）和 N1（草稿丢失的触发场景更多）：** 只是阅读代码的推断，没有运行确认。
  - 处理：N1 并入 B1 的 `test.fail` 说明；N2 不单独写用例，规则是“输入复盘后，先等保存完成再做别的操作”。
- **B8（导入后 `renderTimeline` 抛错，但数据已经被替换）：** 是推断，需要运行确认。
  - 处理：Phase 7 的 `test.fail` 要在 `pageerror` 护栏里豁免，并先用一条不带 `test.fail` 的用例确认“数据确实被替换了”这个前提。
- **N3（导入 `{}` 这类合法 JSON 并确认后会清空全部数据）：** 目前没有定义期望行为。
  - 处理：用 `test.fixme`，等用户决定。
- **日历 35 格和 42 格对应的具体月份：** 文档里的推算需要用脚本核对。
  - 处理：Phase 5 开始前用脚本确认选用的月份。
- **契约条目的来源路径：** 在 Claude Code 的临时目录里，路径带版本号和哈希。
  - 处理：把用到的条目抄进 `tests/mocks/CONTRACT.md`，并在 Phase 2 的契约自测里固定版本号。
- **Edge 自动更新：** 本机目录里有多个旧版本，说明 Edge 一直在更新。
  - 处理：每次运行都记录 `browser.version()`；出现异常时先用 `PW_CHANNEL=chrome` 复核，判断是浏览器兼容问题还是应用问题。

## Sources

### Primary (HIGH confidence)
- `us-journey-tracker.html`：只读，全文阅读。本项目所有行为期望的来源。
- `.planning/PROJECT.md`：范围、约束和 Out of Scope。
- npm registry 直接查询（2026-11-01）：
  - `@playwright/test@1.64.1` 是 latest，`engines.node >=20`；
  - 依赖链 `@playwright/test → playwright → playwright-core` 版本相同，三个包都没有 install 脚本；
  - 许可证 Apache-2.0。
- 本机检查：
  - Edge 路径存在，版本 156.0.4314.58；
  - Node v24.20.0，npm 11.19.0；
  - Windows 时区是太平洋时间，区域 zh-CN，控制台代码页 437；
  - 仓库根目录还没有 `package.json` 和 `.gitignore`。
- Artifact 运行时契约 0.2.96 的本地类型定义（`claude.d.ts`、`db.d.ts`、`user.d.ts`、`downloads.d.ts`）：`use()` 的时序、命名空间冻结、路径语法、`DocumentSnapshot` 的结构、`save()` 的返回值。

### Secondary (MEDIUM confidence)
- https://playwright.dev/docs/browsers：`channel` 的用法；Chrome 和 Edge 品牌浏览器默认不安装；关于安装到全局位置的警告。
- https://playwright.dev/docs/release-notes：1.64 测试的是 Chromium 156.0.8078.4 和 Edge 155 稳定通道。
- https://playwright.dev/docs/clock 和 `docs/src/api/class-clock.md`：`setFixedTime`、`install`、`pauseAt`、`runFor` 的语义。
- https://playwright.dev/docs/test-webserver：`webServer` 选项；`port` 已弃用；Windows 下会忽略 `gracefulShutdown`。
- https://playwright.dev/docs/test-typescript：TS 直接运行，不做类型检查。
- https://playwright.dev/docs/network、`class-browsercontext.md`、`class-route.md`：`route` 的执行顺序、页面级优先于上下文级、Service Worker 会绕过拦截、`addInitScript` 的时机。
- https://playwright.dev/docs/test-reporters：HTML 报告的 `open` 默认是 `on-failure`。
- `class-dialog.md`：没有监听器时对话框会被自动 dismiss（HIGH）。
- https://playwright.dev/docs/actionability：`opacity:0` 视为可见；`setInputFiles` 不做 actionability 检查（HIGH）。
- https://playwright.dev/docs/test-annotations：`test.fail`、`fixme` 和自定义注解（HIGH，但官方没写意外通过时怎么报告）。
- https://playwright.dev/docs/api/class-page：`addInitScript` 只有传函数时才能带参数；`exposeBinding` 能跨导航保留（ARCHITECTURE 用的是 WebFetch 摘要，按 LOW 分级，需要 Phase 1 探针复核）。

### Tertiary (LOW confidence, needs validation)
- Chromium 对重复选择同一个文件不派发 `change`：来源是 Matrix React SDK 的注释和 WebKit Bugzilla 63929，不是针对 Playwright 的报告。它决定 IMP-2 的写法，需要 spike。
- Playwright 的 `page.route` 能否拦截 `preconnect`：没找到资料，需要探针。
- `--host-resolver-rules` 在 Edge 156 上是否生效：来自 Chromium 的通用知识，需要探针。
- `file://` 下 `route` 拦截和 `storageState` 的行为：没找到权威结论，本项目不依赖它。
- `dragTo` 对 HTML5 拖放的行为：文档没有描述，需要 spike。
- `setFixedTime` 下 `Date.now()` 对 `uid()` 生成的影响：是推断，不影响断言。

---
*Research completed: 2026-11-01*
*Ready for roadmap: yes*
