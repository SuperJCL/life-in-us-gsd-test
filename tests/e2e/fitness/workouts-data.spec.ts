// state.workouts 的数据模型单元用例（FIT-02、FIT-04、FIT-05；D-02、D-06、SEC-01）。
// 用 loadAppPure 在 Node 的 vm 里求值应用的纯函数段，不开页面（本机资源有限，见 app-source.ts）。
// 期望值在本文件里独立写出，不读应用的实现；失败消息只写变体名。数据全是合成的；动作和有氧项名称只来自示例计划（卧推、深蹲、硬拉、引体、跑步、骑行、快走）。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { FIT_GONE_CARDIO, FIT_GONE_LIFT } from '../../support/strings';

const NAMES = ['normalize', 'importProblem', 'classifyBackup', 'backupOf', 'woSummary', 'woPut', 'woDel', 'woMap', 'woFromDraft', 'workoutProblems', 'DEFAULT_PLAN'] as const;

// JSON 往返：把 vm 里的对象换成本 realm 的普通对象再比较
const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const D1 = '2026-03-16';
const D2 = '2026-03-17';
const D3 = '2026-03-18';

test('FIT-05 normalize keeps well-formed workouts unchanged, repairs bad values without dropping the day and leaves out an empty workouts map', async () => {
  const { normalize } = loadAppPure(NAMES);
  const run = (workouts: unknown): any => plain(normalize({ workouts }));
  const one = (day: unknown): any => run({ [D1]: day })?.workouts?.[D1];

  // 合格数据逐字不变，再 normalize 一次仍相同（含徒手 0、小数 22.5、边界值、有距离和没距离的有氧）
  const good = {
    [D1]: {
      lifts: [
        { id: 'bench', sets: [{ w: 0, r: 8 }, { w: 22.5, r: 6 }, { w: 1000, r: 999 }, { w: 1, r: 1 }] },
        { id: 'l-x1', sets: [{ w: 100, r: 1 }] },
      ],
      cardio: [{ id: 'r-run', m: 30, d: 5.5 }, { id: 'r-bike', m: 1440 }, { id: 'r-walk', m: 1, d: 1000 }],
    },
    [D2]: { lifts: [{ id: 'squat', sets: [{ w: 30, r: 5 }] }], cardio: [] },
  };
  const first = run(clone(good));
  expect(first.workouts, '合格数据原样保留').toEqual(good);
  expect(plain(normalize(first)), '再 normalize 一次结果不变').toEqual(first);

  const lift = (sets: unknown[]) => ({ lifts: [{ id: 'bench', sets }], cardio: [] });
  // 不合格的组各自丢掉，其余的组和这一天都保留
  const badW = one(lift([{ w: -1, r: 5 }, { w: 1000.5, r: 5 }, { w: '20', r: 5 }, { w: null, r: 5 }, { w: 20, r: 5 }]));
  expect(badW, 'bad weights').toEqual(lift([{ w: 20, r: 5 }]));
  const badR = one(lift([{ w: 20, r: 0 }, { w: 20, r: 2.5 }, { w: 20, r: 1000 }, { w: 20, r: '8' }, { w: 20, r: 999 }, { w: 20, r: 1 }]));
  expect(badR, 'bad reps').toEqual(lift([{ w: 20, r: 999 }, { w: 20, r: 1 }]));
  const many = Array.from({ length: 21 }, (_, i) => ({ w: i + 1, r: 5 }));
  expect(one(lift(many)).lifts[0].sets, 'more than 20 sets').toEqual(many.slice(0, 20));
  expect(one(lift([{ w: 20, r: 5 }, 'x', null, { w: 30 }])), 'sets that are not objects or lack a value').toEqual(lift([{ w: 20, r: 5 }]));

  // 同一天里重复的动作 id、有氧 id 只留第一条
  const dup = one({
    lifts: [{ id: 'bench', sets: [{ w: 10, r: 5 }] }, { id: 'bench', sets: [{ w: 99, r: 9 }] }],
    cardio: [{ id: 'r-run', m: 10 }, { id: 'r-run', m: 99 }],
  });
  expect(dup, 'duplicate ids').toEqual({ lifts: [{ id: 'bench', sets: [{ w: 10, r: 5 }] }], cardio: [{ id: 'r-run', m: 10 }] });

  // 有氧：时长不合格整条丢掉，距离不合格只删距离；一边坏了另一边和这一天都保留
  const cardio = (items: unknown[]) => ({ lifts: [{ id: 'bench', sets: [{ w: 10, r: 5 }] }], cardio: items });
  const badM = one(cardio([{ id: 'r-run', m: 0 }, { id: 'r-bike', m: 1441 }, { id: 'r-walk', m: 30.5 }, { id: 'r-a', m: '30' }, { id: 'r-b', m: 20 }]));
  expect(badM, 'bad cardio minutes').toEqual(cardio([{ id: 'r-b', m: 20 }]));
  const badD = one(cardio([{ id: 'r-run', m: 30, d: 0 }, { id: 'r-bike', m: 30, d: 1001 }, { id: 'r-walk', m: 30, d: -1 }, { id: 'r-a', m: 30, d: '5' }, { id: 'r-b', m: 30, d: 1000 }]));
  expect(badD, 'bad cardio distance').toEqual(
    cardio([{ id: 'r-run', m: 30 }, { id: 'r-bike', m: 30 }, { id: 'r-walk', m: 30 }, { id: 'r-a', m: 30 }, { id: 'r-b', m: 30, d: 1000 }]),
  );

  // 动作 id 或有氧 id 不合格的条目丢掉；坏日期键和不是对象的天丢掉，同一份里合格的天保留
  const mixed = run({
    '2026-02-31': lift([{ w: 1, r: 1 }]),
    '2026-3-1': lift([{ w: 1, r: 1 }]),
    [D2]: 'text',
    [D3]: [1, 2],
    '2026-03-19': null,
    [D1]: {
      lifts: [{ id: 'L-x', sets: [{ w: 1, r: 1 }] }, { id: 'bench', sets: [{ w: 5, r: 5 }] }, { id: 'r-run', sets: [{ w: 5, r: 5 }] }],
      cardio: [{ id: 'run', m: 5 }, { id: 'l-x', m: 5 }, { id: 'r-ok', m: 5 }],
    },
  });
  expect(mixed.workouts, 'bad keys, non-object days and bad ids').toEqual({
    [D1]: { lifts: [{ id: 'bench', sets: [{ w: 5, r: 5 }] }], cardio: [{ id: 'r-ok', m: 5 }] },
  });

  // 只剩坏数据的天整天消失；没有任何天时结果里没有 workouts 键
  expect('workouts' in plain(normalize({})), 'no workouts key in the input').toBe(false);
  expect('workouts' in run({}), 'empty object').toBe(false);
  expect('workouts' in run([]), 'array').toBe(false);
  expect(
    'workouts' in run({ [D1]: { lifts: [{ id: 'bench', sets: [{ w: -1, r: 0 }] }], cardio: [{ id: 'r-run', m: 0 }] }, [D2]: { lifts: [], cardio: [] } }),
    'all days dropped',
  ).toBe(false);
  expect(
    run({ [D1]: { lifts: [{ id: 'bench', sets: [{ w: -1, r: 0 }] }] }, [D2]: lift([{ w: 5, r: 5 }]) }).workouts,
    'a day with only bad data disappears alone',
  ).toEqual({ [D2]: lift([{ w: 5, r: 5 }]) });
});

