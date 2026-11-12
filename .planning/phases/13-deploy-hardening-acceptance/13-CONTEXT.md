# Phase 13: 部署、加固与验收（Deploy, Hardening & Acceptance） - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning（路线图要求先做专项调研：`/gsd-plan-phase --research-phase 13`）

<domain>
## Phase Boundary

把应用正式部署到所有者的阿里云轻量应用服务器香港：用仓库里的 `deploy/` 模板脚本安装和升级（服务器地址、密钥只在仓库外填写），PocketBase 0.41.1 在 systemd 下运行、重启后自动恢复；每天自动备份并复制到 Cloudflare R2，做一次恢复演练；网站带 CSP 和安全响应头，后台超级用户强密码加两步验证，登录限流，代理 IP 头正确，在一次性实例上重跑隔离检查；加 Service Worker 和清单，页面打开过一次后断网也能打开、断网刷新也能打开，可以添加到手机主屏幕，新版本发布后能换上新缓存。最后由所有者在中国大陆和美国的两台真实设备上做**总体验收**，并把自己的旧数据迁进新账号。

对应需求：OPS-01..OPS-04、SEC-02，以及 TEST-02 的收口（完整 `npm test` 和 `npm run test:cloud`）。范围外（路线图与 REQUIREMENTS）：中国大陆服务器、应用内管理后台、开放注册。

</domain>

<decisions>
## Implementation Decisions

### 后台入口怎么保护（所有者讨论决定）
- **D-01:** 后台 `/_/` **保持公网可访问**，超级用户用强密码 + **邮件验证码两步验证**（PocketBase 超级用户 MFA/OTP），照路线图成功标准 3 做。所有者没有选推荐的“后台只经 SSH 隧道访问”。登录限流开启（PocketBase 内置），代理 IP 头与 nginx 的设置一致（Phase 6/8 已定 `X-Real-IP`）。3 个普通账号不开两步验证（Phase 8：账号用的是收不到邮件的假邮箱）。
- **D-02:** 发验证码的邮箱用**所有者现有的邮箱**（所有者没有选推荐的“新注册一个只用来发信的邮箱”）。SMTP 授权码和超级用户邮箱都**由所有者本人在后台里填写**，Claude 不经手、不写进任何文件或脚本；仓库里不出现这个邮箱和授权码。建议设置 `PB_ENCRYPTION_KEY` 让 PocketBase 加密存储这些设置（由调研确认做法）。部署说明里写明风险：服务器出事时这个邮箱的授权码也要换。
- **D-03:** 服务器日志**保留 30 天、记录访问者 IP**：PocketBase 请求日志（`logs.maxDays=30`、记 IP）和 nginx 访问日志（按天轮转、保留 30 天）。日志只留在服务器上，任何导出或报告都不带 IP、域名（沿用隐私规则和 `redact.mjs`）。

### 备份和恢复演练（所有者讨论决定）
- **D-04:** 数据库**每天备份一次**（北京时间凌晨，具体时刻和服务器时区由计划定），**保留 30 天**，异地副本放在 Cloudflare R2（路线图已定）。R2 存储桶和最小权限的访问密钥由所有者本人创建，密钥由所有者本人填进服务器配置，Claude 不经手。是用 PocketBase 内置的 S3 备份，还是本机备份加上传脚本，由调研定；无论哪种，R2 里都要能拿到最近 30 天每天一份。
- **D-05:** 恢复演练在**服务器上的临时实例**里做，**在导入真实数据之前**：从 R2 取回一份只含测试账号的备份，在另一个端口和数据目录起一个临时 PocketBase 恢复、核对合成账号的数据完整，然后删除临时实例。真实数据不离开服务器，也不下载到所有者的电脑。
- **D-06:** 备份失败时**发邮件提醒**：用 D-02 同一个发信邮箱，在备份失败或连续两天没有新备份时，发一封邮件到所有者的邮箱。

### 离线和更新提示（所有者讨论决定）
- **D-07:** Service Worker 只缓存应用外壳（页面、SDK、清单、图标），**从不缓存 `/api/`**；页面打开过一次后断网能冷启动进入应用并记录，断网时刷新也能打开，待上传的修改和数量还在（路线图成功标准 4，承接 10-CONTEXT D-08）。
- **D-08:** 发布新版本后，已打开或装在主屏幕的应用**提示「有新版本，点此更新」**，所有者点了才刷新（所有者没有选推荐的“下次打开自动换新”）。有未保存的修改（例如「记一笔」草稿、编辑计划页的草稿）时，点更新先确认；待上传的修改本来就存在本机缓存里，刷新后照常上传。提示的位置和样式沿用 09-UI-SPEC 的横幅写法。
- **D-09:** 主屏幕上的名字是 **「计划手记」**，图标用应用现有配色的纯色底加一个 **「记」** 字，由 Claude 生成（各尺寸 PNG、可遮罩图标、苹果主屏图标），不用外部素材。

