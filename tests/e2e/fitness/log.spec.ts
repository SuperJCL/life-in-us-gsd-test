// 本文件覆盖 FIT-02 的 tracer：在健身页记一组、保存，保存的 state 只多一条按日期的训练（不进 logs），
// 本周页当天出现一行「健身」行（不可拖动、不是文字记录），刷新后仍在，点这一行回到健身页那一天。
// 只用合成数据和示例计划里的动作 id（bench）；动作名只在期望值里出现，不进失败消息。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../../support/constants';
import {
  TAB_LABELS,
  FL_TITLE_TODAY,
  FL_SAVE_EDIT,
  FL_SAVED,
  FL_STATE_SAVED,
  FL_ERR_RNONE,
  FL_LIVE_UNDONE,
  BTN_UNDO_DELETE,
  fitRow,
  flDeleted,
  peHintErrors,
} from '../../support/strings';
import { flAddLift, flCopySet, flError, flFillSet, flSave, gotoFitness, readFl, readWeekWo, savedWorkouts } from '../../support/fitness';
import { expectToast, expectToastGone } from '../../support/toast';

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

test('FIT-02 recording again on a day that already has a training merges into it, a half-filled set is flagged next to its field, and the whole training can be deleted with an undo (D-06, A5, SC2)', async ({
  page,
  app,
}) => {
  const bench = [
    { w: 20, r: 8 },
    { w: 22.5, r: 6 },
  ];
  const seed = { _synthetic: true, workouts: { [FROZEN_TODAY]: { lifts: [{ id: 'bench', sets: bench }], cardio: [] } } };
  await app.open({ seed });
  await gotoFitness(page);

  // 选到已有训练的日子：状态行、已保存的各组、「保存修改」且不可点
  await expect(page.locator('#fl-state')).toHaveText(FL_STATE_SAVED);
  await expect(page.locator('.fl-ex[data-lift="bench"] .fl-set')).toHaveCount(2);
  await expect(page.locator('#fl-save')).toHaveText(FL_SAVE_EDIT);
  await expect(page.locator('#fl-save')).toHaveAttribute('aria-disabled', 'true');

  // 再加一个动作、复制上一组
  await flAddLift(page, 'squat');
  await flFillSet(page, 'squat', 0, '40', '5');
  await flCopySet(page, 'squat');
  expect(await readFl(page)).toEqual([
    {
      id: 'bench',
      sets: [
        { w: '20', r: '8' },
        { w: '22.5', r: '6' },
      ],
    },
    {
      id: 'squat',
      sets: [
        { w: '40', r: '5' },
        { w: '40', r: '5' },
      ],
    },
  ]);

  // 只填一半：点保存不保存，错误就近显示，字段 aria-invalid，焦点到第一个出错的输入框，提示行写个数
  await page.locator('#fl-r-squat-1').fill('');
  await expect(page.locator('.fl-ex[data-lift="squat"] [data-flact="copyset"]')).toBeDisabled();
  await flSave(page);
  await expect(page.locator('#fl-r-squat-1')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#fl-w-squat-1')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#fl-e-squat-1')).toBeVisible();
  expect(await flError(page, 'squat', 1, FL_ERR_RNONE)).toBe(true);
  await expect(page.locator('#fl-r-squat-1')).toBeFocused();
  await expect(page.locator('#fl-hint')).toHaveText(peHintErrors(1));
  await page.waitForTimeout(700); // 保存有防抖：等一个周期，确认确实没有保存
  const unsaved = await app.saved();
  expect(unsaved === null || JSON.stringify(savedWorkouts(unsaved)) === JSON.stringify(seed.workouts), '半填的训练没有保存').toBe(true);

  // 改好后错误立刻消失，保存：这一天在 state 里是合并后的完整一天，只有一个日期键
  await page.locator('#fl-r-squat-1').fill('5');
  await expect(page.locator('#fl-e-squat-1')).toBeHidden();
  await expect(page.locator('#fl-r-squat-1')).not.toHaveAttribute('aria-invalid', 'true');
  await flSave(page);
  await expectToast(page, FL_SAVED);
  const merged = {
    [FROZEN_TODAY]: {
      lifts: [
        { id: 'bench', sets: bench },
        {
          id: 'squat',
          sets: [
            { w: 40, r: 5 },
            { w: 40, r: 5 },
          ],
        },
      ],
      cardio: [],
    },
  };
  await app.expectSaved((s) => JSON.stringify(savedWorkouts(s)) === JSON.stringify(merged), '等待合并后的训练保存');

  // 删除整次训练：直接删除，toast 带「撤销删除」，workouts 键消失，记录区变空表单，焦点在日期框
  await page.locator('#flDelete').click();
  await expectToast(page, flDeleted('3月18日'));
  await expect(page.locator('#toast.act button')).toHaveText(BTN_UNDO_DELETE);
  await app.expectSaved((s) => !('workouts' in s), '等待训练删除后保存');
  expect(await readFl(page)).toEqual([]);
  await expect(page.locator('#fl-date')).toBeFocused();

  // 撤销：整天原样回来，读屏播报以「已撤销：」开头，没有新的 toast
  await page.locator('#toast.act button').click();
  await app.expectSaved((s) => JSON.stringify(savedWorkouts(s)) === JSON.stringify(merged), '等待撤销后保存');
  await expect(page.locator('#fl-live')).toHaveText(new RegExp(`^${FL_LIVE_UNDONE}`));
  await expectToastGone(page);
  expect((await readFl(page)).map((x) => x.id)).toEqual(['bench', 'squat']);

  // 本周页这一天的训练行
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  const row = await readWeekWo(page, FROZEN_TODAY);
  expect(row?.text).toBe(fitRow('卧推、深蹲（共 4 组）'));
});
