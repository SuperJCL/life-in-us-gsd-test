---
phase: 11-export-import-migration
plan: 02
subsystem: io
tags: [backup-format, import, export, plan-validation, node-vm-unit-tests]

requires:
  - phase: 11-export-import-migration
    provides: "11-01 classifyBackup (legacy only), importPreview, backupCounts, legacyShape, backup-files.ts"
  - phase: 07-id-plan-extraction-stable-ids-escaping
    provides: "normalizePlan, usePlan, importProblem, normalize with orphan-progress drop"
provides:
  - "Backup wrapper format (format 2, kind full or plan), confirmed by the owner: constants BK_APP, BK_FORMAT, BK_FULL, BK_PLAN"
  - "classifyBackup wrapper branch (before the legacy branch), backupOf, withPlan, planCounts"
  - "importPreview for full backups and plan-only files (orphan count under the new plan, plan and planCounts returned)"
  - "loadAppPure(names, live) with readLive() for live module bindings"
  - "tests/support: fullBackup, planOnlyFile, BACKUP_* constants"
affects: [11-03, 11-04, 11-08, 11-09, 11-10, 11-11]

plan_head_before: 9a29c3d7638c6fda64339961d557a6c29d741d0d
plan_head_after: f9606f7292c7413ee379afdd26cd37658a892457

actuals:
  tokens: 9500
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Wrapper branch of classifyBackup runs before legacyShape (legacyShape refuses any object with a format key)"
    - "withPlan(p, fn) saves and restores plan, planTasks, planIds, planCat, keepOrphans in finally (same pattern as normUnder)"
    - "Test loader reads live let bindings through a readLive arrow in the same vm script, no JSON round trip"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/backup-files.ts
    - tests/support/app-source.ts
    - tests/e2e/data/backup-format.spec.ts

key-decisions:
  - "Backup format fixed as option A (explicit kind) by the owner; plan kept-copy download will use the plan wrapper (implemented in 11-09)"
  - "Cloud import lets only kind legacy through until 11-03 wires plan replacement, so a full backup can never be applied as records-only"
  - "Unknown extra keys and exportedAt are not checked in the wrapper (edge probe IO-07)"

requirements-completed: []  # IO-07, IO-08, IO-09 are declared by later plans of this phase too; requirements.ready-ids decides

coverage:
  - id: D1
    description: "Wrapper recognised as full backup or plan-only file; any invalid part (app, format, kind, plan, state, state on plan-only, missing state) rejects the whole file"
    requirement: IO-07
    verification:
      - kind: unit
        ref: "tests/e2e/data/backup-format.spec.ts#IO-07 classifyBackup reads the agreed wrapper as a full backup or a plan-only file and rejects a wrapper with any invalid part"
        status: pass
    human_judgment: false
  - id: D2
    description: "backupOf writes the agreed wrapper in the agreed key order and classifyBackup reads it back unchanged (no account identifier in the file)"
    requirement: IO-08
    verification:
      - kind: unit
        ref: "tests/e2e/data/backup-format.spec.ts#IO-08 backupOf writes the agreed wrapper and classifyBackup reads it back unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "Orphan progress count under the new plan for both new kinds, computed without changing the plan in use (live bindings checked, withPlan restores keepOrphans)"
    requirement: IO-09
    verification:
      - kind: unit
        ref: "tests/e2e/data/backup-format.spec.ts#IO-08 importPreview counts the progress a new plan would drop for full backups and plan-only files (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cloud import of a legacy backup is unaffected and still the only kind let through"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 importing a legacy backup in the cloud version asks first, replaces the records, keeps the plan and uploads to the server"
        status: pass
    human_judgment: false

duration: ~20 min active after the owner's answer
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 02: Backup wrapper format and pure functions Summary

**The owner-confirmed backup wrapper (format 2, kind full or plan) is now implemented in the pure section: classifyBackup reads it before the legacy rule, backupOf writes it, and importPreview counts the progress a new plan would drop, with Node unit cases; the cloud import still lets only legacy backups through.**

## 备份格式决定

所有者在 Task 1 的检查点选了 **选项 A：显式种类（写明 kind）**，并且计划留底改用 plan 包装。回复原样：备份格式 "A：写明 kind (Recommended)"；计划留底 "改 (Recommended)"。11-03、11-08、11-09、11-10 都只按本节写。

完整备份（计划和记录用合成占位）：

```json
{
  "app": "us-journey-tracker",
  "format": 2,
  "kind": "full",
  "exportedAt": "2026-03-18T12:00:00.000Z",
  "plan": { "v": 1, "presets": {}, "groups": [], "lifts": [], "fitGoal": [1, 3], "fitNote": "SYNTH plan" },
  "state": { "arrival": "", "tasks": {}, "custom": [], "logs": [], "lifts": {}, "reviews": {}, "presets": {} }
}
```

