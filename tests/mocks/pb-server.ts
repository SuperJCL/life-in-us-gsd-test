// Node 侧的假 PocketBase 服务器（TEST-02，08-02）。
//
// 约束：
//  - 状态都在 Node 进程里，页面刷新后仍在；每个 AppHarness 新建一个实例，用例之间不共享。进出都深拷贝。
//  - 只复述真实 PocketBase 0.41.1 的行为，依据是 08-RESEARCH 的源码结论，08-07 用真实实例的样本复核。
//    样本里没有的路径一律返回 null，交给护栏（route.fallback()）：假服务器没覆盖的调用不会被悄悄放过。
//  - REST 由 context.route 接应用来源下的 /api/，页面里的真实 SDK 原样运行；
//    门面与 v1 的 MockBackend 同名同义：reads、writes、downloads、seed()、lastState()。
//  - 令牌和口令只在运行时生成，源码里没有字面量（隐私规则 F、G）。
//  - 假时钟从 FROZEN_NOW 起，每次写入前进 1 毫秒，不读 Node 的真实时间：
//    页面的 Date.now() 被固定在 FROZEN_NOW，两边的时间对不上会让令牌过期判断取决于运行日期。
import { randomBytes } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import {
  APP_ORIGIN,
  FROZEN_NOW,
  PB_DOC_MAX_BYTES,
  PB_ES_BINDING_NAME,
  PB_TOKEN_DURATION_S,
  PB_USERS_COLLECTION_ID,
} from '../support/constants';
import { installFakeEventSource } from './pb-runtime';

// handle() 的入参：只含协议层信息，不含 Playwright 对象
export type PbRequest = {
  method: string;
  path: string;
  query: Record<string, string>;
  authorization: string | null;
  body: unknown;
};

// 实时推送给某个页面连接的一条事件
export type PbDelivery = { connectionId: string; name: string; data: string; lastEventId: string };

export type PbResponse = { status: number; body: unknown; deliveries: PbDelivery[] };

// 字段校验错误：code、message 加可选的 params（真实 0.41.1 的样本里 invalid_value、max_text、json_size_limit 带 params）
type FieldError = { code: string; message: string; params?: Record<string, unknown> };

type PbUser = { id: string; email: string; password: string };

type PbDoc = {
  collectionId: string;
  collectionName: string;
  id: string;
  owner: string;
  kind: string;
  data: unknown;
  writer: string;
  created: string;
  updated: string;
};

const JOURNEY_DOCS_ID = 'pbc_1000000001';

// 一条页面里的实时连接：clientId 是 SDK 在 POST /api/realtime 里带的身份；
// authUserId 为 undefined 表示还没提交过订阅，null 表示以匿名身份提交过
type PbConnection = {
  id: string;
  clientId: string;
  // null：没有页面的连接（契约自测在 Node 侧直接调用 handle()，不开浏览器）
  page: Page | null;
  // 握手时页面文档的令牌（pb-runtime 的 __pbDocToken）；没有页面或没带令牌时为 null
  docToken: string | null;
  authUserId: string | null | undefined;
  subscriptions: string[];
};

// 深拷贝：状态进出都经过它，之后改传入的对象不影响假服务器
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

// PocketBase 的时间格式：日期和时间之间是空格，毫秒三位，末尾 Z
function formatTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ');
}

// 确定性的 15 位 id：前缀字母加计数器的 base36，左补 0
function makeId(prefix: string, n: number): string {
  return prefix + n.toString(36).padStart(14, '0');
}

// 假令牌的一段：标准 base64 并去掉填充。
// 不能用 base64url：SDK 用原生 atob 解载荷读 exp，atob 不接受 - 和 _，
// 碰巧出现这两个字符会让令牌被判为无效，用例随机失败（08-RESEARCH Pitfall 7）。
function segment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64').replace(/=+$/, '');
}

export class FakePbServer {
  // 每条被返回或读取的文档，路径形如 journey_docs:state，按到达顺序
  reads: string[] = [];
  // 每次成功的创建或更新：路径形如 journey_docs:state，data 是文档的 data 字段（深拷贝）
  writes: Array<{ path: string; data: any }> = [];
  // 与 MockBackend 同名同义；Phase 8 恒为空，导出在 Phase 11 才会写入
  downloads: Array<{ filename: string; data: string }> = [];
  // 合成账号；口令运行时随机生成，只在内存里
  users: PbUser[] = [];
  // 断言用：只记方法、路径（不含查询串）、状态码，不记令牌和请求体
  requests: Array<{ method: string; path: string; status: number }> = [];
  // route.fulfill 抛出的异常（例如请求已被 SDK 取消）：记下来供用例断言，不吞掉
  fulfillErrors: Array<{ path: string; message: string }> = [];
  // 推送给页面失败的异常文本（例如页面已关闭）
  deliveryErrors: string[] = [];

