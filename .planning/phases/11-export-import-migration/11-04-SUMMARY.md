---
phase: 11-export-import-migration
plan: 04
subsystem: sync-import
tags: [import, sync, snapshot, capacity, playwright, cloud]

requires:
  - phase: 11-export-import-migration (11-01..11-03)
    provides: cloudImport/applyImport, plan import, syncOnce plan upload with keepConflict("plan")
  - phase: 10-offline-realtime-sync
    provides: pending remote slot, opsOk=false true-conflict path, IN-05/IN-06 rules
  - phase: 09-login-cloud-storage
    provides: CLOUD_MAX 4 MB, one kept copy per account (D-08..D-11)
provides:
  - "5 MB file limit checked before the file is read; 4 MB cloud limit checked before the confirm and again before applying"
  - "kept copy record {kind,data,told}; unannounced copies of different kinds join into one kind:full copy"
  - "reconcileOnce announces a conflict once after both documents are handled"
  - "6 import-sync cloud cases and 2 import size cases"
affects: [11-05, 11-06, 11-07, 11-11]

actuals:
  tokens: 7600
  tasks: 2
  commits: 2
plan_head_before: 274e9b2dc7d919b62757fe3506728189cec1273e
plan_head_after: eec88054e026f4e82b4fe5b457b2baf66a852451

tech-stack:
  added: []
  patterns:
    - "kept copy carries told; announced copies are replaced, unannounced copies of another kind are merged into a full backup"
    - "one conflict notice per reconcile round, after live()"

key-files:
  created:
    - tests/cloud/import-sync.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/import.spec.ts
    - tests/cloud/conflict-snapshot.spec.ts

key-decisions:
  - "Size limits: IMPORT_MAX=5242880 by File.size before f.text(); CLOUD_MAX 4 MB by UTF-8 bytes of the normalized state or plan"
  - "A Phase 9 kept copy without told counts as announced, so existing copies keep being replaced"
  - "Joined copy is kind:full built with backupOf and withPlan(plan, ()=>normalize(records)), so another device's progress is not dropped"
  - "IN-05, IN-06, state-only and plan-only conflicts needed no app fix"

requirements-completed: [IO-07, IO-08]

coverage:
  - id: D1
    description: "Files over 5 MB are refused before reading; data over the 4 MB cloud limit is refused before the confirm and nothing is uploaded"
    requirement: IO-07
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-07 a file over 5 MB is refused before it is read"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-07 a backup whose data exceeds the cloud limit is refused and nothing is uploaded"
        status: pass
    human_judgment: false
  - id: D2
    description: "Import with a pending remote update replaces it; import over another device's newer state or plan keeps that version as a snapshot"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 an import made while a remote update waits replaces it and uploads the imported data (IN-05)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 an import whose upload meets a newer version from another device keeps that version as a snapshot instead of redoing on it"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 a plan import whose upload meets a newer plan from another device keeps that plan as a snapshot"
        status: pass
    human_judgment: false
  - id: D3
    description: "Plan and records both overwritten in one import (same round or across a retry) stay in one full snapshot that imports back; imported ids stay and the next pull is quiet"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 an import whose plan and records both meet newer versions from another device keeps both in one snapshot that imports back as a full backup"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 a snapshot not yet announced keeps the other device's plan when the records upload has to be retried"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 imported record ids are kept and the next pull shows no remote update (IN-06)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-11-10
status: complete
---

# Phase 11 Plan 04: Import size limits and import vs sync rules Summary

**Import refuses files over 5 MB before reading and data over the 4 MB cloud limit before the confirm, and a plan plus records overwritten by one import now share a single full-backup kept copy that downloads and imports back.**

## Performance

- **Duration:** about 75 min across two executors (the second resumed after an owner decision)
- **Completed:** 2026-11-10
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments

- Limits (Task 1): `IMPORT_MAX=5242880` is checked as `f.size>IMPORT_MAX` before `f.text()`, message "文件太大（超过 5 MB），没有导入" (`T_IMP_TOO_BIG`, `TOAST_IMPORT_TOO_BIG`). The 4 MB cloud limit uses `tooLarge(pv)` over `sizeOf(pv.state)` or `sizeOf(pv.plan)`, checked in `cloudImport` before the confirm and again in `applyImport` after `takeRemote` (it calls `renderKeep` and shows the toast, with no commit); message "数据超过容量上限（4 MB），没有导入" (`T_IMP_TOO_LARGE`, `TOAST_IMPORT_TOO_LARGE`).
- Merged kept copy (Task 2, T-11-08): the record is `{kind,data,told}`. `keepConflict` writes `told:false`. If the existing copy has `told===false` and a different kind, the two join into ONE `kind:"full"` copy whose data is `backupOf(plan, withPlan(plan, ()=>normalize(records)), now)`, again with `told:false`. A Phase 9 record without `told` counts as announced. Same-kind or announced copies are replaced as before (Phase 9 D-09, one key per account). `snapTold()` runs at the end of the success branch of `conflictNotice` and rewrites the copy with `told:true`. `reconcileOnce` records "clashed" and the last `keepConflict` result and calls `conflictNotice` once, after `live()`.
- `snapDownload` is unchanged: a full copy downloads as `计划手记-留底-<date>.json` with the full-backup wrapper, and the new case checks that it imports back (summary first line `IMPORT_KIND_FULL`).
- Cross-round: a plan copy survives a failed state upload; the next round re-joins into the same full copy and announces it once after the successful upload.
- Four cases passed with no app fix: IN-05, state-only conflict, plan-only conflict, IN-06.

