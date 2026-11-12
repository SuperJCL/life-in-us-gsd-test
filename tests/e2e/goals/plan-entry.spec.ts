// Phase 12-03 的默认套件用例（PLAN-02，D-13）：本地版（不登录）没有「编辑计划」入口，#plan 回到目标页，不弹提示。
// 只用合成数据（本地版没有账号，也不保存计划）；失败消息只写 hash、计数和布尔。
import { test, expect, type Page } from '../../support/test';
import { gotoGoals } from '../../support/goals';
import { TAB_LABELS } from '../../support/strings';

// 目标页显示、编辑页不显示、地址里没有 hash、没有提示
async function expectGoalsView(page: Page) {
  await expect.poll(() => page.evaluate(() => location.hash), { message: '等待 hash 被去掉' }).toBe('');
  await expect(page.locator('#tab-goal')).toBeVisible();
  await expect(page.locator('#tab-plan')).toBeHidden();
  await expect(page.locator('nav.tabs [data-tab="goal"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#planEditBtn')).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelector('#toast')?.classList.contains('on') ?? false), '不应弹出提示').toBe(false);
  expect(await page.evaluate(() => (document.querySelector('dialog#confirm') as HTMLDialogElement).open), '不应弹出确认框').toBe(false);
}

test('PLAN-02 the local version shows no plan editor entry and #plan shows the goals view (D-13)', async ({ app, page }) => {
  await app.open();
  await gotoGoals(page);
  await expect(page.locator('#planEditBtn')).toHaveCount(0);

  // 在别的标签上把 hash 设为 #plan（hashchange）：回到目标页，hash 被去掉
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await page.evaluate(() => {
    location.hash = '#plan';
  });
  await expectGoalsView(page);

  // 带 #plan 打开页面：同样显示目标页（replaceState 设 hash 不触发 hashchange，再重新加载）
  await page.evaluate(() => history.replaceState(null, '', '#plan'));
  expect(await page.evaluate(() => location.hash)).toBe('#plan');
  await app.reload();
  await expectGoalsView(page);
});
