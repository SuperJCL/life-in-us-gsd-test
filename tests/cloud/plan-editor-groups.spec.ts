// Phase 12-04 的云端用例（PLAN-02、PLAN-03，编辑计划页里目标组和任务的增改、排序、删除与归档、校验与上限、转义、导出再导入）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readArchived, readGroupIds, readGroups } from '../support/goals';
import { gotoTimeline } from '../support/timeline';
import { act, card, expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { downloadOf } from '../support/download';
import { chooseImportFile, textImportFile } from '../support/import-file';
import { DQ_PAYLOAD, IMG_PAYLOAD, SCRIPT_PAYLOAD, TAG_PAYLOAD } from '../fixtures/malicious-state';
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
  PE_ERR_GROUP_LIMIT,
  PE_ERR_GROUP_NAME,
  PE_ERR_TAG_LONG,
  PE_ERR_TASK_LIMIT,
  PE_ERR_TASK_LONG,
  PE_ERR_TASK_TEXT,
  PE_ERR_UNIT_LONG,
  PE_HINT_DIRTY,
  PE_HINT_NONE,
  PE_LIMIT_GROUPS,
  PE_LIMIT_TASKS,
  PE_LIVE_ARCHIVED_PREFIX,
  PE_LIVE_RESTORED_PREFIX,
  TOAST_IMPORTED,
  TOAST_PE_REMOVED_PREFIX,
  TOAST_PLAN_SAVED,
  peBadCount,
  peHintErrors,
} from '../support/strings';

test.use({ acceptDownloads: true });

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

test('PLAN-02 an empty group name or task text blocks saving with the error next to the field and opens the card (D-17)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pv', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('pv'), plan, login: 0 });
  const original = plan.groups[0].name;
  const hint = () => page.locator('#pe-hint');

  await openEditor(page);
  await expand(page, 'g:g-pv1');

  // 失去焦点后才显示错误：清空组名，失焦之前没有错误，失焦之后出现；填回合法的值错误立刻消失
  const name1 = field(page, 'g:g-pv1:name');
  await name1.fill('');
  expect((await readEditor(page)).errors).toEqual([]);
  await name1.blur();
  let ed = await readEditor(page);
  expect(ed.errors).toEqual([{ key: 'g:g-pv1:name', text: PE_ERR_GROUP_NAME }]);
  expect(ed.groups[0].bad).toBe(peBadCount(1));
  await expect(name1).toHaveAttribute('aria-invalid', 'true');
  const describedBy = (await name1.getAttribute('aria-describedby')) ?? '';
  expect(await page.evaluate((id) => !!document.getElementById(id) && !document.getElementById(id)!.hidden, describedBy)).toBe(true);
  await name1.fill(original);
  ed = await readEditor(page);
  expect([ed.errors, ed.groups[0].bad]).toEqual([[], '']);
  await expect(name1).not.toHaveAttribute('aria-invalid', 'true');
  // 改回原样：没有修改
  expect((await readEditor(page)).saveDisabled).toBe(true);

  // 新建一个组不填名称，给它加一个任务不填；点保存：不保存
  await act(page, 'addgroup').click();
  const key = (await readEditor(page)).groups[2].key;
  await card(page, key).locator('[data-peact="addtask"]').click();
  const writes = app.fake.writes.length;
  await savePlan(page);
  ed = await readEditor(page);
  expect(app.fake.writes.length).toBe(writes);
  expect(ed.open).toBe(true);
  expect(ed.hint).toBe(peHintErrors(2));
  expect(ed.tone).toBe('error');
  expect(ed.saveDisabled).toBe(false);
  expect(ed.groups[2].expanded).toBe(true);
  expect(ed.groups[2].bad).toBe(peBadCount(2));
  expect(ed.errors.map((e) => e.text)).toEqual([PE_ERR_GROUP_NAME, PE_ERR_TASK_TEXT]);
  // 焦点在第一个出错的字段（名称框）
  await expect(field(page, `${key}:name`)).toBeFocused();

  // 折叠这张卡：头部仍显示「有 2 处要改」；再点保存会自动展开
  await card(page, key).locator('[data-peact="toggle"]').click();
  ed = await readEditor(page);
  expect([ed.groups[2].expanded, ed.groups[2].bad]).toEqual([false, peBadCount(2)]);
  await savePlan(page);
  ed = await readEditor(page);
  expect(ed.groups[2].expanded).toBe(true);
  await expect(field(page, `${key}:name`)).toBeFocused();
  expect(app.fake.writes.length).toBe(writes);

  // 填上名称：名称的错误立刻消失，提示行变成「有 1 处…」
  await field(page, `${key}:name`).fill('SYNTH-pv named');
  ed = await readEditor(page);
  expect(ed.errors.map((e) => e.text)).toEqual([PE_ERR_TASK_TEXT]);
  expect(ed.hint).toBe(peHintErrors(1));
  expect(ed.groups[2].bad).toBe(peBadCount(1));

  // 填上任务：错误清零，提示行回到「有没保存的修改」，能保存
  const taskKey = ed.groups[2].taskKeys[0];
  await field(page, `${taskKey}:text`).fill('SYNTH-pv named task');
  ed = await readEditor(page);
  expect([ed.errors, ed.hint, ed.tone]).toEqual([[], PE_HINT_DIRTY, 'muted']);
  await expect(hint()).toHaveText(PE_HINT_DIRTY);
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.length, { message: '等待新计划上传' }).toBe(3);
  const saved: any = app.fake.lastPlan(0);
  expect(saved.groups[2].name === 'SYNTH-pv named').toBe(true);
  expect(saved.groups[2].tasks[0].text === 'SYNTH-pv named task').toBe(true);
});

