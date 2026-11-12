#!/usr/bin/env node
// deploy/server/ 的本机静态检查（Phase 13，13-06 起；OPS-02、OPS-03）。零依赖，只用 node: 内置模块。
//
// 用途：服务器上的脚本和 unit 经所有者批准后才会执行（13-10、13-11），在那之前先在本机核对它们彼此一致：
// 语法、安全写法、unit 与 pb-admin.sh 与 03/04 的路径和参数相同、Phase 6 遗留缺陷（WR-07、WR-08、IN-09、IN-11）的修法在位。
// 本脚本只读文件，不连接任何服务器、域名或外部主机，也不读 private/。
//
// 用法：
//   node deploy/server-check.mjs               检查 deploy/server/ 下的真实文件
//   node deploy/server-check.mjs --self-test   用合成的好坏片段测每一项检查（不读 deploy/server/）
//
// 输出：每项一行 `PASS <编号> <中文说明>` 或 `FAIL <编号> <中文说明>`（失败时缩进列出原因）；
// 最后一行 `SERVER-CHECK OK (N checks)` 或 `SERVER-CHECK FAIL (k of N)`；自检最后一行 `SELF-TEST OK (N cases)`。
//
// 退出码：0 通过；1 有检查失败；2 参数错误或找不到 bash。
//
// bash 的位置：Windows 上用 `git --exec-path` 推出 Git 自带的 bin/bash.exe（PATH 上的 bash 可能是 WSL 的启动器），
// 其他系统用 PATH 上的 bash。语法检查把脚本文本经标准输入交给 `bash -n`，不执行脚本。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const SERVER_DIR = path.join(HERE, 'server');

// 本脚本自身用低于正常的优先级运行（用户的电脑容易卡）
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {
  console.error('提示：无法降低脚本自身的优先级，继续以正常优先级运行。');
}

const ENV_PATH = '/etc/usj/pocketbase.env';

// ---------- 纯函数：找 bash 与语法检查 ----------

export function findBash() {
  const candidates = [];
  if (process.platform === 'win32') {
    const r = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
    if (r.status === 0) {
      const execPath = r.stdout.trim();
      // <Git>/mingw64/libexec/git-core -> <Git>
      const root = path.resolve(execPath, '..', '..', '..');
      candidates.push(path.join(root, 'bin', 'bash.exe'), path.join(root, 'usr', 'bin', 'bash.exe'));
    }
  } else {
    candidates.push('bash');
  }
  for (const c of candidates) {
    if (c !== 'bash' && !fs.existsSync(c)) continue;
    const probe = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim() === 'ok') return c;
  }
  return null;
}

export function bashSyntaxOk(bash, text) {
  const r = spawnSync(bash, ['-n'], { input: text, encoding: 'utf8' });
  return { ok: r.status === 0, message: (r.stderr || '').trim().split('\n')[0] || '' };
}

// ---------- 纯函数：文本辅助 ----------

