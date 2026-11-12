// 编辑计划页（Phase 12）的 helper。
// 这里只能从 @playwright/test 和 ./strings 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
// 隐私：编辑页里组名、任务文字、力量项名是个人计划文字，所以 readEditor 只返回 hash、界面文案、布尔、编号和键，不读计划文字；
// 定位器按 data-* 属性取，不按文字取，失败输出里不会出现个人计划原文。
import { expect, type Locator, type Page } from '@playwright/test';
import { BTN_PLAN_DISCARD, BTN_PLAN_EDIT, BTN_PLAN_SAVE } from './strings';
import { gotoGoals } from './goals';

// 打开目标页，点「编辑计划」，等编辑页显示
export async function openEditor(page: Page) {
  await gotoGoals(page);
  await page.getByRole('button', { name: BTN_PLAN_EDIT, exact: true }).click();
  await expect(page.locator('#tab-plan')).toBeVisible();
}

// 卡片键的格式：g:<组 id>
export function card(page: Page, key: string): Locator {
  return page.locator(`#pe-main .pe-card[data-key="${key}"]`);
}

// 展开一张卡（aria-expanded 为 false 才点开关）
export async function expand(page: Page, key: string) {
  const toggle = card(page, key).locator('[data-peact="toggle"]');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
}

// 字段键的格式：g:<组 id>:name
export function field(page: Page, key: string): Locator {
  return page.locator(`#pe-main [data-pefield="${key}"]`);
}

// 按动作和（可选的）卡片键取按钮
export function act(page: Page, verb: string, key?: string): Locator {
  return page.locator(`#pe-main [data-peact="${verb}"]${key === undefined ? '' : `[data-pekey="${key}"]`}`);
}

// 应用内离开编辑页（保存、放弃、切换标签）时用 history.back() 退回进入时 push 的那一条历史，hash 是异步去掉的（IN-02）：轮询到 hash 为空
export async function expectHashGone(page: Page) {
  await expect.poll(() => page.evaluate(() => location.hash), { message: '等待 #plan 被去掉' }).toBe('');
}

export async function savePlan(page: Page) {
  await page.getByRole('button', { name: BTN_PLAN_SAVE, exact: true }).click();
}

export async function discardPlan(page: Page) {
  await page.getByRole('button', { name: BTN_PLAN_DISCARD, exact: true }).click();
}

export type EditorRead = {
  open: boolean;
  hash: string;
  hint: string;
  tone: string | null;
  saveDisabled: boolean;
  saveAriaDisabled: boolean;
  saveBusy: boolean;
  groups: Array<{ key: string; no: string; expanded: boolean; cat: string; taskKeys: string[]; bad: string }>;
  // 健身分区：每周健身目标两个输入框的值（数字或空串，不是计划文字）和力量项卡（键 l:<id>、是否展开）
  fit: { min: string; max: string };
  lifts: Array<{ key: string; expanded: boolean; bad: string }>;
  // 显示中的错误：字段键和错误文字（界面文案，不是计划文字）
  errors: Array<{ key: string; text: string }>;
  addGroupDisabled: boolean;
  // 底部「已归档」区（12-06）：是否渲染、是否展开、摘要文字（界面文案加数字）、三类归档项的键（g:、t:、l: 加 id，不含计划文字）
  archived: { present: boolean; open: boolean; summary: string; groups: string[]; tasks: string[]; lifts: string[] };
  // 被禁用的「恢复」按钮的键（超出数量上限时）
  restoreDisabled: string[];
};

// 一次 page.evaluate 读回编辑页的状态：只有 hash、界面文案、布尔、编号和键，不读计划文字
export async function readEditor(page: Page): Promise<EditorRead> {
  return page.evaluate(() => {
    const plan = document.querySelector('#tab-plan');
    const save = document.querySelector<HTMLButtonElement>('#pe-save');
    const hint = document.querySelector('#pe-hint');
    return {
      open: !!plan && !plan.classList.contains('hidden'),
      hash: location.hash,
      hint: hint?.textContent ?? '',
      tone: hint?.getAttribute('data-tone') ?? null,
      saveDisabled: !!save?.disabled,
      saveAriaDisabled: save?.getAttribute('aria-disabled') === 'true',
      saveBusy: save?.getAttribute('aria-busy') === 'true',
      groups: Array.from(document.querySelectorAll('#pe-main .pe-card[data-key^="g:"]')).map((c) => ({
        key: c.getAttribute('data-key') ?? '',
        no: c.querySelector('.pe-no')?.textContent ?? '',
        expanded: c.querySelector('[data-peact="toggle"]')?.getAttribute('aria-expanded') === 'true',
        // 类别：.seg 里被按下的按钮的 data-pecat（固定的五个类别名，不是个人文字）
        cat: c.querySelector('.seg [aria-pressed="true"]')?.getAttribute('data-pecat') ?? '',
        // 任务行的键 t:<tid>（按页面顺序，不含任务文字）
        taskKeys: Array.from(c.querySelectorAll('.pe-row [data-pefield]')).map((i) => (i.getAttribute('data-pefield') ?? '').replace(/:text$/, '')),
        // 卡片头的「有 n 处要改」（没有显示时为空串）
        bad: ((b) => (b && !b.hidden ? (b.textContent ?? '') : ''))(c.querySelector<HTMLElement>('.pe-bad')),
      })),
      fit: {
        min: document.querySelector<HTMLInputElement>('#pe-main [data-pefield="fit:min"]')?.value ?? '',
        max: document.querySelector<HTMLInputElement>('#pe-main [data-pefield="fit:max"]')?.value ?? '',
      },
      lifts: Array.from(document.querySelectorAll('#pe-main .pe-card[data-key^="l:"]')).map((c) => ({
        key: c.getAttribute('data-key') ?? '',
        expanded: c.querySelector('[data-peact="toggle"]')?.getAttribute('aria-expanded') === 'true',
        bad: ((b) => (b && !b.hidden ? (b.textContent ?? '') : ''))(c.querySelector<HTMLElement>('.pe-bad')),
      })),
      errors: Array.from(document.querySelectorAll('#pe-main [data-pefield][aria-invalid="true"]')).map((f) => {
        const id = (f.getAttribute('aria-describedby') ?? '').split(' ')[0];
        return { key: f.getAttribute('data-pefield') ?? '', text: document.getElementById(id)?.textContent ?? '' };
      }),
      addGroupDisabled: !!document.querySelector<HTMLButtonElement>('#pe-main [data-peact="addgroup"]')?.disabled,
      archived: ((a) => {
        const rows = (p: string) => (a ? Array.from(a.querySelectorAll(`[data-row^="${p}"]`)).map((r) => r.getAttribute('data-row') ?? '') : []);
        return {
          present: !!a,
          open: !!a?.open,
          summary: a?.querySelector('summary')?.textContent ?? '',
          groups: rows('g:'),
          tasks: rows('t:'),
          lifts: rows('l:'),
        };
      })(document.querySelector<HTMLDetailsElement>('#pe-archived')),
      restoreDisabled: Array.from(document.querySelectorAll<HTMLButtonElement>('#pe-archived [data-peact="restore"]'))
        .filter((b) => b.disabled)
        .map((b) => b.getAttribute('data-pekey') ?? ''),
    };
  });
}
