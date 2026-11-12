#!/usr/bin/env node
// 应用站点检查（Phase 13，OPS-03、SEC-02）：零依赖，只使用 node: 内置模块。骨架来自 tools/probe/verify-site.mjs，检查项按应用站点重写。
//
// 三种用法：
//   --check-bundle <目录>  不联网。离线核对 node deploy/build-site.mjs 产出的上传包（BD-01..BD-09），最后一行
//                          “BUNDLE OK (9 checks)” 或 “BUNDLE FAIL (k of 9)”。上传前、所有者批准清单之前先跑它。
//   --stage baseline       线上，只做 B-01..B-03：HTTPS 可达、http 跳到 https、8090 从外网连不上。最后一行 “VERIFY OK (3 checks)”。
//   --stage full           线上，B-01..B-03 加 F-01..F-16，共 19 项：响应头、线上 CSP 与线上页面的哈希、sw.js 和清单、图标、SDK、
//                          探针路径与未知路径 404（D-10）、/api/health、/_/、匿名注册和匿名读、SSE、CORS、www 跳转、gzip、后台登录限流。
//                          最后一行 “VERIFY OK (19 checks)” 或 “VERIFY FAIL (k of 19)”。
//   --self-test            合成输入自检，不联网，不读 private/，最后一行 “SELF-TEST OK (N cases)”。
//
// 线上阶段的域名和服务器 IP 只在运行时从 private/server.env 读取（键 USJ_DOMAIN、USJ_IP），不写在源码里。
// 线上阶段一律经过滤器运行：
//   node deploy/verify-site.mjs --stage baseline 2>&1 | node tools/privacy/redact.mjs
//   node deploy/verify-site.mjs --stage full 2>&1 | node tools/privacy/redact.mjs
//   node deploy/verify-site.mjs --check-bundle private/deploy-out
//   node deploy/verify-site.mjs --self-test
//
// 副作用：只有 F-16 的 6 次失败的后台登录（随机的 nobody-<hex>@example.com，不存在的账号，不写任何记录）。
//   它会让本机所在 IP 的后台登录被限流 60 秒；两次 --stage full 之间至少间隔 60 秒。
//
// 输出：每项一行 “PASS <编号> <中文说明>” 或 “FAIL <编号> <中文说明>”。说明里不含 URL、主机名、IP、凭据、令牌和页面内容；
//   异常只输出错误的类名或 code，不输出 message（message 里可能有主机名）。
//
// 退出码：0 全部通过；1 有检查失败；2 缺 private/server.env 或缺键、目录不存在、参数错误。
//
// 隐私约定：不打印域名、IP、令牌、页面内容；private/ 按当前目录所在 git 仓库的根目录查找。

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import dns from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { dirname, join, resolve } from 'node:path';
import tls from 'node:tls';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BUNDLE_COUNT, BUNDLE_SOURCES, CONFIG_LINE, ICON_NAMES, buildSite, cspHash, inlineBlocks, normalizeNl, sdkPinnedHash } from './build-site.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = 'private/server.env';
const SDK_SUMS = 'tools/probe/page/vendor/SHA256SUMS';
const REQUEST_TIMEOUT_MS = 10000;
const PORT_TIMEOUT_MS = 5000;
const SSE_TIMEOUT_MS = 10000;
const MANIFEST_NAME = '计划手记';
const LOCAL_VERSION_FILE = 'private/deploy-out/BUILD_VERSION';

// 包内必须出现的全部路径（不含 SHA256SUMS）：生成的 11 个加原样复制的 21 个
const GENERATED_PATHS = [
  'BUILD_VERSION',
  'server/nginx/usj-csp.conf',
  'site/index.html',
  'site/sw.js',
  'site/manifest.webmanifest',
  'site/vendor/pocketbase.iife.js',
  'site/vendor/SHA256SUMS',
  ...ICON_NAMES.map((n) => `site/icons/${n}`),
];
export const EXPECTED_PATHS = [...GENERATED_PATHS, ...BUNDLE_SOURCES.map(([dest]) => dest)].sort();

// ---------- 纯函数 ----------

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

// KEY=值；忽略空行和 # 注释；只取 USJ_DOMAIN、USJ_IP
export function parseServerEnv(text) {
  const out = { domain: null, ip: null };
  for (const raw of String(text).replace(/^\uFEFF/, '').split(/\r\n|\r|\n/)) {
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

// SHA256SUMS：每行 “<64 位十六进制><两个空格或 空格加星号><路径>”；返回 { entries: [[路径, 哈希]], bad: 不合格的行数 }
export function parseSums(text) {
  const entries = [];
  let bad = 0;
  for (const raw of normalizeNl(String(text)).split('\n')) {
    if (raw.trim() === '') continue;
    const m = /^([0-9a-fA-F]{64}) [ *](\S.*)$/.exec(raw);
    if (m && !m[2].startsWith('/') && !m[2].split('/').includes('..')) entries.push([m[2], m[1].toLowerCase()]);
    else bad += 1;
  }
  return { entries, bad };
}

// 页面必须带的响应头；get(name) 返回头的值或 null。返回缺失或不对的头名列表
export function checkPageHeaders(get) {
  const bad = [];
  const has = (name, test) => {
    const v = get(name);
    if (v === null || v === undefined || !test(String(v).toLowerCase())) bad.push(name);
  };
  has('content-security-policy', (v) => v.trim().length > 0);
  has('x-content-type-options', (v) => v.trim() === 'nosniff');
  has('referrer-policy', (v) => v.trim() === 'no-referrer');
  has('permissions-policy', (v) => v.trim().length > 0);
  has('strict-transport-security', (v) => v.includes('max-age=86400'));
  has('x-robots-tag', (v) => v.includes('noindex'));
  has('x-frame-options', (v) => v.trim() === 'deny');
  has('cache-control', (v) => v.includes('no-cache'));
  return bad;
}

// 策略字符串拆成 Map<指令, 取值数组>
export function parseCsp(policy) {
  const map = new Map();
  for (const part of String(policy).split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (toks.length > 0 && !map.has(toks[0])) map.set(toks[0], toks.slice(1));
  }
  return map;
}

// nginx 头文件里的策略字符串（add_header Content-Security-Policy "..." always;）；取不到返回 null
export function policyFromConf(text) {
  const m = /^add_header\s+Content-Security-Policy\s+"([^"]*)"\s+always;\s*$/m.exec(normalizeNl(String(text)));
  return m ? m[1] : null;
}

