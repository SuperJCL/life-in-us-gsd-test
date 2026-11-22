// 健身页重量单位（kg | lb）的用例（quick-261121-uax，FIT-UNIT）。
// 单位设置存在账号 state 的 wu 字段（只接受 "kg" 和 "lb"，没有就是 kg）；state.workouts 的格式不变，输入和显示在边上换算。
// 单元用例用 loadAppPure 在 Node 的 vm 里求值纯函数；页面用例用合成 state 和示例计划里的动作 id。
// 期望值在本文件里手写，不读应用的实现；失败消息只写变体名、id、日期、个数和布尔，不带计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { FROZEN_NOW, FROZEN_TODAY } from '../../support/constants';
import { serveAppVariant } from '../../support/app-variant';
import { fullBackup, legacyBackup } from '../../support/backup-files';
import { downloadOf } from '../../support/download';
import { answerNextDialog, chooseImportFile, jsonImportFile } from '../../support/import-file';
import {
  FL_ERR_WRANGE,
  WU_LABEL,
  fcRead,
  fcSub,
  fcTarget,
  fhLiftLine,
  fhLiftUnitLine,
  flColW,
  flLast,
  wuAltText,
  wuLive,
} from '../../support/strings';
import { flAddLift, flError, flFillSet, flSave, gotoFitness, readCharts, readFl, readLiftGoals, savedWorkouts } from '../../support/fitness';

const plain = (v: any): any => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));
const wo = (lifts: Record<string, Array<[number, number]>>) => ({
  lifts: Object.entries(lifts).map(([id, sets]) => ({ id, sets: sets.map(([w, r]) => ({ w, r })) })),
  cardio: [],
});
const LIFT_IDS = ['bench', 'squat', 'dead', 'pull'] as const;

test('FIT-UNIT wuKind, wuConv and wuShow recognise kg and lb unit texts, convert both ways and show at most one decimal', async () => {
  const { wuKind, wuConv, wuShow, wuMain, wuLbl, wuAlt, wuOf } = loadAppPure([
    'wuKind',
    'wuConv',
    'wuShow',
    'wuMain',
    'wuLbl',
    'wuAlt',
    'wuOf',
  ]);

  // 单位文字：kg / 公斤 按 kg，lb / lbs / 磅 按 lb（不分大小写、去首尾空格），其余（次、空、kgs、非字符串）不是重量单位
  expect(['kg', ' KG ', '公斤'].map((u) => wuKind(u)), 'kg spellings').toEqual(['kg', 'kg', 'kg']);
  expect(['lb', 'LBS', '磅'].map((u) => wuKind(u)), 'lb spellings').toEqual(['lb', 'lb', 'lb']);
  expect(['次', '', 'kgs', 5, null, undefined].map((u) => wuKind(u)), 'not weight units').toEqual([null, null, null, null, null, null]);

  // 换算：1 kg = 2.20462262 lb，不做舍入；任一单位不是重量单位或两边相同就原样返回
  expect(wuConv(60, 'kg', 'lb'), 'kg to lb').toBeCloseTo(132.2773572, 6);
  expect(wuConv(135, 'lb', 'kg'), 'lb to kg').toBeCloseTo(61.235, 3);
  expect(wuConv(60, null, 'lb'), 'no source kind').toBe(60);
  expect(wuConv(60, 'kg', null), 'no target kind').toBe(60);
  expect(wuConv(60, 'kg', 'kg'), 'same kind').toBe(60);
  expect(wuConv(60, 'lb', 'lb'), 'same kind lb').toBe(60);

  // 显示：最多 1 位小数，去掉末尾的 .0
  expect(wuShow(132.2773572), 'one decimal').toBe('132.3');
  expect(wuShow(60), 'no trailing zero').toBe('60');
  expect(wuShow(88.18), 'rounds').toBe('88.2');

  // wuMain：力量项自己的单位和所选单位不同才换算，否则保持原文字
  expect(wuMain(40, 'kg', 'kg')).toBe('40');
  expect(wuMain(40, 'kg', 'lb')).toBe('88.2');
  expect(wuMain(40, '次', 'lb')).toBe('40');
  expect(wuMain(25, 'kg', 'lb'), '25 kg').toBe('55.1');
  expect(wuMain(10, 'kg', 'lb'), '10 kg').toBe('22');
  expect(wuMain(135, 'lbs', 'kg'), 'lbs lift in kg').toBe('61.2');
  // 单位标签：换算了就写所选单位，否则保持力量项自己写的文字
  expect(wuLbl('kg', 'lb')).toBe('lb');
  expect(wuLbl('公斤', 'kg')).toBe('公斤');
  expect(wuLbl('次', 'lb')).toBe('次');
  expect(wuLbl('kg', null)).toBe('kg');
  // 灰色小字换算：显示另一种单位；0、非重量单位、非数字没有
  expect(wuAlt(60, 'kg', 'kg')).toBe('≈ 132.3 lb');
  expect(wuAlt(135, 'lb', 'lb')).toBe('≈ 61.2 kg');
  expect(wuAlt(0, 'kg', 'kg')).toBe('');
  expect(wuAlt(5, '次', 'kg')).toBe('');
  expect(wuAlt('x', 'kg', 'kg')).toBe('');
  // 所选单位：只有恰好是 "lb" 才是 lb
  expect(wuOf({})).toBe('kg');
  expect(wuOf({ wu: 'lb' })).toBe('lb');
  expect(wuOf({ wu: 'LB' })).toBe('kg');
  expect(wuOf(null)).toBe('kg');
});

