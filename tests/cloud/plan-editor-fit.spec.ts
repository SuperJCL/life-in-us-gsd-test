// Phase 12-05 的云端用例（PLAN-02、PLAN-03，编辑计划页里的健身分区和基础预设标签）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readGroups, readLifts } from '../support/goals';
import { act, card, expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import {
  BTN_ADD_LIFT,
  BTN_ADD_TAG,
  BTN_PE_ARCH_LIFT,
  BTN_PE_ARCH_NO,
  BTN_PE_UNDO_REMOVE,
  PE_ARCH_LIFT_BODY,
  PE_ARCH_LIFT_TITLE,
  PE_ARCH_RESTORE,
  PE_ERR_FIT_ORDER,
  PE_ERR_TAG_DUP,
  PE_ERR_TAG_EMPTY,
  PE_ERR_LIFT_DEF,
  PE_ERR_LIFT_TARGET,
  PE_ERR_LIFT_UNIT,
  PE_HINT_DIRTY,
  PE_LIMIT_LIFTS,
  PE_LIMIT_TAGS,
  PE_PRESETS_EMPTY,
  PE_UNIT_EXAMPLE,
  TAB_LABELS,
  TOAST_PLAN_SAVED,
  peBadCount,
  peHintErrors,
  pePresetCount,
  weekFitGoalLine,
} from '../support/strings';

test('PLAN-02 the weekly fitness goal, the fitness note and a new lift edited in the plan editor are saved and shown on the goals and week views (D-15)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pf', 1);
  await app.open({ mode: 'cloud', seed: syntheticState('pf'), plan, login: 0 });
  const newNote = 'SYNTH-pf fit note 2';
  const liftName = 'SYNTH-pf lift 2';

  await openEditor(page);
  // 每周健身目标：打开时带出当前计划的值
  let ed = await readEditor(page);
  expect(ed.fit).toEqual({ min: '1', max: '3' });
  expect(ed.lifts.map((l) => [l.key, l.expanded])).toEqual([['l:l-pf1', false]]);
  await expect(act(page, 'addlift')).toHaveText(BTN_ADD_LIFT);

  // 两个天数框的属性：整数 0 到 7
  for (const k of ['fit:min', 'fit:max']) {
    const f = field(page, k);
    await expect(f).toHaveAttribute('type', 'number');
    await expect(f).toHaveAttribute('min', '0');
    await expect(f).toHaveAttribute('max', '7');
    await expect(f).toHaveAttribute('step', '1');
    await expect(f).toHaveAttribute('inputmode', 'numeric');
  }
  await field(page, 'fit:min').fill('3');
  await field(page, 'fit:max').fill('5');
  await expect(field(page, 'fit:note')).toHaveAttribute('maxlength', '200');
  await field(page, 'fit:note').fill(newNote);

  // 添加力量项：新卡展开，焦点在名称框，单位默认空、目标值空、起始值 0
  await act(page, 'addlift').click();
  ed = await readEditor(page);
  expect(ed.lifts.length).toBe(2);
  const fresh = ed.lifts[1];
  expect(fresh.key).toMatch(/^l:l-[a-z0-9]+$/);
  expect(fresh.expanded).toBe(true);
  const newId = fresh.key.slice(2);
  await expect(field(page, `${fresh.key}:n`)).toBeFocused();
  await expect(field(page, `${fresh.key}:unit`)).toHaveValue('');
  await expect(field(page, `${fresh.key}:target`)).toHaveValue('');
  await expect(field(page, `${fresh.key}:def`)).toHaveValue('0');
  // 单位框不写 placeholder，旁边有示例文字
  await expect(field(page, `${fresh.key}:unit`)).not.toHaveAttribute('placeholder', /.+/);
  await expect(card(page, fresh.key).locator('.pe-eg')).toHaveText(PE_UNIT_EXAMPLE);

  await field(page, `${fresh.key}:n`).fill(liftName);
  await field(page, `${fresh.key}:unit`).fill('次');
  await field(page, `${fresh.key}:target`).fill('12');
  await field(page, `${fresh.key}:def`).fill('2.5');
  await field(page, `${fresh.key}:note`).fill('SYNTH-pf lift note');

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器计划：fitGoal、fitNote、力量项（原来的在前，新的 id 以 l- 开头）；起始值 2.5 不取整，目标值 12
  await expect.poll(() => app.fake.lastPlan(0)?.fitGoal?.join(','), { message: '等待新计划上传' }).toBe('3,5');
  const saved: any = app.fake.lastPlan(0);
  expect(saved.fitNote === newNote).toBe(true);
  expect(saved.lifts.map((l: any) => l.id)).toEqual(['l-pf1', newId]);
  expect(newId).toMatch(/^l-[a-z0-9]+$/);
  const added = saved.lifts[1];
  expect([added.n === liftName, added.unit === '次', added.def, added.target, typeof added.def]).toEqual([true, true, 2.5, 12, 'number']);
  expect(added.note === 'SYNTH-pf lift note').toBe(true);
  // 原来的力量项不变
  expect(saved.lifts[0]).toEqual(plan.lifts[0]);

  // 目标页：两张力量卡，新卡的输入框值是 2.5
  await gotoGoals(page);
  expect((await readLifts(page, ['l-pf1', newId])).count).toBe(2);
  await expect(page.locator(`#lf-${newId}`)).toHaveValue('2.5');

  // 本周页：健身目标行按新天数显示（合成记录是语言类，训练 0 天）
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await expect(page.locator('#areas .area.k-fit .goal')).toHaveText(weekFitGoalLine(0, 3, 5));
});

