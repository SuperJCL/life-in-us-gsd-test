#!/usr/bin/env node
// PocketBase 迁移静态检查：零依赖，只使用 node: 内置模块，不需要 PocketBase 二进制。
//
// 用途：在 node:vm 沙箱里按文件名顺序执行 pb/pb_migrations/ 下的迁移，记录 app.save 收到的集合，
// 归一成规则快照后与 pb/rules.expected.json 比较。沙箱不提供任何记录接口，迁移一旦试图保存记录就判失败。
// 规则在真实 PocketBase 上的行为由 08-04 的实例冒烟和 08-05 的隔离脚本证明，本工具只做静态证明。
//
// 用法：
//   node tools/pb/migration-check.mjs                          默认：pb/pb_migrations/ 对 pb/rules.expected.json
//   node tools/pb/migration-check.mjs --migrations <目录>      换一个迁移目录
//   node tools/pb/migration-check.mjs --expected <文件>        换一个快照文件
//
// 输出：一致时最后一行 MIGRATIONS MATCH；不一致时逐条 MIGRATIONS MISMATCH <集合>.<键> <种类>，
// 种类取 missing、extra、rule、attr、type、option、index。
//
// 退出码：0 一致；1 不一致；2 用法错误或读不到文件。
//
// 隐私约定：输出只含集合名、键名和差异种类，不打印被检查文件的内容和路径。

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { diffSnapshots, snapshotFromSaved, stable } from './lib/rules-snapshot.mjs';

const DEFAULT_MIGRATIONS = fileURLToPath(new URL('../../pb/pb_migrations/', import.meta.url));
const DEFAULT_EXPECTED = fileURLToPath(new URL('../../pb/rules.expected.json', import.meta.url));

const USAGE = 'usage: node tools/pb/migration-check.mjs [--migrations <dir>] [--expected <file>] | --self-test';

// ---------- 沙箱 ----------

// 带 removeByName、getByName 的字段数组（PocketBase JSVM 里 collection.fields 的最小替身）
function fieldList(list) {
  const fields = [...list];
  Object.defineProperty(fields, 'removeByName', {
    value(name) {
      const i = fields.findIndex((f) => f && f.name === name);
      if (i >= 0) fields.splice(i, 1);
    },
  });
  Object.defineProperty(fields, 'getByName', {
    value(name) {
      return fields.find((f) => f && f.name === name) ?? null;
    },
  });
  return fields;
}

// PocketBase 0.41.1 新建 users 集合的默认模型（依据 v0.40.6 源码：migrations/1640988000_init.go 和
// core/collection_model_auth_options.go）。08-04 的实例冒烟要对真实实例核对这些默认值。
function defaultUsers() {
  const sys = (name, type, extra = {}) => ({ system: true, name, type, ...extra });
  return {
    name: 'users',
    type: 'auth',
    createRule: '',
    listRule: 'id = @request.auth.id',
    viewRule: 'id = @request.auth.id',
    updateRule: 'id = @request.auth.id',
    deleteRule: 'id = @request.auth.id',
    manageRule: null,
    authRule: '',
    passwordAuth: { enabled: true, identityFields: ['email'] },
    oauth2: { enabled: false },
    otp: { enabled: false },
    mfa: { enabled: false },
    authAlert: { enabled: true },
    authToken: { duration: 432000 },
    fields: fieldList([
      sys('id', 'text', { required: true }),
      sys('password', 'password', { required: true }),
      sys('tokenKey', 'text', { required: true }),
      sys('email', 'email', { required: true }),
      sys('emailVisibility', 'bool'),
      sys('verified', 'bool'),
      { name: 'name', type: 'text', max: 255 },
      { name: 'avatar', type: 'file', maxSelect: 1 },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ]),
  };
}

// 执行一组迁移源码，返回 { saved, errors }；errors 里是 data-in-migration、migration-error
export function execMigrations(sources) {
  const saved = [];
  const errors = [];
  class Collection {
    constructor(def) {
      this.def = { ...def, fields: fieldList(Array.isArray(def.fields) ? def.fields : []) };
    }
  }
  class Record {}
  const users = defaultUsers();
  const app = {
    findCollectionByNameOrId(name) {
      return name === 'users' ? users : null;
    },
    save(x) {
      if (x === users) saved.push(users);
      else if (x instanceof Collection) saved.push(x.def);
      else errors.push('data-in-migration');
    },
  };
  for (const source of sources) {
    const migrate = (up) => {
      up(app);
    };
    try {
      vm.runInContext(source, vm.createContext({ migrate, Collection, Record }), { timeout: 2000 });
    } catch (e) {
      errors.push('migration-error');
    }
  }
  return { saved, errors };
}

// ---------- 检查 ----------

const OWN = '@request.auth.id';
const LOGGED_IN = '@request.auth.id != ""';

