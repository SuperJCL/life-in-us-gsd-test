// Phase 13 的“有新版本，点此更新”用例（OPS-04、D-08）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 新版本发布 = Service Worker 的 sw.js 字节变了：Playwright 拦截不了 worker 的更新请求，所以版本由测试静态服务器自己变，
// 用例经 request fixture（不经过页面护栏）调 GET /__test/sw-version/<版本>，再在页面里 registration.update() 让浏览器去取一次。
// 静态服务器在整个运行里共用，所以每条用例的 finally 里都要把版本调回 test（SW_TEST_VERSION），否则后面的用例缓存名对不上。
//
// 只在本文件放开 Service Worker：test.use({ serviceWorkers: 'allow' }) 作用于默认的 context fixture；配置文件不改。
// 这里用真实时钟：Service Worker 的安装和激活不受 page.clock 控制；时间只固定 Date（frozenClock fixture），
// 新开的标签页要自己再固定一次，否则令牌按真实日期判断已过期。
// “没有刷新”用 window 上的一个标记判断：页面一刷新，标记就没了。
import type { APIRequestContext } from '@playwright/test';
import { test, expect, type Page } from '../support/test';
import type { AppHarness } from '../support/app';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { confirmCancel, readConfirm } from '../support/confirm';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { expand, field, openEditor } from '../support/plan-editor';
import { FROZEN_NOW, SW_CACHE_PREFIX, SW_TEST_VERSION, SW_VERSION_CONTROL_PATH } from '../support/constants';
import {
  BANNER_SW_UPDATE,
  BTN_SW_UPDATE,
  CF_SW_CANCEL,
  CF_SW_LINE1,
  CF_SW_LINE2,
  CF_SW_OK,
  CF_SW_TITLE,
  STATUS_CLOUD_SYNCED,
  statusOffline,
} from '../support/strings';

test.use({ serviceWorkers: 'allow' });

// 让测试静态服务器之后提供的 sw.js 带上这个版本（204 才算成功）
async function setVersion(request: APIRequestContext, version: string) {
  const response = await request.get(SW_VERSION_CONTROL_PATH + version);
  expect(response.status()).toBe(204);
}

// 等 Service Worker 就绪（激活完成）；只读回布尔
const swReady = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });

// 页面是否已被 Service Worker 控制：首次安装不接管已打开的页面，所以第一次加载之后要再导航一次才为真
const controlled = (page: Page) => page.evaluate(() => navigator.serviceWorker.controller !== null);

// Cache Storage 里现有的缓存名（排序后）
const cacheNames = (page: Page) => page.evaluate(async () => (await caches.keys()).sort());

// 在页面上放一个标记；刷新之后它就没了
const mark = (page: Page) =>
  page.evaluate(() => {
    (window as any).__usjMark = 1;
  });
const marked = (page: Page) => page.evaluate(() => (window as any).__usjMark === 1);

// 让浏览器现在就去取一次 sw.js（线上是回到前台或者重新打开时发生）
const checkForUpdate = (page: Page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg!.update();
  });

// 登录、等 worker 就绪、联网刷新一次让页面受控，此时不显示更新横幅，缓存只有 usj-shell-test
async function openControlled(app: AppHarness, page: Page, plan?: unknown) {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan, login: 0 });
  await swReady(page);
  await app.reload();
  expect(await controlled(page)).toBe(true);
  await expect(page.locator('#syncbar')).toBeHidden();
  expect(await cacheNames(page)).toEqual([SW_CACHE_PREFIX + SW_TEST_VERSION]);
}

test('OPS-04 a new version shows the update banner and its button switches to the new cache and reloads into the new version (D-08)', async ({
  app,
  page,
  request,
}) => {
  try {
    await openControlled(app, page);
    const bar = page.locator('#syncbar');
    await mark(page);

    // 新版本发布：页面显示信息类横幅，点之前不刷新、仍用旧缓存
    await setVersion(request, 'v2');
    await checkForUpdate(page);
    await expect(bar).toHaveAttribute('data-tone', 'info');
    await expect(bar.locator('.sb-msg')).toHaveText(BANNER_SW_UPDATE);
    await expect(bar.locator('button')).toHaveText(BTN_SW_UPDATE);
    await expect(bar.locator('button')).toBeEnabled();
    expect(await marked(page)).toBe(true);
    expect(await cacheNames(page)).toEqual([SW_CACHE_PREFIX + SW_TEST_VERSION, SW_CACHE_PREFIX + 'v2']);

    // 点「点此更新」：新 worker 接管，页面刷新一次，旧缓存删掉、横幅消失
    const loaded = page.waitForEvent('load');
    await bar.locator('button').click();
    await loaded;
    await expect.poll(() => marked(page), { message: '刷新之后标记应该没了' }).toBe(false);
    await expect.poll(() => cacheNames(page), { message: '等旧缓存被删掉' }).toEqual([SW_CACHE_PREFIX + 'v2']);
    await expect(bar).toBeHidden();
    await expect(page).toHaveTitle('计划手记');
  } finally {
    await setVersion(request, SW_TEST_VERSION);
  }
});

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = /\/api\/collections\/journey_docs\/records\/[^/]+$/;