test('FIT-05 importProblem rejects workouts with a bad date key or a malformed lift or cardio id and accepts empty and well-formed ones', async () => {
  const { importProblem, classifyBackup, backupOf, DEFAULT_PLAN } = loadAppPure(NAMES);
  const day = (extra: Record<string, unknown> = {}) => ({ lifts: [{ id: 'bench', sets: [{ w: 20, r: 8 }] }], cardio: [{ id: 'r-run', m: 30 }], ...extra });
  const bad: Array<[string, unknown]> = [
    ['bad date key', { '2026-2-3': day() }],
    ['impossible date key', { '2026-02-31': day() }],
    ['day is an array', { [D1]: [] }],
    ['day is a string', { [D1]: 'x' }],
    ['lift entry is a string', { [D1]: day({ lifts: ['bench'] }) }],
    ['cardio entry is a string', { [D1]: day({ cardio: ['r-run'] }) }],
    ['lift id with capital', { [D1]: day({ lifts: [{ id: 'L-x', sets: [] }] }) }],
    ['lift id with the cardio prefix', { [D1]: day({ lifts: [{ id: 'r-run', sets: [] }] }) }],
    ['lift entry without id', { [D1]: day({ lifts: [{ sets: [] }] }) }],
    ['cardio id in bare letters', { [D1]: day({ cardio: [{ id: 'run', m: 5 }] }) }],
    ['cardio id with the lift prefix', { [D1]: day({ cardio: [{ id: 'l-x', m: 5 }] }) }],
  ];
  for (const [name, workouts] of bad) {
    expect(importProblem({ workouts }), name).toBe('workout');
    expect(classifyBackup({ workouts }), `${name} (classifyBackup)`).toBeNull();
  }
  // 没有 workouts、空的、合格的都没有问题
  expect(importProblem({}), 'no workouts').toBeNull();
  expect(importProblem({ workouts: {} }), 'empty workouts').toBeNull();
  expect(importProblem({ workouts: { [D1]: day(), [D2]: { lifts: [], cardio: [] } } }), 'well-formed workouts').toBeNull();
  // 数值范围不在这里查（交给 normalize）
  expect(importProblem({ workouts: { [D1]: day({ lifts: [{ id: 'bench', sets: [{ w: -5, r: 0 }] }] }) } }), 'values are left to normalize').toBeNull();

  // 只带 workouts 的文件被认成旧备份；完整备份的 state 里有合格 workouts 也认得出，坏的整份拒绝
  const good = { [D1]: day() };
  const legacy = plain(classifyBackup({ workouts: good }));
  expect(legacy?.kind, 'a file with only workouts').toBe('legacy');
  const full = plain(classifyBackup(backupOf(DEFAULT_PLAN, { workouts: good }, '2026-03-18T00:00:00.000Z')));
  expect(full?.kind, 'a full backup with workouts').toBe('full');
  expect(full?.state?.workouts, 'workouts travel in the state unchanged').toEqual(good);
  expect(classifyBackup(backupOf(DEFAULT_PLAN, { workouts: { '2026-2-3': day() } }, '2026-03-18T00:00:00.000Z')), 'a full backup with a bad workouts key').toBeNull();
  expect(classifyBackup({ workouts: [] }), 'workouts that is not an object').toBeNull();
});

