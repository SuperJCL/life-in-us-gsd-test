// Phase 10 的实时同步用例（SYNC-02）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 实时事件由假服务器按订阅推送（真实 SDK 0.28.1 + 假 EventSource），应用收到事件后走和 60 秒拉取同一条整份对账路径。
// 两台设备都在 manual 时钟下运行：open 之前 install，登录后 pauseAt(FROZEN_NOW + 60_000)；设备二不推进任何时钟，
// 所以它看到设备一的修改只可能来自实时事件，不可能来自拉取。
import { test, expect, type Page } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { openDevice } from '../support/devices';
import { expectToast } from '../support/toast';
import { FROZEN_NOW } from '../support/constants';
import { STATUS_CLOUD_SYNCED, TOAST_REMOTE_UPDATED } from '../support/strings';

test.use({ clockMode: 'manual' });

const LIST_PATH = '/api/collections/journey_docs/records';
const serverIdOf = (app: { fake: { lastState: (i: number) => any } }, text: string) =>
  ((app.fake.lastState(0)?.logs ?? []) as Array<{ id: string; text: string }>).find((l) => l.text === text)?.id ?? null;

// 经界面记一笔，推进 1 秒让保存防抖到期，等服务器 state 里出现它，返回 id
async function recordAndUpload(app: Parameters<typeof serverIdOf>[0], page: Page, text: string): Promise<string> {
  const entry = composer(page, 'w');
  await entry.type(text);
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect.poll(() => serverIdOf(app, text), { message: `等待记录上传：${text}` }).not.toBeNull();
  return serverIdOf(app, text)!;
}

