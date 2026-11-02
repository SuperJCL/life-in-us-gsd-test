import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '../../support/test';
import { APP_FILE_NAME, APP_SHA256, PORT } from '../../support/constants';

// 应用文件固定在仓库根目录；只读，绝不写入
const appFile = path.resolve(__dirname, '..', '..', '..', APP_FILE_NAME);

test('SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline', async () => {
  const digest = createHash('sha256').update(readFileSync(appFile)).digest('hex');
  expect(
    digest,
    'us-journey-tracker.html 与 sha256 基线不一致：应用文件被改动过，本里程碑禁止修改应用',
  ).toBe(APP_SHA256);
});

test('ENV-03 the static server serves only the app file', async ({ request }) => {
  // request 是 Node 侧请求，目标只有 127.0.0.1，不经过浏览器的 guard
  for (const route of ['/', '/us-journey-tracker.html']) {
    const res = await request.get(route);
    expect(res.status(), route).toBe(200);
    expect(res.headers()['content-type'], route).toContain('text/html');
    expect(res.headers()['cache-control'], route).toContain('no-store');
    expect(await res.text(), route).toContain('id="status"');
  }

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
function rawGet(rawPath: string): Promise<{ status: number | undefined; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: rawPath, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
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
    const res = await rawGet(rawPath);
    expect(res.status, rawPath).toBe(404);
    expect(res.body, rawPath).not.toContain('playwright');
  }
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

test('ENV-03 the static server listens on 127.0.0.1 only', async () => {
  // 对照：回环地址能连通，证明服务器在运行，下面的“连不上”不是空转
  expect(await canConnect('127.0.0.1')).toBe(true);

  // 本机自己的非回环 IPv4 地址（局域网地址）：服务器没有绑定它，连接必须失败
  const lanAddresses = Object.values(os.networkInterfaces())
    .flatMap((list) => list ?? [])
    .filter((info) => info.family === 'IPv4' && !info.internal)
    .map((info) => info.address);
  test.skip(lanAddresses.length === 0, '本机没有非回环 IPv4 地址，无法做对照');
  // 有些虚拟网卡上的连接会超时而不是被拒绝，两者都算“没连上”；并行检查，避免串行等待
  const results = await Promise.all(lanAddresses.map((address) => canConnect(address)));
  expect(results, '服务器不应监听任何非回环地址').toEqual(lanAddresses.map(() => false));

  // IPv6 回环同样不应连通（服务器只绑定 IPv4 的 127.0.0.1）
  expect(await canConnect('::1')).toBe(false);
});
