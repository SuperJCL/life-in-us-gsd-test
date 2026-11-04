// 本文件覆盖 GOAL-03（勾选和取消勾选）、GOAL-04（截止日期与已过期）、GOAL-05（自定义待办的添加和删除）。
// 视图用例默认账户模式加完整 fixture（D-06）：组计数、进度条和日历格子的期望全部由“保存后的状态”推导（D-14），
// 不写死任何数字，所以勾选和改日期造成的连带变化（今天的完成数、原来的到期日）都由推导带出来。
// 隐私（D-05）：内置任务的复选框和截止日期框的 aria-label、.tt 都是任务原文，Playwright 的动作和断言失败时会把它们打印出来，
// 所以内置任务一律经 tests/support/goals.ts 的 checkTask、setDue 在页面内按位置 id 操作，用 readTaskRow 读回
// 布尔、日期、固定文案和 id，从不做定位器动作、文字断言或可见性断言。
// 只有合成的自定义任务（c-synth-1 和用例自己新加的 SYNTH- 待办）才用真实的点击和填写：它们的属性和文字都是合成的。
import { test, expect } from '../../support/test';
import { gotoCalendar, readMonth } from '../../support/calendar';
import { checkTask, gotoGoals, readGroups, readTaskRow, setDue } from '../../support/goals';
import { FROZEN_NOW, FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedGroup, expectedMonthCells, mdLabel } from '../../support/expect-from-fixture';
import { GOAL_DONE_ON_PREFIX, GOAL_DUE_LABEL, GOAL_OVERDUE, TOAST_TASK_DONE } from '../../support/strings';
import { BUILTIN_TASK_IDS } from '../../support/task-ids';
import { expectToast } from '../../support/toast';

const groupOf = (id: string) => id.split('-')[0];
const isBuiltinId = (id: string) => /^P\d-\d+$/.test(id);

// 读回全部目标组，并断言每一组都等于由 state 推导的结果；返回读回值。失败消息只含组号、id、计数和数字
async function expectGroupsMatch(page: Parameters<typeof readGroups>[0], state: any) {
  const groups = await readGroups(page);
  const builtinCount = (taskIds: string[]) => taskIds.filter(isBuiltinId).length;
  const expected = groups.map((g) => expectedGroup(state, g.code, builtinCount(g.taskIds), FROZEN_TODAY));
  expect(groups).toEqual(expected);
  return groups;
}

// 切到日历（选中日和月份默认是今天所在的 2026 年 3 月），整月格子等于由 state 推导的结果
async function expectCalendarMatches(page: Parameters<typeof readMonth>[0], state: any) {
  await gotoCalendar(page);
  const { cells } = await readMonth(page);
  expect(cells).toEqual(expectedMonthCells(state, 2026, 3, FROZEN_TODAY, FROZEN_TODAY));
}

test('GOAL-03 checking a built-in task records today as the done date and updates the group count and bar', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  const id = BUILTIN_TASK_IDS.overdue;
  const code = groupOf(id);

  // 前提：fixture 里它未完成、已过期（只读回布尔，不读任务文字）
  const before = await readTaskRow(page, id);
  expect(before.found, `任务 ${id} 应当存在`).toBe(true);
  expect(before.checked).toBe(false);
  expect(before.overdue).toBe(true);

  await checkTask(page, id);
  await expectToast(page, TOAST_TASK_DONE);

  // 保存：done 为真，完成日期是冻结的今天，截止日期保持 fixture 的原值
  const fixtureDue = fixture.tasks[id].due;
  expect(fixtureDue, 'fixture 里该任务应当有截止日期').toBeTruthy();
  await app.expectSaved((s) => {
    const t = s.tasks?.[id];
    return !!t && t.done === true && t.doneDate === FROZEN_TODAY && t.due === fixtureDue;
  }, `等待保存后任务 ${id} 已完成且完成日期是冻结的今天`);
  const saved = await app.saved();

  // 每一组都等于由保存后状态推导的结果；该任务所在的组比 fixture 推导的多一个已完成
  const groups = await expectGroupsMatch(page, saved);
  const group = groups.find((g) => g.code === code);
  expect(group, `应当有 ${code} 组`).toBeDefined();
  const builtinCount = group!.taskIds.filter(isBuiltinId).length;
  const fixtureGroup = expectedGroup(fixture, code, builtinCount, FROZEN_TODAY);
  expect(group!.doneIds.length).toBe(fixtureGroup.doneIds.length + 1);
  expect(group!.doneIds).toContain(id);

  // 任务行：已勾选、带 isdone、截止日期输入框消失、显示“完成于 M月D日”
  const after = await readTaskRow(page, id);
  expect(after.checked).toBe(true);
  expect(after.isdone).toBe(true);
  expect(after.due).toBeNull();
  expect(after.doneOn).toBe(GOAL_DONE_ON_PREFIX + mdLabel(FROZEN_TODAY));

  // 日历：今天那格多一个完成，原来的到期日不再有到期（整月与推导逐格一致）
  await expectCalendarMatches(page, saved);
});

