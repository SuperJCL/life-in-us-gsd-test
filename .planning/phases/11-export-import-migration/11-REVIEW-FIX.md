---
phase: 11-export-import-migration
fixed_at: 2026-11-11T00:00:00Z
review_path: .planning/phases/11-export-import-migration/11-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 11: 代码审查修复报告

**Fixed at:** 2026-11-11
**Source review:** .planning/phases/11-export-import-migration/11-REVIEW.md
**Iteration:** 1

**Summary:**
- 范围内的发现：9 项（1 项 critical，3 项 warning，5 项 info，`fix_scope: all`）
- 已修复：9 项（CR-01、WR-01、WR-02、WR-03、IN-01、IN-02、IN-03、IN-04、IN-05）
- 已跳过：0 项

每个改动 `us-journey-tracker.html` 的提交都在同一个提交里重新记录了 `tests/support/constants.ts` 的 `APP_SHA256`；改动前后文件都是 LF，五个锚点（`const CATS=`、`/* ---------- saving ---------- */`、`function normalize(s){`、`const esc=s=>String(s).replace(`、`function normalizePlan(`）各只出现一次。没有碰锁定的决定（D-01 到 D-10、备份格式选项 A、CSV 无 BOM），也没有碰 UI 审查那四项（导入标签焦点、导出按钮的编辑闸门、旧路径 toast 宽度、CSV 提示）。一个需要说明的重叠见 IN-04。

## 验证

- **验证环境：** 全部在主检出里运行（`workflow.use_worktrees` 为 false，没有建 worktree，没有临时分支和恢复标记），数字可以直接在当前工作树复现。
- **每个行为修复的新用例**（CR-01、WR-02、WR-03）都在修复前的应用（`git stash push us-journey-tracker.html` 临时还原，没有提交）上单独运行过，确认会失败，然后还原修复版再通过。WR-02 的第一版用例在修复前也通过了（写失败的缓存会被后续同步丢弃，构造不对），已改成现在这种“只失败一次、时钟暂停、撤销前不同步”的写法再验证。
- 测试一律以 BELOW_NORMAL 优先级、`--workers=1`、一次一轮运行。**没有跑完整套件**，按约定留给编排者：默认套件和云端套件各一次全量。
- 跑过的定向用例：`tests/e2e/io/import.spec.ts`、`tests/e2e/io/export.spec.ts`、`tests/e2e/data/backup-format.spec.ts`、`tests/e2e/security/state-validation.spec.ts`、`tests/e2e/goals/`、`tests/e2e/platform/app-integrity.spec.ts`，云端的 `tests/cloud/import.spec.ts`、`import-undo.spec.ts`、`import-sync.spec.ts`、`export.spec.ts`、`migration.spec.ts`（以及 `offline-sync`、`remote-update`，因为 WR-03 动了同步收尾），迁移脚本 `--self-test`（现在 59 项，通过）。迁移脚本只运行过 `--self-test` 和经 `migration.spec.ts` 的 `--demo test-results/…`，没有运行默认模式和 `--plan-only`，没有打开 `private/`。
- 提交前的隐私检查每次都通过，没有绕过。

## Fixed Issues

