// Phase 10 的远端更新用例（SYNC-02、SYNC-03）：只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 设备一是 fixture 里的页面，只负责经界面记东西并等上传；设备二是 openDevice 的第二台设备，是被测的一方。
// 设备二一律 openDevice({ clock: 'none' })，在页面上 install 时钟、登录后 pauseAt(FROZEN_NOW + 60_000)，需要拉取时 runFor(60_000)；
// 设备一也在 manual 时钟下运行（open 之前 install，登录后 pauseAt），记完一笔后 runFor(1_000) 让保存防抖到期。
// 服务器连不上、5xx 一律用假服务器的开关制造；context.setOffline 只用来派发 online 事件，从不用来让服务器连不上。
import { test, expect, type Page } from '../support/test';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import type { AppHarness } from '../support/app';
import { composer } from '../support/composer';
import { editor } from '../support/editor';
import { gotoGoals } from '../support/goals';
import { openDevice, type Device } from '../support/devices';
import { expectToast } from '../support/toast';
import { CATEGORY_NAMES, BANNER_REMOTE, BTN_APPLY_NOW, TAB_LABELS, TOAST_LOG_READDED, TOAST_REMOTE_UPDATED } from '../support/strings';
import { FROZEN_NOW, WEEK_START_FROZEN } from '../support/constants';

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
async function openBoth(
  app: App,
  page: Page,
  browser: Parameters<typeof openDevice>[0]['browser'],
  guard: Parameters<typeof openDevice>[0]['guard'],
  plan?: unknown,
) {
  await page.clock.install({ time: FROZEN_NOW });
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan, login: 0 });
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

// 页面重新可见：直接派发 visibilitychange，应用立即对账（不推进时钟，所以草稿防抖和 toast 计时都不会走）
const pullNow = (p: Page) => p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const serverLogs = (app: App) => (app.fake.lastState(0)?.logs ?? []) as Array<{ id: string; text: string }>;
const serverHas = (app: App, text: string) => serverLogs(app).some((l) => l.text === text);

