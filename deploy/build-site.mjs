#!/usr/bin/env node
// 站点构建脚本（SEC-02、OPS-04）：从仓库里的单文件页面生成发布版页面、nginx 的 CSP 头文件和带版本号的 sw.js，
// 供 13-07 的 nginx 安装和 13-10、13-11 的上传使用。零依赖，只使用 node: 内置模块。
//
// 用法：
//   node deploy/build-site.mjs [--out <目录>]   构建；缺省输出到 private/deploy-out
//   node deploy/build-site.mjs --self-test      内存里的合成输入自检，不读 private/，不写磁盘
//
// 输出（目录先清空再重建）：
//   site/index.html                发布版页面：仓库页面加一个单独的内联小脚本，只放云端开关
//   server/nginx/usj-csp.conf      一行 add_header Content-Security-Policy ...（哈希就是上面这个页面里的内联块算出来的）
//
// 为什么页面和 CSP 头要出自同一次构建：策略里放行内联脚本和样式靠 sha256 哈希，页面里的内联块只要差一个字节，
// 浏览器就会拦下它（白屏）。构建时从最终页面的内联块算哈希并写进头文件，部署时两者一起换。
// 浏览器算哈希之前会把换行归一成 LF，所以这里也按归一后的文字算；输出的页面本身统一写成 LF。
//
// 隐私约定：输出不含域名、地址和任何密钥；云端开关只有 backend，服务器地址由页面运行时取 location.origin。
// 只打印计数、版本号和固定文案，不打印页面内容。
//
// 退出码：0 成功；1 构建失败；2 参数或输出目录不合法。

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APP_PATH = 'us-journey-tracker.html';
const SW_PATH = 'deploy/site/sw.js';
const MANIFEST_PATH = 'deploy/site/manifest.webmanifest';
const ICON_DIR = 'deploy/site/icons';
const SDK_FILE = 'pocketbase.iife.js';
const SDK_DIR = 'tools/probe/page/vendor';
const PLACEHOLDER = '__BUILD_VERSION__';

// 外壳里 4 个主屏图标的文件名，同时是计入版本号的顺序
export const ICON_NAMES = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon-180.png'];

// 脚本自己写的固定文案才会被打印；其他错误顶层只打印固定文字
export class BuildError extends Error {}
export class UsageError extends Error {}

// ---------- 纯函数 ----------

// \r\n 和单独的 \r 都换成 \n：浏览器解析 HTML 之前做同样的归一化，哈希必须按归一后的文字算
export const normalizeNl = (t) => t.replace(/\r\n?/g, '\n');

// 返回可以直接放进 CSP 的哈希源：'sha256-<base64>'（带单引号）
export const cspHash = (text) => `'sha256-${createHash('sha256').update(normalizeNl(text), 'utf8').digest('base64')}'`;

// 所有不带 src 属性的 <script>/<style> 的内容（标签之间的原文，含首尾换行）
export function inlineBlocks(html, tag) {
  const re = new RegExp(`<${tag}(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
  return [...normalizeNl(html).matchAll(re)].map((m) => m[1]);
}

// 云端开关：在主内联脚本之前插入一个单独的小内联脚本。锚点是“单独一行的 <script>”，必须恰好一处。
// 仓库里的页面保持本地版（不带这行），所以 APP_SHA256 仍然指仓库文件。
export const CONFIG_LINE ='<script>window.USJ_CONFIG={backend:"pocketbase"};</script>';
export function injectConfig(html) {
  const text = normalizeNl(html);
  const n = (text.match(/^<script>$/gm) || []).length;
  if (n !== 1) throw new BuildError(`锚点（单独一行的 <script>）出现了 ${n} 次，应当恰好 1 次`);
  return text.replace(/^<script>$/m, () => `${CONFIG_LINE}\n<script>`);
}

// 策略字符串：指令顺序固定，没有任何 unsafe- 开头的关键字
export function buildCsp({ scripts, styles }) {
  return [
    "default-src 'none'",
    `script-src 'self' ${scripts.join(' ')}`.trim(),
    styles.length > 0 ? `style-src ${styles.join(' ')}` : "style-src 'none'",
    "style-src-attr 'none'",
    "connect-src 'self'",
    "img-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// nginx 头文件的两行：中文注释加 add_header
export function cspConf(policy) {
  return `# 由 deploy/build-site.mjs 生成，勿手改；页面的内联脚本和样式改了就必须重新构建\nadd_header Content-Security-Policy "${policy}" always;\n`;
}

// 外壳版本号：页面、SDK、清单、4 个图标按固定顺序喂给同一个 sha256，取十六进制前 12 位。
// 外壳变了版本就变（旧页面不会配新缓存）；同一个构建部署两次版本不变（不会出现更新提示）。
export function shellVersion({ indexHtml, sdk, manifest, icons }) {
  const h = createHash('sha256');
  h.update(Buffer.from(indexHtml, 'utf8'));
  h.update(sdk);
  h.update(Buffer.from(manifest, 'utf8'));
  for (const name of ICON_NAMES) h.update(icons[name]);
  return h.digest('hex').slice(0, 12);
}

// 校验文件里 SDK 那一行的哈希：接受两个空格和空格加星号两种分隔
export function sdkPinnedHash(sums) {
  for (const line of normalizeNl(sums).split('\n')) {
    const m = /^([0-9a-f]{64}) [ *](\S+)$/.exec(line.trim());
    if (m && m[2] === SDK_FILE) return m[1];
  }
  throw new BuildError('SDK 校验文件里没有 SDK 那一行');
}

// 输出目录里除 SHA256SUMS 自己以外的每个文件：<hash>  <相对路径>，按路径排序，LF
export function sumsOf(files) {
  return (
    Object.keys(files)
      .filter((n) => n !== 'SHA256SUMS')
      .sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))
      .map((n) => `${sha256Hex(typeof files[n] === 'string' ? Buffer.from(files[n], 'utf8') : files[n])}  ${n}\n`)
      .join('')
  );
}

