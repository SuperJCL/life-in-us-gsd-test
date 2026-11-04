// 导入用例（IO-04、IO-05）。
// 导入文件只在内存里构造，名字一律以 synth- 开头，磁盘上不写任何文件（D-04）。
// 先注册对话框处理再选文件（D-05）：confirm 在 FileReader 的 onload 里异步弹出，所以先 expect.poll 等消息再比较。
// 期望由 expectedNormalize 推导，不读应用代码；所有用例都用账户模式开局（D-06）。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';
import { FROZEN_NOW, WEEK_START_FROZEN } from '../../support/constants';
import {
  answerNextDialog,
  chooseImportFile,
  jsonImportFile,
  recordDialogs,
  textImportFile,
} from '../../support/import-file';
import { composer } from '../../support/composer';
import {
  expectedCategory,
  expectedNormalize,
  expectedTimeline,
  weekCountsByCategory,
} from '../../support/expect-from-fixture';
import { expectToast, expectToastGone } from '../../support/toast';
import { gotoTimeline, pickFilter, readTimeline } from '../../support/timeline';
import {
  AREA_COUNT_UNIT,
  CAT_LANGUAGE,
  CAT_OTHER,
  CATEGORY_NAMES,
  CONFIRM_IMPORT,
  FILTER_ALL,
  TOAST_IMPORT_BAD_FORMAT,
  TOAST_RESTORED,
} from '../../support/strings';

type Log = { id: string; text: string; cat: string; date: string };

// 每次返回一份新的合成备份：两条记录（一条在冻结周内，一条在 2 月）、一条已完成的自定义待办
function syntheticBackup() {
  return {
    arrival: '2026-02-01',
    tasks: { 'c-synth-imp-1': { done: true, doneDate: '2026-03-05' } },
    custom: [{ id: 'c-synth-imp-1', group: 'P2', text: 'SYNTH-IMPORT custom todo' }],
    logs: [
      { id: 'synth-import-01', date: '2026-03-19', cat: CATEGORY_NAMES[1], text: 'SYNTH-IMPORT entry one' },
      { id: 'synth-import-02', date: '2026-02-10', cat: CAT_LANGUAGE, text: 'SYNTH-IMPORT entry two' },
    ],
    lifts: {},
    reviews: {},
    presets: {},
  };
}

// 用合成哨兵记录证明“没有保存”：推进防抖后，写入恰好比开始时多一次，
// 并且那次写入里去掉哨兵的记录 id 列表等于 fixture 的（应用内存里的数据没有被替换）。
// 必须在 manual 时钟下调用，不用固定睡眠。
async function expectOnlySentinelSaved(
  page: Page,
  app: AppHarness,
  fixtureIds: string[],
  writesBefore: number,
  sentinel: string,
) {
  const comp = composer(page, 'w');
  await comp.type(sentinel);
  await comp.submit();
  await page.clock.runFor(2_000);
  await expect
    .poll(() => app.backend.writes.some((w) => w.data.logs.some((l: Log) => l.text === sentinel)), {
      message: '等待哨兵写入到达 mock',
    })
    .toBe(true);
  expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
  const last = app.backend.writes[app.backend.writes.length - 1].data;
  const ids = last.logs.filter((l: Log) => l.text !== sentinel).map((l: Log) => l.id);
  expect(ids).toEqual(fixtureIds);
}

