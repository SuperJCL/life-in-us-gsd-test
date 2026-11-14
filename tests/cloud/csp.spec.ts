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
import { fcStyled, flAddCardio, flAddLift, flFillCardio, flFillSet, flSave, gotoFitness, setMetric, setRange } from '../support/fitness';
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

test('SEC-02 the built site page runs under its Content-Security-Policy without a violation through sign-in, the five views with a training and its charts, the plan editor, export and import', async ({
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
  // 5 个力量项（电脑上两页）和 1 个有氧项，翻页、两种图和数据表都会出现
  for (let i = 2; i <= 5; i += 1) plan.lifts.push({ id: `l-csp${i}`, n: `SYNTH-csp lift ${i}`, unit: 'kg', def: 10, target: 20, note: '' });
  plan.cardio = [{ id: 'r-csp1', n: 'SYNTH-csp cardio', note: '', target: { kind: 'min', v: 30 } }];
  // 力量目标卡搬到了健身页，目标页的进度条只剩目标组：做完一项，让至少一个条不是 0%
  const seed = syntheticState('csp', { tasks: { 't-csp1x1': { done: true, doneDate: '2026-03-17' } } });
  await app.open({ mode: 'cloud', seed, plan, login: 0 });
  // 页面拿到的就是发布版：策略头确实带上了
  expect(await page.evaluate(() => (window as any).USJ_CONFIG?.backend)).toBe('pocketbase');

  // 五个视图（本周在登录后默认显示，其余四个依次切换）
  for (const k of ['wk', 'cal', 'goal', 'tl', 'fit'] as const) {
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

  // 健身页：记一次训练（一个力量项加一个有氧项）、切换指标和范围、翻页、展开一条训练历史和一张图的数据表
  await gotoFitness(page);
  await flAddLift(page, 'l-csp1');
  await flFillSet(page, 'l-csp1', 0, '30', '5');
  await flAddCardio(page, 'r-csp1');
  await flFillCardio(page, 'r-csp1', '30', '5');
  await flSave(page);
  await expect(page.locator('#fh details.fh-item')).toHaveCount(1);
  await setMetric(page, 'e1rm');
  await setRange(page, '3m');
  await expect(page.locator('#fcNext')).toBeEnabled();
  await page.locator('#fcNext').click();
  await expect(page.locator('#fc-page')).not.toHaveText('');
  await page.locator('#fcPrev').click();
  await page.locator('#fh details.fh-item > summary').first().click();
  await expect(page.locator('#fh details.fh-item[open]')).toHaveCount(1);
  await page.locator('#fc details.fc-data > summary').first().click();
  await expect(page.locator('#fc details.fc-data[open]')).toHaveCount(1);
  // 健身页里除了进度条 i[data-w]，没有元素带 style 属性；进度条的宽度是经 CSSOM 设上的（不是内联属性）
  expect(
    await page.evaluate(() => Array.from(document.querySelectorAll('#tab-fit [style]')).filter((e) => !e.matches('i[data-w]')).length),
    '#tab-fit 里有进度条以外的元素带 style 属性',
  ).toBe(0);
  expect(await fcStyled(page), '趋势图里有元素带 style 属性').toBe(0);
  const fwBars = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('#fw i[data-w]')).map((i) => ({ w: Number(i.getAttribute('data-w')), css: i.style.width })),
  );
  expect(fwBars.length).toBeGreaterThan(0);
  for (const b of fwBars) {
    expect(b.css.endsWith('%')).toBe(true);
    expect(Math.abs(parseFloat(b.css) - b.w)).toBeLessThan(0.001);
  }
  expect(await page.locator('#fc svg.fc-svg').count(), '趋势图的 svg 画出来了').toBeGreaterThan(0);

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

test('SEC-02 a page block whose hash is missing from the policy is blocked and reported, so the zero-violation check is not vacuous', async ({
  app,
  page,
  guard,
}, testInfo) => {
  const built = buildSiteFor(testInfo);
  // 把样式哈希那一项换成 'none'：页面里唯一的内联 <style> 不再被放行
  const broken = built.policy.replace(/style-src 'sha256-[^']+'/, "style-src 'none'");
  expect(broken).not.toBe(built.policy);
  await serveBuilt(page, built, broken);

  await app.open({ mode: 'cloud', seed: syntheticState('cspneg') });

  // 违规恰好一项（一个内联样式块），指令以 style-src 开头
  await expect.poll(async () => (await violations(page)).length, { message: '等待违规事件' }).toBe(1);
  const reported = await violations(page);
  expect(reported[0].startsWith('style-src')).toBe(true);
  // 浏览器同时写了 1 条 console.error（Edge 的措辞是 Applying inline style violates ...），精确确认后移除，其余任何违规仍会让用例失败
  await acknowledgeConsoleErrors(guard, { 'Applying inline style violates the following Content Security Policy directive': 1 });
});
