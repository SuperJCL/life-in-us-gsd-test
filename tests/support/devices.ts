// 第二台设备（多设备用例，09-04）：同一个假服务器上的另一个独立浏览器上下文。
// 只能被 spec 导入；从 ./test 取护栏，从 ./app 取 AppHarness，两者都不会反过来导入本文件，没有循环引用。
import type { Browser, BrowserContext, Page } from '@playwright/test';
import type { FakePbServer } from '../mocks/pb-server';
import { AppHarness } from './app';
import { APP_ORIGIN, FROZEN_NOW, LOCALE, TIMEZONE_ID } from './constants';
import { attachGuard, guardPolicy, type GuardHandle } from './test';

export interface Device {
  context: BrowserContext;
  page: Page;
  // 绑定在这台设备的 page 上、共用同一个假服务器的 harness；用 app.open({ mode: 'cloud', login: 0 }) 打开并登录
  app: AppHarness;
}

// 新建第二台设备：新 context 不经过 fixture 的装配，所以这里显式带上与 playwright.config.ts 相同的 use 选项
// （baseURL、区域、时区、视口、浅色、减少动效、屏蔽 service worker、不接受下载），
// 并在任何导航之前用 attachGuard 挂上同一个 guard.state 和策略（研究 Pitfall 8）。
// proxy 和 host-resolver-rules 在 launchOptions（浏览器级），新 context 自动带上，不需要这里设置。
// 调用方负责在 finally 里关闭 context。第二台设备的违规（外部请求、页面异常、console.error）记进同一个 guard.state，
// teardown 时和第一台设备的一样让用例失败。
// clock 缺省为 fixed：和 frozenClock fixture 一样在导航之前固定时间；'none' 留给自己安装时钟的用例。
export async function openDevice(opts: {
  browser: Browser;
  guard: GuardHandle;
  fake: FakePbServer;
  clock?: 'fixed' | 'none';
  acceptDownloads?: boolean;
  viewport?: { width: number; height: number };
}): Promise<Device> {
  const context = await opts.browser.newContext({
    baseURL: APP_ORIGIN,
    locale: LOCALE,
    timezoneId: TIMEZONE_ID,
    viewport: opts.viewport ?? { width: 1280, height: 800 },
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    acceptDownloads: opts.acceptDownloads ?? false,
  });
  try {
    const page = await context.newPage();
    await attachGuard(context, opts.guard.state, guardPolicy(), page);
    if ((opts.clock ?? 'fixed') === 'fixed') {
      await page.clock.setFixedTime(FROZEN_NOW);
    }
    return { context, page, app: new AppHarness(page, { fake: opts.fake }) };
  } catch (error) {
    await context.close();
    throw error;
  }
}
