#!/usr/bin/env node
// 探针字段契约比对器：零依赖，只使用 node: 内置模块。
//
// 用途：让探针结果的写入方（探针页 probe.js）、存储方（PocketBase 迁移文件）和导出方（export-results.py）
// 与同目录的 schema.json 保持一致。schema.json 是 probe_results、probe_pings 字段和规则的唯一定义；
// 字段一漂移就非零退出，汇总（summarize.mjs）就不会悄悄丢记录或误读记录。
//
// 用法：
//   node tools/probe/schema-check.mjs --migration <迁移文件>   在 node:vm 沙箱里执行迁移，比对集合的类型、五条规则和全部字段
//   node tools/probe/schema-check.mjs --page <probe.js>        比对 const RESULT_FIELDS = [...] 与 const PING_FIELDS = [...]
//   node tools/probe/schema-check.mjs --export <export-results.py>  比对 FIELDS = [...]（probe_results 的全部字段，含 created）
//   node tools/probe/schema-check.mjs --self-test
//
// 输出：一致时一行 SCHEMA MATCH <模式>；不一致时逐条 SCHEMA MISMATCH <模式>: <集合>.<字段> <差异种类>，
// 差异种类取 missing、extra、type、required、order、attr、rule、not-found。
//
// 退出码：0 一致；1 不一致；2 用法错误或读不到文件。
//
// 隐私约定：输出只含模式名、集合名、字段名和差异种类，不打印被检查文件的内容。

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// ---------- 契约 ----------

export function loadSchema() {
  return JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'));
}

const USAGE =
  'usage: node tools/probe/schema-check.mjs --migration <migration.js> | --page <probe.js> | --export <export-results.py> | --self-test';

// 对象键的先后不计：按键排序后序列化再比较
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

// schema.json 自身的一致性：两个集合的最后一个字段都是 autodate 的 created（onCreate 真、onUpdate 假），
// number 和 bool 字段不带 required，同一集合里字段名不重复
export function checkSchemaSelf(schema) {
  const out = [];
  for (const [coll, def] of Object.entries(schema.collections)) {
    const fields = def.fields;
    const last = fields[fields.length - 1];
    if (!last || last.name !== 'created' || last.type !== 'autodate' || last.onCreate !== true || last.onUpdate !== false) {
      out.push(`${coll}.created attr`);
    }
    const seen = new Set();
    for (const f of fields) {
      if ((f.type === 'number' || f.type === 'bool') && f.required === true) out.push(`${coll}.${f.name} required`);
      if (seen.has(f.name)) out.push(`${coll}.${f.name} extra`);
      seen.add(f.name);
    }
  }
  return out;
}

// ---------- 迁移 ----------

// 在新的 vm 上下文里执行迁移源码，桩对象只记录 app.save 收到的集合定义；执行出错或超时就当作没有保存任何集合
function execMigration(source) {
  const saved = [];
  class Collection {
    constructor(def) {
      this.def = def;
    }
  }
  const deep = () => {
    const store = new Map();
    return new Proxy(
      {},
      {
        get(_, key) {
          if (typeof key === 'symbol') return undefined;
          if (!store.has(key)) store.set(key, deep());
          return store.get(key);
        },
        set(_, key, value) {
          store.set(key, value);
          return true;
        },
      },
    );
  };
  const app = {
    findCollectionByNameOrId: () => ({}),
    settings: () => deep(),
    save: (x) => {
      saved.push(x);
    },
  };
  const migrate = (up) => {
    up(app);
  };
  try {
    vm.runInContext(source, vm.createContext({ migrate, Collection }), { timeout: 2000 });
  } catch (e) {
    // 语法错误、运行错误、超时：按没有找到集合处理
  }
  return saved.filter((x) => x instanceof Collection).map((x) => x.def);
}

function compareNames(coll, expected, actual) {
  const out = [];
  for (const name of expected) if (!actual.includes(name)) out.push(`${coll}.${name} missing`);
  for (const name of actual) if (!expected.includes(name)) out.push(`${coll}.${name} extra`);
  if (out.length === 0) {
    expected.forEach((name, i) => {
      if (actual[i] !== name) out.push(`${coll}.${name} order`);
    });
  }
  return out;
}

