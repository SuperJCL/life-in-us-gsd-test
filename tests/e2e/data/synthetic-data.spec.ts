import { test, expect } from '../../support/test';
import { ARRIVAL_DATE_FIXTURE, FROZEN_TODAY, WEEK_END_FROZEN, WEEK_START_FROZEN } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { builtinTaskIds, customTasks, logsInWeek, logsOutsideWeek, taskBuckets } from '../../support/expect-from-fixture';
import { BUILTIN_TASK_IDS, LIFT_IDS } from '../../support/task-ids';
import {
  CAT_LANGUAGE,
  CATEGORY_NAMES,
  GOAL_OVERDUE,
  LIFT_HISTORY_PREFIX,
  TAB_LABELS,
} from '../../support/strings';

const SYNTH_PREFIX = 'SYNTH-';

test('DATA-01 the full fixture loads through the account mock and shows a current-week entry for each of the five categories', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  // 本周记录覆盖五个类别（期望由 helper 从 fixture 推导，类别集合来自常量）
  const week = logsInWeek(fixture, WEEK_START_FROZEN, WEEK_END_FROZEN);
  expect([...new Set(week.map((l) => l.cat))].sort()).toEqual([...CATEGORY_NAMES].sort());

  // 每条本周记录都出现在本周视图对应日期的列里
  for (const log of week) {
    await expect(page.locator(`#tab-wk [data-wday="${log.date}"] [data-edit="${log.id}"]`)).toBeVisible();
  }
});

