// 导出用例（IO-02、IO-03、MOCK-04）。
// 导出内容只在内存里比较：不写文件、不附加到报告、不进 annotation 或控制台（D-16）。
// 文件名和内容只从 app.backend.downloads（mock 的 downloads.save 记录）读取。
import { test, expect } from '../../support/test';
import { loadFixture, withoutSynthetic } from '../../support/fixture-files';
import { FILENAME_BACKUP_FROZEN, TOAST_EXPORTED } from '../../support/strings';

test('IO-03 the JSON backup of the full fixture equals the fixture without _synthetic and the seeded document', async ({
  page,
  app,
}) => {
  const fixture = loadFixture('full-state.json');
  await app.open({ mode: 'account', seed: fixture });
  await app.expectAccountMode();

  expect(app.backend.downloads).toEqual([]);

  await page.locator('#exportJson').click();
  await expect.poll(() => app.backend.downloads.length, { message: '等待 JSON 下载记录' }).toBe(1);

  const { filename, data } = app.backend.downloads[0];
  expect(filename).toBe(FILENAME_BACKUP_FROZEN);
  const backup = JSON.parse(data);

  // 备份与去掉 _synthetic 的 fixture 深度相等
  expect(backup).toEqual(withoutSynthetic(fixture));

  // D-16 的理解：还没保存时“最新文档”就是种子文档，而 normalize 会丢掉 _synthetic，
  // 所以与种子文档按去掉 _synthetic 比较；此时还没有任何写入。
  expect(app.backend.writes).toEqual([]);
  expect(backup).toEqual(withoutSynthetic(app.backend.lastState()));

  await expect(page.locator('#toast')).toHaveClass(/\bon\b/);
  await expect(page.locator('#toast')).toContainText(TOAST_EXPORTED);
});
