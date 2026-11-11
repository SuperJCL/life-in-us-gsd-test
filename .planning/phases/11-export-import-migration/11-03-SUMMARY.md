---
phase: 11-export-import-migration
plan: 03
subsystem: io
tags: [cloud-import, plan-upload, syncOnce, keepConflict, full-backup, plan-only, playwright-cloud]

requires:
  - phase: 11-export-import-migration
    provides: "11-02 classifyBackup/backupOf/withPlan/planCounts/importPreview for full and plan-only files, fullBackup/planOnlyFile test builders"
  - phase: 10-offline-realtime-sync
    provides: "syncOnce plan-then-state order, keepConflict single kept copy, dirty/seq rule, pendRemote slot"
provides:
  - "applyImport replaces the working plan (dirty, seq+1, plan cache) and the records in one synchronous run"
  - "planBody() and the plan upload in syncOnce (before the state), with keepConflict(\"plan\", ...) on a real conflict and the usual failure path"
  - "pollTick, showSync and the syncOnce tail know the dirty plan"
  - "importLines and cloudImport handle all three file kinds (legacy, full, plan-only)"
  - "constants T_IMP_KIND_FULL, T_IMP_KIND_PLAN, T_IMP_REPLACE_FULL, T_IMP_REPLACE_PLAN, T_IMP_PLAN, T_IMP_ORPHAN_FILE, T_IMP_ORPHAN_PLAN (mirrored in tests/support/strings.ts)"
affects: [11-04, 11-07, 11-08, 11-09, 11-10, 11-11, 12]

plan_head_before: 2a884af418d7d1d8c4b284e525e595e8f5bd12d1
plan_head_after: a384de24b2ef8aea11e074bc655fcf3a4a57cdcc

actuals:
  tokens: 6600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A dirty plan is uploaded in syncOnce before the state; seq decides whether the dirty flag is cleared; the plan cache keeps the newer data when seq moved during the upload"
    - "applyImport replaces plan and records in one synchronous block (usePlan, docs.plan.dirty, plan cache, then commit with the records already normalized under the new plan)"
    - "importLines branches on the file kind via BK_FULL / BK_PLAN; the legacy branch is unchanged"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/import.spec.ts

key-decisions:
  - "The plan size guard calls sizeCheck only when the plan is over the limit, so a small dirty plan never hides the state's size-warning bar (sizeCheck hides sizewarn below 70 percent)"
  - "A plan that could not be written to the local cache raises the cache-full banner after commit, because persist reports only the state cache and would otherwise hide it"
  - "The plan notice for a kept plan conflict is shown right after the plan upload only when the state is not dirty; otherwise it waits for the state upload (snapPending is consumed once per pass)"

requirements-completed: []  # IO-08 and IO-09 are also declared by later plans of this phase; requirements.ready-ids reported them blocked

