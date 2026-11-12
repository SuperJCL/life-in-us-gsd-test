// Phase 12-07 的云端用例（PLAN-04，编辑页与同步的配合）：只在 npm run test:cloud 里运行，只用合成账号和合成数据（计划文字都以 SYNTH- 开头）。
// 另一个写入方（另一台设备）用 app.fake.request 直接改服务器上的文档，writer 是合成值；假服务器会把事件推给页面的实时连接。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字（合成值除外）。
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { downloadOf } from '../support/download';
import { confirmCancel, confirmMid, confirmOk, readConfirm } from '../support/confirm';
import { act, expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_PLAN } from '../support/constants';
import {
  BANNER_REMOTE_PE,
  BTN_DOWNLOAD_SNAPSHOT,
  BTN_PE_ARCHIVE_ALL,
  BTN_PE_BACK,
  BTN_PE_DELETE_ALL,
  BTN_PE_OVERWRITE,
  BTN_PE_TAKE_THEIRS,
  PE_CONFLICT_LINES,
  PE_CONFLICT_TITLE,
  PE_D08_INTRO,
  PE_D08_QUESTION,
  PE_D08_TITLE,
  PE_HINT_DIRTY,
  PE_HINT_NONE,
  PE_HINT_REMOTE,
  PE_NOTICE,
  TOAST_PLAN_SAVED,
  TOAST_PLAN_SAVED_KEPT,
  TOAST_PLAN_TAKEN,
  peD08Lift,
  peD08More,
  peD08Task,
} from '../support/strings';

test.use({ acceptDownloads: true });

const LIST_PATH = '/api/collections/journey_docs/records';

