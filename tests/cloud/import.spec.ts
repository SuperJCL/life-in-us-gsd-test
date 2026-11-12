// Phase 11 的云端导入用例（IO-07、IO-08、IO-10）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 导入文件只在内存里构造（文件名以 synth- 开头），不读也不写磁盘上的任何备份；假服务器是唯一的“服务器”。
// 取消和拒绝两条用例在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt，只在需要时 runFor，
// 这样“写入次数不变”不依赖真实等待。
import { test, expect } from '../support/test';
import { bulkyState, syntheticPlan, syntheticState } from '../support/cloud-data';
import { fullBackup, legacyBackup, planOnlyFile } from '../support/backup-files';
import { openDevice } from '../support/devices';
import { gotoGoals, readArchived, readGroupIds, readGroups } from '../support/goals';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { expectedNormalize } from '../support/expect-from-fixture';
import { chooseImportFile, jsonImportFile, textImportFile } from '../support/import-file';
import { expectToast, expectToastGone } from '../support/toast';
import { FROZEN_NOW } from '../support/constants';
import {
  CONFIRM_IMPORT_TITLE,
  GOAL_DONE_NO_DATE,
  IMPORT_KIND_FULL,
  IMPORT_KIND_LEGACY,
  IMPORT_KIND_PLAN,
  IMPORT_REPLACE_FULL,
  IMPORT_REPLACE_LEGACY,
  IMPORT_REPLACE_PLAN,
  IMPORT_UNDO_NOTE,
  STATUS_CLOUD_SYNCED,
  TOAST_IMPORT_BAD_FORMAT,
  TOAST_IMPORT_TOO_BIG,
  TOAST_IMPORT_TOO_LARGE,
  TOAST_IMPORTED,
  importCurrentLine,
  importLogsLine,
  importMoreLine,
  importOrphanCustomLine,
  importOrphanFileLine,
  importOrphanLegacyLine,
  importOrphanPlanLine,
  importPlanLine,
} from '../support/strings';

test('IO-08 importing a legacy backup in the cloud version asks first, replaces the records, keeps the plan and uploads to the server', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('imp'), login: 0 });
  const planBefore = app.fake.lastPlan(0);
  const stateBefore = app.fake.lastState(0);
  const writesBefore = app.fake.writes.length;
  const file = legacyBackup('imp1');

  await chooseImportFile(page, jsonImportFile('synth-legacy.json', file));
  const confirm = await readConfirm(page);
  expect(confirm.title).toBe(CONFIRM_IMPORT_TITLE);
  expect(confirm.lines).toEqual([
    IMPORT_KIND_LEGACY,
    IMPORT_REPLACE_LEGACY,
    importLogsLine(2, '2026-02-10', '2026-03-17'),
    // 文件里：一周复盘、两项完成的任务（P2-1 和自定义待办）、bench 两条力量历史
    importMoreLine(1, 2, 2),
    importCurrentLine(1),
    IMPORT_UNDO_NOTE,
  ]);
  // 点“导入”之前什么都没有写：服务器、本周视图都还是原样
  expect(app.fake.writes.length).toBe(writesBefore);
  expect(app.fake.lastState(0)).toEqual(stateBefore);

  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  await expect
    .poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成文件经 normalize 的结果' })
    .toEqual(expectedNormalize(file));
  // 计划不变（D-02）
  expect(app.fake.lastPlan(0)).toEqual(planBefore);
  // 本周视图换成文件里的记录
  await expect(page.locator('#tab-wk [data-edit="synth-imp1-1"]')).toBeVisible();
  await expect(page.locator('#tab-wk [data-edit="synthetic-imp"]')).toHaveCount(0);
  await expect(page.locator('#importJson')).toHaveValue('');
});

