// 只在内存里改应用的变体（SEC-01，D-09）。
//
// 做法：读仓库根目录的应用文件，把每个 find 恰好替换一次，再用 page.route 只给这一个 page 提供改过的页面。
// 磁盘上的应用文件和静态服务器都不变，别的用例和正式页面看到的永远是原文件（SAFE-02 照旧通过）。
// 用途：证明两道防线各自独立。入口检查（normalize、导入检查）会先把坏 id 和坏日期修掉，
// 必须绕过它才看得到渲染防线本身；反过来，关掉转义的变体用来证明检测器不是空转。
// 只从 @playwright/test、node 内置模块和 ./constants 导入；必须在 app.open() 之前调用。
import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { APP_FILE_NAME, APP_ORIGIN } from './constants';

export type AppEdit = { find: string; replace: string };

// 绕过入口检查：normalize 在函数开头直接返回原样透传的对象，原函数体变成不可达代码，语法仍然合法
export const BYPASS_NORMALIZE: AppEdit = {
  find: 'function normalize(s){',
  replace:
    'function normalize(s){return Object.assign({arrival:"",tasks:{},custom:[],logs:[],lifts:{},reviews:{},presets:{}},s);',
};

// 关掉转义：esc 原样输出，原来的转义表达式改名为 escOff 保持语法合法
export const DISABLE_ESCAPING: AppEdit = {
  find: 'const esc=s=>String(s).replace(',
  replace: 'const esc=s=>String(s);const escOff=s=>String(s).replace(',
};

// 计划值变体：在 DEFAULT_PLAN 定义之后、第一次 usePlan 之前，插入只改 DEFAULT_PLAN 字段的赋值语句。
// 07-02 之后的声明顺序是：DEFAULT_PLAN、normalizePlan、usePlan、`usePlan(DEFAULT_PLAN);`，
// 所以插在 `function normalizePlan(` 之前的语句，先于任何一次 usePlan 执行；值都是字符串，normalizePlan 照常接受。
// 入口检查（normalize、导入检查）一处不绕过；变体只在内存里、只给这一个 page。
// 目的只是证明渲染防线对计划值也成立（D-09）。
const PLAN_PATH_RE = /^[A-Za-z]+(\.[A-Za-z]+|\[\d+\])*$/;
export function planValueEdit(values: readonly { path: string; value: string }[]): AppEdit {
  const statements = values.map(({ path: p, value }) => {
    if (!PLAN_PATH_RE.test(p)) {
      throw new Error(`planValueEdit 的 path 不合法：${p}`);
    }
    // 应用代码在内联 script 里，字面量里的结束标签会让 HTML 解析器提前结束 script 元素，所以把每个 < 写成转义形式
    const literal = JSON.stringify(value).replace(/</g, '\\u003c');
    return `DEFAULT_PLAN.${p}=${literal};`;
  });
  return {
    find: 'function normalizePlan(',
    replace: statements.join('\n') + '\nfunction normalizePlan(',
  };
}

function occurrences(text: string, marker: string): number {
  let n = 0;
  let at = text.indexOf(marker);
  while (at !== -1) {
    n += 1;
    at = text.indexOf(marker, at + marker.length);
  }
  return n;
}

// 读应用文件、依次替换、只给这一个 page 提供。每个 find 必须恰好出现一次，否则抛出只含标记和次数的错误。
export async function serveAppVariant(page: Page, edits: readonly AppEdit[]): Promise<void> {
  let body = fs.readFileSync(path.join(__dirname, '..', '..', APP_FILE_NAME), 'utf8');
  for (const edit of edits) {
    const n = occurrences(body, edit.find);
    if (n !== 1) {
      throw new Error(`变体标记 ${edit.find} 出现了 ${n} 次，应当恰好 1 次`);
    }
    body = body.split(edit.find).join(edit.replace);
  }
  await page.route(APP_ORIGIN + '/', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }),
  );
}
