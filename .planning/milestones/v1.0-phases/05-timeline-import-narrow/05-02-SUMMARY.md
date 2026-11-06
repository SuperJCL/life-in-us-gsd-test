---
phase: 05-timeline-import-narrow
plan: 02
subsystem: testing
status: complete
tags: [import, confirm-dialog, in-memory-files, manual-clock, legacy-migration, round-trip, account-mock, playwright]

requires:
  - phase: 05-timeline-import-narrow
    provides: "05-01 的 readTimeline、expectedTimeline、gotoTimeline、pickFilter、FILTER_ALL"
  - phase: 02-account-mock-data-export
    provides: "MALFORMED_IMPORTS、legacy-categories.json、导出 JSON 的读法、app.saved/expectSaved"
  - phase: 03-composer-editor-week
    provides: "composer(page, 'w')、expectToast、expectToastGone、manual 时钟加写入次数加哨兵的写法"
provides:
  - "tests/support/import-file.ts：ImportFile、jsonImportFile、textImportFile、chooseImportFile（只接受 synth- 开头的名字）、answerNextDialog、recordDialogs"
  - "tests/support/expect-from-fixture.ts：expectedNormalize，应用 normalize 的独立规格"
  - "tests/support/strings.ts：CONFIRM_IMPORT、TOAST_IMPORT_BAD_FORMAT；接受导入后的 toast 复用 TOAST_RESTORED"
  - "tests/e2e/io/import.spec.ts：四条 IO-04、一条 IO-05 用例（取消和非 JSON 两条在 manual 时钟下）；05-04 的 B2、N3 用例可直接复用 helper 和文案常量"
affects: [phase-05]

actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: c3017ae4d55984d7ac464150fda42c667de454a9
plan_head_after: c2625d1d0409ec26d7ddb00b609babcb2bde3437

tech-stack:
  added: []
  patterns:
    - "导入文件只在内存里构造，经 setInputFiles 的 buffer 形式交给页面；chooseImportFile 运行时拒绝不以 synth- 开头的名字"
    - "先 answerNextDialog（page.once('dialog')）再选文件；confirm 在 FileReader 的 onload 里异步弹出，所以选完后 expect.poll 等消息条数为 1 再逐字比较"
    - "“没有保存”的证明：manual 时钟推过防抖后写入次数不变，再用合成哨兵证明写入恰好加 1、且那次写入里的记录 id 等于 fixture"
    - "不应弹出对话框的用例用 recordDialogs 记录并一律拒绝，最后断言消息数组为空"

key-files:
  created:
    - tests/support/import-file.ts
    - tests/e2e/io/import.spec.ts
  modified:
    - tests/support/strings.ts
    - tests/support/expect-from-fixture.ts

key-decisions:
  - "哨兵断言抽成 import.spec.ts 里的模块级函数 expectOnlySentinelSaved，取消和非 JSON 两条用例共用同一套证明"
  - "往返用例导入的是导出得到的原文（textImportFile），不重新序列化，所以证明的是应用对自己导出内容的往返，而不是测试对 JSON 的往返"
  - "旧类别用例把时间线读回按 id 取每条 legacy 记录的 tag，与 expectedCategory(原类别) 比较，另在“专业”和“其他”筛选下各做一次整体推导比较"

requirements-completed: [IO-04, IO-05]

coverage:
  - id: D1
    description: "接受导入确认框后保存的状态等于 expectedNormalize(合成备份)，本周不再有 fixture 记录、合成记录在自己的日期列、抵达日期是备份的，时间线读回等于推导"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-04 accepting the import confirm replaces all data with the backup"
        status: pass
    human_judgment: false
  - id: D2
    description: "拒绝确认框后 manual 时钟推过防抖，写入次数不变、没有 toast、本周仍是 fixture；哨兵写入恰好加 1 且记录 id 等于 fixture"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-04 cancelling the import confirm keeps the data and saves nothing"
        status: pass
    human_judgment: false
  - id: D3
    description: "三个非 JSON 文件和 synth-null.json 逐个导入：都出现格式错误 toast、不弹确认框、写入次数不变，哨兵证明数据仍是 fixture"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-04 files that are not a backup show the format error, ask nothing and save nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "导出 JSON 后改动一条记录，再把导出原文作为内存文件导入并接受：保存的状态与备份深度相等，改动从本周和时间线消失"
    requirement: "IO-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-04 an exported JSON backup imported again restores exactly the exported data"
        status: pass
    human_judgment: false
  - id: D5
    description: "导入旧类别备份后保存的状态等于 expectedNormalize，每条记录类别等于 expectedCategory(原类别)，本周类别卡计数、日期列、时间线标签和专业、其他筛选都按新类别"
    requirement: "IO-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-05 importing a backup with legacy category names migrates them and every view shows the new categories"
        status: pass
    human_judgment: false

