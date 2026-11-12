import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { APP_FILE_NAME, APP_SHA256, PB_SDK_PATH, PB_SDK_SHA256, PORT } from '../../support/constants';

// 应用文件固定在仓库根目录；只读，绝不写入
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const appFile = path.resolve(repoRoot, APP_FILE_NAME);
// 同源提供的 SDK 和它的钉死哈希清单：只读，绝不写入
const sdkDir = path.resolve(repoRoot, 'tools', 'probe', 'page', 'vendor');

test('SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline', async () => {
  const digest = createHash('sha256').update(readFileSync(appFile)).digest('hex');
  expect(
    digest,
    '应用与基线不一致：确认改动是有意的之后，在同一次提交里更新 tests/support/constants.ts 的 APP_SHA256',
  ).toBe(APP_SHA256);
});

// 反向对照（TEST-01）：证明基线护栏不是空转。原样的哈希等于基线；
// 内存里把最后一个字节异或 1 之后哈希就对不上，也就是改了应用却没更新基线时 SAFE-02 会失败。只在内存里做，不写盘。
test('SAFE-02 a one-byte change to the app no longer matches the baseline', async () => {
  const original = readFileSync(appFile);
  expect(createHash('sha256').update(original).digest('hex'), '对照：原样的应用应当等于基线').toBe(APP_SHA256);

  const changed = Buffer.from(original);
  changed[changed.length - 1] ^= 1;
  expect(createHash('sha256').update(changed).digest('hex'), '改一个字节之后哈希不应等于基线').not.toBe(APP_SHA256);

  // 内存副本和磁盘文件互不影响：磁盘上的文件仍是原样
  expect(createHash('sha256').update(readFileSync(appFile)).digest('hex')).toBe(APP_SHA256);
});

test('ENV-03 the static server serves only the app file and the pinned SDK', async ({ request }) => {
  // request 是 Node 侧请求，目标只有 127.0.0.1，不经过浏览器的 guard
  for (const route of ['/', '/us-journey-tracker.html']) {
    const res = await request.get(route);
    expect(res.status(), route).toBe(200);
    expect(res.headers()['content-type'], route).toContain('text/html');
    expect(res.headers()['cache-control'], route).toContain('no-store');
    expect(await res.text(), route).toContain('id="status"');
  }

  // 固定版本的 SDK：类型、nosniff、no-store，正文的 sha256 等于常量，也等于 SHA256SUMS 里的值
  const sdk = await request.get(PB_SDK_PATH);
  expect(sdk.status(), PB_SDK_PATH).toBe(200);
  expect(sdk.headers()['content-type'], PB_SDK_PATH).toContain('javascript');
  expect(sdk.headers()['x-content-type-options'], PB_SDK_PATH).toBe('nosniff');
  expect(sdk.headers()['cache-control'], PB_SDK_PATH).toContain('no-store');
  const served = createHash('sha256').update(await sdk.body()).digest('hex');
  expect(served, 'SDK 正文的哈希应当等于 PB_SDK_SHA256').toBe(PB_SDK_SHA256);
  const sums = readFileSync(path.join(sdkDir, 'SHA256SUMS'), 'utf8');
  expect(sums, 'SHA256SUMS 里应当有同一个哈希').toContain(PB_SDK_SHA256 + '  pocketbase.iife.js');

  // 白名单之外的路径一律 404，包括编码后的 ..（原始路径是否到达服务器见下一个用例）
  for (const route of [
    '/package.json',
    '/tests/support/static-server.cjs',
    '/.git/config',
    '/favicon.ico',
    '/%2e%2e/package.json',
  ]) {
    const res = await request.get(route);
    expect(res.status(), route).toBe(404);
  }
});

