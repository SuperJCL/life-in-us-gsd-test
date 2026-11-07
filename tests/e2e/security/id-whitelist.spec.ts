// 入口防线的页面用例（SEC-01，D-07、D-08）。
// 两类用例：
//  - 导入整份拒绝：备份里有一项 id 或日期不合格，就显示格式错误的 toast、不弹确认框、不保存、数据不变；
//  - 加载修正：已存的数据带坏 id、坏日期时，启动不写存储、每条记录文字都在，之后保存的状态只含合格的 id 和日期。
// 导入文件只在内存里构造、名字以 synth- 开头，先注册对话框处理再选文件（D-05）；
// “没有保存”用 manual 时钟加哨兵写入证明（照 tests/e2e/io/import.spec.ts 的写法，在本文件内另写一份）。
// 期望值在用例里独立写出，不抄应用的实现。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { loadFixture } from '../../support/fixture-files';
import { FROZEN_NOW, FROZEN_TODAY } from '../../support/constants';
import { chooseImportFile, jsonImportFile, recordDialogs } from '../../support/import-file';
import { composer } from '../../support/composer';
import { expectToast, expectToastGone } from '../../support/toast';
import { TAB_LABELS, TOAST_IMPORT_BAD_FORMAT } from '../../support/strings';
import { gotoTimeline } from '../../support/timeline';

type Log = { id: string; text: string; cat: string; date: string };

// 哨兵：推进防抖后，写入恰好比开始时多一次，并且那次写入里去掉哨兵的记录 id 列表等于 fixture 的
async function expectOnlySentinelSaved(
  page: Page,
  app: AppHarness,
  fixtureIds: string[],
  writesBefore: number,
  sentinel: string,
) {
  const comp = composer(page, 'w');
  await comp.type(sentinel);
  await comp.submit();
  await page.clock.runFor(2_000);
  await expect
    .poll(() => app.backend.writes.some((w) => w.data.logs.some((l: Log) => l.text === sentinel)), {
      message: '等待哨兵写入到达 mock',
    })
    .toBe(true);
  expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
  const last = app.backend.writes[app.backend.writes.length - 1].data;
  const ids = last.logs.filter((l: Log) => l.text !== sentinel).map((l: Log) => l.id);
  expect(ids).toEqual(fixtureIds);
}

test.describe('SEC-01 import rejection', () => {
  test.use({ clockMode: 'manual' });

  test('SEC-01 importing a backup with a malformed id or date is rejected as a whole and changes nothing', async ({
    page,
    app,
  }) => {
    const fixture = loadFixture('full-state.json');
    const fixtureIds = fixture.logs.map((l: Log) => l.id);
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    const writesBefore = app.backend.writes.length;

    const variants: Record<string, (s: any) => void> = {
      'synth-bad-log-id.json': (s) => (s.logs[0].id = 'SYNTH"bad'),
      'synth-bad-log-date.json': (s) => (s.logs[0].date = '2026-3-5'),
      'synth-bad-task-key.json': (s) => (s.tasks['P1-1"x'] = { done: true }),
      'synth-bad-custom-id.json': (s) => (s.custom[0].id = 'x-synth'),
      'synth-bad-review-key.json': (s) => (s.reviews['week-1'] = 'SYNTH-review'),
      'synth-impossible-log-date.json': (s) => (s.logs[0].date = '2026-02-31'),
      'synth-impossible-arrival.json': (s) => (s.arrival = '2026-02-31'),
    };

    const dialogs = recordDialogs(page);
    for (const [name, mutate] of Object.entries(variants)) {
      const backup = loadFixture('full-state.json');
      mutate(backup);
      await chooseImportFile(page, jsonImportFile(name, backup));
      await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
      expect(dialogs, `${name} 不应弹出确认框`).toEqual([]);
      await page.clock.runFor(2_000);
      await expectToastGone(page);
      expect(app.backend.writes.length, `${name} 之后出现了保存`).toBe(writesBefore);
    }

    // 原有记录仍在本周视图里；哨兵写入证明内存里的数据没有被替换
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);
    await expectOnlySentinelSaved(page, app, fixtureIds, writesBefore, 'SYNTH-SEC01 reject sentinel');
  });
});

// ---------- 加载修正 ----------

