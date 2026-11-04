// 从 fixture 推导期望值的纯函数（D-13）。
// 不导入应用代码，也不读取应用源码：规则都是按应用的行为独立写出的规格。
import {
  CAT_OTHER,
  CELL_ARIA_DONE_SUFFIX,
  CELL_ARIA_DUE_SUFFIX,
  CELL_ARIA_LOGS_SUFFIX,
  CATEGORY_NAMES,
  COMPOSER_WHEN_PREFIX,
  CSV_DONE_PREFIX,
  CSV_DUE_PREFIX,
  CSV_GROUP_SUFFIX,
  CSV_HEADER,
  DAY_ARIA_SEPARATOR,
  DAY_ARIA_SUFFIX,
  DAY_SUFFIX,
  GROUP_CATEGORY,
  LEGACY_CATEGORY_MAP,
  MONTH_SUFFIX,
  MONTH_TITLE_MONTH_SUFFIX,
  MONTH_TITLE_YEAR_SEP,
  WEEKDAY_CHARS,
  WEEKDAY_PREFIX,
  WEEK_RANGE_SEPARATOR,
  WEEK_TITLE_ARRIVAL_PREFIX,
  WEEK_TITLE_ARRIVAL_SUFFIX,
  WEEK_TITLE_CURRENT,
  WEEK_TITLE_OTHER,
} from './strings';

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

// ---- 本周视图的独立期望（WEEK-01、WEEK-02，D-10）----
// 下面的函数都是按应用的行为独立写出的规格，不导入、不读取应用代码。
// 日期计算一律用 UTC，避免依赖机器时区；周一是一周的第一天。

type WeekState = {
  logs: SynthLog[];
  tasks: Record<string, any>;
  custom: { id: string; group: string; text: string }[];
};

const DAY_MS = 86_400_000;

function utcMs(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function ymdOfMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// ymd 加 n 天（n 可为负）
export function ymdAddDays(ymd: string, n: number): string {
  return ymdOfMs(utcMs(ymd) + n * DAY_MS);
}

// ymd 所在周的周一
export function mondayOf(ymd: string): string {
  const dow = new Date(utcMs(ymd)).getUTCDay(); // 周日为 0
  return ymdAddDays(ymd, -((dow + 6) % 7));
}

// 月和日去掉前导零，形如 3月5日
export function mdLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}${MONTH_SUFFIX}${d}${DAY_SUFFIX}`;
}

// 周X
export function weekdayLabel(ymd: string): string {
  return WEEKDAY_PREFIX + WEEKDAY_CHARS[new Date(utcMs(ymd)).getUTCDay()];
}

// composer 下方的“记录到 M月D日 周X”
export function composerWhenLabel(ymd: string): string {
  return `${COMPOSER_WHEN_PREFIX}${mdLabel(ymd)} ${weekdayLabel(ymd)}`;
}

// 周范围：周日与周一同月时只写日数，否则写完整的月日
export function expectedWeekRange(weekStart: string): string {
  const end = ymdAddDays(weekStart, 6);
  const sameMonth = weekStart.slice(5, 7) === end.slice(5, 7);
  const endLabel = sameMonth ? `${Number(end.slice(8))}${DAY_SUFFIX}` : mdLabel(end);
  return mdLabel(weekStart) + WEEK_RANGE_SEPARATOR + endLabel;
}

// 周标题：有抵达日期且本周不早于抵达周时写“来美国第 N 周”；否则是今天所在周时写“本周”；其余是“这一周”
export function expectedWeekTitle(arrival: string | null | undefined, weekStart: string, today: string): string {
  if (arrival && weekStart >= mondayOf(arrival)) {
    const weeks = Math.round((utcMs(weekStart) - utcMs(mondayOf(arrival))) / (7 * DAY_MS));
    return `${WEEK_TITLE_ARRIVAL_PREFIX}${weeks + 1}${WEEK_TITLE_ARRIVAL_SUFFIX}`;
  }
  return weekStart === mondayOf(today) ? WEEK_TITLE_CURRENT : WEEK_TITLE_OTHER;
}

// [start, end] 内完成的计划：先内置（按组号、序号），再自定义（按 state.custom 的顺序）；
// 内置计划的 group 是 id 横线前的部分。只有 id 和组号，不含任何计划文字
function doneTasksBetween(state: WeekState, start: string, end: string): { id: string; group: string }[] {
  const inRange = (s: any) => !!s && !!s.done && typeof s.doneDate === 'string' && s.doneDate >= start && s.doneDate <= end;
  const out: { id: string; group: string }[] = [];
  for (const id of builtinTaskIds(state)) {
    if (inRange(state.tasks[id])) out.push({ id, group: id.split('-')[0] });
  }
  for (const c of state.custom ?? []) {
    if (inRange(state.tasks?.[c.id])) out.push({ id: c.id, group: c.group });
  }
  return out;
}

// 五个类别卡上的计数，按 CATEGORY_NAMES 的顺序：
// 该周该类的记录数，加上该周完成、所属组归该类的计划数
export function weekCountsByCategory(state: WeekState, weekStart: string): number[] {
  const end = ymdAddDays(weekStart, 6);
  const logs = logsInWeek(state, weekStart, end);
  const done = doneTasksBetween(state, weekStart, end);
  return CATEGORY_NAMES.map(
    (name) => logs.filter((l) => l.cat === name).length + done.filter((t) => GROUP_CATEGORY[t.group] === name).length,
  );
}

// 五个类别各自在该周有记录的不同日期数，按 CATEGORY_NAMES 的顺序（完成的计划不计入）
export function weekGoalDays(state: WeekState, weekStart: string): number[] {
  const end = ymdAddDays(weekStart, 6);
  const logs = logsInWeek(state, weekStart, end);
  return CATEGORY_NAMES.map((name) => new Set(logs.filter((l) => l.cat === name).map((l) => l.date)).size);
}

// 7 列的内容：日期、记录 id（按 state.logs 的顺序）、完成计划的 id（按 doneTasksBetween 的顺序）
export function weekDayColumns(
  state: WeekState,
  weekStart: string,
): { date: string; logIds: string[]; doneTaskIds: string[] }[] {
  return [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = ymdAddDays(weekStart, i);
    return {
      date,
      logIds: state.logs.filter((l) => l.date === date).map((l) => l.id),
      doneTaskIds: doneTasksBetween(state, date, date).map((t) => t.id),
    };
  });
}

// 日期列的 aria-label：月日，条目数，固定后缀
export function dayAriaLabel(date: string, n: number): string {
  return `${mdLabel(date)}${DAY_ARIA_SEPARATOR}${n}${DAY_ARIA_SUFFIX}`;
}

// 时间线条目的日期标签：月和日去掉前导零，用斜杠连接，形如 3/19
export function timelineDateLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}`;
}

