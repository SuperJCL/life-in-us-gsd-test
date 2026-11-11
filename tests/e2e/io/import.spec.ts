// 导入用例（IO-04、IO-05、IO-07、IO-10）。旧路径（没有账号版：Claude 的 db 或 localStorage）的导入。
// IO-07、IO-10 是 Phase 11（11-07）修好 v1 的 N3、B2 之后的回归用例：它们原来是 tests/e2e/io/known-bugs.spec.ts 里带 test.fail 的已知 bug 用例，
// 修好之后去掉 knownBug 标记、期望断言原样保留，搬到这里；旧路径的导入只因 N3、B2 和 D-10 的三项（新格式完整备份只替换记录、拒绝只含计划的文件、5 MB 上限）改变。
// 导入文件只在内存里构造，名字一律以 synth- 开头，磁盘上不写任何文件（D-04）。
// 先注册对话框处理再选文件（D-05）：confirm 在 FileReader 的 onload 里异步弹出，所以先 expect.poll 等消息再比较。
// 期望由 expectedNormalize 推导，不读应用代码；所有用例都用账户模式开局（D-06）。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';
import { FROZEN_NOW, WEEK_START_FROZEN } from '../../support/constants';
import { fullBackup, legacyBackup, planOnlyFile } from '../../support/backup-files';
import { syntheticPlan } from '../../support/cloud-data';
import { gotoGoals, readGroups } from '../../support/goals';
import {
  answerNextDialog,
  chooseImportFile,
  jsonImportFile,
  recordDialogs,
  textImportFile,
} from '../../support/import-file';
import { composer } from '../../support/composer';
import { downloadOf } from '../../support/download';
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
  GOAL_DONE_NO_DATE,
  TOAST_IMPORT_BAD_FORMAT,
  TOAST_IMPORT_PLAN_LOCAL,
  TOAST_IMPORT_TOO_BIG,
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

test('IO-04 CR-01 a backup with a done task and no doneDate imports and the goals view still renders after a reload', async ({ page, app }) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  const payload = {
    ...syntheticBackup(),
    tasks: { 'P2-1': { done: true }, 'c-synth-imp-1': { done: true } },
  };
  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, jsonImportFile('synth-cr1-legacy.json', payload));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  // 以前 renderGoals 抛 TypeError：恢复成功的 toast 不出现，之后每次加载都打不开
  await expectToast(page, TOAST_RESTORED);
  await app.expectSaved((s) => s.tasks?.['P2-1']?.done === true, '等待导入后的保存');
  expect((await app.saved()).tasks['P2-1']).toEqual({ done: true, doneDate: '' });

  await gotoGoals(page);
  expect((await readGroups(page)).flatMap((g) => g.doneIds)).toEqual(expect.arrayContaining(['P2-1', 'c-synth-imp-1']));
  await expect(page.locator('#goals .task:has([data-task="P2-1"]) .meta')).toHaveText(GOAL_DONE_NO_DATE);

  await app.reload();
  await gotoGoals(page);
  expect((await readGroups(page)).flatMap((g) => g.doneIds)).toEqual(expect.arrayContaining(['P2-1', 'c-synth-imp-1']));
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

    // 六个畸形文件（三个非 JSON、null、[]、字段类型错误的对象）加三个合法 JSON 但不像备份的文件：{}、只有 _synthetic 的对象、一份裸计划形状的对象。
    // 原来 synth-array.json、字段类型错误的对象和 {} 能通过 normalize、与 N3 同类，当时不断言；N3 修好之后（IO-07，识别规则与云端版相同）一并断言。
    const files = [
      ...MALFORMED_IMPORTS,
      jsonImportFile('synth-empty-object.json', {}),
      jsonImportFile('synth-only-marker.json', { _synthetic: 'SYNTH' }),
      jsonImportFile('synth-bare-plan.json', syntheticPlan('bare', 2)),
    ];
    expect(files.length, '六个畸形文件加三个不像备份的 JSON 文件').toBe(9);

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

// ---------------------------------------------------------------------------
// 翻转的用例（TEST-03）：N3 和 B2 在 Phase 5 登记为已知 bug（test.fail 加对照用例），Phase 11（11-07）修好之后去掉标记、期望断言原样保留。
// 导入文件只在内存里构造，名字以 synth- 开头（D-04）；先注册对话框处理再选文件（D-05）；都用账户模式加完整 fixture 开局，并立刻 expectAccountMode（D-06）。
// B2 的 value 断言失败时会打印 #importJson 的 value（浏览器的 fakepath 形式加合成文件名），只留在本机终端，不写进文档。
// ---------------------------------------------------------------------------

