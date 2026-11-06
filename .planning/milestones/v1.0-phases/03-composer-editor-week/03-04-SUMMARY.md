---
phase: 03-composer-editor-week
plan: 04
subsystem: testing
status: complete
tags: [known-bug, test-fail, registry-guard, week-view, composer, playwright]

requires:
  - phase: 03-composer-editor-week
    provides: "03-01 的 composer(page, 'w')、toast helper、app.expectSaved"
provides:
  - "tests/support/test.ts 的 knownBug(id, summary, opts?)：推入 known-bug 注解，再调用 test.fail 或 test.fixme"
  - "tests/e2e/week/known-bugs.spec.ts：B1、N1 各一对用例（对照用例加窄断言的标记用例）"
  - "tests/KNOWN-BUGS.md：约定和登记表（B1、N1）"
  - "tests/e2e/platform/known-bugs-registry.spec.ts：knownBugRegistryProblems 和两条 BUG-01 护栏用例"
affects: [03-02, phase-04, phase-05]

actuals:
  tokens: 9500
  tasks: 2
  commits: 2
plan_head_before: fc7b2df4dc6d34ee68e58bad5a4cc050d9f43dc8
plan_head_after: c5cd0ed16359361cc591046745d9af4bd91613d5

tech-stack:
  added: []
  patterns:
    - "成对用例：同一个 describe 里一条对照用例断言前提，一条标记用例第一句调用 knownBug、只断言一条期望"
    - "登记护栏：spec 源码里的 knownBug 编号和 KNOWN-BUGS.md 的登记行、反引号标题双向核对"

key-files:
  created:
    - tests/e2e/week/known-bugs.spec.ts
    - tests/KNOWN-BUGS.md
    - tests/e2e/platform/known-bugs-registry.spec.ts
  modified:
    - tests/support/test.ts

key-decisions:
  - "B1、N1 都在执行时去掉标记亲眼复现，都用 test.fail，没有用 test.fixme"
  - "登记护栏的正则用字面量写，不用字符串拼 RegExp，避免转义问题"

requirements-completed: [BUG-01]

duration: 20min
completed: 2026-11-03
---

# Phase 3 Plan 04: 已知 bug 约定与 B1、N1 Summary

**`knownBug` helper、B1 和 N1 两对用例、中文的 KNOWN-BUGS.md 登记表和双向核对的登记护栏已就位；两个 bug 都在去掉标记后亲眼复现，都用 `test.fail` 标记。**

## 执行情况

- 2 个任务（1 个 tracer、1 个 auto），2 个提交，新建 3 个文件，修改 1 个文件，没有新增依赖，没有运行安装命令。
- `us-journey-tracker.html` 全程未改，sha256 为基线值 `2a954fd0…8a1872`。

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 8c56281 | knownBug、B1 的一对用例、KNOWN-BUGS.md（约定加 B1 行）、登记护栏 |
| 2 | c5cd0ed | N1 的一对用例和登记行、护栏改为要求扫到 B1 和 N1、常驻反向对照 |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式）：提交前重跑两个新 spec、grep 组合和完整 `npm test`（76 条）全部通过，记录 “Tracer verified end-to-end — expanding” 后展开 Task 2。

## 复现确认（D-13）

两条标记用例都先临时注释掉 `knownBug` 调用，用 `--retries=0` 运行一次，再恢复。

| 编号 | 失败在哪条断言 | 实际值 | 结论 |
|------|----------------|--------|------|
| B1 | 标记用例里的 `c.text` 的 `toHaveValue('SYNTH-B1 draft')`，超时 2 秒 | 空字符串 | 稳定复现，用 `test.fail` |
| N1 | 标记用例里的 `c.text` 的 `toHaveValue('SYNTH-N1 draft')`，超时 2 秒 | 空字符串 | 稳定复现，用 `test.fail` |

两次去掉标记后，对应的对照用例都是通过的，失败的只有那条草稿断言，没有别的错误；打印出来的只有空字符串和合成草稿，没有个人计划文字。复现结论只代表当前应用版本。

## 最终状态

- B1、N1 都是 `test.fail`，没有 `test.fixme`。
- 连续两次完整 `npm test`：每次 79 条通过，汇总里没有 flaky。（两次标记用例在列表里显示为 `x`，属于预期失败，计为通过。）
- `node tools/privacy/privacy-check.mjs --all` 退出 0（103 个文件）；两次提交的 pre-commit 隐私检查都一次通过。
- `tests/e2e/week` 里引用 toast 的文件和 `tests/support/toast.ts` 没有可见性断言，也没有固定睡眠。

## Deviations from Plan

None - plan executed exactly as written.

执行中的一处小插曲（不算偏离）：写登记护栏时，用字符串拼 `RegExp` 的写法被转义吞掉了反斜杠，第一次运行报正则语法错误；改成正则字面量后通过，没有改变计划要求的行为。提交信息末尾的 Co-Authored-By 行用的是本会话指定的署名 `Claude Sonnet 5.5`。

## 假设（有意不处理的部分，是假设，不是已验证的行为）

- 日历日面板的 B1 实例留给 Phase 4；B2、N3 留给 Phase 5；B4 由 03-02 登记。
- N1 只验证了“点直接记录的预设”这一种触发。FEATURES.md 对照表列出的另外 4 种触发（在目标页勾选任务、删除记录、拖拽、改抵达日期）未验证，留给后续阶段（Phase 4/5 视图用例可复用同一对照加 `test.fail` 模式）。
- 标记用例的复现结论只代表当前应用版本；应用修好后 `test.fail` 用例会变红，提醒去掉标记。

## Known Stubs

None。本计划只产出测试 helper、用例和文档。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-03-03：每个标记用例都有走同样准备和触发的对照用例，标记用例只断言一条期望；T-03-04：登记护栏双向核对并有常驻反向对照；T-03-16：只用合成草稿和 fixture 里的合成标签，toast 经 helper 在 Node 侧比较；T-03-SC：没有新增依赖，没有运行安装命令。

## Self-Check: PASSED

- tests/support/test.ts、tests/e2e/week/known-bugs.spec.ts、tests/KNOWN-BUGS.md、tests/e2e/platform/known-bugs-registry.spec.ts 存在
- 提交 8c56281、c5cd0ed 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 2
- 两个任务的验收命令全部通过；`npm test` 连续两次退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致
