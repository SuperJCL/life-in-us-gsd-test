// 主屏图标的一次性生成脚本（D-09）：运行一次，把 4 个 PNG 提交进仓库，之后不再需要运行。
//
// 只用已装的 @playwright/test 和本机 Edge（channel: 'msedge'），不下载浏览器，不用任何外部素材。
// 浏览器网络全部挡住：launch 参数沿用 playwright.config.ts 的 --host-resolver-rules 和死代理，
// 页面里再加 page.route('**', r => r.abort())；图标用 page.setContent 渲染，不访问任何地址。
// 进程以低优先级（below normal）运行，避免拖慢本机。
//
// 渲染方式：背景 #1B2740（页面的 --ink），正中一个白色「记」字，字重 800，
// 字体栈 "Noto Serif SC","Songti SC","STSong","SimSun","Microsoft YaHei",serif。
// 视口等于目标尺寸，deviceScaleFactor 1。字号占边长 0.62；可遮罩图标占 0.5（字形落在中心 80% 的安全圆内）。
// 如果截图带透明通道（PNG 颜色类型不是 2），用 node:zlib 解出像素、去掉 alpha、按颜色类型 2 重新编码，
// 保证 iOS 主屏图标不透明。
//
// 用法：node deploy/make-icons.mjs
// 输出：deploy/site/icons/ 下的 icon-192.png、icon-512.png、icon-maskable-512.png、apple-touch-icon-180.png
// 退出码：0 成功；1 渲染或写文件失败。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch (e) {
  // 设置失败不影响渲染
}

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'site', 'icons');

const INK = '#1B2740';
const FONT = '"Noto Serif SC","Songti SC","STSong","SimSun","Microsoft YaHei",serif';

const ICONS = [
  { file: 'icon-192.png', size: 192, ratio: 0.62 },
  { file: 'icon-512.png', size: 512, ratio: 0.62 },
  { file: 'icon-maskable-512.png', size: 512, ratio: 0.5 },
  { file: 'apple-touch-icon-180.png', size: 180, ratio: 0.62 },
];

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// 解析 PNG：返回宽、高、颜色类型和按块拼接后的 IDAT 数据
function parsePng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('不是 PNG');
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  return { width, height, depth, colorType, idat: Buffer.concat(idat) };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

// 去 alpha：颜色类型 6（RGBA，8 位）解滤波后丢掉 alpha，再按颜色类型 2（RGB）编码
function toRgb(buf) {
  const png = parsePng(buf);
  if (png.colorType === 2) return buf;
  if (png.colorType !== 6 || png.depth !== 8) throw new Error(`不支持的 PNG：颜色类型 ${png.colorType}，位深 ${png.depth}`);
  const raw = zlib.inflateSync(png.idat);
  const bpp = 4;
  const stride = png.width * bpp;
  const px = Buffer.alloc(stride * png.height);
  for (let y = 0; y < png.height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      px[y * stride + x] = v & 0xff;
    }
  }
  const out = Buffer.alloc((png.width * 3 + 1) * png.height);
  for (let y = 0; y < png.height; y++) {
    out[y * (png.width * 3 + 1)] = 0;
    for (let x = 0; x < png.width; x++) {
      const s = y * stride + x * 4;
      const d = y * (png.width * 3 + 1) + 1 + x * 3;
      out[d] = px[s];
      out[d + 1] = px[s + 1];
      out[d + 2] = px[s + 2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(png.width, 0);
  ihdr.writeUInt32BE(png.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(out, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function pageHtml(size, ratio) {
  const fontSize = Math.round(size * ratio);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:${INK};overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
span{color:#FFFFFF;font:800 ${fontSize}px/1 ${FONT};display:block}
</style></head><body><span>记</span></body></html>`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'],
    proxy: { server: 'http://127.0.0.1:9', bypass: '127.0.0.1,localhost' },
  });
  try {
    for (const icon of ICONS) {
      const context = await browser.newContext({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.route('**', (r) => r.abort());
      await page.setContent(pageHtml(icon.size, icon.ratio));
      await page.evaluate(() => document.fonts.ready);
      const shot = await page.screenshot({ type: 'png' });
      await context.close();
      const png = toRgb(shot);
      const info = parsePng(png);
      if (info.width !== icon.size || info.height !== icon.size || info.colorType !== 2) {
        throw new Error(`${icon.file} 尺寸或颜色类型不对：${info.width}x${info.height} 类型 ${info.colorType}`);
      }
      fs.writeFileSync(path.join(outDir, icon.file), png);
      process.stdout.write(`${icon.file} ${info.width}x${info.height} 颜色类型 ${info.colorType} ${png.length} 字节${png === shot ? '' : '（已去 alpha）'}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  process.stderr.write(`图标生成失败：${e && e.message}\n`);
  process.exit(1);
});
