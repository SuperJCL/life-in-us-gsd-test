---
phase: 11-export-import-migration
reviewed: 2026-11-11T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - PRIVACY.md
  - tests/KNOWN-BUGS.md
  - tests/PROBES.md
  - tests/README.md
  - tests/cloud/conflict-snapshot.spec.ts
  - tests/cloud/export.spec.ts
  - tests/cloud/import-sync.spec.ts
  - tests/cloud/import-undo.spec.ts
  - tests/cloud/import.spec.ts
  - tests/cloud/migration.spec.ts
  - tests/e2e/data/backup-format.spec.ts
  - tests/e2e/io/export.spec.ts
  - tests/e2e/io/import.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/e2e/security/state-validation.spec.ts
  - tests/e2e/smoke.spec.ts
  - tests/e2e/storage/account-mode.spec.ts
  - tests/e2e/storage/config-seam.spec.ts
  - tests/mocks/CONTRACT.md
  - tests/support/app-source.ts
  - tests/support/app.ts
  - tests/support/backup-files.ts
  - tests/support/confirm.ts
  - tests/support/constants.ts
  - tests/support/download.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/strings.ts
  - tools/plan/migrate-backup.mjs
  - us-journey-tracker.html
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-11-11
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

本次重点审了 Phase 11 对 `us-journey-tracker.html` 的改动（`classifyBackup`、`importPreview`、`applyImport`、`undoImport`、`onImportFile`、`csvCell`、`blobDownload`、留底合并 `keepConflict`、计划上传），新增的迁移脚本 `tools/plan/migrate-backup.mjs`（只运行了 `--self-test`，55 项通过），以及新增和改动的测试与文档。

整体评价：D-01 到 D-10 的实现基本到位。我逐条核对的结果是：
- 识别规则的顺序和拒绝逻辑正确。包装分支先于旧备份分支。
- `finally` 里清空文件框，B2 已修。
- 取消导入时没有写入。
- 导入先留快照再改数据，留不下就拒绝。
- 撤销在最后一次比较和恢复之间没有 `await`。
- 迁移脚本只打印计数，只写 `private/`。
- `APP_SHA256` 与当前文件一致。
- 没有发现未转义的用户文本进入 `innerHTML`，计划文字都经过 `esc()`。

但还是找到一个会让账号打不开的输入、一处撤销与导入前状态不一致的路径、一处与“导入整份胜出并留底”这条决定不符的竞态，以及一个导入计划之后看不到自定义待办的缺口。测试侧没有发现会让用例空转的断言，也没有未使用的导入。

没有提供 fallow 结构化结果，所以没有 `Structural Findings` 一节。

## Critical Issues

### CR-01: 备份里 `done: true` 但没有 `doneDate` 的任务能通过导入校验，之后目标页渲染抛错，账号打不开

**File:** `us-journey-tracker.html:534`、`us-journey-tracker.html:579`、`us-journey-tracker.html:1911`
**Issue:**
- `importProblem` 对任务的 `doneDate` 用 `optDate`，允许 `undefined`。
- `normalize` 只在 `doneDate` 存在但不是真实日期时才把它改成 `""`，缺失时保持 `undefined`。
- `renderGoals` 对已完成任务直接写 `md(s.doneDate)`。
- `md` 是 `s=>(+s.slice(5,7))…`，传入 `undefined` 会抛 `TypeError`。
- 我用 node 在应用的纯函数段里复现了：`classifyBackup({tasks:{"P1-1":{done:true}}})` 返回 `legacy`，`normalize` 保留 `{"done":true}`，`md(undefined)` 抛 “Cannot read properties of undefined (reading 'slice')”。
- 原应用自己写任务时总会带 `doneDate`（`:2016`），所以只有手改的文件或别处生成的文件才会触发。
- 触发后果很重：
  - `applyImport` 里 `renderKeep()` 抛错，导入的 toast 和撤销入口的 toast 都不出现。
  - 数据已经写入缓存并上传服务器。
  - 之后每次加载，`enterApp` 里 `renderAll()` 抛错，页面落到登录页的“网络错误”。
  - 撤销入口也进不去，另一台设备同样打不开。
- 这违背了 Phase 7 起“任何一处不合格整份拒绝”的导入契约（T-11-05），而且 Phase 11 把导入放开到了云端，让这个输入能一路同步到服务器。

