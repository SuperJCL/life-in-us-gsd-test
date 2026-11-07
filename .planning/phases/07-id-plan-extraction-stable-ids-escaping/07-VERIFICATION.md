---
phase: 07-id-plan-extraction-stable-ids-escaping
verified: 2026-11-07T20:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-01-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-01-SUMMARY.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-02-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-02-SUMMARY.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-03-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-03-SUMMARY.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-04-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-04-SUMMARY.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-05-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-05-SUMMARY.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-06-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-06-SUMMARY.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-07-PLAN.md"
  - ".planning/phases/07-id-plan-extraction-stable-ids-escaping/07-07-SUMMARY.md"
  - "tests/e2e/data/stable-ids.spec.ts"
  - "tests/e2e/security/escaping.spec.ts"
  - "tests/e2e/security/id-whitelist.spec.ts"
  - "tests/e2e/security/state-validation.spec.ts"
  - "tests/support/constants.ts"
  - "tools/plan/extract-plan.mjs"
  - "tools/privacy/privacy-check.mjs"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:e28158925ac9c3e134f8a8bb4173a9daf7b507976fa19d828d0ac71a7e7b169a"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "自定义待办的 group 格式合格但不在当前计划里（如 P9）时，在目标页不显示、无法删除（WR-02）"
    addressed_in: "Phase 12"
    evidence: "07-REVIEW-DISPOSITION.md 记为 deferred：固定 P1–P7 的计划下只可能来自手工构造的备份；怎么显示或重新归属是 Phase 12 计划编辑器的设计问题，D-08 又不允许删除带用户文字的条目"
  - truth: "archived 字段被校验和保留，但没有任何地方使用（IN-05）"
    addressed_in: "Phase 12"
    evidence: "07-REVIEW-DISPOSITION.md 记为 deferred：PLAN-03 归档行为在 Phase 12 接上"
---

# Phase 7: 计划外置、稳定 id 与转义 Verification Report

**Phase Goal:** 应用代码里不再含个人计划：目标组、任务、力量项、每周健身目标和基础预设都从一个 `plan` 对象读取，内置的只有一份合成示例计划。现有任务 id 冻结不变，用户文字和导入数据一律按纯文本显示。v1 的 154 条用例在改动后的应用上照样通过，去个人化的应用文件因此可以进入公开仓库。
**Verified:** 2026-11-07
**Status:** passed
**Re-verification:** No — initial verification

验证方式：逐条读应用源码和测试代码，核对 `07-fix-full.json`（最终完整套件）、应用 sha256、隐私检查器和提取工具的自检。没有重跑完整 Playwright 套件，也没有读取 `private/` 下任何内容。

## Goal Achievement