// IO-10（原 B2）：取消导入确认后，文件框没有清空，再选同一个文件没有反应。
// 期望断言只用确定性的 value；不断言“change 会再次触发”，因为 Playwright 的 setInputFiles 每次都自己派发 change（PROBE-8）。
test.describe('IO-10 the file input is cleared after every import attempt', () => {
  // 准备和触发：账户模式加完整 fixture 开局，先注册“取消”再选文件，等确认框出现；返回确认框消息数组
  async function cancelImport(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const dialogs = answerNextDialog(page, 'dismiss');
    await chooseImportFile(page, jsonImportFile('synth-b2-import.json', { logs: [] }));
    await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
    return dialogs;
  }

  test('IO-10 cancelling the import confirm shows the confirm text and leaves the data unchanged', async ({
    page,
    app,
  }) => {
    const dialogs = await cancelImport(page, app);

    // 前提：确认框文案逐字等于 CONFIRM_IMPORT，取消路径没有 toast，fixture 的记录还在
    // 不断言“没有写入”：真实时钟下 600 ms 防抖还没到期，这条断言必然成立；取消不保存由上面的 IO-04 manual 时钟用例证明
    expect(dialogs).toEqual([CONFIRM_IMPORT]);
    await expectToastGone(page);
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);
  });

  // 格式错误路径一直会清空 input；它证明下面那条 value 断言在这个环境里能通过
  test('IO-10 the file input is cleared after a file that is not JSON', async ({ page, app }) => {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const dialogs = recordDialogs(page);
    const notJson = MALFORMED_IMPORTS.find((m) => m.kind === 'not-json');
    expect(notJson, '需要一个非 JSON 的合成文件').toBeDefined();

    await chooseImportFile(page, notJson!);
    await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
    await expect(page.locator('#importJson')).toHaveValue('');
    expect(dialogs).toEqual([]);
  });

  test('IO-10 the file input is cleared after cancelling the import confirm (B2 fixed)', async ({ page, app }) => {
    await cancelImport(page, app);

    // 只断言确定性的 value；不断言“change 会再次触发”，因为 Playwright 的 setInputFiles 每次都自己派发 change（PROBE-8）
    await expect(page.locator('#importJson')).toHaveValue('', { timeout: 2_000 });
  });
});

// IO-07（原 N3）：导入 {} 这类合法 JSON 并确认后，全部数据曾被清空（normalize 校验过浅）。
// 期望行为是应用拒绝它并提示格式错误。断言“出现格式错误提示”的理由：
//  - “fixture 的记录仍在页面上”单独使用会在导入处理完之前就立刻成立，对没修好的应用也会通过；
//  - “保存的状态里记录仍在”不是好同步点（修好的应用不保存，什么都不会出现）；
//  - 格式错误 toast 是正向、自带同步点的断言：没修好时出现的是已恢复，修好后出现格式错误提示。
// 所以第一条断言是格式错误 toast；它出现之后，再断言没有弹过确认框、记录仍在页面上（此时这两条不再空转）。
// 准备函数里不等对话框：修好的应用不会再弹确认。
test.describe('IO-07 a file that is not a backup is rejected before any confirm', () => {
  // 准备和触发：账户模式加完整 fixture 开局，先注册“接受”再选 {} 文件；返回确认框消息数组
  async function importEmptyObject(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const dialogs = answerNextDialog(page, 'accept');
    await chooseImportFile(page, jsonImportFile('synth-empty-object.json', {}));
    return dialogs;
  }

  // 对照：只有一个合格字段的最小备份仍会走到确认框，证明拒绝针对的是不像备份的文件，不是拒绝一切（取代原来“{} 会走到确认框”的对照）
  test('IO-07 a minimal backup with one known field still reaches the import confirm', async ({ page, app }) => {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const dialogs = answerNextDialog(page, 'accept');
    await chooseImportFile(page, jsonImportFile('synth-minimal-backup.json', { logs: [] }));

    await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
    expect(dialogs).toEqual([CONFIRM_IMPORT]);
  });

  test('IO-07 importing an empty JSON object is rejected with the format error (N3 fixed)', async ({ page, app }) => {
    const dialogs = await importEmptyObject(page, app);

    // 第一条断言是同步点：没修好时这里就失败（出现的是已恢复，不是格式错误提示）
    await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
    // 格式错误提示出现之后再检查：不应先弹替换确认，fixture 的记录也还在页面上
    expect(dialogs, '不应弹出替换确认框').toEqual([]);
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);
  });
});

