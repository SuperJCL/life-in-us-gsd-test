// 在 Node 里直接求值应用的纯函数段（PLAN-05、SEC-01、SEC-02 的单元用例用）。
//
// 为什么要白盒：normalizePlan、normalize 这类纯函数分支很多，在 node:vm 里求值只要几毫秒、不用开浏览器，
// 对本机资源有限的情况很友好；页面路径（加载、导入、渲染）仍然由浏览器用例覆盖，两条路径不互相替代。
// 期望值必须在用例里独立写出，不读应用的实现；这里只按两个标记切段，不读也不返回计划文字。
// live（可选）：要按“调用时的当前值”读的模块级绑定（plan、planIds、keepOrphans 这类会被 usePlan 重新赋值的 let）。
// names 拿到的是求值那一刻的快照，之后绑定被改了也看不出来；live 里的名字通过返回对象的 readLive() 在同一个 vm 上下文里现读，不做 JSON 往返。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { APP_FILE_NAME } from './constants';

// 纯函数段的起止标记：起点是第一个常量声明，终点是 saving 横幅。这一段只含常量和纯函数，求值时不碰 DOM
export const APP_PURE_START = 'const CATS=';
export const APP_PURE_END = '/* ---------- saving ---------- */';

function occurrences(text: string, marker: string): number {
  let n = 0;
  let at = text.indexOf(marker);
  while (at !== -1) {
    n += 1;
    at = text.indexOf(marker, at + marker.length);
  }
  return n;
}

// 读仓库根目录的应用文件，切出纯函数段，在新的 vm 上下文里求值，返回 names 里列出的绑定。
// 两个标记都必须恰好出现一次，否则抛出只含标记名和次数的错误。每次调用都重新求值，用例之间互不影响。
// 返回的对象和函数属于 vm 的 realm：比较对象前先做 JSON 往返；函数在它们自己的上下文里读写模块级状态
export function loadAppPure(names: readonly string[], live: readonly string[] = []): Record<string, any> {
  for (const name of [...names, ...live]) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(`loadAppPure 只接受标识符：${name}`);
    }
  }
  if (names.includes('readLive')) throw new Error('loadAppPure：names 里不能有 readLive（它是 live 返回的键）');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', APP_FILE_NAME), 'utf8');
  const starts = occurrences(html, APP_PURE_START);
  const ends = occurrences(html, APP_PURE_END);
  if (starts !== 1) throw new Error(`起始标记 ${APP_PURE_START} 出现了 ${starts} 次，应当恰好 1 次`);
  if (ends !== 1) throw new Error(`结束标记 ${APP_PURE_END} 出现了 ${ends} 次，应当恰好 1 次`);
  const from = html.indexOf(APP_PURE_START);
  const to = html.indexOf(APP_PURE_END);
  if (to < from) throw new Error('结束标记出现在起始标记之前');
  // live 为空时拼出的源码与加 live 参数之前逐字相同；非空时多一个 readLive 箭头函数，闭包捕获脚本顶层的 let 绑定本身
  const entries = live.length ? [...names, `readLive:()=>({${live.join(',')}})`] : [...names];
  const source = `${html.slice(from, to)}\n;({${entries.join(',')}})`;
  return vm.runInNewContext(source, {}, { timeout: 1000 });
}
