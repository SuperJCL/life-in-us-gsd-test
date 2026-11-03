---
phase: 02-account-mock-data-export
plan: 03
subsystem: testing
status: complete
tags: [fixtures, synthetic-data, account-mode, derivation-helpers, normalize, playwright]

requires:
  - phase: 02-account-mock-data-export
    provides: "02-02 的账户模式：app.open({ mode: 'account', seed })、app.backend、app.expectAccountMode()"
provides:
  - "tests/fixtures/full-state.json：Phase 2 到 5 共用的完整合成状态（11 条记录、5 个内置任务状态、3 个自定义待办、2 个力量项目、2 条复盘、2 个类别的预设标签增删）"
  - "tests/fixtures/legacy-categories.json、minimal-state.json：旧类别名与最小状态边界 fixture"
  - "tests/fixtures/malformed-imports.ts：MALFORMED_IMPORTS 与 MalformedKind，只在内存里使用"
  - "tests/support/task-ids.ts、fixture-files.ts、expect-from-fixture.ts：位置 id 集中点、loadFixture、期望值推导函数"
  - "tests/support/strings.ts 新增类别名、LEGACY 映射和三条界面文案常量"
  - "tests/e2e/data/synthetic-data.spec.ts：DATA-01 三条、DATA-02 三条用例"
affects: [02-04, 02-05, phase-03, phase-04, phase-05]

actuals:
  tokens: 8500
  tasks: 3
  commits: 3
plan_head_before: fd34b3dbff292792978f19c93d48efa108fe933e
plan_head_after: bb55bcb5eb47f4b5bb78a5baad6ae1718810c72c

tech-stack:
  added: []
  patterns:
    - "期望值由 expect-from-fixture.ts 从 fixture 推导，用例里数字只保留 0 和 1（D-13）"
    - "内置任务只用位置 id 引用，页面用例检查每个 id 在目标页上恰好一个复选框"
    - "类别显示名和 LEGACY 旧类别名只在 strings.ts 里写成字符串字面量，其他 TS 文件只引用常量（D-12 澄清）"
    - "畸形导入内容是内存常量，不落盘，避免被误认为真实备份"

key-files:
  created:
    - tests/fixtures/full-state.json
    - tests/fixtures/legacy-categories.json
    - tests/fixtures/minimal-state.json
    - tests/fixtures/malformed-imports.ts
    - tests/support/task-ids.ts
    - tests/support/fixture-files.ts
    - tests/support/expect-from-fixture.ts
    - tests/e2e/data/synthetic-data.spec.ts
  modified:
    - tests/support/strings.ts

key-decisions:
  - "full-state.json 与计划描述逐项一致，没有为通过隐私检查改写任何合成文字"
  - "expectedCategory 独立实现 normalize 的类别规格，只依赖 strings.ts 的常量，不导入应用代码"
  - "类别标签断言用 allTextContents 取整页标签后再断言不含旧名，而不是逐个旧名查元素"

requirements-completed: [DATA-01, DATA-02]

coverage:
  - id: D1
    description: "完整 fixture 经账户 mock 加载，五个类别的本周记录出现在本周视图对应日期的列里"
    requirement: "DATA-01"
    verification:
      - kind: test
        ref: "tests/e2e/data/synthetic-data.spec.ts#DATA-01 the full fixture loads through the account mock and shows a current-week entry for each of the five categories"
        status: pass
    human_judgment: false
  - id: D2
    description: "完整 fixture 覆盖 D-13 的全部状态，由 helper 推导并逐项断言"
    requirement: "DATA-01"
    verification:
      - kind: test
        ref: "tests/e2e/data/synthetic-data.spec.ts#DATA-01 the full fixture covers every state later phases rely on"
        status: pass
    human_judgment: false
  - id: D3
    description: "本周、时间线、目标三个视图显示记录、任务状态、自定义待办、力量历史、复盘、预设标签、抵达日期；特殊字符按原文显示"
    requirement: "DATA-01"
    verification:
      - kind: test
        ref: "tests/e2e/data/synthetic-data.spec.ts#DATA-01 the full fixture renders logs, task states, custom todos, lift history, the weekly review, preset tags and the arrival date"
        status: pass
    human_judgment: false
  - id: D4
    description: "旧类别名按 normalize 规格映射，最小状态加载为空状态，畸形导入常量确实畸形且不落盘"
    requirement: "DATA-02"
    verification:
      - kind: test
        ref: "tests/e2e/data/synthetic-data.spec.ts#DATA-02 the legacy-categories fixture loads with old category names mapped to current ones"
        status: pass
      - kind: test
        ref: "tests/e2e/data/synthetic-data.spec.ts#DATA-02 the minimal fixture loads as an empty state"
        status: pass
      - kind: test
        ref: "tests/e2e/data/synthetic-data.spec.ts#DATA-02 malformed import payloads stay in memory, carry the synthetic marker and are really malformed"
        status: pass
    human_judgment: false
---

# Phase 2 Plan 03: 合成 fixture 与边界数据 Summary

**完整合成 fixture（11 条记录、各种任务状态、自定义待办、力量历史、复盘、预设标签）经账户 mock 加载并在本周、时间线、目标三个视图里找到；旧类别名、最小状态、内存里的畸形导入常量作为边界数据就位，全部期望值由推导函数得出。**

