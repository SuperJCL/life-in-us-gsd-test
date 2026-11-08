#!/usr/bin/env node
// 输出过滤器：零依赖，只使用 node: 内置模块。
//
// 用途：服务器步骤的输出、verify-site 的输出和要提交的 SUMMARY 先经它过滤或检查，
// 这样域名和服务器 IP 不会出现在终端记录、规划文档或提交里。
// 它从本机的 private/server.env（键 USJ_DOMAIN、USJ_IP）和 private/denylist.txt 读值，只在内存里使用，不打印这些值。
// private/ 按当前目录所在 git 仓库的根目录查找（不在仓库里时用当前目录本身），不按脚本自身的位置查找：
// 在仓库外运行时一定找不到值，于是拒绝输出（fail closed），而不是原样转发。
//
// private/server.env 的格式（两行，被 .gitignore 的 private/ 规则忽略，不进仓库）：
//   USJ_DOMAIN=<服务器域名>
//   USJ_IP=<服务器公网 IPv4>
//
// 用法：
//   <命令> | node tools/privacy/redact.mjs            读 stdin，写 stdout：把敏感值替换成占位
//   <文本> | node tools/privacy/redact.mjs --check    读 stdin：还含敏感值就输出命中个数（不输出内容）并退出码 1
//   node tools/privacy/redact.mjs --init-env          从 denylist 生成 private/server.env，只输出 “已设置”
//   node tools/privacy/redact.mjs --verify-env        用 server.env 里的值在内存里自测过滤效果，输出 ENV REDACTION OK
//   node tools/privacy/redact.mjs --self-test         合成数据自检，输出 SELF-TEST OK (N cases)
//
// 替换规则（全部不区分大小写，长的值先替换，一遍扫完，占位文字不会被再次替换）：
//   USJ_DOMAIN 和 denylist 里形如域名的词条 -> <domain>
//   USJ_IP 和 denylist 里形如 IPv4 的词条    -> <server-ip>
//   denylist 里的其他词条                    -> <term>
//   其余公网 IPv4（与规则 H 同一放行表）     -> <ip>
//   以 2 或 3 开头的全局 IPv6                -> <ipv6>
//   JWT 形状                                 -> <token>
//
// 退出码：0 成功；1 --check 发现敏感值、--init-env 或 --verify-env 失败；
//         2 找不到 private/server.env 和 private/denylist.txt（默认模式和 --check 都拒绝输出），或参数错误。
//
// 隐私约定：任何模式都不打印 private/ 下的值，只输出计数、固定文案和占位。

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENV_FILE = 'private/server.env';
const DENYLIST_FILE = 'private/denylist.txt';

export const PLACEHOLDERS = {
  domain: '<domain>',
  serverIp: '<server-ip>',
  term: '<term>',
  ip: '<ip>',
  ipv6: '<ipv6>',
  token: '<token>',
};

// ---------- 纯函数：解析 ----------

// 与 tools/privacy/privacy-check.mjs 的 parseDenylist 相同（那个文件导入即运行，所以这里复制）
export function parseDenylist(text) {
  const terms = [];
  for (const raw of String(text).split(/\r\n|\r|\n/)) {
    const term = raw.split('#')[0].trim();
    if (term.length > 0) terms.push(term);
  }
  return terms;
}

// 两行 KEY=值；忽略空行和 # 注释；只取 USJ_DOMAIN、USJ_IP
export function parseServerEnv(text) {
  const out = { domain: null, ip: null };
  for (const raw of String(text).replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (value.length === 0) continue;
    if (key === 'USJ_DOMAIN') out.domain = value;
    else if (key === 'USJ_IP') out.ip = value;
  }
  return out;
}

const IPV4_LITERAL_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const DOMAIN_LITERAL_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

// ---------- 与规则 H、F 同一组正则和放行表（照抄检查器） ----------

const IPV4_RE = /(?<![A-Za-z0-9.])(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![A-Za-z0-9])(?!\.\d)/g;
const JWT_RE = /(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}(?![A-Za-z0-9_-])/g;
// 全局单播 IPv6：第一组是 2xxx 或 3xxx，写了 :: 或者正好 8 组（这样 23:59:59 这类时间不会被当成地址）
const IPV6_RE = /(?<![0-9A-Fa-f:.])[23][0-9A-Fa-f]{3}(?::[0-9A-Fa-f]{0,4}){2,7}(?![0-9A-Fa-f:])/g;

