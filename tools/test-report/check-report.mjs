#!/usr/bin/env node
// Playwright json 报告检查器：零依赖，只使用 node: 内置模块。
//
// 为什么需要它：playwright.config.ts 设置了 retries: 1，命令的退出码区分不了“一次通过”和“重试后才通过（flaky）”，
// 也看不出用例是不是被过滤掉没跑。所以每次跑测试的 verify 都写 json 报告，再由本脚本判定。
//
// 用法：
//   node tools/test-report/check-report.mjs <报告文件> [--min-expected N] [标题 ...]
//   node tools/test-report/check-report.mjs --self-test
//
// 判定（全部满足才通过）：
//   1. 报告有 stats，顶层的 errors 是数组且为空；
//   2. stats.unexpected 为 0，stats.flaky 为 0，stats.expected 大于 0；
//   3. 任何 test 的 status 是 skipped，但它（或任一 result）的 annotations 里没有 known-bug 项，都算问题
//      （被 -g 过滤、被中断、test.skip/fixme 跳过的用例都落在这里）；
//      stats.skipped 大于带 known-bug 的 skipped 数量也算问题；
//   4. 没有 test 的 spec 算问题；同一标题的多个 spec 里一部分通过、一部分没通过算问题；
//   5. 给了 --min-expected N 时，stats.expected 必须不小于 N
//      （全量运行用它固定“至少跑了 N 条”，防止部分运行得到 REPORT OK）；
//   6. 命令行上列出的每个标题，至少有一个 spec 的 title 与它完全相等，
//      并且这些 spec 下的每个 test 的 status 都是 expected（test.fail 预期失败的标记用例也是 expected），
//      或者 status 是 skipped 且 test 或它任一 result 的 annotations 里有 type 为 known-bug 的项（knownBug 的 fixme 退路）。
//
// 退出码：0 通过；1 不通过（包括报告缺失或不是合法 JSON、参数不合法）。
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

// 通过：expected，或带 known-bug 注解的 skipped（knownBug 的 fixme 退路）
function isOk(test) {
  return test.status === 'expected' || (test.status === 'skipped' && hasKnownBugAnnotation(test));
}

