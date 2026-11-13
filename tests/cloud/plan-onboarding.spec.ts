// Phase 14-01 的云端用例（PLAN-06、PLAN-07：新账号的空计划起步、空计划卡片的「从示例里挑」直接保存）。
// 只在 npm run test:cloud 里运行，只用合成账号（FakePbServer 的合成用户）和假服务器，不连任何真实服务。
// 示例计划的文字是仓库里公开的合成样本：用 loadAppPure 取 SEED_PLAN（写法抄 login.spec.ts），断言里只做布尔比较，不拼进失败消息。
import { test, expect } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { gotoCalendar } from '../support/calendar';
import { gotoTimeline, readTimeline } from '../support/timeline';
import { loadAppPure } from '../support/app-source';
import { gotoGoals, readGroupIds, readGroups } from '../support/goals';
import type { Page } from '@playwright/test';
import { expectToast } from '../support/toast';
import { confirmMid, confirmOk, readConfirm } from '../support/confirm';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { openPicker, openPickerFromEditor, pick, readCardEntry, readPicker } from '../support/plan-picker';
import { discardPlan, openEditor, readEditor, savePlan } from '../support/plan-editor';
import { AppHarness } from '../support/app';
import { FROZEN_NOW, PB_DOC_MAX_BYTES } from '../support/constants';
import { BUILTIN_GROUP_SIZES } from '../support/task-ids';
import {
  BTN_PICK_SAMPLE,
  BTN_PK_OK_CARD,
  BTN_PLAN_BUILD,
  BANNER_TOO_LARGE,
  BTN_DOWNLOAD_SNAPSHOT,
  PE_HINT_EXPIRED,
  PE_HINT_TOOLARGE,
  PK_WHY_EXPIRED,
  BTN_PE_OVERWRITE,
  BTN_PK_BACK,
  BTN_PK_TAKE,
  PE_CONFLICT_TITLE,
  PE_HINT_OFFLINE,
  PK_CF_LINES,
  PK_TAKEN,
  TOAST_PLAN_SAVED_KEPT,
  PK_HINT_NONE,
  PK_WHY_OFFLINE,
  PK_TITLE_CARD,
  WEEK_EMPTY_PLAN,
  pkDone,
  pkPicked,
  BTN_PK_ADD,
  PK_TOOLS_NOTE,
  PK_TITLE_EDIT,
  PK_DESC_EDIT,
  BTN_PK_OK_EDIT,
  PE_HINT_DIRTY,
  TOAST_PLAN_SAVED,
  pkDrafted,
  pkLive,
  PK_DUP_G,
  PK_FULL_G,
  PK_FULL_L,
  pkLimG,
  pkLimL,
  PE_LEAVE_TITLE,
} from '../support/strings';

// 合成种子计划：应用里唯一一份合成示例计划，即 normalizePlan(DEFAULT_PLAN)；JSON 往返后脱离 vm 的 realm
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));

// 独立写出的空计划（D-01、D-02、D-03）：没有目标组和力量项，5 个类别的快捷词全空，每周健身目标和说明保留示例的值
const EMPTY_PLAN = {
  v: 1,
  presets: { lang: [], pro: [], fit: [], job: [], oth: [] },
  groups: [],
  lifts: [],
  fitGoal: [2, 4],
  fitNote: SEED_PLAN.fitNote,
};

