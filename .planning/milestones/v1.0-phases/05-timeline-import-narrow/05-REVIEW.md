---
phase: 05-timeline-import-narrow
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - tests/KNOWN-BUGS.md
  - tests/PROBES.md
  - tests/README.md
  - tests/e2e/io/import.spec.ts
  - tests/e2e/io/known-bugs.spec.ts
  - tests/e2e/narrow/narrow.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/e2e/timeline/timeline.spec.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/import-file.ts
  - tests/support/strings.ts
  - tests/support/timeline.ts
findings:
  critical: 0
  warning: 0
  info: 10
  total: 10
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

这是第 3 轮（最后一轮）复审。按资源限制没有运行测试套件，只运行了 `check-report.mjs --self-test`（SELF-TEST OK）。对照提交 `7074ac5` 的源码核对了上一轮唯一的 WARNING。

- **WR-01（窄屏滚动用例的 `|| atBottom` 分支过宽）：已按约束修到位。** `narrow.spec.ts:231-232` 现在是 `atTop = |compTop| <= 2`，`visible = atBottom && compTop >= -2 && compTop < innerHeight`，断言是 `atTop || visible`。at-bottom 分支不再是“页面到底就算过”，而是要求 composer 顶部进入视口。滚动稳定后再读终态的写法（`:199-211`）保持不变。实际走的分支以数字形式记入 `scroll-end` 注解（`:235`），失败信息里也带 `compTop,compBottom,innerHeight,scrollY,scrollHeight`，只含数字，不含页面文字。`:225-230` 的注释和 05-03-SUMMARY.md 都如实写明 at-bottom 分支无法区分 `block` 取值。应用侧 `pickDay`（`us-journey-tracker.html:610`）确实是 `scrollIntoView({behavior:"smooth",block:"start"})`，`#wkComp` 是窄屏页面最后一块，与注释描述一致。
- 在“测试不改页面 DOM 和布局”这个有意的黑盒约束下，at-bottom 分支区分不了 `block` 取值这一弱点无法消除，且已如实记录，因此降为 INFO（IN-10）。
- 没有回归：自上一轮以来 `tests/` 下只有 `narrow.spec.ts` 一个文件被改（25 行增、7 行删），只涉及终态读回和断言。其余 11 个文件与上一轮相同，IN-01 至 IN-09 引用的行号逐条核对仍然有效。

隐私方面没有发现问题：用 `[A-Za-z]:[\\/]Users` 和邮箱模式在这 12 个文件里扫描，没有命中；类别显示名只在 `strings.ts`（`probes.spec.ts:238` 的旧字面量见 IN-09）；窄屏读回只读类名、日期属性、计算样式和位置，时间线用例不读个人计划原文；`scroll-end` 注解只含数字。没有发现可证明的 BLOCKER 或 WARNING。

## Info

### IN-01: 时间线用例里有几条“防空转”断言对 `expectedTimeline` 自身是恒真的

**File:** `tests/e2e/timeline/timeline.spec.ts:68-69`、`tests/e2e/timeline/timeline.spec.ts:94-95`
**Issue:** `expected.rows.every((r) => r.attr === 'edit' && r.tag === name)`、`expected.filters.filter(pressed==='true')).toHaveLength(1)` 以及完成计划那处的 `done.rows.every((r) => r.attr === 'edittask')`，检查的都是推导函数的输出，而 `expectedTimeline` 的构造就保证它们成立，所以永远为真，不会因为 fixture 或应用变化而失败。`rows.length > 0` 才是真正的防空转。对应用的约束来自后面的 `toEqual(expected)`。
**Fix:** 保留 `rows.length > 0`，删掉这几条恒真断言，或改成对 `readTimeline` 读回值的断言（例如被按下的筛选恰好一个、且等于当前筛选）。

### IN-02: `expectedTimeline` 的两处规则与应用不完全等价，只对规整的输入成立

**File:** `tests/support/expect-from-fixture.ts:540`、`tests/support/expect-from-fixture.ts:548`
**Issue:** (1) 完成的内置计划取自 `builtinTaskIds({tasks})`，即 `state.tasks` 里所有形如 `P\d-\d+` 的键；应用只渲染 GROUPS 里真实存在的任务，fixture 或导入内容里的孤儿键被标成完成时，推导会多出一行，应用不会渲染。(2) 排序用字符串 `<` 比较，应用用 `localeCompare`，日期不是零填充 `YYYY-MM-DD` 时两者不一致。当前 fixture 都规整，所以现在没问题。
**Fix:** 在函数注释里写明前提（日期零填充、tasks 不含孤儿内置 id），或让调用方传入有效的内置任务 id 集合，对不满足前提的输入直接抛错。

### IN-03: IO-05 里写死了 fixture 的记录 id 和它们的目标类别

**File:** `tests/e2e/io/import.spec.ts:258`、`tests/e2e/io/import.spec.ts:265`
**Issue:** `toContain('synth-legacy-01')`（预期落在专业）和 `['synth-legacy-03','synth-legacy-04','synth-legacy-05']`（预期落在其他）是手写的 fixture 知识。fixture 一改，这里先红，而红的原因是测试本身而不是应用。同一用例前面已经有按 `expectedCategory` 推导的整体比较。
**Fix:** 用推导算：`legacy.logs.filter((l) => expectedCategory(l.cat) === CAT_OTHER).map((l) => l.id)`，断言它非空并且被读回结果包含；专业同理。

### IN-04: 默认时钟的导入用例里 `expectToast(TOAST_RESTORED)` 依赖约 1.8 秒的真实时间窗口