test('GOAL-03 unchecking a done task clears the done date, keeps its due date and shows it as overdue again', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  const id = BUILTIN_TASK_IDS.doneToday;
  const fixtureDue = fixture.tasks[id].due;
  expect(fixtureDue, 'fixture 里该任务应当有早于今天的截止日期').toBeTruthy();
  expect(fixtureDue < FROZEN_TODAY).toBe(true);

  // 前提：它在 fixture 里是已完成
  const before = await readTaskRow(page, id);
  expect(before.found, `任务 ${id} 应当存在`).toBe(true);
  expect(before.isdone).toBe(true);

  // 取消勾选：应用不弹 toast，所以不断言 toast
  await checkTask(page, id);
  await app.expectSaved((s) => {
    const t = s.tasks?.[id];
    return !!t && t.done === false && t.doneDate === '' && t.due === fixtureDue;
  }, `等待保存后任务 ${id} 已取消完成、完成日期为空、截止日期保留`);
  const saved = await app.saved();

  // 任务行：未勾选、不带 isdone，因为截止日期早于今天所以重新显示已过期，截止日期框回到原值
  const after = await readTaskRow(page, id);
  expect(after.checked).toBe(false);
  expect(after.isdone).toBe(false);
  expect(after.overdue).toBe(true);
  expect(after.label).toBe(GOAL_OVERDUE);
  expect(after.due).toBe(fixtureDue);

  // 组计数和日历格子都等于由保存后状态推导的结果（今天那格少一个完成，原来的截止日出现到期）
  await expectGroupsMatch(page, saved);
  await expectCalendarMatches(page, saved);
});

test('GOAL-04 a due date before today marks the task as overdue and a due date of today does not', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  const today = BUILTIN_TASK_IDS.dueToday;
  const future = BUILTIN_TASK_IDS.dueFuture;
  const PAST = '2026-03-01';

  // 前提：截止日期等于今天不算过期，将来的也不算
  const dueToday = await readTaskRow(page, today);
  expect(dueToday.found, `任务 ${today} 应当存在`).toBe(true);
  expect(dueToday.overdue).toBe(false);
  expect(dueToday.label).toBe(GOAL_DUE_LABEL);
  expect(dueToday.due).toBe(FROZEN_TODAY);
  const dueFuture = await readTaskRow(page, future);
  expect(dueFuture.found, `任务 ${future} 应当存在`).toBe(true);
  expect(dueFuture.overdue).toBe(false);

  // 把将来的截止日期改到早于今天
  await setDue(page, future, PAST);
  await app.expectSaved((s) => s.tasks?.[future]?.due === PAST, `等待保存后任务 ${future} 的截止日期是新值`);
  const saved = await app.saved();

  const changed = await readTaskRow(page, future);
  expect(changed.overdue).toBe(true);
  expect(changed.label).toBe(GOAL_OVERDUE);
  expect(changed.due).toBe(PAST);

  // 截止日期是今天的那一行仍然不算过期
  const unchanged = await readTaskRow(page, today);
  expect(unchanged.overdue).toBe(false);
  expect(unchanged.label).toBe(GOAL_DUE_LABEL);

  // 组：已过期的 id 多了一项，由推导带出来
  const groups = await expectGroupsMatch(page, saved);
  expect(groups.flatMap((g) => g.overdueIds)).toContain(future);
  expect(groups.flatMap((g) => g.overdueIds)).not.toContain(today);
});

