// Phase 9 的会话用例（ACCT-01 的会话部分）：登录过期回到登录页但不丢本机修改、同一账号重新登录后继续上传、
// 本地令牌已过期不联系服务器、关掉浏览器再打开仍保持登录。只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 登录过期只看 authRefresh 的 401 或本地令牌的 exp，从不看记录接口的状态码（PB-CONTRACT §9）。
// 用例都在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt(FROZEN_NOW + 60_000)，不真的等。
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { openDevice } from '../support/devices';
import { FROZEN_NOW } from '../support/constants';
import type { AppHarness } from '../support/app';
import type { GuardHandle } from '../support/test';
import { LOGIN_EXPIRED, LOGIN_EXPIRED_UNSENT, STATUS_CLOUD_SYNCED, STATUS_SAVE_FAILED_CLOUD } from '../support/strings';

test.use({ clockMode: 'manual' });

type Log = { id: string; text: string };

const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

const KEPT = 'SYNTH-0911 kept through expiry';
const RECORD = /\/api\/collections\/journey_docs\/records\/[^/]+$/;

// 带着一条没上传的修改走到“令牌在服务器端失效”：保存和读单条记录都被拒，记一条，推过防抖，状态行是保存失败；
// 然后撤销这个账号的令牌，下一次启动时 authRefresh 会得到 401
async function leaveUnsentEditThenRevoke(app: AppHarness, page: Page, guard: GuardHandle) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  app.fake.fault({ method: 'PATCH', path: RECORD, mode: 'refuse' });
  app.fake.fault({ method: 'GET', path: RECORD, mode: 'refuse' });
  const entry = composer(page, 'w');
  await entry.type(KEPT);
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(page.locator('#status')).toHaveText(STATUS_SAVE_FAILED_CLOUD);
  // 保存前先读单条记录，被拒的连接只有这一次（PATCH 没有发出）
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });

  await app.fake.clearFaults();
  app.fake.revokeTokens(0);
}

test('ACCT-01 an auth-refresh 401 at startup returns to the login page with the expired notice and keeps the unsent edit of this account', async ({
  app,
  page,
  guard,
}) => {
  await leaveUnsentEditThenRevoke(app, page, guard);

  await page.reload();

  await expect(page.locator('#login')).toBeVisible();
  const notice = page.locator('#loginNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('data-tone', 'warn');
  await expect(notice.locator('p')).toHaveText([LOGIN_EXPIRED, LOGIN_EXPIRED_UNSENT]);
  await expect(page.locator('.wrap')).toBeHidden();

  // 令牌清掉了，但这个账号的缓存和没上传的修改还在
  expect(await page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();
  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  expect(cached).not.toBeNull();
  expect(cached.dirty).toBe(true);
  expect(hasText(cached.data.logs, KEPT)).toBe(true);
  // 服务器上还没有这条
  expect(hasText(app.fake.lastState(0)?.logs, KEPT)).toBe(false);
  await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });
});

test('ACCT-01 signing in again with the same account uploads the edit kept through the expiry', async ({
  app,
  page,
  guard,
}) => {
  await leaveUnsentEditThenRevoke(app, page, guard);

  await page.reload();
  await expect(page.locator('#loginNotice')).toBeVisible();
  await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });

  await app.login(0);

  // 对账照常上传过期期间留在缓存里的修改；登录成功后过期提示收起，也没有打开换账号确认框（dialog#confirm 自 09-14 起一直在页面里，只数打开的）
  expect(hasText(app.fake.lastState(0)?.logs, KEPT)).toBe(true);
  await expect(page.locator('#loginNotice')).toBeHidden();
  await expect(page.locator('dialog#confirm[open]')).toHaveCount(0);
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `usj:v2:${app.fake.users[0].id}:state`);
  expect(cached.dirty).toBe(false);
});

test('ACCT-01 a token past its local expiry shows the expired notice without contacting the server', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });

  // 90 天的令牌在第 91 天本地 exp 已过：重新打开时不联系服务器
  await page.clock.setFixedTime(FROZEN_NOW + 91 * 24 * 3600 * 1000);
  const before = app.fake.requests.length;
  await page.reload();

  await expect(page.locator('#login')).toBeVisible();
  const notice = page.locator('#loginNotice');
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('data-tone', 'warn');
  // 没有没上传的修改，所以只有第一行
  await expect(notice.locator('p')).toHaveText([LOGIN_EXPIRED]);
  expect(app.fake.requests.length).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `usj:v2:${app.fake.users[0].id}:state`);
  expect(cached).not.toBeNull();
  expect(cached.dirty).toBe(false);
});

test('ACCT-01 a session survives closing and reopening the browser', async ({ app, page, browser, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 关掉浏览器再打开：同一份存储状态的新 context
  const saved = await page.context().storageState();
  const before = app.fake.requests.length;
  const second = await openDevice({ browser, guard, fake: app.fake, storageState: saved });
  try {
    await second.app.open({ mode: 'cloud', login: 'session' });

    await expect(second.page.locator('#login')).toBeHidden();
    await expect(second.page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
    await expect(second.page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
    // 启动时向服务器刷新了一次登录
    const refreshes = app.fake.requests.slice(before).filter((r) => r.method === 'POST' && r.path.endsWith('/auth-refresh'));
    expect(refreshes.map((r) => r.status)).toEqual([200]);
  } finally {
    await second.context.close();
  }
});
