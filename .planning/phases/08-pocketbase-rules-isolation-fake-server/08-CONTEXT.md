# Phase 8: PocketBase 规则、隔离与假服务器（Rules, Isolation & Fake Server） - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 交付三样东西：

1. **数据规则（迁移文件）：** `users` 和 `journey_docs` 的集合、字段、索引和 API 规则，写成只含结构、可以重放的 PocketBase 迁移文件。
2. **本机隔离验证脚本：** 手动运行，不进默认 `npm test`。它在一次性的本机 PocketBase 0.41.1 上运行：只监听 127.0.0.1，只用合成账号，数据用完就删。脚本逐条证明两件事：网页上不能注册；两个账号读不到、也改不了对方的数据。
3. **测试设施：**
   - Node 侧的假 PocketBase；
   - 页面侧的假 `EventSource`；
   - `AppHarness` 的 cloud 模式；
   - 只能连假服务器的护栏；
   - 带协议样本的 `PB-CONTRACT.md`；
   - 单独的 `npm run test:cloud` 入口。

本阶段不改 `us-journey-tracker.html`（SAFE-02 基线不动），也完全不碰所有者的服务器。下面这些属于后面的阶段：

- 登录页、应用加载 SDK、去掉 Google 字体：Phase 9。
- 离线和实时同步：Phase 10。
- 服务器设置（限流、代理 IP 头、日志保留）、CSP、部署，以及在线上用同版本重跑隔离脚本：Phase 13。

需求：ACCT-03、ACCT-04、TEST-02（本阶段只打基础，Phase 9–12 补用例，Phase 13 收口）、TEST-04。

</domain>

<decisions>
## Implementation Decisions

### 前提确认：后端继续用 PocketBase

- **D-01：** 所有者在讨论中问过，为什么不用 PostgreSQL 这类数据库服务。看过对比后，所有者确认继续用 PocketBase。对比的要点：
  - PocketBase 内部用的是 SQLite 数据库，并且自带登录、权限和实时同步；
  - 它已经装在香港服务器上，现在只占约 30 MB 内存；
  - 换 PostgreSQL 要另写后端，要么改用 Supabase，可自托管版这台 894 MB 内存的服务器带不动；
  - 换的话，Phase 6 的大部分工作要重做，Phase 8–13 要重新规划。
  - **Reversibility:** costly — 换数据库要重做 Phase 6 的服务器安装，并重新规划 Phase 8–13；数据可以导出后迁走，不会被锁死。

### 本机测试替身（PocketBase Windows 版）

- **D-02：** 本机验证用 PocketBase 0.41.1 的 Windows 版 zip。具体做法：
  - 所有者**批准一次**下载，核对指纹后，存进**项目内被 git 忽略的目录**。具体目录由规划决定，必须同时被 `.gitignore` 和隐私检查规则 A 挡住；现有的 `pocketbase.exe`、`pocketbase_*.zip` 规则已经覆盖。
  - 指纹（sha256）写进仓库里的说明文件。**每次运行前先核对**，对不上就不运行、停下报告。
  - Phase 9–13 重跑隔离脚本或重录协议样本时，指纹对得上就沿用，不用重新批准。换版本要重新批准下载。
  - 数据目录（`pb_data`）每次放系统临时目录，跑完就删。
  - D-17 仍然适用：这次下载本身必须先经所有者批准，批准时贴出来源、文件名、大小和 sha256。
  - ROADMAP SC1、SC2 里“下载到临时目录”“用完删除临时实例”的写法，规划时按本条改清楚：临时的只有实例和数据，程序本身留存。
- **D-03：** Windows 包的指纹以维护者发布页的 `checksums.txt` 为准，下载后对不上就中止。所有者对这一点没有偏好，所以 Claude 酌定加一步：GitHub 发布页如果提供文件指纹，就顺带交叉核对。0.41.1 只有 linux_amd64 包的指纹之前在 `tools/probe/server/02-install-pocketbase.sh` 里钉死过，Windows 包是第一次核对。

### 登录与账号自助

- **D-04：** 登录标识用**邮箱形式**，也就是 PocketBase 默认的 identity 字段。地址不必真实存在，也不发任何邮件。合成测试账号的邮箱必须是保留域名或明显的合成写法，不能被隐私检查规则 C 当成真实邮箱。
  - **Reversibility:** costly — 以后要改成用户名，迁移、`auth-with-password` 协议样本、假服务器和隔离断言都要跟着改。
