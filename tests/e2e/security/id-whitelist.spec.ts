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
import { FROZEN_NOW } from '../../support/constants';
import { chooseImportFile, jsonImportFile, recordDialogs } from '../../support/import-file';
import { composer } from '../../support/composer';
import { expectToast, expectToastGone } from '../../support/toast';
import { TOAST_IMPORT_BAD_FORMAT } from '../../support/strings';

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
