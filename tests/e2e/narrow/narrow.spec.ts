// 本文件覆盖 RESP-01：手机宽度下的几处关键布局。
// 只用 viewport（520 × 900，低于应用的 560px 和 900px 两个断点），不用设备描述符、不做拖拽、不截图（D-03）。
// 所有断言都在页面内读计算样式和位置，再在 Node 侧比较；整个文件只有少量关键用例（D-13）。
// 隐私（D-07）：只为合成记录打开弹窗；日历 chip 和计划条目带个人计划原文，本文件从不读它们的文字，
// 只读类名、日期属性、计算样式和位置。
// 所有用例账户模式加 full-state.json 开局并立刻 expectAccountMode（D-06）。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { editor } from '../../support/editor';
import { gotoCalendar } from '../../support/calendar';
import { loadFixture } from '../../support/fixture-files';
import { FROZEN_TODAY, WEEK_START_FROZEN } from '../../support/constants';

test.use({ viewport: { width: 520, height: 900 } });

// 开局：账户模式加完整 fixture，并确认视口真的是 520 × 900（防空转：viewport 没生效时立刻失败）
async function openPhone(app: AppHarness, page: Page) {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();
  await expectPhoneViewport(page);
}

async function expectPhoneViewport(page: Page) {
  const size = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  expect(size).toEqual({ w: 520, h: 900 });
}

// 周一起的 7 个日期（冻结周）
function frozenWeekDates(): string[] {
  const [y, m, d] = WEEK_START_FROZEN.split('-').map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    return dt.toISOString().slice(0, 10);
  });
}

test('RESP-01 at phone width the editor opens as a bottom sheet', async ({ page, app }) => {
  await openPhone(app, page);

  // 合成记录 synth-full-04 在冻结周里
  const ed = editor(page);
  await ed.openLog(page.locator('#tab-wk [data-edit="synth-full-04"]'));

  // 一次读回弹窗的位置和四个圆角
  const read = await page.evaluate(() => {
    const dlg = document.querySelector('dialog#editor') as HTMLDialogElement;
    const r = dlg.getBoundingClientRect();
    const cs = getComputedStyle(dlg);
    return {
      left: r.left,
      top: r.top,
      width: r.width,
      bottom: r.bottom,
      innerWidth,
      innerHeight,
      tl: cs.borderTopLeftRadius,
      tr: cs.borderTopRightRadius,
      bl: cs.borderBottomLeftRadius,
      br: cs.borderBottomRightRadius,
    };
  });

  // 宽度等于视口宽度，贴住左边和底部，顶部在视口里
  expect(Math.abs(read.width - read.innerWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(read.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(read.bottom - read.innerHeight)).toBeLessThanOrEqual(1);
  expect(read.top).toBeGreaterThan(0);
  // 上圆下直：底部面板
  expect(read.tl).not.toBe('0px');
  expect(read.tr).not.toBe('0px');
  expect(read.bl).toBe('0px');
  expect(read.br).toBe('0px');

  await ed.cancel();
  await ed.expectClosed();
});

test('RESP-01 at phone width calendar chips shrink to dots', async ({ page, app }) => {
  await openPhone(app, page);
  await gotoCalendar(page);

  // 只读每个 chip 的种类、计算样式和位置，不读文字
  const chips = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#grid .chip')).map((c) => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return {
        kind: c.classList.contains('due') ? 'due' : c.classList.contains('done') ? 'done' : 'log',
        fontSize: cs.fontSize,
        radius: cs.borderTopLeftRadius,
        w: r.width,
        h: r.height,
      };
    }),
  );

  // 防空转：三种 chip 各至少一个
  for (const kind of ['log', 'due', 'done']) {
    expect(chips.filter((c) => c.kind === kind).length, `没有读到 ${kind} chip`).toBeGreaterThan(0);
  }
  for (const c of chips) {
    expect(c.fontSize, `${c.kind} chip 的 font-size`).toBe('0px');
    expect(c.radius, `${c.kind} chip 的圆角`).toBe('50%');
    if (c.kind === 'log') {
      expect(Math.abs(c.w - 7)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(c.h - 7)).toBeLessThanOrEqual(0.5);
    } else {
      // due 带 1px 虚线边框，按 box-sizing 不同可能是 7 或 9
      expect(c.w).toBeGreaterThanOrEqual(6);
      expect(c.w).toBeLessThanOrEqual(10);
      expect(c.h).toBeGreaterThanOrEqual(6);
      expect(c.h).toBeLessThanOrEqual(10);
    }
  }
});

