// 本文件覆盖 CAL-03（日面板的标题、副标题、分区，在日面板记一笔）、CAL-04（日面板删除加撤销）和 D-11（撤销 toast 过期）。
// 视图用例默认账户模式加完整 fixture（D-06），期望值由 expect-from-fixture.ts 的 expectedDayPanel 推导。
// 隐私（D-05）：“完成的计划”“这天到期”条目带个人计划原文，只经 tests/support/calendar.ts 的 page.evaluate
// 读回 id 和组号，不对它们做定位器动作、文字断言或可见性断言。
// 日面板记录的删除按钮（data-dellog）只带记录 id 和固定的 aria-label，所以可以用定位器点。
// 带撤销的 toast 只显示 5 秒且全局只有一个共享计时器，所以删除加撤销、toast 过期这两组用例用 manual 时钟，
// 让撤销窗口不依赖真实时间（D-04、D-11）。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { composer } from '../../support/composer';
import { gotoCalendar, readDayPanel, readMonth } from '../../support/calendar';
import { FROZEN_NOW, FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import {
  composerWhenLabel,
  dayPanelTitle,
  expectedDayPanel,
  expectedMonthCells,
} from '../../support/expect-from-fixture';
import { expectToast, expectToastGone, expectUndoOffered, undo } from '../../support/toast';
import { CAT_LANGUAGE, TOAST_LOG_DELETED, TOAST_RECORDED, TOAST_RESTORED } from '../../support/strings';

type Log = { id: string; text: string; cat: string; date: string };

// 账户模式加完整 fixture 开局，并打开日历标签
async function openCalendar(page: Page, app: AppHarness, state: any) {
  await app.open({ mode: 'account', seed: state });
  await app.expectAccountMode();
  await gotoCalendar(page);
}

// 点格子并确认日面板已切到那一天
async function pickDay(page: Page, date: string) {
  await page.locator(`#grid [data-date="${date}"]`).click();
  await expect(page.locator('#dayPanel > h3')).toHaveText(dayPanelTitle(date));
}

test('CAL-03 the day panel for today shows the title, the arrival day count and three sections derived from the fixture', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await openCalendar(page, app, fixture);

  // 防空转：今天既有记录，也有完成的计划和到期的计划，所以三个分区都应当出现
  const expected = expectedDayPanel(fixture, FROZEN_TODAY);
  expect(expected.sections).toHaveLength(3);
  expect(expected.doneIds.length).toBeGreaterThan(0);
  expect(expected.dueGroups.length).toBeGreaterThan(0);
  expect(expected.logIds.length).toBeGreaterThan(0);

  await expect
    .poll(() => readDayPanel(page), { message: '今天的日面板与 fixture 推导不一致（只含 id、组号和固定文案）' })
    .toEqual(expected);
});

test('CAL-03 a day without entries shows the empty hint and days before and on arrival show the year or day one', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await openCalendar(page, app, fixture);

  // 3 月 19 日：没有任何事件，只有“做过的事”和空提示
  await pickDay(page, '2026-03-19');
  const empty = expectedDayPanel(fixture, '2026-03-19');
  expect(empty.empty).not.toBeNull();
  expect(empty.sections).toHaveLength(1);
  await expect
    .poll(() => readDayPanel(page), { message: '3 月 19 日的日面板与推导不一致（只含 id、组号和固定文案）' })
    .toEqual(empty);

  // 3 月 10 日：没有记录，有完成的自定义计划和到期的内置计划
  await pickDay(page, '2026-03-10');
  const plansOnly = expectedDayPanel(fixture, '2026-03-10');
  expect(plansOnly.logIds).toHaveLength(0);
  expect(plansOnly.doneIds.length).toBeGreaterThan(0);
  expect(plansOnly.dueGroups.length).toBeGreaterThan(0);
  await expect
    .poll(() => readDayPanel(page), { message: '3 月 10 日的日面板与推导不一致（只含 id、组号和固定文案）' })
    .toEqual(plansOnly);

  // 翻到 1 月：抵达之前的副标题是年份，抵达当天是来美国第 1 天并且有一条记录
  await page.locator('#prev').click();
  await page.locator('#prev').click();
  await pickDay(page, '2026-01-05');
  const before = expectedDayPanel(fixture, '2026-01-05');
  await expect
    .poll(() => readDayPanel(page), { message: '1 月 5 日的日面板与推导不一致（只含 id、组号和固定文案）' })
    .toEqual(before);

  await pickDay(page, '2026-01-12');
  const arrival = expectedDayPanel(fixture, '2026-01-12');
  expect(arrival.logIds.length).toBeGreaterThan(0);
  await expect
    .poll(() => readDayPanel(page), { message: '抵达当天的日面板与推导不一致（只含 id、组号和固定文案）' })
    .toEqual(arrival);
  expect(before.sub).not.toEqual(arrival.sub);
});