  private docs: PbDoc[] = [];
  private tokens = new Map<string, { userId: string; exp: number }>();
  private clock = FROZEN_NOW;
  private docCounter = 0;
  private connections = new Map<string, PbConnection>();
  private connectionCounter = 0;
  private attachedContexts = new WeakSet<BrowserContext>();
  private watchedPages = new WeakSet<Page>();
  private pendingNavigations = new Set<Promise<void>>();

  // 添加第 n 个合成账号：邮箱 user-a@example.com、user-b@example.com……
  addUser(): PbUser {
    const n = this.users.length;
    if (n >= 26) throw new Error('FakePbServer.addUser：合成邮箱只支持 26 个账号');
    const user = {
      id: makeId('u', n + 1),
      email: `user-${String.fromCharCode(97 + n)}@example.com`,
      password: randomBytes(18).toString('hex'),
    };
    this.users.push(user);
    return clone(user);
  }

  // 种子：写入或覆盖某个账号的 state 文档（plan 给了就同样写 plan 文档）。种子不算 writes。
  seed(state: unknown, opts: { plan?: unknown; userIndex?: number } = {}): void {
    if (this.users.length === 0) this.addUser();
    const user = this.users[opts.userIndex ?? 0];
    if (!user) throw new Error('FakePbServer.seed：没有这个序号的账号');
    this.putDoc(user.id, 'state', state);
    if (opts.plan !== undefined) this.putDoc(user.id, 'plan', opts.plan);
  }

  // state 文档的当前 data（深拷贝）；没有时返回 null
  lastState(userIndex = 0): any | null {
    return this.dataOf(userIndex, 'state');
  }

  // plan 文档的当前 data（深拷贝）；没有时返回 null
  lastPlan(userIndex = 0): any | null {
    return this.dataOf(userIndex, 'plan');
  }

  // 纯函数式的 REST 处理：返回 null 表示这条路径没有实现，调用方交给护栏。
  // 每次非 null 的结果都记进 requests。
  handle(req: PbRequest): PbResponse | null {
    const res = this.route(req);
    if (res) this.requests.push({ method: req.method, path: req.path, status: res.status });
    return res;
  }

  // Node 侧取某个账号的令牌（测试直接以它的身份发请求用）
  login(userIndex: number): string {
    const user = this.users[userIndex];
    if (!user) throw new Error('FakePbServer.login：没有这个序号的账号');
    return this.issueToken(user.id);
  }

  // Node 侧发一个请求：身份可以是账号序号，也可以是令牌字符串（比如篡改过的令牌）。
  // 和页面里的请求走同一个 handle()；未实现的路径直接抛错，让用例立即失败。
  async request(who: number | string, method: string, path: string, body: unknown = null): Promise<PbResponse> {
    const authorization = typeof who === 'number' ? this.login(who) : who;
    const res = this.handle({ method, path, query: {}, authorization, body });
    if (res === null) throw new Error(`FakePbServer.request：没有实现 ${method} ${path}`);
    await this.deliver(res.deliveries);
    return res;
  }

  // 显式推送：测试调用，不靠计时器。和写入走同一套订阅者判定和 fields 裁剪。
  // who 是文档所有者（账号序号或用户 id）；record 缺的 owner、collectionId、collectionName 会补上。
  async emit(who: number | string, action: 'create' | 'update' | 'delete', record: Record<string, unknown>) {
    const owner = typeof who === 'number' ? this.users[who]?.id : who;
    if (!owner) throw new Error('FakePbServer.emit：没有这个序号的账号');
    const full = { collectionId: JOURNEY_DOCS_ID, collectionName: 'journey_docs', ...clone(record), owner };
    await this.deliver(this.deliveriesFor(full, action));
  }

