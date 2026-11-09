---
phase: "08"
slug: "pocketbase-rules-isolation-fake-server"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-08"
---

# Phase 08 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只连接本机 127.0.0.1 上的一次性 PocketBase 实例和 Node 侧假服务器，不连接任何真实服务器。只有真实实例才能证明的检查（ACCT03-*、ACCT04-*、RT-*、D5-*、TOK-*、NEG-1、REPLAY-1），判断依据有两条，缺一不可：一是断言确实写在 `tools/pb/isolation-check.mjs` 里，二是有记录的通过运行（48/48：核对代理自己跑过一次，评审修复后又跑过两次；WR-01 之前跑过两次 47/47）。本文件不含服务器地址、域名、邮箱、口令或令牌。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 迁移文件 → PocketBase 服务端 | 迁移决定线上谁能注册、谁能读写哪条记录；Phase 13 原样复制到服务器 | 集合结构和访问规则（决定授权） |
| 公开仓库 → 任何读者 | 迁移、快照、样本和契约文档公开 | 只能有结构和合成数据，不能有数据或凭据 |
| 浏览器页面 → 网络 | cloud 用例里页面发出的请求只能到应用来源 | 请求和响应（只用合成数据） |
| 仓库内的 SDK 文件 → 页面 | 页面执行的第三方代码 | 可执行代码，字节必须是所有者批准的那份 |
| 测试源码 → 公开仓库 | 假令牌、合成口令不能以字面量进仓库 | 凭据形状的字符串 |
| 浏览器页面 → 应用来源的其他路径 | 收紧前应用来源下任何路径都放行（WR-05） | 仓库文件内容 |
| 页面 → 实时连接 | EventSource 如果不被假 EventSource 接住，会真的连出去 | 实时事件流 |
| 维护者发布站 → 本机 | 第三方可执行程序进入本机并被运行 | PocketBase 0.41.1 Windows 程序（单一来源） |
| 一次性实例 → 本机网络 | 实例的端口不能被局域网访问 | 合成账号、合成文档 |
| 实例的凭据和日志 → 仓库与终端 | 超级用户口令和令牌不能落到被跟踪的文件或终端 | 运行时随机凭据（高敏感） |
| 账号 A → 账号 B 的数据 | 规则必须挡住跨账号的读、列、改、删和实时事件 | 每个账号的计划和记录文档 |
| 普通账号 → 超级用户接口 | 网页上拿到的令牌不能碰管理接口 | 管理操作 |
| 隔离脚本 → 终端输出 | 响应里有令牌和邮箱 | 令牌、合成邮箱、响应体 |
| 真实实例的响应 → 公开仓库 | 录下的协议样本会被提交 | 真实签发的令牌、时间、id、邮箱（必须先归一化） |
| 隐私检查器 → git 钩子 | 改动入口后，钩子必须仍然真的运行检查 | 暂存区内容 |
| 真实样本 → 假服务器 | 后续所有 cloud 测试的可信度取决于假服务器是否如实复述真实行为 | 状态码、键集合、正文形状 |
| 测试结论 → 后续阶段 | 假服务器偏宽会让 Phase 9–12 的用例变绿而线上失败 | 授权判断 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-08-01 | Elevation of Privilege | users 默认开放注册（createRule 为空字符串） | high | mitigate | 迁移把 `createRule` 写成 null（1794096000_users_lockdown.js:9）；migration-check 要求严格等于 null，自检把它改成空字符串必须报出（19/19）；真实实例 ACCT03-1 到 ACCT03-5 含 `users_open` 反向对照，48/48 | closed |
| T-08-02 | Elevation of Privilege | manageRule 放开后可免旧密码改口令、改邮箱 | high | mitigate | `manageRule` 为 null（users_lockdown.js:15），有不变量和自检；D5-2（缺旧密码返回 400）、D5-5（改邮箱返回 400，回读不变）实测通过 | closed |
| T-08-03 | Tampering | 迁移与快照漂移，规则被悄悄放宽 | medium | mitigate | 快照比对加不变量（migration-check.mjs、rules-snapshot.mjs）；smoke 和 REPLAY-1 用同一个 `snapshotFromLive` 对真实实例比对，差异为 0 | closed |
| T-08-04 | Information Disclosure | 迁移里混入数据、账号或凭据 | medium | mitigate | 沙箱不提供记录接口，保存非集合对象判 `data-in-migration`，碰 `app.settings` 判错；隐私规则 C、F、G 由 pre-commit 钩子执行；两份迁移里没有记录、邮箱、口令或令牌 | closed |
| T-08-05 | Information Disclosure | cloud 用例连到真实服务器 | high | mitigate | 假服务器只接应用来源下的 `/api/`（pb-server.ts）；未实现的路径 `route.fallback()` 落回护栏，护栏中止并记违规，收尾时让用例失败（tests/support/test.ts）；cloud 配置继承基础配置的解析规则和死代理 | closed |
| T-08-06 | Tampering | 同源 SDK 被改动或换版本 | high | mitigate | 静态服务器启动时按 SHA256SUMS 核对，不一致在 listen 之前退出 1（static-server.cjs）；ENV-03 断言正文哈希，并用改过一个字节的临时副本证明拒绝启动；仓库里只有一份 SDK，本阶段没有改动 | closed |
| T-08-07 | Information Disclosure | 假令牌或口令以字面量进入仓库 | medium | mitigate | 假令牌三段运行时拼接、签名随机；口令用 `randomBytes`；隐私规则 F、G；本阶段没有改推送例外清单，没有加放行名单 | closed |
| T-08-08 | Repudiation | 假服务器比真实实例宽松 | medium | mitigate | 每种拒绝形态都有用例（cloud-harness.spec.ts）；pb-contract.spec.ts 对照真实样本；偏差登记在 PB-CONTRACT.md §5 | closed |
| T-08-09 | Information Disclosure | 应用来源下的非白名单路径被放行（WR-05） | medium | mitigate | `classifyRequest` 两档白名单；v1（guardrails.spec.ts）和 cloud（guard-cloud.spec.ts）各有故意违规用例；静态服务器对白名单外路径返回 404，由 ENV-03 断言 | closed |
| T-08-10 | Repudiation | 假服务器没实现的调用被静默放过 | medium | mitigate | 用例断言这条请求在护栏的违规列表里、不在 `fake.requests` 里（guard-cloud.spec.ts） | closed |
| T-08-11 | Information Disclosure | 页面用真实 EventSource 向外建立实时连接 | medium | mitigate | 真实 `EventSource('/api/realtime')` 被记为违规（故意违规用例）；外部主机另有解析规则和死代理兜底 | closed |
| T-08-12 | Denial of Service | 本机资源被测试拖慢 | low | mitigate | cloud 配置 `workers: 1`，`test:cloud` 脚本带 `--workers=1`，默认套件每次手动加 `--workers=1` 并以低优先级启动；每个计划最多跑一次完整套件；Node 工具自行降低优先级 | closed |
| T-08-13 | Tampering | 下载的 PocketBase 程序被篡改（单一来源） | high | mitigate | 下载前阻塞式人工批准（2026-11-08）；zip 大小和 sha256 钉死，checksums.txt 两行核对（含 Phase 6 linux 钉死值），核对成员名单，只解出 pocketbase.exe（fetch-local-pb.mjs）；exe 哈希钉死并在每次启动前核对（instance.mjs）；单一来源的残余风险见 AR-03 | closed |
| T-08-14 | Information Disclosure | 实例被局域网访问 | medium | mitigate | `--http=127.0.0.1:<随机端口>`；smoke 对每个非内部 IPv4 断言连不上；自检断言没有 0.0.0.0 | closed |
| T-08-15 | Information Disclosure | 超级用户凭据或令牌泄露到文件、终端 | medium | mitigate | 凭据运行时随机、只在内存；创建超级用户走参数数组、不经 shell；子进程输出只进临时目录里的日志，随目录删除；smoke 输出没有令牌形状和邮箱 | closed |
| T-08-16 | Denial of Service | 残留进程或被锁住的临时目录 | low | mitigate | finally、SIGINT、exit 三处停止子进程；`rmSync` 带重试；smoke 断言目录已删，tasklist 确认没有残留进程；PB-LOCAL.md 写了手动清理办法 | closed |
| T-08-17 | Information Disclosure | 规则写错时表现为“返回空”，跨账号读取看不出来 | high | mitigate | 读类断言由超级用户回读，确认被隐藏的记录确实存在（ACCT04-1、-2、-3、-18、-21、-22）；NEG-1 在故意写错的集合上必须报出泄漏 | closed |
| T-08-18 | Tampering | 用字段修饰符或原值回传绕过 owner、kind 防改写 | high | mitigate | ACCT04-10 到 ACCT04-13：更新时带 `owner+`、`+owner`、`owner-`、`kind+` 一律 404，回读不变；WR-01 修复后加 ACCT04-27（创建时 8 种请求体、每种 6 次、交替键序、超级用户回读），并有 NEG-1 泄漏对照；48/48。创建时 `kind+` 在本人账号内改类型的残余见 AR-02 | closed |
| T-08-19 | Information Disclosure | 实时订阅泄漏别人的变更 | high | mitigate | RT-1 到 RT-3 先做正向对照，再等 1.5 秒静默窗口；RT-5 换身份订阅返回 403；RT-7 覆盖 `users/*` 和单条主题；NEG-1 含 RT-1 和 RT-7（`users_leaky`）泄漏对照 | closed |
| T-08-20 | Elevation of Privilege | 普通账号进入超级用户接口或自助注册 | high | mitigate | ACCT03-1 到 ACCT03-5（含反向对照）；ACCT04-25：5 个管理接口返回 403，`_superusers` 登录返回 400 | closed |
| T-08-21 | Spoofing | 旧令牌在改密码或后台重置后仍可用 | medium | mitigate | D5-1（改密码后旧令牌 auth-refresh 返回 401）、TOK-2（后台重置后同样返回 401） | closed |
| T-08-22 | Information Disclosure | 隔离脚本输出令牌、口令、邮箱或响应体 | medium | mitigate | 输出只经 `formatLine`、`formatObserve`，只留编号、名字、状态码和经校验的错误码；自检用运行时拼接的令牌、邮箱、响应体证明不泄露；所有输出调用都经格式化函数或是固定文案 | closed |
| T-08-23 | Information Disclosure | 真实令牌进入样本或契约文档 | high | mitigate | 按键和按形状两层归一化（normalize.cjs）；写盘前令牌开头子串和 `findTokenShapes` 闸门（record-samples.mjs）；反向对照自检；`--check` 复跑结果 CLEAN | closed |
| T-08-24 | Tampering | 隐私检查器入口保护失效，钩子静默放行 | high | mitigate | `isEntryScript` 两侧都用 realpath，win32 上不区分大小写，判断出错时照常运行（fail closed）；自检 193 项通过；hook-drill 在临时仓库里证明违规提交仍被拦下；WR-02 把同样的保护推广到 pb 工具（tools/pb/lib/entry.mjs） | closed |
| T-08-25 | Information Disclosure | 口令或邮箱出现在样本里 | medium | mitigate | 口令键换成 `<PASSWORD>`，邮箱换成保留域名地址；`--check` 扫规则 B、C、F、G、H，命中为零 | closed |
| T-08-26 | Repudiation | 样本不能复现 | low | mitigate | 样本元数据写明服务器版本、SDK 版本、exe 和 SDK 的 sha256、录制客户端；三次录制按键排序后逐字节相同 | closed |
| T-08-27 | Repudiation | 假服务器与真实实例漂移 | medium | mitigate | 契约自测与录制共用 scenarios.cjs 和 normalize.cjs；逐个比较状态码、顶层键、归一化正文、请求和令牌声明；有意偏差列表为空 | closed |
| T-08-28 | Elevation of Privilege | 假服务器放行真实实例会拒绝的请求 | high | mitigate | 状态码从不跳过，禁止登记状态码偏差；8 类拒绝场景（别人为 owner、带 owner 键、带 kind 键、读别人的、改别人的、超大、删除、换身份订阅）都在契约里；test:cloud 44/44 | closed |
| T-08-29 | Information Disclosure | 样本或契约文档里出现令牌 | medium | mitigate | 版本一致性用例断言样本里没有令牌开头的子串并核对钉死的版本；`--check` 和 `--all` 隐私检查通过 | closed |
| T-08-30 | Denial of Service | 收尾的完整运行拖慢本机 | low | mitigate | 低优先级、`--workers=1` 只跑一次 test:cloud；默认 npm test 只由执行阶段的回归门跑一次 | closed |
| T-08-SC-PB | Tampering | 外部程序下载（PocketBase 程序，08-04） | high | mitigate | 08-04 Task 2 的阻塞式人工检查点，不可自动批准，所有者已批准；下载放进新建的空 `mkdtemp` 目录，大小、校验和、成员名单核对通过后才解压；必须带 `--approved` 才运行 | closed |
| T-08-SC | Tampering | npm、pip、cargo 安装（08-01、02、03、05、06、07） | low | accept | 本阶段 package.json 只改了 `scripts`，devDependencies 仍只有 `@playwright/test` 1.64.1，lock 文件没动；SDK 沿用 06-05 已批准、哈希钉死的文件，在 node:vm 里执行前核对 SHA256SUMS。见 AR-01 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-08-SC | 本阶段不安装任何 npm、pip、cargo 包。唯一的下载是 T-08-SC-PB 那次经批准的 PocketBase 程序，SDK 复用 06-05 已批准、哈希钉死的文件。审计没有发现与此矛盾的安装或下载记录 | 所有者（批准阶段计划时的处置） | 2026-11-08 |
| AR-02 | T-08-18 | 新建文档时带 `kind+` 修饰符键，可以让创建者在**自己的账号内**把 `kind` 从 plan 变成 state。规则语法表达不了这种禁止。`owner` 永远不变，值仍受选项和 `(owner, kind)` 唯一索引约束，A 本来就能直接创建 state，没有额外能力。不加 `pb_hooks`。隔离脚本把它记为 `kindshift`，不算泄漏。应用的创建请求不带修饰符键（PB-CONTRACT.md 第 7 节） | 所有者（STATE.md、08-VERIFICATION.md 有记录） | 2026-11-08 |
| AR-03 | T-08-13 | PocketBase 0.41.1 的 Windows 包只在维护者自己的站点发布。checksums.txt 与 zip 同站、没有签名，只能防下载损坏，防不了发布站本身被入侵。弱补强：同时核对 linux_amd64 那一行仍等于 Phase 6 钉死的值。这与 06 D-16 是同一个信任模型，批准下载时已如实告知所有者（tools/pb/PB-LOCAL.md「信任模型」） | 所有者（08-04 批准下载时） | 2026-11-08 |

