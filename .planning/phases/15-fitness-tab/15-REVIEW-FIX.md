---
phase: 15-fitness-tab
fixed_at: 2026-11-16T00:00:00Z
review_path: .planning/phases/15-fitness-tab/15-REVIEW.md
iteration: 1
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 15: 代码评审修复报告

**修复时间：** 2026-11-16
**评审报告：** `.planning/phases/15-fitness-tab/15-REVIEW.md`
**迭代：** 1
**范围：** fix_scope = all（4 条警告 WR-01..WR-04，8 条提示 IN-01..IN-08；没有阻断级）

**摘要：**
- 范围内的发现：12
- 已修：12
- 跳过：0

**工作方式：** `workflow.use_worktrees` 为 false，直接在主工作区改、提交（没有临时 worktree，没有恢复标记文件）。每条发现一个提交（`fix(15): <id> …`），改了 `us-journey-tracker.html` 的提交都同时重新记录了 `APP_SHA256`（应用文件是 LF，无 CR，`style="` 计数 0，纯函数段的两个标记各一次）。所有验证都在主工作区跑，可以从当前树复现；每次只跑相关的几个文件，通过低优先级、单 worker 的包装，每次运行后用 `check-report.mjs` 检查了报告。完整套件没有跑，留给调用方。

## Fixed Issues

### WR-01: 15-07 的 slot 替换只修了更新分支，创建分支留着同一个丢操作的缺口

**状态：** 已修（需要人确认逻辑：同步竞态，见下面的负向验证）
**提交：** `35a06a6`
**改动文件：** `us-journey-tracker.html`、`tests/cloud/fitness-sync.spec.ts`、`tests/support/constants.ts`
**做法：** 提出一个小函数 `swapSlot(held,body,u)`（放在 `docAfter` 旁边，不在纯函数段）：槽还是上传所基于的那个对象时，把它换成刚上传的内容并返回 true。更新分支改用它，创建分支（服务器上没有 state 文档）在 `await make(...)` 之前取 `held`，创建成功（`m.made`）后同样调用。创建分支被唯一索引拦下、改用服务器已有文档时（`made:false`）不换，和原来一致。
**新用例：** `tests/cloud/fitness-sync.spec.ts`，`FIT-05 a state document created after a failed upload that held the waiting slot keeps the local trainings in the working view (WR-01)`。设备 B 先上传 03-17；设备 A 带 503 保存 03-16（本趟把 B 的版本放进槽、更新失败）；后台删掉 state 文档，A 重试走创建分支；之后 A 再记一天，服务器上三天都在。
**运行：** 新用例通过（1 条）；把应用临时换回修复前的版本再跑，这条用例失败（服务器上缺 03-16，正是评审推演的症状），之后恢复修复。邻近的同步用例 `remote-update.spec.ts` + `offline-sync.spec.ts` 26 条全部通过。

### WR-02: 距离和重量在校验之后才四舍五入，保存的值可能变成 0

**状态：** 已修
**提交：** `bf0b71f`
**改动文件：** `us-journey-tracker.html`、`tests/e2e/fitness/workouts-data.spec.ts`、`tests/support/constants.ts`
**做法：** `workoutProblems` 里距离改成按舍入后的值判断（`woR2(v)<=0` 报原来的 `drange`）；重量里「不是精确的 0、舍入后是 0」报原来的 `wrange`（精确的 0 仍是徒手）。上限仍按原始输入判断，所以 1000.004 之类的行为和以前一样（被拒）。没有改任何文案。
**用例：** 在 `workouts-data.spec.ts` 的边界用例里加了 0.004 → 报错、0.005 → 合格（舍入成 0.01）各两条（重量和距离）。
**运行：** `workouts-data.spec.ts` 6 条通过。
**注意：** 重量舍入成 0 时显示的是现有文案「重量要在 0 到 1000 之间」，按规则没有改文案。

### WR-03: 「全部」范围的有氧周柱图按最早日期逐周生成，日期很早的导入数据会拖垮页面

