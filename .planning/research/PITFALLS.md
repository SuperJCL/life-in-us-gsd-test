# Pitfalls Research

**Domain:** 给现有单文件原生 JS 应用加 PocketBase 云端后端：3 个管理员创建的隔离账号、多设备实时同步、可编辑个人计划、按账号导入导出、离线优先，部署在香港/东京便宜 VPS，用户分布在中国大陆和美国，仓库公开，Playwright 测试需继续可用
**Researched:** 2026-11-05
**Confidence:** MEDIUM（PocketBase 行为和规则语义来自官方文档，HIGH；中国大陆可达性只有厂商博客、论坛和学术测量，没有在大陆实测，MEDIUM 到 LOW，已逐条标注）

## 阅读说明

- 阶段名是建议的工作分组，由 roadmapper 对应到真实阶段编号：
  - **P-INFRA**：VPS、域名、HTTPS、反向代理、systemd、备份。
  - **P-BACKEND**：PocketBase 集合、API 规则、账号、管理后台加固。
  - **P-CLIENT**：前端接入（store 适配器、登录页、自托管 SDK 和字体、离线队列、实时同步）。
  - **P-PLAN**：可编辑计划和稳定任务 id 迁移。
  - **P-IO**：导入导出、从旧 Artifact 迁移。
  - **P-TEST**：模拟后端、回归、隔离护栏。
  - **P-OPS**：上线验收、恢复演练、升级流程。
- 置信度标签：HIGH = 官方文档或本仓库文件；MEDIUM = 多个独立来源或官方文档加推理；LOW = 单一来源、厂商博客、论坛或未验证推断。LOW 项不得当作定论。
- 公开仓库规则：下文所有示例都不含真实域名、IP、邮箱、路径或个人计划文字。

---

## Critical Pitfalls

### Pitfall 1：整份状态 last-write-wins，离线设备用旧状态覆盖另一台设备的新记录

**What goes wrong:**
手机离线一天后联网，把本地整份旧状态上传，服务器上电脑当天新记的几十条记录被整体覆盖。用户看到的是“记录凭空消失”，而且随后实时推送会把这个被覆盖的状态再同步回所有设备，消失变成永久。

**Why it happens:**
应用现状是整份 JSON、`ref.set(state)` 替换整份、加载一次后盲写（CONCERNS.md「Multi-device / multi-tab」）。项目决策“冲突以最后上传为准”如果按整份文档粒度实现，就等于这个行为。旧 Artifact 里一个人只有一个标签页，问题没暴露；3 人多设备加离线后几乎必现。

**How to avoid:**
- 把“最后上传为准”落在**条目粒度**而不是文档粒度：`logs` 按 `id` 取并集，删除用墓碑（`deleted: <时间>`），`tasks`/`lifts`/`reviews`/`presets` 按各自的键、带每键的 `updatedAt`，同键取较新者。这仍然符合“以最后上传为准”的用户语义，只是单位更小。
- 上传前先拉取服务器版本，合并后再写（read-merge-write）；PocketBase 记录更新没有 If-Match，窗口很小但存在，接受它并记录。
- 如果坚持整份文档：至少带一个 `baseUpdated`（上次读到的 `updated`），客户端写前比对，不一致则走合并而不是盲写；并在 UI 状态栏显示“已合并来自其他设备的更改”。
- 数据模型要尽早定：单记录整份 JSON（简单，沿用现有格式）还是拆成多条记录（logs 单独一条或按月一条，计划/配置各一条）。拆分让合并和大小问题都更容易，但改动更大。这是 roadmapper 需要标为“阶段内研究”的决策。

**Warning signs:**
- 双设备手测：A 离线记 1 条，B 在线记 1 条，A 联网后只剩一条。
- 合并代码里出现“用服务器版本整体替换本地”或“用本地整体替换服务器”的分支。
- 同步代码里没有任何按 `id` 的比较。

**Phase to address:** P-CLIENT（同步设计），数据模型决策在 P-BACKEND 之前定。

---

### Pitfall 2：API 规则写错，账号之间互相看到数据，或规则留空/留 null

**What goes wrong:**
- 集合规则留空字符串，表示任何人包括未登录访客都能操作（官方文档，HIGH）。
- 只写了 `@request.auth.id != ""`，结果任何已登录用户都能读写所有人的记录。
- `listRule` 写对了但 `viewRule`/`updateRule`/`deleteRule` 漏写，或实时订阅整个集合时用 `listRule`、订阅单条时用 `viewRule`，两者不一致就会有一条路径泄漏（官方文档，HIGH）。
- `createRule` 允许客户端自己提交 `owner`，用户可以把记录建在别人名下，或把自己的记录 `owner` 改成别人。

**Why it happens:**
PocketBase 规则同时是过滤器：`listRule` 不满足时返回 200 加空列表，`viewRule`/`updateRule` 不满足时返回 404，看起来像“没有数据”而不是“被拒绝”，所以写错了很难从界面发现（官方文档，HIGH）。

**How to avoid:**
- 每个用户数据集合，五条规则全部显式写成 `owner = @request.auth.id`（list/view/update/delete），create 写 `@request.auth.id != "" && @request.body.owner = @request.auth.id`，update 追加 `@request.body.owner:isset = false` 或 `@request.body.owner:changed = false`，禁止改属主。
- `owner` 字段设为必填的 relation（指向 users，`maxSelect = 1`），不要允许空。
- 不用 `expand` 取别人的关系；不暴露 `users` 集合的 list/view（`users` 的 listRule 只允许 `id = @request.auth.id`），并确认 `emailVisibility` 为 false。
- 用迁移文件（`pb_migrations`）把集合和规则写成代码并进版本库，不靠后台点点点；规则变更走评审。
- 写一个**跨账号隔离探针**：用账号 A 的 token 请求 B 的记录（list、view、update、delete、订阅），期望空列表或 404/403；上线前和每次改规则后跑。探针用合成账号，凭据从环境变量取，不写进仓库。

**Warning signs:**
- 后台集合的规则栏出现锁形图标以外的空白，或任意一条规则是空字符串。
- 用账号 A 登录后 `getFullList()` 返回的条数大于自己的条数。
- 订阅 `collection/*` 收到不是自己的事件。

**Phase to address:** P-BACKEND（规则和迁移），P-OPS（上线前探针验收）。

---

### Pitfall 3：管理后台 `/_/` 和超级用户凭据暴露在公网

**What goes wrong:**
`/_/` 在同一个域名上，任何人都能打开登录页并暴力猜超级用户密码；超级用户绕过所有 API 规则（官方文档，HIGH），一旦泄漏，3 个人的全部数据都暴露。超级用户邮箱和密码如果出现在脚本、`.env` 提交、部署笔记或 issue 里，公开仓库会永久留痕。

**Why it happens:**
PocketBase 默认把后台和 API 放在同一个端口；图省事直接公网访问；部署脚本里写死初始超级用户。

**How to avoid:**
- 在反向代理层限制 `/_/*` 和 `/api/collections/_superusers/*`：只允许你自己的固定 IP 或只在内网/SSH 隧道里访问（例如 Caddy 对这些路径按 `remote_ip` 匹配，其余返回 404）。同时启用 PocketBase 自带的 Superuser IPs 限制（v0.38.0+）和超级用户 MFA/OTP（官方 going-to-production，HIGH）。注意：IP 变动后用 `superuser ips` 命令行重置，别把自己锁在外面。
- 超级用户用长随机密码加密码管理器；创建用 `pocketbase superuser upsert` 命令，凭据只在服务器上交互输入，不写进脚本、不进 shell 历史、不进仓库。
- 普通用户集合关闭自助注册（createRule 对 `users` 设为 null 即只有超级用户能建），不开 OAuth2、不开 OTP 邮件登录，除非真的要用。
- 设置 `PB_ENCRYPTION_KEY` 加密保存的设置（SMTP、S3 凭据），密钥另存，不进仓库（官方，HIGH）。
- 启用内置速率限制，并在反向代理处再对 `/api/collections/users/auth-with-password` 做更严格限速（官方建议两者之一或组合，HIGH）。反向代理后要配置 PocketBase 的 “User IP proxy headers”，否则所有请求都显示为 127.0.0.1，限速和日志按错误的 IP 工作（官方，HIGH）。
- 3 个用户的密码要足够长；没有邮件服务时，忘记密码要靠超级用户重置，提前定好流程。

