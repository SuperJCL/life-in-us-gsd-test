---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 01
subsystem: privacy-tooling
tags: [privacy, plan-seed, node-vm, rule-d, seed-gate]

requires:
  - phase: 01-06 (v1.0 与 v2.0 前序阶段)
    provides: tools/privacy/privacy-check.mjs 的规则 A 到 E、pre-commit 与 pre-push 钩子、private/ 的 git 忽略
provides:
  - "tools/plan/extract-plan.mjs：默认提取、--check、--self-test 三种模式，纯函数全部导出"
  - "private/us-journey-tracker.original.html（仅本机）：改动前的原应用副本，sha256 等于 v1 基线（D-12）"
  - "private/plan-seed.json（仅本机）：所有者原计划的种子，内置任务 id 冻结为 P{n}-{i}（D-10、PLAN-05）"
  - "privacy-check.mjs 规则 D 改读种子加 denylist，不再读应用文件（D-06）"
  - "seedGate：检查范围里有根目录应用文件而没有种子时退出码 2（ROADMAP 成功标准 4 fail closed）"
  - "规则 A 的应用副本规则；PRIVACY.md § 5 改写"
affects: [07-02, 07-03, 07-04]

actuals:
  tokens: 9300
  tasks: 2
  commits: 2
plan_head_before: 61344a86df58773a6b5b00c5d5ae9eea3b7cd76c
plan_head_after: 7d0a8c04bbdec897f1d5cf8251b822e5f9ae74fb

tech-stack:
  added: []
  patterns:
    - "用 node:vm 在空上下文里求值两个标记之间的常量区，再 JSON 往返取结果"
    - "隐私工具只输出计数、编号、行号、字段路径、字符偏移和仓库相对文件名"
    - "没有种子时 fail closed：只有显式建空种子才能放行应用文件"

key-files:
  created:
    - tools/plan/extract-plan.mjs
  modified:
    - tools/privacy/privacy-check.mjs
    - PRIVACY.md

key-decisions:
  - "规则 D 的词条来源只有本地种子和 denylist；筛选（含汉字、至少 4 字、去结尾冒号）不变，没有新增放行名单（D-04、D-06）"
  - "extract-plan.mjs 只在被直接运行时才执行入口，被 import 时不执行，方便 07-02 之后复用纯函数"
  - "loadPlanTerms 返回 { terms, seedFound }；空种子也算找到，是明确的选择加入"
  - "--check 把取不到 DEFAULT_PLAN 记为一条形状问题，同时继续统计应用全文里的种子词条"

patterns-established:
  - "种子闸门：seedGate(paths, seedFound) 在逐个文件检查之前调用，run* 把结果放进 result.gate，main 写 stderr 并返回 gate.code"
  - "提取工具的自检样例由 synthHtml 在运行时拼接，只用合成文字，不依赖本机私有文件"

requirements-completed: [SEC-04]

