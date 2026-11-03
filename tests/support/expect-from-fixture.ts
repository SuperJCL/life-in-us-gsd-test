// 从 fixture 推导期望值的纯函数（D-13）。
// 不导入应用代码，也不读取应用源码：规则都是按应用的行为独立写出的规格。
import { CAT_OTHER, CATEGORY_NAMES, CSV_DONE_PREFIX, CSV_DUE_PREFIX, CSV_GROUP_SUFFIX, CSV_HEADER, LEGACY_CATEGORY_MAP } from './strings';

export type SynthLog = { id: string; date: string; text: string; cat: string };

// date 在 [start, end] 之间（含两端，YYYY-MM-DD 字符串比较）的记录，保持 fixture 里的顺序
export function logsInWeek(state: { logs: SynthLog[] }, start: string, end: string): SynthLog[] {
  return state.logs.filter((l) => l.date >= start && l.date <= end);
}

// 与 logsInWeek 互补：不在 [start, end] 内的记录
export function logsOutsideWeek(state: { logs: SynthLog[] }, start: string, end: string): SynthLog[] {
  return state.logs.filter((l) => l.date < start || l.date > end);
}

export type TaskBuckets = { done: string[]; overdue: string[]; dueToday: string[]; dueFuture: string[] };

// 把 state.tasks 里所有任务（内置和自定义）按状态分桶。
// done：done 为真且有 doneDate；其余只看未完成的：due 早于 today 是 overdue，等于是 dueToday，晚于是 dueFuture。
// 日期都是 YYYY-MM-DD 字符串比较，与应用的规则一致。
export function taskBuckets(state: { tasks: Record<string, any> }, today: string): TaskBuckets {
  const out: TaskBuckets = { done: [], overdue: [], dueToday: [], dueFuture: [] };
  for (const [id, s] of Object.entries(state.tasks ?? {})) {
    if (s.done && s.doneDate) {
      out.done.push(id);
    } else if (!s.done && s.due) {
      if (s.due < today) out.overdue.push(id);
      else if (s.due === today) out.dueToday.push(id);
      else out.dueFuture.push(id);
    }
  }
  return out;
}

// state.tasks 里的内置任务 id（P<组号>-<序号>），按组号、再按序号的数值排序
export function builtinTaskIds(state: { tasks: Record<string, any> }): string[] {
  const num = (id: string) => id.slice(1).split('-').map(Number);
  return Object.keys(state.tasks ?? {})
    .filter((id) => /^P\d-\d+$/.test(id))
    .sort((a, b) => {
      const [ag, ai] = num(a);
      const [bg, bi] = num(b);
      return ag - bg || ai - bi;
    });
}

// 自定义待办，原样返回
export function customTasks(state: { custom: { id: string; group: string; text: string }[] }) {
  return state.custom;
}

// 应用 normalize 的类别规格：旧类别名映射到新类别，当前类别原样保留，其余一律归为“其他”。
// 独立实现，不导入应用代码。
export function expectedCategory(cat: string): string {
  const legacy: Record<string, string> = LEGACY_CATEGORY_MAP;
  if (cat in legacy) return legacy[cat];
  if ((CATEGORY_NAMES as readonly string[]).includes(cat)) return cat;
  return CAT_OTHER;
}

// ---- 日历 CSV 的独立期望（D-15）----
// 下面三个函数是 D-15 规格的独立实现，不导入应用代码。
// 内置任务的文字由调用者在运行时从页面读出后传进来（D-14），本文件不保存任何任务文字。

