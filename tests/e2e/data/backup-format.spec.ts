// classifyBackup、importPreview、backupCounts 的单元用例（IO-07、IO-08，Phase 11）。
// 这是 Node 侧的单元用例：用 loadAppPure 在 node:vm 里求值应用的纯函数段，不开页面（本机资源有限，见 app-source.ts）。
// 云端页面路径（摘要确认、替换、上传）由 tests/cloud/import.spec.ts 覆盖，两条路径不互相替代。
// 期望值在本文件里独立写出（数条数、数日期、数进度键），不抄应用的实现；失败消息只写变体名。
// 数据全是合成的（SYNTH 开头），不含任何个人计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { loadFixture } from '../../support/fixture-files';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';

// JSON 往返：把 vm 里的对象换成本 realm 的普通对象再比较
const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

const names = ['legacyShape', 'classifyBackup', 'importPreview', 'backupCounts', 'usePlan', 'DEFAULT_PLAN', 'normalize'] as const;

test('IO-07 classifyBackup accepts a legacy state with at least one well-typed field and rejects empty, array, wrong-typed and unagreed wrapper objects', async () => {
  const { classifyBackup, DEFAULT_PLAN } = loadAppPure(names);
  const wrong = MALFORMED_IMPORTS.find((m) => m.name === 'synth-wrong-types.json');
  expect(wrong, '需要 synth-wrong-types.json').toBeDefined();

  const rejected: Array<[string, unknown]> = [
    ['empty object', {}],
    ['empty array', []],
    ['null', null],
    ['wrong field types', JSON.parse(wrong!.text)],
    ['only a synthetic marker', { _synthetic: 'x' }],
    ['bare plan object', plain(DEFAULT_PLAN)],
    ['format key only', { format: 2 }],
    ['format key with a legacy field', { format: 2, logs: [] }],
    ['logs is an object', { logs: {} }],
    ['presets value is an array', { presets: { lang: ['SYNTH a'] } }],
    ['arrival is a number', { arrival: 20260318 }],
  ];
  for (const [label, raw] of rejected) {
    expect(classifyBackup(raw), label).toBeNull();
  }

  // 只有一个合格字段也算旧备份
  expect(plain(classifyBackup({ logs: [] })), '{ logs: [] }').toEqual({ kind: 'legacy', state: { logs: [] } });
  for (const name of ['full-state.json', 'legacy-categories.json', 'local-seed.json', 'legacy-positional-backup.json']) {
    const raw = loadFixture(name);
    const got = classifyBackup(raw);
    expect(got, name).not.toBeNull();
    expect(got.kind, name).toBe('legacy');
  }
  // 记录 id 不合格：整份拒绝（importProblem 的内层校验照旧）
  expect(classifyBackup({ logs: [{ id: 'bad id!', date: '2026-03-17', text: 'SYNTH x' }] }), 'bad log id').toBeNull();
});

test('IO-08 backupCounts and importPreview count records, weeks, done tasks, strength entries and dropped progress', async () => {
  const { backupCounts, importPreview, classifyBackup, usePlan, DEFAULT_PLAN } = loadAppPure(names);
  usePlan(DEFAULT_PLAN);

  // backupCounts：两条记录、两周复盘（一周空白）、三条进度（两条 done）、两个力量项共三条历史
  const counted = backupCounts({
    arrival: '',
    tasks: { 'P1-1': { done: true }, 'P1-2': { done: false }, 'P2-1': { done: true, doneDate: '2026-03-02' } },
    custom: [],
    logs: [
      { id: 'a1', date: '2026-03-17', cat: '语言', text: 'SYNTH a' },
      { id: 'a2', date: '2026-02-10', cat: '专业', text: 'SYNTH b' },
    ],
    lifts: {
      bench: { cur: 60, hist: [{ date: '2026-03-01', v: 55 }, { date: '2026-03-08', v: 60 }] },
      squat: { cur: 30, hist: [{ date: '2026-03-02', v: 30 }] },
      dead: { cur: 50 },
    },
    reviews: { '2026-03-16': 'SYNTH review', '2026-03-09': '   ' },
    presets: {},
  });
  expect(plain(counted)).toEqual({ logs: 2, from: '2026-02-10', to: '2026-03-17', reviews: 1, done: 2, liftEntries: 3 });
  expect(plain(backupCounts({ arrival: '', tasks: {}, custom: [], logs: [], lifts: {}, reviews: {}, presets: {} }))).toEqual({
    logs: 0, from: '', to: '', reviews: 0, done: 0, liftEntries: 0,
  });

  // importPreview：P9-9 对不上示例计划，被丢弃并计数；c-x-1 对应文件里的自定义待办，保留
  const file = {
    custom: [{ id: 'c-x-1', group: 'P2', text: 'SYNTH custom' }],
    tasks: { 'P2-1': { done: true }, 'c-x-1': { done: true }, 'P9-9': { done: true, doneDate: '2026-03-02' } },
    logs: [{ id: 'a1', date: '2026-03-17', cat: '语言', text: 'SYNTH a' }],
  };
  const before = JSON.stringify(file);
  const cur = { logs: [{ id: 'k1' }, { id: 'k2' }, { id: 'k3' }] };
  const pv = plain(importPreview(classifyBackup(file), cur));
  expect(pv.orphans).toBe(1);
  expect(Object.keys(pv.state.tasks).sort()).toEqual(['P2-1', 'c-x-1']);
  expect(pv.counts).toEqual({ logs: 1, from: '2026-03-17', to: '2026-03-17', reviews: 0, done: 2, liftEntries: 0 });
  expect(pv.current).toBe(3);
  expect(JSON.stringify(file), '预览不改文件内容').toBe(before);
  expect(cur.logs.length, '预览不改当前 state').toBe(3);

  // 没有孤儿时为 0
  const clean = plain(importPreview(classifyBackup({ tasks: { 'P2-1': { done: true } }, logs: [] }), { logs: [] }));
  expect(clean.orphans).toBe(0);
});