test('FIT-UNIT normalize keeps only kg or lb as the weight unit and backup recognition is unchanged', async () => {
  const { normalize, LEGACY_KEYS, classifyBackup, backupOf, DEFAULT_PLAN } = loadAppPure(['normalize', 'LEGACY_KEYS', 'classifyBackup', 'backupOf', 'DEFAULT_PLAN']);
  const base = { arrival: '2026-01-12', logs: [], custom: [], tasks: {}, lifts: {}, reviews: {}, presets: {} };

  expect(normalize({ ...base, wu: 'lb' }).wu, 'lb is kept').toBe('lb');
  expect(normalize({ ...base, wu: 'kg' }).wu, 'kg is kept').toBe('kg');
  for (const bad of ['LB', 1, null, {}, '<b>', 'lbs', '']) {
    expect(Object.prototype.hasOwnProperty.call(normalize({ ...base, wu: bad }), 'wu'), 'invalid wu leaves no key').toBe(false);
  }
  expect(Object.prototype.hasOwnProperty.call(normalize({ ...base }), 'wu'), 'no wu in, no wu out').toBe(false);

  // 旧备份识别不受影响：八个已知字段不变，wu 不是识别字段
  expect(Object.keys(LEGACY_KEYS), 'legacy keys unchanged').toEqual(['arrival', 'tasks', 'lifts', 'reviews', 'custom', 'logs', 'presets', 'workouts']);
  const full = classifyBackup(backupOf(plain(DEFAULT_PLAN), { ...base, wu: 'lb' }, FROZEN_NOW));
  expect(full && full.kind, 'full backup with wu').toBe('full');
  expect(full && full.state.wu, 'wu travels in a full backup').toBe('lb');
  expect(classifyBackup({ arrival: '', logs: [], wu: 'lb' })?.kind, 'bare legacy object with wu').toBe('legacy');
  expect(classifyBackup({ wu: 'lb' }), 'wu alone is not a backup').toBe(null);
});

