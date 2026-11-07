#!/usr/bin/env node
// 计划提取工具：把所有者的原计划从 private 下的原应用副本提取成本地种子。零依赖，只使用 node: 内置模块。
//
// 模式：
//   （无参数）    默认提取：读 private/us-journey-tracker.original.html，写 private/plan-seed.json
//   --check       对比应用里的 DEFAULT_PLAN 与种子：形状、数值撞车、共享的 4 字汉字片段、占位式文字、
//                 应用全文里出现的种子词条；只输出字段路径、计数、字符偏移、词条序号和行号
//   --self-test   内置合成样例自检，不依赖本机私有文件
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

// 种子是所有者的计划文字：JSON 解析失败时绝不透传 err.message（较新的 Node 会在消息里带出错位置附近的原文），
// 只输出固定文案和位置数字（WR-03）。位置只取消息末尾 "at position N (line L column C)" 里的数字。
export function parseSeedJson(text, label = SEED_FILE) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const m = /at position (d+)(?: (line (d+) column (d+)))?s*$/.exec(err instanceof Error ? String(err.message) : '');
    const where = m ? `，位置 ${m[1]}${m[2] ? `（第 ${m[2]} 行第 ${m[3]} 列）` : ''}` : '';
    throw new Error(`${label} JSON 解析失败（已隐去内容）${where}`);
  }
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

// ---------- 纯函数：形状、撞车、共享片段、占位字（D-01 到 D-04 的机器验收） ----------

// 收集 plan 里全部字符串及其字段路径，例如 groups[2].tasks[3].text
export function planEntries(plan) {
  const out = [];
  const walk = (v, path) => {
    if (typeof v === 'string') out.push({ path, value: v });
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, path === '' ? k : `${path}.${k}`);
    }
  };
  walk(plan, '');
  return out;
}

const COLON_END = /[：:]\s*$/;

// 预设模式：以全角或半角冒号结尾记 F（预填），否则记 D（直接记录），例如 FFFDD
function presetPattern(list) {
  return (Array.isArray(list) ? list : []).map((p) => (COLON_END.test(String(p)) ? 'F' : 'D')).join('');
}

// 只含结构，不含文字
export function shapeOf(plan) {
  const p = plan && typeof plan === 'object' ? plan : {};
  const presets = {};
  if (p.presets && typeof p.presets === 'object') {
    for (const key of Object.keys(p.presets).sort()) presets[key] = presetPattern(p.presets[key]);
  }
  return {
    groups: (Array.isArray(p.groups) ? p.groups : []).map((g) => ({
      id: g && g.id,
      cat: g && g.cat,
      hasNote: Boolean(g && typeof g.note === 'string' && g.note !== ''),
      tasks: (g && Array.isArray(g.tasks) ? g.tasks : []).map((t) => t && t.id),
    })),
    lifts: (Array.isArray(p.lifts) ? p.lifts : []).map((l) => ({ id: l && l.id, unit: l && l.unit })),
    presets,
    fitGoalLength: Array.isArray(p.fitGoal) ? p.fitGoal.length : -1,
    fitNoteOk: typeof p.fitNote === 'string' && p.fitNote.length > 0,
  };
}

