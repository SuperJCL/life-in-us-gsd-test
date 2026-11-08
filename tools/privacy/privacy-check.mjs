#!/usr/bin/env node
// 隐私检查器：仓库公开前的最后一道防线。零依赖，只使用 node: 内置模块。
//
// 模式：
//   --staged     检查暂存区（pre-commit 使用）
//   --all        检查 HEAD 树加暂存区（手动全量检查）
//   --push       从 stdin 读取 pre-push 的引用列表，检查即将推送的每个提交
//   --self-test  内置正例和反例自检，不依赖 git 状态
//
// 规则：
//   A-forbidden-path  不允许进入仓库的文件路径（应用文件只放行仓库根目录那一份，子目录同名文件和改名副本禁止）
//   B-abs-path        内容里的本机绝对路径（用户名）
//   C-email           内容里的真实邮箱
//   D-plan-term       个人计划词条（运行时从本地种子 private/plan-seed.json 和 private/denylist.txt 读取，只输出编号）
//   E-author-email    提交的作者或提交者邮箱不是 GitHub noreply 地址
//   F-token-shape     PocketBase/JWT 令牌形状（三段 base64url、前两段以 eyJ 开头），只输出位置
//
// 退出码：0 通过；1 发现问题；2 参数错误或内部错误（fail closed，同样会阻止提交）。
//
// 本文件自身必须能通过 --staged 和 --all，且不靠豁免自己：
// 所有会命中规则 B、C 的样本都在运行时拼接，源码里不出现完整的命中字面量。

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// ---------- 常量 ----------

const MAX_BUFFER = 64 * 1024 * 1024;
const NOREPLY_SUFFIX = '@users.noreply.github.com';
const APP_FILE = 'us-journey-tracker.html';
const DENYLIST_FILE = 'private/denylist.txt';
const SEED_FILE = 'private/plan-seed.json';
const ORIGINAL_COPY_FILE = 'private/us-journey-tracker.original.html';
const TERM_BLOCK_NAMES = ['CATS', 'GROUPS', 'LIFTS'];
const FILE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico',
  'js', 'mjs', 'cjs', 'ts', 'json', 'md', 'css', 'html', 'htm',
]);
const GENERIC_DIRS = /^(public|default( user)?|all users)([\\/]|$)/i;

// 规则 D 的词条来源：本地种子和 denylist；不读应用文件（D-06）
export const PLAN_TERM_SOURCES = [SEED_FILE, DENYLIST_FILE];

export const RULES = {
  A: 'A-forbidden-path',
  B: 'B-abs-path',
  C: 'C-email',
  D: 'D-plan-term',
  E: 'E-author-email',
  F: 'F-token-shape',
};

// ---------- 纯函数：规则 A（路径） ----------

export function checkPath(path) {
  const norm = String(path).replace(/\\/g, '/');
  const segments = norm.split('/').filter((s) => s.length > 0);
  const base = segments.length > 0 ? segments[segments.length - 1] : '';
  // 根目录的应用文件已去个人化，放行（个人内容由规则 D 挡住）；子目录里的同名文件仍禁止
  if (base === APP_FILE) return norm === APP_FILE ? null : '应用文件只能放在仓库根目录';
  if (base.startsWith('us-journey-tracker') && base.endsWith('.html')) return '应用文件的副本只能留在 private/，不能进入仓库';
  if (base.includes('备份') && base.endsWith('.json')) return '真实备份文件不能进入仓库';
  if (base.startsWith('在美国的日子-') && (base.endsWith('.json') || base.endsWith('.csv'))) {
    return '应用导出文件含真实数据，不能进入仓库';
  }
  if (segments.includes('private')) return 'private 目录只留在本机，不能进入仓库';
  // 其他 AI 工具的安装文件含本机绝对路径（WR-07），与 .gitignore 保持一致
  if (segments[0] === '.agents' || segments[0] === '.codex' || norm === 'AGENTS.md') return '其他 AI 工具的安装文件含本机路径，不能进入仓库';
  if (norm === '.claude/settings.local.json') return '本机 Claude 设置不能进入仓库';
  if (base.startsWith('.env')) return '环境变量文件不能进入仓库';
  return null;
}

// ---------- 纯函数：规则 B（本机绝对路径） ----------

const USER_SEG = '[\\p{L}\\p{N}_][\\p{L}\\p{N}._-]{0,63}';
const WIN_RE = new RegExp(`((?<![A-Za-z])[A-Za-z]:[\\\\/]+users[\\\\/]+)(${USER_SEG})`, 'giu');
const UNIX_RE = new RegExp(`((?<![\\p{L}\\p{N}_.:])\\/(?:Users|home)\\/)(${USER_SEG})(?=\\/)`, 'gu');

export function findAbsPaths(line) {
  const hits = [];
  for (const re of [WIN_RE, UNIX_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const nameStart = m.index + m[1].length;
      if (GENERIC_DIRS.test(line.slice(nameStart))) continue;
      hits.push(`${m[1]}<用户名>`);
    }
  }
  return hits;
}

// ---------- 纯函数：规则 C（邮箱） ----------

const EMAIL_RE = /([A-Za-z0-9._%+-]+)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;

