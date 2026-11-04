---
phase: 04-calendar-goals
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - tests/KNOWN-BUGS.md
  - tests/README.md
  - tests/e2e/calendar/day-panel.spec.ts
  - tests/e2e/calendar/grid.spec.ts
  - tests/e2e/calendar/known-bugs.spec.ts
  - tests/e2e/calendar/navigation.spec.ts
  - tests/e2e/goals/known-bugs.spec.ts
  - tests/e2e/goals/lifts.spec.ts
  - tests/e2e/goals/overview.spec.ts
  - tests/e2e/goals/tasks.spec.ts
  - tests/support/calendar.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/goals.ts
  - tests/support/strings.ts
  - tests/support/toast.ts
  - tools/test-report/check-report.mjs
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

这是 --auto 修复循环的第 2 轮复审。上一轮的 5 个 WARNING 都已核对源码，全部修好，没有发现回归，也没有新增 WARNING 或 BLOCKER。只读审阅：没有运行测试套件，只运行了 `node tools/test-report/check-report.mjs --self-test`，输出 `SELF-TEST OK`。

逐项核对：

- **WR-01（34c090d）已修好。** 过期用例的时间线是 t=0 点删除，`runFor(1000)` 到 t=1000 并等保存，`runFor(900)` 到 t=1900 仍带撤销，`runFor(3000)` 到 t=4900 仍带撤销，`runFor(200)` 到 t=5100 已消失。时钟是暂停的手动时钟，`expect.poll` 走真实时间，不会推进页面时钟，所以每个断言都在确切的时刻读取。1800 ms 的普通 toast 超时会在 t=1900 处失败，5000 ms 以下或以上的改动也会被 t=4900 和 t=5100 两头卡住。
- **WR-02（3986b1d）已修好。** 对照用例在触发前多了一段“目标页往返、不勾选、草稿仍在”的基线，标记用例没有改动，仍然只在勾选后的草稿期望上预期失败。基线里的 `toHaveValue` 失败消息只会带合成草稿文字。
- **WR-03（e139323）已修好。** 读了 `judge` 全部分支：无注解的 skipped、`stats.skipped` 超出带 known-bug 的 skipped 数量、没有 test 或没有 `tests` 字段的 spec、同标题一过一败、缺 `stats`、`errors` 不是数组、`--min-expected` 不足都会被拒绝；带 known-bug 注解的 skipped（fixme 退路）仍然通过。自检 22 个用例都有对应的反向用例，且 `mixed results` 那条用例把 `stats.unexpected` 设成 0，确实只有新的同标题检查能发现。`parseArgs` 对缺值、非整数、负数都失败。输出只有计数和标题，没有越过隐私约定。README 的说明与脚本一致。
- **WR-04（b53ef57）已修好。** `hasOwnProperty.call` 之后 `constructor`、`toString`、`__proto__` 都落到“其他”。
- **WR-05（4879429）已修好，并对照 `tests/fixtures/full-state.json` 确认。** 2026-03-18（`FROZEN_TODAY`）恰好有 3 条记录，3 条的类别字符串互不相同（字节前缀各不相同，没有两条同类别），所以断言实际检查的是“3 条记录在格子里和日面板里两两类名不同”，与 `expectedCategory` 的分组一致。变体只改了两个自定义计划的日期，没有动 logs，所以 `todayLogs` 仍是 3 条，`toHaveLength(cellClasses.length)` 成立。没有写类名字面量或类别文字，失败消息是固定中文说明。

隐私：这 16 个文件里没有本机绝对路径、真实邮箱和个人计划文字；类别显示名只出现在 `tests/support/strings.ts`；失败输出路径里只有 id、类名、计数、布尔和合成文字；力量卡定位器动作仍只用允许的四个元素。没有 CRITICAL 或隐私相关 WARNING。mock 只覆盖 happy path 属于设计，不记为问题。

没有任何级别的发现时才能标 clean；下面还有 4 条 INFO（3 条是上一轮保留下来仍然成立的，1 条是 WR-05 修复后的剩余弱点），所以状态是 `issues_found`。

## Info

### IN-01: `judge` 被 `export`，但模块在导入时就会执行 `process.exit`（上一轮 IN-01，仍成立）

**File:** `tools/test-report/check-report.mjs:52,251`
**Issue:** 文件末尾无条件执行 `process.exit(main(process.argv.slice(2)))`。任何 `import { judge } from ...` 都会立刻用导入方的 argv 跑一遍并退出进程，所以这个 `export` 实际上不可用，也没有人用。
**Fix:** 去掉 `export`，或只在直接运行时执行：`if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));`（需要 `import { pathToFileURL } from 'node:url'`）。

### IN-02: `strings.ts` 的注释用应用源码行号做出处，会随应用变动失效（上一轮 IN-03，仍成立）

**File:** `tests/support/strings.ts:161,165,170,176,179,186,190,194,200,203,206`
**Issue:** 注释写“应用源码第 482 行”“第 497-503 行”等。应用文件不会在这里被更新，行号一旦漂移就成了误导信息；仓库里其他常量用的是“应用源码逐字复制”，不带行号。
**Fix:** 统一改成“应用源码逐字复制”，需要定位时写函数名（如 `renderCal`、`renderDay`）而不是行号。

### IN-03: 力量 toast 的片段比较无法区分是哪一项力量被更新（上一轮 IN-04，仍成立）

**File:** `tests/e2e/goals/lifts.spec.ts:68,107`
**Issue:** `expectToastContains(LIFT_UPDATED_INFIX + SMALL_BENCH)` 只比较固定片段，名称出于隐私被有意隐藏，所以如果应用把 bench 的保存记到别的力量项目上，toast 比较不会发现。`expectSaved` 里对 `lifts.bench` 的断言会兜住真正的数据错误，所以这只是“toast 属于哪一项”的弱断言。
**Fix:** 不需要改动；如要补强，可在页面内读回 toast 前半段是否等于对应卡片的名称节点文字，只返回布尔值，不打印文字。

### IN-04: chip 类别类断言只能证明“互不相同”，不能发现类别之间被对调或统一换了映射

**File:** `tests/e2e/calendar/grid.spec.ts:83-93`
**Issue:** WR-05 的修复把类名的等价关系绑定到了 fixture 的类别分组，这比之前强得多（单一类别渲染、全部同类都会被抓到）。但今天 3 条记录的类别两两不同，所以断言实际只检查“三个类名两两不同”：如果应用把类别 A 和 B 的类名整体对调（或两处用同一个错误的一一映射），断言仍然通过。这个残余风险很小，也无法在不写类名字面量或类别文字的前提下完全消除；另外，若将来 fixture 的今天记录变成同类别多条，断言强度会随分组变化，而不会有提示。
**Fix:** 不必改。如果想补强：把应用里类名到类别的对应写成 `tests/support/strings.ts` 里的一份独立常量表（类别名到类名），再对每条记录比较类名等于表中的值。这会在 strings.ts 中增加类别显示名，这是项目允许的唯一位置。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
