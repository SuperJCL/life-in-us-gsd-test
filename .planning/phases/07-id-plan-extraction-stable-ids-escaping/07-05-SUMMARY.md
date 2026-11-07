---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 05
subsystem: render-escaping
tags: [sec-01, xss, esc, in-memory-variant, detector-reverse-check, source-gate]

requires:
  - phase: 07-02
    provides: "DEFAULT_PLAN、normalizePlan、usePlan 的声明顺序，extract-plan.mjs --check"
  - phase: 07-04
    provides: "应用被 git 跟踪，APP_SHA256 随应用改动同次提交更新"
provides:
  - "全部插进 innerHTML 和属性的状态值与计划值都经过 esc()（含力量历史的 x.v 逐项转义）"
  - "tests/support/app-variant.ts：serveAppVariant、BYPASS_NORMALIZE、DISABLE_ESCAPING、planValueEdit，只在内存里改应用"
  - "tests/fixtures/malicious-state.ts：合成载荷、maliciousState()、maliciousPlanValues()、IMG_PAYLOAD"
  - "tests/e2e/security/escaping.spec.ts：四条 SEC-01 用例（绕过入口检查、计划值、检测器反向对照、源码门槛）"
  - "完整套件 167 条 expected、0 flaky、0 unexpected"
affects: [07-06, 07-07, phase-09]

actuals:
  tokens: 9900
  tasks: 2
  commits: 2
plan_head_before: 78e57134955bed6dc615dc556dd7f1df93013427
plan_head_after: 844a45c3dddc2df6385855319c41893fa840f5f5

tech-stack:
  added: []
  patterns:
    - "内存变体：读应用文件、替换恰好出现一次的标记、page.route 只给一个 page，磁盘和静态服务器不变"
    - "渲染防线和入口防线分别证明：绕过 normalize 的变体看渲染，关掉 esc 的变体看检测器"
    - "源码门槛带对照：把 ${esc(X)} 改回 ${X} 后门槛必须报出匹配"

key-files:
  created:
    - tests/support/app-variant.ts
    - tests/fixtures/malicious-state.ts
    - tests/e2e/security/escaping.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts

key-decisions:
  - "转义只在渲染时做，恶意字符串原样保存、原样显示（不删、不截断用户文字）"
  - "saveLift 的两条 toast 改字符串拼接：toast 写 textContent，转义会把实体字符显示出来"
  - "力量历史：在拼 h 的模板里逐项 esc(x.v)，显示处去掉对整串的转义，避免二次转义"
  - "不包 esc 的只有应用自己算出的数字、md()/WD 的输出、应用算的日期、kOf 的类名、比较结果、已转义的嵌套片段、composer 实例号 p、只进 querySelector 的组号和力量 id"

requirements-completed: [SEC-01]

coverage:
  - id: D1
    description: "绕过入口检查时，恶意数据（id、日期、group、力量当前值、力量历史数值、记录文字）在四个视图和两个编辑弹窗里只是文字，没有脚本、没有多出元素"
    requirement: SEC-01
    verification:
      - kind: e2e
        ref: "tests/e2e/security/escaping.spec.ts#SEC-01 with the entry checks bypassed every renderer still escapes ids, dates and values"
        status: pass
    human_judgment: false
  - id: D2
    description: "计划值（组名、组说明、内置任务文字、力量名称和备注、基础预设、力量组说明）的载荷在四个视图、composer 和两个编辑弹窗里只是文字"
    requirement: SEC-01
    verification:
      - kind: e2e
        ref: "tests/e2e/security/escaping.spec.ts#SEC-01 malicious text in plan group names, task names, lift fields and base presets renders as plain text in the four views, the composer and both editors"
        status: pass
    human_judgment: false
  - id: D3
    description: "检测器不是空转：关掉转义的变体上同样的数据被检测到"
    requirement: SEC-01
    verification:
      - kind: e2e
        ref: "tests/e2e/security/escaping.spec.ts#SEC-01 the injection detector reports elements injected by a variant without escaping"
        status: pass
    human_judgment: false
  - id: D4
    description: "源码里对上述字段的裸插值从基线 47 处降到 0 处，门槛带去掉 esc 的对照"
    requirement: SEC-01
    verification:
      - kind: e2e
        ref: "tests/e2e/security/escaping.spec.ts#SEC-01 no state or plan value is interpolated into the app markup without esc"
        status: pass
    human_judgment: false
  - id: D5
    description: "转义不改变正常数据的渲染：v1 的视图、编辑、导入用例照旧通过，完整套件 167 条 0 flaky"
    requirement: TEST-01
    verification:
      - kind: command
        ref: "npm test --workers=1 全量 + check-report.mjs --min-expected 167 -> REPORT OK expected=167 flaky=0 unexpected=0"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 05: 全部插值转义（渲染防线）Summary

