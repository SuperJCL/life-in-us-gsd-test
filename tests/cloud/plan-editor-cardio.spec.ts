// Phase 15-06 的云端用例（PLAN-02、PLAN-03，编辑计划页里的有氧项和力量项的训练历史）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案；计划文字都带 `SYNTH-<label>`，只做相等比较。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { flAddCardio, flChipIds, flFillCardio, flSave, gotoFitness, savedWorkouts } from '../support/fitness';
import { act, addCardio, card, cardioField, expand, openEditor, readEditor, savePlan, setCardioTarget } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { confirmMid, confirmOk, readConfirm } from '../support/confirm';
import {
  ARCHIVED_MARK,
  BANNER_REMOTE_PE,
  BTN_PE_ADD_CARDIO,
  BTN_PE_ARCH_CARDIO,
  BTN_PE_ARCH_LIFT,
  BTN_PE_ARCH_NO,
  BTN_PE_ARCHIVE_ALL,
  BTN_PE_DEL_CARDIO,
  BTN_PE_UNDO_REMOVE,
  BTN_PURGE_CARDIO,
  BTN_PURGE_LIFT,
  BTN_PURGE_NO,
  FL_SAVED,
  PE_CD_GOAL,
  PE_CD_KIND,
  PE_CD_TV_KM,
  PE_CD_TV_MIN,
  PE_ARCH_CARDIO_BODY,
  PE_ARCH_CARDIO_TITLE,
  PE_ARCH_LIFT_BODY,
  PE_ARCH_LIFT_TITLE,
  PE_ARCH_RESTORE,
  PE_CD_TITLE,
  PE_D08_INTRO,
  PE_D08_QUESTION,
  PE_D08_TITLE,
  PE_ERR_CARDIO_NAME,
  PE_ERR_CARDIO_TARGET,
  PE_HINT_NONE,
  PE_LIMIT_CARDIO,
  PE_LIVE_ADDED_CARDIO,
  PE_PURGE_CARDIO_TITLE,
  PE_PURGE_LAST,
  PE_PURGE_LIFT_TITLE,
  PE_RESTORE_LIMIT_CARDIO,
  TOAST_PLAN_SAVED,
  archivedSummary,
  peArchCardioCount,
  peArchCardioRecs,
  peArchLiftCount,
  pePurgeCardio,
  pePurgeLiftSets,
  peRecheckCardio,
  peCardioSum,
  peCount,
  peHintErrors,
  peRemoved,
} from '../support/strings';

const LIST_PATH = '/api/collections/journey_docs/records';

