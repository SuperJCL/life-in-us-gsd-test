#!/usr/bin/env node
// 服务器配置本机检查（Phase 13，13-05；证明 SEC-02 的限流和代理 IP、OPS-01 的备份与失败提醒）。零依赖，只用 node: 内置模块。
//
// 用途：把要装到服务器上的迁移（deploy/pb_migrations/）和钩子（deploy/pb_hooks/）先在本机一次性 0.41.1 实例上
// 验一遍，13-06 起的服务器模板再原样装上去。实例经 tools/pb/lib/instance.mjs 启动：只用已批准、sha256 钉死的程序，
// 只监听 127.0.0.1 的随机端口，数据放在 test-results/ 下的临时目录里，用完整个删除。
// 本脚本不连接任何真实服务器、域名或外部主机。
//
// 用法：
//   node deploy/server-config-check.mjs --self-test                 不需要程序，检查纯函数
//   node deploy/server-config-check.mjs --local [场景]               场景：settings、watchdog、retire、rotate；不写场景时全部依次运行
//
// 输出：每项一行 `PASS <编号> <中文说明>` 或 `FAIL <编号> <中文说明>`；
// 最后一行 `SERVER-CONFIG OK (N checks)` 或 `SERVER-CONFIG FAIL (k of N)`；自检最后一行 `SELF-TEST OK (N cases)`。
//
// 退出码：0 通过；1 有检查失败；2 参数错误或没有已批准的程序。
//
// 隐私约定：邮箱一律 @example.com，地址一律 198.51.100.x 或 127.0.0.1，口令和钥匙每次随机、只在内存里；
// 输出只写编号、中文说明、计数和布尔，不打印令牌、口令、邮箱、钥匙和日志原文。
// 本脚本不放进 npm test 和 test:cloud，只手动运行。

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntry } from '../tools/pb/lib/entry.mjs';
import { PB_EXE_PATH, freePort, serveArgs, verifyExe, withInstance } from '../tools/pb/lib/instance.mjs';
import { diffSnapshots, snapshotFromLive } from '../tools/pb/lib/rules-snapshot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const APP_MIGRATIONS = path.join(REPO, 'pb', 'pb_migrations');
const DEPLOY_MIGRATIONS = path.join(HERE, 'pb_migrations');
const SCRATCH = path.join(REPO, 'test-results', 'server-config-check');
const PROBE_MIGRATIONS = path.join(REPO, 'tools', 'probe', 'server', 'pb_migrations');
const EXPECTED_RULES_FILE = path.join(REPO, 'pb', 'rules.expected.json');
const RETIRE_FILE = path.join(DEPLOY_MIGRATIONS, '1794096150_retire_probe.js');

// 本脚本自身用低于正常的优先级运行（用户的电脑容易卡）
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  console.error('提示：无法降低脚本自身的优先级，继续以正常优先级运行。');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hex = (n) => crypto.randomBytes(n).toString('hex');

// ---------- 纯函数 ----------

// 期望的限流规则（与 deploy/pb_migrations/1794096200_server_settings.js 一致）
export const EXPECTED_RATE_RULES = [
  { label: '_superusers:auth', duration: 60, maxRequests: 5 },
  { label: '*:auth', duration: 3, maxRequests: 2 },
  { label: '*:create', duration: 5, maxRequests: 20 },
  { label: '/api/batch', duration: 1, maxRequests: 3 },
  { label: '/api/', duration: 10, maxRequests: 300 },
];

// 规则集合比较：返回差异说明数组（空数组 = 一致）。多一条、少一条、数值不同都算差异。
export function diffRules(actual, expected) {
  const diffs = [];
  const list = Array.isArray(actual) ? actual : [];
  const byLabel = new Map();
  for (const r of list) {
    if (!r || typeof r.label !== 'string') {
      diffs.push('规则缺少标签');
      continue;
    }
    if (byLabel.has(r.label)) diffs.push(`标签重复 ${r.label}`);
    byLabel.set(r.label, r);
  }
  for (const e of expected) {
    const a = byLabel.get(e.label);
    if (!a) {
      diffs.push(`缺少 ${e.label}`);
      continue;
    }
    if (a.duration !== e.duration) diffs.push(`${e.label} 时长不同`);
    if (a.maxRequests !== e.maxRequests) diffs.push(`${e.label} 次数不同`);
  }
  for (const label of byLabel.keys()) if (!expected.some((e) => e.label === label)) diffs.push(`多出 ${label}`);
  return diffs;
}

// 迁移目录：在 SCRATCH 下建一个临时目录，复制应用迁移和服务器迁移（文件名原样）。
// opts.deploy 可以是 false（不放服务器迁移）或文件名数组（只放这些）。返回 { dir, files, cleanup }。
export function makeMigrationsDir(opts) {
  const o = opts || {};
  fs.mkdirSync(SCRATCH, { recursive: true });
  const dir = fs.mkdtempSync(path.join(SCRATCH, 'mig-'));
  const files = [];
  const copyFrom = (src, only) => {
    if (!fs.existsSync(src)) return;
    for (const f of fs.readdirSync(src).sort()) {
      if (!f.endsWith('.js')) continue;
      if (only && !only.includes(f)) continue;
      fs.copyFileSync(path.join(src, f), path.join(dir, f));
      files.push(f);
    }
  };
  if (o.app !== false) copyFrom(APP_MIGRATIONS, null);
  if (o.deploy !== false) copyFrom(DEPLOY_MIGRATIONS, Array.isArray(o.deploy) ? o.deploy : null);
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  return { dir, files, cleanup };
}

