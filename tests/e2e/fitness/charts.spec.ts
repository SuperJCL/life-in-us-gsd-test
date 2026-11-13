// 健身页趋势图的页面用例（FIT-03、FIT-04；D-08..D-12、S7）。
// 图只由 seriesOf 算出的点画成，用例读 data-date / data-v 和属性，不靠像素。数据全是合成的，动作只用示例计划里的 id 和名称（卧推、深蹲、硬拉、引体）。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY, STATE_KEY } from '../../support/constants';
import { serveAppVariant } from '../../support/app-variant';
import {
  BTN_FC_NEXT,
  BTN_FC_PREV,
  FC_EMPTY_RANGE,
  FC_GRP_METRIC,
  FC_GRP_RANGE,
  FC_HAND,
  FC_LEGEND,
  FC_METRIC,
  FC_MNOTE_BW,
  FC_MNOTE_E1RM,
  FC_MNOTE_MAX,
  FC_MNOTE_VOL,
  FC_ONCE,
  FC_RANGE,
  FC_SRC_HAND,
  FC_SRC_WO,
  FC_SUB_RMAX,
  FC_TODAY,
  fcAria,
  fcEmptyNone,
  fcLivePage,
  fcLiveSwitch,
  fcPage,
  fcRead,
  fcReadAt,
  fcSub,
  fcTarget,
} from '../../support/strings';
import { fcStyled, gotoFitness, readCharts, readPager, readPointer, setMetric, setRange } from '../../support/fitness';

type Sets = Array<[number, number]>;
// 一天的训练：每个动作一组组 [重量, 次数]
const wo = (lifts: Record<string, Sets>) => ({
  lifts: Object.entries(lifts).map(([id, sets]) => ({ id, sets: sets.map(([w, r]) => ({ w, r })) })),
  cardio: [],
});
const seed = (workouts: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ _synthetic: true, workouts, ...extra });

// bench 三个训练日（和 charts-data 的单元用例同一份）
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

  // 其余的图：squat 一个点（dead 和 pull 从来没有记录，空状态在别的用例）
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

