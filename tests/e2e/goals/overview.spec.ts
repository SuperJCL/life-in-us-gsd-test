// 本文件覆盖 GOAL-01：目标视图里 P1 到 P7 七个目标组的渲染，以及四张力量卡的渲染。
// 视图用例默认账户模式加完整 fixture（D-06）：期望值全部由 tests/support/expect-from-fixture.ts 的 expectedGroup 从 fixture 推导。
// 隐私（D-05）：内置任务的复选框、.tt、组标题和组说明、力量名称和目标都是个人计划文字，
// 只经 tests/support/goals.ts 的一次 page.evaluate 读回组号、计数、id、进度条数值和布尔，不做定位器动作或文字断言。
import { test, expect } from '../../support/test';
import { gotoGoals, liftHistoryEquals, readGroups, readLifts } from '../../support/goals';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedGroup, liftHistoryText } from '../../support/expect-from-fixture';
import { GROUP_CATEGORY } from '../../support/strings';
import { BUILTIN_TASK_IDS, LIFT_IDS } from '../../support/task-ids';

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

test('GOAL-01 every lift card hides its save button and shows a value, bar and history consistent with the fixture', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  // 路标（D-12）：恰好 4 张力量卡，读回的卡片也是 4 张
  const { count, cards } = await readLifts(page, LIFT_IDS);
  expect(count).toBe(4);
  expect(cards).toHaveLength(4);

  // 每一张卡都满足与名称、目标无关的不变量；失败消息只含序号
  for (const c of cards) {
    expect(c.saveHidden, `第 ${c.index} 张力量卡的保存按钮应当带 hidden 类（内容已隐藏）`).toBe(true);
    expect(c.valueMatchesCurrent, `第 ${c.index} 张力量卡输入框的值应当等于显示的当前值（内容已隐藏）`).toBe(true);
    const inRange = c.barPct !== null && c.barPct >= 0 && c.barPct <= 100;
    expect(inRange, `第 ${c.index} 张力量卡的进度条宽度应当在 0 到 100 之间（内容已隐藏）`).toBe(true);
  }

  // fixture 里有状态的两张卡：每个 LIFT_IDS 恰好出现一次，再比较由 fixture 推导的值、历史行和历史前缀
  const known = cards.filter((c) => c.fixtureId !== null);
  expect(known).toHaveLength(LIFT_IDS.length);
  expect(known.map((c) => c.fixtureId).sort()).toEqual([...LIFT_IDS].sort());
  for (const c of known) {
    const id = c.fixtureId as (typeof LIFT_IDS)[number];
    const lift = fixture.lifts[id];
    expect(c.value === String(lift.cur), `${id} 的输入框的值应当等于 fixture 的 cur（内容已隐藏）`).toBe(true);
    const expectedHist = liftHistoryText(lift.hist);
    expect(expectedHist, `${id} 在 fixture 里应当有历史`).not.toBeNull();
    const histOk = await liftHistoryEquals(page, id, expectedHist as string);
    expect(histOk, `${id} 的历史行应当等于由 fixture 推导的文字（内容已隐藏）`).toBe(true);
    expect(c.hasHistory, `${id} 的历史前缀是否出现应当与 fixture 的历史是否非空一致（内容已隐藏）`).toBe(lift.hist.length > 0);
  }

  // fixture 里没有状态的另外两张卡：没有历史前缀（那一行显示的是个人备注）
  const unknown = cards.filter((c) => c.fixtureId === null);
  expect(unknown).toHaveLength(cards.length - LIFT_IDS.length);
  for (const c of unknown) {
    expect(c.hasHistory, `第 ${c.index} 张力量卡在 fixture 里没有状态，不应当有历史前缀（内容已隐藏）`).toBe(false);
  }
});
