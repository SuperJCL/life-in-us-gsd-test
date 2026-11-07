---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 06
subsystem: entry-validation
tags: [sec-01, plan-05, import-whitelist, load-repair, normalize, orphan-progress-keys]

requires:
  - phase: 07-02
    provides: "DEFAULT_PLAN、normalizePlan、usePlan、planIds（脚本求值时由 usePlan(DEFAULT_PLAN) 设好）"
  - phase: 07-05
    provides: "渲染转义（esc 全覆盖）、BYPASS_NORMALIZE 变体靠 `function normalize(s){` 定位、源码门槛"
provides:
  - "LOG_ID_RE、CUSTOM_ID_RE、TASK_KEY_RE、DATE_RE、isObj：导入白名单的格式"
  - "importProblem(raw)：导入时在 normalize 之前检查，任何一项 id 或日期不合格就整份拒绝（走同一条格式错误 toast，不弹确认框）"
  - "深度修正的 normalize：坏 id 换新 id 并迁移进度键、坏日期回落、孤儿进度键丢弃、记录文字一条不删、加载不保存"
  - "tests/e2e/security/state-validation.spec.ts（三条 Node 侧单元用例）和 id-whitelist.spec.ts（两条页面用例）"
affects: [07-07, phase-09, phase-11]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: 7113d62b9131add1fb2c14f496de119a5f4c3468
plan_head_after: 6af38c95b2fe21575a98779610151a7c11566add

tech-stack:
  added: []
  patterns:
    - "入口防线两道：导入时整份拒绝（importProblem），加载时只修正不拒绝（normalize）"
    - "容器里能识别出条目就检查，不因容器类型不对而放行；只有两条点名豁免"
    - "进度键只在对应到当前计划任务（planIds）或修正后的自定义待办时保留，其余丢弃"

key-files:
  created:
    - tests/e2e/security/state-validation.spec.ts
    - tests/e2e/security/id-whitelist.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts

key-decisions:
  - "导入整份拒绝、加载修正，两道防线不互相替代；07-05 的渲染转义一处未减"
  - "孤儿进度键按原文丢弃（所有者已确认）：格式合格但找不到任务的键（P9-9、t-synth）在加载和导入时都被丢弃"
  - "白名单只剩两条豁免：顶层不是普通对象（null、[]），以及非字符串的 arrival"
  - "类别判断改用 hasOwnProperty，避免 cat 为 constructor 之类原型键时被当成合法类别"

requirements-completed: [SEC-01, PLAN-05, TEST-01]

coverage:
  - id: D1
    description: "导入的备份里只要有一项 id 或日期不合格就整份拒绝：格式错误 toast，没有确认框，没有保存，数据不变"
    requirement: SEC-01
    verification:
      - kind: e2e
        ref: "tests/e2e/security/id-whitelist.spec.ts#SEC-01 importing a backup with a malformed id or date is rejected as a whole and changes nothing"
        status: pass
      - kind: unit
        ref: "tests/e2e/security/state-validation.spec.ts#SEC-01 the import check rejects any malformed id or date and accepts well-formed, empty and type-mismatched backups"
        status: pass
    human_judgment: false
  - id: D2
    description: "点名的 5 个 v1 畸形导入输入保持 v1 结果；N3、B2 标记照旧是预期失败"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "tests/e2e/io/known-bugs.spec.ts（N3、B2 对照和标记）与 tests/e2e/io/import.spec.ts#IO-04 files that are not a backup show the format error, ask nothing and save nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "加载时自动修正：坏 id、坏日期、坏数值被修正，带文字的记录一条不删，孤儿进度键丢弃，加载不触发保存"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "tests/e2e/security/state-validation.spec.ts#SEC-01 stored data with malformed ids, dates and values is repaired on load without losing any log text"
        status: pass
      - kind: e2e
        ref: "tests/e2e/security/id-whitelist.spec.ts#SEC-01 loading stored data with malformed ids keeps every log text and saves only compliant ids"
        status: pass
    human_judgment: false
  - id: D4
    description: "g-、t-、l- 前缀的新 id 能通过导入白名单；t- 进度键只在当前计划有对应任务时保留"
    requirement: PLAN-05
    verification:
      - kind: unit
        ref: "tests/e2e/security/state-validation.spec.ts#PLAN-05 backups with g-, t- and l- prefixed ids pass the import check and survive normalize"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 06: 导入白名单与加载修正（入口防线）Summary

