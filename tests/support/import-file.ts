// 导入备份（#importJson）的 helper（IO-04、IO-05）。
// 这里只能从 @playwright/test 导入，不能从 ./test 导入，否则会和 test.ts 循环引用。
//
// 约定：
//  - 导入文件只在内存里构造，磁盘上不写任何文件（D-04）；文件名一律以 synth- 开头，chooseImportFile 在运行时检查；
//  - 先注册对话框处理，再选文件（D-05）：应用在 FileReader 的 onload 里才弹出 confirm，
//    所以选完文件后调用者要用 expect.poll 等消息出现，不能在 setInputFiles 返回后立刻断言。
import { type Page } from '@playwright/test';

// 内存里的导入文件。tests/fixtures/malformed-imports.ts 的条目结构上也满足它
export type ImportFile = { name: string; mimeType: string; text: string };

// 把一个值序列化成 JSON 导入文件
export function jsonImportFile(name: string, value: unknown): ImportFile {
  return { name, mimeType: 'application/json', text: JSON.stringify(value) };
}

// 原文导入：导出得到的备份原文、畸形内容
export function textImportFile(name: string, text: string, mimeType = 'application/json'): ImportFile {
  return { name, mimeType, text };
}

// 选一个内存文件。文件名必须以 synth- 开头（D-04），否则抛错。
// #importJson 带 hidden 类，setInputFiles 对隐藏的 input 也可用
export async function chooseImportFile(page: Page, file: ImportFile) {
  if (!/^synth-[A-Za-z0-9._-]+$/.test(file.name)) {
    throw new Error(`导入文件名必须以 synth- 开头且只含字母、数字、点、下划线、连字符（D-04）：${file.name}`);
  }
  await page
    .locator('#importJson')
    .setInputFiles({ name: file.name, mimeType: file.mimeType, buffer: Buffer.from(file.text, 'utf8') });
}

// 注册下一个对话框的处理函数（只处理一次），返回记录对话框消息的数组。
// 必须在 chooseImportFile 之前调用（D-05）
export function answerNextDialog(page: Page, answer: 'accept' | 'dismiss'): string[] {
  const messages: string[] = [];
  page.once('dialog', async (dialog) => {
    messages.push(dialog.message());
    if (answer === 'accept') {
      await dialog.accept();
    } else {
      await dialog.dismiss();
    }
  });
  return messages;
}

// 记录每个对话框的消息并一律拒绝（拒绝永远不会替换数据）。
// 用于“不应弹出对话框”的用例：用例结束前断言返回的数组为空
export function recordDialogs(page: Page): string[] {
  const messages: string[] = [];
  page.on('dialog', async (dialog) => {
    messages.push(dialog.message());
    await dialog.dismiss();
  });
  return messages;
}
