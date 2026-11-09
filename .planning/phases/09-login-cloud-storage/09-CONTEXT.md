# Phase 9: 登录与云端存储（Login & Cloud Storage） - Context

**Gathered:** 2026-11-08
**Status:** Ready for planning

<domain>
## Phase Boundary

用户用所有者在后台开好的账号登录（邮箱形式，没有注册入口）。登录后，记录、复盘、任务进度、力量历史和自己的个人计划都从服务器读写，换一台设备登录看到的是同一份数据。打开应用时先和服务器对账，再允许编辑，过期缓存不会覆盖别处的新数据；真冲突时以最后保存的为准，被覆盖的那一版在本机留底、可以下载。页面只加载同源资源：去掉 Google 字体，PocketBase SDK 同源加载、版本固定。

需求：ACCT-01、ACCT-02、SYNC-01、SYNC-05、PLAN-01、INFRA-03。

不在本阶段（属于 Phase 10）：断网时照样记录和待上传计数（SYNC-03）、实时同步（SYNC-02）、状态栏五种状态的完整行为（SYNC-04）、保存失败自动重试（SYNC-06）。本阶段的 UI 契约要先把状态栏五种状态和远端更新提示的文案、位置定下来，Phase 10 直接沿用。

</domain>

<decisions>
## Implementation Decisions

### 沿用的决定（来自路线图、调研和前几个阶段，本次不再讨论）

- 登录标识是邮箱形式（PocketBase 默认 identity），不发邮件。普通账号只能自己改密码，但本里程碑不做改密码界面（08-CONTEXT D-04、D-05、D-07）。
- 令牌有效期 90 天。SDK 0.28.1 不给普通用户自动续期，所以每次联网启动都调用 `authRefresh()`。判断登录过期只看 `authRefresh` 返回 401（或本地令牌的 `exp`），不看记录接口的状态码，因为记录接口对无效令牌返回 200 空列表、404 或 400（PB-CONTRACT.md §9）。
- 数据模型是 `journey_docs`：每个账号两份文档，`kind` 为 `state` 和 `plan`，`(owner, kind)` 唯一索引，客户端不能删除。应用按 `kind` 取文档，不依赖列表顺序。更新请求只发 `data` 和 `writer`，不回传 `owner`、`kind`。
- 账号第一次登录时，由客户端用 `DEFAULT_PLAN` 和空 state 创建两份文档；遇到唯一索引冲突（400，`validation_not_unique`），就重新读取再更新。新账号从示例计划起步（07-CONTEXT D-01）。
- 冲突策略是整份文档、最后保存的为准，并带三项保护：对账完成前禁止编辑；上传前比对基线 `updated`；真冲突时被覆盖的版本在本机留底、可下载。比较新旧一律用服务器签发的 `updated`，不用客户端时钟。真冲突时对 logs 按 id 取并集的升级不做。
- 路线图列出的必修项随本阶段落地：
  - `pb.autoCancellation(false)`；
  - 每次联网启动调用 `authRefresh()`；
  - 登出顺序：先退订，再清缓存，最后清令牌；
  - 去掉 `init()` 里“加载失败就静默回退本机”的逻辑；
  - 保存前检查文档大小，超过上限（4 MiB）的 70% 时提示。
- 去掉 Google 字体的 `<link>`，改用现有的 `Songti SC`、`STSong`、Georgia 回退字体。外观在调研阶段已被所有者接受。
- SDK 用已批准的 0.28.1 `pocketbase.iife.js`，同源加载，sha256 钉死，不走 npm，也不走 CDN（06-CONTEXT D-15；Phase 8 已在 `/vendor/pocketbase.iife.js` 同源提供）。
- 配置缝 `USJ_CONFIG.backend`：没配后端时走旧的 `window.claude` / localStorage 路径，v1 的 154 条用例仍走这条路径。
- 四个视图的界面和操作方式不变，只加登录页，以及下面各决定所需的提示、确认框和入口。
- 所有用例都跑在 Phase 8 的假服务器上，多台设备用独立的浏览器上下文模拟；只用合成数据，不连真实服务器。

### 打开应用时的对账门控

- **D-01:** 对账期间先用本机缓存显示上次的内容，所有编辑入口暂时禁用，状态栏写“正在和服务器对账…”，对账完成后放开。
  - 编辑入口包括：记录输入、预设标签、编辑弹窗、勾选任务、拖拽、复盘框、力量保存、到达日期等。
  - 没有缓存时（这台设备第一次登录，或退出后重新登录），先显示等待状态，对账完成后再渲染。
