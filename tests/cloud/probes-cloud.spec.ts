// cloud 运行时探针（PROBE-9、PROBE-10）：只在 npm run test:cloud 里运行，结论记录在 tests/PROBES.md。
// PROBE-1 到 PROBE-8 在 tests/e2e/platform/probes.spec.ts，每次 npm test 都会运行。
// 写法照 probes.spec.ts：观察值先记进 testInfo.annotations（type 为 probe）和终端，看清之后把断言写死，
// 不写“观察到什么就断言什么”。context.setOffline 只在 PROBE-9 的三条探针里使用（研究 Pitfall 10）；
// PROBE-10 的三条探针不用 setOffline，实时断开和拒绝都用假服务器的开关（dropRealtime、refuseRealtime）。
import { test, expect, type Page } from '../support/test';
import { APP_ORIGIN } from '../support/constants';

const probe = (testInfo: { annotations: Array<{ type: string; description?: string }> }, name: string, value: unknown) => {
  const text = `${name}=${JSON.stringify(value)}`;
  testInfo.annotations.push({ type: 'probe', description: text });
  console.log('PROBE-9 ' + text);
};

const probe10 = (testInfo: { annotations: Array<{ type: string; description?: string }> }, name: string, value: unknown) => {
  const text = `${name}=${JSON.stringify(value)}`;
  testInfo.annotations.push({ type: 'probe', description: text });
  console.log('PROBE-10 ' + text);
};

// 页面里在任何脚本之前挂 online、offline 计数；自包含函数，不拼接字符串
function installNetworkEventCounters() {
  const w = window as any;
  w.__probeOnlineCount = 0;
  w.__probeOfflineCount = 0;
  window.addEventListener('online', () => {
    w.__probeOnlineCount++;
  });
  window.addEventListener('offline', () => {
    w.__probeOfflineCount++;
  });
}

const readNet = (page: Page) =>
  page.evaluate(() => ({
    onLine: navigator.onLine,
    online: (window as any).__probeOnlineCount as number,
    offline: (window as any).__probeOfflineCount as number,
  }));

test('PROBE-9a what context.setOffline does to navigator.onLine and the online and offline events', async ({
  app,
  page,
  context,
}, testInfo) => {
  await page.addInitScript(installNetworkEventCounters);
  await app.open({ mode: 'cloud', backend: null });

  const initial = await readNet(page);
  probe(testInfo, '9a.initial', initial);
  expect(initial).toEqual({ onLine: true, online: 0, offline: 0 });

  await context.setOffline(true);
  // 观察值：setOffline(true) 把 navigator.onLine 改成 false，并派发恰好一次 offline 事件、没有 online 事件
  await expect.poll(async () => (await readNet(page)).offline, { timeout: 5000 }).toBe(1);
  const offline = await readNet(page);
  probe(testInfo, '9a.offline', offline);
  expect(offline).toEqual({ onLine: false, online: 0, offline: 1 });

  await context.setOffline(false);
  // 观察值：setOffline(false) 把 navigator.onLine 改回 true，并派发恰好一次 online 事件
  await expect.poll(async () => (await readNet(page)).online, { timeout: 5000 }).toBe(1);
  const back = await readNet(page);
  probe(testInfo, '9a.backOnline', back);
  expect(back).toEqual({ onLine: true, online: 1, offline: 1 });
});

test('PROBE-9b whether a route-fulfilled same-origin fetch still succeeds while the context is offline', async ({
  app,
  page,
  context,
  guard,
}, testInfo) => {
  await app.open({ mode: 'cloud', backend: null });
  await context.setOffline(true);
  const result = await page.evaluate(() =>
    fetch('/api/collections/journey_docs/records?page=1&perPage=1&skipTotal=1').then(
      (res) => 'resolved:' + res.status,
      (err) => 'rejected:' + String(err),
    ),
  );
  probe(testInfo, '9b.result', result);
  probe(testInfo, '9b.fakeSawRequest', app.fake.requests.map((r) => r.path));
  // 观察值：被 route 接住并 fulfill 的同源 fetch 不受 setOffline 影响，照常 resolved:200，假服务器收到了这条请求；
  // 没有 console.error，也没有违规记录（guard 的 teardown 仍然兜底）
  expect(result).toBe('resolved:200');
  expect(app.fake.requests.map((r) => r.path)).toEqual(['/api/collections/journey_docs/records']);
  expect(guard.state.consoleErrors).toEqual([]);
  expect(guard.state.unexpectedRequests).toEqual([]);
  await context.setOffline(false);
});