coverage:
  - id: D1
    description: "原应用副本和本地种子只在本机：副本 sha256 等于 v1 基线，两者被 git 忽略，git ls-files private 为空"
    requirement: SEC-04
    verification:
      - kind: other
        ref: "Task 1 第 1 条 verify 命令（sha256 比对加 git check-ignore 加 git ls-files private）"
        status: pass
    human_judgment: false
  - id: D2
    description: "种子与以后的 plan 对象同形：7 组、38 项任务、任务 id 为组 id 加连字符加序号、4 个力量 id、两个 fitGoal 数字、非空 fitNote、预设键恰好 5 个"
    requirement: SEC-04
    verification:
      - kind: other
        ref: "Task 1 第 2 条 verify 命令（node 一行断言种子结构）"
        status: pass
    human_judgment: false
  - id: D3
    description: "规则 D 改读种子加 denylist，加载的词条不少于 66 个；自证种子包含原件块内的全部词条、原件副本仍被规则 D 拦住"
    requirement: SEC-04
    verification:
      - kind: unit
        ref: "node tools/privacy/privacy-check.mjs --self-test（82 项）"
        status: pass
      - kind: other
        ref: "node tools/privacy/privacy-check.mjs --all"
        status: pass
    human_judgment: false
  - id: D4
    description: "extract-plan.mjs 的 --self-test 和 --check：对仍含个人计划的应用返回 1，只报字段路径、偏移、词条序号和行号"
    requirement: SEC-04
    verification:
      - kind: unit
        ref: "node tools/plan/extract-plan.mjs --self-test（44 项）"
        status: pass
      - kind: other
        ref: "Task 2 第 2 条 verify 命令（--check 退出码 1、命中行格式、输出不含词条原文）"
        status: pass
    human_judgment: false
  - id: D5
    description: "种子闸门端到端：没有种子的一次性仓库里暂存根目录应用文件退出码 2，空种子不再是 2，不涉及应用文件时退出码 0；改名的应用副本被规则 A 拦住"
    requirement: SEC-04
    verification:
      - kind: integration
        ref: "Task 2 第 4 条 verify 命令（mktemp 一次性仓库）"
        status: pass
    human_judgment: false
  - id: D6
    description: "PRIVACY.md § 5 与新的词条来源、种子生成方式、种子闸门和空种子写法一致"
    requirement: SEC-04
    verification: []
    human_judgment: true
    rationale: "文档措辞是否清楚需要所有者阅读；verify 只用 grep 断言关键字存在"

duration: 约 45 分钟
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 01: 本地计划种子与规则 D 改读种子 Summary

**用 node:vm 从私有原件副本提取出同形的本地计划种子（7 组 38 项任务，冻结 id），隐私检查的规则 D 改读这份种子，并在没有种子的机器上对根目录应用文件 fail closed。**

## Performance

- **Duration:** 约 45 分钟（执行开始时没有记录起始时间，按提交时间估算）
- **Completed:** 2026-11-07T17:54:54Z
- **Tasks:** 2（Task 1 为 tracer）
- **Files modified:** 3 个被跟踪文件（1 个新建、2 个修改），另有 2 个仅本机、不进 git 的文件

## Accomplishments

- **原件副本（D-12）：** `private/us-journey-tracker.original.html` 的 sha256 等于 `tests/support/constants.ts` 里仍记录的 v1 基线，是。该副本和种子都被 git 忽略，`git ls-files private` 为空。
- **种子（D-10）：** 7 组、38 项任务、4 个力量项（id 依次为 bench、squat、dead、pull）、20 个预设（5 个类别键 fit、job、lang、oth、pro）、种子词条 66 个（HEAD 上块内提取是 65 个，加上力量组说明 1 个）。任务 id 按原代码规则冻结为 `P{n}-{i}`。
- **规则 D（D-06、D-04）：** 词条来源改为种子加 `private/denylist.txt`。运行时加载 68 个词条（种子 66 个，叠加 denylist 的额外词条，不少于 66）。筛选不变，没有新增任何放行名单或豁免。
- **实时自检：** “种子包含原件块内的全部词条”共 65 个，全部包含；“原件副本仍被规则 D 拦住”命中 16 行。两条都已计入通过的 82 项。
- **提取工具：** `extract-plan.mjs --self-test` 通过 44 项；`--check` 对仍含个人计划的应用输出 `形状问题 1；数值撞车 0；共享 4 字片段 0；占位式文字 0；应用里的种子词条 66`，退出码 1。形状问题那 1 条是“应用里没有可求值的 DEFAULT_PLAN”（07-02 才会加）。种子词条逐条只报序号和行号，行号落在应用的常量区（约第 299 到 323 行）和力量组说明那一行（第 510 行）。输出里没有任何种子词条原文，核对过。
- **种子闸门：** 在 `mktemp -d` 的一次性仓库里端到端验证三个退出码：暂存根目录应用且没有种子为 **2**（stderr 提到 `private/plan-seed.json`）；放入空种子 `{"v":1,"plan":{}}` 后为 **1**（本计划里规则 A 仍拦根目录应用，07-04 之后会是 0）；去掉应用、只暂存合成 README 且没有种子为 **0**。
- **规则 A：** 新增副本规则，文件名以 `us-journey-tracker` 开头、以 `.html` 结尾而不等于根目录应用文件的路径一律拦住；根目录应用文件那一条保持不变，直到 07-04。
- **PRIVACY.md § 5：** 改写为新的词条来源、种子生成方式、`--check`、种子闸门和空种子的写法。§ 1、§ 2、§ 8 没动，留给 07-04。