export const SCENARIO_NAMES = ['settings', 'watchdog', 'retire', 'rotate'];

// 参数解析：返回 { mode: 'self-test' } 或 { mode: 'local', scenarios: [...] } 或 { error }
export function parseArgs(argv, implemented) {
  const known = implemented || SCENARIO_NAMES;
  const a = argv.slice();
  if (a.length === 1 && a[0] === '--self-test') return { mode: 'self-test' };
  if (a[0] === '--local' && a.length <= 2) {
    if (a.length === 1) return { mode: 'local', scenarios: known.slice() };
    if (known.includes(a[1])) return { mode: 'local', scenarios: [a[1]] };
    return { error: `未知场景 ${String(a[1]).replace(/[^A-Za-z0-9_-]/g, '?')}` };
  }
  return { error: '用法：node deploy/server-config-check.mjs --self-test | --local [settings|watchdog|retire|rotate]' };
}

// MIME 编码字（=?UTF-8?B?…?= 和 =?UTF-8?Q?…?=）解码；相邻编码字之间的空白按规范丢掉
export function decodeMimeWords(value) {
  const joined = String(value).replace(/(=\?[^?\s]+\?[BbQq]\?[^?\s]*\?=)\s+(?==\?)/g, '$1');
  return joined.replace(/=\?([^?\s]+)\?([BbQq])\?([^?\s]*)\?=/g, (_m, _cs, enc, text) => {
    if (enc.toUpperCase() === 'B') return Buffer.from(text, 'base64').toString('utf8');
    const bytes = [];
    const t = text.replace(/_/g, ' ');
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(t.slice(i + 1, i + 3))) {
        bytes.push(parseInt(t.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(...Buffer.from(t[i], 'utf8'));
      }
    }
    return Buffer.from(bytes).toString('utf8');
  });
}

// 从一封信的原文里取（解码后的）主题；没有主题返回空串
export function subjectOf(raw) {
  const head = String(raw).split(/\r?\n\r?\n/)[0].replace(/\r?\n[ \t]+/g, ' ');
  const m = /^Subject:[ \t]*(.*)$/im.exec(head);
  return m ? decodeMimeWords(m[1].trim()) : '';
}

// 本机 SMTP 收件端：只绑 127.0.0.1 的随机端口；不宣告 STARTTLS 和 AUTH；把每封信的发件人、收件人和原文存在内存里。
export async function startSmtpSink() {
  const mails = [];
  const sockets = new Set();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {});
    let buf = '';
    let inData = false;
    let cur = { from: '', rcpt: [], raw: '' };
    const reply = (t) => sock.write(`${t}\r\n`);
    const addrOf = (line) => {
      const m = /<([^>]*)>/.exec(line);
      return m ? m[1] : '';
    };
    sock.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          cur.raw = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          mails.push(cur);
          cur = { from: '', rcpt: [], raw: '' };
          reply('250 queued');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') reply('250 localhost');
        else if (cmd === 'MAIL') {
          cur = { from: addrOf(line), rcpt: [], raw: '' };
          reply('250 ok');
        } else if (cmd === 'RCPT') {
          cur.rcpt.push(addrOf(line));
          reply('250 ok');
        } else if (cmd === 'DATA') {
          inData = true;
          reply('354 go ahead');
        } else if (cmd === 'RSET' || cmd === 'NOOP') reply('250 ok');
        else if (cmd === 'QUIT') {
          reply('221 bye');
          sock.end();
          return;
        } else reply('502 not implemented');
      }
    });
    reply('220 localhost ESMTP');
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    mails,
    close: () =>
      new Promise((resolve) => {
        for (const sk of sockets) sk.destroy();
        server.close(() => resolve());
      }),
  };
}

// 等到条件成立或超时；返回最后一次条件的值
async function waitFor(fn, ms, step = 250) {
  const end = Date.now() + ms;
  let v = await fn();
  while (!v && Date.now() < end) {
    await sleep(step);
    v = await fn();
  }
  return v;
}

// 探针账号邮箱的严格形状（与清理迁移里的正则一致）
export const PROBE_EMAIL_RE = /^probe-[0-9a-f]{8}@example\.com$/;

// 探针账号迁移模板：两个占位换成给定的邮箱和口令
export function fillProbeUser(tpl, email, password) {
  return String(tpl).split('__PROBE_EMAIL__').join(email).split('__PROBE_PASSWORD__').join(password);
}

