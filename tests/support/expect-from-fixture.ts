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
