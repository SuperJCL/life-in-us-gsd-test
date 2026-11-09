// cloud 运行时探针（PROBE-9 起）：只在 npm run test:cloud 里运行，结论记录在 tests/PROBES.md。
// PROBE-1 到 PROBE-8 在 tests/e2e/platform/probes.spec.ts，每次 npm test 都会运行。
// 写法照 probes.spec.ts：观察值先记进 testInfo.annotations（type 为 probe）和终端，看清之后把断言写死，
// 不写“观察到什么就断言什么”。context.setOffline 只在这三条探针里使用（研究 Pitfall 10）。
import { test, expect, type Page } from '../support/test';
import { APP_ORIGIN } from '../support/constants';

const probe = (testInfo: { annotations: Array<{ type: string; description?: string }> }, name: string, value: unknown) => {
  const text = `${name}=${JSON.stringify(value)}`;
  testInfo.annotations.push({ type: 'probe', description: text });
  console.log('PROBE-9 ' + text);
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
