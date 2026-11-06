# Phase 3: 记一笔、编辑弹窗与本周视图 - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 13（新建 11，修改 2 加文档）
**Analogs found:** 13 / 13（全部在 git 跟踪的 `tests/` 下，已核对）

约定：所有路径为仓库相对路径。应用 `us-journey-tracker.html` 只引用行号和选择器，不抄 CATS / GROUPS / LIFTS 里的任何文字。

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最近类比 | 匹配度 |
|---|---|---|---|---|
| `tests/support/composer.ts` | helper（页面对象） | request-response（DOM 操作） | `tests/support/app.ts`（纯模块、只依赖 playwright 和 strings） | role-match |
| `tests/support/editor.ts` | helper | request-response | `tests/support/app.ts` | role-match |
| `tests/support/toast.ts` | helper | request-response | `tests/support/app.ts` | role-match |
| `tests/support/app.ts`（改：加 `expectSaved`、`saved`） | helper | CRUD（读落盘） | 同文件 `persisted` / `expectPersisted`（第 107-145 行） | exact |
| `tests/support/strings.ts`（改：加文案） | config | - | 同文件 | exact |
| `tests/support/expect-from-fixture.ts`（改：加周统计、7 天列推导） | utility | transform | 同文件 `logsInWeek`、`taskBuckets` | exact |
| `tests/e2e/week/*.spec.ts`（WEEK-01..06） | test | request-response + 拖放 | `tests/e2e/storage/account-mode.spec.ts`、`tests/e2e/platform/probes.spec.ts`（PROBE-5 拖放） | role-match |
| `tests/e2e/editor/*.spec.ts`（EDIT-01..03） | test | CRUD | `tests/e2e/storage/account-mode.spec.ts` | role-match |
| `tests/e2e/week/known-bugs.spec.ts`（B1/N1/B4 成对用例） | test | request-response | 无 `test.fail` 先例，见 No Analog | no-analog |
| `tests/KNOWN-BUGS.md` | doc | - | `tests/PROBES.md`（表格登记） | role-match |
| `tests/README.md`（改） | doc | - | 同文件 | exact |
| `tests/PROBES.md`（改：记拖放结论） | doc | - | 同文件 | exact |
| 可选护栏用例（known-bug 必须登记） | test | file-I/O | `tests/e2e/platform/repo-hygiene.spec.ts` | role-match |

## Pattern Assignments

### `tests/support/composer.ts`（helper，DOM 操作）

**类比:** `tests/support/app.ts`
**导入约束**（`app.ts` 第 1-3 行）：只能从 `@playwright/test` 导入，不能从 `./test` 导入，否则循环引用。

```typescript
import { expect, type Page } from '@playwright/test';
import { ... } from './strings';
```

**应用侧集成点**（只给选择器和行号）：
- 两个实例：周视图根节点 `#wkComp`（第 267 行容器，`#w-text`、`#w-add`），日历日面板根节点 `#dayPanel`（第 280 行容器，第 499 行 `renderDay` 里的 `composer("c", sel)`），里面是 `#c-text`、`#c-add`。选择器统一是 `#${p}-text`、`#${p}-add`、`#${p}-padd`（第 396、405-406 行）。
- 类别按钮：`[data-ccat="${p}|<类别名>"]`（第 ~392 行 `.seg`），当前类别用 `aria-pressed="true"`。
- 预设：`[data-preset="${p}|<标签>"]`；编辑模式按钮 `[data-pedit="${p}"]`，删除 `[data-pdel="${p}|<标签>"]`，新增输入 `#${p}-padd`（回车添加，maxlength 30）。
- 以 `：` 或 `:` 结尾的预设只预填（`fills`，第 ~399 行），否则直接 `addLog` 并弹“已记录：...”toast（第 419 行）。
- 提交：`#${p}-add` 点击，或 `#${p}-text` 里 Ctrl+Enter（第 409-411 行）；空白文本时按钮 `disabled`。

**建议的 API 形状**（D-07）：

