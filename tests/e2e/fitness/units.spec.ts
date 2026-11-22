// 健身页重量单位（kg | lb）的用例（quick-261121-uax，FIT-UNIT）。
// 单位设置存在账号 state 的 wu 字段（只接受 "kg" 和 "lb"，没有就是 kg）；state.workouts 的格式不变，输入和显示在边上换算。
// 单元用例用 loadAppPure 在 Node 的 vm 里求值纯函数；页面用例用合成 state 和示例计划里的动作 id。
// 期望值在本文件里手写，不读应用的实现；失败消息只写变体名、id、日期、个数和布尔，不带计划文字。
import { test, expect } from '../../support/test';
import { loadAppPure } from '../../support/app-source';
import { FROZEN_NOW } from '../../support/constants';
import { WU_LABEL, wuAltText, wuLive } from '../../support/strings';
import { gotoFitness, readLiftGoals, savedWorkouts } from '../../support/fitness';

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