test('PROBE-9c whether the fake EventSource still delivers while the context is offline', async ({
  app,
  page,
  context,
}, testInfo) => {
  await app.open({ mode: 'cloud', users: 1, backend: null });
  app.fake.seed({ _synthetic: true, logs: [] }, { userIndex: 0 });
  const [user] = app.fake.users;
  const docId = await page.evaluate(
    async ({ origin, email, password }) => {
      const w = window as any;
      const pb = new w.PocketBase(origin);
      pb.autoCancellation(false);
      w.__pb = pb;
      w.__events = [];
      await pb.collection('users').authWithPassword(email, password);
      const [own] = await pb.collection('journey_docs').getFullList();
      await pb.collection('journey_docs').subscribe('*', (e: any) => w.__events.push(e.action as string), {
        fields: 'id,kind,writer,updated',
      });
      return own.id as string;
    },
    { origin: APP_ORIGIN, email: user.email, password: user.password },
  );

  await context.setOffline(true);
  const patched = await app.fake.request(0, 'PATCH', '/api/collections/journey_docs/records/' + docId, { writer: 'device-a' });
  probe(testInfo, '9c.patchStatus', patched.status);
  // 观察值：页面侧假 EventSource 由 Node 经 page.evaluate 投递，不走浏览器网络栈，离线时照常收到恰好 1 条 update
  expect(patched.status).toBe(200);
  await expect.poll(() => page.evaluate(() => (window as any).__events as string[]), { timeout: 5000 }).toEqual(['update']);
  const events = await page.evaluate(() => (window as any).__events as string[]);
  probe(testInfo, '9c.events', events);
  expect(app.fake.deliveryErrors).toEqual([]);
  await context.setOffline(false);
});

// ---------- PROBE-10：SDK 0.28.1 的实时重连（Phase 10 的本地调研） ----------

type Creds = { email: string; password: string };

// 页面里登录并并发订阅 PB_CONNECT 与 journey_docs/*（并发订阅：一次握手、一次 POST /api/realtime 带两个订阅串）。
// 给 window.fetch 包一层，数 POST /api/realtime 得到 204 的次数（__rtOk）：它在 SDK 处理响应之前加一，
// 所以 PB_CONNECT 回调里读到的 __rtOk 就是“回调触发时已经得到的 204 次数”。
// __connectLog 每次 PB_CONNECT 回调记一项：clientId、回调时的 __rtOk、SDK 已经提交的订阅里有没有 journey_docs/*。
async function signInAndWatch(page: Page, creds: Creds): Promise<string> {
  return page.evaluate(
    async ({ origin, email, password }) => {
      const w = window as any;
      const originalFetch = w.fetch.bind(w);
      w.__rtOk = 0;
      w.fetch = async (input: any, init: any) => {
        const res = await originalFetch(input, init);
        if (String(input).endsWith('/api/realtime') && init?.method === 'POST' && res.status === 204) w.__rtOk++;
        return res;
      };
      const pb = new w.PocketBase(origin);
      pb.autoCancellation(false);
      w.__pb = pb;
      w.__events = [];
      w.__connectLog = [];
      await pb.collection('users').authWithPassword(email, password);
      const [own] = await pb.collection('journey_docs').getFullList();
      await Promise.all([
        pb.realtime.subscribe('PB_CONNECT', (d: any) => {
          w.__connectLog.push({
            clientId: d.clientId as string,
            rtOk: w.__rtOk as number,
            sentJourney: (pb.realtime.lastSentSubscriptions as string[]).some((k) => k.startsWith('journey_docs/*')),
          });
        }),
        pb.collection('journey_docs').subscribe('*', (e: any) => w.__events.push(e.action as string), {
          fields: 'id,kind,writer,updated',
        }),
      ]);
      return own.id as string;
    },
    { origin: APP_ORIGIN, ...creds },
  );
}
type ConnectLogEntry = { clientId: string; rtOk: number; sentJourney: boolean };
const connectLog = (page: Page) => page.evaluate(() => (window as any).__connectLog as ConnectLogEntry[]);
const eventsOf = (page: Page) => page.evaluate(() => (window as any).__events as string[]);
const posts204 = (app: { fake: { requests: Array<{ method: string; path: string; status: number }> } }) =>
  app.fake.requests.filter((r) => r.method === 'POST' && r.path === '/api/realtime' && r.status === 204).length;

