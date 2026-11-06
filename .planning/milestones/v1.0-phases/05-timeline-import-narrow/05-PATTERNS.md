# Phase 5: 时间线、导入与窄屏 - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 11（新建 6，修改 5）
**Analogs found:** 11 / 11

隐私说明：本文件不含 CATS/GROUPS/LIFTS 区域的任何文字，也不含机器绝对路径。应用只按行号区间和选择器引用。

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最接近的 analog | 匹配度 |
|---|---|---|---|---|
| `tests/e2e/timeline/timeline.spec.ts`（新） | test | request-response（读回 DOM） | `tests/e2e/calendar/day-panel.spec.ts` + `tests/e2e/calendar/grid.spec.ts` | exact |
| `tests/support/timeline.ts`（新，读回 helper） | utility | transform（page.evaluate 读回） | `tests/support/calendar.ts` | exact |
| `tests/support/expect-from-fixture.ts`（改，加 `expectedTimeline`） | utility | transform | 同文件的 `expectedDayPanel`、`expectedMonthCells`、`timelineDateLabel` | exact |
| `tests/support/strings.ts`（改，加筛选名、确认框文案、格式错误 toast） | config | - | 同文件 `TIMELINE_EMPTY`、`TOAST_RESTORED` | exact |
| `tests/e2e/io/import.spec.ts`（新） | test | file-I/O + event-driven（dialog） | `tests/e2e/io/export.spec.ts` | exact |
| `tests/e2e/io/known-bugs.spec.ts`（新，B2、N3 成对用例；也可并入 import.spec.ts） | test | event-driven | `tests/e2e/calendar/known-bugs.spec.ts` | exact |
| `tests/e2e/narrow/narrow.spec.ts`（新） | test | request-response（读计算样式） | `tests/e2e/editor/edit-entry.spec.ts`（弹窗断言）+ `tests/support/calendar.ts` | role-match |
| `tests/KNOWN-BUGS.md`（改，加 B2、N3 两行，改收尾一节） | doc | - | 同文件 N1 行（第 23 行） | exact |
| `tests/README.md`（改） | doc | - | 同文件已有目录小节 | exact |
| `tests/PROBES.md`（改，可选：B2 spike 结论） | doc | - | 同文件已有探针记录 | role-match |
| `tests/e2e/platform/known-bugs-registry.spec.ts`（不改，只靠它双向核对 B2、N3 标题） | test | - | 自身 | - |

所有 analog 路径都经 `git ls-files` 确认是已跟踪文件。

## Pattern Assignments

### `tests/support/timeline.ts`（utility，transform）

**Analog:** `tests/support/calendar.ts`

**头部约束与导入**（calendar.ts 第 1-9 行）：只能从 `@playwright/test` 和 `./strings` 导入，不能从 `./test` 导入（避免循环引用）。
```typescript
import { expect, type Page } from '@playwright/test';
import { DAY_SECTION_DUE, TAB_LABELS } from './strings';
```

**打开标签**（第 12-16 行）：
```typescript
export async function gotoCalendar(page: Page) {
  const tab = page.getByRole('tab', { name: TAB_LABELS.cal, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
```
照抄成 `gotoTimeline`，用 `TAB_LABELS.tl`。

**读回形状**（第 90-111 行 `readDayPanel`）：一次 `page.evaluate`，返回纯数据，不返回定位器。时间线版本建议返回：
`{ filters: {label, pressed}[]; rows: {kind:'log'|'task', id, month?, date, tag?}[]; months: string[]; empty: string|null }`。
- 读 `#filters [data-filter]` 的 `data-filter` 和 `aria-pressed`。
- 按 DOM 顺序遍历 `#timeline > .tl-month, #timeline > .tl-item`：`.tl-month` 的 textContent 是月份标题（固定格式，可读）；`.tl-item` 读 `data-edit` 或 `data-edittask`、`.tl-date` 文字（`M/D`）、`k-*` 类名。
- 隐私（D-07）：不读 `.li-text`，不读完成计划的 `.tag`（是组号，可读，但 `.li-text` 是原文）。合成记录的文字可读，但为统一起见只读 id。
- 读 `#timeline .empty` 的 textContent，没有则 null。

