import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../support/test';
import { FROZEN_NOW, FROZEN_TODAY } from '../support/constants';
import { CAT_LANGUAGE, TAB_LABELS } from '../support/strings';

// 合成文本，不含任何真实内容
const ENTRY_TEXT = 'SYNTH-IO01 local roundtrip';
const SEED_TEXT = 'SYNTH-SEED seeded entry';
const AFTER_SEED_TEXT = 'SYNTH-MOCK01 after seed';

type Log = { text: string; date: string; cat: string };

test('IO-01 saves an entry to localStorage and keeps it after reload', async ({ page, app }) => {
  await app.open();

  // 在本周视图记一笔
  await page.locator('#wkComp #w-text').fill(ENTRY_TEXT);
  await page.locator('#wkComp #w-add').click();

  // 先 poll：保存有 600 ms 防抖，等 localStorage 里出现这条记录，不用固定睡眠（D-18）
  await app.expectPersisted((s) =>
    s.logs.some((l: Log) => l.text === ENTRY_TEXT && l.date === FROZEN_TODAY && l.cat === CAT_LANGUAGE),
  );

  // reload 之后重新等就绪，最后断言 DOM（D-18 的顺序）
  await app.reload();
  await expect(
    page.locator(`#tab-wk [data-wday="2026-03-18"] [data-edit]`).filter({ hasText: ENTRY_TEXT }),
  ).toBeVisible();
});

test('IO-01 keeps the export buttons hidden in local mode', async ({ page, app }) => {
  await app.open();

  // 等到状态行之后断言是安全的：本地模式下没有 window.claude，
  // init 在 setStatus 之后同步走完 downloads 分支，中间没有 await，
  // 所以状态行就绪时导出按钮的最终状态已经确定。
  for (const id of ['#exportCsv', '#exportJson']) {
    await expect(page.locator(id)).toHaveClass(/\bhidden\b/);
    await expect(page.locator(id)).toBeHidden();
  }
});

test('MOCK-01 opens in local mode without window.claude and switches all four tabs', async ({ page, app }) => {
  await app.open();

  // 本地模式：页面没有 window.claude。
  // “启动时不写存储”不在这里做单次采样（WR-06），见下面 manual 时钟的用例
  expect(await page.evaluate(() => 'claude' in window)).toBe(false);

  const keys = Object.keys(TAB_LABELS) as Array<keyof typeof TAB_LABELS>;
  for (const k of keys) {
    const tab = page.getByRole('tab', { name: TAB_LABELS[k], exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator(`#tab-${k}`)).toBeVisible();
    for (const other of keys.filter((x) => x !== k)) {
      await expect(page.locator(`#tab-${other}`)).toBeHidden();
    }
  }
});

test('MOCK-01 starts from seeded synthetic localStorage and reload keeps newly saved data', async ({ page, app }) => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/local-seed.json'), 'utf8'));
  await app.open({ seed });

  // 种子条目显示在 2026-03-17 那一列
  const seededRow = page.locator('#tab-wk [data-wday="2026-03-17"] [data-edit]').filter({ hasText: SEED_TEXT });
  await expect(seededRow).toBeVisible();

  // 再记一笔，等两条都落盘
  await page.locator('#wkComp #w-text').fill(AFTER_SEED_TEXT);
  await page.locator('#wkComp #w-add').click();
  const hasBoth = (s: { logs: Log[] }) =>
    s.logs.some((l) => l.text === SEED_TEXT) && s.logs.some((l) => l.text === AFTER_SEED_TEXT);
  await app.expectPersisted(hasBoth);

  // reload 时 init script 会再次执行，但“没有才写”，所以不会用种子覆盖新数据（D-18）
  await app.reload();
  await expect(seededRow).toBeVisible();
  await expect(
    page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`).filter({ hasText: AFTER_SEED_TEXT }),
  ).toBeVisible();
  expect(hasBoth(await app.persisted())).toBe(true);
});

// WR-06：否定断言（“启动时没写 localStorage”）必须在足够长的窗口里持续成立才有意义。
// 单次采样会在 600 ms 防抖触发之前就通过，永远测不到启动路径之后的保存。
// manual 时钟让这个窗口确定、不靠睡眠：先推过防抖，再断言；再用一次对照证明窗口真的推进了防抖。
test.describe('MOCK-01 manual clock', () => {
  // 同一个用例不混用 install 和 setFixedTime（D-15）：manual 时 frozenClock 什么都不做
  test.use({ clockMode: 'manual' });

  test('MOCK-01 local mode leaves localStorage empty at startup even after timers pass the save debounce', async ({
    page,
    app,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);

    // 启动时如果调用过保存，600 ms 防抖会在这次推进里触发；本地模式的写入是同步的
    await page.clock.runFor(2_000);
    expect(await app.persisted()).toBeNull();

    // 对照：记一笔再推进同样的窗口，localStorage 里必须能读到它，
    // 证明上面的 runFor 确实推进了防抖，否定断言不是空转
    const controlText = 'SYNTH-WR06 control';
    await page.locator('#wkComp #w-text').fill(controlText);
    await page.locator('#wkComp #w-add').click();
    await page.clock.runFor(2_000);
    const saved = await app.persisted();
    expect(saved).not.toBeNull();
    expect(saved.logs.some((l: Log) => l.text === controlText)).toBe(true);
  });
});
