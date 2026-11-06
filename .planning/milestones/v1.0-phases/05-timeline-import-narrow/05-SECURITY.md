---
phase: "05"
slug: "timeline-import-narrow"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-05"
---

# Phase 05 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 测试进程 ↔ 页面 DOM | 时间线里已完成计划的条目、日历 chip、内置任务都带个人计划文字。helper 只在页面内读回 id、日期、月份标题、记录的类别名、计算样式和位置 | 个人计划文字（不进入打印出来的失败输出） |
| 测试进程 ↔ 文件选择框 | 导入文件只在内存里用 `Buffer.from(text)` 构造，文件名必须以 `synth-` 开头 | 合成备份文本 |
| 测试进程 ↔ Playwright JSON 报告 | `check-report.mjs` 只打印计数、问题类型和标题 | 用例标题、统计数字 |
| 仓库 ↔ 公开 GitHub | 提交前和推送前都跑隐私检查 | 测试代码、合成 fixture、文档 |
| 本机 ↔ npm registry | 本阶段没有安装，也没有运行 `npx --no playwright` 以外的 npx | 无 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-05-01 | Information Disclosure | 时间线里已完成计划的条目 | high | mitigate | `readTimeline`（`tests/support/timeline.ts:37-62`）只在页面内读筛选状态、月份标题、id、`.tl-date`，只对记录条目读 `.tag`，已完成计划的 tag 恒为 null。没有可见性断言，没有对 `data-edittask` 的定位器。唯一的文字断言针对固定文案 `TIMELINE_EMPTY` | closed |
| T-05-02 | Tampering | 期望值来源 | medium | mitigate | `expectedTimeline` 是纯函数，只依赖 `./strings`，不读应用源码。tracer 有路标断言：条目数、三个月份、同一天先记录后计划 | closed |
| T-05-03 | Tampering | fixture 变体 | low | mitigate | 本阶段没有任何提交改动 `tests/fixtures`。变体都在用例内存里构造。新文件里没有 fs 写入 | closed |
| T-05-04 | Repudiation | flaky 或部分运行被当成通过 | medium | mitigate | 每次运行都由 `check-report.mjs` 判定。最终结果是 `REPORT OK expected=154`，高于计划要求的 139 | closed |
| T-05-05 | Information Disclosure | 导入文件和导出内容 | high | mitigate | `chooseImportFile`（`import-file.ts:25-31`）在运行时拒绝不以 `synth-` 开头的文件名，这里也是全仓库唯一调用 `setInputFiles` 的地方。导出内容只在内存里比较，没有 attach，也没有写文件 | closed |
| T-05-06 | Tampering | 确认框处理的时序 | medium | mitigate | 每处都先注册对话框处理再选文件，然后用 `expect.poll` 等消息出现，再逐字比较 `CONFIRM_IMPORT`。不该出现对话框的用例用 `recordDialogs` 记录，并断言为空 | closed |
| T-05-07 | Repudiation | “取消或选错文件后没有保存”的结论 | medium | mitigate | 用 manual 时钟推过防抖，再比较写入次数。哨兵 `expectOnlySentinelSaved` 写入后，写入数恰好加 1，记录 id 仍等于 fixture | closed |
| T-05-08 | Tampering | B2、N3 的标记用例 | medium | mitigate | B2 有对照、重置路径和标记用例 3 条，N3 有对照和标记用例 2 条，都在去掉标记后复现过。登记护栏双向核对。最终报告里两条标记用例都按预期失败，失败点分别在 `toHaveValue` 和 toast | closed |
| T-05-09 | Information Disclosure | 失败输出里 `toEqual` 的 diff | low | accept | 见 AR-05-01 | closed |
| T-05-10 | Denial of Service | 放宽护栏规则 | medium | mitigate | 本阶段没有提交改动 `tests/support/test.ts`、`app.ts`、`tests/mocks`、`playwright.config.ts`。新代码里没有 `guard.remove`、`test.skip`、`test.fixme`、`.only` | closed |
| T-05-11 | Information Disclosure | 窄屏下读取日历 chip | high | mitigate | `narrow.spec.ts` 只读 classList、计算样式和 rect，没有任何读文字的调用，也不截图。`scroll-end` 注解只有分支名和五个数字 | closed |
| T-05-12 | Tampering | 窄屏断言空转 | medium | mitigate | 每条用例都先断言视口是 520 × 900。滚动用例的前提读回不成立时直接失败。终态必须是 `atTop`，或者 `atBottom` 且 composer 在视口内（WR-01 修复后）。分不出 `block` 取值这一点已作为 IN-10 如实记录 | closed |
| T-05-13 | Information Disclosure | README、KNOWN-BUGS、SUMMARY 和提交信息 | high | mitigate | pre-commit 钩子在位。`privacy-check --all` 扫过 162 个文件，`--push` 扫过 `ddd7004^..HEAD` 的 24 个提交，都通过。作者都是 noreply 地址 | closed |
| T-05-14 | Tampering | 应用完整性和里程碑收尾越界 | high | mitigate | sha256 等于基线，SAFE-02 用例通过，受保护的路径本阶段都没有提交。没有 complete-milestone、归档或 tag，本阶段的提交也都没有推送 | closed |
| T-05-15 | Repudiation | 收尾结论被部分运行或 flaky 掩盖 | medium | mitigate | 最终报告是 `expected=154 flaky=0 unexpected=0 skipped=0`，每条只跑了一次，22 条新标题全部在报告里 | closed |
| T-05-16 | Information Disclosure | fakepath 观察值 | low | mitigate | PROBE-8 只记录 `empty`、`fakepath+name`、`other` 三种标签。文档里只写“fakepath 形式加合成文件名”。带盘符的原文只会出现在本机终端和被 git 忽略的 `test-results/` | closed |
| T-05-17 | Tampering | PROBE-8 的 change 计数监听 | low | accept | 见 AR-05-02 | closed |
| T-05-SC | Tampering | 供应链：安装与 npx | high | mitigate | `package.json` 和 lockfile 都没有改动。新的非相对 import 只有 `@playwright/test`，`Buffer` 用的是 Node 全局。本阶段没有安装，也没有 `npx --no playwright` 以外的 npx | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-05-01 | T-05-09 | `toEqual` 的 diff 只含三类内容：合成 fixture、内存里构造的备份，以及只含 id、日期、类别名和固定文案的读回。fixture 都带 `_synthetic`，并通过了隐私检查。输出只留在本机终端和被 git 忽略的 `test-results/` | 计划阶段的处置（low），用户委托自动运行 | 2026-11-05 |
| AR-05-02 | T-05-17 | PROBE-8 的监听只做计数，不阻止事件，不改应用的处理函数。它在应用加载后才注册，只存在于这一条用例的页面里，用的是带 `__probe` 前缀的 window 属性。应用文件没有改动 | 计划阶段的处置（low），用户委托自动运行 | 2026-11-05 |

延续 Phase 2 的 AR-02-02：测试失败时，本地 `test-results/` 里的截图、trace、`error-context.md` 可能带页面全文。这些文件只在本机，并被 git 忽略。05-VERIFICATION 的 P-1 已由用户在 2026-11-05 确认接受。

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-05 | 18 | 18 | 0 | gsd-security-auditor（ASVS L1，block_on: high） |

审计没有跑测试（资源限制），只做了以下只读检查，全部通过：
- `privacy-check --all`；
- `privacy-check --push`，扫描 `ddd7004^..HEAD`；
- `privacy-check --self-test`；
- `check-report.mjs --self-test`；
- 对最终报告运行 `check-report --min-expected 154`，并显式列出 24 个标题；
- `sha256sum`。

最后一次全套运行在全部修复之后，结果是 `REPORT OK expected=154 flaky=0 unexpected=0`。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-05
