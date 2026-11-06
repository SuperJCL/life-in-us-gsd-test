# Walking Skeleton — 在美国的日子：本地测试实验

**Phase:** 1
**Generated:** 2026-11-01

## Capability Proven End-to-End

开发者在仓库根目录运行 `npm test`，整条链路自动走完：

1. Playwright Test 用系统 Edge 无界面启动；
2. 本地静态服务器在 `127.0.0.1:4789` 提供未修改的 `us-journey-tracker.html`；
3. 应用以本地模式运行（没有 `window.claude`）；
4. 用例在本周视图记一笔；
5. 数据经 600 ms 防抖保存进 localStorage；
6. reload 之后记录仍在；
7. 最后生成一份不自动弹出的 HTML 报告。

整个过程中，外部网络请求都被拦截，“今天”固定为 2026-03-18。

这条链路由 Plan 01 的 tracer 任务（`tests/e2e/smoke.spec.ts` 的 IO-01 用例）证明。

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 测试框架 | `@playwright/test` 精确锁定 1.64.1，装在项目内，提交 package-lock.json（D-13） | 用户要求用 Playwright Test；精确版本让结果可重复；三个包都没有安装脚本，安装时还加了 `--ignore-scripts` |
| 浏览器 | 系统 Edge，`channel: process.env.PW_CHANNEL ?? 'msedge'`；本机 Chrome（`PW_CHANNEL=chrome`）只作为备用 | 不下载任何浏览器；Edge 无法驱动时必须停下来询问用户，绝不运行安装命令 |
| 页面来源（相当于“路由”） | 零依赖 `node:http` 服务器 `tests/support/static-server.cjs`：只监听 127.0.0.1:4789，只提供 `/` 和 `/us-journey-tracker.html`，其余返回 404；`reuseExistingServer: false`（D-14） | origin 稳定，localStorage、baseURL、route 都可靠；不暴露仓库里的其他文件；不连到来路不明的服务 |
| 被测的数据层 | 本地模式：localStorage 键 `us-journey-tracker-v1`。Phase 2 增加账户模式：页面内 `installClaudeMock` 通过 `exposeBinding` 连到 Node 侧的 `MockBackend` | 应用本身就有“能力缺失就降级”的设计，本地模式不依赖 mock，所以能最先打通 |
| 身份与鉴权 | 不适用。本地模式没有身份；账户模式里 `user.id()` 由 Phase 2 的 mock 提供合成 id | 应用没有登录功能，只有 Claude Artifact 的 viewer id |
| 部署目标 | 不适用：禁止发布、部署和 CI。和“部署”等价的是在本地运行 `npm test`，并生成 `playwright-report/` 里的 HTML 报告（`open: 'never'`） | 本里程碑只在本地运行；推送 GitHub 只在用户明确要求时由单独任务完成 |
| 语言与构建 | TypeScript `.ts`，由 Playwright 直接转译，没有 tsconfig，没有构建步骤；package.json 不写 `type`，保持 CommonJS（D-07） | 零额外依赖；`addInitScript` 注入的函数必须自包含 |
| fixture 架构 | 唯一出口 `tests/support/test.ts`：auto fixture `guard`（网络护栏和页面错误收集，teardown 时调用 `guardViolations`）、auto fixture `frozenClock`、option fixture `clockMode`、fixture `app`（AppHarness）；所有 spec 只从这里导入 `test` 和 `expect`（D-17） | 护栏不可能被绕过；以后各阶段只需在这个出口上扩展 |
| 时间 | `page.clock.setFixedTime(Date.UTC(2026, 2, 18, 12))`，配合 `timezoneId: 'America/New_York'` 和 `locale: 'zh-CN'`；只有个别用例通过 `clockMode: 'manual'` 改用 `clock.install`（D-15） | 主机是太平洋时区，必须固定；UTC 正午在各时区都落在同一个日历日 |
| 网络 | 一个兜底的 `context.route('**/*')`：放行应用 origin；字体主机 abort 并记为“已预期拦截”；其他请求 abort 并记录，让用例失败。另有 `--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1`、从第一次运行起无条件启用的浏览器级死代理（`launchOptions.proxy`，server `http://127.0.0.1:9`，只有 127.0.0.1 和 localhost 绕过）和 `serviceWorkers: 'block'`（D-16）；解析层和死代理由 PROBE-2 断言，并直接观察 preconnect 的去向，两层都无法证明时停下询问用户 | 不访问 claude.ai，也不访问任何外网；route 看不到的 preconnect 也不会离开本机；结果可重复 |
| 持久化断言 | 先用 `expect.poll` 等到 localStorage 里有数据，再 reload，最后断言 DOM；种子通过 `addInitScript(seedLocalStorageIfAbsent, arg)` 只在没有数据时写入（D-18） | 测到的是防抖保存路径，而不是 pagehide 的补救写入；reload 不会被种子覆盖 |
| 目录布局 | `tests/support/`（harness：test、app、constants、strings、static-server），`tests/e2e/`（smoke），`tests/e2e/platform/`（护栏自检和探针），`tests/fixtures/`（带 `_synthetic` 标记的合成数据），`tests/mocks/`（Phase 2 新增），文档 `tests/README.md`、`tests/PROBES.md` | 按 research/ARCHITECTURE.md：“测试怎么跑”和“被测环境长什么样”分开放 |
| 命名与语言 | 用例标题用英文，以需求编号或 `PROBE-n` 开头；注释和文档用中文；界面中文文案只放在 `tests/support/strings.ts`（D-05、D-06、D-08） | 公开仓库要清楚易读；改文案时只改一处 |
| 隐私 | 所有新文件都会公开；每次提交都经过 `.githooks/pre-commit` 隐私检查；失败证据只留在被忽略的 `test-results/` 里；不用截图基线（D-02、D-09） | 应用源码和截图里有个人计划文字 |