function isReservedIpv4(a, b, c, d) {
  if (a === 0 || a === 10 || a === 127 || a === 255) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 2) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  return b === 0 && c === 0 && d === 0;
}

function isPublicIpv4Literal(value) {
  const m = IPV4_LITERAL_RE.exec(value);
  if (!m) return false;
  const n = m.slice(1, 5).map(Number);
  return !n.some((x) => x > 255) && !isReservedIpv4(...n);
}

function ipv6Match(match) {
  return match.includes('::') || match.split(':').length === 8;
}

// ---------- 纯函数：替换 ----------

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// values: { domain, ip, terms } -> 词条列表 [{ value, placeholder }]，长的在前，大小写不敏感去重
export function buildEntries(values) {
  const seen = new Map();
  const add = (value, placeholder) => {
    const v = String(value ?? '').trim();
    if (v.length === 0) return;
    const key = v.toLowerCase();
    // 同一个值先登记的优先（server.env 的域名和 IP 比 denylist 里的分类更可靠）
    if (!seen.has(key)) seen.set(key, { value: v, placeholder });
  };
  add(values.domain, PLACEHOLDERS.domain);
  add(values.ip, PLACEHOLDERS.serverIp);
  for (const t of values.terms ?? []) {
    if (IPV4_LITERAL_RE.test(t)) add(t, PLACEHOLDERS.serverIp);
    else if (DOMAIN_LITERAL_RE.test(t)) add(t, PLACEHOLDERS.domain);
    else add(t, PLACEHOLDERS.term);
  }
  return [...seen.values()].sort((x, y) => y.value.length - x.value.length);
}

function entryRegex(entries) {
  if (entries.length === 0) return null;
  return new RegExp(entries.map((e) => escapeRe(e.value)).join('|'), 'gi');
}

// 返回替换后的文本。先一遍扫完 server.env 和 denylist 的值（长的优先），再处理其余的公网 IPv4、全局 IPv6 和 JWT 形状
export function redact(text, values) {
  const entries = buildEntries(values);
  const map = new Map(entries.map((e) => [e.value.toLowerCase(), e.placeholder]));
  const re = entryRegex(entries);
  let out = String(text);
  if (re) out = out.replace(re, (m) => map.get(m.toLowerCase()) ?? PLACEHOLDERS.term);
  out = out.replace(JWT_RE, PLACEHOLDERS.token);
  out = out.replace(IPV4_RE, (m, a, b, c, d) => {
    const n = [a, b, c, d].map(Number);
    if (n.some((x) => x > 255) || isReservedIpv4(...n)) return m;
    return PLACEHOLDERS.ip;
  });
  out = out.replace(IPV6_RE, (m) => (ipv6Match(m) ? PLACEHOLDERS.ipv6 : m));
  return out;
}

// 还含多少个敏感值（只数，不返回内容）
export function countSensitive(text, values) {
  const entries = buildEntries(values);
  const re = entryRegex(entries);
  const s = String(text);
  let n = 0;
  if (re) n += (s.match(re) ?? []).length;
  n += (s.match(JWT_RE) ?? []).length;
  for (const m of s.matchAll(IPV4_RE)) {
    const nums = m.slice(1, 5).map(Number);
    if (!nums.some((x) => x > 255) && !isReservedIpv4(...nums)) n += 1;
  }
  for (const m of s.matchAll(IPV6_RE)) if (ipv6Match(m[0])) n += 1;
  return n;
}

// 从 denylist 里挑出生成 server.env 的候选：恰好一个公网 IPv4、恰好一个以 .vip 结尾且不以 www. 开头的词条
export function pickEnvCandidates(denylistText) {
  const terms = parseDenylist(denylistText);
  const ips = terms.filter(isPublicIpv4Literal);
  const domains = terms.filter((t) => DOMAIN_LITERAL_RE.test(t) && t.toLowerCase().endsWith('.vip') && !t.toLowerCase().startsWith('www.'));
  return {
    ipCount: ips.length,
    domainCount: domains.length,
    ip: ips.length === 1 ? ips[0] : null,
    domain: domains.length === 1 ? domains[0] : null,
  };
}

