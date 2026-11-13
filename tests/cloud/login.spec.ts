// Phase 9 的登录与云端存取用例：只在 npm run test:cloud 里运行，只用合成账号（FakePbServer.addUser，example.com 邮箱、运行时随机口令）。
// 应用由 USJ_CONFIG 的云端开关打开（harness 在应用脚本之前放这一行），自己同源加载真实的 PocketBase SDK，
// REST 由 Node 侧的 FakePbServer 接应；断言一律在 Node 侧做。
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { gotoGoals, readGroups } from '../support/goals';
import { randomUUID } from 'node:crypto';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW } from '../support/constants';
import {
  BTN_PICK_SAMPLE,
  BTN_PLAN_BUILD,
  LOGIN_BUSY,
  LOGIN_ERR_CREDENTIALS,
  LOGIN_ERR_EMPTY,
  LOGIN_ERR_RATE,
  LOGIN_ERR_UNREACHABLE,
  PW_HIDE,
  PW_HIDE_LABEL,
  PW_SHOW,
  PW_SHOW_LABEL,
  STATUS_CLOUD_SYNCED,
} from '../support/strings';

const AUTH_PATH = '/api/collections/users/auth-with-password';

// 合成种子计划：应用里唯一一份合成示例计划，即 normalizePlan(DEFAULT_PLAN)；JSON 往返后脱离 vm 的 realm
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));

test('ACCT-01 a synthetic account signs in on the login page and lands in the app with its server state', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#login a')).toHaveCount(0);
  await expect(page.locator('.wrap')).toBeHidden();

  await app.login(0);

  await expect(page.locator('#login')).toBeHidden();
  await expect(page.locator('.wrap')).toBeVisible();
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
  // 两份文档都已存在，应用不需要创建
  expect(app.fake.requests.filter((r) => r.method === 'POST' && r.path === '/api/collections/journey_docs/records')).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-01 a log recorded on the cloud path is uploaded to the state document with only data and writer', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  // 种子 state 文档的 id：以第 0 个账号的身份在 Node 侧列出
  const listed = await app.fake.request(0, 'GET', '/api/collections/journey_docs/records');
  const stateDocId = (listed.body as { items: Array<{ id: string; kind: string }> }).items.find((d) => d.kind === 'state')!.id;

  const entry = composer(page, 'w');
  await entry.type('SYNTH-0901 cloud entry');
  await entry.submit();

  await expect
    .poll(() => (app.fake.lastState(0)?.logs ?? []).some((l: { text: string }) => l.text === 'SYNTH-0901 cloud entry'), {
      message: '等待记录上传到 state 文档',
    })
    .toBe(true);
  const patches = app.fake.requests.filter((r) => r.method === 'PATCH');
  expect(patches).toEqual([{ method: 'PATCH', path: `/api/collections/journey_docs/records/${stateDocId}`, status: 200 }]);
  expect(app.fake.requests.filter((r) => r.status === 404)).toEqual([]);
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  expect(app.fake.fulfillErrors).toEqual([]);
});

// D-01（Phase 14）：新账号第一次登录建出的计划文档是空计划，不再是示例计划；每周健身目标和说明保留示例的值（D-03）
const EMPTY_PLAN = {
  v: 1,
  presets: { lang: [], pro: [], fit: [], job: [], oth: [] },
  groups: [],
  lifts: [],
  fitGoal: [2, 4],
  fitNote: SEED_PLAN.fitNote,
};