### Observable Truths（ROADMAP 5 条成功标准）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | v1 的 154 条用例在改动后的应用上照旧通过，8 条已知 bug 标记用例照旧；sha256 基线有意识地更新，改了应用没更新基线时护栏会失败 | ✓ VERIFIED | `check-report.mjs test-results/07-fix-full.json --min-expected 173` 输出 `REPORT OK expected=173 flaky=0 unexpected=0`；报告内 8 条已知 bug 标记用例（`expectedStatus=failed` 或带 bug 标注）与 v1 一致。173 = 154 条 v1 + 19 条本阶段新增（plan-normalize 1、stable-ids 2、clean-clone 2、escaping 5、id-whitelist 2、state-validation 3、config-seam 3、SAFE-02 反向对照 1），与按文件统计的 173 一致。相对第 7 阶段开始前的提交（`61344a8`），`tests/e2e` 下只有 `app-integrity` 与 `repo-hygiene` 两个 v1 文件被改（文案与忽略清单，随应用进仓库而更新），其余 v1 用例文件零改动。应用 sha256 `bf9341ab…8a8b16` 等于 `tests/support/constants.ts` 的 `APP_SHA256`，也等于 `HEAD` 里应用文件的哈希；报告时间（11:39）晚于应用最后修改时间（11:34）。`app-integrity.spec.ts` 有 SAFE-02 基线用例加反向对照用例（内存里改一个字节后哈希必须不等） |
| 2 | 内置 id 仍是 `P<n>`、`P<n>-<i>`；旧格式合成备份导入后每项任务进度对应回原任务；“自定义待办”改为查计划；新增项用 `g-`/`t-`/`l-` 前缀 | ✓ VERIFIED | `us-journey-tracker.html` 的 `DEFAULT_PLAN` 里组 id 为 `P1`–`P7`、任务 id 为 `P1-1`…`P7-1`（共 38 个，与 `tests/fixtures/legacy-positional-backup.json` 的 38 个键一一对应）、力量 id 为 `bench/squat/dead/pull`。`GROUP_ID_RE`/`PLAN_TASK_ID_RE`/`LIFT_ID_RE` 同时接受 `P…` 与 `g-`/`t-`/`l-` 前缀。`renderGoals` 里用 `!planIds.has(x.id)` 判定自定义待办（第 678 行），不再看 id 形状；`/^P\d-\d+$/` 在应用里已无引用。`stable-ids.spec.ts` 两条用例（冻结 id、旧备份映射）在报告中通过；`state-validation.spec.ts` 里 `g-`/`t-`/`l-` 前缀备份通过导入检查并经过 `normalize` 保留 |
| 3 | 合成恶意数据（记录文字、任务名、组名、id、日期、力量当前值；`<script>`、`<img onerror>`、引号断开属性）打开四个视图和编辑弹窗时没有脚本执行、没有多出元素；id 不符合白名单的数据在加载和导入时被拒绝或清洗 | ✓ VERIFIED | 渲染防线：对应用里所有不带 `esc(` 的 `${…}` 插值逐个核对，剩下的只有内部常量（`p`、`C.k`、`it.k`）、`kOf()` 的白名单结果、数值计算和 `md()`（只输出数字和“月日”）；时间线的 `attr` 里 id 经 `esc()`；力量历史 `x.v` 逐项 `esc`。入口防线：`importProblem` 在 `normalize` 之前检查记录 id、自定义待办 id、进度键、力量键、日期，不合格整份拒绝（弹同一条格式错误 toast，不弹确认框）；`normalize` 加载时把坏 id 换成安全 id 并迁移进度键，坏日期回落，孤儿进度键丢弃，记录文字一条不删（`state.logs` 不过滤）。`escaping.spec.ts` 五条用例通过：绕过入口检查的内存变体、计划值变体、两道防线合在一起的真实应用用例、关掉转义的变体上检测器必须报出注入（反向对照）、源码门槛；`id-whitelist.spec.ts`、`state-validation.spec.ts` 共 5 条通过。审查后又补了原型链类别名（WR-01）和不存在日期（WR-06，`realDate` 往返比较），带对应用例，最终套件仍全绿 |
| 4 | 所有者原计划提取到被 git 忽略的本地种子；应用代码里只剩同形状的合成示例计划；隐私检查改为读种子，含个人计划文字的应用版本仍提交不了 | ✓ VERIFIED | `git check-ignore -v` 确认 `private/plan-seed.json` 和 `private/us-journey-tracker.original.html` 被 `.gitignore` 第 13 行（`private/`）忽略，`git ls-files private` 为空。应用里 `DEFAULT_PLAN` 是通用示例（英语练习、编程基础复习等），五个旧常量 `GROUPS/BUILTIN/GCAT/LIFTS/FIT_GOAL` 在应用里零引用。`tools/plan/extract-plan.mjs --check` 输出 `形状问题 0；数值撞车 0；共享 4 字片段 0；占位式文字 0；应用里的种子词条 0`、`CHECK OK`；`--self-test` 46 项通过。`privacy-check.mjs --all` 输出“规则 D：已加载 68 个个人计划词条”和“隐私检查通过（all，206 个文件）”，`--self-test` 100 项通过。没有种子时种子闸门以退出码 2 阻止提交应用文件（fail closed，07-01 实现并自检）。仓库内搜索 `TBD/FIXME/XXX` 无未跟踪的债务标记（唯一命中是 `extract-plan.mjs` 里检测占位文字的正则本身） |
| 5 | 去个人化的应用进入公开仓库：干净克隆后不配服务器，`npm test` 直接跑通，打开页面看到示例计划和空记录；`PRIVACY.md`、隐私钩子和缺文件提示同步更新 | ✓ VERIFIED（按所有者说明理解为“已被仓库跟踪、隐私检查通过、可推送”） | `git ls-files` 含 `us-journey-tracker.html`（提交 `ad258c0`，规则 A 放行根目录应用、仍禁子目录同名文件和根目录改名副本，`.gitattributes` 固定应用为 LF）。`clean-clone.spec.ts` 两条用例（SEC-04：LF 与私有副本不进 git；全新启动显示示例计划且无记录）在最终报告中通过。07-04 的一次性干净克隆实跑：无 `private/`、无服务器配置，完整套件 163 条通过（`REPORT OK expected=163 flaky=0 unexpected=0`）。`PRIVACY.md` 第 1、5 节、`tests/README.md`、`tests/support/static-server.cjs` 的缺文件提示均已改成“应用在仓库里”。钩子按 D-13 不改（只调用检查器，`.githooks/pre-commit` 为 `exec node tools/privacy/privacy-check.mjs --staged`），规则随检查器更新。本地提交未推送（`origin/main` 仍停在 `cf574d2`），推送需所有者另行确认，不算缺口 |

