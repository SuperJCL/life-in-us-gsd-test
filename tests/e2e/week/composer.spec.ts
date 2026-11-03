// 本文件覆盖 WEEK-03：本周视图的记一笔（composer）。
// 视图用例默认账户模式加完整 fixture（D-10）：开局后立刻 expectAccountMode，期望值从 fixture 推导。
// 所有记一笔操作都经 tests/support/composer.ts；保存一律用 app.expectSaved 等待，不用固定睡眠。
import { test, expect } from '../../support/test';
import { composer } from '../../support/composer';
import { expectToast, expectToastPrefix } from '../../support/toast';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import {
  CATEGORY_NAMES,
  CAT_LANGUAGE,
  TAB_LABELS,
  TOAST_RECORDED,
  TOAST_RECORDED_PREFIX,
} from '../../support/strings';

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

// 按类别顺序找第一个有内置“直接记录”或“预填”预设的类别，返回类别名和该预设在全部预设里的序号。
// 内置预设个数 = 预设总数减去 fixture 里该类别的自定义标签个数（应用把自定义标签接在内置标签后面）；
// fixture 的 presets 只有部分类别有键，没有键的类别按空的 add 列表算（长度 0），不跳过这些类别。
// 内置预设文字是个人计划，这里只返回序号，不读文字（D-14）。
async function findBuiltinPreset(
  c: ReturnType<typeof composer>,
  fixture: any,
  kind: 'direct' | 'fill',
): Promise<{ cat: string; n: number } | null> {
  for (const cat of CATEGORY_NAMES) {
    await c.pickCategory(cat);
    const builtinCount = (await c.presets.count()) - (fixture.presets[cat]?.add ?? []).length;
    const indexes = await c.presetIndexes(kind, builtinCount);
    if (indexes.length > 0) return { cat, n: indexes[0] };
  }
  return null;
}

test('WEEK-03 switching category keeps the draft and records the entry in the chosen category', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  const draft = 'SYNTH-WEEK03 category draft';
  const other = CATEGORY_NAMES[1];

  await c.type(draft);
  await c.pickCategory(other);

  // 新类别被按下，原类别释放，草稿原样保留
  await expect(c.categoryButton(other)).toHaveAttribute('aria-pressed', 'true');
  await expect(c.categoryButton(CAT_LANGUAGE)).toHaveAttribute('aria-pressed', 'false');
  expect(await c.draft()).toBe(draft);

  await c.submit();
  await app.expectSaved((s) =>
    s.logs.some((l: Log) => l.text === draft && l.cat === other && l.date === FROZEN_TODAY),
  );
});

test('WEEK-03 a built-in direct-record preset adds an entry at once without printing its text', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  const todayEntries = page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`);

  // 顺序的理由：真实点击放在前面；内置文字的 toast 出现之后，本用例不再做任何 Playwright 动作。
  // 1. fixture 里的合成自定义标签不以冒号结尾，所以是直接记录。真实点击证明预设按钮的指针路径
  const custom: string = fixture.presets[CAT_LANGUAGE].add[0];
  const n0 = await todayEntries.count();
  await c.presetNamed(custom).click();
  await expect(todayEntries).toHaveCount(n0 + 1);
  await expectToast(page, TOAST_RECORDED_PREFIX + custom);

  // 2. 找第一个有内置直接记录预设的类别
  const found = await findBuiltinPreset(c, fixture, 'direct');
  expect(found, '没有找到可直接记录的内置预设').not.toBeNull();
  const { cat, n } = found!;

  // 3. 文字只放在内存里，由 composer 在页面内点击；比较都是布尔断言
  const n1 = await todayEntries.count();
  const text = await c.presetText(n);
  await c.clickPreset(n);
  await expect(todayEntries).toHaveCount(n1 + 1);
  await expectToastPrefix(page, TOAST_RECORDED_PREFIX);
  await app.expectSaved(
    (s) =>
      s.logs.some((l: Log) => l.text === custom) &&
      s.logs.some((l: Log) => l.text === text && l.cat === cat && l.date === FROZEN_TODAY),
  );
});

test('WEEK-03 a fill preset only prefills the draft and Ctrl+Enter records the completed text', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  const todayEntries = page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`);

  const found = await findBuiltinPreset(c, fixture, 'fill');
  expect(found, '没有找到预填型的内置预设').not.toBeNull();
  const { cat, n } = found!;
  const text = await c.presetText(n);
  expect(text, '读不到预设文字').not.toBeNull();
  const n0 = await todayEntries.count();

  // 已有草稿时，预填文字接在一个换行后面。此后文本框的值含内置文字，只在 Node 侧做布尔比较
  await c.type('SYNTH-PRE draft');
  await c.clickPreset(n);
  expect((await c.draft()) === 'SYNTH-PRE draft\n' + text, '已有草稿时预填结果不对（内容已隐藏）').toBe(true);
  await expect(todayEntries).toHaveCount(n0);
  await expect(c.addButton).toBeEnabled();

  // 草稿为空时，预填文字就是整个草稿
  await c.type('');
  await c.clickPreset(n);
  expect((await c.draft()) === text, '空草稿时预填结果不对（内容已隐藏）').toBe(true);

  // 补上合成文字后按 Ctrl+Enter 提交，保存的是完整文字
  await c.append(' SYNTH-detail');
  await c.submit('keyboard');
  await expectToast(page, TOAST_RECORDED);
  const full = (text + ' SYNTH-detail').trim();
  await app.expectSaved((s) => s.logs.some((l: Log) => l.text === full && l.cat === cat));
  await expect(todayEntries).toHaveCount(n0 + 1);
});

test('WEEK-03 blank text keeps the record button disabled, Enter alone adds a line, and the entry lands on the picked day', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  const pickedDay = '2026-03-19';
  const todayEntries = page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`);
  const pickedColumn = page.locator(`#tab-wk [data-wday="${pickedDay}"]`);

  // 空文本和只有空白都不能记录
  await expect(c.addButton).toBeDisabled();
  await c.type('   ');
  await expect(c.addButton).toBeDisabled();

  // 单独按 Enter 只换行，不提交
  const n0 = await todayEntries.count();
  await c.type('SYNTH-LINE one');
  await c.text.press('Enter');
  await c.text.pressSequentially('two');
  expect(await c.draft()).toBe('SYNTH-LINE one\ntwo');
  await expect(todayEntries).toHaveCount(n0);

  // 点列头选日期（不点列里的记录，避免打开编辑弹窗）。
  // 先选日期再输入，是因为先输入再选日期会丢草稿（已知 bug B1）
  await pickedColumn.locator('.dh').click();
  await expect(pickedColumn).toHaveClass(/sel/);
  await c.type('SYNTH-WEEK03 picked day');
  await c.submit();

  await expect(pickedColumn.locator('[data-edit]').filter({ hasText: 'SYNTH-WEEK03 picked day' })).toHaveCount(1);
  await app.expectSaved((s) =>
    s.logs.some((l: Log) => l.text === 'SYNTH-WEEK03 picked day' && l.date === pickedDay),
  );
});
