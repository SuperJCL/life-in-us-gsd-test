// normalizePlan 与 usePlan 的单元用例（PLAN-05）。
// 用 loadAppPure 在 Node 的 vm 里求值应用的纯函数段，不开浏览器页面做断言（本机资源限制，见 app-source.ts）。
// 期望值在本文件里独立写出（从 DEFAULT_PLAN 的 JSON 深拷贝改出变体），不抄应用的实现；失败消息只写变体名，不写计划文字。
// normalizePlan 的拒绝分支本阶段没有页面入口（D-11），所以这里是它们唯一的证明；服务器计划进来后由页面路径再覆盖。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { CAT_LANGUAGE } from '../../support/strings';
import { BUILTIN_GROUP_SIZES } from '../../support/task-ids';

const NAMES = ['DEFAULT_PLAN', 'normalizePlan', 'usePlan', 'allTasks', 'normalize', 'importProblem', 'classifyBackup', 'GROUP_NONE', 'planProblems', 'PLAN_MAX', 'liftHistoryCount', 'emptyPlan', 'planUsedIds', 'planCardio', 'cardioHistoryCount', 'liftSetCount'] as const;
const TOTAL_BUILTIN = Object.values(BUILTIN_GROUP_SIZES).reduce((a, b) => a + b, 0);
const BUILTIN_IDS = Object.entries(BUILTIN_GROUP_SIZES).flatMap(([code, size]) =>
  Array.from({ length: size }, (_, i) => `${code}-${i + 1}`),
);

// JSON 往返：把 vm 里的对象换成本 realm 的普通对象再比较
const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

