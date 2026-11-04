// 本文件登记导入的两个已知 bug（BUG-01，D-01、D-02）：B2 和 N3。
// 写法与 tests/e2e/calendar/known-bugs.spec.ts 相同：对照用例不带标记，走完全相同的准备和触发、断言前提成立；
// 标记用例第一句调用 knownBug，只断言一条期望的正确行为。
// 成对的理由：test.fail 会把同一条用例里任何原因的失败都当作“预期失败”，前提放在标记用例里，坏了也看不出来。
// B2 的 spike 结论见 tests/PROBES.md 的 PROBE-8；导入文件只在内存里构造，名字以 synth- 开头（D-04），
// 先注册对话框处理再选文件（D-05）；都用账户模式加完整 fixture 开局，并立刻 expectAccountMode（D-06）。
// B2 标记用例失败时会打印 #importJson 的 value（浏览器的 fakepath 形式加合成文件名），只留在本机终端，不写进文档。
import { test, expect, knownBug } from '../../support/test';
import type { Page } from '../../support/test';
import type { AppHarness } from '../../support/app';
import { MALFORMED_IMPORTS } from '../../fixtures/malformed-imports';
import { loadFixture } from '../../support/fixture-files';
import { answerNextDialog, chooseImportFile, jsonImportFile, recordDialogs } from '../../support/import-file';
import { expectToast, expectToastGone } from '../../support/toast';
import { CONFIRM_IMPORT, TOAST_IMPORT_BAD_FORMAT } from '../../support/strings';

test.describe('BUG-01 B2 the file input is not cleared when the import confirm is cancelled', () => {
  // 准备和触发：账户模式加完整 fixture 开局，先注册“取消”再选文件，等确认框出现；返回确认框消息数组
  async function cancelImport(page: Page, app: AppHarness) {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const dialogs = answerNextDialog(page, 'dismiss');
    await chooseImportFile(page, jsonImportFile('synth-b2-import.json', { logs: [] }));
    await expect.poll(() => dialogs.length, { message: '等待替换确认框' }).toBe(1);
    return dialogs;
  }

  test('BUG-01 B2 control: cancelling the import confirm shows the confirm text and leaves the data unchanged', async ({
    page,
    app,
  }) => {
    const dialogs = await cancelImport(page, app);

    // 前提：确认框文案逐字等于 CONFIRM_IMPORT，取消路径没有 toast，fixture 的记录还在，没有写入
    expect(dialogs).toEqual([CONFIRM_IMPORT]);
    await expectToastGone(page);
    await expect(page.locator('#tab-wk [data-edit="synth-full-04"]')).toHaveCount(1);
    expect(app.backend.writes).toEqual([]);
  });

  // 证明标记用例的那条断言在这个环境里能通过：格式错误路径走 catch，会执行 e.target.value=""
  test('BUG-01 B2 reset path: the file input is cleared after a file that is not JSON', async ({ page, app }) => {
    await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
    await app.expectAccountMode();
    const dialogs = recordDialogs(page);
    const notJson = MALFORMED_IMPORTS.find((m) => m.kind === 'not-json');
    expect(notJson, '需要一个非 JSON 的合成文件').toBeDefined();

    await chooseImportFile(page, notJson!);
    await expectToast(page, TOAST_IMPORT_BAD_FORMAT);
    await expect(page.locator('#importJson')).toHaveValue('');
    expect(dialogs).toEqual([]);
  });

  test('BUG-01 B2 expected: the file input is cleared after cancelling the import confirm', async ({ page, app }) => {
    knownBug('B2', '取消导入确认后文件框没有清空，再选同一个文件没有反应');
    await cancelImport(page, app);

    // 只断言确定性的 value；不断言“change 会再次触发”，因为 Playwright 的 setInputFiles 每次都自己派发 change（PROBE-8）
    await expect(page.locator('#importJson')).toHaveValue('', { timeout: 2_000 });
  });
});
