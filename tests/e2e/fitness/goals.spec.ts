// 健身页「本周训练和力量目标」面板的用例（FIT-01、FIT-04；D-07、D-15、S6、A14）。
// 单元用例用 loadAppPure 在 Node 的 vm 里求值 trainDays 和 liftNow；页面用例用合成 state 和示例计划里的动作 id。
// 期望值在本文件里手写，不读应用的实现；失败消息只写变体名和布尔，不带计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../../support/constants';
import { serveAppVariant, planValueEdit } from '../../support/app-variant';
import { loadFixture } from '../../support/fixture-files';
import { ALL_LIFT_IDS } from '../../support/task-ids';
import {
  FW_NOTE_BTN,
  FW_NO_TRAINING,
  FW_REACHED,
  TAB_LABELS,
  fwBodyweight,
  fwDaysAria,
  fwGoal,
  fwLast,
  fwPct,
  fwTarget,
  weekFitGoalLine,
} from '../../support/strings';
import { flAddLift, flChipIds, flFillSet, flSave, gotoFitness, readCharts, readFitWeek, readLiftGoals, setRange } from '../../support/fitness';
import { gotoGoals } from '../../support/goals';

const NAMES = ['trainDays', 'liftNow', 'DEFAULT_PLAN'] as const;
const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
const wo = (lifts: Record<string, Array<[number, number]>>) => ({
  lifts: Object.entries(lifts).map(([id, sets]) => ({ id, sets: sets.map(([w, r]) => ({ w, r })) })),
  cardio: [],
});
const log = (id: string, date: string, cat: string) => ({ id, date, cat, text: 'SYNTH-' + id });
const LIFT_IDS = ['bench', 'squat', 'dead', 'pull'] as const;

test('FIT-04 trainDays counts the union of training days and fitness-text days and liftNow takes the heaviest set of the latest training (D-07, D-15)', async () => {
  const { trainDays, liftNow, DEFAULT_PLAN } = loadAppPure(NAMES);

  // 本周 2026-03-16..2026-03-22：三天有训练（16、18、20），两天有健身文字（16 和训练同一天、21），一天是语言记录（19）；范围外的 15 日有训练、23 日有健身文字
  const s = {
    workouts: {
      '2026-03-15': wo({ bench: [[20, 5]] }),
      '2026-03-16': wo({ bench: [[20, 5]] }),
      '2026-03-18': wo({ bench: [[20, 5]] }),
      '2026-03-20': wo({ bench: [[20, 5]] }),
    },
    logs: [
      log('a1', '2026-03-16', '健身'),
      log('a2', '2026-03-21', '健身'),
      log('a3', '2026-03-19', '语言'),
      log('a4', '2026-03-23', '健身'),
    ],
  };
  const days = [...plain([...trainDays(s, '2026-03-16', '2026-03-22')])].sort();
  expect(days, 'union of training and fitness-text days in range').toEqual(['2026-03-16', '2026-03-18', '2026-03-20', '2026-03-21']);
  expect(trainDays(s, '2026-03-16', '2026-03-22').size, 'each day counted once').toBe(4);
  // 范围两端都包含
  expect([...plain([...trainDays(s, '2026-03-15', '2026-03-16')])].sort(), 'both ends are included').toEqual(['2026-03-15', '2026-03-16']);
  expect(trainDays({ logs: [], workouts: undefined }, '2026-03-16', '2026-03-22').size, 'empty state').toBe(0);

  const bench = DEFAULT_PLAN.lifts.find((L: any) => L.id === 'bench');
  // 两天都练过：取日期最大的那一天里最重的一组；同重的两组还是这个值
  const two = {
    workouts: {
      '2026-03-09': wo({ bench: [[30, 5]] }),
      '2026-03-16': wo({ bench: [[35, 5], [40, 3], [40, 8]] }),
    },
  };
  expect(plain(liftNow(two, bench)), 'heaviest set of the latest training').toEqual({ v: 40, date: '2026-03-16', bw: false, reps: 8 });
  // 日期取最大，不管键的顺序
  const rev = { workouts: { '2026-03-16': wo({ bench: [[35, 5]] }), '2026-03-09': wo({ bench: [[90, 5]] }) } };
  expect(plain(liftNow(rev, bench)).v, 'latest day wins over heavier older day').toBe(35);
  // 最近一天全是 0：徒手，reps 是那天最多的次数
  const bw = { workouts: { '2026-03-09': wo({ bench: [[20, 5]] }), '2026-03-16': wo({ bench: [[0, 8], [0, 12], [0, 10]] }) } };
  expect(plain(liftNow(bw, bench)), 'bodyweight latest day').toEqual({ v: 0, date: '2026-03-16', bw: true, reps: 12 });
  // 别的动作的训练不算
  const other = { workouts: { '2026-03-16': wo({ squat: [[30, 5]] }) }, lifts: { bench: { cur: 27.5, hist: [] } } };
  expect(plain(liftNow(other, bench)), 'falls back to the hand-entered value').toEqual({ v: 27.5, date: null, bw: false, reps: 0 });
  // 没有训练也没有手填值：计划起始值（20）
  expect(plain(liftNow({}, bench)), 'falls back to the plan start value').toEqual({ v: 20, date: null, bw: false, reps: 0 });
  // 手填值原样返回，不补零不四舍五入
  expect(plain(liftNow({ lifts: { bench: { cur: 22.5, hist: [] } } }, bench)).v, 'hand-entered value is returned as saved').toBe(22.5);
});

