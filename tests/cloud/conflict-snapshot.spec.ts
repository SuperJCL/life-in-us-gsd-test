// Phase 9 的真冲突与留底用例（D-08 到 D-11）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 两台设备是同一个假服务器上的两个独立浏览器上下文，登录同一个账号。
// 10-07 起在线时晚一步的保存不再冲突（重做分支，见 remote-update.spec.ts）；真冲突只在离线重连时出现（D-03）：
// 设备二的列表请求就以网络错误失败（opsOk 为假），设备一保存之后设备二重新联网，整份以设备二为准上传，设备一的版本留底、弹提示。
// 这个构造在 makeOfflineConflict 里；设备二一律是 manual 时钟（openSecond），被拒连接的 console.error 按故障命中次数精确确认。
// 下载用例只给第二台设备开 acceptDownloads。
import { readFile } from 'node:fs/promises';
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { openDevice, type Device } from '../support/devices';
import type { AppHarness } from '../support/app';
import type { Page } from '../support/test';
import { expectToast } from '../support/toast';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW } from '../support/constants';
import {
  BANNER_SNAPSHOT_NOT_KEPT,
  BTN_ACK,
  BTN_DOWNLOAD_SNAPSHOT,
  FILENAME_SNAPSHOT_FROZEN,
  TOAST_CONFLICT,
  TOAST_SNAPSHOT_DOWNLOADED,
  TOAST_SNAPSHOT_FAILED,
  statusOffline,
} from '../support/strings';

type Log = { id: string; text: string };

const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);

const RECORD = /\/api\/collections\/journey_docs\/records\/[^/]+$/;
const LIST_PATH = '/api/collections/journey_docs/records';

// 设备二：manual 时钟（open 之前 install，登录后 pauseAt），init 在导航之前装测试装置
async function openSecond(
  app: AppHarness,
  browser: Parameters<typeof openDevice>[0]['browser'],
  guard: Parameters<typeof openDevice>[0]['guard'],
  o: { acceptDownloads?: boolean; init?: (p: Page) => Promise<void> } = {},
): Promise<Device> {
  const second = await openDevice({ browser, guard, fake: app.fake, clock: 'none', acceptDownloads: o.acceptDownloads });
  try {
    if (o.init) await o.init(second.page);
    await second.page.clock.install({ time: FROZEN_NOW });
    await second.app.open({ mode: 'cloud', login: 0 });
    await second.page.clock.pauseAt(FROZEN_NOW + 60_000);
  } catch (error) {
    await second.context.close();
    throw error;
  }
  return second;
}

// 设备一经界面记一笔，等到服务器 state 里出现它
async function oneSaves(app: AppHarness, page: Page, text: string) {
  const one = composer(page, 'w');
  await one.type(text);
  await one.submit();
  await expect.poll(() => hasText(app.fake.lastState(0)?.logs, text), { message: `等待设备一的记录上传：${text}` }).toBe(true);
}

// Phase 9 的“设备二基线过期后直接保存”换成 D-03 的离线构造：
// 设备二的列表请求被拒（10-02 的 context 故障）→ 设备二记一笔、推过防抖，状态 offline（任何一步离线失败都使 opsOk 为假）→ 设备一保存（oneSaves）
// → 撤掉故障（可选：只对设备二的下一次单条 PATCH 再加一个故障）并派发 online → 设备二读到更新的服务器版本，走整份覆盖加留底（不是重做）。
// 返回两个故障句柄，调用方用 hits 确认被拒连接的 console.error 条数。
async function makeOfflineConflict(
  app: AppHarness,
  second: Device,
  o: { secondText: string; oneSaves: () => Promise<void>; patch?: 'refuse' | 'lose-answer' },
) {
  const listFault = app.fake.fault({ method: 'GET', path: LIST_PATH, mode: 'refuse', context: second.context });
  const two = composer(second.page, 'w');
  await two.type(o.secondText);
  await two.submit();
  await second.page.clock.runFor(1_000);
  await expect(second.page.locator('#status')).toHaveAttribute('data-state', 'offline');
  await o.oneSaves();
  await app.fake.clearFaults();
  const patchFault = o.patch ? app.fake.fault({ method: 'PATCH', path: RECORD, mode: o.patch, times: 1, context: second.context }) : null;
  await second.context.setOffline(true);
  await second.context.setOffline(false);
  return { listFault, patchFault };
}