**应用侧选择器**（`us-journey-tracker.html` 约 529-541 行）：
```
$("filters").innerHTML = opts.map(o => `<button aria-pressed="${o===filter}" data-filter="${o}">${o}</button>`)
items.sort((a,b) => b.date.localeCompare(a.date))   // 同日顺序取决于 push 顺序：先记录后完成的计划，sort 稳定
.tl-month  -> `${YYYY} 年 ${+MM} 月`
.tl-item k-<k> editable [data-edit|data-edittask]  > .tl-date (M/D) + .tag + .li-text
空状态: <p class="empty">…</p>（文案 = strings.ts TIMELINE_EMPTY）
```
注意：同一天内记录与完成的计划的相对顺序依赖稳定排序（先记录、后完成的计划，各自按 state 顺序）。`expectedTimeline` 必须按同样的“先记录后计划”顺序再做稳定倒序排序，否则同日条目顺序会不一致。

---

### `tests/support/expect-from-fixture.ts`（加 `expectedTimeline`）

**Analog:** 同文件 `expectedDayPanel`（第 433 行起）、`taskBuckets`（第 57 行）、`builtinTaskIds`（第 72 行）、`customTasks`（第 84 行）、`timelineDateLabel`（第 308-312 行）、`expectedCategory`（第 90-96 行）。

**日期标签**（第 308-312 行，已有，直接用）：
```typescript
export function timelineDateLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}`;
}
```
**规则**（D-08）：独立推导，不导入应用代码。
- `全部`：所有记录 + 已完成且有 `doneDate` 的计划（内置和自定义都算）。
- 类别：`l.cat === filter` 的记录。fixture 里的类别已是新类别名；旧类别名数据要先过 `expectedCategory`。
- `完成的计划`：只有已完成的计划。
- 排序：`date` 倒序（稳定）。月份标题：`${年} 年 ${+月} 月`。
- 返回 `{ months: string[]; rows: {id, attr: 'edit'|'edittask', date: 'M/D'}[] }`，与 `readTimeline` 同形，靠 `toEqual` 比较（calendar.ts 第 18 行注释的做法：两个文件各自声明类型）。

内置任务的 id 用 `builtinTaskIds(state)`（只取 `tasks` 里 done 的 `P<n>-<i>` 键）。不要在期望里写任何任务文字。

---

### `tests/e2e/timeline/timeline.spec.ts`（test，读回比较）

**Analog:** `tests/e2e/calendar/day-panel.spec.ts`、`tests/e2e/calendar/grid.spec.ts`

**导入与开局**（参照 `tests/e2e/calendar/known-bugs.spec.ts` 第 8-17 行和第 24-27 行）：
```typescript
import { test, expect } from '../../support/test';
import { loadFixture } from '../../support/fixture-files';
import { gotoTimeline, readTimeline } from '../../support/timeline';
import { expectedTimeline } from '../../support/expect-from-fixture';
import { TIMELINE_EMPTY /* , 筛选名常量 */ } from '../../support/strings';

await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
await app.expectAccountMode();
await gotoTimeline(page);
```
**用例清单（建议）：**
1. `TL-01 ...` 全部筛选：读回 id 顺序、月份标题、日期等于 `expectedTimeline(fixture, '全部')`；`aria-pressed` 只有“全部”为 true（D-09）。
2. `TL-02 ...` 对每个类别按钮点击（循环 `CATEGORY_NAMES`）：读回等于期望；被按下的按钮切换。
3. `TL-02 ...` “完成的计划”筛选：只有 `data-edittask` 条目。
4. `TL-01 ...` 空状态：`minimal-state.json` 打开，`#timeline .empty` 文案 `toHaveText(TIMELINE_EMPTY)`；再加一条“选一个 fixture 里没有记录的类别”的空状态（先算出这样的类别，若 fixture 里每个类别都有记录，就改用 minimal-state 加“完成的计划”筛选）。
5. 可选：点击合成记录条目（`[data-edit="synth-full-0N"]`，只有合成 id）打开编辑弹窗，对照 `tests/support/editor.ts`。

**D-07 要点：** 完成计划条目的文字是个人原文，所以对 `data-edittask` 条目不用 `getByText`、不 `toBeVisible`、不用定位器点击。点击筛选按钮用 `page.locator('#filters [data-filter="…"]')`，按钮文字是固定界面文案，可以用。

---

### `tests/e2e/io/import.spec.ts`（test，file-I/O）

**Analog:** `tests/e2e/io/export.spec.ts`

