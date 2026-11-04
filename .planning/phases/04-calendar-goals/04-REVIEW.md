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
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

审阅范围是第 4 阶段新增的日历和目标 spec、读回 helper、toast helper、独立推导函数和 `check-report.mjs`。只读审阅，没有运行测试套件；运行了 `node tools/test-report/check-report.mjs --self-test`，输出 `SELF-TEST OK`。

隐私方面：这 16 个文件里没有发现本机绝对路径、真实邮箱，也没有个人计划文字（类别显示名只出现在 `strings.ts`）。读回 helper 只在 `page.evaluate` 里读 id、类名、计数和布尔，失败消息固定为“内容已隐藏”或只含 id 和合成文字；`readTaskRow.label` 和 `readDayPanel.dueGroups` 读的是 `.meta` 里的固定文案和 `.tag` 里的组号，没有越界。力量卡的定位器动作只用了允许的四个元素。所以没有 CRITICAL 的隐私问题。

为了核对 toast 计时，读了应用里 `toast()` 的实现：带撤销的 toast 用 5000 ms，其余 1800 ms，共用一个计时器；标签切换只切 `hidden` 类，不重绘。

没有发现 BLOCKER。主要问题是：撤销 toast 的“5 秒”并没有被任何用例钉住；目标页 N1 的对照和标记这一对用例没有排除“标签往返本身清草稿”；`check-report.mjs` 在不列标题或只列部分标题时，对被过滤、被中断的用例不设防；独立推导里有一处 `in` 操作符的原型键问题；日历 chip 类别类的断言只是互相一致。

## Warnings

### WR-01: 撤销 toast 的“5 秒”从未被钉住，过期用例只证明“6 秒时已消失”

**File:** `tests/e2e/calendar/day-panel.spec.ts:191-215`（同时见 `:153-189`）
**Issue:** 标题是 `the undo toast expires after five seconds`，但时间线是：点删除（t=0），`runFor(1_000)`（t=1000），`runFor(5_000)`（t=6000）后才断言 `expectToastGone`。同一文件的另一条用例在 t≈1000 点撤销，也只证明 1 秒时还在。所以在 (1000, 6000] 之间的任何过期时长都会通过两条用例，例如有人把带撤销的 toast 改成 1800 ms（与普通 toast 一样），两条用例都仍然绿。D-11 想验证的恰恰是 5000 ms 这个值和“共享计时器”这件事，现在两头都没有卡边界。
**Fix:** 在 t=1000 保存之后，先推到刚好小于 5 秒，断言仍在，再越过边界：

```ts
await page.clock.runFor(3_900);          // t = 4900
await expectUndoOffered(page);           // 还没过期，撤销按钮仍在
await page.clock.runFor(200);            // t = 5100
await expectToastGone(page);
```

可选再加一个边界下限：t≈1900 时 `expectUndoOffered`，排除 1800 ms。

### WR-02: N1（目标页勾选）的对照用例没有排除“标签往返本身清草稿”，标记用例可能因错误原因“预期失败”

**File:** `tests/e2e/goals/known-bugs.spec.ts:41-72`
**Issue:** 标记用例的触发序列是：本周输入草稿 → 切到目标页 → 勾选 → 切回本周 → 断言草稿还在。`test.fail` 会把这条序列里任何原因造成的草稿丢失都当作“预期失败”。对照用例只证明勾选分支走了（toast、保存）、切回后 composer 还有一个（`toHaveCount(1)`），从不检查“只切标签、不勾选”时草稿是否保留。如果某次应用改动让标签切换也重绘（或让切回本周时 composer 被重建），标记用例仍然红得“正确”，对照用例仍然绿，登记表里“根因是 renderAll”这个结论就不再被测试支持。当前应用的标签切换只切 `hidden` 类，所以今天是对的，但这条护栏本来就是为将来的改动准备的。B1 日历和 N1 删除两对用例没有这个问题（触发动作之间没有别的重绘候选）。
**Fix:** 在对照用例里加一段不带触发的基线，两条用例的准备保持不变，只在对照用例的“前提”阶段多验证一次：

```ts
// 基线：只做标签往返、不勾选，草稿仍在（排除标签切换本身清草稿）
await openGoalsBox(page);
await backToWeek(page);
await expect(c.text).toHaveValue(N1_DRAFT);
// 然后再 openGoalsBox -> box.click() -> backToWeek 走触发
```

### WR-03: `check-report.mjs` 对未列出的被跳过、被过滤、被中断的用例没有设防，部分运行可以得到 `REPORT OK`

**File:** `tools/test-report/check-report.mjs:49-66`
**Issue:** 判定只看 `stats.unexpected`、`stats.flaky`、`stats.expected > 0` 和命令行列出的标题。`stats.skipped` 从未被读取：
1. 不带标题调用（或只列了新用例标题）时，被 `-g` 过滤掉的用例根本不在报告里，被 `test.skip`/`fixme` 跳过的用例只进 `skipped` 计数，两种情况都不影响结果。
2. Playwright 把被中断（Ctrl+C、`maxFailures` 之后没跑到）的用例算作 skipped，`unexpected` 可以仍然是 0，只要跑完的那部分都过了就输出 `REPORT OK`。
3. README 把它描述为“需要机器判定没有失败、没有 flaky、指定的用例都实际运行”，这句话成立的前提是调用者把每一个想要的标题都列全；全量回归（例如“132 passed”这类结论）实际上没有被它保护。
这不是当前运行结果的错误（最近一次全量是 132 passed、0 flaky），而是判定器会在该红的时候给绿。
**Fix:** 把已知允许的跳过显式化：

