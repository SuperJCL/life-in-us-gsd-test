// 本文件覆盖 EDIT-01：编辑弹窗从本周视图、日历日面板、时间线三个入口打开，修改文字、类别、日期后保存，
// 三个视图同步更新，并且保存后的状态里是新值（D-16）。
// 视图用例默认账户模式加完整 fixture（D-10）：开局后立刻 expectAccountMode。
//
// 隐私（D-14）：时间线和日面板里同时有完成的内置计划条目，带个人计划原文。所以本文件只按
// [data-edit="<合成 id>"] 定位到具体一条，不对整个 #timeline、#dayPanel 或 #grid 做文字类断言，
// 动作只落在合成条目、日历格（属性只有日期和计数）、标签页按钮和弹窗自己的控件上。
// 日历和时间线在这里只当入口和同步检查用，深入的渲染和交互用例放在 Phase 4、5。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import { editor } from '../../support/editor';
import { expectToast } from '../../support/toast';
import { loadFixture } from '../../support/fixture-files';
import { FROZEN_NOW, FROZEN_TODAY, WEEK_END_FROZEN, WEEK_START_FROZEN } from '../../support/constants';
import { mdLabel, timelineDateLabel, weekCountsByCategory } from '../../support/expect-from-fixture';
import {
  AREA_COUNT_UNIT,
  CATEGORY_NAMES,
  TAB_LABELS,
  TOAST_SAVED,
  TOAST_SAVED_MOVED_PREFIX,
} from '../../support/strings';

type Log = { id: string; text: string; cat: string; date: string };

// 点标签页按钮
async function gotoTab(page: Page, name: string) {
  await page.getByRole('tab', { name, exact: true }).click();
}

// 一条记录在本周、日历、时间线三个视图里都显示新文字和新类别，并且位置在 date 那一天。
// date 必须在冻结的本周内（本文件的调用都是），超出就是用例写错。最后切回本周
async function expectLogInEveryView(page: Page, log: Log) {
  expect(log.date >= WEEK_START_FROZEN && log.date <= WEEK_END_FROZEN, '用例写错：日期不在冻结的本周内').toBe(true);

  // 本周：恰好一个条目，并且在 date 那一列里
  await gotoTab(page, TAB_LABELS.wk);
  await expect(page.locator(`#tab-wk [data-edit="${log.id}"]`)).toHaveCount(1);
  await expect(page.locator(`#tab-wk [data-wday="${log.date}"] [data-edit="${log.id}"] > span`)).toHaveText(log.text);

  // 日历：选中这一天，日面板里有它
  await gotoTab(page, TAB_LABELS.cal);
  await page.locator(`#grid [data-date="${log.date}"]`).click();
  await expect(page.locator(`#dayPanel [data-edit="${log.id}"] .li-text`)).toHaveText(log.text);
  await expect(page.locator(`#dayPanel [data-edit="${log.id}"] .tag`)).toHaveText(log.cat);

  // 时间线：文字、类别和日期标签
  await gotoTab(page, TAB_LABELS.tl);
  await expect(page.locator(`#timeline [data-edit="${log.id}"] .li-text`)).toHaveText(log.text);
  await expect(page.locator(`#timeline [data-edit="${log.id}"] .tag`)).toHaveText(log.cat);
  await expect(page.locator(`#timeline [data-edit="${log.id}"] .tl-date`)).toHaveText(timelineDateLabel(log.date));

  await gotoTab(page, TAB_LABELS.wk);
}

test('EDIT-01 editing an entry from the week view updates text, category and date in every view and saves them', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const id = 'synth-full-01';
  const original: Log = fixture.logs.find((l: Log) => l.id === id);
  const newText = 'SYNTH-EDIT01 week edited';
  const newCat = CATEGORY_NAMES[3];
  const newDate = '2026-03-19';
  const ed = editor(page);

  // 打开：预填原文并获得焦点，日期是原日期，类别按钮按下；选中日不变（点记录打开弹窗，不选日期）
  await ed.openLog(page.locator(`#tab-wk [data-edit="${id}"]`));
  await expect(ed.text).toHaveValue(original.text);
  await expect(ed.text).toBeFocused();
  await expect(ed.date).toHaveValue(original.date);
  await expect(ed.categoryButton(original.cat)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#tab-wk .day.sel')).toHaveAttribute('data-wday', FROZEN_TODAY);

  // 先改文字再改类别：未保存的文字在重绘后保留；再改日期并保存
  await ed.setText(newText);
  await ed.setCategory(newCat);
  await expect(ed.text).toHaveValue(newText);
  await ed.setDate(newDate);
  await ed.save();

  await ed.expectClosed();
  await expectToast(page, TOAST_SAVED_MOVED_PREFIX + mdLabel(newDate));

  // 保存后的状态：这条记录是新值，条数不变，其余记录与 fixture 完全相同（布尔，不打印内容）
  const othersJson = JSON.stringify(fixture.logs.filter((l: Log) => l.id !== id));
  await app.expectSaved((s) => {
    const l = s.logs.find((x: Log) => x.id === id);
    return (
      !!l &&
      l.text === newText &&
      l.cat === newCat &&
      l.date === newDate &&
      s.logs.length === fixture.logs.length &&
      JSON.stringify(s.logs.filter((x: Log) => x.id !== id)) === othersJson
    );
  }, '等待保存后的记录是新值');

  // 本周五类计数等于对修改后状态的推导
  const expected = structuredClone(fixture);
  Object.assign(
    expected.logs.find((l: Log) => l.id === id),
    { text: newText, cat: newCat, date: newDate },
  );
  await expect(page.locator('#areas .area .v')).toHaveText(
    weekCountsByCategory(expected, WEEK_START_FROZEN).map((n) => `${n}${AREA_COUNT_UNIT}`),
  );

  await expectLogInEveryView(page, { id, text: newText, cat: newCat, date: newDate });
  // 原来的那一列里已经没有它
  await expect(page.locator(`#tab-wk [data-wday="${original.date}"] [data-edit="${id}"]`)).toHaveCount(0);
});