```typescript
export function composer(page: Page, p: 'w' | 'c') {
  const root = page.locator(p === 'w' ? '#wkComp' : '#dayPanel');
  const text = root.locator(`#${p}-text`);
  return {
    text, addButton: root.locator(`#${p}-add`),
    async pickCategory(name: string) { await root.locator(`[data-ccat="${p}|${name}"]`).click(); },
    async type(s: string) { await text.fill(s); },
    async submit(how: 'click' | 'keyboard' = 'click') { /* click #${p}-add 或 text.press('Control+Enter') */ },
    // 按序号的预设操作（clickPreset、deletePreset、presetText、presetIndexes）都用 page.evaluate 在页面内完成，
    // 不经定位器动作：定位器动作失败时调用日志会打印元素预览（含 data-preset 和标签文字）。见 03-01 Task 2。
    async draft() { return text.inputValue(); },
  };
}
```

**脱敏约定（D-14）：** 预设文字只在运行时从 DOM 读（`textContent`），用 `endsWith('：')` 判断预填/直记；断言用布尔或计数，失败 message 不带预设原文。新增标签用 `SYNTH-` 前缀。脱敏还要覆盖 Playwright 的调用日志：动作和单元素断言失败时会打印命中元素和遮挡元素的预览（属性加短文字），所以内置预设按钮和删除按钮只用 `toHaveCount` 计数，点选、删除和读取都在页面内用 `page.evaluate` 完成（规划修订时在本机 `@playwright/test@1.64.1` 源码里核对过）。

---

### `tests/support/editor.ts`、`tests/support/toast.ts`

**类比:** `tests/support/app.ts` 的结构（类/函数加中文注释，只依赖 playwright 和 strings）。

**应用侧集成点：**
- 对话框 `dialog#editor`，表单 `#ed-form`（第 294 行）。
- 记录入口 `[data-edit="<id>"]`（周第 468 行；日历第 501 行；时间线第 533 行带 `attr`）；完成计划入口 `[data-edittask="<id>"]`（第 469、502 行）。Enter/Space 也能打开（第 553 行）。
- 记录编辑：`#ed-text`、`#ed-date`、类别 `[data-edcat]`、`#ed-del`、`#ed-cancel`、`#ed-save`（第 564-568 行）。Ctrl+Enter 在 `#ed-text` 里保存（第 570 行附近）。
- 空文本保存：不关弹窗，toast“内容不能为空，想删掉请点“删除””（第 576 行）。
- 完成计划编辑：`#ed-date`、`#ed-save`、`#ed-undone`（第 584-591 行），toast“已保存”“已改回未完成”。
- 保存后 toast 区分是否改了日期：“已保存，移到 ...”（第 578 行）。
- 删除：`#ed-del` 先 `close()` 再 `deleteLog`，toast 带撤销按钮（第 549 行：`toast("已删除这条记录",{label:"撤销",fn})`，撤销后再弹“已恢复”）。

**toast 结构**（第 660-662 行）：`#toast` 里一个 `<span>` 加可选 `<button>`，`.on` 类表示显示，`.act` 表示带操作。

```typescript
// D-04：用 .on 类判断，不用可见性。D-14：toast 文字可能带内置预设原文，
// 所以用 page.evaluate 读回、在 Node 侧比较，失败消息只含期望值（定位器断言会打印 Received）。
async function readToast(page: Page) {
  return page.evaluate(() => {
    const t = document.querySelector('#toast');
    return { on: !!t?.classList.contains('on'), act: !!t?.classList.contains('act'),
             text: t?.querySelector('span')?.textContent ?? '', button: t?.querySelector('button')?.textContent ?? null };
  });
}
export async function expectToast(page: Page, text: string) {
  await expect.poll(async () => { const t = await readToast(page); return t.on && t.text === text; },
    { message: `toast 没有显示期望的文案：${text}（实际内容已隐藏）` }).toBe(true);
}
export async function undo(page: Page) {
  /* 先轮询 on、act 和按钮文字，再点 #toast.act button */
}
```

文案（如“已保存”“已删除这条记录”“已恢复”“已改回未完成”“内容不能为空...”）一律加进 `tests/support/strings.ts`，写法照第 8-9 行：

```typescript
// 记录一条后弹出的 toast 文案
export const TOAST_RECORDED = '已记录';
```

