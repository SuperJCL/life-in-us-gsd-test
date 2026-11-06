---
phase: 03-composer-editor-week
plan: 01
subsystem: testing
status: complete
tags: [composer, toast, expect-saved, presets, week-view, privacy-masking, account-mode, playwright]

requires:
  - phase: 02-account-mock-data-export
    provides: "app.open 的账户模式、app.backend、expectAccountMode、loadFixture('full-state.json')"
provides:
  - "tests/support/composer.ts：composer(page, p)，p 为 'w'（本周）或 'c'（日历日面板）共用一套选择器和预设方法"
  - "tests/support/toast.ts：expectToast、expectToastPrefix、expectUndoOffered、undo、expectToastGone，全部在 Node 侧比较"
  - "AppHarness.saved() 和 expectSaved(predicate, message?)，统一账户和本地两种存储模式"
  - "tests/e2e/week/composer.spec.ts 六条 WEEK-03 用例，tests/e2e/week/presets.spec.ts 三条 WEEK-04 用例"
  - "tests/support/strings.ts 新增 TOAST_UNDO_LABEL、TOAST_RECORDED_PREFIX、TOAST_PRESET_ADDED_PREFIX、TOAST_PRESET_DUPLICATE、TOAST_PRESET_DELETED_PREFIX、PRESET_EDIT_LABEL、PRESET_EDIT_DONE_LABEL"
affects: [03-02, 03-03, 03-04, phase-04, phase-05]

actuals:
  tokens: 6400
  tasks: 2
  commits: 2
plan_head_before: c2f57f7758c60d8f58860c04283b05e6503cc994
plan_head_after: 79f4e59c4e7d78092b409d1a3d866a2a1fd05246

tech-stack:
  added: []
  patterns:
    - "按根节点参数化的页面对象：composer(page, p) 只返回定位器，不持有元素句柄（应用每次重绘都会重建 DOM）"
    - "toast 用 page.evaluate 一次读回 on、act 类和文字，在 Node 侧用 expect.poll 比较；失败消息只含期望值或“内容已隐藏”"
    - "内置预设只按序号选；点选、删除和读取都在页面内用 page.evaluate 完成，用例只用 toHaveCount 和 Node 侧布尔比较"
    - "expectSaved 用 expect.poll 等防抖保存，默认 message 不含状态内容"

key-files:
  created:
    - tests/support/composer.ts
    - tests/support/toast.ts
    - tests/e2e/week/composer.spec.ts
    - tests/e2e/week/presets.spec.ts
  modified:
    - tests/support/app.ts
    - tests/support/strings.ts

key-decisions:
  - "saved() 在账户模式只认 backend.writes 的最后一条，种子文档不算保存；本地模式用种子原文区分种子和应用写回"
  - "内置预设的点选和删除走页面内 click()，不走真实指针路径；真实指针路径由 fixture 里的合成自定义标签证明"
  - "按计划保持 Task 1 的 composer 只含基础方法，预设方法在 Task 2 才加入，两个任务各自一次提交"

requirements-completed: [WEEK-03, WEEK-04]