test('RESP-01 at phone width the week days stack in a single column', async ({ page, app }) => {
  await openPhone(app, page);

  const read = await page.evaluate(() => {
    const days = document.querySelector('#days') as HTMLElement;
    return {
      gridTemplateColumns: getComputedStyle(days).gridTemplateColumns,
      width: days.getBoundingClientRect().width,
      cols: Array.from(document.querySelectorAll('#days > [data-wday]')).map((d) => {
        const r = d.getBoundingClientRect();
        return { wday: d.getAttribute('data-wday') ?? '', left: r.left, top: r.top, width: r.width };
      }),
    };
  });

  // 只有一列
  expect(read.gridTemplateColumns.trim().split(/\s+/)).toHaveLength(1);
  // 恰好 7 列，依次是冻结周的周一到周日
  expect(read.cols.map((c) => c.wday)).toEqual(frozenWeekDates());
  // x 坐标相同、y 坐标严格递增、宽度与 #days 相同
  const lefts = read.cols.map((c) => c.left);
  expect(Math.max(...lefts) - Math.min(...lefts)).toBeLessThanOrEqual(0.5);
  for (let i = 1; i < read.cols.length; i++) {
    expect(read.cols[i].top, `第 ${i + 1} 列的顶部应在上一列之下`).toBeGreaterThan(read.cols[i - 1].top);
  }
  for (const c of read.cols) {
    expect(Math.abs(c.width - read.width)).toBeLessThanOrEqual(1);
  }
});

test('RESP-01 at phone width picking a day scrolls the composer into view', async ({ page, app }) => {
  await openPhone(app, page);

  // 一次读回布局：视口高度、#wkComp 的文档坐标顶部、每个日期列的日期头文档坐标顶部和高度
  const readLayout = () =>
    page.evaluate(() => ({
      innerHeight,
      scrollY,
      compDocTop: (document.querySelector('#wkComp') as HTMLElement).getBoundingClientRect().top + scrollY,
      heads: Array.from(document.querySelectorAll('#tab-wk [data-wday]')).map((d) => {
        const r = (d.querySelector('.dh') as HTMLElement).getBoundingClientRect();
        return { wday: d.getAttribute('data-wday') ?? '', top: r.top + scrollY, height: r.height };
      }),
    }));
  const layout = await readLayout();

  // 选目标日：排除 FROZEN_TODAY（它本来就是选中日），要求日期头到 #wkComp 的距离 150 ≤ gap ≤ innerHeight − 100，取最远的
  const candidates = layout.heads
    .filter((h) => h.wday !== FROZEN_TODAY)
    .map((h) => ({ ...h, gap: layout.compDocTop - h.top }))
    .filter((h) => h.gap >= 150 && h.gap <= layout.innerHeight - 100)
    .sort((a, b) => b.gap - a.gap);
  expect(candidates.length, '900 高度下选不出合适的日期列，需要用户决定').toBeGreaterThan(0);
  const target = candidates[0];
  // 前提：#wkComp 的文档顶部要大于 innerHeight + 40，才能把它放到视口下方 40px
  expect(layout.compDocTop, '900 高度下 #wkComp 离页面顶部太近，需要用户决定').toBeGreaterThan(layout.innerHeight + 40);

  // 瞬时滚到 #wkComp 顶部在视口下方 40px 处，等 scrollY 到位
  const scrollTop = layout.compDocTop - layout.innerHeight - 40;
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scrollTop);
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(Math.round(scrollTop));

  // 前提再读一次：日期头完整在视口里，#wkComp 的顶部在视口下方
  const before = await page.evaluate((wday) => {
    const head = (document.querySelector(`#tab-wk [data-wday="${wday}"] .dh`) as HTMLElement).getBoundingClientRect();
    return {
      headTop: head.top,
      headBottom: head.bottom,
      compTop: (document.querySelector('#wkComp') as HTMLElement).getBoundingClientRect().top,
      scrollY,
      innerHeight,
    };
  }, target.wday);
  expect(before.headTop, '日期头应完整在视口里（上沿）').toBeGreaterThanOrEqual(0);
  expect(before.headBottom, '日期头应完整在视口里（下沿）').toBeLessThanOrEqual(before.innerHeight);
  expect(before.compTop, '#wkComp 应在视口下方').toBeGreaterThanOrEqual(before.innerHeight);

  // 点日期头：选中日变成目标日，页面平滑滚动到 #wkComp（用 poll 等，不用固定睡眠）
  await page.locator(`#tab-wk [data-wday="${target.wday}"] .dh`).click();
  await expect(page.locator('#tab-wk .day.sel')).toHaveAttribute('data-wday', target.wday);
  await expect
    .poll(async () => {
      const now = await page.evaluate(() => ({
        compTop: (document.querySelector('#wkComp') as HTMLElement).getBoundingClientRect().top,
        scrollY,
        innerHeight,
      }));
      return now.compTop >= -1 && now.compTop < now.innerHeight && now.scrollY > before.scrollY;
    })
    .toBe(true);
});