test('FIT-03 the metric chips switch every chart and the time range chips default to one month and are remembered on this device (D-08, D-11)', async ({
  page,
  app,
}) => {
  await app.open({ seed: seed({ ...BENCH_DAYS, '2026-01-10': wo({ bench: [[15, 5]] }) }) });
  await gotoFitness(page);

  // 三个指标芯片、五个范围芯片：默认「最大重量」和「最近 1 个月」按下，组标签是「指标」「时间范围」
  await expect(page.locator('#fc [data-fc-metric]')).toHaveCount(3);
  await expect(page.locator('#fc [data-fc-range]')).toHaveCount(5);
  await expect(page.locator('#fc [data-fc-metric="max"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fc [data-fc-range="1m"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fc .fc-seg').nth(0)).toHaveAttribute('aria-label', FC_GRP_METRIC);
  await expect(page.locator('#fc .fc-seg').nth(1)).toHaveAttribute('aria-label', FC_GRP_RANGE);
  await expect(page.locator('#fc-mnote')).toHaveText(FC_MNOTE_MAX);
  expect((await readCharts(page))[0].pts.map((p) => p.date), 'one month hides the January day').toEqual(['2026-03-02', '2026-03-09', '2026-03-16']);

  // 总训练量：每张图的小标都换了、目标虚线全部消失、说明和读屏播报跟着变
  await setMetric(page, 'vol');
  let charts = await readCharts(page);
  expect(charts.map((c) => c.sub), 'every chart switched').toEqual(['kg', 'kg', 'kg', 'kg'].map((u) => fcSub('vol', u)));
  expect(charts.some((c) => c.target), 'no target line under total volume').toBe(false);
  await expect(page.locator('#fc .fc-tgt')).toHaveCount(0);
  await expect(page.locator('#fc-mnote')).toHaveText(FC_MNOTE_VOL);
  await expect(page.locator('#fc-live')).toHaveText(fcLiveSwitch(FC_METRIC.vol, FC_RANGE['1m']));
  expect(charts[0].pts.map((p) => p.v), 'volume points').toEqual(['295', '360', '125']);

  // 估算单次最大：点值是 Epley，目标线回来了
  await setMetric(page, 'e1rm');
  charts = await readCharts(page);
  expect(charts[0].pts.map((p) => p.v), 'Epley points').toEqual(['27', '28.5', '29.2']);
  expect(charts[0].target, 'target line under the estimate').toBe(true);
  await expect(page.locator('#fc-mnote')).toHaveText(FC_MNOTE_E1RM);
  await setMetric(page, 'max');

  // 3 个月：一月的那天出现；选中项记在这台设备的 usj:fit:range
  await setRange(page, '3m');
  expect((await readCharts(page))[0].pts.map((p) => p.date), 'three months shows January').toEqual(['2026-01-10', '2026-03-02', '2026-03-09', '2026-03-16']);
  await expect(page.locator('#fc-live')).toHaveText(fcLiveSwitch(FC_METRIC.max, FC_RANGE['3m']));
  expect(await page.evaluate(() => localStorage.getItem('usj:fit:range'))).toBe('3m');

  // 刷新：范围还是 3 个月，指标回到最大重量
  await setMetric(page, 'vol');
  await app.reload();
  await gotoFitness(page);
  await expect(page.locator('#fc [data-fc-range="3m"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fc [data-fc-range="1m"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#fc [data-fc-metric="max"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await readCharts(page))[0].pts.length, 'January day is still shown after the reload').toBe(4);

  // 不认识的存储值回到 1 个月
  await page.evaluate(() => localStorage.setItem('usj:fit:range', 'bogus'));
  await app.reload();
  await gotoFitness(page);
  await expect(page.locator('#fc [data-fc-range="1m"]')).toHaveAttribute('aria-pressed', 'true');
  expect((await readCharts(page))[0].pts.length, 'back to one month').toBe(3);
});

test('FIT-03 charts are paged four at a time on a desktop and three at 375 px with previous and next and the group number (D-10)', async ({
  page,
  app,
}) => {
  // 示例计划只有 4 个力量项：只在内存里给这一个页面再加一个合成项，应用文件不动
  await serveAppVariant(page, [
    {
      find: 'function normalizePlan(',
      replace: 'DEFAULT_PLAN.lifts.push({id:"l-synth5",n:"SYNTH-lift 5",unit:"kg",def:0,target:10,note:""});\nfunction normalizePlan(',
    },
  ]);
  await app.open({ seed: seed({ '2026-03-16': wo({ bench: [[25, 5]] }) }) });
  await gotoFitness(page);

  // 1280 宽：第一页 4 张，上一组真 disabled
  let pg = await readPager(page);
  expect(pg.present, 'pager is rendered for five lifts').toBe(true);
  expect(pg.lifts, 'first page').toEqual(['bench', 'squat', 'dead', 'pull']);
  expect(pg.page).toBe(fcPage(1, 2));
  expect(pg.prevDisabled && !pg.nextDisabled, 'previous is disabled on the first page').toBe(true);
  expect(pg.cols, 'two columns on a desktop').toBe(2);
  await expect(page.locator('#fcPrev')).toHaveText(BTN_FC_PREV);
  await expect(page.locator('#fcNext')).toHaveText(BTN_FC_NEXT);

  // 下一组：只剩第 5 个；到边缘时焦点移到上一组；读屏播报以「第 2 / 2 组：」开头
  await page.locator('#fcNext').click();
  pg = await readPager(page);
  expect(pg.lifts, 'second page').toEqual(['l-synth5']);
  expect(pg.page).toBe(fcPage(2, 2));
  expect(pg.nextDisabled && !pg.prevDisabled, 'next is disabled on the last page').toBe(true);
  expect(pg.focused, 'focus moved to the other button').toBe('fcPrev');
  expect(pg.live.startsWith(fcLivePage(2, 2, '')), 'live announcement').toBe(true);
  expect(await page.evaluate(() => window.scrollY), 'paging does not scroll the page').toBe(0);

  // 窄屏 375：新页号 = floor(4 ÷ 3) = 1，第 2 / 2 组，每页 3 张，单列
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.locator('#fc-page')).toHaveText(fcPage(2, 2));
  pg = await readPager(page);
  expect(pg.lifts, 'second page at 375 px').toEqual(['pull', 'l-synth5']);
  expect(pg.cols, 'one column at 375 px').toBe(1);

  // 回到 1280：新页号 = floor(3 ÷ 4) = 0
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('#fc-page')).toHaveText(fcPage(1, 2));
  pg = await readPager(page);
  expect(pg.lifts, 'first page again').toEqual(['bench', 'squat', 'dead', 'pull']);
  expect(pg.cols).toBe(2);
});

