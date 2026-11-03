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

    // ---- 预设标签 ----
    // 内置预设文字是个人计划，只按序号选。Playwright 的动作和单元素断言失败时，调用日志会打印
    // 命中元素的预览（含 data-preset、data-pdel、aria-label 和按钮文字），元素被遮挡时还会打印
    // 遮挡元素的预览，所以凡是按序号操作的方法都在页面内完成：用 page.evaluate，选择器只由
    // 根节点 id 和 p 拼出，不含任何标签文字，只把序号、布尔或文字带回 Node。
    // 带回的文字只能用于布尔比较，不能打印、拼进选择器或写进注解。
    // 应用给每个预设按钮和删除按钮直接挂了 click 监听，页面内调用元素的 click() 会触发同一个
    // 处理函数，但不走真实指针路径；预设按钮的真实点击由合成标签的用例证明。

    // 定位器：只用于计数断言和合成标签
    presets: root.locator(`[data-preset^="${p}|"]`),
    deleteButtons: root.locator(`[data-pdel^="${p}|"]`),
    editButton: root.locator(`[data-pedit="${p}"]`),
    addInput: root.locator(`#${p}-padd`),
    // 只用于 SYNTH- 开头的标签和 fixture 里的合成自定义标签
    presetNamed(name: string) {
      return root.locator(`[data-preset="${p}|${name}"]`);
    },

    // 页面内读取：第 n 个预设按钮的文字，不存在时为 null
    async presetText(n: number): Promise<string | null> {
      return page.evaluate(
        ({ rootId, p, n }) => {
          const list = document.querySelectorAll(`#${rootId} [data-preset^="${p}|"]`);
          return n >= 0 && n < list.length ? list[n].textContent : null;
        },
        { rootId: rootIdOf(p), p, n },
      );
    },

    // 第 n 个预设是否是“预填”型（文字以全角或半角冒号结尾）
    async presetFills(n: number): Promise<boolean> {
      return page.evaluate(
        ({ rootId, p, n }) => {
          const list = document.querySelectorAll(`#${rootId} [data-preset^="${p}|"]`);
          return n >= 0 && n < list.length && /[：:]$/.test(list[n].textContent ?? '');
        },
        { rootId: rootIdOf(p), p, n },
      );
    },

    // 前 limit 个（缺省全部）预设里，预填型（fill）或直接记录型（direct）的序号
    async presetIndexes(kind: 'fill' | 'direct', limit?: number): Promise<number[]> {
      return page.evaluate(
        ({ rootId, p, kind, limit }) => {
          const list = Array.from(document.querySelectorAll(`#${rootId} [data-preset^="${p}|"]`));
          const upto = limit === undefined ? list.length : Math.min(limit, list.length);
          const out: number[] = [];
          for (let i = 0; i < upto; i++) {
            const fills = /[：:]$/.test(list[i].textContent ?? '');
            if (fills === (kind === 'fill')) out.push(i);
          }
          return out;
        },
        { rootId: rootIdOf(p), p, kind, limit },
      );
    },

    // data-preset 等于 `<p>|<name>` 的按钮在全部预设里的序号，没有时为 -1（name 只能是合成标签）
    async presetIndexOf(name: string): Promise<number> {
      return page.evaluate(
        ({ rootId, p, name }) => {
          const list = Array.from(document.querySelectorAll(`#${rootId} [data-preset^="${p}|"]`));
          return list.findIndex((el) => el.getAttribute('data-preset') === `${p}|${name}`);
        },
        { rootId: rootIdOf(p), p, name },
      );
    },

    // 页面内点击第 n 个预设按钮
    async clickPreset(n: number) {
      const found = await page.evaluate(
        ({ rootId, p, n }) => {
          const list = document.querySelectorAll<HTMLElement>(`#${rootId} [data-preset^="${p}|"]`);
          if (n < 0 || n >= list.length) return false;
          list[n].click();
          return true;
        },
        { rootId: rootIdOf(p), p, n },
      );
      expect(found, '第 ' + n + ' 个预设按钮不存在').toBe(true);
    },

    // 页面内点击第 n 个预设的删除按钮（编辑模式下才有）
    async deletePreset(n: number) {
      const found = await page.evaluate(
        ({ rootId, p, n }) => {
          const list = document.querySelectorAll<HTMLElement>(`#${rootId} [data-pdel^="${p}|"]`);
          if (n < 0 || n >= list.length) return false;
          list[n].click();
          return true;
        },
        { rootId: rootIdOf(p), p, n },
      );
      expect(found, '第 ' + n + ' 个删除按钮不存在').toBe(true);
    },

    // 真实点击，只用于合成标签：点“添加标签”，输入名字后按 Enter 提交（不靠失焦提交，避免重绘后点击落空）
    async addPreset(name: string) {
      await root.locator(`[data-padd="${p}"]`).click();
      await expect(root.locator(`#${p}-padd`)).toBeFocused();
      await root.locator(`#${p}-padd`).fill(name);
      await root.locator(`#${p}-padd`).press('Enter');
    },

    // 点“编辑 / 完成”按钮切换编辑模式
    async toggleEditMode() {
      await root.locator(`[data-pedit="${p}"]`).click();
    },

    // 真实点击合成标签的删除按钮
    async deletePresetNamed(name: string) {
      await root.locator(`[data-pdel="${p}|${name}"]`).click();
    },
  };
}

// 根节点的 id，只由 p 决定，不含任何标签文字
function rootIdOf(p: ComposerId) {
  return p === 'w' ? 'wkComp' : 'dayPanel';
}
