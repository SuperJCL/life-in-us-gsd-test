---
phase: 11-export-import-migration
verified: 2026-11-11T19:30:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".planning/phases/11-export-import-migration/11-01-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-01-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-02-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-02-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-03-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-03-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-04-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-04-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-05-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-05-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-06-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-06-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-07-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-07-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-08-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-08-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-09-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-09-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-10-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-10-SUMMARY.md"
  - ".planning/phases/11-export-import-migration/11-11-PLAN.md"
  - ".planning/phases/11-export-import-migration/11-11-SUMMARY.md"
  - "tests/KNOWN-BUGS.md"
  - "tests/cloud/export.spec.ts"
  - "tests/cloud/import-sync.spec.ts"
  - "tests/cloud/import-undo.spec.ts"
  - "tests/cloud/import.spec.ts"
  - "tests/cloud/migration.spec.ts"
  - "tests/e2e/data/backup-format.spec.ts"
  - "tests/e2e/io/export.spec.ts"
  - "tests/e2e/io/import.spec.ts"
  - "tools/plan/migrate-backup.mjs"
  - "us-journey-tracker.html"
covered_digest: "v4:sha256:4ebcd687bd075a640a082af4625103692428b827f6279d7c605e1b349ce8ad95"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "所有者在真实 Edge 里用合成文件走一遍迁移演练：运行 `node tools/plan/migrate-backup.mjs --demo`，打开云端版（假服务器、合成账号），桌面宽度和手机宽度（375）各一遍，选 `synth-migrated.json`，读摘要，导入，看目标页、日历、时间线、力量历史，再点“撤销导入”"
    expected: "摘要写明文件类型、替换范围和各项计数；手机上文字完整换行、按钮可点；导入后记录、复盘、完成的任务和力量历史都在对的任务和日期上；撤销后回到导入前，“撤销导入”按钮消失"
    why_human: "D-08 要求所有者亲自体验摘要和撤销；摘要读起来是否清楚、Edge 的真实界面表现只能由人判断（自动用例用的是 Playwright 的模拟环境）"
  - test: "在真实 Edge 里点“备份”和“导出日历 CSV”，看下载栏"
    expected: "两个文件都能正常保存；文件名不含邮箱；日历 CSV 只是备用导出，不做日历导入检查（所有者 2026-11-10 的决定）"
    why_human: "浏览器原生下载在真实 Edge 里的提示和保存行为，Playwright 的下载事件只能证明点击触发了下载，不能证明真实浏览器的下载栏体验"
  - test: "375 px 手机宽度下的工具栏换行和暗色主题外观"
    expected: "工具栏五个按钮全部显示、不挤出屏幕，暗色主题下“撤销导入”入口对比度够用"
    why_human: "自动用例验证了 375 px 下按钮都在视口内，编排者的手机尺寸模拟截图也不是真机证据；视觉观感需要人看"
  - test: "真机（手机）上下载备份和日历 CSV，以及导入文件选择"
    expected: "手机浏览器能下载两个文件，导入时能选到备份文件"
    why_human: "手机真机的下载与文件选择行为只能真机验证；CONTEXT 已把 iOS 下载体验优化列为以后，真机检查留给 Phase 13"
---

# Phase 11: 导出、导入与迁移 Verification Report

**Phase Goal:** 用户在手机和电脑上都能下载自己账号的 JSON 备份和日历 CSV。导入先识别格式、显示摘要，确认后才替换；导入前自动留快照，导入后可以撤销。所有者能把原 Artifact 导出的旧备份连同个人计划搬进新账号，整个流程先用合成文件演练过。
**Verified:** 2026-11-11T19:30:00Z（HEAD 288097c）
**Status:** human_needed
**Re-verification:** 否，首次验证

## 结论

阶段目标在代码里已经实现，没有发现缺口。四条路线图成功标准都有代码和通过的用例作证据，六个需求 ID 都有对应实现。状态是 human_needed，原因只有一个：11-11 计划明确留给所有者的真实 Edge 验收，以及自动用例看不到的视觉和真机检查。这些属于人工验证项，不是缺口。

## 目标达成情况

### 可观察的事实

