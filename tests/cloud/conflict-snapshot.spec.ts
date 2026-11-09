// Phase 9 的真冲突与留底用例（D-08 到 D-11）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 两台设备是同一个假服务器上的两个独立浏览器上下文，登录同一个账号；后保存的那台上传前发现服务器版本更新，
// 留底被覆盖的版本、上传本机版本、弹提示。下载用例只给第二台设备开 acceptDownloads。
import { readFile } from 'node:fs/promises';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { openDevice } from '../support/devices';
import { expectToast } from '../support/toast';
import {
  BTN_DOWNLOAD_SNAPSHOT,
  FILENAME_SNAPSHOT_FROZEN,
  TOAST_CONFLICT,
  TOAST_SNAPSHOT_DOWNLOADED,
} from '../support/strings';

type Log = { id: string; text: string };

const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

test('SYNC-05 a save over a newer server version keeps the last save, keeps the overwritten version on this device and says so', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });

    // 设备一先保存；设备二的基线还是旧的，随后保存
    const one = composer(page, 'w');
    await one.type('SYNTH-0908 first');
    await one.submit();
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0908 first'), { message: '等待设备一的记录上传' })
      .toBe(true);
    const two = composer(second.page, 'w');
    await two.type('SYNTH-0908 second');
    await two.submit();

    await expect
      .poll(
        () => {
          const logs = app.fake.lastState(0)?.logs;
          return hasText(logs, 'SYNTH-0908 second') && !hasText(logs, 'SYNTH-0908 first');
        },
        { message: '等待设备二的保存成为服务器上的最新版本' },
      )
      .toBe(true);

    await expectToast(second.page, TOAST_CONFLICT);
    await expect(second.page.locator('#toast button')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    await expect(second.page.locator('#snapshotBtn')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);

    const snap = await second.page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    }, `usj:v2:${app.fake.users[0].id}:snapshot`);
    expect(snap).not.toBeNull();
    expect(snap.kind).toBe('state');
    expect(hasText(snap.data.logs, 'SYNTH-0908 first')).toBe(true);
    expect(hasText(snap.data.logs, 'SYNTH-0908 second')).toBe(false);

    await expect(page.locator('#snapshotBtn')).toBeHidden();
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 downloading the kept version saves a state-shaped JSON file without any account identifier and removes it from this device', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  const second = await openDevice({ browser, guard, fake: app.fake, acceptDownloads: true });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });

    const one = composer(page, 'w');
    await one.type('SYNTH-0908 first');
    await one.submit();
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0908 first'), { message: '等待设备一的记录上传' })
      .toBe(true);
    const two = composer(second.page, 'w');
    await two.type('SYNTH-0908 second');
    await two.submit();
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();

    const user = app.fake.users[0];
    const [download] = await Promise.all([second.page.waitForEvent('download'), second.page.locator('#snapshotBtn').click()]);

    const filename = download.suggestedFilename();
    expect(filename).toBe(FILENAME_SNAPSHOT_FROZEN);
    expect(filename).not.toContain(user.email);
    expect(filename).not.toContain(user.id);
    const path = await download.path();
    const text = await readFile(path, 'utf-8');
    expect(text).not.toContain(user.email);
    const file = JSON.parse(text);
    expect(Object.keys(file).sort()).toEqual(['arrival', 'custom', 'lifts', 'logs', 'presets', 'reviews', 'tasks']);
    expect(hasText(file.logs, 'SYNTH-0908 first')).toBe(true);

    await expect
      .poll(() => second.page.evaluate((key) => localStorage.getItem(key), `usj:v2:${user.id}:snapshot`), {
        message: '下载后本机留底应当已删除',
      })
      .toBeNull();
    await expect(second.page.locator('#snapshotBtn')).toBeHidden();
    await expectToast(second.page, TOAST_SNAPSHOT_DOWNLOADED);
  } finally {
    await second.context.close();
  }
});
