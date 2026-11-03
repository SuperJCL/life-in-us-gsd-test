// 本文件覆盖 EDIT-03：已完成计划的弹窗，改完成日期和改回未完成（D-17）。
// 只编辑合成的已完成自定义计划 c-synth-2。内置计划和自定义计划走同一个 openTaskEditor，
// 而内置计划的弹窗会显示个人计划原文，所以不打开内置计划的弹窗（D-14）。
// 定位器都精确到 c-synth-2，不对整个容器做文字类断言；视图用例默认账户模式加完整 fixture（D-10）。
import { test, expect } from '../../support/test';
import { editor } from '../../support/editor';
import { expectToast } from '../../support/toast';
import { loadFixture } from '../../support/fixture-files';
import { timelineDateLabel } from '../../support/expect-from-fixture';
import { TAB_LABELS, TOAST_MARKED_UNDONE, TOAST_SAVED } from '../../support/strings';

const TASK_ID = 'c-synth-2';

test('EDIT-03 the completed-task editor moves the completion date and saves it', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const originalDate: string = fixture.tasks[TASK_ID].doneDate;
  const newDate = '2026-03-12';
  const ed = editor(page);

  // 它完成在上一周：先翻到上一周，再从日期列里点这一条
  await page.locator('#wkPrev').click();
  const entry = page.locator(`#tab-wk [data-wday="${originalDate}"] [data-edittask="${TASK_ID}"]`);
  await expect(entry).toHaveCount(1);
  await ed.openTask(entry);

  // 完成日期预填原值；完成计划的弹窗没有文本框
  await expect(ed.date).toHaveValue(originalDate);
  await expect(ed.text).toHaveCount(0);

  await ed.setDate(newDate);
  await ed.save();
  await ed.expectClosed();
  await expectToast(page, TOAST_SAVED);

  // 保存后的 tasks：c-synth-2 仍是完成、日期是新值，其余计划与 fixture 相同（布尔，不打印内容）
  const othersJson = JSON.stringify(Object.fromEntries(Object.entries(fixture.tasks).filter(([k]) => k !== TASK_ID)));
  await app.expectSaved((s) => {
    const t = s.tasks[TASK_ID];
    const rest = Object.fromEntries(Object.entries(s.tasks).filter(([k]) => k !== TASK_ID));
    return !!t && t.done === true && t.doneDate === newDate && JSON.stringify(rest) === othersJson;
  }, '等待保存后的完成日期是新值');

  // 条目移到新日期那一列
  await expect(page.locator(`#tab-wk [data-wday="${newDate}"] [data-edittask="${TASK_ID}"]`)).toHaveCount(1);
  await expect(page.locator(`#tab-wk [data-wday="${originalDate}"] [data-edittask="${TASK_ID}"]`)).toHaveCount(0);

  // 时间线上的日期标签跟着变
  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
  await expect(page.locator(`#timeline [data-edittask="${TASK_ID}"] .tl-date`)).toHaveText(timelineDateLabel(newDate));
});

test('EDIT-03 the completed-task editor can mark the task as not done', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const ed = editor(page);

  await page.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
  await ed.openTask(page.locator(`#timeline [data-edittask="${TASK_ID}"]`));
  await ed.markUndone();
  await ed.expectClosed();
  await expectToast(page, TOAST_MARKED_UNDONE);

  // 保存后：done 为 false，完成日期被清成空字符串
  await app.expectSaved((s) => {
    const t = s.tasks[TASK_ID];
    return !!t && t.done === false && t.doneDate === '';
  }, '等待保存后的计划是未完成');

  // 时间线和本周（上一周）里都没有它了
  await expect(page.locator(`#timeline [data-edittask="${TASK_ID}"]`)).toHaveCount(0);
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  await page.locator('#wkPrev').click();
  await expect(page.locator(`#tab-wk [data-edittask="${TASK_ID}"]`)).toHaveCount(0);

  // 目标页：复选框还在，没有勾选
  await page.getByRole('tab', { name: TAB_LABELS.goal, exact: true }).click();
  await expect(page.locator(`#goals [data-task="${TASK_ID}"]`)).toHaveCount(1);
  await expect(page.locator(`#goals [data-task="${TASK_ID}"]:checked`)).toHaveCount(0);
});
