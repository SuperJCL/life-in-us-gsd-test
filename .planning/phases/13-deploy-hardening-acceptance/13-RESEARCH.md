# Phase 13: 部署、加固与验收（Deploy, Hardening & Acceptance） - Research

**Researched:** 2026-11-11（本机环境日期；CONTEXT 记 2026-11-12）
**Domain:** 单台小内存 Linux 服务器上的 PocketBase 0.41.1 + nginx/certbot 部署运维、CSP 与响应头加固、Service Worker/PWA、Playwright 离线与 CSP 测试、人工总体验收
**Confidence:** HIGH（PocketBase 行为、CSP、Service Worker、CORS、限流都在本机用 0.41.1 真程序和本机 Edge 实测过）；MEDIUM（nginx、logrotate、R2、SMTP 的服务器侧细节来自文档或经验，没有联系服务器，按规则标 `[ASSUMED]`，计划里都安排了第一次执行时的核对步骤）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**后台入口怎么保护（所有者讨论决定）**
- **D-01:** 后台 `/_/` **保持公网可访问**，超级用户用强密码 + **邮件验证码两步验证**（PocketBase 超级用户 MFA/OTP），照路线图成功标准 3 做。所有者没有选推荐的“后台只经 SSH 隧道访问”。登录限流开启（PocketBase 内置），代理 IP 头与 nginx 的设置一致（Phase 6/8 已定 `X-Real-IP`）。3 个普通账号不开两步验证（Phase 8：账号用的是收不到邮件的假邮箱）。
- **D-02:** 发验证码的邮箱用**所有者现有的邮箱**（所有者没有选推荐的“新注册一个只用来发信的邮箱”）。SMTP 授权码和超级用户邮箱都**由所有者本人在后台里填写**，Claude 不经手、不写进任何文件或脚本；仓库里不出现这个邮箱和授权码。建议设置 `PB_ENCRYPTION_KEY` 让 PocketBase 加密存储这些设置（由调研确认做法）。部署说明里写明风险：服务器出事时这个邮箱的授权码也要换。
- **D-03:** 服务器日志**保留 30 天、记录访问者 IP**：PocketBase 请求日志（`logs.maxDays=30`、记 IP）和 nginx 访问日志（按天轮转、保留 30 天）。日志只留在服务器上，任何导出或报告都不带 IP、域名（沿用隐私规则和 `redact.mjs`）。

**备份和恢复演练（所有者讨论决定）**
- **D-04:** 数据库**每天备份一次**（北京时间凌晨，具体时刻和服务器时区由计划定），**保留 30 天**，异地副本放在 Cloudflare R2（路线图已定）。R2 存储桶和最小权限的访问密钥由所有者本人创建，密钥由所有者本人填进服务器配置，Claude 不经手。是用 PocketBase 内置的 S3 备份，还是本机备份加上传脚本，由调研定；无论哪种，R2 里都要能拿到最近 30 天每天一份。
- **D-05:** 恢复演练在**服务器上的临时实例**里做，**在导入真实数据之前**：从 R2 取回一份只含测试账号的备份，在另一个端口和数据目录起一个临时 PocketBase 恢复、核对合成账号的数据完整，然后删除临时实例。真实数据不离开服务器，也不下载到所有者的电脑。
- **D-06:** 备份失败时**发邮件提醒**：用 D-02 同一个发信邮箱，在备份失败或连续两天没有新备份时，发一封邮件到所有者的邮箱。

**离线和更新提示（所有者讨论决定）**
- **D-07:** Service Worker 只缓存应用外壳（页面、SDK、清单、图标），**从不缓存 `/api/`**；页面打开过一次后断网能冷启动进入应用并记录，断网时刷新也能打开，待上传的修改和数量还在（路线图成功标准 4，承接 10-CONTEXT D-08）。
- **D-08:** 发布新版本后，已打开或装在主屏幕的应用**提示「有新版本，点此更新」**，所有者点了才刷新（所有者没有选推荐的“下次打开自动换新”）。有未保存的修改（例如「记一笔」草稿、编辑计划页的草稿）时，点更新先确认；待上传的修改本来就存在本机缓存里，刷新后照常上传。提示的位置和样式沿用 09-UI-SPEC 的横幅写法。
- **D-09:** 主屏幕上的名字是 **「计划手记」**，图标用应用现有配色的纯色底加一个 **「记」** 字，由 Claude 生成（各尺寸 PNG、可遮罩图标、苹果主屏图标），不用外部素材。

**探针站点和总体验收（所有者未选讨论，按推荐定，可以再改）**
- **D-10:** 删除 Phase 6 的探针页、探针的 nginx 位置块（`/probe/`）、探针的数据结构和数据。探针页的 CR-01、CR-02 不再修（页面删除后不适用），网络可达性改由总体验收时的真机实际使用来检验。
- **D-11:** 在 Phase 6 已装好的基础上**升级**，不重装系统：保留 swap、PocketBase 0.41.1 的二进制和 `pocketbase` 用户、nginx 和 certbot；把探针配置换成应用配置（应用迁移文件、应用的 nginx 位置块、页面和 SDK 文件）。Phase 6 脚本里只在重跑时才暴露的缺陷（06-REVIEW 的 WR-07、WR-08、WR-09、IN-06、IN-07、IN-09、IN-11）在 `deploy/` 模板里修掉。
- **D-12:** 写一份**中文总体验收清单**，所有者按清单自己走一遍、把结论告诉 Claude（所有者 2026-11-12 的决定：各阶段不单独验收）。清单包含：路线图成功标准 5；Phase 10 的真机“几秒内”同步与断网记录；Phase 11 的真机下载备份、日历 CSV 和选文件导入；Phase 12 推迟的 5 项（见 `.planning/phases/12-plan-editor/12-UAT.md` 的 Deferred Follow-Ups）。
- **D-13:** 总体验收**先用一个临时测试账号**做（含彻底删除、冲突三选一这类会删数据的操作），确认没问题后再由所有者导入真实旧数据（本机跑 `tools/plan/migrate-backup.mjs`，Claude 不读真实数据），测试账号随后删除。恢复演练（D-05）也在导入真实数据之前完成。

**已有决定（沿用，不再讨论）**
- 服务器是阿里云轻量应用服务器香港，不论实测结果都不更换（Phase 6 D-01、D-08）；Web 服务用服务器上已有的 nginx + certbot（Phase 6 D-02，调研文件里写的 Caddy 已作废）。
- PocketBase 固定 0.41.1，安装前核对 SHA-256，0.40.6 为备选；非 root 的 `pocketbase` 用户、systemd、只监听 127.0.0.1、`Restart=always`、内存上限（Phase 6 D-03、D-16，`tools/probe/server/pocketbase.service`）。
- 服务器上的每个脚本先由所有者批准精确的 sha256 清单，上传后和执行前逐个核对；只读检查不用批准；每次下载都要先批准（Phase 6 D-04、D-04a、D-17）。超级用户密码只由所有者在阿里云网页终端输入，不写进任何文件（D-05）。
- 应用迁移文件 `pb/pb_migrations/1794096000_users_lockdown.js`、`1794096100_journey_docs.js` 原样复制到服务器；SDK 0.28.1 同源加载、带 SRI。
- 云端开关是页面里的一行 `window.USJ_CONFIG = { backend: 'pocketbase' }`，服务器地址取 `location.origin`；Phase 13 部署时决定怎么注入（见 Claude's Discretion）。
- 测试不连接真实服务器；本机测试低优先级、单 worker；仓库里不放服务器地址、域名、密钥、真实数据和个人计划文字。

### Claude's Discretion
- `window.USJ_CONFIG` 的注入方式：建议由部署步骤在发布到服务器的那份页面里插入这一行，仓库里的 `us-journey-tracker.html` 保持本地版（不带这一行），`APP_SHA256` 仍指仓库文件；具体做法由调研和计划定。
- CSP 的写法（内联脚本用哈希还是记录在案的 `'unsafe-inline'` 折中；`style="width:…%"` 属性对 `style-src` 的影响）、其他安全响应头、CORS 收紧到站点自己的源。
- nginx 的请求体上限要放到不小于应用文档上限（现在 `client_max_body_size 1m`，应用文档上限 4 MiB），实时连接的参数沿用 Phase 6 验证过的（关缓冲、HTTP/1.1、读超时 3600 秒）。
- `deploy/` 模板的目录结构和脚本拆分、私有参数文件的变量名（沿用 `private/server.env` 的做法）、`verify-site.mjs` 改成检查应用站点。
- 备份时刻和服务器时区、邮件提醒的实现方式（PocketBase 钩子或定时检查）。
- 更新提示的文案和位置（沿用 09-UI-SPEC 横幅）、Service Worker 的版本号和缓存更新细节、冷启动离线用例怎样单独放开 `serviceWorkers: 'block'`。
- 页面继续带 `noindex`。

### Deferred Ideas (OUT OF SCOPE)
- 后台只经 SSH 隧道访问（推荐过、所有者这次没选），以后如果后台被频繁试密码可以再改。
- 单独注册一个只用来发信的邮箱（推荐过、所有者这次没选）。
- 探针页的 CR-01、CR-02 修复：探针页删除后不再需要；如果将来要再做国内三网测速，另起任务。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | 服务器每天自动备份数据库，并复制一份到服务器以外（Cloudflare R2）；做过一次恢复演练 | §1a 内置 S3 自动备份（只落 R2、`cronMaxKeep=30`、cron 按 UTC）；§1e 失败邮件内置 + 钩子看门狗；§6 恢复演练脚本 |
| OPS-02 | 服务器重启后，PocketBase 和 HTTPS 自动恢复 | §6 systemd unit（`EnvironmentFile`、`Restart=always`）、swap 的 fstab 缺陷 WR-07、真重启验证步骤 |
| OPS-03 | 部署和升级有写好的步骤和脚本；PocketBase 固定版本，安装前核对校验和 | §6 `deploy/` 目录结构、构建脚本、sha256 批准清单流程、WR/IN 缺陷的修法 |
| OPS-04 | 页面打开过一次后，断网时也能打开（冷启动离线），也可以添加到手机主屏幕 | §4 Service Worker、清单、图标；§5 Playwright 离线用例（本机 Edge 实测过） |
| SEC-02 | 网站发出 CSP 和安全响应头；后台管理入口启用强密码、两步验证和登录限流 | §3 CSP 方案（哈希 + `style-src-attr 'none'`，实测）；§2 nginx 响应头；§1b/§1c 超级用户 MFA、限流、`trustedProxy` |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

以下取自 `.claude/CLAUDE.md`，与 CONTEXT 的锁定决定同等效力：

- 应用源码可以改，但四个视图的界面和操作方式不变；前端保持原生 HTML/JS，不引入框架；后端 PocketBase；测试用 Playwright Test。
- 托管 Artifact 不访问、不修改、不发布。
- 真实数据只存在用户自己的服务器上；测试只用合成数据，不连接真实服务器。
- 服务器是阿里云轻量应用服务器香港，nginx + certbot 已有，不论实测结果都继续用；费用要便宜。
- 服务器、域名的购买注册由所有者本人完成；Claude 不代为注册、付款、输入密码；服务器上的安装由部署脚本完成，**执行前经所有者批准**。
- 本机只装项目内 npm devDependency，用本机 Edge，不下载浏览器；测试运行时拦截所有外部请求。
- 公开仓库里不放服务器地址、域名、密钥、后台密码、真实数据和个人计划文字。
- 本机测试低优先级、单 worker、不并发。
- GSD 流程：直接改仓库文件要通过 GSD 命令；本调研只写 RESEARCH.md。

## Summary

本阶段的难点不在“用什么”，而在“怎么让每一步既对、又不泄密、又能被测试”。调研做了大量本机实验（用仓库已有的 `tools/pb/bin/pocketbase.exe` 0.41.1 和本机 Edge，实验目录在系统临时区、用完已删除），结论比文档更可靠：PocketBase 的备份、限流、`trustedProxy`、日志、MFA/OTP 设置**都可以由迁移文件设置**（只有含密钥的 SMTP、S3 凭据、超级用户邮箱必须由所有者在后台填）；内置自动备份在启用 S3 后**只存在 R2**，失败时 PocketBase **自己会给所有超级用户发邮件**，所以 D-06 只需要再补一个“两天没有新备份”的看门狗钩子；cron 表达式按 **UTC** 计算；`PB_ENCRYPTION_KEY` 丢失会让 PocketBase **起不来**，恢复演练的临时实例也必须带同一把钥匙。