// 另一个写入方保存了服务器上的计划：mutate 改一份深拷贝，返回写入的内容
async function otherWriterSavesPlan(app: { fake: any }, mutate: (plan: any) => void) {
  const data = app.fake.lastPlan(0);
  mutate(data);
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'plan')}`, { data, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
  return data;
}

// 页面的计划缓存记录：{ base, dirty, data, ... }
const planCache = (page: Page, userId: string) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, `usj:v2:${userId}:plan`);

// 本机留底记录：{ kind, data, told }
const snapshotOf = (page: Page, userId: string) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, `usj:v2:${userId}:snapshot`);

const goalsHave = (page: Page, text: string) =>
  page.evaluate((t) => (document.querySelector('#goals')?.textContent ?? '').includes(t), text);

// 页面拿到了新的计划版本：计划缓存的 base 不再是 before（缓存写入之后同一个任务里横幅、提示行都已更新）
async function waitPlanVersion(page: Page, userId: string, before: string) {
  await expect
    .poll(async () => (await planCache(page, userId))?.base ?? before, { message: '等待页面拿到新的计划版本' })
    .not.toBe(before);
}

test('PLAN-04 a plan saved on another device while the editor is open leaves the draft unchanged, shows the notice and asks on save (D-07)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('cs', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('cs'), plan, login: 0 });
  const userId = app.fake.users[0].id;
  const notice = page.locator('#pe-notice');
  const mine = 'SYNTH-cs mine';

  // 内容相同不算改过：打开编辑页、本机不改，另一个写入方保存了一份内容完全相同的计划 → 页面拿到新版本，没有提示
  await openEditor(page);
  const base0 = (await planCache(page, userId)).base as string;
  await otherWriterSavesPlan(app, () => {});
  await waitPlanVersion(page, userId, base0);
  await expect(notice).toBeHidden();
  let ed = await readEditor(page);
  expect([ed.open, ed.hint, ed.tone]).toEqual([true, PE_HINT_NONE, null]);

  // 本机改第 1 组的名称
  await expand(page, 'g:g-cs1');
  await field(page, 'g:g-cs1:name').fill(mine);
  expect((await readEditor(page)).hint).toBe(PE_HINT_DIRTY);

  // 另一个写入方把第 2 组改名：页面拿到新版本之后，草稿不动，提示行和 #pe-notice 告知，全局横幅是没有按钮的变体
  const base1 = (await planCache(page, userId)).base as string;
  await otherWriterSavesPlan(app, (p) => {
    p.groups[1].name = 'SYNTH-cs theirs';
  });
  await expect(notice).toBeVisible();
  await expect(notice).toHaveAttribute('data-tone', 'warn');
  await expect(notice.locator('.sb-msg')).toHaveText(PE_NOTICE);
  await expect(notice.locator('button')).toHaveCount(0);
  expect((await planCache(page, userId)).base).not.toBe(base1);
  expect(await field(page, 'g:g-cs1:name').inputValue()).toBe(mine);
  ed = await readEditor(page);
  expect([ed.open, ed.hint, ed.tone]).toEqual([true, PE_HINT_REMOTE, 'warn']);
  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute('data-tone', 'info');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_REMOTE_PE);
  await expect(bar.locator('button')).toHaveCount(0);

  // 点保存：三选一。标题、4 段正文、三个按钮的顺序和样式、默认焦点在「回去继续改」
  await savePlan(page);
  const c = await readConfirm(page);
  expect(c.title).toBe(PE_CONFLICT_TITLE);
  expect(c.lines).toEqual(PE_CONFLICT_LINES);
  expect(c.buttons).toEqual([
    { id: 'cfCancel', text: BTN_PE_BACK, cls: 'ghost' },
    { id: 'cfMid', text: BTN_PE_TAKE_THEIRS, cls: 'danger' },
    { id: 'cfOk', text: BTN_PE_OVERWRITE, cls: 'danger' },
  ]);
  expect(c.focused).toBe('cfCancel');

  // 回去继续改：仍在编辑页，草稿不变，提示照旧，服务器上的计划仍是对方的版本
  await confirmCancel(page);
  ed = await readEditor(page);
  expect([ed.open, ed.hint]).toEqual([true, PE_HINT_REMOTE]);
  expect(await field(page, 'g:g-cs1:name').inputValue()).toBe(mine);
  await expect(notice).toBeVisible();
  expect(app.fake.lastPlan(0).groups[0].name).toBe('SYNTH-cs group 1');
  expect(app.fake.lastPlan(0).groups[1].name).toBe('SYNTH-cs theirs');
});

test("PLAN-04 overwriting the other device's plan keeps it here as a downloadable plan kept copy, and taking the new version discards the draft (D-07, A14)", async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('cs', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('cs'), plan, login: 0 });
  const userId = app.fake.users[0].id;
  const notice = page.locator('#pe-notice');
  const planWrites = () => (app.fake.writes as Array<{ path: string }>).filter((w) => w.path === 'journey_docs:plan').length;

  // 用我的覆盖：改第 1 组，对方改第 2 组，页面拿到新版本后点保存 → 用我的覆盖
  await openEditor(page);
  await expand(page, 'g:g-cs1');
  await field(page, 'g:g-cs1:name').fill('SYNTH-cs mine');
  await otherWriterSavesPlan(app, (p) => {
    p.groups[1].name = 'SYNTH-cs theirs';
  });
  await expect(notice).toBeVisible();
  await savePlan(page);
  await readConfirm(page);
  await confirmOk(page);

  // 回到目标页，toast 说已留底并带「下载留底」；服务器计划整份以本机为准
  await expectToast(page, TOAST_PLAN_SAVED_KEPT);
  await expect(page.locator('#toast button')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
  expect((await readEditor(page)).open).toBe(false);
  await expect.poll(() => app.fake.lastPlan(0)?.groups?.[0]?.name, { message: '等待本机的计划上传' }).toBe('SYNTH-cs mine');
  expect(app.fake.lastPlan(0).groups[1].name).toBe('SYNTH-cs group 2');

  // 本机留底：计划类型，里面是对方的版本，已告知
  const kept = await snapshotOf(page, userId);
  expect(kept?.kind).toBe('plan');
  expect(kept?.told).toBe(true);
  expect(kept?.data?.groups?.[0]?.name).toBe('SYNTH-cs group 1');
  expect(kept?.data?.groups?.[1]?.name).toBe('SYNTH-cs theirs');

  // 点「下载留底」：只含计划的备份包装，计划是对方的版本；之后 #snapshotBtn 隐藏
  const file = await downloadOf(page, () => page.locator('#toast button').click());
  const body = JSON.parse(file.text);
  expect([body.app, body.format, body.kind]).toEqual([BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_PLAN]);
  expect('state' in body).toBe(false);
  expect(body.plan.groups[1].name).toBe('SYNTH-cs theirs');
  expect(body.plan.groups[0].name).toBe('SYNTH-cs group 1');
  await expect(page.locator('#snapshotBtn')).toBeHidden();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');

  // 放弃我的修改，用新版：再进编辑页改名，对方又改了计划，点保存 → 放弃我的修改，用新版
  await openEditor(page);
  await expand(page, 'g:g-cs1');
  await field(page, 'g:g-cs1:name').fill('SYNTH-cs mine again');
  const theirs = await otherWriterSavesPlan(app, (p) => {
    p.groups[1].name = 'SYNTH-cs theirs again';
  });
  await expect(notice).toBeVisible();
  const before = planWrites();
  await savePlan(page);
  await readConfirm(page);
  await confirmMid(page);

  // 回到目标页，toast 说已改用新计划，目标页显示对方的名称、没有本机的草稿名称
  await expectToast(page, TOAST_PLAN_TAKEN);
  expect((await readEditor(page)).open).toBe(false);
  await expect(page.locator('#tab-goal')).toBeVisible();
  expect(await goalsHave(page, 'SYNTH-cs theirs again')).toBe(true);
  expect(await goalsHave(page, 'SYNTH-cs mine again')).toBe(false);

  // 这台设备没有上传计划：服务器计划等于对方写入的版本，也没有新的留底
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  expect(planWrites()).toBe(before);
  expect(app.fake.lastPlan(0)).toEqual(theirs);
  expect(await snapshotOf(page, userId)).toBeNull();
});

// 另一个写入方保存了服务器上的 state：mutate 改一份深拷贝
async function otherWriterSavesState(app: { fake: any }, mutate: (state: any) => void) {
  const data = app.fake.lastState(0);
  mutate(data);
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'state')}`, { data, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
}

