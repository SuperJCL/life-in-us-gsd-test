// 读取 tests/fixtures 下的 JSON fixture。
import fs from 'node:fs';
import path from 'node:path';

// 每次调用都重新读取并解析，用例拿到的是各自独立的对象，改了也不影响别的用例。
// 只接受 .json 文件名；name 不能带路径分隔符。
// path.basename 在 Windows 上同时识别 / 和 \，所以反斜杠写的目录穿越也会被拒绝。
export function loadFixture(name: string): any {
  if (!name.endsWith('.json') || path.basename(name) !== name) {
    throw new Error(`loadFixture 只接受 tests/fixtures 下的 .json 文件名：${name}`);
  }
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8'));
}

// 返回 state 的 JSON 深拷贝，并去掉顶层 _synthetic；参数为 null 时返回 null。
// 应用的 normalize 会丢掉未知键，所以导出的备份和写回账户文档里都没有 _synthetic，
// 与种子比较时要先把种子里的 _synthetic 去掉。
export function withoutSynthetic(state: any): any {
  if (state === null) return null;
  const copy = JSON.parse(JSON.stringify(state));
  delete copy._synthetic;
  return copy;
}