test('SYNC-05 a save over a newer server version keeps the last save, keeps the overwritten version on this device and says so', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  const second = await openSecond(app, browser, guard);
  try {
    // 设备二先离线记一笔，设备一保存，设备二重新联网：整份以设备二为准
    const { listFault } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0908 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0908 first'),
    });

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
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits });
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
  const second = await openSecond(app, browser, guard, { acceptDownloads: true });
  try {
    const { listFault } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0908 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0908 first'),
    });
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
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits });
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 the download address of the kept version stays valid after the click and is released much later', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  // 设备二用 manual 时钟：下载地址的回收计时器由测试推进，不真的等；测试装置只装在设备二：记下每次回收下载地址的调用
  const second = await openSecond(app, browser, guard, {
    acceptDownloads: true,
    init: (p) =>
      p.addInitScript(() => {
        const revoked: string[] = [];
        (window as unknown as { __revoked: string[] }).__revoked = revoked;
        const original = URL.revokeObjectURL;
        URL.revokeObjectURL = function (url: string) {
          revoked.push(String(url));
          return original.call(URL, url);
        };
      }),
  });
  try {
    const revokedCount = () => second.page.evaluate(() => (window as unknown as { __revoked: string[] }).__revoked.length);

    const { listFault } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0912 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0912 first'),
    });
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();

    const [download] = await Promise.all([second.page.waitForEvent('download'), second.page.locator('#snapshotBtn').click()]);
    expect(download.suggestedFilename()).toBe(FILENAME_SNAPSHOT_FROZEN);
    // 点击之后地址还没有回收（下载请求发出时它必须还有效）；本机副本按 D-10 已经删除
    expect(await revokedCount()).toBe(0);
    await second.page.clock.runFor(29_000);
    expect(await revokedCount()).toBe(0);
    await second.page.clock.runFor(2_000);
    expect(await revokedCount()).toBe(1);
    expect(await second.page.evaluate((k) => localStorage.getItem(k), `usj:v2:${app.fake.users[0].id}:snapshot`)).toBeNull();
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits });
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 a newer conflict replaces the single kept version', async ({ app, page, browser, guard }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  const second = await openSecond(app, browser, guard);
  try {
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const readKeys = () =>
      second.page.evaluate(
        (k) => ({
          keys: Object.keys(localStorage).filter((x) => x.endsWith(':snapshot')),
          snap: JSON.parse(localStorage.getItem(k) ?? 'null'),
        }),
        key,
      );

    // 第一次冲突：设备二的 first 被覆盖，留底含 first，不下载
    const one = composer(page, 'w');
    const { listFault: list1 } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0908 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0908 first'),
    });
    await expect
      .poll(async () => hasText((await readKeys()).snap?.data.logs, 'SYNTH-0908 first'), { message: '等待第一份留底' })
      .toBe(true);
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0908 second'), { message: '等待设备二的保存成为服务器上的最新版本' })
      .toBe(true);

    // 第二次冲突：设备二再离线记 fourth；设备一重新打开，取到设备二保存的版本（不算冲突），再记 third；设备二重新联网
    const { listFault: list2 } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0908 fourth',
      oneSaves: async () => {
        await app.reload();
        await one.type('SYNTH-0908 third');
        await one.submit();
        await expect
          .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0908 third'), { message: '等待设备一的第二条记录上传' })
          .toBe(true);
        await expect(page.locator('#snapshotBtn')).toBeHidden();
      },
    });
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0908 fourth'), { message: '等待设备二的保存成为最新版本' })
      .toBe(true);
    await expect
      .poll(async () => hasText((await readKeys()).snap?.data.logs, 'SYNTH-0908 third'), { message: '等待第二份留底替换第一份' })
      .toBe(true);

    const { keys, snap } = await readKeys();
    expect(keys).toEqual([key]);
    expect(hasText(snap.data.logs, 'SYNTH-0908 first')).toBe(false);
    expect(hasText(snap.data.logs, 'SYNTH-0908 fourth')).toBe(false);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: list1.hits + list2.hits });
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 a kept version that does not fit in browser storage is reported by a banner instead of a success notice', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  // 测试装置只装在设备二、只针对留底键：写留底时抛 QuotaExceededError，其他键照常写
  const second = await openSecond(app, browser, guard, {
    init: (p) =>
      p.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key: string, value: string) {
          if (String(key).endsWith(':snapshot')) throw new DOMException('quota exceeded', 'QuotaExceededError');
          return original.call(this, key, value);
        };
      }),
  });
  try {
    const { listFault } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0909 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0909 first'),
    });

    // 服务器仍以后保存的为准
    await expect
      .poll(
        () => {
          const logs = app.fake.lastState(0)?.logs;
          return hasText(logs, 'SYNTH-0909 second') && !hasText(logs, 'SYNTH-0909 first');
        },
        { message: '等待设备二的保存成为服务器上的最新版本' },
      )
      .toBe(true);

    const bar = second.page.locator('#syncbar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('data-tone', 'warn');
    await expect(bar.locator('.sb-msg')).toHaveText(BANNER_SNAPSHOT_NOT_KEPT);
    await expect(bar.locator('button')).toHaveText(BTN_ACK);

    // 不能弹“已在本机留底”的假提示，也不能显示下载按钮，本机没有留底
    const toast = await second.page.evaluate(() => {
      const t = document.querySelector('#toast');
      return { on: !!t && t.classList.contains('on'), text: t?.querySelector('span')?.textContent ?? '' };
    });
    expect(toast.on && toast.text === TOAST_CONFLICT).toBe(false);
    await expect(second.page.locator('#snapshotBtn')).toBeHidden();
    const snap = await second.page.evaluate((k) => localStorage.getItem(k), `usj:v2:${app.fake.users[0].id}:snapshot`);
    expect(snap).toBeNull();

    await bar.locator('button').click();
    await expect(bar).toBeHidden();
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits });
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 a failed download keeps the kept version and says so', async ({ app, page, browser, guard }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  // 测试装置只装在设备二：生成下载地址时抛错
  const second = await openSecond(app, browser, guard, {
    init: (p) =>
      p.addInitScript(() => {
        URL.createObjectURL = () => {
          throw new Error('blob failed');
        };
      }),
  });
  try {
    const { listFault } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0909 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0909 first'),
    });
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();

    await second.page.locator('#snapshotBtn').click();
    await expectToast(second.page, TOAST_SNAPSHOT_FAILED);

    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;
    const snap = await second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    expect(snap).not.toBeNull();
    expect(hasText(snap.data.logs, 'SYNTH-0909 first')).toBe(true);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits });
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 a server version written by this same page is not another device and keeps no version', async ({ app, page }) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  const key = `usj:v2:${app.fake.users[0].id}`;

  const first = composer(page, 'w');
  await first.type('SYNTH-0912 first');
  await first.submit();
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 first'), { message: '等待第一条记录上传' })
    .toBe(true);
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.dirty, `${key}:state`), {
      message: '等待第一次保存收尾',
    })
    .toBe(false);

  // 模拟“保存在服务器上成功、应答却丢了”：服务器版本比页面的基线新，但是是这个页面（同一个 writer）写的，内容就是页面上传过的那份
  const path = `/api/collections/journey_docs/records/${app.fake.docId(0, 'state')}`;
  const current = (await app.fake.request(0, 'GET', path)).body as { data: unknown; writer: string };
  expect(current.writer).not.toBe('');
  await app.fake.request(0, 'PATCH', path, { data: current.data, writer: current.writer });

  const second = composer(page, 'w');
  await second.type('SYNTH-0912 second');
  await second.submit();
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 second'), { message: '等待第二条记录上传' })
    .toBe(true);
  await expect
    .poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.dirty, `${key}:state`), {
      message: '等待第二次保存收尾',
    })
    .toBe(false);

  // 没有留底、没有下载入口、没有“已被覆盖”的提示
  expect(await page.evaluate((k) => localStorage.getItem(k), `${key}:snapshot`)).toBeNull();
  await expect(page.locator('#snapshotBtn')).toBeHidden();
  const toast = await page.evaluate(() => {
    const t = document.querySelector('#toast');
    return { on: !!t && t.classList.contains('on'), text: t?.querySelector('span')?.textContent ?? '' };
  });
  expect(toast.on && toast.text === TOAST_CONFLICT).toBe(false);
});

