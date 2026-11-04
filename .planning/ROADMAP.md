# Roadmap: 在美国的日子 — 本地测试实验

## Overview

本里程碑只写测试：在项目内搭起 Playwright Test 环境，用本机 Edge 对 `us-journey-tracker.html` 做黑盒测试。第一步是用一条命令跑通一条本地模式的端到端用例，同时让所有护栏和运行时探针到位。接着加入按真实契约实现的 `window.claude` mock 和合成数据，并验证导出。然后先建好记一笔、编辑弹窗、toast 这些共享 helper，用它们覆盖本周视图，再覆盖日历和目标视图。最后补上时间线、JSON 备份导入和手机宽度下的关键布局。做完时，开发者运行 `npm test` 就能自动验证四个视图的渲染和交互，已知 bug 被统一标记而不是被修复。

**所有阶段共同遵守的约束：**
- 任何阶段都不修改 `us-journey-tracker.html`，每次运行都用 sha256 基线证明它没被改动。已知 bug 只在测试里标记，不修复。
- 只在项目内安装 `@playwright/test` devDependency。不做全局安装，不下载浏览器（禁止 `npx playwright install`、`npm init playwright@latest` 和任何 `-g` 安装），浏览器用本机 Edge（`channel: 'msedge'`）。
- 只用合成数据。测试运行时拦截所有外部网络请求，不访问 claude.ai，不连接任何生产存储。
- mock 只实现正常路径。db 和 downloads 的错误路径、加载延迟都属于 v2（ERR-01 到 ERR-04）。
- 这是纯测试工程，不涉及界面设计工作。

## Phases

**Phase Numbering:**
- 整数阶段（1、2、3）：本里程碑计划内的工作
- 小数阶段（2.1、2.2）：计划之后紧急插入的工作（标注 INSERTED）

小数阶段按数字顺序排在前后两个整数阶段之间。

- [x] **Phase 1: 测试环境、护栏与本地切片（Harness & Local Slice）** - 一条命令用本机 Edge 跑通本地模式端到端用例；网络、时钟、页面错误和应用完整性护栏对所有用例生效；完成六项运行时探针 (completed 2026-11-01)
- [x] **Phase 2: 账户模式、合成数据与导出（Account Mock, Data & Export）** - 注入按 0.2.96 契约实现的 `window.claude` mock，证明测试真的跑在账户模式；备好合成 fixture；验证 CSV 和 JSON 导出内容 (completed 2026-11-03)
- [x] **Phase 3: 记一笔、编辑弹窗与本周视图（Composer, Editor & Week）** - 建立记一笔、编辑弹窗、toast 的共享 helper 和已知 bug 标记约定，完整覆盖本周视图 (completed 2026-11-03)
- [ ] **Phase 4: 日历与目标视图（Calendar & Goals）** - 复用共享 helper，覆盖日历月格、日面板和目标视图的全部交互
- [ ] **Phase 5: 时间线、导入与窄屏（Timeline, Import & Narrow）** - 覆盖时间线、JSON 备份导入（含旧类别迁移）和手机宽度下的关键布局，四个视图全部被覆盖

## Phase Details