**Warning signs:**
- 从外网（比如手机流量）直接打开 `https://<域名>/_/` 能看到登录页。
- PocketBase 日志里大量 `auth-with-password` 400。
- 仓库里 `git grep` 能找到 `superuser`、`password` 字样加具体值，或 `.env` 被追踪。

**Phase to address:** P-INFRA（代理限制）、P-BACKEND（用户集合和超级用户）、P-OPS（外网验收）。

---

### Pitfall 4：用户登录页和 API 在大陆能打开，但依赖的第三方资源（字体、SDK、CDN）被墙，页面空白或极慢

**What goes wrong:**
- 现有页面在 `<head>` 里同步加载 Google Fonts 的样式表，在大陆这个请求会挂住或超时，阻塞渲染，用户看到长时间白屏或晚出现的界面（来源：多个社区报告，Google Fonts 在大陆不稳定，MEDIUM；本仓库 `us-journey-tracker.html:7-9`）。
- 为了接 PocketBase，顺手从 jsDelivr、unpkg 或 cdnjs 引 SDK，这三者在大陆都有被阻断或不稳的报告：jsDelivr 自 2022 年起多次被报告不可用，丢失 ICP 后国内节点关闭；unpkg、cdnjs 被部分运营商阻断（来源：论坛和厂商博客，LOW 到 MEDIUM，需要自己在大陆网络验证）。

**Why it happens:**
开发者在美国或海外网络测试，一切正常；大陆用户才是受害者，而项目里没有大陆侧的测试环境。

**How to avoid:**
- **SDK 自托管**：把固定版本的 `pocketbase` 浏览器构建文件放进你自己的站点（同源，由 PocketBase 的 `pb_public` 或反向代理提供），文件进仓库并记录版本；不用任何第三方 CDN。服务端和 SDK 版本成对固定（见 Pitfall 20）。
- **字体**：二选一并写进需求。推荐直接去掉 Google Fonts，用现有的回退栈（`Songti SC`、`STSong`、Georgia）；如果必须保留 Noto Serif SC，自托管子集化后的 woff2，并加 `font-display: swap`，绝不能用阻塞渲染的外部样式表。中文字体全量文件体积很大，子集化只保留标题和数字用到的字。
- 页面里不留任何其他外部域名（统计、图标、头像）。上线前用浏览器开发者工具 Network 面板确认所有请求都是同源，并把“同源”做成 CSP（`default-src 'self'; connect-src 'self'`）作为强制手段。
- v1.0 测试已经拦截所有外部请求，这正好能当“没有第三方依赖”的回归：新增任何外部请求，测试会因拦截而暴露。保留这条护栏。

**Warning signs:**
- 在大陆网络（或模拟的慢/阻断网络）首屏超过几秒。
- Network 面板出现非同源域名。
- 构建里出现 `cdn.jsdelivr.net`、`unpkg.com`、`fonts.googleapis.com`。

**Phase to address:** P-CLIENT；P-TEST 保持外网拦截护栏。

---

### Pitfall 5：选了线路差的便宜 VPS，或把“香港”商家当成大陆合规问题的万能药，结果大陆晚高峰很慢

**What goes wrong:**
同样标着“香港”或“东京”，回程线路差别很大：普通国际线路晚高峰丢包可达几个百分点，CN2 GIA 或 CMI 类优化线路明显好但贵；不同运营商（电信、联通、移动）表现不同（来源：厂商博客，数据本身不透明，LOW）。美国用户反过来：香港/东京到美国延迟更高，但对 3 个人的记事应用可以接受。

**Why it happens:**
价格 4 到 8 美元每月的档位，线路质量没有保证；商家的“99.99% 在线”、“延迟降低数倍”是宣传，没有独立验证（LOW）。

**How to avoid:**
- 买之前，要商家的测试 IP（looking glass），在**晚上 20:00 到 23:00** 从大陆三家运营商的家用网络各 ping/mtr 一次，看丢包和延迟；让大陆的用户本人在手机 4G/5G 和家宽下各测一次。这是用户的采购动作，应写进里程碑的验收，而不是靠调研结论。
- 倾向于用户中大陆联通/移动较多就更看重东京的 SoftBank 或 CMI 回程，电信为主则看 CN2；这条是社区经验，不是定论（LOW）。
- 选能按小时计费或有退款期的商家，先小成本试用一周再长期；不要一次付一年。
- 数据只有几个人在用，流量极小，所以带宽套餐、流量上限不是主要成本风险，线路质量才是。
- 确认商家真是香港/东京机房：有些“香港”商家实际在大陆，需要 ICP 备案和实名（来源：商家博客，LOW），而本项目明确不做备案。用 `traceroute` 和 IP 归属地验证，看官方说明里机房位置。
- 备案相关：解析到非大陆服务器不需要工信部备案（阿里云官方帮助中心，MEDIUM；该文同时提到仍可能涉及公安备案，要以所在地要求为准，不属于本项目范围但值得知道）。

**Warning signs:**
- 晚高峰 ping 丢包持续超过 2 到 3%，或延迟抖动大。
- 商家开通后要求实名、身份证明或备案号。
- 同一 IP 段已被已知阻断。

**Phase to address:** P-INFRA（选型验收），用户本人完成采购和测试。

---

### Pitfall 6：实时连接（SSE）经过代理或大陆网络后静默断开，应用以为在同步其实不是

**What goes wrong:**
PocketBase 实时用 SSE（官方，HIGH）。常见故障：
- 代理缓冲：nginx 默认缓冲和 HTTP/1.0 上游会把 SSE 憋住或在首个响应后关闭；默认读超时（约 60 秒）会掐断空闲流（社区指南，MEDIUM）。
- PocketBase 自己在 5 分钟没有新消息时会主动发断开信号，客户端应自动重连（官方，HIGH）。
- 经过 Cloudflare 橙云代理时，有开发者报告 SSE 约 100 秒被断（V2EX 帖子，LOW），而且 Cloudflare 在中国大陆的默认网络是海外节点，不一定更快（LOW）。
- 手机浏览器切后台后连接被系统回收，回来时没有补拉数据。
- **断线期间错过的事件不会补发**（官方文档没有说明有重放，MEDIUM 推断），重连后若不重新拉取，设备永久缺数据。

**Why it happens:**
实时是“增强”，却被当成“数据一致性的唯一来源”。

**How to avoid:**
- **把拉取作为基线，实时只是加速**：应用启动、`visibilitychange` 回到前台、`online` 事件、以及 SDK 的 `PB_CONNECT` 重连事件触发时，都做一次“拉取并合并”；另加一个低频兜底轮询（例如在页面可见时每 1 到 2 分钟）。
- 反向代理：用 Caddy 时确认实时路径不缓冲，读超时不低于官方示例（官方示例为 360s，HIGH）；用 nginx 时 `proxy_buffering off`、`proxy_http_version 1.1`、`proxy_read_timeout` 加长（MEDIUM）。**不要**给 API 域名开 Cloudflare 橙云；用 DNS-only 直连源站（是否更快未实测，LOW，需大陆侧验证）。
- 调高系统文件描述符限制（systemd 的 `LimitNOFILE`）以免多连接时 “Too many open files”（官方，HIGH），对 3 个用户不是紧迫问题，但写进 unit 文件成本为零。
- 状态栏如实显示“实时已连接 / 仅手动同步”，不要在断线时显示“已同步”。

**Warning signs:**
- 一台设备记录后另一台过几分钟甚至刷新前都不出现。
- 浏览器 Network 里 `/api/realtime` 请求周期性结束又重建，且重建后没有补拉。
- 手机锁屏几分钟后回来数据落后。

**Phase to address:** P-CLIENT（同步设计、重连后补拉），P-INFRA（代理配置），P-OPS（真实设备验收）。

---

### Pitfall 7：实时回声和重绘覆盖正在输入的内容