// n 个合成力量项，id l-<label>1 到 l-<label>n（计划文字都带 SYNTH-<label>）
function planWithLifts(label: string, n: number): any {
  const plan: any = syntheticPlan(label, 1);
  plan.lifts = Array.from({ length: n }, (_, i) => ({
    id: `l-${label}${i + 1}`,
    n: `SYNTH-${label} lift ${i + 1}`,
    unit: 'kg',
    def: 10,
    target: 20,
    note: '',
  }));
  return plan;
}

test('PLAN-02 lift and weekly fitness values outside the rules block saving with the error next to the field, and the add button stops at 8 lifts (D-15, D-17)', async ({
  app,
  page,
}) => {
  const plan = planWithLifts('pl', 8);
  await app.open({ mode: 'cloud', seed: syntheticState('pl'), plan, login: 0 });
  await openEditor(page);

  // 上限：8 个力量项时添加按钮 disabled，旁边写「最多 8 个」，分区计数 8/8
  let ed = await readEditor(page);
  expect(ed.lifts.length).toBe(8);
  await expect(act(page, 'addlift')).toBeDisabled();
  await expect(page.locator('#pe-main .pe-lim')).toHaveText(PE_LIMIT_LIFTS);
  await expect(page.locator('#pe-main #pe-h-fit ~ h4.pe-sub .pe-count')).toHaveText('8/8');

  // 输入限制：名称 40、单位 8、备注 200（超出被截断）
  await expand(page, 'l:l-pl1');
  await expect(field(page, 'l:l-pl1:n')).toHaveAttribute('maxlength', '40');
  await expect(field(page, 'l:l-pl1:unit')).toHaveAttribute('maxlength', '8');
  await expect(field(page, 'l:l-pl1:note')).toHaveAttribute('maxlength', '200');
  await field(page, 'l:l-pl1:unit').fill('123456789012');
  await expect(field(page, 'l:l-pl1:unit')).toHaveValue('12345678');

  // 目标值 0、单位清空，最少 5、最多 3：点保存不保存，错误就近显示，天数的两个框同时标记
  await field(page, 'l:l-pl1:target').fill('0');
  await field(page, 'l:l-pl1:unit').fill('');
  await field(page, 'fit:min').fill('5');
  await field(page, 'fit:max').fill('3');
  await savePlan(page);
  ed = await readEditor(page);
  expect(ed.errors).toEqual([
    { key: 'fit:min', text: PE_ERR_FIT_ORDER },
    { key: 'fit:max', text: PE_ERR_FIT_ORDER },
    { key: 'l:l-pl1:unit', text: PE_ERR_LIFT_UNIT },
    { key: 'l:l-pl1:target', text: PE_ERR_LIFT_TARGET },
  ]);
  expect(ed.hint).toBe(peHintErrors(4));
  expect(ed.tone).toBe('error');
  expect(ed.lifts.find((l) => l.key === 'l:l-pl1')).toEqual({ key: 'l:l-pl1', expanded: true, bad: peBadCount(2) });
  // 焦点在页面上第一个出错的字段（最少天数），服务器计划没变
  await expect(field(page, 'fit:min')).toBeFocused();
  expect(app.fake.lastPlan(0)?.fitGoal).toEqual([1, 3]);
  expect(app.fake.lastPlan(0)?.lifts?.[0]?.target).toBe(20);

  // 起始值为负（-1）、名称清空也各自就近提示；改好之后错误消失
  await field(page, 'l:l-pl1:def').fill('-1');
  await field(page, 'l:l-pl1:n').fill('');
  ed = await readEditor(page);
  expect(ed.errors.map((e) => e.key)).toEqual(['fit:min', 'fit:max', 'l:l-pl1:n', 'l:l-pl1:unit', 'l:l-pl1:target', 'l:l-pl1:def']);
  expect(ed.errors.find((e) => e.key === 'l:l-pl1:def')?.text).toBe(PE_ERR_LIFT_DEF);
  await field(page, 'l:l-pl1:n').fill('SYNTH-pl renamed');
  await field(page, 'l:l-pl1:unit').fill('次');
  await field(page, 'l:l-pl1:target').fill('0.5');
  await field(page, 'l:l-pl1:def').fill('0');
  await field(page, 'fit:min').fill('2');
  await field(page, 'fit:max').fill('4');
  ed = await readEditor(page);
  expect(ed.errors).toEqual([]);
  expect(ed.hint).toBe(PE_HINT_DIRTY);

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.fitGoal?.join(','), { message: '等待新计划上传' }).toBe('2,4');
  const saved: any = app.fake.lastPlan(0);
  // 小数目标值和起始值 0 照原样保存，其余七个力量项不变
  expect([saved.lifts[0].n === 'SYNTH-pl renamed', saved.lifts[0].unit === '次', saved.lifts[0].target, saved.lifts[0].def]).toEqual([true, true, 0.5, 0]);
  expect(saved.lifts.slice(1)).toEqual(plan.lifts.slice(1));
});

