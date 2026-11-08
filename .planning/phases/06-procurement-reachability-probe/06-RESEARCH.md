# Phase 6: 采购与中美可达性实测（Procurement & Reachability Probe） - Research

**Researched:** 2026-11-07
**Domain:** 单台 Linux 小机上的 PocketBase + nginx + certbot 最小探针站点；中美网络可达性实测方法；公开仓库的密钥/数据防泄漏规则（SEC-03）
**Confidence:** MEDIUM-HIGH（安装来源、校验和、nginx/SSE 参数、SDK 重连行为、隐私规则的误报率都在本会话里读过源码或实测过；大陆三网的真实表现只能靠实测，这正是本阶段要做的事）

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**已经发生或已定的事实（采购阶段的结果）**

- 所有者已买好服务器和域名，DNS 已配好：
  - **服务器：** 阿里云轻量应用服务器，地域中国香港，不需要 ICP 备案。系统是 Ubuntu 24.04。
  - **域名：** `.vip` 后缀，DNS 托管在 Porkbun，裸域名和 `www` 都指向服务器。
- 服务器上已经有 nginx 1.24，Let's Encrypt 证书覆盖裸域名和 `www`，HTTP 会跳转到 HTTPS。`certbot renew --dry-run` 已通过，证书会自动续期。
- 服务器上还有所有者装的 Node.js 24、npm 和 PM2，本项目不使用它们。
- Claude 可以用 SSH 别名 `usj`（用户 `admin`，密钥登录）连上服务器，只读的连通测试已通过。
- **服务器 IP 和域名只记在被 git 忽略的 `private/denylist.txt` 里**，隐私检查的规则 D 已经会拦它们。任何被跟踪的文件、规划文档和提交说明里都不写真实 IP 和域名，只说“服务器”“域名”或 `usj`。

**服务器、Web 服务和 PocketBase**

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

**谁在服务器上动手**

- **D-04:** 会改动服务器的步骤按这个流程走：
  1. Claude 先把完整脚本发给所有者；
  2. 所有者回复“可以”批准；
  3. Claude 用 SSH（别名 `usj`）执行，再把结果报告给所有者。

  这类步骤包括下载 PocketBase、装 systemd 服务、改 nginx 配置、重启服务。只读的检查不需要批准，例如看状态、版本、日志和监听端口。
  - **D-04a:** 需要 sudo 的步骤，由 Claude 在批准后用 sudo 执行。第一次用 sudo 之前，先只读地确认 `admin` 不用密码就能 sudo。如果需要密码，这些步骤改由所有者自己在网页终端执行。
- **D-05:** PocketBase 超级用户（后台管理员）的密码，由所有者自己在阿里云网页终端运行 Claude 给出的命令时输入。Claude 看不到也不记录这个密码。它不进任何文件，包括 `private/` 和本机拦截清单。

**合格标准和结论**

- **D-06:** 速度标准：晚高峰首屏 5 秒内，登录 3 秒内。按运营商分别看，大多数次数达到就算合格，偶尔一次慢不算不合格。这是所有者选的宽松标准。
- **D-07:** 实时连接标准：连续 10 分钟不断开，或者断开后 10 秒内自动重连上。
- **D-08:** 不论实测结果如何都**不换服务商**，继续用阿里云香港（所有者原话：“已经购买了阿里云的，能用就用，不能用也没办法”）。
  - 结论写成三部分：实测结果、已知限制、做过的调整（例如 nginx 的实时连接设置）。
  - 结论交给 Phase 10 和 Phase 13 当输入，例如重连后补拉数据、兜底轮询的间隔。
  - 成功标准 4 里“决定续费还是换商家”的说法，在 ROADMAP 里相应改掉（见 D-01）。

**实测怎么做、结果怎么收集（所有者采纳 Claude 的建议）**

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

**隐私检查（SEC-03）**

- **D-11:** IP 和域名沿用本机 `private/denylist.txt`，由规则 D 叠加拦截，这一做法已经生效。本阶段给它补上一条故意违规的自检。
- **D-12:** 新增以下拦截规则，每条都带一条故意违规的自检：
  - PocketBase 令牌形状的字符串（JWT）；
  - 写着真实值的密码类配置，例如 `password=…`，或 JSON 里的 `"password": "…"`。允许 `<…>`、`***`、`CHANGE_ME` 这类占位；
  - `pb_data/`、数据库文件（`*.db`、`*.db-wal`、`*.db-shm`）、`pb_backups/` 和备份压缩包。

  真实密码不写进任何文件。拦密码靠形状规则，不把密码本身放进拦截清单。

### Claude's Discretion

- 探针页的具体设计、放在哪个路径下，以及它的源码是否放进仓库。放进仓库的话，源码里只能用相对地址，不能写死域名。
- 探针结果集合的字段和 API 规则。探针账号只能新建结果，不能读写别的数据。
- 合成探针账号的凭据怎么交给测试页。这是临时站点，凭据可以写进探针页，但这个账号的权限必须收到最小。
- nginx 配置的具体写法、PocketBase 数据目录的位置、systemd unit 的细节。
- 各条隐私规则的正则写法。
- 实测数据怎么汇总成表。

### Deferred Ideas (OUT OF SCOPE)

- 更换服务商、改用东京或 CN2 线路：所有者明确不做。
- 正式加固：CSP 和安全响应头、后台两步验证、限流、超级用户 IP 白名单、异地备份到 R2、恢复演练。这些属于 Phase 13。
- 探针站点的清理或重装：Phase 13 正式部署时处理。
- 应用侧的弱网对策，比如重连后补拉、兜底轮询的间隔：Phase 10 根据本阶段的结论来定。
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | 所有者在腾讯云 Lighthouse 香港开出服务器、在 Porkbun 买好域名后，网址能通过 HTTPS 打开，证书自动申请、自动续期。（措辞按 D-01 要改成阿里云香港 + `.vip`；服务器和证书已就绪，本阶段只需让探针页经 nginx 在该域名上打开，并确认 `certbot renew --dry-run` 在改 nginx 之后仍通过） | § 安装与配置顺序 S1–S5；§ nginx 方案（把改动放进 include 文件、改完跑 `certbot renew --dry-run`） |
| INFRA-02 | 在晚高峰（20:00–23:00）分别从中国大陆电信、联通、移动和美国网络实测打开页面、登录和实时同步，结果记录下来，作为是否续费或换商家的依据。（按 D-08 改成“作为 Phase 10/13 的输入”，不再换商家） | § 探针页与集合设计；§ 实测方法和结果表；§ 验证方式 |
| SEC-03 | 公开仓库里不出现服务器地址、域名、密钥、后台密码、个人计划文字或真实数据；隐私检查为此新增对应规则。 | § SEC-03 隐私规则设计（规则 F、规则 G、规则 A 扩展、规则 D 自检）；已对 210 个被跟踪文件实测误报数为 0 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

以下是 `./.claude/CLAUDE.md` 里对本阶段有约束力的条目，规划和执行都要遵守（与 CONTEXT.md 的锁定决定同等权威）：

- **前端保持原生 HTML/JS**，不引入 React、Next.js；后端倾向 PocketBase；测试用 Playwright Test。探针页因此用原生 JS + 同源 SDK 的 iife 文件。
- **隐私：公开仓库里不放服务器地址、域名、密钥、后台密码、真实数据和个人计划文字。**测试仍然只用合成数据，不连接真实服务器；探针页的实测是所有者组织的人工测试，**不进 `npm test`**。
- **账号和付款：**服务器、域名的购买和注册由所有者完成，Claude 不代为注册、付款或输入密码。
- **安装：**本机只装项目内的 npm devDependency；**服务器上的安装由部署脚本完成，执行前经用户批准**（即 D-04）。本阶段不新增任何 npm 依赖：SDK 只作为静态文件下载，不进 `package.json`。
- **资源：**本机测试低优先级、单 worker、不并发。本阶段新增的自检脚本很轻，但不要全盘扫描。
- **流程：**生成需求和路线图后停下等用户批准；GSD 流程内才改文件。
- 回复和文档默认用简体中文，代码、命令、路径、标识符保持英文（项目 memory）。

## Summary

本阶段要在已有的阿里云香港小机（2 vCPU，约 0.9 GB 内存，没有 swap）上，用 nginx 把 PocketBase 和一个静态探针页放在同一个域名下，然后让人在晚高峰从三网和美国实测。下面这些结论决定了计划怎么写：

1. **PocketBase 0.41.1 已经能下载，校验和也能核对。**官方下载地址仍是 `ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1/…`，会 307 跳转到该站自己的文件接口；`checksums.txt` 在同一个发布记录里。我下载了 linux_amd64 的 zip 并算出 sha256，与 `checksums.txt` 一致（见 § 标准栈）。**但 0.41.1 没有第二个独立来源可以交叉核对**（GitHub 已归档，SourceForge 镜像只到 0.40.6）：核对只能防下载损坏，防不了发布站本身被入侵。所以计划要把本次研究时读到的哈希**钉死在脚本里**，核对不一致就中止。0.40.6 备选版本则有 GitHub 官方的 `digest` 与 `checksums.txt` 两个来源互相印证。
2. **PocketBase 的超级用户命令只接受命令行参数，不能从 stdin、环境变量或交互提示读密码**（读 v0.40.6 的 `cmd/superuser.go`）。所以 D-05 的“所有者在网页终端输入密码”要靠一段 `sudo -u pocketbase bash -c 'read -rs …'` 的包装：密码只在 bash 变量里，不进 shell 历史，**也不进 sudo 的命令日志**（直接 `sudo pocketbase superuser upsert 邮箱 密码` 会把密码写进 `/var/log/auth.log`）。命令行上的密码在 `/proc/<pid>/cmdline` 里有几百毫秒的可见窗口，对只有 `admin` 和 root 的这台机器可以接受。
3. **PocketBase 的实时连接没有心跳，空闲 5 分钟服务器就主动断开，最长 30 分钟。**（读 `apis/realtime.go`）这意味着：“10 分钟安静地挂着”一定会看到服务器自己在第 5 分钟断一次——这不是网络问题。所以探针页**不能只挂着等**，要用“探针账号自己写一条记录、再等自己的订阅收到推送”的方式定时打点，既避开 5 分钟空闲断开，又能直接测到“安静一阵后推送还能不能到”（这正是 Phase 10 的真实场景）。这个设计**不需要任何服务器端钩子或定时任务**。
4. **nginx 1.24 默认用 HTTP/1.0 连上游**（默认值在 1.29.7 才改成 1.1），SSE 位置必须显式写 `proxy_http_version 1.1`、`proxy_set_header Connection ""`、`proxy_buffering off`、`proxy_read_timeout`。PocketBase 自己会发 `X-Accel-Buffering: no`，nginx 默认会遵守它，但我们仍然显式关闭缓冲，不依赖对方的头。
5. **certbot 用的是 nginx 认证器和安装器**（读了续期配置里的 `authenticator = nginx`、`installer = nginx`）。改 nginx 时只往 443 的 server 块里加**一行 `include`**，把所有新位置块放进单独文件；改完立刻 `nginx -t` + `systemctl reload nginx` + `certbot renew --dry-run`，失败自动回滚。
6. **服务器上缺 `unzip`**（我只读检查到的），也没有 swap。计划要加一步 `apt-get install -y unzip`（或用 python3 解压），并建议加 1 GiB swap 文件当 OOM 保险。
7. **SEC-03：**我写了三类新规则的原型（JWT 形状、写着真实值的密码类赋值、`pb_data` / 数据库 / 压缩包路径），共 61 条故意违规/放行用例全部通过，并对仓库里 210 个被跟踪文件做了只数不看的扫描：**误报 0**。有两处必须避开的坑：测试夹具里的 JWT 形状字符串要在运行时拼接；路径规则不能按“backup”这个词拦（仓库里已有 `tests/fixtures/legacy-positional-backup.json`）。

**Primary recommendation:** 用 nginx 的一个 include 文件（`/api/realtime` 精确位置关缓冲、长超时；`/api/` 反代；`/_/` 和超级用户认证接口返回 404；`/probe/` 静态）加一个以非 root 运行、受 cgroup 内存上限保护的 systemd 服务；探针页用同源 SDK 0.28.2，靠“自己写、自己收”的定时打点测实时推送；所有改服务器的步骤拆成 5–6 个小脚本逐个批准；SEC-03 用 F、G 两条新规则加规则 A 的路径扩展，所有违规样本在运行时拼接。

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| TLS 终结、HTTP→HTTPS、证书续期 | Web 服务器（nginx + certbot） | — | D-02 已定；证书文件和续期定时器已存在，本阶段不动它们 |
| 静态探针页（HTML/JS/SDK） | Web 服务器（nginx 直接出静态文件，`/probe/`） | — | 不经过 PocketBase，避免占用它的进程；与 Phase 13 的 `pb_public` 方案只差一个目录，首屏数字等价（页面只有 3 个小文件） |
| API、认证、实时推送（SSE） | 后端（PocketBase，仅 127.0.0.1:8090） | 反向代理（nginx 保证不缓冲、不超时） | D-03 |
| 首屏/登录/实时的计时与断线记录 | 浏览器（探针页 JS） | — | 只有浏览器能看到真实用户网络下的耗时和 SSE 掉线；服务器端日志看不到客户端体验 |
| 结果存储 | 数据库（PocketBase 的 `probe_results` 集合） | — | D-09；只允许创建，探针账号读不到任何记录 |
| 超级用户后台 `/_/` 的访问 | 反向代理（对公网返回 404） | SSH 隧道（所有者自己用） | 探针站点期间不把后台暴露到公网；Phase 13 再做正式加固 |
| 访问日志与保留 | 反向代理（无 IP 的单独日志格式）+ PocketBase（`logIP=false`、`maxDays=2`） | — | D-09 “不收集个人信息” |
| 外网端口收口 | 云厂商控制台防火墙（只开 22/80/443） | 绑定地址（PocketBase 只听 127.0.0.1） | 两层；控制台层只有所有者能看 |

## Standard Stack

### Core

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| PocketBase（预编译 linux_amd64） | **0.41.1**（发布于 2026-10-28）；备选 0.40.6（2026-10-23） | 探针站点的 API、认证、SSE | D-03 已定。zip 内容只有 `pocketbase`（33,562,784 字节）、`CHANGELOG.md`、`LICENSE.md` [VERIFIED: 本机下载后用 .NET 列出] |
| nginx | 1.24.0（Ubuntu 包，已装） | 反向代理 + 静态文件 | D-02 |
| certbot | 2.9.0（已装，`certbot.timer` 每天 00:00/12:00 加最多 12 小时随机延迟） | 证书申请与续期 | 已就绪 [VERIFIED: 服务器只读检查：`OnCalendar=*-*-* 00,12:00:00`、`RandomizedDelaySec=43200`] |
| PocketBase JS SDK | **0.28.2**（2026-11-01），用 `dist/pocketbase.iife.js`，40,551 字节 | 探针页里的登录、实时订阅、记录创建 | 同源托管，不走 CDN（大陆可达性） |
| systemd | Ubuntu 24.04 自带 | 开机自启、崩溃重启、cgroup 内存上限 | D-03 |