// _params 里 settings 行的值：能解析成 JSON 对象就是明文，否则是密文
export function isEncryptedSettings(value) {
  if (value === null || value === undefined) return false;
  // node:sqlite 把 BLOB 列读成 Uint8Array，要先按 UTF-8 还原成文字
  const text = typeof value === 'string' ? value : Buffer.from(value).toString('utf8');
  try {
    const v = JSON.parse(text);
    return !(v && typeof v === 'object');
  } catch {
    return true;
  }
}

// node:sqlite 目前会打印一条实验性警告到 stderr；这里只在加载它的这一刻吞掉这一条
async function openSqlite(file) {
  const orig = process.emitWarning;
  process.emitWarning = (w, ...rest) => {
    const text = typeof w === 'string' ? w : (w && w.message) || '';
    if (/sqlite/i.test(text)) return;
    return orig.call(process, w, ...rest);
  };
  try {
    const { DatabaseSync } = await import('node:sqlite');
    return new DatabaseSync(file);
  } finally {
    process.emitWarning = orig;
  }
}

async function readSettingsRow(dataDir) {
  const db = await openSqlite(path.join(dataDir, 'data.db'));
  try {
    const row = db.prepare("SELECT value FROM _params WHERE id = 'settings'").get();
    return row ? { exists: true, value: row.value } : { exists: false, value: null };
  } finally {
    db.close();
  }
}

async function deleteSettingsRow(dataDir) {
  const db = await openSqlite(path.join(dataDir, 'data.db'));
  try {
    db.prepare("DELETE FROM _params WHERE id = 'settings'").run();
  } finally {
    db.close();
  }
}

// 直接起 PocketBase 进程（实例库的 withInstance 不能重启同一个库，也不能传钥匙环境变量）。
// o: { dir（放日志）, dataDir, migrationsDir, hooksDir, env, extraArgs, email, password, upsert, healthMs }
// 返回 { baseUrl, su, healthy, exitCode(), stop() }；输出只写进 o.dir 里的日志。
async function runPb(o) {
  const v = verifyExe();
  if (!v.ok) {
    const e = new Error('未找到已批准的 PocketBase 程序');
    e.code = v.code;
    throw e;
  }
  const env = { ...process.env, GOMAXPROCS: '2', GOMEMLIMIT: '256MiB', ...(o.env || {}) };
  const extra = o.extraArgs || [];
  const common = [`--dir=${o.dataDir}`, `--migrationsDir=${o.migrationsDir}`, `--hooksDir=${o.hooksDir}`, '--automigrate=false', ...extra];
  const logName = `pb-${hex(3)}.log`;
  const exitOf = (child, ms) =>
    new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
      const timer = setTimeout(() => resolve(null), ms);
      child.once('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });

  if (o.upsert) {
    const fd = fs.openSync(path.join(o.dir, logName), 'a');
    const c = spawn(PB_EXE_PATH, [...common, 'superuser', 'upsert', o.email, o.password], { cwd: o.dir, env, stdio: ['ignore', fd, fd], windowsHide: true });
    const code = await exitOf(c, 60000);
    fs.closeSync(fd);
    if (code !== 0) {
      try {
        c.kill();
      } catch {
        /* 已退出 */
      }
      throw new Error(`创建超级用户失败（退出码 ${code === null ? '超时' : code}）`);
    }
  }

  const port = await freePort();
  const fd = fs.openSync(path.join(o.dir, logName), 'a');
  const child = spawn(PB_EXE_PATH, [...serveArgs({ port, dataDir: o.dataDir, migrationsDir: o.migrationsDir, hooksDir: o.hooksDir }), ...extra], {
    cwd: o.dir,
    env,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  });
  fs.closeSync(fd);
  try {
    os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
  } catch {
    /* 设置失败不影响运行 */
  }
  const baseUrl = `http://127.0.0.1:${port}`;
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        child.kill();
      } catch {
        /* 已退出 */
      }
    }
    await exitOf(child, 10000);
  };

  let healthy = false;
  const deadline = Date.now() + (o.healthMs || 30000);
  while (Date.now() < deadline && child.exitCode === null) {
    try {
      const r = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.status === 200) {
        healthy = true;
        break;
      }
    } catch {
      /* 还没就绪 */
    }
    await sleep(200);
  }

  let su = null;
  if (healthy && o.email) {
    try {
      const a = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: o.email, password: o.password }),
        signal: AbortSignal.timeout(10000),
      });
      if (a.status === 200) {
        const token = (await a.json()).token;
        su = (p, init) => {
          const i = init || {};
          return fetch(`${baseUrl}${p}`, { ...i, headers: { ...(i.headers || {}), Authorization: token }, signal: i.signal || AbortSignal.timeout(30000) });
        };
      }
    } catch {
      su = null;
    }
  }
  return { baseUrl, su, healthy, exitCode: () => child.exitCode, stop };
}

// ---------- 报告 ----------

const results = [];