test('PLAN-02 a loaded plan whose values break the editor rules is shown as it is, and the editor marks those fields at once and blocks saving until they are fixed (owner decision)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pv', 1);
  plan.lifts[0].def = -1;
  plan.fitGoal = [5, 3];
  await app.open({ mode: 'cloud', seed: syntheticState('pv'), plan, login: 0 });

  // 目标页照常显示这份计划（不是示例计划）
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['P1']);
  await expect(page.locator('#lf-l-pv1')).toHaveCount(1);

  // 打开编辑页、不做任何操作：三处错误已标出，力量项卡已展开，提示行写数量
  await openEditor(page);
  let ed = await readEditor(page);
  expect(ed.errors).toEqual([
    { key: 'fit:min', text: PE_ERR_FIT_ORDER },
    { key: 'fit:max', text: PE_ERR_FIT_ORDER },
    { key: 'l:l-pv1:def', text: PE_ERR_LIFT_DEF },
  ]);
  expect(ed.lifts).toEqual([{ key: 'l:l-pv1', expanded: true, bad: peBadCount(1) }]);
  expect(ed.hint).toBe(peHintErrors(3));
  expect(ed.tone).toBe('error');
  expect(ed.saveDisabled).toBe(true);

  // 做一个不相干的修改再点保存：被挡住，服务器计划不变，错误仍在
  await field(page, 'fit:note').fill('SYNTH-pv note 2');
  await savePlan(page);
  ed = await readEditor(page);
  expect(ed.errors.length).toBe(3);
  expect(ed.hint).toBe(peHintErrors(3));
  expect(app.fake.lastPlan(0)?.lifts?.[0]?.def).toBe(-1);
  expect(app.fake.lastPlan(0)?.fitGoal).toEqual([5, 3]);

  // 起始值改成 0、最多改成 6：错误消失，提示行变成「有没保存的修改」
  await field(page, 'l:l-pv1:def').fill('0');
  await field(page, 'fit:max').fill('6');
  ed = await readEditor(page);
  expect(ed.errors).toEqual([]);
  expect(ed.hint).toBe(PE_HINT_DIRTY);

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.fitGoal?.join(','), { message: '等待新计划上传' }).toBe('5,6');
  expect(app.fake.lastPlan(0)?.lifts?.[0]?.def).toBe(0);
});

