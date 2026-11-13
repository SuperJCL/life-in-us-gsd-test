// 健身页记录区的云端用例（Phase 15-02）：只在 npm run test:cloud 里运行，只用 FakePbServer 的合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案；计划文字都带 `SYNTH-<label>`，只做相等比较。
import { test, expect } from '../support/test';
import { openDevice } from '../support/devices';
import { FakePbServer } from '../mocks/pb-server';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { FROZEN_NOW, FROZEN_TODAY } from '../support/constants';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { expectToast } from '../support/toast';
import {
  BTN_FL_GO_PLAN,
  FC_METRIC,
  FC_RANGE,
  FL_CARDIO_NONE,
  FL_EMPTY_ALL,
  FL_HINT_DIRTY,
  FL_HINT_OFFLINE,
  FL_HINT_REMOTE,
  FL_SAVED,
  FL_STATE_RESTORED,
  TAB_LABELS,
  fcLiveSwitch,
  fcPage,
  fcSub,
} from '../support/strings';
import { flAddLift, flFillSet, flSave, gotoFitness, hasWoDraft, readCharts, readFl, readPager, setMetric } from '../support/fitness';

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = new RegExp('/api/collections/journey_docs/records/[^/]+' + String.fromCharCode(36));

test('FIT-02 a plan without lifts or cardio shows one empty line with the plan editor entry, which opens the plan editor and keeps the draft (D-03, S3)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  // 计划里什么都没有：整个记录区只剩一行说明和入口，没有日期框、没有保存栏
  const noLifts = { ...syntheticPlan('fe', 1), lifts: [] };
  await app.open({ mode: 'cloud', seed: syntheticState('fe'), plan: noLifts, login: 0 });
  await gotoFitness(page);
  await expect(page.locator('#fl .empty')).toHaveCount(1);
  await expect(page.locator('#fl .empty')).toHaveText(FL_EMPTY_ALL);
  await expect(page.locator('#flGoPlan')).toHaveText(BTN_FL_GO_PLAN);
  await expect(page.locator('#fl-date')).toHaveCount(0);
  await expect(page.locator('#fl-save')).toHaveCount(0);

  // 另一个账号：只有 1 个力量项、没有有氧项
  const dev = await openDevice({ browser, guard, fake: new FakePbServer() });
  try {
    await dev.app.open({ mode: 'cloud', users: 1, seed: syntheticState('fo'), plan: syntheticPlan('fo', 1), login: 0 });
    const p2 = dev.page;
    await gotoFitness(p2);
    // 有氧分区：说明加入口（带 id 的入口只有一个，另一个靠 data-flact）
    await expect(p2.locator('#fl')).toContainText(FL_CARDIO_NONE);
    await expect(p2.locator('#flGoPlan')).toHaveCount(1);
    await expect(p2.locator('#fl [data-flact="goplan"]')).toHaveCount(2);
    await expect(p2.locator('#fl-date')).toHaveCount(1);

    // 在力量项上填一组，点入口：编辑计划页打开；回到健身页，草稿那一组还在
    await flAddLift(p2, 'l-fo1');
    await flFillSet(p2, 'l-fo1', 0, '30', '5');
    await p2.locator('#flGoPlan').click();
    await expect(p2.locator('#tab-plan')).toBeVisible();
    await gotoFitness(p2);
    expect(await readFl(p2)).toEqual([{ id: 'l-fo1', sets: [{ w: '30', r: '5' }] }]);
    await expect(p2.locator('#fl-save')).not.toHaveAttribute('aria-disabled', 'true');
  } finally {
    await dev.context.close();
  }
});

