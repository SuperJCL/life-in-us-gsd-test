// Phase 10 的远端更新用例（SYNC-02、SYNC-03）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 设备一是 fixture 里的页面，只负责经界面记东西并等上传；设备二是 openDevice 的第二台设备，是被测的一方。
// 设备二一律 openDevice({ clock: 'none' })，在页面上 install 时钟、登录后 pauseAt(FROZEN_NOW + 60_000)，需要拉取时 runFor(60_000)；
// 设备一也在 manual 时钟下运行（open 之前 install，登录后 pauseAt），记完一笔后 runFor(1_000) 让保存防抖到期。
// 服务器连不上、5xx 一律用假服务器的开关制造；context.setOffline 只用来派发 online 事件，从不用来让服务器连不上。
import { test, expect, type Page } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import type { AppHarness } from '../support/app';
import { composer } from '../support/composer';
import { openDevice, type Device } from '../support/devices';
import { expectToast } from '../support/toast';
import { CATEGORY_NAMES, BANNER_REMOTE, BTN_APPLY_NOW, TAB_LABELS, TOAST_REMOTE_UPDATED } from '../support/strings';
import { FROZEN_NOW } from '../support/constants';

test.use({ clockMode: 'manual' });

type App = AppHarness;

// 服务器 state 文档里这段文字所属记录的 id，没有时为 null
const serverIdOf = (app: App, text: string) =>
  ((app.fake.lastState(0)?.logs ?? []) as Array<{ id: string; text: string }>).find((l) => l.text === text)?.id ?? null;

// 设备一经界面记一笔（可选先选类别），等到服务器 state 里出现它，返回 id
async function writeOnOne(app: App, page: Page, text: string, category?: string): Promise<string> {
  const entry = composer(page, 'w');
  if (category) await entry.pickCategory(category);
  await entry.type(text);
  await entry.submit();
  await page.clock.runFor(1_000);
  await expect.poll(() => serverIdOf(app, text), { message: `等待设备一的记录上传：${text}` }).not.toBeNull();
  return serverIdOf(app, text)!;
}

// 一次推进 60 秒的话，轮询在推进的前几秒就触发，响应随后到达时 toast 的 4 秒计时会在同一次推进里走完，断言不到它；
// 所以需要断言 toast 的用例按 1 秒一步推进，条件一成立就停（最多 65 步，超过一个轮询周期）
async function advanceUntil(page: Page, shown: () => Promise<boolean>) {
  for (let i = 0; i < 65; i++) {
    await page.clock.runFor(1_000);
    if (await shown()) return;
  }
  throw new Error('推进 65 秒后设备二仍没有拉到更新');
}

// 打开设备一（fixture 页面）和设备二（第二台设备），两台都在 manual 时钟下登录同一个账号并暂停
async function openBoth(app: App, page: Page, browser: Parameters<typeof openDevice>[0]['browser'], guard: Parameters<typeof openDevice>[0]['guard']) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), login: 0 });
  await page.clock.pauseAt(FROZEN_NOW + 60_000);
  const second: Device = await openDevice({ browser, guard, fake: app.fake, clock: 'none' });
  try {
    await second.page.clock.install({ time: FROZEN_NOW });
    await second.app.open({ mode: 'cloud', login: 0 });
    await second.page.clock.pauseAt(FROZEN_NOW + 60_000);
  } catch (error) {
    await second.context.close();
    throw error;
  }
  return second;
}