只含计划的文件（没有 state 键）：

```json
{
  "app": "us-journey-tracker",
  "format": 2,
  "kind": "plan",
  "exportedAt": "2026-03-18T12:00:00.000Z",
  "plan": { "v": 1, "presets": {}, "groups": [], "lifts": [], "fitGoal": [1, 3], "fitNote": "SYNTH plan" }
}
```

（示例里 `groups` 写成空数组只是占位；真实文件里计划必须至少有一个组，空组数的计划会被拒绝。）

常量取值（应用里是 `BK_*`，测试侧 tests/support/constants.ts 是 `BACKUP_*`，逐字相同）：

| 应用 | 测试 | 取值 |
|------|------|------|
| `BK_APP` | `BACKUP_APP` | `"us-journey-tracker"` |
| `BK_FORMAT` | `BACKUP_FORMAT` | `2` |
| `BK_FULL` | `BACKUP_KIND_FULL` | `"full"` |
| `BK_PLAN` | `BACKUP_KIND_PLAN` | `"plan"` |

`exportedAt` 是导出时刻的 UTC 时间，只作参考，导入时不检查；文件里没有邮箱、账号 id 等任何账号标识；文件名仍是 `计划手记-备份-<日期>.json`。

识别规则四步原文：

① 不是 JSON → 拒绝；② 普通对象且有 `format` 键 → 只按包装判断：`app` 必须是 `us-journey-tracker`、`format` 必须是 2、`kind` 必须是 `full` 或 `plan`，`plan` 必须通过计划校验，`full` 的 `state` 必须通过旧备份识别和导入白名单，`plan` 不能带 `state`，任何一处不合格整份拒绝；③ 否则是普通对象、旧 state 的已知字段至少有一个且出现的都类型正确 → 旧备份（只替换记录）；④ 其余一律拒绝，提示“文件格式不对”。

以后的版本：要改格式时把 `format` 换成 3，新版继续接受 2 和旧备份；旧版应用遇到 3 会提示格式不对。

已知限制：选“改”之后，Phase 9、10 已经下载到电脑或手机上的计划留底文件（裸计划，文件名 `计划手记-计划留底-<日期>.json`）不能直接用“恢复”导入，应用会提示文件格式不对；需要时只能手工把它包装成只含计划的文件，或者在原设备上重新导出一份备份。这一条在 11-09 的已知限制里再记一次。记录留底保持裸 state，按旧备份导入（D-02）。同一次导入里计划和记录都被覆盖时，11-04 会把两份合在一份留底里，下载的是完整备份，不受本项选择影响。

计划留底包装：改

## Performance

- **Completed:** 2026-11-11T05:08Z (Task 2 committed `f9606f7`)
- **Tasks:** 2 (Task 1 decision only, no commit; Task 2 one commit)
- **Files modified:** 5 (0 created)

## Accomplishments

