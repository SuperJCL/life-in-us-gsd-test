// Phase 12-07 的云端用例（PLAN-04，编辑页与同步的配合）：只在 npm run test:cloud 里运行，只用合成账号和合成数据（计划文字都以 SYNTH- 开头）。
// 另一个写入方（另一台设备）用 app.fake.request 直接改服务器上的文档，writer 是合成值；假服务器会把事件推给页面的实时连接。
// 失败消息只写 id、计数、布尔和界面文案，不回显计划文字（合成值除外）。
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { downloadOf } from '../support/download';
import { confirmCancel, confirmMid, confirmOk, readConfirm } from '../support/confirm';
import { expand, field, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { expectToast } from '../support/toast';
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_PLAN } from '../support/constants';
import {
  BANNER_REMOTE_PE,
  BTN_DOWNLOAD_SNAPSHOT,
  BTN_PE_BACK,
  BTN_PE_OVERWRITE,
  BTN_PE_TAKE_THEIRS,
  PE_CONFLICT_LINES,
  PE_CONFLICT_TITLE,
  PE_HINT_DIRTY,
  PE_HINT_NONE,
  PE_HINT_REMOTE,
  PE_NOTICE,
  TOAST_PLAN_SAVED_KEPT,
  TOAST_PLAN_TAKEN,
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
