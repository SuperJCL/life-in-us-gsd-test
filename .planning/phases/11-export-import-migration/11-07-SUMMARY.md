---
phase: 11-export-import-migration
plan: 07
subsystem: import
tags: [import, legacy-path, N3, B2, test-flip, known-bugs, playwright]

requires:
  - phase: 11-export-import-migration (11-01..11-06)
    provides: classifyBackup, IMPORT_MAX and T_IMP_TOO_BIG, cloudImport with summary confirm, applyImport with undo copy
provides:
  - "onImportFile(input): the one import entry for both versions (size cap, read, parse, classifyBackup, finally clears the file box)"
  - "legacyImport(b): the legacy replace (native confirm with its old text, commit([\"import\"]) whole-state replace, renderAll, toast 已恢复); plan-only file refused with T_IMP_PLAN_LOCAL"
  - "cloudImport(b) narrowed to gate + me check + summary confirm + capacity check + applyImport"
  - "B2 and N3 flipped to normal assertions (IO-10, IO-07) in tests/e2e/io/import.spec.ts; known-bugs.spec.ts removed; KNOWN-BUGS.md has a 已修复 section"
affects: [11-08, 11-09, 11-10, 11-11]

actuals:
  tokens: 7150
  tasks: 2
  commits: 2
plan_head_before: ee24e0085ba755579b0c34db0a08e498edeb4b02
plan_head_after: fc5bdf3bb6b92575ef5b75db7cc482ccf047c74f

tech-stack:
  added: []
  patterns:
    - "one entry, one finally: the file box is cleared in a single finally around size check, read, classify and the version-specific replace, so every outcome (accepted, cancelled, refused, gated) clears it"
    - "toast time by version: the cloud branch passes 4000, the legacy branch passes nothing (keeps the v1 1800 ms and plain style)"
    - "flip = delete the knownBug call, keep the expected assertion verbatim, move the case to the feature spec, move the registry row to a list in a fixed section"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/e2e/io/import.spec.ts
    - tests/e2e/platform/probes.spec.ts
    - tests/e2e/security/state-validation.spec.ts
    - tests/KNOWN-BUGS.md
  deleted:
    - tests/e2e/io/known-bugs.spec.ts

key-decisions:
  - "legacy replace goes through commit([\"import\"], whole-state replace of the live state) instead of the old state=s reassignment; in the legacy version commit is just takeRemote (no-op), fn, persist"
  - "the CLOUD gate (no account or body gate set) is checked in onImportFile before the size toast, so a gated cloud page stays silent exactly as cloudImport was before; cloudImport re-checks after its await"
  - "the legacy new-format test compares plan structure (group codes and built-in task ids), not progress: importing records changes progress and custom to-dos, which are records"

patterns-established:
  - "D-10 legacy path changes are limited to three: full backup replaces records only, plan-only file refused with its own toast, 5 MB cap"

requirements-completed: [IO-07, IO-10, TEST-03]

