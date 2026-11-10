// Phase 10 的离线与重试用例（SYNC-03、SYNC-04、SYNC-06）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 服务器连不上、5xx、挂起一律用假服务器的开关（refuse、status、hold）制造；
// context.setOffline 只用来改变 navigator.onLine 并派发 online 事件（PROBE-9a），从不用来让服务器连不上。
// 全部用例在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt(FROZEN_NOW + 60_000)，只在需要时 runFor。
import { test, expect, type Page } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { AppHarness } from '../support/app';
import { openDevice } from '../support/devices';
import { gotoGoals } from '../support/goals';
import { expectToast } from '../support/toast';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW, WEEK_START_FROZEN } from '../support/constants';
import { makeOneEditOfEachKind } from '../support/edits';
import { installOnlineSwitch, setPageOnline } from '../support/online';
import {
  BTN_DOWNLOAD_SNAPSHOT,
  BTN_RETRY_NOW,
  STATUS_CLOUD_SYNCED,
  STATUS_SAVING,
  TOAST_CONFLICT,
  TOAST_REMOTE_UPDATED,
  statusOffline,
  statusRetrying,
} from '../support/strings';

test.use({ clockMode: 'manual' });

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = /\/api\/collections\/journey_docs\/records\/[^/]+$/;

test('SYNC-03 an entry made while the server is unreachable is kept on this device, counted in the offline status and uploaded when the connection returns', async ({
  app,
  page,
  context,
  browser,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 服务器侧故障：列表读取和单条更新都被拒；setOffline 只改变 navigator.onLine、派发 online/offline 事件
  app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  await context.setOffline(true);

  const entry = composer(page, 'w');
  await entry.type('SYNTH-1001 offline entry');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));
  await expect(page.locator('#syncbar')).not.toBeVisible();
  // 被拒连接：Chromium 为这条 fetch 写一条带网络错误码的 console.error（后台只试了一次）
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });

  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const readCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
  const cached = await readCache();
  expect(cached.dirty).toBe(true);
  const local = (cached.data.logs as Array<{ id: string; text: string }>).find((l) => l.text === 'SYNTH-1001 offline entry');
  expect(local).toBeTruthy();
  expect(cached.touched).toEqual([`log:${local!.id}`]);
  // 服务器 state 里还没有这条记录
  expect((app.fake.lastState(0).logs as Array<{ text: string }>).some((l) => l.text === 'SYNTH-1001 offline entry')).toBe(false);

  // 联网：撤掉故障，再派发 online 事件，应用立即上传
  await app.fake.clearFaults();
  const from = app.fake.requests.length;
  await context.setOffline(false);

  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect((app.fake.lastState(0).logs as Array<{ id: string }>).some((l) => l.id === local!.id)).toBe(true);
  await expect.poll(async () => (await readCache()).dirty, { message: '等待缓存收尾' }).toBe(false);
  expect((await readCache()).touched).toEqual([]);
  const patches = app.fake.requests.slice(from).filter((r) => r.method === 'PATCH' && r.path.startsWith(LIST_PATH));
  expect(patches.map((r) => r.status)).toEqual([200]);

  // 第二台设备登录同一个账号，在本周视图里看得到这条记录
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await expect(second.page.locator(`#days [data-edit="${local!.id}"]`)).toBeVisible();
  } finally {
    await second.context.close();
  }
});

// 一条记录的文字在 state 文档里出现的次数
const countOnServer = (app: { fake: { lastState(i: number): any } }, text: string) =>
  ((app.fake.lastState(0).logs ?? []) as Array<{ text: string }>).filter((l) => l.text === text).length;