coverage:
  - id: D1
    description: "本周 composer 记一笔：按钮初始禁用，提交后 toast 为已记录、文本框清空、今天那一列出现记录，保存的记录日期为今天、类别为当前类别，总条数恰好多一条"
    requirement: "WEEK-03"
    verification:
      - kind: test
        ref: "tests/e2e/week/composer.spec.ts#WEEK-03 records an entry from the week composer and saves it on the selected day"
        status: pass
    human_judgment: false
  - id: D2
    description: "同一个 composer helper 也驱动日历日面板实例（p='c'），Ctrl+Enter 提交后保存到今天"
    requirement: "WEEK-03"
    verification:
      - kind: test
        ref: "tests/e2e/week/composer.spec.ts#WEEK-03 the composer helper also drives the calendar day panel instance"
        status: pass
    human_judgment: false
  - id: D3
    description: "切换类别后草稿保留，记录的条目属于新类别"
    requirement: "WEEK-03"
    verification:
      - kind: test
        ref: "tests/e2e/week/composer.spec.ts#WEEK-03 switching category keeps the draft and records the entry in the chosen category"
        status: pass
    human_judgment: false
  - id: D4
    description: "合成自定义标签的真实点击直接记录；内置直接记录预设在页面内点击后新增一条记录，保存的文字等于运行时读到的标签文字，失败输出不含标签文字"
    requirement: "WEEK-03"
    verification:
      - kind: test
        ref: "tests/e2e/week/composer.spec.ts#WEEK-03 a built-in direct-record preset adds an entry at once without printing its text"
        status: pass
    human_judgment: false
  - id: D5
    description: "预填预设只把文字填进文本框（已有草稿时接在换行后面），不新增记录，补上合成文字后 Ctrl+Enter 保存完整文字"
    requirement: "WEEK-03"
    verification:
      - kind: test
        ref: "tests/e2e/week/composer.spec.ts#WEEK-03 a fill preset only prefills the draft and Ctrl+Enter records the completed text"
        status: pass
    human_judgment: false
  - id: D6
    description: "空白文本时记录按钮保持禁用，单独 Enter 只换行不提交，先选另一天再记录会保存到那一天"
    requirement: "WEEK-03"
    verification:
      - kind: test
        ref: "tests/e2e/week/composer.spec.ts#WEEK-03 blank text keeps the record button disabled, Enter alone adds a line, and the entry lands on the picked day"
        status: pass
    human_judgment: false
  - id: D7
    description: "添加 SYNTH- 标签排在该类别预设最后，重复添加被拒绝且数量不变，切换类别看不到，刷新后仍在"
    requirement: "WEEK-04"
    verification:
      - kind: test
        ref: "tests/e2e/week/presets.spec.ts#WEEK-04 adding a preset appends it to its category, rejects a duplicate and survives reload"
        status: pass
    human_judgment: false
  - id: D8
    description: "编辑模式下删除 fixture 里的自定义标签，toast 带撤销，保存后的 add 不含它；撤销后回来并仍在编辑模式"
    requirement: "WEEK-04"
    verification:
      - kind: test
        ref: "tests/e2e/week/presets.spec.ts#WEEK-04 deleting a custom preset in edit mode can be undone from the toast"
        status: pass
    human_judgment: false
  - id: D9
    description: "删除第 0 个内置预设后 hide 多一项，撤销后数量和 hide 都恢复，全程失败输出不含标签文字"
    requirement: "WEEK-04"
    verification:
      - kind: test
        ref: "tests/e2e/week/presets.spec.ts#WEEK-04 deleting a built-in preset hides it and undo restores it without printing its text"
        status: pass
    human_judgment: false
  - id: D10
    description: "失败输出里确实不会出现内置预设文字（包括 Playwright 调用日志里的元素预览）"
    verification: []
    human_judgment: true
    rationale: "用例全部通过，没有触发失败路径；脱敏靠结构约束（页面内操作、只用计数和布尔、verify 拒绝按序号取定位器）保证，是否真的不泄露要靠人在一次故意失败的运行里核对"

duration: 25min
completed: 2026-11-03
---

# Phase 3 Plan 01: composer、toast 与 expectSaved helper Summary

**按根节点参数化的 composer helper（本周 w、日历日面板 c）、只在 Node 侧比较的 toast helper 和统一两种存储模式的 `app.saved()`/`expectSaved()` 已就位；用它们完成六条 WEEK-03 和三条 WEEK-04 用例，内置预设只按序号在页面内操作，失败输出不含个人计划文字。**

## 执行情况

- 2 个任务（1 个 tracer、1 个 auto），2 个提交，新建 4 个文件，修改 2 个文件，没有新增依赖，没有运行任何安装命令。
- `us-journey-tracker.html` 全程未改、未被跟踪，sha256 为基线值 `2a954fd0…8a1872`。

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 5bd4bd9 | composer.ts（基础方法）、toast.ts、app.ts 的 saved/expectSaved、TOAST_UNDO_LABEL、两条 WEEK-03 用例 |
| 2 | 79f4e59 | composer.ts 的预设方法、六个文案常量、四条 WEEK-03 用例、三条 WEEK-04 用例 |

Tracer 的 `<verify>` 是纯自动化命令（`end-of-phase`，交互模式）：提交后重跑 `tests/e2e/week`、grep 组合和完整 `npm test`（66 条）全部通过，记录 “Tracer verified end-to-end — expanding” 后展开 Task 2。

## saved() 在两种模式下的语义

