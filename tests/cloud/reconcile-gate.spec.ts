// Phase 9 的对账与编辑门控用例（D-01、D-04）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 门控用例都在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt(FROZEN_NOW + 60_000)，不真的等。
// 对账期间的“挂起”和连不上只用假服务器的开关（hold、refuse、status），不用 setOffline（它管不到假服务器，PROBE-9）。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { composer } from '../support/composer';
import { gotoGoals } from '../support/goals';
import { expectToast } from '../support/toast';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW } from '../support/constants';
import {
  BANNER_SLOW,
  BOOT_SUB_UNREACHABLE,
  BOOT_TITLE_LOADING,
  BOOT_TITLE_UNREACHABLE,
  BANNER_UNREACHABLE,
  BTN_RETRY,
  BTN_RETRYING,
  STATUS_RECONCILING,
  STATUS_SLOW,
  STATUS_UNREACHABLE,
  TAB_LABELS,
  TOAST_REMOTE_UPDATED,
  statusOffline,
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
  // 门控开始时本机 state 缓存的整条记录（含 dirty 和 seq）：第 6、7 步之后它必须原样不变
  const stateKey = `usj:v2:${app.fake.users[0].id}:state`;
  const readStateCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), stateKey);
  const cacheBefore = await readStateCache();

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

  // 守卫真的拦下了第 6、7 步的合成事件：必须在放行之前读本机缓存。守卫失效时 input、change 会走到 persist()，
  // 缓存被写成 dirty:true 且序号加一；放行之后对账用服务器数据整体替换 state，页面值和服务器都会恢复，那时再看就掩盖了这一点
  expect(cacheBefore?.dirty).toBe(false);
  expect(await readStateCache()).toEqual(cacheBefore);

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

test('SYNC-05 a first sign-in that cannot reach the server shows only the retry card with no account content', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  // 不登录：这台设备没有该账号的缓存，登录后只能先显示等待卡片
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const boot = page.locator('#boot');
  const title = page.locator('#bootTitle');

  const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await app.submitLogin(0);
  await expect(boot).toBeVisible();
  await expect(title).toHaveText(BOOT_TITLE_LOADING);
  await expect(page.locator('.wrap')).toBeHidden();
  await expect(page.locator('#bootBar')).toBeVisible();
  await expect(page.locator('#bootRetry')).toBeHidden();
  await expect.poll(() => hold.hits).toBe(1);

  // 3 秒：标题改成变慢的那一句
  await page.clock.runFor(3_000);
  await expect(title).toHaveText(STATUS_SLOW);

  // 15 秒：只剩“连不上服务器”和一个重试按钮，没有退出登录，也没有任何账号内容
  await page.clock.runFor(12_000);
  await expect(title).toHaveText(BOOT_TITLE_UNREACHABLE);
  await expect(page.locator('#bootSub')).toHaveText(BOOT_SUB_UNREACHABLE);
  await expect(page.locator('#bootBar')).toBeHidden();
  await expect(boot.locator('button:visible')).toHaveCount(1);
  await expect(boot.locator('button:visible')).toHaveText(BTN_RETRY);
  await expect(page.locator('.wrap')).toBeHidden();
  // 工具栏里的退出登录按钮（09-13 起一直在页面里，只是 hidden）和 dialog#confirm 的标题（09-14）都不可见：只数看得见的文字
  await expect(page.getByText('退出登录').locator('visible=true')).toHaveCount(0);
  await expect(page.getByText('合成记录')).toHaveCount(0);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'unreachable');

  // 服务器恢复（被中止的第一个请求此时才被放行，响应被丢弃），点重试后对账完成，应用外壳出现
  await app.fake.clearFaults();
  await page.locator('#bootRetry').click();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('.wrap')).toBeVisible();
  await expect(boot).toBeHidden();
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
  await expect(page.locator('#toast')).not.toHaveClass(/on/);
  for (const e of app.fake.fulfillErrors) {
    expect(e.path).toBe(LIST_PATH);
  }
  expect(app.fake.fulfillErrors.length).toBeLessThanOrEqual(1);
  test.info().annotations.push({ type: 'observed', description: 'fulfillErrors=' + app.fake.fulfillErrors.length });
});

test('SYNC-05 a server error inside the window is retried quietly and never reported as unreachable', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 记下刷新之后状态行出现过的每个 data-state，以及应用设置过的全部 setTimeout 延时
  await page.addInitScript(() => {
    const w = window as any;
    w.__seen = [] as string[];
    w.__delays = [] as number[];
    const orig = w.setTimeout.bind(w);
    w.setTimeout = (fn: any, ms?: number, ...rest: any[]) => {
      w.__delays.push(ms ?? 0);
      return orig(fn, ms, ...rest);
    };
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('status')!;
      new MutationObserver(() => {
        const v = el.getAttribute('data-state');
        if (v) w.__seen.push(v);
      }).observe(el, { attributes: true, attributeFilter: ['data-state'] });
    });
  });

  const f = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'status', status: 503, times: 1 });
  await page.reload();
  await acknowledgeConsoleErrors(guard, { 'status of 503 ': 1 });
  expect(f.hits).toBe(1);

  // 第一次失败之后：状态仍是对账中，横幅没有出现，下一次尝试已经排在 5 秒之后
  await expect.poll(() => page.evaluate(() => (window as any).__delays.filter((d: number) => d === 5000).length)).toBe(1);
  await expect(page.locator('#status')).toHaveText(STATUS_RECONCILING);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'reconciling');
  await expect(page.locator('#syncbar')).not.toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');

  // 5 秒：静默重试成功
  await page.clock.runFor(5_000);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('#syncbar')).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);

  // 整个过程没有出现过连不上。推过 5 秒时会经过 3 秒的变慢提示，所以 slow 出现是对的（状态保持对账中或网络较慢）
  const seen: string[] = await page.evaluate(() => (window as any).__seen);
  expect(seen).toContain('reconciling');
  expect(seen).not.toContain('unreachable');
  expect(app.fake.fulfillErrors).toEqual([]);
});

