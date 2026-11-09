#!/usr/bin/env node
// 协议样本录制脚本（Phase 8，08-06，TEST-02）。零依赖，只用 node: 内置模块和仓库内的文件。
//
// 用途：在一次性本机 PocketBase 0.41.1 实例上，按场景表 tools/pb/lib/scenarios.cjs 逐步发请求，
// 把请求和响应先归一化（tools/pb/lib/normalize.cjs）、再过隐私闸门，最后写进 tests/mocks/pb-samples/。
// 录制客户端优先是在 node:vm 里运行已核对哈希的真实 SDK 0.28.1（研究 A5）；vm 里跑不起来时退回裸 fetch，
// 并在样本的 meta.client 里如实记录。
//
// 用法：
//   node tools/pb/record-samples.mjs               录制，写 rest.json（有实时场景时还有 realtime.json）
//   node tools/pb/record-samples.mjs --self-test   不需要程序：归一化、闸门、取整、状态码比较的自检
//   node tools/pb/record-samples.mjs --check       扫描样本目录：合法 JSON、版本、隐私规则 B/C/F/G/H 命中为零、场景 id 齐全
// 输出：最后一行 `SAMPLES WRITTEN <场景数>`、`NORMALIZE SELF-TEST OK` 或 `SAMPLES CLEAN <文件数>`。
// 退出码：0 成功；1 闸门、断言或状态码不一致失败；2 前提不满足（没有已批准的程序、SDK 哈希不符）。
//
// 隐私约定：合成账号、口令、错误口令全部运行时随机；本脚本只打印场景 id、步骤序号和状态码，
// 不打印请求或响应内容；样本只在归一化和闸门通过后写盘；不读 private/；不碰任何真实服务器。
// 闸门：对整个输出调用隐私检查器的 findTokenShapes，并检查没有令牌开头的子串；命中就不写文件、退出 1。
// 不加任何放行名单。

import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { PB_EXE_SHA256, verifyExe, withInstance } from './lib/instance.mjs';
import { openSse } from './lib/sse-client.mjs';

// 本机低优先级：用户的电脑容易卡
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  process.stderr.write('提示：没能把录制脚本调成低优先级，继续运行。\n');
}

const require = createRequire(import.meta.url);
const norm = require('./lib/normalize.cjs');
const sc = require('./lib/scenarios.cjs');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const SDK_FILE = path.join(REPO, 'tools', 'probe', 'page', 'vendor', 'pocketbase.iife.js');
const SDK_SUMS = path.join(REPO, 'tools', 'probe', 'page', 'vendor', 'SHA256SUMS');
const SAMPLES_DIR = path.join(REPO, 'tests', 'mocks', 'pb-samples');
const SERVER_VERSION = '0.41.1';
const SDK_VERSION = '0.28.1';
const TOKEN_PREFIX = 'eyJ';

// ---------- 纯函数（自检也用） ----------

const sha256Buf = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// 录到的状态码是否与步骤的 expect 一致
export function statusMatches(got, expect) {
  return Number.isInteger(expect) && got === expect;
}

// 闸门：整个文本每一行 findTokenShapes 为零，且不含令牌开头的子串。返回 { ok, reason }
export function gateCheck(text, findTokenShapes) {
  if (text.includes(TOKEN_PREFIX)) return { ok: false, reason: 'token-prefix' };
  const lines = text.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (findTokenShapes(lines[i]).length > 0) return { ok: false, reason: `token-shape line ${i + 1}` };
  }
  return { ok: true, reason: 'ok' };
}

// 过了闸门才写盘；返回是否写了
export function writeGuarded(file, text, findTokenShapes) {
  const g = gateCheck(text, findTokenShapes);
  if (!g.ok) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return true;
}

const b64u = (buf) => Buffer.from(buf).toString('base64url');

// 运行时拼接三段令牌形状：头和载荷是对象 JSON 的 base64url（所以以令牌开头子串起头），签名段随机
function makeShapedToken(payload) {
  const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  return `${head}.${body}.${b64u(crypto.randomBytes(32))}`;
}

async function loadPrivacy() {
  return import(pathToFileURL(path.join(REPO, 'tools', 'privacy', 'privacy-check.mjs')).href);
}

// ---------- 自检 ----------