### Phase 1: 测试环境、护栏与本地切片（Harness & Local Slice）
**Goal:** 开发者在项目目录运行 `npm test`，就能用本机 Edge 跑通一条本地模式的端到端用例。网络拦截、固定时钟、页面错误和应用完整性这几道护栏从第一条用例起就自动生效，后续阶段依赖的运行时假设都已经用探针验证过。
**Mode:** mvp
**Depends on:** Nothing（第一个阶段）
**Requirements:** ENV-01, ENV-02, ENV-03, ENV-04, SAFE-01, SAFE-02, SAFE-03, SAFE-04, MOCK-01, IO-01
**Success Criteria** (what must be TRUE):
  1. 在项目目录运行 `npm test`，本机 Edge 跑完全部用例并在本地生成 HTML 报告（不自动弹出）。仓库里只新增了精确版本的 `@playwright/test` devDependency 和 `package-lock.json`，过程中没有下载浏览器，也没有全局安装或改全局配置。
  2. 一条本地模式端到端用例通过：页面来自只监听 127.0.0.1、只提供 `us-journey-tracker.html` 的本地服务器，页面上没有 `window.claude`；四个标签都能切换，记一笔后能在 localStorage 里读到保存的数据，刷新后记录仍在，导出按钮不出现。用预置的合成 localStorage 启动同样能通过，而且刷新后刚保存的数据不会被种子覆盖。
  3. 每次运行的“今天”都固定为 2026-03-18（周三），时区为 `America/New_York`，语言为 zh-CN；连续运行两次，结果完全一致。
  4. 护栏自检用例全部通过：页面请求允许列表之外的外部地址会让测试失败；页面出现未预期的 JS 错误会让测试失败；`us-journey-tracker.html` 的 sha256 与记录的基线一致；`.gitignore` 忽略测试产物和备份类 JSON，合成标记检查会对缺少标记的 fixture 报错。
  5. 六项运行时探针都有结论并记录在仓库里：Edge headless 启动、`--host-resolver-rules` 是否生效、`page.reload()` 后 `setFixedTime` 是否保持、`expect.poll` 读取防抖保存的时序是否稳定、`dragTo` 能否驱动 HTML5 拖放（只做 spike）、`clock.install` 加 `pauseAt` 后元素稳定性检查是否正常。
**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Walking Skeleton：安装前包合法性检查点 → tracer（npm test → Edge → 127.0.0.1 服务器 → 本地模式记一笔 → localStorage → reload，从第一次运行起带死代理）→ Edge 失败时的条件检查点

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — 护栏自检：网络、页面错误、固定时钟、sha256 基线与缺失提示、单文件白名单、.gitignore 和合成标记

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — AppHarness 补齐 MOCK-01 和 IO-01 切片，六项 PROBE 用例与 tests/PROBES.md（PROBE-2 断言解析层和死代理并观察 preconnect），两层网络兜底都无法证明时的条件检查点

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — 中文 tests/README.md，连续两次一致与隐私全量检查，test:ui 和 show-report 的只读检查与阶段末人工验收

**Notes:**
- 如果探针显示 Edge 无法在不下载任何东西的情况下被驱动，计划必须停下来询问用户（可以把改用本机 Chrome 的 `PW_CHANNEL=chrome` 作为一个选项提出），绝不运行任何安装命令。
- 按 `research/SUMMARY.md` 的裁决配置：冻结时间用 `Date.UTC(2026, 2, 18, 12)`；`reuseExistingServer: false`；`workers: 2`；字体请求直接 abort，“已拦截”允许列表只有 `fonts.googleapis.com` 和 `fonts.gstatic.com`；注入只用 `addInitScript(fn, arg)`；所有用例只从 `tests/support/test.ts` 导入 `test`。
- 如果探针推翻了调研里的假设（例如 `setFixedTime` 刷新后失效），在本阶段就调整 harness，不留给后面的阶段。
- 每次运行记录 `browser.version()`。

### Phase 2: 账户模式、合成数据与导出（Account Mock, Data & Export）
**Goal:** 开发者可以把合成数据装进 mock 后端，在能被证明的账户模式下打开应用，并读到 db 读写记录和导出文件的内容。
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** MOCK-02, MOCK-03, MOCK-04, MOCK-05, MOCK-06, DATA-01, DATA-02, IO-02, IO-03
**Success Criteria** (what must be TRUE):
  1. mock 契约自测通过：`use("db")`、`use("user")`、`use("downloads")` 异步返回，同一个名字返回同一个结果，命名空间被冻结，未知名字返回 `null`。`tests/mocks/CONTRACT.md` 写明对齐的契约版本 0.2.96、已实现的条目和明确没实现的条目（`onSnapshot`、错误码、限流）。
  2. 账户模式用例能证明自己真的跑在账户模式：状态栏显示账户同步文案，mock 记录到恰好一次读取（路径 `data/users/<id>/state`），localStorage 里没有应用的键。临时让 `user.id()` 返回 `null` 时，这些用例会变红。
  3. 账户模式下记一笔后，测试能读到 mock 记录的写入；刷新页面后，数据仍然从 mock 读回。
  4. 合成的完整状态 fixture 和边界 fixture（旧类别名、最小状态、畸形导入文件）都已就位，并通过 Phase 1 的合成标记检查。用完整 fixture 启动后，五个类别的记录、各种状态的任务、自定义待办、力量历史和本周复盘都能在页面上找到。
  5. 账户模式下导出按钮出现。导出的日历 CSV 与根据 fixture 推导的期望逐字一致（表头、MM/DD/YYYY 日期、引号和逗号转义），导出的 JSON 备份与当前状态深度相等，文件名和内容都从 `downloads.save` 的记录中读到。
