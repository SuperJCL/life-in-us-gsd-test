// 趋势图取点的单元用例（FIT-03、FIT-04；D-08、D-09、D-11、D-12）。
// 用 loadAppPure 在 Node 的 vm 里求值应用的纯函数段，不开页面（本机资源有限，见 app-source.ts）。
// 期望值在本文件里独立写出，不读应用的实现；失败消息只写变体名。数据全是合成的，动作 id 只用示例计划里的 bench、pull 等。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';

const NAMES = ['seriesOf', 'rangeStart', 'niceMax', 'DEFAULT_PLAN'] as const;

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
