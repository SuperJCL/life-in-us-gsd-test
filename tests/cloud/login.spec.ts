// Phase 9 的登录与云端存取用例：只在 npm run test:cloud 里运行，只用合成账号（FakePbServer.addUser，example.com 邮箱、运行时随机口令）。
// 应用由 USJ_CONFIG 的云端开关打开（harness 在应用脚本之前放这一行），自己同源加载真实的 PocketBase SDK，
// REST 由 Node 侧的 FakePbServer 接应；断言一律在 Node 侧做。
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { gotoGoals, readGroups } from '../support/goals';
import { STATUS_CLOUD_SYNCED } from '../support/strings';

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

test('PLAN-01 a first sign-in creates the state document and a plan document holding the synthetic default plan', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', users: 1, login: 0 });

  expect(app.fake.lastPlan(0)).toEqual(SEED_PLAN);
  expect(app.fake.lastState(0)).toEqual({ arrival: '', tasks: {}, custom: [], logs: [], lifts: {}, reviews: {}, presets: {} });
  const created = app.fake.requests.filter((r) => r.method === 'POST' && r.path === '/api/collections/journey_docs/records');
  expect(created).toHaveLength(2);
  expect(created.every((r) => r.status === 200)).toBe(true);
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
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
