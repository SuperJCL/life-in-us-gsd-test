// Phase 12-06 的云端用例（PLAN-03、PLAN-02，编辑计划页底部的「已归档」区、彻底删除、空计划）：只在 npm run test:cloud 里运行，只用合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字；计划文字都带 `SYNTH-<label>`，示例计划只比较 id 前缀、组数和任务数。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readGroups } from '../support/goals';
import { gotoCalendar, readMonth } from '../support/calendar';
import { act, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import {
  BTN_PURGE,
  BTN_RESTORE,
  PE_ARCH_TASKS,
  TOAST_PLAN_SAVED,
  archiveDueOn,
  archivedSummary,
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
