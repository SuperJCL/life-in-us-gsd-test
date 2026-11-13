// 健身页趋势图的页面用例（FIT-03、FIT-04；D-08..D-12、S7）。
// 图只由 seriesOf 算出的点画成，用例读 data-date / data-v 和属性，不靠像素。数据全是合成的，动作只用示例计划里的 id 和名称（卧推、深蹲、硬拉、引体）。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY } from '../../support/constants';
import { FC_METRIC, FC_RANGE, FC_SRC_WO, FC_TODAY, fcAria, fcRead, fcTarget } from '../../support/strings';
import { fcStyled, gotoFitness, readCharts } from '../../support/fitness';

type Sets = Array<[number, number]>;
// 一天的训练：每个动作一组组 [重量, 次数]
const wo = (lifts: Record<string, Sets>) => ({
  lifts: Object.entries(lifts).map(([id, sets]) => ({ id, sets: sets.map(([w, r]) => ({ w, r })) })),
  cardio: [],
});
const seed = (workouts: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ _synthetic: true, workouts, ...extra });

// bench 三个训练日（和 charts-data 的单元用例同一份），squat 一天
const BENCH_DAYS = {
  '2026-03-02': wo({ bench: [[20, 8], [22.5, 6]] }),
  '2026-03-09': wo({ bench: [[22.5, 8], [22.5, 8]] }),
  '2026-03-16': wo({ bench: [[25, 5]] }),
};

test('FIT-03 the fitness tab draws one line chart per lift in plan order with heaviest-set points, the dashed target line and the latest reading (D-08, D-10)', async ({
  page,
  app,
}) => {
  await app.open({ seed: seed({ ...BENCH_DAYS, '2026-03-10': wo({ squat: [[30, 5]] }) }) });
  await gotoFitness(page);

  const charts = await readCharts(page);
  // 顺序同编辑计划（示例计划的四个力量项）
  expect(charts.map((c) => c.lift), 'plan order').toEqual(['bench', 'squat', 'dead', 'pull']);

  const bench = charts[0];
  expect(bench.mode, 'bench mode').toBe('weight');
  expect(bench.sub, 'bench sub label').toBe(`${FC_METRIC.max} · kg`);
  // 每个训练日一个点：日期和当天最重的一组，从左到右
  expect(bench.pts.map((p) => [p.date, p.v, p.old]), 'bench points').toEqual([
    ['2026-03-02', '22.5', false],
    ['2026-03-09', '22.5', false],
    ['2026-03-16', '25', false],
  ]);
  expect(bench.pts[0].cx < bench.pts[1].cx && bench.pts[1].cx < bench.pts[2].cx, 'points go left to right').toBe(true);
  expect(bench.linePairs, 'polyline has one pair per point').toBe(3);
  // 目标虚线和标注
  expect(bench.target, 'dashed target line').toBe(true);
  expect(bench.dash, 'stroke-dasharray attribute').toBe('6 4');
  expect(bench.targetText, 'target label').toBe(fcTarget('40', 'kg'));
  // 读数行默认是最新一点
  expect(bench.read, 'latest reading').toBe(fcRead('3月16日', '25', 'kg'));
  // svg 是 role=img，aria-label 带动作、指标、范围、训练次数、最新值和最高值
  expect(bench.role, 'svg role').toBe('img');
  expect(bench.aria, 'svg aria-label').toBe(fcAria('卧推', FC_METRIC.max, FC_RANGE['1m'], 3, '25', '25', 'kg'));
  // viewBox 宽度等于容器像素宽度，没有内联样式属性
  expect(bench.vbW, 'viewBox width is the pixel width').toBe(bench.cw);
  expect(bench.cw, 'the chart has a width').toBeGreaterThan(100);
  expect(await fcStyled(page), 'no style attribute under #fc').toBe(0);
  expect(bench.styled).toBe(0);

  // 其余的图：squat 一个点，dead 和 pull 从来没有记录（此处只确认顺序，空状态在别的用例）
  expect(charts[1].pts.map((p) => [p.date, p.v]), 'squat point').toEqual([['2026-03-10', '30']]);

  // 查看数据：展开后表格 3 行，按日期降序（第一行是 3月16日），来源是「训练」
  await page.locator('#fc figure.fc[data-lift="bench"] .fc-data summary').click();
  await expect(page.locator('#fc figure.fc[data-lift="bench"] .fc-tbl')).toBeVisible();
  const after = (await readCharts(page))[0];
  expect(after.rows, 'table rows').toBe(3);
  expect(after.firstRow, 'newest day first').toBe(`3月16日|25|${FC_SRC_WO}`);
  expect(after.sources, 'sources').toEqual([FC_SRC_WO, FC_SRC_WO, FC_SRC_WO]);
  // 横轴右端写「今天」，今天是冻结的日期
  expect(FROZEN_TODAY).toBe('2026-03-18');
  await expect(page.locator('#fc figure.fc[data-lift="bench"] svg.fc-svg text.fc-tx', { hasText: FC_TODAY })).toHaveCount(1);
});