test('PLAN-05 normalizePlan accepts the sample plan and prefixed ids and rejects malformed or duplicate ids', async () => {
  const { DEFAULT_PLAN, normalizePlan } = loadAppPure(NAMES);
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const norm = (p: unknown) => plain(normalizePlan(p));

  // 接受：DEFAULT_PLAN 自己，规整后与原样深度相等
  expect(norm(base()), 'DEFAULT_PLAN 应当原样通过').toEqual(base());

  // 接受：g-、t-、l- 前缀的新 id 和布尔 archived；缺省的力量备注补成空串
  const extended = base();
  extended.groups.push({
    id: 'g-synth_1',
    cat: CAT_LANGUAGE,
    name: 'SYNTH group',
    tasks: [
      { id: 't-synth-1', text: 'SYNTH task', archived: true },
      { id: 't-synth-2', text: 'SYNTH task two', archived: false },
    ],
  });
  extended.lifts.push({ id: 'l-synth1', n: 'SYNTH lift', unit: 'kg', def: 1, target: 2 });
  const accepted = norm(extended);
  expect(accepted, '带 g-、t-、l- 前缀的新 id 应当被接受').not.toBeNull();
  const newGroup = accepted.groups[accepted.groups.length - 1];
  expect(newGroup.id).toBe('g-synth_1');
  expect(newGroup.tasks.map((t: { id: string }) => t.id)).toEqual(['t-synth-1', 't-synth-2']);
  expect(newGroup.tasks.map((t: { archived?: boolean }) => t.archived)).toEqual([true, false]);
  expect(accepted.lifts[accepted.lifts.length - 1]).toEqual({
    id: 'l-synth1',
    n: 'SYNTH lift',
    unit: 'kg',
    def: 1,
    target: 2,
    note: '',
  });

  // 缺的预设类别补空数组，缺省的 fitNote 补空串
  const sparse = base();
  delete sparse.presets.oth;
  delete sparse.fitNote;
  const sparseOut = norm(sparse);
  expect(sparseOut.presets.oth).toEqual([]);
  expect(sparseOut.fitNote).toBe('');

  // 拒绝：每个变体都应当返回 null
  const variants: Array<[string, (p: any) => void]> = [
    ['group id with a double quote', (p) => (p.groups[0].id = 'P1"')],
    ['group id with angle brackets', (p) => (p.groups[0].id = 'g-<b>')],
    ['group id with a space', (p) => (p.groups[0].id = 'g-a b')],
    ['group id is a number', (p) => (p.groups[0].id = 1)],
    ['task id with a double quote', (p) => (p.groups[0].tasks[0].id = 'P1-1"')],
    ['task id with angle brackets', (p) => (p.groups[0].tasks[0].id = 't-<i>')],
    ['task id with a space', (p) => (p.groups[0].tasks[0].id = 't-a b')],
    ['task id has no position', (p) => (p.groups[0].tasks[0].id = 'P1')],
    ['lift id with a capital letter', (p) => (p.lifts[0].id = 'Bench')],
    ['lift id with a symbol', (p) => (p.lifts[0].id = 'be-nch')],
    ['duplicate group id', (p) => (p.groups[1].id = p.groups[0].id)],
    ['duplicate task id in one group', (p) => (p.groups[0].tasks[1].id = p.groups[0].tasks[0].id)],
    ['duplicate task id across groups', (p) => (p.groups[1].tasks[0].id = p.groups[0].tasks[0].id)],
    ['duplicate lift id', (p) => (p.lifts[1].id = p.lifts[0].id)],
    ['unknown category', (p) => (p.groups[0].cat = 'SYNTH-unknown')],
    ['category named constructor', (p) => (p.groups[0].cat = 'constructor')],
    ['category named __proto__', (p) => (p.groups[0].cat = '__proto__')],
    ['category named toString', (p) => (p.groups[0].cat = 'toString')],
    ['group name is not a string', (p) => (p.groups[0].name = 5)],
    ['group note is not a string', (p) => (p.groups[1].note = 5)],
    ['task text is not a string', (p) => (p.groups[0].tasks[0].text = 5)],
    ['task archived is not a boolean', (p) => (p.groups[0].tasks[0].archived = 'yes')],
    ['group archived is not a boolean', (p) => (p.groups[0].archived = 'yes')],
    ['lift archived is not a boolean', (p) => (p.lifts[0].archived = 1)],
    ['group id is the unassigned marker', (p) => (p.groups[0].id = '-')],
    ['groups is not an array', (p) => (p.groups = {})],
    ['group tasks is not an array', (p) => (p.groups[0].tasks = 'x')],
    ['lifts is not an array', (p) => (p.lifts = {})],
    ['lift target is not finite', (p) => (p.lifts[0].target = Infinity)],
    ['lift target is NaN', (p) => (p.lifts[0].target = NaN)],
    ['lift target is zero', (p) => (p.lifts[0].target = 0)],
    ['lift def is a string', (p) => (p.lifts[0].def = '5')],
    ['lift unit is not a string', (p) => (p.lifts[0].unit = 1)],
    ['lift note is not a string', (p) => (p.lifts[0].note = 1)],
    ['fitGoal has one number', (p) => (p.fitGoal = [1])],
    ['fitGoal has three numbers', (p) => (p.fitGoal = [1, 2, 3])],
    ['fitGoal has a string', (p) => (p.fitGoal = ['a', 2])],
    ['fitGoal has a non-finite number', (p) => (p.fitGoal = [1, Infinity])],
    ['fitNote is not a string', (p) => (p.fitNote = 5)],
    ['presets has an unknown category key', (p) => (p.presets.SYNTH = [])],
    ['presets list holds a non-string', (p) => (p.presets.lang = [1])],
    ['presets list is not an array', (p) => (p.presets.lang = 'x')],
    ['presets is missing', (p) => delete p.presets],
  ];
  for (const [name, mutate] of variants) {
    const p = base();
    mutate(p);
    expect(normalizePlan(p), `变体应当被拒绝：${name}`).toBeNull();
  }
  const notPlans: Array<[string, unknown]> = [
    ['null', null],
    ['undefined', undefined],
    ['an array', []],
    ['a string', 'x'],
    ['a number', 5],
  ];
  for (const [name, input] of notPlans) {
    expect(normalizePlan(input), `变体应当被拒绝：${name}`).toBeNull();
  }

  // usePlan：不合格的计划返回 false 并回落到 DEFAULT_PLAN，合格的返回 true 并改变 allTasks
  const pure = loadAppPure(NAMES);
  const bad = JSON.parse(JSON.stringify(pure.DEFAULT_PLAN));
  bad.groups[0].id = 'P1"';
  expect(pure.usePlan(bad), '不合格的计划应当返回 false').toBe(false);
  expect(pure.allTasks().length, '回落后应当是内置的全部任务').toBe(TOTAL_BUILTIN);
  expect(plain(pure.allTasks()).map((t: { id: string }) => t.id)).toEqual(BUILTIN_IDS);
  expect(pure.usePlan(pure.DEFAULT_PLAN), 'DEFAULT_PLAN 应当返回 true').toBe(true);
  expect(pure.usePlan(extended), '带前缀 id 的计划应当返回 true').toBe(true);
  expect(pure.allTasks().length, '新计划多出两项任务').toBe(TOTAL_BUILTIN + 2);
  expect(pure.usePlan(bad), '不合格的计划再次返回 false').toBe(false);
  expect(pure.allTasks().length, '再次回落到内置的全部任务').toBe(TOTAL_BUILTIN);
});