test('PLAN-07 a new account picks one sample group and one lift from the empty plan card and they are saved with new ids and shown on the goals page (D-01, D-07, D-08)', async ({
  app,
  page,
}) => {
  // 只给种子 state、不给 plan：服务器上没有计划文档，首次登录建空计划
  await app.open({ mode: 'cloud', seed: syntheticState('po'), login: 0 });
  expect(app.fake.lastPlan(0)).toEqual(EMPTY_PLAN);

  await gotoGoals(page);
  await expect(page.locator('#goals .pe-empty')).toBeVisible();
  await expect(page.locator('#planEditBtn2')).toHaveText(BTN_PLAN_BUILD);
  await expect(page.locator('#planEditBtn2')).toHaveClass(/primary/);
  await expect(page.locator('#planSampleBtn')).toHaveText(BTN_PICK_SAMPLE);

  // 打开挑选对话框：标题是卡片模式的标题，11 项（7 个目标组、4 个力量项）一项都没勾，确认不可用，提示行说先勾选
  await page.locator('#planSampleBtn').click();
  const dlg = page.locator('dialog#sample');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#pk-title')).toHaveText(PK_TITLE_CARD);
  const boxes = dlg.locator('input[data-pk]');
  await expect(boxes).toHaveCount(11);
  expect(await boxes.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length)).toBe(0);
  const ok = page.locator('#pkOk');
  await expect(ok).toHaveText(BTN_PK_OK_CARD);
  await expect(ok).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#pk-hint')).toHaveText(PK_HINT_NONE);

  // 没勾时点确认：不保存、不关对话框
  const planWrites = () => app.fake.writes.filter((w) => w.path === 'journey_docs:plan').length;
  // （首次登录建空计划文档本身是一次写入，所以和点击前的条数比）
  const writesBefore = planWrites();
  await ok.click({ force: true });
  await expect(dlg).toBeVisible();
  expect(planWrites()).toBe(writesBefore);

  // 勾一个目标组（第 2 个示例组）和一个力量项（卧推）：提示行变成已选，确认可用
  await dlg.locator('input[data-pk="g:P2"]').check();
  await dlg.locator('input[data-pk="l:bench"]').check();
  await expect(page.locator('#pk-hint')).toHaveText(pkPicked(1, 1));
  await expect(ok).not.toHaveAttribute('aria-disabled', 'true');

  await ok.click();
  await expect(dlg).toBeHidden();
  await expectToast(page, pkDone(1, 1));

  // 服务器计划：只多了勾选的一组一项，id 全是新的，内容和示例的对应项相同，快捷词、健身目标不动
  await expect.poll(() => (app.fake.lastPlan(0)?.groups ?? []).length, { message: '等待计划上传' }).toBe(1);
  const saved = app.fake.lastPlan(0);
  const g = saved.groups[0];
  const sampleG = SEED_PLAN.groups[1];
  expect(/^g-[A-Za-z0-9_-]+$/.test(g.id) && g.id !== 'P2').toBe(true);
  expect(g.tasks).toHaveLength(BUILTIN_GROUP_SIZES.P2);
  expect(g.tasks.every((t: { id: string }) => /^t-/.test(t.id) && !t.id.startsWith('P2-'))).toBe(true);
  expect(g.name === sampleG.name && g.cat === sampleG.cat).toBe(true);
  expect(saved.lifts).toHaveLength(1);
  const l = saved.lifts[0];
  const sampleL = SEED_PLAN.lifts[0];
  expect(/^l-/.test(l.id) && l.id !== 'bench').toBe(true);
  expect(l.unit === sampleL.unit && l.def === sampleL.def && l.target === sampleL.target).toBe(true);
  expect(saved.presets).toEqual(EMPTY_PLAN.presets);
  expect(saved.fitGoal).toEqual([2, 4]);

  // 目标页马上显示：留在目标页，1 个组（编号 P1）、1 张力量卡，焦点在「编辑计划」入口
  expect((await readGroups(page)).map((x) => x.code)).toEqual(['P1']);
  await expect(page.locator('#goals .lift')).toHaveCount(1);
  await expect(page.locator('#planEditBtn')).toBeFocused();
  expect(app.fake.fulfillErrors).toEqual([]);
});

// D-01 的四种情况：无文档无缓存 → 空计划（上面的用例和 login.spec 的 PLAN-01）；已有文档 → 不变且不写（下一条）；
// 文档缺失但本机有缓存 → 按缓存重建（再下一条）；撞唯一索引 → 重读服务器（reconcile-gate.spec.ts 里原有的用例）
test('PLAN-06 an account that already has a plan document keeps it unchanged at sign-in and no plan is written (D-01)', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('pk'), plan: SEED_PLAN, login: 0 });
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');

  expect(app.fake.writes.filter((w) => w.path === 'journey_docs:plan')).toHaveLength(0);
  expect(app.fake.lastPlan(0)).toEqual(SEED_PLAN);
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  await expect(page.locator('#goals .pe-empty')).toHaveCount(0);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test("PLAN-06 a missing plan document is recreated from this device's cached plan, not from the empty plan (D-01)", async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('pc'), plan: syntheticPlan('pc', 2), login: 0 });
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');

  // 服务器上的计划文档没了，本机缓存还在：刷新后按缓存重建
  app.fake.dropDocs(0, 'plan');
  await app.reload();

  await expect
    .poll(() => (app.fake.lastPlan(0)?.groups ?? []).map((g: { id: string }) => g.id), { message: '等待计划文档重建' })
    .toEqual(['g-pc1', 'g-pc2']);
  await gotoGoals(page);
  expect(await readGroupIds(page)).toEqual(['g-pc1', 'g-pc2']);
  await expect(page.locator('#goals .pe-empty')).toHaveCount(0);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('PLAN-06 with the empty plan the composer has no base tags and entries recorded in the week and calendar views reach the timeline and the server (D-01, D-02)', async ({
  app,
  page,
}) => {
  const seed = syntheticState('po');
  await app.open({ mode: 'cloud', seed, login: 0 });
  expect(app.fake.lastPlan(0)).toEqual(EMPTY_PLAN);

  // 本周页：空计划说明可见；记一笔选「语言」后没有任何基础快捷词（D-02）
  await expect(page.locator('#wkEmpty')).toBeVisible();
  await expect(page.locator('#wkEmpty')).toHaveText(WEEK_EMPTY_PLAN);
  const wk = composer(page, 'w');
  await wk.pickCategory('语言');
  await expect(wk.presets).toHaveCount(0);
  await wk.type('SYNTH-po week');
  await wk.submit();

  // 日历页：同一天的「记一笔」照常记录
  await gotoCalendar(page);
  const cal = composer(page, 'c');
  await cal.pickCategory('语言');
  await expect(cal.presets).toHaveCount(0);
  await cal.type('SYNTH-po cal');
  await cal.submit();

  // 时间线：种子 1 条加新记的 2 条；服务器 state 的 logs 同样是 3 条，两条新记录的文字都在
  await gotoTimeline(page);
  await expect.poll(async () => (await readTimeline(page)).rows.filter((r) => r.attr === 'edit').length, { message: '时间线里的记录条数' }).toBe(3);
  await expect
    .poll(() => (app.fake.lastState(0)?.logs ?? []).length, { message: '等待记录上传' })
    .toBe(seed.logs.length + 2);
  const texts = (app.fake.lastState(0)?.logs ?? []).map((l: { text: string }) => l.text);
  expect(texts.includes('SYNTH-po week') && texts.includes('SYNTH-po cal')).toBe(true);
  // 计划文档没有被记一笔改动
  expect(app.fake.lastPlan(0)).toEqual(EMPTY_PLAN);
  expect(app.fake.fulfillErrors).toEqual([]);
});

