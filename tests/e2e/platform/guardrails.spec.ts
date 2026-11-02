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

  // 只清掉本用例故意制造的违规，让 teardown 通过
  guard.reset();
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

  // 只清掉本用例故意制造的违规
  guard.reset();
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

  // 只清掉本用例故意制造的违规
  guard.reset();
});
