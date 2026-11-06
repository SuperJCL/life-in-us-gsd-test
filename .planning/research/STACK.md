# Stack Research：v2.0 多账号云端版（新增与变更）

**Domain：** 单文件原生前端 + 自托管 PocketBase 的多账号、离线优先、实时同步个人记录应用
**Researched：** 2026-11-05
**Confidence：** HIGH（PocketBase、SDK、Caddy、Vultr、Linode、Tencent Lighthouse 的版本和价格来自官方页面或官方 API）；MEDIUM（Alibaba Cloud 价格页无日期、域名价格、大陆线路质量）；LOW（CN2 GIA 商家价格、各家到大陆的线路口碑，只有二手资料）

范围说明：只写 v2.0 新增的东西。现有应用（innerHTML 渲染、三成员 store 适配器 `{label, load, save}`、600 ms 防抖整档保存、localStorage 回退、JSON 导入导出）和 v1.0 的 Playwright 测试（154 条，Edge，全断网，mock 后端）不重复调研。每条结论后面的标记表示依据：`[官方]` 官方页面或官方 API，`[二手]` 第三方文章或社区帖子，`[推断]` 我的判断。

---

## 一、先看三个必须知道的事实

1. **PocketBase 已经搬出 GitHub。** `pocketbase/pocketbase` 仓库在 2026-10-22 变成只读归档，GitHub 上最后一个版本是 v0.40.6（2026-10-23）。新版本只发布在维护者自己的站点 `ganigeorgiev.com`，当前稳定版是 **v0.41.1（2026-10-28）**。`pocketbase.io/docs` 已经指向 v0.41.1。[官方：GitHub Release v0.40.6 正文、Discussion #7841、pocketbase.io/docs、新站 releases 接口]
   影响：下载地址、`./pocketbase update` 的来源、Go 模块路径都变了；新站是单人维护的自托管实例，所以**要固定版本、核对 `checksums.txt`、把确认可用的 zip 留一份在服务器之外**。GitHub 上 v0.40.6 之前的二进制仍可下载，可作回退。
2. **PocketBase 默认的 `users` 集合允许任何人注册。** 我读了 v0.40.6 源码：`createUsersCollection` 里 `CreateRule = ""`（空字符串表示任何人，包括游客），`DeleteRule = "id = @request.auth.id"`（用户可以删自己的账号）。v0.41.x 的发布说明没有改这一点。所以“不开放注册”不是默认行为，**必须把 `users` 的 createRule 和 deleteRule 改成 null（只有超级用户可操作）**。[官方：源码 migrations/1640988000_init.go]
3. **Google Fonts 和公共 CDN 在大陆不可靠。** 现有应用 `<head>` 里有 Google Fonts 的样式表链接，它会阻塞渲染，在大陆可能卡到超时。v2.0 的前端改动允许碰这一处：去掉这个 `<link>`（字体栈里已经有 `Songti SC`、`STSong`、Georgia 作为回退）。PocketBase SDK 也不要从 jsDelivr/unpkg 加载，直接放到同源。[推断，依据 CLAUDE.md 里记录的现有字体写法]

---

## 二、Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PocketBase | **0.41.1**（2026-10-28）linux_amd64 预编译包，约 12 MB | 后端：SQLite、账号认证、记录接口、实时订阅（SSE）、管理后台、静态文件托管、定时备份 | 一个二进制就覆盖全部需求：超级用户后台开 3 个账号、API 规则做账号隔离、`subscribe` 做多设备实时同步、内置备份可写 S3。3 个用户的负载对它几乎为零。仍是 0.x，没有向后兼容承诺，所以要固定版本，升级前先备份（见“升级路径”） |
| PocketBase JS SDK | **0.28.2**（2026-11-01，MIT）；用 `dist/pocketbase.iife.js`，40.5 KB，gzip 约 11 KB | 浏览器里的登录、认证状态、记录读写、实时订阅与自动重连 | 官方 SDK 直接处理两件麻烦事：SSE 握手（先拿 `PB_CONNECT` 的 clientId，再 POST 订阅列表）和断线重连（`maxReconnectAttempts` 为无限）。iife 文件定义全局 `PocketBase` 类，不需要模块系统，能直接放进现有单文件页面的 `<script>` |
| Caddy | **2.11.9**（2026-11-05） | 反向代理、自动 HTTPS（Let's Encrypt，ZeroSSL 兜底）、压缩 | 见第四节。四行配置，证书自动申请和续期，可以关掉 HTTP/3，让 PocketBase 只监听 127.0.0.1、不用 root |
| 一台 1 GB 内存的 Linux VPS | Ubuntu 24.04 或 22.04 LTS | 运行 PocketBase + Caddy | PocketBase 官方没有写最低配置；官方基准仓库显示 512 MB 能跑、256 MB 要配 swap。App 没有文件上传，不会触发缩略图那类内存峰值。留 1 GB 是给系统、Caddy 和备份压缩留余量 [二手+推断]。选哪家见第七节 |
| 域名 | .com 一个 | 指向服务器，Caddy 据此申请证书 | 见第八节 |

### Supporting Libraries / 服务

| Library / 服务 | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PocketBase 内置备份（Settings > Backups） | 随 0.41.1 | 按 cron 生成整个 `pb_data` 的 zip 快照，可保留 N 份，可直接写入 S3 兼容存储 | 必用。设 `0 3 * * *`、`cronMaxKeep` 7 |
| Cloudflare R2 | Standard 存储 | 异地备份目标。免费额度 10 GB-月存储、100 万次 A 类操作、1000 万次 B 类操作，出流量免费 [官方，2026-11-05 取自 developers.cloudflare.com/r2/pricing] | 首选。数据量很小（预计远低于 10 MB），实际不会收费；需要绑一张信用卡 |
| Backblaze B2 | S3 兼容 | 同上的备选 | R2 不想用时。前 10 GB 免费，之后 $6.95/TB/月 [官方，页面脚注是 2024，价格需下单前复核] |
| `pb_migrations/*.js` | 随 PocketBase | 把集合结构和 API 规则写成代码，随部署脚本一起上传 | 必用。在后台点出来的结构也会自动生成迁移文件；提交到仓库，部署可复现。公开仓库里只放结构，不放数据 |
| `pb_public/` | 随 PocketBase | 同源托管 `index.html`（应用）和 `pocketbase.iife.js`（SDK） | 见第五节 |
| systemd 服务 | Ubuntu 自带 | 开机自启、崩溃重启 | 必用。官方文档给了示例，加 `LimitNOFILE=4096`，可加 `Environment=GOMEMLIMIT=400MiB` |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@playwright/test` **1.64.1**（保持固定） | 沿用 v1.0 的测试 | npm 上最新是 1.65.0，本里程碑不升级，避免和功能开发混在一起 |
| 手写的 `MockPocketBase`（Node 侧，放在 `tests/mocks/`） | 在 `context.route` 里响应 `/api/**` | 不增加任何依赖，见第九节 |
| 手写的 `FakeEventSource`（页面侧，用 `addInitScript` 注入） | 模拟实时推送、断线、重连 | 和 v1.0 的 `installClaudeMock` 同一种写法 |
| 部署脚本（bash + rsync/scp） | 上传二进制、`pb_migrations`、`pb_public` | 脚本只在仓库里放模板；服务器地址、密钥不进仓库；执行前经用户批准 |

---

## 三、PocketBase 怎么满足每条需求

### 数据模型（建议）

- **`users`**（内置认证集合）：
  - `createRule` 设为 null，`deleteRule` 设为 null；`listRule`、`viewRule`、`updateRule` 保留默认的 `id = @request.auth.id`，这样用户能改自己的密码。
  - 关闭 OAuth2 和 OTP。**不配 SMTP**：只有 3 个人，忘记密码时由所有者在后台直接重设，少一个会出问题的外部依赖。
  - 把 `authToken.duration` 从默认的 **5 天（432000 秒）**调成 90 天以上（上限约 3 年）。原因：离线优先要求手机离线很久之后重新联网，还能带着旧令牌上传；令牌过期后上传会被 401 拦下。应用每次联网启动时对有效令牌调用 `authRefresh()` 顺延。改密码会让该用户的旧令牌全部作废（令牌在服务器上没有会话记录，PocketBase 没有登出接口，客户端丢掉令牌就是登出）。
- **`journals`**（base 集合，每个账号一条）：
  - 字段：`owner`（关联 `users`，必填，单选，建唯一索引，用户删除时级联删除）、`state`（JSON）、`plan`（JSON，个人计划：目标组、任务、力量项、预设标签）、`created`/`updated` 两个自动时间字段（用代码写迁移时要自己声明）。
  - **`state` 和 `plan` 分成两个 JSON 字段**：PocketBase 的更新只改请求里带的字段，所以旧设备上传 `state` 不会覆盖别处刚改过的 `plan`，把“最后写入为准”的伤害缩小到字段级。
  - JSON 字段默认上限 1 MiB（源码 `DefaultJSONFieldMaxSize = 1 << 20`，设 0 即默认）。原 Artifact 的文档上限是 256 KiB，所以够用；但日志无界增长，建议把 `state.maxSize` 显式设到 4–5 MiB，并在应用里监控体积。
  - 规则：
    - `listRule` 和 `viewRule`：`owner = @request.auth.id`
    - `createRule`：`@request.auth.id != "" && @request.body.owner = @request.auth.id`
    - `updateRule`：`owner = @request.auth.id && @request.body.owner:changed = false`
    - `deleteRule`：null（只有超级用户能删）
  - 规则同时是过滤条件：别人的记录对你来说是“列表为空”或 404，不是 403，所以不泄漏记录是否存在。`:changed` 修饰符、`@request.body.*` 都是官方文档里的语法。
  - 创建账号时由所有者同时在后台建一条空 `journals`，客户端首次登录只读不建，避免两台设备同时首次登录时撞唯一索引。客户端仍要处理“创建返回 400 唯一冲突 → 重新读取”。

### 实时同步

- `pb.collection('journals').subscribe(recordId, cb)` 订阅单条记录，按 `viewRule` 判定能不能收到；订阅 `'*'` 则按 `listRule`。两种都已被账号规则限定在自己的记录上。
- 服务器每次 update 都会把**整条记录**推给所有订阅者，包括发起写入的那台设备本身。适配器要用 `record.updated` 或自己带的版本号识别“自己写的回声”，不要把它当远端变化再渲染一遍。
- 服务器 5 分钟没有新消息会主动断开 SSE，SDK 会自动重连。手机在大陆移动网络上，长连接容易被中间设备掐掉，所以**不要只依赖 SSE**：在 `visibilitychange`（页面回到前台）和 `online` 事件时主动重新读一次记录，作为兜底。
- PocketBase 默认在 `localStorage` 的 `pocketbase_auth` 键存令牌。SDK 的 `pb.autoCancellation(false)` 必须关掉：默认会取消同一个 requestKey 的待处理重复请求，防抖保存连续发两次 update 时前一次会被取消。

### 与现有 store 适配器的接口

- 新增 `pbStore`：`load()` = 读自己的 `journals` 记录取 `state`，`save(obj)` = `update(id, { state: obj })`。三个成员不用改，应用现有的“load 抛错则退回 localStorage”逻辑要改成离线队列逻辑（本地先存，联网后上传，最后上传者为准）。
- 实时推送是适配器之外新增的能力：给适配器加一个可选的 `subscribe(onRemote)`，收到远端 `state` 后替换 `state` 并 `renderAll()`。现有“全量重渲染”正好适合，但草稿丢失这类现存问题会更容易被触发（见 PITFALLS）。
- 登录页和“编辑计划”页是新增界面；SDK 只负责 `authWithPassword`、`authStore`、`authRefresh`、记录读写，界面仍用原生 DOM。

### 大小、内存与升级路径

- 磁盘：二进制 12 MB，数据库按 3 个人的文本记录估算几 MB；VPS 的 20–40 GB 磁盘都够，备份文件按天保留 7 份也只有几十 MB。[推断]
- 内存：空闲和低负载下通常是几十 MB 量级（我没找到官方给出的具体数字，**需要在真机上量一次 RSS**）；设 `GOMEMLIMIT`；开 swap 作为 OOM 兜底。
- 升级：0.x 阶段官方明确说不保证向后兼容，建议每次读发布说明、必要时手动迁移。流程：本机或临时机先试 → 服务器上先触发一次备份并下载 → 替换二进制 → `pocketbase serve` 启动时自动执行迁移。`./pocketbase update` 从 v0.40.6 起改为从新站拉取，所以必须从 v0.41.x 起步才能用。v0.41.0 的变化只涉及 Go 模块路径、钩子事件的 `Extra` 字段、缩略图像素上限（`PB_THUMBS_MAX_SOURCE_PIXELS` 默认 `100<<20`）和邮件小修，对预编译二进制用户没有结构性变化。[官方：新站发布说明]
- 速率限制：PocketBase 0.23+ 内置，在后台 Settings > Application 里打开；因为前面有 Caddy，要在“User IP proxy headers”里设置 `X-Forwarded-For`，否则所有请求看起来都来自 127.0.0.1，限流会把 3 个人当成同一个来源。
- 超级用户后台 `/_/` 会暴露在公网：用强密码；后台可设“超级用户 IP 白名单”（v0.38+），但所有者的 IP 常变，不要锁死自己，需要时用 `./pocketbase superuser ips` 命令行重置。

### 与备选方案的比较

| 方案 | 适合单台小 VPS 吗 | 结论与原因 |
|------|------------------|-----------|
| **PocketBase**（选这个） | 是，单二进制，几十 MB 内存量级 | 账号、规则、实时、后台、备份都有现成的，工作量最小 |
| 自写 Node + SQLite（如 Fastify + better-sqlite3 + SSE） | 是，更省内存 | 要自己写密码哈希、令牌、规则校验、SSE 广播，还要给所有者做一个建账号的后台。安全面全在自己身上，工期是 PocketBase 的几倍；只有想借此练后端时才值得 |
| 自托管 Supabase | 否 | 官方文档写明最低 4 GB 内存、2 核、40 GB SSD，建议 8 GB 以上；十多个服务（网关、Auth、PostgREST、Realtime、Storage、Edge Runtime、Studio 等）加 Postgres 运维。至少要 $20/月以上的机器，远超预算，3 个人用不上 [官方：supabase.com/docs/guides/self-hosting/docker] |
| CouchDB + PouchDB | 勉强（CouchDB 比 PocketBase 重） | 离线同步是它的强项，但冲突模型是修订树，不是“最后写入为准”；每个用户一个库要额外配置；前端要引入 PouchDB。需求要的只是整档最后写入为准，用不着 |
| 托管的 Firebase / Supabase Cloud | 不适用 | 用户已决定不用；Firebase 在大陆不可用，Supabase Cloud 的大陆访问没有可靠资料 [PROJECT.md 已记录] |

---

## 四、反向代理与 HTTPS

**推荐：Caddy 放在 PocketBase 前面，PocketBase 只监听 127.0.0.1:8090。**

```caddyfile
{
    servers {
        protocols h1 h2
    }
}

journal.example.com {
    encode zstd gzip
    request_body {
        max_size 10MB
    }
    reverse_proxy 127.0.0.1:8090 {
        transport http {
            read_timeout 360s
        }
    }
}
```

配置照抄 PocketBase 官方“Going to production”页里的 Caddy 示例，再加两项：全局关掉 HTTP/3、开压缩。

为什么用 Caddy 而不是 PocketBase 自带的 `pocketbase serve yourdomain.com`：
- 自带方式也能自动申请 Let's Encrypt 证书（官方文档有说明，内部是 Go 的 `autocert`），最省事；但要么用 root 运行，要么给二进制 `setcap` 绑 80/443 端口；
- `pb_public` 的静态文件没有压缩（只有后台 `/_/` 用了 Gzip），跨境链路上压缩能省下一半以上的体积；Caddy 一行 `encode` 解决；
- Caddy 在 Let's Encrypt 失败时自动切到 ZeroSSL，续期失败会按指数退避重试最多 30 天；`autocert` 没有这层兜底 [官方：caddyserver.com/docs/automatic-https]；
- 证书有效期正在缩短：Let's Encrypt 计划 2027-02-10 起默认证书改为 64 天，2028-02-16 起 45 天 [二手：多家媒体转述 Let's Encrypt 2025-12 公告，原文 letsencrypt.org/2025/12/03/from-90-to-45 未直接读取]。续期会更频繁，交给 Caddy 这种持续维护的组件更稳。

**大陆访问的注意点**

1. **关掉 HTTP/3。** UDP 443 在国内网络里常被限速或丢包，浏览器会回退到 TCP，但首次尝试可能多等一会儿。全局选项 `protocols h1 h2` 即可，Caddy 官方选项文档列出了 `h1 | h2 | h2c | h3` 的取值。这是社区经验，不是官方保证。[二手+推断]
2. **OCSP 不再是问题。** Let's Encrypt 在 2025-08-06 关闭了 OCSP 服务，证书里改用 CRL，不再有“大陆访问不到 OCSP 服务器导致握手变慢”的担忧；Caddy 也有 `ocsp_stapling off` 选项，不用动。[官方：letsencrypt.org/2024/12/05/ending-ocsp，该文几次更新过日期，最终状态以其公告为准]
3. **用 HTTP-01 / TLS-ALPN-01 验证即可，不需要 DNS 验证。** Let's Encrypt 的验证节点在海外，访问的是海外的服务器，不受影响。要求公网上开放 80 和 443。
4. **域名解析不要开 Cloudflare 代理（橙云）。** Cloudflare 的任播在大陆表现不稳，只用它做 DNS（灰云）。如果域名买在 Cloudflare，记录设为“仅 DNS”。
5. **香港和东京的服务器不需要 ICP 备案。** 备案只针对大陆境内的服务器。
6. **前端不要引用境外公共资源**：去掉 Google Fonts，SDK 自己托管，不用 jsDelivr/unpkg。
7. **买之前先测。** 用 itdog.cn、17ce 这类国内多点探测站对服务器 IP 做 ping 和 tcping，看三大运营商的延迟和丢包；自己在美国用 mtr 测一遍。新分到的 IP 偶尔在被封的段里，换一个 IP 或者换地区的成本，在按小时计费的商家（Vultr、Linode）几乎为零，在按月订阅的商家（腾讯云、阿里云）则要走退款流程。

nginx + certbot 作为备选没有问题（官方文档也给了 nginx 配置）：要自己装 certbot 并配置续期定时器，SSE 要关闭代理缓冲（`proxy_buffering off`，官方示例没有写这一项，需要自己验证），压缩也要自己开。功能上能做到同样的事，只是比 Caddy 多几个需要自己维护的点。

---

## 五、前端静态文件的托管

**推荐：用 PocketBase 的 `pb_public` 托管，与 API 同源。**

- 把 `us-journey-tracker.html` 改名为 `index.html`（部署时改，仓库里不动文件名），和 `pocketbase.iife.js` 一起放进 `pb_public/`。PocketBase 默认就会提供 `/` 下的静态文件（`serve` 命令有 `--publicDir`，默认 `pb_public`；`--indexFallback` 控制找不到文件时回退到 index.html）。
- 同源的好处：SDK 直接写 `new PocketBase('/')`，没有 CORS 配置，令牌存在同一个 origin 的 localStorage 里，Caddy 只有一个站点块。
- 同源对测试也是好事：v1.0 的断网护栏只放行应用自己的 origin，API 也在这个 origin 下，护栏配置不用动（见第九节）。
- 不建议让 Caddy 直接 `file_server`：多一个要同步的目录，没有好处。要缓存控制时，在 Caddy 里给 `index.html` 加 `Cache-Control: no-cache`，让所有设备拿到新版本。
- 应用文件不进 git（隐私规则）；部署脚本从本机的私有副本上传。
- 注意：“离线优先”如果要求手机在**没有网络时冷启动**也能打开页面，必须加 Service Worker 缓存页面外壳，只靠 localStorage 做不到。这是一个要由路线图单独决定的范围问题（建议先做数据层，再决定要不要加一个手写的约 30 行 Service Worker 加一个 manifest）。另外 v1.0 的 Playwright 配置里 `serviceWorkers: 'block'`，要覆盖这个测试需要为该用例单独放开。[推断]

---

## 六、备份

| 层 | 做法 | 成本 | 说明 |
|----|------|------|------|
| 1. 本机快照 | PocketBase 内置 cron：`0 3 * * *`，保留 7 份 | 0 | 生成 `pb_data` 的 zip（不含已有备份和 S3 里的上传文件）。备份期间性能会略降，数据这么小可忽略。放在同一块盘上，只防误操作，防不了整机丢失 |
| 2. 异地副本 | 在后台 Backups 设置里直接把备份目标选为 S3，填 Cloudflare R2 的 bucket 和密钥 | 0（在免费额度内） | **不需要额外脚本**，备份生成后自动写到 bucket；建议用只放备份的独立 bucket。设置里的 S3 密钥在数据库里默认是明文，可以设 `PB_ENCRYPTION_KEY`（32 位随机串）让设置加密存储 |
| 3. 用户自己的备份 | 应用里的“导出 JSON” | 0 | 已是需求。每个账号的数据人手一份，是最后一道防线 |
| 4. 服务器商快照 | 例如 Vultr 自动备份（加价约 20%，约 $1/月） | 视情况 | 可选，不作主力：它的恢复流程和 PocketBase 无关，必须先关机或者容忍不一致 |

- 还有一个官方给的手动方式：停掉服务后复制 `pb_data`；文档也给了 `sqlite3 .backup + rsync` 的脚本思路，只在数据超过 5 GB 时才需要。
- **恢复演练必须做一次**：把 R2 里的 zip 下载下来，在本机或新机器上用 Backups 页的 Restore 或解压覆盖 `pb_data`，确认能登录、数据在。没演练过的备份不算备份。
- `cronMaxKeep` 是备份文件数，设置 API 里的字段名是 `backups.cron` 和 `backups.cronMaxKeep`。[官方：pocketbase.io/docs/api-settings]

---

## 七、VPS 供应商对比（供所有者选择）

**价格取得日期 2026-11-05。** 取得方式写在“依据”列：官方页面或官方公开 API 的价格可信度高；没写日期的页面可能随时变。下单前请在结账页再核一次。

### 对比表

| | 腾讯云 Lighthouse 香港 | 阿里云 轻量应用服务器 香港 | Vultr 东京 | Akamai（Linode）东京 | CN2 GIA 香港（以 DMIT 为例） |
|---|---|---|---|---|---|
| **最便宜且够用的套餐** | Starter：2 vCPU / 2 GB / 40 GB SSD / 20 Mbps / 每月 512 GB 流量 | 2 vCPU / 1 GiB / 30 GiB / 峰值 200 Mbit/s（默认 Docker 镜像）；2 GiB 档 40 GiB | Cloud Compute Regular：1 vCPU / 1 GB / 25 GB / 1 TB 流量 | Nanode：1 vCPU / 1 GB / 25 GB / 1 TB 流量 | HK Pro 入门档约 1 vCPU / 1 GB，磁盘和流量各来源说法不一（见右） |
| **月价（USD）** | **$6.00** | **$5**（1 GiB）；$8（2 GiB）；$4（0.5 GiB，太小不推荐） | **$5**（按小时 $0.007） | **$5**（按小时 $0.0075） | 约 **$39.90**，超出预算 |
| **依据** | 官方价格文档，页面更新于 2026-09-24 | 官方产品页，页面无日期；流量额度页面没写，超额价香港 $0.153/GB | 官方公开 API `api.vultr.com/v2/plans`，2026-11-05 | 官方公开 API `api.linode.com/v4/linode/types`，2026-11-05 | 二手评测汇总；官网被 Cloudflare 挑战页挡住，**无法核实** |
| **同商家的东京选项** | 东京 Starter 2C2G $4.20/月（512 GB）；Razor Speed 2C1G $5.00/月，200 Mbps，**不限流量** | 东京价格页没单列，通用价格表里有 $4.5 的 1C1G（地区归属未确认） | — | 东京 2（`ap-northeast`）和大阪 | HK、东京、洛杉矶都有 |
| **到大陆的线路** | 社区口碑：香港节点三网访问较好，个别资料称有 CN2 [二手，**LOW**] | 社区口碑：香港多线 BGP，访问稳定 [二手，**LOW**] | 普通国际线路，东京到电信/联通晚高峰常有丢包 [二手+推断，**LOW**] | 同上，口碑略好于普通线路但没有可靠的实测来源 [**LOW**] | 商家宣传 CN2 GIA 加 CMI，回程最稳，但价格是其他家的 7 倍左右 [二手，**LOW**] |
| **到美国** | 香港到美西约 150–160 ms，到美东约 200+ ms [推断] | 同左 | 东京到美西约 100–110 ms，到美东约 150–170 ms [推断] | 同左 | 同香港 |
| **付款方式** | 信用卡（美国发行的卡可用）、银行转账；部分账号付款要 3D 验证；PayPal、支付宝没有官方确认 [官方付款页] | 国际站不接受大陆发行的信用卡、预付卡、虚拟卡，PayPal 要用非大陆注册的账号；支付宝和微信的说法互相矛盾，**按不支持处理** [官方帮助页] | 信用卡、PayPal、支付宝、加密货币（BitPay）、电汇 [官方 FAQ] | Visa、Mastercard、AmEx、Discover，PayPal 充值 [官方定价页] | 商家官网看不到，**未核实** |
| **注册 / 实名** | 邮箱或手机号注册；香港等境外地区不需要实名，但官方交易前提文档写了要绑卡并完成身份验证（描述不一致，注册时以实际要求为准）[官方+二手] | 要绑付款方式并做账号安全设置，会有小额验证扣款后退还；香港地区不需要大陆实名 [官方+二手] | 不需要实名；要有付款方式，信用卡会有临时预授权 | 同 Vultr | 未核实 |
| **退款 / 试用** | 官方有按天折算的退款公式（支付金额减去已用天数），退到账户余额；代金券和折扣不退；官方保留拒绝可疑退款的权利 | 轻量服务器没找到专门的退款条款，其他阿里云产品的“5 天无理由”**不能直接套用** | **不提供退款**，按小时计费，随时销毁，已用部分照付；停机不销毁仍然计费 | 按小时计费，可随时销毁 | 未核实 |
| **已知坑** | 月流量超出后按量计费（东京 $0.13/GB）；国际站套餐和大陆站不同，页面里同一款套餐在不同页面价格不一致，结账时再核；不同地区套餐不同 | 套餐里默认镜像各不相同，价格页有两个不同来源的价格表（$4–$5 与 $3.5–$4.5），结账前确认；订阅制，不能按小时 | 到大陆没有任何线路优化；东京区只有部分套餐（便宜的 0.5 GB 和 IPv6-only 在东京不供应） | 到大陆没有任何线路优化；官方区域列表里是“Tokyo 2”和“Osaka” | 货源经常断货；价格和套餐变化频繁，评测里互相矛盾 |

### 没有进入表格但被考察过的

- **DigitalOcean**：没有香港和东京机房，最近的是新加坡，不符合要求。[推断，基于我对其机房列表的了解，未在本轮重新核对]
- **Hetzner**：只有新加坡，没有香港和东京。同上，未重新核对。
- **AWS Lightsail**：官方定价页里最便宜的带 IPv4 的套餐是 $5，但只有 0.5 GB 内存；香港地区流量额度减半；页面没写东京是否提供该套餐。1 GB 内存档要更高价格，到大陆没有线路优化，所以没有放进来。[官方：aws.amazon.com/lightsail/pricing]
- **LightNode**：官网写起价 $7.70/月，按小时计费，支持信用卡、银联、支付宝、Google Pay、PayPal；机房覆盖香港和东京，但页面没写具体套餐对应的地区、线路和退款政策。如果所有者想用支付宝付款，它是候选，需要自己进一步核实。[官方首页，信息不完整，**LOW**]
- **Oracle Cloud 永久免费档**（东京区）：免费，但需要绑信用卡，常见“区域资源不足”和闲置回收，线路无优化。不适合要求稳定的账号数据；这条没有在本轮核实。

### 推荐（所有者自己决定）

1. **首选：阿里云轻量香港 $5（2 vCPU / 1 GiB）或腾讯云 Lighthouse 香港 $6（2 vCPU / 2 GB）。** 理由：香港到大陆的延迟最低，到美国也只多几十毫秒；两家的国际站接受美国发行的信用卡；3 个人的流量不会超额。多花 $1 就是 2 GB 内存，内存余量更大的腾讯云更稳妥；价格更低的阿里云也完全够。
2. **想先低成本验证线路：** Vultr 东京或 Linode 东京，按小时计费，开一台测一天，从国内探测站和从美国各测一遍再决定；它们不需要实名、有 PayPal。代价是到大陆没有线路优化，晚高峰可能不稳。
3. **不要上 CN2 GIA 档：** 价格是预算的 6–8 倍；对 3 个人每天几次、每次几十 KB 的小请求，普通线路加上本地优先的设计已经足够。
4. **付款方式的提醒：** 腾讯云和阿里云国际站都不收大陆发行的卡，所有者人在美国用美国卡没问题；如果只有大陆的银行卡，Vultr（支付宝）和 LightNode（支付宝、银联）更方便。
5. 无论选哪家：**第一次选 1 个月，不要直接买年付**；上线后测一周大陆和美国的访问，再续订；订阅前核对结账页上的最终价格和流量额度。

---

## 八、域名注册商

| 注册商 | .com 每年价格 | 依据 | 说明 |
|--------|--------------|------|------|
| **Cloudflare Registrar** | 约 $10.4–10.5，注册和续费同价 | 官方页面承诺“不加价、成本价”，具体金额来自对比网站，没有从官方页面读到数字（**MEDIUM**） | 域名必须用 Cloudflare 的 DNS；解析记录设为“仅 DNS”（灰云）；支持 430 多个后缀；付款方式官方页面没写 |
| **Porkbun** | **$11.81**（注册、续费、转入同价；.net $12.52） | 官方产品页，2026-11-05 | 价格含 ICANN 费用；WHOIS 隐私和 DNS 管理免费；支持 Cloudflare DNS |
| Spaceship | 续费约 $9.98，首年有促销 | 对比网站（**LOW**），官方页没读 | 最便宜之一，但只有二手价格 |
| Namecheap | 首年有低价，续费约 $18 | 对比网站（**LOW**） | 首年便宜、续费涨价是常见套路，不推荐用于长期持有 |
| 阿里云 / 腾讯云域名 | — | — | 不推荐：大陆站注册要实名；国际站没有价格优势。不需要备案，因为服务器在境外 |

- **推荐 Porkbun 或 Cloudflare Registrar 买 `.com`**，约 $10–12/年，符合预算。两家都不要求大陆实名；注册只需要联系人信息和邮箱验证（ICANN 的常规要求）。
- 不要买 `.cn`（要实名和审核）。
- DNS 里只需要一条 A 记录（再加 AAAA，如果服务器有 IPv6）指向服务器。服务器商如果换了，只改这条记录。

**每月总成本估算：** VPS $5–6 + 域名约 $1（$11/年） + 备份 $0 ≈ **$6–7/月**，在 $4–8 的预算内。

---

## 九、测试工具：怎样让 Playwright 在断网环境下对 PocketBase 仍然可测

**推荐：真实 SDK + Node 侧 `MockPocketBase`（`context.route`）+ 页面侧 `FakeEventSource`（`addInitScript`）。不引入任何新依赖。**

做法：
- SDK 文件由现有的 `static-server.cjs` 同源提供（需要让它多服务一个 vendor 文件，这是对测试支撑代码的一处改动），应用里写 `new PocketBase('/')`。**所有 API 请求都在应用自己的 origin 下**，v1.0 的护栏（只放行应用 origin）不用放宽；在现有 `context.route` 的分流里，对 `/api/` 前缀的请求先交给 `MockPocketBase`，再决定是否 `continue`。
- 需要实现的 REST 子集：
  - `POST /api/collections/users/auth-with-password`
  - `POST /api/collections/users/auth-refresh`
  - `GET /api/collections/journals/records`
  - `GET /api/collections/journals/records/:id`
  - `POST` 和 `PATCH` 对 `/api/collections/journals/records`
  - `POST /api/realtime`（返回 204）
- **实时不能用 `route.fulfill` 模拟**：它一次性返回完整响应体然后关闭连接，`EventSource` 会进入反复重连。我读过 SDK 源码，它只用 `new EventSource(buildURL("/api/realtime"))`，以及 `addEventListener`、`removeEventListener`、`onerror`、`close` 这几个成员，所以写一个 `FakeEventSource` 类就够：构造后发 `PB_CONNECT`（带 clientId），Node 侧通过 `page.evaluate` 或 binding 推 `{action, record}` 事件，还能手动触发 `onerror` 来模拟掉线。写法和 v1.0 的 `installClaudeMock` 一致：自包含函数、`addInitScript(fn, arg)`、状态放在 Node 侧的后端对象里。
- **多设备**：同一个 context 里开两个 page，共享同一个 `MockPocketBase`，其中一个写入，另一个断言收到推送。
- **断网**：`context.setOffline(true)` 切断 fetch，同时让 `FakeEventSource` 触发 `onerror`；恢复后断言离线队列已上传、最后上传者为准。`setOffline` 是否会派发 `online/offline` 事件需要用一个探针用例确认（沿用 v1.0 的 PROBE 做法）。[推断]
- **为什么不用整个假 SDK**：那样测不到真实 SDK 的行为（`autoCancellation`、令牌存储键、重连）；真实 SDK 加假服务端更接近线上。
- **为什么不加 MSW 或其他 mock 库**：`page.route` 已够用，v1.0 的约束是“不引入重依赖”。
- **一件 mock 证明不了的事：账号隔离。** API 规则（`owner = @request.auth.id` 等）只有真正的 PocketBase 才会执行。mock 只能模拟“规则已经生效”的结果。需要一份人工或脚本化的验收清单，在**一次性的 PocketBase 实例**（本机临时目录，或者服务器上的测试账号）上，用两个测试账号验证：A 读不到 B 的记录、A 不能改 B 的记录、未登录不能读、普通用户不能注册、不能删除账号。这一步要用到真实 PocketBase 二进制，需要所有者批准下载位置；数据只用合成数据；不属于 `npm test` 的默认流程。
- 现有的 `installClaudeMock` 和 `MockBackend` 仍然保留，用来继续跑 v1.0 的 154 条用例，直到决定应用是否继续支持 Claude Artifact 存储。

---

## Installation

服务器上（由部署脚本完成，执行前要经用户批准）：

```bash
# 下载固定版本，核对 checksums.txt 后再解压
PB_VERSION=0.41.1
curl -fLO "https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip"
curl -fLO "https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v${PB_VERSION}/checksums.txt"
sha256sum -c --ignore-missing checksums.txt
unzip pocketbase_${PB_VERSION}_linux_amd64.zip -d /opt/pb

# 超级用户（密码只在服务器上输入，不进仓库）
/opt/pb/pocketbase superuser create EMAIL PASS

# Caddy 用官方 apt 源安装，之后随系统更新
```

前端（本机，一次性，把 SDK 放进应用目录并固定版本）：

```bash
# 下载 pocketbase@0.28.2 的 dist/pocketbase.iife.js 到 pb_public/，记录其 sha256
# 不用 npm install：SDK 只作为静态文件托管，不进 package.json
```

测试（不新增依赖）：

```bash
# 保持 @playwright/test@1.64.1 不变，不新增 devDependency
```

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| 保持 `users` 集合的默认规则 | 默认 `createRule = ""`，任何人可以注册；`deleteRule` 允许用户删自己 | createRule、deleteRule 设为 null，由所有者在后台开账号 |
| 在大陆用 Google Fonts、jsDelivr、unpkg | 被墙或不稳定；Google Fonts 的样式表会阻塞渲染 | 去掉字体 `<link>`，SDK 放同源 `pb_public/` |
| 令牌时长保持默认 5 天 | 手机离线超过 5 天后，恢复联网时带着过期令牌上传会被 401 拦下 | `authToken.duration` 设 90 天以上，联网时 `authRefresh()` |
| SDK 的自动取消（`autoCancellation`）保持开启 | 防抖保存快速连发两次时，前一次请求会被取消，丢数据 | `pb.autoCancellation(false)` |
| 仅靠 SSE 保证同步 | 大陆移动网络会掐长连接，SDK 重连期间可能漏事件 | 在 `visibilitychange` 和 `online` 时主动重读记录 |
| Cloudflare 代理（橙云）挡在服务器前 | 到大陆不稳定 | DNS 仅解析（灰云） |
| HTTP/3 | UDP 443 在国内网络里常被限速 | Caddy 全局 `protocols h1 h2` |
| 自托管 Supabase / Appwrite | 内存和运维要求远超 3 人应用的预算 | PocketBase |
| 开放注册、邀请码注册 | 需求明确是所有者手动开 3 个账号 | 后台建账号 |
| 把备份只放在同一台服务器上 | 整机丢失就全丢 | PocketBase 内置 S3 备份写入 R2 |
| 在公开仓库里放服务器地址、域名、密钥、真实账号 | 隐私规则 | 部署配置放仓库外，仓库里只放模板 |
| 立刻升级到“最新” | PocketBase 0.x 不保证兼容，发布源刚搬家 | 固定 0.41.1，升级前读发布说明并先备份 |

---

## Stack Patterns by Variant

**如果所有者想要最低风险的线路：** 选香港节点（腾讯云或阿里云），延迟低、线路有商家优化。
**如果所有者没有可用于腾讯云或阿里云国际站的信用卡：** 先用 Vultr 东京（支持支付宝），上线后按真实体验再决定是否迁移；因为数据在 PocketBase 的 `pb_data` 里，迁移就是备份、新机器恢复、改 DNS。
**如果应用在服务器上遇到内存压力：** 先设 `GOMEMLIMIT=400MiB` 和 swap，再考虑升配，不要先换后端。
**如果之后要加手机离线冷启动：** 加一个手写 Service Worker 加 manifest；它需要 HTTPS（已具备），并要为该用例放开 Playwright 的 `serviceWorkers: 'block'`。

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| PocketBase 0.41.1 | JS SDK 0.28.2 | SDK 0.28.0 起对应 PocketBase 0.40 的日志接口；SDK 没有公布显式兼容表，两者在 2026-10 到 11 月相继发布，按“最新对最新”使用 [MEDIUM] |
| PocketBase 0.41.1 | Caddy 2.11.9 | 无特殊要求；Caddy 示例来自 PocketBase 官方文档 |
| PocketBase 0.41.x | 旧版 `./pocketbase update` | 从 v0.40.6 起该命令改为从新站拉取；v0.40.6 之前的二进制会去 GitHub 找新版而找不到 |
| `@playwright/test` 1.64.1 | Edge 156（`channel: 'msedge'`） | v1.0 已验证；不升级 |
| SDK iife 与现有单文件页面 | 全局名 `PocketBase` | 用 `<script src="pocketbase.iife.js">` 引入，必须放在应用脚本之前 |

---

## Sources

- 官方：PocketBase 文档首页（版本 v0.41.1、默认路由、下载链接）— https://pocketbase.io/docs/ （2026-11-05 读取）
- 官方：Going to production（自带 HTTPS、systemd、nginx 和 Caddy 示例、备份、速率限制、`GOMEMLIMIT`、文件描述符、设置加密）— https://pocketbase.io/docs/going-to-production/
- 官方：API rules and filters、Authentication、API Realtime、API Settings、Collections — https://pocketbase.io/docs/ 下对应页面
- 官方：PocketBase 源码 v0.40.6：`migrations/1640988000_init.go`（users 默认规则）、`core/collection_model_auth_options.go`（令牌默认时长）、`core/field_json.go`（JSON 字段上限）、`examples/base/main.go`（`publicDir`、`indexFallback`）— GitHub 归档仓库
- 官方：GitHub Release v0.40.6 和 Discussion #7841（迁出 GitHub 的公告）；新站 `ganigeorgiev.com` 的公开 releases 接口（v0.41.0 和 v0.41.1 发布说明和日期）
- 官方：npm 上 `pocketbase@0.28.2`（发布时间、`dist` 文件大小、README、CHANGELOG，经 jsDelivr 读取）；SDK 源码中的 EventSource 用法由我读过压缩后的 iife 文件确认
- 官方：Caddy Automatic HTTPS 和全局选项文档；GitHub 最新版本 v2.11.9（2026-11-05）
- 官方：Let's Encrypt 结束 OCSP 的公告 https://letsencrypt.org/2024/12/05/ending-ocsp.html（日期在公告中更新过）
- 二手：Let's Encrypt 证书有效期缩短到 45 天的时间表（linuxiac.com 等转述，2025-12 公告）
- 官方：Supabase 自托管文档（最低 4 GB / 2 核 / 40 GB）— https://supabase.com/docs/guides/self-hosting/docker
- 官方：腾讯云 Lighthouse 价格 https://www.tencentcloud.com/document/product/1103/47794 （页面更新于 2026-09-24）；退款文档 https://intl.cloud.tencent.com/document/product/1103/41406
- 官方：阿里云 轻量应用服务器 产品页 https://www.alibabacloud.com/en/product/swas 和价格页（页面无日期）；国际站付款和验证帮助页 intl.aliyun.com
- 官方：Vultr 公开 API https://api.vultr.com/v2/plans 和 /v2/regions（2026-11-05）；Vultr 帮助文档（付款方式、不退款政策）
- 官方：Akamai/Linode 公开 API https://api.linode.com/v4/linode/types 和 /v4/regions（2026-11-05）；https://www.akamai.com/cloud/pricing（付款方式）
- 官方：AWS Lightsail 价格页；LightNode 首页（信息不完整）
- 二手（LOW）：DMIT 的价格和线路来自多篇评测，价格互相矛盾，官网被 Cloudflare 挑战页拦截；各家到大陆的线路口碑来自社区讨论和评测文章，**没有一手实测**
- 官方：Porkbun 域名价格页（2026-11-05）；Cloudflare Registrar 产品页（成本价政策）；Cloudflare R2 价格页；Backblaze B2 价格页
- 二手（LOW）：Spaceship、Namecheap、Cloudflare 的 .com 价格来自对比网站（domaindetails.com、dupple.com）

**这份调研里没有核实的事项（给下游注意）：**
- 各 VPS 到大陆三网的实际延迟和丢包（需要买之前或者买第一个月之后自己测）。
- 阿里云轻量香港套餐的包含流量，以及它的东京价格。
- DMIT 的官方价格。
- PocketBase 在 1 GB 机器上的实际空闲内存（需要上线时量一次）。
- Service Worker 离线冷启动是否纳入范围（路线图决定）。
- `context.setOffline` 在 Edge 156 下是否派发 `online`/`offline` 事件（需要探针）。

---
*Stack research for: v2.0 多账号云端版（PocketBase + 原生单文件前端）*
*Researched: 2026-11-05*
