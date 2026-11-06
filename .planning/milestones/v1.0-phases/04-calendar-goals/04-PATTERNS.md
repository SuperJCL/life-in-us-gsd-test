# Phase 4: 日历与目标视图 - Pattern Map

**Mapped:** 2026-11-03
**Files analyzed:** 14（新建 8，修改 6）
**Analogs found:** 14 / 14（全部是 git 跟踪的 `tests/` 文件，已用 `git ls-files` 核对 `tests/support` 下各文件）

约定：路径均为仓库相对路径。应用 `us-journey-tracker.html` 只引用行号和选择器，不抄 CATS / GROUPS / LIFTS 里的任何文字（预设标签、任务原文、力量名称、目标数值、备注）。没有读过约 298-330 行。

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最近类比 | 匹配度 |
|---|---|---|---|---|
| `tests/e2e/calendar/grid.spec.ts`（CAL-01 网格、chips、+N） | test | request-response（读 DOM 对比推导值） | `tests/e2e/week/week-view.spec.ts` | role-match |
| `tests/e2e/calendar/navigation.spec.ts`（CAL-02） | test | request-response | `tests/e2e/week/week-view.spec.ts` | role-match |
| `tests/e2e/calendar/day-panel.spec.ts`（CAL-03、CAL-04） | test | CRUD | `tests/e2e/editor/delete-entry.spec.ts`、`tests/e2e/week/composer.spec.ts` | role-match |
| `tests/e2e/calendar/known-bugs.spec.ts`（B1 日面板一对、可选 N1 删除触发） | test | request-response | `tests/e2e/week/known-bugs.spec.ts` | exact |
| `tests/e2e/calendar/undo-expiry.spec.ts`（D-11，也可并入 day-panel） | test | event-driven（计时器） | `tests/e2e/editor/delete-entry.spec.ts` 第 13-60 行 | exact |
| `tests/e2e/goals/overview.spec.ts`（GOAL-01） | test | request-response | `tests/e2e/data/synthetic-data.spec.ts`（DATA-01 查 task id） | role-match |
| `tests/e2e/goals/lifts.spec.ts`（GOAL-02） | test | CRUD | `tests/e2e/editor/delete-entry.spec.ts`（manual 时钟加写入次数） | role-match |
| `tests/e2e/goals/tasks.spec.ts`（GOAL-03、04、05） | test | CRUD | `tests/e2e/editor/task-editor.spec.ts` | role-match |
| `tests/support/expect-from-fixture.ts`（改：加 `monthGrid`、`eventsOnDate`、目标组推导） | utility | transform | 同文件 `ymdAddDays`/`mondayOf`（第 197-206 行）、`taskBuckets`、`dayAriaLabel`（第 288 行） | exact |
| `tests/support/strings.ts`（改：加日历、目标文案） | config | - | 同文件 | exact |
| `tests/support/task-ids.ts`（改，仅在需要新 id 时） | config | - | 同文件 | exact |
| `tests/KNOWN-BUGS.md`（改：B1 行补日历实例，可选 N1 新触发） | doc | - | 同文件 B1/N1 行 | exact |
| `tests/README.md`（改：IN-08、两个新目录） | doc | - | 同文件 | exact |
| `tests/fixtures/full-state.json`（大概率不用改，见下） | fixture | - | 同文件 | exact |

## 应用侧集成点（只给行号和选择器）

**renderCal（481-494）：** 标题 `#monthTitle`（文本形如 `Y 年 M 月`）；表头 `#dow .dow`（`WD` 顺序，周日在前）；格子 `#grid button.cell[data-date="YYYY-MM-DD"]`，类为 `out`（非当月）、`today`、`sel`、`arr`（等于 `state.arrival`）。格子内 `.d`（日号）、`.chips` 里最多 3 个 `.chip`（顺序：记录 `.chip.k-*`、到期 `.chip.due`、完成 `.chip.done`），超出时 `.more` 显示 `+N`（N = 总数 - 3）。`aria-label` 为 `M月D日，N 条记录，N 项到期，N 项完成`。循环规则：从当月 1 日所在周的周日开始，`i===35` 且该格不在当月时停止，所以只有 35 或 42 格。