**What goes wrong:**
本设备保存后，服务器把自己的更新又推回来；应用收到事件后调用 `renderAll()`，把正在输入的“记一笔”草稿和复盘文本框清空。现状已有这类 bug：整页重绘会清空草稿（B1、N1，KNOWN-BUGS.md），复盘防抖期间的重绘会还原文本框（N2）。实时同步会把这些原本只在特定操作下出现的 bug，变成**别的设备一保存，你这边就丢草稿**。

**Why it happens:**
“每次变化全量重绘所有标签页”的架构（ARCHITECTURE）加上远端事件随时到达。

**How to avoid:**
- 给每次写入带一个客户端生成的 `writeId`/版本号，收到事件时如果是自己刚写的就忽略；比较 `updated` 或版本号，只在远端内容确实不同时才应用。
- 应用远端变更前，检查是否有未保存的草稿或聚焦的输入框：有则延后（排队，用户离开输入后再应用），或只更新数据而不重建 composer 和复盘文本框。
- 应用远端变更时对远端数据做和导入同样的深度校验（见 Pitfall 11）。
- 不要在 `onSnapshot` 类回调里再触发 `persist()`，否则两台设备会互相回写形成循环。区分“本地发起的变更”和“远端应用的变更”，后者不再调度保存。

**Warning signs:**
- 开两个标签页，A 保存时 B 正在输入的文字消失。
- 网络面板里保存请求在没有用户操作时持续出现。
- 状态栏在两端交替闪烁“正在保存”。

**Phase to address:** P-CLIENT；P-TEST 加双客户端用例（见 Pitfall 22）。

---

### Pitfall 8：导入畸形文件清空账号数据，并且这次会被实时同步到所有设备和服务器（已知 bug N3 放大）

**What goes wrong:**
现状：导入 `{}` 能通过 `normalize()`，确认后整份替换为空状态（N3，KNOWN-BUGS.md；`[]` 和字段类型错误的对象同类）。在云端版里，替换后会立刻上传，再通过实时推送覆盖其他设备，整个账号数据被清空，而且这是**用户确认过的**操作。

**Why it happens:**
`normalize()` 只检查顶层类型（CONCERNS.md「Shallow validation」）；“导入即全部替换”没有任何回退。

**How to avoid:**
- 这次不能再留作已知 bug：新的导入入口必须严格校验，要求有备份格式标记和版本字段、至少一个已知顶层键、`logs[].date` 符合 `YYYY-MM-DD`、`logs[].text` 是字符串、`cat` 在已知类别内、`id` 符合安全字符集、数值字段是有限数。校验失败**拒绝**，不降级为空默认值。
- 确认框显示差异摘要：“将用 N 条记录替换当前 M 条记录”，当导入的条数明显少于现有时（例如少于一半）加一道额外确认。
- **导入前自动留底**：把当前整份状态存为服务器端的一条历史记录，同时触发浏览器下载一份本地备份；至少保留最近几次导入前的快照，30 天后清理。
- 导入后不要等 600ms 防抖就立刻允许实时覆盖：导入作为一次显式的“批量提交”，其他设备在收到后显示“已被导入替换，可撤销”。
- 把 N3 的 `test.fail` 用例在这个阶段**转成正常通过的用例**，并按 KNOWN-BUGS.md 的约定同步改登记表（登记护栏会双向核对，漏改会变红）。

**Warning signs:**
- 导入 `{}`、`[]`、`{"logs":[{}]}` 后界面清空或报运行时错误。
- 导入后不能撤销。
- 服务器上没有任何导入前的快照记录。

**Phase to address:** P-IO；P-TEST 把 N3 翻转为通过用例。

---

### Pitfall 9：计划变成可编辑后，内置任务的位置 id 让已有完成/截止状态错位

**What goes wrong:**
内置任务 id 是 `P<n>-<index+1>`，来自任务在 `GROUPS` 中的位置，自定义任务靠正则 `/^P\d-\d+$/` 区分（CONCERNS.md）。用户在“编辑计划”里插入、删除或重排任务，所有 `state.tasks[id]` 的完成日期和截止日期悄悄挪到别的任务上；导入旧备份时，旧 id 对应到新计划里的另一项。

**Why it happens:**
id 的含义依赖数组顺序；计划原来写死在代码里，从不变，所以没问题。

**How to avoid:**
- 在编辑功能上线**之前**，先做一次性、幂等的迁移：把当前位置 id（`P1-1`……）**冻结为永久稳定 id**，写进每个账号的计划数据；新增任务用 `t-<uid>`，永不复用已删除任务的 id。冻结后旧备份里的 id 仍然能对上，旧导出文件可直接导入。
- 把“是否自定义任务”的判断从正则改为查计划：是否在计划的任务表里。不要再用 id 形状推断含义。
- 删除任务时决定孤儿状态的处理：保留 `state.tasks` 里的条目但进度统计忽略它（可恢复），而不是静默删除或继续计入进度。
- 重排只改顺序字段，不改 id。导入备份中出现计划里不存在的 id 时，保留并报告，不静默丢弃。
- 迁移要有测试：旧格式状态加默认计划，迁移后勾选状态逐项对应；迁移执行两次结果不变。

**Warning signs:**
- 在编辑页把第 2 项挪到第 1 项，进度条里对勾跟着位置跑。
- 删一个任务后后面的任务突然变成“已完成”。
- 代码里仍有按 `P\d-\d+` 做分支的地方。

**Phase to address:** P-PLAN（编辑功能之前先做迁移）；P-IO 处理旧备份。

---

### Pitfall 10：个人计划文字泄漏到公开仓库，或者留在公开可访问的静态页里

**What goes wrong:**
- 应用文件现在因为写死了个人计划而不进 git（PRIVACY.md）。v2.0 把计划外置后，开发者把改好的 HTML 提交，而里面仍带着默认计划原文，或者测试 fixture、截图、报告里带着真实计划。
- 更隐蔽：把含个人计划的 HTML 放在 PocketBase 的 `pb_public` 静态目录里，**未登录的人访问域名就能读到**这份 HTML 里的计划文字，因为登录只保护 API，不保护静态文件。
- 部署脚本、域名、服务器 IP、超级用户邮箱写进仓库文档或 CI 配置。

**Why it happens:**
把“登录页”当成对整个站点的保护；公开仓库的隐私检查只覆盖已知规则，新增的服务器相关信息没有规则。

**How to avoid:**
- 静态页只带中性默认计划（空计划或通用模板）；真实计划只存在 PocketBase 记录里，由主人通过导入或编辑页写入服务器。
- 部署产物只放静态页、SDK、字体；上线前用未登录请求检查 `pb_public` 内容里没有任何个人词条。
- 扩展 `tools/privacy/privacy-check.mjs`：增加规则拦截仓库中的真实域名、IP 地址形状、`PB_ENCRYPTION_KEY=`、超级用户邮箱、token 形状字符串；`.gitignore` 增加 `pb_data/`、`.env*`、部署私有配置目录、服务器备份目录；服务器相关的真实值只放 `private/` 或服务器本机。
- 文档用占位符 `<DOMAIN>`、`<SERVER_IP>`。设置 `noindex`（`<meta name="robots">` 和响应头），避免被搜索引擎收录登录页。
- 注意 `.git` 历史是永久的：一旦提交就要当作已泄漏，需要重写历史并更换凭据，所以要在**提交前**拦住。

**Warning signs:**
- `git grep` 能找到域名、IP、`pb_data`。
- 用无痕窗口打开 `https://<DOMAIN>/` 的页面源码里能看到个人计划词条。
- 隐私检查没有对应的新规则。

**Phase to address:** P-INFRA（部署产物边界）、P-PLAN（计划外置）；隐私规则在第一个涉及服务器的提交之前先加。

---

### Pitfall 11：数据现在存在服务器上，既有的 XSS 缺口变成持久化的、会窃取登录令牌的缺口