// 不依赖快照文件的不变量：返回不成立的键（空数组表示全部成立）。输入是 snapshotFromSaved 的结果
export function checkInvariants(snap) {
  const out = [];
  const u = snap.collections.users;
  const j = snap.collections.journey_docs;
  const has = (r, text) => typeof r === 'string' && r.includes(text);
  const bad = (key, cond) => {
    if (!cond) out.push(key);
  };
  if (!u) out.push('users.*');
  else {
    bad('users.createRule', u.createRule === null);
    bad('users.deleteRule', u.deleteRule === null);
    bad('users.manageRule', u.manageRule === null);
    bad('users.listRule', u.listRule === `id = ${OWN}`);
    bad('users.viewRule', u.viewRule === `id = ${OWN}`);
    bad('users.updateRule', has(u.updateRule, `id = ${OWN}`) && has(u.updateRule, '@request.body.verified:isset = false'));
    const d = u.authToken.duration;
    bad('users.authToken.duration', d >= 7776000 && d <= 94670856);
    bad('users.oauth2.enabled', u.oauth2.enabled === false);
    bad('users.otp.enabled', u.otp.enabled === false);
    bad('users.mfa.enabled', u.mfa.enabled === false);
    bad('users.authAlert.enabled', u.authAlert.enabled === false);
    bad('users.passwordAuth.enabled', u.passwordAuth.enabled === true);
    bad('users.passwordAuth.identityFields', stable(u.passwordAuth.identityFields) === '["email"]');
    for (const name of ['name', 'avatar']) bad(`users.${name}`, !u.fields.some((f) => f.name === name));
  }
  if (!j) out.push('journey_docs.*');
  else {
    bad('journey_docs.deleteRule', j.deleteRule === null);
    for (const r of ['listRule', 'viewRule', 'updateRule']) bad(`journey_docs.${r}`, has(j[r], `owner = ${OWN}`) && has(j[r], LOGGED_IN));
    bad('journey_docs.createRule', has(j.createRule, `@request.body.owner = ${OWN}`) && has(j.createRule, LOGGED_IN));
    bad('journey_docs.updateRule', has(j.updateRule, '@request.body.owner:isset = false') && has(j.updateRule, '@request.body.kind:isset = false'));
    const field = (name) => j.fields.find((f) => f.name === name) ?? {};
    bad('journey_docs.data', field('data').maxSize === 4194304);
    bad('journey_docs.writer', field('writer').max === 40);
    bad('journey_docs.kind', stable(field('kind').values) === '["state","plan"]');
    const unique = j.indexes.filter((i) => /UNIQUE/i.test(i) && i.includes('`owner`') && i.includes('`kind`'));
    bad('journey_docs.indexes', unique.length === 1);
  }
  return out;
}

// 返回问题行数组（空数组表示通过）：沙箱错误、不变量、快照差异
export function checkSources(sources, expected) {
  const { saved, errors } = execMigrations(sources);
  const snap = snapshotFromSaved(saved);
  const problems = [];
  for (const e of [...new Set(errors)]) problems.push(`MIGRATIONS INVARIANT ${e}`);
  for (const k of checkInvariants(snap)) problems.push(`MIGRATIONS INVARIANT ${k}`);
  for (const d of diffSnapshots(expected, snap)) problems.push(`MIGRATIONS MISMATCH ${d}`);
  return problems;
}

function readSources(dir) {
  const names = readdirSync(dir)
    .filter((n) => n.endsWith('.js'))
    .sort();
  return names.map((n) => readFileSync(path.join(dir, n), 'utf8'));
}

// ---------- 命令行 ----------

function parseArgs(argv) {
  const opts = { migrations: DEFAULT_MIGRATIONS, expected: DEFAULT_EXPECTED, selfTest: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--self-test') opts.selfTest = true;
    else if ((a === '--migrations' || a === '--expected') && i + 1 < argv.length) {
      opts[a.slice(2)] = argv[i + 1];
      i += 1;
    } else return null;
  }
  if (opts.selfTest && (argv.length !== 1)) return null;
  return opts;
}

function runCheck(opts) {
  let sources;
  let expected;
  try {
    sources = readSources(opts.migrations);
    expected = JSON.parse(readFileSync(opts.expected, 'utf8'));
  } catch (e) {
    console.error(`${USAGE} (cannot read the migrations directory or the expected snapshot)`);
    return 2;
  }
  if (sources.length === 0) {
    console.error(`${USAGE} (no migration files found)`);
    return 2;
  }
  const problems = checkSources(sources, expected);
  if (problems.length > 0) {
    for (const p of problems) console.log(p);
    return 1;
  }
  console.log('MIGRATIONS MATCH');
  return 0;
}

// ---------- 自检 ----------