test('SEC-01 loading stored data with malformed ids keeps every log text and saves only compliant ids', async ({
  page,
  app,
}) => {
  const SENTINEL = 'SYNTH-SEC01 load sentinel';
  const TEXTS = {
    a: 'SYNTH-LOAD-A quoted id',
    b: 'SYNTH-LOAD-B bad date',
    c: 'SYNTH-LOAD-C missing id',
    d: 'SYNTH-LOAD-D string entry',
    e: 'SYNTH-LOAD-E bad custom id',
  };
  const seed = {
    _synthetic: 'SYNTH',
    arrival: 'soon',
    logs: [
      { id: 'SYNTH"quote', date: '2026-03-16', cat: '语言', text: TEXTS.a },
      { id: 'synth-load-b', date: '2026-3-5', cat: '专业', text: TEXTS.b },
      { date: '2026-03-17', cat: '求职', text: TEXTS.c },
      TEXTS.d,
    ],
    custom: [{ id: 'bad id!', group: 'P2', text: TEXTS.e }],
    tasks: {
      'bad id!': { done: true, doneDate: '2026-03-12' },
      'P9-9': { done: true, doneDate: '2026-03-12' },
      't-synth': { done: true, doneDate: '2026-03-12' },
      'P1-1"x': { done: true, doneDate: '2026-03-12' },
      'P1-1': { done: true, doneDate: '2026-03-12' },
    },
    lifts: {
      bench: { cur: 'abc', hist: [{ date: '2026-03-02', v: 38 }, { date: 'bad', v: 40 }] },
      Squat: { cur: 5 },
    },
    reviews: {},
    presets: {},
  };

  await app.open({ mode: 'account', seed });
  await app.expectAccountMode();
  // 加载本身不保存：启动之后 mock 里没有任何写入
  expect(app.backend.writes).toEqual([]);

  // 时间线：每条种子文字恰好出现一次（在页面内读回条目文字，失败消息只写变体名）
  await gotoTimeline(page);
  const texts = Object.values(TEXTS);
  await expect
    .poll(
      async () => {
        const all = await page.evaluate(() =>
          Array.from(document.querySelectorAll('#timeline .tl-item'))
            .map((el) => el.textContent ?? '')
            .join('\n'),
        );
        return texts.map((t) => all.split(t).length - 1);
      },
      { message: '时间线里每条种子文字应当恰好出现一次（内容已隐藏）' },
    )
    .toEqual(texts.map(() => 1));

  // 记一条哨兵触发保存，保存的状态里只有合格的 id 和日期
  await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
  const comp = composer(page, 'w');
  await comp.type(SENTINEL);
  await comp.submit();
  await app.expectSaved((s) => s.logs.some((l: Log) => l.text === SENTINEL), '等待哨兵保存');
  const saved = await app.saved();

  for (const l of saved.logs as Log[]) {
    expect(/^[A-Za-z0-9_-]{1,64}$/.test(l.id), '保存的记录 id 合格').toBe(true);
    expect(/^\d{4}-\d{2}-\d{2}$/.test(l.date), '保存的记录日期合格').toBe(true);
  }
  const savedTexts = saved.logs.map((l: Log) => l.text);
  for (const t of [TEXTS.a, TEXTS.b, TEXTS.c, TEXTS.d, SENTINEL]) {
    expect(savedTexts.filter((x: string) => x === t).length, '记录文字恰好一条').toBe(1);
  }
  expect(saved.logs.find((l: Log) => l.text === TEXTS.a).date).toBe('2026-03-16');
  expect(saved.logs.find((l: Log) => l.text === TEXTS.b).date).toBe(FROZEN_TODAY);

  // 自定义待办换了新 id，进度跟着搬；孤儿键和坏键都去掉；内置任务 P1-1 的进度还在
  expect(saved.custom.length).toBe(1);
  const newId: string = saved.custom[0].id;
  expect(/^c-[A-Za-z0-9_-]{1,60}$/.test(newId)).toBe(true);
  expect(newId).not.toBe('bad id!');
  expect(saved.custom[0].text).toBe(TEXTS.e);
  expect(Object.keys(saved.tasks).sort()).toEqual([newId, 'P1-1'].sort());
  expect(saved.tasks[newId]).toEqual({ done: true, doneDate: '2026-03-12' });
  expect(saved.tasks['P1-1']).toEqual({ done: true, doneDate: '2026-03-12' });

  // 力量：大写键被丢弃，不是数字的 cur 被删掉，坏的历史项被去掉；arrival 变空串
  expect(Object.keys(saved.lifts)).toEqual(['bench']);
  expect(saved.lifts.bench.cur).toBeUndefined();
  expect(saved.lifts.bench.hist).toEqual([{ date: '2026-03-02', v: 38 }]);
  expect(saved.arrival).toBe('');
});
