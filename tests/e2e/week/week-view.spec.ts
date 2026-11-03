// 本文件覆盖 WEEK-01：本周视图的渲染（标题、范围、五类计数和目标、7 列内容）。
// 视图用例默认账户模式加完整 fixture（D-10）：开局后立刻 expectAccountMode，期望值全部由
// tests/support/expect-from-fixture.ts 的推导函数从 fixture 算出，用例里不抄数字。
//
// 隐私（D-14）：本周视图里完成的内置计划条目带个人计划原文（文字和 aria-label），
// 健身目标行带目标数值。所以：
//  - 完成的计划条目只比较 data-edittask 的 id，不对它们做 Playwright 动作和单元素断言；
//  - 日期列的内容经一次 page.evaluate 读回，只取日期、aria-label（只有日期、条数和固定文案）、
//    条目 id 和 today / sel 类，不读条目文字；
//  - 健身目标行的文字和 ok 类也经 page.evaluate 读回，只在 Node 侧比较前缀和布尔，失败消息里只有类别名。
import { test, expect } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { FROZEN_TODAY, WEEK_END_FROZEN, WEEK_START_FROZEN } from '../../support/constants';
import { BUILTIN_TASK_IDS } from '../../support/task-ids';
import { loadFixture } from '../../support/fixture-files';
import {
  dayAriaLabel,
  expectedWeekRange,
  expectedWeekTitle,
  logsInWeek,
  mdLabel,
  weekCountsByCategory,
  weekDayColumns,
  weekGoalDays,
} from '../../support/expect-from-fixture';
import {
  AREA_COUNT_UNIT,
  CATEGORY_NAMES,
  WEEK_GOAL_DAY_UNIT,
  WEEK_GOAL_FIT_PREFIX,
  WEEK_GOAL_RECORDED_SUFFIX,
  WEEK_RANGE_FROZEN,
  WEEK_TITLE_ARRIVAL_PREFIX,
  WEEK_TITLE_ARRIVAL_SUFFIX,
  WEEK_TITLE_CURRENT,
  WEEK_TITLE_OTHER,
} from '../../support/strings';

// 健身类别的显示名（引用 CATEGORY_NAMES，不写新的字面量）
const CAT_FITNESS = CATEGORY_NAMES[2];

type AreaRead = { name: string; goal: string; ok: boolean };

// 一次 page.evaluate 读回每张类别卡的名字、目标行文字和目标行是否带 ok 类。
// 目标行文字可能带健身目标的数值，所以只回到 Node 侧做前缀和布尔比较，不打印、不进断言消息
async function readAreas(page: Page): Promise<AreaRead[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#areas .area')).map((a) => ({
      name: a.querySelector('.nm')?.textContent ?? '',
      goal: a.querySelector('.goal')?.textContent ?? '',
      ok: !!a.querySelector('.goal')?.classList.contains('ok'),
    })),
  );
}

// 一次读回 7 列的结构：日期、列的 aria-label（只有日期、条数和固定文案）、记录 id、完成计划 id、today 和 sel 类。
// 不读任何条目文字
async function readDayColumns(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#tab-wk #days [data-wday]')).map((d) => ({
      date: d.getAttribute('data-wday') ?? '',
      aria: d.getAttribute('aria-label') ?? '',
      logIds: Array.from(d.querySelectorAll('[data-edit]')).map((e) => e.getAttribute('data-edit') ?? ''),
      doneTaskIds: Array.from(d.querySelectorAll('[data-edittask]')).map((e) => e.getAttribute('data-edittask') ?? ''),
      today: d.classList.contains('today'),
      sel: d.classList.contains('sel'),
    })),
  );
}

// 本周视图与独立推导逐项比较：标题、范围、五类计数和目标、7 列内容、选中日和今天
async function expectWeekMatches(page: Page, state: any, weekStart: string, selected: string) {
  await expect(page.locator('#wkTitle')).toHaveText(expectedWeekTitle(state.arrival, weekStart, FROZEN_TODAY));
  await expect(page.locator('#wkRange')).toHaveText(expectedWeekRange(weekStart));

  // 五张类别卡：名称按 CATEGORY_NAMES 的顺序，计数 = 记录数加完成的计划数（类别名和计数不含个人内容）
  const counts = weekCountsByCategory(state, weekStart);
  const areas = page.locator('#areas .area');
  await expect(areas).toHaveCount(CATEGORY_NAMES.length);
  for (let i = 0; i < CATEGORY_NAMES.length; i++) {
    await expect(areas.nth(i).locator('.nm')).toHaveText(CATEGORY_NAMES[i]);
    await expect(areas.nth(i).locator('.v')).toHaveText(`${counts[i]}${AREA_COUNT_UNIT}`);
  }

  // 目标行：不用定位器断言，读回后在 Node 侧按类别名比较；不符的只收类别名
  const goalDays = weekGoalDays(state, weekStart);
  const read = await readAreas(page);
  const mismatches: string[] = [];
  CATEGORY_NAMES.forEach((name, i) => {
    const area = read.find((a) => a.name === name);
    if (!area) {
      mismatches.push(name);
      return;
    }
    const textOk =
      name === CAT_FITNESS
        ? area.goal.startsWith(`${WEEK_GOAL_FIT_PREFIX}${goalDays[i]}${WEEK_GOAL_DAY_UNIT}`)
        : area.goal === `${goalDays[i]}${WEEK_GOAL_RECORDED_SUFFIX}`;
    // 非健身类别的目标行从不带 ok 类
    const okClassOk = name === CAT_FITNESS ? true : area.ok === false;
    if (!textOk || !okClassOk) mismatches.push(name);
  });
  expect(mismatches, '目标行与推导不符的类别（目标行文字不打印）').toEqual([]);

  // 7 列：日期、aria-label、记录 id、完成计划 id、today 和 sel 类都与推导一致。
  // today 类只在冻结的今天所在的那一列上；sel 类恰好在选中日那一列上
  const expected = weekDayColumns(state, weekStart).map((c) => ({
    date: c.date,
    aria: dayAriaLabel(c.date, c.logIds.length + c.doneTaskIds.length),
    logIds: c.logIds,
    doneTaskIds: c.doneTaskIds,
    today: c.date === FROZEN_TODAY,
    sel: c.date === selected,
  }));
  await expect.poll(() => readDayColumns(page), { message: '7 列的内容与推导不一致（只含 id 和日期）' }).toEqual(expected);
}