| # | 事实（路线图成功标准） | 状态 | 证据 |
|---|----------------------|------|------|
| 1 | 云端版在手机宽度和桌面宽度下，都能用浏览器原生下载拿到本账号的 JSON 备份和日历 CSV，不再依赖 `downloads`；文件内容与当前账号一致 | VERIFIED | `us-journey-tracker.html:2044-2074`：`blobDownload`（Blob 加临时 `<a download>`）被备份、CSV、下载留底三处共用；`exportJson` 写 `backupOf(plan,state,…)` 新格式；`exportCsv` 读当前 `state.logs` 和 `allTasks()`；`window.__dl` 在应用和测试支持代码里已经零出现。云端用例（regression 报告里为 expected）：`IO-06 the cloud version downloads the account's JSON backup at desktop and phone width`、`…calendar CSV at desktop and phone width`、`the exported files carry no account identifier`、`the toolbar fits a 375 px wide screen with every button shown`；默认套件 `IO-06 exporting twice downloads two identical files and the Claude downloads capability is never called`、`IO-02 the calendar CSV export matches the spec-derived expectation byte for byte`。B7 公式前缀 `csvCell`（:2041）有用例 `IO-06 calendar cells that start with a formula character get a leading quote (B7)`。 |
| 2 | 非备份文件（`{}`、空数组、普通 JSON、非 JSON）直接拒绝，数据不变（修 N3）；v1 的 N3、B2 `test.fail` 翻转为正常断言，`KNOWN-BUGS.md` 同步 | VERIFIED | `classifyBackup`（:612-622）对非对象、`{}`、`[]`、类型不对、带 `format` 键但包装不合格的文件一律返回 `null`；`onImportFile`（:1407-1418）在任何确认之前 toast `T_IMP_BAD` 并返回，云端和旧路径共用。`grep` 确认 `tests/` 下已没有 N3、B2 的 `knownBug` 调用；`tests/KNOWN-BUGS.md` 的“已修复”一节登记了 B2、N3 的修复阶段、修法和现行回归用例，登记表里不再保留。用例：`IO-07 importing an empty JSON object is rejected with the format error (N3 fixed)`（默认套件）、`IO-07 the cloud version rejects an empty JSON object with the format error and changes nothing`（云端）、`IO-04 files that are not a backup show the format error, ask nothing and save nothing`。 |
| 3 | 有效备份先显示摘要并要求确认；确认后替换并同步到服务器；导入前自动留快照，可撤销；取消后能再次选同一个文件（修 B2） | VERIFIED | `cloudImport`（:1419-1427）：`importPreview` 生成摘要，`confirmBox` 显示 `importLines`，取消直接返回，什么都没写。`applyImport`（:1443-1467）：先 `takeRemote()`，再把导入前的计划和记录写进 `usj:v2:<id>:importundo`（`localStorage.setItem` 失败就拒绝导入并提示 `T_IMP_NO_UNDO`），然后 `usePlan`、`commit(["import"],…)`、`opsOk=false` 走 Phase 10 的同步上传。`undoImport`（:1474-1508）：数据有变化时先确认（含确认框打开期间同步来的改动再确认），经 `commit` 恢复并上传，用完删除槽位。退出登录和换账号时清 `importundo`（:861、:1751）。`onImportFile` 的 `finally{input.value=""}`（:1417）修 B2。用例（云端，全部通过）：`import-undo.spec.ts` 九条（上传与别的设备跟随、撤销前有新修改要先确认、确认期间新同步再确认、存不下就拒绝、刷新保留且被下次导入替换、退出和换账号清除、跨标签页显示隐藏、撤销带回挂起的远端修改、WR-02 计划缓存写失败仍撤销计划）；`import-sync.spec.ts` 八条（含 WR-03、IN-05、IN-06、真冲突留底）；`import.spec.ts`：`IO-10 cancelling the cloud import leaves the data unchanged and the same file can be chosen again`。 |
| 4 | 原 Artifact 旧格式备份（裸 state、旧类别名）和种子计划可以导入新账号，导入后记录、复盘、任务进度和力量历史都对应到正确的任务和日期；生成脚本只在本机运行，输出被 git 忽略 | VERIFIED | `legacyShape`/`classifyBackup` 识别裸 state；`normalize`（:548）把旧类别名映射到新名，进度键只保留对得上计划的任务，孤儿丢弃（D-07 在摘要里醒目提示）。`tools/plan/migrate-backup.mjs` 复用应用纯函数段合成完整备份，只写 `private/`（`git check-ignore -v private/plan-seed.json` 确认被忽略）。我亲自运行了 `node tools/plan/migrate-backup.mjs --self-test`：输出“自检通过：59 项”；运行了 `--demo test-results/p11-verify-demo`：只打印计数（记录 3 条、复盘 2 周、完成的任务 2 项、力量记录 2 条、计划 2 组 4 项任务 1 个力量项、对不上计划的进度 1 条）并以 `MIGRATION OK` 结束，写出四个 `synth-*` 合成文件（`test-results/` 被忽略）。`tests/cloud/migration.spec.ts` 的演练用例在假服务器上跑完整流程：期望值从合成旧备份和种子独立算出，断言服务器上的记录 id/日期/类别、复盘、保留的进度、自定义待办、力量历史、抵达日期、目标页任务与完成项、力量历史、时间线，以及撤销。 |

