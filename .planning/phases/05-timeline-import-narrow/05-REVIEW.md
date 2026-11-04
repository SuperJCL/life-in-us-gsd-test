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
  warning: 3
  info: 9
  total: 12
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

本次按 standard 深度审查了 Phase 5 新增的时间线、导入、PROBE-8、B2/N3 已知 bug、窄屏用例和收尾文档。没有运行测试套件（遵守资源限制），只运行了 `check-report.mjs --self-test`（SELF-TEST OK）。核对应用源码只用于确认行为（时间线渲染、导入处理函数、`pickDay` 的滚动条件、窄屏断点），评审文字里不引用任何个人计划文字。

隐私方面没有发现问题。用 grep 检查了这 12 个文件：没有本机绝对路径、邮箱，fakepath 只以“形式”出现；类别显示名只在 `strings.ts` 里新增（`probes.spec.ts:238` 的 `'其他'` 是 PROBE-5 的旧代码，见 IN-09）；`readTimeline` 对完成的计划只读 id、日期和月份标题，失败输出里没有计划原文；导入文件名都过了 `synth-` 检查，磁盘上没有任何备份样的文件。

结构上做得扎实的地方：no-save 证明用 manual 时钟加哨兵写入，并且哨兵检查的是写入次数恰好加一，早先的错误写入会让次数变成加二，所以这条证明不是空转的；对话框处理总是先于选文件注册，confirm 在 FileReader 的 onload 里异步弹出，用例都用 `expect.poll` 等消息；窄屏的几条计算样式断言在桌面宽度下会失败，不会空转；`expectedNormalize` 与应用的规则一致但没有照抄代码。

没有发现能证明的 BLOCKER。下面 3 个 WARNING 是“断言比文档声称的弱”或“可能因错误原因通过”的问题。

## Warnings

### WR-01: 窄屏“选日后滚动到 composer”的 poll 条件在平滑滚动的第一帧就成立

**File:** `tests/e2e/narrow/narrow.spec.ts:198-207`
**Issue:** 应用的 `pickDay` 在 `innerWidth<=900` 时调用 `$("wkComp").scrollIntoView({behavior:"smooth",block:"start"})`，终态是 `#wkComp` 顶部贴近视口顶部（`compTop` 约为 0）。但 poll 的条件是 `compTop >= -1 && compTop < innerHeight && scrollY > before.scrollY`。点击前 `compTop >= innerHeight`（放在视口下方 40px），所以平滑滚动只要走了 41px、`compTop` 刚刚小于 `innerHeight`，条件就成立，这时 composer 只有最上面 1px 进入视口。结果：
- 注释写的是“等平滑滚动结束”，条件并不检查滚动是否结束；
- 如果应用把 `block:"start"` 改成 `"nearest"` 或 `"end"`，滚动距离变短，用例仍然通过；
- 用例名是 “scrolls the composer into view”，实际只证明“页面向下滚动了一点”。

**Fix:** 等滚动稳定后再断言终态。例如先 poll 到 `scrollY` 连续两次读数相同，再断言 composer 顶部靠近视口上沿，并允许文档到底时滚不到顶的情况：

```ts
await expect
  .poll(async () => {
    const now = await page.evaluate(() => {
      const top = (document.querySelector('#wkComp') as HTMLElement).getBoundingClientRect().top;
      const maxY = document.documentElement.scrollHeight - innerHeight;
      return { top, atBottom: scrollY >= maxY - 1, scrollY };
    });
    // block:start 的终态：顶部贴近视口上沿；文档不够长时退而求其次到底
    return now.scrollY > before.scrollY && (Math.abs(now.top) <= 2 || now.atBottom);
  })
  .toBe(true);
```

如果用户希望保持“宽松”，至少把 `compTop < now.innerHeight` 收紧成 `< now.innerHeight / 2` 并在注释里去掉“等滚动结束”的说法。

### WR-02: B2 对照用例的“没有写入”断言在 600 ms 防抖窗口内必然成立，是空转断言，且文档把它写成了证明

**File:** `tests/e2e/io/known-bugs.spec.ts:38`（文档声称：`tests/KNOWN-BUGS.md` B2 一行、`known-bugs.spec.ts:34` 注释）
**Issue:** `cancelImport` 只等确认框出现就返回，对照用例随后立刻 `expect(app.backend.writes).toEqual([])`。应用的保存有 600 ms 防抖，就算取消路径被改坏、错误地保存了，此时写入也还没有发出，断言照样通过。这个用例用的是真实时钟，没有推进防抖，所以这一条断言不能证明“取消后没有保存”。`KNOWN-BUGS.md` 的 B2 现状栏写的是“对照用例证明……没有写入”，说法比实际证明力强。真正证明“取消不保存”的是 `import.spec.ts` 里的 manual 时钟用例（`IO-04 cancelling ...`），而不是这里。

