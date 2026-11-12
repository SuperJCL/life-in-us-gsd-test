// Phase 12-03 的云端用例（PLAN-04，编辑计划页的骨架、离开的规矩和与同步的配合）：只在 npm run test:cloud 里运行，只用合成账号和合成数据（计划文字都以 SYNTH- 开头）。
// 第二台设备是 openDevice 的独立浏览器上下文，共用同一个假服务器；失败消息只写 id、计数、布尔和界面文案，不回显计划文字。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { openDevice } from '../support/devices';
import { gotoGoals } from '../support/goals';
import { discardPlan, expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { expectToast } from '../support/toast';
import { FROZEN_NOW } from '../support/constants';
import {
  BANNER_EXPIRED,
  BTN_PE_LEAVE_GO,
  BTN_PE_LEAVE_STAY,
  BTN_PE_RELOGIN_GO,
  BTN_PE_RELOGIN_STAY,
  BTN_RELOGIN,
  CONFIRM_LOGOUT_ACCOUNT_PREFIX,
  CONFIRM_LOGOUT_UNSAVED,
  LOGOUT_LINE_PLAN,
  PE_HINT_DIRTY,
  PE_HINT_NONE,
  PE_LEAVE_BODY,
  PE_LEAVE_TITLE,
  PE_RELOGIN_BODY,
  PE_RELOGIN_TITLE,
  TAB_LABELS,
  TOAST_PLAN_SAVED,
} from '../support/strings';

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

test('PLAN-04 leaving the plan editor with unsaved changes asks first from a tab, the back button and the discard button, and leaves at once without changes (D-09, A7)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pe', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('pe'), plan, login: 0 });
  const renamed = 'SYNTH-pe leave draft';
  const dialog = page.locator('dialog#confirm');
  const tab = (k: keyof typeof TAB_LABELS) => page.getByRole('tab', { name: TAB_LABELS[k], exact: true });

  // 没有修改：点「本周」标签直接离开，没有确认框
  await openEditor(page);
  await tab('wk').click();
  await expect(page.locator('#tab-wk')).toBeVisible();
  await expect(dialog).toHaveJSProperty('open', false);
  expect((await readEditor(page)).open).toBe(false);
  expect((await readEditor(page)).hash).toBe('');

  // 没有修改：「放弃这次修改」也直接离开
  await openEditor(page);
  await discardPlan(page);
  await expect(dialog).toHaveJSProperty('open', false);
  expect((await readEditor(page)).open).toBe(false);

  // 有修改：点标签 -> 确认框，「继续编辑」留在编辑页、hash 还是 #plan、输入框里还是改过的名字
  await openEditor(page);
  await expand(page, 'g:g-pe1');
  await field(page, 'g:g-pe1:name').fill(renamed);
  await tab('wk').click();
  let c = await readConfirm(page);
  expect([c.title, c.lines]).toEqual([PE_LEAVE_TITLE, [PE_LEAVE_BODY]]);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_PE_LEAVE_STAY);
  await expect(page.locator('#cfOk')).toHaveText(BTN_PE_LEAVE_GO);
  await expect(page.locator('#cfCancel')).toBeFocused();
  await confirmCancel(page);
  let ed = await readEditor(page);
  expect([ed.open, ed.hash, ed.hint]).toEqual([true, '#plan', PE_HINT_DIRTY]);
  expect(await field(page, 'g:g-pe1:name').inputValue()).toBe(renamed);

  // 返回键：同一个确认框；「继续编辑」把地址栏恢复为 #plan，仍在编辑页
  await page.goBack();
  c = await readConfirm(page);
  expect(c.title).toBe(PE_LEAVE_TITLE);
  await confirmCancel(page);
  ed = await readEditor(page);
  expect([ed.open, ed.hash]).toEqual([true, '#plan']);
  expect(await field(page, 'g:g-pe1:name').inputValue()).toBe(renamed);

  // 「放弃这次修改」：确认框 -> 「放弃修改」回到目标页，服务器计划不变，目标页显示原名
  await discardPlan(page);
  c = await readConfirm(page);
  expect(c.title).toBe(PE_LEAVE_TITLE);
  await confirmOk(page);
  ed = await readEditor(page);
  expect([ed.open, ed.hash]).toEqual([false, '']);
  await expect(page.locator('#tab-goal')).toBeVisible();
  expect(await goalsHave(page, renamed)).toBe(false);
  expect(await goalsHave(page, plan.groups[0].name)).toBe(true);
  expect(idsOf(app.fake.lastPlan(0))).toEqual(idsOf(plan));
  expect(app.fake.lastPlan(0).groups[0].name).toBe(plan.groups[0].name);
});