- **D-05：** 所有者选择允许普通账号**自己修改密码和登录邮箱**。这改变了此前的设想：调研和探针站点的先例都是 `users` 的写规则全设为 null。
  - `users.updateRule` 只允许本人改本人。注册（createRule）和自删除（deleteRule）仍然显式关闭；`list`、`view` 只能看自己。
  - 改密码要输入旧密码：PocketBase 对普通用户的默认行为是要求 `oldPassword`，调研要在 0.41.1 上实测确认。
  - 本人能改的只有密码和邮箱。`verified` 等其他系统字段不能自改。
  - **必须调研核实：** PocketBase 0.41.1 里普通用户改邮箱，是不是一定要走发邮件确认的流程（`request-email-change` 和 `confirm-email-change`）。如果是，地址不真实就走不通。到时候不能自作主张，要在规划前把情况报告给所有者，请所有者选：退回“只能改密码”，或者换一种可行的做法。
  - 隔离脚本补几条相关断言：A 改不了 B 的账号记录；旧密码不对或缺失时改密码被拒；本人不能改 `verified` 这类字段。如果改邮箱可行，再加一条“改邮箱后用新邮箱能登录、旧邮箱不能登录”。
  - 不冲突的部分：REQUIREMENTS 的 Out of Scope 写“密码由所有者在后台重置”，这一条仍然成立；所有者照样可以在后台重置，自改只是多出来的能力。
  - **Reversibility:** reversible — 只是规则里的一行，加一条迁移就能收回；目前也没有用到它的界面。
- **D-06：** 令牌有效期（authToken duration）设为 **90 天**，满足 ROADMAP SC2 的“90 天以上”。常用时客户端会自动续期。调研核实一点：所有者在后台改某人的密码后，那个人所有设备上的旧令牌是否立即失效（PocketBase 的 tokenKey 机制）。
- **D-07：** 本里程碑不做改密码、改邮箱的界面。D-05 只放开规则，界面记进 Deferred。

### Claude's Discretion

所有者没有选这两个灰色地带来讨论。下面按讨论前分析里的推荐做法定下，规划可以细化，但不能缩小：

- **隔离断言的覆盖面：**
  - SC1 列出的 5 类：匿名注册被拒；跨账号读、列、改、删被拒；改 `owner` 或 `kind` 被拒；超过 4 MiB 被拒；同一种 `kind` 只能有一份。
  - 另加 4 条：
    - 账号 A 订阅 `journey_docs` 的 `*`，收不到 B 的变更；
    - 列不出、看不到 B 的 `users` 记录（含邮箱）；
    - 未登录时读不到任何文档；
    - 以 B 为 owner 新建文档被拒。
  - 再加 D-05 的账号自改断言。
  - 原因：Pitfall 2 指出实时订阅和 `users` 集合是最容易漏的两条泄漏路径；PocketBase 的规则同时也是过滤器，写错了界面上只表现为“空”，看不出来。
  - 同一个脚本 Phase 13 会原样复用。
- **云端测试入口的范围：**
  - 假服务器提供与 v1 `MockBackend` 相同的门面：`reads`、`writes`、`downloads`、`lastState()`、`seed()`。
  - 用一个环境变量把 v1 的账户模式映射到 cloud。这样 `npm run test:cloud` 就等于云端专属用例，加上 v1 四个视图的用例在云端路径上的整套回归。
  - 默认 `npm test` 不变。`test:cloud` 只在阶段收尾和发布前手动跑，同样低优先级、1 个 worker。
  - Phase 8 时应用还没有云端路径，所以本阶段只定好门面和入口。cloud 模式先用真实 SDK 对假服务器做登录、读写和订阅；映射到 v1 视图要等 Phase 9 应用接上云端后才生效。
- **其他交给调研和规划决定的事：**
  - 迁移和隔离脚本的目录、命名和运行方式（Node 还是 Playwright），以及 npm 脚本名。
  - 本机实例的超级用户和合成账号：每次运行随机生成，不写进仓库，随实例一起删除。
  - 假服务器的接入方式：`fetch` 替换加 `exposeBinding`，还是对 `/api/` 用 `context.route`。前提是满足 SC4 的护栏。
  - 假令牌：运行时生成、不签名、带 `exp`，源码里不写死令牌字面量（规则 F）。
  - `PB_CONNECT` 和 clientId 的模拟；事件一律由测试显式推送，不靠计时器（Pitfall 21）。
  - 契约自测的比对方式：状态码、键集合、归一化后的正文。
  - SDK 文件从 `tools/probe/page/vendor/` 复用到哪个同源路径。
  - `setOffline` 探针的设计。
  - 调研在真实实例上核实的 MEDIUM 项：`:isset` 组合、订阅的 `fields` 是否裁剪载荷、`users` 的 list/view 只看自己时登录和刷新接口是否正常。
  - 本阶段的错误注入只做 SC3 列出的样本（唯一索引冲突、401）。网络失败、5xx、断开 SSE 由 Phase 9、10 按需补。
  - 应用级设置（限流、代理 IP 头、日志保留）不放进 Phase 8 的迁移，属于 Phase 13。令牌时长、OAuth 和 OTP 是集合本身的选项，放在迁移里。MFA 也明确关闭，规划时确认写法。