test('FIT-UNIT the kg and lb switch on the fitness tab is saved with the account data and the lift goal cards show the chosen unit with the other unit in small grey text', async ({
  page,
  app,
}) => {
  const seedWo = { '2026-03-16': wo({ bench: [[40, 3]] }) };
  await app.open({ seed: { _synthetic: true, workouts: seedWo } });
  await gotoFitness(page);

  const kg = page.locator('[data-wu="kg"]');
  const lb = page.locator('[data-wu="lb"]');
  await expect(page.locator('.fit-unit-l'), 'switch label').toHaveText(WU_LABEL);
  await expect(kg, 'kg is pressed by default').toHaveAttribute('aria-pressed', 'true');
  await expect(lb).toHaveAttribute('aria-pressed', 'false');

  let cards = await readLiftGoals(page, LIFT_IDS);
  let bench = cards.find((c) => c.lift === 'bench')!;
  expect(bench.value, 'bench value in kg').toBe('40');
  expect(bench.unit, 'bench unit in kg').toBe(' kg');
  expect(bench.target, 'bench target in kg').toBe('目标 40 kg');
  expect(bench.valueAlt, 'bench value alt').toBe(wuAltText('88.2', 'lb'));
  expect(bench.targetAlt, 'bench target alt').toBe(wuAltText('88.2', 'lb'));

  await lb.click();
  await expect(lb, 'lb is pressed').toHaveAttribute('aria-pressed', 'true');
  await expect(kg).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#fl-live'), 'live region announces the unit').toHaveText(wuLive('lb'));
  await app.expectSaved((s) => s.wu === 'lb', 'wait for wu saved');
  expect(savedWorkouts(await app.saved()), 'workouts untouched by the unit switch').toEqual(plain(seedWo));

  cards = await readLiftGoals(page, LIFT_IDS);
  bench = cards.find((c) => c.lift === 'bench')!;
  expect(bench.value, 'bench value in lb').toBe('88.2');
  expect(bench.unit, 'bench unit in lb').toBe(' lb');
  expect(bench.target, 'bench target in lb').toBe('目标 88.2 lb');
  expect(bench.valueAlt, 'bench value alt in lb mode').toBe(wuAltText('40', 'kg'));
  expect(bench.targetAlt, 'bench target alt in lb mode').toBe(wuAltText('40', 'kg'));
  // 没有训练的力量项回落到计划起始值（引体 4 kg），同样换算
  const pull = cards.find((c) => c.lift === 'pull')!;
  expect(pull.value, 'pull start value in lb').toBe('8.8');
  expect(pull.valueAlt, 'pull alt in lb mode').toBe(wuAltText('4', 'kg'));
  // 焦点留在点过的开关按钮上（开关是静态标记，重画不会把它换掉）
  await expect(lb, 'focus stays on the clicked button').toBeFocused();

  await app.reload();
  await gotoFitness(page);
  await expect(page.locator('[data-wu="lb"]'), 'lb survives a reload').toHaveAttribute('aria-pressed', 'true');

  await page.locator('[data-wu="kg"]').click();
  await app.expectSaved((s) => s.wu === 'kg', 'wait for wu back to kg');
  cards = await readLiftGoals(page, LIFT_IDS);
  expect(cards.find((c) => c.lift === 'bench')!.value, 'bench back in kg').toBe('40');
});

