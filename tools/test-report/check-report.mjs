#!/usr/bin/env node
// Playwright json 报告检查器：零依赖，只使用 node: 内置模块。
//
// 为什么需要它：playwright.config.ts 设置了 retries: 1，命令的退出码区分不了“一次通过”和“重试后才通过（flaky）”，
// 也看不出用例是不是被过滤掉没跑。所以每次跑测试的 verify 都写 json 报告，再由本脚本判定。
//
// 用法：
//   node tools/test-report/check-report.mjs <报告文件> [标题 ...]
//   node tools/test-report/check-report.mjs --self-test
//
// 判定（全部满足才通过）：
//   1. 报告顶层的 errors 为空；
//   2. stats.unexpected 为 0，stats.flaky 为 0，stats.expected 大于 0；
//   3. 命令行上列出的每个标题，至少有一个 spec 的 title 与它完全相等，
//      并且这些 spec 下的每个 test 的 status 都是 expected（test.fail 预期失败的标记用例也是 expected），
//      或者 status 是 skipped 且 test 或它任一 result 的 annotations 里有 type 为 known-bug 的项（knownBug 的 fixme 退路）。
//
// 退出码：0 通过；1 不通过（包括报告缺失或不是合法 JSON）。
//
// 隐私约定：只打印计数和标题（标题都是英文或合成文字）；不打印报告里的错误信息和附件，
// 因为它们可能带页面文字。报告文件只放在已被 git 忽略的 test-results/ 下。

import { readFileSync } from 'node:fs';

// 递归收集所有 spec（suites 的每层 specs，再往下的 suites）
function collectSpecs(suites, out = []) {
  for (const s of suites ?? []) {
    for (const spec of s.specs ?? []) out.push(spec);
    collectSpecs(s.suites, out);
  }
  return out;
}

function hasKnownBugAnnotation(test) {
  const own = test.annotations ?? [];
  const fromResults = (test.results ?? []).flatMap((r) => r.annotations ?? []);
  return [...own, ...fromResults].some((a) => a && a.type === 'known-bug');
}

// 返回问题清单（空数组表示通过）和计数
export function judge(report, titles = []) {
  const problems = [];
  const stats = (report && report.stats) || {};
  const counts = {
    expected: Number(stats.expected ?? 0),
    flaky: Number(stats.flaky ?? 0),
    unexpected: Number(stats.unexpected ?? 0),
  };
  const errors = Array.isArray(report?.errors) ? report.errors : [];
  if (errors.length > 0) problems.push(`report errors: ${errors.length}`);
  if (counts.unexpected !== 0) problems.push(`unexpected: ${counts.unexpected}`);
  if (counts.flaky !== 0) problems.push(`flaky: ${counts.flaky}`);
  if (!(counts.expected > 0)) problems.push('expected is 0 (nothing ran)');

  const specs = collectSpecs(report?.suites);
  for (const title of titles) {
    const matched = specs.filter((sp) => sp.title === title);
    if (matched.length === 0) {
      problems.push(`title not run: ${title}`);
      continue;
    }
    const bad = matched
      .flatMap((sp) => sp.tests ?? [])
      .filter((t) => !(t.status === 'expected' || (t.status === 'skipped' && hasKnownBugAnnotation(t))));
    if (bad.length > 0) problems.push(`title not passed: ${title}`);
  }
  return { problems, counts };
}

function printResult({ problems, counts }) {
  if (problems.length === 0) {
    console.log(`REPORT OK expected=${counts.expected} flaky=${counts.flaky} unexpected=${counts.unexpected}`);
    return 0;
  }
  console.log(`REPORT FAIL expected=${counts.expected} flaky=${counts.flaky} unexpected=${counts.unexpected}`);
  for (const p of problems) console.log(`  - ${p}`);
  return 1;
}

// 内存里构造最小报告，证明干净的通过、各种坏情况都被拒绝；不读写任何文件
function selfTest() {
  const mk = (status, extra = {}) => ({
    title: extra.title ?? 'T',
    tests: [{ status, annotations: extra.annotations ?? [], results: extra.results ?? [] }],
  });
  const report = (specs, stats, errors = []) => ({
    errors,
    stats: { expected: 1, flaky: 0, unexpected: 0, skipped: 0, ...stats },
    suites: [{ title: 'f.spec.ts', specs: [], suites: [{ title: 'inner', specs }] }],
  });
  const cases = [
    ['clean report passes', report([mk('expected')], {}), ['T'], true],
    ['flaky 1 fails', report([mk('flaky')], { flaky: 1 }), ['T'], false],
    ['unexpected 1 fails', report([mk('unexpected')], { unexpected: 1 }), ['T'], false],
    ['non-empty errors fails', report([mk('expected')], {}, [{ message: 'x' }]), ['T'], false],
    ['missing title fails', report([mk('expected', { title: 'Other' })], {}), ['T'], false],
    ['title only as unexpected fails', report([mk('unexpected')], { expected: 1, unexpected: 0 }), ['T'], false],
    ['expected 0 fails', report([mk('expected')], { expected: 0 }), [], false],
    [
      'skipped with known-bug annotation passes',
      report([mk('skipped', { annotations: [{ type: 'known-bug' }] })], {}),
      ['T'],
      true,
    ],
    [
      'skipped with known-bug annotation on a result passes',
      report([mk('skipped', { results: [{ annotations: [{ type: 'known-bug' }] }] })], {}),
      ['T'],
      true,
    ],
    ['skipped without annotation fails', report([mk('skipped')], {}), ['T'], false],
  ];
  let ok = true;
  for (const [name, rep, titles, want] of cases) {
    const got = judge(rep, titles).problems.length === 0;
    if (got !== want) {
      ok = false;
      console.log(`SELF-TEST case failed: ${name}`);
    }
  }
  if (ok) {
    console.log('SELF-TEST OK');
    return 0;
  }
  console.log('SELF-TEST FAIL');
  return 1;
}

function main(argv) {
  if (argv[0] === '--self-test') return selfTest();
  if (argv.length === 0) {
    console.log('REPORT FAIL');
    console.log('  - usage: node tools/test-report/check-report.mjs <report.json> [title ...] | --self-test');
    return 1;
  }
  let report;
  try {
    report = JSON.parse(readFileSync(argv[0], 'utf8'));
  } catch (e) {
    console.log('REPORT FAIL');
    console.log(`  - cannot read report: ${e && e.code ? e.code : 'invalid JSON'}`);
    return 1;
  }
  return printResult(judge(report, argv.slice(1)));
}

process.exit(main(process.argv.slice(2)));