**Plans:** 5/5 plans complete

Plans:
**Wave 1**
- [x] 02-01-PLAN.md — Phase 1 审查修复（D-10）：tracer 为静态服务器的 Host 头和方法校验（WR-01）→ guard 按条删除、WebSocket 和后开 page、manual 时钟的“启动不写”（WR-02、WR-05、WR-06）→ PROBE-2c 标题、README 与 PROBES.md 一致、INFO 修复和处置记录（WR-03、WR-04）

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — 账户模式：tracer 为种子经 MockBackend 加载、记一笔写入 mock、刷新读回 → expectAccountMode 与 user.id() 为 null 的常驻反向对照、启动只读一次不写、导出按钮和下载记录、PROBE-7（开始前确认契约 0.2.96 原文可读）

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — 合成数据：tracer 为完整 fixture 经账户 mock 显示五个类别 → 推导 helper 证明 D-13 全部覆盖并在三个视图里找到 → 旧类别名、最小状态、畸形导入常量（DATA-01、DATA-02）
- [x] 02-05-PLAN.md — mock 契约（从 02-02 拆出）：tracer 为契约版本贯通到 CONTRACT.md 和 window.claude 自测、未实现清单、MOCK-06 核对 → 其余契约自测与原文摘录 → CONTRACT.md 的 mock 结构和重新核对步骤、README 的账户模式说明（MOCK-02、MOCK-04、MOCK-06）

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — 导出：tracer 为 JSON 备份与 fixture 深度相等 → 日历 CSV 与独立生成器逐字一致、手写金标准行、空导出 → 保存后的备份、导出幂等与隔离、README 与阶段收尾检查（IO-02、IO-03、MOCK-04）

**Notes:**
- mock 只做正常路径，不写任何 `reject` 逻辑。错误路径和加载延迟属于 v2（ERR-01 到 ERR-04）。
- `exposeBinding` 在页面脚本运行前是否可用，在本阶段的账户冒烟用例里直接验证。不可用就退回带前缀的 `sessionStorage` 方案，键名不能和应用的 `us-journey-tracker-v1` 冲突。
- 用到的契约条目抄进 `tests/mocks/CONTRACT.md`，不引用 Claude Code 临时目录里的路径。
- 合成数据的固定日期：今天是 2026-03-18（周三），本周是 03-16 到 03-22，抵达日期是 2026-01-12。任务的位置 id（`P<n>-<i>`）集中放在一个常量文件里，并注明会随源码顺序变化。

