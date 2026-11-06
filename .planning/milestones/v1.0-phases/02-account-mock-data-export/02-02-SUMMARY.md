---
phase: 02-account-mock-data-export
plan: 02
subsystem: testing
status: complete
tags: [claude-mock, account-mode, exposeBinding, MockBackend, negative-control, export, playwright]

requires:
  - phase: 02-account-mock-data-export
    provides: "02-01 的加固护栏：guard.remove、WebSocket 与多 page 监控、manual 时钟的否定断言写法"
provides:
  - "tests/mocks/claude-runtime.ts：自包含的页面侧 window.claude mock（use、db.doc 的 get 与 set、user.id、downloads.save），按契约 0.2.96，只做正常路径"
  - "tests/mocks/claude-backend.ts：Node 侧 MockBackend（reads、writes、downloads、seed、lastState、handle）"
  - "AppHarness 的 account 模式：open({ mode, seed, userId, expectStore })、backend、账户就绪条件、expectAccountMode"
  - "tests/e2e/storage/account-mode.spec.ts 四条用例，含 D-07 的常驻反向对照"
  - "PROBE-7 与 D-01 的 exposeBinding 结论"
affects: [02-03, 02-04, 02-05, phase-03, phase-04, phase-05]

actuals:
  tokens: 7800
  tasks: 2
  commits: 2
plan_head_before: 08f46ee32e96343534b82a0d5486ef78bce68085
plan_head_after: 066a2fbebe04f6c37771061011130db838490d4c

tech-stack:
  added: []
  patterns:
    - "状态放在 Node 侧，页面只经 exposeBinding 往返，binding 只在 get、set、save 被调用时才取"
    - "账户模式自证：expectAccountMode 先同步检查 reads，再查状态栏和 localStorage，声明为 async 使失败变成 reject"
    - "否定断言（启动不写）用 manual 时钟推过防抖，再用哨兵写入作对照，依赖 binding 调用到达 Node 的顺序"
    - "导出内容不走 Playwright 的 download 事件，直接读 app.backend.downloads"

key-files:
  created:
    - tests/mocks/claude-runtime.ts
    - tests/mocks/claude-backend.ts
    - tests/e2e/storage/account-mode.spec.ts
  modified:
    - tests/support/app.ts
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/e2e/platform/probes.spec.ts
    - tests/PROBES.md

key-decisions:
  - "D-01 结论：exposeBinding 方案可用，不启用 sessionStorage 退路；退路备忘（键名带前缀、不与 us-journey-tracker-v1 冲突）保留在 PROBES.md"
  - "binding 的种子写进 MockBackend 而不写 localStorage；用例用 app.backend 直接读记录，不用 page.evaluate 读 mock 数据"
  - "反向对照用 expectStore: 'local' 让就绪条件按本地算，状态栏文案是账户模式下起决定作用的就绪条件"

requirements-completed: [MOCK-02, MOCK-03, MOCK-04, MOCK-05]

coverage:
  - id: D1
    description: "页面侧 window.claude mock 按契约 0.2.96 实现，自包含、只做正常路径；Node 侧 MockBackend 记录读写与下载"
    requirement: "MOCK-02"
    verification:
      - kind: command
        ref: "Task 1 automated 第二条：文件存在、runtime 无 import、无 Promise.reject/setTimeout/ok:false、app.ts 含 addInitScript(installClaudeMock 与 exposeBinding(、constants.ts 无 import、tests 下无契约目录路径字样"
        status: pass
      - kind: test
        ref: "tests/e2e/storage/account-mode.spec.ts#MOCK-03 account mode saves a new entry to the mock and reads it back after reload"
        status: pass
    human_judgment: true
    rationale: "与契约原文的逐条一致性由 02-05 的契约自测和 CONTRACT.md 证明；这里只做了对照原文实现和人工比对"
  - id: D2
    description: "账户模式下记一笔后 mock 记录到写入，刷新后从 mock 读回，localStorage 始终没有应用的键；启动恰好读一次、第一次改动前不写"
    requirement: "MOCK-03"
    verification:
      - kind: test
        ref: "tests/e2e/storage/account-mode.spec.ts#MOCK-03 account mode saves a new entry to the mock and reads it back after reload"
        status: pass
      - kind: test
        ref: "tests/e2e/storage/account-mode.spec.ts#MOCK-03 startup reads the account document once and writes nothing before the first change"
        status: pass
    human_judgment: false
  - id: D3
    description: "账户模式下两个导出按钮可见，downloads.save 的文件名和内容能从 mock 记录里读到，toast 显示已导出"
    requirement: "MOCK-04"
    verification:
      - kind: test
        ref: "tests/e2e/storage/account-mode.spec.ts#MOCK-04 account mode shows both export buttons and records what downloads.save receives"
        status: pass
    human_judgment: false
  - id: D4
    description: "账户模式校验不是永远通过：user.id() 为 null 时应用退回本地，expectAccountMode 必然失败，由常驻用例每次证明"
    requirement: "MOCK-05"
    verification:
      - kind: test
        ref: "tests/e2e/storage/account-mode.spec.ts#MOCK-05 the account-mode check fails when user.id() resolves null and the app falls back to localStorage"
        status: pass
    human_judgment: false
  - id: D5
    description: "exposeBinding 在 init 阶段已可调用，D-01 结论写进 PROBES.md"
    requirement: "MOCK-02"
    verification:
      - kind: test
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-7 exposeBinding is callable from an init script before any page script runs"
        status: pass
    human_judgment: false
