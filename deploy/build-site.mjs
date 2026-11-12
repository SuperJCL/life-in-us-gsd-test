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
const CONFIG_LINE = '<script>window.USJ_CONFIG={backend:"pocketbase"};</script>';
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

// 本任务只产出页面、策略和头文件，Task 2 扩展
export function buildSite({ html }) {
  const indexHtml = injectConfig(html);
  const scripts = inlineBlocks(indexHtml, 'script').map(cspHash);
  const styles = inlineBlocks(indexHtml, 'style').map(cspHash);
  const cspHeader = buildCsp({ scripts, styles });
  return { indexHtml, scripts, styles, cspHeader, cspConfText: cspConf(cspHeader) };
}

// ---------- 输出目录 ----------

// 本任务只接受 private/deploy-out 和 test-results/ 下的目录（Task 2 补全检查）
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

// ---------- CLI ----------

function run(opts) {
  const rel = checkOutDir(resolve(opts.out), ROOT);
  const out = resolve(ROOT, rel);
  const html = readFileSync(join(ROOT, APP_PATH), 'utf8');
  const built = buildSite({ html });
  rmSync(out, { recursive: true, force: true });
  const put = (name, data) => {
    mkdirSync(dirname(join(out, name)), { recursive: true });
    writeFileSync(join(out, name), data);
  };
  put('site/index.html', built.indexHtml);
  put('server/nginx/usj-csp.conf', built.cspConfText);
  process.stdout.write(`BUILD OK (${built.scripts.length} scripts, ${built.styles.length} styles)\n`);
  return 0;
}

export function main(args) {
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
