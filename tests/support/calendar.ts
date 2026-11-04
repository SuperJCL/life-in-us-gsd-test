// 日历视图的页面内读回 helper（CAL-01 到 CAL-04）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 应用每次重绘都会重建日历 DOM，所以这里只返回读回值，不持有元素句柄。
//
// 隐私（D-05）：日历里到期和完成的 chip、日面板“完成的计划”“这天到期”条目的文字是个人计划原文，
// 所以本文件只在 page.evaluate 里读日期、类名、aria-label（只有日期和数量）、数量、id 和组号，
// 从不读 chip 或条目的文字，也不返回元素定位器，失败输出里不会出现计划原文。
import { expect, type Page } from '@playwright/test';
import { TAB_LABELS } from './strings';

// 打开日历标签并确认它已被选中
export async function gotoCalendar(page: Page) {
  const tab = page.getByRole('tab', { name: TAB_LABELS.cal, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

// 单元格的读回形状。与 expect-from-fixture.ts 的 MonthCell 同形，两个文件各自声明，靠 toEqual 比较
export type CellRead = {
  date: string;
  out: boolean;
  today: boolean;
  sel: boolean;
  arr: boolean;
  aria: string;
  day: string;
  kinds: ('log' | 'due' | 'done')[];
  more: string | null;
};

// 一次 page.evaluate 读回整个月历：标题、7 个表头、每一格（只读日期、四个类、aria-label、日号、chip 种类、+N）
export async function readMonth(page: Page): Promise<{ title: string; dow: string[]; cells: CellRead[] }> {
  return page.evaluate(() => {
    const title = document.querySelector('#monthTitle')?.textContent ?? '';
    const dow = Array.from(document.querySelectorAll('#dow .dow')).map((d) => d.textContent ?? '');
    const cells = Array.from(document.querySelectorAll('#grid [data-date]')).map((c) => {
      const kinds = Array.from(c.querySelectorAll('.chips .chip')).map((chip) =>
        chip.classList.contains('due') ? 'due' : chip.classList.contains('done') ? 'done' : 'log',
      ) as ('log' | 'due' | 'done')[];
      return {
        date: c.getAttribute('data-date') ?? '',
        out: c.classList.contains('out'),
        today: c.classList.contains('today'),
        sel: c.classList.contains('sel'),
        arr: c.classList.contains('arr'),
        aria: c.getAttribute('aria-label') ?? '',
        day: c.querySelector('.d')?.textContent ?? '',
        kinds,
        more: c.querySelector('.more')?.textContent ?? null,
      };
    });
    return { title, dow, cells };
  });
}
