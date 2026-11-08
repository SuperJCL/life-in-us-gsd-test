#!/usr/bin/env node
// 探针站点外部检查：零依赖，只使用 fetch 和 node: 内置模块。
//
// 用途：从本机经真实域名检查探针站点，证明“本机 -> DNS -> nginx -> TLS -> PocketBase”这条外部链路可用，
// 以及规则、响应头、SSE 和限流符合设计。域名和服务器 IP 只在运行时从 private/server.env 读取，不写在源码里。
//
// 两个阶段：
//   --stage baseline  现在就能跑（B-01..B-03）：HTTPS 可达、http 跳转到 https、8090 从外面连不上。
//   --stage full      批次 B 执行之后跑（F-01..F-14，06-09 用）：探针页的四个响应头、SDK 文件哈希、config.js、
//                     /api/health、/_/（D-13 对公网开放）、匿名注册被拒、探针账号登录、新建 probe_results、
//                     读写删被拒、不能改自己的用户记录、SSE 首个 PB_CONNECT 与推送、错误口令的限流（429）。
//   --self-test       合成数据自检，不联网，输出 SELF-TEST OK (N cases)。
//
// 用法：
//   node tools/probe/verify-site.mjs --stage baseline 2>&1 | node tools/privacy/redact.mjs
//   node tools/probe/verify-site.mjs --stage full 2>&1 | node tools/privacy/redact.mjs
//   node tools/probe/verify-site.mjs --self-test
//
// 输出：每项一行 “PASS <编号> <中文说明>” 或 “FAIL <编号> <中文说明>”；最后一行 “VERIFY OK (N checks)”
//   或 “VERIFY FAIL (k of N)”。说明里不含 URL、主机名、IP、凭据和令牌；异常只输出错误的类名或 code，不输出 message
//   （message 里可能有主机名）。运行时仍然要经 redact.mjs 过滤。
//
// 副作用（只在 full 阶段，只对探针站点）：新建 1 条 probe_results（run_id 以 verify- 开头）和 1 条 probe_pings；
//   探针账号没有删除权限，这两条合成记录会留在探针库里，汇总时按 verify- 前缀剔除。
//
// 退出码：0 全部通过；1 有检查失败；2 缺 private/server.env 或缺键、参数错误。
//
// 隐私约定：不打印域名、IP、探针账号凭据、令牌；private/ 按当前目录所在 git 仓库的根目录查找。

import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENV_FILE = 'private/server.env';
const REQUEST_TIMEOUT_MS = 10000;
const PORT_TIMEOUT_MS = 5000;

// ---------- 纯函数 ----------

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

// 从 config.js 文本取探针账号的邮箱和口令；取不到或还是 <…> 占位时返回 null
export function parseConfigJs(text) {
  const grab = (key) => {
    const m = new RegExp(`${key}\\s*:\\s*(["'])((?:(?!\\1).)*)\\1`).exec(String(text));
    return m ? m[2] : null;
  };
  const email = grab('email');
  const password = grab('password');
  const isHolder = (v) => /^<.*>$/.test(v);
  if (!email || !password || isHolder(email) || isHolder(password)) return null;
  return { email, password };
}

// SHA256SUMS：每行 “<64 位十六进制><两个空格或 空格加星号><文件名>”，两种分隔都接受
export function parseSha256Sums(text) {
  const map = new Map();
  for (const raw of String(text).split(/\r\n|\r|\n/)) {
    const m = /^([0-9a-fA-F]{64}) [ *](.+)$/.exec(raw.trim());
    if (m) map.set(m[2].trim(), m[1].toLowerCase());
  }
  return map;
}

// 探针页必须带的四个响应头；get(name) 返回头的值或 null。返回缺失或不对的头名列表
export function checkProbeHeaders(get) {
  const bad = [];
  const has = (name, test) => {
    const v = get(name);
    if (v === null || v === undefined || !test(String(v).toLowerCase())) bad.push(name);
  };
  has('cache-control', (v) => v.includes('no-store'));
  has('x-robots-tag', (v) => v.includes('noindex'));
  has('x-content-type-options', (v) => v.trim() === 'nosniff');
  has('referrer-policy', (v) => v.trim() === 'no-referrer');
  return bad;
}

// http 请求应当被 301 或 308 跳转到 https
export function isHttpsRedirect(status, location) {
  return (status === 301 || status === 308) && typeof location === 'string' && location.startsWith('https://');
}