- **D-02:** 对账超过约 3 秒还没完成，状态栏改为“网络较慢，还在连…”，继续等待；约 15 秒仍未完成，才算连不上（按 D-03 处理）。
  - 秒数是大约值，规划可以微调，但不能 3 秒就判失败。
  - 理由：Phase 6 实测国内到香港 Ping 约 300–400 毫秒，慢的时候对账会超过 3 秒。
- **D-03:** 联网却连不上服务器时（超时、网络错误、服务器 5xx），有缓存就只读显示上次的内容，不能编辑；状态栏写明连不上服务器，并给出“重试”按钮，连上并对账成功后自动放开编辑。没有缓存时，只显示连不上和重试。
  - 这与 `.planning/research/ARCHITECTURE.md` §Q3 写的“超时或失败则放开编辑，按离线处理”不同，本阶段以所有者的决定为准。
  - Phase 10 做断网记录（SYNC-03）时，再升级成断网也能编辑。
- **D-04:** 对账后用服务器版本替换了本机缓存的内容，并且两者确实不同（比如刚在手机上记过一笔）时，弹一个短提示，例如“已更新为其他设备上的最新内容”，具体文案由 UI 契约定。
  - 没有缓存（第一次在这台设备登录），或服务器与缓存相同，不提示。

### 退出登录与登录页

- **D-05:** 点“退出登录”时，如果有修改还没保存到服务器上，或者还有没下载的冲突留底，就弹确认框说明会丢失什么，让用户选“取消”或“仍然退出”；两样都没有就直接退出。
  - “没保存上去的修改”指防抖中、保存中或保存失败的修改。
  - 不自动等待保存完成，这是所有者的选择。确认框的形式和文案由 UI 契约定。
- **D-06:** 确认退出后按路线图的顺序：先退订实时，再清掉该账号在本机的记录缓存、计划缓存和冲突留底，最后清令牌，然后回到登录页。
- **D-07:** 登录页一直预填上次成功登录的邮箱，主动退出后也保留。
  - 这是退出后本机唯一保留的账号信息。它只是登录标识，不属于 ACCT-02 和成功标准 2 所说的“记录缓存、计划缓存和令牌”；下一个账号登录成功后就被替换。
  - 成功标准 2 的用例按此编写：A 退出后，断言本机没有 A 的记录缓存、计划缓存、冲突留底和令牌；B 登录后看不到 A 的任何内容。B 登录前，登录页预填着 A 的邮箱，这是所有者选定的行为，不算泄漏。
  - 所有者明确选了这一项，没有选推荐的“只在登录过期时预填”，接受了共用设备时别人能看到上次登录邮箱的代价。

### 冲突留底

- **D-08:** 真冲突指：上传时服务器版本已经比本机的基线 `updated` 新。这时按最后保存的为准上传本机版本，被覆盖的服务器版本在本机留底。告知方式有两处：
  - 当下弹提示，说明“另一台设备上的修改被覆盖，已留底”，提示里带下载按钮；
  - 提示几秒后会消失，所以页面上另外常驻一个“下载留底”入口，只在有留底时显示。位置由 UI 契约定，建议放在导出按钮那一栏。
  - 本阶段还没有实时同步，同一账号的两台设备同时开着时，后保存的那台就会触发真冲突。这条路径必须有 cloud 用例覆盖。
- **D-09:** 每个账号在本机只留最近 1 份留底，新的冲突替换旧的。所有者选了这一项，没有选推荐的 3 份。
- **D-10:** 点下载就立即从本机删掉留底，入口随之消失。
  - 所有者已知情并接受：页面无法确认文件真的存好了（浏览器可能拦截下载，用户也可能取消保存框），这种情况下留底就没了。
  - 退出登录时同样清掉留底（D-05 会先提醒）。
- **D-11:** 下载的文件是 JSON，内容是被覆盖的那份文档数据。`state` 文档用与现有“备份”相同的整份 state 形状，以便 Phase 11 的导入功能可以恢复它。文件名里不能出现邮箱或其他账号标识。

### Claude's Discretion

- **登录过期后的本机缓存**（所有者说“你来定”），按以下处理，理由是不丢本人的修改，同时换账号时满足 ACCT-02 的隔离，这也与调研 §Q5 一致：
  - `authRefresh` 返回 401 时，清令牌，回到登录页，提示“登录已过期，请重新登录”，邮箱预填；
  - 该账号在本机的缓存保留，包括未上传的修改和冲突留底；同一账号重新登录后照常对账、上传；
  - 换另一个账号登录时，先清掉前一个账号的全部本机数据。如果前一个账号还有未上传的修改或留底，先提示会丢失。