test('SYNC-02 finishing an action while a remote change waits applies it first and keeps both edits (D-04)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const second = await openBoth(app, page, browser, guard, syntheticPlan('o', 1));
  try {
    const sp = second.page;
    const bar = sp.locator('#syncbar');
    const entry = composer(sp, 'w');
    const flushTwo = () => sp.clock.runFor(1_000);

    // 一、发出草稿：设备二写草稿（忙），设备一记 first，横幅出现后设备二发出草稿
    await entry.type('SYNTH-1111 second');
    const firstId = await writeOnOne(app, page, 'SYNTH-1111 first');
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('data-tone', 'info');
    await entry.submit();
    // 留在屏幕上的是远端提示，不是“已记录”
    await expectToast(sp, TOAST_REMOTE_UPDATED);
    await expect(bar).not.toBeVisible();
    await expect(sp.locator(`#days [data-edit="${firstId}"]`)).toBeVisible();
    await flushTwo();
    await expect.poll(() => serverHas(app, 'SYNTH-1111 second'), { message: '等待设备二的草稿上传' }).toBe(true);
    expect(serverHas(app, 'SYNTH-1111 first')).toBe(true);
    await expect(sp.locator(`#days [data-edit="${serverLogs(app).find((l) => l.text === 'SYNTH-1111 second')!.id}"]`)).toBeVisible();

    // 二、编辑弹窗保存同一条：设备一把 X 改成 one 并另记 extra，设备二的弹窗开着 X，保存为 two（本机这次操作为准）
    const xId = await writeOnOne(app, page, 'SYNTH-1112 X');
    await pullNow(sp);
    await expect(sp.locator(`#days [data-edit="${xId}"]`)).toBeVisible();
    const ed1 = editor(page);
    await ed1.openLog(page.locator(`#tab-wk [data-edit="${xId}"]`));
    await ed1.setText('SYNTH-1112 one');
    await ed1.save();
    await ed1.expectClosed();
    await page.clock.runFor(1_000);
    await expect.poll(() => serverHas(app, 'SYNTH-1112 one')).toBe(true);
    const extraId = await writeOnOne(app, page, 'SYNTH-1112 extra');
    const ed2 = editor(sp);
    await ed2.openLog(sp.locator(`#tab-wk [data-edit="${xId}"]`));
    await ed2.setText('SYNTH-1112 two');
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await ed2.save();
    await ed2.expectClosed();
    await expect(sp.locator(`#days [data-edit="${extraId}"]`)).toBeVisible();
    await flushTwo();
    await expect.poll(() => serverLogs(app).find((l) => l.id === xId)?.text, { message: '等待设备二的保存上传' }).toBe('SYNTH-1112 two');
    expect(serverHas(app, 'SYNTH-1112 extra')).toBe(true);

    // 三、复盘防抖到期：设备二的复盘还在防抖（忙），远端更新挂起，防抖一到期就先应用远端再提交复盘
    await sp.locator('#review').fill('SYNTH-1113 review');
    const r1 = await writeOnOne(app, page, 'SYNTH-1113 remote');
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await sp.clock.runFor(800);
    await expect(bar).not.toBeVisible();
    await expect(sp.locator(`#days [data-edit="${r1}"]`)).toBeVisible();
    await flushTwo();
    await expect.poll(() => app.fake.lastState(0)?.reviews?.[WEEK_START_FROZEN], { message: '等待复盘上传' }).toBe('SYNTH-1113 review');
    expect(serverHas(app, 'SYNTH-1113 remote')).toBe(true);

    // 四、保存力量值：力量输入框里有未保存的值（忙），横幅出现后回车保存
    await gotoGoals(sp);
    const lift = sp.locator('#goals input[data-lift]').first();
    const liftId = (await lift.getAttribute('data-lift')) as string;
    const liftValue = Number(await lift.inputValue()) + 5;
    await lift.fill(String(liftValue));
    await writeOnOne(app, page, 'SYNTH-1114 remote');
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await lift.press('Enter');
    await expect(bar).not.toBeVisible();
    await flushTwo();
    await expect.poll(() => app.fake.lastState(0)?.lifts?.[liftId]?.cur, { message: '等待力量值上传' }).toBe(liftValue);
    expect(serverHas(app, 'SYNTH-1114 remote')).toBe(true);

    // 五、修改开始日期：本周 composer 里有草稿（忙），横幅出现后改开始日期（改日期的处理函数自己会整页重绘，旧行为，草稿随之清掉，所以这里不断言草稿）
    await sp.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
    await entry.type('SYNTH-1115 draft kept');
    await writeOnOne(app, page, 'SYNTH-1115 remote');
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await sp.locator('#arrival').fill('2026-01-05');
    await expect(bar).not.toBeVisible();
    await flushTwo();
    await expect.poll(() => app.fake.lastState(0)?.arrival, { message: '等待开始日期上传' }).toBe('2026-01-05');
    expect(serverHas(app, 'SYNTH-1115 remote')).toBe(true);

    // 两边的修改都保留，没有真冲突：设备二没有留底
    expect(await sp.evaluate((k) => localStorage.getItem(k), `usj:v2:${app.fake.users[0].id}:snapshot`)).toBeNull();
    await expect(sp.locator('#snapshotBtn')).toBeHidden();
  } finally {
    await second.context.close();
  }
});

