# Phase 8: PocketBase 规则、隔离与假服务器 - Research

**Researched:** 2026-11-08
**Domain:** PocketBase 0.41.1 集合与 API 规则（JS 迁移）、本机一次性实例上的账号隔离验证、协议样本录制与归一化、Node 侧假 PocketBase、Playwright cloud 测试模式
**Confidence:** MEDIUM-HIGH（规则语义、`oldPassword`、邮箱自改、tokenKey、实时过滤与 `fields` 都已读源码和官方文档核实；源码读的是 v0.40.6，因为 0.41.x 的源码不在 GitHub，0.41.0 和 0.41.1 的发布说明没有改动这些区域；少数项只能在真实实例上定稿，已逐条列出断言）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**前提确认：后端继续用 PocketBase**

- **D-01：** 所有者在讨论中问过，为什么不用 PostgreSQL 这类数据库服务。看过对比后，所有者确认继续用 PocketBase。对比的要点：
  - PocketBase 内部用的是 SQLite 数据库，并且自带登录、权限和实时同步；
  - 它已经装在香港服务器上，现在只占约 30 MB 内存；
  - 换 PostgreSQL 要另写后端，要么改用 Supabase，可自托管版这台 894 MB 内存的服务器带不动；
  - 换的话，Phase 6 的大部分工作要重做，Phase 8–13 要重新规划。
  - **Reversibility:** costly — 换数据库要重做 Phase 6 的服务器安装，并重新规划 Phase 8–13；数据可以导出后迁走，不会被锁死。

**本机测试替身（PocketBase Windows 版）**

- **D-02：** 本机验证用 PocketBase 0.41.1 的 Windows 版 zip。具体做法：
  - 所有者**批准一次**下载，核对指纹后，存进**项目内被 git 忽略的目录**。具体目录由规划决定，必须同时被 `.gitignore` 和隐私检查规则 A 挡住；现有的 `pocketbase.exe`、`pocketbase_*.zip` 规则已经覆盖。
  - 指纹（sha256）写进仓库里的说明文件。**每次运行前先核对**，对不上就不运行、停下报告。
  - Phase 9–13 重跑隔离脚本或重录协议样本时，指纹对得上就沿用，不用重新批准。换版本要重新批准下载。
  - 数据目录（`pb_data`）每次放系统临时目录，跑完就删。
  - D-17 仍然适用：这次下载本身必须先经所有者批准，批准时贴出来源、文件名、大小和 sha256。
  - ROADMAP SC1、SC2 里“下载到临时目录”“用完删除临时实例”的写法，规划时按本条改清楚：临时的只有实例和数据，程序本身留存。
- **D-03：** Windows 包的指纹以维护者发布页的 `checksums.txt` 为准，下载后对不上就中止。所有者对这一点没有偏好，所以 Claude 酌定加一步：GitHub 发布页如果提供文件指纹，就顺带交叉核对。0.41.1 只有 linux_amd64 包的指纹之前在 `tools/probe/server/02-install-pocketbase.sh` 里钉死过，Windows 包是第一次核对。

**登录与账号自助**

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

### 规划时要先修正的冲突和过时内容（CONTEXT 原文，属于已锁定的前置任务）

1. **SDK 版本：** 按 06-CONTEXT D-15，SDK 是 0.28.1，不是 0.28.2。以下位置要改：ROADMAP 的共同约束（“JS SDK 固定 0.28.2”）和 Phase 8 SC3；`.planning/research/STACK.md` 的 Core Technologies、Installation、Version Compatibility；`.planning/research/SUMMARY.md` 的分歧表和 Recommended Stack。
2. **SDK 文件名：** 实际批准的文件是 `pocketbase.iife.js`，`.planning/research/ARCHITECTURE.md` 写成了 `pocketbase.umd.js`。
3. **过时的数据模型：** `.planning/research/STACK.md` § 三仍是旧方案（`journals` 单条双字段、所有者在后台建空记录、`:changed`），已经被 SUMMARY 的分歧表取代，规划不能照它写。
4. **`users` 规则：** 按 D-05 执行，本人可以改密码和邮箱。ARCHITECTURE § Q1 里“令牌 30–90 天”的写法以 D-06 和 SC2 为准。
5. **协议样本与规则 F 冲突：** 本机实例签发的令牌是三段 JWT，原样写进 `PB-CONTRACT.md` 或样本文件会被规则 F 拦下，而所有者不接受放行名单（07-CONTEXT D-04）。样本必须先归一化：令牌换成占位或去掉签名段，id、时间、合成邮箱也一并归一。配一条自检。
6. **静态服务器白名单：** `tests/support/static-server.cjs` 只放行应用文件，`tests/e2e/platform/app-integrity.spec.ts` 的 ENV-03 用例也这么断言。同源提供 SDK（SC4）必须有意识地改这两处；SAFE-02 不受影响。
7. **护栏要收紧：** `tests/support/test.ts` 现在放行应用来源下的所有请求。cloud 模式要收紧到“只许假服务器”，可以顺带补上 v1 的 WR-05 缺口（PITFALLS 19）。
8. **调研开关：** `.planning/config.json` 里 `workflow.research` 是 false，但 ROADMAP 要求 Phase 8 先调研。规划前必须显式运行 `/gsd-plan-phase --research-phase 8`，或者用 `--research` 强制调研。
9. **错误路径的范围：** v1 定的“mock 只做正常路径”只适用于 Claude mock。Phase 8 SC3 要 401 和唯一冲突的样本，Phase 10 要服务器错误和登录过期。TEST-F1 只剩下各阶段 SC 都没要求的项，例如限流、断网中途重置。
10. **过时的地图：** `.planning/codebase/TESTING.md` 和 `INTEGRATIONS.md` 写于 v1 之前，测试现状以 `tests/README.md` 为准。

### Deferred Ideas (OUT OF SCOPE)

- **改密码、改邮箱的界面：** D-05 只放开规则，界面属于新功能，放到以后的里程碑或待办里。
- **本阶段不处理、记录待修的项：**
  - STATE 的 Blockers 和 Operator Next Steps 里仍写着 `06-SECURITY.md` 不存在、`/gsd-secure-phase 6` 待做，其实已经在 022f523 完成。本次讨论收尾时顺带改掉。
  - PROJECT Active 里还有“香港或东京”的写法，与已定的阿里云香港（06 D-01）不一致。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACCT-03 | 账号只能由所有者在后台创建，网页上无法注册新账号 | 新建 `users` 默认 `createRule` 是空字符串（任何人都能注册），必须在迁移里显式改成 `null`；`null` 对非超级用户返回 403。隔离脚本断言“匿名注册 403、已登录账号注册 403”，再用反向对照（临时集合 `createRule` 为空时注册成功）证明断言不是空转（见 Architecture Pattern 3、Code Examples） |
| ACCT-04 | 每个账号只能读写自己的数据，用别的账号读不到、也改不了；要在真实 PocketBase 上用合成账号验证 | `journey_docs` 五条规则、`owner`/`kind` 防改写、唯一索引、4 MiB 上限、实时订阅过滤（`<collection>/*` 走 listRule，源码已核实）；逐条断言矩阵见 Architecture Pattern 3，每条同时断言状态码和“超级用户回读数据没变”两样 |
| TEST-02 | 新增基于模拟 PocketBase 的测试；测试运行时不连接任何真实服务器（本阶段只打基础） | `FakePbServer`（Node 侧纯函数 `handle()` 加薄的 `context.route` 适配）、页面侧假 `EventSource`、`AppHarness` 的 `cloud` 模式、只许假服务器的护栏加故意违规自检、`PB-CONTRACT.md` 加契约自测、`test:cloud` 单独入口（见 Pattern 5–8） |
| TEST-04 | 在一次性的本机 PocketBase 上用合成账号验证账号隔离；下载二进制需要用户批准；不进默认 `npm test` | Windows 包 `pocketbase_0.41.1_windows_amd64.zip`，13,012,018 字节，sha256 已从发布站 `checksums.txt` 读到；批准点内容见“需要所有者决定的事项”；一次性实例库见 Pattern 2；脚本入口 `npm run pb:isolation`（手动） |

**ROADMAP SC → 研究结论映射：** SC1 对应 Pattern 2、3；SC2 对应 Pattern 1（迁移）和重放快照；SC3 对应 Pattern 4（录制与归一化）和契约自测；SC4 对应 Pattern 6、7；SC5 对应 Pattern 8（独立 config，默认 `npm test` 不动）。
</phase_requirements>

## Summary

本阶段有三条互相独立的工作线，可以并行规划：（1）写两到三个只含结构的 JS 迁移，并用一次性本机实例上的 Node 脚本证明隔离；（2）录制真实协议样本、做归一化和 `PB-CONTRACT.md`；（3）Node 侧假服务器、页面侧假 `EventSource`、`AppHarness` 的 cloud 模式、收紧后的护栏和独立的 `test:cloud` 入口。第一条线需要二进制，要等所有者批准下载；其余两条线的大部分可以先做，样本在真实实例确认后才定稿。

本次调研核实了几个会改变计划的事实。第一，**D-05 的“自改邮箱”在普通更新接口上做不到**：PocketBase 的记录更新校验里，没有“管理权限”的请求改 `email`，会被 `validation_values_mismatch` 拒绝（`verified` 同理）；官方路径是 `request-email-change` 加 `confirm-email-change`，必须收邮件，而 D-04 说地址是假的，所以走不通。唯一不收邮件的办法是给 `users` 设一条收窄的 `manageRule`，让“只改邮箱、不碰密码和 verified 的请求”获得管理权限。这是安全取舍，**必须由所有者选**（见下面的所有者决定 1）。改密码则按 D-05 的设想工作：没有管理权限的普通用户改密码必须带正确的 `oldPassword`。第二，**令牌失效语义和 ARCHITECTURE 写的不一样**：只有 `auth-refresh` 这类要求登录的接口才返回 401；记录的读写遇到过期或无效令牌，PocketBase 把请求当作未登录处理，读返回 200 空列表、改返回 404、建返回 400。这直接影响假服务器的行为和 Phase 10 的“登录过期”设计。第三，**实时订阅的规则和 `fields` 都已在源码里核实**：订阅 `<集合>/*` 用 listRule，`<集合>/<id>` 用 viewRule，逐个事件按订阅者当时的身份判定；订阅选项里的 `fields` 会裁剪事件载荷。第四，**D-03 的“GitHub 发布页交叉核对”对 0.41.1 做不到**：GitHub 上没有 v0.41.1 的发布（接口返回 404），0.41.x 只在维护者自己的站点，所以 Windows 包的指纹只有 `checksums.txt` 这一个来源，信任模型和 Phase 6 的 D-16 一样，要在批准下载时如实告诉所有者。

**Primary recommendation:** 迁移放在 `pb/pb_migrations/`（不能用根目录的 `pocketbase/`，`.gitignore` 的 `/pocketbase` 会把它整个忽略）；隔离脚本用零依赖 Node 脚本（不用 Playwright），对一次性实例用裸 `fetch` 断言，每条断言同时检查状态码和超级用户回读；假服务器把 REST 做成纯函数 `handle()`，用 `context.route` 只接 `/api/`，让真实 SDK 的 `fetch` 原样运行，只有 SSE 用页面侧假 `EventSource` 加 `exposeBinding` 承接；cloud 用例放在独立的 `tests/cloud/` 目录，用 `playwright.cloud.config.ts` 展开基础配置，这样默认 `npm test` 的 173 条一条不变。

## 需要所有者决定的事项（规划前先报告，不能自作主张）

### OWNER-DECISION-1（D-05）：普通账号自己改登录邮箱，PocketBase 到底能不能做

**事实（源码已读，见 Sources）：**

- 普通更新接口 `PATCH /api/collections/users/records/<id>`：`updateRule` 通过后，如果请求没有“管理权限”，`email` 被改成不同的值就会被拒绝，错误码 `validation_values_mismatch`；`verified` 同样。[CITED: forms/record_upsert.go（v0.40.6）validateFormFields，`validation.When(!isNew && !form.HasManageAccess(), validation.By(validators.Equal(original.Email())))`]
- 官方的自助改邮箱流程是 `POST .../request-email-change`（要登录，body 是 `newEmail`）→ 邮件里带令牌 → `POST .../confirm-email-change`（body 是 `token` 和 `password`）。必须真能收邮件。[CITED: pocketbase.io/docs/api-records/]
- 所以：**只靠 `updateRule` 放开不行；走官方流程需要真实邮箱和可用的邮件发送，与 D-04 冲突。**
- 不收邮件的唯一办法：设置 `users.manageRule`。有管理权限的请求可以直接改 `email` 和 `verified`，也可以不带 `oldPassword` 改密码。[CITED: record_upsert.go validateFormFields，`oldPassword` 只在 `!form.HasManageAccess()` 时必填]

**三个选项（请所有者选一个）：**

| 选项 | 做法 | 能做到 | 代价 |
|------|------|--------|------|
| A（保守，我的默认建议之一） | `updateRule = id = @request.auth.id && …`，`manageRule = null` | 本人改密码（必须带正确旧密码）；改邮箱仍由所有者在后台做 | 不满足“自己改邮箱”；不需要额外设计 |
| B | 在 A 的基础上，再加一条收窄的 `manageRule`：只有请求体里没有 `password`、`passwordConfirm`、`oldPassword`、`verified` 时才给管理权限 | 本人改邮箱不收邮件；改密码仍然要旧密码 | **只凭令牌就能改邮箱**：令牌被偷（例如 XSS）的人可以把账号邮箱改掉，把本人挤出去（挤出后所有者在后台还能重置）。改邮箱会让 tokenKey 轮换，所有设备的旧令牌立刻失效，本设备也要重新登录 |
| C | 官方邮件流程 | 最规范 | 需要真实邮箱和发邮件配置，D-04 说地址不真实，所以不可行 |

