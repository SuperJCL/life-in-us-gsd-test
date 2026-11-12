---
phase: 12-plan-editor
fixed_at: 2026-11-11T00:00:00Z
review_path: .planning/phases/12-plan-editor/12-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-11-11
**Source review:** .planning/phases/12-plan-editor/12-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7（所有者 2026-11-11 批准全部修复，fix_scope 为 all）
- Fixed: 7
- Skipped: 0

每条发现一个提交，应用文件改动的提交都在同一次提交里重新记录了 `tests/support/constants.ts` 的 `APP_SHA256`（保持工作副本的 CRLF 换行）。`workflow.use_worktrees` 为 `false`，所以没有建 worktree，改动和验证都在主工作副本里完成。所有定向用例都在 below-normal 优先级、1 个 worker、不同时跑两个的条件下运行，每次运行后立刻用 `check-report.mjs` 核对了报告。

## Fixed Issues

### CR-01: 计划读不出来时选「用我的覆盖」，原始的读不出来的计划没有留底

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/plan-editor-sync.spec.ts`
**Commit:** 0ba2149
**Applied fix:** 照审查建议，`savePlanDraft` 里「用我的覆盖」的留底改为 `if(overwrite&&!unread)`。读不出来的计划已经在前一步留过底时，不再用示例计划把它冲掉；toast 仍然优先说「读不出来的那一份已留底」，现在这句话是真的。
**回归用例：** `plan-editor-sync.spec.ts` 新增「打开时可读，编辑期间远端换成读不出来的计划，保存时选覆盖」，断言本机留底和下载出来的备份里是服务器原来那份读不出来的数据（带合成标记字段），不是示例计划。已确认去掉修复后该用例失败。
**状态：** fixed: requires human verification（逻辑类修复，语法检查不能证明语义，用例覆盖了审查描述的路径）。

### CR-02: 编辑页开着时「恢复」或「撤销导入」绕过 D-07 冲突判断

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/plan-editor-sync.spec.ts`
**Commit:** 9c99a87
**Applied fix:** 选择的是审查给出的第一种办法加「提示行马上刷新」，没有阻止工具栏（不与任何已定决定冲突，D-07 本来就要求草稿不被冲掉、保存时三选一，阻止导入反而改变导入对话框的行为）：
1. `peChanged` 去掉对 `docs.plan.base` 的依赖，只比较内容 `peCanon(peNow())!==pe.orig`。导入不会前移 `base`，所以以前上传成功之前判断为假；pe 在保存时就关闭，不存在「本机上一次保存的回声」，内容比较已经够用。`pe.base` 字段还留着，不再参与判断，注释已改。
2. `applyImport`（含两个提前返回的分支）、`undoImport`（含确认框里的 `fold`）、`applyView` 并入后调用 `if(pe)peRemote()`，提示行和 `#pe-notice` 立刻出现，不用等下一次同步。

保存时的行为：编辑页里导入之后点保存，弹三选一；选「用我的覆盖」时被盖掉的（导入的）计划按 Phase 9 的留底写进本机留底，可以下载。选「用我的覆盖」后，导入文件带来的进度、自定义待办、力量历史仍会按草稿的差集被删，这和别的设备改了计划时选覆盖的行为一致，导入前的数据另有「撤销导入」副本。
**回归用例：** `plan-editor-sync.spec.ts` 新增两个用例：
- 「编辑页开着时导入带计划的文件」：用 `hold` 故障把计划上传挂起（这正是 `base` 还没前移的窗口），断言提示马上出现、保存弹三选一、覆盖后留底是导入的计划。已确认旧判断下该用例失败（提示不出现）。
- 「编辑页开着时撤销导入」：断言撤销后提示马上出现、保存弹三选一、留底是撤销后的计划。这一条在旧判断下也能通过（撤销流程里 `base` 因其他步骤已前移），所以它只是覆盖这条路径，不是 CR-02 最直接的判别用例；判别力来自上一条。
**状态：** fixed: requires human verification

### WR-01: 预设标签的校验错误不会展开所在的折叠卡

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/plan-editor-fit.spec.ts`
**Commit:** 0595a84
**Applied fix:** `peCardOf` 增加 `if(p[0]==="p")return "p:"+p[1];`，与预设卡的 `data-key` 和 `pe.open` 的键一致。保存时和打开时（`preErr`）都会展开含错误的预设卡并把焦点放到出错的行。
**回归用例：** `plan-editor-fit.spec.ts` 新增「加一个空标签、折叠这张卡、点保存」，断言卡片展开、焦点在 `p:lang:1`、错误文案正确、服务器计划不变。已确认去掉修复后失败。

### WR-02: D-17 的数量和长度上限保存时不检查

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/strings.ts`, `tests/cloud/plan-editor-groups.spec.ts`
**Commit:** 1ce6db1
**Applied fix:** `planProblems` 增加 8 个新错误码，文案放进 `PE_ERR`（用 `PLAN_MAX` 插值，避免和上限数字脱节）：`glimit`（组 ≤ 20）、`tlimit`（每组任务 ≤ 50）、`llimit`（力量项 ≤ 8）、`taglimit`（每类标签 ≤ 20）标在第一个多出来的项上；`nlong`（组名、力量项名 ≤ 40）、`tlong`（任务文字 ≤ 200）、`ulong`（单位 ≤ 8）、`taglong`（标签 ≤ 30）。只算未归档的项，长度按 trim 之后算。保存时对组名、任务文字、力量项名、单位和预设标签 `trim()` 一次（审查给了「trim」或「在 D-17 里说明不 trim」两个选项，选了 trim，因为判空和判重复本来就按 trim 之后的值）。打开时已有的超限问题会像其他规则问题一样立即标出并展开所在卡。新文案逐字复制到 `tests/support/strings.ts`。
**范围说明：** 组备注、力量项备注、健身说明的长度没有加检查：D-17 只规定了名称和任务文字，这三处在界面上也没有错误段落可以显示提示，而且现有的容量用例就是靠一个超长备注把计划推到 4 MB 附近。
**回归用例：** `plan-editor-groups.spec.ts` 新增：加载 21 个组、第 2 组 51 项任务、一条 201 字的任务、9 字的单位、31 字的标签，断言打开时五处错误按页面顺序标出，点保存被挡住，逐个改好后能保存，并且组名首尾空格被去掉、服务器计划是 20 个组。
**状态：** fixed: requires human verification

