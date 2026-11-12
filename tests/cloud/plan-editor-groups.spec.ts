// Phase 12-04 的云端用例（PLAN-02、PLAN-03，编辑计划页里目标组和任务的增改、排序、删除与归档、校验与上限、转义、导出再导入）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readArchived, readGroupIds, readGroups } from '../support/goals';
import { gotoTimeline } from '../support/timeline';
import { act, card, expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import {
  BTN_ADD_GROUP,
  BTN_ADD_TASK,
  BTN_PE_ARCH_GROUP,
  BTN_PE_ARCH_NO,
  BTN_PE_ARCH_TASK,
  BTN_PE_UNDO_REMOVE,
  PE_ARCH_DUE_NOTE,
  PE_ARCH_GROUP_BODY,
  PE_ARCH_GROUP_TITLE,
  PE_ARCH_RESTORE,
  PE_ARCH_TASK_BODY,
  PE_ARCH_TASK_TITLE,
  PE_LIVE_ARCHIVED_PREFIX,
  PE_LIVE_RESTORED_PREFIX,
  TOAST_PE_REMOVED_PREFIX,
  TOAST_PLAN_SAVED,
} from '../support/strings';

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

// 读屏区 #pe-live 的文字是否以 prefix 开头 / 以 suffix 结尾（只回布尔，不回显计划文字）
const liveIs = (page: import('@playwright/test').Page, prefix: string, suffix = '') =>
  page.evaluate(
    ([a, b]) => {
      const t = document.querySelector('#pe-live')?.textContent ?? '';
      return t.startsWith(a) && t.endsWith(b);
    },
    [prefix, suffix],
  );

test('PLAN-02 groups and tasks move up and down within their own list, keep their ids and the goals view numbers the groups in the new order (D-14)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('po', 3);
  await app.open({ mode: 'cloud', seed: syntheticState('po'), plan, login: 0 });
  const before = idsOf(app.fake.lastPlan(0));
  const ids = (ed: Awaited<ReturnType<typeof readEditor>>) => ed.groups.map((g) => g.key);

  await openEditor(page);
  // 第 1 组的上移和第 3 组的下移不可用，其余可用
  await expect(act(page, 'up', 'g:g-po1')).toBeDisabled();
  await expect(act(page, 'down', 'g:g-po1')).toBeEnabled();
  await expect(act(page, 'down', 'g:g-po3')).toBeDisabled();
  await expect(act(page, 'up', 'g:g-po3')).toBeEnabled();

  // 第 3 组上移两次：顺序 3、1、2；第一次后焦点还在它的上移上，到顶后上移变 disabled，焦点落到同卡的下移
  await act(page, 'up', 'g:g-po3').click();
  expect(ids(await readEditor(page))).toEqual(['g:g-po1', 'g:g-po3', 'g:g-po2']);
  await expect(act(page, 'up', 'g:g-po3')).toBeFocused();
  expect(await liveIs(page, '已上移：', '，现在是第 2 项，共 3 项')).toBe(true);
  await act(page, 'up', 'g:g-po3').click();
  let ed = await readEditor(page);
  expect(ids(ed)).toEqual(['g:g-po3', 'g:g-po1', 'g:g-po2']);
  expect(ed.groups.map((g) => g.no)).toEqual(['P1', 'P2', 'P3']);
  await expect(act(page, 'up', 'g:g-po3')).toBeDisabled();
  await expect(act(page, 'down', 'g:g-po3')).toBeFocused();
  expect(await liveIs(page, '已上移：', '，现在是第 1 项，共 3 项')).toBe(true);

  // 第 1 组（现在第 2 位）里把第 2 个任务上移：同组内交换，其它组不动
  await expand(page, 'g:g-po1');
  ed = await readEditor(page);
  expect(ed.groups.find((g) => g.key === 'g:g-po1')?.taskKeys).toEqual(['t:t-po1x1', 't:t-po1x2']);
  await expect(act(page, 'up', 't:t-po1x1')).toBeDisabled();
  await expect(act(page, 'down', 't:t-po1x2')).toBeDisabled();
  await act(page, 'up', 't:t-po1x2').click();
  ed = await readEditor(page);
  expect(ed.groups.find((g) => g.key === 'g:g-po1')?.taskKeys).toEqual(['t:t-po1x2', 't:t-po1x1']);
  expect(ed.groups.find((g) => g.key === 'g:g-po2')?.taskKeys).toEqual(['t:t-po2x1', 't:t-po2x2']);
  await expect(act(page, 'up', 't:t-po1x2')).toBeDisabled();
  await expect(act(page, 'down', 't:t-po1x2')).toBeFocused();
  expect(await liveIs(page, '已上移：', '，现在是第 1 项，共 2 项')).toBe(true);

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器计划的顺序和草稿完全一致，id 集合不变
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.[0]?.id, { message: '等待新顺序上传' }).toBe('g-po3');
  const saved: any = app.fake.lastPlan(0);
  expect(saved.groups.map((g: any) => g.id)).toEqual(['g-po3', 'g-po1', 'g-po2']);
  expect(saved.groups[1].tasks.map((t: any) => t.id)).toEqual(['t-po1x2', 't-po1x1']);
  expect(idsOf(saved).map((g: any) => g[0]).sort()).toEqual(before.map((g: any) => g[0]).sort());
  expect(saved.groups.flatMap((g: any) => g.tasks.map((t: any) => t.id)).sort()).toEqual(
    before.flatMap((g: any) => g[1]).sort(),
  );

  // 目标页：P1、P2、P3 对应 g-po3、g-po1、g-po2
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['P1', 'P2', 'P3']);
  expect(await readGroupIds(page)).toEqual(['g-po3', 'g-po1', 'g-po2']);
});