test('FIT-01 the current value of a lift is the heaviest set of its latest training, with the reached mark at the target and the bodyweight line for 0, falling back to the hand-entered value (D-15)', async ({
  page,
  app,
}) => {
  await app.open({
    seed: {
      _synthetic: true,
      workouts: {
        '2026-03-09': wo({ bench: [[30, 5], [25, 8]] }),
        '2026-03-16': wo({ bench: [[35, 5], [40, 3]] }),
        '2026-03-10': wo({ pull: [[0, 8], [0, 10]] }),
      },
      lifts: { squat: { cur: 33, hist: [] } },
    },
  });
  await gotoFitness(page);

  const cards = await readLiftGoals(page, LIFT_IDS);
  // 顺序同编辑计划，不按数值排序
  expect(cards.map((c) => c.lift), 'plan order').toEqual([...LIFT_IDS]);
  const [bench, squat, dead, pull] = cards;

  // bench：最近一次训练（3月16日）里最重的一组 40，等于目标 40：进度 100，已达到目标
  expect(bench.value, 'bench value').toBe('40');
  expect(bench.unit, 'bench unit').toBe(' kg');
  expect(bench.target, 'bench target').toBe(fwTarget('40', 'kg'));
  expect(bench.dataW, 'bench data-w').toBe(100);
  expect(bench.width, 'bench bar width is set through the CSSOM').toBe('100%');
  expect(bench.now, 'bench aria-valuenow').toBe('100');
  expect(bench.captions?.slice(0, 2), 'bench captions').toEqual([`${fwPct(100)}　${FW_REACHED}`, fwLast('3月16日')]);

  // squat：没有训练，回落到以前手填的 33（目标 50 → 66%），说明「还没有训练记录」
  expect(squat.value, 'squat value').toBe('33');
  expect(squat.dataW, 'squat data-w').toBe(66);
  expect(squat.width).toBe('66%');
  expect(squat.captions?.slice(0, 2), 'squat captions').toEqual([fwPct(66), FW_NO_TRAINING]);

  // dead：没有训练也没有手填：计划起始值 50（目标 100 → 50%）
  expect(dead.value, 'dead value').toBe('50');
  expect(dead.dataW, 'dead data-w').toBe(50);
  expect(dead.captions?.slice(0, 2), 'dead captions').toEqual([fwPct(50), FW_NO_TRAINING]);

  // pull：最近一次训练全是 0 × 次：当前值 0，说明里加「徒手完成，最多 10 次」
  expect(pull.value, 'pull value').toBe('0');
  expect(pull.dataW, 'pull data-w').toBe(0);
  expect(pull.captions?.slice(0, 3), 'pull captions').toEqual([fwPct(0), fwLast('3月10日'), fwBodyweight(10)]);

  // 在健身页给 bench 记今天 45 × 3 并保存：当前值立刻变成 45，进度封顶 100%，data-w 不超过 100
  await flAddLift(page, 'bench');
  await flFillSet(page, 'bench', 0, '45', '3');
  await flSave(page);
  await expect.poll(async () => (await readLiftGoals(page, LIFT_IDS))[0].value, { message: 'bench value after saving a training' }).toBe('45');
  const after = (await readLiftGoals(page, LIFT_IDS))[0];
  expect(after.dataW, 'progress is capped at 100').toBe(100);
  expect(after.captions?.slice(0, 2), 'bench captions after saving').toEqual([`${fwPct(100)}　${FW_REACHED}`, fwLast('3月18日')]);
  expect(FROZEN_TODAY).toBe('2026-03-18');
});

