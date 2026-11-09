// Phase 9 的退出登录用例（ACCT-02）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 退出的固定顺序（D-06）：先退订实时、再清该账号的记录缓存、计划缓存、冲突留底和 lastUser、最后清令牌，然后回到登录页；
// 登录页一直预填刚退出的邮箱（D-07，所有者选定的行为）。确认框和换账号确认在 09-14，不在这里。
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { APP_FILE_NAME } from '../support/constants';

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