**应用里每一个进 innerHTML 和属性的状态值与计划值都按纯文本显示（47 处裸插值降到 0），并用只在内存里改应用的变体证明：绕过入口检查、计划值带载荷时四个视图、composer 和两个编辑弹窗都没有脚本、没有多出元素，检测器有反向对照。**

## Performance

- **Duration:** 约 12 分钟（2026-11-07T18:43Z 到 18:55Z）
- **Tasks:** 2（Task 1 tracer、Task 2 auto/tdd）
- **Files modified:** 5（两次代码提交，一个应用文件加四个测试文件）

## Accomplishments

- **基线与结果：** 门槛的同一组正则在改动前数出 **47 处**裸插值（不少于 40；其中 3 处在 saveLift 的 toast 里），改动后 **0 处**。分项（改动前）：`l.id` 4、`x.id` 4、`t.id` 2、`t.group` 3、`s.cur` 2、`g.id` 4、`g.name` 1、`g.note` 1、`L.n` 3、`L.target` 1、`L.unit` 3、`L.id` 4、`plan.fitGoal[0]` 1、`[1]` 1、`mm.slice(0,4)` 1、`s.due||""` 1、`s.doneDate||today()` 1、`form.dataset.kdate||l.date` 1、`c.n` 4、`C.n` 1、`o` 2、`x.v` 1、`:L.note}` 1。
- **清单之外是否又发现插值点：没有。** 改完后把应用里所有不以 `esc(` 开头的 `${…}` 逐个列出复查，剩下的都属于计划列出的可以不转义的类别（数字、`md()`/`WD`、应用算出的日期、`k-` 类名、比较结果、已转义的嵌套片段、实例号 `p`、只进 querySelector 的 `lf` 和 `g`）。
- **力量历史：** `h` 在拼接处逐项 `esc(x.v)`，显示处由 `esc(h)` 改成直接拼 `h`（`esc(h)` 不再出现）；`:L.note` 一支改为 `esc(L.note)`。saveLift 的两条 toast 用字符串拼接，文字逐字不变。
- **新 APP_SHA256：** `7a76dd34090d603024a0f4e1925606c98b8989401458dd2781eedc8b650cb745`，与应用的 sha256 一致，在同一次提交（`fcfabe3`）里更新；`extract-plan.mjs --check` 仍为 CHECK OK。
- **绕过入口检查的用例：** 恶意状态（id、日期、group、力量当前值、力量历史、记录文字、任务名、预设）在本周、日历、目标、时间线和两个编辑弹窗里 readInjection 全部干净（flag 0、marked 0、foreign 0、handlers 0、scripts 1）；读回结果全为真：本周记录文字等于标签载荷、`dataset.edit` 等于 id 载荷、`dataset.task` 等于 c- 载荷、`#lf-bench` 的 value 属性等于当前值载荷、`c-synth-1` 截止日期框的 value 属性等于日期载荷、日面板组号标签文字等于 group 载荷、力量历史行含 `<s>9` 原文、两个弹窗的 `#ed-date` value 属性等于日期载荷。
- **计划值用例（只写字段路径和布尔）：** `groups[0].name` 目标视图真；`groups[1].note` 目标视图真；`groups[0].tasks[0].text` 本周、日面板、目标、时间线、完成计划弹窗全真；`lifts[0].n` 目标视图真；`lifts[0].note` 目标视图真（bench 已从种子删掉，无历史时才显示备注）；`presets.lang[0]` composer 预设标签文字包含载荷、`data-preset` 在第一个 `|` 之后等于载荷，均真；`fitNote` 目标视图真。四个视图、composer、两个编辑弹窗的 readInjection 全部干净。
- **planValueEdit 依赖的声明顺序：已核对。** 应用里的顺序是 `DEFAULT_PLAN`、`normalizePlan`、`usePlan`、`usePlan(DEFAULT_PLAN);`，所以插在 `function normalizePlan(` 之前的赋值语句在第一次 usePlan 之前执行，标记恰好出现一次。额外做过一次一次性探针（临时 spec，已删除）：计划值载荷加关掉转义时，目标视图检测到 marked=6、foreign=8，证明这七个字段真的进到了页面。
- **反向对照：** 在同时绕过 normalize 和关掉转义的变体上，本周视图检测到 `flag=6 marked=29 foreign=49 handlers=6 scripts=5`（写进了用例注解）；details 的 toggle 是否触发不作断言。没有换过载荷，没有载荷引发页面错误。
- **完整套件：** 167 条 expected、0 flaky、0 unexpected（`REPORT OK expected=167 flaky=0 unexpected=0`，`--min-expected 167`），四条 SEC-01、SAFE-02 和 8 条已知 bug 标记用例都实际运行；本计划只跑了这一次完整套件。保护路径的对象哈希核对（playwright.config.ts、test.ts、app.ts、tests/mocks、package-lock.json、check-report.mjs）全部不变，`git ls-files private` 为空。

