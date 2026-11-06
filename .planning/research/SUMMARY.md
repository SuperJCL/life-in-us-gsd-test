# Project Research Summary

**Project:** 在美国的日子 — v2.0 多账号云端版
**Domain:** 单文件原生前端 + 自托管 PocketBase 的 3 账号、离线优先、实时同步个人记录应用
**Researched:** 2026-11-05
**Confidence:** MEDIUM（PocketBase 规则、SDK、Caddy 和厂商价格多为官方一手资料；大陆线路质量、iOS 存储回收、微信内置浏览器行为只有二手资料或推断）

详细材料见同目录的 STACK.md、FEATURES.md、ARCHITECTURE.md、PITFALLS.md。本文件只做合并、取舍和给路线图的建议。

## Executive Summary

这是一个已有 154 条回归用例的单文件应用，要在不换框架、不改界面的前提下，加上账号、云端存储、多设备实时同步、离线优先和可编辑计划。

四份研究的主线一致：
- 用一个 PocketBase 二进制，放在一台香港或东京的 1 GB VPS 上。它自带 SQLite、认证、规则、SSE、后台和备份。
- 前面用 Caddy 自动配 HTTPS。
- 前端静态文件由 PocketBase 的 `pb_public` 同源托管，SDK 自托管并固定版本。
- 现有的 `{label, load, save}` 存储适配器是天然的接缝：保留它，扩展出订阅、版本号和状态上报。
- 旧的 `window.claude`/localStorage 路径留在配置缝后面作回退，这样 154 条用例可以原样通过。

推荐按"不可逆程度"排列风险：
1. 最先做不碰后端的重构：把计划移出代码、冻结现有任务 id、补上转义和校验。它改动面最大，但 154 条用例能完整兜住。
2. 其次是服务器规则和隔离脚本，以及假服务器和 cloud harness。
3. 然后接入登录与存储，再做离线和实时。
4. 最后是导入导出、计划编辑页、部署与验收。

另有一条不依赖代码的并行轨道：所有者购买 VPS 和域名，并做大陆可达性探针。这是最大的未知项，而且要等待，必须最早启动。

主要风险有四类：
- **数据丢失：** 整份文档以最后写入为准时，在过期缓存上记的第一笔会覆盖其他设备。现有 `flush` 又在保存前就清脏标记。所以必须做到三点：对账前禁止编辑、保存失败不清脏标记、覆盖前留底。
- **隔离与暴露：** PocketBase 默认的 `users` 集合允许任何人注册，后台 `/_/` 暴露在公网，规则写错时表面上只是"列表为空"。
- **信任边界变化：** 数据改为来自服务器和导入文件后，既有的 XSS 缺口变成持久化的、能偷登录令牌的缺口，不能再留在范围外。
- **公开仓库隐私：** 静态页对未登录者可读，所以不能含任何个人计划文字。

## 研究文件之间的分歧与推荐解决方式