test('IO-08 progress that matches no task of the current plan is highlighted in the summary and dropped on import (D-07)', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('imo'), login: 0 });
  const file = legacyBackup('imp9', {
    tasks: {
      'P2-1': { done: true, doneDate: '2026-03-02' },
      'P9-9': { done: true, doneDate: '2026-03-02' },
    },
  });

  await chooseImportFile(page, jsonImportFile('synth-orphan.json', file));
  const confirm = await readConfirm(page);
  // 摘要里多出一行醒目提示，只有这一行带醒目样式
  expect(confirm.warn).toEqual([importOrphanLegacyLine(1)]);
  expect(confirm.lines.slice(-2)).toEqual([importOrphanLegacyLine(1), IMPORT_UNDO_NOTE]);

  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => Object.keys(app.fake.lastState(0)?.tasks ?? {}).includes('P2-1')).toBe(true);
  const tasks = app.fake.lastState(0).tasks as Record<string, unknown>;
  expect(Object.keys(tasks)).toContain('P2-1');
  expect(Object.keys(tasks)).not.toContain('P9-9');
});

test('IO-08 WR-01 a custom to-do whose group is not in the plan is highlighted in the summary and kept in the records', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('wr1'), login: 0 });
  // 旧备份：一条自定义待办在 P2（计划里有），一条在 P9（计划里没有）
  const file = legacyBackup('wr1', {
    custom: [
      { id: 'c-wr1-1', group: 'P2', text: 'SYNTH-wr1 todo in a known group' },
      { id: 'c-wr1-2', group: 'P9', text: 'SYNTH-wr1 todo in an unknown group' },
    ],
    tasks: { 'c-wr1-1': { done: true, doneDate: '2026-03-03' } },
  });

  await chooseImportFile(page, jsonImportFile('synth-wr1.json', file));
  const confirm = await readConfirm(page);
  expect(confirm.warn).toEqual([importOrphanCustomLine(1)]);
  expect(confirm.lines.slice(-2)).toEqual([importOrphanCustomLine(1), IMPORT_UNDO_NOTE]);

  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  // 不丢：两条待办都在服务器的记录里；目标页主列表只显示 P2 组里的那条，另一条在「已归档」区
  await expect.poll(() => app.fake.lastState(0)?.custom?.length, { message: '等待服务器拿到导入的待办' }).toBe(2);
  expect(app.fake.lastState(0).custom.map((c: any) => c.group).sort()).toEqual(['P2', 'P9']);
  await gotoGoals(page);
  const shown = (await readGroups(page)).flatMap((g) => g.taskIds);
  expect(shown).toContain('c-wr1-1');
  expect(shown).not.toContain('c-wr1-2');
  expect((await readArchived(page)).orphanIds).toContain('c-wr1-2');
});

// 计划去掉 _synthetic 标记、其余原样（normalizePlan 的结果）；用例独立写出期望值
const planLike = (p: any): any => {
  const { _synthetic, ...rest } = p;
  return rest;
};

// 新格式完整备份：计划是两个组的合成计划（组 g-fb1、g-fb2，任务 t-fb1x1 到 t-fb2x2，力量项 l-fb1）；
// 记录沿用 legacyBackup('fb1')；进度里 t-fb1x1 和自定义待办对得上新计划，P2-1（示例计划的任务）对不上
function fullBackupFile() {
  const plan = syntheticPlan('fb', 2);
  const state = legacyBackup('fb1', {
    custom: [{ id: 'c-fb1-1', group: 'g-fb1', text: 'SYNTH-fb1 custom task' }],
    tasks: {
      't-fb1x1': { done: true, doneDate: '2026-03-02' },
      'c-fb1-1': { done: true, doneDate: '2026-03-03' },
      'P2-1': { done: true, doneDate: '2026-03-04' },
    },
  });
  const { _synthetic, ...bare } = state as Record<string, unknown>;
  const expectedState = {
    ...bare,
    tasks: { 't-fb1x1': { done: true, doneDate: '2026-03-02' }, 'c-fb1-1': { done: true, doneDate: '2026-03-03' } },
  };
  return { file: fullBackup(plan, state), expectedPlan: planLike(plan), expectedState };
}

