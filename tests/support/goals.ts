// 目标视图的页面内读回 helper（GOAL-01 到 GOAL-05）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 应用每次重绘都会重建目标视图 DOM，所以这里只返回读回值，不持有元素句柄。
//
// 隐私（D-05）：内置任务复选框的 aria-label、.tt 任务文字、组标题、组说明、力量名称和目标都是个人计划文字，
// 所以本文件只在 page.evaluate 里读组号、计数文字、id、进度条数值和类名（以及布尔），
// 从不读上述元素的文字，也不返回元素定位器，失败输出里不会出现个人计划原文。
import { expect, type Page } from '@playwright/test';
import { LIFT_HISTORY_PREFIX, TAB_LABELS } from './strings';

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

// 一张力量卡的读回形状。名称、目标、单位和备注都不读；只有序号、LIFT_IDS 里的 id、数值和布尔
export type LiftCardRead = {
  index: number;
  fixtureId: string | null;
  value: string | null;
  saveHidden: boolean;
  valueMatchesCurrent: boolean;
  barPct: number | null;
  hasHistory: boolean;
};

// 一次 page.evaluate 读回所有力量卡（按 DOM 顺序，每一张都在）。
// fixtureId 只在输入框的 data-lift 属于 fixtureIds 时返回，否则为 null，所以其余卡片的 id 不带回 Node。
// value 只对 fixtureId 不为 null 的卡返回。valueMatchesCurrent 在页面内比较输入框的值和该卡显示的当前值
// （只取目标子元素之前的那个文字节点，不读目标子元素），只返回布尔。
// hasHistory 是历史行的文字是否以前缀开头：没有历史的卡片那一行显示的是个人备注，所以只返回布尔
export async function readLifts(
  page: Page,
  fixtureIds: readonly string[],
): Promise<{ count: number; cards: LiftCardRead[] }> {
  return page.evaluate(
    ({ ids, prefix }) => {
      const lifts = Array.from(document.querySelectorAll('#goals .lift'));
      const cards = lifts.map((card, index) => {
        const input = card.querySelector('input[data-lift]') as HTMLInputElement | null;
        const dataLift = input?.getAttribute('data-lift') ?? '';
        const fixtureId = ids.includes(dataLift) ? dataLift : null;
        const cur = card.querySelector('.lv')?.firstChild?.textContent ?? '';
        const styleAttr = card.querySelector('.lbar i')?.getAttribute('style') ?? '';
        const m = /width:\s*([\d.]+)%/.exec(styleAttr);
        return {
          index,
          fixtureId,
          value: fixtureId !== null && input ? input.value : null,
          saveHidden: !!card.querySelector('[data-liftsave]')?.classList.contains('hidden'),
          valueMatchesCurrent: !!input && cur.trim() !== '' && parseFloat(input.value) === parseFloat(cur),
          barPct: m ? Number(m[1]) : null,
          hasHistory: (card.querySelector('.hist')?.textContent ?? '').startsWith(prefix),
        };
      });
      return { count: lifts.length, cards };
    },
    { ids: [...fixtureIds], prefix: LIFT_HISTORY_PREFIX },
  );
}

// 含 #lf-<id> 的那张卡的历史行文字是否等于 expected，只返回布尔。
// 没有历史的卡片这一行显示的是个人备注，所以不返回文字
export async function liftHistoryEquals(page: Page, id: string, expected: string): Promise<boolean> {
  return page.evaluate(
    ({ id, expected }) => {
      const card = document.getElementById('lf-' + id)?.closest('.lift');
      return (card?.querySelector('.hist')?.textContent ?? null) === expected;
    },
    { id, expected },
  );
}
