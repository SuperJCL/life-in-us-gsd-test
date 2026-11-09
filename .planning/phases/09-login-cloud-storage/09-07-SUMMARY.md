---
phase: 09-login-cloud-storage
plan: 07
subsystem: sync
tags: [reconcile, dirty-cache, keepConflict, unique-index, first-create-race, idempotency, playwright]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-05 cache and the first reconcile rows; 09-06 timed runs, quiet retries and run identity; 09-03 fault switches (refuse, beforeNext, dropDocs)
provides:
  - reconcile table complete: dirty cache upload, keepConflict hook, recreate from cache, DEFAULT_PLAN/empty-state creation, first-create race recovery
  - keepConflict(kind, serverDoc) hook (empty, returns false) for 09-08
  - uniq() check for 400 validation_not_unique on owner or kind, with one re-read of the list
affects: [09-08, 09-09, 09-10, 09-11, phase-10]

actuals:
  tokens: 3170
  tasks: 2
  commits: 2
plan_head_before: 1a2e4196a2c88268b16e986ade12a741baa9746e
plan_head_after: 52891f592e6f05b1632530b15c3446038c44b0e5

tech-stack:
  added: []
  patterns:
    - "reconcileOnce resolves one kind at a time through resolve(kind) -> { sv, data, c } (network only), then the unchanged single synchronous commit block settles the cache and docs"
    - "a dirty cache whose data equals the server data is adopted silently (no upload, no keepConflict): this keeps a retried run, whose first attempt already uploaded but lost the response, from raising a false conflict"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/reconcile-gate.spec.ts

key-decisions:
  - "Reconcile table, by row: server only -> server; clean cache same updated -> cache; clean cache older than server -> server and a notice; dirty cache with updated equal to base -> upload local (PATCH with data and writer only); dirty cache with a different updated -> keepConflict(kind, serverDoc) then upload local; no server doc -> create from the cache, else from DEFAULT_PLAN / empty state; create hits validation_not_unique -> re-read and continue from the same table with the server doc (no cache: adopt it, write nothing)."
  - "enterApp now hands each cached document to the reconcile on its own (old = { plan: cp, state: cs }); only the UI decision 'show cached content first' still needs both. Without this a lone dirty state cache would have been ignored and its edit lost."
  - "keepConflict is an empty function returning false; the local version wins until 09-08 adds the backup copy and the notice (T-09-17 transferred as planned)."

patterns-established:
  - "Race proof: beforeNext on the first POST seeds both documents for the account, so the app's own create is the one that loses; assert one POST (400), no PATCH, one document per kind"

requirements-completed: []

coverage:
  - id: D1
    description: "An edit kept in the cache after a refused save (status line shows the save-failed text, cache dirty) is uploaded when the app is reopened and the server version is unchanged: server state holds the entry, exactly one PATCH 200, no notice"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 an edit kept in the cache on top of the current server version is uploaded by the reconcile"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two devices creating the first documents at the same time end with one state and one plan document: the app's POST gets 400, it re-reads, adopts the other device's documents, shows no error state, sends no further write"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-01 two devices creating the first documents at the same time end with one state and one plan document"
        status: pass
    human_judgment: false
  - id: D3
    description: "Server documents deleted in the admin while the device has a cache are recreated from the cache: two POST 200, state holds synthetic-a, plan present"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-01 a cached account whose server documents are gone recreates them from the cache"
        status: pass
    human_judgment: false
  - id: D4
    description: "Reloading a synced session twice sends no write (only the plan POST from the first login ever happened) and creates no extra documents"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-01 reloading a synced session twice creates no extra documents and sends no write"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full test:cloud passes (71 cases, flaky 0) and the legacy path is unchanged (SAFE-02, app-integrity, storage, smoke: 22 cases, flaky 0) after both tasks"
    verification:
      - kind: e2e
        ref: "npm run test:cloud (71 passed); npm test over tests/e2e/platform/app-integrity.spec.ts, tests/e2e/storage, tests/e2e/smoke.spec.ts (22 passed)"
        status: pass
    human_judgment: false

duration: "~6 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 07: Reconcile Table Remaining Rows Summary

**The reconcile table is complete: an unsent local edit is uploaded when the server version is unchanged, a keepConflict hook is in place for a newer server version, missing server documents are recreated from the cache, and a lost first-create race (400 validation_not_unique) re-reads the server and converges on one document per kind.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-09T09:12:06Z
- **Completed:** 2026-11-09T09:18:03Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

Where each row of the table lives (all in `reconcileOnce`, `us-journey-tracker.html`, CLOUD branch only):

