// 导出用例（IO-02、IO-03、IO-06）。
// 导出内容只在内存里比较：读 Playwright 的下载事件，不写文件、不附加到报告、不进 annotation 或控制台（D-16）。
// 文件名和内容只从 downloadOf（tests/support/download.ts）读取；Claude 的 downloads 能力不再被调用，mock 的下载记录必须一直是空的。
// 只在这个文件里打开下载：playwright.config.ts 的 acceptDownloads 默认值不改。
import { test, expect } from '../../support/test';
import { downloadOf } from '../../support/download';
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_FULL, FROZEN_NOW } from '../../support/constants';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { builtinTaskIds, csvMismatch, expectedCalendarCsv, expectedNormalize } from '../../support/expect-from-fixture';
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

test.use({ acceptDownloads: true });

test('IO-03 the JSON backup of the full fixture wraps the fixture without _synthetic together with the sample plan', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  expect(app.backend.downloads.length).toBe(0);

  const { filename, text } = await downloadOf(page, () => page.locator('#exportJson').click());
  expect(filename).toBe(FILENAME_BACKUP_FROZEN);
  const backup = JSON.parse(text);

  // 包装（11-02 的格式）：键和键序固定，只有应用标识、格式号、种类、导出时刻、计划和记录，没有任何账号标识
  expect(Object.keys(backup)).toEqual(['app', 'format', 'kind', 'exportedAt', 'plan', 'state']);
  expect(backup.app).toBe(BACKUP_APP);
  expect(backup.format).toBe(BACKUP_FORMAT);
  expect(backup.kind).toBe(BACKUP_KIND_FULL);
  expect(backup.exportedAt).toBe(new Date(FROZEN_NOW).toISOString());

  // 记录与去掉 _synthetic 的 fixture 深度相等
  expect(backup.state).toEqual(withoutSynthetic(fixture));

  // 计划是应用正在用的示例计划：任务 id 包含 fixture 用到的全部内置任务 id
  const planIds: string[] = backup.plan.groups.flatMap((g: { tasks: { id: string }[] }) => g.tasks.map((t) => t.id));
  const missing = builtinTaskIds(fixture).filter((id) => !planIds.includes(id));
  expect(missing, '计划里缺少 fixture 用到的内置任务 id').toEqual([]);

  // D-16 的理解：还没保存时“最新文档”就是种子文档，而 normalize 会丢掉 _synthetic，
  // 所以与种子文档按去掉 _synthetic 比较；此时还没有任何写入。
  expect(app.backend.writes).toEqual([]);
  expect(backup.state).toEqual(withoutSynthetic(app.backend.lastState()));
  expect(app.backend.downloads.length, 'Claude 的 downloads 能力不应被调用').toBe(0);

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
  const { filename, text: data } = await downloadOf(page, () => page.locator('#exportCsv').click());
  expect(filename).toBe(FILENAME_CSV);
  // 逐字节比较，但失败时不能把内置任务文字打印出来：expect 只拿到布尔值和脱敏后的诊断（WR-01）；不加 BOM
  const mismatch = csvMismatch(data, expected, texts);
  expect(mismatch === null, mismatch ?? '').toBe(true);
  expect(data.charCodeAt(0) === 0xfeff, 'CSV 不应带 BOM').toBe(false);
  expect(app.backend.downloads.length, 'Claude 的 downloads 能力不应被调用').toBe(0);

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

  const { text: data } = await downloadOf(page, () => page.locator('#exportCsv').click());
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

test('IO-02 exporting the calendar with nothing dated shows the empty toast and downloads nothing', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadFixture('minimal-state.json') });
  await app.expectAccountMode();

  // 数下载事件：CSV 如果下载了，它的事件一定排在后面这次 JSON 导出之前
  const names: string[] = [];
  page.on('download', (d) => names.push(d.suggestedFilename()));

  await page.locator('#exportCsv').click();
  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_NOTHING_TO_EXPORT);

  const { filename } = await downloadOf(page, () => page.locator('#exportJson').click());
  expect(filename).toBe(FILENAME_BACKUP_FROZEN);
  expect(names).toEqual([FILENAME_BACKUP_FROZEN]);
  expect(app.backend.downloads.length, 'Claude 的 downloads 能力不应被调用').toBe(0);
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

  const { text: file } = await downloadOf(page, () => page.locator('#exportJson').click());

  const backup = JSON.parse(file);
  expect(backup.state).toEqual(saved);
  expect(backup.state).not.toHaveProperty('_synthetic');
});