**What goes wrong:**
CONCERNS.md 已列出：`t.group`、日志和任务的 id（放在 `data-*` 属性里）、`s.due`、力量项 `cur` 进入 `innerHTML` 时没有转义。过去只有“用户自己选了一个恶意文件”的 self-XSS。现在：
- 数据来自服务器，导入的畸形文件或被改过的服务器记录会在**每台设备每次加载时**执行脚本（持久化 XSS）。
- PocketBase 的 SDK 默认把登录令牌存在 `localStorage`（官方 js-sdk 文档，HIGH），脚本能直接读取并发给攻击者，等于账号被接管。
- 可编辑计划新增了大量用户自由文本（组名、任务文字、力量项名称、预设标签），并且 id 变成用户可影响的字符串，属性注入面扩大。
- 实时推送把远端记录直接渲染，绕过了“只有用户自己选的文件才导入”这个缓解。

**Why it happens:**
CONCERNS.md 里“修 XSS”被明确放在范围外（PROJECT.md Out of Scope，“除非新功能必须碰到”）。这个里程碑**必须碰到**，因为信任边界变了。

**How to avoid:**
- 把“所有进入 `innerHTML` 的插值都经过转义”作为本里程碑的硬要求，包括属性上下文（要转义引号）；id 一律由 `uid()` 生成，不使用用户文本；校验函数在**加载服务器数据、应用实时事件、导入文件**三个入口都调用同一个深度校验。
- 反向代理加响应头：`Content-Security-Policy`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`frame-ancestors 'none'`。单文件里有大量内联脚本，因此 CSP 要么用内联脚本的 SHA-256 哈希（每次构建要重新计算，可放进部署脚本），要么暂时允许 `'unsafe-inline'` 并明确这是已知的折中。哈希方案更好；它要求页面里没有内联事件属性（`onclick=`），现状靠 `data-*` 委托，通常满足，但需要核实。
- 让令牌更难偷：缩短令牌有效期并用 `authRefresh`，登出时清除；若愿意改动更大，把认证放进 HttpOnly cookie 需要后端自定义，对本项目不划算，所以防 XSS 是主要手段。
- CSV 公式注入（B7）顺手处理：导出时给以 `= + - @` 开头的单元格加前缀。

**Warning signs:**
- 导入一个日志文本含 `<img src=x onerror=...>` 的合成文件，或把计划里任务名设成这种字符串，页面上出现告警或额外请求（用合成载荷测，不要用任何真实数据）。
- 代码里仍有未经 `esc()` 的 `${...}` 出现在模板里。
- 没有 CSP 响应头。

**Phase to address:** P-CLIENT（校验和转义），P-PLAN（新字段），P-INFRA（响应头）；P-TEST 加注入载荷用例。

---

### Pitfall 12：整份状态文档越长越大，超出记录字段上限，保存开始失败，而且每次保存都在跨境传整份

**What goes wrong:**
- 旧 Artifact 的 `db` 文档上限是 256 KiB（INTEGRATIONS.md）；PocketBase 的 JSON 字段默认最大 1 MiB，可按字段配置调高（文档来源 JSVM API 参考，MEDIUM）。超限后保存报校验错误，应用目前“失败不重试”（B5）。
- 日志只增不减。每次防抖保存（600ms）都上传整份，另有一台设备在线时，**每次保存还会把整条记录通过实时推送给其他设备**。几百 KB 的整份在大陆跨境线路上频繁来回，既慢又费流量。
- 计划编辑加上历史快照后，大小增长更快。
- 反向代理的请求体上限（官方示例 10MB）一般够用，不是瓶颈，但它们是第二道限制，要知道。

**Why it happens:**
“沿用现有状态格式”的决策直接继承了整份文档的扩展性假设。

**How to avoid:**
- 数据模型阶段就定拆分：配置/计划（小、很少变）一条记录；`tasks`/`lifts`/`reviews`/`presets` 一条；`logs` 按月分记录（或每条日志一条记录，再按日期范围订阅）。这样每次保存和实时推送只带变更部分，也天然配合 Pitfall 1 的按条目合并。
- 如果仍用单记录：在 JSON 字段上显式设置 `maxSize`，客户端在保存前检查序列化大小，超过阈值（例如上限的 70%）就在状态栏警告，而不是等到失败；把失败保存改为**重试加可见错误**。
- 设置保存失败时不要清除“脏”标记（修 B5，在新存储适配器里就是必须的，因为离线队列依赖它）。
- 容量估算：按 CONCERNS.md 的估计，每天约 5 条、每条 100 到 200 字节，加每周复盘，一年量级是几十到几百 KB；1 MiB 能撑几年，但整份传输的代价先到。

**Warning signs:**
- 状态 JSON 序列化后超过 200 KB。
- 保存请求体积随时间线性增长。
- 保存开始出现 400 校验错误。

**Phase to address:** P-BACKEND（数据模型）、P-CLIENT（保存逻辑）。

---

### Pitfall 13：日期字符串在中美设备之间的语义不一致

**What goes wrong:**
应用用本地 `YYYY-MM-DD` 字符串，周以周一开始，页头“来美国第 N 天”由本地日期计算（CONCERNS.md、CONVENTIONS）。同一时刻，中国是第二天、美国还是前一天。具体坑：
- 如果开发者用 PocketBase 的 `created`/`updated`（UTC）去推导“记录日期”，会和用户心里的日期差一天。
- 一台美国设备在晚上记的“今天”，在中国设备上是“昨天”的内容出现在“明天”；本周视图的 `wk`/`sel` 只在加载时计算一次，跨午夜不更新（B9），两地设备同时打开时更容易看到不一致。
- “到期/过期”的判断是字符串比较，各设备用各自的 `today`，同一个截止日在两地的“已过期”时刻不同。
- 美国夏令时切换那天，用 `new Date(y, m, d)` 加减 86400000 毫秒做日期运算会出现 23/25 小时的天，错一天。

**Why it happens:**
单设备单时区时这些都隐形。

**How to avoid:**
- **日期字符串是“用户记下它时的本地日历日”，写入后永不重新解释**；服务端字段只存字符串，不转换为时间戳，不用 `created` 推导业务日期。
- 保留一个明确的规则：每条日志的日期按**记录它的设备的本地日**，同步时原样传递；不在读取时按本地时区重算。
- 日期运算全部用 `Date.UTC` 或按 y/m/d 整数加减，避免毫秒加减；现有 `addDays`/`monday` 要检查这一点。
- 修 B9（跨午夜更新）至少做到：可见性恢复和定时检查时重算今天。
- 抵达日期是用户设置的字符串，各设备共享，页头计数仍然按设备本地今天算，这是可接受的，写进已知行为。
- 测试：v1.0 已有固定时钟和时区的护栏；增加用例用两个不同时区的上下文（例如 `Asia/Shanghai` 和 `America/Los_Angeles`）打开同一份数据，断言存储的日期字符串不变、同一日志出现在同一天。

**Warning signs:**
- 美国晚上记的东西在中国设备上“跳天”。
- 代码里出现 `toISOString().slice(0,10)`（它给的是 UTC 日期）。
- 夏令时切换周的周统计少一天。

**Phase to address:** P-CLIENT；P-TEST 双时区用例。

---

### Pitfall 14：离线队列丢失，或浏览器清掉本地存储，未上传的编辑跟着没了

**What goes wrong:**
“先存本地，联网后上传”的本地副本如果只是 `localStorage` 里的状态，会遇到：
- iOS Safari 对网站数据的“7 天不使用自动清除”规则（ITP）：Safari 对一段时间没有交互的网站会清除其脚本可写存储；主屏幕网页应用不受这条限制（WebKit 工程师说明，但各来源对细节有冲突，MEDIUM，需要在真机验证）。若离线编辑存在这里且几天没打开，可能整份丢失。
- 大陆用户常在微信内置浏览器中打开链接，它的存储和下载行为与系统浏览器不同（经验判断，未验证，LOW，需要真机测试）。
- 用户清缓存、换浏览器，本地的未同步编辑没了且没有任何提示。
- 失败不重试（B5）加上 `dirty=false` 在保存前就清掉，网络抖动一次就丢一次编辑。

**How to avoid:**
- 本地存储里分开保存：已同步的快照、**待上传的变更队列**（带版本和时间戳），每次成功上传后才从队列里移除。
- 状态栏显示“有 N 条未上传”；`pagehide` 和 `visibilitychange: hidden` 时立刻把队列同步写入本地（`localStorage` 同步写，可靠；`fetch keepalive` 作为尽力上传，别当保证）。
- 提示用户把页面添加到主屏幕，并提供一键下载本地备份；明确告诉用户“有未上传内容时不要清理浏览器数据”。
- 提供“导出整份 JSON”入口始终可用（本地和云端模式都可用，现状本地模式没有导出，CONCERNS.md）。

