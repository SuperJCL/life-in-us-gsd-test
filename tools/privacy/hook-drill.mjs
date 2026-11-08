#!/usr/bin/env node
// 钩子演练：证明 ROADMAP Phase 6 成功标准 1。零依赖，只使用 node: 内置模块。
//
// 证明什么：用真实的 .githooks/pre-commit 和 .githooks/pre-push，在一次性的临时仓库里
//   - 暂存令牌形状、口令赋值、pb_data 数据库、压缩包备份、denylist 里的域名和 IP、公网 IPv4 形状时，git commit 都失败；
//   - 把这些内容（连同提交说明里的域名）推送到本机裸仓库时，git push 也失败；
//   - 干净的提交和干净的推送照常通过。
//
// 用法：
//   node tools/privacy/hook-drill.mjs
//
// 安全约定：
//   - 只在 os.tmpdir() 下的一次性目录里运行，主仓库的暂存区和钩子文件一概不碰，结束时删除并确认目录已不存在；
//   - 样本（令牌、口令、域名、IP）全部在运行时拼接，不进源码，也不打印；输出里只有 PASS/FAIL 行和规则名；
//   - 不绕过任何钩子：“已经混进历史的违规提交”在临时仓库启用钩子之前提交（那时仓库里还没有钩子），
//     之后才用 git config 设置钩子目录。源码里没有跳过钩子的提交参数，也没有在命令行上临时覆盖钩子目录的写法；
//   - 不推送到任何真实远端，只推送到临时目录里的裸仓库。
//
// 退出码：0 全部通过（最后一行 HOOK DRILL OK）；1 有失败（最后一行 HOOK DRILL FAIL）。

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COPY_FILES = [
  'tools/privacy/privacy-check.mjs',
  '.githooks/pre-commit',
  '.githooks/pre-push',
  '.gitignore',
  '.gitattributes',
];

// ---------- 合成样本（运行时拼接） ----------

function makeSamples() {
  const b64u = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head = b64u({ alg: 'HS256', typ: 'JWT' });
  const body = b64u({ id: 'drill', exp: 1 });
  const sig = 'd'.repeat(43);
  return {
    head,
    body,
    sig,
    jwt: [head, body, sig].join('.'),
    pw: ['Dr', 'ill', 'Pass', '4412'].join(''),
    domain: ['drill-synth', 'example'].join('.'),
    ip: [203, 0, 113, 77].join('.'),
    publicIp: [9, 9, 9, 9].join('.'),
    email: `0+drill@${['users', 'noreply', 'github', 'com'].join('.')}`,
  };
}

// ---------- git 辅助 ----------

function cleanEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!k.startsWith('GIT_')) env[k] = v;
  env.GIT_TERMINAL_PROMPT = '0';
  return env;
}

