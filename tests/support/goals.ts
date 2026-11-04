// 目标视图的页面内读回 helper（GOAL-01 到 GOAL-05）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 应用每次重绘都会重建目标视图 DOM，所以这里只返回读回值，不持有元素句柄。
//
// 隐私（D-05）：内置任务复选框的 aria-label、.tt 任务文字、组标题、组说明、力量名称和目标都是个人计划文字，
// 所以本文件只在 page.evaluate 里读组号、计数文字、id、进度条数值和类名（以及布尔），
// 从不读上述元素的文字，也不返回元素定位器，失败输出里不会出现个人计划原文。
import { expect, type Page } from '@playwright/test';
import { TAB_LABELS } from './strings';

// 打开目标标签并确认它已被选中
export async function gotoGoals(page: Page) {
  const tab = page.getByRole('tab', { name: TAB_LABELS.goal, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

// 一个目标组的读回形状。与 expect-from-fixture.ts 的 GroupExpectation 同形，两个文件各自声明，靠 toEqual 比较
export type GroupRead = {
  code: string;
  cnt: string;
  taskIds: string[];
  barPct: number | null;
  doneIds: string[];
  overdueIds: string[];
  dueInputIds: string[];
  deleteIds: string[];
};

// 一次 page.evaluate 读回全部目标组（P1 到 P7）。健身那一组没有 .cnt，不算目标组。
// 进度条宽度取 style 属性原文里 width 的数值（不取计算后的样式），数字与应用写进去的完全一样
export async function readGroups(page: Page): Promise<GroupRead[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#goals .group'))
      .filter((g) => g.querySelector('.cnt'))
      .map((g) => {
        const rows = Array.from(g.querySelectorAll('.task'));
        const idOf = (row: Element) => row.querySelector('[data-task]')?.getAttribute('data-task') ?? '';
        const styleAttr = g.querySelector('.bar i')?.getAttribute('style') ?? '';
        const m = /width:\s*([\d.]+)%/.exec(styleAttr);
        return {
          code: g.querySelector('.group-h .p')?.textContent ?? '',
          cnt: g.querySelector('.cnt')?.textContent ?? '',
          taskIds: Array.from(g.querySelectorAll('[data-task]')).map((c) => c.getAttribute('data-task') ?? ''),
          barPct: m ? Number(m[1]) : null,
          doneIds: rows.filter((r) => r.classList.contains('isdone')).map(idOf),
          overdueIds: rows.filter((r) => r.querySelector('.od')).map(idOf),
          dueInputIds: Array.from(g.querySelectorAll('[data-due]')).map((c) => c.getAttribute('data-due') ?? ''),
          deleteIds: Array.from(g.querySelectorAll('[data-deltask]')).map((c) => c.getAttribute('data-deltask') ?? ''),
        };
      }),
  );
}
