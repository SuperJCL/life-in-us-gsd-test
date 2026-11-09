---
phase: 09-login-cloud-storage
plan: 10
subsystem: testing
tags: [playwright, plan-per-account, cross-device, fake-pocketbase, synthetic-data]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 plan and state documents per account with usePlan/normalizePlan; 09-04 second-device harness (openDevice); 09-09 capacity guard and bulkyState
provides:
  - syntheticPlan(label, groupCount) in tests/support/cloud-data.ts, every plan text carrying SYNTH-<label>
  - PLAN-01 proof that each account sees only its own plan (groups, lift, fit note, preset) and records, with opposite server list order
  - SYNC-01 proof that a log, review, task tick and lift value saved on one device show up in week, calendar, goals and timeline on another device
  - PLAN-01 proof that a plan document failing validation is shown as the default plan and never written back
affects: [09-11, 09-13, 09-14, phase-10]

plan_head_before: a85c44a5b1df830664399368e66c2b7edcb93085
plan_head_after: 94fade31c4a6680cab6ac7d1f717fa8fdc20974e
actuals:
  tokens: 2800
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Negative cross-account assertions use one marker (SYNTH-<label>) that every plan text carries, checked against page.content() so hidden tabs are covered"
    - "Composer actions only on the week tab; switch tabs after the week-view checks"

key-files:
  created:
    - tests/cloud/account-data.spec.ts
  modified:
    - tests/support/cloud-data.ts

key-decisions:
  - "No application change was needed: the reconcile already picks documents by kind (list.find), shows the plan array order, and on usePlan false caches the normalized default with the server updated and never updates or creates the plan document. APP_SHA256 and constants.ts untouched."
  - "Plan-array order and kind lookup are proved by seeding B with state before plan in the list (dropDocs then reseed state) while A has plan before state."

patterns-established:
  - "Two-account cases: app.open({ users: 2 }) then fake.seed per userIndex, then app.login(n); second account on a second device via openDevice"

requirements-completed: [SYNC-01, PLAN-01]

coverage:
  - id: D1
    description: "Each account sees its own groups (in plan order), lift, fit note, preset and records; the page HTML has no marker of the other account; no plan document write; list order reversed between accounts"
    requirement: PLAN-01
    verification:
      - kind: e2e
        ref: "tests/cloud/account-data.spec.ts#PLAN-01 each account sees its own plan and records and none of the other account's content"
        status: pass
    human_judgment: false
  - id: D2
    description: "A record, review, task tick and lift value saved on one device appear in the week, calendar, goals and timeline views of a second device signed in to the same account, following that account's plan"
    requirement: SYNC-01
    verification:
      - kind: e2e
        ref: "tests/cloud/account-data.spec.ts#SYNC-01 records, a review, a task tick and a lift value saved on one device show up in all four views on another device"
        status: pass
    human_judgment: false
  - id: D3
    description: "An invalid plan document (only empty groups) is displayed as the default plan P1-P7, survives a reload, state still saves, and the plan document is never written and stays equal to the seed"
    requirement: PLAN-01
    verification:
      - kind: e2e
        ref: "tests/cloud/account-data.spec.ts#PLAN-01 a plan document that fails validation is shown as the default plan and is never overwritten"
        status: pass
    human_judgment: false
  - id: D4
    description: "Legacy four views and platform checks unchanged: week, calendar, goals, timeline v1 cases, smoke and app-integrity"
    verification:
      - kind: e2e
        ref: "npm test -- tests/e2e/platform/app-integrity.spec.ts tests/e2e/smoke.spec.ts tests/e2e/week tests/e2e/calendar tests/e2e/goals tests/e2e/timeline (77 passed)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 10: Account data and cross-device views Summary

**Per-account plan isolation, cross-device four-view sync and never-overwritten invalid plans proved with synthetic SYNTH-<label> plans on the fake PocketBase, with no application change.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-09
- **Tasks:** 2
- **Files modified:** 2 (one created, one extended)