### Supporting

| Component | Version | Purpose | When to Use |
|-----------|---------|---------|-------------|
| `unzip`（apt） | Ubuntu 24.04 仓库版 | 解压 zip | 服务器上现在没有；备选：`python3 -m zipfile -e`（服务器有 Python 3.12.3），解压后要手动 `chmod 755` |
| Python 3 标准库 `sqlite3` | 服务器上 Python 3.12.3 / SQLite 3.45.1 | 只读导出 `probe_results` 给汇总脚本 | 不需要装 `sqlite3` 命令行 |
| 1 GiB swap 文件 | — | OOM 保险 | 建议做（所有者批准）；系统当前 swap 为 0、`vm.swappiness=0`，所以只在极端内存压力下才用 |
| Node.js 24（本机，v24.20.0） | — | 运行 `privacy-check.mjs` 自检和汇总脚本 | 本机已有；脚本零依赖 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nginx 直接出探针页静态文件 | PocketBase `pb_public` 托管 | `pb_public` 与 Phase 13 一致，但静态文件不压缩、还要给 PocketBase 多一个目录；探针只有 3 个小文件，nginx 更简单。若规划者想让探针页路径与 Phase 13 完全一致，把 `/probe/` 位置换成 `proxy_pass` 即可，其他不变 |
| 探针页自己“写一条记录再等推送” | PocketBase 钩子里的 `cronAdd` 每分钟更新一条心跳记录 | cron 最小粒度是 1 分钟，且要启用钩子（`--hooksPool` 默认预热 15 个运行时，要手动调小）；定时器会让连接永远不空闲，反而测不到“安静后推送能不能到”。自写自收没有任何服务器端代码 |
| `read -rs` 包装命令（D-05） | 首次启动后经 SSH 隧道打开 `/_/#/pbinstal/<令牌>` 安装链接，在浏览器表单里设密码 | 安装链接方式密码完全不上命令行，但令牌会打印进 journald 日志。若所有者觉得命令行包装麻烦，可以选它；默认仍用 D-05 的做法，并且**先建超级用户再启动服务**，这样 PocketBase 启动时不再打印安装链接 [ASSUMED：打印条件是“没有任何超级用户”，源码里读到的是安装函数在 `InstallerFunc` 存在时被调用，打印逻辑本身没读到] |
| 后台 `/_/` 对公网返回 404、所有者走 SSH 隧道 | 像 ROADMAP Notes 那样让 `/_/` 公网可达、只靠强密码 | 404 方案多一条隧道命令，但整个探针期间没有可被暴力猜的管理员登录页；规划者可按所有者偏好放宽，见 Open Questions |

**Installation（全部在服务器上，由脚本完成，见 § 安装与配置顺序）：**

```bash
# 固定版本与哈希（本次研究在 2026-11-07 读到并核对）
PB_VERSION=0.41.1
PB_SHA256_LINUX_AMD64=7504ec99a85fe405fc9941b4d94bdea20733b53707c8251b66fd0daa1444347e
PB_URL_BASE=https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v${PB_VERSION}
# 备选 0.40.6（GitHub，已归档）：
#   https://github.com/pocketbase/pocketbase/releases/download/v0.40.6/pocketbase_0.40.6_linux_amd64.zip
#   sha256 0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f
```

**Version verification（本会话实测）：**

- 发布记录：`https://ganigeorgiev.com/api/collections/pbc_953728200/records?filter=tag='v0.41.1'` 返回 `files: checksums.txt, pocketbase_0.41.1_linux_amd64.zip, …`，创建时间 2026-10-28 06:27:43Z。（该站本身就是一个 PocketBase 应用，`pbc_953728200` 是它的 `releases` 集合。）[VERIFIED: curl 实测，2026-11-07]
- zip 下载 URL 返回 `307` 跳转到 `/api/files/pbc_953728200/e3kqqtxbejo4gmo/pocketbase_0.41.1_linux_amd64.zip`，大小 12,826,122 字节。`…/download/v0.41.1/checksums.txt` 同样 307 跳转到 `/api/files/pbc_953728200/e3kqqtxbejo4gmo/checksums.txt`。**所以脚本里 `curl` 必须加 `-L`。**（用不带 `-L` 的抓取工具会误判为 404，我的 WebFetch 第一次就是这样。）[VERIFIED: curl -I 实测]
- `checksums.txt` 里 linux_amd64 一行：`7504ec99a85fe405fc9941b4d94bdea20733b53707c8251b66fd0daa1444347e  pocketbase_0.41.1_linux_amd64.zip`；本机对下载的 zip 运行 `sha256sum` 得到完全相同的值。[VERIFIED: 本机 sha256sum，2026-11-07]
- 0.40.6 备选：GitHub API 的资产 `digest` 字段与 `checksums.txt` 里的 linux_amd64 哈希都是 `0e1f6091…309373f`，两个独立位置一致。[VERIFIED: api.github.com 与 releases/download，2026-11-07]
- 信任模型的诚实说明：`checksums.txt` 与 zip 在同一台发布服务器上，没有签名。0.41.1 的核对只能防下载损坏，防不了发布站被入侵；0.41.1 没有 GitHub/镜像的第二份哈希。缓解：哈希钉在脚本里（本次研究读到的值），安装后 `pocketbase --version` 必须输出 0.41.1，zip 在服务器之外留一份（建议放进被忽略的 `private/`）。所有者如果不能接受，就用 0.40.6 备选。[ASSUMED 的部分：发布站被入侵的概率很低，这是风险判断，不是事实]

## Package Legitimacy Audit

本阶段不 `npm install` 任何包。会用到两个“外部制品”：npm 上的 `pocketbase` SDK（只取 `dist/pocketbase.iife.js` 这一个静态文件）和 Ubuntu 仓库的 `unzip`。PocketBase 二进制不是包管理器里的包，核对方式见上节。

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| pocketbase（JS SDK，0.28.2） | npm | 2022-07 创建，已 4 年 | 约 28 万/周 | npm 元数据里 `repository` 为空；`homepage` 指向 `ganigeorgiev.com/pocketbase/js-sdk`（项目搬离 GitHub 后清掉了 repository 字段） | **SUS**（工具给出原因：`too-new`（0.28.2 发布于 2026-11-01）、`no-repository`） | 保留，**规划者必须在安装步骤前加 `checkpoint:human-verify`**。已做的独立核对：维护者邮箱与 PocketBase 作者一致；registry 的 `dist.shasum` `d27b4b3e…7f01` 与我下载的 tarball 的 sha1 相同；`dist/pocketbase.iife.js` 的 sha256 为 `8d6b31ed58c1df4c1d6903ba62d0de0a67e3cc6f6b0bf9acbc186cf4f6146745`；无 `postinstall` 脚本；只作为静态文件使用，不执行 npm 生命周期脚本；iife 文件通过现有隐私规则和新规则扫描都是 0 命中 |
| unzip | Ubuntu 24.04 apt | 数十年 | — | Ubuntu 官方仓库 | OK（系统包，不走 npm 工具） | 批准后用 `apt-get install -y unzip` |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `pocketbase`（npm，SDK 0.28.2）— 规划者在“取得 SDK 文件”之前插入 `checkpoint:human-verify`：让所有者确认上面的 sha256 与 `npm view pocketbase@0.28.2 dist.integrity` 一致，且该包的维护者与 PocketBase 作者相同。

