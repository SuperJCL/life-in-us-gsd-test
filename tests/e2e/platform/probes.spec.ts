// 运行时探针（D-05、D-06）：每次 npm test 都会运行，结论记录在 tests/PROBES.md。
// 每条探针都用 testInfo.annotations 记录观察值（type 为 probe 或 browser-version）。
import { readFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import type { Browser, Page } from '../../support/test';
import { test, expect } from '../../support/test';
import { APP_ORIGIN, FONT_HOSTS, FROZEN_NOW, PROXY_BYPASS } from '../../support/constants';
import { STATUS_LOCAL, TAB_LABELS } from '../../support/strings';
import { loadFixture } from '../../support/fixture-files';
import { answerNextDialog, chooseImportFile, jsonImportFile } from '../../support/import-file';

// ---------------------------------------------------------------------------
// PROBE-1：Edge headless 启动并记录 browser.version()
// ---------------------------------------------------------------------------
test('PROBE-1 msedge launches headless and reports browser.version()', async ({ browser, browserName }, testInfo) => {
  expect(browserName).toBe('chromium');
  const version = browser.version();
  // 只断言版本号格式，不设主版本下限：下限没有依据，换一台 Edge 较旧的机器会无故变红（IN-01）
  expect(version).toMatch(/^\d+\./);
  testInfo.annotations.push({ type: 'browser-version', description: version });
  console.log(`PROBE-1 browser.version() = ${version}`);
});

// ---------------------------------------------------------------------------
// PROBE-2：网络兜底（D-16）
//
// route 只拦截 HTTP 请求。浏览器直接发起的 socket 连接（例如 WebSocket）route 看不到。
// Phase 9 起应用不再引用字体主机，页头也没有 preconnect。playwright.config.ts 的 launchOptions 配了两层浏览器级兜底：
//   解析层：--host-resolver-rules 把除 127.0.0.1 之外的主机名都解析失败；
//   代理层：死代理 DEAD_PROXY_SERVER，除 PROXY_BYPASS 之外的流量都只能连到它。
// 下面手动创建的 context 会继承浏览器级的启动参数和死代理，但没有 guard 的 route。
//
// 所有地址只有三类：回环地址下不会加载子资源的 404 路径、RFC 6761 保留的 .invalid 域名
// （任何 DNS 都解析不到）、以及只放行应用来源的录制代理 context。没有任何探针直接请求外部主机。
// ---------------------------------------------------------------------------

type Outcome = { status: number | null; error: string | null };

// 访问一个地址，返回 HTTP 状态码（如果收到了响应）和导航错误（如果有）。
// 回环地址上的 404 空响应会让 goto 抛 ERR_HTTP_RESPONSE_CODE_FAILURE，所以状态码要从 response 事件取。
async function visit(page: Page, url: string): Promise<Outcome> {
  let status: number | null = null;
  const onResponse = (r: { url(): string; status(): number }) => {
    if (r.url() === url) status = r.status();
  };
  page.on('response', onResponse);
  let error: string | null = null;
  try {
    const response = await page.goto(url, { timeout: 10_000 });
    status = response ? response.status() : status;
  } catch (e) {
    error = String((e as Error).message).split('\n')[0];
  }
  page.off('response', onResponse);
  return { status, error };
}

// 在一个没有 route 的新 context 里依次访问若干地址，用完立即关闭 context
async function visitAll(browser: Browser, urls: string[]): Promise<Record<string, Outcome>> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const result: Record<string, Outcome> = {};
    for (const url of urls) result[url] = await visit(page, url);
    return result;
  } finally {
    await context.close();
  }
}