test('SYNC-06 a server error is retried automatically at growing intervals and the retry-now button tries at once', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const fault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'status', status: 503 });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1002 retried');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  // 状态行 = 一个文字节点 + 一个行内按钮；句子只取文字节点，按钮文字单独断言
  const sentence = () => status.evaluate((el) => el.firstChild?.textContent ?? '');
  await expect(status).toHaveAttribute('data-state', 'retrying');
  await expect(status.locator('button')).toHaveText(BTN_RETRY_NOW);
  await expect(page.locator('#syncbar')).not.toBeVisible();

  // 等待依次为 1、2、5、10 秒：每一段先走到只剩 1 秒（请求数不变，倒计时按秒减少），再走完最后 1 秒（请求数恰好加一）
  const waits = [1, 2, 5, 10, 30];
  for (let i = 0; i < 4; i++) {
    const w = waits[i];
    await expect.poll(sentence, { message: `第 ${i + 1} 次失败后的倒计时从 ${w} 秒开始` }).toBe(statusRetrying(w));
    expect(fault.hits).toBe(i + 1);
    if (w > 1) {
      await page.clock.runFor(1_000);
      await expect.poll(sentence).toBe(statusRetrying(w - 1));
      await page.clock.runFor((w - 2) * 1_000);
      await expect.poll(sentence).toBe(statusRetrying(1));
      expect(fault.hits).toBe(i + 1);
    }
    await page.clock.runFor(1_000);
    await expect.poll(() => fault.hits, { message: `第 ${i + 2} 次尝试在等待结束时发出` }).toBe(i + 2);
  }
  await expect.poll(sentence).toBe(statusRetrying(30));

  // 立即重试：不等倒计时，请求立刻多一次
  await status.locator('button').click();
  await expect.poll(() => fault.hits, { message: '点立即重试后立即多一次请求' }).toBe(6);
  // 这次又失败了：等待顺序继续往下走到 60 秒（封顶值）
  await expect.poll(sentence).toBe(statusRetrying(60));

  // 去掉故障后再点一次：上传成功，已同步，服务器上这条记录恰好一条
  fault.remove();
  await status.locator('button').click();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(countOnServer(app, 'SYNTH-1002 retried')).toBe(1);
  await acknowledgeConsoleErrors(guard, { 'status of 503 ': fault.hits });
});

// 10 号阶段评审 WR-02：倒计时每秒刷新状态行，但“立即重试”按钮必须是同一个节点（键盘焦点和按住中的点击不能被重建打断）
test('SYNC-06 the retry countdown ticks without rebuilding the retry-now button', async ({ app, page, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const fault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'status', status: 503 });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1002 button kept');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  const sentence = () => status.evaluate((el) => el.firstChild?.textContent ?? '');
  await expect(status).toHaveAttribute('data-state', 'retrying');
  // 第一次失败后等 1 秒；走完后第二次失败，等待变成 2 秒
  await page.clock.runFor(1_000);
  await expect.poll(() => fault.hits).toBe(2);
  await expect.poll(sentence).toBe(statusRetrying(2));

  // 给这个按钮做个记号，焦点放上去，再让倒计时走一秒
  const button = status.locator('button');
  await button.evaluate((b) => {
    (window as unknown as { __retryBtn?: Element }).__retryBtn = b;
    (b as HTMLButtonElement).focus();
  });
  await page.clock.runFor(1_000);
  await expect.poll(sentence).toBe(statusRetrying(1));
  const same = await page.evaluate(() => {
    const b = document.querySelector('#status button');
    return b !== null && b === (window as unknown as { __retryBtn?: Element }).__retryBtn && document.activeElement === b;
  });
  expect(same).toBe(true);

  // 按钮仍然管用：去掉故障后点一下，已同步
  fault.remove();
  await button.click();
  await expect(status).toHaveAttribute('data-state', 'synced');
  expect(countOnServer(app, 'SYNTH-1002 button kept')).toBe(1);
  await acknowledgeConsoleErrors(guard, { 'status of 503 ': fault.hits });
});

