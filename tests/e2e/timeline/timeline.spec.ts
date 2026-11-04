// 本文件覆盖 TL-01、TL-02：时间线按月倒序列出记录和完成的计划，类别和“完成的计划”筛选，空状态，跨年，以及新增内容后的联动。
// 期望值全部由 tests/support/expect-from-fixture.ts 的独立推导 expectedTimeline 从 fixture（或保存后的状态）算出。
// 隐私（D-07）：完成的计划条目的文字是个人计划原文，只经 tests/support/timeline.ts 的一次 page.evaluate
// 读回 id、日期和所属月份标题，不对它做定位器动作、文字断言或可见性断言。
// 所有用例账户模式开局并立刻 expectAccountMode（D-06）；fixture 变体只在用例内存里构造。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { composer } from '../../support/composer';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedTimeline, monthTitle, timelineDateLabel } from '../../support/expect-from-fixture';
import { gotoGoals } from '../../support/goals';
import {
  CATEGORY_NAMES,
  CAT_OTHER,
  FILTER_ALL,
  FILTER_DONE_TASKS,
  TAB_LABELS,
  TIMELINE_EMPTY,
  TOAST_RECORDED,
  TOAST_TASK_DONE,
} from '../../support/strings';
import { gotoTimeline, pickFilter, readTimeline } from '../../support/timeline';
import { expectToast } from '../../support/toast';

test('TL-01 the timeline lists entries and done plans newest first under month headings', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoTimeline(page);

  const expected = expectedTimeline(fixture, FILTER_ALL);

  // 防空转：条目数是记录数加 3 条已完成的计划，三个月份各一次，同一天先记录后计划，两种条目都出现
  expect(expected.rows).toHaveLength(fixture.logs.length + 3);
  expect(expected.months).toEqual([monthTitle(2026, 3), monthTitle(2026, 2), monthTitle(2026, 1)]);
  const today = expected.rows.filter((r) => r.date === timelineDateLabel(FROZEN_TODAY));
  expect(today.some((r) => r.attr === 'edit')).toBe(true);
  expect(today.some((r) => r.attr === 'edittask')).toBe(true);
  const firstTask = today.findIndex((r) => r.attr === 'edittask');
  expect(today.slice(firstTask).every((r) => r.attr === 'edittask'), '同一天的记录应排在完成的计划前面').toBe(true);

  await expect
    .poll(() => readTimeline(page), { message: '时间线读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(expected);
});

// 账户模式加给定状态开局，并打开时间线标签
async function openTimeline(page: Page, app: AppHarness, state: any) {
  await app.open({ mode: 'account', seed: state });
  await app.expectAccountMode();
  await gotoTimeline(page);
}

test('TL-02 each category filter shows only the entries of that category and only its button is pressed', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await openTimeline(page, app, fixture);

  for (const name of CATEGORY_NAMES) {
    await pickFilter(page, name);
    const expected = expectedTimeline(fixture, name);
    // 防空转：每个类别在 fixture 里都有记录，且只有记录条目、没有完成的计划
    expect(expected.rows.length, `类别 ${name} 的期望不应为空`).toBeGreaterThan(0);
    expect(expected.rows.every((r) => r.attr === 'edit' && r.tag === name)).toBe(true);
    expect(expected.filters.filter((f) => f.pressed === 'true')).toHaveLength(1);
    await expect
      .poll(() => readTimeline(page), { message: `类别 ${name} 的时间线读回与推导不一致（只含 id、日期和固定文案）` })
      .toEqual(expected);
  }

  // 切到本周再切回来：筛选保持为最后一个类别
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await gotoTimeline(page);
  const last = CATEGORY_NAMES[CATEGORY_NAMES.length - 1];
  await expect
    .poll(() => readTimeline(page), { message: '切换标签后筛选应保持（只含 id、日期和固定文案）' })
    .toEqual(expectedTimeline(fixture, last));
});

