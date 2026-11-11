---
phase: "11"
slug: "export-import-migration"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-11"
---

# Phase 11 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只在本机的假 PocketBase 上测试，不连接任何真实服务器，也没有处理任何真实数据。判断依据：
- 11 份计划的 `<threat_model>` 威胁登记（计划阶段写好，`register_authored_at_plan_time: true`），共 30 条不重复的威胁；
- 11 份 SUMMARY 的 Threat Flags 和执行记录（都写“没有登记之外的新威胁”；11-07-SUMMARY 没有这一节，T-11-17 到 T-11-19 直接按代码和用例核对）；
- gsd-security-auditor 在 HEAD 87d648c 上的静态核对（ASVS L1，逐条给出文件行号和覆盖的用例标题）。应用 `us-journey-tracker.html` 最后一次改动在 5e516b4（11-09），迁移脚本 `tools/plan/migrate-backup.mjs` 最后一次改动在 8bf58ec（11-10）；
- 11-11 跑完的完整套件：默认 `npm test` 185 条、`npm run test:cloud` 190 条全部通过（之后只改了文档）。

审计代理只做静态核对：没有运行测试套件，没有以任何模式运行迁移脚本，没有修改仓库里的文件；对 `private/` 只确认了它被 git 忽略、没有被跟踪的文件，没有打开或列出其中的内容。
本阶段没有改动 `package.json`、`package-lock.json` 或 Playwright 配置（`git diff d5d9eeb..HEAD` 为空）。