test('SYNC-06 a save that gets no answer is abandoned after about 15 seconds and retried instead of hanging', async ({
  app,
  page,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const hold = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'hold' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1003 held');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect.poll(() => hold.hits, { message: '等待保存请求被挂起' }).toBe(1);
  await expect(status).toHaveAttribute('data-state', 'saving');

  // 约 15 秒没有答复：应用中止这个请求，状态行变成失败重试，而不是一直停在保存中
  await page.clock.runFor(15_000);
  await expect(status).toHaveAttribute('data-state', 'retrying');

  // 放行被挂起的请求，再走过一次重试等待：已同步，服务器上这条记录恰好一条，没有留底
  await hold.release();
  await page.clock.runFor(1_000);
  await expect(status).toHaveAttribute('data-state', 'synced');
  expect(countOnServer(app, 'SYNTH-1003 held')).toBe(1);
  const snapshot = await page.evaluate((k) => localStorage.getItem(k), `usj:v2:${app.fake.users[0].id}:snapshot`);
  expect(snapshot).toBeNull();
  // 被中止的请求在服务器侧放行时答复可能写不回去，至多一条，且路径是单条记录
  expect(app.fake.fulfillErrors.length).toBeLessThanOrEqual(1);
  for (const e of app.fake.fulfillErrors) expect(ITEM_PATH.test(e.path)).toBe(true);
});

test('SYNC-04 a save shows saving and then synced', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const hold = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'hold' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1004 saving');
  await entry.submit();
  await page.clock.runFor(1_000);

  const status = page.locator('#status');
  await expect.poll(() => hold.hits, { message: '等待保存请求被挂起' }).toBe(1);
  await expect(status).toHaveAttribute('data-state', 'saving');
  await expect(status).toHaveText(STATUS_SAVING);

  await hold.release();
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
});

test('SYNC-03 opening the app with a cache while the browser reports offline allows editing at once', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 刷新时浏览器显示断网、服务器也连不上：不推进时钟，应用就按离线可编辑打开（D-02），而不是等对账超时
  await page.addInitScript(installOnlineSwitch, { online: false });
  const refused = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  await page.reload();

  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(0));
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  await expect(page.locator('#w-text')).toBeEnabled();
  await expect(page.locator('#syncbar')).not.toBeVisible();
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toBeVisible();

  // 照常记一笔：先存本机，状态行带数量
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1003 offline at open');
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));

  // 联网：撤掉故障，页面报告联网并派发 online，后台对账上传，已同步
  await app.fake.clearFaults();
  await setPageOnline(page, true);
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(countOnServer(app, 'SYNTH-1003 offline at open')).toBe(1);
  // 被拒连接：按列表故障实际命中的次数确认（后台每次尝试一条 console.error）
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: refused.hits });
});

// 按所有者的 D-08 验证 ROADMAP Phase 10 SC1 的“断网期间刷新”：服务器连不上、页面文档仍可从本机静态服务器加载。
// 真正断网时刷新需要页面本身离线可用，由 Phase 13 的 Service Worker 提供，不在这里验证。
// “联网时 15 秒后转离线”的刷新路径由 reconcile-gate.spec.ts 里改写后的 15 秒用例覆盖。
test('SYNC-03 an offline edit survives a reload with its pending count and is uploaded later', async ({ app, page, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const readCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1006 kept over reload');
  await entry.submit();
  await page.clock.runFor(1_000);
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));

  // 刷新：页面仍从本机静态服务器加载，服务器仍被开关拒绝，浏览器在线状态由初始化脚本报告为断网（不用 setOffline(true)，它会让页面文档本身也加载不出来）
  await page.addInitScript(installOnlineSwitch, { online: false });
  await page.reload();

  // 不推进时钟：待上传的数量还在，可以编辑，这条记录可见
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');
  await expect(page.locator('#w-text')).toBeEnabled();
  const cached = await readCache();
  const local = (cached.data.logs as Array<{ id: string; text: string }>).find((l) => l.text === 'SYNTH-1006 kept over reload');
  expect(local).toBeTruthy();
  expect(cached.dirty).toBe(true);
  expect(cached.touched).toEqual([`log:${local!.id}`]);
  await expect(page.locator(`#days [data-edit="${local!.id}"]`)).toBeVisible();

  // 恢复联网：撤掉故障，页面报告联网并派发 online，上传后数量归零
  await app.fake.clearFaults();
  await setPageOnline(page, true);
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(countOnServer(app, 'SYNTH-1006 kept over reload')).toBe(1);
  await expect.poll(async () => (await readCache()).dirty, { message: '等待缓存收尾' }).toBe(false);
  expect((await readCache()).touched).toEqual([]);
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
});

