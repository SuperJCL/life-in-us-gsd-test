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
import { AppHarness } from '../support/app';
import type { GuardHandle } from '../support/test';
import {
  BANNER_EXPIRED,
  BTN_RELOGIN,
  LOGIN_EXPIRED,
  LOGIN_EXPIRED_UNSENT,
  NOTICE_OTHER_TAB,
  STATUS_CLOUD_SYNCED,
  statusOffline,
} from '../support/strings';

test.use({ clockMode: 'manual' });

type Log = { id: string; text: string };

const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

const KEPT = 'SYNTH-0911 kept through expiry';
const RECORD = /\/api\/collections\/journey_docs\/records\/[^/]+$/;
const LIST = '/api/collections/journey_docs/records';

// 带着一条没上传的修改走到“令牌在服务器端失效”：保存先读文档列表再更新单条记录，这两个请求都被拒，记一条，推过防抖，状态行是离线（1 项修改）；
// 然后撤销这个账号的令牌，下一次启动时 authRefresh 会得到 401
async function leaveUnsentEditThenRevoke(app: AppHarness, page: Page, guard: GuardHandle) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  app.fake.fault({ method: 'PATCH', path: RECORD, mode: 'refuse' });
  app.fake.fault({ method: 'GET', path: LIST, mode: 'refuse' });
  const entry = composer(page, 'w');
  await entry.type(KEPT);
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(page.locator('#status')).toHaveText(statusOffline(1));
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'offline');
  // 保存先读文档列表，被拒的连接只有这一次（PATCH 没有发出）；manual 时钟没有 runFor，自动重试不会自行触发
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

test('ACCT-01 an expiry found by one tab resets that tab and is shown as an expiry, not as a sign-out, in the other tab', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const userA = app.fake.users[0];

  // 同一个浏览器的第二个标签页，以已有会话打开，显示着账号 A 的内容
  const page2 = await page.context().newPage();
  try {
    await page2.clock.setFixedTime(FROZEN_NOW);
    const app2 = new AppHarness(page2, { fake: app.fake });
    await app2.open({ mode: 'cloud', login: 'session' });
    await expect(page2.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);

    // 服务器端令牌失效，标签页一重新打开：authRefresh 得到 401（缓存先渲染了内容，随后被重置）
    app.fake.revokeTokens(0);
    await page.reload();
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('#loginNotice p').first()).toHaveText(LOGIN_EXPIRED);
    await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });
    // 页面状态和界面都按退出重置过：上一个账号的记录不再留在页面里，等待对账的计时器和门控也没有残留
    const html = await page.content();
    expect(html).not.toContain('合成记录 a');
    expect(html).not.toContain('synthetic-a');
    await expect(page.locator('body')).not.toHaveAttribute('data-gate');
    await expect(page.locator('#status')).not.toHaveText(/Cannot read|TypeError/);

    // 标签页二：显示的是登录过期，不是“已在另一个标签页退出登录”
    await expect(page2.locator('#login')).toBeVisible();
    await expect(page2.locator('.wrap')).toBeHidden();
    const notice = page2.locator('#loginNotice');
    await expect(notice).toHaveAttribute('data-tone', 'warn');
    await expect(notice.locator('p').first()).toHaveText(LOGIN_EXPIRED);
    await expect(notice).not.toContainText(NOTICE_OTHER_TAB);

    // 过期不清本机缓存（账号 A 的缓存仍在，同一账号重新登录后照常对账）
    expect(await page.evaluate((k) => localStorage.getItem(k), `usj:v2:${userA.id}:state`)).not.toBeNull();
    expect(await page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();

    // 重新登录之后过期标记被清掉：之后另一个标签页的主动退出仍然显示成退出
    await app.login(0);
    expect(await page.evaluate(() => localStorage.getItem('usj:v2:authExpired'))).toBeNull();
  } finally {
    await page2.close();
  }
});

