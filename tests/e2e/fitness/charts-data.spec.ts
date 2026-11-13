// 趋势图取点的单元用例（FIT-03、FIT-04；D-08、D-09、D-11、D-12）。
// 用 loadAppPure 在 Node 的 vm 里求值应用的纯函数段，不开页面（本机资源有限，见 app-source.ts）。
// 期望值在本文件里独立写出，不读应用的实现；失败消息只写变体名。数据全是合成的，动作 id 只用示例计划里的 bench、pull 等。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';

const NAMES = ['seriesOf', 'rangeStart', 'niceMax', 'cardioWeeks', 'DEFAULT_PLAN'] as const;

// JSON 往返：把 vm 里的对象换成本 realm 的普通对象再比较
const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
const day = (lifts: Array<{ id: string; sets: Array<[number, number]> }>) => ({
  lifts: lifts.map((x) => ({ id: x.id, sets: x.sets.map(([w, r]) => ({ w, r })) })),
  cardio: [],
});

test('FIT-03 seriesOf gives the heaviest set, the Epley estimate and the volume per training day and keeps hand-entered history only for the heaviest set (D-08, 15-CONTEXT)', async () => {
  const { seriesOf, DEFAULT_PLAN } = loadAppPure(NAMES);
  const T = '2026-03-18';
  const state = {
    workouts: {
      '2026-03-02': day([{ id: 'bench', sets: [[20, 8], [22.5, 6]] }]),
      '2026-03-09': day([{ id: 'bench', sets: [[22.5, 8], [22.5, 8]] }]),
      '2026-03-16': day([{ id: 'bench', sets: [[25, 5]] }]),
    },
    lifts: { bench: { cur: 25, hist: [{ date: '2026-02-20', v: 18 }, { date: '2026-03-09', v: 21 }] } },
  };
  const run = (metric: string) => plain(seriesOf(state, DEFAULT_PLAN, 'bench', metric, '1m', T));

  // 最大重量：手填的 2026-02-20 排在最前（空心点），同一天（03-09）有训练就只留训练点；同一天两组重量相同不重复计点
  const max = run('max');
  expect(max.mode, 'max mode').toBe('weight');
  expect(
    max.pts.map((p: any) => [p.date, p.v, !!p.old]),
    'max points',
  ).toEqual([
    ['2026-02-20', 18, true],
    ['2026-03-02', 22.5, false],
    ['2026-03-09', 22.5, false],
    ['2026-03-16', 25, false],
  ]);
  expect(max.any, 'max any').toBe(true);

  // 估算单次最大：每组 w ×（1 + r ÷ 30）先取 1 位小数，再取当天最大；手填点不出现
  const e1 = run('e1rm');
  expect(e1.pts.map((p: any) => [p.date, p.v]), 'e1rm points').toEqual([
    ['2026-03-02', 27],
    ['2026-03-09', 28.5],
    ['2026-03-16', 29.2],
  ]);
  expect(e1.pts.some((p: any) => p.old), 'e1rm has no hand-entered point').toBe(false);

  // 总训练量：当天所有组 w × r 之和；手填点不出现
  const vol = run('vol');
  expect(vol.pts.map((p: any) => [p.date, p.v]), 'vol points').toEqual([
    ['2026-03-02', 295],
    ['2026-03-09', 360],
    ['2026-03-16', 125],
  ]);
  expect(vol.pts.some((p: any) => p.old), 'vol has no hand-entered point').toBe(false);
});

