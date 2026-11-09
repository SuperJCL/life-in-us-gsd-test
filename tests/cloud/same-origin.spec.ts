// INFRA-03（Phase 9）：云端页面只加载同源资源。只在 npm run test:cloud 里运行，只用合成账号和合成数据。
// 三条用例：全程只向同源发请求；SDK 脚本恰好一个、来自同源、integrity 与钉死的哈希一致；
// SDK 被篡改时浏览器的 integrity 检查拒绝它，应用停在登录页，不回退本地存储，也不向别的来源要 SDK。
import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { syntheticState } from '../support/cloud-data';
import { loadAppPure } from '../support/app-source';
import { APP_FILE_NAME, APP_ORIGIN, FONT_HOSTS, PB_SDK_PATH, PB_SDK_SHA256, STATE_KEY } from '../support/constants';
import { LOGIN_ERR_UNREACHABLE, STATUS_CLOUD_SYNCED } from '../support/strings';

// 合成种子计划：应用里唯一一份合成示例计划，即 normalizePlan(DEFAULT_PLAN)；JSON 往返后脱离 vm 的 realm
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));

test('INFRA-03 the cloud page requests only its own origin while signing in, loading and saving', async ({
  app,
  page,
  guard,
}) => {
  // open 之前就开始收集：页面发出的每一条请求（含脚本、样式、fetch），不论护栏怎么处理
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });

  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });
  await app.login(0);

  const entry = composer(page, 'w');
  await entry.type('SYNTH-0902 same-origin entry');
  await entry.submit();
  await expect
    .poll(() => (app.fake.lastState(0)?.logs ?? []).some((l: { text: string }) => l.text === 'SYNTH-0902 same-origin entry'), {
      message: '等待记录上传到 state 文档',
    })
    .toBe(true);
  await expect(page.locator('#status')).toHaveText(STATUS_CLOUD_SYNCED);

  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    const parsed = new URL(url);
    expect(parsed.origin, url).toBe(APP_ORIGIN);
    const allowed = parsed.pathname === '/' || parsed.pathname === PB_SDK_PATH || parsed.pathname.startsWith('/api/');
    expect(allowed, url).toBe(true);
  }
  // 护栏没有放过也没有拦下任何外部请求（cloud 策略下字体主机同样记为违规）
  expect(guard.state.expectedAborts).toEqual([]);
  expect(guard.state.unexpectedRequests).toEqual([]);
  expect(app.fake.fulfillErrors).toEqual([]);
});

test('INFRA-03 the page loads the pinned SDK from its own origin with a subresource integrity hash', async ({
  app,
  page,
}) => {
  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN });

  const scripts = page.locator(`script[src="${PB_SDK_PATH}"]`);
  await expect(scripts).toHaveCount(1);
  await expect(scripts).toHaveAttribute('integrity', 'sha256-' + Buffer.from(PB_SDK_SHA256, 'hex').toString('base64'));

  // 应用文件本身：不含字体主机名、preconnect，也没有任何 src 或 href 的值指向 http(s) 外链
  const source = fs.readFileSync(path.join(process.cwd(), APP_FILE_NAME), 'utf8');
  for (const host of FONT_HOSTS) {
    expect(source.includes(host), host).toBe(false);
  }
  expect(source.includes('preconnect')).toBe(false);
  expect(source).not.toMatch(/\b(?:src|href)\s*=\s*["']\s*https?:/i);
});

test('INFRA-03 a tampered SDK is refused by the integrity check and the app never falls back to another origin or to local storage', async ({
  app,
  page,
  guard,
}) => {
  // 在 open 之前拦下 SDK 路径，返回一段改过的合成脚本：字节和钉死的哈希对不上
  await page.route('**' + PB_SDK_PATH, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'window.PocketBase = function () { window.__SYNTH_TAMPERED_SDK_RAN = true; };',
    }),
  );

  await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, sdkRefused: true });

  await expect(page.locator('#login')).toBeVisible();
  await expect(page.locator('#login-err')).toHaveText(LOGIN_ERR_UNREACHABLE);
  expect(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY)).toBeNull();
  expect(
    await page.evaluate(() => ({
      pocketBase: typeof (window as any).PocketBase,
      tamperedRan: (window as any).__SYNTH_TAMPERED_SDK_RAN === true,
    })),
  ).toEqual({ pocketBase: 'undefined', tamperedRan: false });
  expect(guard.state.unexpectedRequests).toEqual([]);
  expect(guard.state.expectedAborts).toEqual([]);
  expect(app.fake.requests).toEqual([]);

  // 浏览器为 integrity 失败写一条 console.error：先等到恰好一条并核对内容，再按内容删除
  await expect.poll(() => guard.state.consoleErrors.length).toBe(1);
  expect(guard.state.consoleErrors[0]).toContain('integrity');
  expect(guard.remove('consoleErrors', 'integrity')).toBe(1);
});