| 议题 | 各文件的说法 | 推荐解决 | 理由 |
|------|--------------|----------|------|
| 数据模型 | **STACK：** 每账号一条 `journals` 记录，`state` 和 `plan` 两个 JSON 字段。**ARCHITECTURE：** `journey_docs` 集合，每账号两条记录，用 `kind` 区分 `state`/`plan`，`owner` 加 `(owner,kind)` 唯一索引。**PITFALLS：** 倾向进一步拆分 logs | **采用 `journey_docs` + `kind`**，只有 `state` 与 `plan` 两种取值。不拆 logs，`kind` 留作日后分片的扩展点 | 两种方案都能把计划写入和记录写入分开。`kind` 记录各有独立的 `updated`，对账（本机基线对服务器版本）可以逐个文档做，实时事件也自带 `kind` 方便分派；只有一套规则、一套索引，隔离脚本只需覆盖一个集合。单记录双字段只需建一条记录，但每次记一笔的推送都会带上 plan，对账基线也只有一个。拆 logs 要重写现有的"改 state、persist、renderAll"闭环，违反"沿用现有状态格式"，留给 v3 |
| 首次创建记录 | **STACK：** 所有者建账号时在后台同时建空记录，客户端只读。**ARCHITECTURE：** 客户端首次创建，加唯一索引；可选用 `pb_hooks` 自动建 | **默认由客户端首次创建，加唯一索引；遇到冲突（400）就重新读取再更新**。`pb_hooks` 自动建作为可选加固，由所有者在需求阶段决定 | 客户端创建路径能被假服务器测到；hook 是服务器侧代码，mock 测不到。两种做法都要求 `deleteRule = null` |
| 冲突粒度 | **PITFALLS：** 应落在条目粒度，logs 按 id 取并集加墓碑。**FEATURES 与 ARCHITECTURE：** 整份 LWW 加保护，并集留作后续。**所有者已定：** 离线优先，最后写入为准 | **v2.0 做整份文档 LWW，必须带三项保护**：联网时对账完成前禁止编辑（最多约 3 秒）；上传前比对基线 `updated`；真冲突时把被覆盖的服务器版本在本机留一份、给出提示并可下载。schema 里 logs 已有稳定 id，以后做并集不受阻 | 这符合所有者的决定。最常见的丢数据路径是在过期缓存上直接记录，"对账门控"把它消掉了；剩下的真冲突在 3 人规模下很少见。并集合并没有墓碑，删掉的记录会复活，也改变了"最后写入为准"的字面含义，应由所有者明确选择（见下文"待决策"） |
| PocketBase 版本 | **STACK：** 新站 v0.41.1（2026-10-28）；GitHub 只到 v0.40.6，仓库已归档。**ARCHITECTURE 和 PITFALLS：** 两边不一致，需核实 | **采用 STACK 的结论：固定 0.41.1**，从维护者新站下载，核对 `checksums.txt`，部署时用 `--version` 复核。GitHub 上的 v0.40.6 留作回退，确认可用的 zip 在服务器之外另存一份 | STACK 直接读了发布说明、官方文档页眉和新站发布接口，证据最强；ARCHITECTURE 和 PITFALLS 是较早的核对。新站由一人维护，所以要固定版本、核对校验和，禁止在生产机上随手 `pocketbase update` |
| SDK 版本与文件 | **STACK：** 0.28.2，`dist/pocketbase.iife.js`。**ARCHITECTURE：** 0.28.1 的 `pocketbase.umd.js` | **采用 0.28.2，以 vendoring 时实际存在的 dist 文件为准**（STACK 读过 iife，全局名 `PocketBase`）。记录 sha256，不走 npm，也不走 CDN | 文件名不同只是核对时间不同；本质要求一样：同源、固定版本、不进 package.json |
| SDK 与服务器配套 | **STACK：** 没有公布兼容表，按"最新对最新"，MEDIUM | 在 `PB-CONTRACT.md` 里写明"服务器 0.41.1 配 SDK 0.28.2"，用本机真实实例上的隔离脚本和同步冒烟确认 | 防止 mock 漂移（PITFALLS 20） |
| `users` 默认规则 | **STACK：** 读了源码，`CreateRule = ""`（任何人可注册），`DeleteRule` 允许删除自己。**ARCHITECTURE：** 默认值 MEDIUM，需断言 | **按 STACK 的结论视为已确认**。迁移里显式把 `createRule`、`deleteRule` 设为 null，隔离脚本断言匿名创建被拒 | 源码证据比文档推断强；断言照样保留 |
| token 有效期 | **STACK：** 源码默认 5 天。**ARCHITECTURE：** LOW，只见到 14 天的第三方说法。**FEATURES：** 没找到 | **以源码的 5 天为准，显式设成 90 天以上**；每次联网启动时调用 `authRefresh()` | 5 天不够"离线很久后再联网上传"，过期后上传会 401。显式设置后，默认值的争议就无关紧要了 |
| 示例计划形状 | **ARCHITECTURE：** 与原计划同形状（组数、每组任务数、力量项、预设数），v1 用例几乎不用改。**FEATURES：** 新账号给小示例（约 2 组，每组 3 个任务，2 个力量项） | **应用内置的合成 `DEFAULT_PLAN` 用同形状**，只含通用占位文字，以保住 154 条用例。新账号是否另给一份更小的示例，由所有者作为产品决定 | 计划改由服务器提供后，cloud 模式的测试可以用假服务器注入计划；只有旧路径回退和 v1 用例依赖内置默认。同形状成本最低 |
| `updateRule` 写法 | **STACK：** `@request.body.owner:changed = false`。**ARCHITECTURE：** `:isset = false`，同时禁止 `owner` 和 `kind` | **采用 ARCHITECTURE 的写法**：更新请求里不允许出现 `owner` 和 `kind`。在隔离脚本中用真实 PocketBase 验证组合行为 | 更严格。两种语法都在官方文档里，但组合起来的行为只有 MEDIUM 置信度，必须实测 |
| Caddy 配置 | **STACK：** 关 HTTP/3、开压缩、`read_timeout 360s`。**ARCHITECTURE：** `stream_close_delay 5m`。**PITFALLS：** 同样提醒 HTTP/3 在大陆可能偶发变慢 | **三者合并**：`protocols h1 h2`、`encode zstd gzip`、`stream_close_delay 5m`。SSE 不缓冲这一点在部署阶段直接验证 | 三者不冲突。HTTP/3 对大陆的影响只是社区经验，所以采用保守做法：默认关闭，实测后再决定 |
| 后台 `/_/` 暴露 | **PITFALLS：** 在代理层按 IP 限制。**STACK：** IP 经常变，别把自己锁在外面 | **必做：** 强密码、superuser MFA/OTP、内置限流、配置"用户 IP 代理头"。**可选：** Caddy 层 IP 限制，只在所有者 IP 固定时开启；并写明用 `superuser ips` 命令行重置的救援办法 | 兼顾安全与可恢复 |
| Google Fonts | **STACK、PITFALLS：** 直接去掉，用现有回退字体栈。**ARCHITECTURE：** 改成不阻塞加载，或自托管子集 | **去掉 `<link>`，用现有的 `Songti SC`/`STSong`/Georgia 回退**。这是 v2.0 唯一允许改动的外部资源，外观须所有者确认可接受 | 最简单也最彻底；自托管中文子集字体体积大、维护成本高 |
| 冷启动离线（Service Worker） | **STACK：** 先做数据层，再决定。**ARCHITECTURE：** 建议纳入，放在靠后。**FEATURES：** 列为 MVP | **纳入范围，但放到部署阶段末尾**；是否做由所有者在需求阶段确认。如果做，要单独放开 Playwright 的 `serviceWorkers: 'block'` | 它会改变"单文件"的形态，又与缓存更新策略相关，不应阻塞数据层 |
| 回声抑制 | **STACK：** 用 `record.updated` 或版本号。**ARCHITECTURE：** 用每次页面加载生成的 `writer` 字段，订阅只取元数据 | **采用 `writer`**，每次页面加载生成一个随机值 | 本设备 PATCH 的响应可能晚于推送到达，比较 `updated` 有竞态。每个页面一个值，还能让同一浏览器的两个标签页互相同步 |