**Fix:** 两处都补，导入时修正，渲染时防御。
```js
// normalize（us-journey-tracker.html:579 附近）：done 为真时保证 doneDate 是字符串
for(const f of ["doneDate","due"])if(r[f]!==undefined&&r[f]!==""&&!okDate(r[f]))r[f]="";
if(r.done===true&&r.doneDate===undefined)r.doneDate="";
// renderGoals（:1911）
`完成于 ${s.doneDate?md(s.doneDate):"日期未记录"}`
```
同时给 `tests/e2e/data/backup-format.spec.ts` 或 `state-validation.spec.ts` 加一条用例：`{tasks:{"P1-1":{done:true}}}` 导入后目标页能渲染。

## Warnings

### WR-01: 导入只含计划的文件或完整备份后，对不上新计划的自定义待办在目标页消失，摘要和迁移脚本都不提示

**File:** `us-journey-tracker.html:571`、`us-journey-tracker.html:648-656`、`us-journey-tracker.html:1903`、`tools/plan/migrate-backup.mjs:75-94`
**Issue:**
- `normalize` 只检查自定义待办的 `group` 格式合法（`GROUP_ID_RE`），不检查它是否在当前计划的组里。
- `renderGoals` 按 `plan.groups` 逐组渲染，`allTasks().filter(x=>x.group===g.id)`，所以 `group` 不在计划里的待办在目标页完全看不到，也没法勾选和删除。
- 它们仍然在状态里，还会出现在日历、时间线和 CSV 里（标签是原始组号，颜色回落到 `oth`）。
- 我用 node 复现了：完整备份的计划只有 `P1`，状态里有 `{id:"c-1",group:"P5"}`，`importPreview` 返回的状态原样保留 `group:"P5"`。
- D-07 只要求提示“对不上计划的任务进度”，所以这一类没有任何提示：
  - 确认摘要的 `orphans` 只数 `tasks` 键。
  - 迁移脚本的 `orphans` 计数也一样。
- 迁移是一次性的。所有者如果种子计划和旧备份的组不完全一致，导入后这些待办会悄悄消失。

**Fix:** 最小做法是把“对不上计划的自定义待办条数”并入 D-07 的提示。
```js
// importPreview 的 fin 里
const orphanCustom=(st.custom||[]).filter(c=>!plan.groups.some(g=>g.id===c.group)).length; // 在 withPlan 之内计算
```
摘要多一行醒目文字，迁移脚本的 `reportLines` 也多打一行计数。更彻底的做法是在 `normalize` 里把组不在计划里的待办挪到 `oth` 组，和格式不合法时的处理一致。

### WR-02: 导入时计划缓存写失败的话，撤销不会恢复计划，只恢复记录，却提示“恢复成了导入前的样子”

**File:** `us-journey-tracker.html:1451`、`us-journey-tracker.html:1463`、`us-journey-tracker.html:1488-1492`
**Issue:**
- `applyImport` 用 `planCached=cachePut("plan",…)` 写新计划，失败时（本机空间不够）旧的干净计划缓存记录原样保留。
- `undoImport` 判断“要不要恢复计划”用的是 `canon(rec.plan)!==canon(undoPlanData())`。
- `undoPlanData()` 优先读计划缓存。此时缓存还是旧计划，等于 `rec.plan`（`rec.plan` 当初也是从同一份缓存读的），所以比较结果相等，计划恢复被跳过。
- 工作中的计划仍是导入的计划，`planBody()` 在缓存不 dirty 时上传工作计划，服务器上的计划保持为导入的版本，而记录回到了导入前。
- 结果是计划和记录不配套，toast 却说 `T_UNDONE`。
- 这条路径需要 localStorage 在“撤销副本已写入、计划缓存写失败”之间恰好满了，范围窄，现有的配额用例只让 `:importundo` 键抛错，覆盖不到。

**Fix:** 比较对象应当是正在用的工作计划，而不是缓存。
```js
const want=normalizePlan(rec.plan)||rec.plan;
if(docs.plan&&canon(want)!==canon(plan)){ /* 恢复计划 */ }
```

### WR-03: 导入发生在一次上传途中时，这次上传的收尾把 `opsOk` 重置成 true，之后撞上别处的新版本会静默覆盖，不留底

**File:** `us-journey-tracker.html:1296`、`us-journey-tracker.html:1455`（`undoImport` 的 `:1495` 同理）
**Issue:**
- `applyImport` 在提交后写 `opsOk=false`，意图是写在 `:1434` 的注释里的：“如果别处同时存了更新的版本，导入整份胜出，那个版本按平常的冲突留底，不重做”。
- 但如果这时已有一次上传在途，上传返回后 `:1296` 无条件执行 `ops.splice(0,sentOps);opsOk=true`。
- 导入操作是在快照之后加入 `ops` 的，所以留在 `ops` 里，而 `opsOk` 已经被改回 true。
- 下一轮同步里，如果另一台设备在这段时间写过 state，`clash&&opsOk` 成立，走 `rebaseState` 的“在新版本上重做”分支：
  - 导入操作是整份替换，重做的结果就是把另一台设备的新内容全部替掉。
  - `keepConflict` 没有被调用，没有留底，也没有冲突提示。