function compareFields(coll, expected, actual) {
  const actualList = Array.isArray(actual) ? actual : [];
  const out = compareNames(
    coll,
    expected.map((f) => f.name),
    actualList.map((f) => f && f.name),
  );
  for (const exp of expected) {
    const act = actualList.find((f) => f && f.name === exp.name);
    if (!act) continue;
    if (exp.type !== act.type) out.push(`${coll}.${exp.name} type`);
    if ((exp.required === true) !== (act.required === true)) out.push(`${coll}.${exp.name} required`);
    const keys = new Set([...Object.keys(exp), ...Object.keys(act)]);
    for (const k of ['type', 'name', 'required']) keys.delete(k);
    if ([...keys].some((k) => stable(exp[k]) !== stable(act[k]))) out.push(`${coll}.${exp.name} attr`);
  }
  return out;
}

export function checkMigration(source, schema = loadSchema()) {
  const defs = execMigration(source);
  const out = [];
  for (const [coll, spec] of Object.entries(schema.collections)) {
    const def = defs.find((d) => d && d.name === coll);
    if (!def) {
      out.push(`${coll}.* not-found`);
      continue;
    }
    if (def.type !== spec.type) out.push(`${coll}.type attr`);
    for (const [rule, value] of Object.entries(spec.rules)) {
      if ((def[rule] ?? null) !== value) out.push(`${coll}.${rule} rule`);
    }
    out.push(...compareFields(coll, spec.fields, def.fields));
  }
  return out;
}

// ---------- 探针页与导出脚本 ----------

const ITEM = String.raw`\s*(?:"[A-Za-z0-9_]+"|'[A-Za-z0-9_]+')\s*`;
const LIST_BODY = new RegExp(String.raw`^(?:${ITEM}(?:,${ITEM})*,?)?\s*$`);

// 取出以 re 开头、只含字符串字面量和逗号的数组字面量；找不到或含别的内容返回 null
function stringList(source, re) {
  const m = re.exec(source);
  if (!m || !LIST_BODY.test(m[1])) return null;
  return [...m[1].matchAll(/["']([A-Za-z0-9_]+)["']/g)].map((x) => x[1]);
}

const namesOf = (schema, coll, withAutodate) => schema.collections[coll].fields.filter((f) => withAutodate || f.type !== 'autodate').map((f) => f.name);

export function checkPage(source, schema = loadSchema()) {
  const out = [];
  const checks = [
    ['probe_results', 'RESULT_FIELDS', /const\s+RESULT_FIELDS\s*=\s*\[([^\]]*)\]/],
    ['probe_pings', 'PING_FIELDS', /const\s+PING_FIELDS\s*=\s*\[([^\]]*)\]/],
  ];
  for (const [coll, label, re] of checks) {
    const actual = stringList(source, re);
    if (actual === null) out.push(`${coll}.${label} not-found`);
    else out.push(...compareNames(coll, namesOf(schema, coll, false), actual));
  }
  return out;
}

export function checkExport(source, schema = loadSchema()) {
  const actual = stringList(source, /^\s*FIELDS\s*=\s*\[([^\]]*)\]/m);
  if (actual === null) return ['probe_results.FIELDS not-found'];
  return compareNames('probe_results', namesOf(schema, 'probe_results', true), actual);
}

// ---------- 命令行 ----------

const MODES = {
  '--migration': { name: 'migration', check: checkMigration },
  '--page': { name: 'page', check: checkPage },
  '--export': { name: 'export', check: checkExport },
};