- 连不上时，除了手动“重试”按钮，要不要在后台自动重试（例如收到 `online` 事件时）。Phase 10 会做退避重试，本阶段至少要有手动重试。
- 缓存的键名和值的结构、对账表的实现：参考 ARCHITECTURE §Q3 的键名 `usj:v2:<userId>:state|plan` 和 7 行对账表，但超时行为以 D-02、D-03 为准，“真冲突”行的提示以 D-08 为准。
- 冲突留底存在 localStorage 还是 IndexedDB；存储空间不够时，要明确告诉用户，不能悄悄失败。
- 云端路径的下载机制：云端没有 Claude 的 `downloads` 能力，可以用 Blob 加 `<a download>`。
- 同一浏览器两个标签页登录同一账号时，在一个标签页退出，另一个跟着退出。SDK 的 `LocalAuthStore` 通过 storage 事件同步，可以配合 `authStore.onChange`。
- 登录页的错误提示区分“邮箱或密码不对”和“连不上服务器”，具体文案由 UI 契约定。

### 规划时要注意的事

1. **UI 契约先行：** 规划之前先跑 `/gsd-ui-phase 9`。除了路线图要求的登录页、状态栏五种状态和远端更新提示，还要覆盖本次讨论新增的界面：
   - D-01 到 D-03 的“对账中 / 网络较慢 / 连不上加重试”；
   - D-04 的更新提示；
   - D-05 的退出确认框；
   - D-08 的冲突提示和常驻下载入口；
   - 登录过期提示；
   - 退出按钮的位置。
2. **与调研文档不同的两处，以本文件为准：**
   - ARCHITECTURE §Q3 的“超时放开编辑”，改为 D-03；
   - §Q3 对账表“真冲突”行写的“旧版本可在设置里导出”，改为 D-08 到 D-10。
3. **`init()` 的静默回退：** 路线图要求去掉它。规划时确认云端路径不再有这条回退，同时 v1 旧路径的 154 条用例结果不变。
4. **字体相关的探针和护栏：** 去掉字体 `<link>` 后，v1 里与字体有关的探针（PROBE-2）和网络护栏断言要随之调整（成功标准 5），并且有意识地更新应用的 sha256 基线。
5. **成功标准 2 的写法：** 按 D-07 编写。
6. **错误注入：** 本阶段需要的错误注入（连不上、超时、5xx、`authRefresh` 返回 401、唯一索引冲突、真冲突）都由假服务器显式触发。`context.setOffline` 只改浏览器的在线状态（PROBE-9），不能用来模拟服务器连不上。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段范围与需求
- `.planning/ROADMAP.md` §“Phase 9: 登录与云端存储” — 目标、5 条成功标准、必修项、UI 契约要求
- `.planning/REQUIREMENTS.md` — ACCT-01、ACCT-02、SYNC-01、SYNC-05、PLAN-01、INFRA-03（本阶段）；SYNC-02/03/04/06 用来划清与 Phase 10 的边界
- `.planning/PROJECT.md` §“Key Decisions” — 令牌 90 天必须 `authRefresh`、按 `kind` 取文档、去掉 Google 字体等已定事项

### 同步与认证设计（调研）
- `.planning/research/ARCHITECTURE.md` §Q2“适配器接口”、§Q3“本地缓存 / 脏位 / 对账表”、§Q5“单文件里的认证流程”、Pattern 1“配置缝”、Anti-Pattern 1、5、6 — 适配器、缓存键、对账表、登出顺序、自动取消。超时行为和冲突提示以本文件 D-02、D-03、D-08 为准
- `.planning/research/PITFALLS.md` Pitfall 1（整份 LWW）、4（第三方资源被墙）、11（XSS 与令牌）、12（文档变大）、14（本地数据丢失）、19、20（测试打到真实服务器、mock 漂移）
- `.planning/research/SUMMARY.md` §“研究文件之间的分歧与推荐解决方式”、§“本里程碑不能再放在范围外的必修项” — 冲突策略、自动取消、`maxSize`、B3 的落点

### 服务器契约与测试设施（Phase 8 产物）
- `tests/mocks/PB-CONTRACT.md` §3 已实现端点、§5 有意偏差、§7 规则语义（含 `kind+` 说明）、§9 给 Phase 9 的输入
- `tests/mocks/pb-server.ts`、`tests/mocks/pb-runtime.ts` — 假 PocketBase 和页面侧假 `EventSource`
- `tests/support/app.ts`（AppHarness 的 cloud 模式）、`tests/support/test.ts`（请求护栏）、`tests/support/static-server.cjs`（同源 SDK `/vendor/pocketbase.iife.js`，启动时核对 sha256）
- `tests/cloud/` — 现有 cloud 用例（harness、guard、contract、probes）
- `tests/PROBES.md` PROBE-9 — `setOffline` 的实际行为；PROBE-2 — 字体相关的网络兜底
- `tests/README.md` — 测试入口：`npm test`、`npm run test:cloud`，以及低优先级、1 个 worker 的运行方式
- `tests/KNOWN-BUGS.md` — B3（加载完成前的编辑被丢弃）在云端路径上由 D-01 的门控修复
- `pb/pb_migrations/1794096000_users_lockdown.js`、`pb/pb_migrations/1794096100_journey_docs.js`、`pb/rules.expected.json` — 集合与规则

