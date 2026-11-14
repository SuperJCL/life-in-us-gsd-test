// 训练行进入日历格、日面板和时间线的用例（FIT-04；D-05、S9、A15）。
// 本周页的训练行由 15-01 的用例覆盖；这里管日历、日面板、时间线，以及它们和文字记录并排时的样子。
// 期望值在本文件里手写，不读应用的实现；失败消息只写日期、计数和布尔，不带计划文字。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY } from '../../support/constants';
import {
  CAL_WO,
  CATEGORY_NAMES,
  DAY_EMPTY,
  FILTER_ALL,
  FILTER_DONE_TASKS,
  TAB_LABELS,
  fitRow,
  fitRowAria,
  flTitleDay,
  weekFitGoalLine,
} from '../../support/strings';
import { gotoCalendar, readDayPanel } from '../../support/calendar';
import { gotoTimeline, pickFilter } from '../../support/timeline';
import { gotoFitness, readWeekWo } from '../../support/fitness';

const FIT = CATEGORY_NAMES[2]; // 健身
const wo = (lifts: Record<string, Array<[number, number]>>, cardio: Array<{ id: string; m: number; d?: number }> = []) => ({
  lifts: Object.entries(lifts).map(([id, sets]) => ({ id, sets: sets.map(([w, r]) => ({ w, r })) })),
  cardio,
});
const SUMMARY_16 = '卧推（共 2 组） · 跑步 30 分钟';
const SUMMARY_18 = '卧推（共 1 组）';

// 时间线里每一行：M/D 加上是训练行还是文字记录行，按 DOM 顺序
async function timelineRows(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#timeline .tl-item')).map(
      (el) => (el.querySelector('.tl-date')?.textContent ?? '') + ':' + (el.hasAttribute('data-wo') ? 'wo' : el.hasAttribute('data-edit') ? 'edit' : 'other'),
    ),
  );
}