// 返回 { status, out }，out 是 stdout 和 stderr 合并后的文本（只用于判断，不原样打印）
function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, env: cleanEnv(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

function gitMust(cwd, args) {
  const r = git(cwd, args);
  if (r.status !== 0) throw new Error(`准备步骤失败：git ${args[0]}`);
  return r;
}

function writeRel(work, rel, text) {
  const p = join(work, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

// ---------- 演练 ----------

function drill() {
  const s = makeSamples();
  const lines = [];
  let failed = false;
  const collected = [];
  const pass = (text) => lines.push(`PASS ${text}`);
  const fail = (text) => {
    failed = true;
    lines.push(`FAIL ${text}`);
  };

  const root = mkdtempSync(join(tmpdir(), 'hook-drill-'));
  const work = join(root, 'work');
  const bare = join(root, 'remote.git');
  try {
    mkdirSync(work);
    // 1. 准备：此时不设钩子目录，临时仓库里没有任何钩子
    gitMust(work, ['init', '-q', '-b', 'main']);
    gitMust(work, ['config', 'user.name', 'drill']);
    gitMust(work, ['config', 'user.email', s.email]);
    gitMust(work, ['config', 'commit.gpgsign', 'false']);
    for (const rel of COPY_FILES) {
      const dst = join(work, rel);
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(join(REPO, rel), dst);
    }
    writeRel(work, 'private/denylist.txt', ['# drill', s.domain, s.ip, ''].join('\n'));
    gitMust(work, ['add', '--', '.gitignore', '.gitattributes', 'tools/privacy/privacy-check.mjs', '.githooks/pre-commit', '.githooks/pre-push']);
    gitMust(work, ['commit', '-q', '-m', 'drill base']);

    // 2. 已经混进历史的违规提交：仍在启用钩子之前，只在 drill-history 分支上
    const cases = {
      token: { files: { 'token.json': `{"token":"${s.jwt}"}\n` }, tag: 'F-token-shape' },
      password: { files: { 'config.json': `{"adminPassword": "${s.pw}"}\n` }, tag: 'G-secret-assign' },
      pb_data: { files: { 'pb_data/data.db': 'x\n' }, tag: 'A-forbidden-path' },
      archive: { files: { 'backups/pb-2026.zip': 'x\n' }, tag: 'A-forbidden-path' },
      domain: { files: { 'docs-domain.md': `see https://${s.domain}/probe/\n` }, tag: 'D-plan-term' },
      ip: { files: { 'docs-ip.md': `ssh ${s.ip} uptime\n` }, tag: 'D-plan-term' },
      'public-ip': { files: { 'docs-public-ip.md': `ssh ${s.publicIp} uptime\n` }, tag: 'H-public-ipv4' },
    };
    gitMust(work, ['switch', '-q', '-c', 'drill-history']);
    for (const name of ['token', 'password', 'pb_data']) {
      for (const [rel, text] of Object.entries(cases[name].files)) writeRel(work, rel, text);
      gitMust(work, ['add', '-f', '--', ...Object.keys(cases[name].files)]);
      gitMust(work, ['commit', '-q', '-m', 'drill history']);
    }
    // 域名那次：文件内容无害，域名只在提交说明里
    writeRel(work, 'history-note.md', 'harmless\n');
    gitMust(work, ['add', '-f', '--', 'history-note.md']);
    gitMust(work, ['commit', '-q', '-m', `drill history https://${s.domain}/`]);
    gitMust(work, ['switch', '-q', 'main']);

    // 3. 启用钩子：只用这一种写法设置钩子目录
    gitMust(work, ['config', 'core.hooksPath', '.githooks']);
    writeRel(work, 'notes.md', 'drill notes\n');
    gitMust(work, ['add', '--', 'notes.md']);
    const clean = git(work, ['commit', '-q', '-m', 'drill clean']);
    collected.push(clean.out);
    if (clean.status === 0) pass('clean commit accepted');
    else fail('clean commit accepted');

    // 4. pre-commit 演练
    for (const [name, c] of Object.entries(cases)) {
      for (const [rel, text] of Object.entries(c.files)) writeRel(work, rel, text);
      gitMust(work, ['add', '-f', '--', ...Object.keys(c.files)]);
      const r = git(work, ['commit', '-q', '-m', 'drill']);
      collected.push(r.out);
      if (r.status !== 0 && r.out.includes(`[${c.tag}]`)) pass(`pre-commit ${name} [${c.tag}]`);
      else fail(`pre-commit ${name} [${c.tag}] (exit ${r.status})`);
      // 取消暂存并删掉这个用例写的文件（不用 git clean）
      git(work, ['reset', '-q']);
      for (const rel of Object.keys(c.files)) rmSync(join(work, rel.split('/')[0]), { recursive: true, force: true });
    }

    // 5. pre-push 演练（钩子一直生效）
    gitMust(root, ['init', '--bare', '-q', bare]);
    gitMust(work, ['remote', 'add', 'origin', bare]);
    const cleanPush = git(work, ['push', '-q', 'origin', 'main']);
    collected.push(cleanPush.out);
    if (cleanPush.status === 0) pass('clean push accepted');
    else fail('clean push accepted');

    const bad = git(work, ['push', '-q', 'origin', 'drill-history:refs/heads/drill-history']);
    collected.push(bad.out);
    if (bad.status === 0) {
      fail('pre-push drill-history was accepted');
    } else {
      for (const tag of ['F-token-shape', 'G-secret-assign', 'A-forbidden-path', 'D-plan-term']) {
        if (bad.out.includes(`[${tag}]`)) pass(`pre-push [${tag}]`);
        else fail(`pre-push [${tag}] missing`);
      }
      if (/提交说明[^\n]*\[D-plan-term\]/.test(bad.out)) pass('pre-push [D-plan-term] 提交说明');
      else fail('pre-push [D-plan-term] 提交说明 missing');
    }

    // 6. 泄露检查：钩子输出里不得出现任何样本原文
    const all = collected.join('\n').toLowerCase();
    const secrets = [s.head, s.body, s.sig, s.jwt, s.pw, s.domain, s.ip, s.publicIp];
    const leaked = secrets.filter((v) => all.includes(v.toLowerCase())).length;
    if (leaked === 0) pass('no sample text in hook output');
    else fail(`leak (${leaked} samples found in hook output)`);
  } catch (err) {
    fail(`drill error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    if (existsSync(root)) fail('temp directory still exists');
    else pass('temp directory removed');
  }
  return { lines, failed };
}

function main() {
  const { lines, failed } = drill();
  for (const l of lines) process.stdout.write(`${l}\n`);
  process.stdout.write(failed ? 'HOOK DRILL FAIL\n' : 'HOOK DRILL OK\n');
  return failed ? 1 : 0;
}

// 只在直接运行时执行入口，被 import 时不执行
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
