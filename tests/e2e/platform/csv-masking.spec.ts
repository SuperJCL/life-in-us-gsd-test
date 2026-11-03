// CSV 脱敏逻辑（csvMismatch、maskTaskTexts）的常驻反向对照（IN-07）。
// 纯函数用例，不需要浏览器；全部用合成文字，不含任何个人计划文字。
// 目的：将来有人改动 csvMismatch 时，如果脱敏被悄悄弄坏，这里会变红。
import { test, expect } from '../../support/test';
import { csvMismatch, maskTaskTexts } from '../../support/expect-from-fixture';
import { CSV_DONE_PREFIX, CSV_DUE_PREFIX, CSV_GROUP_SUFFIX, CSV_HEADER } from '../../support/strings';

// 假的“内置任务文字”：以 SYNTH- 开头，只在本文件里出现
const TEXT_A = 'SYNTH-masking-task-alpha';
const TEXT_QUOTED = 'SYNTH-masking say "hi", ok';
const texts = new Map<string, string>([
  ['P1-0', TEXT_A],
  ['P2-1', TEXT_QUOTED],
]);

const csvOf = (...rows: string[]) => [CSV_HEADER, ...rows].join('\n');
const rowA = (date: string) => `${CSV_DONE_PREFIX}${TEXT_A},${date},True,P1${CSV_GROUP_SUFFIX}`;
// 含双引号的文字在 CSV 里写成两个双引号，整个单元格再加引号
const rowQuoted = (date: string) =>
  `"${CSV_DUE_PREFIX}${TEXT_QUOTED.replace(/"/g, '""')}",${date},True,P2${CSV_GROUP_SUFFIX}`;

test('IO-02 csvMismatch returns null for identical CSV text', () => {
  const csv = csvOf(rowA('03/01/2026'), rowQuoted('03/02/2026'));
  expect(csvMismatch(csv, csv, texts)).toBeNull();
});

test('IO-02 csvMismatch reports a difference without printing known task text', () => {
  const expected = csvOf(rowA('03/01/2026'), rowQuoted('03/02/2026'));
  const actual = csvOf(rowA('03/09/2026'), rowQuoted('03/02/2026'));
  const mismatch = csvMismatch(actual, expected, texts);

  expect(mismatch).not.toBeNull();
  const text = mismatch as string;
  expect(text.includes(TEXT_A), '诊断里出现了任务文字').toBe(false);
  expect(text.includes('<task:P1-0>'), '诊断里没有占位符').toBe(true);
});

test('IO-02 csvMismatch masks task text that contains double quotes in both CSV spellings', () => {
  const expected = csvOf(rowQuoted('03/02/2026'));
  const actual = csvOf(rowQuoted('03/20/2026'));
  const text = csvMismatch(actual, expected, texts) as string;

  expect(text).not.toBeNull();
  expect(text.includes('SYNTH-masking say'), '诊断里出现了带引号的任务文字').toBe(false);
  expect(text.includes('<task:P2-1>'), '诊断里没有占位符').toBe(true);

  // maskTaskTexts 对两种写法都要替换：原文和双引号加倍后的形式
  const masked = maskTaskTexts(`${TEXT_QUOTED} | ${TEXT_QUOTED.replace(/"/g, '""')}`, texts);
  expect(masked.includes('SYNTH-masking say'), '脱敏后仍留有任务文字').toBe(false);
});

test('IO-02 csvMismatch redacts a whole task row when the app rewrote the text into something unknown', () => {
  // 应用把任务文字改成了 texts 里没有的内容（也不含 SYNTH）：不能原样打印
  const REWRITTEN = 'unknown-rewritten-text-beta';
  const expected = csvOf(rowA('03/01/2026'));
  const actual = csvOf(`${CSV_DONE_PREFIX}${REWRITTEN},03/01/2026,True,P1${CSV_GROUP_SUFFIX}`);
  const text = csvMismatch(actual, expected, texts) as string;

  expect(text).not.toBeNull();
  expect(text.includes(REWRITTEN), '诊断里出现了被改写的任务文字').toBe(false);
  expect(text.includes('<redacted task row>'), '诊断里没有整行脱敏标记').toBe(true);
});

test('IO-02 csvMismatch still reports a difference when the bytes right after masked task text differ', () => {
  // 脱敏文字后面紧跟的字节不同，判定仍然是不一致（判定用原始字符串，不用脱敏后的文本）
  const other = new Map<string, string>([['P1-0', 'SYNTH-masking-task-gamma']]);
  const a = csvOf(`${CSV_DONE_PREFIX}SYNTH-masking-task-gamma,03/01/2026,True,P1${CSV_GROUP_SUFFIX}`);
  const e = csvOf(`${CSV_DONE_PREFIX}SYNTH-masking-task-gamma,03/01/2026,True,P1${CSV_GROUP_SUFFIX}`);
  expect(csvMismatch(a, e, other)).toBeNull();

  const e2 = csvOf(`${CSV_DONE_PREFIX}SYNTH-masking-task-gamma ,03/01/2026,True,P1${CSV_GROUP_SUFFIX}`);
  const text = csvMismatch(a, e2, other);
  expect(text).not.toBeNull();
  expect((text as string).includes('SYNTH-masking-task-gamma'), '诊断里出现了任务文字').toBe(false);
});
