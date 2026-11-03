---
phase: 03-composer-editor-week
fixed_at: 2026-11-03T00:00:00Z
review_path: .planning/phases/03-composer-editor-week/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-11-03
**Source review:** .planning/phases/03-composer-editor-week/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4（范围 critical_warning：0 条 Critical，4 条 Warning；Info 7 条不在范围内）
- Fixed: 4
- Skipped: 0

`workflow.use_worktrees` 为 `false`，所以直接在主检出里修改和提交，没有创建 worktree、临时分支或恢复标记文件。

## Fixed Issues

### WR-01: “没有写入”的检查在 `runFor` 后立刻采样，异步到达的多余写入会漏检

**Files modified:** `tests/e2e/editor/delete-entry.spec.ts`, `tests/e2e/editor/edit-entry.spec.ts`
**Commit:** 535d9fa
**Applied fix:** 两条 manual 时钟用例在哨兵写入到达之后，再断言写入总数恰好是 `writesBefore + 1`。写入按顺序到达，哨兵之前出现的任何多余保存都会让总数偏大。原来的 `writesBefore` 快速失败检查保留。

### WR-02: 类别显示名字面量写在 spec 里

**Files modified:** `tests/e2e/week/week-view.spec.ts`
**Commit:** 4bc2eb1
**Applied fix:** 两条断言消息改成不含类别名的写法（“该类记录”）。文件头和其他注释里的同名词属于说明文字，按审查意见不在此条范围内，没有动。

### WR-03: 带撤销的 toast 只有 5 秒，撤销窗口靠真实时间

**Files modified:** `tests/e2e/editor/delete-entry.spec.ts`, `tests/e2e/week/presets.spec.ts`
**Commit:** 0cf9cae
**Applied fix:** 三条用例（删除记录并撤销、删除自定义预设并撤销、删除内置预设并撤销）改用 manual 时钟：`clock.install`、`app.open`、`pauseAt`，删除后 `runFor(1_000)` 只推过 600 ms 防抖，toast 因时钟暂停不会过期，再点撤销，撤销之后再 `runFor` 推过第二次保存的防抖。自定义预设那条在撤销后用 `runFor(2_000)` 推过“已恢复”toast 的 1.8 秒再断言它消失。每条用例放进各自文件里单独的 `test.describe` 并 `test.use({ clockMode: 'manual' })`，同文件里依赖真实 reload 的用例不受影响。用例标题新增了 describe 前缀，REQ-ID 前缀不变。内置预设那条仍然只用计数断言和 Node 侧布尔比较，`clock.runFor` 不是元素动作，不会把 toast 文字带进日志。
**Status note:** 修改的是时间依赖的测试结构，已用目标 spec 通过验证，建议人工扫一眼这三条用例的时间推进顺序。

### WR-04: B4 标记用例的“立即刷新”路径没有任何不带标记的用例证明它本身可用

**Files modified:** `tests/e2e/week/known-bugs.spec.ts`, `tests/KNOWN-BUGS.md`
**Commit:** 8e44f28
**Applied fix:** 在 B4 的 describe 里新增一条不带标记的用例 `BUG-01 B4 reload path: ...`：同样的准备（暂停时钟、输入复盘），不推进时钟直接 `app.reload()`，只断言与 bug 无关的前提（防抖未到时没有新写入、刷新后应用再次读取账户文档共 2 次、复盘文本框可见且可用，就绪等待由 `reload()` 内部完成）。故意没有断言刷新后文本框里是新文字还是旧复盘，因此应用修好后它仍然通过，只有标记用例变红，符合已知 bug 对的约定。标记用例本身未改动，仍然只失败在 `toHaveValue` 这一条期望断言上。`tests/KNOWN-BUGS.md` 的 B4 行在“对照用例”一列登记了新标题（登记护栏会核对），“现状”里“两条用例”改为“三条用例”。

## Skipped Issues

None — 所有在范围内的发现都已修复。

## 验证

- 验证环境：主检出（没有使用隔离 worktree），低优先级、1 个 worker。
- 每条修复提交前都跑了对应的目标 spec，全部通过；提交时的隐私检查也都通过。
- 全量用例（一次，无 spec 路径）：**99 passed**。三条已知 bug 标记用例（B1、N1、B4 expected）按预期显示为预期失败，汇总计为通过；B4 新增的对照用例和登记护栏用例都通过。
- `node tools/privacy/privacy-check.mjs --all`：隐私检查通过（all，114 个文件）。
- `us-journey-tracker.html` 的 sha256 仍是 `2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`，未被修改、暂存或提交。
- 提交前扫描了 diff 里的控制字符，没有发现。

## 未处理（不在 fix_scope 内）

IN-01 到 IN-07 共 7 条 Info 发现没有处理（fix_scope 为 critical_warning）。其中 IN-04（登记护栏的 `B4` 防空转检查和双引号正则）与本次 WR-04 相关，可以在之后用 `all` 范围处理。

---

_Fixed: 2026-11-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
