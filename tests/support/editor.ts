// 编辑弹窗（dialog#editor）的 helper（D-08）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
//
// 三点约定：
//  1. 弹窗是 showModal 打开的，背景不可交互：弹窗打开期间不要操作弹窗以外的元素，先确认弹窗已关闭。
//  2. 点类别按钮会重绘整个表单（文本框和日期框是新元素），所以这里只返回定位器，不持有元素句柄，
//     每一步都重新定位。
//  3. Escape 和点遮罩走浏览器原生关闭，应用不参与；这里不封装它们，由用例直接按键或点击。
//
// 隐私（D-14）：弹窗只为合成条目（SYNTH- 记录和合成的自定义计划）打开，调用者要保证这一点；
// 完成的内置计划的弹窗会显示个人计划原文，不能用本 helper 打开。
import { expect, type Locator, type Page } from '@playwright/test';
import { EDITOR_TITLE_LOG, EDITOR_TITLE_TASK } from './strings';

export function editor(page: Page) {
  const dialog = page.locator('dialog#editor');
  const title = dialog.locator('#ed-title');
  const text = dialog.locator('#ed-text');
  const date = dialog.locator('#ed-date');
  const saveButton = dialog.locator('#ed-save');
  const cancelButton = dialog.locator('#ed-cancel');
  const deleteButton = dialog.locator('#ed-del');
  const undoneButton = dialog.locator('#ed-undone');

  // 弹窗是否打开只看 open 属性
  const expectOpen = async () => {
    await expect(dialog).toHaveAttribute('open', '');
  };
  const expectClosed = async () => {
    await expect(dialog).not.toHaveAttribute('open', '');
  };

  return {
    dialog,
    title,
    text,
    date,
    saveButton,
    cancelButton,
    deleteButton,
    undoneButton,

    // 类别按钮，name 只会是 strings.ts 里的类别显示名
    categoryButton(name: string) {
      return dialog.locator(`[data-edcat="${name}"]`);
    },

    expectOpen,
    expectClosed,

    // 点记录条目打开弹窗，并确认标题是“编辑记录”。
    // 日面板的条目里还有删除按钮，调用者要传条目里的 .li-text，不要传整条
    async openLog(entry: Locator) {
      await entry.click();
      await expectOpen();
      await expect(title).toHaveText(EDITOR_TITLE_LOG);
    },

    // 点已完成的计划打开弹窗，并确认标题是“完成的计划”。调用者只能传合成的自定义计划（D-14）
    async openTask(entry: Locator) {
      await entry.click();
      await expectOpen();
      await expect(title).toHaveText(EDITOR_TITLE_TASK);
    },

    // 整体替换文本框内容
    async setText(s: string) {
      await text.fill(s);
    },

    // 点类别按钮并确认它已被按下；点完整个表单被重绘
    async setCategory(name: string) {
      const button = dialog.locator(`[data-edcat="${name}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    },

    async setDate(ymd: string) {
      await date.fill(ymd);
    },

    // 保存：点“保存”，或在文本框里按 Control+Enter
    async save(how: 'click' | 'keyboard' = 'click') {
      if (how === 'click') {
        await saveButton.click();
      } else {
        await text.press('Control+Enter');
      }
    },

    async deleteEntry() {
      await deleteButton.click();
    },

    async cancel() {
      await cancelButton.click();
    },

    // 完成计划弹窗里的“标记为未完成”
    async markUndone() {
      await undoneButton.click();
    },
  };
}