### CR-01: 备份里 `done: true` 但没有 `doneDate` 的任务能通过导入校验，之后目标页渲染抛错，账号打不开

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/strings.ts`, `tests/cloud/import.spec.ts`, `tests/e2e/io/import.spec.ts`, `tests/e2e/security/state-validation.spec.ts`
**Commit:** d844f6e
**Status:** fixed: requires human verification（数据修正与渲染分支的逻辑）
**Applied fix:** 两处都补了。`normalize` 在 `done === true` 且 `doneDate` 缺失时补成空串；`renderGoals` 对已完成任务写 `s.doneDate ? "完成于 M月D日" : "已完成"`（评审建议的 `完成于 日期未记录` 读起来别扭，改成只写“已完成”，字符串在 `tests/support/strings.ts` 里镜像为 `GOAL_DONE_NO_DATE`）。新用例：云端路径（导入、目标页渲染、服务器拿到 `{done:true, doneDate:""}`、刷新后账号照常打开）和旧路径（账户模式：导入、渲染、刷新）各一条，`state-validation.spec.ts` 加了 normalize 的单元断言。该 spec 里原有一条 PLAN-05 用例的备份写了 `'P1-1': { done: true }` 并断言 normalize 原样保留，那条数据恰好是本条评审指出的不合格形状，所以给它补了 `doneDate`，保留“带前缀 id 原样保留”的本意。

### WR-01: 导入只含计划的文件或完整备份后，对不上新计划的自定义待办在目标页消失，摘要和迁移脚本都不提示

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/strings.ts`, `tests/cloud/import.spec.ts`, `tests/e2e/data/backup-format.spec.ts`, `tools/plan/migrate-backup.mjs`
**Commit:** 9e8db33
**Status:** fixed（按评审的最小做法：提示，不改丢弃的内容）
**Applied fix:** `importPreview` 多返回 `orphanCustom`（结果里目标组不在所用计划里的自定义待办条数；完整备份和只含计划的文件按文件的计划算，旧备份按当前计划算）。三种文件的确认摘要在对应的任务进度提示行之后各多一条醒目行 `T_IMP_ORPHAN_CUSTOM`：`N 条自定义待办的目标组不在计划里，导入后在目标页看不到。`（三种文件共用一句，语气沿用 09-UI-SPEC，在 `strings.ts` 里镜像为 `importOrphanCustomLine`）。待办本身不丢，仍留在记录里。迁移脚本的计数多一项 `orphanCustom`，`reportLines` 多打一行 `目标组不在计划里的自定义待办 N 条（保留在记录里，导入后目标页看不到）`，只含计数；自检从 55 项增加到 58 项。新用例：`backup-format.spec.ts` 的三种文件单元用例、`import.spec.ts` 的云端摘要加服务器保留加目标页隐藏用例。原有的 IO-09“先导入计划再导入旧备份”用例里，旧备份的自定义待办在 P2 组而新计划只有 P8，现在会多这一行，该用例的期望已更新。

### WR-02: 导入时计划缓存写失败的话，撤销不会恢复计划，只恢复记录，却提示“恢复成了导入前的样子”

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/import-undo.spec.ts`
**Commit:** 7cd223c
**Status:** fixed: requires human verification（竞态与比较逻辑）
**Applied fix:** `undoImport` 判断是否恢复计划，改成拿 `rec.plan` 和正在用的工作计划 `plan` 比较，不再读计划缓存。没有照抄评审里的 `normalizePlan(rec.plan)||rec.plan`：当账号保存的计划不合格（页面显示的是示例计划）时，那样写会让“没动过计划”的撤销也重传一次不合格的计划，所以改成 `normalizePlan(rec.plan)||normalizePlan(DEFAULT_PLAN)`，和 `usePlan` 的回落规则一致。新用例（manual 时钟）：只让计划缓存的第一次写入抛配额错误，导入完整备份，不推进时钟直接撤销，断言目标页的组回到导入前的 P1 到 P7，推进时钟后服务器的计划和记录都是导入前的。需要说明的构造细节：缓存持续写失败会让后续同步把缓存丢掉（`dropCache`），那样撤销反而是对的，所以只有“失败一次，撤销前没有同步”这个窗口才有这个缺陷，用例按这个窗口写。

### WR-03: 导入发生在一次上传途中时，这次上传的收尾把 `opsOk` 重置成 true，之后撞上别处的新版本会静默覆盖，不留底

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/import-sync.spec.ts`
**Commit:** c9ea552
**Status:** fixed: requires human verification（同步竞态逻辑）
**Applied fix:** 一次上传收尾时 `opsOk` 改为 `!ops.some(o => o.keys.includes("import"))`（撤销用同一个键，一起覆盖），并在旁边的注释里写明原因。新用例（manual 时钟，假服务器的 `hold` 故障）：让一次 state 的 PATCH 挂在途中，导入，再给紧接着的下一轮列表请求加 `hold`，放行 PATCH 后趁列表被挂住让另一台设备写入，再放行。断言服务器最终是导入的内容、弹出冲突提示、本机留底里有另一台设备的那条记录。修复前这条用例在“冲突提示”处失败。顺带跑了 `offline-sync.spec.ts` 和 `remote-update.spec.ts`，确认同步收尾的其他路径没有变。

### IN-01: 迁移脚本的旧备份相对路径在 `chdir(root)` 之后按仓库根目录解析

