---
phase: 04-calendar-goals
verified: 2026-11-04T02:39:06Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/04-calendar-goals/04-01-PLAN.md"
  - ".planning/phases/04-calendar-goals/04-01-SUMMARY.md"
  - ".planning/phases/04-calendar-goals/04-02-PLAN.md"
  - ".planning/phases/04-calendar-goals/04-02-SUMMARY.md"
  - ".planning/phases/04-calendar-goals/04-03-PLAN.md"
  - ".planning/phases/04-calendar-goals/04-03-SUMMARY.md"
  - "tests/KNOWN-BUGS.md"
  - "tests/README.md"
  - "tests/e2e/calendar/day-panel.spec.ts"
  - "tests/e2e/calendar/grid.spec.ts"
  - "tests/e2e/calendar/known-bugs.spec.ts"
  - "tests/e2e/calendar/navigation.spec.ts"
  - "tests/e2e/goals/known-bugs.spec.ts"
  - "tests/e2e/goals/lifts.spec.ts"
  - "tests/e2e/goals/overview.spec.ts"
  - "tests/e2e/goals/tasks.spec.ts"
  - "tests/support/calendar.ts"
  - "tests/support/expect-from-fixture.ts"
  - "tests/support/goals.ts"
  - "tests/support/strings.ts"
  - "tests/support/toast.ts"
  - "tools/test-report/check-report.mjs"
covered_digest: "v4:sha256:f4df22b238f45b2400a4038c9dfcbea786c51e52d39ba829e8a4aff342a323ad"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
human_verification:
  - test: "确认判断型禁止项 P-1（CAL-01 期望值独立）：calendar 与 goals 的期望值只来自 expect-from-fixture.ts 的独立推导和 fixture，没有从应用源码或运行中的应用取期望"
    expected: "验证者的非权威判断：成立。证据：expect-from-fixture.ts 不导入也不读取应用文件（grep us-journey-tracker、readFileSync 均无命中）；推导逐条对照应用的 eventsOn、renderCal、renderDay 的行为，规则一致；35 和 42 格另有 Date.UTC 脚本路标"
    why_human: "ADR-550 D3/D4：judgment 档禁止项在交互模式下需要人工逐项确认，验证者只能给出非权威的 LLM 判断"
  - test: "确认判断型禁止项 P-2（CAL-03、GOAL-01、GOAL-02、GOAL-03 的隐私）：个人计划文字（到期和完成 chip、日面板计划条目、内置任务原文、组名与组说明、力量名称、目标数值、单位、备注）没有出现在断言、失败消息、注解、SUMMARY、提交信息里，也没有写死达标阈值"
    expected: "验证者的非权威判断：成立。证据：privacy-check --all 退出 0（140 个文件，65 个个人计划词条）；helper 只读 id、组号、数量、数值和布尔；用 grep 确认没有内置任务选择器、力量名称或历史行选择器、没有可见性断言、没有 .check()；对 tasks.spec.ts 做了一次临时变异、强制五类失败，终端输出里 4 个汉字以上的片段全部来自 tests/ 或应用的固定界面文案（见下面“失败输出脱敏”）；极大值和很小值只是常量，没有目标数值"
    why_human: "同上。另外 Playwright 失败时写入 test-results/ 的截图、trace 和 error-context.md 会含页面全文，它们是本地且被 git 忽略的证据（Phase 1 的 D-02 决定），不属于终端输出，请确认你接受这一点"
  - test: "确认判断型禁止项 P-3（CAL-04、GOAL-02、GOAL-05 的安全）：没有为了让用例通过而修改 us-journey-tracker.html 或 tests/fixtures/full-state.json；特殊数据只在用例内存里构造；已知 bug 只在测试侧标记和登记；N1 的拖拽和改抵达日期两种触发没有写用例"
    expected: "验证者的非权威判断：成立。证据：git log 在 Phase 4 范围内对 tests/fixtures、应用文件、package.json、package-lock.json、playwright.config.ts、tests/support/app.ts 没有任何提交；应用 sha256 与基线一致且 git ls-files 为空；chip 顺序用例的变体在用例内存里构造；KNOWN-BUGS.md 的 N1 行仍写明拖拽、改抵达日期未验证"
    why_human: "同上"
  - test: "确认判断型禁止项 P-4（GOAL-03 透明）：没有亲眼复现的 N1 触发不会被标成已知 bug"
    expected: "验证者的非权威判断：成立，并且已由我亲自复现。我临时去掉了三处 knownBug 调用（日历 B1、日面板删除 N1、目标页勾选 N1），单次运行、retries=0：三条对照用例都通过，三条标记用例都失败在 toHaveValue 的草稿断言，期望是合成草稿，实际值是空字符串。运行后用 git checkout 恢复，工作区干净"
    why_human: "同上"