**Score:** 5/5 truths verified（0 条存在但行为未验证）

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | WR-02：自定义待办 `group` 格式合格但不在当前计划里时，目标页不显示、无法删除 | Phase 12 | 07-REVIEW-DISPOSITION.md：固定 P1–P7 计划下只能来自手工构造的备份；显示或重新归属属于计划编辑器设计，D-08 又不允许删带文字的条目 |
| 2 | IN-05：`archived` 字段被接受、保留但不起作用 | Phase 12 | 07-REVIEW-DISPOSITION.md：PLAN-03 归档行为在 Phase 12 接上 |

两项都不影响本阶段成功标准（标准 3 针对“id 不合白名单”，格式合格但不在计划里的组不属于此类）。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `us-journey-tracker.html` | 去个人化、`plan` 对象驱动、转义、入口白名单、`USJ_CONFIG` 缝 | ✓ VERIFIED | `DEFAULT_PLAN`、`normalizePlan`、`usePlan`、`planTasks/planIds/planCat`、`importProblem`、深度修正的 `normalize`、`readConfig` 均存在且被调用；已提交，`HEAD` 内容哈希等于 `APP_SHA256` |
| `tools/plan/extract-plan.mjs` | 提取、`--check`、`--self-test` | ✓ VERIFIED | 自检 46 项，`--check` 输出 CHECK OK |
| `tools/privacy/privacy-check.mjs` | 规则 D 读种子、种子闸门、规则 A 放行根目录应用 | ✓ VERIFIED | 自检 100 项，`--all` 通过 |
| `tests/support/constants.ts` | 更新后的 `APP_SHA256` | ✓ VERIFIED | 与应用实际哈希相等 |
| `tests/support/app-source.ts`、`app-variant.ts`、`tests/fixtures/malicious-state.ts`、`legacy-positional-backup.json` | 白盒求值、内存变体、合成载荷、旧备份 | ✓ VERIFIED | 存在并被对应 spec 引用 |
| `tests/e2e/{data,security,platform,storage}` 新增 9 个 spec 文件 | 覆盖 PLAN-05、SEC-01、SEC-04、TEST-01 | ✓ VERIFIED | 全部 expected 通过 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| 视图渲染（`renderGoals/Week/Cal/Timeline`、编辑弹窗） | `plan` 对象 | `plan.groups`、`plan.lifts`、`plan.fitGoal`、`plan.presets` | WIRED | 旧常量零引用，视图只读 `plan` |
| 导入 | `importProblem` → `normalize` → `confirm` → `state` | 导入处理函数 | WIRED | 第 813 行：先 `importProblem`，不合格抛错走格式错误 toast |
| 加载 | `normalize` | `init` 读取 localStorage / `db` 之后 | WIRED | 修正不保存，记录文字不删 |
| 自定义待办判定 | `planIds` | `!planIds.has(x.id)` | WIRED | 不再看 id 形状 |
| 隐私检查规则 D | `private/plan-seed.json` + `private/denylist.txt` | `seedTerms` / `loadPlanTerms` | WIRED | 实跑加载 68 个词条 |
| 应用改动 | `APP_SHA256` | SAFE-02 + 反向对照 | WIRED | 哈希相等，反向对照用例通过 |
| `USJ_CONFIG` | `init` | `readConfig`，backend 非 null 时停在加载之前 | WIRED | `config-seam.spec.ts` 三条用例通过；v1 用例走 `backend: null` 旧路径 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| 目标页 | `plan.groups`、`planIds` | `usePlan(DEFAULT_PLAN)` → `normalizePlan` | 是（38 个任务） | ✓ FLOWING |
| 力量卡 | `plan.lifts` + `state.lifts` | 计划 + 加载修正后的状态 | 是 | ✓ FLOWING |
| 周视图健身目标 | `plan.fitGoal` | 计划 | 是 | ✓ FLOWING |
| composer 预设标签 | `plan.presets` 基础列表 + `state.presets` 增减 | 两层，composer 未改 | 是 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 最终完整套件 | `node tools/test-report/check-report.mjs test-results/07-fix-full.json --min-expected 173` | `REPORT OK expected=173 flaky=0 unexpected=0` | ✓ PASS |
| 应用哈希等于基线 | `sha256sum us-journey-tracker.html` 对比 `APP_SHA256` | 相等 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` / `--self-test` | 通过 / 100 项通过 | ✓ PASS |
| 提取工具 | `node tools/plan/extract-plan.mjs --check` / `--self-test` | CHECK OK / 46 项通过 | ✓ PASS |

没有重跑 Playwright；行为依赖型真值（状态迁移、整份拒绝、加载修正）均由上面报告里通过的具体用例证明，不是靠符号存在判断。

### Probe Execution

Step 7c 跳过：本阶段没有声明 `probe-*.sh` 一类的探针；套件里的 `platform/probes.spec.ts` 是 v1 用例，已包含在 173 条里通过。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PLAN-05 | 07-02、07-06（07-07 汇总） | 现有任务 id 保持不变，旧备份导入后进度仍对应到正确的任务 | ✓ SATISFIED | 标准 2 的证据；`REQUIREMENTS.md` 已勾选，追踪表为 Complete |
| SEC-01 | 07-05、07-06、07-07 | 用户文字显示时都经过转义，导入或同步来的恶意脚本不执行 | ✓ SATISFIED | 标准 3 的证据 |
| SEC-04 | 07-01、07-04、07-07 | 去个人化的应用放进公开仓库，克隆后不配服务器也能跑，看到示例计划和空记录 | ✓ SATISFIED | 标准 4、5 的证据（推送待所有者确认，见下） |
| TEST-01 | 07-03、07-07 | 154 条测试走旧路径继续通过，sha256 基线机制随应用改动更新 | ✓ SATISFIED | 标准 1 的证据 |

没有孤儿需求：`REQUIREMENTS.md` 里映射到 Phase 7 的四个 ID 都被计划认领。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 本阶段修改的应用、工具、测试文件 | - | `TBD/FIXME/XXX` 债务标记 | 无 | 没有发现（`extract-plan.mjs` 第 265 行只是检测“占位文字”的正则） |
| `us-journey-tracker.html` | 787、789 | `${lf}`、`${g}` 插进 `querySelector` 选择器字符串 | ℹ️ Info | 值来自元素自身的 `data-*` 属性，而这些属性值已由 `esc()` 写入；不构成注入，仅是风格上的观察 |

### Review 处置情况（07-REVIEW.md / 07-REVIEW-FIX.md / 07-REVIEW-DISPOSITION.md）

- 已修复 6 条警告：WR-01（原型链类别名）、WR-03（种子损坏时不回显计划文字）、WR-04（UTF-16 文本不再绕过规则 B/C/D）、WR-05（无 HEAD 时 `--all` 不崩溃）、WR-06（不存在的日期）、WR-07（`.agents/`、`.codex/`、`AGENTS.md` 忽略并在规则 A 拦下）。修复后全量 173 条通过。
- WR-02 推迟到 Phase 12，见上面“Deferred Items”。
- 8 条 Info 处于 open 或 deferred，未阻塞；其中 IN-04（重复 id 不去重）和未编号的 `doneDate` 清空后显示“完成于 0月0日”的小问题，处置台账已记为 open，留给之后的数据修正工作。

### Human Verification Required

无必须由人当场确认的项。以下几点只作记录：

- 示例计划的措辞在 07-04 的所有者检查点已由所有者批准，条件是改两处文字（每周复盘的占位提示和 `pull` 力量项备注），两处在应用首次提交前已改好；这是所有者决定，不是缺陷。
- 推送：应用只有本地提交，未推送；推送需所有者另行确认。
- WR-04 的 UTF-16 识别用了启发式阈值：没有 BOM 且几乎全是汉字的 UTF-16 文件仍可能被当作二进制跳过（07-REVIEW-FIX.md 已记；PowerShell 5 的重定向带 BOM，主要场景已覆盖）。

### 验证方没有独立复核的一点

D-12 要求私有原件副本保持 v1 基线哈希。验证过程中对该私有文件做哈希的操作被权限系统拒绝，所以验证方没有自己重算这个哈希，这一点依靠 07-01 SUMMARY 的记录。旁证：`extract-plan.mjs --check` 读取这份原件副本并通过形状比对（CHECK OK），没有迹象表明它被改动。该文件不属于任何对外交付物，不影响判定。如需绝对确认，所有者可在本机对 `private/us-journey-tracker.original.html` 运行一次 `sha256sum`，与 `git show v1.0:tests/support/constants.ts` 里的 `APP_SHA256` 比对。

### Gaps Summary

没有阻塞性缺口。5 条 ROADMAP 成功标准和 4 个需求 ID 都有代码与测试记录支撑；应用哈希、基线和最终套件报告三者一致。唯一遗留项是 WR-02 和 `archived` 行为，均已明确推迟到 Phase 12。

---

_Verified: 2026-11-07_
_Verifier: Claude (gsd-verifier)_