test('IO-08 importing a full backup replaces the plan and the records, uploads both and another device shows them (D-01)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('imf'), login: 0 });
  const sample = app.fake.lastPlan(0);
  const stateBefore = app.fake.lastState(0);
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await gotoGoals(second.page);
    expect((await readGroupIds(second.page))).not.toContain('g-fb1');

    const { file, expectedPlan, expectedState } = fullBackupFile();
    const writesBefore = app.fake.writes.length;
    await chooseImportFile(page, jsonImportFile('synth-full.json', file));
    const confirm = await readConfirm(page);
    expect(confirm.title).toBe(CONFIRM_IMPORT_TITLE);
    expect(confirm.lines).toEqual([
      IMPORT_KIND_FULL,
      IMPORT_REPLACE_FULL,
      importLogsLine(2, '2026-02-10', '2026-03-17'),
      importMoreLine(1, 2, 2),
      importPlanLine(2, 4, 1),
      importCurrentLine(1),
      importOrphanFileLine(1),
      IMPORT_UNDO_NOTE,
    ]);
    expect(confirm.warn).toEqual([importOrphanFileLine(1)]);
    // 点“导入”之前服务器上什么都没有变
    expect(app.fake.writes.length).toBe(writesBefore);
    expect(app.fake.lastPlan(0)).toEqual(sample);
    expect(app.fake.lastState(0)).toEqual(stateBefore);

    await confirmOk(page);
    await expectToast(page, TOAST_IMPORTED);
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 变成文件里的计划' }).toEqual(expectedPlan);
    await expect
      .poll(() => app.fake.lastState(0), { message: '等待服务器 state 变成文件记录在新计划下规范化的结果' })
      .toEqual(expectedState);
    // 先计划后记录：两次写入的先后顺序
    const kinds = app.fake.writes.slice(writesBefore).map((w) => w.path);
    expect(kinds.indexOf('journey_docs:plan')).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf('journey_docs:plan')).toBeLessThan(kinds.indexOf('journey_docs:state'));

    // 这台设备按文件里的计划显示目标页，记录换成文件里的
    await gotoGoals(page);
    const here = await readGroups(page);
    expect(await readGroupIds(page)).toEqual(['g-fb1', 'g-fb2']);
    expect([...here[0].doneIds].sort()).toEqual(['c-fb1-1', 't-fb1x1']);
    await expect(page.locator('#importJson')).toHaveValue('');

    // 另一台设备随后按导入的计划和记录显示（空闲时自动更新）
    await expect
      .poll(async () => readGroupIds(second.page), {
        message: '等待另一台设备更新计划',
        timeout: 20_000,
      })
      .toEqual(['g-fb1', 'g-fb2']);
    await second.page.getByRole('tab', { name: '本周', exact: true }).click();
    await expect(second.page.locator('#tab-wk [data-edit="synth-fb1-1"]')).toBeVisible();
    await expect(second.page.locator('#tab-wk [data-edit="synthetic-imf"]')).toHaveCount(0);
  } finally {
    await second.context.close();
  }
});

test('IO-08 importing a plan-only file replaces the plan and keeps the records (D-03)', async ({ app, page }) => {
  const logs = [1, 2, 3].map((n) => ({ id: `synthetic-ipo${n}`, date: '2026-03-17', cat: '语言', text: `合成记录 ipo${n}` }));
  await app.open({
    mode: 'cloud',
    seed: syntheticState('ipo', {
      logs,
      tasks: { 'P2-1': { done: true, doneDate: '2026-03-02' }, 'P3-1': { done: true, doneDate: '2026-03-03' } },
    }),
    login: 0,
  });
  const plan = syntheticPlan('po', 2);
  const writesBefore = app.fake.writes.length;
  const stateBefore = app.fake.lastState(0);

  await chooseImportFile(page, jsonImportFile('synth-plan-only.json', planOnlyFile(plan)));
  const confirm = await readConfirm(page);
  expect(confirm.title).toBe(CONFIRM_IMPORT_TITLE);
  // 只替换计划：没有记录行；现有的两条进度对不上新计划，醒目提示
  expect(confirm.lines).toEqual([
    IMPORT_KIND_PLAN,
    IMPORT_REPLACE_PLAN,
    importPlanLine(2, 4, 1),
    importCurrentLine(3),
    importOrphanPlanLine(2),
    IMPORT_UNDO_NOTE,
  ]);
  expect(confirm.warn).toEqual([importOrphanPlanLine(2)]);
  expect(app.fake.writes.length).toBe(writesBefore);
  expect(app.fake.lastState(0)).toEqual(stateBefore);

  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  const { _synthetic, ...expectedPlan } = plan;
  await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器 plan 变成文件里的计划' }).toEqual(expectedPlan);
  // 记录原样，对不上新计划的进度被丢弃
  await expect
    .poll(() => app.fake.lastState(0), { message: '等待服务器 state 在新计划下重新规范化' })
    .toEqual({ arrival: '', tasks: {}, custom: [], logs, lifts: {}, reviews: {}, presets: {} });
  await expect(page.locator('#tab-wk [data-edit="synthetic-ipo1"]')).toBeVisible();
  await expect(page.locator('#tab-wk [data-edit="synthetic-ipo3"]')).toBeVisible();
  await gotoGoals(page);
  expect((await readGroupIds(page))).toEqual(['g-po1', 'g-po2']);
});