CSP 方面：用 **sha256 哈希**完全能兼容单文件里的内联 `<script>`/`<style>`（本机 Edge 实测通过，CRLF 文件也一样，因为 HTML 解析会先把换行归一化）。唯一的障碍是 `renderGoals` 里 4 处生成的 `style="width:…%"` 属性：实测在严格 CSP 下 `innerHTML` 带出来的 style 属性**被拦**（违规指令是 `style-src-attr`），而 `el.style.width = …`（CSSOM 逐属性赋值）**不受影响**。推荐把这 4 处改成 `data-w` 属性加一次渲染后的 CSSOM 赋值，CSP 就能写成 `style-src-attr 'none'`，全站没有任何 `unsafe-inline`。`window.USJ_CONFIG` 推荐作为**第二个很小的内联 `<script>`**由构建脚本插入已发布的那份页面（与主脚本分开，所以主脚本哈希、仓库文件的 `APP_SHA256` 都不受影响；两个哈希都由同一个构建函数算出并写进 nginx 的 CSP 头文件）。

Service Worker 方面：已在本机 Edge + 死代理 + `context.route` 护栏的真实配置下验证了整套方案——只拦应用外壳、`/api/` 不 `respondWith`（所以现有 `FakePbServer` 的 `context.route` 照常接得住）、断网刷新和断网新开标签页都从缓存启动、更新流程（`reg.waiting` → `postMessage(SKIP_WAITING)` → `controllerchange` → 重载）正常。Playwright 的 `serviceWorkers: 'block'` 下 `register()` 仍然 resolve，页面没有报错，所以应用代码照常注册即可，v1 用例不受影响。图标可以用已装的 Playwright + Edge 渲染，已验证能生成无透明通道的 RGB PNG。

**Primary recommendation:** 在仓库里加 `deploy/`（服务器模板 + 构建脚本 + 站点资源），服务器侧用 PocketBase 内置 S3 备份 + 一个只做“两天没新备份”检查的钩子；网站用“构建脚本生成发布版页面 + CSP 哈希头 + 版本化的 `sw.js`”三件套；先在本机用 `serveAppVariant` 同类的路由方式跑 CSP 与 Service Worker 用例，最后才在服务器上按批准清单逐步执行并做真重启和恢复演练。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 页面外壳的离线缓存与更新 | Browser / Client（Service Worker） | CDN / Static（nginx 发 `sw.js`、no-cache） | 缓存决策在浏览器；nginx 只负责让 `sw.js` 与 HTML 不被长缓存，保证更新可见 |
| 「有新版本」提示与确认 | Browser / Client（应用脚本） | — | 要读 `isBusy()`、草稿状态，只能在页面里 |
| CSP、安全响应头、`noindex` | CDN / Static（nginx 响应头） | Browser（强制执行） | 头由 nginx 发；哈希由本机构建脚本在发布前算出 |
| `USJ_CONFIG` 注入 | 构建/部署步骤（本机 Node） | Browser（读取） | 避免改动仓库页面与 `APP_SHA256`；哈希随同一步生成 |
| 账号隔离、记录规则 | API / Backend（PocketBase 迁移，已完成） | — | Phase 8 已定；本阶段只做“一次性实例重跑” |
| 登录限流、代理 IP | API / Backend（PocketBase 设置） | nginx（设置 `X-Real-IP`） | 两侧必须一致，否则所有人共用 127.0.0.1 这个 IP 被一起限流 |
| 后台两步验证 | API / Backend（`_superusers` 的 OTP+MFA） | 外部 SMTP | 验证码走邮件；SMTP 不通会锁住后台（恢复靠命令行） |
| 每日备份与异地副本 | Database / Storage（PocketBase 内置 + R2） | pb_hooks 看门狗 | 备份由内置 cron 完成；看门狗补“连续两天没有新备份” |
| 日志留存与轮转 | API（`logs.maxDays`）+ OS（logrotate） | nginx | 两处各自 30 天 |
| 开机自恢复 | OS（systemd、certbot.timer、fstab swap） | — | 重启后三个单元必须都是 enabled |
| 恢复演练 | 服务器（临时实例，`systemd-run`） | 所有者（输入 R2 凭据） | 真实数据不离开服务器；密钥只在所有者的网页终端里输入 |

## Standard Stack

### Core

| Library / 组件 | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| PocketBase（linux_amd64 预编译） | 0.41.1，zip sha256 钉在 `tools/probe/server/02-install-pocketbase.sh`（`7504ec99…447e`） | API、认证、SSE、备份、后台 | D-03 已定；本机 `tools/pb/bin/pocketbase.exe --version` 实测输出 `pocketbase.exe version 0.41.1` `[VERIFIED: 本机 0.41.1 程序]` |
| PocketBase JS SDK | 0.28.1，同源 `/vendor/pocketbase.iife.js`，SRI 写在页面里 | 前端访问 | 已定；SDK 文件内没有 `eval(` 和 `new Function`（grep 计数 0），所以不需要 `unsafe-eval` `[VERIFIED: grep tools/probe/page/vendor/pocketbase.iife.js]` |
| nginx（服务器已有） | 1.24（Ubuntu 24.04.5 LTS） | 反代、静态、响应头、访问日志 | Phase 6 已装、certbot 已接管证书（`06-06-SUMMARY.md` 记 OS，`05-nginx-probe.sh` 注释记 1.24） |
| certbot（已有）+ `certbot.timer` | 已有 | 证书续期 | Phase 6 的 `certbot renew --dry-run` 已通过 |
| Cloudflare R2（S3 兼容） | 服务 | 异地备份 | D-04 已定；端点 `https://<account-id>.r2.cloudflarestorage.com`、region `auto` `[CITED: developers.cloudflare.com/r2/api/s3/api/]` |
| systemd（Ubuntu 24.04 自带） | — | 进程托管、`EnvironmentFile`、`systemd-run` 临时实例 | Phase 6 已用；`ExecStart` 里 `${VAR}` 可展开 `EnvironmentFile` 变量 `[CITED: freedesktop.org systemd.service]` |
| logrotate（Ubuntu 自带） | — | nginx 访问日志按天、留 30 天 | 见 §2；细节 `[ASSUMED]` |

### Supporting

| Library / 工具 | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `@playwright/test` | 1.64.1（`package.json` 钉死）`[VERIFIED: npx playwright --version]` | 全部浏览器用例、图标渲染 | 已装；不新增任何包 |
| 本机 Edge（`channel: 'msedge'`） | 已安装 | 渲染图标、SW/CSP 用例 | 已有，不下载浏览器 |
| Node | v24.20.0（本机）`[VERIFIED: node --version]` | 构建脚本、验证脚本 | 零依赖脚本，沿用 `tools/` 风格；`node:sqlite` 可只读查本机实验库 |
| `python3`（服务器，标准库） | Ubuntu 自带 | 解 zip（`-m zipfile`）、只读 sqlite 检查、解析 R2 的 XML | Phase 6 脚本已这么做，不装系统包 |
| `curl`（服务器） | Ubuntu 24.04 自带（8.x） | 健康检查、`--aws-sigv4`（≥7.75）、`-K -` 从标准输入读配置 | 恢复演练的备选取包方式 `[CITED: curl.se/docs/manpage.html]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 内置 S3 备份 | 本机备份 + `rclone`/`aws` 上传脚本 | 要装额外软件、R2 密钥落成服务器上的明文文件；内置方案密钥存在 PocketBase 设置里（可被 `PB_ENCRYPTION_KEY` 加密）。D-04 的要求（R2 里有最近 30 天每天一份）内置方案满足，所以选内置 |
| 内置 S3（只存 R2） | 额外保留一份本机备份 | 本机副本和数据库同盘，服务器整盘丢失就一起没了；增加复杂度，不推荐。残余风险是“R2 不可用或凭据失效时当天没有备份”，由失败邮件 + 看门狗覆盖 |
| 哈希 CSP + CSSOM 改 4 处 | `style-src-attr 'unsafe-inline'` 折中 | 零应用改动，但 CSS 注入类风险留着；应用本来就要改（SW 注册、横幅），多改 4 处模板成本很小，所以推荐严格方案，折中作为回退 |
| 第二个内联脚本放 `USJ_CONFIG` | 同源 `/config.js` | 多一个文件，必须进 SW 预缓存且与页面版本保持一致，否则离线冷启动会退回本地模式；内联版随页面一起缓存，不会错配 |

**Installation:** 本阶段**不安装任何新的 npm 或系统包**。服务器侧只用已有的 `curl`、`openssl`、`python3`、`systemd`、`logrotate`。PocketBase 二进制沿用 Phase 6 已装的 0.41.1（D-11 保留）。

**Version verification:** 没有新增外部包，无需 `npm view`。PocketBase 版本用 `tools/pb/bin/pocketbase.exe --version` 核对为 0.41.1（本机）；服务器上的二进制由 `02-install-pocketbase.sh` 的钉死哈希与 `--version` 检查保证。注意 0.41.x 的发布**不在 GitHub**（GitHub 最新是 v0.40.6，见 `tools/pb/PB-LOCAL.md`）；本调研引用的源码行为取自 GitHub `master` 分支，并用 0.41.1 程序做了实测，凡是实测过的都标 `[VERIFIED: 本机 0.41.1]`，只有源码依据的标 `[CITED]`。

## Package Legitimacy Audit

本阶段不安装外部包（npm、pip、cargo、apt 都没有新增）。PocketBase 二进制不是包管理器的包，它的完整性由 `02-install-pocketbase.sh` 里钉死的 zip sha256、与 `checksums.txt` 的互相核对和 `--version` 检查保证（单一来源的信任模型已由所有者在 Phase 6/8 知悉）。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| （无新增） | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                    浏览器（大陆 / 美国，手机 / 电脑）
                         │  https://<domain>
                         ▼
        ┌──────────────────────────────────────┐
        │ nginx（certbot 管证书，443 server 块）│  access_log → /var/log/usj/（30 天）
        │  include snippets/usj-app.conf       │
        └──────────────────────────────────────┘
          │ = /          │ = /sw.js      │ ^~ /vendor/ /icons/  │ ^~ /api/ │ = /api/realtime │ ^~ /_/
          │ index.html   │ no-cache      │ 静态                 │ 反代     │ 反代,关缓冲,    │ 反代（PocketBase
          │ +CSP 哈希头  │ +最小 CSP     │                      │ 5m 请求体│ 读超时 3600s    │ 自带 CSP，nginx 不覆盖）
          ▼              ▼               ▼                      └────────┬─┴─────────────────┘
   /var/www/usj/site（root 所有，只读给 nginx）                           ▼
                                                      127.0.0.1:8090  PocketBase 0.41.1（systemd，pocketbase 用户）
                                                       ├─ EnvironmentFile=/etc/usj/pocketbase.env（加密钥匙、允许的源）
                                                       ├─ pb_migrations（应用迁移 2 个 + server_settings 1 个）
                                                       ├─ pb_hooks/backup-watch.pb.js（cron 看门狗）
                                                       └─ 内置 cron 每天 19:00 UTC → 备份 → R2（S3 兼容，只存这里）
                                                                         │ 失败 → PocketBase 给所有超级用户发邮件
   浏览器内：页面 ──注册──► sw.js（/ 作用域）预缓存外壳；/api/* 不拦截；
   新 sw.js 到达 → reg.waiting → 横幅「有新版本，点此更新」→（有草稿先确认）→ SKIP_WAITING → controllerchange → 重载

   本机（构建/验证，不连服务器）：build-site.mjs ─► private/deploy-out/{index.html,sw.js,usj-csp.conf,SHA256SUMS}
                                  Playwright（Edge）：CSP 用例、SW 离线/更新用例（本机静态服务器，假服务器）
```

### Recommended Project Structure