**状态：** 已修
**提交：** `887eef6`
**改动文件：** `us-journey-tracker.html`、`tests/e2e/fitness/charts-data.spec.ts`、`tests/support/constants.ts`
**选定的上限：** 在 `cardioWeeks` 里把「全部」的起点钳到**最多 520 周**（本周一往前 519 周，共 520 个槽位）；更早的有氧天不生成槽位，也不计入（它们本来就落在槽位之外）。`normalize`、`importProblem` 接受的内容没有变。
**用例：** `charts-data.spec.ts` 里加了一份带 `1000-01-01` 有氧天的数据：槽位数恰好 520，第一个槽位是 2016-04-04，那一天不计入，本周照常。
**运行：** `charts-data.spec.ts` + `charts.spec.ts` 共 10 条通过。
**与评审的出入：** 评审举的 `0100-01-01` 实际过不了 `realDate`（四位年份检查），不会进入数据；能进入的最早年份是 1000，已经足以生成约 5 万个槽位，用例用的就是 1000-01-01。评审同时建议让 `fcCd()` 只算一次，没有做：钳制之后每次最多 520 个槽位，开销有界，不值得为它改渲染函数的签名。

### WR-04: 门控期间从本周页跳到别的日子，记录区会被重画成可编辑的控件

**状态：** 已修
**提交：** `de477af`
**改动文件：** `us-journey-tracker.html`、`tests/cloud/fitness-log.spec.ts`、`tests/support/constants.ts`
**做法：** `renderFl`（含「计划里什么都没有」的提前返回）、`renderFh`、`renderFc` 的末尾都调用 `applyGate()`；没有门控时 `applyGate` 第一行就返回，所以对平时没有影响。
**新用例：** `tests/cloud/fitness-log.spec.ts`，`FIT-02 clicking the training row of another day on the week view while the edit gate is on opens that day with the logging controls still disabled (WR-04)`：对账被拖住时点本周页另一天的训练行，断言日期框、保存按钮、所有 `[data-fl]` 输入框和加项芯片都是真 disabled，松开后恢复可用。
**运行：** 新用例通过；换回修复前的应用后这条用例失败（日期框是 enabled），之后恢复。`fitness-log.spec.ts` 共 5 条通过；`tests/e2e/fitness/log.spec.ts` 7 条通过（本地版没有门控，确认没有副作用）。

### IN-01: `renderFh` 用原始 `dataset.fh` 拼选择器（审计提到的问题：确认存在，不可触发）

**状态：** 已修
**提交：** `0df6492`
**改动文件：** `us-journey-tracker.html`、`tests/support/constants.ts`
**做法：** `renderFh` 里恢复焦点的选择器和 `fhDelete` 里的 `sum` 都改成 `CSS.escape(...)`，和 `fcFocusKey` 一致。没有新增用例（评审确认现在不可触发，行为不变），用现有历史用例回归。
**运行：** `tests/e2e/fitness/history.spec.ts` 2 条通过。

### IN-02: 同一动作块的错误段落和某一组的错误段落可能 id 相同

**状态：** 已修
**提交：** `211c6f6`
**改动文件：** `us-journey-tracker.html`、`tests/e2e/fitness/log.spec.ts`、`tests/support/constants.ts`
**做法：** 动作块级错误段落的 id 改成 `fl-ex-e-<id>`（模板和 `flErrs` 里的 `$()` 同步）；每组的 `fl-e-<id>-<j>` 不变，所以 `tests/support/fitness.ts` 的 `flError` 不用动，也没有别处引用块级 id。
**用例：** `log.spec.ts` 加了一条：一个动作一组都没填时点保存，`#fl-ex-e-squat` 可见且文字是「这个动作还没有记录任何一组…」，旧 id `#fl-e-squat` 不存在。
**运行：** `tests/e2e/fitness/log.spec.ts` 8 条通过。

### IN-03: `normalize` 先登记 id 再校验内容，同 id 的第二条合格记录会被连带丢掉

