// 健身页「训练历史」面板的用例（FIT-02；S8、A21）。
// 种子是合成 state 和示例计划里的动作 id（bench、squat、pull，有氧 r-run、r-bike）；期望值在本文件里手写，不读应用的实现。
// 失败消息只写日期、计数和布尔，不带计划文字。
import { test, expect } from '../../support/test';
import { FROZEN_TODAY } from '../../support/constants';
import { expectToast } from '../../support/toast';
import {
  BTN_FH_EDIT,
  BTN_UNDO_DELETE,
  FH_EMPTY,
  FH_MORE,
  FH_TITLE,
  TAB_LABELS,
  fhCardioLine,
  fhDay,
  fhLiftLine,
  fhMoreLive,
  fhMonth,
  flDeleted,
  flTitleDay,
} from '../../support/strings';
import { gotoFitness, readFl, readHistory, savedWorkouts } from '../../support/fitness';

const wo = (lifts: Record<string, Array<[number, number]>>, cardio: Array<{ id: string; m: number; d?: number }> = []) => ({
  lifts: Object.entries(lifts).map(([id, sets]) => ({ id, sets: sets.map(([w, r]) => ({ w, r })) })),
  cardio,
});

// 2026-01-05 起每隔三天一次，共 25 天，最后一天正好是冻结的今天 2026-03-18；03-03 换成 03-02（删除用）
const DATES: string[] = (() => {
  const out: string[] = [];
  for (let i = 0; i < 25; i++) {
    const d = new Date(Date.UTC(2026, 0, 5 + 3 * i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out.map((d) => (d === '2026-03-03' ? '2026-03-02' : d));
})();
const DESC = [...DATES].sort().reverse();

function seedWorkouts() {
  const w: Record<string, ReturnType<typeof wo>> = {};
  for (const d of DATES) w[d] = wo({ bench: [[20, 5]] });
  w['2026-03-18'] = wo({ bench: [[40, 5]], squat: [[50, 5], [50, 5]] });
  w['2026-03-15'] = wo({ pull: [[0, 8], [0, 6]] });
  w['2026-03-12'] = wo({}, [{ id: 'r-run', m: 30, d: 5 }]);
  w['2026-03-09'] = wo({ bench: [[30, 5], [35, 3]] });
  w['2026-03-06'] = wo({}, [{ id: 'r-bike', m: 45 }]);
  w['2026-03-02'] = wo({ squat: [[50, 5]] });
  return w;
}

test('FIT-02 the training history lists trainings by month newest first with their sets, shows twenty at a time and opens a training for editing or deletes it with an undo (S8)', async ({
  page,
  app,
}) => {
  const workouts = seedWorkouts();
  expect(Object.keys(workouts).length, 'seed has 25 training days').toBe(25);
  await app.open({
    seed: {
      _synthetic: true,
      workouts,
      // 手填的力量点不进历史（它们的日期都没有训练）
      lifts: { bench: { cur: 25, hist: [{ date: '2026-01-02', v: 18 }, { date: '2026-02-14', v: 21 }, { date: '2026-03-17', v: 30 }] } },
    },
  });
  await gotoFitness(page);
  await expect(page.locator('#fh-title')).toHaveText(FH_TITLE);

  // 默认最近 20 次，日期倒序，只出现有训练的月份，全部折叠，手填点不出现
  let h = await readHistory(page);
  expect(h.items.map((x) => x.date), 'first twenty newest first').toEqual(DESC.slice(0, 20));
  expect(h.months, 'months with trainings').toEqual([fhMonth(2026, 3), fhMonth(2026, 2), fhMonth(2026, 1)]);
  expect(h.items.some((x) => x.open), 'all collapsed at first').toBe(false);
  expect(h.items.some((x) => ['2026-01-02', '2026-02-14', '2026-03-17'].includes(x.date)), 'hand-entered points are not listed').toBe(false);
  expect(h.items[0].summary, 'first row is today with its summary').toBe(`${fhDay('3月18日', '三')} 卧推、深蹲（共 3 组）`);
  expect(h.more, 'more button').toBe(FH_MORE);
  expect(h.empty, 'no empty text').toBeNull();

  // 展开：徒手那一天、带距离的跑步那一天、只有有氧的一天
  await page.locator('#fh .fh-item[data-fh="2026-03-15"] summary').click();
  await page.locator('#fh .fh-item[data-fh="2026-03-12"] summary').click();
  await page.locator('#fh .fh-item[data-fh="2026-03-06"] summary').click();
  h = await readHistory(page);
  const by = (d: string) => h.items.find((x) => x.date === d)!;
  expect(by('2026-03-15').open, '03-15 open').toBe(true);
  expect(by('2026-03-15').lines, 'bodyweight line').toEqual([fhLiftLine('引体', '徒手 × 8，徒手 × 6')]);
  expect(by('2026-03-12').lines, 'run with distance').toEqual([fhCardioLine('跑步', 30, 5)]);
  expect(by('2026-03-06').lines, 'cardio only').toEqual([fhCardioLine('骑行', 45)]);

  // 显示更早的记录：多 20 次（这里只剩 5 次），按钮消失，读屏播报，焦点落在最后一条的 summary，展开状态保留
  await page.locator('#fhMore').click();
  h = await readHistory(page);
  expect(h.items.length, 'all twenty-five shown').toBe(25);
  expect(h.more, 'no more button').toBeNull();
  expect(h.items.find((x) => x.date === '2026-03-15')!.open, 'expanded item survives the redraw').toBe(true);
  await expect(page.locator('#fl-live')).toHaveText(fhMoreLive(5));
  expect(
    await page.evaluate(() => {
      const a = document.activeElement;
      const items = document.querySelectorAll('#fh .fh-item');
      return !!a && a.tagName === 'SUMMARY' && a.parentElement === items[items.length - 1];
    }),
    'focus is on the last summary',
  ).toBe(true);

  // 修改这次训练：记录区载入那一天，焦点到 #fl-title；回到历史时那一条仍展开
  await page.locator('#fh .fh-item[data-fh="2026-03-09"] summary').click();
  await page.locator('#fh .fh-item[data-fh="2026-03-09"] [data-wo]').click();
  await expect(page.locator('#fl-title')).toHaveText(flTitleDay('3月9日'));
  await expect(page.locator('#fl-title')).toBeFocused();
  expect(await readFl(page), 'the form holds that day').toEqual([
    {
      id: 'bench',
      sets: [
        { w: '30', r: '5' },
        { w: '35', r: '3' },
      ],
    },
  ]);
  await expect(page.getByRole('tab', { name: TAB_LABELS.fit, exact: true })).toHaveAttribute('aria-selected', 'true');
  h = await readHistory(page);
  expect(h.items.find((x) => x.date === '2026-03-09')!.open, 'edited item is still open in the history').toBe(true);
  expect(await page.locator('#fh [data-wo]').first().textContent(), 'edit button text').toBe(BTN_FH_EDIT);

  // 删除：直接删除，toast 带撤销，那一条消失，焦点到下一条（更早的）summary
  await page.locator('#fh .fh-item[data-fh="2026-03-02"] summary').click();
  await page.locator('#fh .fh-item[data-fh="2026-03-02"] [data-fhdel]').click();
  await expectToast(page, flDeleted('3月2日'));
  await expect(page.locator('#toast.act button')).toHaveText(BTN_UNDO_DELETE);
  await app.expectSaved((s) => !('2026-03-02' in savedWorkouts(s)) && Object.keys(savedWorkouts(s)).length === 24, '等待删除后保存');
  h = await readHistory(page);
  expect(h.items.map((x) => x.date), 'the deleted day is gone').toEqual(DESC.filter((d) => d !== '2026-03-02'));
  expect(
    await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && a.tagName === 'SUMMARY' && (a.parentElement as HTMLElement).dataset.fh;
    }),
    'focus moved to the next older summary',
  ).toBe('2026-02-28');

  // 撤销：回来，仍按日期排在原位置，焦点回到这一条的 summary
  await page.locator('#toast.act button').click();
  await app.expectSaved((s) => JSON.stringify(savedWorkouts(s)['2026-03-02']) === JSON.stringify(workouts['2026-03-02']), '等待撤销后保存');
  h = await readHistory(page);
  expect(h.items.map((x) => x.date), 'the day is back in place').toEqual(DESC);
  expect(h.items.find((x) => x.date === '2026-03-02')!.open, 'the undone day comes back as it was (open)').toBe(true);
  expect(
    await page.evaluate(() => {
      const a = document.activeElement;
      return !!a && a.tagName === 'SUMMARY' && (a.parentElement as HTMLElement).dataset.fh;
    }),
    'focus is on the restored summary',
  ).toBe('2026-03-02');
  expect(FROZEN_TODAY, 'frozen today is the newest training day').toBe(DESC[0]);
});

test('FIT-02 the training history shows its empty text and no more button when there are no trainings (S8)', async ({ page, app }) => {
  await app.open({ seed: { _synthetic: true, lifts: { bench: { cur: 25, hist: [{ date: '2026-03-01', v: 20 }] } } } });
  await gotoFitness(page);
  const h = await readHistory(page);
  expect(h.empty, 'empty text').toBe(FH_EMPTY);
  expect(h.items.length, 'no items').toBe(0);
  expect(h.months.length, 'no months').toBe(0);
  expect(h.more, 'no more button').toBeNull();
  await expect(page.locator('#fh-title')).toHaveText(FH_TITLE);
});
