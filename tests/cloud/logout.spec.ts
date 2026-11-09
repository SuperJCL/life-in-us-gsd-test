// Phase 9 的退出登录用例（ACCT-02）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 退出的固定顺序（D-06）：先退订实时、再清该账号的记录缓存、计划缓存、冲突留底和 lastUser、最后清令牌，然后回到登录页；
// 登录页一直预填刚退出的邮箱（D-07，所有者选定的行为）。退出确认框（D-05）、保存进行中退出、未下载留底和换账号登录确认（09-14）也在本文件。
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { AppHarness } from '../support/app';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { openDevice } from '../support/devices';
import { APP_FILE_NAME, FROZEN_NOW } from '../support/constants';
import {
  BTN_LOGOUT,
  BTN_LOGOUT_ANYWAY,
  BTN_NO_SWITCH,
  BTN_STAY,
  BTN_SWITCH_ANYWAY,
  CONFIRM_LOGOUT_ACCOUNT_PREFIX,
  CONFIRM_LOGOUT_SNAPSHOT,
  CONFIRM_LOGOUT_TITLE,
  CONFIRM_LOGOUT_UNSAVED,
  CONFIRM_SWITCH_TITLE,
  NOTICE_OTHER_TAB,
  STATUS_SAVE_FAILED_CLOUD,
  switchBody,
} from '../support/strings';

const PREFIX = 'usj:v2:';

type Log = { id: string; text: string };

const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

const storageKeys = (page: Page): Promise<string[]> => page.evaluate(() => Object.keys(localStorage).sort());
const stored = (page: Page, key: string): Promise<string | null> => page.evaluate((k) => localStorage.getItem(k), key);

test("ACCT-02 after logout no cache, kept version or token of account A remains and account B sees none of A's content", async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', users: 2, seed: syntheticState('a') });
  app.fake.seed(syntheticState('b'), { userIndex: 1 });
  const [userA, userB] = app.fake.users;

  await app.login(0);
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
  // 放一份 A 的冲突留底（合成内容），证明退出连留底一起清
  await page.evaluate(
    ([key, json]) => localStorage.setItem(key, json),
    [`${PREFIX}${userA.id}:snapshot`, JSON.stringify({ kind: 'state', data: syntheticState('a-old') })],
  );
  const before = await storageKeys(page);
  expect(before).toEqual(
    expect.arrayContaining([
      `${PREFIX}${userA.id}:state`,
      `${PREFIX}${userA.id}:plan`,
      `${PREFIX}${userA.id}:snapshot`,
      `${PREFIX}lastUser`,
      `${PREFIX}lastEmail`,
      'pocketbase_auth',
    ]),
  );

  // 放进去的留底还没下载，所以退出前先确认（D-05）；这条用例走仍然退出
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#cf-body')).toContainText(CONFIRM_LOGOUT_SNAPSHOT);
  await page.locator('#cfOk').click();

  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('.wrap')).toBeHidden();
  await expect(page.locator('#loginEmail')).toHaveValue(userA.email);
  await expect(page.locator('#loginPw')).toBeFocused();
  const after = await storageKeys(page);
  expect(after.filter((k) => k.startsWith(`${PREFIX}${userA.id}:`))).toEqual([]);
  expect(after).not.toContain(`${PREFIX}lastUser`);
  expect(after).not.toContain('pocketbase_auth');
  expect(await stored(page, `${PREFIX}lastEmail`)).toBe(userA.email);

  // 不 reload：同一个页面里 B 直接登录
  await app.login(1);

  const html = await page.content();
  expect(html).not.toContain('合成记录 a');
  expect(html).not.toContain('synthetic-a');
  expect(html).toContain('合成记录 b');
  expect((await storageKeys(page)).filter((k) => k.startsWith(PREFIX))).toEqual(
    [
      `${PREFIX}${userB.id}:plan`,
      `${PREFIX}${userB.id}:state`,
      `${PREFIX}lastEmail`,
      `${PREFIX}lastUser`,
    ].sort(),
  );
  expect(await stored(page, `${PREFIX}lastUser`)).toBe(userB.id);
  expect(await stored(page, `${PREFIX}lastEmail`)).toBe(userB.email);
});

