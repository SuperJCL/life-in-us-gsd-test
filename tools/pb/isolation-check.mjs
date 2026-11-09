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

export const EXPECTED_IDS = [
  'ACCT03-1', 'ACCT03-2', 'ACCT03-3', 'ACCT03-4', 'ACCT03-5',
  'ACCT04-1', 'ACCT04-2', 'ACCT04-3', 'ACCT04-4', 'ACCT04-5', 'ACCT04-6', 'ACCT04-7', 'ACCT04-8', 'ACCT04-9', 'ACCT04-10',
  'ACCT04-11', 'ACCT04-12', 'ACCT04-13', 'ACCT04-14', 'ACCT04-15', 'ACCT04-16', 'ACCT04-17', 'ACCT04-18', 'ACCT04-19', 'ACCT04-20',
  'ACCT04-21', 'ACCT04-22', 'ACCT04-23', 'ACCT04-24', 'ACCT04-25', 'ACCT04-26',
  'TOK-1', 'TOK-2', 'D5-1', 'D5-2', 'D5-3', 'D5-4', 'D5-5',
  'NEG-1',
];

// ---------- 输出格式（不含令牌、邮箱、请求体） ----------

// 结果对象可能带有别的属性（令牌、邮箱、请求体……），格式化函数只取编号、名字、状态码和错误码。
export function formatLine(r) {
  const id = String(r.id).replace(/[^A-Za-z0-9-]/g, '?');
  const name = String(r.name).replace(/[^A-Za-z0-9 _\-一-鿿　-〿＀-￯()+,.=/]/g, '?');
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
  const detail = typeof r.detail === 'string' && /^[0-9A-Za-z_,:|+\- ]{0,200}$/.test(r.detail) ? r.detail : '';
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

// ---------- REST 断言的共享实现（真实集合和泄漏集合共用，只换目标） ----------

const q = encodeURIComponent;

async function suCount(c, coll, filter) {
  const r = await c.su('GET', `/api/collections/${coll}/records?perPage=1${filter ? `&filter=${q(filter)}` : ''}`);
  return r.status === 200 ? r.json.totalItems : -1;
}

// 真实集合的目标描述；NEG-1 用同样结构的泄漏集合描述
const realTarget = (c) => ({ coll: 'journey_docs', a: c.docs.a, b: c.docs.b, aTok: c.A.token, bTok: c.B.token, aId: c.A.id, bId: c.B.id });

// 清空某账号的某个 kind 槽位（超级用户删除），返回恢复函数；用来让“创建被拒”不被唯一索引掩盖
async function freeSlot(c, who, kind) {
  const id = c.docs[who][kind];
  const del = await c.su('DELETE', recPath('journey_docs', id));
  if (del.status !== 204) throw new Error('准备失败：清空槽位');
  return async () => {
    c.docs[who][kind] = await makeDoc(c, 'journey_docs', who === 'a' ? c.A.id : c.B.id, kind);
  };
}

const BYTES_39_MIB = Math.floor(3.9 * 1048576);
const LIMIT = 4194304;

// 运行时生成、序列化后恰好 bytes 个字符的 data 对象
function dataOfSize(bytes) {
  const base = JSON.stringify({ _synthetic: true, pad: '' }).length;
  return { _synthetic: true, pad: 'x'.repeat(bytes - base) };
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
// 改动签名段最后一个字符，并保证改动落在有效位上（base64url 末位有填充位，只改低两位会解出同样的字节）
function tamperToken(tok) {
  const parts = tok.split('.');
  const s = parts[2];
  const last = s[s.length - 1];
  parts[2] = s.slice(0, -1) + B64[(B64.indexOf(last) + 4) % 64];
  return parts.join('.');
}

function tokenExp(tok) {
  return JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8')).exp;
}

const loginStatus = async (c, coll, identity, password) => (await c.api('POST', `/api/collections/${coll}/auth-with-password`, { body: { identity, password } })).status;

function restProbeDefs(getT) {
  return {
    // A 列表：恰好是自己的 2 条，没有 B 的 id；超级用户确认 B 的文档确实存在
    'ACCT04-1': {
      fn: async (c) => {
        const t = getT(c);
        const r = await c.api('GET', `/api/collections/${t.coll}/records?perPage=100`, { token: t.aTok });
        const items = (r.json && r.json.items) || [];
        const ids = items.map((i) => i.id).sort();
        const want = [t.a.state, t.a.plan].sort();
        const bIds = [t.b.state, t.b.plan];
        const hidden = (await suCount(c, t.coll, `owner="${t.bId}"`)) >= 1;
        return out(r.status === 200 && stable(ids) === stable(want) && !items.some((i) => bIds.includes(i.id)) && hidden, r);
      },
    },
    // A 查看 B 的文档：404
    'ACCT04-3': {
      fn: async (c) => {
        const t = getT(c);
        const r = await c.api('GET', recPath(t.coll, t.b.state), { token: t.aTok });
        const exists = (await suRecord(c, t.coll, t.b.state)).id === t.b.state;
        return out(r.status === 404 && exists, r);
      },
    },
    // A 更新 B 的文档：404，B 的文档不变
    'ACCT04-4': {
      write: true,
      readback: (c) => suRecord(c, getT(c).coll, getT(c).b.state),
      fn: async (c) => {
        const t = getT(c);
        const r = await c.api('PATCH', recPath(t.coll, t.b.state), { token: t.aTok, body: { data: { _synthetic: true, hijack: true } } });
        return out(r.status === 404, r);
      },
    },
    // A 删除 B 的文档：403，B 的文档还在
    'ACCT04-5': {
      write: true,
      readback: (c) => suRecord(c, getT(c).coll, getT(c).b.plan),
      fn: async (c) => {
        const t = getT(c);
        const r = await c.api('DELETE', recPath(t.coll, t.b.plan), { token: t.aTok });
        return out(r.status === 403, r);
      },
    },
  };
}

// 未登录或令牌无效时对某个文档的读写：空列表、404、404、403、400，都不是 401；返回 {pass, detail}
async function anonProbe(c, token, victimId) {
  const list = await c.api('GET', '/api/collections/journey_docs/records?perPage=100', { token });
  const view = await c.api('GET', recPath('journey_docs', victimId), { token });
  const upd = await c.api('PATCH', recPath('journey_docs', victimId), { token, body: { data: { _synthetic: true, hijack: true } } });
  const del = await c.api('DELETE', recPath('journey_docs', victimId), { token });
  const restore = await freeSlot(c, 'a', 'plan');
  let cre;
  let slotCount;
  try {
    cre = await c.api('POST', '/api/collections/journey_docs/records', { token, body: { owner: c.A.id, kind: 'plan', data: { _synthetic: true } } });
    slotCount = await suCount(c, 'journey_docs', `owner="${c.A.id}" && kind="plan"`);
  } finally {
    await restore();
  }
  const emptyList = list.status === 200 && list.json && Array.isArray(list.json.items) && list.json.items.length === 0;
  const pass = emptyList && view.status === 404 && upd.status === 404 && del.status === 403 && cre.status === 400 && slotCount === 0;
  return { pass, res: view, detail: `list:${list.status},view:${view.status},upd:${upd.status},del:${del.status},create:${cre.status}` };
}

const docsAndVictim = (victim) => async (c) => ({ v: await suRecord(c, 'journey_docs', victim(c)), n: await suCount(c, 'journey_docs', '') });

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

  // ----- ACCT-04：journey_docs 的跨账号读写 -----
  const real = restProbeDefs(realTarget);
  const checkFrom = (id, name, def) => check(id, name, def.fn, { write: def.write, readback: def.readback, expect: def.expect });
  const dr = (c, id) => suRecord(c, 'journey_docs', id);
  const patchDoc = (c, token, id, body) => c.api('PATCH', recPath('journey_docs', id), { token, body });
  const countOf = (who) => (c) => suCount(c, 'journey_docs', `owner="${who(c)}"`);

  checkFrom('ACCT04-1', 'A 列 journey_docs 只有自己的 2 条（200），B 的文档确实存在', real['ACCT04-1']);

  check('ACCT04-2', 'A 用 filter 指向 B 列文档得到 200 空列表，B 的文档确实存在', async (c) => {
    const r = await c.api('GET', `/api/collections/journey_docs/records?perPage=100&filter=${q(`owner="${c.B.id}"`)}`, { token: c.A.token });
    const hidden = (await suCount(c, 'journey_docs', `owner="${c.B.id}"`)) >= 1;
    return out(r.status === 200 && r.json && Array.isArray(r.json.items) && r.json.items.length === 0 && hidden, r);
  });

  checkFrom('ACCT04-3', 'A 查看 B 的文档被拒（404），B 的文档确实存在', real['ACCT04-3']);
  checkFrom('ACCT04-4', 'A 更新 B 的文档被拒（404）且 B 的文档不变', real['ACCT04-4']);
  checkFrom('ACCT04-5', 'A 删除 B 的文档被拒（403）且 B 的文档还在', real['ACCT04-5']);

  check(
    'ACCT04-6',
    'A 删除自己的文档被拒（403）且文档还在',
    async (c) => {
      const r1 = await c.api('DELETE', recPath('journey_docs', c.docs.a.state), { token: c.A.token });
      const r2 = await c.api('DELETE', recPath('journey_docs', c.docs.a.plan), { token: c.A.token });
      return { ...out(r1.status === 403 && r2.status === 403, r1), detail: `${r1.status},${r2.status}` };
    },
    { write: true, readback: async (c) => [await dr(c, c.docs.a.state), await dr(c, c.docs.a.plan)] },
  );

  check(
    'ACCT04-7',
    'A 以 owner=B 新建文档被拒（400），槽位空着时也被拒（不是唯一索引在挡）',
    async (c) => {
      const restore = await freeSlot(c, 'b', 'plan');
      try {
        const r = await c.api('POST', '/api/collections/journey_docs/records', { token: c.A.token, body: { owner: c.B.id, kind: 'plan', data: { _synthetic: true } } });
        const n = await suCount(c, 'journey_docs', `owner="${c.B.id}" && kind="plan"`);
        const masked = fieldCode(r.json, 'owner') === 'validation_not_unique' || fieldCode(r.json, 'kind') === 'validation_not_unique';
        return out(r.status === 400 && n === 0 && !masked, r);
      } finally {
        await restore();
      }
    },
    { write: true, readback: countOf((c) => c.B.id) },
  );

  check(
    'ACCT04-8',
    'A 以 owner=A 新建已存在的 kind 被拒（400，owner 和 kind 都是 validation_not_unique）',
    async (c) => {
      const r = await c.api('POST', '/api/collections/journey_docs/records', { token: c.A.token, body: { owner: c.A.id, kind: 'state', data: { _synthetic: true } } });
      return out(r.status === 400 && fieldCode(r.json, 'owner') === 'validation_not_unique' && fieldCode(r.json, 'kind') === 'validation_not_unique', r);
    },
    { write: true, readback: countOf((c) => c.A.id) },
  );

  check(
    'ACCT04-9',
    'A 以 owner=A 新建不在选项里的 kind 被拒（400，kind 的错误码 validation_invalid_value，实测定稿）',
    async (c) => {
      const r = await c.api('POST', '/api/collections/journey_docs/records', { token: c.A.token, body: { owner: c.A.id, kind: 'bogus', data: { _synthetic: true } } });
      return out(r.status === 400 && fieldCode(r.json, 'kind') === 'validation_invalid_value', r);
    },
    { write: true, readback: countOf((c) => c.A.id) },
  );

  const blockedUpdate = (id, name, body) =>
    check(
      id,
      name,
      async (c) => {
        const r = await patchDoc(c, c.A.token, c.docs.a.state, body(c));
        return out(r.status === 404, r);
      },
      { write: true, readback: (c) => dr(c, c.docs.a.state) },
    );
  blockedUpdate('ACCT04-10', 'A 更新自己的文档时带 owner=B 被拒（404）且 owner 不变', (c) => ({ owner: c.B.id }));
  blockedUpdate('ACCT04-11', 'A 更新自己的文档时带另一种 kind 被拒（404）且 kind 不变', () => ({ kind: 'plan' }));
  blockedUpdate('ACCT04-12', 'A 更新自己的文档时带与原值相同的 owner 也被拒（404）', (c) => ({ owner: c.A.id }));

  check(
    'ACCT04-13',
    'A 更新时用字段修饰符键（owner+、+owner、owner-、kind+）改 owner 或 kind 被拒且回读不变',
    async (c) => {
      const tries = [
        { 'owner+': c.B.id },
        { '+owner': c.B.id },
        { 'owner-': c.A.id },
        { 'kind+': 'plan' },
      ];
      const seen = [];
      let all4xx = true;
      let first = null;
      for (const body of tries) {
        const r = await patchDoc(c, c.A.token, c.docs.a.state, body);
        seen.push(r.status);
        if (r.status !== 404) all4xx = false; // 实测定稿：规则里的 :isset = false 对修饰符键同样成立，全部 404
        if (!first) first = r;
      }
      return { ...out(all4xx, first), detail: seen.join(',') };
    },
    { write: true, readback: (c) => dr(c, c.docs.a.state) },
  );

  check(
    'ACCT04-14',
    'A 更新自己的文档（合法 data 和 writer）成功（200）且回读等于新值',
    async (c) => {
      const r = await patchDoc(c, c.A.token, c.docs.a.state, { data: { _synthetic: true, n: 1 }, writer: 'iso' });
      return out(r.status === 200 && r.json && r.json.owner === c.A.id, r);
    },
    {
      write: true,
      readback: (c) => dr(c, c.docs.a.state),
      expect: (b, a) => a.data && a.data.n === 1 && a.writer === 'iso' && a.updated !== b.updated && a.owner === b.owner && a.kind === b.kind,
    },
  );

  check(
    'ACCT04-15',
    'A 的 writer 超过 40 个字符被拒（400，validation_max_text_constraint，实测定稿）且回读不变',
    async (c) => {
      const r = await patchDoc(c, c.A.token, c.docs.a.state, { writer: 'w'.repeat(41) });
      return out(r.status === 400 && fieldCode(r.json, 'writer') === 'validation_max_text_constraint', r);
    },
    { write: true, readback: (c) => dr(c, c.docs.a.state) },
  );

  check(
    'ACCT04-16',
    'A 写入 3.9 MiB 的 data 成功（200）且回读等于新值',
    async (c) => {
      const r = await patchDoc(c, c.A.token, c.docs.a.plan, { data: dataOfSize(BYTES_39_MIB) });
      return out(r.status === 200, r);
    },
    {
      write: true,
      readback: async (c) => {
        const x = await dr(c, c.docs.a.plan);
        return { len: x.data && x.data.pad ? x.data.pad.length : -1 };
      },
      expect: (b, a) => a.len === dataOfSize(BYTES_39_MIB).pad.length,
    },
  );

  check(
    'ACCT04-17',
    'A 写入超过 4194304 字节的 data 被拒（400，validation_json_size_limit）且回读不变',
    async (c) => {
      const r = await patchDoc(c, c.A.token, c.docs.a.state, { data: dataOfSize(LIMIT + 1024) });
      return out(r.status === 400 && fieldCode(r.json, 'data') === 'validation_json_size_limit', r);
    },
    { write: true, readback: (c) => dr(c, c.docs.a.state) },
  );

  check('ACCT04-18', '未登录列 journey_docs 得到 200 空列表，文档确实存在', async (c) => {
    const r = await c.api('GET', '/api/collections/journey_docs/records?perPage=100');
    const hidden = (await suCount(c, 'journey_docs', '')) >= 4;
    return out(r.status === 200 && r.json && Array.isArray(r.json.items) && r.json.items.length === 0 && hidden, r);
  });

  check(
    'ACCT04-19',
    '未登录查看、更新、删除、创建分别是 404、404、403、400（槽位空着时创建也被拒）且数据不变',
    async (c) => {
      const p = await anonProbe(c, undefined, c.docs.b.state);
      return { ...out(p.pass, p.res), detail: p.detail };
    },
    { write: true, readback: docsAndVictim((c) => c.docs.b.state) },
  );

  check(
    'ACCT04-20',
    '无效令牌的读写与未登录相同（空列表、404、404、403、400），不是 401',
    async (c) => {
      const bad = tamperToken(c.A.token);
      const refresh = await c.api('POST', '/api/collections/users/auth-refresh', { token: bad });
      const p = await anonProbe(c, bad, c.docs.a.state);
      return { ...out(refresh.status === 401 && p.pass, p.res), detail: `refresh:${refresh.status},${p.detail}` };
    },
    { write: true, readback: docsAndVictim((c) => c.docs.a.state) },
  );

  check('ACCT04-21', 'A 列 users 只有自己 1 条，返回体里没有 B 的 id 和邮箱，B 确实存在', async (c) => {
    const r = await c.api('GET', '/api/collections/users/records?perPage=100', { token: c.A.token });
    const items = (r.json && r.json.items) || [];
    const raw = JSON.stringify(r.json);
    const hidden = (await usersCount(c)) >= 2;
    return out(r.status === 200 && items.length === 1 && items[0].id === c.A.id && !raw.includes(c.B.id) && !raw.includes(c.B.email) && hidden, r);
  });

  check('ACCT04-22', 'A 查看 users 里 B 的记录被拒（404），B 确实存在', async (c) => {
    const r = await c.api('GET', recPath('users', c.B.id), { token: c.A.token });
    const exists = (await suRecord(c, 'users', c.B.id)).id === c.B.id;
    return out(r.status === 404 && exists, r);
  });

  check(
    'ACCT04-23',
    'A 更新 users 里 B 的记录被拒（404）且 B 不变',
    async (c) => {
      const r = await c.api('PATCH', recPath('users', c.B.id), { token: c.A.token, body: { emailVisibility: true } });
      return out(r.status === 404, r);
    },
    { write: true, readback: (c) => suRecord(c, 'users', c.B.id) },
  );

  check('ACCT04-24', 'users 只看自己的规则下登录和刷新仍然正常（200）', async (c) => {
    const l = await c.api('POST', '/api/collections/users/auth-with-password', { body: { identity: c.A.email, password: c.A.password } });
    const loginOk = l.status === 200 && l.json && typeof l.json.token === 'string' && l.json.record && l.json.record.email === c.A.email;
    const rf = await c.api('POST', '/api/collections/users/auth-refresh', { token: c.A.token });
    return { ...out(loginOk && rf.status === 200, l), detail: `login:${l.status},refresh:${rf.status}` };
  });

  check('ACCT04-25', '普通账号碰不到超级用户接口，也不能用自己的凭据登录超级用户集合', async (c) => {
    const paths = ['/api/collections/_superusers/records', '/api/collections', '/api/settings', '/api/logs', '/api/backups'];
    const seen = [];
    let denied = true;
    let first = null;
    for (const p of paths) {
      const r = await c.api('GET', p, { token: c.A.token });
      seen.push(r.status);
      if (r.status !== 403) denied = false; // 实测定稿：五个管理接口对普通账号都是 403
      if (!first) first = r;
    }
    const l = await c.api('POST', '/api/collections/_superusers/auth-with-password', { body: { identity: c.A.email, password: c.A.password } });
    seen.push(l.status);
    return { ...out(denied && l.status === 400, first), detail: seen.join(',') };
  });

  check('ACCT04-26', 'A 列系统集合 _authOrigins 和 _externalAuths 看不到 B 的记录', async (c) => {
    const seen = [];
    let pass = true;
    let first = null;
    // 先让超级用户给 B 造一条第三方登录记录，保证“B 的记录存在”，检查不是空转
    const users = await c.su('GET', '/api/collections/users');
    const mk = await c.su('POST', '/api/collections/_externalAuths/records', { collectionRef: users.json.id, recordRef: c.B.id, provider: 'google', providerId: hex(6) });
    seen.push(mk.status);
    if (mk.status !== 200) pass = false;
    for (const name of ['_authOrigins', '_externalAuths']) {
      const r = await c.api('GET', `/api/collections/${name}/records?perPage=100`, { token: c.A.token });
      seen.push(r.status);
      const items = (r.json && r.json.items) || [];
      if (r.status !== 200 || items.some((i) => i.recordRef === c.B.id)) pass = false;
      if (!first) first = r;
    }
    const hiddenB = await suCount(c, '_externalAuths', `recordRef="${c.B.id}"`);
    if (hiddenB < 1) pass = false;
    return { ...out(pass, first), detail: seen.join(',') };
  });

  // ----- 令牌与改密码（TOK-2、D5-1 放在最后） -----
  check('TOK-1', '令牌有效期是 7776000 秒，登录令牌的 exp 在 90 天上下 1 天内', async (c) => {
    const r = await c.su('GET', '/api/collections/users');
    const dur = r.status === 200 && r.json.authToken ? r.json.authToken.duration : -1;
    const left = tokenExp(c.A.token) - Math.floor(Date.now() / 1000);
    return out(dur === 7776000 && Math.abs(left - 7776000) <= 86400, r);
  });

  check(
    'D5-2',
    'A 改密码不带 oldPassword 被拒（400，validation_required），旧口令仍能登录',
    async (c) => {
      const np = newPassword();
      const r = await c.api('PATCH', recPath('users', c.A.id), { token: c.A.token, body: { password: np, passwordConfirm: np } });
      return out(r.status === 400 && fieldCode(r.json, 'oldPassword') === 'validation_required', r);
    },
    { write: true, readback: (c) => loginStatus(c, 'users', c.A.email, c.A.password) },
  );

  check(
    'D5-3',
    'A 改密码带错误的 oldPassword 被拒（400，validation_invalid_old_password），旧口令仍能登录',
    async (c) => {
      const np = newPassword();
      const r = await c.api('PATCH', recPath('users', c.A.id), { token: c.A.token, body: { oldPassword: newPassword(), password: np, passwordConfirm: np } });
      return out(r.status === 400 && fieldCode(r.json, 'oldPassword') === 'validation_invalid_old_password', r);
    },
    { write: true, readback: (c) => loginStatus(c, 'users', c.A.email, c.A.password) },
  );

  check(
    'D5-4',
    'A 改自己的 verified 或 emailVisibility 被拒（404）且回读不变',
    async (c) => {
      const r1 = await c.api('PATCH', recPath('users', c.A.id), { token: c.A.token, body: { verified: false } });
      const r2 = await c.api('PATCH', recPath('users', c.A.id), { token: c.A.token, body: { emailVisibility: true } });
      return { ...out(r1.status === 404 && r2.status === 404, r1), detail: `${r1.status},${r2.status}` };
    },
    { write: true, readback: (c) => suRecord(c, 'users', c.A.id) },
  );

  check(
    'D5-5',
    'A 改自己的 email 被拒（400，validation_values_mismatch）且邮箱不变',
    async (c) => {
      const r = await c.api('PATCH', recPath('users', c.A.id), { token: c.A.token, body: { email: newEmail('changed') } });
      return out(r.status === 400 && fieldCode(r.json, 'email') === 'validation_values_mismatch', r);
    },
    { write: true, readback: (c) => suRecord(c, 'users', c.A.id) },
  );

  // ----- 反向对照：故意写错的集合，检查函数必须报出泄漏 -----
  check('NEG-1', '反向对照：在故意写错规则的 journey_docs_leaky 上，ACCT04-1、3、4、5 的检查都报出泄漏', async (c) => {
    const leaky = await makeLeaky(c);
    const defs = restProbeDefs(() => leaky);
    const verdicts = [];
    for (const id of ['ACCT04-1', 'ACCT04-3', 'ACCT04-4', 'ACCT04-5']) {
      const d = defs[id];
      const r = await executeCheck({ id, name: id, fn: d.fn, readback: d.readback, write: d.write }, c);
      verdicts.push(`${id}:${r.pass ? 'noleak' : 'leak'}`);
    }
    return { pass: verdicts.every((v) => v.endsWith(':leak')), detail: verdicts.join(',') };
  });

  check(
    'D5-1',
    'A 带正确 oldPassword 改密码成功（200），旧令牌 auth-refresh 为 401，新口令能登录、旧口令不能',
    async (c) => {
      const np = newPassword();
      const r = await c.api('PATCH', recPath('users', c.A.id), { token: c.A.token, body: { oldPassword: c.A.password, password: np, passwordConfirm: np } });
      const refresh = await c.api('POST', '/api/collections/users/auth-refresh', { token: c.A.token });
      const newLogin = await loginStatus(c, 'users', c.A.email, np);
      const oldLogin = await loginStatus(c, 'users', c.A.email, c.A.password);
      return { ...out(r.status === 200 && refresh.status === 401 && newLogin === 200 && oldLogin === 400, r), detail: `patch:${r.status},refresh:${refresh.status},new:${newLogin},old:${oldLogin}` };
    },
    { write: true, readback: (c) => loginStatus(c, 'users', c.A.email, c.A.password), expect: (b, a) => b === 200 && a === 400 },
  );

  check(
    'TOK-2',
    '所有者（超级用户）重置密码后，B 的旧令牌 auth-refresh 为 401，新口令能登录',
    async (c) => {
      const np = newPassword();
      const r = await c.su('PATCH', recPath('users', c.B.id), { password: np, passwordConfirm: np });
      const refresh = await c.api('POST', '/api/collections/users/auth-refresh', { token: c.B.token });
      const newLogin = await loginStatus(c, 'users', c.B.email, np);
      return { ...out(r.status === 200 && refresh.status === 401 && newLogin === 200, refresh), detail: `patch:${r.status},refresh:${refresh.status},new:${newLogin}` };
    },
    { write: true, readback: (c) => loginStatus(c, 'users', c.B.email, c.B.password), expect: (b, a) => b === 200 && a === 400 },
  );
}

// 临时集合 journey_docs_leaky：故意写错的规则（list、view、update 只要求已登录，deleteRule 为空字符串）
async function makeLeaky(c) {
  const users = await c.su('GET', '/api/collections/users');
  const auth = '@request.auth.id != ""';
  const r = await c.su('POST', '/api/collections', {
    name: 'journey_docs_leaky',
    type: 'base',
    listRule: auth,
    viewRule: auth,
    createRule: `${auth} && @request.body.owner = @request.auth.id`,
    updateRule: auth,
    deleteRule: '',
    fields: [
      { type: 'relation', name: 'owner', required: true, collectionId: users.json.id, maxSelect: 1, cascadeDelete: true },
      { type: 'select', name: 'kind', required: true, maxSelect: 1, values: ['state', 'plan'] },
      { type: 'json', name: 'data', maxSize: LIMIT },
      { type: 'text', name: 'writer', max: 40 },
    ],
  });
  if (r.status !== 200) throw new Error(`准备失败：创建 journey_docs_leaky 返回 ${r.status}`);
  const coll = 'journey_docs_leaky';
  return {
    coll,
    a: { state: await makeDoc(c, coll, c.A.id, 'state'), plan: await makeDoc(c, coll, c.A.id, 'plan') },
    b: { state: await makeDoc(c, coll, c.B.id, 'state'), plan: await makeDoc(c, coll, c.B.id, 'plan') },
    aTok: c.A.token,
    bTok: c.B.token,
    aId: c.A.id,
    bId: c.B.id,
  };
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
