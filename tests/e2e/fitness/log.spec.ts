// 本文件覆盖 FIT-02 的 tracer：在健身页记一组、保存，保存的 state 只多一条按日期的训练（不进 logs），
// 本周页当天出现一行「健身」行（不可拖动、不是文字记录），刷新后仍在，点这一行回到健身页那一天。
// 只用合成数据和示例计划里的动作 id（bench）；动作名只在期望值里出现，不进失败消息。
import { test, expect } from '../../support/test';
import { FROZEN_NOW, FROZEN_TODAY, WEEK_START_FROZEN } from '../../support/constants';
import {
  TAB_LABELS,
  FL_TITLE_TODAY,
  FL_SAVE_EDIT,
  FL_SAVED,
  FL_STATE_SAVED,
  FL_ERR_EXNONE,
  FL_ERR_RNONE,
  FL_LIVE_UNDONE,
  BTN_UNDO_DELETE,
  fitRow,
  flDeleted,
  peHintErrors,
  BTN_FL_DISCARD,
  BTN_FL_DISCARD_OPEN,
  BTN_FL_FILL_LAST,
  BTN_FL_KEEP_EDITING,
  BTN_UNDO_REMOVE,
  FL_CARDIO_ALL_ADDED,
  FL_CF_DISCARD_B,
  FL_CF_DISCARD_T,
  FL_ERR_DRANGE,
  FL_ERR_MNONE,
  FL_HINT_EMPTY,
  FL_HINT_SAVED,
  FL_LIFT_ALL_ADDED,
  FL_SET_LIMIT,
  flCardioTarget,
  flLast,
  flRemoved,
  flSetDeleted,
  flTitleDay,
  BTN_FL_DATE_GO,
  BTN_FL_DATE_KEEP,
  FL_CF_DATE_T,
  FL_HINT_DIRTY,
} from '../../support/strings';
import {
  flAddCardio,
  flAddLift,
  flChipIds,
  flCopySet,
  flDeleteSet,
  flError,
  flFillCardio,
  flFillSet,
  flRemoveEx,
  flSave,
  gotoFitness,
  readFl,
  readWeekWo,
  savedWorkouts,
} from '../../support/fitness';
import { confirmCancel, confirmOk, readConfirm } from '../../support/confirm';
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

const SET_SEED = {
  _synthetic: true,
  workouts: {
    '2026-03-10': {
      lifts: [
        {
          id: 'bench',
          sets: [
            { w: 20, r: 8 },
            { w: 22.5, r: 6 },
          ],
        },
      ],
      cardio: [],
    },
    '2026-03-16': { lifts: [{ id: 'bench', sets: [{ w: 25, r: 5 }] }], cardio: [] },
  },
};

test('FIT-02 sets are added, copied from the previous set, filled from the last training and deleted with an undo, with the last-training line and the 20-set limit (D-01, A3)', async ({
  page,
  app,
}) => {
  await app.open({ seed: SET_SEED });
  await gotoFitness(page);
  await flAddLift(page, 'bench');
  const blk = page.locator('.fl-ex[data-lift="bench"]');

  // 参考行显示所选日期之前最近一次训练；表单不自动预填，只有一行空组
  await expect(blk.locator('.fl-last')).toHaveText(flLast('3月16日', '25 × 5'));
  expect(await readFl(page)).toEqual([{ id: 'bench', sets: [{ w: '', r: '' }] }]);
  const fill = blk.locator('[data-flact="filllast"]');
  await expect(fill).toHaveText(BTN_FL_FILL_LAST);

  // 点「照上次填」：带入上次的各组，焦点在第一组重量框，按钮消失
  await fill.click();
  expect(await readFl(page)).toEqual([{ id: 'bench', sets: [{ w: '25', r: '5' }] }]);
  await expect(page.locator('#fl-w-bench-0')).toBeFocused();
  await expect(blk.locator('[data-flact="filllast"]')).toHaveCount(0);

  // 连续「＋ 添加一组」到 20 组：按钮变 disabled，旁边写「最多 20 组」，「复制上一组」也是 disabled
  const add = blk.locator('[data-flact="addset"]');
  for (let n = 1; n < 20; n++) await add.click();
  await expect(blk.locator('.fl-set')).toHaveCount(20);
  await expect(add).toBeDisabled();
  await expect(blk.locator('.fl-cap')).toHaveText(FL_SET_LIMIT);
  await expect(blk.locator('[data-flact="copyset"]')).toBeDisabled();

  // 删掉有内容的一组：toast 带撤销，撤销放回原位置并播报；删掉空行没有 toast
  await flDeleteSet(page, 'bench', 0);
  await expectToast(page, flSetDeleted(1));
  await expect(page.locator('#toast.act button')).toHaveText(BTN_UNDO_DELETE);
  await expect(blk.locator('.fl-set')).toHaveCount(19);
  await page.locator('#toast.act button').click();
  await expect(blk.locator('.fl-set')).toHaveCount(20);
  expect((await readFl(page))[0].sets[0]).toEqual({ w: '25', r: '5' });
  await expect(page.locator('#fl-live')).toHaveText(new RegExp(`^${FL_LIVE_UNDONE}`));
  await expectToastGone(page);
  await flDeleteSet(page, 'bench', 19);
  await expect(blk.locator('.fl-set')).toHaveCount(19);
  await expectToastGone(page);

  // 删到只剩 0 行：动作块保留，焦点落到「＋ 添加一组」
  for (let n = 0; n < 19; n++) await flDeleteSet(page, 'bench', 0);
  await expect(blk.locator('.fl-set')).toHaveCount(0);
  await expect(add).toBeFocused();

  // 放弃并确认，草稿回到空；选更早的日期（草稿是空的，不弹确认），参考行取所选日期之前最近一次
  await page.locator('#flDiscard').click();
  await confirmOk(page);
  expect(await readFl(page)).toEqual([]);
  await page.locator('#fl-date').fill('2026-03-11');
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
  await expect(page.locator('#fl-title')).toHaveText(flTitleDay('3月11日'));
  await flAddLift(page, 'bench');
  await expect(blk.locator('.fl-last')).toHaveText(flLast('3月10日', '20 × 8，22.5 × 6'));
});

