// OPS-04 / D-09：网页应用清单和主屏图标的文件级检查。只读仓库里的文件，不开浏览器，不联网，
// 在默认套件里运行；真机上的“添加到主屏幕”在 13-15 总体验收里核对。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../support/test';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const siteDir = path.join(repoRoot, 'deploy', 'site');

// 只读 PNG 前 33 字节：签名 8 字节，IHDR 宽高在偏移 16–23，位深在 24，颜色类型在偏移 25
function readPngHeader(file: string): { signature: string; width: number; height: number; colorType: number } {
  const head = readFileSync(file).subarray(0, 33);
  return {
    signature: head.subarray(0, 8).toString('hex'),
    width: head.readUInt32BE(16),
    height: head.readUInt32BE(20),
    colorType: head[25],
  };
}

const PNG_SIGNATURE = '89504e470d0a1a0a';

test('OPS-04 the web app manifest names the app and lists 192, 512 and maskable icons that exist with matching sizes (D-09)', () => {
  const manifest = JSON.parse(readFileSync(path.join(siteDir, 'manifest.webmanifest'), 'utf8'));

  expect(manifest.name).toBe('计划手记');
  expect(manifest.short_name).toBe('计划手记');
  expect(manifest.lang).toBe('zh-CN');
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.background_color).toBe('#F2F5F9');
  expect(manifest.theme_color).toBe('#1B2740');

  // 三个独立条目：any 的 192 和 512，以及单独的 maskable 512（不写 "any maskable"）
  expect(manifest.icons).toEqual([
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]);

  // 清单里的每个图标，以及 iOS 的 180 图标：文件存在、是 PNG、宽高等于声明、颜色类型 2（RGB，无透明通道）
  const expected = [
    ...manifest.icons.map((i: { src: string; sizes: string }) => ({ src: i.src, size: Number(i.sizes.split('x')[0]) })),
    { src: '/icons/apple-touch-icon-180.png', size: 180 },
  ];
  expect(expected).toHaveLength(4);
  for (const { src, size } of expected) {
    const header = readPngHeader(path.join(siteDir, src));
    expect(header.signature, `${src} 的文件头`).toBe(PNG_SIGNATURE);
    expect(header.width, `${src} 的宽`).toBe(size);
    expect(header.height, `${src} 的高`).toBe(size);
    expect(header.colorType, `${src} 的颜色类型`).toBe(2);
  }
});
