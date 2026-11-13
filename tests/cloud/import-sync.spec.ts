// Phase 11-04 的导入与同步规则用例（IO-08、IN-05、IN-06）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// “另一台设备的写入”用 app.fake.request 以 writer 'synth-other' 直接改假服务器上的文档（不开第二个浏览器）；
// 要让页面“没听到”这次写入，先对本页 refuseRealtime 加 dropRealtime，导入的上传才会撞上别处写的新版本（真冲突，Phase 10 D-03）。
// 导入文件只在内存里构造（文件名以 synth- 开头）；除 IN-05 外都在 manual 时钟下运行：open 之前 install，登录后 pauseAt，需要时 runFor。
// 同一个浏览器两个标签页的计划采纳（11-05）：一个标签页导入，另一个标签页走 storage 事件按新计划显示；两页共用真实计时，不用 manual 时钟。
import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { loadAppPure } from '../support/app-source';
import { AppHarness } from '../support/app';
import { fullBackup, legacyBackup, planOnlyFile } from '../support/backup-files';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { expectedNormalize } from '../support/expect-from-fixture';
import { chooseImportFile, jsonImportFile, textImportFile } from '../support/import-file';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { gotoGoals, readGroups } from '../support/goals';
import { expectToast } from '../support/toast';
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_FULL, BACKUP_KIND_PLAN, FROZEN_NOW } from '../support/constants';
import {
  BANNER_REMOTE,
  CATEGORY_NAMES,
  FILENAME_SNAPSHOT_FROZEN,
  IMPORT_KIND_FULL,
  STATUS_CLOUD_SYNCED,
  TOAST_CONFLICT,
  TOAST_IMPORTED,
  TOAST_REMOTE_UPDATED,
} from '../support/strings';

type App = AppHarness;
type Log = { id: string; text: string };

const OTHER = 'synth-other';
const LIST_PATH = '/api/collections/journey_docs/records';
const recordPath = (app: App, kind: 'state' | 'plan') => `${LIST_PATH}/${app.fake.docId(0, kind)}`;
const planLike = (p: any): any => {
  const { _synthetic, ...rest } = p;
  return rest;
};
const ids = (logs: Log[] | undefined) => (logs ?? []).map((l) => l.id).sort();
const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

// 另一台设备在服务器上写 state：在当前内容上加一条合成记录
async function otherAddsLog(app: App, id: string, text: string) {
  const st = app.fake.lastState(0);
  st.logs.push({ id, date: '2026-03-17', cat: CATEGORY_NAMES[0], text });
  const res = await app.fake.request(0, 'PATCH', recordPath(app, 'state'), { data: st, writer: OTHER });
  expect(res.status).toBe(200);
}

// 另一台设备在服务器上写计划
async function otherWritesPlan(app: App, plan: unknown) {
  const res = await app.fake.request(0, 'PATCH', recordPath(app, 'plan'), { data: plan, writer: OTHER });
  expect(res.status).toBe(200);
}

const readJson = (page: Page, key: string) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
const snapKeys = (page: Page) => page.evaluate(() => Object.keys(localStorage).filter((x) => x.endsWith(':snapshot')));

// 登录后让页面听不到另一台设备（拒绝并断开实时连接）；manual 时钟已经 pauseAt
async function deaf(app: App, page: Page) {
  app.fake.refuseRealtime(true, page);
  await app.fake.dropRealtime(page);
}

// 这个账号代表 Phase 14 之前建的、带示例计划的账号：旧备份和导入文件里的 P2-1、bench 等进度要对上示例计划。
// Phase 14 起新账号首次登录是空计划（D-01），所以这里显式放示例计划文档（写法抄 login.spec.ts）。
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));

async function openManual(app: App, page: Page, label: string, extra: { plan?: unknown } = {}) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState(label), plan: extra.plan === undefined ? SEED_PLAN : extra.plan, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
}