test('PLAN-03 normalizePlan keeps archived on groups and lifts and accepts an empty plan (D-06, D-16)', async () => {
  const pure = loadAppPure(NAMES);
  const { DEFAULT_PLAN, normalizePlan } = pure;
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const norm = (p: unknown) => plain(normalizePlan(p));

  // archived 在组、任务、力量项上保留布尔；缺省的不写这个键（没有归档项的计划与今天逐字相同）
  const p = base();
  p.groups[1].archived = true;
  p.groups[2].archived = false;
  p.groups[0].tasks[1].archived = true;
  p.lifts[0].archived = true;
  p.lifts[1].archived = false;
  const out = norm(p);
  expect(out, '带 archived 的计划应当被接受').not.toBeNull();
  expect(out.groups.map((g: { archived?: boolean }) => g.archived).slice(0, 4), '组的 archived').toEqual([undefined, true, false, undefined]);
  expect(out.groups[0].tasks.map((t: { archived?: boolean }) => t.archived).slice(0, 2), '任务的 archived').toEqual([undefined, true]);
  expect(out.lifts.map((l: { archived?: boolean }) => l.archived).slice(0, 3), '力量项的 archived').toEqual([true, false, undefined]);
  expect(Object.prototype.hasOwnProperty.call(out.groups[0], 'archived'), '缺省的组不写 archived').toBe(false);
  expect(Object.prototype.hasOwnProperty.call(out.lifts[2], 'archived'), '缺省的力量项不写 archived').toBe(false);

  // 空计划（D-16）：groups 和 lifts 都是空数组也合格
  const empty = base();
  empty.groups = [];
  empty.lifts = [];
  const emptyOut = norm(empty);
  expect(emptyOut, '空计划应当被接受').not.toBeNull();
  expect(emptyOut.groups).toEqual([]);
  expect(emptyOut.lifts).toEqual([]);
  expect(pure.usePlan(empty), '空计划 usePlan 应当返回 true').toBe(true);
  expect(plain(pure.allTasks()), '空计划下没有计划任务').toEqual([]);

  // 空计划下 normalize 不抛错：找不到组的自定义待办落到标记 GROUP_NONE
  const GROUP_NONE = pure.GROUP_NONE;
  expect(GROUP_NONE, '标记常量').toBe('-');
  const state = () => ({ arrival: '', tasks: {}, custom: [{ id: 'c-synth1', group: 'bad group', text: 'SYNTH x' }], logs: [], lifts: {}, reviews: {}, presets: {} });
  let first: any;
  expect(() => (first = plain(pure.normalize(state()))), '空计划下 normalize 不应当抛错').not.toThrow();
  expect(first.custom.map((c: { group: string }) => c.group)).toEqual([GROUP_NONE]);
  // 之后换成有组的计划，再 normalize 同一份结果：待办仍然是标记，不会悄悄挂到某个组上
  expect(pure.usePlan(DEFAULT_PLAN)).toBe(true);
  expect(plain(pure.normalize(first)).custom.map((c: { group: string }) => c.group)).toEqual([GROUP_NONE]);
  // 有组时 group 不合格的待办仍按原规则落到「其他」类别的组
  expect(plain(pure.normalize(state())).custom[0].group).toBe('P7');

  // 标记不合 GROUP_ID_RE：normalizePlan 拒绝叫这个 id 的组（上面的拒绝表也有这一条）；导入白名单只对标记放行
  const marked = { custom: [{ id: 'c-synth1', group: GROUP_NONE, text: 'SYNTH x' }] };
  expect(pure.importProblem(marked), 'importProblem 对标记放行').toBeNull();
  expect(pure.importProblem({ custom: [{ id: 'c-synth1', group: '--', text: 'SYNTH x' }] }), '其他不合格的 group 仍被拒绝').toBe('custom');
  expect(pure.importProblem({ custom: [{ id: 'c-synth1', group: 'P0 x', text: 'SYNTH x' }] }), '带空格的 group 仍被拒绝').toBe('custom');
  expect(pure.classifyBackup(marked), '带标记待办的旧备份应当能导入').not.toBeNull();
});

