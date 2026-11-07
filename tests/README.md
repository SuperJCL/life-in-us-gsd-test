# 测试使用说明

## 1. 这是什么

这里是对单文件网页应用 `us-journey-tracker.html` 的本地黑盒浏览器测试。测试用 Playwright Test 驱动本机 Edge，只使用合成数据，不连接任何线上服务。应用从 v2.0 起按阶段计划修改，每次修改都要同步更新 sha256 基线。

## 2. 准备

- 需要 Node.js 20 或更高版本，以及系统自带的 Microsoft Edge。
- 应用文件 `us-journey-tracker.html` 就在仓库根目录，里面只有合成的示例计划（见 `PRIVACY.md`），克隆后直接 `npm ci --ignore-scripts` 和 `npm test` 即可。缺少它说明检出不完整，`npm test` 会在启动阶段用中文提示你检查检出，而不是报出看不懂的错误。
- 所有者另有本机的 `private/plan-seed.json`（原计划，不进仓库）。没有它时，不涉及应用文件的提交照常检查（规则 D 跳过）；提交或推送应用文件会被隐私检查以退出码 2 阻止。没有个人计划的人可以建一份空种子 `{"v":1,"plan":{}}` 选择加入（见 `PRIVACY.md` § 5）。
- 克隆后先运行一次 `git config core.hooksPath .githooks`，启用隐私钩子，详见 `PRIVACY.md`。这条命令只影响本仓库。
- 安装依赖用 `npm ci --ignore-scripts`。它只按 lockfile 安装项目内依赖，不运行安装脚本，不会下载浏览器。

## 3. 运行

- `npm test`：无界面跑完全部用例。
- `npm run test:ui`：Playwright UI 模式，可以逐步回放每个用例的动作和页面快照。它会打开一个使用本机 Edge 或 Chrome 的窗口。如果提示需要安装浏览器，不要安装，按第 8 节“浏览器出问题时”处理。

只跑部分用例时，把参数接在 `--` 后面，例如 `npm test -- -g "IO-01"`。

需要机器判定“没有失败、没有 flaky、指定的用例都实际运行”时，用 `PW_JSON_REPORT=test-results/<名字>.json` 前缀运行（同时加 `--workers=1` 最省资源），再用 `node tools/test-report/check-report.mjs <报告> "<标题>" …` 检查，通过时输出 `REPORT OK`；报告里任何不带 known-bug 注解的 skipped 用例、没有 test 的 spec、同标题一过一败都会判为失败；全量回归再加 `--min-expected N`（至少跑了 N 条），否则被过滤或被中断的部分运行也会得到 `REPORT OK`；`node tools/test-report/check-report.mjs --self-test` 是它的反向对照，证明脚本在该失败时会失败。原因：配置里 `retries: 1`，单看退出码分不出“重试后才通过”的用例，也看不出用例是不是被过滤掉没跑。报告只放在已被 git 忽略的 `test-results/` 下，只在本机读，只打印计数和标题。

## 4. 看报告

- HTML 报告生成在 `playwright-report/`，不会自动弹出。用 `npx playwright show-report` 打开：它只在本机起一个查看服务，使用项目内已装好的 Playwright，不安装任何东西。看完在终端按 Ctrl+C 结束查看服务。
- 如果运行 `npx playwright show-report` 后没有自动打开浏览器（例如在内嵌终端里），终端会打印一个 `http://localhost:9323` 形式的地址，手动在浏览器里打开它即可。查看服务会一直运行，直到你按 Ctrl+C。
- 失败时的截图和 trace 只保存在 `test-results/`，已被 git 忽略。里面可能拍到个人计划文字，不要上传，也不要提交。

## 5. 目录结构

