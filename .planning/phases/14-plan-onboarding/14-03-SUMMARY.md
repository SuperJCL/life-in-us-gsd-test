---
phase: 14-plan-onboarding
plan: 03
subsystem: plan-onboarding
tags: [sample-picker, plan-editor, same-name-mark, room-limit, keyboard, narrow-layout, playwright-cloud]

requires:
  - phase: 14-plan-onboarding
    provides: planCommit / planSavedToast、dialog#sample 卡片模式、pkRender/pkPicked/pkHint/pkBusy/pkSave/pkWhy、tests/support/plan-picker.ts
  - phase: 12-plan-editor
    provides: renderPlanEditor、peUsedIds、peBar、peSay、放弃草稿的确认、PLAN_MAX
provides:
  - 编辑计划页的「从示例添加」（#peSampleBtn，.pe-tools 一行），断网、登录过期、计划不空都可用，勾选的项只加进草稿
  - 挑选列表的「计划里已有同名组/力量项」标记（仍可勾选，副本换新 id）和按剩余名额禁用多余的行（pkRoom、#pk-lim-g、#pk-lim-l）
  - 挑选对话框的键盘、关闭路径、375 px 底部面板、第二台设备的用例；tests/README.md 的 Phase 14 一节
affects: [Phase 16 总体验收]

actuals:
  tokens: 13500
  tasks: 3
  commits: 3

plan_head_before: c047276b08789a8c3a77c0bf75cc71f40e4faaff
plan_head_after: 0998195aa97000d621ff509b12d38fa33ea6c4e2

tech-stack:
  added: []
  patterns:
    - "编辑页模式只改 pe.draft：pkAddToDraft 用 pickSample(keys,peUsedIds()) 追加到草稿末尾，不调用 planCommit 或 savePlanDraft，函数体由 verify 的脚本检查"
    - "同名和名额的对比计划按模式取：卡片模式取打开时的 pk.base，编辑页模式取实时的 pe.draft，只看未归档的项；用户的名称只进 Set 做比较，列表只显示示例自己的文字"
    - "名额用真 disabled 加 aria-describedby 追加说明行 id；每次勾选变化先 pkRoom() 再 pkHint()"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/support/plan-picker.ts
    - tests/cloud/plan-onboarding.spec.ts
    - tests/README.md

key-decisions:
  - "卡片模式不加 UI-SPEC S3 第 3 步的名额兜底：np 以打开时的 pk.base 为底，挑选界面的名额也按同一份 pk.base 算，界面限制已经是全部；planCommit 的字节容量检查照旧生效；编辑页模式另有保存时 planProblems 的上限检查"
  - "窄屏底部两个按钮的内边距在窄屏块里统一成左右 12px，保证 flex:1 下宽度相等（用例发现 6 px 差）"

requirements-completed: [PLAN-07, PLAN-06]

