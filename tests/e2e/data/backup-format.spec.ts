// classifyBackup、importPreview、backupCounts 的单元用例（IO-07、IO-08，Phase 11）。
// 这是 Node 侧的单元用例：用 loadAppPure 在 node:vm 里求值应用的纯函数段，不开页面（本机资源有限，见 app-source.ts）。
// 云端页面路径（摘要确认、替换、上传）由 tests/cloud/import.spec.ts 覆盖，两条路径不互相替代。
// 期望值在本文件里独立写出（数条数、数日期、数进度键），不抄应用的实现；失败消息只写变体名。
// 数据全是合成的（SYNTH 开头），不含任何个人计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { loadFixture } from '../../support/fixture-files';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';
import { syntheticPlan } from '../../support/cloud-data';
import { fullBackup, legacyBackup, planOnlyFile } from '../../support/backup-files';
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_FULL, BACKUP_KIND_PLAN } from '../../support/constants';

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

// 新格式（11-02，格式见 11-02-SUMMARY 的“备份格式决定”）：期望值用 constants.ts 的 BACKUP_* 和 backup-files.ts 的构造函数独立写出
const wrapNames = ['classifyBackup', 'importPreview', 'backupOf', 'withPlan', 'planCounts', 'DEFAULT_PLAN', 'BK_APP', 'BK_FORMAT', 'BK_FULL', 'BK_PLAN'] as const;
// 计划经 normalizePlan 之后不再带 _synthetic 标记，其余字段原样
const planLike = (p: any): any => {
  const { _synthetic, ...rest } = p;
  return rest;
};

test('IO-07 classifyBackup reads the agreed wrapper as a full backup or a plan-only file and rejects a wrapper with any invalid part', async () => {
  const { classifyBackup } = loadAppPure(wrapNames);
  const plan = syntheticPlan('w', 2);
  const state = legacyBackup('w');

  const full = plain(classifyBackup(fullBackup(plan, state)));
  expect(full.kind).toBe('full');
  expect(full.plan, '完整备份的计划').toEqual(planLike(plan));
  expect(full.state, '完整备份的记录原样').toEqual(state);
  const only = plain(classifyBackup(planOnlyFile(plan)));
  expect(only.kind).toBe('plan');
  expect(only.plan, '只含计划的计划').toEqual(planLike(plan));
  expect('state' in only, '只含计划的结果没有记录').toBe(false);

  // 规则只检查列出的字段：多出来的未知字段和任意的 exportedAt 不拒绝
  expect(classifyBackup({ ...fullBackup(plan, state), note: 'SYNTH extra' }), 'unknown extra field').not.toBeNull();
  expect(classifyBackup({ ...planOnlyFile(plan), exportedAt: 'not a time' }), 'odd exportedAt').not.toBeNull();
  const noTime: any = planOnlyFile(plan);
  delete noTime.exportedAt;
  expect(classifyBackup(noTime), 'no exportedAt').not.toBeNull();

  // 计划缺组、任务 id 不合格
  const noGroups = { ...plan, groups: [] };
  const badTask = JSON.parse(JSON.stringify(plan));
  badTask.groups[0].tasks[0].id = 'bad task id';
  const dupTask = JSON.parse(JSON.stringify(plan));
  dupTask.groups[1].tasks[0].id = dupTask.groups[0].tasks[0].id;
  // 完整备份的记录里有坏 id
  const badLog = legacyBackup('w', { logs: [{ id: 'bad id!', date: '2026-03-17', cat: '语言', text: 'SYNTH x' }] });
  const without = (o: any, key: string): any => {
    const copy = { ...o };
    delete copy[key];
    return copy;
  };

  const rejected: Array<[string, unknown]> = [
    ['wrong app', { ...fullBackup(plan, state), app: 'other-app' }],
    ['missing app', without(fullBackup(plan, state), 'app')],
    ['format 1', { ...fullBackup(plan, state), format: 1 }],
    ['format 3', { ...fullBackup(plan, state), format: 3 }],
    ['format as a string', { ...fullBackup(plan, state), format: '2' }],
    ['unknown kind', { ...fullBackup(plan, state), kind: 'records' }],
    ['missing kind', without(fullBackup(plan, state), 'kind')],
    ['plan without groups, full', fullBackup(noGroups, state)],
    ['plan without groups, plan-only', planOnlyFile(noGroups)],
    ['plan with a bad task id', fullBackup(badTask, state)],
    ['plan with a duplicate task id', planOnlyFile(dupTask)],
    ['plan is null', fullBackup(null, state)],
    ['plan missing', without(fullBackup(plan, state), 'plan')],
    ['full with a bad log id', fullBackup(plan, badLog)],
    ['full without state', without(fullBackup(plan, state), 'state')],
    ['full with an empty state', fullBackup(plan, {})],
    ['full with an array state', fullBackup(plan, [])],
    ['plan-only with a state', { ...planOnlyFile(plan), state }],
    ['only the format key', { format: BACKUP_FORMAT }],
    ['wrapper keys without a format key', { app: BACKUP_APP, kind: BACKUP_KIND_FULL, plan, state }],
  ];
  for (const [label, raw] of rejected) {
    expect(classifyBackup(raw), label).toBeNull();
  }
});