test('SYNC-05 a conflict is kept silently before the upload and announced only after an upload succeeded, not when the upload is refused', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  // 设备二用 manual 时钟：被拒或丢了答复的上传不会自己重试，之后的成功上传由 runFor 触发，console.error 的条数保持精确
  const second = await openSecond(app, browser, guard);
  try {
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;

    // 设备二重新联网时读到更新的服务器版本（D-03），它的第一次上传被拒绝，服务器版本没有被覆盖。上传之前已经静默留底（T-09-18），但还没有提示、没有下载入口
    const { listFault, patchFault } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0912 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0912 first'),
      patch: 'refuse',
    });
    await expect.poll(() => patchFault!.hits, { message: '等待设备二重新联网后的上传被拒' }).toBe(1);
    await expect(second.page.locator('#status')).toHaveText(statusOffline(1));
    await expect(second.page.locator('#status')).toHaveAttribute('data-state', 'offline');
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits + patchFault!.hits });
    expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 first')).toBe(true);
    const silent = await second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    expect(silent?.kind).toBe('state');
    expect(hasText(silent.data.logs, 'SYNTH-0912 first')).toBe(true);
    expect(hasText(silent.data.logs, 'SYNTH-0912 second')).toBe(false);
    await expect(second.page.locator('#snapshotBtn')).toBeHidden();
    const toast = await second.page.evaluate(() => {
      const t = document.querySelector('#toast');
      return { on: !!t && t.classList.contains('on'), text: t?.querySelector('span')?.textContent ?? '' };
    });
    expect(toast.on && toast.text === TOAST_CONFLICT).toBe(false);

    // 下一次修改上传成功：这次才真的覆盖了设备一的版本，提示和下载入口这时出现，留底仍是同一份（不重复、不丢失）
    const again = composer(second.page, 'w');
    await again.type('SYNTH-0912 third');
    await again.submit();
    await second.page.clock.runFor(1_000);
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 third') && !hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 first'), {
        message: '等待设备二的保存成为服务器上的最新版本',
      })
      .toBe(true);
    await expectToast(second.page, TOAST_CONFLICT);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    const snap = await second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    expect(hasText(snap.data.logs, 'SYNTH-0912 first')).toBe(true);
  } finally {
    await second.context.close();
  }
});

