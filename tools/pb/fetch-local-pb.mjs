// 一次性下载并核对 PocketBase 0.41.1 的 Windows 版（Phase 8，08-04，TEST-04；D-02、D-03、D-17）。
// 零依赖，只用 node: 内置模块；不安装任何包。
//
// 本脚本只能在所有者批准之后带 --approved 运行；批准只覆盖这一次下载，换版本必须重新批准。
//
// 用法：
//   node tools/pb/fetch-local-pb.mjs --self-test   不联网，检查四个核对函数
//   node tools/pb/fetch-local-pb.mjs --approved    所有者批准后的下载
// 核对规则（下载的文件是不可信数据，三项都对才解压）：
//   1. zip 的大小和 sha256 等于钉死值；
//   2. checksums.txt 里该 zip 恰好一行，且等于钉死值；
//   3. checksums.txt 里 linux_amd64 那一行仍等于 Phase 6 钉死的值（单一来源下的弱补强）。
//   通过后只解出 pocketbase.exe 一个文件到被 git 忽略的 tools/pb/bin/，打印它的 sha256 和字节数。
//   再次运行时，exe 已在且哈希等于 instance.mjs 的 PB_EXE_SHA256 就报告已存在，不联网。
// 退出码：0 成功或已存在；1 核对或下载失败；2 用法错误、没有批准参数，或已有程序与钉死值不符。

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isEntry } from './lib/entry.mjs';
import { PB_EXE_PATH, PB_EXE_SHA256 } from './lib/instance.mjs';

export const PB_VERSION = '0.41.1';
export const ZIP_NAME = 'pocketbase_0.41.1_windows_amd64.zip';
export const ZIP_BYTES = 13012018;
export const ZIP_SHA256 = 'fda68dcbb4812585cf32282a8e79c09f0b065c109c75d840f46d8fd8b59b0580';
// Phase 6 在服务器安装脚本里钉死的 linux_amd64 值（tools/probe/server/02-install-pocketbase.sh）
export const LINUX_ZIP_NAME = 'pocketbase_0.41.1_linux_amd64.zip';
export const LINUX_SHA256 = '7504ec99a85fe405fc9941b4d94bdea20733b53707c8251b66fd0daa1444347e';
export const BASE_URL = 'https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// 大小和 sha256 都等于钉死值（pin 参数只给自检用）
export function checkZip(bytes, pin = { bytes: ZIP_BYTES, sha256: ZIP_SHA256 }) {
  return bytes.length === pin.bytes && sha256(bytes) === pin.sha256;
}

// 按 `<哈希> <名字>` 或 `<哈希> *<名字>` 取行；该名字恰好一行时返回哈希，否则 null
export function listedHash(checksumsText, name) {
  const hits = [];
  for (const line of String(checksumsText).split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(.+?)\s*$/.exec(line);
    if (m && m[2] === name) hits.push(m[1].toLowerCase());
  }
  return hits.length === 1 ? hits[0] : null;
}

export function checkChecksums(text, pins = { zipName: ZIP_NAME, zip: ZIP_SHA256, linuxName: LINUX_ZIP_NAME, linux: LINUX_SHA256 }) {
  return listedHash(text, pins.zipName) === pins.zip && listedHash(text, pins.linuxName) === pins.linux;
}

// 名单里必须恰好有一个名为 pocketbase.exe 的顶层成员；任何含 `..`、绝对路径或反斜杠开头的成员都使整份拒绝
export function checkMembers(names) {
  const list = names.map((n) => String(n).trim()).filter((n) => n !== '');
  for (const n of list) {
    if (n.includes('..') || n.startsWith('/') || n.startsWith('\\') || /^[A-Za-z]:/.test(n)) return false;
  }
  return list.filter((n) => n === 'pocketbase.exe').length === 1;
}

// ---------- 自检 ----------

