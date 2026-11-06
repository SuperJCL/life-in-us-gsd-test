---
phase: 03-composer-editor-week
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - tests/KNOWN-BUGS.md
  - tests/PROBES.md
  - tests/README.md
  - tests/e2e/editor/delete-entry.spec.ts
  - tests/e2e/editor/edit-entry.spec.ts
  - tests/e2e/editor/task-editor.spec.ts
  - tests/e2e/platform/known-bugs-registry.spec.ts
  - tests/e2e/week/composer.spec.ts
  - tests/e2e/week/drag.spec.ts
  - tests/e2e/week/known-bugs.spec.ts
  - tests/e2e/week/presets.spec.ts
  - tests/e2e/week/review.spec.ts
  - tests/e2e/week/week-view.spec.ts
  - tests/support/app.ts
  - tests/support/composer.ts
  - tests/support/editor.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/strings.ts
  - tests/support/test.ts
  - tests/support/toast.ts
findings:
  critical: 0
  warning: 0
  info: 8
  total: 8
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

这是 --auto 修复循环第 2 轮的复审。上一轮的 4 条 WARNING（WR-01 到 WR-04，提交 535d9fa、4bc2eb1、0cf9cae、8e44f28）都已对照源码核对，全部修复到位，没有发现回归，也没有新的 WARNING 或 CRITICAL。本轮没有运行任何测试（按资源限制），结论来自读源码并对照只读的应用源码。

**对三条改用 manual 时钟的撤销用例，逐条核对了时间推进顺序**，依据是应用里 `toast()` 只有一个共享的 `tt` 计时器（新 toast 先 `clearTimeout(tt)`），带撤销的 toast 5000 ms，普通 toast 1800 ms，保存防抖 600 ms：

- 删除记录并撤销（`delete-entry.spec.ts:18-59`）：`pauseAt` 之后删除，toast 与防抖计时器同时挂起；`runFor(1_000)` 只触发 600 ms 防抖，5000 ms 的 toast 计时器不会到期，所以 `undo` 时按钮还在。撤销会先清掉旧计时器，再弹“已恢复”（1800 ms）；第二次 `runFor(1_000)` 只触发第二次保存的防抖，不会触及 1800 ms。`expectSaved` 取最后一次写入，第一次保存里记录已被删除，所以“id 顺序与 fixture 相同”只会在撤销后的新写入到达时成立，不会被旧写入误通过。
- 删除自定义预设并撤销（`presets.spec.ts:62-105`）：同样的顺序。撤销之后 `runFor(2_000)` 同时覆盖第二次防抖（600 ms）和“已恢复”toast 的 1800 ms，所以 `expectToastGone` 是确定的；累计推进 3000 ms，仍小于最初删除 toast 的 5000 ms（而且它的计时器已被撤销清掉）。
- 删除内置预设并撤销（`presets.spec.ts:107-143`）：顺序相同；`runFor` 不是元素动作，不会把 toast 文字带进日志；标签文字只在 Node 侧做布尔比较。

**WR-01**：两处哨兵之后都已加 `writes.length === writesBefore + 1`（`delete-entry.spec.ts:108`，`edit-entry.spec.ts:242`）。写入按顺序到达，哨兵之前的多余保存会让总数大于 +1，修复有效。**WR-02**：两条断言消息已不含类别显示名；spec 里剩下的同名词只在注释里。**WR-04**：新增的对照用例（`known-bugs.spec.ts:146-161`）走和标记用例完全相同的准备与触发（暂停时钟、输入复盘、不推进时钟就刷新），只断言与 bug 无关的前提，所以应用修好后它仍通过，只有标记用例变红；登记表 B4 行已登记新标题（登记护栏的标题正则只取反引号里的 `BUG-` 标题，括号里的说明不影响）。标记用例本身未改动。

**隐私：没有 CRITICAL。** 20 个文件里没有绝对机器路径、真实邮箱或个人计划文字；类别显示名只在 `strings.ts` 的常量里和注释里出现。新增和改动的断言和动作：撤销按钮点击的目标只有“撤销”文字；`expectToast` 的参数是常量加合成名；内置预设只用计数断言和 Node 侧布尔比较。没有新增会打印内置预设、任务、举重或健身目标数值的断言。

**剩余问题：** 没有 WARNING。上一轮的 7 条 INFO 全部仍然成立（本轮 fix_scope 没有处理它们），另有 1 条新的文档不一致（IN-08）。

## Info

### IN-01: composer helper 里有两个没有使用的成员

**File:** `tests/support/composer.ts:71`，`tests/support/composer.ts:89-97`
**Issue:** `addInput` 和 `presetFills` 在整个 `tests/` 里没有调用方（只在定义处出现，本轮用 grep 重新确认）。
**Fix:** 删掉，或在第一个使用它们的用例加入时再加回来。

### IN-02: 用魔法下标取类别

