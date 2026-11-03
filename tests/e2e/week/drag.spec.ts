// 本文件覆盖 WEEK-05：把记录拖到另一天（D-02）。
// 拖放方案按 D-02 的顺序尝试：先 dragTo（steps: 10，真实指针路径）；PROBE-5 已证明可行，
// 本用例在账户模式加完整 fixture 下沿用，不需要改用手动鼠标序列或合成事件。结论见 tests/PROBES.md。
// 结果以保存后的状态里记录的 date 为准，不只看 DOM。
// 源是合成记录，目标是日期列（属性只有日期、条数和固定文案）；完成的内置计划条目带个人计划原文，
// 本文件对它们只做计数（D-14）。
import { test, expect } from '../../support/test';
import { loadFixture } from '../../support/fixture-files';
import { mdLabel } from '../../support/expect-from-fixture';
import { expectToast } from '../../support/toast';
import { TOAST_MOVED_PREFIX } from '../../support/strings';

test('WEEK-05 dragging an entry to another day changes its saved date', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const id = 'synth-full-01';
  const fromDay = '2026-03-16';
  const toDay = '2026-03-19';
  const source = page.locator(`#tab-wk [data-wday="${fromDay}"] [data-edit="${id}"]`);
  const target = page.locator(`#tab-wk [data-wday="${toDay}"]`);
  await expect(source).toHaveCount(1);

  // 方案 A：dragTo（真实指针路径，steps: 10）
  await source.dragTo(target, { steps: 10 });

  // 拖放后 toast 提示新日期
  await expectToast(page, TOAST_MOVED_PREFIX + mdLabel(toDay));

  // 保存后的状态里这条记录的 date 变了，其余记录的 date 都没变（布尔，不打印内容）
  const dateOf = new Map<string, string>(fixture.logs.map((l: { id: string; date: string }) => [l.id, l.date]));
  await app.expectSaved((s) =>
    s.logs.length === fixture.logs.length &&
    s.logs.every((l: { id: string; date: string }) => l.date === (l.id === id ? toDay : dateOf.get(l.id))),
  );

  // 目标列里有它，原列里没有
  await expect(page.locator(`#tab-wk [data-wday="${toDay}"] [data-edit="${id}"]`)).toHaveCount(1);
  await expect(page.locator(`#tab-wk [data-wday="${fromDay}"] [data-edit="${id}"]`)).toHaveCount(0);

  // 完成的计划条目不能拖：本周有完成的计划条目，但它们都没有 draggable 属性。
  // 这些条目带内置原文，只做计数
  expect(await page.locator('#tab-wk [data-edittask]').count()).toBeGreaterThan(0);
  await expect(page.locator('#tab-wk [data-edittask][draggable]')).toHaveCount(0);
});
