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
  const { importProblem, normalize, classifyBackup } = loadAppPure(['importProblem', 'normalize', 'classifyBackup', 'legacyShape']);

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

  // 2. 点名的 5 个 v1 输入：importProblem 对它们仍返回 null（它只查条目）；外层的 classifyBackup 拒绝它们（N3，Phase 11 起两条路径共用识别），
  //    只有 { logs: [] } 是合格的最小旧备份
  expect(importProblem({}), '{}（N3）').toBeNull();
  expect(importProblem({ logs: [] }), '{ logs: [] }（B2）').toBeNull();
  for (const name of ['synth-null.json', 'synth-array.json', 'synth-wrong-types.json']) {
    expect(importProblem(malformed(name)), name).toBeNull();
  }
  // synth-null.json 照旧由 v1 的 normalize 抛错；页面上它在 normalize 之前就被 classifyBackup 拒绝（显示格式错误）
  expect(() => normalize(null), 'normalize(null) 照旧抛错').toThrow();
  expect(classifyBackup({}), '{}（N3）被识别拒绝').toBeNull();
  expect(plain(classifyBackup({ logs: [] })), '{ logs: [] } 是合格的最小旧备份').toEqual({ kind: 'legacy', state: { logs: [] } });
  for (const name of ['synth-null.json', 'synth-array.json', 'synth-wrong-types.json']) {
    expect(classifyBackup(malformed(name)), `${name} 被识别拒绝`).toBeNull();
  }

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
    // WR-06：格式合格但日历上不存在的日期同样整份拒绝
    'log date 2026-02-31': (s) => (s.logs[0].date = '2026-02-31'),
    'log date 2026-02-29 in a non-leap year': (s) => (s.logs[0].date = '2026-02-29'),
    'task due 2026-04-31': (s) => (s.tasks['P1-2'].due = '2026-04-31'),
    'task doneDate 2026-02-30': (s) => (s.tasks['P1-1'].doneDate = '2026-02-30'),
    'lift history date 2026-02-31': (s) => (s.lifts.bench.hist[0].date = '2026-02-31'),
    'review key 2026-02-31': (s) => (s.reviews['2026-02-31'] = 'SYNTH-review'),
    'arrival 2026-02-31': (s) => (s.arrival = '2026-02-31'),
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

// ---------- D-08：加载时的深度修正 ----------

// 独立写出的格式（不抄应用的正则）
const LOG_ID = /^[A-Za-z0-9_-]{1,64}$/;
const CUSTOM_ID = /^c-[A-Za-z0-9_-]{1,60}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