## 执行情况

- 开始：2026-11-03T18:58Z 前后，结束：2026-11-03T19:09:25Z，约 11 分钟
- 3 个任务，3 个提交，新建 8 个文件，修改 1 个文件（strings.ts），没有新增依赖，没有运行任何安装命令
- `us-journey-tracker.html` 的 sha256 与基线一致，全程未被跟踪

## 提交

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 2a4074b | full-state.json、task-ids.ts、fixture-files.ts、expect-from-fixture.ts（logsInWeek）、DATA-01 tracer 用例 |
| 2 | 4ef07e2 | 推导 helper、strings.ts 常量、DATA-01 覆盖用例和三视图页面用例 |
| 3 | bb55bcb | legacy-categories.json、minimal-state.json、malformed-imports.ts、expectedCategory、三条 DATA-02 用例 |

Tracer 的 `<verify>` 是纯自动化命令（交互模式，`end-of-phase`），提交后重跑：数据目录加 repo-hygiene 的用例、fixture 的 node 检查、完整 `npm test`、`privacy-check --all` 全部通过，随即展开 Task 2。

## fixture 的最终内容与计划是否有出入

与计划描述逐项一致：首行 103 个字符的含引号、逗号、换行的记录，含 `<`、`&`、单引号的记录，上一周、上一个月、抵达日、下一周的记录，五个内置任务状态，三个自定义待办（有截止、已完成、无状态各一），两个力量项目，两条复盘，两个类别的预设标签增删。pre-commit 的隐私检查（规则 D）每次都一次通过，**没有为通过检查改写任何合成文字**，也没有调整检查器。

## 页面用例里遇到的选择器问题

- **`filter({ has })` 的相对定位：** 计划写的“`#goals .task` 用 filter has 定位到含该复选框的那一行”，第一次写成 `has: page.locator('#goals [data-task=...]')`，找不到 `.od`。`has` 里的 locator 是相对被过滤元素的，不能再从 `#goals` 出发；改成只写 `[data-task="<id>"]` 后通过。力量行的 `has: #lf-<id>` 是 id 选择器，不受影响。
- 时间线里的 `.li-text` 对多行文本：Playwright 的 `toHaveText` 会规范化空白，期望值里的换行与页面文本里的换行都被折叠，所以直接用 fixture 里的原文比较即可。
- 时间线还会列出已完成任务（`data-edittask`），不影响按 `[data-edit="<id>"]` 定位记录；`.tag` 的整页统计只在 DATA-02 用例里做，那里 tasks 为空对象。

## DATA-02 用例观察到的应用行为

- 旧类别名（四个旧名）在账户模式下加载后，时间线标签等于 `expectedCategory` 推导的新类别；未知类别 `SYNTH-unknown-cat` 变成“其他”；页面上不再出现旧名和未知类别原名。
- 只有 `_synthetic` 的最小状态：normalize 补全缺省字段，本周视图没有记录，`#arrival` 和 `#review` 为空，时间线显示空状态文案。
- 畸形导入常量只验证“确实畸形”（not-json 抛错、json-not-object 解析为 null 或数组、wrong-field-types 至少一个字段类型错），不断言应用对它们的行为——该期望由 Phase 5 的 IO-04 决定（N3 仍待用户决定）。

## 观察值与稳定性

- 完整 `npm test` 共 41 条通过，退出 0，输出里没有 flaky；`node tools/privacy/privacy-check.mjs --all` 退出 0（74 个文件）。
- `npm test -- tests/e2e/data` 在 Task 2 里连续运行两次都通过。
- 类别名只在 strings.ts 里有字符串字面量的 node 检查通过；tests/fixtures 下没有名字含“备份”或以“在美国的日子-”开头的文件。

## Deviations from Plan

None - plan executed exactly as written.

（执行过程中的两处小事不构成偏离：用例里 `filter({ has })` 的选择器写法按上面说明改过一次；提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`，而不是编排提示里写的 `Claude Opus 5.5`，此前两个计划的提交用的是后者。）

## Known Stubs

None。fixture 数据是有意的合成数据，不是未接线的占位。

## Threat Flags

None。本计划只新增本地测试数据和推导函数，没有新的网络端点、认证路径或信任边界上的文件访问；T-02-13 到 T-02-16 的缓解已落地（SYNTH- 前缀、位置 id、类别名只在 strings.ts、推导而不抄数字、畸形导入不落盘、`<b>` 载荷不生成元素的断言）。T-02-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

02-04（导出逐字比较）和 Phase 3 到 5 的视图用例可以直接 `loadFixture('full-state.json')`，用 expect-from-fixture.ts 推导期望值。如果后续阶段需要扩充 fixture，Task 2 的覆盖用例照样适用；内置任务位置 id 若因应用源码任务顺序变化而失效，DATA-01 页面用例会给出“更新 tests/support/task-ids.ts”的失败消息。

## Self-Check: PASSED

- tests/fixtures 下的 full-state.json、legacy-categories.json、minimal-state.json、malformed-imports.ts，以及 tests/support 下的 task-ids.ts、fixture-files.ts、expect-from-fixture.ts，tests/e2e/data/synthetic-data.spec.ts 都存在
- 提交 2a4074b、4ef07e2、bb55bcb 都在当前分支上
- 三个任务的验收命令全部通过；`npm test` 退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