// 原始 HTTP 请求：node:http 不会规范化路径，所以 %2e%2e 和 .. 会原样到达服务器。
// 浏览器和 request fixture 的客户端可能先把它规范化成 /package.json，那样就测不到穿越处理了
// 同样可以指定方法和 Host 头：连接始终只发往 127.0.0.1:PORT，headers.host 只改变请求头里声明的主机名
function rawRequest(opts: {
  path: string;
  method?: string;
  host?: string;
}): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: opts.path,
        method: opts.method ?? 'GET',
        ...(opts.host !== undefined ? { headers: { host: opts.host } } : {}),
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('ENV-03 raw traversal paths reach the static server and are refused', async () => {
  for (const rawPath of [
    '/%2e%2e/package.json',
    '/%2E%2E/package.json',
    '/../package.json',
    '/..%2fpackage.json',
    '/us-journey-tracker.html/../package.json',
    '/%2e%2e/%2e%2e/.git/config',
  ]) {
    const res = await rawRequest({ path: rawPath });
    expect(res.status, rawPath).toBe(404);
    expect(res.body, rawPath).not.toContain('playwright');
  }
});

// WR-01：Host 白名单和方法限制。所有请求都只发往 127.0.0.1:PORT，不碰任何外部主机
test('ENV-03 the static server refuses foreign Host headers and non-GET methods', async () => {
  // 伪造的 Host：421，并且正文不能带出应用内容
  for (const host of ['evil.example', `evil.example:${PORT}`]) {
    const res = await rawRequest({ path: '/', host });
    expect(res.status, host).toBe(421);
    expect(res.body, host).not.toContain('id="status"');
  }

  // 对照：合法的 Host 能拿到应用，证明上面的 421 不是服务器整体坏了
  const control = await rawRequest({ path: '/', host: `127.0.0.1:${PORT}` });
  expect(control.status).toBe(200);
  expect(control.body).toContain('id="status"');

  // localhost 也必须放行：PROBE-2a 的对照浏览器依赖它
  const localhost = await rawRequest({ path: '/', host: `localhost:${PORT}` });
  expect(localhost.status).toBe(200);

  // 非 GET/HEAD 方法：405（Host 合法，排除是 Host 检查造成的 405）
  for (const method of ['POST', 'PUT', 'DELETE']) {
    const res = await rawRequest({ path: '/', method, host: `127.0.0.1:${PORT}` });
    expect(res.status, method).toBe(405);
  }

  // HEAD：200，正文为空
  const head = await rawRequest({ path: '/', method: 'HEAD', host: `127.0.0.1:${PORT}` });
  expect(head.status).toBe(200);
  expect(head.body).toBe('');
});

// 尝试连接到某个地址，返回是否连通（只连本机自己的地址，不碰外部主机）
function canConnect(host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port: PORT });
    const done = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1500, () => done(false));
    socket.on('connect', () => done(true));
    socket.on('error', () => done(false));
  });
}