test('SEC-01 stored data with malformed ids, dates and values is repaired on load without losing any log text', async () => {
  const { normalize, importProblem, today } = loadAppPure(['normalize', 'importProblem', 'today', 'DEFAULT_PLAN', 'usePlan']);
  const norm = (s: unknown) => plain(normalize(s));

  // 1. 对合格数据是恒等的、重复执行结果不变
  for (const name of ['full-state.json', 'local-seed.json', 'minimal-state.json', 'legacy-positional-backup.json']) {
    const original = loadFixture(name);
    delete original._synthetic;
    const once = norm(original);
    // minimal-state.json 是 {}，v1 的 normalize 本来就会补齐七个顶层键的默认值；其余 fixture 本来就带齐七个键
    const expected = { arrival: '', tasks: {}, custom: [], logs: [], lifts: {}, reviews: {}, presets: {}, ...original };
    expect(once, `${name} 经 normalize 后应与原文（补齐默认顶层键）深度相等`).toEqual(expected);
    expect(norm(once), `${name} 重复执行结果不变`).toEqual(once);
  }

  // 2. 记录：坏 id、坏日期、缺 id、数字文字、缺文字、字符串形式、数组形式、旧类别名
  const logs: unknown[] = [
    { id: 'SYNTH"quote', date: '2026-03-16', cat: '语言', text: 'SYNTH-L1 quoted id' },
    { id: 'synth-l2', date: '2026-3-5', cat: '专业', text: 'SYNTH-L2 bad date' },
    { date: '2026-03-17', cat: '专业', text: 'SYNTH-L3 missing id' },
    { id: 'synth-l4', date: '2026-03-17', cat: '专业', text: 12345 },
    { id: 'synth-l5', date: '2026-03-17', cat: '求职' },
    'SYNTH-L6 string entry',
    ['SYNTH-array-item'],
    { id: 'bad id!', date: 'bad', text: 'SYNTH-L8 both bad' },
    null,
    true,
    [],
    { id: 'synth-l9', date: '2026-03-17', cat: '学习', text: 'SYNTH-L9 legacy category' },
  ];
  const discarded = 3; // null、true、[] 不带任何用户文字
  const out = norm({ logs });
  expect(out.logs.length, '带文字的记录一条不少').toBe(logs.length - discarded);
  for (const l of out.logs) {
    expect(LOG_ID.test(l.id), '记录 id 合格').toBe(true);
    expect(DATE.test(l.date), '记录日期合格').toBe(true);
    expect(typeof l.text).toBe('string');
  }
  const byText = (needle: string) => out.logs.find((l: any) => l.text.includes(needle));
  expect(out.logs.map((l: any) => l.text)).toEqual([
    'SYNTH-L1 quoted id',
    'SYNTH-L2 bad date',
    'SYNTH-L3 missing id',
    '12345',
    '',
    'SYNTH-L6 string entry',
    '["SYNTH-array-item"]',
    'SYNTH-L8 both bad',
    'SYNTH-L9 legacy category',
  ]);
  expect(byText('SYNTH-L1').id).not.toBe('SYNTH"quote');
  expect(byText('SYNTH-L1').date).toBe('2026-03-16');
  expect(byText('SYNTH-L2').date).toBe(today());
  expect(byText('SYNTH-L2').id).toBe('synth-l2');
  expect(byText('SYNTH-L3').date).toBe('2026-03-17');
  expect(byText('SYNTH-L6').cat).toBe('其他');
  expect(byText('SYNTH-L6').date).toBe(today());
  expect(byText('SYNTH-array-item').cat).toBe('其他');
  expect(byText('SYNTH-L8').cat).toBe('其他');
  expect(byText('SYNTH-L8').id).not.toBe('bad id!');
  expect(byText('SYNTH-L9').cat).toBe('专业');
  expect(importProblem(out), '修正后的结果能通过导入检查').toBeNull();

  // 2b. WR-06：格式合格但不存在的日期按坏日期修正（记录改成今天、任务日期清空、抵达日期清空），不删记录；闰日 2024-02-29 保留
  const impossible = norm({
    arrival: '2026-02-31',
    logs: [
      { id: 'synth-d1', date: '2026-02-31', cat: '语言', text: 'SYNTH-D1 impossible date' },
      { id: 'synth-d2', date: '2024-02-29', cat: '语言', text: 'SYNTH-D2 leap day' },
    ],
    tasks: { 'P1-1': { done: true, doneDate: '2026-04-31', due: '2026-02-30' } },
  });
  expect(impossible.arrival, '不存在的抵达日期清空').toBe('');
  expect(impossible.logs.map((l: any) => l.text), '带文字的记录一条不少').toEqual(['SYNTH-D1 impossible date', 'SYNTH-D2 leap day']);
  expect(impossible.logs[0].date, '不存在的日期改成今天').toBe(today());
  expect(impossible.logs[1].date, '真实存在的闰日保留').toBe('2024-02-29');
  expect(impossible.tasks['P1-1'], '不存在的任务日期变空串').toEqual({ done: true, doneDate: '', due: '' });
  expect(importProblem(impossible), '修正后的结果能通过导入检查').toBeNull();

  // 3. 自定义待办：坏 id 换成 c- 开头的新 id，进度跟着搬；坏 group 落到“其他”组（P7）；孤儿进度键一律丢弃
  const messy = {
    custom: [
      { id: 'bad id', group: 'P2', text: 'SYNTH-C1 bad id' },
      { id: 'c-synth-ok', group: '<b>', text: 'SYNTH-C2 bad group' },
      'SYNTH-C3 string entry',
      ['SYNTH-C4'],
      null,
      false,
    ],
    tasks: {
      'bad id': { done: true, doneDate: '2026-03-12' },
      'c-synth-ok': { due: '2026-03-25' },
      'P1-1': { done: true, doneDate: '2026-03-12' },
      'P9-9': { done: true },
      't-synth': { done: true },
      'P1-2"x': { done: true },
      'P1-2': { done: 1, doneDate: 'soon', due: 7 },
      'P2-1': 'not-an-object',
    },
  };
  const fixed = norm(messy);
  expect(fixed.custom.length, '带文字的待办一条不少').toBe(4);
  const c1 = fixed.custom.find((c: any) => c.text === 'SYNTH-C1 bad id');
  expect(CUSTOM_ID.test(c1.id)).toBe(true);
  expect(c1.id).not.toBe('bad id');
  expect(c1.group).toBe('P2');
  expect(fixed.custom.find((c: any) => c.text === 'SYNTH-C2 bad group').group).toBe('P7');
  expect(fixed.custom.find((c: any) => c.text === 'SYNTH-C2 bad group').id).toBe('c-synth-ok');
  expect(fixed.custom.find((c: any) => c.text === 'SYNTH-C3 string entry').group).toBe('P7');
  expect(fixed.custom.find((c: any) => c.text.includes('SYNTH-C4')).group).toBe('P7');
  for (const c of fixed.custom) expect(CUSTOM_ID.test(c.id), '待办 id 合格').toBe(true);
  expect(Object.keys(fixed.tasks).sort()).toEqual([c1.id, 'c-synth-ok', 'P1-1', 'P1-2'].sort());
  expect(fixed.tasks[c1.id]).toEqual({ done: true, doneDate: '2026-03-12' });
  expect(fixed.tasks['c-synth-ok']).toEqual({ due: '2026-03-25' });
  expect(fixed.tasks['P1-1']).toEqual({ done: true, doneDate: '2026-03-12' });
  expect(fixed.tasks['P1-2'], '非布尔 done 转成布尔，不合格的日期变空串').toEqual({ done: true, doneDate: '', due: '' });
  for (const orphan of ['P9-9', 't-synth', 'P1-2"x', 'bad id', 'P2-1']) {
    expect(Object.keys(fixed.tasks).includes(orphan), `孤儿或坏进度键 ${orphan} 应当被丢弃`).toBe(false);
  }

  // 4. 力量、arrival、复盘、预设
  const rest = norm({
    arrival: 'soon',
    lifts: {
      bench: {
        cur: 'abc',
        hist: [{ date: '2026-03-02', v: 38 }, { date: 'bad', v: 40 }, { date: '2026-03-09', v: 'x' }, 'junk'],
      },
      Squat: { cur: 5 },
      squat: { cur: 60, hist: 'oops' },
      dead: 'str',
    },
    reviews: { '2026-03-16': 'SYNTH-R text', week: 42, x: { a: 1 }, y: null },
    presets: { 语言: { add: ['SYNTH-a', 5, null], hide: 'x' }, 健身: 'bad' },
  });
  expect(rest.arrival).toBe('');
  expect(Object.keys(rest.lifts).sort()).toEqual(['bench', 'squat']);
  expect(rest.lifts.bench).toEqual({ hist: [{ date: '2026-03-02', v: 38 }] });
  expect(rest.lifts.squat).toEqual({ cur: 60, hist: [] });
  expect(rest.reviews).toEqual({ '2026-03-16': 'SYNTH-R text', week: '42' });
  expect(rest.presets).toEqual({ 语言: { add: ['SYNTH-a'] } });

  // 5. 重复执行结果不变（修正后的新 id 已合格）
  const again = norm({ logs, custom: messy.custom, tasks: messy.tasks });
  expect(norm(again)).toEqual(again);
});