test('FIT-02 a cardio item needs a duration and takes an optional distance, and an empty cardio row is reported instead of dropped (D-02, A5)', async ({
  page,
  app,
}) => {
  await app.open({ seed: { _synthetic: true } });
  await gotoFitness(page);
  await flAddCardio(page, 'r-run');
  await expect(page.locator('.fl-cd[data-cardio="r-run"] legend')).toContainText(flCardioTarget('每次 5 公里'));

  // 不填就保存：时长框 aria-invalid，错误行写「请填写时长（分钟）」，不保存
  await flSave(page);
  await expect(page.locator('#fl-m-r-run')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#fl-ec-r-run')).toHaveText(FL_ERR_MNONE);
  await expect(page.locator('#fl-m-r-run')).toBeFocused();

  // 只填时长，距离留空：cardio 只有 id 和 m
  await flFillCardio(page, 'r-run', '30');
  await expect(page.locator('#fl-ec-r-run')).toBeHidden();
  await flSave(page);
  await expectToast(page, FL_SAVED);
  await app.expectSaved(
    (s) => JSON.stringify(savedWorkouts(s)[FROZEN_TODAY]) === JSON.stringify({ lifts: [], cardio: [{ id: 'r-run', m: 30 }] }),
    '等待只有时长的有氧项保存',
  );

  // 再加一个，距离填 0 报错，改成 2.5 保存
  await flAddCardio(page, 'r-walk');
  await flFillCardio(page, 'r-walk', '20', '0');
  await flSave(page);
  await expect(page.locator('#fl-ec-r-walk')).toHaveText(FL_ERR_DRANGE);
  await expect(page.locator('#fl-d-r-walk')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#fl-d-r-walk').fill('2.5');
  await flSave(page);
  await app.expectSaved(
    (s) =>
      JSON.stringify(savedWorkouts(s)[FROZEN_TODAY]) ===
      JSON.stringify({
        lifts: [],
        cardio: [
          { id: 'r-run', m: 30 },
          { id: 'r-walk', m: 20, d: 2.5 },
        ],
      }),
    '等待有距离的有氧项保存',
  );

  // 已加进的不在芯片行里，没加的还在；全部加完芯片行位置显示说明
  expect((await flChipIds(page)).filter((x) => x.startsWith('cardio:'))).toEqual(['cardio:r-bike']);
  await flAddCardio(page, 'r-bike');
  await expect(page.locator('#fl')).toContainText(FL_CARDIO_ALL_ADDED);
});

test('FIT-02 removing an exercise with content offers an undo, and discarding asks first and restores the saved training (A22)', async ({
  page,
  app,
}) => {
  const seed = { _synthetic: true, workouts: { [FROZEN_TODAY]: { lifts: [{ id: 'bench', sets: [{ w: 20, r: 8 }] }], cardio: [] } } };
  await app.open({ seed });
  await gotoFitness(page);
  await flAddLift(page, 'squat');
  await flFillSet(page, 'squat', 0, '40', '5');

  // 移除有内容的动作：toast 带撤销，撤销后动作块和它的组回来
  await flRemoveEx(page, 'squat');
  await expectToast(page, flRemoved('深蹲'));
  await expect(page.locator('#toast.act button')).toHaveText(BTN_UNDO_REMOVE);
  expect((await readFl(page)).map((x) => x.id)).toEqual(['bench']);
  await page.locator('#toast.act button').click();
  expect(await readFl(page)).toEqual([
    { id: 'bench', sets: [{ w: '20', r: '8' }] },
    { id: 'squat', sets: [{ w: '40', r: '5' }] },
  ]);
  await expectToastGone(page);

  // 放弃：先确认，取消键默认有焦点；取消后草稿不变
  const discard = page.locator('#flDiscard');
  await expect(discard).toHaveText(BTN_FL_DISCARD_OPEN);
  await discard.click();
  const c = await readConfirm(page);
  expect(c.title).toBe(FL_CF_DISCARD_T);
  expect(c.lines).toEqual([FL_CF_DISCARD_B]);
  expect(c.focused).toBe('cfCancel');
  expect(c.buttons.map((b) => b.text)).toEqual([BTN_FL_KEEP_EDITING, BTN_FL_DISCARD]);
  await confirmCancel(page);
  expect((await readFl(page)).map((x) => x.id)).toEqual(['bench', 'squat']);

  // 再点并确认：只剩已保存的 bench，「放弃」按钮消失，焦点在日期框
  await discard.click();
  await readConfirm(page);
  await confirmOk(page);
  expect(await readFl(page)).toEqual([{ id: 'bench', sets: [{ w: '20', r: '8' }] }]);
  await expect(page.locator('#flDiscard')).toHaveCount(0);
  await expect(page.locator('#fl-date')).toBeFocused();
});

test('FIT-02 the save button is not available for an empty draft or an unchanged saved day, the chip rows say when everything is added, and a bodyweight set saved as 0 reads 徒手 (D-01, S3)', async ({
  page,
  app,
}) => {
  await app.open({ seed: { _synthetic: true } });
  await gotoFitness(page);

  // 空草稿：提示「先添加动作或有氧项，再保存」，点保存没有 toast，焦点仍在按钮；日期框不能选未来
  await expect(page.locator('#fl-hint')).toHaveText(FL_HINT_EMPTY);
  await expect(page.locator('#fl-date')).toHaveAttribute('max', FROZEN_TODAY);
  await page.locator('#fl-save').click({ force: true });
  await expectToastGone(page);
  await expect(page.locator('#fl-save')).toBeFocused();
  await expect(page.locator('#fl-save')).toHaveAttribute('aria-disabled', 'true');

  // 换到 3 月 17 日（草稿是空的，不弹确认），给引体记 0 × 8：重量 0 照样保存，提示「已保存」
  await page.locator('#fl-date').fill('2026-03-17');
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
  await flAddLift(page, 'pull');
  await flFillSet(page, 'pull', 0, '0', '8');
  await flSave(page);
  await expectToast(page, FL_SAVED);
  await app.expectSaved(
    (s) => JSON.stringify(savedWorkouts(s)['2026-03-17']) === JSON.stringify({ lifts: [{ id: 'pull', sets: [{ w: 0, r: 8 }] }], cardio: [] }),
    '等待徒手的组保存',
  );
  await expect(page.locator('#fl-hint')).toHaveText(FL_HINT_SAVED);
  await expect(page.locator('#fl-save')).toHaveAttribute('aria-disabled', 'true');

  // 选回今天（已保存、没有未保存内容，不弹确认），加引体：参考行写「徒手」
  await page.locator('#fl-date').fill(FROZEN_TODAY);
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
  await flAddLift(page, 'pull');
  await expect(page.locator('.fl-ex[data-lift="pull"] .fl-last')).toHaveText(flLast('3月17日', '徒手 × 8'));

  // 四个示例力量项都加进去：芯片行位置显示说明；本地版没有「去编辑计划添加动作」
  for (const id of ['bench', 'squat', 'dead']) await flAddLift(page, id);
  expect((await flChipIds(page)).filter((x) => x.startsWith('lift:'))).toEqual([]);
  await expect(page.locator('#fl')).toContainText(FL_LIFT_ALL_ADDED);
  await expect(page.locator('#flGoPlan')).toHaveCount(0);
});

test('FIT-02 picking another date with unsaved content asks first and keeps the date when declined, while switching tabs keeps the draft without asking (S3, A2)', async ({
  page,
  app,
}) => {
  const seed = { _synthetic: true, workouts: { '2026-03-16': { lifts: [{ id: 'bench', sets: [{ w: 25, r: 5 }] }], cardio: [] } } };
  await app.open({ seed });
  await gotoFitness(page);
  await flAddLift(page, 'bench');
  await flFillSet(page, 'bench', 0, '20', '8');
  const draft = [{ id: 'bench', sets: [{ w: '20', r: '8' }] }];

  // 改日期：确认框，取消键（先不换）默认有焦点；取消后日期框回到原值、草稿还在
  await page.locator('#fl-date').fill('2026-03-17');
  const c = await readConfirm(page);
  expect(c.title).toBe(FL_CF_DATE_T);
  expect(c.focused).toBe('cfCancel');
  expect(c.buttons.map((b) => b.text)).toEqual([BTN_FL_DATE_KEEP, BTN_FL_DATE_GO]);
  await confirmCancel(page);
  await expect(page.locator('#fl-date')).toHaveValue(FROZEN_TODAY);
  expect(await readFl(page)).toEqual(draft);

  // 切标签不确认，草稿留着，提示行还是「有没保存的内容」
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await gotoFitness(page);
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
  expect(await readFl(page)).toEqual(draft);
  await expect(page.locator('#fl-hint')).toHaveText(FL_HINT_DIRTY);

  // 从本周页点另一天的训练行：同一个确认框；确认后记录区是那一天，焦点在标题
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await page.locator('#days .ent.wo[data-wo="2026-03-16"]').click();
  expect((await readConfirm(page)).title).toBe(FL_CF_DATE_T);
  await confirmOk(page);
  await expect(page.locator('#fl-title')).toHaveText(flTitleDay('3月16日'));
  await expect(page.locator('#fl-title')).toBeFocused();
  expect(await readFl(page)).toEqual([{ id: 'bench', sets: [{ w: '25', r: '5' }] }]);
});

test('FIT-02 an exercise block with no filled set shows its own error under the block with an id that no set error can share (IN-02)', async ({
  page,
  app,
}) => {
  await app.open({ seed: SET_SEED });
  await gotoFitness(page);
  await flAddLift(page, 'bench');
  await flFillSet(page, 'bench', 0, '20', '8');
  await flAddLift(page, 'squat');
  await flSave(page);
  const err = page.locator('#fl-ex-e-squat');
  await expect(err).toBeVisible();
  await expect(err).toHaveText(FL_ERR_EXNONE);
  await expect(page.locator('#fl-e-squat')).toHaveCount(0);
});

// 证明“没有保存”要用 manual 时钟：推过 600 ms 防抖窗口之后再比较，并用随后的真保存证明这个窗口确实推进了防抖（IN-06）；同一个用例里不混用 setFixedTime
test.describe('FIT-02 manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('FIT-02 a half-filled set is not saved after the debounce window has passed, and the corrected training is saved after it (A5)', async ({
    page,
    app,
  }) => {
    const bench = [
      { w: 20, r: 8 },
      { w: 22.5, r: 6 },
    ];
    const seed = { _synthetic: true, workouts: { [FROZEN_TODAY]: { lifts: [{ id: 'bench', sets: bench }], cardio: [] } } };
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ seed });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await gotoFitness(page);
    await flAddLift(page, 'squat');
    await flFillSet(page, 'squat', 0, '40', '5');
    await flCopySet(page, 'squat');
    await page.locator('#fl-r-squat-1').fill('');
    await flSave(page);
    await expect(page.locator('#fl-r-squat-1')).toHaveAttribute('aria-invalid', 'true');
    await page.clock.runFor(1_000);
    const unsaved = await app.saved();
    // 种子只是读进来的，不算一次保存：窗口过去之后什么都没写（app.saved() 里没有任何训练），而不是写了别的东西
    expect(savedWorkouts(unsaved), 'nothing was written after the debounce window').toEqual({});

    await page.locator('#fl-r-squat-1').fill('5');
    await flSave(page);
    await page.clock.runFor(1_000);
    await expect
      .poll(async () => ((savedWorkouts(await app.saved()) as any)[FROZEN_TODAY]?.lifts ?? []).length, { message: '等待修正后的训练保存' })
      .toBe(2);
  });
});
