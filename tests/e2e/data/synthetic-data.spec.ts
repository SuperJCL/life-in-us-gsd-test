import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { ARRIVAL_DATE_FIXTURE, FROZEN_TODAY, WEEK_END_FROZEN, WEEK_START_FROZEN } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import {
  builtinTaskIds,
  customTasks,
  expectedCategory,
  logsInWeek,
  logsOutsideWeek,
  taskBuckets,
} from '../../support/expect-from-fixture';
import { MALFORMED_IMPORTS, MALFORMED_WORKOUT_IMPORTS, type MalformedKind } from '../../fixtures/malformed-imports';
import { BUILTIN_TASK_IDS, LIFT_IDS, ALL_LIFT_IDS } from '../../support/task-ids';
import { gotoFitness, readCharts, readLiftGoals, setRange } from '../../support/fitness';
import {
  CAT_LANGUAGE,
  CATEGORY_NAMES,
  GOAL_OVERDUE,
  LEGACY_CATEGORY_MAP,
  TAB_LABELS,
  TIMELINE_EMPTY,
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
  // 不用 toBeChecked：失败日志会打印复选框元素预览，其中 aria-label 是内置任务文字。
  // 改用 :checked 选择器加 toHaveCount，日志里只有元素个数（D-14）
  for (const id of buckets.done) {
    await expect(page.locator(`#goals [data-task="${id}"]:checked`), `已完成 ${id}`).toHaveCount(1);
  }
  for (const id of buckets.overdue) await expect(row(id).locator('.od'), `已过期 ${id}`).toHaveText(GOAL_OVERDUE);
  for (const id of [...buckets.dueToday, ...buckets.dueFuture]) {
    await expect(page.locator(`#goals [data-due="${id}"]`), `截止日期 ${id}`).toHaveValue(fixture.tasks[id].due);
    await expect(row(id).locator('.od'), `未过期 ${id}`).toHaveCount(0);
  }
  for (const c of customTasks(fixture)) {
    await expect(task(c.id)).toHaveAttribute('aria-label', c.text);
    await expect(page.locator(`#goals [data-deltask="${c.id}"]`), `自定义待办的删除按钮 ${c.id}`).toHaveCount(1);
  }
  // 力量项目在健身页（Phase 15 起）：fixture 没有训练，当前值回落到手填的 cur；趋势图「全部」范围里空心点的个数等于手填历史里不晚于今天的点数
  await gotoFitness(page);
  const goals = await readLiftGoals(page, ALL_LIFT_IDS);
  for (const [id, lift] of Object.entries<any>(fixture.lifts)) {
    const card = goals.find((c) => c.lift === id);
    expect(card?.value === String(lift.cur), `力量项目 ${id} 的当前值应当等于 fixture 的 cur（内容已隐藏）`).toBe(true);
  }
  await setRange(page, 'all');
  const charts = await readCharts(page);
  for (const [id, lift] of Object.entries<any>(fixture.lifts)) {
    const expected = lift.hist.filter((h: any) => h.date <= FROZEN_TODAY).length;
    const hollow = charts.find((c) => c.lift === id)?.pts.filter((p) => p.old).length;
    expect(hollow, `力量项目 ${id} 的趋势图空心点个数应当等于手填历史里不晚于今天的点数`).toBe(expected);
  }
});

test('DATA-02 the legacy-categories fixture loads with old category names mapped to current ones', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('legacy-categories.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();

  // 每条记录的类别标签等于按 normalize 规格推导的新类别
  for (const log of fixture.logs) {
    await expect(page.locator(`#tab-tl [data-edit="${log.id}"] .tag`), `记录 ${log.id}`).toHaveText(
      expectedCategory(log.cat),
    );
  }
  // 页面上不再出现旧类别名，也不出现未知类别的原名
  const tags = await page.locator('#tab-tl .tag').allTextContents();
  for (const gone of [...Object.keys(LEGACY_CATEGORY_MAP), 'SYNTH-unknown-cat']) {
    expect(tags, `页面上不应再有类别 ${gone}`).not.toContain(gone);
  }
});

