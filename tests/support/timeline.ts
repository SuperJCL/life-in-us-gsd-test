// 时间线视图的页面内读回 helper（TL-01、TL-02）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 应用每次重绘都会重建时间线 DOM，所以这里只返回读回值，不持有元素句柄。
//
// 隐私（D-07）：时间线里完成的计划条目，文字是“完成：”加内置任务原文，标签是组号，都是个人计划内容，
// 所以本文件只在 page.evaluate 里读 id、日期和所属月份标题，对完成的计划从不读文字节点和标签，
// 也不返回元素定位器，失败输出里不会出现计划原文。记录条目只额外读 .tag（类别显示名，固定界面文案）。
import { expect, type Page } from '@playwright/test';
import { TAB_LABELS } from './strings';

// 打开时间线标签并确认它已被选中
export async function gotoTimeline(page: Page) {
  const tab = page.getByRole('tab', { name: TAB_LABELS.tl, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

// 点一个筛选按钮并确认它已被按下。
// value 只能是 strings.ts 的筛选常量（FILTER_ALL、FILTER_DONE_TASKS）或 CATEGORY_NAMES 里的类别名，都是固定界面文案
export async function pickFilter(page: Page, value: string) {
  const button = page.locator(`#filters [data-filter="${value}"]`);
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
}

// 时间线的读回形状。与 expect-from-fixture.ts 的 TimelineExpectation 同形，两个文件各自声明，靠 toEqual 比较
export type TimelineReadback = {
  filters: { value: string; pressed: string }[];
  months: string[];
  rows: { attr: string; id: string; month: string; date: string; tag: string | null }[];
  empty: string | null;
};

// 一次 page.evaluate 读回整个时间线：七个筛选按钮的值和 aria-pressed，
// 按 DOM 顺序遍历 #timeline 的直接子元素得到月份标题和条目（attr、id、所属月份、M/D 日期），
// 记录条目的 .tag，以及空提示。不读条目的文字节点，不读完成的计划的标签
export async function readTimeline(page: Page): Promise<TimelineReadback> {
  return page.evaluate(() => {
    const filters = Array.from(document.querySelectorAll('#filters [data-filter]')).map((b) => ({
      value: b.getAttribute('data-filter') ?? '',
      pressed: b.getAttribute('aria-pressed') ?? '',
    }));
    const months: string[] = [];
    const rows: { attr: string; id: string; month: string; date: string; tag: string | null }[] = [];
    let month = '';
    for (const el of Array.from(document.querySelector('#timeline')?.children ?? [])) {
      if (el.classList.contains('tl-month')) {
        month = el.textContent ?? '';
        months.push(month);
      } else if (el.classList.contains('tl-item')) {
        const attr = el.hasAttribute('data-edit') ? 'edit' : 'edittask';
        rows.push({
          attr,
          id: el.getAttribute(attr === 'edit' ? 'data-edit' : 'data-edittask') ?? '',
          month,
          date: el.querySelector('.tl-date')?.textContent ?? '',
          tag: attr === 'edit' ? (el.querySelector('.tag')?.textContent ?? '') : null,
        });
      }
    }
    return { filters, months, rows, empty: document.querySelector('#timeline .empty')?.textContent ?? null };
  });
}
