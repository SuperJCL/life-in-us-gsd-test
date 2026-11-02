import { test, expect } from '../support/test';
import { STATE_KEY, FROZEN_TODAY } from '../support/constants';
import { STATUS_LOCAL, CAT_LANGUAGE } from '../support/strings';

// 合成文本，不含任何真实内容
const ENTRY_TEXT = 'SYNTH-IO01 local roundtrip';

test('IO-01 saves an entry to localStorage and keeps it after reload', async ({ page }) => {
  await page.goto('/');

  // 状态行出现本地模式文案才算就绪：store 就位之前记的内容不会被保存
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 在本周视图记一笔
  await page.locator('#wkComp #w-text').fill(ENTRY_TEXT);
  await page.locator('#wkComp #w-add').click();

  // 先 poll：保存有 600 ms 防抖，等 localStorage 里出现这段文本，不用固定睡眠（D-18）
  const readState = () => page.evaluate((key) => localStorage.getItem(key) ?? '', STATE_KEY);
  await expect.poll(readState).toContain(ENTRY_TEXT);

  // 再校验落盘的内容：恰好一条，日期是冻结日，类别是中文显示名
  const saved = JSON.parse(await readState());
  const matches = saved.logs.filter((l: { text: string }) => l.text === ENTRY_TEXT);
  expect(matches).toHaveLength(1);
  expect(matches[0].date).toBe(FROZEN_TODAY);
  expect(matches[0].cat).toBe(CAT_LANGUAGE);

  // reload 之后重新等就绪，最后断言 DOM（D-18 的顺序）
  await page.reload();
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);
  await expect(
    page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`).filter({ hasText: ENTRY_TEXT }),
  ).toBeVisible();
});
