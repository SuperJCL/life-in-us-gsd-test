# Phase 6: 采购与中美可达性实测（Procurement & Reachability Probe） - Context

**Gathered:** 2026-11-07
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段在所有者已经买好的服务器和域名上，搭一个最小的探针站点：PocketBase 加一个探针页，用域名经 HTTPS 打开。然后在晚高峰从中国大陆三家运营商和美国，实测打开、登录和实时连接，把结果和已知限制记下来，作为 Phase 13 正式部署的输入。

隐私检查要先补齐：服务器地址、域名、令牌、密码、数据库文件和备份，一律挡在公开仓库之外。

探针站点只用于实测，站上只有合成的探针账号。Phase 13 正式部署时可以重装。正式加固（CSP、后台两步验证和限流、异地备份）不在本阶段。

</domain>

<decisions>
## Implementation Decisions

### 已经发生或已定的事实（采购阶段的结果）

- 所有者已买好服务器和域名，DNS 已配好：
  - **服务器：** 阿里云轻量应用服务器，地域中国香港，不需要 ICP 备案。系统是 Ubuntu 24.04。
  - **域名：** `.vip` 后缀，DNS 托管在 Porkbun，裸域名和 `www` 都指向服务器。
- 服务器上已经有 nginx 1.24，Let's Encrypt 证书覆盖裸域名和 `www`，HTTP 会跳转到 HTTPS。`certbot renew --dry-run` 已通过，证书会自动续期。
- 服务器上还有所有者装的 Node.js 24、npm 和 PM2，本项目不使用它们。
- Claude 可以用 SSH 别名 `usj`（用户 `admin`，密钥登录）连上服务器，只读的连通测试已通过。
- **服务器 IP 和域名只记在被 git 忽略的 `private/denylist.txt` 里**，隐私检查的规则 D 已经会拦它们。任何被跟踪的文件、规划文档和提交说明里都不写真实 IP 和域名，只说“服务器”“域名”或 `usj`。

### 服务器、Web 服务和 PocketBase

- **D-01:** 服务商以所有者实际买的为准：阿里云轻量应用服务器香港，加 Porkbun 托管的 `.vip` 域名。本阶段顺带把规划文档里过时的写法改过来，具体是：
  - `.planning/PROJECT.md` 的 Constraints 和 Key Decisions 里的腾讯云和 `.com`；
  - `.planning/REQUIREMENTS.md` INFRA-01 的措辞；
  - `.planning/ROADMAP.md` Phase 6 的成功标准 2、4 和 Notes，以及 Phase 13 Notes 里的 Caddy；
  - `.claude/CLAUDE.md` 的 Project 段，用 `generate-claude-md` 只重新生成这一段。

  改的时候不写真实 IP 和域名。
- **D-02:** Web 服务继续用服务器上已有的 nginx 和 certbot，不换 Caddy（所有者决定）。nginx 给 PocketBase 做反向代理时，必须按实时连接（SSE）的需要配置：关闭代理缓冲、用 HTTP/1.1、读超时足够长，不能把实时流掐断或憋住。具体参数由调研和规划决定。
- **D-03:** PocketBase 用固定版本 0.41.1，从维护者站点下载，安装前核对官方校验和；0.40.6 作为备选版本。
  - 以非 root 用户、systemd 服务的方式运行，开机自动启动，只监听 127.0.0.1，外部只能经 nginx 访问。
  - 不使用 PM2。

### 谁在服务器上动手

- **D-04:** 会改动服务器的步骤按这个流程走：
  1. Claude 先把完整脚本发给所有者；
  2. 所有者回复“可以”批准；
  3. Claude 用 SSH（别名 `usj`）执行，再把结果报告给所有者。

  这类步骤包括下载 PocketBase、装 systemd 服务、改 nginx 配置、重启服务。只读的检查不需要批准，例如看状态、版本、日志和监听端口。
  - **D-04a:** 需要 sudo 的步骤，由 Claude 在批准后用 sudo 执行。第一次用 sudo 之前，先只读地确认 `admin` 不用密码就能 sudo。如果需要密码，这些步骤改由所有者自己在网页终端执行。
- **D-05:** PocketBase 超级用户（后台管理员）的密码，由所有者自己在阿里云网页终端运行 Claude 给出的命令时输入。Claude 看不到也不记录这个密码。它不进任何文件，包括 `private/` 和本机拦截清单。

### 合格标准和结论