test('FIT-01 the week block on the fitness tab and the week view count training days and fitness-text days once each against the weekly goal (D-07, A14)', async ({
  page,
  app,
}) => {
  // 本周 2026-03-16 有训练和一条健身文字，17 日只有健身文字，18 日（今天）只有训练；计划 fitGoal 是 [2,4]
  expect(WEEK_START_FROZEN).toBe('2026-03-16');
  await app.open({
    seed: {
      _synthetic: true,
      workouts: { '2026-03-16': wo({ bench: [[20, 5]] }), '2026-03-18': wo({ squat: [[25, 5]] }) },
      logs: [log('a1', '2026-03-16', '健身'), log('a2', '2026-03-17', '健身')],
    },
  });
  await gotoFitness(page);

  const w = await readFitWeek(page);
  expect(w.n, 'week days on the fitness tab').toBe('3');
  expect(w.goal, 'week goal').toBe(fwGoal(2, 4));
  expect(w.ok, 'reached mark').toBe(FW_REACHED);
  expect(w.dots, 'seven dots').toBe(7);
  expect(w.on, 'filled dots').toEqual(['周一', '周二', '周三']);
  expect(w.today, 'today underline').toBe('周三');
  expect(w.role, 'dots role').toBe('img');
  expect(w.aria, 'dots summary').toBe(fwDaysAria(3, ['周一', '周二', '周三']));

  // 本周页：健身卡用同一个并集，项数 = 两条健身文字 + 两个训练日
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  const card = page.locator('#areas .area.k-fit');
  await expect(card.locator('.goal')).toHaveText(weekFitGoalLine(3, 2, 4));
  await expect(card.locator('.goal')).toHaveClass(/\bok\b/);
  await expect(card.locator('.v')).toHaveText('4项');

  // 删掉今天的训练：两处都变成 2，仍是「已达到目标」
  await gotoFitness(page);
  await page.locator('#flDelete').click();
  await expect.poll(async () => (await readFitWeek(page)).n, { message: 'week days after deleting the training' }).toBe('2');
  const w2 = await readFitWeek(page);
  expect(w2.ok, 'still reached at the minimum').toBe(FW_REACHED);
  expect(w2.on, 'filled dots after deleting').toEqual(['周一', '周二']);
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await expect(card.locator('.goal')).toHaveText(weekFitGoalLine(2, 2, 4));
  await expect(card.locator('.v')).toHaveText('3项');

  // 翻到上一周：本周页按那一周算（0 天，不是 ok），健身页仍按今天所在的周
  await page.locator('#wkPrev').click();
  await expect(card.locator('.goal')).toHaveText(weekFitGoalLine(0, 2, 4));
  await expect(card.locator('.goal')).not.toHaveClass(/\bok\b/);
  await gotoFitness(page);
  expect((await readFitWeek(page)).n, 'fitness tab stays on the current week').toBe('2');
});