test('PLAN-01 a first sign-in creates the state document and an empty plan document that keeps the weekly fitness goal and note (D-01)', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', users: 1, login: 0 });

  expect(app.fake.lastPlan(0)).toEqual(EMPTY_PLAN);
  expect(app.fake.lastState(0)).toEqual({ arrival: '', tasks: {}, custom: [], logs: [], lifts: {}, reviews: {}, presets: {} });
  const created = app.fake.requests.filter((r) => r.method === 'POST' && r.path === '/api/collections/journey_docs/records');
  expect(created).toHaveLength(2);
  expect(created.every((r) => r.status === 200)).toBe(true);
  await gotoGoals(page);
  await expect(page.locator('#goals .pe-empty')).toHaveCount(1);
  expect(await readGroups(page)).toEqual([]);
  await expect(page.locator('#planEditBtn2')).toHaveText(BTN_PLAN_BUILD);
  await expect(page.locator('#planSampleBtn')).toHaveText(BTN_PICK_SAMPLE);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('ACCT-01 a signed-in session survives a page reload', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });

  await app.reload();

  await expect(page.locator('#login')).toBeHidden();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  expect(app.fake.requests).toContainEqual({ method: 'POST', path: '/api/collections/users/auth-refresh', status: 200 });
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('ACCT-01 a wrong password says the email or password is wrong, clears only the password and keeps the email', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud' });
  const [user] = app.fake.users;
  const wrongEntry = randomUUID();
  const email = page.locator('#loginEmail');
  const pw = page.locator('#loginPw');
  const err = page.locator('#login-err');
  await email.fill(user.email);
  await pw.fill(wrongEntry);
  await page.locator('#loginBtn').click();

  // 统一文案，不说明是邮箱还是密码不对；密码框清空并聚焦、aria-invalid 为 true，邮箱保留
  await expect(err).toHaveText(LOGIN_ERR_CREDENTIALS);
  await expect(pw).toHaveValue('');
  await expect(pw).toBeFocused();
  await expect(pw).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveValue(user.email);
  await expect(page.locator('#login')).toBeVisible();
  await acknowledgeConsoleErrors(guard, { 'status of 400 ': 1 });

  // 再次输入：错误区清空，aria-invalid 去掉
  await pw.pressSequentially('x');
  await expect(err).toHaveText('');
  await expect(pw).not.toHaveAttribute('aria-invalid', /.*/);
  expect(await page.evaluate(() => window.localStorage.getItem('pocketbase_auth'))).toBeNull();
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('ACCT-01 an unreachable server, a server error and a rate limit each show their own message and keep both fields', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud' });
  const [user] = app.fake.users;
  const err = page.locator('#login-err');
  const email = page.locator('#loginEmail');
  const pw = page.locator('#loginPw');

  const refuse = app.fake.fault({ method: 'POST', path: AUTH_PATH, mode: 'refuse', times: 1 });
  await app.submitLogin(0);
  await expect(err).toHaveText(LOGIN_ERR_UNREACHABLE);
  expect(refuse.hits).toBe(1);
  await expect(email).toHaveValue(user.email);
  await expect(pw).toHaveValue(user.password);

  const serverError = app.fake.fault({ method: 'POST', path: AUTH_PATH, mode: 'status', status: 503, times: 1 });
  await page.locator('#loginBtn').click();
  await expect(err).toHaveText(LOGIN_ERR_UNREACHABLE);
  expect(serverError.hits).toBe(1);
  await expect(email).toHaveValue(user.email);
  await expect(pw).toHaveValue(user.password);

  const limited = app.fake.fault({ method: 'POST', path: AUTH_PATH, mode: 'status', status: 429, times: 1 });
  await page.locator('#loginBtn').click();
  await expect(err).toHaveText(LOGIN_ERR_RATE);
  expect(limited.hits).toBe(1);
  await expect(email).toHaveValue(user.email);
  await expect(pw).toHaveValue(user.password);
  await expect(pw).not.toHaveAttribute('aria-invalid', /.*/);

  await expect(page.locator('#login')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('pocketbase_auth'))).toBeNull();
  expect(app.fake.fulfillErrors).toEqual([]);
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1, 'status of 503 ': 1, 'status of 429 ': 1 });
});

// 15 秒超时只在 manual 时钟下测，不真的等
test.describe('login timeout', () => {
  test.use({ clockMode: 'manual' });

  test('ACCT-01 a sign-in with no answer after about 15 seconds is reported as unreachable and a late answer does not sign in', async ({
    app,
    page,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud' });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const btn = page.locator('#loginBtn');
    const hold = app.fake.fault({ method: 'POST', path: AUTH_PATH, mode: 'hold' });

    await app.submitLogin(0);
    await expect.poll(() => hold.hits, { message: '等待登录请求到达假服务器（被挂起）' }).toBe(1);

    // 提交中：按钮 disabled、aria-busy、忙碌文字，两个输入框 readonly
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText(LOGIN_BUSY);
    await expect(btn).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#loginEmail')).toHaveJSProperty('readOnly', true);
    await expect(page.locator('#loginPw')).toHaveJSProperty('readOnly', true);

    // 约 15 秒无响应：按连不上处理，按钮恢复
    await page.clock.runFor(15_000);
    await expect(page.locator('#login-err')).toHaveText(LOGIN_ERR_UNREACHABLE);
    await expect(btn).toBeEnabled();
    await expect(btn).toHaveText('登录');
    await expect(btn).not.toHaveAttribute('aria-busy', /.*/);
    await expect(page.locator('#loginEmail')).toHaveJSProperty('readOnly', false);
    await expect(page.locator('#loginPw')).toHaveJSProperty('readOnly', false);

    // 放行：请求已被中止，晚到的成功不会让页面登录，也不会留下令牌
    await hold.release();
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('.wrap')).toBeHidden();
    expect(await page.evaluate(() => window.localStorage.getItem('pocketbase_auth'))).toBeNull();
    // 被中止的请求在放行时 fulfill 没有报错：fulfillErrors 实测为 0 条（计划只要求至多一条）
    expect(app.fake.fulfillErrors).toEqual([]);
  });
});