test('PLAN-03 deleting a task or a group without progress removes it from the draft with an undo, and with progress asks and archives it (D-01)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pd', 4);
  const done = { done: true, doneDate: '2026-03-17' };
  await app.open({
    mode: 'cloud',
    seed: syntheticState('pd', {
      tasks: { 't-pd1x1': done, 't-pd3x1': { due: '2026-03-20' }, 'c-pd2a': done, 't-pd4x1': { done: false, due: '' } },
      custom: [{ id: 'c-pd2a', group: 'g-pd2', text: 'SYNTH-pd custom' }],
    }),
    plan,
    login: 0,
  });
  const taskKeysOf = async (gKey: string) => (await readEditor(page)).groups.find((g) => g.key === gKey)?.taskKeys;
  const toastState = () =>
    page.evaluate(() => {
      const t = document.querySelector('#toast');
      return {
        on: !!t?.classList.contains('on'),
        prefix: (t?.querySelector('span')?.textContent ?? '').startsWith('已从草稿移除：'),
        button: t?.querySelector('button')?.textContent ?? null,
      };
    });

  await openEditor(page);
  await expand(page, 'g:g-pd2');

  // 没有进度的任务：直接移除，toast 带「撤销移除」，读屏区说明；焦点落到上一行的输入框（它是最后一行）
  await act(page, 'del', 't:t-pd2x2').click();
  expect(await taskKeysOf('g:g-pd2')).toEqual(['t:t-pd2x1']);
  await expect.poll(toastState).toEqual({ on: true, prefix: true, button: BTN_PE_UNDO_REMOVE });
  expect(await liveIs(page, TOAST_PE_REMOVED_PREFIX)).toBe(true);
  await expect(field(page, 't:t-pd2x1:text')).toBeFocused();
  expect((await readEditor(page)).saveDisabled).toBe(false);

  // 撤销移除：回到原来的位置，又没有修改了
  await page.locator('#toast.act button').click();
  expect(await taskKeysOf('g:g-pd2')).toEqual(['t:t-pd2x1', 't:t-pd2x2']);
  expect(await liveIs(page, PE_LIVE_RESTORED_PREFIX)).toBe(true);
  expect((await readEditor(page)).saveDisabled).toBe(true);

  // 再删一次，这次保留
  await act(page, 'del', 't:t-pd2x2').click();
  expect(await taskKeysOf('g:g-pd2')).toEqual(['t:t-pd2x1']);

  // 没有进度的组：直接移除并可撤销（回到第 4 位）；再删一次保留
  await expand(page, 'g:g-pd4');
  await act(page, 'delgroup', 'g:g-pd4').click();
  expect((await readEditor(page)).groups.map((g) => g.key)).toEqual(['g:g-pd1', 'g:g-pd2', 'g:g-pd3']);
  await expect.poll(toastState).toEqual({ on: true, prefix: true, button: BTN_PE_UNDO_REMOVE });
  await page.locator('#toast.act button').click();
  expect((await readEditor(page)).groups.map((g) => g.key)).toEqual(['g:g-pd1', 'g:g-pd2', 'g:g-pd3', 'g:g-pd4']);
  await act(page, 'delgroup', 'g:g-pd4').click();
  expect((await readEditor(page)).groups.length).toBe(3);

  // 已完成的任务：弹归档确认（.primary），「不归档」后它还在；再删一次，确认后从主列表消失
  await expand(page, 'g:g-pd1');
  const dlg = page.locator('dialog#confirm');
  await act(page, 'del', 't:t-pd1x1').click();
  let c = await readConfirm(page);
  expect(c.title).toBe(PE_ARCH_TASK_TITLE);
  expect(c.lines.length).toBe(3);
  expect(c.lines[0].startsWith('「') && c.lines[0].endsWith('」已完成。')).toBe(true);
  expect(c.lines[1]).toBe(PE_ARCH_TASK_BODY);
  expect(c.lines[2]).toBe(PE_ARCH_RESTORE);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_PE_ARCH_NO);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_ARCH_TASK);
  await expect(page.locator('#cfOk')).toHaveClass(/primary/);
  await expect(dlg).toHaveClass(/pe/);
  await confirmCancel(page);
  expect(await taskKeysOf('g:g-pd1')).toEqual(['t:t-pd1x1', 't:t-pd1x2']);
  await act(page, 'del', 't:t-pd1x1').click();
  await readConfirm(page);
  await confirmOk(page);
  expect(await taskKeysOf('g:g-pd1')).toEqual(['t:t-pd1x2']);
  expect(await liveIs(page, PE_LIVE_ARCHIVED_PREFIX)).toBe(true);

  // 只设了截止日期的任务：确认框第二段多一句截止提醒的说明，状态写「设了截止日期（3月20日）」
  await expand(page, 'g:g-pd3');
  await act(page, 'del', 't:t-pd3x1').click();
  c = await readConfirm(page);
  expect(c.lines[0].endsWith('」设了截止日期（3月20日）。')).toBe(true);
  expect(c.lines[1]).toBe(PE_ARCH_TASK_BODY + PE_ARCH_DUE_NOTE);
  await confirmCancel(page);
  expect(await taskKeysOf('g:g-pd3')).toEqual(['t:t-pd3x1', 't:t-pd3x2']);

  // 没有进度的任务但组里有自定义待办：「删除这个目标组」弹「归档这个目标组？」，正文写明自定义待办数
  await act(page, 'delgroup', 'g:g-pd2').click();
  c = await readConfirm(page);
  expect(c.title).toBe(PE_ARCH_GROUP_TITLE);
  expect(c.lines[0].startsWith('「') && c.lines[0].endsWith('」里有1 个自定义待办。')).toBe(true);
  expect(c.lines[1]).toBe(PE_ARCH_GROUP_BODY);
  expect(c.lines[2]).toBe(PE_ARCH_RESTORE);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_ARCH_GROUP);
  await expect(page.locator('#cfOk')).toHaveClass(/primary/);
  await confirmCancel(page);
  expect((await readEditor(page)).groups.length).toBe(3);
  await act(page, 'delgroup', 'g:g-pd2').click();
  await readConfirm(page);
  await confirmOk(page);
  expect((await readEditor(page)).groups.map((g) => g.key)).toEqual(['g:g-pd1', 'g:g-pd3']);

  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器计划：g-pd4 不在了，t-pd2x2 不在了；t-pd1x1 和 g-pd2 带 archived: true；顺序不变
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.length, { message: '等待新计划上传' }).toBe(3);
  const saved: any = app.fake.lastPlan(0);
  expect(saved.groups.map((g: any) => g.id)).toEqual(['g-pd1', 'g-pd2', 'g-pd3']);
  expect(saved.groups[0].tasks.map((t: any) => [t.id, t.archived === true])).toEqual([
    ['t-pd1x1', true],
    ['t-pd1x2', false],
  ]);
  expect(saved.groups[1].archived).toBe(true);
  expect(saved.groups[1].tasks.map((t: any) => t.id)).toEqual(['t-pd2x1']);
  expect(saved.groups[2].archived).toBeUndefined();

  // 服务器 state：离开计划的任务（t-pd4x1）的进度键被删，归档的任务和组的进度、自定义待办原样还在
  await expect
    .poll(() => app.fake.lastState(0)?.tasks?.['t-pd4x1'] === undefined, { message: '等待 state 清掉离开计划的进度键' })
    .toBe(true);
  const st: any = app.fake.lastState(0);
  expect(st.tasks['t-pd1x1']?.done).toBe(true);
  expect(st.tasks['t-pd3x1']?.due).toBe('2026-03-20');
  expect(st.tasks['c-pd2a']?.done).toBe(true);
  expect(st.custom.map((x: any) => x.id)).toEqual(['c-pd2a']);

  // 目标页「已归档」区有它们
  await gotoGoals(page);
  const arch = await readArchived(page);
  // 归档组连同它的任务和自定义待办一起列出，再加上单独归档的 t-pd1x1
  expect([arch.present, arch.groupIds, [...arch.taskIds].sort()]).toEqual([true, ['g-pd2'], ['c-pd2a', 't-pd1x1', 't-pd2x1']]);
});