test('FIT-01 the fitness note button starts open, remembers being closed on this device and is absent for an empty note (14 D-03)', async ({
  page,
  app,
}) => {
  const { DEFAULT_PLAN } = loadAppPure(['DEFAULT_PLAN']);
  await app.open({ seed: { _synthetic: true } });
  await gotoFitness(page);

  const btn = page.locator('#fwNoteBtn');
  const note = page.locator('#fw-note');
  const key = () => page.evaluate(() => localStorage.getItem('usj:fit:note'));
  const isPlanNote = () => note.evaluate((el, t) => el.textContent === t, DEFAULT_PLAN.fitNote as string);

  // 第一次打开：默认展开，说明是示例计划的 fitNote
  await expect(btn).toHaveText(FW_NOTE_BTN);
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(btn).toHaveAttribute('aria-controls', 'fw-note');
  await expect(note).toBeVisible();
  expect(await isPlanNote(), 'the note shows the plan note').toBe(true);
  expect(await key(), 'no device key before the first close').toBeNull();

  // 收起：aria-expanded 为假、说明隐藏、本机记 closed
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(note).toBeHidden();
  expect(await key(), 'closed is remembered on this device').toBe('closed');

  // 刷新后仍收起
  await app.reload();
  await gotoFitness(page);
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(note).toBeHidden();

  // 再展开：显示说明，键被删掉
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(note).toBeVisible();
  expect(await key(), 'the key is removed when the note is opened again').toBeNull();
});

test('FIT-01 the fitness note and its button are not rendered when the plan note is empty (14 D-03)', async ({ page, app }) => {
  await serveAppVariant(page, [planValueEdit([{ path: 'fitNote', value: '' }])]);
  await app.open({ seed: { _synthetic: true } });
  await gotoFitness(page);
  await expect(page.locator('#fw .fw-days')).toBeVisible();
  await expect(page.locator('#fwNoteBtn')).toHaveCount(0);
  await expect(page.locator('#fw-note')).toHaveCount(0);
});

test('FIT-01 the goals tab no longer shows lift cards and archived lifts stay read-only in its archived area with the current value from trainings (S10, D-15)', async ({
  page,
  app,
}) => {
  const { DEFAULT_PLAN } = loadAppPure(['DEFAULT_PLAN']);
  // 本地版没有编辑计划入口：只在内存里把示例计划的 squat 设成已归档
  await serveAppVariant(page, [
    { find: 'function normalizePlan(', replace: 'DEFAULT_PLAN.lifts.find(L=>L.id==="squat").archived=true;\nfunction normalizePlan(' },
  ]);
  await app.open({
    seed: {
      _synthetic: true,
      workouts: { '2026-03-12': wo({ squat: [[30, 5], [35, 3]] }), '2026-03-16': wo({ bench: [[25, 5]] }) },
    },
  });

  // 目标页：没有力量目标卡、没有手填入口，也没有健身说明
  await gotoGoals(page);
  const counts = await page.evaluate(() => ({
    lifts: document.querySelectorAll('#goals .lifts').length,
    dataLift: document.querySelectorAll('#goals [data-lift]').length,
    save: document.querySelectorAll('#goals [data-liftsave]').length,
    inputs: document.querySelectorAll('#goals [id^="lf-"]').length,
    inputsAnywhere: document.querySelectorAll('input[data-lift]').length,
  }));
  expect(counts, 'no lift card or hand-entry input on the goals tab').toEqual({ lifts: 0, dataLift: 0, save: 0, inputs: 0, inputsAnywhere: 0 });
  expect(
    await page.locator('#goals').evaluate((el, t) => (el.textContent ?? '').includes(t), DEFAULT_PLAN.fitNote as string),
    'the fitness note is not on the goals tab',
  ).toBe(false);

  // 已归档区：squat 只读，当前值是最近一次训练里最重的一组（35），没有输入和按钮
  await page.locator('#goalsArch > summary').click();
  const arch = await page.evaluate(() => {
    const el = document.querySelector('#goalsArch [data-arch="l:squat"]');
    return {
      present: !!el,
      lv: (el?.querySelector('.lv')?.textContent ?? '').startsWith('35'),
      controls: el ? el.querySelectorAll('input, button').length : -1,
    };
  });
  expect(arch, 'archived squat shows the value from its training and no controls').toEqual({ present: true, lv: true, controls: 0 });

  // 健身页：squat 没有卡，记录区芯片里也没有 squat，bench 卡照常在
  await gotoFitness(page);
  expect((await readLiftGoals(page, ALL_LIFT_IDS)).map((c) => c.lift), 'active lifts only').toEqual(['bench', 'dead', 'pull']);
  expect(await flChipIds(page), 'no chip for the archived lift').not.toContain('lift:squat');
});