test('GOAL-04 setting and clearing a due date on a custom todo saves it and moves the due chip in the calendar', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  // c-synth-1 是合成的自定义待办（fixture 里截止日期是 2026-03-25），属性和文字都是合成的，可以真实填写
  const id = 'c-synth-1';
  const dueInput = page.locator(`#goals [data-due="${id}"]`);
  const savedDue = (value: string) =>
    app.expectSaved((s) => s.tasks?.[id]?.due === value, `等待保存后 ${id} 的截止日期是 ${value === '' ? '空字符串' : value}`);

  // 早于今天：已过期
  await dueInput.fill('2026-03-17');
  await savedDue('2026-03-17');
  const past = await readTaskRow(page, id);
  expect(past.overdue).toBe(true);
  expect(past.label).toBe(GOAL_OVERDUE);

  // 晚于今天：不过期；日历里 3 月 19 日有一个到期，3 月 25 日不再有（整月与推导逐格一致）
  await dueInput.fill('2026-03-19');
  await savedDue('2026-03-19');
  const future = await readTaskRow(page, id);
  expect(future.overdue).toBe(false);
  expect(future.label).toBe(GOAL_DUE_LABEL);
  await expectCalendarMatches(page, await app.saved());
  await gotoGoals(page);

  // 清空：保存为空字符串，不过期、输入框为空，日历里再没有它的到期 chip。
  // Playwright 的 fill('') 对日期框会清空并派发 input 和 change，应用的 change 委托据此保存；
  // 下面的 expectSaved 会证明保存确实发生，若某个版本不触发，改用 setDue 的页面内设值加派发 change
  await dueInput.fill('');
  await savedDue('');
  const cleared = await readTaskRow(page, id);
  expect(cleared.overdue).toBe(false);
  expect(cleared.due).toBe('');
  const saved = await app.saved();
  await expectGroupsMatch(page, saved);
  await expectCalendarMatches(page, saved);
});

test('GOAL-05 adding a todo with Enter or the add button creates a custom task in that group and saves it', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  const TEXT_ENTER = 'SYNTH-GOAL05 added with Enter';
  const TEXT_BUTTON = 'SYNTH-GOAL05 added with the button';
  const baseCount = fixture.custom.length;
  const find = (s: any, text: string) => (s.custom ?? []).find((c: any) => c.text === text);

  // P1：填写后按 Enter
  await page.locator('#goals [data-addto="P1"]').fill(TEXT_ENTER);
  await page.locator('#goals [data-addto="P1"]').press('Enter');
  await app.expectSaved((s) => {
    const c = find(s, TEXT_ENTER);
    return s.custom.length === baseCount + 1 && !!c && c.group === 'P1' && /^c-/.test(c.id);
  }, '等待保存后 P1 多了一条用 Enter 添加的待办');

  // P2：填写后点添加按钮
  await page.locator('#goals [data-addto="P2"]').fill(TEXT_BUTTON);
  await page.locator('#goals [data-addbtn="P2"]').click();
  await app.expectSaved((s) => {
    const c = find(s, TEXT_BUTTON);
    return s.custom.length === baseCount + 2 && !!c && c.group === 'P2' && /^c-/.test(c.id);
  }, '等待保存后 P2 多了一条用按钮添加的待办');
  const saved = await app.saved();

  // 每组的任务数和计数等于由保存后状态推导的结果；P1、P2 各多一个任务，总数加 2
  const groups = await expectGroupsMatch(page, saved);
  const total = groups.reduce((n, g) => n + g.taskIds.length, 0);
  const fixtureTotal = groups
    .map((g) => expectedGroup(fixture, g.code, g.taskIds.filter(isBuiltinId).length, FROZEN_TODAY))
    .reduce((n, g) => n + g.taskIds.length, 0);
  expect(total).toBe(fixtureTotal + 2);

  // 新行：aria-label 是各自的合成文字，各有一个删除按钮；输入框随重绘清空
  for (const text of [TEXT_ENTER, TEXT_BUTTON]) {
    const id = find(saved, text).id as string;
    await expect(page.locator(`#goals [data-task="${id}"]`)).toHaveAttribute('aria-label', text);
    await expect(page.locator(`#goals .task:has([data-task="${id}"]) [data-deltask]`)).toHaveCount(1);
  }
  await expect(page.locator('#goals [data-addto="P1"]')).toHaveValue('');
  await expect(page.locator('#goals [data-addto="P2"]')).toHaveValue('');
});

