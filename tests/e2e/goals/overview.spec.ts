// 本文件覆盖 GOAL-01：目标视图里 P1 到 P7 七个目标组的渲染，以及四张力量卡的渲染。
// 视图用例默认账户模式加完整 fixture（D-06）：期望值全部由 tests/support/expect-from-fixture.ts 的 expectedGroup 从 fixture 推导。
// 隐私（D-05）：内置任务的复选框、.tt、组标题和组说明、力量名称和目标都是个人计划文字，
// 只经 tests/support/goals.ts 的一次 page.evaluate 读回组号、计数、id、进度条数值和布尔，不做定位器动作或文字断言。
import { test, expect } from '../../support/test';
import { gotoGoals, readGroups } from '../../support/goals';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedGroup } from '../../support/expect-from-fixture';
import { GROUP_CATEGORY } from '../../support/strings';
import { BUILTIN_TASK_IDS } from '../../support/task-ids';

test('GOAL-01 the seven goal groups show done counts and progress bars derived from the fixture', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  const groups = await readGroups(page);

  // 组号按顺序是 P1 到 P7，与 GROUP_CATEGORY 的键一致
  expect(groups.map((g) => g.code)).toEqual(Object.keys(GROUP_CATEGORY));

  // 每组的内置任务个数取 DOM（D-12），都大于 0
  const builtinCount = (taskIds: string[]) => taskIds.filter((id) => /^P\d-\d+$/.test(id)).length;
  for (const g of groups) {
    expect(builtinCount(g.taskIds), `${g.code} 应当有内置任务`).toBeGreaterThan(0);
  }

  // 整体与推导比较：失败时 diff 里只有组号、id、计数和数字
  const expected = groups.map((g) => expectedGroup(fixture, g.code, builtinCount(g.taskIds), FROZEN_TODAY));
  expect(groups).toEqual(expected);

  // 防空转：fixture.tasks 的每个键都出现在某一组里；有已完成的组，也有已过期的组
  const shownIds = new Set(groups.flatMap((g) => g.taskIds));
  for (const id of Object.keys(fixture.tasks)) {
    expect(shownIds.has(id), `fixture 里的任务 ${id} 应当出现在某个目标组里`).toBe(true);
  }
  expect(groups.some((g) => g.doneIds.length > 0), '至少一组有已完成的任务').toBe(true);
  expect(groups.some((g) => g.overdueIds.length > 0), '至少一组有已过期的任务').toBe(true);

  // 删除按钮只在自定义任务上：总数等于 fixture 的自定义任务数
  expect(groups.reduce((n, g) => n + g.deleteIds.length, 0)).toBe(fixture.custom.length);

  // per D-03：fixture 用到的内置任务位置 id 在目标页上都还在
  for (const id of Object.values(BUILTIN_TASK_IDS)) {
    expect(shownIds.has(id), `内置任务位置 id ${id} 应当仍然存在`).toBe(true);
  }
});
