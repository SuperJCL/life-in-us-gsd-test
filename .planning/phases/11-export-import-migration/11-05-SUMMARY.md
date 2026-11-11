---
phase: 11-export-import-migration
plan: 05
subsystem: sync-import
tags: [import, sync, two-tabs, storage-event, plan-adoption, playwright, cloud]

requires:
  - phase: 11-export-import-migration (11-03, 11-04)
    provides: applyImport writes the dirty plan cache before the state cache; syncOnce uploads a dirty plan before the state
  - phase: 10-offline-realtime-sync
    provides: adoptTab, pending remote slot, docAfter/normUnder, plan first then state, 10-09 two-tab convergence (no ping-pong)
provides:
  - "adoptPlanTab(rec): another tab's plan cache record goes into pendRemote.plan before its state record is adopted"
  - "storage event plan branch: this account and this page's plan document id only, not during a startup reconcile, then requestSync(\"tab\") as before"
  - "1 cloud case: an import in one tab reaches the other tab of the same browser without losing progress of the new plan"
affects: [11-06, 11-07, 11-11]

actuals:
  tokens: 2580
  tasks: 1
  commits: 1
plan_head_before: 6e370caac13cdc00a4b856c4ea7639c4504621c3
plan_head_after: 3cb7e8298a085b4b93f8b4f1b127720658d64522

tech-stack:
  added: []
  patterns:
    - "another tab's plan is adopted through the same waiting slot as a server plan; the cache is never written back from a storage event"
    - "plan first, then state also across tabs: the plan record arrives before the state record, and docAfter normalizes the state under pendRemote.plan"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/import-sync.spec.ts

key-decisions:
  - "adoptPlanTab only runs for a record with a valid plan (normalizePlan returns an object); anything else keeps the old behavior of just asking for a sync"
  - "A clean record whose content is already the working plan, with nothing waiting in pendRemote.plan, changes nothing; a dirty record always sets the dirty flag here too so the same plan is uploaded if the other tab closes first"
  - "No new strings: the existing remote-update notice is reused (the 'other devices' wording is imprecise for two tabs of one browser, left as the plan says)"

requirements-completed: []  # IO-08 is also declared by later plans of this phase; requirements.ready-ids reported it blocked, so it was not marked complete

coverage:
  - id: D1
    description: "A tab that imports a backup with a new plan: the other tab of the same browser shows the new plan with the progress of its tasks, and every state write the server receives keeps that progress"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-sync.spec.ts#IO-08 an import in one tab reaches the other tab of the same browser without losing progress of the new plan"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Phase 10 two-tab behavior is unchanged (offline edits in two tabs, duplicated tab writer id) and the full cloud suite stays green after a change to the sync core"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-06 two tabs editing offline at the same time keep each other's edits after one tab is closed"
        status: pass
      - kind: e2e
        ref: "tests/cloud/writer-id.spec.ts#SYNC-02 a duplicated tab gets its own writer id and a reload keeps it"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-11-10
status: complete
---

# Phase 11 Plan 05: Two tabs and plan adoption Summary

**Another tab of the same browser now takes the plan an import wrote into the shared cache (adoptPlanTab) before it takes the imported state, so the progress of the new plan's tasks is no longer dropped as orphans and uploaded.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-11-10
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Bug confirmed first (RED): with the old code the other tab adopted the imported state under the old plan, and a state write with empty `tasks` reached the server (the planned assertion failed: expected the three `t-` progress ids, received `[]`).
- `adoptPlanTab(rec)` (placed right after `adoptTab`): returns at once during a startup reconcile (`run&&run.live`) or when `normalizePlan(rec.data)` is not a plan; does nothing for a clean record that equals the working plan with nothing waiting; otherwise sets `pendRemote.plan={data:rec.data,updated:rec.base}`, `docs.plan.base=rec.base`, `docs.plan.dirty=!!rec.dirty`, `docs.plan.seq+1`, recomputes `remoteView=remoteDiffers()` (clears the slot again when nothing differs), refreshes the status line and calls `maybeApplyView()`. It never writes the plan cache (no ping-pong).
- Storage event, plan branch: the new value is parsed; for an object record with `data` whose `id` equals `docs.plan.id` it calls `adoptPlanTab(pr)`; in every case `requestSync("tab")` still follows. A key of another account never reaches here because the cache key carries the account id. The comment block above the listener explains why the plan comes before the state (the importing tab writes the plan cache before the state cache, events arrive in that order, and `adoptTab` then normalizes under the waiting plan via `docAfter`).
- New cloud case in `tests/cloud/import-sync.spec.ts` (2 tabs of one context, `login: 'session'` for the second, real timers, polls up to 15 s): tab B shows 2 goal groups with exactly the three imported done ids, its state cache holds them, the server holds the new plan and all progress, both status lines read synced, and after a 1.5 s settle every state write the fake server received since the import contains the three progress ids.
- The import-sync spec now imports `AppHarness` as a value (was a type import) and `gotoGoals`/`readGroups` from `tests/support/goals`.

