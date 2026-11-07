// USJ_CONFIG 配置缝（TEST-01，D-11）。
// 页面可以在应用脚本运行之前放一个 window.USJ_CONFIG：
//  - 没配、或 backend 为 null：走旧的 window.claude / localStorage 路径（v1 全部用例走这条）；
//  - backend 是别的值：状态栏显示配置无效、什么都不保存，不会悄悄退回本地。
// 另外 USJ_CONFIG 不接受计划：配置里带 plan 也照样显示内置的示例计划（D-11）。
// 配置一律在 app.open() 或 page.goto 之前用 addInitScript 注入；函数自包含，用参数传值。
import { test, expect } from '../../support/test';
import { loadFixture } from '../../support/fixture-files';
import { composer } from '../../support/composer';
import { gotoGoals, readGroups } from '../../support/goals';
import { BUILTIN_GROUP_SIZES } from '../../support/task-ids';
import { FROZEN_NOW, STATE_KEY } from '../../support/constants';
import { STATUS_BACKEND_UNSUPPORTED } from '../../support/strings';

// 合成文本，不含任何真实内容
const ENTRY_TEXT = 'SYNTH-CFG01 local entry';
const CONTROL_TEXT = 'SYNTH-CFG03 unsaved entry';
const PLAN_GROUP_TEXT = 'SYNTH-CFG01 plan group';
const PLAN_TASK_TEXT = 'SYNTH-CFG01 plan task';

type Log = { text: string; date: string; cat: string };

// 在应用脚本运行之前放配置
async function injectConfig(page: import('@playwright/test').Page, cfg: unknown) {
  await page.addInitScript((c) => {
    (window as any).USJ_CONFIG = c;
  }, cfg);
}

test('TEST-01 USJ_CONFIG with backend null keeps the old local storage path and ignores a plan in the config', async ({
  page,
  app,
}) => {
  // 配置里带一份只有一组一项的合成计划：应用必须忽略它（D-11）
  const cfg = {
    backend: null,
    plan: { groups: [{ id: 'P1', name: PLAN_GROUP_TEXT, tasks: [{ id: 'P1-1', text: PLAN_TASK_TEXT }] }] },
  };
  await injectConfig(page, cfg);
  await app.open({ seed: loadFixture('local-seed.json') });

  // 旧的本地路径：记一笔，保存到 localStorage
  await composer(page, 'w').type(ENTRY_TEXT);
  await composer(page, 'w').submit();
  await app.expectSaved((s) => s.logs.some((l: Log) => l.text === ENTRY_TEXT));

  // 计划没有被配置替换：目标页仍是 7 组，P1 的任务个数是示例计划的个数
  await gotoGoals(page);
  const groups = await readGroups(page);
  expect(groups.map((g) => g.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  expect(groups[0].taskIds).toHaveLength(BUILTIN_GROUP_SIZES.P1);
  expect(groups[0].taskIds[0]).toBe('P1-1');
});

test('TEST-01 USJ_CONFIG with backend null keeps the old claude account path', async ({ page, app }) => {
  await injectConfig(page, { backend: null });
  await app.open({ mode: 'account', seed: loadFixture('local-seed.json') });

  // 账户模式照旧：状态栏、读取次数、localStorage 里没有应用的键
  await app.expectAccountMode();
});

test.describe('TEST-01 unsupported backend', () => {
  // 要证明“没有保存”，必须让 600 ms 防抖确定地走完：manual 时钟
  test.use({ clockMode: 'manual' });

  test('TEST-01 an unsupported USJ_CONFIG backend shows the config error and saves nothing', async ({ page }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await injectConfig(page, { backend: 'synth-backend' });
    // app.open 的就绪条件是本地文案，这里不适用，直接打开
    await page.goto('/');
    await expect(page.locator('#status')).toHaveText(STATUS_BACKEND_UNSUPPORTED);

    // 记一笔，把时钟推过防抖
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await composer(page, 'w').type(CONTROL_TEXT);
    await composer(page, 'w').submit();
    await page.clock.runFor(2_000);

    // 没有悄悄退回本地：localStorage 里没有应用的键，状态栏文案没变，导出按钮仍隐藏
    expect(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY)).toBeNull();
    await expect(page.locator('#status')).toHaveText(STATUS_BACKEND_UNSUPPORTED);
    for (const id of ['#exportCsv', '#exportJson']) {
      await expect(page.locator(id)).toHaveClass(/\bhidden\b/);
    }

    // 计划仍是示例计划的 7 组
    await gotoGoals(page);
    expect(await readGroups(page)).toHaveLength(7);
  });
});