test('IO-06 exporting twice downloads two identical files and the Claude downloads capability is never called', async ({
  page,
  app,
}) => {
  // 每个用例的 AppHarness 新建自己的 MockBackend：Claude 的 downloads 能力一次都没被调用，记录一直是空的
  expect(app.backend.reads).toEqual([]);
  expect(app.backend.writes).toEqual([]);
  expect(app.backend.downloads.length).toBe(0);

  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  // 同一份状态连续导出两次，两份文件完全相同
  const csv1 = await downloadOf(page, () => page.locator('#exportCsv').click());
  const csv2 = await downloadOf(page, () => page.locator('#exportCsv').click());
  // 两份 CSV 都含内置任务文字：比较布尔值，失败时不能打印内容（WR-01）
  expect(csv1.filename === csv2.filename && csv1.text === csv2.text, '连续两次导出的 CSV 不一致（内容已隐藏）').toBe(true);
  expect(csv1.filename).toBe(FILENAME_CSV);

  const json1 = await downloadOf(page, () => page.locator('#exportJson').click());
  const json2 = await downloadOf(page, () => page.locator('#exportJson').click());
  expect(json2).toEqual(json1);
  expect(json1.filename).toBe(FILENAME_BACKUP_FROZEN);

  expect(app.backend.downloads.length, 'Claude 的 downloads 能力不应被调用').toBe(0);
});

test('IO-06 calendar cells that start with a formula character get a leading quote (B7)', async ({ page, app }) => {
  // B7：日历工具（Excel、Outlook、Google 日历）可能把以 = + - @、制表符、回车开头的单元格当公式执行；
  // 这类单元格前面多一个英文单引号，再按原来的规则加引号。普通文字和日期不受影响。
  const cat = CATEGORY_NAMES[0];
  const mk = (n: number, text: string) => ({ id: `synth-b7-${n}`, date: '2026-03-17', cat, text });
  const state = {
    _synthetic: true,
    logs: [
      mk(1, '=SYNTH-B7 sum'),
      mk(2, '+SYNTH-B7 plus'),
      mk(3, '-SYNTH-B7 minus'),
      mk(4, '@SYNTH-B7 at'),
      mk(5, '\tSYNTH-B7 tab'),
      mk(6, '\rSYNTH-B7 return'),
      mk(7, '-SYNTH-B7 say "hi", ok'),
      mk(8, 'SYNTH-B7 plain =not first'),
    ],
  };
  await app.open({ mode: 'account', seed: state });
  await app.expectAccountMode();

  // 金标准行：手写，不调用 csvCell 或 expectedCalendarCsv 生成。
  // 主题单元格以 “[类别] ” 开头，不受影响；只有描述单元格以公式字符开头，前面多一个单引号。
  const golden = [
    `[${cat}] =SYNTH-B7 sum,03/17/2026,True,'=SYNTH-B7 sum`,
    `[${cat}] +SYNTH-B7 plus,03/17/2026,True,'+SYNTH-B7 plus`,
    `[${cat}] -SYNTH-B7 minus,03/17/2026,True,'-SYNTH-B7 minus`,
    `[${cat}] @SYNTH-B7 at,03/17/2026,True,'@SYNTH-B7 at`,
    `[${cat}] \tSYNTH-B7 tab,03/17/2026,True,'\tSYNTH-B7 tab`,
    // 回车既触发前缀，也在需要加引号的字符里：主题和描述两格都加引号
    `"[${cat}] \rSYNTH-B7 return",03/17/2026,True,"'\rSYNTH-B7 return"`,
    // 前缀之后仍按引号规则：描述含逗号和双引号，整格加引号，内部双引号写成两个
    `"[${cat}] -SYNTH-B7 say ""hi"", ok",03/17/2026,True,"'-SYNTH-B7 say ""hi"", ok"`,
    // 公式字符不在开头：不加前缀
    `[${cat}] SYNTH-B7 plain =not first,03/17/2026,True,SYNTH-B7 plain =not first`,
  ];

  const { text: data } = await downloadOf(page, () => page.locator('#exportCsv').click());
  expect(data.startsWith(CSV_HEADER + '\n')).toBe(true);
  // 布尔断言，失败消息只放金标准的前 40 个字符（合成文字）
  for (const row of golden) {
    expect(data.includes(row), `应用导出缺少金标准行：${row.slice(0, 40)}`).toBe(true);
  }
  // 日期单元格不受影响：每行的日期都是原样的 MM/DD/YYYY
  expect(data.split('\n').filter((l) => l.includes(',03/17/2026,True,')).length).toBeGreaterThanOrEqual(golden.length - 1);

  // 同样的金标准也必须出现在独立生成器的输出里：金标准同时约束应用和生成器
  const generated = expectedCalendarCsv(expectedNormalize(state), (id) => 'SYNTH-builtin-' + id);
  for (const row of golden) {
    expect(generated.includes(row), `生成器输出缺少金标准行：${row.slice(0, 40)}`).toBe(true);
  }
});