test('FIT-04 a training shows as a fitness row in the calendar cell and day panel and in the timeline under all and fitness, and the rows open the fitness tab on that day (D-05, S9)', async ({
  page,
  app,
}) => {
  await app.open({
    seed: { _synthetic: true, workouts: { '2026-03-16': wo({ bench: [[40, 5], [40, 5]] }, [{ id: 'r-run', m: 30 }]) } },
  });

  // 日历日格：多一枚 .chip.k-fit，文字「健身 · 摘要」，chip 上没有 data-wo；格子的读屏文字多一句「，有训练」
  await gotoCalendar(page);
  const cell = page.locator('#grid [data-date="2026-03-16"]');
  const chip = cell.locator('.chip.k-fit');
  await expect(chip).toHaveCount(1);
  await expect(chip).toHaveText(fitRow(SUMMARY_16));
  expect(await chip.evaluate((el) => el.hasAttribute('data-wo')), 'chip is not a button').toBe(false);
  await expect(cell).toHaveAttribute('aria-label', '3月16日，0 条记录，0 项到期，0 项完成' + CAL_WO);

  // 点日格仍是选中那一天，不进健身页
  await cell.click();
  await expect(cell).toHaveClass(/\bsel\b/);
  await expect(page.getByRole('tab', { name: TAB_LABELS.cal, exact: true })).toHaveAttribute('aria-selected', 'true');
  const dp = await readDayPanel(page);
  expect(dp.title, 'day panel title').toBe('3月16日 周一');
  expect(dp.empty, 'a day with only a training is not empty').toBeNull();

  // 日面板的一行：.tag「健身」、摘要、›，role=button，aria-label
  const row = page.locator('#dayPanel li[data-wo="2026-03-16"]');
  await expect(row).toHaveCount(1);
  await expect(row.locator('.tag')).toHaveText(FIT);
  await expect(row.locator('.li-text')).toHaveText(SUMMARY_16);
  await expect(row.locator('.wo-go')).toHaveText('›');
  await expect(row).toHaveAttribute('role', 'button');
  await expect(row).toHaveAttribute('tabindex', '0');
  await expect(row).toHaveAttribute('aria-label', fitRowAria(SUMMARY_16));
  expect(
    await row.evaluate((el) => ({ edit: el.hasAttribute('data-edit'), del: !!el.querySelector('[data-dellog]'), editable: el.classList.contains('editable') })),
    'the row has no edit or delete',
  ).toEqual({ edit: false, del: false, editable: false });

  // Enter：进健身页那一天，焦点在 #fl-title
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: TAB_LABELS.fit, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#fl-title')).toHaveText(flTitleDay('3月16日'));
  await expect(page.locator('#fl-title')).toBeFocused();

  // 时间线：「全部」和「健身」各有一行，「完成的计划」没有
  await gotoTimeline(page);
  const tlRow = page.locator('#timeline .tl-item.wo[data-wo="2026-03-16"]');
  await pickFilter(page, FILTER_ALL);
  await expect(tlRow).toHaveCount(1);
  await pickFilter(page, FIT);
  await expect(tlRow).toHaveCount(1);
  await pickFilter(page, FILTER_DONE_TASKS);
  await expect(page.locator('#timeline [data-wo]')).toHaveCount(0);
  await pickFilter(page, CATEGORY_NAMES[0]);
  await expect(page.locator('#timeline [data-wo]')).toHaveCount(0);

  // 行的内容：日期、.tag「健身」、摘要、›、读屏文字；点或按空格都进健身页那一天
  await pickFilter(page, FILTER_ALL);
  await expect(tlRow.locator('.tl-date')).toHaveText('3/16');
  await expect(tlRow.locator('.tag')).toHaveText(FIT);
  await expect(tlRow.locator('.li-text')).toHaveText(SUMMARY_16);
  await expect(tlRow.locator('.wo-go')).toHaveText('›');
  await expect(tlRow).toHaveAttribute('role', 'button');
  await expect(tlRow).toHaveAttribute('aria-label', fitRowAria(SUMMARY_16));
  await expect(tlRow).toHaveClass(/\bk-fit\b/);
  await expect(tlRow).not.toHaveClass(/\beditable\b/);
  await tlRow.click();
  await expect(page.locator('#fl-title')).toHaveText(flTitleDay('3月16日'));
  await expect(page.locator('#fl-title')).toBeFocused();

  await gotoTimeline(page);
  await tlRow.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('tab', { name: TAB_LABELS.fit, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#fl-title')).toBeFocused();
});

test('FIT-04 the fitness rows cannot be dragged, a day with both a training and a fitness text entry shows both rows, and a day without a training looks the same as before (A15, S9)', async ({
  page,
  app,
}) => {
  await app.open({
    seed: {
      _synthetic: true,
      workouts: {
        '2026-03-16': wo({ bench: [[40, 5], [40, 5]] }, [{ id: 'r-run', m: 30 }]),
        '2026-03-18': wo({ bench: [[40, 5]] }),
      },
      logs: [
        { id: 'fit-text', date: '2026-03-16', cat: FIT, text: 'SYNTH-fit-text' },
        { id: 'lang-1', date: '2026-03-17', cat: CATEGORY_NAMES[0], text: 'SYNTH-lang' },
      ],
    },
  });

  // 本周页：同一天两行，文字记录可拖动，训练行不可拖动也没有 data-edit；天数只算一次（16 和 18 两天），「{n} 项」把每个训练日算 1 项
  const col = page.locator('#days [data-wday="2026-03-16"] .ent');
  await expect(col).toHaveCount(2);
  expect(
    await col.evaluateAll((els) => els.map((el) => ({ wo: el.hasAttribute('data-wo'), edit: el.hasAttribute('data-edit'), drag: el.getAttribute('draggable') === 'true' }))),
    'week column rows',
  ).toEqual([
    { wo: false, edit: true, drag: true },
    { wo: true, edit: false, drag: false },
  ]);
  const w16 = await readWeekWo(page, '2026-03-16');
  expect(w16, 'week row for 03-16').toEqual({ text: fitRow(SUMMARY_16), draggable: false, edit: false });
  const w18 = await readWeekWo(page, '2026-03-18');
  expect(w18?.text, 'week row for 03-18').toBe(fitRow(SUMMARY_18));
  await expect(page.locator('#areas .area.k-fit .goal')).toHaveText(weekFitGoalLine(2, 2, 4));
  await expect(page.locator('#areas .area.k-fit .v')).toHaveText('3项');

  // 日历：同一天两枚 chip（文字记录在前，训练 chip 的文字以「健身 · 」开头；这条文字记录的类别也是健身，所以不能只看 k-fit 类），没有训练的日子格子和以前逐字一样
  await gotoCalendar(page);
  const kinds = (d: string) => page.locator(`#grid [data-date="${d}"] .chip`).evaluateAll((els) => els.map((el) => ((el.textContent ?? '').startsWith('健身 · ') ? 'fit' : 'text')));
  expect(await kinds('2026-03-16'), 'chips on the day with both').toEqual(['text', 'fit']);
  expect(await kinds('2026-03-17'), 'chips on a day without a training').toEqual(['text']);
  expect(await kinds('2026-03-19'), 'chips on an empty day').toEqual([]);
  await expect(page.locator('#grid [data-date="2026-03-16"]')).toHaveAttribute('aria-label', '3月16日，1 条记录，0 项到期，0 项完成' + CAL_WO);
  await expect(page.locator('#grid [data-date="2026-03-17"]')).toHaveAttribute('aria-label', '3月17日，1 条记录，0 项到期，0 项完成');
  await expect(page.locator('#grid [data-date="2026-03-19"]')).toHaveAttribute('aria-label', '3月19日，0 条记录，0 项到期，0 项完成');

  // 日面板：有两样时两行并列；只有训练时没有「这天还没有记录。」；没有训练的日子和以前一样
  const panelRows = (d: string) =>
    page.locator('#grid [data-date="' + d + '"]').click().then(() => page.locator('#dayPanel .items li').evaluateAll((els) => els.map((el) => (el.hasAttribute('data-wo') ? 'wo' : el.hasAttribute('data-edit') ? 'edit' : 'other'))));
  expect(await panelRows('2026-03-16'), 'day panel rows with both').toEqual(['edit', 'wo']);
  expect((await readDayPanel(page)).empty, 'not empty with both').toBeNull();
  expect(await panelRows('2026-03-18'), 'day panel rows with only a training').toEqual(['wo']);
  expect((await readDayPanel(page)).empty, 'a day with only a training is not empty').toBeNull();
  expect(await panelRows('2026-03-17'), 'day panel rows without a training').toEqual(['edit']);
  expect(await panelRows('2026-03-19'), 'day panel rows on an empty day').toEqual([]);
  expect((await readDayPanel(page)).empty, 'empty day text').toBe(DAY_EMPTY);
  await expect(page.locator('#dayPanel li[data-wo]')).toHaveCount(0);

  // 时间线：「全部」里训练行排在同一天的文字记录之后；训练行没有 data-edit、不可拖动
  await gotoTimeline(page);
  await pickFilter(page, FILTER_ALL);
  expect(await timelineRows(page), 'all rows newest first').toEqual(['3/18:wo', '3/17:edit', '3/16:edit', '3/16:wo']);
  expect(
    await page.evaluate(() => Array.from(document.querySelectorAll('#timeline .tl-item.wo')).some((el) => el.hasAttribute('data-edit') || el.hasAttribute('draggable'))),
    'timeline training rows are not editable or draggable',
  ).toBe(false);
  await pickFilter(page, FIT);
  expect(await timelineRows(page), 'fitness filter rows').toEqual(['3/18:wo', '3/16:edit', '3/16:wo']);
  await pickFilter(page, CATEGORY_NAMES[0]);
  expect(await timelineRows(page), 'language filter rows').toEqual(['3/17:edit']);

  // 点进健身页后，焦点落在标题，来源日期是点的那一行
  await pickFilter(page, FILTER_ALL);
  await page.locator('#timeline .tl-item.wo[data-wo="2026-03-18"]').click();
  await expect(page.locator('#fl-title')).toBeFocused();
  expect(FROZEN_TODAY, 'sanity').toBe('2026-03-18');
  await gotoFitness(page);
});
