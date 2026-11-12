// 共用确认框（dialog#confirm）的 helper：读内容、点“确认”、点“取消”、点三选一的中间按钮。
// 这里只能从 @playwright/test 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 确认框的文字只用 textContent 写入；这里读回的行在失败消息里不会打印（用例按需比较）。
import { expect, type Page } from '@playwright/test';

export type ConfirmContent = {
  // #cf-title 的文字
  title: string;
  // #cf-body 里每个 <p> 的文字，按顺序
  lines: string[];
  // 带 cf-warn 类（醒目提示）的行的文字，按顺序
  warn: string[];
  // 可见的按钮（取消、中间、确认），按 DOM 顺序：id、文字、class（ghost、primary、danger）
  buttons: Array<{ id: string; text: string; cls: string }>;
  // 当前焦点按钮的 id（焦点不在对话框的按钮上时为空串）
  focused: string;
};

// 等 dialog#confirm 打开，读回标题、全部行、醒目行、可见按钮和焦点按钮
export async function readConfirm(page: Page): Promise<ConfirmContent> {
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', true);
  return page.evaluate(() => ({
    title: document.querySelector('#cf-title')?.textContent ?? '',
    lines: Array.from(document.querySelectorAll('#cf-body p')).map((p) => p.textContent ?? ''),
    warn: Array.from(document.querySelectorAll('#cf-body p.cf-warn')).map((p) => p.textContent ?? ''),
    buttons: Array.from(document.querySelectorAll<HTMLButtonElement>('dialog#confirm .ed-foot button'))
      .filter((b) => !b.classList.contains('hidden'))
      .map((b) => ({ id: b.id, text: b.textContent ?? '', cls: b.className })),
    focused:
      document.activeElement instanceof HTMLButtonElement && document.activeElement.closest('dialog#confirm')
        ? document.activeElement.id
        : '',
  }));
}

// 点“确认”按钮（#cfOk），等对话框关闭
export async function confirmOk(page: Page) {
  await page.locator('#cfOk').click();
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
}

// 点“取消”按钮（#cfCancel），等对话框关闭
export async function confirmCancel(page: Page) {
  await page.locator('#cfCancel').click();
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
}

// 点三选一的中间按钮（#cfMid），等对话框关闭
export async function confirmMid(page: Page) {
  await page.locator('#cfMid').click();
  await expect(page.locator('dialog#confirm')).toHaveJSProperty('open', false);
}