function check(id, text, ok) {
  results.push({ id, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${text}`);
  return !!ok;
}

async function httpJson(url, init) {
  const r = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(15000) });
  let body = null;
  try {
    body = await r.json();
  } catch {
    body = null;
  }
  return { status: r.status, body };
}

// ---------- 场景 settings ----------

async function scenarioSettings() {
  const mig = makeMigrationsDir();
  try {
    await withInstance({ migrationsDir: mig.dir }, async ({ baseUrl, su }) => {
      const sr = await su('/api/settings');
      const s = sr.status === 200 ? await sr.json() : {};
      const logs = s.logs || {};
      check('S-01', '日志保留 30 天、记客户端 IP、不记账号 id', logs.maxDays === 30 && logs.logIP === true && logs.logAuthId === false);
      const hdrs = (s.trustedProxy || {}).headers;
      check('S-02', '只信任 X-Real-IP 这一个代理头', Array.isArray(hdrs) && hdrs.length === 1 && hdrs[0] === 'X-Real-IP');
      const rl = s.rateLimits || {};
      check('S-03', '限流已启用', rl.enabled === true);
      const rd = diffRules(rl.rules, EXPECTED_RATE_RULES);
      check('S-04', `限流规则恰好是 5 条且数值一致${rd.length ? `（${rd.join('；')}）` : ''}`, rd.length === 0);
      const bk = s.backups || {};
      check('S-05', '自动备份每天 19:00 UTC（北京时间 03:00）、保留 30 份', bk.cron === '0 19 * * *' && bk.cronMaxKeep === 30);
      check('S-06', '应用名为 usj', (s.meta || {}).appName === 'usj');

      // 后台登录限流：同一 X-Real-IP 前 5 次得到 400（口令错），第 6 次 429
      const loginUrl = `${baseUrl}/api/collections/_superusers/auth-with-password`;
      const attempt = (ip) =>
        httpJson(loginUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
          body: JSON.stringify({ identity: `nobody-${hex(6)}@example.com`, password: hex(12) }),
        });
      const codes = [];
      for (let i = 0; i < 6; i++) codes.push((await attempt('198.51.100.7')).status);
      check('S-07', '同一 IP 后台登录前 5 次 400、第 6 次 429', codes.slice(0, 5).every((c) => c === 400) && codes[5] === 429);
      const other = await attempt('198.51.100.8');
      check('S-08', '换一个 IP 的后台登录不受影响（400，不是 429）', other.status === 400);

      // 日志里记的客户端 IP（userIP）是代理头给的值，直连的对端（remoteIP）才是回环地址
      let found = false;
      const deadline = Date.now() + 10000;
      while (!found && Date.now() < deadline) {
        const lr = await su('/api/logs?page=1&perPage=200&sort=-created');
        const items = lr.status === 200 ? ((await lr.json()).items || []) : [];
        found = items.some((it) => {
          const d = (it && it.data) || {};
          return String(d.url || '').includes('_superusers/auth-with-password') && d.userIP === '198.51.100.7' && d.remoteIP === '127.0.0.1';
        });
        if (!found) await sleep(500);
      }
      check('S-09', '请求日志里的客户端 IP（userIP）是代理头给的值，不是回环地址', found);
    });
  } finally {
    mig.cleanup();
  }
}

// ---------- 场景 watchdog ----------

const WATCH_SUBJECT = '计划手记：备份异常';

async function scenarioWatchdog() {
  const mig = makeMigrationsDir();
  const sink = await startSmtpSink();
  try {
    await withInstance({ migrationsDir: mig.dir, hooksFrom: 'deploy/pb_hooks' }, async ({ baseUrl, su }) => {
      const json = async (p, init) => {
        const r = await su(p, init);
        let body = null;
        try {
          body = await r.json();
        } catch {
          body = null;
        }
        return { status: r.status, body };
      };
      const post = (p) => su(p, { method: 'POST' });
      const patchSettings = (obj) =>
        json('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

      const crons = (await json('/api/crons')).body;
      const list = Array.isArray(crons) ? crons : [];
      const watch = list.find((c) => c && c.id === 'usj-backup-watch');
      const auto = list.find((c) => c && c.id === '__pbAutoBackup__');
      check('W-01', '定时任务里有看门狗（30 20 * * *）和内置自动备份（0 19 * * *）', !!watch && watch.expression === '30 20 * * *' && !!auto && auto.expression === '0 19 * * *');

      // 本机收件端当 SMTP；发件人和收件人都是合成地址
      const senderAddr = 'backup@example.com';
      const patch = await patchSettings({
        smtp: { enabled: true, host: '127.0.0.1', port: sink.port, tls: false, username: '', password: '' },
        meta: { senderAddress: senderAddr, senderName: 'usj' },
      });
      const recs = (await json('/api/collections/_superusers/records')).body;
      const suEmail = recs && recs.items && recs.items[0] ? String(recs.items[0].email).toLowerCase() : '';
      const r1 = await post('/api/crons/usj-backup-watch');
      await waitFor(() => sink.mails.length >= 1, 10000);
      await sleep(1000);
      const m1 = sink.mails[0];
      const w02 =
        patch.status === 200 &&
        r1.status === 204 &&
        sink.mails.length === 1 &&
        !!m1 &&
        suEmail !== '' &&
        m1.rcpt.map((a) => a.toLowerCase()).join() === suEmail &&
        m1.from === senderAddr &&
        subjectOf(m1.raw) === WATCH_SUBJECT;
      check('W-02', '没有自动备份时看门狗恰好给超级用户发 1 封「计划手记：备份异常」', w02);

      const r2 = await post('/api/crons/__pbAutoBackup__');
      const hasBackup = async () => {
        const b = (await json('/api/backups')).body;
        return Array.isArray(b) && b.some((f) => f && String(f.key).startsWith('@auto_pb_backup_usj_'));
      };
      const got = await waitFor(hasBackup, 30000, 500);
      check('W-03', '运行内置自动备份任务后出现 @auto_pb_backup_usj_ 开头的备份', r2.status === 204 && !!got);

      const before = sink.mails.length;
      const r3 = await post('/api/crons/usj-backup-watch');
      await sleep(5000);
      check('W-04', '有新备份时再运行看门狗，5 秒内没有新信', r3.status === 204 && sink.mails.length === before);

      // 打开指向没人监听的本机端口的 S3，内置备份任务失败后应给超级用户发告警邮件
      const dead = await freePort();
      const p2 = await patchSettings({
        backups: { s3: { enabled: true, endpoint: `http://127.0.0.1:${dead}`, bucket: 'b', region: 'auto', accessKey: 'ak', secret: 'sk', forcePathStyle: true } },
      });
      const r4 = await post('/api/crons/__pbAutoBackup__');
      const alerted = await waitFor(() => sink.mails.length >= before + 1, 15000);
      const last = sink.mails[sink.mails.length - 1];
      const w05 =
        p2.status === 200 &&
        r4.status === 204 &&
        !!alerted &&
        !!last &&
        last.rcpt.map((a) => a.toLowerCase()).join() === suEmail &&
        subjectOf(last.raw) !== '' &&
        subjectOf(last.raw) !== WATCH_SUBJECT;
      check('W-05', '备份上传失败时 PocketBase 自带告警邮件发给超级用户', w05);

      const h = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      check('W-06', '钩子运行后实例仍然健康', h.status === 200);
    });
  } finally {
    await sink.close();
    mig.cleanup();
  }
}