**File:** `tests/e2e/week/composer.spec.ts:102`，`tests/e2e/week/presets.spec.ts:48`，`tests/e2e/editor/edit-entry.spec.ts:67`，`tests/e2e/editor/edit-entry.spec.ts:128`，`tests/e2e/editor/edit-entry.spec.ts:164`，`tests/e2e/week/week-view.spec.ts:43`，`tests/support/strings.ts:129-135`
**Issue:** `CATEGORY_NAMES[0]`、`[1]`、`[3]`、`[4]` 等下标散在多个文件里，`GROUP_CATEGORY` 也靠下标；`week-view.spec.ts` 为此在本地另起了 `CAT_FITNESS`。类别顺序一变，这些用例会悄悄换了测试对象，读代码的人也看不出分别是哪一类。
**Fix:** 在 `strings.ts` 一次性导出具名常量（`CAT_PROFESSIONAL`、`CAT_FITNESS`、`CAT_JOB` 等，已有 `CAT_LANGUAGE`、`CAT_OTHER`），其余文件都从那里引用。

### IN-03: 用 `JSON.stringify` 比较“其余内容没变”，对键顺序敏感

**File:** `tests/e2e/editor/edit-entry.spec.ts:90-99`，`tests/e2e/editor/task-editor.spec.ts:39-43`
**Issue:** 应用的 `normalize` 目前原样透传日志和任务对象，所以键顺序和 fixture 一致，用例能过。但这是在无意中依赖 `normalize` 的实现细节：它以后改成重建对象，键顺序变了，语义没变也会变红。（`delete-entry.spec.ts` 里比较的是 id 数组，顺序本身就是断言内容，不在此条范围内。）
**Fix:** 用 `node:util` 的 `isDeepStrictEqual` 做深度比较，仍然只返回布尔，不影响失败输出的脱敏。

### IN-04: 已知 bug 登记护栏的两处缺口

**File:** `tests/e2e/platform/known-bugs-registry.spec.ts:74`，`tests/e2e/platform/known-bugs-registry.spec.ts:46-52`
**Issue:** (1) 防空转检查只要求扫到 `B1`、`N1`，没有 `B4`；`idsInSources` 的正则只认单引号，改成双引号写 `knownBug("B5", ...)` 会被静默忽略，未登记的新 bug 就漏过。(2) 标题检查只验证登记表里写的标题在 spec 里存在，不验证“标记用例标题”确实是调用了 `knownBug` 的那条、“对照用例标题”确实没调用，所以两列填反也不会报；B4 现在对照列里有两个标题，同样不被区分。
**Fix:** 把 `B4` 加进 `arrayContaining`；正则改成 `/knownBug\(\s*['"]([A-Z]+[0-9]+(?:-[a-z]+)?)['"]/g`。有余力时按标题定位到 `test(` 块，检查标记列那条块里含 `knownBug(`、对照列那些块里不含。

### IN-05: README 对标记用例在列表里的显示描述不准确

**File:** `tests/README.md:135`
**Issue:** 文中写标记用例“在列表里显示为通过（预期失败）”。本机 `list` 报告器实际给预期失败的用例打 `x`，只是在汇总里计为通过。第一次看到的人会以为是真失败。
**Fix:** 改成“列表里带 `x` 标记，但汇总计为通过（预期失败）；应用修好后会显示为意外通过并变红”。

### IN-06: 选中类名的正则过松

**File:** `tests/e2e/week/composer.spec.ts:222`
**Issue:** `toHaveClass(/sel/)` 会匹配任何包含 `sel` 子串的类名，而 `known-bugs.spec.ts` 里用的是 `/\bsel\b/`，两处写法不一致。目前列的类名只有 `day`、`today`、`sel`，所以没有实际误判。
**Fix:** 改成 `/\bsel\b/`。

### IN-07: “改回未完成”用例没有先确认复选框原本是勾选的

**File:** `tests/e2e/editor/task-editor.spec.ts:80-83`
**Issue:** 最后断言 `:checked` 数量为 0，但用例从未在“标记为未完成”之前确认这个复选框是勾选的。断言本身不是空洞的（`data-task` 就在 `input` 上），但如果 fixture 以后变了，这一步会在没有变化的情况下通过。
**Fix:** 打开编辑弹窗之前，先到目标页断言 `[data-task="c-synth-2"]:checked` 计数为 1，再做操作。

### IN-08: README 的“时间与保存”一节没有跟上 manual 时钟的新用法

**File:** `tests/README.md:125`，`tests/README.md:131`
**Issue:** 第 125 行写“只有证明‘没有保存’时才用 manual 时钟”。WR-03 之后，三条撤销用例也改用 manual 时钟（为的是 5 秒的 toast 窗口不依赖真实时间），B4 的三条用例本来就用。按 README 写的规则，后续作者会认为撤销窗口类用例应该用真实时间，把已经修掉的不稳定写回去。第 131 行“每个已知 bug 是同一个 describe 里的一对用例”也不再准确：B4 现在是一个标记用例加两条对照用例。
**Fix:** 第 125 行改成“需要确定的时间条件时用 manual 时钟：证明‘没有保存’、带撤销的 toast（5 秒窗口）、‘防抖计时器未触发就刷新’”，并补一句撤销用例的写法（`install`、`open`、`pauseAt`、动作、`runFor(1_000)` 推过防抖、再 `undo`）。第 131 行改成“一对用例，必要时可以有额外的对照用例（例如 B4 的刷新路径）”。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