### Phase 3: 记一笔、编辑弹窗与本周视图（Composer, Editor & Week）
**Goal:** 开发者拥有可复用的记一笔、编辑弹窗和 toast 测试 helper，以及统一的已知 bug 标记约定，并用它们完整验证本周视图的渲染和交互。
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** WEEK-01, WEEK-02, WEEK-03, WEEK-04, WEEK-05, WEEK-06, EDIT-01, EDIT-02, EDIT-03, BUG-01
**Success Criteria** (what must be TRUE):
  1. 本周视图用例通过：标题、日期范围、五个类别的统计和目标、7 天记录列都与根据 fixture 推导的期望一致；上一周、下一周、本周切换和选中某天都按预期工作。
  2. 用“记一笔”切换类别、用预设标签直接记录或预填、按 Ctrl+Enter 提交后，记录出现在所选日期并被保存。添加预设标签、在编辑模式下删除、通过 toast 撤销都有用例，toast 用 `.on` 类断言，不用可见性断言。
  3. 把一条记录拖到另一天后，保存下来的状态里这条记录的日期确实变了；本周复盘文本保存后，刷新仍在。
  4. 从本周、日历、时间线点任意记录都能打开编辑弹窗，修改文字、类别、日期并保存后，三个视图同步更新。在弹窗里删除可以撤销，内容为空时不能保存；完成计划的弹窗可以修改完成日期，或改回未完成。
  5. 碰到的已知 bug（如本周视图的草稿丢失）用统一方式标记：一条普通的对照断言证明前提成立，再用一条窄断言加 `test.fail` 或 `test.fixme`，并附 `known-bug` 注解；每条都登记在 `tests/KNOWN-BUGS.md`，与 `.planning/codebase/CONCERNS.md` 的条目对应。
**Plans:** 4/4 plans complete

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — 共享 helper（composer、toast、expectSaved）：本周记一笔 tracer → WEEK-03 预设与类别、WEEK-04 预设增删撤销；内置预设只在页面内操作，toast 只在 Node 侧比较

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-04-PLAN.md — 已知 bug 约定（从 03-01 拆出）：tracer 为 knownBug、B1 成对用例、KNOWN-BUGS.md 和登记护栏 → N1 成对用例和护栏的反向对照（BUG-01）

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-02-PLAN.md — 本周视图：WEEK-01 渲染与 fixture 推导一致（tracer），WEEK-02 周导航和选中某天，WEEK-05 拖放，WEEK-06 复盘，B4 成对用例（manual 时钟）

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-03-PLAN.md — 编辑弹窗：editor helper 加本周入口 tracer，日历和时间线入口、丢弃修改、删除撤销、空文字不能保存，完成计划改日期和改回未完成，README 与阶段收尾

**Notes:**
- 记一笔的 helper 用根节点参数化（本周视图和日历日面板各有一个实例），Phase 4 直接复用。所有视图共用的 `expectSaved(predicate)` 也在本阶段建立。
- 拖放先用 `dragTo`，失败时依次退回手动鼠标序列、`dispatchEvent` 加 `DataTransfer`。用合成事件的用例要在注释里写明。
- 输入复盘后先等保存完成再做别的操作（N2），避免防抖被重绘还原。

### Phase 4: 日历与目标视图（Calendar & Goals）
**Goal:** 开发者能自动验证日历和目标两个视图的渲染与交互，直接复用 Phase 3 的记一笔、编辑弹窗和 toast helper。
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** CAL-01, CAL-02, CAL-03, CAL-04, GOAL-01, GOAL-02, GOAL-03, GOAL-04, GOAL-05
**Success Criteria** (what must be TRUE):
  1. 日历月份网格用例通过：周日起始、今天高亮、抵达日标记、记录 chips 和 “+N” 都正确。切换月份、回到今天、点格子选中日期都有用例，点相邻月份的格子会跳到那个月。
  2. 日面板显示当天的记录、完成的计划和到期任务。在日面板记一笔后，记录出现在当天并被保存；删除记录后可以通过 toast 撤销，点删除按钮不会误开编辑弹窗。
  3. 目标视图渲染力量卡片和 P1–P7 目标组，完成计数和进度条与根据 fixture 推导的期望一致；更新力量值（点保存按钮或按 Enter）后，显示最近的历史和达标提示。
  4. 勾选任务时，完成日期记为冻结的“今天”，进度随之更新，取消勾选后恢复；设置截止日期后，过期的任务显示“已过期”。
  5. 可以添加和删除自定义待办，内置任务没有删除按钮。
**Plans:** 2/3 plans executed