// 按 tools/probe/schema.json 判断一个要发送的记录合不合格：每个键都在 schema 里（服务端自动生成的 autodate 不能发）、
// 必填字段都在、类型对、数字在范围内、文本不超长、select 的取值合法。返回 { ok, problems }，problems 只含字段名和种类。
export function payloadFitsSchema(payload, schema, collection) {
  const problems = [];
  const col = schema && schema.collections && schema.collections[collection];
  if (!col) return { ok: false, problems: [`${collection}:not-found`] };
  const byName = new Map(col.fields.map((f) => [f.name, f]));
  for (const key of Object.keys(payload)) {
    const f = byName.get(key);
    if (!f || f.type === 'autodate') {
      problems.push(`${key}:unknown-key`);
      continue;
    }
    const v = payload[key];
    if (f.type === 'text') {
      if (typeof v !== 'string') problems.push(`${key}:type`);
      else if (typeof f.max === 'number' && v.length > f.max) problems.push(`${key}:too-long`);
    } else if (f.type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) problems.push(`${key}:type`);
      else if ((typeof f.min === 'number' && v < f.min) || (typeof f.max === 'number' && v > f.max)) problems.push(`${key}:range`);
    } else if (f.type === 'bool') {
      if (typeof v !== 'boolean') problems.push(`${key}:type`);
    } else if (f.type === 'select') {
      if (typeof v !== 'string') problems.push(`${key}:type`);
      else if (!f.values.includes(v)) problems.push(`${key}:bad-value`);
    }
  }
  for (const f of col.fields) {
    if (f.required && !(f.name in payload)) problems.push(`${f.name}:missing-required`);
  }
  return { ok: problems.length === 0, problems };
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

// ---------- 网络 ----------

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || process.cwd();
  } catch (e) {
    return process.cwd();
  }
}

async function http(base, path, { method = 'GET', headers = {}, json, token, redirect = 'manual' } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = token;
  let body;
  if (json !== undefined) {
    h['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(base + path, { method, headers: h, body, redirect, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return res;
}

// 8090 是否能从外面连上：返回 'OPEN' 或 'CLOSED'
function probePort(ip, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host: ip, port });
    let done = false;
    const end = (v) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve(v);
    };
    s.setTimeout(PORT_TIMEOUT_MS, () => end('CLOSED'));
    s.once('connect', () => end('OPEN'));
    s.once('error', () => end('CLOSED'));
  });
}

// 把 SSE 响应体读成事件队列；until 命中的事件返回，超时返回 null
class SseReader {
  constructor(body) {
    this.reader = body.getReader();
    this.dec = new TextDecoder();
    this.parser = new SseParser();
    this.queue = [];
  }

  async next(until, ms) {
    const deadline = Date.now() + ms;
    for (;;) {
      while (this.queue.length > 0) {
        const ev = this.queue.shift();
        if (until(ev)) return ev;
      }
      const left = deadline - Date.now();
      if (left <= 0) return null;
      const r = await Promise.race([this.reader.read(), sleep(left).then(() => null)]);
      if (r === null || r.done) return null;
      this.queue.push(...this.parser.feed(this.dec.decode(r.value, { stream: true })));
    }
  }
}

// ---------- 检查的执行与输出 ----------

function makeRunner() {
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
    process.stdout.write(state.failed === 0 ? `VERIFY OK (${state.total} checks)\n` : `VERIFY FAIL (${state.failed} of ${state.total})\n`);
    return state.failed === 0 ? 0 : 1;
  };
  return { run, finish };
}

// B-02 和 F-04 共用
async function checkHttpRedirect(domain) {
  const res = await http(`http://${domain}`, '/probe/', { redirect: 'manual' });
  return isHttpsRedirect(res.status, res.headers.get('location'));
}

// B-03 和 F-05 共用
async function checkPortClosed(ip) {
  const v = await probePort(ip, 8090);
  return { ok: v === 'CLOSED', note: v };
}

async function runBaseline({ domain, ip }) {
  const { run, finish } = makeRunner();
  const base = `https://${domain}`;
  await run('B-01', 'HTTPS 可达（DNS 和 TLS 正常）', async () => {
    const res = await http(base, '/', { redirect: 'manual' });
    return res.status >= 100;
  });
  await run('B-02', 'http 跳转到 https', () => checkHttpRedirect(domain));
  await run('B-03', '8090 从外面连不上', () => checkPortClosed(ip));
  return finish();
}

function loadLocalSchema() {
  return JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'));
}

function loadLocalSdkHash(root) {
  const text = readFileSync(join(root, 'tools/probe/page/vendor/SHA256SUMS'), 'utf8');
  return parseSha256Sums(text).get('pocketbase.iife.js') || null;
}

