---
phase: "13"
slug: "deploy-hardening-acceptance"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-17"
---

# Phase 13 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

审计方式：gsd-security-auditor（opus）只读核对 14 份计划的威胁登记，用 Read、Grep、`git diff`、`git show`，没有跑测试、没有连服务器、没有读 `private/`。运维类缓解（部署、重启、恢复演练、升级）以 SUMMARY 里经 redact 的服务器输出和所有者的即时确认原话为证据。

---

## Trust Boundaries

| Plan | Boundary | Description |
|------|----------|-------------|
| 13-01 | 页面 → Service Worker → Cache Storage | 浏览器里持久保存的响应，跨刷新和冷启动存在 |
| 13-01 | 测试静态服务器 → 仓库文件 | 新增的 `/sw.js` 只读 `deploy/site/sw.js` |
| 13-02 | 测试静态服务器 → 仓库文件 | 新增的路径只能读 `deploy/site/` 里白名单上的文件 |
| 13-02 | 图标渲染 → 本机 Edge | 一次性的离线渲染 |
| 13-03 | 新版本的 worker → 已打开的页面 | 新代码接管页面的时机由用户点击决定 |
| 13-03 | 测试代码 → 测试静态服务器的版本开关 | 只在本机回环上、只给测试用 |
| 13-04 | 页面里的用户数据 → innerHTML | 现有防线是 `esc()`（Phase 7），CSP 是第二道 |
| 13-04 | 本机构建 → 线上页面和 CSP 头 | 两者必须出自同一次构建 |
| 13-05 | 公网 → nginx → PocketBase 的 X-Real-IP | 只有 nginx 设置的头可信 |
| 13-05 | 迁移文件 → 线上数据库 | 迁移在首次启动时对线上库执行 |
| 13-05 | 钩子 → 所有者的邮箱 | 看门狗按超级用户邮箱发信 |
| 13-06 | 仓库模板 → 服务器 root 执行 | 模板经批准后以 sudo 运行 |
| 13-06 | 服务器上的钥匙文件 → PocketBase 进程 | 钥匙只经 systemd 的 EnvironmentFile 和 pb-admin 的环境变量传递 |
| 13-06 | 上传目录 → 脚本 | 上传到执行之间文件可能被换 |
| 13-07 | 公网客户端 → nginx | 所有请求头都不可信，只有 nginx 设置的 X-Real-IP 可信 |
| 13-07 | nginx 访问日志 → 磁盘 | 日志记 IP（D-03），不能记令牌 |
| 13-07 | 恢复演练的临时实例 → R2 和线上库 | 临时实例带着线上的 R2 设置和钥匙 |
| 13-08 | 本机 → 线上站点（verify-site） | 输出可能带出主机名和地址 |
| 13-08 | 仓库文档 → 公开仓库 | README、验收清单公开可读 |
| 13-08 | 上传包 → 服务器 | 所有者批准的就是包里的字节 |
| 13-09 | 所有者看到的全文 → 实际上传的字节 | 两者必须完全相同 |
| 13-09 | 服务器输出 → SUMMARY | 可能带出域名、IP |
| 13-10 | 批准的文件 → 上传目录 → 执行 | 每一跳都要逐字节相同 |
| 13-10 | 整批批准 → 实际执行的时刻 | 中间隔着时间，所有者要在执行前再看一次 |
| 13-10 | 服务器输出 → SUMMARY | 可能带出域名、IP |
| 13-11 | 所有者 → 自己的网页终端 → 钥匙和超级用户 | 秘密只在这条路上出现 |
| 13-11 | 整批批准 → 第二批执行的时刻 | 所有者在执行前再看一次 |
| 13-11 | 服务器输出 → SUMMARY | 可能带出域名、IP |
| 13-12 | 所有者 → 后台 → 加密的设置 | SMTP 授权码和 R2 密钥只在这条路上 |
| 13-12 | 服务器 → 所有者邮箱 | 验证码和告警邮件 |
| 13-12 | 整批批准 → 重启的时刻 | 所有者在重启前再看一次命令 |
| 13-13 | 演练临时实例 → 线上库 | 守卫之后的只读复制 |
| 13-13 | 演练临时实例 → R2 | 读列表、写删一个演练备份、读最新的自动备份 |
| 13-14 | 新构建 → 服务器 | 只有批准的 13 个文件 |

---

## Threat Register