test('IO-09 importing the plan first and then the legacy backup keeps every task progress (D-07)', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('imt'), login: 0 });
  // 带 P8 组和 P8-1 任务的计划（示例计划没有 P8）；文字都以 SYNTH- 开头
  const plan = {
    _synthetic: true,
    v: 1,
    presets: { lang: [], pro: [], fit: [], job: [], oth: [] },
    groups: [{ id: 'P8', cat: '语言', name: 'SYNTH-two group 8', tasks: [{ id: 'P8-1', text: 'SYNTH-two task 8.1' }] }],
    lifts: [{ id: 'l-two1', n: 'SYNTH-two lift', unit: 'kg', def: 10, target: 20, note: '' }],
    fitGoal: [1, 3],
    fitNote: 'SYNTH-two fit note',
  };
  const { _synthetic, ...expectedPlan } = plan;

  // 第一步：只含计划的文件。账号里没有任务进度，没有醒目行
  await chooseImportFile(page, jsonImportFile('synth-two-plan.json', planOnlyFile(plan)));
  const first = await readConfirm(page);
  expect(first.lines).toEqual([IMPORT_KIND_PLAN, IMPORT_REPLACE_PLAN, importPlanLine(1, 1, 1), importCurrentLine(1), IMPORT_UNDO_NOTE]);
  expect(first.warn).toEqual([]);
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  await expect.poll(() => app.fake.lastPlan(0), { message: '等待服务器拿到第一步的计划' }).toEqual(expectedPlan);
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);

  // 第二步：进度键是 P8-1 的旧备份。现在的计划里有 P8-1，所以摘要没有醒目行，进度全部保留
  const legacy = legacyBackup('two', { tasks: { 'P8-1': { done: true, doneDate: '2026-03-05' } } });
  await chooseImportFile(page, jsonImportFile('synth-two-legacy.json', legacy));
  const second = await readConfirm(page);
  expect(second.lines).toEqual([
    IMPORT_KIND_LEGACY,
    IMPORT_REPLACE_LEGACY,
    importLogsLine(2, '2026-02-10', '2026-03-17'),
    importMoreLine(1, 1, 2),
    importCurrentLine(1),
    // WR-01：备份里的自定义待办在 P2 组，第一步导入的计划只有 P8 组，所以多一行醒目提示（进度没有丢，所以仍没有任务进度的提示行）
    importOrphanCustomLine(1),
    IMPORT_UNDO_NOTE,
  ]);
  expect(second.warn).toEqual([importOrphanCustomLine(1)]);
  await confirmOk(page);
  await expect
    .poll(() => Object.keys(app.fake.lastState(0)?.tasks ?? {}), { message: '等待服务器 state 带上 P8-1 的进度' })
    .toContain('P8-1');
  expect(app.fake.lastState(0).tasks['P8-1']).toEqual({ done: true, doneDate: '2026-03-05' });
  // 计划没有被第二步改动
  expect(app.fake.lastPlan(0)).toEqual(expectedPlan);
});