## Key Findings

### Recommended Stack

推荐的组合：
- **服务器软件：** PocketBase 0.41.1（linux_amd64 预编译包）、官方 JS SDK 0.28.2（iife，同源托管，约 40 KB）、Caddy 2.11.9。
- **机器和域名：** 一台 1 GB 内存的 Ubuntu LTS VPS，一个 `.com` 域名。
- **备份：** PocketBase 内置 cron（`0 3 * * *`，保留 7 份），再加一个 S3 兼容的异地桶。首选 Cloudflare R2，免费额度内不收费；Backblaze B2 作备选。
- **集合和规则：** 写成 `pb_migrations/*.js` 进 git，只含结构，不含数据。
- **测试：** 沿用 `@playwright/test` 1.64.1，不新增依赖；用真实 SDK 配 Node 侧假服务器和页面侧假 `EventSource`。
- **月成本：** 约 6–7 美元。

**Core technologies:**
- **PocketBase 0.41.1：** 负责认证、规则、记录、SSE、后台、静态托管和备份。单个二进制就覆盖全部需求。0.x 版本不承诺兼容，必须固定版本，升级前先备份。
- **PocketBase JS SDK 0.28.2：** 负责登录、令牌、记录读写、订阅与自动重连。同源自托管，关闭 `autoCancellation`。
- **Caddy：** 负责自动 HTTPS、压缩和反向代理。PocketBase 只监听 127.0.0.1；关闭 HTTP/3；DNS 只做解析，不开 Cloudflare 橙云。
- **systemd：** 负责开机自启和崩溃重启。配置 `Restart=always`、`LimitNOFILE=4096`、`GOMEMLIMIT`，用非 root 用户运行。
- **`pb_migrations`：** 规则即代码，可以评审、可以重放，也能被隔离脚本反复验证。

### Expected Features

**Must have（table stakes）:**
- **登录与会话：** 登录页；会话持久化（先用缓存渲染，再 `authRefresh`）；退出；遇到 401 时保留本机未上传的修改。
- **账号隔离：** 靠集合规则实现，并在真实 PocketBase 上做隔离冒烟。
- **计划存服务器：** 所有常量改为读计划；稳定 id，冻结 `P<n>`、`P<n>-<i>`，新增项用 `g-`/`t-`/`l-` 前缀，显示用的标签在渲染时生成。
- **编辑计划页：**
  - 能编辑目标组、任务、力量项、周健身目标和基础预设；
  - 支持上移下移，删除时归档而不是硬删，草稿式保存/取消，带校验和空状态；
  - 不新增第五个标签，用 `#plan` 路由进入。
- **云端存储与实时同步：** 记录和计划都存云端并实时同步；远端更新不毁草稿；每次重连和回到前台都整份对账。
- **离线：**
  - 离线时先存本机，失败自动重试，脏标记落盘，首次对账之前不上传；
  - 状态栏有一个状态机：已同步、保存中、离线 N 项、失败重试、登录过期。
- **导出导入：**
  - 导出用 Blob 下载，不再依赖 `downloads`；
  - 导入时识别格式、拒绝非备份文件、做深度校验，并显示摘要让用户确认，以此修好 N3。
- **迁移与测试：** 车主种子计划脚本（本地运行、不进 git）加迁移流程；测试套件继续通过。

**Should have（differentiators）:**
- 冲突前把服务器版本在本机留底，可以下载。推荐在同一里程碑内做。
- 导入前自动快照，支持撤销导入；修 B2（取消后可以重选同一个文件）。
- 计划页保存时检测"已在别处更改"。
- Service Worker 加 manifest，支持冷启动离线和添加到主屏幕。

**Defer（v2.x 及以后）:**
- logs 冲突时按 id 取并集，加已删除列表；计划页跨组移动、拖拽排序；跨标签页登出传播；Web Share API 导出兜底。
- **明确不做：** 公开注册、忘记密码邮件、第三方登录、多账号切换、在线状态、字段级合并、版本历史、可编辑类别、"恢复默认计划"按钮、合并式导入、推送通知、应用内管理后台、界面重做。

### Architecture Approach

- **存储适配器：** 在现有 `{label, load, save}` 上加 `subscribe`、`sync` 和状态上报，由 `makeDocStore(kind)` 产出 `state` 与 `plan` 两个实例。
- **保存与缓存：**
  - `persist/flush` 泛化为 `makeSaver`；队列退化为"最新整份文档 + dirty + seq"。
  - 本机缓存用 localStorage，因为 `pagehide` 时能同步写入；缓存键按用户 id 分开。