test('FIT-02 an unsaved draft survives a remote update and a reload, says the day changed on another device and is cleared on sign-out (S3, A2)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('fd'), plan: syntheticPlan('fd', 1), login: 0 });
  await gotoFitness(page);
  await flAddLift(page, 'l-fd1');
  await flFillSet(page, 'l-fd1', 0, '30', '5');
  // 焦点移到别处（数字框里有焦点时本机算「忙」，远端更新会先等着）；本机留底 500 ms 后写进去，date 是今天
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(() => hasWoDraft(page), { message: '等待本机留底写入' }).toEqual({ has: true, date: FROZEN_TODAY });

  // 设备 B 给同一天保存一次训练
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await gotoFitness(second.page);
    await flAddLift(second.page, 'l-fd1');
    await flFillSet(second.page, 'l-fd1', 0, '20', '8');
    await flSave(second.page);
    await expect
      .poll(() => app.fake.lastState(0)?.workouts?.[FROZEN_TODAY] !== undefined, { message: '等待设备 B 的训练上传' })
      .toBe(true);

    // A 等到远端更新应用（本周页出现 B 的训练行）：记录区那一组还在，提示行换成第 2 档，保存仍可用
    await expect(page.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`)).toHaveCount(1);
    expect(await readFl(page)).toEqual([{ id: 'l-fd1', sets: [{ w: '30', r: '5' }] }]);
    await expect(page.locator('#fl-hint')).toHaveText(FL_HINT_REMOTE);
    await expect(page.locator('#fl-hint')).toHaveAttribute('data-tone', 'warn');
    await expect(page.locator('#fl-save')).not.toHaveAttribute('aria-disabled', 'true');
  } finally {
    await second.context.close();
  }

  // A 刷新：记录区载入留底，状态行写「已恢复上次没保存的内容。」
  await app.reload();
  await gotoFitness(page);
  await expect(page.locator('#fl-state')).toHaveText(FL_STATE_RESTORED);
  expect(await readFl(page)).toEqual([{ id: 'l-fd1', sets: [{ w: '30', r: '5' }] }]);

  // 退出登录：留底被清掉
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#login')).toBeVisible();
  expect(await hasWoDraft(page)).toEqual({ has: false, date: null });
});

test.describe('manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('FIT-02 while offline a training is saved with the offline hint and uploaded later, and while the edit gate is on the logging controls are disabled and the fitness rows still open the tab (A23, S9)', async ({
    app,
    page,
    context,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    // 两个力量项：保存了第一个之后，芯片行里还有第二个，对账门控时能看到它是真 disabled
    const plan2: any = syntheticPlan('fo', 1);
    plan2.lifts.push({ id: 'l-fo2', n: 'SYNTH-fo lift 2', unit: 'kg', def: 10, target: 20, note: '' });
    await app.open({ mode: 'cloud', seed: syntheticState('fo'), plan: plan2, login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);

    // 服务器连不上：列表读取和单条更新都被拒
    app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
    app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
    await context.setOffline(true);

    // 断网时记录区照常可用；还没保存时提示行是第 3 档「有没保存的内容」
    await gotoFitness(page);
    await flAddLift(page, 'l-fo1');
    await flFillSet(page, 'l-fo1', 0, '30', '5');
    await expect(page.locator('#fl-hint')).toHaveText(FL_HINT_DIRTY);

    // 保存：没有未保存内容了，第 4 档（离线）优先于第 6 档（已保存）
    await flSave(page);
    await expectToast(page, FL_SAVED);
    await page.clock.runFor(1_000);
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'offline');
    await expect(page.locator('#fl-hint')).toHaveText(FL_HINT_OFFLINE);
    await expect(page.locator('#fl-hint')).toHaveAttribute('data-tone', 'warn');
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });

    // 本机缓存里待上传（touched 含这一天的键），服务器上还没有
    const key = `usj:v2:${app.fake.users[0].id}:state`;
    const readCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    const cached = await readCache();
    expect(cached.dirty).toBe(true);
    expect(cached.touched).toContain(`wo:${FROZEN_TODAY}`);
    expect(app.fake.lastState(0)?.workouts?.[FROZEN_TODAY]).toBeUndefined();

    // 联网：上传到服务器
    await app.fake.clearFaults();
    await context.setOffline(false);
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
    await expect
      .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts?.[FROZEN_TODAY] ?? null), { message: '等待训练上传到服务器' })
      .toBe(JSON.stringify({ lifts: [{ id: 'l-fo1', sets: [{ w: 30, r: 5 }] }], cardio: [] }));

    // 启动对账被拖住：记录区的写入控件都是真 disabled，本周页的训练行点了仍切到健身页
    const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');
    await gotoFitness(page);
    await expect(page.locator('#fl-save')).toBeDisabled();
    await expect(page.locator('#fl-date')).toBeDisabled();
    expect(await page.locator('#fl [data-fl-add]').count()).toBeGreaterThan(0);
    await expect(page.locator('#fl [data-fl-add]:not(:disabled)')).toHaveCount(0);
    await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
    await page.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`).click();
    await expect(page.locator('#tab-fit')).toBeVisible();
    await hold.release();
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  });
});

