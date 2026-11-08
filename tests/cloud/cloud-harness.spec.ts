// cloud 专属用例：只在 npm run test:cloud 里运行（默认的 npm test 的 testDir 是 ./tests/e2e，收不到这里）。
// 真实的 PocketBase SDK 0.28.1 在浏览器里同源加载，REST 由 Node 侧的 FakePbServer 接应；
// 页面里的断言一律由 page.evaluate 返回可序列化的结果，断言在 Node 侧做。
import { test, expect, type GuardHandle, type Page } from '../support/test';
import { APP_ORIGIN, PB_DOC_MAX_BYTES } from '../support/constants';
import { resolveHarnessMode } from '../support/app';

// 故意制造的 4xx 响应：Chromium 会为每一条写一条 console.error（Failed to load resource）。
// 先断言恰好是预期的这几条（状态码 -> 条数），再用 guard.remove 删掉；其他任何 console.error 或页面异常仍会让用例失败。
async function acknowledgeHttpErrors(guard: GuardHandle, expected: Record<number, number>) {
  const total = Object.values(expected).reduce((sum, n) => sum + n, 0);
  await expect.poll(() => guard.state.consoleErrors.length, { message: '等待浏览器报出预期的 4xx' }).toBe(total);
  for (const [status, count] of Object.entries(expected)) {
    const needle = `status of ${status} `;
    expect(guard.state.consoleErrors.filter((text) => text.includes(needle))).toHaveLength(count);
    expect(guard.remove('consoleErrors', needle)).toBe(count);
  }
}

// 合成 state：带 _synthetic 标记和一条合成记录；label 区分不同账号
function syntheticState(label: string) {
  return {
    _synthetic: true,
    logs: [{ id: `synthetic-${label}`, date: '2026-03-17', cat: '语言', text: `合成记录 ${label}` }],
  };
}

