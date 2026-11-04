// 本文件覆盖 CAL-02：月份导航（上个月、下个月）、今天按钮、点格子选中和点当月以外的格子跳月。
// 导航按钮用 #prev、#next、#todayBtn 的 id 定位，不用按钮文字。
// 点格子是安全的：格子按钮的子节点都是元素（日号、chip 容器），Playwright 调用日志的元素预览只打印属性，
// 也就是日期和只含数量的 aria-label，不会带出到期或完成 chip 里的计划原文（D-05）。
// 视图用例默认账户模式加完整 fixture（D-06），期望值由 expect-from-fixture.ts 推导。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import { composer } from '../../support/composer';
import { gotoCalendar, readMonth } from '../../support/calendar';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { composerWhenLabel, dayPanelTitle, expectedMonthCells, monthTitle } from '../../support/expect-from-fixture';
import { WEEKDAY_CHARS } from '../../support/strings';

const DOW = WEEKDAY_CHARS.split('');

// 日面板标题和 composer 的“记录到”都指向 date（选中日）
async function expectSelectedDay(page: Page, date: string) {
  await expect(page.locator('#dayPanel > h3')).toHaveText(dayPanelTitle(date));
  await expect(composer(page, 'c').when).toHaveText(composerWhenLabel(date));
}

test('CAL-02 previous and next move the month across a year boundary without changing the selected day', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoCalendar(page);

  // 往前三个月：跨年到 2025 年 12 月，选中日仍是今天
  for (let i = 0; i < 3; i++) await page.locator('#prev').click();
  await expect
    .poll(() => readMonth(page), { message: '2025 年 12 月网格与推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2025, 12),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2025, 12, FROZEN_TODAY, FROZEN_TODAY),
    });
  await expectSelectedDay(page, FROZEN_TODAY);

  // 往后一个月：跨年回到 2026 年 1 月
  await page.locator('#next').click();
  await expect.poll(async () => (await readMonth(page)).title).toBe(monthTitle(2026, 1));

  // 再往后两个月回到 3 月，今天那一格仍带 sel
  await page.locator('#next').click();
  await page.locator('#next').click();
  await expect
    .poll(() => readMonth(page), { message: '3 月网格与推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 3),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 3, FROZEN_TODAY, FROZEN_TODAY),
    });
  await expectSelectedDay(page, FROZEN_TODAY);
});

test('CAL-02 the today button returns to the current month and selects today', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoCalendar(page);

  // 先选另一天，日面板标题随之变化
  await page.locator('#grid [data-date="2026-03-05"]').click();
  await expectSelectedDay(page, '2026-03-05');

  // 翻到 4 月，再点今天按钮：回到 3 月，选中今天
  await page.locator('#next').click();
  await expect.poll(async () => (await readMonth(page)).title).toBe(monthTitle(2026, 4));
  await page.locator('#todayBtn').click();

  await expect
    .poll(() => readMonth(page), { message: '点今天按钮后的 3 月网格与推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 3),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 3, FROZEN_TODAY, FROZEN_TODAY),
    });
  await expectSelectedDay(page, FROZEN_TODAY);
});

test('CAL-02 clicking a cell selects it and clicking a cell outside the month jumps to that month', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoCalendar(page);

  // 点 3 月 19 日：它带 sel，今天那一格仍带 today、不再带 sel
  await page.locator('#grid [data-date="2026-03-19"]').click();
  await expect
    .poll(() => readMonth(page), { message: '选中 3 月 19 日后的网格与推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 3),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 3, FROZEN_TODAY, '2026-03-19'),
    });
  await expectSelectedDay(page, '2026-03-19');

  // 4 月 2 日在 3 月的网格里是当月以外的格子；点它跳到 4 月并选中它
  const outCell = (await readMonth(page)).cells.find((c) => c.date === '2026-04-02');
  expect(outCell?.out, '4 月 2 日在 3 月网格里应当带 out').toBe(true);
  await page.locator('#grid [data-date="2026-04-02"]').click();
  await expect
    .poll(() => readMonth(page), { message: '跳到 4 月后的网格与推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 4),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 4, FROZEN_TODAY, '2026-04-02'),
    });
  await expectSelectedDay(page, '2026-04-02');

  // 4 月网格开头的 3 月 31 日也是当月以外的格子；点它回到 3 月并选中它
  const leading = (await readMonth(page)).cells.find((c) => c.date === '2026-03-31');
  expect(leading?.out, '3 月 31 日在 4 月网格里应当带 out').toBe(true);
  await page.locator('#grid [data-date="2026-03-31"]').click();
  await expect
    .poll(() => readMonth(page), { message: '回到 3 月后的网格与推导不一致（只含日期、类名、数量和 id）' })
    .toEqual({
      title: monthTitle(2026, 3),
      dow: DOW,
      cells: expectedMonthCells(fixture, 2026, 3, FROZEN_TODAY, '2026-03-31'),
    });
  await expectSelectedDay(page, '2026-03-31');
});
