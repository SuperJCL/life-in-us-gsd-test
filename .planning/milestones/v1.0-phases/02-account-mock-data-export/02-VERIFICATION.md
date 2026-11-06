---
phase: 02-account-mock-data-export
verified: 2026-11-03T20:40:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/02-account-mock-data-export/02-01-PLAN.md"
  - ".planning/phases/02-account-mock-data-export/02-01-SUMMARY.md"
  - ".planning/phases/02-account-mock-data-export/02-02-PLAN.md"
  - ".planning/phases/02-account-mock-data-export/02-02-SUMMARY.md"
  - ".planning/phases/02-account-mock-data-export/02-03-PLAN.md"
  - ".planning/phases/02-account-mock-data-export/02-03-SUMMARY.md"
  - ".planning/phases/02-account-mock-data-export/02-04-PLAN.md"
  - ".planning/phases/02-account-mock-data-export/02-04-SUMMARY.md"
  - ".planning/phases/02-account-mock-data-export/02-05-PLAN.md"
  - ".planning/phases/02-account-mock-data-export/02-05-SUMMARY.md"
  - "tests/e2e/data/synthetic-data.spec.ts"
  - "tests/e2e/io/export.spec.ts"
  - "tests/e2e/platform/mock-contract.spec.ts"
  - "tests/e2e/storage/account-mode.spec.ts"
  - "tests/fixtures/full-state.json"
  - "tests/fixtures/legacy-categories.json"
  - "tests/fixtures/malformed-imports.ts"
  - "tests/fixtures/minimal-state.json"
  - "tests/mocks/CONTRACT.md"
  - "tests/mocks/claude-backend.ts"
  - "tests/mocks/claude-runtime.ts"
  - "tests/support/app.ts"
  - "tests/support/expect-from-fixture.ts"
covered_digest: "v4:sha256:e90bf06a7943bcb4cfe438ba5db13233ffc32c946e6dc62d3c163716e104047e"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: 账户模式、合成数据与导出 Verification Report

**Phase Goal:** 开发者可以把合成数据装进 mock 后端，在能被证明的账户模式下打开应用，并读到 db 读写记录和导出文件的内容。
**Verified:** 2026-11-03T20:40:00Z
**Status:** passed
**Re-verification:** No，首次验证

本阶段是测试基础设施阶段，“应用能用”不在范围内。验证对象是 ROADMAP 里 Phase 2 的五条成功标准（roadmap 契约）。验证方式：读 mock、harness、spec、fixture、CONTRACT.md 的实际代码；独立运行完整 `npm test`；对关键断言做两次变异实验（改完已用 `git checkout` 还原）。

## Goal Achievement

### Observable Truths