test('ACCT-02 logout unsubscribes first, then clears the caches and the kept version, and clears the token last', async ({
  app,
  page,
}) => {
  // 白盒观测只用于测试装置：只在本用例里包一层 removeItem，按顺序记键名；应用里没有任何测试专用出口
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __removed: string[] }).__removed = seen;
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      seen.push(String(key));
      return original.call(this, key);
    };
  });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const userA = app.fake.users[0];
  await page.evaluate(
    ([key, json]) => localStorage.setItem(key, json),
    [`${PREFIX}${userA.id}:snapshot`, JSON.stringify({ kind: 'state', data: syntheticState('a-old') })],
  );

  // 放进去的留底还没下载，所以退出前先确认（D-05）；这条用例走仍然退出
  await page.locator('#logoutBtn').click();
  await expect(page.locator('#cf-body')).toContainText(CONFIRM_LOGOUT_SNAPSHOT);
  await page.locator('#cfOk').click();
  await expect(page.locator('#login')).toBeVisible();

  const removed = await page.evaluate(() => (window as unknown as { __removed: string[] }).__removed);
  const at = (key: string) => removed.indexOf(key);
  const authAt = at('pocketbase_auth');
  expect(removed.filter((k) => k === 'pocketbase_auth')).toHaveLength(1);
  for (const key of [`${PREFIX}${userA.id}:state`, `${PREFIX}${userA.id}:plan`, `${PREFIX}${userA.id}:snapshot`, `${PREFIX}lastUser`]) {
    expect(at(key), `${key} 已被删除`).toBeGreaterThanOrEqual(0);
    expect(at(key), `${key} 在令牌之前删除`).toBeLessThan(authAt);
  }

  // 源码顺序：退订 -> 删缓存 -> 清令牌
  const html = fs.readFileSync(path.join(__dirname, '..', '..', APP_FILE_NAME), 'utf8');
  const from = html.indexOf('function logout(');
  expect(from).toBeGreaterThan(-1);
  const to = html.indexOf('function ', from + 'function logout('.length);
  const body = html.slice(from, to === -1 ? undefined : to);
  const unsub = body.indexOf('realtime.unsubscribe');
  const drop = body.indexOf('removeItem');
  const clear = body.indexOf('authStore.clear');
  expect(unsub).toBeGreaterThan(-1);
  expect(drop).toBeGreaterThan(unsub);
  expect(clear).toBeGreaterThan(drop);
});

test('ACCT-02 a double click on logout signs out once and an unreachable server does not block it', async ({ app, page, guard }) => {
  // 只在本用例里数 pocketbase_auth 被删除的次数：连点只能执行一次退出
  await page.addInitScript(() => {
    const counter = { auth: 0 };
    (window as unknown as { __authRemovals: { auth: number } }).__authRemovals = counter;
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (String(key) === 'pocketbase_auth') counter.auth += 1;
      return original.call(this, key);
    };
  });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const userA = app.fake.users[0];

  // 登录之后 /api/ 下的全部路径都连不上
  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    app.fake.fault({ method, path: /^\/api\//, mode: 'refuse' });
  }
  await page.locator('#logoutBtn').dblclick();

  // 第二次点击落在已经换成登录页的位置上，焦点是否还在密码框不确定，这里不断言焦点（焦点由第一条用例断言）
  await expect(page.locator('#login')).toBeVisible();
  const keys = await storageKeys(page);
  expect(keys.filter((k) => k.startsWith(`${PREFIX}${userA.id}:`))).toEqual([]);
  expect(keys).not.toContain('pocketbase_auth');
  expect(await page.evaluate(() => (window as unknown as { __authRemovals: { auth: number } }).__authRemovals.auth)).toBe(1);
  // 确认框不存在或没有打开（确认框在 09-14）
  await expect(page.locator('dialog#confirm[open]')).toHaveCount(0);
  // 没有订阅时退订不发请求：实测被拒连接的 console.error 为 0 条，护栏在 teardown 时同样要求没有页面错误和多余的 console.error
  expect(guard.state.consoleErrors).toEqual([]);
  expect(guard.state.pageErrors).toEqual([]);
});

test('ACCT-02 the toolbar shows the signed-in email on wide screens and hides it on narrow screens', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const userA = app.fake.users[0];

  const logout = page.locator('#logoutBtn');
  const who = page.locator('.who');
  await expect(logout).toBeVisible();
  await expect(logout).toHaveText(BTN_LOGOUT);
  await expect(who).toBeVisible();
  await expect(who).toHaveText(userA.email);
  await expect(who).toHaveAttribute('title', userA.email);
  expect(await who.evaluate((el) => getComputedStyle(el).maxWidth)).toBe('160px');

  await page.setViewportSize({ width: 375, height: 800 });
  await expect(who).toBeHidden();
  await expect(logout).toBeVisible();
});