## Accomplishments
- `syntheticPlan(label, groupCount)` builds a valid plan whose every text (group names, tasks, lift name, fit note, preset) starts with `SYNTH-<label>`, so one negative marker covers the other account's whole plan.
- Tracer case: A (plan listed before state) and B (state listed before plan) each see only their own group ids in order, lift, fit note, `语言` preset and record; the HTML of each page has no marker of the other account; neither plan document was written.
- Cross-device case: log, review, task tick and lift 15 saved on device one are visible on device two in all four views (week log and review, calendar today cell with log and done chips, goals groups `g-a1`, `g-a2` with task done and lift 15, timeline entries for the log and the task).
- Invalid plan case: `{ _synthetic: true, groups: [] }` shows P1-P7, state still saves (one PATCH 200), the display survives a reload, and the plan document stays equal to the seed with no plan writes.
- SYNC-01 and PLAN-01 are closed by this plan.

## Task Commits

1. **Task 1: tracer, two accounts see only their own plan and records** - `115f959` (test)
2. **Task 2: cross-device four views and invalid plan never overwritten** - `94fade3` (test)

**Plan metadata:** the docs commit that follows this summary.

## Files Created/Modified
- `tests/support/cloud-data.ts` - added `syntheticPlan`
- `tests/cloud/account-data.spec.ts` - three cases (per-account plan, four views on another device, invalid plan)

## Decisions Made
- No application change: both tasks began by checking the existing reconcile. Documents are selected with `list.find(d => d.kind === kind)`, groups render in plan array order, and with `usePlan` false the plan is cached as the normalized default with the server `updated` and is never updated or created. `us-journey-tracker.html`, `APP_SHA256` and `constants.ts` were not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test steps used week-tab controls while the goals tab was selected**
- **Found during:** Task 1 (first run) and Task 2 (first full test:cloud run)
- **Issue:** My new cases called the week composer after switching to the goals tab; the composer is hidden there, so the click/fill timed out. The application was correct.
- **Fix:** Reordered the checks (week composer first, then goals) in the per-account case; switched back to the week tab before recording in the invalid-plan case.
- **Files modified:** tests/cloud/account-data.spec.ts
- **Verification:** the three cases pass; full test:cloud and the legacy view run pass.
- **Committed in:** 115f959 and 94fade3

**2. [Run count] Two full test:cloud runs instead of one**
- The first full run (81 passed, 1 failed) failed only on the test bug above, so the full suite was rerun once after the fix. The plan allows one full suite; the second run is the reported result.

---

**Total deviations:** 1 auto-fixed (Rule 1, test code), 1 extra full-suite run
**Impact on plan:** None on scope; the application and assertions were not weakened.

## Issues Encountered
- Full test:cloud ran 82 tests (floor was 81); `--min-expected` is a minimum and earlier plans added more cases than planned.
- Git warns that LF will be converted to CRLF on the next touch (core.autocrlf); pre-existing repository configuration, both files were left LF as in their sibling files.

## Verification Results
- `npm run test:cloud` (full): 82 passed, REPORT OK, `--min-expected 81`, includes all seven named titles.
- Legacy run (app-integrity, smoke, week, calendar, goals, timeline, default config, 1 worker): 77 passed, REPORT OK, `--min-expected 77`, includes SAFE-02, WEEK-01, CAL-01, GOAL-01, TL-01.
- Staged privacy check passed for both commits (rule D: 68 plan terms loaded).

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- SYNC-01 and PLAN-01 are complete; the next plans (09-11 onward) can rely on `syntheticPlan` for per-account plan cases.

## Self-Check: PASSED

- tests/cloud/account-data.spec.ts: FOUND
- tests/support/cloud-data.ts (syntheticPlan): FOUND
- Commits 115f959 and 94fade3: FOUND in HEAD history

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