| Plan | Threat ID | Category | Component | Severity | Disposition | Mitigation | Status | Evidence |
|------|-----------|----------|-----------|----------|-------------|------------|--------|----------|
| 13-01 | T-13-01 | Information Disclosure | sw.js 的 fetch 监听 | high | mitigate | 只对 `/` 导航和 SHELL 路径 respondWith，`/api/`、`/_/` 一律交给网络；Task 2 的用例断言缓存里只有 SHELL、没有任何 `/api/` 条目，离线时 `/api/health` 不会被答出来 | closed | `deploy/site/sw.js` 只对 `/` 导航和 SHELL 路径 respondWith，SHELL 无 /api/、/_/；`tests/cloud/sw-offline.spec.ts` 断言缓存无 /api/ 条目 |
| 13-01 | T-13-02 | Denial of Service | sw.js 接管后台页面 | medium | mitigate | 导航只在路径是 `/` 时回缓存；`/_/` 不在 SHELL、不被接管；13-07 的 nginx 对 `/sw.js` 发 no-cache，坏的 worker 能被新版本覆盖 | closed | `sw.js` 导航只在 pathname 为 `/` 时回缓存；`usj-app.conf` 给 /sw.js 发 no-cache；线上 F-04 PASS |
| 13-01 | T-13-03 | Information Disclosure | tests/support/static-server.cjs 的 `/sw.js` | low | mitigate | 精确白名单只多 `/sw.js` 一条，其余 404；仍只绑 127.0.0.1、只接受两个 Host | closed | `tests/support/static-server.cjs` 精确匹配 /sw.js、其余 404、只绑 127.0.0.1、只接受两个 Host |
| 13-01 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-02 | T-13-37 | Information Disclosure | 静态服务器的清单和图标路径、图标渲染 | low | mitigate | 精确白名单（清单和 4 个图标），其余 404；仍只绑 127.0.0.1、只接受两个 Host；渲染时浏览器网络全部挡住（host-resolver-rules、死代理、`page.route('**')` abort），不用外部素材 | closed | `static-server.cjs` 清单和 4 个图标精确白名单；`deploy/make-icons.mjs` 渲染时挡住全部网络 |
| 13-02 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包；用已装的 Playwright 和本机 Edge | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-03 | T-13-04 | Tampering | swUpdate 刷新页面 | medium | mitigate | swUnsaved 为真时先确认；取消就留在原页面；待上传的修改本来就在本机缓存里（Phase 10），刷新后照常上传；两个标签页的用例证明别的标签页不会被动刷新 | closed | `us-journey-tracker.html` swUnsaved 为真先确认、取消就留下；别的标签页只显示横幅；`tests/cloud/sw-update.spec.ts`（含双标签页） |
| 13-03 | T-13-05 | Tampering | 静态服务器 `/__test/sw-version/` | low | mitigate | 版本必须匹配 `^[a-z0-9]{1,16}$`；只改内存里的一个字符串，不读写文件；只绑 127.0.0.1、只接受两个 Host；线上 nginx 没有这个路径 | closed | `static-server.cjs` 版本格式 `^[a-z0-9]{1,16}$`、只改内存；线上 nginx 没有 /__test/ 位置，落到兜底 404 |
| 13-03 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-04 | T-13-06 | Elevation of Privilege | 内联脚本注入（XSS） | high | mitigate | `script-src` 只放 `'self'` 和两个哈希，`style-src` 只放一个哈希，`style-src-attr 'none'`，`base-uri 'none'`、`object-src 'none'`；策略里没有 unsafe- 关键字（构建自检和 verify 都核对） | closed | `deploy/build-site.mjs` 策略只有 'self' 和哈希、各项 'none'、无 unsafe-，构建自检；`verify-site.mjs` BD-05、F-03；线上 F-03 PASS |
| 13-04 | T-13-07 | Denial of Service | 页面与 CSP 不匹配导致白屏 | medium | mitigate | 页面和 `usj-csp.conf` 出自同一次构建；构建可重复；13-08 的 verify-site 在线上逐个比对哈希；13-07 的站点安装把页面和 CSP 头一起换 | closed | `build-site.mjs` 页面和 usj-csp.conf 同一次构建、确定性自检；`06-install-site.sh` 一起换、出错回滚；13-14 升级后线上 F-02 PASS |
| 13-04 | T-13-08 | Spoofing | 点击劫持 | low | mitigate | `frame-ancestors 'none'` 只能放响应头，由 nginx 发；13-07 另发 `X-Frame-Options: DENY` | closed | `build-site.mjs` frame-ancestors 'none' 经响应头发出；`usj-headers-common.conf` X-Frame-Options DENY；F-01、F-03 PASS |
| 13-04 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包；SDK 复制前按钉死的 sha256 核对 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-05 | T-13-09 | Spoofing | 后台 `/_/` 的口令爆破 | high | mitigate | `_superusers:auth` 每个 IP 60 秒 5 次（S-07 实测第 6 次 429）；13-12 再加邮件验证码两步验证；PocketBase 默认的新位置登录提醒保持开启 | closed | `1794096200_server_settings.js` `_superusers:auth` 每 IP 60 秒 5 次；S-07 PASS；线上 F-16 PASS；13-12 开了 OTP 和 MFA |
| 13-05 | T-13-10 | Spoofing | 伪造 X-Real-IP 绕过或误伤限流 | medium | mitigate | 只信 `X-Real-IP`；13-07 的 nginx 在每个反代位置用 `$remote_addr` 覆盖它，客户端自带的同名头无效；8090 只绑回环（13-06） | closed | `server_settings.js` 只信 X-Real-IP；`usj-app.conf` 三个反代位置用 $remote_addr 覆盖；`pocketbase.service` 只绑 127.0.0.1:8090；线上 B-03 CLOSED |
| 13-05 | T-13-11 | Denial of Service | 备份静默失败 | medium | mitigate | 内置失败告警 + 看门狗，W-02、W-05 在本机证明两封信都真的发出；13-08 写的验收清单（13-15 执行）加“次日去 R2 看新备份”的人工兜底 | closed | `deploy/pb_hooks/backup-watch.pb.js` 看门狗；W-02、W-05 PASS；13-13 所有者确认 R2 有自动备份、没有告警信；人工兜底 13-ACCEPTANCE I-4 |
| 13-05 | T-13-12 | Tampering | 清理迁移误删真实用户 | high | mitigate | 只删两个固定名字的集合和严格匹配 `probe-<8 位十六进制>@example.com` 的用户，删前用正则二次核对；R-03 证明别的用户保留；真实账号用的是所有者自己的地址，不会匹配 | closed | `1794096150_retire_probe.js` 只删两个固定集合，用户先按条件取再用正则二次核对；R-03 PASS |
| 13-05 | T-13-13 | Information Disclosure | 请求日志里的 IP | low | accept | D-03 所有者决定记 IP、留 30 天；日志只在服务器上；`logAuthId` 关闭；检查脚本只输出是否一致 | closed | 接受（D-03）：`server_settings.js` 留 30 天、记 IP、logAuthId=false |
| 13-05 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何东西；只用已批准、sha256 钉死的本机 0.41.1 程序 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-06 | T-13-14 | Information Disclosure | PB_ENCRYPTION_KEY | high | mitigate | 在服务器上用 openssl 生成、只经管道写进 root:pocketbase 0640 的文件、从不打印、不进命令行参数（C-08 静态核对）；已有钥匙绝不覆盖；所有者自己在网页终端读一次存进密码管理器 | closed | `03-configure-pocketbase.sh` openssl 生成、管道写 root:pocketbase 0640、已有钥匙只核对不覆盖；C-08 PASS |
| 13-06 | T-13-15 | Tampering | 上传目录里的脚本和文件 | high | mitigate | `mktemp -d` 的 0700 目录、属于当前用户；每个脚本入口对自己要读的文件再跑 `sha256sum -c`（IN-09，C-04 静态核对）；执行前在同一条 ssh 里核对脚本自身（13-10、13-11） | closed | 03/04/05/06 入口核对上传目录格式、属主、0700，每个要读的文件 `sha256sum -c --strict`；C-04 PASS；13-10、13-11 执行前先核对清单行 |
| 13-06 | T-13-16 | Tampering | 07 的 `--wipe` 误删真实数据 | high | mitigate | 库里有任何非探针用户或 `journey_docs` 记录就拒绝清空（C-11 静态核对）；是否清空由所有者在 13-09 单独决定 | closed | `07-retire-probe.sh` 有非探针数据或读不出就拒绝、删除前再核对；C-11 PASS；实际选了 --keep |
| 13-06 | T-13-17 | Denial of Service | 钥匙丢失导致起不来 | medium | mitigate | 所有者把钥匙存进密码管理器（13-11 的检查点）；04 启动前核对钥匙长度；恢复演练用同一把钥匙（13-07）；轮换步骤已在 13-05 本机演练 | closed | `04-start-pocketbase.sh` 启动前核对钥匙长度；所有者已保存钥匙（13-11）；演练用同一 EnvironmentFile；轮换本机实测 K-01..K-04 |
| 13-06 | T-13-18 | Information Disclosure | 模板里的域名 | medium | mitigate | 站点地址在服务器上从证书块读出；模板只有路径和占位；隐私检查规则 D/G/H 在暂存时拦截 | closed | 03 从 certbot 管理的 server_name 读站点地址；模板只有占位；pre-commit 隐私检查规则 D、G、H |
| 13-06 | T-13-SC | Tampering | PocketBase 二进制与系统包 | high | mitigate | 不装新包；02 保留钉死的 zip sha256 和 checksums.txt 互核，already 路径也核对 zip 与已装程序一致；下载只在程序缺失或版本不对时发生，且在所有者批准的脚本里 | closed | `02-install-pocketbase.sh` zip sha256 钉死、与 checksums.txt 两重核对、already 路径核对字节相同；C-10 PASS |
| 13-07 | T-13-19 | Information Disclosure | nginx 访问日志 | medium | mitigate | 日志格式用 `$uri`（不含查询串），C-15 静态核对；日志目录 root:adm 0750；导出一律经 redact | closed | `usj-log-format.conf` 用 $uri；/var/log/usj root:adm 0750；logrotate create 0640；C-15 PASS |
| 13-07 | T-13-20 | Denial of Service | nginx 配置出错导致全站不可用 | medium | mitigate | 动手前检查锚点和块类型；备份后挂 ERR trap 回滚；`nginx -t`、reload、certbot dry-run 任一失败都恢复（WR-09，C-19） | closed | `05-nginx-app.sh` 先查锚点、备份后挂 ERR trap，nginx -t、reload、certbot 干跑、logrotate -d 任一失败回滚；C-19；13-11 实跑通过 |
| 13-07 | T-13-21 | Tampering | 恢复演练的临时实例往 R2 写备份、清理自动备份或发邮件 | medium | mitigate | 列备份之前先把临时实例的备份 cron 置空、SMTP 关掉；不加载钩子；18:40–19:20 UTC 拒绝运行；`RuntimeMaxSec=900`；恢复后立刻停；演练备份名不带自动前缀、建完就删（C-22） | closed | `restore-drill.sh` 时间窗拒绝、不加载钩子、RuntimeMaxSec=900、列备份前关 cron 和 SMTP、drill_ 备份建完就删；13-13 DRILL_TEMP_ISOLATED=yes、DRILL_R2_DELETE=ok |
| 13-07 | T-13-22 | Denial of Service | 请求体上限挡住大保存 | low | mitigate | `/api/` 设 5m（应用文档上限 4 MiB 加开销）；验收用接近上限的合成文档在真实线路上存一次（13-15） | closed | `usj-app.conf` /api/ 设 5m（C-14）；真实线路大文档保存在 13-ACCEPTANCE F-4，Phase 16 执行 |
| 13-07 | T-13-40 | Information Disclosure | 恢复演练在已有真实数据之后运行，读到或复制真实账号的数据 | high | mitigate | D-05 按所有者 2026-11-12 的修订：复制之前的机械守卫——线上库里有测试账号约定以外的账号或文档就 `DRILL_GUARD=refused`、非 0 退出、什么都不复制；恢复库也必须只含测试账号；C-22 静态核对守卫在复制之前 | closed | `restore-drill.sh` 守卫在建目录和复制之前、读不出就 refused，恢复库必须只含测试账号；C-22 |
| 13-07 | T-13-23 | Information Disclosure | 演练留下线上库的副本 | medium | mitigate | 副本只在服务器的 `/var/lib/pocketbase-drill`（pocketbase 0700），EXIT trap 无论成败都删掉；真实数据不离开服务器（D-05） | closed | `restore-drill.sh` 演练目录 0700、EXIT trap 必删并核对；13-13 DRILL_CLEANUP=done、DRILL_DIR=absent |
| 13-07 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装任何东西；服务器上只用已有的 nginx、certbot、logrotate、python3、curl、systemd | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-08 | T-13-24 | Information Disclosure | README、验收清单 | low | mitigate | 只写占位；暂存后跑隐私检查；验收结论只记“通过 / 问题”和现象 | closed | `deploy/README.md` 只写占位；验收清单只记“通过 / 问题”；pre-commit 隐私检查 |
| 13-08 | T-13-25 | Information Disclosure | verify-site 的输出 | low | mitigate | 不打印域名、IP、令牌、页面内容，异常只打印类名或 code；运行时一律经 redact.mjs | closed | `verify-site.mjs` 异常只输出类名和 code；运行时经 redact；13-11、13-12、13-14 redact --check clean |
| 13-08 | T-13-26 | Tampering | 上传包与仓库不一致 | medium | mitigate | BD-03 要求服务器文件和迁移与仓库逐字节相同；BD-01 校验和全部通过；BD-09 拦公网 IP 和外部邮箱；包只在被忽略的 `private/deploy-out/` | closed | `verify-site.mjs` BD-01、BD-03、BD-09；`build-site.mjs` 只写被忽略的 private/deploy-out；BUNDLE OK (9 checks) |
| 13-08 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-09 | T-13-27 | Tampering | 批准文本与上传字节不一致 | high | mitigate | 批准清单就是 SHA256SUMS 原文加它自己的 sha256；BD-03 证明包里的服务器文件与仓库逐字节相同；13-10 上传前、上传后、执行前三次核对，任何一次不一致就停下重新请批准 | closed | 13-09 批准清单是 SHA256SUMS 原文加其 sha256；13-10 上传前、上传后、执行前各核对一次 |
| 13-09 | T-13-SC | Tampering | 服务器上的软件来源 | high | mitigate | 不装新包；PocketBase 沿用已装的 0.41.1，02 只核对钉死的 zip sha256 与已装程序一致；SDK 按钉死值核对 | closed | 同 13-06；SDK 按钉死值核对（BD-08）；BUNDLE OK |
| 13-10 | T-13-28 | Tampering | 上传目录被换文件 | medium | mitigate | `mktemp -d` 的 0700 目录；上传后整包核对加文件数；每个脚本执行前在同一条 ssh 里核对自己，脚本入口再核对要读的文件（IN-09） | closed | 13-10 mktemp 0700 目录、服务器端 sha256sum -c 加文件数；脚本入口核对同 T-13-15 |
| 13-10 | T-13-38 | Tampering | 不可回滚的清空在所有者没有再看一眼的情况下执行 | high | mitigate | Task 2 的 blocking-human 即时确认原样贴出命令、清单行和 07 的参数，并复述 A12 选择；Task 1 的 verify 核对参数与选择一致；没有确认 Task 3 不开始 | closed | 13-10 即时确认原话「确认执行第一批」、命令文件 sha256、A12=keep；没有执行 --wipe |
| 13-10 | T-13-SC | Tampering | 服务器上的软件来源 | high | mitigate | 02 只核对已装的 0.41.1 与钉死的 zip 一致，不下载；不装任何系统包 | closed | PB_ZIP_SHA256_MATCH=yes、PB_BINARY_MATCHES_ZIP=yes、PB_INSTALL=already；deploy/ 无 apt、pip、npm 安装命令 |
| 13-11 | T-13-29 | Information Disclosure | 钥匙、超级用户邮箱和口令进入 Claude 的上下文 | high | mitigate | 钥匙显示和超级用户创建只由所有者在自己的网页终端会话里做，Claude 从不运行 `sudo cat`、不读环境文件；脚本从不打印钥匙；状态只输出长度是否正确和个数；SUMMARY 提交前 `redact.mjs --check` | closed | 13-11 钥匙只由所有者在网页终端保存；Claude 没有 sudo cat、没读环境文件、没建超级用户；redact --check clean |
| 13-11 | T-13-SC | Tampering | 服务器上的软件来源 | high | mitigate | 不装任何系统包；PocketBase 沿用已核对的 0.41.1 | closed | 没有装系统包，PB_BINARY_VERSION=0.41.1；F-07 SDK 哈希 PASS |
| 13-12 | T-13-30 | Denial of Service | 两步验证锁死后台 | high | mitigate | 测试邮件确认收到之后才打开 OTP 和 MFA（Task 2 的顺序和 resume-signal）；锁死时用网页终端的 `pb-admin.sh superuser otp` 生成一次性码 | closed | 13-12 测试邮件收到后才开 OTP 和 MFA（所有者自述）；恢复路径 `pb-admin.sh superuser otp`、README |
| 13-12 | T-13-31 | Information Disclosure | R2 桶和令牌 | medium | mitigate | 所有者建私有桶、只限这个桶的 Object Read & Write 令牌；密钥只填进后台、经 PB_ENCRYPTION_KEY 加密存储；可选生命周期规则兜底 | closed | 13-12 私有桶、只限该桶的读写令牌（所有者自述）；DB_SETTINGS_ENCRYPTED=yes |
| 13-12 | T-13-39 | Denial of Service | 重启在所有者不知情的时刻造成中断 | medium | mitigate | 重启命令原文在 Task 2 的 blocking-human 检查点里贴出、所有者确认后才执行；重启后只读核对全部服务自动恢复，不做手动修复 | closed | 13-12 重启命令原文贴出、所有者「确认重启」后执行；重启后只读核对 |
| 13-12 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何东西 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-13 | T-13-32 | Tampering | 演练影响线上实例或自动备份 | high | mitigate | 运行前核对工具 sha256 并在即时确认里贴出；脚本只以 `mode=ro` 读线上库、从不操作 pocketbase 单元；临时实例另用端口和目录、先关 cron 和 SMTP、不加载钩子、15 分钟自动结束、避开备份时间窗；演练后只读确认线上健康、临时目录已删（C-22 已静态核对） | closed | 13-13 工具 sha256 等于批准值并贴出；`restore-drill.sh` 线上库 mode=ro、只操作 usj-drill 单元、另用端口和目录；演练后 PB active、DRILL_DIR=absent |
| 13-13 | T-13-41 | Information Disclosure | 有真实数据之后做演练（运行时一侧；模板一侧是 13-07 的 T-13-40） | high | mitigate | D-05 按所有者 2026-11-12 的修订：Task 1 先只读确认 `DB_USERS_NONTEST=0`、`DB_DOCS_NONTEST=0`，演练脚本复制前再由守卫检查一次，`DRILL_GUARD=ok` 是 verify 的必需项 | closed | 13-13 先只读确认 DB_USERS_NONTEST=0、DB_DOCS_NONTEST=0；DRILL_GUARD=ok；DRILL_RESTORED_TEST_ONLY=yes |
| 13-13 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何东西 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |
| 13-14 | T-13-33 | Tampering | 升级时夹带未批准的改动 | medium | mitigate | 与 13-09 批准的清单逐行比较，只许三行变化；上传、核对、执行都只用升级批准清单的 13 行 | closed | 所有者批准的偏离：选「部署现在的新版本」后「批准」；恰好 5 个路径变化、其余 27 行相同；上传核对执行只用 13 行（UPLOAD_CHECK=ok FILES=13）；`git diff d45af01..HEAD -- deploy/` 只有清单变过 |
| 13-14 | T-13-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何东西 | closed | 接受：本计划不安装、不下载；`git diff 32bbf45..HEAD -- package.json package-lock.json` 为空 |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

