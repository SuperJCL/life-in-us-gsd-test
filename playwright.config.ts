import { defineConfig } from '@playwright/test';
import {
  PORT,
  APP_ORIGIN,
  TIMEZONE_ID,
  LOCALE,
  DEAD_PROXY_SERVER,
  PROXY_BYPASS,
} from './tests/support/constants';

export default defineConfig({
  // 基本项：retries 1（D-04）、workers 2（D-17）。flaky 的用例都算缺陷，不能靠重试掩盖
  testDir: './tests/e2e',
  outputDir: './test-results',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  workers: 2,

  // 报告器：终端列表 + HTML，HTML 报告不自动弹出（D-03）。
  // 第三项只有设置了环境变量 PW_JSON_REPORT 时才加入，未设置时报告器恰好是上面两项。
  // 它只服务于阶段收尾的确定性检查（ENV-04、D-04）：检查跑的是交付时的同一份配置，
  // list 照常输出到终端，html 照常重新生成 playwright-report/，json 只多写一个文件。
  // 命令行上不要传报告器参数，免得覆盖这里的报告器。
  // 文件建议写到 test-results/ 下（已被 git 忽略）；Playwright 每次运行开始时会清空该目录，
  // 所以每次运行结束后要立即读取结果文件。
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ...(process.env.PW_JSON_REPORT
      ? [['json', { outputFile: process.env.PW_JSON_REPORT }] as ['json', { outputFile: string }]]
      : []),
  ],

  use: {
    baseURL: APP_ORIGIN,

    // 浏览器通道：默认本机 Edge，不下载任何浏览器（D-13）。
    // 只有显式设置 PW_CHANNEL=chrome 时才改用本机 Chrome
    channel: process.env.PW_CHANNEL ?? 'msedge',
    headless: true,
    viewport: { width: 1280, height: 800 },

    // 语言与时区：与冻结时间配合，保证日期与机器设置无关（D-15）
    locale: LOCALE,
    timezoneId: TIMEZONE_ID,
    colorScheme: 'light',
    reducedMotion: 'reduce',

    // 拦截 service worker，不接受下载（D-16）
    serviceWorkers: 'block',
    acceptDownloads: false,

    // 只在失败时保留证据，证据只存在本地 test-results/，绝不提交（D-02）
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',

    // 浏览器级网络兜底（D-16 第二层）：
    // 1. --host-resolver-rules 把除 127.0.0.1 之外的主机名都解析失败；
    // 2. 无条件启用死代理。route 只拦截 HTTP 请求，应用 head 里的 <link rel="preconnect">
    //    是浏览器直接发起的 socket 连接，route 看不到；死代理让所有非回环流量
    //    （包括 preconnect、WebSocket、IP 字面量地址）只能连到本机一个关闭的端口，
    //    不会离开本机，也不依赖 --host-resolver-rules 是否生效
    //    （CLAUDE.md：测试运行时拦截所有外部请求，包括 Google Fonts）。
    // 3. proxy 写在 launchOptions（浏览器级），所有 context 都带上，包括探针手动创建的；
    //    127.0.0.1 和 localhost 显式写进 bypass，不依赖 Chromium 对回环地址的默认处理。
    launchOptions: {
      args: ['--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'],
      proxy: { server: DEAD_PROXY_SERVER, bypass: PROXY_BYPASS },
    },
  },

  // 页面由零依赖静态服务器提供；端口被占用时直接失败，不复用来路不明的服务（D-14）
  webServer: {
    command: 'node tests/support/static-server.cjs',
    url: APP_ORIGIN + '/',
    reuseExistingServer: false,
    timeout: 15_000,
    env: { PORT: String(PORT) },
  },
});