// 非注释、非空行（保留行尾注释，只丢整行注释和空行）
export function codeLines(text) {
  return String(text)
    .split('\n')
    .filter((l) => l.trim() !== '' && !/^\s*#/.test(l));
}

// 文件头注释：第一行之后、第一个非注释行之前的全部注释行
export function headerText(text) {
  const lines = String(text).split('\n');
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    if (/^\s*#/.test(lines[i]) || lines[i].trim() === '') out.push(lines[i]);
    else break;
  }
  return out.join('\n');
}

// 有没有开启命令回显的 set 选项（-x、-v、-o xtrace、-o verbose），整行注释不算
export function hasTraceOption(text) {
  for (const line of codeLines(text)) {
    const t = line.trim().split(/\s+/);
    if (t[0] !== 'set') continue;
    for (let i = 1; i < t.length; i++) {
      if (/^[-+][A-Za-z]*[xv][A-Za-z]*$/.test(t[i])) return true;
      if ((t[i] === '-o' || t[i] === '+o') && /^(xtrace|verbose)$/.test(t[i + 1] || '')) return true;
    }
  }
  return false;
}

// 命令行里的参数记号（按空白切分，保留 --name=value 原样）
export function tokensOf(line) {
  return String(line).trim().split(/\s+/);
}

function scriptsReadingUploads(sh) {
  return Object.entries(sh).filter(([, text]) => /\$\{?UP\b|"\$UP"/.test(text));
}

// ---------- 检查函数：返回问题清单，空数组表示通过 ----------

// C-01 每个 deploy/server/*.sh 过 bash -n
export function c01(ctx) {
  const problems = [];
  for (const [name, text] of Object.entries(ctx.sh)) {
    const r = bashSyntaxOk(ctx.bash, text);
    if (!r.ok) problems.push(`${name} 没有通过 bash -n：${r.message}`);
  }
  if (Object.keys(ctx.sh).length === 0) problems.push('deploy/server/ 下没有 .sh 脚本');
  return problems;
}

// C-02 首行、set -euo pipefail、没有命令回显
export function c02(ctx) {
  const problems = [];
  for (const [name, text] of Object.entries(ctx.sh)) {
    if (text.split('\n')[0] !== '#!/usr/bin/env bash') problems.push(`${name} 首行不是 #!/usr/bin/env bash`);
    if (!/^set -euo pipefail$/m.test(text)) problems.push(`${name} 没有 set -euo pipefail`);
    if (hasTraceOption(text)) problems.push(`${name} 开启了命令回显（set -x 或 set -v）`);
  }
  return problems;
}

// C-03 头注释含“输出”和“回滚”
export function c03(ctx) {
  const problems = [];
  for (const [name, text] of Object.entries(ctx.sh)) {
    const h = headerText(text);
    if (!h.includes('输出')) problems.push(`${name} 的头注释没有“输出”一段`);
    if (!h.includes('回滚')) problems.push(`${name} 的头注释没有“回滚”一段`);
  }
  return problems;
}

// C-04 读上传文件的脚本：上传目录取自 $1、检查 usj-deploy. 目录格式、对 SHA256SUMS 跑 sha256sum -c；没有写死的 Phase 6 上传目录
export function c04(ctx) {
  const problems = [];
  const all = { ...ctx.sh };
  if (ctx.unit) all['pocketbase.service'] = ctx.unit;
  for (const [name, text] of Object.entries(all)) {
    if (text.includes('usj-probe-upload')) problems.push(`${name} 写死了 Phase 6 的上传目录`);
  }
  for (const [name, text] of scriptsReadingUploads(ctx.sh)) {
    const code = codeLines(text).join('\n');
    if (!/^UP="\$\{1:-\}"$/m.test(code)) problems.push(`${name} 的上传目录不是取自第一个参数`);
    if (!/usj-deploy\\\./.test(code)) problems.push(`${name} 没有检查 usj-deploy. 目录格式`);
    if (!/SHA256SUMS/.test(code)) problems.push(`${name} 没有用 SHA256SUMS`);
    if (!/sha256sum -c\b/.test(code)) problems.push(`${name} 没有对上传文件跑 sha256sum -c`);
  }
  return problems;
}

function flagValues(line) {
  const out = {};
  for (const t of tokensOf(line)) {
    const m = /^--([A-Za-z]+)=(.*)$/.exec(t);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

// C-05 unit 的 ExecStart 与 pb-admin.sh 的 exec 行的共同参数相同；环境文件路径一致
export function c05(ctx) {
  const problems = [];
  const unit = ctx.unit;
  const admin = ctx.sh['pb-admin.sh'];
  if (!unit) return ['缺少 pocketbase.service'];
  if (!admin) return ['缺少 pb-admin.sh'];
  const exec = unit.split('\n').filter((l) => /^ExecStart=/.test(l));
  if (exec.length !== 1) return [`unit 的 ExecStart 行数不是 1（是 ${exec.length}）`];
  const unitFlags = flagValues(exec[0].replace(/^ExecStart=/, ''));
  const adminLines = codeLines(admin).filter((l) => /^exec \/opt\/pocketbase\/pocketbase\s/.test(l));
  if (adminLines.length !== 1) return [`pb-admin.sh 的 exec 行数不是 1（是 ${adminLines.length}）`];
  const adminFlags = flagValues(adminLines[0]);
  for (const k of ['dir', 'migrationsDir', 'hooksDir', 'automigrate', 'encryptionEnv']) {
    if (unitFlags[k] === undefined) problems.push(`unit 没有 --${k}`);
    else if (adminFlags[k] !== unitFlags[k]) problems.push(`--${k} 在 unit 和 pb-admin.sh 里不一样`);
  }
  if (unitFlags.automigrate !== 'false') problems.push('unit 的 --automigrate 不是 false');
  if (unitFlags.encryptionEnv !== 'PB_ENCRYPTION_KEY') problems.push('--encryptionEnv 的值不是 PB_ENCRYPTION_KEY');
  if (unitFlags.http !== '127.0.0.1:8090') problems.push('unit 没有只绑 127.0.0.1:8090');
  if (unitFlags.origins !== '${USJ_ORIGIN}') problems.push('unit 的 --origins 不是 ${USJ_ORIGIN}');
  if (!unit.split('\n').includes(`EnvironmentFile=${ENV_PATH}`)) problems.push(`unit 没有 EnvironmentFile=${ENV_PATH}`);
  for (const name of ['03-configure-pocketbase.sh', '04-start-pocketbase.sh', 'pb-admin.sh']) {
    const text = ctx.sh[name];
    if (text === undefined) problems.push(`缺少 ${name}`);
    else if (!codeLines(text).some((l) => l.includes(ENV_PATH))) problems.push(`${name} 没有用 ${ENV_PATH}`);
  }
  return problems;
}

// C-06 unit：Restart=always、User=pocketbase、MemoryMax；除 GOMEMLIMIT 外没有别的 Environment= 行
export function c06(ctx) {
  const problems = [];
  const unit = ctx.unit;
  if (!unit) return ['缺少 pocketbase.service'];
  const lines = unit.split('\n');
  if (!lines.includes('Restart=always')) problems.push('unit 没有 Restart=always');
  if (!lines.includes('User=pocketbase')) problems.push('unit 没有 User=pocketbase');
  if (!lines.some((l) => /^MemoryMax=\S+/.test(l))) problems.push('unit 没有 MemoryMax=');
  const envLines = lines.filter((l) => /^Environment=/.test(l));
  if (!envLines.some((l) => /^Environment=GOMEMLIMIT=\S+$/.test(l))) problems.push('unit 没有 Environment=GOMEMLIMIT=');
  for (const l of envLines) {
    if (!/^Environment=GOMEMLIMIT=\S+$/.test(l)) problems.push('unit 里有 GOMEMLIMIT 以外的 Environment= 行');
  }
  return problems;
}

// C-07 04：restart；失败路径 disable --now；不用 enable --now
export function c07(ctx) {
  const text = ctx.sh['04-start-pocketbase.sh'];
  if (text === undefined) return ['缺少 04-start-pocketbase.sh'];
  const code = codeLines(text).join('\n');
  const problems = [];
  if (!/systemctl restart pocketbase/.test(code)) problems.push('04 没有 systemctl restart pocketbase');
  if (!/systemctl disable --now pocketbase/.test(code)) problems.push('04 的失败路径没有 systemctl disable --now pocketbase');
  if (/systemctl enable --now/.test(code)) problems.push('04 还在用 enable --now（已运行的服务不会重启）');
  return problems;
}

// C-08 03：openssl rand -hex 16、长度 32 的核对；钥匙变量只出现在赋值、长度检查、经管道交给 tee 的 printf 和 unset 里
export function c08(ctx) {
  const text = ctx.sh['03-configure-pocketbase.sh'];
  if (text === undefined) return ['缺少 03-configure-pocketbase.sh'];
  const problems = [];
  const lines = codeLines(text);
  const code = lines.join('\n');
  if (!/openssl rand -hex 16\b/.test(code)) return ['03 没有 openssl rand -hex 16'];
  const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)="?\$\(openssl rand -hex 16\b/m.exec(code);
  if (!m) return ['03 没有把 openssl rand -hex 16 的输出直接赋给一个变量'];
  const v = m[1];
  if (!new RegExp(`\\[\\s+"?\\$\\{#${v}\\}"?\\s+-ne\\s+32\\s+\\]`).test(code)) problems.push(`03 没有核对 ${v} 的长度是 32`);
  const use = new RegExp(`\\$\\{?#?${v}(?![A-Za-z0-9_])`);
  const lengthCheck = new RegExp(`^\\s*if\\s+\\[\\s+"?\\$\\{#${v}\\}"?\\s+-(ne|eq|lt|gt)\\s`);
  for (const line of lines) {
    if (!use.test(line)) continue;
    if (lengthCheck.test(line)) continue;
    if (/^\s*printf\s/.test(line) && /\|\s*sudo -n tee\b/.test(line)) continue;
    problems.push(`钥匙变量 ${v} 出现在不允许的位置：${line.trim().slice(0, 60)}`);
  }
  if (!new RegExp(`^\\s*unset\\s+.*\\b${v}\\b`, 'm').test(code)) problems.push(`03 没有 unset ${v}`);
  return problems;
}

function lineIndex(lines, re) {
  return lines.findIndex((l) => re.test(l));
}

// C-09 01：补写 fstab 的位置在 SWAP=already 的输出之前（WR-07）
export function c09(ctx) {
  const text = ctx.sh['01-swap.sh'];
  if (text === undefined) return ['缺少 01-swap.sh'];
  const lines = codeLines(text);
  const iCheck = lineIndex(lines, /grep\b.*\/swapfile.*\/etc\/fstab/);
  const iAppend = lineIndex(lines, /tee -a \/etc\/fstab/);
  const iAlready = lineIndex(lines, /echo "SWAP=already"/);
  const problems = [];
  if (iAlready < 0) problems.push('01 没有输出 SWAP=already');
  if (iCheck < 0) problems.push('01 没有检查 fstab 里有没有 swap 那一行');
  if (iAppend < 0) problems.push('01 没有往 fstab 追加 swap 那一行');
  if (problems.length > 0) return problems;
  if (iCheck > iAlready) problems.push('01 检查 fstab 的位置在 SWAP=already 之后（WR-07）');
  if (iAppend > iAlready) problems.push('01 追加 fstab 的位置在 SWAP=already 之后（WR-07）');
  return problems;
}

// C-10 02：对解压出的程序跑 --version 在 install 到 /opt/pocketbase/pocketbase 之前（IN-11）；两个钉死的 sha256 与 Phase 6 的相同
export function c10(ctx) {
  const text = ctx.sh['02-install-pocketbase.sh'];
  if (text === undefined) return ['缺少 02-install-pocketbase.sh'];
  const problems = [];
  const lines = codeLines(text);
  const iVersion = lineIndex(lines, /"\$T\/x\/pocketbase".*--version/);
  const iInstall = lineIndex(lines, /\binstall\b.*"\$T\/x\/pocketbase"\s+\/opt\/pocketbase\/pocketbase/);
  if (iVersion < 0) problems.push('02 没有对解压出的程序跑 --version');
  if (iInstall < 0) problems.push('02 没有 install 到 /opt/pocketbase/pocketbase');
  if (iVersion >= 0 && iInstall >= 0 && iVersion > iInstall) problems.push('02 对解压出的程序跑 --version 的位置在 install 之后（IN-11）');
  const pins = (t) => [...String(t).matchAll(/PINNED_SHA256='([0-9a-f]{64})'/g)].map((m) => m[1]).sort();
  if (ctx.probe02 === undefined || ctx.probe02 === null) {
    problems.push('找不到 Phase 6 的 tools/probe/server/02-install-pocketbase.sh，无法比对钉死的 sha256');
  } else {
    const mine = pins(text);
    const theirs = pins(ctx.probe02);
    if (mine.length !== 2) problems.push(`02 里钉死的 sha256 不是两个（是 ${mine.length}）`);
    if (theirs.length === 0 || mine.join() !== theirs.join()) problems.push('02 里钉死的 sha256 与 Phase 6 的不相同');
  }
  return problems;
}

// C-11 07：--wipe 分支在 rm -rf 之前有非探针数据守卫，邮箱正则与清理迁移里的相同
export function c11(ctx) {
  const text = ctx.sh['07-retire-probe.sh'];
  if (text === undefined) return ['缺少 07-retire-probe.sh'];
  const problems = [];
  const code = codeLines(text).join('\n');
  const lines = codeLines(text);
  if (!/--wipe\|--keep/.test(code)) problems.push('07 没有 --wipe 和 --keep 两个参数的判断');
  const iRm = lineIndex(lines, /rm -rf .*DATA_DIR|rm -rf .*pb_data/);
  const iGuardCall = lineIndex(lines, /^\s*guard_non_probe_data\s*$/);
  if (iRm < 0) problems.push('07 的 --wipe 分支没有 rm -rf 数据目录');
  if (iGuardCall < 0) problems.push('07 没有调用非探针数据守卫');
  if (iRm >= 0 && iGuardCall >= 0 && iGuardCall > iRm) problems.push('07 的守卫在 rm -rf 之后');
  if (!/journey_docs/.test(code)) problems.push('07 的守卫没有数 journey_docs');
  if (!/^\s*exit 1$/m.test(code)) problems.push('07 的守卫没有 exit 1');
  const re = '^probe-[0-9a-f]{8}@example\\.com$';
  if (!text.includes(re)) problems.push('07 里没有探针邮箱的严格正则');
  if (ctx.retire === undefined || ctx.retire === null) problems.push('找不到 deploy/pb_migrations/1794096150_retire_probe.js，无法比对邮箱正则');
  else if (!ctx.retire.includes(re)) problems.push('清理迁移里的探针邮箱正则与 07 的不相同');
  return problems;
}

// C-12 00-status：只读（没有改动命令、没有写文件的重定向、sqlite 只用 mode=ro），最后一个 kv 是 STATUS_DONE
export function c12(ctx) {
  const text = ctx.sh['00-status.sh'];
  if (text === undefined) return ['缺少 00-status.sh'];
  const problems = [];
  const lines = codeLines(text);
  const mutating = /(?:^|[\s;&|(`$])(?:install|rm|mv|cp|tee|mkdir|chmod|chown|useradd|touch)\s/;
  const service = /systemctl\s+(?:start|stop|restart|enable|disable|reload|daemon-reload|kill|mask)\b/;
  const sql = /\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE|VACUUM)\b/;
  const redirect = /(?<![0-9<])>>?\s*(?!\/dev\/null|&)\S/;
  for (const l of lines) {
    if (mutating.test(l)) problems.push(`00-status 里有改动命令：${l.trim().slice(0, 50)}`);
    else if (service.test(l)) problems.push(`00-status 里有改动服务的命令：${l.trim().slice(0, 50)}`);
    else if (sql.test(l)) problems.push(`00-status 里有写库的 SQL：${l.trim().slice(0, 50)}`);
    else if (redirect.test(l)) problems.push(`00-status 里有写文件的重定向：${l.trim().slice(0, 50)}`);
    if (/sqlite3\.connect\(/.test(l) && !/mode=ro/.test(l)) problems.push('00-status 里有不是 mode=ro 的 sqlite 连接');
  }
  const kvLines = lines.filter((l) => /^\s*kv\s+\S+/.test(l));
  if (kvLines.length === 0 || !/^\s*kv STATUS_DONE 1\s*$/.test(kvLines[kvLines.length - 1])) problems.push('00-status 的最后一个 kv 不是 STATUS_DONE');
  return problems;
}

// ---------- nginx 文件的解析辅助（13-07） ----------

// 把 nginx 配置拆成 server 层的代码行和 location 块（整行注释已丢掉）。只处理本项目写法：location 头和 `{` 在同一行。
export function parseConf(text) {
  const locations = [];
  const serverLines = [];
  let depth = 0;
  let cur = null;
  for (const raw of String(text).split('\n')) {
    const line = raw.replace(/^\s*#.*$/, '');
    if (cur === null) {
      const m = /^\s*location\s+(.+?)\s*\{\s*$/.exec(line);
      if (m) {
        cur = { spec: m[1].replace(/\s+/g, ' '), body: [] };
        depth = 1;
        continue;
      }
      if (line.trim() !== '') serverLines.push(line);
      continue;
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (depth <= 0) {
      locations.push(cur);
      cur = null;
      depth = 0;
      continue;
    }
    if (line.trim() !== '') cur.body.push(line);
  }
  return { locations, serverLines };
}

function addHeaderNames(lines) {
  const names = [];
  for (const l of lines) {
    const m = /^\s*add_header\s+(\S+)\s/.exec(l);
    if (m) names.push(m[1]);
  }
  return names;
}

function includesIn(lines) {
  const out = [];
  for (const l of lines) {
    const m = /^\s*include\s+(\S+?);/.exec(l);
    if (m) out.push(m[1]);
  }
  return out;
}

const NGINX_NAMES = ['usj-app.conf', 'usj-headers-common.conf', 'usj-headers-proxy.conf', 'usj-log-format.conf'];
const LOC_SPECS = ['= /', '= /sw.js', '= /manifest.webmanifest', '^~ /vendor/', '^~ /icons/', '= /api/realtime', '^~ /api/', '^~ /_/', '~ ^/'];
const PROXY_SPECS = ['= /api/realtime', '^~ /api/', '^~ /_/'];
const COMMON_HEADERS = ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Robots-Tag', 'Strict-Transport-Security', 'Cross-Origin-Opener-Policy', 'X-Frame-Options'];
const PROXY_HEADERS = ['X-Robots-Tag', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security'];
const PERMISSIONS = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

function nginxCodeLines(ctx, name) {
  const t = ctx.nginx ? ctx.nginx[name] : undefined;
  return t === undefined || t === null ? null : codeLines(t);
}

// C-13 每个 location 恰好 include 两个头文件之一；两个头文件各自的 add_header 集合；反代位置不重复也不覆盖 PocketBase 的头
export function c13(ctx) {
  const app = ctx.nginx && ctx.nginx['usj-app.conf'];
  const common = nginxCodeLines(ctx, 'usj-headers-common.conf');
  const proxy = nginxCodeLines(ctx, 'usj-headers-proxy.conf');
  if (app === undefined || app === null) return ['缺少 usj-app.conf'];
  if (!common) return ['缺少 usj-headers-common.conf'];
  if (!proxy) return ['缺少 usj-headers-proxy.conf'];
  const problems = [];
  const cn = addHeaderNames(common);
  const pn = addHeaderNames(proxy);
  if (cn.slice().sort().join() !== COMMON_HEADERS.slice().sort().join()) problems.push(`usj-headers-common.conf 的 add_header 不是预期的 7 条（是 ${cn.join('、') || '无'}）`);
  if (pn.slice().sort().join() !== PROXY_HEADERS.slice().sort().join()) problems.push(`usj-headers-proxy.conf 的 add_header 不是预期的 4 条（是 ${pn.join('、') || '无'}）`);
  for (const [n, lines] of [['usj-headers-common.conf', common], ['usj-headers-proxy.conf', proxy]]) {
    const pp = lines.filter((l) => /^\s*add_header\s+Permissions-Policy\s/.test(l));
    if (pp.length === 1 && !pp[0].includes(`"${PERMISSIONS}"`)) problems.push(`${n} 的 Permissions-Policy 不是预期的值`);
  }
  const { locations } = parseConf(app);
  const specs = locations.map((l) => l.spec);
  for (const s of LOC_SPECS) {
    const k = specs.filter((x) => x === s).length;
    if (k !== 1) problems.push(`位置 ${s} 出现 ${k} 次（应为 1）`);
  }
  if (specs.length !== LOC_SPECS.length) problems.push(`位置块一共 ${specs.length} 个（应为 ${LOC_SPECS.length}）`);
  for (const loc of locations) {
    const inc = includesIn(loc.body);
    const nCommon = inc.filter((i) => i === 'snippets/usj-headers-common.conf').length;
    const nProxy = inc.filter((i) => i === 'snippets/usj-headers-proxy.conf').length;
    const nCsp = inc.filter((i) => i === 'snippets/usj-csp.conf').length;
    const isProxy = PROXY_SPECS.includes(loc.spec);
    if (nCommon + nProxy !== 1) problems.push(`位置 ${loc.spec} 没有恰好 include 一个头文件`);
    else if (isProxy && nProxy !== 1) problems.push(`反代位置 ${loc.spec} 没有 include usj-headers-proxy.conf`);
    else if (!isProxy && nCommon !== 1) problems.push(`位置 ${loc.spec} 没有 include usj-headers-common.conf`);
    if (loc.spec === '= /') {
      if (nCsp !== 1) problems.push('位置 = / 没有恰好 include 一次 usj-csp.conf');
    } else if (nCsp !== 0) {
      problems.push(`位置 ${loc.spec} 不该 include usj-csp.conf`);
    }
    if (isProxy && loc.body.some((l) => /Content-Security-Policy/i.test(l))) problems.push(`反代位置 ${loc.spec} 里有 CSP（会盖掉 PocketBase 自己的）`);
    // 本位置自己的 add_header 与头文件里的不能重名（重名会让响应里出现重复的头）
    const own = addHeaderNames(loc.body);
    const fromFile = nCommon === 1 ? cn : nProxy === 1 ? pn : [];
    for (const h of own) if (fromFile.includes(h)) problems.push(`位置 ${loc.spec} 的 add_header ${h} 与头文件里的重复`);
    if (isProxy && own.some((h) => ['X-Content-Type-Options', 'X-Frame-Options'].includes(h))) problems.push(`反代位置 ${loc.spec} 覆盖了 PocketBase 自己发的头`);
  }
  return problems;
}

// C-14 三个反代位置的 IP 头、HTTP/1.1；实时位置的缓冲、超时、请求体；/api/ 的请求体 5m
export function c14(ctx) {
  const app = ctx.nginx && ctx.nginx['usj-app.conf'];
  if (app === undefined || app === null) return ['缺少 usj-app.conf'];
  const problems = [];
  const { locations } = parseConf(app);
  const get = (s) => locations.find((l) => l.spec === s);
  const has = (loc, re) => loc.body.some((l) => re.test(l));
  for (const s of PROXY_SPECS) {
    const loc = get(s);
    if (!loc) {
      problems.push(`缺少位置 ${s}`);
      continue;
    }
    if (!has(loc, /^\s*proxy_set_header X-Real-IP \$remote_addr;\s*$/)) problems.push(`${s} 没有 proxy_set_header X-Real-IP $remote_addr`);
    if (loc.body.filter((l) => /proxy_set_header\s+X-Real-IP\b/.test(l)).length !== 1) problems.push(`${s} 的 X-Real-IP 头不是恰好一条`);
    if (!has(loc, /^\s*proxy_pass http:\/\/127\.0\.0\.1:8090;\s*$/)) problems.push(`${s} 没有 proxy_pass http://127.0.0.1:8090`);
    if (!has(loc, /^\s*proxy_http_version 1\.1;\s*$/)) problems.push(`${s} 没有 proxy_http_version 1.1`);
  }
  const rt = get('= /api/realtime');
  if (rt) {
    if (!has(rt, /^\s*proxy_buffering off;\s*$/)) problems.push('= /api/realtime 没有 proxy_buffering off');
    if (!has(rt, /^\s*proxy_read_timeout 3600s;\s*$/)) problems.push('= /api/realtime 没有 proxy_read_timeout 3600s');
    if (!has(rt, /^\s*client_max_body_size 1m;\s*$/)) problems.push('= /api/realtime 没有 client_max_body_size 1m');
    if (!has(rt, /^\s*gzip off;\s*$/)) problems.push('= /api/realtime 没有 gzip off');
    if (!has(rt, /^\s*proxy_set_header Connection "";\s*$/)) problems.push('= /api/realtime 没有把 Connection 头置空');
  }
  const api = get('^~ /api/');
  if (api && !has(api, /^\s*client_max_body_size 5m;\s*$/)) problems.push('^~ /api/ 没有 client_max_body_size 5m');
  return problems;
}

// C-15 日志格式用 $uri，不含查询串；应用片段有 server 层的 access_log，没有任何位置关闭访问日志
export function c15(ctx) {
  const fmt = nginxCodeLines(ctx, 'usj-log-format.conf');
  const app = ctx.nginx && ctx.nginx['usj-app.conf'];
  if (!fmt) return ['缺少 usj-log-format.conf'];
  if (app === undefined || app === null) return ['缺少 usj-app.conf'];
  const problems = [];
  const f = fmt.join('\n');
  if (!/^\s*log_format usj '/m.test(f)) problems.push('日志格式没有命名为 usj');
  if (!f.includes('$uri')) problems.push('日志格式没有用 $uri');
  if (/\$request(?![A-Za-z0-9_])/.test(f)) problems.push('日志格式里有 $request（含查询串）');
  if (/\$request_uri\b|\$args\b|\$query_string\b|\$is_args\b/.test(f)) problems.push('日志格式里有查询串变量');
  const { locations, serverLines } = parseConf(app);
  if (serverLines.filter((l) => l.trim() === 'access_log /var/log/usj/access.log usj;').length !== 1) problems.push('应用片段的 server 层没有恰好一行 access_log /var/log/usj/access.log usj;');
  for (const l of serverLines) if (/^\s*access_log\s+off\b/.test(l)) problems.push('server 层关闭了访问日志');
  for (const loc of locations) if (loc.body.some((l) => /^\s*access_log\b/.test(l))) problems.push(`位置 ${loc.spec} 里有 access_log（不能关闭或改去向）`);
  if (serverLines.some((l) => /^\s*log_format\b/.test(l))) problems.push('应用片段里不能写 log_format（它只能在 http 层）');
  return problems;
}

// C-16 三个 nginx 文件里每条 add_header 都以 always; 结尾
export function c16(ctx) {
  const problems = [];
  for (const name of ['usj-app.conf', 'usj-headers-common.conf', 'usj-headers-proxy.conf']) {
    const lines = nginxCodeLines(ctx, name);
    if (!lines) {
      problems.push(`缺少 ${name}`);
      continue;
    }
    for (const l of lines) {
      if (/^\s*add_header\s/.test(l) && !/\balways;\s*$/.test(l)) problems.push(`${name} 里有没带 always 的 add_header：${l.trim().slice(0, 50)}`);
    }
  }
  return problems;
}

// C-17 HSTS 是 max-age=86400，没有 includeSubDomains、preload
export function c17(ctx) {
  const problems = [];
  for (const name of ['usj-headers-common.conf', 'usj-headers-proxy.conf']) {
    const lines = nginxCodeLines(ctx, name);
    if (!lines) {
      problems.push(`缺少 ${name}`);
      continue;
    }
    const hsts = lines.filter((l) => /Strict-Transport-Security/i.test(l));
    if (hsts.length !== 1) problems.push(`${name} 的 HSTS 不是恰好一条（是 ${hsts.length}）`);
    for (const l of hsts) if (l.trim() !== 'add_header Strict-Transport-Security "max-age=86400" always;') problems.push(`${name} 的 HSTS 不是 max-age=86400`);
  }
  for (const name of NGINX_NAMES) {
    const lines = nginxCodeLines(ctx, name);
    if (!lines) continue;
    for (const l of lines) if (/includeSubDomains|preload/i.test(l)) problems.push(`${name} 里有 includeSubDomains 或 preload`);
  }
  const app = nginxCodeLines(ctx, 'usj-app.conf');
  if (app && app.some((l) => /Strict-Transport-Security/i.test(l))) problems.push('usj-app.conf 里直接写了 HSTS（应只经头文件）');
  return problems;
}

// C-18 anchor-block.awk 与 Phase 6 的逐字节相同，并用 bash 里的 awk 判定合成的 443 ssl 块和 80 块
const AWK_CFG_443 = 'server {\n    listen 443 ssl; # managed by Certbot\n    server_name a.example.com www.a.example.com; # managed by Certbot\n}\nserver {\n    listen 80;\n    server_name a.example.com;\n}\n';
const AWK_CFG_80 = 'server {\n    listen 80;\n    server_name a.example.com; # managed by Certbot\n}\n';

export function runAnchorAwk(bash, awkText, cfgText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-awk-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.awk'), awkText);
    fs.writeFileSync(path.join(dir, 'cfg'), cfgText);
    const r = spawnSync(bash, ['-c', 'awk -f a.awk cfg'], { cwd: dir, encoding: 'utf8' });
    return { status: r.status, out: (r.stdout || '').trim() };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function c18(ctx) {
  const problems = [];
  if (ctx.awk === undefined || ctx.awk === null) return ['缺少 deploy/server/nginx/anchor-block.awk'];
  if (ctx.awk6 === undefined || ctx.awk6 === null) return ['找不到 Phase 6 的 tools/probe/server/nginx/anchor-block.awk，无法比对'];
  if (ctx.awk !== ctx.awk6) problems.push('anchor-block.awk 与 Phase 6 的不是逐字节相同');
  const a = runAnchorAwk(ctx.bash, ctx.awk, AWK_CFG_443);
  if (a.out !== 'ANCHOR_BLOCK=443ssl') problems.push(`合成的 443 ssl 块没有输出 ANCHOR_BLOCK=443ssl（输出 ${a.out || '空'}）`);
  const b = runAnchorAwk(ctx.bash, ctx.awk, AWK_CFG_80);
  if (b.out === 'ANCHOR_BLOCK=443ssl') problems.push('合成的 80 块被误判成 443 ssl');
  return problems;
}

// 取 shell 函数体（`name() {` 之后到单独一行 `}` 之前）
function funcBody(text, name) {
  const lines = String(text).split('\n');
  const start = lines.findIndex((l) => new RegExp(`^${name}\\(\\) \\{`).test(l));
  if (start < 0) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i] === '}') return out.join('\n');
    out.push(lines[i]);
  }
  return null;
}

// C-19 05 的回滚、临时文件、顺序和 www 跳转的判断
export function c19(ctx) {
  const text = ctx.sh['05-nginx-app.sh'];
  if (text === undefined) return ['缺少 05-nginx-app.sh'];
  const problems = [];
  const lines = codeLines(text);
  const idx = (re) => lines.findIndex((l) => re.test(l));
  const iTrapErr = idx(/^\s*trap rollback ERR\s*$/);
  const iTrapClear = idx(/^trap - ERR\s*$/); // 顶层（不缩进）的那一行；rollback 函数里缩进的那一行不算
  const iExit = idx(/^\s*trap \w+ EXIT\s*$/);
  const iMktemp = idx(/mktemp\s+"\$SITE_DIR\/\S+"/);
  const iMv = idx(/\bmv -T "\$TMP_SITE" "\$SITE"/);
  const iNginxT = idx(/\bnginx -t\b/);
  const iCertbot = idx(/\bcertbot renew --dry-run\b/);
  const iLogrotate = idx(/\blogrotate -d\b/);
  const iProbeRm = idx(/\brm -f "\$PROBE_SNIP"(\s|$)/);
  const iBackup = idx(/\bcp -p "\$p" "\$BK\//);
  const iFirstInstall = idx(/\binstall -d -o root -g adm -m 0750 \/var\/log\/usj\b/);
  if (iTrapErr < 0) problems.push('05 没有 trap rollback ERR');
  if (iTrapClear < 0) problems.push('05 成功路径没有 trap - ERR');
  if (iExit < 0) problems.push('05 没有 EXIT trap');
  else {
    const cl = funcBody(text, 'cleanup');
    if (cl === null || !/rm -f "\$TMP_SITE"/.test(cl)) problems.push('05 的 EXIT trap 没有清理站点临时文件');
  }
  if (iMktemp < 0) problems.push('05 的临时文件不在站点文件所在目录');
  if (iMv < 0) problems.push('05 没有用 mv -T 把同目录的临时文件换成站点文件');
  if (iNginxT < 0) problems.push('05 没有 nginx -t');
  if (iCertbot < 0) problems.push('05 没有 certbot renew --dry-run');
  if (iLogrotate < 0) problems.push('05 没有 logrotate -d');
  if (iProbeRm < 0) problems.push('05 没有删探针片段的那一行（rm -f "$PROBE_SNIP"）');
  if (iBackup < 0) problems.push('05 没有备份文件的 cp -p');
  if (iFirstInstall < 0) problems.push('05 没有建 /var/log/usj（root:adm 0750）');
  const rb = funcBody(text, 'rollback');
  if (rb === null) problems.push('05 没有 rollback 函数');
  else {
    const t = rb.indexOf('nginx -t');
    const r = rb.indexOf('systemctl reload nginx');
    if (t < 0 || r < 0 || t > r) problems.push('05 的 rollback 没有先 nginx -t 再 reload');
    if (!/trap - ERR/.test(rb)) problems.push('05 的 rollback 没有先解除 ERR trap');
  }
  if (iTrapErr >= 0 && iBackup >= 0 && iBackup > iTrapErr) problems.push('05 的备份在挂 ERR trap 之后');
  if (iTrapErr >= 0 && iFirstInstall >= 0 && iFirstInstall < iTrapErr) problems.push('05 在挂 ERR trap 之前就开始改动');
  if (iTrapClear >= 0 && iCertbot >= 0 && iTrapClear < iCertbot) problems.push('05 在 certbot 干跑之前就解除了回滚');
  if (iTrapClear >= 0 && iLogrotate >= 0 && iTrapClear < iLogrotate) problems.push('05 在 logrotate 干跑之前就解除了回滚');
  if (iProbeRm >= 0) {
    if (iCertbot >= 0 && iProbeRm < iCertbot) problems.push('05 删探针片段的位置在 certbot 干跑之前');
    if (iLogrotate >= 0 && iProbeRm < iLogrotate) problems.push('05 删探针片段的位置在 logrotate 干跑之前');
    if (iTrapClear >= 0 && iProbeRm < iTrapClear) problems.push('05 删探针片段的位置在解除回滚之前');
  }
  // www 跳转：两项只读判断在生成跳转片段之前；跳转只在 05 里生成，不写在 usj-app.conf 里
  const iSn = idx(/\bwww\.\*\)/);
  const iGetent = idx(/\bgetent ahosts\b/);
  const iIf = idx(/if \(\$host/);
  if (iSn < 0) problems.push('05 没有判断 server_name 里有没有 www.<裸域名>');
  if (iGetent < 0) problems.push('05 没有 getent ahosts 判断 www 能不能解析');
  if (iIf < 0) problems.push('05 没有生成 www 跳转的那一行');
  if (iIf >= 0 && ((iSn >= 0 && iSn > iIf) || (iGetent >= 0 && iGetent > iIf))) problems.push('05 的两项只读判断没有排在生成跳转之前');
  if (lines.filter((l) => /if \(\$host/.test(l)).length > 1) problems.push('05 里 www 跳转的那一行不止一处');
  if (!lines.some((l) => /WWW_REDIRECT=/.test(l))) problems.push('05 没有输出 WWW_REDIRECT=');
  const app = ctx.nginx && ctx.nginx['usj-app.conf'];
  if (app && /if \(\$host/.test(app)) problems.push('usj-app.conf 里写了 if ($host（www 跳转只能由 05 生成）');
  return problems;
}

// ---------- 检查清单 ----------

export const CHECKS = [
  { id: 'C-01', title: '每个 deploy/server/*.sh 都通过 bash -n', run: c01 },
  { id: 'C-02', title: '首行 #!/usr/bin/env bash、有 set -euo pipefail、没有开启命令回显', run: c02 },
  { id: 'C-03', title: '头注释都有“输出”和“回滚”', run: c03 },
  { id: 'C-04', title: '读上传文件的脚本从 $1 取 usj-deploy. 目录并对 SHA256SUMS 跑 sha256sum -c，没有写死的 Phase 6 上传目录', run: c04 },
  { id: 'C-05', title: 'unit 与 pb-admin.sh 的 --dir、--migrationsDir、--hooksDir、--automigrate=false、--encryptionEnv 逐项相同，环境文件路径一致', run: c05 },
  { id: 'C-06', title: 'unit 有 Restart=always、User=pocketbase、MemoryMax=，除 GOMEMLIMIT 外没有别的 Environment= 行', run: c06 },
  { id: 'C-07', title: '04 有 systemctl restart，失败路径有 disable --now', run: c07 },
  { id: 'C-08', title: '03 用 openssl rand -hex 16 生成钥匙、核对长度 32，钥匙不进 echo 和别的命令参数', run: c08 },
  { id: 'C-09', title: '01 补写 fstab 的位置在 SWAP=already 之前（WR-07）', run: c09 },
  { id: 'C-10', title: '02 在 install 之前对解压出的程序跑 --version（IN-11），两个钉死的 sha256 与 Phase 6 的相同', run: c10 },
  { id: 'C-11', title: '07 的 --wipe 在 rm -rf 之前有非探针数据守卫，邮箱正则与清理迁移里的相同', run: c11 },
  { id: 'C-12', title: '00-status 只读（没有改动命令），最后一个 kv 是 STATUS_DONE', run: c12 },
  { id: 'C-13', title: '每个 location 恰好 include 两个头文件之一（静态位置 common、反代位置 proxy），= / 另 include usj-csp.conf，反代位置不重复也不覆盖 PocketBase 的头', run: c13 },
  { id: 'C-14', title: '三个反代位置都有 X-Real-IP $remote_addr 和 HTTP/1.1；实时位置有关缓冲、3600s、1m；/api/ 是 5m', run: c14 },
  { id: 'C-15', title: '日志格式用 $uri、不含查询串；server 层有 access_log，没有位置关闭访问日志', run: c15 },
  { id: 'C-16', title: 'nginx 文件里每条 add_header 都以 always; 结尾', run: c16 },
  { id: 'C-17', title: 'HSTS 是 max-age=86400，没有 includeSubDomains、preload', run: c17 },
  { id: 'C-18', title: 'anchor-block.awk 与 Phase 6 的逐字节相同，合成的 443 ssl 块输出 ANCHOR_BLOCK=443ssl、80 块不输出', run: c18 },
  { id: 'C-19', title: '05 有 ERR 回滚、EXIT 清理、同目录临时文件加 mv -T、nginx -t、certbot 干跑、logrotate -d，删探针片段在干跑之后，www 跳转有两项只读判断', run: c19 },
];

// ---------- 读取真实文件 ----------

export function loadContext(bash) {
  const sh = {};
  for (const name of fs.readdirSync(SERVER_DIR).filter((n) => n.endsWith('.sh')).sort()) {
    sh[name] = fs.readFileSync(path.join(SERVER_DIR, name), 'utf8');
  }
  const unitPath = path.join(SERVER_DIR, 'pocketbase.service');
  const unit = fs.existsSync(unitPath) ? fs.readFileSync(unitPath, 'utf8') : null;
  const readOpt = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  const probe02 = readOpt(path.join(REPO, 'tools', 'probe', 'server', '02-install-pocketbase.sh'));
  const retire = readOpt(path.join(HERE, 'pb_migrations', '1794096150_retire_probe.js'));
  const nginx = {};
  const nginxDir = path.join(SERVER_DIR, 'nginx');
  if (fs.existsSync(nginxDir)) {
    for (const n of fs.readdirSync(nginxDir).filter((x) => x.endsWith('.conf')).sort()) nginx[n] = fs.readFileSync(path.join(nginxDir, n), 'utf8');
  }
  const awk = readOpt(path.join(nginxDir, 'anchor-block.awk'));
  const awk6 = readOpt(path.join(REPO, 'tools', 'probe', 'server', 'nginx', 'anchor-block.awk'));
  return { bash, sh, unit, probe02, retire, nginx, awk, awk6 };
}

export function runChecks(ctx) {
  let failed = 0;
  for (const c of CHECKS) {
    const problems = c.run(ctx);
    if (problems.length === 0) {
      console.log(`PASS ${c.id} ${c.title}`);
    } else {
      failed += 1;
      console.log(`FAIL ${c.id} ${c.title}`);
      for (const p of problems) console.log(`  - ${p}`);
    }
  }
  return failed;
}

// ---------- 自检：合成的好坏片段 ----------

const GOOD_HEADER = '#!/usr/bin/env bash\n# x.sh —— 合成\n# 输出：KEY=VALUE。\n# 回滚：无。\n\nset -euo pipefail\n';

const GOOD_UPLOAD = [
  'UP="${1:-}"',
  'if ! [[ "$UP" =~ ^/tmp/usj-deploy\\.[A-Za-z0-9]+$ ]]; then exit 2; fi',
  'printf \'%s\\n\' "$lines" | (cd "$UP" && sha256sum -c --strict --status)',
  'grep -c . "$UP/SHA256SUMS"',
  '',
].join('\n');

const GOOD_03 =
  GOOD_HEADER +
  GOOD_UPLOAD +
  [
    'ENV_FILE=/etc/usj/pocketbase.env',
    'KEY="$(openssl rand -hex 16 </dev/null)"',
    'if [ "${#KEY}" -ne 32 ]; then',
    '  exit 1',
    'fi',
    'printf \'A=%s\\n\' "$KEY" | sudo -n tee "$ENV_FILE.new" >/dev/null',
    'unset KEY',
    '',
  ].join('\n');

const GOOD_04 =
  GOOD_HEADER +
  GOOD_UPLOAD +
  [
    'ENV_FILE=/etc/usj/pocketbase.env',
    'fail_and_disable() { sudo -n systemctl disable --now pocketbase </dev/null || true; exit 1; }',
    'sudo -n systemctl restart pocketbase </dev/null',
    '',
  ].join('\n');

const GOOD_ADMIN =
  GOOD_HEADER +
  [
    'ENV_FILE=/etc/usj/pocketbase.env',
    'exec /opt/pocketbase/pocketbase --dir=/var/lib/pocketbase/pb_data --migrationsDir=/var/lib/pocketbase/pb_migrations --hooksDir=/var/lib/pocketbase/pb_hooks --automigrate=false --encryptionEnv=PB_ENCRYPTION_KEY "$@"',
    '',
  ].join('\n');

const GOOD_UNIT = [
  '# 注释',
  '[Service]',
  'User=pocketbase',
  'EnvironmentFile=/etc/usj/pocketbase.env',
  'Environment=GOMEMLIMIT=256MiB',
  'ExecStart=/opt/pocketbase/pocketbase serve --http=127.0.0.1:8090 --dir=/var/lib/pocketbase/pb_data --migrationsDir=/var/lib/pocketbase/pb_migrations --hooksDir=/var/lib/pocketbase/pb_hooks --automigrate=false --encryptionEnv=PB_ENCRYPTION_KEY --origins=${USJ_ORIGIN}',
  'Restart=always',
  'MemoryMax=400M',
  '',
].join('\n');

const PIN_A = 'a'.repeat(64);
const PIN_B = 'b'.repeat(64);

const GOOD_01 =
  GOOD_HEADER +
  [
    "sudo -n grep -qE '^[[:space:]]*/swapfile[[:space:]]' /etc/fstab </dev/null",
    "printf '/swapfile none swap sw 0 0\\n' | sudo -n tee -a /etc/fstab >/dev/null",
    'echo "SWAP=already"',
    '',
  ].join('\n');

const GOOD_02 =
  GOOD_HEADER +
  [
    `PINNED_SHA256='${PIN_A}'`,
    `PINNED_SHA256='${PIN_B}'`,
    '"$T/x/pocketbase" --dir="$T/data" --version </dev/null',
    'sudo -n install -o root -g root -m 0755 "$T/x/pocketbase" /opt/pocketbase/pocketbase </dev/null',
    '',
  ].join('\n');

const GOOD_PROBE02 = [`PINNED_SHA256='${PIN_A}'`, `PINNED_SHA256='${PIN_B}'`, ''].join('\n');

const PROBE_RE = '^probe-[0-9a-f]{8}@example\\.com$';

const GOOD_07 =
  GOOD_HEADER +
  [
    'case "$1" in --wipe|--keep) ;; esac',
    'guard_non_probe_data() {',
    "  sudo -n python3 -I - <<'PY'",
    `PROBE = re.compile(r"${PROBE_RE}")`,
    'docs = con.execute("SELECT COUNT(*) FROM journey_docs").fetchone()[0]',
    'PY',
    '  exit 1',
    '}',
    'guard_non_probe_data',
    'sudo -n rm -rf "$DATA_DIR"',
    '',
  ].join('\n');

const GOOD_RETIRE = `const PROBE = /${PROBE_RE}/\n`;

const GOOD_00 =
  GOOD_HEADER +
  [
    'kv A 1',
    'sudo -n find /var/lib/pocketbase -type f </dev/null 2>/dev/null',
    "sudo -n python3 -I - <<'PY' 2>/dev/null || kv DB unreadable",
    'con = sqlite3.connect("file:x?mode=ro", uri=True)',
    'PY',
    'kv STATUS_DONE 1',
    '',
  ].join('\n');

// ---------- 13-07 的合成好文件：nginx 和 05 ----------

const GOOD_COMMON = [
  'add_header X-Content-Type-Options "nosniff" always;',
  'add_header Referrer-Policy "no-referrer" always;',
  `add_header Permissions-Policy "${PERMISSIONS}" always;`,
  'add_header X-Robots-Tag "noindex, nofollow" always;',
  'add_header Strict-Transport-Security "max-age=86400" always;',
  'add_header Cross-Origin-Opener-Policy "same-origin" always;',
  'add_header X-Frame-Options "DENY" always;',
  '',
].join('\n');

const GOOD_PROXYH = [
  'add_header X-Robots-Tag "noindex, nofollow" always;',
  'add_header Referrer-Policy "no-referrer" always;',
  `add_header Permissions-Policy "${PERMISSIONS}" always;`,
  'add_header Strict-Transport-Security "max-age=86400" always;',
  '',
].join('\n');

const GOOD_LOGFMT = [
  '# 注释里提到 $request_uri 不算',
  `log_format usj '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent "$http_user_agent"';`,
  '',
].join('\n');

function proxyLoc(spec, extra) {
  return [
    `location ${spec} {`,
    '    proxy_pass http://127.0.0.1:8090;',
    '    proxy_http_version 1.1;',
    '    proxy_set_header Connection "";',
    '    proxy_set_header Host $host;',
    '    proxy_set_header X-Real-IP $remote_addr;',
    '    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
    ...extra.map((e) => `    ${e}`),
    '    include snippets/usj-headers-proxy.conf;',
    '}',
    '',
  ].join('\n');
}

function staticLoc(spec, extra) {
  return [`location ${spec} {`, '    root /var/www/usj/site;', '    include snippets/usj-headers-common.conf;', ...extra.map((e) => `    ${e}`), '}', ''].join('\n');
}

const GOOD_APP = [
  '# 注释',
  'access_log /var/log/usj/access.log usj;',
  'server_tokens off;',
  'include snippets/usj-www-redirect.conf;',
  staticLoc('= /', ['try_files /index.html =404;', 'include snippets/usj-csp.conf;', 'add_header Cache-Control "no-cache" always;']),
  staticLoc('= /sw.js', ['add_header Content-Security-Policy "default-src \'none\'; connect-src \'self\'" always;', 'add_header Cache-Control "no-cache" always;']),
  staticLoc('= /manifest.webmanifest', ['types { application/manifest+json webmanifest; }', 'add_header Cache-Control "no-cache" always;']),
  staticLoc('^~ /vendor/', ['add_header Cache-Control "no-cache" always;']),
  staticLoc('^~ /icons/', ['add_header Cache-Control "public, max-age=3600" always;']),
  proxyLoc('= /api/realtime', ['proxy_buffering off;', 'proxy_cache off;', 'gzip off;', 'proxy_read_timeout 3600s;', 'proxy_send_timeout 3600s;', 'client_max_body_size 1m;']),
  proxyLoc('^~ /api/', ['proxy_read_timeout 60s;', 'client_max_body_size 5m;', 'gzip on;']),
  proxyLoc('^~ /_/', ['proxy_read_timeout 60s;']),
  'location ~ ^/ {\n    include snippets/usj-headers-common.conf;\n    return 404;\n}\n',
].join('\n');

const GOOD_05 =
  GOOD_HEADER +
  GOOD_UPLOAD +
  [
    'SITE_DIR=/etc/nginx/sites-available',
    'rollback() {',
    '  trap - ERR',
    '  sudo -n nginx -t </dev/null',
    '  sudo -n systemctl reload nginx </dev/null',
    '}',
    'cleanup() {',
    '  sudo -n rm -f "$TMP_SITE" </dev/null || true',
    '}',
    'trap cleanup EXIT',
    'case "$t" in',
    '  www.*) ;;',
    'esac',
    'getent ahosts "$t" </dev/null',
    "echo 'if ($host ~* ^www\\.(.+)$) { return 301 https://$1$request_uri; }'",
    'echo "WWW_REDIRECT=$S"',
    'sudo -n cp -p "$p" "$BK/x" </dev/null',
    'trap rollback ERR',
    'sudo -n install -d -o root -g adm -m 0750 /var/log/usj </dev/null',
    'TMP_SITE="$(sudo -n mktemp "$SITE_DIR/.usj-site.XXXXXX" </dev/null)"',
    'sudo -n mv -T "$TMP_SITE" "$SITE" </dev/null',
    'sudo -n nginx -t </dev/null',
    'sudo -n certbot renew --dry-run --no-random-sleep-on-renew </dev/null',
    'sudo -n logrotate -d /etc/logrotate.d/usj-nginx </dev/null',
    'trap - ERR',
    'sudo -n rm -f "$PROBE_SNIP" </dev/null',
    '',
  ].join('\n');

// 自检用的小 awk：一个 server 块里同时有锚点和 listen 443 ssl 才输出 443ssl（只管合成的单块配置）
const GOOD_AWK = [
  '/listen 443 ssl/ { ssl = 1 }',
  '/managed by Certbot/ { a = 1 }',
  'END { if (a && ssl) print "ANCHOR_BLOCK=443ssl"; else print "ANCHOR_BLOCK=other" }',
  '',
].join('\n');

export function goodContext(bash) {
  return {
    bash,
    sh: {
      '00-status.sh': GOOD_00,
      '01-swap.sh': GOOD_01,
      '02-install-pocketbase.sh': GOOD_02,
      '03-configure-pocketbase.sh': GOOD_03,
      '04-start-pocketbase.sh': GOOD_04,
      '05-nginx-app.sh': GOOD_05,
      '07-retire-probe.sh': GOOD_07,
      'pb-admin.sh': GOOD_ADMIN,
    },
    unit: GOOD_UNIT,
    probe02: GOOD_PROBE02,
    retire: GOOD_RETIRE,
    nginx: {
      'usj-app.conf': GOOD_APP,
      'usj-headers-common.conf': GOOD_COMMON,
      'usj-headers-proxy.conf': GOOD_PROXYH,
      'usj-log-format.conf': GOOD_LOGFMT,
    },
    awk: GOOD_AWK,
    awk6: GOOD_AWK,
  };
}

// 在好的上下文上改一个脚本、unit 或 nginx 文件（名字写成 nginx/<文件名>），得到坏的上下文
export function mutate(ctx, name, fn) {
  if (name === 'unit') return { ...ctx, unit: fn(ctx.unit) };
  if (name.startsWith('nginx/')) {
    const n = name.slice('nginx/'.length);
    return { ...ctx, nginx: { ...ctx.nginx, [n]: fn(ctx.nginx[n]) } };
  }
  return { ...ctx, sh: { ...ctx.sh, [name]: fn(ctx.sh[name]) } };
}

function selfTest() {
  const bash = findBash();
  let n = 0;
  let bad = 0;
  const expect = (name, cond) => {
    n += 1;
    let ok = false;
    try {
      ok = cond() === true;
    } catch {
      ok = false;
    }
    if (!ok) {
      bad += 1;
      console.log(`FAIL 自检：${name}`);
    }
  };
  const good = goodContext(bash);
  const passes = (fn, ctx) => fn(ctx).length === 0;
  const fails = (fn, ctx) => fn(ctx).length > 0;

  expect('好的合成上下文在 C-02 到 C-19 全部通过', () => [c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19].every((f) => passes(f, good)));

  // 纯函数
  expect('codeLines 丢掉整行注释和空行', () => codeLines('# a\n\nb\n  # c\nd # e').join('|') === 'b|d # e');
  expect('headerText 取第一行之后的注释块', () => headerText('#!/x\n# 输出\n# 回滚\n\nset -e\n# 后面').includes('回滚') && !headerText('#!/x\n# 输出\n\nset -e\n# 后面').includes('后面'));
  expect('hasTraceOption 抓 set -x', () => hasTraceOption('set -x\n') === true);
  expect('hasTraceOption 抓 set -euxo pipefail', () => hasTraceOption('set -euxo pipefail\n') === true);
  expect('hasTraceOption 抓 set -o xtrace', () => hasTraceOption('set -o xtrace\n') === true);
  expect('hasTraceOption 不误报 set -euo pipefail', () => hasTraceOption('set -euo pipefail\n') === false);
  expect('hasTraceOption 不看整行注释', () => hasTraceOption('# set -x\nset -euo pipefail\n') === false);
  expect('tokensOf 按空白切分', () => tokensOf('  a  --b=c ').join('|') === 'a|--b=c');

  // C-01（需要 bash）
  if (bash) {
    expect('C-01 好：语法正确的脚本通过', () => passes(c01, { bash, sh: { 'a.sh': '#!/usr/bin/env bash\nif true; then echo ok; fi\n' } }));
    expect('C-01 坏：语法错误的脚本被抓', () => fails(c01, { bash, sh: { 'a.sh': '#!/usr/bin/env bash\nif true; then\n' } }));
  } else {
    expect('C-01 需要 bash', () => false);
  }
  expect('C-01 坏：没有任何脚本也算失败', () => fails(c01, { bash: bash || 'bash', sh: {} }));

  // C-02
  expect('C-02 好：合成脚本通过', () => passes(c02, good));
  expect('C-02 坏：首行不对', () => fails(c02, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('#!/usr/bin/env bash', '#!/bin/bash'))));
  expect('C-02 坏：没有 set -euo pipefail', () => fails(c02, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('set -euo pipefail', 'set -eu'))));
  expect('C-02 坏：有 set -x', () => fails(c02, mutate(good, 'pb-admin.sh', (t) => `${t}set -x\n`)));

  // C-03
  expect('C-03 好：有输出和回滚', () => passes(c03, good));
  expect('C-03 坏：头注释没有回滚', () => fails(c03, mutate(good, '03-configure-pocketbase.sh', (t) => t.replace('# 回滚：无。\n', ''))));
  expect('C-03 坏：头注释没有输出', () => fails(c03, mutate(good, '03-configure-pocketbase.sh', (t) => t.replace('# 输出：KEY=VALUE。\n', ''))));

  // C-04
  expect('C-04 好：上传目录取自 $1 且核对 SHA256SUMS', () => passes(c04, good));
  expect('C-04 坏：写死了 Phase 6 的上传目录', () => fails(c04, mutate(good, '03-configure-pocketbase.sh', (t) => `${t}# UP=/tmp/usj-probe-upload\n`)));
  expect('C-04 坏：上传目录不取自 $1', () => fails(c04, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('UP="${1:-}"', 'UP=/tmp/usj-deploy.abc'))));
  expect('C-04 坏：没有 sha256sum -c', () => fails(c04, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('sha256sum -c --strict --status', 'sha256sum --strict'))));
  expect('C-04 坏：没有目录格式检查', () => fails(c04, mutate(good, '04-start-pocketbase.sh', (t) => t.replace(/usj-deploy\\\./g, 'tmp-up\\.'))));
  expect('C-04 好：不读上传文件的脚本不受约束', () => passes(c04, mutate(good, 'pb-admin.sh', (t) => t)));

  // C-05
  expect('C-05 好：unit 与 pb-admin 参数一致', () => passes(c05, good));
  expect('C-05 坏：--migrationsDir 不同', () => fails(c05, mutate(good, 'pb-admin.sh', (t) => t.replace('--migrationsDir=/var/lib/pocketbase/pb_migrations', '--migrationsDir=/tmp/x'))));
  expect('C-05 坏：pb-admin 少了 --encryptionEnv', () => fails(c05, mutate(good, 'pb-admin.sh', (t) => t.replace(' --encryptionEnv=PB_ENCRYPTION_KEY', ''))));
  expect('C-05 坏：unit 的 --automigrate 不是 false', () => fails(c05, mutate(good, 'unit', (t) => t.replace('--automigrate=false', '--automigrate=true'))));
  expect('C-05 坏：unit 没有绑 127.0.0.1:8090', () => fails(c05, mutate(good, 'unit', (t) => t.replace('--http=127.0.0.1:8090', '--http=0.0.0.0:8090'))));
  expect('C-05 坏：unit 的 --origins 写死了地址', () => fails(c05, mutate(good, 'unit', (t) => t.replace('--origins=${USJ_ORIGIN}', '--origins=https://example.com'))));
  expect('C-05 坏：unit 没有 EnvironmentFile', () => fails(c05, mutate(good, 'unit', (t) => t.replace('EnvironmentFile=/etc/usj/pocketbase.env\n', ''))));
  expect('C-05 坏：04 的环境文件路径不同', () => fails(c05, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('/etc/usj/pocketbase.env', '/etc/usj/other.env'))));
  expect('C-05 坏：unit 没有 ExecStart', () => fails(c05, mutate(good, 'unit', (t) => t.replace(/^ExecStart=.*$/m, ''))));

  // C-06
  expect('C-06 好：unit 满足', () => passes(c06, good));
  expect('C-06 坏：没有 Restart=always', () => fails(c06, mutate(good, 'unit', (t) => t.replace('Restart=always', 'Restart=on-failure'))));
  expect('C-06 坏：没有 MemoryMax', () => fails(c06, mutate(good, 'unit', (t) => t.replace('MemoryMax=400M\n', ''))));
  expect('C-06 坏：有别的 Environment= 行', () => fails(c06, mutate(good, 'unit', (t) => `${t}Environment=FOO=bar\n`)));
  expect('C-06 坏：User 不是 pocketbase', () => fails(c06, mutate(good, 'unit', (t) => t.replace('User=pocketbase', 'User=root'))));

  // C-07
  expect('C-07 好：有 restart 和 disable --now', () => passes(c07, good));
  expect('C-07 坏：只有 enable --now', () => fails(c07, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('systemctl restart pocketbase', 'systemctl enable --now pocketbase'))));
  expect('C-07 坏：失败路径只 stop', () => fails(c07, mutate(good, '04-start-pocketbase.sh', (t) => t.replace('disable --now pocketbase', 'stop pocketbase'))));

  // C-08
  expect('C-08 好：钥匙只在赋值、长度检查、printf 到 tee、unset', () => passes(c08, good));
  expect('C-08 坏：钥匙进了 echo', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => `${t}echo "$KEY"\n`)));
  expect('C-08 坏：钥匙进了别的命令参数', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => `${t}some-tool --key "$KEY"\n`)));
  expect('C-08 坏：钥匙经 ${KEY} 写法进了 echo', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => `${t}echo "k=\${KEY}"\n`)));
  expect('C-08 坏：没有核对长度', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => t.replace('-ne 32', '-ne 31'))));
  expect('C-08 坏：没有 unset', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => t.replace('unset KEY\n', ''))));
  expect('C-08 坏：没有 openssl rand -hex 16', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => t.replace('openssl rand -hex 16', 'openssl rand -hex 8'))));
  expect('C-08 坏：printf 没有交给 tee', () => fails(c08, mutate(good, '03-configure-pocketbase.sh', (t) => t.replace('| sudo -n tee "$ENV_FILE.new" >/dev/null', '> /tmp/x'))));

  // C-09
  expect('C-09 好：fstab 在 already 之前', () => passes(c09, good));
  expect('C-09 坏：fstab 的检查和追加都在 already 之后', () =>
    fails(c09, mutate(good, '01-swap.sh', (t) => {
      const [head, rest] = [t.slice(0, t.indexOf('sudo -n grep')), t.slice(t.indexOf('sudo -n grep'))];
      const lines = rest.split('\n');
      return `${head}${lines[2]}\n${lines[0]}\n${lines[1]}\n`;
    })));
  expect('C-09 坏：根本不补写 fstab', () => fails(c09, mutate(good, '01-swap.sh', (t) => t.replace(/^.*\/etc\/fstab.*$/gm, ''))));
  expect('C-09 坏：缺少 01', () => fails(c09, { ...good, sh: { 'x.sh': '' } }));

  // C-10
  expect('C-10 好：--version 在 install 之前，sha256 相同', () => passes(c10, good));
  expect('C-10 坏：--version 在 install 之后', () =>
    fails(c10, mutate(good, '02-install-pocketbase.sh', (t) => {
      const lines = t.split('\n');
      const v = lines.findIndex((l) => l.includes('--version'));
      const i = lines.findIndex((l) => l.includes('install -o root'));
      [lines[v], lines[i]] = [lines[i], lines[v]];
      return lines.join('\n');
    })));
  expect('C-10 坏：没有对解压出的程序跑 --version', () => fails(c10, mutate(good, '02-install-pocketbase.sh', (t) => t.replace('"$T/x/pocketbase" --dir="$T/data" --version </dev/null\n', ''))));
  expect('C-10 坏：钉死的 sha256 与 Phase 6 的不同', () => fails(c10, mutate(good, '02-install-pocketbase.sh', (t) => t.replace(PIN_B, 'c'.repeat(64)))));
  expect('C-10 坏：丢了一个钉死的 sha256', () => fails(c10, mutate(good, '02-install-pocketbase.sh', (t) => t.replace(`PINNED_SHA256='${PIN_B}'\n`, ''))));
  expect('C-10 坏：找不到 Phase 6 的脚本', () => fails(c10, { ...good, probe02: null }));

  // C-11
  expect('C-11 好：守卫在 rm -rf 之前，正则相同', () => passes(c11, good));
  expect('C-11 坏：rm -rf 在守卫调用之前', () => fails(c11, mutate(good, '07-retire-probe.sh', (t) => t.replace('guard_non_probe_data\nsudo -n rm -rf "$DATA_DIR"', 'sudo -n rm -rf "$DATA_DIR"\nguard_non_probe_data'))));
  expect('C-11 坏：没有调用守卫', () => fails(c11, mutate(good, '07-retire-probe.sh', (t) => t.replace('\nguard_non_probe_data\n', '\n'))));
  expect('C-11 坏：邮箱正则与清理迁移不同', () => fails(c11, { ...good, retire: 'const PROBE = /^probe-[0-9]{8}@example\\.com$/\n' }));
  expect('C-11 坏：07 里的正则被放宽', () => fails(c11, mutate(good, '07-retire-probe.sh', (t) => t.replace(PROBE_RE, '^probe-.*@example\\.com$'))));
  expect('C-11 坏：守卫没有数 journey_docs', () => fails(c11, mutate(good, '07-retire-probe.sh', (t) => t.replace('journey_docs', 'other'))));
  expect('C-11 坏：缺少 --wipe --keep 的判断', () => fails(c11, mutate(good, '07-retire-probe.sh', (t) => t.replace('--wipe|--keep', '--wipe'))));

  // C-12
  expect('C-12 好：只读的状态脚本', () => passes(c12, good));
  expect('C-12 坏：有 install', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'sudo -n install -d /x\nkv STATUS_DONE 1'))));
  expect('C-12 坏：有 rm', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'rm -f /x\nkv STATUS_DONE 1'))));
  expect('C-12 坏：有 tee', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'echo x | tee /x\nkv STATUS_DONE 1'))));
  expect('C-12 坏：有 systemctl restart', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'sudo -n systemctl restart nginx\nkv STATUS_DONE 1'))));
  expect('C-12 坏：有写文件的重定向', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'echo x > /tmp/y\nkv STATUS_DONE 1'))));
  expect('C-12 好：重定向到 /dev/null 和 2>&1 不算', () => passes(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'ls </dev/null >/dev/null 2>&1 || true\nkv STATUS_DONE 1'))));
  expect('C-12 坏：写库的 SQL', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1', 'con.execute("DELETE FROM x")\nkv STATUS_DONE 1'))));
  expect('C-12 坏：sqlite 不是 mode=ro', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('?mode=ro', ''))));
  expect('C-12 坏：最后一个 kv 不是 STATUS_DONE', () => fails(c12, mutate(good, '00-status.sh', (t) => `${t}kv LATE 1\n`)));
  expect('C-12 坏：没有 STATUS_DONE', () => fails(c12, mutate(good, '00-status.sh', (t) => t.replace('kv STATUS_DONE 1\n', ''))));

  // C-13
  expect('C-13 好：头文件和位置都对', () => passes(c13, good));
  expect('C-13 坏：静态位置没有 include 头文件', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/location \^~ \/vendor\/ \{\n    root \/var\/www\/usj\/site;\n    include snippets\/usj-headers-common\.conf;/, 'location ^~ /vendor/ {\n    root /var/www/usj/site;'))));
  expect('C-13 坏：反代位置又 include 了 common', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/_\/ \{\n)/, '$1    include snippets/usj-headers-common.conf;\n'))));
  expect('C-13 坏：= / 没有 include usj-csp.conf', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('    include snippets/usj-csp.conf;\n', ''))));
  expect('C-13 坏：别的位置也 include 了 usj-csp.conf', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/icons\/ \{\n)/, '$1    include snippets/usj-csp.conf;\n'))));
  expect('C-13 坏：反代位置里有 CSP', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/api\/ \{\n)/, "$1    add_header Content-Security-Policy \"default-src 'self'\" always;\n"))));
  expect('C-13 坏：位置的 add_header 与头文件重名', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/icons\/ \{\n)/, '$1    add_header X-Robots-Tag "index" always;\n'))));
  expect('C-13 坏：反代位置自己发 X-Frame-Options', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/_\/ \{\n)/, '$1    add_header X-Frame-Options "DENY" always;\n'))));
  expect('C-13 坏：common 少了一条', () => fails(c13, mutate(good, 'nginx/usj-headers-common.conf', (t) => t.replace('add_header X-Frame-Options "DENY" always;\n', ''))));
  expect('C-13 坏：proxy 多了 nosniff', () => fails(c13, mutate(good, 'nginx/usj-headers-proxy.conf', (t) => `${t}add_header X-Content-Type-Options "nosniff" always;\n`)));
  expect('C-13 坏：Permissions-Policy 被改', () => fails(c13, mutate(good, 'nginx/usj-headers-proxy.conf', (t) => t.replace('usb=()', 'usb=*'))));
  expect('C-13 坏：少一个位置', () => fails(c13, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/location \^~ \/icons\/ \{[\s\S]*?\n\}\n/, ''))));
  expect('C-13 坏：缺少 usj-app.conf', () => fails(c13, { ...good, nginx: {} }));

  // C-14
  expect('C-14 好：IP 头和实时位置参数都对', () => passes(c14, good));
  expect('C-14 坏：/_/ 没有 X-Real-IP', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/_\/ \{[\s\S]*?)    proxy_set_header X-Real-IP \$remote_addr;\n/, '$1'))));
  expect('C-14 坏：X-Real-IP 取了客户端自带的头', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/api\/ \{[\s\S]*?)X-Real-IP \$remote_addr;/, '$1X-Real-IP $http_x_real_ip;'))));
  expect('C-14 坏：X-Real-IP 设了两次', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/_\/ \{\n)/, '$1    proxy_set_header X-Real-IP $remote_addr;\n'))));
  expect('C-14 坏：实时位置没关缓冲', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('proxy_buffering off;', 'proxy_buffering on;'))));
  expect('C-14 坏：实时位置读超时不是 3600s', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('proxy_read_timeout 3600s;', 'proxy_read_timeout 60s;'))));
  expect('C-14 坏：实时位置请求体不是 1m', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location = \/api\/realtime \{[\s\S]*?)client_max_body_size 1m;/, '$1client_max_body_size 5m;'))));
  expect('C-14 坏：/api/ 的请求体是 1m', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('client_max_body_size 5m;', 'client_max_body_size 1m;'))));
  expect('C-14 坏：没有 proxy_http_version 1.1', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/_\/ \{[\s\S]*?)    proxy_http_version 1\.1;\n/, '$1'))));
  expect('C-14 坏：实时位置没清 Connection 头', () => fails(c14, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location = \/api\/realtime \{[\s\S]*?)    proxy_set_header Connection "";\n/, '$1'))));

  // C-15
  expect('C-15 好：日志格式用 $uri，server 层记日志', () => passes(c15, good));
  expect('C-15 坏：日志格式用了 $request', () => fails(c15, mutate(good, 'nginx/usj-log-format.conf', (t) => t.replace('"$request_method $uri $server_protocol"', '"$request"'))));
  expect('C-15 坏：日志格式用了 $request_uri', () => fails(c15, mutate(good, 'nginx/usj-log-format.conf', (t) => t.replace('$uri', '$request_uri'))));
  expect('C-15 坏：日志格式带 $args', () => fails(c15, mutate(good, 'nginx/usj-log-format.conf', (t) => t.replace('$uri $server_protocol', '$uri?$args $server_protocol'))));
  expect('C-15 坏：日志格式没有 $uri', () => fails(c15, mutate(good, 'nginx/usj-log-format.conf', (t) => t.replace('$uri ', ''))));
  expect('C-15 坏：日志格式不叫 usj', () => fails(c15, mutate(good, 'nginx/usj-log-format.conf', (t) => t.replace('log_format usj', 'log_format other'))));
  expect('C-15 坏：位置里关了访问日志', () => fails(c15, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/_\/ \{\n)/, '$1    access_log off;\n'))));
  expect('C-15 坏：server 层没有 access_log', () => fails(c15, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('access_log /var/log/usj/access.log usj;\n', ''))));
  expect('C-15 坏：access_log 用了别的格式', () => fails(c15, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('access_log /var/log/usj/access.log usj;', 'access_log /var/log/usj/access.log combined;'))));

  // C-16
  expect('C-16 好：每条 add_header 都带 always', () => passes(c16, good));
  expect('C-16 坏：头文件里有一条没有 always', () => fails(c16, mutate(good, 'nginx/usj-headers-common.conf', (t) => t.replace('"nosniff" always;', '"nosniff";'))));
  expect('C-16 坏：应用片段里有一条没有 always', () => fails(c16, mutate(good, 'nginx/usj-app.conf', (t) => t.replace('add_header Cache-Control "public, max-age=3600" always;', 'add_header Cache-Control "public, max-age=3600";'))));
  expect('C-16 坏：proxy 头文件里有一条没有 always', () => fails(c16, mutate(good, 'nginx/usj-headers-proxy.conf', (t) => t.replace('"no-referrer" always;', '"no-referrer";'))));

  // C-17
  expect('C-17 好：HSTS 一天', () => passes(c17, good));
  expect('C-17 坏：HSTS 一年', () => fails(c17, mutate(good, 'nginx/usj-headers-common.conf', (t) => t.replace('max-age=86400', 'max-age=31536000'))));
  expect('C-17 坏：HSTS 带 includeSubDomains', () => fails(c17, mutate(good, 'nginx/usj-headers-proxy.conf', (t) => t.replace('max-age=86400', 'max-age=86400; includeSubDomains'))));
  expect('C-17 坏：HSTS 带 preload', () => fails(c17, mutate(good, 'nginx/usj-headers-common.conf', (t) => t.replace('max-age=86400', 'max-age=86400; preload'))));
  expect('C-17 坏：HSTS 缺失', () => fails(c17, mutate(good, 'nginx/usj-headers-proxy.conf', (t) => t.replace('add_header Strict-Transport-Security "max-age=86400" always;\n', ''))));
  expect('C-17 坏：应用片段里直接写 HSTS', () => fails(c17, mutate(good, 'nginx/usj-app.conf', (t) => t.replace(/(location \^~ \/icons\/ \{\n)/, '$1    add_header Strict-Transport-Security "max-age=86400" always;\n'))));

  // C-18（需要 bash 里的 awk）
  expect('C-18 好：awk 相同，合成块判定对', () => passes(c18, good));
  expect('C-18 坏：与 Phase 6 的不相同', () => fails(c18, { ...good, awk6: `${GOOD_AWK}# x\n` }));
  expect('C-18 坏：80 块也输出 443ssl', () => fails(c18, { ...good, awk: 'END { print "ANCHOR_BLOCK=443ssl" }\n', awk6: 'END { print "ANCHOR_BLOCK=443ssl" }\n' }));
  expect('C-18 坏：443 块不输出 443ssl', () => fails(c18, { ...good, awk: 'END { print "ANCHOR_BLOCK=other" }\n', awk6: 'END { print "ANCHOR_BLOCK=other" }\n' }));
  expect('C-18 坏：找不到 Phase 6 的文件', () => fails(c18, { ...good, awk6: null }));
  expect('C-18 坏：缺少 awk', () => fails(c18, { ...good, awk: null }));

  // C-19
  const g05 = (fn) => mutate(good, '05-nginx-app.sh', fn);
  expect('C-19 好：05 的顺序和回滚都对', () => passes(c19, good));
  expect('C-19 坏：没有 trap rollback ERR', () => fails(c19, g05((t) => t.replace('trap rollback ERR\n', ''))));
  expect('C-19 坏：成功路径没有 trap - ERR', () => fails(c19, g05((t) => t.replace(/\ntrap - ERR\n/, '\n'))));
  expect('C-19 坏：没有 EXIT trap', () => fails(c19, g05((t) => t.replace('trap cleanup EXIT\n', ''))));
  expect('C-19 坏：EXIT 清理不删临时文件', () => fails(c19, g05((t) => t.replace('sudo -n rm -f "$TMP_SITE" </dev/null || true', 'true'))));
  expect('C-19 坏：临时文件不在站点目录', () => fails(c19, g05((t) => t.replace('mktemp "$SITE_DIR/.usj-site.XXXXXX"', 'mktemp'))));
  expect('C-19 坏：没有 mv -T', () => fails(c19, g05((t) => t.replace('mv -T "$TMP_SITE" "$SITE"', 'cp "$TMP_SITE" "$SITE"'))));
  expect('C-19 坏：没有 certbot 干跑', () => fails(c19, g05((t) => t.replace('certbot renew --dry-run', 'certbot renew'))));
  expect('C-19 坏：没有 logrotate -d', () => fails(c19, g05((t) => t.replace('logrotate -d', 'logrotate -f'))));
  expect('C-19 坏：删探针片段在 certbot 干跑之前', () =>
    fails(c19, g05((t) => {
      const rm = 'sudo -n rm -f "$PROBE_SNIP" </dev/null\n';
      return t.replace(rm, '').replace('sudo -n certbot renew', `${rm}sudo -n certbot renew`);
    })));
  expect('C-19 坏：解除回滚在 certbot 干跑之前', () => fails(c19, g05((t) => t.replace(/\ntrap - ERR\n/, '\n').replace('sudo -n certbot renew', 'trap - ERR\nsudo -n certbot renew'))));
  expect('C-19 坏：rollback 不核对 nginx -t 就 reload', () => fails(c19, g05((t) => t.replace('  sudo -n nginx -t </dev/null\n  sudo -n systemctl reload nginx </dev/null', '  sudo -n systemctl reload nginx </dev/null'))));
  expect('C-19 坏：在挂 ERR trap 之前就改动', () =>
    fails(c19, g05((t) => t.replace('trap rollback ERR\n', '').replace('TMP_SITE="$(', 'trap rollback ERR\nTMP_SITE="$('))));
  expect('C-19 坏：备份在 ERR trap 之后', () =>
    fails(c19, g05((t) => {
      const cp = 'sudo -n cp -p "$p" "$BK/x" </dev/null\n';
      return t.replace(cp, '').replace('sudo -n install -d -o root -g adm', `${cp}sudo -n install -d -o root -g adm`);
    })));
  expect('C-19 坏：没有判断 www 解析', () => fails(c19, g05((t) => t.replace('getent ahosts "$t" </dev/null\n', ''))));
  expect('C-19 坏：没有判断 server_name 里有 www', () => fails(c19, g05((t) => t.replace('  www.*) ;;\n', '  x) ;;\n'))));
  expect('C-19 坏：判断排在生成跳转之后', () =>
    fails(c19, g05((t) => {
      const g = 'getent ahosts "$t" </dev/null\n';
      return t.replace(g, '').replace('echo "WWW_REDIRECT=$S"', `${g}echo "WWW_REDIRECT=$S"`);
    })));
  expect('C-19 坏：没有输出 WWW_REDIRECT=', () => fails(c19, g05((t) => t.replace('echo "WWW_REDIRECT=$S"\n', ''))));
  expect('C-19 坏：usj-app.conf 里写了 if ($host', () => fails(c19, mutate(good, 'nginx/usj-app.conf', (t) => `${t}if ($host ~* ^www\\.(.+)$) { return 301 https://$1$request_uri; }\n`)));
  expect('C-19 坏：缺少 05', () => fails(c19, { ...good, sh: { 'x.sh': '' } }));

  console.log(bad === 0 ? `SELF-TEST OK (${n} cases)` : `SELF-TEST FAIL (${bad} of ${n})`);
  return bad === 0 ? 0 : 1;
}

// ---------- 入口 ----------

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') {
    process.exit(selfTest());
  }
  if (args.length !== 0) {
    console.error('用法：node deploy/server-check.mjs [--self-test]');
    process.exit(2);
  }
  const bash = findBash();
  if (!bash) {
    console.error('错误：找不到 bash（Windows 上需要 Git 自带的 bash.exe）。');
    process.exit(2);
  }
  const ctx = loadContext(bash);
  const failed = runChecks(ctx);
  if (failed === 0) {
    console.log(`SERVER-CHECK OK (${CHECKS.length} checks)`);
    process.exit(0);
  }
  console.log(`SERVER-CHECK FAIL (${failed} of ${CHECKS.length})`);
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
