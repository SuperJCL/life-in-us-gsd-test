// 从 fixture 推导期望值的纯函数（D-13）。
// 不导入应用代码，也不读取应用源码：规则都是按应用的行为独立写出的规格。

export type SynthLog = { id: string; date: string; text: string; cat: string };

// date 在 [start, end] 之间（含两端，YYYY-MM-DD 字符串比较）的记录，保持 fixture 里的顺序
export function logsInWeek(state: { logs: SynthLog[] }, start: string, end: string): SynthLog[] {
  return state.logs.filter((l) => l.date >= start && l.date <= end);
}
