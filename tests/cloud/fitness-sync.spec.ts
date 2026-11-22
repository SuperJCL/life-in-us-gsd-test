// 云端 tracer（FIT-05）：健身页保存的训练按「wo:<日期>」上传到服务器 state 文档，同账号第二台设备的本周页有同一行。
// 只用 FakePbServer 的合成账号和合成数据；动作名（合成的 SYNTH-fs 力量项）只做相等比较，不拼进失败消息。
import { test, expect, type Page } from '../support/test';
import { openDevice } from '../support/devices';
import { FROZEN_NOW, FROZEN_TODAY } from '../support/constants';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import {
  CONFIRM_IMPORT_TITLE,
  IMPORT_KIND_FULL,
  IMPORT_KIND_LEGACY,
  IMPORT_KIND_PLAN,
  IMPORT_REPLACE_FULL,
  IMPORT_REPLACE_LEGACY,
  IMPORT_REPLACE_PLAN,
  IMPORT_UNDO_NOTE,
  TAB_LABELS,
  TOAST_IMPORTED,
  TOAST_UNDONE,
  fitRow,
  importCurrentLine,
  importLogsLine,
  importMoreLine,
  importPlanLine,
  importWoLine,
} from '../support/strings';
import { downloadOf } from '../support/download';
import { fullBackup, legacyBackup, planOnlyFile } from '../support/backup-files';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { chooseImportFile, jsonImportFile } from '../support/import-file';
import { expectToast } from '../support/toast';
import { flAddLift, flFillSet, flSave, gotoFitness, readCharts, readFl, readHistory, readLiftGoals, readWeekWo } from '../support/fitness';
import { syntheticPlan, syntheticState } from '../support/cloud-data';

test.use({ acceptDownloads: true });