test('PLAN-02 normalizePlan keeps accepting any finite lift start value and any two finite weekly fitness numbers (editor rules apply in the editor only)', async () => {
  const { DEFAULT_PLAN, normalizePlan } = loadAppPure(NAMES);
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  // 力量项起始值：负数和小数照旧接受，规范化结果与输入相同
  for (const def of [-1, 2.5, 0]) {
    const p = base();
    p.lifts[0].def = def;
    expect(plain(normalizePlan(p)), `起始值变体应当被接受：${def}`).toEqual(p);
  }
  // 每周健身目标：任意两个有限数照旧接受（不要求整数、不要求 0 到 7、不要求最少不大于最多）
  for (const fit of [[1.5, 3], [-1, 3], [2, 8], [5, 3], [0, 7]]) {
    const p = base();
    p.fitGoal = fit;
    expect(plain(normalizePlan(p)), `fitGoal 变体应当被接受：${fit.join(',')}`).toEqual(p);
  }
  // 照旧拒绝：起始值不是有限数、目标值不大于 0、fitGoal 不是两个有限数
  const bad: Array<[string, (p: any) => void]> = [
    ['def is not finite', (p) => (p.lifts[0].def = Infinity)],
    ['def is NaN', (p) => (p.lifts[0].def = NaN)],
    ['target is zero', (p) => (p.lifts[0].target = 0)],
    ['target is negative', (p) => (p.lifts[0].target = -3)],
    ['fitGoal is not two numbers', (p) => (p.fitGoal = [1])],
    ['fitGoal has a non-finite number', (p) => (p.fitGoal = [1, NaN])],
  ];
  for (const [name, mutate] of bad) {
    const p = base();
    mutate(p);
    expect(normalizePlan(p), `变体应当被拒绝：${name}`).toBeNull();
  }
});

test('PLAN-02 planProblems reports empty names and texts of groups and tasks in use and ignores archived ones (D-17)', async () => {
  const { DEFAULT_PLAN, planProblems, PLAN_MAX } = loadAppPure(NAMES);
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const problems = (p: unknown) => plain(planProblems(p));

  // 示例计划没有问题
  expect(problems(base()), 'DEFAULT_PLAN 不应报问题').toEqual([]);

  // 未归档的组名只有空白、未归档的任务文字为空：按页面顺序报两项，键是 g:<id>:name、t:<id>:text，代码 gname、ttext
  const p = base();
  p.groups[0].name = '  ';
  p.groups[1].tasks[0].text = '';
  expect(problems(p), '空组名和空任务文字都应报出').toEqual([
    { key: `g:${p.groups[0].id}:name`, code: 'gname' },
    { key: `t:${p.groups[1].tasks[0].id}:text`, code: 'ttext' },
  ]);

  // 只有空白的任务文字也算空；有内容的（含首尾空格）不报
  const q = base();
  q.groups[0].tasks[0].text = ' 	 ';
  q.groups[0].tasks[1].text = ' x ';
  expect(problems(q), '只有空白的文字应报出，有内容的不报').toEqual([{ key: `t:${q.groups[0].tasks[0].id}:text`, code: 'ttext' }]);

  // 归档的组（名称空、任务空）和归档的任务（文字空）不报
  const a = base();
  a.groups[2].archived = true;
  a.groups[2].name = '';
  a.groups[2].tasks[0].text = '';
  a.groups[3].tasks[0].archived = true;
  a.groups[3].tasks[0].text = '';
  expect(problems(a), '归档的组和任务不应报问题').toEqual([]);

  // 各项上限
  expect(plain(PLAN_MAX)).toEqual({ groups: 20, tasks: 50, lifts: 20, cardio: 20, tags: 20, name: 40, text: 200, note: 200, tag: 30, unit: 8 });
});