test('PROBE-2 --host-resolver-rules makes non-excluded hostnames unresolvable', async ({ browser, playwright, channel }, testInfo) => {
  // 证人有两个：localhost 和 probe.localhost。它们在没有规则时都会解析到回环地址，
  // 所以失败只能归因于 --host-resolver-rules，而不是 DNS 本来就查不到。
  // 两个都是回环名，404 路径不加载子资源，所以不会产生外部请求。
  // 注意：localhost 在 PROXY_BYPASS 里，直连时才会走到解析层；其余主机名会交给代理，
  // 代理不要求本机解析目标主机，所以它们的保证由 PROBE-2 的第 2、3 条证明，而不是这一条。
  const urls = [
    'http://localhost:4789/probe-404',
    'http://probe.localhost:4789/probe-404',
    `${APP_ORIGIN}/probe-404`,
  ];
  const result = await visitAll(browser, urls);
  testInfo.annotations.push({ type: 'probe', description: JSON.stringify(result) });

  expect(result[urls[0]].error, 'localhost 应被规则解析失败').toContain('ERR_NAME_NOT_RESOLVED');
  expect(result[urls[1]].error, 'probe.localhost 应被规则解析失败').toContain('ERR_NAME_NOT_RESOLVED');
  // EXCLUDE 127.0.0.1 生效：能连到本机服务器并收到 404
  expect(result[urls[2]].status).toBe(404);

  // 对照：再启动一个只去掉解析规则的浏览器（args 替换为空；死代理仍沿用配置里的，
  // 所以 Edge 自己的后台流量仍然只会到死代理，不会离开本机）。localhost 在 bypass 里直连，
  // 这时它应能解析并连到本机服务器（404）。这证明上面的失败是规则造成的，不是 localhost 本来就连不上。只访问回环地址。
  const control = await playwright.chromium.launch({ channel, args: [] });
  try {
    const controlContext = await control.newContext();
    const controlResult = await visit(await controlContext.newPage(), urls[0]);
    testInfo.annotations.push({ type: 'probe', description: `control(no rule) ${JSON.stringify(controlResult)}` });
    expect(controlResult.status, '没有规则时 localhost 应能解析并返回 404：' + JSON.stringify(controlResult)).toBe(404);
    await controlContext.close();
  } finally {
    await control.close();
  }
});

test('PROBE-2 the dead-end proxy rejects non-loopback traffic and still lets 127.0.0.1 load', async ({ browser }, testInfo) => {
  // .invalid 是 RFC 6761 保留的顶级域，任何 DNS 都解析不到，所以就算两层都失效，
  // 这条用例也不会连到任何线上服务。非回环主机名应当交给死代理并在本机被拒绝。
  const urls = ['http://probe.invalid/', 'https://probe.invalid/', `${APP_ORIGIN}/probe-404`];
  const result = await visitAll(browser, urls);
  testInfo.annotations.push({ type: 'probe', description: JSON.stringify(result) });

  expect(result[urls[0]].error).toContain('ERR_PROXY_CONNECTION_FAILED');
  expect(result[urls[1]].error).toContain('ERR_PROXY_CONNECTION_FAILED');
  // 死代理没有挡住应用来源
  expect(result[urls[2]].status).toBe(404);
});