### 探针站点和总体验收（所有者未选讨论，按推荐定，可以再改）
- **D-10:** 删除 Phase 6 的探针页、探针的 nginx 位置块（`/probe/`）、探针的数据结构和数据。探针页的 CR-01、CR-02 不再修（页面删除后不适用），网络可达性改由总体验收时的真机实际使用来检验。
- **D-11:** 在 Phase 6 已装好的基础上**升级**，不重装系统：保留 swap、PocketBase 0.41.1 的二进制和 `pocketbase` 用户、nginx 和 certbot；把探针配置换成应用配置（应用迁移文件、应用的 nginx 位置块、页面和 SDK 文件）。Phase 6 脚本里只在重跑时才暴露的缺陷（06-REVIEW 的 WR-07、WR-08、WR-09、IN-06、IN-07、IN-09、IN-11）在 `deploy/` 模板里修掉。
- **D-12:** 写一份**中文总体验收清单**，所有者按清单自己走一遍、把结论告诉 Claude（所有者 2026-11-12 的决定：各阶段不单独验收）。清单包含：路线图成功标准 5；Phase 10 的真机“几秒内”同步与断网记录；Phase 11 的真机下载备份、日历 CSV 和选文件导入；Phase 12 推迟的 5 项（见 `.planning/phases/12-plan-editor/12-UAT.md` 的 Deferred Follow-Ups）。
- **D-13:** 总体验收**先用一个临时测试账号**做（含彻底删除、冲突三选一这类会删数据的操作），确认没问题后再由所有者导入真实旧数据（本机跑 `tools/plan/migrate-backup.mjs`，Claude 不读真实数据），测试账号随后删除。恢复演练（D-05）也在导入真实数据之前完成。

### 已有决定（沿用，不再讨论）
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 范围和需求
- `.planning/ROADMAP.md` §「Phase 13: 部署、加固与验收」 — 目标、5 条成功标准、Research 要求、Notes（含总体验收一条）
- `.planning/REQUIREMENTS.md` — OPS-01..OPS-04、SEC-02、TEST-02；Out of Scope
- `.planning/PROJECT.md` — Constraints、Key Decisions（服务器、nginx、PocketBase、USJ_CONFIG、总体验收）、Active 列表

### 服务器与 Phase 6 基础
- `.planning/phases/06-procurement-reachability-probe/06-CONTEXT.md` — D-01..D-17（服务器、nginx、PocketBase 版本与校验、脚本批准流程、密码、下载批准）
- `.planning/phases/06-procurement-reachability-probe/06-PROBE-RESULTS.md` — 内存、swap、certbot、防火墙、国内延迟、nginx 参数
- `.planning/phases/06-procurement-reachability-probe/06-SECURITY.md`、`06-REVIEW.md`、`06-REVIEW-DISPOSITION.md` — 推迟到本阶段的加固项（AR-01 后台公开）、重跑才暴露的脚本缺陷
- `.planning/phases/06-procurement-reachability-probe/06-08-SUMMARY.md` — sha256 清单批准和上传核对的实际流程
- `tools/probe/README.md`、`tools/probe/server/*`（`02-install-pocketbase.sh`、`04-start-pocketbase.sh`、`05-nginx-probe.sh`、`pocketbase.service`、`nginx/usj-probe-locations.conf`） — 要改造成 `deploy/` 模板的起点
- `tools/privacy/redact.mjs`、`tools/probe/verify-site.mjs`、`PRIVACY.md` — 私有参数、脱敏、站点检查、隐私规则