coverage:
  - id: D1
    description: "Legacy path rejects {}, [], null, wrong-typed objects, objects without a known field and non-JSON with the format error: no confirm, nothing saved, data unchanged (same recognition as the cloud version)"
    requirement: IO-07
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-07 importing an empty JSON object is rejected with the format error (N3 fixed)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-04 files that are not a backup show the format error, ask nothing and save nothing"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-07 a minimal backup with one known field still reaches the import confirm"
        status: pass
    human_judgment: false
  - id: D2
    description: "The file box is cleared after success, cancel and refusal on both paths, so the same file can be chosen again"
    requirement: IO-10
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-10 the file input is cleared after cancelling the import confirm (B2 fixed)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-8 re-selecting the same file with setInputFiles after a cancelled import"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-10: legacy path takes a new-format full backup (records only, own plan kept), refuses a plan-only file with its own message, refuses a file over 5 MB before reading it"
    requirement: IO-07
    verification:
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-07 the legacy version imports the records of a new-format backup and keeps its own plan"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-07 the legacy version refuses a plan-only file with its own message"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-07 the legacy version refuses a file over 5 MB before reading it (D-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "TEST-03: N3 and B2 test.fail cases flipped with expected assertions unchanged; registry rows moved to the fixed section and the BUG-01 guard still passes"
    requirement: TEST-03
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/known-bugs-registry.spec.ts#BUG-01 every known-bug test is registered in tests/KNOWN-BUGS.md and every registered title exists"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cloud import is unchanged after the shared entry (full cloud suite 183 cases)"
    requirement: IO-07
    verification:
      - kind: e2e
        ref: "npm run test:cloud (183 passed, REPORT OK)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 07: Legacy Import, N3 and B2 Fixed Summary

**Both versions now import through one `onImportFile` (size cap, classifyBackup, a single finally that clears the file box), so `{}`-like files are refused before any confirm and a cancelled import can be retried; v1's N3 and B2 `test.fail` cases are flipped to normal assertions with the expected assertions untouched.**

## Performance

- **Duration:** about 20 min of execution (commits 23:17 and 23:21 local on 2026-11-10; the full cloud and default suites took 4.7 and 3.4 min)
- **Completed:** 2026-11-11T07:21Z
- **Tasks:** 2
- **Files modified:** 7 changed, 1 deleted

## Accomplishments

- `onImportFile(input)` replaces the body of the `#importJson` change listener: it checks the file, gates the cloud page (no account or body gate -> silent return), applies `IMPORT_MAX` (both paths, D-10), reads and parses, runs `classifyBackup`, and dispatches to `cloudImport(b)` or `legacyImport(b)`. The only `input.value=""` is now in its `finally` (B2). The old end-of-onload reset is gone (`grep -oF 'e.target.value=""'` = 0).
- `legacyImport(b)`: plan-only file -> `toast(T_IMP_PLAN_LOCAL)`; otherwise `normalize(b.state)` under the sample plan, the native `confirm("用备份文件替换当前所有内容？")` (exact text, still once in the file), `commit(["import"], whole-state replace)`, `renderAll()`, `toast("已恢复")` with no duration (1800 ms, no `data-cloud`). No summary, no copy of the data before, no undo (D-09).
- N3 fixed: `{}`, `[]`, `null`, wrong-typed objects, `{ _synthetic: 'SYNTH' }` and a bare plan-shaped object are refused with the unchanged format toast; the replaced control case proves a one-field minimal backup still reaches the confirm.
- Flipped, extended and new cases; PROBE-8 now pins `valueShape` to `empty`; `state-validation.spec.ts` asserts `classifyBackup` rejects the five named inputs (and sees `{ logs: [] }` as legacy).
- `tests/KNOWN-BUGS.md`: B2 and N3 rows removed from the registry table in the same commit as the `knownBug` calls; new `## 已修复` section (list form); the milestone-end status lines point to it (Task 2).

## v1 case flip table

| Before (tests/e2e/io/known-bugs.spec.ts) | After (tests/e2e/io/import.spec.ts) |
|---|---|
| `BUG-01 B2 control: cancelling the import confirm shows the confirm text and leaves the data unchanged` | `IO-10 cancelling the import confirm shows the confirm text and leaves the data unchanged` |
| `BUG-01 B2 reset path: the file input is cleared after a file that is not JSON` | `IO-10 the file input is cleared after a file that is not JSON` |
| `BUG-01 B2 expected: the file input is cleared after cancelling the import confirm` (knownBug B2) | `IO-10 the file input is cleared after cancelling the import confirm (B2 fixed)` (assertion verbatim, no knownBug) |
| `BUG-01 N3 expected: importing an empty JSON object is rejected with the format error` (knownBug N3) | `IO-07 importing an empty JSON object is rejected with the format error (N3 fixed)` (assertion verbatim, no knownBug) |
| `BUG-01 N3 control: importing an empty JSON object reaches the import confirm` | replaced by `IO-07 a minimal backup with one known field still reaches the import confirm` |

New cases: `IO-07 the legacy version imports the records of a new-format backup and keeps its own plan`, `IO-07 the legacy version refuses a plan-only file with its own message`, `IO-07 the legacy version refuses a file over 5 MB before reading it (D-10)`. The extended `IO-04 files that are not a backup show the format error, ask nothing and save nothing` now covers 9 files (6 malformed + `{}` + marker-only object + bare plan).

**Native dialog dependence (D-09):** the v1 cases that depend on the native confirm are unchanged and still pass: import.spec.ts (answerNextDialog/recordDialogs/CONFIRM_IMPORT), stable-ids.spec.ts, id-whitelist.spec.ts (recordDialogs), PROBE-8; the legacy path keeps the native confirm.

## Task Commits

1. **Task 1: shared import entry, legacy replace, N3 and B2 flipped, registry moved** - `2e9f91e` (feat)
2. **Task 2: KNOWN-BUGS.md status lines point to the fixed section; full default suite** - `fc5bdf3` (docs)

**Plan metadata:** recorded in the final docs commit.

TDD note: the plan puts the app change, the flipped tests and the registry move in one commit (the BUG-01 guard checks both ways), so there is no separate RED commit. RED evidence is v1's own: the flipped cases were `test.fail` cases that passed only while N3 and B2 reproduced (Phase 5, 05-04). The new D-10 cases and the extended rejection case were written against the new behavior and run green on the first full pass except one test-side fix (below).

## Files Created/Modified

- `us-journey-tracker.html` - `onImportFile`, `legacyImport`, narrowed `cloudImport`, `T_IMP_PLAN_LOCAL`, listener calls `onImportFile`
- `tests/support/constants.ts` - APP_SHA256 re-recorded
- `tests/support/strings.ts` - `TOAST_IMPORT_PLAN_LOCAL`
- `tests/e2e/io/import.spec.ts` - flipped/extended/new cases
- `tests/e2e/io/known-bugs.spec.ts` - deleted (`git rm`)
- `tests/e2e/platform/probes.spec.ts` - PROBE-8 `valueShape` is `empty`
- `tests/e2e/security/state-validation.spec.ts` - `classifyBackup` assertions
- `tests/KNOWN-BUGS.md` - registry rows removed, 已修复 section, status lines

## Decisions Made

See key-decisions: legacy replace through `commit`, the cloud gate before the size toast, and the plan-structure comparison in the legacy new-format test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The new legacy new-format test asserted the whole goals read-back and a too-wide text locator**
- **Found during:** Task 1 verify
- **Issue:** the test compared `readGroups` before and after the import, but the import legitimately changes progress counts and adds the backup's custom to-do (records, not plan); a second assertion searched `#goals` for any text starting `SYNTH-lgn`, which also matches the backup's own custom to-do
- **Fix:** compare plan structure only (group codes and built-in task ids) and search for the plan-only texts (`group`, `task <n>`, `lift`)
- **Files modified:** tests/e2e/io/import.spec.ts
- **Verification:** targeted run 50 passed, REPORT OK; folded into the Task 1 commit
- **Committed in:** 2e9f91e

---

**Total deviations:** 1 auto-fixed (1 test-side bug in a new case). **Impact on plan:** none on the app or the plan's assertions; no flipped assertion was weakened.

## Issues Encountered

None beyond the deviation above. The out-of-scope docs (PROBE-8 conclusion in `tests/PROBES.md`, B2 and N3 notes in `tests/README.md`) still name `tests/e2e/io/known-bugs.spec.ts` and the old behaviour; they move to 11-11 as the plan says.

## Verification Results

- Task 1 targeted default run (io, probes, state-validation, id-whitelist, stable-ids, backup-format, known-bugs-registry, app-integrity): 50 passed, REPORT OK, all named titles present, BUG-01 and SAFE-02 green.
- Task 1 full `npm run test:cloud`: 183 passed, REPORT OK, `--min-expected 183`, three named cloud import titles present.
- Task 2 `npx --no playwright test --list`: **184 tests in 40 files**; full default `npm test`: **184 passed, REPORT OK** (`--min-expected 184`), BUG-01, SAFE-02 and the N3-fixed title present.
- Staged privacy check passed on both commits. Commit-time deletion check: only `tests/e2e/io/known-bugs.spec.ts` (intended).

## Hand-offs for later plans

- **Totals after 11-07:** default 184 (was 181 after 11-06; +3 legacy cases; flips and the control replacement keep the count), cloud 183 (unchanged).
- **Legacy path entry point:** `$("importJson")` change -> `onImportFile(input)` -> `classifyBackup` -> `legacyImport(b)` when not `CLOUD`. 11-08's browser-download export and any later import work should extend `onImportFile`, not add a second listener.
- **Moved to 11-11 (tests/README.md and PROBES.md):** README B2 and N3 notes (still say two control cases and point at the deleted `tests/e2e/io/known-bugs.spec.ts`), PROBES.md PROBE-8 conclusion (value now empty after cancel), README test count and flip list. The v1 case flip table above is the source for that.
- **IO-08 on the legacy path** is owner-waived (D-09); verify it against the cloud version only (11-01, 11-03, 11-06).
- **KNOWN-BUGS.md:** the registry table no longer has B2 or N3; the BUG-01 guard still requires `B1`, `N1` in specs.

## Next Phase Readiness

Ready for 11-08. The shared import entry is stable and covered by both suites.

## Self-Check: PASSED

- `tests/e2e/io/known-bugs.spec.ts` absent; `tests/e2e/io/import.spec.ts`, `tests/KNOWN-BUGS.md`, `us-journey-tracker.html` present.
- Commits `2e9f91e` and `fc5bdf3` are ancestors of HEAD.

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