// 导入：选文件、读摘要、点“导入”
async function importAndConfirm(page: Page, name: string, value: unknown) {
  await chooseImportFile(page, jsonImportFile(name, value));
  await readConfirm(page);
  await confirmOk(page);
}

test('IO-08 an import made while a remote update waits replaces it and uploads the imported data (IN-05)', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('ins'), plan: SEED_PLAN, login: 0 });
  // 本周 composer 里写着没提交的草稿：页面忙，别的设备的更新只会挂起、显示横幅
  const draft = 'SYNTH-1105 draft in progress';
  const entry = composer(page, 'w');
  await entry.type(draft);
  await expect(entry.text).toBeFocused();

  await otherAddsLog(app, 'synthetic-other-ins', 'SYNTH-1105 remote record');
  const bar = page.locator('#syncbar');
  await expect(bar).toBeVisible();
  await expect(bar.locator('.sb-msg')).toHaveText(BANNER_REMOTE);

  const file = legacyBackup('ins1');
  await chooseImportFile(page, jsonImportFile('synth-pending.json', file));
  await readConfirm(page);
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);

  // 横幅消失；服务器上是文件经 normalize 的结果，没有那次远端更新，也不是“远端加导入”
  await expect(bar).not.toBeVisible();
  await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));
  expect(hasText(app.fake.lastState(0).logs, 'SYNTH-1105 remote record')).toBe(false);
  expect(await entry.draft()).toBe(draft);
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
});