## Task Commits

1. **Task 1: adoptPlanTab and the storage event plan branch, with the two-tab cloud case** - `3cb7e82` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

RED was observed (case failed on the planned assertion before the app change) but not committed separately; one feat commit per task, as in 11-01..11-04.

## Files Created/Modified

- `us-journey-tracker.html` - `adoptPlanTab`, storage listener plan branch, updated comment
- `tests/support/constants.ts` - APP_SHA256 re-recorded (`d5d91343...`)
- `tests/cloud/import-sync.spec.ts` - the two-tab case (7 cases in the file now)

## Decisions Made

See key-decisions. No new decision beyond the plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- One transient failure: in the first fast-feedback run of the three specs (import-sync, offline-sync, writer-id) the new case failed on its first attempt and passed on the retry (reported as flaky), while the machine was visibly slower (1.3 min for 25 cases against 40 s later). The failure message was lost when the next run cleared test-results/. The same case then passed 6 of 6 alone, 3 of 3 repeated with the whole import-sync spec, and in a second three-spec run with `--retries=0` (25 passed). The official full cloud run reported flaky 0. If it ever shows up as flaky again, the 15 s polls and the 1.5 s settle are the first things to look at.

## Verification

- Fast feedback (not acceptance): import-sync + offline-sync + writer-id with `--retries=0`: 25 passed.
- Full cloud suite (`npm run test:cloud`, no spec arguments, below-normal priority, 1 worker): 175 passed in 4.0 min; `check-report --min-expected 175` with the new title, the six 11-04 import-sync titles, SYNC-06 two tabs and SYNC-02 duplicated tab: `REPORT OK expected=175 flaky=0 unexpected=0`. Total: 158 + 4 (11-01) + 4 (11-03) + 8 (11-04) + 1 (this plan) = 175.
- Default config: app-integrity + tests/e2e/io: 23 passed, `REPORT OK`, SAFE-02 present. The default-config total is unchanged at 181 (the new case is cloud-only).
- Anchors present exactly once each; APP_SHA256 equals the file's sha256; privacy check printed 隐私检查通过 for the commit.

## Hand-offs for later plans

- `adoptPlanTab(rec)` shape: `rec` is the parsed plan cache record `{id, base, dirty, seq, data}` of this account whose `id` equals `docs.plan.id`. It hooks into the `window` `storage` listener (immediately before `adoptTab`), in the branch for `cacheKey("plan")`; the branch then still calls `requestSync("tab")`.
- Slot contract: it fills `pendRemote.plan` and moves `docs.plan.base/dirty/seq`; the state record that follows is normalized under it by `docAfter()`/`normUnder`; `takeRemote()` takes both in, plan first.
- Test helpers: no new exports. The case reuses `AppHarness`, `syntheticPlan`, `legacyBackup`/`fullBackup`, `gotoGoals`/`readGroups`, `importAndConfirm` (local to import-sync.spec.ts), `app.fake.writes`/`lastPlan`/`lastState`.
- Totals after this plan: cloud 175, default 181.
- Known imprecision kept on purpose: the other tab's idle notice says "已更新为其他设备上的最新内容" (existing Phase 10 wording).

## Known Stubs

None.

## Threat Flags

None. The change only reads a cache record of this account and this plan document id; the threat register entries T-11-11 and T-11-12 are mitigated as planned (progress kept by the case; foreign accounts and documents ignored, startup reconcile skipped).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-06. IO-08 stays open in REQUIREMENTS.md until the last plan that declares it has a summary.

## Self-Check: PASSED

- Files found: us-journey-tracker.html, tests/support/constants.ts, tests/cloud/import-sync.spec.ts
- Commit found: 3cb7e82

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-10*
