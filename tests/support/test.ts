// 所有 spec 只能从这里导入 test 和 expect（D-17）。
// 这个出口挂两个 auto fixture：guard（网络护栏）和 frozenClock（固定时钟）。
// 注入脚本只用 addInitScript(fn, arg) 的形式，不拼接字符串。
import { test as base, expect } from '@playwright/test';
import { APP_ORIGIN, FONT_HOSTS, FROZEN_NOW } from './constants';

type Fixtures = {
  guard: { expectedAborts: string[]; unexpectedRequests: string[] };
  frozenClock: void;
};

export const test = base.extend<Fixtures>({
  // 网络护栏（D-16）：用一个 context.route 分流，只放行应用自己的来源
  guard: [
    async ({ context }, use) => {
      const expectedAborts: string[] = [];
      const unexpectedRequests: string[] = [];

      await context.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith(APP_ORIGIN + '/')) {
          return route.continue();
        }
        let host = '';
        try {
          host = new URL(url).hostname;
        } catch (e) {
          host = '';
        }
        if (FONT_HOSTS.includes(host)) {
          // 字体主机：已预期拦截
          expectedAborts.push(url);
        } else {
          // 其他外部请求：记录下来，teardown 时让用例失败
          unexpectedRequests.push(url);
        }
        return route.abort('blockedbyclient');
      });

      await use({ expectedAborts, unexpectedRequests });

      expect(unexpectedRequests, '出现了允许列表之外的外部请求').toEqual([]);
    },
    { auto: true },
  ],

  // 固定时钟（D-15）：在任何导航之前设置固定时间
  frozenClock: [
    async ({ page }, use) => {
      await page.clock.setFixedTime(FROZEN_NOW);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
