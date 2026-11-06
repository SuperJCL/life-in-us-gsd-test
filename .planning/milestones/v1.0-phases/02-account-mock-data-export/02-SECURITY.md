---
phase: "02"
slug: "account-mock-data-export"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-03"
---

# Phase 02 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 页面 ↔ Node 侧 MockBackend | 页面里的 `installClaudeMock` 只通过 `exposeBinding` 和 Node 内存后端往返 | 合成状态文档、读写记录、下载记录（合成数据） |
| 浏览器 ↔ 本机静态服务器 | `127.0.0.1:4789` 只提供应用文件，只接受白名单里的 Host 和 GET/HEAD | 应用源码（含个人计划文字，只留在本机） |
| 浏览器 ↔ 外部网络 | route 拦截、解析规则加死代理三层，外部请求一律不可达 | 无（字体请求被 abort） |
| 仓库 ↔ 公开 GitHub | 提交前和推送前都跑隐私检查；应用文件、真实备份、本机路径、个人计划文字不进仓库 | 测试代码、合成 fixture、文档 |
| 测试进程 ↔ 本地报告目录 | 失败证据只写进被忽略的 `test-results/`、`playwright-report/` | 失败输出（已对个人计划文字脱敏） |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-02-01 | Information Disclosure | `tests/support/static-server.cjs` Host 校验 | high | mitigate | `ALLOWED_HOSTS` 白名单，其余返回 421；`app-integrity.spec.ts` 用原始请求证明 | closed |
| T-02-02 | Tampering | 静态服务器请求方法 | low | mitigate | 只接受 GET/HEAD，其余 405，有用例 | closed |
| T-02-03 | Repudiation | `guard` 记录删除 | medium | mitigate | 只有 `guard.remove(kind, match)`，没有清空全部的方法；每处删除前先断言条数和内容 | closed |
| T-02-04 | Information Disclosure | `guard` 监听范围 | medium | mitigate | 记录 WebSocket；`context.on('page')` 覆盖后开的页面；preconnect 的限制已写进文档 | closed |
| T-02-05 | Information Disclosure | README/PROBES 与提交内容 | medium | mitigate | 隐私检查 `--all` 通过；pre-commit/pre-push 钩子；文档与实测一致 | closed |
| T-02-06 | Tampering | 静态服务器错误处理 | low | mitigate | 只输出中文提示和错误码，不暴露路径 | closed |
| T-02-07 | Spoofing | 账户模式自证 | high | mitigate | `ready()` 加 `expectAccountMode()` 三项检查，每项都有常驻反向对照 | closed |
| T-02-08 | Information Disclosure | mock 运行时/后端出网 | high | mitigate | mock 只经 binding 往返，后端纯内存；三层网络护栏不变，PROBE-2 通过 | closed |
| T-02-09 | Tampering | mock 契约保真 | medium | mitigate | 冻结、路径文法、`use()` 语义有 8 条自测；CONTRACT.md 的 33 行摘录逐字核对 | closed |
| T-02-10 | Tampering | 注入方式 | low | mitigate | 只用 `addInitScript(fn, arg)`，函数体自包含、无 import | closed |
| T-02-11 | Information Disclosure | 契约来源路径 | medium | mitigate | 机器本地路径不进任何被跟踪文件或提交信息；隐私检查通过 | closed |
| T-02-12 | Denial of Service | MockBackend 未知 op | low | accept | 抛错让用例立即失败（D-02），见 Accepted Risks | closed |
| T-02-13 | Information Disclosure | 合成 fixture 内容 | high | mitigate | 自由文本一律以 `SYNTH-` 开头，内置任务只用位置 id；规则 D 全量通过 | closed |
| T-02-14 | Information Disclosure | fixture 文件名 | medium | mitigate | 不出现像备份或导出的文件名；`.gitignore` 兜底；有断言 | closed |
| T-02-15 | Tampering | 页面转义 | low | mitigate | 含 `<b>` 的记录不会生成元素，有用例 | closed |
| T-02-16 | Tampering | 期望值来源 | medium | mitigate | 期望值都由 `expect-from-fixture.ts` 从 fixture 推导 | closed |
| T-02-17 | Information Disclosure | CSV 里的内置任务文字 | high | mitigate | 只在运行时从 DOM 读进内存；失败输出经 `maskTaskTexts`/`csvMismatch` 脱敏，或改成布尔断言；`csv-masking.spec.ts` 有常驻反向对照 | closed |
| T-02-18 | Information Disclosure | 导出内容落盘 | high | mitigate | 只从 `app.backend.downloads` 在内存里比较；`acceptDownloads: false`；不落盘 | closed |
| T-02-19 | Tampering | CSV 生成器与应用同错 | medium | mitigate | 三行手写金标准行同时约束应用输出和独立生成器 | closed |
| T-02-20 | Information Disclosure | 本地失败报告 | low | accept | 报告目录只在本机且被忽略，见 Accepted Risks | closed |
| T-02-21 | Spoofing | 导出用例的运行模式 | medium | mitigate | 每条导出用例都先 `expectAccountMode()` | closed |
| T-02-22 | Tampering | 契约自测覆盖 | medium | mitigate | MOCK-06 核对版本常量与 CONTRACT.md 一致，并检查关键词 | closed |
| T-02-23 | Information Disclosure | 用户目录路径回归 | medium | mitigate | MOCK-06 每次运行都拒绝用户目录形式的路径 | closed |
| T-02-24 | Tampering | mock 只做正常路径 | low | mitigate | 没有 `Promise.reject`、`setTimeout`、错误码分支 | closed |
| T-02-SC | Tampering | 供应链（依赖） | high | mitigate | devDependencies 只有 `@playwright/test` 1.64.1；本阶段 package.json/lockfile 未变 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-12 | MockBackend 遇到未知 op 时直接抛错。未知 op 只可能是测试代码的编程错误（D-02：mock 只做正常路径），让用例立即失败正是期望行为 | 规划时登记（02-02-PLAN，disposition: accept），安全审计确认 | 2026-11-03 |
| AR-02-02 | T-02-20 | Playwright 的本地 HTML 报告和 `test-results/` 可能带上应用页面内容。这两个目录只在本机，并被 `.gitignore` 忽略；Phase 1 的 D-02 已接受本地失败证据。用例本身不额外输出或附加个人计划文字，CSV 相关断言失败时已脱敏 | 规划时登记（02-04-PLAN，disposition: accept），安全审计确认 | 2026-11-03 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-03 | 25 | 25 | 0 | gsd-security-auditor（ASVS L1，block_on: high） |

审计时实际运行了 `npm test`（64 条通过，0 flaky）和 `node tools/privacy/privacy-check.mjs --all`（通过）。应用文件的 sha256 在审计前后都等于基线。

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-03
