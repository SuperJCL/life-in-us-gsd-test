#!/usr/bin/env node
// 探针结果汇总器：零依赖，只使用 node: 内置模块。
//
// 用途：把服务器上导出的探针结果（JSON 数组，每个元素是一条 probe_results 记录）汇总成
// 06-PROBE-RESULTS.md 里的表格。字段名、类型和取值范围以同目录的 schema.json 为准（它是唯一定义），
// 本脚本按它解析字段；不再在别处抄字段表。
//
// 用法：
//   node tools/probe/summarize.mjs <结果.json>          表 1、表 2 和附注（markdown）
//   node tools/probe/summarize.mjs --json <结果.json>   每家运营商的三项达标率、分级和无效原因计数（JSON）
//   node tools/probe/summarize.mjs --block <结果.json>  默认输出原样包在 summarize:begin / summarize:end 标记之间
//   node tools/probe/summarize.mjs --self-test
//   node tools/probe/summarize.mjs --example            用内置的合成数据集跑同一条通路（可加 --json、--block）
//   node tools/probe/summarize.mjs --example-data       把内置的合成数据集输出成 JSON 数组
//
// 判定规则（单次运行；D-06、D-07、D-10）：
//   首屏：first_screen_ms ≤ 5000 才达标；
//   登录：login_ok 为真且 login_ms ≤ 3000 才达标；
//   实时：drop 事件与随后的 reconnect 事件逐个配对；
//         连续型 = drops 为 0 且全部打点收到；
//         重连型 = 每次掉线都有配对的重连且 ms ≤ 10000，且全部打点收到；
//   时段（D-18）：按测试人本地时间（started_at 加 tz_offset_min，北京为 480）；本地 20:00–22:59 为晚高峰，
//             tz 为 480 记“北京晚高峰”，运营商为美国记“美国本地晚高峰”，其余“其他时段”；凌晨 0–5 点算前一晚；
//   分级（D-18）：每家运营商按有效运行的达标率：≥ 2/3 合格，> 1/2 且 < 2/3 临界，≤ 1/2 不合格，没有有效运行为样本不足；
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
export const NET_NAME = { cell4g: '手机 4G', home: '家宽', other: '其他', total: '合计' };

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

// D-18：≥ 2/3 为合格，> 1/2 且 < 2/3 为临界，≤ 1/2 为不合格；没有有效运行为样本不足（整数运算，没有浮点误差）
export function gradeRatio(pass, total) {
  if (!(total > 0)) return '样本不足';
  if (pass * 3 >= total * 2) return '合格';
  if (pass * 2 > total) return '临界';
  return '不合格';
}

const GRADE_RANK = { 样本不足: 0, 不合格: 1, 临界: 2, 合格: 3 };