test('FIT-05 a training saved on the fitness tab is uploaded under its per-day key and shows in the week view of another device of the same account', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const seed = syntheticState('fs');
  await app.open({ mode: 'cloud', seed, plan: syntheticPlan('fs', 1), login: 0 });

  // 记下每次写缓存时带的 touched，免得和上传抢时间（上传后 touched 会清空）
  const cacheKey = `usj:v2:${app.fake.users[0].id}:state`;
  await page.evaluate((k) => {
    const seen: string[] = [];
    (window as any).__touchedSeen = seen;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === k) {
        try {
          const t = JSON.parse(value).touched;
          if (Array.isArray(t)) seen.push(...t);
        } catch {
          /* 只记录，不影响写入 */
        }
      }
      return orig.call(this, key, value);
    };
  }, cacheKey);

  await gotoFitness(page);
  await flAddLift(page, 'l-fs1');
  await flFillSet(page, 'l-fs1', 0, '30', '5');
  await flSave(page);

  const expected = { [FROZEN_TODAY]: { lifts: [{ id: 'l-fs1', sets: [{ w: 30, r: 5 }] }], cardio: [] } };
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待训练上传到 state 文档' })
    .toBe(JSON.stringify(expected));
  expect((app.fake.lastState(0).logs as unknown[]).length).toBe(seed.logs.length);
  const touched = await page.evaluate(() => (window as any).__touchedSeen as string[]);
  expect(touched).toContain(`wo:${FROZEN_TODAY}`);

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await expect(second.page.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`)).toBeVisible();
    const row = await readWeekWo(second.page, FROZEN_TODAY);
    expect(row !== null && row.text === fitRow('SYNTH-fs lift（共 1 组）')).toBe(true);
  } finally {
    await second.context.close();
  }
});

test('FIT-05 a JSON backup carries the trainings, and importing a full backup with trainings in the cloud version shows the training days in the summary, replaces the trainings and can be undone (IO-08)', async ({
  app,
  page,
}) => {
  const plan = syntheticPlan('fi', 2);
  const own = {
    '2026-03-10': { lifts: [{ id: 'l-fi1', sets: [{ w: 20, r: 5 }] }], cardio: [] },
    '2026-03-12': { lifts: [{ id: 'l-fi1', sets: [{ w: 22, r: 5 }, { w: 22, r: 4 }] }], cardio: [] },
  };
  const seed = { ...syntheticState('fi'), workouts: own };
  await app.open({ mode: 'cloud', seed, plan, login: 0 });
  await expect.poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null)).toBe(JSON.stringify(own));

  // 下载的 JSON 备份：state.workouts 等于服务器上的
  const { text } = await downloadOf(page, () => page.locator('#exportJson').click());
  const backup = JSON.parse(text);
  expect(backup.kind, 'full backup').toBe('full');
  expect(backup.state.workouts, 'the backup carries the trainings of the account').toEqual(app.fake.lastState(0).workouts);
  expect(Object.keys(backup.state.workouts), 'two training days in the file').toEqual(['2026-03-10', '2026-03-12']);

  // 另造一份完整备份：同一份计划，训练只有 2026-03-15 一天（不在冻结周里），两条文字记录
  const incoming = { '2026-03-15': { lifts: [{ id: 'l-fi1', sets: [{ w: 25, r: 6 }] }], cardio: [] } };
  const file = fullBackup(plan, legacyBackup('fiw', { tasks: {}, custom: [], lifts: {}, workouts: incoming }));
  await chooseImportFile(page, jsonImportFile('synth-with-workouts.json', file));
  const confirm = await readConfirm(page);
  expect(confirm.title).toBe(CONFIRM_IMPORT_TITLE);
  expect(confirm.lines, 'summary has the training days line right after the counts line').toEqual([
    IMPORT_KIND_FULL,
    IMPORT_REPLACE_FULL,
    importLogsLine(2, '2026-02-10', '2026-03-17'),
    importMoreLine(1, 0, 0),
    importWoLine(1),
    importPlanLine(2, 4, 1),
    importCurrentLine(seed.logs.length),
    IMPORT_UNDO_NOTE,
  ]);
  expect(JSON.stringify(app.fake.lastState(0).workouts), 'nothing is replaced before confirming').toBe(JSON.stringify(own));

  // 确认：服务器上的训练只剩 03-15；本周页没有这一行（不在本周），时间线有
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待服务器训练换成文件里的' })
    .toBe(JSON.stringify(incoming));
  expect(await readWeekWo(page, '2026-03-15'), 'the imported training is outside the visible week').toBeNull();
  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-15"]')).toHaveCount(1);
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-12"]')).toHaveCount(0);

  // 撤销导入：服务器上的训练回到导入前的两天
  await page.locator('#undoImportBtn').click();
  await expectToast(page, TOAST_UNDONE);
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待服务器训练回到导入前' })
    .toBe(JSON.stringify(own));
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-12"]')).toHaveCount(1);
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-15"]')).toHaveCount(0);

  // 没有训练的旧备份：摘要里没有训练那一行（行数和以前一样）
  await chooseImportFile(page, jsonImportFile('synth-no-workouts.json', legacyBackup('fio', { tasks: {}, custom: [], lifts: {} })));
  const legacy = await readConfirm(page);
  expect(legacy.lines, 'a backup without trainings has no training line').toEqual([
    IMPORT_KIND_LEGACY,
    IMPORT_REPLACE_LEGACY,
    importLogsLine(2, '2026-02-10', '2026-03-17'),
    importMoreLine(1, 0, 0),
    importCurrentLine(seed.logs.length),
    IMPORT_UNDO_NOTE,
  ]);
  await confirmCancel(page);
  expect(JSON.stringify(app.fake.lastState(0).workouts), 'cancelling keeps the trainings').toBe(JSON.stringify(own));
});

test('FIT-05 the import summary of a plan with cardio items names how many cardio items it replaces, and a plan without them has no such part (IN-07)', async ({
  app,
  page,
}) => {
  const seed = syntheticState('fp');
  await app.open({ mode: 'cloud', seed, plan: syntheticPlan('fp', 1), login: 0 });
  const plan: any = syntheticPlan('fq', 2);
  plan.cardio = [
    { id: 'r-fq1', n: 'SYNTH-fq run', note: '', target: { kind: 'min', v: 30 } },
    { id: 'r-fq2', n: 'SYNTH-fq walk', note: '' },
  ];
  await chooseImportFile(page, jsonImportFile('synth-with-cardio.json', planOnlyFile(plan)));
  const first = await readConfirm(page);
  expect(first.lines, 'the plan line carries the cardio count').toEqual([
    IMPORT_KIND_PLAN,
    IMPORT_REPLACE_PLAN,
    importPlanLine(2, 4, 1, 2),
    importCurrentLine(seed.logs.length),
    IMPORT_UNDO_NOTE,
  ]);
  await confirmCancel(page);
  await chooseImportFile(page, jsonImportFile('synth-without-cardio.json', planOnlyFile(syntheticPlan('fr', 2))));
  const second = await readConfirm(page);
  expect(second.lines[2], 'no cardio part when the plan has none').toBe(importPlanLine(2, 4, 1));
  await confirmCancel(page);
});

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = new RegExp('/api/collections/journey_docs/records/[^/]+' + String.fromCharCode(36));

// 把记录区切到某一天（草稿是空的，不弹确认）
async function flGoDay(page: Page, date: string) {
  await page.locator('#fl-date').fill(date);
  await expect(page.locator('#fl-date')).toHaveValue(date);
}

test.describe('manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('FIT-05 trainings saved on two devices on different days both survive, and two edits of the same day keep the later save', async ({
    app,
    page,
    context,
    browser,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('fm'), plan: syntheticPlan('fm', 1), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    // 设备 B 听不到设备 A：在它打开之前就拒绝它的实时连接，它只在自己推进时钟时才会拉取
    const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
    try {
      const sp = second.page;
      await sp.clock.install({ time: FROZEN_NOW });
      app.fake.refuseRealtime(true, sp);
      await second.app.open({ mode: 'cloud', login: 0, realtime: false });
      await sp.clock.pauseAt(FROZEN_NOW + 60_000);

      const mine = { lifts: [{ id: 'l-fm1', sets: [{ w: 30, r: 5 }] }], cardio: [] };
      const theirs = { lifts: [{ id: 'l-fm1', sets: [{ w: 20, r: 8 }] }], cardio: [] };
      const serverWorkouts = () => JSON.parse(JSON.stringify(app.fake.lastState(0)?.workouts ?? {}));

      // A 的上传被服务器错误挡住（只对 A 的上下文），在 03-16 记一次；B 在线，在 03-17 记一次。
      // 用 503 而不是拒绝连接：连接被拒（离线）之后应用不再确定自己的操作记录完整，会走 D-03（整份上传、对方的版本留底），
      // 而 503 只是重试状态，操作记录完整，联网后在对方的新版本上重放自己的按天写入。
      const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'status', status: 503, context });
      await gotoFitness(page);
      await flGoDay(page, '2026-03-16');
      await flAddLift(page, 'l-fm1');
      await flFillSet(page, 'l-fm1', 0, '30', '5');
      await flSave(page);
      await page.clock.runFor(1_000);
      await expect(page.locator('#status')).toHaveAttribute('data-state', 'retrying');
      expect(serverWorkouts(), 'the server still has none of the two days').toEqual({});

      await gotoFitness(sp);
      await flGoDay(sp, '2026-03-17');
      await flAddLift(sp, 'l-fm1');
      await flFillSet(sp, 'l-fm1', 0, '20', '8');
      await flSave(sp);
      await sp.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await sp.clock.runFor(1_000);
      await expect.poll(serverWorkouts, { message: '等待设备 B 的训练上传' }).toEqual({ '2026-03-17': theirs });

      // A 联网：两天都在服务器上，内容各自原样
      patchFault.remove();
      await page.locator('#status button').click();
      await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
      await expect.poll(serverWorkouts, { message: '等待设备 A 的训练上传' }).toEqual({ '2026-03-16': mine, '2026-03-17': theirs });

      // 同一天：A 先保存 03-18（两组），B 没有看到 A 的版本，之后保存 03-18（一组）
      await flGoDay(page, FROZEN_TODAY);
      await flAddLift(page, 'l-fm1');
      await flFillSet(page, 'l-fm1', 0, '50', '3');
      await page.locator('[data-flact="addset"]').click();
      await flFillSet(page, 'l-fm1', 1, '50', '3');
      await flSave(page);
      await page.clock.runFor(1_000);
      await expect
        .poll(() => serverWorkouts()[FROZEN_TODAY]?.lifts?.[0]?.sets?.length ?? 0, { message: '等待设备 A 的同一天训练上传' })
        .toBe(2);

      await flGoDay(sp, FROZEN_TODAY);
      await flAddLift(sp, 'l-fm1');
      await flFillSet(sp, 'l-fm1', 0, '20', '8');
      await flSave(sp);
      await sp.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await sp.clock.runFor(1_000);
      // 以后保存的为准：只有一个日期键、一个动作条目、一组；别的两天一天不少
      await expect
        .poll(() => serverWorkouts()[FROZEN_TODAY]?.lifts?.[0]?.sets?.length ?? 0, { message: '等待设备 B 的同一天训练上传' })
        .toBe(1);
      expect(serverWorkouts()).toEqual({ '2026-03-16': mine, '2026-03-17': theirs, [FROZEN_TODAY]: theirs });
      await acknowledgeConsoleErrors(guard, { 'status of 503 ': patchFault.hits });

      // 两台设备最后都显示 B 的版本：B 马上，A 在下一次同步后；三天各一行、都是一组
      const weekRows = async (pg: Page) =>
        Promise.all(['2026-03-16', '2026-03-17', FROZEN_TODAY].map(async (d) => (await readWeekWo(pg, d))?.text ?? null));
      const oneSet = fitRow('SYNTH-fm lift（共 1 组）');
      for (const [name, pg] of [['A', page], ['B', sp]] as const) {
        await expect
          .poll(
            async () => {
              await pg.clock.runFor(2_000);
              return weekRows(pg);
            },
            { message: `等待设备 ${name} 的三天训练行都是一组` },
          )
          .toEqual([oneSet, oneSet, oneSet]);
      }
    } finally {
      await second.context.close();
    }
  });

  test('FIT-05 a state document created after a failed upload that held the waiting slot keeps the local trainings in the working view (WR-01)', async ({
    app,
    page,
    context,
    browser,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    app.fake.refuseRealtime(true);
    await app.open({ mode: 'cloud', seed: syntheticState('fm'), plan: syntheticPlan('fm', 1), login: 0, realtime: false });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
    try {
      const sp = second.page;
      await sp.clock.install({ time: FROZEN_NOW });
      await second.app.open({ mode: 'cloud', login: 0, realtime: false });
      await sp.clock.pauseAt(FROZEN_NOW + 60_000);
      const day = (w: number, r: number) => ({ lifts: [{ id: 'l-fm1', sets: [{ w, r }] }], cardio: [] });
      const serverWorkouts = () => JSON.parse(JSON.stringify(app.fake.lastState(0)?.workouts ?? {}));

      // B 先上传 03-17：服务器上的版本比 A 的基线新、写入者不同
      await gotoFitness(sp);
      await flGoDay(sp, '2026-03-17');
      await flAddLift(sp, 'l-fm1');
      await flFillSet(sp, 'l-fm1', 0, '20', '8');
      await flSave(sp);
      await sp.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await sp.clock.runFor(1_000);
      await expect.poll(serverWorkouts, { message: '等待设备 B 的训练上传' }).toEqual({ '2026-03-17': day(20, 8) });

      // A 在 03-16 记一次，上传被 503 挡住：本趟把 B 的版本放进等待槽、本机操作在它上面重放，上传失败，槽留着
      const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'status', status: 503, context });
      await gotoFitness(page);
      await flGoDay(page, '2026-03-16');
      await flAddLift(page, 'l-fm1');
      await flFillSet(page, 'l-fm1', 0, '30', '5');
      await flSave(page);
      await page.clock.runFor(1_000);
      await expect(page.locator('#status')).toHaveAttribute('data-state', 'retrying');

      // 后台删掉 state 文档：下一趟走创建分支，创建的内容是等待槽加上 A 的操作
      app.fake.dropDocs(0, 'state');
      patchFault.remove();
      await page.locator('#status button').click();
      await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
      await expect
        .poll(serverWorkouts, { message: '等待创建出来的 state 文档' })
        .toEqual({ '2026-03-16': day(30, 5), '2026-03-17': day(20, 8) });

      // A 再记一天：工作视图以创建时的内容为底，不能丢掉刚创建上去的 03-16
      await flGoDay(page, FROZEN_TODAY);
      await flAddLift(page, 'l-fm1');
      await flFillSet(page, 'l-fm1', 0, '50', '3');
      await flSave(page);
      await page.clock.runFor(1_000);
      await expect
        .poll(serverWorkouts, { message: '等待 A 的第三天上传' })
        .toEqual({ '2026-03-16': day(30, 5), '2026-03-17': day(20, 8), [FROZEN_TODAY]: day(50, 3) });
      await acknowledgeConsoleErrors(guard, { 'status of 503 ': patchFault.hits });
    } finally {
      await second.context.close();
    }
  });
});

test("FIT-05 a training saved on one device appears on the other device's fitness tab, history and charts without a reload", async ({
  app,
  page,
  browser,
  guard,
}) => {
  const plan: any = syntheticPlan('fr', 1);
  plan.lifts.push({ id: 'l-fr2', n: 'SYNTH-fr lift 2', unit: 'kg', def: 10, target: 20, note: '' });
  await app.open({ mode: 'cloud', seed: syntheticState('fr'), plan, login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    const sp = second.page;
    await second.app.open({ mode: 'cloud', login: 0 });
    await gotoFitness(page);
    await gotoFitness(sp);
    await expect.poll(() => app.fake.connectionCount(), { message: '两台设备都订阅了实时事件' }).toBe(2);

    // B 在填另一个力量项的一组，不保存
    await flAddLift(sp, 'l-fr2');
    await flFillSet(sp, 'l-fr2', 0, '20', '8');
    await sp.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // A 给第一个力量项记今天 50 × 3
    await flAddLift(page, 'l-fr1');
    await flFillSet(page, 'l-fr1', 0, '50', '3');
    await flSave(page);

    // B 不刷新：本周页今天有训练行；力量目标卡、训练历史、趋势图的最后一个点都是新值；草稿原样保留
    await expect(sp.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`)).toHaveCount(1);
    const goals = await readLiftGoals(sp, ['l-fr1', 'l-fr2']);
    expect(goals.find((g) => g.lift === 'l-fr1')?.value, 'the lift goal card shows the heaviest set of the new training').toBe('50');
    expect((await readHistory(sp)).items[0]?.date, 'the newest history item is today').toBe(FROZEN_TODAY);
    const chart = (await readCharts(sp)).find((c) => c.lift === 'l-fr1');
    expect(chart?.pts[chart.pts.length - 1]?.v, 'the last point of the chart is the new value').toBe('50');
    expect(await readFl(sp), 'the unsaved draft is kept').toEqual([{ id: 'l-fr2', sets: [{ w: '20', r: '8' }] }]);
  } finally {
    await second.context.close();
  }
});