// 纯函数：输入都是内存里的文本和字节，输出是 { 相对路径: 文本或字节 }；文本一律 LF
export function buildSite({ html, sw, manifest, icons, sdk, sdkSums }) {
  const indexHtml = injectConfig(html);
  const scripts = inlineBlocks(indexHtml, 'script').map(cspHash);
  const styles = inlineBlocks(indexHtml, 'style').map(cspHash);
  const cspHeader = buildCsp({ scripts, styles });
  const cspConfText = cspConf(cspHeader);

  if (sha256Hex(sdk) !== sdkPinnedHash(sdkSums)) throw new BuildError('SDK 与钉死的 sha256 不符');
  for (const name of ICON_NAMES) if (!icons || !Buffer.isBuffer(icons[name])) throw new BuildError(`缺少图标 ${name}`);
  const swText = normalizeNl(sw);
  const slots = swText.split(PLACEHOLDER).length - 1;
  if (slots !== 1) throw new BuildError(`sw.js 里的版本占位出现了 ${slots} 次，应当恰好 1 次`);
  const manifestText = normalizeNl(manifest);
  const version = shellVersion({ indexHtml, sdk, manifest: manifestText, icons });

  const files = {
    'site/index.html': indexHtml,
    'site/sw.js': swText.replace(PLACEHOLDER, () => version),
    'site/manifest.webmanifest': manifestText,
    'site/vendor/pocketbase.iife.js': sdk,
    'site/vendor/SHA256SUMS': normalizeNl(sdkSums),
    'server/nginx/usj-csp.conf': cspConfText,
    BUILD_VERSION: `${version}\n`,
  };
  for (const name of ICON_NAMES) files[`site/icons/${name}`] = icons[name];
  files.SHA256SUMS = sumsOf(files);
  return { indexHtml, scripts, styles, cspHeader, cspConfText, version, files };
}

// ---------- 输出目录 ----------

// 只接受恰好 private/deploy-out，或 test-results/ 下的目录；仓库外、.. 逃逸、仓库根和 deploy 等一律拒绝（退出 2）。
// private/deploy-out 写之前用 git check-ignore 确认被忽略（输出可能和真实站点文件放在一起，不能进 git）。
export function checkOutDir(dir, repoRoot = ROOT) {
  const rel = relative(repoRoot, resolve(dir)).split(sep).join('/');
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) throw new UsageError('输出目录必须在仓库内');
  if (rel !== 'private/deploy-out' && !rel.startsWith('test-results/')) {
    throw new UsageError('输出目录只能是 private/deploy-out 或 test-results/ 下的目录');
  }
  if (rel === 'private/deploy-out') {
    try {
      execFileSync('git', ['check-ignore', '-q', rel], { cwd: repoRoot, stdio: 'ignore' });
    } catch {
      throw new UsageError('private/deploy-out 没有被 git 忽略，拒绝写入');
    }
  }
  return rel;
}

export function parseArgs(args) {
  const opts = { out: 'private/deploy-out', selfTest: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--self-test') opts.selfTest = true;
    else if (args[i] === '--out' && i + 1 < args.length) opts.out = args[++i];
    else throw new UsageError('参数不合法：用法见文件头');
  }
  return opts;
}

// ---------- 自检 ----------

const sha256Hex = (data) => createHash('sha256').update(data).digest('hex');

// 内存里的合成输入：不读 private/，不写磁盘
const SYN_HTML =
  '<!DOCTYPE html>\n<html><head>\n<style>\nbody{color:#111}\n</style>\n</head><body>\n<script src="/vendor/synth.js" integrity="sha256-synth"></script>\n<script>\nalert(1)\n</script>\n</body></html>\n';
