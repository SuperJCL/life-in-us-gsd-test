// 导出用例（IO-02、IO-03、MOCK-04）。
// 导出内容只在内存里比较：不写文件、不附加到报告、不进 annotation 或控制台（D-16）。
// 文件名和内容只从 app.backend.downloads（mock 的 downloads.save 记录）读取。
import { test, expect } from '../../support/test';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { builtinTaskIds, csvMismatch, expectedCalendarCsv } from '../../support/expect-from-fixture';
import {
  CAT_OTHER,
  CATEGORY_NAMES,
  CSV_DONE_PREFIX,
  CSV_GROUP_SUFFIX,
  CSV_HEADER,
  FILENAME_BACKUP_FROZEN,
  FILENAME_CSV,
  TOAST_EXPORTED,
  TOAST_NOTHING_TO_EXPORT,
} from '../../support/strings';

test('IO-03 the JSON backup of the full fixture equals the fixture without _synthetic and the seeded document', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  expect(app.backend.downloads.length).toBe(0);

  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);

  const { filename, data } = app.backend.downloads[0];
  expect(filename).toBe(FILENAME_BACKUP_FROZEN);
  const backup = JSON.parse(data);

  // 备份与去掉 _synthetic 的 fixture 深度相等
  expect(backup).toEqual(withoutSynthetic(fixture));

  // D-16 的理解：还没保存时“最新文档”就是种子文档，而 normalize 会丢掉 _synthetic，
  // 所以与种子文档按去掉 _synthetic 比较；此时还没有任何写入。
  expect(app.backend.writes).toEqual([]);
  expect(backup).toEqual(withoutSynthetic(app.backend.lastState()));

  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_EXPORTED);
});

test('IO-02 the calendar CSV export matches the spec-derived expectation byte for byte', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  // 内置任务的文字只在运行时从页面读（D-14），只放在这个用例的内存 Map 里：
  // 不写文件、不进 annotation 或控制台
  const texts = new Map<string, string>();
  for (const id of builtinTaskIds(fixture)) {
    const label = await page.locator(`#goals [data-task="${id}"]`).getAttribute('aria-label');
    expect(label, `目标页上读不到任务 ${id} 的 aria-label：位置 id 可能随源码里任务的顺序变了，见 tests/support/task-ids.ts`).toBeTruthy();
    texts.set(id, label as string);
  }

  const expected = expectedCalendarCsv(fixture, (id) => texts.get(id) as string);

  // 用 length 而不是 toEqual([])：失败时不打印下载记录里的 CSV 内容（WR-01）
  expect(app.backend.downloads.length).toBe(0);
  await page.locator('#exportCsv').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 CSV 下载记录' }).toBe(1);

  const { filename, data } = app.backend.downloads[0];
  expect(filename).toBe(FILENAME_CSV);
  // 逐字节比较，但失败时不能把内置任务文字打印出来：expect 只拿到布尔值和脱敏后的诊断（WR-01）
  const mismatch = csvMismatch(data, expected, texts);
  expect(mismatch === null, mismatch ?? '').toBe(true);

  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_EXPORTED);
});