// 返回问题清单（空数组表示通过）和计数。opts.minExpected：stats.expected 的下限
export function judge(report, titles = [], opts = {}) {
  const problems = [];
  const hasStats = !!report && typeof report.stats === 'object' && report.stats !== null;
  const stats = hasStats ? report.stats : {};
  const counts = {
    expected: Number(stats.expected ?? 0),
    flaky: Number(stats.flaky ?? 0),
    unexpected: Number(stats.unexpected ?? 0),
  };
  if (!hasStats) problems.push('report has no stats');
  if (!Array.isArray(report?.errors)) problems.push('report errors is not an array');
  const errors = Array.isArray(report?.errors) ? report.errors : [];
  if (errors.length > 0) problems.push(`report errors: ${errors.length}`);
  if (counts.unexpected !== 0) problems.push(`unexpected: ${counts.unexpected}`);
  if (counts.flaky !== 0) problems.push(`flaky: ${counts.flaky}`);
  if (!(counts.expected > 0)) problems.push('expected is 0 (nothing ran)');
  const minExpected = opts.minExpected;
  if (minExpected !== undefined && !(counts.expected >= minExpected)) {
    problems.push(`expected ${counts.expected} is below --min-expected ${minExpected}`);
  }

  const specs = collectSpecs(report?.suites);

  // 跳过：只允许带 known-bug 注解的 skipped；其余（过滤、中断、skip、fixme）都算问题
  const allTests = specs.flatMap((sp) => (Array.isArray(sp.tests) ? sp.tests : []));
  const skipped = allTests.filter((t) => t.status === 'skipped');
  const knownSkipped = skipped.filter(hasKnownBugAnnotation).length;
  const unannotated = skipped.length - knownSkipped;
  if (unannotated > 0) problems.push(`skipped without known-bug: ${unannotated}`);
  const statSkipped = Number(stats.skipped ?? 0);
  if (unannotated === 0 && statSkipped > knownSkipped) {
    problems.push(`stats.skipped ${statSkipped} exceeds known-bug skipped ${knownSkipped}`);
  }

  // 没有 test 的 spec 没有证明任何东西
  for (const sp of specs) {
    if (!Array.isArray(sp.tests) || sp.tests.length === 0) problems.push(`spec without tests: ${sp.title}`);
  }

  // 同一标题的多个 spec：一部分通过、一部分没通过
  const byTitle = new Map();
  for (const sp of specs) {
    const list = byTitle.get(sp.title) ?? [];
    list.push(...(Array.isArray(sp.tests) ? sp.tests : []));
    byTitle.set(sp.title, list);
  }
  for (const [title, tests] of byTitle) {
    if (tests.some(isOk) && tests.some((t) => !isOk(t))) problems.push(`title with mixed results: ${title}`);
  }

  for (const title of titles) {
    const matched = specs.filter((sp) => sp.title === title);
    if (matched.length === 0) {
      problems.push(`title not run: ${title}`);
      continue;
    }
    const matchedTests = matched.flatMap((sp) => (Array.isArray(sp.tests) ? sp.tests : []));
    if (matchedTests.length === 0 || matchedTests.some((t) => !isOk(t))) problems.push(`title not passed: ${title}`);
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
  const knownBug = [{ type: 'known-bug' }];
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
      report([mk('skipped', { annotations: knownBug })], {}),
      ['T'],
      true,
    ],
    [
      'skipped with known-bug annotation on a result passes',
      report([mk('skipped', { results: [{ annotations: knownBug }] })], {}),
      ['T'],
      true,
    ],
    ['skipped without annotation fails', report([mk('skipped')], {}), ['T'], false],
    // 不列标题时，未带注解的 skipped 也要被拒绝（过滤、中断、skip 都落在这里）
    [
      'skipped without annotation fails even with no titles',
      report([mk('expected'), mk('skipped', { title: 'U' })], {}),
      [],
      false,
    ],
    [
      'skipped known-bug with no titles passes',
      report([mk('expected'), mk('skipped', { title: 'U', annotations: knownBug })], {}),
      [],
      true,
    ],
    // 报告里没有对应 test 的 skipped 计数（例如被过滤掉的用例）也要被拒绝
    ['stats.skipped above known-bug skipped fails', report([mk('expected')], { skipped: 2 }), [], false],
    // 部分运行：用 --min-expected 固定至少跑了多少条
    ['min-expected above expected fails', report([mk('expected')], {}), [], false, { minExpected: 2 }],
    ['min-expected equal to expected passes', report([mk('expected')], {}), [], true, { minExpected: 1 }],
    // 同一标题一个通过、一个没通过（stats 被设成看不出来，证明判定器自己能发现）
    [
      'same title once expected once unexpected fails',
      report([mk('expected'), mk('unexpected')], { expected: 2 }),
      [],
      false,
    ],
    ['same title twice expected passes', report([mk('expected'), mk('expected')], { expected: 2 }), ['T'], true],
    // 没有 test 的 spec
    ['spec with empty tests fails', report([mk('expected'), { title: 'E', tests: [] }], {}), [], false],
    ['listed title whose spec has empty tests fails', report([mk('expected'), { title: 'E', tests: [] }], {}), ['E'], false],
    ['spec without a tests field fails', report([mk('expected'), { title: 'E' }], {}), [], false],
    // 报告形状不对
    ['missing stats fails', { errors: [], suites: [{ title: 'f', specs: [mk('expected')], suites: [] }] }, [], false],
    ['errors not an array fails', { ...report([mk('expected')], {}), errors: undefined }, [], false],
  ];
  let ok = true;
  for (const [name, rep, titles, want, opts] of cases) {
    const got = judge(rep, titles, opts).problems.length === 0;
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

// 解析报告文件之后的参数：--min-expected N（或 --min-expected=N）和其余的标题
function parseArgs(args) {
  const titles = [];
  let minExpected;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--min-expected' || a.startsWith('--min-expected=')) {
      const raw = a === '--min-expected' ? args[++i] : a.slice('--min-expected='.length);
      const n = Number(raw);
      if (raw === undefined || raw === '' || !Number.isInteger(n) || n < 0) {
        return { error: '--min-expected needs a non-negative integer' };
      }
      minExpected = n;
    } else {
      titles.push(a);
    }
  }
  return { titles, minExpected };
}

function main(argv) {
  if (argv[0] === '--self-test') return selfTest();
  if (argv.length === 0) {
    console.log('REPORT FAIL');
    console.log('  - usage: node tools/test-report/check-report.mjs <report.json> [--min-expected N] [title ...] | --self-test');
    return 1;
  }
  const parsed = parseArgs(argv.slice(1));
  if (parsed.error) {
    console.log('REPORT FAIL');
    console.log(`  - ${parsed.error}`);
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
  return printResult(judge(report, parsed.titles, { minExpected: parsed.minExpected }));
}

process.exit(main(process.argv.slice(2)));
