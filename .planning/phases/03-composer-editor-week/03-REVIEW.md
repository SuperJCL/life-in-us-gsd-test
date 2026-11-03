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
  warning: 4
  info: 7
  total: 11
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

本次审查读了全部 20 个文件，并对照只读的应用源码核对了行为（防抖、toast 时长、`normalize`、预设与编辑弹窗的处理函数）。

- **隐私：没有 CRITICAL。** 这些文件里没有绝对机器路径、真实邮箱或个人计划文字。类别显示名和 LEGACY 名只出现在 `tests/support/strings.ts`，唯一的例外见 WR-02。所有会打印元素预览的动作和断言，目标要么是合成 id 元素，要么是日期列（属性只有日期、条数和固定文案）。内置预设、内置任务条目和健身目标行都走 `page.evaluate` 加 Node 侧布尔比较，或只做 `toHaveCount`。
- **已知 bug 对：** 我在去掉 `test.fail` 标记的情况下读取了三条标记用例的失败原因，B1、N1、B4 都失败在各自的期望断言上（`toHaveValue` 超时，实际值分别是空字符串、空字符串、fixture 里的旧复盘），所以不是因为别的原因通过。
- **运行结果：** 在收到资源限制通知之前，我用 `--repeat-each=3 --retries=0` 跑过一次 week、editor 和 registry 的全部用例，102 条全部符合预期（标记用例为预期失败），没有发现不稳定。收到通知后没有再跑任何测试。
- **主要问题：** 4 条 WARNING 都是可靠性或约定问题，没有已证实的错误断言。最值得处理的是 WR-01（“没有保存”的检查采样方式不严）和 WR-03（5 秒撤销窗口靠真实时间）。

## Warnings

### WR-01: “没有写入”的检查在 `runFor` 后立刻采样，异步到达的多余写入会漏检

**File:** `tests/e2e/editor/delete-entry.spec.ts:78-79`，`tests/e2e/editor/edit-entry.spec.ts:224-225`
**Issue:** 两条 manual 时钟用例都在 `await page.clock.runFor(2_000)` 之后立刻同步比较 `app.backend.writes.length`。保存经过 `store.save` 到 `exposeBinding` 再到 Node，是异步往返。如果应用在取消、Escape 或空文本时多发了一次保存，它的写入可能在这次采样之后才到达 mock，检查照样通过。随后的哨兵只证明“防抖确实被推进”，并不会让前面那次多余写入暴露出来：哨兵轮询里 `some(...)` 只要找到哨兵就通过。当前代码靠事件顺序碰巧稳定，但回归时可能漏报。
**Fix:** 哨兵写入出现之后，再断言写入总数恰好多一条。写入按顺序到达，哨兵之前任何多余写入都会让总数大于 `writesBefore + 1`。
```ts
await expect
  .poll(() => app.backend.writes.some((w) => w.data.logs.some((l: Log) => l.id === id && l.text === sentinel)))
  .toBe(true);
// 哨兵到达后，中间不能有别的写入
expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
```
中间那次 `expect(app.backend.writes.length).toBe(writesBefore)` 可以保留，只当作快速失败。

### WR-02: 类别显示名字面量写在 spec 里，违反“只允许出现在 strings.ts”的约定

**File:** `tests/e2e/week/week-view.spec.ts:141`，`tests/e2e/week/week-view.spec.ts:213`
**Issue:** 两条断言消息里直接写了类别显示名（“健身”）。项目约定（Phase 2 D-12 的澄清和 README 第 6 节）是类别显示名只能出现在 `tests/support/strings.ts`。这两处是断言消息字符串，不是注释。内容没有隐私风险，但违反约定，也让后续按“strings.ts 之外无类别名”做的卫生检查误报。
**Fix:** 消息里不写类别名，或用 `${CAT_FITNESS}` 插值。
```ts
expect(areas.find((a) => a.name === CAT_FITNESS)?.ok, '本周只有一天有该类记录，目标行不应达标').toBe(false);
```
文件头和其他位置的同名词出现在注释里，属于说明文字，不在此条范围内。

### WR-03: 带撤销的 toast 只有 5 秒，撤销窗口靠真实时间，负载高时可能不稳定

**File:** `tests/e2e/editor/delete-entry.spec.ts:29-41`，`tests/e2e/week/presets.spec.ts:77-85`，`tests/e2e/week/presets.spec.ts:111-121`
**Issue:** 三条用例在删除之后、点撤销之前，先用 `expectSaved` 等 600 ms 防抖落盘。`expect.poll` 的间隔是 100、250、500、1000 ms，所以这一步最坏要约 1.85 s，再加上其他断言和 CPU 抢占，离 5 s 的 toast 过期只剩约 3 s 余量。测试机卡顿或两个 worker 同时压满时，`undo()` 里的 `expectUndoOffered` 或点击会碰到已经消失的 toast。代码注释已经承认这个窗口，但只靠“中间不做别的”来规避，没有消除时间依赖。项目约定是不稳定就是缺陷（README 第 6 节，`retries: 1` 会掩盖它）。
**Fix:** 这三条用例改用 manual 时钟（D-05）：`clock.install`、`pauseAt`，删除后用 `runFor(1_000)` 推过 600 ms 防抖，toast 因暂停不会过期，再点撤销。或者先点撤销再验证保存，把“撤销前的保存断言”改成撤销后的最终状态断言。