async function selfTest() {
  const { findTokenShapes } = await loadPrivacy();
  let n = 0;
  const check = (name, ok) => {
    n += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${name}`);
    if (!ok) process.exitCode = 1;
    return ok;
  };
  const nowSeconds = 1_800_000_000;
  const token = makeShapedToken({ id: 'a1b2c3d4e5f6g7h', type: 'auth', exp: nowSeconds + 7776000, collectionId: '_pb_users_auth_', refreshable: true });

  // 1. 反向对照：未归一化时命中，归一化后为零
  check('未归一化的令牌被 findTokenShapes 命中', findTokenShapes(`x ${token} y`).length > 0);
  const ctx1 = norm.createContext();
  const viaKey = JSON.stringify(norm.normalizeValue({ token, record: { id: 'a1b2c3d4e5f6g7h' } }, ctx1));
  check('键为 token 的值归一化后命中为零', findTokenShapes(viaKey).length === 0 && !viaKey.includes(TOKEN_PREFIX));
  const viaText = JSON.stringify(norm.normalizeValue({ message: `bad ${token} here` }, norm.createContext()));
  check('字符串里的令牌形状归一化后命中为零', findTokenShapes(viaText).length === 0 && !viaText.includes(TOKEN_PREFIX));
  const ex = norm.normalizeExchange(
    { request: { method: 'POST', path: '/api/x', hasAuth: true, body: {} }, response: { status: 200, body: { token, record: { id: 'zzzzzzzzzzzzzzz' } } } },
    norm.createContext(),
  );
  check('归一化后的整个交换命中为零', gateCheck(JSON.stringify(ex), findTokenShapes).ok);
  check('闸门对归一化前的交换返回失败', !gateCheck(JSON.stringify({ response: { body: { token } } }), findTokenShapes).ok);

  // 2. 各类归一化
  const c2 = norm.createContext();
  const out = norm.normalizeValue(
    {
      id: 'abcde12345fghij',
      other: 'zyxwv98765utsrq',
      created: '2026-01-02 03:04:05.678Z',
      email: `real-${crypto.randomBytes(4).toString('hex')}@example.com`,
      password: crypto.randomBytes(6).toString('hex'),
      passwordConfirm: crypto.randomBytes(6).toString('hex'),
      oldPassword: crypto.randomBytes(6).toString('hex'),
      tokenKey: crypto.randomBytes(8).toString('hex'),
      authToken: { secret: crypto.randomBytes(8).toString('hex'), duration: 7776000 },
      collectionId: '_pb_users_auth_',
      c2: 'pbc_1234567890',
      clientId: crypto.randomBytes(20).toString('hex'),
      again: 'abcde12345fghij',
    },
    c2,
  );
  check('记录 id 按首次出现换成 <ID:n>，同一个值同一个占位', out.id === '<ID:1>' && out.other === '<ID:2>' && out.again === '<ID:1>');
  check('时间戳换成 <TS>', out.created === '<TS>');
  check('邮箱换成保留域名地址', out.email === 'user-a@example.com');
  check('口令换成 <PASSWORD>', out.password === '<PASSWORD>' && out.passwordConfirm === '<PASSWORD>' && out.oldPassword === '<PASSWORD>');
  check('tokenKey 和 authToken.secret 被丢弃', !('tokenKey' in out) && !('secret' in out.authToken) && out.authToken.duration === 7776000);
  check('集合 id 换成占位', out.collectionId === '<USERS_COLLECTION_ID>' && out.c2 === '<COLLECTION_ID:1>');
  check('clientId 换成 <CLIENT_ID>', out.clientId === '<CLIENT_ID>');
  const big = norm.normalizeExchange(
    { request: { method: 'PATCH', path: '/p', hasAuth: true, body: { data: sc.oversizeData(4195328), writer: 'w' } }, response: { status: 400 } },
    norm.createContext(),
  );
  check('超大请求体换成 <OVERSIZE:字节数>', big.request.body.data === '<OVERSIZE:4195328>' && big.request.body.writer === 'w');

  // 3. tokenClaims 的取整
  const claims = [7775999, 7776000, 7776001].map((d) => norm.tokenClaims(makeShapedToken({ id: 'x', type: 'auth', exp: nowSeconds + d, collectionId: 'c' }), nowSeconds));
  check('tokenClaims 对 7775999、7776000、7776001 都得 7776000', claims.every((c) => c.expInSeconds === 7776000));
  check('tokenClaims 只返回键名和 type', JSON.stringify(Object.keys(claims[0]).sort()) === JSON.stringify(['expInSeconds', 'keys', 'type']) && claims[0].type === 'auth');

  // 4. 幂等
  const sample = { token, record: { id: 'abcde12345fghij', email: 'q@example.com', created: '2026-01-02 03:04:05.678Z' }, items: [{ id: 'zyxwv98765utsrq' }] };
  const once = norm.normalizeValue(sample, norm.createContext());
  const twice = norm.normalizeValue(once, norm.createContext());
  check('对归一化结果再归一化不变', JSON.stringify(once) === JSON.stringify(twice));

  // 5. 闸门：未归一化的令牌不写文件，通过时才写
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-rec-'));
  try {
    const bad = path.join(tmp, 'bad.json');
    const good = path.join(tmp, 'good.json');
    const wroteBad = writeGuarded(bad, JSON.stringify({ response: { body: { token } } }, null, 2), findTokenShapes);
    const wroteGood = writeGuarded(good, JSON.stringify(once, null, 2), findTokenShapes);
    check('闸门遇到未归一化的令牌时失败且没有写出文件', wroteBad === false && !fs.existsSync(bad));
    check('闸门对归一化结果放行并写出文件', wroteGood === true && fs.existsSync(good));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // 6. 状态码比较
  check('状态码与 expect 不同时比较失败', statusMatches(200, 200) && !statusMatches(404, 200) && !statusMatches(200, undefined));

  // 7. resolveStep 与令牌篡改
  const rctx = { users: { A: { id: 'u1', email: 'a@example.com', password: 'p-a', token: makeShapedToken({ exp: 1 }) } }, docs: { 'A:state': { id: 'd1' } } };
  const rs = sc.resolveStep({ path: '/x/{doc:A:state}', body: { owner: '{user:A}', data: '{oversize:70000}', p: '{password:wrong}' } }, rctx);
  check('resolveStep 换掉全部符号', rs.path === '/x/d1' && rs.body.owner === 'u1' && Buffer.byteLength(JSON.stringify(rs.body.data)) === 70000 && rs.body.p === rctx.wrongPassword);
  const t0 = rctx.users.A.token;
  const t1 = sc.invalidateToken(t0);
  check('篡改令牌只换最后一个字符且结果不同', t1 !== t0 && t1.slice(0, -1) === t0.slice(0, -1));

  if (process.exitCode) {
    console.log('NORMALIZE SELF-TEST FAILED');
    return;
  }
  console.log('NORMALIZE SELF-TEST OK');
}

// ---------- 录制客户端 ----------

class MismatchError extends Error {}

// 记录请求和响应的 fetch 包装：log 里每次调用追加 { request, response }
function makeRecordingFetch(log) {
  return async (url, init = {}) => {
    const u = new URL(String(url));
    const headers = {};
    const raw = init.headers;
    if (raw && typeof raw.forEach === 'function' && !Array.isArray(raw)) raw.forEach((v, k) => (headers[String(k).toLowerCase()] = v));
    else for (const k of Object.keys(raw || {})) headers[k.toLowerCase()] = raw[k];
    let reqBody;
    if (typeof init.body === 'string') {
      try {
        reqBody = JSON.parse(init.body);
      } catch {
        reqBody = init.body;
      }
    }
    const res = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(60000) });
    const text = await res.clone().text();
    let resBody = null;
    if (text) {
      try {
        resBody = JSON.parse(text);
      } catch {
        resBody = text;
      }
    }
    log.push({
      request: { method: String(init.method || 'GET').toUpperCase(), path: u.pathname, query: Object.fromEntries(u.searchParams), hasAuth: Boolean(headers.authorization), body: reqBody },
      response: { status: res.status, body: resBody },
      receivedAt: Math.floor(Date.now() / 1000),
    });
    return res;
  };
}

// 尝试在 node:vm 里运行已核对哈希的真实 SDK；失败返回 null（并说明原因类别）
function loadSdk(baseUrl, log) {
  try {
    const sandbox = {
      fetch: makeRecordingFetch(log),
      AbortController,
      AbortSignal,
      FormData,
      Blob,
      Headers,
      Response,
      Request,
      URL,
      URLSearchParams,
      TextEncoder,
      TextDecoder,
      atob,
      btoa,
      queueMicrotask,
      setTimeout,
      clearTimeout,
      console: { log() {}, warn() {}, error() {} },
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(SDK_FILE, 'utf8'), context, { filename: 'pocketbase.iife.js' });
    const PocketBase = vm.runInContext('PocketBase', context);
    if (typeof PocketBase !== 'function') return null;
    const pb = new PocketBase(baseUrl);
    pb.autoCancellation(false);
    return pb;
  } catch {
    return null;
  }
}

function headersFor(token, hasBody) {
  const h = {};
  if (hasBody) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = token;
  return h;
}

function buildUrl(baseUrl, p, query) {
  const qs = query && Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : '';
  return `${baseUrl}${p}${qs}`;
}

// 执行一个 REST 步骤，返回 { request, response, receivedAt }；恰好一次请求
async function execRest(env, step, token) {
  env.log.length = 0;
  if (env.pb) {
    const pb = env.pb;
    if (token) pb.authStore.save(token, null);
    else pb.authStore.clear();
    try {
      if (step.method === 'POST' && step.path.endsWith('/auth-with-password')) {
        await pb.collection('users').authWithPassword(step.body.identity, step.body.password);
      } else if (step.method === 'POST' && step.path.endsWith('/auth-refresh')) {
        await pb.collection('users').authRefresh();
      } else {
        await pb.send(step.path, { method: step.method, query: step.query, body: step.body, requestKey: null });
      }
    } catch (e) {
      // SDK 对 4xx 抛 ClientResponseError，请求和响应已经记在 log 里；没有记录说明是网络失败
      if (env.log.length === 0) throw e;
    }
  } else {
    const hasBody = step.body !== undefined;
    try {
      await env.recFetch(buildUrl(env.baseUrl, step.path, step.query), {
        method: step.method,
        headers: headersFor(token, hasBody),
        body: hasBody ? JSON.stringify(step.body) : undefined,
      });
    } catch (e) {
      if (env.log.length === 0) throw e;
    }
  }
  if (env.log.length !== 1) throw new Error('录制异常：一个步骤没有恰好产生一次请求');
  return env.log[0];
}

// ---------- 录制一个场景 ----------

async function setupScenario(inst, scenario) {
  const ctx = { users: {}, docs: {} };
  for (const name of scenario.setup.users) {
    const email = `usj-${crypto.randomBytes(6).toString('hex')}@example.com`;
    const password = crypto.randomBytes(12).toString('hex');
    const r = await inst.su(`${sc.USERS}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, passwordConfirm: password, verified: true }),
    });
    if (r.status !== 200) throw new Error(`建账号失败（${scenario.id}，${r.status}）`);
    const rec = await r.json();
    const login = await fetch(`${inst.baseUrl}${sc.USERS}/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
      signal: AbortSignal.timeout(15000),
    });
    if (login.status !== 200) throw new Error(`账号登录失败（${scenario.id}，${login.status}）`);
    ctx.users[name] = { id: rec.id, email, password, token: (await login.json()).token };
  }
  for (const d of scenario.setup.docs || []) {
    const r = await inst.su(sc.DOCS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: ctx.users[d.owner].id, kind: d.kind, data: d.data || { _synthetic: true }, writer: 'setup' }),
    });
    if (r.status !== 200) throw new Error(`建文档失败（${scenario.id}，${r.status}）`);
    ctx.docs[`${d.owner}:${d.kind}`] = { id: (await r.json()).id };
  }
  return ctx;
}

function mismatch(scenario, index, expect, got) {
  throw new MismatchError(`STATUS MISMATCH ${scenario.id} step=${index + 1} expect=${expect} got=${got}`);
}

function stepRecord(step, ex, nctx, extra) {
  const n = norm.normalizeExchange(ex, nctx);
  const out = { as: step.as };
  if (step.op) out.op = step.op;
  out.expect = step.expect;
  out.request = n.request;
  out.response = n.response;
  if (ex.response.body && typeof ex.response.body.token === 'string') {
    out.tokenClaims = norm.tokenClaims(ex.response.body.token, ex.receivedAt || Math.floor(Date.now() / 1000));
  }
  return { ...out, ...(extra || {}) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function recordScenario(inst, env, scenario, meta) {
  const ctx = await setupScenario(inst, scenario);
  const nctx = norm.createContext();
  const steps = [];
  let conn = null;
  const realtime = scenario.steps.some((s) => s.op);

  // SDK 对真实令牌的 isValid 探测（研究 Pitfall 7）；只在录制第一个场景时做一次
  if (env.pb && meta.sdkIsValidOnRealToken === null && ctx.users.A) {
    env.pb.authStore.save(ctx.users.A.token, null);
    meta.sdkIsValidOnRealToken = env.pb.authStore.isValid === true;
    env.pb.authStore.clear();
  }

  try {
    for (let i = 0; i < scenario.steps.length; i += 1) {
      const step = sc.resolveStep(scenario.steps[i], ctx);
      const token = sc.identityToken(step.as, ctx);
      if (step.op === 'connect') {
        conn = await openSse(inst.baseUrl);
        ctx.clientId = conn.clientId;
        norm.addClientId(nctx, conn.clientId);
        const ev = conn.events.find((e) => e.event === 'PB_CONNECT');
        steps.push({ op: 'connect', as: 'anon', event: norm.normalizeEvent(ev, nctx) });
        continue;
      }
      if (step.op === 'expectEvent') {
        let ev = null;
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline && !(ev = conn.events.find((e) => e.event !== 'PB_CONNECT'))) await sleep(100);
        if (!ev) throw new Error(`REALTIME EVENT MISSING ${scenario.id} step=${i + 1}`);
        steps.push({ op: 'expectEvent', as: step.as, event: norm.normalizeEvent(ev, nctx) });
        continue;
      }
      let ex;
      if (step.op === 'subscribe') {
        env.log.length = 0;
        try {
          await env.recFetch(`${inst.baseUrl}/api/realtime`, { method: 'POST', headers: headersFor(token, true), body: JSON.stringify(step.body) });
        } catch (e) {
          if (env.log.length === 0) throw e;
        }
        if (env.log.length !== 1) throw new Error('录制异常：订阅步骤没有恰好产生一次请求');
        ex = env.log[0];
      } else {
        ex = await execRest(env, step, token);
      }
      if (!statusMatches(ex.response.status, step.expect)) mismatch(scenario, i, step.expect, ex.response.status);
      norm.addClientId(nctx, ctx.unknownClientId);
      steps.push(stepRecord(step, ex, nctx));
    }
  } finally {
    if (conn) await conn.close();
  }

  const docs = (scenario.setup.docs || []).map((d) => ({ owner: d.owner, kind: d.kind }));
  void realtime;
  return { id: scenario.id, setup: { users: scenario.setup.users, docs }, steps };
}

// ---------- 录制入口 ----------

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function record() {
  const exe = verifyExe();
  if (!exe.ok) {
    console.error(`前提不满足：PocketBase 程序核对失败（${exe.code}）`);
    return 2;
  }
  const sdkBytes = fs.readFileSync(SDK_FILE);
  const sdkSha = sha256Buf(sdkBytes);
  const sums = fs.readFileSync(SDK_SUMS, 'utf8').split(/\r?\n/).filter((l) => l.trim());
  if (sums.length !== 1 || sums[0].split(/\s+/)[0] !== sdkSha) {
    console.error('前提不满足：SDK 文件的 sha256 与 SHA256SUMS 不一致');
    return 2;
  }
  const { findTokenShapes } = await loadPrivacy();

  const meta = {
    server: SERVER_VERSION,
    sdk: SDK_VERSION,
    exeSha256: PB_EXE_SHA256,
    sdkSha256: sdkSha,
    recordedOn: today(),
    client: 'fetch',
    sdkIsValidOnRealToken: null,
    tool: 'tools/pb/record-samples.mjs',
  };

  const rest = [];
  const realtime = [];
  try {
    await withInstance({}, async (inst) => {
      await inst.ensureRateLimitsOff();
      const log = [];
      const recFetch = makeRecordingFetch(log);
      const pb = loadSdk(inst.baseUrl, log);
      const env = { baseUrl: inst.baseUrl, log, recFetch, pb };
      meta.client = pb ? 'sdk-vm' : 'fetch';
      if (!pb) console.error('提示：SDK 没能在 node:vm 里运行，退回裸 fetch 录制。');
      for (const scenario of [...sc.REST_SCENARIOS, ...sc.REALTIME_SCENARIOS]) {
        const rec = await recordScenario(inst, env, scenario, meta);
        (scenario.steps.some((s) => s.op) ? realtime : rest).push(rec);
        console.log(`RECORDED ${scenario.id} steps=${rec.steps.length}`);
      }
    });
  } catch (e) {
    if (e instanceof MismatchError || /^REALTIME EVENT MISSING/.test(String(e && e.message))) {
      console.error(e.message);
      return 1;
    }
    console.error(`录制失败：${e && e.code ? e.code : 'error'} ${e && e.message ? e.message : ''}`);
    return typeof e.code === 'string' && ['missing', 'unpinned', 'mismatch'].includes(e.code) ? 2 : 1;
  }
  if (meta.client === 'sdk-vm' && meta.sdkIsValidOnRealToken !== true) {
    console.error('SDK 的 authStore.isValid 在真实令牌上不是真，不写文件');
    return 1;
  }

  const docs = [{ file: 'rest.json', scenarios: rest }];
  if (realtime.length > 0) docs.push({ file: 'realtime.json', scenarios: realtime });
  const texts = docs.map((d) => ({ file: d.file, text: `${JSON.stringify({ _synthetic: true, meta, scenarios: d.scenarios }, null, 2)}\n` }));
  for (const t of texts) {
    const g = gateCheck(t.text, findTokenShapes);
    if (!g.ok) {
      console.error(`闸门拒绝（${t.file}：${g.reason}），不写文件`);
      return 1;
    }
  }
  for (const t of texts) {
    if (!writeGuarded(path.join(SAMPLES_DIR, t.file), t.text, findTokenShapes)) {
      console.error('闸门拒绝，不写文件');
      return 1;
    }
  }
  console.log(`SAMPLES WRITTEN ${rest.length + realtime.length}`);
  return 0;
}

// ---------- --check ----------

async function check() {
  const { scanText, findTokenShapes } = await loadPrivacy();
  const wanted = ['B', 'C', 'F', 'G', 'H'];
  let bad = 0;
  const fail = (msg) => {
    bad += 1;
    console.log(`FAIL ${msg}`);
  };
  const files = fs.existsSync(SAMPLES_DIR) ? fs.readdirSync(SAMPLES_DIR).filter((f) => f.endsWith('.json')).sort() : [];
  const ids = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(SAMPLES_DIR, f), 'utf8');
    let doc;
    try {
      doc = JSON.parse(text);
    } catch {
      fail(`${f} 不是合法 JSON`);
      continue;
    }
    if (doc._synthetic !== true) fail(`${f} 缺少 _synthetic`);
    if (!doc.meta || doc.meta.server !== SERVER_VERSION) fail(`${f} 的 meta.server 不是 ${SERVER_VERSION}`);
    if (!doc.meta || doc.meta.sdk !== SDK_VERSION) fail(`${f} 的 meta.sdk 不是 ${SDK_VERSION}`);
    if (text.includes(TOKEN_PREFIX) || !gateCheck(text, findTokenShapes).ok) fail(`${f} 含令牌开头的子串`);
    const hits = scanText(f, text).filter((x) => wanted.some((w) => String(x.rule).startsWith(`${w}-`) || String(x.rule) === w));
    for (const h of hits) fail(`${h.location} 命中规则 ${h.rule}`);
    for (const s of doc.scenarios || []) ids.push(s.id);
  }
  const expected = [...sc.REST_SCENARIOS, ...sc.REALTIME_SCENARIOS].map((s) => s.id).sort();
  const got = [...ids].sort();
  if (JSON.stringify(expected) !== JSON.stringify(got)) fail(`场景 id 与场景表不一致（样本 ${got.length} 个，场景表 ${expected.length} 个）`);
  if (bad > 0) {
    console.log(`SAMPLES CHECK FAILED ${bad}`);
    return 1;
  }
  console.log(`SAMPLES CLEAN ${files.length}`);
  return 0;
}

// ---------- 入口 ----------

async function main() {
  const arg = process.argv[2];
  if (arg === '--self-test') {
    await selfTest();
    return process.exitCode || 0;
  }
  if (arg === '--check') return check();
  if (arg === undefined) return record();
  console.error('用法：node tools/pb/record-samples.mjs [--self-test | --check]');
  return 2;
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntry) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (e) => {
      console.error(`录制脚本出错：${e && e.message ? e.message : 'error'}`);
      process.exitCode = 1;
    },
  );
}