const SYN_SW = "const V = '__BUILD_VERSION__', CACHE = 'synth-' + V;\n";
function synthInputs(over = {}) {
  const sdk = Buffer.from('synth-sdk');
  return {
    html: SYN_HTML,
    sw: SYN_SW,
    manifest: '{"name":"synth"}\n',
    icons: Object.fromEntries(ICON_NAMES.map((n, i) => [n, Buffer.from(`synth-icon-${i}`)])),
    sdk,
    sdkSums: `${sha256Hex(sdk)}  pocketbase.iife.js\n`,
    ...over,
  };
}
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};
const bytes = (v) => (Buffer.isBuffer(v) ? v : Buffer.from(v));

export function selfTest() {
  const results = [];
  const expect = (name, fn) => {
    let ok = false;
    try {
      ok = fn() === true;
    } catch {
      ok = false;
    }
    results.push([name, ok]);
  };
  const a = () => buildSite(synthInputs());
  expect('cspHash：已知输入 alert(1) 的哈希', () => cspHash('alert(1)') === "'sha256-bhHHL3z2vDgxUt0W3dWQOrprscmda2Y5pLsLg4GF+pI='");
  expect('cspHash：CRLF 和 LF 两种页面算出同样的哈希', () => {
    const crlf = SYN_HTML.replace(/\n/g, '\r\n');
    const hashes = (h, tag) => inlineBlocks(h, tag).map(cspHash).join();
    return hashes(crlf, 'script') === hashes(SYN_HTML, 'script') && hashes(crlf, 'style') === hashes(SYN_HTML, 'style');
  });
  expect('inlineBlocks：带 src 的 script 不算内联块', () => inlineBlocks(SYN_HTML, 'script').length === 1 && inlineBlocks(SYN_HTML, 'style').length === 1);
  expect('injectConfig：锚点缺失时抛错', () => throws(() => injectConfig('<html><script src="/x.js"></script></html>\n')));
  expect('injectConfig：锚点重复时抛错', () => throws(() => injectConfig('<script>\na\n</script>\n<script>\nb\n</script>\n')));
  expect('buildSite：构建后的页面恰好一处配置脚本', () => a().indexHtml.split(CONFIG_LINE).length === 2);
  expect('buildSite：配置脚本排在主内联脚本之前，两个脚本哈希都在策略里', () => {
    const b = a();
    return b.indexHtml.indexOf(CONFIG_LINE) < b.indexHtml.indexOf('alert(1)') && b.scripts.length === 2 && b.scripts.every((h) => b.cspHeader.includes(h));
  });
  expect('buildCsp：含必需的指令', () => {
    const p = a().cspHeader;
    return ["style-src-attr 'none'", "frame-ancestors 'none'", "default-src 'none'", "base-uri 'none'", "object-src 'none'", "connect-src 'self'"].every((d) => p.includes(d));
  });
  expect('buildCsp：不含 unsafe- 开头的关键字', () => !a().cspHeader.includes('unsafe-'));
  expect('cspConf：一行注释加一行 add_header', () => {
    const lines = a().cspConfText.trimEnd().split('\n');
    return lines.length === 2 && lines[0].startsWith('#') && lines[1].startsWith('add_header Content-Security-Policy "') && lines[1].endsWith('" always;');
  });
  expect('确定性：同一输入两次构建，页面、sw.js、头文件、SHA256SUMS 逐字节相同', () => {
    const x = a();
    const y = a();
    return ['site/index.html', 'site/sw.js', 'server/nginx/usj-csp.conf', 'SHA256SUMS', 'BUILD_VERSION'].every((n) => x.files[n] !== undefined && Buffer.compare(bytes(x.files[n]), bytes(y.files[n])) === 0);
  });
  expect('版本：12 位十六进制，写进 sw.js 和 BUILD_VERSION', () => {
    const b = a();
    return /^[0-9a-f]{12}$/.test(b.version) && b.files['site/sw.js'].includes(b.version) && !b.files['site/sw.js'].includes('__BUILD_VERSION__') && b.files.BUILD_VERSION === `${b.version}\n`;
  });
  expect('版本：内联脚本改一个字符后脚本哈希和版本号都变', () => {
    const b = buildSite(synthInputs({ html: SYN_HTML.replace('alert(1)', 'alert(2)') }));
    return b.version !== a().version && b.cspHeader !== a().cspHeader;
  });
  expect('版本：只改一个图标字节时版本号变，CSP 不变', () => {
    const inputs = synthInputs();
    inputs.icons['icon-512.png'] = Buffer.from('synth-icon-X');
    const b = buildSite(inputs);
    return b.version !== a().version && b.cspHeader === a().cspHeader;
  });
  expect('sw 模板：没有占位时抛错', () => throws(() => buildSite(synthInputs({ sw: "const V = 'x';\n" }))));
  expect('sw 模板：有两个占位时抛错', () => throws(() => buildSite(synthInputs({ sw: '__BUILD_VERSION__ __BUILD_VERSION__\n' }))));
  expect('SDK：字节与钉死值不符时抛错', () => throws(() => buildSite(synthInputs({ sdk: Buffer.from('synth-sdk-tampered') }))));
  expect('SDK：校验文件接受两个空格和空格加星号两种分隔', () => {
    const sdk = Buffer.from('synth-sdk');
    return !throws(() => buildSite(synthInputs({ sdkSums: `${sha256Hex(sdk)} *pocketbase.iife.js\n` })));
  });
  expect('SHA256SUMS：两个空格、相对路径、按路径排序、不含自己', () => {
    const lines = a().files.SHA256SUMS.trimEnd().split('\n');
    const paths = lines.map((l) => l.slice(66));
    return lines.every((l) => /^[0-9a-f]{64} {2}\S/.test(l)) && paths.join() === [...paths].sort().join() && !paths.includes('SHA256SUMS') && paths.includes('site/sw.js') && paths.includes('server/nginx/usj-csp.conf');
  });
  expect('SHA256SUMS：每个哈希都对得上对应文件的字节', () => {
    const b = a();
    return b.files.SHA256SUMS.trimEnd().split('\n').every((l) => sha256Hex(bytes(b.files[l.slice(66)])) === l.slice(0, 64));
  });
  expect('输出文件清单：页面、sw、清单、4 个图标、SDK 和校验文件、头文件', () => {
    const names = Object.keys(a().files).sort();
    const want = ['BUILD_VERSION', 'SHA256SUMS', 'server/nginx/usj-csp.conf', 'site/icons/apple-touch-icon-180.png', 'site/icons/icon-192.png', 'site/icons/icon-512.png', 'site/icons/icon-maskable-512.png', 'site/index.html', 'site/manifest.webmanifest', 'site/sw.js', 'site/vendor/SHA256SUMS', 'site/vendor/pocketbase.iife.js'];
    return names.join() === want.join();
  });
  const root = resolve(sep, 'synth-repo');
  expect('checkOutDir：仓库外、仓库根、deploy、test-results 本身、.. 都拒绝', () =>
    [resolve(sep, 'synth-elsewhere'), root, join(root, 'deploy'), join(root, 'test-results'), join(root, 'test-results', '..', 'deploy')].every((d) => throws(() => checkOutDir(d, root))));
  expect('checkOutDir：test-results 下的目录接受', () => checkOutDir(join(root, 'test-results', 'x', 'y'), root) === 'test-results/x/y');
  expect('checkOutDir：private/deploy-out 在本仓库里被忽略因而接受', () => checkOutDir(join(ROOT, 'private', 'deploy-out'), ROOT) === 'private/deploy-out');

  const failed = results.filter(([, ok]) => !ok);
  for (const [name] of failed) process.stdout.write(`自检失败：${name}\n`);
  process.stdout.write(failed.length === 0 ? `SELF-TEST OK (${results.length} cases)\n` : `SELF-TEST FAIL (${failed.length} of ${results.length})\n`);
  return failed.length === 0 ? 0 : 1;
}

