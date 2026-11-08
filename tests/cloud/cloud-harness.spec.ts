// cloud 专属用例：只在 npm run test:cloud 里运行（默认的 npm test 的 testDir 是 ./tests/e2e，收不到这里）。
// 真实的 PocketBase SDK 0.28.1 在浏览器里同源加载，REST 由 Node 侧的 FakePbServer 接应；
// 页面里的断言一律由 page.evaluate 返回可序列化的结果，断言在 Node 侧做。
import { test, expect } from '../support/test';
import { APP_ORIGIN } from '../support/constants';

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
