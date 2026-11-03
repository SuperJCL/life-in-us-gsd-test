// 本文件覆盖 WEEK-03：本周视图的记一笔（composer）。
// 视图用例默认账户模式加完整 fixture（D-10）：开局后立刻 expectAccountMode，期望值从 fixture 推导。
// 所有记一笔操作都经 tests/support/composer.ts；保存一律用 app.expectSaved 等待，不用固定睡眠。
import { test, expect } from '../../support/test';
import { composer } from '../../support/composer';
import { expectToast } from '../../support/toast';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { CAT_LANGUAGE, TAB_LABELS, TOAST_RECORDED } from '../../support/strings';

type Log = { text: string; date: string; cat: string };

test('WEEK-03 records an entry from the week composer and saves it on the selected day', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  const text = 'SYNTH-WEEK03 tracer entry';

  // 初始：没有内容，记录按钮禁用，默认类别是语言
  await expect(c.addButton).toBeDisabled();
  await expect(c.categoryButton(CAT_LANGUAGE)).toHaveAttribute('aria-pressed', 'true');

  await c.type(text);
  await expect(c.addButton).toBeEnabled();
  await c.submit();

  // 记录后 toast 提示，文本框清空，按钮重新禁用
  await expectToast(page, TOAST_RECORDED);
  await expect(c.text).toHaveValue('');
  await expect(c.addButton).toBeDisabled();

  // 今天那一列出现这条记录。只做计数，不对整列做文字断言：列里可能有完成的内置计划条目
  await expect(
    page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`).filter({ hasText: text }),
  ).toHaveCount(1);

  // 保存后的状态里有这条记录：日期是今天，类别是当前类别，总条数恰好多一条
  await app.expectSaved((s) =>
    s.logs.some((l: Log) => l.text === text && l.date === FROZEN_TODAY && l.cat === CAT_LANGUAGE),
  );
  const saved = await app.saved();
  expect(saved.logs.length).toBe(fixture.logs.length + 1);
});

// D-01：Phase 4 直接复用 'c' 实例，这里只证明参数化可用，不测日历行为
test('WEEK-03 the composer helper also drives the calendar day panel instance', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  await page.getByRole('tab', { name: TAB_LABELS.cal, exact: true }).click();

  const c = composer(page, 'c');
  const text = 'SYNTH-WEEK03 day panel entry';

  // 日面板根节点里恰好一个日历实例的文本框
  await expect(c.root.locator('#c-text')).toHaveCount(1);

  await c.type(text);
  await c.submit('keyboard');
  await expectToast(page, TOAST_RECORDED);

  // 日面板默认选中今天
  await app.expectSaved((s) => s.logs.some((l: Log) => l.text === text && l.date === FROZEN_TODAY));
});
