// 一次性本机 PocketBase 实例库（Phase 8，08-04，TEST-04；D-02）。零依赖，只用 node: 内置模块。
//
// 用途：withInstance(opts, fn) 核对已批准的程序 -> 建系统临时目录 -> 创建超级用户 -> 只在 127.0.0.1 的随机端口启动
// -> 等健康检查 -> 调用 fn -> 停止进程并删除整个临时目录。隔离脚本、录制脚本和 smoke 共用。
//
// 可选参数：opts.migrationsDir 换迁移目录；opts.hooksFrom（目录）在创建超级用户之前把其中所有 *.pb.js 复制进临时的 hooksDir（13-05），
// 不给时行为与以前完全相同。
//
// 安全约定：
//   - 每次启动前核对程序的 sha256；缺失、未钉死或不一致都拒绝运行（退出码 2），换版本必须重新得到所有者批准。
//   - 超级用户的邮箱和口令每次运行时随机生成，只在内存里；创建超级用户的子命令只以参数数组传给 spawn。
//   - 子进程的输出只写进临时目录里的日志文件，不回显；失败时只打印“实例启动失败（退出码 N）”。
//   - 本文件不打印令牌、口令、邮箱、地址和绝对路径。
//
// CLI：
//   node tools/pb/lib/instance.mjs --self-test   不需要程序，检查核对逻辑
//   node tools/pb/lib/instance.mjs --smoke       在真实实例上证明迁移、快照、限流、只监听回环、清理
// 退出码：0 通过；1 检查失败；2 用法错误或前置条件不满足（没有已批准的程序）。

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntry } from './entry.mjs';
import { diffSnapshots, snapshotFromLive } from './rules-snapshot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

// 留存的程序（被 git 忽略）。只在内存里使用，不打印。
export const PB_EXE_PATH = path.join(REPO, 'tools', 'pb', 'bin', 'pocketbase.exe');

// 已批准下载的 exe 的 sha256（08-04 Task 3 在所有者批准的下载完成后写入，2026-11-08）；为空时一律拒绝运行。
export const PB_EXE_SHA256 = 'f44191176f90382d5a03290496b23b333cf64cf6cb2024893cb39f3c10e46f7e';

const MIGRATIONS_DIR = path.join(REPO, 'pb', 'pb_migrations');
const EXPECTED_FILE = path.join(REPO, 'pb', 'rules.expected.json');
const PB_LOCAL_MD = path.join(REPO, 'tools', 'pb', 'PB-LOCAL.md');

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// 纯函数版本：便于自检
export function verifyExeAt(file, pin) {
  if (!fs.existsSync(file)) return { ok: false, code: 'missing' };
  if (!pin) return { ok: false, code: 'unpinned' };
  if (sha256File(file) !== pin) return { ok: false, code: 'mismatch' };
  return { ok: true, code: 'ok' };
}