test('FIT-03 a lift with no records, none in the range or a single point shows its explanation, and a bodyweight lift charts reps without a target line (D-09, S7)', async ({
  page,
  app,
}) => {
  await app.open({
    seed: seed({
      '2026-03-16': wo({ bench: [[25, 5]], pull: [[0, 5], [0, 8]] }),
      '2026-03-09': wo({ pull: [[0, 7]] }),
      '2026-01-10': wo({ squat: [[30, 5]] }),
    }),
  });
  await gotoFitness(page);
  const c = Object.fromEntries((await readCharts(page)).map((x) => [x.lift, x]));

  // 从来没有记录
  expect(c.dead.empty, 'no record at all').toBe(fcEmptyNone('硬拉'));
  expect(c.dead.emptyH, 'empty chart area keeps its height').toBe(160);
  expect(c.dead.pts.length + c.dead.linePairs, 'nothing drawn').toBe(0);
  // 有记录但范围里没有
  expect(c.squat.empty, 'nothing in the range').toBe(FC_EMPTY_RANGE);
  expect(c.squat.emptyH).toBe(160);
  // 只有一个点：照常画点和目标线，图下一行说明，读数行显示这一点
  expect(c.bench.pts.length, 'one point').toBe(1);
  expect(c.bench.target, 'target line stays with one point').toBe(true);
  expect(c.bench.notes).toEqual([FC_ONCE]);
  expect(c.bench.hasOnce).toBe(true);
  expect(c.bench.read).toBe(fcRead('3月16日', '25', 'kg'));
  expect(c.bench.empty).toBeNull();

  // 徒手：data-mode=reps，小标写实际画的指标，不画目标线，指标说明句末加一句
  expect(c.pull.mode).toBe('reps');
  expect(c.pull.sub).toBe(FC_SUB_RMAX);
  expect(c.pull.target, 'no target line for a bodyweight lift').toBe(false);
  expect(c.pull.pts.map((p) => [p.date, p.v]), 'most reps in a set per day').toEqual([['2026-03-09', '7'], ['2026-03-16', '8']]);
  expect(c.pull.read).toBe(fcRead('3月16日', '8', '次'));
  await expect(page.locator('#fc-mnote')).toHaveText(FC_MNOTE_MAX + FC_MNOTE_BW);

  // 41 个训练日：只画折线和最后一个点；40 个训练日：全部画点
  const days = (n: number) => {
    const out: Record<string, unknown> = {};
    for (let i = 0; i < n; i += 1) {
      const d = new Date(Date.UTC(2026, 2, 18 - i));
      out[d.toISOString().slice(0, 10)] = wo({ bench: [[20 + (i % 5), 5]] });
    }
    return out;
  };
  const load = async (n: number) => {
    const state = JSON.stringify({ _synthetic: true, workouts: days(n) });
    await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STATE_KEY, state] as const);
    await app.reload();
    await gotoFitness(page);
    await setRange(page, 'all');
    return (await readCharts(page)).find((x) => x.lift === 'bench')!;
  };
  const b41 = await load(41);
  expect(b41.pts.length, '41 points: only the last one is drawn').toBe(1);
  expect(b41.pts[0].date).toBe('2026-03-18');
  expect(b41.linePairs, 'but the polyline has every point').toBe(41);
  const b40 = await load(40);
  expect(b40.pts.length, '40 points: all drawn').toBe(40);
  expect(b40.linePairs).toBe(40);
});