// 目标页上是否出现某段文字：只读回布尔，失败输出里不带页面文字
const goalsHave = (page: Page, text: string) =>
  page.evaluate((t) => (document.querySelector('#goals')?.textContent ?? '').includes(t), text);

// 另一个参与者（另一个写入方）改了服务器上的计划：某个任务名后面加后缀
async function otherWriterEditsPlan(app: { fake: any }, suffix: string) {
  const data = app.fake.lastPlan(0);
  data.groups[0].tasks[0].text += suffix;
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'plan')}`, { data, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
}

test('SYNC-05 an offline edit over a newer server version is uploaded and the other version is kept here (D-03)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: syntheticPlan('o', 1), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
  try {
    await second.page.clock.install({ time: FROZEN_NOW });
    await second.app.open({ mode: 'cloud', login: 0 });
    await second.page.clock.pauseAt(FROZEN_NOW + 60_000);

    // 设备二离线（只有它的请求被拒）：记一笔，状态 offline；它的实时连接同样断开并被拒，设备一的保存和另一个参与者的写入不会推事件给它
    app.fake.refuseRealtime(true, second.page);
    await app.fake.dropRealtime(second.page);
    const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse', context: second.context });
    const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse', context: second.context });
    const two = composer(second.page, 'w');
    await two.type('SYNTH-1005 second offline');
    await two.submit();
    await second.page.clock.runFor(1_000);
    await expect(second.page.locator('#status')).toHaveAttribute('data-state', 'offline');
    await expect(second.page.locator('#status')).toHaveText(statusOffline(1));

    // 设备一随后保存并上传，另一个写入方又改了服务器上的计划
    const one = composer(page, 'w');
    await one.type('SYNTH-1005 first');
    await one.submit();
    await page.clock.runFor(1_000);
    await expect
      .poll(() => countOnServer(app, 'SYNTH-1005 first'), { message: '等待设备一的记录上传' })
      .toBe(1);
    await otherWriterEditsPlan(app, ' SYNTH-1005 remote edit');

    // 设备二联网：撤掉它的故障，派发 online
    listFault.remove();
    patchFault.remove();
    app.fake.refuseRealtime(false, second.page);
    await second.context.setOffline(true);
    await second.context.setOffline(false);

    await expect
      .poll(() => countOnServer(app, 'SYNTH-1005 second offline') === 1 && countOnServer(app, 'SYNTH-1005 first') === 0, {
        message: '等待设备二的离线修改成为服务器上的最新版本',
      })
      .toBe(true);
    // 冲突提示留在屏幕上（没有被“已更新”替换），带下载入口，留底含设备一的版本
    await expectToast(second.page, TOAST_CONFLICT);
    await expect(second.page.locator('#toast button')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    const snap = await second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `usj:v2:${app.fake.users[0].id}:snapshot`);
    expect(snap?.kind).toBe('state');
    expect((snap.data.logs as Array<{ text: string }>).some((l) => l.text === 'SYNTH-1005 first')).toBe(true);
    await expect(second.page.locator('#status')).toHaveAttribute('data-state', 'synced');
    // 计划按服务器更新
    await gotoGoals(second.page);
    await expect.poll(() => goalsHave(second.page, 'SYNTH-1005 remote edit')).toBe(true);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 a conflict notice found while opening the app is not replaced by the updated notice (IN-01)', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: syntheticPlan('o', 1), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  // 离线期间本页听不到：另一个写入方的写入（app.fake.request）不推事件，多触发一次被拒的列表请求
  app.fake.refuseRealtime(true, page);
  await app.fake.dropRealtime(page);
  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1010 local');
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'offline');
  await expect(page.locator('#status')).toHaveText(statusOffline(1));

  // 另一个写入方先改服务器上的 state（多一条记录），再改计划
  const state = app.fake.lastState(0);
  state.logs.push({ id: 'synthetic-other-1010', date: '2026-03-17', cat: '语言', text: 'SYNTH-1010 other' });
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'state')}`, { data: state, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
  await otherWriterEditsPlan(app, ' SYNTH-1010 remote edit');

  // 去掉故障后刷新：启动对账发现 state 真冲突、计划是干净的服务器更新
  await app.fake.clearFaults();
  app.fake.refuseRealtime(false, page);
  await page.reload();
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('body')).not.toHaveAttribute('data-gate');

  await expectToast(page, TOAST_CONFLICT);
  await expect(page.locator('#toast button')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
  await expect(page.locator('#snapshotBtn')).toBeVisible();
  const snap = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `usj:v2:${app.fake.users[0].id}:snapshot`);
  expect((snap.data.logs as Array<{ text: string }>).some((l) => l.text === 'SYNTH-1010 other')).toBe(true);
  expect(countOnServer(app, 'SYNTH-1010 local')).toBe(1);
  await gotoGoals(page);
  await expect.poll(() => goalsHave(page, 'SYNTH-1010 remote edit')).toBe(true);
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
});