// 策略里 script-src 和 style-src 的 sha256 源（带单引号），各自排序
export function cspHashes(policy) {
  const map = parseCsp(policy);
  const pick = (name) => (map.get(name) || []).filter((t) => /^'sha256-[A-Za-z0-9+/=]+'$/.test(t)).sort();
  return { scripts: pick('script-src'), styles: pick('style-src') };
}

// 策略的哈希与页面内联块一一对应：数量相同，逐个相等；返回 { ok, note }
export function cspMatchesPage(policy, html) {
  const h = cspHashes(policy);
  const scripts = inlineBlocks(html, 'script').map(cspHash).sort();
  const styles = inlineBlocks(html, 'style').map(cspHash).sort();
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!same(h.scripts, scripts)) return { ok: false, note: `脚本哈希 ${h.scripts.length} 个，页面内联脚本 ${scripts.length} 个，对不上` };
  if (!same(h.styles, styles)) return { ok: false, note: `样式哈希 ${h.styles.length} 个，页面内联样式 ${styles.length} 个，对不上` };
  return { ok: true, note: '' };
}

// 策略缺的指令和出现的 unsafe- 关键字；返回问题列表
export function cspProblems(policy, required) {
  const out = [];
  const text = String(policy);
  for (const d of required) if (!parseCsp(text).has(d.split(' ')[0]) || !text.includes(d)) out.push(`缺 ${d.split(' ')[0]}`);
  if (/unsafe-/i.test(text)) out.push('含 unsafe-');
  return out;
}
const PAGE_CSP_REQUIRED = ["default-src 'none'", "style-src-attr 'none'", "frame-ancestors 'none'"];

// 页面里的云端开关脚本和 robots noindex 的个数
export const countConfigSwitch = (html) => normalizeNl(String(html)).split(CONFIG_LINE).length - 1;
export const countNoindex = (html) => (String(html).match(/<meta\s+name="robots"\s+content="[^"]*noindex[^"]*"/gi) || []).length;

// http 请求应当被 301 或 308 跳转到 https
export function isHttpsRedirect(status, location) {
  return (status === 301 || status === 308) && typeof location === 'string' && location.startsWith('https://');
}

// www 跳转：301，目标是裸域名加原路径和查询串
export function wwwRedirectOk(status, location, domain, pathAndQuery) {
  return status === 301 && location === `https://${domain}${pathAndQuery}`;
}

// content-encoding 里含 gzip
export const isGzipped = (value) => typeof value === 'string' && value.toLowerCase().split(',').map((s) => s.trim()).includes('gzip');