coverage:
  - id: D1
    description: "Cloud import of a new-format full backup: summary names plan and records, highlights progress that matches no task of the file's plan, replaces plan and records, uploads plan before state, this device shows the new plan"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 importing a full backup replaces the plan and the records, uploads both and another device shows them (D-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Another signed-in device updates to the imported plan and records while idle"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 importing a full backup replaces the plan and the records, uploads both and another device shows them (D-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A plan upload that fails keeps the plan cache dirty, leaves server plan and state unchanged (no half import), and is retried until the server has both"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 an imported plan that could not be uploaded is retried and reaches the server"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan-only import replaces only the plan, records stay, progress that matches no task of the new plan is highlighted and dropped"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-08 importing a plan-only file replaces the plan and keeps the records (D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Two-step migration (plan-only file first, then the legacy backup) keeps every task progress and shows no highlighted line the second time"
    requirement: IO-09
    verification:
      - kind: e2e
        ref: "tests/cloud/import.spec.ts#IO-09 importing the plan first and then the legacy backup keeps every task progress (D-07)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase 9 and 10 sync, kept copy, reconcile, capacity, session and login cases do not regress after the plan upload was added to syncOnce"
    verification:
      - kind: e2e
        ref: "npm run test:cloud (full suite, 166 cases, REPORT OK, includes SYNC-05 a newer conflict replaces the single kept version and PLAN-01 a plan document that fails validation is shown as the default plan and is never overwritten)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Plan conflict kept copy: a real plan conflict at upload (keepConflict plan before the upload, notice after it) has no dedicated cloud case in this plan"
    requirement: IO-08
    verification: []
    human_judgment: true
    rationale: "The code path follows the state conflict rule exactly but no test drives a plan conflict; 11-04 Task 2 reworks the kept copy (T-11-08) and should add one"

duration: 21 min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 03: Plan upload and full / plan-only cloud import Summary

**The cloud page now imports all three file kinds: a full backup or a plan-only file replaces the plan and records together, the plan is uploaded by syncOnce before the state (with a kept copy on a real conflict and retry on failure), and other devices follow.**

## Performance

- **Duration:** 21 min (2026-11-11T05:10:49Z to 05:32:21Z)
- **Tasks:** 2 (one commit each)
- **Files modified:** 4 (0 created)

## Accomplishments

- **syncOnce plan upload.** Position: right after the plan document is found or created (`psv`), before the existing "newer server plan goes into the slot" test and before any state work. When `docs.plan.dirty`: `pseq` = plan seq, `pbody` = deep copy of `planBody()`; `sizeCheck(pbody)` only when `sizeOf(pbody) > CLOUD_MAX`; real conflict = `psv.updated !== docs.plan.base && psv.writer !== WRITER && canon(psv.data) !== canon(pbody)` (same three tests as the state); on conflict `snapPending = keepConflict("plan", psv)` before the request; `coll.update(psv.id, {data: pbody, writer: WRITER}, sg)`; epoch check; `psv = pu`; `docs.plan.base = pu.updated`; the dirty flag is cleared only if seq did not move; the plan cache is rewritten (data = `pbody` when seq is unchanged, else the newer cached data; `dropCache` when the write fails and the plan is clean). The conflict notice is raised right after the plan upload only when the state was not dirty at the start of the pass; otherwise the existing notice after the state upload consumes `snapPending`. A failed request goes to the common catch: dirty flag untouched, retry scheduled as before.
- **applyImport order** (all synchronous): `takeRemote()` -> `remoteView=false`, `hideBar("remote")` -> `pv = importPreview(b, state)` -> if `pv.plan`: `usePlan(pv.plan)`, `keepOrphans=false`, `docs.plan.dirty=true`, `docs.plan.seq+1`, `cachePut("plan", {...docs.plan, data: pv.plan})` -> `commit(["import"], ...)` with the records from `pv.state` (already normalized under the new plan) -> `opsOk=false` -> cache-full banner if the plan did not reach the cache -> `renderKeep()` -> toast. Legacy files have no `pv.plan`, so that path is unchanged.
- **Sync plumbing.** `planBody()` (cached dirty plan, else working plan); `pollTick` does not pull while the plan is dirty; `showSync` shows "saving" for a dirty plan; the syncOnce tail sets `syncAgain` when either document is dirty.
- **Summary lines.** Full: `T_IMP_KIND_FULL`, `T_IMP_REPLACE_FULL`, logs, more, `T_IMP_PLAN(groups, tasks, lifts)`, now, highlighted `T_IMP_ORPHAN_FILE` when orphans > 0. Plan-only: `T_IMP_KIND_PLAN`, `T_IMP_REPLACE_PLAN`, `T_IMP_PLAN`, now, highlighted `T_IMP_ORPHAN_PLAN`. `cloudImport` only rejects what `classifyBackup` rejects.
- **Texts** (identical in `tests/support/strings.ts` as `IMPORT_KIND_FULL`, `IMPORT_KIND_PLAN`, `IMPORT_REPLACE_FULL`, `IMPORT_REPLACE_PLAN`, `importPlanLine`, `importOrphanFileLine`, `importOrphanPlanLine`): see the constants in the app.

## Task Commits

1. **Task 1: plan upload through syncOnce, full backup import** - `9b0b12e` (feat)
2. **Task 2: plan-only import, two-step migration, full cloud suite** - `a384de2` (feat)

**Plan metadata:** the docs commit that adds this file.

## Files Created/Modified

- `us-journey-tracker.html` - applyImport plan part, planBody, syncOnce plan upload, pollTick/showSync, importLines/cloudImport for all kinds, seven new text constants
- `tests/support/constants.ts` - APP_SHA256 re-recorded in each task (final `APP_SHA256` = hash of the file after Task 2)
- `tests/support/strings.ts` - seven new strings mirrored
- `tests/cloud/import.spec.ts` - four new cloud cases and a small `fullBackupFile()` helper

## Hand-offs for later plans

- **Plan upload path:** `syncOnce` -> block `if(docs.plan.dirty){...}` between the plan find/create and the "server plan into slot" test. Any later plan that makes the plan dirty (11-04 kept-copy import, Phase 12 plan editor) must do what applyImport does: `docs.plan.dirty=true; docs.plan.seq++; cachePut("plan", {...docs.plan, data})`, and call `persist`/`requestSync` (a state commit does this in import; an editor that changes only the plan must call `requestSync("save")` itself because `persist` is a state function).
- **Kept copy:** `keepConflict("plan", psv)` writes the same single `usj:v2:<id>:snapshot`; a plan conflict and a state conflict in one pass still replace each other (T-11-08, 11-04 Task 2 combines them). `snapPending` is consumed once per pass: after the plan upload if the state is not dirty, else after the state upload.
- **Function shapes:** `planBody() -> plan data` (cached dirty plan or `plan`); `importLines(b, pv) -> {lines, warn}` for `b.kind` legacy, `BK_FULL`, `BK_PLAN` (needs `pv.planCounts` for the two new kinds); `applyImport(b)` takes any classified file.
- **Test helpers:** `fullBackupFile()` is local to `tests/cloud/import.spec.ts` (label `fb`: plan groups `g-fb1`, `g-fb2`; state label `fb1`; `P2-1` progress is the one orphan). No new exported helper.
- **Totals after this plan:** default suite 181 (`npx --no playwright test --list`, unchanged), cloud suite 166 (full `npm run test:cloud`, REPORT OK, flaky 0, unexpected 0).

## Decisions Made

- sizeCheck is called for the plan only above the limit (see key-decisions); behavior otherwise as the plan says.
- Cache-full banner for a plan that did not reach the cache is raised after `commit`, since `persist` reports the state cache only.
- The plan notice after a conflict follows the "last upload of the pass" rule from the plan.

## Deviations from Plan

### TDD gate note

**1. [Process] RED observed but not committed separately (both tasks)**
- **Why:** the plan fixes one commit per task, as in 11-01 and 11-02. The new cases were written first and run against the unchanged app: Task 1's two cases failed because `dialog#confirm` never opened (the full backup was still rejected as a format error); Task 2's two cases failed the same way for the plan-only file. These are assertion-level failures of the planned behavior, not syntax or load errors. After the implementation all passed.
- **Impact:** a TDD gate audit finds no `test(11-03)` commit; each task is a single `feat(11-03)` commit.

### Auto-fixed Issues

None - plan executed as written otherwise (two small hardening choices listed under Decisions Made).

**Total deviations:** 1 process note. **Impact:** none on behavior.

## Issues Encountered

- Playwright clears `test-results/` at the start of a run, so a log file written there during the full run was deleted; the JSON report (written at the end) was unaffected and is the evidence used.
- A bash heredoc with long Chinese test text broke once while appending cases; the edit was redone from a script file in the scratchpad (no repo state affected).

## Known Stubs

None.

## Threat Flags

None. No new endpoint or input path: the plan upload uses the existing `journey_docs` update call that the state already uses. T-11-06 is mitigated (conflict test before the upload, keepConflict first, seq-guarded dirty flag, failure keeps dirty; the failure and retry path has a cloud case; the conflict-kept path has no dedicated case, see D7). T-11-07 relies on `normalizePlan` and the existing escaping; the summary lines show only counts. T-11-08 stays open for 11-04 as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-04 (kept copy that combines a plan and a state conflict, T-11-08). 11-04 should also add a cloud case where another device wrote the plan before this device's plan upload (real plan conflict).

## Self-Check

Modified files exist (all four); commits `9b0b12e` and `a384de2` are ancestors of HEAD; APP_SHA256 equals the file hash; the privacy check passed on both commits; full cloud suite REPORT OK expected=166; default `app-integrity` and `tests/e2e/io` REPORT OK including SAFE-02.

## Self-Check: PASSED

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