| # | Truth（ROADMAP 成功标准） | Status | Evidence |
|---|---------------------------|--------|----------|
| 1 | mock 契约自测通过：`use()` 异步、同名同结果、命名空间冻结、未知名字返回 `null`；`CONTRACT.md` 写明版本 0.2.96、已实现与未实现条目 | ✓ VERIFIED | `tests/mocks/claude-runtime.ts` 中 `use` 用 `Map.has` 判断名字、缓存 Promise，三个命名空间和 `window.claude` 都是 `Object.freeze`（`defineProperty` 不可写不可配置）；`mock-contract.spec.ts` 有 7 条 MOCK-02/04/06 用例（异步时序、memoize、冻结、快照形状、路径文法、`user.id()` 两种取值、`downloads.save` 三种数据类型），全部通过。`CONTRACT.md` 245 行：含 0.2.96、第 2 节已实现 11 条（含契约原文摘录）、第 3 节未实现清单（`onSnapshot`、全部错误码、限流、延迟等）、mock 结构、重新核对步骤。MOCK-06 用例读该文件并核对版本常量与关键词，并断言不含本机路径 |
| 2 | 账户模式用例能证明自己真的跑在账户模式：状态栏账户文案，mock 记录恰好一次读取（`data/users/<id>/state`），localStorage 无应用的键；`user.id()` 为 `null` 时用例变红 | ✓ VERIFIED | `AppHarness.expectAccountMode()`（`tests/support/app.ts`）三项检查：`backend.reads` 精确等于 `[ACCOUNT_DOC_PATH]`、`#status` 等于账户文案、localStorage 读应用键为 `null`。常驻反向对照有四条：`user.id()` 为 `null` 时 `rejects.toThrow(/读取次数或路径不对/)`；另外两条分别只破坏状态栏、只破坏 localStorage，证明三项各自都有判别力；还有一条拒绝同 harness 重复 `open`。变异实验：把 mock 的 `user.id()` 临时改成恒返回 `null` 后，`account-mode.spec.ts` 的 MOCK-03 等用例变红（`toHaveText` 失败），已还原 |
| 3 | 账户模式下记一笔后能读到 mock 记录的写入；刷新后数据仍从 mock 读回 | ✓ VERIFIED | `account-mode.spec.ts` MOCK-03 用例：种子只存在于 `MockBackend`（localStorage 为空），记一笔后 `expectPersisted` 轮询到 mock 里的文档含新条目，`backend.writes` 最后一条路径为 `ACCOUNT_DOC_PATH` 且含种子条目和新条目；`app.reload()` 后 `expectAccountMode({reads: 2})`，两条记录在本周视图重新可见。状态存在 Node 侧 `MockBackend`，页面刷新不丢。另有 manual 时钟用例证明启动只读一次、不写（哨兵写入排在其后且 `writes` 恰好一条） |
| 4 | 完整 fixture 与边界 fixture（旧类别名、最小状态、畸形导入）就位，通过合成标记检查；用完整 fixture 启动后五类记录、各状态任务、自定义待办、力量历史、本周复盘都能在页面找到 | ✓ VERIFIED | `tests/fixtures/` 下 `full-state.json`、`legacy-categories.json`、`minimal-state.json`、`malformed-imports.ts` 均存在且含 `_synthetic`；`repo-hygiene.spec.ts` 的 SAFE-03 用例通过，`node tools/privacy/privacy-check.mjs --all` 通过（87 个文件）。`synthetic-data.spec.ts` 的 DATA-01 页面用例经账户 mock 加载完整 fixture，断言：本周五个类别各至少一条且逐条可见、抵达日期、本周复盘、预设标签、时间线逐条文本、尖括号文本不生成元素、已完成/已过期/今日与未来截止的任务、自定义待办、力量当前值与历史行。期望值由 `expect-from-fixture.ts` 的 helper 从 fixture 推导。DATA-02：旧类别名映射、最小状态为空页面、畸形导入三类（非 JSON、非对象、字段类型错）确认确实畸形且不落盘 |
| 5 | 账户模式下导出按钮出现；日历 CSV 与 fixture 推导的期望逐字一致；JSON 备份与当前状态深度相等；文件名和内容都从 `downloads.save` 记录读到 | ✓ VERIFIED | `AppHarness.ready()` 在账户模式要求 `#exportCsv`、`#exportJson` 可见。`export.spec.ts`：IO-02 用 `csvMismatch(data, expected, texts)` 做全等比较，`expected` 来自独立实现的 `expectedCalendarCsv`（不导入应用代码，内置任务文字运行时从页面 aria-label 读取）；另有手写三行金标准（引号转义、80 字符截断、MM/DD/YYYY、换行）同时约束应用输出和生成器；空导出提示且不保存；IO-03 备份 `toEqual(withoutSynthetic(fixture))`，改动后备份等于最新写入的文档。全部数据只读自 `app.backend.downloads`。变异实验：把 `usDate` 临时改成 DD/MM/YYYY，IO-02 CSV 用例变红，已还原 |

**Score:** 5/5 truths verified，0 present-behavior-unverified。