**Warning signs:**
- 手动断网后记录几条、关页、重开，再联网，记录没有出现在服务器。
- 保存失败后状态栏恢复为“已保存”。

**Phase to address:** P-CLIENT；P-OPS 做真机离线验收。

---

### Pitfall 15：备份缺失、与数据同盘，或从未演练恢复

**What goes wrong:**
- 备份存在同一台 VPS 的同一块盘上：盘坏、被误删、被商家回收实例时数据和备份一起没了。
- 只开了 PocketBase 内置备份存本地，没有异地副本；官方建议备份放 S3 且用独立的桶（官方 going-to-production，HIGH）。
- 备份文件从未做过恢复演练，真正需要时才发现版本不匹配、文件为空，或解压后无法启动。
- 商家的快照要另外收费，且恢复耗时长（厂商博客，LOW）。

**How to avoid:**
- 两层：PocketBase 内置定时备份（后台 Settings > Backups，设保留份数）加每日把备份文件拉到**另一处**（别家商家的对象存储、或你自己电脑，用 `rclone`/`rsync` 加密后传输）。这是你自己的动作，凭据由你保管，不进仓库。
- 异地存储里的备份同样包含个人数据：加密，并设访问最小权限。
- **恢复演练**写成验收项：新建一台临时机或本机，用备份恢复，用探针确认三个账号的记录条数一致。每次升级 PocketBase 之前做一次备份加恢复检查。
- 应用层的“导出 JSON”是第三道保险：提醒用户定期自己下载一份。
- 备份必须在升级之前做；升级失败时用旧二进制加旧备份回滚。

**Warning signs:**
- 备份目录和 `pb_data` 在同一个挂载点，且没有异地副本。
- 最新备份文件时间超过 2 天。
- 没人说得出如何恢复。

**Phase to address:** P-INFRA（备份）、P-OPS（恢复演练为上线门槛）。

---

### Pitfall 16：PocketBase 升级破坏兼容，或升级来源变化带来供应链风险

**What goes wrong:**
- v0.23 是大版本破坏性升级：管理员变成 `_superusers` 集合，`/api/admins/*` 被移除，迁移文件需要重新生成快照，JS SDK 需要同步升级到配套版本，不升级时要固定在 v0.22.x 兼容的 SDK 版本（官方升级说明，HIGH）。
- 截至 2026-10 的最新发布是 v0.40.6（GitHub releases 页面，MEDIUM，需用户核实）。该发布说明声明：更新命令改为从新的主机拉取，这很可能是 GitHub 上的最后一个发布；新主机为维护者的个人域名（GitHub release 页面，MEDIUM，需用户核实）。这意味着：**以后的下载来源与校验方式可能变化**；自动更新命令（`pocketbase update`）在你没看过的情况下不应在生产机上随手运行。
- 近期的发布频繁抬高 Go 最低版本以修 `net/http` 安全问题（含一个 DoS 修复，说明要求用户应用，GitHub releases，MEDIUM），不及时升级有已知漏洞暴露在公网。

**How to avoid:**
- 部署时固定 PocketBase 版本号和二进制的 SHA-256（从官方发布页取，记录在部署文档的非机密部分），升级流程写成清单：备份 → 在本机或临时机用恢复出的数据试升级 → 跑隔离探针和同步冒烟 → 再上线。
- SDK 版本和服务端版本成对记录；升级服务端时同时检查 SDK 是否需要升级。
- 订阅发布渠道（GitHub release 的 watch，或新主机的公告），每月看一次安全相关发布；3 人用的项目也不能让公网服务长期不更新。
- 集合和规则用迁移文件版本化（见 Pitfall 2），升级前后做差异比对。

**Warning signs:**
- 升级后 `/_/` 登录失败、或 SDK 报 404（如调用已移除的接口）。
- 生产机上的版本比最新版落后很多个小版本。
- 有人用 `update` 命令直接升级生产机。

**Phase to address:** P-INFRA（固定版本和校验）、P-OPS（升级清单和演练）。

---

### Pitfall 17：HTTPS 证书续期失败，或进程在重启后没有起来，网站在无人注意时悄悄不可用

**What goes wrong:**
- 防火墙或安全组只开了 443、没开 80，HTTP-01 验证失败。Caddy 可以用 TLS-ALPN-01（只需 443）作补充，但前提是 443 可达且没有被其他代理挡住（Caddy 社区讨论，MEDIUM）。使用 Cloudflare 橙云代理时，验证请求被代理拦住也会失败（同上）。
- 域名 DNS 记录改过或域名到期，证书无法续期；域名自动续费用了过期的银行卡。
- PocketBase 以前台命令启动，重启或 SSH 断开后进程消失。
- 日志和备份把盘写满，PocketBase 或 SQLite 写入失败，应用表现为“保存失败”。
- 内存很小的机器上大文件上传或缩略图生成导致 OOM（官方建议在内存受限环境设置 `GOMEMLIMIT` 并考虑 swap，HIGH；v0.40.6 刚为缩略图加了像素上限，MEDIUM）。

**How to avoid:**
- 用 systemd 服务：`Restart=always`、`LimitNOFILE`、`GOMEMLIMIT`、专用非 root 用户、`pb_data` 目录权限收紧；`systemctl enable` 保证开机自启。部署后真的重启一次机器验证。
- 反向代理用 Caddy 自动 HTTPS；80 和 443 都开放；`/_/` 的限制规则不要误伤 ACME 路径。
- 外部拨测：用一个免费的外部监测（如定时 `curl` 到健康端点 `/api/health`，失败发通知到你自己的通道），监测证书剩余天数；这个监测的 URL 和凭据别提交进仓库。
- 域名开启自动续费并设到期提醒；记下域名注册商的账号恢复方式。
- 磁盘：日志轮转，备份只留最近 N 份，设磁盘用量告警（超过 70%）。
- 缩略图和文件上传本项目都不需要：不创建 file 字段，减少攻击面和内存压力。

**Warning signs:**
- 浏览器证书告警或 `ERR_CERT_DATE_INVALID`。
- 重启服务器后站点打不开。
- `df -h` 使用率持续上升。

**Phase to address:** P-INFRA、P-OPS。

---

### Pitfall 18：便宜 VPS 的隐性费用和超卖

**What goes wrong:**
- “无限流量”实际有公平使用上限，超出后按量计费；快照、备份、更换 IP、重装系统可能另收费；有的商家要求实名或备案（来源：商家博客，LOW，且多为促销性质，要按各商家条款核实）。
- CPU 和磁盘 IOPS 超卖，SQLite 写入偶发卡顿；商家跑路或机房迁移导致 IP 变化（域名 DNS 要跟着改）。
- 汇率和续费价格：首年促销价、次年涨价。

**How to avoid:**
- 对 3 个人的记事应用，选最小规格就够，流量不是问题；重点比较：线路（Pitfall 5）、是否有退款期、续费价格、是否提供控制台救援和快照、能否随时导出镜像。
- 先按月付费试用，确认稳定后再考虑年付；信用卡设金额上限或用虚拟卡，避免自动扣费超预期。
- 把商家名称、实例 ID、续费日期、联系方式放进你自己的私人笔记（不是仓库）。
- 为“商家出问题”准备出口：备份异地、域名 TTL 设短（例如 300 秒）、部署脚本可以在新机器上一键重建。
- 用户本人负责购买和支付；Claude 不替用户注册、付款或输入密码（PROJECT.md 约束）。

**Warning signs:**
- 账单出现未预期条目。
- 磁盘写入延迟高，保存偶发超过几秒。
- 商家公告迁移或下线。

**Phase to address:** P-INFRA（选型和试用），P-OPS。

---

### Pitfall 19：测试不小心打到真实服务器，或真实凭据进入测试和报告

