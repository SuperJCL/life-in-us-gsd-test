// Phase 14-01 的云端用例（PLAN-06、PLAN-07：新账号的空计划起步、空计划卡片的「从示例里挑」直接保存）。
// 只在 npm run test:cloud 里运行，只用合成账号（FakePbServer 的合成用户）和假服务器，不连任何真实服务。
// 示例计划的文字是仓库里公开的合成样本：用 loadAppPure 取 SEED_PLAN（写法抄 login.spec.ts），断言里只做布尔比较，不拼进失败消息。
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { gotoGoals, readGroups } from '../support/goals';
import { expectToast } from '../support/toast';
import { BUILTIN_GROUP_SIZES } from '../support/task-ids';
import {
  BTN_PICK_SAMPLE,
  BTN_PK_OK_CARD,
  BTN_PLAN_BUILD,
  PK_HINT_NONE,
  PK_TITLE_CARD,
  pkDone,
  pkPicked,
} from '../support/strings';

// 合成种子计划：应用里唯一一份合成示例计划，即 normalizePlan(DEFAULT_PLAN)；JSON 往返后脱离 vm 的 realm
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));

// 独立写出的空计划（D-01、D-02、D-03）：没有目标组和力量项，5 个类别的快捷词全空，每周健身目标和说明保留示例的值
const EMPTY_PLAN = {
  v: 1,
  presets: { lang: [], pro: [], fit: [], job: [], oth: [] },
  groups: [],
  lifts: [],
  fitGoal: [2, 4],
  fitNote: SEED_PLAN.fitNote,
};

test('PLAN-07 a new account picks one sample group and one lift from the empty plan card and they are saved with new ids and shown on the goals page (D-01, D-07, D-08)', async ({
  app,
  page,
}) => {
  // 只给种子 state、不给 plan：服务器上没有计划文档，首次登录建空计划
  await app.open({ mode: 'cloud', seed: syntheticState('po'), login: 0 });
  expect(app.fake.lastPlan(0)).toEqual(EMPTY_PLAN);

  await gotoGoals(page);
  await expect(page.locator('#goals .pe-empty')).toBeVisible();
  await expect(page.locator('#planEditBtn2')).toHaveText(BTN_PLAN_BUILD);
  await expect(page.locator('#planEditBtn2')).toHaveClass(/primary/);
  await expect(page.locator('#planSampleBtn')).toHaveText(BTN_PICK_SAMPLE);

  // 打开挑选对话框：标题是卡片模式的标题，11 项（7 个目标组、4 个力量项）一项都没勾，确认不可用，提示行说先勾选
  await page.locator('#planSampleBtn').click();
  const dlg = page.locator('dialog#sample');
  await expect(dlg).toBeVisible();
  await expect(page.locator('#pk-title')).toHaveText(PK_TITLE_CARD);
  const boxes = dlg.locator('input[data-pk]');
  await expect(boxes).toHaveCount(11);
  expect(await boxes.evaluateAll((els) => els.filter((e) => (e as HTMLInputElement).checked).length)).toBe(0);
  const ok = page.locator('#pkOk');
  await expect(ok).toHaveText(BTN_PK_OK_CARD);
  await expect(ok).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#pk-hint')).toHaveText(PK_HINT_NONE);

  // 没勾时点确认：不保存、不关对话框
  const planWrites = () => app.fake.writes.filter((w) => w.path === 'journey_docs:plan').length;
  // （首次登录建空计划文档本身是一次写入，所以和点击前的条数比）
  const writesBefore = planWrites();
  await ok.click({ force: true });
  await expect(dlg).toBeVisible();
  expect(planWrites()).toBe(writesBefore);

  // 勾一个目标组（第 2 个示例组）和一个力量项（卧推）：提示行变成已选，确认可用
  await dlg.locator('input[data-pk="g:P2"]').check();
  await dlg.locator('input[data-pk="l:bench"]').check();
  await expect(page.locator('#pk-hint')).toHaveText(pkPicked(1, 1));
  await expect(ok).not.toHaveAttribute('aria-disabled', 'true');

  await ok.click();
  await expect(dlg).toBeHidden();
  await expectToast(page, pkDone(1, 1));

  // 服务器计划：只多了勾选的一组一项，id 全是新的，内容和示例的对应项相同，快捷词、健身目标不动
  await expect.poll(() => (app.fake.lastPlan(0)?.groups ?? []).length, { message: '等待计划上传' }).toBe(1);
  const saved = app.fake.lastPlan(0);
  const g = saved.groups[0];
  const sampleG = SEED_PLAN.groups[1];
  expect(/^g-[A-Za-z0-9_-]+$/.test(g.id) && g.id !== 'P2').toBe(true);
  expect(g.tasks).toHaveLength(BUILTIN_GROUP_SIZES.P2);
  expect(g.tasks.every((t: { id: string }) => /^t-/.test(t.id) && !t.id.startsWith('P2-'))).toBe(true);
  expect(g.name === sampleG.name && g.cat === sampleG.cat).toBe(true);
  expect(saved.lifts).toHaveLength(1);
  const l = saved.lifts[0];
  const sampleL = SEED_PLAN.lifts[0];
  expect(/^l-/.test(l.id) && l.id !== 'bench').toBe(true);
  expect(l.unit === sampleL.unit && l.def === sampleL.def && l.target === sampleL.target).toBe(true);
  expect(saved.presets).toEqual(EMPTY_PLAN.presets);
  expect(saved.fitGoal).toEqual([2, 4]);

  // 目标页马上显示：留在目标页，1 个组（编号 P1）、1 张力量卡，焦点在「编辑计划」入口
  expect((await readGroups(page)).map((x) => x.code)).toEqual(['P1']);
  await expect(page.locator('#goals .lift')).toHaveCount(1);
  await expect(page.locator('#planEditBtn')).toBeFocused();
  expect(app.fake.fulfillErrors).toEqual([]);
});