- **远端更新：** 所有远端更新都只经 Sync 控制器进入，先放进 pending，等空闲时才应用并 `renderAll()`。空闲的条件是：没有打开的编辑弹窗、没有获得焦点的输入框、没有草稿、复盘没在防抖、本机没有未上传的改动。
- **配置缝：** `USJ_CONFIG.backend` 决定走云端还是旧路径，v1 的 154 条用例走旧路径。

**Major components:**
1. **Config seam + Auth：** 登录页、`boot()`、`authRefresh`；登出顺序是先退订，再清缓存，最后清令牌。
2. **`plan` 全局对象：** 配 `normalizePlan` 和合成的 `DEFAULT_PLAN`，取代 `GROUPS`/`BUILTIN`/`GCAT`/`LIFTS`/`FIT_GOAL`，涉及约 26 处引用。
3. **同步层：** `makeDocStore`、本机缓存和 Sync 控制器（对账表 7 行、退避重试、回声抑制、空闲时应用）。
4. **PocketBase 集合与规则：** `journey_docs`，`maxSize` 4 MiB，`deleteRule = null`；配套 `tools/pb-rules-check`。
5. **编辑计划页与导入导出：** 编辑计划页走 `#plan`，草稿式保存/取消。
6. **测试：** `FakePbServer`，页面侧替换 `fetch`/`EventSource`，配 `PB-CONTRACT.md`。`npm test` 走旧路径，发布前跑 `npm run test:cloud`。

### Critical Pitfalls

1. **整份 LWW 在过期缓存上覆盖别的设备：** 联网对账前禁止编辑；比对基线 `updated`；真冲突时留底；`flush` 失败不清 `dirty`（修 B5）。
2. **规则写错或默认开放注册：** 迁移里显式写全部规则，`users` 的 `createRule`/`deleteRule` 设为 null。用真实 PocketBase 跑隔离脚本，覆盖匿名创建、跨账号读写、改 owner、删除和超限。
3. **后台与超级用户凭据暴露：** 强密码、MFA、限流、代理 IP 头；凭据只在服务器上输入，不进仓库。
4. **既有 XSS 变成持久化的令牌窃取：** 加载、实时、导入三个入口共用同一套深度校验；id 用白名单正则；用户文本走 `esc()`；加 CSP 和安全响应头。
5. **导入 `{}` 清空整个账号（N3 被放大）：** 严格区分"新包装 / 旧裸 state / 非备份"三种文件，非备份直接拒绝；显示摘要让用户确认；导入前留底。
6. **计划可编辑后位置 id 错位：** 先冻结 id 再放开编辑；判断"是否自定义任务"改为查计划，不再用正则；有进度的项删除时只归档。
7. **SSE 静默断开且不补发：** 拉取是基线，实时只是加速；`PB_CONNECT`、`online`、`visibilitychange` 都触发整份对账；状态栏如实显示。

## 本里程碑不能再放在范围外的必修项

这些问题以前列为"已知问题，不修"。研究一致认为，到了云端版它们的后果会被放大，必须纳入 v2.0 的需求。

| 项 | 为什么不能再留 | 落点 |
|----|----------------|------|
| N3：导入 `{}` 清空数据 | 导入后会立即上传，再经实时推送清空所有设备 | 导出导入阶段；`test.fail` 翻成正常断言，同步更新 KNOWN-BUGS 的登记 |
| 转义与 CSP | 数据来自服务器、导入文件和实时推送，令牌又存在 localStorage，一旦被利用就等于账号被接管 | 计划外置阶段做校验与转义，部署阶段加响应头。CSP 优先用内联脚本哈希，实在不行才用 `'unsafe-inline'`，并记录为折中 |
| `users` 的 `createRule` 默认开放 | 任何人都能注册，而且默认允许删除自己 | 服务器规则阶段；迁移里显式设为 null，隔离脚本做断言 |
| SDK `autoCancellation` | 防抖保存连发时，前一次会被取消，表现为偶发丢保存 | 登录与云存储阶段：`pb.autoCancellation(false)`，加 `requestKey: null` |
| JSON 字段 `maxSize` | 默认只有 1 MiB，超限后保存返回 400，而旧代码保存失败不重试 | 迁移里显式设为 4 MiB；保存前检查大小，超过 70% 时状态栏提示 |
| B5：`flush` 在保存前清 `dirty` | 离线队列依赖脏标记，保存失败后会永远不再重传 | 离线优先阶段 |
| B3：加载未完成时的编辑被丢弃 | 对账前的编辑会覆盖服务器上的数据 | 登录与云存储阶段的编辑门控 |
| 其他顺带必修 | token 有效期设到 90 天以上；PocketBase 的"用户 IP 代理头"和内置限流；`requestKey`；CSV 公式注入（B7）；B2 建议一起修 | 各自对应的阶段 |

## VPS 供应商与域名注册商对比（供所有者选择，研究不替所有者决定）

价格取自 2026-11-05。下单前必须在结账页再核对一次最终价格、流量额度和地区。Playwright 和 Claude 都不会替所有者注册、付款或输入密码。

### VPS