test('PLAN-02 planProblems checks lift values and weekly fitness days and ignores archived lifts (D-15, D-17)', async () => {
  const { DEFAULT_PLAN, planProblems, liftHistoryCount, cardioHistoryCount, liftSetCount } = loadAppPure(NAMES);
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const problems = (p: unknown) => plain(planProblems(p));
  const lid = base().lifts[0].id;

  // 示例计划的力量项和健身天数没有问题
  expect(problems(base()), 'DEFAULT_PLAN 不应报问题').toEqual([]);

  // 名称和单位只有空白、目标值为 0、起始值为负：按卡片里的字段顺序报四项，键 l:<id>:n|unit|target|def
  const a = base();
  Object.assign(a.lifts[0], { n: '  ', unit: ' ', target: 0, def: -0.5 });
  expect(problems(a), '名称、单位、目标值、起始值各报一项').toEqual([
    { key: `l:${lid}:n`, code: 'lname' },
    { key: `l:${lid}:unit`, code: 'lunit' },
    { key: `l:${lid}:target`, code: 'ltarget' },
    { key: `l:${lid}:def`, code: 'ldef' },
  ]);

  // 目标值为 -1、空串、不是数、无穷大都报 ltarget；起始值为空串、不是数都报 ldef
  for (const bad of [-1, '', 'x', null, Infinity, NaN]) {
    const b = base();
    b.lifts[0].target = bad;
    expect(problems(b).map((x: any) => x.code), `目标值 ${String(bad)}`).toEqual(['ltarget']);
    const c = base();
    c.lifts[0].def = bad === -1 ? -1 : bad;
    expect(problems(c).map((x: any) => x.code), `起始值 ${String(bad)}`).toEqual(['ldef']);
  }

  // 起始值 0、2.5 和目标值 0.5 合规（小数允许，不取整）
  for (const [def, target] of [[0, 20], [2.5, 0.5], [0, 0.5]]) {
    const d = base();
    Object.assign(d.lifts[0], { def, target });
    expect(problems(d), `起始值 ${def} 目标值 ${target}`).toEqual([]);
  }

  // 健身天数：不是 0 到 7 的整数的数报 fitint（键 fit:min 或 fit:max）
  for (const [fit, keys] of [
    [[8, 3], ['fit:min']],
    [[1, -1], ['fit:max']],
    [[1.5, 3], ['fit:min']],
    [['', 3], ['fit:min']],
    [[1, ''], ['fit:max']],
    [[9, 9], ['fit:min', 'fit:max']],
  ] as Array<[unknown[], string[]]>) {
    const b = base();
    b.fitGoal = fit;
    expect(problems(b), `fitGoal ${JSON.stringify(fit)}`).toEqual(keys.map((key) => ({ key, code: 'fitint' })));
  }
  // 两个都合法而最少大于最多：两个键都报 fitorder；相等和 0、7 的边界合规
  const o = base();
  o.fitGoal = [5, 3];
  expect(problems(o), '最少大于最多').toEqual([
    { key: 'fit:min', code: 'fitorder' },
    { key: 'fit:max', code: 'fitorder' },
  ]);
  for (const fit of [[3, 3], [0, 7], [0, 0], [7, 7]]) {
    const b = base();
    b.fitGoal = fit;
    expect(problems(b), `fitGoal ${JSON.stringify(fit)}`).toEqual([]);
  }

  // 归档的力量项（值全是错的）不报
  const r = base();
  Object.assign(r.lifts[0], { archived: true, n: '', unit: '', target: 0, def: -1 });
  expect(problems(r), '归档的力量项不应报问题').toEqual([]);

  // liftHistoryCount：没有键、没有 hist、3 条 hist 分别是 0、0、3
  expect(liftHistoryCount({ lifts: {} }, 'l-x')).toBe(0);
  expect(liftHistoryCount({ lifts: { 'l-x': { cur: 5 } } }, 'l-x')).toBe(0);
  expect(liftHistoryCount({ lifts: { 'l-x': { cur: 5, hist: [{}, {}, {}] } } }, 'l-x')).toBe(3);
  expect(liftHistoryCount({}, 'l-x')).toBe(0);

  // D-04（15）：第 20 个力量项合规，第 21 个未归档的报 llimit（标在第 21 个上）；其中一个归档就不报
  const many = base();
  many.lifts = Array.from({ length: 21 }, (_, i) => ({ id: `l-m${i + 1}`, n: `SYNTH-${i + 1}`, unit: 'kg', def: 0, target: 10, note: '' }));
  expect(problems(many), '21 个未归档').toEqual([{ key: 'l:l-m21:n', code: 'llimit' }]);
  many.lifts[5].archived = true;
  expect(problems(many), '其中一个归档').toEqual([]);

  // 12 D-01、A9（15-06）：训练记录也算历史。2 个手填点加 3 天含这个动作的训练是 5；只有一个空 sets 的天、别的动作的天不算
  const wo = {
    '2026-03-01': { lifts: [{ id: 'l-x', sets: [{ w: 20, r: 8 }, { w: 20, r: 6 }] }], cardio: [] },
    '2026-03-02': { lifts: [{ id: 'l-y', sets: [{ w: 5, r: 5 }] }, { id: 'l-x', sets: [{ w: 22, r: 5 }] }], cardio: [{ id: 'r-a', m: 20 }] },
    '2026-03-03': { lifts: [{ id: 'l-x', sets: [{ w: 25, r: 3 }] }], cardio: [{ id: 'r-a', m: 30, d: 4 }, { id: 'r-b', m: 10 }] },
    '2026-03-04': { lifts: [{ id: 'l-x', sets: [] }], cardio: [] },
  };
  const s = { lifts: { 'l-x': { cur: 25, hist: [{ date: '2026-02-01', v: 20 }, { date: '2026-02-08', v: 22 }] } }, workouts: wo };
  expect(liftHistoryCount(s, 'l-x'), '2 个手填点加 3 天训练').toBe(5);
  expect(liftHistoryCount({ workouts: wo }, 'l-x'), '只有训练').toBe(3);
  expect(liftHistoryCount(s, 'l-y'), '另一个动作只有 1 天训练').toBe(1);
  expect(liftSetCount(s, 'l-x'), '组数之和').toBe(4);
  expect([liftSetCount(s, 'l-y'), liftSetCount(s, 'l-none'), liftSetCount({}, 'l-x')]).toEqual([1, 0, 0]);
  expect([cardioHistoryCount(s, 'r-a'), cardioHistoryCount(s, 'r-b'), cardioHistoryCount(s, 'r-none'), cardioHistoryCount({}, 'r-a')]).toEqual([2, 1, 0, 0]);
});