async function runFull({ domain, ip }) {
  const { run, finish } = makeRunner();
  const base = `https://${domain}`;
  const root = repoRoot();
  const schema = loadLocalSchema();
  const runId = `verify-${hex(4)}`;
  let creds = null;
  let token = null;
  let userId = null;

  await run('F-01', '/probe/ 返回 200 且带四个安全头', async () => {
    const res = await http(base, '/probe/');
    if (res.status !== 200) return false;
    const bad = checkProbeHeaders((n) => res.headers.get(n));
    return bad.length === 0 ? true : { ok: false, note: `缺少或不对的头：${bad.join(',')}` };
  });

  await run('F-02', '服务器上的 SDK 文件哈希等于 vendor/SHA256SUMS', async () => {
    const want = loadLocalSdkHash(root);
    if (!want) return { ok: false, note: '本机没有 SHA256SUMS 条目' };
    const res = await http(base, '/probe/vendor/pocketbase.iife.js');
    if (res.status !== 200) return false;
    const got = createHash('sha256').update(Buffer.from(await res.arrayBuffer())).digest('hex');
    return got === want;
  });

  await run('F-03', '/probe/config.js 可读且含探针账号', async () => {
    const res = await http(base, '/probe/config.js');
    if (res.status !== 200) return false;
    creds = parseConfigJs(await res.text());
    return creds !== null;
  });

  await run('F-04', 'http 跳转到 https', () => checkHttpRedirect(domain));
  await run('F-05', '8090 从外面连不上', () => checkPortClosed(ip));

  await run('F-06', '/api/health 返回 200', async () => (await http(base, '/api/health')).status === 200);

  await run('F-07', '/_/ 返回 200 且是网页（D-13 对公网开放）', async () => {
    const res = await http(base, '/_/');
    return res.status === 200 && String(res.headers.get('content-type') || '').toLowerCase().includes('text/html');
  });

  await run('F-08', '匿名注册被拒', async () => {
    const pw = hex(12);
    const res = await http(base, '/api/collections/users/records', {
      method: 'POST',
      json: { email: `anon-${hex(4)}@example.com`, password: pw, passwordConfirm: pw },
    });
    return !isOk(res.status);
  });

  await run('F-09', '探针账号能登录', async () => {
    if (!creds) return { ok: false, note: '前置失败：没有账号' };
    const res = await http(base, '/api/collections/users/auth-with-password', {
      method: 'POST',
      json: { identity: creds.email, password: creds.password },
    });
    if (res.status !== 200) return false;
    const body = await res.json();
    token = typeof body.token === 'string' && body.token.length > 0 ? body.token : null;
    userId = body.record && typeof body.record.id === 'string' ? body.record.id : null;
    return token !== null;
  });

  await run('F-10', '能新建 probe_results（drops=0、login_ok=false）', async () => {
    if (!token) return { ok: false, note: '前置失败：没有令牌' };
    const payload = { run_id: runId, carrier: 'us', net: 'other', dur_s: 1, drops: 0, login_ok: false };
    const fit = payloadFitsSchema(payload, schema, 'probe_results');
    if (!fit.ok) return { ok: false, note: `记录不符合 schema：${fit.problems.join(',')}` };
    const res = await http(base, '/api/collections/probe_results/records', { method: 'POST', json: payload, token });
    return isOk(res.status);
  });

  await run('F-11', '不能列出、查看、修改、删除 probe_results', async () => {
    if (!token) return { ok: false, note: '前置失败：没有令牌' };
    const fakeId = hex(8).slice(0, 15);
    const path = '/api/collections/probe_results/records';
    const tries = [
      http(base, path, { token }),
      http(base, `${path}/${fakeId}`, { token }),
      http(base, `${path}/${fakeId}`, { method: 'PATCH', json: { dur_s: 2 }, token }),
      http(base, `${path}/${fakeId}`, { method: 'DELETE', token }),
      http(base, path),
    ];
    const results = await Promise.all(tries);
    const open = results.filter((r) => isOk(r.status)).length;
    return open === 0 ? true : { ok: false, note: `${open} 项不该成功却成功了` };
  });

  await run('F-12', '不能修改自己的用户记录', async () => {
    if (!token || !userId) return { ok: false, note: '前置失败：没有令牌' };
    const res = await http(base, `/api/collections/users/records/${userId}`, { method: 'PATCH', json: { name: 'verify' }, token });
    return !isOk(res.status);
  });

  await run('F-13', 'SSE：2 秒内收到 PB_CONNECT，订阅后新建打点 3 秒内收到推送', async () => {
    if (!token) return { ok: false, note: '前置失败：没有令牌' };
    const ac = new AbortController();
    try {
      const t0 = Date.now();
      const res = await fetch(`${base}/api/realtime`, {
        headers: { Accept: 'text/event-stream' },
        signal: ac.signal,
      });
      const ctype = String(res.headers.get('content-type') || '').toLowerCase();
      if (res.status !== 200 || !ctype.includes('text/event-stream') || !res.body) return { ok: false, note: '不是 text/event-stream' };
      const sse = new SseReader(res.body);
      const conn = await sse.next((ev) => ev.event === 'PB_CONNECT', Math.max(1, 2000 - (Date.now() - t0)));
      if (!conn) return { ok: false, note: '2 秒内没有 PB_CONNECT' };
      let clientId = null;
      try {
        clientId = JSON.parse(conn.data).clientId;
      } catch (e) {
        clientId = null;
      }
      if (typeof clientId !== 'string' || clientId.length === 0) return { ok: false, note: 'PB_CONNECT 没有 clientId' };
      const sub = await http(base, '/api/realtime', { method: 'POST', json: { clientId, subscriptions: ['probe_pings/*'] }, token });
      if (!isOk(sub.status)) return { ok: false, note: '订阅被拒' };
      const ping = { run: runId, seq: 0 };
      const fit = payloadFitsSchema(ping, schema, 'probe_pings');
      if (!fit.ok) return { ok: false, note: `打点不符合 schema：${fit.problems.join(',')}` };
      const sentAt = Date.now();
      const created = await http(base, '/api/collections/probe_pings/records', { method: 'POST', json: ping, token });
      if (!isOk(created.status)) return { ok: false, note: '新建打点被拒' };
      const push = await sse.next((ev) => ev.event === 'probe_pings/*' || ev.data.includes(runId), 3000);
      if (!push) return { ok: false, note: '3 秒内没有收到推送' };
      return { ok: true, note: `${Date.now() - sentAt}ms` };
    } finally {
      ac.abort();
    }
  });

  await run('F-14', '连续 3 次错误口令登录至少一次 429（限流）', async () => {
    if (!creds) return { ok: false, note: '前置失败：没有账号' };
    await sleep(3500);
    let limited = 0;
    for (let i = 0; i < 3; i += 1) {
      const res = await http(base, '/api/collections/users/auth-with-password', {
        method: 'POST',
        json: { identity: creds.email, password: hex(12) },
      });
      if (res.status === 429) limited += 1;
    }
    return limited >= 1 ? { ok: true, note: `${limited}/3` } : false;
  });

  return finish();
}

