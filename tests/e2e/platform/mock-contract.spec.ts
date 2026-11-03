import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { ACCOUNT_DOC_PATH, ACCOUNT_USER_ID, CLAUDE_CONTRACT_VERSION } from '../../support/constants';

// 合成种子：快照形状用例用 local-seed.json 作为账户文档的内容
function loadSeed() {
  return JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'fixtures', 'local-seed.json'), 'utf8'));
}

// 契约自测（D-03）：证明 tests/mocks/claude-runtime.ts 的行为符合 Claude Artifact 运行时契约 0.2.96。
// 对照的条目和原文摘录都写在 tests/mocks/CONTRACT.md 里。
// 每条页面用例先在账户模式下打开应用，再用 page.evaluate 检查页面里的 mock；
// evaluate 只返回可序列化的结果（布尔、字符串、数组），断言都在 Node 侧做。

test('MOCK-02 window.claude exposes only a frozen use() and unknown names resolve null', async ({ page, app }) => {
  await app.open({ mode: 'account' });

  const result = await page.evaluate(async () => {
    const w = window as any;
    const claude = w.claude;
    const use = claude.use;

    // 改写和删除：严格模式下会抛错，非严格模式下静默失败，两种都接受，只看最后对象有没有变
    try {
      claude.use = () => null;
    } catch (e) {}
    try {
      delete w.claude;
    } catch (e) {}

    // 名字表里没有的名字：包括对象上继承来的名字，都应该 resolve 为 null
    const unknownNames = ['nope', 'room', 'toString', 'constructor'];
    const resolved = await Promise.all(unknownNames.map((name) => claude.use(name)));

    return {
      keys: Object.keys(claude),
      frozen: Object.isFrozen(claude),
      sameObject: w.claude === claude,
      sameUse: w.claude.use === use,
      dbMember: typeof claude.db,
      unknown: resolved.map((value) => (value === null ? 'null' : typeof value)),
    };
  });

  expect(result.keys).toEqual(['use']);
  expect(result.frozen).toBe(true);
  // 改写和删除之后，window.claude 和它的 use 仍是原来的对象和函数
  expect(result.sameObject).toBe(true);
  expect(result.sameUse).toBe(true);
  // 契约：除 use 之外，window.claude 上的能力成员在任何时刻都是 undefined
  expect(result.dbMember).toBe('undefined');
  expect(result.unknown).toEqual(['null', 'null', 'null', 'null']);
});

test('MOCK-02 use() is asynchronous and memoizes served capabilities', async ({ page, app }) => {
  await app.open({ mode: 'account' });

  const result = await page.evaluate(async () => {
    const claude = (window as any).claude;

    // 在同一段同步代码里注册 then：契约规定命名空间不会在调用 use 的同步代码里到达
    let thenRan = false;
    const first = claude.use('db');
    const isPromise = first instanceof Promise;
    first.then(() => {
      thenRan = true;
    });
    const ranInSyncPart = thenRan;

    // 同一个名字两次 use 返回同一个 Promise，await 之后是同一个对象
    const names = ['db', 'user', 'downloads'];
    const samePromise: boolean[] = [];
    const sameValue: boolean[] = [];
    const served: boolean[] = [];
    for (const name of names) {
      const a = claude.use(name);
      const b = claude.use(name);
      samePromise.push(a === b);
      const [va, vb] = await Promise.all([a, b]);
      sameValue.push(va === vb);
      served.push(va !== null && typeof va === 'object');
    }
    return { isPromise, ranInSyncPart, thenRanLater: thenRan, samePromise, sameValue, served };
  });

  expect(result.isPromise).toBe(true);
  expect(result.ranInSyncPart).toBe(false);
  // 微任务之后回调确实执行了：说明上一条断言的 false 是“还没到”，不是“永远不来”
  expect(result.thenRanLater).toBe(true);
  expect(result.samePromise).toEqual([true, true, true]);
  expect(result.sameValue).toEqual([true, true, true]);
  expect(result.served).toEqual([true, true, true]);
});

