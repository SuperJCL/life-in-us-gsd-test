---
phase: 02-account-mock-data-export
plan: 04
subsystem: testing
status: complete
tags: [export, csv, json-backup, golden-rows, account-mode, idempotency, playwright]

requires:
  - phase: 02-account-mock-data-export
    provides: "02-02 的账户模式（app.open、app.backend、expectAccountMode）、02-03 的 full-state.json 和推导 helper、02-05 的契约自测与 README 第 11 节"
provides:
  - "tests/e2e/io/export.spec.ts：IO-03 两条、IO-02 三条、MOCK-04 一条导出用例"
  - "tests/support/expect-from-fixture.ts 的 csvCell、usDate、expectedCalendarCsv：按 D-15 规格独立生成整份日历 CSV 期望"
  - "tests/support/fixture-files.ts 的 withoutSynthetic"
  - "tests/support/strings.ts 的 CSV_HEADER、CSV_DONE_PREFIX、CSV_DUE_PREFIX、CSV_GROUP_SUFFIX、TOAST_NOTHING_TO_EXPORT"
  - "tests/README.md 第 12 节“合成数据与导出”，目录表新增 tests/e2e/data/ 和 tests/e2e/io/"
affects: [phase-03, phase-04, phase-05]

actuals:
  tokens: 3600
  tasks: 3
  commits: 3
plan_head_before: f3ca1da66a9bf9a479e113eae5261915bf0afa4d
plan_head_after: 1bb0822332637a7a83d9cf2548650698001953e8

tech-stack:
  added: []
  patterns:
    - "导出内容只从 app.backend.downloads 在内存里比较，不写文件、不附加报告、不用下载事件"
    - "内置任务文字运行时从 #goals [data-task] 的 aria-label 读进单个用例的 Map，只传给生成器的回调"
    - "手写金标准行同时约束应用输出和独立生成器输出，防止两者犯同一个转义错误"
    - "导出幂等与隔离：连续导出两次得到完全相同的记录，每个用例的 MockBackend 起始为空"

key-files:
  created:
    - tests/e2e/io/export.spec.ts
  modified:
    - tests/support/expect-from-fixture.ts
    - tests/support/fixture-files.ts
    - tests/support/strings.ts
    - tests/README.md

key-decisions:
  - "“与种子文档相等”按去掉 _synthetic 理解：应用的 normalize 丢掉未知键，所以备份里没有 _synthetic，种子文档比较前先去掉它"
  - "金标准里的类别名用 strings.ts 的 CATEGORY_NAMES[3] 和 CAT_OTHER 拼接，不在 spec 里再写类别字面量"

requirements-completed: [IO-02, IO-03, MOCK-04]

coverage:
  - id: D1
    description: "完整 fixture 的 JSON 备份与去掉 _synthetic 的 fixture 和种子文档深度相等，文件名为冻结日备份名，此时没有写入"
    requirement: "IO-03"
    verification:
      - kind: test
        ref: "tests/e2e/io/export.spec.ts#IO-03 the JSON backup of the full fixture equals the fixture without _synthetic and the seeded document"
        status: pass
    human_judgment: false
  - id: D2
    description: "保存之后的 JSON 备份与最新保存的文档深度相等且没有 _synthetic"
    requirement: "IO-03"
    verification:
      - kind: test
        ref: "tests/e2e/io/export.spec.ts#IO-03 the JSON backup equals the latest saved document after a change"
        status: pass
    human_judgment: false
  - id: D3
    description: "日历 CSV 与按 D-15 规格独立算出的整份期望逐字相等，内置任务文字只在运行时从页面读"
    requirement: "IO-02"
    verification:
      - kind: test
        ref: "tests/e2e/io/export.spec.ts#IO-02 the calendar CSV export matches the spec-derived expectation byte for byte"
        status: pass
    human_judgment: false
  - id: D4
    description: "三行手写金标准（引号加逗号加换行加 80 字符截断、特殊字符不加引号、带逗号的自定义待办完成行）同时出现在应用导出和生成器输出里"
    requirement: "IO-02"
    verification:
      - kind: test
        ref: "tests/e2e/io/export.spec.ts#IO-02 handwritten golden rows anchor quoting, the 80-character subject cut and MM/DD/YYYY dates"
        status: pass
    human_judgment: false
  - id: D5
    description: "最小 fixture 下导出 CSV 只弹 toast、不调用 downloads.save"
    requirement: "IO-02"
    verification:
      - kind: test
        ref: "tests/e2e/io/export.spec.ts#IO-02 exporting the calendar with nothing dated shows the empty toast and saves nothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "同一状态连续导出两次得到完全相同的记录；每个用例从空的 mock 开始，workers: 2 并行互不共享"
    requirement: "MOCK-04"
    verification:
      - kind: test
        ref: "tests/e2e/io/export.spec.ts#MOCK-04 exporting twice records two identical downloads and every test starts with an empty mock"
        status: pass
    human_judgment: false
  - id: D7
    description: "README 说明合成数据和导出怎么用"
    verification: []
    human_judgment: true
    rationale: "文档只能用 grep 检查关键词是否出现，是否讲得清楚要人读"

