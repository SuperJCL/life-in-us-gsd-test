// 零依赖静态服务器：只在 127.0.0.1 提供一个文件（D-14）。
// 白名单之外的路径一律 404，避免把仓库里的其他文件暴露出去。
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// 应用文件固定在仓库根目录，每次请求都重新读取，不缓存
const APP_FILE = path.resolve(__dirname, '..', '..', 'us-journey-tracker.html');
const PORT = Number(process.env.PORT || 4789);

// 应用文件不在 git 仓库里（D-10）。克隆后缺少它时，在 listen 之前就失败，
// 给出清楚的中文提示。提示里只用仓库相对的说法，不打印解析后的绝对路径。
const MISSING_APP_MESSAGE =
  '找不到 us-journey-tracker.html：这个应用文件不在 git 仓库里。请把本地的 us-journey-tracker.html 放到仓库根目录，再运行 npm test（说明见 tests/README.md）。';

if (!fs.existsSync(APP_FILE)) {
  process.stderr.write(MISSING_APP_MESSAGE + '\n');
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

  if (pathname !== '/' && pathname !== '/us-journey-tracker.html') {
    res.writeHead(404);
    res.end();
    return;
  }

  const stream = fs.createReadStream(APP_FILE);
  // 客户端中途断开时立即销毁文件流，不等 GC 释放文件描述符（IN-04）
  res.on('close', () => stream.destroy());
  stream.on('open', () => {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
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