**得分：** 4/4 条事实已验证，0 条存在、已接线但行为未验证。

### 需求覆盖

计划前置事项中声明的需求 ID 与 REQUIREMENTS.md 逐一对照：IO-06（11-08、11-09）、IO-07（11-01、11-02、11-04、11-07）、IO-08（11-01 至 11-06）、IO-09（11-01、11-02、11-03、11-10、11-11）、IO-10（11-01、11-07）、TEST-03（11-07）。REQUIREMENTS.md 里映射到 Phase 11 的恰好是这六个 ID，没有被所有计划漏掉的孤儿需求。

| 需求 | 描述 | 状态 | 证据 |
|------|------|------|------|
| IO-06 | 手机和电脑上下载 JSON 备份和日历 CSV，不依赖 Claude 下载 | SATISFIED（真机体验见人工项） | `blobDownload`、`exportJson`、`exportCsv`；云端和默认套件的 IO-06 用例 |
| IO-07 | 导入前识别格式，`{}` 等直接拒绝（修 N3） | SATISFIED | `classifyBackup`、`onImportFile`；IO-07 用例在两条路径上都通过 |
| IO-08 | 导入前摘要加确认，自动留快照，可撤销 | SATISFIED | `importPreview`/`importLines`/`confirmBox`、`applyImport`、`undoImport`、`#undoImportBtn`；17 条 IO-08 云端用例 |
| IO-09 | 旧 Artifact 备份导入新账号，对应正确；迁移先用合成文件演练 | SATISFIED（所有者真实 Edge 演练见人工项） | 迁移脚本、`migration.spec.ts`、我运行的 `--self-test` 与 `--demo` |
| IO-10 | 取消导入后可再次选择同一个文件（修 B2） | SATISFIED | `finally{input.value=""}`；两条路径各有用例 |
| TEST-03 | N3、B2 用例翻转，`KNOWN-BUGS.md` 同步 | SATISFIED | `tests/` 里无残留 `knownBug` N3/B2；KNOWN-BUGS.md 已移到“已修复” |

### 已锁定决定的核对

| 决定 | 代码里是否遵守 | 证据 |
|------|---------------|------|
| D-01 新格式完整备份替换计划和记录 | 是 | `applyImport` 的 `pv.plan` 分支，`T_IMP_REPLACE_FULL` |
| D-02 旧备份只替换记录、不动计划 | 是 | `importPreview` 的 legacy 分支用当前 `plan`，`T_IMP_REPLACE_LEGACY` |
| D-03 只含计划的文件只换计划 | 是 | `BK_PLAN` 分支，`cur` 作记录来源，`T_IMP_REPLACE_PLAN` |
| 格式决定（选项 A，`{app, format:2, kind, exportedAt, plan, state}`） | 是 | `BK_*` 常量、`backupOf` 键序、`snapDownload` 的计划留底包装 |
| D-04/D-05 快照存本机、撤销前有新修改要确认、退出清除 | 是 | `undoKey`、`undoImport` 的确认循环、:861/:1751 |
| D-07 对不上计划的进度在摘要里醒目提示 | 是 | `importLines` 的 `warn` 索引、`T_IMP_ORPHAN_*` |
| D-09 旧路径不做摘要、快照、撤销，保留原生 `confirm()` 原文案 | 是 | `legacyImport`（:1430-1437） |
| D-10 旧路径接受新格式完整备份只换记录、拒绝只含计划的文件、5 MB 上限 | 是 | `legacyImport`、`IMPORT_MAX`；三条 IO-07 旧路径用例 |
| CSV 不加 BOM、B7 前缀照做 | 是 | `csvCell`；CSV 逐字节用例 |

### 评审与安全后续的核对