规则写法（B 的收窄规则，**需要在真实实例上证实**，见断言 D5-x）：

```
users.manageRule = 'id = @request.auth.id && @request.body.password:isset = false && @request.body.passwordConfirm:isset = false && @request.body.oldPassword:isset = false && @request.body.verified:isset = false'
```

**建议：** 规划时把“自改邮箱”做成独立的一个迁移文件（例如 `…_users_self_email.js`），所有者没拍板之前不放进默认迁移集；选 A 时这个文件不存在，选 B 时加上；D-05 本来就标了 reversible，以后加一条迁移就能收回。无论选哪个，改密码的断言都要写。我倾向建议所有者选 A，把邮箱修改留在后台（3 个人自用，改邮箱的需求很少，B 引入的“令牌即可挤出本人”是新的攻击面）；但这是所有者的决定，不是我的。

### OWNER-DECISION-2（D-02、D-17）：批准下载 PocketBase Windows 版

批准请求里要贴出的内容（我已经只读核对过，没有下载）：

| 项 | 值 | 来源 |
|----|----|------|
| 来源 | `https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1/pocketbase_0.41.1_windows_amd64.zip`（307 跳转到该站自己的文件接口，下载时要带 `-L`） | [VERIFIED: curl -I，本会话] |
| 文件名 | `pocketbase_0.41.1_windows_amd64.zip` | [VERIFIED: 发布站 `checksums.txt`，本会话] |
| 大小 | 13,012,018 字节（Content-Length） | [VERIFIED: curl -I，本会话] |
| sha256 | `fda68dcbb4812585cf32282a8e79c09f0b065c109c75d840f46d8fd8b59b0580` | [VERIFIED: 发布站 `checksums.txt` 里该文件那一行，本会话读到] |