test('IO-08 backupOf writes the agreed wrapper and classifyBackup reads it back unchanged', async () => {
  const { classifyBackup, backupOf, DEFAULT_PLAN, BK_APP, BK_FORMAT, BK_FULL, BK_PLAN } = loadAppPure(wrapNames);
  // 格式常量逐字等于所有者确认的值
  expect([BK_APP, BK_FORMAT, BK_FULL, BK_PLAN]).toEqual([BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_FULL, BACKUP_KIND_PLAN]);

  const at = '2026-03-18T12:00:00.000Z';
  const plan = syntheticPlan('b', 2);
  const state = legacyBackup('b');

  // 完整备份：键序、内容都和独立构造的文件一致；经 JSON 往返后读回为同一种类
  const wrote = JSON.parse(JSON.stringify(backupOf(plan, state, at)));
  expect(Object.keys(wrote)).toEqual(['app', 'format', 'kind', 'exportedAt', 'plan', 'state']);
  expect(wrote).toEqual(fullBackup(plan, state, at));
  const back = plain(classifyBackup(wrote));
  expect(back.kind).toBe('full');
  expect(back.plan).toEqual(planLike(plan));
  expect(back.state).toEqual(state);

  // 只含计划：没有记录键
  const wrotePlan = JSON.parse(JSON.stringify(backupOf(plan, null, at)));
  expect(Object.keys(wrotePlan)).toEqual(['app', 'format', 'kind', 'exportedAt', 'plan']);
  expect(wrotePlan).toEqual(planOnlyFile(plan, at));
  const backPlan = plain(classifyBackup(wrotePlan));
  expect(backPlan.kind).toBe('plan');
  expect(backPlan.plan).toEqual(planLike(plan));
  expect('state' in backPlan).toBe(false);

  // 应用自己的示例计划也能写出再读回
  const sample = plain(DEFAULT_PLAN);
  const sampleBack = plain(classifyBackup(JSON.parse(JSON.stringify(backupOf(sample, null, at)))));
  expect(sampleBack.plan).toEqual(sample);
});

