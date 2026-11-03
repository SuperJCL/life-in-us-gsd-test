// AppHarness：收拢打开应用、reload 和持久化断言（D-17、D-18）。
// 这里只能从 @playwright/test 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
import { expect, type Page } from '@playwright/test';
import { installClaudeMock } from '../mocks/claude-runtime';
import { MockBackend } from '../mocks/claude-backend';
import { ACCOUNT_USER_ID, MOCK_BINDING_NAME, STATE_KEY } from './constants';
import { STATUS_ACCOUNT, STATUS_LOCAL } from './strings';

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

// 两种存储模式（D-09）：
//  - local（默认）：页面没有 window.claude，数据存在 localStorage，Phase 1 的用例都走这条；
//  - account：页面装 window.claude mock，数据存在 Node 侧的 MockBackend（app.backend），
//    种子写进 MockBackend 而不写 localStorage。
export class AppHarness {
  // Node 侧的 mock 后端：用例通过它直接读 reads、writes、downloads、lastState()，不用 page.evaluate
  readonly backend = new MockBackend();

  // 当前期望应用走哪种存储，决定 ready() 的就绪条件
  private store: 'local' | 'account' = 'local';
  // 同一个 page 只能注册一次 binding
  private bindingExposed = false;

  constructor(private readonly page: Page) {}

  // 打开应用并等到就绪。
  // mode 缺省为 local；account 模式下 userId 缺省为 ACCOUNT_USER_ID，显式传 null 表示没有身份。
  // expectStore 只给 D-07 的反向对照用：账户 mock 已装但应用预期退回本地，就绪条件按本地算。
  async open(
    opts: {
      mode?: 'local' | 'account';
      seed?: unknown;
      userId?: string | null;
      expectStore?: 'local' | 'account';
    } = {},
  ) {
    const mode = opts.mode ?? 'local';
    if (mode === 'account') {
      if (!this.bindingExposed) {
        await this.page.exposeBinding(MOCK_BINDING_NAME, (_source, op: string, json: string) =>
          this.backend.handle(op, json),
        );
        this.bindingExposed = true;
      }
      if (opts.seed !== undefined) {
        this.backend.seed(opts.seed);
      }
      await this.page.addInitScript(installClaudeMock, {
        binding: MOCK_BINDING_NAME,
        userId: opts.userId === undefined ? ACCOUNT_USER_ID : opts.userId,
      });
      this.store = opts.expectStore ?? 'account';
    } else {
      this.store = 'local';
      if (opts.seed !== undefined) {
        await this.page.addInitScript(seedLocalStorageIfAbsent, {
          key: STATE_KEY,
          json: JSON.stringify(opts.seed),
        });
      }
    }
    await this.page.goto('/');
    await this.ready();
  }

  // 就绪条件。
  // local：状态行显示本地模式文案，说明 store 已就位。
  // account（D-08）：状态行显示账户文案，并且两个导出按钮都可见。
  // 只看状态栏会抢跑：应用在 setStatus 之后还要再 await use("downloads") 才显示导出按钮。
  async ready() {
    if (this.store === 'account') {
      await expect(this.page.locator('#status')).toHaveText(STATUS_ACCOUNT);
      await expect(this.page.locator('#exportCsv')).toBeVisible();
      await expect(this.page.locator('#exportJson')).toBeVisible();
    } else {
      await expect(this.page.locator('#status')).toHaveText(STATUS_LOCAL);
    }
  }

  async reload() {
    await this.page.reload();
    await this.ready();
  }

  // 读取落盘的状态；没有数据时返回 null。
  // account 模式读 MockBackend 里账户文档的当前内容，local 模式读 localStorage。
  async persisted(): Promise<any> {
    if (this.store === 'account') {
      return this.backend.lastState();
    }
    const raw = await this.page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
    return raw === null ? null : JSON.parse(raw);
  }

  // 保存有 600 ms 防抖，所以用 expect.poll 等条件成立，不用固定睡眠
  async expectPersisted(predicate: (state: any) => boolean, message = '等待保存落盘') {
    const check = async () => {
      const state = await this.persisted();
      return state === null ? false : predicate(state);
    };
    await expect.poll(check, { message }).toBe(true);
  }
}
