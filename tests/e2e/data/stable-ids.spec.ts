// 冻结 id 与旧备份映射的页面用例（PLAN-05）。
// 内置任务的位置 id（P<n>-<i>）自 Phase 7 起冻结在应用的 DEFAULT_PLAN 里；用户已保存的完成和截止状态靠它们对回任务。
// 本文件只读 id、个数、日期和勾选状态，不读任务文字、组名、力量名称（D-14）；期望值由 task-ids.ts 的个数和 fixture 推导。
import { test, expect } from '../../support/test';
import { answerNextDialog, chooseImportFile, jsonImportFile } from '../../support/import-file';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { mdLabel } from '../../support/expect-from-fixture';
import { gotoGoals, readGroups, readLifts, readTaskRow } from '../../support/goals';
import { expectToast } from '../../support/toast';
import { CONFIRM_IMPORT, GOAL_DONE_ON_PREFIX, TOAST_RESTORED } from '../../support/strings';
import { ALL_LIFT_IDS, BUILTIN_GROUP_SIZES } from '../../support/task-ids';

// 由 BUILTIN_GROUP_SIZES 推出的位置 id：[组号, 该组的任务 id 列表]
function frozenGroups(): Array<[string, string[]]> {
  return Object.entries(BUILTIN_GROUP_SIZES).map(([code, size]) => [
    code,
    Array.from({ length: size }, (_, i) => `${code}-${i + 1}`),
  ]);
}

test('PLAN-05 the sample plan keeps the frozen positional group and task ids', async ({ page, app }) => {
  await app.open();
  await gotoGoals(page);

  const groups = await readGroups(page);
  const expected = frozenGroups();
  expect(
    groups.map((g) => g.code),
    '目标页的组号应当依次是 P1 到 P7',
  ).toEqual(expected.map(([code]) => code));
  for (const [code, ids] of expected) {
    const group = groups.find((g) => g.code === code);
    expect(group?.taskIds, `组 ${code} 的任务 id 应当依次是位置 id`).toEqual(ids);
  }

  const lifts = await readLifts(page, ALL_LIFT_IDS);
  expect(lifts.count, '力量卡应当恰好 4 张').toBe(4);
  expect(lifts.cards.map((c) => c.fixtureId)).toEqual([...ALL_LIFT_IDS]);
});

test('PLAN-05 a legacy positional backup maps every task progress back to the same task', async ({ page, app }) => {
  const fixture = loadFixture('legacy-positional-backup.json');
  const expected = withoutSynthetic(fixture);
  await app.open({ mode: 'account', seed: loadFixture('minimal-state.json') });
  await app.expectAccountMode();

  // 先注册确认框处理，再选文件；确认框在 FileReader 的 onload 里才弹出，所以用 poll 等消息
  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, jsonImportFile('synth-legacy-positional.json', fixture));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  expect(dialogs[0]).toBe(CONFIRM_IMPORT);
  await expectToast(page, TOAST_RESTORED);
  await gotoGoals(page);

  const groups = await readGroups(page);
  const keys = Object.keys(fixture.tasks);
  expect(keys.length).toBe(38);
  for (const key of keys) {
    const m = /^(P\d+)-(\d+)$/.exec(key);
    expect(m, `旧备份的键 ${key} 应当是位置 id`).not.toBeNull();
    const [, code, pos] = m as RegExpExecArray;
    const group = groups.find((g) => g.code === code);
    // 第 i 项任务就是这个键：同一组、同一位置、同一个 id
    expect(group?.taskIds[Number(pos) - 1], `${key} 应当落在组 ${code} 的第 ${pos} 项`).toBe(key);

    const entry = fixture.tasks[key];
    const row = await readTaskRow(page, key);
    expect(row.found, `任务 ${key} 应当显示在目标页上`).toBe(true);
    if (entry.done) {
      expect(row.isdone, `任务 ${key} 应当显示为已完成`).toBe(true);
      expect(row.doneOn, `任务 ${key} 的完成日期不对`).toBe(GOAL_DONE_ON_PREFIX + mdLabel(entry.doneDate));
    } else {
      expect(row.isdone, `任务 ${key} 不应当显示为已完成`).toBe(false);
      expect(row.due, `任务 ${key} 的截止日期不对`).toBe(entry.due);
    }
  }

  // 保存下来的进度与备份完全一致
  await app.expectSaved(
    (s) => Array.isArray(s.logs) && s.logs.some((l: { id: string }) => l.id === 'synth-legacy-01'),
    '等待导入后的保存',
  );
  const saved = await app.saved();
  expect(saved.tasks).toEqual(expected.tasks);
});