*PocketBase 二进制的来源 `ganigeorgiev.com` 是维护者的个人站点，属于“官方但单点”的来源，见上节信任模型说明；其 URL 取自 `pocketbase.io/docs` 的下载链接 [CITED: https://pocketbase.io/docs/，2026-11-07]。*

## Architecture Patterns

### System Architecture Diagram

```
 测试的人（电信/联通/移动/美国；手机4G或家宽）
        │  浏览器打开 https://<domain>/probe/
        ▼
 ┌─────────────────────────────  公网  ─────────────────────────────┐
 │  阿里云控制台防火墙（外层）：只放行 22 / 80 / 443（需所有者在控制台确认）  │
 └──────────────────────────────────┬────────────────────────────────┘
                                    ▼
                nginx 1.24（443，certbot 管理证书）
   ┌────────────────┬───────────────────────┬──────────────────────────┐
   │ /probe/        │ /api/realtime（精确）   │ /api/ 其余                │
   │ 静态：index.html│ 关缓冲、HTTP/1.1、      │ 普通反代，limit 1m         │
   │ probe.js、      │ 读超时 3600s           │                          │
   │ SDK iife、      │                       │ /_/ 与 _superusers 认证接口 │
   │ config.js(生成) │                       │ → 直接 404（对公网）        │
   └────────────────┴───────────┬───────────┴──────────────────────────┘
                                ▼ 仅 127.0.0.1:8090
                  PocketBase 0.41.1（systemd，用户 pocketbase，cgroup 内存上限）
                  ├─ users（内置；createRule/deleteRule 收成 null；只有 1 个探针账号）
                  ├─ probe_results（探针账号只能 create）
                  └─ probe_pings（探针账号可 create + 订阅；只有合成数据）
                                ▲
   页面里的流程：首屏计时 → 选运营商/网络 → 健康检查 RTT ×5 → 登录计时
        → 订阅 PB_CONNECT 与 probe_pings → 在 15/45/105/195/315/495 秒各“写一条、等自己的推送”
        → 记录每次 drop / reconnect / 推送延迟或丢失 → 600 秒到 → 上传 probe_results + 屏幕摘要
```

所有者读结果的两条路：SSH 隧道打开后台 `/_/`（`ssh -L 8090:127.0.0.1:8090 usj`，浏览器开 `http://127.0.0.1:8090/_/`），或 Claude 用 `ssh usj` 在服务器上用 Python 标准库只读导出 `probe_results`。

### Recommended Project Structure

仓库里新增（全部不含真实域名、IP、凭据）：

```
tools/probe/
├── page/
│   ├── index.html            # 探针页（相对地址，不写域名）
│   ├── probe.js              # 页面逻辑；纯函数部分可在 Node 里自检
│   ├── config.example.js     # 占位：邮箱和密码都写成 <…>；真正的 config.js 由服务器脚本生成，已被 .gitignore 忽略
│   └── vendor/pocketbase.iife.js   # SDK 0.28.2，固定版本；旁边的 README 记 sha256
├── server/
│   ├── 01-install-pocketbase.sh … 06-swap.sh    # 逐个给所有者批准（LF 行尾！）
│   ├── pocketbase.service
│   ├── nginx/usj-probe.conf（conf.d 用）、usj-probe-locations.conf（snippets 用）
│   ├── pb_migrations/probe_schema.js.tpl
│   ├── pb_migrations/probe_user.js.tpl       # 只含 __PROBE_EMAIL__ / __PROBE_PASSWORD__ 占位
│   ├── verify.sh              # 冒烟：规则与代理行为
│   └── export-results.py      # 只读导出，经 ssh 标准输入运行
├── summarize.mjs              # 结果 JSON → 汇总表 markdown；带 --self-test
└── README.md
```

**行尾：**本仓库在系统级 `core.autocrlf=true` 下，`.gitattributes` 目前只对 `.githooks/**` 和应用文件固定了 LF（`.gitattributes` 第 2 行 `.githooks/** text eol=lf`，第 4 行 `us-journey-tracker.html text eol=lf`）。服务器脚本、unit、nginx 配置经 `ssh usj 'bash -s' < 文件` 在 Linux 上执行，**CRLF 会让 bash 报 `\r` 错误**。规划里必须加一行 `tools/probe/server/** text eol=lf`（以及 `*.sh text eol=lf`）。[VERIFIED: `.gitattributes` 已读；autocrlf 为 true 来自 `git config core.autocrlf` 输出 `true`]

### Pattern 1：nginx 配置放进两个 include 文件，只在 certbot 的 443 块里加一行

**What:** 不重写 certbot 管理的站点文件。`conf.d/usj-probe.conf`（http 上下文，放 `log_format`）和 `snippets/usj-probe-locations.conf`（server 上下文，放所有位置块），再用一行 `include` 挂进 443 的 server 块。

**When to use:** 本阶段的全部 nginx 改动。

**现状（只读检查，域名和 IP 已替换）：**默认站点文件里有三个 server 块：80 默认站、443（`server_name <domain> <domain>; # managed by Certbot`，含 certbot 的 listen/ssl 行）、80 跳转块（`server_name <domain> <domain>;`，没有 `managed by Certbot` 注释，`return 404`）。`conf.d/` 是空的；`nginx.conf` 的 http 块包含 `conf.d/*.conf` 和 `sites-enabled/*`，打开了 `gzip on`（只压 text/html）。443 的 listen 行没有 `http2`，所以现在是 HTTP/1.1。[VERIFIED: ssh usj 只读，2026-11-07]

**挂载方式：**用唯一锚点 `^[[:space:]]*server_name .*# managed by Certbot$`（只匹配 443 块里那一行）在其后追加 include。执行前脚本要先断言这个锚点恰好匹配 1 行。

```nginx
# /etc/nginx/conf.d/usj-probe.conf   （http 上下文）
# 探针站点访问日志：不含客户端 IP，不含查询串，不含 User-Agent
log_format usj_probe '$time_iso8601 $status $request_method $uri $request_time $body_bytes_sent';
```

```nginx
# /etc/nginx/snippets/usj-probe-locations.conf   （在 443 的 server 块里被 include）
server_tokens off;
access_log /var/log/nginx/usj-probe.log usj_probe;   # logrotate 的 /var/log/nginx/*.log 通配会自动覆盖，保留 14 天

add_header X-Robots-Tag "noindex, nofollow" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;

# 后台和超级用户认证：对公网不可见（按名字和按集合 id 两种写法都要挡）
location ^~ /_/ { return 404; }
location ^~ /api/collections/_superusers/ { return 404; }
location ^~ /api/collections/pbc_3142635823/ { return 404; }

# 实时连接（SSE）：精确匹配，GET 建连和 POST 订阅都走这里
location = /api/realtime {
    proxy_pass http://127.0.0.1:8090;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
    client_max_body_size 1m;
}

location ^~ /api/ {
    proxy_pass http://127.0.0.1:8090;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 60s;
    client_max_body_size 1m;
    gzip on;
    gzip_types application/json;
}

# 静态探针页：每次都完整下载，保证“首屏”是冷加载
location ^~ /probe/ {
    root /var/www/usj;
    index index.html;
    add_header Cache-Control "no-store" always;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer" always;
    gzip on;
    gzip_types text/css application/javascript text/javascript application/json;
}
```

**为什么这样写（每条都有依据）：**

| 写法 | 依据 |
|------|------|
| `proxy_http_version 1.1` + `proxy_set_header Connection ""` | nginx 文档：默认版本 1.0，1.29.7 起才改成 1.1；“推荐 1.1 用于 keepalive 连接”。本机 nginx 是 1.24.0，必须显式写。[CITED: https://nginx.org/en/docs/http/ngx_http_proxy_module.html，HIGH] PocketBase 官方 nginx 示例也有这两行 [CITED: https://pocketbase.io/docs/going-to-production/，HIGH] |
| `proxy_buffering off` | PocketBase 自己会发 `X-Accel-Buffering: no`（读 `apis/realtime.go`），nginx 默认遵守该头；但官方 nginx 示例没写关缓冲，所以我们显式关，不依赖上游的头。[CITED: raw.githubusercontent.com/pocketbase/pocketbase/v0.40.6/apis/realtime.go；nginx 文档“可以用 proxy_ignore_headers 忽略它”] |
| `proxy_read_timeout 3600s` | nginx 的读超时是“两次读之间”的间隔，默认 60 秒；PocketBase 对空闲连接 5 分钟断开、最长 30 分钟；官方 nginx/Caddy 示例用 360s。我们取 3600s 远大于两者，让断开只由 PocketBase 或网络决定，不由 nginx 决定。[CITED: nginx 文档；apis/realtime.go：`IdleTimeout = 5 * time.Minute`、`MaxTimeout = 30 * time.Minute`] |
| `gzip off`（SSE 位置） | `gzip_types` 默认只含 `text/html`，不会压 `text/event-stream`；显式关闭是为了以后有人加宽 `gzip_types` 时不会误压 SSE。[ASSUMED：属于防御性写法] |
| `X-Real-IP $remote_addr` | nginx 会覆盖客户端自带的同名头；PocketBase 的“用户 IP 代理头”设为 `X-Real-IP`（见迁移里的设置）。用 `X-Forwarded-For` 的话，客户端可以伪造最左边的值。[ASSUMED：属于通用反代做法；PocketBase 官方说要设置该项 [CITED: going-to-production]] |
| 三个 `^~` 的“404 位置” | 带 `^~` 的最长前缀命中后，nginx 不再检查正则位置，所以它们优先于 `location ^~ /api/`。`pbc_3142635823` 是 `_superusers` 集合的 id：源码里集合 id = `"pbc_" + crc32(类型 + 名称)`，我用 Node 的 `zlib.crc32("auth_superusers")` 算出 `pbc_3142635823`。PocketBase 的接口同时接受集合名和集合 id，所以只挡名字会被 id 绕过。[CITED: core/collection_model.go 的 `idChecksum`；VERIFIED: 本机计算] |
| `/probe/` 里重复写 `add_header` | nginx 的 `add_header` 只在当前层没有同名指令时才继承上层；这个位置自己写了 `Cache-Control`，所以必须把另外三条重复一遍。`/api/` 位置没有 `add_header`，会继承 server 层的三条。[ASSUMED：nginx 通用行为，未在本机验证；`verify.sh` 里用 `curl -I` 断言] |

**不动的东西：**不要碰 certbot 的 `listen … ssl`、`ssl_certificate*`、`options-ssl-nginx.conf`、`ssl_dhparam` 这几行，也不要在本阶段给 443 加 `http2`（那几行归 certbot 管理）。HTTP/3 没有启用，保持这样（UDP 443 在国内常被限速）。

### Pattern 2：PocketBase 的目录布局和 systemd unit

PocketBase 的默认钩子/迁移目录是 `--dir` 的上一级：`pb_data/../pb_hooks`、`pb_data/../pb_migrations`；`--publicDir` 默认是“可执行文件所在目录下的 pb_public”。[CITED: plugins/jsvm/jsvm.go、examples/base/main.go，v0.40.6] 所以把二进制和数据分开：

```
/opt/pocketbase/pocketbase            root:root 0755（程序本身对 pocketbase 用户只读：它不能改写自己，也不会被 `pocketbase update` 悄悄换掉）
/var/lib/pocketbase/                  pocketbase:pocketbase 0750
  ├── pb_data/                        数据库和日志（UMask 0077 → 文件 0600）
  ├── pb_migrations/                  迁移文件（自动迁移会往这里写）
  └── pb_public/                      空目录（nginx 不代理 `/`，保留给 Phase 13）
/var/www/usj/probe/                   root:root 0755，文件 0644（nginx 读）
```

```ini
# /etc/systemd/system/pocketbase.service
[Unit]
Description=PocketBase (probe site)
After=network.target

[Service]
Type=simple
User=pocketbase
Group=pocketbase
WorkingDirectory=/var/lib/pocketbase
ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir=/var/lib/pocketbase/pb_data --publicDir=/var/lib/pocketbase/pb_public --indexFallback=false --hooksWatch=false
Environment=GOMEMLIMIT=256MiB
Restart=always
RestartSec=5s
LimitNOFILE=4096
# 这台机器只有约 0.9 GB 内存、没有 swap：给 PocketBase 一个 cgroup 上限，并让它在内存紧张时先被杀（systemd 会重启它），而不是拖垮 nginx 和 sshd
MemoryHigh=320M
MemoryMax=400M
OOMScoreAdjust=300
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/pocketbase
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
```

| 项 | 取值与依据 |
|----|-----------|
| 监听 | `--http=127.0.0.1:8090`。`serve` 不带域名时默认就是 `127.0.0.1:8090`，显式写出来是为了让 unit 自己说明意图。[CITED: cmd/serve.go v0.40.6] |
| CORS | `--origins` 默认 `*`（允许任意来源）。探针站同源，不需要；令牌走 `Authorization` 头而不是 cookie，所以 `*` 不会带来跨站带凭据的请求。**探针期间保持默认**，Phase 13 再收紧到站点自己的 origin。[CITED: cmd/serve.go、apis/serve.go；MEDIUM] |
| `GOMEMLIMIT=256MiB` | 官方说它是软上限、会让 GC 更积极，示例值 512MiB。[CITED: going-to-production] 这台机器空闲时 `available` 约 480 MB（服务器只读检查：total 894、used 412、available 482、swap 0），所以取 256MiB 加 cgroup `MemoryHigh/MemoryMax` 兜底。PocketBase 空闲 RSS 的真实数字**官方没给**，STACK.md 也留作待测；脚本 S3 要量一次并写进结果文档。[ASSUMED：PocketBase 空闲约几十 MB] |
| `LimitNOFILE=4096`、`Restart=always`、`RestartSec=5s` | 官方 unit 示例的值。[CITED: going-to-production] |
| `--hooksWatch=false`、不带钩子 | 本阶段不用钩子，关掉文件监听；`--hooksPool` 默认值 15（预热 15 个 JS 运行时）在没有钩子文件时不会有实际负担，但不用就不用管它。[CITED: examples/base/main.go] |
| 沙箱项 | 都是 systemd 通用加固，不改变 PocketBase 行为；`ReadWritePaths` 之外都是只读。**没有加** `SystemCallFilter` 和 `MemoryDenyWriteExecute`，因为没有在这台机器上验证它们不会让 Go 运行时出问题。[ASSUMED：这些项在 Ubuntu 24.04 + Go 程序上可用，S3 的健康检查会暴露问题] |

### Pattern 3：超级用户创建（D-05）——先建用户，再启动服务

**事实：**`superuser create/upsert/update` 的邮箱和密码都是**必填的位置参数**，不能省略、不能交互输入、不能从 stdin 或环境变量读。[CITED: raw.githubusercontent.com/pocketbase/pocketbase/v0.40.6/cmd/superuser.go，MEDIUM：未在 0.41.1 上复核，0.41.x 的发布说明没有提到改动] 另有 `superuser ips`（设置 IP 白名单）、`superuser otp`。

**泄漏面逐个看：**

| 泄漏面 | 直接 `sudo pocketbase superuser upsert 邮箱 密码` | 推荐的包装写法 |
|--------|--------------------------------------------------|----------------|
| shell 历史 | 写进历史 | `read -rs` 读入变量，命令行里只有 `"$EM" "$PW"`；`bash -c` 是非交互的，不记历史 |
| sudo 日志 | **整条命令行（含密码）会被 sudo 记进 `/var/log/auth.log`** | sudo 只看见 `bash -c '…脚本文本…'`，脚本文本里没有密码 |
| `ps` / `/proc/<pid>/cmdline` | 可见 | 仍可见，但只有 PocketBase 进程运行的几百毫秒；机器上只有 `admin` 和 root，可接受 |
| PocketBase 日志 | 不记录参数 | 同左 |

[ASSUMED：sudo 默认会把完整命令行写进 auth 日志；这是 Ubuntu 默认配置下的常见行为，没有在这台机器上看日志验证——验证它会读到密码，所以**不要**为了验证而真的传一个密码]

```bash
# 所有者在阿里云网页终端里运行（D-05）。邮箱用你自己的管理员邮箱，密码用密码管理器生成的长随机串。
sudo -u pocketbase bash -c '
  IFS= read -r  -p "超级用户邮箱: " EM
  IFS= read -rs -p "超级用户口令（输入时不回显）: " PW; echo
  /opt/pocketbase/pocketbase --dir=/var/lib/pocketbase/pb_data superuser upsert "$EM" "$PW"
  unset EM PW
'
```

- 一定要带 `--dir=…`：不带的话 PocketBase 会去可执行文件旁边找 `pb_data`（`/opt/pocketbase/` 对 pocketbase 用户只读，会直接报权限错误，而不是悄悄建出一份“野”数据库）。执行后用 `ls -l /var/lib/pocketbase/pb_data` 确认 `data.db` 已出现。[ASSUMED：`--dir` 放在子命令前后都能被识别（它是根命令的持久标志，`eagerParseFlags` 在启动早期解析）；脚本里放在子命令前]
- 用 `upsert` 而不是 `create`：输错了可以再跑一遍覆盖密码。
- 邮箱要是格式合法的地址；密码长度下限由 `_superusers` 集合的 password 字段决定（源码里 CLI 本身不检查长度）。**建议 ≥ 16 位随机串。**[ASSUMED：字段下限约为 8]
- **顺序：先装好二进制和迁移目录 → 所有者建超级用户 → 再 `systemctl enable --now`。**这样服务启动时已有超级用户，不会在 journald 里打印一次性安装链接。CLI 在引导阶段会自动创建系统集合（含 `_superusers`），所以不需要先启动服务。[ASSUMED：CLI 的引导会跑系统迁移]
- **备选（不上命令行）：**先启动服务，所有者开 SSH 隧道，在浏览器打开启动日志里打印的 `/_/#/pbinstal/<令牌>` 链接，在表单里设密码。令牌是 JWT 形状，会出现在 journald 日志里，设置完毕后即失效。

### Pattern 4：探针集合与规则（迁移文件，可复现，不靠后台点）

迁移文件放 `pb_migrations/`，随 `serve` 启动自动执行；格式是 `migrate((app) => {…}, (app) => {…})`，用 `new Collection({...})` 和 `app.save()`，设置通过 `app.settings()` 修改后保存。[CITED: https://pocketbase.io/docs/js-migrations/，HIGH：官方示例里就有 `settings.logs.maxDays = 2; settings.logs.logIP = false;`]

**文件名时间戳**要大于 PocketBase 自带迁移，用部署时的 `date +%s`（今天约 1794092000）。

```js
// <ts>_probe_schema.js —— 模板，进仓库；不含任何凭据
migrate((app) => {
  // 1) 内置 users：关掉自助注册和自助删号（默认 createRule 为空字符串 = 任何人都能注册）
  const users = app.findCollectionByNameOrId("users")
  users.createRule = null
  users.deleteRule = null
  app.save(users)

  // 2) 探针结果：登录的探针账号只能新建，不能列出/查看/修改/删除
  app.save(new Collection({
    type: "base",
    name: "probe_results",
    listRule: null, viewRule: null, updateRule: null, deleteRule: null,
    createRule: '@request.auth.id != ""',
    fields: [
      { type: "text",   name: "run_id",  required: true, max: 40 },
      { type: "select", name: "carrier", required: true, maxSelect: 1, values: ["telecom", "unicom", "mobile", "us"] },
      { type: "select", name: "net",     required: true, maxSelect: 1, values: ["cell4g", "home", "other"] },
      { type: "select", name: "browser", maxSelect: 1, values: ["chrome", "safari", "edge", "firefox", "wechat", "other"] },
      { type: "text",   name: "started_at", max: 40 },            // ISO UTC 字符串
      { type: "number", name: "tz_offset_min", min: -840, max: 840 },
      { type: "number", name: "dur_s", min: 0, max: 3600 },
      { type: "text",   name: "nav_type", max: 20 },
      { type: "text",   name: "fs_src", max: 20 },                // fcp 或 dcl（取不到 FCP 时的回退）
      { type: "number", name: "first_screen_ms", min: 0, max: 600000 },
      { type: "number", name: "ttfb_ms", min: 0, max: 600000 },
      { type: "number", name: "load_ms", min: 0, max: 600000 },
      { type: "number", name: "dns_ms", min: 0, max: 600000 },
      { type: "number", name: "connect_ms", min: 0, max: 600000 },
      { type: "number", name: "tls_ms", min: 0, max: 600000 },
      { type: "number", name: "sdk_ms", min: 0, max: 600000 },
      { type: "number", name: "api_rtt_ms", min: 0, max: 600000 },
      { type: "number", name: "login_ms", min: 0, max: 600000 },
      { type: "bool",   name: "login_ok" },
      { type: "number", name: "rt_connect_ms", min: 0, max: 600000 },
      { type: "number", name: "hidden_ms", min: 0, max: 3600000 },
      { type: "number", name: "drops", min: 0, max: 1000 },
      { type: "number", name: "max_reconnect_ms", min: 0, max: 3600000 },
      { type: "number", name: "pings_ok", min: 0, max: 100 },
      { type: "number", name: "pings_total", min: 0, max: 100 },
      { type: "json",   name: "push_ms", maxSize: 4000 },
      { type: "json",   name: "events",  maxSize: 20000 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  }))

  // 3) 打点：探针账号可以新建，也可以订阅（订阅走 listRule）；只有合成数据
  app.save(new Collection({
    type: "base",
    name: "probe_pings",
    listRule: '@request.auth.id != ""', viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: null, deleteRule: null,
    fields: [
      { type: "text",   name: "run", required: true, max: 40 },
      { type: "number", name: "seq", min: 0, max: 100 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  }))

  // 4) 设置：日志只留 2 天、不记 IP；把 X-Real-IP 当作用户真实 IP；打开内置限流
  const s = app.settings()
  s.logs.maxDays = 2
  s.logs.logIP = false
  s.logs.logAuthId = false
  s.trustedProxy.headers = ["X-Real-IP"]
  s.rateLimits.enabled = true
  app.save(s)
}, (app) => {
  // 探针站点可以重装，不写回滚
})
```

**必须注意的细节：**

- **数字和布尔字段不要设 `required: true`**：PocketBase 里数字字段的“必填”意味着非零，`drops = 0`、`login_ok = false` 会被拒绝。上面只对 `run_id`、`carrier`、`net`、`run` 设了必填。[ASSUMED：这是 PocketBase 字段的已知行为，没有在 0.41.1 上验证；`verify.sh` 的第一条创建用例用 `drops=0` 就能暴露]
- **`settings.trustedProxy.headers`、`settings.rateLimits.enabled` 的 JS 属性名**：Go 结构体 `TrustedProxyConfig{Headers, UseLeftmostIP}`、`RateLimitsConfig{Enabled: false, …}`、`LogsConfig{MaxDays: 5, LogIP: true, …}` 的字段我读过（默认值 `MaxDays: 5`、`LogIP: true`，限流默认关闭、预置 4 条规则），但外层字段的 JSON 名没有读到，只有官方文档里的 `settings.logs.*` 被证实。[CITED: core/settings_model.go v0.40.6；ASSUMED：外层名为 `trustedProxy`、`rateLimits`] 执行后要验证（见 § 验证方式 V-12）。
- **限流默认规则**：`*:auth` 每 3 秒 2 次、`*:create` 每 5 秒 20 次、`/api/` 每 10 秒 300 次，按 IP 计。探针站点登录只做一次，不会误伤；但同一个出口 IP 后面有多人同时测（家宽 NAT、手机基站）时 `*:auth` 可能被碰到，表现是登录 429——遇到时把它记入结果的“已知限制”而不是调高阈值。[CITED: core/settings_model.go]
- `select` 字段的取值、`json` 字段的 `maxSize`、`autodate` 字段写法取自 STACK.md 和官方迁移示例，**第一次在真实 0.41.1 上执行**，所以 S3 的“迁移是否生效”要实际检查（V-11）。

**探针账号（只存在于服务器，不进仓库）：**脚本 S2 在服务器上用 `openssl rand -hex 16` 生成邮箱本地部分和密码，写成第二个迁移文件 `<ts+1>_probe_user.js`（权限 0600，属主 pocketbase），内容是 `new Record(users)` + `setEmail` + `setPassword` + `setVerified(true)` + `app.save`；同时生成 `/var/www/usj/probe/config.js`（`window.PROBE_CONFIG = {email: …, password: …}`）。**脚本不得把这两个值打印到终端或日志。**这个账号的口令本来就公开（任何打开探针页的人都能读到），所以它只是“限制了权限的合成账号”，权限就是上面三个集合的规则：只能创建结果、创建/订阅打点、读自己的用户记录。[CITED: 官方 js-records 文档的 `setEmail/setPassword/setVerified` 访问器]

### Pattern 5：探针页怎么测（D-09 的具体设计）

**先说清楚四个会让结果失真的事实（都来自读源码）：**

1. **PocketBase 的 SSE 没有心跳，空闲 5 分钟断开，最长 30 分钟。**服务器代码里 `connectEvent.IdleTimeout = 5 * time.Minute`（只有“送出一条消息”才重置计时）、`connectEvent.MaxTimeout = 30 * time.Minute`，到时调用 `cancelRequest()` 关闭连接；响应头只有 `Content-Type: text/event-stream`、`Cache-Control: no-store`、`X-Accel-Buffering: no`，没有心跳或 `Connection` 头。[CITED: apis/realtime.go v0.40.6，MEDIUM：0.41.x 未复核；官方 API 文档也写了“5 分钟没有新消息服务器会发断开信号” https://pocketbase.io/docs/api-realtime/，HIGH]。**后果：**安静地挂 10 分钟必然在第 5 分钟被服务器断开一次，那不是网络问题。
2. **SDK 自己管重连，原生 EventSource 的自动重连被关掉。**`RealtimeService` 在 `onerror` 里调用自己的 `connectErrorHandler`：先 `disconnect(true)`（这一步会在已有 `clientId` 时调用 `onDisconnect(订阅主题列表)`），再按 `[200, 300, 500, 1000, 1200, 1500, 2000]` 毫秒的退避重新 `initConnect`，之后一直 2000 毫秒；`maxReconnectAttempts = Infinity`；单次连接最多等 `maxConnectTimeout = 15000` 毫秒；每次重连成功都会再发一次 `PB_CONNECT`，SDK 随后重新提交订阅。[VERIFIED: 本机下载 npm 上 `pocketbase@0.28.2` 的 tarball（sha1 与 registry 的 `dist.shasum` 一致），读 `dist/pocketbase.es.mjs` 的 `RealtimeService` 类] 官方 README 也说明：可以订阅特殊主题 `PB_CONNECT` 来监听连接/重连事件，`pb.realtime.onDisconnect = function(activeSubscriptions)` 在“取消全部订阅、连接被中断或被服务器关闭”时调用。[CITED: SDK README，HIGH]
3. **“静默断线”SDK 和浏览器都看不见。**半开连接（对端已丢弃映射，本端 TCP 还以为连着）不会触发 `error` 事件，`pb.realtime.isConnected` 仍是 true。唯一能发现的办法是“期待一条消息但没有到”。所以探针页要主动“写一条、等自己的推送”。
4. **断线期间错过的事件不会补发**（官方文档没有说有回放；SDK 重连后只是重新订阅）。所以结果里要记“推送丢失”，这正是 Phase 10 要“重连后补拉”的依据。[CITED: api-realtime 文档只字未提回放；MEDIUM]

**测什么、用什么 API、要注意什么：**

| 指标（结果字段） | 取法 | 注意 |
|------------------|------|------|
| 首屏时间 `first_screen_ms` | 优先 `performance.getEntriesByName('first-contentful-paint')[0].startTime`；取不到（部分 WebView）就用 `performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd`，并把来源写进 `fs_src` | 页面是纯静态小页，FCP ≈ 首字节 + TLS + 往返；读它要在点“开始”时（此时绘制条目早已存在） |
| 分段耗时 `ttfb_ms/dns_ms/connect_ms/tls_ms/load_ms/sdk_ms` | Navigation Timing（`responseStart`、`domainLookupEnd-Start`、`connectEnd-Start`、`secureConnectionStart`、`loadEventEnd`）；SDK 文件用 `performance.getEntriesByName(SDK 的绝对地址)[0].duration` | 页面用 `Cache-Control: no-store`，每次冷加载；如果 `nav_type` 不是 `navigate`（刷新/前进后退）就在汇总时把这次标为“非冷加载” |
| 接口往返 `api_rtt_ms` | 连续 5 次 `fetch('/api/health', {cache:'no-store'})`，取中位数；样本数组一并上传 | 用来把“登录慢”拆成“网络慢”还是“服务器算密码哈希慢” |
| 登录耗时 `login_ms`、`login_ok` | `performance.now()` 夹住 `await pb.collection('users').authWithPassword(邮箱, 口令)`；开始前 `pb.authStore.clear()` | 必须每次真登录，不能复用 localStorage 里残留的令牌 |
| 实时建连 `rt_connect_ms` | 从第一次 `subscribe` 到第一次收到 `PB_CONNECT` | — |
| 掉线与重连 `drops`、`max_reconnect_ms`、`events[]` | `pb.realtime.onDisconnect` 记 `drop`（相对开始的秒数）；`PB_CONNECT` 订阅里，如果有未配对的 drop 就记 `reconnect` 和 `ms = 现在 - drop 时刻` | 这里的 drop 是“SDK 注意到的时刻”，不是网络真正断开的时刻；静默断线靠下一条 |
| 推送延迟与丢失 `push_ms[]`、`pings_ok/pings_total` | 在第 15、45、105、195、315、495 秒各 `create` 一条 `probe_pings`（带本次 `run_id` 和序号），自己订阅 `probe_pings`（过滤 `run = 本次 run_id`），记“从发起 create 到收到事件”的毫秒数；15 秒内没收到记 `lost` | 间隔 30、60、90、120、180 秒：逐步拉长安静期，找出“安静多久之后推送开始丢”。最长间隔 180 秒仍小于 PocketBase 的 5 分钟空闲断开，所以**不会**被服务器空闲断开干扰（第 315 秒的那条打点会重置空闲计时） |
| 页面是否一直在前台 `hidden_ms` | `visibilitychange` 累计不可见时长；并尝试 `navigator.wakeLock.request('screen')` | 手机锁屏/切后台会让浏览器冻结脚本、回收连接。`hidden_ms > 0` 的运行在汇总时不算有效 |

**打点节奏的理由：**这正是 Phase 10 的真实场景：设备 A 保存、设备 B 收到推送。探针账号“自己写、自己收”走的是和真实应用完全相同的路径（HTTP 写入 → 记录规则判定 → SSE 推给订阅者），而且不需要任何服务器端钩子或定时任务。

**判定（对应 D-06、D-07），写在汇总脚本里：**

| 项 | 单次运行“达标”的条件 |
|----|--------------------|
| 首屏 | `first_screen_ms ≤ 5000` |
| 登录 | `login_ok` 且 `login_ms ≤ 3000` |
| 实时 | **连续型**：`drops == 0` 且 6 条打点全部 `ok`；**重连型**：`drops > 0`，每次重连 `ms ≤ 10000`，且所有打点都 `ok`；其余（重连超过 10 秒、本次结束时仍未恢复、任何一条打点 `lost`、从未连上）算不达标 |
| 有效运行 | `dur_s ≥ 590`、`hidden_ms == 0`、`nav_type == 'navigate'`、成功上传（或截图转录） |

**“大多数次数达到”的量化（D-06 的操作化，规划者需让所有者确认，见 Open Questions）：**按“运营商 × 网络类型”分组，在有效运行里统计达标比例：**≥ 2/3 为合格，> 1/2 且 < 2/3 为“临界”，≤ 1/2 为不合格**。因为 D-08 说不论结果都不换服务商，这个分级只用来决定“已知限制”和 Phase 10 的兜底参数，不决定去留。[ASSUMED：2/3 是我的操作化选择]

**页面骨架（只列出需要核对的关键调用，不是完整源码）：**

```js
// 探针页：所有地址都是相对的，不写域名。SDK 先于本脚本加载（<script src="vendor/pocketbase.iife.js">）。
const pb = new PocketBase('/');          // 同源
pb.autoCancellation(false);               // 否则连续请求会互相取消 [CITED: SDK README]
const RUN_ID = Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('');
const t0 = performance.now();
const sec = () => Math.round((performance.now() - t0) / 100) / 10;
const events = [];
let dropAt = null, firstConnectAt = null;

pb.realtime.onDisconnect = () => { dropAt = performance.now(); events.push({ k: 'drop', t: sec() }); };

await pb.realtime.subscribe('PB_CONNECT', () => {          // 首次连接和每次重连都会触发
  const now = performance.now();
  if (firstConnectAt === null) { firstConnectAt = now; return; }
  if (dropAt !== null) { events.push({ k: 'reconnect', t: sec(), ms: Math.round(now - dropAt) }); dropAt = null; }
});

const pending = new Map();                                  // seq -> { sentAt, recvAt }
await pb.collection('probe_pings').subscribe('*', (e) => {
  if (e.action !== 'create') return;
  const p = pending.get(e.record.seq);
  if (p && p.recvAt === undefined) p.recvAt = performance.now();
}, { filter: pb.filter('run = {:r}', { r: RUN_ID }) });

for (const [seq, at] of [15, 45, 105, 195, 315, 495].entries()) {
  setTimeout(async () => {
    const p = { sentAt: performance.now() }; pending.set(seq, p);
    try { await pb.collection('probe_pings').create({ run: RUN_ID, seq }); } catch (err) { p.err = true; }
  }, at * 1000);
}
// 600 秒后：算汇总 → 屏幕显示（不显示主机名）→ 上传 probe_results（失败重试 3 次，仍失败就显示“上传失败，请截图”）
```

- 订阅里的 `filter` 选项是 SDK README 记载的写法；服务端会对每条事件再核对一次过滤条件。[CITED: SDK README；apis/realtime.go 的 `realtimeCanAccessRecord`，MEDIUM]
- `PB_CONNECT` 作为订阅主题会被 SDK 当成普通订阅键一起提交；官方 README 明确说可以这样用。[CITED: SDK README]
- 缓冲或超时的验证不靠页面，靠 `verify.sh` 里的 curl 检查（见下）。

**隐私：**结果里只有数字、枚举和随机 `run_id`；不收集 IP（页面拿不到，PocketBase 也设了 `logIP=false`）、不收集 User-Agent 原文（只上传 `browser` 粗分类）、不提供自由文本字段、不记录测试人是谁（运营商和网络类型由测试的人选择，姓名不进系统；测试人的对应关系由所有者在自己的记录里管理）。PocketBase 请求日志默认会记 `url`、`method`、`status`、`referer`、`userAgent`（读 `activityLogger` 源码），所以日志保留设成 2 天；`userAgent` 无法关闭，只能靠短保留。[CITED: apis/middlewares.go v0.40.6；core/settings_model.go：`MaxDays: 5`、`LogIP: true` 是默认值]

## 安装与配置顺序（拆成所有者可逐个批准的脚本）

**通用约定（D-04）：**每个脚本在仓库里是 LF 行尾的 `.sh`；Claude 先把脚本全文发给所有者，所有者回复“可以”后，Claude 用 `ssh -o BatchMode=yes usj 'bash -s' < 脚本` 执行（在 Git Bash 里；PowerShell 不支持 `<` 重定向），把输出报告给所有者。脚本开头 `set -euo pipefail`，**不得 `set -x`、不得回显任何口令**。只读检查（版本、状态、日志、监听端口、磁盘、内存）不需要批准。

| 步骤 | 内容 | 谁做 | 需要批准 |
|------|------|------|----------|
| **S0** 预检（只读） | `sudo -n true`（D-04a）、`free -m`、`df -h /`、`ss -ltn` 确认 8090 空闲、`nginx -t`、`systemctl is-active nginx certbot.timer`、`id pocketbase`（应不存在）、`command -v unzip`（已测：缺） | Claude | 否 |
| **S1** `01-install-pocketbase.sh` | `apt-get install -y unzip`；建系统用户 `pocketbase`（`useradd --system --user-group --home-dir /var/lib/pocketbase --no-create-home --shell /usr/sbin/nologin`）；建目录并设属主；`mktemp -d` 里 `curl -fsSL --proto '=https' --tlsv1.2` 下载 zip 和 `checksums.txt`；**核对 1：钉死的哈希；核对 2：与 checksums.txt 一致**，任一不符立即中止；解压出 `pocketbase`，`install -o root -g root -m 0755` 到 `/opt/pocketbase/`；`/opt/pocketbase/pocketbase --version` 必须含 `0.41.1`；清理临时目录 | Claude（sudo） | **是** |
| **S1b** 留一份离线副本 | 把验证过的 zip 通过 `scp` 取回本机，放进被忽略的 `private/`（STACK.md 的建议：zip 在服务器之外留一份） | Claude | 是（含在 S1 批准里即可） |
| **S2** `02-configure-pocketbase.sh` | 先把 `tools/probe/server/` 用 `tar | ssh` 传到服务器的 `/tmp/usj-probe-upload/`；安装 `pocketbase.service`（不启动）；用 `date +%s` 给迁移文件命名并安装 `probe_schema.js`；生成探针账号和 `probe_user.js`（0600，pocketbase 属主）与 `/var/www/usj/probe/config.js`——**不打印**；`chown`/`chmod` | Claude（sudo） | **是** |
| **S2b** 建超级用户（D-05） | 所有者在阿里云网页终端运行 § Pattern 3 的 `sudo -u pocketbase bash -c '…'`。Claude 看不到口令。完成后 Claude 只读确认 `pb_data/data.db` 存在 | **所有者** | 不适用（所有者自己运行） |
| **S3** `03-start-pocketbase.sh` | `systemctl daemon-reload && systemctl enable --now pocketbase`；等待 `curl -fsS http://127.0.0.1:8090/api/health`；`ss -ltnH` 确认 8090 只绑 `127.0.0.1`；`journalctl -u pocketbase -n 40 --no-pager`（检查没有口令/令牌）；`systemctl show pocketbase -p MemoryCurrent`、`ps -o rss,cmd -C pocketbase` **量一次真实内存**，写进结果文档 | Claude（sudo） | **是** |
| **S4** `04-nginx-pocketbase.sh` | 带时间戳备份默认站点文件；安装 `conf.d/usj-probe.conf` 和 `snippets/usj-probe-locations.conf`；断言锚点恰好匹配 1 行后追加一行 `include`；`nginx -t`，失败则恢复备份；`systemctl reload nginx`（reload，不是 restart）；**`certbot renew --dry-run` 必须成功**，失败则恢复备份并 reload | Claude（sudo） | **是** |
| **S5** `05-install-probe-page.sh` | 把 `page/` 文件装到 `/var/www/usj/probe/`（`root:root`、目录 0755、文件 0644；`config.js` 已在 S2 生成，不覆盖）；跑 `verify.sh`（见 § 验证方式） | Claude（sudo） | **是** |
| **S6** `06-swap.sh`（可选，建议） | `fallocate -l 1G /swapfile && chmod 600 && mkswap && swapon`，写入 `/etc/fstab`；**不改** `vm.swappiness`（当前为 0，意味着只在极端内存压力下才用 swap，正合适） | Claude（sudo） | 是；所有者可拒绝 |
| **S7** 所有者确认控制台防火墙 | 阿里云控制台里只开 22/80/443（以及按需 ICMP），**8090 不在列表里**。Claude 看不到这一层，只能做“从外面连 8090”的反向验证（见 V-13） | **所有者** | 不适用 |

**回滚：**S4 失败自动恢复备份；S1–S3 的回滚是 `systemctl disable --now pocketbase && rm -f /etc/systemd/system/pocketbase.service`，保留 `/var/lib/pocketbase`（其中只有合成数据，Phase 13 本来就要重装）。**不要**在探针期间对服务器重启，S3 之后用 `systemctl is-enabled pocketbase` 确认会开机自启即可（真重启验证属于 Phase 13 的成功标准）。

**不要用的东西：**`pocketbase update`（升级来源和校验方式刚变过，不在生产机上随手运行）；PM2（D-03）；`serve <域名>` 自带 HTTPS（nginx 已占 80/443）。

## 实测方法和结果表（D-06、D-07、D-10）

### 实测前的准备（Claude 做，不要求所有者在场）

- 用 `verify.sh` 在服务器本机和本地 PC 各跑一遍，全部通过后才通知所有者开始组织测试。
- 所有者先自己用探针页的 `?dur=90` 参数跑一遍短测试（只用于确认流程；`dur_s < 590` 的结果汇总时自动不算有效）。
- 测试说明（一页中文，不含域名，由所有者发给测试的人，域名链接由所有者私下给）：打开链接 → 用**系统自带浏览器或平时常用的浏览器**，每次新开标签页或无痕窗口 → 选运营商和网络类型 → 点“开始” → **10 分钟内不要锁屏、不要切后台、不要换网络** → 看到摘要后截图（截图里不要带地址栏，因为域名不能进仓库）→ 结果会自动上传。

### 怎么测

| 项 | 做法 |
|----|------|
| 时段 | 北京时间 20:00–23:00（2026-11 美国已退回标准时间，北京 20:00 = UTC 12:00 = 美西 04:00、美东 07:00）。**美国测试人**建议两种都做：美国本地晚高峰（20:00–23:00 本地时间，对应跨太平洋链路的美国高峰）为主；如果方便，再在北京晚高峰时段（美国早晨）补一次。结果里 `started_at` 和 `tz_offset_min` 能区分。[ASSUMED：美国“晚高峰”按其本地时间理解，D-10 没有细说] |
| 夜数 | 至少 3 个晚上，**其中至少 1 个是周五或周六晚**（周末晚高峰通常更拥挤）[ASSUMED：经验判断] |
| 每晚次数 | 电信、联通、移动各至少 2 次，间隔 ≥ 30 分钟（一次约 12 分钟含准备）；尽量一次手机 4G、一次家宽，3 个晚上里两种网络都要出现；美国至少 2 次 |
| 最低总量 | 大陆 ≥ 3 夜 × 3 家运营商 × 2 次 = 18 次，美国 ≥ 6 次；有效运行数不足时在结论里写明“样本不足” |
| 可选加测 | 每晚每人一次“微信内置浏览器”打开（`browser = wechat`），因为大陆用户很可能这样打开链接（PITFALLS.md Pitfall 14 记为未验证）。只做诊断，不计入合格判定 |
| 记录什么 | 每次运行自动上传到 `probe_results`；上传失败时页面显示摘要文字，由测试的人截图，所有者转录。**上传失败本身也是一条数据**（记在结论里） |

### 多点测速站基线（D-10 的“另外”那一次）

- **工具：**itdog.cn 的“HTTP 测速”“tcping”“ping”“路由追踪”，以及 17ce、boce 这类多点站。itdog 提供多地 ping、tcping、网站测速、HTTP 测速、路由追踪、在线 MTR，结果可按节点、地区和运营商查看。[CITED: 搜索结果引用 W3Techs 对 itdog.cn 的功能描述及掘金文章，MEDIUM；官方页面直接抓取返回 403，没有读到官方说明]
- **做法：**对探针页地址（HTTPS）各跑一次 HTTP 测速，对域名跑 ping 和 tcping(443)；记录**每个运营商分组**的节点数、总耗时中位数和 P90、失败节点数、ping 丢包中位数。
- **要如实写的局限：**这类节点多半是机房/云主机，不是家宽和手机基站，所以它是“线路大体健康吗”的粗基线，**不能代替**真人测试；站点会在 nginx 的探针日志里留下大量命中（日志无 IP）。ICMP 是否被阿里云控制台防火墙放行我没能确认（官方文档只确认默认开放 22、80、443，没提 ICMP 默认是否开放）——如果 ping 全部 100% 丢包而 tcping 正常，先检查控制台是否放行了 ICMP，不要直接判定线路差。[CITED: https://www.alibabacloud.com/help/en/simple-application-server/network-security01；ICMP 默认状态 ASSUMED 未知]
- **截图与原始输出不进仓库：**这些工具的结果页会显示域名和服务器 IP。只把转录后的汇总数字写进结果文档。

### 美国侧 mtr

- Linux/macOS：`mtr -rwzbc 100 <域名>`（报告模式、显示 AS 号、100 轮；ICMP 需要 root，macOS 用 `sudo`）；Windows：`pathping -n -q 50 <域名>`。再用 `mtr -rwTP 443 -c 100 <域名>` 补一次 TCP 443 版本（一些中间设备对 ICMP 限速，TCP 更接近真实）。[ASSUMED：命令行参数取自 mtr 通用用法，未在本机运行]
- **只记录：**最后一跳的丢包率、平均/最好/最差毫秒、跳数、沿途 AS 号序列；**不要把完整输出贴进仓库**（里面有服务器 IP 和测试人的首跳地址）。

### 数据怎么变成汇总表

1. `export-results.py`（服务器上只读）：`sudo python3 -I - < export-results.py`，用 `sqlite3.connect('file:/var/lib/pocketbase/pb_data/data.db?mode=ro', uri=True)` 查询 `probe_results`，输出 JSON 数组。（PocketBase 把 `json` 字段存成文本；探针账号读不了这个集合，所以要走数据库文件，或所有者经 SSH 隧道登录后台导出。）[ASSUMED：只读打开正在被 PocketBase 使用的 WAL 数据库、并以 root 身份读取，可以工作；如果报错，改用后台导出]
2. 本机 `node tools/probe/summarize.mjs results.json > 06-PROBE-RESULTS.md`：纯函数（分组、中位数/P90、达标判定、判定分级、表格生成），带 `--self-test`（合成输入覆盖每条判定边界：首屏 5000 ms 的边界两侧、登录 3000 ms、重连 10000 ms、drop 为 0、`hidden_ms > 0` 被剔除、`dur_s < 590` 被剔除、分级 2/3 与 1/2 的边界）。
3. 原始 JSON 里没有 IP、域名和个人信息，可以和汇总表一起提交；放进仓库前仍然要过 `privacy-check.mjs --staged`。

### 结果文档的格式（`.planning/phases/06-procurement-reachability-probe/06-PROBE-RESULTS.md`）

```
# 探针实测结果（不含服务器地址和域名）

## 结论（D-08）
- 实测结果：…（每个运营商一句话，引用下表）
- 已知限制：…（例如“联通 4G 在第 2 晚出现 2 次 >10 秒的重连”“空闲 ≥120 秒后推送丢失率 X%”）
- 做过的调整：…（nginx 关缓冲/长超时的参数、是否因实测改过；若无写“无”）
- 给 Phase 10 的输入：重连后必须补拉（SDK 不回放事件）；兜底轮询建议间隔 = …（规则：任何运营商在“安静 ≥120 秒”之后出现打点丢失 → 页面可见时每 60 秒轮询一次；全部通过 → 120–180 秒）
- 给 Phase 13 的输入：服务器空闲内存 …、PocketBase 空闲 RSS …、证书续期 dry-run 结果 …、控制台防火墙确认 …

## 表 1：按运营商 × 网络类型的达标情况
| 运营商 | 网络 | 有效/总次数 | 首屏中位(P90) ms | 首屏达标率 | 登录中位(P90) ms | 登录达标率 | 实时达标率 | 掉线总数 | 最大重连 ms | 打点丢失 | 判定 |
## 表 2：逐次运行明细（run_id 取前 4 位）
| 夜 | 本地时刻 | 运营商 | 网络 | 浏览器 | 首屏 | 登录 | 接口RTT | 建连 | 掉线 | 最大重连 | 打点 ok/总 | 推送中位 ms | 有效 | 判定 |
## 表 3：多点站基线（转录）
| 工具 | 运营商分组 | 节点数 | HTTP 总耗时中位/P90 ms | 失败节点 | ping 丢包中位 % |
## 表 4：美国侧 mtr 摘要
| 测试方式 | 最后一跳丢包 % | 平均/最好/最差 ms | 跳数 | 备注 |
## 附：上传失败、异常、样本不足的说明
```

## SEC-03 隐私规则设计（D-11、D-12）

### 现状（逐字引用，规划时按它的格式扩展）

- 规则表：`export const RULES = { A: 'A-forbidden-path', B: 'B-abs-path', C: 'C-email', D: 'D-plan-term', E: 'E-author-email' };`（`tools/privacy/privacy-check.mjs:44-50`）。[VERIFIED: 本会话 Read 该文件]
- 路径规则 `checkPath(path)`（第 54–71 行）：返回字符串原因或 `null`；结尾有 `if (base.startsWith('.env')) return '环境变量文件不能进入仓库'; return null;`。
- 内容规则在 `scanText(location, text, terms)`（第 151–174 行）里逐行跑规则 B、C、D，返回 `{ location, rule, message }`，`location` 形如 `文件:行号`；`formatFinding(f)` 输出 `` `${f.location} [${f.rule}] ${f.message}` ``（第 210–212 行）。**命中的原文从不进入 message**（规则 D 只输出 `#N`，规则 B 把用户名显示成 `<用户名>`，规则 C 只留首字母）。
- 规则 D 的词条来自 `loadPlanTerms()`：先读 `private/plan-seed.json` 再叠加 `private/denylist.txt`（`PLAN_TERM_SOURCES = [SEED_FILE, DENYLIST_FILE]`，第 42 行）；匹配是 `line.includes(terms[t])`（第 167 行，**区分大小写**）；`parseDenylist` 把 `#` 之后当注释、空行忽略（第 310–317 行）。
- 自检框架：`runSelfTest()` 里 `expect(name, ok)` 累计，样本在运行时用 `join` 拼接，源码里不出现完整命中字面量；当前 `--self-test` 实测输出“自检通过：100 项”。[VERIFIED: 本会话运行，输出同时显示规则 D 已加载 68 个词条——我没有读取词条内容]
- 自身必须通过自己的检查：文件头注释写明“本文件自身必须能通过 --staged 和 --all，且不靠豁免自己”。

### 新增和扩展（原型已验证，61 条用例全过；误报扫描见下）

**规则 F `F-token-shape`（PocketBase/JWT 令牌形状）**

```js
// 三段 base64url，前两段以 eyJ 开头（即 {" 的 base64），签名段 ≥10 位
const JWT_RE = /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/;
```

- 命中输出：`位置 [F-token-shape] 疑似令牌（JWT 形状）`，不带任何字符。
- 放行：没有签名的 JWT 形状（`header.payload.` 尾段为空）不拦——真令牌总带 43 位签名；两段式、`eyJ...` 省略写法不拦。
- **对后续阶段的约束：**Phase 8 的假服务器要“做成带 `exp` 的 JWT 形状”（ARCHITECTURE.md Q7）。夹具和测试源码里**不能写出完整字面量**，必须在运行时用 `Buffer.from(JSON.stringify(…)).toString('base64url')` 拼接，签名段用空串或在运行时生成，沿用 `privacy-check.mjs` 自检的写法。

**规则 G `G-secret-assign`（写着真实值的密码类配置）**

四种形状 + 一个私钥头，**命中后再过占位判断**：

| 形状 | 正则要点 | 例子（用占位写，实际用例在运行时拼接） |
|------|----------|----------------------------------------|
| 引号字面量 | 键名含 `password/passwd/pwd/secret/encryption_key/api_key/private_key/access_key`（大小写不敏感），后跟 `:` 或 `=`，值是 `"…"` 或 `'…'`（**不含反引号**） | JSON `"adminPassword": "<值>"`、JS `{ password: "<值>" }`、`password='<值>'` |
| 环境变量/systemd | 行首可带 `export ` 或 `Environment=`，键名**全大写**且含上述词，`=` 后是裸值 | `PB_ENCRYPTION_KEY=<32位>`、`ADMIN_PASSWORD=<值>`、`Environment="PB_ENCRYPTION_KEY=<值>"` |
| ini/yaml 裸值 | 行首键名含上述词，`:` 或 `=` 后是不含空白/引号/逗号的裸值并**独占行尾** | `db_password: <值>`、`password = <值>` |
| PocketBase 命令行 | `superuser (create\|upsert\|update) <邮箱> <口令>`，第二个参数不是占位 | 文档里写成 `superuser upsert <EMAIL> <PASSWORD>`（占位，放行） |
| 私钥块 | `-----BEGIN … PRIVATE KEY-----` | — |

**占位放行表（`isPlaceholder`）：**长度 < 6；整体是 `<…>`；`***`、`xxx`、`...`、`…`；以 `$变量`、`${…}`、`$(…)` 开头，`{{…}}`，`%VAR%`；含 `change_me/changeme`、`placeholder`、`redacted`、`dummy`、`your-/your_`；`null/undefined/true/false/none`；含 `process.env`、`os.environ`、`getenv`。裸值如果形如属性访问（`input.value`）也放行（它是代码表达式，不是字面量）。

**为什么引号里不包括反引号：**第一版把反引号当引号，扫到 `.planning/research/PITFALLS.md` 第 260 行的 markdown 行内代码 `` `PB_ENCRYPTION_KEY=` `` 而误报 1 处；去掉反引号后归零。真正用模板字符串写死口令的情形很少见，且模板里带 `${}` 本来就算占位。

**规则 A 扩展（路径）**——扩展现有 `checkPath`，不另起规则编号（D-12 的三类路径都是“不许进仓库的文件”）：

```js
const DB_EXT = /\.(db|db-wal|db-shm|db-journal|sqlite|sqlite3)$/i;
const ARCHIVE_EXT = /\.(zip|tar|tgz|gz|bz2|xz|7z|rar)$/i;
// 段名 pb_data / pb_backups；数据库扩展名；任何压缩包；名为 pocketbase 或 pocketbase.exe 的文件
```

- **不要用“backup”这个词拦路径：**仓库已跟踪 `tests/fixtures/legacy-positional-backup.json`（合成的旧格式备份样例），按词拦会误杀它。按**扩展名**拦压缩包（备份几乎总是压缩包），按**目录名**拦 `pb_data`/`pb_backups`。已有的规则 A 里 `备份*.json` 的老规则保持不变。
- **不要拦 `pb_migrations/`、`pb_hooks/`、`pb_public/`：**迁移文件正是要进仓库的（Phase 8）。
- 仓库目前没有任何压缩包或数据库文件，所以“拦所有压缩包”今天零误伤；将来确需提交压缩包时应该是显式决定，而不是靠豁免。
- `.gitignore` 同步加：`pb_data/`、`pb_backups/`、`*.db`、`*.db-wal`、`*.db-shm`、`*.sqlite`、`*.sqlite3`、`/pocketbase`、`pocketbase.exe`、`pocketbase_*.zip`，以及探针生成物 `tools/probe/page/config.js`。（注意 `.gitignore` 里不能写裸的 `pocketbase`，否则会连目录 `tools/pocketbase/` 一起忽略。）

**可选规则 H（建议但不是 D-12 的要求）——公网 IPv4 形状：**对“非回环、非私网、非文档保留段”的点分十进制地址报警。我对 210 个被跟踪文件做了只数不看的扫描：除回环/`0.0.0.0` 外，**命中 0**（回环/any 共 199 处，需放行）。它能在本机没有 `private/denylist.txt` 时兜底。风险：浏览器版本串里偶尔有 `156.0.0.0` 这种四段数字；先放行 `127/8`、`0.0.0.0`、`10/8`、`172.16/12`、`192.168/16`、`169.254/16`、`192.0.2/24`、`198.51.100/24`、`203.0.113/24`。[VERIFIED: 本机扫描，2026-11-07]

### 误报实测（只数不看）

对 `git ls-files` 的 **210 个**文件（全部是文本）用原型规则逐行扫描：规则 F 命中 0，规则 G 命中 0，路径扩展命中 0。第一版（含反引号）曾在 1 处 markdown 行内代码上误报，已修正。**新装的 PocketBase SDK `dist/pocketbase.iife.js` 和 `pocketbase.es.mjs` 对现有规则 B/C/D 和新规则 F/G 都是 0 命中**，可以放心提交进 `tools/probe/page/vendor/`。[VERIFIED: 本机运行，2026-11-07]

### 规则 D 的自检（D-11）

现有 `--self-test` 的“实时词条自检”只在本机有 `private/` 时才运行，没有 denylist 的克隆上会跳过——**所以“这条通路确实能拦住域名和 IP”从来没有被确定性地证明过**。补充一组不依赖真实文件的用例（样本全部运行时拼接，只用文档保留的合成值）：

| 用例 | 期望 |
|------|------|
| `parseDenylist("# 注释\n<合成IP> # 服务器\n<合成域名>\n")`，其中合成 IP 取 TEST-NET-3（`203.0.113.x`）、合成域名取 `*.example` | 解析出 2 个词条 |
| `scanText('f', 'ssh <合成IP> ...', terms)` | 恰好 1 条规则 D，消息以 `#1` 结尾，且输出里不含该 IP |
| `scanText('提交说明', 'https://<合成域名>/probe/', terms)` | 命中 `#2`，输出里不含该域名（提交说明也是走 `scanText`，所以这条同时证明提交说明被拦） |
| 大小写变体 `HTTPS://<合成域名大写>/` | **当前实现不会命中**（`includes` 区分大小写）。建议把规则 D 的比较改为小写化后再 `includes`（对中文词条无影响）；自检里同时放一条“大写域名必须命中” |
| 不相关地址 `203.0.114.7` | 不命中 |
| 用临时目录里的 `private/denylist.txt` 走 `loadPlanTerms`（需要把 `loadPlanTerms` 改成接受 `roots` 参数，默认行为不变） | 词条被加载，`seedFound` 为假 |

**局限（要写进 PRIVACY.md）：**D 规则是子串匹配，所以“IP 的不同写法”（带前导零、十六进制、拆成多段）和“把域名拆开写”都拦不住；IPv6 地址要所有者**手动**加进 denylist（服务器 nginx 监听了 `[::]:443`，如果域名有 AAAA 记录或实例有公网 IPv6，也要加）。真正的保护是“不要把这些值写进任何被跟踪的文件”，规则只是最后一道网。

### 钩子证据（成功标准 1：“pre-commit 和 pre-push 都会失败”）

两个钩子只调用检查器（`.githooks/pre-commit` 末尾是 `exec node tools/privacy/privacy-check.mjs --staged`），**不用改钩子**（Phase 7 D-13）。想直接证明 SC1，建议加一个一次性演练脚本：在 `os.tmpdir()` 里 `git init` 一个临时仓库，复制检查器和 `.githooks`，设 `core.hooksPath`，分别暂存“含 JWT 形状”“含密码赋值”“`pb_data/x.db`”“含合成域名（临时 denylist）”四种违规，断言 `git commit` 失败；再用本地裸仓库做 `git push`，断言 pre-push 失败。演练用到的所有违规样本在运行时生成。[ASSUMED：演练脚本的复杂度可接受；若规划者觉得太重，可只保留 `--self-test`]

### PRIVACY.md 要同步的内容

§ 2 的表加两行（数据目录/数据库/压缩包；令牌和密码赋值），§ 3 规则列表加 F、G（以及 H，如采纳）和规则 A 的扩展说明，§ 3 “输出不会泄露内容”加一句 F、G 只输出位置和固定文案；§ 5 加“规则 D 的局限与 IPv6 提醒”；加一小节“夹具里怎么写假令牌和假口令”（运行时拼接，或写成 `<…>` 占位）；`.gitignore` 的注释指回 PRIVACY.md。

## D-01 文档更新的落点（已定位，不含真实值）

| 文件 | 位置 | 要改成 |
|------|------|--------|
| `.planning/PROJECT.md` | 第 28 行（目标里的部署）、第 172 行（Constraints 的“部署”）、第 210–211 行（Key Decisions：腾讯云和 `.com` 两条） | 阿里云轻量应用服务器香港；Porkbun 托管的 `.vip` 域名；Key Decisions 记录“服务商以所有者实际购买为准”（D-01/D-08） |
| `.planning/REQUIREMENTS.md` | 第 12 行 INFRA-01，第 13 行 INFRA-02（“作为是否续费或换商家的依据”） | INFRA-01 改成阿里云香港和 `.vip`；INFRA-02 改成“作为 Phase 10/13 的输入”（D-08） |
| `.planning/ROADMAP.md` | Phase 6 的 Goal（第 56 行“在 1 个月试用期内决定续费还是换商家”）、成功标准 2（第 61 行）、成功标准 4（“继续用香港、改东京，或换商家”）、Notes（`/_/` 那条见下）；Phase 13 的 Notes（第 224 行 Caddy 参数）和 Research 行（第 222 行提到 Caddy） | 按 D-01、D-02、D-08 改；Phase 13 的 nginx 参数以本阶段验证过的为准 |
| `.claude/CLAUDE.md` | 第 23 行（Constraints 里的“部署”） | 用 `generate-claude-md` 只重新生成 Project 段 |

`.planning/research/*.md`（STACK、ARCHITECTURE、PITFALLS）是里程碑调研的历史记录，里面还写着 Caddy 和腾讯云；建议**不改**，在 Phase 13 的规划里以本文件和 D-02 为准。若规划者想避免误导，可在这三个文件顶部各加一行“部署部分已被 Phase 6 CONTEXT 的 D-01/D-02 取代”。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE 客户端、重连、重新订阅 | 自己写 `EventSource` 包装和退避 | PocketBase SDK 0.28.2 的 `pb.realtime` | SDK 已有 `[200…2000]ms` 退避、15 秒连接超时、`PB_CONNECT` 事件、重连后重提订阅；自己写要重新踩一遍 `clientId`/订阅提交的竞态（SDK 0.27.1 的更新日志专门修过一个） |
| 密码哈希、令牌签发 | 任何自制认证 | PocketBase 内置认证（探针账号走 `users`） | 探针页只负责“带着公开的合成口令登录” |
| 创建用户/集合/规则/设置 | 手工在后台点 | 迁移文件（`pb_migrations/*.js`） | 可复现、可评审、探针站点重装时一键恢复 |
| 证书申请和续期 | 自写脚本 | 已有的 certbot + `certbot.timer` | 已通过 `renew --dry-run`；本阶段只保证改 nginx 之后它仍通过 |
| 静态文件服务、压缩、缓存头 | PocketBase 的 `pb_public` 或自写服务 | nginx 的 `root` + `gzip` | 一个现成的位置块 |
| 首屏和分段耗时 | 自己用 `Date.now()` 打点 | 浏览器 Navigation Timing 和 Paint Timing | 能拿到 DNS、TCP、TLS、首字节的真实分段 |
| 进程守护、开机自启、内存上限 | PM2 或 `nohup` | systemd 的 `Restart=always`、`MemoryMax` | D-03 禁用 PM2 |
| 汇总统计 | 引入统计库 | 20 行的中位数/P90 纯函数 + `--self-test` | 数据量只有几十条；零依赖是仓库约定 |
| 令牌和密码识别 | 解析或验证 JWT、做熵检测 | 形状正则 + 占位放行表 | 目标是“拦下形状”，不是判断真假；熵检测在合成数据上误报高 |

**Key insight:**这个阶段的风险几乎全在“配置细节”，不在“代码量”——nginx 的上游 HTTP 版本、sudo 的命令日志、`_superusers` 的集合 id、CRLF 行尾，都是只有读了源码或实测才知道的坑，没有一个靠写更多代码能解决。

## Common Pitfalls

### Pitfall 1：nginx 默认用 HTTP/1.0 连上游，SSE 被憋住或第一条消息后断开
**What goes wrong:** SSE 建连后浏览器长时间收不到 `PB_CONNECT`，SDK 15 秒后报 “EventSource connect took too long.” 并不断重连。
**Why it happens:** nginx 1.24 的 `proxy_http_version` 默认 1.0（默认值到 1.29.7 才改成 1.1），而且默认开缓冲。
**How to avoid:** `= /api/realtime` 位置块里写全 `proxy_http_version 1.1`、`proxy_set_header Connection ""`、`proxy_buffering off`、`proxy_read_timeout 3600s`。
**Warning signs:** `curl -N https://<domain>/api/realtime` 迟迟不输出 `PB_CONNECT`；`time_starttransfer` 接近超时值。

### Pitfall 2：“安静 10 分钟”里的第 5 分钟断开被误当成网络问题
**What goes wrong:** 所有运营商的结果里都在 300 秒出现一次 drop，被误读为线路差。
**Why it happens:** PocketBase 没有 SSE 心跳，空闲 5 分钟主动关闭连接。
**How to avoid:** 探针页的打点（第 15、45、105、195、315、495 秒）保证任意两条消息间隔 ≤ 180 秒；汇总里按 `events[].t` 检查有没有“恰好在上一次打点后 300 秒”的 drop，如有则标注为“服务器空闲断开”。
**Warning signs:** drop 的时刻集中在 ≈300 秒。

### Pitfall 3：把口令传给 sudo，口令进了 auth 日志
**What goes wrong:** `sudo pocketbase superuser upsert 邮箱 口令` 之类的命令行会被记入 `/var/log/auth.log`（以及 `journalctl _COMM=sudo`）。
**How to avoid:** 一律用 `sudo -u pocketbase bash -c '…read -rs…'` 的包装，口令只在 bash 变量里；Claude 的任何脚本**都不接收口令参数**。
**Warning signs:** 脚本里出现 `sudo … superuser … "$变量"` 直接展开口令。

### Pitfall 4：只挡了 `_superusers` 这个名字，被集合 id 绕过
**What goes wrong:** `/api/collections/pbc_3142635823/auth-with-password` 仍然可达。
**How to avoid:** 同时挡 `_superusers` 和 `pbc_3142635823` 两个前缀，`verify.sh` 对两种写法都断言 404。

### Pitfall 5：`curl` 不带 `-L` 把重定向当成失败，或把重定向后的内容当成校验对象
**What goes wrong:** 下载地址会 307 跳到文件接口；不带 `-L` 得到的是空体或 404。
**How to avoid:** 所有下载用 `curl -fsSL --proto '=https' --tlsv1.2`，校验对象一定是落盘后的文件。

### Pitfall 6：脚本带 CRLF 行尾
**What goes wrong:** 仓库在 Windows 上，系统级 `autocrlf=true` 会把检出的 `.sh` 转成 CRLF，`bash -s` 报 `$'\r': command not found`，`set -e` 下可能在奇怪的地方中止，nginx/systemd 文件里则多出不可见的 `\r`。
**How to avoid:** `.gitattributes` 加 `tools/probe/server/** text eol=lf`；脚本开头自检 `grep -q $'\r' "$0"`（经 stdin 执行时无法自检，所以用仓库内的预检步骤 `file`/`od` 检查）。

### Pitfall 7：数字字段设 `required` 导致 0 和 false 被拒
**What goes wrong:** 一次运行 `drops = 0`、`login_ok = false` 上传失败（400），而这恰恰是最想要的数据。
**How to avoid:** 只对文本和枚举字段设必填；`verify.sh` 的创建用例用 `drops=0`。

### Pitfall 8：`add_header` 在带自己 `add_header` 的位置块里不继承
**What goes wrong:** `/probe/` 位置块的 `Cache-Control` 让 server 层的安全头全部消失。
**How to avoid:** 该位置块把所有头写全（上文已写）；`verify.sh` 用 `curl -I` 断言四个头都在。

### Pitfall 9：改 nginx 之后 `certbot renew` 悄悄失败
**What goes wrong:** certbot 的 nginx 插件要解析整个配置；include 文件里写了它解析不了的语法，续期会在 60–90 天后才暴露。
**How to avoid:** S4 里强制 `certbot renew --dry-run`；用 `reload` 不用 `restart`；失败自动恢复备份。不要在本阶段改 certbot 管理的行。

### Pitfall 10：探针账号口令是公开的，任何人都可以灌数据
**What goes wrong:** 打开探针页的人都读得到 `config.js`，可以脚本化地往 `probe_results`/`probe_pings` 写垃圾。
**How to avoid:** 内置限流打开（迁移里设）、字段有 `min/max` 和 JSON `maxSize`、nginx `client_max_body_size 1m`、不把探针链接发到公开处；汇总时对异常值（`run_id` 重复、`dur_s` 对不上）剔除；站点在 Phase 13 重装。**残余风险：**灌数据会污染结果但不会泄露任何东西（账号读不到任何记录）。

### Pitfall 11：手机锁屏、切后台、微信“返回再进”让运行无效或失真
**What goes wrong:** 浏览器冻结脚本和回收 SSE，被误判成运营商问题。
**How to avoid:** 页面请求屏幕常亮并记录 `hidden_ms`；测试说明明确“10 分钟不要锁屏、不要切后台”；汇总里 `hidden_ms > 0` 的不算有效。

### Pitfall 12：`--dir` 漏写，数据库建到别处
**What goes wrong:** 超级用户建在了另一份 `pb_data` 里，服务启动后登录不了。
**How to avoid:** unit 和 S2b 命令都显式写 `--dir=/var/lib/pocketbase/pb_data`；二进制所在目录对 pocketbase 用户只读，漏写会直接报错而不是悄悄建新库。

### Pitfall 13：内存余量比想象的小
**What goes wrong:** 机器总内存 894 MB，空闲时已用约 412 MB（含所有者装的 PM2 守护进程约 47 MB 和阿里云的安全/监控代理约 60 MB），没有 swap。
**How to avoid:** `GOMEMLIMIT` + `MemoryHigh/MemoryMax` + `OOMScoreAdjust`；S6 的 swap 文件；S3 量一次真实 RSS 写进结果；不要在探针期间装别的服务。PM2 是所有者装的，**不要替他停掉**，只在报告里提一下它占的内存。[VERIFIED: ssh usj `ps` 与 `free -m`，2026-11-07]

### Pitfall 14：夹具里的“假令牌”被新规则拦下，或把真实口令当成“合成”写进测试
**What goes wrong:** Phase 8/9 写 `FakePbServer` 时直接在源码里写 JWT 形状字符串，提交被规则 F 拦下；或者为了省事把测试口令写成明文字面量（规则 G 也会拦；我自己写这份文档时就因为举例误中了一次，说明文档里举例也要用占位写法）。
**How to avoid:** 运行时拼接令牌；测试口令写成 `<…>` 占位或运行时拼接。已在 PRIVACY.md 的新小节里写明。

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PocketBase 发布在 GitHub，`./pocketbase update` 从 GitHub 拉 | 新版本只在维护者站点；v0.40.6 的 `update` 改为从新站拉取；GitHub 仓库 2026-10-22 起只读归档 | 2026-10 | 下载 URL 带 307 跳转；0.41.1 只有同站的 `checksums.txt`，没有第二来源 [CITED: https://github.com/pocketbase/pocketbase/discussions/7841，MEDIUM：公告写明“新版本只在新主机”，下载路径格式当时尚未定稿，实际格式以本会话 curl 实测为准] |
| PocketBase 管理员是独立集合 | 超级用户是 `_superusers` 集合（v0.23+）；CLI 为 `superuser create/upsert/update/delete/otp/ips` | 2024 起 | 阻断规则要挡 `/api/collections/_superusers/` 而不是旧的 `/api/admins/` |
| nginx 上游默认 HTTP/1.0 | nginx 1.29.7 起默认 1.1 | nginx 1.29.7 | 本机 1.24.0 仍是 1.0，必须显式写 |
| Let's Encrypt 用 OCSP | 2025-08 起关闭 OCSP，证书里改用 CRL | 2025-08 | 大陆访问不再有“OCSP 取不到导致握手慢”的担忧 [CITED: STACK.md 引用的 letsencrypt.org 公告，MEDIUM] |

**Deprecated/outdated:**
- STACK.md 和 ARCHITECTURE.md 里的 Caddy 方案：被 D-02 取代，本阶段以 nginx 为准。
- ARCHITECTURE.md Q6 写的 `vendor/pocketbase.umd.js`：本阶段探针页用 `iife`（定义全局 `PocketBase`，不需要模块系统）。

## Assumptions Log

> 所有 `[ASSUMED]` 的声明。规划者和 discuss-phase 要在把它们变成锁定决定前向所有者确认。

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 发布站被入侵的概率很低，所以 0.41.1 只靠同站 `checksums.txt` + 钉死哈希可以接受 | 标准栈 | 供应链风险；缓解是用 0.40.6 备选（有 GitHub 双来源） |
| A2 | sudo 默认把完整命令行写入 auth 日志，所以要用 `bash -c` 包装 | Pattern 3 | 包装多余但无害 |
| A3 | `--dir` 放在子命令前后都能被识别 | Pattern 3 | 命令报错，S2b 要重跑；用 `ls pb_data` 检查 |
| A4 | CLI `superuser upsert` 的引导会跑系统迁移，所以可以在服务启动前执行 | Pattern 3 | 若不能，改为先启动服务再建（此时 journald 会打印安装链接，建好后即失效） |
| A5 | 超级用户口令长度下限约 8 | Pattern 3 | 建议 ≥16 位，不受影响 |
| A6 | JS 设置属性名 `trustedProxy`、`rateLimits` 正确 | Pattern 4 | 迁移报错，S3 会暴露；改名后重跑 |
| A7 | 数字字段 `required` 会拒绝 0 | Pattern 4、Pitfall 7 | 若不拒绝，则多余但无害 |
| A8 | PocketBase 空闲 RSS 为几十 MB | Pattern 2 | 上限值要调；S3 会实测 |
| A9 | 打印安装链接的条件是“没有任何超级用户” | 备选方案 | 先建用户的顺序收益变小，不影响正确性 |
| A10 | `add_header` 继承规则符合 nginx 通用行为 | Pattern 1 | `verify.sh` 的 `curl -I` 断言会暴露 |
| A11 | `mtr` 的参数写法 | 实测方法 | 命令要微调 |
| A12 | 以 root 只读打开正在使用的 WAL 数据库可行 | 汇总 | 改用后台导出 |
| A13 | “多数次数”按 2/3 达标、1/2 以上临界量化 | 判定 | 所有者可改阈值；影响的只是“已知限制”的措辞 |
| A14 | 美国测试人以其本地晚高峰为主 | 实测方法 | 只影响美国数据的解读 |
| A15 | 周末晚高峰更拥挤 | 实测方法 | 只影响选哪几夜 |
| A16 | 阿里云控制台防火墙 ICMP 默认状态未知 | 基线 | 若 ICMP 被挡，ping 基线全丢包；用 tcping 替代 |
| A17 | 钩子演练脚本复杂度可接受 | 钩子证据 | 可只保留 `--self-test` |

## Open Questions (RESOLVED)

> 下面每个问题都已在 06-CONTEXT.md 的决定里解决（2026-11-07，调研之后由所有者确认）；原来的分析保留，解决方式写在每题末尾的 **RESOLVED** 一行。和原建议不同的，以 CONTEXT 的决定为准。

1. **后台 `/_/` 对公网 404、所有者走 SSH 隧道，还是像 ROADMAP Notes 那样公网可达 + 强密码？**
   - What we know: 公网可达的超级用户登录页会被扫描；探针期间站点上只有合成数据，ROADMAP Notes 已接受这个风险；404 方案多一条隧道命令，没有额外风险。
   - What's unclear: 所有者是否愿意每次看结果时开隧道（`ssh -L 8090:127.0.0.1:8090 usj`）。
   - Recommendation: 默认 404 + 隧道（本文设计的就是这个）；所有者嫌麻烦就删掉 snippet 里 `/_/` 那一行，其余不变。
   - **RESOLVED（D-13，覆盖上面的建议）：** 探针阶段 `/_/` 对公网开放，靠所有者设置的强密码保护，后台只放合成数据，打开 PocketBase 自带限流；两步验证和 IP 白名单留到 Phase 13。本文 Pattern 1 里返回 404 的设计不再采用：06-07 的 nginx 片段把 `/_/` 反代给 PocketBase，verify-site 的 F-07 期望 200、F-14 期望限流返回 429。
2. **“大多数次数达到”要不要定成 2/3？**
   - Recommendation: 用 2/3 合格、1/2 到 2/3 临界；请所有者确认或改数。
   - **RESOLVED（D-18）：** 按每家运营商至少三分之二的有效运行达到 D-06 计；06-03 的 summarize.mjs 用 ≥ 2/3 合格、> 1/2 临界、其余不合格，边界有自检。
3. **美国测试的“晚高峰”按美国本地时间还是北京时间？**
   - Recommendation: 以美国本地 20:00–23:00 为主，北京晚高峰时段补测。
   - **RESOLVED（D-18）：** 美国侧以美国本地 20:00–23:00 为主，北京晚高峰时段再补测几次；summarize.mjs 按 tz_offset_min 区分时段。
4. **SDK 的 `SUS` 判定放行？**
   - Recommendation: 在取得 SDK 文件之前加 `checkpoint:human-verify`，所有者核对哈希和维护者（见 § 包合法性审计）。
   - **RESOLVED（D-15、D-17）：** 不用被标为可疑的 0.28.2，改用上一个稳定版 0.28.1，固定文件哈希、与页面同源托管；下载放在所有者批准之后（06-05 Task 2 的包合法性检查点，gate="blocking-human"），下载后先比对 registry 的完整性值再解压。
5. **0.41.1 单来源校验和是否可接受，还是直接用有双来源的 0.40.6？**
   - Recommendation: D-03 已选 0.41.1；脚本钉哈希；不安心就回退 0.40.6。
   - **RESOLVED（D-16）：** 仍用 0.41.1，把本文核对过的 SHA-256 钉死在安装脚本里，并与同站 checksums.txt 交叉核对，不一致就中止；0.40.6 作备选（两个来源可互相核对），只有所有者另行批准才换。
6. **是否加规则 H（公网 IPv4 形状）和把规则 D 改成大小写不敏感？**
   - What we know: 两者今天都是 0 误报；规则 D 改大小写是对全部词条的行为变更（只会更严）。
   - Recommendation: 都做；规则 D 的大小写改动在自检里固定下来。
   - **RESOLVED（D-18）：** 两项都做：规则 D 的 denylist 匹配改为不区分大小写，新增公网 IPv4 形状的规则 H；06-01 实现并各带故意违规的自检。
7. **“拦所有压缩包”是否太严？**
   - Recommendation: 今天零误伤；将来需要提交压缩包时通过显式修改规则（带自检）处理。
   - **RESOLVED（D-12；正则写法属于 Claude's Discretion）：** D-12 要求拦备份压缩包；规划采纳本文建议，06-01 Task 3 按扩展名拦全部压缩包（不按 backup 这个词拦），将来需要提交压缩包时显式改规则并补自检。
8. **要不要建 swap？** Recommendation：建（1 GiB，不改 `swappiness`），所有者可拒绝。
   - **RESOLVED（D-14）：** 建 1 GB swap 文件，作为单独一个脚本（06-06 的 01-swap.sh）经所有者批准后执行；PocketBase 同时用 `GOMEMLIMIT` 和 systemd 内存上限控制内存。
9. **Phase 13 是否沿用本阶段的 nginx 参数？** 以本阶段 `verify.sh` 通过的参数为准写进 `deploy/` 模板。
   - **RESOLVED（D-02、D-08）：** 继续用服务器上已有的 nginx 和 certbot；本阶段验证过的实时连接参数作为 Phase 13 的输入：06-02 把 ROADMAP Phase 13 的 Notes 改成以 Phase 6 验证过的 nginx 参数为准，06-10 在结果文档的“给 Phase 13 的输入”里写明（本文的 `verify.sh` 在规划中落为 tools/probe/verify-site.mjs）。

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| SSH 到服务器（别名 `usj`） | 全部服务器步骤 | ✓ | OpenSSH 10.3p1（本机）；密钥登录 | 所有者在阿里云网页终端手动执行 |
| `admin` 免密 sudo | S1–S6 | ✓（`sudo -n true` 成功） | — | 所有者在网页终端执行 |
| nginx | 反代和静态页 | ✓ | 1.24.0 (Ubuntu) | — |
| certbot + `certbot.timer` | 续期 | ✓ | 2.9.0；authenticator 与 installer 都是 nginx | — |
| curl、sha256sum、jq、openssl | 下载、校验、冒烟、随机口令 | ✓ | 服务器上均已安装 | — |
| `unzip` | 解压 PocketBase zip | ✗ | — | `apt-get install -y unzip`；或 `python3 -m zipfile -e` 再 `chmod 755` |
| Python 3 + `sqlite3` 模块 | 只读导出结果 | ✓ | Python 3.12.3、SQLite 3.45.1 | `sqlite3` 命令行没装也不需要 |
| swap | OOM 保险 | ✗（0） | — | S6 建 1 GiB 文件 |
| 8090 端口 | PocketBase | ✓（空闲） | — | — |
| 内存 | 运行 | 总 894 MB，可用约 482 MB | — | cgroup 上限 + swap |
| 磁盘 | 数据 | ✓ | 30 GB，已用 3.3 GB | — |
| 时间同步 | 证书、日志时间 | ✓ | chrony 运行中，系统时钟已同步，时区 Asia/Shanghai | — |
| 本机 Node.js | 自检、汇总脚本 | ✓ | v24.20.0 | — |
| 本机 curl/ssh | 本地冒烟 | ✓ | curl 8.21.0 | — |
| 阿里云控制台防火墙 | 端口收口 | ？（看不到） | — | 所有者在控制台确认；Claude 做“从外面连 8090”的反向验证 |
| ufw | — | 未启用 | — | 控制台防火墙是外层，不要在本阶段启用 ufw（可能把自己锁在 SSH 外） |

[VERIFIED: 上表中服务器一侧的项目来自 orchestrator 的只读检查和本会话的 `ssh usj` 只读命令，2026-11-07]

**Missing dependencies with no fallback:** 无。
**Missing dependencies with fallback:** `unzip`（apt 安装或 Python）、swap（S6）。

## Validation Architecture

> `.planning/config.json` 里 `workflow.nyquist_validation` 是 `false`，按约定本节可省略；但 orchestrator 明确要求“说明每条成功标准怎么验证”，所以保留，写成验证方式清单。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | 无新框架：Node 内置运行 `privacy-check.mjs --self-test` 和 `summarize.mjs --self-test`（沿用仓库的零依赖自检写法）；服务器侧用 bash + curl 的 `verify.sh` |
| Config file | 无 |
| Quick run command | `node tools/privacy/privacy-check.mjs --self-test` |
| Full suite command | `node tools/privacy/privacy-check.mjs --self-test && node tools/privacy/privacy-check.mjs --all && node tools/probe/summarize.mjs --self-test`（`npm test` 的 154 条 Playwright 用例与本阶段无关，**不得**因本阶段改动而变化；探针页不进 `npm test`） |

### Success Criteria → 验证方式

| SC | 行为 | 类型 | 命令/做法 | 本地自动 / 所有者手动 |
|----|------|------|-----------|----------------------|
| SC1 | 令牌形状、密码赋值、`pb_data`/数据库/压缩包、真实域名和 IP 都被拦；每条新规则有故意违规自检 | 单元（自检） | V-01：`node tools/privacy/privacy-check.mjs --self-test`（新增 F、G、A 扩展、D 的确定性用例；样本运行时拼接） | 本地自动 |
| SC1 | 现有被跟踪文件无误报 | 集成 | V-02：`node tools/privacy/privacy-check.mjs --all` 退出码 0 | 本地自动 |
| SC1 | pre-commit 和 pre-push 真的会失败 | 演练 | V-03：临时仓库演练脚本（见 § 钩子证据） | 本地自动 |
| SC2 | PocketBase 固定版本、校验和核对通过 | 服务器只读 | V-04：S1 输出里的“哈希一致”两行；`/opt/pocketbase/pocketbase --version` 含 `0.41.1` | Claude 执行，所有者看报告 |
| SC2 | 证书自动续期在改 nginx 后仍可用 | 服务器 | V-05：S4 里的 `certbot renew --dry-run` 成功；`systemctl list-timers certbot.timer` 有下次触发时间 | Claude 执行 |
| SC2 | 用域名经 HTTPS 打开探针页 | 外部 | V-06：本机 `curl -sSI https://<域名>/probe/` → 200 且带四个响应头；`http://` → 301 到 https | 本地自动（域名运行时从 `private/` 读，不打印） |
| SC2 | PocketBase 只监听本机、8090 不对外 | 服务器 + 外部 | V-07：`ss -ltnH` 显示 `127.0.0.1:8090`；V-13：从本机 `Test-NetConnection <服务器 IP> -Port 8090`（IP 运行时从 denylist 取，只打印 OPEN/CLOSED）应为 CLOSED；控制台防火墙由所有者确认（S7） | 前者自动，后者半自动 + 所有者确认 |
| SC2 | 反代对 SSE 不缓冲 | 服务器/外部 | V-08：`curl -sN -m 10 -D - -o /dev/null -w '%{time_starttransfer}' https://<域名>/api/realtime` 首字节 < 1 s、`content-type: text/event-stream`；再用 curl 提交订阅并创建一条打点，事件在 1–2 s 内到达（脚本里逐行打时间戳） | `verify.sh`，Claude 执行 |
| SC2 | 规则生效：探针账号只能新建 | 服务器/外部 | V-09：未登录 `POST /api/collections/users/records` → 403；探针账号登录 200；`POST probe_results`（含 `drops=0`、`login_ok=false`）→ 200；`GET` 列表/查看、`PATCH`、`DELETE` → 403；未登录 `GET probe_results` → 403 | `verify.sh` |
| SC2 | 后台和超级用户认证对公网不可见 | 外部 | V-10：`/_/`、`/api/collections/_superusers/auth-with-password`、`/api/collections/pbc_3142635823/auth-with-password` → 404 | `verify.sh` |
| SC2 | 迁移和设置真的生效 | 服务器只读 | V-11：`sudo python3 -I` 只读列出 `_collections` 的名字含 `probe_results`、`probe_pings`；V-12：读 `_params` 里 `settings` 的 JSON，核对 `logs.maxDays == 2`、`logIP == false`、`trustedProxy.headers` 含 `X-Real-IP`、`rateLimits.enabled == true`（只打印布尔/数字，不打印其他字段） | Claude 执行 |
| SC3 | 探针页流程可走通、结果入库 | 手动 | V-14：所有者在自己浏览器用 `?dur=90` 完整跑一遍；Claude 只读确认 `probe_results` 多了 1 行（`dur_s < 590`，不计入有效） | **所有者手动**，Claude 只读核对 |
| SC3 | 3 个晚上、三网加美国的晚高峰实测 | 手动 | V-15：按 § 实测方法；每晚结束后 Claude 只读导出并检查有效运行数 | **所有者组织**，不可自动化 |
| SC3 | 汇总表不含 IP 和域名 | 单元/集成 | V-16：`node tools/probe/summarize.mjs --self-test`；生成的 `06-PROBE-RESULTS.md` 过 `privacy-check.mjs --staged`（规则 D 会拦域名和 IP） | 本地自动 |
| SC4 | 结论三部分齐全，探针站只有合成数据 | 人工审阅 | V-17：结果文档包含“实测结果/已知限制/做过的调整/给 Phase 10、13 的输入”；服务器上 `users` 只有 1 个探针账号（V-11 的只读查询里数 `users` 行数） | 审阅 + 只读核对 |
| D-01 | 过时写法已改 | 文本检查 | V-18：`grep -nE "腾讯云|Tencent" .planning/PROJECT.md .planning/REQUIREMENTS.md .planning/ROADMAP.md .claude/CLAUDE.md` 无输出（历史记录除外）；ROADMAP 里 Phase 13 Notes 不再提 Caddy | 本地自动 |
| 资源 | 服务器内存实测 | 服务器只读 | V-19：S3 输出的 `MemoryCurrent` 和 RSS 写进结果文档 | Claude 执行 |

### Sampling Rate

- **每次提交（改隐私检查器或汇总脚本）：** `node tools/privacy/privacy-check.mjs --self-test`（秒级）
- **每个计划完成：** 全套命令 + `--all`
- **阶段关口：** 全套命令绿，`verify.sh` 全部断言通过，所有者确认控制台防火墙和 V-14；实测数据是否足够由 V-15 的“有效运行数”决定，**不阻塞**后续阶段（ROADMAP 已写 Phase 6 不阻塞 Phase 7、8）

### Wave 0 Gaps

- [ ] `tools/privacy/privacy-check.mjs` 的新规则 F、G、A 扩展和规则 D 确定性自检（V-01）
- [ ] `tools/probe/summarize.mjs` 和它的 `--self-test`（V-16）
- [ ] `tools/probe/server/verify.sh`（V-06 至 V-10 及 SSE 检查）
- [ ] `.gitattributes` 加 `tools/probe/server/** text eol=lf`
- [ ] `.gitignore` 加数据库、压缩包、PocketBase 二进制和 `tools/probe/page/config.js`
- [ ] 钩子演练脚本（可选，V-03）

## Security Domain

> `security_enforcement` 未设为 false，`security_asvs_level` 为 1。

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 是 | 超级用户：长随机口令，由所有者在网页终端输入，不进文件；探针账号：合成口令，权限最小；PocketBase 自带哈希，不自写 |
| V3 Session Management | 部分 | 探针页登录后令牌放在浏览器 localStorage（SDK 默认）；只含合成账号，无敏感面；正式站的令牌时长归 Phase 9/13 |
| V4 Access Control | 是 | 集合规则：`users` 的创建/删除收成 null；`probe_results` 只允许 create；后台和超级用户认证在 nginx 层 404（按名字和集合 id） |
| V5 Input Validation | 是 | 字段类型、`min/max`、`select` 枚举、JSON `maxSize`；nginx `client_max_body_size 1m`；页面不收集自由文本 |
| V6 Cryptography | 是 | TLS 由 certbot 管理（不手写）；口令哈希由 PocketBase 完成；不自写任何加密 |
| V7 Error Handling and Logging | 是 | PocketBase 日志 2 天、不记 IP；nginx 探针日志不含 IP 和查询串；systemd 日志里不出现口令 |
| V14 Configuration | 是 | 8090 只绑 127.0.0.1；控制台防火墙只开 22/80/443；systemd 沙箱；PocketBase 二进制 root 属主只读 |

### Known Threat Patterns for 这套栈

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 默认 `users` 集合允许任何人注册 | Elevation / Tampering | 迁移里 `createRule = null`、`deleteRule = null`；V-09 验证 |
| 超级用户登录页暴露在公网被暴力猜测 | Spoofing | nginx 对 `/_/` 和 `_superusers` 认证接口返回 404；所有者走 SSH 隧道；内置限流打开 |
| 口令经 sudo 命令行写进 `auth.log` | Information Disclosure | `bash -c` 包装 + `read -rs` |
| 口令/令牌写进被跟踪文件 | Information Disclosure | 规则 F、G；`.gitignore`；`private/` 隔离；探针账号的 `config.js` 由服务器生成且被忽略 |
| 探针账号口令公开被人灌数据 | Tampering / DoS | 限流、字段上限、请求体上限；账号读不到任何记录；站点可随时重装 |
| 发布站被入侵或下载损坏 | Tampering | 钉死哈希 + 与 `checksums.txt` 双核对 + `--version` 检查；0.40.6 有 GitHub 双来源作备选 |
| SSE 被代理缓冲或掐断 | Denial of Service（对自己） | 位置块参数 + `verify.sh` 的 curl 检查 + 探针页的打点实测 |
| 日志里留着测试人的 IP 和设备信息 | Information Disclosure | `logIP=false`、`maxDays=2`、nginx 无 IP 日志格式；`userAgent` 无法关闭，只靠短保留 |
| 改 nginx 后续期失败 | Denial of Service（证书过期） | S4 的 `certbot renew --dry-run` 和自动回滚 |
| 内存耗尽拖垮 nginx 和 sshd | Denial of Service | `MemoryMax` + `OOMScoreAdjust` + swap |

## Sources

### Primary (HIGH confidence)
- 本会话读取的仓库文件：`tools/privacy/privacy-check.mjs`（全文）、`PRIVACY.md`、`.gitattributes`、`.gitignore`、`.planning/config.json`、`06-CONTEXT.md`、`ROADMAP.md` § Phase 6、`REQUIREMENTS.md`、`.planning/research/STACK.md`、`PITFALLS.md`（前 571 行）、`ARCHITECTURE.md` § Q6、Q7
- 服务器只读检查（`ssh usj`，2026-11-07）：`nginx -v`、默认站点配置（域名和 IP 已替换后查看）、`/etc/nginx/nginx.conf`、`/etc/logrotate.d/nginx`、`free -m`、`swapon`、`ss -ltn`、工具是否存在、Python 3.12.3/SQLite 3.45.1、`certbot` 续期配置里的 authenticator/installer、`certbot.timer` 的 `OnCalendar`、进程内存排行
- 发布站实测：`https://ganigeorgiev.com/api/collections/pbc_953728200/records?filter=tag='v0.41.1'`（文件清单与时间）、下载 URL 的 307 跳转、`checksums.txt` 全文、本机 `sha256sum`
- GitHub API `repos/pocketbase/pocketbase/releases/tags/v0.40.6`（资产 `digest`）与 `releases/download/v0.40.6/checksums.txt`
- npm：`npm view pocketbase@0.28.2`（dist.shasum、dist.integrity、homepage、license、时间线）；registry tarball 的 sha1 与 `dist.shasum` 一致；读 `dist/pocketbase.es.mjs` 的 `RealtimeService`；README 的 `PB_CONNECT`、`onDisconnect`、`autoCancellation` 段
- https://pocketbase.io/docs/going-to-production/（nginx、Caddy 示例、`GOMEMLIMIT`、`LimitNOFILE`、备份、限流、用户 IP 代理头）
- https://pocketbase.io/docs/js-migrations/（迁移格式、`new Collection`、`settings.logs.*` 示例）
- https://pocketbase.io/docs/api-realtime/（SSE 连接、`PB_CONNECT`、订阅体、5 分钟空闲、授权时机）
- https://pocketbase.io/docs/js-records/ 、 https://pocketbase.io/docs/js-jobs-scheduling/（记录 API、`cronAdd`，本文最终没用钩子）
- https://nginx.org/en/docs/http/ngx_http_proxy_module.html（`proxy_buffering`/`X-Accel-Buffering`、`proxy_read_timeout`、`proxy_http_version`）
- PocketBase 源码 v0.40.6（GitHub 归档仓库）：`cmd/superuser.go`、`cmd/serve.go`、`apis/serve.go`、`apis/realtime.go`、`apis/middlewares.go`、`core/settings_model.go`、`core/collection_model.go`、`plugins/jsvm/jsvm.go`、`pocketbase.go`、`examples/base/main.go`

### Secondary (MEDIUM confidence)
- https://github.com/pocketbase/pocketbase/discussions/7841（迁出 GitHub 的公告：新版本只在新主机、旧版本留在 GitHub）
- https://www.alibabacloud.com/help/en/simple-application-server/network-security01 及同系列帮助页（轻量应用服务器默认开放 22/80/443，其余关闭，防火墙只管入站；ICMP 默认状态未确认）
- 搜索结果对 itdog.cn 功能的描述（W3Techs 站点信息、掘金文章）；itdog 官网页面直接抓取返回 403

### Tertiary (LOW confidence)
- 通用 SSE-over-nginx 博客（bytenote、oneuptime 等）：只用于交叉印证“`proxy_buffering off`、HTTP/1.1、长读超时”，没有当作依据
- mtr/pathping 参数、美国晚高峰的理解、周末更拥挤：见 Assumptions Log

## Metadata

**Confidence breakdown:**
- Standard stack（版本、下载地址、校验和）：HIGH — 在本会话里下载并核对；仅 0.41.1 缺第二来源（已说明）
- nginx/SSE 参数与 systemd unit：MEDIUM-HIGH — 参数来自 nginx 文档和 PocketBase 源码；整套配置尚未在这台机器上执行，S4/S5 的 `verify.sh` 是它的证据
- 探针页设计：MEDIUM-HIGH — SDK 重连行为是读真实 0.28.2 源码得出的；服务端 SSE 行为读的是 0.40.6 源码，0.41.1 未复核
- SEC-03 规则：HIGH — 原型 61 条用例通过，210 个被跟踪文件误报 0；上线形态以规划里的自检为准
- 大陆三网的真实表现：LOW — 只能靠本阶段实测，调研阶段没有也不可能有一手数据
- Pitfalls：MEDIUM-HIGH

**Research date:** 2026-11-07
**Valid until:** 2026-11-14（PocketBase 刚搬家、发布节奏快；开工前先复核 `releases` 接口有没有出现 0.41.2 或更高版本，再决定是否仍钉 0.41.1）

