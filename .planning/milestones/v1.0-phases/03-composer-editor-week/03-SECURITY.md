---
phase: "03"
slug: "composer-editor-week"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-03"
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 测试进程 ↔ 页面 DOM | 内置预设、内置任务、力量和健身目标的文字只在页面内读取，只在 Node 侧做布尔或计数比较 | 个人计划文字（不进入任何打印出来的失败输出） |
| 测试进程 ↔ Node 侧 MockBackend | `saved()` / `expectSaved()` 只读取应用发出的写入 | 合成状态文档 |
| 仓库 ↔ 公开 GitHub | 提交前和推送前都跑隐私检查 | 测试代码、合成 fixture、文档 |
| 本机 ↔ npm registry | 本阶段除项目内 Playwright 外不应运行任何 npx 或安装命令 | 无（见 AR-03-01） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Information Disclosure | 内置预设文字 | high | mitigate | 在页面内按序号读、点、删；只用 `toHaveCount` 和 Node 侧布尔比较；新增标签用 `SYNTH-` 文字 | closed |
| T-03-02 | Information Disclosure | 预设元素的 Playwright 调用日志 | medium | mitigate | `clickPreset`/`deletePreset` 用 `page.evaluate`；内置预设元素上只有计数断言；真实指针路径由合成标签证明 | closed |
| T-03-03 | Tampering | 已知 bug 标记用例 | medium | mitigate | 对照用例与 `knownBug()` 标记用例分开，标记用例只有一条窄断言 | closed |
| T-03-04 | Repudiation | 已知 bug 登记 | medium | mitigate | 登记护栏双向核对编号和标题，带常驻反向对照 | closed |
| T-03-05 | Spoofing | 账户模式与保存读取 | medium | mitigate | `saved()` 只认应用写入；每处 `open({ mode: 'account' })` 后都 `expectAccountMode()` | closed |
| T-03-06 | Tampering | 应用文件完整性 | high | mitigate | sha256 基线一致；应用文件未被跟踪、被忽略；SAFE-02 常驻 | closed |
| T-03-07 | Information Disclosure | 本周视图的目标行与日期列 | high | mitigate | `readAreas`/`readDayColumns` 在页面内读回，Node 侧只比较前缀和布尔，消息只含类别名 | closed |
| T-03-08 | Tampering | 期望值来源 | medium | mitigate | `expect-from-fixture.ts` 只依赖 `./strings`，不读应用源码 | closed |
| T-03-09 | Denial of Service | 用例确定性 | medium | mitigate | 没有固定 sleep；保存用 `expect.poll`；B4 相关用例在 manual 时钟下 | closed |
| T-03-10 | Repudiation | 拖放和 B4 结论 | low | mitigate | PROBES.md 记录拖放方案；KNOWN-BUGS.md 记录 B4 已复现 | closed |
| T-03-11 | Information Disclosure | 编辑弹窗显示的内容 | high | mitigate | 只为合成记录和合成计划 `c-synth-2` 打开弹窗；不对整个视图容器做断言 | closed |
| T-03-12 | Repudiation | “没有保存”的证明 | medium | mitigate | manual 时钟加写入次数，再用哨兵写入证明防抖窗口已推进 | closed |
| T-03-13 | Denial of Service | 撤销窗口 | medium | mitigate | 撤销用例在 manual 时钟下只推过防抖，toast 不会过期 | closed |
| T-03-14 | Tampering | 迁就应用改期望 | medium | mitigate | 没有 `test.skip`/`test.only`；SUMMARY 都写明没有与 FEATURES.md 不一致的地方 | closed |
| T-03-15 | Information Disclosure | toast 文字 | high | mitigate | `readToast` 在页面内读回，Node 侧比较，失败消息只含期望值或“内容已隐藏”；验证阶段的变异运行扫描为 0 处命中 | closed |
| T-03-16 | Information Disclosure | 已知 bug 用例的草稿 | low | mitigate | 只用 `SYNTH-` 草稿和 fixture 里的合成标签 | closed |
| T-03-SC | Tampering | 供应链（依赖与安装） | high | mitigate + accept | 项目依赖与 lockfile 本阶段未变；03-02 执行中误跑一次 `npx tsc` 的残余风险由用户接受，见 AR-03-01 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-SC | 03-02 执行期间，执行器为了做类型检查误跑了一次 `npx tsc --noEmit`。项目没有 TypeScript，npx 从 npm registry 取了同名的 `tsc` 空壳包放进用户级 npx 缓存，并执行了一次（只打印一句提示后退出）。项目依赖和 lockfile 都没有变化。处理：该缓存条目已按用户要求移进回收站；之后所有子代理都禁止运行除 `npx --no playwright` 以外的任何 npx，类型错误由 Playwright 运行时转译暴露。残余风险（那个包已经执行过一次）由用户接受 | 用户（2026-11-03 在会话中确认“接受”） | 2026-11-03 |

延续 Phase 2 的 AR-02-02：失败时本地 `test-results/` 和 `playwright-report/` 里的截图、trace、`error-context.md` 可能拍到个人计划文字，这些只留在本机并被 `.gitignore` 忽略（Phase 1 D-02）。

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-03 | 17 | 16 | 1 | gsd-security-auditor（ASVS L1，block_on: high） |
| 2026-11-03 | 17 | 17 | 0 | 编排器：用户接受 AR-03-01 后关闭 T-03-SC |

审计时没有重跑测试（资源限制）；编排器在代码审查修复后跑过一次全套（99 条通过，0 flaky），`node tools/privacy/privacy-check.mjs --all` 通过，应用文件 sha256 等于基线。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-03