const onServer = (app: { fake: { lastState(i: number): any } }, text: string) =>
  ((app.fake.lastState(0).logs ?? []) as Array<{ id: string; text: string }>).filter((l) => l.text === text).length;

// 新版本到达：服务器换版本，页面去取一次，等横幅（带「点此更新」）出现
async function deliver(request: APIRequestContext, page: Page, version: string) {
  await setVersion(request, version);
  await checkForUpdate(page);
  await expect(page.locator('#syncbar .sb-msg')).toHaveText(BANNER_SW_UPDATE);
  await expect(page.locator('#syncbar button')).toHaveText(BTN_SW_UPDATE);
}

test('OPS-04 the update asks first while a composer draft or unsaved plan changes exist, keeps them when cancelled and reloads after confirming (D-08)', async ({
  app,
  page,
  request,
}) => {
  try {
    await openControlled(app, page, syntheticPlan('pe', 2));
    const bar = page.locator('#syncbar');
    const button = bar.locator('button');

    // 第一段：「记一笔」框里有草稿
    const entry = composer(page, 'w');
    await entry.type('SYNTH-1302 draft');
    await mark(page);
    await deliver(request, page, 'v2');
    await button.click();
    const first = await readConfirm(page);
    expect(first.title).toBe(CF_SW_TITLE);
    expect(first.lines).toEqual([CF_SW_LINE1, CF_SW_LINE2]);
    expect(first.buttons.map((b) => b.text)).toEqual([CF_SW_CANCEL, CF_SW_OK]);
    // 先不更新：草稿还在、横幅还在、按钮又能点、没有刷新
    await confirmCancel(page);
    await expect(entry.text).toHaveValue('SYNTH-1302 draft');
    await expect(bar.locator('.sb-msg')).toHaveText(BANNER_SW_UPDATE);
    await expect(button).toHaveText(BTN_SW_UPDATE);
    await expect(button).toBeEnabled();
    expect(await marked(page)).toBe(true);
    expect(await cacheNames(page)).toEqual([SW_CACHE_PREFIX + SW_TEST_VERSION, SW_CACHE_PREFIX + 'v2']);
    // 再点、选仍然更新：刷新一次，新缓存生效
    await button.click();
    await readConfirm(page);
    const reloaded = page.waitForEvent('load');
    await page.locator('#cfOk').click();
    await reloaded;
    await expect.poll(() => marked(page), { message: '刷新之后标记应该没了' }).toBe(false);
    await expect.poll(() => cacheNames(page), { message: '等旧缓存被删掉' }).toEqual([SW_CACHE_PREFIX + 'v2']);
    await expect(bar).toBeHidden();

    // 第二段：编辑计划页里有改动没保存；浏览器自带的离开提示不能弹第二次（Playwright 默认会自动 dismiss，那样刷新就被取消）
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.type());
      void d.dismiss();
    });
    await openEditor(page);
    await expand(page, 'g:g-pe1');
    await field(page, 'g:g-pe1:name').fill('SYNTH-pe update draft');
    await mark(page);
    await deliver(request, page, 'v3');
    await button.click();
    const second = await readConfirm(page);
    expect(second.title).toBe(CF_SW_TITLE);
    expect(second.lines).toEqual([CF_SW_LINE1, CF_SW_LINE2]);
    expect(second.buttons.map((b) => b.text)).toEqual([CF_SW_CANCEL, CF_SW_OK]);
    const secondLoad = page.waitForEvent('load');
    await page.locator('#cfOk').click();
    await secondLoad;
    await expect.poll(() => marked(page), { message: '刷新之后标记应该没了' }).toBe(false);
    await expect.poll(() => cacheNames(page), { message: '等旧缓存被删掉' }).toEqual([SW_CACHE_PREFIX + 'v3']);
    expect(dialogs).toEqual([]);
  } finally {
    await setVersion(request, SW_TEST_VERSION);
  }
});

