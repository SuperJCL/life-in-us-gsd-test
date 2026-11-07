---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 02
subsystem: app-plan-extraction
tags: [plan-object, stable-ids, normalizePlan, node-vm, sha256-baseline]

requires:
  - phase: 07-01
    provides: "extract-plan.mjs --check、本地种子 private/plan-seed.json、私有原件副本、规则 D 读种子"
provides:
  - "应用只从 plan 对象读计划：DEFAULT_PLAN、normalizePlan、usePlan、plan / planTasks / planIds / planCat、三条 id 正则（应用文件仍未被 git 跟踪）"
  - "五个旧计划常量在应用里零引用；CATS 每项只剩 n、k（健身另有 direct）"
  - "同形的合成示例计划，--check 输出 CHECK OK"
  - "新的 APP_SHA256（随应用改动在同一次提交里更新）"
  - "tests/support/app-source.ts 的 loadAppPure：不开浏览器求值应用纯函数段"
  - "3 条 PLAN-05 用例和 38 个位置 id 的合成旧备份 fixture"
affects: [07-03, 07-04, 07-05, 07-06, phase-08, phase-09, phase-12]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: 5bddc6ed6c25c41306a8d9bf0ca58a15c79ef6cd
plan_head_after: d075f3055f53a846f6e6d1e5a67d5bea64bb46e7

tech-stack:
  added: []
  patterns:
    - "计划数据放在 plan 对象里，由 normalizePlan 做白名单校验、usePlan 在校验失败时回落到 DEFAULT_PLAN"
    - "用 node:vm 求值应用的纯函数段（两个标记之间），单元用例不开浏览器"
    - "改应用就在同一次提交里更新 APP_SHA256，没更新时 SAFE-02 失败"

key-files:
  created:
    - tests/support/app-source.ts
    - tests/fixtures/legacy-positional-backup.json
    - tests/e2e/data/stable-ids.spec.ts
    - tests/e2e/data/plan-normalize.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/task-ids.ts

key-decisions:
  - "plan 形状为 {v, presets(按类别键 lang、pro、fit、job、oth), groups, lifts, fitGoal, fitNote}；组和任务用 id 字段，不再用 p 和位置生成"
  - "normalizePlan 只要有一处不合格就整份返回 null；usePlan 遇到 null 回落到 DEFAULT_PLAN 并返回 false"
  - "planTasks 保持原内置任务对象的形状 {id, group, text}，allTasks 只是把它与自定义待办拼起来；archived 字段只接受、不做任何归档行为"
  - "自定义待办改为 !planIds.has(id) 判断，按 id 形状的正则已删除"
  - "示例计划与原计划同形：7 组、38 项任务、4 个力量项（bench、squat、dead、pull，单位 kg）、预设模式不变（lang 全直接记录，pro 全预填，fit 全直接记录，job 三个预填加两个直接记录，oth 空）"
  - "没有加任何本地加载自己计划的入口（D-11）；USJ_CONFIG 配置缝在 07-03"

patterns-established:
  - "冻结 id：内置组、任务的 id 是 DEFAULT_PLAN 里的显式字面量 P{n}、P{n}-{i}；新增项用 g-、t-、l- 加 uid()"
  - "两层预设：基础列表来自 plan.presets[类别键]，用户的增减仍在 state.presets，composer 不改"

requirements-completed: [PLAN-05, TEST-01, SEC-04]