test('SYNC-02 a change on one device appears on the other device within seconds', async ({ app, page, browser, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
  try {
    await second.page.clock.install({ time: FROZEN_NOW });
    await second.app.open({ mode: 'cloud', login: 0 });
    await second.page.clock.pauseAt(FROZEN_NOW + 60_000);
    const sp = second.page;
    // 两台设备都已订阅
    await expect.poll(() => app.fake.connectionCount()).toBe(2);

    const id = await recordAndUpload(app, page, 'SYNTH-1201 from device one');
    // 设备二没有推进任何时钟：默认断言超时内显示，并提示已更新
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toBeVisible();
    await expectToast(sp, TOAST_REMOTE_UPDATED);
    await expect(sp.locator('#syncbar')).not.toBeVisible();
    await expect(sp.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  } finally {
    await second.context.close();
  }
});

test("SYNC-02 this device's own save never comes back as a remote update", async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  await expect.poll(() => app.fake.connectionCount()).toBe(1);

  const id = await recordAndUpload(app, page, 'SYNTH-1202 own entry');
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  const patchAt = app.fake.requests.reduce(
    (at, r, i) => (r.method === 'PATCH' && r.path.startsWith(LIST_PATH) && r.status === 200 ? i : at),
    -1,
  );
  expect(patchAt).toBeGreaterThanOrEqual(0);
  const listsSince = () => app.fake.requests.slice(patchAt + 1).filter((r) => r.method === 'GET' && r.path === LIST_PATH).length;

  // 回声：写入方就是本页（取自它上传时带的 writer）、updated 与基线不同的事件也被忽略（只看 writer，不靠 updated 碰巧相等），不引起对账
  const ownWriter = app.fake.writes.filter((w) => w.path === 'journey_docs:state').at(-1)!.writer;
  expect(ownWriter).toBeTruthy();
  await app.fake.emit(0, 'update', {
    id: app.fake.docId(0, 'state'),
    kind: 'state',
    writer: ownWriter,
    updated: 'synth-updated-echo',
  });
  // 哨兵：一条写入方不是本页、updated 与基线不同的事件。它的回声（本页的保存）在它之前就已经送达，
  // 如果回声引起对账，列表请求在哨兵之后不会只多一次
  await app.fake.emit(0, 'update', {
    id: app.fake.docId(0, 'state'),
    kind: 'state',
    writer: 'synth-other-writer',
    updated: 'synth-updated-sentinel',
  });
  await expect.poll(listsSince, { message: '等待哨兵事件引起的那一次整份对账' }).toBe(1);
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  // 对账读回的内容和本机一致：toast 上不是“已更新”（记录时的提示可能还在，因为时钟没走）、没有横幅，本页自己的记录还在
  await expect(page.locator('#syncbar')).not.toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#toast span')?.textContent ?? '')).not.toBe(TOAST_REMOTE_UPDATED);
  await expect(page.locator(`#days [data-edit="${id}"]`)).toBeVisible();
  expect(listsSince()).toBe(1);
});

test('SYNC-02 a realtime reconnect reconciles and picks up a change made while it was down', async ({ app, page, browser, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
  try {
    await second.page.clock.install({ time: FROZEN_NOW });
    await second.app.open({ mode: 'cloud', login: 0 });
    const sp = second.page;
    // 暂停在“现在”之后一点点：本用例要自己推进设备二的时钟，不能让它的 60 秒拉取（从登录那一刻起算）落进推进的范围
    await sp.clock.pauseAt((await sp.evaluate(() => Date.now())) + 100);
    await expect.poll(() => app.fake.connectionCount()).toBe(2);

    // 设备二的实时断开并且重连被拒：SDK 在重连，页面不再是 live（SDK 的重连间隔是页面定时器，下面用 runFor 推进）
    app.fake.refuseRealtime(true, sp);
    await app.fake.dropRealtime(sp);
    await expect(sp.locator('body')).toHaveAttribute('data-rt', 'connecting');
    await expect.poll(() => app.fake.connectionCount()).toBe(1);

    // 断开期间设备一记一笔并上传：设备二几秒的重连尝试里仍看不到（实时已断，也没有到 60 秒拉取）
    const id = await recordAndUpload(app, page, 'SYNTH-1203 made while device two was down');
    await sp.clock.runFor(3_000);
    expect(app.fake.realtimeRefusals).toBeGreaterThan(0);
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toHaveCount(0);
    await expect(sp.locator('body')).toHaveAttribute('data-rt', 'connecting');

    // 放开之后 SDK 的下一次重连成功，PB_CONNECT 整份对账，断开期间的修改出现，回到 live（SDK 最长 2 秒试一次，每轮推进 2 秒）
    app.fake.refuseRealtime(false, sp);
    await expect(async () => {
      await sp.clock.runFor(2_000);
      await expect(sp.locator(`#days [data-edit="${id}"]`)).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 15_000 });
    await expect(sp.locator('body')).toHaveAttribute('data-rt', 'live');
    await expect(sp.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
    await expect.poll(() => app.fake.connectionCount()).toBe(2);
  } finally {
    await second.context.close();
  }
});

test('SYNC-02 a first realtime connection that fails is retried by the app', async ({ app, page, browser, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  // 登录之前就拒绝这个页面的实时连接：首次连接失败，SDK 不会自己再试（PROBE-10b）
  app.fake.refuseRealtime(true, page);
  await app.open({ mode: 'cloud', seed: syntheticState('a'), realtime: false });
  await app.submitLogin(0);
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  await expect(page.locator('body')).toHaveAttribute('data-rt', 'off');
  expect(app.fake.realtimeRefusals).toBeGreaterThan(0);
  expect(app.fake.connectionCount()).toBe(0);
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 放开实时，再有一次成功的对账（回到前台）：应用自己重新订阅，只订阅一次
  app.fake.refuseRealtime(false, page);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('body')).toHaveAttribute('data-rt', 'live');
  await expect.poll(() => app.fake.connectionCount()).toBe(1);

  // 之后另一台设备的修改几秒内到达（这页的时钟已暂停，不可能来自 60 秒拉取）
  const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
  try {
    await second.page.clock.install({ time: FROZEN_NOW });
    await second.app.open({ mode: 'cloud', login: 0 });
    await second.page.clock.pauseAt(FROZEN_NOW + 60_000);
    const id = await recordAndUpload(app, second.page, 'SYNTH-1204 after the app resubscribed');
    await expect(page.locator(`#days [data-edit="${id}"]`)).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-rt', 'live');
    expect(app.fake.connectionCount()).toBe(2);
  } finally {
    await second.context.close();
  }
});
