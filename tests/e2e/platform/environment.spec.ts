import { test, expect } from '../../support/test';
import { FROZEN_NOW, FROZEN_TODAY, TIMEZONE_ID, LOCALE } from '../../support/constants';
import { STATUS_LOCAL, WEEK_TITLE_CURRENT, WEEK_RANGE_FROZEN } from '../../support/strings';

test('ENV-04 the page clock is frozen at 2026-03-18 noon UTC in America/New_York with zh-CN', async ({
  page,
}) => {
  await page.goto('/');

  const env = await page.evaluate(() => {
    const now = new Date();
    return {
      now: Date.now(),
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      weekday: now.getDay(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };
  });

  expect(env.now).toBe(FROZEN_NOW);
  expect([env.year, env.month, env.day]).toEqual([2026, 3, 18]);
  expect(env.weekday).toBe(3); // 周三
  expect(env.timeZone).toBe(TIMEZONE_ID);
  expect(env.language).toBe(LOCALE);
});

test('ENV-04 the app renders the frozen current week', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  await expect(page.locator('#wkTitle')).toHaveText(WEEK_TITLE_CURRENT);
  await expect(page.locator('#wkRange')).toHaveText(WEEK_RANGE_FROZEN);

  // 今天高亮恰好一天，且是冻结日
  const today = page.locator('#tab-wk #days .day.today');
  await expect(today).toHaveCount(1);
  await expect(today).toHaveAttribute('data-wday', FROZEN_TODAY);
});
