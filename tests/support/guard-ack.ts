// 故意制造的错误响应或被拒连接，浏览器会为每一条写一条 console.error。
// 先断言恰好是预期的这几条，再用 guard.remove 删掉；其他任何 console.error、页面异常或外部请求仍会让用例失败。
// 只用 import type 引 GuardHandle：test.ts 间接依赖本目录，避免循环导入。
import { expect } from '@playwright/test';
import type { GuardHandle } from './test';

// expected：片段 -> 条数。片段要精确到状态码（例如 `status of 400 `，注意末尾空格）或错误码（例如 `ERR_CONNECTION_REFUSED`），
// 不要用 `Failed to load resource` 这类宽泛的文字，否则会把别的违规一起算进去。
export async function acknowledgeConsoleErrors(guard: GuardHandle, expected: Record<string, number>): Promise<void> {
  const total = Object.values(expected).reduce((sum, n) => sum + n, 0);
  await expect
    .poll(() => guard.state.consoleErrors.length, { message: '等待浏览器报出预期的 console.error' })
    .toBe(total);
  for (const [needle, count] of Object.entries(expected)) {
    expect(guard.state.consoleErrors.filter((text) => text.includes(needle)), `含 ${needle} 的 console.error 条数`).toHaveLength(count);
    expect(guard.remove('consoleErrors', needle)).toBe(count);
  }
}