// ACCT-05：会话中途发现登录过期。保存时记录接口对失效令牌返回 200 空列表，应用先 authRefresh 排除令牌失效，401 才算过期（PB-CONTRACT §9）；
// 过期后不跳到登录页：本机的修改保留、还能继续记、状态行和横幅提示重新登录，期间不再发请求
test('ACCT-05 an expiry found while saving keeps editing here, shows the expired status and banner, and uploads after signing in again with the same account', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const userA = app.fake.users[0];

  app.fake.revokeTokens(0);
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1007 before expiry');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect(status).toHaveText(LOGIN_EXPIRED);
  await expect(status).toHaveAttribute('data-state', 'expired');
  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'warn');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_EXPIRED);
  await expect(bar.locator('button')).toHaveText([BTN_RELOGIN]);
  // 没有跳到登录页，输入框仍然可用
  await expect(page.locator('#login')).toBeHidden();
  await expect(page.locator('#w-text')).toBeEnabled();

  // 过期之后还能继续记：写进本机缓存，状态行保持过期
  await entry.type('SYNTH-1007 during expiry');
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(status).toHaveAttribute('data-state', 'expired');
  const key = `usj:v2:${userA.id}:state`;
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  expect(cached.dirty).toBe(true);
  expect(hasText(cached.data.logs, 'SYNTH-1007 before expiry')).toBe(true);
  expect(hasText(cached.data.logs, 'SYNTH-1007 during expiry')).toBe(true);

  // 过期期间不再发起任何同步请求
  const before = app.fake.requests.length;
  await page.clock.runFor(60_000);
  expect(app.fake.requests.length).toBe(before);
  // 令牌失效只在 authRefresh 上表现为 401，只此一条
  await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });

  // 点“重新登录”：登录页预填邮箱，过期提示两行
  await bar.locator('button', { hasText: BTN_RELOGIN }).click();
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#loginEmail')).toHaveValue(userA.email);
  await expect(page.locator('#loginNotice p')).toHaveText([LOGIN_EXPIRED, LOGIN_EXPIRED_UNSENT]);

  // 同一账号重新登录：过期前后的两条都上传，没有换账号确认
  await app.login(0);
  expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-1007 before expiry')).toBe(true);
  expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-1007 during expiry')).toBe(true);
  await expect(page.locator('dialog#confirm[open]')).toHaveCount(0);
});

test('ACCT-05 a token that passes its local expiry during the session is reported as expired without asking the server', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const userA = app.fake.users[0];

  // 会话进行中，90 天的令牌在第 91 天本地 exp 已过：下一次同步之前就判过期，不联系服务器
  await page.clock.setSystemTime(FROZEN_NOW + 91 * 24 * 3600 * 1000);
  const before = app.fake.requests.length;
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1007 after local expiry');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect(status).toHaveText(LOGIN_EXPIRED);
  await expect(status).toHaveAttribute('data-state', 'expired');
  await expect(page.locator('#syncbar .sb-msg')).toHaveText(BANNER_EXPIRED);
  await expect(page.locator('#syncbar button')).toHaveText([BTN_RELOGIN]);
  expect(app.fake.requests.length).toBe(before);
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `usj:v2:${userA.id}:state`);
  expect(cached.dirty).toBe(true);
  expect(hasText(cached.data.logs, 'SYNTH-1007 after local expiry')).toBe(true);
});

// 10 号阶段评审 WR-01：退出登录时后台同步里的 authRefresh 还在路上，它的迟到应答既不能把令牌重新存回来，也不能在登录页上冒出“登录已过期”。
// 触发办法：服务器上的 state 文档被删，后台同步读到缺文档后先 authRefresh（排除令牌失效），这条请求被挂起；挂起期间退出，再放行。
const AUTH_REFRESH = '/api/collections/users/auth-refresh';

async function signOutWhileAuthRefreshIsHeld(app: AppHarness, page: Page, revoke: boolean) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  app.fake.dropDocs(0, 'state');
  const hold = app.fake.fault({ method: 'POST', path: AUTH_REFRESH, mode: 'hold' });
  // online 事件让后台同步立刻跑一轮（不需要改本地数据，所以退出时没有确认框）
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => hold.hits, { message: '等待 authRefresh 被挂起' }).toBe(1);

  await page.locator('#logoutBtn').click();
  await expect(page.locator('#login')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();

  // 迟到的应答：令牌有效时是 200 带新令牌，已被撤销时是 401
  if (revoke) app.fake.revokeTokens(0);
  await hold.release();
  // 页面一侧收到（或没收到）应答需要几个往返；请求已被中止的话，假服务器写回应答时失败，只可能是这一条
  for (let i = 0; i < 5; i++) await page.evaluate(() => 0);
  await page.waitForTimeout(200);
  for (const e of app.fake.fulfillErrors) expect(e.path).toBe(AUTH_REFRESH);
  expect(app.fake.fulfillErrors.length).toBeLessThanOrEqual(1);
}

test('ACCT-02 a late authRefresh answer after signing out does not store the token again', async ({ app, page }) => {
  await signOutWhileAuthRefreshIsHeld(app, page, false);

  expect(await page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();
  await expect(page.locator('#login')).toBeVisible();
  // 刷新页面仍是登录页，没有被悄悄撤销的退出
  await page.reload();
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('.wrap')).toBeHidden();
});

test('ACCT-05 a late 401 after signing out does not show the expired notice or mark the token expired', async ({ app, page }) => {
  await signOutWhileAuthRefreshIsHeld(app, page, true);

  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#loginNotice')).toBeHidden();
  await expect(page.locator('#syncbar')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('usj:v2:authExpired'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('pocketbase_auth'))).toBeNull();
});