test('FIT-UNIT wuIn reads back every one-decimal lb value and every two-decimal kg value exactly and reopening then saving never changes a stored weight', async () => {
  const { wuIn, wuConv, woR2, woFromDraft, workoutProblems } = loadAppPure(['wuIn', 'wuConv', 'woR2', 'woFromDraft', 'workoutProblems']);

  // 一位小数的 lb（0 到 1000）存进 kg 力量项再打开，原样读回
  let badLb = 0;
  for (let i = 0; i <= 10000; i++) {
    const x = i / 10;
    if (wuIn(woR2(wuConv(x, 'lb', 'kg')), 'kg', 'lb') !== String(x)) badLb++;
  }
  expect(badLb, 'one-decimal lb values that do not read back').toBe(0);
  // 两位小数的 kg（0 到 453.59）存进 lb 力量项再打开，原样读回
  let badKg = 0;
  for (let i = 0; i <= 45359; i++) {
    const x = i / 100;
    if (wuIn(woR2(wuConv(x, 'kg', 'lb')), 'lb', 'kg') !== String(x)) badKg++;
  }
  expect(badKg, 'two-decimal kg values that do not read back').toBe(0);
  // 任何已存的两位小数，打开再保存不变（两个方向）
  let badRe = 0;
  for (let i = 0; i <= 100000; i++) {
    const s = i / 100;
    if (woR2(wuConv(Number(wuIn(s, 'kg', 'lb')), 'lb', 'kg')) !== s) badRe++;
    if (woR2(wuConv(Number(wuIn(s, 'lb', 'kg')), 'kg', 'lb')) !== s) badRe++;
  }
  expect(badRe, 'stored weights changed by reopen and save').toBe(0);

  expect(wuIn(61.23, 'kg', 'lb')).toBe('135');
  expect(wuIn(20, 'kg', 'lb')).toBe('44.1');
  expect(wuIn(25, 'kg', 'lb')).toBe('55.12');
  expect(wuIn(40, 'kg', 'lb')).toBe('88.18');
  expect(wuIn(22.555, 'kg', 'kg'), 'same unit keeps the text').toBe('22.555');
  expect(wuIn(5, null, 'lb'), 'no weight kind keeps the text').toBe('5');

  // 带换算函数的保存和校验：没有换算函数时和以前完全一样
  const day = (w: string) => ({ lifts: [{ id: 'bench', sets: [{ w, r: '5' }] }], cardio: [] });
  const lb2kg = (_id: string, w: number) => wuConv(w, 'lb', 'kg');
  const kg2lb = (_id: string, w: number) => wuConv(w, 'kg', 'lb');
  expect(plain(woFromDraft(day('135'), lb2kg)).lifts[0].sets[0], 'lb typed, kg stored').toEqual({ w: 61.23, r: 5 });
  expect(plain(woFromDraft(day('135'))).lifts[0].sets[0], 'no converter stores as typed').toEqual({ w: 135, r: 5 });
  const codes = (d: any, cv?: any) => plain(workoutProblems(d, cv)).map((x: any) => x.code);
  expect(codes(day('1000'), lb2kg), '1000 lb fits').toEqual([]);
  expect(codes(day('1000.5'), lb2kg), 'above the plain limit').toEqual(['wrange']);
  expect(codes(day('0.01'), lb2kg), '0.01 lb would store 0 kg').toEqual(['wrange']);
  expect(codes(day('453.59'), kg2lb), '453.59 kg fits a lb lift').toEqual([]);
  expect(codes(day('453.6'), kg2lb), '453.6 kg is above 1000 lb').toEqual(['wconv']);
  expect(codes(day('0.01')), 'no converter: 0.01 passes the plain check').toEqual([]);
  expect(codes(day('1000.5')), 'no converter: above the limit').toEqual(['wrange']);
});

test('FIT-UNIT a weight typed in lb is stored in kg and reads back exactly when reopened, also after switching units with an unsaved draft', async ({
  page,
  app,
}) => {
  await app.open({ seed: { _synthetic: true } });
  await gotoFitness(page);
  const col = (id: string) => page.locator(`.fl-ex[data-lift="${id}"] .fl-cols span`).nth(1);

  await page.locator('[data-wu="lb"]').click();
  await flAddLift(page, 'bench');
  await expect(col('bench'), 'column header names lb').toHaveText(flColW('lb'));
  await flFillSet(page, 'bench', 0, '135', '5');
  await flSave(page);
  await app.expectSaved((s) => !!s.workouts, 'wait for the workout');
  const saved = await app.saved();
  expect(plain(saved.workouts[FROZEN_TODAY].lifts), 'stored in kg').toEqual([{ id: 'bench', sets: [{ w: 61.23, r: 5 }] }]);
  expect(await readFl(page), 'the saved day reopens as typed').toEqual([{ id: 'bench', sets: [{ w: '135', r: '5' }] }]);

  await page.locator('[data-wu="kg"]').click();
  expect((await readFl(page))[0].sets[0].w, 'kg shows the stored value').toBe('61.23');
  await page.locator('[data-wu="lb"]').click();
  expect((await readFl(page))[0].sets[0].w, 'lb is back to 135').toBe('135');

  // 未保存的草稿跟着换：在 kg 下加深蹲填 20，切到 lb 变成 44.1，仍然是「有没保存的内容」，保存后存 20
  await page.locator('[data-wu="kg"]').click();
  await flAddLift(page, 'squat');
  await flFillSet(page, 'squat', 0, '20', '8');
  await page.locator('[data-wu="lb"]').click();
  const fl = await readFl(page);
  expect(fl.find((x) => x.id === 'squat')!.sets[0], 'unsaved draft converted').toEqual({ w: '44.1', r: '8' });
  await expect(page.locator('#flDiscard'), 'draft is still unsaved').toBeVisible();
  await flSave(page);
  await app.expectSaved((s) => (s.workouts?.[FROZEN_TODAY]?.lifts ?? []).length === 2, 'wait for both lifts');
  const lifts = plain((await app.saved()).workouts[FROZEN_TODAY].lifts);
  expect(lifts.find((x: any) => x.id === 'squat').sets[0].w, 'squat stored in kg').toBe(20);
  expect(lifts.find((x: any) => x.id === 'bench').sets[0].w, 'bench unchanged by the second save').toBe(61.23);

  // 超过上限：lb 下输入 1000.5 保存，显示范围错误，已保存的内容不变
  const before = JSON.stringify(plain((await app.saved()).workouts));
  await flFillSet(page, 'bench', 0, '1000.5', '5');
  await flSave(page);
  expect(await flError(page, 'bench', 0, FL_ERR_WRANGE), 'range error text shown').toBe(true);
  expect(JSON.stringify(plain((await app.saved()).workouts)), 'nothing saved with an error').toBe(before);
});

