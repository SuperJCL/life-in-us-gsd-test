---
phase: 03-composer-editor-week
verified: 2026-11-03T16:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/03-composer-editor-week/03-01-PLAN.md"
  - ".planning/phases/03-composer-editor-week/03-01-SUMMARY.md"
  - ".planning/phases/03-composer-editor-week/03-02-PLAN.md"
  - ".planning/phases/03-composer-editor-week/03-02-SUMMARY.md"
  - ".planning/phases/03-composer-editor-week/03-03-PLAN.md"
  - ".planning/phases/03-composer-editor-week/03-03-SUMMARY.md"
  - ".planning/phases/03-composer-editor-week/03-04-PLAN.md"
  - ".planning/phases/03-composer-editor-week/03-04-SUMMARY.md"
  - "tests/KNOWN-BUGS.md"
  - "tests/PROBES.md"
  - "tests/README.md"
  - "tests/e2e/editor/delete-entry.spec.ts"
  - "tests/e2e/editor/edit-entry.spec.ts"
  - "tests/e2e/editor/task-editor.spec.ts"
  - "tests/e2e/platform/known-bugs-registry.spec.ts"
  - "tests/e2e/week/composer.spec.ts"
  - "tests/e2e/week/drag.spec.ts"
  - "tests/e2e/week/known-bugs.spec.ts"
  - "tests/e2e/week/presets.spec.ts"
  - "tests/e2e/week/review.spec.ts"
  - "tests/e2e/week/week-view.spec.ts"
  - "tests/support/app.ts"
  - "tests/support/composer.ts"
  - "tests/support/editor.ts"
  - "tests/support/expect-from-fixture.ts"
  - "tests/support/strings.ts"
  - "tests/support/test.ts"
  - "tests/support/toast.ts"
covered_digest: "v4:sha256:bc45b35efb2090822f6b8f9ce9c0c73f3e04ce825cae970d4860ef6e1a34f9a2"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
---

# Phase 3: 记一笔、编辑弹窗与本周视图 验证报告

**Phase Goal:** 开发者拥有可复用的记一笔、编辑弹窗和 toast 测试 helper，以及统一的已知 bug 标记约定，并用它们完整验证本周视图的渲染和交互。
**Verified:** 2026-11-03
**Status:** passed
**Re-verification:** 否，首次验证

本阶段是测试脚手架阶段，交付物是 helper、spec 和约定文档，不是应用功能。所以“必须为真”指 ROADMAP 的 5 条成功标准：每条都要有真实的 helper 和 spec 代码，用例要确实断言了那条行为，并且全量运行结果可信。验证以读代码为主，不采信 SUMMARY 的描述。

## Goal Achievement

### Observable Truths