// ---------- CLI ----------

function run(opts) {
  const rel = checkOutDir(resolve(opts.out), ROOT);
  const out = resolve(ROOT, rel);
  const read = (p) => readFileSync(join(ROOT, p));
  const icons = Object.fromEntries(ICON_NAMES.map((n) => [n, read(`${ICON_DIR}/${n}`)]));
  const built = buildSite({
    html: read(APP_PATH).toString('utf8'),
    sw: read(SW_PATH).toString('utf8'),
    manifest: read(MANIFEST_PATH).toString('utf8'),
    icons,
    sdk: read(`${SDK_DIR}/${SDK_FILE}`),
    sdkSums: read(`${SDK_DIR}/SHA256SUMS`).toString('utf8'),
  });
  rmSync(out, { recursive: true, force: true });
  for (const [name, data] of Object.entries(built.files)) {
    mkdirSync(dirname(join(out, name)), { recursive: true });
    writeFileSync(join(out, name), data);
  }
  process.stdout.write(`BUILD OK ${built.version} (${Object.keys(built.files).length} files)\n`);
  return 0;
}

export function main(args) {
  if (args.length === 1 && args[0] === '--self-test') return selfTest();
  let opts;
  try {
    opts = parseArgs(args);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    return 2;
  }
  try {
    return run(opts);
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`${err.message}\n`);
      return 2;
    }
    process.stderr.write(`${err instanceof BuildError ? err.message : '构建失败（已隐去详情）'}\n`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = main(process.argv.slice(2));
}