test('ENV-03 the static server listens on 127.0.0.1 only', async ({}, testInfo) => {
  // 对照：回环地址能连通，证明服务器在运行，下面的“连不上”不是空转
  expect(await canConnect('127.0.0.1')).toBe(true);

  // 本机自己的非回环 IPv4 地址（局域网地址）：服务器没有绑定它，连接必须失败
  const lanAddresses = Object.values(os.networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((info) => info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);
  // 不在中途跳过整个用例（IN-03）：没有局域网地址时只记一条 note，其余检查照常执行
  if (lanAddresses.length > 0) {
    // 有些虚拟网卡上的连接会超时而不是被拒绝，两者都算“没连上”；并行检查，避免串行等待
    const results = await Promise.all(lanAddresses.map((address) => canConnect(address)));
    expect(results, '服务器不应监听任何非回环地址').toEqual(lanAddresses.map(() => false));
  } else {
    testInfo.annotations.push({
      type: 'note',
      description: '本机没有非回环 IPv4 地址，局域网对照没有执行',
    });
  }

  // IPv6 回环同样不应连通（服务器只绑定 IPv4 的 127.0.0.1）。
  // 这是弱断言：本机禁用了 IPv6 时“连不上”不能证明服务器没监听 ::1，只能说明没有回归到监听 IPv6
  expect(await canConnect('::1')).toBe(false);
});

// 空闲端口：先绑定 127.0.0.1:0 取得端口再关掉，交给临时副本的静态服务器用
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

// 在临时目录里按仓库的相对结构搭一份静态服务器、应用文件、sw.js、SHA256SUMS 和 SDK；
// flipSdk 为真时把 SDK 的最后一个字节异或 1。仓库里的文件一个字节都不改。
function buildCopy(flipSdk: boolean): { dir: string; serverFile: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'usj-static-'));
  const serverDir = path.join(dir, 'tests', 'support');
  const vendorDir = path.join(dir, 'tools', 'probe', 'page', 'vendor');
  mkdirSync(serverDir, { recursive: true });
  mkdirSync(vendorDir, { recursive: true });
  cpSync(path.join(repoRoot, 'tests', 'support', 'static-server.cjs'), path.join(serverDir, 'static-server.cjs'));
  cpSync(appFile, path.join(dir, APP_FILE_NAME));
  // 静态服务器启动时还要核对 deploy/site/sw.js（OPS-04、D-07）：副本里放一份，拒绝启动的原因才只会是 SDK 哈希
  mkdirSync(path.join(dir, 'deploy', 'site'), { recursive: true });
  cpSync(path.join(repoRoot, 'deploy', 'site', 'sw.js'), path.join(dir, 'deploy', 'site', 'sw.js'));
  cpSync(path.join(sdkDir, 'SHA256SUMS'), path.join(vendorDir, 'SHA256SUMS'));
  const sdkBytes = Buffer.from(readFileSync(path.join(sdkDir, 'pocketbase.iife.js')));
  if (flipSdk) sdkBytes[sdkBytes.length - 1] ^= 1;
  writeFileSync(path.join(vendorDir, 'pocketbase.iife.js'), sdkBytes);
  return { dir, serverFile: path.join(serverDir, 'static-server.cjs') };
}

// 反向对照（T-08-06）：SDK 被改一个字节时，静态服务器在 listen 之前退出 1，提示是中文、只用仓库相对的说法。
// 同一个用例里先让未改动的副本正常启动，证明拒绝是哈希不一致造成的，而不是副本本身搭坏了。
test('ENV-03 the static server refuses to start when the SDK bytes differ from SHA256SUMS', async () => {
  const dirs: string[] = [];
  try {
    // 对照：未改动的副本能启动并提供 SDK
    const good = buildCopy(false);
    dirs.push(good.dir);
    const goodPort = await freePort();
    const goodChild = spawn(process.execPath, [good.serverFile], {
      env: { ...process.env, PORT: String(goodPort) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    try {
      await expect
        .poll(
          () =>
            new Promise<number | undefined>((resolve) => {
              http
                .get({ host: '127.0.0.1', port: goodPort, path: PB_SDK_PATH }, (res) => {
                  res.resume();
                  resolve(res.statusCode);
                })
                .on('error', () => resolve(undefined));
            }),
          { message: '未改动的副本应当能启动并提供 SDK' },
        )
        .toBe(200);
    } finally {
      goodChild.kill();
    }

    // 改过一个字节的副本：必须退出 1
    const bad = buildCopy(true);
    dirs.push(bad.dir);
    const badChild = spawn(process.execPath, [bad.serverFile], {
      env: { ...process.env, PORT: String(await freePort()) },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    badChild.stderr.setEncoding('utf8');
    badChild.stderr.on('data', (chunk) => (stderr += chunk));
    const exitCode = await new Promise<number | null>((resolve) => {
      // 服务器如果没有拒绝启动就不会退出：超时后杀掉，退出码为 null，下面的断言会失败
      const timer = setTimeout(() => {
        badChild.kill();
        resolve(null);
      }, 8000);
      badChild.on('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
    });
    expect(exitCode, '改过一个字节的 SDK 应当让静态服务器退出 1').toBe(1);
    expect(stderr).toContain('SHA256SUMS');
    expect(stderr, '提示里不应出现临时目录的绝对路径').not.toContain(bad.dir);
    expect(stderr, '提示里不应出现仓库的绝对路径').not.toContain(repoRoot);
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
});