test('FIT-UNIT the log form, history and charts use the chosen unit, a lift counted in reps stays unchanged and a lift kept in lb converts the other way', async ({
  page,
  app,
}) => {
  await serveAppVariant(page, [
    {
      find: 'function normalizePlan(',
      replace:
        'DEFAULT_PLAN.lifts.push({id:"l-synthr",n:"SYNTH-reps",unit:"次",def:5,target:20,note:""});\n' +
        'DEFAULT_PLAN.lifts.push({id:"l-synthp",n:"SYNTH-lbs",unit:"lbs",def:45,target:135,note:""});\nfunction normalizePlan(',
    },
  ]);
  await app.open({
    seed: {
      _synthetic: true,
      workouts: { '2026-03-16': wo({ bench: [[25, 5], [30, 3]], 'l-synthr': [[10, 8]], 'l-synthp': [[135, 5]] }) },
    },
  });
  await gotoFitness(page);
  const IDS = ['bench', 'l-synthr', 'l-synthp'] as const;
  const card = async (id: string) => (await readLiftGoals(page, IDS)).find((c) => c.lift === id)!;

  // kg：lbs 力量项反向换算成 kg，次数项不变
  let p = await card('l-synthp');
  expect([p.value, p.unit, p.valueAlt, p.target], 'lbs lift in kg mode').toEqual(['61.2', ' kg', wuAltText('135', 'lb'), '目标 61.2 kg']);
  let r = await card('l-synthr');
  expect([r.value, r.unit, r.valueAlt, r.targetAlt, r.target], 'reps lift in kg mode').toEqual(['10', ' 次', '', '', '目标 20 次']);

  await page.locator('[data-wu="lb"]').click();
  const b = await card('bench');
  expect([b.value, b.unit, b.valueAlt], 'bench in lb').toEqual(['66.1', ' lb', wuAltText('30', 'kg')]);
  p = await card('l-synthp');
  expect([p.value, p.unit, p.valueAlt], 'lbs lift in lb mode').toEqual(['135', ' lbs', wuAltText('61.2', 'kg')]);
  r = await card('l-synthr');
  expect([r.value, r.unit, r.valueAlt, r.target], 'reps lift unchanged in lb mode').toEqual(['10', ' 次', '', '目标 20 次']);

  // 记录区：参考行、列标题、目标
  for (const id of IDS) await flAddLift(page, id);
  const form = await page.evaluate(() => ({
    last: document.querySelector('.fl-ex[data-lift="bench"] .fl-last')?.textContent ?? '',
    cols: Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>('#fl .fl-ex')).map((x) => [x.dataset.lift, x.querySelectorAll('.fl-cols span')[1]?.textContent ?? '']),
    ),
    tg: Object.fromEntries(
      Array.from(document.querySelectorAll<HTMLElement>('#fl .fl-ex')).map((x) => {
        const t = x.querySelector('.fl-tg')?.cloneNode(true) as HTMLElement | undefined;
        const alt = t?.querySelector('.wu-alt')?.textContent ?? '';
        t?.querySelectorAll('.wu-alt').forEach((e) => e.remove());
        return [x.dataset.lift, [t?.textContent ?? '', alt]];
      }),
    ),
  }));
  expect(form.last, 'last-time line in lb').toBe(flLast('3月16日', '55.1 × 5，66.1 × 3'));
  expect(form.cols, 'column headers').toEqual({ bench: flColW('lb'), 'l-synthp': flColW('lbs'), 'l-synthr': flColW('次') });
  expect(form.tg.bench, 'bench target with grey alt').toEqual(['目标 88.2 lb', wuAltText('40', 'kg')]);
  expect(form.tg['l-synthr'], 'reps target without alt').toEqual(['目标 20 次', '']);

  // 训练历史：名称后带单位，另一种单位的范围灰色小字；次数项不变
  const hist = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#fh .fh-item[data-fh="2026-03-16"] .fh-body > p')).map((q) => {
      const a = q.querySelector('.wu-alt');
      const c = q.cloneNode(true) as HTMLElement;
      c.querySelectorAll('.wu-alt').forEach((e) => e.remove());
      return [c.textContent ?? '', a?.textContent ?? ''];
    }),
  );
  expect(hist[0], 'bench history line in lb').toEqual([fhLiftUnitLine('卧推', 'lb', '55.1 × 5，66.1 × 3'), '≈ 25～30 kg']);
  expect(hist[1], 'reps history line unchanged').toEqual([fhLiftLine('SYNTH-reps', '10 × 8'), '']);
  expect(hist[2], 'lbs history line in lb').toEqual([fhLiftUnitLine('SYNTH-lbs', 'lbs', '135 × 5'), '≈ 61.2 kg']);

  // 趋势图：只显示所选单位
  const bench = (await readCharts(page)).find((c) => c.lift === 'bench')!;
  expect(bench.sub, 'chart sub').toBe(fcSub('max', 'lb'));
  expect(bench.targetText, 'chart target label').toBe(fcTarget('88.2', 'lb'));
  expect(bench.read, 'chart reading').toBe(fcRead('3月16日', '66.1', 'lb'));
  expect(bench.pts.map((q) => q.v), 'chart points').toEqual(['66.1']);

  // 回到 kg：lbs 力量项按 kg 输入 61.23 保存存成 134.99，再打开读回 61.23
  await app.reload();
  await gotoFitness(page);
  await page.locator('[data-wu="kg"]').click();
  await flAddLift(page, 'l-synthp');
  await flFillSet(page, 'l-synthp', 0, '61.23', '5');
  await flSave(page);
  await app.expectSaved((s) => !!s.workouts?.[FROZEN_TODAY], 'wait for the lbs lift');
  expect(plain((await app.saved()).workouts[FROZEN_TODAY].lifts), 'stored in the lift own unit').toEqual([{ id: 'l-synthp', sets: [{ w: 134.99, r: 5 }] }]);
  expect(await readFl(page), 'reopens as typed').toEqual([{ id: 'l-synthp', sets: [{ w: '61.23', r: '5' }] }]);
});