---

# Phase 2 Plan 02: 账户模式与 Claude Artifact mock Summary

**页面侧 `window.claude` mock（按契约 0.2.96，只做正常路径）加 Node 侧 MockBackend，经 `exposeBinding` 往返；AppHarness 新增可自证的账户模式，常驻反向对照和 PROBE-7 证明它不会静默回退，也证明 binding 在 init 阶段已可调用。**

## 执行情况

- 开始：2026-11-03T18:48:25Z，结束：2026-11-03T18:56:34Z，约 8 分钟
- 2 个任务，2 个提交，新建 3 个文件，修改 5 个文件，没有新增依赖，没有运行任何安装命令
- `us-journey-tracker.html` 的 sha256 与基线一致，全程未被跟踪

## 提交

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | b15b616 | claude-runtime.ts、claude-backend.ts、AppHarness 账户模式、常量与文案、MOCK-03 往返用例 |
| 2 | 066a2fb | expectAccountMode、MOCK-05 反向对照、启动不写用例、MOCK-04 导出记录、PROBE-7、PROBES.md |

Tracer 的 `<verify>` 是纯自动化命令，提交后重跑：账户用例、第二条 grep 组合、完整 `npm test`（31 条）全部通过，随即展开 Task 2。

## precondition 与契约对照

- **precondition 满足：** 找到 0.2.96 的四个类型定义（claude.d.ts、db.d.ts、user.d.ts、downloads.d.ts），都存在且非空，只有一个版本目录，不需要 `cmp`。目录路径只在终端里使用，没有写进任何被跟踪的文件、提交信息或本文件。
- **与计划描述一致：** PATH GRAMMAR（偶数段、至少 2 段、至多 16 段、段字符集、`.` 与 `..`、200 与 1000 的长度上限）、快照形状（`id`、`exists`、`data()`、`metadata`，快照和 `data()` 冻结）、`set` 返回 `undefined`、`use()` 对已提供的能力返回同一个 Promise、对未知名字返回 `null`、`downloads.save` 接受 string、Blob、ArrayBuffer 和 ArrayBufferView 并返回 `{ status: 'saved' }`。
- **与契约原文的差异（都是计划有意取的子集，不是不一致）：**
  - 契约的 `db` 还有 `collection()`、`update`、`onSnapshot` 等，`user` 还有 `me()`、`profiles()`、`can()` 等；mock 只实现应用用到的 `db.doc(...).get/set`、`user.id()` 和 `downloads.save`。未实现项的清单由 02-05 的 CONTRACT.md 写明。
  - 契约的长度上限按字节算，mock 按字符算。段文法只允许 ASCII，所以对合法路径两者等价，非 ASCII 字符会先被段文法拒绝。
  - `downloads.save` 的 `request` 字段（应答平台导出请求）没有实现，应用用不到。
- 没有发现需要偏离计划描述的地方。

## exposeBinding 时序的观察值与 D-01 结论

- **账户 tracer：** 应用的 `init()` 调用 `db.doc(...).get()` 时 binding 可用。状态栏变为账户文案，种子条目只能来自 mock（localStorage 是空的），reload 后 `reads` 变为两次。
- **PROBE-7：** `typeAtInit=function`，`initCall=pong`。init script 运行时 binding 已经是可调用的函数，调用能拿到 Node 侧的返回值。
- **结论：** exposeBinding 方案可用，**不需要 sessionStorage 退路**。没有触发 D-01 的停下条件，没有改写任何断言。

## 观察值与稳定性

- 账户 tracer 一次通过，没有重试。
- 本任务集合（storage 目录加 probes.spec.ts，共 13 条）连续运行两次都通过；完整 `npm test` 共 35 条通过，没有 flaky；`node tools/privacy/privacy-check.mjs --all` 退出 0（68 个文件）。
- 启动不写用例的确定性：manual 时钟推过 600 ms 防抖之后再写哨兵，哨兵到达 mock 时 `writes` 恰好一条，说明启动阶段没有写，窗口也确实推进了防抖。

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None。本计划只产出测试平台代码，没有占位数据或未接线的组件。

## Threat Flags

None。mock 只在页面内存和本机 Node 进程之间经 exposeBinding 往返，不发网络请求；guard 的 route 仍只放行应用来源。T-02-07 到 T-02-11 的缓解都已落地（T-02-SC：没有新增依赖，没有运行安装命令）。

## Next Phase Readiness

02-03 到 02-05 可以直接用 `app.open({ mode: 'account', seed })`、`app.backend` 和 `app.expectAccountMode()`。`WEEK_START_FROZEN`、`WEEK_END_FROZEN`、`ARRIVAL_DATE_FIXTURE` 已在 constants.ts。契约自测、`tests/mocks/CONTRACT.md` 和 README 的账户模式说明由 02-05 完成；CSV 的逐字比较由 02-04 完成。

## Self-Check: PASSED

- tests/mocks/claude-runtime.ts、tests/mocks/claude-backend.ts、tests/e2e/storage/account-mode.spec.ts 存在
- 提交 b15b616、066a2fb 都在当前分支上
- 两个任务的验收命令全部通过；`npm test` 退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
