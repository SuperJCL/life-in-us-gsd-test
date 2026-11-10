// WR-01（09-REVIEW）：写入方 id 每个标签页一个、刷新后不变。只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 刷新后沿用 id：保存的答复丢了（服务器已经写入），刷新后对账认得这是本页自己的写入，不留底、不弹冲突提示。
// 复制标签页：同一个浏览器的两个标签页不共用 id（否则会把对方的写入当成回声丢掉）；复制标签页带着同一份 sessionStorage 打开，
// 经 BroadcastChannel 发现重复后重新生成。用例都在 manual 时钟或固定时钟下运行，不真的等。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { composer } from '../support/composer';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW } from '../support/constants';
import { AppHarness } from '../support/app';
import { STATUS_CLOUD_SYNCED, TOAST_CONFLICT } from '../support/strings';

test.use({ clockMode: 'manual' });

type Log = { id: string; text: string };

const hasText = (logs: Log[] | undefined, text: string) => (logs ?? []).some((l) => l.text === text);
const countText = (logs: Log[] | undefined, text: string) => (logs ?? []).filter((l) => l.text === text).length;

const RECORD = /\/api\/collections\/journey_docs\/records\/[^/]+$/;
const WRITER_KEY = 'usj:v2:writer';

test('SYNC-05 a reload after a save whose answer was lost keeps no version and shows no conflict notice', async ({
  app,
  page,
  guard,
}) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const userA = app.fake.users[0];

  // 保存在服务器上生效了，但答复丢了：页面报离线，缓存仍是脏的
  const lost = app.fake.fault({ method: 'PATCH', path: RECORD, mode: 'lose-answer', times: 1 });
  const entry = composer(page, 'w');
  await entry.type('SYNTH-1008 answer lost');
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'offline');
  // lose-answer 让这条 PATCH 的连接被重置，Chromium 为它写一条 console.error
  await acknowledgeConsoleErrors(guard, { ERR_CONNECTION_RESET: 1 });
  expect(lost.hits).toBe(1);
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-1008 answer lost'), { message: '服务器上已经有这一条' })
    .toBe(true);

  // 再改一笔（不推进到重试），然后立刻刷新
  await entry.type('SYNTH-1008 after loss');
  await entry.submit();
  await page.reload();

  await expect(page.locator('#status')).toHaveAttribute('data-state', 'synced');
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);
  await expect
    .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-1008 after loss'), { message: '刷新后的对账上传了这一笔' })
    .toBe(true);

  // 刷新后仍是同一个写入方：服务器上的那一版是本页自己写的，不是另一台设备，所以没有留底、没有冲突提示
  expect(await page.evaluate((k) => localStorage.getItem(k), `usj:v2:${userA.id}:snapshot`)).toBeNull();
  await expect(page.locator('#snapshotBtn')).toBeHidden();
  await expect(page.locator('#toast')).not.toContainText(TOAST_CONFLICT);
  const logs = app.fake.lastState(0)?.logs as Log[];
  expect(countText(logs, 'SYNTH-1008 answer lost')).toBe(1);
  expect(countText(logs, 'SYNTH-1008 after loss')).toBe(1);
});

test('SYNC-02 a duplicated tab gets its own writer id and a reload keeps it', async ({ app, page }) => {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);

  const read = (p: typeof page) => p.evaluate((k) => sessionStorage.getItem(k), WRITER_KEY);
  const w1 = await read(page);
  expect(w1).toBeTruthy();

  // 同一个浏览器的第二个标签页，带着复制来的同一个写入方 id（复制标签页会复制 sessionStorage）
  const page2 = await page.context().newPage();
  try {
    await page2.addInitScript(
      ([k, w]) => {
        if (!sessionStorage.getItem(k)) sessionStorage.setItem(k, w);
      },
      [WRITER_KEY, w1!],
    );
    await page2.clock.setFixedTime(FROZEN_NOW);
    const app2 = new AppHarness(page2, { fake: app.fake });
    await app2.open({ mode: 'cloud', login: 'session' });

    // 复制标签页发现重复后换成新的 id，第一个标签页的 id 不变
    await expect.poll(() => read(page2), { message: '等待复制标签页换新的写入方 id' }).not.toBe(w1);
    const w2 = await read(page2);
    expect(w2).toBeTruthy();
    expect(await read(page)).toBe(w1);

    const writerOf = (text: string) =>
      app.fake.writes.find((w) => w.path === 'journey_docs:state' && hasText(w.data.logs, text))?.writer;

    // 两个标签页各写一次：写入的 writer 分别是自己的 id
    const one = composer(page, 'w');
    await one.type('SYNTH-1008 tab one');
    await one.submit();
    await page.clock.runFor(1_000);
    await expect.poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-1008 tab one'), { message: '等待标签页一的上传' }).toBe(true);
    expect(writerOf('SYNTH-1008 tab one')).toBe(w1);

    const two = composer(page2, 'w');
    await two.type('SYNTH-1008 tab two');
    await two.submit();
    await page2.clock.runFor(1_000);
    await expect.poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-1008 tab two'), { message: '等待标签页二的上传' }).toBe(true);
    expect(writerOf('SYNTH-1008 tab two')).toBe(w2);

    // 标签页二刷新后沿用 w2：再写一次，writer 与刷新前相同
    await page2.reload();
    await expect(page2.locator('#status')).toHaveAttribute('data-state', 'synced');
    expect(await read(page2)).toBe(w2);
    const again = composer(page2, 'w');
    await again.type('SYNTH-1008 tab two again');
    await again.submit();
    await page2.clock.runFor(1_000);
    await expect
      .poll(() => hasText(app.fake.lastState(0)?.logs, 'SYNTH-1008 tab two again'), { message: '等待标签页二刷新后的上传' })
      .toBe(true);
    expect(writerOf('SYNTH-1008 tab two again')).toBe(w2);
  } finally {
    await page2.close();
  }
});