## Stack Touched in Phase 1

- [x] 项目脚手架：手写 package.json（只有 `test`、`test:ui` 两个脚本）、playwright.config.ts、测试运行器（Plan 01）
- [x] “路由”：一个真实的页面来源 `http://127.0.0.1:4789/`，由静态服务器提供（Plan 01）
- [x] 数据：一次真实写入（记一笔经防抖存进 localStorage）和一次真实读取（reload 后应用从 localStorage 加载并渲染），见 Plan 01
- [x] UI：本周视图 composer 的“记录”按钮驱动这次保存（Plan 01）
- [x] “部署”：有文档说明的本地全链路运行命令 `npm test`，外加 HTML 报告（Plan 01 跑通，Plan 04 写进 README）

## Out of Scope (Deferred to Later Slices)

- `window.claude` mock、账户模式、downloads 记录、`tests/mocks/CONTRACT.md`（Phase 2）
- 完整的合成状态 fixture 和边界 fixture；本阶段只有一个最小的 `tests/fixtures/local-seed.json`（Phase 2）
- CSV 和 JSON 导出断言（Phase 2）、导入（Phase 5）
- 记一笔、编辑弹窗、toast 的共享 helper（`ui.ts`、`expectSaved`），以及已知 bug 标记约定和 `tests/KNOWN-BUGS.md`（Phase 3）
- 各视图的完整用例：本周（Phase 3），日历和目标（Phase 4），时间线和窄屏（Phase 5）；拖放的正式用例（Phase 3，本阶段只做 PROBE-5 spike）
- mock 错误路径、加载延迟（v2：ERR-01 到 ERR-04）
- `file://` 冒烟、键盘路径、暗色模式、安全探针（v2：XTRA 系列）
- CI、发布、部署、推送 GitHub（不在本里程碑范围）
- 修改 `us-journey-tracker.html`（本里程碑禁止；个人内容外置属于计划中的第 6 阶段）

## Subsequent Slice Plan

后面每个阶段都在这副骨架上加一个垂直切片，不改上表的架构决定：

- Phase 2：在可证明的账户模式下打开应用（`installClaudeMock`、`MockBackend`、状态栏就绪条件），装入合成 fixture，读到 db 读写和导出文件的内容
- Phase 3：用共享的记一笔、编辑弹窗、toast helper 和已知 bug 标记约定，完整覆盖本周视图
- Phase 4：复用这些 helper，覆盖日历和目标视图
- Phase 5：覆盖时间线、JSON 备份导入（含旧类别迁移）和手机宽度下的关键布局，`npm test` 一次覆盖全部四个视图