**Files modified:** `tools/plan/migrate-backup.mjs`
**Commit:** 2a05bd0
**Status:** fixed
**Applied fix:** 新增导出函数 `legacyPathFrom(p, cwd)`，`main()` 在 `process.chdir(root)` 之前用 `process.cwd()` 把旧备份路径解析成绝对路径，`runMigrate` 收到的是绝对路径。自检加了一项（59 项通过）。没有运行默认模式去实测相对路径，因为默认模式会读 `private/`，只用自检里的纯函数断言覆盖。

### IN-02: `importProblem` 开头的注释和 `if(!isObj(raw))return null` 在云端和旧路径上已经走不到

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`
**Commit:** 4af9466
**Status:** fixed
**Applied fix:** 只改注释：写明 `importProblem` 只供 `classifyBackup` 和单元用例调用，顶层非对象和非字符串 `arrival` 两种文件都由外层先拒绝，函数体里对应的两处判断只服务单元用例，保留原样。函数体没有动。

### IN-03: 登录换账号时导入快照被静默清除，只有退出登录会提示

**Files modified:** `.planning/phases/11-export-import-migration/11-CONTEXT.md`
**Commit:** 365aa6d
**Status:** fixed（选了评审给的文档方案）
**Applied fix:** 在 11-CONTEXT 的 D-04 下加了一条规划备注：令牌过期后换账号登录时，只剩撤销副本不弹确认，直接清除；这是有意保留的行为，`import-undo.spec.ts` 里“退出和换账号清除”那条用例已经钉住它（它明确断言“没有未上传的修改，所以换账号时不再确认”）；理由是撤销副本只在导入的这台设备上，导入的数据已经在服务器上，丢掉它只是不能再撤销，不丢账号数据，而退出登录是用户主动操作，所以退出确认才提示。没有选代码方案，因为那会改一条已经有用例固定的行为，也要新增界面文字，该由所有者决定。

### IN-04: 旧路径拒绝只含计划的文件时，toast 用默认的 1800 毫秒，提示一整句话读不完

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/e2e/io/import.spec.ts`
**Commit:** fb0b498
**Status:** fixed
**Applied fix:** `legacyImport` 里改成 `toast(T_IMP_PLAN_LOCAL,null,4000)`，并把 `onImportFile` 上方“旧路径不传时长”的注释补上这一处例外。用例在原有的拒绝用例上加了断言：2 秒之后提示还在，4.5 秒之后消失。**与 UI 审查那项的重叠：** `toast()` 在传了时长时会给 `#toast` 加 `data-cloud`，样式变成 `width:max-content`，所以这一句的 toast 宽度也随之变成云端样式（这是 `toast()` 对所有带时长的 toast 的既有处理，不是新加的样式）。我只按 IN-04 改了时长，没有另外动 CSS 或 toast 函数；编排者处理“旧路径 toast 宽度”时请注意这一点，可能那一项已被顺带解决，也可能需要重新判断。

### IN-05: 账号计划文档无效（回落到示例计划）时，导出的“完整备份”里写的是示例计划

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/strings.ts`, `tests/cloud/export.spec.ts`
**Commit:** 58b3f82
**Status:** fixed（选了评审的第一个方案：提示，不限制导出）
**Applied fix:** `saveFile` 多一个可选的 `note` 参数；备份导出在 `keepOrphans` 为真（账号计划读不出来）时传入 `T_EXPORT_SAMPLE_PLAN`：`已导出。账号的计划读不出来，备份里的计划是示例计划，导入它会换掉账号的计划。`，显示 6000 毫秒，替代平常的“已导出”（下载失败仍然提示“导出不可用”）。字符串在 `strings.ts` 里镜像为 `TOAST_EXPORTED_SAMPLE_PLAN`。没有选“只允许导出记录”：备份包装格式只有完整备份和只含计划两种（选项 A 已锁定），没有“只含记录”的新格式，而旧的裸 state 格式不能再导出（D-10）。新用例两条：计划不合格的账号导出时看到这句提示且文件里是示例计划；计划正常的账号导出仍然只看到“已导出”。旧路径的 `keepOrphans` 恒为假，导出行为不变。

---

_Fixed: 2026-11-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