test('DATA-02 the minimal fixture loads as an empty state', async ({ page, app }) => {
  await app.open({ mode: 'account', seed: loadFixture('minimal-state.json') });
  await app.expectAccountMode();

  await expect(page.locator('#tab-wk [data-edit]')).toHaveCount(0);
  await expect(page.locator('#arrival')).toHaveValue('');
  await expect(page.locator('#review')).toHaveValue('');

  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
  await expect(page.locator('#timeline .empty')).toHaveText(TIMELINE_EMPTY);
});

test('DATA-02 malformed import payloads stay in memory, carry the synthetic marker and are really malformed', async () => {
  const fixturesDir = path.join(__dirname, '..', '..', 'fixtures');
  expect(MALFORMED_IMPORTS.length).toBeGreaterThan(0);
  const kinds = new Set<MalformedKind>(MALFORMED_IMPORTS.map((m) => m.kind));
  expect([...kinds].sort()).toEqual(['json-not-object', 'json-wrong-field-types', 'not-json']);

  const isPlainObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v);
  for (const m of MALFORMED_IMPORTS) {
    // 名字不像备份，也不像改名前后的应用导出文件，磁盘上也没有同名文件
    expect(m.name.includes('备份'), m.name).toBe(false);
    expect(m.name.startsWith('在美国的日子-'), m.name).toBe(false);
    expect(m.name.startsWith('计划手记-'), m.name).toBe(false);
    expect(fs.existsSync(path.join(fixturesDir, m.name)), `${m.name} 不应落盘`).toBe(false);

    if (m.kind === 'not-json') {
      expect(() => JSON.parse(m.text), m.name).toThrow();
    } else if (m.kind === 'json-not-object') {
      const parsed = JSON.parse(m.text);
      expect(parsed === null || Array.isArray(parsed), m.name).toBe(true);
    } else {
      const parsed = JSON.parse(m.text);
      expect(isPlainObject(parsed), m.name).toBe(true);
      const wrongTypes =
        !Array.isArray(parsed.logs) ||
        !Array.isArray(parsed.custom) ||
        ['tasks', 'lifts', 'reviews', 'presets'].some((k) => k in parsed && !isPlainObject(parsed[k])) ||
        typeof parsed.arrival !== 'string';
      expect(wrongTypes, `${m.name} 至少一个字段类型要错`).toBe(true);
    }
  }

  // Phase 15：三个坏训练备份也只在内存里、带合成标记，并且 workouts 里确实有一处不合格（真实日期、力量 id、有氧 id 各一）
  expect(MALFORMED_WORKOUT_IMPORTS.length).toBe(3);
  const realDay = (k: string) => {
    const t = new Date(Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10))));
    return /^\d{4}-\d{2}-\d{2}$/.test(k) && t.toISOString().slice(0, 10) === k;
  };
  const badOnes = MALFORMED_WORKOUT_IMPORTS.map((m) => {
    expect(fs.existsSync(path.join(fixturesDir, m.name)), `${m.name} 不应落盘`).toBe(false);
    const parsed = JSON.parse(m.text);
    expect(String(parsed._synthetic).startsWith('SYNTH'), `${m.name} 带合成标记`).toBe(true);
    return Object.entries(parsed.workouts as Record<string, any>).some(
      ([k, day]) =>
        !realDay(k) ||
        day.lifts.some((x: any) => !/^([a-z]{1,16}|l-[A-Za-z0-9_-]{1,40})$/.test(x.id)) ||
        day.cardio.some((x: any) => !/^r-[A-Za-z0-9_-]{1,40}$/.test(x.id)),
    );
  });
  expect(badOnes, '三个备份的 workouts 都要有不合格的一处').toEqual([true, true, true]);

  // 常量文件自己带合成标记
  expect(fs.readFileSync(path.join(fixturesDir, 'malformed-imports.ts'), 'utf8')).toContain('_synthetic');
});
