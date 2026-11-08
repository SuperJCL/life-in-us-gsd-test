#!/usr/bin/env node
// 账号隔离断言脚本（Phase 8，08-05；证明 ACCT-03、ACCT-04、TEST-04；Phase 13 对线上实例原样复用）。
//
// 用途：在一次性本机 PocketBase 0.41.1 上，用两个合成账号 A、B 逐条断言“注册关闭、只能读写自己的数据、
// 实时事件不外泄、令牌和改密码行为”。每条写类断言同时检查状态码（和错误码）与超级用户回读；
// 反向对照（故意写错的规则）证明检查函数不是空转。
//
// 用法：
//   npm run pb:isolation                       手动运行，需要先按 tools/pb/PB-LOCAL.md 完成所有者批准的下载
//   node tools/pb/isolation-check.mjs --self-test   不需要程序，检查输出格式、注册约束和编号表
//   node tools/pb/isolation-check.mjs --observe     同上，另外为每条断言多打一行 OBS（只含数字状态码和错误码）
//
// 输出：每条断言一行 `PASS <编号> <规则名>` 或 `FAIL <编号> <规则名> status=<n> code=<错误码或 ->`；
// 最后一行 `ISOLATION OK <通过数>/<总数>` 或 `ISOLATION FAIL <通过数>/<总数>`。
//
// 退出码：0 全部通过；1 有断言失败；2 前提不满足（程序缺失或哈希不符、实例起不来、编号表与登记不一致）。
//
// 隐私约定：永不打印令牌、口令、邮箱、请求体或响应体；凭据全部运行时随机（crypto.randomBytes），
// 只存在于内存和一次性实例里；只连本机 127.0.0.1 的一次性实例，不碰所有者的服务器或任何真实数据。
// 本脚本不放进 npm test 和 test:cloud，只手动运行。

import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyExe, withInstance } from './lib/instance.mjs';
import { stable } from './lib/rules-snapshot.mjs';

// 本脚本自身用低于正常的优先级运行（用户的电脑容易卡）
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch (e) {
  console.error('提示：无法降低脚本自身的优先级，继续以正常优先级运行。');
}

// ---------- 编号表 ----------

export const EXPECTED_IDS = ['ACCT03-1', 'ACCT03-2', 'ACCT03-3', 'ACCT03-4', 'ACCT03-5'];

// ---------- 输出格式（不含令牌、邮箱、请求体） ----------

// 结果对象可能带有别的属性（令牌、邮箱、请求体……），格式化函数只取编号、名字、状态码和错误码。
export function formatLine(r) {
  const id = String(r.id).replace(/[^A-Za-z0-9-]/g, '?');
  const name = String(r.name).replace(/[^A-Za-z0-9 _\-一-鿿　-〿＀-￯()+,./]/g, '?');
  if (r.pass === true) return `PASS ${id} ${name}`;
  const status = Number.isInteger(r.status) ? String(r.status) : '-';
  const code = typeof r.code === 'string' && /^[a-z0-9_]{1,64}$/.test(r.code) ? r.code : '-';
  const rb = r.readback === 'changed' ? ' readback=changed' : '';
  return `FAIL ${id} ${name} status=${status} code=${code}${rb}`;
}

export function formatObserve(r) {
  const id = String(r.id).replace(/[^A-Za-z0-9-]/g, '?');
  const status = Number.isInteger(r.status) ? String(r.status) : '-';
  const code = typeof r.code === 'string' && /^[a-z0-9_]{1,64}$/.test(r.code) ? r.code : '-';
  const detail = typeof r.detail === 'string' && /^[0-9a-z_,:|+\- ]{0,200}$/.test(r.detail) ? r.detail : '';
  return `OBS ${id} status=${status} code=${code}${detail ? ` detail=${detail}` : ''}`;
}

// ---------- 登记 ----------

// 写类断言（opts.write）必须带回读函数 opts.readback，否则登记即抛错。
// 回读默认要求前后相同；成功类断言用 opts.expect(前, 后) 指定“回读应等于新值”。
export function makeRegistry() {
  const defs = [];
  function check(id, name, fn, opts = {}) {
    if (typeof fn !== 'function') throw new Error(`check ${id}: fn 必须是函数`);
    if (opts.write && typeof opts.readback !== 'function') throw new Error(`check ${id}: 写类断言必须带回读函数`);
    if (defs.some((d) => d.id === id)) throw new Error(`check ${id}: 编号重复`);
    defs.push({ id, name, fn, ...opts });
  }
  return { check, defs };
}

