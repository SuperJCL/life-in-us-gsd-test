---
phase: "14"
slug: "plan-onboarding"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-13"
---

# Phase 14 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只在本机的假 PocketBase 上测试，不连接任何真实服务器，也没有处理任何真实数据。判断依据：

- **威胁登记：** 3 份计划的 `<threat_model>` 登记都是计划阶段写好的（`register_authored_at_plan_time: true`），共 15 条不重复的威胁，其中 13 条 mitigate，T-14-13 和 T-14-SC 为 accept。
- **Threat Flags：** 3 份 SUMMARY 都写「无新的对外面」，没有新的网络端点、认证路径或文件访问，也没有登记之外的威胁。
- **编排者核对：** 在应用版本 `31165b0…`（14-03 的最后一次应用改动 0998195）上做了 ASVS L1 级的静态核对，逐条在 `us-journey-tracker.html` 里找到防护代码，并对上对应的用例标题。按 secure-phase 的规则，`threats_open: 0` 且登记来自计划阶段、ASVS L1 时不再派审计 agent。
- **完整套件：** 14-03 在同一应用版本上跑了两个完整套件。默认 `npm test` 199 条全部通过（JSON 报告 `test-results/14-03-t3v.json`：expected 199、unexpected 0、flaky 0）。`npm run test:cloud` 266 条通过是执行 agent 报告的结果，它的 JSON 报告被随后的默认套件运行清掉了，阶段收尾的回归检查会再跑一次。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 服务器文档 → 首次登录的对账 | 没有计划文档时由页面建档；有文档时必须原样采用 | 个人计划（隐私） |
| 示例常量和用户计划 → 挑选对话框 | 列表文字来自代码里的 `DEFAULT_PLAN`；同名比较用的计划名来自服务器，只进 Set 比较，不显示 | 计划名称（隐私） |
| 两个保存入口 → 计划文档 | 卡片模式的直接保存和编辑页的保存都经 `planCommit` 写同一份文档 | 个人计划 |
| 别的设备 → 服务器上的计划文档 | 挑选期间计划可能被另一台设备改写 | 个人计划 |
| 网络和登录状态 → 卡片模式的保存 | 断网、连不上、令牌失效时不能发起保存 | — |
| 编辑页草稿 → 计划文档 | 编辑页里从示例添加的项只进草稿，点「保存计划」才写入 | 个人计划 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-14-01 | Tampering | `resolve()` 首次建档 | medium | mitigate | 只在服务器没有文档、本机也没有缓存时建档：`mk(kind,c?c.data:kind==="plan"?emptyPlan():normalize({}))`；有缓存走缓存，撞唯一索引重读服务器。用例：`PLAN-06 an account that already has a plan document keeps it unchanged at sign-in and no plan is …`，以及缺文档按缓存重建 | closed |
| T-14-02 | Tampering | `pkRender` 的模板字符串 | low | mitigate | `pkRender` 里 19 处 `esc(` 插值，0 处 `style=`；全应用 `style="` 计数为 0；SEC-01 源码门槛（escaping.spec）在 14-01、14-02 的定向运行和 14-03 的完整默认套件里都通过 | closed |
| T-14-03 | Tampering | `pickSample` 的 id | low | mitigate | 新 id 用 `"g-"`/`"t-"`/`"l-"` 加 `uid()`，并用 `used.has` 避开 `planUsedIds` 收集的全部 id（含归档项）；不复用示例 id（D-08）。`plan-normalize.spec.ts` 的 pickSample 单元用例和 tracer 用例覆盖 | closed |
| T-14-04 | Tampering | 卡片模式写入的计划内容 | medium | mitigate | `pickSample` 不读写 `presets`、`fitGoal`、`fitNote`（函数体里没有这三个词）；只拷贝勾选项（D-02、D-06）。tracer 和 PLAN-02 用例逐项比较服务器计划 | closed |
| T-14-05 | Tampering | `planCommit` 提炼 | medium | mitigate | `savePlanDraft` 调用 `planCommit(` 1 次，自己不再调用 `usePlan(`；写入顺序不变。plan-editor-sync、plan-editor 两个 spec 共 29 条回归用例通过 | closed |
| T-14-06 | Information disclosure | 测试和仓库文字 | low | mitigate | 只用合成账号和 `DEFAULT_PLAN` 的公开样本；每个提交都过了 pre-commit 隐私检查（规则 D 加载 68 个个人计划词条），没有用 `--no-verify` | closed |
| T-14-07 | Tampering | `pkSave` 覆盖别的设备的计划 | medium | mitigate | 并入挂起的远端版本后用 `peCanon(plan)!==s.orig` 判断，不同就弹 `confirmBox` 三选一（`mid` 加 `scope:"plan"`）；「用我的覆盖」经 `planCommit(np,true)` 在写入前 `keepConflict("plan",…)` 留底。用例：`PLAN-07 a plan saved on another device while picking asks on save, going back keeps the picks and …` 等两条 | closed |
| T-14-08 | Denial of service | 断网、过期时的保存尝试 | low | mitigate | `pkSave` 开头先调用 `peBlock()`，挡住就只弹 toast；卡片按钮由 `pkWhy()` 设为 `aria-disabled` 并写明原因。用例：`PLAN-07 while offline the pick button …`、`PLAN-07 with an expired login the empty plan card and the open picker refuse to save …` | closed |
| T-14-09 | Denial of service | 计划超过容量上限 | low | mitigate | `planCommit` 先查 `sizeOf(np)>CLOUD_MAX`，超限返回 `"toolarge"`，不写也不留底，对话框保留勾选。用例：`PLAN-07 picks that would push the plan over the cloud limit are not saved and the picker says so …` | closed |
| T-14-10 | Information disclosure | 会话结束后仍开着的挑选对话框 | low | mitigate | `resetSession` 在 `pkDlg.open` 时关闭对话框；`pkSave` 用 `live()` 核对 `pk===s` 和 `sessionEpoch`，旧会话的保存不会写进新账号。用例：`PLAN-07 signing out in another tab while the picker is open closes it (S1, D-07)` | closed |
| T-14-11 | Tampering | `pkAddToDraft` | medium | mitigate | 函数体只改 `pe.draft`，不调用 `planCommit` 或 `savePlanDraft`（14-03 的 verify 有函数体检查）。用例检查添加后到点保存之前计划写入条数不变，放弃草稿后没有任何写入 | closed |
| T-14-12 | Denial of service | 名额限制 | low | mitigate | `pkRoom()` 按未归档项计算剩余名额（目标组 20、力量项 8）并禁用多余的行；编辑页保存时 `planProblems` 的上限检查仍在（12 D-17）。用例：`PLAN-07 the picker stops at the group and lift limits …` | closed |
| T-14-13 | Spoofing | 同名的示例项 | low | accept | 同名项只做标记，仍允许再加一份（UI-SPEC A5）；副本有新 id，不会合并，也不会接上原有项的进度。用例：`PLAN-07 the picker marks sample groups and lifts whose names are already in the draft and still a…` | closed |
| T-14-14 | Information disclosure | 同名比较读到的用户计划名称 | low | mitigate | 用户的名称只进 Set 做比较；列表只显示 `DEFAULT_PLAN` 的样本文字和固定标记，全部经 `esc()`；SEC-01 门槛在 verify 里运行 | closed |
| T-14-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本阶段没有安装或下载任何包，`package.json` 和锁文件都没改 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-14-13 | 同名示例项可以重复添加。这是所有者选定的挑选方式（14-CONTEXT D-05 和 UI-SPEC A5）：只标记不阻止，副本有独立的新 id，不会合并数据，风险只是界面上出现两个同名组 | 计划阶段登记（14-03 威胁模型），沿用 UI-SPEC 的定稿 | 2026-11-12 |
| AR-02 | T-14-SC | 本阶段不安装、不下载任何包，供应链面没有变化 | 计划阶段登记（14-01..14-03 威胁模型） | 2026-11-12 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-13 | 15 | 15 | 0 | 编排者（secure-phase，ASVS L1 静态核对；按规则未派 gsd-security-auditor） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-13
