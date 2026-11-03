# Phase 2: 账户模式、合成数据与导出（Account Mock, Data & Export） - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Mode:** smart discuss（自动模式）。两个灰区的推荐答案用户都选了“全部接受”。

<domain>
## Phase Boundary

本阶段交付五样东西：
- 一个按 Claude Artifact 运行时契约 0.2.96 实现的 `window.claude` mock，只覆盖正常路径，提供 `db`、`user`、`downloads` 三个能力；
- 能被证明的“账户模式”打开方式；
- 第 2–5 阶段共用的合成数据 fixture，包括一份完整状态和几份边界数据；
- 账户模式下日历 CSV 和 JSON 备份导出的逐字验证；
- 修完 Phase 1 代码审查留下的 6 个 WARNING。

本阶段不做：
- 四个视图的交互测试（Phase 3–5）；
- mock 的错误路径和延迟（v2）；
- 导入（Phase 5）；
- 修改应用。

需求：MOCK-02、MOCK-03、MOCK-04、MOCK-05、MOCK-06、DATA-01、DATA-02、IO-02、IO-03。

</domain>

<decisions>
## Implementation Decisions

### 沿用的已定决定（来自 ROADMAP 和 research/SUMMARY.md，不再讨论）
- **D-01:** mock 的状态和调用记录放在 Node 侧的 `MockBackend`（`tests/mocks/claude-backend.ts`），这样刷新页面后数据还在。页面里的 `installClaudeMock(cfg)`（`tests/mocks/claude-runtime.ts`）通过一个 `exposeBinding` 和它通信，并且只在 `get`、`set`、`save` 被调用时才去碰这个 binding（懒调用）。`exposeBinding` 能否在页面脚本运行前使用，要在本阶段的账户冒烟用例里直接验证。如果不能，就退回 `sessionStorage` 方案：键名必须带前缀，不能和应用的 `us-journey-tracker-v1` 冲突。最终结论写进 `tests/PROBES.md`。
- **D-02:** mock 只做正常路径，不写任何 `reject`、错误码、限流或延迟逻辑；`handle()` 的 `default` 分支可以直接抛错，算编程错误。`tests/mocks/CONTRACT.md` 要写明三件事：对齐的契约版本是 0.2.96；已经实现的条目；明确没实现的条目，包括 `onSnapshot`、错误码和限流。条目原文抄进仓库，不引用 Claude Code 临时目录里的路径。
- **D-03:** mock 契约自测（`tests/e2e/platform/mock-contract.spec.ts`）覆盖这些行为：
  - `use(name)` 异步返回；
  - 同一个名字返回同一个结果；
  - 命名空间被 `Object.freeze`；
  - 未知名字返回 `null`；
  - `doc(path)` 校验路径语法。
- **D-04:** 注入只用 `addInitScript(fn, arg)` 这种函数加参数的形式。`installClaudeMock` 必须自包含，不能引用模块外的任何变量。
- **D-05:** 固定日期：今天是 2026-03-18（周三），本周是 03-16 到 03-22，抵达日期是 2026-01-12。fixture 里用到的内置任务位置 id（`P<n>-<i>`）集中放在一个常量文件里，注释写明这些 id 会随应用源码里任务的顺序变化。

### Mock 与账户模式
- **D-06:** 账户模式用固定的合成用户 id `synth-user-0001`，对应的文档路径是 `data/users/synth-user-0001/state`。路径常量放在 `tests/support/constants.ts`。
- **D-07:** “`user.id()` 返回 `null` 时账户用例会变红”用一条**常驻的反向对照用例**证明，不靠手动修改：
  - 用 `userId: null` 打开应用，这时应用会退回本地模式；
  - 断言账户模式的校验函数（例如 `app.expectAccountMode()`）**会失败**；
  - 这条用例每次 `npm test` 都跑。

  校验函数检查三件事：
  - 状态栏显示账户同步文案；
  - mock 恰好记录到一次读取，路径正确；
  - localStorage 里没有 `us-journey-tracker-v1`。
- **D-08:** 账户模式的就绪条件是两条同时满足：
  - 状态栏显示 `已同步保存到你的账户`；
  - `#exportCsv` 和 `#exportJson` 已经可见。

  原因是应用在 `setStatus` 之后还要再 `await window.claude.use("downloads")`，只看状态栏会抢跑。本地模式的就绪条件不变。
