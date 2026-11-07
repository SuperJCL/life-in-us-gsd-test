---
phase: "07"
slug: "id-plan-extraction-stable-ids-escaping"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-07"
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 本机 private/ → 仓库 | 原件副本和种子含所有者的原计划，只能留在本机 |
| 工具 → 终端、SUMMARY、提交说明 | 提取和检查的输出会被执行者转述进公开仓库 |
| 种子 → 隐私检查 | 规则 D 的词条从此只来自种子和 denylist |
| 本机 → npm registry | 本计划不应产生任何下载或安装 |
| 示例计划 → 公开仓库（07-04） | DEFAULT_PLAN 会随应用公开，必须与原计划不共享文字和数字 |
| 旧备份 → 应用 | 旧格式备份里的位置 id 必须对回同一项任务 |
| 测试进程 → 应用源码 | app-source.ts 在 Node 里求值应用的纯函数段 |
| window.USJ_CONFIG → 应用 | 页面外部注入的配置决定存储路径 |
| 应用文件 → SAFE-02 基线 | 基线决定“应用是否被有意地改过” |
| 本机仓库 → 公开 GitHub | 本计划只在本机提交；推送是另一个需要所有者确认的动作 |
| 暂存区 → 提交 | pre-commit 规则 A、D 在这里拦个人内容和私有文件 |
| git 检出 → 应用字节 | autocrlf 可能改字节，进而改 sha256 |
| 临时克隆 → 主仓库 node_modules | 目录联接让克隆借用主仓库的依赖 |
| 导入文件、已存数据 → 渲染 | 备份和存储里的任何字段最终都可能进入 innerHTML 或属性 |
| 计划数据 → 渲染 | Phase 9 起计划来自服务器、Phase 12 起来自编辑页，组名、任务文字、id 都会进入页面 |
| 测试进程 → 页面（内存变体） | page.route 提供改过的应用，只给这一个用例 |
| 用户选的备份文件 → 应用 state | 导入会替换全部数据，Phase 9 起还会同步到服务器和所有设备 |
| localStorage / claude db → 应用 state | 已存数据可能来自旧版本、手改或损坏，Phase 9 起来自服务器 |
| 应用 state → 渲染 | 修正后的数据进入各视图（渲染防线见 07-05，合在一起见 07-07） |
| 已存数据 → 真实应用 → 渲染 | 恶意数据同时经过入口修正（07-06）和渲染转义（07-05） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Information Disclosure | private/ 下的原件副本和种子被提交 | high | mitigate | private/ 已被 .gitignore 忽略、规则 A 拦 private/ 路径；提取工具写种子前用 git check-ignore 确认；verify 断言两者被忽略且 `git ls-files private` 为空；只暂存两个工具文件 | closed |
| T-07-02 | Information Disclosure | 提取和检查工具的输出、自检样例 | high | mitigate | 两个工具只输出计数、编号、行号、字段路径和相对文件名（--check 的种子词条命中只报序号和行号，verify 另用种子核对输出里没有词条原文）；自检样例只用合成文字；执行约束禁止显示原计划所在的行 | closed |
| T-07-03 | Tampering | 规则 D 换来源后漏掉词条，个人文字可以被提交 | high | mitigate | --self-test 断言种子词条包含原件块内提取的全部词条、原件副本仍被规则 D 命中；verify 要求加载的词条不少于 66；种子解析失败时 fail closed（退出码 2） | closed |
| T-07-04 | Elevation of Privilege | node:vm 求值原件副本的常量区 | low | accept | 输入是所有者自己的本机文件而不是不可信输入；只求值两个标记之间的常量和纯函数，空上下文、1 秒超时；vm 不是安全边界这一点写在工具注释里 | closed — accepted（见 AR-07-01） |
| T-07-05 | Information Disclosure | DEFAULT_PLAN 的文字和数字与原计划相同 | high | mitigate | extract-plan.mjs --check 判定共享 4 字片段、种子词条、数值撞车、占位文字全为 0（种子词条命中只报序号和行号，按行号改写）；执行约束禁止阅读原文；07-04 的人工检查再看一遍 | closed |
| T-07-06 | Tampering | 内置任务 id 改变，旧进度落到别的任务上 | medium | mitigate | id 写成显式字面量；stable-ids 用例断言每组位置 id 和旧备份 38 个键逐项对回；normalizePlan 拒绝重复 id | closed |
| T-07-07 | Spoofing | USJ_CONFIG 配了不支持的后端时悄悄退回本地，用户以为数据在云端 | medium | mitigate | backend 非 null 时状态栏显示配置无效、不保存；用例断言 localStorage 为空、导出按钮隐藏 | closed |
| T-07-08 | Information Disclosure | 执行者在终端、SUMMARY 或提交说明里转述原计划 | high | mitigate | 用只打印行数的临时脚本替换计划常量区；--check 只报示例侧的字段路径、字符偏移、词条序号和行号；改写最多 3 轮，之后交给所有者决定，不去读原文；提交经过 pre-commit 规则 D | closed |
| T-07-09 | Information Disclosure | 含个人内容（含短数字）的应用被提交 | high | mitigate | 规则 D 从种子加载不少于 66 个词条后 --staged 通过才提交；--check 判定没有共享片段和相同数字；Task 2 由所有者人工检查；提交经过 pre-commit 钩子；没有种子的机器上 07-01 的种子闸门以退出码 2 阻止涉及应用文件的检查（T-07-26），Task 3 在没有种子的一次性克隆里验证 | closed |
| T-07-10 | Information Disclosure | 种子、原件副本或改名副本被提交 | high | mitigate | private/ 和 `/us-journey-tracker.*.html` 被忽略；规则 A 拦 private/、子目录同名文件和改名副本；verify 断言暂存区和 HEAD 里都没有 private/；SAFE-03 和 SEC-04 用例常驻检查 | closed |
| T-07-11 | Tampering | 克隆检出时换行被转换，SAFE-02 在别人的机器上失败 | medium | mitigate | .gitattributes 固定 eol=lf；干净克隆里比对应用字节与 APP_SHA256；SEC-04 用例检查 eol 属性 | closed |
| T-07-12 | Denial of Service | 删除临时克隆时顺着联接删掉主仓库的 node_modules | medium | mitigate | 先用 cmd //c rmdir 只拆联接，确认联接已不存在才删临时目录，最后确认主仓库 node_modules 仍在；失败时停下报告，不重新安装 | closed |
| T-07-13 | Information Disclosure | 未经确认推送到公开仓库 | high | mitigate | 本阶段不推送；verify 断言 origin/main 上没有应用文件；SUMMARY 写明等待所有者确认推送 | closed — 所有者 2026-11-07 在会话中明确回复“推送”后才推送（`cf574d2..f05878e`，45 个提交）；推送前 pre-push 隐私检查通过，审计复核推送区间无计划文字、每个推上去的应用版本里 `DEFAULT_PLAN` 都等于所有者批准的版本 |
| T-07-14 | Elevation of Privilege | 渲染函数把 id、日期、group、力量当前值、力量历史数值等裸插进属性或 innerHTML（备份或存储里的恶意数据执行脚本，Phase 9 起会变成持久化 XSS 并能读到登录令牌） | high | mitigate | 每个插值点包 esc()；绕过入口检查的变体上用合成载荷走遍四个视图和两个编辑弹窗，断言没有脚本、没有多出元素；计划值（组名、组说明、任务名、力量字段、基础预设、力量组说明）由只改 DEFAULT_PLAN 的内存变体放进载荷，同样走遍四个视图、composer 和两个编辑弹窗；源码门槛防回归 | closed |
| T-07-15 | Tampering | 测试变体泄漏到正式页面或磁盘 | medium | mitigate | 变体只在内存里经 page.route 提供；标记必须恰好出现一次；磁盘文件不改，SAFE-02 照旧通过 | closed |
| T-07-16 | Repudiation | 检测器看不见注入，“干净”的结论是空转 | medium | mitigate | 关掉转义的变体上同样的数据必须被检测到（反向对照用例） | closed |
| T-07-17 | Tampering | 导入带坏 id 或日期的备份，替换全部数据（Phase 9 起会同步到所有设备） | high | mitigate | importProblem 在 normalize 之前检查，任何一项不合格就整份拒绝、不弹确认、不保存；页面用例用 manual 时钟加哨兵证明 state 不变 | closed |
| T-07-18 | Denial of Service | 加载时整份拒绝让页面变空，下次保存覆盖原有数据 | high | mitigate | 加载路径只修正不拒绝；记录文字一条不删；加载本身不保存；单元用例覆盖每条规则，端到端用例断言没有写入、文字都在 | closed |
| T-07-19 | Tampering | 白名单改变 v1 的畸形导入结果或已知 bug 标记；或者反过来，豁免太宽，让类型不对但带坏 id 的容器混进 state | medium | mitigate | 只保留两条豁免（顶层不是普通对象、非字符串的 arrival），容器里能识别出条目就检查；单元用例断言类型不对但带坏条目的容器被拒、识别不出条目的原始值容器经 normalize 后不留坏 id；执行约束点名的 5 个 v1 输入（synth-empty-object.json、synth-b2-import.json、synth-null.json、synth-array.json、synth-wrong-types.json）由单元用例逐个断言返回 null；N3、B2 的对照和标记用例和 IO-04 “不是备份”用例在 Task 1 的 verify 里点名 | closed |
| T-07-20 | Denial of Service | 按 D-08 丢弃孤儿进度键时误删真实进度：修正若对着尚未加载或不完整的计划运行，会把有任务的进度当成孤儿丢掉 | medium | mitigate | 本阶段计划在脚本求值时由 usePlan(DEFAULT_PLAN) 就绪，早于 init 的加载和任何导入；单元用例和页面用例断言 P1-1 和自定义待办的进度保留、只有 P9-9、t-synth 这类孤儿被丢弃；Phase 9 计划和状态分开加载后的风险转给 Phase 9：07-06 的 SUMMARY 写明孤儿键修正只能在账户的计划已知之后运行 | closed |
| T-07-21 | Repudiation | SAFE-02 的基线护栏空转：改了应用却没更新基线也照样通过 | medium | mitigate | 反向对照用例在内存里改一个字节，断言哈希不等于 APP_SHA256；失败文案要求在同一次提交里有意识地更新 | closed |
| T-07-22 | Information Disclosure | 通过 USJ_CONFIG 把所有者的计划带进本机页面（D-11 不允许的入口） | medium | mitigate | readConfig 只读 backend 一个字段；用例给配置带一个合成计划，断言目标页仍是 DEFAULT_PLAN 的 7 组 | closed |
| T-07-23 | Tampering | 钩子文件不改却被当作“已更新”，实际钩子不再调用检查器或路径规则在钩子里不生效 | medium | mitigate | 记录 D-13；verify 断言两个钩子各有一行 exec 检查器、`.githooks` 对象哈希不变；一次性克隆里暂存三个禁止路径，pre-commit 钩子必须以退出码 1 拦下并按规则 A 逐个报出 | closed |
| T-07-24 | Elevation of Privilege | 两道防线各自成立，但真实应用上合在一起时（入口修正后的数据再渲染）仍有脚本执行或多出元素 | high | mitigate | 不用任何变体的真实应用用例走遍四个视图和两个编辑弹窗，断言 readInjection 干净、恶意文字原样显示、保存的 id 和日期合格；完整套件里与 07-05 的变体用例一起常驻 | closed |
| T-07-25 | Information Disclosure | 07-04 之后的应用改动（07-05、07-06）和本计划的提交在阶段末尾被一并推送到公开仓库，没有经过所有者确认 | high | mitigate | 本计划的不变量检查断言 origin/main 上没有应用文件；不运行任何推送命令；SUMMARY 写明等待所有者确认推送 | closed — 所有者 2026-11-07 在会话中明确回复“推送”后才推送（`cf574d2..f05878e`，45 个提交）；推送前 pre-push 隐私检查通过，审计复核推送区间无计划文字、每个推上去的应用版本里 `DEFAULT_PLAN` 都等于所有者批准的版本 |
| T-07-26 | Information Disclosure | 没有种子的机器（例如别人的克隆）上规则 D 只会跳过，07-04 放行根目录应用之后，仍含原计划的应用版本可以被提交或推送（违反成功标准 4） | high | mitigate | seedGate：--staged、--push、--all 的检查范围里有根目录 us-journey-tracker.html 而没有种子时退出码 2（fail closed，种子坏掉同样退出码 2）；只有显式建空种子才能放行；--self-test 覆盖三种情形；本任务 verify 在一次性仓库里端到端验证退出码；07-04 在没有种子的一次性克隆里用已提交的检查器再验证一次 | closed |
| T-07-SC | Tampering | npm、pip、cargo 安装与 npx | high | mitigate | 本计划不新增依赖、不运行安装命令；除 `npx --no playwright` 以外不运行任何 npx；两个工具只用 node: 内置模块 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

