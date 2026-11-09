'use strict';
// 协议样本的归一化（Phase 8，08-06，TEST-02；解决隐私规则 F 与协议样本的冲突）。纯函数，CommonJS，
// 录制脚本 tools/pb/record-samples.mjs 和 08-07 的契约自测共用（Playwright 里直接 require）。
//
// 导出：createContext、normalizeValue、normalizeExchange、normalizeEvent、tokenClaims、
//       USERS_COLLECTION_ID、OVERSIZE_LIMIT。
//
// 归一化表（每个上下文里同一个值永远映射到同一个占位）：
//   令牌               -> <JWT>（键为 token 的值，以及字符串里任意三段令牌形状）
//   口令               -> <PASSWORD>（键 password、passwordConfirm、oldPassword）
//   tokenKey、authToken.secret -> 丢弃
//   YYYY-MM-DD HH:mm:ss.SSSZ   -> <TS>
//   _pb_users_auth_    -> <USERS_COLLECTION_ID>；pbc_ 加数字 -> <COLLECTION_ID:n>
//   邮箱               -> user-a@example.com、user-b@example.com ...（按首次出现）
//   15 位小写字母数字的整词 -> <ID:n>（按首次出现）
//   clientId           -> <CLIENT_ID>（键 clientId，以及上下文里登记过的 clientId）
//   超过 65536 字节的请求体字段 -> <OVERSIZE:字节数>
//
// 隐私约定：本文件不打印任何内容，不返回令牌原值（tokenClaims 只返回键名、type 和四舍五入的有效期）。

const USERS_COLLECTION_ID = '_pb_users_auth_';
const OVERSIZE_LIMIT = 65536;

// 三段令牌形状：每段至少 10 个字符，字符集同时含 base64 和 base64url
const JWT_RE = /[A-Za-z0-9_+/=-]{10,}\.[A-Za-z0-9_+/=-]{10,}\.[A-Za-z0-9_+/=-]{10,}/g;
const TS_RE = /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}Z/g;
const COLLECTION_RE = /\bpbc_\d+\b/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
const ID_RE = /\b[a-z0-9]{15}\b/g;

const PASSWORD_KEYS = new Set(['password', 'passwordConfirm', 'oldPassword']);

function createContext() {
  return {
    ids: new Map(),
    emails: new Map(),
    collections: new Map(),
    clientIds: new Set(),
  };
}

function letterFor(n) {
  // 0 -> a，25 -> z，26 -> aa ...
  let s = '';
  let k = n;
  do {
    s = String.fromCharCode(97 + (k % 26)) + s;
    k = Math.floor(k / 26) - 1;
  } while (k >= 0);
  return s;
}

function idFor(ctx, id) {
  if (!ctx.ids.has(id)) ctx.ids.set(id, `<ID:${ctx.ids.size + 1}>`);
  return ctx.ids.get(id);
}

function emailFor(ctx, email) {
  const key = email.toLowerCase();
  if (!ctx.emails.has(key)) ctx.emails.set(key, `user-${letterFor(ctx.emails.size)}@example.com`);
  return ctx.emails.get(key);
}

function collectionFor(ctx, id) {
  if (!ctx.collections.has(id)) ctx.collections.set(id, `<COLLECTION_ID:${ctx.collections.size + 1}>`);
  return ctx.collections.get(id);
}

function addClientId(ctx, clientId) {
  if (typeof clientId === 'string' && clientId.length > 0) ctx.clientIds.add(clientId);
}

// 保护已经归一化的占位和邮箱：先把已知的归一化邮箱留给邮箱规则原样映射（同一上下文里幂等）
function normalizeText(text, ctx) {
  let out = String(text);
  for (const cid of ctx.clientIds) {
    if (out.includes(cid)) out = out.split(cid).join('<CLIENT_ID>');
  }
  out = out.replace(JWT_RE, '<JWT>');
  out = out.replace(TS_RE, '<TS>');
  out = out.split(USERS_COLLECTION_ID).join('<USERS_COLLECTION_ID>');
  out = out.replace(COLLECTION_RE, (m) => collectionFor(ctx, m));
  out = out.replace(EMAIL_RE, (m) => emailFor(ctx, m));
  out = out.replace(ID_RE, (m) => idFor(ctx, m));
  return out;
}