**头部注释与导入**（export.spec.ts 第 1-17 行）：写中文头注释说明“内容只在内存里比较，不写文件、不附加到报告”。
```typescript
import { test, expect } from '../../support/test';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';
import { expectedCategory } from '../../support/expect-from-fixture';
import { expectToast } from '../../support/toast';
```
**开局与读备份**（第 23-35 行）：
```typescript
const fixture = loadFixture('full-state.json');
await app.open({ mode: 'account', seed: fixture });
await app.expectAccountMode();
await page.locator('#exportJson').click();
await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);
const { filename, data } = app.backend.downloads[0];
const backup = JSON.parse(data);
expect(backup).toEqual(withoutSynthetic(fixture));
```
**保存断言**（第 100-103 行、144-146 行）：`await app.expectSaved((s) => ..., '消息')`；写入次数用 `app.backend.writes.length`；`app.backend.writes` 为 `[]` 表示没有保存。

**导入触发（新写，没有现成 analog）：** 先注册对话框，再设置文件（D-05）。
```typescript
let dialogText = '';
page.once('dialog', async (d) => { dialogText = d.message(); await d.accept(); });   // 取消用例改 d.dismiss()
await page.locator('#importJson').setInputFiles({
  name: 'synth-import.json',            // D-04：合成名，不含“备份”，不以“在美国的日子-”开头
  mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(payload)),
});
expect(dialogText).toBe(CONFIRM_IMPORT);   // 文案放 strings.ts，应用侧为约 656-658 行 confirm("…")
```
**注意：** `confirm` 在 `FileReader.onload` 里异步触发，所以 `dialogText` 要在 `expect.poll` 或 `await expectToast` 之后再断言；不要在 `setInputFiles` 返回后立刻断言。

**六种情况（D-11）：**
1. **确认替换：** payload 用合成备份（可以是 `withoutSynthetic(fixture)` 变体，或在 `full-state` 基础上改几条合成记录）。接受后 `expectToast(page, TOAST_RESTORED)`（strings.ts 第 155 行已有），`app.expectSaved` 里比较深度相等。期望值 = 备份经 normalize 规则推导（类别经 `expectedCategory`）。
2. **取消：** `d.dismiss()`；用 `clockMode: 'manual'`（`test.use({ clockMode: 'manual' })`，参考 `tests/e2e/editor/delete-entry.spec.ts` 第 16 行），推进计时器（`page.clock.runFor(...)`，超过 800 ms 加 600 ms 两段防抖）后断言 `app.backend.writes.length` 不变、`app.saved()` 仍等于种子。不和 `setFixedTime` 混用。
3. **非 JSON：** 循环 `MALFORMED_IMPORTS` 中 `kind === 'not-json'` 的项（`synth-not-json.json`、`synth-truncated.json`、`synth-notes.txt`），buffer 为 `Buffer.from(m.text)`。断言 toast 为格式错误（新常量，应用侧 `toast("文件格式不对，请选择导出的备份 .json")`），且不出现 dialog（用 `let dialogSeen = false; page.on('dialog', ...)`），数据不变。`json-not-object` 和 `json-wrong-field-types` 的行为取决于 `normalize`，先 spike 再决定；`null` 大概率抛错，`[]` 和错误类型的对象可能不抛（与 N3 同类，别在这里断言未确认的行为）。
4. **往返：** 导出 JSON 读 `app.backend.downloads[0].data`，作为 `buffer` 导入，接受后 `app.saved()` 与导出前（`JSON.parse(data)`）`toEqual`。
5. **旧类别迁移：** `loadFixture('legacy-categories.json')` 作为导入内容；接受后读保存状态，每条记录 `cat` 等于 `expectedCategory(原 cat)`；再去时间线或本周视图读回类名（`k-*`）作证。
6. **控制台：** 如有预期内的 `console.error`，用 `guard.remove`（见 `tests/support/test.ts` 第 25 行 `GuardHandle`），不放宽规则。

---

### `tests/e2e/io/known-bugs.spec.ts`（或并入 import.spec.ts）（test，B2、N3）

**Analog:** `tests/e2e/calendar/known-bugs.spec.ts`

