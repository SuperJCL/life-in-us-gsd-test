// 健身页用例的共用操作和读回（Phase 15）。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 隐私（D-05）：只读合成数据；一次 page.evaluate 读回布尔、数值和固定界面文案，
// 不返回元素句柄，也不把计划文字带回 Node（动作名只在页面里和期望值做相等比较，由调用方决定要不要比较）。
import { expect, type Page } from '@playwright/test';
import { TAB_LABELS } from './strings';

// 打开健身标签并等记录区出现
export async function gotoFitness(page: Page) {
  const tab = page.getByRole('tab', { name: TAB_LABELS.fit, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#tab-fit')).toBeVisible();
}

// 点「＋ 动作名」芯片，把力量项 id 对应的动作块加进这次训练
export async function flAddLift(page: Page, id: string) {
  await page.locator(`[data-fl-add="lift:${id}"]`).click();
  await expect(page.locator(`.fl-ex[data-lift="${id}"]`)).toBeVisible();
}

// 填第 j 组（从 0 数）的重量和次数
export async function flFillSet(page: Page, id: string, j: number, w: string, r: string) {
  await page.locator(`#fl-w-${id}-${j}`).fill(w);
  await page.locator(`#fl-r-${id}-${j}`).fill(r);
}

// 点保存按钮
export async function flSave(page: Page) {
  await page.locator('#fl-save').click();
}

export type WeekWoRead = { text: string; draggable: boolean; edit: boolean };

// 读本周页某一天的训练行（.ent.wo[data-wo=<日期>]）：文字、是否可拖动、是否带 data-edit；没有这一行返回 null
export async function readWeekWo(page: Page, date: string): Promise<WeekWoRead | null> {
  return page.evaluate((d) => {
    const el = Array.from(document.querySelectorAll<HTMLElement>('#days .ent.wo')).find((x) => x.dataset.wo === d);
    if (!el) return null;
    const first = el.querySelector('span');
    return {
      text: first ? (first.textContent ?? '') : '',
      draggable: el.hasAttribute('draggable') && el.getAttribute('draggable') !== 'false',
      edit: el.hasAttribute('data-edit'),
    };
  }, date);
}

// 已保存 state 里的 workouts（JSON 往返，没有这个键就是空对象）
export function savedWorkouts(state: any): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state?.workouts ?? {}));
}

// ---- Phase 15-02：记录区的共用操作 ----

// 点某个动作块的「复制上一组」
export async function flCopySet(page: Page, id: string) {
  await page.locator(`.fl-ex[data-lift="${id}"] [data-flact="copyset"]`).click();
}

// 第 j 组（从 0 数）的错误行是否可见，并且文字等于 expected（只返回布尔，不把文字带回 Node）
export async function flError(page: Page, id: string, j: number, expected: string): Promise<boolean> {
  return page.evaluate(
    ([i, n, t]) => {
      const el = document.getElementById(`fl-e-${i}-${n}`);
      return !!el && !el.hidden && el.textContent === t;
    },
    [id, String(j), expected] as const,
  );
}

export type FlRead = { id: string; sets: Array<{ w: string; r: string }> };

// 读回记录区里每个力量动作块：id 和每组两个输入框的值（只对合成或示例 id）
export async function readFl(page: Page): Promise<FlRead[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#fl .fl-ex')).map((bx) => ({
      id: bx.dataset.lift ?? '',
      sets: Array.from(bx.querySelectorAll<HTMLElement>('.fl-set')).map((li) => {
        const ins = li.querySelectorAll<HTMLInputElement>('input');
        return { w: ins[0]?.value ?? '', r: ins[1]?.value ?? '' };
      }),
    })),
  );
}

// 点芯片，把有氧项 id 对应的有氧行加进这次训练
export async function flAddCardio(page: Page, id: string) {
  await page.locator(`[data-fl-add="cardio:${id}"]`).click();
  await expect(page.locator(`.fl-cd[data-cardio="${id}"]`)).toBeVisible();
}

// 填有氧行的时长，距离留空就不传
export async function flFillCardio(page: Page, id: string, m: string, d?: string) {
  await page.locator(`#fl-m-${id}`).fill(m);
  if (d !== undefined) await page.locator(`#fl-d-${id}`).fill(d);
}

// 点某个动作块第 j 组（从 0 数）的「删除」
export async function flDeleteSet(page: Page, id: string, j: number) {
  await page.locator(`.fl-ex[data-lift="${id}"] .fl-set`).nth(j).locator('[data-flact="delset"]').click();
}

// 点某个动作块的「移除这个动作」
export async function flRemoveEx(page: Page, id: string) {
  await page.locator(`.fl-ex[data-lift="${id}"] [data-flact="rmex"]`).click();
}

// 芯片行里每个芯片的 data-fl-add（lift:<id> / cardio:<id>）
export async function flChipIds(page: Page): Promise<string[]> {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('#fl [data-fl-add]')).map((b) => b.dataset.flAdd ?? ''));
}