Plans:
**Wave 1**
- [x] 04-01-PLAN.md — 日历：tracer 为 D-01 的 35/42 格脚本核对、各 verify 共用的 json 报告检查脚本和 3 月整月网格由 fixture 推导 → 42 格、2 月边界、抵达日、chip 顺序与 CAL-02 导航 → 日面板分区与记一笔、删除加撤销、撤销 toast 过期（manual 时钟）、B1 的日历日面板实例（CAL-01..04）

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md — 目标视图：tracer 为七个目标组的计数和进度条由 fixture 推导 → 四张力量卡、力量值保存与历史、达标与不达标、失焦不保存（GOAL-01、GOAL-02）

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 04-03-PLAN.md — 任务交互：tracer 为页面内勾选内置任务并同步组计数和日历 → 取消勾选、截止日期与已过期、自定义待办增删和空白不添加 → N1 两种新触发、README（IN-08）与 KNOWN-BUGS 约定更新、阶段收尾（GOAL-03..05）

**Notes:**
- 开始前先用脚本核对对应 35 格和 42 格的两个固定月份。
- 力量值只在点保存或按 Enter 时保存，失焦不保存。达标用极大值或极小值触发，不写死目标数字。期望值从 fixture 推导，不复制任务原文。
- 只有撤销 toast 过期这类用例才单独启用 `clock.install`，同一个用例里不和 `setFixedTime` 混用。

### Phase 5: 时间线、导入与窄屏（Timeline, Import & Narrow）
**Goal:** 开发者能验证时间线视图、JSON 备份导入（确认、取消、错误文件、旧类别迁移）以及手机宽度下的关键布局，`npm test` 一次就能覆盖全部四个视图。
**Mode:** mvp
**Depends on:** Phase 2, Phase 3
**Requirements:** TL-01, TL-02, IO-04, IO-05, RESP-01
**Success Criteria** (what must be TRUE):
  1. 时间线按月倒序列出记录和完成的计划，没有内容时显示空状态提示；按类别筛选、只看“完成的计划”时，只留下对应的条目。
  2. 导入 JSON 备份的用例先注册对话框处理再操作，并断言提示文案：确认后全部数据被替换，取消后数据不变，选择非 JSON 文件时出现错误提示；导出后再导入，数据保持一致。
  3. 导入带旧类别名的 fixture 后，记录被迁移到新的类别，并在各视图里按新类别显示。
  4. 在手机宽度下，少量关键用例通过：编辑弹窗变成底部面板，日历 chips 变成圆点，本周日期纵向排列，选中某天后页面滚动到“记一笔”。
  5. 本阶段碰到的已知 bug（如取消导入后重选同一个文件没反应）按 Phase 3 的约定标记并登记。`npm test` 跑完全部用例时，除 `tests/KNOWN-BUGS.md` 登记的标记用例外全部通过，`us-journey-tracker.html` 的 sha256 仍与基线一致。
**Plans:** TBD

**Notes:**
- B2（取消导入后重选同一个文件没反应）先做 spike，确认 `setInputFiles` 对同一个文件是否派发 `change`。能复现就按约定用 `test.fail` 标记；无法复现就用 `test.fixme` 并写明原因。
- N3（导入 `{}` 这类合法 JSON 并确认后会清空全部数据）的期望行为还没定，只能用 `test.fixme`，等用户决定。
- 窄屏只用 `viewport`（约 520 × 900），不用设备描述符，不测拖拽。
- 文件输入用内存 buffer，磁盘上不放任何备份类文件。

## Progress

**Execution Order:**
按数字顺序执行：1 → 2 → 3 → 4 → 5。Phase 4 和 Phase 5 彼此独立，都只依赖前面的阶段。

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 测试环境、护栏与本地切片（Harness & Local Slice） | 4/4 | Complete    | 2026-11-01 |
| 2. 账户模式、合成数据与导出（Account Mock, Data & Export） | 5/5 | Complete    | 2026-11-03 |
| 3. 记一笔、编辑弹窗与本周视图（Composer, Editor & Week） | 4/4 | Complete    | 2026-11-03 |
| 4. 日历与目标视图（Calendar & Goals） | 2/3 | In Progress | - |
| 5. 时间线、导入与窄屏（Timeline, Import & Narrow） | 0/TBD | Not started | - |