**状态：** 已修
**提交：** `160f038`
**改动文件：** `us-journey-tracker.html`、`tests/e2e/fitness/workouts-data.spec.ts`、`tests/support/constants.ts`
**做法：** 力量动作在「有合格的组、真正 push 之前」才 `ls0.add`，有氧项在「时长合格之后」才 `cs0.add`；规则变成「只留第一条合格的，不合格的不占这个 id」，注释同步。
**用例：** `workouts-data.spec.ts` 加了一条：同一天里第一条不合格、第二条同 id 合格时，保留第二条。
**运行：** `workouts-data.spec.ts` + `plan-normalize.spec.ts` 共 16 条通过。

### IN-04: `fcGo` 里的局部常量 `me` 遮住了全局的用户 id `me`

**状态：** 已修
**提交：** `bb26b51`
**改动文件：** `us-journey-tracker.html`、`tests/support/constants.ts`
**做法：** 局部常量改名为 `btn`，只是改名，行为不变，没有新增用例。
**运行：** `tests/e2e/fitness/charts.spec.ts` 7 条通过。

### IN-05: 训练历史里重画后，焦点在展开内容里的按钮上会丢失

**状态：** 已修
**提交：** `415f071`
**改动文件：** `us-journey-tracker.html`、`tests/cloud/fitness-sync.spec.ts`、`tests/support/constants.ts`
**做法：** `renderFh` 的焦点保存除了 `#fhMore` 和 `summary`，再认「修改这次训练」（`[data-wo]`）和「删除这次训练」（`[data-fhdel]`）两个按钮，重画后用 `.fh-item[data-fh="…"] [data-wo]` / `[data-fhdel]`（日期用 `CSS.escape`）放回。
**新用例：** `fitness-sync.spec.ts`，`FIT-05 a remote redraw of the training history keeps the focus on the edit and delete buttons of an opened training (IN-05)`：设备 B 的焦点分别放在展开项的两个按钮上，设备 A 保存新的一天，B 的历史不刷新地重画后焦点仍在原按钮上。
**运行：** 新用例通过；换回修复前的应用后失败（焦点落到 body），之后恢复。

### IN-06: `log.spec.ts` 用真实的 700 ms 等待和一条几乎不会失败的断言来确认「没有保存」

**状态：** 已修（只改测试）
**提交：** `f8eb9cc`
**改动文件：** `tests/e2e/fitness/log.spec.ts`
**做法：** 把「半填一组、点保存不保存」那一段从合并用例里拆出来，放进 `clockMode: 'manual'` 的 describe：用 `page.clock.runFor(1_000)` 推过防抖窗口，断言 `savedWorkouts(app.saved())` 严格等于 `{}`（去掉了 `null` 分支）；再改正并保存，推过防抖后断言训练真的写进去了（证明窗口确实推进了防抖）。原用例里的 `waitForTimeout(700)` 和弱断言删除，其余步骤不变。
**与评审建议的出入：** 评审建议严格等于种子里的 `workouts`；种子只是读进来的，并不算一次保存，所以 `app.saved()` 里没有任何训练，严格断言写成了 `{}`（任何写入都会让它失败）。
**运行：** `tests/e2e/fitness/log.spec.ts` 9 条通过。

### IN-07: 导入摘要的「计划」一行不统计有氧项

