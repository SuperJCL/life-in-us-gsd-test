// Phase 15-06 的云端用例（PLAN-02、PLAN-03，编辑计划页里的有氧项和力量项的训练历史）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案；计划文字都带 `SYNTH-<label>`，只做相等比较。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { flAddCardio, flChipIds, flFillCardio, flSave, gotoFitness, savedWorkouts } from '../support/fitness';
import { act, addCardio, card, cardioField, expand, openEditor, readEditor, savePlan, setCardioTarget } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import {
  BTN_PE_ADD_CARDIO,
  BTN_PE_DEL_CARDIO,
  FL_SAVED,
  PE_CD_GOAL,
  PE_CD_KIND,
  PE_CD_TV_KM,
  PE_CD_TV_MIN,
  PE_ERR_CARDIO_NAME,
  PE_ERR_CARDIO_TARGET,
  PE_HINT_NONE,
  PE_LIMIT_CARDIO,
  PE_LIVE_ADDED_CARDIO,
  TOAST_PLAN_SAVED,
  peCardioSum,
  peCount,
  peHintErrors,
} from '../support/strings';

test('PLAN-02 cardio items are added in the plan editor with a name, a note and an optional per-session target, saved with r- ids and offered on the fitness tab (D-02)', async ({
  app,
  page,
}) => {
  // 计划里没有 cardio 键（旧计划）：编辑页只有计数 0/20 和「＋ 添加有氧项」
  const plan: any = syntheticPlan('pc', 1);
  expect(plan.cardio).toBeUndefined();
  await app.open({ mode: 'cloud', seed: syntheticState('pc'), plan, login: 0 });

  await openEditor(page);
  let ed = await readEditor(page);
  expect(ed.cardio).toEqual([]);
  expect(ed.counts.cardio).toBe(peCount(0, 20));
  await expect(act(page, 'addcardio')).toHaveText(BTN_PE_ADD_CARDIO);

  // 加一项再直接删掉：回到和打开时一样，不算修改
  const gone = await addCardio(page);
  expect((await readEditor(page)).hint).not.toBe(PE_HINT_NONE);
  await act(page, 'delcardio', `r:${gone}`).click();
  ed = await readEditor(page);
  expect(ed.cardio).toEqual([]);
  expect(ed.hint, '加了又删掉有氧项之后提示行回到还没有修改').toBe(PE_HINT_NONE);

  // 第一项：名称、备注、每次距离 5 公里；新卡展开，名称框有焦点，读屏句子播报，摘要先是没有目标
  const id1 = await addCardio(page);
  expect(id1).toMatch(/^r-[A-Za-z0-9_-]+$/);
  expect(id1).not.toBe(gone);
  await expect(page.locator('#pe-live')).toHaveText(PE_LIVE_ADDED_CARDIO);
  await expect(cardioField(page, id1, 'n')).toBeFocused();
  await expect(cardioField(page, id1, 'n')).toHaveAttribute('maxlength', '40');
  await expect(cardioField(page, id1, 'note')).toHaveAttribute('maxlength', '200');
  const seg = card(page, `r:${id1}`).locator('.seg');
  await expect(seg).toHaveAttribute('aria-label', PE_CD_GOAL);
  await expect(seg.locator('button')).toHaveText([PE_CD_KIND.none, PE_CD_KIND.km, PE_CD_KIND.min]);
  await expect(seg.locator('[aria-pressed="true"]')).toHaveText(PE_CD_KIND.none);
  await expect(cardioField(page, id1, 'tv')).toHaveCount(0);
  await expect(card(page, `r:${id1}`).locator('.pe-sum')).toHaveText(peCardioSum('none'));
  await cardioField(page, id1, 'n').fill('SYNTH-pc run');
  await cardioField(page, id1, 'note').fill('SYNTH-pc run note');
  await setCardioTarget(page, id1, 'km');
  const tv1 = cardioField(page, id1, 'tv');
  await expect(tv1).toHaveAttribute('type', 'number');
  await expect(tv1).toHaveAttribute('inputmode', 'decimal');
  await expect(tv1).toHaveAttribute('step', 'any');
  await expect(tv1).toBeFocused();
  await expect(card(page, `r:${id1}`).locator('label.f').filter({ hasText: PE_CD_TV_KM })).toHaveCount(1);
  await tv1.fill('5');
  await expect(card(page, `r:${id1}`).locator('.pe-sum')).toHaveText(peCardioSum('km', 5));
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器计划：一项，新的 r- id，名称、备注、目标 {kind:'km',v:5}
  await expect.poll(() => app.fake.lastPlan(0)?.cardio?.length, { message: '等待新计划上传' }).toBe(1);
  let saved: any = app.fake.lastPlan(0);
  expect(saved.cardio[0].id).toBe(id1);
  expect([saved.cardio[0].n === 'SYNTH-pc run', saved.cardio[0].note === 'SYNTH-pc run note']).toEqual([true, true]);
  expect(saved.cardio[0].target).toEqual({ kind: 'km', v: 5 });
  expect(saved.cardio[0].archived).toBeUndefined();

  // 再开编辑页：第二项每次时长 30 分钟，第三项不设目标
  await openEditor(page);
  ed = await readEditor(page);
  expect(ed.cardio.map((c) => [c.key, c.expanded])).toEqual([[`r:${id1}`, false]]);
  expect(ed.counts.cardio).toBe(peCount(1, 20));
  const id2 = await addCardio(page);
  await cardioField(page, id2, 'n').fill('SYNTH-pc bike');
  await setCardioTarget(page, id2, 'min');
  await expect(card(page, `r:${id2}`).locator('label.f').filter({ hasText: PE_CD_TV_MIN })).toHaveCount(1);
  await cardioField(page, id2, 'tv').fill('30');
  await expect(card(page, `r:${id2}`).locator('.pe-sum')).toHaveText(peCardioSum('min', 30));
  const id3 = await addCardio(page);
  await cardioField(page, id3, 'n').fill('SYNTH-pc walk');
  await expect(card(page, `r:${id3}`).locator('.seg [aria-pressed="true"]')).toHaveText(PE_CD_KIND.none);
  await expect(card(page, `r:${id3}`).getByRole('button', { name: BTN_PE_DEL_CARDIO, exact: true })).toBeVisible();
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.cardio?.length, { message: '等待新计划上传' }).toBe(3);
  saved = app.fake.lastPlan(0);
  expect(saved.cardio.map((c: any) => c.id)).toEqual([id1, id2, id3]);
  expect(saved.cardio[0]).toEqual({ id: id1, n: 'SYNTH-pc run', note: 'SYNTH-pc run note', target: { kind: 'km', v: 5 } });
  expect(saved.cardio[1].target).toEqual({ kind: 'min', v: 30 });
  expect('target' in saved.cardio[2]).toBe(false);

  // 健身页：记录区的有氧芯片依次是这三项，给第一项记 20 分钟能保存
  await gotoFitness(page);
  expect((await flChipIds(page)).filter((c) => c.startsWith('cardio:'))).toEqual([id1, id2, id3].map((i) => `cardio:${i}`));
  await flAddCardio(page, id1);
  await flFillCardio(page, id1, '20');
  await flSave(page);
  await expectToast(page, FL_SAVED);
  await expect
    .poll(() => JSON.stringify(Object.values(savedWorkouts(app.fake.lastState(0))).map((d: any) => d.cardio)), { message: '等待训练上传' })
    .toBe(JSON.stringify([[{ id: id1, m: 20 }]]));
});

