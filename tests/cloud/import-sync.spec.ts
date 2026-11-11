// Phase 11-04 的导入与同步规则用例（IO-08、IN-05、IN-06）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// “另一台设备的写入”用 app.fake.request 以 writer 'synth-other' 直接改假服务器上的文档（不开第二个浏览器）；
// 要让页面“没听到”这次写入，先对本页 refuseRealtime 加 dropRealtime，导入的上传才会撞上别处写的新版本（真冲突，Phase 10 D-03）。
// 导入文件只在内存里构造（文件名以 synth- 开头）；除 IN-05 外都在 manual 时钟下运行：open 之前 install，登录后 pauseAt，需要时 runFor。
// 同一个浏览器两个标签页的计划采纳由 11-05 加进这个文件。
import { readFile } from 'node:fs/promises';
import { test, expect, type Page } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import type { AppHarness } from '../support/app';
import { composer } from '../support/composer';
import { fullBackup, legacyBackup, planOnlyFile } from '../support/backup-files';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { expectedNormalize } from '../support/expect-from-fixture';
import { chooseImportFile, jsonImportFile, textImportFile } from '../support/import-file';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
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

async function openManual(app: App, page: Page, label: string, extra: { plan?: unknown } = {}) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState(label), plan: extra.plan, login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
}

// 导入：选文件、读摘要、点“导入”
async function importAndConfirm(page: Page, name: string, value: unknown) {
  await chooseImportFile(page, jsonImportFile(name, value));
  await readConfirm(page);
  await confirmOk(page);
}

test('IO-08 an import made while a remote update waits replaces it and uploads the imported data (IN-05)', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('ins'), login: 0 });
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