test('FIT-03 seriesOf charts reps for a lift whose every set is 0, keeps the range start inclusive and the day before out, and orders points by date (D-09, D-11)', async () => {
  const { seriesOf, rangeStart, DEFAULT_PLAN } = loadAppPure(NAMES);
  const T = '2026-03-18';
  const pts = (s: any, id: string, metric: string, range = '1m', t = T) =>
    plain(seriesOf(s, DEFAULT_PLAN, id, metric, range, t)).pts.map((p: any) => [p.date, p.v]);

  // 徒手：全部组 w 为 0 → reps；max 和 e1rm 都是每天最多的次数，vol 是每天次数之和（乱序写入的天输出升序）
  const bw = {
    workouts: {
      '2026-03-16': day([{ id: 'pull', sets: [[0, 5], [0, 8]] }]),
      '2026-03-02': day([{ id: 'pull', sets: [[0, 6]] }]),
      '2026-03-09': day([{ id: 'pull', sets: [[0, 7], [0, 7], [0, 3]] }]),
    },
  };
  const r = plain(seriesOf(bw, DEFAULT_PLAN, 'pull', 'max', '1m', T));
  expect(r.mode, 'bodyweight mode').toBe('reps');
  expect(pts(bw, 'pull', 'max'), 'reps max, ascending by date').toEqual([['2026-03-02', 6], ['2026-03-09', 7], ['2026-03-16', 8]]);
  expect(pts(bw, 'pull', 'e1rm'), 'reps e1rm').toEqual([['2026-03-02', 6], ['2026-03-09', 7], ['2026-03-16', 8]]);
  expect(pts(bw, 'pull', 'vol'), 'reps vol').toEqual([['2026-03-02', 6], ['2026-03-09', 17], ['2026-03-16', 13]]);

  // 有一组 w 大于 0 → weight；手填历史里有大于 0 的值也是 weight
  const withW = { workouts: { '2026-03-16': day([{ id: 'pull', sets: [[0, 5], [2.5, 8]] }]) } };
  expect(plain(seriesOf(withW, DEFAULT_PLAN, 'pull', 'max', '1m', T)).mode, 'one weighted set').toBe('weight');
  const withHist = { workouts: bw.workouts, lifts: { pull: { cur: 4, hist: [{ date: '2025-12-01', v: 4 }] } } };
  expect(plain(seriesOf(withHist, DEFAULT_PLAN, 'pull', 'max', '1m', T)).mode, 'positive hand-entered value').toBe('weight');
  // 判断看全部历史：范围里只剩全 0 的点，范围外有加重的组，仍是 weight
  const wide = {
    workouts: {
      '2025-06-01': day([{ id: 'pull', sets: [[5, 5]] }]),
      '2026-03-16': day([{ id: 'pull', sets: [[0, 8]] }]),
    },
  };
  expect(plain(seriesOf(wide, DEFAULT_PLAN, 'pull', 'max', '1m', T)).mode, 'mode ignores the range').toBe('weight');

  // 范围起点
  expect(rangeStart('1m', T)).toBe('2026-02-18');
  expect(rangeStart('3m', T)).toBe('2025-12-18');
  expect(rangeStart('6m', T)).toBe('2025-09-18');
  expect(rangeStart('1y', T)).toBe('2025-03-18');
  expect(rangeStart('all', T), 'all has no start').toBeNull();
  expect(rangeStart('x', T), 'unknown value counts as 1m').toBe('2026-02-18');
  expect(rangeStart('constructor', T), 'inherited property names count as 1m').toBe('2026-02-18');
  expect(rangeStart('1m', '2026-03-31'), 'the month has no such day').toBe('2026-02-28');
  expect(rangeStart('1y', '2024-02-29'), 'leap day a year back').toBe('2023-02-28');

  // 起点当天在范围里，前一天不在
  const edge = {
    workouts: {
      '2026-02-17': day([{ id: 'bench', sets: [[20, 5]] }]),
      '2026-02-18': day([{ id: 'bench', sets: [[21, 5]] }]),
    },
  };
  expect(pts(edge, 'bench', 'max'), 'start day in, day before out').toEqual([['2026-02-18', 21]]);
  expect(pts(edge, 'bench', 'max', 'all').length, 'all keeps both').toBe(2);

  // 没有任何记录：any 为 false；只有范围外的记录：any 为 true、pts 为空；晚于今天的训练不算
  const none = plain(seriesOf({}, DEFAULT_PLAN, 'bench', 'max', '1m', T));
  expect(none).toEqual({ mode: 'weight', pts: [], any: false });
  const old = plain(seriesOf({ workouts: { '2025-06-01': day([{ id: 'bench', sets: [[20, 5]] }]) } }, DEFAULT_PLAN, 'bench', 'max', '1m', T));
  expect(old.any, 'record outside the range counts').toBe(true);
  expect(old.pts, 'but nothing inside the range').toEqual([]);
  const future = plain(seriesOf({ workouts: { '2026-03-19': day([{ id: 'bench', sets: [[20, 5]] }]) } }, DEFAULT_PLAN, 'bench', 'max', '1m', T));
  expect(future, 'a day after today is ignored').toEqual({ mode: 'weight', pts: [], any: false });

  // 手填值不是有限数不画
  const bad = { lifts: { bench: { cur: 20, hist: [{ date: '2026-03-01', v: 'x' }, { date: '2026-03-02', v: 20 }] } } };
  expect(pts(bad, 'bench', 'max'), 'non-numeric hand-entered value is skipped').toEqual([['2026-03-02', 20]]);
});