// 账户模式加完整 fixture（或它的内存变体）开局
async function openWeek(app: AppHarness, state: any) {
  await app.open({ mode: 'account', seed: state });
  await app.expectAccountMode();
}

test('WEEK-01 the current week renders title, range, five category counts with goals and seven day columns derived from the fixture', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await openWeek(app, fixture);

  await expectWeekMatches(page, fixture, WEEK_START_FROZEN, FROZEN_TODAY);

  // 新推导的范围与已有常量一致
  await expect(page.locator('#wkRange')).toHaveText(WEEK_RANGE_FROZEN);

  // 本周只有一天有健身记录：目标行没有 ok 类（布尔断言，不打印目标行文字）
  const areas = await readAreas(page);
  expect(areas.find((a) => a.name === CAT_FITNESS)?.ok, '健身目标行不应达标（只有一天有健身记录）').toBe(false);

  // 每条本周记录显示 fixture 原文（都是合成文字）；含 <b> 的那条按文字显示，没有 b 元素
  for (const l of logsInWeek(fixture, WEEK_START_FROZEN, WEEK_END_FROZEN)) {
    await expect(page.locator(`#tab-wk [data-edit="${l.id}"] > span`)).toHaveText(l.text);
  }
  await expect(page.locator('#tab-wk [data-edit="synth-full-05"] b')).toHaveCount(0);

  // 到期未完成的计划不出现在本周视图；本周视图没有删除按钮
  await expect(page.locator(`#tab-wk [data-edittask="${BUILTIN_TASK_IDS.dueToday}"]`)).toHaveCount(0);
  await expect(page.locator('#tab-wk [data-dellog]')).toHaveCount(0);
});

test('WEEK-01 the range spells out both months for a week that crosses a month boundary', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await openWeek(app, fixture);

  await page.locator('#wkNext').click();
  await page.locator('#wkNext').click();
  await expectWeekMatches(page, fixture, '2026-03-30', '2026-03-30');

  await expect(page.locator('#wkRange')).toContainText(mdLabel('2026-03-30'));
  await expect(page.locator('#wkRange')).toContainText(mdLabel('2026-04-05'));
});

test('WEEK-01 the title reads the arrival week, the current week or a generic label depending on the arrival date', async ({
  page,
  app,
}) => {
  // 抵达日期设为下周的周三：本周在抵达周之前，下周是抵达周，再往前是“这一周”
  const state = { ...loadFixture('full-state.json'), arrival: '2026-03-25' };
  await openWeek(app, state);

  // 本周：既不晚于抵达周，也是今天所在周
  const current = expectedWeekTitle(state.arrival, WEEK_START_FROZEN, FROZEN_TODAY);
  expect(current).toBe(WEEK_TITLE_CURRENT);
  await expectWeekMatches(page, state, WEEK_START_FROZEN, FROZEN_TODAY);

  // 下周：抵达周，第 1 周
  await page.locator('#wkNext').click();
  const arrivalWeek = expectedWeekTitle(state.arrival, '2026-03-23', FROZEN_TODAY);
  expect(arrivalWeek).toBe(`${WEEK_TITLE_ARRIVAL_PREFIX}1${WEEK_TITLE_ARRIVAL_SUFFIX}`);
  await expectWeekMatches(page, state, '2026-03-23', '2026-03-23');

  // 回到本周再往前一周：不晚于抵达周的条件不成立，也不是今天所在周，所以是通用标题
  await page.locator('#wkNow').click();
  await page.locator('#wkPrev').click();
  const generic = expectedWeekTitle(state.arrival, '2026-03-09', FROZEN_TODAY);
  expect(generic).toBe(WEEK_TITLE_OTHER);
  await expectWeekMatches(page, state, '2026-03-09', '2026-03-09');
});

test('WEEK-01 the fitness goal row is marked as met when every day of the week has a fitness entry', async ({
  page,
  app,
}) => {
  // 内存变体：在完整 fixture 后追加 7 条合成健身记录，覆盖周一到周日
  const base = loadFixture('full-state.json');
  const extra = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    id: `synth-fit7-${n}`,
    date: `2026-03-${15 + n}`,
    text: `SYNTH-FIT7 day ${n}`,
    cat: CAT_FITNESS,
  }));
  const state = { ...base, logs: [...base.logs, ...extra] };
  await openWeek(app, state);

  await expectWeekMatches(page, state, WEEK_START_FROZEN, FROZEN_TODAY);

  // 目标下限不写进仓库：一周 7 天都有健身记录，必然达到每周目标
  expect(weekGoalDays(state, WEEK_START_FROZEN)[2]).toBe(7);
  const areas = await readAreas(page);
  expect(areas.find((a) => a.name === CAT_FITNESS)?.ok, '一周 7 天都有健身记录，目标行应带 ok 类').toBe(true);
});