## Task Commits

1. **Task 1: 5 MB file limit before reading, 4 MB cloud limit before confirm** - `96e79ac` (feat)
2. **Task 2: sync-rule regression cases and the merged kept copy** - `eec8805` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

RED was observed per task but not committed separately (one feat commit per task, as in 11-01..11-03). Task 2 RED: the two merged-copy cases failed with kind expected `"full"` but received `"state"` before the fix.

## Files Created/Modified

- `us-journey-tracker.html` - IMPORT_MAX, tooLarge checks, told on kept copies, merge in keepConflict, snapTold, single announcement in reconcileOnce
- `tests/support/constants.ts` - APP_SHA256 re-recorded
- `tests/support/strings.ts` - TOAST_IMPORT_TOO_BIG, TOAST_IMPORT_TOO_LARGE
- `tests/cloud/import.spec.ts` - 2 size cases
- `tests/cloud/import-sync.spec.ts` - new, 6 cases (local helpers otherAddsLog, otherWritesPlan, deaf, openManual, importAndConfirm; no new exported helpers)
- `tests/cloud/conflict-snapshot.spec.ts` - owner-approved assertion change (see Deviations)

## Decisions Made

See key-decisions. The only unplanned decision was to merge only when the existing copy is unannounced, which keeps Phase 9 D-09 intact for announced copies.

## Deviations from Plan

### Owner-approved deviation

**1. [Owner decision - unlisted file] Updated one assertion in tests/cloud/conflict-snapshot.spec.ts**
- **Found during:** Task 2 (full cloud suite run)
- **Issue:** `SYNC-05 a conflict whose overwrite reached the server but whose answer was lost keeps the other device version and offers it after the next successful save` failed at `expect(after).toEqual(kept);`. The only difference was `told` going from false to true, which the plan's design requires (the copy is marked announced after the notice).
- **Fix:** The owner approved the edit ("允许按建议改 (Recommended)"). The single line `expect(after).toEqual(kept);` was replaced with:
  ```ts
  expect(kept.told).toBe(false);
  expect(after.told).toBe(true);
  expect(after.kind).toBe(kept.kind);
  expect(after.data).toEqual(kept.data);
  ```
  Nothing else in that file changed.
- **Files modified:** tests/cloud/conflict-snapshot.spec.ts
- **Verification:** the spec alone, then the full cloud suite: 174 passed
- **Committed in:** eec8805

---

**Total deviations:** 1 (owner-approved test assertion change)
**Impact on plan:** The assertion keeps its original intent (the other device's version is kept, unchanged, and offered) and adds an explicit check on the new `told` flag. No app behavior changed beyond the plan.

## Issues Encountered

- The first run of the full suite (before the approved edit) had one failure, the assertion above. After the edit the suite is clean.

## Known Limits

- IN-06 root cause remains: an invalid id already inside a server document gets a fresh random id from `normalize` on every load, so `remoteDiffers` keeps seeing a difference. This phase only guarantees that ids written by an import are valid; normalizing both sides before comparing is out of scope.
- If the server plan itself fails `normalizePlan`, the joined copy still stores the data as received, but importing it back is refused as the wrong format, so it needs a manual check.

## Verification

- Cloud suite: 174 expected, 174 passed, flaky 0, unexpected 0 (`check-report --min-expected 174` plus the plan's 8 required titles: REPORT OK). Totals: 158 + 4 (11-01) + 4 (11-03) + 8 (this plan: 2 in import.spec and 6 in import-sync.spec) = 174. Default config count unchanged at 181.
- SAFE-02 (app-integrity, default config): REPORT OK, 7 passed.
- APP_SHA256 equals the sha256 of `us-journey-tracker.html` (605eb32c...).
- Privacy check printed "隐私检查通过" for both task commits.

## Threat Flags

None. No new network endpoint, auth path or trust-boundary surface beyond the plan's threat register.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-05 (same-browser two-tab plan adoption, which adds one case to `tests/cloud/import-sync.spec.ts`). IO-07 and IO-08 may still be declared by later plans, so their completion is decided by `requirements.ready-ids`.

## Self-Check: PASSED

- Files found: tests/cloud/import-sync.spec.ts, us-journey-tracker.html, tests/support/constants.ts, tests/support/strings.ts, tests/cloud/import.spec.ts, tests/cloud/conflict-snapshot.spec.ts
- Commits found: 96e79ac, eec8805

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-10*
