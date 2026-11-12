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
  return { bash, sh, unit, probe02, retire };
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

export function goodContext(bash) {
  return {
    bash,
    sh: {
      '00-status.sh': GOOD_00,
      '01-swap.sh': GOOD_01,
      '02-install-pocketbase.sh': GOOD_02,
      '03-configure-pocketbase.sh': GOOD_03,
      '04-start-pocketbase.sh': GOOD_04,
      '07-retire-probe.sh': GOOD_07,
      'pb-admin.sh': GOOD_ADMIN,
    },
    unit: GOOD_UNIT,
    probe02: GOOD_PROBE02,
    retire: GOOD_RETIRE,
  };
}

// 在好的上下文上改一个脚本或 unit，得到坏的上下文
export function mutate(ctx, name, fn) {
  if (name === 'unit') return { ...ctx, unit: fn(ctx.unit) };
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

  expect('好的合成上下文在 C-02 到 C-12 全部通过', () => [c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12].every((f) => passes(f, good)));

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
