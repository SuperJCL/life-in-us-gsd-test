---
phase: 02-account-mock-data-export
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - tests/PROBES.md
  - tests/README.md
  - tests/e2e/data/synthetic-data.spec.ts
  - tests/e2e/io/export.spec.ts
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/csv-masking.spec.ts
  - tests/e2e/platform/guardrails.spec.ts
  - tests/e2e/platform/mock-contract.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/e2e/smoke.spec.ts
  - tests/e2e/storage/account-mode.spec.ts
  - tests/fixtures/full-state.json
  - tests/fixtures/legacy-categories.json
  - tests/fixtures/malformed-imports.ts
  - tests/fixtures/minimal-state.json
  - tests/mocks/CONTRACT.md
  - tests/mocks/claude-backend.ts
  - tests/mocks/claude-runtime.ts
  - tests/support/app.ts
  - tests/support/constants.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/fixture-files.ts
  - tests/support/static-server.cjs
  - tests/support/strings.ts
  - tests/support/task-ids.ts
  - tests/support/test.ts
findings:
  critical: 0
  warning: 1
  info: 7
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

这是 --auto 修复循环的第 3 轮（最后一轮）复审。对照源码核实了上一轮的两项修复，并在主工作区完整跑了一遍 `npx playwright test`：63 条全部通过，没有 flaky。

**上一轮修复的核实结果：**

- 上轮 WR-01（导出断言泄漏内置任务文字）：已修复。`export.spec.ts` 第 106 行改成 `expect(data.includes(row), 消息).toBe(true)`，消息只取金标准行的前 40 个字符（合成文字）；第 174-178 行改成比较布尔值；`downloads` 的三处 `toEqual([])` 和一处 `toHaveLength(1)` 都换成了 `.length`。逐行核对过：`export.spec.ts` 里现在没有任何一条断言会在失败时把 CSV 正文打印出来。第 112 行 `expect(generated, ...).toContain(row)` 的 `generated` 用的是 `SYNTH-builtin-<id>` 占位文字，不含个人计划文字，可以保留。
- 上轮 IN-07（脱敏逻辑没有常驻反向对照）：已解决。`csv-masking.spec.ts` 的 5 条纯函数用例逻辑正确，全部只用合成文字，通过。前 4 条确实能抓到 `maskTaskTexts` 失效（诊断里出现任务文字或缺少占位符）。第 5 条的覆盖范围比它的名字小，见下面新的 IN-07。

**隐私：** 在 `tests/` 下 grep 绝对机器路径、用户名、真实邮箱，没有命中（`data/users/<id>` 是 mock 的文档路径，不是机器路径）。fixture 文字以 `SYNTH-` 开头。没有 CRITICAL。

**新发现：** 同一类“失败输出泄漏个人计划文字”的问题还剩一处，不在 export 的断言里，而在 `synthetic-data.spec.ts` 的目标视图断言里（Playwright 的调用日志会打印元素预览）。这是上一轮审计范围之外的路径，所以只算新的 WR-01。

## Warnings

### WR-01: 目标视图断言失败时，Playwright 的元素预览会把内置任务文字和力量项目备注打印出来

**File:** `tests/e2e/data/synthetic-data.spec.ts:149` 和 `tests/e2e/data/synthetic-data.spec.ts:161-163`
**Issue:** 两处断言作用在会渲染个人计划文字的元素上，失败时 Playwright 会把这些文字写进终端和报告：

- 第 149 行 `await expect(task(id), ...).toBeChecked()`：`task(id)` 是内置任务的复选框，应用把任务文字写在它的 `aria-label` 里（应用模板：`data-task="${x.id}" ... aria-label="${esc(x.text)}"`）。`expect` 的调用日志会打印 `locator resolved to ${previewNode(element)}`。核对过 `node_modules/playwright-core/lib/coreBundle.js` 里的 `previewNode`：它把元素的全部属性（总长上限 500 个字符）原样打印，不截断单个属性。所以“已完成的任务没有被勾上”这类失败，输出里会带整段 `aria-label`，也就是个人计划文字。
- 第 161-163 行 `.locator('.hist')).toContainText(LIFT_HISTORY_PREFIX)`：应用在没有历史记录时，`.hist` 里显示的是力量项目自己的备注（应用模板：`h ? "最近：" + esc(h) : L.note`）。历史没渲染出来时，字符串匹配器的失败输出会带 `Received string: "<备注全文>"`，这是 LIFTS 备注，属于个人计划文字。

D-14 声明个人计划文字“不进控制台”。仓库公开，日后接 CI 就会进日志。这和已修好的 export 断言同类，但这两处还在。（`test-results/` 和 `playwright-report/` 本身被 git 忽略，所以这里说的是终端和 CI 日志，不是提交内容。）
**Fix:** 用不会打印元素预览、也不会打印被测文字的断言形式：
```ts
// 第 149 行：用 :checked 选择器 + 计数断言，toHaveCount 的日志只有元素个数
for (const id of buckets.done) {
  await expect(page.locator(`#goals [data-task="${id}"]:checked`), `已完成 ${id}`).toHaveCount(1);
}