coverage:
  - id: D1
    description: "应用不再含所有者的个人计划：五个旧常量零引用，CATS 只剩 n、k、direct，extract-plan.mjs --check 为 CHECK OK（形状、数值撞车、共享 4 字片段、占位式文字、种子词条全为 0）"
    requirement: SEC-04
    verification:
      - kind: other
        ref: "node tools/plan/extract-plan.mjs --check（CHECK OK，退出码 0）"
        status: pass
      - kind: other
        ref: "Task 1 第 2 条 verify 命令（grep 零引用门槛加 node:vm 求值 CATS）"
        status: pass
    human_judgment: false
  - id: D2
    description: "示例计划的文字读起来像一份真实、通用的计划（D-01）"
    verification: []
    human_judgment: true
    rationale: "是否像样只能由人判断，放在 07-04 的人工检查点；机器只能证明不含占位式文字、不与原计划共享文字"
  - id: D3
    description: "读计划的 v1 用例在改动后的应用上照旧通过：目标、本周视图、本周预设和 composer、导出、合成数据、时间线、应用完整性共 11 个 spec"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "npm test -- --workers=1 <11 个 spec 路径> + tools/test-report/check-report.mjs（REPORT OK expected=55 flaky=0 unexpected=0）"
        status: pass
    human_judgment: false
  - id: D4
    description: "内置 id 冻结：目标页 7 组的组号和每组任务 id 是位置 id，4 张力量卡 id 固定；旧格式备份的 38 个进度键全部落回同组同位置同 id 的任务，完成日期、截止日期和保存的 tasks 与 fixture 一致"
    requirement: PLAN-05
    verification:
      - kind: e2e
        ref: "tests/e2e/data/stable-ids.spec.ts#PLAN-05 the sample plan keeps the frozen positional group and task ids"
        status: pass
      - kind: e2e
        ref: "tests/e2e/data/stable-ids.spec.ts#PLAN-05 a legacy positional backup maps every task progress back to the same task"
        status: pass
    human_judgment: false
  - id: D5
    description: "normalizePlan 接受示例计划和 g-、t-、l- 前缀 id，拒绝格式不合格或重复的 id 等 40 多种变体；usePlan 对不合格计划返回 false 并回落到 38 项内置任务"
    requirement: PLAN-05
    verification:
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-05 normalizePlan accepts the sample plan and prefixed ids and rejects malformed or duplicate ids"
        status: pass
    human_judgment: false
  - id: D6
    description: "APP_SHA256 随应用改动在同一次提交里更新，私有原件副本仍是 v1 基线，应用文件仍未被 git 跟踪"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline"
        status: pass
      - kind: other
        ref: "Task 1 第 2 条 verify 命令（sha256 比对加 git ls-files）"
        status: pass
    human_judgment: false

duration: 约 10 分钟
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 02: 个人计划移出应用、内置 id 冻结 Summary

**应用里的目标组、任务、力量项、每周健身目标和基础预设全部改读 plan 对象，代码里只剩一份与原计划同形、通用文字的合成 DEFAULT_PLAN；内置 id 冻结为显式字面量，旧格式备份的 38 个进度键逐项对回原任务。**

## Performance

- **Duration:** 约 10 分钟（17:58:41Z 到 18:08Z）
- **Started:** 2026-11-07T17:58:41Z
- **Completed:** 2026-11-07T18:08:23Z
- **Tasks:** 2（Task 1 为 tracer）
- **Files modified:** 7（4 个新建、3 个修改；应用文件本身被 git 忽略，不在提交里）

## Accomplishments