**What goes wrong:**
- 前端现在有了真实的服务器地址配置。如果地址写成默认值、环境变量或常量，测试里一个漏拦的请求就会打到线上，甚至用测试数据污染真实账号。
- 测试报告、trace、截图会记录请求 URL、令牌和数据（PRIVACY.md 已因此排除 `test-results/` 和 `playwright-report/`）。登录测试如果使用真实账号，凭据就进了报告。
- 把服务器地址或测试账号写进仓库的 `playwright.config.ts` 或 fixture。

**Why it happens:**
v1.0 的网络护栏针对的是“应用完全不出网”；v2.0 的应用本来就要出网，护栏必须改成“只允许发往一个由测试控制的假后端”。

**How to avoid:**
- 前端的服务器基地址**不放在代码常量里**：由页面加载时从同源取（相对路径），或由一个配置对象注入；测试注入 `http://mock.invalid` 这类不可解析地址。同源相对路径是最简单的：应用不知道任何真实域名，仓库里也永远不出现。
- 保留 v1.0 的三层网络护栏（route 拦截、`--host-resolver-rules`、死代理），并增加一条“白名单”：只允许发往 mock 的来源，其余一律失败；加一条自检用例证明发往任意其他主机的请求被拦下并让用例失败（把 v1.0 里“非 HTTP 的出网尝试不会让用例失败”的缺口，WR-05，在这里补上）。
- 测试账号只用合成的、专为 mock 生成的用户 id 和假令牌，格式明显不同于真实令牌；隐私检查加规则拦截 JWT 形状的字符串。
- 集成冒烟（对真实 PocketBase 的跑法）与默认 `npm test` 分开：需要显式环境变量才运行，指向本机临时起的 PocketBase 实例（合成数据、临时目录），永远不指向线上，并且要在文档里明确。

**Warning signs:**
- 测试日志里出现真实域名。
- 默认 `npm test` 在没有网络时失败，且原因是连线上。
- 报告目录里出现 Authorization 头。

**Phase to address:** P-TEST；服务器地址策略在 P-CLIENT 先定。

---

### Pitfall 20：mock 与真实 SDK 渐行渐远，测试全绿，线上却坏了

**What goes wrong:**
- v1.0 的 mock 是按 Claude Artifact 运行时契约 0.2.96 写的（`db`/`user`/`downloads`），v2.0 换成 PocketBase 后这套契约不再适用。只靠手写 mock，规则语义（404 而不是 403、`listRule` 返回空列表）、校验错误、实时事件顺序都可能和真实服务器不同。
- SDK 升级后行为变化，mock 没跟着变。
- mock 只做正常路径（v1.0 决策），而离线、保存失败、实时断线恰恰是 v2.0 的主要风险（B3、B5 在 KNOWN-BUGS.md 的“仍未验证”里）。

**How to avoid:**
- 最稳的办法是**不 mock SDK，而是 mock HTTP 层**：应用里使用真实的、固定版本的 PocketBase SDK，测试里用 Playwright 的 `route` 加 Node 侧的假后端实现 PocketBase 的少量 REST 端点（auth-with-password、records list/view/create/update、`/api/realtime` SSE）。这样 SDK 的真实代码路径被覆盖，mock 只需要对齐 HTTP 契约，漂移面小得多。
- 写一份 `tests/mocks/CONTRACT.md` 类似的契约文档（沿用 v1.0 做法），逐条列出已实现和未实现的行为，并记录对齐的 PocketBase 和 SDK 版本；升级版本时的清单里包含“重新核对契约”。
- 增加**契约自测**：同一组断言既对 mock 跑，也可对本机临时起的真实 PocketBase（合成数据）跑，两边都通过才算对齐（Pitfall 19 里的集成冒烟）。
- 这个里程碑要把关键错误路径补进 mock：保存失败、401 过期、网络断开、规则返回空列表、实时断线重连。

**Warning signs:**
- SDK 升级后全部测试仍绿，但手测有差异。
- mock 里出现 SDK 内部结构的假设。
- CONTRACT 文档里没有版本号。

**Phase to address:** P-TEST（贯穿，先于 P-CLIENT 的同步实现开始）。

---

### Pitfall 21：实时测试不稳定

**What goes wrong:**
SSE 事件的到达时间不确定，测试用 `waitForTimeout` 等待，偶尔红；重连、防抖和计时器交织；两个页面上下文之间的顺序依赖时间。v1.0 的优点是 0 个 flaky，要保持。

**How to avoid:**
- 假后端由测试**显式推送**事件（测试调用 `backend.emit(...)`），而不是靠真实时间；用 Playwright 的 `page.clock`（v1.0 已经使用 manual 时钟）推进防抖和重连退避。
- 等待“状态”而不是“时间”：像 v1.0 的 `app.expectSaved()` 一样，提供 `app.expectSynced()`，在 DOM 或可观察状态上轮询，而不是睡眠。
- 双客户端用例用同一个假后端的两个页面上下文，推送顺序由测试脚本固定。
- 保留 v1.0 的约束：1 个 worker、低优先级、不并发；`check-report` 要求 0 flaky。
- 重连用例：由假后端主动断开 SSE，断言重连后触发补拉，而不是断言“事件被补发”。

**Warning signs:**
- 用例里出现 `waitForTimeout`。
- 重跑才通过。
- 报告里出现 flaky 标记。