test.describe('manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('IO-08 an import whose upload meets a newer version from another device keeps that version as a snapshot instead of redoing on it', async ({
    app,
    page,
  }) => {
    await openManual(app, page, 'isc');
    await deaf(app, page);
    await otherAddsLog(app, 'synthetic-other-isc', 'SYNTH-1106 other device record');

    const file = legacyBackup('isc1');
    await importAndConfirm(page, 'synth-conflict.json', file);
    await expectToast(page, TOAST_IMPORTED);
    await page.clock.runFor(1_000);

    // 以导入的内容为准，不是“另一台设备的记录加导入”
    await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));
    await expectToast(page, TOAST_CONFLICT);
    await expect(page.locator('#snapshotBtn')).toBeVisible();
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const snap = await readJson(page, key);
    expect(snap.kind).toBe('state');
    expect(hasText(snap.data.logs, 'SYNTH-1106 other device record')).toBe(true);
    expect(await snapKeys(page)).toEqual([key]);
  });

  test('IO-08 WR-03 an import made while an upload is in flight is not redone on a newer version from another device afterwards', async ({
    app,
    page,
  }) => {
    await openManual(app, page, 'isw');
    await deaf(app, page);

    // 一次上传在途：记一笔，推过防抖窗口，让 state 的 PATCH 挂在假服务器上
    const patchHold = app.fake.fault({ method: 'PATCH', path: recordPath(app, 'state'), mode: 'hold', times: 1 });
    const entry = composer(page, 'w');
    await entry.type('SYNTH-WR03 record in flight');
    await entry.submit();
    await page.clock.runFor(1_000);
    await expect.poll(() => patchHold.hits, { message: '等待上传被挂起' }).toBe(1);

    // 上传还没返回时导入（导入的操作排在这次上传的快照之后）
    const file = legacyBackup('isw1');
    await importAndConfirm(page, 'synth-inflight.json', file);
    await expectToast(page, TOAST_IMPORTED);

    // 放行上传；它收尾之后紧接着的下一轮同步，列表请求也先挂住，另一台设备趁这个空档写入
    const listHold = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'hold', times: 1 });
    await patchHold.release();
    await expect.poll(() => listHold.hits, { message: '等待下一轮同步的列表请求' }).toBe(1);
    await otherAddsLog(app, 'synthetic-other-isw', 'SYNTH-WR03 other device record');
    await listHold.release();
    await page.clock.runFor(1_000);

    // 导入整份胜出，另一台设备的版本按平常的冲突留底（以前被静默替掉，没有留底，也没有提示）
    await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));
    await expectToast(page, TOAST_CONFLICT);
    await expect(page.locator('#snapshotBtn')).toBeVisible();
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const snap = await readJson(page, key);
    expect(snap.kind).toBe('state');
    expect(hasText(snap.data.logs, 'SYNTH-WR03 other device record')).toBe(true);
  });

  test('IO-08 a plan import whose upload meets a newer plan from another device keeps that plan as a snapshot', async ({ app, page }) => {
    await openManual(app, page, 'isp');
    await deaf(app, page);
    const otherPlan = syntheticPlan('opx', 2);
    await otherWritesPlan(app, otherPlan);

    const planA = syntheticPlan('ipx', 2);
    await importAndConfirm(page, 'synth-plan-conflict.json', planOnlyFile(planA));
    await expectToast(page, TOAST_IMPORTED);
    await page.clock.runFor(1_000);

    await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 变成文件里的计划' }).toEqual(planLike(planA));
    await expectToast(page, TOAST_CONFLICT);
    await expect(page.locator('#snapshotBtn')).toBeVisible();
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const snap = await readJson(page, key);
    expect(snap.kind).toBe(BACKUP_KIND_PLAN);
    expect(snap.data).toEqual(planLike(otherPlan));
    expect(await snapKeys(page)).toEqual([key]);
  });

  test.describe('downloads', () => {
    test.use({ acceptDownloads: true });

    test('IO-08 an import whose plan and records both meet newer versions from another device keeps both in one snapshot that imports back as a full backup', async ({
      app,
      page,
    }) => {
      await openManual(app, page, 'isb');
      await deaf(app, page);
      const otherPlan = syntheticPlan('obx', 2);
      await otherWritesPlan(app, otherPlan);
      await otherAddsLog(app, 'synthetic-other-isb', 'SYNTH-1108 other device record');

      const planA = syntheticPlan('ibx', 2);
      const fileState = legacyBackup('isb1', { tasks: {}, custom: [] });
      await importAndConfirm(page, 'synth-both-conflict.json', fullBackup(planA, fileState));
      await expectToast(page, TOAST_IMPORTED);
      await page.clock.runFor(1_000);

      // 服务器上是导入的计划和记录
      await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 变成文件里的计划' }).toEqual(planLike(planA));
      await expect.poll(() => ids(app.fake.lastState(0)?.logs), { message: '等待服务器 state 变成导入的记录' }).toEqual(
        ['synth-isb1-1', 'synth-isb1-2'],
      );
      await expectToast(page, TOAST_CONFLICT);
      await expect(page.locator('#snapshotBtn')).toBeVisible();

      // 本机只有一份留底，装着另一台设备的计划和记录：新格式完整备份的包装
      const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
      expect(await snapKeys(page)).toEqual([key]);
      const snap = await readJson(page, key);
      expect(snap.kind).toBe(BACKUP_KIND_FULL);
      expect(Object.keys(snap.data)).toEqual(['app', 'format', 'kind', 'exportedAt', 'plan', 'state']);
      expect(snap.data.app).toBe(BACKUP_APP);
      expect(snap.data.format).toBe(BACKUP_FORMAT);
      expect(snap.data.kind).toBe(BACKUP_KIND_FULL);
      expect(snap.data.plan).toEqual(planLike(otherPlan));
      expect(hasText(snap.data.state.logs, 'SYNTH-1108 other device record')).toBe(true);

      // 下载的是同一份：文件名沿用留底前缀，按完整备份能导回（点“不导入”取消）
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#snapshotBtn').click()]);
      expect(download.suggestedFilename()).toBe(FILENAME_SNAPSHOT_FROZEN);
      const text = await readFile(await download.path(), 'utf-8');
      await download.delete();
      expect(text).not.toContain(app.fake.users[0].email);
      await expect.poll(() => snapKeys(page), { message: '下载后本机留底应当已删除' }).toEqual([]);
      await expect(page.locator('#snapshotBtn')).toBeHidden();

      await chooseImportFile(page, textImportFile('synth-snapshot-back.json', text));
      const confirm = await readConfirm(page);
      expect(confirm.lines[0]).toBe(IMPORT_KIND_FULL);
      await confirmCancel(page);
    });
  });

  test("IO-08 a snapshot not yet announced keeps the other device's plan when the records upload has to be retried", async ({ app, page, guard }) => {
    await openManual(app, page, 'isr');
    await deaf(app, page);
    const otherPlan = syntheticPlan('orx', 2);
    await otherWritesPlan(app, otherPlan);
    await otherAddsLog(app, 'synthetic-other-isr', 'SYNTH-1109 other device record');
    // 只拒绝 state 文档那条 PATCH 一次：计划上传成功，记录上传第一次被拒
    const fault = app.fake.fault({ method: 'PATCH', path: recordPath(app, 'state'), mode: 'refuse', times: 1 });

    const planA = syntheticPlan('irx', 2);
    await importAndConfirm(page, 'synth-retry-conflict.json', fullBackup(planA, legacyBackup('isr1', { tasks: {}, custom: [] })));
    await expectToast(page, TOAST_IMPORTED);
    await page.clock.runFor(1_000);
    await expect.poll(() => fault.hits, { message: '等待记录那条请求被拒' }).toBe(1);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: fault.hits });

    // 第一轮：计划已经上传，留底已是合成的一份（plan 是另一台设备的计划），还没有提示
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待第一轮的计划上传' }).toEqual(planLike(planA));
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const first = await readJson(page, key);
    expect(first.kind).toBe(BACKUP_KIND_FULL);
    expect(first.data.plan).toEqual(planLike(otherPlan));
    expect(hasText(first.data.state.logs, 'SYNTH-1109 other device record')).toBe(true);
    await expect(page.locator('#snapshotBtn')).toBeHidden();
    expect(await snapKeys(page)).toEqual([key]);

    // 自动重试：第二轮只剩记录冲突，留底仍是合成的一份，计划仍是另一台设备的计划；上传成功之后才提示
    for (let i = 0; i < 8 && ids(app.fake.lastState(0)?.logs).join() !== 'synth-isr1-1,synth-isr1-2'; i += 1) {
      await page.clock.runFor(1_000);
      await page.waitForTimeout(150);
    }
    await expect.poll(() => ids(app.fake.lastState(0)?.logs), { message: '等待重试后服务器拿到导入的记录' }).toEqual(['synth-isr1-1', 'synth-isr1-2']);
    await expectToast(page, TOAST_CONFLICT);
    await expect(page.locator('#snapshotBtn')).toBeVisible();
    expect(await snapKeys(page)).toEqual([key]);
    const second = await readJson(page, key);
    expect(second.kind).toBe(BACKUP_KIND_FULL);
    expect(second.data.plan).toEqual(planLike(otherPlan));
    expect(hasText(second.data.state.logs, 'SYNTH-1109 other device record')).toBe(true);
  });

  test('IO-08 imported record ids are kept and the next pull shows no remote update (IN-06)', async ({ app, page }) => {
    await openManual(app, page, 'isi');
    const file = legacyBackup('isi1');
    await importAndConfirm(page, 'synth-ids.json', file);
    await expectToast(page, TOAST_IMPORTED);
    await page.clock.runFor(1_000);
    await expect.poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成导入的内容' }).toEqual(expectedNormalize(file));
    await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);

    // 记录 id 就是文件里的 id
    expect(ids(app.fake.lastState(0).logs)).toEqual(file.logs.map((l) => l.id).sort());

    // 60 秒拉取跑一次：每一步看一眼提示和横幅（4 秒的提示不会在一大步里悄悄走完），写入次数不变
    const writes = app.fake.writes.length;
    const reads = app.fake.reads.length;
    for (let i = 0; i < 65; i += 1) {
      await page.clock.runFor(1_000);
      const toast = await page.evaluate(() => {
        const t = document.querySelector('#toast');
        return t && t.classList.contains('on') ? (t.querySelector('span')?.textContent ?? '') : '';
      });
      expect(toast).not.toBe(TOAST_REMOTE_UPDATED);
      expect(await page.locator('#syncbar').isVisible()).toBe(false);
    }
    expect(app.fake.reads.length).toBeGreaterThan(reads);
    expect(app.fake.writes.length).toBe(writes);
    await expect(page.locator('#syncbar')).not.toBeVisible();
  });
});