### 规划时要先修正的冲突和过时内容

1. **SDK 版本：** 按 06-CONTEXT D-15，SDK 是 0.28.1，不是 0.28.2。以下位置要改：
   - ROADMAP 的共同约束（“JS SDK 固定 0.28.2”）和 Phase 8 SC3；
   - `.planning/research/STACK.md` 的 Core Technologies、Installation、Version Compatibility；
   - `.planning/research/SUMMARY.md` 的分歧表和 Recommended Stack。
2. **SDK 文件名：** 实际批准的文件是 `pocketbase.iife.js`，`.planning/research/ARCHITECTURE.md` 写成了 `pocketbase.umd.js`。
3. **过时的数据模型：** `.planning/research/STACK.md` § 三仍是旧方案（`journals` 单条双字段、所有者在后台建空记录、`:changed`），已经被 SUMMARY 的分歧表取代，规划不能照它写。
4. **`users` 规则：** 按 D-05 执行，本人可以改密码和邮箱。ARCHITECTURE § Q1 里“令牌 30–90 天”的写法以 D-06 和 SC2 为准。
5. **协议样本与规则 F 冲突：** 本机实例签发的令牌是三段 JWT，原样写进 `PB-CONTRACT.md` 或样本文件会被规则 F 拦下，而所有者不接受放行名单（07-CONTEXT D-04）。样本必须先归一化：令牌换成占位或去掉签名段，id、时间、合成邮箱也一并归一。配一条自检。
6. **静态服务器白名单：** `tests/support/static-server.cjs` 只放行应用文件，`tests/e2e/platform/app-integrity.spec.ts` 的 ENV-03 用例也这么断言。同源提供 SDK（SC4）必须有意识地改这两处；SAFE-02 不受影响。
7. **护栏要收紧：** `tests/support/test.ts` 现在放行应用来源下的所有请求。cloud 模式要收紧到“只许假服务器”，可以顺带补上 v1 的 WR-05 缺口（PITFALLS 19）。
8. **调研开关：** `.planning/config.json` 里 `workflow.research` 是 false，但 ROADMAP 要求 Phase 8 先调研。规划前必须显式运行 `/gsd-plan-phase --research-phase 8`，或者用 `--research` 强制调研。
9. **错误路径的范围：** v1 定的“mock 只做正常路径”只适用于 Claude mock。Phase 8 SC3 要 401 和唯一冲突的样本，Phase 10 要服务器错误和登录过期。TEST-F1 只剩下各阶段 SC 都没要求的项，例如限流、断网中途重置。
10. **过时的地图：** `.planning/codebase/TESTING.md` 和 `INTEGRATIONS.md` 写于 v1 之前，测试现状以 `tests/README.md` 为准。

</decisions>

<canonical_refs>
## Canonical References

**下游代理在规划或实现之前必须读这些文件。**

### 阶段范围与项目文档
- `.planning/ROADMAP.md` — § Phase 8（Goal、SC1–5、Notes、Research）；“所有阶段共同遵守的约束”；Phase 9 Notes（客户端首次创建、`autoCancellation`）；Phase 10、Phase 13 的 SC3、SC5（边界）
- `.planning/REQUIREMENTS.md` — ACCT-03、ACCT-04、TEST-02、TEST-04；Out of Scope（密码由所有者在后台重置）；TEST-F1
- `.planning/PROJECT.md` — Constraints；Key Decisions（调研的其余推荐全部采纳、mock 状态放 Node 侧、低优先级 1 worker）
- `.planning/STATE.md` — Pending Todos（Phase 8 下载批准、D-15 的 SDK 改动）；[Phase 07] 的 plan 形状和 `USJ_CONFIG` 决定