- **--check：** 只改写了 1 轮就得到 `形状问题 0；数值撞车 0；共享 4 字片段 0；占位式文字 0；应用里的种子词条 0` 和 `CHECK OK`（初次跑出共享片段 4 处、种子词条 1 处，都在示例侧，按字段路径和偏移改写；全程没有读原计划或种子）。
- **零引用门槛：** `GROUPS`、`BUILTIN`、`GCAT`、`LIFTS`、`FIT_GOAL` 在应用全文里 0 行（v1 原件上 16 行）；CATS 在 node:vm 里求值，恰好 5 项，字段只有 n、k、direct；按 id 形状判断的正则和 CATS 里的预设数组都已删除。常量区之外的 13 处引用（allTasks 1、lift 1、planCat 5、本周健身那一行 3、遍历力量项和目标组各 1、saveLift 1）全部换成读 plan，组号 `g.p` 改为 `g.id`。
- **plan 对象：** `DEFAULT_PLAN` 自包含；`normalizePlan` 只信类型、返回新对象，任何一处不合格返回 null；`usePlan` 在 null 时回落到 `DEFAULT_PLAN` 并返回是否被接受。`presetsFor` 的基础列表改读 `plan.presets[类别键]`，两层预设和 composer 不变；力量组说明改为 `${esc(plan.fitNote)}`（新写的插值直接转义）。
- **基线：** `APP_SHA256` 旧值（v1 基线）`2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`，新值 `6dbc1ff66026981f007f7bec310256af95c6e0f102c57bc438aa129f404338eb`，随 Task 1 提交一起更新；私有原件副本的哈希仍是 v1 基线；应用仍未被 git 跟踪。
- **目标运行（Task 1）：** 11 个 v1 spec 共 55 条 expected，`REPORT OK expected=55 flaky=0 unexpected=0`；N1 目标页标记用例仍按预期失败计为通过；13 个指定标题全部通过。
- **新用例（Task 2）：** 3 条 PLAN-05 用例加 3 条 SAFE-03，`REPORT OK expected=6 flaky=0 unexpected=0`。
- **loadAppPure 的用法（07-06 的单元用例用）：** `import { loadAppPure } from '../../support/app-source'`，`const { esc, normalize } = loadAppPure(['esc', 'normalize'])`。它读仓库根目录的应用文件，按 `const CATS=` 和 `/* ---------- saving ---------- */` 两个标记切出纯函数段，在 node:vm 里求值，只返回列出的绑定；返回的对象属于 vm 的 realm，比较前先做 JSON 往返；函数在自己的上下文里读写模块级状态（`usePlan` 之后 `allTasks()` 会变）；每次调用都重新求值。注意纯函数段里不能出现碰 DOM 的顶层语句；本计划把 `esc`、`normalize`、`allTasks` 都留在这一段里。

## Task Commits

1. **Task 1（tracer）：合成 DEFAULT_PLAN 经 plan 对象接到每个视图** - `4cfece7`（refactor；提交里只有 `tests/support/constants.ts`，应用文件被忽略）
2. **Task 2：冻结 id、旧备份映射、normalizePlan 的用例** - `d075f30`（test）

**Plan metadata:** 由下面的 docs 提交记录（本 SUMMARY 加 STATE、ROADMAP 更新）。

## Files Created/Modified

- `us-journey-tracker.html` - 计划常量区换成 CATS、三条 id 正则、DEFAULT_PLAN、normalizePlan、usePlan；其余引用点改读 plan（未被 git 跟踪）。
- `tests/support/constants.ts` - 新的 APP_SHA256 和说明（Phase 7 起应用可以改，但每次改应用都要在同一次提交里有意识地更新基线）。
- `tests/support/task-ids.ts` - 文件头改写为“内置 id 自 Phase 7 起冻结”；新增 `BUILTIN_GROUP_SIZES`、`ALL_LIFT_IDS`。
- `tests/support/app-source.ts` - 新建；`APP_PURE_START`、`APP_PURE_END`、`loadAppPure`。
- `tests/fixtures/legacy-positional-backup.json` - 新建；带 `_synthetic`，38 个 `P{n}-{i}` 进度键，(n+i) 为偶数的完成（日期在 2026-02），其余带 2026-04 内的截止日期。
- `tests/e2e/data/stable-ids.spec.ts` - 新建；两条 PLAN-05 页面用例。
- `tests/e2e/data/plan-normalize.spec.ts` - 新建；一条 PLAN-05 单元用例。

## Decisions Made

- 示例计划的文字从零写成，与原计划同形（7 组、任务数依次 5、12、7、4、4、5、1，只有 P2 带组说明，力量 id 依次 bench、squat、dead、pull）。文字不在此转抄。
- 本周健身目标用两个与原计划不同的整数，力量项的默认值和目标值用计划里给的通用整数；`--check` 的数值撞车为 0。
- `planTasks` 保持原来内置任务对象的形状，所以 allTasks、tstate、时间线、日历、编辑弹窗都不用改。