| 路径 | 放什么 |
|------|--------|
| `tests/support/` | 常量、界面文案、`test.ts`（唯一的测试入口和 fixture）、`app.ts`（AppHarness）、`composer.ts`（记一笔）、`editor.ts`（编辑弹窗）、`toast.ts`（toast）、`calendar.ts`（日历视图读回）、`goals.ts`（目标视图读回和内置任务的页面内操作）、`timeline.ts`（时间线读回）、`import-file.ts`（内存导入文件和确认框处理）、零依赖静态服务器 |
| `tests/e2e/` | 面向功能的用例，例如 `smoke.spec.ts` |
| `tests/e2e/platform/` | 测试平台自身的用例：护栏自检、固定时钟、应用完整性、仓库卫生、干净克隆（SEC-04）、运行时探针、已知 bug 登记护栏 |
| `tests/e2e/storage/` | 存储模式用例，例如账户模式 `account-mode.spec.ts`，以及 USJ_CONFIG 配置缝 |
| `tests/e2e/data/` | 合成数据用例：完整 fixture、旧类别名、最小状态在三个视图里的呈现，以及冻结 id 和旧备份映射、normalizePlan 单元用例 |
| `tests/e2e/week/` | 本周视图：渲染、周导航、记一笔、预设标签、拖放、复盘，以及已知 bug 的成对用例 |
| `tests/e2e/editor/` | 编辑弹窗：从本周、日历、时间线三个入口修改，删除加撤销，完成计划的弹窗 |
| `tests/e2e/calendar/` | 日历视图：月历网格、月份导航、日面板、删除加撤销和 toast 过期，以及 B1（日面板草稿）、N1（日面板删除）已知 bug 的对照加标记用例 |
| `tests/e2e/goals/` | 目标视图：目标组和力量卡、力量值保存、任务勾选、截止日期和自定义待办，以及 N1（目标页勾选任务）已知 bug 的对照加标记用例 |
| `tests/e2e/io/` | 导出与导入：日历 CSV、JSON 备份，导入的确认、取消、错误文件、往返和旧类别迁移，以及 B2、N3 的已知 bug 用例；导出内容从 `app.backend.downloads` 读取 |
| `tests/e2e/security/` | 转义、导入白名单和加载修正：渲染防线（`escaping.spec.ts`：入口检查绕过的变体、计划值变体、检测器反向对照、源码门槛，以及两道防线合在一起的真实应用用例）、入口防线（`id-whitelist.spec.ts` 的页面用例和 `state-validation.spec.ts` 的 Node 侧单元用例）；两道防线各自独立成立，也要合在一起成立 |
| `tests/e2e/timeline/` | 时间线：按月倒序、类别和“完成的计划”筛选、空状态、跨年、新增内容的联动 |
| `tests/e2e/narrow/` | 窄屏（520 × 900）：编辑弹窗底部面板、日历圆点、本周纵向排列、选日后滚动 |
| `tests/mocks/` | 账户模式用的 `window.claude` mock：页面侧 `claude-runtime.ts`、Node 侧 `claude-backend.ts`（`MockBackend`），以及契约对齐说明 `CONTRACT.md` |
| `tests/fixtures/` | 合成数据，每个 fixture 都带 `_synthetic` 标记：`full-state.json`（完整状态，后续阶段共用）、`legacy-categories.json`（旧类别名映射）、`minimal-state.json`（最小空状态）、`local-seed.json`（本地与账户模式的小种子）、`malformed-imports.ts`（畸形导入内容，只是内存常量） |
| `tools/plan/` | 本地提取工具：只读 `private/` 下的原件副本，检查示例计划与种子没有共享内容 |
| `tests/PROBES.md` | 运行时探针的结论 |
| `tests/KNOWN-BUGS.md` | 已知 bug 登记表：编号、出处、对照用例和标记用例的标题、期望行为和现状 |

## 6. 约定

- 用例标题用英文，以需求编号或 `PROBE` 开头，例如 `IO-01 ...`、`PROBE-3 ...`。
- 注释和说明文档用中文；变量名、函数名、文件名用英文。
- 界面中文文案只放在 `tests/support/strings.ts`，用例里不写死。
- spec 只从 `tests/support/test.ts` 导入 `test` 和 `expect`，不直接导入 `@playwright/test`。
- 种子数据用“没有才写”的 init 函数写入 localStorage，防止 `reload` 时覆盖刚保存的新数据。
- 持久化断言按固定顺序：先 `expect.poll` 到 localStorage 里有数据，再 `reload`，最后断言 DOM。不要用固定睡眠。
- 护栏自检只用 `guard.remove(kind, match)` 删掉自己制造的那一条违规，删除前先断言该类记录恰好是预期的那几条；不提供清空全部记录的方法。
- 用例不稳定（flaky）就是缺陷。配置里 `retries` 是 1，但一次重试通过也要查明原因，不能靠重试掩盖。

