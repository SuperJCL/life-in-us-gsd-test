// Phase 12-04 的云端用例（PLAN-02、PLAN-03，编辑计划页里目标组和任务的增改、排序、删除与归档、校验与上限、转义、导出再导入）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readGroupIds, readGroups } from '../support/goals';
import { gotoTimeline } from '../support/timeline';
import { act, card, expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { BTN_ADD_GROUP, BTN_ADD_TASK, TOAST_PLAN_SAVED } from '../support/strings';

// 计划里每个组和它的任务的 id 列表（只比较 id，不涉及计划文字）
const idsOf = (plan: any) => plan.groups.map((g: any) => [g.id, g.tasks.map((t: any) => t.id)]);

test('PLAN-02 a group and a task added in the plan editor get new g- and t- ids, keep the existing ids and show on the goals view after saving (D-15)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pg', 2);
  await app.open({
    mode: 'cloud',
    seed: syntheticState('pg', { tasks: { 't-pg1x1': { done: true, doneDate: '2026-03-17' } } }),
    plan,
    login: 0,
  });
  const before = idsOf(app.fake.lastPlan(0));
  const liftIds = plan.lifts.map((l: any) => l.id);
  const newGroupName = 'SYNTH-pg new group';
  const newTaskText = 'SYNTH-pg new task';
  const renamedTask = 'SYNTH-pg renamed task';
  const newNote = 'SYNTH-pg new note';

  await openEditor(page);
  // 两个按钮的文字是常量
  await expect(act(page, 'addgroup')).toHaveText(BTN_ADD_GROUP);

  // 添加目标组：新卡展开，焦点在它的名称框，新组默认类别「其他」、名称为空
  await act(page, 'addgroup').click();
  let ed = await readEditor(page);
  expect(ed.groups.length).toBe(3);
  const fresh = ed.groups[2];
  expect(fresh.key).toMatch(/^g:g-[a-z0-9]+$/);
  expect([fresh.expanded, fresh.cat, fresh.taskKeys]).toEqual([true, '其他', []]);
  const newId = fresh.key.slice(2);
  await expect(field(page, `${fresh.key}:name`)).toBeFocused();
  await expect(field(page, `${fresh.key}:name`)).toHaveValue('');

  // 填名称、选类别「专业」（aria-pressed 跟着变）、填备注
  await field(page, `${fresh.key}:name`).fill(newGroupName);
  await card(page, fresh.key).locator('[data-peact="cat"][data-pecat="专业"]').click();
  const pressed = card(page, fresh.key).locator('.seg [aria-pressed="true"]');
  await expect(pressed).toHaveCount(1);
  await expect(pressed).toHaveAttribute('data-pecat', '专业');
  await field(page, `${fresh.key}:note`).fill(newNote);

  // 添加任务：焦点到新任务输入框，填文字
  await card(page, fresh.key).locator('[data-peact="addtask"]').click();
  ed = await readEditor(page);
  const newTaskKey = ed.groups[2].taskKeys[0];
  expect(newTaskKey).toMatch(/^t:t-[a-z0-9]+$/);
  await expect(field(page, `${newTaskKey}:text`)).toBeFocused();
  await field(page, `${newTaskKey}:text`).fill(newTaskText);
  await expect(card(page, fresh.key).locator('[data-peact="addtask"]')).toHaveText(BTN_ADD_TASK);

  // 改已完成任务的文字
  await expand(page, 'g:g-pg1');
  await field(page, 't:t-pg1x1:text').fill(renamedTask);

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器计划：原来的组、任务、力量项 id 原样且顺序不变，末尾多出新组和新任务
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.length, { message: '等待新计划上传' }).toBe(3);
  const saved: any = app.fake.lastPlan(0);
  expect(idsOf(saved).slice(0, 2)).toEqual(before);
  expect(saved.lifts.map((l: any) => l.id)).toEqual(liftIds);
  const added = saved.groups[2];
  expect(added.id).toBe(newId);
  expect(added.id).toMatch(/^g-[a-z0-9]+$/);
  expect([added.name === newGroupName, added.cat, added.note === newNote]).toEqual([true, '专业', true]);
  expect(added.tasks.length).toBe(1);
  expect(added.tasks[0].id).toMatch(/^t-[a-z0-9]+$/);
  expect(`t:${added.tasks[0].id}`).toBe(newTaskKey);
  expect(added.tasks[0].text === newTaskText).toBe(true);
  expect(saved.groups[0].tasks[0].id).toBe('t-pg1x1');
  expect(saved.groups[0].tasks[0].text === renamedTask).toBe(true);
  // 重命名的任务的进度键还在服务器 state 里
  await expect
    .poll(() => app.fake.lastState(0)?.tasks?.['t-pg1x1']?.done === true, { message: '等待 state 里的进度键' })
    .toBe(true);

  // 目标页：新组是 P3；时间线：完成记录显示新文字
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['P1', 'P2', 'P3']);
  expect((await readGroupIds(page))[2]).toBe(newId);
  await gotoTimeline(page);
  expect(
    await page.evaluate((t) => (document.querySelector('#timeline')?.textContent ?? '').includes('完成：' + t), renamedTask),
  ).toBe(true);
});
