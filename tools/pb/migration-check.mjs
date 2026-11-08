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
import { diffSnapshots, snapshotFromSaved } from './lib/rules-snapshot.mjs';

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

// 返回问题行数组（空数组表示通过）
export function checkSources(sources, expected) {
  const { saved, errors } = execMigrations(sources);
  const problems = [];
  for (const e of [...new Set(errors)]) problems.push(`MIGRATIONS INVARIANT ${e}`);
  for (const d of diffSnapshots(expected, snapshotFromSaved(saved))) problems.push(`MIGRATIONS MISMATCH ${d}`);
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

export function main(argv) {
  const opts = parseArgs(argv);
  if (!opts) {
    console.error(USAGE);
    return 2;
  }
  return runCheck(opts);
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