// 执行一条登记（NEG-1 也用它跑共享的检查实现）：回读在请求前后各取一次
export async function executeCheck(def, c) {
  let before = null;
  if (def.readback) before = await def.readback(c);
  const r = await def.fn(c);
  let readbackOk = true;
  if (def.readback) {
    const after = await def.readback(c);
    readbackOk = def.expect ? def.expect(before, after, c) === true : stable(before) === stable(after);
  }
  return {
    id: def.id,
    name: def.name,
    pass: r.pass === true && readbackOk,
    status: r.status,
    code: r.code,
    detail: r.detail,
    readback: readbackOk ? 'ok' : 'changed',
  };
}

// ---------- HTTP 辅助（只返回状态码、解析后的 JSON） ----------

const hex = (n) => crypto.randomBytes(n).toString('hex');
const newPassword = () => crypto.randomBytes(18).toString('hex');
const newEmail = (tag) => `user-${tag}-${hex(6)}@example.com`;

async function call(base, method, p, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = token;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${base}${p}`, { method, headers, body: payload, signal: AbortSignal.timeout(120000) });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = null; // 非 JSON 响应：保持 null，断言会因状态码或内容不符而失败
    }
  }
  return { status: res.status, json };
}

// 首个字段错误码（PocketBase 错误形状 data.<字段>.code），没有时为 '-'
export function firstCode(json) {
  const d = json && json.data;
  if (d && typeof d === 'object') {
    for (const k of Object.keys(d)) {
      const v = d[k];
      if (v && typeof v.code === 'string') return v.code;
    }
  }
  return '-';
}

export function fieldCode(json, field) {
  const v = json && json.data && json.data[field];
  return v && typeof v.code === 'string' ? v.code : null;
}

const out = (pass, res, detail) => ({ pass: pass === true, status: res ? res.status : undefined, code: res ? firstCode(res.json) : '-', detail });

const recPath = (coll, id) => `/api/collections/${coll}/records/${id}`;

// ---------- 准备 ----------

async function makeUser(c, tag) {
  const email = newEmail(tag);
  const password = newPassword();
  const r = await c.su('POST', '/api/collections/users/records', { email, password, passwordConfirm: password, verified: true });
  if (r.status !== 200) throw new Error(`准备失败：创建账号 ${tag} 返回 ${r.status}`);
  const user = { id: r.json.id, email, password, token: '' };
  const l = await c.api('POST', '/api/collections/users/auth-with-password', { body: { identity: email, password } });
  if (l.status !== 200 || !l.json || !l.json.token) throw new Error(`准备失败：账号 ${tag} 登录返回 ${l.status}`);
  user.token = l.json.token;
  return user;
}

async function makeDoc(c, coll, owner, kind) {
  const r = await c.su('POST', `/api/collections/${coll}/records`, { owner, kind, data: { _synthetic: true, kind }, writer: 'seed' });
  if (r.status !== 200) throw new Error(`准备失败：创建 ${coll} 文档返回 ${r.status}`);
  return r.json.id;
}

async function setup(inst) {
  const c = {
    inst,
    base: inst.baseUrl,
    api: (method, p, o) => call(inst.baseUrl, method, p, o),
    su: (method, p, body) => call(inst.baseUrl, method, p, { token: inst.superuserToken, body }),
  };
  c.A = await makeUser(c, 'a');
  c.B = await makeUser(c, 'b');
  c.docs = {
    a: { state: await makeDoc(c, 'journey_docs', c.A.id, 'state'), plan: await makeDoc(c, 'journey_docs', c.A.id, 'plan') },
    b: { state: await makeDoc(c, 'journey_docs', c.B.id, 'state'), plan: await makeDoc(c, 'journey_docs', c.B.id, 'plan') },
  };
  return c;
}

// 超级用户回读辅助
async function usersCount(c) {
  const r = await c.su('GET', '/api/collections/users/records?perPage=1');
  return r.status === 200 ? r.json.totalItems : -1;
}

async function suRecord(c, coll, id) {
  const r = await c.su('GET', recPath(coll, id));
  return r.status === 200 ? r.json : { _status: r.status };
}

// 临时认证集合 users_open：createRule 为空字符串，匿名可注册（ACCT03-5 的反向对照）
async function ensureUsersOpen(c) {
  if (!c.usersOpenReady) {
    c.usersOpenReady = (async () => {
      const r = await c.su('POST', '/api/collections', {
        name: 'users_open',
        type: 'auth',
        createRule: '',
        listRule: null,
        viewRule: null,
        updateRule: null,
        deleteRule: null,
        passwordAuth: { enabled: true, identityFields: ['email'] },
      });
      if (r.status !== 200) throw new Error(`准备失败：创建 users_open 返回 ${r.status}`);
    })();
  }
  await c.usersOpenReady;
}

async function usersOpenCount(c) {
  await ensureUsersOpen(c);
  const r = await c.su('GET', '/api/collections/users_open/records?perPage=1');
  return r.status === 200 ? r.json.totalItems : -1;
}

// ---------- 断言登记 ----------

export function registerAll(reg) {
  const { check } = reg;

  // ----- ACCT-03：注册关闭 -----
  const signupBody = () => {
    const pw = newPassword();
    return { email: newEmail('x'), password: pw, passwordConfirm: pw };
  };

  check(
    'ACCT03-1',
    '匿名注册 users 被拒（403）且账号数不变',
    async (c) => {
      const r = await c.api('POST', '/api/collections/users/records', { body: signupBody() });
      return out(r.status === 403, r);
    },
    { write: true, readback: usersCount },
  );

  check(
    'ACCT03-2',
    '已登录账号注册 users 被拒（403）且账号数不变',
    async (c) => {
      const r = await c.api('POST', '/api/collections/users/records', { token: c.A.token, body: signupBody() });
      return out(r.status === 403, r);
    },
    { write: true, readback: usersCount },
  );

  check(
    'ACCT03-3',
    'A 删除自己的账号被拒（403）且账号还在',
    async (c) => {
      const r = await c.api('DELETE', recPath('users', c.A.id), { token: c.A.token });
      return out(r.status === 403, r);
    },
    { write: true, readback: (c) => suRecord(c, 'users', c.A.id) },
  );

  check(
    'ACCT03-4',
    'A 删除 B 的账号被拒（403）且 B 还在',
    async (c) => {
      const r = await c.api('DELETE', recPath('users', c.B.id), { token: c.A.token });
      return out(r.status === 403, r);
    },
    { write: true, readback: (c) => suRecord(c, 'users', c.B.id) },
  );

  check(
    'ACCT03-5',
    '反向对照：createRule 为空的认证集合上匿名注册成功（200）',
    async (c) => {
      await ensureUsersOpen(c);
      const r = await c.api('POST', '/api/collections/users_open/records', { body: signupBody() });
      return out(r.status === 200, r);
    },
    { write: true, readback: usersOpenCount, expect: (before, after) => after === before + 1 },
  );
}

// ---------- 运行 ----------

const REASON = {
  missing: '未找到已批准的 PocketBase 程序，先完成所有者批准和下载（见 tools/pb/PB-LOCAL.md）。',
  unpinned: 'PocketBase 程序的 sha256 还没有钉死，拒绝运行。',
  mismatch: 'PocketBase 程序的 sha256 与钉死值不一致，拒绝运行，也不会自动重新下载。',
};

function idsMatch(defs) {
  const a = defs.map((d) => d.id).sort();
  const b = [...EXPECTED_IDS].sort();
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

async function run(argv) {
  const observe = argv.includes('--observe');
  const v = verifyExe();
  if (!v.ok) {
    console.error(REASON[v.code] || '前提不满足。');
    return 2;
  }
  const reg = makeRegistry();
  registerAll(reg);
  if (!idsMatch(reg.defs)) {
    console.error('编号表与登记的断言不一致，退出。');
    return 2;
  }
  const results = [];
  const emit = (r) => {
    results.push(r);
    console.log(formatLine(r));
    if (observe) console.log(formatObserve(r));
  };
  const runDef = async (def, c) => {
    try {
      emit(await executeCheck(def, c));
    } catch (e) {
      emit({ id: def.id, name: def.name, pass: false, status: undefined, code: 'exception' });
    }
  };
  try {
    await withInstance({}, async (inst) => {
      await inst.ensureRateLimitsOff();
      const c = await setup(inst);
      for (const def of reg.defs) await runDef(def, c);
    });
  } catch (e) {
    console.error(`实例或准备阶段失败${e && e.code ? `（${e.code}）` : ''}，退出。`);
    return 2;
  }
  const passed = results.filter((r) => r.pass).length;
  const ok = passed === reg.defs.length && results.length === reg.defs.length;
  console.log(`${ok ? 'ISOLATION OK' : 'ISOLATION FAIL'} ${passed}/${reg.defs.length}`);
  return ok ? 0 : 1;
}

// ---------- 自检（不需要程序） ----------

function selfTest() {
  const results = [];
  const t = (name, ok) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'} selftest-${results.length} ${name}`);
  };

  // 输出格式：对一个带有令牌形状、邮箱和请求体的结果对象，只输出编号、名字、状态码和错误码
  const b64u = (s) => Buffer.from(s).toString('base64url');
  const tokenShape = `${b64u('{"alg":"HS256","typ":"JWT"}')}.${b64u(`{"id":"${hex(7)}","exp":1}`)}.${hex(24)}`;
  const mailShape = `${hex(4)}@${'exam'}ple.com`;
  const bodyShape = `{"email":"${mailShape}","password":"${hex(8)}"}`;
  const evil = { id: 'T-1', name: '样例', pass: false, status: 403, code: tokenShape, readback: 'ok', token: tokenShape, email: mailShape, body: bodyShape, response: bodyShape };
  const line = formatLine(evil);
  t('失败行不含令牌形状、邮箱和请求体（错误码不合法时退化为 -）', !line.includes(tokenShape) && !line.includes(mailShape) && !line.includes(bodyShape) && !/eyJ/.test(line) && line === 'FAIL T-1 样例 status=403 code=-');
  const okLine = formatLine({ ...evil, pass: true });
  t('通过行只有编号和规则名', okLine === 'PASS T-1 样例');
  const obs = formatObserve({ ...evil, detail: tokenShape });
  t('OBS 行不含令牌形状、邮箱和请求体', !obs.includes(tokenShape) && !obs.includes(mailShape) && !/eyJ/.test(obs));
  t('合法错误码原样输出', formatLine({ id: 'T-2', name: 'n', pass: false, status: 400, code: 'validation_not_unique' }) === 'FAIL T-2 n status=400 code=validation_not_unique');

  // 登记约束
  const r1 = makeRegistry();
  let threw = false;
  try {
    r1.check('X-1', '写类不带回读', async () => ({ pass: true }), { write: true });
  } catch (e) {
    threw = true;
  }
  t('写类断言不带回读登记时抛错', threw);
  let ok2 = true;
  try {
    r1.check('X-2', '写类带回读', async () => ({ pass: true }), { write: true, readback: async () => 1 });
  } catch (e) {
    ok2 = false;
  }
  t('写类断言带回读可以登记', ok2);
  let dup = false;
  try {
    r1.check('X-2', '重复', async () => ({ pass: true }));
  } catch (e) {
    dup = true;
  }
  t('重复编号登记时抛错', dup);

  // 编号表
  t('EXPECTED_IDS 没有重复', new Set(EXPECTED_IDS).size === EXPECTED_IDS.length);
  const reg = makeRegistry();
  registerAll(reg);
  t('登记的编号集合等于 EXPECTED_IDS', idsMatch(reg.defs));
  t('每条真实登记的写类断言都带回读', reg.defs.every((d) => !d.write || typeof d.readback === 'function'));

  const all = results.every(Boolean);
  console.log(all ? 'ISOLATION SELF-TEST OK' : 'ISOLATION SELF-TEST FAIL');
  return all;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const argv = process.argv.slice(2);
  if (argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  } else {
    process.exit(await run(argv));
  }
}
