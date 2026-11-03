// 读取 tests/fixtures 下的 JSON fixture。
import fs from 'node:fs';
import path from 'node:path';

// 每次调用都重新读取并解析，用例拿到的是各自独立的对象，改了也不影响别的用例。
// 只接受 .json 文件名；name 不能带路径分隔符。
export function loadFixture(name: string): any {
  if (!name.endsWith('.json') || /[\/]/.test(name)) {
    throw new Error(`loadFixture 只接受 tests/fixtures 下的 .json 文件名：${name}`);
  }
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', name), 'utf8'));
}
