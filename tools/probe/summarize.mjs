#!/usr/bin/env node
// 探针结果汇总器：零依赖，只使用 node: 内置模块。
//
// 用途：把服务器上导出的探针结果（JSON 数组，每个元素是一条 probe_results 记录）汇总成
// 06-PROBE-RESULTS.md 里的表格。字段名、类型和取值范围以同目录的 schema.json 为准（它是唯一定义），
// 本脚本按它解析字段；不再在别处抄字段表。
//
// 用法：
//   node tools/probe/summarize.mjs <结果.json>
//   node tools/probe/summarize.mjs --self-test
//   node tools/probe/summarize.mjs --example
//
// 判定规则（单次运行；D-06、D-07、D-10）：
//   首屏：first_screen_ms ≤ 5000 才达标；
//   登录：login_ok 为真且 login_ms ≤ 3000 才达标；
//   实时：drop 事件与随后的 reconnect 事件逐个配对；
//         连续型 = drops 为 0 且全部打点收到；
//         重连型 = 每次掉线都有配对的重连且 ms ≤ 10000，且全部打点收到；
//   有效运行：dur_s ≥ 590、hidden_ms 为 0、nav_type 为 navigate、run_id 不以 verify- 开头，
//             且有 carrier 和 net；无效运行不计入达标率（缺 dur_s 按“短”算，缺 hidden_ms 按“后台”算）。
//
// 退出码：0 成功；1 用法或输入错误。
//
// 隐私约定：输出只含运营商、网络类型、浏览器粗分类、run_id 前 4 位和数字；
// 不输出 IP、域名、User-Agent 原文或任何个人信息，也不输出当前时间（同一输入两次运行逐字节相同）。

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------- 常量 ----------

export const FIRST_SCREEN_LIMIT_MS = 5000;
export const LOGIN_LIMIT_MS = 3000;
export const RECONNECT_LIMIT_MS = 10000;
export const MIN_DURATION_S = 590;

export const CARRIER_ORDER = ['telecom', 'unicom', 'mobile', 'us'];
export const NET_ORDER = ['cell4g', 'home', 'other'];
export const CARRIER_NAME = { telecom: '电信', unicom: '联通', mobile: '移动', us: '美国' };
export const NET_NAME = { cell4g: '手机 4G', home: '家宽', other: '其他' };

// ---------- 字段契约 ----------

let schemaCache = null;

export function loadSchema() {
  if (!schemaCache) {
    schemaCache = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'));
  }
  return schemaCache;
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function parseField(field, v) {
  switch (field.type) {
    case 'number':
      return finite(v) ? v : null;
    case 'bool':
      return typeof v === 'boolean' ? v : null;
    case 'select':
      return typeof v === 'string' && field.values.includes(v) ? v : null;
    case 'json': {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try {
          const parsed = JSON.parse(v);
          return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
          return null;
        }
      }
      return null;
    }
    default:
      return typeof v === 'string' ? v : null;
  }
}

// 按 schema.json 里 probe_results 的字段类型解析一条记录；缺失一律是 null（不是 0）；
// schema 之外的键丢弃，键名放进返回值的 unknown 数组。
export function normalizeRow(raw, schema = loadSchema()) {
  const fields = schema.collections.probe_results.fields;
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const known = new Set(fields.map((f) => f.name));
  const row = {};
  for (const f of fields) row[f.name] = parseField(f, src[f.name]);
  row.unknown = Object.keys(src)
    .filter((k) => !known.has(k))
    .sort();
  return row;
}

// ---------- 有效性与达标判定 ----------

export function isValidRun(row) {
  if (row.carrier === null || row.net === null) return { valid: false, reason: 'missing' };
  if (typeof row.run_id === 'string' && row.run_id.startsWith('verify-')) return { valid: false, reason: 'smoke' };
  if (row.dur_s === null || row.dur_s < MIN_DURATION_S) return { valid: false, reason: 'short' };
  if (row.hidden_ms === null || row.hidden_ms > 0) return { valid: false, reason: 'hidden' };
  if (row.nav_type !== 'navigate') return { valid: false, reason: 'not-navigate' };
  return { valid: true, reason: null };
}