test('CAL-03 recording from the day panel composer saves the entry on the selected day and shows it in the cell', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await openCalendar(page, app, fixture);

  const day = '2026-03-19';
  const text = 'SYNTH-CAL03 recorded from the day panel';
  await pickDay(page, day);

  const c = composer(page, 'c');
  await expect(c.when).toHaveText(composerWhenLabel(day));
  await c.type(text);
  await c.submit('click');
  await expectToast(page, TOAST_RECORDED);

  // 保存后多了一条：文字、日期都是选中日，类别是日面板 composer 的默认类别
  await app.expectSaved(
    (s) =>
      s.logs.length === fixture.logs.length + 1 &&
      s.logs.some((l: Log) => l.text === text && l.date === day && l.cat === CAT_LANGUAGE),
    '等待保存后出现在选中日的新记录',
  );

  // 日面板和那一格都按保存后的状态推导，文本框已清空
  const saved = await app.saved();
  await expect
    .poll(() => readDayPanel(page), { message: '记录后的日面板与保存状态的推导不一致（只含 id、组号和固定文案）' })
    .toEqual(expectedDayPanel(saved, day));
  await expect
    .poll(async () => (await readMonth(page)).cells, { message: '记录后的网格与保存状态的推导不一致' })
    .toEqual(expectedMonthCells(saved, 2026, 3, FROZEN_TODAY, day));
  await expect(c.text).toHaveValue('');
});

// 带撤销的 toast 只显示 5 秒且只有一个共享计时器：用 manual 时钟让窗口不依赖真实时间（D-04、D-11）。
// 顺序固定：install、open、expectAccountMode、pauseAt，再操作、runFor。同一个用例里不混用 setFixedTime
test.describe('CAL-04 undo window on a manual clock', () => {
  test.use({ clockMode: 'manual' });

  const id = 'synth-full-04';

  async function openPaused(page: Page, app: AppHarness, fixture: any) {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await gotoCalendar(page);
  }

  test('CAL-04 the delete button in the day panel deletes without opening the editor and undo restores the entry', async ({
    page,
    app,
  }) => {
    const fixture = loadFixture('full-state.json');
    await openPaused(page, app, fixture);
    const fixtureIdsJson = JSON.stringify(fixture.logs.map((l: Log) => l.id));

    await page.locator(`#dayPanel [data-dellog="${id}"]`).click();

    // 只删除：编辑弹窗没有打开，选中日不变，记录从日面板消失
    await expect(page.locator('dialog#editor')).not.toHaveAttribute('open', /.*/);
    await expect(page.locator(`#grid [data-date="${FROZEN_TODAY}"]`)).toHaveClass(/\bsel\b/);
    await expect(page.locator('#dayPanel > h3')).toHaveText(dayPanelTitle(FROZEN_TODAY));
    await expect(page.locator(`#dayPanel [data-edit="${id}"]`)).toHaveCount(0);
    await expectToast(page, TOAST_LOG_DELETED);
    await expectUndoOffered(page);

    // 只推过 600 ms 防抖（远小于 5 秒的撤销窗口）：删除已保存
    await page.clock.runFor(1_000);
    await app.expectSaved(
      (s) => s.logs.every((l: Log) => l.id !== id) && s.logs.length === fixture.logs.length - 1,
      '等待保存后的记录里没有被删除的这条',
    );

    // 撤销：toast 为已恢复，记录回到原位置，保存后的 id 顺序与 fixture 完全相同
    await undo(page);
    await expectToast(page, TOAST_RESTORED);
    await expect
      .poll(async () => (await readDayPanel(page)).logIds, { message: '撤销后日面板的记录 id 与推导不一致' })
      .toEqual(expectedDayPanel(fixture, FROZEN_TODAY).logIds);
    await page.clock.runFor(1_000);
    await app.expectSaved(
      (s) => JSON.stringify(s.logs.map((l: Log) => l.id)) === fixtureIdsJson,
      '等待保存后的记录顺序与 fixture 相同',
    );
  });

  test('CAL-04 the undo toast expires after five seconds and the deletion stays saved', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    await openPaused(page, app, fixture);

    await page.locator(`#dayPanel [data-dellog="${id}"]`).click();
    await expectUndoOffered(page);

    await page.clock.runFor(1_000);
    await app.expectSaved((s) => s.logs.every((l: Log) => l.id !== id), '等待保存后的记录里没有被删除的这条');
    const writesAfterDelete = app.backend.writes.length;

    // 钉住 5000 ms 的边界：t=1900 时仍在（排除与普通 toast 相同的 1800 ms），t=4900 时仍在，t=5100 时已消失
    await page.clock.runFor(900);
    await expectUndoOffered(page);
    await page.clock.runFor(3_000);
    await expectUndoOffered(page);

    // 越过 5 秒：toast 失去 on 和 act，撤销按钮不再存在，删除仍是已保存的状态
    await page.clock.runFor(200);
    await expectToastGone(page);
    const act = await page.evaluate(() => !!document.querySelector('#toast')?.classList.contains('act'));
    expect(act, 'toast 过期后不应再带 act 类').toBe(false);
    await expect(page.locator('#toast.act button')).toHaveCount(0);

    // 再推过一段时间：没有新的写入，保存里和日面板里都没有那条记录
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length, '过期之后不应有新的写入').toBe(writesAfterDelete);
    const saved = await app.saved();
    expect(saved.logs.some((l: Log) => l.id === id)).toBe(false);
    expect((await readDayPanel(page)).logIds.includes(id)).toBe(false);
  });
});