test('PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy and the app opens no font-host connection', async ({ browser }, testInfo) => {
  // 这条用例的证明范围（WR-03）：route 看不到的 WebSocket 会交给代理；应用打开后没有任何字体主机连接到达代理（INFRA-03 的回归检查）。
  // 录制代理只能看到“到达它的”连接，所以这条用例发现不了绕过代理的直连：
  // 如果某个 Edge 版本绕过代理直接出网，这条用例照样通过。直连的保证来自解析层（PROBE-2a）。
  // 录制代理：只监听 127.0.0.1 的随机端口，每个连接只读第一块数据，
  // 取第一行（形如 CONNECT host:443 HTTP/1.1）记录下来后立即销毁连接。
  // 它不转发，也不发起任何对外连接。
  const seen: string[] = [];
  const recorder = net.createServer((socket) => {
    socket.once('data', (chunk) => {
      seen.push(chunk.toString('latin1').split('\r\n')[0]);
      socket.destroy();
    });
    socket.on('error', () => {});
  });
  await new Promise<void>((resolve) => recorder.listen(0, '127.0.0.1', () => resolve()));
  const port = (recorder.address() as net.AddressInfo).port;

  const context = await browser.newContext({
    proxy: { server: `http://127.0.0.1:${port}`, bypass: PROXY_BYPASS },
  });
  try {
    // 只放行应用来源，其余全部 abort：应用已不再引用字体主机，
    // 所以到达录制代理的字体主机连接只可能来自应用重新引入了字体或 preconnect（回归）
    await context.route('**/*', (route) =>
      route.request().url().startsWith(APP_ORIGIN + '/') ? route.continue() : route.abort(),
    );
    const page = await context.newPage();
    await page.goto(APP_ORIGIN + '/');
    await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

    // 对照：WebSocket 同样不经过 route。它出现在录制代理里，
    // 证明“route 看不到的页面流量会交给代理”
    await page.evaluate(() => {
      try {
        new WebSocket('ws://probe.invalid/');
      } catch (e) {
        // 构造失败也不影响探针：断言在录制代理那一侧
      }
    });
    await expect.poll(() => seen.some((line) => line.includes('probe.invalid')), { message: '等待 WebSocket 对照行' }).toBe(true);

    // 字体主机连接的观察窗口：只等有限时间，看字体主机的 CONNECT 是否出现；下面断言它没有出现（INFRA-03）。
    // 只吞 expect.poll 的超时错误（Playwright 1.64.1 的原文，见 node_modules/playwright/lib/matchers/expect.js）；
    // 其他错误（例如页面已关闭）照常抛出，不被悄悄吞掉
    const fontLine = () => seen.some((line) => FONT_HOSTS.some((h) => line.includes(h)));
    const fontHostObserved = await expect
      .poll(fontLine, { timeout: 3_000 })
      .toBe(true)
      .then(
        () => true,
        (error: unknown) => {
          if (/Timeout \d+ms exceeded while waiting on the predicate/.test(String((error as Error)?.message ?? error))) {
            return false;
          }
          throw error;
        },
      );
    testInfo.annotations.push({ type: 'probe', description: `fontHostObserved=${fontHostObserved}` });
    expect(fontHostObserved, '应用不应再向字体主机发起连接（INFRA-03）').toBe(false);

    const fontHostLines = seen.filter((line) => FONT_HOSTS.some((h) => line.includes(h)));
    const otherLines = seen.filter(
      (line) => !line.includes('probe.invalid') && !FONT_HOSTS.some((h) => line.includes(h)),
    );
    testInfo.annotations.push({ type: 'probe', description: `seen=${JSON.stringify(seen)}` });
    testInfo.annotations.push({ type: 'probe', description: `fontHostLines=${fontHostLines.length}` });
    expect(fontHostLines, '录制代理没有收到任何字体主机的连接').toEqual([]);
    testInfo.annotations.push({ type: 'probe', description: `otherLines=${JSON.stringify(otherLines)}` });
    console.log(`PROBE-2 recorder saw: ${JSON.stringify(seen)}`);
  } finally {
    await context.close();
    await new Promise<void>((resolve) => recorder.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// PROBE-3：setFixedTime 在 page.reload() 之后是否仍然有效
// ---------------------------------------------------------------------------
test('PROBE-3 setFixedTime survives page.reload()', async ({ page, app }, testInfo) => {
  await app.open();
  const before = await page.evaluate(() => Date.now());
  expect(before).toBe(FROZEN_NOW);

  await app.reload();
  const after = await page.evaluate(() => Date.now());
  expect(after).toBe(FROZEN_NOW);
  testInfo.annotations.push({ type: 'probe', description: `Date.now() before=${before} after=${after}` });
});

// ---------------------------------------------------------------------------
// PROBE-4：expect.poll 读取防抖保存的时序
// ---------------------------------------------------------------------------
test('PROBE-4 expect.poll observes the debounced localStorage save', async ({ page, app }, testInfo) => {
  await app.open();
  const elapsed: number[] = [];
  for (const n of [1, 2, 3]) {
    const text = `SYNTH-PROBE4 save timing ${n}`;
    await page.locator('#wkComp #w-text').fill(text);
    // 用 Node 侧的 Date.now() 计时：页面时钟被冻结，不影响 Node。起点在点击之前，所以耗时是上界
    const t0 = Date.now();
    await page.locator('#wkComp #w-add').click();
    await app.expectPersisted((s) => s.logs.some((l: { text: string }) => l.text === text));
    elapsed.push(Date.now() - t0);
  }
  testInfo.annotations.push({ type: 'probe', description: `persist latency ms=${JSON.stringify(elapsed)}` });
  for (const ms of elapsed) {
    // 不小于 500 ms：证明走的是 600 ms 防抖，而不是立即保存；小于 5000 ms：expect 的默认超时内稳定
    expect(ms).toBeGreaterThanOrEqual(500);
    expect(ms).toBeLessThan(5000);
  }
});

// ---------------------------------------------------------------------------
// PROBE-5：dragTo 能否驱动 HTML5 拖放（只做 spike）
// ---------------------------------------------------------------------------
test('PROBE-5 dragTo drives HTML5 drag and drop in the week view', async ({ page, app }, testInfo) => {
  const text = 'SYNTH-DRAG source';
  // 读取 fixture 文件，只把 logs 换成拖放源记录，不再内联一份重复的种子（IN-05）
  const base = JSON.parse(readFileSync(path.join(__dirname, '../../fixtures/local-seed.json'), 'utf8'));
  const seed = { ...base, logs: [{ id: 'synth-drag-1', date: '2026-03-16', text, cat: '其他' }] };
  await app.open({ seed });

  // 方案 A：dragTo（真实指针路径）。A、B、C 各自的结果见 tests/PROBES.md。
  const source = page.locator('#tab-wk [data-wday="2026-03-16"] [data-edit]').filter({ hasText: text });
  await expect(source).toBeVisible();
  await source.dragTo(page.locator('#tab-wk [data-wday="2026-03-19"]'), { steps: 10 });

  await app.expectPersisted((s) => s.logs.some((l: { text: string; date: string }) => l.text === text && l.date === '2026-03-19'));
  await expect(page.locator('#tab-wk [data-wday="2026-03-19"] [data-edit]').filter({ hasText: text })).toBeVisible();
  testInfo.annotations.push({ type: 'probe', description: '方案 A（dragTo，steps: 10）可行' });
});

// ---------------------------------------------------------------------------
// PROBE-6：clock.install 加 pauseAt 之后，元素稳定性检查是否仍然正常
// ---------------------------------------------------------------------------
test.describe('PROBE-6 manual clock', () => {
  // 同一个用例不混用 install 和 setFixedTime（D-15）：manual 时 frozenClock 什么都不做
  test.use({ clockMode: 'manual' });

  test('PROBE-6 clock.install with pauseAt keeps actionability checks working', async ({ page, app }, testInfo) => {
    await page.clock.install({ time: FROZEN_NOW });
    await app.open();
    await page.clock.pauseAt(FROZEN_NOW + 60_000);

    // 时钟暂停后，点击仍然能通过可操作性检查
    const calTab = page.getByRole('tab', { name: TAB_LABELS.cal, exact: true });
    await calTab.click();
    await expect(calTab).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: TAB_LABELS.wk, exact: true }).click();
    const text = 'SYNTH-PROBE6 paused clock';
    await page.locator('#wkComp #w-text').fill(text);
    await page.locator('#wkComp #w-add').click();
    await expect(page.locator('#toast')).toHaveClass(/\bon\b/);

    // toast 1800 ms 后消失：时钟暂停时由 runFor 推进
    await page.clock.runFor(1800);
    await expect(page.locator('#toast')).not.toHaveClass(/\bon\b/);
    // 600 ms 的防抖保存计时器也被同一次推进触发
    await app.expectPersisted((s) => s.logs.some((l: { text: string }) => l.text === text));
    testInfo.annotations.push({ type: 'probe', description: 'install + pauseAt + runFor(1800) 可行' });
  });
});

// ---------------------------------------------------------------------------
// PROBE-7：exposeBinding 的时序（D-01）
// 账户 tracer 证明应用调用 get() 时 binding 可用；这条探针证明更早的 init 阶段也可用。
// 两条断言的期望值写死为 'function' 和 'pong'，不随观察值改写：
// binding 在 init 阶段不可调用时它必须失败，按 D-01 停下重新规划。
// ---------------------------------------------------------------------------
test('PROBE-7 exposeBinding is callable from an init script before any page script runs', async ({ page }, testInfo) => {
  await page.exposeBinding('__probeBinding', () => 'pong');
  // 函数体必须自包含：addInitScript 会把函数序列化成源码发给浏览器
  await page.addInitScript((name: string) => {
    const w = window as any;
    w.__probeTypeAtInit = typeof w[name];
    if (typeof w[name] === 'function') {
      w[name]().then((result: unknown) => {
        w.__probeInitCall = result;
      });
    }
  }, '__probeBinding');

  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 观察值先记下再断言：断言失败时报告里也有观察值
  const typeAtInit = await page.evaluate(() => (window as any).__probeTypeAtInit);
  testInfo.annotations.push({ type: 'probe', description: `typeAtInit=${typeAtInit}` });
  expect(typeAtInit).toBe('function');

  let initCall: unknown;
  try {
    await expect
      .poll(
        async () => {
          initCall = await page.evaluate(() => (window as any).__probeInitCall);
          return initCall;
        },
        { message: '等待 init 阶段的 binding 调用返回' },
      )
      .toBe('pong');
  } finally {
    testInfo.annotations.push({ type: 'probe', description: `initCall=${String(initCall)}` });
  }
});

// ---------------------------------------------------------------------------
// PROBE-8：取消导入后再选同一个文件（B2 的 spike，D-01）
// 用户看到的现象是“取消导入确认后，再选同一个文件没有反应”。这条探针在 Playwright 里观察：
// 取消后 #importJson 的 value 是否还在、第二次 setInputFiles 选同一个文件时 change 是否再次派发、确认框是否再次出现。
// change 计数监听只计数、不阻止事件、不改应用的处理函数，计数放在带 probe 前缀的 window 属性上（测试侧的观察）。
// 观察值先记进 annotations 和终端，看清之后把断言写死（同 PROBE-7），结论见 tests/PROBES.md 的 PROBE-8。
// ---------------------------------------------------------------------------
test('PROBE-8 re-selecting the same file with setInputFiles after a cancelled import', async ({ page, app }, testInfo) => {
  await app.open({ mode: 'account', seed: loadFixture('full-state.json') });
  await app.expectAccountMode();
  await page.evaluate(() => {
    const w = window as any;
    w.__probeImportChanges = 0;
    document.querySelector('#importJson')!.addEventListener('change', () => {
      w.__probeImportChanges += 1;
    });
  });
  const changes = () => page.evaluate(() => (window as any).__probeImportChanges as number);
  const fileValue = () => page.locator('#importJson').inputValue();
  const file = jsonImportFile('synth-probe8.json', { logs: [] });

  // 第一次：取消确认框
  const first = answerNextDialog(page, 'dismiss');
  await chooseImportFile(page, file);
  await expect.poll(() => first.length, { message: '等待第一次的替换确认框' }).toBe(1);
  const changesAfterFirst = await changes();
  const valueAfterCancel = await fileValue();
  // 只记形式，不记带盘符的 fakepath 字符串
  const valueShape = valueAfterCancel === '' ? 'empty' : /synth-probe8\.json$/.test(valueAfterCancel) ? 'fakepath+name' : 'other';

  // 第二次：同一个文件再选一次
  const second = answerNextDialog(page, 'dismiss');
  await chooseImportFile(page, file);
  let secondDialog = 'not-observed';
  try {
    await expect.poll(() => second.length, { message: '等待第二次的替换确认框', timeout: 3_000 }).toBe(1);
    secondDialog = 'appeared';
  } catch {
    // 没出现：下面的断言会失败，观察值已经在 annotations 里
  }
  const changesAfterSecond = await changes();
  testInfo.annotations.push({
    type: 'probe',
    description: `changesAfterFirst=${changesAfterFirst} valueAfterCancel=${valueShape} changesAfterSecond=${changesAfterSecond} secondDialog=${secondDialog}`,
  });
  console.log(
    `PROBE-8 changesAfterFirst=${changesAfterFirst} valueAfterCancel=${valueShape} changesAfterSecond=${changesAfterSecond} secondDialog=${secondDialog}`,
  );

  // 断言写死，不随观察值改写：取消后 value 仍保留（所以 B2 的期望断言用确定性的 value），
  // 而 Playwright 的 setInputFiles 每次都会自己派发 change，第二次选同一个文件时 change 再次派发、确认框再次出现
  expect(changesAfterFirst).toBe(1);
  expect(valueShape).toBe('fakepath+name');
  expect(secondDialog).toBe('appeared');
  expect(changesAfterSecond).toBe(2);
});
