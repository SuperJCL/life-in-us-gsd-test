// 让页面在加载时就报告 navigator.onLine 为 false（Phase 10，D-02、D-08）。
// 原因：页面是从真实的本机静态服务器加载的，应用还没有 Service Worker（Phase 13），
// 所以在 context.setOffline(true) 下刷新，页面文档本身就加载不出来；而 PROBE-9a 已经证明真实断网时
// navigator.onLine 和 online、offline 事件会这样变化。这里只复制这一个可观察结果：
// init script 在任何页面脚本之前把 navigator.onLine 改成读一个页面里的变量，用例再用 setPageOnline 切换并派发事件。
// 服务器连不上仍然只用假服务器的开关制造，这里不碰网络。
import type { Page } from '@playwright/test';

// 作为 init script 使用（page.addInitScript(installOnlineSwitch, { online: false })），必须自包含：不能引用本文件里的其他名字
export function installOnlineSwitch(arg: { online: boolean }) {
  let on = arg.online;
  Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => on });
  (window as any).__setPageOnline = (v: boolean) => {
    on = v;
  };
}

// 改页面里的变量并派发 online 或 offline 事件；init script 已安装在这个页面上才能用
export async function setPageOnline(page: Page, on: boolean): Promise<void> {
  await page.evaluate((v) => {
    (window as any).__setPageOnline(v);
    window.dispatchEvent(new Event(v ? 'online' : 'offline'));
  }, on);
}