// ---------- 场景 retire（探针清理，按服务器上的真实顺序） ----------

async function scenarioRetire() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-sc-retire-'));
  const dataDir = path.join(work, 'pb_data');
  const hooksDir = path.join(work, 'pb_hooks');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(hooksDir);
  const email = `su-${hex(6)}@example.com`;
  const password = hex(16);
  const probeEmail = 'probe-0a1b2c3d@example.com';
  const keepEmail = 'synth-keep@example.com';
  const A = path.join(work, 'mig-a');
  fs.mkdirSync(A);
  let wasThere = { schema: false, probeUser: false };
  try {
    // A 段：服务器上已经应用的状态——只有两个探针迁移，前缀比应用迁移大
    fs.copyFileSync(path.join(PROBE_MIGRATIONS, 'probe_schema.js'), path.join(A, '1794200000_probe_schema.js'));
    const tpl = fs.readFileSync(path.join(PROBE_MIGRATIONS, 'probe_user.js.tpl'), 'utf8');
    fs.writeFileSync(path.join(A, '1794200001_probe_user.js'), fillProbeUser(tpl, probeEmail, hex(16)));
    const a = await runPb({ dir: work, dataDir, migrationsDir: A, hooksDir, email, password, upsert: true });
    // 经超级用户 API 另建一个普通用户，并确认探针集合和探针账号都在
    try {
      if (a.su) {
        const pw = hex(12);
        await a.su('/api/collections/users/records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: keepEmail, password: pw, passwordConfirm: pw }),
        });
        const c1 = await a.su('/api/collections/probe_results');
        const c2 = await a.su('/api/collections/probe_pings');
        wasThere.schema = c1.status === 200 && c2.status === 200;
        const pu = await a.su(`/api/collections/users/records?filter=${encodeURIComponent(`email='${probeEmail}'`)}`);
        const puj = pu.status === 200 ? await pu.json() : {};
        wasThere.probeUser = Array.isArray(puj.items) && puj.items.length === 1;
      }
    } finally {
      await a.stop();
    }

    // B 段：删掉两个探针迁移文件，放入两个应用迁移和 deploy 下的迁移，再启动同一个库
    const mig = makeMigrationsDir();
    try {
      const b = await runPb({ dir: work, dataDir, migrationsDir: mig.dir, hooksDir, email, password });
      try {
        const su = b.su;
        const get = async (p) => {
          if (!su) return { status: 0, body: null };
          const r = await su(p);
          let body = null;
          try {
            body = await r.json();
          } catch {
            body = null;
          }
          return { status: r.status, body };
        };
        const c1 = await get('/api/collections/probe_results');
        const c2 = await get('/api/collections/probe_pings');
        check('R-01', '两个探针集合都已删除', wasThere.schema && c1.status === 404 && c2.status === 404);
        const pu = await get(`/api/collections/users/records?filter=${encodeURIComponent(`email='${probeEmail}'`)}`);
        check('R-02', '探针账号已删除', wasThere.probeUser && pu.status === 200 && pu.body.items.length === 0);
        const ku = await get(`/api/collections/users/records?filter=${encodeURIComponent(`email='${keepEmail}'`)}`);
        check('R-03', '别的用户保留', ku.status === 200 && ku.body.items.length === 1);
        const users = await get('/api/collections/users');
        const docs = await get('/api/collections/journey_docs');
        let diffs = ['无法读取'];
        try {
          const expected = JSON.parse(fs.readFileSync(EXPECTED_RULES_FILE, 'utf8'));
          if (users.body && docs.body) diffs = diffSnapshots(expected, snapshotFromLive([users.body, docs.body]));
        } catch {
          diffs = ['无法读取'];
        }
        check('R-04', `清理后集合规则与 pb/rules.expected.json 一致${diffs.length ? `（${diffs.length} 处差异）` : ''}`, diffs.length === 0);
        const st = await get('/api/settings');
        check('R-05', '服务器设置迁移也已应用（日志保留 30 天）', st.status === 200 && st.body && st.body.logs && st.body.logs.maxDays === 30);
      } finally {
        await b.stop();
      }
    } finally {
      mig.cleanup();
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}

