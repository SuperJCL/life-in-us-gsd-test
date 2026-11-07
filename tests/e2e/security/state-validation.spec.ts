// importProblem 与 normalize 的单元用例（SEC-01、PLAN-05，D-07、D-08）。
// 这是 Node 侧的单元用例：用 loadAppPure 在 node:vm 里求值应用的纯函数段，不开页面（本机资源有限，见 app-source.ts）。
// 页面路径（导入整份拒绝、加载修正）由 id-whitelist.spec.ts 覆盖，两条路径不互相替代。
// 期望值在本文件里独立写出（从 fixture 的深拷贝改出一处变体），不抄应用的实现；失败消息只写变体名。
// 数据全是合成的（SYNTH 开头），变体名不含任何个人计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { loadFixture } from '../../support/fixture-files';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';

// JSON 往返：把 vm 里的对象换成本 realm 的普通对象再比较
const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

// 每次从 full-state.json 取一份新的深拷贝
const fresh = (): any => loadFixture('full-state.json');

function malformed(name: string): unknown {
  const m = MALFORMED_IMPORTS.find((x) => x.name === name);
  expect(m, `需要 ${name}`).toBeDefined();
  return JSON.parse(m!.text);
}

test('SEC-01 the import check rejects any malformed id or date and accepts well-formed, empty and type-mismatched backups', async () => {
  const { importProblem, normalize } = loadAppPure(['importProblem', 'normalize']);

  // 1. 合格的备份：四个 fixture 加 07-02 的位置 id 备份都没有问题
  for (const name of [
    'full-state.json',
    'legacy-categories.json',
    'local-seed.json',
    'minimal-state.json',
    'legacy-positional-backup.json',
  ]) {
    expect(importProblem(loadFixture(name)), `${name} 应当通过`).toBeNull();
  }

  // 2. 点名的 5 个 v1 输入：返回 null，交给 v1 路径
  expect(importProblem({}), '{}（N3）').toBeNull();
  expect(importProblem({ logs: [] }), '{ logs: [] }（B2）').toBeNull();
  for (const name of ['synth-null.json', 'synth-array.json', 'synth-wrong-types.json']) {
    expect(importProblem(malformed(name)), name).toBeNull();
  }
  // synth-null.json 照旧由 v1 的 normalize 抛错（页面上显示格式错误）
  expect(() => normalize(null), 'normalize(null) 照旧抛错').toThrow();

  // 3. 每一种不合格的条目都整份拒绝
  const variants: Record<string, (s: any) => void> = {
    'log id with a quote': (s) => (s.logs[0].id = 'SYNTH-"bad'),
    'log id empty': (s) => (s.logs[0].id = ''),
    'log date 2026-3-5': (s) => (s.logs[0].date = '2026-3-5'),
    'log date missing': (s) => delete s.logs[0].date,
    'log not an object': (s) => (s.logs[0] = 'SYNTH-not-an-object'),
    'custom id without c- prefix': (s) => (s.custom[0].id = 'x-synth'),
    'custom id with a quote': (s) => (s.custom[0].id = 'c-SYNTH"bad'),
    'custom group with angle brackets': (s) => (s.custom[0].group = '<b>'),
    'task key with a quote': (s) => (s.tasks['P1-1"x'] = { done: true }),
    'task due soon': (s) => (s.tasks['P1-2'].due = 'soon'),
    'task doneDate a number': (s) => (s.tasks['P1-1'].doneDate = 20260312),
    'lift key Bench': (s) => (s.lifts.Bench = { cur: 1, hist: [] }),
    'lift history date malformed': (s) => (s.lifts.bench.hist[0].date = '03/02/2026'),
    'review key week-1': (s) => (s.reviews['week-1'] = 'SYNTH-review'),
    'arrival soon': (s) => (s.arrival = 'soon'),
    // 类型不对、但能识别出条目的容器同样检查
    'logs as a plain object with a bad id': (s) => (s.logs = { a: { id: 'SYNTH"bad', date: '2026-03-16', text: 'SYNTH' } }),
    'custom as a plain object with a bad id': (s) => (s.custom = { a: { id: 'x-synth', group: 'P1', text: 'SYNTH' } }),
    'tasks as a non-empty array': (s) => (s.tasks = [{ done: true }]),
    'reviews as a non-empty array': (s) => (s.reviews = ['SYNTH-review']),
  };
  for (const [name, mutate] of Object.entries(variants)) {
    const s = fresh();
    mutate(s);
    expect(importProblem(s), `${name} 应当被拒绝`).not.toBeNull();
  }

  // 空数组没有键，通过
  const emptyArrays = fresh();
  emptyArrays.tasks = [];
  emptyArrays.reviews = [];
  expect(importProblem(emptyArrays), '空数组形式的 tasks、reviews').toBeNull();

  // 4. 原始值形式的容器识别不出条目：返回 null，并且 v1 normalize 把它们丢弃，没有坏 id 进入 state
  const rawContainers = { logs: 'SYNTH-"bad-log-id', custom: 7, tasks: 'SYNTH-"bad-task-key', arrival: 5 };
  expect(importProblem(rawContainers), '原始值形式的容器').toBeNull();
  const out = plain(normalize(rawContainers));
  expect(out.logs).toEqual([]);
  expect(out.custom).toEqual([]);
  expect(out.tasks).toEqual({});
  expect(out.arrival).toBe('');
  const json = JSON.stringify(out);
  expect(json.includes('bad-log-id'), '坏的 logs 原始值不应进入 state').toBe(false);
  expect(json.includes('bad-task-key'), '坏的 tasks 原始值不应进入 state').toBe(false);
});