test('MOCK-02 namespaces, document references and snapshots are frozen and shaped like DocumentSnapshot', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadSeed() });

  const missingPath = `data/users/${ACCOUNT_USER_ID}/missing`;
  const result = await page.evaluate(
    async (paths) => {
      const claude = (window as any).claude;
      const db = await claude.use('db');
      const user = await claude.use('user');
      const downloads = await claude.use('downloads');

      const ref = db.doc(paths.doc);
      const snap = await ref.get();
      const data1 = snap.data();
      const data2 = snap.data();
      const missing = await db.doc(paths.missing).get();

      return {
        namespacesFrozen: [db, user, downloads].map((ns: object) => Object.isFrozen(ns)),
        refFrozen: Object.isFrozen(ref),
        snapFrozen: Object.isFrozen(snap),
        dataFrozen: Object.isFrozen(data1),
        nestedFrozen: Object.isFrozen(data1.logs),
        metadataFrozen: Object.isFrozen(snap.metadata),
        keys: Object.keys(snap).sort(),
        id: snap.id,
        exists: snap.exists,
        sameData: data1 === data2,
        metadata: { fromCache: snap.metadata.fromCache, hasPendingWrites: snap.metadata.hasPendingWrites },
        refId: ref.id,
        refPath: ref.path,
        missingKeys: Object.keys(missing).sort(),
        missingId: missing.id,
        missingExists: missing.exists,
        missingData: typeof missing.data(),
      };
    },
    { doc: ACCOUNT_DOC_PATH, missing: missingPath },
  );

  expect(result.namespacesFrozen).toEqual([true, true, true]);
  expect(result.refFrozen).toBe(true);
  expect(result.refId).toBe('state');
  expect(result.refPath).toBe(ACCOUNT_DOC_PATH);
  expect(result.snapFrozen).toBe(true);
  expect(result.dataFrozen).toBe(true);
  expect(result.nestedFrozen).toBe(true);
  expect(result.metadataFrozen).toBe(true);
  // 契约的 DocumentSnapshot：恰好 id、exists、data、metadata 四个字段
  expect(result.keys).toEqual(['data', 'exists', 'id', 'metadata']);
  expect(result.exists).toBe(true);
  expect(result.id).toBe('state');
  expect(result.sameData).toBe(true);
  expect(result.metadata).toEqual({ fromCache: false, hasPendingWrites: false });
  // 同一用户下另一个不存在的文档：exists 为 false，data() 为 undefined
  expect(result.missingKeys).toEqual(['data', 'exists', 'id', 'metadata']);
  expect(result.missingId).toBe('missing');
  expect(result.missingExists).toBe(false);
  expect(result.missingData).toBe('undefined');
});

test('MOCK-02 db.doc() enforces the document path grammar synchronously', async ({ page, app }) => {
  await app.open({ mode: 'account' });

  // 必须同步抛 TypeError 的路径：奇数段、段数不够或过多、非法字符、. 和 ..、超长段、超长路径
  const invalid: Record<string, string> = {
    'three segments': `data/users/${ACCOUNT_USER_ID}`,
    'three segments again': 'a/b/c',
    'empty string': '',
    'un-awaited promise as a segment': 'data/users/[object Promise]/state',
    'dot segment': 'a/./b/c',
    'dot-dot segment': 'a/b/../c',
    'segment of 201 characters': `a/${'x'.repeat(201)}`,
    'eighteen segments': Array(18).fill('a').join('/'),
    'path longer than 1000': Array(6).fill('x'.repeat(190)).join('/'),
  };
  // 不抛的路径：真实的账户文档、最短的 2 段、每段用到全部特殊字符、段长 200 和段数 16 的边界
  const valid: Record<string, string> = {
    'account document': ACCOUNT_DOC_PATH,
    'two segments': 'tasks/t1',
    'special characters': 'a_b-c.d~e:f@g+h/_-.~:@+',
    'segment of 200 characters': `a/${'x'.repeat(200)}`,
    'sixteen segments': Array(16).fill('a').join('/'),
  };

  const result = await page.evaluate(
    async (cases) => {
      const db = await (window as any).claude.use('db');
      const outcome = (path: string) => {
        try {
          const ref = db.doc(path);
          return { threw: false, typeError: false, id: ref.id, path: ref.path };
        } catch (e) {
          return { threw: true, typeError: e instanceof TypeError, id: '', path: '' };
        }
      };
      return {
        invalid: Object.entries(cases.invalid).map(([name, p]) => ({ name, ...outcome(p as string) })),
        valid: Object.entries(cases.valid).map(([name, p]) => ({ name, ...outcome(p as string) })),
      };
    },
    { invalid, valid },
  );

  for (const item of result.invalid) {
    expect({ name: item.name, threw: item.threw, typeError: item.typeError }, '非法路径必须同步抛 TypeError').toEqual({
      name: item.name,
      threw: true,
      typeError: true,
    });
  }
  expect(result.invalid).toHaveLength(Object.keys(invalid).length);
  for (const item of result.valid) {
    const p = valid[item.name];
    expect({ name: item.name, threw: item.threw, id: item.id, path: item.path }, '合法路径不能抛错').toEqual({
      name: item.name,
      threw: false,
      id: p.split('/').pop(),
      path: p,
    });
  }
  expect(result.valid).toHaveLength(Object.keys(valid).length);
});