// ---------- 场景 rotate（加密钥匙和轮换） ----------

async function scenarioRotate() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-sc-rotate-'));
  const dataDir = path.join(work, 'pb_data');
  const hooksDir = path.join(work, 'pb_hooks');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(hooksDir);
  const mig = makeMigrationsDir({ deploy: ['1794096200_server_settings.js'] });
  const email = `su-${hex(6)}@example.com`;
  const password = hex(16);
  const K1 = hex(16);
  const K2 = hex(16);
  const keyArgs = ['--encryptionEnv=PB_ENCRYPTION_KEY'];
  const base = { dir: work, dataDir, migrationsDir: mig.dir, hooksDir, email, password };
  try {
    // K-01：带 K1 启动一次（迁移存设置），停止后看 _params 里 settings 行不是合法 JSON
    const a = await runPb({ ...base, env: { PB_ENCRYPTION_KEY: K1 }, extraArgs: keyArgs, upsert: true });
    const upOk = a.healthy;
    await a.stop();
    const row1 = await readSettingsRow(dataDir);
    check('K-01', '带钥匙启动后设置存成密文（不是合法 JSON）', upOk && row1.exists && isEncryptedSettings(row1.value));

    // K-02：不带钥匙，进程直接退出，健康检查从未通过
    const b = await runPb({ ...base, healthMs: 15000 });
    const bCode = b.exitCode();
    await b.stop();
    check('K-02', '不带钥匙启动时进程以非 0 退出、从未健康', !b.healthy && bCode !== null && bCode !== 0);

    // K-03：轮换——停着的库里删掉 settings 行，以新时间戳重放服务器设置迁移，带 K2 启动
    await deleteSettingsRow(dataDir);
    const stamp = Math.floor(Date.now() / 1000);
    fs.copyFileSync(path.join(DEPLOY_MIGRATIONS, '1794096200_server_settings.js'), path.join(mig.dir, `${stamp}_server_settings_reapply.js`));
    const c = await runPb({ ...base, env: { PB_ENCRYPTION_KEY: K2 }, extraArgs: keyArgs });
    let readBack = false;
    try {
      if (c.healthy && c.su) {
        const r = await c.su('/api/settings');
        const s = r.status === 200 ? await r.json() : null;
        readBack = !!s && !!s.logs && s.logs.maxDays === 30 && !!s.rateLimits && Array.isArray(s.rateLimits.rules) && s.rateLimits.rules.length === 5;
      }
    } catch {
      readBack = false;
    }
    const cHealthy = c.healthy && !!c.su;
    await c.stop();
    const row3 = await readSettingsRow(dataDir);
    check('K-03', '轮换后新钥匙可以启动、超级用户能登录、设置读回正确且又是密文', cHealthy && readBack && row3.exists && isEncryptedSettings(row3.value));

    // K-04：再带旧钥匙 K1 启动，进程以非 0 退出
    const d = await runPb({ ...base, env: { PB_ENCRYPTION_KEY: K1 }, extraArgs: keyArgs, healthMs: 15000 });
    const dCode = d.exitCode();
    await d.stop();
    check('K-04', '轮换后用旧钥匙启动时进程以非 0 退出、从未健康', !d.healthy && dCode !== null && dCode !== 0);
  } finally {
    mig.cleanup();
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}

const SCENARIOS = {
  settings: { ids: ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'S-07', 'S-08', 'S-09'], run: scenarioSettings },
  watchdog: { ids: ['W-01', 'W-02', 'W-03', 'W-04', 'W-05', 'W-06'], run: scenarioWatchdog },
  retire: { ids: ['R-01', 'R-02', 'R-03', 'R-04', 'R-05'], run: scenarioRetire },
  rotate: { ids: ['K-01', 'K-02', 'K-03', 'K-04'], run: scenarioRotate },
};

// ---------- 自检 ----------

