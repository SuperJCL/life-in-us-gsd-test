---
phase: 11-export-import-migration
plan: 01
subsystem: io
tags: [import, backup, confirm-dialog, pocketbase-sync, playwright]

requires:
  - phase: 07-id-plan-extraction-stable-ids-escaping
    provides: importProblem / normalize / usePlan deep validation, stable ids, orphan-progress drop
  - phase: 09-login-cloud-storage
    provides: confirmBox dialog, cloud toast convention, UI-SPEC tone
  - phase: 10-offline-realtime-sync
    provides: commit / ops / opsOk, pendRemote slot, takeRemote, docAfter
provides:
  - "Cloud import of an original-Artifact legacy backup: classify, summary confirm, takeRemote then commit replace, upload"
  - "Pure functions LEGACY_KEYS, legacyShape, classifyBackup, backupCounts, importPreview (reusable by the 11-10 migration script)"
  - "confirmBox optional warn field and p.cf-warn highlighted line"
  - "Test helpers confirm.ts (readConfirm, confirmOk, confirmCancel) and backup-files.ts (legacyBackup)"
affects: [11-02, 11-03, 11-04, 11-07, 11-10, 11-11]

plan_head_before: d5d9eeb4966ea4bc1eeb742f1bbce0c88816fa63
plan_head_after: 27f755a39b07a7e18b79730458c6a631ea0ecfb9

