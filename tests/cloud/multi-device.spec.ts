// 多设备用例（09-04）：第二台设备是同一个假服务器上的独立浏览器上下文，护栏状态和第一台共用。
// 只在 npm run test:cloud 里运行，只用 FakePbServer 的合成账号。
import { test, expect } from '../support/test';
import { composer } from '../support/composer';
import { openDevice } from '../support/devices';
import { acknowledgeConsoleErrors } from '../support/guard-ack';

test('SYNC-01 a second device signed in to the same account loads what the first device saved', async ({
  app,
  page,
  browser,
  guard,
}) => {
  await app.open({ mode: 'cloud', login: 0 });

  const entry = composer(page, 'w');
  await entry.type('SYNTH-0904 device one entry');
  await entry.submit();
  await expect
    .poll(() => (app.fake.lastState(0)?.logs ?? []).some((l: { text: string }) => l.text === 'SYNTH-0904 device one entry'), {
      message: '等待设备一的记录上传到 state 文档',
    })
    .toBe(true);
  const id = (app.fake.lastState(0).logs as Array<{ id: string; text: string }>).find((l) => l.text === 'SYNTH-0904 device one entry')!.id;

  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.app.open({ mode: 'cloud', login: 0 });

    await expect(second.page.locator(`#days [data-edit="${id}"]`)).toBeVisible();
  } finally {
    await second.context.close();
  }
});

test('TEST-02 a second device reports its own external request through the shared guard', async ({ app, browser, guard }) => {
  const second = await openDevice({ browser, guard, fake: app.fake });
  try {
    await second.page.goto('/');
    const target = 'https://example.com/';

    const result = await second.page.evaluate(
      (url) =>
        fetch(url).then(
          (res) => 'resolved:' + res.status,
          (err) => 'rejected:' + String(err),
        ),
      target,
    );
    expect(result).not.toMatch(/^resolved/);

    // 第二台设备的违规记进同一个 guard.state；先断言恰好是这一条，再按内容删除
    await expect.poll(() => guard.state.unexpectedRequests).toEqual([target]);
    expect(guard.remove('unexpectedRequests', target)).toBe(1);
    // 被 abort 的请求，Chromium 另写一条 console.error
    await acknowledgeConsoleErrors(guard, { ERR_BLOCKED_BY_CLIENT: 1 });
  } finally {
    await second.context.close();
  }
});