// SSE 的 PB_CONNECT 事件：返回 clientId；不是这种事件或没有 clientId 返回 null（IN-05：只接受带 clientId 的事件）
export function pbConnectClientId(ev) {
  if (!ev || ev.event !== 'PB_CONNECT') return null;
  try {
    const id = JSON.parse(ev.data).clientId;
    return typeof id === 'string' && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

// CORS：别的源不能被放行（没有头，或值既不是它也不是 *）；本站源必须得到同值
export const corsBlocks = (origin, acao) => acao === null || acao === undefined || (acao !== origin && acao !== '*');
export const corsAllows = (origin, acao) => acao === origin;

// 匿名读集合：不是 2xx，或者是 2xx 但一条记录都没有
export function anonListEmpty(status, bodyText) {
  if (!(status >= 200 && status < 300)) return true;
  try {
    const j = JSON.parse(bodyText);
    return Array.isArray(j.items) && j.items.length === 0 && (j.totalItems === undefined || j.totalItems === 0 || j.totalItems === -1);
  } catch {
    return false;
  }
}

// 后台登录限流：恰好 6 个状态码，前 5 个不是 429，第 6 个是 429
export const loginLimitOk = (statuses) => statuses.length === 6 && statuses.slice(0, 5).every((s) => s !== 429) && statuses[5] === 429;

// 文本里的公网地址和外部邮箱（BD-09）：127.0.0.1 和文档地址段（192.0.2.x、198.51.100.x、203.0.113.x）放行，
// 邮箱只放行 @example.com。返回 { ips, emails } 的个数
export function findAddressProblems(text) {
  let ips = 0;
  for (const m of String(text).matchAll(/(?<!\d)(?<!\d\.)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?!\d)(?!\.\d)/g)) {
    const o = m.slice(1).map(Number);
    if (o.some((n) => n > 255)) continue;
    const ok =
      (o[0] === 127 && o[1] === 0 && o[2] === 0 && o[3] === 1) ||
      (o[0] === 192 && o[1] === 0 && o[2] === 2) ||
      (o[0] === 198 && o[1] === 51 && o[2] === 100) ||
      (o[0] === 203 && o[1] === 0 && o[2] === 113);
    if (!ok) ips += 1;
  }
  let emails = 0;
  for (const m of String(text).matchAll(/[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g)) {
    if (m[1].toLowerCase() !== 'example.com') emails += 1;
  }
  return { ips, emails };
}

// SSE 文本解析：feed 一块文本，返回这一块里完整结束（空行收尾）的事件；块可以在任何位置切开
export class SseParser {
  constructor() {
    this.buf = '';
    this.cur = { event: 'message', data: [], id: null };
  }

  feed(text) {
    this.buf += text;
    const out = [];
    for (;;) {
      const m = /\r\n|\r|\n/.exec(this.buf);
      if (!m) break;
      // 以 \r 结尾而后面还没来的数据可能是 \r\n 的前半，等下一块再判断
      if (m[0] === '\r' && m.index === this.buf.length - 1) break;
      const line = this.buf.slice(0, m.index);
      this.buf = this.buf.slice(m.index + m[0].length);
      if (line === '') {
        if (this.cur.data.length > 0 || this.cur.id !== null || this.cur.event !== 'message') {
          out.push({ event: this.cur.event, data: this.cur.data.join('\n'), id: this.cur.id });
        }
        this.cur = { event: 'message', data: [], id: null };
        continue;
      }
      if (line.startsWith(':')) continue;
      const c = line.indexOf(':');
      const field = c < 0 ? line : line.slice(0, c);
      let value = c < 0 ? '' : line.slice(c + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') this.cur.event = value;
      else if (field === 'data') this.cur.data.push(value);
      else if (field === 'id') this.cur.id = value;
    }
    return out;
  }
}

// 异常只给类名或 code，不给 message（message 里可能有主机名）
export function errTag(e) {
  const name = e && typeof e.name === 'string' ? e.name : 'Error';
  const code = (e && e.code) || (e && e.cause && e.cause.code) || '';
  const tag = code ? `${name}:${code}` : name;
  return /^[A-Za-z0-9_:.-]+$/.test(tag) ? tag : 'Error';
}

const hex = (n) => randomBytes(n).toString('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isOk = (s) => s >= 200 && s < 300;

// ---------- 离线核对上传包（BD-01..BD-09） ----------

// files：Map<包内路径, Buffer>；ctx.readRepo(仓库路径) 返回 Buffer 或 null；ctx.pinnedSdk 是钉死的 SDK sha256。
// 返回 9 项 { id, desc, ok, note }
export function checkBundle(files, ctx) {
  const results = [];
  const text = (p) => (files.has(p) ? files.get(p).toString('utf8') : null);
  const add = (id, desc, fn) => {
    let ok = false;
    let note = '';
    try {
      const r = fn();
      ok = r === true || (r && r.ok === true);
      if (r && typeof r === 'object' && r.note) note = r.note;
    } catch (e) {
      note = `(${errTag(e)})`;
    }
    results.push({ id, desc, ok, note });
  };

  add('BD-01', `校验和全部通过，恰好 ${BUNDLE_COUNT} 行`, () => {
    const sums = files.get('SHA256SUMS');
    if (!sums) return { ok: false, note: '没有 SHA256SUMS' };
    const { entries, bad } = parseSums(sums.toString('utf8'));
    if (bad > 0) return { ok: false, note: `${bad} 行格式不对` };
    if (entries.length !== BUNDLE_COUNT) return { ok: false, note: `${entries.length} 行` };
    if (new Set(entries.map(([p]) => p)).size !== entries.length) return { ok: false, note: '路径重复' };
    const wrong = entries.filter(([p, h]) => !files.has(p) || sha256Hex(files.get(p)) !== h);
    return wrong.length === 0 ? true : { ok: false, note: `${wrong.length} 个文件对不上` };
  });

  add('BD-02', '固定清单的文件都在，没有多余的文件（00-status.sh 不在包里）', () => {
    const have = [...files.keys()].filter((p) => p !== 'SHA256SUMS').sort();
    const missing = EXPECTED_PATHS.filter((p) => !files.has(p));
    const extra = have.filter((p) => !EXPECTED_PATHS.includes(p));
    if (missing.length > 0) return { ok: false, note: `缺 ${missing.length} 个：${missing.slice(0, 3).join(',')}` };
    if (extra.length > 0) return { ok: false, note: `多 ${extra.length} 个：${extra.slice(0, 3).join(',')}` };
    return true;
  });

  add('BD-03', '服务器文件和迁移与仓库逐字节相同', () => {
    const diff = [];
    for (const [dest, src] of BUNDLE_SOURCES) {
      const want = ctx.readRepo(src);
      const got = files.get(dest);
      if (!want || !got || !Buffer.from(want).equals(got)) diff.push(dest);
    }
    return diff.length === 0 ? true : { ok: false, note: `${diff.length} 个不同：${diff.slice(0, 3).join(',')}` };
  });

  add('BD-04', 'CSP 的脚本和样式哈希与页面内联块一一对应', () => {
    const conf = text('server/nginx/usj-csp.conf');
    const html = text('site/index.html');
    if (conf === null || html === null) return { ok: false, note: '缺文件' };
    const policy = policyFromConf(conf);
    if (policy === null) return { ok: false, note: '头文件里没有策略' };
    return cspMatchesPage(policy, html);
  });

  add('BD-05', "策略含 style-src-attr、frame-ancestors、default-src 的 'none'，没有 unsafe- 关键字", () => {
    const policy = policyFromConf(text('server/nginx/usj-csp.conf') || '');
    if (policy === null) return { ok: false, note: '头文件里没有策略' };
    const bad = cspProblems(policy, PAGE_CSP_REQUIRED);
    return bad.length === 0 ? true : { ok: false, note: bad.join(',') };
  });

  add('BD-06', 'sw.js 带着 BUILD_VERSION，不含占位', () => {
    const sw = text('site/sw.js');
    const ver = (text('BUILD_VERSION') || '').trim();
    if (sw === null || !/^[0-9a-f]{12}$/.test(ver)) return { ok: false, note: '缺文件或版本号不对' };
    return sw.includes(ver) && !sw.includes('__BUILD_VERSION__');
  });

  add('BD-07', '页面恰好一处云端开关脚本和一处 robots noindex', () => {
    const html = text('site/index.html');
    if (html === null) return { ok: false, note: '缺文件' };
    const a = countConfigSwitch(html);
    const b = countNoindex(html);
    return a === 1 && b === 1 ? true : { ok: false, note: `云端开关 ${a} 处，noindex ${b} 处` };
  });

  add('BD-08', 'SDK 等于钉死的 sha256', () => {
    const sdk = files.get('site/vendor/pocketbase.iife.js');
    const sums = text('site/vendor/SHA256SUMS');
    if (!sdk || sums === null) return { ok: false, note: '缺文件' };
    return sha256Hex(sdk) === ctx.pinnedSdk && sdkPinnedHash(sums) === ctx.pinnedSdk;
  });

  add('BD-09', '文本文件里没有公网 IP 和 example.com 以外的邮箱', () => {
    let ips = 0;
    let emails = 0;
    const where = [];
    for (const [p, buf] of files) {
      if (p.endsWith('.png')) continue;
      const r = findAddressProblems(buf.toString('utf8'));
      ips += r.ips;
      emails += r.emails;
      if (r.ips + r.emails > 0) where.push(p);
    }
    return ips + emails === 0 ? true : { ok: false, note: `地址 ${ips} 处，邮箱 ${emails} 处：${where.slice(0, 3).join(',')}` };
  });

  return results;
}

function walk(dir, base = dir, out = new Map()) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.set(full.slice(base.length + 1).split('\\').join('/'), readFileSync(full));
  }
  return out;
}

function printBundle(results) {
  for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.desc}${r.note ? ` ${r.note}` : ''}\n`);
  const failed = results.filter((r) => !r.ok).length;
  process.stdout.write(failed === 0 ? `BUNDLE OK (${results.length} checks)\n` : `BUNDLE FAIL (${failed} of ${results.length})\n`);
  return failed === 0 ? 0 : 1;
}

function runCheckBundle(dirArg) {
  const dir = resolve(dirArg);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    process.stderr.write('上传包目录不存在\n');
    return 2;
  }
  const files = walk(dir);
  const readRepo = (p) => {
    try {
      return readFileSync(join(ROOT, p));
    } catch {
      return null;
    }
  };
  const pinnedSdk = sdkPinnedHash(readFileSync(join(ROOT, SDK_SUMS), 'utf8'));
  return printBundle(checkBundle(files, { readRepo, pinnedSdk }));
}

// ---------- 网络 ----------

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || process.cwd();
  } catch {
    return process.cwd();
  }
}

// 不跟随跳转、不解压；响应头名全部小写。返回 { status, headers, body: Buffer }
function request(url, { method = 'GET', headers = {}, json, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  return new Promise((resolveReq, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const h = { ...headers };
    let body;
    if (json !== undefined) {
      body = Buffer.from(JSON.stringify(json));
      h['content-type'] = 'application/json';
      h['content-length'] = body.length;
    }
    const req = lib.request(u, { method, headers: h, timeout: timeoutMs }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolveReq({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { name: 'TimeoutError', code: 'ETIMEDOUT' })));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
const hget = (res) => (n) => {
  const v = res.headers[n];
  return v === undefined ? null : Array.isArray(v) ? v.join(', ') : v;
};

// 打开 SSE，在 ms 毫秒内等第一个带 clientId 的 PB_CONNECT；返回 { status, ctype, clientId }
function sseConnect(url, ms) {
  return new Promise((resolveSse, reject) => {
    let done = false;
    let req = null;
    let timer = null;
    const info = { status: 0, ctype: '', clientId: null };
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (req) req.destroy();
      if (err) reject(err);
      else resolveSse(info);
    };
    req = https.request(new URL(url), { headers: { accept: 'text/event-stream' } }, (res) => {
      info.status = res.statusCode;
      info.ctype = String(res.headers['content-type'] || '').toLowerCase();
      if (res.statusCode !== 200 || !info.ctype.includes('text/event-stream')) {
        res.resume();
        finish();
        return;
      }
      const parser = new SseParser();
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        for (const ev of parser.feed(chunk)) {
          const id = pbConnectClientId(ev);
          if (id) {
            info.clientId = id;
            finish();
            return;
          }
        }
      });
      res.on('end', () => finish());
      res.on('error', (e) => finish(e));
    });
    timer = setTimeout(() => finish(), ms);
    req.on('error', (e) => finish(e));
    req.end();
  });
}

// 8090 是否能从外面连上：返回 'OPEN' 或 'CLOSED'
function probePort(ip, port) {
  return new Promise((resolvePort) => {
    const s = net.connect({ host: ip, port });
    let done = false;
    const end = (v) => {
      if (done) return;
      done = true;
      s.destroy();
      resolvePort(v);
    };
    s.setTimeout(PORT_TIMEOUT_MS, () => end('CLOSED'));
    s.once('connect', () => end('OPEN'));
    s.once('error', () => end('CLOSED'));
  });
}

// www 的 TLS 握手能否成功（证书覆盖 www）：成功 true，失败 false
function tlsHandshakeOk(host) {
  return new Promise((resolveTls) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: PORT_TIMEOUT_MS }, () => {
      s.destroy();
      resolveTls(true);
    });
    s.on('timeout', () => {
      s.destroy();
      resolveTls(false);
    });
    s.on('error', () => resolveTls(false));
  });
}

// ---------- 检查的执行与输出 ----------

function makeRunner(label) {
  const state = { total: 0, failed: 0 };
  const run = async (id, desc, fn) => {
    state.total += 1;
    let ok = false;
    let extra = '';
    try {
      const r = await fn();
      ok = r === true || (r && r.ok === true);
      if (r && typeof r === 'object' && r.note) extra = ` ${r.note}`;
    } catch (e) {
      extra = ` (${errTag(e)})`;
    }
    if (!ok) state.failed += 1;
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${id} ${desc}${extra}\n`);
    return ok;
  };
  const finish = () => {
    process.stdout.write(state.failed === 0 ? `${label} OK (${state.total} checks)\n` : `${label} FAIL (${state.failed} of ${state.total})\n`);
    return state.failed === 0 ? 0 : 1;
  };
  return { run, finish };
}

