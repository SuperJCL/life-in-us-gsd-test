// Phase 11 的云端导出用例（IO-06）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 下载的文件只在内存里读（downloadOf 读完立刻删除 Playwright 的临时文件），不写磁盘、不进报告；
// 失败消息里不放 CSV 或计划的全文（沿用 WR-01 的布尔断言写法）。
// 导出按钮在编辑闸门打开时是禁用的，这里的用例都在登录且已同步之后导出。
import { test, expect } from '../support/test';
import { downloadOf } from '../support/download';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { legacyBackup } from '../support/backup-files';
import { chooseImportFile, jsonImportFile } from '../support/import-file';
import { confirmOk, readConfirm } from '../support/confirm';
import { expectToast } from '../support/toast';
import { expectedNormalize } from '../support/expect-from-fixture';
import { BACKUP_APP, BACKUP_FORMAT, BACKUP_KIND_FULL, FROZEN_NOW } from '../support/constants';
import {
  BTN_DOWNLOAD_SNAPSHOT,
  CAT_LANGUAGE,
  CSV_HEADER,
  FILENAME_BACKUP_FROZEN,
  FILENAME_CSV,
  TOAST_IMPORTED,
} from '../support/strings';

test.use({ acceptDownloads: true });

const NARROW = { width: 375, height: 800 };

// 计划去掉 _synthetic 标记、其余原样（normalizePlan 的结果）；用例独立写出期望值
const planLike = (p: any): any => {
  const { _synthetic, ...rest } = p;
  return rest;
};

test("IO-06 the cloud version downloads the account's JSON backup at desktop and phone width", async ({ app, page }) => {
  const seed = syntheticState('exp');
  const plan = syntheticPlan('exp', 2);
  await app.open({ mode: 'cloud', seed, plan, login: 0 });

  // 桌面宽度（1280）
  const wide = await downloadOf(page, () => page.locator('#exportJson').click());
  expect(wide.filename).toBe(FILENAME_BACKUP_FROZEN);
  const backup = JSON.parse(wide.text);

  // 包装（11-02 的格式）：键和键序固定，只有应用标识、格式号、种类、导出时刻、计划和记录
  expect(Object.keys(backup)).toEqual(['app', 'format', 'kind', 'exportedAt', 'plan', 'state']);
  expect(backup.app).toBe(BACKUP_APP);
  expect(backup.format).toBe(BACKUP_FORMAT);
  expect(backup.kind).toBe(BACKUP_KIND_FULL);
  expect(backup.exportedAt).toBe(new Date(FROZEN_NOW).toISOString());

  // 记录与账号当前的记录一致：服务器上的种子经应用 normalize 之后的样子（还没有任何保存，服务器上是原始种子）
  expect(backup.state).toEqual(expectedNormalize(seed));
  expect(expectedNormalize(app.fake.lastState(0))).toEqual(backup.state);
  expect(planLike(app.fake.lastPlan(0))).toEqual(backup.plan);

  // 计划的组、任务、力量项逐项一致（id 和文字都是合成的）
  const expectedPlan = planLike(plan);
  expect(backup.plan).toEqual(expectedPlan);
  expect(backup.plan.groups.map((g: any) => [g.id, g.name])).toEqual(expectedPlan.groups.map((g: any) => [g.id, g.name]));
  expect(backup.plan.groups.flatMap((g: any) => g.tasks.map((t: any) => [t.id, t.text]))).toEqual(
    expectedPlan.groups.flatMap((g: any) => g.tasks.map((t: any) => [t.id, t.text])),
  );
  expect(backup.plan.lifts.map((l: any) => [l.id, l.n])).toEqual(expectedPlan.lifts.map((l: any) => [l.id, l.n]));

  // 手机宽度（375）：按钮仍然可见可点，导出的内容与桌面宽度相同
  await page.setViewportSize(NARROW);
  await expect(page.locator('#exportJson')).toBeVisible();
  const narrow = await downloadOf(page, () => page.locator('#exportJson').click());
  expect(narrow.filename).toBe(wide.filename);
  expect(narrow.text === wide.text, '两种宽度导出的 JSON 内容不一致（内容已隐藏）').toBe(true);
});