## Task Commits

1. **Task 1（tracer）：原件副本到提取工具到本地种子到规则 D 改读种子** - `216d062`（feat）
2. **Task 2：--check 与 --self-test、规则 A 副本规则、种子闸门、PRIVACY.md § 5** - `7d0a8c0`（feat）

**Plan metadata:** 由下面的 docs 提交记录（本 SUMMARY 加 STATE、ROADMAP 更新）。

## Files Created/Modified

- `tools/plan/extract-plan.mjs` - 新建。`pureSection`、`evalSection`、`legacyPlan`、`planTerm`、`planStrings`、`planTerms`、`planEntries`、`shapeOf`、`compareShape`、`numberCollisions`、`hanWindows`、`sharedHanFragments`、`placeholderLike`、`checkPlan`、`reportLines` 都已导出；CLI 三种模式。
- `tools/privacy/privacy-check.mjs` - 规则 D 改读种子（`seedTerms`、`PLAN_TERM_SOURCES`、`planTerm`）；`seedGate`；`commitPaths`；规则 A 副本规则；新增自检 82 项（含两条实时自检、种子闸门三项）。
- `PRIVACY.md` - § 5 改写。
- `private/us-journey-tracker.original.html`、`private/plan-seed.json` - 仅本机，不进 git。

## Decisions Made

- `extract-plan.mjs` 的入口只在被直接运行时执行（比较 `import.meta.url` 与 `process.argv[1]`），被 import 时不执行，避免 07-02 起在测试或脚本里导入纯函数时误触发。
- `checkPlan` 的 `problems` 返回结构化对象（shape、numbers、fragments、placeholders 四项），`reportLines` 负责拼 `--check` 的固定输出格式，两者都有自检覆盖；输出行不含计划文字。
- 种子闸门把“种子存在并解析成功”记为 `seedFound`；空种子也算，所以空种子是显式选择加入。

## Deviations from Plan

None - plan executed exactly as written.

补充说明（不算偏离）：本会话的提交署名行按运行时要求是 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`，与计划里写的 Opus 署名不同，以运行时为准。工作中用 heredoc 写含反斜杠的代码时两次被转义吞掉（正则里的 `\p` 和字符串里的 `\n`），自检第一次运行就暴露，已用 Edit 修正，没有进入提交。

## Issues Encountered

None。

## Known Stubs

无。

## Threat Flags

无新增网络、认证或文件访问面。种子闸门和副本规则是对 T-07-01、T-07-03、T-07-26 的缓解，计划的威胁登记册已覆盖。

## User Setup Required

None - no external service configuration required。

## Next Phase Readiness

- 07-02 改应用时，可用 `node tools/plan/extract-plan.mjs --check` 判定示例计划与原计划是否共享文字和数字；对仍含个人计划的应用它返回 1，改写完成后应输出 `CHECK OK`。
- 07-04 放行根目录应用文件后，要在没有种子的一次性克隆里用已提交的检查器再验证一次闸门（T-07-26）。
- 没有阻塞项。

## Self-Check: PASSED

- `tools/plan/extract-plan.mjs`、`private/plan-seed.json`、`private/us-journey-tracker.original.html` 存在。
- 提交 `216d062`、`7d0a8c0` 都在 HEAD 的祖先链上；`git rev-list --count` 得到 2。
- 两个任务的 acceptance_criteria 与 verify 命令全部重跑通过；`privacy-check.mjs --self-test`（82 项）、`--all` 通过；`extract-plan.mjs --self-test`（44 项）通过；`--check` 退出码 1。
- 三个被跟踪文件里没有任何种子词条原文（逐条核对为 0 处）。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
