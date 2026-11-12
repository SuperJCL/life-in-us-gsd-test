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

import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntry } from '../tools/pb/lib/entry.mjs';
import { freePort, verifyExe, withInstance } from '../tools/pb/lib/instance.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const APP_MIGRATIONS = path.join(REPO, 'pb', 'pb_migrations');
const DEPLOY_MIGRATIONS = path.join(HERE, 'pb_migrations');
const SCRATCH = path.join(REPO, 'test-results', 'server-config-check');

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

const SCENARIOS = {
  settings: { ids: ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06', 'S-07', 'S-08', 'S-09'], run: scenarioSettings },
  watchdog: { ids: ['W-01', 'W-02', 'W-03', 'W-04', 'W-05', 'W-06'], run: scenarioWatchdog },
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