// D-02、D-04（Phase 15-06）：有氧项的校验。期望值在这里独立写出
test('PLAN-02 planProblems checks cardio names, targets and the cardio limit and ignores archived cardio items (D-02, D-04)', async () => {
  const { DEFAULT_PLAN, planProblems } = loadAppPure(NAMES);
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const problems = (p: unknown) => plain(planProblems(p));
  const cid = base().cardio[0].id;

  // 示例计划的三个有氧项没有问题；没有 cardio 键的旧计划也没有
  expect(problems(base()), 'DEFAULT_PLAN 不应报问题').toEqual([]);
  const old = base();
  delete old.cardio;
  expect(problems(old), '没有 cardio 键不应报问题').toEqual([]);

  // 名称：空串和全是空格报 cname，41 个字报 nlong，40 个字合规（键 r:<id>:n）
  for (const n of ['', '   ']) {
    const b = base();
    b.cardio[0].n = n;
    expect(problems(b), `名称 ${JSON.stringify(n)}`).toEqual([{ key: `r:${cid}:n`, code: 'cname' }]);
  }
  const long = base();
  long.cardio[0].n = '长'.repeat(41);
  expect(problems(long), '名称 41 个字').toEqual([{ key: `r:${cid}:n`, code: 'nlong' }]);
  const edge = base();
  edge.cardio[0].n = '长'.repeat(40);
  expect(problems(edge), '名称 40 个字').toEqual([]);

  // 目标：数值为 0、负数、空串、不是数都报 ctarget（键 r:<id>:tv）；不设目标、小数合规
  for (const v of [0, -1, '', 'x', null, Infinity]) {
    const b = base();
    b.cardio[0].target = { kind: 'km', v };
    expect(problems(b), `目标值 ${String(v)}`).toEqual([{ key: `r:${cid}:tv`, code: 'ctarget' }]);
  }
  const noTarget = base();
  delete noTarget.cardio[0].target;
  expect(problems(noTarget), '不设目标').toEqual([]);
  const decimal = base();
  decimal.cardio[0].target = { kind: 'min', v: 0.5 };
  expect(problems(decimal), '目标 0.5').toEqual([]);

  // 名称和目标同时有问题：先名称后目标
  const both = base();
  Object.assign(both.cardio[0], { n: '', target: { kind: 'min', v: 0 } });
  expect(problems(both), '两项各报一次').toEqual([
    { key: `r:${cid}:n`, code: 'cname' },
    { key: `r:${cid}:tv`, code: 'ctarget' },
  ]);

  // 数量：20 个未归档合规，第 21 个报 climit（键标在第 21 个上）；其中一个归档就不报
  const many = base();
  many.cardio = Array.from({ length: 21 }, (_, i) => ({ id: `r-m${i + 1}`, n: `SYNTH-${i + 1}`, note: '' }));
  expect(problems(many), '21 个未归档').toEqual([{ key: 'r:r-m21:n', code: 'climit' }]);
  many.cardio[3].archived = true;
  expect(problems(many), '其中一个归档').toEqual([]);
  expect(problems({ ...many, cardio: many.cardio.slice(0, 20) }), '20 个').toEqual([]);

  // 归档的有氧项（名称空、目标无效）不报
  const arch = base();
  Object.assign(arch.cardio[0], { archived: true, n: '', target: { kind: 'km', v: 0 } });
  expect(problems(arch), '归档的有氧项不应报问题').toEqual([]);
});