**Phase to address:** P-TEST。

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| 整份文档盲写（沿用 `ref.set`） | 改动最少 | 多设备/离线必丢数据（Pitfall 1） | 永不用于多设备版本 |
| 后台点点点配规则，不写迁移文件 | 快 | 规则无法评审、无法回滚、升级后漂移 | 仅限第一次摸索，上线前必须导出成迁移 |
| CSP 用 `'unsafe-inline'` | 不用算哈希 | XSS 一旦成立可直接执行 | 过渡期可以，需记录并在后续替换为哈希 |
| 只做 `localStorage` 作为离线队列 | 最简单 | iOS 清除、微信内置浏览器差异 | 可以，但要加“未上传 N 条”提示和一键导出 |
| 用 Cloudflare 橙云“加速” | 免费、省事 | SSE 超时、大陆不一定变快、证书验证受影响 | 不用于 API 域名；除非大陆实测证明更好 |
| 硬编码服务器地址 | 省一个配置 | 公开仓库泄漏、测试可能打线上 | 永不；使用同源相对路径 |
| 跳过恢复演练 | 省半天 | 备份可能不可用 | 永不；上线前至少演练一次 |
| 把已知 bug（N3、B5）继续留着 | 控制范围 | 在云端版里后果放大 | 只有 B9 等低影响项可以继续留 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PocketBase 规则 | 留空字符串、只检查登录、漏写 update/delete | 五条规则都 `owner = @request.auth.id`，禁止改 owner，写迁移，跑隔离探针 |
| PocketBase 实时 | 认为断线期间的事件会补发 | 重连（`PB_CONNECT`）后重新拉取并合并，加低频兜底轮询 |
| PocketBase SDK | 用 CDN 链接引入；与服务端版本不配套 | 自托管固定版本文件，与服务端版本成对记录 |
| PocketBase SDK 自动取消 | 同一类请求连续发出，前一个被自动取消并抛 `ClientResponseError`，被当成保存失败 | 给保存请求设独立 `requestKey`，或关闭自动取消，并区分“被取消”和“真失败” |
| 反向代理（Caddy/nginx） | 未设 PocketBase 的 IP 头，限速按 127.0.0.1 工作；SSE 被缓冲；`/_/` 暴露 | 配置 User IP proxy headers；SSE 不缓冲、读超时足够长；限制 `/_/` |
| Let's Encrypt/Caddy | 只开 443 或只开 80；开橙云；DNS 改动 | 80 和 443 都开，DNS-only，监控证书剩余天数 |
| Google Fonts | 保持阻塞渲染的外部样式表 | 删除或自托管子集化 woff2 加 `font-display: swap` |
| 旧 Artifact 导出文件 | 假设与新格式一致 | 导入时按版本迁移（旧类别名、位置 id、没有计划字段），先校验再预览差异 |
| Playwright 网络护栏 | 为了让应用能连 mock 而放开全部出网 | 只放行 mock 来源，其余一律失败并让用例变红 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 每次保存上传整份并整份推送 | 大陆侧保存慢、手机耗流量 | 拆分记录，只传变更；防抖保持 | 整份超过约 200 KB 时明显 |
| 每个实时事件触发 `renderAll()` | 输入卡顿、草稿被清（B1/N1） | 应用远端变更前判断是否有输入焦点；最小化重绘 | 两台设备同时在线就会出现 |
| 全量重绘加按日期扫描所有日志 | 渲染变慢（CONCERNS.md） | 按日期建索引（后续） | 日志数千条后 |
| 登录页等待 Google Fonts 超时 | 大陆首屏白屏数秒 | 自托管或去掉 | 一开始就会发生（大陆） |
| 重连风暴 | 网络差时反复建立 SSE | SDK 内置退避；兜底轮询加抖动 | 网络反复断续时 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 集合规则留空或只检查登录 | 任意人读写所有账号数据 | 全部显式 owner 规则，隔离探针（Pitfall 2） |
| `/_/` 公网可达 | 后台暴力破解，超级用户绕过所有规则 | 代理按 IP 限制，Superuser IPs，MFA（Pitfall 3） |
| 令牌存 `localStorage` 加 XSS | 账号被接管 | 全量转义、CSP、短有效期、同源资源（Pitfall 11） |
| 开放注册或 OAuth | 陌生人获得账号 | `users` 的 createRule 为 null，仅超级用户创建 |
| 凭据和服务器信息进公开仓库 | 永久泄漏 | 隐私检查加规则；占位符；真实值只在服务器和 `private/` |
| CORS 设成 `*` 又带凭据 | 其他网站可借用户登录态访问 | 页面和 API 同源，不需要 CORS；PocketBase 默认允许所有来源，需在代理收紧或仅服务同源（官方 going-to-production 未涉及 CORS，LOW，以实测为准） |
| 导入文件可注入 HTML | 持久化 XSS | 深度校验加转义（Pitfall 8、11） |
| 备份含个人数据放在公共桶 | 数据泄漏 | 私有桶，加密，最小权限 |
| 登录端点无限速 | 密码猜测 | PocketBase 限速加代理限速加长密码 |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| 状态栏在断线时仍显示“已同步” | 用户以为数据安全，其实只在本机 | 明确显示“离线，N 条未上传”和“实时已连接/仅手动” |
| 登录页在大陆首屏白屏 | 第一印象差，用户以为坏了 | 无外部依赖，加载中有占位文案 |
| 导入确认框只问“确定吗” | 误操作清空数据 | 显示条数差异、导入前自动留底、可撤销 |
| 编辑计划时删除任务没有提示进度影响 | 进度条突然变化 | 删除前提示“已完成的记录将保留但不计入进度”，可撤销 |
| 实时更新时界面重排 | 正在看的位置跳动、输入丢失 | 输入中延迟应用，并给出“有新更改”提示 |
| 忘记密码没有恢复路径 | 用户被锁在外面 | 事先约定由超级用户重置，写进主人自己的运维笔记 |
| 手机微信内置浏览器无法下载导出文件 | 备份导出失败（LOW，需真机验证） | 提示“用系统浏览器打开”，导出失败时给出可复制的文本方案 |

## "Looks Done But Isn't" Checklist

- [ ] **账号隔离：** 常漏 `viewRule`/订阅规则或 `create` 时的 owner 校验 — 用账号 A 的令牌对账号 B 的记录做 list、view、update、delete、订阅，全部失败
- [ ] **管理后台：** 常漏外网可达性检查 — 用手机流量访问 `/_/`，期望 404 或 403
- [ ] **HTTPS 续期：** 常漏 80 端口和 DNS 变更 — 用 Caddy 日志和证书到期天数检查，并在测试域名上强制续期一次
- [ ] **大陆可达：** 常只在海外测过 — 请大陆用户在晚高峰用 4G 和家宽分别打开登录页、记一条、观察另一台设备是否更新，记录首屏时间
- [ ] **实时同步：** 常漏重连后补拉 — 断网 30 秒再恢复，另一台设备在此期间的记录应出现
- [ ] **离线：** 常漏刷新后队列仍在 — 离线记 3 条、刷新、关页重开、联网，服务器上有 3 条
- [ ] **导入：** 常漏畸形文件和差异确认 — 导入 `{}`、`[]`、缺 `date` 的日志、含 HTML 的文本，均被拒绝或安全显示
- [ ] **计划编辑迁移：** 常漏旧状态迁移的幂等性 — 旧状态加默认计划，迁移两次，勾选对应不变
- [ ] **备份：** 常漏恢复演练和异地副本 — 在另一台机器恢复，记录条数一致
- [ ] **重启：** 常漏开机自启 — 真的重启 VPS，站点自动恢复
- [ ] **隐私：** 常漏新类型的泄漏 — `git grep` 域名、IP、token 形状、`pb_data`，未登录访问静态页源码无个人词条
- [ ] **测试隔离：** 常漏“只放行 mock” — 故意让应用请求一个外部主机，用例必须变红
- [ ] **时区：** 常漏双时区 — `Asia/Shanghai` 与 `America/Los_Angeles` 打开同一数据，日志日期不变

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 被覆盖/清空的账号数据 | MEDIUM | 从服务器端导入前快照或最近备份恢复；没有快照时用任一设备本地缓存或用户的 JSON 备份 |
| 规则泄漏被发现 | HIGH | 立即改规则并重启，轮换所有用户令牌（改密码使旧令牌失效），审计日志，告知受影响用户 |
| 超级用户凭据泄漏 | HIGH | 改密码，重置 MFA，限制 IP，轮换 `PB_ENCRYPTION_KEY` 保存的外部凭据，检查是否有被改动的规则 |
| 凭据或域名提交进公开仓库 | HIGH | 视为已泄漏：轮换凭据；必要时更换域名/IP；重写历史并强制推送；检查被 fork 和缓存的副本 |
| 证书过期 | LOW | 修复 80/443 可达性，重启 Caddy 触发续期；必要时临时用 DNS 验证 |
| 磁盘写满 | LOW | 清理日志和旧备份，扩容或迁移 |
| 商家问题 | MEDIUM | 用异地备份和部署脚本在新机器重建，改 DNS（TTL 短则快） |
| 升级失败 | MEDIUM | 停服务，换回旧二进制，恢复升级前备份 |
| 位置 id 错位 | HIGH | 需要从升级前备份恢复 `tasks` 状态，再按稳定 id 重新迁移；所以迁移前必须留底 |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 整份 LWW 覆盖 | P-CLIENT（数据模型先定于 P-BACKEND） | 双设备离线/在线合并用例，不丢记录 |
| 2 规则泄漏 | P-BACKEND、P-OPS | 隔离探针：list/view/update/delete/订阅全部失败 |
| 3 `/_/` 和超级用户 | P-INFRA、P-BACKEND、P-OPS | 外网访问 `/_/` 被拒，仓库无凭据 |
| 4 第三方资源被墙 | P-CLIENT、P-TEST | 所有请求同源，CSP `default-src 'self'`，测试拦截仍绿 |
| 5 线路差/假香港 | P-INFRA（用户采购验收） | 晚高峰三网 mtr，丢包低，大陆用户实测 |
| 6 SSE 静默断开 | P-CLIENT、P-INFRA、P-OPS | 断网 30 秒再恢复后补拉；真机锁屏回来后数据最新 |
| 7 实时回声/重绘覆盖草稿 | P-CLIENT、P-TEST | 双客户端用例：对端保存不清草稿，无回写循环 |
| 8 导入清空（N3 放大） | P-IO、P-TEST | N3 用例转为通过；导入前快照存在 |
| 9 位置 id 迁移 | P-PLAN | 迁移幂等测试；重排后勾选不跑位 |
| 10 个人计划泄漏/静态页公开 | P-INFRA、P-PLAN | 无痕访问页面源码无个人词条；隐私检查新规则通过 |
| 11 XSS 变持久化 | P-CLIENT、P-PLAN、P-INFRA、P-TEST | 合成注入载荷无执行；CSP 头存在 |
| 12 状态过大/整份传输 | P-BACKEND、P-CLIENT | 保存前大小检查；拆分记录；失败可见可重试 |
| 13 日期/时区 | P-CLIENT、P-TEST | 双时区用例，日志日期字符串不变 |
| 14 离线队列丢失 | P-CLIENT、P-OPS | 离线记录刷新重开后联网上传；“未上传 N 条”可见 |
| 15 备份 | P-INFRA、P-OPS | 异地副本存在；恢复演练通过 |
| 16 升级破坏/来源变化 | P-INFRA、P-OPS | 固定版本和校验和；升级清单走过一次 |
| 17 续期/自启/磁盘 | P-INFRA、P-OPS | 重启后自动恢复；到期监测；磁盘告警 |
| 18 隐性费用/超卖 | P-INFRA | 月付试用；账单核对；退出方案 |
| 19 测试打到真实服务器 | P-TEST、P-CLIENT | 白名单护栏自检；仓库无服务器地址 |
| 20 mock 漂移 | P-TEST | 契约文档带版本；mock 与本机真实实例同组断言 |
| 21 实时测试 flaky | P-TEST | `check-report` 0 flaky，无 `waitForTimeout` |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| VPS 选型与购买 | 线路差、假香港、隐性费用 | 用户本人晚高峰实测，月付试用 |
| 反向代理与 HTTPS | SSE 缓冲、`/_/` 暴露、续期失败 | Caddy，限制后台路径，80/443 都开，监测 |
| 集合和规则 | 规则漏写 | 迁移文件加隔离探针 |
| 数据模型 | 整份过大、LWW | 拆分记录、按条目合并 |
| 存储适配器和登录 | 令牌 XSS、加载前编辑丢失（B3）、保存失败不重试（B5） | 转义加 CSP，加载完成前禁用编辑，失败保留脏标记 |
| 离线和实时 | 回声、断线漏事件 | 版本号去回声，重连后补拉加兜底轮询 |
| 编辑计划 | 位置 id、新自由文本 | 先冻结 id 迁移，再放开编辑；统一转义 |
| 导入导出和迁移 | N3 清空、旧格式 | 严格校验、差异确认、自动留底 |
| 测试改造 | 打线上、mock 漂移 | 只放行 mock，mock HTTP 层而不是 SDK |
| 上线验收 | 备份未演练、重启未验证 | 恢复演练和重启作为门槛 |

