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
import { STATUS_CLOUD_SYNCED, statusOffline } from '../support/strings';

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