**成对写法**（第 1-6 行注释 + 第 22-62 行）：共享一个准备函数，对照用例（不带标记）断言前提，标记用例走相同准备与触发、只断言一条期望。标题格式 `BUG-01 B2 control: ...` / `BUG-01 B2 expected: ...`。
```typescript
test.describe('BUG-01 B2 ...', () => {
  async function importAndCancel(page: Page, app: AppHarness) { /* open + dialog.dismiss + setInputFiles */ }
  test('BUG-01 B2 control: ...', async ({ page, app }) => { /* 前提：确认框确实出现过，数据没变 */ });
  test('BUG-01 B2 expected: ...', async ({ page, app }) => {
    knownBug('B2', '取消导入后再选同一个文件没有反应');   // 第 55 行的写法
    ...
    await expect(page.locator('#importJson')).toHaveValue('', { timeout: 2_000 });
  });
});
```
- `knownBug` 签名：`knownBug(id, summary, opts: { fixme?: string } = {})`（test.ts 第 192 行）。只有 spike 确实无法稳定复现才用 `{ fixme: '原因' }`。
- **B2 spike（D-01）：** 先在本地不带标记跑一次，确认取消后 `#importJson` 的 `value` 不为空（应用在取消路径 `return` 掉了 `e.target.value=""`）。`input[type=file]` 的 `value` 在 Playwright 的 `setInputFiles` 后通常是 `C:\fakepath\<文件名>`，这就是可断言的现象。结论写进 `tests/PROBES.md` 或 KNOWN-BUGS.md 现状列。
- **N3：** 对照用例：导入 `{}`（buffer `Buffer.from('{}')`）→ 断言确认框出现过（dialog message 等于 `CONFIRM_IMPORT`）。标记用例：同样准备、接受确认框，再断言选定的一条期望（二选一）：`fixture 的合成记录仍然存在`（`app.expectSaved` 太弱，建议读 `app.saved()`），或出现格式错误 toast。建议选“fixture 的合成记录（例如 `synth-full-04`）仍存在于保存状态”，因为不依赖 toast 时序。用 `await expect.poll(...)` 并设 `timeout: 2_000`，不要用固定 sleep。

---

### `tests/e2e/narrow/narrow.spec.ts`（test，读计算样式）

**Analog:** `tests/e2e/editor/edit-entry.spec.ts`（弹窗开局）、`tests/support/editor.ts`（`expectOpen`、`dialog`）、`tests/support/calendar.ts`（`page.evaluate` 读回风格）

**视口声明（D-12）：** 文件顶层 `test.use({ viewport: { width: 520, height: 900 } })`；不用设备描述符。

**断言方式：** 全部用 `page.evaluate` 读 `getComputedStyle` 或 `getBoundingClientRect`，不靠截图。
- **编辑弹窗是底部面板**（应用 CSS 约 213 行，`@media (max-width:560px) dialog#editor{margin:auto 0 0;width:100vw;...}`）：先点一条合成记录打开弹窗，`expectOpen()`，再读 `rect = dialog.getBoundingClientRect()`，断言 `Math.abs(rect.width - innerWidth) <= 1` 且 `Math.abs(rect.bottom - innerHeight) <= 1`。
- **日历 chip 是圆点**（约 146-152 行 `.chip{font-size:0;height:7px;width:7px;...}`）：`gotoCalendar` 后读第一个 `.chip` 的 `fontSize === '0px'`、`rect.width/height` 约 7。只读样式，不读文字。
- **本周日期纵向排列**（900px 以下 `.days` 一列）：读 `#days [data-wday]` 的 rect，断言所有 x 相同、y 严格递增，且 `getComputedStyle(days).gridTemplateColumns` 只有一列。
- **选中某天后滚动到“记一笔”**（`pickDay` 约 610 行：`innerWidth<=900` 时 `$("wkComp").scrollIntoView({behavior:"smooth",block:"start"})`）：点击 `#days [data-wday="…"]`，再 `await expect.poll(() => page.evaluate(() => document.querySelector('#wkComp')!.getBoundingClientRect().top)).toBeLessThan(innerHeight 阈值)`（平滑滚动，不用固定 sleep）。点击前先确认 `#wkComp` 起始在视口外，否则用例证明不了滚动。
- 点日期时避开 `.x`（`$("days")` 的点击处理会忽略 `.x`）。

D-13：整个文件控制在 4 条左右，不重复其他视图的完整断言。

---

### `tests/support/strings.ts`（加常量）

**Analog:** 同文件第 51、155 行：
```typescript
export const TIMELINE_EMPTY = '还没有内容。在“本周”里写下今天做过的事。';
export const TOAST_RESTORED = '已恢复';
```
新增（值取自应用固定界面文案，约 529-541、656-658 行，不含个人计划文字）：确认框文案 `CONFIRM_IMPORT`、格式错误 toast（如 `TOAST_IMPORT_BAD_FORMAT`）、筛选名 `FILTER_ALL`、`FILTER_DONE_TASKS`（类别名复用 `CATEGORY_NAMES`）。第 144、173 行已有 `完成的计划` 的两个常量，可对照但语义不同，新增筛选常量更清晰。