test('ACCT-01 submitting twice sends one sign-in request', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });
  const hold = app.fake.fault({ method: 'POST', path: AUTH_PATH, mode: 'hold' });

  await app.submitLogin(0);
  // 提交中：再点两次、再在密码框按 Enter，都不会再发请求（按钮已 disabled，force 跳过可点击检查）
  await page.locator('#loginBtn').click({ force: true });
  await page.locator('#loginBtn').click({ force: true });
  await page.locator('#loginPw').press('Enter');
  await expect.poll(() => hold.hits, { message: '等待登录请求到达假服务器（被挂起）' }).toBe(1);
  // 再走一轮页面事件循环，让可能多发的第二个请求有机会到达
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(hold.hits).toBe(1);

  await hold.release();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('.wrap')).toBeVisible();
  expect(app.fake.requests.filter((r) => r.method === 'POST' && r.path === AUTH_PATH)).toHaveLength(1);
  expect(hold.hits).toBe(1);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('ACCT-01 the login page has no registration or password-reset entry and prefills the last signed-in email', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });
  const [user] = app.fake.users;

  // 首次打开：没有链接，只有“显示”和“登录”两个按钮；没有上次邮箱，邮箱为空且焦点在邮箱框
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#login a')).toHaveCount(0);
  await expect(page.locator('#login button')).toHaveText([PW_SHOW, '登录']);
  await expect(page.locator('#loginEmail')).toHaveValue('');
  await expect(page.locator('#loginEmail')).toBeFocused();

  // 登录成功后删掉令牌再刷新：邮箱预填、焦点在密码框、密码框为空
  await app.login(0);
  await page.evaluate(() => window.localStorage.removeItem('pocketbase_auth'));
  await page.reload();
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#loginEmail')).toHaveValue(user.email);
  await expect(page.locator('#loginPw')).toBeFocused();
  await expect(page.locator('#loginPw')).toHaveValue('');
  await expect(page.locator('#login a')).toHaveCount(0);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('ACCT-01 empty fields are reported locally and focus the first empty field', async ({ app, page }) => {
  await app.open({ mode: 'cloud' });
  const [user] = app.fake.users;
  const err = page.locator('#login-err');

  // 两项都空：焦点移到邮箱框
  await page.locator('#loginBtn').click();
  await expect(err).toHaveText(LOGIN_ERR_EMPTY);
  await expect(page.locator('#loginEmail')).toBeFocused();
  await expect(page.locator('#loginBtn')).toBeEnabled();
  await expect(page.locator('#loginBtn')).toHaveText('登录');

  // 只填邮箱：同一错误，焦点移到密码框
  await page.locator('#loginEmail').fill(user.email);
  await expect(err).toHaveText('');
  await page.locator('#loginBtn').click();
  await expect(err).toHaveText(LOGIN_ERR_EMPTY);
  await expect(page.locator('#loginPw')).toBeFocused();
  await expect(page.locator('#loginEmail')).toHaveValue(user.email);

  // 本地检查不发请求
  expect(app.fake.requests.filter((r) => r.path.endsWith('/auth-with-password'))).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('ACCT-01 the password can be shown and is hidden again after a submit', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });
  const pw = page.locator('#loginPw');
  const toggle = page.locator('#login .pw-toggle');
  await expect(pw).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveText(PW_SHOW);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-label', PW_SHOW_LABEL);

  await toggle.click();
  await expect(pw).toHaveAttribute('type', 'text');
  await expect(toggle).toHaveText(PW_HIDE);
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).toHaveAttribute('aria-label', PW_HIDE_LABEL);

  // 再点一次回到隐藏，再显示，然后提交
  await toggle.click();
  await expect(pw).toHaveAttribute('type', 'password');
  await toggle.click();
  await expect(pw).toHaveAttribute('type', 'text');

  await app.login(0);
  await expect(pw).toHaveAttribute('type', 'password');
  await expect(toggle).toHaveText(PW_SHOW);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-label', PW_SHOW_LABEL);
  expect(app.fake.fulfillErrors).toEqual([]);
});