function isAllowedEmail(local, domain) {
  const d = domain.toLowerCase();
  const full = `${local}@${domain}`.toLowerCase();
  if (d.endsWith('users.noreply.github.com')) return true;
  if (full === 'noreply@anthropic.com') return true;
  if (['example.com', 'example.org', 'example.net'].some((x) => d === x || d.endsWith(`.${x}`))) {
    return true;
  }
  const tld = d.slice(d.lastIndexOf('.') + 1);
  if (FILE_EXTENSIONS.has(tld)) return true;
  return false;
}

export function redactEmail(email) {
  const at = String(email).lastIndexOf('@');
  if (at < 1) return '***';
  return `${email.slice(0, 1)}***${email.slice(at)}`;
}

export function findEmails(line) {
  const hits = [];
  EMAIL_RE.lastIndex = 0;
  let m;
  while ((m = EMAIL_RE.exec(line)) !== null) {
    if (isAllowedEmail(m[1], m[2])) continue;
    hits.push(redactEmail(`${m[1]}@${m[2]}`));
  }
  return hits;
}

// ---------- 纯函数：规则 F（令牌形状） ----------

// 三段 base64url，前两段以 eyJ 开头（即 {" 的 base64），每段不少于 10 位；没有签名段、两段式和省略写法不报
const JWT_RE = /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/g;

// 返回命中数组，元素只写固定的 '<令牌>'，不放原文
export function findTokenShapes(line) {
  const hits = [];
  JWT_RE.lastIndex = 0;
  while (JWT_RE.exec(line) !== null) hits.push('<令牌>');
  return hits;
}

// ---------- 纯函数：规则 E（作者和提交者邮箱） ----------

export function checkIdentityEmail(email, role) {
  const e = String(email).trim();
  if (e.toLowerCase().endsWith(NOREPLY_SUFFIX)) return null;
  return {
    rule: RULES.E,
    message: `${role}邮箱 ${redactEmail(e)} 不是 GitHub noreply 地址`,
  };
}

// ---------- 纯函数：扫描文本 ----------

export function isBinary(buffer) {
  const end = Math.min(buffer.length, 8000);
  for (let i = 0; i < end; i += 1) if (buffer[i] === 0) return true;
  return false;
}

export function splitLines(text) {
  return String(text).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
}

// 返回 [{ location, rule, message }]；location 形如 "文件:行号"
export function scanText(location, text, terms = []) {
  const findings = [];
  const lines = splitLines(text);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.length === 0) continue;
    const where = `${location}:${i + 1}`;
    const paths = findAbsPaths(line);
    if (paths.length > 0) {
      findings.push({ location: where, rule: RULES.B, message: `本机绝对路径 ${paths[0]}` });
    }
    const emails = findEmails(line);
    if (emails.length > 0) {
      findings.push({ location: where, rule: RULES.C, message: `疑似真实邮箱 ${emails[0]}` });
    }
    if (findTokenShapes(line).length > 0) {
      findings.push({ location: where, rule: RULES.F, message: '疑似令牌（JWT 形状）' });
    }
    for (let t = 0; t < terms.length; t += 1) {
      if (line.includes(terms[t])) {
        findings.push({ location: where, rule: RULES.D, message: `个人计划词条 #${t + 1}` });
        break;
      }
    }
  }
  return findings;
}

// UTF-16 文本（WR-04）：Windows PowerShell 5 的 > 重定向默认写带 BOM 的 UTF-16LE，每隔一个字节是 NUL，
// 不能因为含 NUL 就当二进制跳过。先认 BOM；没有 BOM 时按 NUL 的奇偶分布判断：
// 一个奇偶位上有至少 4 个且占字符数 2% 以上的 NUL、另一个奇偶位上不到它的一半（汉字 U+xx00 的低字节也是 0，不能要求为 0；真二进制两个奇偶位大致相当），才算 UTF-16 的 ASCII 间隔分布（汉字为主的文本里 ASCII 占比低，所以阈值取得低）。真二进制两个奇偶位都有 NUL，仍然跳过。
// 返回 'le' | 'be' | null
export function utf16Kind(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return 'le';
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) return 'be';
  const end = Math.min(buffer.length, 8000) & ~1;
  if (end < 4) return null;
  let evenZero = 0;
  let oddZero = 0;
  for (let i = 0; i < end; i += 2) {
    if (buffer[i] === 0) evenZero += 1;
    if (buffer[i + 1] === 0) oddZero += 1;
  }
  const pairs = end / 2;
  if (oddZero >= Math.max(4, pairs * 0.02) && evenZero <= oddZero * 0.5) return 'le';
  if (evenZero >= Math.max(4, pairs * 0.02) && oddZero <= evenZero * 0.5) return 'be';
  return null;
}

export function decodeUtf16(buffer, kind) {
  const even = buffer.subarray(0, buffer.length & ~1);
  const bytes = kind === 'be' ? Buffer.from(even).swap16() : even;
  return bytes.toString('utf16le');
}

export function scanBuffer(location, buffer, terms = []) {
  const kind = utf16Kind(buffer);
  if (kind !== null) return scanText(location, decodeUtf16(buffer, kind), terms);
  if (isBinary(buffer)) return [];
  return scanText(location, buffer.toString('utf8'), terms);
}