// D-01、D-02、D-03（Phase 14）：云端新账号首次建档用的空计划。期望值在这里独立写出，不读应用的实现
test('PLAN-06 emptyPlan has no groups, lifts or base tags and keeps the weekly fitness goal and note (D-01, D-02, D-03)', () => {
  const { emptyPlan, DEFAULT_PLAN, normalizePlan } = loadAppPure(['emptyPlan', 'DEFAULT_PLAN', 'normalizePlan']);
  const sample: any = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const expected = {
    v: 1,
    presets: { lang: [], pro: [], fit: [], job: [], oth: [] },
    groups: [],
    lifts: [],
    fitGoal: [2, 4],
    fitNote: sample.fitNote,
  };
  const first = plain(emptyPlan());
  expect(first, '空计划的形状').toEqual(expected);
  expect(plain(normalizePlan(first)), '空计划应当通过 normalizePlan').toEqual(expected);
  // 每次调用都是新对象：改掉一次的结果不影响下一次，也不影响示例计划
  const a = emptyPlan();
  const b = emptyPlan();
  expect(a !== b && a.groups !== b.groups && a.presets !== b.presets, '两次调用不是同一个对象').toBe(true);
  a.groups.push({ id: 'g-x' });
  a.presets.lang.push('x');
  expect(plain(emptyPlan()), '改一次不影响下一次').toEqual(expected);
  expect(plain(DEFAULT_PLAN), '示例计划没有被改动').toEqual(sample);
});

// D-05、D-08（Phase 14）：按勾选从示例里拷贝，示例原顺序、换新 id、不带快捷词
test('PLAN-07 pickSample copies only the chosen sample groups and lifts in sample order with new ids and no tags (D-05, D-08)', () => {
  const { pickSample, planUsedIds, DEFAULT_PLAN } = loadAppPure(['pickSample', 'planUsedIds', 'DEFAULT_PLAN']);
  const sample: any = JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const used = new Set<string>(['g-taken']);
  // 键倒序传入、带一个不认识的键：结果仍按示例的顺序，不认识的键被忽略
  const r = plain(pickSample(['l:pull', 'g:P3', 'g:P1', 'g:P9'], used));

  expect(Object.keys(r).sort(), '结果只有 groups 和 lifts，没有 presets').toEqual(['groups', 'lifts']);
  expect(r.groups).toHaveLength(2);
  expect(r.lifts).toHaveLength(1);
  const strip = (g: any) => ({ cat: g.cat, name: g.name, note: g.note, texts: g.tasks.map((t: any) => t.text) });
  expect(r.groups.map(strip), '目标组按示例顺序，内容与示例的第 1、第 3 组相同').toEqual([strip(sample.groups[0]), strip(sample.groups[2])]);
  const lifts = (l: any) => ({ n: l.n, unit: l.unit, def: l.def, target: l.target, note: l.note });
  expect(r.lifts.map(lifts), '力量项与示例的 pull 相同').toEqual([lifts(sample.lifts.find((l: any) => l.id === 'pull'))]);

  // id：g-、t-、l- 前缀，没有一个等于示例 id，互不重复，都已加进 used
  const gids: string[] = r.groups.map((g: any) => g.id);
  const tids: string[] = r.groups.flatMap((g: any) => g.tasks.map((t: any) => t.id));
  const lids: string[] = r.lifts.map((l: any) => l.id);
  expect(gids.every((id) => /^g-/.test(id)), '组 id 前缀').toBe(true);
  expect(tids.every((id) => /^t-/.test(id)), '任务 id 前缀').toBe(true);
  expect(lids.every((id) => /^l-/.test(id)), '力量项 id 前缀').toBe(true);
  const sampleIds = new Set<string>([
    ...sample.groups.flatMap((g: any) => [g.id, ...g.tasks.map((t: any) => t.id)]),
    ...sample.lifts.map((l: any) => l.id),
  ]);
  const all = [...gids, ...tids, ...lids];
  expect(all.some((id) => sampleIds.has(id)), '没有复用示例 id').toBe(false);
  expect(new Set(all).size, 'id 互不重复').toBe(all.length);
  expect(all.every((id) => used.has(id)) && used.has('g-taken'), '新 id 都已加进 used').toBe(true);

  // 空集合：0 个组 0 个力量项；示例计划本身不被改动
  const none = plain(pickSample([], new Set()));
  expect([none.groups.length, none.lifts.length], '空集合').toEqual([0, 0]);
  expect(plain(DEFAULT_PLAN), '示例计划没有被改动').toEqual(sample);
  // planUsedIds：全部组 id + 任务 id + 力量项 id + 有氧项 id（Phase 15 起含有氧项）
  const totalTasks = sample.groups.reduce((n: number, g: any) => n + g.tasks.length, 0);
  expect(planUsedIds(DEFAULT_PLAN).size, 'planUsedIds 的大小').toBe(7 + totalTasks + 4 + 3);
});