// ---------- 读取本机的值 ----------

function privateRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || process.cwd();
  } catch {
    return process.cwd();
  }
}

// 返回 { found, domain, ip, terms }；没有任何可替换的值时 found 为 false。
// 只看文件在不在是不够的：文件存在但为空、写坏或只有注释时也必须拒绝输出（06-REVIEW WR-06）。
export function loadValues(root) {
  const envPath = join(root, ENV_FILE);
  const denyPath = join(root, DENYLIST_FILE);
  const env = existsSync(envPath) ? parseServerEnv(readFileSync(envPath, 'utf8')) : { domain: null, ip: null };
  const terms = existsSync(denyPath) ? parseDenylist(readFileSync(denyPath, 'utf8')) : [];
  return {
    found: Boolean(env.domain || env.ip || terms.length > 0),
    domain: env.domain,
    ip: env.ip,
    terms,
  };
}

const NO_VALUES_MESSAGE = 'private/server.env 和 private/denylist.txt 里都没有可替换的值（文件不存在、为空或只有注释），拒绝输出（fail closed）。请在仓库根目录运行，并确认这两个文件至少有一个写了值。';

// ---------- 模式 ----------

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function runFilter() {
  const values = loadValues(privateRoot());
  if (!values.found) {
    process.stderr.write(`${NO_VALUES_MESSAGE}\n`);
    return 2;
  }
  process.stdout.write(redact(await readStdin(), values));
  return 0;
}

async function runCheck() {
  const values = loadValues(privateRoot());
  if (!values.found) {
    process.stderr.write(`${NO_VALUES_MESSAGE}\n`);
    return 2;
  }
  const n = countSensitive(await readStdin(), values);
  if (n > 0) {
    process.stderr.write(`redact --check: 还含 ${n} 处敏感值（不显示内容）\n`);
    return 1;
  }
  process.stdout.write('redact --check: clean\n');
  return 0;
}

function runInitEnv() {
  const root = privateRoot();
  const envPath = join(root, ENV_FILE);
  if (existsSync(envPath)) {
    process.stdout.write('server.env: exists\n');
    return 0;
  }
  const denyPath = join(root, DENYLIST_FILE);
  const manual = '请所有者手动建 private/server.env（两行：USJ_DOMAIN=<服务器域名> 和 USJ_IP=<服务器公网 IPv4>）。';
  if (!existsSync(denyPath)) {
    process.stderr.write(`找不到 private/denylist.txt，无法生成。${manual}\n`);
    return 1;
  }
  const c = pickEnvCandidates(readFileSync(denyPath, 'utf8'));
  if (c.ip === null || c.domain === null) {
    process.stderr.write(`denylist 里的候选不是恰好一个（公网 IPv4 ${c.ipCount} 个，.vip 域名 ${c.domainCount} 个），不猜。${manual}\n`);
    return 1;
  }
  mkdirSync(join(root, 'private'), { recursive: true });
  writeFileSync(envPath, `USJ_DOMAIN=${c.domain}\nUSJ_IP=${c.ip}\n`);
  process.stdout.write('server.env: USJ_DOMAIN=set USJ_IP=set\n');
  return 0;
}

// 把真实值（及大写、www. 前缀变体）拼进示例句子，确认过滤后不再含原值
export function verifyEnvValues(values) {
  const pairs = [];
  if (values.domain) pairs.push(values.domain, values.domain.toUpperCase(), `www.${values.domain}`);
  if (values.ip) pairs.push(values.ip);
  if (pairs.length === 0) return false;
  const sentence = pairs.map((v) => `visit ${v} now`).join('\n');
  const out = redact(sentence, values);
  const lower = out.toLowerCase();
  if (pairs.some((v) => lower.includes(v.toLowerCase()))) return false;
  if (values.domain && !out.includes(PLACEHOLDERS.domain)) return false;
  if (values.ip && !out.includes(PLACEHOLDERS.serverIp)) return false;
  return true;
}

