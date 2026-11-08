// 规则快照归一化：零依赖，只使用 node: 内置模块（本文件甚至不 import 任何东西）。
//
// 用途：把“迁移在 node:vm 沙箱里保存的集合”和“超级用户从真实实例读到的集合 JSON”归一成同一种只含结构的快照，
// 这样 migration-check（沙箱）、08-04 的实例冒烟和 08-05 的隔离脚本（真实实例）可以用同一个比较函数。
//
// 快照只含集合名、类型、规则、认证选项、字段（不含 system 字段）和索引；
// 不含任何 id、时间戳、authToken.secret，也不含任何记录数据。
//
// 导出：stable、snapshotFromSaved、snapshotFromLive、diffSnapshots。

// 对象键的先后不计：按键排序后序列化再比较
export function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  }
  return v === undefined ? 'null' : JSON.stringify(v);
}

const RULES = ['listRule', 'viewRule', 'createRule', 'updateRule', 'deleteRule'];
const AUTH_RULES = ['manageRule', 'authRule'];

const bool = (v) => v === true;
const num = (v) => (typeof v === 'number' ? v : 0);
const arr = (v) => (Array.isArray(v) ? [...v] : []);
const rule = (v) => (v === undefined || v === null ? null : v);

// 只取结构属性，缺的按类型补默认值
function normField(f) {
  const out = { name: f.name, type: f.type, required: bool(f.required) };
  switch (f.type) {
    case 'text':
      out.max = num(f.max);
      break;
    case 'select':
      out.maxSelect = num(f.maxSelect);
      out.values = arr(f.values);
      break;
    case 'json':
      out.maxSize = num(f.maxSize);
      break;
    case 'relation':
      out.maxSelect = num(f.maxSelect);
      out.cascadeDelete = bool(f.cascadeDelete);
      out.collectionId = '<users>';
      break;
    case 'autodate':
      out.onCreate = bool(f.onCreate);
      out.onUpdate = bool(f.onUpdate);
      break;
    default:
      break;
  }
  return out;
}

function normFields(fields) {
  const list = Array.isArray(fields) ? [...fields] : [];
  return list
    .filter((f) => f && f.system !== true)
    .map(normField)
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

function normCollection(c) {
  const out = { type: c.type ?? 'base' };
  for (const r of RULES) out[r] = rule(c[r]);
  if (c.name === 'users' || c.type === 'auth') {
    for (const r of AUTH_RULES) out[r] = rule(c[r]);
    const pa = c.passwordAuth ?? {};
    out.passwordAuth = { enabled: bool(pa.enabled), identityFields: arr(pa.identityFields) };
    out.oauth2 = { enabled: bool((c.oauth2 ?? {}).enabled) };
    out.otp = { enabled: bool((c.otp ?? {}).enabled) };
    out.mfa = { enabled: bool((c.mfa ?? {}).enabled) };
    out.authAlert = { enabled: bool((c.authAlert ?? {}).enabled) };
    out.authToken = { duration: num((c.authToken ?? {}).duration) };
    // 系统自带的 tokenKey、email 索引不由迁移管理，不取 indexes
  } else {
    out.indexes = arr(c.indexes);
  }
  out.fields = normFields(c.fields);
  return out;
}

function build(collections) {
  const result = {};
  for (const c of Array.isArray(collections) ? collections : []) {
    if (!c || typeof c.name !== 'string') continue;
    // 同名多次保存时以最后一次为准
    result[c.name] = normCollection(c);
  }
  return { collections: result };
}

// 沙箱里 app.save 收到的集合对象（users 模型和 new Collection 的参数对象）
export function snapshotFromSaved(collections) {
  return build(collections);
}

// 超级用户 GET /api/collections/<name> 返回的 JSON；只取 users 和 journey_docs，别的集合不进快照
export function snapshotFromLive(collections) {
  return build((Array.isArray(collections) ? collections : []).filter((c) => c && (c.name === 'users' || c.name === 'journey_docs')));
}

// ---------- 比较 ----------

// 字段内部差异的种类：type 是类型不同，option 是类型相关的限制不同，attr 是 required
function diffFields(coll, expected, actual) {
  const out = [];
  const e = new Map(expected.map((f) => [f.name, f]));
  const a = new Map(actual.map((f) => [f.name, f]));
  for (const name of e.keys()) if (!a.has(name)) out.push(`${coll}.${name} missing`);
  for (const name of a.keys()) if (!e.has(name)) out.push(`${coll}.${name} extra`);
  for (const [name, ef] of e) {
    const af = a.get(name);
    if (!af) continue;
    if (ef.type !== af.type) {
      out.push(`${coll}.${name} type`);
      continue;
    }
    if (ef.required !== af.required) out.push(`${coll}.${name} attr`);
    const keys = new Set([...Object.keys(ef), ...Object.keys(af)]);
    for (const k of ['name', 'type', 'required']) keys.delete(k);
    if ([...keys].some((k) => stable(ef[k]) !== stable(af[k]))) out.push(`${coll}.${name} option`);
  }
  return out;
}

// 每条形如 <集合>.<键> <种类>；空数组表示一致
export function diffSnapshots(expected, actual) {
  const out = [];
  const ec = (expected && expected.collections) || {};
  const ac = (actual && actual.collections) || {};
  for (const name of Object.keys(ec)) {
    if (!(name in ac)) out.push(`${name}.* missing`);
  }
  for (const name of Object.keys(ac)) {
    if (!(name in ec)) out.push(`${name}.* extra`);
  }
  for (const name of Object.keys(ec)) {
    if (!(name in ac)) continue;
    const e = ec[name];
    const a = ac[name];
    if (e.type !== a.type) out.push(`${name}.type type`);
    for (const r of [...RULES, ...AUTH_RULES]) {
      if (r in e || r in a) {
        if (stable(e[r]) !== stable(a[r])) out.push(`${name}.${r} rule`);
      }
    }
    for (const group of ['passwordAuth', 'oauth2', 'otp', 'mfa', 'authAlert', 'authToken']) {
      const eg = e[group] ?? {};
      const ag = a[group] ?? {};
      for (const k of new Set([...Object.keys(eg), ...Object.keys(ag)])) {
        if (stable(eg[k]) !== stable(ag[k])) out.push(`${name}.${group}.${k} attr`);
      }
    }
    if ('indexes' in e || 'indexes' in a) {
      if (stable(e.indexes) !== stable(a.indexes)) out.push(`${name}.indexes index`);
    }
    out.push(...diffFields(name, e.fields ?? [], a.fields ?? []));
  }
  return out;
}
