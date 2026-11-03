import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { CLAUDE_CONTRACT_VERSION } from '../../support/constants';

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