test('PLAN-04 closing the page with unsaved plan changes raises the browser leave prompt (D-09)', async ({ app, browser, guard }) => {
  const plan: any = syntheticPlan('pe', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('pe'), plan, login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    const sp = second.page;
    await second.app.open({ mode: 'cloud', login: 0 });
    const dialogs: string[] = [];
    sp.on('dialog', (d) => {
      dialogs.push(d.type());
      void d.dismiss();
    });

    // 有修改：关闭页面触发 beforeunload 对话框，dismiss 之后页面仍然开着
    await openEditor(sp);
    await expand(sp, 'g:g-pe1');
    await field(sp, 'g:g-pe1:name').fill('SYNTH-pe closing draft');
    await sp.close({ runBeforeUnload: true });
    await expect.poll(() => dialogs, { message: '等待 beforeunload 对话框' }).toEqual(['beforeunload']);
    expect(sp.isClosed()).toBe(false);

    // 放弃修改之后再关闭：不出对话框，页面关掉
    await discardPlan(sp);
    await confirmOk(sp);
    expect((await readEditor(sp)).open).toBe(false);
    await sp.close({ runBeforeUnload: true });
    await expect.poll(() => sp.isClosed(), { message: '等待页面关闭' }).toBe(true);
    expect(dialogs).toEqual(['beforeunload']);
  } finally {
    await second.context.close();
  }
});

test.describe('manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('PLAN-04 logout and re-login from the plan editor with unsaved changes ask first (D-09, D-12)', async ({ app, page, guard }) => {
    const plan: any = syntheticPlan('pe', 2);
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('pe'), plan, login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const userA = app.fake.users[0];
    const renamed = 'SYNTH-pe relogin draft';
    const dialog = page.locator('dialog#confirm');

    await openEditor(page);
    await expand(page, 'g:g-pe1');
    await field(page, 'g:g-pe1:name').fill(renamed);

    // 退出登录：确认框里有编辑计划页的那一行，「不退出」之后仍在编辑页、修改还在
    await page.locator('#logoutBtn').click();
    let c = await readConfirm(page);
    expect(c.lines[0]).toBe(`${CONFIRM_LOGOUT_ACCOUNT_PREFIX}${userA.email}`);
    expect(c.lines).toContain(LOGOUT_LINE_PLAN);
    expect(c.lines).not.toContain(CONFIRM_LOGOUT_UNSAVED);
    await confirmCancel(page);
    let ed = await readEditor(page);
    expect([ed.open, ed.hash, ed.hint]).toEqual([true, '#plan', PE_HINT_DIRTY]);
    expect(await field(page, 'g:g-pe1:name').inputValue()).toBe(renamed);

    // 登录过期：推进一个轮询周期，后台同步发现令牌失效，出现过期横幅；点「重新登录」先问
    app.fake.revokeTokens(0);
    await page.clock.runFor(60_000);
    const bar = page.locator('#syncbar');
    await expect(bar.locator('.sb-msg')).toHaveText(BANNER_EXPIRED);
    await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });
    await bar.locator('button', { hasText: BTN_RELOGIN }).click();
    c = await readConfirm(page);
    expect([c.title, c.lines]).toEqual([PE_RELOGIN_TITLE, [PE_RELOGIN_BODY]]);
    await expect(page.locator('#cfCancel')).toHaveText(BTN_PE_RELOGIN_STAY);
    await expect(page.locator('#cfOk')).toHaveText(BTN_PE_RELOGIN_GO);

    // 「先不登录」：草稿原样留在页面上，没有去登录页
    await confirmCancel(page);
    await expect(page.locator('#login')).toBeHidden();
    ed = await readEditor(page);
    expect([ed.open, ed.hash, ed.hint]).toEqual([true, '#plan', PE_HINT_DIRTY]);
    expect(await field(page, 'g:g-pe1:name').inputValue()).toBe(renamed);

    // 「仍然重新登录」：到登录页，hash 不再是 #plan
    await bar.locator('button', { hasText: BTN_RELOGIN }).click();
    await readConfirm(page);
    await confirmOk(page);
    await expect(page.locator('#login')).toBeVisible();
    await expect(dialog).toHaveJSProperty('open', false);
    expect(await page.evaluate(() => location.hash)).toBe('');
  });
});