test('TEST-02 the real SDK signs in to the fake server and lists only its own documents', async ({ app, page }) => {
  await app.open({ mode: 'cloud', users: 2 });
  app.fake.seed(syntheticState('a'), { userIndex: 0 });
  app.fake.seed(syntheticState('b'), { userIndex: 1 });
  const [first] = app.fake.users;

  const result = await page.evaluate(
    async ({ origin, email, password }) => {
      const pb = new (window as any).PocketBase(origin);
      pb.autoCancellation(false);
      await pb.collection('users').authWithPassword(email, password);
      const docs = await pb.collection('journey_docs').getFullList();
      return {
        valid: pb.authStore.isValid as boolean,
        ids: docs.map((d: any) => d.id as string),
        owners: docs.map((d: any) => d.owner as string),
        kinds: docs.map((d: any) => d.kind as string),
      };
    },
    { origin: APP_ORIGIN, email: first.email, password: first.password },
  );

  expect(result.valid, '固定时钟下假令牌应当被 SDK 判为有效').toBe(true);
  expect(result.ids).toHaveLength(1);
  expect(result.owners).toEqual([first.id]);
  expect(result.kinds).toEqual(['state']);
  expect(app.fake.reads).toEqual(['journey_docs:state']);
  expect(app.fake.requests.map((r) => r.status)).toEqual([200, 200]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('TEST-02 the real SDK creates and updates its own documents and the fake server records reads and writes', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a') });
  const [user] = app.fake.users;
  const newPlan = { _synthetic: true, goals: ['合成目标'] };
  const newState = syntheticState('a-updated');

  const result = await page.evaluate(
    async ({ origin, email, password, planData, stateData }) => {
      const pb = new (window as any).PocketBase(origin);
      pb.autoCancellation(false);
      await pb.collection('users').authWithPassword(email, password);
      const docs = pb.collection('journey_docs');
      const [stateDoc] = await docs.getFullList();
      const viewed = await docs.getOne(stateDoc.id);
      const plan = await docs.create({ owner: pb.authStore.record.id, kind: 'plan', data: planData, writer: 'device-a' });
      const updated = await docs.update(stateDoc.id, { data: stateData, writer: 'device-a' });
      return {
        viewedId: viewed.id as string,
        stateId: stateDoc.id as string,
        planOwner: plan.owner as string,
        planKind: plan.kind as string,
        planData: plan.data,
        stateCreated: stateDoc.created as string,
        stateUpdated: updated.updated as string,
        updatedWriter: updated.writer as string,
      };
    },
    { origin: APP_ORIGIN, email: user.email, password: user.password, planData: newPlan, stateData: newState },
  );

  expect(result.viewedId).toBe(result.stateId);
  expect(result.planOwner).toBe(user.id);
  expect(result.planKind).toBe('plan');
  expect(result.planData).toEqual(newPlan);
  expect(result.updatedWriter).toBe('device-a');
  expect(result.stateUpdated > result.stateCreated, '更新后的 updated 应当晚于 created').toBe(true);
  expect(app.fake.reads).toEqual(['journey_docs:state', 'journey_docs:state']);
  expect(app.fake.writes.map((w) => w.path)).toEqual(['journey_docs:plan', 'journey_docs:state']);
  expect(app.fake.lastState()).toEqual(newState);
  expect(app.fake.lastPlan()).toEqual(newPlan);
  // AppHarness 的 saved() 在 cloud 下取最后一条 state 写入
  expect(await app.saved()).toEqual(newState);
  expect(app.fake.requests.every((r) => r.status === 200)).toBe(true);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('TEST-02 the fake server rejects another owner, a duplicate kind, an owner or kind key in an update, an oversized document and any delete', async ({
  app,
  page,
  guard,
}) => {
  const seedA = syntheticState('a');
  const seedB = syntheticState('b');
  await app.open({ mode: 'cloud', users: 2 });
  app.fake.seed(seedA, { userIndex: 0 });
  app.fake.seed(seedB, { userIndex: 1 });
  const [userA, userB] = app.fake.users;
  // 第 1 个账号的 state 文档 id：Node 侧以它自己的身份列出
  const listedB = await app.fake.request(1, 'GET', '/api/collections/journey_docs/records');
  const otherDocId = (listedB.body as { items: Array<{ id: string }> }).items[0].id;

  const result = await page.evaluate(
    async ({ origin, email, password, otherId, otherOwner, maxBytes }) => {
      const pb = new (window as any).PocketBase(origin);
      pb.autoCancellation(false);
      await pb.collection('users').authWithPassword(email, password);
      const docs = pb.collection('journey_docs');
      const ownId = pb.authStore.record.id as string;
      const [own] = await docs.getFullList();
      // 把失败整理成可序列化的 { status, codes }：codes 是每个出错字段的错误码
      const out: Record<string, { status: number; codes: Record<string, string> }> = {};
      const run = async (name: string, fn: () => Promise<unknown>) => {
        try {
          await fn();
          out[name] = { status: 200, codes: {} };
        } catch (e: any) {
          const data = e.response?.data ?? {};
          out[name] = {
            status: e.status as number,
            codes: Object.fromEntries(Object.entries(data).map(([key, value]: [string, any]) => [key, value.code])),
          };
        }
      };
      await run('otherOwner', () => docs.create({ owner: otherOwner, kind: 'plan', data: {} }));
      await run('duplicate', () => docs.create({ owner: ownId, kind: 'state', data: {} }));
      await run('badKind', () => docs.create({ owner: ownId, kind: 'note', data: {} }));
      await run('longWriter', () => docs.create({ owner: ownId, kind: 'plan', data: {}, writer: 'w'.repeat(41) }));
      // JSON 序列化后正好比上限多 1 字节：字符串内容加两个引号
      await run('oversized', () => docs.create({ owner: ownId, kind: 'plan', data: 'x'.repeat(maxBytes - 1) }));
      await run('updateOwner', () => docs.update(own.id, { owner: ownId, data: {} }));
      await run('updateKind', () => docs.update(own.id, { kind: 'state', data: {} }));
      await run('updateOther', () => docs.update(otherId, { data: {} }));
      await run('viewOther', () => docs.getOne(otherId));
      await run('deleteOwn', () => docs.delete(own.id));
      await run('deleteOther', () => docs.delete(otherId));
      return out;
    },
    {
      origin: APP_ORIGIN,
      email: userA.email,
      password: userA.password,
      otherId: otherDocId,
      otherOwner: userB.id,
      maxBytes: PB_DOC_MAX_BYTES,
    },
  );

  expect(result.otherOwner.status).toBe(400);
  expect(result.duplicate).toEqual({
    status: 400,
    codes: { owner: 'validation_not_unique', kind: 'validation_not_unique' },
  });
  expect(result.badKind.status).toBe(400);
  expect(result.badKind.codes.kind).toBe('validation_invalid_value');
  expect(result.longWriter.status).toBe(400);
  expect(result.longWriter.codes.writer).toBe('validation_max_text_constraint');
  expect(result.oversized.status).toBe(400);
  expect(result.oversized.codes.data).toBe('validation_json_size_limit');
  expect(result.updateOwner.status, '更新请求体里带 owner 键（值相同也算）是 404').toBe(404);
  expect(result.updateKind.status).toBe(404);
  expect(result.updateOther.status).toBe(404);
  expect(result.viewOther.status).toBe(404);
  expect(result.deleteOwn.status).toBe(403);
  expect(result.deleteOther.status).toBe(403);

  // 每次拒绝之后 Node 侧回读：数据一个字没变，也没有写入记录
  expect(app.fake.lastState(0)).toEqual(seedA);
  expect(app.fake.lastState(1)).toEqual(seedB);
  expect(app.fake.lastPlan(0)).toBeNull();
  expect(app.fake.lastPlan(1)).toBeNull();
  expect(app.fake.writes).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
  // 5 条 400（创建的五种拒绝）、4 条 404（更新两条带键、更新别人的、查看别人的）、2 条 403（两次删除）
  await acknowledgeHttpErrors(guard, { 400: 5, 404: 4, 403: 2 });
});

test('TEST-02 an invalid token is anonymous on record routes and only auth-refresh answers 401', async ({ app, page, guard }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a') });
  const [user] = app.fake.users;

  const result = await page.evaluate(
    async ({ origin, email, password }) => {
      const pb = new (window as any).PocketBase(origin);
      pb.autoCancellation(false);
      await pb.collection('users').authWithPassword(email, password);
      const docs = pb.collection('journey_docs');
      const [own] = await docs.getFullList();
      const ownId = pb.authStore.record.id as string;
      // 有效令牌的 auth-refresh：200，SDK 会把新令牌存进 authStore
      const refreshed = await pb.collection('users').authRefresh();
      const refreshedOk = { id: refreshed.record.id as string, hasToken: typeof refreshed.token === 'string' };
      // 篡改令牌：把最后一个字符换掉
      const token = pb.authStore.token as string;
      const last = token.slice(-1);
      pb.authStore.save(token.slice(0, -1) + (last === 'A' ? 'B' : 'A'), pb.authStore.record);
      const attempt = async (run: () => Promise<any>) => {
        try {
          const value = await run();
          return { status: 200, value, message: '' };
        } catch (e: any) {
          return { status: e.status as number, value: null, message: (e.response?.message ?? '') as string };
        }
      };
      const list = await attempt(() => docs.getFullList());
      const view = await attempt(() => docs.getOne(own.id));
      const create = await attempt(() => docs.create({ owner: ownId, kind: 'plan', data: {} }));
      const refresh = await attempt(() => pb.collection('users').authRefresh());
      return {
        refreshedOk,
        listStatus: list.status,
        listLength: (list.value as any[]).length,
        viewStatus: view.status,
        createStatus: create.status,
        refreshStatus: refresh.status,
        refreshMessage: refresh.message,
      };
    },
    { origin: APP_ORIGIN, email: user.email, password: user.password },
  );

  expect(result.refreshedOk).toEqual({ id: user.id, hasToken: true });
  expect(result.listStatus).toBe(200);
  expect(result.listLength).toBe(0);
  expect(result.viewStatus).toBe(404);
  expect(result.createStatus).toBe(400);
  expect(result.refreshStatus).toBe(401);
  expect(result.refreshMessage).toBe('The request requires valid record authorization token.');
  expect(app.fake.writes).toEqual([]);
  // 查看 404、创建 400、auth-refresh 401 各一条
  await acknowledgeHttpErrors(guard, { 404: 1, 400: 1, 401: 1 });
});

test('TEST-02 a request cancelled by the SDK does not fail the test', async ({ app, page, guard }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a') });
  const [user] = app.fake.users;

  // 默认的自动取消是开着的：同一个 requestKey 连发两次，第一次会被 SDK 取消
  const result = await page.evaluate(
    async ({ origin, email, password }) => {
      const pb = new (window as any).PocketBase(origin);
      await pb.collection('users').authWithPassword(email, password);
      const first = pb.collection('journey_docs').getList(1, 10);
      const second = pb.collection('journey_docs').getList(1, 10);
      const settled = await Promise.allSettled([first, second]);
      return settled.map((s: any) => ({ status: s.status as string, isAbort: s.reason?.isAbort === true }));
    },
    { origin: APP_ORIGIN, email: user.email, password: user.password },
  );

  expect(result[0]).toEqual({ status: 'rejected', isAbort: true });
  expect(result[1]).toEqual({ status: 'fulfilled', isAbort: false });
  // fulfill 抛出的异常（请求已取消）记进 fulfillErrors，不吞掉；它们只可能来自这条被取消的列表请求
  for (const e of app.fake.fulfillErrors) {
    expect(e.path).toBe('/api/collections/journey_docs/records');
  }
  expect(app.fake.fulfillErrors.length).toBeLessThanOrEqual(1);
  // 观察值写进用例注释，供 SUMMARY 引用：被取消的请求有没有走到 fulfill 抛错这一步取决于时序
  test.info().annotations.push({ type: 'observed', description: 'fulfillErrors=' + app.fake.fulfillErrors.length });
  expect(guard.state.pageErrors).toEqual([]);
});

test('TEST-02 the harness maps account mode to cloud only when USJ_TEST_MODE is cloud', async () => {
  expect(resolveHarnessMode('account', 'cloud')).toBe('cloud');
  expect(resolveHarnessMode('account', undefined)).toBe('account');
  expect(resolveHarnessMode('local', 'cloud')).toBe('local');
  expect(resolveHarnessMode('cloud', undefined)).toBe('cloud');
});

// 页面里登录并订阅 journey_docs 的 *：事件推进 window.__events，pb 存在 window.__pb 上供后续 evaluate 使用
async function signInAndSubscribe(
  page: Page,
  creds: { email: string; password: string },
): Promise<string> {
  return page.evaluate(
    async ({ origin, email, password }) => {
      const w = window as any;
      const pb = new w.PocketBase(origin);
      pb.autoCancellation(false);
      w.__pb = pb;
      w.__events = [];
      await pb.collection('users').authWithPassword(email, password);
      const [own] = await pb.collection('journey_docs').getFullList();
      await pb.collection('journey_docs').subscribe(
        '*',
        (e: any) => w.__events.push({ action: e.action as string, keys: Object.keys(e.record).sort(), id: e.record.id as string }),
        { fields: 'id,kind,writer,updated' },
      );
      return own.id as string;
    },
    { origin: APP_ORIGIN, ...creds },
  );
}

type PageEvent = { action: string; keys: string[]; id: string };
const readEvents = (page: Page) =>
  page.evaluate(() => (window as any).__events as PageEvent[]);
const updateOwn = (page: Page, id: string, label: string) =>
  page.evaluate(
    ([docId, text]) => (window as any).__pb.collection('journey_docs').update(docId, { writer: text }).then(() => null),
    [id, label],
  );

test("TEST-02 a subscription gets its own account's changes with the requested fields and nothing from another account", async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', users: 2 });
  app.fake.seed(syntheticState('a'), { userIndex: 0 });
  app.fake.seed(syntheticState('b'), { userIndex: 1 });
  const [userA, userB] = app.fake.users;
  const listedB = await app.fake.request(1, 'GET', '/api/collections/journey_docs/records');
  const otherDocId = (listedB.body as { items: Array<{ id: string }> }).items[0].id;

  const ownId = await signInAndSubscribe(page, userA);
  expect(app.fake.connectionCount()).toBe(1);

  // 自己更新自己的 state：回调恰好收到 1 条 update，record 的键恰好是请求的 4 个
  await updateOwn(page, ownId, 'device-a-1');
  await expect.poll(() => readEvents(page)).toHaveLength(1);
  expect((await readEvents(page))[0]).toEqual({
    action: 'update',
    keys: ['id', 'kind', 'updated', 'writer'],
    id: ownId,
  });

  // Node 侧以第 1 个账号的身份更新它自己的文档：第 0 个账号的订阅不应收到
  await app.fake.request(1, 'PATCH', '/api/collections/journey_docs/records/' + otherDocId, { writer: 'device-b' });
  // 正向对照：第 0 个账号随后的又一次更新照常到达。“收不到”的断言放在它之后，顺序是确定的
  await updateOwn(page, ownId, 'device-a-2');
  await expect.poll(() => readEvents(page)).toHaveLength(2);
  expect((await readEvents(page)).map((e) => e.id)).toEqual([ownId, ownId]);

  // 显式 emit：owner 为第 1 个账号的记录收不到，owner 为第 0 个账号的记录收得到
  await app.fake.emit(1, 'update', { id: otherDocId, kind: 'state', writer: 'emit-b', updated: 'x' });
  await app.fake.emit(0, 'create', { id: 'emitted00000001', kind: 'plan', writer: 'emit-a', updated: 'y', data: {} });
  await expect.poll(() => readEvents(page)).toHaveLength(3);
  const events = await readEvents(page);
  expect(events[2]).toEqual({ action: 'create', keys: ['id', 'kind', 'updated', 'writer'], id: 'emitted00000001' });
  expect(events.map((e) => e.id)).not.toContain(otherDocId);
  expect(userB.id).not.toBe(userA.id);
  expect(app.fake.deliveryErrors).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('TEST-02 the page EventSource is the fake one and closing it unregisters the client', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a') });
  const [user] = app.fake.users;
  expect(await page.evaluate(() => (window as any).EventSource.name)).toBe('FakeEventSource');
  expect(app.fake.connectionCount()).toBe(0);

  await signInAndSubscribe(page, user);
  expect(app.fake.connectionCount()).toBe(1);

  // 取消全部订阅之后 SDK 关闭连接，Node 侧这个连接被注销
  await page.evaluate(() => (window as any).__pb.collection('journey_docs').unsubscribe());
  await expect.poll(() => app.fake.connectionCount()).toBe(0);
  expect(app.fake.deliveryErrors).toEqual([]);
});