test('ACCT-02 logging out in one tab signs the other tab out with a notice and it writes nothing for the old account', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const userA = app.fake.users[0];

  // 同一个 context 的第二个标签页：共用 localStorage 和令牌，以已有会话打开
  const page2 = await page.context().newPage();
  try {
    await page2.clock.setFixedTime(FROZEN_NOW);
    const app2 = new AppHarness(page2, { fake: app.fake });
    await app2.open({ mode: 'cloud', login: 'session' });
    await expect(page2.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
    // 第二个标签页留下一条等着上传的修改（防抖计时器还在跑），退出之后它不能再为旧账号写任何缓存
    const entry = composer(page2, 'w');
    await entry.type('SYNTH-0913 pending in the other tab');
    await entry.submit();

    await page.locator('#logoutBtn').click();
    await expect(page.locator('#login')).toBeVisible();

    await expect(page2.locator('#login')).toBeVisible();
    await expect(page2.locator('.wrap')).toBeHidden();
    const notice = page2.locator('#loginNotice');
    await expect(notice).toBeVisible();
    await expect(notice).toHaveAttribute('data-tone', 'info');
    await expect(notice).toHaveText(NOTICE_OTHER_TAB);

    // 防抖计时器（600 ms）到期之后、再多等一会儿，都没有以 A 的 id 开头的键
    for (let i = 0; i < 8; i += 1) {
      expect((await storageKeys(page2)).filter((k) => k.startsWith(`${PREFIX}${userA.id}:`))).toEqual([]);
      await page2.waitForTimeout(150);
    }
    expect(await storageKeys(page2)).not.toContain('pocketbase_auth');
  } finally {
    await page2.close();
  }
});

// ---- 09-14：退出确认框（D-05）、保存进行中退出、未下载留底、换账号登录确认 ----

const RECORD = /\/api\/collections\/journey_docs\/records\/[^/]+$/;

test.describe('logout confirmation with the clock under test control', () => {
  test.use({ clockMode: 'manual' });

  test('ACCT-02 logout with an unsent edit asks first and the stay button keeps the session', async ({ app, page }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const userA = app.fake.users[0];

    // 记一条，不推进防抖：修改还在防抖里，没有上传
    const entry = composer(page, 'w');
    await entry.type('SYNTH-0914 unsent');
    await entry.submit();

    const dialog = page.locator('dialog#confirm');
    const body = page.locator('#cf-body');
    await page.locator('#logoutBtn').click();
    await expect(dialog).toBeVisible();
    await expect(page.locator('#cf-title')).toHaveText(CONFIRM_LOGOUT_TITLE);
    await expect(body).toContainText(`${CONFIRM_LOGOUT_ACCOUNT_PREFIX}${userA.email}`);
    await expect(body).toContainText(CONFIRM_LOGOUT_UNSAVED);
    await expect(body).not.toContainText(CONFIRM_LOGOUT_SNAPSHOT);
    await expect(page.locator('#cfCancel')).toHaveText(BTN_STAY);
    await expect(page.locator('#cfOk')).toHaveText(BTN_LOGOUT_ANYWAY);
    await expect(page.locator('#cfCancel')).toBeFocused();

    // 不退出：对话框关闭，仍在应用里，令牌还在
    await page.locator('#cfCancel').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.wrap')).toBeVisible();
    await expect(page.locator('#login')).toBeHidden();
    expect(await stored(page, 'pocketbase_auth')).not.toBeNull();

    // Esc 等同不退出，焦点回到退出按钮
    await page.locator('#logoutBtn').click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('.wrap')).toBeVisible();
    await expect(page.locator('#logoutBtn')).toBeFocused();
    expect(await stored(page, 'pocketbase_auth')).not.toBeNull();

    // 仍然退出：回到登录页，没上传的记录不在服务器上
    await page.locator('#logoutBtn').click();
    await expect(dialog).toBeVisible();
    await page.locator('#cfOk').click();
    await expect(page.locator('#login')).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(await stored(page, 'pocketbase_auth')).toBeNull();
    expect(JSON.stringify(app.fake.lastState(0))).not.toContain('SYNTH-0914 unsent');
  });

  test('ACCT-02 signing in as another account after an expiry asks before clearing the unsent data of the previous account', async ({
    app,
    page,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', users: 2, seed: syntheticState('a'), login: 0 });
    app.fake.seed(syntheticState('b'), { userIndex: 1 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const [userA, userB] = app.fake.users;

    // A 带着一条没上传的修改走到令牌失效：保存和读单条记录都被拒，记一条，推过防抖
    app.fake.fault({ method: 'PATCH', path: RECORD, mode: 'refuse' });
    app.fake.fault({ method: 'GET', path: RECORD, mode: 'refuse' });
    const entry = composer(page, 'w');
    await entry.type('SYNTH-0914 kept for A');
    await entry.submit();
    await page.clock.runFor(1_000);
    await expect(page.locator('#status')).toHaveText(STATUS_SAVE_FAILED_CLOUD);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
    await app.fake.clearFaults();
    app.fake.revokeTokens(0);

    await page.reload();
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('#loginNotice')).toBeVisible();
    await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });

    const dialog = page.locator('dialog#confirm');
    const stateKey = `${PREFIX}${userA.id}:state`;

    // 用 B 的账号登录：凭据通过之后、清除之前先问
    await app.submitLogin(1);
    await expect(dialog).toBeVisible();
    await expect(page.locator('#cf-title')).toHaveText(CONFIRM_SWITCH_TITLE);
    await expect(page.locator('#cf-body')).toHaveText(switchBody(userA.email, ['没上传的修改']));
    await expect(page.locator('#cfCancel')).toHaveText(BTN_NO_SWITCH);
    await expect(page.locator('#cfOk')).toHaveText(BTN_SWITCH_ANYWAY);
    await expect(page.locator('#cfCancel')).toBeFocused();
    await expect(page.locator('#loginBtn')).toHaveText('登录中…');

    // 不换账号：丢弃刚拿到的令牌，留在登录页，保留邮箱，清空密码，A 的缓存还在
    await page.locator('#cfCancel').click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#login')).toBeVisible();
    expect(await stored(page, 'pocketbase_auth')).toBeNull();
    await expect(page.locator('#loginEmail')).toHaveValue(userB.email);
    await expect(page.locator('#loginPw')).toHaveValue('');
    await expect(page.locator('#loginBtn')).toHaveText('登录');
    expect(await stored(page, stateKey)).not.toBeNull();

    // 再登录一次，选仍然登录：A 的本机数据全部清除，B 进入
    await app.submitLogin(1);
    await expect(dialog).toBeVisible();
    await page.locator('#cfOk').click();
    await app.ready();
    expect(await page.content()).toContain('合成记录 b');
    const keys = await storageKeys(page);
    expect(keys.filter((k) => k.startsWith(`${PREFIX}${userA.id}:`))).toEqual([]);
    expect(await stored(page, `${PREFIX}lastUser`)).toBe(userB.id);
    expect(JSON.stringify(app.fake.lastState(0))).not.toContain('SYNTH-0914 kept for A');
  });
});

