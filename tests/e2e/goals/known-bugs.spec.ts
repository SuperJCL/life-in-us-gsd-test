// 本文件登记目标视图相关的已知 bug（BUG-01，D-17）：N1 在目标页勾选任务这一触发，是同一个 describe 里的一对用例。
// N1 与 CONCERNS.md 的 B1（Composer draft lost when choosing another day）同源：renderAll 整页重绘会重建两个 composer，
// 本周的草稿随之丢失；触发不同，这里是在目标页勾选任务（change 委托 → renderAll）。登记在 tests/KNOWN-BUGS.md 的 N1 行。
// 成对的理由：test.fail 会把同一条用例里任何原因的失败都当作“预期失败”，
// 所以“前提成立”放在不带标记的对照用例里；标记用例走完全相同的准备和触发，只断言一条期望行为。
// 只勾选合成的自定义待办 c-synth-3（它的属性和文字都是合成的），所以可以真实点击，失败输出里没有个人计划文字（D-05）。
// 都用账户模式加完整 fixture 开局，并立刻 expectAccountMode（D-06）。
import { test, expect, knownBug } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { composer } from '../../support/composer';
import { gotoGoals } from '../../support/goals';
import { loadFixture } from '../../support/fixture-files';
import { TAB_LABELS, TOAST_TASK_DONE } from '../../support/strings';
import { expectToast } from '../../support/toast';

const N1_DRAFT = 'SYNTH-N1 goals draft';
const N1_TASK_ID = 'c-synth-3';

test.describe('BUG-01 N1 week draft is cleared when a task is checked in the goals view', () => {
  // 准备：本周标签默认已选中，直接在本周输入草稿；返回 composer
  async function typeDraftInWeek(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const c = composer(page, 'w');
    await c.type(N1_DRAFT);
    return c;
  }

  // 切到目标页，返回合成待办的复选框
  async function openGoalsBox(page: Page) {
    await gotoGoals(page);
    return page.locator(`#goals [data-task="${N1_TASK_ID}"]`);
  }

  // 回到本周标签（写法同 tests/e2e/editor/task-editor.spec.ts）
  async function backToWeek(page: Page) {
    await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  }

  test('BUG-01 N1 goals control: the week draft is typed and checking a task saves it as done', async ({ page, app }) => {
    const c = await typeDraftInWeek(page, app);

    // 前提：草稿确实在本周的文本框里、记录按钮可用；切到目标页后复选框恰好一个且未勾选
    await expect(c.text).toHaveValue(N1_DRAFT);
    await expect(c.addButton).toBeEnabled();

    // 基线：只做标签往返、不勾选，草稿仍在（排除“标签切换本身清草稿”，标记用例的失败才只能归因于勾选）
    await openGoalsBox(page);
    await backToWeek(page);
    await expect(c.text).toHaveValue(N1_DRAFT);

    const box = await openGoalsBox(page);
    await expect(box).toHaveCount(1);
    await expect(box).not.toBeChecked();

    // 触发：真实点击合成待办的复选框
    await box.click();

    // 触发确实走了勾选分支：toast 为完成，保存里该待办 done 为真
    await expectToast(page, TOAST_TASK_DONE);
    await app.expectSaved((s) => s.tasks?.[N1_TASK_ID]?.done === true, `等待保存后 ${N1_TASK_ID} 已完成`);

    // 切回本周：composer 恰好一个（重绘后仍在，只是草稿另说）
    await backToWeek(page);
    await expect(c.text).toHaveCount(1);
  });

  test('BUG-01 N1 goals expected: the week draft survives checking a task', async ({ page, app }) => {
    knownBug('N1', '带草稿时在目标页勾选任务，草稿被清空');
    const c = await typeDraftInWeek(page, app);
    const box = await openGoalsBox(page);
    await box.click();
    await backToWeek(page);

    await expect(c.text).toHaveValue(N1_DRAFT, { timeout: 2_000 });
    await expect(c.addButton).toBeEnabled({ timeout: 2_000 });
  });
});