**Fix:** 二选一。要么删掉这条断言，并把 KNOWN-BUGS.md 现状栏里的“没有写入”去掉（取消不保存已由 `IO-04 cancelling the import confirm keeps the data and saves nothing` 覆盖）；要么让 B2 的 describe 用 `test.use({ clockMode: 'manual' })`，像 IO-04 那样 install、`pauseAt`、`runFor(2_000)` 之后再比较写入次数。

### WR-03: N3 标记用例只断言 toast，注册表登记的“不弹确认、数据不变”并没有被断言，部分“已修好”的应用也会让它通过

**File:** `tests/e2e/io/known-bugs.spec.ts:89-97`（登记：`tests/KNOWN-BUGS.md` N3 一行的“期望行为”栏）
**Issue:** 登记表写的期望行为是“应用拒绝 `{}` 这类不像备份的 JSON：不弹替换确认，提示格式错误，数据不变”，但标记用例只断言出现格式错误 toast。文件头注释论证了“记录仍在页面上”和“保存里记录仍在”单独作为断言都有问题，这个论证成立，但那是针对单独使用的情况。在 toast 已经出现之后再断言，这两条就不再空转了：确认框会先于任何 toast 出现，格式错误 toast 出现时，数据要么被替换了要么没有。目前这个用例会放过下面这种“修法”：应用先弹 confirm、用户接受之后才校验并提示格式错误（此时 `answerNextDialog` 预先接受了确认框，数据可能已被替换）。这违背登记的期望行为，应该让它保持红。

**Fix:** 在 `expectToast(page, TOAST_IMPORT_BAD_FORMAT)` 之后追加两条同步点已经就位的断言，并让 `importEmptyObject` 返回的 `dialogs` 被使用：

```ts
const dialogs = await importEmptyObject(page, app);
await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
expect(dialogs, '不应弹出替换确认框').toEqual([]);
await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);
```

这些断言只在格式错误 toast 出现后才执行，bug 存在时仍然在第一条 `expectToast` 处按预期失败，不改变现有“失败点正是期望断言”的复现结论。

## Info

### IN-01: 时间线用例里有几条“防空转”断言对 `expectedTimeline` 自身是恒真的

**File:** `tests/e2e/timeline/timeline.spec.ts:68-69`、`tests/e2e/timeline/timeline.spec.ts:95`
**Issue:** `expected.rows.every((r) => r.attr === 'edit' && r.tag === name)` 和 `expected.filters.filter(pressed==='true')).toHaveLength(1)` 检查的是推导函数的输出，而 `expectedTimeline` 的构造就保证它们成立（筛选为类别时只收 `cat === filter` 的记录，`filters` 恰好一项被按下），所以它们永远为真，不会因为 fixture 或应用变化而失败。`rows.length > 0` 才是真正的防空转。对应用的约束来自后面的 `toEqual(expected)`。
**Fix:** 保留 `rows.length > 0`，删掉这两条恒真断言，或者改成对读回值的断言（例如对 `readTimeline` 的结果检查 `filters` 里被按下的恰好一个、且值等于当前筛选）。

### IN-02: `expectedTimeline` 的两处规则与应用不完全等价，只对规整的输入成立

**File:** `tests/support/expect-from-fixture.ts:540`、`tests/support/expect-from-fixture.ts:548`
**Issue:** (1) 完成的内置计划取自 `builtinTaskIds({tasks})`，也就是 `state.tasks` 里所有形如 `P\d-\d+` 的键；应用只渲染 GROUPS 里真实存在的任务。fixture 或导入内容里如果有孤儿键（例如超出组内序号的 id）且被标成完成，推导会多出一行，应用不会渲染。(2) 排序用字符串 `<` 比较，应用用 `localeCompare`，日期不是零填充的 `YYYY-MM-DD` 时两者会不一致。当前 fixture、`syntheticBackup`、旧类别 fixture 都是规整数据，所以现在没有问题，但这是 IO 类用例以后加畸形日期或孤儿任务时会踩到的坑。
**Fix:** 在函数注释里写明前提（日期为零填充、tasks 不含孤儿内置 id），或者让调用方传入内置任务 id 的有效集合；也可以在推导里对不满足前提的输入直接抛错，而不是静默给出与应用不同的结果。

### IN-03: IO-05 里写死了 fixture 的记录 id 和它们的目标类别