**状态：** 已修（有一段新文案，见下）
**提交：** `f675006`
**改动文件：** `us-journey-tracker.html`、`tests/support/strings.ts`、`tests/support/constants.ts`、`tests/cloud/fitness-sync.spec.ts`、`tests/e2e/data/backup-format.spec.ts`、`tools/plan/migrate-backup.mjs`
**做法：** `planCounts` 多返回 `cardio:planCardio(p).length`；`T_IMP_PLAN` 多一个参数，有氧项大于 0 时在行尾加「，有氧项 n 个」，为 0 时一字不变（所以没有有氧项的现有用例和文案不受影响）；`strings.ts` 的 `importPlanLine` 同步（第四个参数缺省 0）。
**连带改动：** `backup-format.spec.ts` 里三处 `planCounts` 的相等断言加了 `cardio: 0`；`tools/plan/migrate-backup.mjs` 的自检（第 441 行）也比较 `planCounts` 的 JSON，同样加了 `cardio: 0`（不改它的话 IO-09 的自检会失败，我跑 `migration.spec.ts` 时发现并修了）。
**用例：** `fitness-sync.spec.ts` 加了一条：带两个有氧项的只含计划文件，确认框里计划一行是「…力量项 1 个，有氧项 2 个」；没有有氧项的文件不带这一段。`backup-format.spec.ts` 加了 `planCounts` 的有氧计数断言。
**运行：** 新用例通过；`backup-format.spec.ts` 7 条、`import.spec.ts` + `migration.spec.ts`（修自检之后重跑 `migration.spec.ts` 2 条）通过。
**新文案（请所有者在 Phase 16 总验收时过目）：** 导入确认框「计划：…」一行，计划里有有氧项时行尾多一段「，有氧项 n 个」。例：「计划：目标组 2 个，任务 4 项，力量项 1 个，有氧项 2 个」。没有有氧项时这一行不变。

### IN-08: 草稿里的动作被远端计划更新删掉后，仍可保存成孤儿记录

**状态：** 已修（保存规则的一个细节由我选定，见下；需要人确认逻辑）
**提交：** `06e43aa`
**改动文件：** `us-journey-tracker.html`、`tests/cloud/fitness-log.spec.ts`、`tests/support/constants.ts`
**做法：** 新函数 `flLive(draft, date)`：保存时（校验通过之后、`woFromDraft` 之前）去掉计划里已经没有的力量项和有氧项；归档的项仍在 `plan.lifts` / `planCardio(plan)` 里，所以保留。如果去掉之后这一天什么都没剩且这天原来没存过，不再静默无反应：重新载入这一天（草稿清空），已存过的天仍走原来的删除。
**我选的规则（记录）：** 「这一天已经存着的条目」即使计划里没有也原样保留，只拦住**新写出**指向不存在项目的记录。原因：直接删掉所有不在计划里的条目，会在用户改某一天的任意内容时，把这一天里早先已保存的老记录（项目后来被删了）一起抹掉，这是数据丢失，比评审要防的问题更糟。留底恢复（`flRestore`）不动，恢复出来的草稿里仍显示「已删除的力量项」，保存时由 `flLive` 拦住。校验仍在整份草稿上做（报错的下标和页面一致）。
**新用例：** `fitness-log.spec.ts`，`FIT-02 saving a draft whose lift another device removed from the plan leaves that lift out and keeps the rest (IN-08)`：草稿里有两个力量项，服务器上的计划永久删掉第二个，重开后留底恢复出两项，保存后服务器上只有第一项。
**运行：** 新用例通过；换回修复前的应用后失败（服务器上带着孤儿项）；`fitness-log.spec.ts` + `plan-editor-archive.spec.ts` 共 10 条通过，`tests/e2e/fitness/log.spec.ts` 9 条通过。

## Skipped Issues

无。12 条都已修。

## 需要所有者在 Phase 16 总验收时过目的新文案

- IN-07：导入确认框计划一行，有氧项大于 0 时行尾多「，有氧项 n 个」（`T_IMP_PLAN`，镜像在 `tests/support/strings.ts` 的 `importPlanLine`）。其余修复没有新增或改动任何用户可见文案。

## 留给调用方的事

- 两个完整套件（`npm test`、`npm run test:cloud`）没有跑，只跑了上面各条列出的相关文件。
- 本次改的应用行为里，有两处最好在完整套件之外再看一眼：WR-01（同步里的 slot 竞态）和 IN-08（保存时去掉计划里没有的项，已存过的条目保留）。

---

_修复时间：2026-11-16_
_修复者：Claude (gsd-code-fixer)_
_迭代：1_
