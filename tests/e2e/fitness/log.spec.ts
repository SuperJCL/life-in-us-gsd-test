// 本文件覆盖 FIT-02 的 tracer：在健身页记一组、保存，保存的 state 只多一条按日期的训练（不进 logs），
// 本周页当天出现一行「健身」行（不可拖动、不是文字记录），刷新后仍在，点这一行回到健身页那一天。
// 只用合成数据和示例计划里的动作 id（bench）；动作名只在期望值里出现，不进失败消息。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../../support/constants';
import { TAB_LABELS, FL_TITLE_TODAY, FL_SAVE_EDIT, FL_SAVED, fitRow } from '../../support/strings';
import { flAddLift, flFillSet, flSave, gotoFitness, readWeekWo, savedWorkouts } from '../../support/fitness';
import { expectToast } from '../../support/toast';

test('FIT-02 a set recorded on the fitness tab is saved for today, shows as a fitness row in the week view and reopens from that row after a reload (D-05, D-06)', async ({
  page,
  app,
}) => {
  const seed = {
    _synthetic: true,
    logs: [{ id: 'synthetic-fit1', date: WEEK_START_FROZEN, cat: '语言', text: 'SYNTH-fit seed record' }],
  };
  await app.open({ seed });

  // 第五个标签：点它 #tab-fit 显示，其余四个视图隐藏
  await gotoFitness(page);
  for (const k of ['wk', 'cal', 'goal', 'tl']) await expect(page.locator(`#tab-${k}`)).toBeHidden();
  await expect(page.locator('#fl-title')).toHaveText(FL_TITLE_TODAY);
  await expect(page.locator('#fl-date')).toHaveValue(FROZEN_TODAY);
  await expect(page.locator('#fl-date')).toHaveAttribute('max', FROZEN_TODAY);
  await expect(page.locator('#fl-save')).toHaveAttribute('aria-disabled', 'true');

  // 点「＋ 卧推」：出现一个动作块，里面一行空组，焦点在第一个重量框
  await flAddLift(page, 'bench');
  await expect(page.locator('.fl-ex[data-lift="bench"] .fl-set')).toHaveCount(1);
  await expect(page.locator('#fl-w-bench-0')).toBeFocused();

  await flFillSet(page, 'bench', 0, '20', '8');
  await flSave(page);
  await expectToast(page, FL_SAVED);
  await app.expectSaved(
    (s) =>
      JSON.stringify(savedWorkouts(s)) ===
        JSON.stringify({ [FROZEN_TODAY]: { lifts: [{ id: 'bench', sets: [{ w: 20, r: 8 }] }], cardio: [] } }) &&
      Array.isArray(s.logs) &&
      s.logs.length === seed.logs.length,
    '等待训练保存（训练只进 workouts，logs 条数不变）',
  );
  await expect(page.locator('#fl-save')).toHaveText(FL_SAVE_EDIT);

  const checkWeekRow = async () => {
    await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
    const row = await readWeekWo(page, FROZEN_TODAY);
    expect(row).toEqual({ text: fitRow('卧推（共 1 组）'), draggable: false, edit: false });
  };
  await checkWeekRow();
  await app.reload();
  await checkWeekRow();

  // 点这一行：回到健身页，记录区载入这一天，焦点在标题
  await page.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`).click();
  await expect(page.locator('#tab-fit')).toBeVisible();
  await expect(page.locator('#fl-title')).toBeFocused();
  await expect(page.locator('#fl-title')).toHaveText(FL_TITLE_TODAY);
  await expect(page.locator('.fl-ex[data-lift="bench"] .fl-set')).toHaveCount(1);
  await expect(page.locator('#fl-w-bench-0')).toHaveValue('20');
  await expect(page.locator('#fl-r-bench-0')).toHaveValue('8');
  await expect(page.locator('#fl-save')).toHaveText(FL_SAVE_EDIT);
});
