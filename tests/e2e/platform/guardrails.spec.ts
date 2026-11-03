import { test, expect, guardViolations } from '../../support/test';
import { FONT_HOSTS } from '../../support/constants';
import { STATUS_LOCAL } from '../../support/strings';

// 这些用例证明护栏会在该失败的时候失败：故意制造违规，断言 guardViolations 报出来。
// guard.state 的数组由 route 处理函数和 page 事件异步写入，#status 出现时它们未必已经写好，
// 所以每个“应当出现”的断言都直接用 expect.poll；其余断言只放在某次 poll 通过之后。

test('SAFE-01 a page fetch to example.com is blocked and reported as a guard violation', async ({
  page,
  guard,
}) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 页面里请求 example.com：请求会在 route 层被 abort；then 和 catch 的结果都转成字符串
  const result = await page.evaluate(() =>
    fetch('https://example.com/').then(
      (res) => 'resolved:' + res.status,
      (err) => 'rejected:' + String(err),
    ),
  );
  expect(result).not.toMatch(/^resolved/);
  expect(result).toContain('TypeError');

  await expect.poll(() => guard.state.unexpectedRequests).toContain('https://example.com/');

  // 在 poll 通过之后：违规清单必须非空，并且报的是外部请求
  const violations = guardViolations(guard.state);
  expect(violations.length).toBeGreaterThan(0);
  expect(violations.join('\n')).toMatch(/外部请求/);

  // 只删掉本用例故意制造的记录：先断言该类记录恰好是预期的，再按内容删除（WR-02）
  expect(guard.state.unexpectedRequests).toEqual(['https://example.com/']);
  expect(guard.remove('unexpectedRequests', 'https://example.com/')).toBe(1);

  // 被 route abort 的 fetch，Chromium 还会为它写一条 console.error（不含 URL，来源不是字体主机，
  // 过滤规则不会吞掉它）。这是同一次故意违规的副产物。以前一次清空全部记录时它被悄悄抹掉，
  // 现在同样按条处理：先等到它恰好出现一条，核对内容，再按内容删除
  await expect.poll(() => guard.state.consoleErrors.length).toBe(1);
  expect(guard.state.consoleErrors[0]).toContain('ERR_BLOCKED_BY_CLIENT');
  expect(guard.remove('consoleErrors', 'ERR_BLOCKED_BY_CLIENT')).toBe(1);
});

test('SAFE-01 opening the app only aborts the allowlisted font hosts', async ({ page, guard }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 显式信号：字体请求已经进过 route 并被 abort
  await expect.poll(() => guard.state.expectedAborts.length).toBeGreaterThanOrEqual(1);

  // 在信号之后：每条被 abort 的 URL，主机都在字体白名单内
  for (const url of guard.state.expectedAborts) {
    expect(FONT_HOSTS).toContain(new URL(url).hostname);
  }

  // 此刻没有外部请求。晚到的外部请求由 teardown 的 guardViolations 兜底
  expect(guard.state.unexpectedRequests).toEqual([]);
});

test('SAFE-04 an uncaught page error is reported as a guard violation', async ({ page, guard }) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 在微任务里抛出，才会成为未捕获异常，而不是被 evaluate 接住。
  // 不用 setTimeout：冻结时钟（setFixedTime）接管了定时器，定时器回调里的异常
  // 被 Playwright 的时钟吞掉并改成 console.error，不会触发 pageerror（实测，见 01-02-SUMMARY）。
  // 那条路径同样会被 guard 的 console.error 收集报出来，只是不是 pageerror 这一条。
  await page.evaluate(() => {
    queueMicrotask(() => {
      throw new Error('SYNTH page error');
    });
  });

  await expect.poll(() => guard.state.pageErrors.some((m) => m.includes('SYNTH page error'))).toBe(true);

  expect(guardViolations(guard.state).join('\n')).toMatch(/页面未捕获异常/);

  // 只删掉本用例故意制造的那一条：先断言该类记录恰好一条且是预期的，再按内容删除
  expect(guard.state.pageErrors).toHaveLength(1);
  expect(guard.state.pageErrors[0]).toContain('SYNTH page error');
  expect(guard.remove('pageErrors', 'SYNTH page error')).toBe(1);
});

test('SAFE-04 console.error is reported while aborted-font noise is filtered', async ({
  page,
  guard,
}) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 显式信号：字体噪音确实产生了，并且 guard 的同步监听器已经把它过滤掉。
  // 证明的是“噪音被过滤”，而不是“噪音还没到”
  await expect.poll(() => guard.state.filteredConsoleNoise.length).toBeGreaterThanOrEqual(1);
  expect(guard.state.consoleErrors).toEqual([]);
  expect(guard.state.expectedAborts.length).toBeGreaterThanOrEqual(1);

  // 非字体来源的 console.error 必须被记录
  await page.evaluate(() => console.error('SYNTH console error'));
  await expect.poll(() => guard.state.consoleErrors).toContain('SYNTH console error');

  expect(guardViolations(guard.state).join('\n')).toMatch(/console\.error/);

  // 只删掉本用例故意制造的那一条：先断言该类记录恰好是预期的，再按内容删除
  expect(guard.state.consoleErrors).toEqual(['SYNTH console error']);
  expect(guard.remove('consoleErrors', 'SYNTH console error')).toBe(1);
});