// 判定列取首屏、登录、实时三项里最差的一级
function gradeOf(stats) {
  const grades = [stats.fs.pass, stats.login.pass, stats.rt.pass].map((p) => gradeRatio(p, stats.valid));
  return grades.reduce((worst, g) => (GRADE_RANK[g] < GRADE_RANK[worst] ? g : worst));
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
  const sorted = [...groups.values()].sort(
    (a, b) => orderIndex(CARRIER_ORDER, a.carrier) - orderIndex(CARRIER_ORDER, b.carrier) || orderIndex(NET_ORDER, a.net) - orderIndex(NET_ORDER, b.net),
  );
  const out = [];
  const carriers = [...new Set(sorted.map((g) => g.carrier))];
  for (const carrier of carriers) {
    const own = sorted.filter((g) => g.carrier === carrier);
    for (const g of own) {
      const stats = statsOf(g.valid);
      out.push({ carrier, net: g.net, total: g.all.length, ...stats, grade: gradeOf(stats) });
    }
    // 每家运营商一行合计：D-18 的“至少三分之二”按这一行判定
    const totalStats = statsOf(own.flatMap((g) => g.valid));
    out.push({ carrier, net: 'total', total: sum(own.map((g) => g.all.length)), ...totalStats, grade: gradeOf(totalStats) });
  }
  return out;
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

// ---------- 时段、夜、空闲断开标注 ----------

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// 测试人的本地时间：started_at（ISO，带时区）加上 tz_offset_min（本地减 UTC 的分钟数，北京为 480）。
// 只接受带时区的 ISO 字符串，避免结果随运行这台机器的时区变化。
function localTime(row) {
  if (typeof row.started_at !== 'string' || !ISO_RE.test(row.started_at) || !finite(row.tz_offset_min)) return null;
  const ms = Date.parse(row.started_at);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + row.tz_offset_min * 60000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

const p2 = (v) => String(v).padStart(2, '0');

// D-18：本地 20:00–22:59 是晚高峰；tz 为 +480 记北京晚高峰，运营商为美国记美国本地晚高峰，其余记其他时段
export function slotOf(row) {
  const lt = localTime(row);
  if (lt === null || lt.h < 20 || lt.h >= 23) return '其他时段';
  if (row.tz_offset_min === 480) return '北京晚高峰';
  if (row.carrier === 'us') return '美国本地晚高峰';
  return '其他时段';
}

// “夜”取本地日期，凌晨 0–5 点算前一晚
export function nightOf(row) {
  const lt = localTime(row);
  if (lt === null) return null;
  const day = lt.h < 6 ? new Date(Date.UTC(lt.y, lt.mo - 1, lt.d - 1)) : new Date(Date.UTC(lt.y, lt.mo - 1, lt.d));
  return `${day.getUTCFullYear()}-${p2(day.getUTCMonth() + 1)}-${p2(day.getUTCDate())}`;
}

export const PING_SCHEDULE_S = [15, 45, 105, 195, 315, 495];
export const IDLE_GAP_MIN_S = 295;
export const IDLE_GAP_MAX_S = 320;

// PocketBase 的实时连接空闲 5 分钟会被服务器断开。某次 drop 距离“上一条送达的打点”（没有就从连接时刻 0 算起）
// 295–320 秒，就标注为疑似服务器空闲断开；只做标注，不改变达标判定。打点计划截到 dur_s 之内，
// push_ms 里对应位置不是数字（lost）的打点不算送达。
export function idleDropSuspect(row) {
  const dur = finite(row.dur_s) ? row.dur_s : 0;
  const push = Array.isArray(row.push_ms) ? row.push_ms : [];
  const delivered = PING_SCHEDULE_S.filter((at, i) => at <= dur && (i < push.length ? finite(push[i]) : true));
  for (const d of pairDrops(row.events)) {
    if (d.t === null) continue;
    let base = 0;
    for (const at of delivered) if (at <= d.t && at > base) base = at;
    const gap = d.t - base;
    if (gap >= IDLE_GAP_MIN_S && gap <= IDLE_GAP_MAX_S) return true;
  }
  return false;
}

// ---------- 表 2 与附注 ----------

const REASON_TEXT = {
  short: '短运行',
  hidden: '后台运行',
  'not-navigate': '非冷加载',
  smoke: '冒烟运行',
  missing: '缺运营商或网络',
};
export const REASON_KEYS = ['short', 'hidden', 'not-navigate', 'smoke', 'missing'];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const runPrefix = (row) => (typeof row.run_id === 'string' ? row.run_id.slice(0, 4).replace(/[^A-Za-z0-9_-]/g, '?') : '-');

export const TABLE2_TITLE = '## 表 2：逐次运行明细（run_id 取前 4 位）';

export function renderTable2(rows) {
  const key = (r) => [
    nightOf(r) ?? '~',
    typeof r.started_at === 'string' ? r.started_at : '~',
    orderIndex(CARRIER_ORDER, r.carrier),
    orderIndex(NET_ORDER, r.net),
    runPrefix(r),
    r.run_id ?? '',
  ];
  const sorted = [...rows].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i += 1) {
      const c = cmp(ka[i], kb[i]);
      if (c !== 0) return c;
    }
    return 0;
  });
  const lines = [
    TABLE2_TITLE,
    '',
    '| run | 夜 | 本地时刻 | 时段 | 运营商 | 网络 | 浏览器 | 首屏 | 登录 | 接口RTT | 建连 | 掉线 | 最大重连 | 打点 ok/总 | 推送中位 ms | 有效 | 判定 | 备注 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of sorted) {
    const lt = localTime(r);
    const validity = isValidRun(r);
    let verdictText = '不计入';
    if (validity.valid) {
      const v = runVerdict(r);
      const failed = [v.firstScreen ? null : '首屏', v.login ? null : '登录', v.realtime ? null : '实时'].filter(Boolean);
      verdictText = failed.length === 0 ? '全部达标' : `未达标：${failed.join('、')}`;
    }
    const pings = finite(r.pings_ok) && finite(r.pings_total) ? `${r.pings_ok}/${r.pings_total}` : '-';
    const pushMedian = Array.isArray(r.push_ms) ? median(r.push_ms) : null;
    const remarks = idleDropSuspect(r) ? '疑似服务器空闲断开' : '-';
    const loginText = r.login_ok === null ? '-' : r.login_ok ? num(r.login_ms) : '失败';
    const validText = validity.valid ? '是' : `否（${REASON_TEXT[validity.reason]}）`;
    lines.push(
      `| ${cell(runPrefix(r))} | ${nightOf(r) ?? '-'} | ${lt ? `${p2(lt.h)}:${p2(lt.mi)}` : '-'} | ${slotOf(r)} | ${cell(CARRIER_NAME[r.carrier] ?? '未知')} | ${cell(NET_NAME[r.net] ?? '未知')} | ${cell(r.browser ?? '未知')} | ${num(r.first_screen_ms)} | ${loginText} | ${num(r.api_rtt_ms)} | ${num(r.connect_ms)} | ${num(r.drops)} | ${num(r.max_reconnect_ms)} | ${pings} | ${num(pushMedian)} | ${validText} | ${verdictText} | ${remarks} |`,
    );
  }
  return lines.join('\n') + '\n';
}

