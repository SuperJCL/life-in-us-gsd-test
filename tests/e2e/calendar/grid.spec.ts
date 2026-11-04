// 本文件覆盖 CAL-01：日历月份网格的渲染（周日起始的表头、当月以外的格子、今天、选中日、抵达日、chip 和“+N”）。
// 视图用例默认账户模式加完整 fixture（D-06）：开局后立刻 expectAccountMode，
// 期望值全部由 tests/support/expect-from-fixture.ts 的独立推导（monthGrid、expectedMonthCells）从 fixture 算出。
// 35 和 42 格的数字另用 D-01 的脚本核对过，并作为路标写死在用例里。
// 隐私（D-05）：到期和完成 chip 的文字是个人计划原文，只经 tests/support/calendar.ts 的一次 page.evaluate
// 读回 chip 的种类、aria-label 和数量，不对 chip 做定位器动作、文字断言或可见性断言。
import { test, expect } from '../../support/test';
import { gotoCalendar, readMonth } from '../../support/calendar';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedMonthCells, monthGrid, monthTitle } from '../../support/expect-from-fixture';
import { WEEKDAY_CHARS } from '../../support/strings';

// 表头：WEEKDAY_CHARS 拆成 7 个字，周日在前
const DOW = WEEKDAY_CHARS.split('');

test('CAL-01 the March grid starts on Sunday and every cell matches the fixture-derived dates, classes, aria-labels and chips', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoCalendar(page);

  // 路标（D-01）：2026-03 的 1 日是周日，正好 35 格
  const expectedCells = expectedMonthCells(fixture, 2026, 3, FROZEN_TODAY, FROZEN_TODAY);
  expect(monthGrid(2026, 3)).toHaveLength(35);
  expect(DOW).toHaveLength(7);

  // 防空转：今天那一格事件超过 3 个，推导里有“+N”；3 月网格尾行有当月以外的格子
  expect(expectedCells.find((c) => c.date === FROZEN_TODAY)?.more, '今天那一格应当有 +N').not.toBeNull();
  expect(expectedCells.find((c) => c.date === '2026-04-04')?.out, '尾行的 4 月格子应当带 out').toBe(true);

  // 整月一次读回，与推导逐格比较（标题、7 个表头、35 个格子）
  await expect
    .poll(() => readMonth(page), { message: '3 月网格与 fixture 推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({ title: monthTitle(2026, 3), dow: DOW, cells: expectedCells });
  expect((await readMonth(page)).cells).toHaveLength(35);
});