test('FIT-04 woSummary names at most three lifts and two cardio items with the set total and counts the rest', async () => {
  const { woSummary, DEFAULT_PLAN } = loadAppPure(NAMES);
  const p = clone(plain(DEFAULT_PLAN));
  const set = { w: 20, r: 8 };
  const L = (id: string, n: number) => ({ id, sets: Array.from({ length: n }, () => set) });
  const sum = (day: unknown, plan: unknown = p) => woSummary(day, plan);

  expect(sum({ lifts: [L('bench', 2)], cardio: [] }), 'one lift').toBe('卧推（共 2 组）');
  expect(sum({ lifts: [L('bench', 2), L('squat', 2), L('dead', 2), L('pull', 1)], cardio: [] }), 'four lifts').toBe('卧推、深蹲、硬拉等 4 项（共 7 组）');
  expect(sum({ lifts: [L('bench', 1), L('squat', 1), L('dead', 1)], cardio: [] }), 'exactly three lifts').toBe('卧推、深蹲、硬拉（共 3 组）');
  expect(sum({ lifts: [], cardio: [{ id: 'r-walk', m: 30 }] }), 'cardio without distance').toBe('快走 30 分钟');
  expect(sum({ lifts: [], cardio: [{ id: 'r-run', m: 30, d: 5 }] }), 'cardio with distance').toBe('跑步 30 分钟（5 公里）');
  expect(sum({ lifts: [], cardio: [{ id: 'r-run', m: 30 }, { id: 'r-bike', m: 20, d: 7.5 }] }), 'two cardio items').toBe('跑步 30 分钟、骑行 20 分钟（7.5 公里）');
  expect(sum({ lifts: [], cardio: [{ id: 'r-run', m: 30 }, { id: 'r-bike', m: 20 }, { id: 'r-walk', m: 10 }] }), 'three cardio items').toBe('跑步 30 分钟、骑行 20 分钟等 3 项');
  expect(sum({ lifts: [L('bench', 2)], cardio: [{ id: 'r-walk', m: 30 }] }), 'both parts').toBe('卧推（共 2 组） · 快走 30 分钟');
  // 计划里找不到的 id 写固定的两句；归档的项照样用自己的名字
  expect(sum({ lifts: [L('l-gone', 1)], cardio: [{ id: 'r-gone', m: 5 }] }), 'ids missing from the plan').toBe(`${FIT_GONE_LIFT}（共 1 组） · ${FIT_GONE_CARDIO} 5 分钟`);
  const archived = clone(p);
  archived.lifts[0].archived = true;
  archived.cardio[0].archived = true;
  expect(sum({ lifts: [L('bench', 1)], cardio: [{ id: 'r-run', m: 5 }] }, archived), 'archived items keep their names').toBe('卧推（共 1 组） · 跑步 5 分钟');
  // 空的一天
  expect(sum({ lifts: [], cardio: [] }), 'empty day').toBe('');
  expect(sum(null), 'no day').toBe('');
  expect(sum(undefined), 'undefined day').toBe('');
});