test('PLAN-02 the add buttons stop at 20 groups and 50 tasks in a group (D-17)', async ({ app, page }) => {
  // 20 个组（其中 1 个已归档，只算 19 个）；第 1 组 50 项任务（其中 1 项已归档，只算 49 项）：归档的不占名额
  const plan: any = syntheticPlan('pl', 20);
  plan.groups[19].archived = true;
  plan.groups[0].tasks = Array.from({ length: 50 }, (_, i) => ({ id: `t-pl1x${i + 1}`, text: `SYNTH-pl task ${i + 1}` }));
  plan.groups[0].tasks[49].archived = true;
  await app.open({ mode: 'cloud', seed: syntheticState('pl'), plan, login: 0 });
  await openEditor(page);
  const counts = () =>
    page.evaluate(() => ({
      groups: document.querySelector('#pe-h-groups .pe-count')?.textContent ?? '',
      tasks: document.querySelector('#pe-main .pe-card[data-key="g:g-pl1"] .pe-sub .pe-count')?.textContent ?? '',
      lims: Array.from(document.querySelectorAll('#pe-main .pe-lim')).map((e) => e.textContent ?? ''),
    }));

  // 组：19/20，按钮可用，没有「最多」；点一下到 20/20，按钮 disabled，旁边写「最多 20 个」
  expect(await counts()).toEqual({ groups: '19/20', tasks: '49/50', lims: [] });
  await expect(act(page, 'addgroup')).toBeEnabled();
  await act(page, 'addgroup').click();
  expect((await readEditor(page)).groups.length).toBe(20);
  expect(await counts()).toEqual({ groups: '20/20', tasks: '49/50', lims: [PE_LIMIT_GROUPS] });
  await expect(act(page, 'addgroup')).toBeDisabled();
  expect((await readEditor(page)).addGroupDisabled).toBe(true);

  // 任务：第 1 组 49/50，点添加到 50/50，按钮 disabled，旁边写「最多 50 项」
  await expand(page, 'g:g-pl1');
  const addTask = card(page, 'g:g-pl1').locator('[data-peact="addtask"]');
  await expect(addTask).toBeEnabled();
  await addTask.click();
  expect(await counts()).toEqual({ groups: '20/20', tasks: '50/50', lims: [PE_LIMIT_TASKS, PE_LIMIT_GROUPS] });
  await expect(addTask).toBeDisabled();
  // 别的组不受影响
  await expand(page, 'g:g-pl2');
  await expect(card(page, 'g:g-pl2').locator('[data-peact="addtask"]')).toBeEnabled();

  // 长度上限：名称 40、备注 200、任务文字 200（属性读回）
  await expect(field(page, 'g:g-pl2:name')).toHaveAttribute('maxlength', '40');
  await expect(field(page, 'g:g-pl2:note')).toHaveAttribute('maxlength', '200');
  await expect(field(page, 't:t-pl2x1:text')).toHaveAttribute('maxlength', '200');

  // 计数：名称 32 个字时出现 32/40（31 个字时没有）；任务文字 160 个字时出现 160/200
  const cnt = (id: string) =>
    page.evaluate((i) => {
      const e = document.getElementById(i) as HTMLElement | null;
      return e && !e.hidden ? (e.textContent ?? '') : '';
    }, id);
  await field(page, 'g:g-pl2:name').fill('字'.repeat(31));
  expect(await cnt('pe-c-g-g-pl2-name')).toBe('');
  await field(page, 'g:g-pl2:name').fill('字'.repeat(32));
  expect(await cnt('pe-c-g-g-pl2-name')).toBe('32/40');
  await field(page, 't:t-pl2x1:text').fill('x'.repeat(160));
  expect(await cnt('pe-c-t-t-pl2x1-text')).toBe('160/200');
  await field(page, 't:t-pl2x1:text').fill('x'.repeat(159));
  expect(await cnt('pe-c-t-t-pl2x1-text')).toBe('');
});

