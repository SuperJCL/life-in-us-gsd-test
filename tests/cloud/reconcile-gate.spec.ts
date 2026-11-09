// Phase 9 的对账与编辑门控用例（D-01、D-04）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 门控用例都在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt(FROZEN_NOW + 60_000)，不真的等。
// 对账期间的“挂起”和连不上只用假服务器的开关（hold、refuse、status），不用 setOffline（它管不到假服务器，PROBE-9）。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { gotoGoals } from '../support/goals';
import { expectToast } from '../support/toast';
import { FROZEN_NOW } from '../support/constants';
import {
  BANNER_SLOW,
  BANNER_UNREACHABLE,
  BTN_RETRY,
  BTN_RETRYING,
  STATUS_RECONCILING,
  STATUS_SLOW,
  STATUS_UNREACHABLE,
  TAB_LABELS,
  TOAST_REMOTE_UPDATED,
} from '../support/strings';

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

test('SYNC-05 an unchanged server version is used as is with no notice and no upload', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const before = app.fake.requests.length;

  // 服务器版本与本机上次同步的版本相同（updated 相同）：plan 和 state 都不重写、不上传、不提示
  await app.reload();

  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
  await expect(page.locator('#toast')).not.toHaveClass(/\bon\b/);
  expect(writesSince(app, before)).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-05 clicks, keys and drags on editing controls during the reconcile change nothing and send no write', async ({
  app,
  page,
}) => {
  const WEEK = '2026-03-16';
  const seed = syntheticState('a', {
    arrival: '2026-03-01',
    custom: [{ id: 'c-synth-one', group: 'P1', text: '合成待办 one' }],
    reviews: { [WEEK]: '合成复盘 one' },
  });
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed, plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const before = app.fake.requests.length;

  const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');
  const entry = page.locator('#days [data-edit="synthetic-a"]');
  await expect(entry).toHaveCount(1);
  const editorOpen = page.locator('dialog#editor');
  const pressedBefore = await page.locator('#wkComp [data-ccat^="w|"][aria-pressed="true"]').getAttribute('data-ccat');

  // 1 点类别按钮（已 disabled，force 也点不动）
  await page.locator('#wkComp [data-ccat="w|专业"]').click({ force: true });
  await expect(page.locator('#wkComp [data-ccat^="w|"][aria-pressed="true"]')).toHaveAttribute('data-ccat', pressedBefore!);
  await expect(editorOpen).not.toBeVisible();

  // 2 点记录条目（带 aria-disabled，不是 disabled 控件，靠捕获守卫拦下）
  await entry.click({ force: true });
  await expect(editorOpen).not.toBeVisible();

  // 3 聚焦条目后按 Enter
  await entry.focus();
  await entry.press('Enter');
  await entry.press(' ');
  await expect(editorOpen).not.toBeVisible();

  // 4 对条目派发 dragstart：不能进入拖拽状态
  await entry.dispatchEvent('dragstart');
  await expect(page.locator('.dragging')).toHaveCount(0);
  await expect(editorOpen).not.toBeVisible();

  // 5 在页面内调用复选框自己的 click()：disabled 的复选框不会切换
  const toggled = await page.evaluate(() => {
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('#goals [data-task]'));
    boxes.forEach((b) => b.click());
    return boxes.filter((b) => b.checked).length;
  });
  expect(toggled).toBe(0);
  await expect(editorOpen).not.toBeVisible();

  // 6 给复盘框赋值并派发 input；7 给抵达日期赋值并派发 change
  await page.evaluate(() => {
    const review = document.querySelector<HTMLTextAreaElement>('#review')!;
    review.value = '合成篡改复盘';
    review.dispatchEvent(new Event('input', { bubbles: true }));
    const arrival = document.querySelector<HTMLInputElement>('#arrival')!;
    arrival.value = '2026-03-09';
    arrival.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(editorOpen).not.toBeVisible();
  // 推过复盘的防抖窗口：如果守卫失效，防抖里的保存已经改了 state
  await page.clock.runFor(2000);

  await hold.release();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');

  // 没有任何写入，服务器 state 仍是种子
  expect(writesSince(app, before)).toEqual([]);
  expect(app.fake.requests.slice(before).filter((r) => r.method === 'PATCH')).toEqual([]);
  expect(app.fake.lastState(0)).toEqual(seed);
  // 页面上的内容都与服务器一致：记录、待办状态、复盘框、抵达日期
  await expect(entry).toHaveCount(1);
  await expect(page.locator('#review')).toHaveValue('合成复盘 one');
  await expect(page.locator('#arrival')).toHaveValue('2026-03-01');
  await expect(page.locator('#goals [data-task="c-synth-one"]')).not.toBeChecked();
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-05 a reconcile still running after about 3 seconds shows the slow notice and keeps editing disabled', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await page.reload();
  const status = page.locator('#status');
  const bar = page.locator('#syncbar');

  // 对账开始：状态行已写，0 到 3 秒不显示横幅（计时器和状态行在同一步里设置，所以等到状态行之后再推时钟）
  await expect(status).toHaveText(STATUS_RECONCILING);
  await expect(bar).not.toBeVisible();

  // 2.9 秒：还没到 3 秒，不能提示变慢，更不能判失败
  await page.clock.runFor(2_900);
  await expect(status).toHaveText(STATUS_RECONCILING);
  await expect(status).toHaveAttribute('data-state', 'reconciling');
  await expect(bar).not.toBeVisible();

  // 3.1 秒：状态行和横幅同时变慢；横幅是 warn 语气、没有按钮，编辑仍然关着
  await page.clock.runFor(200);
  await expect(status).toHaveText(STATUS_SLOW);
  await expect(status).toHaveAttribute('data-state', 'slow');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'warn');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_SLOW);
  await expect(bar.locator('button')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');
  await expect(page.locator('#w-text')).toBeDisabled();

  // 服务器终于回应：对账完成，横幅消失
  await hold.release();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(bar).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-05 a reconcile not finished after about 15 seconds turns read-only with a retry that restores editing once it succeeds', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const before = app.fake.requests.length;
  const status = page.locator('#status');
  const bar = page.locator('#syncbar');
  const entry = page.locator('#days [data-edit="synthetic-a"]');

  const f = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await page.reload();
  await expect(status).toHaveText(STATUS_RECONCILING);
  // 列表请求已经到了（被挂起），截止时被中止的就是它
  await expect.poll(() => f.hits).toBe(1);

  // 15 秒：判连不上，转为只读，横幅带重试，缓存的内容仍然看得到
  await page.clock.runFor(15_000);
  await expect(status).toHaveText(STATUS_UNREACHABLE);
  await expect(status).toHaveAttribute('data-state', 'unreachable');
  await expect(page.locator('body')).toHaveAttribute('data-gate', 'readonly');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'error');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_UNREACHABLE);
  await expect(bar.locator('button')).toHaveCount(1);
  await expect(bar.locator('button')).toHaveText(BTN_RETRY);
  await expect(bar.locator('button')).toBeEnabled();
  await expect(entry).toBeVisible();
  await expect(page.locator('#w-text')).toBeDisabled();

  // 点重试：按钮立即 disabled 并显示“正在重试…”，重新发起一次对账（第二个列表请求被新的挂起规则拦住）
  f.remove();
  const f2 = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await bar.getByRole('button', { name: BTN_RETRY, exact: true }).click();
  const busy = bar.locator('button');
  await expect(busy).toBeDisabled();
  await expect(busy).toHaveText(BTN_RETRYING);
  await expect(status).toHaveText(STATUS_RECONCILING);
  await expect.poll(() => f2.hits).toBe(1);
  // 连点：禁用的按钮不会再发起对账（force 跳过可点击检查）
  await busy.click({ force: true });
  expect(f2.hits).toBe(1);

  // 重试的请求得到回应：对账完成，放开编辑
  await f2.release();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(bar).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  await expect(page.locator('#w-text')).toBeEnabled();
  expect(f2.hits, '连点之后仍然只有一次新的对账请求').toBe(1);
  expect(app.fake.requests.slice(before).filter((r) => r.method === 'GET' && r.path === LIST_PATH)).toHaveLength(1);

  // 第一个（已被中止的）请求现在才被放行：它的响应一律丢弃，页面不变，也不多出任何写入
  await f.release();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(bar).not.toBeVisible();
  await expect(entry).toHaveCount(1);
  expect(writesSince(app, before)).toEqual([]);
  expect(app.fake.lastState(0)).toEqual(syntheticState('a'));
  // 被中止的请求能否走到 fulfill 抛错取决于时序（同 cloud-harness.spec.ts 里被 SDK 取消的请求）：至多一条，而且只能是列表
  for (const e of app.fake.fulfillErrors) {
    expect(e.path).toBe(LIST_PATH);
  }
  expect(app.fake.fulfillErrors.length).toBeLessThanOrEqual(1);
  test.info().annotations.push({ type: 'observed', description: 'fulfillErrors=' + app.fake.fulfillErrors.length });
});