### IN-01: 清空组备注会让没有修改的草稿被判为有修改

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/plan-editor-groups.spec.ts`
**Commit:** 952a9f5
**Applied fix:** 新增 `peCanon(d)`：比较前把组上空串的 `note` 当作没有这个键。`pe.orig` 的记录、`planDirty`、`peChanged` 三处都改用它。
**回归用例：** `plan-editor-groups.spec.ts` 新增：计划里组备注是空串，输入再删光，提示行回到「没有修改」且保存按钮仍禁用。已确认三处都改回去之后失败。
**状态：** fixed: requires human verification

### IN-02: 保存或放弃后用 `replaceState` 去掉 `#plan`，留下重复的历史记录

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/plan-editor.ts`, `tests/cloud/plan-editor.spec.ts`
**Commit:** 98184bf
**Applied fix:** 进入时 `pushState({pe:1},"","#plan")`（返回键被拒绝后重新 push 也带这个标记）。`closePlanEditor` 在 hash 仍是 `#plan` 且 `history.state.pe===1` 时调用 `history.back()`，否则（hash 是手输的、没有标记）仍用 `replaceState`。标记存在 `history.state` 里，所以刷新后在 `#plan` 上保存同样能退回。新增模块变量 `peBack`（1 秒内有效）让随后因 `back()` 触发的 `hashchange` 不被当成返回键。退出登录那一处的 `replaceState` 没动。
**行为变化：** 离开编辑页后 `#plan` 是异步去掉的（`history.back()` 本身是异步的），不再是同步的。
**改动的既有用例：** 因为上面这一点，`tests/cloud/plan-editor.spec.ts` 里 5 处在离开编辑页后立刻读 `hash` 的断言改为轮询等待 hash 为空（新增 helper `expectHashGone`，放在 `tests/support/plan-editor.ts`）：
- 第 1 个用例保存后的 `expect(ed.hash).toBe('')`；
- 第 2 个用例切换标签后的 `expect((await readEditor(page)).hash).toBe('')`；
- 第 2 个用例「放弃修改」后的 `expect([ed.open, ed.hash]).toEqual([false, ''])`（拆成 `ed.open` 加轮询）；
- S9 用例放弃修改离开后的同一条断言（第二台设备页面）；
- 读不出来的计划保存后的同一条断言。
断言的意图没有变，只是不再要求同步。
**回归用例：** `plan-editor.spec.ts` 新增：用浏览器 Navigation API 读历史序号，保存离开和放弃离开后序号都回到进入前，不再多留一条。
**状态：** fixed: requires human verification

### IN-03: `readArchived` 把没有历史的力量项的备注当成一条历史

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/goals.ts`, `tests/cloud/plan-archive-view.spec.ts`
**Commit:** cdb00d7
**Applied fix:** 采用审查给的第二种办法：应用在归档力量项的 `.hist` 元素上写 `data-hist="<历史条数>"`（显示的文字和样式不变，没有历史时仍显示备注），`readArchived` 读这个属性而不是按全角逗号数文字。
**回归用例：** `plan-archive-view.spec.ts` 新增：归档力量项没有历史、备注里有全角逗号，断言计数为 0 且备注仍显示在原位置；原有的 5 条历史用例继续通过。

## Skipped Issues

None — 所有 7 条发现都已修复。

## 验证

- 验证环境：主工作副本（没有建 worktree），在 below-normal 优先级、单 worker 下逐个运行。
- 云端用例（`npm run test:cloud`）：`plan-editor`、`plan-editor-sync`、`plan-editor-fit`、`plan-editor-groups`、`plan-editor-archive`、`plan-archive-view`、`import`、`import-sync`、`import-undo` 各 spec 都在相关修复之后跑过，报告均为 `REPORT OK`，没有失败和 flaky。最后一次改动（IN-03）之后重跑了 `plan-archive-view`、`plan-editor-archive`、`import`、`plan-editor-groups`。
- 默认套件定向：`tests/e2e/goals/plan-entry.spec.ts`、`tests/e2e/data/plan-normalize.spec.ts`（直接调用 `planProblems`，新增的校验没有破坏现有断言）、`tests/e2e/platform/app-integrity.spec.ts`（`APP_SHA256`）通过。
- 没有跑完整的云端和默认套件，留给编排方。
- 内联脚本用 `node --check` 做过语法检查（WR-02 之后）。
- 最终 `APP_SHA256` 与工作副本一致（`4947eee7…`）。

## 隐私

只用合成数据，用例文字都带 `SYNTH-` 标记；没有读写 `private/` 和任何真实备份，没有运行 `tools/plan/migrate-backup.mjs`；没有暂存 `.planning/milestones/**`、`.planning/state.json`、`.impeccable/`、`.planning/ui-reviews/`、`test-results/`；提交没有用 `--no-verify`，隐私检查钩子全部通过；没有推送。

---

_Fixed: 2026-11-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
