---
phase: "16"
slug: "release-acceptance"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-22"
---

# Phase 16 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段做了这几件事：一个修复版本（16-01 到 16-04），它的发布（16-05），以及总体验收清单（16-06 到 16-08）。所有者按 D-19 跳过了总体验收，又按 D-20 先不迁移旧数据、不做导入后演练。判断依据：

- **威胁登记：** 8 份计划的 `<threat_model>` 都是在计划阶段写好的（`register_authored_at_plan_time: true`），共 35 条不重复的威胁：
  - 29 条 mitigate；
  - T-16-05、T-16-22、T-16-26、T-16-SC 共 4 条 accept；
  - T-16-SC 在 8 份计划里各出现一次，都写"本计划不安装、不下载任何东西"。
- **Threat Flags：** 16-01、16-02、16-03、16-06、16-07 的 SUMMARY 都写没有新的网络端点、认证路径或信任边界。
- **核对方式：** ASVS L1，block_on high，由编排者按 L1 深度核对：
  - 写在代码里的缓解措施，逐条在仓库里 grep 到对应实现（见下表）；
  - 写在流程里的缓解措施，以 16-04、16-05 的 SUMMARY 记录为依据；
  - 演练和迁移没有执行，相关威胁没有发生的条件，按"不适用"关闭。
- **唯一一条需要所有者决定的高风险是 T-16-24**（旧页面保存会冲掉训练数据）。所有者 2026-11-22 确认：每台用过这个应用的设备、每个标签页都能看到「健身」标签和 kg/lb 开关。据此关闭。