// 另一台设备保存了服务器上的 state：mutate 改一份深拷贝（写法同 plan-editor-sync.spec.ts）
async function otherWriterSavesState(app: { fake: any }, mutate: (state: any) => void) {
  const data = app.fake.lastState(0);
  mutate(data);
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'state')}`, { data, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
}

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

test('PLAN-03 a cardio item without trainings is removed with an undo, and one with trainings is archived, restored or deleted together with its entries (12 D-01, A9)', async ({
  app,
  page,
}) => {
  // r-pd1 没有训练；r-pd2 有两天训练，其中 03-12 还有一组力量
  const plan: any = syntheticPlan('pd', 1);
  plan.cardio = [
    { id: 'r-pd1', n: 'SYNTH-pd1', note: '' },
    { id: 'r-pd2', n: 'SYNTH-pd2', note: '', target: { kind: 'km', v: 5 } },
  ];
  const wo = {
    '2026-03-10': { lifts: [], cardio: [{ id: 'r-pd2', m: 30 }] },
    '2026-03-12': { lifts: [{ id: 'l-pd1', sets: [{ w: 20, r: 8 }] }], cardio: [{ id: 'r-pd2', m: 25, d: 4 }] },
  };
  await app.open({ mode: 'cloud', seed: syntheticState('pd', { workouts: wo }), plan, login: 0 });
  const keys = async () => (await readEditor(page)).cardio.map((c) => c.key);
  const dlg = page.locator('dialog#confirm');
  const serverCardio = () => app.fake.lastPlan(0)?.cardio as any[] | undefined;

  await openEditor(page);
  // 没有训练记录：直接移除，没有确认框，toast 带「撤销移除」；撤销后回到原位
  await expand(page, 'r:r-pd1');
  await act(page, 'delcardio', 'r:r-pd1').click();
  await expect(dlg).toHaveJSProperty('open', false);
  expect(await keys()).toEqual(['r:r-pd2']);
  await expectToast(page, peRemoved('SYNTH-pd1'));
  await expect(page.locator('#toast.act button')).toHaveText(BTN_PE_UNDO_REMOVE);
  await page.locator('#toast.act button').click();
  expect(await keys()).toEqual(['r:r-pd1', 'r:r-pd2']);

  // 有 2 次记录：确认框归档（.primary），「不归档」后它还在；再删，确认后从主列表消失
  await expand(page, 'r:r-pd2');
  await act(page, 'delcardio', 'r:r-pd2').click();
  const c = await readConfirm(page);
  expect(c.title).toBe(PE_ARCH_CARDIO_TITLE);
  expect(c.lines).toEqual([peArchCardioCount('SYNTH-pd2', 2), PE_ARCH_CARDIO_BODY, PE_ARCH_RESTORE]);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_PE_ARCH_NO);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_ARCH_CARDIO);
  await expect(page.locator('#cfOk')).toHaveClass(/primary/);
  await page.locator('#cfCancel').click();
  expect(await keys()).toEqual(['r:r-pd1', 'r:r-pd2']);
  await act(page, 'delcardio', 'r:r-pd2').click();
  await readConfirm(page);
  await confirmOk(page);
  expect(await keys()).toEqual(['r:r-pd1']);
  await page.locator('#pe-archived > summary').click();
  let ed = await readEditor(page);
  expect(ed.archived.summary).toBe(archivedSummary(1));
  expect(ed.archived.cardio).toEqual(['r:r-pd2']);
  await expect(page.locator('#pe-archived .pe-arch-h')).toHaveText(PE_CD_TITLE);
  await expect(page.locator('#pe-archived [data-row="r:r-pd2"] .pe-arch-desc')).toHaveText(peArchCardioRecs(2));

  // 保存：服务器计划里 r-pd2 带 archived:true，训练原样
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => serverCardio()?.find((x) => x.id === 'r-pd2')?.archived, { message: '等待新计划上传' }).toBe(true);
  expect(app.fake.lastState(0).workouts).toEqual(wo);

  // 健身页：芯片里没有它；旧训练的记录区里它还在，带「已归档」
  await gotoFitness(page);
  expect((await flChipIds(page)).filter((x) => x.startsWith('cardio:'))).toEqual(['cardio:r-pd1']);
  await page.locator('#fl-date').fill('2026-03-10');
  await expect(page.locator('.fl-cd[data-cardio="r-pd2"] .arch-mark')).toHaveText(ARCHIVED_MARK);

  // 编辑页恢复：回到未归档末尾；再归档，然后彻底删除：确认框写明 2 次记录
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await openEditor(page);
  await page.locator('#pe-archived > summary').click();
  await act(page, 'restore', 'r:r-pd2').click();
  expect(await keys()).toEqual(['r:r-pd1', 'r:r-pd2']);
  expect((await readEditor(page)).archived.present).toBe(false);
  await expand(page, 'r:r-pd2');
  await act(page, 'delcardio', 'r:r-pd2').click();
  await readConfirm(page);
  await confirmOk(page);
  expect((await readEditor(page)).hint, '恢复再归档回到打开时的样子').toBe(PE_HINT_NONE);
  // 区重新出现时保持展开（pe.archOpen），不用再点
  expect((await readEditor(page)).archived.open).toBe(true);
  await act(page, 'purge', 'r:r-pd2').click();
  const pg = await readConfirm(page);
  expect(pg.title).toBe(PE_PURGE_CARDIO_TITLE);
  expect(pg.lines).toEqual([pePurgeCardio('SYNTH-pd2', 2), PE_PURGE_LAST]);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PURGE_CARDIO);
  await expect(page.locator('#cfOk')).toHaveClass(/danger/);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_PURGE_NO);
  await confirmOk(page);
  ed = await readEditor(page);
  expect(ed.archived.present).toBe(false);

  // 保存：计划里没有 r-pd2；训练里只剩 03-12 的力量组，只有 r-pd2 的 03-10 整天消失
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => serverCardio()?.map((x) => x.id).join(), { message: '等待新计划上传' }).toBe('r-pd1');
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0).workouts), { message: '等待训练清理上传' })
    .toBe(JSON.stringify({ '2026-03-12': { lifts: [{ id: 'l-pd1', sets: [{ w: 20, r: 8 }] }], cardio: [] } }));
});

test('PLAN-03 restoring an archived cardio item is disabled while 20 unarchived ones exist (D-04, 12 D-05)', async ({ app, page }) => {
  const plan: any = syntheticPlan('pf', 1);
  plan.cardio = Array.from({ length: 20 }, (_, i) => ({ id: `r-pf${i + 1}`, n: `SYNTH-pf ${i + 1}`, note: '' }));
  plan.cardio.push({ id: 'r-pfz', n: 'SYNTH-pf archived', note: '', archived: true });
  const seed = syntheticState('pf', { workouts: { '2026-03-10': { lifts: [], cardio: [{ id: 'r-pfz', m: 30 }] } } });
  await app.open({ mode: 'cloud', seed, plan, login: 0 });
  await openEditor(page);
  await page.locator('#pe-archived > summary').click();
  let ed = await readEditor(page);
  expect(ed.counts.cardio).toBe(peCount(20, 20));
  expect(ed.archived.cardio).toEqual(['r:r-pfz']);
  expect(ed.restoreDisabled).toEqual(['r:r-pfz']);
  await expect(page.locator('#pe-archived [data-row="r:r-pfz"] .pe-arch-lim')).toHaveText(PE_RESTORE_LIMIT_CARDIO);
  // 删掉一个没有训练的（直接移除）之后恢复可用，恢复后回到 20 个
  await expand(page, 'r:r-pf1');
  await act(page, 'delcardio', 'r:r-pf1').click();
  ed = await readEditor(page);
  expect(ed.restoreDisabled).toEqual([]);
  await act(page, 'restore', 'r:r-pfz').click();
  ed = await readEditor(page);
  expect([ed.counts.cardio, ed.cardio.at(-1)?.key]).toEqual([peCount(20, 20), 'r:r-pfz']);
});

test('PLAN-03 a lift with trainings counts them as history, so it is archived instead of removed, and deleting it permanently also removes its sets from the trainings (A9)', async ({
  app,
  page,
}) => {
  const lift = (id: string, n: string) => ({ id, n, unit: 'kg', def: 10, target: 20, note: '' });
  const plan: any = syntheticPlan('pw', 1);
  plan.lifts = [lift('l-pw1', 'SYNTH-pw lift one'), lift('l-pw2', 'SYNTH-pw lift two'), lift('l-pw3', 'SYNTH-pw lift three')];
  plan.cardio = [
    { id: 'r-pw3', n: 'SYNTH-pw cardio three', note: '' },
    { id: 'r-pw4', n: 'SYNTH-pw cardio four', note: '' },
  ];
  // l-pw1 在 3 天里共 5 组（没有手填历史）；03-09 只有它；03-10 还有 l-pw2；03-11 还有有氧项 r-pw3
  const wo: any = {
    '2026-03-09': { lifts: [{ id: 'l-pw1', sets: [{ w: 20, r: 8 }, { w: 20, r: 6 }] }], cardio: [] },
    '2026-03-10': { lifts: [{ id: 'l-pw1', sets: [{ w: 22, r: 5 }] }, { id: 'l-pw2', sets: [{ w: 30, r: 5 }] }], cardio: [] },
    '2026-03-11': { lifts: [{ id: 'l-pw1', sets: [{ w: 25, r: 3 }, { w: 25, r: 3 }] }], cardio: [{ id: 'r-pw3', m: 20 }] },
  };
  await app.open({ mode: 'cloud', seed: syntheticState('pw', { workouts: wo }), plan, login: 0 });
  const dlg = page.locator('dialog#confirm');
  const liftIds = () => ((app.fake.lastPlan(0)?.lifts ?? []) as any[]).map((l) => `${l.id}${l.archived ? '*' : ''}`).join();

  // 第一轮：没有训练也没有手填历史的 l-pw3 直接移除（没有确认框）；有训练的 l-pw1 弹归档确认，3 条记录
  await openEditor(page);
  await expand(page, 'l:l-pw3');
  await act(page, 'dellift', 'l:l-pw3').click();
  await expect(dlg).toHaveJSProperty('open', false);
  await expectToast(page, peRemoved('SYNTH-pw lift three'));
  await expand(page, 'l:l-pw1');
  await act(page, 'dellift', 'l:l-pw1').click();
  const c = await readConfirm(page);
  expect(c.title).toBe(PE_ARCH_LIFT_TITLE);
  expect(c.lines).toEqual([peArchLiftCount('SYNTH-pw lift one', 3), PE_ARCH_LIFT_BODY, PE_ARCH_RESTORE]);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_ARCH_LIFT);
  await confirmOk(page);
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(liftIds, { message: '等待新计划上传' }).toBe('l-pw1*,l-pw2');
  expect(app.fake.lastState(0).workouts, '归档不清训练').toEqual(wo);

  // 第二轮：彻底删除 l-pw1，确认框写明 3 条记录和 5 组；同时直接移除没有训练的 r-pw4，保存前别的设备给它记了训练
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await openEditor(page);
  await page.locator('#pe-archived > summary').click();
  await act(page, 'purge', 'l:l-pw1').click();
  const pg = await readConfirm(page);
  expect(pg.title).toBe(PE_PURGE_LIFT_TITLE);
  expect(pg.lines).toEqual([pePurgeLiftSets('SYNTH-pw lift one', 3, 5), PE_PURGE_LAST]);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PURGE_LIFT);
  await confirmOk(page);
  await expand(page, 'r:r-pw4');
  await act(page, 'delcardio', 'r:r-pw4').click();
  await otherWriterSavesState(app, (st) => {
    st.workouts = { ...(st.workouts ?? {}), '2026-03-13': { lifts: [], cardio: [{ id: 'r-pw4', m: 10 }] } };
  });
  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_REMOTE_PE);
  await savePlan(page);
  const d8 = await readConfirm(page);
  expect(d8.title).toBe(PE_D08_TITLE);
  expect(d8.lines).toEqual([PE_D08_INTRO, peRecheckCardio('SYNTH-pw cardio four', 1), PE_D08_QUESTION]);
  expect(d8.buttons.find((b) => b.id === 'cfMid')?.text).toBe(BTN_PE_ARCHIVE_ALL);
  await confirmMid(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器：l-pw1 没了，r-pw4 归档；训练里 l-pw1 的组都没了，03-09 整天消失，03-10 只剩 l-pw2，03-11 只剩有氧；别的设备记的 03-13 还在
  await expect.poll(liftIds, { message: '等待新计划上传' }).toBe('l-pw2');
  expect(((app.fake.lastPlan(0).cardio ?? []) as any[]).map((x) => `${x.id}${x.archived ? '*' : ''}`).join()).toBe('r-pw3,r-pw4*');
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0).workouts), { message: '等待训练清理上传' })
    .toBe(
      JSON.stringify({
        '2026-03-10': { lifts: [{ id: 'l-pw2', sets: [{ w: 30, r: 5 }] }], cardio: [] },
        '2026-03-11': { lifts: [], cardio: [{ id: 'r-pw3', m: 20 }] },
        '2026-03-13': { lifts: [], cardio: [{ id: 'r-pw4', m: 10 }] },
      }),
    );
});