// 返回问题列表：每条只写字段路径和计数或 id；不比较、也不输出 def、target、fitGoal 的数值和任何文字
export function compareShape(sample, seed) {
  const a = shapeOf(sample);
  const b = shapeOf(seed);
  const problems = [];
  if (a.groups.length !== b.groups.length) problems.push(`groups 数量 ${a.groups.length} ≠ ${b.groups.length}`);
  const gn = Math.min(a.groups.length, b.groups.length);
  for (let i = 0; i < gn; i += 1) {
    const x = a.groups[i];
    const y = b.groups[i];
    if (x.id !== y.id) problems.push(`groups[${i}].id 不同`);
    if (x.cat !== y.cat) problems.push(`groups[${i}].cat 不同`);
    if (x.hasNote !== y.hasNote) problems.push(`groups[${i}].note 有无不同`);
    if (x.tasks.length !== y.tasks.length) problems.push(`groups[${i}].tasks 数量 ${x.tasks.length} ≠ ${y.tasks.length}`);
    const tn = Math.min(x.tasks.length, y.tasks.length);
    for (let j = 0; j < tn; j += 1) {
      if (x.tasks[j] !== y.tasks[j]) problems.push(`groups[${i}].tasks[${j}].id 不同`);
    }
  }
  if (a.lifts.length !== b.lifts.length) problems.push(`lifts 数量 ${a.lifts.length} ≠ ${b.lifts.length}`);
  const ln = Math.min(a.lifts.length, b.lifts.length);
  for (let i = 0; i < ln; i += 1) {
    if (a.lifts[i].id !== b.lifts[i].id) problems.push(`lifts[${i}].id 不同`);
    if (a.lifts[i].unit !== b.lifts[i].unit) problems.push(`lifts[${i}].unit 不同`);
  }
  const keysA = Object.keys(a.presets).join(',');
  const keysB = Object.keys(b.presets).join(',');
  if (keysA !== keysB) problems.push('presets 类别键不同');
  for (const key of Object.keys(b.presets)) {
    if (a.presets[key] !== undefined && a.presets[key] !== b.presets[key]) problems.push(`presets.${key} 模式不同`);
  }
  if (a.fitGoalLength !== b.fitGoalLength) problems.push(`fitGoal 长度 ${a.fitGoalLength} ≠ ${b.fitGoalLength}`);
  if (a.fitNoteOk !== b.fitNoteOk) problems.push('fitNote 是否为非空字符串不同');
  return problems;
}

function liftNumbers(plan) {
  const out = [];
  for (const l of plan && Array.isArray(plan.lifts) ? plan.lifts : []) {
    if (l && typeof l === 'object') out.push(l.def, l.target);
  }
  return out.filter((n) => typeof n === 'number');
}

// 返回撞车处的示例侧字段路径，不输出数值本身
export function numberCollisions(sample, seed) {
  const seedNums = new Set(liftNumbers(seed));
  const hits = [];
  const lifts = sample && Array.isArray(sample.lifts) ? sample.lifts : [];
  lifts.forEach((l, i) => {
    if (!l || typeof l !== 'object') return;
    if (typeof l.def === 'number' && seedNums.has(l.def)) hits.push(`lifts[${i}].def`);
    if (typeof l.target === 'number' && seedNums.has(l.target)) hits.push(`lifts[${i}].target`);
  });
  const sg = sample && Array.isArray(sample.fitGoal) ? sample.fitGoal : null;
  const dg = seed && Array.isArray(seed.fitGoal) ? seed.fitGoal : null;
  if (sg && dg && sg.length > 0 && sg.length === dg.length && sg.every((n, i) => n === dg[i])) hits.push('fitGoal');
  return hits;
}

// 一段字符串里所有连续 n 个汉字的片段，带起始字符偏移（按 Unicode 码点计，从 0 开始）
export function hanWindows(text, n = 4) {
  const chars = [...String(text)];
  const isHan = chars.map((c) => /\p{Script=Han}/u.test(c));
  const out = [];
  for (let i = 0; i + n <= chars.length; i += 1) {
    let all = true;
    for (let k = 0; k < n; k += 1) {
      if (!isHan[i + k]) {
        all = false;
        break;
      }
    }
    if (all) out.push({ fragment: chars.slice(i, i + n).join(''), offset: i });
  }
  return out;
}

// 示例的 4 字片段与种子的 4 字片段的交集：返回 { path, offsets }，path 和 offsets 都在示例侧；不返回片段本身
export function sharedHanFragments(sample, seed) {
  const seedSet = new Set();
  for (const s of planStrings(seed)) for (const w of hanWindows(s)) seedSet.add(w.fragment);
  const out = [];
  for (const { path, value } of planEntries(sample)) {
    const offsets = [...new Set(hanWindows(value).filter((w) => seedSet.has(w.fragment)).map((w) => w.offset))].sort((x, y) => x - y);
    if (offsets.length > 0) out.push({ path, offsets });
  }
  return out;
}

const PLACEHOLDER_WORD = /(示例|样例|占位|placeholder|TODO|TBD)/i;
const PLACEHOLDER_NUMBERED = /^(任务|条目|item)\d+$/i;