**必须如实告诉所有者的信任模型：** GitHub 上没有 v0.41.1 的发布（接口返回 404，GitHub 上最新的发布是 v0.40.6，2026-10-23），0.41.0 起官方发布只在维护者自己的站点（发布说明：“Migrated the Go module from GitHub to the new host”）。所以 `checksums.txt` 与 zip 在同一个站点、没有签名，这个核对只能防下载损坏，防不了发布站本身被入侵；D-03 里“GitHub 发布页如果提供指纹就交叉核对”**对 0.41.1 不适用**。可做的弱补强：核对 `checksums.txt` 里 linux_amd64 那一行仍等于 Phase 6 钉死的 `7504ec99…347e`（说明该文件自 2026-11-07 起没变过）；下载后按 sha256 核对 zip，再算出 `pocketbase.exe` 的 sha256 并记进 `tools/pb/PB-LOCAL.md`，之后每次运行前核对 exe。[CITED: 06-RESEARCH.md 信任模型；06-CONTEXT D-16]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 账号隔离（注册关闭、跨账号读写） | Database / Storage（PocketBase 集合规则，在迁移里） | API / Backend（PocketBase 执行规则） | 规则同时是过滤器，只有服务器端规则才算数；客户端和假服务器都不能证明隔离 |
| 令牌有效期与失效 | API / Backend（`users.authToken.duration`、tokenKey） | Browser / Client（SDK 的 `authStore`、`authRefresh`） | 服务器签发并校验；普通用户的令牌 SDK 不会自动续期，要应用自己调用 |
| 规则验证脚本 | 本机 Node 脚本 + 一次性 PocketBase 进程 | — | 不是浏览器行为，用裸 `fetch` 断言协议即可，不需要 Playwright |
| 协议样本与契约 | Node 脚本（录制）、`tests/mocks/`（样本和归一化） | 假服务器（被契约自测检验） | 样本来自真实实例，假服务器只是它的复述 |
| 假 REST 服务器 | Node 侧（`FakePbServer.handle()`） | Playwright `context.route`（只做传输适配） | 状态放 Node 侧（项目既有决定），纯函数便于不开浏览器就做契约自测 |
| 假实时（SSE） | 页面侧（假 `EventSource`） | Node 侧（客户端登记、订阅、推送） | `route.fulfill` 不能保持长连接，只能在页面里替换 `EventSource` |
| 请求护栏（只许假服务器） | Playwright guard（context.route 层） | 浏览器级解析规则和死代理（已有） | 与 v1 同一个分层；cloud 模式只是把应用来源下的放行范围收窄 |
| SDK 同源提供 | 静态服务器（`static-server.cjs`） | — | 应用上线后也是同源托管（Phase 9、13），测试保持同一路径 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PocketBase（Windows amd64 预编译包） | 0.41.1 | 一次性本机实例，隔离脚本和样本录制的对象 | 与服务器版本一致（Phase 6 已装 0.41.1）；发布站 sha256 已读到 [VERIFIED: checksums.txt，本会话] |
| PocketBase JS SDK（iife） | 0.28.1 | 浏览器里的真实 SDK，同源提供 | 所有者已批准并固定；`tools/probe/page/vendor/pocketbase.iife.js`，40539 字节，sha256 `94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f`，`SHA256SUMS` 已钉 [VERIFIED: 读 vendor/README.md 和文件，本会话] |
| @playwright/test | 1.64.1（已装） | cloud 用例 | 项目既有，不新增依赖 [VERIFIED: package.json:11] |
| Node.js 内置模块 | 24.20.0（本机） | 隔离脚本、录制脚本、静态服务器校验：`node:child_process`、`node:crypto`、`node:fs`、`node:os`、`node:vm`、`fetch` | 项目的工具脚本都是零依赖 [VERIFIED: `node --version`，本会话] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tools/privacy/privacy-check.mjs` | 仓库内 | 样本归一化自检时引用 `findTokenShapes`；每次提交前 `--all` | 样本、契约文档和脚本写完后 |
| `tools/probe/schema-check.mjs` 的 `node:vm` 沙箱做法 | 仓库内 | 迁移静态检查的参考 | 迁移文件不需要二进制就能比对规则 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 裸 `fetch` 的隔离脚本 | Playwright 驱动浏览器加 SDK | 浏览器带来护栏、时钟和资源消耗，对协议断言没有收益；隔离只关心 HTTP 层 |
| `context.route` 接 REST | 页面里替换 `window.fetch` | 替换会遮住 SDK 的真实请求构造（头、AbortController、JSON 处理）；route 方案让真实 SDK 原样运行 |
| 独立 `playwright.cloud.config.ts` | 在基础 config 里加 `testIgnore` 并用环境变量切换 | 独立 config 不碰基础 config，默认 `npm test` 零变化；环境变量方案要改 `playwright.config.ts` |
| `.cjs` 共享库（归一化、场景表） | `.mjs` 加 Playwright 里动态 `import()` | 本仓库没有任何 TS 用例导入 `.mjs`，Playwright 在 CJS 下对动态 `import()` 的处理没有在本仓库验证过 [ASSUMED]；`.cjs` 两边都能直接 `require`/`import` |

**Installation:**

```bash
# 不新增任何 npm 依赖，不运行 npm install。
# PocketBase 程序不是 npm 包：由 tools/pb/fetch-local-pb.mjs 在所有者批准之后下载、核对、只解出 pocketbase.exe。
```

**Version verification:** PocketBase 0.41.1 发布记录（创建于 2026-10-28）和 `checksums.txt` 已读到；Windows 包大小用 HEAD 请求读到；SDK 版本和哈希读自仓库内已批准的文件。没有可用 `npm view` 验证的新包。

## Package Legitimacy Audit

> 本阶段不安装任何 npm、PyPI 或 crates 包，所以 `gsd-tools query package-legitimacy check` 不适用。下表记录两个“外部制品”的审计，它们都不是包管理器里的包。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| PocketBase 0.41.1 windows_amd64 zip | 维护者发布站（非包管理器） | 2026-10-28 发布；项目 2022 年起 | — | `ganigeorgiev.com/pocketbase/pocketbase`；旧版本在 `github.com/pocketbase/pocketbase`（已归档） | 来源是官方文档链接指向的发布站，但只有单一来源 | **需要所有者批准下载**（OWNER-DECISION-2）；按 sha256 核对后才能运行 |
| pocketbase JS SDK 0.28.1（iife） | npm 的 tarball，已由 Phase 6 的 06-05 检查点批准 | — | — | `github.com/pocketbase/js-sdk` | 已批准、已固定 sha256 | 复用，不算新下载；不走 npm、不进 `package.json` [CITED: tools/probe/page/vendor/README.md] |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none（本阶段无新包）

## Architecture Patterns

### System Architecture Diagram

```
 ┌───────────── 手动运行（不进默认 npm test） ─────────────┐
 │ npm run pb:isolation          npm run pb:record          │
 │      │                              │                    │
 │      ▼                              ▼                    │
 │  tools/pb/lib/instance.mjs ── 核对 exe sha256 ──► 不符则停下（退出码 2）
 │      │ 临时目录 pb_data（系统 tmp）                        │
 │      │ superuser 创建（随机凭据，参数数组，不回显）          │
 │      │ serve --http=127.0.0.1:<随机端口> --dir --migrationsDir=pb/pb_migrations --automigrate=false
 │      ▼                                                    │
 │  一次性 PocketBase 0.41.1（首次 serve 应用迁移）           │
 │      ▲            ▲                    ▲                  │
 │      │            │                    │                  │
 │  isolation-check  record-samples   重放对比（第二个新实例） │
 │  (断言矩阵)       (场景表→归一化→   (规则快照一致)         │
 │      │             tests/mocks/pb-samples/*.json)         │
 │      ▼                     │                              │
 │  只输出 PASS/FAIL+规则名    ▼                              │
 └──────────────────────  样本进仓库 ───────────────────────┘
                              │
 ┌───────── npm run test:cloud（低优先级，1 worker） ────────┐
 │  Playwright 页面                                           │
 │   ├ 真实 SDK（/vendor/pocketbase.iife.js，同源，sha256 固定）
 │   │    │ fetch('/api/...')                                 │
 │   │    ▼                                                  │
 │   │  context.route(/api/) ──► FakePbServer.handle()（Node，纯函数，状态在 Node）
 │   │                              ▲   │ 未实现的 /api/ → route.fallback() → guard 记违规
 │   │                              │   ▼
 │   └ 假 EventSource ◄── page.evaluate 推送 ◄── 订阅登记（POST /api/realtime 由 handle 处理）
 │        │ exposeBinding 握手(es.open/es.close)                │
 │  guard（context.route 最先匹配最后注册者）：                  │
 │   应用来源只许 / 、应用文件、SDK 文件；其余来源一律违规        │
 │  契约自测（Node 内，不开浏览器）：样本 ⇄ handle() 归一化后比对 │
 └────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
pb/
└── pb_migrations/                    # 进 git，只有结构；Phase 13 原样复制到服务器
    ├── 1794096000_users_lockdown.js  # users 加固（时间戳只是示例，要晚于所有系统迁移）
    ├── 1794096100_journey_docs.js    # 业务集合
    └── (可选) 1794096200_users_self_email.js   # 仅在所有者选 B 时存在
pb/rules.expected.json                # 归一化的规则快照（只有结构），重放对比的基准
tools/pb/
├── PB-LOCAL.md                       # 版本、来源、zip 与 exe 的 sha256、核对步骤（进 git）
├── bin/                              # git 忽略（要在 .gitignore 里显式加 /tools/pb/bin/）；放 pocketbase.exe 和 zip
├── fetch-local-pb.mjs                # 所有者批准后才运行：下载、核对、只解出 exe
├── lib/instance.mjs                  # 一次性实例：核对 exe → 临时目录 → 超级用户 → serve → 健康检查 → 停止 → 删除
├── lib/sse-client.mjs                # 手写最小 SSE 客户端（Node 24 没有稳定的全局 EventSource）
├── lib/normalize.cjs                 # 样本归一化（也被 Playwright 契约自测 require）
├── lib/scenarios.cjs                 # 录制和契约自测共用的场景表
├── isolation-check.mjs               # 断言矩阵 + 反向对照
├── record-samples.mjs                # 录制样本
└── migration-check.mjs               # node:vm 静态检查迁移（不需要二进制，可以进默认检查）
tests/mocks/
├── pb-server.ts                      # FakePbServer
├── pb-runtime.ts                     # 页面侧：installFakeEventSource（自包含函数，同 claude-runtime.ts 的约束）
├── pb-samples/*.json                 # 归一化样本
└── PB-CONTRACT.md
tests/cloud/                          # cloud 专属用例（不在 tests/e2e，默认 npm test 不会收到）
├── pb-contract.spec.ts               # Node 内的契约自测
├── cloud-harness.spec.ts             # 真实 SDK 登录、读写、订阅
├── guard-cloud.spec.ts               # 护栏收紧和故意违规自检
└── probes-cloud.spec.ts              # setOffline 探针
playwright.cloud.config.ts            # 展开基础配置，只改 testDir 和 workers，顶部设置 USJ_TEST_MODE
```

**目录命名的两个硬约束：**

- 不要用 `pocketbase/`：`.gitignore` 第 52 行的 `/pocketbase` 会忽略根目录下同名的目录。已用 `git check-ignore` 实测：`pocketbase/pb_migrations/x.js` 被该规则忽略，`pb/pb_migrations/x.js` 不被忽略。ARCHITECTURE 推荐的 `pocketbase/pb_migrations/` 因此不可用。[VERIFIED: git check-ignore，本会话]
- 程序留存目录要被 `.gitignore` 和规则 A 同时挡住：`tools/pb/bin/pocketbase.exe` 被现有的 `pocketbase.exe` 规则忽略（实测），规则 A 按文件名拦 `pocketbase.exe` 和 `.zip`。但目录里的其他文件（说明文件、解压出的 LICENSE）不会被它们挡住，所以要显式加一条 `/tools/pb/bin/`，并且只从 zip 解出 `pocketbase.exe` 一个文件。[VERIFIED: git check-ignore 和 privacy-check.mjs:66-95，本会话]

### Pattern 1：迁移文件（只有结构，可重放）

**What:** `users` 加固和 `journey_docs` 分成不同的迁移文件，每个文件只有一个 `migrate((app) => {...})` 调用，不写回滚（探针站点的先例，D-13）。**不要**把应用级设置（限流、代理头、日志保留）放进来，那是 Phase 13。

**依据（源码）：**

- 新建 `users` 的默认值：`createRule` 是空字符串（任何人都能注册），`list/view/update/delete` 是 `id = @request.auth.id`，字段有 `name`（文本）和 `avatar`（文件）。[VERIFIED: migrations/1640988000_init.go:316-346（v0.40.6，已读）：`users.CreateRule = types.Pointer("")`、`users.DeleteRule = types.Pointer(ownerRule)`]
- 认证默认选项：`authToken.duration` 432000（5 天）、`otp.enabled` 假、`mfa.enabled` 假、`authAlert.enabled` 真、`authRule` 空字符串；令牌类型的时长允许范围 10 到 94670856 秒（约 3 年）。[VERIFIED: core/collection_model_auth_options.go:50-98 和 :303（v0.40.6，已读）：`Duration: 432000, // 5days`、`validation.Min(10), validation.Max(94670856)`]
- 所以 90 天是 7776000 秒，在允许范围内。
- **`authAlert.enabled` 默认是真**：新设备登录会尝试给用户发提醒邮件。地址是假的，也没有邮件配置，应该显式关掉，免得登录路径上出现无意义的发信尝试。[CITED: record_helpers.go:121，`if e.AuthMethod != "" && authRecord.Collection().AuthAlert.Enabled { authAlert(...) }`]
- JSVM 里这些选项的属性名是 `authToken`、`otp`、`mfa`、`oauth2`、`passwordAuth`、`authAlert`、`manageRule`；`maxSize` 是 json 字段的选项名，单位字节，0 表示默认 1 MB。[CITED: pocketbase.io/jsvm/classes/Collection.html 和 core.JSONField.html]
- 嵌套结构体属性可以直接赋值：探针迁移在 0.41.1 上已跑通 `s.trustedProxy.headers = [...]`、`s.rateLimits.enabled = true`。[VERIFIED: tools/probe/server/pb_migrations/probe_schema.js:75-83，读过；Phase 6 已部署运行]

**写法见 Code Examples。** 其中 `users.fields.removeByName(...)` 和 `users.authToken.duration = …` 是在 JSVM 里的直接写法，我没有在 0.41.1 上运行过，标 [ASSUMED]；`migration-check.mjs` 静态检查加真实实例的快照对比会证实。

**关于 `name` 和 `avatar` 字段：** D-05 要求“本人能改的只有密码和邮箱”。默认的 `users` 里还有 `name`（可写文本）和 `avatar`（文件上传入口）。推荐在迁移里把这两个字段删掉（更小的攻击面，没有文件存储入口）；备选是在 `updateRule` 里再加 `@request.body.name:isset = false && @request.body.avatar:isset = false`。这是 Claude's Discretion 范围内的选择，推荐删字段。

**`updateRule` 的写法：**

```
id = @request.auth.id && @request.body.verified:isset = false && @request.body.emailVisibility:isset = false
```

`verified` 即使没有这一句，PocketBase 对没有管理权限的请求也会拒绝（`validation_values_mismatch`），写进规则是双保险；写进规则后，改 `verified` 的请求得到的是 404（规则过滤）而不是 400，断言要按这个来。[CITED: 规则不满足时更新返回 404，docs api-rules-and-filters；record_upsert.go 的 `verified` 校验]

### Pattern 2：一次性本机实例库（`tools/pb/lib/instance.mjs`）

**What:** 一个函数 `withInstance(options, async (inst) => {...})`：核对 exe → 建临时目录 → 创建超级用户 → 启动 → 等健康检查 → 回调 → 停止 → 删除。隔离脚本、录制脚本、重放对比三个入口共用。

**步骤和要点：**

1. **先核对 exe 的 sha256**，与 `tools/pb/PB-LOCAL.md`（或同目录的常量）里钉死的值比较，不符就以退出码 2 停下报告，不运行（D-02）。exe 的哈希要在批准的下载完成、从已核对的 zip 解出之后才能算出来，所以“记录 exe 哈希”是下载任务的收尾动作。
2. 临时目录用 `fs.mkdtempSync(path.join(os.tmpdir(), 'usj-pb-'))`，数据目录是其下的 `pb_data`，传 `--dir`。
3. **超级用户必须先于 `serve` 创建**，用命令行的 `superuser upsert <邮箱> <口令>`（两个位置参数，口令随机生成，邮箱是 example.com 系列的合成地址）。用 `spawn(bin, ['superuser', 'upsert', email, pw], {...})` 的数组形式传参，**不要把这条命令的完整文本写进任何被跟踪的文件**，否则规则 G 的第四种模式（`superuser create|upsert|update` 后跟口令）会拦下提交。[CITED: cmd/superuser.go 的 `Use: "upsert"`、`Example`（v0.40.6）；PRIVACY.md 规则 G]
4. **JS 迁移只在 `serve` 时应用**，`superuser upsert` 之后迁移还没跑（Phase 6 的发现）。[CITED: pocketbase.io/docs/js-migrations/：“each unapplied migration … executed automatically in a transaction on `serve` (or on `migrate up`)”]
5. 启动参数：`serve --http=127.0.0.1:<端口> --dir=<临时>/pb_data --migrationsDir=<仓库>/pb/pb_migrations --hooksDir=<临时>/pb_hooks --automigrate=false`。`--http` 的默认值本来就是 127.0.0.1:8090，显式写出并用随机端口，避免和别的实例冲突；`--automigrate=false` 防止脚本如果改了集合，会往仓库的 `pb_migrations/` 里生成文件。`--dir`、`--dev`、`--queryTimeout`、`--encryptionEnv` 是全局参数；`--hooksDir`、`--migrationsDir`、`--automigrate`、`--publicDir` 是预编译程序加的参数。[CITED: pocketbase.go:220-250、cmd/serve.go:55-80、examples/base/main.go:27-77（v0.40.6）]
6. 端口：先绑 `127.0.0.1:0` 取一个空闲端口再关闭，再传给 PocketBase（有极小的竞争窗口，可接受）。
7. 就绪：轮询 `GET /api/health` 直到 200，加超时。
8. 子进程的 stdout 和 stderr **不要回显**：全部重定向到临时目录里的日志文件，失败时只打印“实例启动失败（退出码 N）”，不打印日志内容。正常情况下既然超级用户已先建好，启动横幅不会打印安装链接（那条链接带 JWT 形状的令牌）；仍然不回显，是双保险。
9. 降低资源占用：`os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL)`；环境变量加 `GOMAXPROCS=2`、`GOMEMLIMIT=256MiB`（Go 运行时变量；ARCHITECTURE 引用的官方生产文档推荐用 `GOMEMLIMIT` 做软上限）。[ASSUMED：具体数值]
10. **Windows 上的停止**：Node 在 Windows 上没有优雅的信号投递，`child.kill()` 是强制终止。实例是一次性的，数据马上删，所以强制终止可以接受。要点：等 `exit` 事件，再 `fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })`（SQLite 文件刚关闭时可能还被占用）；在 `try/finally`、`process.on('SIGINT')`、`process.on('exit')` 里都要停止子进程；脚本本身被强杀时子进程会留下，README 里写一句清理办法（任务管理器里结束 `pocketbase.exe`）。
11. 首次运行 Windows 防火墙：只绑定回环地址的程序通常不会弹窗；万一弹窗，选“取消”（不允许公网访问）。[ASSUMED]
12. 默认状态的限流在新实例里是关的（探针迁移显式把它打开，说明默认是关的）；脚本在开头用超级用户读 `GET /api/settings` 断言 `rateLimits.enabled` 为假，否则密集登录会被限流误伤。[CITED: probe_schema.js:82 显式 `s.rateLimits.enabled = true`；默认值本身 [ASSUMED]，所以要断言]

### Pattern 3：隔离脚本和断言矩阵（`tools/pb/isolation-check.mjs`，`npm run pb:isolation`）

**架构选择：零依赖 Node 脚本，不用 Playwright。** 隔离只关心 HTTP 和 SSE，不需要浏览器，也不要 guard、固定时钟这些东西；用 Node 24 自带的 `fetch`。与项目既有工具脚本一致（`privacy-check.mjs`、`schema-check.mjs`、`check-report.mjs`）：零依赖、只用 `node:` 内置模块、`--self-test`、输出一行结论（例如 `ISOLATION OK 38/38`）、退出码 0 通过 1 断言失败 2 用法或前置条件失败。

**输出约定：** 每条断言一行 `PASS|FAIL <编号> <规则名>`，失败时只附状态码和 PocketBase 的错误码（例如 `validation_json_size_limit`），**永不打印令牌、口令、请求体、响应体或邮箱**。凭据全部运行时随机生成（`crypto.randomBytes`），只存在于内存和临时实例里，不写文件。

**每条断言的写法：** 同时断言（a）状态码（和已知的错误码）以及（b）**用超级用户回读，确认数据没有变**。只断言状态码会漏掉“返回了错误但其实写进去了”，只断言回读会漏掉“权限放开但没写成”。

**准备：** 超级用户登录取令牌；用超级用户创建两个合成账号 A、B（`users` 注册关闭，所以只能用超级用户建）；用超级用户给 A 和 B 各建 `state` 和 `plan` 两条 `journey_docs`（所有者建空记录，供“读不到、改不了”断言用），记下记录 id。

下面是矩阵。“预期”一列里，来自文档或源码的写 [CITED]；只能靠真实实例定稿的写“实测定稿”，并且样本里要记录下来。

| 编号 | 行为 | 预期 | 来源 |
|------|------|------|------|
| ACCT03-1 | 匿名 `POST /api/collections/users/records` | 403；超级用户回读：账号总数没增加 | [CITED: docs api-rules：锁定规则对非超级用户返回 403] |
| ACCT03-2 | 已登录的 A 创建 `users` 记录 | 403；账号总数没增加 | 同上 |
| ACCT03-3 | A 删除自己的账号（`DELETE users/<A>`） | 403；回读 A 还在 | 同上（`deleteRule` 为 null） |
| ACCT03-4 | A 删除 B 的账号 | 403；回读 B 还在 | 同上 |
| ACCT03-5（反向对照） | 在临时认证集合（`createRule` 为空字符串，由脚本用超级用户建）上匿名注册 | **201/200 成功** | 证明 ACCT03-1 的探测不是空转 |
| ACCT04-1 | A 列 `journey_docs`（无过滤） | 200，条数恰为 A 自己的 2 条，没有 B 的 id | [CITED: 列表规则不满足返回 200 空列表] |
| ACCT04-2 | A 列 `journey_docs`，`filter=owner="<B>"` | 200，0 条 | 同上 |
| ACCT04-3 | A 查看 B 的文档 `GET .../records/<B 的 id>` | 404 | [CITED: viewRule 不满足 404] |
| ACCT04-4 | A 更新 B 的文档（带合法 `data`） | 404；超级用户回读 B 的 `data` 没变 | [CITED: updateRule 不满足 404] |
| ACCT04-5 | A 删除 B 的文档 | 403；回读 B 的文档还在 | [CITED: deleteRule 为 null → 403] |
| ACCT04-6 | A 删除自己的文档 | 403；回读还在 | 同上 |
| ACCT04-7 | A 以 `owner = B` 新建文档 | 400；回读 B 名下文档数没变 | [CITED: createRule 不满足 400] |
| ACCT04-8 | A 以 `owner = A` 新建一份已存在的 `kind`（`state`） | 400，`data` 里键含 `owner` 和 `kind`，错误码 `validation_not_unique` | [CITED: validators/db.go NormalizeUniqueIndexError：多列唯一索引对每一列都报错] |
| ACCT04-9 | A 以 `owner = A` 新建 `kind` 不在选项里的文档 | 400 | [ASSUMED] 实测定稿 |
| ACCT04-10 | A 更新自己的文档，请求体带 `owner = B` | 404（规则 `:isset = false` 不满足）；回读 owner 没变 | [CITED: 规则不满足 404] |
| ACCT04-11 | A 更新自己的文档，请求体带 `kind` 改成另一种 | 404；回读 kind 没变 | 同上 |
| ACCT04-12 | A 更新自己的文档，请求体带**和原值相同**的 `owner` | 404（`:isset = false` 比 `:changed = false` 更严）；**要写进 PB-CONTRACT：客户端更新时只能发 `data` 和 `writer`** | 实测定稿 |
| ACCT04-13（修饰符绕过） | A 更新自己的文档，请求体用键 `owner+`、`+owner`、`owner-`、`kind+`（PocketBase 的字段修饰符写法） | 必须被拒（4xx），**回读 owner 和 kind 没变** | [ASSUMED]：源码里 `requestInfo.Body = data` 把修饰符键替换成了解析后的值（apis/record_crud.go），说明规则看到的是解析后的值，但单值关系和选择字段对修饰符的处理没读到，要实测 |
| ACCT04-14 | A 更新自己的文档，`data` 为合法小对象，`writer` 合法 | 200，`updated` 变了，返回体里没有别人的字段 | [CITED] |
| ACCT04-15 | A 的 `writer` 超过 40 个字符 | 400 | [ASSUMED] |
| ACCT04-16 | A 写入 JSON 字节数在上限以内（例如 3.9 MiB） | 200 | [CITED: validators 用 `len(raw) > maxSize`，`maxSize=4194304`] |
| ACCT04-17 | A 写入 JSON 超过上限（例如 4 MiB 加 1 KiB） | 400，`data.data.code = validation_json_size_limit` | [CITED: core/field_json.go:163-170]；请求体上限是 32 MiB 加各字段上限之和，所以这里不会先撞到 413 |
| ACCT04-18 | 未登录列 `journey_docs` | 200，0 条 | [CITED] |
| ACCT04-19 | 未登录查看、更新、删除、创建 | 404、404、403、400 | [CITED] |
| ACCT04-20 | 过期或无效令牌读、写 | 与未登录相同（空列表、404、400），**不是 401** | [CITED: apis/middlewares.go loadAuthToken：无效令牌当未登录；只有 RequireAuth 的接口返回 401] |
| ACCT04-21 | A 列 `users` | 200，只有 A 自己 1 条，不含 B 的 id 和邮箱 | [CITED: listRule `id = @request.auth.id`] |
| ACCT04-22 | A 查看 `users/<B>` | 404 | [CITED] |
| ACCT04-23 | A 更新 `users/<B>`（改 `emailVisibility` 之类） | 404；回读 B 没变 | [CITED] |
| ACCT04-24 | 登录和刷新在 `users` 只看自己的规则下仍正常（Claude's Discretion 的 MEDIUM 项） | `auth-with-password` 200 且返回体里有 `token` 和 `record`（含本人邮箱）；`auth-refresh` 200 | [CITED: 登录处理器不走 list/view 规则] 实测定稿 |
| ACCT04-25 | 普通账号不能当超级用户 | A 读 `_superusers` 记录 403；A 读 `GET /api/collections`、`/api/settings`、`/api/logs`、`/api/backups` 都是 401 或 403；用 A 的凭据对 `_superusers` 做登录失败（400） | [ASSUMED] 状态码实测定稿；这是“网页上拿不到管理员”的补充防线，成本低 |
| ACCT04-26（可选） | A 列系统集合 `_authOrigins`、`_externalAuths` | 只有 A 自己的（规则是 `recordRef = @request.auth.id`），没有 B 的 | [CITED: migrations/1640988000_init.go:124-252 的 `ownerRule`] |
| RT-1 | A 订阅 `journey_docs/*`，B 修改自己的文档，随后 A 修改自己的文档作为**正向对照** | A 先后只收到自己那条的事件；等到对照事件到达后再静默 1.5 秒，**没有出现 B 的记录 id** | [CITED: apis/realtime.go:594-775，订阅者按当时身份过 listRule] |
| RT-2 | A 订阅 `journey_docs/<B 的文档 id>`（单条订阅用 viewRule） | B 修改后 A 收不到 | 同上 |
| RT-3 | 未登录的连接订阅 `journey_docs/*` | 收不到任何事件 | 同上 |
| RT-4 | A 订阅时带 `fields=id,kind,writer,updated`（SDK 的写法） | 事件里的 `record` 键恰好是这四个 | [CITED: apis/realtime.go:717-733 `picker.Pick`] 实测定稿 |
| RT-5 | 用 A 的 `clientId`，带 B 的令牌 `POST /api/realtime` | 403 | [CITED: apis/realtime.go:218-222；docs api-realtime] |
| RT-6 | `POST /api/realtime` 用不存在的 `clientId` | 404 | [CITED] |
| TOK-1 | 令牌有效期 | 超级用户读 `GET /api/collections/users`，`authToken.duration` 为 7776000；A 登录得到的令牌解码出 `exp - 当前秒` 在 90 天上下 1 天内 | [CITED: Max 94670856]；`exp` 的取值方式实测定稿 |
| TOK-2 | 所有者重置密码使旧令牌失效（D-06） | 超级用户 PATCH A 的密码 → A 的旧令牌 `auth-refresh` 返回 401；用新密码登录成功 | [CITED: core/record_model.go:1452-1456，密码或邮箱变化时 `RefreshTokenKey()`] |
| D5-1 | A 自改密码，带正确的 `oldPassword` | 200；旧令牌随后 `auth-refresh` 401（tokenKey 轮换）；新密码登录成功，旧密码登录 400 | [CITED: record_upsert.go] |
| D5-2 | A 自改密码，不带 `oldPassword` | 400，`data.oldPassword.code = validation_required`；回读密码没变（旧密码仍能登录） | [CITED: record_upsert.go validateFormFields] |
| D5-3 | A 自改密码，`oldPassword` 不对 | 400，`validation_invalid_old_password` | [CITED: checkOldPassword] |
| D5-4 | A 自改 `verified` 或 `emailVisibility` | 404（规则过滤）；回读没变 | [CITED] |
| D5-5（选 A 时） | A 自改 `email` | 400，`data.email.code = validation_values_mismatch`；回读邮箱没变 | [CITED: record_upsert.go] |
| D5-6（选 B 时） | A 只带 `email` 改邮箱 | 200；新邮箱能登录，旧邮箱登录 400；旧令牌 `auth-refresh` 401 | [ASSUMED]：`manageRule` 收窄写法要实测 |
| D5-7（选 B 时） | A 同时带 `email` 和 `password`（不带 `oldPassword`） | 400（没有管理权限，要求旧密码且邮箱不能变）；回读邮箱和密码都没变 | [ASSUMED] 实测 |
| REPLAY-1 | 对**第二个全新实例**重放迁移 | 规则快照（见下）与第一个实例逐字一致，也与 `pb/rules.expected.json` 一致 | SC2 |
| NEG-1（反向对照） | 用超级用户在临时集合 `journey_docs_leaky` 上建一套**故意写错**的规则（`listRule` 只有 `@request.auth.id != ""`、`deleteRule` 为空字符串），把 ACCT04-1、04-3、04-4、04-5、RT-1 的检查函数跑一遍 | **这几条必须失败** | 证明断言不是空转；与项目“每条规则一条故意违规的自检”的约定一致 |

**规则快照的内容（只含结构，去掉随机值）：** 对 `users` 和 `journey_docs`：集合名、类型、五条规则加 `manageRule`/`authRule`、`indexes`、每个字段的 `name/type/required/maxSelect/values/maxSize/max/cascadeDelete/onCreate/onUpdate`（关系字段的 `collectionId` 换成 `<users>` 占位）；`users` 另含 `passwordAuth.enabled`、`passwordAuth.identityFields`、`oauth2.enabled`、`otp.enabled`、`mfa.enabled`、`authAlert.enabled`、`authToken.duration`。**不含** `authToken.secret`、字段和集合的随机 id、任何时间戳。

**两个断言的诚实标注：** 状态码里凡是标“实测定稿”的，第一次真实运行后要把观察到的值抄进 `PB-CONTRACT.md` 并固定到断言里（不改成“观察到什么就断言什么”），再运行第二遍确认稳定。

### Pattern 4：协议样本的录制与归一化（解决规则 F 冲突）

**录制：** `tools/pb/record-samples.mjs` 用 `lib/scenarios.cjs` 里的场景表，对一次性实例逐步发请求，把请求和响应归一化后存成 `tests/mocks/pb-samples/*.json`。场景表同时是契约自测的输入，所以“同一组请求，真实实例的回应”和“假服务器的回应”可以直接比较（PITFALLS 20 里“同一组断言既对 mock 跑也对真实实例跑”）。

SC3 要求的样本：登录（200 和 400 两种）、刷新令牌（200 和用无效令牌得到的 401）、读取（列表和单条）、创建、更新、唯一索引冲突（400）、实时事件。另加：未登录列表返回空、PB_CONNECT 事件、订阅请求返回 204。

**一个会改变假服务器的发现：401 只出现在 `auth-refresh`。** “用无效令牌请求”这个 SC3 样本要用 `auth-refresh` 来取；对记录的读写，无效或过期的令牌被当作未登录，得到的是空列表、404、400。[CITED: apis/middlewares.go:184-209 `loadAuthToken` 和 :91-100 `requireAuth`，v0.40.6，已读]

**可选做法（推荐，成本低）：用真实 SDK 当录制的客户端。** 在 Node 里用 `node:vm` 执行已核对哈希的 `pocketbase.iife.js`（它只用标准全局：`fetch`、`AbortController`、`FormData`、`Blob`、`atob`、`console`、`queueMicrotask`、`setTimeout`，没有 `window` 时 `LocalAuthStore` 退回内存存储），给它一个记录请求的 `fetch` 包装器。这样样本里的请求恰好是 SDK 0.28.1 发出的，直接证明“服务器 0.41.1 配 SDK 0.28.1”。实时部分仍用手写 SSE 客户端（SDK 的实时需要 `EventSource`）。[ASSUMED：沙箱执行 iife 的可行性，我读了文件，没有运行]

**归一化方案（`tools/pb/lib/normalize.cjs`，纯函数）：**

| 内容 | 归一化 | 规则 F、C、G 如何不触发 |
|------|--------|--------------------------|
| 令牌（`token` 字段、`Authorization` 头） | 值换成字面量 `<JWT>`；**同时**把载荷的键集合和类型记进样本的 `tokenClaims`（例如键 `collectionId`、`exp`、`id`、`refreshable`、`type` 以及 `type` 的取值 `auth`），`exp` 记成“距签发 N 秒”的差值而不是绝对时间 | 样本里没有任何 `eyJ…` 段；规则 F 需要三段、前两段 `eyJ` 开头 |
| 记录 id（15 位小写字母数字） | 按在该样本里首次出现的顺序换成 `<ID:1>`、`<ID:2>`… | 同一个 id 在同一样本里永远映射到同一个占位 |
| 集合 id | `_pb_users_auth_` 换成 `<USERS_COLLECTION_ID>`，其余 `pbc_…` 换成 `<COLLECTION_ID:n>` | — |
| 时间戳（`YYYY-MM-DD HH:mm:ss.SSSZ`，中间是空格） | 换成 `<TS>`；顺序关系另记（`updated` 是否晚于 `created`） | — |
| 邮箱 | 换成 `user-a@example.com`、`user-b@example.com` | 规则 C 放行 example.com 系列 |
| 口令 | 请求体里的 `password`、`passwordConfirm`、`oldPassword` 值换成 `<PASSWORD>` | 规则 G 放行 `<…>` 占位 |
| `clientId`（实时） | `<CLIENT_ID>` | — |
| `authToken.secret`、`tokenKey` | 直接丢弃 | — |

**归一化的自检（三条，要写进计划）：**

1. 录制脚本写文件之前，对结果文本调用 `findTokenShapes`（从 `tools/privacy/privacy-check.mjs` 导入，该文件是 ESM，所以录制脚本是 `.mjs`）、检查没有 `eyJ` 子串；任一命中就**不写文件**并以非零退出。
2. 反向对照：用运行时拼接的 JWT 形状字符串（`b64u(头).b64u(载荷).随机签名`，三段都在运行时生成，源码里没有完整字面量，见 PRIVACY.md §9）喂给 `normalize`，断言输出里没有令牌且 `findTokenShapes` 为零；再断言**未归一化的同一字符串**确实被 `findTokenShapes` 命中（证明自检不是空转）。
3. 对 `tests/mocks/pb-samples/` 下的每个文件，契约自测里读出来再跑一遍 `scanText`，断言没有规则 F、G、H 命中。

**PB-CONTRACT.md 的内容（建议章节）：** ①版本（服务器 0.41.1，exe 的 sha256；SDK 0.28.1，iife 的 sha256；录制日期；录制脚本名）；②录制方式和归一化规则；③已实现端点表（每行指向一个样本文件）；④明确未实现的清单；⑤假服务器的有意偏差（令牌不签名、`updated` 用假时钟、id 生成方式）；⑥实时的线上格式（SSE 的 `id:`、`event:`、`data:` 三行加空行，`PB_CONNECT` 的 `data` 是 `{"clientId":"…"}`，事件名是订阅串原样，包括 `?options=…`）；⑦对规则语义的记录（401 只在 `auth-refresh`、规则不满足时 200 空/404/400、锁定规则 403、`:isset=false` 连相同值也拒）；⑧重新核对的步骤。[CITED: tools/subscriptions/message.go 的 `WriteSSE`；SDK iife 的 `RealtimeService`]

### Pattern 5：真实 SDK 对 PocketBase 的协议面（读 vendored iife 的结论）

以下全部读自 `tools/probe/page/vendor/pocketbase.iife.js`（0.28.1）。假服务器和假 `EventSource` 要复述的就是这些。[VERIFIED: 读文件，本会话]

| SDK 调用 | HTTP 请求 | 备注 |
|----------|-----------|------|
| `authWithPassword(identity, password)` | `POST /api/collections/users/auth-with-password`，body `{identity, password}`，`Content-Type: application/json` | 成功返回 `{token, record}`，并把它们存进 `authStore`；失败是 400（`message: "Failed to authenticate."`），**不是 401** [CITED: apis/record_auth_with_password.go] |
| `authRefresh()` | `POST /api/collections/users/auth-refresh`，无 body | 无效令牌 401 |
| `getFullList()` | `GET /api/collections/<c>/records?page=1&perPage=1000&skipTotal=1`（不够一页就停） | `skipTotal=1` 时返回 `totalItems:-1`、`totalPages:-1` [CITED: docs] |
| `getList(page, perPage)` | 同上，`page`、`perPage` | |
| `getFirstListItem(filter)` | `GET …/records?page=1&perPage=1&filter=…&skipTotal=1`，`requestKey` 为 `one_by_filter_…` | 没有结果时 SDK 自己抛 404，不是服务器返回 |
| `getOne(id)` | `GET …/records/<id>` | |
| `create(body)` | `POST …/records`，body 是 JSON | |
| `update(id, body)` | `PATCH …/records/<id>` | 如果更新的恰好是 `authStore` 里的当前用户，SDK 会把返回的记录合并进 `authStore`，**令牌不变** |
| `collection(c).subscribe('*', cb, { fields })` | 在 `new EventSource(<origin>/api/realtime)` 之后，等 `PB_CONNECT`，再 `POST /api/realtime`，body `{clientId, subscriptions: [...]}` | `clientId` 取自事件的 `lastEventId`；订阅串是 `journey_docs/*?options=` 加上 URL 编码的 `{"query":{"fields":"…"}}`；**事件监听的名字就是整个订阅串**（含 `?options=…`）；`PB_CONNECT` 本身也会作为一个订阅主题被一起提交 |
| 取消订阅 | 订阅集合变化时重新 `POST /api/realtime`；没有任何监听时直接 `eventSource.close()` | 登出时先退订再清令牌，顺序见 ARCHITECTURE Q5 |

**其他 SDK 行为：**

- **自动取消**：同一“方法加路径”的未完成请求会被 `AbortController` 取消；默认 `requestKey` 是 `方法 + 路径`。应用要么 `pb.autoCancellation(false)`，要么每个请求传 `requestKey: null`。假服务器的 route 处理函数在请求被取消后再调用 `route.fulfill` 可能抛错，要包 `try/catch`，否则会变成测试进程里的未处理异常。
- **鉴权头**：直接是令牌字符串，**没有 `Bearer ` 前缀**（PocketBase 两种都接受）。[CITED: iife 的 `initSendOptions`；apis/middlewares.go:211-221]
- **错误形状**：HTTP 状态不低于 400 时抛 `ClientResponseError`，`status` 是状态码，`response`（也是 `data`）是服务器的 JSON，`message` 取 `response.message`；网络失败（`fetch` 拒绝）时 `status` 为 0。[VERIFIED: iife 的 `ClientResponseError`]
- **`authStore.isValid`**：本地解码令牌载荷的 `exp`，不做任何网络请求；载荷解不出来（空对象）时判为无效。解码用的是**原生 `atob`**，不接受 base64url 里的 `-` 和 `_`。真实令牌能用，假令牌要注意（见 Pitfalls）。[VERIFIED: iife 的 `getTokenPayload`、`isTokenExpired`]
- **普通用户的令牌不会自动续期**：`registerAutoRefresh` 只在 `_superusers` 集合登录时注册。应用必须自己在启动时（和每隔十来个小时）调用 `authRefresh()`。D-06 里“常用时客户端会自动续期”要改成“应用在每次联网启动时续期”，这是给 Phase 9 的输入。[VERIFIED: iife 的 `authWithPassword`：`this.isSuperusers&&registerAutoRefresh(...)`]
- **`LocalAuthStore`**：键名 `pocketbase_auth`，值是 `{token, record}`，存 `localStorage`，并监听 `storage` 事件做跨标签同步。**同一个 Playwright context 里的两个页面共用 localStorage**，要模拟“两台设备”必须用两个 context。[VERIFIED: iife]

### Pattern 6：Node 侧假服务器 `FakePbServer` 和页面侧假 `EventSource`

**接入方式的结论：REST 用 `context.route`，不替换 `fetch`；SSE 用页面侧假 `EventSource`。** 理由：真实 SDK 的 `fetch` 调用链原样运行（头、`AbortController`、JSON 处理），漂移面最小（PITFALLS 20）；`route.fulfill` 只能一次性返回，保持不了 SSE，所以 SSE 无论如何要在页面里替换。状态全在 Node 侧，和 v1 的 `MockBackend` 同构。

**`FakePbServer` 的结构：**

```ts
class FakePbServer {
  // 与 MockBackend 同名同义的门面（Claude's Discretion 要求）
  reads: string[] = [];                         // 例如 'journey_docs:state'，按到达顺序
  writes: Array<{ path: string; data: any }> = []; // 每次成功的创建或更新，data 是文档的 data 字段（深拷贝）
  downloads: Array<{ filename: string; data: string }> = []; // Phase 8 恒空，Phase 11 才有内容
  seed(state: unknown, opts?: { plan?: unknown; userIndex?: number }): void;
  lastState(): any | null;                       // state 文档的当前 data；没有时 null
  lastPlan(): any | null;

  addUser(): { id: string; email: string; password: string }; // 合成账号，口令运行时随机
  handle(req: PbRequest): PbResponse | null;     // 纯函数：REST；返回 null 表示未实现 → 调用方 route.fallback()
  attach(context: BrowserContext): Promise<void>; // context.route('**/*') 里只接 /api/；context.exposeBinding；addInitScript(installFakeEventSource)
  // 显式推送：测试调用，不靠计时器（Pitfall 21）
  emit(userId: string, action: 'create'|'update'|'delete', record: unknown): Promise<void>;
  dropRealtime(): Promise<void>;                 // Phase 10 用；Phase 8 只留桩
  requests: Array<{ method: string; path: string; status: number }>; // 断言用，不含令牌和请求体
}
```

**要做的行为（Phase 8 范围：SC4 的“登录、读写、订阅”加上 SC3 的样本）：**

- `POST …/users/auth-with-password`：200 `{token, record}`；错误凭据 400 `{status:400, message:"Failed to authenticate.", data:{}}`。
- `POST …/users/auth-refresh`：有效令牌 200；否则 401（`The request requires valid record authorization token.`）。
- `journey_docs` 的列表、单条、创建、更新：按样本里的规则复述（只返回本人的；别人的 404；创建 `owner` 不是自己 400；`(owner, kind)` 重复 400 `validation_not_unique`；更新带 `owner`/`kind` 键 404；`data` 超过 4194304 字节 400 `validation_json_size_limit`；无效或缺失令牌当未登录）。
- `POST /api/realtime`：登记订阅串；`clientId` 不存在 404；同一连接上身份不同 403；成功 204。
- 记录的 `created`/`updated` 用假时钟，格式 `YYYY-MM-DD HH:mm:ss.SSSZ`，起点 `FROZEN_NOW`，每次写入加 1 毫秒，保证单调且可复现。
- 未实现的 `/api/*`（包括未知集合）：返回 `null`，由 route 调 `route.fallback()`，落到 guard，作为违规记录。这就是“假服务器覆盖了应用发出的全部调用”的执行办法。

**令牌：** 运行时生成，不签名，带 `exp`。`token = [b64(头), b64(载荷), b64url(随机字节)].join('.')`，三段都在运行时拼接，源码里没有 `eyJ…` 字面量（规则 F）。`exp` 用假时钟（默认 `FROZEN_NOW/1000 + 7776000`），**不要用 Node 的真实时间**：页面里的 `Date.now()` 被 `setFixedTime` 固定在 2026-03-18，页面和服务器时间对不上会让“令牌过期”的测试结果取决于运行日期。载荷的编码见 Pitfalls（SDK 用原生 `atob`）。令牌表在 Node 侧：`token → { userId, exp }`；`exp` 已过或不在表里就当未登录。

**页面侧假 `EventSource`（`tests/mocks/pb-runtime.ts`，自包含函数，同 `claude-runtime.ts` 的约束：经 `addInitScript(fn, arg)` 注入，函数体里不引用模块变量，文件里没有 `import`）：**

- `class FakeEventSource extends EventTarget`：`readyState`、`url`、`close()`、`onerror` 属性。注意 `EventTarget` 不会自动调用 `onerror` 等属性处理函数，要在自定义的派发里手动调用；SDK 用的是 `eventSource.onerror = fn` 加 `addEventListener(name, fn)`。
- 构造函数里**异步**向 Node 握手：`await binding('es.open', …)` 取到 `clientId`，之后派发一个 `MessageEvent`，`type = 'PB_CONNECT'`，`data = '{"clientId":"…"}'`，`lastEventId = clientId`。必须异步，因为 SDK 在 `new EventSource` 返回之后才挂 `PB_CONNECT` 监听。
- Node 推事件：`page.evaluate` 调页面里的 `__pbEsDeliver(id, name, data)`，页面派发 `MessageEvent(name, { data, lastEventId })`，其中 `name` 是订阅串原样。
- 用 `context.exposeBinding` 而不是 `page.exposeBinding`：`source.page` 能区分是哪个页面调用，同一个 context 里的多个页面都可用。v1 的 `AppHarness` 是 `page.exposeBinding` 并用 `bindingExposed` 标志位保证每个 page 只注册一次，cloud 模式要沿用这个约束。
- 页面刷新或关闭时，Node 侧要丢弃那个页面的客户端登记，推送时 `try/catch` 吞掉“页面已关闭”。
- **事件何时推送：** 默认在 REST 写入的响应已经 `fulfill` 之后立刻 `await` 推送给其他订阅者（确定性顺序，没有计时器）；`emit()` 供测试显式推送；Phase 10 再加 `hold()/release()` 做乱序。订阅者资格按 PocketBase 的做法：`<集合>/*` 过 listRule，`<集合>/<id>` 过 viewRule，每个事件按订阅者当时的身份判定；订阅串里的 `fields` 要裁剪载荷（和真实实例一致，RT-4 定稿后抄进样本）。

### Pattern 7：`AppHarness` 的 cloud 模式、护栏收紧和 SDK 同源提供

**`AppHarness`：**

- `mode` 类型扩成 `'local' | 'account' | 'cloud'`；新增只读属性 `fake = new FakePbServer()`，和 `backend` 并列。
- `open({ mode: 'cloud', users?, seed? })`：`fake.attach(context)`、写入种子、`page.goto('/')`；`ready()` 在 Phase 8 的条件是“页面可调用 `PocketBase`”（先 `page.addScriptTag({ url: '/vendor/pocketbase.iife.js' })`），应用本身还没有云端路径；Phase 9 再改成等待应用的云端状态文案。**不要**在 Phase 8 给页面设置 `USJ_CONFIG.backend`：Phase 7 的决定是 backend 非 null 时应用停在加载之前并显示“存储配置无效”，会让页面进入错误状态。[CITED: STATE.md Phase 07 决定；tests/support/strings.ts:227]
- **环境变量映射**：`process.env.USJ_TEST_MODE === 'cloud'` 时，把 `open({ mode: 'account' })` 映射成 cloud。Phase 8 只落地这个映射的代码，v1 的账户用例要到 Phase 9 应用接上云端后才有意义；`playwright.cloud.config.ts` 顶部设置 `process.env.USJ_TEST_MODE = 'cloud'`（配置文件在 runner 进程里求值，worker 继承环境变量），所以不需要 `cross-env`，Windows 的 cmd 和 PowerShell 都不用特殊写法。

**护栏收紧（`tests/support/test.ts`）：**

- 把放行判断抽成纯函数，例如 `classifyRequest(url, policy)`，返回 `'allow' | 'font' | 'violation'`，导出，像 `guardViolations` 一样同时被真实路径和自检使用。
- 策略有两档：`loose`（v1，现状：应用来源下全放行）和 `cloud`：应用来源下**只放行** `/`、`/us-journey-tracker.html`、`/vendor/pocketbase.iife.js`；应用来源下的其他路径（包括没有被假服务器接走的 `/api/*`）和所有其他来源都是违规。策略由 `USJ_TEST_MODE` 决定，所以 cloud 配置下的所有用例都用收紧后的策略。
- **同时可以把 v1 也收紧**到“应用来源下只许这三个路径”，补上 WR-05 的缺口。风险：浏览器可能自动请求 `/favicon.ico`，静态服务器对它返回 404（ENV-03 里有断言），当前 173 条用例没有因它报错，但收紧后要整套跑一遍确认。[ASSUMED：收紧后没有现有用例被误伤，要实跑确认]
- 把 guard 里挂路由和事件监听的部分抽成 `attachGuard(context, state)`，以后第二台“设备”（第二个 context）可以复用同一套策略。
- **故意违规自检（SC4）：** 在 cloud 配置下，页面里 `fetch('/api/collections/nope/records')`（假服务器不认识）：断言 `guard.state.unexpectedRequests` 里恰好出现这一条，再用 `guard.remove('unexpectedRequests', match)` 删掉，还要处理 Chromium 为被 abort 的 fetch 写的那条 `console.error`（`ERR_BLOCKED_BY_CLIENT`，参见 `guardrails.spec.ts` 里的做法）。再加：请求外部主机、请求应用来源下的非白名单路径、页面里用**真实的** `EventSource`（没装假的）连 `/api/realtime`，都必须被报告。纯函数 `classifyRequest` 另配 Node 内的单元断言，两档策略各几条。

**SDK 同源提供：**

- 静态服务器（`tests/support/static-server.cjs`）白名单加一个路径 `/vendor/pocketbase.iife.js`，内容读自 `tools/probe/page/vendor/pocketbase.iife.js`（不复制第二份，保持单一的 sha256 钉子）。响应头：`content-type: text/javascript; charset=utf-8`、`cache-control: no-store`、`x-content-type-options: nosniff`；只允许 GET 和 HEAD；Host 白名单照旧。
- **启动时校验哈希**：静态服务器启动时读文件算 sha256，与钉死值（常量加 `tools/probe/page/vendor/SHA256SUMS`）不一致就像“找不到应用文件”那样在 `listen` 之前失败（中文提示、不打印绝对路径）。这就是“记录 sha256”在运行时的执行点。
- 要改的断言：`tests/e2e/platform/app-integrity.spec.ts` 的 ENV-03 用例（第 35-56 行）只断言 `/` 和 `/us-journey-tracker.html` 为 200，其余 404；要加上新路径的断言（200、类型、`nosniff`、内容的 sha256 等于钉死值），其余 404 的清单保持。SAFE-02（应用文件基线）不受影响。
- `constants.ts` 加 `PB_SDK_PATH = '/vendor/pocketbase.iife.js'`、`PB_SDK_VERSION = '0.28.1'`、`PB_SDK_SHA256`、`PB_SERVER_VERSION = '0.41.1'`（契约自测核对它们和 PB-CONTRACT.md、SHA256SUMS 一致，同 `CLAUDE_CONTRACT_VERSION` 的做法）。

### Pattern 8：`test:cloud` 入口和 `setOffline` 探针

**入口：** `package.json` 加 `"test:cloud": "playwright test --config=playwright.cloud.config.ts --workers=1"`，加 `"pb:isolation": "node tools/pb/isolation-check.mjs"`（以及可选的 `"pb:record": "node tools/pb/record-samples.mjs"`），不新增依赖。

**`playwright.cloud.config.ts`：**

```ts
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// 配置文件在 runner 进程里求值，worker 继承环境变量，所以这里设置就够了（不依赖 cross-env）
process.env.USJ_TEST_MODE = 'cloud';

export default defineConfig({
  ...base,
  testDir: './tests/cloud',
  workers: 1,
});
```

要点：不改 `playwright.config.ts`，默认 `npm test` 的 testDir 仍是 `./tests/e2e`，173 条不变。`webServer`、`use`（本机 Edge、死代理、解析规则、固定时钟、`serviceWorkers: 'block'`）全部随展开继承；`retries: 1` 也继承（flaky 视为缺陷的约定不变）。cloud 和默认入口共用 4789 端口且 `reuseExistingServer: false`，所以两个入口天然不能并发，符合“不并发”的要求。低优先级由调用方负责（和 v1 现状一致，STATE 里记的做法是以低于正常的优先级启动）；如果想让入口自带，可以另写一个很小的 Node 包装脚本，用 `os.setPriority` 把自己调成低优先级再 `spawn` Playwright 的 CLI，子进程在 Windows 上继承优先级类。这是可选的，不是必须。

**Phase 9 及以后：** `test:cloud` 要改成两步：先跑上面的 cloud 专属用例，再用 `USJ_TEST_MODE=cloud` 跑默认配置的 v1 用例（账户模式映射到 cloud）。Windows 下设环境变量要么用一个包装脚本，要么 cmd 与 PowerShell 写法不同，所以到时用包装脚本。

**`setOffline` 探针（写进 `tests/PROBES.md`，编号接 PROBE-9、10…）：** 要回答的问题和断言写死（观察值先记录再断言，不随观察值改写，同 PROBE-7、PROBE-8 的做法）。

| 子探针 | 怎么测 | 为什么要知道 |
|--------|--------|--------------|
| PROBE-9a | init script 里给 `window` 挂 `online`、`offline` 监听并计数；`context.setOffline(true)` 后读 `navigator.onLine` 和 `offline` 计数；`setOffline(false)` 后读 `online` 计数 | `setOffline` 是否派发事件、是否改 `navigator.onLine`（SC4 的明确要求）。Chromium 上我没有实测，所以结论不预设 |
| PROBE-9b | `setOffline(true)` 之后，页面对一个**被 route 接住并 fulfill 的**同源 `fetch('/api/…')` 是成功还是失败 | 我的预期是 route 层 fulfill 绕过网络层的离线模拟，请求仍然成功 [ASSUMED]。如果成立，Phase 10 的“断网”不能靠 `setOffline`，要由假服务器自己的开关（`route.abort('internetdisconnected')`）加手动派发 `offline` 事件加覆盖 `navigator.onLine` 来模拟 |
| PROBE-9c | 同时验证假 `EventSource` 在 `setOffline` 下不受影响（它不走网络） | 说明 SSE 断线也必须由假服务器显式触发 |

这几条探针只需要浏览器和一个已被 route 接住的同源地址，**放在 cloud 套件里**（`tests/cloud/probes-cloud.spec.ts`），不放进默认 `npm test`；`tests/PROBES.md` 开头写着“每次 `npm test` 都会运行”，要改成“PROBE-1 到 8 在 `npm test`，PROBE-9 起在 `npm run test:cloud`”。

### Anti-Patterns to Avoid

- **只断言状态码，不回读：** 规则同时是过滤器，错误的规则经常表现为“返回了 200 但数据是空的”。每条隔离断言都要用超级用户回读。
- **把 `403` 当成唯一的拒绝形态：** 锁定规则 403，列表规则不满足是 200 空列表，查看和更新不满足是 404，创建不满足是 400。断言要按这四种形态写。
- **在假服务器里“聪明地”补全 PocketBase 没做的事：** 假服务器只复述样本里有的行为；样本没有的，就返回 `null` 让 guard 报违规，逼着先去真实实例录样本。
- **让隔离脚本打印任何响应内容：** 响应里有令牌和邮箱。
- **在 `PB-CONTRACT.md` 里“引用一下”真实令牌：** 规则 F 会拦下，而且不接受放行名单。
- **用 `pocketbase/` 做目录名：** 被 `.gitignore` 整个忽略。
- **客户端更新时带 `owner` 或 `kind`：** 即使值没变，`:isset = false` 也会拒绝（404）。更新只发 `data` 和 `writer`。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 登录、令牌存储、记录读写、订阅与重连 | 自己写 fetch 封装和 SSE 重连 | 已批准的 SDK 0.28.1 | 被测对象就是应用和 SDK 的真实交互；重连间隔、`PB_CONNECT` 时序、自动取消都在 SDK 里 |
| 隔离脚本里的 SSE 解析（Node 端） | 引入 `eventsource` 之类的 npm 包 | 约 40 行的 `fetch` 加 `ReadableStream` 解析（`id:`、`event:`、`data:` 三行加空行） | 不新增依赖；Node 24 没有稳定的全局 `EventSource`；格式简单（`WriteSSE` 只有四行） |
| 令牌的签名和校验 | 假服务器里实现 JWT 签名 | 运行时拼三段、不签名，加 `exp` | SDK 只在本地读 `exp`，不验签；实现签名是多余的复杂度 |
| 密码哈希 | 假服务器里做 bcrypt | 内存里直接比较合成口令 | 假服务器不是安全边界，隔离由真实实例证明 |
| 规则表达式的求值 | 在假服务器里写一个 PocketBase 过滤语法解析器 | 只实现 `journey_docs` 和 `users` 的固定规则（硬编码为 owner 判断） | 规则语义的正确性由真实实例证明，假服务器只复述行为 |
| 下载和解压 | 自己写 zip 解析 | 只解出 `pocketbase.exe`：PowerShell 的 `Expand-Archive` 到一个全新的空目录，或 Git Bash 的 `unzip` | 本机有 PowerShell 和 `unzip`；Python 不可用（Windows 应用商店的占位程序）；Git Bash 的 `tar` 是 GNU tar，读不了 zip |
| 迁移的静态检查 | 正则匹配迁移文本 | `node:vm` 沙箱执行迁移，用假的 `Collection` 和 `app` 记录保存的内容 | 仓库已有先例（`tools/probe/schema-check.mjs`）；不需要二进制就能比对规则字符串 |

**Key insight:** 假服务器的价值是让后面阶段的测试快、可重复、不碰真实服务器；它**证明不了**规则正确。隔离的证据只能来自真实实例，所以两件事的交付物必须分开：断言矩阵属于真实实例，契约自测属于假服务器，两边共用同一份场景表，漂移才看得见。

## Runtime State Inventory

不适用（本阶段不是重命名、重构或迁移阶段；`us-journey-tracker.html` 不改，SAFE-02 基线不动）。

## Common Pitfalls

### Pitfall 1：以为 401 代表“令牌过期”
**What goes wrong:** 假服务器对过期令牌返回 401，应用按 401 处理“登录过期”，真实服务器却返回 200 空列表或 404。ARCHITECTURE 的“补拉返回 401 再弹登录”按这个理解写成了，Phase 10 会踩。
**Why it happens:** 无效令牌只被 `loadAuthToken` 当成“没有身份”，没有身份的请求再被规则过滤。只有挂了 `RequireAuth` 的接口（例如 `auth-refresh`）才返回 401。[CITED: apis/middlewares.go:184-209，91-100]
**How to avoid:** 假服务器按真实行为实现；应用判断“登录是否过期”要靠 `authRefresh()` 的结果或本地 `exp`，不要靠记录接口的状态码；保存时遇到 404 要先排除“令牌失效”。把这条写进 PB-CONTRACT 和给 Phase 10 的输入。
**Warning signs:** 假服务器的实现里出现“记录接口返回 401”。

### Pitfall 2：规则 F 拦下协议样本或假令牌
**What goes wrong:** 把真实登录响应原样写进样本，或在测试里写 JWT 字面量，提交被拦。
**How to avoid:** 见 Pattern 4 的归一化和三条自检；假令牌三段都在运行时拼接（PRIVACY.md §9）。
**Warning signs:** 样本文件里有 `eyJ`。

### Pitfall 3：规则 G 拦下口令字面量和超级用户命令
**What goes wrong:** 代码里把口令写成带引号的字面量、文档里写完整的超级用户创建命令（子命令后面跟两个参数），都命中规则 G。
**How to avoid:** 口令一律 `crypto.randomBytes(…).toString('hex')` 运行时生成；超级用户命令只用 `spawn` 的参数数组，说明文字里只写“创建超级用户的子命令”，不写后面跟着两个参数的完整形式；故意的错误口令也用运行时随机值，不写成 `wrong-password-1` 这种字面量。
**Warning signs:** `node tools/privacy/privacy-check.mjs --all` 报规则 G。

### Pitfall 4：`:isset = false` 比想象的严
**What goes wrong:** 以后客户端在更新时把整条记录（含 `owner`、`kind`）回传，全部 404，看起来像“记录不存在”。
**Why it happens:** `:isset` 只看请求里有没有这个键；`:changed` 才允许原值回传。
**How to avoid:** ROADMAP/SUMMARY 已经选了 `:isset`（更严）。把“更新只发 `data` 和 `writer`”写进 PB-CONTRACT 和 Phase 9 的输入；ACCT04-12 把这个行为固定下来；假服务器同样拒绝。

### Pitfall 5：令牌因密码或邮箱变化立刻失效
**What goes wrong:** 本人改密码或改邮箱（选 B）之后，本设备的旧令牌也失效了；SDK 的 `update()` 只合并记录，**令牌不变**，下一次请求就变成“未登录”（404 或空列表）。所有者在后台重置密码也一样，那个用户所有设备的令牌同时失效。
**Why it happens:** `onRecordSaveExecute` 在密码或邮箱变化时重新生成 `tokenKey`，令牌的签名密钥是 `tokenKey` 加集合的 `authToken.secret`。[CITED: core/record_model.go:1446-1456]
**How to avoid:** 隔离断言 TOK-2、D5-1、D5-6 覆盖；这是 D-06 要求核实的那一点，答案是“立即失效”。Phase 9、10 的应用在遇到 `authRefresh` 401 时回登录页，并且保留本机未上传的修改（ACCT-05）。

### Pitfall 6：新建 `users` 默认开放注册
**What goes wrong:** 不改规则，任何人都能注册；`authAlert` 默认还会尝试发信；`avatar` 是文件上传入口。
**How to avoid:** 迁移里显式 `createRule = null`、`deleteRule = null`，`authAlert.enabled = false`，删除或锁定 `name`/`avatar`；隔离断言 ACCT03-1、ACCT03-5（反向对照）。[CITED: migrations/1640988000_init.go:316-346]

### Pitfall 7：SDK 的 `isValid` 与假令牌的编码
**What goes wrong:** 假令牌的载荷用 base64url 编码，碰巧含 `-` 或 `_`，SDK 用原生 `atob` 解码失败（原生 `atob` 不接受这两个字符），载荷被当成空对象，令牌被判为过期，用例随机性地失败。我用 Node 本机验证过：`atob('ab-d')` 抛 `InvalidCharacterError`。
**How to avoid:** 假令牌载荷用标准 base64（`Buffer.toString('base64')` 去掉 `=`），原生 `atob` 接受缺失的填充；在 PB-CONTRACT 的“有意偏差”里写明。另外做一个小探针：把**录制得到的真实令牌**装进 SDK 的 `authStore`，断言 `isValid` 为真（只在录制脚本里做，不打印令牌）。[ASSUMED：真实令牌是否可能含 `-` 或 `_`，没有验证；真实用户量说明 SDK 在真实令牌上是工作的]

### Pitfall 8：同一个 context 里的两个页面不是两台设备
**What goes wrong:** 双设备用例用同一个 context 的两个 page，它们共用 `localStorage`（`pocketbase_auth`）并通过 `storage` 事件同步登录状态，用例结果不是“两台设备”。
**How to avoid:** 两台设备用两个 context，每个 context 都要挂 guard 和假服务器（所以把 guard 的挂接抽成函数）。Phase 8 先把函数抽好，双设备用例留给 Phase 10。

### Pitfall 9：`route.fulfill` 在请求被 SDK 取消之后抛错
**What goes wrong:** SDK 的自动取消在新请求到来时 abort 旧请求，路由处理函数晚一步调用 `route.fulfill`，抛出的异常变成测试进程里的未处理拒绝，用例随机红。
**How to avoid:** 处理函数里 `try { await route.fulfill(...) } catch {}`，并且只吞“请求已取消”这一类；写一个用例证明被取消的请求不会让用例失败。

### Pitfall 10：`setOffline` 不一定挡得住 route 接住的请求
见 Pattern 8 的 PROBE-9b。在探针结论出来之前，Phase 8 不要在任何用例里用 `setOffline` 来模拟断网。

### Pitfall 11：隔离脚本在 Windows 上留下孤儿进程或锁住的目录
**How to avoid:** 见 Pattern 2 第 10 点：`try/finally` 加信号处理、等 `exit`、`rmSync` 重试。实例启动失败时也要走清理路径。

### Pitfall 12：收紧护栏可能误伤现有用例
**What goes wrong:** 把应用来源下的放行范围收窄到三个路径后，浏览器自动请求的 `/favicon.ico` 之类变成违规。
**How to avoid:** 先把策略做成可切换的两档，cloud 配置先用 `cloud` 档；v1 收紧（补 WR-05）作为单独一个任务，收紧后整套 `npm test` 跑一遍再合入。

### Pitfall 13：本阶段的发现对 Phase 13 的提醒（不在本阶段处理）
- 4 MiB 的 PATCH 经过 nginx 时，默认 `client_max_body_size` 是 1 MB，会返回 413；Phase 13 要调大（至少 5 MB），并且要在线上用隔离脚本复验同一条断言。[ASSUMED：nginx 默认值是通用知识，Phase 13 要对着服务器上的实际配置核实]
- 实时订阅的 `POST /api/realtime` 会校验和 SSE 连接是同一个客户端 IP；经过代理时要让代理头配置正确（Phase 6 已经配了 `X-Real-IP`）。[CITED: apis/realtime.go:208-216]

## Code Examples

### 迁移：`users` 加固（时间戳只是示例）

```js
// pb/pb_migrations/1794096000_users_lockdown.js —— 只含结构，不含数据和凭据
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  // 注册和删号关闭（默认 createRule 是空字符串 = 任何人都能注册）
  users.createRule = null
  users.deleteRule = null
  // 只看自己；本人只能改密码（和 D-05 选 B 时的邮箱），不能改 verified、emailVisibility
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.updateRule = "id = @request.auth.id && @request.body.verified:isset = false && @request.body.emailVisibility:isset = false"
  users.manageRule = null

  // 只开邮箱加密码登录；OAuth2、OTP、MFA 明确关闭；新设备登录提醒会发信，关掉
  users.passwordAuth.enabled = true
  users.passwordAuth.identityFields = ["email"]
  users.oauth2.enabled = false
  users.otp.enabled = false
  users.mfa.enabled = false
  users.authAlert.enabled = false

  // 90 天（秒）；允许范围 10 到 94670856
  users.authToken.duration = 7776000

  // 去掉用不到的可写字段和文件上传入口
  users.fields.removeByName("name")
  users.fields.removeByName("avatar")

  app.save(users)
})
```

### 迁移：`journey_docs`

```js
// pb/pb_migrations/1794096100_journey_docs.js
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  app.save(new Collection({
    type: "base",
    name: "journey_docs",
    listRule: "@request.auth.id != \"\" && owner = @request.auth.id",
    viewRule: "@request.auth.id != \"\" && owner = @request.auth.id",
    createRule: "@request.auth.id != \"\" && @request.body.owner = @request.auth.id",
    updateRule: "@request.auth.id != \"\" && owner = @request.auth.id && @request.body.owner:isset = false && @request.body.kind:isset = false",
    deleteRule: null,
    fields: [
      { type: "relation", name: "owner", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "select", name: "kind", required: true, maxSelect: 1, values: ["state", "plan"] },
      // 不勾 required：JSON 字段的必填会拒绝 {} 之类“看起来为空”的值
      { type: "json", name: "data", maxSize: 4194304 },
      { type: "text", name: "writer", max: 40 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_journey_docs_owner_kind` ON `journey_docs` (`owner`, `kind`)"],
  }))
})
```

字段对象的写法（`type` 加属性）与探针迁移一致，已在 0.41.1 上跑通；`relation`、`json` 的属性名取自 JSVM 参考页。[CITED: pocketbase.io/jsvm/interfaces/core.RelationField.html、core.JSONField.html；VERIFIED: probe_schema.js:19-57 的写法]

### 一次性实例的启动（片段）

```js
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, openSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const dir = mkdtempSync(path.join(tmpdir(), 'usj-pb-'));
const log = openSync(path.join(dir, 'pb.log'), 'a');   // 输出只进日志文件，不回显
const child = spawn(
  PB_EXE,
  ['serve', `--http=127.0.0.1:${port}`, `--dir=${path.join(dir, 'pb_data')}`,
   `--migrationsDir=${MIGRATIONS_DIR}`, `--hooksDir=${path.join(dir, 'pb_hooks')}`, '--automigrate=false'],
  { stdio: ['ignore', log, log], windowsHide: true, env: { ...process.env, GOMAXPROCS: '2', GOMEMLIMIT: '256MiB' } },
);
// 就绪：轮询 /api/health；停止：child.kill() → 等 'exit' → rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 })
```

### 手写 SSE 客户端（Node 端，隔离脚本用）

```js
// 返回 { clientId, events, close }：events 是已收到的 { event, data }，用于“静默窗口”断言
export async function openSse(base) {
  const ac = new AbortController();
  const res = await fetch(base + '/api/realtime', { headers: { accept: 'text/event-stream' }, signal: ac.signal });
  const events = [];
  let waiter;
  const clientId = new Promise((resolve) => (waiter = resolve));
  (async () => {
    const dec = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const msg = { id: '', event: 'message', data: '' };
        for (const line of block.split('\n')) {
          if (line.startsWith('id:')) msg.id = line.slice(3).trim();
          else if (line.startsWith('event:')) msg.event = line.slice(6).trim();
          else if (line.startsWith('data:')) msg.data += line.slice(5);
        }
        if (msg.event === 'PB_CONNECT') waiter(msg.id); else events.push(msg);
      }
    }
  })().catch(() => {});
  return { clientId: await clientId, events, close: () => ac.abort() };
}
// 订阅：POST /api/realtime，body { clientId, subscriptions: ['journey_docs/*?options=' + encodeURIComponent(JSON.stringify({ query: { fields: 'id,kind,writer,updated' } }))] }
// 带 Authorization: <令牌>（没有 Bearer 前缀也行）；成功 204
```

### 假 `EventSource` 的骨架（页面侧，自包含）

```ts
export function installFakeEventSource(cfg: { binding: string }): void {
  const w = window as any;
  const rpc = async (op: string, arg: unknown) => JSON.parse(await w[cfg.binding](op, JSON.stringify(arg)));
  const live = new Map<string, any>();            // 连接 id → 实例
  class FakeEventSource extends EventTarget {
    readyState = 0; url: string; withCredentials = false;
    onopen: any = null; onerror: any = null; onmessage: any = null;
    private cid = '';
    constructor(url: string) {
      super();
      this.url = String(url);
      rpc('es.open', { url: this.url }).then((r) => {
        if (this.readyState === 2) return;
        this.cid = r.connectionId; live.set(this.cid, this); this.readyState = 1;
        this.fire('PB_CONNECT', JSON.stringify({ clientId: r.clientId }), r.clientId);
      });
    }
    fire(name: string, data: string, lastEventId: string) {
      const ev = new MessageEvent(name, { data, lastEventId });
      this.dispatchEvent(ev);
      const handler = (this as any)['on' + name];  // 'error' 等属性处理函数要手动调用
      if (typeof handler === 'function') handler.call(this, ev);
    }
    close() { this.readyState = 2; if (this.cid) { live.delete(this.cid); rpc('es.close', { connectionId: this.cid }); } }
  }
  w.EventSource = FakeEventSource;
  w.__pbEsDeliver = (cid: string, name: string, data: string, lastEventId: string) => live.get(cid)?.fire(name, data, lastEventId);
}
```

### 护栏的纯函数分类（示意）

```ts
export type RequestVerdict = 'allow' | 'font' | 'violation';
export function classifyRequest(url: string, policy: 'loose' | 'cloud'): RequestVerdict {
  const u = new URL(url);
  if (u.origin === APP_ORIGIN) {
    if (policy === 'loose') return 'allow';
    return ['/', '/us-journey-tracker.html', PB_SDK_PATH].includes(u.pathname) ? 'allow' : 'violation';
  }
  return FONT_HOSTS.includes(u.hostname) ? 'font' : 'violation';
}
```

### 归一化的核心（`.cjs`，示意）

```js
// 记录 id：15 位小写字母数字；时间戳：PocketBase 用空格分隔的格式
const ID_RE = /\b[a-z0-9]{15}\b/g;
const TS_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z/g;
// 三段令牌：先整体换成占位，再做别的替换（顺序很重要：令牌里可能含 15 位的字母数字片段）
const JWT_RE = /[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
function normalizeText(text, ctx) {
  return text
    .replace(JWT_RE, '<JWT>')
    .replace(TS_RE, '<TS>')
    .replace(ID_RE, (m) => ctx.idFor(m));   // 同一样本内同一 id → 同一占位
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PocketBase 发布在 GitHub，二进制和 `update` 命令都从 GitHub 来 | 0.41.0 起 Go 模块和发布都迁到维护者自己的站点；旧版本留在 GitHub | 2026-10-26（v0.41.0） | Windows 包只有单一来源和 `checksums.txt`，D-03 的 GitHub 交叉核对不适用 [CITED: 发布站的 v0.41.0 说明；GitHub 接口对 v0.41.1 返回 404] |
| 管理员叫 admin，管理员集合 | `_superusers` 认证集合；命令行 `superuser create|upsert|update|delete|otp|ips` | v0.23 起 | 一次性实例用命令行子命令创建超级用户 [CITED: cmd/superuser.go] |
| 用户注册默认开放 | 仍然默认开放（`createRule` 是空字符串） | 未变 | 必须显式关闭 |
| 自助改邮箱直接改字段 | 普通用户只能走邮件确认，除非有管理权限 | v0.23 起 | D-05 的核心冲突 |
| `:changed` 修饰符 | `:isset` 与 `:changed` 都可用，`:changed` 等价于 `(:isset = false || 值 = 原值)` | 文档当前版本 | 选 `:isset`（更严） [CITED: docs api-rules-and-filters] |

**Deprecated/outdated:**

- ARCHITECTURE 里的 `pocketbase/pb_migrations/` 目录：被 `.gitignore` 忽略，改用 `pb/pb_migrations/`。
- ARCHITECTURE Q5 里“补拉返回 401”的暗示：记录接口不返回 401（Pitfall 1）。
- STACK § 三（`journals` 单条双字段、`:changed`）：已被 SUMMARY 分歧表取代。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `users.authToken.duration = …`、`users.fields.removeByName(...)`、`users.manageRule = …` 这些 JSVM 写法在 0.41.1 上直接可用 | Pattern 1、Code Examples | 迁移保存失败；由 `migration-check.mjs` 加第一次真实运行暴露，成本低 |
| A2 | 新实例的 `rateLimits.enabled` 默认为假 | Pattern 2 | 密集登录被限流；脚本开头断言，不符时在临时实例上把它关掉 |
| A3 | `ACCT04-13`（`owner+`、`kind+` 等修饰符键）会被拒绝 | Pattern 3 | 如果能绕过 `:isset` 规则，是真实的隔离漏洞；这正是要实测的原因，失败时改规则（例如改用 `:changed` 或多加条件）再测 |
| A4 | 状态码标“实测定稿”的各项（ACCT04-9、-12、-15、-25，TOK-1 的 `exp` 取值，D5-6、D5-7） | Pattern 3 | 第一次真实运行后定稿，不影响设计 |
| A5 | 用 `node:vm` 执行 iife 做 SDK 驱动的录制可行 | Pattern 4 | 退回裸 `fetch` 录制；样本仍然可用，只是少了“SDK 发出的请求”这层证明 |
| A6 | 真实令牌的载荷编码不会导致 SDK 的原生 `atob` 失败 | Pitfall 7 | 极低：SDK 在真实令牌上能正常工作；录制脚本里有一次 `isValid` 的探测 |
| A7 | 收紧 v1 的护栏不会误伤现有 173 条用例（例如 `/favicon.ico`） | Pattern 7、Pitfall 12 | 个别用例变红；先在 cloud 档验证，v1 收紧单独成任务并整套回归 |
| A8 | `GOMAXPROCS=2`、`GOMEMLIMIT=256MiB` 对一次性实例合适 | Pattern 2 | 实例启动慢或内存紧；这两个值可以调 |
| A9 | Windows 防火墙对只绑定 127.0.0.1 的程序不弹窗 | Pattern 2 | 首次运行多一个弹窗；选择“取消”即可 |
| A10 | Playwright 在 CJS 下对动态 `import()` 一个 `.mjs` 的行为 | Alternatives | 已通过改用 `.cjs` 共享库绕开，不依赖它 |
| A11 | `route.fulfill` 绕过 `setOffline` 的离线模拟 | Pattern 8 | 由 PROBE-9b 直接回答；结论出来之前不依赖 |
| A12 | 4 MiB 的 PATCH 经 nginx 默认 1 MB 限制会返回 413 | Pitfall 13 | 只影响 Phase 13；到时对着服务器上的配置核实 |
| A13 | 本阶段读的源码是 v0.40.6，0.41.0、0.41.1 没有改动相关区域 | 全文 | 发布说明列出的改动只涉及 Go 模块迁移、`Extra` 字段、启动横幅、缩略图限制、邮件细节、字体许可证、依赖升级（已逐条读过）；仍以第一次真实运行为准，这就是断言矩阵的作用 |

## Open Questions (RESOLVED)

> 2026-11-08 规划时全部有了结论，每题下面一行是去向。

1. **OWNER-DECISION-1（自改邮箱）**
   - What we know: 普通更新接口做不到；官方流程要真实邮箱；收窄的 `manageRule` 可以不收邮件，代价是只凭令牌就能改邮箱。
   - What's unclear: 所有者要 A、B 还是 C。
   - Recommendation: 在规划前由编排器向所有者提问（选项见上）；没有答案时，规划按 A 写默认迁移，并把 B 的迁移文件和断言作为条件任务。
   - **RESOLVED：** 所有者选了 A，只让本人改密码，见 08-CONTEXT.md 的 D-05 修订。08-01 不写 `users_self_email` 迁移，08-05 用 D5-5 断言改邮箱被拒。

2. **OWNER-DECISION-2（下载批准）**
   - What we know: 来源、文件名、大小、sha256 都已读到；单一来源，没有第二份指纹。
   - What's unclear: 所有者是否接受单一来源的信任模型（与 Phase 6 的 D-16 相同）。
   - Recommendation: 规划里把下载做成一个 `checkpoint:human-action`（批准）任务，批准内容原样贴出上表；批准之前隔离脚本相关的任务停下，其余任务照常。
   - **RESOLVED：** 由 08-04 Task 2 的 blocking-human 批准检查点承接，批准文本写明来源只有一个、没有 GitHub 交叉核对；08-05 到 08-07 依赖真实实例的任务都有 precondition。

3. **`app` 的 cloud 路径还没有时，cloud 模式的 `ready()` 等什么？**
   - What we know: Phase 7 的 `USJ_CONFIG.backend` 非 null 会让应用显示“存储配置无效”。
   - What's unclear: Phase 9 的就绪条件。
   - Recommendation: Phase 8 的 cloud 模式只等 SDK 可用，不设置 `backend`；Phase 9 修改 `ready()`。
   - **RESOLVED：** 按建议执行。08-02 Task 1 的 cloud 就绪条件只等 SDK，Phase 9 再改。

4. **用 SDK 驱动录制，还是裸 `fetch` 录制？**
   - Recommendation: 先试 SDK-in-vm（A5），不行就退回裸 `fetch`；两种都能满足 SC3。
   - **RESOLVED：** 按建议执行。08-06 Task 1 先用 vm，不行再退回 `fetch`，退回时在 SUMMARY 里记录。

5. **cloud 专属用例放 `tests/cloud/` 还是 `tests/e2e/cloud/`？**
   - What we know: 放 `tests/e2e/cloud/` 会被默认 `npm test` 收到，除非改基础配置。
   - Recommendation: `tests/cloud/` 加独立 config，不改基础配置。
   - **RESOLVED：** 按建议执行。08-02 新建 `tests/cloud/` 和 `playwright.cloud.config.ts`，基础 `playwright.config.ts` 不动。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 隔离脚本、录制脚本、静态服务器 | ✓ | v24.20.0 | — |
| Microsoft Edge（Playwright 通道 `msedge`） | cloud 用例 | ✓（v1 已在用） | — | `PW_CHANNEL=chrome` |
| @playwright/test | cloud 用例 | ✓ | 1.64.1 | — |
| PocketBase Windows 二进制 | 隔离脚本、样本录制 | ✗（未下载，等批准） | 目标 0.41.1 | 无：没有它，TEST-04 和样本定稿无法完成；其余工作线可先做 |
| curl | 下载（批准后）、读校验文本 | ✓ | mingw64 版 | Node 的 `fetch` |
| sha256sum | 核对 | ✓ | Git Bash 自带 | Node 的 `crypto` |
| unzip / PowerShell `Expand-Archive` | 只解出 `pocketbase.exe` | ✓ | Git Bash 自带 unzip；Windows PowerShell | — |
| Python | — | ✗（只有应用商店的占位程序） | — | 不需要：Phase 6 的 `python3 -I -m zipfile` 做法在本机不适用 |
| GNU tar（Git Bash） | — | ✓ 但读不了 zip | 1.35 | 用 unzip 或 PowerShell |

**Missing dependencies with no fallback:**
- PocketBase Windows 二进制（等所有者批准）。

**Missing dependencies with fallback:**
- Python：不需要。

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | PocketBase 邮箱加密码登录，OAuth2、OTP、MFA 关闭；注册关闭；口令长度由 PocketBase 的口令字段约束（默认最短值 [ASSUMED]） |
| V3 Session Management | yes | 无状态 JWT，`authToken.duration` 90 天；密码或邮箱变化时 tokenKey 轮换使旧令牌失效；没有服务器端登出，登出就是丢弃令牌 |
| V4 Access Control | yes（本阶段的核心） | 集合 API 规则 `owner = @request.auth.id`；`deleteRule` 和 `users.createRule`、`users.deleteRule` 为 null；超级用户接口不对普通账号开放；由隔离脚本证明 |
| V5 Input Validation | yes | 字段类型和选择值、`data` 的 `maxSize` 4194304、`writer` 最长 40；唯一索引 |
| V6 Cryptography | yes | 不自己实现：口令哈希和令牌签名都由 PocketBase 做；假令牌只在测试里，不签名，不会进入线上 |
| V7 Error Handling and Logging | 部分 | 隔离脚本和录制脚本不回显任何令牌、口令、请求体和响应体；日志保留设置属于 Phase 13 |

### Known Threat Patterns for PocketBase + 浏览器 SDK

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 开放注册（默认 `createRule` 为空字符串） | Elevation of Privilege | 迁移显式 `null`；ACCT03-1、03-2，加反向对照 03-5 |
| 规则写错导致跨账号读写 | Information Disclosure / Tampering | owner 规则；断言矩阵加超级用户回读；反向对照 NEG-1 |
| 实时订阅泄漏他人事件 | Information Disclosure | `<集合>/*` 走 listRule，单条走 viewRule；RT-1 到 RT-3 |
| 创建时把文档建在别人名下，或更新时改 owner | Tampering / Spoofing | createRule 校验 `@request.body.owner`；updateRule `:isset = false`；ACCT04-7、04-10 到 04-13 |
| 令牌被偷（XSS）后改邮箱挤出本人 | Elevation of Privilege / Denial of Service | 选 A 则不存在；选 B 时需所有者接受，并保留后台重置 |
| 账号枚举 | Information Disclosure | 登录失败统一返回 400 `Failed to authenticate.`；PocketBase 对不存在的账号做了哑检查来抹平耗时 [CITED: apis/record_auth_with_password.go dummyPasswordCheck] |
| 超大请求体耗尽资源 | Denial of Service | `data` 4 MiB 上限；请求体上限是 32 MiB 加字段上限之和；服务器层限流和 nginx 限制属于 Phase 13 |
| 超级用户接口被普通账号访问 | Elevation of Privilege | ACCT04-25 |
| 样本和脚本把令牌或口令写进公开仓库 | Information Disclosure | 归一化加三条自检；规则 F、G；脚本不回显 |
| 一次性实例被局域网访问或留下进程 | Information Disclosure | 只绑定 127.0.0.1；随机端口；`finally` 里停止；数据放系统临时目录并删除 |

## Project Constraints (from CLAUDE.md)

- 前端保持原生 HTML/JS，不引入 React、Next.js；测试用 Playwright Test；本阶段不改 `us-journey-tracker.html`。
- 测试只用合成数据，运行时拦截所有外部请求；真实 PocketBase 只在一次性本机实例上运行，不进默认 `npm test`。
- 公开仓库里不放服务器地址、域名、密钥、后台密码、真实数据和个人计划文字；提交前跑隐私检查，不用 `--no-verify`。
- 本机只装项目内的 npm devDependency，用本机 Edge，不下载浏览器；测试低优先级、单 worker、不并发；不做全盘扫描。
- 下载 PocketBase 二进制必须先经所有者批准，批准时贴来源、文件名、大小和 sha256；子代理不得运行 `npx --no playwright` 以外的任何 npx。
- 服务器和域名的购买、注册、付款和密码输入由所有者本人完成；本阶段完全不碰所有者的服务器。
- 与所有者沟通用简体中文；代码、路径、标识符用英文。
- `.claude/CLAUDE.md` 要求通过 GSD 命令开始文件改动；本研究只写 `08-RESEARCH.md`。

## Sources

### Primary (HIGH confidence)

- 本仓库文件（本会话已 `Read`）：`08-CONTEXT.md`、`REQUIREMENTS.md`、`STATE.md`、`ROADMAP.md` Phase 8 段、`tools/probe/server/pb_migrations/probe_schema.js`、`tools/probe/server/02-install-pocketbase.sh`、`tools/probe/page/vendor/pocketbase.iife.js` 与 `README.md`、`tests/support/{app,test,constants}.ts`、`tests/support/static-server.cjs`、`tests/mocks/{claude-backend,claude-runtime}.ts` 与 `CONTRACT.md`、`tests/PROBES.md`、`tests/README.md`、`playwright.config.ts`、`package.json`、`PRIVACY.md`、`tools/privacy/privacy-check.mjs`（规则 A、F、G）、`.gitignore`、`.planning/research/{ARCHITECTURE,PITFALLS,SUMMARY}.md`
- PocketBase 源码 v0.40.6（GitHub 原始文件，已读）：`forms/record_upsert.go`（`oldPassword`、邮箱和 `verified` 的校验）、`apis/record_crud.go`（更新流程、`hasAuthManageAccess`、请求体上限）、`apis/middlewares.go`（`loadAuthToken`、`requireAuth`）、`apis/middlewares_body_limit.go`、`apis/realtime.go`（PB_CONNECT、订阅、规则映射、`fields` 裁剪）、`apis/record_auth_with_password.go`、`apis/record_helpers.go`（`authAlert`、MFA）、`core/record_model.go`（`RefreshTokenKey` 的触发）、`core/field_json.go`（`maxSize`）、`core/validators/db.go`（唯一索引错误归一化）、`core/validators/equal.go`、`core/collection_model_auth_options.go`（默认值和范围）、`migrations/1640988000_init.go`（`users` 默认值）、`tools/subscriptions/message.go`（SSE 格式）、`pocketbase.go` 与 `cmd/serve.go`、`cmd/superuser.go`、`examples/base/main.go`（命令行参数）
- 维护者发布站：v0.41.1 和 v0.41.0 发布记录与说明、`checksums.txt` 全文、Windows 包的 HEAD 响应（本会话 curl 只读）；GitHub 发布接口对 v0.41.1 返回 404

### Secondary (MEDIUM confidence)

- pocketbase.io/docs：`api-rules-and-filters`（规则语义、状态码、修饰符）、`api-records`（`oldPassword`、认证端点、错误形状）、`api-realtime`（SSE 与订阅）、`authentication`、`js-migrations`、`js-collections`；pocketbase.io/jsvm 的 `Collection`、`core.JSONField`、`core.RelationField` 参考页（文档页面是通过摘要工具读取的，所以关键结论都另外用源码核对过）

### Tertiary (LOW confidence)

- 未经核对的运行时表现：Windows 防火墙行为、`GOMAXPROCS`/`GOMEMLIMIT` 取值、nginx 默认请求体限制、SDK 在 `node:vm` 中运行（见 Assumptions Log）

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 版本、哈希、大小来自本会话读取的一手资料；无新依赖
- 规则和隔离设计: MEDIUM-HIGH — 语义由源码和文档核实；`:isset` 修饰符绕过、几个状态码和 JSVM 写法必须由真实实例定稿，已给出断言
- 假服务器和 cloud 模式: MEDIUM — 协议面来自 SDK 源码；`setOffline` 行为、护栏收紧的副作用要探针和整套回归确认
- Pitfalls: HIGH — 多数来自读到的源码或本机验证

**Research date:** 2026-11-08
**Valid until:** 2026-12-08（PocketBase 0.x 次版本有不兼容变化的先例；换版本要重新核对，也要重新批准下载）
