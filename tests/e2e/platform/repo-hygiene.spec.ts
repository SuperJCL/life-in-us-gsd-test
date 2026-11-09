import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { SYNTHETIC_MARKER } from '../../support/constants';

const repoRoot = path.resolve(__dirname, '..', '..', '..');

// git check-ignore -q：退出码 0 表示被忽略，1 表示没有被忽略，其他情况是真正的错误
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

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

// 返回目录下没有带合成标记的文件（相对路径，分隔符统一为 /）。
// .json 且能解析成普通对象：要求顶层 _synthetic 是非空字符串；
// JSON 解析失败或不是 .json：要求文本里含 _synthetic 字面量（这样畸形导入文件也能带标记）
export function findUnmarkedFixtures(dir: string): string[] {
  const unmarked: string[] = [];
  for (const file of listFiles(dir)) {
    const text = readFileSync(file, 'utf8');
    let marked = text.includes(SYNTHETIC_MARKER);
    if (path.extname(file).toLowerCase() === '.json') {
      try {
        const parsed: unknown = JSON.parse(text);
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const value = (parsed as Record<string, unknown>)[SYNTHETIC_MARKER];
          marked = typeof value === 'string' && value.length > 0;
        }
      } catch (e) {
        // 解析失败：沿用上面的字面量判断
      }
    }
    if (!marked) unmarked.push(path.relative(dir, file).split(path.sep).join('/'));
  }
  return unmarked;
}

test('SAFE-03 .gitignore ignores test artifacts and backup-style JSON', async () => {
  const mustBeIgnored = [
    'test-results/sample.png',
    'playwright-report/index.html',
    'blob-report/report.zip',
    'node_modules/pkg/index.js',
    'x备份y.json',
    '在美国的日子-备份-2026-03-18.json',
    '在美国的日子-日历.csv',
    '在美国的日子-留底-2026-03-18.json',
    '在美国的日子-计划留底-2026-03-18.json',
    '计划手记-备份-2026-03-18.json',
    '计划手记-日历.csv',
    '计划手记-留底-2026-03-18.json',
    '计划手记-计划留底-2026-03-18.json',
    'private/plan-seed.json',
    'private/us-journey-tracker.original.html',
    'us-journey-tracker.original.html',
  ];
  for (const p of mustBeIgnored) {
    expect(isIgnored(p), `${p} 应该被 .gitignore 忽略`).toBe(true);
  }

  // 对照：这些路径不能被忽略，证明检查不是空转（应用文件自 Phase 7 起在仓库里）
  for (const p of ['tests/e2e/smoke.spec.ts', 'tests/fixtures/local-seed.json', 'us-journey-tracker.html', 'docs/计划手记-说明.md']) {
    expect(isIgnored(p), `${p} 不应该被 .gitignore 忽略`).toBe(false);
  }
});

test('SAFE-03 every file under tests/fixtures carries the _synthetic marker', async () => {
  const fixturesDir = path.join(repoRoot, 'tests', 'fixtures');
  expect(listFiles(fixturesDir).length).toBeGreaterThanOrEqual(1);
  expect(findUnmarkedFixtures(fixturesDir)).toEqual([]);
});

test('SAFE-03 the marker check reports a fixture without the marker', async ({}, testInfo) => {
  const dir = testInfo.outputPath('marker-check');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'marked.json'), JSON.stringify({ [SYNTHETIC_MARKER]: '合成数据', logs: [] }));
  writeFileSync(path.join(dir, 'unmarked.json'), '{"logs":[]}');
  writeFileSync(path.join(dir, 'notes.txt'), 'no marker here');
  writeFileSync(path.join(dir, 'broken.json'), `not json ${SYNTHETIC_MARKER}`);

  expect(findUnmarkedFixtures(dir).sort()).toEqual(['notes.txt', 'unmarked.json']);
});
