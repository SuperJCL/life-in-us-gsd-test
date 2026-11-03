import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { ACCOUNT_DOC_PATH, FROZEN_NOW, FROZEN_TODAY, STATE_KEY } from '../../support/constants';
import { FILENAME_BACKUP_FROZEN, FILENAME_CSV, STATUS_LOCAL, TOAST_EXPORTED } from '../../support/strings';

// 合成文本，不含任何真实内容
const SEED_TEXT = 'SYNTH-SEED seeded entry';
const ENTRY_TEXT = 'SYNTH-MOCK03 account roundtrip';
const SENTINEL_TEXT = 'SYNTH-MOCK03 sentinel';

type Log = { text: string; date: string; cat: string };

// 合成种子：所有账户模式用例共用 local-seed.json
function loadSeed() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/local-seed.json'), 'utf8'));
}

test('MOCK-03 account mode saves a new entry to the mock and reads it back after reload', async ({ page, app }) => {
  await app.open({ mode: 'account', seed: loadSeed() });

  // 启动时恰好读了一次账户文档，状态栏是账户文案，localStorage 里没有应用的键（D-07）
  await app.expectAccountMode();

  // 这时 localStorage 是空的，所以种子条目只能来自 mock
  await expect(
    page.locator('#tab-wk [data-wday="2026-03-17"] [data-edit]').filter({ hasText: SEED_TEXT }),
  ).toBeVisible();

  // 记一笔
  await page.locator('#wkComp #w-text').fill(ENTRY_TEXT);
  await page.locator('#wkComp #w-add').click();

  // 先 poll：保存有 600 ms 防抖，等 mock 里的文档出现这条记录（D-18）
  await app.expectPersisted((s) =>
    s.logs.some((l: Log) => l.text === ENTRY_TEXT && l.date === FROZEN_TODAY),
  );
  const lastWrite = app.backend.writes[app.backend.writes.length - 1];
  expect(lastWrite.path).toBe(ACCOUNT_DOC_PATH);
  expect(lastWrite.data.logs.some((l: Log) => l.text === SEED_TEXT)).toBe(true);
  expect(lastWrite.data.logs.some((l: Log) => l.text === ENTRY_TEXT)).toBe(true);

  // reload 之后重新等就绪：第二次启动又读了一次，两条记录都从 mock 读回并显示
  await app.reload();
  await app.expectAccountMode({ reads: 2 });
  await expect(
    page.locator('#tab-wk [data-wday="2026-03-17"] [data-edit]').filter({ hasText: SEED_TEXT }),
  ).toBeVisible();
  await expect(
    page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`).filter({ hasText: ENTRY_TEXT }),
  ).toBeVisible();

  // 写入已经发生过：应用如果写了 localStorage，这里一定读得到（expectAccountMode 里也查了一次）
  expect(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY)).toBeNull();
});

// D-07 的常驻反向对照：证明账户模式的校验不是“永远通过”。
// user.id() 返回 null 时，应用静默退回 localStorage（应用的 init 就是这样写的），
// 这时 expectAccountMode 必须能发现。每次 npm test 都会运行。
// 另外：回退之后导出按钮仍会出现（应用只看 downloads 能力），
// 所以 D-08 的就绪条件里起决定作用的是状态栏，不是按钮。
test('MOCK-05 the account-mode check fails when user.id() resolves null and the app falls back to localStorage', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', userId: null, expectStore: 'local' });

  // mock 确实装上了，应用却真的退回了本地：状态栏是本地文案，mock 没有任何读取
  expect(await page.evaluate(() => 'claude' in window)).toBe(true);
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);
  expect(app.backend.reads).toEqual([]);

  // 账户模式的校验在这种情况下必须失败（reads 检查是第一条，同步失败，变成被 reject 的 Promise）
  // 用消息限定是哪一项失败，防止被别的错误顶替
  await expect(app.expectAccountMode()).rejects.toThrow(/读取次数或路径不对/);
});

// 上面那条只让三项检查里的第一项（reads）失败，后两项没有被执行到。
// 下面两条各自只破坏一项：reads 满足，其余按需破坏，证明状态栏检查和 localStorage 检查也不是“永远通过”。
test('MOCK-05 the account-mode check fails on its own when the status bar shows the local text', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadSeed() });
  await app.expectAccountMode();

  // 只把状态栏改成本地文案：reads 仍然是 1 次，localStorage 仍然是空的
  await page.locator('#status').evaluate((el, text) => {
    el.textContent = text;
  }, STATUS_LOCAL);
  await expect(app.expectAccountMode({ timeout: 500 })).rejects.toThrow(/状态栏不是账户同步文案/);
});

test('MOCK-05 the account-mode check fails on its own when localStorage holds the app key', async ({ page, app }) => {
  await app.open({ mode: 'account', seed: loadSeed() });
  await app.expectAccountMode();

  // 只往 localStorage 写应用的键：reads 和状态栏仍然正常
  await page.evaluate((key) => localStorage.setItem(key, '{}'), STATE_KEY);
  await expect(app.expectAccountMode()).rejects.toThrow(/localStorage 里出现了应用的键/);
});

// WR-04：同一个 AppHarness 第二次 open 会让 init script 累积（账户 mock 重定义 window.claude 会抛 TypeError），
// 所以直接拒绝，并且在碰 page 之前就失败。
test('MOCK-05 a second AppHarness.open on the same page is rejected with a clear error', async ({ app }) => {
  await app.open({ mode: 'account', seed: loadSeed() });
  await app.expectAccountMode();
  await expect(app.open({ mode: 'account' })).rejects.toThrow(/每个用例只能调用一次/);
});

// 否定断言（“启动时没写 mock”）必须在足够长的窗口里持续成立才有意义（同 WR-06）。
// manual 时钟让这个窗口确定、不靠睡眠。
test.describe('MOCK-03 manual clock', () => {
  // 同一个用例不混用 install 和 setFixedTime（D-15）：manual 时 frozenClock 什么都不做
  test.use({ clockMode: 'manual' });

  test('MOCK-03 startup reads the account document once and writes nothing before the first change', async ({
    page,
    app,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: loadSeed() });
    await app.expectAccountMode();

    // 启动时如果调用过保存，600 ms 防抖写入会在这次推进里发出
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await page.clock.runFor(2_000);

    // 哨兵：记一笔再推进同样的窗口，证明上面的窗口确实推进了防抖
    await page.locator('#wkComp #w-text').fill(SENTINEL_TEXT);
    await page.locator('#wkComp #w-add').click();
    await page.clock.runFor(2_000);
    await expect
      .poll(() => app.backend.writes.some((w) => w.data.logs.some((l: Log) => l.text === SENTINEL_TEXT)), {
        message: '等待哨兵写入到达 mock',
      })
      .toBe(true);

    // binding 调用按页面发出的顺序到达 Node，所以启动时的写入（如果有）一定排在哨兵写入之前：
    // “恰好一条且含哨兵”就证明启动没有写；哨兵本身又证明这个窗口确实推进了防抖。
    expect(app.backend.writes).toHaveLength(1);
    expect(app.backend.writes[0].path).toBe(ACCOUNT_DOC_PATH);
    expect(app.backend.reads).toEqual([ACCOUNT_DOC_PATH]);
  });
});

test('MOCK-04 account mode shows both export buttons and records what downloads.save receives', async ({
  page,
  app,
}) => {
  // ready() 已断言两个导出按钮可见（D-08）
  await app.open({ mode: 'account', seed: loadSeed() });
  expect(app.backend.downloads).toEqual([]);

  // JSON 备份
  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);
  const json = app.backend.downloads[0];
  expect(json.filename).toBe(FILENAME_BACKUP_FROZEN);
  expect(typeof json.data).toBe('string');
  expect(json.data.length).toBeGreaterThan(0);
  expect(JSON.parse(json.data).logs.some((l: Log) => l.text === SEED_TEXT)).toBe(true);
  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_EXPORTED);

  // JSON 和 CSV 成功后的 toast 文案相同，toast 约显示 1800 ms：先等 JSON 的 toast 自然消失，
  // 再点 CSV，后面的 toast 断言才能证明是 CSV 导出弹出的（WR-05）
  await expect(page.locator('#toast')).not.toHaveClass(/\bon\b/);

  // 日历 CSV：逐字内容比较放在 02-04，这里只确认文件名和种子条目的日期
  await page.locator('#exportCsv').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 CSV 下载记录' }).toBe(2);
  const csv = app.backend.downloads[1];
  expect(csv.filename).toBe(FILENAME_CSV);
  expect(csv.data.length).toBeGreaterThan(0);
  expect(csv.data).toContain('03/17/2026');
  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_EXPORTED);

  // 导出之后应用仍在账户模式：读取次数不变，localStorage 里没有应用的键
  await app.expectAccountMode();
});