test('FIT-05 a remote redraw of the training history keeps the focus on the edit and delete buttons of an opened training (IN-05)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const old = { lifts: [{ id: 'l-fk1', sets: [{ w: 20, r: 5 }] }], cardio: [] };
  await app.open({ mode: 'cloud', seed: syntheticState('fk', { workouts: { '2026-03-10': old } }), plan: syntheticPlan('fk', 1), login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    const sp = second.page;
    await second.app.open({ mode: 'cloud', login: 0 });
    await gotoFitness(page);
    await gotoFitness(sp);
    await expect.poll(() => app.fake.connectionCount(), { message: '两台设备都订阅了实时事件' }).toBe(2);
    const item = sp.locator('#fh .fh-item[data-fh="2026-03-10"]');
    await item.locator('summary').click();
    const focusedKey = () =>
      sp.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return a && a.closest('#fh') ? `${a.closest('.fh-item')?.getAttribute('data-fh')}:${a.hasAttribute('data-wo') ? 'wo' : a.hasAttribute('data-fhdel') ? 'del' : a.tagName}` : null;
      });
    let n = 0;
    for (const [sel, key] of [['[data-wo]', '2026-03-10:wo'], ['[data-fhdel]', '2026-03-10:del']] as const) {
      await item.locator(sel).focus();
      expect(await focusedKey()).toBe(key);
      // A 记一天新的训练：B 的训练历史在没有刷新的情况下重画，焦点留在原来的按钮上
      n += 1;
      const date = `2026-03-0${n}`;
      await flGoDay(page, date);
      await flAddLift(page, 'l-fk1');
      await flFillSet(page, 'l-fk1', 0, `3${n}`, '5');
      await flSave(page);
      await expect(sp.locator(`#fh .fh-item[data-fh="${date}"]`), 'the history of device B was redrawn').toHaveCount(1);
      expect(await focusedKey(), 'the focus stays on the same button after the redraw').toBe(key);
    }
  } finally {
    await second.context.close();
  }
});