human_confirmed: "2026-11-03 用户确认 P-1..P-4 全部成立"
---

# Phase 4: 日历与目标视图 验证报告

**Phase Goal:** 开发者能自动验证日历和目标两个视图的渲染与交互，直接复用 Phase 3 的记一笔、编辑弹窗和 toast helper。
**Verified:** 2026-11-04
**Status:** human_needed
**Re-verification:** 否，首次验证

本阶段是测试脚手架阶段，交付物是 helper、spec、报告检查脚本和约定文档，不是应用功能。所以“必须为真”指 ROADMAP 的 5 条成功标准：每条都要有真实的 helper 和 spec 代码，用例确实断言了那条行为，并且运行结果可信。验证以读代码加一次完整报告核对为主，不采信 SUMMARY 的描述。

**结论先说：** 5 条成功标准、9 项需求、所有计划里的 must_haves 都被代码和运行结果证实，没有缺口，没有 BLOCKER。状态是 `human_needed` 只有一个原因：三份计划里有 9 条 `verification: judgment` 的禁止项，交互模式下规则要求人工逐项确认（不能静默通过）。我把它们合并成 4 条给出非权威判断和证据，我的判断全部是“成立”。你确认后即可进入下一阶段。

## Goal Achievement

### Observable Truths

| # | Truth（ROADMAP 成功标准） | Status | Evidence |
|---|---|---|---|
| 1 | 月历网格：周日起始、今天高亮、抵达日标记、记录 chips 和 “+N” 都正确；切换月份、回到今天、点格子选中日期都有用例，点相邻月份的格子会跳到那个月 | ✓ VERIFIED | `grid.spec.ts` 五条：3 月整月（标题、7 个表头、35 格，逐格比较 out/today/sel/arr 类、aria-label、日号、前 3 个 chip 种类、+N）、chip 顺序（记录、到期、完成，用例内存变体）、5 月 42 格、2 月 35 格且末行 7 格全是 out、抵达日只在 1 月带 arr。`navigation.spec.ts` 三条：跨年 2025 年 12 月与 2026 年 1 月且选中日不变、今天按钮、点格子加点 4 月 2 日和 3 月 31 日跳月。期望全部由 `expect-from-fixture.ts` 的 `monthGrid`、`eventsOnDate`、`expectedMonthCells` 推导，我逐条对照了应用的 `eventsOn`、`renderCal` 行为（周日起点、第 36 格不在当月就停、已完成的计划只在完成日出现），一致。35 和 42 另有写死的路标断言，D-01 的 Date.UTC 脚本在计划里记录为 `35,42,35`。报告里 8 条全部 passed |
| 2 | 日面板显示当天的记录、完成的计划和到期任务；在日面板记一笔后记录出现在当天并被保存；删除记录后可通过 toast 撤销，点删除按钮不会误开编辑弹窗 | ✓ VERIFIED | `day-panel.spec.ts`：`readDayPanel` 一次读回标题、副标题、记录到、分区、记录 id、空提示、完成计划 id、到期组号，与 `expectedDayPanel` 比较，覆盖今天、空白日、只有计划的日、抵达前、抵达当天。记一笔复用 Phase 3 的 `composer(page, 'c')`，断言保存里新记录的日期、类别，日面板和网格按保存后状态推导，文本框清空。删除加撤销在 manual 时钟下：`dialog#editor` 无 open 属性、选中日不变、toast 为已删除并带撤销、撤销后 id 顺序与 fixture 完全相同。toast 过期用例在 1900、4900 ms 仍带撤销按钮，5100 ms 消失（WR-01 修复后钉住 5 秒边界），`#toast.act button` 为 0，过期后写入次数不变。报告里 5 条全部 passed |
| 3 | 目标视图渲染力量卡片和 P1–P7 目标组，完成计数与进度条与 fixture 推导一致；更新力量值（点保存按钮或按 Enter）后显示最近的历史和达标提示 | ✓ VERIFIED | `overview.spec.ts`：七个组的 code 序列等于 `GROUP_CATEGORY` 的键，每组 cnt、进度条数值、任务 id 序列（内置位置 id 连续、自定义在后）、已完成行、已过期行、日期框、删除按钮整体 toEqual `expectedGroup`，并有防空转断言；恰好 4 张力量卡，逐张不变量（保存按钮隐藏、输入值等于当前值、进度条 0 到 100），两张有 fixture 状态的卡比较值和历史行。`lifts.spec.ts`：保存按钮随值出现和隐藏、点保存、Enter 保存（cur 更新、历史追加冻结的今天、历史行显示最近 3 条且用全角逗号连接）、极大值触发 toast 后缀“达标了”且进度条正好 100%、很小值走“已更新为”分支且进度条在 0 到 100 之间。toast 只经 `expectToastSuffix`、`expectToastContains` 比较片段。报告里 7 条全部 passed |
| 4 | 勾选任务时完成日期记为冻结的今天，进度随之更新，取消勾选后恢复；设置截止日期后过期的任务显示“已过期” | ✓ VERIFIED | `tasks.spec.ts`：勾选内置已过期任务后 toast 为完成，保存的 `done=true`、`doneDate=冻结的今天`、`due` 保持原值，行带 isdone、日期框消失、显示“完成于 M月D日”，七个组和日历整月格子都等于由保存后状态推导的期望；取消勾选后 `done=false`、`doneDate=''`、`due` 保留，重新显示已过期，组和日历同步；改内置任务的截止日期到过去后显示已过期、截止日是今天的不算过期；合成待办 c-synth-1 填过去、将来、清空都保存且日历到期 chip 跟着移动。内置任务一律经 `goals.ts` 的 `checkTask`、`setDue`、`readTaskRow` 在页面内按位置 id 操作。报告里 4 条全部 passed |
| 5 | 可以添加和删除自定义待办，内置任务没有删除按钮 | ✓ VERIFIED | `tasks.spec.ts`：P1 用 Enter、P2 用添加按钮各新增一条 `c-` 开头的待办并保存，组计数由保存后状态推导，新行有删除按钮、输入框清空；删除 c-synth-1 和一条先设过日期的新待办后 `custom` 与 `tasks` 里都没有；五个内置位置 id 的行逐个 `toHaveCount(0)`，删除按钮总数等于保存后 `custom` 条数；manual 时钟下空白待办按 Enter 和点添加都不保存，之后哨兵写入使写入次数恰好加 1。报告里 3 条全部 passed |

