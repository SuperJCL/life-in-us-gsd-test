// 本文件覆盖 GOAL-02：力量值的保存按钮、点保存和按 Enter 保存、历史行、达标与不达标的 toast、进度条上限，
// 以及“失焦和负数不保存”的证明。视图用例默认账户模式加完整 fixture（D-06），保存用 app.expectSaved 断言。
// 力量名称、目标数值、单位和备注是个人计划文字（D-02、D-05），不写进任何断言、失败消息或注解：
// 不写死目标数值，达标用极大值、不达标用很小但合法的值（下面三个常量，都远小于任何合理的力量目标；
// 这个假设若不成立，用例会在 toast 片段比较上失败，失败消息不含名称）；toast 只用后缀或片段 helper 比较。
// 定位器动作的豁免（D-05 的明确例外，只限四个元素）：#lf-bench、#lf-squat 两个输入框，
// 以及 [data-liftsave="bench"]、[data-liftsave="squat"] 两个保存按钮，可以用 fill、press、blur、click 和 hidden 类的断言。
// 理由：(1) 输入框的属性只有 type、id、data-lift、step、min 和 value，value 要么是 fixture 里合成的 cur，要么是用例自己填的数值，
// 保存按钮的属性只有 type、class 和 data-liftsave，文字是固定的“保存”，所以调用日志里的元素预览不含个人计划文字；
// (2) 选择器是唯一的 id 或属性值，不会触发列出多个元素的 strict mode 报错；
// (3) 被遮挡时日志会打印遮挡元素的预览，而这些元素附近唯一可能盖住它们的是 toast：
// 它不带撤销按钮时不接收指针事件，而且含子元素，预览只显示省略号。
// 其余力量卡元素一律经 tests/support/goals.ts 的 readLifts 读回布尔和数值。
import { test, expect } from '../../support/test';
import { gotoGoals, liftHistoryEquals, readLifts } from '../../support/goals';
import { FROZEN_NOW, FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import { liftHistoryText } from '../../support/expect-from-fixture';
import { LIFT_HISTORY_PREFIX, LIFT_HISTORY_SEPARATOR, LIFT_REACHED_SUFFIX, LIFT_UPDATED_INFIX } from '../../support/strings';
import { LIFT_IDS } from '../../support/task-ids';
import { expectToastContains, expectToastSuffix } from '../../support/toast';

// 极大值：必然达到目标。很小但合法的值：必然低于目标，且大于 0，所以进度条在 0 到 100 之间（不含两端）。
// 两个很小的值互不相同，也都不同于 fixture 里的当前值，保证保存确实改了值
const HUGE_VALUE = 999999;
const SMALL_BENCH = 1;
const SMALL_SQUAT = 2;

type Hist = { date: string; v: number };

// 读回 LIFT_IDS 里某一项对应的那张卡
async function liftCard(page: Parameters<typeof readLifts>[0], id: (typeof LIFT_IDS)[number]) {
  const { cards } = await readLifts(page, LIFT_IDS);
  const card = cards.find((c) => c.fixtureId === id);
  expect(card, `应当能读回 ${id} 对应的力量卡`).toBeDefined();
  return card!;
}

test('GOAL-02 the save button appears only after the value changes and hides again for the current value', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  const save = page.locator('[data-liftsave="bench"]');
  const input = page.locator('#lf-bench');
  await expect(save).toHaveClass(/\bhidden\b/);
  await input.fill(String(SMALL_BENCH));
  await expect(save).not.toHaveClass(/\bhidden\b/);
  await input.fill(String(fixture.lifts.bench.cur));
  await expect(save).toHaveClass(/\bhidden\b/);
});

test('GOAL-02 saving with the button appends today to the history, shows the last three and saves the value', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  await page.locator('#lf-bench').fill(String(SMALL_BENCH));
  await page.locator('[data-liftsave="bench"]').click();
  await expectToastContains(page, LIFT_UPDATED_INFIX + SMALL_BENCH);

  // 保存：cur 是新值，历史在 fixture 之后追加一条冻结的今天，前面各条不变
  const before: Hist[] = fixture.lifts.bench.hist;
  const beforeJson = JSON.stringify(before);
  await app.expectSaved((s) => {
    const b = s.lifts?.bench;
    return (
      !!b &&
      b.cur === SMALL_BENCH &&
      b.hist.length === before.length + 1 &&
      JSON.stringify(b.hist[b.hist.length - 1]) === JSON.stringify({ date: FROZEN_TODAY, v: SMALL_BENCH }) &&
      JSON.stringify(b.hist.slice(0, -1)) === beforeJson
    );
  }, '等待保存后的 bench 的值和历史追加了今天（内容已隐藏）');

  // 历史行等于推导，并且去掉前缀后恰好是最近 3 段
  const saved = await app.saved();
  const expectedHist = liftHistoryText(saved.lifts.bench.hist);
  expect(expectedHist, '保存后的历史不应当为空').not.toBeNull();
  expect(await liftHistoryEquals(page, 'bench', expectedHist as string), '历史行应当等于由保存结果推导的文字（内容已隐藏）').toBe(true);
  const segments = (expectedHist as string).slice(LIFT_HISTORY_PREFIX.length).split(LIFT_HISTORY_SEPARATOR);
  expect(segments, '历史行应当恰好显示最近 3 条').toHaveLength(3);

  // 保存按钮重新隐藏，输入框显示新值，进度条在 0 到 100 之间（不含两端）
  const card = await liftCard(page, 'bench');
  expect(card.saveHidden, '保存后保存按钮应当带 hidden 类（内容已隐藏）').toBe(true);
  expect(card.value === String(SMALL_BENCH), '保存后输入框的值应当是新值（内容已隐藏）').toBe(true);
  expect(card.barPct !== null && card.barPct > 0 && card.barPct < 100, '很小的值应当落在不达标分支，进度条在 0 到 100 之间（内容已隐藏）').toBe(true);
});