test('PROBE-10a the SDK calls PB_CONNECT listeners again after every reconnect', async ({ app, page }, testInfo) => {
  await app.open({ mode: 'cloud', seed: { _synthetic: true, logs: [] }, backend: null });
  const [user] = app.fake.users;
  await signInAndWatch(page, user);
  expect(app.fake.connectionCount()).toBe(1);

  // 连续两次断开，每次等重连完成（监听再次被调用、连接数回到 1）
  for (const expected of [2, 3]) {
    expect(await app.fake.dropRealtime(page)).toBe(1);
    expect(app.fake.connectionCount()).toBe(0);
    await expect.poll(async () => (await connectLog(page)).length, { message: '等待第 ' + (expected - 1) + ' 次重连' }).toBe(expected);
    await expect.poll(() => app.fake.connectionCount()).toBe(1);
  }

  const log = await connectLog(page);
  probe10(testInfo, '10a.connectLog', log.map((e, i) => ({ call: i + 1, rtOk: e.rtOk, sentJourney: e.sentJourney })));
  probe10(testInfo, '10a.distinctClientIds', new Set(log.map((e) => e.clientId)).size);
  probe10(testInfo, '10a.posts204', posts204(app));
  // 观察值：监听共被调用 3 次（首次连接加两次重连），每次的 clientId 都不同；
  // 每次回调触发时，这一轮握手的 POST /api/realtime 已经得到 204（rtOk 恰好是第几次调用），
  // 并且 SDK 提交的订阅里已经有 journey_docs/*：所以在回调里立即对账时订阅已经生效
  expect(log).toHaveLength(3);
  expect(new Set(log.map((e) => e.clientId)).size).toBe(3);
  expect(log.map((e) => e.rtOk)).toEqual([1, 2, 3]);
  expect(log.every((e) => e.sentJourney)).toBe(true);
  expect(posts204(app)).toBe(3);
  expect(app.fake.deliveryErrors).toEqual([]);
});

test('PROBE-10b the SDK does not retry a first realtime connection that fails', async ({ app, page }, testInfo) => {
  await app.open({ mode: 'cloud', seed: { _synthetic: true, logs: [] }, backend: null });
  const [user] = app.fake.users;
  app.fake.refuseRealtime(true, page);

  const outcome = await page.evaluate(
    async ({ origin, email, password }) => {
      const w = window as any;
      const pb = new w.PocketBase(origin);
      pb.autoCancellation(false);
      w.__pb = pb;
      await pb.collection('users').authWithPassword(email, password);
      try {
        await pb.collection('journey_docs').subscribe('*', () => {}, { fields: 'id,kind,writer,updated' });
        return { rejected: false };
      } catch (e: any) {
        return { rejected: true, name: String(e?.name) };
      }
    },
    { origin: APP_ORIGIN, email: user.email, password: user.password },
  );
  probe10(testInfo, '10b.outcome', outcome);
  expect(outcome.rejected).toBe(true);
  expect(app.fake.realtimeRefusals).toBe(1);

  // 真实时间等 3 秒（SDK 的重连间隔最短 200 毫秒，要重试早就重试了）：被拒次数不变、没有连接
  await page.waitForTimeout(3000);
  probe10(testInfo, '10b.afterWait', { refusals: app.fake.realtimeRefusals, connections: app.fake.connectionCount() });
  expect(app.fake.realtimeRefusals).toBe(1);
  expect(app.fake.connectionCount()).toBe(0);

  // 放开之后没有任何订阅动作：SDK 不会自己再试，连接数仍为 0
  app.fake.refuseRealtime(false, page);
  await page.waitForTimeout(1500);
  probe10(testInfo, '10b.afterAllowed', { refusals: app.fake.realtimeRefusals, connections: app.fake.connectionCount() });
  expect(app.fake.realtimeRefusals).toBe(1);
  expect(app.fake.connectionCount()).toBe(0);
});

test('PROBE-10c events sent while realtime is down are not replayed after the reconnect', async ({ app, page }, testInfo) => {
  await app.open({ mode: 'cloud', seed: { _synthetic: true, logs: [] }, backend: null });
  const [user] = app.fake.users;
  const docId = await signInAndWatch(page, user);
  expect((await connectLog(page)).length).toBe(1);

  app.fake.refuseRealtime(true, page);
  expect(await app.fake.dropRealtime(page)).toBe(1);
  // 等 SDK 确实在重试（连接建立不起来），再制造“断开期间的事件”
  await expect.poll(() => app.fake.realtimeRefusals).toBeGreaterThanOrEqual(1);
  await app.fake.emit(0, 'update', { id: docId, kind: 'state', writer: 'while-down-1', updated: 'a' });
  await app.fake.emit(0, 'update', { id: docId, kind: 'state', writer: 'while-down-2', updated: 'b' });
  expect(await eventsOf(page)).toEqual([]);

  app.fake.refuseRealtime(false, page);
  await expect.poll(async () => (await connectLog(page)).length).toBe(2);
  await expect.poll(() => app.fake.connectionCount()).toBe(1);
  // 重连后给一点真实时间：假服务器和 SDK 都不会补发断开期间的两条事件
  await page.waitForTimeout(500);
  const afterReconnect = await eventsOf(page);
  probe10(testInfo, '10c.eventsAfterReconnect', afterReconnect.length);
  expect(afterReconnect).toEqual([]);

  // 正向对照：重连之后的新事件照常送达，恰好 1 条
  await app.fake.emit(0, 'update', { id: docId, kind: 'state', writer: 'after-reconnect', updated: 'c' });
  await expect.poll(() => eventsOf(page)).toHaveLength(1);
  probe10(testInfo, '10c.eventsAfterNewEmit', (await eventsOf(page)).length);
  expect(await eventsOf(page)).toEqual(['update']);
  expect(app.fake.deliveryErrors).toEqual([]);
});
