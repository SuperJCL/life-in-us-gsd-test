// AppHarness：收拢打开应用、reload 和持久化断言（D-17、D-18）。
// 这里只能从 @playwright/test 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
import { expect, type Page } from '@playwright/test';
import { installClaudeMock } from '../mocks/claude-runtime';
import { MockBackend } from '../mocks/claude-backend';
import { FakePbServer } from '../mocks/pb-server';
import { ACCOUNT_DOC_PATH, ACCOUNT_USER_ID, MOCK_BINDING_NAME, PB_SDK_PATH, STATE_KEY } from './constants';
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

// 三种存储模式（D-09、08-02）：
//  - local（默认）：页面没有 window.claude，数据存在 localStorage，Phase 1 的用例都走这条；
//  - account：页面装 window.claude mock，数据存在 Node 侧的 MockBackend（app.backend），
//    种子写进 MockBackend 而不写 localStorage；
//  - cloud：页面里是真实的 PocketBase SDK（同源提供），REST 由 Node 侧的 FakePbServer（app.fake）接应，
//    数据在 FakePbServer 里。Phase 8 的应用还没有云端路径，所以 cloud 只验证测试设施本身。
// 环境变量映射：只有 USJ_TEST_MODE 为 cloud 时才把 account 换算成 cloud；默认 npm test 下 account 和 local 不变。
// 映射要到 Phase 9 应用接上云端之后才对 v1 的账户用例有意义，Phase 8 只落地这个换算。
// playwright.cloud.config.ts 顶部设置 USJ_TEST_MODE，worker 继承环境变量；env 不设默认值，由调用方显式传入，
// 否则在 cloud 配置下传 undefined 会被默认值顶替成 cloud，纯函数的用例就测不出“没设置时不映射”。
export function resolveHarnessMode(
  mode: 'local' | 'account' | 'cloud',
  env: string | undefined,
): 'local' | 'account' | 'cloud' {
  return mode === 'account' && env === 'cloud' ? 'cloud' : mode;
}

export class AppHarness {
  // Node 侧的 mock 后端：用例通过它直接读 reads、writes、downloads、lastState()，不用 page.evaluate
  readonly backend = new MockBackend();
  // Node 侧的假 PocketBase：cloud 模式下用例通过它读 reads、writes、lastState()、requests，不用 page.evaluate
  readonly fake = new FakePbServer();

  // 当前期望应用走哪种存储，决定 ready() 的就绪条件
  private store: 'local' | 'account' | 'cloud' = 'local';
  // 同一个 page 只能注册一次 binding
  private bindingExposed = false;
  // open() 每个 AppHarness 只能调用一次：init script 和 binding 都会在同一个 page 上累积（WR-04）
  private opened = false;
  // 本地模式 open() 写进 localStorage 的种子原文；没有种子时为 null（saved() 用它区分“种子”和“应用写回”）
  private seedJson: string | null = null;

  constructor(private readonly page: Page) {}

