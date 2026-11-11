#!/usr/bin/env node
// 迁移脚本（IO-09、D-06、D-07）：把种子计划和原 Artifact 的旧备份合成一个新格式的完整备份，
// 所有者再在应用里一次导入。零依赖，只使用 node: 内置模块。
//
// 模式：
//   node tools/plan/migrate-backup.mjs <旧备份.json>   默认：读 private/plan-seed.json 和命令行给出的旧备份，
//                                                      写 private/ 下的迁移文件（完整备份格式）
//   node tools/plan/migrate-backup.mjs --plan-only     只读种子，写 private/ 下只含计划的文件（D-03 的两步做法）
//   node tools/plan/migrate-backup.mjs --demo [目录]   不读任何私有文件，用合成输入写四个合成文件
//   node tools/plan/migrate-backup.mjs --self-test     内存里的合成数据自检，不读 private/
//
// 隐私约定：
//   - 默认模式和 --plan-only 只读种子和命令行给出的旧备份，只写 private/（被 git 忽略），写之前先用 git check-ignore 确认；
//     输出文件名是 private/计划手记-迁移-<日期>.json 和 private/计划手记-计划-<日期>.json。
//   - --demo 不读任何私有文件，只写合成文件：仓库内只接受 private/、test-results/ 下的目录（两个都被忽略），仓库外的目录也可以；
//     目录默认 private/migration-demo。
//   - 只打印计数、校验结果和固定文案，从不打印计划或记录的原文；解析失败的报错也不带文件内容。
//   - Claude 不对真实数据运行这个脚本；真实运行由所有者在 Phase 13 于本机完成（D-06）。
//   - 本文件和自检数据里不写任何个人文字，演示文字一律是 SYNTH- 开头的英文和数字。
//
// 合成逻辑全部复用应用纯函数段（usePlan、classifyBackup、legacyShape、importProblem、importPreview、backupOf、
// backupCounts、planCounts），所以校验、id 合法性和文件格式与应用的导入导出一致。
//
// node:vm 求值的前提：输入是所有者自己的本机文件，不是不可信输入；只求值两个标记之间的常量和纯函数，
// 新的空上下文、5 秒超时。vm 不是安全边界。
//
// 退出码：0 通过；1 拒绝或出错。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { APP_FILE, SEED_FILE, parseSeedJson, pureSection } from './extract-plan.mjs';

// ---------- 报错：只有 SafeError 的文字会被打印 ----------

// 脚本自己写的固定文案，或 parseSeedJson 的脱敏文案；其他任何错误（vm 里的、文件系统的）顶层都只打印固定文字
export class SafeError extends Error {}

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function safeParse(text, label) {
  try {
    return parseSeedJson(text, label);
  } catch (err) {
    throw new SafeError(err instanceof Error ? err.message : `${label} JSON 解析失败（已隐去内容）`);
  }
}

// ---------- 在 vm 里调用应用纯函数段 ----------