## 7. 护栏

每次 `npm test` 都自动生效，下面每一项都有对应的用例证明它会在该失败的时候失败：

- **网络拦截**（`tests/e2e/platform/guardrails.spec.ts`、`tests/e2e/platform/probes.spec.ts`）：分几道。
  1. `context.route` 只放行应用自己的来源；两个字体主机直接中止并记为“已预期拦截”；其他外部 HTTP 请求会让用例失败。
  2. `--host-resolver-rules` 让除 `127.0.0.1` 之外的主机名都解析失败。
  3. 死代理 `127.0.0.1:9` 让所有非回环连接只能连到本机一个关闭的端口。

  `route` 只看得到 HTTP 请求，看不到浏览器直接发起的 socket 连接，例如应用 head 里的 `preconnect`。后两道（第 2、3 道）就是为这类连接准备的。哪一层已被证明，以 `tests/PROBES.md` 的 PROBE-2 为准：
  - 解析层已证明：直连的名字（实测只有回环名 `localhost`、`probe.localhost`）除 `127.0.0.1` 外都解析失败（`ERR_NAME_NOT_RESOLVED`）；经过代理的名字（例如 `.invalid` 主机）浏览器不在本机解析，由代理层保证，表现为 `ERR_PROXY_CONNECTION_FAILED`。
  - 代理层已证明：`.invalid` 地址和 WebSocket 都只到达代理，页面请求以 `ERR_PROXY_CONNECTION_FAILED` 失败。
  - `preconnect` 本身没有被直接观察到：探针运行时无界面 Edge 没有发出任何 `preconnect`。所以“`preconnect` 到不了字体主机”是由已证明的两层（解析规则加死代理）推断出来的，不是直接观察到的事实。
  - 探针里观察到 Edge 自己的后台流量（`bing.com`、`edge.microsoft.com`）也只到达了本机的录制代理，没有到达任何真实主机。
- **guard 能报警的范围**（`tests/support/test.ts`）：route 看得到的 HTTP 请求、页面发起的 WebSocket、同一 context 里任何 page（包括用例后开的）的未捕获异常和 `console.error`，都会让用例失败。`preconnect` 这类不产生 Playwright 事件的连接，guard 无法报警，只能由解析层和死代理挡住（PROBE-2 证明）。
- **固定时钟**（`tests/e2e/platform/environment.spec.ts`）：页面时间固定在 2026-03-18 中午（UTC），时区 `America/New_York`，语言 `zh-CN`，结果与机器设置无关。
- **页面错误**（`tests/e2e/platform/guardrails.spec.ts`）：页面里未捕获的异常和 `console.error` 会让用例失败，不会被悄悄吞掉；已预期拦截的字体请求产生的噪音会被过滤。
- **应用完整性**（`tests/e2e/platform/app-integrity.spec.ts`）：测试记录了应用文件的 sha256 基线，基线随每次应用改动在同一次提交里有意识地更新；改了不更新时 SAFE-02 变红。
- **合成标记**（`tests/e2e/platform/repo-hygiene.spec.ts`）：fixture 必须带 `_synthetic`，报告和截图目录必须被 git 忽略。

## 8. 浏览器出问题时

- 绝对不要运行 `npx playwright install`，任何形式都不要，也不要运行 `npm init playwright`。测试使用系统自带的 Edge，不需要下载浏览器；安装命令会往你的机器上装东西，也可能装错包。
- Edge 启动失败时，可以临时改用本机 Chrome：PowerShell 里运行 `$env:PW_CHANNEL='chrome'; npm test`，Git Bash 里运行 `PW_CHANNEL=chrome npm test`。
- 两个都不行时，停下来排查，不要安装浏览器。

## 9. 隐私

本仓库会公开，所以：

- 只用合成数据，fixture 必须带 `_synthetic` 标记。
- 不复制个人计划文字到测试、fixture 或文档里。应用里只有合成的示例计划，所有者的原计划只在本机种子里。
- 不提交报告、截图和 trace。
- 不使用 `--no-verify` 跳过隐私钩子。
- 详见 `PRIVACY.md`。

## 10. 探针结论