**renderDay（495-505）：** 根节点 `#dayPanel`，标题 `h3` 为 `M月D日 周X`，`.sub` 为 `来美国第 N 天` 或 `YYYY 年`，然后是 composer（`c` 实例）。分区标题 `.sect`：`做过的事`（必有；无记录时 `p.empty`“这天还没有记录。”）、`完成的计划`（仅有完成项时才出现）、`这天到期`（仅有到期项时才出现）。记录 `li[data-edit]`，里面的删除按钮 `button[data-dellog]`；完成项 `li[data-edittask]`（带任务原文，只计数）；到期项 `li.k-job`（无 data 属性，带任务原文，只计数）。

**renderGoals（507-527）：** 力量卡 `.lift`（输入 `#lf-<id>` / `[data-lift]`，保存按钮 `[data-liftsave="<id>"]`，开始是 `.hidden`，历史 `.hist`，行 511-516）；组 `.group`（`.cnt` 为 `已完成/总数`，`.bar i` 的 `style.width` 为 `dn/总数*100%`，行 519-521）；任务行里 `[data-task]`、`.tt`、`input[data-due]`、已过期时的 `.od`、仅自定义任务才有的 `button[data-deltask]`（行 525）；添加区 `input[data-addto="P<n>"]` 加 `button[data-addbtn="P<n>"]`（行 526）。

**saveLift（626-630）：** 非数或负数、与当前值相同都不保存，只重绘；新值写入 `cur`，同一天的历史项被替换，否则追加，保留最近 30 条，`persist()`，`renderGoals()`，toast 为 `<名称>达标了`（`v>=target`）或 `<名称>已更新为 <v><单位>`。**addTask（633）：** 去空白后为空则直接返回；否则推入 `state.custom`，id 为 `c-<uid>`。**删除（635）：** 过滤 `state.custom` 并 `delete state.tasks[id]`。**事件（631、636）：** `#goals` 的 `input` 事件使 `[data-liftsave]` 显示；`keydown` Enter 在 `[data-addto]` 里添加，在 `[data-lift]` 里 `preventDefault` 后保存。保存只在点保存或按 Enter，失焦不触发。

## Pattern Assignments

### `tests/e2e/calendar/*.spec.ts`（test，request-response / CRUD）

**类比:** `tests/e2e/week/known-bugs.spec.ts`（开局、composer、toast、knownBug）和 `tests/e2e/editor/delete-entry.spec.ts`（manual 时钟）。

**导入与开局**（known-bugs.spec.ts 第 7-14、21-27 行）：

```typescript
import { test, expect, knownBug } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { composer } from '../../support/composer';
import { FROZEN_NOW, FROZEN_TODAY } from '../../support/constants';
import { expectToast, expectUndoOffered, undo, expectToastGone } from '../../support/toast';
import { loadFixture } from '../../support/fixture-files';

await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
await app.expectAccountMode();
```

切到日历视图用 `[data-tab]` 按钮（标签文字取 `TAB_LABELS.cal`，`strings.ts` 第 15 行）。每个用例只能调用一次 `open()`。

**网格推导（D-01、D-07，新写进 `expect-from-fixture.ts`）：** 沿用该文件的纯 UTC 日期算术（`utcMs`、`ymdAddDays`、`ymdOfMs`），不导入应用代码，规则独立写出。

```typescript
// 现有可复用（expect-from-fixture.ts 第 197-216 行）
export function ymdAddDays(ymd: string, n: number): string { return ymdOfMs(utcMs(ymd) + n * DAY_MS); }
export function mdLabel(ymd: string): string { /* M月D日 */ }
export function weekdayLabel(ymd: string): string { /* 周X */ }
// 第 288 行同形的格子 aria-label 写法可参照 dayAriaLabel：
export function dayAriaLabel(date: string, n: number): string {
  return `${mdLabel(date)}${DAY_ARIA_SEPARATOR}${n}${DAY_ARIA_SUFFIX}`;
}
```

