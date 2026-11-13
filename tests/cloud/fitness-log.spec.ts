// 健身页记录区的云端用例（Phase 15-02）：只在 npm run test:cloud 里运行，只用 FakePbServer 的合成账号和合成计划。
// 失败消息只写 id、计数、布尔和界面文案；计划文字都带 `SYNTH-<label>`，只做相等比较。
import { test, expect } from '../support/test';
import { openDevice } from '../support/devices';
import { FakePbServer } from '../mocks/pb-server';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { BTN_FL_GO_PLAN, FL_CARDIO_NONE, FL_EMPTY_ALL } from '../support/strings';
import { flAddLift, flFillSet, gotoFitness, readFl } from '../support/fitness';

test('FIT-02 a plan without lifts or cardio shows one empty line with the plan editor entry, which opens the plan editor and keeps the draft (D-03, S3)', async ({
  app,
  page,
  browser,
  guard,
}) => {
  // 计划里什么都没有：整个记录区只剩一行说明和入口，没有日期框、没有保存栏
  const noLifts = { ...syntheticPlan('fe', 1), lifts: [] };
  await app.open({ mode: 'cloud', seed: syntheticState('fe'), plan: noLifts, login: 0 });
  await gotoFitness(page);
  await expect(page.locator('#fl .empty')).toHaveCount(1);
  await expect(page.locator('#fl .empty')).toHaveText(FL_EMPTY_ALL);
  await expect(page.locator('#flGoPlan')).toHaveText(BTN_FL_GO_PLAN);
  await expect(page.locator('#fl-date')).toHaveCount(0);
  await expect(page.locator('#fl-save')).toHaveCount(0);

  // 另一个账号：只有 1 个力量项、没有有氧项
  const dev = await openDevice({ browser, guard, fake: new FakePbServer() });
  try {
    await dev.app.open({ mode: 'cloud', users: 1, seed: syntheticState('fo'), plan: syntheticPlan('fo', 1), login: 0 });
    const p2 = dev.page;
    await gotoFitness(p2);
    // 有氧分区：说明加入口（带 id 的入口只有一个，另一个靠 data-flact）
    await expect(p2.locator('#fl')).toContainText(FL_CARDIO_NONE);
    await expect(p2.locator('#flGoPlan')).toHaveCount(1);
    await expect(p2.locator('#fl [data-flact="goplan"]')).toHaveCount(2);
    await expect(p2.locator('#fl-date')).toHaveCount(1);

    // 在力量项上填一组，点入口：编辑计划页打开；回到健身页，草稿那一组还在
    await flAddLift(p2, 'l-fo1');
    await flFillSet(p2, 'l-fo1', 0, '30', '5');
    await p2.locator('#flGoPlan').click();
    await expect(p2.locator('#tab-plan')).toBeVisible();
    await gotoFitness(p2);
    expect(await readFl(p2)).toEqual([{ id: 'l-fo1', sets: [{ w: '30', r: '5' }] }]);
    await expect(p2.locator('#fl-save')).not.toHaveAttribute('aria-disabled', 'true');
  } finally {
    await dev.context.close();
  }
});