test('TL-02 the done-plans filter shows only done plans and the all filter brings everything back', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await openTimeline(page, app, fixture);

  await pickFilter(page, FILTER_DONE_TASKS);
  const done = expectedTimeline(fixture, FILTER_DONE_TASKS);
  // 防空转：只有完成的计划，既有内置（P 开头）也有自定义（c- 开头）
  expect(done.rows.length).toBeGreaterThan(0);
  expect(done.rows.every((r) => r.attr === 'edittask')).toBe(true);
  expect(done.rows.some((r) => r.id.startsWith('P'))).toBe(true);
  expect(done.rows.some((r) => r.id.startsWith('c-'))).toBe(true);
  await expect
    .poll(() => readTimeline(page), { message: '“完成的计划”筛选的读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(done);

  await pickFilter(page, FILTER_ALL);
  await expect
    .poll(() => readTimeline(page), { message: '回到“全部”后的读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(expectedTimeline(fixture, FILTER_ALL));
});

test('TL-01 an empty state shows the empty hint for every filter', async ({ page, app }) => {
  const minimal = loadFixture('minimal-state.json');
  await openTimeline(page, app, minimal);

  for (const value of [FILTER_ALL, ...CATEGORY_NAMES, FILTER_DONE_TASKS]) {
    await pickFilter(page, value);
    const expected = expectedTimeline(minimal, value);
    // 防空转：期望本身就是没有条目、没有月份标题、只有空提示
    expect(expected.rows).toEqual([]);
    expect(expected.months).toEqual([]);
    expect(expected.empty).toBe(TIMELINE_EMPTY);
    await expect
      .poll(() => readTimeline(page), { message: `筛选 ${value} 下的空状态读回与推导不一致` })
      .toEqual(expected);
    await expect(page.locator('#timeline .empty')).toHaveText(TIMELINE_EMPTY);
  }
});

test('TL-02 a category without entries shows the empty hint while the other filters still list items', async ({
  page,
  app,
}) => {
  // full-state 里每个类别都有记录，所以用内存变体造出“没有记录的类别”：去掉健身的记录
  const emptied = CATEGORY_NAMES[2];
  const variant = loadFixture('full-state.json');
  variant.logs = variant.logs.filter((l: { cat: string }) => l.cat !== emptied);
  await openTimeline(page, app, variant);

  await pickFilter(page, emptied);
  const none = expectedTimeline(variant, emptied);
  expect(none.rows).toEqual([]);
  expect(none.empty).toBe(TIMELINE_EMPTY);
  await expect
    .poll(() => readTimeline(page), { message: '没有记录的类别的读回与推导不一致' })
    .toEqual(none);

  // 其余筛选仍有条目
  for (const value of [FILTER_ALL, FILTER_DONE_TASKS, ...CATEGORY_NAMES.filter((n) => n !== emptied)]) {
    await pickFilter(page, value);
    const expected = expectedTimeline(variant, value);
    expect(expected.rows.length, `筛选 ${value} 的期望不应为空`).toBeGreaterThan(0);
    await expect
      .poll(() => readTimeline(page), { message: `筛选 ${value} 的读回与推导不一致（只含 id、日期和固定文案）` })
      .toEqual(expected);
  }
});

test('TL-01 entries across a year boundary get their own month heading in descending order', async ({ page, app }) => {
  const variant = loadFixture('full-state.json');
  variant.logs.push({ id: 'synth-tl-2025', date: '2025-12-31', cat: CAT_OTHER, text: 'SYNTH-TL01 last year' });
  await openTimeline(page, app, variant);

  const expected = expectedTimeline(variant, FILTER_ALL);
  // 防空转：四个月份依次倒序，最后一条是去年的合成记录
  expect(expected.months).toEqual([monthTitle(2026, 3), monthTitle(2026, 2), monthTitle(2026, 1), monthTitle(2025, 12)]);
  expect(expected.rows[expected.rows.length - 1].id).toBe('synth-tl-2025');
  await expect
    .poll(() => readTimeline(page), { message: '跨年时间线读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(expected);
});

test('TL-01 a new entry and a newly checked custom todo appear in the timeline in date order', async ({ page, app }) => {
  const NEW_TEXT = 'SYNTH-TL01 new entry';
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  // 在本周记一条合成记录
  const c = composer(page, 'w');
  await c.type(NEW_TEXT);
  await c.submit();
  await expectToast(page, TOAST_RECORDED);
  await app.expectSaved((s) => s.logs.some((l: { text: string }) => l.text === NEW_TEXT), '等待保存后出现新记录');
  const afterLog = await app.saved();
  const newLog = afterLog.logs.find((l: { text: string }) => l.text === NEW_TEXT);

  await gotoTimeline(page);
  await expect
    .poll(() => readTimeline(page), { message: '新增记录后的时间线读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(expectedTimeline(afterLog, FILTER_ALL));
  const readLog = (await readTimeline(page)).rows.find((r) => r.id === newLog.id);
  expect(readLog?.date).toBe(timelineDateLabel(FROZEN_TODAY));

  // 在目标页勾选合成待办 c-synth-3（属性和文字都是合成的，可以真实点击）
  await gotoGoals(page);
  await page.locator('#goals [data-task="c-synth-3"]').click();
  await expectToast(page, TOAST_TASK_DONE);
  await app.expectSaved(
    (s) => s.tasks?.['c-synth-3']?.done === true && s.tasks['c-synth-3'].doneDate === FROZEN_TODAY,
    '等待保存后 c-synth-3 已完成并记到今天',
  );
  const afterTask = await app.saved();

  await gotoTimeline(page);
  await expect
    .poll(() => readTimeline(page), { message: '勾选待办后的时间线读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(expectedTimeline(afterTask, FILTER_ALL));

  await pickFilter(page, FILTER_DONE_TASKS);
  await expect
    .poll(() => readTimeline(page), { message: '勾选待办后“完成的计划”读回与推导不一致（只含 id、日期和固定文案）' })
    .toEqual(expectedTimeline(afterTask, FILTER_DONE_TASKS));
  const synthRow = (await readTimeline(page)).rows.find((r) => r.id === 'c-synth-3');
  expect(synthRow?.date).toBe(timelineDateLabel(FROZEN_TODAY));
});