// 旧路径的三项变化（D-10，所有者已批准）：新格式完整备份只替换记录、只含计划的文件单独提示后拒绝、5 MB 上限。
// 旧路径没有摘要确认、导入前留的数据和撤销（D-09，IO-08 在旧路径上由所有者豁免）。
test('IO-07 the legacy version imports the records of a new-format backup and keeps its own plan', async ({ page, app }) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();
  await gotoGoals(page);
  // 计划的结构：组号和内置任务的 id（进度和自定义待办随记录变，不属于计划）
  const planShape = async () =>
    (await readGroups(page)).map((g) => ({ code: g.code, taskIds: g.taskIds.filter((id) => !id.startsWith('c-')) }));
  const planBefore = await planShape();
  expect(planBefore.length, '示例计划的目标组').toBe(7);

  const records = legacyBackup('lgn');
  const dialogs = answerNextDialog(page, 'accept');
  await chooseImportFile(page, jsonImportFile('synth-full-backup.json', fullBackup(syntheticPlan('lgn', 2), records)));
  await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
  expect(dialogs).toEqual([CONFIRM_IMPORT]);
  await expectToast(page, TOAST_RESTORED);

  // 保存的 state 是文件里的记录在示例计划下 normalize 的结果；文件里的计划没有被应用
  await app.expectSaved((st) => st.logs.some((l: Log) => l.id === 'synth-lgn-1'), '等待导入后的保存');
  expect(await app.saved()).toEqual(expectedNormalize(records));
  await expect(page.locator('#importJson')).toHaveValue('');
  expect(await planShape()).toEqual(planBefore);
  // 文件里的计划文字（组名、任务、力量项）没有出现；备份的自定义待办是记录，会出现，所以只查计划的那几种文字
  await expect(page.locator('#goals').getByText(/SYNTH-lgn (group|task [0-9]|lift)/)).toHaveCount(0);
});

test.describe('IO-07 legacy version manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('IO-07 the legacy version refuses a plan-only file with its own message', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    const fixtureIds = fixture.logs.map((l: Log) => l.id);
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const writesBefore = app.backend.writes.length;

    const dialogs = recordDialogs(page);
    await chooseImportFile(page, jsonImportFile('synth-plan-only.json', planOnlyFile(syntheticPlan('lpo', 2))));
    await expectToast(page, TOAST_IMPORT_PLAN_LOCAL);
    expect(dialogs, '不应弹出确认框').toEqual([]);
    await expect(page.locator('#importJson')).toHaveValue('');
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length).toBe(writesBefore);
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);

    await expectOnlySentinelSaved(page, app, fixtureIds, writesBefore, 'SYNTH-IO07 plan-only sentinel');
  });

  test('IO-07 the legacy version refuses a file over 5 MB before reading it (D-10)', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    const fixtureIds = fixture.logs.map((l: Log) => l.id);
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const writesBefore = app.backend.writes.length;

    // 5 MB 加 1 字节：内容本身不是备份，被拒的原因只能是大小（读之前就拒绝）
    const dialogs = recordDialogs(page);
    await chooseImportFile(page, textImportFile('synth-big.json', 'x'.repeat(5 * 1024 * 1024 + 1)));
    await expectToast(page, TOAST_IMPORT_TOO_BIG);
    expect(dialogs, '不应弹出确认框').toEqual([]);
    await expect(page.locator('#importJson')).toHaveValue('');
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length).toBe(writesBefore);
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);

    await expectOnlySentinelSaved(page, app, fixtureIds, writesBefore, 'SYNTH-IO07 big-file sentinel');
  });
});

// 只在这个 describe 里打开下载：playwright.config.ts 的 acceptDownloads 默认值不改（D-16）
test.describe('IO-04 reading the exported backup from the download event', () => {
  test.use({ acceptDownloads: true });

  test('IO-04 an exported JSON backup imported again restores exactly the exported data', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    const sentinel = 'SYNTH-IO04 after export';
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();

    // 导出的备份只在内存里：读下载事件，不写文件、不进报告和注解（D-04）；旧路径导出的也是新格式完整备份（D-10）
    const { text: exported } = await downloadOf(page, () => page.locator('#exportJson').click());
    const backup = JSON.parse(exported);
    expect(backup.state).toEqual(withoutSynthetic(fixture));
    expect(app.backend.downloads.length, 'Claude 的 downloads 能力不应被调用').toBe(0);

    // 导出之后再改动：记一条合成记录并等它保存
    const comp = composer(page, 'w');
    await comp.type(sentinel);
    await comp.submit();
    await app.expectSaved((s) => s.logs.some((l: Log) => l.text === sentinel), '等待新记录保存');

    // 把导出的原文（不重新序列化）作为内存文件导入并接受：旧路径按 D-10 只替换记录
    const dialogs = answerNextDialog(page, 'accept');
    await chooseImportFile(page, textImportFile('synth-roundtrip.json', exported));
    await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
    expect(dialogs[0]).toBe(CONFIRM_IMPORT);
    await expectToast(page, TOAST_RESTORED);
    await app.expectSaved((s) => s.logs.every((l: Log) => l.text !== sentinel), '等待导入后的保存');

    expect(await app.saved()).toEqual(backup.state);
    await expect(page.locator('#tab-wk #days').getByText(sentinel)).toHaveCount(0);
    await gotoTimeline(page);
    await expect
      .poll(() => readTimeline(page), { message: '时间线与备份的推导不一致' })
      .toEqual(expectedTimeline(backup.state, FILTER_ALL));
  });
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
