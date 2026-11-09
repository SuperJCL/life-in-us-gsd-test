// Phase 9 的退出登录用例（ACCT-02）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 退出的固定顺序（D-06）：先退订实时、再清该账号的记录缓存、计划缓存、冲突留底和 lastUser、最后清令牌，然后回到登录页；
// 登录页一直预填刚退出的邮箱（D-07，所有者选定的行为）。确认框和换账号确认在 09-14，不在这里。
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { AppHarness } from '../support/app';
import { APP_FILE_NAME, FROZEN_NOW } from '../support/constants';
import { BTN_LOGOUT, NOTICE_OTHER_TAB } from '../support/strings';

const PREFIX = 'usj:v2:';

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

  await page.locator('#logoutBtn').click();

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

  await page.locator('#logoutBtn').click();
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