test('ACCT-02 logout during a save leaves no cache behind when the save answers later', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const userA = app.fake.users[0];

  // 保存请求挂起：记一条，等保存请求到达服务器（保存进行中）
  const hold = app.fake.fault({ method: 'PATCH', path: RECORD, mode: 'hold' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-0914 in flight');
  await entry.submit();
  await expect.poll(() => hold.hits, { message: '等待保存请求到达假服务器（被挂起）' }).toBe(1);

  await page.locator('#logoutBtn').click();
  await expect(page.locator('dialog#confirm')).toBeVisible();
  await expect(page.locator('#cf-body')).toContainText(CONFIRM_LOGOUT_UNSAVED);
  await page.locator('#cfOk').click();
  await expect(page.locator('#login')).toBeVisible();

  // 保存稍后才返回：旧账号的缓存键和 lastUser 都不会被重新写出，页面停在登录页
  await hold.release();
  for (let i = 0; i < 8; i += 1) {
    const keys = await storageKeys(page);
    expect(keys.filter((k) => k.startsWith(`${PREFIX}${userA.id}:`))).toEqual([]);
    expect(keys).not.toContain(`${PREFIX}lastUser`);
    await page.waitForTimeout(150);
  }
  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('.wrap')).toBeHidden();
});

test('ACCT-02 logout with a kept version that was not downloaded names it in the confirmation', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  const userA = app.fake.users[0];
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });

    // 设备一先保存；设备二的基线还是旧的，随后保存：设备二留底了被覆盖的版本
    const one = composer(page, 'w');
    await one.type('SYNTH-0914 first');
    await one.submit();
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0914 first'), { message: '等待设备一的记录上传' })
      .toBe(true);
    const two = composer(second.page, 'w');
    await two.type('SYNTH-0914 second');
    await two.submit();
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0914 second'), { message: '等待设备二的保存成为服务器上的最新版本' })
      .toBe(true);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    // 设备二的保存已经收尾：缓存不再是 dirty，没有未保存的修改，只剩留底
    await expect
      .poll(
        () =>
          second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.dirty, `${PREFIX}${userA.id}:state`),
        { message: '等待设备二的缓存收尾' },
      )
      .toBe(false);

    await second.page.locator('#logoutBtn').click();
    await expect(second.page.locator('dialog#confirm')).toBeVisible();
    const body = second.page.locator('#cf-body');
    await expect(body).toContainText(CONFIRM_LOGOUT_SNAPSHOT);
    await expect(body).not.toContainText(CONFIRM_LOGOUT_UNSAVED);

    await second.page.locator('#cfOk').click();
    await expect(second.page.locator('#login')).toBeVisible();
    const keys = await storageKeys(second.page);
    expect(keys.filter((k) => k.startsWith(`${PREFIX}${userA.id}:`))).toEqual([]);
    expect(keys).not.toContain('pocketbase_auth');
  } finally {
    await second.context.close();
  }
});
