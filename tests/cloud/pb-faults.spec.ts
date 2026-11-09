// 假服务器错误注入开关的自检（TEST-02，09-03）。只在 npm run test:cloud 里运行，只用合成账号。
// 开关由用例显式打开，只作用于页面请求；不用计时器，不用 context.setOffline。
import { test, expect, type Page } from '../support/test';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { APP_ORIGIN } from '../support/constants';
import { syntheticState } from '../support/cloud-data';
import { LOGIN_ERR_UNREACHABLE } from '../support/strings';

const LIST_PATH = '/api/collections/journey_docs/records';

test('TEST-02 the refuse switch fails a page request at the network layer and the app shows the connection message', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud' });
  await expect(page.locator('#login')).toBeVisible();
  const f = app.fake.fault({ method: 'POST', path: '/api/collections/users/auth-with-password', mode: 'refuse' });

  await app.submitLogin(0);

  await expect(page.locator('#login-err')).toHaveText(LOGIN_ERR_UNREACHABLE);
  expect(f.hits).toBe(1);
  expect(app.fake.faultHits).toEqual([
    { method: 'POST', path: '/api/collections/users/auth-with-password', mode: 'refuse', status: 0 },
  ]);
  // 被拒绝的请求没有到达 handle()，也没有任何令牌留在浏览器里
  expect(app.fake.requests.filter((r) => r.path.endsWith('/auth-with-password'))).toEqual([]);
  expect(await page.evaluate(() => window.localStorage.getItem('pocketbase_auth'))).toBeNull();
  expect(app.fake.fulfillErrors).toEqual([]);
  // 被拒连接：Chromium 为这条 fetch 写一条带网络错误码的 console.error
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
});

// 页面里建一个 SDK 实例放在 window.__pb 上，之后的 evaluate 继续使用它
async function newClient(page: Page): Promise<void> {
  await page.evaluate(
    ({ origin }) => {
      const pb = new (window as any).PocketBase(origin);
      pb.autoCancellation(false);
      (window as any).__pb = pb;
    },
    { origin: APP_ORIGIN },
  );
}

type Creds = { email: string; password: string };

// 登录并返回账号 id
async function signIn(page: Page, creds: Creds): Promise<string> {
  await newClient(page);
  return page.evaluate(async ({ email, password }) => {
    const pb = (window as any).__pb;
    await pb.collection('users').authWithPassword(email, password);
    return pb.authStore.record.id as string;
  }, creds);
}

type Outcome = { ok: boolean; status: number; message: string; codes: Record<string, string>; count: number };
type Call =
  | { kind: 'list' }
  | { kind: 'refresh' }
  | { kind: 'login'; creds: Creds }
  | { kind: 'create'; owner: string }
  | { kind: 'update'; id: string; data: Record<string, unknown> }
  | { kind: 'delete'; id: string };

// 在 window.__pb 上执行一次 SDK 调用；失败时整理成可序列化的 { status, message, codes }（codes 是每个出错字段的错误码）
function attempt(page: Page, call: Call): Promise<Outcome> {
  return page.evaluate(async (c) => {
    const pb = (window as any).__pb;
    const docs = pb.collection('journey_docs');
    try {
      let count = 0;
      if (c.kind === 'list') count = (await docs.getFullList()).length;
      if (c.kind === 'refresh') await pb.collection('users').authRefresh();
      if (c.kind === 'login') await pb.collection('users').authWithPassword(c.creds.email, c.creds.password);
      if (c.kind === 'create') await docs.create({ owner: c.owner, kind: 'state', data: { _synthetic: true } });
      if (c.kind === 'update') await docs.update(c.id, { data: c.data });
      if (c.kind === 'delete') await docs.delete(c.id);
      return { ok: true, status: 200, message: '', codes: {}, count };
    } catch (e: any) {
      const data = e.response?.data ?? {};
      return {
        ok: false,
        status: e.status as number,
        message: (e.response?.message ?? '') as string,
        codes: Object.fromEntries(Object.entries(data).map(([key, value]: [string, any]) => [key, value.code])) as Record<
          string,
          string
        >,
        count: 0,
      };
    }
  }, call);
}

// 页面里发起一次列表请求但不等待；结果写在 window.__held（pending、或 { ok, count }）
function startHeldList(page: Page): Promise<void> {
  return page.evaluate(() => {
    const w = window as any;
    w.__held = 'pending';
    w.__pb.collection('journey_docs').getFullList().then(
      (items: unknown[]) => (w.__held = { ok: true, count: items.length }),
      () => (w.__held = { ok: false, count: 0 }),
    );
  });
}
const heldState = (page: Page) => page.evaluate(() => (window as any).__held);