duration: 约 25 min
completed: 2026-11-04
---

# Phase 5 Plan 2: 导入 Summary

**导入用 synth- 内存文件加“先注册对话框、再选文件、poll 等消息”的固定顺序，覆盖确认替换、取消、四种非备份文件、导出再导入的往返和旧类别迁移五条用例，期望由 expectedNormalize 独立推导；完整套件 144 条全部通过、0 flaky。**

## Accomplishments

- tracer（提交 `91e5f51`）：CONFIRM_IMPORT、TOAST_IMPORT_BAD_FORMAT、expectedNormalize、import-file.ts 的五个导出和“接受导入”用例一次打通；保存的状态等于推导，本周和时间线按新数据重绘。
- 提交 `c2625d1`：取消和非 JSON 两条放在 manual 时钟 describe 里，用“写入次数不变加哨兵”证明没有保存；往返用例导入导出的原文；旧类别用例核对保存状态、五张类别卡计数、每条记录的日期列、时间线标签以及“专业”“其他”两个筛选。
- 完整套件（低优先级、单 worker，本计划唯一一次）：144 条 expected、0 flaky、0 unexpected，`check-report.mjs --min-expected 144` 输出 `REPORT OK`；五个 IO 标题、登记护栏和 SAFE-02 都实际运行并通过。

## 与计划的差异

None - plan executed exactly as written.

- 是否用过 guard.remove：没有。五条用例首次运行都没有出现 console.error 或页面异常，没有加任何豁免，tests/support/test.ts 未动。
- 推导与应用没有不一致：expectedNormalize、expectedCategory、weekCountsByCategory、expectedTimeline 对导入后的状态首次运行即与应用一致，没有改动任何期望。
- 一处实现细节：`Page` 类型按 week-view.spec.ts 的惯例从 `../../support/test` 取，所以 spec 仍只从 tests/support/test.ts 导入 `test`、`expect` 和类型。

## 导入时观察到、但按约定没有断言的应用现象

- 取消路径里应用的 `return` 发生在 `e.target.value=""` 之前，input 的值不会被清空；本计划只断言数据和写入，不断言 input 状态。
- `[]`（synth-array.json）和字段类型错误的对象（synth-wrong-types.json）能通过 normalize，不会走格式错误提示，与 N3 同类；按约定没有写特征化断言，也没有标记已知 bug（B2、N3 在 05-04）。

## 隐私与保护路径

- 导入文件只在内存里构造，磁盘上没有写任何文件；所有文件名字面量都以 synth- 开头（grep 确认），chooseImportFile 在运行时再检查一次。导出得到的备份只在内存里比较，没有进报告、注解或控制台。
- grep 确认 tests/e2e/io 和 import-file.ts 没有可见性断言、没有固定睡眠；toast 一律经 tests/support/toast.ts 判断。
- tests/fixtures、tests/support/test.ts、tests/support/app.ts、tests/mocks、playwright.config.ts、package.json、package-lock.json 的 HEAD 对象哈希与计划开始前相同，工作区无改动；`us-journey-tracker.html` 未被跟踪，sha256 等于基线。
- expect-from-fixture.ts 整份仍是 CRLF，无混合行尾；新文件和其余改动文件是 LF。
- 没有新增依赖，没有运行安装命令，只用了 `npm test` 和 `node` 脚本。提交经过隐私钩子，两次都通过，没有绕过。
- SUMMARY 里没有内置任务、预设或力量项目的原文。

## 假设（有意不验证的边界）

- `[]` 和字段类型错误的对象没有单独验证（与 N3 同类，在 05-04 处理）。
- 日志缺 date 等坏结构（research 的 B8）和导入 XSS（B6）推迟到后续里程碑。
- 本地模式（无账户 mock）下的导入不验证：导入只依赖页面，存储差异由 IO-01 和 MOCK-03 覆盖。
- 日历 chip 的类别类名在导入后不单独验证（种子加载时的旧类别呈现由 Phase 2 的 DATA-02 覆盖）；导入后的目标视图不验证（legacy fixture 没有任务）。

## Known Stubs

None.

## Threat Flags

None.

## Next Phase Readiness

import-file.ts 和两个文案常量已可供 05-04 的 B2、N3 用例使用；Ready for 05-03。

## Self-Check: PASSED

- FOUND: tests/support/import-file.ts、tests/e2e/io/import.spec.ts
- FOUND: 91e5f51、c2625d1（均为 HEAD 的祖先）
- 完整套件 144 条通过、0 flaky；保护路径不变量检查通过
