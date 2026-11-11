// Phase 11-06 的“导入前留一份、撤销导入”用例（IO-08，D-04、D-05）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 范围：撤销本身、导入之后又有修改时先确认、确认框打开期间同步来修改时再确认、存不下导入前的数据就拒绝导入（Task 1）；
// 撤销副本的生命周期——刷新保留、下一次导入取代、退出和换账号清除、另一个标签页同步显示、导入时挂起的远端版本（Task 2）。
// 导入文件只在内存里构造（文件名以 synth- 开头）；“另一台设备的写入”用 app.fake.request 以另一个 writer 直接改假服务器上的文档。
import type { Page } from '@playwright/test';
import { test, expect } from '../support/test';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { AppHarness } from '../support/app';
import { composer } from '../support/composer';
import { fullBackup, legacyBackup } from '../support/backup-files';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { expectedNormalize } from '../support/expect-from-fixture';
import { openDevice } from '../support/devices';
import { chooseImportFile, jsonImportFile } from '../support/import-file';
import { expectToast } from '../support/toast';
import {
  BANNER_REMOTE,
  BTN_UNDO_CANCEL,
  BTN_UNDO_IMPORT,
  BTN_UNDO_OK,
  CATEGORY_NAMES,
  CONFIRM_LOGOUT_ACCOUNT_PREFIX,
  CONFIRM_LOGOUT_TITLE,
  CONFIRM_LOGOUT_UNDO,
  CONFIRM_UNDO_CHANGED,
  CONFIRM_UNDO_MORE,
  CONFIRM_UNDO_TITLE,
  STATUS_CLOUD_SYNCED,
  TOAST_IMPORT_NO_UNDO,
  TOAST_IMPORTED,
  TOAST_UNDONE,
} from '../support/strings';

type App = AppHarness;
type Log = { id: string; text: string };

const OTHER = 'synth-other-undo';
const LIST_PATH = '/api/collections/journey_docs/records';
const planLike = (p: any): any => {
  const { _synthetic, ...rest } = p;
  return rest;
};
const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);
const undoKeyOf = (app: App) => `usj:v2:${app.fake.users[0].id}:importundo`;
const readJson = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
const snapKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((x) => x.endsWith(':snapshot')));

// 导入：选文件、读摘要、点“导入”
async function importAndConfirm(page: Page, name: string, value: unknown) {
  await chooseImportFile(page, jsonImportFile(name, value));
  await readConfirm(page);
  await confirmOk(page);
}

// 在本周视图记一笔，等它上传到服务器
async function recordAndUpload(app: App, page: Page, text: string) {
  const entry = composer(page, 'w');
  await entry.type(text);
  await entry.submit();
  await expect.poll(() => hasText(app.fake.lastState(0)?.logs, text), { message: '等待服务器拿到刚记的一笔' }).toBe(true);
}

