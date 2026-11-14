// 健身页「本周训练和力量目标」面板的用例（FIT-01、FIT-04；D-07、D-15、S6、A14）。
// 单元用例用 loadAppPure 在 Node 的 vm 里求值 trainDays 和 liftNow；页面用例用合成 state 和示例计划里的动作 id。
// 期望值在本文件里手写，不读应用的实现；失败消息只写变体名和布尔，不带计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../../support/constants';
import {
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
import { flAddLift, flFillSet, flSave, gotoFitness, readFitWeek, readLiftGoals } from '../../support/fitness';

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