test('DATA-01 the full fixture covers every state later phases rely on', async () => {
  const fixture = loadFixture('full-state.json');
  const week = logsInWeek(fixture, WEEK_START_FROZEN, WEEK_END_FROZEN);
  const outside = logsOutsideWeek(fixture, WEEK_START_FROZEN, WEEK_END_FROZEN);

  // 记录的时间分布：本周五个类别、本周之前、本周之后、上一个月、抵达日
  expect([...new Set(week.map((l) => l.cat))].sort()).toEqual([...CATEGORY_NAMES].sort());
  expect(outside.some((l) => l.date < WEEK_START_FROZEN)).toBe(true);
  expect(outside.some((l) => l.date > WEEK_END_FROZEN)).toBe(true);
  expect(outside.some((l) => l.date.slice(0, 7) < WEEK_START_FROZEN.slice(0, 7))).toBe(true);
  expect(fixture.logs.some((l: any) => l.date === ARRIVAL_DATE_FIXTURE)).toBe(true);

  // 所有文字都是合成的
  for (const l of fixture.logs) expect(l.text.startsWith(SYNTH_PREFIX), `记录 ${l.id}`).toBe(true);
  for (const c of customTasks(fixture)) expect(c.text.startsWith(SYNTH_PREFIX), `自定义待办 ${c.id}`).toBe(true);
  for (const [d, text] of Object.entries<string>(fixture.reviews)) {
    expect(text.startsWith(SYNTH_PREFIX), `复盘 ${d}`).toBe(true);
  }
  for (const [cat, p] of Object.entries<any>(fixture.presets)) {
    for (const t of [...p.add, ...p.hide]) expect(t.startsWith(SYNTH_PREFIX), `预设标签 ${cat}/${t}`).toBe(true);
  }

  // 特殊字符：引号、逗号、换行且首行很长；尖括号、&、单引号
  expect(
    fixture.logs.some(
      (l: any) =>
        l.text.includes('"') && l.text.includes(',') && l.text.includes('\n') && l.text.split('\n')[0].length > 80,
    ),
  ).toBe(true);
  expect(fixture.logs.some((l: any) => l.text.includes('<') && l.text.includes('&') && l.text.includes("'"))).toBe(true);

  // 任务状态
  const buckets = taskBuckets(fixture, FROZEN_TODAY);
  expect(buckets.done.length).toBeGreaterThan(0);
  expect(buckets.overdue.length).toBeGreaterThan(0);
  expect(buckets.dueToday.length).toBeGreaterThan(0);
  expect(buckets.dueFuture.length).toBeGreaterThan(0);
  expect(
    buckets.done.some((id) => {
      const d = fixture.tasks[id].doneDate;
      return d >= WEEK_START_FROZEN && d <= WEEK_END_FROZEN;
    }),
  ).toBe(true);

  // 自定义待办：有截止的、已完成的、tasks 里没有状态的
  const custom = customTasks(fixture);
  expect(custom.some((c) => fixture.tasks[c.id]?.due)).toBe(true);
  expect(custom.some((c) => fixture.tasks[c.id]?.done)).toBe(true);
  expect(custom.some((c) => !(c.id in fixture.tasks))).toBe(true);

  // 力量历史
  const liftIds: readonly string[] = LIFT_IDS;
  expect(Object.keys(fixture.lifts).every((k) => liftIds.includes(k))).toBe(true);
  expect(Object.values<any>(fixture.lifts).some((l) => l.hist.length >= 2)).toBe(true);

  // 复盘、预设标签增删
  expect(fixture.reviews[WEEK_START_FROZEN].length).toBeGreaterThan(0);
  const presets = Object.values<any>(fixture.presets);
  expect(presets.some((p) => p.add.length > 0)).toBe(true);
  expect(presets.some((p) => p.hide.length > 0)).toBe(true);

  // 抵达日期、内置任务 id、记录 id 唯一
  expect(fixture.arrival).toBe(ARRIVAL_DATE_FIXTURE);
  expect(new Set(builtinTaskIds(fixture))).toEqual(new Set(Object.values(BUILTIN_TASK_IDS)));
  const ids = fixture.logs.map((l: any) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('DATA-01 the full fixture renders logs, task states, custom todos, lift history, the weekly review, preset tags and the arrival date', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  // 本周视图：抵达日期、本周复盘、虚构预设标签（记一笔默认类别是语言）
  await expect(page.locator('#arrival')).toHaveValue(ARRIVAL_DATE_FIXTURE);
  await expect(page.locator('#review')).toHaveValue(fixture.reviews[WEEK_START_FROZEN]);
  await expect(page.locator(`#wkComp [data-preset="w|${fixture.presets[CAT_LANGUAGE].add[0]}"]`)).toBeVisible();

  // 时间线：每条记录的文字按原文显示
  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
  for (const log of fixture.logs) {
    await expect(page.locator(`#tab-tl [data-edit="${log.id}"] .li-text`), `时间线记录 ${log.id}`).toHaveText(log.text);
  }
  // 含 < 的记录：不生成 b 元素，原文照常显示
  const htmlLog = fixture.logs.find((l: any) => l.text.includes('<'));
  const htmlText = page.locator(`#tab-tl [data-edit="${htmlLog.id}"] .li-text`);
  await expect(htmlText.locator('b')).toHaveCount(0);
  await expect(htmlText).toContainText('<b>bold</b>');

  // 目标视图
  await page.getByRole('tab', { name: TAB_LABELS.goal, exact: true }).click();
  const task = (id: string) => page.locator(`#goals [data-task="${id}"]`);
  const row = (id: string) => page.locator('#goals .task').filter({ has: page.locator(`[data-task="${id}"]`) });
  for (const id of builtinTaskIds(fixture)) {
    await expect(
      task(id),
      `内置任务 id 在页面上不存在：应用源码里的任务顺序可能变了，更新 tests/support/task-ids.ts（${id}）`,
    ).toHaveCount(1);
  }
  const buckets = taskBuckets(fixture, FROZEN_TODAY);
  for (const id of buckets.done) await expect(task(id), `已完成 ${id}`).toBeChecked();
  for (const id of buckets.overdue) await expect(row(id).locator('.od'), `已过期 ${id}`).toHaveText(GOAL_OVERDUE);
  for (const id of [...buckets.dueToday, ...buckets.dueFuture]) {
    await expect(page.locator(`#goals [data-due="${id}"]`), `截止日期 ${id}`).toHaveValue(fixture.tasks[id].due);
    await expect(row(id).locator('.od'), `未过期 ${id}`).toHaveCount(0);
  }
  for (const c of customTasks(fixture)) {
    await expect(task(c.id)).toHaveAttribute('aria-label', c.text);
    await expect(page.locator(`#goals [data-deltask="${c.id}"]`), `自定义待办的删除按钮 ${c.id}`).toHaveCount(1);
  }
  for (const [id, lift] of Object.entries<any>(fixture.lifts)) {
    await expect(page.locator(`#lf-${id}`)).toHaveValue(String(lift.cur));
    await expect(page.locator('#goals .lift').filter({ has: page.locator(`#lf-${id}`) }).locator('.hist')).toContainText(
      LIFT_HISTORY_PREFIX,
    );
  }
});