test('IO-04 accepting the import confirm replaces all data with the backup', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  expect(app.backend.writes).toEqual([]);

  const payload = syntheticBackup();
  // 先注册确认框处理，再选文件（D-05）
  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, jsonImportFile('synth-import.json', payload));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  expect(dialogs[0]).toBe(CONFIRM_IMPORT);
  await expectToast(page, TOAST_RESTORED);

  await app.expectSaved((s) => s.logs.some((l: Log) => l.id === 'synth-import-01'), '等待导入后的保存');
  const saved = await app.saved();
  expect(saved).toEqual(expectedNormalize(payload));

  // 本周视图：fixture 的记录全部消失，合成记录出现在它的日期列，抵达日期是备份里的
  await expect(page.locator('#tab-wk [data-edit^="synth-full-"]')).toHaveCount(0);
  await expect(page.locator('#tab-wk [data-wday="2026-03-19"] [data-edit="synth-import-01"]')).toHaveCount(1);
  await expect(page.locator('#arrival')).toHaveValue(payload.arrival);

  // 时间线：读回等于保存后状态的推导（含完成的自定义待办和 2 月的记录）
  await gotoTimeline(page);
  await expect
    .poll(() => readTimeline(page), { message: '时间线与导入后状态的推导不一致' })
    .toEqual(expectedTimeline(saved, FILTER_ALL));
});

// 这两条证明“没有保存”，所以用 manual 时钟推过 600 ms 防抖（D-06）；同一个用例里不混用 setFixedTime
test.describe('IO-04 manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('IO-04 cancelling the import confirm keeps the data and saves nothing', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    const fixtureIds = fixture.logs.map((l: Log) => l.id);
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const writesBefore = app.backend.writes.length;

    const dialogs = answerNextDialog(page, 'dismiss');
    await chooseImportFile(page, jsonImportFile('synth-cancel-import.json', syntheticBackup()));
    await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
    expect(dialogs[0]).toBe(CONFIRM_IMPORT);

    // 推过防抖窗口：写入次数不变，取消路径没有 toast，页面仍是 fixture 的数据
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length).toBe(writesBefore);
    await expectToastGone(page);
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);
    await expect(page.locator('#tab-wk [data-edit="synth-import-01"]')).toHaveCount(0);

    await expectOnlySentinelSaved(page, app, fixtureIds, writesBefore, 'SYNTH-IO04 cancel sentinel');
  });

  test('IO-04 files that are not a backup show the format error, ask nothing and save nothing', async ({
    page,
    app,
  }) => {
    const fixture = loadFixture('full-state.json');
    const fixtureIds = fixture.logs.map((l: Log) => l.id);
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const writesBefore = app.backend.writes.length;

    // synth-null.json 是合法 JSON，但 normalize 读 null 的属性会抛错，所以也走格式错误提示（FEATURES 的 IMP-3）。
    // synth-array.json（[]）和字段类型错误的对象能通过 normalize，与 N3 同类，这里不断言（B2、N3 在 05-04）。
    const files = MALFORMED_IMPORTS.filter((m) => m.kind === 'not-json' || m.name === 'synth-null.json');
    expect(files.length, '三个非 JSON 文件加 synth-null.json').toBe(4);

    const dialogs = recordDialogs(page);
    for (const m of files) {
      await chooseImportFile(page, m);
      await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
      expect(dialogs, `${m.name} 不应弹出确认框`).toEqual([]);
      await page.clock.runFor(2_000);
      await expectToastGone(page);
      expect(app.backend.writes.length, `${m.name} 之后出现了保存`).toBe(writesBefore);
    }
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);

    await expectOnlySentinelSaved(page, app, fixtureIds, writesBefore, 'SYNTH-IO04 format sentinel');
  });
});

test('IO-04 an exported JSON backup imported again restores exactly the exported data', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  const sentinel = 'SYNTH-IO04 after export';
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  // 导出的备份只在内存里：不写文件、不进报告和注解（D-04）
  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);
  const exported = app.backend.downloads[0].data;
  const backup = JSON.parse(exported);
  expect(backup).toEqual(withoutSynthetic(fixture));

  // 导出之后再改动：记一条合成记录并等它保存
  const comp = composer(page, 'w');
  await comp.type(sentinel);
  await comp.submit();
  await app.expectSaved((s) => s.logs.some((l: Log) => l.text === sentinel), '等待新记录保存');

  // 把导出的原文（不重新序列化）作为内存文件导入并接受
  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, textImportFile('synth-roundtrip.json', exported));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  expect(dialogs[0]).toBe(CONFIRM_IMPORT);
  await expectToast(page, TOAST_RESTORED);
  await app.expectSaved((s) => s.logs.every((l: Log) => l.text !== sentinel), '等待导入后的保存');

  expect(await app.saved()).toEqual(backup);
  await expect(page.locator('#tab-wk #days').getByText(sentinel)).toHaveCount(0);
  await gotoTimeline(page);
  await expect
    .poll(() => readTimeline(page), { message: '时间线与备份的推导不一致' })
    .toEqual(expectedTimeline(backup, FILTER_ALL));
});