**导入的备份先过 id 和日期白名单，不合格整份拒绝；启动时读到的已存数据自动修正（坏 id 换新 id 并迁移进度、坏日期回落、孤儿进度键丢弃），带文字的记录一条不删、加载不写存储；点名的 5 个 v1 畸形导入输入结果不变。**

## Accomplishments

- **importProblem 的规则（纯函数段，在 normalize 之前检查）：**
  - logs、custom：数组逐项检查；普通对象则把每个值当条目检查。logs 条目必须是对象，id 匹配 `LOG_ID_RE`、date 匹配 `DATE_RE`；custom 条目 id 匹配 `CUSTOM_ID_RE`、group 匹配 `GROUP_ID_RE`。
  - tasks：键匹配 `TASK_KEY_RE`（`P<n>-<i>`、`t-`、`c-`），值是普通对象，due、doneDate 存在时必须是空串或合格日期。
  - lifts：键匹配 `LIFT_ID_RE`，值是普通对象，hist 每项日期合格。reviews：键匹配 `DATE_RE`。arrival：非空字符串时必须合格。
  - 按键存的容器（tasks、lifts、reviews）含数组：非空数组的键 0、1…不合格，被拒绝；空数组通过。
  - 原始值形式的容器（字符串、数字）里识别不出条目，不检查，v1 的 normalize 会把它们换成空值，不会有坏 id 进入 state（单元用例断言结果的 JSON 里没有 `bad-log-id`、`bad-task-key`）。
- **导入处理：** `JSON.parse` → `importProblem`（非 null 时抛错，走原来的 catch 和同一条格式错误 toast，不弹确认框）→ `normalize` → 确认 → 替换。确认、替换、persist、清空文件框的位置都没动（B2 现状保持）。
- **normalize 的深度修正规则（D-08）：**
  - arrival：空串或合格日期保留，否则空串。
  - logs：id 不合格换 `uid()`，date 不合格换 `today()`，text 数字或布尔转字符串、缺失变空串、对象 `JSON.stringify`；cat 沿用 LEGACY 和 CK，不是字符串或不在类别里归为“其他”。字符串或有限数字形式的条目、数组形式且项里有文字的条目都变成一条“其他”记录（数组的 text 是 JSON 字符串）。**丢弃的只有不带任何用户文字的条目：null、undefined、布尔、非有限数字、项里没有字符串或有限数字的数组。** 任何对象条目都保留。
  - custom：id 不合格换 `"c-"+uid()` 并记下旧 → 新映射；group 不合格换成计划里第一个“其他”类别的组（DEFAULT_PLAN 里是 P7）；条目形式和丢弃范围同 logs。
  - tasks：先用映射迁移键，再只保留 `planIds.has(键)` 或修正后待办 id 集合里的键，其余一律丢弃；值不是对象的丢弃；done 转布尔，due、doneDate 不合格变空串。
  - lifts：键不合格或值不是对象的丢弃；cur 不是有限数就删掉；hist 只留日期合格、v 是有限数的项。reviews：字符串保留、有限数字转字符串、其余连键丢弃。presets：值不是对象的丢弃，add、hide 只留字符串。
  - 对合格数据是恒等的、重复执行结果不变；加载本身不调用 persist（页面用例断言启动后 `backend.writes` 为空）。