- **classifyBackup wrapper branch.** Check order: the object has an own `format` key -> `app` equals `BK_APP` -> `format` equals `BK_FORMAT` -> `kind` is `BK_FULL` or `BK_PLAN` -> `normalizePlan(raw.plan)` is not null -> (plan-only) no own `state` key / (full) `legacyShape(raw.state)` and `importProblem(raw.state)===null`. Any failure returns null. The branch sits before the legacy rule because `legacyShape` refuses every object with a `format` key (11-01 hand-off). Unknown extra keys and `exportedAt` are not checked.
- **backupOf(p, s, at)**, **withPlan(p, fn)**, **planCounts(p)** in the pure section; **importPreview** handles both new kinds (full: normalize the file's state under the file's plan; plan-only: normalize the account's current state under the new plan, records untouched) and returns the extra keys `plan` and `planCounts`.
- **withPlan saves and restores:** `plan`, `planTasks`, `planIds`, `planCat`, `keepOrphans` (in `finally`, also on a throw); inside it `keepOrphans = !usePlan(p)`.
- **Cloud entry:** `cloudImport` now treats any kind other than `legacy` as the format error (toast, no dialog); 11-03 lets the two new kinds through together with plan replacement.
- **Test loader:** `loadAppPure(names, live = [])` returns an extra `readLive()` that reads the listed module bindings at call time in the same vm script; with an empty `live` the evaluated source is byte-identical to before, so existing callers are unaffected.
- **importProblem header comment** updated: the two exemptions are now rejected earlier by the outer classifyBackup; function body unchanged.

## Task Commits

1. **Task 1: owner confirms the backup format** - no commit (decision only, recorded above)
2. **Task 2: pure section for the agreed format** - `f9606f7` (feat)

**Plan metadata:** the docs commit that adds this file.

## Hand-offs for later plans

Pure section of `us-journey-tracker.html` (all reachable with `loadAppPure`):

- `BK_APP`, `BK_FORMAT`, `BK_FULL`, `BK_PLAN` (values above).
- `classifyBackup(raw) -> {kind:"full", plan, state} | {kind:"plan", plan} | {kind:"legacy", state} | null`. `plan` is the normalizePlan result (no `_synthetic`, canonical key order); `state` of a full backup and of a legacy backup is the raw object, NOT yet normalized.
- `backupOf(p, s, at) -> object`: keys in order `app, format, kind, exportedAt, plan` plus `state` last when `s` is not null/undefined; `s == null` gives `kind: "plan"`. Pure: `at` is passed by the caller (ISO string), no clock read.
- `withPlan(p, fn) -> fn()'s result`: runs `fn` under plan `p` and restores plan state afterwards.
- `planCounts(p) -> {groups, tasks, lifts}`; `tasks` includes archived tasks. `p` must be a normalized plan.
- `importPreview(b, cur) -> {state, counts, current, orphans}` for legacy; for full and plan-only also `plan` (= `b.plan`) and `planCounts`. Full: orphans from the file's progress under the file's plan. Plan-only: `state = normalize(cur)` under the new plan, orphans = `cur` progress keys (object values) minus keys left. `cur` is `docAfter()` in the cloud page. It never touches the plan in use.
- `importLines(b, pv)` and `applyImport(b)` are unchanged (legacy only); 11-03 must extend them and relax the `b.kind!=="legacy"` check in `cloudImport`.

Test support:

- `tests/support/constants.ts`: `BACKUP_APP`, `BACKUP_FORMAT`, `BACKUP_KIND_FULL`, `BACKUP_KIND_PLAN`.
- `tests/support/backup-files.ts`: `fullBackup(plan, state, exportedAt?)`, `planOnlyFile(plan, exportedAt?)` (built independently from the constants, default `exportedAt` `2026-03-18T12:00:00.000Z`), plus the existing `legacyBackup`.
- `tests/support/app-source.ts`: `loadAppPure(names, live?)`; `readLive()` returns `{plan, planIds, keepOrphans}` style objects of whatever `live` lists, read at call time (objects keep identity, compare with `toBe`). `names` must not contain `readLive`.
- Spec helper idea reusable by 11-03: in `backup-format.spec.ts` the `planLike(p)` helper drops `_synthetic` from a synthetic plan to get the expected normalized plan.

Totals after this plan: default suite 181 (`npx --no playwright test --list`, +3), cloud suite 162 (unchanged, no new cloud case). Only the targeted subsets were run (default: backup-format, state-validation, plan-normalize, app-integrity, 16 tests; cloud: import, 4 tests), both REPORT OK.

## Decisions Made

- Option A with explicit `kind`; plan kept-copy download switches to the plan wrapper in 11-09, the record kept copy stays a bare state (D-02).
- `exportedAt` and unknown extra keys are not validated; this keeps the format forward-tolerant and matches the edge probe in the plan.
- The cloud entry gate is one condition (`b.kind!=="legacy"`), so a wrapper that classifies fine still cannot cause a records-only (partial) import before 11-03.

## Deviations from Plan

### TDD gate note

**1. [Process] Task 2 RED observed but not committed separately**
- **Why:** the plan fixes one commit per task, as in 11-01. The three new unit cases were written first and run against the unchanged app: all three failed with `ReferenceError: backupOf is not defined` thrown inside `loadAppPure` (symbol-missing RED, not assertion-level RED); the two 11-01 cases kept passing. After implementation all passed.
- **Impact:** a TDD gate audit will see no `test(11-02)` commit; Task 2 is a single `feat(11-02)` commit.

### Auto-fixed issues

None - plan executed as written otherwise.

**Total deviations:** 1 process note. **Impact:** none on behavior.

## Issues Encountered

None beyond a shell quoting hiccup while appending the new test cases (the append was redone from a scratch file; no repo state was affected).

## Known Stubs

None.

## Threat Flags

None. No new network endpoint or input path: only pure functions and a one-line stricter gate in the existing import path. T-11-05 (partial import of a wrapper with an invalid part) is mitigated: every invalid part returns null, covered by the 20-variant rejection list in the wrapper unit case, and the cloud entry does not let the new kinds through yet.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-03 (cloud import of the two new kinds, plan replacement and upload).

## Self-Check

Modified files exist (all five); commit `f9606f7` is an ancestor of HEAD; APP_SHA256 equals the file hash; the privacy check passed on the commit.

## Self-Check: PASSED

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
