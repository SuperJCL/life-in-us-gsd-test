// 导入用例（IO-04、IO-05）。
// 导入文件只在内存里构造，名字一律以 synth- 开头，磁盘上不写任何文件（D-04）。
// 先注册对话框处理再选文件（D-05）：confirm 在 FileReader 的 onload 里异步弹出，所以先 expect.poll 等消息再比较。
// 期望由 expectedNormalize 推导，不读应用代码；所有用例都用账户模式开局（D-06）。
import { test, expect } from '../../support/test';
import { loadFixture } from '../../support/fixture-files';
import { answerNextDialog, chooseImportFile, jsonImportFile } from '../../support/import-file';
import { expectedNormalize, expectedTimeline } from '../../support/expect-from-fixture';
import { expectToast } from '../../support/toast';
import { gotoTimeline, readTimeline } from '../../support/timeline';
import { CAT_LANGUAGE, CATEGORY_NAMES, CONFIRM_IMPORT, FILTER_ALL, TOAST_RESTORED } from '../../support/strings';

type Log = { id: string; text: string; cat: string; date: string };

// 每次返回一份新的合成备份：两条记录（一条在冻结周内，一条在 2 月）、一条已完成的自定义待办
function syntheticBackup() {
  return {
    arrival: '2026-02-01',
    tasks: { 'c-synth-imp-1': { done: true, doneDate: '2026-03-05' } },
    custom: [{ id: 'c-synth-imp-1', group: 'P2', text: 'SYNTH-IMPORT custom todo' }],
    logs: [
      { id: 'synth-import-01', date: '2026-03-19', cat: CATEGORY_NAMES[1], text: 'SYNTH-IMPORT entry one' },
      { id: 'synth-import-02', date: '2026-02-10', cat: CAT_LANGUAGE, text: 'SYNTH-IMPORT entry two' },
    ],
    lifts: {},
    reviews: {},
    presets: {},
  };
}

test('IO-04 accepting the import confirm replaces all data with the backup', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  expect(app.backend.writes).toEqual([]);

  const payload = syntheticBackup();
  // 先注册确认框处理，再选文件（D-05）
  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, jsonImportFile('synth-import.json', payload));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  expect(dialogs[0]).toBe(CONFIRM_IMPORT);
  await expectToast(page, TOAST_RESTORED);

  await app.expectSaved((s) => s.logs.some((l: Log) => l.id === 'synth-import-01'), '等待导入后的保存');
  const saved = await app.saved();
  expect(saved).toEqual(expectedNormalize(payload));

  // 本周视图：fixture 的记录全部消失，合成记录出现在它的日期列，抵达日期是备份里的
  await expect(page.locator('#tab-wk [data-edit^="synth-full-"]')).toHaveCount(0);
  await expect(page.locator('#tab-wk [data-wday="2026-03-19"] [data-edit="synth-import-01"]')).toHaveCount(1);
  await expect(page.locator('#arrival')).toHaveValue(payload.arrival);

  // 时间线：读回等于保存后状态的推导（含完成的自定义待办和 2 月的记录）
  await gotoTimeline(page);
  await expect
    .poll(() => readTimeline(page), { message: '时间线与导入后状态的推导不一致' })
    .toEqual(expectedTimeline(saved, FILTER_ALL));
});