### 前几个阶段的决定
- `.planning/phases/08-pocketbase-rules-isolation-fake-server/08-CONTEXT.md` D-04 到 D-07 — 登录标识、只能改密码、令牌 90 天、不做改密码界面
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-CONTEXT.md` D-01（示例计划是新账号的初始计划）、D-08（读取时自动修正，必须等计划加载完再丢弃孤儿进度）、D-09（入口校验加渲染转义）
- `.planning/phases/06-procurement-reachability-probe/06-CONTEXT.md` D-15 — SDK 用 0.28.1
- `tools/probe/page/vendor/`（`pocketbase.iife.js` 和 `SHA256SUMS`）— 唯一一份已批准的 SDK

### 隐私
- `PRIVACY.md` — 公开仓库的隐私规则；用例和文档里不能出现真实邮箱、令牌或服务器地址

注：`.planning/codebase/*.md` 写于 v1 之前，已经过时（08-CONTEXT 冲突第 10 条，已延后）。应用和测试的现状以源码和 `tests/README.md` 为准。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `store` 适配器 `{label, load, save}` 和 `localStore()`（`us-journey-tracker.html` 的 saving 段）：云端存储接在这一层，调研建议用 `makeDocStore(kind)` 产出 `state` 和 `plan` 两个实例。
- `persist()` / `flush()`（防抖 600 毫秒、`saving`、`dirty`）：现在会在保存前清 `dirty`（B5，Phase 10 修）。本阶段至少要先把修改写进本机缓存，再上传。
- `toast(m, act)`：带一个操作按钮的提示，有按钮时显示 5 秒，可以直接用于 D-04 的更新提示和 D-08 带下载按钮的冲突提示。
- `<p class="status" id="status">` 和 `setStatus()`：状态栏，用来显示对账中、网络较慢、连不上加重试。
- `<dialog id="editor">` 的对话框写法：D-05 的退出确认框可以沿用；也可以用原生 `confirm()`，现有导入流程就是这样做的。
- `readConfig()` / `USJ_CONFIG`：配置缝。现在配了 `backend` 时只显示“存储配置无效”，本阶段在这里接入云端路径。
- `normalize()`、`normalizePlan()`、`DEFAULT_PLAN`、`esc()`（Phase 7）：服务器来的数据一样要走校验和转义。

### Established Patterns
- 处理函数的顺序是：先改 `state`，再 `persist()`，最后 `renderAll()`。全量重绘意味着禁用编辑入口要在渲染层统一处理，不能逐个按钮打补丁。
- 用户可见的错误都走 `toast` 或 `setStatus`，代码里没有 `console`。
- 导出和备份按钮只在有 Claude `downloads` 能力时才显示（`exportCsv`、`exportJson`）。云端路径没有这个能力，冲突留底的下载要另做；完整的导出导入在 Phase 11。

### Integration Points
- 字体 `<link>` 在 `us-journey-tracker.html` 开头（`fonts.googleapis.com`，两处）。
- `init()` 是启动入口：先 `renderAll()`，再解析能力、加载数据。云端路径的 boot、`authRefresh`、对账、门控都从这里分支。
- `window` 的 `pagehide` 会调用 `flush()`。云端路径在这里要保证本机缓存同步写入。
- 测试侧：`AppHarness` 的 cloud 模式已经能让真实 SDK 连到假服务器，并完成登录、读写和订阅。本阶段要把 v1 四个视图的用例映射到云端路径（08-CONTEXT 的“云端测试入口的范围”）。

</code_context>

<specifics>
## Specific Ideas

- 所有者希望内容变化时被告知：即使只是正常的对账更新，也弹一个短提示（D-04）。
- 所有者看重方便：登录页一直记住上次的邮箱（D-07）。
- 所有者希望冲突留底简单：只留 1 份，点下载就删（D-09、D-10），接受相应的风险。
- 所有者希望退出时由自己决定：有未保存的修改就问一句，不要自动等待（D-05）。

</specifics>

<deferred>
## Deferred Ideas

- 改密码、改邮箱的界面：沿用 08-CONTEXT D-07，本里程碑不做。
- 断网时也能编辑：属于 Phase 10（SYNC-03）的既定范围，不是新想法。D-03 的只读状态到时升级。

讨论没有超出本阶段范围。

</deferred>

---

*Phase: 09-login-cloud-storage*
*Context gathered: 2026-11-08*
