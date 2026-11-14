// 云端 tracer（FIT-05）：健身页保存的训练按「wo:<日期>」上传到服务器 state 文档，同账号第二台设备的本周页有同一行。
// 只用 FakePbServer 的合成账号和合成数据；动作名（合成的 SYNTH-fs 力量项）只做相等比较，不拼进失败消息。
import { test, expect } from '../support/test';
import { openDevice } from '../support/devices';
import { FROZEN_TODAY } from '../support/constants';
import {
  CONFIRM_IMPORT_TITLE,
  IMPORT_KIND_FULL,
  IMPORT_KIND_LEGACY,
  IMPORT_REPLACE_FULL,
  IMPORT_REPLACE_LEGACY,
  IMPORT_UNDO_NOTE,
  TAB_LABELS,
  TOAST_IMPORTED,
  TOAST_UNDONE,
  fitRow,
  importCurrentLine,
  importLogsLine,
  importMoreLine,
  importPlanLine,
  importWoLine,
} from '../support/strings';
import { downloadOf } from '../support/download';
import { fullBackup, legacyBackup } from '../support/backup-files';
import { confirmCancel, confirmOk, readConfirm } from '../support/confirm';
import { chooseImportFile, jsonImportFile } from '../support/import-file';
import { expectToast } from '../support/toast';
import { flAddLift, flFillSet, flSave, gotoFitness, readWeekWo } from '../support/fitness';
import { syntheticPlan, syntheticState } from '../support/cloud-data';

test.use({ acceptDownloads: true });

test('FIT-05 a training saved on the fitness tab is uploaded under its per-day key and shows in the week view of another device of the same account', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const seed = syntheticState('fs');
  await app.open({ mode: 'cloud', seed, plan: syntheticPlan('fs', 1), login: 0 });

  // 记下每次写缓存时带的 touched，免得和上传抢时间（上传后 touched 会清空）
  const cacheKey = `usj:v2:${app.fake.users[0].id}:state`;
  await page.evaluate((k) => {
    const seen: string[] = [];
    (window as any).__touchedSeen = seen;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === k) {
        try {
          const t = JSON.parse(value).touched;
          if (Array.isArray(t)) seen.push(...t);
        } catch {
          /* 只记录，不影响写入 */
        }
      }
      return orig.call(this, key, value);
    };
  }, cacheKey);

  await gotoFitness(page);
  await flAddLift(page, 'l-fs1');
  await flFillSet(page, 'l-fs1', 0, '30', '5');
  await flSave(page);

  const expected = { [FROZEN_TODAY]: { lifts: [{ id: 'l-fs1', sets: [{ w: 30, r: 5 }] }], cardio: [] } };
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待训练上传到 state 文档' })
    .toBe(JSON.stringify(expected));
  expect((app.fake.lastState(0).logs as unknown[]).length).toBe(seed.logs.length);
  const touched = await page.evaluate(() => (window as any).__touchedSeen as string[]);
  expect(touched).toContain(`wo:${FROZEN_TODAY}`);

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await expect(second.page.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`)).toBeVisible();
    const row = await readWeekWo(second.page, FROZEN_TODAY);
    expect(row !== null && row.text === fitRow('SYNTH-fs lift（共 1 组）')).toBe(true);
  } finally {
    await second.context.close();
  }
});

test('FIT-05 a JSON backup carries the trainings, and importing a full backup with trainings in the cloud version shows the training days in the summary, replaces the trainings and can be undone (IO-08)', async ({
  app,
  page,
}) => {
  const plan = syntheticPlan('fi', 2);
  const own = {
    '2026-03-10': { lifts: [{ id: 'l-fi1', sets: [{ w: 20, r: 5 }] }], cardio: [] },
    '2026-03-12': { lifts: [{ id: 'l-fi1', sets: [{ w: 22, r: 5 }, { w: 22, r: 4 }] }], cardio: [] },
  };
  const seed = { ...syntheticState('fi'), workouts: own };
  await app.open({ mode: 'cloud', seed, plan, login: 0 });
  await expect.poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null)).toBe(JSON.stringify(own));

  // 下载的 JSON 备份：state.workouts 等于服务器上的
  const { text } = await downloadOf(page, () => page.locator('#exportJson').click());
  const backup = JSON.parse(text);
  expect(backup.kind, 'full backup').toBe('full');
  expect(backup.state.workouts, 'the backup carries the trainings of the account').toEqual(app.fake.lastState(0).workouts);
  expect(Object.keys(backup.state.workouts), 'two training days in the file').toEqual(['2026-03-10', '2026-03-12']);

  // 另造一份完整备份：同一份计划，训练只有 2026-03-15 一天（不在冻结周里），两条文字记录
  const incoming = { '2026-03-15': { lifts: [{ id: 'l-fi1', sets: [{ w: 25, r: 6 }] }], cardio: [] } };
  const file = fullBackup(plan, legacyBackup('fiw', { tasks: {}, custom: [], lifts: {}, workouts: incoming }));
  await chooseImportFile(page, jsonImportFile('synth-with-workouts.json', file));
  const confirm = await readConfirm(page);
  expect(confirm.title).toBe(CONFIRM_IMPORT_TITLE);
  expect(confirm.lines, 'summary has the training days line right after the counts line').toEqual([
    IMPORT_KIND_FULL,
    IMPORT_REPLACE_FULL,
    importLogsLine(2, '2026-02-10', '2026-03-17'),
    importMoreLine(1, 0, 0),
    importWoLine(1),
    importPlanLine(2, 4, 1),
    importCurrentLine(seed.logs.length),
    IMPORT_UNDO_NOTE,
  ]);
  expect(JSON.stringify(app.fake.lastState(0).workouts), 'nothing is replaced before confirming').toBe(JSON.stringify(own));

  // 确认：服务器上的训练只剩 03-15；本周页没有这一行（不在本周），时间线有
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待服务器训练换成文件里的' })
    .toBe(JSON.stringify(incoming));
  expect(await readWeekWo(page, '2026-03-15'), 'the imported training is outside the visible week').toBeNull();
  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-15"]')).toHaveCount(1);
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-12"]')).toHaveCount(0);

  // 撤销导入：服务器上的训练回到导入前的两天
  await page.locator('#undoImportBtn').click();
  await expectToast(page, TOAST_UNDONE);
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待服务器训练回到导入前' })
    .toBe(JSON.stringify(own));
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-12"]')).toHaveCount(1);
  await expect(page.locator('#timeline .tl-item.wo[data-wo="2026-03-15"]')).toHaveCount(0);

  // 没有训练的旧备份：摘要里没有训练那一行（行数和以前一样）
  await chooseImportFile(page, jsonImportFile('synth-no-workouts.json', legacyBackup('fio', { tasks: {}, custom: [], lifts: {} })));
  const legacy = await readConfirm(page);
  expect(legacy.lines, 'a backup without trainings has no training line').toEqual([
    IMPORT_KIND_LEGACY,
    IMPORT_REPLACE_LEGACY,
    importLogsLine(2, '2026-02-10', '2026-03-17'),
    importMoreLine(1, 0, 0),
    importCurrentLine(seed.logs.length),
    IMPORT_UNDO_NOTE,
  ]);
  await confirmCancel(page);
  expect(JSON.stringify(app.fake.lastState(0).workouts), 'cancelling keeps the trainings').toBe(JSON.stringify(own));
});