// 单元格含双引号、逗号或换行时用双引号包起来，内部每个双引号写成两个；否则原样返回
export function csvCell(value: string): string {
  return /[",\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
}

// YYYY-MM-DD -> MM/DD/YYYY
export function usDate(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return `${m}/${d}/${y}`;
}

// 失败输出的脱敏（D-14）：把运行时读到的内置任务文字换成 <task:ID>，
// 这样 CSV 比较失败时，终端、报告和 CI 日志里只有 id，不含个人计划文字。
// 原文含双引号时 CSV 里是写成两个双引号的形式，两种写法都要替换；
// 先换长的文字，避免某条文字是另一条的子串时留下残片。
export function maskTaskTexts(csv: string, texts: Map<string, string>): string {
  const entries = [...texts].sort((a, b) => b[1].length - a[1].length);
  let out = csv;
  for (const [id, text] of entries) {
    if (!text) continue;
    const placeholder = `<task:${id}>`;
    out = out.split(text.replace(/"/g, '""')).join(placeholder);
    out = out.split(text).join(placeholder);
  }
  return out;
}

// 比较实际 CSV 与期望 CSV，要求逐字节相同；不同时只返回一条不含任务正文的诊断文字。
// 判定用原始字符串直接比较（逐字节、不经过脱敏）；脱敏只用于构造诊断。
// 诊断里：先按 maskTaskTexts 脱敏；脱敏后仍以任务前缀开头、又没有 <task:ID> 占位符、也不是合成文字的行
// （例如应用把任务文字改写了），整行用 <redacted task row> 代替，保证不会把正文打印出来。
export function csvMismatch(
  actual: string,
  expected: string,
  texts: Map<string, string>,
): string | null {
  if (actual === expected) return null;
  const isTaskRow = (line: string) => {
    const body = line.startsWith('"') ? line.slice(1) : line;
    return body.startsWith(CSV_DONE_PREFIX) || body.startsWith(CSV_DUE_PREFIX);
  };
  const toLines = (csv: string) =>
    maskTaskTexts(csv, texts)
      .split('\n')
      .map((line) =>
        isTaskRow(line) && !line.includes('<task:') && !line.includes('SYNTH') ? '<redacted task row>' : line,
      );
  const a = toLines(actual);
  const e = toLines(expected);
  const max = Math.max(a.length, e.length);
  for (let i = 0; i < max; i++) {
    if (a[i] !== e[i]) {
      return (
        `CSV 与期望不一致（已脱敏）：实际 ${a.length} 行，期望 ${e.length} 行；` +
        `第 ${i + 1} 行不同\n  实际：${a[i] ?? '<无>'}\n  期望：${e[i] ?? '<无>'}`
      );
    }
  }
  // 脱敏后的行都相同，说明差别藏在被脱敏的任务文字里（例如换行、行尾空白以外的字节）
  return `CSV 与期望不一致，但差别只在被脱敏的任务文字里（实际 ${actual.length} 字符，期望 ${expected.length} 字符）`;
}

// 整份日历 CSV 文本：表头，记录行（按 state.logs 的顺序），任务行（内置任务按组号、序号，再按 state.custom 的顺序）。
// 行之间用 \n 连接，末尾没有换行。
export function expectedCalendarCsv(
  state: { logs: SynthLog[]; tasks: Record<string, any>; custom: { id: string; group: string; text: string }[] },
  taskText: (id: string) => string,
): string {
  const rows: string[][] = [CSV_HEADER.split(',')];
  for (const l of state.logs) {
    // slice 按 UTF-16 码元计数，与 JS 一致
    rows.push([`[${l.cat}] ` + l.text.split('\n')[0].slice(0, 80), usDate(l.date), 'True', l.text]);
  }
  const taskRows = (text: string, group: string, s: any) => {
    if (s.done && s.doneDate) rows.push([CSV_DONE_PREFIX + text, usDate(s.doneDate), 'True', group + CSV_GROUP_SUFFIX]);
    else if (s.due) rows.push([CSV_DUE_PREFIX + text, usDate(s.due), 'True', group + CSV_GROUP_SUFFIX]);
  };
  for (const id of builtinTaskIds(state)) {
    taskRows(taskText(id), id.split('-')[0], state.tasks[id] ?? {});
  }
  for (const c of state.custom) {
    taskRows(c.text, c.group, state.tasks?.[c.id] ?? {});
  }
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}