// 切出纯函数段，在新的 vm 上下文里求值；上下文只带一个字符串（输入的 JSON 文本），expr 在 vm 里把它解析成 __in。
// 结果做 JSON 往返取出。vm 里的报错不透传（消息里可能带出输入里的名字）。
export function evalApp(html, input, expr) {
  let section;
  try {
    section = pureSection(html);
  } catch (err) {
    throw new SafeError(err instanceof Error ? err.message : '应用纯函数段切分失败');
  }
  const source = `${section}\n;(() => { const __in = JSON.parse(INPUT); return (${expr}); })()`;
  let value;
  try {
    value = vm.runInNewContext(source, { INPUT: JSON.stringify(input) }, { timeout: 5000 });
  } catch {
    throw new SafeError('应用纯函数段求值失败（已隐去详情）');
  }
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

// ---------- 合成 ----------

// vm 里执行：先 usePlan(种子计划)，再按旧备份的类别给出固定原因。__in = { plan, legacy, now }
const COMPOSE_EXPR = `(() => {
  const { plan: seedPlan, legacy, now } = __in;
  if (!usePlan(seedPlan)) return { ok: false, reason: 'seed-plan' };
  keepOrphans = false;
  const k = classifyBackup(legacy);
  if (k === null) {
    if (isObj(legacy) && Object.prototype.hasOwnProperty.call(legacy, 'format')) return { ok: false, reason: 'already-new' };
    if (legacyShape(legacy)) {
      const problem = importProblem(legacy);
      if (problem !== null) return { ok: false, reason: 'problem:' + problem };
    }
    return { ok: false, reason: 'not-backup' };
  }
  if (k.kind !== 'legacy') return { ok: false, reason: 'already-new' };
  const pv = importPreview(k, state);
  const file = backupOf(plan, pv.state, now);
  const back = classifyBackup(JSON.parse(JSON.stringify(file)));
  if (back === null || back.kind !== 'full') return { ok: false, reason: 'roundtrip' };
  return { ok: true, file, counts: { ...backupCounts(pv.state), orphans: pv.orphans, orphanCustom: pv.orphanCustom, ...planCounts(plan) } };
})()`;

// vm 里执行：只含计划的文件。__in = { plan, now }
const PLAN_ONLY_EXPR = `(() => {
  const { plan: seedPlan, now } = __in;
  if (!usePlan(seedPlan)) return { ok: false, reason: 'seed-plan' };
  const file = backupOf(plan, null, now);
  const back = classifyBackup(JSON.parse(JSON.stringify(file)));
  if (back === null || back.kind !== 'plan') return { ok: false, reason: 'roundtrip' };
  return { ok: true, file, counts: planCounts(plan) };
})()`;

function seedPlanOf(seedText) {
  const seed = safeParse(seedText, '种子');
  return isPlain(seed) && isPlain(seed.plan) ? seed.plan : null;
}

// 成功：{ ok: true, file, counts }，file 与应用导出的完整备份同格式；失败：{ ok: false, reason }，不含 file
// reason：seed-shape、seed-plan、already-new、not-backup、problem:<字段名>、roundtrip
export function composeMigration(html, seedText, legacyText, now) {
  const seedPlan = seedPlanOf(seedText);
  const legacy = safeParse(legacyText, '旧备份');
  if (seedPlan === null) return { ok: false, reason: 'seed-shape' };
  return evalApp(html, { plan: seedPlan, legacy, now }, COMPOSE_EXPR);
}

// 只含计划的文件：没有记录
export function composePlanOnly(html, seedText, now) {
  const seedPlan = seedPlanOf(seedText);
  if (seedPlan === null) return { ok: false, reason: 'seed-shape' };
  return evalApp(html, { plan: seedPlan, now }, PLAN_ONLY_EXPR);
}

// ---------- 输出：只有计数和固定文案 ----------

export const REASON_LINES = {
  'seed-shape': '种子文件格式不对：缺少 plan 对象',
  'seed-plan': '种子里的计划没有通过应用的计划校验',
  'already-new': '这个文件已经是新格式，不需要迁移',
  'not-backup': '这个文件不是原 Artifact 的旧备份：认不出任何已知字段，或者字段类型不对',
  roundtrip: '合成出的文件没有通过读回校验，已停止，没有写任何文件',
};

export const PROBLEM_FIELDS = {
  log: '记录（log）',
  custom: '自定义待办（custom）',
  task: '任务进度（task）',
  lift: '力量记录（lift）',
  review: '复盘（review）',
  arrival: '开始日期（arrival）',
};

// 成功时：记录与其他计数、计划计数、对不上计划的进度条数、输出路径（outPath 由调用方传入）、MIGRATION OK；
// 失败时只有原因对应的固定说明。任何一行都不含计划或记录的文字，也不含日期范围。
export function reportLines(result, outPath) {
  if (!result || result.ok !== true) {
    const reason = result && typeof result.reason === 'string' ? result.reason : '';
    if (reason.startsWith('problem:')) {
      const field = PROBLEM_FIELDS[reason.slice('problem:'.length)];
      return [`旧备份没有通过导入检查：${field ?? '未知字段'}`];
    }
    return [Object.prototype.hasOwnProperty.call(REASON_LINES, reason) ? REASON_LINES[reason] : '迁移失败：未知原因'];
  }
  const c = result.counts;
  const out = [];
  if (c.logs !== undefined) out.push(`记录 ${c.logs} 条、复盘 ${c.reviews} 周、完成的任务 ${c.done} 项、力量记录 ${c.liftEntries} 条`);
  out.push(`计划 ${c.groups} 组、${c.tasks} 项任务、${c.lifts} 个力量项`);
  if (c.orphans !== undefined) out.push(`对不上计划的任务进度 ${c.orphans} 条（已丢弃，先导入计划再导一次可以找回）`);
  if (c.orphanCustom !== undefined) out.push(`目标组不在计划里的自定义待办 ${c.orphanCustom} 条（保留在记录里，导入后目标页看不到）`);
  if (typeof outPath === 'string') out.push(`已写入 ${outPath}`);
  out.push('MIGRATION OK');
  return out;
}

// ---------- 合成的演示输入 ----------

// 种子计划和旧备份都是合成的：文字一律 SYNTH- 开头（类别名是应用里已有的类别名）。旧备份里有一个旧类别名、一条 P9-1 孤儿进度。
export function demoInputs() {
  const seed = {
    _seed: 'synthetic-demo',
    v: 1,
    plan: {
      v: 1,
      presets: { lang: ['SYNTH-preset-a', 'SYNTH-preset-b'], fit: ['SYNTH-preset-c'] },
      groups: [
        { id: 'P1', cat: '语言', name: 'SYNTH-group-1', tasks: [{ id: 'P1-1', text: 'SYNTH-task-1-1' }, { id: 'P1-2', text: 'SYNTH-task-1-2' }] },
        { id: 'P2', cat: '健身', name: 'SYNTH-group-2', note: 'SYNTH-group-note', tasks: [{ id: 'P2-1', text: 'SYNTH-task-2-1' }, { id: 'P2-2', text: 'SYNTH-task-2-2' }] },
      ],
      lifts: [{ id: 'bench', n: 'SYNTH-lift-1', unit: 'kg', def: 40, target: 80, note: 'SYNTH-lift-note' }],
      fitGoal: [2, 4],
      fitNote: 'SYNTH-fit-note',
    },
  };
  const legacy = {
    arrival: '2026-01-05',
    logs: [
      { id: 'synth-log-1', date: '2026-01-06', cat: '学习', text: 'SYNTH-log-one' },
      { id: 'synth-log-2', date: '2026-01-07', cat: '语言', text: 'SYNTH-log-two' },
      { id: 'synth-log-3', date: '2026-01-13', cat: '生活', text: 'SYNTH-log-three' },
    ],
    reviews: { '2026-01-05': 'SYNTH-review-a', '2026-01-12': 'SYNTH-review-b' },
    tasks: {
      'P1-1': { done: true, doneDate: '2026-01-08' },
      'P2-1': { due: '2026-02-01' },
      'c-synthcustom': { done: true, doneDate: '2026-01-09' },
      'P9-1': { done: true, doneDate: '2026-01-10' },
    },
    custom: [{ id: 'c-synthcustom', group: 'P2', text: 'SYNTH-custom-todo' }],
    lifts: { bench: { cur: 55, hist: [{ date: '2026-01-08', v: 50 }, { date: '2026-01-15', v: 55 }] } },
    presets: { lang: { add: ['SYNTH-preset-add'], hide: ['SYNTH-preset-a'] } },
  };
  return { seed, legacy };
}

// ---------- 输出位置 ----------

export const DEMO_DEFAULT_DIR = 'private/migration-demo';
const DEMO_REPO_DIRS = ['private', 'test-results'];
const OUTPUT_PREFIX = { migration: '计划手记-迁移-', plan: '计划手记-计划-' };

// 读真实输入的两种模式只写这里：返回值永远在 private/ 下；ymd 必须是 YYYY-MM-DD，防止路径写法跑出 private/
export function outputPath(kind, ymd) {
  if (!Object.prototype.hasOwnProperty.call(OUTPUT_PREFIX, kind)) throw new SafeError('输出种类不对');
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new SafeError('输出文件的日期格式不对');
  return `private/${OUTPUT_PREFIX[kind]}${ymd}.json`;
}

// --demo 的目录：路径先 resolve 再比较（test-results/../tools 这类写法不能绕过）；
// 仓库内只接受 private/、test-results/ 下的路径（区分大小写，更严）；仓库根目录本身和其他仓库内目录拒绝；仓库外的目录接受
export function demoDirAllowed(dir, root) {
  if (typeof dir !== 'string' || dir === '') return false;
  const rootAbs = resolve(root);
  const rel = relative(rootAbs, resolve(rootAbs, dir));
  if (rel === '') return false;
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return true;
  return DEMO_REPO_DIRS.includes(rel.split(sep)[0]);
}

// 只认这四种命令行写法，其余返回 null（打印用法、退出码 1）
export function parseArgs(args) {
  const [a, b] = args;
  if (a === '--self-test' && args.length === 1) return { mode: 'self-test' };
  if (a === '--plan-only' && args.length === 1) return { mode: 'plan-only' };
  if (a === '--demo' && args.length <= 2 && !(b ?? '').startsWith('--')) return { mode: 'demo', dir: b };
  if (a !== undefined && !a.startsWith('--') && args.length === 1) return { mode: 'migrate', legacyPath: a };
  return null;
}

// ---------- 模式：默认、--plan-only、--demo ----------

const USAGE = '用法：node tools/plan/migrate-backup.mjs <旧备份.json> | --plan-only | --demo [目录] | --self-test\n';

function localYmd(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ignoredByGit(path) {
  try {
    execFileSync('git', ['check-ignore', '-q', path], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 报错里不带路径：真实文件的路径可能带本机用户名
function readInput(path, missing) {
  if (!existsSync(path)) throw new SafeError(missing);
  try {
    return readFileSync(path, 'utf8');
  } catch {
    throw new SafeError('读取输入文件失败');
  }
}

function writeJson(path, value) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  } catch {
    throw new SafeError('写输出文件失败');
  }
}

function seedText() {
  return readInput(SEED_FILE, `找不到 ${SEED_FILE}：请先运行 node tools/plan/extract-plan.mjs 生成种子`);
}

function reject(result) {
  process.stderr.write(`${reportLines(result).join('\n')}\n`);
  return 1;
}

// 默认模式：种子 + 旧备份 → private/ 下的迁移文件
function runMigrate(legacyPath) {
  const out = outputPath('migration', localYmd());
  if (!ignoredByGit(out)) {
    process.stderr.write('private/ 没有被 git 忽略，已停止\n');
    return 1;
  }
  const html = readInput(APP_FILE, `找不到 ${APP_FILE}`);
  const seed = seedText();
  const legacy = readInput(legacyPath, '找不到旧备份文件');
  const result = composeMigration(html, seed, legacy, new Date().toISOString());
  if (!result.ok) return reject(result);
  writeJson(out, result.file);
  process.stdout.write(`${reportLines(result, out).join('\n')}\n`);
  return 0;
}

// --plan-only：只读种子 → private/ 下只含计划的文件
function runPlanOnly() {
  const out = outputPath('plan', localYmd());
  if (!ignoredByGit(out)) {
    process.stderr.write('private/ 没有被 git 忽略，已停止\n');
    return 1;
  }
  const html = readInput(APP_FILE, `找不到 ${APP_FILE}`);
  const result = composePlanOnly(html, seedText(), new Date().toISOString());
  if (!result.ok) return reject(result);
  writeJson(out, result.file);
  process.stdout.write(`${reportLines(result, out).join('\n')}\n`);
  return 0;
}

// --demo：不读任何私有文件，只用合成输入写四个合成文件
function runDemo(dirArg, root) {
  const dirInput = dirArg ?? DEMO_DEFAULT_DIR;
  if (!demoDirAllowed(dirInput, root)) {
    process.stderr.write('演示目录不允许：仓库内只接受 private/、test-results/ 下的路径，或仓库外的路径\n');
    return 1;
  }
  const dir = resolve(root, dirInput);
  const shown = dirInput.replace(/\\/g, '/').replace(/\/+$/, '');
  const html = readInput(join(root, APP_FILE), `找不到 ${APP_FILE}`);
  const { seed, legacy } = demoInputs();
  const now = new Date().toISOString();
  const migrated = composeMigration(html, JSON.stringify(seed), JSON.stringify(legacy), now);
  if (!migrated.ok) return reject(migrated);
  const planOnly = composePlanOnly(html, JSON.stringify(seed), now);
  if (!planOnly.ok) return reject(planOnly);
  writeJson(join(dir, 'synth-legacy-backup.json'), legacy);
  writeJson(join(dir, 'synth-plan-seed.json'), seed);
  writeJson(join(dir, 'synth-migrated.json'), migrated.file);
  writeJson(join(dir, 'synth-plan-only.json'), planOnly.file);
  const lines = [...reportLines(migrated, `${shown}/synth-migrated.json`).slice(0, -1), '只含计划的文件：', ...reportLines(planOnly, `${shown}/synth-plan-only.json`)];
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

// ---------- 模式：--self-test ----------

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

const SELF_NOW = '2026-03-18T12:00:00.000Z';

function runSelfTest() {
  const failures = [];
  let total = 0;
  const expect = (name, ok) => {
    total += 1;
    if (!ok) failures.push(name);
  };
  const json = (v) => JSON.stringify(v);
  const thrown = (fn) => {
    try {
      fn();
      return null;
    } catch (err) {
      return err;
    }
  };
  const html = readFileSync(join(repoRoot(), APP_FILE), 'utf8');
  const { seed, legacy } = demoInputs();
  const seedText = json(seed);
  const legacyText = json(legacy);
  const strings = [];
  const walk = (v) => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => (strings.push(k), walk(x)));
  };
  walk(seed);
  walk(legacy);
  const demoText = [...new Set(strings.filter((s) => s.startsWith('SYNTH-') || /^\d{4}-\d{2}-\d{2}$/.test(s)))];
  const leaks = (lines) => demoText.some((s) => lines.join('\n').includes(s));

  // evalApp
  expect('evalApp：输入在 vm 里解析成 __in', evalApp(html, { a: 2 }, '__in.a + 1') === 3);
  expect('evalApp：应用的纯函数可用', evalApp(html, 'P1-1', '/^(P\\d{1,3}-\\d{1,3})$/.test(__in)') === true);
  const badHtml = thrown(() => evalApp(html.replace('/* ---------- saving ---------- */', ''), {}, '1'));
  expect('evalApp：切段失败是 SafeError', badHtml instanceof SafeError);
  const vmFail = thrown(() => evalApp(html, {}, 'null.x'));
  expect('evalApp：vm 里的报错不透传', vmFail instanceof SafeError && vmFail.message === '应用纯函数段求值失败（已隐去详情）');

  // composeMigration：成功
  const ok = composeMigration(html, seedText, legacyText, SELF_NOW);
  expect('composeMigration：演示输入合成成功', ok.ok === true && isPlain(ok.file) && isPlain(ok.counts));
  const file = ok.file;
  expect('文件：键序和格式取值与应用导出相同', json(Object.keys(file)) === json(['app', 'format', 'kind', 'exportedAt', 'plan', 'state']) && file.app === 'us-journey-tracker' && file.format === 2 && file.kind === 'full' && file.exportedAt === SELF_NOW);
  expect('文件：经应用的 classifyBackup 读回是完整备份', evalApp(html, JSON.parse(json(file)), 'classifyBackup(__in).kind') === 'full');
  expect('文件：计划是规范化后的种子计划', json(file.plan.groups.map((g) => g.id)) === json(['P1', 'P2']) && file.plan.lifts[0].id === 'bench' && file.plan.groups[1].note === 'SYNTH-group-note');
  expect('计数：等于手算（记录、复盘、完成、力量记录）', ok.counts.logs === 3 && ok.counts.reviews === 2 && ok.counts.done === 2 && ok.counts.liftEntries === 2);
  expect('计数：计划的组数、任务数、力量项数', ok.counts.groups === 2 && ok.counts.tasks === 4 && ok.counts.lifts === 1);
  expect('计数：对不上计划的进度 1 条（D-07）', ok.counts.orphans === 1);
  expect('计数：目标组不在计划里的自定义待办 0 条（WR-01）', ok.counts.orphanCustom === 0);
  const orphanCustomRun = composeMigration(html, seedText, json({ ...legacy, custom: [...legacy.custom, { id: 'c-synthlost', group: 'P7', text: 'SYNTH-lost-todo' }] }), SELF_NOW);
  expect('计数：目标组 P7 不在种子计划里的自定义待办 1 条，仍保留在输出里（WR-01）', orphanCustomRun.ok === true && orphanCustomRun.counts.orphanCustom === 1 && orphanCustomRun.file.state.custom.length === 2);
  expect('报告：多一行自定义待办的计数，不含待办文字（WR-01）', reportLines(orphanCustomRun, undefined).some((l) => l.includes('目标组不在计划里的自定义待办 1 条')) && !reportLines(orphanCustomRun, undefined).join('|').includes('SYNTH'));
  expect('孤儿进度：输出的 tasks 里没有 P9-1，其余保留', !('P9-1' in file.state.tasks) && 'P1-1' in file.state.tasks && 'P2-1' in file.state.tasks && 'c-synthcustom' in file.state.tasks);
  expect('进度：完成状态、日期和截止日期保持', file.state.tasks['P1-1'].done === true && file.state.tasks['P1-1'].doneDate === '2026-01-08' && file.state.tasks['P2-1'].due === '2026-02-01');
  expect('类别：旧类别名换成新类别名', json(file.state.logs.map((l) => l.cat)) === json(['专业', '语言', '其他']));
  expect('记录 id：与输入相同且合法', json(file.state.logs.map((l) => l.id)) === json(['synth-log-1', 'synth-log-2', 'synth-log-3']) && file.state.logs.every((l) => /^[A-Za-z0-9_-]{1,64}$/.test(l.id)));
  expect('其余字段：开始日期、自定义待办、力量、预设', file.state.arrival === '2026-01-05' && file.state.custom.length === 1 && file.state.lifts.bench.cur === 55 && file.state.presets.lang.add[0] === 'SYNTH-preset-add');
  expect('合成：同一输入两次结果相同（不读时钟、不随机）', json(composeMigration(html, seedText, legacyText, SELF_NOW)) === json(ok));
  expect('合成：输出里没有账号标识', !/@|email|token/i.test(json(Object.keys(file)) + json(Object.keys(file.state))));

  // composeMigration：拒绝
  const withLegacy = (patch) => composeMigration(html, seedText, json({ ...legacy, ...patch }), SELF_NOW);
  const rejected = (r, reason) => r.ok === false && r.reason === reason && !('file' in r) && !('counts' in r);
  expect('拒绝：旧备份是 {}', rejected(composeMigration(html, seedText, '{}', SELF_NOW), 'not-backup'));
  expect('拒绝：旧备份是数组、字符串、数字、null', ['[]', '"x"', '12', 'null'].every((t) => rejected(composeMigration(html, seedText, t, SELF_NOW), 'not-backup')));
  expect('拒绝：已经是新格式的完整备份', rejected(composeMigration(html, seedText, json(file), SELF_NOW), 'already-new'));
  expect('拒绝：已经是新格式的只含计划的文件', rejected(composeMigration(html, seedText, json({ app: 'us-journey-tracker', format: 2, kind: 'plan', plan: file.plan }), SELF_NOW), 'already-new'));
  expect('拒绝：带格式标识键但包装不合格也算新格式', rejected(composeMigration(html, seedText, json({ format: 9, logs: [] }), SELF_NOW), 'already-new'));
  expect('拒绝：记录 id 带引号（log）', rejected(withLegacy({ logs: [{ id: 'bad"id', date: '2026-01-06', cat: '语言', text: 'SYNTH-x' }] }), 'problem:log'));
  expect('拒绝：记录日期不是真实日期（log）', rejected(withLegacy({ logs: [{ id: 'synth-log-1', date: '2026-02-31', cat: '语言', text: 'SYNTH-x' }] }), 'problem:log'));
  expect('拒绝：自定义待办 id 不合格（custom）', rejected(withLegacy({ custom: [{ id: 'c-bad"x', group: 'P2', text: 'SYNTH-x' }] }), 'problem:custom'));
  expect('拒绝：进度键不合格（task）', rejected(withLegacy({ tasks: { 'bad key': { done: true } } }), 'problem:task'));
  expect('拒绝：力量键不合格（lift）', rejected(withLegacy({ lifts: { BAD: { cur: 1 } } }), 'problem:lift'));
  expect('拒绝：复盘周键不合格（review）', rejected(withLegacy({ reviews: { 'not-a-date': 'SYNTH-x' } }), 'problem:review'));
  expect('拒绝：开始日期不合格（arrival）', rejected(withLegacy({ arrival: '2026-13-01' }), 'problem:arrival'));
  expect('拒绝：种子不是带 plan 对象的普通对象', ['[]', 'null', '{}', '{"plan":1}', '{"plan":[]}', '{"plan":null}'].every((t) => rejected(composeMigration(html, t, legacyText, SELF_NOW), 'seed-shape')));
  expect('拒绝：种子的计划不合格（空组数）', rejected(composeMigration(html, json({ ...seed, plan: { ...seed.plan, groups: [] } }), legacyText, SELF_NOW), 'seed-plan'));
  expect('拒绝：种子的计划不合格（任务 id 不合格）', rejected(composeMigration(html, json({ ...seed, plan: { ...seed.plan, groups: [{ id: 'P1', cat: '语言', name: 'SYNTH-g', tasks: [{ id: 'bad', text: 'SYNTH-t' }] }] } }), legacyText, SELF_NOW), 'seed-plan'));

  // composePlanOnly
  const po = composePlanOnly(html, seedText, SELF_NOW);
  expect('composePlanOnly：只含计划的文件，没有记录', po.ok === true && json(Object.keys(po.file)) === json(['app', 'format', 'kind', 'exportedAt', 'plan']) && po.file.kind === 'plan' && !('state' in po.file));
  expect('composePlanOnly：经应用读回是只含计划的文件，计数是计划的规模', evalApp(html, JSON.parse(json(po.file)), 'classifyBackup(__in).kind') === 'plan' && json(po.counts) === json({ groups: 2, tasks: 4, lifts: 1 }));
  expect('composePlanOnly：计划与合成文件里的计划相同', json(po.file.plan) === json(file.plan));
  expect('composePlanOnly：种子形状和计划不合格被拒绝', rejected(composePlanOnly(html, '{}', SELF_NOW), 'seed-shape') && rejected(composePlanOnly(html, json({ plan: { groups: [] } }), SELF_NOW), 'seed-plan'));

  // 不泄露
  const leakMarker = 'SYNTH-LEAK' + '-MARKER';
  const seedErr = thrown(() => composeMigration(html, `{"plan":{"a":"${leakMarker}" x}}`, legacyText, SELF_NOW));
  const legacyErr = thrown(() => composeMigration(html, seedText, `{"logs":[{"text":"${leakMarker}" x}]}`, SELF_NOW));
  const planErr = thrown(() => composePlanOnly(html, `${leakMarker}{`, SELF_NOW));
  expect('不泄露：解析失败的报错是固定文案、不含输入里的文字', [seedErr, legacyErr, planErr].every((e) => e instanceof SafeError && e.message.includes('JSON 解析失败') && !e.message.includes(leakMarker) && !e.message.includes('SYNTH')));
  expect('不泄露：报错标明是种子还是旧备份', seedErr.message.startsWith('种子 ') && legacyErr.message.startsWith('旧备份 '));
  const okLines = reportLines(ok, 'private/synth-out.json');
  expect('reportLines：成功时的行数和结尾', okLines.length === 6 && okLines.at(-1) === 'MIGRATION OK' && okLines[0] === '记录 3 条、复盘 2 周、完成的任务 2 项、力量记录 2 条' && okLines[1] === '计划 2 组、4 项任务、1 个力量项' && okLines[2].startsWith('对不上计划的任务进度 1 条') && okLines[3] === '目标组不在计划里的自定义待办 0 条（保留在记录里，导入后目标页看不到）' && okLines[4] === '已写入 private/synth-out.json');
  expect('reportLines：不含演示数据里的任何文字和日期范围', !leaks(okLines) && !okLines.join('\n').includes('2026-01') && demoText.length > 20);
  const failLines = ['seed-shape', 'seed-plan', 'already-new', 'not-backup', 'roundtrip', 'problem:log', 'problem:custom', 'problem:task', 'problem:lift', 'problem:review', 'problem:arrival', 'problem:weird', 'nonsense'].map((reason) => reportLines({ ok: false, reason }));
  expect('reportLines：失败时一行固定说明、没有 MIGRATION OK、不含演示文字', failLines.every((l) => l.length === 1 && l[0] !== 'MIGRATION OK' && !leaks(l)) && failLines[5][0] === '旧备份没有通过导入检查：记录（log）' && failLines[2][0] === '这个文件已经是新格式，不需要迁移');
  expect('reportLines：计划文件的报告没有记录行和孤儿行', json(reportLines(po)) === json(['计划 2 组、4 项任务、1 个力量项', 'MIGRATION OK']));
  expect('reportLines：失败结果不会因为多余字段泄露', !leaks(reportLines({ ok: false, reason: 'not-backup', file, counts: ok.counts })));

  // outputPath
  expect('outputPath：迁移文件和计划文件都在 private/ 下，文件名前缀正确', outputPath('migration', '2026-03-18') === 'private/计划手记-迁移-2026-03-18.json' && outputPath('plan', '2026-03-18') === 'private/计划手记-计划-2026-03-18.json');
  expect('outputPath：种类或日期不对时抛 SafeError（不能借日期跑出 private/）', [() => outputPath('other', '2026-03-18'), () => outputPath('migration', '../x'), () => outputPath('migration', '2026-3-18'), () => outputPath('migration', undefined), () => outputPath('__proto__', '2026-03-18')].every((f) => thrown(f) instanceof SafeError));
  expect('outputPath：输出路径被 git 忽略（git check-ignore）', ignoredByGit(outputPath('migration', '2026-03-18')) && ignoredByGit(outputPath('plan', '2026-03-18')) && ignoredByGit(`${DEMO_DEFAULT_DIR}/synth-migrated.json`));

  // demoDirAllowed：根目录用合成的绝对路径，不碰真实仓库
  const root = resolve(sep, 'synth-root');
  const allowed = (d) => demoDirAllowed(d, root);
  expect('demoDirAllowed：仓库内只接受 private/、test-results/ 下的路径', allowed('private') && allowed('private/migration-demo') && allowed('test-results/x') && allowed(resolve(root, 'test-results', 'a')));
  expect('demoDirAllowed：仓库内其他目录和仓库根目录拒绝', !allowed('tools/x') && !allowed('tools') && !allowed('.') && !allowed('') && !allowed('x') && !allowed(resolve(root, 'tools', 'x')) && !allowed(root));
  expect('demoDirAllowed：先 resolve 再比较，.. 写法不能绕过', !allowed('test-results/../tools') && !allowed('private/../tools/x') && !allowed('test-results/./../x') && allowed('tools/../test-results/x'));
  expect('demoDirAllowed：相似前缀和大小写不同的目录拒绝', !allowed('privatex/x') && !allowed('private-x') && !allowed('Private/x') && !allowed('TEST-RESULTS/x'));
  expect('demoDirAllowed：仓库外的目录接受（含与仓库根同前缀的兄弟目录）', allowed(resolve(sep, 'synth-elsewhere', 'x')) && allowed(resolve(sep, 'synth-root-other')) && allowed('../synth-elsewhere'));
  expect('demoDirAllowed：不是字符串时拒绝', !demoDirAllowed(undefined, root) && !demoDirAllowed(null, root) && !demoDirAllowed(5, root));

  // parseArgs
  expect('parseArgs：四种写法', json(parseArgs(['--self-test'])) === json({ mode: 'self-test' }) && json(parseArgs(['--plan-only'])) === json({ mode: 'plan-only' }) && json(parseArgs(['a.json'])) === json({ mode: 'migrate', legacyPath: 'a.json' }) && parseArgs(['--demo']).mode === 'demo' && parseArgs(['--demo', 'd']).dir === 'd');
  expect('parseArgs：未知参数、多余参数、没有参数都不认', [[], ['--no-such-mode'], ['--self-test', 'x'], ['--plan-only', 'x'], ['a.json', 'b.json'], ['--demo', '--self-test'], ['--demo', 'a', 'b'], ['a.json', '--plan-only']].every((a) => parseArgs(a) === null));

  if (failures.length > 0) {
    for (const f of failures) process.stdout.write(`自检失败：${f}\n`);
    return 1;
  }
  process.stdout.write(`自检通过：${total} 项\n`);
  return 0;
}

// ---------- 入口 ----------

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === null) {
    process.stderr.write(USAGE);
    return 1;
  }
  if (parsed.mode === 'self-test') return runSelfTest();
  const root = repoRoot();
  process.chdir(root);
  if (parsed.mode === 'demo') return runDemo(parsed.dir, root);
  if (parsed.mode === 'plan-only') return runPlanOnly();
  return runMigrate(parsed.legacyPath);
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`迁移出错：${err instanceof SafeError ? err.message : '未预期的错误（已隐去详情）'}\n`);
    process.exitCode = 1;
  }
}
