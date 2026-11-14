---
phase: "15"
slug: "fitness-tab"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-14"
---

# Phase 15 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只在本机的假 PocketBase 上测试，不连接任何真实服务器，也没有处理任何真实数据。判断依据：

- **威胁登记：** 7 份计划的 `<threat_model>` 都是计划阶段写好的（`register_authored_at_plan_time: true`），共 29 条不重复的威胁：24 条 mitigate，T-15-04、T-15-08、T-15-15、T-15-27、T-15-SC 为 accept。
- **Threat Flags：** 7 份 SUMMARY 都写没有新的网络端点、认证路径或信任边界，所有安全相关面都对得上已登记的编号。
- **审计：** gsd-security-auditor（opus，ASVS L1，block_on high）在 HEAD 431c8a9 上逐条核对，没有改任何文件。每条都给出了 `us-journey-tracker.html` 里的防护代码位置和证明它的用例标题，结论 SECURED，29/29 关闭。
- **完整套件：** 15-07 在最后一次应用改动（309f4f6）之后分片跑了两个完整套件，cloud 94+94+93 = 281 条，默认 118+118 = 236 条，unexpected 0、flaky 0。审计 agent 读了这 5 份 JSON 报告，确认引用的用例标题都通过；309f4f6 之后只改了 `.planning/*` 和 `tests/README.md`。

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 导入文件 / 服务器文档 / 本机缓存 → `normalize`、`importProblem` | `state.workouts` 和 `plan.cardio` 是新的不可信输入，键、id、数值都要过白名单 | 训练记录、计划（隐私） |
| state 和计划 → 健身页、本周 / 日历 / 日面板 / 时间线的训练行 | 名称、日期、id、数值进 innerHTML、SVG 属性和 `data-*` | 训练记录、计划（隐私） |
| state 和计划 → 日历 CSV | 导出的单元格可能被表格软件当公式执行 | 训练摘要 |
| 用户输入 → 草稿 → `state.workouts` | 数字框里的任意文字经 `workoutProblems` 和 `woFromDraft` 才能进 state | 训练记录 |
| 本机留底 `wodraft` → 草稿 | localStorage 里的内容可能被篡改或来自旧版本；换账号时不能留给下一个账号 | 未保存的训练（隐私） |
| 两台设备 → 同一份 state 文档 | 训练按天整写（同步键 `wo:<日期>`），经 `commit` 重放合并 | 训练记录 |
| 编辑页输入 → 计划文档；彻底删除 → `state.workouts` | 有氧项经 `planProblems` 和 `normalizePlan` 才能保存；彻底删除连带删掉训练里的条目，是不可恢复的显式操作 | 计划、训练记录 |
| 门控 → 健身页控件 | 只读控件（图表、翻页、历史）必须可用，写入控件必须被拦 | — |
| 发布版页面 → 浏览器 CSP | 新的 SVG 和进度条不能引入内联样式或脚本 | — |
| 已部署的旧版本页面 → 新数据 | 旧版本不认识 `workouts`、`cardio`，载入时会丢掉这两个键 | 训练记录、有氧项 |
| localStorage 的 `usj:fit:range`、`usj:fit:note` → 页面状态 | 设备偏好，可能被改成任意值 | — |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-15-01 | Tampering | `normalize` / `importProblem` 的 workouts | high | mitigate | 键必须是 realDate，id 过 `LIFT_ID_RE` / `CARDIO_ID_RE`，数值按 `WO_MAX` 截断，只带出 `{w,r}` / `{id,m,d}`；`importProblem` 对坏键、坏 id 整份拒绝，两条导入路径都检查 | closed |
| T-15-02 | Tampering | 记录区和本周行的模板 | high | mitigate | id 先过正则再进 `data-*`，名称、数值、日期一律 `esc()`；应用里没有 `style="`；escaping 套件的绕过入口检查用例 | closed |
| T-15-03 | Tampering | `commit` 重放（`wo:<日期>`） | medium | mitigate | `woPut` 深拷贝、只整写这一天、幂等；删除和撤销用同一个键；单元用例和云端 tracer 证明 | closed |
| T-15-04 | Denial of service | 已部署的旧版本页面丢掉 workouts / cardio 后保存 | medium | accept | 见 Accepted Risks AR-01 | closed |
| T-15-05 | Information disclosure | 测试和仓库文字 | low | mitigate | 只用示例名称和 `SYNTH-` 合成文字；pre-commit 隐私检查失败即拒绝提交；审计时重跑 `privacy-check --all` 通过（603 个文件） | closed |
| T-15-06 | Tampering | `wodraft` 恢复 | medium | mitigate | `flRestore` 检查日期不晚于今天、数组长度、id 正则和唯一、组数上限、值是短字符串，不合格就删掉；恢复后保存仍要过 `workoutProblems` | closed |
| T-15-07 | Information disclosure | 退出或换账号后残留的草稿 | medium | mitigate | `wodraft` 在退出登录和换账号两处清理列表里，`resetSession` 清 `fl`；云端用例断言退出后键不在 | closed |
| T-15-08 | Repudiation | 同一天两台设备都改，后保存的覆盖先保存的 | low | accept | 见 AR-02 | closed |
| T-15-09 | Denial of service | 大量组或超长输入 | low | mitigate | 每个动作最多 20 组（按钮禁用、处理函数守卫、`slimit`、`normalize` 截断、恢复时检查组数）；4 MB 检查兜底 | closed |
| T-15-10 | Tampering | `fcDraw` / `fcDrawCd` 的 SVG 字符串 | high | mitigate | 坐标只来自取整后的数字，日期、值、名称经 `esc()`；`seriesOf`、`cardioWeeks` 只收有限数；没有 style 属性 | closed |
| T-15-11 | Tampering | `usj:fit:range` | low | mitigate | 只认五个已知值，其余回落 1m；用例写入 `bogus` 证明 | closed |
| T-15-12 | Elevation of privilege | 门控收窄 | medium | mitigate | 15-04 已去掉目标页的力量控件；`GATE_BLOCK` 拦 `[data-fl]`，只读控件带 `data-fit-ro` 放行；云端门控用例证明 | closed |
| T-15-13 | Tampering | `renderFw`（当前值回落到未经 normalize 的 cur） | high | mitigate | 显示用 `esc(String(v))`，进度用 `Number` 且非有限数当 0、限制在 0–100；绕过入口检查的用例读回原样文字并 `expectClean` | closed |
| T-15-14 | Tampering | 去掉 `saveLift` 之后的门控 | low | mitigate | `GATE_BLOCK` 删掉了不再存在的两个选择器，应用里没有 `data-liftsave`；记录区仍由 `[data-fl]` 拦 | closed |
| T-15-15 | Information disclosure | `usj:fit:note` | low | accept | 见 AR-03 | closed |
| T-15-16 | Tampering | `renderFh` 和三个视图的训练行 | high | mitigate | 摘要、名称、日期、`data-wo` 全部 `esc()`，`goWo` 检查 realDate；恶意夹具在四处 `expectClean` | closed |
| T-15-17 | Tampering | 日历 CSV 的训练行（公式注入） | medium | mitigate | 训练行经 `csvCell`（`= + - @ \t \r` 开头加 `'`）；用例用以 `=` 开头的动作名证明 | closed |
| T-15-18 | Repudiation | 导入替换掉训练 | medium | mitigate | 两条摘要路径都写明训练天数，确认后才替换；撤销导入把导入前的整份 state 放回；云端用例证明 | closed |
| T-15-19 | Denial of service | 很长的训练历史 | low | mitigate | 历史一次渲染 20 条、按需加载；摘要最多 3 个动作和 2 个有氧 | closed |
| T-15-20 | Tampering | `peCardioCard`、`pkRender` 的有氧栏 | high | mitigate | 名称、备注、目标、id 全部 `esc()`；id 来自 `normalizePlan`（过 `CARDIO_ID_RE`）或 `nid("r-")`；`BARE_TOKENS` 覆盖这些字段 | closed |
| T-15-21 | Tampering | 彻底删除时清理 workouts | medium | mitigate | 只清离开计划的 id（归档不清），经 `woPut` 幂等过滤、带 `wo:<日期>` 键提交；确认框写明记录数和组数；云端用例证明归档不清、彻底删除才清 | closed |
| T-15-22 | Repudiation | 有训练的项被误删 | medium | mitigate | 有历史（含训练）只能先归档；彻底删除只对已归档项、要再确认；保存前 D-08 复查覆盖有氧项 | closed |
| T-15-23 | Denial of service | 计划过大 | low | mitigate | 力量项和有氧项各 20 个上限（按钮禁用、`llimit` / `climit`），名称长度检查，备注靠 `maxlength`；`planCommit` 的 4 MB 检查兜底 | closed |
| T-15-24 | Tampering | 健身页和训练行的全部渲染函数（绕过入口检查） | high | mitigate | `woSummary`、`flDraftOf`、`fhBody`、`wclean` 等对非标准形状跳过不抛错，文字一律 `esc()`；绕过入口检查、恶意有氧名称和每个字段的用例 `expectClean` | closed |
| T-15-25 | Tampering | 导入和载入的 workouts | high | mitigate | 同 T-15-01，所有载入路径都经 `normalize`；state-validation 用例证明修正后不丢别的日子、坏备份整份拒绝 | closed |
| T-15-26 | Tampering | SEC-01 源码门槛覆盖不到新函数 | medium | mitigate | `BARE_TOKENS` 加上 Phase 15 的全部计划和训练字段，去掉 `esc()` 的对照用例证明门槛有效 | closed |
| T-15-27 | Repudiation | 两台设备改同一天 | low | accept | 见 AR-04 | closed |
| T-15-28 | Elevation of privilege | 严格 CSP 下的新界面 | medium | mitigate | 没有 `style="` / `style='`，只有两处 CSSOM 进度条宽度；csp.spec 走完五个视图零违规，并断言 `#tab-fit` 里除进度条外没有内联样式 | closed |
| T-15-SC | Tampering | npm、pip、cargo 安装 | low | accept | 见 AR-05 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-15-04 | 新代码改不了已部署的旧代码；新版本里做「保留未知键」救不了旧页面，反而削弱 SEC-01 的白名单。本阶段不部署，线上只有测试账号。上线顺序交给 Phase 16：先让所有打开的页面换成新版本，再记第一次训练，再迁移真实数据（ROADMAP Phase 16 备注，提交 dcb9a0f） | 计划阶段登记（15-01 威胁模型），规划时写进 Phase 16 | 2026-11-13 |
| AR-02 | T-15-08 | 同一天两台设备都改时以最后保存的为准，与现有 SYNC 规则一致；保存前看到别的设备的版本有第 2 档提示，用户可以放弃改看新版 | 计划阶段登记（15-02 威胁模型） | 2026-11-13 |
| AR-03 | T-15-15 | `usj:fit:note` 只存 `closed` 一个值，不含账号数据，按 UI-SPEC 是设备偏好，换账号不需要清理 | 计划阶段登记（15-04 威胁模型） | 2026-11-13 |
| AR-04 | T-15-27 | 同 AR-02；用例证明同一天只有一个日期键、不重复 | 计划阶段登记（15-07 威胁模型） | 2026-11-13 |
| AR-05 | T-15-SC | 本阶段不安装、不下载任何包；`git diff 9721123 -- package.json package-lock.json` 为空 | 计划阶段登记（15-01..15-07 威胁模型） | 2026-11-13 |

