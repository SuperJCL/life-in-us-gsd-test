// 本文件覆盖 WEEK-06：本周复盘（#review）的保存、刷新和按周独立。
//
// N2 规则（D-03）：复盘先经 800 ms 防抖写进 state，再经 600 ms 防抖落盘；防抖期间只要发生重绘
// （例如翻周、点日期、记一笔），文本框在失去焦点后会被 state 里的旧值覆盖。
// 所以本文件里每次输入复盘之后，都先用 app.expectSaved 等到保存完成，再做别的操作。
// N2 不单独写用例，只立这条规则。
// 复盘都是合成文字（fixture 里的 SYNTH-REVIEW 和本文件新输入的文字），失败输出里没有个人计划内容。
import { test, expect } from '../../support/test';
import { WEEK_START_FROZEN } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';

const PREV_WEEK = '2026-03-09';

test('WEEK-06 the weekly review is saved verbatim and still shown after reload', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const review = page.locator('#review');
  await expect(review).toHaveValue(fixture.reviews[WEEK_START_FROZEN]);

  // 多行，行尾两个空格：保存的是原文，不做 trim
  const text = 'SYNTH-REVIEW 新的 line one\nline two  ';
  await review.fill(text);

  // 先等保存完成（N2），上一周的复盘不受影响
  await app.expectSaved(
    (s) => s.reviews[WEEK_START_FROZEN] === text && s.reviews[PREV_WEEK] === fixture.reviews[PREV_WEEK],
  );

  // 刷新后仍显示原文
  await app.reload();
  await expect(review).toHaveValue(text);
});

test('WEEK-06 each week shows its own review and clearing a review removes it from the saved state', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const review = page.locator('#review');

  // 上一周显示自己的复盘，改写后存在上一周周一的键下
  await page.locator('#wkPrev').click();
  await expect(review).toHaveValue(fixture.reviews[PREV_WEEK]);
  const edited = 'SYNTH-REVIEW prev week edited';
  await review.fill(edited);
  await app.expectSaved((s) => s.reviews[PREV_WEEK] === edited);

  // 2026-03-23 这一周没有复盘
  await page.locator('#wkNext').click();
  await page.locator('#wkNext').click();
  await expect(review).toHaveValue('');

  // 回到本周：显示本周自己的复盘，没有被上一周的改动影响
  await page.locator('#wkNow').click();
  await expect(review).toHaveValue(fixture.reviews[WEEK_START_FROZEN]);

  // 只剩空白等于清空：保存后的 reviews 里没有这一周的键，上一周的新值不受影响
  await review.fill('  ');
  await app.expectSaved((s) => !(WEEK_START_FROZEN in s.reviews) && s.reviews[PREV_WEEK] === edited);
});
