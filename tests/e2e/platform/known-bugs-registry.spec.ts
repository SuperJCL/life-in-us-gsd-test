// 已知 bug 登记护栏（BUG-01，D-12）：每个 knownBug 编号都在 tests/KNOWN-BUGS.md 登记，
// 每行登记都有用例，表里写的每个用例标题都真实存在。
// 本文件自身不参与扫描：这里的正则和反向对照里含有同样的字面量。
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const e2eDir = path.join(repoRoot, 'tests', 'e2e');
const registryPath = path.join(repoRoot, 'tests', 'KNOWN-BUGS.md');

function idsInSources(sources: string[]): string[] {
  const ids = new Set<string>();
  const re = /knownBug\(\s*'([A-Z]+[0-9]+(?:-[a-z]+)?)'/g;
  for (const source of sources) {
    for (const m of source.matchAll(re)) ids.add(m[1]);
  }
  return [...ids];
}

// 登记表里每个以 `| <编号> |` 开头的行
function registryRows(registry: string): { id: string; line: string }[] {
  const rows: { id: string; line: string }[] = [];
  const re = /^\|\s*([A-Z]+[0-9]+(?:-[a-z]+)?)\s*\|/;
  for (const line of registry.split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) rows.push({ id: m[1], line });
  }
  return rows;
}

// 返回三类问题：spec 里有但表里没有的编号、表里有但 spec 里没有的编号、表里写了但 spec 里不存在的标题。
// 问题文字只含编号和标题（都是英文或合成文字）。
export function knownBugRegistryProblems(sources: string[], registry: string): string[] {
  const problems: string[] = [];
  const specIds = idsInSources(sources);
  const rows = registryRows(registry);
  const rowIds = rows.map((r) => r.id);

  for (const id of specIds) {
    if (!rowIds.includes(id)) problems.push(`spec 里有 ${id}，但 KNOWN-BUGS.md 没有登记`);
  }
  for (const id of rowIds) {
    if (!specIds.includes(id)) problems.push(`KNOWN-BUGS.md 登记了 ${id}，但 spec 里没有对应的 knownBug`);
  }
  for (const row of rows) {
    for (const m of row.line.matchAll(/`(BUG-[0-9]+ [^`]+)`/g)) {
      const title = m[1];
      const found = sources.some((s) => s.includes(`'${title}'`));
      if (!found) problems.push(`${row.id} 登记的标题在 spec 里不存在：${title}`);
    }
  }
  return problems;
}

function listSpecs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listSpecs(full));
    else if (name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

test('BUG-01 every known-bug test is registered in tests/KNOWN-BUGS.md and every registered title exists', () => {
  const sources = listSpecs(e2eDir)
    .filter((f) => path.resolve(f) !== path.resolve(__filename))
    .map((f) => readFileSync(f, 'utf8'));
  const registry = readFileSync(registryPath, 'utf8');

  expect(knownBugRegistryProblems(sources, registry)).toEqual([]);
  // 确实扫描到了这些编号，防止扫描路径写错而空转
  expect(idsInSources(sources)).toEqual(expect.arrayContaining(['B1', 'N1']));
});

// 常驻反向对照：证明三种缺失都会被报出。
// 构造字符串里调用 knownBug 的那一段用字符串拼接写出，避免本文件被当成真实的用例来源。
test('BUG-01 the registry check reports an unregistered id, an orphan row and a missing title', () => {
  const title = 'BUG-01 Z1 synthetic title';
  const call = (id: string) => 'know' + 'nBug(' + "'" + id + "'" + ', "x");';
  const specWith = (id: string) => "test('" + title + "', () => {});" + ' ' + call(id);
  const row = (id: string, t: string) => '| ' + id + ' | 出处 | `' + t + '` | 期望 | 现状 |';

  // 一致：没有问题（保证下面三组报出的是被构造出来的缺失，而不是检查函数一直报错）
  expect(knownBugRegistryProblems([specWith('Z1')], row('Z1', title))).toEqual([]);

  // spec 里调用了表里没有的编号
  expect(knownBugRegistryProblems([specWith('Z2')], row('Z1', title)).join(' / ')).toContain('Z2');

  // 表里登记了 spec 里没有的编号
  const orphan = row('Z1', title) + ' ' + '\n' + row('Z3', title);
  expect(knownBugRegistryProblems([specWith('Z1')], orphan).join(' / ')).toContain('Z3');

  // 表里写了 spec 里不存在的标题
  const missing = 'BUG-01 Z1 missing title';
  expect(knownBugRegistryProblems([specWith('Z1')], row('Z1', missing)).join(' / ')).toContain(missing);
});
