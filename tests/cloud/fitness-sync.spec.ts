// 云端 tracer（FIT-05）：健身页保存的训练按「wo:<日期>」上传到服务器 state 文档，同账号第二台设备的本周页有同一行。
// 只用 FakePbServer 的合成账号和合成数据；动作名（合成的 SYNTH-fs 力量项）只做相等比较，不拼进失败消息。
import { test, expect } from '../support/test';
import { openDevice } from '../support/devices';
import { FROZEN_TODAY } from '../support/constants';
import { fitRow } from '../support/strings';
import { flAddLift, flFillSet, flSave, gotoFitness, readWeekWo } from '../support/fitness';
import { syntheticPlan, syntheticState } from '../support/cloud-data';

test('FIT-05 a training saved on the fitness tab is uploaded under its per-day key and shows in the week view of another device of the same account', async ({
  app,
  page,
  browser,
  guard,
}) => {
  const seed = syntheticState('fs');
  await app.open({ mode: 'cloud', seed, plan: syntheticPlan('fs', 1), login: 0 });

  // 记下每次写缓存时带的 touched，免得和上传抢时间（上传后 touched 会清空）
  const cacheKey = `usj:v2:${app.fake.users[0].id}:state`;
  await page.evaluate((k) => {
    const seen: string[] = [];
    (window as any).__touchedSeen = seen;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === k) {
        try {
          const t = JSON.parse(value).touched;
          if (Array.isArray(t)) seen.push(...t);
        } catch {
          /* 只记录，不影响写入 */
        }
      }
      return orig.call(this, key, value);
    };
  }, cacheKey);

  await gotoFitness(page);
  await flAddLift(page, 'l-fs1');
  await flFillSet(page, 'l-fs1', 0, '30', '5');
  await flSave(page);

  const expected = { [FROZEN_TODAY]: { lifts: [{ id: 'l-fs1', sets: [{ w: 30, r: 5 }] }], cardio: [] } };
  await expect
    .poll(() => JSON.stringify(app.fake.lastState(0)?.workouts ?? null), { message: '等待训练上传到 state 文档' })
    .toBe(JSON.stringify(expected));
  expect((app.fake.lastState(0).logs as unknown[]).length).toBe(seed.logs.length);
  const touched = await page.evaluate(() => (window as any).__touchedSeen as string[]);
  expect(touched).toContain(`wo:${FROZEN_TODAY}`);

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });
    await expect(second.page.locator(`#days .ent.wo[data-wo="${FROZEN_TODAY}"]`)).toBeVisible();
    const row = await readWeekWo(second.page, FROZEN_TODAY);
    expect(row !== null && row.text === fitRow('SYNTH-fs lift（共 1 组）')).toBe(true);
  } finally {
    await second.context.close();
  }
});
