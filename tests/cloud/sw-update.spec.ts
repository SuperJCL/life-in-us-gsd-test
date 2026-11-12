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
import { syntheticState } from '../support/cloud-data';
import { SW_CACHE_PREFIX, SW_TEST_VERSION, SW_VERSION_CONTROL_PATH } from '../support/constants';
import { BANNER_SW_UPDATE, BTN_SW_UPDATE } from '../support/strings';

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
async function openControlled(app: AppHarness, page: Page) {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
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