- **D-09:** 两种模式都通过 `app.open({ mode, seed, userId })` 打开，`mode` 默认是 `'local'`，Phase 1 的用例不用改：
  - `mode: 'account'` 时，`seed` 写进 `MockBackend` 的文档，不写 localStorage；
  - 测试通过 fixture（例如 `mock` 或 `app.backend`）直接读 Node 侧的读写记录和 downloads 记录，不用 `page.evaluate`。

  账户模式的端到端用例放在 `tests/e2e/storage/account-mode.spec.ts`，覆盖这几件事：
  - 启动时读一次、不写；
  - 记一笔后能读到写入；
  - 刷新后数据从 mock 读回；
  - localStorage 里没有应用的键。
- **D-10:** Phase 1 代码审查的 6 个 WARNING（WR-01 到 WR-06，见 `01-REVIEW.md` 和 `01-REVIEW-DISPOSITION.md`）放进本阶段的**第一份计划**一起修，修完更新处置记录：
  - WR-01：静态服务器校验 Host 头；
  - WR-02：`guard.reset()` 不再一次清空全部记录，改成只清掉指定的那一类或那一条；
  - WR-03：PROBE-2c 的标题和断言保持一致；
  - WR-04：README 第 7 节对解析层的描述与 PROBES.md 的实测保持一致；
  - WR-05：让护栏能对第 2、3 层的违规报警，或者把限制写清楚；
  - WR-06：“启动时 localStorage 为空”从单次采样改成更可靠的断言。

  7 个 INFO 由规划者决定是否顺手处理，不处理的保持 open。

### 合成数据与导出
- **D-11:** fixture 用 JSON 文件，放在 `tests/fixtures/`，每个文件都带顶层 `_synthetic` 标记（SAFE-03 会检查）。至少有这几份：
  - 完整状态 `full-state.json`（DATA-01）；
  - 旧类别名 `legacy-categories.json`（DATA-02）；
  - 最小状态 `minimal-state.json`（DATA-02）。

  畸形导入的内容（非 JSON 文本、结构不对的 JSON 等）写成 TS 常量（例如 `tests/fixtures/malformed-imports.ts`，文件里也带 `_synthetic` 字样），只在内存里使用。磁盘上不放任何文件名像备份或导出文件的东西：隐私检查会拦截文件名含 `备份` 的 `.json`，以及以 `在美国的日子-` 开头的 `.json` 和 `.csv`。
- **D-12:** 记录文字都是虚构的，统一以 `SYNTH-` 开头，中英混合，并故意包含：
  - 英文双引号、逗号、换行，用来测 CSV 转义；
  - `<`、`&` 和单引号，用来测页面转义；
  - 超过 80 字符的长文本，用来测 CSV 的 Subject 截断。

  不复制应用 `CATS`、`GROUPS`、`LIFTS` 里的任何文字，包括预设标签、任务原文和力量目标数值（Phase 1 的 D-09）。预设标签的增删用虚构标签名。
- **D-13:** 第 2–5 阶段共用一份完整 fixture。期望值由 helper 根据 fixture 推导（比如按日期和类别计数、找出过期任务），用例里不抄具体数字。完整 fixture 至少覆盖：
  - 五个类别的记录，其中包含本周和非本周的；
  - 已完成、已过期、今天到期、将来到期的任务；
  - 自定义待办；
  - 力量历史；
  - 本周复盘；
  - 预设标签的增删；
  - 抵达日期。
- **D-14:** CSV 里内置任务的原文属于个人计划，只在**运行时从目标页 DOM 读取**（复选框 `[data-task="<id>"]` 的 `aria-label`），永远不写进仓库、fixture 或期望文件。不解析应用源码。
- **D-15:** CSV 的期望值在测试里按规格**独立**算出整份文本，然后与 `downloads.save` 收到的 `data` 逐字比较。规格包括：
  - 表头；
  - 记录行：`[类别] 首行前 80 字`、`MM/DD/YYYY`、`True`、全文；
  - 完成行和截止行：`完成：` / `截止：` 加任务文字，`<group> 计划`；
  - 含 `"`、`,`、换行的单元格要加引号，内部的 `"` 写成 `""`；
  - 行之间用 `\n` 连接。

  另外再加几行**手写的金标准行**（只用合成记录），锚定转义规则，防止独立生成器和应用犯同一个错误。文件名断言为 `在美国的日子-日历.csv`。
- **D-16:** JSON 备份要同时满足两条：
  - 与 `MockBackend` 里最新保存的文档深度相等（如果还没保存过，就与种子文档相等）；
  - 与去掉 `_synthetic` 之后的 fixture 深度相等（`normalize()` 会丢掉未知键）。

  文件名断言为 `在美国的日子-备份-2026-03-18.json`。导出内容只在内存里比较，不写到磁盘，`test-results/` 里也不写。