test('TEST-02 the status switch answers once with the injected status and a PocketBase-shaped error body', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), backend: null });
  const [user] = app.fake.users;
  const login = app.fake.fault({
    method: 'POST',
    path: '/api/collections/users/auth-with-password',
    mode: 'status',
    status: 429,
    times: 1,
  });
  const list = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'status', status: 503, times: 1 });
  await newClient(page);

  // 登录：第一次得到注入的 429，第二次（规则用完）成功
  expect(await attempt(page, { kind: 'login', creds: user })).toMatchObject({
    ok: false,
    status: 429,
    message: 'Too Many Requests.',
  });
  expect(login.hits).toBe(1);
  expect((await attempt(page, { kind: 'login', creds: user })).ok).toBe(true);
  expect(login.hits, '规则用完之后不再命中').toBe(1);

  // 列表：第一次 503 和 5xx 那句，第二次 200
  expect(await attempt(page, { kind: 'list' })).toMatchObject({
    ok: false,
    status: 503,
    message: 'Something went wrong while processing your request.',
  });
  expect(list.hits).toBe(1);
  expect(await attempt(page, { kind: 'list' })).toMatchObject({ ok: true, count: 1 });

  expect(app.fake.faultHits).toEqual([
    { method: 'POST', path: '/api/collections/users/auth-with-password', mode: 'status', status: 429 },
    { method: 'GET', path: LIST_PATH, mode: 'status', status: 503 },
  ]);
  // 被注入拦下的请求没有进 requests；放行的两条（登录、列表）各一条 200
  expect(app.fake.requests.map((r) => r.status)).toEqual([200, 200]);
  expect(app.fake.fulfillErrors).toEqual([]);
  await acknowledgeConsoleErrors(guard, { 'status of 429 ': 1, 'status of 503 ': 1 });
});

test('TEST-02 the lose-answer switch applies the request on the server and fails it in the page', async ({ app, page, guard }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), backend: null });
  const [user] = app.fake.users;
  await signIn(page, user);
  const id = app.fake.docId(0, 'state');
  const path = `${LIST_PATH}/${id}`;
  const f = app.fake.fault({ method: 'PATCH', path, mode: 'lose-answer', times: 1 });

  // 页面看到网络错误（status 0），但 handle() 已经应用了这次写入：服务器上是新内容，requests 里有这条 PATCH 200
  const lost = await attempt(page, { kind: 'update', id, data: { _synthetic: true, marker: 'lose-answer-one' } });
  expect(lost.ok).toBe(false);
  expect(lost.status).toBe(0);
  expect(f.hits).toBe(1);
  expect(JSON.stringify(app.fake.lastState(0))).toContain('lose-answer-one');
  expect(app.fake.requests.filter((r) => r.method === 'PATCH')).toEqual([{ method: 'PATCH', path, status: 200 }]);
  expect(app.fake.faultHits).toEqual([{ method: 'PATCH', path, mode: 'lose-answer', status: 0 }]);
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_RESET: 1 });

  // times 用完之后恢复正常：这次页面收到 200
  expect((await attempt(page, { kind: 'update', id, data: { _synthetic: true, marker: 'lose-answer-two' } })).ok).toBe(true);
  expect(JSON.stringify(app.fake.lastState(0))).toContain('lose-answer-two');
  expect(f.hits).toBe(1);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('TEST-02 the hold switch keeps a request pending until it is released', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), backend: null });
  const [user] = app.fake.users;
  await signIn(page, user);
  const f = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });

  await startHeldList(page);
  await expect.poll(() => f.hits, { message: '等待请求到达假服务器' }).toBe(1);
  // 请求被挂起：没有进入 handle()，页面标记仍是 pending
  expect(await heldState(page)).toBe('pending');
  expect(app.fake.requests.filter((r) => r.path === LIST_PATH)).toEqual([]);

  await f.release();
  await expect.poll(() => heldState(page)).toEqual({ ok: true, count: 1 });
  // release 返回时请求已经处理完：handle() 记下一条 200；之后的请求不再被拦
  expect(app.fake.requests.filter((r) => r.path === LIST_PATH)).toEqual([{ method: 'GET', path: LIST_PATH, status: 200 }]);
  expect((await attempt(page, { kind: 'list' })).count).toBe(1);
  expect(f.hits).toBe(1);

  // clearFaults 同样放行挂起的请求，并且之后不再拦截
  app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
  await startHeldList(page);
  await expect.poll(() => app.fake.faultHits.filter((h) => h.mode === 'hold').length).toBe(2);
  expect(await heldState(page)).toBe('pending');
  await app.fake.clearFaults();
  await expect.poll(() => heldState(page)).toEqual({ ok: true, count: 1 });
  expect((await attempt(page, { kind: 'list' })).count).toBe(1);
  expect(app.fake.faultHits.filter((h) => h.mode === 'hold')).toHaveLength(2);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('TEST-02 revoking the tokens of an account makes auth-refresh answer 401 and record routes treat the token as anonymous', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), backend: null });
  const [user] = app.fake.users;
  await signIn(page, user);
  expect((await attempt(page, { kind: 'list' })).count).toBe(1);
  const tokenBefore = await page.evaluate(() => (window as any).__pb.authStore.token as string);

  app.fake.revokeTokens(0);

  expect(await attempt(page, { kind: 'refresh' })).toMatchObject({
    ok: false,
    status: 401,
    message: 'The request requires valid record authorization token.',
  });
  // SDK 的 authStore 仍留着旧令牌：记录接口把它当匿名，200 空列表
  expect(await page.evaluate(() => (window as any).__pb.authStore.token as string)).toBe(tokenBefore);
  expect(await attempt(page, { kind: 'list' })).toMatchObject({ ok: true, count: 0 });

  // 重新登录得到新令牌，又能看到自己的文档
  expect((await attempt(page, { kind: 'login', creds: user })).ok).toBe(true);
  expect(await page.evaluate(() => (window as any).__pb.authStore.token as string)).not.toBe(tokenBefore);
  expect(await attempt(page, { kind: 'list' })).toMatchObject({ ok: true, count: 1 });
  expect(app.fake.fulfillErrors).toEqual([]);
  await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });
});