建议新增：
- `monthGrid(year, month)`：返回 `{ date, out }[]`。起点是 1 日减去它的星期数（周日为 0），循环 42 次，`i===35` 且不在当月时 break。
- `eventsOnDate(state, date)`：返回 `{ logs, due, done }` 数量或 id。`logs` 为 `l.date===date`；`due` 为未完成且 `due===date` 的任务（内置加自定义，用 `builtinTaskIds` / `customTasks`，第 58、70 行）；`done` 为 `done` 且 `doneDate===date` 的任务。
- 格子 aria-label 推导：`${mdLabel(date)}，${n} 条记录，${n} 项到期，${n} 项完成`，常量放进 `strings.ts`。

**fixture 已经够用，不需要加合成数据（D-07）：** 2026-03-18（冻结的今天）有 3 条记录，加上 `P2-1` 到期、`P3-1` 在当天完成，共 5 个 chip，会显示 `+2`。2026-01-12（抵达日）有 1 条记录，可用于 `.arr`。2026-03 本身是 35 格（1 日是周日），另选 2026-08 或 2026-05 验证 42 格。做格子数的期望时用 `monthGrid(...).length`，同时用独立断言写死 35 和 42 做路标（D-01 的脚本核对在计划里作为第一步）。本阶段不改 fixture，不用担心 Phase 2/3 的推导用例受影响；若规划者仍要加合成数据，就需要先 grep 依赖 `fixture.logs.length` 的用例（如 `delete-entry.spec.ts` 第 45 行）。

**脱敏（D-05）：** 格子上的 `.chip` 文字（记录原文是合成的，但到期和完成 chip 是任务原文）不做文字断言，只断言 `.chip` 的类序列（读回 `className` 数组在 Node 侧比较）、个数、`.more` 的文字（只是数字）。格子用 `aria-label` 比较（只含数量）。日面板“完成的计划”“这天到期”条目只用 `toHaveCount`。

```typescript
// 读回一个格子的类序列：Node 侧比较，失败消息只含类名
const kinds = await page.evaluate((d) =>
  [...document.querySelectorAll(`#grid [data-date="${d}"] .chip`)].map((c) =>
    c.classList.contains('due') ? 'due' : c.classList.contains('done') ? 'done' : 'log'), date);
```

**导航（D-08）：** 上个月、下个月、今天按钮的选择器由执行者用 grep 核对（`#monthTitle` 周围的按钮，id 类似 `calPrev`/`calNext`/`calNow`，先查再用）。点当月以外的格子用 `[data-date]` 加 `.out`，之后断言 `#monthTitle` 变化和 `.sel`。跨年用 2026-12 到 2027-01（用 `monthTitle` 的 `Y 年 M 月` 常量格式）。

**删除记录和撤销（D-09，CAL-04）：** 点 `[data-dellog]`（按钮 `aria-label` 是固定的“删除这条记录”，没有个人文字，可以直接用定位器点）。断言：编辑弹窗没开（`page.locator('dialog#editor')` 没有 `open` 属性，写法见 known-bugs.spec.ts 第 46 行）；选中日不变；toast 为 `TOAST_LOG_DELETED` 并带撤销；撤销后 `TOAST_RESTORED`。

**manual 时钟模板**（delete-entry.spec.ts 第 15-60 行，直接复制准备部分）：

```typescript
test.describe('CAL-04 undo window on a manual clock', () => {
  test.use({ clockMode: 'manual' });
  test('...', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    // ……触发删除
    await expectUndoOffered(page);
    await page.clock.runFor(1_000);           // 只过 600 ms 防抖，撤销按钮仍在
    await app.expectSaved((s) => /* 记录已删除 */ true, '等待保存后的记录里没有被删除的这条');
    await undo(page);
    await expectToast(page, TOAST_RESTORED);
  });
});
```

**撤销 toast 过期（D-11）：** 同一模板，删除后 `await page.clock.runFor(5_100)`（5000 ms 的 toast 时长，只有一个共享计时器 `tt`），然后 `expectToastGone(page)`（`toast.ts` 第 73-77 行，只看 `.on`），再断言 `#toast.act button` 已不可用。注意 `.act` 类在过期后是否被移除要先在应用上看（行 660-662 的 toast 实现）；若 `.act` 还留着但 `.on` 没了，就用 `.on` 判断为准。删除要 `expectSaved`。同一个用例不混用 `setFixedTime`。