  // 打开应用并等到就绪。
  // mode 缺省为 local；account 模式下 userId 缺省为 ACCOUNT_USER_ID，显式传 null 表示没有身份。
  // expectStore 只给 D-07 的反向对照用：账户 mock 已装但应用预期退回本地，就绪条件按本地算。
  // cloud 模式：users 是合成账号个数（默认 1），seed 写给第 0 个账号的 state 文档，plan 写给它的 plan 文档。
  async open(
    opts: {
      mode?: 'local' | 'account' | 'cloud';
      seed?: unknown;
      userId?: string | null;
      expectStore?: 'local' | 'account';
      users?: number;
      plan?: unknown;
    } = {},
  ) {
    // 账户 mock 用 Object.defineProperty 装 window.claude（不可配置），第二个 init script 会抛
    // “Cannot redefine property: claude”；本地种子也是“有就不写”，第二次会被静默忽略。
    // 所以重复调用直接报错，比一个难懂的 pageerror 好。
    if (this.opened) {
      throw new Error('AppHarness.open 每个用例只能调用一次；要换配置请新开一个 page（reload 用 app.reload()）');
    }
    this.opened = true;
    const mode = resolveHarnessMode(opts.mode ?? 'local', process.env.USJ_TEST_MODE);
    if (mode === 'cloud') {
      for (let i = 0; i < (opts.users ?? 1); i++) this.fake.addUser();
      if (opts.seed !== undefined) {
        this.fake.seed(opts.seed, { plan: opts.plan });
      }
      await this.fake.attach(this.page.context());
      this.store = 'cloud';
    } else if (mode === 'account') {
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
        this.seedJson = JSON.stringify(opts.seed);
      }
    }
    await this.page.goto('/');
    await this.ready();
  }

  // 就绪条件。
  // local：状态行显示本地模式文案，说明 store 已就位。
  // account（D-08）：状态行显示账户文案，并且两个导出按钮都可见。
  // 只看状态栏会抢跑：应用在 setStatus 之后还要再 await use("downloads") 才显示导出按钮。
  // cloud：Phase 8 的应用仍走本地路径，所以状态栏是本地文案；再同源加载真实 SDK，等到页面里有 PocketBase。
  // Phase 9 应用接上云端后要改这里的就绪条件（等应用的云端状态文案）。
  // 不要给页面设置 USJ_CONFIG.backend：Phase 7 的决定是它非 null 时应用停在加载之前并显示“存储配置无效”。
  async ready() {
    if (this.store === 'cloud') {
      await expect(this.page.locator('#status')).toHaveText(STATUS_LOCAL);
      await this.page.addScriptTag({ url: PB_SDK_PATH });
      await this.page.waitForFunction(() => typeof (window as any).PocketBase === 'function');
    } else if (this.store === 'account') {
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
    if (this.store === 'cloud') {
      return this.fake.lastState();
    }
    if (this.store === 'account') {
      return this.backend.lastState();
    }
    const raw = await this.page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
    return raw === null ? null : JSON.parse(raw);
  }

  // 账户模式自证（D-07）：状态栏是账户文案、mock 恰好记录到预期次数的读取且路径都对、
  // 页面 localStorage 里没有应用的键。
  // 必须声明为 async，第一条语句就是 reads 检查：这样任何失败都表现为被 reject 的 Promise，
  // 不会在调用时同步抛出，反向对照用例里的 await expect(...).rejects.toThrow() 才成立。
  // reads 检查放最前面还有一个原因：应用静默退回本地时 reads 是空的，这条同步检查立刻失败，不用等 expect 超时。
  // timeout 只用于状态栏那一项：反向对照里需要它快速失败，不用等满默认的 5 秒
  async expectAccountMode(opts: { reads?: number; timeout?: number } = {}) {
    if (this.store === 'cloud') {
      throw new Error('expectAccountMode 只适用于 account 模式');
    }
    const count = opts.reads ?? 1;
    expect(
      this.backend.reads,
      `mock 的读取次数或路径不对：应用可能静默退回了本地模式（期望 ${count} 次 ${ACCOUNT_DOC_PATH}）`,
    ).toEqual(Array(count).fill(ACCOUNT_DOC_PATH));
    await expect(this.page.locator('#status'), '状态栏不是账户同步文案：应用没有走账户存储').toHaveText(STATUS_ACCOUNT, {
      timeout: opts.timeout,
    });
    expect(
      await this.page.evaluate((key) => localStorage.getItem(key), STATE_KEY),
      'localStorage 里出现了应用的键：账户模式不应该写本地存储',
    ).toBeNull();
  }

  // 保存有 600 ms 防抖，所以用 expect.poll 等条件成立，不用固定睡眠
  async expectPersisted(predicate: (state: any) => boolean, message = '等待保存落盘') {
    const check = async () => {
      const state = await this.persisted();
      return state === null ? false : predicate(state);
    };
    await expect.poll(check, { message }).toBe(true);
  }

  // 应用最新保存的状态；还没有保存时返回 null（D-09）。两种模式的语义不同：
  //  - account：只认应用发出的写入，返回 backend.writes 最后一条的 data（深拷贝）；
  //    种子文档在 mock 里但不算“保存”，所以还没有写入时返回 null。
  //  - local：读 localStorage[STATE_KEY]。键不存在，或值仍是 open() 写进去的种子原文时返回 null。
  //    依据：本地种子由 init 脚本写进同一个键，所有 fixture 都带 _synthetic，而应用的 normalize
  //    会丢掉它，所以应用写回的内容不可能与种子原文相同。
  async saved(): Promise<any> {
    if (this.store === 'cloud') {
      const writes = this.fake.writes.filter((w) => w.path === 'journey_docs:state');
      return writes.length === 0 ? null : JSON.parse(JSON.stringify(writes[writes.length - 1].data));
    }
    if (this.store === 'account') {
      const writes = this.backend.writes;
      return writes.length === 0 ? null : JSON.parse(JSON.stringify(writes[writes.length - 1].data));
    }
    const raw = await this.page.evaluate((key) => localStorage.getItem(key), STATE_KEY);
    if (raw === null || raw === this.seedJson) return null;
    return JSON.parse(raw);
  }

  // 等应用保存的状态满足 predicate。保存有 600 ms 防抖，所以用 expect.poll，不用固定睡眠；
  // 默认 message 不含任何状态内容（状态里可能有个人计划文字）
  async expectSaved(predicate: (state: any) => boolean, message = '等待应用保存（内容已隐藏）') {
    const check = async () => {
      const state = await this.saved();
      return state === null ? false : predicate(state);
    };
    await expect.poll(check, { message }).toBe(true);
  }
}