// D-02（Phase 15）：计划里可选的有氧项 cardio，id 用 r- 前缀；没有这个键的旧计划照样合格，空列表不输出键
test('PLAN-05 normalizePlan accepts optional cardio items with r- ids and a per-session target and rejects malformed or duplicate ones (D-02)', async () => {
  const { DEFAULT_PLAN, normalizePlan } = loadAppPure(NAMES);
  const base = (): any => JSON.parse(JSON.stringify(DEFAULT_PLAN));
  const norm = (p: unknown) => plain(normalizePlan(p));
  const withCardio = (items: unknown): any => ({ ...base(), cardio: items });

  // 没有 cardio 键的旧计划合格且结果没有 cardio；空列表的结果也没有这个键
  const old = base();
  delete old.cardio;
  const oldOut = norm(old);
  expect(oldOut, '没有 cardio 键的计划应当被接受').not.toBeNull();
  expect('cardio' in oldOut, '没有 cardio 键的结果没有 cardio').toBe(false);
  const emptyOut = norm(withCardio([]));
  expect(emptyOut, 'cardio 为空列表的计划应当被接受').not.toBeNull();
  expect('cardio' in emptyOut, 'cardio 为空列表的结果没有 cardio 键').toBe(false);

  // 接受：带目标的、不带目标带归档的、小数目标；缺省的 note 补成空串，其余原样
  const ok = norm(
    withCardio([
      { id: 'r-synth1', n: 'SYNTH-c', note: '', target: { kind: 'min', v: 20 } },
      { id: 'r-synth2', n: 'SYNTH-d', archived: true },
      { id: 'r-synth3', n: 'SYNTH-e', note: 'SYNTH note', target: { kind: 'km', v: 0.5 }, archived: false },
    ]),
  );
  expect(ok?.cardio, '有氧项原样保留').toEqual([
    { id: 'r-synth1', n: 'SYNTH-c', note: '', target: { kind: 'min', v: 20 } },
    { id: 'r-synth2', n: 'SYNTH-d', note: '', archived: true },
    { id: 'r-synth3', n: 'SYNTH-e', note: 'SYNTH note', target: { kind: 'km', v: 0.5 }, archived: false },
  ]);
  expect(norm(ok), '再规整一次结果不变').toEqual(ok);

  // 拒绝：每一种坏法都让整份计划返回 null
  const one = (c: unknown) => withCardio([{ id: 'r-ok', n: 'SYNTH-ok', note: '', ...(c as object) }]);
  const rejected: Array<[string, unknown]> = [
    ['cardio is not an array', withCardio('x')],
    ['cardio is an object', withCardio({})],
    ['item is a string', withCardio(['r-x'])],
    ['id in bare letters', one({ id: 'run' })],
    ['id with the lift prefix', one({ id: 'l-x' })],
    ['id with the group prefix', one({ id: 'g-x' })],
    ['id that is not a string', one({ id: 5 })],
    ['duplicate id', withCardio([{ id: 'r-a', n: 'SYNTH-a' }, { id: 'r-a', n: 'SYNTH-b' }])],
    ['name is not a string', one({ n: 5 })],
    ['name is missing', withCardio([{ id: 'r-a' }])],
    ['note is not a string', one({ note: 5 })],
    ['target kind is mile', one({ target: { kind: 'mile', v: 3 } })],
    ['target v is zero', one({ target: { kind: 'km', v: 0 } })],
    ['target v is negative', one({ target: { kind: 'km', v: -1 } })],
    ['target v is a string', one({ target: { kind: 'min', v: '5' } })],
    ['target is not an object', one({ target: 5 })],
    ['archived is a string', one({ archived: 'yes' })],
  ];
  for (const [name, p] of rejected) expect(norm(p), name).toBeNull();
});

test('PLAN-05 the sample plan carries the frozen cardio ids r-run, r-bike and r-walk and the empty plan has no cardio (D-02, 14 D-01)', async () => {
  const { DEFAULT_PLAN, emptyPlan, planUsedIds, planCardio } = loadAppPure(NAMES);
  const cardio = plain(planCardio(DEFAULT_PLAN));
  expect(cardio.map((c: any) => c.id), '示例有氧项的 id').toEqual(['r-run', 'r-bike', 'r-walk']);
  expect(cardio.map((c: any) => c.target), '示例有氧项的每次目标').toEqual([
    { kind: 'km', v: 5 },
    { kind: 'km', v: 10 },
    { kind: 'min', v: 30 },
  ]);
  expect(Object.keys(plain(emptyPlan())), '空计划的键').not.toContain('cardio');
  expect(plain(planCardio(emptyPlan())), '空计划没有有氧项').toEqual([]);
  expect(plain(planCardio(null)), 'planCardio 对空值给空数组').toEqual([]);
  const used = planUsedIds(DEFAULT_PLAN);
  for (const id of ['r-run', 'r-bike', 'r-walk']) expect(used.has(id), `planUsedIds 含 ${id}`).toBe(true);
});