## Task Commits

1. **Task 1（tracer）：全部插值转义 + 内存变体 + 恶意状态 + 第一条 SEC-01 用例** - `fcfabe3`（fix）
2. **Task 2：计划值用例、检测器反向对照、源码门槛** - `844a45c`（test）

**Plan metadata:** 见下方 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）。

## Files Created/Modified

- `us-journey-tracker.html` - 全部插值包 `esc()`；saveLift 的 toast 改字符串拼接
- `tests/support/constants.ts` - 新的 APP_SHA256
- `tests/support/app-variant.ts`（新）- `AppEdit`、`BYPASS_NORMALIZE`、`DISABLE_ESCAPING`、`planValueEdit`、`serveAppVariant`
- `tests/fixtures/malicious-state.ts`（新）- 载荷常量（含 `IMG_PAYLOAD`）、`maliciousState()`、`maliciousPlanValues()`
- `tests/e2e/security/escaping.spec.ts`（新）- `readInjection`、四条 SEC-01 用例

## Decisions Made

- 转义只在渲染时做；恶意字符串原样保存、原样显示，没有用删除或截断用户文字的办法。
- 变体只在内存里经 page.route 提供；标记必须恰好出现一次，否则用例失败；磁盘上的应用文件不变，SAFE-02 照旧通过。
- 提交署名用本会话运行时给出的 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`（计划文字里写的是 Opus 5.5 的示例，按计划“你的运行时要求的署名行”处理）。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Task 2 提交前，我跑了一次临时探针 spec（没带 `PW_JSON_REPORT`），Playwright 清空了 `test-results/`，把刚生成的 `07-05-t2.json` 删掉了，于是 `check-report.mjs` 报 `cannot read report: ENOENT`；那一行的命令后面是分号，所以提交照常发生了。**不是测试失败**：随后按计划的低优先级命令重跑了 escaping spec，`REPORT OK expected=4 flaky=0 unexpected=0`，再跑完整套件确认。临时探针文件已删除，提交里没有它。

## Known Stubs

None - 没有占位或空数据流入界面。

## Threat Flags

None - 没有新的网络端点、认证路径或信任边界上的结构改动；本计划关闭的是 T-07-14（渲染裸插值）、T-07-15（变体不落盘）、T-07-16（检测器空转）。

## Next Phase Readiness

- 07-06（入口白名单）和 07-07（两道防线合在一起的真实应用用例）可以继续；渲染防线已单独成立，不依赖入口检查。
- 07-06 之后若再改应用，仍要在同一次提交里更新 APP_SHA256；若新增了进 innerHTML 或属性的插值点，需要同步加进源码门槛的 `BARE_TOKENS`。
- 未推送，等待所有者确认。

## Self-Check: PASSED

- `tests/support/app-variant.ts`、`tests/fixtures/malicious-state.ts`、`tests/e2e/security/escaping.spec.ts` 存在；提交 `fcfabe3`、`844a45c` 是 HEAD 的祖先；应用 sha256 等于 APP_SHA256；完整套件 REPORT OK expected=167；保护路径对象哈希不变；`git ls-files private` 为空。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