// 把 events 里的 drop 与随后的 reconnect 按先后顺序配对（reconnect 配最近一个未配对的 drop）。
// 返回 [{ t, paired, ms }]；ms 取 reconnect 事件自带的 ms，没有就用两个时刻之差（秒转毫秒）。
export function pairDrops(events) {
  const drops = [];
  for (const e of Array.isArray(events) ? events : []) {
    if (!e || typeof e !== 'object') continue;
    if (e.k === 'drop') {
      drops.push({ t: finite(e.t) ? e.t : null, paired: false, ms: null });
    } else if (e.k === 'reconnect') {
      for (let i = drops.length - 1; i >= 0; i -= 1) {
        if (drops[i].paired) continue;
        drops[i].paired = true;
        if (finite(e.ms)) drops[i].ms = e.ms;
        else if (finite(e.t) && drops[i].t !== null) drops[i].ms = Math.round((e.t - drops[i].t) * 1000);
        break;
      }
    }
  }
  return drops;
}

export function runVerdict(row) {
  const firstScreen = finite(row.first_screen_ms) && row.first_screen_ms <= FIRST_SCREEN_LIMIT_MS;
  const login = row.login_ok === true && finite(row.login_ms) && row.login_ms <= LOGIN_LIMIT_MS;

  let realtime = false;
  const pingsAllOk = finite(row.pings_total) && row.pings_total > 0 && row.pings_ok === row.pings_total;
  if (pingsAllOk && finite(row.drops)) {
    const drops = pairDrops(row.events);
    if (row.drops === 0 && drops.length === 0) {
      realtime = true; // 连续型
    } else {
      // 重连型：每个计数的掉线都要在 events 里出现，并且都有配对的重连且不超过 10 秒
      realtime =
        drops.length > 0 &&
        drops.length >= row.drops &&
        drops.every((d) => d.paired && finite(d.ms) && d.ms <= RECONNECT_LIMIT_MS);
    }
  }
  return { firstScreen, login, realtime };
}

// ---------- 统计 ----------