```
deploy/
├── README.md                      # 中文：首次部署、升级、回滚、轮换密钥、风险说明（邮箱授权码、加密钥匙丢失）
├── build-site.mjs                 # 本机运行：读 us-journey-tracker.html + SDK + site/ 资源，输出到 private/deploy-out/
├── make-icons.mjs                 # 用 Playwright+Edge 渲染 PNG（一次性生成后把 PNG 提交进仓库）
├── site/
│   ├── sw.js                      # 带 __BUILD_VERSION__ 占位；本机测试服务器用固定版本替换
│   ├── manifest.webmanifest
│   └── icons/                     # icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon-180.png
├── server/                        # 经所有者批准后上传到服务器执行的脚本和模板
│   ├── 00-status.sh               # 只读（沿用）
│   ├── 01-swap.sh                 # 修 WR-07
│   ├── 02-install-pocketbase.sh   # 修 IN-11；已装同版本则 already
│   ├── 03-configure-pocketbase.sh # 装迁移和钩子、生成加密钥匙文件（不打印）；不再生成探针账号
│   ├── 04-start-pocketbase.sh     # 修 WR-08；换 unit 后 restart
│   ├── 05-nginx-app.sh            # 修 WR-09；把探针 include 换成应用 include
│   ├── 06-install-site.sh         # 原子切换 /var/www/usj/site
│   ├── 07-retire-probe.sh         # D-10：删探针页、探针迁移文件，清空 pb_data（需所有者单独批准）
│   ├── pb-admin.sh                # 装到 /usr/local/sbin：带钥匙和固定目录运行 PocketBase 命令行
│   ├── restore-drill.sh           # D-05：所有者在网页终端运行，凭据现场输入
│   ├── pocketbase.service
│   ├── nginx/{usj-app.conf,usj-headers-common.conf,anchor-block.awk}
│   └── logrotate/usj-nginx
├── pb_migrations/
│   └── 1794096200_server_settings.js   # 只放无密钥的服务器设置（见 §1f）；不放进 pb/pb_migrations
├── pb_hooks/
│   └── backup-watch.pb.js
└── verify-site.mjs                # 由 tools/probe/verify-site.mjs 改造：检查应用站点（响应头、CSP 哈希一致、清单、SW、SSE、隔离抽查、限流）
```

要点：服务器设置迁移放 `deploy/pb_migrations/`，**不要**放进 `pb/pb_migrations/`——后者是本机一次性实例、`rules.expected.json`、`tools/pb/isolation-check.mjs` 共用的“应用契约”，而 `tools/pb/lib/instance.mjs` 的测试会主动关闭限流（`report('rate-limits-off', …)`），混进去会破坏本机用例。

### Pattern 1: 服务器设置由迁移文件下发（无密钥部分）

**What:** 日志、限流、代理 IP 头、备份的 cron 和保留数都放进一个迁移文件，随 PocketBase 首次启动应用；含密钥或个人信息的项（SMTP 账号口令、发件人地址、S3 凭据和端点、超级用户邮箱）由所有者在后台填。
**When to use:** 部署时一次性；之后要改，加一个新的迁移文件（新时间戳）或由所有者在后台改。
**Example:**
```js
// deploy/pb_migrations/1794096200_server_settings.js
// 本机 0.41.1 实测：这些赋值全部生效，且 GET /api/settings 能读回
// [VERIFIED: 本机 0.41.1 一次性实例实验]
migrate((app) => {
  const s = app.settings()
  s.logs.maxDays = 30          // D-03
  s.logs.logIP = true          // D-03
  s.logs.logAuthId = false     // 不需要记账号 id
  s.trustedProxy.headers = ["X-Real-IP"]   // 必须与 nginx 的 proxy_set_header X-Real-IP $remote_addr 一致
  s.rateLimits.enabled = true
  s.rateLimits.rules = [
    { label: "_superusers:auth", duration: 60, maxRequests: 5 }, // 后台：更具体的规则优先，本机实测第 4 次起 429
    { label: "*:auth", duration: 3, maxRequests: 2 },            // 以下四条是 0.41.1 的默认规则，原样保留
    { label: "*:create", duration: 5, maxRequests: 20 },
    { label: "/api/batch", duration: 1, maxRequests: 3 },
    { label: "/api/", duration: 10, maxRequests: 300 },
  ]
  s.backups.cron = "0 19 * * *"   // cron 按 UTC 计算：19:00 UTC = 北京时间 03:00
  s.backups.cronMaxKeep = 30      // 保留最新 30 份
  s.meta.appName = "usj"          // 自动备份文件名里会带它的 snake_case（默认是 acme）
  app.save(s)
}, (app) => {})
```
注意：设置迁移里**不要**启用 `_superusers` 的 OTP/MFA（见 §1b 的先后顺序）。

### Pattern 2: 构建脚本产出“发布版页面 + CSP 头 + 版本化 sw.js”