export const NOTES_TITLE = '## 附：无效运行与说明';

function invalidCounts(rows) {
  const counts = Object.fromEntries(REASON_KEYS.map((k) => [k, 0]));
  for (const r of rows) {
    const v = isValidRun(r);
    if (!v.valid) counts[v.reason] += 1;
  }
  return counts;
}

export function renderNotes(rows) {
  const counts = invalidCounts(rows);
  const invalid = sum(Object.values(counts));
  const unknownKeys = new Map();
  for (const r of rows) for (const k of r.unknown) unknownKeys.set(k, (unknownKeys.get(k) ?? 0) + 1);
  const unknownText = unknownKeys.size
    ? [...unknownKeys.entries()]
        .sort((a, b) => cmp(a[0], b[0]))
        .map(([k, c]) => `${k.replace(/[^A-Za-z0-9_.-]/g, '?')}×${c}`)
        .join('、')
    : '无';
  const idle = rows.filter(idleDropSuspect).length;
  return (
    [
      NOTES_TITLE,
      '',
      `- 运行总数 ${rows.length}，有效 ${rows.length - invalid}，无效 ${invalid}。`,
      '- 无效原因计数（无效运行不计入表 1 的达标率）：',
      `  - 短运行（dur_s < 590）：${counts.short}`,
      `  - 后台运行（hidden_ms > 0）：${counts.hidden}`,
      `  - 非冷加载（nav_type 不是 navigate）：${counts['not-navigate']}`,
      `  - 冒烟运行（run_id 以 verify- 开头）：${counts.smoke}`,
      `  - 缺运营商或网络：${counts.missing}`,
      `- 疑似服务器空闲断开：${idle} 次运行（只标注，不改变达标判定）。`,
      `- 契约之外的键（字段漂移的信号）：${unknownText}`,
      '- 达标判定：首屏 ≤ 5000 ms；登录成功且 ≤ 3000 ms；实时为连续型（不掉线）或重连型（每次重连 ≤ 10000 ms），且打点全部收到。',
      '- 分级按每家运营商的有效运行：达标率 ≥ 2/3 为合格，> 1/2 且 < 2/3 为临界，≤ 1/2 为不合格；判定列取三项里最差的一级。',
      '- 表 3（多点站基线）和表 4（美国侧 mtr）由 06-10 从转录数据填写，不由本脚本生成。',
    ].join('\n') + '\n'
  );
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
  return [renderTable1(groupTable1(rows)), renderTable2(rows), renderNotes(rows)].join('\n');
}