**成对的已知 bug（D-10）：** 逐字照 `tests/e2e/week/known-bugs.spec.ts` 第 19-57 行的结构，把 `composer(page,'w')` 换成 `composer(page,'c')`，触发换成点另一个格子（`#grid [data-date="…"]`，用不是今天且在当月的日期，例如 `2026-03-19`）：

```typescript
test.describe('BUG-01 B1 calendar draft is cleared when picking another cell', () => {
  async function typeDraftThenPickCell(page: Page, app: AppHarness) { /* open、切日历 tab、c.type(DRAFT)、返回 cell 定位器 */ }
  test('BUG-01 B1 calendar control: the day-panel draft is typed and picking another cell moves the selection', ...); // 断言 #c-text 有草稿、点格子后该格 .sel、编辑弹窗没开
  test('BUG-01 B1 calendar expected: the day-panel draft survives picking another cell', async ({ page, app }) => {
    knownBug('B1', '日历日面板输入草稿后点另一个格子，草稿被清空');
    /* 同样准备、触发，只断言 #c-text 草稿仍在、#c-add 可用，timeout 2_000 */
  });
});
```

两条用例的草稿用 `SYNTH-` 开头的合成文字。执行时先去掉 `knownBug` 运行一次，确认失败点是期望断言。

**KNOWN-BUGS.md 登记表（D-10、D-17）：** 登记护栏（`tests/e2e/platform/known-bugs-registry.spec.ts`）双向核对。每行以 `| <编号> |` 开头，用例标题用反引号括起，必须与 spec 标题逐字相同。B1 行现在只有周视图的标题，按 B4 行（第 24 行）“对照用例”一栏用 `；` 分隔多个标题的写法追加日历的对照和标记标题。「以后的阶段」第 30 行“Phase 4：登记日历日面板的 B1 实例”改成已登记。若补 N1 的新触发（目标页勾选任务、日面板删除记录），照 N1 行的写法在“现状”里把对应触发从“未验证”改成已复现，否则 SUMMARY 的“假设”一节写明“未验证”（D-17）。

### `tests/e2e/goals/*.spec.ts`（test，CRUD）

**类比:** `tests/e2e/editor/task-editor.spec.ts`（合成自定义任务加账户模式）、`tests/e2e/data/synthetic-data.spec.ts`（检查内置 id 在目标页存在）。

**id 引用（D-03，`task-ids.ts` 第 1-16 行）：**

```typescript
export const BUILTIN_TASK_IDS = { done: 'P1-1', overdue: 'P1-2', dueToday: 'P2-1', dueFuture: 'P2-2', doneToday: 'P3-1' } as const;
export const LIFT_IDS = ['bench', 'squat'] as const;   // 只是 id，不含名称和目标
```

fixture 里的合成自定义任务是 `c-synth-1`（P2，到期 2026-03-25）、`c-synth-2`（P3，已完成）、`c-synth-3`（P1）。fixture 的 `lifts` 有 `bench`（3 条历史）和 `squat`（1 条历史）。页面上有 4 张力量卡（D-12 要求断言 4 张），另外两张的 id 只能在页面里按序号读，不进仓库。

**GOAL-01（D-12）：** 期望值不复制任务原文，由 fixture 推导。
- 组总数：对每个 `.group`，用 `page.evaluate` 读回 `[data-task]` 的个数和 `.cnt` 文本，在 Node 侧比较 `${done}/${total}`。`done` 来自 fixture 的内置任务（`taskBuckets(...).done` 第 43 行，只数该组前缀 `P<n>-`）加自定义任务（`customTasks`，第 70 行）里 `tasks[id].done` 为真的。`total` 使用 DOM 个数，不写死。
- 进度条：读回 `.bar i` 的 `style.width`，与 `done/total*100` 比较（容许浮点格式，比如先转数字再 `toBeCloseTo`）。
- 失败消息只带组号和数字，不带任务文字（D-05）。