test('SYNC-05 a conflict whose overwrite reached the server but whose answer was lost keeps the other device version and offers it after the next successful save', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
  // 设备二用 manual 时钟：被拒或丢了答复的上传不会自己重试，之后的成功上传由 runFor 触发，console.error 的条数保持精确
  const second = await openSecond(app, browser, guard);
  try {
    const key = `usj:v2:${app.fake.users[0].id}:snapshot`;

    // 设备二重新联网（D-03）：它的上传在服务器上生效了（设备一的版本已被覆盖），但答复丢了，页面报保存失败
    const { listFault, patchFault: lost } = await makeOfflineConflict(app, second, {
      secondText: 'SYNTH-0912 second',
      oneSaves: () => oneSaves(app, page, 'SYNTH-0912 first'),
      patch: 'lose-answer',
    });
    await expect.poll(() => lost!.hits, { message: '等待设备二的上传答复被丢掉' }).toBe(1);
    await expect(second.page.locator('#status')).toHaveText(statusOffline(1));
    await expect(second.page.locator('#status')).toHaveAttribute('data-state', 'offline');
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: listFault.hits, ERR_CONNECTION_RESET: 1 });
    await expect
      .poll(() => {
        const logs = app.fake.lastState(0)?.logs;
        return hasText(logs, 'SYNTH-0912 second') && !hasText(logs, 'SYNTH-0912 first');
      }, { message: '服务器上已经是设备二的版本' })
      .toBe(true);

    // 设备一的版本已经留在本机，此时还没有提示
    const kept = await second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    expect(kept?.kind).toBe('state');
    expect(hasText(kept.data.logs, 'SYNTH-0912 first')).toBe(true);
    expect(hasText(kept.data.logs, 'SYNTH-0912 second')).toBe(false);
    await expect(second.page.locator('#snapshotBtn')).toBeHidden();

    // 下一次保存读到的是自己的写入（writer 相同、内容相同），但留底仍在：成功之后提示并给下载入口，留底没有丢也没有重复
    const again = composer(second.page, 'w');
    await again.type('SYNTH-0912 third');
    await again.submit();
    await second.page.clock.runFor(1_000);
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-0912 third'), { message: '等待设备二的下一次保存到达服务器' })
      .toBe(true);
    await expectToast(second.page, TOAST_CONFLICT);
    await expect(second.page.locator('#toast button')).toHaveText(BTN_DOWNLOAD_SNAPSHOT);
    await expect(second.page.locator('#snapshotBtn')).toBeVisible();
    const after = await second.page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
    expect(after).toEqual(kept);
    expect(hasText(after.data.logs, 'SYNTH-0912 first')).toBe(true);
  } finally {
    await second.context.close();
  }
});