行为依赖型的真值（刷新后数据保留、启动不写、反向对照变红）都有实际运行的测试覆盖，不是只靠符号存在。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/mocks/claude-runtime.ts` | 页面侧 mock，自包含、只做正常路径 | ✓ VERIFIED | 128 行，无 import，无 reject 逻辑；被 `AppHarness.open` 经 `addInitScript` 注入 |
| `tests/mocks/claude-backend.ts` | Node 侧 `MockBackend`，记录 reads/writes/downloads | ✓ VERIFIED | 49 行，`handle` 三个 op，未知 op 抛错；被 `AppHarness` 持有 |
| `tests/mocks/CONTRACT.md` | 版本、已实现、未实现、重新核对步骤 | ✓ VERIFIED | 245 行，内容实质，无本机路径 |
| `tests/support/app.ts` | `AppHarness`（`open`、`ready`、`reload`、`expectAccountMode`、`expectPersisted`） | ✓ VERIFIED | 146 行，被所有账户模式 spec 使用 |
| `tests/support/expect-from-fixture.ts` | 独立的期望推导 | ✓ VERIFIED | 150 行，不导入应用，被 export 与 data spec 使用 |
| `tests/fixtures/*`（4 个） | 完整、旧类别、最小、畸形导入 | ✓ VERIFIED | 全部带 `_synthetic`，内容均为合成文字 |
| `tests/e2e/storage/account-mode.spec.ts`、`io/export.spec.ts`、`data/synthetic-data.spec.ts`、`platform/mock-contract.spec.ts` | 对应各条成功标准的用例 | ✓ VERIFIED | 均存在并通过 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `AppHarness.open` | `installClaudeMock` | `page.addInitScript(installClaudeMock, {binding, userId})` | ✓ WIRED | 在 `goto` 之前注入；PROBE-7 证明 `exposeBinding` 在 init 阶段已可调用 |
| 页面 mock | `MockBackend.handle` | `page.exposeBinding(MOCK_BINDING_NAME, ...)` | ✓ WIRED | `db.get`/`db.set`/`downloads.save` 都经 `rpc` 往返；记录在 Node 侧 |
| 应用 `init()` | mock `db.doc(path).get()/set()` | `data/users/<id>/state` | ✓ WIRED | 应用 `init()` 用 `db`、`user.id()` 取存储，路径与 `ACCOUNT_DOC_PATH` 一致，测试读取记录验证 |
| 应用导出按钮 | `downloads.save` 记录 | `window.__dl.save` 到 `app.backend.downloads` | ✓ WIRED | 导出用例从记录读文件名与内容 |
| 用例 | fixture 推导期望 | `expect-from-fixture.ts` helper | ✓ WIRED | CSV、任务分桶、类别映射都由 helper 推导 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| 本周/时间线/目标视图 | `state`（来自种子文档） | `MockBackend.seed` 到 `db.get` 到应用 `normalize` | 是，页面断言逐条找到 fixture 内容 | ✓ FLOWING |
| `downloads` 记录 | `{filename, data}` | 应用 `save()` 到 mock `downloads.save` 到 `MockBackend.downloads` | 是，内容与期望逐字比较 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 完整测试套件 | `npm test` | 64 passed，0 failed，0 flaky（59.4s） | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` | 通过，87 个文件 | ✓ PASS |
| 应用文件未被修改 | `sha256sum us-journey-tracker.html` | 与基线 `2a954fd0...1872` 一致 | ✓ PASS |
| 变异：`usDate` 改为 DD/MM/YYYY | 运行 IO-02 CSV 用例 | 用例失败 | ✓ PASS（对照有效，已还原） |
| 变异：mock 的 `user.id()` 恒返回 `null` | 运行 `account-mode.spec.ts` | 账户模式用例失败 | ✓ PASS（对照有效，已还原） |

### Probe Execution

本阶段声明的探针是 Playwright 内的 PROBE-1 到 PROBE-7（`probes.spec.ts`），没有 `scripts/*/tests/probe-*.sh`。PROBE-7（`exposeBinding` 在页面脚本前可调用）在完整 `npm test` 中通过。

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| PROBE-1 到 PROBE-7 | `npm test`（`probes.spec.ts`） | 全部通过 | PASS |

### Requirements Coverage

PLAN frontmatter 里声明的 Phase 2 需求 ID 与 ROADMAP、REQUIREMENTS.md 一致，没有遗漏，没有孤儿需求。02-01 声明的 SAFE-01、SAFE-04、ENV-03、MOCK-01 属于 Phase 1 审查修复（D-10），不在本阶段的九个 ID 里，且对应用例在 `guardrails.spec.ts`、`smoke.spec.ts` 中通过。

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MOCK-02 | 02-02、02-05 | `window.claude` mock，`use("db"/"user"/"downloads")`，冻结，未知返回 `null` | ✓ SATISFIED | `mock-contract.spec.ts` 的 MOCK-02 用例 |
| MOCK-03 | 02-02 | 读到 db 读写记录，刷新后保留 | ✓ SATISFIED | `account-mode.spec.ts` MOCK-03 两条用例 |
| MOCK-04 | 02-02、02-04、02-05 | 导出按钮出现，读到 `downloads.save` 文件名与内容 | ✓ SATISFIED | `account-mode.spec.ts`、`export.spec.ts`、`mock-contract.spec.ts` |
| MOCK-05 | 02-02 | 能证明跑在账户模式，不因静默回退而误通过 | ✓ SATISFIED | `expectAccountMode` 与三条常驻反向对照；变异实验确认 |
| MOCK-06 | 02-05 | 版本、已实现、未实现写入 `CONTRACT.md` | ✓ SATISFIED | `CONTRACT.md` 与 MOCK-06 用例 |
| DATA-01 | 02-03 | 合成完整状态 fixture | ✓ SATISFIED | `full-state.json` 与 DATA-01 三条用例 |
| DATA-02 | 02-03 | 旧类别名、最小状态、畸形导入 fixture | ✓ SATISFIED | 三个 fixture 与 DATA-02 三条用例 |
| IO-02 | 02-04 | 日历 CSV 内容正确 | ✓ SATISFIED | `export.spec.ts` IO-02 三条用例 |
| IO-03 | 02-04 | JSON 备份与当前状态一致 | ✓ SATISFIED | `export.spec.ts` IO-03 两条用例 |

### Anti-Patterns Found

对本阶段改动的 `tests/`、`tools/` 文件扫描 `TBD|FIXME|XXX`：无命中。无本机绝对路径，无应用的个人计划文字（privacy-check 规则 D 通过，已载入 65 个个人词条）。mock 中没有任何 `reject`、错误码或定时器逻辑，符合 D-02。

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| （见下方 Advisory） | - | 审查遗留 INFO | ℹ️ Info | 不阻塞 |

审查遗留的 7 条 INFO（IN-01 到 IN-07，处置为 open，按范围留待后续）已读过，与成功标准的关系如下，均不推翻任何一条真值：

- IN-01：README 写“六项探针”，实际七项，文档小错。
- IN-02：端口 4789 在多处写死，未用 `PORT` 常量。
- IN-03：IO-03 首个用例里“还没有任何写入”是单次采样，说服力弱，但同一用例的深度相等比较和后一条“改动后备份等于最新文档”用例仍成立。
- IN-04：“每个用例从空 mock 开始”的断言检测不到共享状态；实际上 `MockBackend` 在 `AppHarness` 内按用例新建，结构上不共享。
- IN-05：DATA-02 的合成标记检查可被注释满足，属于 Phase 1 SAFE-03 检查的强度问题，另有 privacy-check 兜底。
- IN-06：`local-seed.json` 读取在四个 spec 里各写一份；`CONTRACT.md` 未实现清单漏了一项。
- IN-07：`csv-masking.spec.ts` 第 5 条用例的名字声称的覆盖没有守住，`csvMismatch` 兜底分支缺用例，影响的只是失败诊断的脱敏，不影响比较判定。

### Human Verification Required

无。本阶段的成功标准全部由自动化测试在真实浏览器里运行验证，没有视觉、实时或外部服务类的验证项。

### Gaps Summary

没有阻塞缺口。五条成功标准都有对应的、会失败的断言：两次变异实验分别证明账户模式自证与 CSV 逐字比较确实对错误敏感。`npm test` 64 条全部通过且无 flaky，应用文件的 sha256 与基线一致，隐私检查通过。7 条 INFO 属于改进项，已记录在 `02-REVIEW-DISPOSITION.md`，建议后续阶段顺带处理。

一点说明：`CONTRACT.md` 里的契约原文摘录来自 Claude Code 自带技能的类型定义，本次验证无法在不读取机器本地技能目录的情况下逐字比对；该风险由 PROBE-7 与重新核对步骤（第 5 节）覆盖，不作为缺口。

---

_Verified: 2026-11-03T20:40:00Z_
_Verifier: Claude (gsd-verifier)_
