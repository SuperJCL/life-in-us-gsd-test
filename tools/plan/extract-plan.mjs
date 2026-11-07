#!/usr/bin/env node
// 计划提取工具：把所有者的原计划从 private 下的原应用副本提取成本地种子。零依赖，只使用 node: 内置模块。
//
// 模式：
//   （无参数）    默认提取：读 private/us-journey-tracker.original.html，写 private/plan-seed.json
//   --check       （Task 2 补上）对比应用里的 DEFAULT_PLAN 与种子
//   --self-test   （Task 2 补上）内置合成样例自检，不依赖本机私有文件
//
// 隐私约定：
//   - 只读 private/ 下的副本，只写 private/plan-seed.json；两者都被 git 忽略。
//   - 只输出计数和仓库相对文件名，从不输出计划原文。
//   - 本文件和自检样例里不写任何个人文字，自检只用合成文字。
//
// node:vm 求值的前提：输入是所有者自己的本机文件，不是不可信输入；
// 只求值两个标记之间的常量和纯函数，空上下文、1 秒超时。vm 不是安全边界。
//
// 退出码：0 通过；1 发现问题或前置条件不满足。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// ---------- 常量 ----------

export const ORIGINAL_FILE = 'private/us-journey-tracker.original.html';
export const SEED_FILE = 'private/plan-seed.json';
export const APP_FILE = 'us-journey-tracker.html';
export const PURE_START = 'const CATS=';
export const PURE_END = '/* ---------- saving ---------- */';
export const CATEGORY_KEYS = ['lang', 'pro', 'fit', 'job', 'oth'];

// ---------- 纯函数：从应用源码求值 ----------

function countOf(text, marker) {
  let n = 0;
  let at = text.indexOf(marker);
  while (at !== -1) {
    n += 1;
    at = text.indexOf(marker, at + marker.length);
  }
  return n;
}

// 切出常量区：两个标记都必须恰好出现一次。这一段只含常量和纯函数，求值时不碰 DOM。
export function pureSection(html) {
  const text = String(html);
  const startCount = countOf(text, PURE_START);
  const endCount = countOf(text, PURE_END);
  if (startCount !== 1) throw new Error(`起始标记 ${PURE_START} 出现了 ${startCount} 次，应当恰好 1 次`);
  if (endCount !== 1) throw new Error(`结束标记 ${PURE_END} 出现了 ${endCount} 次，应当恰好 1 次`);
  const start = text.indexOf(PURE_START);
  const end = text.indexOf(PURE_END);
  if (end < start) throw new Error('结束标记出现在起始标记之前');
  return text.slice(start, end);
}

// 在 vm 里求值，再用 JSON 往返把结果从 vm 的 realm 里取出来（函数不能用它取）
export function evalSection(html, expr) {
  const source = `${pureSection(html)}\n;(${expr})`;
  const value = vm.runInNewContext(source, {}, { timeout: 1000 });
  return JSON.parse(JSON.stringify(value));
}

// 原件的常量 → plan 形状。内置任务 id 与原代码 BUILTIN 的规则逐字相同：P{n}-{i}，这就是冻结的 id。
export function legacyPlan(html) {
  const src = evalSection(html, '({CATS,GROUPS,LIFTS,FIT_GOAL})');
  const presets = {};
  for (const cat of src.CATS) presets[cat.k] = Array.isArray(cat.presets) ? [...cat.presets] : [];
  const groups = src.GROUPS.map((g) => {
    const out = { id: g.p, cat: g.cat, name: g.name };
    if (g.note !== undefined && g.note !== null && g.note !== '') out.note = g.note;
    out.tasks = g.tasks.map((text, i) => ({ id: `${g.p}-${i + 1}`, text }));
    return out;
  });
  const lifts = src.LIFTS.map((l) => ({ id: l.id, n: l.n, unit: l.unit, def: l.def, target: l.target, note: l.note }));
  const m = /class="group k-fit"[\s\S]*?<p class="note">([^<]*)<\/p>/.exec(String(html));
  if (!m) throw new Error('找不到力量组的说明文字（k-fit 段落）');
  return { v: 1, presets, groups, lifts, fitGoal: [...src.FIT_GOAL], fitNote: m[1] };
}

// ---------- 纯函数：词条 ----------

// 与 privacy-check.mjs 的 planTerm 相同，改一处要改两处
export function planTerm(value) {
  const v = String(value).trim().replace(/[：:]$/, '').trim();
  if (!/\p{Script=Han}/u.test(v)) return null;
  if ([...v].length < 4) return null;
  return v;
}

// 递归收集 plan 里的全部字符串
export function planStrings(plan) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(plan);
  return out;
}

// 去重后的词条列表，保持出现顺序
export function planTerms(plan) {
  const seen = new Set();
  const terms = [];
  for (const s of planStrings(plan)) {
    const t = planTerm(s);
    if (t === null || seen.has(t)) continue;
    seen.add(t);
    terms.push(t);
  }
  return terms;
}

// ---------- 模式：默认提取 ----------

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

function runExtract() {
  try {
    execFileSync('git', ['check-ignore', '-q', SEED_FILE], { stdio: 'ignore' });
  } catch {
    process.stderr.write('private/ 没有被 git 忽略，已停止\n');
    return 1;
  }
  if (!existsSync(ORIGINAL_FILE)) {
    process.stderr.write(`找不到 ${ORIGINAL_FILE}：请先在改动应用之前把原应用文件复制到这个位置（D-12）\n`);
    return 1;
  }
  const plan = legacyPlan(readFileSync(ORIGINAL_FILE, 'utf8'));
  const seed = { _seed: 'local owner plan seed (D-10), never commit', v: 1, plan };
  mkdirSync(dirname(SEED_FILE), { recursive: true });
  writeFileSync(SEED_FILE, `${JSON.stringify(seed, null, 2)}\n`);
  const tasks = plan.groups.reduce((n, g) => n + g.tasks.length, 0);
  const presets = Object.values(plan.presets).reduce((n, list) => n + list.length, 0);
  process.stdout.write(
    `已写入 ${SEED_FILE}：${plan.groups.length} 组、${tasks} 项任务、${plan.lifts.length} 个力量项、${presets} 个预设、种子词条 ${planTerms(plan).length} 个\n`,
  );
  return 0;
}

// ---------- 入口 ----------

function main() {
  const args = process.argv.slice(2).filter((a) => a.startsWith('--'));
  const known = [];
  const unknown = args.filter((a) => !known.includes(a));
  if (unknown.length > 0 || args.length > 1) {
    process.stderr.write('用法：node tools/plan/extract-plan.mjs [--check | --self-test]\n');
    return 1;
  }
  process.chdir(repoRoot());
  return runExtract();
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`计划提取出错：${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