export function verifyExe() {
  return verifyExeAt(PB_EXE_PATH, PB_EXE_SHA256);
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export function serveArgs(o) {
  return [
    'serve',
    `--http=127.0.0.1:${o.port}`,
    `--dir=${o.dataDir}`,
    `--migrationsDir=${o.migrationsDir}`,
    `--hooksDir=${o.hooksDir}`,
    '--automigrate=false',
  ];
}

const REASON = {
  missing: '未找到已批准的 PocketBase 程序，先完成所有者批准和下载（见 tools/pb/PB-LOCAL.md）。',
  unpinned: 'PocketBase 程序的 sha256 还没有钉死，拒绝运行；下载经所有者批准后才会写入钉死值。',
  mismatch: 'PocketBase 程序的 sha256 与钉死值不一致，拒绝运行，也不会自动重新下载；换版本必须重新得到所有者批准。',
};

function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

function waitExit(child, ms) {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve(child.exitCode);
    const t = setTimeout(() => resolve(null), ms);
    child.once('exit', (code) => {
      clearTimeout(t);
      resolve(code);
    });
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 把目录里的 *.pb.js 复制进目标目录，返回复制的文件名（相对路径按仓库根解析）
export function copyHooks(from, to) {
  const src = path.isAbsolute(from) ? from : path.join(REPO, from);
  const names = fs.readdirSync(src).filter((f) => f.endsWith('.pb.js')).sort();
  for (const f of names) fs.copyFileSync(path.join(src, f), path.join(to, f));
  return names;
}

function openLog(dir, name) {
  return fs.openSync(path.join(dir, name), 'a');
}

export async function withInstance(opts, fn) {
  const v = verifyExe();
  if (!v.ok) throw fail(v.code, REASON[v.code]);

  const migrationsDir = (opts && opts.migrationsDir) || MIGRATIONS_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-pb-'));
  const dataDir = path.join(dir, 'pb_data');
  const hooksDir = path.join(dir, 'pb_hooks');
  fs.mkdirSync(dataDir);
  fs.mkdirSync(hooksDir);
  if (opts && opts.hooksFrom) copyHooks(opts.hooksFrom, hooksDir);

  const email = `su-${crypto.randomBytes(8).toString('hex')}@example.com`;
  const password = crypto.randomBytes(24).toString('hex');
  const env = { ...process.env, GOMAXPROCS: '2', GOMEMLIMIT: '256MiB' };
  let child = null;
  let cleaned = false;

  const stopChild = () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      try {
        child.kill();
      } catch {
        /* 已退出 */
      }
    }
  };
  const removeDir = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
    } catch {
      /* 重试后仍被占用：留给手动清理 */
    }
  };
  const cleanupSync = () => {
    if (cleaned) return;
    cleaned = true;
    stopChild();
    removeDir();
  };
  const onSigint = async () => {
    stopChild();
    if (child) await waitExit(child, 5000);
    cleanupSync();
    process.exit(130);
  };
  const onExit = () => cleanupSync();
  process.on('SIGINT', onSigint);
  process.on('exit', onExit);

  try {
    // 1. 创建超级用户（在 serve 之前，参数数组，不经过 shell）
    const suLog = openLog(dir, 'superuser.log');
    const suChild = spawn(
      PB_EXE_PATH,
      [`--dir=${dataDir}`, `--migrationsDir=${migrationsDir}`, `--hooksDir=${hooksDir}`, '--automigrate=false', 'superuser', 'upsert', email, password],
      { cwd: dir, env, stdio: ['ignore', suLog, suLog], windowsHide: true },
    );
    child = suChild;
    const suCode = await waitExit(suChild, 60000);
    fs.closeSync(suLog);
    if (suCode !== 0) throw fail('start-failed', `实例启动失败（退出码 ${suCode === null ? '超时' : suCode}）`);

    // 2. 启动实例：只监听 127.0.0.1 的随机端口
    const port = await freePort();
    const serveLog = openLog(dir, 'serve.log');
    child = spawn(
      PB_EXE_PATH,
      serveArgs({ port, dataDir, migrationsDir, hooksDir }),
      { cwd: dir, env, stdio: ['ignore', serveLog, serveLog], windowsHide: true },
    );
    fs.closeSync(serveLog);
    try {
      os.setPriority(child.pid, os.constants.priority.PRIORITY_BELOW_NORMAL);
    } catch {
      /* 设置失败不影响运行 */
    }
    const baseUrl = `http://127.0.0.1:${port}`;

    // 3. 等健康检查（30 秒）
    const deadline = Date.now() + 30000;
    let healthy = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw fail('start-failed', `实例启动失败（退出码 ${child.exitCode}）`);
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
    if (!healthy) throw fail('start-failed', '实例启动失败（健康检查超时）');

    // 4. 超级用户登录，令牌只留在闭包里
    const authRes = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
      signal: AbortSignal.timeout(10000),
    });
    if (authRes.status !== 200) throw fail('start-failed', `实例启动失败（超级用户登录 ${authRes.status}）`);
    const superuserToken = (await authRes.json()).token;

    const su = (p, init) => {
      const i = init || {};
      return fetch(`${baseUrl}${p}`, {
        ...i,
        headers: { ...(i.headers || {}), Authorization: superuserToken },
        signal: i.signal || AbortSignal.timeout(30000),
      });
    };

    const ensureRateLimitsOff = async () => {
      const r = await su('/api/settings');
      if (r.status !== 200) throw fail('settings', '读取实例设置失败');
      const s = await r.json();
      if (!(s && s.rateLimits && s.rateLimits.enabled)) return false;
      const p = await su('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateLimits: { enabled: false } }),
      });
      if (p.status !== 200) throw fail('settings', '关闭实例限流失败');
      return true;
    };

    return await fn({ baseUrl, superuserToken, su, ensureRateLimitsOff, dir, port });
  } finally {
    process.off('SIGINT', onSigint);
    stopChild();
    if (child) await waitExit(child, 10000);
    cleanupSync();
    process.off('exit', onExit);
  }
}

// ---------- 自检 ----------