// 注入检测器（同 tests/e2e/security/escaping.spec.ts 的 readInjection）：window 标记、带 data-synth-xss 的元素、多出来的元素、on 属性、脚本个数
async function readInjection(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    flag: Number((window as unknown as { __synthXss?: number }).__synthXss || 0),
    marked: document.querySelectorAll('[data-synth-xss]').length,
    foreign:
      document.querySelectorAll('s, details:not(#goalsArch), img, iframe, svg, object, embed').length +
      Math.max(0, document.querySelectorAll('#goalsArch').length - 1),
    handlers: Array.from(document.querySelectorAll('*')).filter((el) => Array.from(el.attributes).some((a) => a.name.startsWith('on'))).length,
    scripts: document.scripts.length,
  }));
}

test('PLAN-02 plan text with markup is shown as text in the plan editor', async ({ app, page }) => {
  const plan: any = syntheticPlan('px', 2);
  const gName = `${SCRIPT_PAYLOAD} name`;
  const gNote = `${IMG_PAYLOAD} note`;
  const t0 = `${TAG_PAYLOAD} task`;
  const t1 = `${DQ_PAYLOAD} task`;
  plan.groups[0].name = gName;
  plan.groups[0].note = gNote;
  plan.groups[0].tasks[0].text = t0;
  plan.groups[0].tasks[1].text = t1;
  plan.groups[1].name = `${TAG_PAYLOAD} second`;
  await app.open({
    mode: 'cloud',
    seed: syntheticState('px', { tasks: { 't-px1x1': { done: true, doneDate: '2026-03-17' } } }),
    plan,
    login: 0,
  });
  const scriptsBefore = (await readInjection(page)).scripts;

  await openEditor(page);
  await expand(page, 'g:g-px1');
  await expand(page, 'g:g-px2');
  const clean = { flag: 0, marked: 0, foreign: 0, handlers: 0, scripts: scriptsBefore };
  expect(await readInjection(page), '编辑页：有脚本执行或多出了元素').toEqual(clean);

  // 输入框的值等于载荷原文；卡片标题只是文字，title 放全名
  expect((await field(page, 'g:g-px1:name').inputValue()) === gName).toBe(true);
  expect((await field(page, 'g:g-px1:note').inputValue()) === gNote).toBe(true);
  expect((await field(page, 't:t-px1x1:text').inputValue()) === t0).toBe(true);
  expect((await field(page, 't:t-px1x2:text').inputValue()) === t1).toBe(true);
  expect(
    await page.evaluate(
      ([n]) => {
        const e = document.querySelector('#pe-n-g-g-px1') as HTMLElement | null;
        return !!e && e.textContent === n && e.title === n && e.children.length === 0;
      },
      [gName],
    ),
  ).toBe(true);

  // 触发一次归档确认框（已完成的任务）：文字在框里也只是文字
  await act(page, 'del', 't:t-px1x1').click();
  await readConfirm(page);
  expect(await readInjection(page), '归档确认框：有脚本执行或多出了元素').toEqual(clean);
  expect(
    await page.evaluate((t) => (document.querySelector('#cf-body p')?.textContent ?? '').includes(t.slice(0, 20)), t0),
  ).toBe(true);
  await confirmCancel(page);

  // 直接移除（没有进度的任务）的 toast 也一样
  await act(page, 'del', 't:t-px1x2').click();
  expect(await readInjection(page), '移除 toast：有脚本执行或多出了元素').toEqual(clean);
});

test('PLAN-02 after editing the plan an exported backup imports back with every task progress on the right task', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('rt', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('rt'), plan, login: 0 });

  // 编辑计划：新增一个组和任务，把新组上移到第 1 位，保存
  await openEditor(page);
  await act(page, 'addgroup').click();
  let ed = await readEditor(page);
  const gKey = ed.groups[2].key;
  await field(page, `${gKey}:name`).fill('SYNTH-rt new group');
  await card(page, gKey).locator('[data-peact="addtask"]').click();
  ed = await readEditor(page);
  const tKey = ed.groups[2].taskKeys[0];
  const tid = tKey.slice(2);
  await field(page, `${tKey}:text`).fill('SYNTH-rt new task');
  await act(page, 'up', gKey).click();
  await act(page, 'up', gKey).click();
  expect((await readEditor(page)).groups[0].key).toBe(gKey);
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.[0]?.id, { message: '等待新计划上传' }).toBe(gKey.slice(2));

  // 目标页勾选新任务，等服务器拿到进度
  await gotoGoals(page);
  const box = page.locator(`#goals [data-task="${tid}"]`);
  await box.check();
  await expect.poll(() => app.fake.lastState(0)?.tasks?.[tid]?.done === true, { message: '等待进度上传' }).toBe(true);

  // 下载 JSON 备份；再取消勾选；导入刚才的文件并确认
  const backup = await downloadOf(page, () => page.locator('#exportJson').click());
  await box.uncheck();
  await expect.poll(() => app.fake.lastState(0)?.tasks?.[tid]?.done === true, { message: '等待取消勾选上传' }).toBe(false);
  await chooseImportFile(page, textImportFile('synth-roundtrip.json', backup.text));
  await readConfirm(page);
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);

  // 新任务又是已完成、仍在新组里（P1），服务器 state 里它的进度键在，计划里它还在新组下
  await expect(page.locator(`#goals [data-task="${tid}"]`)).toBeChecked();
  const groups = await readGroups(page);
  expect(groups[0].taskIds).toEqual([tid]);
  expect(groups[0].doneIds).toEqual([tid]);
  expect((await readGroupIds(page))[0]).toBe(gKey.slice(2));
  await expect.poll(() => app.fake.lastState(0)?.tasks?.[tid]?.done === true, { message: '等待导入后的进度上传' }).toBe(true);
  expect(app.fake.lastPlan(0).groups[0].tasks[0].id).toBe(tid);
});

