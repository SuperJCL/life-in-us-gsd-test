---
phase: "04"
slug: "calendar-goals"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-03"
---

# Phase 04 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 测试进程 ↔ 页面 DOM | 日历 chip、日面板计划条目、内置任务、组标题和说明、力量卡都带个人计划文字；helper 只在页面内读回 id、类名、日期、数量、数值和布尔 | 个人计划文字（不进入打印出来的失败输出） |
| 测试进程 ↔ Playwright JSON 报告 | `check-report.mjs` 只打印计数、问题类型和标题 | 用例标题、统计数字 |
| 仓库 ↔ 公开 GitHub | 提交前和推送前都跑隐私检查 | 测试代码、合成 fixture、文档 |
| 本机 ↔ npm registry | 本阶段没有任何安装或 `npx`（`npx --no playwright` 除外） | 无 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-04-01 | Information Disclosure | 到期和完成 chip、日面板计划条目 | high | mitigate | `readMonth`、`readDayPanel` 只读回日期、类名、aria-label 计数和 id；没有文字或可见性断言 | closed |
| T-04-02 | Tampering | 期望值来源 | medium | mitigate | `monthGrid`、`eventsOnDate`、`expectedDayPanel` 等独立实现，不读应用源码；35、42、35 格有路标断言 | closed |
| T-04-03 | Denial of Service | 撤销窗口和 toast 过期 | medium | mitigate | manual 时钟分段 `runFor`（1900 / 4900 / 5100 ms）；没有固定 sleep | closed |
| T-04-04 | Tampering | B1 日历实例的标记用例 | medium | mitigate | 对照用例和标记用例分开，标记用例只有一条窄断言；登记护栏双向核对 | closed |
| T-04-05 | Tampering | 应用文件完整性 | high | mitigate | sha256 等于基线；应用、fixture、mock、配置在本阶段都没有改动 | closed |
| T-04-06 | Information Disclosure | 力量卡和力量 toast | high | mitigate | 定位器动作只用在 4 个豁免元素上；`readLifts` 只返回数值和布尔；toast 只比较后缀或片段，失败消息固定 | closed |
| T-04-07 | Information Disclosure | 内置任务、组标题和说明 | high | mitigate | `readGroups` 只读组号、计数、id 和进度数值；内置任务上没有 `.check()` 一类调用 | closed |
| T-04-08 | Repudiation | 力量失焦或负数时不保存 | medium | mitigate | manual 时钟加写入次数，再用哨兵写入证明防抖窗口已推进 | closed |
| T-04-09 | Tampering | 达标阈值的假设 | low | mitigate | 只用常量 999999、1、2，没有写目标数值；达标看后缀，并核对进度条正好 100 | closed |
| T-04-10 | Information Disclosure | 内置任务的勾选、截止日期和行读回 | high | mitigate | `checkTask`、`setDue` 在页面内按 id 操作；`readTaskRow` 只返回布尔、日期和固定文案 | closed |
| T-04-11 | Repudiation | 空白待办不添加 | medium | mitigate | manual 时钟加写入次数和任务个数，再用哨兵证明 | closed |
| T-04-12 | Tampering | N1 新触发的标记用例 | medium | mitigate | 每个触发都写成对照用例加标记用例；目标页的对照用例先做一次标签往返作为基线；KNOWN-BUGS.md 已登记 | closed |
| T-04-13 | Repudiation | 约定文档与实际用法脱节 | low | mitigate | README 和 KNOWN-BUGS.md 已按 D-16 更新，验收 grep 通过 | closed |
| T-04-14 | Information Disclosure | 文档、SUMMARY 和提交信息 | high | mitigate | `privacy-check --all` 通过；用 `--push` 模式扫描本阶段全部提交，通过；作者都是 noreply 地址 | closed |
| T-04-15 | Repudiation | flaky、过滤和重试后才通过的结论 | medium | mitigate | `check-report.mjs` 拒绝出现 flaky、未注解的 skipped、部分运行、同一标题一过一败的报告，并支持 `--min-expected`；自检通过 | closed |
| T-04-16 | Information Disclosure | JSON 报告文件 | low | mitigate | 只打印计数和标题；`test-results/` 被 git 忽略 | closed |
| T-04-SC | Tampering | 供应链：安装与 npx | high | mitigate | 依赖和 lockfile 都没有变；新代码只用 `node:` 内置模块；本阶段没有安装，也没有 `npx --no playwright` 以外的 npx | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

本阶段没有新增 accept 项，以下两条从前面阶段延续：
- **AR-02-02：** 失败时，本地 `test-results/` 和 `playwright-report/` 里的截图、trace、`error-context.md` 可能带页面全文。这些文件只在本机，被 git 忽略。04-VERIFICATION 的 P-2 已由用户在 2026-11-03 确认接受。
- **AR-03-01（背景）：** Phase 3 误跑过一次 `npx tsc`。T-04-SC 的缓解措施就是吸取这次教训，本阶段没有再发生。

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-03 | 17 | 17 | 0 | gsd-security-auditor（ASVS L1，block_on: high） |

审计没有跑测试（资源限制），只跑了以下只读检查，都通过：
- `privacy-check --all`；
- `--push` 模式扫描 `2e943f6..HEAD`；
- `privacy-check --self-test`；
- `check-report.mjs --self-test`。

最后一次全套运行（在修复之后）的结果是 `REPORT OK expected=132 flaky=0 unexpected=0`。应用文件的 sha256 等于基线。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-03