---

### `tests/KNOWN-BUGS.md`（加 B2、N3 两行）

**Analog:** 同文件第 23 行 N1（长行写法）。列：编号 | CONCERNS.md 出处 | 对照用例 | 标记用例 | 期望行为 | 现状。
- 每行以 `| <编号> |` 开头；用例标题用反引号括起，必须与 spec 里的标题逐字相同（第 16 行的护栏说明；`tests/e2e/platform/known-bugs-registry.spec.ts` 双向核对）。
- N3 行照 N1 的写法：注明 CONCERNS.md 没有单独条目，最接近的是导入校验过浅（research 的 B8），并保留 FEATURES.md 已知 bug 对照表里 N3 的出处。
- 第 28-30 行的“以后的阶段”一节改成里程碑收尾时状态（D-15）：已覆盖 B1、B2、B4、N1（部分）、N3 等；仍未验证 N1 的拖拽和改抵达日期触发、B3、B5-B10。

---

## Shared Patterns

### 隐私读回（D-07）
**Source:** `tests/support/calendar.ts` 第 1-7 行注释和 `readDayPanel`
**Apply to:** `timeline.ts`、`timeline.spec.ts`、`narrow.spec.ts`
只在 `page.evaluate` 里读 id、类名、日期、数量；完成计划条目和日历 chip 的文字是个人原文，不读、不文字断言、不 `toBeVisible`。失败信息里只允许出现合成文字。

### 开局
**Source:** `tests/e2e/calendar/known-bugs.spec.ts` 第 25-26 行
**Apply to:** 全部新 spec
```typescript
await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
await app.expectAccountMode();
```
同一页面只能 `open` 一次。`spec` 只从 `tests/support/test.ts` 导入 `test`、`expect`、`knownBug`、`Page`。

### 保存断言与手动时钟
**Source:** `tests/e2e/io/export.spec.ts` 第 144-146 行；`tests/e2e/editor/delete-entry.spec.ts` 第 16 行
**Apply to:** `import.spec.ts`
`await app.expectSaved((s) => ..., '消息')`；需要推进计时器时 `test.use({ clockMode: 'manual' })`，不与 `setFixedTime` 混用。

### toast 断言
**Source:** `tests/support/toast.ts`（`expectToast`、`expectToastPrefix`、`expectToastContains`、`expectUndoOffered`、`expectToastGone`）
**Apply to:** `import.spec.ts`、`known-bugs`

### 已知 bug 成对写法
**Source:** `tests/e2e/calendar/known-bugs.spec.ts` 第 1-6、22-62 行
**Apply to:** B2、N3 用例。对照用例只断言与 bug 无关的前提，标记用例只断言一条期望，两者共用准备函数。

### 测试标题
英文，以需求编号开头（`TL-01`、`TL-02`、`IO-04`、`IO-05`、`RESP-01`、已知 bug 用 `BUG-01 <编号> control:|expected:`）；注释和文档用中文。

### 收尾运行（D-16）
`node tools/test-report/check-report.mjs --min-expected <总数>`：拒绝 flaky、跳过和部分运行。只跑一次全套，低优先级、1 个 worker，不跑除 `npx --no playwright` 外的 npx。另核对应用文件 sha256 等于基线（`tests/e2e/platform/app-integrity.spec.ts` 已覆盖）、隐私检查（`tools/privacy/privacy-check.mjs`）。

## No Analog Found

| 内容 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| `setInputFiles` 内存 buffer 加 `page.once('dialog')` | test | file-I/O | 仓库里还没有任何文件上传或 dialog 处理用例；写法见上方 import.spec.ts 一节（Playwright 官方 API）。`MALFORMED_IMPORTS` 的头注释已说明 Phase 5 用 buffer 形式传入 |
| `test.use({ viewport })` 窄屏 | test | - | 其他 spec 只用 `clockMode`；`viewport` 是 Playwright 内置选项，直接用 |
| 读取 `getComputedStyle`/`getBoundingClientRect` 的断言 | test | - | 现有 helper 只读类名和属性；风格沿用 `calendar.ts` 的 `page.evaluate` 读回，不持有元素句柄 |

## Metadata

**Analog search scope:** `tests/support`、`tests/e2e`、`tests/fixtures`、`tests/KNOWN-BUGS.md`、`tools/test-report`；应用只用 grep 和定向行号读取（529-541、608-611、146-153、213、654-658）。
**Files scanned:** 约 14
**Pattern extraction date:** 2026-11-03
