// 本文件登记日历日面板的已知 bug（BUG-01，D-10）：B1 在日历里的实例，是同一个 describe 里的一对用例。
// 成对的理由：test.fail 会把同一条用例里任何原因的失败都当作“预期失败”，
// 所以“前提成立”放在不带标记的对照用例里；标记用例走完全相同的准备和触发，只断言一条期望行为。
// B1 的本周实例在 tests/e2e/week/known-bugs.spec.ts；两处同源（整页重绘重建 composer，草稿随之丢失），触发不同，
// 登记在 tests/KNOWN-BUGS.md 的同一行。准备函数在本文件内，让两条用例的准备和触发完全一致；
// 都用账户模式加完整 fixture 开局，并立刻 expectAccountMode（D-06）。
// 草稿、格子属性和弹窗属性里没有个人计划文字（D-05），失败输出只会出现合成文字。
import { test, expect, knownBug } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { composer } from '../../support/composer';
import { gotoCalendar } from '../../support/calendar';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { dayPanelTitle } from '../../support/expect-from-fixture';
import { expectToast, expectUndoOffered } from '../../support/toast';
import { TOAST_LOG_DELETED } from '../../support/strings';

const B1_DRAFT = 'SYNTH-B1 calendar draft';
const B1_TARGET_DAY = '2026-03-19';

test.describe('BUG-01 B1 calendar draft is cleared when picking another cell', () => {
  // 准备和触发：打开日历，在日面板输入草稿；返回 composer 和目标格（点格子的子节点都是元素，调用日志只打印属性）
  async function typeDraftInDayPanel(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    await gotoCalendar(page);
    const c = composer(page, 'c');
    await c.type(B1_DRAFT);
    return { c, cell: page.locator(`#grid [data-date="${B1_TARGET_DAY}"]`) };
  }

  test('BUG-01 B1 calendar control: the day-panel draft is typed and picking another cell moves the selection', async ({
    page,
    app,
  }) => {
    const { c, cell } = await typeDraftInDayPanel(page, app);

    // 前提：草稿确实在文本框里、记录按钮可用、目标格恰好一个
    await expect(c.text).toHaveValue(B1_DRAFT);
    await expect(c.addButton).toBeEnabled();
    await expect(cell).toHaveCount(1);

    // 触发：真实点击目标格
    await cell.click();

    // 这是一次选日期：目标格被选中、今天不再被选中、日面板切到目标日，并且没有打开编辑弹窗
    await expect(cell).toHaveClass(/\bsel\b/);
    await expect(page.locator(`#grid [data-date="${FROZEN_TODAY}"]`)).not.toHaveClass(/\bsel\b/);
    await expect(page.locator('#dayPanel > h3')).toHaveText(dayPanelTitle(B1_TARGET_DAY));
    await expect(page.locator('dialog#editor')).not.toHaveAttribute('open', /.*/);
  });

  test('BUG-01 B1 calendar expected: the day-panel draft survives picking another cell', async ({ page, app }) => {
    knownBug('B1', '日历日面板输入草稿后点另一个格子，草稿被清空');
    const { c, cell } = await typeDraftInDayPanel(page, app);
    await cell.click();

    await expect(c.text).toHaveValue(B1_DRAFT, { timeout: 2_000 });
    await expect(c.addButton).toBeEnabled({ timeout: 2_000 });
  });
});

// N1 的另一种触发：带草稿时在日面板删除一条记录（deleteLog → renderAll，整页重绘重建两个 composer）。
// 与 B1 同源、触发不同，按 D-17 另写一对，登记在 tests/KNOWN-BUGS.md 的 N1 行。
// 删除的是 fixture 里的合成记录 synth-full-04，删除按钮只带记录 id 和固定的 aria-label，所以可以用定位器点。
const N1_DRAFT = 'SYNTH-N1 day-panel draft';
const N1_ENTRY_ID = 'synth-full-04';

test.describe('BUG-01 N1 day-panel draft is cleared when an entry is deleted', () => {
  // 准备：打开日历，在日面板输入草稿；返回 composer 和删除按钮
  async function typeDraftInDayPanel(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    await gotoCalendar(page);
    const c = composer(page, 'c');
    await c.type(N1_DRAFT);
    return { c, del: page.locator(`#dayPanel [data-dellog="${N1_ENTRY_ID}"]`) };
  }

  test('BUG-01 N1 delete control: the day-panel draft is typed and the delete button removes the entry', async ({
    page,
    app,
  }) => {
    const { c, del } = await typeDraftInDayPanel(page, app);

    // 前提：草稿确实在文本框里、记录按钮可用、删除按钮恰好一个
    await expect(c.text).toHaveValue(N1_DRAFT);
    await expect(c.addButton).toBeEnabled();
    await expect(del).toHaveCount(1);

    // 触发：真实点击删除按钮
    await del.click();

    // 触发确实走了 deleteLog：toast 为已删除并带撤销，记录从日面板消失，没有打开编辑弹窗，保存里也没有它了
    await expectToast(page, TOAST_LOG_DELETED);
    await expectUndoOffered(page);
    await expect(page.locator(`#dayPanel [data-edit="${N1_ENTRY_ID}"]`)).toHaveCount(0);
    await expect(page.locator('dialog#editor')).not.toHaveAttribute('open', /.*/);
    await app.expectSaved(
      (s) => s.logs.every((l: { id: string }) => l.id !== N1_ENTRY_ID),
      '等待保存后的记录里没有被删除的这条',
    );
  });

  test('BUG-01 N1 delete expected: the day-panel draft survives deleting an entry', async ({ page, app }) => {
    knownBug('N1', '带草稿时在日面板删除记录，草稿被清空');
    const { c, del } = await typeDraftInDayPanel(page, app);
    await del.click();

    await expect(c.text).toHaveValue(N1_DRAFT, { timeout: 2_000 });
    await expect(c.addButton).toBeEnabled({ timeout: 2_000 });
  });
});
