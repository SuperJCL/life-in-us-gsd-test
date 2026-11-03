import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { ACCOUNT_DOC_PATH, FROZEN_TODAY, STATE_KEY } from '../../support/constants';

// 合成文本，不含任何真实内容
const SEED_TEXT = 'SYNTH-SEED seeded entry';
const ENTRY_TEXT = 'SYNTH-MOCK03 account roundtrip';

type Log = { text: string; date: string; cat: string };

test('MOCK-03 account mode saves a new entry to the mock and reads it back after reload', async ({ page, app }) => {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '../../fixtures/local-seed.json'), 'utf8'));
  await app.open({ mode: 'account', seed });

  // 启动时恰好读了一次账户文档
  expect(app.backend.reads).toEqual([ACCOUNT_DOC_PATH]);

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
  expect(app.backend.reads).toEqual([ACCOUNT_DOC_PATH, ACCOUNT_DOC_PATH]);
  await expect(
    page.locator('#tab-wk [data-wday="2026-03-17"] [data-edit]').filter({ hasText: SEED_TEXT }),
  ).toBeVisible();
  await expect(
    page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`).filter({ hasText: ENTRY_TEXT }),
  ).toBeVisible();

  // 写入已经发生过：应用如果写了 localStorage，这里一定读得到
  expect(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY)).toBeNull();
});
