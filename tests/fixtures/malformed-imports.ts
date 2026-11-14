// _synthetic：畸形导入内容，只在内存里使用，磁盘上没有对应文件。
// Phase 5 会用 setInputFiles 的 buffer 形式传入这些内容；应用对它们的期望行为由 Phase 5 决定。
// 这里只保证它们确实畸形，不断言应用怎么处理。

export type MalformedKind = 'not-json' | 'json-not-object' | 'json-wrong-field-types';

export type MalformedImport = { name: string; mimeType: string; kind: MalformedKind; text: string };

export const MALFORMED_IMPORTS: readonly MalformedImport[] = [
  { name: 'synth-not-json.json', mimeType: 'application/json', kind: 'not-json', text: 'SYNTH-not json {' },
  { name: 'synth-truncated.json', mimeType: 'application/json', kind: 'not-json', text: '{"_synthetic":"SYNTH","logs":[' },
  { name: 'synth-notes.txt', mimeType: 'text/plain', kind: 'not-json', text: 'SYNTH plain text notes' },
  { name: 'synth-null.json', mimeType: 'application/json', kind: 'json-not-object', text: 'null' },
  { name: 'synth-array.json', mimeType: 'application/json', kind: 'json-not-object', text: '[]' },
  {
    name: 'synth-wrong-types.json',
    mimeType: 'application/json',
    kind: 'json-wrong-field-types',
    text: JSON.stringify({
      _synthetic: 'SYNTH',
      logs: 'not-an-array',
      tasks: 5,
      custom: {},
      arrival: 20260318,
    }),
  },
];

// Phase 15：三个带坏训练的备份（本身是合法 JSON、其余字段合格，只有 workouts 不合格），importProblem 返回 workout，整份拒绝。
// 单独导出，不并进上面的清单：那份清单的条数和类别由别的用例固定。
export type MalformedWorkoutImport = { name: string; mimeType: string; reason: string; text: string };

const woBackup = (workouts: unknown) =>
  JSON.stringify({ _synthetic: 'SYNTH malformed workout backup', arrival: '', logs: [], custom: [], tasks: {}, lifts: {}, reviews: {}, presets: {}, workouts });

export const MALFORMED_WORKOUT_IMPORTS: readonly MalformedWorkoutImport[] = [
  {
    name: 'synth-workout-bad-date.json',
    mimeType: 'application/json',
    reason: 'date key is not a real date',
    text: woBackup({ '2026-02-31': { lifts: [{ id: 'bench', sets: [{ w: 40, r: 5 }] }], cardio: [] } }),
  },
  {
    name: 'synth-workout-bad-lift-id.json',
    mimeType: 'application/json',
    reason: 'lift id has the log prefix',
    text: woBackup({ '2026-03-16': { lifts: [{ id: 'L-bad', sets: [{ w: 40, r: 5 }] }], cardio: [] } }),
  },
  {
    name: 'synth-workout-bad-cardio-id.json',
    mimeType: 'application/json',
    reason: 'cardio id lacks the r- prefix',
    text: woBackup({ '2026-03-16': { lifts: [], cardio: [{ id: 'run', m: 30 }] } }),
  },
];
