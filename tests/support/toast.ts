// toast 的 helper（D-04、D-08、D-14）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
//
// 两点约定：
//  1. toast 消失后文字仍留在 DOM 里，而且 opacity 为 0 的元素在 Playwright 看来仍算显示，
//     所以是否显示只看 #toast 的 on 类，不用可见性判断。
//  2. toast 的文字可能带内置预设原文（点内置的直接记录预设、删除内置标签之后），
//     定位器断言失败时会把实际文字打印出来。所以本文件只用 page.evaluate 把状态读回来，
//     在 Node 侧用 expect.poll 比较，失败消息只写期望值或“内容已隐藏”。
import { expect, type Page } from '@playwright/test';
import { TOAST_UNDO_LABEL } from './strings';

// 一次读回 toast 的全部状态：on、act 类，消息文字（只含 span，不含按钮文字），按钮文字
async function readToast(page: Page) {
  return page.evaluate(() => {
    const t = document.querySelector('#toast');
    return {
      on: !!t && t.classList.contains('on'),
      act: !!t && t.classList.contains('act'),
      text: t?.querySelector('span')?.textContent ?? '',
      button: t?.querySelector('button')?.textContent ?? null,
    };
  });
}

// toast 显示并且文案完全等于 text。
// 参数只能是 strings.ts 常量或常量加合成文字；含内置原文的 toast 用 expectToastPrefix
export async function expectToast(page: Page, text: string) {
  await expect
    .poll(
      async () => {
        const t = await readToast(page);
        return t.on && t.text === text;
      },
      { message: `toast 没有显示期望的文案：${text}（实际内容已隐藏）` },
    )
    .toBe(true);
}

// toast 显示并且文案以 prefix 开头；失败消息不含任何文字（D-14）
export async function expectToastPrefix(page: Page, prefix: string) {
  await expect
    .poll(
      async () => {
        const t = await readToast(page);
        return t.on && t.text.startsWith(prefix);
      },
      { message: 'toast 文案前缀不对（内容已隐藏）' },
    )
    .toBe(true);
}

// toast 显示并且带撤销按钮
export async function expectUndoOffered(page: Page) {
  await expect
    .poll(
      async () => {
        const t = await readToast(page);
        return t.on && t.act && t.button === TOAST_UNDO_LABEL;
      },
      { message: 'toast 没有带撤销按钮（内容已隐藏）' },
    )
    .toBe(true);
}

// 点 toast 里的撤销按钮。这个按钮的属性和文字里只有“撤销”，点击日志不会带出别的内容
export async function undo(page: Page) {
  await expectUndoOffered(page);
  await page.locator('#toast.act button').click();
}

// toast 已经隐藏
export async function expectToastGone(page: Page) {
  await expect
    .poll(async () => (await readToast(page)).on, { message: 'toast 仍在显示（内容已隐藏）' })
    .toBe(false);
}