test('FIT-UNIT the fitness tab in lb has no horizontal overflow at 375 px and the unit switch stays usable', async ({ page, app }) => {
  await app.open({ seed: { _synthetic: true, workouts: { '2026-03-16': wo({ bench: [[40, 3]] }) }, wu: 'lb' } });
  await page.setViewportSize({ width: 375, height: 800 });
  await gotoFitness(page);
  await expect(page.locator('[data-wu="lb"]'), 'seeded lb is pressed').toHaveAttribute('aria-pressed', 'true');
  await flAddLift(page, 'bench');
  await flFillSet(page, 'bench', 0, '135', '5');

  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const tab = document.getElementById('tab-fit')!;
    const btns = Array.from(document.querySelectorAll<HTMLElement>('[data-wu]')).map((b) => {
      const r = b.getBoundingClientRect();
      return { h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
    });
    return {
      doc: de.scrollWidth <= de.clientWidth,
      tab: tab.scrollWidth <= tab.clientWidth,
      cards: Array.from(document.querySelectorAll<HTMLElement>('.fw-lift')).every((c) => c.scrollWidth <= c.clientWidth),
      btns,
    };
  });
  expect(m.doc, 'document does not scroll sideways').toBe(true);
  expect(m.tab, 'fitness tab does not scroll sideways').toBe(true);
  expect(m.cards, 'no lift card overflows').toBe(true);
  expect(m.btns.length, 'two unit buttons').toBe(2);
  expect(m.btns.every((x) => x.visible && x.h >= 44), 'unit buttons visible and at least 44 px high').toBe(true);
});

