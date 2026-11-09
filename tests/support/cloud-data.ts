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