test('IO-08 WR-01 importPreview counts custom to-dos whose group is not in the plan that will be in use', async () => {
  const { classifyBackup, importPreview, usePlan, DEFAULT_PLAN } = loadAppPure(names);
  usePlan(DEFAULT_PLAN);
  const custom = [
    { id: 'c-w1', group: 'P2', text: 'SYNTH known' },
    { id: 'c-w2', group: 'P9', text: 'SYNTH unknown' },
    { id: 'c-w3', group: 'g-zz', text: 'SYNTH unknown 2' },
  ];
  // 旧备份：按账号当前计划（示例计划）算；不丢待办，只计数
  const legacy = plain(importPreview(classifyBackup({ custom, logs: [] }), { logs: [] }));
  expect(legacy.orphanCustom).toBe(2);
  expect(legacy.state.custom.length, '待办仍然保留').toBe(3);
  // 对得上计划的备份为 0
  expect(plain(importPreview(classifyBackup({ custom: [custom[0]], logs: [] }), { logs: [] })).orphanCustom).toBe(0);
  expect(plain(importPreview(classifyBackup({ logs: [] }), { logs: [] })).orphanCustom).toBe(0);

  // 完整备份：按文件里的计划算（只有 g-w1 一组），三条都对不上
  const filePlan = syntheticPlan('w', 1);
  const fullB = classifyBackup(fullBackup(filePlan, legacyBackup('w', { custom })));
  expect(plain(importPreview(fullB, { logs: [] })).orphanCustom).toBe(3);
  // 文件的计划里有 g-w1 时，放在这个组里的待办对得上
  const inPlan = classifyBackup(fullBackup(filePlan, legacyBackup('w', { custom: [{ id: 'c-w4', group: filePlan.groups[0].id, text: 'SYNTH in plan' }, custom[1]] })));
  expect(plain(importPreview(inPlan, { logs: [] })).orphanCustom).toBe(1);

  // 只含计划：按账号现有的待办算。新计划只有一组，现有的三条里 P2、P9、g-zz 都对不上
  const planB = classifyBackup(planOnlyFile(filePlan));
  expect(plain(importPreview(planB, { logs: [], custom })).orphanCustom).toBe(3);
});