test('IO-05 importing a backup with legacy category names migrates them and every view shows the new categories', async ({
  page,
  app,
}) => {
  const legacy = loadFixture('legacy-categories.json');
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, jsonImportFile('synth-legacy-import.json', legacy));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  expect(dialogs[0]).toBe(CONFIRM_IMPORT);
  await expectToast(page, TOAST_RESTORED);

  await app.expectSaved((s) => s.logs.some((l: Log) => l.id === 'synth-legacy-01'), '等待导入后的保存');
  const saved = await app.saved();
  expect(saved).toEqual(expectedNormalize(legacy));

  // 每条记录的类别都按迁移规则变化；防空转：至少 4 条真的变了，并且有落到“其他”的
  const pairs = saved.logs.map((l: Log) => [l.id, l.cat]);
  expect(pairs).toEqual(legacy.logs.map((l: Log) => [l.id, expectedCategory(l.cat)]));
  const changed = legacy.logs.filter((l: Log) => expectedCategory(l.cat) !== l.cat);
  expect(changed.length).toBeGreaterThanOrEqual(4);
  expect(saved.logs.some((l: Log) => l.cat === CAT_OTHER)).toBe(true);

  // 本周视图：六条记录都在冻结的那一周，五张类别卡的计数等于推导，每条记录在自己的日期列里恰好一次
  const counts = weekCountsByCategory(saved, WEEK_START_FROZEN);
  expect(counts.reduce((a, b) => a + b, 0)).toBe(legacy.logs.length);
  const areas = page.locator('#areas .area');
  await expect(areas).toHaveCount(CATEGORY_NAMES.length);
  for (let i = 0; i < CATEGORY_NAMES.length; i++) {
    await expect(areas.nth(i).locator('.v')).toHaveText(`${counts[i]}${AREA_COUNT_UNIT}`);
  }
  for (const l of saved.logs as Log[]) {
    await expect(page.locator(`#tab-wk [data-wday="${l.date}"] [data-edit="${l.id}"]`)).toHaveCount(1);
  }

  // 时间线：全部筛选下整体等于推导，每条 legacy 记录的标签是新类别名；再按专业和其他筛选
  await gotoTimeline(page);
  await expect
    .poll(() => readTimeline(page), { message: '时间线与迁移后状态的推导不一致' })
    .toEqual(expectedTimeline(saved, FILTER_ALL));
  const read = await readTimeline(page);
  for (const l of legacy.logs as Log[]) {
    const row = read.rows.find((r) => r.id === l.id);
    expect(row?.tag, `${l.id} 的时间线标签`).toBe(expectedCategory(l.cat));
  }

  await pickFilter(page, CATEGORY_NAMES[1]);
  await expect
    .poll(() => readTimeline(page), { message: '专业筛选与推导不一致' })
    .toEqual(expectedTimeline(saved, CATEGORY_NAMES[1]));
  expect((await readTimeline(page)).rows.map((r) => r.id)).toContain('synth-legacy-01');

  await pickFilter(page, CAT_OTHER);
  await expect
    .poll(() => readTimeline(page), { message: '其他筛选与推导不一致' })
    .toEqual(expectedTimeline(saved, CAT_OTHER));
  const otherIds = (await readTimeline(page)).rows.map((r) => r.id);
  for (const id of ['synth-legacy-03', 'synth-legacy-04', 'synth-legacy-05']) expect(otherIds).toContain(id);
});