*Accepted risks do not resurface in future audit runs.*

---

## 审计备注（不影响上面的状态）

1. **历史面板恢复焦点时的选择器没有转义：** `renderFh` 用原始的 `dataset.fh` 拼 `.fh-item[data-fh="…"]>summary`，没有经过 `CSS.escape`（`fcFocusKey` 用了）。只在绕过入口检查、日期键里带 `"` 时，这一次渲染会抛 SyntaxError；不会注入内容。所有载入路径都会把键修正成 realDate。交给代码审查一起看。
2. **T-15-06 没有篡改用例：** 没有用例写入格式错误的 `wodraft`，形状检查只在代码里核对过（`flRestore`），用例只覆盖恢复和退出时清理。
3. **备注长度只靠 `maxlength`：** `planProblems` 检查名称长度，不检查备注长度；有 4 MB 兜底，和现有 D-17 规则一致。
4. **登记之外的同步修复：** 15-07 改了 Phase 10 的同步代码（`syncOnce` 的 `heldSlot`），修复重试上传时丢掉本机操作的问题。这是数据完整性修复，不是新的攻击面，同步相关的回归用例都通过。
5. **同一天里 id 重复：** 同一天出现两次同一个 id 时，`normalize` 保留第一条（即使它的组不合格），后面那条合格的会丢。只会出现在手工构造的数据里（15-07 SUMMARY 已记录）。

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-14 | 29 | 29 | 0 | gsd-security-auditor（opus，ASVS L1，block_on high）；编排者写入 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-14