| # | Truth（ROADMAP 成功标准） | Status | Evidence |
|---|---|---|---|
| 1 | 本周视图的标题、日期范围、五类统计和目标、7 天记录列与 fixture 推导一致；上一周、下一周、本周和选中某天都正常 | ✓ VERIFIED | `tests/e2e/week/week-view.spec.ts` 的 `expectWeekMatches` 逐项比较标题、范围、五张类别卡（名称、计数）、目标行（Node 侧布尔比较）、7 列（日期、aria-label、记录 id、完成计划 id、today/sel 类），期望值全部来自 `expect-from-fixture.ts`（该文件不导入应用代码，顶部有说明）。覆盖当前周、跨月周、抵达周三种标题、7 天健身达标、上一周/下一周/本周、点列头、Enter、Space 选日。WEEK-02 之后记一笔保存在所选日。 |
| 2 | 记一笔：切换类别、预设标签直接记录或预填、Ctrl+Enter 提交，记录出现在所选日期并被保存；添加预设、编辑模式删除、toast 撤销都有用例，toast 用 `.on` 类断言，不用可见性断言 | ✓ VERIFIED | `composer.spec.ts` 6 条：本周实例的 tracer、`composer(page,'c')` 驱动日历日面板、切类别保留草稿、内置直接记录预设、预填预设加 Ctrl+Enter、空白禁用/Enter 换行/选日记录；每条保存都用 `app.expectSaved`（`expect.poll`，不睡眠）。`presets.spec.ts` 3 条：添加（排在末尾、重复提示、跨类别不可见、刷新后仍在）、自定义标签删除加撤销、内置预设隐藏加撤销。`tests/support/toast.ts` 全部经 `page.evaluate` 读 `#toast` 的 `on`/`act` 类再在 Node 侧 `expect.poll` 比较；对 `e2e/week`、`e2e/editor` 和三个 helper 搜索可见性断言，唯一一处 `toBeVisible` 是 B4 对照用例里对 `#review` 的断言，与 toast 无关。 |
| 3 | 拖一条记录到另一天后保存状态里的日期确实变了；复盘文本保存后刷新仍在 | ✓ VERIFIED | `drag.spec.ts`：`dragTo(steps:10)` 从 2026-03-16 拖到 2026-03-19，断言 toast、`expectSaved` 里该条 date 变了且其余全部不变（布尔）、目标列有、原列无、完成的计划条目无 `draggable`；采用的方案已写进 `tests/PROBES.md`（方案 A，真实指针路径，无合成事件）。`review.spec.ts`：多行加行尾空格原文先 `expectSaved` 再 `reload`，`#review` 仍是原文；每周独立；清空后保存的 `reviews` 不含该周键。N2 规则写在文件头。 |
| 4 | 从本周、日历、时间线点任意记录能打开编辑弹窗，改文字、类别、日期保存后三个视图同步；弹窗里删除可撤销，空文字不能保存；完成计划的弹窗能改完成日期或改回未完成 | ✓ VERIFIED | `tests/support/editor.ts` 封装 `dialog#editor`。`edit-entry.spec.ts` 三个入口（本周、日历用 Ctrl+Enter、时间线不改日期）各自保存后，`expectLogInEveryView` 在本周、日历、时间线三个视图核对新文字、新类别、新日期位置，并核对 `expectSaved` 中其余记录不变；取消、Escape、点遮罩三种关闭方式在 manual 时钟下证明没有写入，并用哨兵写入证明防抖窗口确实推进过。`delete-entry.spec.ts`：弹窗删除、`undo`、保存后的 id 顺序与 fixture 完全一致；空白文字保存后弹窗仍开、toast 提示、焦点回文本框、写入次数不变、哨兵到达。`task-editor.spec.ts`：对合成的 `c-synth-2` 改完成日期（列、时间线、`tasks` 状态都变）和“标记为未完成”（`done:false`、`doneDate:''`、本周和时间线消失、目标页复选框未勾）。 |
| 5 | 已知 bug 用统一方式标记：对照断言加窄断言配 `test.fail`/`test.fixme`，附 `known-bug` 注解；登记在 `tests/KNOWN-BUGS.md`，与 `CONCERNS.md` 对应 | ✓ VERIFIED | `tests/support/test.ts` 的 `knownBug(id, summary, opts?)` 推入 `known-bug` 注解后调用 `test.fail()`（`opts.fixme` 时调用 `test.fixme`）。`known-bugs.spec.ts` 有 B1、N1、B4 三对用例：对照用例证明前提成立（草稿在、按钮可用、触发确实生效），标记用例第一句调用 `knownBug`，只断言一条期望。B4 另有一条不带标记的“刷新路径可用”对照（WR-04 修复）。`known-bugs-registry.spec.ts` 的护栏双向核对编号和标题，并有常驻反向对照证明三种缺失都被报出。`tests/KNOWN-BUGS.md` 有“约定”和登记表（B1、N1、B4）；B1、B4 的 `CONCERNS.md` 条目已确认存在（Known Bugs 一节），N1 行写明 `CONCERNS.md` 没有单独条目、引同源的 B1 条目并保留 `FEATURES.md` 出处，`FEATURES.md` 里确有 N1 条目。 |

