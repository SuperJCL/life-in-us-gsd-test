#!/usr/bin/env node
// 验收用的合成大备份生成器（Phase 13，13-08，RESEARCH A11）：零依赖，只使用 node: 内置模块。
//
// 用途：总体验收 F 项要在真实线路上存一次“接近上限的文档”。云端文档上限 4 MiB（CLOUD_MAX），
// 达到上限的 70% 会出现容量提醒；这里生成一份约 3.3 MB 的完整备份（新格式），记录全部是合成的英文。
// 所有者在电脑上用应用的“导入”选这个文件，保存成功、另一台设备能看到就算通过。
//
// 用法：
//   node deploy/make-acceptance-data.mjs --out private/acceptance   写 private/acceptance/synth-large.json
//   node deploy/make-acceptance-data.mjs --out test-results/<目录>   同上，写到被忽略的 test-results/ 下
//   node deploy/make-acceptance-data.mjs --self-test                 内存里自检，不写磁盘，最后一行 SELF-TEST OK (N cases)
//
// 内容：计划是应用里的示例计划（normalizePlan(DEFAULT_PLAN)）；记录全部以 “SYNTH-1307 ” 开头，是英文和数字，
//   类别取应用 CATS 的显示名，日期在 2026 年里均匀分布；条数按目标大小自动调整，使文件落在 3.0–3.6 MB 之间。
//   文件写成紧凑 JSON（不缩进）：缩进的写法会超过导入的 5 MB 文件上限，而且云端文档按紧凑 JSON 的字节数算大小。
//   记录、复盘、进度都不含任何真实内容；生成的文件必须被应用的 classifyBackup 认成完整备份。
//
// 输出：只打印计数和大小（字节），不打印任何记录的文字。
//
// 隐私约定：--out 只接受 private/acceptance 或 test-results/ 下的目录（两个都被 git 忽略）；输出不进仓库。
//
// 退出码：0 成功；1 生成失败；2 参数或输出目录不合法。

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evalApp } from '../tools/plan/migrate-backup.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_PATH = 'us-journey-tracker.html';
const OUT_NAME = 'synth-large.json';
const NOW = '2026-11-12T00:00:00.000Z';
const TARGET_BYTES = 3300000;
const MIN_BYTES = 3000000;
const MAX_BYTES = 3600000;
const CLOUD_MAX = 4194304;
const PREFIX = 'SYNTH-1307';
const CAT_NAMES = ['语言', '专业', '健身', '求职', '其他'];

export class UsageError extends Error {}
export class GenError extends Error {}

// ---------- 纯函数 ----------

// 固定种子的伪随机数（同一个种子永远同一串）：生成结果可重复
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu', 'record', 'entry', 'sample', 'synthetic', 'filler', 'content', 'session', 'practice', 'review', 'progress'];

// 第 i 天（0 起）落在 2026 年里的日期，均匀循环：YYYY-MM-DD
export function dateOf(i) {
  const d = new Date(Date.UTC(2026, 0, 1) + (i % 365) * 86400000);
  return d.toISOString().slice(0, 10);
}

// n 条合成记录：id、日期、类别、文字（以 SYNTH-1307 开头的英文）。同一个 n 永远同一结果
export function makeLogs(n) {
  const rnd = lcg(1307);
  const logs = [];
  for (let i = 0; i < n; i += 1) {
    const words = [];
    const count = 22 + Math.floor(rnd() * 14);
    for (let w = 0; w < count; w += 1) words.push(WORDS[Math.floor(rnd() * WORDS.length)]);
    logs.push({ id: `synth-${String(i).padStart(6, '0')}`, date: dateOf(i), cat: CAT_NAMES[i % CAT_NAMES.length], text: `${PREFIX} ${i} ${words.join(' ')}` });
  }
  return logs;
}

