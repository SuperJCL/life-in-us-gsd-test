// 日历视图的页面内读回 helper（CAL-01 到 CAL-04）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 应用每次重绘都会重建日历 DOM，所以这里只返回读回值，不持有元素句柄。
//
// 隐私（D-05）：日历里到期和完成的 chip、日面板“完成的计划”“这天到期”条目的文字是个人计划原文，
// 所以本文件只在 page.evaluate 里读日期、类名、aria-label（只有日期和数量）、数量、id 和组号，
// 从不读 chip 或条目的文字，也不返回元素定位器，失败输出里不会出现计划原文。
import { expect, type Page } from '@playwright/test';
import { DAY_SECTION_DUE, TAB_LABELS } from './strings';

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

// 某一格里记录 chip（不含到期和完成）的类别类名：每个 chip 一个数组，只含 k- 开头的类。不读文字
export async function readCellLogClasses(page: Page, date: string): Promise<string[][]> {
  return page.evaluate((d) => {
    const cell = Array.from(document.querySelectorAll('#grid [data-date]')).find((c) => c.getAttribute('data-date') === d);
    if (!cell) return [];
    return Array.from(cell.querySelectorAll('.chips .chip'))
      .filter((chip) => !chip.classList.contains('due') && !chip.classList.contains('done'))
      .map((chip) => Array.from(chip.classList).filter((c) => c.startsWith('k-')));
  }, date);
}

// 日面板里每条记录（li[data-edit]）的类别类名：每条一个数组，只含 k- 开头的类。不读文字
export async function readDayPanelLogClasses(page: Page): Promise<string[][]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#dayPanel li[data-edit]')).map((li) =>
      Array.from(li.classList).filter((c) => c.startsWith('k-')),
    ),
  );
}

// 日面板的读回形状，与 expect-from-fixture.ts 的 DayPanelRead 同形，两个文件各自声明，靠 toEqual 比较
export type DayPanelReadback = {
  title: string;
  sub: string;
  when: string;
  sections: string[];
  logIds: string[];
  empty: string | null;
  doneIds: string[];
  dueGroups: string[];
};

// 一次 page.evaluate 读回日面板：标题、副标题、“记录到”、分区标题、记录 id、空提示、完成计划 id、到期条目的组号。
// 计划条目的 .li-text 和 aria-label 是任务原文，不读（D-05）；到期条目只读 .tag（组号）
export async function readDayPanel(page: Page): Promise<DayPanelReadback> {
  return page.evaluate((dueSection) => {
    const panel = document.querySelector('#dayPanel');
    const sections = Array.from(panel?.querySelectorAll('.sect') ?? []);
    const dueHeader = sections.find((s) => s.textContent === dueSection);
    const dueList = dueHeader?.nextElementSibling;
    return {
      title: panel?.querySelector(':scope > h3')?.textContent ?? '',
      sub: panel?.querySelector(':scope > p.sub')?.textContent ?? '',
      when: panel?.querySelector('.when')?.textContent ?? '',
      sections: sections.map((s) => s.textContent ?? ''),
      logIds: Array.from(panel?.querySelectorAll('li[data-edit]') ?? []).map((li) => li.getAttribute('data-edit') ?? ''),
      empty: panel?.querySelector('p.empty')?.textContent ?? null,
      doneIds: Array.from(panel?.querySelectorAll('li[data-edittask]') ?? []).map(
        (li) => li.getAttribute('data-edittask') ?? '',
      ),
      dueGroups:
        dueList && dueList.matches('ul.items')
          ? Array.from(dueList.querySelectorAll('li')).map((li) => li.querySelector('.tag')?.textContent ?? '')
          : [],
    };
  }, DAY_SECTION_DUE);
}