## Deviations from Plan

None - plan executed exactly as written.

补充说明（不算偏离）：
- 本会话的提交署名行按运行时要求是 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`，与计划里写的 Opus 署名不同，以运行时为准。
- 为定位行号我运行过一次带 `cut -c1-60` 的 grep，截断输出里带出了 `FIT_GOAL` 声明那一行（含原计划的两个每周健身数字）。这只出现在工具输出里，没有写进任何文件、提交或本 SUMMARY；示例的数字与它不同（`--check` 数值撞车为 0 已验证）。之后的行号定位都改用只打印行号的写法。
- 应用里按 id 形状判断自定义待办的正则位于模板字符串的 `${}` 表达式里，普通 `grep -F '/^P\d-\d+$/'` 能匹配到；用 node 按字面串替换，没有影响。

## Issues Encountered

None。第一次尝试用一条 heredoc 同时写两个 spec 时被 shell 解析错误打断（引号嵌套），没有写出任何文件，改用 Write 工具后正常。

## Known Stubs

无。DEFAULT_PLAN 是完整的合成计划，没有占位文字，也没有空数据流进界面。

## Threat Flags

无新增网络、认证或文件访问面。`app-source.ts` 在 Node 里求值应用源码的一段，只在测试进程里运行、只读仓库内文件，已在计划的威胁登记册（测试进程到应用源码）中覆盖。

## 假设与未覆盖

- `normalizePlan` 的拒绝分支本阶段没有页面入口（D-11，不加本地加载计划的入口），只有 `plan-normalize.spec.ts` 的单元用例证明；服务器计划进来后（Phase 9 起）由页面路径再覆盖。
- 本计划没有跑完整套件。目标运行之外的 v1 spec（日历、编辑弹窗、导入等）只有零引用门槛这道静态防线，由 07-03 末尾唯一一次完整套件（161 条）覆盖；“改了应用不更新基线时护栏失败”的反向对照也在 07-03。
- 示例文字是否“像样”（D-01）只能由人判断，放在 07-04 的人工检查点。
- 旧备份里引用了计划里不存在的 id 时怎么显示，本阶段计划固定不变，没有验证。
- 07-02、07-03 的中间提交带着新的 APP_SHA256，而应用要到 07-04 才进 git，所以单独克隆这些中间提交时 SAFE-02 会失败；这是计划里已知并接受的取舍。

## User Setup Required

None - no external service configuration required。

## Next Phase Readiness

- 07-03 可以在应用里加 `USJ_CONFIG` 配置缝，跑完整套件做 161 条验收，并做基线反向对照。
- 07-05、07-06 可以用 `loadAppPure` 写 normalize、esc 的单元用例。
- plan 对象的形状已固定，Phase 8 的假服务器、Phase 9 的云端计划文档、Phase 12 的编辑页都会继承它。
- 没有阻塞项。

## Self-Check: PASSED

- `tests/support/app-source.ts`、`tests/fixtures/legacy-positional-backup.json`、`tests/e2e/data/stable-ids.spec.ts`、`tests/e2e/data/plan-normalize.spec.ts` 存在；应用文件存在且未被跟踪。
- 提交 `4cfece7`、`d075f30` 都在 HEAD 的祖先链上；`git rev-list --count` 得到 2。
- 两个任务的 verify 命令全部重跑通过：`--check` 为 CHECK OK；零引用门槛通过；应用 sha256 等于 APP_SHA256 且不等于 v1 基线；私有原件哈希仍是 v1 基线；11 个 spec 的目标运行 REPORT OK（expected=55）；2 个新 spec 加仓库卫生 spec REPORT OK（expected=6）。
- 本 SUMMARY 和提交说明里没有原计划的文字或个人数字。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