- 11-REVIEW 的九项发现（CR-01、WR-01 至 WR-03、IN-01 至 IN-05）在当前代码里都有实现，`11-REVIEW-DISPOSITION.md` 记录 0 项未处理。抽查 CR-01：`normalize` 在 `done===true` 且 `doneDate` 缺失时补空串（:575 附近），对应的云端和旧路径用例都通过。
- UI 评审的四项（导入按钮可键盘到达、导出按钮在闸门下可用 `GATE_ALLOW` 含 `#exportCsv,#exportJson`、旧路径 5 MB toast、CSV 提示）在代码和 `IO-10 the restore button can be reached with the keyboard…` 等用例里都找得到。
- `11-SECURITY.md` 的 30/30 威胁关闭由安全审计负责，我没有重复审计，只确认了与威胁相关的几处机制：导入文件在确认之前不触碰 state、缓存和服务器；摘要文本用 `textContent`；迁移脚本只打印计数。

### 行为证据

回归闸门由编排者在 HEAD 288097c 运行：默认套件 188 条 expected、0 flaky、0 unexpected；云端套件 196 条 expected、0 flaky、0 unexpected。我读取两份 Playwright JSON 报告，确认上面引用的 IO-06 至 IO-10 用例标题都在其中且状态为 expected。我没有重跑全量套件。`APP_SHA256`（`tests/support/constants.ts:38`）与当前 `us-journey-tracker.html` 的 SHA-256 一致。

本阶段的各条事实没有只靠符号存在得到 VERIFIED：撤销顺序、取消清空文件框、导入遇到别处新版本留底等行为依赖项都有实际跑过的用例，所以没有 PRESENT_BEHAVIOR_UNVERIFIED 项。

### 反模式扫描

对本阶段改动的应用、迁移脚本和测试文件扫描 `TBD`、`FIXME`、`XXX`：无命中。没有发现桩函数或写死的空数据流向渲染的情形：导出读真实 `state`/`plan`，导入读真实文件，摘要来自 `importPreview` 的真实计算。无阻断项。

### 延后项

无。本阶段没有缺口需要转交后面的阶段。真机检查和所有者的真实迁移已经在路线图里属于 Phase 13，作为人工项记录如下，不是缺口。

## 需要人工验证

### 1. 所有者的真实 Edge 迁移演练（11-11 验收）

**Test：** 运行 `node tools/plan/migrate-backup.mjs --demo`（文件落在 `private/migration-demo/`），在真实 Edge 里打开云端版（假服务器、合成账号），桌面宽度和 375 宽度各走一遍：选 `synth-migrated.json`，读摘要，导入，查看目标页、日历、时间线、力量历史，点“撤销导入”。
**Expected：** 摘要写明文件类型、替换范围和各项计数；手机上文字完整换行、按钮可点；各视图里的数据对在正确的任务和日期上；撤销后回到导入前，入口消失。
**Why human：** D-08 要求所有者亲自体验；摘要是否清楚、真实 Edge 的表现只能由人判断。

### 2. 真实 Edge 里两个文件的下载

**Test：** 点“备份”和“导出日历 CSV”，看 Edge 下载栏。
**Expected：** 两个文件正常保存，文件名不含邮箱。日历 CSV 只是备用导出，不做日历导入检查（所有者 2026-11-10 的决定）。
**Why human：** 真实浏览器下载栏的体验，自动用例只能看到下载事件。

### 3. 375 px 工具栏和暗色主题的外观

**Test：** 在手机宽度和暗色主题下看工具栏。
**Expected：** 五个按钮都显示、不挤出屏幕，“撤销导入”入口对比度够。
**Why human：** 自动用例只验证按钮在视口内；编排者的模拟截图不是真机证据。

### 4. 手机真机的下载和文件选择

**Test：** 手机浏览器上下载两个文件并导入备份。
**Expected：** 能下载，能选到文件。
**Why human：** 真机行为；iOS 下载体验优化已在 CONTEXT 中列为以后，真机检查留给 Phase 13。

## 缺口摘要

没有缺口。四条成功标准、六个需求 ID、已锁定的 D-01 至 D-10 和格式决定在当前代码里都成立，并有已通过的自动用例佐证；我亲自运行的迁移脚本 `--self-test`（59 项）和 `--demo`（`MIGRATION OK`）也通过。剩下的只有所有者的真实 Edge 验收和真机视觉检查，完成后本阶段即可收口。

---

_Verified: 2026-11-11T19:30:00Z_
_Verifier: Claude (gsd-verifier)_