test('IO-08 an import in one tab reaches the other tab of the same browser without losing progress of the new plan', async ({ app, page, context }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('tab'), login: 0 });
  const other = await context.newPage();
  try {
    await new AppHarness(other, { fake: app.fake }).open({ mode: 'cloud', login: 'session' });

    // 新计划两个组、三个任务，文件里三个任务都有进度（t- 开头的 id 只在新计划里存在）
    const plan = syntheticPlan('tpx', 2);
    const progress = {
      't-tpx1x1': { done: true, doneDate: '2026-03-02' },
      't-tpx1x2': { done: true, doneDate: '2026-03-03' },
      't-tpx2x1': { done: true, doneDate: '2026-03-04' },
    };
    const taskIds = Object.keys(progress).sort();
    const file = legacyBackup('tab1', { tasks: progress, custom: [] });
    const writesBefore = app.fake.writes.length;

    await importAndConfirm(page, 'synth-two-tabs.json', fullBackup(plan, file));
    await expectToast(page, TOAST_IMPORTED);

    // 另一个标签页按新计划显示，三条进度都在（等待用真实计时：补传宽限 5 秒）
    await gotoGoals(other);
    await expect
      .poll(async () => (await readGroups(other)).length, { message: '等待另一个标签页换成新计划', timeout: 15_000 })
      .toBe(2);
    await expect
      .poll(async () => (await readGroups(other)).flatMap((g) => g.doneIds).sort(), { message: '等待另一个标签页显示新计划任务的进度', timeout: 15_000 })
      .toEqual(taskIds);

    // 它的本机 state 缓存里也有这些进度
    const stateKey = `usj:v2:${app.fake.users[0].id}:state`;
    await expect
      .poll(async () => Object.keys((await readJson(other, stateKey))?.data?.tasks ?? {}).sort(), { message: '等待另一个标签页的缓存含新计划的进度', timeout: 15_000 })
      .toEqual(expect.arrayContaining(taskIds));

    // 服务器上是新计划和全部进度；两个标签页都同步完
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 变成文件里的计划', timeout: 15_000 }).toEqual(planLike(plan));
    await expect
      .poll(() => Object.keys(app.fake.lastState(0)?.tasks ?? {}).sort(), { message: '等待服务器 state 含全部进度', timeout: 15_000 })
      .toEqual(expect.arrayContaining(taskIds));
    await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED, { timeout: 15_000 });
    await expect(other.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED, { timeout: 15_000 });

    // 再等一会儿：补传宽限过了之后，服务器收到的每一次 state 写入都保留这些进度，最后一次写入也是
    await page.waitForTimeout(1_500);
    const stateWrites = app.fake.writes.slice(writesBefore).filter((w) => w.path === 'journey_docs:state');
    expect(stateWrites.length).toBeGreaterThan(0);
    for (const w of stateWrites) expect(Object.keys(w.data?.tasks ?? {}).sort()).toEqual(expect.arrayContaining(taskIds));
    expect(Object.keys(app.fake.lastState(0).tasks).sort()).toEqual(expect.arrayContaining(taskIds));
  } finally {
    await other.close();
  }
});
