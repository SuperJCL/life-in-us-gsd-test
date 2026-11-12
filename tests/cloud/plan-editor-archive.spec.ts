// Phase 12-06 的云端用例（PLAN-03、PLAN-02，编辑计划页底部的「已归档」区、彻底删除、空计划）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`，示例计划只比较 id 前缀、组数和任务数。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readArchived, readGroupIds, readGroups } from '../support/goals';
import { gotoCalendar, readMonth } from '../support/calendar';
import { gotoTimeline } from '../support/timeline';
import { act, discardPlan, expand, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { composer } from '../support/composer';
import { BUILTIN_GROUP_SIZES } from '../support/task-ids';
import {
  BTN_ADD_GROUP,
  BTN_LOAD_SAMPLE,
  BTN_PLAN_EDIT,
  GOALS_NO_GROUPS,
  GOALS_NO_LIFTS,
  PE_EMPTY_BODY,
  PE_EMPTY_TITLE,
  PE_GROUPS_EMPTY,
  PE_HINT_DIRTY,
  TAB_LABELS,
  TOAST_SAMPLE_LOADED,
  WEEK_EMPTY_PLAN,
  BTN_PURGE,
  BTN_PURGE_GROUP,
  BTN_PURGE_LIFT,
  BTN_PURGE_NO,
  BTN_PURGE_TASK,
  BTN_PE_LEAVE_GO,
  BTN_RESTORE,
  PE_ARCH_TASKS,
  PE_LEAVE_TITLE,
  PE_LIVE_PURGED_PREFIX,
  PE_PURGE_GROUP_RECORDS,
  PE_PURGE_GROUP_TITLE,
  PE_PURGE_LAST,
  PE_PURGE_LIFT_TITLE,
  PE_PURGE_TASK_RECORDS,
  PE_PURGE_TASK_TITLE,
  PE_RESTORE_LIMIT_GROUPS,
  PE_RESTORE_LIMIT_LIFTS,
  PE_RESTORE_LIMIT_TASKS,
  TOAST_PLAN_SAVED,
  archiveDueOn,
  archivedSummary,
  pePurgeCustom,
  toastRestored,
} from '../support/strings';

test("PLAN-03 an archived task is restored from the editor's archived area to the end of its group with its progress and due reminder (D-02, D-04)", async ({
  app,
  page,
}) => {
  // 第 1 组的第 1 个任务归档，设了冻结日当月的截止日期、未完成；第 1 组还剩第 2 个任务
  const plan: any = syntheticPlan('rs', 2);
  plan.groups[0].tasks[0].archived = true;
  const dueDate = '2026-03-20';
  const seed = syntheticState('rs', { logs: [], tasks: { 't-rs1x1': { due: dueDate } } });
  await app.open({ mode: 'cloud', seed, plan, login: 0 });

  const kindsOn = async (date: string) => (await readMonth(page)).cells.find((c) => c.date === date)?.kinds ?? [];

  // 归档着：日历上没有它的截止 chip
  await gotoCalendar(page);
  expect(await kindsOn(dueDate), '归档任务的截止日格子').toEqual([]);

  // 编辑页底部：「已归档（1）」默认折叠，只有「任务」一栏
  await openEditor(page);
  let ed = await readEditor(page);
  expect(ed.archived).toEqual({
    present: true,
    open: false,
    summary: archivedSummary(1),
    groups: [],
    tasks: ['t:t-rs1x1'],
    lifts: [],
  });
  expect(ed.restoreDisabled).toEqual([]);
  expect(ed.groups[0].taskKeys).toEqual(['t:t-rs1x2']);

  // 展开：只有「任务」这个小标题；说明写着来自第 1 组和截止日期；名称单行省略，title 放全名
  await page.locator('#pe-archived > summary').click();
  ed = await readEditor(page);
  expect(ed.archived.open).toBe(true);
  expect(await page.locator('#pe-archived .pe-arch-h').allTextContents()).toEqual([PE_ARCH_TASKS]);
  const row = page.locator('#pe-archived [data-row="t:t-rs1x1"]');
  await expect(row.locator('.pe-arch-name')).toHaveAttribute('title', plan.groups[0].tasks[0].text);
  await expect(row.locator('.pe-arch-desc')).toHaveText(`来自「${plan.groups[0].name}」· ${archiveDueOn('3月20日')}`);
  await expect(act(page, 'restore', 't:t-rs1x1')).toHaveText(BTN_RESTORE);
  await expect(act(page, 'purge', 't:t-rs1x1')).toHaveText(BTN_PURGE);

  // 点「恢复」：不弹确认，toast「已恢复：…」，区消失，任务排到原组末尾
  await act(page, 'restore', 't:t-rs1x1').click();
  await expectToast(page, toastRestored(plan.groups[0].tasks[0].text));
  ed = await readEditor(page);
  expect(ed.archived.present).toBe(false);
  expect(ed.groups[0].taskKeys).toEqual(['t:t-rs1x2', 't:t-rs1x1']);
  await expect(page.locator('#pe-h-groups'), '区消失之后焦点到目标组分区的标题').toBeFocused();
  expect(ed.saveDisabled, '恢复改了草稿').toBe(false);

  // 保存：服务器计划里它在原组末尾、没有 archived 键；它的截止日期原样
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect
    .poll(() => app.fake.lastPlan(0)?.groups?.[0]?.tasks?.map((t: any) => t.id).join(','), { message: '等待新计划上传' })
    .toBe('t-rs1x2,t-rs1x1');
  const saved: any = app.fake.lastPlan(0);
  expect(saved.groups[0].tasks.map((t: any) => 'archived' in t)).toEqual([false, false]);
  expect(app.fake.lastState(0)?.tasks?.['t-rs1x1']?.due).toBe(dueDate);

  // 目标页：第 1 组里有它的日期输入框，值是那个日期
  await gotoGoals(page);
  expect((await readGroups(page))[0].taskIds).toEqual(['t-rs1x2', 't-rs1x1']);
  await expect(page.locator('#goals [data-due="t-rs1x1"]')).toHaveValue(dueDate);

  // 日历：截止提醒回来了
  await gotoCalendar(page);
  expect(await kindsOn(dueDate), '恢复之后截止日格子').toEqual(['due']);
});

test('PLAN-03 permanently deleting an archived task, group or lift asks again and after saving removes its progress, custom to-dos and lift history (D-02)', async ({
  app,
  page,
}) => {
  // 3 组：第 1 组的第 1 个任务已完成并归档；第 2 组归档，任务 t-pu2x1 已完成，另有一条已完成的自定义待办 c-pu-1；
  // 第 3 组第 1 个任务已完成（留着），第 2 个任务归档并设了截止日期（留着）；第二个力量项 l-pu2 归档，有 2 条历史
  const plan: any = syntheticPlan('pu', 3);
  plan.groups[0].tasks[0].archived = true;
  plan.groups[1].archived = true;
  plan.groups[2].tasks[1].archived = true;
  plan.lifts.push({ id: 'l-pu2', n: 'SYNTH-pu lift two', unit: 'kg', def: 10, target: 30, note: '', archived: true });
  const done = { done: true, doneDate: '2026-03-10' };
  const hist = [
    { date: '2026-02-02', v: 20 },
    { date: '2026-02-09', v: 24 },
  ];
  const seed = syntheticState('pu', {
    logs: [],
    custom: [{ id: 'c-pu-1', group: 'g-pu2', text: 'SYNTH-pu custom' }],
    tasks: { 't-pu1x1': done, 't-pu2x1': done, 'c-pu-1': done, 't-pu3x1': done, 't-pu3x2': { due: '2026-03-25' } },
    lifts: { 'l-pu2': { cur: 24, hist } },
  });
  await app.open({ mode: 'cloud', seed, plan, login: 0 });

  await openEditor(page);
  await page.locator('#pe-archived > summary').click();
  let ed = await readEditor(page);
  expect(ed.archived.summary).toBe(archivedSummary(4));
  expect(ed.archived.groups).toEqual(['g:g-pu2']);
  expect(ed.archived.tasks, 't-pu2x1 属于归档的组，不单独列出').toEqual(['t:t-pu1x1', 't:t-pu3x2']);
  expect(ed.archived.lifts).toEqual(['l:l-pu2']);

  // 任务：确认框写明进度和完成记录；「不删除」之后它还在；再点，确认后从区里消失
  await act(page, 'purge', 't:t-pu1x1').click();
  let cf = await readConfirm(page);
  expect(cf.title).toBe(PE_PURGE_TASK_TITLE);
  expect(cf.lines.length).toBe(3);
  expect(cf.lines[0].includes('已完成')).toBe(true);
  expect(cf.lines.slice(1)).toEqual([PE_PURGE_TASK_RECORDS, PE_PURGE_LAST]);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PURGE_TASK);
  await expect(page.locator('#cfOk'), '确认按钮是红色的 .danger').toHaveClass(/danger/);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_PURGE_NO);
  await expect(page.locator('#cfCancel'), '默认焦点在「不删除」').toBeFocused();
  await confirmCancel(page);
  expect((await readEditor(page)).archived.tasks, '点了「不删除」').toContain('t:t-pu1x1');
  await act(page, 'purge', 't:t-pu1x1').click();
  await readConfirm(page);
  await confirmOk(page);
  ed = await readEditor(page);
  expect(ed.archived.tasks).toEqual(['t:t-pu3x2']);
  await expect(page.locator('#pe-live')).toHaveText(`${PE_LIVE_PURGED_PREFIX}${plan.groups[0].tasks[0].text}`);

  // 目标组：正文写明「1 个自定义待办也会一起删除」
  await act(page, 'purge', 'g:g-pu2').click();
  cf = await readConfirm(page);
  expect(cf.title).toBe(PE_PURGE_GROUP_TITLE);
  expect(cf.lines.length).toBe(4);
  expect(cf.lines.slice(1)).toEqual([PE_PURGE_GROUP_RECORDS, pePurgeCustom(1), PE_PURGE_LAST]);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PURGE_GROUP);
  await confirmOk(page);

  // 力量项：写着 2 条力量记录
  await act(page, 'purge', 'l:l-pu2').click();
  cf = await readConfirm(page);
  expect(cf.title).toBe(PE_PURGE_LIFT_TITLE);
  expect(cf.lines.length).toBe(2);
  expect(cf.lines[0].includes('2 条力量记录')).toBe(true);
  expect(cf.lines[1]).toBe(PE_PURGE_LAST);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PURGE_LIFT);
  await confirmOk(page);
  ed = await readEditor(page);
  expect(ed.archived.groups).toEqual([]);
  expect(ed.archived.lifts).toEqual([]);
  expect(ed.archived.tasks).toEqual(['t:t-pu3x2']);

  // 保存：服务器计划里没有这三项；state 里它们的进度、组的自定义待办和力量历史都没了；留下的项原样
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect
    .poll(() => app.fake.lastPlan(0)?.groups?.map((g: any) => g.id).join(','), { message: '等待新计划上传' })
    .toBe('g-pu1,g-pu3');
  const saved: any = app.fake.lastPlan(0);
  expect(saved.groups[0].tasks.map((t: any) => t.id)).toEqual(['t-pu1x2']);
  expect(saved.lifts.map((l: any) => l.id)).toEqual(['l-pu1']);
  await expect
    .poll(() => Object.keys(app.fake.lastState(0)?.tasks ?? {}).sort().join(','), { message: '等待 state 清理上传' })
    .toBe('t-pu3x1,t-pu3x2');
  const st: any = app.fake.lastState(0);
  expect(st.custom ?? [], '组里的自定义待办一起删了').toEqual([]);
  expect(Object.keys(st.lifts ?? {}), '力量项的历史一起删了').toEqual([]);
  expect(st.tasks['t-pu3x1'], '留下的项进度原样').toEqual(done);
  expect(st.tasks['t-pu3x2'], '留下的归档任务进度原样').toEqual({ due: '2026-03-25' });

  // 时间线：只剩 t-pu3x1 的完成记录
  await gotoTimeline(page);
  const tlIds = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#timeline [data-edittask]')).map((e) => e.getAttribute('data-edittask') ?? ''),
  );
  expect(tlIds, '时间线里的完成记录').toEqual(['t-pu3x1']);

  // 另一轮：再彻底删除留下的归档任务，然后点「放弃这次修改」并确认离开 → 计划和 state 都不变
  const planBefore = JSON.stringify(app.fake.lastPlan(0));
  const stateBefore = JSON.stringify(app.fake.lastState(0));
  await openEditor(page);
  await page.locator('#pe-archived > summary').click();
  await act(page, 'purge', 't:t-pu3x2').click();
  await readConfirm(page);
  await confirmOk(page);
  expect((await readEditor(page)).archived.present).toBe(false);
  await discardPlan(page);
  cf = await readConfirm(page);
  expect(cf.title).toBe(PE_LEAVE_TITLE);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_LEAVE_GO);
  await confirmOk(page);
  expect((await readEditor(page)).open).toBe(false);
  await gotoGoals(page);
  expect((await readArchived(page)).taskIds, '放弃之后归档任务还在').toEqual(['t-pu3x2']);
  expect(JSON.stringify(app.fake.lastPlan(0)) === planBefore, '服务器计划不变').toBe(true);
  expect(JSON.stringify(app.fake.lastState(0)) === stateBefore, '服务器 state 不变').toBe(true);
});