test('PLAN-03 deleting a lift without history removes it with an undo, and with history asks and archives it (D-01)', async ({
  app,
  page,
}) => {
  const plan: any = planWithLifts('pr', 2);
  const hist = [
    { date: '2026-03-01', v: 10 },
    { date: '2026-03-08', v: 12.5 },
    { date: '2026-03-15', v: 15 },
  ];
  await app.open({
    mode: 'cloud',
    seed: syntheticState('pr', { lifts: { 'l-pr1': { cur: 15, hist }, 'l-pr2': { cur: 7, hist: [] } } }),
    plan,
    login: 0,
  });
  const liftKeys = async () => (await readEditor(page)).lifts.map((l) => l.key);
  const toastState = () =>
    page.evaluate(() => {
      const t = document.querySelector('#toast');
      return { on: !!t?.classList.contains('on'), button: t?.querySelector('button')?.textContent ?? null };
    });
  const dlg = page.locator('dialog#confirm');

  await openEditor(page);
  // 上移下移：只在未归档的力量项之间换位，id 不变；首尾的按钮 disabled
  await expect(act(page, 'up', 'l:l-pr1')).toBeDisabled();
  await expect(act(page, 'down', 'l:l-pr2')).toBeDisabled();
  await act(page, 'down', 'l:l-pr1').click();
  expect(await liftKeys()).toEqual(['l:l-pr2', 'l:l-pr1']);
  await act(page, 'up', 'l:l-pr1').click();
  expect(await liftKeys()).toEqual(['l:l-pr1', 'l:l-pr2']);
  expect((await readEditor(page)).saveDisabled).toBe(true);

  // 草稿里新加的力量项：直接移除，toast 带「撤销移除」；撤销后回来，再删一次保留
  await act(page, 'addlift').click();
  const fresh = (await liftKeys())[2];
  expect(fresh).toMatch(/^l:l-[a-z0-9]+$/);
  await act(page, 'dellift', fresh).click();
  expect(await liftKeys()).toEqual(['l:l-pr1', 'l:l-pr2']);
  await expect.poll(toastState).toEqual({ on: true, button: BTN_PE_UNDO_REMOVE });
  await page.locator('#toast.act button').click();
  expect(await liftKeys()).toEqual(['l:l-pr1', 'l:l-pr2', fresh]);
  await act(page, 'dellift', fresh).click();
  expect(await liftKeys()).toEqual(['l:l-pr1', 'l:l-pr2']);

  // 没有历史的力量项（state 里有当前值、hist 为空）：直接移除，没有确认框；撤销回到第 2 位；再删一次保留
  await expand(page, 'l:l-pr2');
  await act(page, 'dellift', 'l:l-pr2').click();
  await expect(dlg).toHaveJSProperty('open', false);
  expect(await liftKeys()).toEqual(['l:l-pr1']);
  await page.locator('#toast.act button').click();
  expect(await liftKeys()).toEqual(['l:l-pr1', 'l:l-pr2']);
  await act(page, 'dellift', 'l:l-pr2').click();
  expect(await liftKeys()).toEqual(['l:l-pr1']);

  // 有 3 条历史的力量项：弹归档确认（.primary）；「不归档」后它还在；再删一次，确认后从主列表消失
  await expand(page, 'l:l-pr1');
  await act(page, 'dellift', 'l:l-pr1').click();
  const c = await readConfirm(page);
  expect(c.title).toBe(PE_ARCH_LIFT_TITLE);
  expect(c.lines.length).toBe(3);
  expect(c.lines[0].startsWith('「') && c.lines[0].endsWith('」有 3 条力量记录。')).toBe(true);
  expect(c.lines[1]).toBe(PE_ARCH_LIFT_BODY);
  expect(c.lines[2]).toBe(PE_ARCH_RESTORE);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_PE_ARCH_NO);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_ARCH_LIFT);
  await expect(page.locator('#cfOk')).toHaveClass(/primary/);
  await confirmCancel(page);
  expect(await liftKeys()).toEqual(['l:l-pr1']);
  await act(page, 'dellift', 'l:l-pr1').click();
  await readConfirm(page);
  await confirmOk(page);
  expect(await liftKeys()).toEqual([]);

  // 保存：服务器计划里 l-pr1 归档、l-pr2 没了；服务器 state 里 l-pr1 的历史还在 3 条，l-pr2 的键没了
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.lifts?.length, { message: '等待新计划上传' }).toBe(1);
  const saved: any = app.fake.lastPlan(0);
  expect([saved.lifts[0].id, saved.lifts[0].archived]).toEqual(['l-pr1', true]);
  await expect.poll(() => 'l-pr2' in (app.fake.lastState(0)?.lifts ?? {}), { message: '等待 state 清理上传' }).toBe(false);
  const lifts: any = app.fake.lastState(0)?.lifts;
  expect(lifts['l-pr1'].hist.length).toBe(3);
  expect(lifts['l-pr1'].cur).toBe(15);
});