### WR-04: B4 标记用例的“立即刷新”路径没有任何不带标记的用例证明它本身可用

**File:** `tests/e2e/week/known-bugs.spec.ts:143-150`，`tests/e2e/week/known-bugs.spec.ts:126-141`
**Issue:** `test.fail` 会把整条用例里任何原因的失败都当成预期失败。B4 对照用例是在 `runFor` 之后才 `app.reload()`；标记用例是在防抖计时器还挂着（暂停时钟下）的状态直接 `app.reload()`。这个“带着未触发的计时器刷新”的路径，包括 `reload()` 内部的 `ready()`，只出现在标记用例里。如果这一步因为别的原因失败（例如暂停时钟下的刷新卡在就绪等待），用例仍然显示为预期失败，而且报告上看不出区别。本次我确认当前失败点确实是 `toHaveValue`，所以现在没有问题；这是防回归的缺口。
**Fix:** 在对照用例里加一个不依赖 bug 的前提断言，覆盖同一条刷新路径。例如再加一条不带标记的用例：同样准备、不推进时钟、`app.reload()`，只断言刷新后页面就绪且文本框显示的是 fixture 里的旧复盘（这正是现状行为，要在用例标题里写明它描述的是现状，并和 KNOWN-BUGS.md 登记一起维护）；或者在标记用例里把 `app.reload()` 之前的各步骤保持不变，只把期望断言之前的就绪检查放进对照用例。

## Info

### IN-01: composer helper 里有两个没有使用的成员

**File:** `tests/support/composer.ts:71`，`tests/support/composer.ts:89-97`
**Issue:** `addInput` 和 `presetFills` 在整个 `tests/` 里没有调用方（只在定义处出现）。
**Fix:** 删掉，或在第一个使用它们的用例加入时再加回来。

### IN-02: 用魔法下标取类别

**File:** `tests/e2e/week/composer.spec.ts:102`，`tests/e2e/week/presets.spec.ts:48`，`tests/e2e/editor/edit-entry.spec.ts:67`，`tests/e2e/editor/edit-entry.spec.ts:128`，`tests/e2e/editor/edit-entry.spec.ts:164`，`tests/e2e/week/week-view.spec.ts:43`，`tests/support/strings.ts:129-135`
**Issue:** `CATEGORY_NAMES[1]`、`[3]`、`[4]` 等下标散在多个文件里，`GROUP_CATEGORY` 也靠下标；`week-view.spec.ts` 为此在本地另起了 `CAT_FITNESS`。类别顺序一变，这些用例会悄悄换了测试对象，读代码的人也看不出它们分别是哪一类。
**Fix:** 在 `strings.ts` 一次性导出具名常量（`CAT_PROFESSIONAL`、`CAT_FITNESS`、`CAT_JOB` 等，已有 `CAT_LANGUAGE`、`CAT_OTHER`），其余文件都从那里引用。

### IN-03: 用 `JSON.stringify` 比较“其余内容没变”，对键顺序敏感

**File:** `tests/e2e/editor/edit-entry.spec.ts:90-99`，`tests/e2e/editor/task-editor.spec.ts:39-43`，`tests/e2e/editor/delete-entry.spec.ts:44-47`
**Issue:** 应用的 `normalize` 目前原样透传日志和任务对象，所以键顺序和 fixture 一致，用例能过。但这是在无意中依赖 `normalize` 的实现细节：只要它以后改成重建对象，键顺序变了，语义没变也会变红。
**Fix:** 用 `node:util` 的 `isDeepStrictEqual` 做深度比较，仍然只返回布尔，不影响失败输出的脱敏。

### IN-04: 已知 bug 登记护栏的两处缺口

**File:** `tests/e2e/platform/known-bugs-registry.spec.ts:74`，`tests/e2e/platform/known-bugs-registry.spec.ts:46-52`
**Issue:** (1) 防空转检查只要求扫到 `B1`、`N1`，没有 `B4`；`idsInSources` 的正则只认单引号，改成双引号写 `knownBug("B5", ...)` 会被静默忽略，未登记的新 bug 就漏过。(2) 标题检查只验证登记表里写的标题在 spec 里存在，不验证“标记用例标题”确实是调用了 `knownBug` 的那条、“对照用例标题”确实没调用，所以两列填反也不会报。
**Fix:** 把 `B4` 加进 `arrayContaining`；正则改成 `/knownBug\(\s*['"]([A-Z]+[0-9]+(?:-[a-z]+)?)['"]/g`。有余力时按标题定位到 `test(` 块，检查标记列那条块里含 `knownBug(`、对照列那条块里不含。

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
**Issue:** 最后断言 `:checked` 数量为 0，但用例从未在“标记为未完成”之前确认这个复选框是勾选的。断言本身不是空洞的（`data-task` 就在 `input` 上，已核对），但如果 fixture 以后变了，这一步会在没有变化的情况下通过。
**Fix:** 打开编辑弹窗之前，先到目标页断言 `[data-task="c-synth-2"]:checked` 计数为 1，再做操作。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