逐条证据见本次审计（gsd-security-auditor）：缓解都能在代码或已记录的测试报告里找到，主要证据包括 `test-results/07-fix-full.json`（`REPORT OK expected=173 flaky=0 unexpected=0`）、`privacy-check.mjs --self-test` 100 项、`extract-plan.mjs --self-test` 46 项和 `--check` CHECK OK、`privacy-check.mjs --all` 与对推送区间的 `--push` 复查，以及一次性克隆里对种子闸门和 pre-commit 钩子的重验。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-04 | 提取工具用 `node:vm` 求值所有者自己本机原件副本的常量区：输入不是不可信来源；只求值两个标记之间的常量和纯函数，空上下文、1 秒超时；工具注释写明 vm 不是安全边界 | 所有者（07-01 计划威胁表，随路线图批准） | 2026-11-07 |
| AR-07-02 | 审计发现（未登记） | `tests/support/app-source.ts` 和 `extract-plan.mjs --check` 也用 `vm.runInNewContext` 求值被跟踪的应用文件。应用公开后这份输入可能来自外部贡献，而带空上下文的 vm 不是沙箱；但运行测试套件或工具本来就在执行仓库代码，风险等同，记为 low 并接受 | 编排器按审计建议记录（low） | 2026-11-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-07 | 27 | 25 | 2 | gsd-security-auditor（T-07-13、T-07-25 缺“所有者确认推送”的记录） |
| 2026-11-07 | 27 | 27 | 0 | 编排器：记录所有者在会话中对推送的明确确认后关闭 T-07-13、T-07-25 |

**审计备注：**
- T-07-08 的残留：07-02 执行时，一次带 `cut -c1-60` 的 grep 在终端输出里带出了原计划里两个周健身目标数字所在的那一行。这一行只出现在本机会话记录里，没有进入任何文件、提交或 SUMMARY；推上去的 45 个提交经隐私检查复核没有 4 字以上的计划文字，示例计划的数字与原计划无撞车。
- 代码审查里推迟的 WR-02（Phase 12）和处置台账里的 `doneDate` 备注是显示与数据一致性问题，不是注入，未计入威胁登记册。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-07