test('OPS-04 with two tabs open both show the update banner, only the tab that clicks reloads, and a change waiting for upload is uploaded after the reload (D-08)', async ({
  app,
  page,
  context,
  request,
  guard,
}) => {
  try {
    await openControlled(app, page);
    // 第二个标签页：同一个 context，同样受 allow 和护栏约束；固定 Date，自己也要受控
    const tab = await context.newPage();
    await tab.clock.setFixedTime(FROZEN_NOW);
    await tab.goto('/');
    await swReady(tab);
    expect(await controlled(tab)).toBe(true);
    await expect(tab.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);

    // 让服务器连不上（读列表和上传都被拒，刷新后的对账才会立刻转离线）：A 记一笔，先存本机，待上传
    const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
    const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
    const entry = composer(page, 'w');
    await entry.type('SYNTH-1303 pending');
    await entry.submit();
    const status = page.locator('#status');
    await expect(status).toHaveAttribute('data-state', 'offline');
    await expect(status).toHaveText(statusOffline(1));
    expect(onServer(app, 'SYNTH-1303 pending')).toBe(0);

    // 新版本到达：两个标签页都显示横幅，都还没刷新
    await mark(page);
    await mark(tab);
    await setVersion(request, 'v2');
    await checkForUpdate(page);
    for (const p of [page, tab]) {
      await expect(p.locator('#syncbar .sb-msg')).toHaveText(BANNER_SW_UPDATE);
      await expect(p.locator('#syncbar button')).toHaveText(BTN_SW_UPDATE);
    }

    // 在 A 点更新：没有未保存的草稿（待上传的修改在本机缓存里），所以不弹确认；只有 A 刷新。
    // 刷新前让浏览器断网（新版本已经装好在等待，外壳来自缓存），刷新后对账才会立刻转离线，而不是等 15 秒
    await context.setOffline(true);
    const reloadedA = page.waitForEvent('load');
    await page.locator('#syncbar button').click();
    await reloadedA;
    await expect.poll(() => marked(page), { message: 'A 刷新之后标记应该没了' }).toBe(false);
    await expect.poll(() => cacheNames(page), { message: '等旧缓存被删掉' }).toEqual([SW_CACHE_PREFIX + 'v2']);
    // B 没有自动刷新：标记还在、横幅还在、按钮还能点
    expect(await marked(tab)).toBe(true);
    await expect(tab.locator('#syncbar .sb-msg')).toHaveText(BANNER_SW_UPDATE);
    await expect(tab.locator('#syncbar button')).toBeEnabled();
    // A 刷新之后，待上传的数量还在
    await expect(status).toHaveAttribute('data-state', 'offline');
    await expect(status).toHaveText(statusOffline(1));
    expect(onServer(app, 'SYNTH-1303 pending')).toBe(0);

    // 撤掉故障、恢复网络（派发 online）：这条记录到了服务器，恰好一条
    await app.fake.clearFaults();
    await context.setOffline(false);
    await expect(status).toHaveAttribute('data-state', 'synced');
    await expect(status).toHaveText(STATUS_CLOUD_SYNCED);
    expect(onServer(app, 'SYNTH-1303 pending')).toBe(1);

    // B 点横幅的按钮：B 刷新一次，没有确认框
    const reloadedB = tab.waitForEvent('load');
    await tab.locator('#syncbar button').click();
    await reloadedB;
    await expect.poll(() => marked(tab), { message: 'B 刷新之后标记应该没了' }).toBe(false);
    await expect(tab.locator('#syncbar')).toBeHidden();
    expect(onServer(app, 'SYNTH-1303 pending')).toBe(1);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
  } finally {
    await setVersion(request, SW_TEST_VERSION);
  }
});

test('OPS-04 clicking the update button twice reloads the page once (D-08)', async ({ app, page, request }) => {
  try {
    await openControlled(app, page);
    const bar = page.locator('#syncbar');
    await deliver(request, page, 'v2');
    // 记下主框架的每一次导航；监听器跨刷新保留
    const navigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    // 同一个任务里点两次：第二次点在被重画替换掉的旧按钮上，它的监听器还在，防连点只能靠应用自己
    const reloaded = page.waitForEvent('load');
    await page.evaluate(() => {
      const b = document.querySelector<HTMLButtonElement>('#syncbar button')!;
      b.click();
      b.click();
    });
    // 再对已经 disabled 的新按钮强制点一次
    await bar.locator('button').click({ force: true, timeout: 1_000 }).catch(() => undefined);
    await reloaded;
    await expect.poll(() => cacheNames(page), { message: '等旧缓存被删掉' }).toEqual([SW_CACHE_PREFIX + 'v2']);
    await expect(bar).toBeHidden();
    // 刷新之后再等一会儿，不应该有第二次导航
    await page.waitForTimeout(500);
    expect(navigations).toHaveLength(1);
  } finally {
    await setVersion(request, SW_TEST_VERSION);
  }
});