- **点名清单的 5 个 v1 输入，导入结果与 v1 相同：**
  - `synth-empty-object.json`（`{}`，N3）：importProblem 返回 null，走到确认框；N3 对照通过，N3 标记照旧预期失败。
  - `synth-b2-import.json`（`{ logs: [] }`，B2）：容器类型正确但没有条目，走到确认框；B2 对照、reset path 通过，B2 标记照旧预期失败。
  - `synth-null.json`（`null`）：importProblem 返回 null，v1 的 normalize 照旧抛错，显示格式错误（IO-04“不是备份”用例通过）。
  - `synth-array.json`（`[]`）：返回 null，走到确认框（与 N3 同类，没有 v1 用例断言导入结果）。
  - `synth-wrong-types.json`（logs 字符串、tasks 数字、custom 空对象、arrival 数字）：返回 null，走到确认框；normalize 把 logs、tasks、arrival 换成空值。
  - 白名单只剩两条豁免：顶层不是普通对象的输入（`null`、`[]`）和非字符串的 arrival（只为 synth-wrong-types.json）。其余只要容器里能识别出条目就检查。这两条不是一般豁免，行为改变推迟到 Phase 11 的 IO-07。
- **清单之外有没有 v1 导入用例与整份拒绝冲突：没有。** import.spec.ts 的合成备份、IO-04 往返、IO-05 旧类别备份、export.spec.ts 全部照旧通过。
- **D-08 孤儿进度键（所有者已确认按原文丢弃）：** 单元用例和页面用例里，`P9-9`、`t-synth`、带引号的键和坏 id 的旧键在结果里都不存在；内置任务 `P1-1`、现有自定义待办（`c-synth-ok`）的进度保留；坏 id 待办的进度搬到新 id 下保留。PLAN-05 用例：先 usePlan 换上带 g-、t-、l- 前缀的合成计划，前缀键经 normalize 原样保留；换回 DEFAULT_PLAN 后 `t-synth1` 被丢弃，g- 组和 l- 力量键仍保留。
- **新 APP_SHA256：** `d10dbe72fe168efb558282605dfa658aa0c48520d05950a25563fa036f791a86`（Task 1 提交里先更新为 `6e4e7663…`，Task 2 提交里更新为此值），与应用 sha256 一致；`extract-plan.mjs --check` 仍为 CHECK OK；`function normalize(s){` 仍恰好一处。
- **两次目标运行（低优先级、单 worker、PW_JSON_REPORT）：**
  - Task 1：18 条，`REPORT OK expected=18 flaky=0 unexpected=0`（含 N3、B2 各两条标记和对照、IO-04、IO-05、export 全部）。
  - Task 2：27 条（security 全部、account-mode、synthetic-data、import），`REPORT OK expected=27 flaky=0 unexpected=0`，没有 flaky。
  - 本计划不跑完整套件（07-07 跑）；套件现在比 07-05 的 167 条多 5 条新用例。

## Task Commits

1. **Task 1（tracer）：导入白名单、整份拒绝、单元用例和页面用例** - `586241f`（feat）
2. **Task 2：加载时的深度修正、前缀 id 用例、加载修正的页面用例** - `6af38c9`（feat）

**Plan metadata:** 见下方 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）。

## Files Created/Modified

- `us-journey-tracker.html` - 四条白名单正则、`isObj`、`importProblem`、深度修正的 `normalize`、导入处理先查后 normalize
- `tests/support/constants.ts` - 新的 APP_SHA256
- `tests/e2e/security/state-validation.spec.ts`（新）- 三条 Node 侧单元用例（导入检查、加载修正、前缀 id）
- `tests/e2e/security/id-whitelist.spec.ts`（新）- 两条页面用例（导入整份拒绝、加载修正）和本文件内的哨兵 helper

## Decisions Made

