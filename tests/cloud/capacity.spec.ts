// Phase 9 的容量保护用例（S9）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 大体积合成 state 由 bulkyState 用中文字符凑出；保存前应用按 UTF-8 字节数检查文档大小。
// 百分比和 PATCH 都在 Node 侧用假服务器的数据独立算出，页面里只读 DOM 和 localStorage。
import { test, expect } from '../support/test';
import { bulkyState, syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { PB_DOC_MAX_BYTES } from '../support/constants';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import {
  BANNER_CACHE_FULL,
  BANNER_TOO_LARGE,
  BTN_ACK,
  STATUS_SAVE_FAILED_CLOUD,
  STATUS_SAVE_FAILED_NO_CACHE,
  STATUS_TOO_LARGE,
  bannerCapacity,
} from '../support/strings';

type Log = { id: string; text: string };
const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

test('SYNC-01 a save at 70 percent of the 4 MB limit shows the capacity warning once per page session', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: bulkyState('big', Math.floor(PB_DOC_MAX_BYTES * 0.72)), login: 0 });
  const bar = page.locator('#syncbar');

  // 登录对账不保存，不显示警告；记一条后保存，服务器收到
  await expect(bar).toBeHidden();
  const entry = composer(page, 'w');
  await entry.type('SYNTH-0909 capacity one');
  await entry.submit();
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0909 capacity one'), { message: '等待这次保存到达服务器' })
    .toBe(true);

  const bytes = Buffer.byteLength(JSON.stringify(app.fake.lastState(0)));
  const pct = Math.floor((bytes * 100) / PB_DOC_MAX_BYTES);
  expect(pct).toBeGreaterThanOrEqual(70);
  expect(pct).toBeLessThan(100);
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'warn');
  await expect(bar.locator('.sb-msg')).toHaveText(bannerCapacity(pct));
  await expect(bar.locator('button')).toHaveText(BTN_ACK);

  // 点“知道了”：横幅消失；再记一条并等保存完成，本次页面打开期间不再显示
  await bar.locator('button').click();
  await expect(bar).toBeHidden();
  await entry.type('SYNTH-0909 capacity two');
  await entry.submit();
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0909 capacity two'), { message: '等待第二次保存到达服务器' })
    .toBe(true);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(bar).toBeHidden();
});

test('SYNC-01 a save over the 4 MB limit is not sent, keeps the change on this device and shows the over-limit banner', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: bulkyState('edge', PB_DOC_MAX_BYTES - 4_000), login: 0 });
  const requestsBefore = app.fake.requests.length;
  const key = `usj:v2:${app.fake.users[0].id}:state`;

  // 一条约 9 KB 的合成记录把文档推过上限
  const text = `SYNTH-0909 over ${'超'.repeat(3_000)}`;
  const entry = composer(page, 'w');
  await entry.type(text);
  await entry.submit();

  const status = page.locator('#status');
  await expect(status).toHaveText(STATUS_TOO_LARGE);
  await expect(status).toHaveAttribute('data-state', 'toolarge');
  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'error');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_TOO_LARGE);
  await expect(bar.locator('button')).toHaveCount(0);

  // 登录之后没有任何写请求，服务器上没有这条记录
  const after = app.fake.requests.slice(requestsBefore);
  expect(after.filter((r) => r.method === 'PATCH')).toEqual([]);
  expect(hasText(app.fake.lastState(0)?.logs, text)).toBe(false);

  // 修改仍在本机缓存里，标记为未上传
  const cached = await page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw === null ? null : JSON.parse(raw);
  }, key);
  expect(cached).not.toBeNull();
  expect(cached.dirty).toBe(true);
  expect(hasText(cached.data.logs, text)).toBe(true);
});

test('SYNC-01 an edit that could not be written to the local cache is reported and never described as kept on this device', async ({
  app,
  page,
  guard,
}) => {
  // 测试装置：写 state 缓存键时按开关抛 QuotaExceededError；登录对账期间开关是关的，其他键不受影响
  await page.addInitScript(() => {
    const flag = { full: false };
    (window as unknown as { __quota: { full: boolean } }).__quota = flag;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (flag.full && String(key).endsWith(':state')) throw new DOMException('quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const setFull = (full: boolean) =>
    page.evaluate((f) => {
      (window as unknown as { __quota: { full: boolean } }).__quota.full = f;
    }, full);

  // 缓存写不进去，同时这次上传也被拒：横幅和状态行都不能说“修改仍在本机”
  await setFull(true);
  app.fake.fault({ method: 'PATCH', path: /\/api\/collections\/journey_docs\/records\/[^/]+$/, mode: 'refuse', times: 1 });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-0912 no room');
  await entry.submit();

  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'warn');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_CACHE_FULL);
  await expect(bar.locator('button')).toHaveText(BTN_ACK);
  const status = page.locator('#status');
  await expect(status).toHaveText(STATUS_SAVE_FAILED_NO_CACHE);
  await expect(status).not.toHaveText(STATUS_SAVE_FAILED_CLOUD);
  await expect(status).toHaveAttribute('data-state', 'savefailed');
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
  const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  expect(JSON.stringify(cached)).not.toContain('SYNTH-0912 no room');

  // 空间恢复之后下一次修改上传成功：两条都到服务器，缓存是干净的，横幅收起
  await setFull(false);
  await entry.type('SYNTH-0912 room again');
  await entry.submit();
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 room again'), { message: '等待下一次保存到达服务器' })
    .toBe(true);
  expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 no room')).toBe(true);
  await expect(bar).toBeHidden();
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.dirty, key), { message: '等待缓存收尾' })
    .toBe(false);
});
