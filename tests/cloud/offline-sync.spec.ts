// Phase 10 的离线与重试用例（SYNC-03、SYNC-04、SYNC-06）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 服务器连不上、5xx、挂起一律用假服务器的开关（refuse、status、hold）制造；
// context.setOffline 只用来改变 navigator.onLine 并派发 online 事件（PROBE-9a），从不用来让服务器连不上。
// 全部用例在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt(FROZEN_NOW + 60_000)，只在需要时 runFor。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { openDevice } from '../support/devices';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW } from '../support/constants';
import { BTN_RETRY_NOW, STATUS_CLOUD_SYNCED, STATUS_SAVING, statusOffline, statusRetrying } from '../support/strings';

test.use({ clockMode: 'manual' });

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = /\/api\/collections\/journey_docs\/records\/[^/]+$/;

test('SYNC-03 an entry made while the server is unreachable is kept on this device, counted in the offline status and uploaded when the connection returns', async ({
  app,
  page,
  context,
  browser,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 服务器侧故障：列表读取和单条更新都被拒；setOffline 只改变 navigator.onLine、派发 online/offline 事件
  app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  await context.setOffline(true);

  const entry = composer(page, 'w');
  await entry.type('SYNTH-1001 offline entry');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));
  await expect(page.locator('#syncbar')).not.toBeVisible();
  // 被拒连接：Chromium 为这条 fetch 写一条带网络错误码的 console.error（后台只试了一次）
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });

  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const readCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  const cached = await readCache();
  expect(cached.dirty).toBe(true);
  const local = (cached.data.logs as Array<{ id: string; text: string }>).find((l) => l.text === 'SYNTH-1001 offline entry');
  expect(local).toBeTruthy();
  expect(cached.touched).toEqual([`log:${local!.id}`]);
  // 服务器 state 里还没有这条记录
  expect((app.fake.lastState(0).logs as Array<{ text: string }>).some((l) => l.text === 'SYNTH-1001 offline entry')).toBe(false);

  // 联网：撤掉故障，再派发 online 事件，应用立即上传
  await app.fake.clearFaults();
  const from = app.fake.requests.length;
  await context.setOffline(false);

  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect((app.fake.lastState(0).logs as Array<{ id: string }>).some((l) => l.id === local!.id)).toBe(true);
  await expect.poll(async () => (await readCache()).dirty, { message: '等待缓存收尾' }).toBe(false);
  expect((await readCache()).touched).toEqual([]);
  const patches = app.fake.requests.slice(from).filter((r) => r.method === 'PATCH' && r.path.startsWith(LIST_PATH));
  expect(patches.map((r) => r.status)).toEqual([200]);

  // 第二台设备登录同一个账号，在本周视图里看得到这条记录
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await expect(second.page.locator(`#days [data-edit="${local!.id}"]`)).toBeVisible();
  } finally {
    await second.context.close();
  }
});

// 一条记录的文字在 state 文档里出现的次数
const countOnServer = (app: { fake: { lastState(i: number): any } }, text: string) =>
  ((app.fake.lastState(0).logs ?? []) as Array<{ text: string }>).filter((l) => l.text === text).length;

test('SYNC-06 a server error is retried automatically at growing intervals and the retry-now button tries at once', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const fault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'status', status: 503 });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1002 retried');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  // 状态行 = 一个文字节点 + 一个行内按钮；句子只取文字节点，按钮文字单独断言
  const sentence = () => status.evaluate((el) => el.firstChild?.textContent ?? '');
  await expect(status).toHaveAttribute('data-state', 'retrying');
  await expect(status.locator('button')).toHaveText(BTN_RETRY_NOW);
  await expect(page.locator('#syncbar')).not.toBeVisible();

  // 等待依次为 1、2、5、10 秒：每一段先走到只剩 1 秒（请求数不变，倒计时按秒减少），再走完最后 1 秒（请求数恰好加一）
  const waits = [1, 2, 5, 10, 30];
  for (let i = 0; i < 4; i++) {
    const w = waits[i];
    await expect.poll(sentence, { message: `第 ${i + 1} 次失败后的倒计时从 ${w} 秒开始` }).toBe(statusRetrying(w));
    expect(fault.hits).toBe(i + 1);
    if (w > 1) {
      await page.clock.runFor(1_000);
      await expect.poll(sentence).toBe(statusRetrying(w - 1));
      await page.clock.runFor((w - 2) * 1_000);
      await expect.poll(sentence).toBe(statusRetrying(1));
      expect(fault.hits).toBe(i + 1);
    }
    await page.clock.runFor(1_000);
    await expect.poll(() => fault.hits, { message: `第 ${i + 2} 次尝试在等待结束时发出` }).toBe(i + 2);
  }
  await expect.poll(sentence).toBe(statusRetrying(30));

  // 立即重试：不等倒计时，请求立刻多一次
  await status.locator('button').click();
  await expect.poll(() => fault.hits, { message: '点立即重试后立即多一次请求' }).toBe(6);
  // 这次又失败了：等待顺序继续往下走到 60 秒（封顶值）
  await expect.poll(sentence).toBe(statusRetrying(60));

  // 去掉故障后再点一次：上传成功，已同步，服务器上这条记录恰好一条
  fault.remove();
  await status.locator('button').click();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(countOnServer(app, 'SYNTH-1002 retried')).toBe(1);
  await acknowledgeConsoleErrors(guard, { 'status of 503 ': fault.hits });
});

test('SYNC-06 a save that gets no answer is abandoned after about 15 seconds and retried instead of hanging', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const hold = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'hold' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1003 held');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect.poll(() => hold.hits, { message: '等待保存请求被挂起' }).toBe(1);
  await expect(status).toHaveAttribute('data-state', 'saving');

  // 约 15 秒没有答复：应用中止这个请求，状态行变成失败重试，而不是一直停在保存中
  await page.clock.runFor(15_000);
  await expect(status).toHaveAttribute('data-state', 'retrying');

  // 放行被挂起的请求，再走过一次重试等待：已同步，服务器上这条记录恰好一条，没有留底
  await hold.release();
  await page.clock.runFor(1_000);
  await expect(status).toHaveAttribute('data-state', 'synced');
  expect(countOnServer(app, 'SYNTH-1003 held')).toBe(1);
  const snapshot = await page.evaluate((k) => localStorage.getItem(k), `usj:v2:${app.fake.users[0].id}:snapshot`);
  expect(snapshot).toBeNull();
  // 被中止的请求在服务器侧放行时答复可能写不回去，至多一条，且路径是单条记录
  expect(app.fake.fulfillErrors.length).toBeLessThanOrEqual(1);
  for (const e of app.fake.fulfillErrors) expect(ITEM_PATH.test(e.path)).toBe(true);
});

test('SYNC-04 a save shows saving and then synced', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const hold = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'hold' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1004 saving');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect.poll(() => hold.hits, { message: '等待保存请求被挂起' }).toBe(1);
  await expect(status).toHaveAttribute('data-state', 'saving');
  await expect(status).toHaveText(STATUS_SAVING);

  await hold.release();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
});