// 导出导入（本地模式，写法同 tests/e2e/io 下的导出和导入用例）：下载只在内存里比较；导入文件只在内存里构造，名字以 synth- 开头
test.describe('FIT-UNIT backup', () => {
  test.use({ acceptDownloads: true });

  test('FIT-UNIT a JSON backup carries the weight unit, importing it restores lb, and an old backup or an invalid value falls back to kg', async ({ page, app }) => {
    const seedWo = { '2026-03-16': wo({ bench: [[40, 3]] }) };
    await app.open({ seed: { _synthetic: true, workouts: seedWo, wu: 'lb' } });
    await gotoFitness(page);
    await expect(page.locator('[data-wu="lb"]'), 'seeded lb is pressed').toHaveAttribute('aria-pressed', 'true');

    // 导出：完整备份的 state 带 wu，训练和已保存的一致
    const { text } = await downloadOf(page, () => page.locator('#exportJson').click());
    const backup = JSON.parse(text);
    expect(backup.kind, 'full backup').toBe('full');
    expect(backup.state.wu, 'backup carries the unit').toBe('lb');
    expect(backup.state.workouts, 'backup carries the workouts').toEqual(plain(seedWo));

    const importFile = async (name: string, value: unknown) => {
      const dialogs = answerNextDialog(page, 'accept');
      await chooseImportFile(page, jsonImportFile(name, value));
      await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
    };

    // 先切到 kg，再导入这份备份：wu 随整份数据替换，回到 lb
    await page.locator('[data-wu="kg"]').click();
    await app.expectSaved((s) => s.wu === 'kg', 'wait for kg saved');
    await importFile('synth-unit-roundtrip.json', backup);
    await app.expectSaved((s) => s.wu === 'lb', 'wait for lb restored');
    await expect(page.locator('[data-wu="lb"]'), 'lb pressed after import').toHaveAttribute('aria-pressed', 'true');

    // 旧备份（没有 wu）：导入后没有这个键，回到 kg
    await importFile('synth-unit-legacy.json', legacyBackup('uw1'));
    await app.expectSaved((s) => s.logs.some((l: any) => l.id === 'synth-uw1-1'), 'wait for the legacy import');
    expect(Object.prototype.hasOwnProperty.call(await app.saved(), 'wu'), 'old backup leaves no unit').toBe(false);
    await expect(page.locator('[data-wu="kg"]'), 'kg pressed after the old backup').toHaveAttribute('aria-pressed', 'true');

    // 带非法 wu 的完整备份：被接受，wu 被丢掉，还是 kg
    await page.locator('[data-wu="lb"]').click();
    await app.expectSaved((s) => s.wu === 'lb', 'wait for lb saved again');
    await importFile('synth-unit-invalid.json', fullBackup(backup.plan, { ...legacyBackup('uw2'), wu: 'LB' }));
    await app.expectSaved((s) => s.logs.some((l: any) => l.id === 'synth-uw2-1'), 'wait for the invalid-unit import');
    expect(Object.prototype.hasOwnProperty.call(await app.saved(), 'wu'), 'invalid unit is dropped').toBe(false);
    await expect(page.locator('[data-wu="kg"]'), 'kg pressed after the invalid unit').toHaveAttribute('aria-pressed', 'true');
  });
});