| 供应商与地区 | 最便宜且够用的套餐 | 月价 USD | 价格依据（日期） | 置信度 | 付款 | 线路与注意 |
|--------------|--------------------|----------|------------------|--------|------|------------|
| 腾讯云 Lighthouse 香港 | 2 vCPU / 2 GB / 40 GB / 20 Mbps / 512 GB 月流量 | 6.00 | 官方价格文档，页面更新于 2026-09-24 | 价格 HIGH；线路 LOW | 信用卡（美国发行可用）、银行转账；PayPal、支付宝未确认 | 按月订阅，按天折算退款（退到余额，代金券不退）；超出流量按量计费；国际站与大陆站的套餐不同 |
| 腾讯云 Lighthouse 东京 | Razor Speed 2C1G，200 Mbps，不限流量 | 5.00 | 同上 | 价格 HIGH；线路 LOW | 同上 | 东京 Starter 2C2G 为 4.20（512 GB 流量） |
| 阿里云轻量应用服务器 香港 | 2 vCPU / 1 GiB / 30 GiB，峰值 200 Mbit/s | 5（2 GiB 档为 8） | 官方产品页，页面无日期 | 价格 MEDIUM；线路 LOW | 国际站不收大陆发行的卡；PayPal 需非大陆账号；支付宝和微信的说法互相矛盾，按不支持处理 | 价格页上有两个来源的价格表，结账前确认；订阅制，不能按小时计费；页面没写包含多少流量 |
| Vultr 东京 | Cloud Compute 1 vCPU / 1 GB / 25 GB / 1 TB | 5（按小时 0.007） | 官方公开 API，2026-11-05 | 价格 HIGH；线路 LOW | 信用卡、PayPal、支付宝、加密货币、电汇 | 按小时计费，随时可以销毁，但不退款；不需要实名；没有线路优化，东京到电信、联通晚高峰常见丢包（二手资料） |
| Akamai（Linode）东京 | Nanode 1 vCPU / 1 GB / 25 GB / 1 TB | 5（按小时 0.0075） | 官方公开 API，2026-11-05 | 价格 HIGH；线路 LOW | Visa、Mastercard、AmEx、Discover，PayPal 充值 | 按小时计费；没有线路优化 |
| CN2 GIA 香港（以 DMIT 为例） | 入门档约 1 vCPU / 1 GB | 约 39.90 | 二手评测汇总，官网被挑战页挡住 | LOW，未核实 | 未核实 | 超出预算好几倍；经常缺货，各处价格互相矛盾 |
| LightNode（香港、东京） | 未确认具体套餐 | 起价 7.70 | 官网首页，信息不完整 | LOW | 信用卡、银联、支付宝、Google Pay、PayPal | 只有想用支付宝时才值得再核实 |

**没有收入表格的：**
- DigitalOcean 和 Hetzner：没有香港和东京机房（未重新核对）。
- AWS Lightsail：最便宜的带 IPv4 的 5 美元档只有 0.5 GB 内存。
- Oracle 永久免费档：不稳定，未核实。

**采购提醒：**
- 第一次只买 1 个月，不要年付。
- 买之前向商家要测试 IP，在晚上 20:00–23:00 分别从大陆三网和美国测一次延迟和丢包。上线后让大陆用户用 4G/5G 和家宽实测一周，再决定续费。
- 按小时计费的商家，换 IP、换地区几乎没有成本；订阅制商家要走退款流程。
- 服务器必须真的在香港或东京机房，不要选需要备案或实名的"香港"商家。

### 域名注册商（`.com`）

| 注册商 | 每年价格 USD | 依据 | 置信度 | 说明 |
|--------|--------------|------|--------|------|
| Porkbun | 11.81（注册、续费、转入同价） | 官方产品页，2026-11-05 | HIGH | 含 ICANN 费用；WHOIS 隐私和 DNS 免费；可以配 Cloudflare DNS |
| Cloudflare Registrar | 约 10.4–10.5（成本价，注册续费同价） | 官方承诺不加价，具体金额来自对比网站 | MEDIUM | 必须用 Cloudflare DNS，解析记录设成"仅 DNS"（灰云）；没读到付款方式 |
| Spaceship | 续费约 9.98，首年有促销 | 对比网站 | LOW | 最便宜的之一，但只有二手价格 |
| Namecheap | 首年低价，续费约 18 | 对比网站 | LOW | 首年便宜、续费涨价，不适合长期持有 |
| 阿里云、腾讯云域名 | — | — | — | 大陆站要实名；国际站没有价格优势；服务器在境外，不需要备案 |

- 不要买 `.cn`，它要实名和审核。
- DNS 只需一条 A 记录，有 IPv6 再加一条 AAAA；TTL 设短一些，方便换机。
- 预计总成本：VPS 5–6 美元 + 域名约 1 美元 + 备份 0，每月约 6–7 美元，在 4–8 美元的预算内。

## Implications for Roadmap

阶段编号从 Phase 6 接续，v1.0 已用掉 1–5。总体原则：
- 风险最大、回归防线最强的重构最先做；
- 假服务器先于 cloud 前端；
- 服务器规则早于联调；
- 实时放在离线之后；
- 计划编辑器依赖云端存储和导入，放在靠后；
- 部署环节等待时间最长的是用户采购，所以采购轨道最早开始。

