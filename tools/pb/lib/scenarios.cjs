'use strict';
// 协议样本的场景表（Phase 8，08-06，TEST-02）。CommonJS，零依赖。
// 它是录制脚本 tools/pb/record-samples.mjs 和 08-07 契约自测共用的唯一输入：同一份场景、同一个 resolveStep。
//
// 场景结构：
//   { id,
//     setup: { users: ['A', 'B'], docs?: [{ owner: 'A', kind: 'state', data: {...} }] },
//     steps: [{ as, method, path, query?, body?, expect, op? }] }
//   - 每个场景在实例里新建自己的一组账号和文档，场景之间不共享，前置状态只由 setup 决定。
//   - as：'A'、'B'（该账号的有效令牌）、'anon'（不带令牌）、'invalid'（A 的令牌把最后一个有效位换掉）。
//   - expect：该步骤按场景意图应得的状态码（整数）。录到的状态码与 expect 不同时录制中止，不改 expect 去迁就。
//   - 实时场景的步骤多一个 op：connect、subscribe、request、expectEvent；connect 和 expectEvent 不带 expect。
//
// 路径、查询和请求体里的符号（resolveStep 用上下文里的具体值替换）：
//   {user:A}      账号 A 的记录 id          {doc:A:state}   A 的 state 文档的 id
//   {email:A}     账号 A 的邮箱             {password:A}    账号 A 的口令
//   {password:wrong}  运行时随机的错误口令   {oversize:N}    序列化后恰好 N 字节的 data 对象
//   {clientId}    本场景 connect 步骤得到的 clientId        {clientId:unknown}  没有对应连接的随机串
//
// 上下文 ctx：{ users: { A: { id, email, password, token } }, docs: { 'A:state': { id } },
//               wrongPassword?, clientId?, unknownClientId? }；wrongPassword、unknownClientId 在第一次用到时生成并缓存回 ctx。
//
// 隐私约定：本文件不含令牌、口令、邮箱、地址的字面量；口令和随机串都在运行时生成。

const crypto = require('node:crypto');

const USERS = '/api/collections/users';
const DOCS = '/api/collections/journey_docs/records';
const LIST_QUERY = { page: '1', perPage: '1000', skipTotal: '1' };
const SYN = () => ({ _synthetic: true, note: 'sample' });
// 符号写成函数调用：S('email', 'A') 得到 {email:A}。不写成引号字面量，是因为口令键后面跟引号字面量会被隐私规则 G 当成写死的口令（不加放行名单）
const S = (kind, arg) => (arg === undefined ? '{' + kind + '}' : '{' + kind + ':' + arg + '}');

const REST_SCENARIOS = [
  {
    id: 'auth-ok',
    setup: { users: ['A'] },
    steps: [
      {
        as: 'anon',
        method: 'POST',
        path: `${USERS}/auth-with-password`,
        body: { identity: S('email', 'A'), password: S('password', 'A') },
        expect: 200,
      },
    ],
  },
];

const REALTIME_SCENARIOS = [];

const SYMBOL_RE = /\{(user|doc|email|password|clientId|oversize)(?::([A-Za-z0-9:]+))?\}/g;
const OVERSIZE_FULL_RE = /^\{oversize:(\d+)\}$/;

function randomAlnum(n) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.randomBytes(n);
  let s = '';
  for (let i = 0; i < n; i += 1) s += alphabet[bytes[i] % alphabet.length];
  return s;
}

// 序列化后恰好 total 字节（UTF-8）的 data 对象
function oversizeData(total) {
  const base = Buffer.byteLength(JSON.stringify({ _synthetic: true, pad: '' }), 'utf8');
  return { _synthetic: true, pad: 'x'.repeat(Math.max(0, total - base)) };
}

function requireUser(ctx, name) {
  const u = ctx.users && ctx.users[name];
  if (!u) throw new Error(`场景引用了没有创建的账号 ${name}`);
  return u;
}

function substitute(kind, arg, ctx) {
  if (kind === 'user') return requireUser(ctx, arg).id;
  if (kind === 'email') return requireUser(ctx, arg).email;
  if (kind === 'password') {
    if (arg === 'wrong') {
      if (!ctx.wrongPassword) ctx.wrongPassword = crypto.randomBytes(12).toString('hex');
      return ctx.wrongPassword;
    }
    return requireUser(ctx, arg).password;
  }
  if (kind === 'doc') {
    const d = ctx.docs && ctx.docs[arg];
    if (!d) throw new Error(`场景引用了没有创建的文档 ${arg}`);
    return d.id;
  }
  if (kind === 'clientId') {
    if (arg === 'unknown') {
      if (!ctx.unknownClientId) ctx.unknownClientId = randomAlnum(ctx.clientId ? ctx.clientId.length : 40);
      return ctx.unknownClientId;
    }
    if (!ctx.clientId) throw new Error('场景引用了还没有建立的连接');
    return ctx.clientId;
  }
  throw new Error('未知符号');
}

function resolveValue(value, ctx) {
  if (typeof value === 'string') {
    const m = OVERSIZE_FULL_RE.exec(value);
    if (m) return oversizeData(Number(m[1]));
    return value.replace(SYMBOL_RE, (all, kind, arg) => substitute(kind, arg, ctx));
  }
  if (Array.isArray(value)) return value.map((v) => resolveValue(v, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = resolveValue(value[k], ctx);
    return out;
  }
  return value;
}

// 把步骤里的符号换成上下文里的具体值，返回新对象，不改原步骤
function resolveStep(step, ctx) {
  const out = { ...step };
  if (step.path !== undefined) out.path = resolveValue(step.path, ctx);
  if (step.query !== undefined) out.query = resolveValue(step.query, ctx);
  if (step.body !== undefined) out.body = resolveValue(step.body, ctx);
  return out;
}

// 把令牌的最后一个字符换成字符表里位置加 4 的字符：末位 base64url 字符有填充位，
// 只改低两位会解出同样的字节、令牌仍然有效，所以让改动落在有效位上（08-05 ACCT04-20 的经验）
function invalidateToken(token) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const last = token[token.length - 1];
  const i = alphabet.indexOf(last);
  return token.slice(0, -1) + alphabet[(i + 4) % 64];
}

// 步骤的身份对应的令牌；anon 为 null
function identityToken(as, ctx) {
  if (as === 'anon') return null;
  if (as === 'invalid') return invalidateToken(requireUser(ctx, 'A').token);
  return requireUser(ctx, as).token;
}

module.exports = {
  USERS,
  DOCS,
  LIST_QUERY,
  REST_SCENARIOS,
  REALTIME_SCENARIOS,
  resolveStep,
  identityToken,
  invalidateToken,
  oversizeData,
  randomAlnum,
  SYN,
  S,
};