## 需要阶段内再研究的点

- **大陆实际可达性：** 没有大陆侧实测数据，所有判断来自博客和论坛。上线前必须由大陆用户在晚高峰实测。（LOW）
- **Caddy 对 PocketBase SSE 的默认刷新行为：** 搜索只找到 nginx 指南，没有 PocketBase 加 Caddy 的明确文档，需要在部署阶段直接验证。（MEDIUM）
- **PocketBase 客户端重连后是否自动恢复订阅，以及断线期间事件是否补发：** 官方页面没有说明。按“不补发”设计是安全的。（MEDIUM）
- **PocketBase 新发布渠道：** 发布说明提到更新来源变更，需要用户核实最新的官方下载和校验方式。（MEDIUM）
- **微信内置浏览器的存储和下载行为：** 未验证。（LOW）
- **CORS 默认行为和 CSP 与单文件内联脚本的兼容：** 需要实测。（LOW）
- **HTTP/3（QUIC）：** GFW 自 2024 年起对 QUIC Initial 包按 SNI 过滤（USENIX Security 2025 论文，MEDIUM 到 HIGH；Lantern 的摘要是自动整理的，数字要对照论文）。浏览器会回退到 TCP，通常只是偶发延迟，但 Caddy 默认启用 HTTP/3；若大陆实测出现连接建立慢，可在 Caddy 里关闭 HTTP/3，只保留 HTTP/1.1 和 HTTP/2。

## Sources

**官方文档（HIGH）**
- PocketBase API rules and filters：https://pocketbase.io/docs/api-rules-and-filters/ （规则的 null/空字符串/表达式三种状态，规则兼作过滤器，update/view 不满足返回 404，list 不满足返回空列表）
- PocketBase Going to production：https://pocketbase.io/docs/going-to-production/ （备份、速率限制、Superuser IPs、MFA、反向代理示例、ulimit、GOMEMLIMIT、SMTP、`PB_ENCRYPTION_KEY`、代理 IP 头）
- PocketBase Realtime API：https://pocketbase.io/docs/api-realtime/ （SSE、`PB_CONNECT`、5 分钟空闲断开、订阅用 ViewRule/ListRule 授权）
- PocketBase Collections：https://pocketbase.io/docs/collections/ （字段和视图集合不产生实时事件）
- PocketBase JS SDK：https://github.com/pocketbase/js-sdk （本地构建、`LocalAuthStore` 使用 localStorage、自动取消、自动重连；页面注明仓库已迁移并归档）
- PocketBase v0.23 升级说明：https://pocketbase.io/v023upgrade/jsvm/ 、https://pocketbase.io/v023upgrade/go/ （管理员变为 `_superusers`，移除 `/api/admins/*`，迁移快照）
- PocketBase 发布页（MEDIUM，需用户核实年份和新发布来源）：https://github.com/pocketbase/pocketbase/releases 、https://github.com/pocketbase/pocketbase/releases/tag/v0.40.6
- JSON 字段 `maxSize` 默认 1 MiB（MEDIUM）：https://pocketbase.io/jsvm/interfaces/core.JSONField.html

**学术和测量（MEDIUM）**
- Zohaib 等，SNI-based QUIC censorship of the GFW，USENIX Security 2025：https://www.usenix.org/conference/usenixsecurity25/presentation/zohaib
- GFW 对 SNI 的过滤独立于目的 IP；HTTPS 的 SNI 封锁覆盖域名少于 HTTP 主机头（Lantern corpus 摘要，MEDIUM）：https://corpus.lantern.io/papers/2024-hoang-gfweb/ 、https://corpus.lantern.io/findings/2021-basso-measuring__china-sni-doh-rst-injection/
- Let's Encrypt 在中国的 OCSP 连通性讨论（MEDIUM）：https://community.letsencrypt.org/t/can-i-use-the-lets-encrypt-in-china-will-it-be-blocked/137004

**社区和厂商（LOW 到 MEDIUM，需自行验证）**
- Google Fonts、jsDelivr、unpkg、cdnjs 在大陆的可达性报告：https://discourse.psychopy.org/t/cdn-jsdelivr-net-has-been-blocked-in-china-is-there-any-possible-change-the-source-of-css/29212 、https://github.com/joway/fonts 、https://forum.springdoc.cn/t/topic/4657
- SSE 与代理：https://github.com/pocketbase/pocketbase/discussions/5122 、https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/markdown
- Cloudflare 与大陆、SSE 超时（V2EX 和厂商页面，LOW）：https://www.cloudflare.com/vi-vn/china-network/ 、https://v2ex.com/t/965988
- Caddy 证书续期故障（社区论坛，MEDIUM）：https://caddy.community/t/caddy-ssl-renewal-failure/21148 、https://caddy.community/t/https-tls-certificate-authorization-fails-when-port-80-is-not-open/9207
- 线路和 VPS 隐性费用（厂商博客，LOW，带促销性质）：https://server.hk/blog/hidden-fees-to-avoid-when-choosing-hong-kong-vps-hosting/ 、https://dev.to/devguoo/cn2-gia-vs-regular-vps-speed-comparison-2026-real-data-bao
- 备案要求（阿里云帮助中心，MEDIUM）：https://help.aliyun.com/zh/dws/faq-about-icp-filing
- Safari 7 天存储上限与主屏幕应用豁免（报道和 WebKit 缺陷记录，MEDIUM，细节有冲突）：https://bugs.webkit.org/show_bug.cgi?id=211775 、https://searchengineland.com/what-safaris-7-day-cap-on-script-writeable-storage-means-for-pwa-developers-332519

**本仓库（HIGH）**
- `.planning/PROJECT.md`、`.planning/codebase/CONCERNS.md`、`.planning/codebase/INTEGRATIONS.md`、`tests/KNOWN-BUGS.md`、`PRIVACY.md`

---
*Pitfalls research for: 多账号云端版（PocketBase、香港/东京 VPS、中美双地用户）*
*Researched: 2026-11-05*