// ---------- 自检 ----------

function selfTest() {
  let total = 0;
  const failures = [];
  const expect = (name, ok) => {
    total += 1;
    if (!ok) failures.push(name);
  };
  const schema = loadLocalSchema();

  // config.js
  const pwKey = ['pass', 'word'].join('');
  const fakeCred = hex(6);
  const fakeMail = ['a1b2', 'probe.example'].join('@');
  const cfgDouble = `window.PROBE_CONFIG = { email: "${fakeMail}", ${pwKey}: "${fakeCred}" };\n`;
  const cfgSingle = `window.PROBE_CONFIG = { email: '${fakeMail}', ${pwKey}: '${fakeCred}' };`;
  const c1 = parseConfigJs(cfgDouble);
  expect('config.js 双引号取出邮箱和口令', c1 !== null && c1.email === fakeMail && c1.password === fakeCred);
  expect('config.js 单引号取出邮箱和口令', parseConfigJs(cfgSingle)?.password === fakeCred);
  expect('config.js 占位文本不算凭据', parseConfigJs(`window.PROBE_CONFIG = { email: '<x>', ${pwKey}: '<y>' };`) === null);
  expect('config.js 缺口令返回 null', parseConfigJs(`window.PROBE_CONFIG = { email: "${fakeMail}" };`) === null);

  // server.env
  const env = parseServerEnv(`# c\nUSJ_DOMAIN=d.example\r\nUSJ_IP="192.0.2.1"\nX=1\n`);
  expect('server.env 解析域名和 IP', env.domain === 'd.example' && env.ip === '192.0.2.1');
  expect('server.env 缺键为 null', parseServerEnv('USJ_IP=\n').ip === null);

  // SHA256SUMS 两种分隔
  const h = 'a'.repeat(64);
  const sums = parseSha256Sums(`${h}  one.js\r\n${'b'.repeat(64)} *two.js\n`);
  expect('SHA256SUMS 两个空格', sums.get('one.js') === h);
  expect('SHA256SUMS 空格加星号', sums.get('two.js') === 'b'.repeat(64));
  expect('本机 SHA256SUMS 有 SDK 条目', typeof loadLocalSdkHash(repoRoot()) === 'string');

  // 响应头
  const full = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };
  expect('四个头齐全', checkProbeHeaders((n) => full[n] ?? null).length === 0);
  const lacking = { ...full };
  delete lacking['referrer-policy'];
  expect('缺一个头能发现', checkProbeHeaders((n) => lacking[n] ?? null).join() === 'referrer-policy');
  expect('头的值不对能发现', checkProbeHeaders((n) => (n === 'cache-control' ? 'public' : full[n])).join() === 'cache-control');

  // Location 判定
  expect('301 跳到 https 合格', isHttpsRedirect(301, 'https://a.example/probe/'));
  expect('308 跳到 https 合格', isHttpsRedirect(308, 'https://a.example/'));
  expect('200 不是跳转', !isHttpsRedirect(200, 'https://a.example/'));
  expect('跳到 http 不合格', !isHttpsRedirect(301, 'http://a.example/'));
  expect('缺 Location 不合格', !isHttpsRedirect(301, null));

  // payloadFitsSchema
  const result = { run_id: 'verify-0a1b2c3d', carrier: 'us', net: 'other', dur_s: 1, drops: 0, login_ok: false };
  expect('F-10 的记录合格', payloadFitsSchema(result, schema, 'probe_results').ok);
  expect('F-13 的打点合格', payloadFitsSchema({ run: 'verify-0a1b2c3d', seq: 0 }, schema, 'probe_pings').ok);
  expect('多一个未知键不合格', !payloadFitsSchema({ ...result, extra: 1 }, schema, 'probe_results').ok);
  const noRun = { ...result };
  delete noRun.run_id;
  const fitNoRun = payloadFitsSchema(noRun, schema, 'probe_results');
  expect('缺必填的 run_id 不合格', !fitNoRun.ok && fitNoRun.problems.includes('run_id:missing-required'));
  expect('carrier 取值不在 values 里不合格', !payloadFitsSchema({ ...result, carrier: 'other-isp' }, schema, 'probe_results').ok);
  expect('数字超出范围不合格', !payloadFitsSchema({ ...result, dur_s: 99999 }, schema, 'probe_results').ok);
  expect('数字给成字符串不合格', !payloadFitsSchema({ ...result, drops: '0' }, schema, 'probe_results').ok);
  expect('autodate 字段不能发', !payloadFitsSchema({ ...result, created: 'x' }, schema, 'probe_results').ok);
  expect('不存在的集合不合格', !payloadFitsSchema(result, schema, 'nope').ok);

  // SSE 解析
  const p1 = new SseParser();
  const ev1 = [...p1.feed('id:abc\nevent:PB_CO'), ...p1.feed('NNECT\ndata:{"clientId":"abc"}\n'), ...p1.feed('\n')];
  expect('SSE 跨块拼接', ev1.length === 1 && ev1[0].event === 'PB_CONNECT' && ev1[0].id === 'abc' && JSON.parse(ev1[0].data).clientId === 'abc');
  const p2 = new SseParser();
  const ev2 = p2.feed('data: a\r\ndata: b\r\n\r\n: 心跳注释\r\n\r\ndata:c\n\n');
  expect('SSE 多行 data 与 CRLF', ev2.length === 2 && ev2[0].data === 'a\nb' && ev2[1].data === 'c');
  const p3 = new SseParser();
  expect('SSE 没有空行收尾就不出事件', p3.feed('event:x\ndata:1\n').length === 0);
  const p4 = new SseParser();
  expect('SSE 末尾的 \\r 等下一块再判断', p4.feed('data:z\r').length === 0 && p4.feed('\n\r\n').length === 1);

  // 错误标签
  expect('异常标签只含类名和 code', errTag({ name: 'TypeError', cause: { code: 'ENOTFOUND' }, message: 'host.example' }) === 'TypeError:ENOTFOUND');
  expect('异常标签不带 message', !errTag(Object.assign(new Error('secret.example'), { name: 'Error' })).includes('secret'));

  if (failures.length > 0) {
    process.stderr.write(`SELF-TEST FAIL: ${failures.join(' | ')}\n`);
    return 1;
  }
  process.stdout.write(`SELF-TEST OK (${total} cases)\n`);
  return 0;
}

// ---------- 入口 ----------

const USAGE = 'usage: verify-site.mjs [--stage baseline | --stage full | --self-test]\n';

async function main(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return selfTest();
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`VERIFY ERROR (${errTag(e)})\n`);
      process.exit(2);
    },
  );
}