test('SYNC-02 a change from another device is applied at the next poll when this device is idle', async ({ app, page, browser, guard }) => {
  const second = await openBoth(app, page, browser, guard);
  try {
    const sp = second.page;
    // 设备二空闲：切到上一周，时间线筛选设为“专业”
    await sp.locator('#wkPrev').click();
    const range = await sp.locator('#wkRange').innerText();
    await sp.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
    const filter = sp.locator(`#filters [data-filter="${CATEGORY_NAMES[1]}"]`);
    await filter.click();
    await expect(filter).toHaveAttribute('aria-pressed', 'true');

    const id = await writeOnOne(app, page, 'SYNTH-1101 from device one', CATEGORY_NAMES[1]);
    await expect(sp.locator(`#timeline [data-edit="${id}"]`)).toHaveCount(0);

    await advanceUntil(sp, async () => (await sp.locator(`#timeline [data-edit="${id}"]`).count()) > 0);
    await expect(sp.locator(`#timeline [data-edit="${id}"]`)).toBeVisible();
    await expectToast(sp, TOAST_REMOTE_UPDATED);
    await expect(sp.locator('#syncbar')).not.toBeVisible();
    // 界面游标不变：周范围和筛选按钮都还是原样
    await expect(sp.locator('#wkRange')).toHaveText(range);
    await expect(filter).toHaveAttribute('aria-pressed', 'true');
  } finally {
    await second.context.close();
  }
});

test('SYNC-02 a remote change waits with a notice while this device is busy and is applied once it is idle', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const second = await openBoth(app, page, browser, guard);
  try {
    const sp = second.page;
    const draft = 'SYNTH-1102 draft on device two';
    const entry = composer(sp, 'w');
    await entry.type(draft);
    await expect(entry.text).toBeFocused();

    const id = await writeOnOne(app, page, 'SYNTH-1102 from device one');
    await sp.clock.runFor(60_000);

    // 忙碌：info 横幅，唯一按钮“现在更新”；草稿和焦点不变，新记录还没画出来
    const bar = sp.locator('#syncbar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('data-tone', 'info');
    await expect(bar.locator('.sb-msg')).toHaveText(BANNER_REMOTE);
    await expect(bar.locator('button')).toHaveCount(1);
    await expect(bar.locator('button')).toHaveText(BTN_APPLY_NOW);
    expect(await entry.draft()).toBe(draft);
    expect(await sp.evaluate(() => document.activeElement?.id)).toBe('w-text');
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toHaveCount(0);

    // 横幅期间的两次局部重绘：时间线类别筛选（只调 renderTimeline），日历“今天”（renderCal 加 renderDay）；都画不出设备一的记录
    await sp.getByRole('tab', { name: TAB_LABELS.tl, exact: true }).click();
    await sp.locator(`#filters [data-filter="${CATEGORY_NAMES[0]}"]`).click();
    await expect(sp.locator(`#timeline [data-edit="${id}"]`)).toHaveCount(0);
    await sp.getByRole('tab', { name: TAB_LABELS.cal, exact: true }).click();
    await sp.locator('#todayBtn').click();
    await expect(sp.locator(`#dayPanel [data-edit="${id}"]`)).toHaveCount(0);
    await sp.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toHaveCount(0);
    await expect(bar).toBeVisible();
    expect(await entry.draft()).toBe(draft);

    // 清空草稿（焦点仍在文本框里，还算忙），离开文本框后立即应用
    await entry.type('');
    await expect(bar).toBeVisible();
    await sp.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(bar).not.toBeVisible();
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toBeVisible();
    await expectToast(sp, TOAST_REMOTE_UPDATED);
  } finally {
    await second.context.close();
  }
});

test('SYNC-03 coming back online or to the foreground reconciles at once', async ({ app, page, browser, guard }) => {
  const second = await openBoth(app, page, browser, guard);
  try {
    const sp = second.page;
    const one = await writeOnOne(app, page, 'SYNTH-1103 first');
    // 时钟不推进：页面重新可见（直接派发 visibilitychange）后立即对账
    await sp.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(sp.locator(`#days [data-edit="${one}"]`)).toBeVisible();

    const two = await writeOnOne(app, page, 'SYNTH-1103 second');
    await expect(sp.locator(`#days [data-edit="${two}"]`)).toHaveCount(0);
    // 重新联网：setOffline 只改 navigator.onLine 并派发 online
    await second.context.setOffline(true);
    await second.context.setOffline(false);
    await expect(sp.locator(`#days [data-edit="${two}"]`)).toBeVisible();
  } finally {
    await second.context.close();
  }
});
