// Phase 12-01 的云端用例（PLAN-03）：只在 npm run test:cloud 里运行，只用合成账号和合成数据（文字都以 SYNTH- 开头）。
// 服务器上的计划带归档的组和任务：目标页主列表不显示它们、组编号按顺序生成，底部「已归档」区灰色只读地列出它们。
// 页面只读计划，不写计划；失败消息只写 id、计数和布尔，不回显计划文字。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { gotoGoals, readArchived, readGroups } from '../support/goals';
import {
  ARCHIVE_STATUS_OPEN,
  ARCHIVED_MARK,
  archiveDoneOn,
  archiveDueOn,
  archivedSummary,
} from '../support/strings';

test('PLAN-03 a plan with an archived group from the server hides it from the goals list, numbers the other groups in order and shows it greyed in the archived area (D-03, D-06, D-14)', async ({
  app,
  page,
}) => {
  // 第 2 组归档；第 1 组的第 2 个任务单独归档。第 2 组的第 1 个任务已完成，第 1 组被归档的任务设了截止日期，第 2 组有一条自定义待办
  const plan: any = syntheticPlan('av', 3);
  plan.groups[1].archived = true;
  plan.groups[0].tasks[1].archived = true;
  const seed = syntheticState('av', {
    tasks: { 't-av2x1': { done: true, doneDate: '2026-03-16' }, 't-av1x2': { due: '2026-03-20' } },
    custom: [{ id: 'c-av1', group: 'g-av2', text: 'SYNTH-av custom' }],
  });
  await app.open({ mode: 'cloud', seed, plan, login: 0 });
  await gotoGoals(page);

  // 主列表：只有第 1、3 组，编号读回 P1、P2；第 1 组只列第 1 个任务，完成数只数它
  const groups = await readGroups(page);
  expect(groups.map((g) => g.code)).toEqual(['P1', 'P2']);
  expect(groups.map((g) => g.taskIds)).toEqual([['t-av1x1'], ['t-av3x1', 't-av3x2']]);
  expect(groups.map((g) => g.cnt)).toEqual(['0/1', '0/2']);

  // 「已归档（2）」：默认折叠；展开后有第 2 组（两个任务和那条自定义待办）和单独归档的那个任务，区内没有 input 和按钮
  let arch = await readArchived(page);
  expect(arch.present).toBe(true);
  expect(arch.summary).toBe(archivedSummary(2));
  expect(arch.open, '「已归档」区默认应当折叠').toBe(false);
  await page.locator('#goalsArch > summary').click();
  arch = await readArchived(page);
  expect(arch.open).toBe(true);
  expect(arch.groupIds).toEqual(['g-av2']);
  expect(arch.taskIds).toEqual(['t-av2x1', 't-av2x2', 'c-av1', 't-av1x2']);
  expect(arch.liftIds).toEqual([]);
  expect(arch.orphanIds, '归档区里不应有删除按钮').toEqual([]);
  expect(arch.inputs, '归档区里不应有输入控件').toBe(0);
  expect(arch.buttons, '归档区里不应有按钮').toBe(0);
  await expect(page.locator('#goalsArch [data-arch^="g:"] .arch-mark')).toHaveText(ARCHIVED_MARK);

  // 每行的状态：已完成于日期、截止日期、未完成（状态是界面文案，不含计划文字）
  const meta = (id: string) => page.locator(`#goalsArch [data-arch="t:${id}"] .meta`);
  await expect(meta('t-av2x1')).toHaveText(archiveDoneOn('3月16日'));
  await expect(meta('t-av1x2')).toHaveText(archiveDueOn('3月20日'));
  await expect(meta('t-av2x2')).toHaveText(ARCHIVE_STATUS_OPEN);
  await expect(meta('c-av1')).toHaveText(ARCHIVE_STATUS_OPEN);

  // 重画之后展开的状态保留（勾选主列表里的任务会重画目标页）
  await page.locator('#goals [data-task="t-av1x1"]').check();
  expect((await readArchived(page)).open, '重画之后「已归档」区应当仍然展开').toBe(true);

  // 应用只读计划：服务器上的计划文档没有被改写（等记录的保存到了服务器再比较）
  await expect.poll(() => app.fake.lastState(0)?.tasks?.['t-av1x1']?.done).toBe(true);
  const stored = app.fake.lastPlan(0);
  expect(stored.groups.map((g: any) => [g.id, g.archived ?? null])).toEqual(plan.groups.map((g: any) => [g.id, g.archived ?? null]));
  expect(stored.groups[0].tasks.map((t: any) => [t.id, t.archived ?? null])).toEqual(
    plan.groups[0].tasks.map((t: any) => [t.id, t.archived ?? null]),
  );
});