test('FIT-03 while the edit gate is on the chart controls, paging and data tables still work and the logging controls stay disabled', async ({
  app,
  page,
  browser,
  guard,
}) => {
  // 5 个力量项（电脑上两页）和 1 个有氧项；今天有一次训练和一次有氧
  const plan: any = syntheticPlan('fg', 1);
  for (let i = 2; i <= 5; i += 1) plan.lifts.push({ id: `l-fg${i}`, n: `SYNTH-fg lift ${i}`, unit: 'kg', def: 10, target: 20, note: '' });
  plan.cardio = [{ id: 'r-fg1', n: 'SYNTH-fg cardio', note: '', target: { kind: 'min', v: 30 } }];
  const state = syntheticState('fg', {
    workouts: { [FROZEN_TODAY]: { lifts: [{ id: 'l-fg1', sets: [{ w: 30, r: 5 }] }], cardio: [{ id: 'r-fg1', m: 25 }] } },
  });
  await app.open({ mode: 'cloud', seed: state, plan, login: 0 });
  await gotoFitness(page);
  await expect(page.locator('#fc figure.fc-cd')).toHaveCount(1);

  // 启动对账被拖住：先显示本机缓存里的内容，body 带门控
  const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');
  await gotoFitness(page);

  // 图表控件、翻页按钮、查看数据都可用
  await expect(page.locator('#fc [data-fc-metric="vol"]')).toBeEnabled();
  await expect(page.locator('#fc [data-fc-range="3m"]')).toBeEnabled();
  await expect(page.locator('#fcNext')).toBeEnabled();
  await setMetric(page, 'vol');
  expect((await readCharts(page))[0].sub, 'the chart switched to total volume under the gate').toBe(fcSub('vol', 'kg'));
  await expect(page.locator('#fc-live')).toHaveText(fcLiveSwitch(FC_METRIC.vol, FC_RANGE['1m']));
  await page.locator('#fcNext').click();
  let pg = await readPager(page);
  expect(pg.lifts, 'paging works under the gate').toEqual(['l-fg5']);
  expect(pg.page).toBe(fcPage(2, 2));
  await page.locator('#fcPrev').click();
  pg = await readPager(page);
  expect(pg.lifts, 'back on the first page').toEqual(['l-fg1', 'l-fg2', 'l-fg3', 'l-fg4']);
  await page.locator('#fc figure.fc[data-lift="l-fg1"] .fc-data summary').click();
  await expect(page.locator('#fc figure.fc[data-lift="l-fg1"] .fc-tbl')).toBeVisible();
  await page.locator('#fc figure.fc-cd .fc-data summary').click();
  await expect(page.locator('#fc figure.fc-cd .fc-tbl')).toBeVisible();

  // 记录区的写入控件仍是真 disabled
  await expect(page.locator('#fl-save')).toBeDisabled();
  expect(await page.locator('#fl [data-fl-add]').count()).toBeGreaterThan(0);
  await expect(page.locator('#fl [data-fl-add]:not(:disabled)')).toHaveCount(0);

  // 松开对账：门控消失，记录区恢复可用
  await hold.release();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('body')).not.toHaveAttribute('data-gate', /.+/);
  await expect(page.locator('#fl-save')).toHaveJSProperty('disabled', false);
  await expect(page.locator('#fl [data-fl-add]:not(:disabled)').first()).toBeVisible();

  // 另一个账号：计划里没有有氧项、也没有有氧记录，每周有氧卡片整张不渲染
  const dev = await openDevice({ browser, guard, fake: new FakePbServer() });
  try {
    await dev.app.open({ mode: 'cloud', users: 1, seed: syntheticState('fo'), plan: syntheticPlan('fo', 1), login: 0 });
    await gotoFitness(dev.page);
    await expect(dev.page.locator('#fc figure.fc[data-lift]')).toHaveCount(1);
    await expect(dev.page.locator('#fc figure.fc-cd')).toHaveCount(0);
  } finally {
    await dev.context.close();
  }
});