test('GOAL-05 deleting a custom todo removes it with its task state and built-in tasks have no delete button', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  // 删除 fixture 里的合成待办：custom 和 tasks 里都没有它
  expect(fixture.tasks['c-synth-1'], 'fixture 里 c-synth-1 应当有任务状态').toBeDefined();
  await page.locator('#goals [data-deltask="c-synth-1"]').click();
  await app.expectSaved(
    (s) => !s.custom.some((c: any) => c.id === 'c-synth-1') && !('c-synth-1' in (s.tasks ?? {})),
    '等待保存后 c-synth-1 从 custom 和 tasks 里都消失了',
  );
  await expectGroupsMatch(page, await app.saved());

  // 新加一条待办，给它设截止日期（让 tasks 里有它的状态），再删除：两处都消失（D-15）
  const TEXT = 'SYNTH-GOAL05 short-lived';
  await page.locator('#goals [data-addto="P3"]').fill(TEXT);
  await page.locator('#goals [data-addto="P3"]').press('Enter');
  await app.expectSaved((s) => s.custom.some((c: any) => c.text === TEXT), '等待保存后 P3 多了一条待删除的待办');
  const newId: string = (await app.saved()).custom.find((c: any) => c.text === TEXT).id;
  expect(newId).toMatch(/^c-/);

  await page.locator(`#goals [data-due="${newId}"]`).fill('2026-03-30');
  await app.expectSaved((s) => s.tasks?.[newId]?.due === '2026-03-30', '等待保存后新待办有了任务状态');

  await page.locator(`#goals [data-deltask="${newId}"]`).click();
  await app.expectSaved(
    (s) => !s.custom.some((c: any) => c.id === newId) && !(newId in (s.tasks ?? {})),
    '等待保存后新待办从 custom 和 tasks 里都消失了',
  );
  const saved = await app.saved();
  await expectGroupsMatch(page, saved);

  // 内置任务的行没有删除按钮；删除按钮总数等于保存后 custom 的条数
  for (const id of Object.values(BUILTIN_TASK_IDS)) {
    await expect(page.locator(`#goals .task:has([data-task="${id}"]) [data-deltask]`)).toHaveCount(0);
  }
  await expect(page.locator('#goals [data-deltask]')).toHaveCount(saved.custom.length);
});

// “没有保存”的证明要用 manual 时钟（D-04）：先推过 600 ms 的保存防抖窗口再比较写入次数，
// 再用合成哨兵做一次写入，证明这个窗口确实推进了防抖。同一个用例里不混用 setFixedTime
test.describe('GOAL-05 manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('GOAL-05 a blank todo is not added and nothing is saved', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await gotoGoals(page);

    const writesBefore = app.backend.writes.length;
    const tasks = page.locator('#goals [data-task]');
    const tasksBefore = await tasks.count();
    expect(tasksBefore).toBeGreaterThan(0);

    // 三个空格按 Enter，再点添加：都不新增
    const input = page.locator('#goals [data-addto="P1"]');
    await input.fill('   ');
    await input.press('Enter');
    await page.locator('#goals [data-addbtn="P1"]').click();
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length, '空白待办之后不应当有保存').toBe(writesBefore);
    await expect(tasks).toHaveCount(tasksBefore);

    // 哨兵：合成文字按 Enter，写入到达 mock，证明上面的窗口确实推进了防抖
    const sentinel = 'SYNTH-GOAL05 sentinel';
    await input.fill(sentinel);
    await input.press('Enter');
    await page.clock.runFor(2_000);
    await expect
      .poll(() => app.backend.writes.some((w) => w.data.custom?.some((c: any) => c.text === sentinel)), {
        message: '等待哨兵写入到达 mock',
      })
      .toBe(true);
    // 哨兵到达后，中间不能有别的写入（写入按顺序到达，多余的保存会让总数大于 +1）
    expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
  });
});