// 在应用纯函数段里组装完整备份：示例计划加 n 条记录。返回 { file, kind }，kind 是读回后的类别
const BUILD_EXPR = `(() => {
  const p = normalizePlan(DEFAULT_PLAN);
  if (!p || !usePlan(p)) return { ok: false };
  const st = normalize({ arrival: '2026-01-05', logs: __in.logs, reviews: {}, tasks: {}, custom: [], lifts: {}, presets: {} });
  const file = backupOf(p, st, __in.now);
  const back = classifyBackup(JSON.parse(JSON.stringify(file)));
  return { ok: true, file, kind: back === null ? null : back.kind, counts: planCounts(p) };
})()`;

export function buildFile(html, n) {
  const r = evalApp(html, { logs: makeLogs(n), now: NOW }, BUILD_EXPR);
  if (!r || r.ok !== true) throw new GenError('示例计划没有通过应用的计划校验');
  return r;
}

const sizeOfFile = (file) => Buffer.byteLength(JSON.stringify(file), 'utf8');

// 按目标大小调整条数：先用两个小样本估出“每条多少字节、固定部分多少字节”，再算 n，必要时再修正一次
export function generate(html, target = TARGET_BYTES) {
  const a = sizeOfFile(buildFile(html, 200).file);
  const b = sizeOfFile(buildFile(html, 400).file);
  const per = (b - a) / 200;
  if (!(per > 0)) throw new GenError('估算每条记录的大小失败');
  let n = Math.max(1, Math.round((target - (a - per * 200)) / per));
  let built = buildFile(html, n);
  let size = sizeOfFile(built.file);
  if (size < MIN_BYTES || size > MAX_BYTES) {
    n = Math.max(1, Math.round(n * (target / size)));
    built = buildFile(html, n);
    size = sizeOfFile(built.file);
  }
  return { file: built.file, kind: built.kind, counts: built.counts, logs: n, bytes: size };
}

// --out 的目录：先 resolve 再比较；只接受 private/acceptance（含其下）或 test-results/ 下的目录
export function outDirAllowed(dir, root = ROOT) {
  if (typeof dir !== 'string' || dir === '') return false;
  const rootAbs = resolve(root);
  const rel = relative(rootAbs, resolve(rootAbs, dir));
  if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
  const parts = rel.split(sep);
  if (parts[0] === 'test-results') return parts.length > 1;
  return parts[0] === 'private' && parts[1] === 'acceptance';
}

export function parseArgs(args) {
  const opts = { out: null, selfTest: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--self-test') opts.selfTest = true;
    else if (args[i] === '--out' && i + 1 < args.length) opts.out = args[++i];
    else throw new UsageError('参数不合法：用法见文件头');
  }
  if (opts.selfTest ? opts.out !== null : opts.out === null) throw new UsageError('参数不合法：用法见文件头');
  return opts;
}

// ---------- 自检 ----------