**GOAL-02（D-13）：**
- 输入框用 `#lf-<id>` 改值，`[data-liftsave="<id>"]` 的 `.hidden` 类在 `input` 后消失（用 `LIFT_IDS` 里的 id，卡片名称不碰）。
- 保存：点保存或在输入框按 Enter（行 636，`preventDefault` 已处理）。保存后 `app.expectSaved((s) => s.lifts[id].cur === v)`，并且 `hist` 最后一项的 `date` 为冻结的今天（`FROZEN_TODAY`，同一天替换而非追加，可用已有 hist 末项日期为不同日期的 `squat` 来看追加，用写入后两次保存来看替换，但 30 条上限和同日替换的专门 fixture 属于已推迟的内容，不做）。
- 历史文字：`.hist` 以 `LIFT_HISTORY_PREFIX`（`strings.ts` 第 48 行 “最近：”）开头；比较时在页面内读 `textContent`，Node 侧只断言 `startsWith(前缀)` 和用 `“，”` 分割后的个数不超过 3，不打印文字。
- toast：达标用极大值（例如 `999999`），不达标用小而合法的值（比如大于 0 且小于该项目当前值的数，先在页面里读 `#lf-<id>` 的 `min` 和 `value`）。达标 toast 以后缀 `达标了` 结尾，不达标 toast 含 `已更新为 `，两者都用页面里读回再在 Node 侧做 `endsWith` / `includes`，**不用 `expectToast(page, text)`（会把名称写进失败消息）**。可写一个本地小函数基于 `toast.ts` 的 `expectToastPrefix` 的同样 `expect.poll` 写法，失败消息固定为“toast 后缀不对（内容已隐藏）”。可考虑把 `expectToastSuffix` 加进 `toast.ts`（第 40-51 行 `expectToastPrefix` 是现成模板）。
- 失焦不保存：manual 时钟加写入次数（模板见 delete-entry.spec.ts 第 64-109 行）：改值、`blur()`、`runFor(2_000)`、`writes.length` 不变；再用保存按钮做哨兵写入，证明窗口确实推进了防抖，并确认中间没有多余写入。
- 进度条宽度上限 100%：极大值保存后读 `.lift` 里的进度条 `style.width`，应是 `100%`（在页面内读，比较数字）。

```typescript
// 写入次数不变 + 哨兵（delete-entry.spec.ts 第 77-108 行的核心）
const writesBefore = app.backend.writes.length;
/* 触发 */
await page.clock.runFor(2_000);
expect(app.backend.writes.length).toBe(writesBefore);
/* 哨兵 */
await expect.poll(() => app.backend.writes.some((w) => /* 哨兵条件 */ true), { message: '等待哨兵写入到达 mock' }).toBe(true);
expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
```

**GOAL-03 / GOAL-04（D-14）：**
- 内置任务的操作都用 `page.evaluate` 按 `data-task` id 完成：勾选 = 把 `document.querySelector('[data-task="P1-2"]')` 设为 checked 并派发 `change`/点击（执行者用 grep 核对勾选的事件类型，应是 `#goals` 的 `change` 或 `click` 委托，不要用 Playwright 的 `check()`，因为失败日志会带 `aria-label` 任务原文）。截止日期同理：按 `[data-due="<id>"]` 设置 value 并派发 `change`。
- 断言用 `app.expectSaved`：勾选后 `tasks[id].done === true && tasks[id].doneDate === FROZEN_TODAY`；取消勾选后 `done === false && doneDate === ''` 且 `due` 保持（P3-1 在 fixture 里有 `due`，是理想的取消勾选对象；P1-2 是已过期未完成的）。
- 计数和进度条随之变化：读回 `.cnt` 比较推导值，同 GOAL-01 的做法。
- “已过期”：把一个未完成任务的 `due` 设为早于 `FROZEN_TODAY` 的日期后，该行 `.od` 个数为 1（`toHaveCount`，`GOAL_OVERDUE` 常量在 `strings.ts` 第 45 行，只在页面内读该元素文字做布尔比较，不用文字断言）。fixture 里的 `P1-2`（到期早于今天）本身就是一个现成的已过期样例，用 `.od` 总数对比推导值（`taskBuckets(...).overdue`）。
- 也可以只用合成的自定义任务（`c-synth-1`/`c-synth-3`）做这些动作，它们的文字是 `SYNTH-` 开头的合成文字，可以用定位器。