test('FIT-04 hand-entered lift history appears as hollow points on the heaviest-set chart with the legend and in the data table (15-CONTEXT)', async ({
  page,
  app,
}) => {
  await app.open({
    seed: seed(
      { '2026-03-16': wo({ bench: [[25, 5]] }) },
      {
        lifts: {
          bench: {
            cur: 25,
            hist: [
              { date: '2026-03-01', v: 18 },
              { date: '2026-03-16', v: 21 },
              { date: '2026-03-17', v: 30 },
            ],
          },
        },
      },
    ),
  });
  await gotoFitness(page);

  let bench = (await readCharts(page))[0];
  // 手填的两天画空心点，和训练点在同一条折线上；和训练同一天的手填点不画
  expect(bench.pts.map((p) => [p.date, p.v, p.old]), 'hand-entered points are hollow').toEqual([
    ['2026-03-01', '18', true],
    ['2026-03-16', '25', false],
    ['2026-03-17', '30', true],
  ]);
  expect(bench.linePairs, 'one polyline through every point').toBe(3);
  expect(bench.hasLegend, 'legend under the chart').toBe(true);
  expect(bench.notes).toEqual([FC_LEGEND]);
  // 最新一点是手填的：读数行加「（手填）」；摘要的训练次数只数训练点
  expect(bench.read).toBe(fcRead('3月17日', '30', 'kg') + FC_HAND);
  expect(bench.aria).toBe(fcAria('卧推', FC_METRIC.max, FC_RANGE['1m'], 1, '30', '30', 'kg'));
  // 查看数据：来源列「手填」「训练」
  await page.locator('#fc figure.fc[data-lift="bench"] .fc-data summary').click();
  bench = (await readCharts(page))[0];
  expect(bench.sources, 'source column, newest first').toEqual([FC_SRC_HAND, FC_SRC_WO, FC_SRC_HAND]);

  // 估算单次最大：没有空心点、没有图例
  await setMetric(page, 'e1rm');
  bench = (await readCharts(page))[0];
  expect(bench.pts.some((p) => p.old), 'no hollow point under the estimate').toBe(false);
  expect(bench.hasLegend, 'no legend under the estimate').toBe(false);
});

test('FIT-03 the charts carry no style attribute, show the value under the pointer and offer a data table for keyboard and screen reader users (A8)', async ({
  page,
  app,
}) => {
  await app.open({ seed: seed(BENCH_DAYS) });
  await gotoFitness(page);
  expect(await fcStyled(page), 'no style attribute under #fc').toBe(0);

  // 指针：鼠标移到第一个点上，读数行换成那一点，竖线移过去，点放大到 r=6
  const first = (await readCharts(page))[0].pts[0];
  const svgEl = page.locator('#fc figure.fc[data-lift="bench"] svg.fc-svg');
  await svgEl.scrollIntoViewIfNeeded();
  const box = await svgEl.boundingBox();
  if (!box) throw new Error('bench svg has no box');
  await page.mouse.move(box.x + first.cx, box.y + box.height / 2);
  await expect.poll(async () => (await readPointer(page, 'bench')).read, { message: 'reading under the pointer' }).toBe(fcReadAt('3月2日', '22.5', 'kg'));
  let ptr = await readPointer(page, 'bench');
  expect(ptr.selX, 'vertical line sits on the point').toBe(first.cx);
  expect(ptr.radii, 'the point under the pointer grows').toEqual({ '2026-03-02': '6', '2026-03-09': '4', '2026-03-16': '4' });
  // 移出：读数回到最新，r 回到 4
  await page.mouse.move(2, 2);
  await expect.poll(async () => (await readPointer(page, 'bench')).read, { message: 'reading after the pointer left' }).toBe(fcRead('3月16日', '25', 'kg'));
  ptr = await readPointer(page, 'bench');
  expect(ptr.radii, 'radii restored').toEqual({ '2026-03-02': '4', '2026-03-09': '4', '2026-03-16': '4' });
  expect(ptr.selX, 'line hidden again').toBeLessThan(0);
  expect(await fcStyled(page), 'pointer reading writes attributes only').toBe(0);

  // 键盘：从最后一个范围芯片 Tab 到第一张图的「查看数据」，Enter 展开，表格可聚焦
  await page.locator('#fc [data-fc-range="all"]').focus();
  await page.keyboard.press('Tab');
  const summary = page.locator('#fc figure.fc[data-lift="bench"] .fc-data summary');
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#fc figure.fc[data-lift="bench"] .fc-data')).toHaveAttribute('open', '');
  const tbl = page.locator('#fc figure.fc[data-lift="bench"] .fc-tbl');
  await tbl.focus();
  await expect(tbl).toBeFocused();

  // 视口宽度变了：只重画图组，svg 的 viewBox 宽度跟着容器变，展开的表格保持展开
  const before = (await readCharts(page))[0];
  await page.setViewportSize({ width: 700, height: 800 });
  await expect.poll(async () => (await readCharts(page))[0].vbW, { message: 'viewBox follows the container' }).not.toBe(before.vbW);
  const after = (await readCharts(page))[0];
  expect(after.vbW, 'viewBox width equals the pixel width after the resize').toBe(after.cw);
  await expect(page.locator('#fc figure.fc[data-lift="bench"] .fc-data')).toHaveAttribute('open', '');
});