PROBE-1 到 PROBE-8 的结论、证据和采用的方案见 `tests/PROBES.md`；其中 PROBE-8 是 B2（取消导入后再选同一个文件）的 spike。它们每次 `npm test` 都会重新运行，假设不成立时用例会变红。

## 11. 账户模式

应用在 Claude Artifact 里通过 `window.claude` 的 `db` 存数据；在本地直接打开时没有它，会退回 localStorage。账户模式就是在页面里装上 mock，让应用走 `db` 这条路，并且把读写和导出都记在 Node 侧，用例可以直接读到。

- **怎么打开：** `await app.open({ mode: 'account', seed, userId, expectStore })`。`mode` 默认是 `'local'`，所以本地模式的用例不用改。`seed` 写进 Node 侧的 `MockBackend`，不写 localStorage；`userId` 缺省是合成用户 `synth-user-0001`，显式传 `null` 表示没有身份；`expectStore` 只给下面的反向对照用例用。
- **就绪条件（D-08）：** 状态栏显示账户同步文案，并且 `#exportCsv` 和 `#exportJson` 两个导出按钮都可见。`app.open()` 和 `app.reload()` 内部已经等了这两条，用例不用自己再等。只看状态栏会抢跑：应用在显示状态之后还要再等 `downloads` 能力，导出按钮才出现。
- **怎么读记录（D-09）：** 用 `app.backend.reads`（每次读取的路径）、`app.backend.writes`（每次写入的路径和内容）、`app.backend.downloads`（每次导出的文件名和文本）、`app.backend.lastState()`（账户文档的当前内容，还没有文档时是 `null`）。不要用 `page.evaluate` 去读 mock 的数据。保存有 600 ms 防抖，等写入落盘用 `app.expectPersisted(...)`，它内部是 `expect.poll`，不用固定睡眠。
- **`app.expectAccountMode()` 和反向对照（D-07）：** 它检查三件事：状态栏是账户同步文案；mock 恰好记录到预期次数的读取，且路径是账户文档路径；页面 localStorage 里没有应用的键。`reload` 之后读取次数会变多，用 `app.expectAccountMode({ reads: 2 })`。为了证明这个检查不是永远通过，`tests/e2e/storage/account-mode.spec.ts` 里有一条常驻的反向对照用例：用 `userId: null` 打开应用，应用会静默退回 localStorage，这时 `expectAccountMode()` 必须失败。它每次 `npm test` 都会运行。
- **mock 只做正常路径：** 没有拒绝、错误码、限流和延迟（它们是 v2 的 ERR-01 到 ERR-04）。对齐的契约版本、已实现和未实现的条目、mock 的结构和重新核对的步骤都写在 `tests/mocks/CONTRACT.md` 里，契约自测在 `tests/e2e/platform/mock-contract.spec.ts`。
- **网络：** binding 是页面和本机 Node 进程之间的往返，不走网络，所以 guard 和第 7 节的网络兜底都不变。

## 12. 合成数据与导出

- **四个 fixture 的用途：** `full-state.json` 是 Phase 2 到 5 共用的完整状态（各类别的记录、任务状态、自定义待办、力量历史、复盘、预设标签增删）；`legacy-categories.json` 检查旧类别名迁移；`minimal-state.json` 是只有标记的最小状态，用来测空导出和空视图；`malformed-imports.ts` 是畸形导入内容，只是内存常量，不落盘，避免被误认成真实备份（D-11）。`local-seed.json` 是本地与账户模式冒烟用的小种子。
- **读取和推导：** `loadFixture(name)` 与 `withoutSynthetic(state)` 在 `tests/support/fixture-files.ts`；应用的 normalize 会丢掉 `_synthetic`，所以导出的备份要和去掉它的 fixture 比较。`tests/support/expect-from-fixture.ts` 里是按规格独立写的推导函数。期望值一律从 fixture 推导，不在用例里抄数字（D-13）。
- **位置 id：** 内置任务 id 自 Phase 7 起冻结在示例计划里，不再随顺序变化（PLAN-05）；`tests/support/task-ids.ts` 里记录的就是这组冻结 id。
- **内置任务文字：** 只在运行时从目标页的 aria-label 读取，放在单个用例的内存里，不写进任何文件、annotation 或报告（D-14）。
- **导出用例：** 文件名和内容从 `app.backend.downloads` 读，只在内存里比较，不写文件、不附加到报告（D-16）；不使用 Playwright 的下载事件。日历 CSV 的期望由独立生成器 `expectedCalendarCsv` 算出，再用用例里手写的金标准行锚定转义规则、80 字符截断和日期格式（D-15）；金标准与应用不一致时先按规格核对金标准，不要把它改成应用的输出。
- **合成文字的写法：** 以 `SYNTH-` 开头，中英混合，中文只用短词。