test('GOAL-02 pressing Enter saves a small value with the updated toast', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  await page.locator('#lf-squat').fill(String(SMALL_SQUAT));
  await page.locator('#lf-squat').press('Enter');
  await expectToastContains(page, LIFT_UPDATED_INFIX + SMALL_SQUAT);

  const before: Hist[] = fixture.lifts.squat.hist;
  const expectedJson = JSON.stringify([...before, { date: FROZEN_TODAY, v: SMALL_SQUAT }]);
  await app.expectSaved((s) => {
    const q = s.lifts?.squat;
    return !!q && q.cur === SMALL_SQUAT && JSON.stringify(q.hist) === expectedJson;
  }, '等待保存后的 squat 的值和历史追加了今天（内容已隐藏）');

  const saved = await app.saved();
  const expectedHist = liftHistoryText(saved.lifts.squat.hist);
  expect(expectedHist, '保存后的历史不应当为空').not.toBeNull();
  expect(await liftHistoryEquals(page, 'squat', expectedHist as string), '历史行应当等于由保存结果推导的文字（内容已隐藏）').toBe(true);
});

test('GOAL-02 a very large value reaches the target, caps the bar at 100% and shows the reached toast', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();
  await gotoGoals(page);

  await page.locator('#lf-bench').fill(String(HUGE_VALUE));
  await page.locator('[data-liftsave="bench"]').click();
  await expectToastSuffix(page, LIFT_REACHED_SUFFIX);
  await app.expectSaved((s) => s.lifts?.bench?.cur === HUGE_VALUE, '等待保存后的 bench 的值是极大值（内容已隐藏）');

  const card = await liftCard(page, 'bench');
  expect(card.barPct === 100, '达标后进度条宽度应当正好是 100%（内容已隐藏）').toBe(true);
});

// “没有保存”的证明要用 manual 时钟（D-04）：先推过 600 ms 的保存防抖窗口再比较写入次数，
// 再用保存按钮做哨兵写入，证明这个窗口确实推进了防抖。同一个用例里不混用 setFixedTime
test.describe('GOAL-02 manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('GOAL-02 blurring the field or entering a negative value saves nothing', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);
    await gotoGoals(page);

    const writesBefore = app.backend.writes.length;
    const save = page.locator('[data-liftsave="bench"]');
    const input = page.locator('#lf-bench');

    // 改值后保存按钮出现，再失焦：不保存
    await input.fill(String(SMALL_BENCH));
    await expect(save).not.toHaveClass(/\bhidden\b/);
    await input.blur();
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length, '失焦之后不应当有保存').toBe(writesBefore);

    // 负数加 Enter：不保存，输入框恢复为当前值，保存按钮隐藏
    await input.fill('-5');
    await input.press('Enter');
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length, '输入负数按 Enter 之后不应当有保存').toBe(writesBefore);
    const card = await liftCard(page, 'bench');
    expect(card.value === String(fixture.lifts.bench.cur), '负数不保存后输入框应当恢复为当前值（内容已隐藏）').toBe(true);
    expect(card.saveHidden, '负数不保存后保存按钮应当带 hidden 类（内容已隐藏）').toBe(true);

    // 哨兵：用合法的值点保存，写入到达 mock，证明上面的窗口确实推进了防抖
    await input.fill(String(SMALL_BENCH));
    await save.click();
    await page.clock.runFor(2_000);
    await expect
      .poll(() => app.backend.writes.some((w) => w.data.lifts?.bench?.cur === SMALL_BENCH), {
        message: '等待哨兵写入到达 mock',
      })
      .toBe(true);
    // 哨兵到达后，中间不能有别的写入（写入按顺序到达，多余的保存会让总数大于 +1）
    expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
  });
});