const rateOf = (pass, n) => (n > 0 ? Math.round((pass / n) * 10000) / 10000 : null);

// --json：每家运营商的三项达标率、分级和有效/总次数，以及无效原因计数（给 06-10 写结论用）
export function buildJson(rawRows, schema = loadSchema()) {
  const rows = rawRows.map((r) => normalizeRow(r, schema));
  const totals = new Map(groupTable1(rows).filter((g) => g.net === 'total').map((g) => [g.carrier, g]));
  const carriers = {};
  for (const c of CARRIER_ORDER) {
    const g = totals.get(c);
    carriers[c] = g
      ? { firstScreen: rateOf(g.fs.pass, g.valid), login: rateOf(g.login.pass, g.valid), realtime: rateOf(g.rt.pass, g.valid), grade: g.grade, valid: g.valid, total: g.total }
      : { firstScreen: null, login: null, realtime: null, grade: '样本不足', valid: 0, total: 0 };
  }
  return { carriers, invalid: invalidCounts(rows) };
}

// --block：把默认输出原样包在开始和结束标记之间，06-10 用同一命令复核
export function renderBlock(rawRows, sourceName, schema = loadSchema()) {
  const name = String(sourceName)
    .split(/[\\/]/)
    .pop()
    .replace(/[^A-Za-z0-9._-]/g, '_');
  return `<!-- summarize:begin source=${name} -->\n${renderAll(rawRows, schema)}<!-- summarize:end -->\n`;
}

