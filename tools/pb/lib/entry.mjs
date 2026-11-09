// 入口判断（WR-02）：脚本是不是被当作入口直接运行。零依赖，只用 node: 内置模块。
//
// 以前各脚本用 import.meta.url 和 process.argv[1] 的字符串比较，两边只要不一致（仓库路径经过目录联接或符号链接、
// 大小写不同）就什么都不做、不打印、退出码 0——安全闸门“没有运行”被当成“通过”。这里对两边都做 realpathSync
// （win32 上不分大小写）；判断过程出错时按“是入口”处理（fail closed，宁可多运行）。
// 唯一返回 false 的情况：确认没有入口脚本（process.argv[1] 为空，例如 node -e 或被别的程序加载），
// 或者两个真实路径确实不同（被 import）。
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isEntry(metaUrl, argv1 = process.argv[1], platform = process.platform) {
  try {
    if (!argv1) return false;
    let self = realpathSync(fileURLToPath(metaUrl));
    let entry = realpathSync(resolve(argv1));
    if (platform === 'win32') {
      self = self.toLowerCase();
      entry = entry.toLowerCase();
    }
    return self === entry;
  } catch {
    return true;
  }
}