test("PLAN-02 base preset tags are added, renamed, reordered and deleted per category, a duplicate or empty tag blocks saving, the user's own composer tags stay and a tag in both lists shows once (D-15, A20)", async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pt', 1);
  // 用户自己在「记一笔」里加的标签（state.presets，键是类别显示名）：其中一个和基础标签重名
  const userPresets = { 语言: { add: ['SYNTH-pt preset', 'SYNTH-pt mine'], hide: [] } };
  await app.open({ mode: 'cloud', seed: syntheticState('pt', { presets: userPresets }), plan, login: 0 });
  const tagBtn = (name: string) => page.locator(`#wkComp [data-preset="w|${name}"]`);
  const toastState = () =>
    page.evaluate(() => {
      const t = document.querySelector('#toast');
      return {
        on: !!t?.classList.contains('on'),
        prefix: (t?.querySelector('span')?.textContent ?? '').startsWith('已从草稿移除：'),
        button: t?.querySelector('button')?.textContent ?? null,
      };
    });

  // 重名去重：「记一笔」选「语言」时，两层都有的标签只显示一个（基础的那个），用户自己的也各一个
  await expect(tagBtn('SYNTH-pt preset')).toHaveCount(1);
  await expect(tagBtn('SYNTH-pt mine')).toHaveCount(1);

  await openEditor(page);
  // 五张类别卡，没有上移下移；「语言」摘要 1 个标签，「其他」展开显示空提示
  const cards = page.locator('#pe-main .pe-card[data-key^="p:"]');
  await expect(cards).toHaveCount(5);
  await expect(cards.locator('.pe-card-h [data-peact="up"], .pe-card-h [data-peact="down"]')).toHaveCount(0);
  await expect(card(page, 'p:lang').locator('.pe-sum')).toHaveText(pePresetCount(1));
  await expand(page, 'p:oth');
  await expect(card(page, 'p:oth').locator('.empty')).toHaveText(PE_PRESETS_EMPTY);
  await expect(card(page, 'p:oth').locator('.pe-sum')).toHaveText(pePresetCount(0));
  await expect(act(page, 'addtag', 'p:oth')).toHaveText(BTN_ADD_TAG);

  // 在「语言」加两个标签 b、c；把 c 上移到第 2 位；第一个改名为 a；删除 b（撤销 toast 出现，不撤销）
  await expand(page, 'p:lang');
  await expect(field(page, 'p:lang:0')).toHaveAttribute('maxlength', '30');
  await act(page, 'addtag', 'p:lang').click();
  await expect(field(page, 'p:lang:1')).toBeFocused();
  await field(page, 'p:lang:1').fill('SYNTH-pt b');
  await act(page, 'addtag', 'p:lang').click();
  await field(page, 'p:lang:2').fill('SYNTH-pt c');
  await act(page, 'up', 'p:lang:2').click();
  await expect(field(page, 'p:lang:1')).toHaveValue('SYNTH-pt c');
  await expect(field(page, 'p:lang:2')).toHaveValue('SYNTH-pt b');
  await field(page, 'p:lang:0').fill('SYNTH-pt a');
  await act(page, 'del', 'p:lang:2').click();
  await expect(field(page, 'p:lang:2')).toHaveCount(0);
  await expect.poll(toastState).toEqual({ on: true, prefix: true, button: BTN_PE_UNDO_REMOVE });
  await expect(card(page, 'p:lang').locator('.pe-sum')).toHaveText(pePresetCount(2));

  // 再加一个标签，填 ` SYNTH-pt a `（首尾空格）：和第一个重复（比较时去掉首尾空格），点保存被挡住，这一行显示重复错误
  await act(page, 'addtag', 'p:lang').click();
  await field(page, 'p:lang:2').fill(' SYNTH-pt a ');
  await savePlan(page);
  let ed = await readEditor(page);
  expect(ed.errors).toEqual([{ key: 'p:lang:2', text: PE_ERR_TAG_DUP }]);
  expect(ed.hint).toBe(peHintErrors(1));
  expect(app.fake.lastPlan(0)?.presets?.lang).toEqual(['SYNTH-pt preset']);
  // 清空：改为「请填写标签内容」
  await field(page, 'p:lang:2').fill('');
  ed = await readEditor(page);
  expect(ed.errors).toEqual([{ key: 'p:lang:2', text: PE_ERR_TAG_EMPTY }]);
  // 删掉这一行：错误没了，能保存
  await act(page, 'del', 'p:lang:2').click();
  ed = await readEditor(page);
  expect(ed.errors).toEqual([]);

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  // 服务器计划：语言是 [a, c]，其余类别不变；服务器 state 的 presets 和打开前逐字相同
  await expect.poll(() => (app.fake.lastPlan(0)?.presets?.lang ?? []).join('|'), { message: '等待新计划上传' }).toBe('SYNTH-pt a|SYNTH-pt c');
  expect(app.fake.lastPlan(0)?.presets).toEqual({ lang: ['SYNTH-pt a', 'SYNTH-pt c'], pro: [], fit: [], job: [], oth: [] });
  expect(app.fake.lastState(0)?.presets).toEqual(userPresets);

  // 「记一笔」：新的基础标签和用户自己的两个标签各显示一次（原来重名的 preset 现在只是用户自己的）
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  for (const name of ['SYNTH-pt a', 'SYNTH-pt c', 'SYNTH-pt preset', 'SYNTH-pt mine']) await expect(tagBtn(name)).toHaveCount(1);

  // 上限：同一个账号里在「求职」加满 20 个标签，添加按钮 disabled，旁边写「最多 20 个」，摘要 20 个标签
  await openEditor(page);
  await expand(page, 'p:job');
  for (let i = 0; i < 20; i += 1) await act(page, 'addtag', 'p:job').click();
  await expect(card(page, 'p:job').locator('.pe-row')).toHaveCount(20);
  await expect(act(page, 'addtag', 'p:job')).toBeDisabled();
  await expect(card(page, 'p:job').locator('.pe-lim')).toHaveText(PE_LIMIT_TAGS);
  await expect(card(page, 'p:job').locator('.pe-sum')).toHaveText(pePresetCount(20));
  await expect(act(page, 'addtag', 'p:lang')).toBeEnabled();
});

test('PLAN-02 saving with an error in a collapsed preset card expands it and focuses the field (WR-01)', async ({ app, page }) => {
  const plan: any = syntheticPlan('pw', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('pw'), plan, login: 0 });
  await openEditor(page);

  // 在「语言」加一个空标签，再把这张卡折叠起来
  await expand(page, 'p:lang');
  await act(page, 'addtag', 'p:lang').click();
  await card(page, 'p:lang').locator('[data-peact="toggle"]').click();
  await expect(card(page, 'p:lang').locator('[data-peact="toggle"]')).toHaveAttribute('aria-expanded', 'false');

  // 点保存：被挡住，卡片展开，焦点落在出错的那一行
  await savePlan(page);
  await expect(card(page, 'p:lang').locator('[data-peact="toggle"]')).toHaveAttribute('aria-expanded', 'true');
  await expect(field(page, 'p:lang:1')).toBeFocused();
  const ed = await readEditor(page);
  expect(ed.errors).toEqual([{ key: 'p:lang:1', text: PE_ERR_TAG_EMPTY }]);
  expect(app.fake.lastPlan(0)?.presets?.lang).toEqual(['SYNTH-pw preset']);
});