- **D-06:** 速度标准：晚高峰首屏 5 秒内，登录 3 秒内。按运营商分别看，大多数次数达到就算合格，偶尔一次慢不算不合格。这是所有者选的宽松标准。
- **D-07:** 实时连接标准：连续 10 分钟不断开，或者断开后 10 秒内自动重连上。
- **D-08:** 不论实测结果如何都**不换服务商**，继续用阿里云香港（所有者原话：“已经购买了阿里云的，能用就用，不能用也没办法”）。
  - 结论写成三部分：实测结果、已知限制、做过的调整（例如 nginx 的实时连接设置）。
  - 结论交给 Phase 10 和 Phase 13 当输入，例如重连后补拉数据、兜底轮询的间隔。
  - 成功标准 4 里“决定续费还是换商家”的说法，在 ROADMAP 里相应改掉（见 D-01）。

### 实测怎么做、结果怎么收集（所有者采纳 Claude 的建议）

- **D-09:** 探针页的流程：
  1. 测试的人先选运营商（电信、联通、移动、美国）和网络类型（手机 4G 或家宽），再点开始；
  2. 页面自动测首屏时间；
  3. 用合成的探针账号登录，记录登录耗时；
  4. 保持实时连接 10 分钟，记下每次断开和重连的时间；
  5. 结束后把结果自动传回服务器上一个只存探针结果的集合，同时在屏幕上显示一份摘要，方便截图备用。

  探针页不收集任何个人信息。
- **D-10:** 测试安排：
  - 至少测 3 个晚上，北京时间 20:00–23:00；
  - 每个晚上，电信、联通、移动各至少测 2 次，美国也测；
  - 另外用 itdog.cn、17ce 这类多点测速站做一次基线对比；
  - 测试的人由所有者组织。

  汇总表写进本阶段目录，表里不出现 IP 和域名。

### 隐私检查（SEC-03）

- **D-11:** IP 和域名沿用本机 `private/denylist.txt`，由规则 D 叠加拦截，这一做法已经生效。本阶段给它补上一条故意违规的自检。
- **D-12:** 新增以下拦截规则，每条都带一条故意违规的自检：
  - PocketBase 令牌形状的字符串（JWT）；
  - 写着真实值的密码类配置，例如 `password=…`，或 JSON 里的 `"password": "…"`。允许 `<…>`、`***`、`CHANGE_ME` 这类占位；
  - `pb_data/`、数据库文件（`*.db`、`*.db-wal`、`*.db-shm`）、`pb_backups/` 和备份压缩包。

  真实密码不写进任何文件。拦密码靠形状规则，不把密码本身放进拦截清单。

### 规划前补充（2026-11-07，调研之后由所有者确认）

- **D-13:** PocketBase 后台 `/_/` 在探针阶段**对公网开放**，靠所有者设置的强密码保护。这和 ROADMAP Phase 6 Notes 的写法一致，所有者没有采用调研建议的“对公网关闭、走 SSH 隧道”。
  - 后台上只放合成数据，并打开 PocketBase 自带的限流。
  - 两步验证和 IP 白名单等正式加固留到 Phase 13。
- **D-14:** 服务器上加一个 1 GB 的 swap 文件，作为单独一个脚本，按 D-04 由所有者批准后执行。服务器内存只有约 0.9 GB，原先没有 swap。PocketBase 同时用 `GOMEMLIMIT` 和 systemd 的内存上限控制内存。
- **D-15:** 前端 SDK **不用 0.28.2**，改用它之前的上一个稳定版本。0.28.2 太新，包检查工具因为没有写仓库地址把它标为可疑。具体版本号在规划时按下面三点确定：
  - 和服务端 0.41.1 兼容；
  - 固定文件哈希，与页面同源托管；
  - 下载前先经所有者批准。

  这条同样影响 Phase 9（`.planning/research/STACK.md` 原写 0.28.2），在 STATE 的待办里记一笔。
- **D-16:** PocketBase 服务端仍按 D-03 用 0.41.1。0.41.1 的官方校验和只有维护者站点一个来源，所以把调研核对过的 SHA-256 固定写在安装脚本里，不一致就中止。0.40.6 作为备选，它有两个来源可以互相核对。
- **D-17:** 任何下载都要先经所有者批准，包括只在本机做核对用的下载。
  - 调研时，研究代理曾未经批准把 PocketBase 安装包和 SDK 包下载到会话临时目录。两样都没有运行过，已经删除。
  - 以后的计划里，凡是下载都要放在所有者批准的脚本或检查点之后。
