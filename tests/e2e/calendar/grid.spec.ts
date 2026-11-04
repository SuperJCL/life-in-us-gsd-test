// 本文件覆盖 CAL-01：日历月份网格的渲染（周日起始的表头、当月以外的格子、今天、选中日、抵达日、chip 和“+N”）。
// 视图用例默认账户模式加完整 fixture（D-06）：开局后立刻 expectAccountMode，
// 期望值全部由 tests/support/expect-from-fixture.ts 的独立推导（monthGrid、expectedMonthCells）从 fixture 算出。
// 35 和 42 格的数字另用 D-01 的脚本核对过，并作为路标写死在用例里。
// 隐私（D-05）：到期和完成 chip 的文字是个人计划原文，只经 tests/support/calendar.ts 的一次 page.evaluate
// 读回 chip 的种类、aria-label 和数量，不对 chip 做定位器动作、文字断言或可见性断言。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { gotoCalendar, readCellLogClasses, readDayPanelLogClasses, readMonth } from '../../support/calendar';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedCategory, expectedMonthCells, monthGrid, monthTitle, ymdAddDays } from '../../support/expect-from-fixture';
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

// 账户模式加完整 fixture（或它的内存变体）开局，并打开日历标签
async function openCalendar(page: Page, app: AppHarness, state: any) {
  await app.open({ mode: 'account', seed: state });
  await app.expectAccountMode();
  await gotoCalendar(page);
}

test('CAL-01 chips are ordered entries, then due, then done, and their category class matches the day panel', async ({
  page,
  app,
}) => {
  // 内存变体（不改 fixture 文件）：让 2026-03-16 恰好有记录、到期、完成各一个。
  // 两个都是合成的自定义计划，_synthetic 标记保留
  const variant = loadFixture('full-state.json');
  variant.tasks['c-synth-1'].due = '2026-03-16';
  variant.tasks['c-synth-2'].doneDate = '2026-03-16';
  await openCalendar(page, app, variant);

  const expectedCells = expectedMonthCells(variant, 2026, 3, FROZEN_TODAY, FROZEN_TODAY);
  await expect
    .poll(() => readMonth(page), { message: '3 月网格与变体推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({ title: monthTitle(2026, 3), dow: DOW, cells: expectedCells });

  // 路标：16 日三种 chip 各一个，顺序是记录、到期、完成；15 日的计划已完成（完成日是 18 日），不再显示为到期
  const read = (await readMonth(page)).cells;
  const c16 = read.find((c) => c.date === '2026-03-16');
  expect(c16?.kinds).toEqual(['log', 'due', 'done']);
  expect(c16?.more).toBeNull();
  expect(read.find((c) => c.date === '2026-03-15')?.kinds).toEqual([]);

  // 今天是选中日：格子里记录 chip 的类别类与日面板里同一天记录的类别类按顺序一致
  const cellClasses = await readCellLogClasses(page, FROZEN_TODAY);
  const panelClasses = await readDayPanelLogClasses(page);
  expect(cellClasses).toHaveLength(3);
  expect(cellClasses.every((c) => c.length > 0 && c.every((x) => x.startsWith('k-')))).toBe(true);
  expect(cellClasses).toEqual(panelClasses);

  // 类别类本身要正确，不能只是两处互相一致：同一类别（按 fixture 推导）的记录类名相同，不同类别的记录类名不同。
  // 不依赖具体类名，也不写任何类别文字；顺序与 state.logs 里同一天记录的顺序一致
  const todayLogs = variant.logs.filter((l: { date: string }) => l.date === FROZEN_TODAY);
  expect(todayLogs).toHaveLength(cellClasses.length);
  for (let i = 0; i < todayLogs.length; i++) {
    for (let j = i + 1; j < todayLogs.length; j++) {
      const sameCategory = expectedCategory(todayLogs[i].cat) === expectedCategory(todayLogs[j].cat);
      const sameCellClass = JSON.stringify(cellClasses[i]) === JSON.stringify(cellClasses[j]);
      const samePanelClass = JSON.stringify(panelClasses[i]) === JSON.stringify(panelClasses[j]);
      expect(sameCellClass, '格子里 chip 的类别类等价关系与 fixture 的类别分组不一致').toBe(sameCategory);
      expect(samePanelClass, '日面板里记录的类别类等价关系与 fixture 的类别分组不一致').toBe(sameCategory);
    }
  }
});

test('CAL-01 May 2026 needs six rows and renders 42 cells that match the derivation', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await openCalendar(page, app, fixture);

  await page.locator('#next').click();
  await page.locator('#next').click();

  // 路标（D-01）：2026-05 的 1 日是周五，需要 6 行，共 42 格
  expect(monthGrid(2026, 5)).toHaveLength(42);
  await expect
    .poll(() => readMonth(page), { message: '5 月网格与 fixture 推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 5),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 5, FROZEN_TODAY, FROZEN_TODAY),
    });
  expect((await readMonth(page)).cells).toHaveLength(42);
});

test('CAL-01 February 2026 renders 35 cells and its last row lies entirely in March', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await openCalendar(page, app, fixture);

  await page.locator('#prev').click();

  await expect
    .poll(() => readMonth(page), { message: '2 月网格与 fixture 推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 2),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 2, FROZEN_TODAY, FROZEN_TODAY),
    });

  // 路标：2 月正好 28 天且 1 日是周日，循环要画到第 35 格才停，最后一行 7 格是 3 月 1 日到 7 日，全部带 out
  const cells = (await readMonth(page)).cells;
  expect(cells).toHaveLength(35);
  const lastRow = cells.slice(28);
  expect(lastRow.map((c) => c.date)).toEqual([0, 1, 2, 3, 4, 5, 6].map((i) => ymdAddDays('2026-03-01', i)));
  expect(lastRow.every((c) => c.out)).toBe(true);
});

test('CAL-01 the arrival day carries the arrival class only in the January grid', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await openCalendar(page, app, fixture);

  // 3 月里没有抵达日
  expect((await readMonth(page)).cells.some((c) => c.arr)).toBe(false);

  await page.locator('#prev').click();
  await page.locator('#prev').click();

  await expect
    .poll(() => readMonth(page), { message: '1 月网格与 fixture 推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 1),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 1, FROZEN_TODAY, FROZEN_TODAY),
    });

  // 恰好一格带 arr，日期就是 fixture 的抵达日
  const arr = (await readMonth(page)).cells.filter((c) => c.arr).map((c) => c.date);
  expect(arr).toEqual([fixture.arrival]);
});