test('FIT-01 every lift goal card on the fitness tab shows the value, target, progress and caption consistent with the fixture (D-15)', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  const { DEFAULT_PLAN } = loadAppPure(['DEFAULT_PLAN']);
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoFitness(page);

  // 路标：恰好 4 张力量目标卡，顺序同示例计划
  const cards = await readLiftGoals(page, ALL_LIFT_IDS);
  expect(cards).toHaveLength(4);
  expect(cards.map((c) => c.lift)).toEqual([...ALL_LIFT_IDS]);

  // fixture 没有训练：当前值是 fixture 的 cur（没有就是计划起始值），进度按它算（封顶 100），说明是「还没有训练记录」
  for (const c of cards) {
    const id = c.lift as (typeof ALL_LIFT_IDS)[number];
    const L = DEFAULT_PLAN.lifts.find((x: any) => x.id === id);
    const cur: number = fixture.lifts[id]?.cur ?? L.def;
    const pct = Math.min(100, (cur / L.target) * 100);
    expect(c.value === String(cur), `${id} 的当前值应当等于 fixture 的 cur 或计划起始值（内容已隐藏）`).toBe(true);
    expect(c.dataW, `${id} 的进度条 data-w`).toBeCloseTo(pct, 6);
    expect(c.dataW !== null && c.dataW >= 0 && c.dataW <= 100, `${id} 的进度条应当在 0 到 100 之间`).toBe(true);
    expect(c.width?.endsWith('%'), `${id} 的进度条宽度由 CSSOM 设置`).toBe(true);
    expect(parseFloat(c.width ?? ''), `${id} 的进度条宽度和 data-w 一致`).toBeCloseTo(c.dataW ?? NaN, 3);
    const caption = fwPct(Math.round(pct)) + (pct >= 100 ? '　' + FW_REACHED : '');
    expect(c.captions?.slice(0, 2), `${id} 的说明行`).toEqual([caption, FW_NO_TRAINING]);
  }

  // 手填历史在趋势图「全部」范围里是空心点：bench 图的空心点等于 fixture 里不晚于今天的点，按日期升序
  await setRange(page, 'all');
  const bench = (await readCharts(page)).find((c) => c.lift === 'bench');
  const expectedHist = (fixture.lifts.bench.hist as Array<{ date: string; v: number }>)
    .filter((h) => h.date <= FROZEN_TODAY)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-40)
    .map((h) => [h.date, String(h.v)]);
  expect(expectedHist.length, 'the fixture has hand-entered history').toBeGreaterThan(0);
  expect(bench?.pts.filter((p) => p.old).map((p) => [p.date, p.v]), 'hollow points of the bench chart').toEqual(expectedHist);
});