- **D-18:** 两条小决定由 Claude 按调研建议定下，所有者已知悉：
  - “大多数次数达标”按每家运营商至少三分之二的次数达到 D-06 计；
  - 美国侧以美国本地 20:00–23:00 为主，北京晚高峰时段再补测几次。

  隐私规则方面也有两项补充：
  - 规则 D 的 denylist 匹配改为不区分大小写；
  - 新增一条公网 IPv4 形状的规则（调研实测对已跟踪文件误报为 0）。

### Claude's Discretion

- 探针页的具体设计、放在哪个路径下，以及它的源码是否放进仓库。放进仓库的话，源码里只能用相对地址，不能写死域名。
- 探针结果集合的字段和 API 规则。探针账号只能新建结果，不能读写别的数据。
- 合成探针账号的凭据怎么交给测试页。这是临时站点，凭据可以写进探针页，但这个账号的权限必须收到最小。
- nginx 配置的具体写法、PocketBase 数据目录的位置、systemd unit 的细节。
- 各条隐私规则的正则写法。
- 实测数据怎么汇总成表。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段范围与需求
- `.planning/ROADMAP.md` § Phase 6：目标、4 条成功标准和 Notes。其中成功标准 2、4 的服务商和 Caddy 写法按 D-01、D-08 修改。
- `.planning/REQUIREMENTS.md`：INFRA-01、INFRA-02、SEC-03
- `.planning/PROJECT.md`：v2.0 Constraints（隐私、所有者自己购买和输入密码、服务器脚本要批准）

### v2.0 调研
- `.planning/research/STACK.md`：
  - PocketBase 0.41.1 的下载来源和校验和；
  - nginx 加 certbot 作为备选方案的注意事项，SSE 要关闭代理缓冲；
  - “买之前先测”：用多点探测站和 mtr 测线路。
- `.planning/research/PITFALLS.md` § Pitfall 4（第三方资源被墙）、§ Pitfall 5（线路差）、§ Pitfall 6（SSE 经代理后静默断开，nginx 的缓冲和读超时）、§ Pitfall 3（后台 `/_/` 暴露）
- `.planning/research/ARCHITECTURE.md` § Q6 单台 VPS 的部署架构：PocketBase 只监听本机、systemd、防火墙只开 22/80/443

### 隐私护栏
- `tools/privacy/privacy-check.mjs`：
  - 规则 A 到 E；
  - `seedTerms` 和 `parseDenylist` 的叠加；
  - `seedGate`；
  - `--self-test` 的写法。

  新规则照现有规则的格式写。
- `PRIVACY.md`：说明要随新规则同步更新
- `.gitignore`：`private/` 已被忽略
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-CONTEXT.md` D-06：规则 D 读种子，再叠加 `private/denylist.txt`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/privacy/privacy-check.mjs`：已有路径规则（`checkPath`）、内容扫描（`scanText`，逐行跑规则 B、C、D）、denylist 解析和自检框架。D-11、D-12 的新规则加在这里。
- `tools/test-report/check-report.mjs` 和低优先级测试启动方式：如果为探针页加本地测试，沿用它们。

### Established Patterns
- 规则命中只输出位置、规则名和编号，不输出命中的原文。新规则也要这样，令牌和密码一律不打印。
- 改动 `private/` 以外的文件时，pre-commit 和 pre-push 钩子会自动跑检查器，钩子文件本身不改（Phase 7 D-13）。
- 测试只用合成数据，不连接真实服务器（PROJECT Constraints）。探针页的实测是所有者组织的人工测试，不进 `npm test`。

### Integration Points
- 服务器：通过 `ssh usj` 访问。改动服务器的步骤按 D-04 流程执行。
- 本机：`private/denylist.txt` 已经包含真实 IP 和域名。

</code_context>

<specifics>
## Specific Ideas

- 所有者希望不折腾：服务器已经买了就用下去，实测是为了摸清实际表现、调好配置，不是为了换商家。
- 速度标准放宽到首屏 5 秒、登录 3 秒，只求国内能正常使用。

</specifics>

<deferred>
## Deferred Ideas

- 更换服务商、改用东京或 CN2 线路：所有者明确不做。
- 正式加固：CSP 和安全响应头、后台两步验证、限流、超级用户 IP 白名单、异地备份到 R2、恢复演练。这些属于 Phase 13。
- 探针站点的清理或重装：Phase 13 正式部署时处理。
- 应用侧的弱网对策，比如重连后补拉、兜底轮询的间隔：Phase 10 根据本阶段的结论来定。

</deferred>

---

*Phase: 06-procurement-reachability-probe*
*Context gathered: 2026-11-07*
