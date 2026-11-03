import { test, expect } from '../../support/test';
import { WEEK_END_FROZEN, WEEK_START_FROZEN } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { logsInWeek } from '../../support/expect-from-fixture';

test('DATA-01 the full fixture loads through the account mock and shows a current-week entry for each of the five categories', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  // 本周记录覆盖五个类别（期望由 helper 从 fixture 推导）
  const week = logsInWeek(fixture, WEEK_START_FROZEN, WEEK_END_FROZEN);
  expect(new Set(week.map((l) => l.cat)).size).toBe(5);

  // 每条本周记录都出现在本周视图对应日期的列里
  for (const log of week) {
    await expect(page.locator(`#tab-wk [data-wday="${log.date}"] [data-edit="${log.id}"]`)).toBeVisible();
  }
});
