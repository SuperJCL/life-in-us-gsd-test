// 记一笔（composer）的 helper：本周视图的实例 p='w' 和日历日面板的实例 p='c' 共用同一套选择器（D-01、D-07）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 应用每次重绘都会重建 composer 的 DOM，所以这里只返回定位器，不持有元素句柄。
import { expect, type Page } from '@playwright/test';

export type ComposerId = 'w' | 'c';

export function composer(page: Page, p: ComposerId) {
  const root = page.locator(p === 'w' ? '#wkComp' : '#dayPanel');
  const text = root.locator(`#${p}-text`);
  const addButton = root.locator(`#${p}-add`);

  return {
    root,
    text,
    addButton,
    when: root.locator('.when'),

    // 类别按钮，name 只会是 strings.ts 里的类别显示名
    categoryButton(name: string) {
      return root.locator(`[data-ccat="${p}|${name}"]`);
    },

    // 点类别按钮，再确认它已被按下
    async pickCategory(name: string) {
      const button = root.locator(`[data-ccat="${p}|${name}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    },

    // 整体替换文本框内容（空字符串即清空）
    async type(s: string) {
      await text.fill(s);
    },

    // 在已有内容末尾追加：先点文本框，Control+End 移到末尾，再逐字输入。
    // 这样不会把预填进来的标签文字作为参数传给 fill
    async append(s: string) {
      await text.click();
      await text.press('Control+End');
      await text.pressSequentially(s);
    },

    // 提交：点“记录”按钮，或在文本框里按 Control+Enter
    async submit(how: 'click' | 'keyboard' = 'click') {
      if (how === 'click') {
        await addButton.click();
      } else {
        await text.press('Control+Enter');
      }
    },

    // 当前草稿。填进内置预填文字之后，只在 Node 侧做布尔比较，不用单元素的值断言（失败时会打印值）
    async draft() {
      return text.inputValue();
    },
  };
}
