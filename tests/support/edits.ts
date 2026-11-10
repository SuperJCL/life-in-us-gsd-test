// 七类条目各做一次修改的共用操作序列（SYNC-03 的去重计数用例，和 10-07 的重放用例复用）。
// 只用合成文字：所有文字都以调用方给的 label 开头（SYNTH-...）；任务、力量项、自定义待办所在的组都取自合成计划，
// 所以调用方必须用 syntheticPlan 打开应用。调用方须使用 manual 时钟（clockMode: 'manual'），并且已经 pauseAt。
//
// 顺序固定：先写本周复盘并 runFor(800) 让复盘防抖提交；之后在时钟暂停时完成其余操作。
// 这样调用方再 runFor(1_000) 时，复盘之后的全部操作进入同一次上传（10-07 依赖这一点）。
// 键（D-07）：复盘 review:<周一>、记录 A 与记录 B 各一个 log:、任务 task:、力量项 lift:、自定义待办 custom:、预设标签 preset:、开始日期 arrival，共 8 个。
import { expect, type Page } from '@playwright/test';
import { composer } from './composer';
import { editor } from './editor';
import { checkTask, gotoGoals } from './goals';
import { undo } from './toast';
import { TAB_LABELS } from './strings';

export const EDIT_ARRIVAL = '2026-01-05';
export const EDIT_LIFT_STEP = 5;

export type EditsMade = {
  reviewText: string;
  // 记录 A 改动后的文字，和它的 id
  aText: string;
  aId: string;
  // 记录 B：先删除再撤销，文字不变
  bText: string;
  bId: string;
  // 先勾选再取消的任务 id
  taskId: string;
  // 保存了新值的力量项 id 和新值
  liftId: string;
  liftValue: number;
  // 新加的自定义待办文字和它所在的组 id
  customText: string;
  customGroup: string;
  // 新加的预设标签文字和类别（显示名）
  presetText: string;
  presetCat: string;
  arrival: string;
};

// 本周视图里文字等于 text 的记录的 id（只在合成文字上使用）
async function logIdByText(page: Page, text: string): Promise<string> {
  const id = await page.evaluate((t) => {
    const hit = Array.from(document.querySelectorAll('#days [data-edit]')).find((el) => (el.textContent ?? '').trim() === t);
    return hit ? hit.getAttribute('data-edit') : null;
  }, text);
  expect(id, `本周视图里应当能找到记录 ${text}`).toBeTruthy();
  return id as string;
}

export async function makeOneEditOfEachKind(page: Page, label: string): Promise<EditsMade> {
  const week = page.getByRole('tab', { name: TAB_LABELS.wk, exact: true });
  const entry = composer(page, 'w');
  const ed = editor(page);

  // 1. 本周复盘：输入后等 800ms 防抖提交
  const reviewText = `${label} review`;
  await page.locator('#review').fill(reviewText);
  await page.clock.runFor(800);

  // 2. 记一笔 A，再在编辑弹窗里改它的文字
  await entry.type(`${label} A`);
  await entry.submit();
  const aId = await logIdByText(page, `${label} A`);
  const aText = `${label} A edited`;
  await ed.openLog(page.locator(`#tab-wk [data-edit="${aId}"]`));
  await ed.setText(aText);
  await ed.save();
  await ed.expectClosed();

  // 3. 记一笔 B，在编辑弹窗里删除，再用 toast 撤销
  const bText = `${label} B`;
  await entry.type(bText);
  await entry.submit();
  const bId = await logIdByText(page, bText);
  await ed.openLog(page.locator(`#tab-wk [data-edit="${bId}"]`));
  await ed.deleteEntry();
  await ed.expectClosed();
  await expect(page.locator(`#tab-wk [data-edit="${bId}"]`)).toHaveCount(0);
  await undo(page);
  await expect(page.locator(`#tab-wk [data-edit="${bId}"]`)).toHaveCount(1);

  // 4. 目标页：第一个任务先勾选再取消；第一个力量项保存新值；第一个组里加一个自定义待办
  await gotoGoals(page);
  const taskId = (await page.locator('#goals [data-task]').first().getAttribute('data-task')) as string;
  expect(taskId).toBeTruthy();
  await checkTask(page, taskId);
  await expect(page.locator(`#goals [data-task="${taskId}"]`)).toBeChecked();
  await checkTask(page, taskId);
  await expect(page.locator(`#goals [data-task="${taskId}"]`)).not.toBeChecked();

  const liftInput = page.locator('#goals input[data-lift]').first();
  const liftId = (await liftInput.getAttribute('data-lift')) as string;
  expect(liftId).toBeTruthy();
  const liftValue = Number(await liftInput.inputValue()) + EDIT_LIFT_STEP;
  await liftInput.fill(String(liftValue));
  await liftInput.press('Enter');
  await expect(page.locator(`#goals #lf-${liftId}`)).toHaveValue(String(liftValue));

  const addInput = page.locator('#goals [data-addto]').first();
  const customGroup = (await addInput.getAttribute('data-addto')) as string;
  const customText = `${label} todo`;
  await addInput.fill(customText);
  await addInput.press('Enter');
  await expect(page.locator('#goals .task', { hasText: customText })).toHaveCount(1);

  // 5. 回到本周：在本周 composer 里加一个预设标签；再改开始日期
  await week.click();
  await expect(week).toHaveAttribute('aria-selected', 'true');
  const presetText = `${label} tag`;
  await entry.addPreset(presetText);
  await expect(entry.presetNamed(presetText)).toBeVisible();
  const presetCat = '语言';

  await page.locator('#arrival').fill(EDIT_ARRIVAL);

  return { reviewText, aText, aId, bText, bId, taskId, liftId, liftValue, customText, customGroup, presetText, presetCat, arrival: EDIT_ARRIVAL };
}