const LIST_PATH = '/api/collections/journey_docs/records';
const ITEM_PATH = /\/api\/collections\/journey_docs\/records\/[^/]+$/;
const planWritesOf = (app: { fake: any }) => (app.fake.writes as Array<{ path: string }>).filter((w) => w.path === 'journey_docs:plan').length;

// 另一个写入方（另一台设备）保存了服务器上的计划：mutate 改一份深拷贝，返回写入的内容
async function otherWriterSavesPlan(app: { fake: any }, mutate: (plan: any) => void) {
  const data = app.fake.lastPlan(0);
  mutate(data);
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'plan')}`, { data, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
  return data;
}
// 页面的计划缓存记录 { base, dirty, data, ... }；页面拿到新的计划版本时 base 变化（挑选对话框开着时新版本只挂起，不应用）
const planCache = (page: Page, userId: string) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, `usj:v2:${userId}:plan`);
async function waitPlanVersion(page: Page, userId: string, before: string) {
  await expect
    .poll(async () => (await planCache(page, userId))?.base ?? before, { message: '等待页面拿到新的计划版本' })
    .not.toBe(before);
}
// 本机留底记录 { kind, data, told }
const snapshotOf = (page: Page, userId: string) =>
  page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, `usj:v2:${userId}:snapshot`);

// 卡片模式套用编辑页保存的规则（D-07）：断网、过期、冲突、容量。时钟由用例控制，轮询用 runFor 推进
test.describe('empty plan card entry with the clock under test control', () => {
  test.use({ clockMode: 'manual' });

  test('PLAN-07 while offline the pick button on the empty plan card is greyed with the reason and the picker refuses to save until the connection is back (D-07, 12 D-11)', async ({
    app,
    page,
    context,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('of'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const status = page.locator('#status');
    const toastOn = () => page.evaluate(() => !!document.querySelector('#toast')?.classList.contains('on'));
    const hideToast = () => page.evaluate(() => document.querySelector('#toast')?.classList.remove('on'));

    // 断网：列表读取和单条更新被拒，记一笔让状态行进入 offline
    const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
    const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
    await context.setOffline(true);
    const entry = composer(page, 'w');
    await entry.type('SYNTH-of offline entry');
    await entry.submit();
    await page.clock.runFor(1_000);
    await expect(status).toHaveAttribute('data-state', 'offline');

    // 空计划卡片：「从示例里挑」用 aria-disabled（不是 disabled），下面写原因；「自己建一份」照常可用
    await gotoGoals(page);
    let card = await readCardEntry(page);
    expect(card).toEqual({
      sampleAriaDisabled: true,
      sampleDisabled: false,
      why: PK_WHY_OFFLINE,
      buildAriaDisabled: false,
      buildDisabled: false,
    });
    await expect(page.locator('#planSampleBtn')).toHaveAttribute('aria-describedby', 'planSampleWhy');

    // 点它：只弹同一句 toast，对话框没打开
    await hideToast();
    await page.locator('#planSampleBtn').click({ force: true });
    await expectToast(page, PK_WHY_OFFLINE);
    expect((await readPicker(page)).open).toBe(false);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });

    // 联网：撤掉故障，状态行回到已同步，说明消失，按钮恢复
    await app.fake.clearFaults();
    await context.setOffline(false);
    await expect(status).toHaveAttribute('data-state', 'synced');
    card = await readCardEntry(page);
    expect([card.sampleAriaDisabled, card.sampleDisabled, card.why]).toEqual([false, false, '']);

    // 挑选对话框开着时断网：下一次 60 秒轮询被拒，提示行改成「联网后再保存」，确认按钮 aria-disabled，勾选保留
    await openPicker(page);
    await pick(page, 'g:P7');
    expect((await readPicker(page)).hint).toBe(pkPicked(1, 0));
    const pollFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
    await context.setOffline(true);
    await page.clock.runFor(60_000);
    await expect(status).toHaveAttribute('data-state', 'offline');
    let pk = await readPicker(page);
    expect([pk.open, pk.hint, pk.tone, pk.okAriaDisabled, pk.okDisabled, pk.checked]).toEqual([
      true,
      PE_HINT_OFFLINE,
      'warn',
      true,
      false,
      ['g:P7'],
    ]);

    // 点确认：只弹同一句 toast，对话框不关，没有计划写入
    const writesBefore = planWritesOf(app);
    await hideToast();
    expect(await toastOn()).toBe(false);
    await page.locator('#pkOk').click({ force: true });
    await expectToast(page, PE_HINT_OFFLINE);
    pk = await readPicker(page);
    expect([pk.open, pk.checked]).toEqual([true, ['g:P7']]);
    expect(planWritesOf(app)).toBe(writesBefore);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: pollFault.hits });

    // 联网：提示行回到「已选 …」，确认可用，保存成功
    await app.fake.clearFaults();
    await context.setOffline(false);
    await expect(status).toHaveAttribute('data-state', 'synced');
    pk = await readPicker(page);
    expect([pk.hint, pk.tone, pk.okAriaDisabled]).toEqual([pkPicked(1, 0), null, false]);
    await page.locator('#pkOk').click();
    await expectToast(page, pkDone(1, 0));
    await expect.poll(() => (app.fake.lastPlan(0)?.groups ?? []).length, { message: '等待计划上传' }).toBe(1);
  });
});

test('PLAN-07 a plan saved on another device while picking asks on save, going back keeps the picks and overwriting keeps the other version here (D-07)', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('cf'), login: 0 });
  const userId = app.fake.users[0].id;
  await gotoGoals(page);
  await openPicker(page);
  const base0 = (await planCache(page, userId)).base as string;

  // 挑选期间另一个写入方保存了计划（只改健身说明，计划仍是空的）；页面拿到新版本，但对话框开着，新版本挂起不应用
  await otherWriterSavesPlan(app, (p) => {
    p.fitNote = 'SYNTH-cf other note';
  });
  await waitPlanVersion(page, userId, base0);
  await expect(page.locator('#goals .pe-empty')).toBeVisible();
  const writesBefore = planWritesOf(app);

  // 挑第 4 组，点确认：三选一（标题、四行正文、三个按钮的文字和顺序）；保存中确认 disabled 带 aria-busy，取消 disabled，对话框仍开着
  await pick(page, 'g:P4');
  await page.locator('#pkOk').click();
  const cf = await readConfirm(page);
  expect(cf.title).toBe(PE_CONFLICT_TITLE);
  expect(cf.lines).toEqual(PK_CF_LINES);
  expect(cf.buttons.map((b) => b.text)).toEqual([BTN_PK_BACK, BTN_PK_TAKE, BTN_PE_OVERWRITE]);
  expect(cf.focused).toBe('cfCancel');
  let pk = await readPicker(page);
  expect([pk.open, pk.okBusy, pk.okDisabled, pk.cancelDisabled]).toEqual([true, true, true, true]);

  // 回去继续挑（Esc 等同）：只关确认框，挑选对话框还在，勾选保留，确认恢复可点并获得焦点，什么都没写
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
  pk = await readPicker(page);
  expect([pk.open, pk.checked, pk.okBusy, pk.okDisabled, pk.cancelDisabled, pk.focusKey]).toEqual([true, ['g:P4'], false, false, false, 'pkOk']);
  expect(planWritesOf(app)).toBe(writesBefore);

  // 再点确认：同一个三选一 → 用我的覆盖：对话框关闭，toast 说对方那一版已在本机留底并带「下载留底」，留底入口出现
  await page.locator('#pkOk').click();
  await readConfirm(page);
  await confirmOk(page);
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await expectToast(page, TOAST_PLAN_SAVED_KEPT);
  await expect(page.locator('#toast button')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
  await expect(page.locator('#snapshotBtn')).toBeVisible();

  // 服务器计划：打开时看到的计划（空）加上挑的一组，新 id；健身说明是打开时看到的示例句，不是对方那句
  await expect.poll(() => (app.fake.lastPlan(0)?.groups ?? []).length, { message: '等待计划上传' }).toBe(1);
  const saved = app.fake.lastPlan(0);
  expect(/^g-/.test(saved.groups[0].id) && saved.groups[0].tasks.length === BUILTIN_GROUP_SIZES.P4).toBe(true);
  expect(saved.fitNote === SEED_PLAN.fitNote).toBe(true);
  expect(saved.fitNote === 'SYNTH-cf other note').toBe(false);

  // 本机留底是计划类型，里面是对方的版本
  const kept = await snapshotOf(page, userId);
  expect(kept?.kind).toBe('plan');
  expect(kept?.data?.fitNote === 'SYNTH-cf other note').toBe(true);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test("PLAN-07 taking the other device's new plan while picking adds nothing and shows that plan (D-07)", async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('cfo'), login: 0 });
  const userId = app.fake.users[0].id;
  await gotoGoals(page);
  await openPicker(page);
  const base0 = (await planCache(page, userId)).base as string;

  // 挑选期间另一个写入方把计划换成带一个合成组 g-cfo1 的计划：目标页仍是空计划卡片（新版本挂起）
  await otherWriterSavesPlan(app, (p) => {
    Object.assign(p, syntheticPlan('cfo', 1));
  });
  await waitPlanVersion(page, userId, base0);
  await expect(page.locator('#goals .pe-empty')).toBeVisible();
  const writesBefore = planWritesOf(app);

  // 挑第 1 组，点确认 → 放弃我的选择，用新版：对话框关闭，toast，目标页显示对方的计划，焦点在「编辑计划」，本页没有写计划
  await pick(page, 'g:P1');
  await page.locator('#pkOk').click();
  await readConfirm(page);
  await confirmMid(page);
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await expectToast(page, PK_TAKEN);
  expect(await readGroupIds(page)).toEqual(['g-cfo1']);
  await expect(page.locator('#planEditBtn')).toBeFocused();
  expect(planWritesOf(app)).toBe(writesBefore);
  expect(app.fake.lastPlan(0).groups.map((g: { id: string }) => g.id)).toEqual(['g-cfo1']);
  expect(await snapshotOf(page, userId)).toBeNull();
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('PLAN-07 picks that would push the plan over the cloud limit are not saved and the picker says so (D-07, 12 D-17)', async ({ app, page }) => {
  // 服务器计划：空计划加一个归档的合成组（没有未归档的组和力量项，目标页仍是空计划卡片），备注凑到容量上限以下约 400 字节
  const plan: any = syntheticPlan('cap1', 1);
  plan.groups[0].id = 'g-cap1';
  plan.groups[0].archived = true;
  plan.groups[0].note = '';
  plan.lifts = [];
  const room = PB_DOC_MAX_BYTES - 400 - Buffer.byteLength(JSON.stringify(plan));
  plan.groups[0].note = '合'.repeat(Math.floor(room / 3));
  expect(Buffer.byteLength(JSON.stringify(plan))).toBeLessThanOrEqual(PB_DOC_MAX_BYTES - 398);
  await app.open({ mode: 'cloud', seed: syntheticState('cap'), plan, login: 0 });
  await gotoGoals(page);
  await expect(page.locator('#goals .pe-empty')).toBeVisible();
  const writesBefore = planWritesOf(app);

  // 挑第 2 组（约 1 KB，超过剩下的 400 字节）并点确认：不保存，提示行是容量那一句（error），对话框仍开着，横幅出现，没有计划写入
  await openPicker(page);
  await pick(page, 'g:P2');
  await page.locator('#pkOk').click();
  await expect(page.locator('#pk-hint')).toHaveText(PE_HINT_TOOLARGE);
  const pk = await readPicker(page);
  expect([pk.open, pk.hint, pk.tone, pk.okBusy, pk.okDisabled, pk.okAriaDisabled, pk.checked]).toEqual([
    true,
    PE_HINT_TOOLARGE,
    'error',
    false,
    false,
    false,
    ['g:P2'],
  ]);
  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_TOO_LARGE);
  expect(planWritesOf(app)).toBe(writesBefore);
  expect((app.fake.lastPlan(0).groups ?? []).length).toBe(1);

  // 点「先不添加」关闭：容量超限横幅收起，计划还是原来的
  await page.locator('#pkCancel').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await expect(bar).toBeHidden();
  expect(planWritesOf(app)).toBe(writesBefore);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('PLAN-07 signing out in another tab while the picker is open closes it (S1, D-07)', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('xt'), login: 0 });
  await gotoGoals(page);
  const other = await page.context().newPage();
  try {
    await new AppHarness(other, { fake: app.fake }).open({ mode: 'cloud', login: 'session' });
    await openPicker(page);
    await pick(page, 'g:P1');

    // 第二个标签页退出登录（没有未上传的修改时可能不问，问了就确认）
    await other.locator('#logoutBtn').click();
    const asked = await other
      .locator('dialog#confirm')
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(
        () => true,
        () => false,
      );
    if (asked) await other.locator('#cfOk').click();
    await expect(other.locator('#login')).toBeVisible();

    // 第一个标签页：挑选对话框被关掉，回到登录页，什么都没写
    await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.locator('.wrap')).toBeHidden();
  } finally {
    await other.close();
  }
});

test.describe('empty plan card entry with an expired login or a startup reconcile', () => {
  test.use({ clockMode: 'manual' });

  test('PLAN-07 with an expired login the empty plan card and the open picker refuse to save and say why (D-07, 12 D-12)', async ({
    app,
    page,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('ex'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await gotoGoals(page);
    await openPicker(page);
    await pick(page, 'l:squat');
    const writesBefore = planWritesOf(app);

    // 令牌失效，下一次 60 秒轮询发现登录过期（只此一条 401）
    app.fake.revokeTokens(0);
    await page.clock.runFor(60_000);
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'expired');
    await acknowledgeConsoleErrors(guard, { 'status of 401 ': 1 });

    // 对话框开着：提示行「登录已过期，重新登录后再保存」，确认 aria-disabled，点它只弹同一句 toast，对话框不关，勾选保留，没有计划写入
    let pk = await readPicker(page);
    expect([pk.open, pk.hint, pk.tone, pk.okAriaDisabled, pk.checked]).toEqual([true, PE_HINT_EXPIRED, 'warn', true, ['l:squat']]);
    await page.locator('#pkOk').click({ force: true });
    await expectToast(page, PE_HINT_EXPIRED);
    pk = await readPicker(page);
    expect([pk.open, pk.checked]).toEqual([true, ['l:squat']]);
    expect(planWritesOf(app)).toBe(writesBefore);

    // 关掉对话框：卡片上的「从示例里挑」变灰，说明是过期那一句，「自己建一份」照常可用；点它只弹同一句 toast，对话框不打开
    await page.locator('#pkCancel').click();
    await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
    const card = await readCardEntry(page);
    expect(card).toEqual({
      sampleAriaDisabled: true,
      sampleDisabled: false,
      why: PK_WHY_EXPIRED,
      buildAriaDisabled: false,
      buildDisabled: false,
    });
    await page.evaluate(() => document.querySelector('#toast')?.classList.remove('on'));
    await page.locator('#planSampleBtn').click({ force: true });
    await expectToast(page, PK_WHY_EXPIRED);
    expect((await readPicker(page)).open).toBe(false);
    expect(planWritesOf(app)).toBe(writesBefore);
  });

  test('PLAN-07 while the startup reconcile runs the pick button is disabled by the edit gate without a reason line (S1)', async ({
    app,
    page,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('gt'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');

    // 刷新：文档列表挂起，应用先用本机缓存（空计划）渲染，编辑门控生效
    const hold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold' });
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-gate', 'reconciling');
    await gotoGoals(page);
    await expect(page.locator('#goals .pe-empty')).toBeVisible();
    await expect(page.locator('#planSampleBtn')).toBeDisabled();
    const gated = await readCardEntry(page);
    expect([gated.sampleAriaDisabled, gated.sampleDisabled, gated.why]).toEqual([false, true, '']);

    // 对账结束：门控解除，按钮不再 disabled
    await hold.release();
    await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
    await expect(page.locator('body')).not.toHaveAttribute('data-gate');
    const open = await readCardEntry(page);
    expect([open.sampleAriaDisabled, open.sampleDisabled, open.why]).toEqual([false, false, '']);
    expect(app.fake.fulfillErrors).toEqual([]);
  });
});

// ---------- 14-03：编辑计划页的「从示例添加」（D-04、D-07、D-08） ----------
test('PLAN-07 sample items added in the plan editor go to the end of the draft collapsed and are saved only with the plan (D-04, D-07, D-08)', async ({
  app,
  page,
}) => {
  const plan: any = syntheticPlan('pe', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('pe'), plan, login: 0 });
  await openEditor(page);

  // 入口行：保存栏下面、第一个分区之前，按钮和说明都是固定短文字；计划不空也能用
  await expect(page.locator('#tab-plan .pe-tools')).toBeVisible();
  await expect(page.locator('#peSampleBtn')).toHaveText(BTN_PK_ADD);
  await expect(page.locator('#tab-plan .pe-tools-note')).toHaveText(PK_TOOLS_NOTE);

  const writesBefore = planWritesOf(app);
  await openPickerFromEditor(page);
  let pk = await readPicker(page);
  expect(pk.open).toBe(true);
  expect(pk.title).toBe(PK_TITLE_EDIT);
  expect(pk.okText).toBe(BTN_PK_OK_EDIT);
  expect(pk.checked).toEqual([]);
  expect(pk.okAriaDisabled).toBe(true);
  await expect(page.locator('#pk-desc')).toHaveText(PK_DESC_EDIT);

  // 勾一个目标组（第 3 个示例组）和一个力量项（深蹲），添加
  await pick(page, 'g:P3');
  await pick(page, 'l:squat');
  await page.locator('#pkOk').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await expectToast(page, pkDrafted(1, 1));
  await expect(page.locator('#pe-live')).toHaveText(pkLive(1, 1));

  // 草稿：原有两组在前，新组在末尾，任务和力量项都是新 id，新卡片折叠，提示行说有没保存的修改
  const ed = await readEditor(page);
  expect(ed.groups).toHaveLength(3);
  expect(ed.groups.map((g) => g.key).slice(0, 2)).toEqual(['g:g-pe1', 'g:g-pe2']);
  const added = ed.groups[2];
  expect(/^g:g-[A-Za-z0-9_-]+$/.test(added.key) && added.key !== 'g:P3').toBe(true);
  expect(added.taskKeys).toHaveLength(BUILTIN_GROUP_SIZES.P3);
  expect(added.taskKeys.every((k) => /^t:t-/.test(k))).toBe(true);
  expect(ed.lifts).toHaveLength(2);
  expect(ed.lifts[0].key).toBe('l:l-pe1');
  expect(/^l:l-/.test(ed.lifts[1].key) && ed.lifts[1].key !== 'l:squat').toBe(true);
  expect(added.expanded).toBe(false);
  expect(ed.lifts[1].expanded).toBe(false);
  expect(ed.hint).toBe(PE_HINT_DIRTY);

  // 焦点在新组的折叠开关上
  const focus = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement | null;
    return { act: a?.getAttribute('data-peact') ?? '', key: a?.getAttribute('data-pekey') ?? '' };
  });
  expect(focus).toEqual({ act: 'toggle', key: added.key });

  // 保存之前什么都没写
  expect(planWritesOf(app)).toBe(writesBefore);

  // 点「保存计划」才写入：服务器上多了一组一项，新 id，快捷词不变
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => (app.fake.lastPlan(0)?.groups ?? []).length, { message: '等待计划上传' }).toBe(3);
  const saved = app.fake.lastPlan(0);
  expect(/^g-/.test(saved.groups[2].id) && saved.groups[2].id !== 'P3').toBe(true);
  expect(saved.lifts).toHaveLength(2);
  expect(/^l-/.test(saved.lifts[1].id) && saved.lifts[1].id !== 'squat').toBe(true);
  expect(saved.presets).toEqual(plan.presets);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('PLAN-07 the picker marks sample groups and lifts whose names are already in the draft and still adds them with new ids (A5, D-08)', async ({
  app,
  page,
}) => {
  // 合成计划：一个未归档组，名称和示例第 1 组相同；一个归档组，名称和示例第 3 组相同；一个未归档力量项，名称是示例卧推的名称后面带一个空格
  const plan: any = syntheticPlan('dp', 1);
  const sampleG = SEED_PLAN.groups;
  plan.groups.push({ id: 'g-dp2', cat: sampleG[0].cat, name: sampleG[0].name, tasks: [{ id: 't-dp2x1', text: 'SYNTH-dp task 2.1' }] });
  plan.groups.push({ id: 'g-dp3', cat: sampleG[2].cat, name: sampleG[2].name, archived: true, tasks: [{ id: 't-dp3x1', text: 'SYNTH-dp task 3.1' }] });
  plan.lifts.push({ id: 'l-dp2', n: `${SEED_PLAN.lifts[0].n} `, unit: 'kg', def: 10, target: 20, note: '' });
  await app.open({ mode: 'cloud', seed: syntheticState('dp'), plan, login: 0 });
  await openEditor(page);
  await openPickerFromEditor(page);

  // 归档的同名组不算；未归档的同名组和同名力量项带标记（比较前去掉首尾空格），仍可勾选
  let pk = await readPicker(page);
  expect(pk.dup).toEqual(['g:P1', 'l:bench']);
  await expect(page.locator('dialog#sample input[data-pk="g:P1"]')).toBeEnabled();
  expect(
    await page.evaluate(() => {
      const box = document.querySelector('dialog#sample input[data-pk="g:P1"]');
      const meta = document.getElementById((box?.getAttribute('aria-describedby') ?? '').split(' ')[0]);
      return meta?.querySelector('.pk-dup')?.textContent ?? '';
    }),
  ).toBe(PK_DUP_G);

  // 勾同名的第 1 组和不同名的第 4 组，添加；再打开：本次加进草稿的也算同名
  await pick(page, 'g:P1');
  await pick(page, 'g:P4');
  await page.locator('#pkOk').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await openPickerFromEditor(page);
  pk = await readPicker(page);
  expect(pk.dup).toEqual(['g:P1', 'g:P4', 'l:bench']);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);

  // 保存：示例第 1 组的组名在计划里有两个，id 不同（副本有自己的新 id）
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);
  await expect.poll(() => (app.fake.lastPlan(0)?.groups ?? []).length, { message: '等待计划上传' }).toBe(5);
  const same = app.fake.lastPlan(0).groups.filter((g: { name: string }) => g.name === sampleG[0].name);
  expect(same).toHaveLength(2);
  expect(new Set(same.map((g: { id: string }) => g.id)).size).toBe(2);
  expect(same.every((g: { id: string }) => g.id !== 'P1')).toBe(true);
});

test('PLAN-07 the picker stops at the group and lift limits and says how many more fit, archived items not counting (A7, 12 D-17)', async ({
  app,
  page,
}) => {
  // 18 个未归档组加 1 个归档组、7 个未归档力量项加 1 个归档力量项：还能加 2 个组、1 个力量项
  const plan: any = syntheticPlan('lm', 18);
  plan.groups.push({ id: 'g-lm19', cat: '其他', name: 'SYNTH-lm archived group', archived: true, tasks: [{ id: 't-lm19x1', text: 'SYNTH-lm task 19.1' }] });
  for (let i = 2; i <= 8; i++) {
    plan.lifts.push({ id: `l-lm${i}`, n: `SYNTH-lm lift ${i}`, unit: 'kg', def: 10, target: 20, note: '', ...(i === 8 ? { archived: true } : {}) });
  }
  await app.open({ mode: 'cloud', seed: syntheticState('lm'), plan, login: 0 });
  await openEditor(page);
  await openPickerFromEditor(page);

  let pk = await readPicker(page);
  expect([pk.limG, pk.limL]).toEqual([pkLimG(2), pkLimL(1)]);
  const gKeys = ['g:P1', 'g:P2', 'g:P3', 'g:P4', 'g:P5', 'g:P6', 'g:P7'];

  // 勾满两个名额：其余 5 个目标组真 disabled；取消一个后恢复
  await pick(page, 'g:P1');
  await pick(page, 'g:P2');
  pk = await readPicker(page);
  expect(pk.disabled).toEqual(gKeys.slice(2));
  await page.locator('dialog#sample input[data-pk="g:P2"]').uncheck();
  pk = await readPicker(page);
  expect(pk.disabled.filter((k) => k.startsWith('g:'))).toEqual([]);

  // 力量项只剩 1 个名额：勾一个，其余 3 个 disabled，说明行经 aria-describedby 读出
  await pick(page, 'l:bench');
  pk = await readPicker(page);
  expect([...pk.disabled].sort()).toEqual(['l:dead', 'l:pull', 'l:squat']);
  const describedL = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLInputElement>('dialog#sample input[data-pk^="l:"]:disabled')).map((i) => i.getAttribute('aria-describedby') ?? ''),
  );
  expect(describedL).toHaveLength(3);
  expect(describedL.every((d) => d.split(' ').includes('pk-lim-l'))).toBe(true);
  await pick(page, 'g:P2');
  const describedG = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLInputElement>('dialog#sample input[data-pk^="g:"]:disabled')).map((i) => i.getAttribute('aria-describedby') ?? ''),
  );
  expect(describedG).toHaveLength(5);
  expect(describedG.every((d) => d.split(' ').includes('pk-lim-g'))).toBe(true);

  // 取消力量项、添加两个组：目标组满了，力量项还剩 1 个名额，打开时焦点落在第一个能勾的力量项
  await page.locator('dialog#sample input[data-pk="l:bench"]').uncheck();
  await page.locator('#pkOk').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await openPickerFromEditor(page);
  pk = await readPicker(page);
  expect(pk.limG).toBe(PK_FULL_G);
  expect(pk.disabled.filter((k) => k.startsWith('g:'))).toEqual(gKeys);
  expect(pk.limL).toBe(pkLimL(1));
  const firstLift = await page.evaluate(() => document.querySelector('dialog#sample input[data-pk^="l:"]')?.getAttribute('data-pk') ?? '');
  expect(pk.focusKey).toBe(firstLift);

  // 力量项也加满：两个分区都是「已满」，11 个复选框全部 disabled
  await pick(page, 'l:bench');
  await page.locator('#pkOk').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
  await openPickerFromEditor(page);
  pk = await readPicker(page);
  expect([pk.limG, pk.limL]).toEqual([PK_FULL_G, PK_FULL_L]);
  expect(pk.disabled).toHaveLength(11);
});

test.describe('plan editor sample picker with the clock under test control', () => {
  test.use({ clockMode: 'manual' });

  test('PLAN-07 sample items added in the plan editor work offline, follow the sample order and are dropped with the discarded draft (D-07)', async ({
    app,
    page,
    context,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('od'), plan: syntheticPlan('od', 1), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const status = page.locator('#status');
    const writesBefore = planWritesOf(app);

    // 断网：列表读取和单条更新被拒，记一笔让状态行进入 offline
    const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse' });
    const patchFault = app.fake.fault({ method: 'PATCH', path: ITEM_PATH, mode: 'refuse' });
    await context.setOffline(true);
    const entry = composer(page, 'w');
    await entry.type('SYNTH-od offline entry');
    await entry.submit();
    await page.clock.runFor(1_000);
    await expect(status).toHaveAttribute('data-state', 'offline');

    // 编辑页的入口断网照样可用（只改草稿）；挑选对话框的提示行没有断网档
    await openEditor(page);
    await expect(page.locator('#peSampleBtn')).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#peSampleBtn')).toBeEnabled();
    await openPickerFromEditor(page);
    let pk = await readPicker(page);
    expect([pk.hint, pk.tone]).toEqual([PK_HINT_NONE, null]);

    // 先勾力量项，再勾第 5 组、第 1 组：添加后按示例顺序追加（第 1 组在第 5 组前面），不是勾选顺序
    await pick(page, 'l:pull');
    await pick(page, 'g:P5');
    await pick(page, 'g:P1');
    pk = await readPicker(page);
    expect(pk.okAriaDisabled).toBe(false);
    await page.locator('#pkOk').click();
    await expect(page.locator('dialog#sample')).toHaveJSProperty('open', false);
    await expectToast(page, pkDrafted(2, 1));
    const ed = await readEditor(page);
    expect(ed.groups.map((g) => g.taskKeys.length)).toEqual([2, BUILTIN_GROUP_SIZES.P1, BUILTIN_GROUP_SIZES.P5]);
    expect(planWritesOf(app)).toBe(writesBefore);

    // 放弃这次修改：确认后编辑页关闭，草稿里加的项一起撤回，整条用例没有任何计划写入
    await discardPlan(page);
    expect((await readConfirm(page)).title).toBe(PE_LEAVE_TITLE);
    await confirmOk(page);
    expect((await readEditor(page)).open).toBe(false);
    expect(planWritesOf(app)).toBe(writesBefore);
    expect(app.fake.lastPlan(0).groups.map((g: { id: string }) => g.id)).toEqual(['g-od1']);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault.hits });
  });
});