test('SAFE-01 guard.remove clears only the matching violation and keeps the others', async ({
  page,
  guard,
}) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 两个 .invalid 主机（RFC 6761 保留，永远不会解析）：route 会 abort 两者，结果转成字符串，不抛错
  const results = await page.evaluate(() =>
    Promise.all(
      ['https://probe-a.invalid/', 'https://probe-b.invalid/'].map((url) =>
        fetch(url).then(
          (res) => 'resolved:' + res.status,
          (err) => 'rejected:' + String(err),
        ),
      ),
    ),
  );
  expect(results.every((r) => r.startsWith('rejected:'))).toBe(true);

  // 两条都被记录之后再删
  await expect
    .poll(() => [...guard.state.unexpectedRequests].sort())
    .toEqual(['https://probe-a.invalid/', 'https://probe-b.invalid/']);

  // 两次被 abort 的 fetch 各自带来一条 console.error（同一次故意违规的副产物）：
  // 先等到恰好两条并核对内容，再按内容删除，让下面对违规清单的“恰好一条”断言只剩外部请求
  await expect.poll(() => guard.state.consoleErrors.length).toBe(2);
  expect(guard.state.consoleErrors.every((text) => text.includes('ERR_BLOCKED_BY_CLIENT'))).toBe(true);
  expect(guard.remove('consoleErrors', 'ERR_BLOCKED_BY_CLIENT')).toBe(2);

  // 只删匹配项：返回 1，另一条还在，违规清单恰好一条
  expect(guard.remove('unexpectedRequests', 'probe-a.invalid')).toBe(1);
  expect(guard.state.unexpectedRequests).toEqual(['https://probe-b.invalid/']);
  expect(guardViolations(guard.state)).toEqual(['外部请求：https://probe-b.invalid/']);

  // 最后删掉另一条，违规清单才为空，teardown 通过
  expect(guard.remove('unexpectedRequests', 'probe-b.invalid')).toBe(1);
  expect(guardViolations(guard.state)).toEqual([]);
});

test('SAFE-01 a page WebSocket to a non-loopback host is reported as a guard violation', async ({
  page,
  guard,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('#status')).toHaveText(STATUS_LOCAL);

  // 页面里新建指向保留域名的 WebSocket：evaluate 返回的 Promise 在 close 事件时 resolve，不用定时器
  await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const ws = new WebSocket('ws://probe.invalid/');
        ws.addEventListener('close', () => resolve('closed'));
      }),
  );

  // 1) 确定性信号（WR-05 要证明的事实）：guard 的 websocket 监听在连接创建时就记录，与连接成败无关
  await expect.poll(() => guard.state.unexpectedRequests).toEqual(['ws://probe.invalid/']);
  expect(guardViolations(guard.state).join('\n')).toMatch(/外部请求/);
  expect(guard.remove('unexpectedRequests', 'ws://probe.invalid/')).toBe(1);

  // 2) console 输出：Chromium 可能把这次连接失败写成一条 console.error（来源是应用页面，
  // 不是字体主机，噪音过滤不会吞掉它），也可能不写。两种行为得到同一个结果。
  // 屏障：同一页面的控制台消息按产生顺序到达，连接失败的消息如果有，产生在 close 事件之前，
  // 所以屏障被记录时它也一定已经被记录
  await page.evaluate(() => console.error('SYNTH ws barrier'));
  await expect.poll(() => guard.state.consoleErrors).toContain('SYNTH ws barrier');

  // 除屏障以外最多一条，并且每一条都包含 probe.invalid；任何别的 console.error 都让用例失败
  const others = guard.state.consoleErrors.filter((text) => !text.includes('SYNTH ws barrier'));
  expect(others.length).toBeLessThanOrEqual(1);
  for (const text of others) {
    expect(text).toContain('probe.invalid');
  }

  // 没有放宽护栏：只删掉自己制造、并且删除前逐条核对过的记录
  expect(guard.remove('consoleErrors', 'SYNTH ws barrier')).toBe(1);
  const wsConsoleErrors = guard.remove('consoleErrors', 'probe.invalid');
  expect(wsConsoleErrors).toBe(others.length);
  testInfo.annotations.push({ type: 'note', description: `wsConsoleErrors=${wsConsoleErrors}` });

  expect(guard.state.consoleErrors).toEqual([]);
  expect(guardViolations(guard.state)).toEqual([]);
});

test('SAFE-04 a page error in a second page of the same context is reported', async ({
  context,
  guard,
}) => {
  // 用例后开的 page：guard 通过 context.on('page') 给它挂监听
  const second = await context.newPage();
  await second.goto('/');
  await expect(second.locator('#status')).toHaveText(STATUS_LOCAL);

  // 同样在微任务里抛出（原因见上面的 SAFE-04 用例）
  await second.evaluate(() => {
    queueMicrotask(() => {
      throw new Error('SYNTH second page error');
    });
  });

  await expect.poll(() => guard.state.pageErrors.some((m) => m.includes('SYNTH second page error'))).toBe(true);
  expect(guardViolations(guard.state).join('\n')).toMatch(/页面未捕获异常/);

  // 只删掉这一条（先核对恰好一条且是预期的），再关闭第二个 page
  expect(guard.state.pageErrors).toHaveLength(1);
  expect(guard.remove('pageErrors', 'SYNTH second page error')).toBe(1);
  await second.close();
});