function selfTest() {
  const results = [];
  const check = (name, ok) => {
    results.push(ok);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${results.length} ${name}`);
  };
  const good = crypto.randomBytes(256);
  const pin = { bytes: good.length, sha256: sha256(good) };
  check('checkZip 大小和哈希都对', checkZip(good, pin) === true);
  const flipped = Buffer.from(good);
  flipped[0] ^= 1;
  check('checkZip 哈希不符被拒', checkZip(flipped, pin) === false);
  check('checkZip 大小不符被拒', checkZip(good.subarray(0, 255), pin) === false);
  check('checkZip 真实钉死值对随机字节被拒', checkZip(good) === false);

  const zipH = sha256(Buffer.from('zip'));
  const linH = sha256(Buffer.from('linux'));
  const pins = { zipName: 'a.zip', zip: zipH, linuxName: 'b.zip', linux: linH };
  const text = `${zipH}  a.zip\n${linH}  b.zip\n${sha256(Buffer.from('x'))}  c.zip\n`;
  check('checkChecksums 两行都对', checkChecksums(text, pins) === true);
  check('listedHash 带星号的行', listedHash(`${zipH} *a.zip\n`, 'a.zip') === zipH);
  check('listedHash 零行为 null', listedHash(`${linH}  b.zip\n`, 'a.zip') === null);
  check('listedHash 两行为 null', listedHash(`${zipH}  a.zip\n${zipH}  a.zip\n`, 'a.zip') === null);
  check('checkChecksums Windows 行不符被拒', checkChecksums(`${linH}  a.zip\n${linH}  b.zip\n`, pins) === false);
  check('checkChecksums linux 行不符被拒', checkChecksums(`${zipH}  a.zip\n${zipH}  b.zip\n`, pins) === false);
  check('checkChecksums 缺 linux 行被拒', checkChecksums(`${zipH}  a.zip\n`, pins) === false);

  check('checkMembers 正例', checkMembers(['pocketbase.exe', 'LICENSE.md', 'CHANGELOG.md']) === true);
  check('checkMembers 缺 pocketbase.exe 被拒', checkMembers(['LICENSE.md']) === false);
  check('checkMembers 子目录里的 pocketbase.exe 不算顶层', checkMembers(['x/pocketbase.exe']) === false);
  check('checkMembers 带 ../ 的成员整份被拒', checkMembers(['pocketbase.exe', '../evil.dll']) === false);
  check('checkMembers 绝对路径被拒', checkMembers(['pocketbase.exe', '/etc/x']) === false);
  check('checkMembers 盘符路径被拒', checkMembers(['pocketbase.exe', 'C:/x']) === false);
  check('checkMembers 反斜杠开头被拒', checkMembers(['pocketbase.exe', '\\x']) === false);
  check('checkMembers 两个 pocketbase.exe 被拒', checkMembers(['pocketbase.exe', 'pocketbase.exe']) === false);

  const ok = results.every(Boolean);
  console.log(ok ? 'FETCH SELF-TEST OK' : 'FETCH SELF-TEST FAIL');
  return ok;
}

// ---------- 下载 ----------

async function download(url, timeoutMs) {
  let current = url;
  for (let hop = 0; hop <= 5; hop++) {
    if (new URL(current).protocol !== 'https:') throw new Error('只允许 https');
    const res = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) throw new Error('跳转缺少地址');
      current = new URL(loc, current).href;
      continue;
    }
    if (res.status !== 200) throw new Error(`下载失败（状态 ${res.status}）`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('跳转次数超过 5 次');
}

function listZipMembers(zipFile) {
  const r = spawnSync('unzip', ['-Z1', zipFile], { encoding: 'utf8', cwd: os.tmpdir(), windowsHide: true });
  if (!r.error && r.status === 0) return r.stdout.split(/\r?\n/);
  const ps = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[IO.Compression.ZipFile]::OpenRead($args[0]); try{$z.Entries|ForEach-Object{$_.FullName}}finally{$z.Dispose()}",
      zipFile,
    ],
    { encoding: 'utf8', cwd: os.tmpdir(), windowsHide: true },
  );
  if (ps.error || ps.status !== 0) throw new Error('无法列出 zip 成员（unzip 和 PowerShell 都不可用）');
  return ps.stdout.split(/\r?\n/);
}

function extractExe(zipFile, outDir) {
  const r = spawnSync('unzip', ['-j', '-o', zipFile, 'pocketbase.exe', '-d', outDir], { encoding: 'utf8', cwd: os.tmpdir(), windowsHide: true });
  if (!r.error && r.status === 0) return;
  const tmpAll = fs.mkdtempSync(path.join(os.tmpdir(), 'usj-pbdl-all-'));
  try {
    const ps = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -LiteralPath $args[0] -DestinationPath $args[1] -Force', zipFile, tmpAll],
      { encoding: 'utf8', cwd: os.tmpdir(), windowsHide: true },
    );
    if (ps.error || ps.status !== 0) throw new Error('解压失败');
    fs.copyFileSync(path.join(tmpAll, 'pocketbase.exe'), path.join(outDir, 'pocketbase.exe'));
  } finally {
    fs.rmSync(tmpAll, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

async function approvedRun() {
  if (fs.existsSync(PB_EXE_PATH)) {
    const have = sha256(fs.readFileSync(PB_EXE_PATH));
    if (PB_EXE_SHA256 && have === PB_EXE_SHA256) {
      console.log('PB ALREADY PRESENT');
      return 0;
    }
    console.error('已有程序与钉死值不符，未下载、未覆盖。');
    return 2;
  }

  const made = [];
  const mk = (prefix) => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(d);
    return d;
  };
  try {
    const zipDir = mk('usj-pbdl-zip-');
    const sumDir = mk('usj-pbdl-sum-');
    const outDir = mk('usj-pbdl-out-');
    const zipBytes = await download(`${BASE_URL}/${ZIP_NAME}`, 180000);
    const sumBytes = await download(`${BASE_URL}/checksums.txt`, 60000);
    const zipFile = path.join(zipDir, ZIP_NAME);
    fs.writeFileSync(zipFile, zipBytes);
    fs.writeFileSync(path.join(sumDir, 'checksums.txt'), sumBytes);

    if (!checkZip(zipBytes)) throw new Error('核对失败：zip 的大小或 sha256 与钉死值不一致，什么都没有解出');
    console.log('PB_ZIP_PINNED_MATCH=yes');
    if (!checkChecksums(sumBytes.toString('utf8'))) throw new Error('核对失败：checksums.txt 里 Windows 或 linux 那一行与钉死值不一致，什么都没有解出');
    console.log('PB_CHECKSUMS_MATCH=yes');
    if (!checkMembers(listZipMembers(zipFile))) throw new Error('核对失败：zip 的成员名单不符合要求，什么都没有解出');
    console.log('PB_MEMBERS_OK=yes');

    extractExe(zipFile, outDir);
    const exe = path.join(outDir, 'pocketbase.exe');
    if (!fs.existsSync(exe)) throw new Error('解压后没有 pocketbase.exe');
    fs.mkdirSync(path.dirname(PB_EXE_PATH), { recursive: true });
    fs.copyFileSync(exe, PB_EXE_PATH);
    const bytes = fs.readFileSync(PB_EXE_PATH);
    console.log(`PB_EXE_SHA256=${sha256(bytes)}`);
    console.log(`PB_EXE_BYTES=${bytes.length}`);
    console.log('PB DOWNLOAD OK');
    return 0;
  } catch (e) {
    console.error(`${e && e.message ? e.message : '下载失败'}；已清理临时文件，没有留下半成品。`);
    return 1;
  } finally {
    for (const d of made) fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

if (isEntry(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === '--self-test' && process.argv.length === 3) {
    process.exit(selfTest() ? 0 : 1);
  } else if (arg === '--approved' && process.argv.length === 3) {
    process.exit(await approvedRun());
  } else {
    console.error('用法：node tools/pb/fetch-local-pb.mjs --self-test | --approved\n需要所有者先批准下载，批准之后才能带 --approved 运行（见 tools/pb/PB-LOCAL.md）。');
    process.exit(2);
  }
}