function runVerifyEnv() {
  const root = privateRoot();
  const values = loadValues(root);
  if (!existsSync(join(root, ENV_FILE)) || values.domain === null || values.ip === null) {
    process.stderr.write('private/server.env 缺失或缺少 USJ_DOMAIN、USJ_IP，无法验证\n');
    return 1;
  }
  if (!verifyEnvValues(values)) {
    process.stdout.write('ENV REDACTION FAIL\n');
    return 1;
  }
  process.stdout.write('ENV REDACTION OK\n');
  return 0;
}

// ---------- --self-test（只用合成值，样本在运行时拼接） ----------

function runSelfTest() {
  const failures = [];
  let total = 0;
  const expect = (name, ok) => {
    total += 1;
    if (!ok) failures.push(name);
  };
  const ip = (...n) => n.join('.');
  const domain = ['redact-synth', 'example'].join('.');
  const serverIp = ip(203, 0, 113, 77);
  const otherReserved = ip(203, 0, 113, 9);
  const publicIp = ip(9, 9, 9, 9);
  const v6 = ['2606', '4700', '4700', '', '1111'].join(':');
  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const jwt = [b64u({ alg: 'HS256' }), b64u({ id: 'synthetic' }), 's'.repeat(43)].join('.');
  const values = { domain, ip: serverIp, terms: [domain, `www.${domain}`, serverIp, 'sample-term', 'a+b(c)'] };

  // 替换
  expect('域名替换', redact(`open ${domain} now`, values) === 'open <domain> now');
  expect('域名不区分大小写', redact(`open ${domain.toUpperCase()}`, values) === 'open <domain>');
  expect('长值优先：www. 前缀整体替换', redact(`www.${domain}`, values) === '<domain>');
  expect('服务器 IP 替换', redact(`ssh ${serverIp} uptime`, values) === 'ssh <server-ip> uptime');
  expect('其他词条替换成 <term>', redact('has Sample-Term here', values) === 'has <term> here');
  expect('词条里的正则特殊字符按字面处理', redact('x a+b(c) y', values) === 'x <term> y' && redact('x aab(c) y', values) === 'x aab(c) y');
  expect('一遍扫完：占位里的词不会被再次替换', redact(`${domain}`, { domain, ip: serverIp, terms: ['domain'] }) === '<domain>');
  expect('文档保留段的其他地址不动', redact(`ip ${otherReserved}`, values) === `ip ${otherReserved}`);
  expect('公网 IPv4 -> <ip>', redact(`dns ${publicIp}`, values) === 'dns <ip>');
  expect('全局 IPv6 -> <ipv6>', redact(`v6 ${v6} end`, values) === 'v6 <ipv6> end');
  expect('时间和短冒号串不当 IPv6', redact('at 23:59:59 and 2026:11:07', values) === 'at 23:59:59 and 2026:11:07');
  expect('JWT 形状 -> <token>', redact(`Bearer ${jwt}`, values) === 'Bearer <token>');
  expect('多行文本逐处替换', redact(`${domain}\nline\n${serverIp}\n`, values) === '<domain>\nline\n<server-ip>\n');
  const dirty = redact(`${domain} ${serverIp} ${publicIp} ${v6} ${jwt} sample-term`, values);
  expect('过滤后的文本不含任何原值', ![domain, serverIp, publicIp, v6, jwt, 'sample-term'].some((x) => dirty.toLowerCase().includes(x.toLowerCase())));

  // --check 的判定
  expect('check：干净文本为 0', countSensitive('nothing here, 10.0.0.1 and 23:59:59', values) === 0);
  expect('check：每类各一处共 6 处', countSensitive(`${domain} ${serverIp} ${publicIp} ${v6} ${jwt} sample-term`, values) === 6);
  expect('check：过滤后的文本再检查为 0', countSensitive(dirty, values) === 0);

  // --init-env 的候选解析（内存字符串，不写盘）
  const deny = (...lines) => lines.join('\n');
  const pubA = ip(44, 55, 66, 77);
  const good = pickEnvCandidates(deny('# 注释', `${pubA} # 服务器`, `www.${['x', 'vip'].join('.')}`, ['x', 'vip'].join('.'), 'other term'));
  expect('候选解析：恰好一个 IP 和一个 .vip 域名', good.ipCount === 1 && good.domainCount === 1 && good.ip === pubA && good.domain === 'x.vip');
  const twoIps = pickEnvCandidates(deny(ip(44, 55, 66, 77), ip(44, 55, 66, 78), 'x.vip'));
  expect('候选解析：两个 IP 时不猜', twoIps.ip === null && twoIps.ipCount === 2 && twoIps.domain === 'x.vip');
  const noDomain = pickEnvCandidates(deny(ip(44, 55, 66, 77), 'x.example'));
  expect('候选解析：没有 .vip 域名时不猜', noDomain.domain === null && noDomain.domainCount === 0 && noDomain.ip === pubA);
  const reservedOnly = pickEnvCandidates(deny(ip(10, 0, 0, 1), serverIp, 'x.vip'));
  expect('候选解析：保留段地址不算公网候选', reservedOnly.ipCount === 0 && reservedOnly.ip === null);
  const wwwOnly = pickEnvCandidates(deny(ip(44, 55, 66, 77), `www.${['x', 'vip'].join('.')}`));
  expect('候选解析：只有 www. 域名时不猜', wwwOnly.domain === null);
  const upper = pickEnvCandidates(deny(ip(44, 55, 66, 77), 'X.VIP'));
  expect('候选解析：.vip 不区分大小写', upper.domain === 'X.VIP');

  // server.env 解析
  const env = parseServerEnv(`# c\nUSJ_DOMAIN=${domain}\r\nUSJ_IP="${serverIp}"\nOTHER=1\n`);
  expect('server.env 解析', env.domain === domain && env.ip === serverIp);
  expect('server.env 缺值时为 null', parseServerEnv('USJ_IP=\n').ip === null);

  // --verify-env 的核心
  expect('verify-env：合成值通过', verifyEnvValues({ domain, ip: serverIp, terms: [] }) === true);
  expect('verify-env：没有任何值时失败', verifyEnvValues({ domain: null, ip: null, terms: [] }) === false);

  // fail closed：没有 private 文件的目录里 found 为 false
  expect('没有 private 文件时 found 为 false', loadValues(join(process.cwd(), '__no_such_dir__')).found === false);

  // fail closed（WR-06）：文件存在但没有值时 found 也必须为 false；临时目录用完即删
  const tmpRoot = mkdtempSync(join(tmpdir(), 'redact-selftest-'));
  try {
    mkdirSync(join(tmpRoot, 'private'));
    const envFile = join(tmpRoot, ENV_FILE);
    const denyFile = join(tmpRoot, DENYLIST_FILE);
    writeFileSync(envFile, '');
    expect('server.env 为空时 found 为 false', loadValues(tmpRoot).found === false);
    writeFileSync(envFile, 'USJ_DOMAIN=\nUSJ_IP=\n');
    writeFileSync(denyFile, '# 只有注释\n\n');
    expect('server.env 缺值、denylist 只有注释时 found 为 false', loadValues(tmpRoot).found === false);
    writeFileSync(denyFile, 'sample-term\n');
    expect('denylist 有词条时 found 为 true', loadValues(tmpRoot).found === true);
    writeFileSync(denyFile, '');
    writeFileSync(envFile, `USJ_DOMAIN=${domain}\n`);
    expect('server.env 有域名时 found 为 true', loadValues(tmpRoot).found === true);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  expect('自检临时目录已删除', !existsSync(tmpRoot));

  if (failures.length > 0) {
    for (const f of failures) process.stdout.write(`SELF-TEST FAIL: ${f}\n`);
    return 1;
  }
  process.stdout.write(`SELF-TEST OK (${total} cases)\n`);
  return 0;
}

// ---------- 入口 ----------

async function main(argv) {
  const mode = argv[0];
  if (argv.length > 1) {
    process.stderr.write('usage: redact.mjs [--check | --init-env | --verify-env | --self-test]\n');
    return 2;
  }
  if (mode === undefined) return runFilter();
  if (mode === '--check') return runCheck();
  if (mode === '--init-env') return runInitEnv();
  if (mode === '--verify-env') return runVerifyEnv();
  if (mode === '--self-test') return runSelfTest();
  process.stderr.write('usage: redact.mjs [--check | --init-env | --verify-env | --self-test]\n');
  return 2;
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      process.stderr.write(`redact 出错：${err instanceof Error ? err.message : String(err)}\n`);
      process.exitCode = 2;
    },
  );
}