### 前几个阶段的决定
- `.planning/phases/06-procurement-reachability-probe/06-CONTEXT.md` — D-03、D-12、D-15、D-16、D-17
- `.planning/phases/06-procurement-reachability-probe/06-PROBE-RESULTS.md` — 给 Phase 10 的输入（不回放断线期间的事件、重连后整份补拉）
- `.planning/phases/06-procurement-reachability-probe/06-SECURITY.md` — 探针站点的规则先例和残余风险
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-CONTEXT.md` — plan 形状；D-04（隐私检查保持最严格、不加放行名单）

### 调研
- `.planning/research/ARCHITECTURE.md` — § Q1 数据模型与规则、§ Q2 订阅与回声抑制、§ Q5 认证、§ Q7 测试架构（含“假服务器测不到的东西：规则隔离”）、“待验证项”
- `.planning/research/STACK.md` — § 一 第 2 条（`users` 默认规则）、§ 三（令牌默认 5 天；数据模型部分已过时，见上面“规划时要先修正”第 3 条）、§ 九（测试工具）
- `.planning/research/SUMMARY.md` — “研究文件之间的分歧”表、Research Flags、“所有者需要决定的事项”第 7、8 条
- `.planning/research/PITFALLS.md` — Pitfall 2、12、19、20、21

### 现有代码与测试
- `tests/mocks/CONTRACT.md`、`tests/mocks/claude-runtime.ts`、`tests/mocks/claude-backend.ts` — 契约和 mock 的写法
- `tests/support/app.ts`、`tests/support/test.ts`、`tests/support/constants.ts` — harness 和护栏
- `tests/support/static-server.cjs`、`tests/e2e/platform/app-integrity.spec.ts` — 静态服务器白名单、ENV-03、SAFE-02
- `tests/e2e/platform/mock-contract.spec.ts`、`tests/e2e/platform/probes.spec.ts`、`tests/PROBES.md` — 契约自测和探针
- `tests/README.md`、`tests/KNOWN-BUGS.md`、`tools/test-report/check-report.mjs`
- `tools/probe/server/pb_migrations/probe_schema.js`、`tools/probe/server/pb_migrations/probe_user.js.tpl` — 已有的 JS 迁移写法
- `tools/probe/server/02-install-pocketbase.sh` — 钉死 SHA-256 的写法
- `tools/probe/page/vendor/README.md`、`tools/probe/page/vendor/SHA256SUMS`、`tools/probe/page/vendor/pocketbase.iife.js` — 已批准的 SDK 0.28.1
- `tools/probe/page/probe.js` — SDK 的用法示例；它的 CR-01、CR-02 缺陷见 06-REVIEW.md，不要照抄 `num()` 的写法
- `tools/privacy/privacy-check.mjs`、`PRIVACY.md`（规则 A、C、F）、`.gitignore`、`playwright.config.ts`、`package.json`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/mocks/claude-backend.ts` 里的 `MockBackend`：Node 侧状态，带 `reads`、`writes`、`downloads`、`lastState()`、`seed()` 门面。假 PocketBase 照这个门面做，v1 的用例才能映射到 cloud 模式。
- `tests/support/app.ts` 里的 `AppHarness`：现在有 `mode: 'local' | 'account'`，本阶段加上 `cloud`。
- `tools/probe/server/pb_migrations/probe_schema.js`：已经在真实 0.41.1 上跑通的 JS 迁移写法，包括规则、字段上限和 `users` 规则加固。
- `tools/probe/page/vendor/pocketbase.iife.js`：所有者已批准、sha256 已钉死的 SDK 0.28.1，测试里复用不算新的下载。
- `tools/probe/schema-check.mjs`：用 `node:vm` 在沙箱里执行迁移并比对字段，可以作为迁移静态检查的参考。

### Established Patterns
- 状态放 Node 侧，经 binding 暴露给页面。
- 契约文档加契约自测（`tests/mocks/CONTRACT.md` 和 `mock-contract.spec.ts`）。
- 已知 bug 按 `tests/KNOWN-BUGS.md` 的约定标记。
- 下载和服务器步骤一律先由所有者批准，再按 sha256 核对。
- 测试低优先级、1 个 worker，靠命令行参数控制，不改 `playwright.config.ts` 的默认值。
- 隐私检查每条规则都配一条故意违规的自检；样本在运行时拼接，源码里不出现会命中的字面量。

### Integration Points
- `tests/support/test.ts` 的请求护栏：cloud 模式要收紧到只许假服务器。
- `tests/support/static-server.cjs` 的白名单：要放行同源的 SDK 文件。
- `package.json`：新增 `test:cloud` 和隔离脚本的入口，不新增依赖。
- `.gitignore` 和隐私检查规则 A：本机 PocketBase 程序的留存目录必须被挡住。

</code_context>

<specifics>
## Specific Ideas

- 所有者关心后端是不是“正规数据库”。以后的文档和报告里，提到 PocketBase 时顺带说明它内部是 SQLite，并且自带登录、权限和实时同步，避免再引起误解。
- 所有者希望账号能自己改密码和邮箱（D-05），哪怕这一版还没有界面。

</specifics>

<deferred>
## Deferred Ideas

- **改密码、改邮箱的界面：** D-05 只放开规则。界面属于新功能，放到以后的里程碑或待办里。
- **本阶段不处理、记录待修的项：**
  - STATE 的 Blockers 和 Operator Next Steps 里仍写着 `06-SECURITY.md` 不存在、`/gsd-secure-phase 6` 待做，其实已经在 022f523 完成。本次讨论收尾时顺带改掉。
  - PROJECT Active 里还有“香港或东京”的写法，与已定的阿里云香港（06 D-01）不一致。

</deferred>

---

*Phase: 08-pocketbase-rules-isolation-fake-server*
*Context gathered: 2026-11-08*