test("IO-06 the cloud version downloads the account's calendar CSV at desktop and phone width", async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('exp'), plan: syntheticPlan('exp', 2), login: 0 });

  // 手写的期望：表头加一行记录（主题是 [类别] 加文字，日期写成 MM/DD/YYYY，描述是整段文字）；种子里没有任务进度，没有任务行
  const expected = `${CSV_HEADER}\n[${CAT_LANGUAGE}] 合成记录 exp,03/17/2026,True,合成记录 exp`;

  const wide = await downloadOf(page, () => page.locator('#exportCsv').click());
  expect(wide.filename).toBe(FILENAME_CSV);
  expect(wide.text.startsWith(CSV_HEADER + '\n')).toBe(true);
  expect(wide.text === expected, '桌面宽度导出的 CSV 与手写的期望不一致（内容已隐藏）').toBe(true);

  await page.setViewportSize(NARROW);
  await expect(page.locator('#exportCsv')).toBeVisible();
  const narrow = await downloadOf(page, () => page.locator('#exportCsv').click());
  expect(narrow.filename).toBe(FILENAME_CSV);
  expect(narrow.text === wide.text, '两种宽度导出的 CSV 内容不一致（内容已隐藏）').toBe(true);
});

test('IO-06 the exported files carry no account identifier', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('exp'), plan: syntheticPlan('exp', 2), login: 0 });
  const user = app.fake.users[0];

  const json = await downloadOf(page, () => page.locator('#exportJson').click());
  const csv = await downloadOf(page, () => page.locator('#exportCsv').click());

  // 布尔断言：失败消息只说是哪个文件，不打印内容
  for (const [label, file] of [['JSON', json], ['CSV', csv]] as const) {
    expect(file.filename.includes(user.email) || file.filename.includes(user.id), `${label} 文件名含账号标识`).toBe(false);
    expect(file.text.includes(user.email), `${label} 内容含账号邮箱`).toBe(false);
    expect(file.text.includes(user.id), `${label} 内容含账号 id`).toBe(false);
  }
});

test('IO-06 the toolbar fits a 375 px wide screen with every button shown', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('tbr'), login: 0 });
  const user = app.fake.users[0];

  // 导入一份合成旧备份：出现“撤销导入”
  await chooseImportFile(page, jsonImportFile('synth-toolbar.json', legacyBackup('tbr1')));
  await readConfirm(page);
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);
  await expect(page.locator('#undoImportBtn')).toBeVisible();

  // 放一份合成的冲突留底并重新打开：出现“下载留底”（冲突留底的键见 Phase 9 的缓存键）
  await page.evaluate(
    ([key, json]) => localStorage.setItem(key, json),
    [`usj:v2:${user.id}:snapshot`, JSON.stringify({ kind: 'state', told: true, data: syntheticState('tbr-old') })],
  );
  await app.reload();
  await expect(page.locator('#snapshotBtn')).toBeVisible();
  await expect(page.locator('#snapshotBtn')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
  await expect(page.locator('#undoImportBtn')).toBeVisible();

  await page.setViewportSize(NARROW);
  await expect(page.locator('#exportJson')).toBeVisible();

  // 页面没有横向滚动
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, '页面出现横向滚动').toBeLessThanOrEqual(NARROW.width);

  // 工具栏里每个可见按钮都在屏幕内
  const boxes = await page.locator('.toolbar button, .toolbar label').evaluateAll((els) =>
    els
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.id, visible: r.width > 0 && r.height > 0, left: r.left, right: r.right };
      })
      .filter((b) => b.visible),
  );
  const ids = boxes.map((b) => b.id);
  for (const id of ['exportCsv', 'exportJson', 'snapshotBtn', 'undoImportBtn', 'logoutBtn']) {
    expect(ids, `工具栏里缺少可见按钮 ${id}`).toContain(id);
  }
  for (const b of boxes) {
    expect(b.left >= 0 && b.right <= NARROW.width, `按钮 ${b.id || '(无 id)'} 超出 375 宽的屏幕`).toBe(true);
  }
});
