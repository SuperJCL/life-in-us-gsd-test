// 本文件覆盖 WEEK-04：预设标签的添加、编辑模式下的删除，以及通过 toast 撤销。
// 视图用例默认账户模式加完整 fixture（D-10）。内置预设是个人计划文字（D-14）：
// 只按序号操作，点选和删除由 composer 在页面内完成，对它们只用计数断言和 Node 侧的布尔比较；
// 新增标签一律用 SYNTH- 开头的文字。
import { test, expect } from '../../support/test';
import { composer } from '../../support/composer';
import { expectToast, expectToastGone, expectToastPrefix, expectUndoOffered, undo } from '../../support/toast';
import { FROZEN_TODAY } from '../../support/constants';
import { loadFixture } from '../../support/fixture-files';
import {
  CATEGORY_NAMES,
  CAT_LANGUAGE,
  PRESET_EDIT_DONE_LABEL,
  PRESET_EDIT_LABEL,
  TOAST_PRESET_ADDED_PREFIX,
  TOAST_PRESET_DELETED_PREFIX,
  TOAST_PRESET_DUPLICATE,
} from '../../support/strings';

test('WEEK-04 adding a preset appends it to its category, rejects a duplicate and survives reload', async ({
  page,
  app,
}) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  const name = 'SYNTH-tag-new';
  const n0 = await c.presets.count();

  await c.addPreset(name);
  await expectToast(page, TOAST_PRESET_ADDED_PREFIX + name);

  // 排在该类别预设的最后：只比较序号，不对末位的预设做文字断言（位置不对时那里可能是内置标签）
  await expect(c.presets).toHaveCount(n0 + 1);
  expect(await c.presetIndexOf(name), '新标签没有排在最后').toBe(n0);
  await app.expectSaved((s) => {
    const add: string[] = s.presets[CAT_LANGUAGE].add;
    return add[add.length - 1] === name;
  });

  // 再添加同名标签：提示已有，数量不变
  await c.addPreset(name);
  await expectToast(page, TOAST_PRESET_DUPLICATE);
  await expect(c.presets).toHaveCount(n0 + 1);

  // 别的类别看不到它
  await c.pickCategory(CATEGORY_NAMES[1]);
  await expect(c.presetNamed(name)).toHaveCount(0);

  // 刷新后仍在
  await app.reload();
  await c.pickCategory(CAT_LANGUAGE);
  await expect(c.presetNamed(name)).toHaveCount(1);
});

test('WEEK-04 deleting a custom preset in edit mode can be undone from the toast', async ({ page, app }) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  // fixture 里的合成自定义标签，不手抄
  const name: string = fixture.presets[CAT_LANGUAGE].add[0];
  const todayEntries = page.locator(`#tab-wk [data-wday="${FROZEN_TODAY}"] [data-edit]`);

  // 编辑模式：按钮变成“完成”，每个预设都有删除按钮
  await c.toggleEditMode();
  await expect(c.editButton).toHaveText(PRESET_EDIT_DONE_LABEL);
  await expect(c.deleteButtons).toHaveCount(await c.presets.count());

  // 编辑模式下点预设本身不记录
  const n0 = await todayEntries.count();
  await c.presetNamed(name).click();
  await expect(todayEntries).toHaveCount(n0);

  // 删除：toast 带撤销按钮，标签消失，保存后的 add 不再含它
  await c.deletePresetNamed(name);
  await expectToast(page, TOAST_PRESET_DELETED_PREFIX + name);
  await expectUndoOffered(page);
  await expect(c.presetNamed(name)).toHaveCount(0);
  await app.expectSaved((s) => !s.presets[CAT_LANGUAGE].add.includes(name));

  // 撤销：标签回来，仍在编辑模式，保存后的 add 又含它
  await undo(page);
  await expect(c.presetNamed(name)).toHaveCount(1);
  expect(await c.deleteButtons.count(), '撤销后不在编辑模式').toBeGreaterThan(0);
  await expectToastGone(page);
  await app.expectSaved((s) => s.presets[CAT_LANGUAGE].add.includes(name));

  // 退出编辑模式
  await c.toggleEditMode();
  await expect(c.editButton).toHaveText(PRESET_EDIT_LABEL);
});

test('WEEK-04 deleting a built-in preset hides it and undo restores it without printing its text', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const c = composer(page, 'w');
  // fixture 的 presets 不是每个类别都有键，没有键按空列表算
  const hide0 = (fixture.presets[CAT_LANGUAGE]?.hide ?? []).length;
  const n0 = await c.presets.count();

  await c.toggleEditMode();
  // 文字只放在内存里，由 composer 在页面内点第 0 个预设的删除按钮；断言里不出现标签文字
  const text = await c.presetText(0);
  await c.deletePreset(0);
  await expect(c.presets).toHaveCount(n0 - 1);
  await expectToastPrefix(page, TOAST_PRESET_DELETED_PREFIX);
  await app.expectSaved((s) => {
    const hide: string[] = s.presets[CAT_LANGUAGE].hide;
    return hide.length === hide0 + 1 && hide.includes(text as string);
  });

  // 此时 toast 带撤销按钮、文字含内置原文、会接收指针事件，所以这是删除之后唯一的 Playwright 动作
  await undo(page);
  await expect(c.presets).toHaveCount(n0);
  await app.expectSaved((s) => {
    const hide: string[] = s.presets[CAT_LANGUAGE].hide;
    return hide.length === hide0 && !hide.includes(text as string);
  });
});