### Claude's Discretion
- `MockBackend` 记录的具体结构（`reads`、`writes`、`downloads` 等）、binding 名称、fixture 的注入方式，以及 helper 的拆分，由规划者按 research/ARCHITECTURE.md 决定。
- 期望值推导 helper 放在哪里、叫什么名字（例如 `tests/support/expect-from-fixture.ts`），由规划者决定。
- 7 个 INFO 级审查发现要不要顺手处理，由规划者决定。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/support/test.ts`：唯一的 `test`/`expect` 出口，带 auto fixture：
  - `guard`：网络护栏、页面错误和控制台错误收集，teardown 时断言没有违规；
  - `frozenClock`：默认 `setFixedTime`，可以用 `test.use({ clockMode: 'manual' })` 关闭；
  - `app`：`AppHarness`。

  新的 mock fixture 也挂在这里。
- `tests/support/app.ts`：`AppHarness`，提供 `open({ seed })`、`ready()`、`reload()`、`persisted()`、`expectPersisted()`，以及“没有才写”的 `seedLocalStorageIfAbsent`。本阶段在这里加 `mode: 'account'`。
- `tests/support/constants.ts`：`STATE_KEY`、`FROZEN_NOW`、`FROZEN_TODAY`、`SYNTHETIC_MARKER`、`APP_ORIGIN` 等，都是纯常量。
- `tests/support/strings.ts`：界面中文文案的唯一出处。本阶段要加账户状态文案 `已同步保存到你的账户`、导出 toast `已导出`、两个导出文件名。
- `tests/e2e/platform/repo-hygiene.spec.ts`：SAFE-03 检查 `tests/fixtures/` 下每个文件都带 `_synthetic`（文本包含就算）。
- `tools/privacy/privacy-check.mjs`：每次提交都会检查以下内容，新 fixture 和用例必须通过：
  - 文件名；
  - 本机路径；
  - 邮箱；
  - 从 CATS/GROUPS/LIFTS 提取的个人计划词（≥4 个字、含汉字）。

### Established Patterns
- 应用的 `init()`（`us-journey-tracker.html:368-379`）：
  - 先渲染一次；
  - 然后 `Promise.all([use("db"), use("user")])`，接着 `await user.id()`；
  - `db` 和 `id` 都存在时，用 `db.doc("data/users/"+id+"/state")` 读写，`load` 返回 `s.exists ? s.data() : null`，`save` 调 `ref.set(s)`；
  - 否则用 localStorage；
  - `load` 抛错时**静默**退回 localStorage，这就是需要 MOCK-05 的原因；
  - 最后 `setStatus`，再 `await use("downloads")` 才显示导出按钮。
- 保存有 600 ms 防抖（`persist` → `flush`），并且是整个状态一起保存。持久化断言沿用 D-18：先 `expect.poll`，再 `reload`，最后断言 DOM。
- 导出（`us-journey-tracker.html:640-653`）：
  - `csvCell` 遇到 `"`、`,`、换行时加引号；
  - `usDate` 输出 `MM/DD/YYYY`；
  - 记录行之后是任务行：先判断是否完成且有完成日期，否则看有没有截止日期；
  - 只有表头时 toast `还没有可导出的日期`；
  - 文件通过 `window.__dl.save({filename, data})` 保存，成功后 toast `已导出`。
- `normalize()` 会丢掉未知键，并把 `LEGACY` 里的旧类别映射到新类别；映射不到的类别变成 `其他`。

### Integration Points
- `playwright.config.ts`：`workers: 2`、`retries: 1`、Edge 通道、死代理。新的 spec 目录 `tests/e2e/storage/` 会自动被收进来。
- `tests/README.md` 和 `tests/PROBES.md`：本阶段要补充账户模式的用法、mock 的说明，以及 `exposeBinding` 时序的结论。

</code_context>

<specifics>
## Specific Ideas

- 反向对照用例（D-07）的意义：证明账户模式的校验不是“永远通过”。如果应用静默退回本地模式，这条校验必须能发现。
- CSV 金标准行至少要有一行同时包含引号、逗号和换行，并且长度超过 80 字符。

</specifics>

<deferred>
## Deferred Ideas

- mock 的错误路径（读写失败、下载被拒绝、限流）和加载延迟：v2（ERR-01 到 ERR-04）。
- 个人内容外置和本地私有目录：Phase 6，还没加进 ROADMAP。

</deferred>