**Score:** 5/5 truths verified（0 条 present 但行为未验证）

### 对计划里更细的 must_haves 的抽查

| 项 | 结果 |
|---|---|
| `composer.ts` 只从 `@playwright/test` 导入，`toast.ts`、`editor.ts` 只从 `@playwright/test` 和 `./strings` 导入，不从 `./test` 导入（D-07） | ✓ 通过，读文件确认 |
| `AppHarness.saved()`/`expectSaved()`：账户模式取 `backend.writes` 最后一条的深拷贝，没有写入返回 null；本地模式读 localStorage，种子原文返回 null；默认 message 不含状态内容；`persisted()`/`expectPersisted()` 未改（D-09） | ✓ 通过，读 `tests/support/app.ts` 确认 |
| 内置预设只在页面内按序号操作；`composer.ts`、`composer.spec.ts`、`presets.spec.ts`、`known-bugs.spec.ts` 里没有 `.nth`/`.first`/`.last`（D-14） | ✓ 通过，grep 为空 |
| manual 时钟只在证明“没有保存”和撤销窗口的用例里用，同一个用例不混用 `setFixedTime`（D-05、D-15） | ✓ 通过，均为 `test.use({ clockMode: 'manual' })` 的 describe |
| 新用例标题英文、以需求编号开头（D-06） | ✓ 通过 |
| `us-journey-tracker.html` 未修改，仍被 gitignore，未被 git 跟踪 | ✓ sha256 为 `2a954fd0…8a1872`，与基线一致；`git ls-files` 为空 |
| 阶段文件全部已提交 | ✓ `git status --short tests` 为空 |
| 隐私检查 | ✓ `node tools/privacy/privacy-check.mjs --all` 输出“隐私检查通过（all，116 个文件）” |
| 债务标记 | ✓ 对 `tests/e2e/week`、`tests/e2e/editor`、`tests/support`、`tests/KNOWN-BUGS.md`、`tests/README.md` 搜索 TBD、FIXME、XXX、TODO、HACK 无结果；也没有 `waitForTimeout`、`test.skip`、`test.only` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tests/support/composer.ts`（178 行） | 参数化的记一笔 helper | ✓ VERIFIED | 实现真实，被 `composer.spec.ts`、`presets.spec.ts`、`week-view.spec.ts`、`known-bugs.spec.ts` 使用 |
| `tests/support/toast.ts`（77 行） | `.on` 类 toast helper | ✓ VERIFIED | 被 composer、presets、drag、known-bugs 和三个 editor spec 使用 |
| `tests/support/editor.ts`（104 行） | 编辑弹窗 helper | ✓ VERIFIED | 被三个 editor spec 使用 |
| `tests/support/test.ts` 的 `knownBug` | 已知 bug 标记 | ✓ VERIFIED | 被 `known-bugs.spec.ts` 使用 |
| `tests/support/app.ts` 的 `saved`/`expectSaved` | 统一的已保存断言 | ✓ VERIFIED | 全部新 spec 使用 |
| `tests/support/expect-from-fixture.ts` | fixture 推导 | ✓ VERIFIED | 23 个导出函数，周视图相关为 `expectedWeekRange`、`expectedWeekTitle`、`weekCountsByCategory`、`weekGoalDays`、`weekDayColumns` 等 |
| 9 个 spec（week 6、editor 3）与 `known-bugs-registry.spec.ts` | 覆盖 WEEK-01..06、EDIT-01..03、BUG-01 | ✓ VERIFIED | 非桩，断言实质 |
| `tests/KNOWN-BUGS.md`、`tests/README.md`、`tests/PROBES.md` | 约定、登记、用法、拖放方案 | ✓ VERIFIED | README 目录表含 `tests/e2e/week/`、`tests/e2e/editor/`、`tests/KNOWN-BUGS.md`，并说明各 helper 与已知 bug 约定 |

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| spec | `tests/support/test.ts` | 唯一的 test/expect 出口（`known-bugs-registry` 只用 `test`/`expect`，无 helper 循环引用） | ✓ WIRED |
| `known-bugs.spec.ts` | `KNOWN-BUGS.md` | 登记护栏扫描 `knownBug('<ID>'` 并核对标题；`knownBugRegistryProblems` 在真实文件上返回空数组且扫到 B1、N1 | ✓ WIRED |
| `composer.ts`/`toast.ts` | 应用 DOM | `#wkComp`/`#dayPanel` 和 `#toast`，全量运行通过说明选择器有效 | ✓ WIRED |
| `expectSaved` | mock 后端写入 | 读 `backend.writes` 最后一条 | ✓ WIRED |

### Behavioral Spot-Checks

编排器已在复核修复之后完整运行一次：`99 passed (2.2m)`，退出码 0，0 flaky，B1/N1/B4 的标记用例按预期失败计入通过，应用 sha256 未变。本次没有重跑全量。以下三次定向变异运行是为了验证“失败输出不含个人计划文字”的 human_judgment 项，每次运行后都已用 `git checkout` 还原，`git status --short tests` 为空。

| 变异（临时，已还原） | 目标失败路径 | 结果 | 输出扫描 |
|---|---|---|---|
| `presets.spec.ts`：内置预设删除用例里把 `expectSaved` 谓词的期望隐藏数加大 | `expect.poll` 超时路径（谓词闭包里持有内置预设文字） | 失败，消息为“等待应用保存（内容已隐藏）”，只有 `Expected: true` / `Received: false` | 0 处命中 |
| `composer.spec.ts`：预填预设用例里把草稿比较取反 | Node 侧布尔比较路径（比较值含内置预设文字） | 失败，消息为“已有草稿时预填结果不对（内容已隐藏）”，只有 `Expected: true` / `Received: false` | 0 处命中 |
| `presets.spec.ts`：内置预设删除用例里把 `toHaveCount` 期望值加大 | 定位器 `toHaveCount` 失败路径 | 失败，只打印定位器和数量（`Expected: 13` / `Received: 5`、“locator resolved to 5 elements”） | 0 处命中 |

输出扫描的方法：写了一个临时脚本，从应用文件里提取所有至少含 4 个连续汉字的字符串片段，剔除已经出现在 `tests/` 目录里的界面文案（这些本来就在仓库里），再检查失败输出是否包含剩余片段。先做了正向对照：把全部这类片段写入一个文件，脚本报告 64 处命中，证明扫描能检出；三次失败输出都是 0 处命中。

## Human-judgment 项的结论（已由自动化解决）

两份执行者 SUMMARY 提出的 human_judgment 项是：失败输出是否真的不会打印内置预设和任务文字、健身目标数字。结论：**已解决，不需要人工验收。**

- 静态约束成立：`composer.ts`、`composer.spec.ts`、`presets.spec.ts`、`known-bugs.spec.ts` 里没有 `.nth`/`.first`/`.last`；内置预设的点选、删除和读文字都在 `page.evaluate` 内完成，对内置预设元素只用 `toHaveCount`；`toast.ts` 完全不用 Playwright 的文字类和可见性断言；`week-view.spec.ts` 的目标行（含健身目标数字）经 `page.evaluate` 读回、在 Node 侧做前缀和布尔比较，失败消息只含类别名。
- 动态证据：上述三条失败路径（`expect.poll`、布尔比较、`toHaveCount`）各实际触发一次，输出均不含应用独有的个人计划文字。
- 未实际触发的路径：toast 前缀比较的 `expectToastPrefix` 和健身目标行的 `mismatches` 比较，二者经读代码确认失败消息是固定文字加类别名，结构上与已触发的 `expect.poll` 路径相同，不列为风险。
- 一条边界说明：失败时 Playwright 在本地 `test-results/` 保留截图、trace 和 `error-context.md`，它们会拍到个人计划文字。这是 D-02 的既定设计，目录已被 `.gitignore` 忽略，不会进入公开仓库，也不是终端输出。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| WEEK-01 | 03-02 | 周视图渲染 | ✓ SATISFIED | `week-view.spec.ts` 4 条用例 |
| WEEK-02 | 03-02 | 周导航与选中某天 | ✓ SATISFIED | `week-view.spec.ts` 2 条用例 |
| WEEK-03 | 03-01 | 记一笔 | ✓ SATISFIED | `composer.spec.ts` 6 条用例 |
| WEEK-04 | 03-01 | 预设增删撤销 | ✓ SATISFIED | `presets.spec.ts` 3 条用例 |
| WEEK-05 | 03-02 | 拖放改日期 | ✓ SATISFIED | `drag.spec.ts` |
| WEEK-06 | 03-02 | 复盘保存与刷新 | ✓ SATISFIED | `review.spec.ts` 2 条用例 |
| EDIT-01 | 03-03 | 三入口编辑同步 | ✓ SATISFIED | `edit-entry.spec.ts` 4 条用例 |
| EDIT-02 | 03-03 | 弹窗删除撤销、空文字不保存 | ✓ SATISFIED | `delete-entry.spec.ts` 2 条用例 |
| EDIT-03 | 03-03 | 完成计划改日期或改回未完成 | ✓ SATISFIED | `task-editor.spec.ts` 2 条用例 |
| BUG-01 | 03-02、03-04 | 已知 bug 统一标记与登记 | ✓ SATISFIED | `knownBug`、B1/N1/B4 三对用例、登记护栏、`KNOWN-BUGS.md` |

四份 PLAN 的 `requirements` 并集恰好是这 10 个 ID（03-01：WEEK-03、WEEK-04；03-02：WEEK-01、02、05、06、BUG-01；03-03：EDIT-01..03；03-04：BUG-01），ROADMAP 的 Phase 3 需求列表也是这 10 个，`REQUIREMENTS.md` 里这 10 个 ID 均勾选并映射到 Phase 3。没有孤立需求，没有遗漏。

### Anti-Patterns Found

没有阻断项。债务标记、固定睡眠、`test.skip`/`test.only` 均无。

### 开放项（非阻断，来自 03-REVIEW-DISPOSITION）

4 条 WARNING（WR-01 到 WR-04）已在 535d9fa、4bc2eb1、0cf9cae、8e44f28 修复；我读了对应代码：哨兵之后的“没有多余写入”检查（`writes.length` 等于 `writesBefore + 1`）、撤销窗口用 manual 时钟、B4 的“刷新路径可用”对照用例都在，类别显示名不再写进 spec 的断言消息。8 条 INFO 按范围保持 open：IN-01 composer 里有两个没有使用的成员，IN-02 用魔法下标取类别，IN-03 用 `JSON.stringify` 比较“其余内容没变”对键顺序敏感，IN-04 登记护栏的两处缺口，IN-05 README 对标记用例在列表里显示的描述不准确，IN-06 选中类名的正则过松，IN-07 “改回未完成”用例没有先确认复选框原本是勾选的，IN-08 README 的“时间与保存”一节没有跟上 manual 时钟的新用法。它们都不影响任何一条成功标准，建议在 Phase 4 或阶段收尾时顺手清理。

补充观察：`.planning/phases/03-composer-editor-week/` 下有未跟踪的 `03-REVIEW.iter2.md` 和 `03-REVIEW-FIX.iter2.md`，是评审迭代产物，不影响验证；是否提交由编排器决定。

### Human Verification Required

无。

### Gaps Summary

没有缺口。四份 PLAN 中的 helper、spec、约定文档都存在、非桩、被使用，并且全量运行（99 通过，0 flaky）加上本次三次定向变异运行共同支持：行为断言真实有效，失败输出不泄漏个人计划文字，应用文件保持未改。Phase 3 目标达成，可以进入 Phase 4。

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
