// Phase 11 的云端导入用例（IO-07、IO-08、IO-10）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 导入文件只在内存里构造（文件名以 synth- 开头），不读也不写磁盘上的任何备份；假服务器是唯一的“服务器”。
// 取消和拒绝两条用例在 manual 时钟下运行：open 之前 install，登录完成后 pauseAt，只在需要时 runFor，
// 这样“写入次数不变”不依赖真实等待。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { legacyBackup } from '../support/backup-files';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { expectedNormalize } from '../support/expect-from-fixture';
import { chooseImportFile, jsonImportFile, textImportFile } from '../support/import-file';
import { expectToast, expectToastGone } from '../support/toast';
import { FROZEN_NOW } from '../support/constants';
import {
  CONFIRM_IMPORT_TITLE,
  IMPORT_KIND_LEGACY,
  IMPORT_REPLACE_LEGACY,
  TOAST_IMPORT_BAD_FORMAT,
  TOAST_IMPORTED,
  importCurrentLine,
  importLogsLine,
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
    importCurrentLine(1),
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

test.describe('manual clock', () => {
  test.use({ clockMode: 'manual' });

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