// ---- 日历视图的独立期望（CAL-01 到 CAL-04）----
// 下面的函数都是按应用的行为独立写出的规格，不导入、不读取应用代码；日期计算一律用 UTC。

export type DayState = {
  arrival?: string | null;
  logs: SynthLog[];
  tasks: Record<string, any>;
  custom: { id: string; group: string; text: string }[];
};

// 月历的格子：month 为 1-12。起点是当月 1 日所在周的周日；最多 42 格，
// 第 36 格（下标 35）已经不在当月时停在 35 格。out 表示不在当月
export function monthGrid(year: number, month: number): { date: string; out: boolean }[] {
  const first = Date.UTC(year, month - 1, 1);
  const start = first - new Date(first).getUTCDay() * DAY_MS; // 周日为 0
  const out: { date: string; out: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const ms = start + i * DAY_MS;
    const isOut = new Date(ms).getUTCMonth() !== month - 1;
    if (i === 35 && isOut) break;
    out.push({ date: ymdOfMs(ms), out: isOut });
  }
  return out;
}

// date 这一天的事件，都只是 id：记录按 state.logs 的顺序；任务先内置（组号、序号）再自定义（state.custom 的顺序）。
// 规则：已完成的任务只在完成日算 done，不会再作为到期出现；未完成的任务在截止日算 due
export function eventsOnDate(state: DayState, date: string): { logs: string[]; due: string[]; done: string[] } {
  const out = { logs: state.logs.filter((l) => l.date === date).map((l) => l.id), due: [] as string[], done: [] as string[] };
  const ids = [...builtinTaskIds(state), ...(state.custom ?? []).map((c) => c.id)];
  for (const id of ids) {
    const s = state.tasks?.[id] ?? {};
    if (s.done && s.doneDate === date) out.done.push(id);
    else if (!s.done && s.due === date) out.due.push(id);
  }
  return out;
}

// 格子的 aria-label：M月D日，N 条记录，N 项到期，N 项完成（逗号是全角）
export function cellAriaLabel(date: string, counts: { logs: number; due: number; done: number }): string {
  const sep = DAY_ARIA_SEPARATOR;
  return (
    `${mdLabel(date)}${sep}${counts.logs}${CELL_ARIA_LOGS_SUFFIX}` +
    `${sep}${counts.due}${CELL_ARIA_DUE_SUFFIX}${sep}${counts.done}${CELL_ARIA_DONE_SUFFIX}`
  );
}

// 月份标题：YYYY 年 M 月，月不补零
export function monthTitle(year: number, month: number): string {
  return `${year}${MONTH_TITLE_YEAR_SEP}${month}${MONTH_TITLE_MONTH_SUFFIX}`;
}

export type MonthCell = {
  date: string;
  out: boolean;
  today: boolean;
  sel: boolean;
  arr: boolean;
  aria: string;
  day: string;
  kinds: ('log' | 'due' | 'done')[];
  more: string | null;
};

// 整月每一格的期望：类、aria-label、日号、前 3 个 chip 的种类（记录、到期、完成的顺序）和“+N”
export function expectedMonthCells(
  state: DayState,
  year: number,
  month: number,
  today: string,
  sel: string,
): MonthCell[] {
  return monthGrid(year, month).map(({ date, out }) => {
    const e = eventsOnDate(state, date);
    const all: ('log' | 'due' | 'done')[] = [
      ...e.logs.map(() => 'log' as const),
      ...e.due.map(() => 'due' as const),
      ...e.done.map(() => 'done' as const),
    ];
    return {
      date,
      out,
      today: date === today,
      sel: date === sel,
      arr: date === state.arrival,
      aria: cellAriaLabel(date, { logs: e.logs.length, due: e.due.length, done: e.done.length }),
      day: String(Number(date.slice(8))),
      kinds: all.slice(0, 3),
      more: all.length > 3 ? `+${all.length - 3}` : null,
    };
  });
}