| Row (ARCHITECTURE Q3) | Implementation |
|---|---|
| server has it, no cache | `resolve()` last return, `data: sv.data` |
| clean cache, same updated | `resolve()` last return, `same(c, sv)` -> cache data |
| clean cache, newer server | same return, server data; `changed` drives the existing notice |
| dirty cache, server unchanged | `resolve()` dirty branch: `coll.update(sv.id, { data, writer })` |
| dirty cache, newer server | same branch, `keepConflict(kind, sv)` first (empty hook, 09-08 fills it) |
| server missing, cache present | `resolve()` create branch with `c.data` |
| neither | create branch with `normalizePlan(DEFAULT_PLAN)` or `normalize({})` |
| create loses the race | `uniq(e)` (400, `owner` or `kind` code `validation_not_unique`), one `getFullList`, continue from the same table |

- Upload failures inside a reconcile go through 09-06's run handling unchanged (quiet retry, 15 s read-only).
- The commit block now always writes a clean cache record and a clean `docs.*` entry, because every dirty cache is resolved by upload or by adopting identical server data.
- Request shapes: update sends `{ data, writer }`, create sends `{ owner, kind, data, writer }`, no query parameters.
- Measured `console.error` counts: the kept-edit case acknowledges exactly 1 (`ERR_CONNECTION_REFUSED`, the refused PATCH); the race case acknowledges exactly 1 (`status of 400 `, the lost create); the other two new cases produce 0.
- Full `npm run test:cloud`: 71 cases (floor 70), all pass, flaky 0. The plan listed 70; one earlier plan added one extra case, as the owner noted.

## Task Commits

1. **Task 1 (tracer): dirty-cache upload, keepConflict hook, kept-edit case** - `6785554`
2. **Task 2: recreate from cache, first-create race recovery, three cases, full test:cloud** - `52891f5`

## Files Created/Modified

- `us-journey-tracker.html` - `reconcileOnce` rewritten around `resolve(kind)`; `keepConflict`; `uniq`; `enterApp` passes each cached document separately
- `tests/support/constants.ts` - `APP_SHA256` updated in each task commit
- `tests/cloud/reconcile-gate.spec.ts` - four new cases (file now 12)

## Decisions Made

See `key-decisions` above. Additional detail: when a dirty cache already equals the server data (for example an earlier attempt uploaded and only the response was lost), the run adopts the server stamp without an upload and without calling `keepConflict`. This is beyond the plan text and removes a false conflict on retry; it does not change any case the plan lists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A lone cached document was dropped from the reconcile**
- **Found during:** Task 1
- **Issue:** `enterApp` set `old` to null for both kinds unless both caches existed, so a dirty state cache without a plan cache would be discarded and its unsent edit lost, against SYNC-05.
- **Fix:** `old = { plan: cp, state: cs }`; `cached` (show cached content first) still needs both.
- **Files modified:** us-journey-tracker.html
- **Verification:** all 09-05 and 09-06 reconcile cases and the new case still pass
- **Committed in:** 6785554

**Total deviations:** 1 auto-fixed (Rule 2). **Impact:** none on any listed case; closes a data-loss gap.

### Execution notes

- One of my own Bash edit attempts (a here-doc with nested backslashes) corrupted the regex in the new test before anything ran; I reverted that file with `git checkout` (only my own uncommitted edit) and redid it with the Edit tool. Nothing was committed from the bad edit.
- Files in the working tree are LF (0 CRLF measured); edits kept LF. Git prints a "LF will be replaced by CRLF" notice on staging for two of the files, which is the repository's existing attribute behavior, not a change from this plan.

## Known Stubs

`keepConflict` is intentionally empty (returns false). It is the documented hook for 09-08, which adds the backup copy and the user notice. Nothing is shown to the user for that case until then. No UI stub.

## Threat Flags

None beyond the register: T-09-16 mitigated (unique index plus re-read, race case shows one document per kind); T-09-17 transferred to 09-08 as planned (local version wins, no backup yet).

## Requirements

None marked complete (plan `requirements` is empty). SYNC-05 is closed by 09-09, SYNC-01 by 09-10; TEST-02 stays Pending.

## Issues Encountered

None in the app. No PocketBase process was started (all tests use the fake server).

## Self-Check: PASSED

- Files exist: us-journey-tracker.html, tests/support/constants.ts, tests/cloud/reconcile-gate.spec.ts.
- Commits 6785554 and 52891f5 are ancestors of HEAD; `plan_head_before..HEAD` count is 2.
- Verify commands: test:cloud reconcile-gate and login 13/13 (Task 1), full test:cloud 71/71 (Task 2), both REPORT OK with flaky 0; app-integrity, storage, smoke 22/22 REPORT OK after each task; staged privacy check passed for both commits; APP_SHA256 equals the file hash; five anchors exactly once; `keepConflict` and `validation_not_unique` present in the app.