test('PLAN-02 a cardio item without a name or with a target that is not above 0 blocks saving next to the field, and the add button stops at 20 cardio items (D-02, D-04)', async ({
  app,
  page,
}) => {
  // 19 个未归档加 1 个归档的有氧项：归档的不占名额
  const plan: any = syntheticPlan('pe', 1);
  plan.cardio = Array.from({ length: 19 }, (_, i) => ({ id: `r-pe${i + 1}`, n: `SYNTH-pe cardio ${i + 1}`, note: '' }));
  plan.cardio.push({ id: 'r-pez', n: 'SYNTH-pe archived', note: '', archived: true });
  await app.open({ mode: 'cloud', seed: syntheticState('pe'), plan, login: 0 });

  await openEditor(page);
  let ed = await readEditor(page);
  expect(ed.cardio.length).toBe(19);
  expect(ed.counts.cardio).toBe(peCount(19, 20));
  expect([ed.addCardioDisabled, ed.addCardioLimit]).toEqual([false, '']);

  // 第 20 个可以添加：名称不填，选每次时长填 0；添加后按钮 disabled，旁边写最多 20 个
  const id = await addCardio(page);
  ed = await readEditor(page);
  expect(ed.counts.cardio).toBe(peCount(20, 20));
  expect([ed.addCardioDisabled, ed.addCardioLimit]).toEqual([true, PE_LIMIT_CARDIO]);
  await setCardioTarget(page, id, 'min');
  await cardioField(page, id, 'tv').fill('0');

  // 收起这张卡再保存：不保存，卡自动展开，两个字段旁边分别是各自的错误，提示行写 2 处，计划不变
  await card(page, `r:${id}`).locator('[data-peact="toggle"]').click();
  await expect(card(page, `r:${id}`).locator('[data-peact="toggle"]')).toHaveAttribute('aria-expanded', 'false');
  await savePlan(page);
  await expect.poll(async () => (await readEditor(page)).errors.length).toBe(2);
  ed = await readEditor(page);
  expect(ed.errors).toEqual([
    { key: `r:${id}:n`, text: PE_ERR_CARDIO_NAME },
    { key: `r:${id}:tv`, text: PE_ERR_CARDIO_TARGET },
  ]);
  expect(ed.cardio.find((c) => c.key === `r:${id}`)?.expanded).toBe(true);
  expect(ed.hint).toBe(peHintErrors(2));
  expect(ed.open).toBe(true);
  expect(app.fake.lastPlan(0)?.cardio?.length, '校验没过时不上传').toBe(20);

  // 改成合法的：名称填上、目标改成大于 0，错误当场消失，保存成功，服务器计划有 20 个未归档加 1 个归档
  await cardioField(page, id, 'n').fill('SYNTH-pe twentieth');
  await cardioField(page, id, 'tv').fill('0.5');
  await expect.poll(async () => (await readEditor(page)).errors.length).toBe(0);
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.cardio?.length, { message: '等待新计划上传' }).toBe(21);
  const saved: any = app.fake.lastPlan(0);
  expect(saved.cardio.filter((c: any) => !c.archived).length).toBe(20);
  expect(saved.cardio[20].id).toBe(id);
  expect(saved.cardio[20].target).toEqual({ kind: 'min', v: 0.5 });

  // 再开编辑页：卡片折叠，计数 20/20，按钮仍 disabled；展开最后一张卡能看到保存的值
  await openEditor(page);
  ed = await readEditor(page);
  expect([ed.counts.cardio, ed.addCardioDisabled, ed.addCardioLimit]).toEqual([peCount(20, 20), true, PE_LIMIT_CARDIO]);
  await expand(page, `r:${id}`);
  await expect(cardioField(page, id, 'tv')).toHaveValue('0.5');
});