// 另一个参与者在服务器上的 state 加一条合成记录
async function otherAddsLog(app: App, id: string, text: string) {
  const st = app.fake.lastState(0);
  st.logs.push({ id, date: '2026-03-17', cat: CATEGORY_NAMES[0], text });
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'state')}`, { data: st, writer: OTHER });
  expect(res.status).toBe(200);
}

test('IO-08 an import can be undone on this device, the server returns to the data before it and the other device follows (D-04)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('und'), login: 0 });
  const planBefore = app.fake.lastPlan(0);
  const stateBefore = expectedNormalize(syntheticState('und'));
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await expect(page.locator('#undoImportBtn')).toBeHidden();

    const plan = syntheticPlan('ud', 2);
    const file = fullBackup(plan, legacyBackup('und1', { tasks: {}, custom: [] }));
    const key = undoKeyOf(app);
    await importAndConfirm(page, 'synth-undo.json', file);
    await expectToast(page, TOAST_IMPORTED);

    // 导入成功的 toast 带“撤销导入”，工具栏也常驻同名按钮；本机多了一份导入前的数据（独立于冲突留底的另一个槽）
    await expect(page.locator('#toast.act button')).toHaveText(BTN_UNDO_IMPORT);
    await expect(page.locator('#undoImportBtn')).toBeVisible();
    await expect(page.locator('#undoImportBtn')).toHaveText(BTN_UNDO_IMPORT);
    const rec = await readJson(page, key);
    expect(Object.keys(rec).sort()).toEqual(['after', 'at', 'plan', 'state']);
    expect(typeof rec.after).toBe('string');
    expect(rec.plan).toEqual(planBefore);
    expect(rec.state).toEqual(stateBefore);
    expect(await snapKeys(page)).toEqual([]);

    // 服务器和另一台设备都是导入的内容；另一台设备没有“撤销导入”
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 变成文件里的计划' }).toEqual(planLike(plan));
    await expect.poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-und1 week record'), { message: '等待服务器 state 变成文件的记录' }).toBe(true);
    await expect(second.page.locator('#tab-wk [data-edit="synth-und1-1"]')).toBeVisible({ timeout: 20_000 });
    await expect(second.page.locator('#undoImportBtn')).toBeHidden();

    // 点工具栏的“撤销导入”：导入之后没有新修改，不弹确认框，直接撤销
    await page.locator('#undoImportBtn').click();
    await expectToast(page, TOAST_UNDONE);
    await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
    await expect(page.locator('#undoImportBtn')).toBeHidden();
    expect(await readJson(page, key)).toBeNull();

    // 服务器的计划和记录回到导入前；另一台设备随后跟着恢复，而且从头到尾没有“撤销导入”
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 回到导入前' }).toEqual(planBefore);
    await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 回到导入前' }).toEqual(stateBefore);
    await expect(page.locator('#tab-wk [data-edit="synthetic-und"]')).toBeVisible();
    await expect(page.locator('#tab-wk [data-edit="synth-und1-1"]')).toHaveCount(0);
    await expect(second.page.locator('#tab-wk [data-edit="synthetic-und"]')).toBeVisible({ timeout: 20_000 });
    await expect(second.page.locator('#tab-wk [data-edit="synth-und1-1"]')).toHaveCount(0);
    await expect(second.page.locator('#undoImportBtn')).toBeHidden();
  } finally {
    await second.context.close();
  }
});

test('IO-08 undoing after later edits asks first and undoes them too (D-05)', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('udl'), login: 0 });
  const planBefore = app.fake.lastPlan(0);
  const stateBefore = expectedNormalize(syntheticState('udl'));
  const file = legacyBackup('udl1');
  await importAndConfirm(page, 'synth-undo-later.json', file);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));

  // 导入之后又记一笔
  const later = 'SYNTH-udl later edit';
  await recordAndUpload(app, page, later);

  // 点“撤销导入”：先弹确认框说明新修改会一起撤掉；点“不撤销”什么都不变
  await page.locator('#undoImportBtn').click();
  const first = await readConfirm(page);
  expect(first.title).toBe(CONFIRM_UNDO_TITLE);
  expect(first.lines).toEqual([CONFIRM_UNDO_CHANGED]);
  await expect(page.locator('#cfCancel')).toHaveText(BTN_UNDO_CANCEL);
  await expect(page.locator('#cfOk')).toHaveText(BTN_UNDO_OK);
  await confirmCancel(page);
  await expect(page.locator('#undoImportBtn')).toBeVisible();
  expect(await readJson(page, undoKeyOf(app))).not.toBeNull();
  expect(hasText(app.fake.lastState(0)?.logs, later)).toBe(true);
  await expect(page.locator('#tab-wk')).toContainText(later);

  // 再点并“仍然撤销”：服务器回到导入前，刚记的那笔也没了
  await page.locator('#undoImportBtn').click();
  expect((await readConfirm(page)).lines).toEqual([CONFIRM_UNDO_CHANGED]);
  await confirmOk(page);
  await expectToast(page, TOAST_UNDONE);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 回到导入前' }).toEqual(stateBefore);
  expect(app.fake.lastPlan(0)).toEqual(planBefore);
  await expect(page.locator('#tab-wk')).not.toContainText(later);
  await expect(page.locator('#undoImportBtn')).toBeHidden();
  expect(await readJson(page, undoKeyOf(app))).toBeNull();
});

test('IO-08 a change synced in while the undo confirm is open asks again before it is undone (D-05)', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('udm'), login: 0 });
  const planBefore = app.fake.lastPlan(0);
  const stateBefore = expectedNormalize(syntheticState('udm'));
  const file = legacyBackup('udm1');
  await importAndConfirm(page, 'synth-undo-more.json', file);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));
  const later = 'SYNTH-udm later edit';
  await recordAndUpload(app, page, later);

  // 确认框打开，正文只有“导入之后又有新的修改”
  await page.locator('#undoImportBtn').click();
  expect((await readConfirm(page)).lines).toEqual([CONFIRM_UNDO_CHANGED]);

  // 这时另一台设备在服务器上又加了一条记录：确认框打开时页面算忙，更新只挂起并显示横幅
  const otherText = 'SYNTH-udm other device record';
  await otherAddsLog(app, 'synthetic-other-udm', otherText);
  const bar = page.locator('#syncbar');
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_REMOTE);

  // 点“仍然撤销”：没有撤销，确认框再次打开，多一行说明确认框打开期间又收到了修改（点击后旧框的关闭是异步的，所以轮询等新正文）
  await page.locator('#cfOk').click();
  await expect
    .poll(async () => (await readConfirm(page)).lines, { message: '等待第二个确认框出现' })
    .toEqual([CONFIRM_UNDO_CHANGED, CONFIRM_UNDO_MORE]);
  // 此刻服务器上什么都没有被撤销：另一台设备的那条记录和刚记的那笔都还在，导入的记录也还在；撤销入口和撤销副本还在
  const during = app.fake.lastState(0);
  expect(hasText(during.logs, otherText)).toBe(true);
  expect(hasText(during.logs, later)).toBe(true);
  expect(hasText(during.logs, 'SYNTH-udm1 week record')).toBe(true);
  await expect(page.locator('#undoImportBtn')).toBeVisible();
  expect(await readJson(page, undoKeyOf(app))).not.toBeNull();

  // 点“不撤销”：什么都不变，那次修改留在页面和服务器上
  await confirmCancel(page);
  await expect(page.locator('#tab-wk [data-edit="synthetic-other-udm"]')).toHaveCount(1);
  expect(hasText(app.fake.lastState(0)?.logs, otherText)).toBe(true);
  expect(hasText(app.fake.lastState(0)?.logs, later)).toBe(true);
  await expect(page.locator('#undoImportBtn')).toBeVisible();

  // 再点“撤销导入”：这次打开期间没有新修改，确认框只有第一行；确认之后才撤销
  await page.locator('#undoImportBtn').click();
  expect((await readConfirm(page)).lines).toEqual([CONFIRM_UNDO_CHANGED]);
  await confirmOk(page);
  await expectToast(page, TOAST_UNDONE);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 回到导入前' }).toEqual(stateBefore);
  expect(app.fake.lastPlan(0)).toEqual(planBefore);
  await expect(page.locator('#undoImportBtn')).toBeHidden();
});

test('IO-08 an import is refused when the data before it cannot be kept on this device', async ({ app, page }) => {
  // 测试装置：写撤销副本的键时抛配额错误（其余键照常写）；在应用脚本之前装好
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (String(key).endsWith(':importundo')) throw new DOMException('quota', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await app.open({ mode: 'cloud', seed: syntheticState('udq'), login: 0 });
  const planBefore = app.fake.lastPlan(0);
  const stateBefore = app.fake.lastState(0);
  const writesBefore = app.fake.writes.length;

  await importAndConfirm(page, 'synth-undo-quota.json', legacyBackup('udq1'));
  await expectToast(page, TOAST_IMPORT_NO_UNDO);

  // 没有导入：页面还是原来的记录，没有“撤销导入”，本机没有撤销副本；等一会儿，服务器没有收到任何写入
  await expect(page.locator('#tab-wk [data-edit="synthetic-udq"]')).toBeVisible();
  await expect(page.locator('#tab-wk [data-edit="synth-udq1-1"]')).toHaveCount(0);
  await expect(page.locator('#undoImportBtn')).toBeHidden();
  expect(await readJson(page, undoKeyOf(app))).toBeNull();
  await page.waitForTimeout(1_500);
  expect(app.fake.writes.length).toBe(writesBefore);
  expect(app.fake.lastState(0)).toEqual(stateBefore);
  expect(app.fake.lastPlan(0)).toEqual(planBefore);
});

test('IO-08 the undo entry survives a reload and is replaced by the next import', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('udr'), login: 0 });
  const key = undoKeyOf(app);

  // 导入 A，等上传完，刷新：“撤销导入”仍在，本机的撤销副本还在
  const fileA = legacyBackup('udra');
  await importAndConfirm(page, 'synth-undo-a.json', fileA);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成 A' }).toEqual(expectedNormalize(fileA));
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  await app.reload();
  await expect(page.locator('#undoImportBtn')).toBeVisible();
  expect(await readJson(page, key)).not.toBeNull();

  // 再导入 B：撤销副本换成 B 导入之前的数据，也就是 A 导入后的数据
  const fileB = legacyBackup('udrb');
  await importAndConfirm(page, 'synth-undo-b.json', fileB);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成 B' }).toEqual(expectedNormalize(fileB));
  const rec = await readJson(page, key);
  expect(hasText(rec.state.logs, 'SYNTH-udra week record')).toBe(true);
  expect(hasText(rec.state.logs, 'SYNTH-udrb week record')).toBe(false);
  expect(hasText(rec.state.logs, '合成记录 udr')).toBe(false);

  // 撤销：服务器回到 B 导入之前（A 导入后的数据），不是 A 之前；撤销用掉了这份数据，入口消失
  await page.locator('#undoImportBtn').click();
  await expectToast(page, TOAST_UNDONE);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 回到 A' }).toEqual(expectedNormalize(fileA));
  await expect(page.locator('#undoImportBtn')).toBeHidden();
  expect(await readJson(page, key)).toBeNull();
});

test('IO-08 logout and switching accounts clear the import undo copy and the logout confirm says the undo will be lost', async ({
  app,
  page,
  guard,
}) => {
  await app.open({ mode: 'cloud', users: 2, seed: syntheticState('uda') });
  app.fake.seed(syntheticState('udb'), { userIndex: 1 });
  const [userA, userB] = app.fake.users;
  await app.login(0);
  const keyA = undoKeyOf(app);
  const localKeysOfA = () => page.evaluate((prefix) => Object.keys(localStorage).filter((k) => k.startsWith(prefix)), `usj:v2:${userA.id}:`);
  const imported = async (name: string, label: string) => {
    await importAndConfirm(page, name, legacyBackup(label));
    await expectToast(page, TOAST_IMPORTED);
    await expect.poll(() => hasText(app.fake.lastState(0)?.logs, `SYNTH-${label} week record`), { message: '等待服务器拿到导入的记录' }).toBe(true);
    await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  };

  // 退出：数据都已上传，所以确认框里只有账号行和撤销说明；先点“不退出”，副本还在
  await imported('synth-undo-out.json', 'uda1');
  expect(await localKeysOfA()).toContain(keyA);
  await page.locator('#logoutBtn').click();
  const confirm = await readConfirm(page);
  expect(confirm.title).toBe(CONFIRM_LOGOUT_TITLE);
  expect(confirm.lines).toEqual([CONFIRM_LOGOUT_ACCOUNT_PREFIX + userA.email, CONFIRM_LOGOUT_UNDO]);
  await confirmCancel(page);
  expect(await readJson(page, keyA)).not.toBeNull();

  // 点“仍然退出”：本机没有 A 的任何键，包括撤销副本；再登录同一账号，没有“撤销导入”
  await page.locator('#logoutBtn').click();
  await readConfirm(page);
  await page.locator('#cfOk').click();
  await expect(page.locator('#login')).toBeVisible();
  expect(await localKeysOfA()).toEqual([]);
  await app.login(0);
  await expect(page.locator('#undoImportBtn')).toBeHidden();
  expect(await readJson(page, keyA)).toBeNull();

  // 换账号：A 再导入一次，令牌失效（没有未上传的修改，所以换账号时不再确认），换 B 登录，A 的本机键全部清除，B 没有“撤销导入”
  await imported('synth-undo-switch.json', 'uda2');
  expect(await readJson(page, keyA)).not.toBeNull();
  app.fake.revokeTokens(0);
  await page.reload();
  await expect(page.locator('#login')).toBeVisible();
  await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });
  expect(await readJson(page, keyA)).not.toBeNull();
  await app.submitLogin(1);
  await app.ready();
  expect(await page.content()).toContain('合成记录 udb');
  expect(await localKeysOfA()).toEqual([]);
  await expect(page.locator('#undoImportBtn')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('usj:v2:lastUser'))).toBe(userB.id);
});

test('IO-08 the undo entry shows and hides in another tab of the same browser', async ({ app, page, context }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('udt'), login: 0 });
  const other = await context.newPage();
  try {
    await new AppHarness(other, { fake: app.fake }).open({ mode: 'cloud', login: 'session' });
    await expect(other.locator('#undoImportBtn')).toBeHidden();

    // 标签页 A 导入：标签页 B 也出现“撤销导入”（storage 事件；等待用真实计时）
    await importAndConfirm(page, 'synth-undo-tabs.json', legacyBackup('udt1'));
    await expectToast(page, TOAST_IMPORTED);
    await expect(page.locator('#undoImportBtn')).toBeVisible();
    await expect(other.locator('#undoImportBtn')).toBeVisible({ timeout: 15_000 });

    // 标签页 A 撤销：两个标签页的按钮都消失
    await page.locator('#undoImportBtn').click();
    await expectToast(page, TOAST_UNDONE);
    await expect(page.locator('#undoImportBtn')).toBeHidden();
    await expect(other.locator('#undoImportBtn')).toBeHidden({ timeout: 15_000 });
    expect(await readJson(other, undoKeyOf(app))).toBeNull();
  } finally {
    await other.close();
  }
});

test('IO-08 the undo restores a remote change that was waiting when the import was made', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('udw'), login: 0 });
  // 本周 composer 里写着没提交的草稿：页面忙，别的设备的更新只会挂起、显示横幅
  const draft = 'SYNTH-udw draft in progress';
  const entry = composer(page, 'w');
  await entry.type(draft);
  await expect(entry.text).toBeFocused();
  const otherText = 'SYNTH-udw remote record';
  await otherAddsLog(app, 'synthetic-other-udw', otherText);
  await expect(page.locator('#syncbar .sb-msg')).toHaveText(BANNER_REMOTE);

  // 导入：挂起的那次远端更新算导入前的数据，导入之后服务器上是文件的内容
  const file = legacyBackup('udw1');
  await importAndConfirm(page, 'synth-undo-pending.json', file);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));
  const rec = await readJson(page, undoKeyOf(app));
  expect(hasText(rec.state.logs, otherText)).toBe(true);

  // 撤销：没有新修改不弹确认框；服务器上又有了那次远端更新和原来的记录，没有导入的记录
  await page.locator('#undoImportBtn').click();
  await expectToast(page, TOAST_UNDONE);
  await expect
    .poll(() => (app.fake.lastState(0)?.logs ?? []).map((l: Log) => l.id).sort(), { message: '等待服务器 state 回到导入前（含远端更新）' })
    .toEqual(['synthetic-other-udw', 'synthetic-udw']);
  expect(hasText(app.fake.lastState(0)?.logs, otherText)).toBe(true);
  expect(await entry.draft()).toBe(draft);
  await expect(page.locator('#syncbar')).not.toBeVisible();
});