function selfTest() {
  const results = [];
  const check = (name, ok) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${results.length} ${name}`);
  };
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-pbself-'));
  try {
    const f = path.join(work, 'x.bin');
    const bytes = crypto.randomBytes(64);
    fs.writeFileSync(f, bytes);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    check('verifyExeAt 缺文件为 missing', verifyExeAt(path.join(work, 'none.bin'), hash).code === 'missing');
    check('verifyExeAt 空钉死值为 unpinned', verifyExeAt(f, '').code === 'unpinned');
    check('verifyExeAt 哈希不符为 mismatch', verifyExeAt(f, 'ab'.repeat(32)).code === 'mismatch');
    check('verifyExeAt 哈希相符为 ok', verifyExeAt(f, hash).ok === true);
  } finally {
    fs.rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  check('没有程序时 verifyExe 不通过', fs.existsSync(PB_EXE_PATH) || verifyExe().ok === false);
  const sa = serveArgs({ port: 12345, dataDir: 'd', migrationsDir: 'm', hooksDir: 'h' });
  check('serveArgs 只监听回环并关闭 automigrate', sa.includes('--http=127.0.0.1:12345') && sa.includes('--automigrate=false') && !sa.join(' ').includes('0.0.0.0'));
  check('serveArgs 含 serve 与迁移目录', sa[0] === 'serve' && sa.includes('--migrationsDir=m') && sa.includes('--hooksDir=h'));
  const hw = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-pbhooks-'));
  try {
    const from = path.join(hw, 'from');
    const to = path.join(hw, 'to');
    fs.mkdirSync(from);
    fs.mkdirSync(to);
    fs.writeFileSync(path.join(from, 'a.pb.js'), '// a');
    fs.writeFileSync(path.join(from, 'note.txt'), 'x');
    const names = copyHooks(from, to);
    check('copyHooks 只复制 *.pb.js', names.length === 1 && names[0] === 'a.pb.js' && fs.readdirSync(to).join() === 'a.pb.js');
  } finally {
    fs.rmSync(hw, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  check('PB_EXE_SHA256 为空或 PB-LOCAL.md 含同一个值', PB_EXE_SHA256 === '' || (fs.existsSync(PB_LOCAL_MD) && fs.readFileSync(PB_LOCAL_MD, 'utf8').includes(PB_EXE_SHA256)));
  return results;
}

async function selfTestAsync() {
  const results = selfTest();
  const p = await freePort();
  const ok = Number.isInteger(p) && p >= 1024 && p <= 65535;
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${results.length} freePort 返回 1024-65535 的整数`);
  const all = results.every(Boolean);
  console.log(all ? 'INSTANCE SELF-TEST OK' : 'INSTANCE SELF-TEST FAIL');
  return all;
}

// ---------- smoke ----------

function refuseToConnect(host, port) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (refused) => {
      s.destroy();
      resolve(refused);
    };
    s.setTimeout(1000, () => done(true));
    s.once('connect', () => done(false));
    s.once('error', () => done(true));
  });
}

async function smoke() {
  const v = verifyExe();
  if (!v.ok) {
    console.error(REASON[v.code]);
    return 2;
  }
  let allOk = true;
  const report = (name, ok, note) => {
    if (!ok) allOk = false;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${note ? ` ${note}` : ''}`);
  };
  let dirSeen = '';
  try {
    report('exe-sha256', true);
    await withInstance({}, async (inst) => {
      dirSeen = inst.dir;
      const h = await fetch(`${inst.baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      report('health', h.status === 200);

      const users = await inst.su('/api/collections/users');
      const docs = await inst.su('/api/collections/journey_docs');
      const usersJson = users.status === 200 ? await users.json() : null;
      const docsJson = docs.status === 200 ? await docs.json() : null;
      report('migrations-applied', !!usersJson && usersJson.createRule === null && !!docsJson && docsJson.name === 'journey_docs');

      let expected = null;
      try {
        expected = JSON.parse(fs.readFileSync(EXPECTED_FILE, 'utf8'));
      } catch {
        expected = null;
      }
      if (!usersJson || !docsJson || !expected) {
        report('snapshot-match', false, '（无法读取集合或预期快照）');
      } else {
        const diff = diffSnapshots(expected, snapshotFromLive([usersJson, docsJson]));
        report('snapshot-match', diff.length === 0);
        for (const d of diff) console.log(`  差异 ${d}`);
      }

      const wasOn = await inst.ensureRateLimitsOff();
      console.log(`INFO rate-limits-default ${wasOn ? 'on' : 'off'}`);
      const st = await inst.su('/api/settings');
      const stJson = st.status === 200 ? await st.json() : null;
      report('rate-limits-off', !!stJson && stJson.rateLimits && !stJson.rateLimits.enabled);

      const externals = [];
      for (const list of Object.values(os.networkInterfaces())) {
        for (const a of list || []) if (a.family === 'IPv4' && !a.internal) externals.push(a.address);
      }
      if (externals.length === 0) {
        report('loopback-only', true, '（本机没有非回环的 IPv4 接口，无可测）');
      } else {
        let allRefused = true;
        for (const addr of externals) if (!(await refuseToConnect(addr, inst.port))) allRefused = false;
        report('loopback-only', allRefused);
      }
    });
  } catch (e) {
    allOk = false;
    console.log(`FAIL instance ${e && e.code ? `[${e.code}]` : ''} ${e && e.message ? e.message : ''}`.trimEnd());
  }
  report('cleanup', dirSeen !== '' && !fs.existsSync(dirSeen));
  console.log(allOk ? 'INSTANCE SMOKE OK' : 'INSTANCE SMOKE FAIL');
  return allOk ? 0 : 1;
}

if (isEntry(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--self-test') {
    process.exit((await selfTestAsync()) ? 0 : 1);
  } else if (arg === '--smoke') {
    process.exit(await smoke());
  } else {
    console.error('用法：node tools/pb/lib/instance.mjs --self-test | --smoke');
    process.exit(2);
  }
}
