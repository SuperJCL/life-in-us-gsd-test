// AppHarness：收拢打开应用、reload 和持久化断言（D-17、D-18）。
// 这里只能从 @playwright/test 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
import { expect, type Page } from '@playwright/test';
import { STATE_KEY } from './constants';
import { STATUS_LOCAL } from './strings';

// 预置种子：只有 localStorage 里没有这个键时才写入。
// addInitScript 注入的脚本在每次导航（包括 reload）时都会重新执行，
// 所以必须“没有才写”，否则 reload 会用种子覆盖应用刚保存的新数据（D-18）。
// 函数体必须自包含，不能引用模块里的任何变量：addInitScript 会把函数序列化成源码发给浏览器。
export function seedLocalStorageIfAbsent(arg: { key: string; json: string }) {
  // init script 在每个 frame、每次导航都会执行：导航到 opaque origin（例如 data: URL、
  // 沙箱 iframe）时访问 localStorage 会抛 SecurityError，那不是被测应用的错误，
  // 不能让它变成页面异常被 guard 报出来（IN-05）
  try {
    if (localStorage.getItem(arg.key) === null) {
      localStorage.setItem(arg.key, arg.json);
    }
  } catch (e) {}
}

// 本阶段只支持 local 模式（页面没有 window.claude，数据存在 localStorage）。
// Phase 2 会在这里加 account 模式。
export class AppHarness {
  constructor(private readonly page: Page) {}

  // 打开应用并等到就绪；有 seed 时先注入种子，再导航
  async open(opts: { seed?: unknown } = {}) {
    if (opts.seed !== undefined) {
      await this.page.addInitScript(seedLocalStorageIfAbsent, {
        key: STATE_KEY,
        json: JSON.stringify(opts.seed),
      });
    }
    await this.page.goto('/');
    await this.ready();
  }

  // 就绪条件：状态行显示本地模式文案，说明 store 已就位
  async ready() {
    await expect(this.page.locator('#status')).toHaveText(STATUS_LOCAL);
  }

  async reload() {
    await this.page.reload();
    await this.ready();
  }

  // 读取 localStorage 里落盘的状态；没有数据时返回 null
  async persisted(): Promise<any> {
    const raw = await this.page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
    return raw === null ? null : JSON.parse(raw);
  }

  // 保存有 600 ms 防抖，所以用 expect.poll 等条件成立，不用固定睡眠
  async expectPersisted(predicate: (state: any) => boolean, message = '等待 localStorage 保存') {
    const check = async () => {
      const state = await this.persisted();
      return state === null ? false : predicate(state);
    };
    await expect.poll(check, { message }).toBe(true);
  }
}