test('FIT-UNIT the weight unit chosen on one device is uploaded with the state and switches the other device without a reload, converting its unsaved draft', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('fu'), plan: syntheticPlan('fu', 1), login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    const sp = second.page;
    await second.app.open({ mode: 'cloud', login: 0 });
    await gotoFitness(page);
    await gotoFitness(sp);
    await expect.poll(() => app.fake.connectionCount(), { message: '两台设备都订阅了实时事件' }).toBe(2);

    // B 在填一组，不保存
    await flAddLift(sp, 'l-fu1');
    await flFillSet(sp, 'l-fu1', 0, '20', '8');
    await sp.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // A 切到 lb：随 state 上传
    await page.locator('[data-wu="lb"]').click();
    await expect.poll(() => app.fake.lastState(0)?.wu ?? null, { message: '等待 wu 上传到 state 文档' }).toBe('lb');

    // B 不刷新：lb 按下，未保存的草稿跟着换成 lb，力量目标卡按 lb 显示
    await expect(sp.locator('[data-wu="lb"]'), 'device B switched to lb').toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => readFl(sp), { message: 'device B draft converted' }).toEqual([{ id: 'l-fu1', sets: [{ w: '44.1', r: '8' }] }]);
    const card = (await readLiftGoals(sp, ['l-fu1'])).find((g) => g.lift === 'l-fu1');
    expect([card?.value, card?.unit], 'the lift goal card shows lb on device B').toEqual(['22', ' lb']);

    // B 保存：存的还是力量项自己的单位（20 kg）
    await flSave(sp);
    await expect
      .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts?.[FROZEN_TODAY]?.lifts ?? null), { message: '等待 B 的训练上传' })
      .toBe(JSON.stringify([{ id: 'l-fu1', sets: [{ w: 20, r: 8 }] }]));
  } finally {
    await second.context.close();
  }
});