test('SYNC-02 saving a record that another device deleted adds it back with the same id and says so (D-06)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const second = await openBoth(app, page, browser, guard);
  try {
    const sp = second.page;
    const bar = sp.locator('#syncbar');
    const ed1 = editor(page);
    const ed2 = editor(sp);

    // 设备一记 X，设备二看到后打开 X 的编辑弹窗并改文字；设备一随后删除 X
    const xId = await writeOnOne(app, page, 'SYNTH-1121 X');
    await pullNow(sp);
    await expect(sp.locator(`#days [data-edit="${xId}"]`)).toBeVisible();
    await ed2.openLog(sp.locator(`#tab-wk [data-edit="${xId}"]`));
    await ed2.setText('SYNTH-1121 two edit');
    await ed1.openLog(page.locator(`#tab-wk [data-edit="${xId}"]`));
    await ed1.deleteEntry();
    await ed1.expectClosed();
    await page.clock.runFor(1_000);
    await expect.poll(() => serverLogs(app).some((l) => l.id === xId), { message: '等待设备一的删除上传' }).toBe(false);

    // 设备二拉到删除，横幅出现；点保存：以同一个 id 和编辑框里的文字加回，并说明
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await ed2.save();
    await ed2.expectClosed();
    await expectToast(sp, TOAST_LOG_READDED);
    await expect(sp.locator(`#days [data-edit="${xId}"]`)).toBeVisible();
    await expect(bar).not.toBeVisible();
    await sp.clock.runFor(1_000);
    await expect.poll(() => serverLogs(app).find((l) => l.id === xId)?.text, { message: '等待加回的记录上传' }).toBe('SYNTH-1121 two edit');

    // 点删除就是删除，不提示：同样的局面下设备二点删除，记录保持已删除，远端更新直接应用
    const yId = await writeOnOne(app, page, 'SYNTH-1121 Y');
    await pullNow(sp);
    await expect(sp.locator(`#days [data-edit="${yId}"]`)).toBeVisible();
    await ed2.openLog(sp.locator(`#tab-wk [data-edit="${yId}"]`));
    await ed1.openLog(page.locator(`#tab-wk [data-edit="${yId}"]`));
    await ed1.deleteEntry();
    await ed1.expectClosed();
    await page.clock.runFor(1_000);
    await expect.poll(() => serverLogs(app).some((l) => l.id === yId)).toBe(false);
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await ed2.deleteEntry();
    await ed2.expectClosed();
    await expect(bar).not.toBeVisible();
    await expectToast(sp, TOAST_REMOTE_UPDATED);
    await expect(sp.locator(`#days [data-edit="${yId}"]`)).toHaveCount(0);
    await sp.clock.runFor(1_000);
    expect(serverLogs(app).some((l) => l.id === yId)).toBe(false);
  } finally {
    await second.context.close();
  }
});

test('SYNC-02 update now applies the waiting change and keeps both drafts and their categories (D-05)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const second = await openBoth(app, page, browser, guard);
  try {
    const sp = second.page;
    const bar = sp.locator('#syncbar');
    const week = composer(sp, 'w');
    const day = composer(sp, 'c');

    // 两个 composer 各有草稿，各选了不同的类别
    await week.pickCategory(CATEGORY_NAMES[1]);
    await week.type('SYNTH-1131 week draft');
    await sp.getByRole('tab', { name: TAB_LABELS.cal, exact: true }).click();
    await day.pickCategory(CATEGORY_NAMES[3]);
    await day.type('SYNTH-1131 day draft');
    await sp.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();

    const id = await writeOnOne(app, page, 'SYNTH-1131 remote');
    await pullNow(sp);
    await expect(bar).toBeVisible();
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toHaveCount(0);
    await bar.getByRole('button', { name: BTN_APPLY_NOW, exact: true }).click();

    await expect(bar).not.toBeVisible();
    await expect(sp.locator(`#days [data-edit="${id}"]`)).toBeVisible();
    await expectToast(sp, TOAST_REMOTE_UPDATED);
    expect(await week.draft()).toBe('SYNTH-1131 week draft');
    expect(await day.draft()).toBe('SYNTH-1131 day draft');
    await expect(week.categoryButton(CATEGORY_NAMES[1])).toHaveAttribute('aria-pressed', 'true');
    await expect(day.categoryButton(CATEGORY_NAMES[3])).toHaveAttribute('aria-pressed', 'true');
    await expect(week.addButton).toBeEnabled();
  } finally {
    await second.context.close();
  }
});