test('MOCK-02 user.id() resolves the configured synthetic id', async ({ page, app }) => {
  await app.open({ mode: 'account' });

  const id = await page.evaluate(async () => {
    const user = await (window as any).claude.use('user');
    return user.id();
  });
  expect(id).toBe(ACCOUNT_USER_ID);
});

test('MOCK-02 user.id() resolves null when the mock is configured without an id', async ({ page, app }) => {
  // 没有身份：应用会退回本地模式，所以就绪条件按本地算
  await app.open({ mode: 'account', userId: null, expectStore: 'local' });

  const id = await page.evaluate(async () => {
    const user = await (window as any).claude.use('user');
    return user.id();
  });
  expect(id).toBeNull();
});

test('MOCK-04 downloads.save accepts string, Blob and ArrayBuffer data and resolves status saved', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account' });

  const results = await page.evaluate(async () => {
    const downloads = await (window as any).claude.use('downloads');
    const encoder = new TextEncoder();
    const saved = [
      await downloads.save({ filename: 'synth-a.txt', data: 'SYNTH-a' }),
      await downloads.save({ filename: 'synth-b.txt', data: new Blob(['SYNTH-b']) }),
      await downloads.save({ filename: 'synth-c.txt', data: encoder.encode('SYNTH-c').buffer }),
    ];
    return saved.map((r: object) => ({ keys: Object.keys(r), status: (r as any).status, frozen: Object.isFrozen(r) }));
  });

  // 三次都返回冻结的、只有 status 字段的结果
  expect(results).toEqual(Array(3).fill({ keys: ['status'], status: 'saved', frozen: true }));
  // Node 侧记录的是解码后的文本，顺序与调用顺序一致
  expect(app.backend.downloads).toEqual([
    { filename: 'synth-a.txt', data: 'SYNTH-a' },
    { filename: 'synth-b.txt', data: 'SYNTH-b' },
    { filename: 'synth-c.txt', data: 'SYNTH-c' },
  ]);
});

test('MOCK-06 tests/mocks/CONTRACT.md names contract 0.2.96 and lists what the mock does not implement', async () => {
  const text = readFileSync(path.join(__dirname, '..', '..', 'mocks', 'CONTRACT.md'), 'utf8');

  // 版本号只从常量取：契约升级时改常量，这条用例会提醒同步改文档
  expect(text).toContain(CLAUDE_CONTRACT_VERSION);
  // 已实现和未实现两份清单，以及 D-02 要求写明的三类未实现条目
  for (const keyword of ['已实现', '未实现', 'onSnapshot', '错误码', '限流']) {
    expect(text, `CONTRACT.md 缺少关键词：${keyword}`).toContain(keyword);
  }

  // 不能带本机路径：Windows、macOS、Linux 的用户目录形式，以及契约来源所在的临时目录
  expect(text).not.toMatch(/[A-Za-z]:[\\/]+Users[\\/]/i);
  expect(text).not.toMatch(/\/Users\/[A-Za-z]/);
  expect(text).not.toMatch(/\/home\/[a-z_]/);
  expect(text).not.toContain('bundled-skills');
  expect(text).not.toContain('AppData');
});