**File:** `tests/e2e/io/import.spec.ts:258`、`tests/e2e/io/import.spec.ts:265`
**Issue:** `toContain('synth-legacy-01')`（预期落在专业）和 `['synth-legacy-03','synth-legacy-04','synth-legacy-05']`（预期落在其他）是手写的 fixture 知识。fixture 一改，这里先红，而且红的原因是测试本身而不是应用。同一个用例前面已经有按 `expectedCategory` 推导的整体比较。
**Fix:** 用推导算出来：`legacy.logs.filter((l) => expectedCategory(l.cat) === CAT_OTHER).map((l) => l.id)`，并断言它非空、读回的 `otherIds` 包含它们；专业同理。

### IN-04: 默认时钟的导入用例里 `expectToast(TOAST_RESTORED)` 依赖约 1.8 秒的真实时间窗口

**File:** `tests/e2e/io/import.spec.ts:93`、`tests/e2e/io/import.spec.ts:195`、`tests/e2e/io/import.spec.ts:218`
**Issue:** toast 的 `.on` 只保持约 1800 ms（`setFixedTime` 只固定 `Date`，计时器仍在走）。`expectToast` 的 poll 在 0、100、250、500、1000 ms 之后各读一次，正常机器上稳妥，但用户的 PC 在长时间运行时会卡顿，一次读回停顿超过窗口就会错过 toast，造成偶发失败。这是项目里 `expectToast` 的通用写法，不是本阶段独有，所以只记为提示。
**Fix:** 对这三处，如果 toast 不是用例要证明的核心，可以删掉，由后面的 `expectSaved` 作同步点；否则改用 manual 时钟（IO-04 取消用例已经是这个模式）。

### IN-05: README 对 `import-file.ts` 的数据形状描述与实现不一致

**File:** `tests/README.md:133`（实现：`tests/support/import-file.ts:11`）
**Issue:** README 写“文件只存在于内存（`{ name, mimeType, buffer }`）”，但 helper 的 `ImportFile` 类型是 `{ name, mimeType, text }`，`Buffer` 是在 `chooseImportFile` 里才构造的。
**Fix:** README 改成“`{ name, mimeType, text }`，选文件时在内存里转成 buffer”。

### IN-06: KNOWN-BUGS.md 把 B8 列为“仍未验证”，同时 N3 一行又说 N3 的根因就是 B8

**File:** `tests/KNOWN-BUGS.md:26`、`tests/KNOWN-BUGS.md:50`
**Issue:** N3 的“CONCERNS.md 出处”栏写明它最接近的是 normalize 校验过浅（research 的 B8），而收尾状态里又把“B8：导入校验过浅，例如日志缺 date”列为未验证，并且最后一条“与 N3 同类的输入”重复了同一个类别。读者分不清 B8 到底有没有被覆盖。
**Fix:** B8 一条改成“N3 已覆盖 `{}`；日志缺 date 这类字段级校验不足仍未验证”，并删除重复的最后一条，或把两者合并成一条。

### IN-07: PROBES.md 的记录日期没有随 PROBE-8 更新

**File:** `tests/PROBES.md:8`
**Issue:** 运行环境表里的“记录日期”是 2026-11-02，而 PROBE-8 和 B2/N3 的结论是在 2026-11-03 加入的（`KNOWN-BUGS.md` 的 N3 行记的是 2026-11-03）。
**Fix:** 更新为 2026-11-03，或在表里注明 PROBE-8 的记录日期。

### IN-08: PROBE-8 里的裸 `catch {}` 会吞掉所有错误

**File:** `tests/e2e/platform/probes.spec.ts:360-365`
**Issue:** 第二次确认框的等待只想吞 `expect.poll` 的超时，但 `catch {}` 吞掉了所有错误（包括页面已关闭、对话框相关异常）。后面 `changes()` 的读取通常会再次暴露页面问题，所以风险不大，但同一个文件里 PROBE-2 已经有“只吞超时、其他照常抛出”的写法，这里不一致。
**Fix:** 复用 PROBE-2 的做法：只在错误信息匹配 `/Timeout \d+ms exceeded while waiting on the predicate/` 时记为 `not-observed`，其余错误重新抛出。

### IN-09: `probes.spec.ts` 里有一处类别显示名字面量违反“只在 strings.ts”规则（旧代码，不在 PROBE-8 范围）

**File:** `tests/e2e/platform/probes.spec.ts:238`
**Issue:** PROBE-5 的种子里写了 `cat: '其他'`。README 和 `strings.ts` 头注释规定类别显示名只放在 `tests/support/strings.ts`。这是 Phase 1 的旧代码，不是本阶段引入的，只是顺带记录。
**Fix:** 改用 `CAT_OTHER`（已在 `strings.ts` 导出）。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