export function median(values) {
  const v = values.filter(finite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// 最近秩法：第 ceil(p × n) 小的值
export function percentile(values, p) {
  const v = values.filter(finite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const rank = Math.min(v.length, Math.max(1, Math.ceil(p * v.length - 1e-9)));
  return v[rank - 1];
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function statsOf(validRows) {
  const verdicts = validRows.map(runVerdict);
  const fsVals = validRows.map((r) => r.first_screen_ms).filter(finite);
  const loginVals = validRows.filter((r) => r.login_ok === true).map((r) => r.login_ms).filter(finite);
  const reconnects = validRows.map((r) => r.max_reconnect_ms).filter(finite);
  return {
    valid: validRows.length,
    fs: { median: median(fsVals), p90: percentile(fsVals, 0.9), pass: verdicts.filter((d) => d.firstScreen).length },
    login: { median: median(loginVals), p90: percentile(loginVals, 0.9), pass: verdicts.filter((d) => d.login).length },
    rt: { pass: verdicts.filter((d) => d.realtime).length },
    drops: sum(validRows.map((r) => (finite(r.drops) ? r.drops : 0))),
    maxReconnect: reconnects.length ? Math.max(...reconnects) : null,
    lost: sum(validRows.filter((r) => finite(r.pings_total) && finite(r.pings_ok)).map((r) => Math.max(0, r.pings_total - r.pings_ok))),
  };
}

// Task 1 的判定：三项达标率都 ≥ 2/3 才是合格，否则不合格（分级在后面细化）
function gradeOf(stats) {
  const ok = (pass) => stats.valid > 0 && pass * 3 >= stats.valid * 2;
  return ok(stats.fs.pass) && ok(stats.login.pass) && ok(stats.rt.pass) ? '合格' : '不合格';
}

const orderIndex = (list, v) => {
  const i = list.indexOf(v);
  return i === -1 ? list.length : i;
};

// 只用有效运行，按 carrier × net 分组；分组和输出的顺序固定
export function groupTable1(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (row.carrier === null || row.net === null) continue;
    const key = `${row.carrier}/${row.net}`;
    if (!groups.has(key)) groups.set(key, { carrier: row.carrier, net: row.net, all: [], valid: [] });
    const g = groups.get(key);
    g.all.push(row);
    if (isValidRun(row).valid) g.valid.push(row);
  }
  return [...groups.values()]
    .sort((a, b) => orderIndex(CARRIER_ORDER, a.carrier) - orderIndex(CARRIER_ORDER, b.carrier) || orderIndex(NET_ORDER, a.net) - orderIndex(NET_ORDER, b.net))
    .map((g) => {
      const stats = statsOf(g.valid);
      return { carrier: g.carrier, net: g.net, total: g.all.length, ...stats, grade: gradeOf(stats) };
    });
}

// ---------- 渲染 ----------

const cell = (v) => String(v).replace(/[|\r\n]/g, ' ');
const num = (v) => (v === null || v === undefined ? '-' : String(Math.round(v)));
const rate = (pass, n) => (n === 0 ? '-' : `${Math.round((pass * 100) / n)}% (${pass}/${n})`);
const medP90 = (s) => (s.median === null ? '-' : `${num(s.median)} (${num(s.p90)})`);

export const TABLE1_TITLE = '## 表 1：按运营商 × 网络类型的达标情况';

export function renderTable1(groups) {
  const lines = [
    TABLE1_TITLE,
    '',
    '| 运营商 | 网络 | 有效/总次数 | 首屏中位(P90) ms | 首屏达标率 | 登录中位(P90) ms | 登录达标率 | 实时达标率 | 掉线总数 | 最大重连 ms | 打点丢失 | 判定 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const g of groups) {
    lines.push(
      `| ${cell(CARRIER_NAME[g.carrier] ?? '未知')} | ${cell(NET_NAME[g.net] ?? '未知')} | ${g.valid}/${g.total} | ${medP90(g.fs)} | ${rate(g.fs.pass, g.valid)} | ${medP90(g.login)} | ${rate(g.login.pass, g.valid)} | ${rate(g.rt.pass, g.valid)} | ${g.drops} | ${num(g.maxReconnect)} | ${g.lost} | ${g.grade} |`,
    );
  }
  return lines.join('\n') + '\n';
}

// ---------- 合成示例数据（只在代码里构造，不含任何真实信息） ----------

function exampleRaw() {
  const mk = (i, o = {}) => ({
    run_id: `ex${String(i).padStart(2, '0')}-synthetic`,
    carrier: 'telecom',
    net: 'home',
    browser: 'chrome',
    started_at: '2026-11-06T12:30:00Z',
    tz_offset_min: 480,
    dur_s: 600,
    nav_type: 'navigate',
    fs_src: 'fcp',
    first_screen_ms: 1800,
    ttfb_ms: 400,
    load_ms: 2200,
    dns_ms: 30,
    connect_ms: 180,
    tls_ms: 260,
    sdk_ms: 300,
    api_rtt_ms: 210,
    login_ms: 900,
    login_ok: true,
    rt_connect_ms: 350,
    hidden_ms: 0,
    drops: 0,
    max_reconnect_ms: 0,
    pings_ok: 6,
    pings_total: 6,
    push_ms: [220, 240, 230, 250, 260, 245],
    events: [],
    created: '2026-11-06 12:41:00.000Z',
    ...o,
  });
  return [
    // 电信 家宽：三次有效，一次首屏慢
    mk(1),
    mk(2, { started_at: '2026-11-06T13:10:00Z', first_screen_ms: 2400, push_ms: JSON.stringify([210, 220, 215, 225, 230, 240]), events: '[]' }),
    mk(3, { started_at: '2026-11-07T14:00:00Z', first_screen_ms: 6200 }),
    // 电信 手机 4G：一次掉线后没有重连，一次通过
    mk(4, { net: 'cell4g', started_at: '2026-11-06T12:45:00Z', drops: 1, events: [{ k: 'drop', t: 140 }] }),
    mk(5, { net: 'cell4g', started_at: '2026-11-06T13:40:00Z', first_screen_ms: 3100, login_ms: 1500 }),
    // 联通 家宽：五次有效，三次实时达标
    mk(6, { carrier: 'unicom', started_at: '2026-11-06T12:20:00Z' }),
    mk(7, {
      carrier: 'unicom',
      started_at: '2026-11-06T13:00:00Z',
      drops: 1,
      max_reconnect_ms: 4200,
      events: [{ k: 'drop', t: 100 }, { k: 'reconnect', t: 104.2, ms: 4200 }],
    }),
    mk(8, { carrier: 'unicom', started_at: '2026-11-07T12:40:00Z' }),
    mk(9, {
      carrier: 'unicom',
      started_at: '2026-11-07T13:30:00Z',
      drops: 1,
      max_reconnect_ms: 12000,
      events: [{ k: 'drop', t: 200 }, { k: 'reconnect', t: 212, ms: 12000 }],
    }),
    mk(10, {
      carrier: 'unicom',
      started_at: '2026-11-07T14:10:00Z',
      dur_s: 900,
      drops: 1,
      max_reconnect_ms: 2000,
      pings_ok: 4,
      push_ms: [210, 230, 220, 240, 'lost', 'lost'],
      events: [{ k: 'drop', t: 496 }, { k: 'reconnect', t: 498, ms: 2000 }],
    }),
    // 移动 手机 4G：登录有一次失败
    mk(11, { carrier: 'mobile', net: 'cell4g', started_at: '2026-11-06T12:35:00Z' }),
    mk(12, { carrier: 'mobile', net: 'cell4g', started_at: '2026-11-06T13:25:00Z' }),
    mk(13, { carrier: 'mobile', net: 'cell4g', started_at: '2026-11-07T12:50:00Z', login_ok: false, login_ms: 3500 }),
    mk(14, { carrier: 'mobile', started_at: '2026-11-07T13:45:00Z' }),
    // 美国：一次本地晚高峰，一次其他时段
    mk(15, { carrier: 'us', browser: 'safari', tz_offset_min: -480, started_at: '2026-11-07T04:30:00Z', legacy_x: 1 }),
    mk(16, { carrier: 'us', browser: 'safari', tz_offset_min: -480, started_at: '2026-11-07T14:00:00Z', first_screen_ms: 5000 }),
    // 无效运行：短、后台、非冷加载、冒烟、缺运营商
    mk(17, { dur_s: 120 }),
    mk(18, { hidden_ms: 4000 }),
    mk(19, { nav_type: 'reload' }),
    { ...mk(20), run_id: 'verify-smoke-synthetic' },
    (() => {
      const r = mk(21);
      delete r.carrier;
      return r;
    })(),
  ];
}

export function exampleRows() {
  return exampleRaw();
}

// ---------- 入口 ----------

export function renderAll(rawRows, schema = loadSchema()) {
  const rows = rawRows.map((r) => normalizeRow(r, schema));
  return renderTable1(groupTable1(rows));
}

const USAGE = 'usage: node tools/probe/summarize.mjs <results.json> | --self-test | --example';

function selfTest() {
  const schema = loadSchema();
  const fails = [];
  let n = 0;
  const t = (name, cond) => {
    n += 1;
    if (!cond) fails.push(name);
  };
  const eq = (name, a, b) => t(name, JSON.stringify(a) === JSON.stringify(b));
  const mkRow = (over = {}) => {
    const raw = exampleRaw()[0];
    return normalizeRow({ ...raw, ...over }, schema);
  };

  // D-06：首屏与登录边界
  t('首屏 5000 达标', runVerdict(mkRow({ first_screen_ms: 5000 })).firstScreen === true);
  t('首屏 5001 不达标', runVerdict(mkRow({ first_screen_ms: 5001 })).firstScreen === false);
  t('首屏缺失不达标', runVerdict(mkRow({ first_screen_ms: undefined })).firstScreen === false);
  t('登录 3000 达标', runVerdict(mkRow({ login_ms: 3000 })).login === true);
  t('登录 3001 不达标', runVerdict(mkRow({ login_ms: 3001 })).login === false);
  t('login_ok 为假不达标', runVerdict(mkRow({ login_ok: false, login_ms: 100 })).login === false);

  // D-07：连续型
  t('drops 为 0 且打点全收到，实时达标', runVerdict(mkRow()).realtime === true);
  t('打点丢失一条，实时不达标', runVerdict(mkRow({ pings_ok: 5 })).realtime === false);
  t('打点总数为 0，实时不达标', runVerdict(mkRow({ pings_ok: 0, pings_total: 0 })).realtime === false);

  // D-10：有效运行
  t('dur_s 589 无效', isValidRun(mkRow({ dur_s: 589 })).reason === 'short');
  t('dur_s 590 有效', isValidRun(mkRow({ dur_s: 590 })).valid === true);
  t('verify- 开头为 smoke', isValidRun(mkRow({ run_id: 'verify-abc' })).reason === 'smoke');

  // 解析
  const parsed = mkRow({ push_ms: '[1,2,3]', events: '[{"k":"drop","t":5}]' });
  eq('push_ms 写成 JSON 字符串时照样解析', parsed.push_ms, [1, 2, 3]);
  eq('events 写成 JSON 字符串时照样解析', parsed.events, [{ k: 'drop', t: 5 }]);
  t('缺失的 tls_ms 解析为 null 不是 0', mkRow({ tls_ms: undefined }).tls_ms === null);
  eq('schema 之外的键进入 unknown', mkRow({ zzz_extra: 1, aaa_extra: 2 }).unknown, ['aaa_extra', 'zzz_extra']);
  t('schema 之外的键被丢弃', !('zzz_extra' in mkRow({ zzz_extra: 1 })));

  // schema.json 自身
  const last = (c) => schema.collections[c].fields.at(-1);
  const isCreated = (f) => f.name === 'created' && f.type === 'autodate' && f.onCreate === true && f.onUpdate === false;
  t('probe_results 的最后一个字段是 autodate 的 created', isCreated(last('probe_results')));
  t('probe_pings 的最后一个字段是 autodate 的 created', isCreated(last('probe_pings')));

  // 中位数与 P90
  t('中位数 1 个样本', median([7]) === 7);
  t('中位数 2 个样本', median([2, 4]) === 3);
  t('中位数 5 个样本', median([9, 1, 5, 3, 7]) === 5);
  t('P90 1 个样本', percentile([7], 0.9) === 7);
  t('P90 2 个样本', percentile([2, 4], 0.9) === 4);
  t('P90 5 个样本', percentile([1, 2, 3, 4, 5], 0.9) === 5);
  t('空样本的中位数为 null', median([]) === null);

  // 通路
  const example = renderAll(exampleRaw());
  t('表 1 标题固定', example.split('\n')[0] === TABLE1_TITLE);
  t('表 1 有电信行', example.split('\n').some((l) => l.startsWith('| 电信 |')));
  t('表 1 不含 undefined 或 NaN', !/undefined|NaN/.test(example));

  if (fails.length > 0) {
    for (const f of fails) console.log(`SELF-TEST FAIL: ${f}`);
    return 1;
  }
  console.log(`SELF-TEST OK (${n} cases)`);
  return 0;
}

export function main(argv) {
  if (argv.length === 0) {
    console.log(USAGE);
    return 1;
  }
  if (argv[0] === '--self-test') return selfTest();
  if (argv[0] === '--example') {
    process.stdout.write(renderAll(exampleRaw()));
    return 0;
  }
  if (argv.length !== 1 || argv[0].startsWith('--')) {
    console.log(USAGE);
    return 1;
  }
  let data;
  try {
    data = JSON.parse(readFileSync(argv[0], 'utf8'));
  } catch (e) {
    console.log(`error: cannot read results (${e && e.code ? e.code : 'invalid JSON'})`);
    return 1;
  }
  if (!Array.isArray(data)) {
    console.log('error: results must be a JSON array');
    return 1;
  }
  process.stdout.write(renderAll(data));
  return 0;
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