核对完时 `threats_open: 0`，按 workflow 的短路规则（L1、计划阶段写好的登记）没有再派 gsd-security-auditor。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 本机构建 → 服务器 | 只上传批准清单里的文件，由 root 执行的只有 03、06 | 部署脚本、站点文件（公开代码） |
| 上传包里的服务器脚本 → root 执行 | 所有者批准的文本就是要执行的文本，静态检查守住行为 | 服务器配置 |
| 部署瞬间的 nginx 配置 → 浏览器和 Service Worker 缓存 | 页面和 CSP 头必须始终配对，否则缓存里会留下白屏页 | 页面外壳、CSP 头 |
| 构建产物 / Service Worker → 浏览器缓存 | 外壳版本号决定老用户什么时候换到新的页面和 CSP | 页面外壳 |
| 旧版本页面 → 服务器上的文档 | 旧页面保存时会丢掉它不认识的键，冲掉训练数据 | 账号数据（真实、敏感） |
| 本机检查脚本 → 线上站点 | F-11 等线上检查要对公网站点发请求，但不能改线上数据 | 探测请求 |
| 线上全量检查 → 后台登录限流 | 故意失败的登录会让本机 IP 暂时登不了后台 | 登录尝试 |
| 服务器输出 / 演练输出 → 终端、SUMMARY | 先过 redact，只留键值和计数 | 运维输出（可能带地址） |
| 恢复演练 → 线上库和 R2 | 只读线上库，只在 0700 临时目录里起临时实例，`drill_` 备份当场删掉 | 备份（含真实数据时为敏感） |
| 所有者的真实旧备份 → 本机迁移脚本 → 正式账号 | 只在所有者手里，Claude 不读 | 真实数据（敏感） |
| 所有者的回报 → 公开仓库里的清单 | 只记结论和"一致与否"，不带个人信息 | 验收结论 |
| 合成数据生成器 → 本机磁盘 | 只写被忽略的目录，只写合成内容 | 合成数据 |
| 本机测试静态服务器 → 同时打开的其他网页 | 只绑回环，但浏览器里别的页面能向它发简单请求 | 测试版本开关 |
| 本机测试 → 网络 | 测试全程拦截外部请求，只用假服务器 | 无 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-16-01 | Tampering | 06 换页面和 CSP 的窗口里 SW 缓存白屏页 | high | mitigate | `deploy/server/06-install-site.sh` 的 `csp_union` 过渡 CSP 两步 reload；`deploy/server-check.mjs` C-20 / C-24 守住顺序和合并函数 | closed |
| T-16-02 | Denial of Service | 03 为换一个工具文件而要求停服务 | medium | mitigate | 停服务的条件只由迁移、钩子、环境文件决定；`server-check.mjs` C-25 | closed |
| T-16-03 | Repudiation | 恢复演练用陈旧备份或零比对也通过 | medium | mitigate | `deploy/server/restore-drill.sh` 第 273 行 `AGE_H -gt 40` 退出；`DRILL_DOCS_COMPARED` 小于 1 不通过；按快照边界比对 | closed |
| T-16-04 | Denial of Service | 04 覆盖 unit 不留后路 | medium | mitigate | `deploy/server/04-start-pocketbase.sh` 覆盖前 `cp -p` 备份，失败路径放回；C-07 | closed |
| T-16-05 | Elevation of Privilege | 过渡 CSP 在几秒内同时放行旧、新内联块 | low | accept | 见 Accepted Risks AR-16-01 | closed |
| T-16-06 | Information Disclosure | C-24 的问题文字或演练的新键泄露内容 | low | mitigate | C-24 只报组号；`DRILL_DOCS_MISSING_LIVE` 只是计数；C-22 要求输出键都带 `DRILL_` 前缀 | closed |
| T-16-07 | Tampering | HSTS 期望值写死在两处，只改一处 | low | mitigate | 单一常量 `HSTS_MAX_AGE`，`deploy/verify-site.mjs` 和 `deploy/server-check.mjs` 共用 | closed |
| T-16-08 | Spoofing | F-11 在注册规则失效时会在线上建账号 | medium | mitigate | `verify-site.mjs` 改用缺字段请求，判定常量取自 ACCT03-6/7 的实测状态码（16-REVIEW WR-02、WR-03 另有加固建议） | closed |
| T-16-09 | Tampering | 只改 CSP 的发布不换外壳版本 | low | mitigate | `deploy/build-site.mjs` 的 shellVersion 把 `cspConfText` 算进去 | closed |
| T-16-10 | Tampering | `data-src` 的内联脚本没有进 CSP | low | mitigate | `build-site.mjs` 的正则要求 `src` 前是空白；`deploy-tools.spec.ts` 覆盖 `data-src` | closed |
| T-16-11 | Information Disclosure | README 宣称令牌不进日志，实际会进 | low | mitigate | `deploy/README.md` 第 2 节如实写明错误日志含短时令牌、只留在服务器上 | closed |
| T-16-12 | Denial of Service | 点了「点此更新」，等待中的 worker 不接管 | low | mitigate | `us-journey-tracker.html` 第 2463 行：4 秒后兜底刷新，`swReloaded` 防止重复（16-REVIEW WR-04：兜底前没有重新检查草稿） | closed |
| T-16-13 | Tampering | 改了应用却没重新记录基线 | medium | mitigate | `tests/support/constants.ts` 的 `APP_SHA256` 与当前应用一致（16-REVIEW 已核对） | closed |
| T-16-14 | Tampering | activate 误删同源的其他缓存 | low | mitigate | `deploy/site/sw.js` 只删 `usj-shell-` 前缀的缓存；install 失败时 `caches.delete(CACHE)`（16-REVIEW WR-01 另有边界情况） | closed |
| T-16-15 | Tampering | 开发者浏览的网页改测试版本开关 | low | mitigate | `tests/support/static-server.cjs` 要求带 `x-usj-test` 头，跨站请求要先过预检 | closed |
| T-16-16 | Information Disclosure | 16-ACCEPTANCE.md 带上网址、账号 | medium | mitigate | 清单只写占位说明；verify 拒绝网址；暂存后跑隐私检查 | closed |
| T-16-17 | Information Disclosure | backstop 合成文件混入真实内容 | low | mitigate | `deploy/make-acceptance-data.mjs` 文字全部以 `SYNTH-1316` 开头；写之前先 `git check-ignore` | closed |
| T-16-18 | Tampering | 发布的不是测过的代码 | medium | mitigate | 16-04-SUMMARY：全量回归时 app、deploy、tests、tools 没有未提交的改动，16-05 在同一提交上构建 | closed |
| T-16-19 | Tampering | 发布夹带未批准的改动或命令 | high | mitigate | 16-05-SUMMARY：22 行批准清单，`UPLOAD_CHECK=ok`，只执行确认过的命令 | closed |
| T-16-20 | Information Disclosure | 服务器输出带出域名、IP | medium | mitigate | 16-05-SUMMARY：输出都经 redact 和 `--check`，SUMMARY 只写键值 | closed |
| T-16-21 | Denial of Service | 03 在服务运行时拒绝执行，或停掉线上服务 | medium | mitigate | 16-05-SUMMARY：`PB_CONFIGURE=done`，服务一直 active | closed |
| T-16-22 | Denial of Service | 线上全量检查让所有者的 IP 暂时登不了后台 | low | accept | 见 Accepted Risks AR-16-02 | closed |
| T-16-23 | Tampering | 06 两步 reload 中途失败，留下不配对的状态 | medium | mitigate | 06 的 ERR 回滚把旧链接和旧 CSP 放回（C-20）；16-05 的 `VERIFY OK` | closed |
| T-16-24 | Tampering | 设备上缓存的旧页面（Phase 15 之前）保存，冲掉训练数据 | high | mitigate | 所有者 2026-11-22 确认：每台设备、每个标签页都能看到「健身」标签和 kg/lb 开关（16-ACCEPTANCE E-5） | closed |
| T-16-25 | Information Disclosure | 回报或截图里的账号、邮箱进入清单 | medium | mitigate | 清单只记「通过 / 问题 / 不适用」，没有网址；提交前跑隐私检查 | closed |
| T-16-26 | Spoofing | 协助操作中国大陆设备的人拿到测试账号 | low | accept | 见 Accepted Risks AR-16-03 | closed |
| T-16-27 | Tampering | 有会丢数据的问题时仍然开始迁移 | high | mitigate | 不适用：J 没有开始（D-20）；D-10 的「挡迁移」规则保留在清单里，以后补做 J 时照用 | closed |
| T-16-28 | Information Disclosure | 真实旧备份和迁移结果 | high | mitigate | 迁移没有执行（D-20）；Claude 没有读 `private/`，也没有运行默认模式的迁移脚本 | closed |
| T-16-29 | Tampering | 导入的数据和旧备份对不上 | medium | mitigate | 不适用：没有导入（D-20） | closed |
| T-16-30 | Tampering | 测试账号留在线上，或误删真实账号 | medium | mitigate | 只读状态 `DB_USERS_COUNT=1`、`DB_USERS_NONTEST=1`（2026-11-22，quick 261121-uax 上线前后） | closed |
| T-16-31 | Information Disclosure | 导入后演练复制含真实数据的备份 | high | mitigate | 不适用：演练没有运行（D-20），没有产生副本 | closed |
| T-16-32 | Repudiation | 演练在备份时间窗里运行 | medium | mitigate | 不适用：演练没有运行；脚本自身的 `DRILL_WINDOW_OK` 守卫保留 | closed |
| T-16-33 | Tampering | 演练用了删测试账号之前的备份 | low | mitigate | 不适用：演练没有运行 | closed |
| T-16-34 | Information Disclosure | 验收结论进入公开仓库时带上个人信息 | medium | mitigate | 清单只写结论和计数，没有网址；提交前跑隐私检查 | closed |
| T-16-SC | Tampering | npm、pip、cargo 安装；PocketBase 二进制 | low | accept | 见 Accepted Risks AR-16-04 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-16-01 | T-16-05 | 过渡 CSP 只多放行旧页面里逐字节相同的内联块（按哈希锁定内容），不放开任何 `unsafe-` 关键字；下一次外壳版本变化时就被替换 | 16-01 计划（所有者批准计划） | 2026-11-17 |
| AR-16-02 | T-16-22 | 线上全量检查本来就要证明登录限流有效；发布前已经告诉所有者，等一分钟再登录后台 | 16-05 计划（所有者批准发布） | 2026-11-18 |
| AR-16-03 | T-16-26 | 协助的人只碰测试账号和合成数据，口令由所有者自己交接；按 D-19 没有做真机验收，测试账号已删（`DB_USERS_NONTEST` 等于 `DB_USERS_COUNT`） | 16-06 计划 | 2026-11-17 |
| AR-16-04 | T-16-SC | 本阶段不安装、不下载任何东西；`npm run pb:isolation` 只用已批准并钉死哈希的本机程序 | 各计划 | 2026-11-17 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-22 | 35 | 35 | 0 | 编排者（Claude Opus，ASVS L1 grep 核对）；T-16-24 由所有者确认 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-22