test('IO-02 handwritten golden rows anchor quoting, the 80-character subject cut and MM/DD/YYYY dates', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  // 三行金标准：手写，不调用 csvCell、usDate 或 expectedCalendarCsv 生成。
  // 类别名和前后缀用 strings.ts 的常量，其余字符逐字手写。
  const catJob = CATEGORY_NAMES[3]; // synth-full-03 的类别
  const golden = [
    // 来自 synth-full-03：主题被截在第 80 个字符，两个单元格都加引号，内部双引号写成两个，描述里有真实换行
    `"[${catJob}] SYNTH-GOLD say ""hi"", then wait, then say ""bye"" again and again until this line i",03/17/2026,True,"SYNTH-GOLD say ""hi"", then wait, then say ""bye"" again and again until this line is long enough to be cut\nsecond line, still SYNTH"`,
    // 来自 synth-full-05：含 <、& 和单引号，不加引号
    `[${CAT_OTHER}] SYNTH-ESC <b>bold</b> & 'single' quotes,03/18/2026,True,SYNTH-ESC <b>bold</b> & 'single' quotes`,
    // 自定义待办 c-synth-2：已完成，文字里有逗号所以主题加引号
    `"${CSV_DONE_PREFIX}SYNTH-TODO finished, custom",03/10/2026,True,P3${CSV_GROUP_SUFFIX}`,
  ];

  await page.locator('#exportCsv').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 CSV 下载记录' }).toBe(1);
  const { data } = app.backend.downloads[0];
  expect(data.startsWith(CSV_HEADER + '\n')).toBe(true);
  // 用布尔值断言：data 含全部内置任务文字，toContain 失败时会把整段 CSV 打印出来（WR-01）。
  // 消息里只放金标准行的前 40 个字符，那是合成文字。
  for (const row of golden) {
    expect(data.includes(row), `应用导出缺少金标准行：${row.slice(0, 40)}`).toBe(true);
  }

  // 同样的金标准也必须出现在独立生成器的输出里（内置任务用合成占位文字，不读页面）：
  // 这样金标准同时约束应用和生成器，防止两者犯同一个错误
  const generated = expectedCalendarCsv(fixture, (id) => 'SYNTH-builtin-' + id);
  for (const row of golden) expect(generated, `生成器输出缺少金标准行：${row.slice(0, 40)}`).toContain(row);
});

test('IO-02 exporting the calendar with nothing dated shows the empty toast and saves nothing', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadFixture('minimal-state.json') });
  await app.expectAccountMode();

  await page.locator('#exportCsv').click();
  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_NOTHING_TO_EXPORT);

  // 为什么这能证明 CSV 没有保存：mock 按页面调用的顺序记录，
  // CSV 如果调用过 save，它的记录一定排在后面这次 JSON 导出之前
  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);
  expect(app.backend.downloads.length).toBe(1);
  expect(app.backend.downloads[0].filename).toBe(FILENAME_BACKUP_FROZEN);
});

test('IO-03 the JSON backup equals the latest saved document after a change', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  const text = 'SYNTH-IO03 after change';
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  await page.locator('#wkComp #w-text').fill(text);
  await page.locator('#wkComp #w-add').click();

  // 保存有 600 ms 防抖：poll 等 mock 里的文档出现这条记录
  await app.expectPersisted((s) => s.logs.some((l: { text: string }) => l.text === text));
  const saved = app.backend.lastState();
  expect(saved).toEqual(app.backend.writes[app.backend.writes.length - 1].data);

  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);

  const backup = JSON.parse(app.backend.downloads[0].data);
  expect(backup).toEqual(saved);
  expect(backup).not.toHaveProperty('_synthetic');
});

test('MOCK-04 exporting twice records two identical downloads and every test starts with an empty mock', async ({
  page,
  app,
}) => {
  // 每个用例的 AppHarness 新建自己的 MockBackend，workers: 2 并行时用例之间不共享任何记录
  expect(app.backend.reads).toEqual([]);
  expect(app.backend.writes).toEqual([]);
  expect(app.backend.downloads.length).toBe(0);

  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  // 同一份状态连续导出两次：每次都 poll 到记录数增加，两条完全相同
  await page.locator('#exportCsv').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待第 1 条 CSV 下载记录' }).toBe(1);
  await page.locator('#exportCsv').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待第 2 条 CSV 下载记录' }).toBe(2);
  // 两条 CSV 都含内置任务文字：比较布尔值，失败时不能打印 data（WR-01）
  expect(
    app.backend.downloads[1].filename === app.backend.downloads[0].filename &&
      app.backend.downloads[1].data === app.backend.downloads[0].data,
    '连续两次导出的 CSV 不一致（内容已隐藏）',
  ).toBe(true);

  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待第 1 条 JSON 下载记录' }).toBe(3);
  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待第 2 条 JSON 下载记录' }).toBe(4);
  expect(app.backend.downloads[3]).toEqual(app.backend.downloads[2]);
  expect(app.backend.downloads[2].filename).toBe(FILENAME_BACKUP_FROZEN);
});