const USAGE =
  'usage: node tools/probe/summarize.mjs [--json | --block] <results.json> | --example [--json | --block] | --example-data | --self-test';

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

  // D-07：重连边界、未配对掉线
  const reconnectRow = (ms) => mkRow({ drops: 1, events: [{ k: 'drop', t: 100 }, { k: 'reconnect', t: 110, ms }] });
  t('重连 10000 ms 达标', runVerdict(reconnectRow(10000)).realtime === true);
  t('重连 10001 ms 不达标', runVerdict(reconnectRow(10001)).realtime === false);
  t('有 drop 没有配对 reconnect，实时不达标', runVerdict(mkRow({ drops: 1, events: [{ k: 'drop', t: 100 }] })).realtime === false);
  t('第二次掉线没有重连，实时不达标', runVerdict(mkRow({ drops: 2, events: [{ k: 'drop', t: 50 }, { k: 'reconnect', t: 52, ms: 2000 }, { k: 'drop', t: 90 }] })).realtime === false);
  t('重连后仍有打点丢失，实时不达标', runVerdict({ ...reconnectRow(3000), pings_ok: 5 }).realtime === false);
  t('drops 比 events 里的 drop 多，实时不达标', runVerdict(mkRow({ drops: 2, events: [{ k: 'drop', t: 50 }, { k: 'reconnect', t: 52, ms: 2000 }] })).realtime === false);
  t('reconnect 没有 ms 时用时刻之差', runVerdict(mkRow({ drops: 1, events: [{ k: 'drop', t: 100 }, { k: 'reconnect', t: 109.9 }] })).realtime === true);

  // D-18：分级边界
  t('3 次有效 2 次达标为合格', gradeRatio(2, 3) === '合格');
  t('5 次里 3 次（0.6）为临界', gradeRatio(3, 5) === '临界');
  t('2 次里 1 次（0.5）为不合格', gradeRatio(1, 2) === '不合格');
  t('3 次里 1 次为不合格', gradeRatio(1, 3) === '不合格');
  t('0 次有效为样本不足', gradeRatio(0, 0) === '样本不足');
  t('全部达标为合格', gradeRatio(4, 4) === '合格');

  // D-18：时段
  const at = (started_at, tz, carrier = 'telecom') => mkRow({ started_at, tz_offset_min: tz, carrier });
  t('北京 20:00 为北京晚高峰', slotOf(at('2026-11-06T12:00:00Z', 480)) === '北京晚高峰');
  t('北京 22:59 为北京晚高峰', slotOf(at('2026-11-06T14:59:00Z', 480)) === '北京晚高峰');
  t('北京 23:00 为其他时段', slotOf(at('2026-11-06T15:00:00Z', 480)) === '其他时段');
  t('北京 19:59 为其他时段', slotOf(at('2026-11-06T11:59:00Z', 480)) === '其他时段');
  t('美国本地 20:30 为美国本地晚高峰', slotOf(at('2026-11-07T04:30:00Z', -480, 'us')) === '美国本地晚高峰');
  t('美国本地早晨为其他时段', slotOf(at('2026-11-06T12:30:00Z', -480, 'us')) === '其他时段');
  t('缺 tz_offset_min 为其他时段', slotOf(mkRow({ tz_offset_min: undefined })) === '其他时段');
  t('夜：北京 20:30 算当天', nightOf(at('2026-11-06T12:30:00Z', 480)) === '2026-11-06');
  t('夜：本地 00:30 算前一晚', nightOf(at('2026-11-06T16:30:00Z', 480)) === '2026-11-06');
  t('夜：本地 05:59 算前一晚', nightOf(at('2026-11-06T21:59:00Z', 480)) === '2026-11-06');
  t('夜：本地 06:00 算当天', nightOf(at('2026-11-06T22:00:00Z', 480)) === '2026-11-07');

  // 空闲断开标注
  const idle = (t0, extra = {}) => mkRow({ dur_s: 3600, drops: 1, events: [{ k: 'drop', t: t0 }, { k: 'reconnect', t: t0 + 1, ms: 1000 }], ...extra });
  t('上一条打点后 294 秒不标注', idleDropSuspect(idle(789)) === false);
  t('上一条打点后 295 秒标注', idleDropSuspect(idle(790)) === true);
  t('上一条打点后 320 秒标注', idleDropSuspect(idle(815)) === true);
  t('上一条打点后 321 秒不标注', idleDropSuspect(idle(816)) === false);
  t('打点都收到时第 300 秒的掉线不标注', idleDropSuspect(idle(300, { dur_s: 600 })) === false);
  t('第 315、495 秒的打点丢失后，第 496 秒的掉线标注', idleDropSuspect(idle(496, { dur_s: 600, push_ms: [210, 230, 220, 240, 'lost', 'lost'] })) === true);
  t('标注不改变达标判定', runVerdict(idle(790, { pings_ok: 6 })).realtime === true);

  // 通路与表 2、附注、--json、--block
  const example = renderAll(exampleRaw());
  const exLines = example.split('\n');
  t('表 1 标题固定', exLines[0] === TABLE1_TITLE);
  t('表 1 有电信行', exLines.some((l) => l.startsWith('| 电信 |')));
  t('表 1 不含 undefined 或 NaN', !/undefined|NaN/.test(example));
  t('表 1 每家运营商有合计行', ['电信', '联通', '移动', '美国'].every((c) => exLines.some((l) => l.startsWith(`| ${c} | 合计 |`))));
  t('输出含表 2 标题', example.includes('## 表 2：逐次运行明细（run_id 取前 4 位）'));
  t('输出含附注标题', example.includes('## 附：无效运行与说明'));
  t('表 2 含空闲断开标注', example.includes('疑似服务器空闲断开'));
  t('表 2 含美国本地晚高峰', example.includes('美国本地晚高峰'));
  t('表 2 不含完整 run_id', !example.includes('synthetic'));
  t('附注列出契约之外的键', example.includes('legacy_x×1'));
  t('附注按原因计数：短运行', example.includes('短运行（dur_s < 590）：1'));
  t('分级覆盖合格、临界、不合格', ['合格', '临界', '不合格'].every((g) => exLines.some((l) => l.startsWith('| ') && l.endsWith(` ${g} |`))));
  t('输出确定：两次渲染逐字节相同', renderAll(exampleRaw()) === example);
  const summary = buildJson(exampleRaw());
  t('--json 里电信为合格', summary.carriers.telecom.grade === '合格');
  t('--json 里联通为临界', summary.carriers.unicom.grade === '临界');
  t('--json 里的无效原因计数', JSON.stringify(summary.invalid) === JSON.stringify({ short: 1, hidden: 1, 'not-navigate': 1, smoke: 1, missing: 1 }));
  const block = renderBlock(exampleRaw(), 'x.json');
  t('--block 首行是带文件名的开始标记', block.split('\n')[0] === '<!-- summarize:begin source=x.json -->');
  t('--block 末行是结束标记', block.split('\n').slice(-2)[0] === '<!-- summarize:end -->' && block.endsWith('\n'));
  t('--block 中间与默认输出相同', block.split('\n').slice(1, -2).join('\n') + '\n' === example);
  t('--block 的文件名只保留安全字符', renderBlock([], 'a b>c.json').startsWith('<!-- summarize:begin source=a_b_c.json -->'));

  if (fails.length > 0) {
    for (const f of fails) console.log(`SELF-TEST FAIL: ${f}`);
    return 1;
  }
  console.log(`SELF-TEST OK (${n} cases)`);
  return 0;
}