test('SYNC-03 a background sync takes in a newer server version when nothing is waiting to be uploaded and says so', async ({ app, page, context }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const from = app.fake.requests.length;

  // 另一台设备把服务器上的 state 改成了更新的版本；这台设备没有待上传的修改，online 事件触发后台对账
  app.fake.seed(syntheticState('newer'), { userIndex: 0 });
  await context.setOffline(true);
  await context.setOffline(false);

  await expect(page.locator('#days [data-edit="synthetic-newer"]')).toHaveCount(1);
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toHaveCount(0);
  await expectToast(page, TOAST_REMOTE_UPDATED);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  const writes = app.fake.requests.slice(from).filter((r) => r.method === 'POST' || r.method === 'PATCH');
  expect(writes.filter((r) => r.path.startsWith(LIST_PATH))).toEqual([]);
});

test('SYNC-01 a background sync whose server state document is gone creates it again from the local content', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  app.fake.dropDocs(0, 'state');
  const from = app.fake.requests.length;

  const entry = composer(page, 'w');
  await entry.type('SYNTH-1007 after the document was lost');
  await entry.submit();
  await page.clock.runFor(1_000);

  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  expect(countOnServer(app, 'SYNTH-1007 after the document was lost')).toBe(1);
  expect(countOnServer(app, '合成记录 a')).toBe(1);
  const posts = app.fake.requests.slice(from).filter((r) => r.method === 'POST' && r.path === LIST_PATH);
  expect(posts.map((r) => r.status)).toEqual([200]);
});

test('SYNC-03 an edit made while an upload is in flight stays pending alone after that upload succeeds', async ({
  app,
  page,
  context,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const readCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

  // 第一笔的上传被挂起；上传途中记第二笔
  const held = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'hold', times: 1 });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1011 E');
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect.poll(() => held.hits, { message: '等待第一笔的上传被挂起' }).toBe(1);
  await entry.type('SYNTH-1011 F');
  await entry.submit();
  await page.clock.runFor(1_000);

  // 放行之前让列表读取被拒：第一笔上传成功后紧接着的同步失败，第二笔还没上传
  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  await held.release();

  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(1));
  const cached = await readCache();
  const idOf = (text: string) => (cached.data.logs as Array<{ id: string; text: string }>).find((l) => l.text === text)?.id;
  const fId = idOf('SYNTH-1011 F');
  expect(fId).toBeTruthy();
  expect(cached.touched).toEqual([`log:${fId}`]);
  expect(cached.dirty).toBe(true);
  expect(countOnServer(app, 'SYNTH-1011 E')).toBe(1);
  expect(countOnServer(app, 'SYNTH-1011 F')).toBe(0);

  // 联网：撤掉故障，派发 online，第二笔上传，两笔各恰好一条
  await app.fake.clearFaults();
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  expect(countOnServer(app, 'SYNTH-1011 E')).toBe(1);
  expect(countOnServer(app, 'SYNTH-1011 F')).toBe(1);
  await expect.poll(async () => (await readCache()).dirty, { message: '等待缓存收尾' }).toBe(false);
  expect((await readCache()).touched).toEqual([]);
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits });
});

