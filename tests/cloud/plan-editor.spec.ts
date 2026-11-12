// Phase 12-03 的云端用例（PLAN-04，编辑计划页的骨架、离开的规矩和与同步的配合）：只在 npm run test:cloud 里运行，只用合成账号和合成数据（计划文字都以 SYNTH- 开头）。
// 第二台设备是 openDevice 的独立浏览器上下文，共用同一个假服务器；失败消息只写 id、计数、布尔和界面文案，不回显计划文字。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { openDevice } from '../support/devices';
import { gotoGoals } from '../support/goals';
import { expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { PE_HINT_DIRTY, PE_HINT_NONE, TOAST_PLAN_SAVED } from '../support/strings';

// 计划里每个组和它的任务的 id 列表（只比较 id，不涉及计划文字）
const idsOf = (plan: any) => plan.groups.map((g: any) => [g.id, g.tasks.map((t: any) => t.id)]);

// 目标页上是否出现某段文字：只读回布尔，失败输出里不带页面文字
const goalsHave = (page: import('@playwright/test').Page, text: string) =>
  page.evaluate((t) => (document.querySelector('#goals')?.textContent ?? '').includes(t), text);

test('PLAN-04 a group renamed in the plan editor is saved to the server and another device shows the new name (D-10)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const plan: any = syntheticPlan('pe', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('pe'), plan, login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    const before = idsOf(app.fake.lastPlan(0));
    const renamed = 'SYNTH-pe renamed';

    // 入口：目标页的「编辑计划」。进入后地址是 #plan，四个标签都没选中，四个视图都隐藏，导航仍在，焦点在页面标题
    await openEditor(page);
    let ed = await readEditor(page);
    expect(ed.open).toBe(true);
    expect(ed.hash).toBe('#plan');
    await expect(page.locator('nav.tabs [data-tab][aria-selected="true"]')).toHaveCount(0);
    for (const k of ['wk', 'cal', 'goal', 'tl']) await expect(page.locator(`#tab-${k}`)).toBeHidden();
    await expect(page.locator('nav.tabs')).toBeVisible();
    await expect(page.locator('header')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('pe-title');

    // 没有修改：提示行「还没有修改」，保存按钮不可用，默认全部折叠
    expect(ed.hint).toBe(PE_HINT_NONE);
    expect(ed.saveDisabled).toBe(true);
    expect(ed.groups.map((g) => [g.key, g.no, g.expanded])).toEqual([
      ['g:g-pe1', 'P1', false],
      ['g:g-pe2', 'P2', false],
    ]);

    // 展开第 1 组：展开不算修改；改名之后有修改，改回原名又没有修改，再改成新名
    await expand(page, 'g:g-pe1');
    expect((await readEditor(page)).hint).toBe(PE_HINT_NONE);
    const name = field(page, 'g:g-pe1:name');
    await name.fill(renamed);
    ed = await readEditor(page);
    expect([ed.hint, ed.tone, ed.saveDisabled]).toEqual([PE_HINT_DIRTY, 'muted', false]);
    await name.fill(plan.groups[0].name);
    ed = await readEditor(page);
    expect([ed.hint, ed.tone, ed.saveDisabled]).toEqual([PE_HINT_NONE, null, true]);
    await name.fill(renamed);
    expect((await readEditor(page)).hint).toBe(PE_HINT_DIRTY);

    // 保存：直接生效，回到目标页，toast「计划已保存」，焦点在入口按钮，目标页显示新名称
    await savePlan(page);
    await expectToast(page, TOAST_PLAN_SAVED);
    ed = await readEditor(page);
    expect(ed.open).toBe(false);
    expect(ed.hash).toBe('');
    await expect(page.locator('#planEditBtn')).toBeFocused();
    await expect(page.locator('#tab-goal')).toBeVisible();
    expect(await goalsHave(page, renamed)).toBe(true);

    // 服务器上的计划：第 1 组是新名称，组和任务的 id 列表和打开前相同
    await expect.poll(() => app.fake.lastPlan(0)?.groups?.[0]?.name === renamed, { message: '等待新计划上传' }).toBe(true);
    expect(idsOf(app.fake.lastPlan(0))).toEqual(before);

    // 另一台设备（同一账号）随后按新名称显示
    await expect.poll(() => goalsHave(second.page, renamed), { message: '等待设备二显示新名称' }).toBe(true);
    await gotoGoals(second.page);
    expect(await second.page.evaluate(() => !!document.querySelector('#planEditBtn'))).toBe(true);
  } finally {
    await second.context.close();
  }
});