async function selfTest() {
  const out = [];
  const t = (name, ok) => {
    out.push(!!ok);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${out.length} ${name}`);
  };
  const clone = () => EXPECTED_RATE_RULES.map((r) => ({ ...r }));
  t('规则集合：完全一致没有差异', diffRules(clone(), EXPECTED_RATE_RULES).length === 0);
  t('规则集合：顺序不同不算差异', diffRules(clone().reverse(), EXPECTED_RATE_RULES).length === 0);
  const more = clone();
  more.push({ label: '/extra', duration: 1, maxRequests: 1 });
  t('规则集合：多一条判失败', diffRules(more, EXPECTED_RATE_RULES).length > 0);
  t('规则集合：少一条判失败', diffRules(clone().slice(1), EXPECTED_RATE_RULES).length > 0);
  const dur = clone();
  dur[0].duration = 30;
  t('规则集合：时长不同判失败', diffRules(dur, EXPECTED_RATE_RULES).length > 0);
  const cnt = clone();
  cnt[0].maxRequests = 6;
  t('规则集合：次数不同判失败', diffRules(cnt, EXPECTED_RATE_RULES).length > 0);
  t('规则集合：不是数组判失败', diffRules(undefined, EXPECTED_RATE_RULES).length > 0);

  const m = makeMigrationsDir();
  try {
    const appFiles = fs.readdirSync(APP_MIGRATIONS).filter((f) => f.endsWith('.js'));
    const depFiles = fs.existsSync(DEPLOY_MIGRATIONS) ? fs.readdirSync(DEPLOY_MIGRATIONS).filter((f) => f.endsWith('.js')) : [];
    const there = fs.readdirSync(m.dir);
    t('迁移目录：应用迁移都在且名字不变', appFiles.length >= 2 && appFiles.every((f) => there.includes(f)));
    t('迁移目录：服务器迁移都在且名字不变', depFiles.includes('1794096200_server_settings.js') && depFiles.every((f) => there.includes(f)));
    t('迁移目录：内容与原文件逐字节相同', appFiles.every((f) => fs.readFileSync(path.join(m.dir, f)).equals(fs.readFileSync(path.join(APP_MIGRATIONS, f)))));
  } finally {
    m.cleanup();
  }
  t('迁移目录：用完删除', !fs.existsSync(m.dir));
  const only = makeMigrationsDir({ deploy: false });
  try {
    t('迁移目录：deploy:false 时不含服务器迁移', !fs.readdirSync(only.dir).includes('1794096200_server_settings.js'));
  } finally {
    only.cleanup();
  }

  const b64 = Buffer.from('计划手记：备份异常', 'utf8').toString('base64');
  t('主题解码：B 编码', decodeMimeWords(`=?UTF-8?B?${b64}?=`) === '计划手记：备份异常');
  const qp = Buffer.from('计划手记：备份异常', 'utf8').toString('hex').toUpperCase().replace(/(..)/g, '=$1');
  t('主题解码：Q 编码', decodeMimeWords(`=?UTF-8?Q?${qp}?=`) === '计划手记：备份异常');
  t('主题解码：相邻编码字拼接并丢掉中间空白', decodeMimeWords('=?UTF-8?Q?=E8=AE=A1?= =?UTF-8?Q?=E5=88=92?=') === '计划');
  t('主题解码：没有编码字时原样返回', decodeMimeWords('plain subject') === 'plain subject');
  t('主题提取：折行的主题头', subjectOf(`From: a\r\nSubject: =?UTF-8?B?${b64}?=\r\nTo: b\r\n\r\nbody`) === '计划手记：备份异常');
  const tpl = fs.readFileSync(path.join(PROBE_MIGRATIONS, 'probe_user.js.tpl'), 'utf8');
  const filled = fillProbeUser(tpl, 'probe-0a1b2c3d@example.com', 'p'.repeat(32));
  t('探针模板：两个占位都被换掉', filled.includes('probe-0a1b2c3d@example.com') && filled.includes('p'.repeat(32)) && !filled.includes('__PROBE_'));
  const probeCases = (re) =>
    re.test('probe-0a1b2c3d@example.com') &&
    !re.test('probe-0a1b2c3d@example.org') &&
    !re.test('xprobe-0a1b2c3d@example.com') &&
    !re.test('probe-0a1b2c3@example.com') &&
    !re.test('probe-0a1b2c3dd@example.com') &&
    !re.test('probe-0A1B2C3D@example.com') &&
    !re.test('synth-keep@example.com');
  t('探针邮箱正则：只命中严格形状', probeCases(PROBE_EMAIL_RE));
  const retireSrc = fs.readFileSync(RETIRE_FILE, 'utf8');
  const rm = /const PROBE = \/(.+)\/\r?\n/.exec(retireSrc);
  t('清理迁移里的正则与这里的一致，且同样只命中严格形状', !!rm && rm[1] === PROBE_EMAIL_RE.source && probeCases(new RegExp(rm[1])));
  t('清理迁移只删两个固定名字的集合', retireSrc.includes('"probe_pings"') && retireSrc.includes('"probe_results"') && (retireSrc.match(/app\.delete\(/g) || []).length === 2);
  t('密文判断：JSON 对象是明文', isEncryptedSettings('{"meta":{}}') === false);
  t('密文判断：非 JSON 文字是密文', isEncryptedSettings('Zm9vYmFyYmF6') === true && isEncryptedSettings('{"x":1') === true);
  t('密文判断：空值不算密文', isEncryptedSettings(null) === false);
  t('密文判断：BLOB 里的 JSON 对象是明文，随机字节是密文', isEncryptedSettings(new Uint8Array(Buffer.from('{"meta":{}}'))) === false && isEncryptedSettings(new Uint8Array(crypto.randomBytes(48))) === true);
  t('参数：--self-test', parseArgs(['--self-test']).mode === 'self-test');
  t('参数：--local 不带场景时全部运行', parseArgs(['--local']).scenarios.length === SCENARIO_NAMES.length);
  t('参数：--local settings', parseArgs(['--local', 'settings']).scenarios[0] === 'settings');
  t('参数：未知场景报错', typeof parseArgs(['--local', 'nope']).error === 'string');
  t('参数：没有参数或多余参数报错', typeof parseArgs([]).error === 'string' && typeof parseArgs(['--local', 'settings', 'x']).error === 'string');

  // 收件端的对话：用一个本机 socket 走一遍 EHLO -> MAIL -> RCPT -> DATA -> QUIT，应收到恰好一封
  const sink = await startSmtpSink();
  try {
    const subj = `=?UTF-8?B?${b64}?=`;
    const lines = [
      'EHLO test',
      'MAIL FROM:<from@example.com>',
      'RCPT TO:<to@example.com>',
      'DATA',
      `Subject: ${subj}\r\n\r\nbody\r\n.`,
      'QUIT',
    ];
    const reply = await new Promise((resolve) => {
      const sock = net.connect({ host: '127.0.0.1', port: sink.port });
      let got = '';
      let step = 0;
      const timer = setTimeout(() => {
        sock.destroy();
        resolve(got);
      }, 5000);
      sock.on('data', (d) => {
        got += d.toString('utf8');
        const complete = got.split('\r\n').filter(Boolean).length;
        if (complete > step && step < lines.length) {
          sock.write(`${lines[step]}\r\n`);
          step += 1;
        }
      });
      sock.on('close', () => {
        clearTimeout(timer);
        resolve(got);
      });
      sock.on('error', () => {});
    });
    const m = sink.mails[0];
    t(
      '收件端：EHLO 到 QUIT 走完，收到一封，发件人、收件人和主题都对',
      reply.includes('221') && sink.mails.length === 1 && !!m && m.from === 'from@example.com' && m.rcpt.join() === 'to@example.com' && subjectOf(m.raw) === '计划手记：备份异常',
    );
    t('收件端：不宣告 STARTTLS 和 AUTH', !/STARTTLS|AUTH/i.test(reply));
  } finally {
    await sink.close();
  }

  const all = out.every(Boolean);
  console.log(all ? `SELF-TEST OK (${out.length} cases)` : `SELF-TEST FAIL (${out.filter((x) => !x).length} of ${out.length})`);
  return all;
}

// ---------- 入口 ----------

async function runLocal(names) {
  const v = verifyExe();
  if (!v.ok) {
    console.error('未找到已批准的 PocketBase 程序，或它的 sha256 与钉死值不一致，拒绝运行（见 tools/pb/PB-LOCAL.md）。');
    return 2;
  }
  // 实例的数据目录放在 test-results/ 下（instance.mjs 用系统临时目录，这里把它指过来，结束后整个删除）
  fs.mkdirSync(SCRATCH, { recursive: true });
  const oldTemp = { TEMP: process.env.TEMP, TMP: process.env.TMP };
  process.env.TEMP = SCRATCH;
  process.env.TMP = SCRATCH;
  try {
    for (const name of names) {
      const sc = SCENARIOS[name];
      try {
        await sc.run();
      } catch (e) {
        if (e && ['missing', 'unpinned', 'mismatch'].includes(e.code)) {
          console.error(e.message);
          return 2;
        }
        console.log(`FAIL ${name} 场景中途出错 ${e && e.code ? `[${e.code}]` : ''} ${e && e.message ? String(e.message).slice(0, 80) : ''}`.trimEnd());
      }
      for (const id of sc.ids) if (!results.some((r) => r.id === id)) check(id, '没有运行到这一项', false);
    }
  } finally {
    process.env.TEMP = oldTemp.TEMP;
    process.env.TMP = oldTemp.TMP;
    fs.rmSync(SCRATCH, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
  const bad = results.filter((r) => !r.ok).length;
  console.log(bad === 0 ? `SERVER-CONFIG OK (${results.length} checks)` : `SERVER-CONFIG FAIL (${bad} of ${results.length})`);
  return bad === 0 ? 0 : 1;
}

if (isEntry(import.meta.url)) {
  const p = parseArgs(process.argv.slice(2), Object.keys(SCENARIOS));
  if (p.error) {
    console.error(p.error);
    process.exit(2);
  } else if (p.mode === 'self-test') {
    process.exit((await selfTest()) ? 0 : 1);
  } else {
    process.exit(await runLocal(p.scenarios));
  }
}
