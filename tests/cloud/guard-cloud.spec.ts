// cloud 护栏的单元断言和故意违规自检（TEST-02，SC4）：只在 npm run test:cloud 里运行。
// 自检的写法照 tests/e2e/platform/guardrails.spec.ts：每个“应当出现”的记录用 expect.poll，
// 只在故意违规的用例里调用 guard.remove，调用之前先断言该类记录恰好是预期的那几条（WR-02）。
import { test, expect } from '../support/test';
import { classifyRequest, guardPolicy } from '../support/test';
import { APP_ORIGIN, PB_SDK_PATH } from '../support/constants';

test('TEST-02 classifyRequest allows only the app page, the app file and the SDK under the cloud policy', () => {
  for (const path of ['/', '/us-journey-tracker.html', PB_SDK_PATH]) {
    expect(classifyRequest(APP_ORIGIN + path, 'cloud'), path).toBe('allow');
  }
  for (const path of ['/api/collections/journey_docs/records', '/package.json', '/tests/support/static-server.cjs']) {
    expect(classifyRequest(APP_ORIGIN + path, 'cloud'), path).toBe('violation');
  }
  expect(classifyRequest('https://fonts.googleapis.com/css2', 'cloud')).toBe('violation');
  expect(classifyRequest('https://example.com/', 'cloud')).toBe('violation');
  expect(classifyRequest('http://localhost:4789/', 'cloud')).toBe('violation');
  expect(classifyRequest('not a url', 'cloud')).toBe('violation');

  // v1 策略（默认 npm test）：页面和应用文件放行；其他路径包括 SDK 和 /api 都是违规（v1 页面不加载 SDK）
  for (const path of ['/', '/us-journey-tracker.html']) {
    expect(classifyRequest(APP_ORIGIN + path, 'v1'), path).toBe('allow');
  }
  for (const path of ['/package.json', PB_SDK_PATH, '/api/collections/journey_docs/records']) {
    expect(classifyRequest(APP_ORIGIN + path, 'v1'), path).toBe('violation');
  }
  expect(classifyRequest('https://fonts.gstatic.com/s/x.woff2', 'v1')).toBe('font');
  expect(classifyRequest('https://example.com/', 'v1')).toBe('violation');

  expect(guardPolicy('cloud')).toBe('cloud');
  expect(guardPolicy(undefined)).toBe('v1');
  expect(guardPolicy('account')).toBe('v1');
});

test('TEST-02 the cloud guard reports an /api path the fake server does not implement', async ({ app, page, guard }) => {
  await app.open({ mode: 'cloud', backend: null });
  const target = APP_ORIGIN + '/api/collections/nope/records';

  const result = await page.evaluate(() =>
    fetch('/api/collections/nope/records').then(
      (res) => 'resolved:' + res.status,
      (err) => 'rejected:' + String(err),
    ),
  );
  expect(result).not.toMatch(/^resolved/);

  // 假服务器放手（route.fallback()），由护栏接住并记违规
  await expect.poll(() => guard.state.unexpectedRequests).toEqual([target]);
  expect(app.fake.requests.map((r) => r.path)).not.toContain('/api/collections/nope/records');
  expect(guard.remove('unexpectedRequests', target)).toBe(1);

  // 被 abort 的请求，Chromium 另写一条 console.error：按条核对后删除
  await expect.poll(() => guard.state.consoleErrors.length).toBe(1);
  expect(guard.state.consoleErrors[0]).toContain('ERR_BLOCKED_BY_CLIENT');
  expect(guard.remove('consoleErrors', 'ERR_BLOCKED_BY_CLIENT')).toBe(1);
});

test('TEST-02 the cloud guard reports an external host, a non-allowlisted app path and a real EventSource', async ({
  page,
  guard,
}) => {
  // 不用 app.open：页面里没有假 EventSource，new EventSource 走真实的实现
  await page.goto('/');
  const targets = ['https://example.com/', APP_ORIGIN + '/package.json', APP_ORIGIN + '/api/realtime'];

  const results = await page.evaluate(async () => {
    const out: string[] = [];
    out.push(await fetch('https://example.com/').then((r) => 'resolved:' + r.status, (e) => 'rejected:' + String(e)));
    out.push(await fetch('/package.json').then((r) => 'resolved:' + r.status, (e) => 'rejected:' + String(e)));
    out.push(
      await new Promise<string>((resolve) => {
        const es = new EventSource('/api/realtime');
        es.onerror = () => {
          es.close();
          resolve('error');
        };
        es.onopen = () => {
          es.close();
          resolve('open');
        };
      }),
    );
    return out;
  });
  expect(results[0]).toMatch(/^rejected/);
  expect(results[1]).toMatch(/^rejected/);
  expect(results[2]).toBe('error');

  await expect.poll(() => [...guard.state.unexpectedRequests].sort()).toEqual([...targets].sort());
  for (const target of targets) {
    expect(guard.remove('unexpectedRequests', target), target).toBe(1);
  }

  // Chromium 为这三条被 abort 的请求各写一条 console.error（首次运行观察到的原文，三条相同）：
  // 先断言条数和内容，再逐条删除
  await expect.poll(() => guard.state.consoleErrors.length).toBe(3);
  expect(guard.state.consoleErrors).toEqual(Array(3).fill('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector'));
  expect(guard.remove('consoleErrors', 'ERR_BLOCKED_BY_CLIENT')).toBe(3);
});