test('SYNC-03 the pending count counts each changed item once', async ({ app, page, context, guard }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: syntheticPlan('t', 1), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const key = `usj:v2:${app.fake.users[0].id}:state`;
  const readCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
  const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
  const made = await makeOneEditOfEachKind(page, 'SYNTH-1012');
  await page.clock.runFor(1_000);

  // 八个条目（记录 A 改了文字、记录 B 删了又撤销、任务勾选后取消，都只算 1 项），七类前缀都出现
  const status = page.locator('#status');
  await expect(status).toHaveAttribute('data-state', 'offline');
  await expect(status).toHaveText(statusOffline(8));
  const cached = await readCache();
  const touched = cached.touched as string[];
  expect(touched).toHaveLength(8);
  expect(new Set(touched).size).toBe(8);
  const kinds = new Set(touched.map((k) => k.split(':')[0]));
  expect([...kinds].sort()).toEqual(['arrival', 'custom', 'lift', 'log', 'preset', 'review', 'task']);
  expect(touched).toContain(`log:${made.aId}`);
  expect(touched).toContain(`log:${made.bId}`);
  expect(touched).toContain(`task:${made.taskId}`);
  expect(touched).toContain(`lift:${made.liftId}`);
  expect(touched).toContain(`review:${WEEK_START_FROZEN}`);
  expect(touched).toContain(`preset:${made.presetCat}|${made.presetText}`);
  expect(touched).toContain('arrival');
  expect(cached.dirty).toBe(true);

  // 联网：撤掉故障，派发 online，全部上传，数量归零
  await app.fake.clearFaults();
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(status).toHaveAttribute('data-state', 'synced');
  await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
  await expect.poll(async () => (await readCache()).dirty, { message: '等待缓存收尾' }).toBe(false);
  expect((await readCache()).touched).toEqual([]);

  const server = app.fake.lastState(0) as {
    logs: Array<{ id: string; text: string }>;
    reviews: Record<string, string>;
    tasks: Record<string, { done?: boolean }>;
    lifts: Record<string, { cur: number }>;
    custom: Array<{ id: string; group: string; text: string }>;
    presets: Record<string, { add?: string[] }>;
    arrival: string;
  };
  const count = (text: string) => server.logs.filter((l) => l.text === text).length;
  expect(count(made.aText)).toBe(1);
  expect(count(made.bText)).toBe(1);
  expect(count(`SYNTH-1012 A`)).toBe(0);
  expect(server.reviews[WEEK_START_FROZEN]).toBe(made.reviewText);
  expect(server.tasks[made.taskId]?.done ?? false).toBe(false);
  expect(server.lifts[made.liftId].cur).toBe(made.liftValue);
  expect(server.custom.filter((c) => c.text === made.customText && c.group === made.customGroup)).toHaveLength(1);
  expect(server.presets[made.presetCat].add).toEqual([made.presetText]);
  expect(server.arrival).toBe(made.arrival);
  // 被拒条数按列表故障的命中次数确认（单条 PATCH 从未发出，因为列表先失败）
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
});

// 数每个页面里对 state 缓存键的写入次数（init script，必须自包含）：用来证明两个标签页不会互相来回写缓存
function countStateWrites() {
  const original = Storage.prototype.setItem;
  (window as any).__stateWrites = 0;
  Storage.prototype.setItem = function (k: string, v: string) {
    if (/:state$/.test(k)) (window as any).__stateWrites += 1;
    return original.call(this, k, v);
  };
}

