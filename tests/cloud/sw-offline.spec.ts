// Phase 13 的离线外壳用例（OPS-04、D-07）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 三条用例：页面打开过一次之后断网刷新仍从 Service Worker 缓存启动；断网时新开标签页（冷启动）也能进入应用并记一笔；
// 缓存里只有应用外壳，从来没有 /api/ 的条目，离线时 /api/ 也不会被 worker 答出来。
//
// 只在本文件放开 Service Worker：test.use({ serviceWorkers: 'allow' }) 作用于默认的 context fixture（第一台设备）；
// 第二台设备（tests/support/devices.ts）和别的文件照旧是 block，配置文件不改。
// 这里用真实时钟：Service Worker 的安装和激活不受 page.clock 控制；时间只固定 Date（frozenClock fixture），
// 新开的标签页要自己再固定一次，否则令牌按真实日期判断已过期。
// “连不上服务器”一律用假服务器的 refuse 开关：context.setOffline 管不到 context.route 应答的请求（PROBE-9），
// 所以断网只用来证明应用外壳来自缓存，而不是证明服务器连不上。
import { test, expect, type Page } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW, SHELL_PATHS, SW_CACHE_PREFIX, SW_TEST_VERSION } from '../support/constants';
import { STATUS_CLOUD_SYNCED, statusOffline } from '../support/strings';

test.use({ serviceWorkers: 'allow' });

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = /\/api\/collections\/journey_docs\/records\/[^/]+$/;

// 等 Service Worker 就绪（激活完成）；只读回布尔
const swReady = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });

// 页面是否已被 Service Worker 控制：首次安装不接管已打开的页面，所以第一次加载之后要再导航一次才为真
const controlled = (page: Page) => page.evaluate(() => navigator.serviceWorker.controller !== null);

// 读 Cache Storage：每个缓存名对应它的条目路径（排序后）
const readCaches = (page: Page) =>
  page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      out[name] = (await cache.keys()).map((req) => new URL(req.url).pathname).sort();
    }
    return out;
  });

const onServer = (app: { fake: { lastState(i: number): any } }, text: string) =>
  ((app.fake.lastState(0).logs ?? []) as Array<{ text: string }>).filter((l) => l.text === text).length;

test('OPS-04 after one visit the app reloads offline from the Service Worker cache with its pending changes and count (D-07)', async ({
  app,
  page,
  context,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await swReady(page);
  // 联网刷新一次：页面第一次受 worker 控制（首次安装不接管已打开的页面）
  await app.reload();
  expect(await controlled(page)).toBe(true);

  // 服务器连不上、浏览器断网：记一笔，先存本机，状态行带数量
  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  await context.setOffline(true);
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1301 kept over an offline reload');
  await entry.submit();
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));

  // 断网刷新：页面文档来自缓存，应用照常打开，记录和待上传数量都在
  await page.reload();
  await expect(page).toHaveTitle('计划手记');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));
  await expect(page.locator('#w-text')).toBeEnabled();
  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  const local = (cached.data.logs as Array<{ id: string; text: string }>).find((l) => l.text === 'SYNTH-1301 kept over an offline reload');
  expect(local).toBeTruthy();
  expect(cached.dirty).toBe(true);
  await expect(page.locator(`#days [data-edit="${local!.id}"]`)).toBeVisible();
  // 服务器 state 里还没有这条记录
  expect(onServer(app, 'SYNTH-1301 kept over an offline reload')).toBe(0);

  // 联网：撤掉故障、恢复网络，自动上传
  await app.fake.clearFaults();
  await context.setOffline(false);
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(onServer(app, 'SYNTH-1301 kept over an offline reload')).toBe(1);
  // 被拒连接：按故障实际命中的次数确认
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
});

test('OPS-04 after one visit a new tab opens the app offline, records an entry and uploads it when the server is back (D-07)', async ({
  app,
  page,
  context,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await swReady(page);
  // 关掉原页面：之后只有 Service Worker 缓存和本机存储能让应用打开
  await page.close();

  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  await context.setOffline(true);

  // 新标签页：和第一页一样先固定 Date，令牌的有效期按冻结日判断
  const tab = await context.newPage();
  await tab.clock.setFixedTime(FROZEN_NOW);
  await tab.goto('/');
  const status = tab.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(0));
  await expect(tab.locator('#w-text')).toBeEnabled();

  const entry = composer(tab, 'w');
  await entry.type('SYNTH-1302 recorded in a cold-started tab');
  await entry.submit();
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));
  expect(onServer(app, 'SYNTH-1302 recorded in a cold-started tab')).toBe(0);

  // 联网：这条记录上传到服务器
  await app.fake.clearFaults();
  await context.setOffline(false);
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(onServer(app, 'SYNTH-1302 recorded in a cold-started tab')).toBe(1);
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
});

test('OPS-04 the Service Worker caches only the app shell and never answers /api requests (D-07)', async ({ app, page, context, guard }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await swReady(page);

  // 就绪后：恰好一个缓存，名字是前缀加测试版本，条目路径恰好是外壳
  const shell = [...SHELL_PATHS].sort();
  const before = await readCaches(page);
  expect(Object.keys(before)).toEqual([SW_CACHE_PREFIX + SW_TEST_VERSION]);
  expect(before[SW_CACHE_PREFIX + SW_TEST_VERSION]).toEqual(shell);

  // 登录、保存、离线刷新都做过之后：缓存里仍然只有外壳，没有任何 /api/ 条目
  await app.reload();
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1303 saved while the worker is active');
  await entry.submit();
  await expect.poll(() => onServer(app, 'SYNTH-1303 saved while the worker is active'), { message: '等待记录上传' }).toBe(1);
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('计划手记');
  const after = await readCaches(page);
  expect(Object.keys(after)).toEqual([SW_CACHE_PREFIX + SW_TEST_VERSION]);
  expect(after[SW_CACHE_PREFIX + SW_TEST_VERSION]).toEqual(shell);
  expect(Object.values(after).flat().some((p) => p.startsWith('/api/'))).toBe(false);

  // 服务器连不上、浏览器断网：/api/health 失败，不会被 worker 从缓存答出来
  const health = app.fake.fault({ method: 'GET', path: '/api/health', mode: 'refuse' });
  const answered = await page.evaluate(() => fetch('/api/health').then(() => 'answered', () => 'failed'));
  expect(answered).toBe('failed');
  expect(health.hits).toBe(1);
  await context.setOffline(false);
  await app.fake.clearFaults();
  // 被拒连接：/api/health 一条；刷新时列表读取可能也被拒过，所以只确认含 ERR_CONNECTION_REFUSED 的条数等于命中的次数
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: health.hits });
});