test('PLAN-05 backups with g-, t- and l- prefixed ids pass the import check and survive normalize', async () => {
  const { normalize, importProblem, DEFAULT_PLAN, usePlan } = loadAppPure([
    'normalize',
    'importProblem',
    'DEFAULT_PLAN',
    'usePlan',
  ]);
  const norm = (s: unknown) => plain(normalize(s));
  const synthetic: any = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  synthetic.groups.push({ id: 'g-synth1', cat: '语言', name: 'SYNTH group', tasks: [{ id: 't-synth1', text: 'SYNTH task' }] });
  synthetic.lifts.push({ id: 'l-synth1', n: 'SYNTH lift', unit: 'kg', def: 1, target: 2 });
  expect(usePlan(synthetic), '带前缀的合成计划应被接受').toBe(true);

  const backup = () => ({
    arrival: '2026-01-12',
    logs: [],
    custom: [{ id: 'c-synth-1', group: 'g-synth1', text: 'SYNTH custom in a new group' }],
    tasks: {
      't-synth1': { done: true, doneDate: '2026-03-12' },
      'c-synth-1': { due: '2026-03-25' },
      'P1-1': { done: true, doneDate: '2026-03-13' },
    },
    lifts: { 'l-synth1': { cur: 5, hist: [{ date: '2026-03-02', v: 5 }] } },
    reviews: {},
    presets: {},
  });
  expect(importProblem(backup()), '前缀 id 通过导入检查').toBeNull();
  expect(norm(backup()), '计划里有这些项时原样保留').toEqual(backup());
  // CR-01：done 为真但没有 doneDate 的进度补成空串，渲染和 md() 不会碰到 undefined；已有 doneDate 的不变
  expect(norm({ tasks: { 'P1-1': { done: true }, 'P1-2': { done: false }, 'P1-3': { due: '2026-03-25' } } }).tasks).toEqual({
    'P1-1': { done: true, doneDate: '' },
    'P1-2': { done: false },
    'P1-3': { due: '2026-03-25' },
  });

  // 换回 DEFAULT_PLAN：计划里没有 t-synth1，进度键被丢弃；g- 组和 l- 力量键格式合格，仍保留
  expect(usePlan(DEFAULT_PLAN)).toBe(true);
  const back = norm(backup());
  expect(Object.keys(back.tasks).sort()).toEqual(['P1-1', 'c-synth-1']);
  expect(back.custom[0].group).toBe('g-synth1');
  expect(back.lifts['l-synth1']).toEqual({ cur: 5, hist: [{ date: '2026-03-02', v: 5 }] });
});