test('PLAN-02 a loaded plan over the D-17 limits cannot be saved until the excess is gone, and saving trims names and texts (WR-02)', async ({ app, page }) => {
  // 21 个组；第 2 组 51 项任务；第 1 组第 1 项任务 201 个字；力量项单位 9 个字；一个预设标签 31 个字。服务器的计划不拒绝这些，编辑页打开时就标出来
  const plan: any = syntheticPlan('wl', 21);
  plan.groups[0].tasks[0].text = 'x'.repeat(201);
  plan.groups[1].tasks = Array.from({ length: 51 }, (_, i) => ({ id: `t-wl2x${i + 1}`, text: `SYNTH-wl task 2.${i + 1}` }));
  plan.lifts[0].unit = 'u'.repeat(9);
  plan.presets.pro = ['p'.repeat(31)];
  await app.open({ mode: 'cloud', seed: syntheticState('wl'), plan, login: 0 });
  await openEditor(page);
  expect((await readEditor(page)).errors).toEqual([
    { key: 't:t-wl1x1:text', text: PE_ERR_TASK_LONG },
    { key: 't:t-wl2x51:text', text: PE_ERR_TASK_LIMIT },
    { key: 'g:g-wl21:name', text: PE_ERR_GROUP_LIMIT },
    { key: 'l:l-wl1:unit', text: PE_ERR_UNIT_LONG },
    { key: 'p:pro:0', text: PE_ERR_TAG_LONG },
  ]);

  // 改第 3 组的名称（带首尾空格）后点保存：被挡住，服务器计划不变
  await expand(page, 'g:g-wl3');
  await field(page, 'g:g-wl3:name').fill('  SYNTH-wl trimmed  ');
  await savePlan(page);
  expect((await readEditor(page)).hint).toBe(peHintErrors(5));
  expect((await readEditor(page)).open).toBe(true);
  expect(app.fake.lastPlan(0).groups.length).toBe(21);

  // 逐个改好：缩短任务文字、删掉第 21 组和第 2 组的第 51 项任务、缩短单位和标签
  await field(page, 't:t-wl1x1:text').fill('SYNTH-wl short');
  await act(page, 'delgroup', 'g:g-wl21').click();
  await act(page, 'del', 't:t-wl2x51').click();
  await field(page, 'l:l-wl1:unit').fill('kg');
  await field(page, 'p:pro:0').fill('SYNTH-wl tag');
  expect((await readEditor(page)).errors).toEqual([]);

  // 能保存了：名称首尾空格去掉
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.length, { message: '等待新计划上传' }).toBe(20);
  const saved = app.fake.lastPlan(0);
  expect(saved.groups[2].name === 'SYNTH-wl trimmed').toBe(true);
  expect(saved.groups[1].tasks.length).toBe(50);
  expect(saved.lifts[0].unit).toBe('kg');
  expect(saved.presets.pro).toEqual(['SYNTH-wl tag']);
});

test('PLAN-02 typing in an empty group note and clearing it again leaves the draft unchanged (IN-01)', async ({ app, page }) => {
  const plan: any = syntheticPlan('nt', 2);
  plan.groups[0].note = '';
  await app.open({ mode: 'cloud', seed: syntheticState('nt'), plan, login: 0 });
  await openEditor(page);
  await expand(page, 'g:g-nt1');
  await field(page, 'g:g-nt1:note').fill('SYNTH-nt note');
  expect((await readEditor(page)).hint).toBe(PE_HINT_DIRTY);
  await field(page, 'g:g-nt1:note').fill('');
  const ed = await readEditor(page);
  expect([ed.hint, ed.saveDisabled]).toEqual([PE_HINT_NONE, true]);
});
