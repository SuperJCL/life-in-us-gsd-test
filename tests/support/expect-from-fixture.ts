// 从 fixture 推导期望值的纯函数（D-13）。
// 不导入应用代码，也不读取应用源码：规则都是按应用的行为独立写出的规格。
import { CAT_OTHER, CATEGORY_NAMES, LEGACY_CATEGORY_MAP } from './strings';

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