test('FIT-02 a whole-day workout write is idempotent and only touches its own date, and removing the last day drops the workouts key', async () => {
  const { woPut, woDel, woMap, woFromDraft } = loadAppPure(NAMES);
  const dayA = { lifts: [{ id: 'bench', sets: [{ w: 20, r: 8 }] }], cardio: [] };
  const dayB = { lifts: [], cardio: [{ id: 'r-run', m: 30 }] };
  const dayNew = { lifts: [{ id: 'squat', sets: [{ w: 30, r: 5 }] }], cardio: [{ id: 'r-walk', m: 10, d: 1.5 }] };
  const start = () => ({ logs: [], workouts: { [D1]: clone(dayA), [D2]: clone(dayB) } });

  // 同一份内容写两次与写一次相同，别的日子逐字不变
  const once: any = start();
  woPut(once, D3, dayNew);
  const twice: any = start();
  woPut(twice, D3, dayNew);
  woPut(twice, D3, dayNew);
  expect(plain(twice), 'twice equals once').toEqual(plain(once));
  expect(plain(once.workouts[D1]), 'other day A untouched').toEqual(dayA);
  expect(plain(once.workouts[D2]), 'other day B untouched').toEqual(dayB);
  expect(plain(once.workouts[D3]), 'the written day').toEqual(dayNew);
  expect(plain(once.logs), 'logs untouched').toEqual([]);

  // 整天覆盖：已有的这一天被整个换掉，不是合并
  const over: any = start();
  woPut(over, D1, dayNew);
  expect(plain(over.workouts), 'whole-day overwrite').toEqual({ [D1]: dayNew, [D2]: dayB });

  // 闭包里带着的内容被深拷贝：写入之后再改传进去的对象，state 不变
  const carried = clone(dayNew);
  const target: any = start();
  woPut(target, D3, carried);
  carried.lifts[0].sets[0].w = 999;
  expect(plain(target.workouts[D3]), 'written value is a copy').toEqual(dayNew);

  // 没有 workouts 键的 state 会建出这个键；woMap 对缺省和不是对象的值都给空对象
  const bare: any = { logs: [] };
  woPut(bare, D3, dayNew);
  expect('workouts' in bare, 'woPut creates the key').toBe(true);
  expect(plain(woMap({ logs: [] })), 'woMap of a state without workouts').toEqual({});
  expect(plain(woMap({ workouts: [] })), 'woMap of a non-object').toEqual({});
  expect(plain(woMap(null)), 'woMap of null').toEqual({});

  // 两个数组都空的一天等同删除；删到最后一天时 workouts 键一起去掉
  const emptied: any = start();
  woPut(emptied, D1, { lifts: [], cardio: [] });
  expect(plain(emptied.workouts), 'an empty day deletes that day').toEqual({ [D2]: dayB });
  woPut(emptied, D2, { lifts: [], cardio: [] });
  expect('workouts' in emptied, 'the last day removed drops the key (woPut)').toBe(false);
  const del: any = { logs: [], workouts: { [D1]: clone(dayA) } };
  woDel(del, D2);
  expect('workouts' in del, 'deleting a date that is not there keeps the others').toBe(true);
  woDel(del, D1);
  expect('workouts' in del, 'the last day removed drops the key (woDel)').toBe(false);
  expect(() => woDel({ logs: [] }, D1), 'woDel on a state without workouts').not.toThrow();

  // woFromDraft：整行空的组丢掉、顺序保持、22.555 存成 22.56、没填距离就不带 d、没有组的动作丢掉
  const draft = {
    lifts: [
      { id: 'squat', sets: [{ w: '', r: '' }, { w: '22.555', r: '5' }, { w: '0', r: '8' }] },
      { id: 'bench', sets: [{ w: '', r: '' }] },
      { id: 'dead', sets: [{ w: '50', r: '3' }] },
    ],
    cardio: [{ id: 'r-bike', m: '45', d: '' }, { id: 'r-run', m: '30', d: '5.5' }],
  };
  expect(plain(woFromDraft(draft)), 'draft to saved day').toEqual({
    lifts: [{ id: 'squat', sets: [{ w: 22.56, r: 5 }, { w: 0, r: 8 }] }, { id: 'dead', sets: [{ w: 50, r: 3 }] }],
    cardio: [{ id: 'r-bike', m: 45 }, { id: 'r-run', m: 30, d: 5.5 }],
  });
});