---

### `tests/support/app.ts`（改：`expectSaved`、`saved`）

**类比:** 同文件第 107-145 行。`expectSaved` 基本是 `expectPersisted` 的升级：已有 `persisted()` 同时覆盖账户和本地两种模式，所以新方法复用它。

```typescript
// 现有（第 107-115、138-145 行）
async persisted(): Promise<any> {
  if (this.store === 'account') return this.backend.lastState();
  const raw = await this.page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
  return raw === null ? null : JSON.parse(raw);
}
async expectPersisted(predicate: (state: any) => boolean, message = '等待保存落盘') {
  const check = async () => { const state = await this.persisted(); return state === null ? false : predicate(state); };
  await expect.poll(check, { message }).toBe(true);
}
```

规划建议：`saved()` 即 `persisted()` 的别名（D-09 要求“没有保存过返回 null”，已满足）；`expectSaved(predicate, message?)` 委托 `expectPersisted`，或把 `expectPersisted` 改名并保留旧名以免动 Phase 2 的 spec（先 grep 引用）。`expect.poll` 的 message 默认值不要带状态内容。
“写入次数不变”的断言读 `app.backend.writes.length`（见 `tests/e2e/storage/account-mode.spec.ts` 第 38 行用 `app.backend.writes`）。

---

### `tests/support/expect-from-fixture.ts`（改：补推导函数）

**类比:** 同文件 `logsInWeek`（第 8-10 行）、`taskBuckets`（第 22-34 行）、`expectedCategory`。

```typescript
export type SynthLog = { id: string; date: string; text: string; cat: string };
export function logsInWeek(state: { logs: SynthLog[] }, start: string, end: string): SynthLog[] {
  return state.logs.filter((l) => l.date >= start && l.date <= end);
}
```

需要新增的纯函数（不导入应用代码，规则独立写出）：
- `weekCountsByCategory(state, start, end)`：每个类别在该周的条数（WEEK 统计格），类别顺序用 `CATEGORY_NAMES`。
- `logsByDay(state, weekStart)`：7 天各自的记录列，保持 fixture 顺序。
- 需要周范围时用 `strings.ts` 的 `WEEK_RANGE_FROZEN`（冻结日 2026-03-18，周一是 2026-03-16，`FROZEN_TODAY` 来自 `constants.ts` 第 25 行）。

fixture 的周是 03-16..03-22（`tests/fixtures/full-state.json`，用 `loadFixture`，见 `tests/support/fixture-files.ts`）。用例里不抄数字。

---

### `tests/e2e/week/*.spec.ts`（WEEK-01..06）

**类比:** `tests/e2e/storage/account-mode.spec.ts`（导入、账户模式开局、选择器、`expectPersisted`）。

**导入与开局**（第 1-5、19-23 行）：

```typescript
import { test, expect } from '../../support/test';
import { FROZEN_TODAY } from '../../support/constants';

test('WEEK-01 ...', async ({ page, app }) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') }); // D-10
  await app.expectAccountMode();
  await expect(page.locator('#tab-wk [data-wday="2026-03-17"] [data-edit]')).toBeVisible();
```

**选择器**（同 spec 第 27、31-32、50 行）：`#tab-wk [data-wday="YYYY-MM-DD"] [data-edit]`；周导航 `#wkPrev`、`#wkNext`、`#wkNow`（第 606-608 行）；复盘 `#review`（第 264 行）。点日期列等于 `pickDay`（第 610-611 行），会 `renderWeek()`。

**拖放（D-02、WEEK 拖动）：** 直接抄 `tests/e2e/platform/probes.spec.ts` 的 PROBE-5（结论“通过（方案 A）”，`dragTo` 可用）。执行者先 Read PROBE-5 的用例体复制，不要重新探。应用侧：`dragstart` 取 `[data-edit]` 的 id 存入 `dragId`，`drop` 在 `[data-wday]` 上改 `l.date`、`persist`、`renderAll`、toast“已移到 ...”（第 598-605 行）。断言 `app.expectSaved` 里该记录 `date` 已变（Specifics）。dragTo 就够用，因此不会出现合成事件注释。