  // 登记一条页面里的实时连接（假 EventSource 握手时调用），返回连接 id 和 clientId。
  // page 为 null 表示没有页面的连接：只用于契约自测，事件由 handle() 的 deliveries 返回，不会推送给任何页面
  openConnection(page: Page | null, docToken: string | null = null): { connectionId: string; clientId: string } {
    const n = ++this.connectionCounter;
    const connection: PbConnection = {
      id: 'conn' + n,
      clientId: makeId('k', n),
      page,
      docToken,
      authUserId: undefined,
      subscriptions: [],
    };
    this.connections.set(connection.id, connection);
    // 页面关闭或换了新文档（整页导航、刷新）之后，页面里的假 EventSource 已经不存在，连接要一并注销。
    // framenavigated 对同文档导航（hash 变化、history.pushState）也会触发，那种情况页面里的实例还活着，不能注销（WR-04），
    // 所以导航后读回当前文档的令牌，只注销令牌不同的连接。读不到（导航又发生了、上下文被销毁）就什么都不做：
    // 后一次导航自己的处理会补上，不能因为一次失败的读取把新文档的连接也删掉。
    if (page !== null && !this.watchedPages.has(page)) {
      this.watchedPages.add(page);
      page.on('close', () => {
        for (const [id, c] of this.connections) if (c.page === page) this.connections.delete(id);
      });
      page.on('framenavigated', (frame) => {
        if (frame !== page.mainFrame()) return;
        const pending = (async () => {
          let token: string | null;
          try {
            token = await frame.evaluate(() => (window as any).__pbDocToken ?? null);
          } catch (e) {
            return;
          }
          for (const [id, c] of this.connections) if (c.page === page && c.docToken !== token) this.connections.delete(id);
        })();
        this.pendingNavigations.add(pending);
        void pending.finally(() => this.pendingNavigations.delete(pending));
      });
    }
    return { connectionId: connection.id, clientId: connection.clientId };
  }

  // 等已经收到的导航事件都处理完（测试在 page.goto、reload、waitForURL 之后调用，保证断言看到的是处理之后的连接数）
  async whenNavigationsSettled(): Promise<void> {
    while (this.pendingNavigations.size > 0) await Promise.all([...this.pendingNavigations]);
  }

  closeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  // 当前登记的实时连接数
  connectionCount(): number {
    return this.connections.size;
  }