- 提交署名用本会话运行时给出的 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`（计划文字里是 Opus 5.5 的示例，按“你的运行时要求的署名行”处理）。
- 加载修正里 `{...条目}` 复制而不是原地改输入；按键存的容器一律用 `Object.fromEntries` 构造，键为 `__proto__` 之类时不会改写原型。
- 在 tasks、lifts、reviews、presets 上，数组一律视为“不是对象”变成空对象（导入时非空数组已被 importProblem 拒绝，这里只影响加载路径）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 计划描述有误] minimal-state.json 的“恒等”断言**
- **Found during:** Task 2 单元用例首次运行
- **Issue:** 计划写“normalize 对 full-state.json、local-seed.json、minimal-state.json、legacy-positional-backup.json 的结果与去掉 _synthetic 的原文深度相等”，但 minimal-state.json 去掉 `_synthetic` 后是 `{}`，normalize（v1 也一样）会补齐七个顶层键的默认值，所以不会与 `{}` 深度相等。
- **Fix:** 用例改为与“原文叠在七键默认值上”深度相等（其余三个 fixture 本来就带齐七个键，等价于原文）。应用行为与 v1 一致，没有改。
- **Files modified:** tests/e2e/security/state-validation.spec.ts
- **Commit:** 6af38c9

**2. [Rule 2 - 正确性] 类别判断改用 hasOwnProperty**
- **Found during:** Task 2 写 normalize
- **Issue:** v1 的 `LEGACY[l.cat]`、`CK[l.cat]` 在 cat 是 `constructor`、`toString` 这类原型键时会取到函数，当作合法类别。
- **Fix:** 要求 cat 是字符串并用 hasOwnProperty 判断；合法类别名、旧类别名的结果与 v1 相同。
- **Commit:** 6af38c9

否则 None - 计划按原文执行。

## Issues Encountered

- 第一次用 heredoc 把单元用例追加到 spec 时 shell 报语法错误，文件未被改动；改为先把片段写到临时目录再追加。不影响提交内容。

## 给 Phase 9 的推迟说明

计划和状态分开加载之后，孤儿进度键的修正（`planIds.has(...)` 这一步）只能在账户的计划已知之后运行，绝不能对着尚未加载的计划（或回落用的 DEFAULT_PLAN）运行，否则会把真实进度当成孤儿丢掉。本阶段计划在脚本求值时由 `usePlan(DEFAULT_PLAN)` 设好，早于 init 的加载和任何导入，所以这条在 Phase 7 成立；Phase 9 引入服务器计划时要先 `usePlan` 再 `normalize`。

另外两个已知边界，同样留给后续阶段：
- 自定义待办的 group 只检查格式（`P<n>` 或 `g-`），不检查当前计划里有没有这个组；换了计划之后，指向已不存在的 g- 组的待办会怎么显示，要在 Phase 9、12 里确认。
- 坏记录日期回落为今天，会让那条记录出现在今天；记录 id 重复的情况不处理。

## Known Stubs

None - 没有占位或空数据流入界面。

## Threat Flags

None - 没有新的网络端点、认证路径或信任边界上的结构改动；本计划关闭的是 T-07-17（导入坏 id 或日期）、T-07-18（加载整份拒绝导致丢数据）、T-07-19（豁免过宽或改变 v1 结果）、T-07-20（孤儿修正对着未加载的计划）。

## Next Phase Readiness

- 07-07（完整套件、两道防线合在一起的真实应用用例、tests/README.md 说明）可以继续；渲染防线和入口防线各自独立成立。
- 之后若再改应用，仍要在同一次提交里更新 APP_SHA256，并保持 `extract-plan.mjs --check` 为 CHECK OK。
- 未推送，等待所有者确认。

## Self-Check: PASSED

- `tests/e2e/security/state-validation.spec.ts`、`tests/e2e/security/id-whitelist.spec.ts` 存在；提交 `586241f`、`6af38c9` 是 HEAD 的祖先；应用 sha256 等于 APP_SHA256；两次目标运行均 REPORT OK；`private/` 没有被暂存。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
