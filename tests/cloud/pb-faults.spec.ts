// 假服务器错误注入开关的自检（TEST-02，09-03）。只在 npm run test:cloud 里运行，只用合成账号。
// 开关由用例显式打开，只作用于页面请求；不用计时器，不用 context.setOffline。
import { test, expect } from '../support/test';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { LOGIN_ERR_UNREACHABLE } from '../support/strings';

test('TEST-02 the refuse switch fails a page request at the network layer and the app shows the connection message', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud' });
  await expect(page.locator('#login')).toBeVisible();
  const f = app.fake.fault({ method: 'POST', path: '/api/collections/users/auth-with-password', mode: 'refuse' });

  await app.submitLogin(0);

  await expect(page.locator('#login-err')).toHaveText(LOGIN_ERR_UNREACHABLE);
  expect(f.hits).toBe(1);
  expect(app.fake.faultHits).toEqual([
    { method: 'POST', path: '/api/collections/users/auth-with-password', mode: 'refuse', status: 0 },
  ]);
  // 被拒绝的请求没有到达 handle()，也没有任何令牌留在浏览器里
  expect(app.fake.requests.filter((r) => r.path.endsWith('/auth-with-password'))).toEqual([]);
  expect(await page.evaluate(() => window.localStorage.getItem('pocketbase_auth'))).toBeNull();
  expect(app.fake.fulfillErrors).toEqual([]);
  // 被拒连接：Chromium 为这条 fetch 写一条带网络错误码的 console.error
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
});
