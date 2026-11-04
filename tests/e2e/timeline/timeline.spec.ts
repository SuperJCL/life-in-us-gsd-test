// 本文件覆盖 TL-01、TL-02：时间线按月倒序列出记录和完成的计划，类别和“完成的计划”筛选，空状态，跨年，以及新增内容后的联动。
// 期望值全部由 tests/support/expect-from-fixture.ts 的独立推导 expectedTimeline 从 fixture（或保存后的状态）算出。
// 隐私（D-07）：完成的计划条目的文字是个人计划原文，只经 tests/support/timeline.ts 的一次 page.evaluate
// 读回 id、日期和所属月份标题，不对它做定位器动作、文字断言或可见性断言。
// 所有用例账户模式开局并立刻 expectAccountMode（D-06）；fixture 变体只在用例内存里构造。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { expectedTimeline, monthTitle, timelineDateLabel } from '../../support/expect-from-fixture';
import { FILTER_ALL } from '../../support/strings';
import { gotoTimeline, readTimeline } from '../../support/timeline';

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
