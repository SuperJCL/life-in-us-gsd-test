// 本文件覆盖 GOAL-03（勾选和取消勾选）、GOAL-04（截止日期与已过期）、GOAL-05（自定义待办的添加和删除）。
// 视图用例默认账户模式加完整 fixture（D-06）：组计数、进度条和日历格子的期望全部由“保存后的状态”推导（D-14），
// 不写死任何数字，所以勾选和改日期造成的连带变化（今天的完成数、原来的到期日）都由推导带出来。
// 隐私（D-05）：内置任务的复选框和截止日期框的 aria-label、.tt 都是任务原文，Playwright 的动作和断言失败时会把它们打印出来，
// 所以内置任务一律经 tests/support/goals.ts 的 checkTask、setDue 在页面内按位置 id 操作，用 readTaskRow 读回
// 布尔、日期、固定文案和 id，从不做定位器动作、文字断言或可见性断言。
// 只有合成的自定义任务（c-synth-1 和用例自己新加的 SYNTH- 待办）才用真实的点击和填写：它们的属性和文字都是合成的。
import { test, expect } from '../../support/test';
import { gotoCalendar, readMonth } from '../../support/calendar';
import { checkTask, gotoGoals, readGroups, readTaskRow } from '../../support/goals';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedGroup, expectedMonthCells, mdLabel } from '../../support/expect-from-fixture';
import { GOAL_DONE_ON_PREFIX, TOAST_TASK_DONE } from '../../support/strings';
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
