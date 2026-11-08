---
phase: "06"
slug: "procurement-reachability-probe"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-08"
---

# Phase 06 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

服务器端的缓解措施，Claude 不能连服务器复核，判断依据有两类：一是仓库里的脚本、unit 和 nginx 文件，二是各 SUMMARY 里记录的执行输出（已脱敏）。本文件不含服务器地址、域名、邮箱或口令。

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 工作区 → 暂存区/提交 | pre-commit 钩子在这里跑 --staged，新规则在这里拦令牌、口令、数据文件和地址 |
| 检查器输出 → 终端、钩子日志、SUMMARY | 命中原文一旦打印就等于泄露 |
| 规划文档 → 公开仓库 | 文档改写时最容易顺手写进真实域名或 IP |
| generate-claude-md → .claude/CLAUDE.md | 生成器会改写整份文件，并把本机被忽略的目录内容带进来 |
| 服务器导出的结果 → 本机汇总 | 结果来自公开的探针账号，任何人都可能写入垃圾数据 |
| 汇总输出 → 公开仓库的结果文档 | 输出会被提交 |
| 临时仓库 → 主仓库 | 演练只能在临时仓库里构造违规提交 |
| 服务器输出 → 终端、SUMMARY、提交 | 未过滤的输出会带出域名和 IP |
| git 检出 → 脚本和 SDK 字节 | autocrlf 会改换行，进而改哈希或让 bash 报错 |
| npm registry → 本机 vendor 目录 | 第三方代码进入公开仓库并被页面加载 |
| 测试人的浏览器 → 探针页 → PocketBase | 页面运行在不受信任的网络里，凭据是公开的合成账号 |
| 探针页 → probe_results | 上传的数据进入服务器，之后汇总进公开文档 |
| 本机仓库 → 服务器（ssh） | 脚本内容决定服务器上发生什么；只读与改动要分开 |
| 维护者站点 → 服务器 | PocketBase 二进制的来源，单一来源 |
| 服务器输出 → 本机终端、SUMMARY | 可能带出域名、IP、口令 |
| 公网 → nginx → PocketBase | 测试人和任何扫描者都经 443 进入；8090 只能经 nginx |
| nginx 配置 → certbot 续期 | certbot 的 nginx 插件要解析整份配置 |
| verify-site → 终端 | 外部检查的输出可能带出主机名和凭据 |
| 已批准的脚本 → 实际执行的脚本 | 两者必须逐字节相同 |
| 所有者 → 网页终端 → PocketBase | 超级用户口令只在这条路上出现 |
| 服务器输出 → SUMMARY | 可能带出域名、IP |
| 公网 → 443 → nginx → 127.0.0.1:8090 | 探针站点从此对外可见 |
| 云控制台防火墙 | Claude 看不到的外层，只能由所有者确认 |
| 公开的探针口令 → probe_results、probe_pings | 任何能打开页面的人都能写入 |
| 服务器数据库 → 本机 private/ | 只读导出，经 Task 1 所有者批准后才运行（D-17，共两次），原始数据只留在本机 |
| 本机脚本 → 服务器上以 root 运行的 python3 | 运行的必须是所有者在 Task 1 看过全文、sha256 被钉住的那份 export-results.py（D-04 的审阅原则） |
| 本机汇总 → 公开仓库的结果文档 | 结果文档会被提交 |
| 所有者转录的测速数据 → 结果文档 | 原始输出含域名和 IP |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-06-01 | Information Disclosure | 规则 F、G、H 的报告文案 | high | mitigate | F、G、H 用固定文案、不带原文；自检断言输出里没有原文（privacy-check.mjs） | closed |
| T-06-02 | Information Disclosure | 令牌、口令、数据库、备份、域名或 IP 进入公开仓库（形状没被识别） | high | mitigate | 规则 A 扩展，新增 F、G、H，D 改为不区分大小写；hook-drill 用真实钩子演练通过 | closed |
| T-06-03 | Tampering | 为了通过检查而加放行名单或豁免 | medium | mitigate | 06-01 没有加放行名单。cae2c04 的推送例外清单是所有者批准的偏离，见 AR-02 | closed |
| T-06-SC | Tampering | npm、pip、cargo 安装与下载 | high | mitigate | 没有安装任何包；SDK 和 PocketBase 的下载都经所有者批准，并做双重哈希核对 | closed |
| T-06-04 | Information Disclosure | 改写后的 PROJECT/REQUIREMENTS/ROADMAP/CLAUDE.md/STATE 里出现真实域名或 IP | high | mitigate | 规划文档里没有公网地址和域名；pre-commit 的规则 D、H 兜底 | closed |
| T-06-05 | Tampering | CLAUDE.md 的其他段被生成器改写、技能段带进本机 .agents 路径 | medium | mitigate | CLAUDE.md 只重写 Project 段，其余部分逐字不变 | closed |
| T-06-06 | Information Disclosure | 汇总输出 | medium | mitigate | summarize 只输出枚举和数字，run_id 只取前 4 位，契约外的键名也清洗 | closed |
| T-06-07 | Tampering | 有人用公开的探针口令灌入假结果，扭曲达标率 | low | mitigate | 剔除无效运行；表 2 逐条列出每次运行；单独一节人工核对 | closed |
| T-06-29 | Tampering | 写入方、迁移、导出方和汇总方的字段表各自漂移，汇总悄悄丢掉或误读记录 | medium | mitigate | schema-check 的 migration、page、export 三种模式都 SCHEMA MATCH | closed |
| T-06-08 | Tampering | 演练污染主仓库或留下临时目录；演练为了构造违规历史而养成绕过钩子的写法 | medium | mitigate | hook-drill 只在临时仓库里构造违规提交，finally 中清理；源码里没有 --no-verify | closed |
| T-06-09 | Information Disclosure | redact 在缺少 private 文件时原样转发输出 | high | mitigate | 两份私有文件都缺时退出码 2；--verify-env 已对真实值通过。残余 WR-06，见下文 | closed |
| T-06-10 | Tampering | vendor SDK 或服务器脚本在检出时被换行转换 | medium | mitigate | .gitattributes：tools/probe/** 设 eol=lf，vendor/** 设 -text | closed |
| T-06-11 | Tampering | 页面把数据当 HTML 插入导致脚本注入 | medium | mitigate | 页面只用 textContent 写入数据 | closed |
| T-06-12 | Tampering | SDK 文件被篡改或拿错版本 | high | mitigate | SHA256SUMS 在本机和服务器各核对一次；F-02 通过 | closed |
| T-06-13 | Information Disclosure | 探针页收集个人信息 | medium | mitigate | UA 只粗分类；只上传契约里的字段；截图不带地址栏 | closed |
| T-06-14 | Tampering | PocketBase 二进制被篡改或下载损坏 | high | mitigate | 只走 https；钉死 sha256，并与 checksums.txt 核对；检查版本号 | closed |
| T-06-15 | Tampering | 经 bash -s 执行时脚本被中途读标准输入的命令吞掉一部分，造成半执行 | medium | mitigate | 可能读标准输入的命令都加 </dev/null；输出以 STATUS_DONE 结尾；改服务器的脚本先上传再执行 | closed |
| T-06-16 | Information Disclosure | 探针账号口令进入仓库、终端或日志 | medium | mitigate | 口令在服务器上生成，文件权限 0600，不上命令行；仓库里只有占位 | closed |
| T-06-17 | Elevation of Privilege | 未经批准就用 sudo 改服务器 | high | mitigate | 先跑只读脚本；批次 A、B 经 blocking-human 检查点批准；一律用 sudo -n | closed |
| T-06-30 | Tampering | 上传整个目录把还没批准的文件（批次 B 脚本、unit、nginx 片段）提前放到服务器 | high | mitigate | 只打包清单里的文件，并核对服务器上的文件数 | closed |
| T-06-31 | Denial of Service | 03 脚本往还不存在的网页目录写 config.js，在 set -e 下中途失败，留下只有迁移没有 config.js 的半配置 | medium | mitigate | 先建目录；区分「已完成」和「半配置」，半配置时报错退出 | closed |
| T-06-18 | Denial of Service | SSE 被代理缓冲或掐断 | medium | mitigate | nginx 的 SSE 位置关闭缓冲、用 HTTP/1.1、超时 3600s；F-13 推送 199 ms | closed |
| T-06-19 | Denial of Service | 改 nginx 后证书续期悄悄失败 | high | mitigate | nginx -t、reload、certbot dry-run 任一失败即回滚。残余 WR-09 | closed |
| T-06-32 | Tampering | 唯一的锚点恰好在 :80 块里，include 挂到错误的 server 上，SSE 设置悄悄不生效 | medium | mitigate | 锚点必须唯一，且 anchor-block.awk 输出 443ssl，两项都在备份前检查 | closed |
| T-06-20 | Information Disclosure | 8090 对外暴露 | high | mitigate | 只绑定 127.0.0.1；F-05 从外部连不上；控制台防火墙由所有者确认。残余 WR-08 | closed |
| T-06-21 | Spoofing | 公开的 /_/ 后台被暴力猜口令（D-13 接受的风险） | medium | accept | 接受（D-13）：靠强密码、PocketBase 限流和全站只有合成数据兜底，见 AR-01 | closed |
| T-06-22 | Information Disclosure | 超级用户口令进入 shell 历史、sudo 日志、Claude 的上下文或文件 | high | mitigate | 所有者在网页终端用 read -rs 自己执行；Claude 只读超级用户个数。残余 IN-06 | closed |
| T-06-23 | Tampering | 执行的脚本与批准的不同，或服务器上出现还没批准的文件 | high | mitigate | 上传前、上传后、执行前三次核对 sha256；现文件与批准清单 15/15 一致 | closed |
| T-06-24 | Denial of Service | 小内存服务器 OOM 拖垮 nginx 和 sshd | medium | mitigate | 1 GB swap，加 MemoryHigh、MemoryMax、OOMScoreAdjust | closed |
| T-06-25 | Tampering | 有人用公开的探针口令灌数据 | low | mitigate | 限流、字段上限、请求体 1m、list/view 规则为 null、链接不公开。残余 WR-10 | closed |
| T-06-26 | Information Disclosure | 服务器日志留下测试人的 IP 和设备信息 | low | mitigate | access_log off；logIP=false；日志保留 2 天 | closed |
| T-06-33 | Tampering | 执行或上传的批次 B 文件与批准的不同，或把没批准的文件放上服务器 | high | mitigate | 批次 B 三次核对 sha256；上传目录已删除 | closed |
| T-06-27 | Information Disclosure | 结果文档带出域名、IP、截图或测试人信息 | high | mitigate | 结果文档只有枚举和数字；redact --check 和 privacy-check 都通过 | closed |
| T-06-28 | Repudiation | 结论被灌入的假数据或无效运行扭曲，被手改的表格数字掩盖，或写成与 D-08 相反的建议 | medium | mitigate | 判定写在代码里；--block 重跑后 diff 为 0。残余 CR-01、CR-02：重测前必须修 | closed |
| T-06-34 | Tampering | 以 root 运行的 export-results.py 与所有者批准时看到的不同（批准后被改过，或批准时还没写） | high | mitigate | 导出前在同一条命令链里核对 sha256；mode=ro；只有一条 SELECT | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-06-21 | 探针阶段 PocketBase 后台 `/_/` 对公网开放（D-13），靠强密码和 PocketBase 限流保护（F-14 返回 429，`DB_SETTINGS_RATELIMITS=true`），全站只有合成数据。两步验证、IP 白名单和后台限流加固放到 Phase 13 | 所有者（06-CONTEXT D-13） | 2026-11-07 |
| AR-02 | T-06-03 | 推送检查加了窄例外清单 `tools/privacy/push-exceptions.txt`（cae2c04），只用于 `--push`，只能放行规则 H；必须同时匹配完整提交号、文件和行号，并写明原因，格式不对一律阻止推送。目前只放行 08eb8dc、cd645d6 里那个随手写的示例地址：与本项目服务器无关，0fa5cea 已改成文档保留地址。所有者选了这个办法，没有改写历史 | 所有者 | 2026-11-08 |

*Accepted risks do not resurface in future audit runs.*

---

## 残余风险（不阻塞，记下备查）

审计把下面这些都判为不影响威胁关闭，但实现里确有缺陷。编号对应 06-REVIEW.md，在 06-REVIEW-DISPOSITION.md 中仍是 open。

- **WR-06（T-06-09）：** `redact.mjs` 的 `found` 只看文件在不在。`private/server.env` 存在但没有值、denylist 也没有词条时，会原样输出，`--check` 也报 clean。目前两份文件都有值，所以没有触发。最小修法：把 `found` 改成按「有没有可替换的值」判断，并补一条自检。建议 Phase 13 之前修。
- **CR-01、CR-02（T-06-28）：** 探针页把 `tz_offset_min` 截成不小于 0，登录失败的结果也传不上去。本阶段结论没有受影响：有效运行数为 0，各运营商都记「样本不足」。探针页再用来测之前必须先修，否则 T-06-28 应重新打开。
- **WR-10、WR-02（T-06-25）：** 汇总没有自动异常检测；F-11 只证明了「列出」被拒。规则本身由迁移源码和 `DB_USERS_RULES_LOCKED=yes` 佐证。
- **WR-07、WR-08、WR-09（T-06-24、T-06-20、T-06-19）：** 只在重跑或重装时有影响：swap 已启用时不补写 fstab；失败路径只 stop、不 disable；05 脚本没有 ERR trap。
- **IN-06（T-06-22）：** 执行超级用户命令的那一瞬间，口令会出现在进程参数里。
- **IN-09（T-06-23、T-06-30、T-06-33）：** 固定的 `/tmp` 上传目录，核对和使用之间有时间窗口。服务器只有一个使用者，风险低。
- **文档缺口（AR-02）：** PRIVACY.md 还没有提到推送例外清单，§5 写的「不设放行名单或豁免」讲的是规则 D，容易误读。建议在 §3 补一句说明。

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-08 | 35 | 35 | 0 | gsd-security-auditor（ASVS L1，block_on high；逐条核对，离线自检全部通过） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-08
