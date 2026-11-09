// 账号数据用例（09-10）：每个账号的个人计划存在自己的 plan 文档里，换一台设备登录看到同一份数据，
// 不合格的计划按示例计划显示且从不被改写。只在 npm run test:cloud 里运行，只用 FakePbServer 的合成账号。
// 所有计划文字都带 SYNTH-<label> 标记（syntheticPlan），负向断言用对方账号的一个标记覆盖它的全部计划文字。
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { openDevice } from '../support/devices';
import { checkTask, gotoGoals, readGroups, readLifts, readTaskRow } from '../support/goals';
import { gotoCalendar, readMonth } from '../support/calendar';
import { gotoTimeline, readTimeline } from '../support/timeline';
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../support/constants';
import { TAB_LABELS } from '../support/strings';

test("PLAN-01 each account sees its own plan and records and none of the other account's content", async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', users: 2 });
  // A：plan 比 state 新建，服务器列表里 plan 在前
  app.fake.seed(syntheticState('a'), { userIndex: 0, plan: syntheticPlan('a', 2) });
  // B：先建 state 和 plan，再删掉 state 重建，使 B 的列表里 state 在前、plan 在后（与 A 相反）
  app.fake.seed(syntheticState('b'), { userIndex: 1, plan: syntheticPlan('b', 3) });
  app.fake.dropDocs(1, 'state');
  app.fake.seed(syntheticState('b'), { userIndex: 1 });

  await app.login(0);

  // 本周视图：预设标签和记录（隐藏的标签页点不到，所以先看本周，再切到目标）
  const wk = composer(page, 'w');
  await wk.pickCategory('语言');
  await expect(wk.presetNamed('SYNTH-a preset')).toBeVisible();
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toBeVisible();
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['g-a1', 'g-a2']);
  await expect(page.locator('#goals')).toContainText('SYNTH-a lift');
  await expect(page.locator('#goals .group.k-fit .note')).toHaveText('SYNTH-a fit note');
  const htmlA = await page.content();
  expect(htmlA).not.toContain('SYNTH-b');
  expect(htmlA).not.toContain('合成记录 b');
  expect(htmlA).not.toContain('synthetic-b');

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 1 });
    const pageB = second.page;

    const wkB = composer(pageB, 'w');
    await wkB.pickCategory('语言');
    await expect(wkB.presetNamed('SYNTH-b preset')).toBeVisible();
    await expect(pageB.locator('#days [data-edit="synthetic-b"]')).toBeVisible();
    await gotoGoals(pageB);
    expect((await readGroups(pageB)).map((g) => g.code)).toEqual(['g-b1', 'g-b2', 'g-b3']);
    await expect(pageB.locator('#goals')).toContainText('SYNTH-b lift');
    await expect(pageB.locator('#goals .group.k-fit .note')).toHaveText('SYNTH-b fit note');
    const htmlB = await pageB.content();
    expect(htmlB).not.toContain('SYNTH-a');
    expect(htmlB).not.toContain('合成记录 a');
    expect(htmlB).not.toContain('synthetic-a');
  } finally {
    await second.context.close();
  }

  // 两个账号的服务器 plan 文档都没有被应用写过
  expect(app.fake.writes.filter((w) => w.path === 'journey_docs:plan')).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-01 records, a review, a task tick and a lift value saved on one device show up in all four views on another device', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a', { logs: [] }), plan: syntheticPlan('a', 2), login: 0 });

  const entry = composer(page, 'w');
  await entry.type('SYNTH-0910 four views');
  await entry.submit();
  await page.locator('#review').fill('SYNTH-0910 review');
  await expect
    .poll(() => app.fake.lastState(0)?.reviews?.[WEEK_START_FROZEN] ?? null, { message: '等待复盘上传到 state 文档' })
    .toBe('SYNTH-0910 review');
  await gotoGoals(page);
  await checkTask(page, 't-a1x1');
  await page.locator('#lf-l-a1').fill('15');
  await page.locator('[data-liftsave="l-a1"]').click();
  await expect
    .poll(
      () => {
        const s = app.fake.lastState(0);
        return {
          log: (s?.logs ?? []).some((l: { text: string }) => l.text === 'SYNTH-0910 four views'),
          review: s?.reviews?.[WEEK_START_FROZEN] ?? null,
          done: s?.tasks?.['t-a1x1']?.done ?? false,
          lift: s?.lifts?.['l-a1']?.cur ?? null,
        };
      },
      { message: '等待四项修改都上传到 state 文档' },
    )
    .toEqual({ log: true, review: 'SYNTH-0910 review', done: true, lift: 15 });
  const id = (app.fake.lastState(0).logs as Array<{ id: string; text: string }>).find((l) => l.text === 'SYNTH-0910 four views')!.id;

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    const p = second.page;

    // 本周
    await expect(p.locator(`#days [data-edit="${id}"]`)).toBeVisible();
    await expect(p.locator('#review')).toHaveValue('SYNTH-0910 review');

    // 日历
    await gotoCalendar(p);
    const cell = (await readMonth(p)).cells.find((c) => c.date === FROZEN_TODAY)!;
    expect(cell.kinds.filter((k) => k === 'log').length).toBeGreaterThanOrEqual(1);
    expect(cell.kinds.filter((k) => k === 'done').length).toBeGreaterThanOrEqual(1);

    // 目标：按 A 自己的计划
    await gotoGoals(p);
    expect((await readGroups(p)).map((g) => g.code)).toEqual(['g-a1', 'g-a2']);
    expect((await readTaskRow(p, 't-a1x1')).isdone).toBe(true);
    const lifts = await readLifts(p, ['l-a1']);
    expect(lifts.cards.find((c) => c.fixtureId === 'l-a1')?.value).toBe('15');

    // 时间线
    await gotoTimeline(p);
    const rows = (await readTimeline(p)).rows;
    expect(rows).toContainEqual(expect.objectContaining({ attr: 'edit', id }));
    expect(rows).toContainEqual(expect.objectContaining({ attr: 'edittask', id: 't-a1x1' }));
  } finally {
    await second.context.close();
  }
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('PLAN-01 a plan document that fails validation is shown as the default plan and is never overwritten', async ({
  app,
  page,
}) => {
  const bad = { _synthetic: true, groups: [] };
  const defaultCodes = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: bad, login: 0 });

  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(defaultCodes);

  // 记一笔要在本周视图里做，先切回本周
  const weekTab = page.getByRole('tab', { name: TAB_LABELS.wk, exact: true });
  await weekTab.click();
  await expect(weekTab).toHaveAttribute('aria-selected', 'true');
  const entry = composer(page, 'w');
  await entry.type('SYNTH-0910 invalid plan entry');
  await entry.submit();
  await expect
    .poll(() => app.fake.requests.filter((r) => r.method === 'PATCH').map((r) => r.status), {
      message: '等待记录写入 state 文档',
    })
    .toEqual([200]);
  expect((app.fake.lastState(0)?.logs ?? []).some((l: { text: string }) => l.text === 'SYNTH-0910 invalid plan entry')).toBe(true);

  await app.reload();
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(defaultCodes);

  expect(app.fake.lastPlan(0)).toEqual(bad);
  expect(app.fake.writes.filter((w) => w.path === 'journey_docs:plan')).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});
