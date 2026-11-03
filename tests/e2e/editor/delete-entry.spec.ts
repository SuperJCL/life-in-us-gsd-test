// 本文件覆盖 EDIT-02：在编辑弹窗里删除记录、从 toast 撤销，以及文字为空时不能保存（D-15、D-17）。
// 只编辑合成记录（synth-full-*）；视图用例默认账户模式加完整 fixture（D-10）。
// 定位器都精确到合成 id，不对整个容器做文字类断言（D-14）。
import { test, expect } from '../../support/test';
import { editor } from '../../support/editor';
import { expectToast, expectUndoOffered, undo } from '../../support/toast';
import { loadFixture } from '../../support/fixture-files';
import { FROZEN_NOW } from '../../support/constants';
import { TOAST_EMPTY_TEXT, TOAST_LOG_DELETED, TOAST_RESTORED } from '../../support/strings';

type Log = { id: string; text: string; cat: string; date: string };

test('EDIT-02 deleting an entry from the editor removes it and undo restores it at its original position', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  const id = 'synth-full-01';
  const originalDate = fixture.logs.find((l: Log) => l.id === id).date;
  const fixtureIds = fixture.logs.map((l: Log) => l.id);
  const ed = editor(page);

  await ed.openLog(page.locator(`#tab-wk [data-edit="${id}"]`));
  await ed.deleteEntry();

  // 弹窗先关，再弹出带撤销按钮的 toast。
  // 带撤销的 toast 只显示 5 秒，删除后等保存只用不到 2 秒，中间不做别的操作
  await ed.expectClosed();
  await expectToast(page, TOAST_LOG_DELETED);
  await expectUndoOffered(page);
  await expect(page.locator(`#tab-wk [data-edit="${id}"]`)).toHaveCount(0);
  await app.expectSaved(
    (s) => s.logs.every((l: Log) => l.id !== id) && s.logs.length === fixture.logs.length - 1,
    '等待保存后的记录里没有被删除的这条',
  );

  // 撤销：toast 变成已恢复，记录回到原来的列，保存后的 id 顺序与 fixture 完全相同
  await undo(page);
  await expectToast(page, TOAST_RESTORED);
  await expect(page.locator(`#tab-wk [data-wday="${originalDate}"] [data-edit="${id}"]`)).toHaveCount(1);
  const fixtureIdsJson = JSON.stringify(fixtureIds);
  await app.expectSaved(
    (s) => JSON.stringify(s.logs.map((l: Log) => l.id)) === fixtureIdsJson,
    '等待保存后的记录顺序与 fixture 相同',
  );
});

// 证明“没有保存”要用 manual 时钟（D-05、D-15）：先推过防抖窗口再比较写入次数，
// 再用哨兵写入证明这个窗口确实推进了防抖。同一个用例里不混用 setFixedTime。
test.describe('EDIT-02 manual clock', () => {
  test.use({ clockMode: 'manual' });

  test('EDIT-02 saving empty text keeps the editor open, shows the hint and writes nothing', async ({ page, app }) => {
    const fixture = loadFixture('full-state.json');
    await page.clock.install({ time: FROZEN_NOW });
    await app.open({ mode: 'account', seed: fixture });
    await app.expectAccountMode();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);

    const id = 'synth-full-01';
    const original: Log = fixture.logs.find((l: Log) => l.id === id);
    const ed = editor(page);
    const writesBefore = app.backend.writes.length;

    await ed.openLog(page.locator(`#tab-wk [data-edit="${id}"]`));
    await ed.setText('   ');
    await ed.save();

    // 弹窗仍然打开，提示出现，文本框获得焦点
    await ed.expectOpen();
    await expectToast(page, TOAST_EMPTY_TEXT);
    await expect(ed.text).toBeFocused();

    // 推过保存防抖：写入次数没变，弹窗仍打开，记录文字仍是 fixture 原文
    await page.clock.runFor(2_000);
    expect(app.backend.writes.length).toBe(writesBefore);
    await ed.expectOpen();
    await expect(page.locator(`#tab-wk [data-wday="${original.date}"] [data-edit="${id}"] > span`)).toHaveText(
      original.text,
    );

    // 哨兵：用合法文字保存，写入到达 mock，证明上面的窗口确实推进了防抖
    const sentinel = 'SYNTH-EDIT02 sentinel';
    await ed.setText(sentinel);
    await ed.save();
    await ed.expectClosed();
    await page.clock.runFor(2_000);
    await expect
      .poll(() => app.backend.writes.some((w) => w.data.logs.some((l: Log) => l.id === id && l.text === sentinel)), {
        message: '等待哨兵写入到达 mock',
      })
      .toBe(true);
    // 哨兵到达后，中间不能有别的写入（写入按顺序到达，多余的保存会让总数大于 +1）
    expect(app.backend.writes.length, '哨兵之前出现了多余的保存').toBe(writesBefore + 1);
  });
});