```js
// 除了带 known-bug 注解的 skipped，任何 skipped 都算问题
const skippedUnexpected = specs.flatMap(sp => sp.tests ?? [])
  .filter(t => t.status === 'skipped' && !hasKnownBugAnnotation(t)).length;
if (skippedUnexpected > 0) problems.push(`skipped without known-bug: ${skippedUnexpected}`);
```

再加一个可选参数 `--min-expected N`，让全量运行能固定“至少跑了 N 条”。同时在自检里补上对应的反向用例。

### WR-04: `expectedCategory` 用 `in` 判断旧类别，原型链上的键会被当成旧类别

**File:** `tests/support/expect-from-fixture.ts:90-95`
**Issue:** `if (cat in legacy) return legacy[cat];` 中 `legacy` 是普通对象，`in` 会命中原型键：`expectedCategory('constructor')`、`'toString'`、`'valueOf'`、`'__proto__'` 都返回一个函数或对象而不是 `CAT_OTHER`。这个函数是“按规格独立写出的期望”，本身就是断言的依据；对未知类别的输入（畸形导入、合成的未知类别）它应当一律返回“其他”。当前 fixture 里没有这样的值，所以不会立刻出错，但推导函数自己有 bug，比应用的 bug 更难发现。
**Fix:**

```ts
const legacy: Record<string, string> = LEGACY_CATEGORY_MAP;
if (Object.prototype.hasOwnProperty.call(legacy, cat)) return legacy[cat];
```

### WR-05: “chip 的类别类与日面板一致”只证明两处互相一致，不证明类别类正确

**File:** `tests/e2e/calendar/grid.spec.ts:74-79`
**Issue:** 断言是 `cellClasses` 等于 `panelClasses`，外加“每个 chip 都有 `k-` 开头的类”。两个值都来自应用：如果应用把所有记录都渲染成同一个类别类（或两处用了同一个错误映射），这条断言照样通过。标题写的是“its category class matches the day panel”，实现也确实只做到这一点，但这一块（CAL-01 的 chip 颜色类）没有别的用例覆盖。今天那三条记录的类别互不相同（见 fixture），所以可以不依赖具体类名、也不写任何类别文字来加强：
**Fix:** 用 fixture 的类别分组约束类名的等价关系：同一类别的记录类名相同，不同类别的记录类名不同。

```ts
const todayLogs = variant.logs.filter((l: Log) => l.date === FROZEN_TODAY);
for (let i = 0; i < todayLogs.length; i++) {
  for (let j = i + 1; j < todayLogs.length; j++) {
    const same = todayLogs[i].cat === todayLogs[j].cat;
    expect(JSON.stringify(cellClasses[i]) === JSON.stringify(cellClasses[j])).toBe(same);
  }
}
```

## Info

### IN-01: `judge` 被 `export`，但模块在导入时就会执行 `process.exit`

**File:** `tools/test-report/check-report.mjs:41,147`
**Issue:** 文件末尾无条件执行 `process.exit(main(process.argv.slice(2)))`。任何 `import { judge } from ...` 都会立刻用导入方的 argv 跑一遍并退出进程，所以这个 `export` 实际上不可用，也没有人用。
**Fix:** 去掉 `export`，或用 `import.meta.url` 判断是否直接运行：`if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(...))`。

### IN-02: 自检没有覆盖几种会让判定器出错的报告形状

**File:** `tools/test-report/check-report.mjs:91-112`
**Issue:** 现有 10 个用例都只有一个 spec、一层 suite。没有覆盖：同一标题在两个 spec 里一个 expected 一个 unexpected（应当失败）、spec 的 `tests` 为空数组、`stats.skipped > 0` 且无 known-bug 注解（对应 WR-03）、`stats` 缺失、`errors` 不是数组。
**Fix:** 补 4 到 5 个最小报告用例，随 WR-03 一起加。

### IN-03: `strings.ts` 的注释用应用源码行号做出处，会随应用变动失效

**File:** `tests/support/strings.ts:161,165,170,176,179,186,190,194,200,203,206`
**Issue:** 注释写“应用源码第 482 行”“第 497-503 行”等。应用文件不在仓库里、也不会被这里更新，行号一旦漂移就变成误导信息；其他常量用的是“应用源码逐字复制”，不带行号。
**Fix:** 统一改成“应用源码逐字复制”，需要定位时写函数名（如 `renderCal`、`renderDay`）而不是行号。

### IN-04: 力量 toast 的片段比较无法区分是哪一项力量被更新

**File:** `tests/e2e/goals/lifts.spec.ts:68,107`
**Issue:** `expectToastContains(LIFT_UPDATED_INFIX + SMALL_BENCH)` 只比较“已更新为 1”这类片段，名称被有意隐藏（隐私），所以如果应用把 bench 的保存误记到别的力量项目上，toast 比较不会发现。保存内容里 `lifts.bench` 的断言（`expectSaved`）会兜住真正的数据错误，所以只影响“toast 属于哪一项”这一条弱断言。
**Fix:** 不需要改动；如果想补强，可以在页面内读回 toast 的前半段是否等于对应卡片 `.lv` 之前的名称节点文字，只返回布尔，不打印文字。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