export function main(argv) {
  const flags = new Set();
  const pos = [];
  for (const a of argv) {
    if (a.startsWith('--')) flags.add(a);
    else pos.push(a);
  }
  const known = ['--self-test', '--example', '--example-data', '--json', '--block'];
  const usage = () => {
    console.log(USAGE);
    return 1;
  };
  if (argv.length === 0 || [...flags].some((f) => !known.includes(f)) || pos.length > 1) return usage();
  if (flags.has('--self-test')) return argv.length === 1 ? selfTest() : usage();
  if (flags.has('--example-data')) {
    if (argv.length !== 1) return usage();
    process.stdout.write(JSON.stringify(exampleRaw(), null, 2) + '\n');
    return 0;
  }
  if (flags.has('--json') && flags.has('--block')) return usage();
  const useExample = flags.has('--example');
  // 要么 --example，要么给一个结果文件，二者必居其一
  if (useExample === (pos.length === 1)) return usage();
  let data;
  if (useExample) {
    data = exampleRaw();
  } else {
    try {
      data = JSON.parse(readFileSync(pos[0], 'utf8'));
    } catch (e) {
      console.log(`error: cannot read results (${e && e.code ? e.code : 'invalid JSON'})`);
      return 1;
    }
    if (!Array.isArray(data)) {
      console.log('error: results must be a JSON array');
      return 1;
    }
  }
  if (flags.has('--json')) process.stdout.write(JSON.stringify(buildJson(data), null, 2) + '\n');
  else if (flags.has('--block')) process.stdout.write(renderBlock(data, useExample ? 'example' : pos[0]));
  else process.stdout.write(renderAll(data));
  return 0;
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
