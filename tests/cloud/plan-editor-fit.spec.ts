// Phase 12-05 的云端用例（PLAN-02、PLAN-03，编辑计划页里的健身分区和基础预设标签）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readLifts } from '../support/goals';
import { act, card, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { TAB_LABELS, TOAST_PLAN_SAVED, BTN_ADD_LIFT, PE_UNIT_EXAMPLE, weekFitGoalLine } from '../support/strings';

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