  // 接管应用来源下的 /api/。护栏的 **/* route 在 fixture 里先注册，这里后注册所以先匹配；
  // 未实现的路径经 route.fallback() 回到护栏，在 cloud 策略下记为违规（08-03 收紧）。
  async attach(context: BrowserContext): Promise<void> {
    // 每个 context 只能接一次：binding 和 init script 都会累积
    if (this.attachedContexts.has(context)) {
      throw new Error('FakePbServer.attach 每个 context 只能调用一次');
    }
    this.attachedContexts.add(context);

    // 页面侧假 EventSource 经 context.exposeBinding 往返 Node：source.page 区分是哪个页面调用的
    await context.exposeBinding(PB_ES_BINDING_NAME, (source, op: string, json: string) => {
      const arg = JSON.parse(json);
      if (op === 'es.open') return JSON.stringify(this.openConnection(source.page, typeof arg.docToken === 'string' ? arg.docToken : null));
      if (op === 'es.close') {
        this.closeConnection(arg.connectionId);
        return 'null';
      }
      throw new Error('FakePbServer: unknown op ' + op);
    });
    await context.addInitScript(installFakeEventSource, { binding: PB_ES_BINDING_NAME });

    await context.route(
      (url) => url.origin === APP_ORIGIN && url.pathname.startsWith('/api/'),
      async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const query: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          query[key] = value;
        });
        const raw = request.postData();
        let body: unknown = null;
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch (e) {
            this.fulfillErrors.push({ path: url.pathname, message: '请求体不是合法 JSON：' + String(e) });
          }
        }
        const res = this.handle({
          method: request.method(),
          path: url.pathname,
          query,
          authorization: request.headers()['authorization'] ?? null,
          body,
        });
        if (res === null) {
          return route.fallback();
        }
        try {
          if (res.status === 204) {
            await route.fulfill({ status: 204, body: '' });
          } else {
            await route.fulfill({
              status: res.status,
              contentType: 'application/json',
              body: JSON.stringify(res.body),
            });
          }
        } catch (e) {
          this.fulfillErrors.push({ path: url.pathname, message: String(e) });
        }
        // 响应 fulfill 之后才推送给订阅者：确定性的顺序，不靠计时器
        await this.deliver(res.deliveries);
      },
    );
  }

  // ---------- 内部 ----------

  // 逐条推给页面里的假 EventSource；页面已关闭等异常记进 deliveryErrors，不吞掉
  private async deliver(deliveries: PbDelivery[]): Promise<void> {
    for (const d of deliveries) {
      const connection = this.connections.get(d.connectionId);
      if (!connection) {
        this.deliveryErrors.push('连接 ' + d.connectionId + ' 已注销，事件没有送达');
        continue;
      }
      if (connection.page === null) {
        this.deliveryErrors.push('连接 ' + d.connectionId + ' 没有页面，事件没有送达');
        continue;
      }
      try {
        const delivered = await connection.page.evaluate(
          ([c, n, data, last]) => (window as any).__pbEsDeliver(c, n, data, last) as boolean,
          [d.connectionId, d.name, d.data, d.lastEventId],
        );
        if (!delivered) this.deliveryErrors.push('连接 ' + d.connectionId + ' 在页面里不存在');
      } catch (e) {
        this.deliveryErrors.push(String(e));
      }
    }
  }

  // 一次写入产生的推送：对每个连接的每个订阅串判定订阅者当时的身份。
  // journey_docs/* 按 listRule、journey_docs/<id> 按 viewRule，两条规则都是“已登录且 owner 等于自己”；
  // 订阅串里 options.query.fields 有值时只保留这些键；事件名就是订阅串原样。
  private deliveriesFor(record: { id?: unknown; owner?: unknown } & Record<string, unknown>, action: string): PbDelivery[] {
    const out: PbDelivery[] = [];
    for (const connection of this.connections.values()) {
      if (!connection.authUserId || connection.authUserId !== record.owner) continue;
      for (const sub of connection.subscriptions) {
        const [topic, rawQuery = ''] = sub.split('?');
        const matches = topic === 'journey_docs/*' || topic === 'journey_docs/' + String(record.id);
        if (!matches) continue;
        let payload: Record<string, unknown> = record;
        const rawOptions = new URLSearchParams(rawQuery).get('options');
        const fields = rawOptions ? (JSON.parse(rawOptions)?.query?.fields as string | undefined) : undefined;
        if (fields) {
          const keep = fields.split(',').map((f) => f.trim());
          if (!keep.includes('*')) {
            payload = Object.fromEntries(Object.entries(record).filter(([key]) => keep.includes(key)));
          }
        }
        out.push({
          connectionId: connection.id,
          name: sub,
          data: JSON.stringify({ action, record: payload }),
          lastEventId: connection.clientId,
        });
      }
    }
    return out;
  }

  private now(): number {
    return this.clock;
  }

  // 每次写入取一个时间戳并前进 1 毫秒
  private stamp(): string {
    const t = this.clock;
    this.clock += 1;
    return formatTime(t);
  }

  private dataOf(userIndex: number, kind: string): any | null {
    const user = this.users[userIndex];
    if (!user) return null;
    const doc = this.docs.find((d) => d.owner === user.id && d.kind === kind);
    return doc ? clone(doc.data) : null;
  }

  private putDoc(owner: string, kind: string, data: unknown): PbDoc {
    const existing = this.docs.find((d) => d.owner === owner && d.kind === kind);
    if (existing) {
      existing.data = clone(data);
      existing.updated = this.stamp();
      return existing;
    }
    const time = this.stamp();
    const doc: PbDoc = {
      collectionId: JOURNEY_DOCS_ID,
      collectionName: 'journey_docs',
      id: makeId('d', ++this.docCounter),
      owner,
      kind,
      data: clone(data),
      writer: '',
      created: time,
      updated: time,
    };
    this.docs.push(doc);
    return doc;
  }

  // 令牌三段都在运行时拼接：头和载荷是去掉填充的标准 base64，签名段是随机字节。
  // exp 用假时钟而不是 Node 的真实时间，所以固定时钟下 SDK 的 authStore.isValid 为真。
  private issueToken(userId: string): string {
    const token = [
      segment({ alg: 'HS256', typ: 'JWT' }),
      segment({
        collectionId: PB_USERS_COLLECTION_ID,
        exp: Math.floor(FROZEN_NOW / 1000) + PB_TOKEN_DURATION_S,
        id: userId,
        refreshable: true,
        type: 'auth',
      }),
      randomBytes(24).toString('base64url'),
    ].join('.');
    this.tokens.set(token, { userId, exp: Math.floor(FROZEN_NOW / 1000) + PB_TOKEN_DURATION_S });
    return token;
  }

  // 请求头里的令牌换成用户 id。SDK 发的是裸令牌，PocketBase 也接受 Bearer 前缀。
  // 不在令牌表里、或 exp 不大于假时钟当前秒数的，一律按未登录处理（返回 null）。
  private identityOf(authorization: string | null): string | null {
    if (!authorization) return null;
    const token = authorization.replace(/^Bearer /, '');
    const entry = this.tokens.get(token);
    if (!entry || entry.exp <= Math.floor(this.now() / 1000)) return null;
    return entry.userId;
  }

  private userRecord(user: PbUser) {
    return {
      collectionId: PB_USERS_COLLECTION_ID,
      collectionName: 'users',
      id: user.id,
      email: user.email,
      emailVisibility: false,
      verified: true,
      created: formatTime(FROZEN_NOW),
      updated: formatTime(FROZEN_NOW),
    };
  }

  private respond(status: number, body: unknown): PbResponse {
    return { status, body, deliveries: [] };
  }

  private route(req: PbRequest): PbResponse | null {
    // 登录：成功 200 返回 { record, token }；失败是 400 而不是 401（apis/record_auth_with_password.go）
    if (req.method === 'POST' && req.path === '/api/collections/users/auth-with-password') {
      const body = (req.body ?? {}) as { identity?: unknown; password?: unknown };
      const user = this.users.find((u) => u.email === body.identity && u.password === body.password);
      if (!user) {
        return this.respond(400, { status: 400, message: 'Failed to authenticate.', data: {} });
      }
      return this.respond(200, { record: this.userRecord(user), token: this.issueToken(user.id) });
    }

    // 列表：只返回 owner 等于当前身份的文档；listRule 不满足时是 200 空列表，不是错误。
    // page、perPage、skipTotal 之外的查询参数（filter、sort、fields、expand）本阶段不复述：交给护栏
    if (req.method === 'GET' && req.path === '/api/collections/journey_docs/records') {
      const supported = new Set(['page', 'perPage', 'skipTotal']);
      if (Object.keys(req.query).some((key) => !supported.has(key))) return null;
      const identity = this.identityOf(req.authorization);
      // 顺序：新建的在前（真实样本 list-own 里后建的 plan 排在先建的 state 前面；更新不改变顺序）
      const own = identity ? this.docs.filter((d) => d.owner === identity).reverse() : [];
      const page = Math.max(1, Number(req.query.page ?? 1));
      const perPage = Math.max(1, Number(req.query.perPage ?? 30));
      const items = own.slice((page - 1) * perPage, page * perPage);
      for (const doc of items) this.reads.push(`journey_docs:${doc.kind}`);
      const skipTotal = req.query.skipTotal === '1' || req.query.skipTotal === 'true';
      return this.respond(200, {
        items: clone(items),
        page,
        perPage,
        totalItems: skipTotal ? -1 : own.length,
        totalPages: skipTotal ? -1 : Math.max(1, Math.ceil(own.length / perPage)),
      });
    }

    // 实时订阅登记：clientId 不存在 404；同一连接换了身份 403；成功 204 空正文
    if (req.method === 'POST' && req.path === '/api/realtime') {
      const body = (req.body ?? {}) as { clientId?: unknown; subscriptions?: unknown };
      const connection = [...this.connections.values()].find((c) => c.clientId === body.clientId);
      if (!connection) {
        return this.respond(404, { status: 404, message: 'Missing or invalid client id.', data: {} });
      }
      const identity = this.identityOf(req.authorization);
      if (connection.authUserId !== undefined && connection.authUserId !== identity) {
        return this.respond(403, {
          status: 403,
          message: "The current and the previous request authorization don't match.",
          data: {},
        });
      }
      connection.authUserId = identity;
      connection.subscriptions = Array.isArray(body.subscriptions)
        ? body.subscriptions.filter((x): x is string => typeof x === 'string')
        : [];
      return this.respond(204, null);
    }

    // 刷新令牌：只有这个接口对无效或过期令牌返回 401（记录接口一律按未登录处理，不是 401）
    if (req.method === 'POST' && req.path === '/api/collections/users/auth-refresh') {
      const identity = this.identityOf(req.authorization);
      const user = identity ? this.users.find((u) => u.id === identity) : undefined;
      if (!user) {
        return this.respond(401, {
          status: 401,
          message: 'The request requires valid record authorization token.',
          data: {},
        });
      }
      return this.respond(200, { record: this.userRecord(user), token: this.issueToken(user.id) });
    }

    // 创建：createRule 是 登录 且 body.owner 等于自己；不满足是 400（不是 403、404）。
    // 通过规则之后字段校验的错误一起返回，每个出错字段是 { code, message }。
    if (req.method === 'POST' && req.path === '/api/collections/journey_docs/records') {
      const identity = this.identityOf(req.authorization);
      const body = (req.body ?? {}) as { owner?: unknown; kind?: unknown; data?: unknown; writer?: unknown };
      if (!identity || body.owner !== identity) {
        return this.respond(400, { status: 400, message: 'Failed to create record.', data: {} });
      }
      const errors: Record<string, FieldError> = {};
      const kindValid = body.kind === 'state' || body.kind === 'plan';
      // select 字段的值不在 values 里
      if (!kindValid) {
        errors.kind = {
          code: 'validation_invalid_value',
          message: 'Invalid value ' + String(body.kind) + '.',
          params: { value: body.kind },
        };
      }
      this.checkWriterAndData(body, errors);
      // (owner, kind) 唯一索引：两个字段都报 validation_not_unique
      if (kindValid && this.docs.some((d) => d.owner === identity && d.kind === body.kind)) {
        errors.owner = { code: 'validation_not_unique', message: 'Value must be unique.' };
        errors.kind = { code: 'validation_not_unique', message: 'Value must be unique.' };
      }
      if (Object.keys(errors).length > 0) {
        return this.respond(400, { status: 400, message: 'Failed to create record.', data: errors });
      }
      const doc = this.putDoc(identity, body.kind as string, body.data ?? null);
      if (typeof body.writer === 'string') doc.writer = body.writer;
      this.writes.push({ path: `journey_docs:${doc.kind}`, data: clone(doc.data) });
      return { ...this.respond(200, clone(doc)), deliveries: this.deliveriesFor(doc, 'create') };
    }

    // 删除：deleteRule 为 null（锁定），对非超级用户一律 403，连记录存不存在都不看
    if (req.method === 'DELETE' && /^\/api\/collections\/journey_docs\/records\/[^/]+$/.test(req.path)) {
      return this.respond(403, { status: 403, message: 'Only superusers can perform this action.', data: {} });
    }

    // 查看和更新：路径里带记录 id
    const one = req.path.match(/^\/api\/collections\/journey_docs\/records\/([^/]+)$/);
    if (one && (req.method === 'GET' || req.method === 'PATCH')) {
      const identity = this.identityOf(req.authorization);
      const doc = this.docs.find((d) => d.id === one[1]);
      // viewRule、updateRule 不满足（未登录、别人的、不存在）都是 404，不泄露记录是否存在
      const notFound = this.respond(404, { status: 404, message: "The requested resource wasn't found.", data: {} });
      if (!identity || !doc || doc.owner !== identity) return notFound;

      if (req.method === 'GET') {
        this.reads.push(`journey_docs:${doc.kind}`);
        return this.respond(200, clone(doc));
      }

      // updateRule 里 owner、kind 的 :isset = false：请求体里出现这两个键（值相同也算）规则就不满足，404
      const body = (req.body ?? {}) as { data?: unknown; writer?: unknown };
      if ('owner' in body || 'kind' in body) return notFound;
      const errors: Record<string, FieldError> = {};
      this.checkWriterAndData(body, errors);
      if (Object.keys(errors).length > 0) {
        return this.respond(400, { status: 400, message: 'Failed to update record.', data: errors });
      }
      if ('data' in body) doc.data = clone(body.data ?? null);
      if (typeof body.writer === 'string') doc.writer = body.writer;
      doc.updated = this.stamp();
      this.writes.push({ path: `journey_docs:${doc.kind}`, data: clone(doc.data) });
      return { ...this.respond(200, clone(doc)), deliveries: this.deliveriesFor(doc, 'update') };
    }

    return null;
  }

  // writer 最多 40 个字符，data 序列化后不超过 PB_DOC_MAX_BYTES；创建和更新共用
  private checkWriterAndData(
    body: { data?: unknown; writer?: unknown },
    errors: Record<string, FieldError>,
  ): void {
    if (typeof body.writer === 'string' && Array.from(body.writer).length > 40) {
      errors.writer = {
        code: 'validation_max_text_constraint',
        message: 'Must be no more than 40 character(s).',
        params: { max: 40 },
      };
    }
    if ('data' in body && Buffer.byteLength(JSON.stringify(body.data ?? null)) > PB_DOC_MAX_BYTES) {
      errors.data = {
        code: 'validation_json_size_limit',
        message: `The maximum allowed JSON size is ${PB_DOC_MAX_BYTES} bytes.`,
        params: { maxSize: PB_DOC_MAX_BYTES },
      };
    }
  }
}