### Phase 6：采购与大陆可达性探针（所有者并行轨道，几乎无代码）
**Rationale:** 线路质量是最大的未知项，购买和实测又都要等。越早知道结果，越早能决定用香港还是东京。
**Delivers:** 所有者选定 VPS 与域名并完成购买；搭一个只有 PocketBase 加静态页的最小站点，让大陆和美国用户在晚高峰实测首屏、登录页和 SSE 稳定性；结论作为部署阶段的输入。
**Addresses:** 供应商与域名选择；Pitfall 5、6、17、18。
**Avoids:** 写完代码才发现线路不可用。
**依赖：** 无；与 Phase 7、8 并行。服务器地址、域名和凭据只放在仓库外。

### Phase 7：计划外置、稳定 id、校验与转义（无后端）
**Rationale:** 这是一次涉及约 26 处引用的纯前端重构。最先做，因为 154 条用例是完整的回归防线。
**Delivers:**
- `plan` 全局对象、`normalizePlan`，以及与原计划同形状的合成 `DEFAULT_PLAN`；
- 冻结 `P<n>`/`P<n>-<i>` 作为初始稳定 id，新增项用 `g-`/`t-`/`l-`；
- 判断自定义待办改为查计划；支持归档，`allTasks` 返回归档项；空计划时显示空状态；
- id 白名单校验与统一转义；
- `USJ_CONFIG` 配置缝；去掉 Google Fonts 的 `<link>`；
- 改造 `app-integrity` 的基线机制。

**Addresses:** 计划移出代码、稳定 id、空状态、示例计划。
**Avoids:** Pitfall 9（位置 id）、11（XSS）、4（字体）、10（计划文字进静态页）。
**依赖：** 无。门槛是 v1 全套 154 条通过。

### Phase 8：PocketBase 集合、规则与隔离脚本
**Rationale:** 规则是安全的核心。要在联调之前，用真实 PocketBase 校验假服务器是否保真。
**Delivers:**
- 写成迁移文件：`journey_docs` 集合（`owner`、`kind`、`data` maxSize 4 MiB、`writer`、`(owner,kind)` 唯一索引），以及 `users` 加固（createRule/deleteRule 设为 null、关闭 OAuth 与 OTP、token 有效期 90 天）；
- `tools/pb-rules-check`：在一次性的本机实例上，用两个合成账号做断言；
- `PB-CONTRACT.md` 初稿。

**Addresses:** 账号隔离。
**Avoids:** Pitfall 2、3、12。
**依赖：** 与 Phase 7 并行。**需要所有者批准下载 PocketBase 二进制**：放在临时目录，只用合成数据，不进默认的 `npm test`。

### Phase 9：假 PocketBase 服务器与 cloud harness
**Rationale:** 先有假服务器，再写 cloud 前端，就能测试驱动开发。
**Delivers:**
- Node 侧的 `FakePbServer`；页面侧替换 `fetch`/`EventSource`；
- `AppHarness` 的 `cloud` 模式；
- 对 `/api/` 的"只放行 mock"白名单护栏，以及配套的自检用例；
- 同源的 vendor 文件服务；
- 一条探针用例，检查 `context.setOffline` 是否派发事件。

**Addresses:** 测试适配。
**Avoids:** Pitfall 19、20、21。
**依赖：** Phase 7（计划形状）；Phase 8 提供协议样本。

### Phase 10：登录与云端在线路径
**Rationale:** 所有同步能力的前提。
**Delivers:**
- 登录页、`boot()`、`makeDocStore`，以及按用户分键的本机缓存；
- 对账表，包含首次创建和唯一索引冲突的处理；联网时对账完成前禁止编辑；
- `authRefresh`、登出顺序、`writer`、关闭 `autoCancellation`、大小监控；
- 删除 `init()` 里"加载失败就静默回退本机"的逻辑。

**Addresses:** 登录、会话、退出、账号作用域、首次对账前不上传。
**Avoids:** Pitfall 1（门控部分）、7、11、14；修 B3。
**依赖：** Phase 7、8、9。

### Phase 11：离线优先
**Rationale:** 离线和实时都依赖同一个 `PB_CONNECT` 对账，先做离线更稳。
**Delivers:**
- `dirty` 与 `seq` 落盘；保存失败不清脏标记，并做指数退避；
- `online`、`visibilitychange` 和重连都会触发对账；
- 真冲突时留底并提示；配额错误对用户可见；
- 状态栏状态机；遇到 401 保留未上传的修改。

**Addresses:** 离线先存、自动上传、状态栏。
**Avoids:** Pitfall 1、14；修 B5。
**依赖：** Phase 10。去抖和退避用 `manual` 时钟覆盖。

### Phase 12：实时同步
**Rationale:** 等对账和离线都稳定之后，再加订阅。
**Delivers:** 订阅（按 `kind` 分派）、回声抑制、空闲时才应用远端更新、不毁草稿的提示横幅、重连后整份对账，以及双设备用例。
**Addresses:** 实时同步、远端更新不毁草稿。
**Avoids:** Pitfall 6、7、21。
**依赖：** Phase 10、11。

### Phase 13：导出导入与迁移
**Rationale:** 计划编辑页里的"导入计划"和车主迁移，都依赖严格的导入。
**Delivers:**
- 导出改用 Blob，去掉 `window.__dl`；
- 导入支持新格式包装，兼容旧的裸 state，做深度校验；非备份文件直接拒绝（修 N3）；
- 显示摘要让用户确认；导入前留底，可以撤销；取消后可重选同一文件（修 B2）；
- 修 CSV 公式注入（B7）；
- 车主种子计划脚本，输出被 git 忽略；迁移演练只用合成文件。

