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
import { loadFixture } from '../../support/fixture-files';

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
