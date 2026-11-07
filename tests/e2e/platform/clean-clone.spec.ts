// 干净克隆用例（SEC-04）。
// 证明两件事：去个人化的应用在仓库里（被 git 跟踪、固定 LF），私有文件（种子和原件副本）不在；
// 不带任何服务器配置打开页面时，看到的是示例计划和空记录。
// 07-04 的 Task 3 还会在一次性的干净克隆里把完整套件跑一遍，这两条用例随之在克隆里再证明一次。
// 只读计数、id 和固定文案，不读示例计划的文字（D-05）。
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { gotoGoals, readGroups, readLifts } from '../../support/goals';
import { TIMELINE_EMPTY } from '../../support/strings';
import { ALL_LIFT_IDS, BUILTIN_GROUP_SIZES } from '../../support/task-ids';
import { APP_FILE_NAME } from '../../support/constants';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

// git check-ignore -q：退出码 0 表示被忽略，1 表示没有被忽略，其他情况是真正的错误（文件不存在时也能判断）
function isIgnored(p: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '-q', p], { cwd: repoRoot, stdio: 'ignore' });
    return true;
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 1) return false;
    throw error;
  }
}

test('SEC-04 the de-personalized app is tracked with LF line endings and its private copies stay out of git', async () => {
  // 应用文件被 git 跟踪：不在暂存区或提交里时 --error-unmatch 会以非零退出
  expect(() => git('ls-files', '--error-unmatch', APP_FILE_NAME), '应用文件应当被 git 跟踪').not.toThrow();
  expect(git('check-attr', 'eol', '--', APP_FILE_NAME).trim(), '应用文件应当固定为 LF').toMatch(/eol: lf$/);

  // 私有文件从不被跟踪，种子和原件副本都被忽略
  expect(git('ls-files', 'private').trim(), 'private/ 下不应有被跟踪的文件').toBe('');
  expect(isIgnored('private/plan-seed.json'), '种子应当被忽略').toBe(true);
  expect(isIgnored('private/us-journey-tracker.original.html'), '原件副本应当被忽略').toBe(true);
});

test('SEC-04 a fresh start without any server shows the sample plan and no records', async ({ page, app }) => {
  await app.open();

  // 本地模式：页面上没有 Claude 运行时
  expect(await page.evaluate(() => 'claude' in window), '本地模式下页面上不应有 window.claude').toBe(false);

  // 空记录：本周、日历、时间线都没有条目
  await expect(page.locator('#days .ent')).toHaveCount(0);
  await expect(page.locator('#grid .chip')).toHaveCount(0);
  expect(
    await page.evaluate(() => document.querySelector('#timeline .empty')?.textContent ?? null),
    '时间线应当显示空状态文案',
  ).toBe(TIMELINE_EMPTY);

  // 示例计划：7 个目标组，每组 0/总数，进度条为 0；4 张力量卡
  await gotoGoals(page);
  const groups = await readGroups(page);
  const codes = Object.keys(BUILTIN_GROUP_SIZES);
  expect(groups.map((g) => g.code), '目标页的组号应当依次是 P1 到 P7').toEqual(codes);
  for (const g of groups) {
    const size = BUILTIN_GROUP_SIZES[g.code as keyof typeof BUILTIN_GROUP_SIZES];
    expect(g.cnt.startsWith('0/'), `组 ${g.code} 的计数应当以 0/ 开头`).toBe(true);
    expect(g.cnt, `组 ${g.code} 的计数应当是 0/ 加任务个数`).toContain(`0/${size}`);
    expect(g.barPct, `组 ${g.code} 的进度条应当是 0`).toBe(0);
  }
  const lifts = await readLifts(page, ALL_LIFT_IDS);
  expect(lifts.count, '力量卡应当恰好 4 张').toBe(4);

  // 打开页面本身不写存储
  expect(await app.persisted()).toBeNull();
});