### 应用、迁移和测试
- `pb/pb_migrations/1794096000_users_lockdown.js`、`pb/pb_migrations/1794096100_journey_docs.js`、`pb/rules.expected.json`、`tools/pb/isolation-check.mjs` — 线上要用的迁移和隔离检查
- `tests/mocks/PB-CONTRACT.md` — 代理 IP 头、请求体上限等协议细节
- `.planning/phases/10-offline-realtime-sync/10-CONTEXT.md` — D-08（断网刷新留给本阶段的 Service Worker）
- `.planning/phases/11-export-import-migration/11-CONTEXT.md` — D-06 迁移由所有者在本机运行
- `.planning/phases/12-plan-editor/12-UAT.md` — 并入总体验收的 5 项
- `.planning/research/STACK.md`、`PITFALLS.md`、`ARCHITECTURE.md`、`SUMMARY.md` — 备份、CSP、Service Worker、后台加固的调研（其中 Caddy 和腾讯云的写法已作废，以 Phase 6 为准）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 6 探针工具包 `tools/probe/server/`：`02-install-pocketbase.sh`（0.41.1/0.40.6 的 SHA-256、安装路径 `/opt/pocketbase`、数据 `/var/lib/pocketbase`、用户 `pocketbase`）、`04-start-pocketbase.sh`（装 unit、健康检查、核对只监听本机）、`05-nginx-probe.sh`（以 certbot 的 `server_name … # managed by Certbot` 为锚点插入 include、备份、`nginx -t`、certbot dry-run、失败回滚）、`pocketbase.service`（`Restart=always`、`GOMEMLIMIT=256MiB`、`MemoryHigh/Max`、沙箱）。
- `tools/privacy/redact.mjs`（filter、`--check`、`--init-env`、`--verify-env`、`--self-test`，读 `private/server.env` 的 `USJ_DOMAIN`、`USJ_IP`）和 `tools/probe/verify-site.mjs`（B-01..03、F-01..F-14 站点检查）。
- 测试静态服务器 `tests/support/static-server.cjs` 只放行页面和 `vendor/pocketbase.iife.js` 两个文件（`tools/probe/page/vendor/`，`SHA256SUMS` 固定）。

### Established Patterns
- 服务器操作：sha256 清单 → 所有者批准 → 上传到临时目录 → 三次核对哈希 → 执行（`06-08-SUMMARY.md`）。清单解析要同时接受 `  ` 和 ` *` 分隔符。
- 隐私规则 A–H（`tools/privacy/privacy-check.mjs`）：IP、域名经 denylist 拦截；密钥名、`Environment=`、JWT、公网 IPv4、`pb_data`、`.db`、压缩包都被拦截。部署模板里只能用占位符。
- 改动页面（清单链接、Service Worker 注册、注入配置）要同步 `APP_SHA256`（`tests/support/constants.ts`）。
- 测试配置 `serviceWorkers: 'block'`（`playwright.config.ts`），第二台设备的上下文同样屏蔽；`context.setOffline` 不能让页面重新加载（`tests/README.md`）。

### Integration Points
- 云端开关 `readConfig()` 读 `window.USJ_CONFIG.backend`（`us-journey-tracker.html` 约 881–886 行）；SDK 从 `/vendor/pocketbase.iife.js` 加载、带 SRI（约 901、927 行）；`new PocketBase(location.origin)`（约 933 行）。
- CSP 相关：一个内联 `<style>`、一个内联 `<script>`，生成的 `style="width:${pct}%"` 属性（约 2122、2130、2153、2159 行），没有内联 `on*=` 处理器，没有外部地址。
- 仓库里还没有清单文件、图标和 Service Worker；没有 `deploy/` 目录。
- 应用迁移不设置服务器参数（限流、代理 IP 头、日志、备份/S3）——只有探针迁移设置过，需要在部署里补上。
- nginx 探针片段的 `client_max_body_size 1m` 会先于应用 4 MiB 的文档上限挡住大保存。

</code_context>

<specifics>
## Specific Ideas

- 所有者选择照路线图做后台两步验证（公网开放 + 邮件验证码），并用自己现有的邮箱发信——方便优先；部署说明要写清这个邮箱授权码存在服务器上的风险和更换方法。
- 所有者希望日志保留得长一点（30 天）、记 IP，方便出问题时排查。
- 所有者希望新版本有明确的「点此更新」提示，而不是悄悄换新。
- 总体验收由所有者独自按清单完成，结论回报给 Claude；验收之前不碰真实数据。

</specifics>

<deferred>
## Deferred Ideas

- 后台只经 SSH 隧道访问（推荐过、所有者这次没选），以后如果后台被频繁试密码可以再改。
- 单独注册一个只用来发信的邮箱（推荐过、所有者这次没选）。
- 探针页的 CR-01、CR-02 修复：探针页删除后不再需要；如果将来要再做国内三网测速，另起任务。

</deferred>

---

*Phase: 13-deploy-hardening-acceptance*
*Context gathered: 2026-11-12*
