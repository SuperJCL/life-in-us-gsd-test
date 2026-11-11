// 读浏览器原生下载的辅助函数（IO-06）。
// 导出文件的内容只在内存里：用 download.createReadStream() 读成文本，读完立刻 download.delete()，
// Playwright 写的临时文件不会留下；失败消息里不放文件内容。
// 用它的 spec 要在文件里（或 describe 里）写 test.use({ acceptDownloads: true })，playwright.config.ts 的默认值不改（D-16）。
import type { Page } from '@playwright/test';

export interface DownloadedFile {
  filename: string;
  text: string;
}

export async function downloadOf(page: Page, click: () => Promise<unknown>): Promise<DownloadedFile> {
  const [download] = await Promise.all([page.waitForEvent('download'), click()]);
  try {
    const stream = await download.createReadStream();
    if (!stream) throw new Error('下载没有可读的内容');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return { filename: download.suggestedFilename(), text: Buffer.concat(chunks).toString('utf-8') };
  } finally {
    await download.delete();
  }
}