actuals:
  tokens: 7200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Import reaches working state only via takeRemote() then commit([\"import\"], run); run reads a pre-normalized JSON string from its closure and never calls normalize"
    - "File input is cleared in finally on every cloud import outcome"

key-files:
  created:
    - tests/support/confirm.ts
    - tests/support/backup-files.ts
    - tests/cloud/import.spec.ts
    - tests/e2e/data/backup-format.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts

key-decisions:
  - "classifyBackup refuses every object that has a format key until 11-02 Task 1 (owner confirms the new-format field names)"
  - "importLines returns {lines, warn} (not a bare array) so cloudImport can pass warn to confirmBox"
  - "Task 2 was executed as one commit (plan constraint: one commit per task); RED was run and observed locally before implementing, not committed separately"

requirements-completed: []  # IO-07, IO-08, IO-09, IO-10 are declared by later plans of this phase too; requirements.ready-ids does not report them ready yet

coverage:
  - id: D1
    description: "Cloud import of a legacy backup asks first, replaces only the records, keeps the plan and uploads the normalized content"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 importing a legacy backup in the cloud version asks first, replaces the records, keeps the plan and uploads to the server"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cancelled import changes nothing and the same file can be chosen again; file box cleared on every outcome"
    requirement: IO-10
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-10 cancelling the cloud import leaves the data unchanged and the same file can be chosen again"
        status: pass
    human_judgment: false
  - id: D3
    description: "Non-backup files ({}, [], non-JSON, format key) are refused with the format toast, no dialog, nothing written"
    requirement: IO-07
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-07 the cloud version rejects an empty JSON object with the format error and changes nothing"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/backup-format.spec.ts#IO-07 classifyBackup accepts a legacy state with at least one well-typed field and rejects empty, array, wrong-typed and unagreed wrapper objects"
        status: pass
    human_judgment: false
  - id: D4
    description: "Summary counts (records and date range, review weeks, done tasks, strength entries) and dropped-progress highlighted line (D-07)"
    requirement: IO-08
    verification:
      - kind: unit
        ref: "tests/e2e/data/backup-format.spec.ts#IO-08 backupCounts and importPreview count records, weeks, done tasks, strength entries and dropped progress"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 progress that matches no task of the current plan is highlighted in the summary and dropped on import (D-07)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual look of the highlighted summary line and the dialog in light and dark themes"
    verification: []
    human_judgment: true
    rationale: "No test judges colour contrast or layout of the new p.cf-warn line; the owner checks it in real Edge at phase acceptance (D-08)"

duration: ~12min active (session interrupted once by an API login expiry)
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 01: Cloud import of a legacy backup Summary

**Cloud version now imports the original Artifact's bare-state backup: classify, summary confirm (with a highlighted dropped-progress line), takeRemote then commit replace of the records only, plan untouched, uploaded through the normal sync path.**

## Performance

- **Started:** 2026-11-11T04:48:42Z
- **Completed:** 2026-11-11T04:57Z (plus the interruption gap)
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Tracer (Task 1) proven end to end, page to fake server: import entry no longer hidden in the cloud version; `cloudImport` always clears `#importJson` in `finally` (IO-10, cloud part); rejects with toast and no dialog (IO-07, cloud part).
- Task 2: `backupCounts`, `orphans` count in `importPreview`, `confirmBox` `warn` field with `p.cf-warn` style (warning colours from 09-UI-SPEC S8), summary line with review weeks, done tasks and strength entries, dropped-progress highlighted line (D-07).
- The legacy (Claude / localStorage) import branch is untouched except for the single leading `if(CLOUD){cloudImport(e.target);return}` the plan prescribes (D-09); the default-suite legacy and known-bug cases keep their results (the two `test.fail` cases still fail as expected).

## Task Commits

1. **Task 1: tracer, cloud import of a legacy backup** - `e95c5e4` (feat)
2. **Task 2: summary counts, D-07 highlighted line, unit cases** - `27f755a` (feat)

**Plan metadata:** the docs commit that adds this file.

## Hand-offs for later plans

Pure section (between `normalize` and the `saving` banner; `loadAppPure` can evaluate all of them):

- `const LEGACY_KEYS` = `{arrival: string, tasks: isObj, lifts: isObj, reviews: isObj, custom: Array.isArray, logs: Array.isArray, presets: isObj with every value isObj}`.
- `legacyShape(raw) -> boolean`: plain object, no own `format` key, at least one of the seven known fields present, every present one passes its type check.
- `classifyBackup(raw) -> {kind:"legacy", state: raw} | null`: `legacyShape(raw) && importProblem(raw)===null`. Everything else, including every object with a `format` key, returns `null`. 11-02 adds the new-format branch ABOVE the legacy one (the `format`-key refusal lives in `legacyShape`, so the new branch must run before it).
- `backupCounts(s) -> {logs, from, to, reviews, done, liftEntries}` on an already normalized state (`from`/`to` are `""` with no logs; `reviews` counts trimmed non-empty weeks; `done` counts `tasks[*].done===true`; `liftEntries` sums `hist` lengths, non-array counts 0).
- `importPreview(b, cur) -> {state, counts, current, orphans}`: `state = normalize(b.state)` under the current plan and `keepOrphans`; `counts = backupCounts(state)`; `current = cur.logs.length`; `orphans` = file task keys with object values minus keys left after normalize (0 when `keepOrphans` is true). Pure with respect to `cur` and the file.

Cloud section (after `confirmBox`):

- `importLines(b, pv) -> {lines: string[], warn: number[]}` (NOT a bare array; `warn` holds indexes of lines to highlight). Legacy order: `T_IMP_KIND_LEGACY`, `T_IMP_REPLACE_LEGACY`, `T_IMP_LOGS`, `T_IMP_MORE`, `T_IMP_NOW`, then `T_IMP_ORPHAN_LEGACY(n)` (highlighted) only when `pv.orphans>0`.
- `async cloudImport(input)`: try/finally with `input.value=""`; returns silently with no file, no `me`, or `body[data-gate]` set; parse failure or `classifyBackup===null` -> `toast(T_IMP_BAD,null,4000)`; `confirmBox({title:T_IMP_TITLE, ...importLines(b,pv), cancel:T_IMP_NO, ok:T_IMP_YES})`; after the await it re-checks `sessionEpoch`, `me`, gate; then `applyImport(b)`.
- `applyImport(b)`, synchronous, in this order: `takeRemote()`; `remoteView=false; hideBar("remote")`; `J=JSON.stringify(importPreview(b,state).state)`; `commit(["import"], s=>{delete all keys; Object.assign(s, JSON.parse(J))})`; `opsOk=false`; `renderKeep()`; `toast(T_IMPORTED,null,4000)`.
- `confirmBox(o)` takes optional `o.warn` (array of line indexes) -> those `<p>` get class `cf-warn`; style `#cf-body p.cf-warn` (ink text, `--c-job-s` background, 3px `--c-job` left border).

Text constants in the app: `T_IMP_TITLE`, `T_IMP_NO`, `T_IMP_YES`, `T_IMP_BAD`, `T_IMP_KIND_LEGACY`, `T_IMP_REPLACE_LEGACY`, `T_IMP_LOGS`, `T_IMP_NOW`, `T_IMP_MORE`, `T_IMP_ORPHAN_LEGACY`, `T_IMPORTED`. Mirrored in `tests/support/strings.ts`: `CONFIRM_IMPORT_TITLE`, `BTN_IMPORT_CANCEL`, `BTN_IMPORT_OK`, `IMPORT_KIND_LEGACY`, `IMPORT_REPLACE_LEGACY`, `importLogsLine`, `importMoreLine`, `importCurrentLine`, `importOrphanLegacyLine`, `TOAST_IMPORTED` (`TOAST_IMPORT_BAD_FORMAT` reused).

Test helpers:

- `tests/support/confirm.ts`: `readConfirm(page) -> {title, lines, warn}` (waits for `dialog#confirm` open), `confirmOk(page)`, `confirmCancel(page)` (both wait for close).
- `tests/support/backup-files.ts`: `legacyBackup(label, extra?)`; file content: 2 logs (2026-03-17 and 2026-02-10), custom task `c-<label>-1` done, `P2-1` done, `bench` with 2 history entries, 1 review, 1 preset; `extra` replaces whole fields.

Test totals after this plan: default suite 178 (`npx --no playwright test --list`; +2 unit cases), cloud suite 162 (+4 import cases). Only the targeted subsets were run this plan (default: app-integrity + io + storage + the new unit file; cloud: import + remote-update + multi-device), all REPORT OK.

## Decisions Made

- `legacyShape` carries the `format`-key refusal; 11-02 must therefore put its `format` branch before `legacyShape` in `classifyBackup`.
- `importLines` returns `{lines, warn}` instead of the bare array the plan sketch implied for Task 1, because Task 2 needs `warn` to reach `confirmBox`; later plans (11-02 and onward) should extend the same object shape.

## Deviations from Plan

### TDD gate note

**1. [Process] Task 2 RED was observed but not committed separately**
- **Why:** the plan's execution constraints fix "one commit per task". The two unit cases were written first and run against the Task 1 app: both failed with `ReferenceError: backupCounts is not defined` (the planned missing feature), then passed after implementation. This is a symbol-missing RED, not an assertion-level RED, and has no `test(11-01)` commit.
- **Impact:** a TDD gate audit will see no `test(11-01)` commit; behavior is covered by the final cases.

### Auto-fixed issues

None - plan executed as written otherwise. The `keepOrphans===true => orphans 0` branch of `importPreview` is not covered by the Node unit case because `loadAppPure` cannot set that module variable; it follows from `normalize` keeping every well-formed key in that case.

**Total deviations:** 1 process note. **Impact:** none on behavior.

## Issues Encountered

The session was interrupted once (API login expired). The working tree was intact; edits were re-checked against the plan (git diff, SHA) and execution resumed.

## Known Stubs

None.

## Threat Flags

None. The new file input path adds no network endpoint; all new text enters the DOM via `textContent`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-02. Open for the owner there: the new-format wrapper field names (one-way decision, 11-02 Task 1).

## Self-Check

Created files exist (confirm.ts, backup-files.ts, import.spec.ts, backup-format.spec.ts); commits `e95c5e4` and `27f755a` are ancestors of HEAD; APP_SHA256 equals the file hash; privacy check passed on both commits.

## Self-Check: PASSED

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