// 像占位字的条目（D-01）：返回字段路径列表
export function placeholderLike(sample) {
  const out = [];
  for (const { path, value } of planEntries(sample)) {
    const compact = value.replace(/\s+/g, '');
    if (PLACEHOLDER_WORD.test(value) || PLACEHOLDER_NUMBERED.test(compact)) out.push(path);
  }
  return out;
}

function linesOf(text) {
  return String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/);
}

// 汇总：problems 的各项都只含字段路径或偏移；termHits 每项只含词条序号（从 1 开始）和它在应用里出现的全部行号
export function checkPlan(sample, seed, appText) {
  const usable = sample !== null && sample !== undefined && typeof sample === 'object';
  const problems = usable
    ? {
        shape: compareShape(sample, seed),
        numbers: numberCollisions(sample, seed),
        fragments: sharedHanFragments(sample, seed),
        placeholders: placeholderLike(sample),
      }
    : { shape: ['应用里没有可求值的 DEFAULT_PLAN'], numbers: [], fragments: [], placeholders: [] };
  const lines = linesOf(appText);
  const termHits = [];
  planTerms(seed).forEach((term, i) => {
    const hit = [];
    lines.forEach((line, n) => {
      if (line.includes(term)) hit.push(n + 1);
    });
    if (hit.length > 0) termHits.push({ index: i + 1, lines: hit });
  });
  const ok = problems.shape.length + problems.numbers.length + problems.fragments.length + problems.placeholders.length + termHits.length === 0;
  return { ok, problems, termHits };
}