**Addresses:** 按账号导入导出、车主迁移。
**Avoids:** Pitfall 8、10。
**依赖：** Phase 10。把 v1 中 N3 与 B2 的 `test.fail` 翻成正常断言，同步更新 KNOWN-BUGS。

### Phase 14：编辑计划页
**Rationale:** 这是工作量最大的 UI，依赖云端存储和计划导入。最好放在实时之后，这样计划能跨设备同步。
**Delivers:** `#plan` 页面，具体包括：
- 目标组、任务、力量项、周健身目标和基础预设的增删改与上移下移；
- 归档与恢复；草稿式保存/取消；
- 校验与规模上限；离开时如有未保存修改要确认；
- 加载示例计划。

**Addresses:** 计划编辑、归档，以及预设的两层模型（取决于所有者的决定）。
**Avoids:** Pitfall 9、11；草稿与实时同步互相冲突。
**依赖：** Phase 10、12、13。

### Phase 15：正式部署与加固
**Rationale:** 等部署产物和前端文件基本定型后再上线。基础设施部分在 Phase 8 之后就可以并行准备。
**Delivers:**
- Caddy（h1 h2、压缩、`stream_close_delay`）、systemd、防火墙；
- 加固 `/_/`：MFA、限流、代理 IP 头；
- CSP 与安全响应头；内置备份加异地桶；
- `deploy/` 模板脚本，地址和密钥不进仓库；
- 隐私检查新规则，覆盖域名、IP 形状、token 形状、`pb_data` 和种子计划文件；
- `noindex`；
- 可选：Service Worker 加 manifest。

**Addresses:** 部署、备份、HTTPS。
**Avoids:** Pitfall 3、10、11、15、16、17。
**依赖：** Phase 6 的结论、Phase 8。脚本执行前需要所有者批准。

### Phase 16：验收
**Rationale:** 这是上线门槛，覆盖 mock 证明不了的事。
**Delivers:**
- 备份恢复演练；
- 真的重启一次 VPS；
- 从外网访问 `/_/` 应被拒绝；
- 对线上同版本再跑一次隔离脚本，只用合成账号；
- 两台真实设备分别在大陆和美国网络下验收同步与离线；
- `npm run test:cloud` 全量；
- 文档。

**依赖：** 全部。

### Phase Ordering Rationale
- Phase 7 在最强的回归防线下完成最大的重构。Phase 8 与 9 先于云前端，防止假服务器和现实脱节。
- 对账门控放在 Phase 10。它是消除最常见丢数据路径的关键，不能推迟到离线阶段。
- Phase 13 先于 Phase 14，因为计划编辑页和车主迁移都需要"导入计划"。
- 阶段数偏多。如果所有者希望精简，可以合并 Phase 11 与 12（同一个 Sync 控制器），或把 Phase 16 并入 Phase 15；但不要合并 Phase 8（隔离）和 Phase 10。

### Research Flags

**需要在计划阶段深入研究**（`/gsd-plan-phase --research-phase`）：
- **Phase 6：** 大陆可达性只有二手资料，必须实测。
- **Phase 8：** 用真实 PocketBase 证实几个 MEDIUM 项：`:isset` 组合、订阅的 `fields` 是否裁剪载荷、`users` 默认规则、token 有效期的设置方法。
- **Phase 12：** SSE 经过 Caddy 后的行为、断线后是否补发、`fields` 对事件的效果。
- **Phase 15：** CSP 与单文件内联脚本能否兼容（哈希方案）、Caddy 对 SSE 的实际表现、CORS 的默认行为。

**需要 UI 设计契约**（`/gsd-ui-phase`）：
- **Phase 14（编辑计划页）：** 工作量最大的 UI，涉及排序、归档、草稿和校验。
- **Phase 10（登录页与状态栏状态机）：** 范围较小，可以在 Phase 10 的讨论阶段处理；但状态栏 5 种状态的文案和位置，建议先定契约。

**标准模式，可以跳过专项研究：**
- **Phase 7、9、11、13、16。** 其中 Phase 7 的门槛是 154 条用例全部通过；Phase 9 与 v1 的 `MockBackend` 同构。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH（PocketBase、SDK、Caddy、VPS 价格）/ LOW（大陆线路、CN2 价格） | 版本与价格来自官方页面和官方 API；到大陆的线路口碑只有二手资料；阿里云的价格页没有日期 |
| Features | MEDIUM | PocketBase 的行为是 HIGH；离线优先、冲突处理、iOS 主屏幕应用来自惯例和推理；速率限制、`authStore` 键、iOS 的 `<a download>` 没有逐条核实 |
| Architecture | MEDIUM-HIGH | 规则、实时协议、SDK 行为都对照了文档和源码；`:isset` 组合、`fields` 对事件的裁剪等，需要真实实例验证 |
| Pitfalls | MEDIUM | 规则与运维类有官方文档支撑；大陆可达性、微信内置浏览器、iOS 存储回收为 LOW 到 MEDIUM |

**Overall confidence:** MEDIUM

### Gaps to Address