*Accepted risks do not resurface in future audit runs.*

---

## 残余风险（不阻塞，记下备查）

审计认为下面这些都不影响威胁关闭，记下备查。IN 编号对应 08-REVIEW.md，处理状态以 08-REVIEW-DISPOSITION.md 为准（均为未修的 INFO）。

- **IN-02（T-08-02）：** 邮箱不能自己改，靠的是 PocketBase 核心的行为，规则里没有 `@request.body.email:isset = false` 这第二道保护；本人用 PATCH 改 tokenKey 也没有单独断言。
- **IN-01（T-08-03）：** `normField` 把关系字段的 `collectionId` 固定写成 `<users>`。如果关系目标漂移，快照比对看不出来，但隔离脚本的准备步骤会失败。
- **IN-04（T-08-13）：** exe 复制后没有立即重新算哈希。每次启动前都会核对，所以不影响使用。
- **IN-03（T-08-16）：** 只有 smoke 检查清理是否失败，其他场合清理失败不会报出来；也没有单实例锁。
- **IN-05（T-08-24）：** `process.argv[1]` 为空时 `isEntryScript` 返回 false，跟“出错时照常运行”的注释不一致。git 钩子总会传路径，所以钩子走不到这里。
- **IN-06（T-08-11）：** 用例断言的是 Edge 控制台的原文，比较脆弱，但不是安全缺口。
- **IN-07（T-08-12、T-08-30）：** 测试的低优先级只靠启动方式保证（低优先级启动器），Playwright 配置里没有降优先级的代码。`npm run test:cloud` 带 `--workers=1`，cloud 配置也是 `workers: 1`；但默认的 `npm test` 就是 `playwright test`，用基础配置的 `workers: 2`（v1 D-17），本阶段每次都是手动加 `--workers=1` 运行的。
- **IN-08：** 只涉及测试稳健性。
- **T-08-15：** 创建超级用户的那一瞬间，口令会出现在子进程的命令行参数里，同一用户的其他进程看得到。只限本机，且是一次性的随机口令。
- **T-08-06：** SDK 只在静态服务器启动时核对一次，之后每次请求都重新读文件。ENV-03 断言了实际返回内容的哈希，L1 下视为覆盖。
- **T-08-18：** 更新时 `+kind` 和 `kind-` 没有逐个断言（`owner+`、`+owner`、`owner-`、`kind+` 都有）。

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-08 | 32 | 32 | 0 | gsd-security-auditor（ASVS L1，block_on high；逐条核对，4 项离线自检通过：migration-check MATCH、迁移自检 19 项、隐私检查自检 193 项、样本 `--check` CLEAN） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-08