52 行、39 个唯一 ID（T-13-01..T-13-33、T-13-37..T-13-41、T-13-SC；没有 T-13-34..36）；41 行 mitigate、11 行 accept，全部 closed。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-13-01 | T-13-13 | 请求日志记客户端 IP：所有者决定记 IP、留 30 天（D-03）；日志只在服务器上，logAuthId 关闭，检查脚本只输出是否一致 | 所有者（D-03） | 2026-11-12 |
| AR-13-02 | T-13-SC（13-01、02、03、04、05、07、08、12、13、14） | 这 10 个计划不安装、不下载任何包；13-04 复制 SDK 前按钉死 sha256 核对，13-05 只用已批准、sha256 钉死的本机 0.41.1；package.json 和 lockfile 在本阶段没有变化 | 计划登记（accept） | 2026-11-17 |

*Accepted risks do not resurface in future audit runs.*

---

## 留给 Phase 16 的人工复核（不计入 threats_open）

- T-13-22：真实线路上保存一份接近上限的合成文档（13-ACCEPTANCE F-4）。
- T-13-11：次日回看 R2 新备份和邮箱（13-ACCEPTANCE I-4）。
- K-2：R2 里没有残留的 `drill_` 演练备份（`DRILL_R2_DELETE=ok` 已证明删除成功）。
- T-13-30、T-13-31 的部分证据是所有者自述（测试邮件已收到；R2 桶私有、令牌只限该桶），审计无法独立核实，以 SUMMARY 记录为准。

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-17 | 52 | 52 | 0 | gsd-security-auditor（opus），由执行阶段的 verify:post 步骤调用 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-17