- **大陆线路：** 三网的真实延迟和丢包，以及 SSE 是否会被中途重置，由 Phase 6 实测，结论决定选哪个地区。
- **内存：** PocketBase 在 1 GB 机器上的实际内存占用，上线时量一次 RSS，并设置 `GOMEMLIMIT` 与 swap。
- **规则细节：** `updateRule` 的 `:isset` 组合、订阅的 `fields` 裁剪、新建 `users` 的默认规则，由 Phase 8 用真实实例断言。
- **下载渠道：** 新发布渠道的下载与校验流程，Phase 15 部署时核对 `checksums.txt`，并保留 v0.40.6 回退包。
- **离线事件：** `context.setOffline` 是否派发 `online`/`offline` 事件，由 Phase 9 的探针用例确认。
- **真机行为：** iOS 存储回收、微信内置浏览器的存储与下载，在 Phase 16 真机验证；导出失败时提示"用系统浏览器打开"。
- **价格细节：** 阿里云轻量香港的包含流量和东京价格、DMIT 的官方价格，由所有者采购时在结账页确认，不影响技术方案。

## 所有者需要在需求阶段决定的事项

1. **冲突粒度：** 接受整份 LWW 加对账门控、基线比对和覆盖留底（推荐）；还是在真冲突时对 logs 按 id 取并集。后者可能让已删除的记录复活，也改变了"最后写入为准"的字面含义，建议等出现真实丢数据后再考虑。
2. **冷启动离线（Service Worker 加 manifest）：** 做还是不做。如果做，放在 Phase 15 末尾，并为这条用例放开 Playwright 的 `serviceWorkers: 'block'`。
3. **示例计划的形状：** 应用内置默认是否用与原计划同形状的合成计划（推荐，能保住 154 条用例）；新账号是否另给一份更小的示例。
4. **去个人化后的应用文件能否进公开仓库：** 计划文字移出后，文件本身可能已不含个人内容，但要由所有者决定，并联动 PRIVACY.md 和隐私钩子。无论如何，`pb_public` 里都不能出现个人词条。
5. **预设标签的两层模型：** 保持"基础列表在计划里、增量在 state 里"（推荐，composer 一行不用改）；还是把增量折叠进计划的基础列表（更干净，但要改 composer 和 v1 的预设用例）。
6. **去掉 Google Fonts：** 确认外观可以接受，改用现有的回退字体栈。
7. **真实 PocketBase 的隔离验证：** 是否批准下载二进制。会放在临时目录，只用合成数据，不进默认的 `npm test`。这是 Phase 8 的前提。
8. **首次创建记录的方式：** 客户端首次创建加唯一索引（默认），还是用 `pb_hooks` 自动建；后台 `/_/` 是否额外按 IP 限制。
9. **VPS 供应商、地区与域名注册商：** 见上文对比表。研究只提供事实和价格依据，所有者在 Phase 6 完成购买。
10. **导入前快照、撤销导入、冲突留底下载：** 在本里程碑做（推荐），还是放到 v2.x。
11. **旧托管副本的迁移顺序：** 确认以下流程：
    - 所有者自己从旧副本导出备份；
    - 先导入种子计划，再导入记录；
    - 旧应用保持原样作后备；
    - 演练只用合成数据。

## Sources

### Primary（HIGH confidence）
- **PocketBase 官方文档：** 规则与过滤、实时、认证、集合、记录、生产部署、设置接口。用于确认规则语义、SSE 行为、备份、限流、systemd 和 `GOMEMLIMIT`。
- **PocketBase 源码与发布说明：** `users` 默认规则、令牌默认时长、JSON 字段上限；v0.40.6 与 v0.41.0/v0.41.1 的发布说明，以及迁出 GitHub 的公告。
- **官方 JS SDK：** README、变更记录、实时部分源码（重连、`PB_CONNECT`、自动取消、`LocalAuthStore`）；npm 上 0.28.2 的发布信息。
- **Caddy 官方文档：** 自动 HTTPS、`reverse_proxy`、全局选项。
- **价格来源：** 腾讯云 Lighthouse 价格与退款文档、Vultr 与 Akamai 的公开 API、Porkbun 价格页、Cloudflare R2 价格页。
- **本仓库：** PROJECT.md、codebase 分析文档、KNOWN-BUGS.md、PRIVACY.md。

### Secondary（MEDIUM confidence）
- **厂商资料：** 阿里云轻量产品页（无日期）与国际站付款帮助页；Cloudflare Registrar 的成本价政策；Let's Encrypt 证书有效期缩短时间表的转述。
- **学术与报道：** GFW 对 QUIC 的 SNI 过滤测量（USENIX Security 2025）；Safari 7 天存储上限的报道与 WebKit 缺陷记录，细节有冲突。
- **社区：** Caddy 社区的续期故障讨论；PocketBase 与 SSE、代理的社区讨论。

### Tertiary（LOW confidence，需验证）
- **线路与价格：** 各 VPS 到大陆的线路口碑、CN2 GIA 商家价格、Spaceship 与 Namecheap 价格（对比网站）、LightNode 首页信息。
- **论坛与报告：** Cloudflare 与大陆、SSE 超时的论坛报告；微信内置浏览器的存储和下载行为；Google Fonts 与公共 CDN 在大陆的不稳定报告。

---
*Research completed: 2026-11-05*
*Ready for roadmap: yes*