test.describe('startup conflict', () => {
  test.use({ clockMode: 'manual' });

  test('SYNC-05 an unsent edit found at startup over a newer server version is uploaded and the server version is kept here', async ({
    app,
    page,
    guard,
  }) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'cloud', seed: syntheticState('base'), login: 0 });
    await page.clock.pauseAt(FROZEN_NOW + 60_000);

    // 保存和读服务器版本都被拒：记一条，推过防抖，本机缓存留着没上传的修改（dirty）
    const record = /\/api\/collections\/journey_docs\/records\/[^/]+$/;
    app.fake.fault({ method: 'PATCH', path: record, mode: 'refuse' });
    app.fake.fault({ method: 'GET', path: record, mode: 'refuse' });
    const entry = composer(page, 'w');
    await entry.type('SYNTH-0908 offline');
    await entry.submit();
    await page.clock.runFor(1_000);
    await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_REFUSED: 1 });
    const key = `usj:v2:${app.fake.users[0].id}`;
    const cached = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `${key}:state`);
    expect(cached?.dirty).toBe(true);
    expect(hasText(cached.data.logs, 'SYNTH-0908 offline')).toBe(true);

    // 另一台设备已经写了新版本：重新打开，对账留底服务器版本、上传本机版本、提示
    await app.fake.clearFaults();
    app.fake.seed(syntheticState('elsewhere'), { userIndex: 0 });
    await app.reload();

    expect(hasText(app.fake.lastState(0)?.logs, 'SYNTH-0908 offline')).toBe(true);
    expect(JSON.stringify(app.fake.lastState(0))).not.toContain('synthetic-elsewhere');
    const snap = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), `${key}:snapshot`);
    expect(snap?.kind).toBe('state');
    expect(JSON.stringify(snap.data.logs)).toContain('synthetic-elsewhere');
    await expectToast(page, TOAST_CONFLICT);
    await expect(page.locator('#snapshotBtn')).toBeVisible();
  });
});
