// 所有 spec 只能从这里导入 test 和 expect（D-17）。
// 这个出口挂两个 auto fixture：guard（网络护栏和页面错误收集）和 frozenClock（固定时钟）。
// 注入脚本只用 addInitScript(fn, arg) 的形式，不拼接字符串。
import { test as base, expect } from '@playwright/test';
import { APP_ORIGIN, FONT_HOSTS, FROZEN_NOW } from './constants';
import { AppHarness } from './app';

// guard 收集的全部状态；用例可以通过 ({ guard }) 读取 guard.state
export interface GuardState {
  // 白名单之外的外部请求（URL）：违规
  unexpectedRequests: string[];
  // 字体主机的请求（URL）：已预期拦截，不算违规
  expectedAborts: string[];
  // 页面里未捕获的异常：违规
  pageErrors: string[];
  // 控制台 error 消息（字体噪音除外）：违规
  consoleErrors: string[];
  // 被过滤掉的字体噪音文本：不算违规，只作为“噪音确实产生并已被过滤”的显式信号，供自检轮询
  filteredConsoleNoise: string[];
}

export interface GuardHandle {
  state: GuardState;
  // 清空五个数组。只能在故意制造违规的自检里调用，用来清掉那一条故意的违规
  reset(): void;
}

// 把 guard 状态转成违规清单：teardown 和自检共用这一个函数，
// 所以自检证明的失败路径，就是真实用例走的失败路径（D-17）。
// expectedAborts 和 filteredConsoleNoise 不算违规。
export function guardViolations(state: GuardState): string[] {
  return [
    ...state.unexpectedRequests.map((url) => `外部请求：${url}`),
    ...state.pageErrors.map((message) => `页面未捕获异常：${message}`),
    ...state.consoleErrors.map((text) => `console.error：${text}`),
  ];
}

type Fixtures = {
  guard: GuardHandle;
  frozenClock: void;
  app: AppHarness;
};

function emptyState(): GuardState {
  return {
    unexpectedRequests: [],
    expectedAborts: [],
    pageErrors: [],
    consoleErrors: [],
    filteredConsoleNoise: [],
  };
}

export const test = base.extend<Fixtures>({
  // 网络护栏（D-16）和页面错误收集（SAFE-04）
  guard: [
    async ({ context, page }, use) => {
      const state = emptyState();
      const handle: GuardHandle = {
        state,
        reset() {
          state.unexpectedRequests.length = 0;
          state.expectedAborts.length = 0;
          state.pageErrors.length = 0;
          state.consoleErrors.length = 0;
          state.filteredConsoleNoise.length = 0;
        },
      };

      // 用一个 context.route 分流，只放行应用自己的来源
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
          state.expectedAborts.push(url);
        } else {
          // 其他外部请求：记录下来，teardown 时让用例失败
          state.unexpectedRequests.push(url);
        }
        return route.abort('blockedbyclient');
      });

      // 页面未捕获异常：一律记录
      page.on('pageerror', (error) => {
        state.pageErrors.push(String(error));
      });

      // 控制台错误：只过滤“字体请求被 abort”产生的噪音，来源主机在 FONT_HOSTS 里才算。
      // 不按通用的 “Failed to load resource” 文本过滤。监听器同步处理，判断之前不 await。
      // 以后有用例需要豁免（例如 Phase 5 的畸形导入），要在用例里显式调用 reset
      // 或断言具体错误，不要放宽这里的过滤规则。
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        let host = '';
        try {
          host = new URL(msg.location().url).hostname;
        } catch (e) {
          host = '';
        }
        if (FONT_HOSTS.includes(host)) {
          state.filteredConsoleNoise.push(msg.text());
        } else {
          state.consoleErrors.push(msg.text());
        }
      });

      await use(handle);

      expect(guardViolations(handle.state), '护栏发现问题：外部请求或页面错误').toEqual([]);
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

  // 应用 harness：用例通过它打开应用、reload 和断言持久化（D-17）
  app: async ({ page }, use) => {
    await use(new AppHarness(page));
  },
});

export { expect };
