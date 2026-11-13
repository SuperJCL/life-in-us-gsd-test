// 「从示例里挑」对话框（dialog#sample）和空计划卡片入口的 helper（Phase 14）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 隐私：对话框里的示例名称是公开的合成样本，但写进计划的内容可能是个人文字，所以 readPicker、readCardEntry 只返回键（data-pk）、
// 计数、布尔和界面文案，不读计划文字；定位器按 data-* 属性和 id 取。
import { expect, type Page } from '@playwright/test';

// 点空计划卡片的「从示例里挑」，等对话框打开
export async function openPicker(page: Page) {
  await page.locator('#planSampleBtn').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', true);
}

// 勾选一项，key 的格式：g:<示例组 id> 或 l:<示例力量项 id>
export async function pick(page: Page, key: string) {
  await page.locator(`dialog#sample input[data-pk="${key}"]`).check();
}

export type PickerState = {
  open: boolean;
  title: string;
  // #pk-hint 的文字和 data-tone（没有时为 null）
  hint: string;
  tone: string | null;
  okText: string;
  okAriaDisabled: boolean;
  okDisabled: boolean;
  okBusy: boolean;
  cancelDisabled: boolean;
  // 已勾选、真 disabled、带「已在计划里」标记的复选框的 data-pk 键，按 DOM 顺序
  checked: string[];
  disabled: string[];
  dup: string[];
  // 两个分区的名额提示（.pk-lim）的文字，没有时为 null
  limG: string | null;
  limL: string | null;
  // 获得焦点的复选框的键，或对话框里获得焦点的按钮的 id；焦点不在对话框里为空串
  focusKey: string;
};

// 一次 evaluate 读回对话框的全部状态
export async function readPicker(page: Page): Promise<PickerState> {
  return page.evaluate(() => {
    const dlg = document.querySelector<HTMLDialogElement>('dialog#sample');
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>('dialog#sample input[data-pk]'));
    const keyOf = (i: HTMLInputElement) => i.getAttribute('data-pk') ?? '';
    const ok = document.querySelector<HTMLButtonElement>('#pkOk');
    const cancel = document.querySelector<HTMLButtonElement>('#pkCancel');
    const hint = document.querySelector('#pk-hint');
    const lims = Array.from(document.querySelectorAll('dialog#sample .pk-lim'));
    const act = document.activeElement;
    let focusKey = '';
    if (act && dlg && dlg.contains(act)) {
      focusKey = act instanceof HTMLInputElement && act.hasAttribute('data-pk') ? keyOf(act) : act.id;
    }
    return {
      open: !!dlg && dlg.open,
      title: document.querySelector('#pk-title')?.textContent ?? '',
      hint: hint?.textContent ?? '',
      tone: hint?.getAttribute('data-tone') ?? null,
      okText: ok?.textContent ?? '',
      okAriaDisabled: ok?.getAttribute('aria-disabled') === 'true',
      okDisabled: !!ok?.disabled,
      okBusy: ok?.getAttribute('aria-busy') === 'true',
      cancelDisabled: !!cancel?.disabled,
      checked: boxes.filter((i) => i.checked).map(keyOf),
      disabled: boxes.filter((i) => i.disabled).map(keyOf),
      dup: boxes.filter((i) => i.hasAttribute('data-dup')).map(keyOf),
      limG: lims[0]?.textContent ?? null,
      limL: lims[1]?.textContent ?? null,
      focusKey,
    };
  });
}

export type CardEntryState = {
  sampleAriaDisabled: boolean;
  sampleDisabled: boolean;
  // #planSampleWhy 的文字（没有说明时为空串）
  why: string;
  buildAriaDisabled: boolean;
  buildDisabled: boolean;
};

// 读空计划卡片两个入口的状态：「从示例里挑」（#planSampleBtn）、说明行、「自己建一份」（#planEditBtn2）
export async function readCardEntry(page: Page): Promise<CardEntryState> {
  return page.evaluate(() => {
    const s = document.querySelector<HTMLButtonElement>('#planSampleBtn');
    const b = document.querySelector<HTMLButtonElement>('#planEditBtn2');
    return {
      sampleAriaDisabled: s?.getAttribute('aria-disabled') === 'true',
      sampleDisabled: !!s?.disabled,
      why: document.querySelector('#planSampleWhy')?.textContent ?? '',
      buildAriaDisabled: b?.getAttribute('aria-disabled') === 'true',
      buildDisabled: !!b?.disabled,
    };
  });
}

// 点编辑计划页的「从示例添加」（#peSampleBtn），等对话框打开
export async function openPickerFromEditor(page: Page) {
  await page.locator('#peSampleBtn').click();
  await expect(page.locator('dialog#sample')).toHaveJSProperty('open', true);
}
