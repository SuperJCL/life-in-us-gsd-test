// Phase 9 的对账与编辑门控用例（D-01、D-04）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 门控用例都在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt(FROZEN_NOW + 60_000)，不真的等。
// 对账期间的“挂起”和连不上只用假服务器的开关（hold、refuse、status），不用 setOffline（它管不到假服务器，PROBE-9）。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { gotoGoals } from '../support/goals';
import { expectToast } from '../support/toast';
import { FROZEN_NOW } from '../support/constants';
import { STATUS_RECONCILING, TAB_LABELS, TOAST_REMOTE_UPDATED } from '../support/strings';

test.use({ clockMode: 'manual' });

// 合成种子计划：应用里唯一一份合成示例计划，即 normalizePlan(DEFAULT_PLAN)；JSON 往返后脱离 vm 的 realm
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));

const LIST_PATH = '/api/collections/journey_docs/records';

// 某个时间点之后新增的文档写入请求（对 journey_docs 的 POST 或 PATCH；登录续期的 auth-refresh 也是 POST，不算写入）
function writesSince(app: { fake: { requests: Array<{ method: string; path: string; status: number }> } }, from: number) {
  return app.fake.requests
    .slice(from)
    .filter((r) => (r.method === 'POST' || r.method === 'PATCH') && r.path.startsWith(LIST_PATH));
}

test('SYNC-05 a returning session renders the cached content with editing disabled until the reconcile finishes', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const before = app.fake.requests.length;

  // 刷新：文档列表挂起，应用只能先用本机缓存渲染。不用 app.reload()，它会等 synced
  const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await page.reload();

  await expect(page.locator('.wrap')).toBeVisible();
  const entry = page.locator('#days [data-edit="synthetic-a"]');
  await expect(entry).toHaveCount(1);
  await expect(entry).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');
  for (const sel of ['#w-text', '#review', '#arrival']) {
    await expect(page.locator(sel), `${sel} 对账期间应当不可用`).toBeDisabled();
  }
  await expect(page.locator('#status')).toHaveText(STATUS_RECONCILING);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'reconciling');

  // 查看类入口照常可用：切到“目标”标签成功，任务复选框全部不可用
  await gotoGoals(page);
  await expect(page.locator('#goals [data-task]').first()).toBeDisabled();
  await expect(page.locator('#goals [data-task]:not(:disabled)')).toHaveCount(0);
  const weekTab = page.getByRole('tab', { name: TAB_LABELS.wk, exact: true });
  await weekTab.click();
  await expect(weekTab).toHaveAttribute('aria-selected', 'true');

  // 点记录条目：条目带 aria-disabled，用 force 才点得到；编辑弹窗不会打开
  await entry.click({ force: true });
  await expect(page.locator('dialog#editor')).not.toBeVisible();

  await hold.release();

  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  await expect(page.locator('#w-text')).toBeEnabled();
  expect(writesSince(app, before)).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-05 a stale cache is replaced by the newer server version without being uploaded and a notice is shown', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const before = app.fake.requests.length;

  // 另一台设备把服务器上的 state 改成了更新的版本（服务器重新签发 updated）
  app.fake.seed(syntheticState('newer'), { userIndex: 0 });
  await app.reload();

  await expect(page.locator('#days [data-edit="synthetic-newer"]')).toHaveCount(1);
  await expect(page.locator('#days').getByText('合成记录 newer')).toBeVisible();
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(0);
  await expect(page.locator('#days').getByText('合成记录 a', { exact: true })).toHaveCount(0);
  await expectToast(page, TOAST_REMOTE_UPDATED);
  expect(writesSince(app, before)).toEqual([]);

  // 本机缓存已换成服务器版本，旧内容不留在缓存里
  const cached = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, `usj:v2:${app.fake.users[0].id}:state`);
  expect(cached).not.toBeNull();
  expect(cached.dirty).toBe(false);
  expect(cached.data.logs.map((l: { id: string }) => l.id)).toEqual(['synthetic-newer']);
  expect(app.fake.fulfillErrors).toEqual([]);
});