test('TEST-02 the before-next hook and dropping documents let another actor change the server first', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud', backend: null });
  const [user] = app.fake.users;
  const ownId = await signIn(page, user);
  expect(app.fake.docId(0, 'state')).toBeNull();

  // 另一个参与者先建好 state 文档：钩子在页面的创建请求交给 handle() 之前执行
  let hookRuns = 0;
  app.fake.beforeNext('POST', LIST_PATH, () => {
    hookRuns++;
    app.fake.seed(syntheticState('other-device'));
  });
  const conflict = await attempt(page, { kind: 'create', owner: ownId });
  // 响应来自 handle() 的真实逻辑：(owner, kind) 唯一索引，两个字段都是 validation_not_unique
  expect(conflict).toMatchObject({
    ok: false,
    status: 400,
    codes: { owner: 'validation_not_unique', kind: 'validation_not_unique' },
  });
  expect(hookRuns).toBe(1);
  const raced = app.fake.docId(0, 'state');
  expect(raced).not.toBeNull();
  expect(app.fake.lastState(0)).toEqual(syntheticState('other-device'));

  // 超级用户式地删掉文档：列表为空，随后的创建成功（钩子是一次性的，不再触发），id 是新的
  app.fake.dropDocs(0);
  expect(app.fake.docId(0, 'state')).toBeNull();
  expect(await attempt(page, { kind: 'list' })).toMatchObject({ ok: true, count: 0 });
  expect((await attempt(page, { kind: 'create', owner: ownId })).ok).toBe(true);
  expect(hookRuns).toBe(1);
  const created = app.fake.docId(0, 'state');
  expect(created).not.toBeNull();
  expect(created).not.toBe(raced);

  // 客户端删除仍然是 403，文档还在
  expect(await attempt(page, { kind: 'delete', id: created! })).toMatchObject({ ok: false, status: 403 });
  expect(app.fake.docId(0, 'state')).toBe(created);
  expect(app.fake.fulfillErrors).toEqual([]);
  await acknowledgeConsoleErrors(guard, { 'status of 400 ': 1, 'status of 403 ': 1 });
});

test('TEST-02 a switch without times keeps firing until it is removed and the fake server knows which contexts it serves', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), backend: null });
  const [user] = app.fake.users;
  await signIn(page, user);
  const f = app.fake.fault({ method: 'GET', path: /\/records$/, mode: 'refuse' });

  // 没有 times：每次都命中；路径可以是正则
  expect((await attempt(page, { kind: 'list' })).ok).toBe(false);
  expect((await attempt(page, { kind: 'list' })).ok).toBe(false);
  expect(f.hits).toBe(2);
  f.remove();
  expect(await attempt(page, { kind: 'list' })).toMatchObject({ ok: true, count: 1 });
  expect(f.hits, '撤掉之后不再命中').toBe(2);
  expect(app.fake.faultHits.map((h) => h.mode)).toEqual(['refuse', 'refuse']);

  expect(app.fake.isAttached(page.context())).toBe(true);
  const other = await page.context().browser()!.newContext();
  try {
    expect(app.fake.isAttached(other)).toBe(false);
  } finally {
    await other.close();
  }
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 2 });
});