## 13. 共享 helper

这些 helper 都只依赖 `@playwright/test` 和 `./strings`，不从 `./test` 导入（避免循环引用）；它们只返回定位器和动作，不持有元素句柄，因为应用每次重绘都会重建 DOM。

- **`composer(page, 'w' | 'c')`（记一笔）：** `'w'` 是本周视图的实例，`'c'` 是日历日面板的实例，共用一套选择器。常用成员：`text`、`addButton`、`pickCategory(name)`、`type(s)`、`append(s)`、`submit('click' | 'keyboard')`、`draft()`、`addPreset(name)`、`toggleEditMode()`。内置预设标签是个人计划文字（D-14）：只按序号选，点选、删除和读取都用 `presetIndexes / clickPreset / deletePreset` 在页面内完成，文字只在 Node 侧做布尔比较，不打印、不拼进选择器或断言消息。fixture 里的合成标签和 `SYNTH-` 开头的新标签可以真实点击。
- **失败输出脱敏要覆盖 Playwright 的调用日志（D-14）：** 动作和单元素断言失败时，日志会打印命中元素的预览（属性加文字），被遮挡时还会打印遮挡元素的预览，定位器命中多个元素时 strict mode 报错会列出每一个。所以属性或文字带个人计划原文的元素（内置预设、内置任务条目、力量备注）不做 Playwright 动作和单元素断言，只用 `toHaveCount` 计数，或用 `page.evaluate` 读回序号、id、布尔；定位器要精确到合成 id。
- **`editor(page)`（编辑弹窗）：** 从记录打开用 `ed.openLog(entry)`，从已完成的计划打开用 `ed.openTask(entry)`，两者都会确认弹窗已打开且标题对。日面板的条目里还有删除按钮，要传条目里的 `.li-text`，不要传整条。常用成员：`setText`、`setCategory`（点完确认 `aria-pressed`，整个表单会被重绘）、`setDate`、`save('click' | 'keyboard')`、`deleteEntry`、`cancel`、`markUndone`、`expectOpen`、`expectClosed`。弹窗是 `showModal` 打开的，背景不可交互：操作弹窗以外的元素之前先 `expectClosed`。Escape 和点遮罩走浏览器原生关闭，用例直接按键或点击。完成计划的弹窗会显示计划原文，所以只为合成的自定义计划（`c-synth-2`）打开。
- **toast（`toast.ts`）：** `expectToast(page, text)`、`expectToastPrefix(page, prefix)`、`expectUndoOffered(page)`、`undo(page)`、`expectToastGone(page)`，以及带力量名称的 toast 用的 `expectToastSuffix`、`expectToastContains`（只在 Node 侧比较后缀或片段，失败消息固定为“内容已隐藏”）。是否显示只看 `#toast` 的 `.on` 类（D-04）：toast 消失后文字仍留在 DOM 里，元素在 Playwright 看来仍然可见，所以引用 toast 的 spec 里不用可见性断言（`tests/support/toast.ts` 本身也不用）。比较都在 Node 侧用 `expect.poll` 完成，失败消息只含期望值或“内容已隐藏”。带撤销的 toast 只显示 5 秒，所以点撤销前不要做别的耗时操作。
- **`app.saved()` 和 `app.expectSaved(predicate, message?)`（统一的“已保存”）：** 账户模式只认应用发出的写入，`saved()` 返回 `app.backend.writes` 最后一条的内容，还没有写入时是 `null`，mock 里的种子文档不算保存；本地模式读 localStorage，键不存在或内容与 `open()` 写入的种子原文相同时是 `null`。`expectSaved` 用 `expect.poll` 等 predicate 成立，默认 message 不含状态内容。新用例用它们；Phase 1、2 的 `persisted()`、`expectPersisted()` 保留不动。
- **`calendar.ts`（日历视图读回）：** `gotoCalendar`、`readMonth`、`readCellLogClasses`、`readDayPanelLogClasses`、`readDayPanel` 等，一次 `page.evaluate` 读回整月或整个日面板，再在 Node 侧与 `expect-from-fixture.ts` 的独立推导比较。只读日期、类名、aria-label、id、组号和数量，不读到期和完成 chip、日面板计划条目的文字（它们是个人计划原文）。
- **`goals.ts`（目标视图读回和任务操作）：** `gotoGoals`、`readGroups`、`readLifts`、`liftHistoryEquals`、`checkTask`、`setDue`、`readTaskRow`。内置任务的复选框和截止日期只在页面内按位置 id 操作和读回（`checkTask`、`setDue`、`readTaskRow`），不做定位器动作、文字断言或可见性断言，因为它们的 aria-label 是任务原文，Playwright 的调用日志会打印；只有合成的自定义任务才用真实点击和填写。
- **`timeline.ts`（时间线读回）：** `gotoTimeline`、`pickFilter`、`readTimeline`。一次 `page.evaluate` 读回筛选按钮状态、月份标题、条目的 id、日期、所属月份、记录的类别标签和固定文案；完成计划条目的文字是个人计划原文，不读，只读 id 和日期。
- **`import-file.ts`（导入文件和确认框）：** `jsonImportFile`、`textImportFile`、`chooseImportFile`、`answerNextDialog`、`recordDialogs`。文件只存在于内存（`{ name, mimeType, buffer }`），文件名必须以 `synth-` 开头，helper 会检查；`answerNextDialog` 预先登记下一次对话框的处理并记录文案，`recordDialogs` 只记录、用来断言“没有弹对话框”。
- **`app-source.ts`（`loadAppPure`，白盒）：** 在 Node 里用 `node:vm` 求值应用的纯函数段（第一个常量声明到 saving 横幅之间，只含常量和纯函数，不碰 DOM），返回需要的绑定，给 normalizePlan、normalize、导入检查这类分支多的单元用例用，不开浏览器。期望值仍在用例里独立写出，不读应用的实现；页面路径（加载、导入、渲染）仍由浏览器用例覆盖，两条路径不互相替代。
- **`app-variant.ts`（`serveAppVariant`，白盒）：** 只在内存里提供改过的应用：读应用文件，把每处查找文字恰好替换一次，再用 `page.route` 只给这一个 page 提供改过的页面；磁盘上的应用文件和静态服务器不变，SAFE-02 照旧通过。用来分别证明两道防线：`BYPASS_NORMALIZE` 绕过入口检查才看得到渲染防线，`DISABLE_ESCAPING` 关掉转义证明检测器不是空转，`planValueEdit` 只在内存里改 DEFAULT_PLAN 来放计划值载荷。必须在 `app.open()` 之前调用；两道防线合在一起的用例不使用它。
- **期望值从 fixture 推导（D-10）：** 本周的标题、范围、计数、7 列内容、时间线日期标签等都由 `expect-from-fixture.ts` 的函数独立算出（`weekCountsByCategory`、`weekDayColumns`、`mdLabel`、`timelineDateLabel`、`expectedTimeline`、`expectedNormalize` 等），缺的推导函数加在那里，用例里不抄数字。
- **时间与保存：** 输入复盘之后，先 `expectSaved` 等保存完成再做别的操作，防止防抖期间的重绘把文本框还原（N2，D-03）。manual 时钟（`test.use({ clockMode: 'manual' })`，`page.clock.install({ time })` 加 `pauseAt`，再用 `runFor` 推进）现在有三类用途：(1) 证明“没有保存”（含力量输入框失焦、空白待办）：`runFor` 推过 600 ms 防抖后比较 `app.backend.writes.length`，再用一次哨兵写入证明这个窗口确实推进了防抖（D-05、D-15）；(2) 撤销窗口和 toast 过期：撤销用例的顺序是 install、open、`expectAccountMode`、`pauseAt`、动作、`runFor(1_000)` 推过防抖、再 undo；过期用例再推过 5 秒，看 `#toast` 的 `.on` 消失、`#toast.act button` 为 0 个；(3) 带计时器的刷新（B4）：暂停时钟后输入、不推进防抖就刷新。同一个用例里不混用 `setFixedTime`，不用固定睡眠。