test('PLAN-03 an archived group carries its custom to-dos, a task archived on its own stays archived when the group is restored, and restore is disabled when the list is full (D-05, A10, A11)', async ({
  app,
  page,
}) => {
  // 19 个未归档的组；g-gaz 归档，里面 t-gazx1 单独归档、t-gazx2 已完成，自定义待办 c-ga-1 已完成；g-gby 归档
  // 第 1 组有 50 项未归档任务加 1 个归档任务 t-ga1z；力量项 8 个未归档加 1 个归档的 l-gaz
  const plan: any = syntheticPlan('ga', 19);
  plan.groups[0].tasks.push(...Array.from({ length: 48 }, (_, i) => ({ id: `t-ga1y${i + 3}`, text: `SYNTH-ga task y${i + 3}` })));
  plan.groups[0].tasks.push({ id: 't-ga1z', text: 'SYNTH-ga task z', archived: true });
  plan.groups.push({
    id: 'g-gaz',
    cat: '语言',
    name: 'SYNTH-ga group z',
    archived: true,
    tasks: [
      { id: 't-gazx1', text: 'SYNTH-ga task zx1', archived: true },
      { id: 't-gazx2', text: 'SYNTH-ga task zx2' },
    ],
  });
  plan.groups.push({ id: 'g-gby', cat: '其他', name: 'SYNTH-ga group by', archived: true, tasks: [{ id: 't-gbyx1', text: 'SYNTH-ga task by' }] });
  for (let i = 2; i <= 8; i++) plan.lifts.push({ id: `l-ga${i}`, n: `SYNTH-ga lift ${i}`, unit: 'kg', def: 10, target: 20, note: '' });
  plan.lifts.push({ id: 'l-gaz', n: 'SYNTH-ga lift z', unit: 'kg', def: 10, target: 20, note: '', archived: true });
  const done = { done: true, doneDate: '2026-03-10' };
  const seed = syntheticState('ga', {
    logs: [],
    custom: [{ id: 'c-ga-1', group: 'g-gaz', text: 'SYNTH-ga custom' }],
    tasks: { 't-gazx2': done, 'c-ga-1': done },
  });
  await app.open({ mode: 'cloud', seed, plan, login: 0 });

  await openEditor(page);
  await page.locator('#pe-archived > summary').click();
  let ed = await readEditor(page);
  // 组里单独归档的 t-gazx1 不单独列出（跟着组走）；任务和力量项满了，恢复 disabled，旁边写明
  expect(ed.archived.groups).toEqual(['g:g-gaz', 'g:g-gby']);
  expect(ed.archived.tasks).toEqual(['t:t-ga1z']);
  expect(ed.archived.lifts).toEqual(['l:l-gaz']);
  expect(ed.restoreDisabled).toEqual(['t:t-ga1z', 'l:l-gaz']);
  const lim = (key: string) => page.locator(`#pe-archived [data-row="${key}"] .pe-arch-lim`);
  await expect(lim('t:t-ga1z')).toHaveText(PE_RESTORE_LIMIT_TASKS);
  await expect(lim('l:l-gaz')).toHaveText(PE_RESTORE_LIMIT_LIFTS);
  await expect(lim('g:g-gaz')).toHaveCount(0);

  // 恢复 g-gaz：区里剩下 g-gby 和两个任务；单独归档的 t-gazx1 现在在「任务」里；组满了 20 个，g-gby 的恢复 disabled
  await act(page, 'restore', 'g:g-gaz').click();
  ed = await readEditor(page);
  expect(ed.archived.groups).toEqual(['g:g-gby']);
  expect(ed.archived.tasks).toEqual(['t:t-ga1z', 't:t-gazx1']);
  expect(ed.restoreDisabled).toEqual(['g:g-gby', 't:t-ga1z', 'l:l-gaz']);
  await expect(lim('g:g-gby')).toHaveText(PE_RESTORE_LIMIT_GROUPS);

  // 删掉一个没有进度的组（直接移除）之后 g-gby 的恢复可用；撤销移除之后又 disabled
  await expand(page, 'g:g-ga19');
  await act(page, 'delgroup', 'g:g-ga19').click();
  ed = await readEditor(page);
  expect(ed.restoreDisabled, '删掉一个组之后').toEqual(['t:t-ga1z', 'l:l-gaz']);
  await page.locator('#toast.act button').click();
  ed = await readEditor(page);
  expect(ed.groups.length, '撤销移除之后组又是 20 个').toBe(20);
  expect(ed.restoreDisabled, '撤销移除之后').toEqual(['g:g-gby', 't:t-ga1z', 'l:l-gaz']);

  // 保存：g-gaz 排到最后，没有 archived 键，t-gazx1 仍然归档，g-gby 仍然归档
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect
    .poll(() => app.fake.lastPlan(0)?.groups?.[19]?.id, { message: '等待新计划上传' })
    .toBe('g-gby');
  const saved: any = app.fake.lastPlan(0);
  const gaz = saved.groups[20];
  expect(gaz.id).toBe('g-gaz');
  expect('archived' in gaz).toBe(false);
  expect(gaz.tasks.map((t: any) => [t.id, t.archived ?? null])).toEqual([['t-gazx1', true], ['t-gazx2', null]]);
  expect(saved.groups[19].archived).toBe(true);

  // 目标页：g-gaz 是第 20 组，里面有 t-gazx2 和自定义待办 c-ga-1（都已完成），没有 t-gazx1；归档区里有 g-gby、t-gazx1、t-ga1z
  await gotoGoals(page);
  const ids = await readGroupIds(page);
  expect(ids.length).toBe(20);
  expect(ids[19]).toBe('g-gaz');
  const groups = await readGroups(page);
  expect(groups[19].code).toBe('P20');
  expect(groups[19].taskIds).toEqual(['t-gazx2', 'c-ga-1']);
  expect(groups[19].doneIds).toEqual(['t-gazx2', 'c-ga-1']);
  expect(groups[19].cnt).toBe('2/2');
  await page.locator('#goalsArch > summary').click();
  const arch = await readArchived(page);
  expect(arch.groupIds).toEqual(['g-gby']);
  expect(arch.taskIds.filter((t) => t === 't-gazx1' || t === 't-ga1z').sort()).toEqual(['t-ga1z', 't-gazx1']);
  // 恢复的组里的进度还在（保存清理没有误删）
  const st: any = app.fake.lastState(0);
  expect([st.tasks['t-gazx2'], st.tasks['c-ga-1'], (st.custom ?? []).map((c: any) => c.id)]).toEqual([done, done, ['c-ga-1']]);
});

