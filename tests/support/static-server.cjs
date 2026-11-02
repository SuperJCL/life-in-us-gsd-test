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

const server = http.createServer((req, res) => {
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

// 只绑定回环地址，不绑定 0.0.0.0
server.listen(PORT, '127.0.0.1');