const hasText = (logs: Array<{ text: string }> | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

test('SYNC-05 an edit kept in the cache on top of the current server version is uploaded by the reconcile', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 保存被拒：记一条，推过防抖，状态行报离线（1 项修改），本机缓存留着这条没上传的修改（dirty）
  const f = app.fake.fault({ method: 'PATCH', path: /\/api\/collections\/journey_docs\/records\/[^/]+$/, mode: 'refuse' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-0907 kept entry');
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(page.locator('#status')).toHaveText(statusOffline(1));
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'offline');
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
  expect(f.hits).toBe(1);
  const cached = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  }, `usj:v2:${app.fake.users[0].id}:state`);
  expect(cached).not.toBeNull();
  expect(cached.dirty).toBe(true);
  expect(hasText(cached.data.logs, 'SYNTH-0907 kept entry')).toBe(true);
  expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-0907 kept entry')).toBe(false);

  // 服务器版本没有变：重新打开，对账把这条修改上传
  await app.fake.clearFaults();
  const before = app.fake.requests.length;
  await app.reload();

  await expect(page.locator('#days').getByText('SYNTH-0907 kept entry')).toBeVisible();
  expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-0907 kept entry')).toBe(true);
  const patches = app.fake.requests.slice(before).filter((r) => r.method === 'PATCH');
  expect(patches).toEqual([{ method: 'PATCH', path: `${LIST_PATH}/${app.fake.docId(0, 'state')}`, status: 200 }]);
  await expect(page.locator('#toast')).not.toHaveClass(/\bon\b/);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-01 two devices creating the first documents at the same time end with one state and one plan document', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', users: 1 });

  // 另一台设备抢先建好两份文档：第一个创建请求到达服务器之前，先把文档播进去
  app.fake.beforeNext('POST', LIST_PATH, () => app.fake.seed(syntheticState('other'), { userIndex: 0, plan: SEED_PLAN }));
  await app.login(0);

  await expect(page.locator('#days').getByText('合成记录 other')).toBeVisible();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('#syncbar')).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  const posts = app.fake.requests.filter((r) => r.method === 'POST' && r.path === LIST_PATH);
  expect(posts).toEqual([{ method: 'POST', path: LIST_PATH, status: 400 }]);
  expect(app.fake.requests.filter((r) => r.method === 'PATCH')).toEqual([]);
  await acknowledgeConsoleErrors(guard, { 'status of 400 ': 1 });
  expect(app.fake.docId(0, 'state')).toBeTruthy();
  expect(app.fake.docId(0, 'plan')).toBeTruthy();
  // 每种 kind 恰好一份，内容是先到的那一台建的
  const listed = await app.fake.request(0, 'GET', LIST_PATH);
  const kinds = (listed.body as { items: Array<{ kind: string }> }).items.map((d) => d.kind).sort();
  expect(kinds).toEqual(['plan', 'state']);
  expect(app.fake.lastState(0)).toEqual(syntheticState('other'));
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-01 a cached account whose server documents are gone recreates them from the cache', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 超级用户在后台把这个账号的文档删了；本机缓存还在
  app.fake.dropDocs(0);
  expect(app.fake.docId(0, 'state')).toBeNull();
  const before = app.fake.requests.length;
  await app.reload();

  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
  expect((app.fake.lastState(0)?.logs ?? []).map((l: { id: string }) => l.id)).toContain('synthetic-a');
  expect(app.fake.lastPlan(0)).not.toBeNull();
  expect(app.fake.docId(0, 'state')).toBeTruthy();
  expect(app.fake.docId(0, 'plan')).toBeTruthy();
  const writes = writesSince(app, before);
  expect(writes).toHaveLength(2);
  expect(writes.map((r) => [r.method, r.status])).toEqual([
    ['POST', 200],
    ['POST', 200],
  ]);
  await expect(page.locator('#toast')).not.toHaveClass(/\bon\b/);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('SYNC-01 reloading a synced session twice creates no extra documents and sends no write', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  // 种子只写 state；登录时由客户端创建 plan（唯一的一次 POST）
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  expect(writesSince(app, 0).map((r) => r.method)).toEqual(['POST']);

  await app.reload();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await app.reload();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');

  const writes = writesSince(app, 0);
  expect(writes.map((r) => r.method)).toEqual(['POST']);
  expect(app.fake.requests.filter((r) => r.method === 'PATCH')).toEqual([]);
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(1);
  expect(app.fake.fulfillErrors).toEqual([]);
});