coverage:
  - id: D1
    description: "编辑页「从示例添加」：入口行常驻，挑选的项按示例顺序追加到草稿末尾、折叠、焦点移到第一个新卡片的折叠开关、toast 和读屏播报；保存前不写计划文档，点「保存计划」后服务器有新 id 的项"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 sample items added in the plan editor go to the end of the draft collapsed and are saved only with the plan (D-04, D-07, D-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "同名标记只看未归档项（归档的同名组不算，带空格的力量项名算，本次加进草稿的也算），仍可勾选，副本有新 id；名额按未归档个数算，用完后其余行 disabled 并说明原因"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 the picker marks sample groups and lifts whose names are already in the draft and still adds them with new ids (A5, D-08)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 the picker stops at the group and lift limits and says how many more fit, archived items not counting (A7, 12 D-17)"
        status: pass
    human_judgment: false
  - id: D3
    description: "编辑页模式断网照样能挑能加、按示例顺序追加、放弃草稿时一起撤回且整条用例没有计划写入"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 sample items added in the plan editor work offline, follow the sample order and are dropped with the discarded draft (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "键盘与关闭：焦点在第一个复选框，空格勾选，Enter 不提交，Esc、点遮罩、「先不添加」都关闭且焦点回到打开它的按钮，每次打开全不勾；375 px 下贴底面板、列表可滚动、按钮不低于 44 px；第二台设备看到同一份计划"
    requirement: "PLAN-07"
    verification:
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 the picker opens with focus on the first checkbox, closes with Esc, the backdrop or the cancel button without changes and returns focus, and opens unchecked again (D-06, S2)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 at 375 px the picker is a bottom sheet whose list scrolls under a fixed header and footer, and the empty plan card and editor entry buttons span the width (S1, S2, S4)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-onboarding.spec.ts#PLAN-07 a plan picked from the empty plan card on one device shows on another device of the same account (SC4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "完整 cloud 套件 266 条和完整默认套件 199 条 REPORT OK，0 失败、0 flaky"
    requirement: "PLAN-06"
    verification:
      - kind: e2e
        ref: "test-results/14-03-t3c.json（cloud，266 条）和 test-results/14-03-t3v.json（默认，199 条）经 tools/test-report/check-report.mjs 核对"
        status: pass
    human_judgment: false
  - id: D6
    description: "375 px 底部面板外观（最后一行不被底部按钮盖住、iOS 安全区）、浅色和深色下选中态与焦点环、手机宽度下长 toast 的显示，以及本阶段全部新文案的观感"
    verification: []
    human_judgment: true
    rationale: "UI-SPEC 的三条 backstop；所有者决定本阶段不做人工验收，自动用例只证明窄屏尺寸和可达性，视觉部分交给 Phase 16 总体验收"

duration: 约 33 min（开始 2026-11-13T06:14Z，结束 06:47Z，含两个完整套件约 17 min）
completed: 2026-11-13
status: complete
---

# Phase 14 Plan 03: 编辑页「从示例添加」、同名与名额、键盘与窄屏、收尾 Summary

**编辑计划页多了随时可用的「从示例添加」：勾选的组和力量项换新 id、按示例顺序追加到草稿末尾（折叠、焦点到第一个新卡片），点「保存计划」才写入、放弃草稿就整体撤回；挑选列表给计划里已有同名的项打标记、按剩余名额禁用多余的行；完整 cloud 套件 266 条和默认套件 199 条全绿。**

## Performance

- **Duration:** 约 33 min（含两个完整套件）
- **Tasks:** 3/3
- **Commits:** 3（用 `plan_head_before..HEAD` 实测）
- **Files:** 应用 1 个、测试和支撑文件 5 个（含 tests/README.md）

## Accomplishments

- **Task 1（tracer）：** `renderPlanEditor` 在 `#pe-main` 开头、目标组分区之前加 `.pe-tools` 一行（`#peSampleBtn` 加说明），peRoot 点击委托开头按 id 处理它（不走 `data-peact`、不受 `peBlock` 影响）。`openSamplePicker("edit")` 不检查 peBlock、不并入远端版本；标题、说明、确认按钮按模式取（`pkOkText()`）。新增 `pkAddToDraft()`：`pickSample(keys,peUsedIds())`，组和力量项依次 push 进 `pe.draft`，`renderPlanEditor();peBar();peSay(...)`，焦点记到第一个新卡片的折叠开关，`pkDlg.close()`，toast 4000 ms；关闭处理在 `pk.scroll` 为真时 `scrollIntoView({block:"center",behavior:"auto"})`。函数体里没有 `planCommit(` 和 `savePlanDraft(`（verify 的脚本检查，T-14-11）。
- **Task 2：** `pkRender` 按模式取对比计划（卡片模式 `pk.base`，编辑页模式 `pe.draft`），只看未归档的项，名称去首尾空格、区分大小写，同名的行在 `.pk-meta` 末尾加 `.pk-dup` 标记并给复选框加 `data-dup`，不禁用。`pk.room` 按 `PLAN_MAX` 减未归档个数；两个图例下渲染 `#pk-lim-g`、`#pk-lim-l`（名额少于示例个数时显示，0 写「已满」）。新增 `pkRoom()`：已勾数达到名额时该分区其余未勾的行真 disabled、aria-describedby 末尾加上说明行 id，取消后恢复；打开和每次 change 都先 `pkRoom()` 再 `pkHint()`。
- **Task 3：** 三条新用例（键盘与关闭路径、375 px 底部面板、第二台设备）；`tests/README.md` 加 `plan-picker.ts`、`plan-onboarding.spec.ts` 和「Phase 14 的云端用例」一节（含 D-01 之后要示例计划的账号必须显式给 `plan: SEED_PLAN` 的规则）；D-09 只读核对（ROADMAP Phase 14 成功标准 3 和 REQUIREMENTS 的 PLAN-07 已含「从空计划卡片挑」的直接保存措辞，未改）。

## Task Commits

1. **Task 1（tracer）** — `5874667` feat(14-03): add from sample in the plan editor puts picked items at the end of the draft
2. **Task 2** — `b7f8723` feat(14-03): same-name marks and remaining-room limits in the sample picker
3. **Task 3** — `0998195` test(14-03): keyboard, 375 px bottom sheet and second device cases for the sample picker, README and equal-width footer buttons

tracer 反馈门（`⚡ Tracer verified end-to-end — expanding`）：编辑页模式用例、plan-onboarding、plan-editor、plan-editor-groups 共 30 条 REPORT OK，SAFE-02 和 SEC-01 通过后才进入 Task 2。

## 测试结果

| 运行 | 范围 | 结果 |
|------|------|------|
| `playwright test --list`（cloud） | 全部 cloud 用例 | **266 条**（248 + 本阶段 18 条，与计划一致） |
| Task 1 cloud | plan-onboarding、plan-editor、plan-editor-groups | 30 条，REPORT OK |
| Task 1 默认 | app-integrity、escaping | 12 条，REPORT OK |
| Task 2 cloud（最终） | plan-onboarding、plan-editor-archive | 19 条，REPORT OK |
| Task 2 默认 | app-integrity、escaping | 12 条，REPORT OK |
| **完整 cloud 套件** | 全部 | **266 条通过，0 失败，0 flaky**（11.2 min，check-report `--min-expected 266` REPORT OK） |
| **完整默认套件** | 全部 | **199 条通过，0 失败，0 flaky**（5.9 min，check-report `--min-expected 199` REPORT OK，含 v1 回归、本地版示例计划 GOAL-01/SEC-04、emptyPlan 和 pickSample 两条单元用例） |

两个完整套件各跑一次，先 cloud 后默认，没有并发。运行都经低优先级、`--workers=1` 的包装。运行结束后没有遗留的 playwright 进程（机器上剩下的 msedge.exe 是所有者自己的 Edge 默认配置进程，没有动）。

## Task 3 是否补过应用

补过一处，改动写进了 Task 3 的提交：375 px 用例发现挑选对话框底部两个按钮宽度差 6 px（`.ghost` 和 `.primary` 的左右内边距不同，`flex:1` 下总宽度不等）。在窄屏块里加了 `dialog#sample .pk-foot button{padding-left:12px;padding-right:12px}` 让两个按钮等宽，重新记录了 `APP_SHA256`，`style="` 仍为 0。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 窄屏底部两个按钮宽度不等**
- **Found during:** Task 3（375 px 用例，两次都失败在 `cancel.width - ok.width <= 2`，实测 6）
- **Issue:** UI-SPEC 要求窄屏两个按钮各占一半宽，实现里 `flex:1` 加不同的内边距，宽度差 6 px。
- **Fix:** 窄屏块里统一左右内边距 12px。
- **Files modified:** us-journey-tracker.html、tests/support/constants.ts
- **Commit:** 0998195

### 计划与实际的小差别（非缺陷）

**2. 名额用例的操作顺序：** 计划写「勾回 g:P2 并添加 → 再打开 → limL 为 pkLimL(1)」，但前面已经勾了 `l:bench`，一起添加后力量项会满（8 个），limL 就会是「已满」而不是 `pkLimL(1)`。用例里在添加之前先取消 `l:bench`，使「再打开后 limL 为 pkLimL(1)、焦点在第一个能勾的力量项」成立；之后另加一步把力量项也加满，断言两个分区都是「已满」、11 个复选框全部 disabled，覆盖了计划原意。

**3. 第一次定向运行里 Task 1 用例的一处断言写错：** 先写了 `key.slice(0,7)` 与 `'g:g-'` 的比较，是用例自己的写法错误（应用没问题），改成只断言长度为 3 和前两个键后通过；没有改应用。

**4. 名额说明行的写法：** 为了让 `id="pk-lim-g"`、`id="pk-lim-l"` 两个字面量都出现在应用源码里（验收脚本按字面量检查），说明行在模板里分别写出，而不是用一个按 id 参数化的小函数。

**Total deviations:** 1 个自动修复的应用缺陷（窄屏按钮等宽），3 条实现和用例写法的说明，0 条架构变更。**Impact:** 无范围蔓延。

## 规模和取舍的说明（计划要求记录的三项）

**(a) 估算超出建议线：** 计划估算 115k 超过 100k 的建议线。保留为一个计划的理由：Task 1 的编辑页入口、Task 2 的同名和名额、Task 3 的键盘和窄屏用例以及两个完整套件共用同一批 helper 和同一个收尾验证，拆开会让「完整套件全绿」这条成功标准没有归属；其中两个完整套件的运行输出占了不少，实现部分比 14-01 小。实际 diff 按 chars/4 约 13.5k tokens，估算偏高（和 14-01、14-02 一样）。

**(b) 与 UI-SPEC S3 第 3 步的有意偏差：** 没有为卡片模式另加名额兜底。卡片模式的 `np` 以打开对话框时看到的 `pk.base` 为底追加，挑选界面的名额也按同一份 `pk.base` 算，所以界面上的限制就是全部；`planCommit` 的字节容量检查（T-14-12 之外的 12 D-17 容量）照旧生效；编辑页模式另有保存时 `planProblems` 的数量上限检查。

**(c) 交给 Phase 16 总体验收的清单：** 见下一节，全部作为 backstop 记录，没有一项被静默算作通过。

## 交给 Phase 16 总体验收的 backstop 和新文案（所有者决定本阶段不做人工验收）

**UI-SPEC 的三条 backstop（`verification: backstop`，没有自动用例判断视觉部分）：**

1. 375 px 下的底部面板：11 行加两个图例时列表可滚动、最后一行不被底部按钮盖住、底部按钮在 iOS 安全区之上（`env(safe-area-inset-bottom)` 在桌面 Chromium 里是 0，只能在真机看）。自动用例只证明了尺寸（贴底、列表可滚动、按钮不低于 44 px、等宽、最后一行在按钮之上）。
2. 浅色和深色主题下选中行的 `--s` 底加 `--ink` 文字、复选框对勾、焦点环是否清楚，类别色没有被当文字底。
3. 手机宽度下长 toast（「已加到草稿：3 个目标组、2 个力量项，点「保存计划」后生效」「已加入 …，计划已保存」）是否完整显示、能换行。

**另请在 Phase 16 一并看：** 深色主题下整体清晰度，以及 14-01、14-02、14-03 的全部新文案：

- 空计划卡片：「自己建一份」「从示例里挑」和正文；两句不可用原因「联网后才能从示例里挑」「登录已过期，重新登录后才能从示例里挑」。
- 挑选对话框：两种标题（「从示例里挑」「从示例添加」）和说明、两个确认按钮（「添加并保存」「添加所选项」）、「先不添加」、分区图例和行说明、提示行（「先勾选要加入的项」「已选 …」）。
- 同名和名额提示（本计划新增）：「计划里已有同名组」「计划里已有同名力量项」「目标组最多 20 个，还能再加 {k} 个」「目标组已满（20 个），先删掉一个再添加」「力量项最多 8 个，还能再加 {k} 个」「力量项已满（8 个），先删掉一个再添加」。
- 冲突框四行和三个按钮（「回去继续挑」「放弃我的选择，用新版」「用我的覆盖」）。
- 四句 toast：「已加入 … 计划已保存」「已改用别的设备上的新计划，你挑的项没有加」「已加到草稿：…，点「保存计划」后生效」，以及两句不可用原因 toast。
- 编辑页入口说明「需要的目标组和力量项，可以随时从示例里挑。」和读屏播报「已添加到草稿：…」；本周页空计划提示。

## Known Stubs

无。14-01、14-02 留下的三处占位（`#planSampleWhy`、`pkHint` 档位、`pkRender` 里同名和名额的位置）都已落实。

## Threat Flags

无新的对外面：只新增本机界面状态（对话框、草稿追加）和对示例常量的读取，没有新的网络端点、认证路径或文件访问。T-14-11（只改 pe.draft，函数体检查加用例检查写入条数不变）、T-14-12（pkRoom 按未归档项算名额）、T-14-13（同名项只标记、副本有新 id，用例检查两个同名组 id 不同）、T-14-14（名称只进 Set 做比较、列表文字全经 `esc()`，SEC-01 门槛在每个任务的 verify 里运行）的缓解都由上面的用例和门槛证明。

## 流程说明

- **TDD 与提交粒度：** 三个任务标了 `tdd="true"`，但计划是 `type: execute`，且每个任务的 verify 把应用和测试放进同一个提交，所以每个任务一次提交，没有拆成 test → feat 两次，也没有单独的 RED 运行（为了少占本机资源）。除上面两处用例写法问题和一处窄屏缺陷外，新用例都是实现后第一次运行就通过。
- **APP_SHA256：** Task 1、Task 2、Task 3 各重新记录一次（沿用工作副本字节的 sha256 约定）。
- **需求：** PLAN-06、PLAN-07 在本计划结束时标记完成（14-01、14-02 都没标，14-03 是最后一个声明它们的计划）。

## Self-Check: PASSED

- 修改的文件都在：`us-journey-tracker.html`、`tests/support/strings.ts`、`tests/support/constants.ts`、`tests/support/plan-picker.ts`、`tests/cloud/plan-onboarding.spec.ts`、`tests/README.md`。
- 三个提交都在 HEAD 的祖先里：`5874667`、`b7f8723`、`0998195`。
- 三个任务的验收脚本（函数和文案存在、`pkAddToDraft` 函数体检查、五个纯函数段标记各一次、`style="` 为 0、`APP_SHA256` 与文件一致、REPORT OK）、两个完整套件的 `--min-expected` 核对和三次暂存后的隐私检查（「隐私检查通过」）都已通过。