test("SYNC-06 two tabs editing offline at the same time keep each other's edits after one tab is closed", async ({
  app,
  page,
  context,
  guard,
}) => {
  await context.addInitScript(countStateWrites);
  // 同一个 context 的两个标签页共用一个时钟（page.clock 就是 context.clock），所以只 install 一次，两页都登录之后再暂停
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  const tab1 = await context.newPage();
  try {
    await new AppHarness(tab1, { fake: app.fake }).open({ mode: 'cloud', login: 'session' });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const key = `usj:v2:${app.fake.users[0].id}:state`;
    const snapKey = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const readCache = (p: Page) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    const writes = (p: Page) => p.evaluate(() => (window as any).__stateWrites as number);
    const logOf = async (p: Page, text: string) =>
      ((await readCache(p)).data.logs as Array<{ id: string; text: string }>).find((l) => l.text === text);

    // 两个标签页都连不上服务器（这个 context 的列表读取和单条更新都被拒；不用 setOffline，它会让刷新时页面文档也加载不出来）
    const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse', context });
    const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse', context });

    // 标签页一记 X
    const entry1 = composer(tab1, 'w');
    await entry1.type('SYNTH-1013 X from tab one');
    await entry1.submit();
    await page.clock.runFor(1_000);
    await expect(tab1.locator('#status')).toHaveText(statusOffline(1));
    const x = await logOf(tab1, 'SYNTH-1013 X from tab one');
    expect(x).toBeTruthy();

    // 标签页二经 storage 事件拿到 X 并显示出来（它自己还没试过上传，状态行不是离线，所以这里不断言文案）
    await expect(page.locator(`#days [data-edit="${x!.id}"]`)).toBeVisible();

    // 随后标签页二记 Y：它写出的缓存含 X 和 Y，不是只含它自己的内存
    const entry2 = composer(page, 'w');
    await entry2.type('SYNTH-1013 Y from tab two');
    await entry2.submit();
    await page.clock.runFor(1_000);
    await expect(page.locator('#status')).toHaveText(statusOffline(2));
    const y = await logOf(page, 'SYNTH-1013 Y from tab two');
    expect(y).toBeTruthy();
    const both = await readCache(page);
    expect((both.data.logs as Array<{ id: string }>).map((l) => l.id)).toEqual(expect.arrayContaining([x!.id, y!.id]));
    expect([...both.touched].sort()).toEqual([`log:${x!.id}`, `log:${y!.id}`].sort());
    expect(both.dirty).toBe(true);
    // 标签页一也收敛到并集：看得到 Y，数量也是 2
    await expect(tab1.locator(`#days [data-edit="${y!.id}"]`)).toBeVisible();
    await expect(tab1.locator('#status')).toHaveText(statusOffline(2));

    // 两个标签页不会互相来回写缓存：稍等之后两页的写入次数都不再变化
    const settled = [await writes(tab1), await writes(page)];
    await page.waitForTimeout(600);
    expect([await writes(tab1), await writes(page)]).toEqual(settled);

    // 关掉标签页一，刷新标签页二（浏览器报告断网、服务器仍被拒、不推进时钟）：X、Y 和数量 2 都还在
    await tab1.close();
    await page.addInitScript(installOnlineSwitch, { online: false });
    await page.reload();
    const status = page.locator('#status');
    await expect(status).toHaveAttribute('data-state', 'offline');
    await expect(status).toHaveText(statusOffline(2));
    await expect(page.locator(`#days [data-edit="${x!.id}"]`)).toBeVisible();
    await expect(page.locator(`#days [data-edit="${y!.id}"]`)).toBeVisible();

    // 联网：服务器上 X、Y 各恰好一条，没有留底，没有冲突提示
    await app.fake.clearFaults();
    await setPageOnline(page, true);
    await expect(status).toHaveAttribute('data-state', 'synced');
    await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
    expect(countOnServer(app, 'SYNTH-1013 X from tab one')).toBe(1);
    expect(countOnServer(app, 'SYNTH-1013 Y from tab two')).toBe(1);
    await expect.poll(async () => (await readCache(page)).dirty, { message: '等待缓存收尾' }).toBe(false);
    expect((await readCache(page)).touched).toEqual([]);
    expect(await page.evaluate((k) => localStorage.getItem(k), snapKey)).toBeNull();
    expect(await page.evaluate(() => document.querySelector('#toast span')?.textContent ?? '')).not.toBe(TOAST_CONFLICT);
    await expect(page.locator('#snapshotBtn')).toBeHidden();
    // 被拒条数按故障的命中次数确认
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
  } finally {
    if (!tab1.isClosed()) await tab1.close();
  }
});