**GOAL-05（D-15）：**
- `[data-addto="P1"]` 的 `fill('SYNTH-GOAL-05 task')` 后 `press('Enter')`，另一条用例点 `[data-addbtn="P1"]`。断言：`app.expectSaved((s) => s.custom.some((t) => t.text === 'SYNTH-…' && t.group === 'P1'))`，页面上该组 `[data-task]` 个数加 1，且 `.cnt` 的总数加 1。
- 空白文本不添加（`addTask` 第 633 行去空白后直接返回）：`fill('   ')` 后按 Enter，`custom` 长度不变，用 manual 时钟加写入次数证明（同 GOAL-02 失焦用例的模板）。
- 删除：新增的自定义任务的 id 要从 `expectSaved` 读回（`s.custom.find(...)`，id 形如 `c-<uid>`，每次不同），然后点 `[data-deltask="<id>"]`；断言 `s.custom` 里没有它，`s.tasks[id]` 也不存在（第 635 行 `delete state.tasks[d]`）。可以先给它设置一个 `due`，让 `tasks[id]` 存在，再证明删除时一并清掉。fixture 里的 `c-synth-1` 有 `due`，可直接删它来验证 `tasks['c-synth-1']` 被一并删除。
- 内置任务行没有删除按钮：`page.locator('[data-task="P1-1"]').locator('xpath=ancestor::*[contains(@class,"task")][1]').locator('[data-deltask]')` 为 `toHaveCount(0)`；或者用 `page.evaluate` 数 `[data-deltask]` 总数等于 `state.custom.length`（更稳，也不碰原文）。

### `tests/support/expect-from-fixture.ts`（改）

**类比:** 同文件。新增函数都是纯函数、仅依赖 `strings.ts` 常量和同文件的 `utcMs`、`ymdOfMs`，写法照第 197-206 行；注释用中文，函数前一行用一句话说明规则。放在 `weekDayColumns`（第 273 行）、`dayAriaLabel`（第 288 行）一带。建议签名：

```typescript
export function monthGrid(year: number, month: number): { date: string; out: boolean }[]   // month 为 1-12
export function eventsOnDate(state: DayState, date: string): { logs: SynthLog[]; due: string[]; done: string[] }  // 后两个返回任务 id
export function cellAriaLabel(date: string, c: { logs: number; due: number; done: number }): string
export function groupProgress(state: GoalState, group: string, taskIds: string[]): { done: number; total: number; pct: number }
```

### `tests/support/strings.ts`（改）

**类比:** 同文件，一常量一行注释（第 6-9 行风格）。加：月份标题格式（` 年 `、` 月`）、格子 aria-label 片段（`条记录`、`项到期`、`项完成`）、日面板分区标题（做过的事、完成的计划、这天到期、空提示 `这天还没有记录。`）、“今天”按钮和导航按钮的 aria-label（先 grep 确认）、`达标了` 后缀、`已更新为 ` 前缀、添加按钮文字。已有可复用：`GOAL_OVERDUE`、`LIFT_HISTORY_PREFIX`、`TOAST_LOG_DELETED`、`TOAST_RESTORED`、`TOAST_UNDO_LABEL`、`EDITOR_TITLE_*`、`WEEKDAY_CHARS`、`MONTH_SUFFIX`。**不要**把预设标签、任务原文、力量名称加进来。

### `tests/KNOWN-BUGS.md`、`tests/README.md`（改）

- KNOWN-BUGS.md：见上，B1 行追加日历实例；第 5 条约定里的措辞（“一对用例”）保持，或按 D-16 写成“一条或多条对照用例，加一条 `test.fail`”（B4 已经有两条对照）。
- README.md（D-16、IN-08）：手动时钟章节改为三类用途：证明没有保存、撤销窗口和 toast 过期、带计时器的刷新；已知 bug 约定改成“一条或多条对照用例加一条 `test.fail`”；目录结构表加 `tests/e2e/calendar/` 和 `tests/e2e/goals/` 两行，说明每个目录的 spec 列表。先 Read README 现有章节，保持原有的中文风格。

## Shared Patterns

