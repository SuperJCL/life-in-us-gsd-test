# 测试使用说明

## 1. 这是什么

这里是对单文件网页应用 `us-journey-tracker.html` 的本地黑盒浏览器测试。测试用 Playwright Test 驱动本机 Edge，只使用合成数据，不修改应用源码，不连接任何线上服务。

## 2. 准备

- 需要 Node.js 20 或更高版本，以及系统自带的 Microsoft Edge。
- 应用文件 `us-journey-tracker.html` 不在仓库里（里面写死了个人内容，见 `PRIVACY.md`）。需要把自己本地的副本放到仓库根目录。缺少时，`npm test` 会在启动阶段用中文提示你放好文件，而不是报出看不懂的错误。
- 克隆后先运行一次 `git config core.hooksPath .githooks`，启用隐私钩子，详见 `PRIVACY.md`。这条命令只影响本仓库。
- 安装依赖用 `npm ci --ignore-scripts`。它只按 lockfile 安装项目内依赖，不运行安装脚本，不会下载浏览器。

## 3. 运行

- `npm test`：无界面跑完全部用例。
- `npm run test:ui`：Playwright UI 模式，可以逐步回放每个用例的动作和页面快照。它会打开一个使用本机 Edge 或 Chrome 的窗口。如果提示需要安装浏览器，不要安装，按第 8 节“浏览器出问题时”处理。

只跑部分用例时，把参数接在 `--` 后面，例如 `npm test -- -g "IO-01"`。

## 4. 看报告

- HTML 报告生成在 `playwright-report/`，不会自动弹出。用 `npx playwright show-report` 打开：它只在本机起一个查看服务，使用项目内已装好的 Playwright，不安装任何东西。看完在终端按 Ctrl+C 结束查看服务。
- 如果运行 `npx playwright show-report` 后没有自动打开浏览器（例如在内嵌终端里），终端会打印一个 `http://localhost:9323` 形式的地址，手动在浏览器里打开它即可。查看服务会一直运行，直到你按 Ctrl+C。
- 失败时的截图和 trace 只保存在 `test-results/`，已被 git 忽略。里面可能拍到个人计划文字，不要上传，也不要提交。

## 5. 目录结构

| 路径 | 放什么 |
|------|--------|
| `tests/support/` | 常量、界面文案、`test.ts`（唯一的测试入口和 fixture）、`app.ts`（AppHarness）、零依赖静态服务器 |
| `tests/e2e/` | 面向功能的用例，例如 `smoke.spec.ts` |
| `tests/e2e/platform/` | 测试平台自身的用例：护栏自检、固定时钟、应用完整性、仓库卫生、运行时探针 |
| `tests/e2e/storage/` | 存储模式用例，例如账户模式 `account-mode.spec.ts` |
| `tests/mocks/` | 账户模式用的 `window.claude` mock：页面侧 `claude-runtime.ts`、Node 侧 `claude-backend.ts`（`MockBackend`），以及契约对齐说明 `CONTRACT.md` |
| `tests/fixtures/` | 合成数据，每个 fixture 都带 `_synthetic` 标记 |
| `tests/PROBES.md` | 运行时探针的结论 |

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
- **应用完整性**（`tests/e2e/platform/app-integrity.spec.ts`）：测试记录了应用文件的 sha256 基线，应用文件被改动时用例变红；应用文件始终只读。
- **合成标记**（`tests/e2e/platform/repo-hygiene.spec.ts`）：fixture 必须带 `_synthetic`，报告和截图目录必须被 git 忽略。

## 8. 浏览器出问题时

- 绝对不要运行 `npx playwright install`，任何形式都不要，也不要运行 `npm init playwright`。测试使用系统自带的 Edge，不需要下载浏览器；安装命令会往你的机器上装东西，也可能装错包。
- Edge 启动失败时，可以临时改用本机 Chrome：PowerShell 里运行 `$env:PW_CHANNEL='chrome'; npm test`，Git Bash 里运行 `PW_CHANNEL=chrome npm test`。
- 两个都不行时，停下来排查，不要安装浏览器。

## 9. 隐私

本仓库会公开，所以：

- 只用合成数据，fixture 必须带 `_synthetic` 标记。
- 不复制应用里的个人计划文字到测试、fixture 或文档里。
- 不提交报告、截图和 trace。
- 不使用 `--no-verify` 跳过隐私钩子。
- 详见 `PRIVACY.md`。

## 10. 探针结论

六项运行时探针的结论、证据和采用的方案见 `tests/PROBES.md`。它们每次 `npm test` 都会重新运行，假设不成立时用例会变红。

## 11. 账户模式

应用在 Claude Artifact 里通过 `window.claude` 的 `db` 存数据；在本地直接打开时没有它，会退回 localStorage。账户模式就是在页面里装上 mock，让应用走 `db` 这条路，并且把读写和导出都记在 Node 侧，用例可以直接读到。

- **怎么打开：** `await app.open({ mode: 'account', seed, userId, expectStore })`。`mode` 默认是 `'local'`，所以本地模式的用例不用改。`seed` 写进 Node 侧的 `MockBackend`，不写 localStorage；`userId` 缺省是合成用户 `synth-user-0001`，显式传 `null` 表示没有身份；`expectStore` 只给下面的反向对照用例用。
- **就绪条件（D-08）：** 状态栏显示账户同步文案，并且 `#exportCsv` 和 `#exportJson` 两个导出按钮都可见。`app.open()` 和 `app.reload()` 内部已经等了这两条，用例不用自己再等。只看状态栏会抢跑：应用在显示状态之后还要再等 `downloads` 能力，导出按钮才出现。
- **怎么读记录（D-09）：** 用 `app.backend.reads`（每次读取的路径）、`app.backend.writes`（每次写入的路径和内容）、`app.backend.downloads`（每次导出的文件名和文本）、`app.backend.lastState()`（账户文档的当前内容，还没有文档时是 `null`）。不要用 `page.evaluate` 去读 mock 的数据。保存有 600 ms 防抖，等写入落盘用 `app.expectPersisted(...)`，它内部是 `expect.poll`，不用固定睡眠。
- **`app.expectAccountMode()` 和反向对照（D-07）：** 它检查三件事：状态栏是账户同步文案；mock 恰好记录到预期次数的读取，且路径是账户文档路径；页面 localStorage 里没有应用的键。`reload` 之后读取次数会变多，用 `app.expectAccountMode({ reads: 2 })`。为了证明这个检查不是永远通过，`tests/e2e/storage/account-mode.spec.ts` 里有一条常驻的反向对照用例：用 `userId: null` 打开应用，应用会静默退回 localStorage，这时 `expectAccountMode()` 必须失败。它每次 `npm test` 都会运行。
- **mock 只做正常路径：** 没有拒绝、错误码、限流和延迟（它们是 v2 的 ERR-01 到 ERR-04）。对齐的契约版本、已实现和未实现的条目、mock 的结构和重新核对的步骤都写在 `tests/mocks/CONTRACT.md` 里，契约自测在 `tests/e2e/platform/mock-contract.spec.ts`。
- **网络：** binding 是页面和本机 Node 进程之间的往返，不走网络，所以 guard 和第 7 节的网络兜底都不变。
