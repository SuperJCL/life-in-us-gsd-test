// cloud 用例共用的合成数据构造函数。只放合成数据，不导入应用，也不抄个人计划文字。

// 合成 state：带 _synthetic 标记和一条合成记录；label 区分不同账号，extra 的字段并进结果。
// 记录日期在冻结周（2026-03-16 到 2026-03-22）内，所以本周视图能看到它。
export function syntheticState(label: string, extra?: Record<string, unknown>) {
  return {
    _synthetic: true,
    logs: [{ id: `synthetic-${label}`, date: '2026-03-17', cat: '语言', text: `合成记录 ${label}` }],
    ...extra,
  };
}

// 大体积合成 state：用中文合成文字（UTF-8 每字 3 字节）凑到 targetBytes 附近，用来触发容量警告和超限。
// 记录日期在冻结周之外，所以不会渲染进本周视图；字节数用 Buffer.byteLength(JSON.stringify(...)) 计算，
// 结果落在 targetBytes 以下、相差不超过 3 字节（一个中文字的宽度）。内容只有 _synthetic 标记和合成记录。
export function bulkyState(label: string, targetBytes: number) {
  const CHUNK = 20000; // 每条记录最多的字数，条数因此是“若干条”而不是一条超大记录
  const logs: Array<{ id: string; date: string; cat: string; text: string }> = [];
  const measure = () => Buffer.byteLength(JSON.stringify({ _synthetic: true, logs }));
  for (let i = 0; ; i += 1) {
    const record = { id: `synthetic-${label}-${i}`, date: '2025-01-05', cat: '语言', text: '' };
    logs.push(record);
    const remaining = targetBytes - measure();
    const chars = Math.min(CHUNK, Math.floor(remaining / 3));
    if (chars <= 0) {
      logs.pop();
      break;
    }
    record.text = '合'.repeat(chars);
    if (chars < CHUNK) break;
  }
  return { _synthetic: true, logs };
}