test('IO-08 importPreview counts the progress a new plan would drop for full backups and plan-only files (D-07)', async () => {
  const { classifyBackup, importPreview, withPlan, planCounts, readLive } = loadAppPure(wrapNames, ['plan', 'planIds', 'keepOrphans']);
  const initial = readLive();
  expect(initial.keepOrphans, '模块初始 keepOrphans 为假').toBe(false);

  // 完整备份：按文件里的计划算。P2-1 不在文件计划里，丢弃并计数；t-f1x1 在文件计划里，c-f-1 是文件里的自定义待办，保留
  const filePlan = syntheticPlan('f', 1);
  const fileState = legacyBackup('f', {
    tasks: { 't-f1x1': { done: true }, 'P2-1': { done: true }, 'c-f-1': { done: true, doneDate: '2026-03-03' } },
    custom: [{ id: 'c-f-1', group: 'g-f1', text: 'SYNTH-f custom task' }],
  });
  const fullFile = fullBackup(filePlan, fileState);
  const fullB = classifyBackup(fullFile);
  const cur = {
    arrival: '', custom: [{ id: 'c-k1', group: 'P2', text: 'SYNTH-k custom' }], lifts: {}, reviews: {}, presets: {},
    logs: [{ id: 'k1', date: '2026-03-16', cat: '语言', text: 'SYNTH-k record' }, { id: 'k2', date: '2026-03-15', cat: '专业', text: 'SYNTH-k record 2' }],
    tasks: { 'P2-1': { done: true }, 't-x1': { done: true }, 'c-k1': { done: true } },
  };
  const curBefore = JSON.stringify(cur);
  const fileBefore = JSON.stringify(fullFile);
  const pvFull = plain(importPreview(fullB, cur));
  expect(pvFull.orphans, '完整备份的孤儿进度').toBe(1);
  expect(Object.keys(pvFull.state.tasks).sort()).toEqual(['c-f-1', 't-f1x1']);
  expect(pvFull.state.logs.length, '完整备份的记录条数').toBe(2);
  expect(pvFull.plan, '完整备份返回文件的计划').toEqual(planLike(filePlan));
  expect(pvFull.planCounts).toEqual({ groups: 1, tasks: 2, lifts: 1 });
  expect(pvFull.current, '账号现有记录条数').toBe(2);

  // 只含计划：按账号现有的进度算。新计划只有 t-x1，P2-1 对不上，丢弃并计数；自定义待办 c-k1 的进度保留
  const newPlan = syntheticPlan('p', 2);
  newPlan.groups[0].tasks = [{ id: 't-x1', text: 'SYNTH-p task' }];
  const planB = classifyBackup(planOnlyFile(newPlan));
  const pvPlan = plain(importPreview(planB, cur));
  expect(pvPlan.orphans, '只含计划的孤儿进度').toBe(1);
  expect(Object.keys(pvPlan.state.tasks).sort()).toEqual(['c-k1', 't-x1']);
  expect(pvPlan.state.logs.map((l: any) => l.id), '只含计划不动记录').toEqual(['k1', 'k2']);
  expect(pvPlan.plan).toEqual(planLike(newPlan));
  expect(pvPlan.planCounts).toEqual({ groups: 2, tasks: 3, lifts: 1 });
  expect(pvPlan.current).toBe(2);
  // 新计划保留了现有的全部进度时没有孤儿
  const sameB = classifyBackup(planOnlyFile(syntheticPlan('s', 1)));
  expect(plain(importPreview(sameB, { ...cur, tasks: { 'c-k1': { done: true } } })).orphans).toBe(0);

  expect(JSON.stringify(cur), '预览不改当前 state').toBe(curBefore);
  expect(JSON.stringify(fullFile), '预览不改文件内容').toBe(fileBefore);

  // planCounts 的任务数含 archived 的任务
  const archived = syntheticPlan('a', 2);
  archived.groups[0].tasks[0] = { ...archived.groups[0].tasks[0], archived: true } as any;
  expect(plain(planCounts(archived))).toEqual({ groups: 2, tasks: 4, lifts: 1 });

  // 计算不改变页面正在用的计划：调用后读到的活绑定与调用前是同一个对象
  const after = readLive();
  expect(after.plan, 'plan 没被换掉').toBe(initial.plan);
  expect(after.planIds, 'planIds 没被换掉').toBe(initial.planIds);
  expect(after.keepOrphans, 'keepOrphans 没变').toBe(initial.keepOrphans);

  // keepOrphans 的恢复：在 withPlan(不合格的计划) 里 keepOrphans 为真，里面再调用 importPreview，结束时它仍为真、plan 仍是进来时的对象
  const result = withPlan({}, () => {
    const inside = readLive();
    expect(inside.keepOrphans, 'withPlan 里 keepOrphans 为真').toBe(true);
    importPreview(fullB, cur);
    importPreview(planB, cur);
    const later = readLive();
    expect(later.keepOrphans, 'importPreview 之后 keepOrphans 仍为真').toBe(true);
    expect(later.plan, 'importPreview 之后 plan 仍是 withPlan 里的对象').toBe(inside.plan);
    expect(later.planIds, 'importPreview 之后 planIds 仍是 withPlan 里的对象').toBe(inside.planIds);
    return 42;
  });
  expect(result, 'withPlan 返回 fn 的结果').toBe(42);
  const restored = readLive();
  expect(restored.plan, 'withPlan 之后 plan 恢复').toBe(initial.plan);
  expect(restored.planIds, 'withPlan 之后 planIds 恢复').toBe(initial.planIds);
  expect(restored.keepOrphans, 'withPlan 之后 keepOrphans 恢复').toBe(false);

  // fn 抛错时也恢复
  expect(() => withPlan({}, () => { throw new Error('boom'); })).toThrow('boom');
  const afterThrow = readLive();
  expect(afterThrow.plan).toBe(initial.plan);
  expect(afterThrow.keepOrphans).toBe(false);
});