**复盘（WEEK 复盘 + D-03/D-15）：** `#review` 的 `input` 先 800 ms 防抖写 state，再 `persist` 600 ms 防抖（第 613 行）。`renderWeek` 在 `#review` 非焦点时用 state 覆盖其值（第 472 行）。正常用例：填入后 `expectSaved` 再做别的事。证明“空文本不保存”和防抖边界的用例使用 `test.use({ clockMode: 'manual' })` 加 `page.clock.install()` 再 `runFor`（见 `tests/support/test.ts` 第 51-54、163-173 行；D-05 不与 `setFixedTime` 混用）。

---

### `tests/e2e/editor/*.spec.ts`（EDIT-01..03）

**类比:** 同上，加 `tests/support/editor.ts` 和 `toast.ts`。

- EDIT-01（D-16）：三个入口各点一条记录（周 `#tab-wk [data-edit]`，日历 `#tab-cal ... [data-edit]`，时间线 `#tab-tl ... [data-edit]`，选择器由执行者核对），修改文字/类别/日期保存后，用 `data-tab` 切换三个视图（`TAB_LABELS` 在 `strings.ts` 第 15 行；标签按钮属性 `[data-tab]`，第 545-546 行）逐个断言，并 `app.expectSaved`。
- EDIT-02（D-17）：删除，toast 出现撤销按钮，点后记录恢复，`expectSaved` 看到记录回到原下标附近（第 549 行 splice 回原位）；空文本保存用 `clockMode: 'manual'`。
- EDIT-03：只编辑合成的已完成自定义计划 `c-synth-2`（内置计划走同一个 `openTaskEditor`，但弹窗和条目会显示个人计划原文，所以不打开内置计划的弹窗，见 03-03 计划的 prohibition），断言保存后 `tasks[id].doneDate` 或 `done: false` 且 `doneDate: ""`（第 590-591 行）。

---

### `tests/e2e/week/known-bugs.spec.ts`（BUG-01：B1、N1、B4）

**类比:** 无。见 No Analog Found。结构由 D-11 规定：每个 bug 一个 `test.describe`，里面两条用例。

```typescript
test.describe('B1 week draft is cleared when picking another day', () => {
  test('B1 control: draft is typed and another day button is clickable', async ({ page, app }) => { /* 同样准备，断言前提 */ });
  test('B1 expected: draft survives picking another day', async ({ page, app }) => {
    test.fail();
    test.info().annotations.push({ type: 'known-bug', description: 'B1：本周点另一天后草稿被清空' });
    /* 同样准备 + 触发，只断言 #w-text 草稿仍在且 #w-add 可用 */
  });
});
```

**应用侧成因**（用于对照用例的前提断言）：
- B1/N1：`pickDay` 调 `renderWeek()`（第 610 行）重建 `#wkComp`，草稿随之丢失；“直接记录”预设走 `addLog`（第 419 行）后 `renderAll()`。`bindComposer` 里只有切类别时的 `refresh` 会保留草稿（第 413 行 `keep`），说明期望行为有先例。
- B4：复盘 800 ms 防抖里立刻 `app.reload()`，state 尚未写入（第 613 行），末尾内容丢失。注意是否有 `pagehide` flush 只处理已入 state 的内容。

执行者必须先确认每个 bug 在当前应用上可复现，不能复现的改 `test.fixme` 并写原因（D-13）。

---

### `tests/KNOWN-BUGS.md`

**类比:** `tests/PROBES.md`（中文、表格、“结论总表”的列设计：编号 / 用例标题 / 结论 / 证据）。列按 D-12：编号、`.planning/codebase/CONCERNS.md` 出处、对照用例标题、`test.fail`/`test.fixme` 用例标题、期望行为、现状。内容不含任何应用个人文字。

可选护栏用例参考 `tests/e2e/platform/repo-hygiene.spec.ts`（读仓库文件做自检的写法）：扫描 `tests/e2e/**/*.spec.ts` 里的 `known-bug` 注解描述，要求都能在 `KNOWN-BUGS.md` 里找到编号。

---

### `tests/README.md`、`tests/PROBES.md`（改）