test('FIT-02 workoutProblems reports half-filled rows, out-of-range values and empty blocks in page order with the agreed keys', async () => {
  const { workoutProblems } = loadAppPure(NAMES);
  const probs = (d: unknown) => plain(workoutProblems(d)).map((x: any) => `${x.key}=${x.code}`);
  const row = (w: string, r: string) => ({ w, r });

  // 整行空不报；只填了一半才报；一个动作没有任何非空行报 exnone
  expect(probs({ lifts: [{ id: 'bench', sets: [row('', ''), row('20', '8')] }], cardio: [] }), 'a full row and an empty row').toEqual([]);
  expect(probs({ lifts: [{ id: 'bench', sets: [row('20', '')] }], cardio: [] }), 'reps missing').toEqual(['fl:0:0:r=rnone']);
  expect(probs({ lifts: [{ id: 'bench', sets: [row('', '8')] }], cardio: [] }), 'weight missing').toEqual(['fl:0:0:w=wnone']);
  expect(probs({ lifts: [{ id: 'bench', sets: [row('', '')] }, { id: 'squat', sets: [] }], cardio: [] }), 'blocks without any filled row').toEqual([
    'fl:0:ex=exnone',
    'fl:1:ex=exnone',
  ]);
  // 边界含端点
  expect(probs({ lifts: [{ id: 'bench', sets: [row('0', '1'), row('1000', '999')] }], cardio: [] }), 'bounds are inclusive').toEqual([]);
  expect(probs({ lifts: [{ id: 'bench', sets: [row('-1', '8'), row('1000.5', '8'), row('abc', '8')] }], cardio: [] }), 'weight out of range').toEqual([
    'fl:0:0:w=wrange',
    'fl:0:1:w=wrange',
    'fl:0:2:w=wrange',
  ]);
  expect(probs({ lifts: [{ id: 'bench', sets: [row('20', '0'), row('20', '2.5'), row('20', '1000')] }], cardio: [] }), 'reps out of range').toEqual([
    'fl:0:0:r=rint',
    'fl:0:1:r=rint',
    'fl:0:2:r=rint',
  ]);
  // 第 21 行
  const rows21 = Array.from({ length: 21 }, () => row('20', '8'));
  expect(probs({ lifts: [{ id: 'bench', sets: rows21 }], cardio: [] }), 'a twenty-first row').toEqual(['fl:0:20:w=slimit']);
  // 有氧：时长必填（含整块空），距离可选
  expect(probs({ lifts: [], cardio: [{ id: 'r-run', m: '', d: '' }] }), 'a cardio block left empty').toEqual(['fc:0:m=mnone']);
  expect(
    probs({ lifts: [], cardio: [{ id: 'r-run', m: '30', d: '' }, { id: 'r-bike', m: '1441', d: '0' }, { id: 'r-walk', m: '30.5', d: '1001' }] }),
    'cardio values',
  ).toEqual(['fc:1:m=mint', 'fc:1:d=drange', 'fc:2:m=mint', 'fc:2:d=drange']);
  expect(probs({ lifts: [], cardio: [{ id: 'r-run', m: '1', d: '1000' }, { id: 'r-bike', m: '1440', d: '0.5' }] }), 'cardio bounds are inclusive').toEqual([]);
});
