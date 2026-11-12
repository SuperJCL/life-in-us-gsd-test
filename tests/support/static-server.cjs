// 零依赖静态服务器：只在 127.0.0.1 提供应用文件和固定版本的 SDK 两个文件（D-14、08-02）。
// 白名单之外的路径一律 404，避免把仓库里的其他文件暴露出去。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// 应用文件固定在仓库根目录，每次请求都重新读取，不缓存
const APP_FILE = path.resolve(__dirname, '..', '..', 'us-journey-tracker.html');
const PORT = Number(process.env.PORT || 4789);

// 同源提供的真实 PocketBase SDK：直接读 tools/probe/page/vendor/ 里那一份，不复制第二份，
// 所以 sha256 的钉子只有一个（SHA256SUMS）。
const SDK_PATH = '/vendor/pocketbase.iife.js';
const SDK_NAME = 'pocketbase.iife.js';
const SDK_DIR = path.resolve(__dirname, '..', '..', 'tools', 'probe', 'page', 'vendor');
const SDK_FILE = path.join(SDK_DIR, SDK_NAME);
const SDK_SUMS = path.join(SDK_DIR, 'SHA256SUMS');

// 云端页面注册的 Service Worker（OPS-04、D-07）：直接读 deploy/site/sw.js，不复制第二份；
// 版本占位 __BUILD_VERSION__ 在每次响应里换成内存里的版本（默认 test），所以缓存名固定为 usj-shell-test。
const SW_PATH = '/sw.js';
const SW_PLACEHOLDER = '__BUILD_VERSION__';
const SITE_DIR = path.resolve(__dirname, '..', '..', 'deploy', 'site');
const SW_FILE = path.join(SITE_DIR, 'sw.js');
let swVersion = 'test';

// 应用文件随仓库提供（Phase 7 起），缺少它说明工作区不完整。缺少时在 listen 之前就失败，
// 给出清楚的中文提示。提示里只用仓库相对的说法，不打印解析后的绝对路径。
const MISSING_APP_MESSAGE =
  '找不到 us-journey-tracker.html：这个应用文件本应随仓库检出，说明工作区不完整。请检查检出是否完整（例如运行 git status），恢复仓库根目录的 us-journey-tracker.html 后再运行 npm test（说明见 tests/README.md）。';

if (!fs.existsSync(APP_FILE)) {
  process.stderr.write(MISSING_APP_MESSAGE + '\n');
  process.exit(1);
}

// 启动时核对 SDK 的 sha256：钉死值来自 SHA256SUMS（必须恰好一行）。
// 文件缺失、行数不对或哈希不一致都在 listen 之前失败，提示里只用仓库相对的说法，不打印绝对路径。
const SDK_REFUSE_MESSAGE =
  '同源 SDK 文件与 tools/probe/page/vendor/SHA256SUMS 的钉死值不一致，已拒绝启动；不要修改这个文件，换版本要重新走所有者批准。';
const SDK_MISSING_MESSAGE =
  '找不到 tools/probe/page/vendor/ 下的 SDK 文件或 SHA256SUMS，已拒绝启动；请检查检出是否完整，恢复这两个文件后再运行测试。';

function verifySdk() {
  if (!fs.existsSync(SDK_FILE) || !fs.existsSync(SDK_SUMS)) return SDK_MISSING_MESSAGE;
  const lines = fs
    .readFileSync(SDK_SUMS, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([0-9a-f]{64})[ \t]+\*?(\S+)[ \t]*$/))
    .filter((m) => m && m[2] === SDK_NAME);
  if (lines.length !== 1) return SDK_REFUSE_MESSAGE;
  const digest = crypto.createHash('sha256').update(fs.readFileSync(SDK_FILE)).digest('hex');
  return digest === lines[0][1] ? null : SDK_REFUSE_MESSAGE;
}

// 启动时核对 sw.js 存在且版本占位恰好出现一次；否则在 listen 之前失败，提示里只用仓库相对的说法。
const SW_PROBLEM_MESSAGE =
  'deploy/site/sw.js 缺失或其中的版本占位不是恰好一处，已拒绝启动；请检查检出是否完整，恢复这个文件后再运行测试。';

function verifySw() {
  if (!fs.existsSync(SW_FILE)) return SW_PROBLEM_MESSAGE;
  const text = fs.readFileSync(SW_FILE, 'utf8');
  return text.split(SW_PLACEHOLDER).length === 2 ? null : SW_PROBLEM_MESSAGE;
}

const swProblem = verifySw();
if (swProblem) {
  process.stderr.write(swProblem + '\n');
  process.exit(1);
}

const sdkProblem = verifySdk();
if (sdkProblem) {
  process.stderr.write(sdkProblem + '\n');
  process.exit(1);
}

// Host 头白名单（WR-01）。只绑定 127.0.0.1 能挡住局域网访问，却挡不住 DNS rebinding：
// 被重绑定到 127.0.0.1 的恶意页面，发来的 Host 是它自己控制的域名。
// 所以只接受这两个 Host，其余一律 421。localhost 要保留：PROBE-2a 的对照浏览器用它连到本机。
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

const server = http.createServer((req, res) => {
  // 只读服务：只接受 GET 和 HEAD，其余方法返回 405，不读文件
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }

  // Host 不在白名单里返回 421，不读文件（不区分大小写）
  if (!ALLOWED_HOSTS.has(String(req.headers.host).toLowerCase())) {
    res.writeHead(421);
    res.end();
    return;
  }

  let pathname = '';
  try {
    pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
  } catch (e) {
    pathname = '';
  }

  let file = '';
  let headers = null;
  if (pathname === '/' || pathname === '/us-journey-tracker.html') {
    file = APP_FILE;
    headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' };
  } else if (pathname === SDK_PATH) {
    file = SDK_FILE;
    headers = {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    };
  } else if (pathname === SW_PATH) {
    // 每次都读文件并换版本，不缓存；占位在文件里恰好一处（启动时已核对）
    let body;
    try {
      body = fs.readFileSync(SW_FILE, 'utf8').split(SW_PLACEHOLDER).join(swVersion);
    } catch (e) {
      res.writeHead(500);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  } else {
    res.writeHead(404);
    res.end();
    return;
  }

  const stream = fs.createReadStream(file);
  // 客户端中途断开时立即销毁文件流，不等 GC 释放文件描述符（IN-04）
  res.on('close', () => stream.destroy());
  stream.on('open', () => {
    res.writeHead(200, headers);
    stream.pipe(res);
  });
  stream.on('error', () => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

// 启动失败（例如端口被占用）时只给中文提示和错误码，不打印堆栈和解析后的绝对路径（IN-04）
server.on('error', (e) => {
  process.stderr.write(`静态服务器启动失败：${e && e.code}\n`);
  process.exit(1);
});

// 只绑定回环地址，不绑定 0.0.0.0
server.listen(PORT, '127.0.0.1');