- README：照现有章节加“helper 用法（composer / editor / toast / expectSaved）”和“已知 bug 约定（成对用例、`known-bug` 注解、登记表）”。同时更新第 5 节目录结构表。
- PROBES.md：只有改用合成事件时才需要记 D-02 结论；PROBE-5 已证明 `dragTo` 可用，可加一行说明 Phase 3 沿用方案 A。

## Shared Patterns

### 唯一导入出口
**Source:** `tests/support/test.ts` 第 1-4、66-181 行
**Apply to:** 所有新 spec
spec 只从 `../../support/test` 导入 `test`、`expect`、类型。helper 文件不从 `./test` 导入（`app.ts` 第 2 行注释说明）。`guard` 和 `frozenClock` 是 auto fixture：任何页面错误、外部请求都会让用例失败，不要放宽，需要豁免时用 `guard.remove(kind, match)`（第 27-31 行）。

### 时钟
**Source:** `tests/support/test.ts` 第 51-54、163-173 行
默认 `setFixedTime(FROZEN_NOW)`；需要推进定时器时在 describe 或文件顶部 `test.use({ clockMode: 'manual' })`，再自己 `page.clock.install()`。同一用例不混用（D-05）。固定时钟下 `expect.poll` 照常工作（PROBE-4、PROBE-3）。

### 保存断言用 poll，不用 sleep
**Source:** `tests/support/app.ts` 第 138-145 行
**Apply to:** 所有写入后的断言（D-09、D-15）。“没有保存”的证明用 manual 时钟推进 600/800 ms 后比较 `app.backend.writes.length`，不用固定 sleep。

### 账户模式开局
**Source:** `tests/e2e/storage/account-mode.spec.ts` 第 19-23 行
`await app.open({ mode: 'account', seed })` 然后 `await app.expectAccountMode()`；每个用例只能调用一次 `open()`（`app.ts` 第 55-58 行），reload 用 `app.reload()`。

### 失败输出脱敏（Phase 2 审查约定）
**Source:** `tests/support/expect-from-fixture.ts` 第 77-126 行（`maskTaskTexts`、`csvMismatch`）
**Apply to:** 任何会带上内置预设标签或任务原文的断言。
做法：布尔或计数断言；必须比较文字时先 `maskTaskTexts` 或只输出 id/序号；`expect(...)` 的自定义 message 不拼接文字；合成文本一律 `SYNTH-` 开头（见 `account-mode.spec.ts` 第 8-10 行）。预设标签原文不写进任何文件、注解、SUMMARY。打印出来的失败输出还包括 Playwright 的调用日志（`locator resolved to <元素预览>`、遮挡元素的预览、strict mode 报错列出的元素），只有 `toHaveCount` 的日志只写个数：属性或文字带个人计划原文的元素不做 Playwright 动作和单元素断言，只计数或用 `page.evaluate` 读回序号、布尔。

### 中文注释与英文标题
**Source:** `tests/e2e/storage/account-mode.spec.ts` 第 19、57-61 行
标题英文、以需求编号开头（`WEEK-01 ...`、`B1 ...`）；注释中文；界面文案只来自 `strings.ts`。

## No Analog Found

| 文件 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| `tests/e2e/week/known-bugs.spec.ts` | test | request-response | 仓库里没有 `test.fail`、`test.fixme`、`known-bug` 注解的先例（已 grep `tests/`）。按 D-11 和 Playwright 文档写；注意 `test.fail()` 要在用例体内第一句调用。 |
| 日历日面板 composer 根节点 | helper | DOM | `c` 实例的容器是 `#dayPanel`（第 280 行；第 499 行 `renderDay` 生成 `composer("c", sel)`，第 437 行 `rerenderComp` 也走 `renderDay`），没有现成 spec 用过。Phase 3 只要求参数化，不写日历用例。 |

## Metadata

**Analog search scope:** `tests/support/`、`tests/e2e/**`、`tests/PROBES.md`、`tests/README.md`；应用只按 grep 加行号区间读（约第 260-267、389-437、468-472、533、545-662 行）。
**Files scanned:** 约 16 个测试侧文件，加应用若干行区间。
**Pattern extraction date:** 2026-11-03