- 这违背了 D-03 和 `:1434` 注释自己写明的行为。
- 需要“导入时恰有上传在途，且之后另一台设备写入”，窗口不大，但后果是静默丢另一台设备的修改。

**Fix:** 收尾时只在 `ops` 里没有整份替换的操作时才恢复 `opsOk`。
```js
ops.splice(0,sentOps);
opsOk=!ops.some(o=>o.keys.includes("import"));
```
撤销用同一个键 `"import"`，所以一起覆盖。

## Info

### IN-01: 迁移脚本的旧备份相对路径在 `chdir(root)` 之后按仓库根目录解析

**File:** `tools/plan/migrate-backup.mjs:487`、`tools/plan/migrate-backup.mjs:296`
**Issue:** `main()` 先 `process.chdir(root)`，之后 `runMigrate(parsed.legacyPath)` 用 `readInput` 读相对路径。所有者如果在仓库子目录或别的位置用相对路径运行，会读不到文件，提示“找不到旧备份文件”（失败是明确的，不是静默的）。
**Fix:** 在 `chdir` 之前把路径解析成绝对路径：`const legacyPath = resolve(process.cwd(), a)`。

### IN-02: `importProblem` 开头的注释和 `if(!isObj(raw))return null` 在云端和旧路径上已经走不到

**File:** `us-journey-tracker.html:523-545`
**Issue:** 注释里写的两条豁免现在都由外层 `classifyBackup` 先拒绝，函数体里 `if(!isObj(raw))return null` 在应用里无调用路径，只有单元用例直接调它。`:525` 的说明读起来仍像是行为的一部分。
**Fix:** 把注释改成“仅供 `classifyBackup` 和单元用例使用，顶层非对象由调用方保证不出现”，或在 `if(!isObj(raw))return null` 旁注明它只服务单元用例。

### IN-03: 登录换账号时导入快照被静默清除，只有退出登录会提示

**File:** `us-journey-tracker.html:847-860`、`us-journey-tracker.html:1755`
**Issue:** `onLogoutClick` 会提示“退出后就不能撤销了”。但令牌过期后换另一个账号登录，`unsentOf` 只看 `edits` 和 `snap`，不看 `importundo`，所以只含撤销副本时直接清掉，不弹确认。D-04 把退出确认交给规划决定，换账号这条路径没有对应说明，两处行为不一致。
**Fix:** 要么让 `unsentOf` 返回 `undo` 并在换账号确认里加一行，要么在 `11-CONTEXT` 或 PRIVACY 里记下“换账号登录不提示撤销副本”。

### IN-04: 旧路径拒绝只含计划的文件时，toast 用默认的 1800 毫秒，提示一整句话读不完

**File:** `us-journey-tracker.html:1425`
**Issue:** `toast(T_IMP_PLAN_LOCAL)` 没传时长，走默认 1800 毫秒，而文案是“这个版本不保存计划，只含计划的文件要登录后才能导入”。D-10 要求“说明原因”，但显示时间太短（与 11-UI-REVIEW 已记的“旧路径 toast 在窄屏上的样子”不是同一件事）。
**Fix:** 传入时长，例如 `toast(T_IMP_PLAN_LOCAL,null,4000)`；旧路径“保持原样”的约束只针对 N3、B2、导出之外已批准的三项，这一条正属于已批准的新行为，所以改时长不违反 D-09。

### IN-05: 账号计划文档无效（回落到示例计划）时，导出的“完整备份”里写的是示例计划

**File:** `us-journey-tracker.html:2063`
**Issue:** `backupOf(plan,state,…)` 用的是工作中的 `plan`。账号的计划文档无效时 `keepOrphans` 为真，`plan` 是回落的示例计划，不是账号的计划。导出的文件仍标成 `kind: "full"`，导回去会把账号的计划换成示例计划，用户可能以为备份里是自己的计划。这是少见情形，不影响正常账号。
**Fix:** 此时导出按钮提示“计划无法读取，备份里的计划是示例计划”，或在 `keepOrphans` 为真时只允许导出记录。

---

_Reviewed: 2026-11-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