async function runBaselineChecks(run, { domain, ip }) {
  await run('B-01', 'HTTPS 可达（DNS 和 TLS 正常）', async () => (await request(`https://${domain}/`)).status >= 100);
  await run('B-02', 'http 跳转到 https', async () => {
    const res = await request(`http://${domain}/`);
    return isHttpsRedirect(res.status, res.headers.location);
  });
  await run('B-03', '8090 从外面连不上', async () => {
    const v = await probePort(ip, 8090);
    return { ok: v === 'CLOSED', note: v };
  });
}

async function runBaseline(cfg) {
  const { run, finish } = makeRunner('VERIFY');
  await runBaselineChecks(run, cfg);
  return finish();
}

function localBuildVersion(root) {
  try {
    const v = readFileSync(join(root, LOCAL_VERSION_FILE), 'utf8').trim();
    return /^[0-9a-f]{12}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

async function runFull(cfg) {
  const { domain } = cfg;
  const { run, finish } = makeRunner('VERIFY');
  const base = `https://${domain}`;
  const root = repoRoot();
  await runBaselineChecks(run, cfg);

  // 页面只取一次，F-01..F-03、F-10 共用
  let pageP = null;
  const page = () => (pageP ??= request(`${base}/`));

  await run('F-01', '/ 返回 200 且响应头齐全（CSP、nosniff、Referrer-Policy、Permissions-Policy、HSTS 一天、noindex、DENY、no-cache）', async () => {
    const res = await page();
    if (res.status !== 200) return false;
    const bad = checkPageHeaders(hget(res));
    return bad.length === 0 ? true : { ok: false, note: `缺少或不对的头：${bad.join(',')}` };
  });

  await run('F-02', '线上 CSP 的哈希与线上页面内联块一一对应，页面恰好一处云端开关', async () => {
    const res = await page();
    const policy = hget(res)('content-security-policy');
    if (res.status !== 200 || !policy) return false;
    const html = res.body.toString('utf8');
    const m = cspMatchesPage(policy, html);
    if (!m.ok) return m;
    const n = countConfigSwitch(html);
    return n === 1 ? true : { ok: false, note: `云端开关 ${n} 处` };
  });

  await run('F-03', "线上策略含 style-src-attr 'none'、frame-ancestors 'none'，没有 unsafe- 关键字", async () => {
    const policy = hget(await page())('content-security-policy');
    if (!policy) return false;
    const bad = cspProblems(policy, ["style-src-attr 'none'", "frame-ancestors 'none'"]);
    return bad.length === 0 ? true : { ok: false, note: bad.join(',') };
  });

  await run('F-04', '/sw.js 200、JavaScript 类型、no-cache、带 default-src none 的 CSP、含 12 位版本号', async () => {
    const res = await request(`${base}/sw.js`);
    const get = hget(res);
    if (res.status !== 200) return false;
    if (!String(get('content-type') || '').toLowerCase().includes('javascript')) return { ok: false, note: '类型不对' };
    if (!String(get('cache-control') || '').toLowerCase().includes('no-cache')) return { ok: false, note: '缓存头不对' };
    if (!String(get('content-security-policy') || '').includes("default-src 'none'")) return { ok: false, note: '没有 CSP' };
    const m = /const V = '([0-9a-f]{12})'/.exec(res.body.toString('utf8'));
    if (!m) return { ok: false, note: '没有 12 位版本号' };
    const local = localBuildVersion(root);
    if (local === null) return { ok: true, note: '本机没有构建版本号，未比对' };
    return m[1] === local ? true : { ok: false, note: '与本机构建的版本号不同' };
  });

  await run('F-05', '/manifest.webmanifest 的类型是 application/manifest+json，name 是「计划手记」', async () => {
    const res = await request(`${base}/manifest.webmanifest`);
    if (res.status !== 200) return false;
    if (!String(hget(res)('content-type') || '').toLowerCase().startsWith('application/manifest+json')) return { ok: false, note: '类型不对' };
    return JSON.parse(res.body.toString('utf8')).name === MANIFEST_NAME;
  });

  await run('F-06', '4 个主屏图标都是 200 且 image/png', async () => {
    const bad = [];
    for (const n of ICON_NAMES) {
      const res = await request(`${base}/icons/${n}`);
      if (res.status !== 200 || !String(hget(res)('content-type') || '').toLowerCase().startsWith('image/png')) bad.push(n);
    }
    return bad.length === 0 ? true : { ok: false, note: `${bad.length} 个不对` };
  });

  await run('F-07', 'SDK 文件的 sha256 等于钉死值', async () => {
    const want = sdkPinnedHash(readFileSync(join(ROOT, SDK_SUMS), 'utf8'));
    const res = await request(`${base}/vendor/pocketbase.iife.js`);
    return res.status === 200 && sha256Hex(res.body) === want;
  });

  await run('F-08', '探针路径和未知路径都是 404（D-10）', async () => {
    const bad = [];
    for (const p of ['/probe/', '/probe/config.js', '/index.nginx-debian.html', '/no-such-path']) {
      if ((await request(`${base}${p}`)).status !== 404) bad.push(p);
    }
    return bad.length === 0 ? true : { ok: false, note: `${bad.length} 个路径不是 404` };
  });

  await run('F-09', '/api/health 返回 200 且带 X-Robots-Tag', async () => {
    const res = await request(`${base}/api/health`);
    return res.status === 200 && String(hget(res)('x-robots-tag') || '').toLowerCase().includes('noindex');
  });

  await run('F-10', '/_/ 返回 200，带 PocketBase 自己的 CSP（含 frame-ancestors）而不是页面的 CSP', async () => {
    const res = await request(`${base}/_/`);
    const csp = hget(res)('content-security-policy');
    const pageCsp = hget(await page())('content-security-policy');
    return res.status === 200 && !!csp && csp.includes('frame-ancestors') && csp !== pageCsp;
  });

  await run('F-11', '匿名注册被拒，匿名读不到任何文档', async () => {
    const pw = hex(12);
    const reg = await request(`${base}/api/collections/users/records`, { method: 'POST', json: { email: `anon-${hex(4)}@example.com`, password: pw, passwordConfirm: pw } });
    if (isOk(reg.status)) return { ok: false, note: '匿名注册成功了' };
    const list = await request(`${base}/api/collections/journey_docs/records`);
    return anonListEmpty(list.status, list.body.toString('utf8')) ? true : { ok: false, note: '匿名读到了记录' };
  });

  await run('F-12', `SSE：${SSE_TIMEOUT_MS / 1000} 秒内收到带 clientId 的 PB_CONNECT`, async () => {
    const r = await sseConnect(`${base}/api/realtime`, SSE_TIMEOUT_MS);
    if (r.status !== 200 || !r.ctype.includes('text/event-stream')) return { ok: false, note: '不是 text/event-stream' };
    return r.clientId !== null ? true : { ok: false, note: '没有收到 PB_CONNECT' };
  });

  await run('F-13', 'CORS：别的源不被放行，本站源得到同值', async () => {
    const evil = 'https://evil.example';
    const bad = await request(`${base}/api/health`, { headers: { origin: evil } });
    if (!corsBlocks(evil, hget(bad)('access-control-allow-origin'))) return { ok: false, note: '放行了别的源' };
    const own = await request(`${base}/api/health`, { headers: { origin: base } });
    return corsAllows(base, hget(own)('access-control-allow-origin')) ? true : { ok: false, note: '本站源没有得到同值' };
  });

  await run('F-14', 'www 跳转到裸域名（www 能解析且证书覆盖它时；否则不适用）', async () => {
    const www = `www.${domain}`;
    try {
      await dns.lookup(www);
    } catch {
      return { ok: true, note: '不适用（www 解析不到）' };
    }
    if (!(await tlsHandshakeOk(www))) return { ok: true, note: '不适用（证书不含 www）' };
    const res = await request(`https://${www}/x?y=1`);
    return wwwRedirectOk(res.status, res.headers.location, domain, '/x?y=1') ? true : { ok: false, note: '能握手却没有跳转到裸域名' };
  });

  await run('F-15', '页面带 Accept-Encoding: gzip 时返回 gzip', async () => {
    const res = await request(`${base}/`, { headers: { 'accept-encoding': 'gzip' } });
    return res.status === 200 && isGzipped(hget(res)('content-encoding'));
  });

  await run('F-16', '后台登录连发 6 次，前 5 次不是 429，第 6 次 429（本机 IP 的后台登录会等 60 秒）', async () => {
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request(`${base}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        json: { identity: `nobody-${hex(4)}@example.com`, password: hex(12) },
      });
      statuses.push(res.status);
    }
    return loginLimitOk(statuses) ? true : { ok: false, note: `状态码 ${statuses.join(',')}` };
  });

  return finish();
}

// ---------- 自检 ----------

const SYN_HTML =
  '<!DOCTYPE html>\n<html><head>\n<meta name="robots" content="noindex,nofollow">\n<style>\nbody{color:#111}\n</style>\n</head><body>\n<script src="/vendor/synth.js"></script>\n<script>\nalert(1)\n</script>\n</body></html>\n';

function synthBundle() {
  const sdk = Buffer.from('synth-sdk');
  const extras = Object.fromEntries(BUNDLE_SOURCES.map(([dest], i) => [dest, Buffer.from(`synth-extra-${i}\n`)]));
  const built = buildSite({
    html: SYN_HTML,
    sw: "const V = '__BUILD_VERSION__', CACHE = 'synth-' + V;\n",
    manifest: '{"name":"synth"}\n',
    icons: Object.fromEntries(ICON_NAMES.map((n, i) => [n, Buffer.from(`synth-icon-${i}`)])),
    sdk,
    sdkSums: `${sha256Hex(sdk)}  pocketbase.iife.js\n`,
    extras,
  });
  const files = new Map(Object.entries(built.files).map(([k, v]) => [k, Buffer.isBuffer(v) ? v : Buffer.from(v, 'utf8')]));
  const repo = new Map(BUNDLE_SOURCES.map(([dest, src]) => [src, extras[dest]]));
  return { files, ctx: { readRepo: (p) => repo.get(p) ?? null, pinnedSdk: sha256Hex(sdk) }, built };
}

// 改一个文件的内容，并让 SHA256SUMS 里对应的那一行跟着变（单独测某一项失败时不连带 BD-01）
function mutated(base, path, fn) {
  const files = new Map(base.files);
  files.set(path, Buffer.from(fn(files.get(path).toString('utf8')), 'utf8'));
  const sums = files
    .get('SHA256SUMS')
    .toString('utf8')
    .split('\n')
    .map((l) => (l.slice(66) === path ? `${sha256Hex(files.get(path))}  ${path}` : l))
    .join('\n');
  files.set('SHA256SUMS', Buffer.from(sums, 'utf8'));
  return files;
}

function selfTest() {
  let total = 0;
  const failures = [];
  const expect = (name, ok) => {
    total += 1;
    if (!ok) failures.push(name);
  };

  // server.env
  const env = parseServerEnv(`# c\nUSJ_DOMAIN=d.example\r\nUSJ_IP="192.0.2.1"\nX=1\n`);
  expect('server.env 解析域名和 IP', env.domain === 'd.example' && env.ip === '192.0.2.1');
  expect('server.env 缺键为 null', parseServerEnv('USJ_IP=\n').ip === null);

  // SHA256SUMS
  const h = 'a'.repeat(64);
  const sums = parseSums(`${h}  one.js\r\n${'b'.repeat(64)} *two.js\nbad line\n${h}  ../up.js\n`);
  expect('SHA256SUMS 两个空格和空格加星号都接受', sums.entries.length === 2 && sums.entries[0][0] === 'one.js' && sums.entries[1][0] === 'two.js');
  expect('SHA256SUMS 坏行和 .. 路径算坏行', sums.bad === 2);

  // 响应头
  const full = {
    'content-security-policy': "default-src 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=()',
    'strict-transport-security': 'max-age=86400',
    'x-robots-tag': 'noindex, nofollow',
    'x-frame-options': 'DENY',
    'cache-control': 'no-cache',
  };
  expect('页面响应头齐全', checkPageHeaders((n) => full[n] ?? null).length === 0);
  const lacking = { ...full };
  delete lacking['permissions-policy'];
  expect('缺一个头能发现', checkPageHeaders((n) => lacking[n] ?? null).join() === 'permissions-policy');
  expect('HSTS 不是一天能发现', checkPageHeaders((n) => (n === 'strict-transport-security' ? 'max-age=31536000' : full[n])).join() === 'strict-transport-security');
  expect('X-Frame-Options 不是 DENY 能发现', checkPageHeaders((n) => (n === 'x-frame-options' ? 'SAMEORIGIN' : full[n])).join() === 'x-frame-options');
  expect('Cache-Control 不是 no-cache 能发现', checkPageHeaders((n) => (n === 'cache-control' ? 'public, max-age=3600' : full[n])).join() === 'cache-control');

  // CSP 解析与哈希比对
  const syn = synthBundle();
  const goodPolicy = policyFromConf(syn.files.get('server/nginx/usj-csp.conf').toString('utf8'));
  expect('头文件里取得出策略', typeof goodPolicy === 'string' && goodPolicy.startsWith("default-src 'none'"));
  expect('头文件不是 add_header 时取不到策略', policyFromConf('# 注释\n') === null);
  expect('parseCsp 拆出指令', parseCsp(goodPolicy).get('frame-ancestors').join() === "'none'");
  expect('cspHashes 取出脚本和样式的哈希', cspHashes(goodPolicy).scripts.length === 2 && cspHashes(goodPolicy).styles.length === 1);
  expect('哈希与页面内联块一一对应', cspMatchesPage(goodPolicy, syn.built.indexHtml).ok);
  expect('页面内联脚本改一个字符，哈希对不上（反例）', !cspMatchesPage(goodPolicy, syn.built.indexHtml.replace('alert(1)', 'alert(2)')).ok);
  expect('页面多一个内联脚本，哈希对不上（反例）', !cspMatchesPage(goodPolicy, syn.built.indexHtml.replace('</body>', '<script>x</script></body>')).ok);
  expect('策略完整时没有问题', cspProblems(goodPolicy, PAGE_CSP_REQUIRED).length === 0);
  expect('策略含 unsafe-inline 能发现', cspProblems(`${goodPolicy}; script-src 'unsafe-inline'`, PAGE_CSP_REQUIRED).includes('含 unsafe-'));
  expect("策略缺 frame-ancestors 能发现", cspProblems(goodPolicy.replace("frame-ancestors 'none'", ''), PAGE_CSP_REQUIRED).join() === '缺 frame-ancestors');
  expect('云端开关和 noindex 的计数', countConfigSwitch(syn.built.indexHtml) === 1 && countNoindex(syn.built.indexHtml) === 1 && countConfigSwitch(SYN_HTML) === 0);

  // 跳转、gzip、PB_CONNECT、CORS、限流
  expect('301 跳到 https 合格，200 和跳到 http 不合格', isHttpsRedirect(301, 'https://a.example/') && isHttpsRedirect(308, 'https://a.example/') && !isHttpsRedirect(200, 'https://a.example/') && !isHttpsRedirect(301, 'http://a.example/') && !isHttpsRedirect(301, null));
  expect('www 跳转：301 加原路径合格', wwwRedirectOk(301, 'https://a.example/x?y=1', 'a.example', '/x?y=1'));
  expect('www 跳转：302、丢路径、跳到别处都不合格', !wwwRedirectOk(302, 'https://a.example/x?y=1', 'a.example', '/x?y=1') && !wwwRedirectOk(301, 'https://a.example/', 'a.example', '/x?y=1') && !wwwRedirectOk(301, 'https://b.example/x?y=1', 'a.example', '/x?y=1'));
  expect('gzip 判定', isGzipped('gzip') && isGzipped('br, gzip') && !isGzipped('br') && !isGzipped(null));
  expect('PB_CONNECT 带 clientId 才算', pbConnectClientId({ event: 'PB_CONNECT', data: '{"clientId":"abc"}' }) === 'abc' && pbConnectClientId({ event: 'PB_CONNECT', data: '{}' }) === null && pbConnectClientId({ event: 'message', data: '{"clientId":"abc"}' }) === null && pbConnectClientId({ event: 'PB_CONNECT', data: 'x' }) === null);
  const own = 'https://own.example';
  const evil = 'https://evil.example';
  expect('CORS：别的源没有头或不同值才算拦住', corsBlocks(evil, null) && corsBlocks(evil, own) && !corsBlocks(evil, evil) && !corsBlocks(evil, '*'));
  expect('CORS：本站源必须得到同值', corsAllows(own, own) && !corsAllows(own, null) && !corsAllows(own, '*'));
  expect('匿名列集合：4xx 或空列表都算读不到', anonListEmpty(403, '{}') && anonListEmpty(200, '{"items":[],"totalItems":0}') && !anonListEmpty(200, '{"items":[{"id":"x"}],"totalItems":1}') && !anonListEmpty(200, 'not json'));
  expect('后台限流：前 5 次不是 429、第 6 次 429', loginLimitOk([400, 400, 400, 400, 400, 429]) && !loginLimitOk([400, 400, 400, 429, 429, 429]) && !loginLimitOk([400, 400, 400, 400, 400, 400]) && !loginLimitOk([400, 429]));

  // BD-09 的地址和邮箱判定（公网地址和外部邮箱在运行时拼出来，源码里不放字面值）
  const pub = [1, 2, 3, 4].join('.');
  const outside = ['someone', 'mail.test'].join('@');
  expect('地址：回环和文档地址段放行', findAddressProblems('127.0.0.1 192.0.2.7 198.51.100.9 203.0.113.250').ips === 0);
  expect('地址：公网地址能发现', findAddressProblems(`x ${pub} y`).ips === 1);
  expect('地址：版本号和超范围数字不算', findAddressProblems('v1.2.3 and 300.1.1.1 and 1.2.3.4.5').ips === 0);
  expect('邮箱：example.com 放行，别的能发现', findAddressProblems('a@example.com').emails === 0 && findAddressProblems(`x ${outside} y`).emails === 1);
  expect('邮箱：没有顶级域的 @ 写法不算', findAddressProblems('@auto_pb_backup_ and name@host').emails === 0);

  // 上传包的 9 项
  const ok9 = checkBundle(syn.files, syn.ctx);
  expect('上传包：合成的完整包 9 项全过', ok9.length === 9 && ok9.every((r) => r.ok));
  const failIds = (files) => checkBundle(files, syn.ctx).filter((r) => !r.ok).map((r) => r.id).join();
  const tamperedServer = new Map(syn.files);
  tamperedServer.set('server/01-swap.sh', Buffer.from('tampered'));
  expect('BD-01：服务器文件被改后校验和对不上（同时 BD-03 也对不上）', failIds(tamperedServer) === 'BD-01,BD-03');
  const lessLine = new Map(syn.files);
  lessLine.set('SHA256SUMS', Buffer.from(syn.files.get('SHA256SUMS').toString('utf8').split('\n').slice(1).join('\n')));
  expect('BD-01：少一行', failIds(lessLine).split(',').includes('BD-01'));
  const noFile = new Map(syn.files);
  noFile.delete('pb_hooks/backup-watch.pb.js');
  expect('BD-02：缺一个文件', failIds(noFile).split(',').includes('BD-02'));
  const extraFile = mutated(syn, 'BUILD_VERSION', (t) => t);
  extraFile.set('server/00-status.sh', Buffer.from('x'));
  expect('BD-02：多出 00-status.sh', failIds(extraFile).split(',').includes('BD-02'));
  expect('BD-03：与仓库不同但校验和自洽时只有 BD-03 失败', failIds(mutated(syn, 'server/02-install-pocketbase.sh', (t) => `${t}x`)) === 'BD-03');
  expect('BD-04：页面内联脚本和策略对不上', failIds(mutated(syn, 'site/index.html', (t) => t.replace('alert(1)', 'alert(2)'))) === 'BD-04');
  expect('BD-05：策略含 unsafe-inline', failIds(mutated(syn, 'server/nginx/usj-csp.conf', (t) => t.replace("default-src 'none'", "default-src 'none' 'unsafe-inline'"))) === 'BD-05');
  expect('BD-06：sw.js 里没有版本号', failIds(mutated(syn, 'site/sw.js', (t) => t.replace(/[0-9a-f]{12}/g, 'xxxxxxxxxxxx'))) === 'BD-06');
  expect('BD-07：页面少一处云端开关', failIds(mutated(syn, 'site/index.html', (t) => t.replace(CONFIG_LINE, '<!-- -->'))) .split(',').includes('BD-07'));
  expect('BD-08：SDK 与钉死值不符', failIds(mutated(syn, 'site/vendor/pocketbase.iife.js', (t) => `${t}x`)) === 'BD-08');
  expect('BD-09：文本里有公网地址', failIds(mutated(syn, 'server/nginx/usj-app.conf', (t) => `${t}# ${pub}\n`)).split(',').includes('BD-09'));
  expect('BD-09：文本里有外部邮箱', failIds(mutated(syn, 'server/nginx/usj-app.conf', (t) => `${t}# ${outside}\n`)).split(',').includes('BD-09'));
  expect('固定清单：32 个路径、无重复、不含 00-status.sh', EXPECTED_PATHS.length === BUNDLE_COUNT && new Set(EXPECTED_PATHS).size === BUNDLE_COUNT && !EXPECTED_PATHS.some((p) => p.includes('00-status')));

  // SSE 解析
  const p1 = new SseParser();
  const ev1 = [...p1.feed('id:abc\nevent:PB_CO'), ...p1.feed('NNECT\ndata:{"clientId":"abc"}\n'), ...p1.feed('\n')];
  expect('SSE 跨块拼接', ev1.length === 1 && ev1[0].event === 'PB_CONNECT' && pbConnectClientId(ev1[0]) === 'abc');
  const p2 = new SseParser();
  const ev2 = p2.feed('data: a\r\ndata: b\r\n\r\n: 心跳注释\r\n\r\ndata:c\n\n');
  expect('SSE 多行 data 与 CRLF', ev2.length === 2 && ev2[0].data === 'a\nb' && ev2[1].data === 'c');
  expect('SSE 没有空行收尾就不出事件', new SseParser().feed('event:x\ndata:1\n').length === 0);
  const p4 = new SseParser();
  expect('SSE 末尾的 \\r 等下一块再判断', p4.feed('data:z\r').length === 0 && p4.feed('\n\r\n').length === 1);

  // 错误标签
  expect('异常标签只含类名和 code', errTag({ name: 'TypeError', cause: { code: 'ENOTFOUND' }, message: 'host.example' }) === 'TypeError:ENOTFOUND');
  expect('异常标签不带 message', !errTag(Object.assign(new Error('secret.example'), { name: 'Error' })).includes('secret'));

  if (failures.length > 0) {
    process.stdout.write(`SELF-TEST FAIL: ${failures.join(' | ')}\n`);
    return 1;
  }
  process.stdout.write(`SELF-TEST OK (${total} cases)\n`);
  return 0;
}

// ---------- 入口 ----------

const USAGE = 'usage: verify-site.mjs [--check-bundle <dir> | --stage baseline | --stage full | --self-test]\n';

async function main(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return selfTest();
  if (argv.length === 2 && argv[0] === '--check-bundle') return runCheckBundle(argv[1]);
  if (argv.length === 2 && argv[0] === '--stage' && (argv[1] === 'baseline' || argv[1] === 'full')) {
    const envPath = join(repoRoot(), ENV_FILE);
    const cfg = existsSync(envPath) ? parseServerEnv(readFileSync(envPath, 'utf8')) : { domain: null, ip: null };
    if (!cfg.domain || !cfg.ip) {
      process.stderr.write('缺 private/server.env 或缺 USJ_DOMAIN、USJ_IP：请先运行 node tools/privacy/redact.mjs --init-env\n');
      return 2;
    }
    return argv[1] === 'baseline' ? runBaseline(cfg) : runFull(cfg);
  }
  process.stderr.write(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`VERIFY ERROR (${errTag(e)})\n`);
      process.exit(2);
    },
  );
}