test.describe('manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('IO-08 an imported plan that could not be uploaded is retried and reaches the server', async ({ app, page, guard }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('imu'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const planKey = `usj:v2:${app.fake.users[0].id}:plan`;
    const readPlanCache = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), planKey);
    const stateBefore = app.fake.lastState(0);
    const planBefore = app.fake.lastPlan(0);
    // 只拒绝计划文档那条 PATCH 一次
    const fault = app.fake.fault({
      method: 'PATCH',
      path: `/api/collections/journey_docs/records/${app.fake.docId(0, 'plan')}`,
      mode: 'refuse',
      times: 1,
    });
    const { file, expectedPlan, expectedState } = fullBackupFile();

    await chooseImportFile(page, jsonImportFile('synth-full-retry.json', file));
    await readConfirm(page);
    await confirmOk(page);
    await expectToast(page, TOAST_IMPORTED);
    await page.clock.runFor(1_000);

    // 计划没传上去：状态行不再是“已同步”，本机计划缓存仍是脏的，服务器上计划和记录都没动（不会只换一半）
    await expect.poll(() => fault.hits, { message: '等待计划那条请求被拒' }).toBe(1);
    await expect(page.locator('#status')).not.toHaveText(STATUS_CLOUD_SYNCED);
    await expect.poll(async () => (await readPlanCache())?.dirty, { message: '等待计划缓存标成脏' }).toBe(true);
    expect((await readPlanCache()).data).toEqual(expectedPlan);
    expect(app.fake.lastPlan(0)).toEqual(planBefore);
    expect(app.fake.lastState(0)).toEqual(stateBefore);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: fault.hits });

    // 自动重试：服务器拿到这份计划和记录，缓存收尾
    for (let i = 0; i < 6 && JSON.stringify(app.fake.lastState(0)) !== JSON.stringify(expectedState); i += 1) {
      await page.clock.runFor(1_000);
      await page.waitForTimeout(150);
    }
    await expect.poll(() => app.fake.lastPlan(0), { message: '等待重试后服务器拿到导入的计划' }).toEqual(expectedPlan);
    await expect.poll(() => app.fake.lastState(0), { message: '等待重试后服务器拿到导入的记录' }).toEqual(expectedState);
    await expect.poll(async () => (await readPlanCache())?.dirty, { message: '等待计划缓存不再脏' }).toBe(false);
    await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  });

  test('IO-07 a file over 5 MB is refused before it is read', async ({ app, page }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('imb'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const stateBefore = app.fake.lastState(0);
    const writesBefore = app.fake.writes.length;

    // 5 MB 加 1 字节：内容本身不是备份，被拒的原因只能是大小（读之前就拒绝）
    await chooseImportFile(page, textImportFile('synth-big.json', 'x'.repeat(5 * 1024 * 1024 + 1)));
    await expectToast(page, TOAST_IMPORT_TOO_BIG);
    await expect(page.locator('dialog#confirm[open]')).toHaveCount(0);
    await expect(page.locator('#importJson')).toHaveValue('');
    await page.clock.runFor(2_000);
    expect(app.fake.writes.length).toBe(writesBefore);
    expect(app.fake.lastState(0)).toEqual(stateBefore);
    await expect(page.locator('#tab-wk [data-edit="synthetic-imb"]')).toBeVisible();
  });

  test('IO-07 a backup whose data exceeds the cloud limit is refused and nothing is uploaded', async ({ app, page }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('imz'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const stateBefore = app.fake.lastState(0);
    const writesBefore = app.fake.writes.length;
    // 文件本身小于 5 MB，数据超过 4 MB 的云端容量上限
    const big = bulkyState('imp-cap', 4_300_000);
    const text = JSON.stringify(big);
    expect(Buffer.byteLength(text)).toBeLessThan(5 * 1024 * 1024);
    expect(Buffer.byteLength(text)).toBeGreaterThan(4 * 1024 * 1024);

    await chooseImportFile(page, textImportFile('synth-over-cap.json', text));
    await expectToast(page, TOAST_IMPORT_TOO_LARGE);
    await expect(page.locator('dialog#confirm[open]')).toHaveCount(0);
    await expect(page.locator('#importJson')).toHaveValue('');
    await page.clock.runFor(2_000);
    expect(app.fake.writes.length).toBe(writesBefore);
    expect(app.fake.lastState(0)).toEqual(stateBefore);
    await expect(page.locator('#tab-wk [data-edit="synthetic-imz"]')).toBeVisible();
  });

  test('IO-10 cancelling the cloud import leaves the data unchanged and the same file can be chosen again', async ({ app, page }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('imc'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const stateBefore = app.fake.lastState(0);
    const writesBefore = app.fake.writes.length;
    const file = jsonImportFile('synth-cancel.json', legacyBackup('imc1'));

    await chooseImportFile(page, file);
    await readConfirm(page);
    await confirmCancel(page);
    await page.clock.runFor(2_000);
    expect(app.fake.writes.length).toBe(writesBefore);
    expect(app.fake.lastState(0)).toEqual(stateBefore);
    await expect(page.locator('#importJson')).toHaveValue('');
    await expect(page.locator('#tab-wk [data-edit="synthetic-imc"]')).toBeVisible();

    // 取消之后再选同一个文件，确认框再次出现
    await chooseImportFile(page, file);
    const again = await readConfirm(page);
    expect(again.title).toBe(CONFIRM_IMPORT_TITLE);
    await confirmCancel(page);
    await page.clock.runFor(2_000);
    expect(app.fake.writes.length).toBe(writesBefore);
    expect(app.fake.lastState(0)).toEqual(stateBefore);
    await expect(page.locator('#importJson')).toHaveValue('');
  });

  test('IO-07 the cloud version rejects an empty JSON object with the format error and changes nothing', async ({ app, page }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('imr'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const stateBefore = app.fake.lastState(0);
    const writesBefore = app.fake.writes.length;
    const rejected = [
      jsonImportFile('synth-empty-object.json', {}),
      jsonImportFile('synth-empty-array.json', []),
      textImportFile('synth-not-json.json', 'this is not json'),
      // 带 format 键的对象在任何约定格式下都不合格（11-02 之后这条仍成立）
      jsonImportFile('synth-format-key.json', { format: 2 }),
    ];

    for (const file of rejected) {
      await chooseImportFile(page, file);
      await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
      await expect(page.locator('dialog#confirm[open]')).toHaveCount(0);
      await expect(page.locator('#importJson')).toHaveValue('');
      // 让提示消失，下一个文件的提示才是新的
      await page.clock.runFor(4_500);
      await expectToastGone(page);
    }

    await page.clock.runFor(2_000);
    expect(app.fake.writes.length).toBe(writesBefore);
    expect(app.fake.lastState(0)).toEqual(stateBefore);
    await expect(page.locator('#tab-wk [data-edit="synthetic-imr"]')).toBeVisible();
  });
});

test('IO-08 CR-01 a backup with a done task and no doneDate imports, the goals view renders it and the account still opens after a reload', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('cr1'), login: 0 });
  // 合成旧备份：P2-1 已完成但没有 doneDate（手改的文件会这样），自定义待办也是
  const file = legacyBackup('cr1', {
    tasks: { 'P2-1': { done: true }, 'c-cr1-1': { done: true } },
  });

  await chooseImportFile(page, jsonImportFile('synth-cr1.json', file));
  await readConfirm(page);
  await confirmOk(page);
  // 以前这里 renderGoals 抛 TypeError：toast 和撤销入口都不出现
  await expectToast(page, TOAST_IMPORTED);
  await expect(page.locator('#undoImportBtn')).toBeVisible();
  await expect
    .poll(() => app.fake.lastState(0)?.tasks?.['P2-1'], { message: '等待服务器拿到导入的进度' })
    .toEqual({ done: true, doneDate: '' });
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);

  await gotoGoals(page);
  const groups = await readGroups(page);
  expect(groups.flatMap((g) => g.doneIds)).toEqual(expect.arrayContaining(['P2-1', 'c-cr1-1']));
  await expect(page.locator('#goals .task:has([data-task="P2-1"]) .meta')).toHaveText(GOAL_DONE_NO_DATE);

  // 刷新之后账号照常打开（以前每次加载都在 enterApp 里抛错，落到登录页的“网络错误”）
  await app.reload();
  await gotoGoals(page);
  expect((await readGroups(page)).flatMap((g) => g.doneIds)).toEqual(expect.arrayContaining(['P2-1', 'c-cr1-1']));
});