// 第 159-164 行：读文本在 Node 侧做布尔判断，expect.poll 失败时只打印 true/false
for (const [id, lift] of Object.entries<any>(fixture.lifts)) {
  await expect(page.locator(`#lf-${id}`)).toHaveValue(String(lift.cur));
  const hist = page.locator('#goals .lift').filter({ has: page.locator(`#lf-${id}`) }).locator('.hist');
  await expect
    .poll(async () => ((await hist.textContent()) ?? '').startsWith(LIFT_HISTORY_PREFIX), {
      message: `力量项目 ${id} 的历史行没有以“${LIFT_HISTORY_PREFIX}”开头（内容已隐藏）`,
    })
    .toBe(true);
}
```
`toHaveValue(String(lift.cur))` 作用的是 `<input type="number" id="lf-...">`，它的属性里没有名字或备注，可以保留。第 143-146 行的 `toHaveCount(1)`、第 150 行的 `.od` 断言、第 152 行 `[data-due]` 断言（`aria-label` 是固定的“截止日期”）也不会带出任务文字，不用改。

## Info

### IN-01: README 第 10 节写“六项运行时探针”，实际有七项

**File:** `tests/README.md:90`
**Issue:** `probes.spec.ts` 已有 PROBE-1 到 PROBE-7，`PROBES.md` 标题也写“PROBE-1 到 PROBE-7”，README 仍写“六项”。
**Fix:** 改成“七项”，或去掉数字。

### IN-02: 端口号 4789 在多处写死，没有用 `PORT` 常量

**File:** `tests/e2e/platform/probes.spec.ts:77-78`，`tests/support/constants.ts:7`
**Issue:** `APP_ORIGIN` 手写了 `:4789`，PROBE-2 又写了两个 `http://...:4789/...`。改端口时容易漏掉。`static-server.cjs` 的那份因为是 CJS 可以接受。
**Fix:** `export const APP_ORIGIN = \`http://127.0.0.1:${PORT}\`;`，探针里用模板字符串拼 `PORT`。

### IN-03: IO-03 首个用例里“还没有任何写入”是单次采样，没有证明力

**File:** `tests/e2e/io/export.spec.ts:39-41`
**Issue:** 导出后立即检查 `app.backend.writes` 为空，600 ms 防抖还没触发就会通过。真正的证明由 account-mode 的 manual 时钟用例负责。
**Fix:** 删掉这一行，或把注释改成“启动不写 mock 由 MOCK-03 manual clock 用例证明”。

### IN-04: “每个用例从空 mock 开始”的断言无法检测共享状态

**File:** `tests/e2e/io/export.spec.ts:160-163`
**Issue:** 检查的是本用例刚 `new` 出来的 `MockBackend`，必然为空；`MockBackend` 将来若改成静态共享状态，这三行仍通过。
**Fix:** 去掉标题里这句话，或用两个 `new MockBackend()` 实例直接断言互不影响。

### IN-05: DATA-02 的“合成标记”检查会被注释满足

**File:** `tests/e2e/data/synthetic-data.spec.ts:232`
**Issue:** `malformed-imports.ts` 第 1 行注释就含 `_synthetic`，`toContain('_synthetic')` 与文件内容是否真带标记无关。
**Fix:** 改为导入 `SYNTHETIC_MARKER` 并断言每条 `text` 以 `SYNTH` 开头或含该标记；或删掉这条断言。

### IN-06: `local-seed.json` 的读取在四个 spec 里各写了一份；CONTRACT.md 的未实现清单漏了一项

**File:** `tests/e2e/storage/account-mode.spec.ts:15-17`、`tests/e2e/platform/mock-contract.spec.ts:7-9`、`tests/e2e/smoke.spec.ts:65`、`tests/e2e/platform/probes.spec.ts:235`；`tests/mocks/CONTRACT.md:166-176`
**Issue:** 四处重复拼路径并 `JSON.parse`，`fixture-files.ts` 已有 `loadFixture`。另外 CONTRACT.md 3.2 节的未实现清单没有写明：契约要求文档顶层必须是 JSON 对象（文件里只有一段引文），而 mock 的 `set()` 不校验顶层类型，也不做值的 JSON 校验。
**Fix:** 四处改用 `loadFixture('local-seed.json')`；在 CONTRACT.md 3.2 节补一项“顶层类型和值的 JSON 校验：mock 不检查”。

### IN-07: `csv-masking.spec.ts` 第 5 条用例的名字和注释声称的覆盖，实际没有守住；`csvMismatch` 的兜底分支没有用例

**File:** `tests/e2e/platform/csv-masking.spec.ts:64-75`；`tests/support/expect-from-fixture.ts:124-125`
**Issue:** 第 5 条用例的名字和注释说“脱敏文字后面紧跟的字节不同，判定仍然是不一致（判定用原始字符串，不用脱敏后的文本）”。但它构造的差别（`gamma ,` 多了一个空格）在脱敏之后依然存在，`csvMismatch` 会走正常的逐行比较分支。如果有人把判定改成“只比较脱敏后的行，行都相同就返回 `null`”（让泄漏防护反过来吞掉真实差异），这条用例照样通过。真正需要保护的是第 124-125 行的兜底分支：脱敏后各行相同、原始字符串不同时，必须返回非空诊断。这条路径对应的真实场景是：应用把任务文字里的双引号写错了（例如只写一个双引号），而 `maskTaskTexts` 把两种写法都换成了同一个占位符，两边脱敏后一模一样。现在这个分支没有任何用例，一旦被改成返回 `null`，导出里的引号错误会被静默放过。
**Fix:** 加一条用例，让两边只在被脱敏的文字内部不同：
```ts
test('IO-02 csvMismatch still reports a difference that hides entirely inside masked task text', () => {
  const a = csvOf(rowQuoted('03/02/2026')); // 双引号写成两个
  const e = csvOf(`"${CSV_DUE_PREFIX}${TEXT_QUOTED}",03/02/2026,True,P2${CSV_GROUP_SUFFIX}`); // 双引号只写一个
  const text = csvMismatch(a, e, texts);
  expect(text).not.toBeNull();
  expect((text as string).includes('SYNTH-masking say'), '诊断里出现了任务文字').toBe(false);
});
```
同时把第 5 条用例的名字和注释改成它实际验证的内容（“差别在脱敏文字后面时仍不一致”）。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