## 14. 已知 bug

已知 bug 在修复它的那个阶段之前保持现状，只在测试侧标记和登记（BUG-01）。

- **一条或多条对照用例加一条 `test.fail`（D-11）：** 每个已知 bug 是同一个 `test.describe` 里的几条用例，多数是一条对照加一条标记，B4 有两条对照用例。对照用例不带标记，走完全相同的准备和触发，断言前提成立；标记用例第一句调用 `knownBug(id, summary, opts?)`（来自 `tests/support/test.ts`），只断言一条期望的正确行为。分成两条，是因为 `test.fail` 会把同一条用例里任何原因的失败都当成预期失败。
- **`test.fail` 还是 `test.fixme`：** 默认 `test.fail`。只有无法稳定复现、或期望行为未定时才用 fixme（`{ fixme: '<原因>' }`），并在登记表的“现状”里写明原因。
- **先确认复现：** 标记前先去掉标记运行一次，确认失败点正是那条期望断言，再恢复。没有亲眼复现的问题不标成已知 bug。
- **登记：** 在 `tests/KNOWN-BUGS.md` 的登记表里加一行，写明编号、`.planning/codebase/CONCERNS.md` 的出处、两个用例的完整标题、期望行为和现状（D-12）。`tests/e2e/platform/known-bugs-registry.spec.ts` 的护栏用例会双向核对 spec 里的编号和登记行、用例标题，漏登记或写错标题都会变红。
- **预期现象：** 跑全部用例时，登记的标记用例在列表里带 x 标记，但汇总计为通过（预期失败），这是正常的；应用修好之后它们会变红，提醒去掉标记。