**Score:** 5/5 成功标准已验证（0 条存在但未被行为证明）

### 计划里的补充 must-haves（抽查结论）

| Must-have | Status | Evidence |
|---|---|---|
| 04-01 D-10：B1 日历日面板一对用例 | ✓ VERIFIED | 对照用例证明草稿确实输入、选中日确实移动、弹窗没开；标记用例第一句 `knownBug('B1', …)`；我去掉标记亲自复现：失败在草稿断言，实际值为空字符串；登记在 KNOWN-BUGS.md 的 B1 行 |
| 04-01 D-11：撤销 toast 过期 | ✓ VERIFIED | 见上面 truth 2 |
| 04-01 check-report.mjs | ✓ VERIFIED | 只导入 `node:` 内置模块；`--self-test` 输出 `SELF-TEST OK`；WR-03 后新增 `--min-expected`、对跳过和被过滤用例设防；真实报告校验见下 |
| 04-02 D-13：失焦和负数不保存 | ✓ VERIFIED | manual 时钟下失焦、负数加 Enter 各推 2 秒写入次数不变，输入框恢复当前值，哨兵保存使写入次数恰好加 1 |
| 04-03 D-17：N1 的两种新触发各一对 | ✓ VERIFIED | 日面板删除和目标页勾选各有对照和标记用例；WR-02 后目标页对照用例加了“标签往返不勾选草稿仍在”的基线；我亲自去掉三处标记复现，三条都失败在草稿断言；四条新标题登记在 N1 行，拖拽和改抵达日期仍写明未验证 |
| 04-03 D-16：README 和 KNOWN-BUGS 约定更新 | ✓ VERIFIED | README 含两个新目录行、`calendar.ts`、`goals.ts` 两个 helper 说明、`check-report.mjs` 用法、manual 时钟三类用途；KNOWN-BUGS 约定改为“一条或多条对照用例” |
| 阶段收尾：完整套件、隐私、应用只读 | ✓ VERIFIED | 见下 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tools/test-report/check-report.mjs` | 零依赖报告检查 + 自检 | ✓ VERIFIED | 存在、实质、自检通过；被所有 verify 使用 |
| `tests/support/calendar.ts` | 日历读回 helper | ✓ VERIFIED | 导出 `gotoCalendar`、`readMonth`、`readCellLogClasses`、`readDayPanelLogClasses`、`readDayPanel`；不从 test.ts 导入；只读日期、类名、aria-label、数量、id、组号 |
| `tests/support/goals.ts` | 目标读回与任务操作 | ✓ VERIFIED | 导出 `gotoGoals`、`readGroups`、`readLifts`、`liftHistoryEquals`、`checkTask`、`setDue`、`readTaskRow`；不从 test.ts 导入 |
| `tests/support/expect-from-fixture.ts` | 日历和目标的独立推导 | ✓ VERIFIED | `monthGrid`、`eventsOnDate`、`cellAriaLabel`、`monthTitle`、`expectedMonthCells`、`dayPanelTitle`、`dayPanelSub`、`expectedDayPanel`、`expectedGroup`、`liftHistoryText` 都存在且是实质实现 |
| `tests/support/toast.ts` | 两个片段 helper | ✓ VERIFIED | `expectToastSuffix`、`expectToastContains`，失败消息固定为“内容已隐藏” |
| `tests/e2e/calendar/*.spec.ts`（4 个） | CAL-01 到 CAL-04、B1、N1 | ✓ VERIFIED | 全部存在，标题与计划一致 |
| `tests/e2e/goals/*.spec.ts`（4 个） | GOAL-01 到 GOAL-05、N1 | ✓ VERIFIED | 全部存在，标题与计划一致 |
| `tests/KNOWN-BUGS.md`、`tests/README.md` | 登记与约定 | ✓ VERIFIED | B1 行含两个日历标题，N1 行含四个新标题，登记护栏用例通过 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| grid.spec.ts | expect-from-fixture.ts | `expectedMonthCells(` | ✓ WIRED | 每条网格用例都用 |
| grid.spec.ts / navigation.spec.ts | calendar.ts | `readMonth(page)` | ✓ WIRED | 一次 page.evaluate 读回整月 |
| day-panel.spec.ts | composer.ts | `composer(page, 'c')` | ✓ WIRED | 复用 Phase 3 的记一笔 helper |
| day-panel.spec.ts / known-bugs | toast.ts | `expectToast`、`expectUndoOffered`、`undo`、`expectToastGone` | ✓ WIRED | 复用 Phase 3 的 toast helper，只在 Node 侧比较 |
| overview.spec.ts | goals.ts + expect-from-fixture.ts | `readGroups(page)` + `expectedGroup(` | ✓ WIRED | |
| lifts.spec.ts | toast.ts | `expectToastSuffix`、`expectToastContains` | ✓ WIRED | 没有整句 toast helper 调用（grep 确认） |
| tasks.spec.ts | goals.ts | `checkTask(page`、`setDue(page` | ✓ WIRED | 内置任务全部走页面内操作 |
| known-bugs 三处 | KNOWN-BUGS.md | `knownBug('B1'`、`knownBug('N1'` | ✓ WIRED | 登记护栏用例在完整套件里 passed |

目标里写的“复用 Phase 3 的记一笔、编辑弹窗和 toast helper”：记一笔和 toast helper 被实际复用；本阶段没有编辑弹窗的交互需求，只在 B1、N1、删除用例里断言“弹窗没有打开”，这与成功标准 2 一致。

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| 所有 spec 的“实际值” | 读回对象 | 真实浏览器里运行的应用，状态来自账户模式 mock 加 `full-state.json` | 是 | ✓ FLOWING |
| 所有 spec 的“期望值” | 推导结果 | fixture 或 `app.saved()`（mock 后端收到的写入） | 是，不来自页面 | ✓ FLOWING |

期望值没有任何一处取自页面读回，防止了“把读回当期望”的自证。

### Behavioral Spot-Checks

本阶段的可运行产物是 Playwright 用例。按资源限制没有重跑完整套件，用了下面几项：

| Behavior | Command | Result | Status |
|---|---|---|---|
| 完整套件的报告结论 | `node tools/test-report/check-report.mjs test-results/review-fix-04.json --min-expected 132` | `REPORT OK expected=132 flaky=0 unexpected=0`（报告写于最后一个修复提交之后，且之后 tests/ 与 tools/ 没有变化） | ✓ PASS |
| 阶段 33 条用例逐条状态 | 解析该报告 | calendar 17 条、goals 16 条，全部 expected；三条标记用例 expectedStatus 为 failed 并按预期失败；每条只跑 1 次（无重试） | ✓ PASS |
| 报告检查器反向对照 | `node tools/test-report/check-report.mjs --self-test` | `SELF-TEST OK` | ✓ PASS |
| 应用完整性 | `sha256sum` 与基线、`git ls-files` | 与基线一致，未被跟踪 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --all` | 退出 0，140 个文件 | ✓ PASS |
| 防护 grep | 可见性断言、固定睡眠、`.check()` 类方法、力量名称和历史行选择器、整句 toast helper、helper 导入 test.ts、TBD/FIXME/XXX | 全部无命中 | ✓ PASS |
| 变异 1（失败输出脱敏） | 临时改 tasks.spec.ts 五处断言强制失败，单次运行 retries=0 | 6 条失败；输出中 4 个汉字以上的片段只有 3 个，都来自 tests/ 的注释和断言源码行；另有固定界面文案（已过期、月、日、条记录、项到期、项完成）。失败内容只有组号、id、计数、数字。随后 `git checkout` 恢复 | ✓ PASS |
| 变异 2（toHaveCount 失败路径） | 把内置任务“没有删除按钮”的计数改为 3，只跑该用例 | 日志只有选择器（位置 id）、“resolved to 0 elements”和源码行，没有任务文字 | ✓ PASS |
| 变异 3（已知 bug 复现） | 去掉三处 `knownBug` 调用，运行两个 known-bugs spec | 对照 3 条通过，标记 3 条失败在草稿断言（期望合成草稿，实际空字符串）；输出里的汉字片段只有 composer 文本框的固定占位文案 | ✓ PASS |

三次变异之后都已 `git checkout` 恢复，`git status` 里 tests/ 与 tools/ 干净，应用 sha256 不变。

### Probe Execution

SKIPPED：本阶段计划没有声明 `probe-*.sh` 类探针。

### Requirements Coverage

PLAN frontmatter 的 requirements 字段合起来是 CAL-01 到 CAL-04（04-01）、GOAL-01、GOAL-02（04-02）、GOAL-03 到 GOAL-05（04-03）。REQUIREMENTS.md 的追踪表把这 9 项全部映射到 Phase 4，没有孤立需求，也没有计划多认领的需求。

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CAL-01 | 04-01 | 月份网格：周日起始、今天高亮、抵达日标记、chips、“+N” | ✓ SATISFIED | grid.spec.ts 五条 |
| CAL-02 | 04-01 | 切换月份、回到今天、点格子（相邻月份跳月） | ✓ SATISFIED | navigation.spec.ts 三条 |
| CAL-03 | 04-01 | 日面板显示记录、完成的计划、到期任务，可记一笔 | ✓ SATISFIED | day-panel.spec.ts 前三条 |
| CAL-04 | 04-01 | 日面板删除记录并通过 toast 撤销 | ✓ SATISFIED | day-panel.spec.ts 的 manual 时钟两条 |
| GOAL-01 | 04-02 | 力量卡片和 P1–P7 目标组（计数、进度条） | ✓ SATISFIED | overview.spec.ts 两条 |
| GOAL-02 | 04-02 | 力量值更新后显示历史和达标提示 | ✓ SATISFIED | lifts.spec.ts 五条 |
| GOAL-03 | 04-03 | 勾选或取消任务，完成日期记为今天，进度更新 | ✓ SATISFIED | tasks.spec.ts 两条 |
| GOAL-04 | 04-03 | 设置截止日期，过期显示“已过期” | ✓ SATISFIED | tasks.spec.ts 两条 |
| GOAL-05 | 04-03 | 添加和删除自定义待办，内置任务无删除按钮 | ✓ SATISFIED | tasks.spec.ts 三条 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| 本阶段 16 个改动文件 | - | TBD、FIXME、XXX、waitForTimeout、可见性断言、`.check()` 类调用 | - | 无命中 |
| tests/support/*.ts、tools/test-report/check-report.mjs | - | 04-REVIEW.md 的 IN-01 到 IN-04 | ℹ️ Info | 四条 INFO 处于 open（`judge` 导出即执行 `process.exit`、strings.ts 注释用应用行号做出处、力量 toast 片段无法区分是哪一项力量、chip 类别类断言只证明“互不相同”）。均不影响目标，不阻塞 |

5 条 WARNING（WR-01 到 WR-05）都已在提交 34c090d、3986b1d、e139323、b53ef57、4879429 修复，我读了对应代码，修复到位（见下“评审修复核对”）。

### 评审修复核对

- WR-01：过期用例在 1900、4900 ms 仍带撤销按钮、5100 ms 消失，读代码确认。
- WR-02：N1 目标页对照用例触发前先做“切到目标页再切回、不勾选、草稿仍在”的基线，读代码确认。
- WR-03：`check-report.mjs` 自检通过，且真实报告用 `--min-expected 132` 通过。
- WR-04：`expectedCategory` 使用 `Object.prototype.hasOwnProperty.call`。
- WR-05：grid.spec.ts 对今天的记录两两比较类别类的等价关系与 fixture 类别分组一致。强度依赖 fixture 里今天的记录类别互不相同这一事实（评审说明里的前提），fixture 变动会改变断言强度，这是已知并已声明的假设，不算缺陷。

### 失败输出脱敏（执行器 SUMMARY 留下的 human_judgment 项）

三份 SUMMARY 都把“失败输出不会打印内置任务、预设、力量文字、健身目标数字”标为 human_judgment，因为失败路径从未被执行。我已用代码阅读加两次临时变异把终端输出这一侧**解决**：

- helper 的读回只含 id、组号、数量、数值、布尔和固定文案；toast helper 失败消息固定；内置任务和力量卡上没有定位器动作（力量卡只有 bench、squat 两个输入框和两个保存按钮四个豁免元素，属性里没有个人文字）。
- 强制失败后的终端输出里，没有出现任何应用派生的个人计划文字。
- 剩余说明（不是缺陷，请知悉）：Playwright 失败时写入 `test-results/` 的截图、trace、error-context.md 会含页面全文。它们只在本机，且已被 `.gitignore` 忽略（Phase 1 的 D-02 决定，我也确认了忽略规则存在）。这一点列在下面 P-2 里请你确认。

### Human Verification Required

下面 4 条是把 9 条 `judgment` 档禁止项合并后的确认项。每条我都给了非权威判断和证据，判断全部是“成立”。

### 1. P-1 期望值独立（CAL-01）

**Test:** 确认 calendar 与 goals 的期望只来自独立推导和 fixture，没有从应用取期望。
**Expected:** 验证者判断成立（expect-from-fixture.ts 不导入、不读取应用；推导规则与应用 `eventsOn`、`renderCal`、`renderDay` 一致；35、42 格有路标）。
**Why human:** judgment 档禁止项在交互模式下需要人工确认，验证者的判断是非权威的。

### 2. P-2 隐私（CAL-03、GOAL-01、GOAL-02、GOAL-03）

**Test:** 确认个人计划文字没有出现在断言、失败消息、注解、SUMMARY、提交信息里，也没有写死达标阈值；并确认你接受本地 `test-results/` 里的截图和 trace 含页面全文（本机、已 git 忽略）。
**Expected:** 验证者判断成立（privacy-check 退出 0；grep 防护全部干净；变异后的终端输出里没有应用派生文字）。
**Why human:** 同上。

### 3. P-3 应用与 fixture 只读（CAL-04、GOAL-02、GOAL-05）

**Test:** 确认没有为让用例通过而修改应用或 `full-state.json`，特殊数据只在内存里构造，N1 的拖拽和改抵达日期两种触发没有写用例。
**Expected:** 验证者判断成立（Phase 4 范围内 git log 对应用、fixture、package 文件、playwright.config.ts、app.ts 无提交；sha256 与基线一致且未被跟踪）。
**Why human:** 同上。

### 4. P-4 已知 bug 的透明（GOAL-03）

**Test:** 确认没有未复现的 N1 触发被标成已知 bug。
**Expected:** 验证者判断成立，并已亲自复现三处（去掉标记后三条都失败在草稿断言，实际值为空字符串，对照用例通过）。
**Why human:** 同上。

### Gaps Summary

没有缺口，没有 BLOCKER，没有 WARNING 级别的未决项。所有 truth 都是 VERIFIED，`behavior_unverified` 为 0（撤销窗口、toast 过期、保存防抖、不保存的证明这类状态转换和时序不变量都有对应的通过的用例，并有哨兵写入证明防抖窗口确实推进）。`coincidental_reliance_items` 为空：力量用例的“很小值低于目标、极大值高于目标”和 chip 类别用例对 fixture 的依赖都已在文件头或评审说明里声明，不属于隐含前提。

状态为 `human_needed` 仅因为判断型禁止项需要你确认（上面 4 条）。你确认后可视为 Phase 4 通过。

附注（事实，不影响结论）：
- 我的三次变异运行会让 Playwright 清空 `test-results/`，所以编排者此前生成的 `review-fix-04.json` 现在已不在磁盘上；它的内容我在清空之前已经核对过（见 Behavioral Spot-Checks 第一行）。如需再次留存，需要重新跑一次完整套件。
- 工作区里有未跟踪的 `04-REVIEW.iter2.md`、`04-REVIEW-FIX.iter2.md` 等迭代文件，内容与已提交的 04-REVIEW.md、04-REVIEW-FIX.md 对应，不影响本次验证。
- 本阶段的 deferred 项：无。N1 的拖拽和改抵达日期两种触发、力量历史 30 条上限和同一天替换，是计划里明确的假设或推迟项，不是 Phase 4 成功标准的一部分。

---

_Verified: 2026-11-04T02:39:06Z_
_Verifier: Claude (gsd-verifier)_
