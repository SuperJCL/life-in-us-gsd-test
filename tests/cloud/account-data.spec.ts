// 账号数据用例（09-10）：每个账号的个人计划存在自己的 plan 文档里，换一台设备登录看到同一份数据，
// 不合格的计划按示例计划显示且从不被改写。只在 npm run test:cloud 里运行，只用 FakePbServer 的合成账号。
// 所有计划文字都带 SYNTH-<label> 标记（syntheticPlan），负向断言用对方账号的一个标记覆盖它的全部计划文字。
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { openDevice } from '../support/devices';
import { gotoGoals, readGroups } from '../support/goals';

test("PLAN-01 each account sees its own plan and records and none of the other account's content", async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', users: 2 });
  // A：plan 比 state 新建，服务器列表里 plan 在前
  app.fake.seed(syntheticState('a'), { userIndex: 0, plan: syntheticPlan('a', 2) });
  // B：先建 state 和 plan，再删掉 state 重建，使 B 的列表里 state 在前、plan 在后（与 A 相反）
  app.fake.seed(syntheticState('b'), { userIndex: 1, plan: syntheticPlan('b', 3) });
  app.fake.dropDocs(1, 'state');
  app.fake.seed(syntheticState('b'), { userIndex: 1 });

  await app.login(0);

  // 本周视图：预设标签和记录（隐藏的标签页点不到，所以先看本周，再切到目标）
  const wk = composer(page, 'w');
  await wk.pickCategory('语言');
  await expect(wk.presetNamed('SYNTH-a preset')).toBeVisible();
  await expect(page.locator('#days [data-edit="synthetic-a"]')).toBeVisible();
  await gotoGoals(page);
  expect((await readGroups(page)).map((g) => g.code)).toEqual(['g-a1', 'g-a2']);
  await expect(page.locator('#goals')).toContainText('SYNTH-a lift');
  await expect(page.locator('#goals .group.k-fit .note')).toHaveText('SYNTH-a fit note');
  const htmlA = await page.content();
  expect(htmlA).not.toContain('SYNTH-b');
  expect(htmlA).not.toContain('合成记录 b');
  expect(htmlA).not.toContain('synthetic-b');

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 1 });
    const pageB = second.page;

    const wkB = composer(pageB, 'w');
    await wkB.pickCategory('语言');
    await expect(wkB.presetNamed('SYNTH-b preset')).toBeVisible();
    await expect(pageB.locator('#days [data-edit="synthetic-b"]')).toBeVisible();
    await gotoGoals(pageB);
    expect((await readGroups(pageB)).map((g) => g.code)).toEqual(['g-b1', 'g-b2', 'g-b3']);
    await expect(pageB.locator('#goals')).toContainText('SYNTH-b lift');
    await expect(pageB.locator('#goals .group.k-fit .note')).toHaveText('SYNTH-b fit note');
    const htmlB = await pageB.content();
    expect(htmlB).not.toContain('SYNTH-a');
    expect(htmlB).not.toContain('合成记录 a');
    expect(htmlB).not.toContain('synthetic-a');
  } finally {
    await second.context.close();
  }

  // 两个账号的服务器 plan 文档都没有被应用写过
  expect(app.fake.writes.filter((w) => w.path === 'journey_docs:plan')).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});