**File:** `tests/e2e/io/import.spec.ts:93`、`tests/e2e/io/import.spec.ts:195`、`tests/e2e/io/import.spec.ts:218`
**Issue:** toast 的 `.on` 只保持约 1800 ms（`setFixedTime` 只固定 `Date`，计时器仍在走）。`expectToast` 的 poll 在 0、100、250、500、1000 ms 各读一次，正常机器上稳妥，但用户的 PC 长时间运行会卡顿，读回停顿超过窗口就会错过 toast，造成偶发失败。这是 `expectToast` 的通用写法，不是本阶段独有。
**Fix:** 如果 toast 不是用例要证明的核心，删掉它，由后面的 `expectSaved` 作同步点；否则改用 manual 时钟（IO-04 取消用例已经是这个模式）。

### IN-05: README 对 `import-file.ts` 的数据形状描述与实现不一致

**File:** `tests/README.md:133`（实现：`tests/support/import-file.ts:11`）
**Issue:** README 写“文件只存在于内存（`{ name, mimeType, buffer }`）”，但 `ImportFile` 类型是 `{ name, mimeType, text }`，`Buffer` 在 `chooseImportFile` 里才构造。
**Fix:** 改成“`{ name, mimeType, text }`，选文件时在内存里转成 buffer”。

### IN-06: KNOWN-BUGS.md 把 B8 列为“仍未验证”，同时 N3 一行又说 N3 的根因就是 B8

**File:** `tests/KNOWN-BUGS.md:26`、`tests/KNOWN-BUGS.md:47`、`tests/KNOWN-BUGS.md:51`
**Issue:** N3 的“CONCERNS.md 出处”栏写明它最接近的是 normalize 校验过浅（research 的 B8），而收尾状态里又把“B8：导入校验过浅，例如日志缺 date”列为未验证，最后一条“与 N3 同类的输入”还重复了同一个类别。读者分不清 B8 到底有没有被覆盖。
**Fix:** B8 一条改成“N3 已覆盖 `{}`；日志缺 date 这类字段级校验不足仍未验证”，并删除或合并最后一条重复项。

### IN-07: PROBES.md 的记录日期没有随 PROBE-8 更新

**File:** `tests/PROBES.md:9`
**Issue:** 运行环境表里的“记录日期”是 2026-11-02，而 PROBE-8 和 B2/N3 的结论是 2026-11-03 加入的（`KNOWN-BUGS.md` 的 N3 行记的是 2026-11-03）。
**Fix:** 更新为 2026-11-03，或在表里注明 PROBE-8 的记录日期。

### IN-08: PROBE-8 里的裸 `catch {}` 会吞掉所有错误

**File:** `tests/e2e/platform/probes.spec.ts:363-365`
**Issue:** 第二次确认框的等待只想吞 `expect.poll` 的超时，但 `catch {}` 吞掉了所有错误（包括页面已关闭等）。后面 `changes()` 的读取通常会再次暴露页面问题，风险不大，但同一文件里 PROBE-2 已有“只吞超时、其他照常抛出”的写法，这里不一致。
**Fix:** 复用 PROBE-2 的做法：只在错误信息匹配 `/Timeout \d+ms exceeded while waiting on the predicate/` 时记为 `not-observed`，其余错误重新抛出。

### IN-09: `probes.spec.ts` 里有一处类别显示名字面量违反“只在 strings.ts”规则（旧代码，不在 PROBE-8 范围）

**File:** `tests/e2e/platform/probes.spec.ts:238`
**Issue:** PROBE-5 的种子里写了 `cat: '其他'`。README 和 `strings.ts` 头注释规定类别显示名只放在 `tests/support/strings.ts`。这是 Phase 1 的旧代码，只是顺带记录。
**Fix:** 改用已在 `strings.ts` 导出的 `CAT_OTHER`。

### IN-10: 窄屏滚动用例的 at-bottom 分支无法区分 `block` 取值（已如实记录，在黑盒约束下无法消除）

**File:** `tests/e2e/narrow/narrow.spec.ts:225-239`
**Issue:** 窄屏下 `#wkComp` 是页面最后一块，composer 加底部留白不足一屏时，`block:"start"` 也滚不到顶部贴边，浏览器停在页面底部，这时走的是 `visible` 分支，`block:"nearest"` 或 `"end"` 也会走同一分支并通过。所以只要实际走的是 at-bottom 分支，用例证明的只是“页面平滑滚动后停在底部，composer 顶部进入视口”，而不是 `block:"start"`。要锁定 `block` 需要页面在 composer 之后有滚动余量，而“用例不改页面 DOM 和布局”是有意的黑盒约束。注释（`:225-230`）、05-03-SUMMARY.md 和 `scroll-end` 注解都如实记录了这一点，且用例仍能抓住“根本没有滚动”“滚过头使 composer 顶部在视口外”“composer 没进入视口”这几类回归，用例名里“scrolls the composer into view”的声称与断言强度一致。另外两个小点：`compTop < innerHeight` 只要求顶部差 1px 进入视口就算过，`compBottom` 只进了失败信息而没进断言；两者在 composer 小于视口的这个页面上影响很小。
**Fix:** 无需再改。如果以后接受“页面内临时加占位元素”这类不改应用文件的做法，可再加一个 `atTop` 必过的用例；否则保持现状。若想略微收紧，可在 `visible` 里补一句 `end.compBottom <= end.innerHeight + 2`（at-bottom 时 composer 底部应在视口内）。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