本文件不含服务器地址、域名、邮箱、口令、令牌或真实数据。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 用户选择的文件 → 页面（导入） | 文件先过大小上限和格式识别（classifyBackup：包装逐项检查、旧备份形状、importProblem），通过后才进摘要确认框；任何一处不合格整份拒绝 | 计划、记录（不可信输入） |
| 页面 → 同源 PocketBase（导入后的上传） | 导入经 takeRemote 和 commit 写入工作数据，计划经 syncOnce 先于记录上传；遇到别处的新版本按 Phase 10 D-03 留底 | 本账号的 plan 和 state 文档 |
| 同一浏览器的另一个标签页 → 本页（storage 事件） | 只处理本账号、文档 id 相同的计划和 state 记录，内容只进挂起槽 | 本机缓存里的计划和 state |
| 本机存储（撤销副本、冲突留底） | `usj:v2:<id>:importundo` 与 `:snapshot` 是两个独立的槽；退出和换账号时清除 | 导入前的计划和记录 |
| 页面 → 下载的文件（导出） | 备份、日历 CSV、留底下载都经 blobDownload；文件名是固定前缀加日期，内容不含账号标识；CSV 公式字符加前缀 | 本账号的计划和记录 |
| 迁移脚本 ↔ `private/`（所有者本机） | 真实输入只在所有者运行默认模式或 `--plan-only` 时读取，输出只写 `private/`（写前用 git check-ignore 确认）；执行者只运行 `--self-test` 和指向 test-results/ 的 `--demo` | 种子计划、原 Artifact 旧备份（真实数据，只在所有者本机） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-11-01 | Tampering | 导入文件内容进入摘要和四个视图（XSS） | high | mitigate | 摘要和 toast 一律 textContent；识别先过 importProblem 再 normalize；视图渲染沿用 esc()；用例只用合成数据 | closed |
| T-11-02 | Tampering | 不是备份的文件被当作备份、清空数据（N3 同类） | high | mitigate | legacyShape：带 format 键一律拒绝、至少一个已知字段且类型都对；被拒只出 toast；`IO-07 the cloud version rejects an empty JSON object with the format error and changes nothing` | closed |
| T-11-03 | Tampering | 导入绕过 commit、被挂起的远端版本冲掉，或重做时生成新 id | high | mitigate | applyImport 先 takeRemote 再 commit(["import"])（run 只读闭包里规范化好的 JSON），之后 opsOk=false；IN-05、IN-06 两条用例 | closed |
| T-11-04 | Information Disclosure | 用例或输出带出真实数据 | medium | mitigate | 导入文件名运行时强制 `synth-` 前缀、内容在内存；backup-files 只有 SYNTH 文字；没有用例读 private/ | closed |
| T-11-05 | Tampering | 包装里的计划或记录部分不合格却被部分导入 | high | mitigate | classifyBackup 逐项检查 app、format、kind、normalizePlan、legacyShape 加 importProblem，任何一处不合格返回 null；20 种不合格包装的单元用例 | closed |
| T-11-06 | Tampering | 计划上传覆盖别处刚写的计划且不留底，或失败后脏标记被清掉 | high | mitigate | syncOnce 上传计划前判断真冲突并先 keepConflict("plan")；seq 不变才清脏；失败走统一 catch；`IO-08 an imported plan that could not be uploaded is retried and reaches the server` | closed |
| T-11-07 | Tampering | 计划里的组名、任务文字进入页面（XSS） | medium | mitigate | normalizePlan 只信类型；组名、任务文字、力量项名、备注渲染时都经 esc；摘要只写计数 | closed |
| T-11-08 | Denial of Service | 同一次导入里计划和 state 都真冲突时一份留底被另一份顶掉 | medium | mitigate | 还没提示过的留底遇到另一种文档的冲突时合成一份 kind "full" 留底（backupOf，told 标记）；reconcileOnce 只提示一次；同一轮、跨两轮两条用例；每个账号仍只一份留底（Phase 9 D-09） | closed |
| T-11-09 | Denial of Service | 超大文件卡住页面或把账号推过云端容量 | high | mitigate | 读文件前先看 5 MB 上限；确认前和应用前各按 normalize 之后的数据比一次 4 MB；三条用例 | closed |
| T-11-10 | Tampering | 导入的上传静默冲掉另一台设备刚写的版本 | high | mitigate | 导入后 opsOk=false，state 和计划遇到真冲突都先留底；四条 import-sync 用例 | closed |
| T-11-11 | Tampering | 另一个标签页在旧计划下采纳导入的 state、丢掉新计划的进度并上传 | high | mitigate | storage 监听先处理计划键，adoptPlanTab 把计划放进挂起槽，docAfter 按它 normalize state；用例检查服务器收到的每一次 state 写入都保留进度 | closed |
| T-11-12 | Spoofing | storage 事件里别的账号或别的文档的记录被采纳 | medium | mitigate | 缓存键按当前账号拼，且要求计划记录 id 等于 docs.plan.id；启动对账进行中直接返回（只有代码证据，计划没有要求专门用例） | closed |
| T-11-13 | Information Disclosure | 退出或换账号后撤销副本留在本机 | high | mitigate | 撤销副本键按账号 id 命名；退出和换账号的清除列表都含 importundo；`IO-08 logout and switching accounts clear the import undo copy and the logout confirm says the undo will be lost` | closed |
| T-11-14 | Denial of Service | 本机空间不够、副本写不进却照样导入 | high | mitigate | 写撤销副本在任何改动之前、包在 try 里，写不进就提示 T_IMP_NO_UNDO 并返回；`IO-08 an import is refused when the data before it cannot be kept on this device` | closed |
| T-11-15 | Tampering | 撤销悄悄抹掉导入后的新修改（含确认框打开期间同步来的修改） | medium | mitigate | dataPrint 指纹比较后先确认；每次确认后 takeRemote 再重算，变了就带 T_UNDO_MORE 再弹一次；最后一次比较到恢复之间没有 await；`IO-08 a change synced in while the undo confirm is open asks again before it is undone (D-05)`；去掉重新比较后该用例失败（11-06 的变异核对） | closed |
| T-11-16 | Tampering | 本机副本被篡改后撤销写回不合格的数据 | low | accept | 见 AR-01 | closed |
| T-11-17 | Tampering | 旧路径接受 {} 这类文件并清空数据（N3） | high | mitigate | 两条路径共用唯一入口 onImportFile → classifyBackup → legacyImport；`IO-07 importing an empty JSON object is rejected with the format error (N3 fixed)` 等用例 | closed |
| T-11-18 | Tampering | 共用入口的重构改变旧路径其他行为 | high | mitigate | 原生确认框文案、“已恢复”及其 1800 ms 时长、格式错误提示与 d5d9eeb 逐字一致；11-07 完整默认套件 184 条通过 | closed |
| T-11-19 | Repudiation | 翻转 test.fail 时改弱断言 | medium | mitigate | B2、N3 的期望断言与 d5d9eeb 的 known-bugs.spec.ts 逐字一致；KNOWN-BUGS.md 有“已修复”一节；tests 里不再有 knownBug('B2'/'N3') | closed |
| T-11-20 | Information Disclosure | 导出的文件名或内容带出邮箱、账号 id | high | mitigate | backupOf 只读计划、记录和时刻；文件名是固定前缀加日期；`IO-06 the exported files carry no account identifier`，计划留底下载同样检查 | closed |
| T-11-21 | Tampering | CSV 公式注入（B7） | high | mitigate | csvCell 给以 `= + - @`、制表符、回车开头的单元格加英文单引号再按规则加引号；独立生成器同规则；`IO-06 calendar cells that start with a formula character get a leading quote (B7)`（金标准行同时约束应用和生成器）；不加 BOM（所有者决定） | closed |
| T-11-22 | Information Disclosure | 测试下载写到磁盘的临时文件残留 | low | mitigate | downloadOf 在 finally 里删除下载；Playwright 配置未改（import-sync 一处直接调用 delete 不在 finally，内容只有合成数据，不影响关闭） | closed |
| T-11-23 | Repudiation | 导出时挂起的远端更新没并入，文件与账号数据不一致 | medium | mitigate | 两个导出处理函数第一句都是 `if(remoteView)applyView();` | closed |
| T-11-24 | Information Disclosure | 迁移脚本打印计划或记录原文（含解析报错） | high | mitigate | reportLines 只输出计数和固定文案；输入经 parseSeedJson 脱敏解析；vm 报错不透传，顶层只打印 SafeError 文字；用例断言输出不含 SYNTH | closed |
| T-11-25 | Information Disclosure | 迁移输出被提交进公开仓库 | high | mitigate | outputPath 只返回 private/ 下的路径，读输入前先 git check-ignore；.gitignore 忽略 `计划手记-*.json` 和 private/；privacy-check 拦截导出前缀；private/ 下没有被跟踪的文件 | closed |
| T-11-26 | Information Disclosure | 执行者运行默认模式处理真实数据 | high | mitigate | 流程约束：11-10 的 prohibitions 只允许 --self-test 和指向 test-results/ 的 --demo；11-10、11-11 的 verify 命令和 SUMMARY 都证实默认模式和 --plan-only 从未运行 | closed |
| T-11-27 | Tampering | 迁移输出的 id 不合法，导入后每轮对账生成新 id（IN-06） | medium | mitigate | 合成复用应用的 classifyBackup、importProblem、importPreview，输出再经 classifyBackup 读回校验；自检覆盖 id 合法性 | closed |
| T-11-28 | Elevation of Privilege | vm 求值的代码逃出沙箱 | low | accept | 见 AR-02 | closed |
| T-11-29 | Information Disclosure | 演练用例运行默认模式读真实数据，或把演示输出留在仓库里 | high | mitigate | 用例只以 --demo（testInfo.outputPath，在 test-results/ 下）和 --self-test 调用，finally 里删除演示目录；test-results/ 被忽略；没有残留目录或被跟踪的演示文件 | closed |
| T-11-SC | Tampering | npm、pip、cargo 安装 | low | accept | 见 AR-03 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-11-16 | 撤销副本只在本机、只由本页写入；undoGet 只认对象形状；写回后的加载和对账照常经 normalize 和 usePlan 修正。能改本机存储的人本来就能直接改缓存 | 计划阶段登记（low），待所有者确认 | 2026-11-11 |
| AR-02 | T-11-28 | 迁移脚本用 node:vm 求值的是仓库里自己的应用文件，输入是所有者自己的文件；vm 不是安全边界，与 extract-plan.mjs 同一前提；新的空上下文、5 秒超时 | 计划阶段登记（low），待所有者确认 | 2026-11-11 |
| AR-03 | T-11-SC | 本阶段不安装、不下载任何包，依赖文件和 Playwright 配置无改动（git diff 为空） | 计划阶段登记（low） | 2026-11-11 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-11 | 30 | 30 | 0 | gsd-security-auditor（/gsd-secure-phase 11，ASVS L1 静态核对，HEAD 87d648c） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-11（AR-01、AR-02 待所有者确认）