B2 有两条对照用例（control 和 reset path，写法同 B4 的 reload path）；N3 的标记用例选了“格式错误提示”作为期望，原因写在 `tests/e2e/io/known-bugs.spec.ts` 的注释里。

## 15. 导入和窄屏用例的注意事项

- **导入文件都是内存里的文件：** 用 `setInputFiles` 的 `{ name, mimeType, buffer }` 形式，磁盘上不放任何像备份的文件；文件名一律以 `synth-` 开头（helper 会检查）。
- **先注册对话框处理，再选文件：** 用 `answerNextDialog` 登记处理，再 `chooseImportFile`；确认框的文案放在 `strings.ts`，逐字比较。不应弹对话框的用例用 `recordDialogs` 断言记录为空。
- **FileReader 是异步的：** confirm 在读完文件之后才弹出，要用 `expect.poll` 等，不能在 `setInputFiles` 返回后立刻断言。
- **B2：** 取消导入后文件框没有清空；期望断言用 `#importJson` 的 value 为空，不断言“change 会再次触发”，原因见 PROBE-8（Playwright 每次都会自己派发 change）。
- **N3：** 导入 `{}` 这类合法 JSON 会通过 normalize、确认后清空全部数据；期望断言是出现格式错误提示。`[]` 和字段类型错误的对象是同类输入，没有单独验证。
- **导入白名单（SEC-01）：** 备份里有一项 id 或日期不合格，整份拒绝：显示同一条格式错误提示，不弹确认框、不保存、数据不变。容器里能识别出条目就检查，只剩两条豁免：顶层不是普通对象（`null`、`[]`），以及非字符串的 arrival。导入检查点名保持 v1 结果的输入：`{}`、`{ logs: [] }`、`null`、`[]` 和字段类型错误的 `synth-wrong-types.json`，与 N3 同类，行为改变推迟到 Phase 11 处理。加载已存数据时只修正、不拒绝：坏 id 换新 id 并迁移进度、坏日期回落、孤儿进度键丢弃，记录文字一条不删，加载本身不触发保存。
- **窄屏只用 viewport：** 文件顶层 `test.use({ viewport: { width: 520, height: 900 } })`，不用设备描述符；断言经 `page.evaluate` 读计算样式和位置，不截图、不测拖拽，也不读日历 chip 或条目的文字。滚动用例先瞬时滚到确定的位置，点击后用 `expect.poll` 等平滑滚动结束，不用固定睡眠。