test('FIT-03 niceMax and cardioWeeks give clean axis tops and one slot per week with empty weeks at 0 (A6, D-12)', async () => {
  const { niceMax, cardioWeeks } = loadAppPure(NAMES);
  // 纵轴上限：{1,2,4,5,10}×10ⁿ 里不小于 v×1.05 的最小者；0 或空为 1
  const cases: Array<[any, number]> = [
    [0, 1],
    [0.9, 1],
    [1, 2],
    [42.5, 50],
    [47.6, 50],
    [47.7, 100],
    [95, 100],
    [190, 200],
    [380, 400],
    [1000, 2000],
    [-3, 1],
    [NaN, 1],
    [undefined, 1],
  ];
  for (const [v, want] of cases) expect(niceMax(v), `niceMax(${String(v)})`).toBe(want);

  const T = '2026-03-18';
  const cd = (items: Array<[string, number]>) => ({ lifts: [], cardio: items.map(([id, m]) => ({ id, m })) });
  const state = {
    workouts: {
      '2026-03-02': cd([['r-run', 30], ['r-walk', 20]]),
      '2026-03-04': cd([['r-bike', 45]]),
      '2026-03-20': cd([['r-run', 99]]), // 晚于今天，不计
      '2026-03-10': day([{ id: 'bench', sets: [[20, 5]] }]), // 只有力量，不算有氧天
    },
  };
  const weeks = plain(cardioWeeks(state, '1m', T));
  expect(
    weeks.map((w: any) => [w.wk, w.m, w.k]),
    'one slot per week from the Monday of the range start to this Monday',
  ).toEqual([
    ['2026-02-16', 0, 0],
    ['2026-02-23', 0, 0],
    ['2026-03-02', 95, 2],
    ['2026-03-09', 0, 0],
    ['2026-03-16', 0, 0],
  ]);

  // all 从最早有氧那一周开始；没有任何有氧时是空数组
  const early = { workouts: { '2026-01-07': cd([['r-run', 10]]), '2026-03-17': cd([['r-run', 15]]) } };
  const all = plain(cardioWeeks(early, 'all', T));
  expect(all[0], 'all starts at the earliest cardio week').toEqual({ wk: '2026-01-05', m: 10, k: 1 });
  expect(all.length, 'one slot per week up to this week').toBe(11);
  expect(all[all.length - 1], 'this week').toEqual({ wk: '2026-03-16', m: 15, k: 1 });
  expect(plain(cardioWeeks({ workouts: { '2026-03-10': day([{ id: 'bench', sets: [[20, 5]] }]) } }, 'all', T)), 'no cardio at all').toEqual([]);
  expect(plain(cardioWeeks({}, 'all', T)), 'empty state').toEqual([]);
});
