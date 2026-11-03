// 本文件登记本周视图的已知 bug（BUG-01，D-11、D-13）：每个 bug 是同一个 describe 里的一对用例。
// 成对的理由：test.fail 会把同一条用例里任何原因的失败都当作“预期失败”，
// 所以“前提成立”放在不带标记的对照用例里；标记用例走完全相同的准备和触发，只断言一条期望行为。
// 每个 describe 用一个本文件内的准备函数，让两条用例的准备和触发完全一致；
// 都用账户模式加完整 fixture 开局，并立刻 expectAccountMode（D-10）。
// 草稿、列头和弹窗属性里没有个人计划文字（D-14），失败输出只会出现合成文字。
import { test, expect, knownBug } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { composer } from '../../support/composer';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';

const B1_DRAFT = 'SYNTH-B1 draft';
const B1_TARGET_DAY = '2026-03-19';

test.describe('BUG-01 B1 week draft is cleared when picking another day', () => {
  // 准备和触发：输入草稿，点目标日期的列头（不点列里的记录，免得打开编辑弹窗）
  async function typeDraftThenPickDay(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const c = composer(page, 'w');
    await c.type(B1_DRAFT);
    return { c, header: page.locator(`#tab-wk [data-wday="${B1_TARGET_DAY}"] .dh`) };
  }

  test('BUG-01 B1 control: the week draft is typed and picking another day moves the selection', async ({
    page,
    app,
  }) => {
    const { c, header } = await typeDraftThenPickDay(page, app);

    // 前提：草稿确实在文本框里、记录按钮可用、目标列头恰好一个
    await expect(c.text).toHaveValue(B1_DRAFT);
    await expect(c.addButton).toBeEnabled();
    await expect(header).toHaveCount(1);

    // 触发：真实点击列头
    await header.click();

    // 这是一次选日期：目标列被选中、今天不再被选中，并且没有打开编辑弹窗
    await expect(page.locator(`#tab-wk [data-wday="${B1_TARGET_DAY}"]`)).toHaveClass(/\bsel\b/);
    await expect(page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"]`)).not.toHaveClass(/\bsel\b/);
    await expect(page.locator('dialog#editor')).not.toHaveAttribute('open', /.*/);
  });

  test('BUG-01 B1 expected: the week draft survives picking another day', async ({ page, app }) => {
    knownBug('B1', '本周视图输入草稿后点另一天，草稿被清空');
    const { c, header } = await typeDraftThenPickDay(page, app);
    await header.click();

    await expect(c.text).toHaveValue(B1_DRAFT, { timeout: 2_000 });
    await expect(c.addButton).toBeEnabled({ timeout: 2_000 });
  });
});