- **账户模式：** 只认应用发出的写入，返回 `backend.writes` 最后一条 `data` 的 JSON 深拷贝；还没有写入时返回 `null`。mock 里的种子文档不算“保存”。
- **本地模式：** 读 `localStorage[STATE_KEY]`；键不存在，或值与 `open()` 写进去的种子原文完全相同时返回 `null`。依据：所有 fixture 都带 `_synthetic`，而应用的 normalize 会丢掉它，所以应用写回的内容不可能与种子原文相同。
- `expectSaved(predicate, message?)` 用 `expect.poll` 等 predicate 成立，`saved()` 为 `null` 时算不成立；默认 message 不含状态内容。`persisted()` 和 `expectPersisted()` 没有改动。
- 本地模式的 `saved()` 分支在本计划的用例里没有被执行（所有 WEEK 用例都是账户模式），它的语义由上面的依据推出，尚未被用例证明。

## 内置预设在页面内点击的做法

- composer 的 `presetText / presetFills / presetIndexes / presetIndexOf / clickPreset / deletePreset` 都用 `page.evaluate`，选择器只由根节点 id 和 `p` 拼出，不含标签文字；只有序号、布尔或只留在内存的文字回到 Node。
- 用例对内置预设元素只用 `toHaveCount`，文字只用于 Node 侧的布尔比较，断言消息不拼接文字；`composer.ts` 和两个 spec 里没有按序号、首个或末个取定位器的写法（verify 的 grep 已确认）。
- **合成标签的真实点击结果：** fixture 里的合成自定义标签用真实指针点击，直接记录路径通过（新增一条记录，toast 为“已记录：”加该标签）；添加标签、编辑模式下删除合成标签、点撤销也都用真实点击，全部通过。内置预设走页面内 `click()`，触发的是同一个应用处理函数，但不经过真实指针路径。

## 观察值

- **一次通过：** 九条用例第一次运行就全部通过，没有重试，没有改动应用，也没有调整任何期望。
- **连续运行：** `tests/e2e/week` 在收尾阶段连续两次各 9 条通过；完整 `npm test` 连续两次各 73 条通过，汇总里没有 flaky。
- **阶段检查：** `node tools/privacy/privacy-check.mjs --all` 退出 0（98 个文件）；两次提交的 pre-commit 隐私检查都一次通过；`tests/e2e/week` 和 `tests/support/toast.ts` 里没有固定睡眠，引用 toast 的文件里没有可见性断言。
- **没有应用与 FEATURES.md 描述不一致的情况**，所以没有登记任何已知 bug。

## Deviations from Plan

None - plan executed exactly as written.

（提交信息末尾的 Co-Authored-By 行用的是本会话系统提示指定的署名 `Claude Sonnet 5.5`。）

## 假设（有意不验证的边界行为，是假设，不是已验证的行为）

- Meta+Enter 提交：只验证了 Control+Enter。
- Escape 取消添加标签：不验证。
- 失焦时提交添加标签：添加一律用 Enter 提交，失焦提交不验证。
- 再次添加已隐藏的内置标签后回到原位：不验证。
- 只用一个代表类别验证内置预设的直接记录和预填（取类别顺序里第一个有该类预设的类别），不做类别笛卡尔积。
- 内置预设不走真实指针路径：只在页面内点击，真实指针路径由合成标签证明。
- 撤销 toast 过期：放在 Phase 4。

## Known Stubs

None。本计划只产出测试 helper、用例和文案常量，没有占位数据或未接线的组件。

## Threat Flags

None。没有新的网络端点、认证路径或信任边界上的文件访问。T-03-01、T-03-02、T-03-15 的缓解已落地（页面内操作、只用计数和布尔、toast 只在 Node 侧比较）；T-03-05：每条账户模式用例开局都 `expectAccountMode()`；T-03-06：应用文件未改；T-03-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

03-04（已知 bug 约定）、03-02（本周渲染与拖放、复盘）、03-03（编辑弹窗）和 Phase 4 可直接调用 `composer(page, 'w' | 'c')`、`expectToast / expectToastPrefix / undo / expectToastGone`、`app.saved() / app.expectSaved()`。

## Self-Check: PASSED

- tests/support/composer.ts、tests/support/toast.ts、tests/support/app.ts、tests/support/strings.ts、tests/e2e/week/composer.spec.ts、tests/e2e/week/presets.spec.ts 存在
- 提交 5bd4bd9、79f4e59 都在当前分支上，`git rev-list --count` 从计划开始前的提交到 HEAD 为 2
- 两个任务的验收命令全部通过；`npm test` 连续两次退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致