test('PLAN-04 items removed in the draft that gained progress on another device are listed before saving and can be archived or deleted with their progress (D-08)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('d8', 6);
  plan.lifts.push({ id: 'l-d82', n: 'SYNTH-d8 lift 2', unit: 'kg', def: 10, target: 20, note: '' });
  await app.open({ mode: 'cloud', seed: syntheticState('d8', { lifts: { 'l-d82': { cur: 10, hist: [] } } }), plan, login: 0 });
  const bar = page.locator('#syncbar');
  const dlg = page.locator('dialog#confirm');
  const remoteBar = async () => {
    await expect(bar).toBeVisible();
    await expect(bar.locator('.sb-msg')).toHaveText(BANNER_REMOTE_PE);
  };
  const planTasks = () => (app.fake.lastPlan(0).groups as any[]).flatMap((g) => g.tasks as any[]);

  // 第一轮：直接移除一个任务和一个力量项，别的设备上它们刚有了进度（任务完成、力量项 1 条历史）
  await openEditor(page);
  await expand(page, 'g:g-d81');
  await act(page, 'del', 't:t-d81x2').click();
  await expand(page, 'l:l-d82');
  await act(page, 'dellift', 'l:l-d82').click();
  await otherWriterSavesState(app, (st) => {
    st.tasks = { ...(st.tasks ?? {}), 't-d81x2': { done: true, doneDate: '2026-03-17' } };
    st.lifts = { ...(st.lifts ?? {}), 'l-d82': { cur: 12, hist: [{ date: '2026-03-16', v: 12 }] } };
  });
  await remoteBar();

  // 点保存：D-08 询问框，一个框列出两项，三个按钮
  await savePlan(page);
  let c = await readConfirm(page);
  expect(c.title).toBe(PE_D08_TITLE);
  expect(c.lines).toEqual([
    PE_D08_INTRO,
    peD08Task('SYNTH-d8 task 1.2', true),
    peD08Lift('SYNTH-d8 lift 2', 1),
    PE_D08_QUESTION,
  ]);
  expect(c.buttons).toEqual([
    { id: 'cfCancel', text: BTN_PE_BACK, cls: 'ghost' },
    { id: 'cfMid', text: BTN_PE_ARCHIVE_ALL, cls: 'primary' },
    { id: 'cfOk', text: BTN_PE_DELETE_ALL, cls: 'danger' },
  ]);
  expect(c.focused).toBe('cfCancel');

  // 全部归档：回到目标页，服务器计划里两项都在且 archived，进度还在
  await confirmMid(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  expect((await readEditor(page)).open).toBe(false);
  await expect
    .poll(() => planTasks().find((t) => t.id === 't-d81x2')?.archived, { message: '等待新计划上传' })
    .toBe(true);
  expect((app.fake.lastPlan(0).lifts as any[]).find((l) => l.id === 'l-d82')?.archived).toBe(true);
  expect(app.fake.lastState(0).tasks['t-d81x2'].done).toBe(true);
  await expect.poll(() => app.fake.lastState(0).lifts?.['l-d82']?.hist?.length, { message: '等待进度上传' }).toBe(1);

  // 第二轮：直接移除 t-d82x1，别的设备给它设了截止日期；连进度一起删
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await openEditor(page);
  await expand(page, 'g:g-d82');
  await act(page, 'del', 't:t-d82x1').click();
  await otherWriterSavesState(app, (st) => {
    st.tasks = { ...(st.tasks ?? {}), 't-d82x1': { due: '2026-03-25' } };
  });
  await remoteBar();
  await savePlan(page);
  c = await readConfirm(page);
  expect(c.lines).toEqual([PE_D08_INTRO, peD08Task('SYNTH-d8 task 2.1', false), PE_D08_QUESTION]);
  await confirmOk(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => planTasks().some((t) => t.id === 't-d82x1'), { message: '等待新计划上传' }).toBe(false);
  await expect
    .poll(() => Object.prototype.hasOwnProperty.call(app.fake.lastState(0).tasks ?? {}, 't-d82x1'), { message: '等待进度被删' })
    .toBe(false);

  // 没有这种项：直接移除一个仍然没有进度的任务，保存时不弹 D-08 对话框
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await openEditor(page);
  await expand(page, 'g:g-d82');
  await act(page, 'del', 't:t-d82x2').click();
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect(dlg).toHaveJSProperty('open', false);
  expect((await readEditor(page)).open).toBe(false);
  await expect.poll(() => planTasks().some((t) => t.id === 't-d82x2'), { message: '等待新计划上传' }).toBe(false);

  // 9 项：8 段加「还有 1 项」，两个确认按钮对全部项生效；这里回去继续改，什么都不保存
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await openEditor(page);
  const nine = ['t-d81x1', 't-d83x1', 't-d83x2', 't-d84x1', 't-d84x2', 't-d85x1', 't-d85x2', 't-d86x1', 't-d86x2'];
  for (const g of ['g-d81', 'g-d83', 'g-d84', 'g-d85', 'g-d86']) await expand(page, `g:${g}`);
  for (const t of nine) await act(page, 'del', `t:${t}`).click();
  await otherWriterSavesState(app, (st) => {
    const tasks: Record<string, unknown> = { ...(st.tasks ?? {}) };
    for (const t of nine) tasks[t] = { done: true, doneDate: '2026-03-17' };
    st.tasks = tasks;
  });
  await remoteBar();
  await savePlan(page);
  c = await readConfirm(page);
  expect(c.lines.length).toBe(11);
  expect(c.lines[0]).toBe(PE_D08_INTRO);
  expect(c.lines.slice(1, 9).every((l) => l.startsWith('任务「') && l.endsWith('（已完成）'))).toBe(true);
  expect(c.lines[9]).toBe(peD08More(1));
  expect(c.lines[10]).toBe(PE_D08_QUESTION);
  await confirmCancel(page);
  const ed = await readEditor(page);
  expect([ed.open, ed.hint, ed.saveDisabled, ed.saveBusy]).toEqual([true, PE_HINT_DIRTY, false, false]);
  expect(planTasks().filter((t) => nine.includes(t.id)).length).toBe(nine.length);
});