export function selfTest() {
  const results = [];
  const expect = (name, fn) => {
    let ok = false;
    try {
      ok = fn() === true;
    } catch {
      ok = false;
    }
    results.push([name, ok]);
  };
  const html = readFileSync(join(ROOT, APP_PATH), 'utf8');
  const g = generate(html);
  const logs = g.file.state.logs;
  expect('大小：紧凑 JSON 在 3.0–3.6 MB 之间，低于 4 MiB 上限', () => g.bytes >= MIN_BYTES && g.bytes <= MAX_BYTES && g.bytes < CLOUD_MAX);
  expect('大小：达到容量提醒的 70% 线（会出现容量提醒）', () => g.bytes >= CLOUD_MAX * 0.7);
  expect('格式：被应用的 classifyBackup 认成完整备份', () => g.kind === 'full' && g.file.kind === 'full' && g.file.format === 2);
  expect('计划：是示例计划，有组、任务和力量项', () => g.counts.groups > 0 && g.counts.tasks > 0 && g.counts.lifts > 0);
  expect('记录：条数与返回值一致，且很多', () => logs.length === g.logs && logs.length > 5000);
  expect('记录：每条文字都以 SYNTH- 开头，且只含 ASCII', () => logs.every((l) => l.text.startsWith('SYNTH-') && /^[\x20-\x7e]+$/.test(l.text)));
  expect('记录：id 互不相同且合法', () => new Set(logs.map((l) => l.id)).size === logs.length && logs.every((l) => /^[A-Za-z0-9_-]{1,64}$/.test(l.id)));
  expect('记录：类别全是应用的显示名，五个都出现', () => logs.every((l) => CAT_NAMES.includes(l.cat)) && new Set(logs.map((l) => l.cat)).size === CAT_NAMES.length);
  expect('记录：日期都在 2026 年里并且覆盖 365 天', () => logs.every((l) => /^2026-\d{2}-\d{2}$/.test(l.date)) && new Set(logs.map((l) => l.date)).size === 365);
  expect('确定性：同一个条数两次生成逐字节相同', () => JSON.stringify(makeLogs(50)) === JSON.stringify(makeLogs(50)));
  expect('确定性：dateOf 只在 2026 年内循环', () => dateOf(0) === '2026-01-01' && dateOf(364) === '2026-12-31' && dateOf(365) === '2026-01-01');
  expect('复盘、进度、自定义待办都是空的（没有任何真实内容）', () => Object.keys(g.file.state.reviews || {}).length === 0 && Object.keys(g.file.state.tasks || {}).length === 0 && (g.file.state.custom || []).length === 0);
  const root = resolve(sep, 'synth-repo');
  const ok = (d) => outDirAllowed(d, root);
  expect('输出目录：private/acceptance 和 test-results/ 下的目录接受', () => ok('private/acceptance') && ok('private/acceptance/x') && ok('test-results/13-08-acc') && ok(join(root, 'test-results', 'a', 'b')));
  expect('输出目录：别的目录、仓库根、test-results 本身、仓库外、.. 逃逸都拒绝', () => !ok('private') && !ok('private/other') && !ok('tools/x') && !ok('.') && !ok('') && !ok('test-results') && !ok(resolve(sep, 'synth-elsewhere')) && !ok('test-results/../tools') && !ok('private/acceptance/../x') && !ok(undefined));
  expect('参数：--out 或 --self-test 二选一', () => parseArgs(['--self-test']).selfTest && parseArgs(['--out', 'x']).out === 'x' && [[], ['--out'], ['--self-test', '--out', 'x'], ['--x']].every((a) => {
    try {
      parseArgs(a);
      return false;
    } catch {
      return true;
    }
  }));

  const failed = results.filter(([, passed]) => !passed);
  for (const [name] of failed) process.stdout.write(`自检失败：${name}\n`);
  process.stdout.write(failed.length === 0 ? `SELF-TEST OK (${results.length} cases)\n` : `SELF-TEST FAIL (${failed.length} of ${results.length})\n`);
  return failed.length === 0 ? 0 : 1;
}

// ---------- CLI ----------

function run(opts) {
  if (!outDirAllowed(opts.out)) throw new UsageError('输出目录只能是 private/acceptance 或 test-results/ 下的目录');
  const rel = relative(ROOT, resolve(opts.out)).split(sep).join('/');
  if (rel.startsWith('private/')) {
    try {
      execFileSync('git', ['check-ignore', '-q', rel], { cwd: ROOT, stdio: 'ignore' });
    } catch {
      throw new UsageError('输出目录没有被 git 忽略，拒绝写入');
    }
  }
  const g = generate(readFileSync(join(ROOT, APP_PATH), 'utf8'));
  if (g.kind !== 'full' || g.bytes < MIN_BYTES || g.bytes > MAX_BYTES) throw new GenError('生成的文件没有通过读回或大小校验');
  const dir = resolve(ROOT, rel);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, OUT_NAME), JSON.stringify(g.file), 'utf8');
  process.stdout.write(`ACCEPTANCE DATA OK logs=${g.logs} bytes=${g.bytes}\n`);
  return 0;
}

export function main(args) {
  let opts;
  try {
    opts = parseArgs(args);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }
  if (opts.selfTest) return selfTest();
  try {
    return run(opts);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    process.stderr.write(`${err instanceof GenError ? err.message : '生成失败（已隐去详情）'}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