### 唯一导入出口
**Source:** `tests/support/test.ts`（`knownBug` 第 192 行起，`clockMode` option 第 53、68 行，auto fixture `guard` 和 `frozenClock` 第 163-173 行）
**Apply to:** 所有新 spec。spec 只从 `../../support/test` 导入 `test`、`expect`、`knownBug` 和类型；helper 文件不从 `./test` 导入（避免循环引用）。不要放宽 `guard`。

### 保存断言与写入次数
**Source:** `tests/support/app.ts`（`expectSaved`、`saved`、`backend.writes`，见 delete-entry.spec.ts 第 44-47 行用法）
**Apply to:** 所有写入后的断言：`await app.expectSaved((s) => …, '中文提示，不带状态内容')`。“没有保存”的证明用 manual 时钟加 `app.backend.writes.length`，加一次哨兵写入。

### 时钟
**Source:** `tests/support/test.ts`；`tests/e2e/editor/delete-entry.spec.ts` 第 13-26 行
**Apply to:** 撤销过期、失焦不保存、空白添加不保存。`test.use({ clockMode: 'manual' })`，`page.clock.install({ time: FROZEN_NOW })` 在 `app.open` 之前，`pauseAt(FROZEN_NOW + 60_000)` 在 `expectAccountMode` 之后；其余用例用默认的固定时钟，不混用。

### 失败输出脱敏（D-05、Phase 2/3 约定）
**Source:** `tests/support/toast.ts` 第 1-9、40-51 行（`page.evaluate` 读回、Node 侧比较、固定失败消息）；`expect-from-fixture.ts` 的 `maskTaskTexts`（第 102 行）
**Apply to:** 带个人计划文字的元素：内置任务复选框（`aria-label` 是原文）、`.tt`、日历到期和完成 chip、日面板“完成的计划”和“这天到期”条目、力量卡的名称、目标和备注。这些元素不用定位器做动作，也不做文字或可见性断言；用 `toHaveCount`、`page.evaluate` 按 id 或序号操作、Node 侧布尔比较。合成文字一律 `SYNTH-` 开头，才可以直接断言。Playwright 的调用日志也会打印元素预览，所以涉及这些元素的 `click` / `check` / `toBeVisible` 一律换成 `evaluate`。

### 中文注释与英文标题
**Source:** `tests/e2e/week/known-bugs.spec.ts` 第 1-6 行文件头、`describe` / `test` 标题
**Apply to:** 所有新文件。标题英文并以需求编号开头（`CAL-01 …`、`GOAL-02 …`、`BUG-01 B1 calendar …`），注释和文档中文，界面文案只来自 `strings.ts`。文件头用 1-5 行说明覆盖的需求编号和脱敏范围。

### 账户模式开局
**Source:** `tests/e2e/week/known-bugs.spec.ts` 第 22-23 行
**Apply to:** 所有用例：`await app.open({ mode: 'account', seed: loadFixture('full-state.json') }); await app.expectAccountMode();`。

## No Analog Found

| 文件 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| 目标页勾选任务、设置截止日期的页面内 helper | helper | DOM（evaluate） | 现有 spec 没有操作 `[data-task]` 或 `[data-due]` 的先例（`task-editor.spec.ts` 只通过编辑弹窗操作已完成的自定义任务）。规划者需新写页面内 `evaluate` 的小 helper（可放进 `tests/support/goals.ts`，只从 `@playwright/test` 导入，模式照 `composer.ts` 里的 `presetIndexes`、`clickPreset`）。勾选用的事件类型（change 或 click）先 grep `#goals` 的监听确认。 |
| `expectToastSuffix`（可选） | helper | request-response | `toast.ts` 只有 `expectToast` 和 `expectToastPrefix`；照后者写一个后缀版本即可。 |

## Metadata

**Analog search scope:** `tests/support/`、`tests/e2e/{week,editor,storage,data,platform}/`、`tests/KNOWN-BUGS.md`、`tests/fixtures/full-state.json`（只读键、日期和数量，不读文字）；应用只用 grep 加行号区间读（481-505、508-527 的选择器部分、626-636）。
**Files scanned:** 约 12 个测试侧文件，加应用若干行区间。
**Pattern extraction date:** 2026-11-03
