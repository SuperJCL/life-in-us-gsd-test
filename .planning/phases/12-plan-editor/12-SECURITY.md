---
phase: "12"
slug: "plan-editor"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-12"
---

# Phase 12 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只在本机的假 PocketBase 上测试，不连接任何真实服务器，也没有处理任何真实数据。判断依据：
- 8 份计划的 `<threat_model>` 威胁登记（计划阶段写好，`register_authored_at_plan_time: true`），共 28 条不重复的威胁（27 条 mitigate，T-12-SC 为 accept）；
- 8 份 SUMMARY 的 Threat Flags（12-01 到 12-07 都写“无新增的安全相关面”，12-08 写 None，没有登记之外的威胁）；
- gsd-security-auditor 在 HEAD 5900caf 上的静态核对（ASVS L1，逐条给出文件行号和覆盖的用例标题）。应用 `us-journey-tracker.html` 最后一次改动在 7d5e8bb（12-07），迁移脚本 `tools/plan/migrate-backup.mjs` 在 17991f6（12-02），`tests/README.md` 在 a7fc2f7（12-08）；
- 12-08 在当前应用版本上跑完的完整套件：`npm run test:cloud` 231 条、默认 `npm test` 193 条全部通过（flaky 0、unexpected 0）。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 用户在编辑页的输入 → 计划草稿 → 服务器 plan 文档 | 本阶段第一次由用户直接改写整份计划；组名、备注、任务文字是任意文本，id 由应用生成 | 计划文字与结构（个人计划，隐私） |
| 服务器 plan / state 文档 → 页面 | 归档标记、截止日期、自定义待办的 group 都来自服务器，可能被别的设备、导入或手工写入改过 | 计划与记录 |
| 远端版本（另一台设备、同一浏览器的其他标签页）→ 本机挂起槽 → 工作数据 | 只经 pendRemote/takeRemote 并入，编辑页打开期间不应用到草稿 | 计划与记录 |
| 草稿保存 → state 文档（含 state.lifts、state.presets） | 保存会删除离开计划的项的进度和力量项历史；用户自己的标签层不能被碰 | 进度、历史 |
| 编辑页「已归档」区的恢复、彻底删除 → 草稿 → 保存后的 state | 唯一会连进度删除数据的用户操作 | 进度、完成记录 |
| 别的设备上的新进度 → 本机工作 state | D-08 复查读它 | 进度 |
| 示例计划 → 账号计划 | 载入示例时示例的 id 不能进入账号计划 | 计划结构 |
| 地址栏 hash → 页面路由 | 任意链接都能带上 `#plan` | 路由 |
| 导入文件 → state | 导入白名单（importProblem）只为 GROUP_NONE 放行一个新值 | 备份内容 |
| 测试说明、验收截图 → 公开仓库 / 所有者 | README 进 git 公开可读；截图只用合成账号和合成计划 | 文档 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-12-01 | Tampering | 找不到组的自定义待办悄悄挂到一个真实的组上（原先担心的“收紧 normalizePlan 让已有计划退回示例计划”已按所有者决定 2026-11-11 取消：数值规则只在编辑页） | low | mitigate | 标记 GROUP_NONE 是 `-`，不合 GROUP_ID_RE，normalizePlan 不会接受这个 id 的组；normalize 对已标记的待办不再改组；importProblem 只对这一个值放宽（不含标记字符以外的东西）；单元用例覆盖“有组之后仍是标记”和“标记的备份能导回” | closed |
| T-12-02 | Information Disclosure / XSS | 归档组名、备注、任务文字、组标签进入目标页「已归档」区、日面板、时间线 | medium | mitigate | 每处插值 `${esc(...)}`；组 id 不再作为文字输出；SEC-01 页面用例改为断言组 id 载荷不出现在文字里，源码门槛 BARE_TOKENS 保持通过 | closed |
| T-12-03 | Information Disclosure | 用例失败输出回显计划文字 | low | mitigate | readArchived 只返回 id、计数、布尔和界面文案；用例只用 `SYNTH-` 合成计划 | closed |
| T-12-04 | Tampering | 「已归档」区删除找不到组的待办 | low | mitigate | 只复用现有 data-deltask 分支（commit 按 id 删除，可在其他设备上重做）；按钮在门控期间被 applyGate 禁用，data-deltask 在 GATE_BLOCK 里；删除是用户明确操作，不违反 Phase 7 D-08 | closed |
| T-12-05 | Repudiation | 归档任务的截止提醒被隐藏后用户以为数据丢了 | low | mitigate | 截止日期留在数据里不动，计划不再归档后提醒回来，有 cloud 用例证明 | closed |
| T-12-06 | Information Disclosure / XSS | 归档力量项的名称、历史值和找不到组的待办文字进入页面 | medium | mitigate | 每处插值 `${esc(...)}`（历史值逐项 esc，沿用 Phase 7）；SEC-01 两条用例在完整默认套件里同跑 | closed |
| T-12-07 | Tampering | 远端更新或整页重绘冲掉正在编辑的草稿 | high | mitigate | isBusy 在编辑页打开时为真，maybeApplyView 只换成无按钮横幅；`#tab-plan` 只由 renderPlanEditor 画，renderAll 里没有它（verify 的 grep）；cloud 用例证明另一台设备保存后草稿输入框的值不变 | closed |
| T-12-08 | Denial of Service（数据丢失） | 离开编辑页时悄悄丢掉有修改的草稿 | medium | mitigate | 三条离开路径、退出、重新登录都先经 planDirty 判断并确认；beforeunload 尽量提示（手机不保证，所有者已接受 D-09）；每个 await 之后核对会话没变 | closed |
| T-12-09 | Information Disclosure / XSS | 组名进入编辑页的 value、title、文字 | medium | mitigate | 每处插值 `${esc(...)}`，标题和卡片名称就地更新只用 textContent；SEC-01 源码门槛在 Task 1 的默认子集里跑 | closed |
| T-12-10 | Spoofing | 本地版或未登录时通过 `#plan` 打开编辑页 | low | mitigate | planRoute 只在云端、有会话、有 docs.plan、无门控时打开；其余情况去掉 hash 回到目标页；hash 只做全等比较，不解析内容；默认套件用例证明本地版 | closed |
| T-12-11 | Elevation of Privilege | 对账门控期间经键盘或脚本事件触发编辑页动作 | low | mitigate | `[data-peact]` 加进 GATE_BLOCK；入口按钮不在 GATE_ALLOW，门控期间被 applyGate 禁用 | closed |
| T-12-12 | Tampering | 新项的 id 与已有 id 或示例 id 相撞，进度接到别的任务上 | medium | mitigate | 新 id 一律 `g-`/`t-` 加 uid()，加进草稿时生成一次；normalizePlan 拒绝重复 id；用例断言已有 id 与顺序不变、新 id 匹配前缀 | closed |
| T-12-13 | Tampering（数据丢失） | 删除有进度的任务或组时直接硬删 | high | mitigate | 删除前用 taskHasProgress / groupProgress 判断，有进度只走确认后的归档；保存清理只删“离开计划”的 id 的进度，归档项仍在计划里；cloud 用例证明归档任务的进度和组里的待办在服务器上保留 | closed |
| T-12-14 | Information Disclosure / XSS | 计划文字进入编辑页的 value、title、aria-label、卡片标题和确认框 | medium | mitigate | 每处插值 `${esc(...)}`，确认框和 toast 只用 textContent；带标记载荷的 cloud 用例按 readInjection 的五项检查；SEC-01 源码门槛同跑 | closed |
| T-12-15 | Denial of Service | 计划无限增长 | low | mitigate | 组 20、每组任务 50 的上限靠添加按钮禁用，名称和文字靠 maxlength；文档体积另有 4 MB 检查（12-07） | closed |
| T-12-16 | Tampering | 编辑基础标签时改动了 state.presets（用户自己的标签层） | medium | mitigate | 标签分区只写 `pe.draft.presets`，保存路径不 commit presets；cloud 用例断言服务器 state 的 presets 保存前后逐字相同 | closed |
| T-12-17 | Tampering | 不合编辑页规则的数值（起始值为负、天数越界或颠倒）经导入、远端或已有计划进入 | low | mitigate | 所有者决定（2026-11-11）：normalizePlan 照旧接受这些值，计划照常显示、不退回示例计划（目标值不大于 0 仍被 normalizePlan 拒绝，与今天相同）；编辑页打开时立即标出这些字段，planProblems 挡住保存直到改好，所以编辑页写出的计划一定合规；单元用例和“打开就标出”的 cloud 用例各证明一层 | closed |
| T-12-18 | Tampering（数据丢失） | 有历史的力量项被直接删除 | high | mitigate | 删除前看 liftHistoryCount，有历史只走确认后的归档；保存清理只删离开计划的 id；cloud 用例证明归档后服务器上的历史还在 | closed |
| T-12-19 | Tampering（数据丢失） | 彻底删除没有第二次确认、或点了就立刻生效 | high | mitigate | 三种确认框写明会丢失的内容（进度、完成记录、自定义待办数），默认焦点在「不删除」，Esc 等同取消；删除只改草稿，保存才生效，放弃修改可撤回；cloud 用例覆盖「不删除」和「放弃这次修改」两条撤回路径 | closed |
| T-12-20 | Tampering | 保存清理误删仍在计划里的项（归档项、恢复的项）的进度 | high | mitigate | 清理只按保存前后计划的 id 差集，归档和恢复都不改 id；cloud 用例断言恢复的任务、恢复的组里的待办进度都还在 | closed |
| T-12-21 | Tampering | 载入示例计划复用示例 id，接上归档项或旧数据的进度 | medium | mitigate | 每一项换成全新的 g-、t-、l- id；cloud 用例断言没有 P 开头和示例力量 id | closed |
| T-12-22 | Tampering | 不经选择覆盖另一台设备刚保存的计划，且不留底 | high | mitigate | 用打开时的版本 pe.base 加内容比较判断被改过；被改过时必须经三选一；用我的覆盖在写入前 keepConflict("plan") 留底，存不下时显示「留底没存上」横幅；之后的上传若又遇到更新的版本，syncOnce 现有的真冲突留底照常生效；cloud 用例覆盖三个出口 | closed |
| T-12-23 | Tampering（数据丢失） | 草稿里移除的项在别的设备上刚有了进度，保存时被悄悄删掉 | high | mitigate | 保存前 takeRemote 后按最新 state 复查 pe.gone，命中就弹 D-08 询问框；全部归档放回草稿、进度保留；cloud 用例覆盖两个选择和不弹的情形 | closed |
| T-12-24 | Denial of Service | 计划超过 4 MB，上传必然失败 | low | mitigate | 写入前 sizeOf 检查，超限不写、不上传，提示用户删减，显示现有横幅 | closed |
| T-12-25 | Repudiation | 断网或过期时点保存，用户以为已经保存 | medium | mitigate | 保存按钮 aria-disabled 加提示行和 toast 说明原因，草稿留在页面上；联网或重新登录后恢复；cloud 用例证明服务器计划没变 | closed |
| T-12-26 | Information Disclosure | README 或验收材料里出现服务器地址、邮箱或真实计划文字 | low | mitigate | README 只写文件名、字段键和界面文案；暂存后跑隐私检查；截图只在假服务器和合成账号上生成，不进仓库 | closed |
| T-12-27 | Tampering（数据丢失） | 账号的计划读不出来时，用草稿替换服务器上那一份而不留底 | high | mitigate | 所有者决定（2026-11-11）：编辑页顶部说明计划读不出来；保存时先 keepConflict("plan") 留下服务器原样的那一份，留底写不进就不保存、草稿留在页面上；cloud 用例覆盖“留底后替换”和“留底失败不保存”两条路径 | closed |
| T-12-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包 | closed（接受，见 AR-01） |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