duration: 8min
completed: 2026-11-03
---

# Phase 2 Plan 04: 导出逐字验证 Summary

**账户模式下两种导出都经 downloads.save 进入 MockBackend 并在内存里比较：JSON 备份与去掉 _synthetic 的 fixture 和最新保存的文档深度相等；日历 CSV 与按规格独立生成的整份期望逐字相等，三行手写金标准同时约束应用和生成器；连续导出幂等，每个用例从空 mock 开始。**

## 执行情况

- 开始：2026-11-03T19:26:25Z，结束：2026-11-03T19:34Z，约 8 分钟
- 3 个任务，3 个提交，新建 1 个文件（export.spec.ts），修改 4 个文件，没有新增依赖，没有运行任何安装命令
- `us-journey-tracker.html` 的 sha256 与基线一致，全程未被跟踪

## 提交

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | b30fd73 | withoutSynthetic、IO-03 完整 fixture 备份用例 |
| 2 | bd4ca2e | csvCell、usDate、expectedCalendarCsv、CSV 文案常量、IO-02 三条用例 |
| 3 | 1bb0822 | IO-03 保存后备份、MOCK-04 幂等与隔离、README 第 12 节和目录表 |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式），提交前重跑：`tests/e2e/io`、第二条 grep 组合、完整 `npm test`（50 条）全部通过，随即展开 Task 2。

## 观察值

- **CSV 逐字比较一次通过：** 第一次运行就与独立生成器的整份期望相等，没有重试，没有改动应用或生成器。
- **金标准行没有发现偏差：** 三行手写金标准在应用输出和生成器输出里第一次就都出现；没有出现“金标准符合规格而应用不符合”的情况，也不需要改金标准。
- **连续运行：** `tests/e2e/io` 在 Task 2 里连续运行两次都通过；阶段收尾时完整 `npm test` 连续运行两次，两次都是 55 条通过、没有 flaky。
- **阶段收尾检查：** `node tools/privacy/privacy-check.mjs --all` 退出 0（82 个文件）；用 Unicode 转义的 node 扫描确认整个仓库目录（node_modules 和 .git 除外，含 test-results）没有名字含“备份”或以“在美国的日子-”开头的文件；`us-journey-tracker.html` 的 sha256 为基线值 `2a954fd0…8a1872`；每次提交的 pre-commit 隐私检查都一次通过。
- **隐私：** 内置任务原文只在 CSV 用例里经 aria-label 读进内存 Map；本 SUMMARY、提交和所有被跟踪文件里没有任何内置任务原文；export.spec.ts 等文件通过 verify 的正则：没有写文件、附加报告、annotations 或引用应用源码。

## Deviations from Plan

None - plan executed exactly as written.

（提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`。）

## Known Stubs

None。本计划只产出测试用例、期望生成器和文档，没有占位数据或未接线的组件。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-02-17 到 T-02-21 的缓解已落地（原文只在内存 Map、verify 正则拒绝落盘和 annotations、金标准同时约束两端、每条导出用例先 expectAccountMode）；T-02-SC：没有新增依赖，没有运行安装命令。

## 仍然是假设的部分（沿用计划）

- IO-02 只覆盖完整和最小 fixture；以 = + - @ 开头的单元格（CSV 公式注入）和裸回车不在本阶段验证。
- IO-03 只覆盖完整 fixture；旧类别名迁移后的备份由 Phase 5 的 IO-05 覆盖。

## Next Phase Readiness

Phase 2 的五条成功标准和九项需求（MOCK-02 到 MOCK-06、DATA-01、DATA-02、IO-02、IO-03）都有用例证明。Phase 3 起可直接用 `loadFixture('full-state.json')`、`app.backend` 和 README 第 11、12 节的约定。

## Self-Check: PASSED

- tests/e2e/io/export.spec.ts、tests/support/expect-from-fixture.ts、tests/support/fixture-files.ts、tests/support/strings.ts、tests/README.md 存在
- 提交 b30fd73、bd4ca2e、1bb0822 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 3
- 三个任务的验收命令全部通过；`npm test` 连续两次退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
