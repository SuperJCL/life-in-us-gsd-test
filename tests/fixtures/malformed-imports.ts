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
