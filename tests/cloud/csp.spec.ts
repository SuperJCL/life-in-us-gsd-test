// Phase 13-04 的 CSP 用例（SEC-02）：只在 npm run test:cloud 里运行，只用合成账号和合成数据，不连接任何真实服务器。
//
// 为什么用真实 CLI 的产物：用例跑 node deploy/build-site.mjs 生成发布版页面和 usj-csp.conf，再用页面级 route 把 / 换成这份页面、
// 带上 usj-csp.conf 里的同一条头，所以测试看到的页面和策略就是线上 nginx 发的那一对（页面和头出自同一次构建）。
// 页面级 route 优先于 context 级的护栏 route；假服务器和静态服务器照旧负责 /api 和同源静态文件。
// Playwright 的初始化脚本不受 CSP 约束，所以收集 securitypolicyviolation 的脚本照样能跑。
// Chrome 会把每一次违规同时写成 console.error，护栏会把它当失败，所以零违规可以直接断言（护栏自己也在盯）。
// 反向对照用例故意去掉样式哈希，证明零违规的断言不是空转：违规事件和 console.error 都会出现。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test, expect } from '../support/test';
import { legacyBackup } from '../support/backup-files';
import { syntheticPlan, syntheticState } from '../support/cloud-data';
import { APP_ORIGIN, BUILD_SITE_SCRIPT } from '../support/constants';
import { confirmOk, readConfirm } from '../support/confirm';
import { downloadOf } from '../support/download';
import { gotoGoals } from '../support/goals';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { chooseImportFile, jsonImportFile } from '../support/import-file';
import { expand, field, openEditor, savePlan } from '../support/plan-editor';
import { TAB_LABELS, TOAST_IMPORTED, TOAST_PLAN_SAVED } from '../support/strings';
import { expectToast } from '../support/toast';

test.use({ acceptDownloads: true });

// 跑真实 CLI，读回发布版页面和 nginx 头文件里的策略
function buildSiteFor(testInfo: TestInfo): { html: string; policy: string } {
  const out = testInfo.outputPath('site-build');
  const rel = relative(process.cwd(), out).split(sep).join('/');
  const log = execFileSync(process.execPath, [BUILD_SITE_SCRIPT, '--out', rel], { encoding: 'utf8' });
  expect(log).toMatch(/^BUILD OK/);
  const html = readFileSync(join(out, 'site', 'index.html'), 'utf8');
  const conf = readFileSync(join(out, 'server', 'nginx', 'usj-csp.conf'), 'utf8');
  const m = /^add_header Content-Security-Policy "([^"]+)" always;$/m.exec(conf);
  expect(m, 'usj-csp.conf 里有一行 add_header Content-Security-Policy').not.toBeNull();
  return { html, policy: m![1] };
}

// 只给这一个 page 提供这份页面和这条头；违规事件收进 window.__cspViolations
async function serveBuilt(page: Page, built: { html: string }, policy: string) {
  await page.addInitScript(() => {
    (window as any).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as any).__cspViolations.push(e.violatedDirective);
    });
  });
  await page.route(APP_ORIGIN + '/', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      headers: { 'content-security-policy': policy },
      body: built.html,
    }),
  );
}

const violations = (page: Page): Promise<string[]> => page.evaluate(() => (window as any).__cspViolations as string[]);

test('SEC-02 the built site page runs under its Content-Security-Policy without a violation through sign-in, the four views, the plan editor, export and import', async ({
  app,
  page,
}, testInfo) => {
  const built = buildSiteFor(testInfo);
  // 策略的形态：没有任何 unsafe- 关键字，属性里的样式一律不放行，不允许被嵌入
  expect(built.policy).not.toContain('unsafe-');
  expect(built.policy).toContain("style-src-attr 'none'");
  expect(built.policy).toContain("frame-ancestors 'none'");
  await serveBuilt(page, built, built.policy);

  const plan: any = syntheticPlan('csp', 2);
  await app.open({ mode: 'cloud', seed: syntheticState('csp'), plan, login: 0 });
  // 页面拿到的就是发布版：策略头确实带上了
  expect(await page.evaluate(() => (window as any).USJ_CONFIG?.backend)).toBe('pocketbase');

  // 四个视图（本周在登录后默认显示，其余三个依次切换）
  for (const k of ['wk', 'cal', 'goal', 'tl'] as const) {
    const tab = page.getByRole('tab', { name: TAB_LABELS[k], exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  // 目标页：进度条宽度由 CSSOM 赋值，属性里没有内联样式也照常显示；至少有一个不是 0%
  await gotoGoals(page);
  const bars = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#goals i[data-w]')).map((i) => ({
      w: Number(i.getAttribute('data-w')),
      css: i.style.width,
    })),
  );
  expect(bars.length).toBeGreaterThan(0);
  // CSSOM 会把宽度规整成约 6 位有效数字，所以按数值比较
  for (const b of bars) {
    expect(b.css.endsWith('%')).toBe(true);
    expect(Math.abs(parseFloat(b.css) - b.w)).toBeLessThan(0.001);
  }
  expect(bars.some((b) => b.css !== '0%')).toBe(true);

  // 编辑计划页：改一个组名并保存
  await openEditor(page);
  await expand(page, 'g:g-csp1');
  await field(page, 'g:g-csp1:name').fill('SYNTH-csp renamed');
  await savePlan(page);
  await expectToast(page, TOAST_PLAN_SAVED);

  // 导出备份：Blob 下载在 default-src 'none' 下照常触发
  const backup = await downloadOf(page, () => page.locator('#exportJson').click());
  expect(backup.filename.endsWith('.json')).toBe(true);

  // 选文件导入：一份合成旧备份，确认后替换
  await chooseImportFile(page, jsonImportFile('synth-csp.json', legacyBackup('csp1')));
  await readConfirm(page);
  await confirmOk(page);
  await expectToast(page, TOAST_IMPORTED);

  // 全程零违规
  expect(await violations(page)).toEqual([]);
});
