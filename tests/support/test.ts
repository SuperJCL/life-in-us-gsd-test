// 所有 spec 只能从这里导入 test 和 expect（D-17）。
// 这个出口挂两个 auto fixture：guard（网络护栏和页面错误收集）和 frozenClock（固定时钟）。
// 注入脚本只用 addInitScript(fn, arg) 的形式，不拼接字符串。
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { APP_ORIGIN, FONT_HOSTS, FROZEN_NOW, PB_SDK_PATH, SW_PATH } from './constants';
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

// 护栏策略（SAFE-01、TEST-02）：v1 是默认 npm test 用的，cloud 是 test:cloud 用的。
// 只有 USJ_TEST_MODE 为 cloud 时才是 cloud；playwright.cloud.config.ts 设置它，worker 继承 runner 的环境变量。
export type GuardPolicy = 'v1' | 'cloud';

// 不带参数调用时读环境变量；显式传入 undefined 表示“没设置”（不会被默认值顶替成 cloud 配置下的环境变量，
// 同 08-02 里 resolveHarnessMode 踩过的坑），所以用剩余参数区分“没传”和“传了 undefined”。
export function guardPolicy(...args: [env?: string | undefined]): GuardPolicy {
  const env = args.length === 0 ? process.env.USJ_TEST_MODE : args[0];
  return env === 'cloud' ? 'cloud' : 'v1';
}

// 应用来源下放行的路径白名单：每条都要写明原因，不允许用别的方式放宽。
// v1：页面本身，加上静态服务器返回应用文件的别名；v1 页面不加载 SDK，也不发任何 /api 请求。
export const V1_APP_PATHS = ['/', '/us-journey-tracker.html'];
// cloud：页面、应用文件，以及同源提供的、哈希已钉死的 PocketBase SDK。
// SW_PATH（OPS-04、D-07）：云端页面注册的 Service Worker 脚本，由静态服务器从 deploy/site/sw.js 提供；只进 cloud 档，本地版（v1）不注册。
// /api/* 不在这里：假服务器接得住的路径由它后注册的 route 先处理，接不住的经 route.fallback() 落回这里，记为违规。
export const CLOUD_APP_PATHS = ['/', '/us-journey-tracker.html', PB_SDK_PATH, SW_PATH];

// 判定一条请求 URL：allow 放行，font 是已预期拦截的字体主机，violation 记录并 abort。
// 纯函数：不碰页面和 Playwright 对象，route 处理函数和单元断言共用这一个入口。
export function classifyRequest(url: string, policy: GuardPolicy): 'allow' | 'font' | 'violation' {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    return 'violation';
  }
  if (parsed.origin === APP_ORIGIN) {
    // WR-05 的缺口已补：两档策略都只放行各自白名单里的路径，应用来源下的其他路径同样记为违规
    const allowed = policy === 'cloud' ? CLOUD_APP_PATHS : V1_APP_PATHS;
    return allowed.includes(parsed.pathname) ? 'allow' : 'violation';
  }
  // INFRA-03：云端页面只能请求同源，字体主机在 cloud 策略下也是违规（Phase 9 起应用不再引用字体主机）；
  // v1 策略保留 font 分支：默认 npm test 的护栏自检仍用它证明“已预期拦截”这一路
  if (policy === 'cloud') return 'violation';
  return FONT_HOSTS.includes(parsed.hostname) ? 'font' : 'violation';
}

// 给一个 context 装护栏：一个 context.route 分流加页面事件监听（含之后新开的 page）。
// guard 的报警范围和限制（WR-05）：
//  - 会报警：route 看得到的 HTTP 请求（应用来源下的非白名单路径、外部主机）、页面发起的 WebSocket、
//    同一 context 里任何 page 的未捕获异常和 console.error。
//  - cloud 策略下，应用来源里假服务器没接住的 /api/*（含真实 EventSource 连 /api/realtime）也会报警：
//    假服务器的 route 在用例里后注册、先匹配，没实现的路径 route.fallback() 回到这里。
//  - 无法报警：route 看不到的 socket 连接（例如 WebSocket）这类不产生 Playwright 事件的连接。guard 没有事件可听，
//    只能靠解析层（--host-resolver-rules）和死代理挡住，两层的证据见 PROBE-2。
//  - 没有加 requestfailed 监听：交付配置里 context.route 先拦下页面的每个 HTTP 请求，
//    被 abort 的请求错误是 ERR_BLOCKED_BY_CLIENT；代理层和解析层的错误码
//    （ERR_PROXY_CONNECTION_FAILED、ERR_NAME_NOT_RESOLVED）在 guard 的页面里不会出现，
//    这样的监听永远不会触发，也无法自证。
export async function attachGuard(
  context: BrowserContext,
  state: GuardState,
  policy: GuardPolicy,
  firstPage?: Page,
): Promise<void> {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    const kind = classifyRequest(url, policy);
    if (kind === 'allow') {
      return route.continue();
    }
    if (kind === 'font') {
      // 字体主机：已预期拦截
      state.expectedAborts.push(url);
    } else {
      // 其他请求：记录下来，teardown 时让用例失败
      state.unexpectedRequests.push(url);
    }
    return route.abort('blockedbyclient');
  });

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

  // 传入的 page 先挂一次；context.on('page') 不会为它触发，只覆盖之后新开的 page
  if (firstPage) attach(firstPage);
  context.on('page', attach);
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

      // 注册路由和页面事件监听；第二台“设备”（第二个 context）用同一个 attachGuard 复用同一套策略（研究 Pitfall 8）
      await attachGuard(context, state, guardPolicy(), page);

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

// 已知 bug 标记（BUG-01，D-11、D-12）。约定：
//  - 只能作为标记用例的第一句调用；
//  - 每个已知 bug 都要有一条不带标记的对照用例，走同样的准备和触发并断言前提成立，
//    因为 test.fail 会把同一条用例里任何原因的失败都当作“预期失败”；
//  - 默认用 test.fail；只有无法稳定复现或期望行为未定时才传 opts.fixme（写明原因）改用 test.fixme；
//  - 调用之前，执行者必须已经亲眼确认这个 bug 能复现（D-13）；
//  - 新增一条要同时在 tests/KNOWN-BUGS.md 登记，护栏用例会核对。
export function knownBug(id: string, summary: string, opts: { fixme?: string } = {}) {
  test.info().annotations.push({ type: 'known-bug', description: id + '：' + summary });
  if (opts.fixme) {
    test.fixme(true, opts.fixme);
  } else {
    test.fail();
  }
}