// 按 --check 的固定格式拼出输出行，不含任何计划文字
export function reportLines(result) {
  const { problems, termHits } = result;
  const out = [
    `形状问题 ${problems.shape.length}；数值撞车 ${problems.numbers.length}；共享 4 字片段 ${problems.fragments.length}；占位式文字 ${problems.placeholders.length}；应用里的种子词条 ${termHits.length}`,
  ];
  for (const s of problems.shape) out.push(`形状问题：${s}`);
  for (const s of problems.numbers) out.push(`数值撞车：${s}`);
  for (const f of problems.fragments) out.push(`共享片段：${f.path} 偏移 ${f.offsets.join('、')}`);
  for (const s of problems.placeholders) out.push(`占位式文字：${s}`);
  for (const h of termHits) out.push(`种子词条 #${h.index}：第 ${h.lines.join('、')} 行`);
  if (result.ok) out.push('CHECK OK');
  return out;
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

// ---------- 模式：--check ----------

function runCheck() {
  if (!existsSync(SEED_FILE)) {
    process.stderr.write(`找不到 ${SEED_FILE}：请先运行 node tools/plan/extract-plan.mjs 生成种子\n`);
    return 1;
  }
  if (!existsSync(APP_FILE)) {
    process.stderr.write(`找不到 ${APP_FILE}\n`);
    return 1;
  }
  const seedData = parseSeedJson(readFileSync(SEED_FILE, 'utf8'));
  if (!seedData || typeof seedData.plan !== 'object' || seedData.plan === null) {
    process.stderr.write('种子文件格式不对：缺少 plan 对象\n');
    return 1;
  }
  const appText = readFileSync(APP_FILE, 'utf8');
  let sample = null;
  try {
    sample = evalSection(appText, 'DEFAULT_PLAN');
  } catch {
    sample = null;
  }
  const result = checkPlan(sample, seedData.plan, appText);
  process.stdout.write(`${reportLines(result).join('\n')}\n`);
  return result.ok ? 0 : 1;
}

// ---------- 模式：--self-test ----------

// 合成的“原件式” html：样本运行时拼接，只用合成文字
function synthHtml(t) {
  return [
    '<script>',
    `const CATS=[{n:"类别甲",k:"lang",presets:["${t.p1}：","${t.p2}"]},{n:"类别乙",k:"oth",presets:[]}];`,
    `const GROUPS=[{p:"P1",cat:"类别甲",name:"${t.g1}",tasks:["${t.a}","${t.b}"]},{p:"P2",cat:"类别乙",name:"${t.g2}",note:"${t.n}",tasks:["${t.c}"]}];`,
    `const LIFTS=[{id:"bench",n:"${t.l}",note:"${t.ln}",unit:"kg",target:${t.target},def:${t.def}}];`,
    `const FIT_GOAL=[${t.fit.join(',')}];`,
    '/* ---------- saving ---------- */',
    'function later(){}',
    '</script>',
    `<div class="group k-fit"><div class="group-head"></div><p class="note">${t.fn}</p></div>`,
  ].join('\n');
}

const SYNTH_SEED_TEXT = {
  p1: '合成样例条目一', p2: '合成样例条目二', g1: '合成组名甲', g2: '合成组名乙', a: '合成任务一', b: '合成任务二', c: '合成任务三',
  n: '合成备注文字', l: '合成力量项', ln: '合成力量说明', target: 777, def: 555, fit: [3, 4], fn: '合成力量组说明',
};

const SYNTH_CLEAN_TEXT = {
  p1: '天地玄黄宇宙', p2: '洪荒日月盈昃', g1: '辰宿列张寒来', g2: '暑往秋收冬藏', a: '闰余成岁律吕', b: '调阳云腾致雨', c: '露结为霜金生',
  n: '丽水玉出昆冈', l: '剑号巨阙珠称', ln: '夜光果珍李柰', target: 888, def: 666, fit: [5, 6], fn: '菜重芥姜海咸',
};

function runSelfTest() {
  const failures = [];
  let total = 0;
  const expect = (name, ok) => {
    total += 1;
    if (!ok) failures.push(name);
  };
  const throws = (fn) => {
    try {
      fn();
      return false;
    } catch {
      return true;
    }
  };
  const json = (v) => JSON.stringify(v);

  // pureSection
  const good = synthHtml(SYNTH_SEED_TEXT);
  const section = pureSection(good);
  expect('pureSection：返回常量区', section.startsWith(PURE_START) && !section.includes(PURE_END) && section.includes('const FIT_GOAL'));
  expect('pureSection：缺起始标记抛错', throws(() => pureSection(good.replace(PURE_START, 'const XATS='))));
  expect('pureSection：缺结束标记抛错', throws(() => pureSection(good.replace(PURE_END, '/* x */'))));
  expect('pureSection：起始标记出现两次抛错', throws(() => pureSection(`${good}\n${PURE_START}[]`)));
  expect('pureSection：结束标记出现两次抛错', throws(() => pureSection(`${good}\n${PURE_END}`)));

  // legacyPlan
  const seed = legacyPlan(good);
  expect('legacyPlan：v 和任务 id 冻结为 P{n}-{i}', seed.v === 1 && json(seed.groups.map((g) => g.tasks.map((t) => t.id))) === json([['P1-1', 'P1-2'], ['P2-1']]));
  expect('legacyPlan：预设按类别键分组', json(Object.keys(seed.presets)) === json(['lang', 'oth']) && seed.presets.lang.length === 2 && seed.presets.oth.length === 0);
  expect('legacyPlan：note 只在原组有时才带', !('note' in seed.groups[0]) && seed.groups[1].note === SYNTH_SEED_TEXT.n);
  expect('legacyPlan：组字段和力量项', seed.groups[0].id === 'P1' && seed.groups[0].cat === '类别甲' && seed.lifts[0].id === 'bench' && seed.lifts[0].target === 777 && seed.lifts[0].def === 555 && seed.lifts[0].unit === 'kg');
  expect('legacyPlan：fitGoal 和 fitNote', json(seed.fitGoal) === json([3, 4]) && seed.fitNote === SYNTH_SEED_TEXT.fn);
  expect('legacyPlan：找不到 k-fit 说明时抛错', throws(() => legacyPlan(good.replace('class="group k-fit"', 'class="group k-other"'))));

  // planTerm
  expect('planTerm：去掉全角冒号', planTerm('合成样例条目一：') === '合成样例条目一');
  expect('planTerm：去掉半角冒号和空白', planTerm(' 半角冒号结尾条目: ') === '半角冒号结尾条目');
  expect('planTerm：不足 4 字', planTerm('三个字') === null && planTerm('三个字：') === null);
  expect('planTerm：没有汉字', planTerm('only ascii words') === null && planTerm('abcd1234') === null);
  expect('planTerm：恰好 4 字', planTerm('四个汉字') === '四个汉字');
  expect('planTerms：去重并保持顺序', json(planTerms({ x: ['合成样例条目一：', '合成样例条目一', '三个字'], y: { z: '合成任务一二' } })) === json(['合成样例条目一', '合成任务一二']));

  // parseSeedJson：解析失败的报错只含固定文案和位置，不带种子里的文字（样本为合成文字，运行时拼接）
  const leakMarker = '合成泄露标记' + '一二三四';
  const leakTexts = [`{"plan":{"a":"${leakMarker}" x}}`, `{"plan":"${leakMarker}`, `${leakMarker}{`, `{"plan":{"a":"${leakMarker}"},}`];
  const leakMessages = leakTexts.map((text) => {
    try {
      parseSeedJson(text);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  });
  expect('parseSeedJson：合法 JSON 原样解析', json(parseSeedJson('{"a":[1]}')) === json({ a: [1] }));
  expect('parseSeedJson：报错是固定文案、不含种子文字', leakMessages.every((m) => m !== null && m.includes('JSON 解析失败') && !m.includes(leakMarker) && !m.includes('合成泄露')));

  // compareShape
  const clone = () => JSON.parse(json(seed));
  const clean = legacyPlan(synthHtml(SYNTH_CLEAN_TEXT));
  expect('compareShape：形状一致时为空（文字和数值不同也不影响）', json(compareShape(clean, seed)) === '[]' && json(compareShape(clone(), seed)) === '[]');
  const fewerTasks = clone();
  fewerTasks.groups[0].tasks.pop();
  expect('compareShape：任务数不同', compareShape(fewerTasks, seed).join('|') === 'groups[0].tasks 数量 1 ≠ 2');
  const badId = clone();
  badId.groups[0].tasks[1].id = 'P1-9';
  expect('compareShape：任务 id 不同', compareShape(badId, seed).join('|') === 'groups[0].tasks[1].id 不同');
  const badCat = clone();
  badCat.groups[1].cat = '类别丙';
  expect('compareShape：cat 不同', compareShape(badCat, seed).join('|') === 'groups[1].cat 不同');
  const badPattern = clone();
  badPattern.presets.lang[0] = '没有冒号的预设';
  expect('compareShape：预设模式不同', compareShape(badPattern, seed).join('|') === 'presets.lang 模式不同');
  const badKeys = clone();
  delete badKeys.presets.oth;
  expect('compareShape：类别键不同', compareShape(badKeys, seed).includes('presets 类别键不同'));
  const badLifts = clone();
  badLifts.lifts[0].id = 'other';
  badLifts.fitGoal = [1];
  badLifts.fitNote = '';
  expect('compareShape：力量项、fitGoal、fitNote', compareShape(badLifts, seed).join('|') === 'lifts[0].id 不同|fitGoal 长度 1 ≠ 2|fitNote 是否为非空字符串不同');
  expect('compareShape：输出不含数值和文字', !compareShape(badLifts, seed).join('|').includes('777') && !compareShape(fewerTasks, seed).join('|').includes('合成'));

  // numberCollisions
  const numSample = clone();
  numSample.lifts[0].def = 777;
  numSample.lifts[0].target = 123;
  numSample.fitGoal = [3, 4];
  const numHits = numberCollisions(numSample, seed);
  expect('numberCollisions：只返回示例侧路径', json(numHits) === json(['lifts[0].def', 'fitGoal']));
  expect('numberCollisions：输出不含数值', !json(numHits).includes('777') && !json(numHits).includes('555'));
  expect('numberCollisions：没有撞车时为空', json(numberCollisions(clean, seed)) === '[]');

  // hanWindows 和 sharedHanFragments
  expect('hanWindows：码点偏移', json(hanWindows('😀合成共享a合成共享').map((w) => w.offset)) === json([1, 6]));
  const fragSeed = { note: '合成共享', other: ['三字共', '无关内容文字'] };
  const fragSample = { a: { name: 'ab合成共享cd合成共享', b: '😀合成共享', c: '只共享三个合成共', d: '完全不同的文字' } };
  const frags = sharedHanFragments(fragSample, fragSeed);
  expect('sharedHanFragments：示例侧路径和偏移（含同一字符串两处）', json(frags) === json([{ path: 'a.name', offsets: [2, 8] }, { path: 'a.b', offsets: [1] }]));
  expect('sharedHanFragments：返回值不含片段文字', !json(frags).includes('合成共享') && !json(frags).includes('合成'));
  expect('sharedHanFragments：只共享 3 个字时忽略', json(sharedHanFragments({ x: '三字共' }, { y: '三字共' })) === '[]');
  expect('sharedHanFragments：干净示例没有共享', json(sharedHanFragments(clean, seed)) === '[]');

  // placeholderLike
  const holders = placeholderLike({ a: '示例任务 1', b: 'TODO later', c: '任务 12', d: 'item3', e: '正常的任务文字', f: 'Placeholder', g: { h: ['条目 7', '没有问题的条目'] } });
  expect('placeholderLike：占位式文字', json(holders) === json(['a', 'b', 'c', 'd', 'f', 'g.h[0]']));
  expect('placeholderLike：干净示例为空', json(placeholderLike(clean)) === '[]');

  // checkPlan 和 reportLines
  const termList = planTerms(seed);
  const appLines = ['第一行 无关', `第二行 ${termList[0]}`, `第三行 ${termList[1]}`, `第四行 ${termList[0]} 再次出现`, '第五行 无关'];
  const dirty = checkPlan(clean, seed, appLines.join('\n'));
  expect('checkPlan：应用含种子词条时 ok 为 false', dirty.ok === false);
  expect('checkPlan：termHits 的序号和全部行号', json(dirty.termHits) === json([{ index: 1, lines: [2, 4] }, { index: 2, lines: [3] }]));
  const dirtyOut = reportLines(dirty);
  expect('reportLines：命中行格式', dirtyOut.includes('种子词条 #1：第 2、4 行') && dirtyOut.includes('种子词条 #2：第 3 行'));
  expect('reportLines：计数行', dirtyOut[0] === '形状问题 0；数值撞车 0；共享 4 字片段 0；占位式文字 0；应用里的种子词条 2');
  expect('reportLines：输出不含词条本身', !dirtyOut.join('\n').includes(termList[0]) && !dirtyOut.join('\n').includes(termList[1]));
  expect('reportLines：有问题时没有 CHECK OK', !dirtyOut.includes('CHECK OK'));
  const cleanResult = checkPlan(clean, seed, appLines.slice(0, 1).join('\n'));
  expect('checkPlan：干净示例 ok 且输出 CHECK OK', cleanResult.ok === true && json(cleanResult.termHits) === '[]' && reportLines(cleanResult).at(-1) === 'CHECK OK');
  const missing = checkPlan(null, seed, '');
  expect('checkPlan：取不到 DEFAULT_PLAN 记一条问题', missing.ok === false && missing.problems.shape.length === 1 && reportLines(missing)[0].startsWith('形状问题 1；'));
  const mixed = clone();
  mixed.lifts[0].def = 777;
  mixed.groups[0].tasks[0].text = `示例${SYNTH_SEED_TEXT.a}`;
  const mixedOut = reportLines(checkPlan(mixed, seed, ''));
  expect('reportLines：撞车、共享片段和占位字的位置行', mixedOut.includes('数值撞车：lifts[0].def') && mixedOut.includes('共享片段：groups[0].tasks[0].text 偏移 2、3') && mixedOut.includes('占位式文字：groups[0].tasks[0].text'));

  if (failures.length > 0) {
    for (const f of failures) process.stdout.write(`自检失败：${f}\n`);
    return 1;
  }
  process.stdout.write(`自检通过：${total} 项\n`);
  return 0;
}

// ---------- 入口 ----------

function main() {
  const args = process.argv.slice(2).filter((a) => a.startsWith('--'));
  const known = ['--check', '--self-test'];
  const unknown = args.filter((a) => !known.includes(a));
  if (unknown.length > 0 || args.length > 1) {
    process.stderr.write('用法：node tools/plan/extract-plan.mjs [--check | --self-test]\n');
    return 1;
  }
  if (args[0] === '--self-test') return runSelfTest();
  process.chdir(repoRoot());
  if (args[0] === '--check') return runCheck();
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