export function formatFinding(f) {
  return `${f.location} [${f.rule}] ${f.message}`;
}

// ---------- 纯函数：规则 D 的词条来源 ----------

// 只给 --self-test 对照 private 原件副本用（D-06）
function readBlock(html, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*\\[`).exec(html);
  if (!m) return [];
  let i = m.index + m[0].length;
  let depth = 1;
  const strings = [];
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      const quote = ch;
      let j = i + 1;
      while (j < html.length && html[j] !== quote) {
        if (html[j] === '\\') j += 1;
        j += 1;
      }
      if (quote === '"') strings.push(html.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    if (ch === '[') depth += 1;
    else if (ch === ']') depth -= 1;
    i += 1;
  }
  return strings;
}

// 规则 D 的词条筛选：含汉字、至少 4 个字、去掉结尾冒号。
// 与 tools/plan/extract-plan.mjs 的 planTerm 相同，改一处要改两处。
export function planTerm(value) {
  const v = String(value).trim().replace(/[：:]$/, '').trim();
  if (!/\p{Script=Han}/u.test(v)) return null;
  if ([...v].length < 4) return null;
  return v;
}

// 只给 --self-test 对照 private 原件副本用，规则 D 不再用它读应用文件（D-06）
export function extractPlanTerms(html) {
  const seen = new Set();
  const terms = [];
  for (const name of TERM_BLOCK_NAMES) {
    for (const literal of readBlock(html, name)) {
      let value;
      try {
        value = JSON.parse(literal);
      } catch {
        value = literal.slice(1, -1);
      }
      const term = planTerm(value);
      if (term === null || seen.has(term)) continue;
      seen.add(term);
      terms.push(term);
    }
  }
  return terms;
}

// 种子是所有者的计划文字：JSON 解析失败时绝不透传 err.message（较新的 Node 会在消息里带出错位置附近的原文），
// 只输出固定文案和位置数字（WR-03）。位置只取消息末尾 "at position N (line L column C)" 里的数字。
export function parseSeedJson(text, label = 'private/plan-seed.json') {
  try {
    return JSON.parse(text);
  } catch (err) {
    const m = /at position (\d+)(?: \(line (\d+) column (\d+)\))?\s*$/.exec(err instanceof Error ? String(err.message) : '');
    const where = m ? `，位置 ${m[1]}${m[2] ? `（第 ${m[2]} 行第 ${m[3]} 列）` : ''}` : '';
    throw new Error(`${label} JSON 解析失败（已隐去内容）${where}`);
  }
}

// 从本地种子取词条：只遍历 plan 对象里的字符串，_seed 等其他字段不提取
export function seedTerms(text) {
  const data = parseSeedJson(text);
  if (data === null || typeof data !== 'object' || Array.isArray(data) || data.plan === null || typeof data.plan !== 'object' || Array.isArray(data.plan)) {
    throw new Error('种子文件格式不对：缺少 plan 对象');
  }
  const seen = new Set();
  const terms = [];
  const walk = (v) => {
    if (typeof v === 'string') {
      const term = planTerm(v);
      if (term !== null && !seen.has(term)) {
        seen.add(term);
        terms.push(term);
      }
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(walk);
    }
  };
  walk(data.plan);
  return terms;
}

export function parseDenylist(text) {
  const terms = [];
  for (const raw of splitLines(text)) {
    const term = raw.split('#')[0].trim();
    if (term.length > 0) terms.push(term);
  }
  return terms;
}

// ---------- 纯函数：pre-push 输入 ----------

const SHA_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i;
const ZERO_RE = /^0+$/;

export function parsePushInput(text) {
  const entries = [];
  for (const raw of String(text).split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const parts = line.split(/\s+/);
    if (parts.length !== 4 || !SHA_RE.test(parts[1]) || !SHA_RE.test(parts[3])) {
      throw new Error('pre-push 输入格式错误，已阻止推送');
    }
    entries.push({ localRef: parts[0], localSha: parts[1], remoteRef: parts[2], remoteSha: parts[3] });
  }
  return entries;
}

// 返回 null 表示跳过；否则 { primary, fallback }
export function planRevListArgs(entry) {
  if (ZERO_RE.test(entry.localSha)) return null;
  if (ZERO_RE.test(entry.remoteSha)) {
    return { primary: [entry.localSha, '--not', '--remotes'], fallback: null };
  }
  return {
    primary: [`${entry.remoteSha}..${entry.localSha}`],
    fallback: [entry.localSha, '--not', '--remotes'],
  };
}

// ---------- git 辅助 ----------

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'buffer', maxBuffer: MAX_BUFFER, ...opts });
}

function gitText(args) {
  return git(args).toString('utf8');
}

function gitPathList(args, opts = {}) {
  return git(args, opts).toString('utf8').split('\0').filter((p) => p.length > 0);
}

function repoRoot() {
  return gitText(['rev-parse', '--show-toplevel']).trim();
}

function mainWorktreeRoot() {
  try {
    const common = gitText(['rev-parse', '--path-format=absolute', '--git-common-dir']).trim();
    return dirname(common);
  } catch {
    return null;
  }
}

// ---------- 规则 D：种子闸门（fail closed） ----------

// 检查范围里有根目录的应用文件而本机没有种子时，规则 D 无法确认应用里不含个人计划，必须阻止。
// 子目录里的同名文件归规则 A 管。返回 { code, message } 或 null。
export function seedGate(paths, seedFound) {
  if (seedFound) return null;
  if (!paths.some((p) => String(p).replace(/\\/g, '/') === APP_FILE)) return null;
  return {
    code: 2,
    message:
      `本次检查的内容包含 ${APP_FILE}，但本机没有 ${SEED_FILE}，规则 D 无法确认应用里不含个人计划，已阻止。\n` +
      '所有者请先运行 node tools/plan/extract-plan.mjs 生成种子；\n' +
      '没有个人计划的人可以手动建一份空种子 {"v":1,"plan":{}}，明确表示选择加入（空种子不加载任何词条）。',
  };
}

// ---------- 规则 D：加载词条 ----------

function loadPlanTerms() {
  const roots = [process.cwd()];
  const main = mainWorktreeRoot();
  if (main && !roots.includes(main)) roots.push(main);
  const firstExisting = (rel) => {
    for (const root of roots) {
      const p = join(root, rel);
      if (existsSync(p)) return p;
    }
    return null;
  };
  const terms = [];
  const add = (list) => {
    for (const t of list) if (!terms.includes(t)) terms.push(t);
  };
  // 种子存在但解析失败时让错误抛出，由 main 以退出码 2 阻止（fail closed）
  const seedPath = firstExisting(SEED_FILE);
  if (seedPath) add(seedTerms(readFileSync(seedPath, 'utf8')));
  const denyPath = firstExisting(DENYLIST_FILE);
  if (denyPath) add(parseDenylist(readFileSync(denyPath, 'utf8')));
  if (seedPath || denyPath) {
    process.stderr.write(`规则 D：已加载 ${terms.length} 个个人计划词条\n`);
  } else {
    process.stderr.write(`规则 D 已跳过：未找到 ${SEED_FILE} 或 ${DENYLIST_FILE}\n`);
  }
  // seedFound：种子存在并解析成功（坏掉时上面已抛错）。空种子 {"v":1,"plan":{}} 也算找到，是明确的选择加入
  return { terms, seedFound: seedPath !== null };
}

// ---------- 模式：--staged ----------

function runStaged(terms, seedFound) {
  const paths = gitPathList(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']);
  if (paths.length === 0) {
    process.stderr.write('没有暂存文件，隐私检查已跳过\n');
    return { findings: [], count: 0 };
  }
  const gate = seedGate(paths, seedFound);
  if (gate) return { findings: [], count: paths.length, gate };
  const findings = [];
  for (const path of paths) {
    const reason = checkPath(path);
    if (reason) {
      findings.push({ location: path, rule: RULES.A, message: reason });
      continue;
    }
    findings.push(...scanBuffer(path, git(['show', `:${path}`]), terms));
  }
  return { findings, count: paths.length };
}

// ---------- 模式：--all ----------

function runAll(terms, seedFound) {
  // 没有任何提交时 HEAD 不存在，ls-tree 会以 128 退出：先判断 HEAD 是否存在，再读 HEAD 树（WR-05）
  const hasHead = (() => {
    try {
      git(['rev-parse', '--verify', '-q', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] });
      return true;
    } catch {
      return false;
    }
  })();
  const headPaths = hasHead ? gitPathList(['ls-tree', '-r', '-z', '--name-only', 'HEAD']) : [];
  const deleted = new Set(gitPathList(['diff', '--cached', '--name-only', '-z', '--diff-filter=D']));
  const staged = gitPathList(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']);
  const stagedSet = new Set(staged);
  const all = [];
  const seen = new Set();
  for (const p of [...headPaths.filter((x) => !deleted.has(x)), ...staged]) {
    if (!seen.has(p)) {
      seen.add(p);
      all.push(p);
    }
  }
  const gate = seedGate(all, seedFound);
  if (gate) return { findings: [], count: all.length, gate };
  const findings = [];
  for (const path of all) {
    const reason = checkPath(path);
    if (reason) {
      findings.push({ location: path, rule: RULES.A, message: reason });
      continue;
    }
    let buf;
    if (stagedSet.has(path)) {
      try {
        buf = readFileSync(join(process.cwd(), path));
      } catch {
        buf = git(['show', `:${path}`]);
      }
    } else {
      buf = git(['show', `HEAD:${path}`]);
    }
    findings.push(...scanBuffer(path, buf, terms));
  }
  return { findings, count: all.length };
}

// ---------- 模式：--push ----------

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function revList(args) {
  return gitText(['rev-list', ...args]).split(/\r?\n/).filter((l) => l.length > 0);
}

function commitsFor(entry) {
  const plan = planRevListArgs(entry);
  if (!plan) return [];
  try {
    return revList(plan.primary);
  } catch (err) {
    if (!plan.fallback) throw err;
    return revList(plan.fallback);
  }
}

// 一个提交改动的路径（有父提交时与第一父提交比较；根提交没有父提交，改用 --root）
function commitPaths(sha) {
  try {
    return gitPathList(
      ['diff-tree', '-r', '-z', '--name-only', '--diff-filter=ACMR', `${sha}^`, sha],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
  } catch {
    return gitPathList(['diff-tree', '--root', '--no-commit-id', '-r', '-z', '--name-only', '--diff-filter=ACMR', sha]);
  }
}

function checkCommit(sha, terms) {
  const short = sha.slice(0, 8);
  const findings = [];
  const ids = gitText(['log', '-1', '--format=%ae%x00%ce', sha]).trim().split('\0');
  const authorHit = checkIdentityEmail(ids[0] ?? '', '作者');
  if (authorHit) findings.push({ location: `${short}:作者`, ...authorHit });
  const committerHit = checkIdentityEmail(ids[1] ?? '', '提交者');
  if (committerHit) findings.push({ location: `${short}:提交者`, ...committerHit });

  const message = gitText(['log', '-1', '--format=%B', sha]);
  findings.push(...scanText(`${short}:提交说明`, message, terms));

  const paths = commitPaths(sha);
  for (const path of paths) {
    const reason = checkPath(path);
    if (reason) {
      findings.push({ location: `${short}:${path}`, rule: RULES.A, message: reason });
      continue;
    }
    findings.push(...scanBuffer(`${short}:${path}`, git(['show', `${sha}:${path}`]), terms));
  }
  return findings;
}

async function runPush(terms, seedFound) {
  const entries = parsePushInput(await readStdin());
  const shas = [];
  for (const entry of entries) {
    for (const sha of commitsFor(entry)) if (!shas.includes(sha)) shas.push(sha);
  }
  const allPaths = [];
  for (const sha of shas) for (const p of commitPaths(sha)) if (!allPaths.includes(p)) allPaths.push(p);
  const gate = seedGate(allPaths, seedFound);
  if (gate) return { findings: [], count: shas.length, gate };
  const findings = [];
  for (const sha of shas) findings.push(...checkCommit(sha, terms));
  return { findings, count: shas.length };
}

// ---------- 模式：--self-test ----------

function runSelfTest() {
  const failures = [];
  let total = 0;
  const expect = (name, ok) => {
    total += 1;
    if (!ok) failures.push(name);
  };
  const ruleSet = (findings) => findings.map((f) => f.rule).join(',');

  // 样本在运行时拼接，源码里不出现完整的命中字面量
  const name = 'someone';
  const winFwd = ['C:', 'Users', name, 'x'].join('/');
  const winBack = ['C:', 'Users', name, 'x'].join('\\');
  const winJson = ['C:', 'Users', name, 'x'].join('\\\\');
  const winLower = ['c:', 'users', name, 'x'].join('/');
  const mac = ['', 'Users', name, 'x'].join('/');
  const linux = ['', 'home', name, 'x'].join('/');
  const zh = ['C:', 'Users', '某某某', 'x'].join('/');
  const company = `${name}@${['corp-mail', 'com'].join('.')}`;
  const digitDomain = `${name}@${['163', 'com'].join('.')}`;

  // 规则 A
  const pathPos = [
    `sub/${APP_FILE}`, 'x备份y.json', 'private/notes.md', 'a/private/b.txt',
    '.claude/settings.local.json', '.env', '.env.local', 'config/.env.production', '在美国的日子-x.csv',
    'us-journey-tracker.original.html', 'backup/us-journey-tracker.v1.html',
    '.agents/skills/x/SKILL.md', '.codex/agents/x.toml', 'AGENTS.md',
  ];
  for (const p of pathPos) expect(`规则 A 正例 ${p}`, checkPath(p) !== null);
  const pathNeg = [
    'PRIVACY.md', 'tools/privacy/privacy-check.mjs', 'privateer.txt', 'docs/backup.md',
    'src/environment.ts', '.claude/CLAUDE.md', 'docs/us-journey-tracker.md', APP_FILE,
    'docs/AGENTS.md', 'docs/.agents-notes.md', 'src/codex/x.ts',
  ];
  for (const p of pathNeg) expect(`规则 A 反例 ${p}`, checkPath(p) === null);

  // 规则 B
  const bPos = [
    ['Windows 正斜杠', winFwd], ['Windows 单反斜杠', winBack], ['Windows JSON 双反斜杠', winJson],
    ['Windows 小写', winLower], ['macOS', mac], ['Linux', linux], ['中文用户名', zh],
  ];
  for (const [label, sample] of bPos) {
    const f = scanText('f', `前缀 ${sample} 后缀`);
    expect(`规则 B 正例 ${label}`, ruleSet(f) === RULES.B);
    expect(`规则 B 输出不含用户名 ${label}`, !formatFinding(f[0] ?? { location: '', rule: '', message: '' }).includes(name) && !formatFinding(f[0] ?? { location: '', rule: '', message: '' }).includes('某某某'));
  }
  const bNeg = [
    '~/AppData/Local/x', 'C:/Users/<name>/x', 'C:/Users/.../x', 'C:/Users/{user}/x',
    'C:/Users/$USER/x', '%USERPROFILE%/x', 'C:/Users/Public/x', 'https://example.com/home/page/',
    'D:/Projects/x', 'C:/Users/<用户名>/x',
  ];
  for (const sample of bNeg) expect(`规则 B 反例 ${sample}`, scanText('f', sample).length === 0);

  // 规则 C
  for (const [label, sample] of [['公司邮箱', company], ['数字开头域名', digitDomain]]) {
    const f = scanText('f', `联系 ${sample} 即可`);
    expect(`规则 C 正例 ${label}`, ruleSet(f) === RULES.C);
    expect(`规则 C 输出不含 local part ${label}`, !formatFinding(f[0] ?? { location: '', rule: '', message: '' }).includes(name));
  }
  const cNeg = [
    '@playwright/test', 'npm i -D @playwright/test@1.64.1', 'npm init playwright@latest',
    '12345+someone@users.noreply.github.com', 'noreply@anthropic.com', 'test@example.com',
    'a@example.org', 'icon@2x.png', '<ID>+<用户名>@users.noreply.github.com',
  ];
  for (const sample of cNeg) expect(`规则 C 反例 ${sample}`, scanText('f', sample).length === 0);

  // 规则 F：样本三段都在运行时编码或重复生成，源码里没有完整的令牌字面量
  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const jwtHead = b64u({ alg: 'HS256', typ: 'JWT' });
  const jwtBody = b64u({ id: 'synthetic', exp: 1 });
  const jwtSig = 's'.repeat(43);
  const jwt = [jwtHead, jwtBody, jwtSig].join('.');
  const fPos = [
    ['JSON 字段值', `{"token":"${jwt}"}`],
    ['Bearer 头', `Authorization: Bearer ${jwt}`],
    ['查询串', `https://x.test/cb?token=${jwt}&a=1`],
  ];
  for (const [label, sample] of fPos) {
    const f = scanText('f', sample);
    expect(`规则 F 正例 ${label}`, ruleSet(f) === RULES.F && f[0].location === 'f:1');
    const text = f.map(formatFinding).join('\n');
    expect(`规则 F 输出不含令牌 ${label}`, f.length > 0 && !text.includes(jwtHead) && !text.includes(jwtBody) && !text.includes(jwtSig));
  }
  const fNeg = [
    ['签名段为空', `${jwtHead}.${jwtBody}.`],
    ['只有两段', `${jwtHead}.${jwtBody}`],
    ['省略写法', 'eyJ...'],
    ['各段都短于 10 位', ['eyJabc', 'eyJdef', 'ghi'].join('.')],
  ];
  for (const [label, sample] of fNeg) expect(`规则 F 反例 ${label}`, findTokenShapes(`x ${sample} y`).length === 0 && scanText('f', sample).length === 0);

  // 换行无关与二进制
  const body = ['第一行', `路径 ${winFwd}`, '第三行', `邮箱 ${company}`];
  const variants = [body.join('\n'), body.join('\r\n'), body.join('\r')];
  const keys = variants.map((v) => scanText('f', v).map((x) => `${x.location}${x.rule}`).join('|'));
  expect('换行无关 LF/CRLF/CR 结果一致', keys[0] === keys[1] && keys[1] === keys[2] && keys[0].includes('f:2') && keys[0].includes('f:4'));
  expect('二进制内容跳过', scanBuffer('f', Buffer.from(`${winFwd}\0`)).length === 0);
  expect('文本内容不跳过', scanBuffer('f', Buffer.from(winFwd)).length === 1);

  // WR-04：UTF-16 文本要解码后扫描，真二进制仍然跳过（样本运行时构造）
  const le = (s, bom) => Buffer.concat([bom ? Buffer.from([0xff, 0xfe]) : Buffer.alloc(0), Buffer.from(s, 'utf16le')]);
  const be = (s, bom) => Buffer.concat([bom ? Buffer.from([0xfe, 0xff]) : Buffer.alloc(0), Buffer.from(s, 'utf16le').swap16()]);
  const termSample = '合成样例条目一';
  const u16Body = ['普通一行', '前缀 ' + winFwd + ' 后缀', '联系 ' + company + ' 即可', termSample, ''].join('\r\n');
  for (const [label, buf] of [['UTF-16LE 带 BOM', le(u16Body, true)], ['UTF-16BE 带 BOM', be(u16Body, true)], ['UTF-16LE 无 BOM', le(u16Body, false)], ['UTF-16BE 无 BOM', be(u16Body, false)]]) {
    const f = scanBuffer('f', buf, [termSample]);
    expect('UTF-16 解码后命中规则 B、C、D：' + label, ruleSet(f) === [RULES.B, RULES.C, RULES.D].join(',') && f.map((x) => x.location).join(',') === 'f:2,f:3,f:4');
    expect('UTF-16 输出不含用户名和词条：' + label, !f.map(formatFinding).join('\n').includes(name) && !f.map(formatFinding).join('\n').includes(termSample));
  }
  expect('UTF-16 无命中的文本不报告', scanBuffer('f', le('普通一行\r\n又一行 ascii text\r\n', true), [termSample]).length === 0);
  const fakeBinary = Buffer.alloc(4096);
  for (let i = 0; i < fakeBinary.length; i += 1) fakeBinary[i] = (i * 31 + 7) % 251 === 0 ? 0 : (i * 17 + 3) % 256;
  fakeBinary.write(winFwd, 100);
  expect('真二进制仍然跳过', utf16Kind(fakeBinary) === null && scanBuffer('f', fakeBinary).length === 0);
  const sparseNul = Buffer.concat([Buffer.from(winFwd + '\n'), Buffer.alloc(16), Buffer.from('tail\n')]);
  expect('零星 NUL 的二进制仍然跳过', utf16Kind(sparseNul) === null && scanBuffer('f', sparseNul).length === 0);

  // 规则 D：词条提取
  const fixture = String.raw`var s="块外字符串前置不提取";
const CATS=[{n:"合成样例条目一",k:"a",x:["嵌套数组条目二"]},{n:"带\"引号\"的条目三四"}];
const other="块外字符串不应提取";
const GROUPS = [ {t:["全角冒号结尾条目：","合成样例条目一","三个字","only ascii words"]} ];
const LIFTS=[ "半角冒号结尾条目:", 'single "quoted" 不提取的单引号串' ];`;
  const got = extractPlanTerms(fixture);
  const want = ['合成样例条目一', '嵌套数组条目二', '带"引号"的条目三四', '全角冒号结尾条目', '半角冒号结尾条目'];
  expect('词条提取：内容和顺序', JSON.stringify(got) === JSON.stringify(want));
  expect('denylist 解析', JSON.stringify(parseDenylist('# 注释\n\n  甲乙  \n丙丁 # 尾注\r\nab\n')) === JSON.stringify(['甲乙', '丙丁', 'ab']));
  const dFind = scanText('f', '这一行包含 嵌套数组条目二 内容', want);
  expect('规则 D 命中并给出编号', dFind.length === 1 && dFind[0].message.endsWith('#2'));
  expect('规则 D 输出不含词条', !formatFinding(dFind[0] ?? { location: '', rule: '', message: '' }).includes('嵌套数组条目二'));

  // 规则 D：种子词条（样本运行时构造，只用合成文字）
  const synthSeed = JSON.stringify({
    _seed: '合成种子标记四字以上',
    v: 1,
    plan: {
      presets: { a: ['合成样例条目一：', 'only ascii words', '三个字'], b: ['合成样例条目一'] },
      groups: [{ id: 'P1', name: '嵌套数组条目二', tasks: [{ id: 'P1-1', text: '全角冒号结尾条目：' }, { id: 'P1-2', text: '半角冒号结尾条目:' }] }],
      fitGoal: [1, 2],
    },
  });
  const seedWant = ['合成样例条目一', '嵌套数组条目二', '全角冒号结尾条目', '半角冒号结尾条目'];
  expect('种子词条：内容和顺序，_seed 不提取', JSON.stringify(seedTerms(synthSeed)) === JSON.stringify(seedWant));
  const seedThrows = (text) => {
    try {
      seedTerms(text);
      return false;
    } catch {
      return true;
    }
  };
  expect('种子 JSON 坏掉时抛错', seedThrows('{not json'));
  // WR-03：解析失败的报错只含固定文案和位置，不带种子里的文字（样本为合成文字，运行时拼接）
  const leakMarker = '合成泄露标记' + '一二三四';
  const leakTexts = [`{"plan":{"a":"${leakMarker}" x}}`, `{"plan":"${leakMarker}`, `${leakMarker}{`, `{"plan":{"a":"${leakMarker}"},}`];
  const leakMessages = leakTexts.map((text) => {
    try {
      seedTerms(text);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  });
  expect('种子 JSON 坏掉的报错：固定文案、不含种子文字', leakMessages.every((m) => m !== null && m.includes('JSON 解析失败') && !m.includes(leakMarker) && !m.includes('合成泄露')) && /位置 [0-9]+/.test(leakMessages[0] ?? ''));
  expect('种子缺 plan 时抛错', seedThrows('{"v":1}') && seedThrows('{"v":1,"plan":[]}') && seedThrows('[]') && seedThrows('null'));
  expect('PLAN_TERM_SOURCES 不含应用文件', !PLAN_TERM_SOURCES.includes(APP_FILE) && PLAN_TERM_SOURCES.includes(SEED_FILE) && PLAN_TERM_SOURCES.includes(DENYLIST_FILE));

  // 规则 D：种子闸门（样本运行时构造，只用合成文字）
  const gateNoSeed = seedGate(['README.md', APP_FILE], false);
  expect('种子闸门：应用已暂存、没有种子 → 退出码 2', gateNoSeed !== null && gateNoSeed.code === 2 && gateNoSeed.message.includes('private/plan-seed.json'));
  expect('种子闸门：应用已暂存、有种子 → 放行', seedGate([APP_FILE], true) === null);
  const emptySeedTerms = seedTerms('{"v":1,"plan":{}}');
  expect('种子闸门：空种子不加载任何词条，应用式文本没有规则 D 命中', emptySeedTerms.length === 0 && scanText('f', '合成应用式文本 合成样例条目一 <html>', emptySeedTerms).length === 0);
  expect('种子闸门：应用未暂存、没有种子 → 不阻止', seedGate(['README.md', 'sub/' + APP_FILE], false) === null);

  // 规则 E
  expect('规则 E 放行 noreply', checkIdentityEmail(`1+${name}${NOREPLY_SUFFIX}`, '作者') === null);
  expect('规则 E 放行大写 noreply', checkIdentityEmail(`1+${name}${NOREPLY_SUFFIX.toUpperCase()}`, '作者') === null);
  const eHit = checkIdentityEmail(company, '提交者');
  expect('规则 E 拒绝普通邮箱', eHit !== null && eHit.rule === RULES.E && !eHit.message.includes(name));

  // pre-push 输入
  const zero = '0'.repeat(40);
  const a = 'a'.repeat(40);
  const b = 'b'.repeat(40);
  const parsed = parsePushInput(`refs/heads/x ${a} refs/heads/x ${zero}\r\n\r\nrefs/heads/y ${b} refs/heads/y ${a}`);
  expect('push 解析：两行含 CRLF 和无结尾换行', parsed.length === 2 && parsed[1].remoteSha === a);
  let threw = false;
  try {
    parsePushInput('refs/heads/x abc refs/heads/x def');
  } catch {
    threw = true;
  }
  expect('push 解析：格式错误按失败处理', threw);
  const newBranch = planRevListArgs(parsed[0]);
  expect('push 范围：新分支', newBranch !== null && newBranch.primary.join(' ') === `${a} --not --remotes`);
  const updateRange = planRevListArgs(parsed[1]);
  expect('push 范围：更新', updateRange !== null && updateRange.primary[0] === `${a}..${b}`);
  expect('push 范围：删除分支跳过', planRevListArgs({ localSha: zero, remoteSha: a }) === null);

  // 实时词条自检：不写盘、不打印词条
  const live = loadPlanTerms().terms;
  if (live.length > 0) {
    let liveOk = true;
    let liveBad = 0;
    for (let i = 0; i < live.length; i += 1) {
      const line = `前缀 ${live[i]} 后缀`;
      const expectedIdx = live.findIndex((t) => line.includes(t)) + 1;
      const f = scanText('f', line, live);
      const ok = f.length === 1 && f[0].rule === RULES.D && f[0].message.endsWith(`#${expectedIdx}`) && !formatFinding(f[0]).includes(live[i]);
      if (!ok) {
        liveOk = false;
        liveBad += 1;
      }
    }
    expect(`实时词条自检：共 ${live.length} 个，失败 ${liveBad} 个`, liveOk);
  } else {
    process.stderr.write('实时词条自检已跳过：没有可用的词条来源\n');
  }

  // 实时自检：对照私有原件副本，只输出计数
  const copyPath = existsSync(ORIGINAL_COPY_FILE) ? ORIGINAL_COPY_FILE : null;
  if (copyPath && live.length > 0) {
    const copyText = readFileSync(copyPath, 'utf8');
    const legacy = extractPlanTerms(copyText);
    const liveSet = new Set(live);
    expect(`实时自检：种子包含原件块内的全部词条（共 ${legacy.length} 个）`, legacy.length > 0 && legacy.every((t) => liveSet.has(t)));
    const copyHits = scanText('f', copyText, live).filter((x) => x.rule === RULES.D).length;
    expect(`实时自检：原件副本仍被规则 D 拦住（命中 ${copyHits} 行）`, copyHits >= 1);
  } else {
    process.stderr.write('实时自检已跳过：没有私有原件副本或没有可用的词条来源\n');
  }

  if (failures.length > 0) {
    for (const f of failures) process.stdout.write(`自检失败：${f}\n`);
    return 1;
  }
  process.stdout.write(`自检通过：${total} 项\n`);
  return 0;
}

// ---------- 入口 ----------

async function main() {
  const args = process.argv.slice(2).filter((a) => a.startsWith('--'));
  const known = ['--staged', '--all', '--push', '--self-test'];
  const unknown = args.filter((a) => !known.includes(a));
  if (unknown.length > 0 || args.length !== 1) {
    process.stderr.write('用法：node tools/privacy/privacy-check.mjs --staged | --all | --push | --self-test\n');
    return 2;
  }
  const mode = args[0];
  process.chdir(repoRoot());
  if (mode === '--self-test') return runSelfTest();

  const { terms, seedFound } = loadPlanTerms();
  let result;
  if (mode === '--staged') result = runStaged(terms, seedFound);
  else if (mode === '--all') result = runAll(terms, seedFound);
  else result = await runPush(terms, seedFound);

  if (result.gate) {
    process.stderr.write(`${result.gate.message}\n`);
    return result.gate.code;
  }

  if (result.findings.length > 0) {
    process.stdout.write(`${result.findings.map(formatFinding).join('\n')}\n`);
    process.stderr.write(`隐私检查未通过：共 ${result.findings.length} 处问题。请修改后再提交，不要用 --no-verify 绕过。\n`);
    return 1;
  }
  process.stderr.write(`隐私检查通过（${mode.slice(2)}，${result.count} 个${mode === '--push' ? '提交' : '文件'}）\n`);
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (err) => {
    process.stderr.write(`隐私检查出错（已阻止）：${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 2;
  },
);
