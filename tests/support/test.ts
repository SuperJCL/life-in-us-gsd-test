// 所有 spec 只能从这里导入 test 和 expect（D-17）。
// 这个出口挂两个 auto fixture：guard（网络护栏和页面错误收集）和 frozenClock（固定时钟）。
// 注入脚本只用 addInitScript(fn, arg) 的形式，不拼接字符串。
import { test as base, expect, type Page } from '@playwright/test';
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

// 会让用例失败的三类违规记录（expectedAborts 和 filteredConsoleNoise 不算违规，不可删除）
export type ViolationKind = 'unexpectedRequests' | 'pageErrors' | 'consoleErrors';

export interface GuardHandle {
  state: GuardState;
  // 只删掉 kind 这一类里包含 match 的记录，返回删掉的条数（原地修改数组）。
  // 不提供清空全部记录的方法（WR-02）。
  // 只能在故意制造违规的自检里调用：调用之前先断言该类记录恰好是预期的那几条，
  // 所以同一用例里真实发生的违规不会被一起删掉。
  remove(kind: ViolationKind, match: string): number;
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

// 时钟模式：fixed 为默认；manual 时 frozenClock 什么都不做，由用例自己调用 page.clock.install
type Options = {
  clockMode: 'fixed' | 'manual';
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

export const test = base.extend<Fixtures & Options>({
  // option fixture：用 test.use({ clockMode: 'manual' }) 切换
  clockMode: ['fixed', { option: true }],

  // 网络护栏（D-16）和页面错误收集（SAFE-04）
  guard: [
    async ({ context, page }, use) => {
      const state = emptyState();
      const handle: GuardHandle = {
        state,
        remove(kind, match) {
          const list = state[kind];
          let removed = 0;
          // 从后往前删，下标不会因 splice 错位
          for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].includes(match)) {
              list.splice(i, 1);
              removed++;
            }
          }
          return removed;
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

      // guard 的报警范围和限制（WR-05）：
      //  - 会报警：route 看得到的 HTTP 请求、页面发起的 WebSocket、同一 context 里任何 page 的
      //    未捕获异常和 console.error。
      //  - 无法报警：preconnect 这类不产生 Playwright 事件的 socket 连接。guard 没有事件可听，
      //    只能靠解析层（--host-resolver-rules）和死代理挡住，两层的证据见 PROBE-2。
      //  - 没有加 requestfailed 监听：交付配置里 context.route 先拦下页面的每个 HTTP 请求，
      //    被 abort 的请求错误是 ERR_BLOCKED_BY_CLIENT；代理层和解析层的错误码
      //    （ERR_PROXY_CONNECTION_FAILED、ERR_NAME_NOT_RESOLVED）在 guard 的页面里不会出现，
      //    这样的监听永远不会触发，也无法自证。
      const attach = (target: Page) => {
        // 页面未捕获异常：一律记录
        target.on('pageerror', (error) => {
          state.pageErrors.push(String(error));
        });

        // 控制台错误：只过滤“字体请求被 abort”产生的噪音，来源主机在 FONT_HOSTS 里才算。
        // 不按通用的 “Failed to load resource” 文本过滤。监听器同步处理，判断之前不 await。
        // 以后有用例需要豁免（例如 Phase 5 的畸形导入），要用 guard.remove 删掉具体那一条，
        // 或断言具体错误，不要放宽这里的过滤规则。
        target.on('console', (msg) => {
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

        // WebSocket 不经过 context.route，应用也不应发起任何 WebSocket：连接一创建就记为外部请求
        target.on('websocket', (ws) => {
          state.unexpectedRequests.push(ws.url());
        });
      };

      // fixture 的 page 先挂一次；context.on('page') 不会为它触发，只覆盖之后新开的 page
      attach(page);
      context.on('page', attach);

      await use(handle);

      expect(guardViolations(handle.state), '护栏发现问题：外部请求或页面错误').toEqual([]);
    },
    { auto: true },
  ],

  // 固定时钟（D-15）：在任何导航之前设置固定时间
  frozenClock: [
    async ({ page, clockMode }, use) => {
      // 同一个用例不混用 install 和 setFixedTime（D-15）：manual 时这里什么都不做
      if (clockMode === 'fixed') {
        await page.clock.setFixedTime(FROZEN_NOW);
      }
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
// 类型也从这个出口导出，spec 里不直接导入 @playwright/test
export type { Browser, Page } from '@playwright/test';