function runMode(argv) {
  const mode = MODES[argv[0]];
  if (!mode || argv.length !== 2) {
    console.error(USAGE);
    return 2;
  }
  let source;
  try {
    source = readFileSync(argv[1], 'utf8');
  } catch (e) {
    console.error(`${USAGE} (cannot read the ${mode.name} file)`);
    return 2;
  }
  const schema = loadSchema();
  const self = checkSchemaSelf(schema);
  const problems = self.length > 0 ? self.map((p) => `SCHEMA MISMATCH schema: ${p}`) : mode.check(source, schema).map((p) => `SCHEMA MISMATCH ${mode.name}: ${p}`);
  if (problems.length > 0) {
    for (const p of problems) console.log(p);
    return 1;
  }
  console.log(`SCHEMA MATCH ${mode.name}`);
  return 0;
}

// ---------- 自检 ----------

function selfTest() {
  const schema = loadSchema();
  const fails = [];
  let n = 0;
  const t = (name, cond) => {
    n += 1;
    if (!cond) fails.push(name);
  };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const has = (res, item) => res.includes(item);

  // 合成迁移文本：把 schema.json 的字段对象序列化后拼进 migrate 调用
  const synthMigration = (mutate = () => {}) => {
    const defs = clone(schema.collections);
    mutate(defs);
    const coll = (name, d) => `  app.save(new Collection({ type: ${JSON.stringify(d.type)}, name: ${JSON.stringify(name)}, ${Object.entries(d.rules)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join(', ')}, fields: ${JSON.stringify(d.fields)} }))`;
    return [
      'migrate((app) => {',
      '  const users = app.findCollectionByNameOrId("users")',
      '  users.createRule = null',
      '  app.save(users)',
      ...Object.entries(defs).map(([name, d]) => coll(name, d)),
      '  const s = app.settings()',
      '  s.logs.maxDays = 2',
      '  s.trustedProxy.headers = ["X-Real-IP"]',
      '  app.save(s)',
      '}, (app) => {})',
    ].join('\n');
  };
  const fieldsOf = (defs, c) => defs[c].fields;
  const idx = (defs, c, name) => fieldsOf(defs, c).findIndex((f) => f.name === name);

  t('迁移：与 schema.json 一致', checkMigration(synthMigration(), schema).length === 0);
  t('迁移：删一个字段 → missing', has(checkMigration(synthMigration((d) => fieldsOf(d, 'probe_results').splice(idx(d, 'probe_results', 'tls_ms'), 1)), schema), 'probe_results.tls_ms missing'));
  t('迁移：多一个字段 → extra', has(checkMigration(synthMigration((d) => fieldsOf(d, 'probe_pings').splice(1, 0, { type: 'text', name: 'note', max: 10 })), schema), 'probe_pings.note extra'));
  t('迁移：改字段类型 → type', has(checkMigration(synthMigration((d) => { fieldsOf(d, 'probe_results')[idx(d, 'probe_results', 'dur_s')].type = 'text'; }), schema), 'probe_results.dur_s type'));
  t('迁移：给 number 字段加 required → required', has(checkMigration(synthMigration((d) => { fieldsOf(d, 'probe_results')[idx(d, 'probe_results', 'drops')].required = true; }), schema), 'probe_results.drops required'));
  t('迁移：调换两个字段的顺序 → order', checkMigration(synthMigration((d) => {
    const f = fieldsOf(d, 'probe_results');
    const a = idx(d, 'probe_results', 'dns_ms');
    const b = idx(d, 'probe_results', 'tls_ms');
    [f[a], f[b]] = [f[b], f[a]];
  }), schema).some((x) => x.endsWith(' order')));
  t('迁移：改一条规则 → rule', has(checkMigration(synthMigration((d) => { d.probe_results.rules.listRule = '@request.auth.id != ""'; }), schema), 'probe_results.listRule rule'));
  t('迁移：改字段的其他属性 → attr', has(checkMigration(synthMigration((d) => { fieldsOf(d, 'probe_results')[idx(d, 'probe_results', 'run_id')].max = 99; }), schema), 'probe_results.run_id attr'));
  t('迁移：缺一个集合 → not-found', has(checkMigration(synthMigration((d) => { delete d.probe_pings; }), schema), 'probe_pings.* not-found'));
  t('迁移：源码有死循环时在超时后报告而不是挂住', checkMigration('migrate(() => { for (;;) {} }, () => {})', schema).length > 0);

  const fieldNames = (c, withCreated) => schema.collections[c].fields.filter((f) => withCreated || f.type !== 'autodate').map((f) => f.name);
  const list = (names) => `[\n  ${names.map((x) => JSON.stringify(x)).join(',\n  ')},\n]`;
  const page = (r = fieldNames('probe_results', false), p = fieldNames('probe_pings', false)) => `// probe\nconst RESULT_FIELDS = ${list(r)};\nconst PING_FIELDS = ${list(p)};\n`;
  t('页面：与 schema.json 一致', checkPage(page(), schema).length === 0);
  t('页面：RESULT_FIELDS 少一个 → missing', has(checkPage(page(fieldNames('probe_results', false).slice(1)), schema), 'probe_results.run_id missing'));
  t('页面：RESULT_FIELDS 多一个 → extra', has(checkPage(page([...fieldNames('probe_results', false), 'ua']), schema), 'probe_results.ua extra'));
  t('页面：RESULT_FIELDS 顺序不同 → order', checkPage(page(fieldNames('probe_results', false).reverse()), schema).some((x) => x.endsWith(' order')));
  t('页面：PING_FIELDS 不同 → 不一致', checkPage(page(undefined, ['run']), schema).length > 0);
  t('页面：找不到两个常量 → not-found', has(checkPage('const x = 1;', schema), 'probe_results.RESULT_FIELDS not-found') && has(checkPage('const x = 1;', schema), 'probe_pings.PING_FIELDS not-found'));
  t('页面：数组里有非字符串内容 → not-found', has(checkPage('const RESULT_FIELDS = [a, b];\nconst PING_FIELDS = ["run", "seq"];', schema), 'probe_results.RESULT_FIELDS not-found'));

  const py = (names = fieldNames('probe_results', true)) => `import sqlite3\nFIELDS = [\n    ${names.map((x) => JSON.stringify(x)).join(',\n    ')},\n]\n`;
  t('导出：与 schema.json 一致', checkExport(py(), schema).length === 0);
  t('导出：少 created → missing', has(checkExport(py(fieldNames('probe_results', false)), schema), 'probe_results.created missing'));
  t('导出：找不到 FIELDS → not-found', has(checkExport('x = 1', schema), 'probe_results.FIELDS not-found'));

  // schema.json 自身
  t('schema.json：自身一致性检查没有问题', checkSchemaSelf(schema).length === 0);
  const broken = clone(schema);
  broken.collections.probe_results.fields[broken.collections.probe_results.fields.length - 1].onUpdate = true;
  t('schema.json：created 不是 autodate(onCreate 真、onUpdate 假) 会被发现', checkSchemaSelf(broken).length > 0);
  const brokenReq = clone(schema);
  brokenReq.collections.probe_results.fields.find((f) => f.name === 'drops').required = true;
  t('schema.json：number 字段带 required 会被发现', checkSchemaSelf(brokenReq).length > 0);
  const brokenDup = clone(schema);
  brokenDup.collections.probe_pings.fields.splice(1, 0, { type: 'text', name: 'run' });
  t('schema.json：字段名重复会被发现', checkSchemaSelf(brokenDup).length > 0);

  // 命令行
  const quiet = (fn) => {
    const w = process.stderr.write;
    process.stderr.write = () => true;
    try {
      return fn();
    } finally {
      process.stderr.write = w;
    }
  };
  t('不带参数 → 退出码 2', quiet(() => main([])) === 2);
  t('读不到文件 → 退出码 2', quiet(() => main(['--migration', 'tools/probe/no-such-file.js'])) === 2);

  if (fails.length > 0) {
    for (const f of fails) console.log(`SELF-TEST FAIL: ${f}`);
    return 1;
  }
  console.log(`SELF-TEST OK (${n} cases)`);
  return 0;
}

// ---------- 入口 ----------

export function main(argv) {
  if (argv[0] === '--self-test' && argv.length === 1) return selfTest();
  return runMode(argv);
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