**What:** `deploy/build-site.mjs`（本机运行，零依赖）读仓库页面，插入 `USJ_CONFIG` 内联脚本，算出所有内联 `<script>`/`<style>` 的 sha256，生成 nginx 的 CSP 头文件，并用整个外壳的哈希作为 `sw.js` 的版本号。导出纯函数（`buildSite({ html, config })`）供 Playwright 的 CSP 用例直接调用，保证测试看到的就是线上发的。
**Example（哈希计算，已在本机 Edge 实测）：**
```js
// 对每个没有 src 的 <script>…</script> 和 <style>…</style>：先把 \r\n 归一成 \n，再算 sha256 的 base64
// 实测：服务端用 CRLF 发送页面、哈希按 LF 文本算，脚本照常执行（HTML 解析先归一化换行）
// [VERIFIED: 本机 Edge 实验，用例 C]
import { createHash } from 'node:crypto';
const h = (txt) => "'sha256-" + createHash('sha256').update(txt.replace(/\r\n/g, '\n')).digest('base64') + "'";
const inline = (tag, html) => [...html.matchAll(new RegExp(`<${tag}(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
// scripts = inline('script', html).map(h); styles = inline('style', html).map(h)
```
**CSP（最终形态，所有哈希由构建脚本填，下面是占位）：**
```
default-src 'none';
script-src 'self' <主脚本哈希> <config 脚本哈希>;
style-src <style 哈希>;
style-src-attr 'none';
connect-src 'self';            # REST 和 SSE（EventSource）都归它管，本机实测放行
img-src 'self';                # 图标；应用没有 data: 图片
manifest-src 'self';
worker-src 'self';
base-uri 'none';
form-action 'self';
object-src 'none';
frame-ancestors 'none'         # 只能放响应头里，<meta> 里无效 [CITED: w3.org/TR/CSP3 §3.3]
```
本机实测（Edge）：哈希放行内联脚本和样式；同源外链脚本（带 SRI 的 SDK）被 `'self'` 放行；`Blob` + `<a download>` 下载在 `default-src 'none'` 下正常触发；`new EventSource('/api/…')` 在 `connect-src 'self'` 下无违规 `[VERIFIED: 本机 Edge 实验]`。

### Pattern 3: Service Worker（只管外壳，/api 不碰）

**Example（骨架，整套流程已在本机 Edge + 死代理 + `context.route` 下跑通）：**
```js
// deploy/site/sw.js —— 构建时把 __BUILD_VERSION__ 换成外壳哈希前 12 位
const V = '__BUILD_VERSION__', CACHE = 'usj-shell-' + V;
const SHELL = ['/', '/vendor/pocketbase.iife.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon-180.png'];
self.addEventListener('install', (e) => e.waitUntil(
  caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    fetch(u, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error(u); return c.put(u, r); }))))));
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;                 // 不碰跨源
  const nav = e.request.mode === 'navigate' && (u.pathname === '/' || u.pathname === '/index.html');
  if (nav) { e.respondWith(caches.open(CACHE).then((c) => c.match('/')).then((r) => r || fetch(e.request))); return; }
  if (SHELL.includes(u.pathname)) e.respondWith(caches.open(CACHE).then((c) => c.match(u.pathname)).then((r) => r || fetch(e.request)));
  // 其余（/api/*、/_/*、/sw.js 自己）一律不 respondWith，交给浏览器走网络
});
```
关键设计（每条都对应一个已实测的行为）：
- **不调用 `clients.claim()`、不在 install 里 `skipWaiting()`**：实测首次加载后页面没有 controller，下一次导航才被接管，所以首次安装不会触发 `controllerchange`，应用的“控制器变了就刷新”处理不会在首次安装时误刷新；新版本只在点击后才生效，所以旧页面始终配旧缓存，不会新旧混用。
- **install 里用 `fetch(u, { cache: 'reload' })`**，绕过 HTTP 缓存，缓存里放的是服务器上当下的真文件。
- **导航请求只在路径是 `/` 或 `/index.html` 时回缓存**：`/_/`（后台）和 `/api/` 不能被 Service Worker 接管，否则后台页面会被换成应用外壳。
- **缓存的是 `fetch()` 得到的同源完整响应**，`<script integrity>` 对它照常校验；SDK 版本变动时页面里的 `SDK_SRI` 和 SDK 文件同在一个发布里，外壳哈希随之变化。

### Pattern 4: 注册与更新提示（页面内）

```js
// 只在云端模式、安全上下文里注册；v1 路径、claude.ai 里的 Artifact 都不会走到
if (CLOUD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    const offer = () => { if (navigator.serviceWorker.controller) showUpdateBar(reg); };  // 首次安装没有 controller，不提示
    if (reg.waiting) offer();
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed') offer(); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}
// 点击「点此更新」：
//   const go = () => { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
//                      reg.waiting.postMessage({ type: 'SKIP_WAITING' }); };
//   if (isBusy() || planDirty()) → 先走应用已有的确认框，确认后 go()
```
- 复用应用现有的 `isBusy()`（`us-journey-tracker.html` 约 1868–1870 行的注释说它覆盖：打开的对话框、草稿、新标签输入框、文本框光标、未提交的周复盘、未保存的力量值、待办输入）和 `planDirty()`（约 2306 行）作“有未保存修改”的判断；编辑计划页本来就有 `beforeunload` 守卫（约 2789 行），重载时浏览器还会再确认一次。这些函数名来自 grep，计划阶段需通读确认。
- 横幅沿用 09-UI-SPEC 的 `.syncbar` 信息类变体（`data-tone="info"`，UI-SPEC 第 115 行写“如远端更新待应用”）。
- 已装在主屏幕的应用可能很久不被重新加载：用 `visibilitychange` 触发 `reg.update()`，浏览器本身也会在导航和约每 24 小时检查 `sw.js`。`reg.update()` 的字节比对与 nginx 对 `sw.js` 的 `Cache-Control: no-cache` 配合。
- 实测：`serviceWorkers: 'block'` 下 `navigator.serviceWorker.register()` **resolve 而不抛错**（页面无 pageerror），所以 v1 和现有 cloud 用例里应用照常调用注册也不会让护栏报警；仍然保留 `.catch(() => {})`。

### Anti-Patterns to Avoid
- **在 nginx 的 server 层写 `add_header`，又在 location 里写别的 `add_header`：** location 里只要有一条 `add_header`，上层的全部不继承 `[CITED: nginx.org/en/docs/http/ngx_http_headers_module.html]`（`add_header_inherit merge` 要 nginx ≥1.29.3，本机 1.24 没有）。做法：每个 location 都 `include snippets/usj-headers-common.conf`。
- **给 `/_/` 和 `/api/` 再加一遍 CSP/`nosniff`/`X-Frame-Options`：** PocketBase 自己已发 `X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Cross-Origin-Opener-Policy: same-origin`，`/_/` 还带自己的 CSP（`frame-ancestors 'none'`）`[VERIFIED: 本机 0.41.1 响应头]`。nginx 对这两个位置只补 `X-Robots-Tag`、`Referrer-Policy`、`Permissions-Policy`，不覆盖它们。
- **用 Service Worker 做 `fetch(e.request)` 的全包转发：** 会让 `/api` 请求变成 worker 发起的请求，破坏现有 `FakePbServer` 的页面侧拦截，也会缓存不该缓存的东西。
- **把 `USJ_CONFIG` 放进主内联脚本里：** 会让主脚本哈希随部署参数变化，并且需要发布版页面与仓库页面分叉得更厉害。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 每日备份、异地副本、保留 30 份 | 自己的 cron + `rclone`/上传脚本 + 清理脚本 | PocketBase 内置自动备份（`backups.cron`、`cronMaxKeep`、`backups.s3`） | 内置方案在 0.41.1 里已实测：S3 失败会记日志并**给所有超级用户发“备份失败”邮件**；按 `@auto_pb_backup_` 前缀按修改时间保留最新 N 份 |
| 备份失败邮件 | 自己写 SMTP 发送 | PocketBase 内置的 autobackup 失败告警（用已配置的 SMTP） | 本机用无效 S3 端点实测：日志出现 `[Backup cron] Failed to create backup` 和随后的 `Failed to send backup error alerts`（后者只是因为本机没配 SMTP）`[VERIFIED: 本机 0.41.1]`。只有“连续两天没有新备份”才需要自己的钩子 |
| 后台两步验证 | 自己做验证码流程 | `_superusers` 集合的 OTP + MFA 选项 | 本机实测：开启后密码登录返回 401 + `mfaId`，再 `request-otp`、`auth-with-otp` 成功；命令行 `superuser otp` 可在 SMTP 故障时生成 8 位码，180 秒有效 `[VERIFIED: 本机 0.41.1]` |
| 限流 | nginx `limit_req` 配一套 | PocketBase 内置限流（`rateLimits.rules`，按 `trustedProxy` 解出的 IP） | 本机实测：同一 `X-Real-IP` 第 3 次起 429，换一个 IP 不受影响，更具体的 `_superusers:auth` 规则覆盖 `*:auth` `[VERIFIED: 本机 0.41.1]` |
| 设置加密 | 自己加密 SMTP/S3 密钥 | `--encryptionEnv=PB_ENCRYPTION_KEY`（32 字符） | 本机实测：设置存成密文；钥匙缺失/错误/长度不对都会让进程直接退出 `[VERIFIED: 本机 0.41.1]` |
| CSP 哈希 | 手抄哈希 | 构建脚本逐个内联块算 sha256 | 页面一改哈希就变；手抄必漏 |
| 图标 | 找外部素材或装图像库 | 已装的 Playwright + Edge 渲染 HTML 成 PNG | 本机已验证输出 RGB PNG（无透明通道，iOS 主屏图标要求不透明），不装任何东西 |
| 站点证书续期 | 自己写续期脚本 | 已有的 `certbot.timer` | Phase 6 已通过 dry-run |

**Key insight:** 这个阶段的大多数“功能”其实是把 PocketBase、nginx、浏览器各自已有的机制配对到一起，真正容易出错的是配对处（IP 头、哈希、缓存版本、加密钥匙、先后顺序），所以每个配对点都要有自动检查。

## Runtime State Inventory

本阶段把 Phase 6 的探针配置替换成应用配置（D-10、D-11），属于迁移类，逐类列出：

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `/var/lib/pocketbase/pb_data`：探针集合 `probe_results`、`probe_pings`、探针账号（公开口令）、Phase 6 所有者建的超级用户、以明文存的设置（探针迁移设置过日志/限流） | **数据迁移**（不是代码修改）：D-10 要删探针数据。最干净的做法是停服务后清空 `pb_data`，让新的迁移集（应用迁移 + server_settings）在空库上跑；之后所有者用 `pb-admin.sh` 重新建超级用户。清空是破坏性操作，需所有者单独批准；探针库里只有合成数据（06-PROBE-RESULTS 已声明） |
| Live service config | nginx：certbot 的 `sites-enabled/default` 里有一行 `include snippets/usj-probe-locations.conf; # usj-probe`，片段文件在 `/etc/nginx/snippets/`，页面在 `/var/www/usj/probe/`；`/etc/nginx/usj-backup/` 里有带时间戳的站点备份。管理后台里没有任何已填的 SMTP/S3 设置 | **代码编辑 + 配置迁移**：`05-nginx-app.sh` 要把探针 include 行换成应用 include（先检查锚点、备份、`nginx -t`、certbot dry-run、失败回滚），删除探针片段；Cloudflare R2、SMTP 在所有者填写之前不存在 |
| OS-registered state | systemd：`pocketbase.service` 已 enabled（unit 里没有 `EnvironmentFile`、`--encryptionEnv`、`--origins`、`--migrationsDir`、`--hooksDir`）；`/etc/fstab` 的 swap（WR-07 只在重跑时才可能缺行）；`certbot.timer` | 重装 unit 后必须 `daemon-reload` 并 **restart**（`enable --now` 不会重启已运行的服务，WR-08）；核对 fstab 有 swap 行；核对三个单元 enabled |
| Secrets/env vars | 探针账号的公开口令在 `/var/www/usj/probe/config.js` 和一个迁移文件里；`PB_ENCRYPTION_KEY` 目前不存在；本机 `private/server.env`（`USJ_DOMAIN`、`USJ_IP`）、`private/pocketbase/` 的 zip 副本 | 新增 `/etc/usj/pocketbase.env`（`PB_ENCRYPTION_KEY`、`USJ_ORIGIN`）由服务器脚本生成、不打印；删除探针 `config.js` 和探针迁移文件；本机 `private/` 不动 |
| Build artifacts / installed packages | `/var/lib/pocketbase/pb_migrations/*_probe_schema.js`、`*_probe_user.js`（0600）；`/opt/pocketbase/pocketbase` 与 `dist/` 里的 zip（保留）；`/tmp/usj-probe-upload`（06-09 后已删除）；本机仓库里的 `tools/probe/page/` 等探针页文件 | 删除服务器上两个探针迁移文件（`07-retire-probe.sh`）；本机仓库：探针页可以删，但 `tools/probe/page/vendor/`（SDK + `SHA256SUMS`）**不能删**——`tests/support/static-server.cjs`、`playwright` 测试和 `.gitattributes` 都按这个路径引用它（见下面的“不要动”提示） |

**不要动：** SDK 文件现在放在 `tools/probe/page/vendor/pocketbase.iife.js`，`tests/support/static-server.cjs`（`SDK_DIR`、`SDK_SUMS`）、`tests/support/constants.ts`（`PB_SDK_PATH`）、`.gitattributes`（`tools/probe/page/vendor/** -text`）、隐私检查都依赖这个路径。清理探针页时只删 `index.html`、`probe.js`、`config.example.js` 等，保留 `vendor/`；或者整体搬家时同步改这四处，并重跑 `npm test`。

## Common Pitfalls

### Pitfall 1: `PB_ENCRYPTION_KEY` 丢了或没带，PocketBase 起不来
**What goes wrong:** 设置已加密存储后，没有钥匙、钥匙错、长度不是 32 字符，进程启动即退出，分别报 `invalid settings db data or missing encryption key ""`、`cipher: message authentication failed`、`crypto/aes: invalid key size N` `[VERIFIED: 本机 0.41.1]`。
**Why it happens:** 设置（含 SMTP 口令、S3 密钥）整块加密；备份 zip 里带的也是密文。
**How to avoid:** ① 钥匙文件 `/etc/usj/pocketbase.env` 由 `03-configure-pocketbase.sh` 在服务器上用 `openssl rand -hex 16`（32 个十六进制字符）生成，**不打印**；所有者在网页终端自己 `sudo cat` 一次存进密码管理器（Claude 不经手）。② **所有**调用 PocketBase 的命令（`superuser …`、迁移、`serve`、恢复演练的临时实例）都要带 `--encryptionEnv`，用 `pb-admin.sh` 封装，避免漏带。③ 先设钥匙、再让设置第一次被保存（本机实测：明文设置 + 之后带钥匙启动能正常读，但保持明文直到下一次保存；所以让 server_settings 迁移在首次启动时执行即可全部加密）。④ 恢复演练必须用同一把钥匙。
**Warning signs:** `journalctl -u pocketbase` 里启动后立刻退出；`Restart=always` 会反复重启，用 `systemctl status` 看到 `activating (auto-restart)`。

### Pitfall 2: 备份计时和时区
**What goes wrong:** 按北京时间写 cron，结果在另一个时刻跑。
**Why it happens:** PocketBase 的 cron 一律按 **UTC** 解释（本机 `cronAdd` 实测：写成当前 UTC 小时的表达式准时触发，写成本地小时的不触发）`[VERIFIED: 本机 0.41.1]`，与服务器时区无关。
**How to avoid:** `0 19 * * *`（= 北京 03:00，无夏令时）；服务器时区保持不变，不去改。看门狗用 `30 20 * * *`，与备份错开 1.5 小时。

### Pitfall 3: 启用 S3 后没有本机副本，也没有人会发现 R2 凭据失效
**What goes wrong:** 启用 S3 后，备份只写 R2（`NewBackupsFilesystem` 返回 S3 文件系统，本机只在 `pb_data` 里放临时 zip，上传后删除）`[CITED: github.com/pocketbase/pocketbase core/backup_create.go, base.go（master）]`；R2 令牌被撤销或桶被删，备份就静默失败。
**How to avoid:** 内置失败邮件（前提：SMTP 已配置且测试邮件成功）；再加看门狗；验收清单里加“第二天去 R2 看有没有新文件”。注意：手动备份（后台“创建备份”）不带 `@auto_pb_backup_` 前缀，**不会被 `cronMaxKeep` 清理**（清理只列该前缀、按修改时间保留最新 N 份）`[CITED: 同上 backup.go]`，演练产生的手动备份要手动删。

### Pitfall 4: 后台两步验证与 SMTP 的先后顺序（锁死风险）
**What goes wrong:** 先开 OTP+MFA、后配 SMTP，后台登录需要邮件验证码，但邮件发不出去，所有者被锁在门外。更隐蔽的是：SMTP 不通时 `request-otp` 仍返回 200 和 `otpId`（本机无 SMTP 实测）`[VERIFIED: 本机 0.41.1]`，界面看起来一切正常，只是邮件永远不来。
**How to avoid:** 顺序固定为：① 创建超级用户（密码）→ ② 所有者在后台“邮件设置”填发件人和 SMTP、点“发送测试邮件”并**确实收到** → ③ 才在 `_superusers` 集合的认证选项里开启 OTP 和 MFA（所有者手动操作；**不要**放进迁移文件）→ ④ 验证：退出后重新登录，走完“密码 → 邮件码”。恢复办法：所有者在网页终端运行 `pb-admin.sh superuser otp <邮箱>`，得到 id 和 8 位码（180 秒有效）`[VERIFIED: 本机 0.41.1]`，在登录页用“一次性密码”方式输入。验证脚本可只读检查 `_collections.options` 里 `_superusers` 的 `otp.enabled` 与 `mfa.enabled`（本机实测字段位置）。
**Warning signs:** 登录页提示发送了验证码但邮箱没收到。

### Pitfall 5: 代理 IP 头与 nginx 不一致 → 全站共用一个 IP 被限流
**What goes wrong:** `trustedProxy.headers` 没设或头名不对，PocketBase 看到的所有客户端都是 `127.0.0.1`，限流（`*:auth` 每 3 秒 2 次）会把三个人互相挡住，日志里的 IP 也全是回环。
**How to avoid:** nginx 每个反代位置都 `proxy_set_header X-Real-IP $remote_addr;`（nginx 覆盖客户端自带的同名头，所以不能伪造），PocketBase 设 `["X-Real-IP"]`；`8090` 只绑 `127.0.0.1` 并且防火墙不放行（Phase 6 已确认）。验证：`verify-site.mjs` 里用错误口令连续登录，第 3 次起 429（沿用 F-14 的做法），并核对日志里 `remoteIP` 不是回环（只读 sqlite 查 `auxiliary.db` 的 `_logs`，不输出 IP，只输出“是否回环”）。

### Pitfall 6: nginx `client_max_body_size 1m` 挡住大保存
**What goes wrong:** 应用文档上限 4 MiB（`journey_docs.data` 的 `maxSize: 4194304`，`pb/pb_migrations/1794096100_journey_docs.js`），Phase 6 片段里是 `1m`，大于 1 MiB 的保存被 nginx 返回 413，应用会按“保存失败”反复重试。
**How to avoid:** `/api/` 位置设 `client_max_body_size 5m;`（4 MiB 数据 + JSON 转义与字段开销）；`/api/realtime` 位置保持 `1m`（订阅请求体很小）。注意 nginx 默认 `proxy_request_buffering on`，大请求体会落到 nginx 的临时目录再转给上游，慢线路上传 4 MB 时 `client_body_timeout`（默认 60 秒，是两次读之间的间隔）通常够用。`[ASSUMED]`（nginx 行为取自经验；验收时用接近上限的合成文档在真实线路上存一次）

### Pitfall 7: 日志里带出令牌
**What goes wrong:** 后台“下载备份”的 URL 带 `?token=`（超级用户文件令牌，短时有效），默认 `combined` 日志格式会把整条 URL 写进 nginx 访问日志。
**How to avoid:** 自定义 `log_format` 用 `$uri` 而不是 `$request`/`$request_uri`（不含查询串）；日志放 `/var/log/usj/`（自己的目录、自己的 logrotate 配置，避免与包自带的 `/var/log/nginx/*.log` 通配符重复定义而让 logrotate 报错）。`[ASSUMED]`（logrotate 的重复定义行为取自经验，用 `logrotate -d` 干跑核对）。

### Pitfall 8: Service Worker 把后台页面或旧外壳卡住
**What goes wrong:** ① `/_/` 被 worker 当导航接管，后台打不开；② 把 `sw.js` 或 HTML 长缓存，更新永远发不出去；③ 版本号不随外壳变化，新版本被认为“没有更新”。
**How to avoid:** worker 只对 `/` 和 `/index.html` 的导航和 `SHELL` 里的路径调用 `respondWith`；nginx 对 `/sw.js`、`/`（HTML）、`/manifest.webmanifest` 发 `Cache-Control: no-cache`；版本号 = 页面 + SDK + 清单 + 图标合并后的 sha256 前 12 位，由构建脚本写入。验证：构建两次、外壳不变则 `sw.js` 逐字节相同；改一个字节则不同。

### Pitfall 9: iOS Safari 的 7 天缓存清理
**What goes wrong:** 在 Safari 里直接用（没加到主屏幕）的网站，7 天没交互，浏览器会清掉所有脚本可写存储：IndexedDB、localStorage、Service Worker 注册与缓存；**主屏幕网页应用豁免** `[CITED: webkit.org/tracking-prevention/]`。待上传的修改就存在 localStorage 里（Phase 10），这意味着 iPhone 用户若不装到主屏幕、又离线好几天，修改有可能丢。
**How to avoid:** 验收清单和部署说明里写明：iPhone 请添加到主屏幕使用；离线时间长时尽快联网上传。

### Pitfall 10: 恢复演练的临时实例会带着真实设置“活过来”
**What goes wrong:** 恢复出来的数据库里有备份 cron 和 S3 设置，临时实例如果跑过 19:00 UTC 就会往真实的 R2 桶里再写一份备份（并执行清理）。
**How to avoid:** 临时实例用 `systemd-run --property=RuntimeMaxSec=900`（15 分钟自动结束）、避开 18:50–19:10 UTC 这个时间窗、演练结束后立即 `systemctl stop`、删数据目录；演练用的手动备份在后台删除（顺便证明 R2 的删除权限，见 Open Question 2）。

### Pitfall 11: 修改页面后忘了同步测试基线与白名单
**What goes wrong:** 页面加了 `<link rel="manifest">`、图标、`robots` meta、SW 注册后，`APP_SHA256`（`tests/support/constants.ts:38`）对不上，SAFE-02 失败；同时浏览器会请求 `/manifest.webmanifest`、`/icons/…`、`/sw.js`，而护栏的白名单只有 `V1_APP_PATHS = ['/', '/us-journey-tracker.html']`（`tests/support/test.ts:58`）和 `CLOUD_APP_PATHS = ['/', '/us-journey-tracker.html', PB_SDK_PATH]`（`tests/support/test.ts:61`），静态服务器也只放行页面和 SDK 两个文件（`tests/support/static-server.cjs`：`pathname === '/' || pathname === '/us-journey-tracker.html'`、`SDK_PATH = '/vendor/pocketbase.iife.js'`）→ 记为违规，所有用例失败。
**How to avoid:** 同一次提交里：更新 `APP_SHA256`；两档白名单加上清单、图标路径（`sw.js` 只加进 cloud 档）；静态服务器的白名单加这些文件（`sw.js` 来自 `deploy/site/sw.js`，把占位版本号换成固定值 `test`）。`tools/plan/extract-plan.mjs` 按标记从页面里取“纯函数段”，改页面时不要动那两个标记。

### Pitfall 12: `style="width:…%"` 在严格 CSP 下静默失效
**What goes wrong:** 进度条宽度被 CSP 拦掉，条变成 100% 宽（实测 `innerHTML` 带出的 style 属性违规指令是 `style-src-attr`，`width` 保持默认），功能看起来“坏了”但控制台只有一条 CSP 报告。
**How to avoid:** 把 `renderGoals` 里 4 处（约 2122、2130、2153、2159 行）改为 `<i data-w="${pct}"></i>`，在 `renderGoals` 最后一次 `innerHTML` 赋值之后统一 `querySelectorAll('i[data-w]').forEach(i => { i.style.width = i.getAttribute('data-w') + '%'; })`（`archivedHTML()` 的输出也在 `renderGoals` 的模板里，一次扫描即覆盖）。`el.style.width = …` 不受 `style-src-attr` 限制，`setAttribute('style', …)` 和 `style.cssText` 才受限（`[CITED: developer.mozilla.org style-src-attr]`；本机 Edge 实测 `style.width` 生效）。CSS 里 `.bar i{transition:width .3s}` 保留，行为只在首次渲染的一帧内与现在不同（同一任务内完成，不产生可见闪烁）。测试里没有任何用例断言条宽（grep 过）。

## Code Examples

### 1. systemd unit 改动（相对 `tools/probe/server/pocketbase.service`）

```ini
# deploy/server/pocketbase.service（只列改动行；其余沙箱项沿用）
[Unit]
Description=PocketBase
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/usj/pocketbase.env          # 内容：PB_ENCRYPTION_KEY=…、USJ_ORIGIN=…（服务器上生成，不在仓库）
Environment=GOMEMLIMIT=256MiB
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090 \
  --dir=/var/lib/pocketbase/pb_data --migrationsDir=/var/lib/pocketbase/pb_migrations \
  --hooksDir=/var/lib/pocketbase/pb_hooks --hooksWatch=false --hooksPool=3 \
  --publicDir=/var/lib/pocketbase/pb_public --indexFallback=false \
  --encryptionEnv=PB_ENCRYPTION_KEY --origins=${USJ_ORIGIN}
```
- `${USJ_ORIGIN}`（带花括号）展开成恰好一个参数，来自 `EnvironmentFile`；这样仓库里的 unit 没有域名 `[CITED: freedesktop.org systemd.service]`。隐私检查器的规则 G 拦的是 `Environment=` 加密钥名加裸值的写法（`tools/privacy/privacy-check.mjs:168` 的 `SECRET_ENV_RE`），`EnvironmentFile=` 这一行不会被命中；模板里要写密钥名时用 `$VAR` 或 `<占位>` 形式（`isPlaceholder` 放行以 `$` 开头和 `<…>` 的值；注意 IN-10 指出 `$` 开头的放行口子偏宽，所以模板里不要出现真实的 `$2a$…` 之类）。
- `--origins` 本机实测：默认 `[*]`（`serve --help` 输出 `CORS allowed domain origins list (default [*])`），响应头 `access-control-allow-origin: *`；设为 `https://app.example` 后，来自该源的请求得到同值，来自 `https://evil.example` 的请求没有该头（预检同样）`[VERIFIED: 本机 0.41.1]`。应用是同源（`new PocketBase(location.origin)`），收紧不影响功能。
- `--hooksPool=3`：默认预热 15 个 goja 运行时（`serve --help` 输出 `--hooksPool int … (default 15)`），服务器只有约 894 MB 内存（06-PROBE-RESULTS），本阶段只有一个 cron 钩子，调小可省内存 `[ASSUMED: 具体节省量未测，部署后看 RSS]`。
- `/var/lib/pocketbase/pb_hooks` 要由 `03` 脚本创建（pocketbase 0750）；备份和恢复在 `pb_data` 内部建临时文件（`.pb_temp_to_delete`），`ReadWritePaths=/var/lib/pocketbase` 已覆盖。
- 超级用户命令行必须带钥匙：`deploy/server/pb-admin.sh` 装到 `/usr/local/sbin`，内容是读 `/etc/usj/pocketbase.env`（权限设 `root:pocketbase 0640`，让 `sudo -u pocketbase` 能读）、再 `exec /opt/pocketbase/pocketbase --dir=… --migrationsDir=… --hooksDir=… --encryptionEnv=PB_ENCRYPTION_KEY "$@"`。所有者用 `sudo -u pocketbase /usr/local/sbin/pb-admin.sh superuser upsert "$EM" "$PW"`（邮箱和口令由 `read -r`/`read -rs` 读入，以 `$` 变量传参，符合规则 G 的占位写法）。README 里如实写明：口令会在命令执行的瞬间出现在进程参数里（IN-06）。

### 2. 备份看门狗钩子（D-06 的第二半：连续两天没有新备份）

```js
// deploy/pb_hooks/backup-watch.pb.js
// 已在本机 0.41.1 验证存在且可用的接口：cronAdd、$app.newBackupsFilesystem()、fsys.list(prefix)
// （元素有 key、size、modTime.unix()）、fsys.close()、new MailerMessage、$app.newMailClient().send。
// 注意 JSVM 里 context 全局不存在（所以不能在钩子里自己调 $app.createBackup），处理函数外的变量在处理函数内不可见，
// 所以一切写在 cronAdd 的回调里 [VERIFIED: 本机 0.41.1；CITED: pocketbase.io/docs/js-overview/]
cronAdd("usj-backup-watch", "30 20 * * *", () => {          // 每天 20:30 UTC，备份在 19:00 UTC
  const STALE_H = 40                                          // 昨天没备份是 ~25h，连续两天没备份是 ~49h
  let newest = 0, problem = ""
  try {
    const fsys = $app.newBackupsFilesystem()
    try { for (const f of fsys.list("@auto_pb_backup_")) newest = Math.max(newest, f.modTime.unix()) }
    finally { fsys.close() }
    const ageH = (Date.now() / 1000 - newest) / 3600
    if (newest === 0) problem = "备份列表里没有任何自动备份"
    else if (ageH > STALE_H) problem = "最近一份自动备份已是 " + Math.round(ageH) + " 小时前"
  } catch (e) { problem = "无法读取备份列表：" + e }
  if (!problem) return
  try {
    const to = $app.findAllRecords("_superusers").map((r) => ({ address: r.email() }))  // [ASSUMED: 接口名，首次本机演练核对]
    const s = $app.settings().meta
    $app.newMailClient().send(new MailerMessage({
      from: { address: s.senderAddress, name: s.senderName }, to,
      subject: "计划手记：备份异常", text: problem,
    }))
  } catch (e) { $app.logger().error("backup-watch: 发邮件失败", "error", String(e)) }
})
```
- 收件人在运行时从 `_superusers` 取，仓库里没有邮箱；发件人用所有者在后台填的 `meta.senderAddress`。
- 看门狗只覆盖“PocketBase 在运行、但备份没做成”；**PocketBase 或整台服务器不在了，这个钩子也不在了**，没有外部心跳（超出 D-06）。验收清单里的“第二天去 R2 看有没有新文件”是人工兜底。
- 本机演练办法：用 `tools/pb/bin/pocketbase.exe` 在临时目录跑，把 cron 改成 `* * * * *`、把 `STALE_H` 改成 0，确认触发路径（SMTP 未配置时 `send` 会抛错，被 try/catch 记进日志，不会让进程崩）。

### 3. nginx 位置块骨架（`deploy/server/nginx/usj-app.conf`，由 `05-nginx-app.sh` 在锚点之后 include）

```nginx
# 在 443 server 层生效的指令（片段在 server 块内被 include）
log_format usj '$remote_addr [$time_local] "$request_method $uri" $status $body_bytes_sent "$http_user_agent"';
access_log /var/log/usj/access.log usj;       # D-03；$uri 不含查询串，避免 ?token= 进日志
server_tokens off;

location = / {
    root /var/www/usj/site; try_files /index.html =404;
    include snippets/usj-headers-common.conf;       # nosniff、Referrer-Policy、Permissions-Policy、X-Robots-Tag、HSTS、COOP
    include snippets/usj-csp.conf;                  # 构建脚本生成：add_header Content-Security-Policy "…" always;
    add_header Cache-Control "no-cache" always;
    gzip on; gzip_vary on;
}
location = /sw.js {
    root /var/www/usj/site;
    include snippets/usj-headers-common.conf;
    add_header Content-Security-Policy "default-src 'none'; connect-src 'self'" always;
    add_header Cache-Control "no-cache" always;
}
location = /manifest.webmanifest {
    root /var/www/usj/site;
    types { application/manifest+json webmanifest; }     # [ASSUMED] 默认 mime.types 是否已含，显式写最稳
    include snippets/usj-headers-common.conf; add_header Cache-Control "no-cache" always;
}
location ^~ /vendor/ { root /var/www/usj/site; include snippets/usj-headers-common.conf; add_header Cache-Control "no-cache" always; }
location ^~ /icons/  { root /var/www/usj/site; include snippets/usj-headers-common.conf; add_header Cache-Control "public, max-age=3600" always; }

location = /api/realtime {        # 沿用 Phase 6 验证过的参数
    proxy_pass http://127.0.0.1:8090; proxy_http_version 1.1; proxy_set_header Connection "";
    proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off; proxy_cache off; gzip off;
    proxy_read_timeout 3600s; proxy_send_timeout 3600s; client_max_body_size 1m;
    add_header X-Robots-Tag "noindex, nofollow" always;
}
location ^~ /api/ {
    # …同上反代头…
    proxy_read_timeout 60s; client_max_body_size 5m;   # 4 MiB 文档 + 开销
    gzip on; gzip_types application/json;
    add_header X-Robots-Tag "noindex, nofollow" always;
}
location ^~ /_/ {                # PocketBase 后台：自带 CSP、nosniff、X-Frame-Options，nginx 不覆盖
    # …同上反代头…
    proxy_read_timeout 60s;
    add_header X-Robots-Tag "noindex, nofollow" always;
}
location ^~ / { return 404; }    # 兜底，防止露出默认站点的内容；与 certbot 块里的 `location /` 是不同写法，不会报重复
```
- 静态文件放 `/var/www/usj/site`（root 所有，0755），由 `06-install-site.sh` 用“写到新目录再 `mv` 切换”的方式原子替换。
- HSTS（放在 `usj-headers-common.conf`）：先用 `Strict-Transport-Security: max-age=86400`（一天）验收，通过并见过一次真实续期后再提高（如 15552000）；不加 `includeSubDomains`、`preload`，因为子域名情况未知。数值是判断而非文档规定 `[ASSUMED]`。certbot 的 server 块里如果已有 server 层的 `add_header`（例如 certbot `--hsts` 加的），位置块里的 `add_header` 会让它不再继承，所以通用头文件里要自带 HSTS；`00-status.sh` 只读检查一下现有块里有没有 `add_header`。
- Phase 6 片段的所有位置都写了 `access_log off`（D-09 时代的决定）；应用片段**不再**写，由 server 层的 `access_log` 统一记（D-03 已改为记 IP）。nginx 错误日志也会记客户端 IP，包默认保留 14 天，D-03 只要求访问日志 30 天，README 如实写明。
- 页面压缩：246 KB 的页面开 gzip 后约几十 KB，对电信/联通 300–400 ms 的往返很重要；`gzip_types` 要补 `text/javascript application/javascript application/manifest+json image/svg+xml`（nginx 的 `text/html` 默认就压）。不给 certbot 管的 `listen 443` 行加 `http2`（沿用 Phase 6 的不动 certbot 行原则）。

### 4. logrotate（`deploy/server/logrotate/usj-nginx`）

```
/var/log/usj/*.log {
    daily
    rotate 30
    missingok
    notifempty
    compress
    delaycompress
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -s /run/nginx.pid ] && kill -USR1 "$(cat /run/nginx.pid)"
    endscript
}
```
`[ASSUMED]`：写法取自 Debian/Ubuntu nginx 包的惯例；`/var/log/usj` 目录要由 `05` 脚本建好并让 nginx 能写。第一次执行用 `logrotate -d /etc/logrotate.d/usj-nginx`（只读干跑）核对，再 `logrotate -f` 强制一次看 nginx 能重新打开日志。

### 5. 恢复演练（`deploy/server/restore-drill.sh` 的步骤，所有者在阿里云网页终端运行）

```
前提：已经按验收前的流程让 R2 里有一份只含测试账号的备份（后台手动“创建备份”或等到自动备份）
1. 脚本自检：当前不在 18:50–19:10 UTC；/var/lib/pocketbase-drill 不存在
2. 建 /var/lib/pocketbase-drill/{pb_data,pb_migrations,pb_hooks}（pocketbase 所有，0700）
3. 用 pb-admin.sh 的同一把钥匙，在临时目录建一个随机口令的临时超级用户（口令只在脚本变量里，不打印）
4. systemd-run --unit=usj-drill --property=User=pocketbase --property=EnvironmentFile=/etc/usj/pocketbase.env
   --property=RuntimeMaxSec=900 … /opt/pocketbase/pocketbase serve --http=127.0.0.1:8091 --dir=… --encryptionEnv=PB_ENCRYPTION_KEY
5. 脚本提示所有者现场输入 R2 的端点、桶名、访问密钥和密钥（read -r / read -rs，不写文件，不进命令行参数）
   → 用 python3 拼 JSON，经标准输入交给 curl -K - 或 --data @-，PATCH /api/settings 在临时实例上启用 S3
6. GET /api/backups（此时列出的是 R2 里的备份）→ 选名字最新的 @auto_pb_backup_*.zip → POST /api/backups/<URL 编码的 key>/restore
   （官方恢复路径；key 里的 @ 要编码成 %40）；实例会自己重启，等 /api/health 恢复
7. 只读核对（python3 sqlite3 以 mode=ro 打开临时 data.db）：PRAGMA integrity_check = ok；users、journey_docs 行数与演练前记录的数一致；
   每个测试账号的 state 与 plan 两份文档都在（owner+kind 唯一）；用 length(data) 做粗校验
8. systemctl stop usj-drill；删除 /var/lib/pocketbase-drill；输出 PASS/FAIL 摘要（不含任何账号、域名、IP）
```
- 为什么走 PocketBase 自己的恢复接口：这是官方的“从 S3 恢复”路径，会真的从 R2 读 zip、解压、替换 `data.db`/`auxiliary.db`、重启；源码要求 `data.db` 存在，Unix 上可用，Windows 不支持 `[CITED: github.com/pocketbase/pocketbase core/backup_restore.go（master）]`。接口列表、创建/删除/恢复/下载端点 `[CITED: pocketbase.io/docs/api-backups/]`。
- 备选（不用 S3 凭据）：所有者在后台“备份”页下载演练用的测试备份到自己电脑，上传到服务器再 `python3 -I -m zipfile -e` 解压到临时目录——这违背 D-05 的“不下载到所有者的电脑”，只在 R2 取包失败时作为排障手段。
- 恢复后的临时库里 `_superusers` 已开启 MFA（若演练时已开启），REST 登录需要 OTP；所以核对用只读 SQLite 而不是 REST，必要时用 `pb-admin.sh superuser otp`（本机实测可用）。
- 备份 zip 的内容（本机实测，空集合库）：`data.db`、`auxiliary.db`、`types.d.ts`；有上传文件时才有 `storage/`（本应用没有文件字段）`[VERIFIED: 本机 0.41.1]`。

### 6. 站点验证脚本（`deploy/verify-site.mjs`，由 `tools/probe/verify-site.mjs` 改造）

沿用它的骨架（`--stage`、`PASS/FAIL` 行、`redact.mjs` 过滤、`process.exitCode`——IN-04）；检查项换成应用站点：
- `/` 200，带 CSP、nosniff、Referrer-Policy、Permissions-Policy、HSTS、`X-Robots-Tag`；**CSP 里的哈希与页面里每个内联脚本/样式的哈希一一对应**（这一项把“CSP 与页面不匹配”变成部署时的失败，而不是用户看到空白页）；
- `/sw.js` 带 `Cache-Control: no-cache`；`/manifest.webmanifest` 的 `Content-Type` 是 `application/manifest+json`；图标 200；
- `/vendor/pocketbase.iife.js` 的 sha256 等于 `SHA256SUMS`（沿用 F-02）；
- `/probe/` 与 `/probe/config.js` 都是 404（D-10）；`/api/health` 200；`/_/` 200 且带 PocketBase 自己的 CSP；
- 匿名注册被拒；SSE 首个 `PB_CONNECT`（沿用 F-13，但按 IN-05 只接受含 runId 的事件）；错误口令登录第 3 次起 429；`8090` 外网不通；
- WR-02 的教训：查“读写删被拒”要用**真实存在的记录 id**，只对不存在的 id 发请求区分不出规则是否真的锁了。应用站点上没有探针账号，这一组可以用“隔离重跑”（SC3）取代，verify-site 只做匿名侧检查。

### 7. 图标生成（本机已验证）

用 `page.setContent` 渲染 `html,body{background:#1B2740}` 里放一个 `<span>记</span>`（衬线字体栈 `"Noto Serif SC","Songti SC","STSong","Microsoft YaHei",serif`，字重 800，白色），`page.screenshot({ clip })` 输出：`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（字号占比缩小到约 0.5，保证落在中心 80% 圆内）、`apple-touch-icon-180.png`。本机实测四个文件都是 RGB（PNG 颜色类型 2，无透明通道），大小 3–12 KB，字形渲染正常（用本机 Edge 渲染并查看过 192 px 那张）。背景色 `#1B2740` 是页面里的 `--ink`（`us-journey-tracker.html` 第 8–9 行 `:root` 变量块）。maskable 与 any 分成两个独立图标条目，不要写成 `"any maskable"` 一个条目 `[CITED: web.dev/articles/maskable-icon]`。

### 8. 清单（`deploy/site/manifest.webmanifest`）

```json
{
  "name": "计划手记", "short_name": "计划手记", "lang": "zh-CN",
  "id": "/", "start_url": "/", "scope": "/", "display": "standalone",
  "background_color": "#F2F5F9", "theme_color": "#1B2740",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
Chromium 系可安装的必需项是 `name`/`short_name`、192 和 512 的图标、`start_url`、`display`；Service Worker **不是**安装的硬要求 `[CITED: developer.mozilla.org Making_PWAs_installable]`。iOS 另需页面里 `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`（MDN 那页没讲 apple-touch-icon，这条来自经验 `[ASSUMED]`，真机验收确认）；`beforeinstallprompt` 在 iOS 不可用，只能“分享 → 添加到主屏幕”；iOS 16.4+ 的 Chrome、Edge、Firefox 也能装 `[CITED: 同上]`。页面 `<head>` 需新增：`<link rel="manifest">`、`<link rel="icon" href="/icons/icon-192.png">`（避免浏览器去探 `/favicon.ico`）、`<link rel="apple-touch-icon">`、`<meta name="theme-color">`、`<meta name="robots" content="noindex,nofollow">`。注意：**当前页面里没有 `noindex`**（grep 页面 `noindex|robots` 无命中），CONTEXT 里“页面继续带 noindex”要在这次补上，同时 nginx 发 `X-Robots-Tag`。

## 测试策略（回答调研问题 5；`workflow.nyquist_validation` 为 false，所以这里不按 Nyquist 模板写）

### 框架与约束
| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.64.1，本机 Edge（`channel: 'msedge'`），死代理 + `--host-resolver-rules` |
| Config files | `playwright.config.ts`（默认 `npm test`，`serviceWorkers: 'block'`，workers 2）、`playwright.cloud.config.ts`（`test:cloud`，workers 1） |
| 约束 | 低优先级（BELOW_NORMAL）、单 worker、不装任何东西、不下载浏览器；全量只在阶段收尾跑一次 |
| 全量命令 | `npm test` 与 `npm run test:cloud`（`package.json` 的脚本） |

### 新增用例与怎么写
| 目标 | 用例 | 做法（均已在本机原型验证） |
|------|------|------|
| OPS-04 断网冷启动、断网刷新 | `tests/cloud/sw-offline.spec.ts` | `test.use({ serviceWorkers: 'allow' })` 只放开这个文件（第一台设备用默认 `context` fixture，所以有效；`tests/support/devices.ts:40` 写死的 `'block'` 只影响第二台设备）。流程：打开云端页 → `await navigator.serviceWorker.ready` → `context.setOffline(true)` → `page.reload()` 断言页面标题与外壳在 → `context.newPage()` 再 `goto('/')` 断言冷启动成功 → 断言 `/api` 请求不被缓存（离线时失败）。**注意**：`context.route` 的假服务器会在“离线”时照样应答 `/api`（路由直接 fulfill，不走网络），所以要同时用 `app.fake.fault({ …, mode: 'refuse' })` 制造“服务器连不上”，断网只用来证明外壳来自缓存。本机原型里这条路径（Edge + 死代理 + 放行型 `context.route`）：断网刷新读到 `shell v1`、新标签页冷启动成功、`/api` 离线时 `fetch` 失败 |
| 更新提示 | 同文件 | 原型：`reg.update()` 后出现 `reg.waiting`、页面仍是旧版；`postMessage({type:'SKIP_WAITING'})` → `controllerchange` → 重载后是新版。**限制**：Playwright 文档写明“更新用的 sw.js 主脚本请求目前不能被 `route` 拦截”（issue 14711），所以 v2 的 `sw.js` 必须由静态服务器自己提供。做法：静态服务器加一个仅测试用的 GET `/__test/sw-version/<v>` 控制路径改变内存里的版本号，用例用 `request` fixture（APIRequestContext，不经过页面护栏）调用 |
| SEC-02 CSP | `tests/cloud/csp.spec.ts` | 用 `context.route` 把 `/` 的响应改成“`buildSite()` 产出的发布版页面 + 同一函数算出的 CSP 头”（`route.fetch()` 后 `route.fulfill({ response, headers: {…, 'content-security-policy': csp} })`）；初始化脚本里监听 `securitypolicyviolation` 并收集；Chrome 同时会把违规写成 console.error，现有护栏（`guard`）会把它们当失败，所以**零违规**可以直接作为断言；用例走四个视图、登录、编辑计划、导出下载（Blob）、导入选文件；再用一条反向用例（去掉某个哈希）证明检测不是空转 |
| SEC-02 / SC3 隔离重跑 | `npm run pb:isolation`（已有，`tools/pb/isolation-check.mjs`） | 用 `tools/pb/lib/instance.mjs` 的本机一次性实例（同为 0.41.1、同一组应用迁移 `pb/pb_migrations`）重跑，期望 `ISOLATION OK 48/48`（`tests/mocks/PB-CONTRACT.md` §8 所写）；脚本头注释写着 Phase 13 复用，但它的 `withInstance` 只起本机 Windows 程序，服务器上没有 Node，所以“一次性实例”= 本机同版本同迁移。若所有者要求在服务器同一二进制上重跑，可选做法是服务器起一个一次性实例，经 SSH 本地转发把端口接到本机再跑——`isolation-check.mjs` 目前不支持指定外部地址，要改脚本；**建议只做本机重跑**，并把“服务器上同一二进制、同一迁移、一次性空库启动成功且 `rules` 与 `pb/rules.expected.json` 一致”作为部署验证的一项只读检查 |
| 站点验证 | `deploy/verify-site.mjs` 的 `--self-test` | 合成输入自检，随 `npm test` 之外单独运行（沿用 `tools/probe/verify-site.mjs --self-test` 的做法） |
| 构建脚本 | `deploy/build-site.mjs --self-test` | 同一输入两次输出逐字节相同；改一个内联字符哈希变化；CRLF 输入哈希不变 |

### 必须改的测试设施
- `tests/support/test.ts`：`V1_APP_PATHS`、`CLOUD_APP_PATHS` 增加清单和图标路径；`/sw.js` 只进 cloud 档。
- `tests/support/static-server.cjs`：白名单增加这些文件；`sw.js` 来自 `deploy/site/sw.js`（占位替换为 `test`）；如上加测试用版本控制路径。
- `tests/support/constants.ts`：`APP_SHA256` 随页面更新（同一次提交）。
- 现有 `AppHarness`/`openDevice` 的 `serviceWorkers: 'block'` 保持不动。

### 采样与阶段门
- 每个任务提交后：与改动相关的单个 spec；`node deploy/build-site.mjs --self-test`。
- 每个波次合并后：`npm test`（v1，约 154 条）或相关子集。
- 阶段门：`npm test` 与 `npm run test:cloud` 全量、`npm run pb:isolation`、`node tools/privacy/privacy-check.mjs --staged`。

### Wave 0 缺口
- [ ] `deploy/build-site.mjs`（含 `--self-test`）——CSP/SW 用例依赖它导出的 `buildSite()`
- [ ] 页面改动（manifest 链接、图标、robots、SW 注册、更新横幅、`data-w` 条宽）+ `APP_SHA256` + 两档白名单 + 静态服务器
- [ ] `deploy/site/sw.js`、`manifest.webmanifest`、4 个 PNG
- 框架本身无需安装

## Security Domain

`security_enforcement` 未设为 false，本节必选。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | 超级用户强密码 + 邮件 OTP + MFA（本机实测流程）；普通账号维持 Phase 8 的邮箱加密码；限流 `_superusers:auth` 与 `*:auth` |
| V3 Session Management | yes | PocketBase 令牌（普通账号 90 天，Phase 8；超级用户默认 86400 秒 `[VERIFIED: 本机 _collections.options]`）；Service Worker 不缓存任何 `/api` 响应，令牌不会进缓存 |
| V4 Access Control | yes | Phase 8 的集合规则（本阶段只在一次性实例上重跑隔离脚本）；`/_/` 公网开放由 D-01 接受，用 MFA 补强；可选 `superuser ips` 白名单 `[CITED: pocketbase.io/docs/going-to-production/，v0.38.0+]`，因所有者在中美两地使用，不推荐作为默认 |
| V5 Input Validation | yes | 既有 `esc()` 与导入检查（Phase 7）；CSP 作为纵深防御 |
| V6 Cryptography | yes | HTTPS（certbot）；设置加密用 PocketBase 的 `--encryptionEnv`，不自写；SRI 校验 SDK |
| V13/V14 配置与部署 | yes | 响应头、`noindex`、日志留存与脱敏、非 root 运行、sha256 批准清单 |

### Known Threat Patterns for 这个栈

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 内联脚本注入（XSS） | Tampering / Elevation | `script-src` 只放哈希和 `'self'`，无 `unsafe-inline`；`style-src-attr 'none'`；`base-uri 'none'`、`object-src 'none'` |
| 点击劫持 | Spoofing | `frame-ancestors 'none'`（响应头里）+ 兼容的 `X-Frame-Options: DENY` |
| 后台口令爆破 | Spoofing | 强口令 + OTP/MFA + `_superusers:auth` 限流（本机实测 3 次后 429，部署取 60 秒 5 次）；每次新位置登录 PocketBase 还会发“新位置登录”邮件（`_superusers` 默认 `authAlert.enabled` 为 true，本机查库确认）`[VERIFIED: 本机 0.41.1]` |
| 限流被绕过或误伤 | DoS | `trustedProxy.headers=["X-Real-IP"]` 与 nginx 同名头一致；`8090` 只绑回环 |
| 备份被窃或丢失 | Information Disclosure / DoS | R2 令牌最小权限（Object Read & Write，限定单个桶）`[CITED: developers.cloudflare.com/r2/api/tokens/]`；PocketBase 设置加密；`cronMaxKeep`；R2 生命周期规则（建议 35 天）作为双保险 `[CITED: developers.cloudflare.com/r2/buckets/object-lifecycles/]`（对象通常在到期后 24 小时内删除） |
| 密钥进仓库或日志 | Information Disclosure | 钥匙文件只在服务器上生成、不打印；隐私检查规则 G（`Environment=` 裸值、`superuser … 口令`）；脚本从不 `set -x`；nginx 日志用 `$uri` |
| 恶意或损坏的 Service Worker 缓存 | Tampering | 只缓存同源外壳；外壳哈希版本化；SRI 对缓存里的 SDK 仍然生效；`sw.js` 自带最小 CSP |
| 钥匙或邮箱授权码泄露 | Information Disclosure | README 写明服务器出事时要更换：邮箱授权码、R2 令牌、`PB_ENCRYPTION_KEY`（更换钥匙需要先用旧钥匙启动并重新保存设置，计划里写成独立的轮换步骤，先在一次性实例上演练）`[ASSUMED]` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 研究文件里的 Caddy、腾讯云方案 | nginx + certbot、阿里云香港 | Phase 6 D-02 | `STACK.md`、`PITFALLS.md` 里 Caddy/腾讯云段落作废 |
| 内联脚本用 `'unsafe-inline'` | 哈希 + 严格 `style-src-attr` | 本阶段 | 单文件应用也能零 `unsafe-inline` |
| 手工 cron 备份脚本 | PocketBase 内置自动备份 + S3 + 失败告警 | 0.2x 起内置；失败邮件在 0.41.1 中实测存在 | 少一套密钥文件和脚本 |
| 每次打开自动换新 | 提示后点击更新（D-08） | 所有者决定 | 需要 `reg.waiting` + `SKIP_WAITING` 流程 |
| 探针站点公开后台、不记 IP | 公开后台 + MFA，记 IP 30 天 | D-01、D-03 | 与 Phase 6 的 `access_log off`、`logIP=false` 相反，模板要明确改过来 |

**Deprecated/outdated:**
- Phase 6 `usj-probe-locations.conf` 里每个位置的 `access_log off` 与 `client_max_body_size 1m`：不适用于应用站点。
- `04-start-pocketbase.sh` 的“失败只 stop 不 disable”（WR-08）：改成 `disable --now`。

## deploy/ 模板：Phase 6 缺陷的具体修法（D-11）

| 编号 | 问题（只在重跑时暴露） | 模板里的修法 |
|------|------------------------|--------------|
| WR-07 | `01-swap.sh` 在 swap 已启用时直接 `already` 退出，不补写 fstab | 把“确保 fstab 有这一行”放在 `already` 分支之前；重启验证里检查 `swapon --show` 与 fstab 都有 |
| WR-08 | `04` 失败路径只 `stop` 不 `disable`；重跑时 `enable --now` 不会重启已运行服务，新 unit 不生效 | 失败路径 `systemctl disable --now pocketbase`；安装 unit 后先比较新旧文件的哈希，不同则 `restart`；还要检查 `pb_hooks`、`EnvironmentFile` 在启动前存在 |
| WR-09 | `05` 没有 ERR trap，站点文件被覆盖到一半会留下残局；`$TMP` 不清理 | 备份之后 `trap rollback ERR`，成功路径末尾 `trap - ERR`；用同目录临时文件 + `mv` 原子替换站点文件；`trap 'rm -f "$TMP"' EXIT` |
| IN-06 | README 的超级用户命令把口令放进进程参数，文档没说 | README 如实写（见 Code Examples §1）；用 `pb-admin.sh` 封装 |
| IN-07 | `/probe` 不带斜杠 404；错误日志仍记 IP | 探针页已删，第一点作废；README 隐私一节补写 nginx 错误日志记 IP、默认保留约 14 天 |
| IN-09 | 上传目录是固定的 `/tmp/usj-probe-upload`，核对哈希到 sudo 使用之间有窗口 | 上传到 `install -d -m 0700` 建立的目录（用 `mktemp -d`，路径由调用方经参数传给脚本），脚本入口再用 `sha256sum -c`（同时接受 `  ` 与 ` *` 分隔符，`06-08-SUMMARY.md` 的惯例）核对一遍再使用 |
| IN-11 | `02` 头注释说 `--version` 检查在改动系统之前，实际在之后 | 改注释；或在 `install` 到 `/opt/pocketbase/pocketbase` 之前先对解压出的文件用普通用户权限跑一次 `--version`。D-11 保留已装的二进制，所以重装路径主要走“已是 0.41.1 → already” |

另外：批准清单流程沿用 `06-08-SUMMARY.md`（本机 `sha256sum -c` → 只打包清单里的文件 → 服务器 `sha256sum -c` 加文件数比对 → 每个脚本进入时核对自己那一行再执行 → 删除上传目录）；私有参数放 `private/server.env`（已有 `USJ_DOMAIN`、`USJ_IP`），脚本需要的非密值（如 `USJ_ORIGIN`）由部署时在服务器上写入 `/etc/usj/pocketbase.env`，不进仓库。构建产物写到被忽略的 `private/deploy-out/`（`.gitignore` 里 `private/`），其中的 `index.html` 因为是仓库页面加两处插入，与仓库文件不同，但**不含**域名（`USJ_CONFIG` 只有 `backend: 'pocketbase'`），所以只要不提交就行。

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | R2 的“Object Read & Write”令牌包含 `DeleteObject`，所以 `cronMaxKeep` 清理能成功 | 标准栈、Open Question 2 | 超过 30 份后清理失败，R2 里备份越积越多；演练里“在后台删除手动备份”就是验证，另加 R2 生命周期规则 35 天兜底 |
| A2 | R2 接受 PocketBase 的 `forcePathStyle: true`（路径式，本机日志实测 PocketBase 在该开关下发 `PUT http://…/<bucket>/<key>`） | §1a | 第一次测试备份失败，改成关闭该开关再试；R2 官方文档对两种寻址写法没有明确表态 |
| A3 | Aliyun 轻量服务器香港能从 465/587 端口外连所有者邮箱的 SMTP（25 端口通常被限制） | Pitfall 4、Open Question 1 | 验证码和失败邮件发不出去；因此“发送测试邮件”必须在开 MFA 之前通过 |
| A4 | logrotate 的写法与重复定义行为（自有目录 `/var/log/usj`、`rotate 30`、`kill -USR1`） | Code Examples §4 | 轮转失败或重复；用 `logrotate -d` 干跑和一次 `-f` 验证 |
| A5 | nginx 默认 `mime.types` 是否包含 `webmanifest` | Code Examples §3 | 清单的 `Content-Type` 不对，部分浏览器不认；显式 `types {}` 已规避，verify-site 检查 Content-Type |
| A6 | `$app.findAllRecords("_superusers")` 在钩子里可用 | Code Examples §2 | 看门狗发不出邮件；本机演练核对，退路是用 `$app.findAuthRecordByEmail` 或把收件人写进 `EnvironmentFile`（不进仓库） |
| A7 | `--hooksPool=3` 能明显省内存 | unit | 只是优化，不影响正确性；部署后看 RSS 决定 |
| A8 | HSTS 起步 `max-age=86400`，验收后提高 | nginx | 取值是判断；若一开始就设很长而证书续期出问题，用户会被锁在外面一段时间 |
| A9 | iOS 的 `apple-touch-icon` 写法与 180×180 尺寸要求；微信内置浏览器对 Service Worker 的支持不确定 | §8、验收清单 | 主屏图标不对；验收清单要求在系统浏览器（Safari/Edge/Chrome）里测，微信内置浏览器单列为“不保证” |
| A10 | `PB_ENCRYPTION_KEY` 轮换需要旧钥匙启动并重新保存设置 | Security | 轮换步骤写错会让进程起不来；轮换在一次性实例上先演练（本机可做）再写进 README |
| A11 | 大请求体的 nginx 行为（`proxy_request_buffering`、`client_body_timeout`）够用 | Pitfall 6 | 慢线路上 4 MiB 保存超时；验收用接近上限的合成文档在真实线路上测一次 |
| A12 | 清空 `pb_data` 是最干净的探针清理方式（而不是“前滚迁移删集合”） | Runtime State Inventory | 若所有者想保留 Phase 6 建的超级用户，就要走“前滚”路线，并需要 `pb-admin.sh` 之外的清理；需所有者确认 |

## Open Questions

1. **所有者的邮箱 SMTP 细节（服务商、端口、是否需要授权码、AuthMethod PLAIN 还是 LOGIN）**
   - What we know: PocketBase 的 SMTP 设置字段是 `host`、`port`、`username`、`password`、`authMethod`（PLAIN/LOGIN）、`tls`、`localName`（`core/settings_model.go`，master）；后台有“发送测试邮件”。D-02 要求全部由所有者在后台填。
   - What's unclear: 服务商不同，465（隐式 TLS，对应 PocketBase 的 `tls` 开关）与 587（STARTTLS）的组合不同；香港机房能否外连。
   - Recommendation: README 写成“先填、点测试邮件、收到后才开 MFA”的检查点步骤；不假设服务商。

2. **R2 令牌的删除权限与 `forcePathStyle`**
   - What we know: 官方文档只说 Object Read & Write 能读、写、列对象，没有明说删除；自动备份清理要 `DeleteObject`。
   - What's unclear: 实际行为。
   - Recommendation: 恢复演练的最后一步要求在后台删除演练用的手动备份，失败就改令牌权限；R2 生命周期规则（前缀 `@auto_pb_backup_`，约 35 天）作兜底，由所有者在 R2 控制台设置。

3. **探针超级用户保留还是重建（A12）**
   - What we know: D-10 要求删探针数据；D-11 要求保留二进制和 pocketbase 用户。
   - What's unclear: 超级用户是否也算“探针数据”。
   - Recommendation: 默认清空 `pb_data` 并让所有者用新口令重建，这样新钥匙从第一次保存设置起就生效；在 `07-retire-probe.sh` 的批准说明里明确这一点，由所有者批准。

4. **certbot 的 server 块里是否已有 server 层 `add_header`（例如 HSTS）**
   - Recommendation: 在 `00-status.sh` 里加一个只读检查（只报“有/无”，不输出内容），决定通用头文件里要不要自带 HSTS。

5. **`USJ_CONFIG` 脚本的位置**：插在主内联 `<script>` 之前（`<head>` 末尾或主脚本前）即可，因为 `readConfig()` 在主脚本顶层读取 `window.USJ_CONFIG`。构建脚本要对“找到恰好 1 处插入锚点”做断言，找不到就失败（与 `serveAppVariant` 的“每个标记恰好一次”同一思路）。

6. **清理 `tools/probe/` 的范围**：探针页相关文件可以删，`vendor/` 不能删（见 Runtime State Inventory）；`tools/probe/schema.json`、`schema-check.mjs`、`summarize.mjs`、`export-results.py` 随探针一起退役，但它们有 `--self-test` 被隐私检查和 `PRIVACY.md` 引用的可能，计划里先 grep 再删。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | 构建脚本、验证脚本、测试 | ✓（本机） | v24.20.0 | — |
| `@playwright/test` + 本机 Edge | 全部浏览器用例、图标渲染 | ✓ | 1.64.1 | — |
| 本机 PocketBase 0.41.1（Windows 版，被 git 忽略） | 本机一次性实例、钩子/设置/MFA 演练 | ✓ | 0.41.1（`--version` 实测） | — |
| OpenSSH 客户端、curl、sha256sum（Git Bash） | 批准清单、上传、`redact` 管道 | ✓ | OpenSSH_10.3p1、curl 8.21.0、sha256sum 8.32 | — |
| 服务器：nginx / certbot / systemd / python3 / curl / openssl | 部署 | 未联系服务器，按 Phase 6 记录视为已有（Ubuntu 24.04.5、nginx 1.24、certbot.timer、swap、python3 已被 04 脚本使用） | — | `00-status.sh` 只读核对后再动手 |
| 服务器：logrotate | 访问日志 30 天 | 未核对（Ubuntu 默认自带，nginx 包的 `/etc/logrotate.d/nginx` 通常存在） | — | 用 cron 加 `find -mtime +30 -delete` 兜底（不推荐） |
| Cloudflare R2 桶和令牌 | 备份 | ✗（所有者创建） | — | 创建前自动备份会落本机 `pb_data/backups`，不是异地副本 |
| 所有者邮箱 SMTP | OTP 和备份失败邮件 | ✗（所有者填写） | — | 无；没有它就不能开 MFA |
| Cloudflare 账号、阿里云网页终端 | 所有者操作 | 所有者持有 | — | — |

**Missing dependencies with no fallback:**
- R2 桶 + 令牌、SMTP 配置（都由所有者操作，是 OPS-01、SEC-02 的前提）。

**Missing dependencies with fallback:**
- logrotate 若缺失可用 cron + find 兜底。

## 总体验收清单的结构（D-12、D-13，回答调研问题 7）

交付物是一份中文清单文件（建议 `.planning/phases/13-deploy-hardening-acceptance/13-ACCEPTANCE.md`，不含域名、账号、邮箱），每一项有“操作 / 期望 / 结论（通过·问题·不适用）/ 备注”四列。顺序固定如下，且**测试账号在先、真实数据在后**：

- **A0 前置（Claude 已做，所有者确认）：** 部署完成、真重启通过、恢复演练通过（D-05，演练在导入真实数据之前）、后台两步验证已开启并实测登录一次、测试邮件收到。
- **A 登录与账号：** 所有者在后台为测试账号建用户（没有开放注册）；两台设备分别登录；退出再登录；密码修改。
- **B 同步（路线图 SC5）：** 大陆设备与美国设备各一台、同一测试账号；记一笔“几秒内”出现在另一台（Phase 10 真机项）；写草稿时远端更新先挂起、空闲后应用；电信/联通往返约 300–400 ms（06-PROBE-RESULTS），重点看这两家线路下的体感。
- **C 离线（SC4）：** 断网记录一笔、状态行显示待上传数量；断网刷新页面仍能打开、数量还在；断网冷启动（先关掉所有标签再打开）；联网后自动上传并与另一台一致。
- **D 安装到主屏幕：** Android（Edge/Chrome）和 iPhone（Safari 分享 → 添加到主屏幕）；名称「计划手记」、图标是深色底「记」；独立窗口打开；说明 iPhone 不装到主屏幕时 7 天清理的风险。
- **E 更新提示（D-08）：** 发布一个无害的新版本后，已打开的页面出现「有新版本，点此更新」；有草稿时点击先确认；确认后刷新到新版本；待上传的修改仍在。
- **F 导出导入（Phase 11 真机）：** 手机下载备份和日历 CSV、导入时选文件。
- **G 编辑计划（Phase 12 的 5 项，`.planning/phases/12-plan-editor/12-UAT.md` Deferred Follow-Ups）：** 桌面与 375 px 完整走查；UI-SPEC 三条 backstop（E2、E3、E10）；暗色主题；三句新文案表态；真实浏览器的返回键与刷新（`#plan`）。
- **H 会删数据的操作（只在测试账号上）：** 彻底删除已归档项；冲突三选一；撤销导入。
- **I 后台与备份：** 两步验证登录实测；故意输错口令触发限流（可选）；后台“备份”页能看到 R2 里的备份；**次日回看**：R2 里出现了新的 `@auto_pb_backup_…`，没有失败邮件、也没有看门狗邮件。
- **J 迁移真实数据（所有者本人，Claude 不读）：** 在本机运行 `node tools/plan/migrate-backup.mjs <旧备份.json>`（输出到被忽略的 `private/`，`tools/plan/migrate-backup.mjs` 文件头已写明只由所有者运行）→ 在自己的正式账号里一次导入 → 核对摘要里的记录条数、日期范围、完成任务数、力量记录数与旧备份一致 → 导入后立刻在后台手动创建一份备份。
- **K 收尾：** 删除测试账号（`journey_docs.owner` 是 `cascadeDelete: true`，`pb/pb_migrations/1794096100_journey_docs.js`，删账号会连带删文档）；确认 R2 里的演练备份已删除；把总体结论和每项结果告诉 Claude；Claude 记录结论并跑 `npm test` 与 `npm run test:cloud` 最后一遍。

## Sources

### Primary (HIGH confidence)
- 本机 PocketBase 0.41.1（`tools/pb/bin/pocketbase.exe`）一次性实例实验（实验目录在系统临时区，已删除；无真实数据）：`serve --help`/`superuser --help` 输出；设置迁移（`logs`、`rateLimits`、`trustedProxy`、`backups`）生效且 `GET /api/settings` 读回；`_superusers` 开 OTP+MFA 后的登录流程；`superuser otp` 输出；`PB_ENCRYPTION_KEY` 缺失/错误/过短/明文转加密；自动备份失败的日志与告警；cron 的 UTC 解释；`$app.newBackupsFilesystem().list()` 元素字段；`context` 全局不存在；备份 zip 内容；限流（含 `_superusers:auth` 覆盖）；CORS（`--origins`）；响应头
- 本机 Edge + `@playwright/test` 1.64.1 原型：CSP 哈希（LF/CRLF）、`style-src-attr` 对 `innerHTML` 的拦截与 CSSOM 不受影响、Blob 下载与 EventSource 在严格 CSP 下正常；`serviceWorkers: 'block'` 下 `register()` resolve；SW 离线刷新/冷启动/更新流程；PNG 图标生成
- 仓库源码：`tools/probe/server/*`、`tools/probe/README.md`、`06-REVIEW.md`、`06-PROBE-RESULTS.md`、`pb/pb_migrations/*`、`tests/mocks/PB-CONTRACT.md`、`tests/support/{test.ts,static-server.cjs,constants.ts}`、`playwright*.config.ts`、`tools/privacy/privacy-check.mjs`、`us-journey-tracker.html`（结构行）
- github.com/pocketbase/pocketbase（master 分支）`core/backup_create.go`、`backup_restore.go`、`backup.go`、`base.go`、`settings_model.go`（经 raw.githubusercontent.com 读取；0.41.x 不在 GitHub 发布，所以以本机实测为准，源码只作佐证）

### Secondary (MEDIUM confidence)
- pocketbase.io/docs：going-to-production（备份、`--encryptionEnv`、反代 nginx 示例、MFA/OTP 建议与 `superuser otp`、superuser IP 白名单 v0.38.0+）、api-backups、js-event-hooks（`onBackupCreate`、`onMailerSend`）、js-sending-emails（`MailerMessage`）、js-overview（处理函数隔离、`pb_hooks`）、js-jobs-scheduling（`cronAdd`，文档没写时区——时区以本机实测为准）、authentication（OTP/MFA 流程）
- developers.cloudflare.com/r2：S3 API 兼容（端点、region `auto`、支持的操作）、API 令牌权限层级、对象生命周期规则
- developer.mozilla.org：`style-src-attr`、Making PWAs installable；web.dev maskable icon；webkit.org tracking-prevention（7 天上限与主屏幕例外）；playwright.dev/docs/service-workers；nginx.org `ngx_http_headers_module`；freedesktop.org systemd.service；curl.se manpage（`--aws-sigv4`、`-K -`）；w3.org/TR/CSP3（`frame-ancestors` 不能放 `<meta>`）

### Tertiary (LOW confidence)
- logrotate、nginx mime.types、HSTS 取值、iOS 图标细节、SMTP 端口可达性、`--hooksPool` 节省量：训练知识，已在 Assumptions Log 标 `[ASSUMED]`，计划里都有首次执行时的核对步骤

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 沿用 Phase 6/8 已定的组件，PocketBase 与浏览器行为用本机真程序实测
- Architecture: HIGH（CSP、Service Worker、PocketBase 设置）/ MEDIUM（nginx 与 logrotate 的服务器侧，未联系服务器）
- Pitfalls: HIGH — 多数来自本机复现（钥匙丢失、MFA 静默不发信、`style-src-attr`、UTC cron、限流覆盖）

**Research date:** 2026-11-11
**Valid until:** 约 30 天（PocketBase 0.41.x 发布节奏较快，但版本已固定；换版本需重新走所有者批准并重跑实测）
