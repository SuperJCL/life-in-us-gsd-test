// normalizePlan 与 usePlan 的单元用例（PLAN-05）。
// 用 loadAppPure 在 Node 的 vm 里求值应用的纯函数段，不开浏览器页面做断言（本机资源限制，见 app-source.ts）。
// 期望值在本文件里独立写出（从 DEFAULT_PLAN 的 JSON 深拷贝改出变体），不抄应用的实现；失败消息只写变体名，不写计划文字。
// normalizePlan 的拒绝分支本阶段没有页面入口（D-11），所以这里是它们唯一的证明；服务器计划进来后由页面路径再覆盖。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { CAT_LANGUAGE } from '../../support/strings';
import { BUILTIN_GROUP_SIZES } from '../../support/task-ids';

const NAMES = ['DEFAULT_PLAN', 'normalizePlan', 'usePlan', 'allTasks'] as const;
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
    ['group name is not a string', (p) => (p.groups[0].name = 5)],
    ['group note is not a string', (p) => (p.groups[1].note = 5)],
    ['task text is not a string', (p) => (p.groups[0].tasks[0].text = 5)],
    ['task archived is not a boolean', (p) => (p.groups[0].tasks[0].archived = 'yes')],
    ['groups is empty', (p) => (p.groups = [])],
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