// 读真实的两个迁移源码，在内存里逐一篡改，同一个检查函数必须报出；另有一条未篡改的正向对照
function selfTest() {
  let sources;
  let expected;
  try {
    sources = readSources(DEFAULT_MIGRATIONS);
    expected = JSON.parse(readFileSync(DEFAULT_EXPECTED, 'utf8'));
  } catch (e) {
    console.error(`${USAGE} (cannot read the migrations directory or the expected snapshot)`);
    return 2;
  }
  if (sources.length !== 2) {
    console.error(`${USAGE} (expected exactly two migration files)`);
    return 2;
  }
  const IDX = 'CREATE UNIQUE INDEX `idx_journey_docs_owner_kind` ON `journey_docs` (`owner`, `kind`)';
  const OWNED = String.raw`"@request.auth.id != \"\" && owner = @request.auth.id"`;
  const LOGGED = String.raw`"@request.auth.id != \"\""`;
  // [名字, 迁移序号, 目标文本, 替换文本, 结果里必须含有的片段]
  const cases = [
    ['开放注册（createRule 改为空字符串）', 0, 'users.createRule = null', 'users.createRule = ""', 'users.createRule'],
    ['删掉 deleteRule 那一行', 0, '  users.deleteRule = null\n', '', 'users.deleteRule'],
    ['放开 manageRule', 0, 'users.manageRule = null', 'users.manageRule = "id = @request.auth.id"', 'users.manageRule'],
    ['令牌改成 5 天', 0, 'users.authToken.duration = 7776000', 'users.authToken.duration = 432000', 'users.authToken.duration'],
    ['开 OAuth2', 0, 'users.oauth2.enabled = false', 'users.oauth2.enabled = true', 'users.oauth2.enabled'],
    ['开 OTP', 0, 'users.otp.enabled = false', 'users.otp.enabled = true', 'users.otp.enabled'],
    ['开 MFA', 0, 'users.mfa.enabled = false', 'users.mfa.enabled = true', 'users.mfa.enabled'],
    ['开 authAlert', 0, 'users.authAlert.enabled = false', 'users.authAlert.enabled = true', 'users.authAlert.enabled'],
    ['updateRule 去掉 verified 那一段', 0, ' && @request.body.verified:isset = false', '', 'users.updateRule'],
    ['不再删 name 字段', 0, '  users.fields.removeByName("name")\n', '', 'users.name'],
    ['不再删 avatar 字段', 0, '  users.fields.removeByName("avatar")\n', '', 'users.avatar'],
    ['journey_docs 的 listRule 去掉 owner 条件', 1, `listRule: ${OWNED},`, `listRule: ${LOGGED},`, 'journey_docs.listRule'],
    ['journey_docs 的 updateRule 去掉 kind 的 isset 条件', 1, ' && @request.body.kind:isset = false', '', 'journey_docs.updateRule'],
    ['journey_docs 的 deleteRule 改为空字符串', 1, 'deleteRule: null,', 'deleteRule: "",', 'journey_docs.deleteRule'],
    ['data 的 maxSize 改为 1 MiB', 1, 'maxSize: 4194304', 'maxSize: 1048576', 'journey_docs.data'],
    ['去掉唯一索引', 1, `indexes: ["${IDX}"],`, 'indexes: [],', 'journey_docs.indexes'],
    ['users 迁移里保存一条记录', 0, '  app.save(users)\n}, (app) => {', '  app.save(users)\n  app.save(new Record())\n}, (app) => {', 'data-in-migration'],
    ['迁移里改应用设置', 0, '  app.save(users)\n}, (app) => {', '  app.settings().logs.maxDays = 1\n  app.save(users)\n}, (app) => {', 'migration-error'],
  ];
  const fails = [];
  let passed = 0;
  const report = (ok, n, name) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${name}`);
    if (ok) passed += 1;
    else fails.push(n);
  };
  report(checkSources(sources, expected).length === 0, 0, '正向对照：未篡改的迁移没有问题');
  cases.forEach(([name, which, from, to, needle], i) => {
    const n = i + 1;
    // 源码在 Windows 上可能是 CRLF，统一成 LF 再替换
    const lf = sources.map((s) => s.replace(/\r\n/g, '\n'));
    if (lf[which].split(from).length !== 2) {
      report(false, n, `${name}（目标文本不是恰好出现一次）`);
      return;
    }
    const tampered = lf.map((src, k) => (k === which ? src.replace(from, () => to) : src));
    const problems = checkSources(tampered, expected);
    report(problems.length > 0 && problems.some((p) => p.includes(needle)), n, name);
  });
  if (fails.length > 0) {
    console.log('MIGRATION SELF-TEST FAIL');
    return 1;
  }
  console.log(`MIGRATION SELF-TEST OK ${passed}`);
  return 0;
}

export function main(argv) {
  const opts = parseArgs(argv);
  if (!opts) {
    console.error(USAGE);
    return 2;
  }
  return opts.selfTest ? selfTest() : runCheck(opts);
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