逐条证据（文件行号、用例标题）见 gsd-security-auditor 的核对结论；关键几条：T-12-07 `isBusy` 首行 `if(pe)return true;`、编辑页打开时远端更新只显示无按钮横幅；T-12-13/18/19/20 有进度只走确认后的归档、彻底删除二次确认且默认焦点在取消、清理只按保存前后的 id 差集；T-12-22/23 三选一与 D-08 复查，覆盖前留底；T-12-27 计划读不出来时先留底再替换，留底失败不保存。

### 审计建议（不改变上面的状态，不计入 threats_open）

| # | 内容 | 处理 |
|---|------|------|
| S-1 | **T-12-27 的一条少见路径。** 打开编辑页时账号计划读得出来，编辑期间另一处写入了一份 `normalizePlan` 拒绝的计划，保存时选「用我的覆盖」：先存下读不出来那份留底，紧接着覆盖分支又存一份 `plan`（此时是示例计划），同类型未告知的留底被替换，读不出来的原版没留下，toast 仍说已留底。可能性低（本应用写出的计划都经过 normalizePlan）。可能的修法：覆盖留底条件改为 `overwrite&&!unread`，并补一条 cloud 用例。 | 交给本阶段代码审查（code-review）处理 |
| S-2 | SEC-01 源码门槛的 `BARE_TOKENS` 清单没有编辑页新函数里的变量名（`peRows` 的 `t.text`、`peTagRow` 的 `x`、`peArchRow` 的 `name`/`desc`、`lbl.get(...)`）；这些位置目前都已转义（审计员逐行确认），但以后改回裸插值时门槛不会报。编辑页的 `details#pe-archived` 也没有在有归档项的状态下跑过注入用例。 | 记录；建议后续把变量加进清单或补一条带归档项的注入用例 |
| S-3 | 添加上限只靠按钮禁用，`peAddGroup`/`peAddTask`/`peAddLift` 函数里没有再判断上限（与登记的缓解写法一致）。 | 仅记录 |
| S-4 | 主列表力量卡 `${md(x.date)}` 没有 `esc`（Phase 7 的旧写法，日期经 normalize 格式校验）。 | 不在本阶段范围，仅记录 |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-12-SC | 本阶段不安装、不下载任何包；`git diff 1cc442d..HEAD` 对 `package.json`、`package-lock.json`、`playwright.config.ts`、`playwright.cloud.config.ts` 为空 | 计划阶段登记（low） | 2026-11-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-12 | 28 | 28 | 0 | gsd-security-auditor（opus，ASVS L1 静态核对，HEAD 5900caf） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-12（审计建议 S-1 交给代码审查处理）