function normalizeValue(value, ctx) {
  if (typeof value === 'string') return normalizeText(value, ctx);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => normalizeValue(v, ctx));
  // 键按字典序处理：服务器返回的键序不稳定（带 fields 的事件里每次不同），排序后样本可复现，占位编号也稳定
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const v = value[key];
    if (key === 'tokenKey') continue;
    if (key === 'authToken' && v && typeof v === 'object' && !Array.isArray(v)) {
      const { secret, ...rest } = v;
      void secret;
      out[key] = normalizeValue(rest, ctx);
      continue;
    }
    if (key === 'token' && typeof v === 'string') {
      out[key] = '<JWT>';
      continue;
    }
    if (PASSWORD_KEYS.has(key) && typeof v === 'string') {
      out[key] = '<PASSWORD>';
      continue;
    }
    if (key === 'clientId' && typeof v === 'string') {
      addClientId(ctx, v);
      out[key] = '<CLIENT_ID>';
      continue;
    }
    out[normalizeText(key, ctx)] = normalizeValue(v, ctx);
  }
  return out;
}

function byteLength(v) {
  return Buffer.byteLength(JSON.stringify(v), 'utf8');
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function bodyKeysOf(body) {
  return isPlainObject(body) ? Object.keys(body).sort() : undefined;
}

// 请求体：顶层字段 JSON 序列化超过 65536 字节的，整体换成 <OVERSIZE:字节数>
function normalizeRequestBody(body, ctx) {
  if (!isPlainObject(body)) return normalizeValue(body, ctx);
  const copy = {};
  for (const key of Object.keys(body)) {
    const n = body[key] === undefined ? 0 : byteLength(body[key]);
    copy[key] = n > OVERSIZE_LIMIT ? `<OVERSIZE:${n}>` : body[key];
  }
  return normalizeValue(copy, ctx);
}

// 一次请求和响应：{ request: { method, path, query?, hasAuth, body? }, response: { status, body? } }
// 输出 { request: { method, path, query?, hasAuth, bodyKeys?, body? }, response: { status, bodyKeys?, body? } }
function normalizeExchange(exchange, ctx) {
  const rq = exchange.request || {};
  const rs = exchange.response || {};
  const request = {
    method: rq.method,
    path: normalizeText(rq.path || '', ctx),
  };
  if (rq.query && Object.keys(rq.query).length > 0) request.query = normalizeValue(rq.query, ctx);
  request.hasAuth = Boolean(rq.hasAuth);
  if (rq.body !== undefined && rq.body !== null) {
    request.bodyKeys = bodyKeysOf(rq.body);
    request.body = normalizeRequestBody(rq.body, ctx);
  }
  const response = { status: rs.status };
  if (rs.body !== undefined && rs.body !== null) {
    response.bodyKeys = bodyKeysOf(rs.body);
    response.body = normalizeValue(rs.body, ctx);
  }
  return { request, response };
}

// 实时事件 { id, event, data }；data 是原始文本，能解析成 JSON 就按 JSON 归一化
function normalizeEvent(ev, ctx) {
  let data = ev.data;
  try {
    data = JSON.parse(ev.data);
  } catch {
    /* 保持文本 */
  }
  const out = {
    id: normalizeText(ev.id || '', ctx),
    event: normalizeText(ev.event || '', ctx),
    data: normalizeValue(data, ctx),
  };
  const keys = bodyKeysOf(data);
  if (keys) out.dataKeys = keys;
  return out;
}

// 在内存里解码令牌载荷，只返回键名、type 和四舍五入到整小时的有效期（秒）。
// 用 Math.round：真实令牌的 exp 是整秒，nowSeconds 与签发相差 0 或 1 秒，差值是 7776000 或 7775999，
// 向下取整会偶发少一小时；假服务器在固定时钟下恰好是 7776000。取整只在这里做。
function tokenClaims(token, nowSeconds) {
  const parts = String(token).split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  return {
    keys: Object.keys(payload).sort(),
    type: payload.type,
    expInSeconds: Math.round((payload.exp - nowSeconds) / 3600) * 3600,
  };
}

module.exports = {
  USERS_COLLECTION_ID,
  OVERSIZE_LIMIT,
  createContext,
  addClientId,
  normalizeValue,
  normalizeExchange,
  normalizeEvent,
  tokenClaims,
};