test('PLAN-02 an emptied plan shows the empty plan card and the week hint, and the sample plan loads into the draft with new ids (D-16, A16)', async ({
  app,
  page,
}) => {
  // 1 组（2 个任务都没有进度）、1 个力量项（没有历史）
  const plan: any = syntheticPlan('em', 1);
  await app.open({ mode: 'cloud', seed: syntheticState('em'), plan, login: 0 });

  // 先删掉力量项（没有历史，直接移除）→ 保存 → 目标页力量卡里写「还没有力量项…」，组照常
  await openEditor(page);
  await expand(page, 'l:l-em1');
  await act(page, 'dellift', 'l:l-em1').click();
  expect((await readEditor(page)).lifts).toEqual([]);
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.lifts?.length, { message: '等待新计划上传' }).toBe(0);
  await expect(page.locator('#goals .group.k-fit > p.empty')).toHaveText(GOALS_NO_LIFTS);
  expect(await readGroupIds(page)).toEqual(['g-em1']);
  await expect(page.locator('#planEditBtn')).toHaveCount(1);

  // 再删掉那个组（没有进度，直接移除）：编辑页目标组分区显示「还没有目标组。」、「＋ 添加目标组」和「载入示例计划」
  await page.locator('#planEditBtn').click();
  await expand(page, 'g:g-em1');
  await act(page, 'delgroup', 'g:g-em1').click();
  expect((await readEditor(page)).groups).toEqual([]);
  await expect(page.locator('#pe-main [aria-labelledby="pe-h-groups"] > p.empty')).toHaveText(PE_GROUPS_EMPTY);
  await expect(act(page, 'addgroup')).toHaveText(BTN_ADD_GROUP);
  await expect(act(page, 'sample')).toHaveText(BTN_LOAD_SAMPLE);
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 服务器计划 groups 和 lifts 都是 []；目标页是「计划是空的」卡片
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.length, { message: '等待新计划上传' }).toBe(0);
  expect(app.fake.lastPlan(0).lifts).toEqual([]);
  await expect(page.locator('#goals .pe-empty h3')).toHaveText(PE_EMPTY_TITLE);
  await expect(page.locator('#goals .pe-empty p')).toHaveText(PE_EMPTY_BODY);
  await expect(page.locator('#planEditBtn')).toHaveCount(0);
  await expect(page.locator('#planEditBtn2')).toHaveText(BTN_PLAN_EDIT);
  await expect(page.locator('#planEditBtn2')).toHaveClass(/primary/);
  await expect(page.locator('#planSampleBtn')).toHaveText(BTN_LOAD_SAMPLE);
  expect(await readGroupIds(page)).toEqual([]);

  // 本周页：说明可见，记一笔照常
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await expect(page.locator('#wkEmpty')).toBeVisible();
  await expect(page.locator('#wkEmpty')).toHaveText(WEEK_EMPTY_PLAN);
  const wk = composer(page, 'w');
  await wk.pickCategory('语言');
  await wk.type('SYNTH-em new log');
  await wk.submit();
  await expect.poll(() => app.fake.lastState(0)?.logs?.length, { message: '等待新记录上传' }).toBe(2);

  // 刷新：仍是空计划（没有换成示例计划），服务器计划仍是空的
  await app.reload();
  await gotoGoals(page);
  await expect(page.locator('#goals .pe-empty')).toHaveCount(1);
  expect(await readGroupIds(page)).toEqual([]);
  expect([app.fake.lastPlan(0).groups, app.fake.lastPlan(0).lifts]).toEqual([[], []]);

  // 载入示例计划：编辑页打开，草稿马上有未保存的修改，toast 说明；组数、每组任务数、力量项个数对得上，id 全新；预设和健身目标不动
  await page.locator('#planSampleBtn').click();
  await expect(page.locator('#tab-plan')).toBeVisible();
  await expectToast(page, TOAST_SAMPLE_LOADED);
  const ed = await readEditor(page);
  expect(ed.hint).toBe(PE_HINT_DIRTY);
  expect(ed.groups.length).toBe(Object.keys(BUILTIN_GROUP_SIZES).length);
  expect(ed.groups.map((g) => g.taskKeys.length)).toEqual(Object.values(BUILTIN_GROUP_SIZES));
  expect(ed.groups.every((g) => /^g:g-[A-Za-z0-9_-]+$/.test(g.key))).toBe(true);
  expect(ed.groups.every((g) => g.taskKeys.every((k) => /^t:t-[A-Za-z0-9_-]+$/.test(k)))).toBe(true);
  expect(ed.lifts.length).toBe(4);
  expect(ed.lifts.every((l) => /^l:l-[A-Za-z0-9_-]+$/.test(l.key))).toBe(true);
  expect(ed.fit, '健身目标不动').toEqual({ min: '1', max: '3' });
  expect(ed.archived.present).toBe(false);
  // 载入之后「载入示例计划」按钮不再出现
  await expect(act(page, 'sample')).toHaveCount(0);

  // 保存：服务器计划的 id 都是新的，预设和健身说明与原来相同；目标页编号 P1 到 P7，本周页说明隐藏
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.length, { message: '等待新计划上传' }).toBe(7);
  const saved: any = app.fake.lastPlan(0);
  expect(saved.groups.every((g: any) => /^g-/.test(g.id) && g.tasks.every((t: any) => /^t-/.test(t.id)))).toBe(true);
  expect(saved.lifts.map((l: any) => l.id).every((id: string) => /^l-/.test(id))).toBe(true);
  expect(saved.lifts.length).toBe(4);
  expect(JSON.stringify(saved.presets) === JSON.stringify(plan.presets), '预设标签不动').toBe(true);
  expect(saved.fitGoal).toEqual(plan.fitGoal);
  expect(saved.fitNote === plan.fitNote, '健身说明不动').toBe(true);
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await expect(page.locator('#wkEmpty')).toBeHidden();
});
