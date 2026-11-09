---
phase: 09-login-cloud-storage
plan: 01
subsystem: auth
tags: [pocketbase, sdk-sri, login, journey_docs, playwright, fake-server]

requires:
  - phase: 08-rules-isolation-fake-server
    provides: FakePbServer, cloud test entry, same-origin SDK 0.28.1 pinned by sha256
  - phase: 07-plan-externalization
    provides: USJ_CONFIG seam, normalizePlan, usePlan, normalize with account-plan ordering rule
provides:
  - cloud switch USJ_CONFIG.backend === "pocketbase" (address is location.origin)
  - same-origin SDK loader with pinned SRI, login page S1, per-kind document load and create, cloud save
  - AppHarness cloud options backend and login, submitLogin, login
  - shared syntheticState builder for all cloud specs
affects: [09-02, 09-05, 09-06, 09-07, 09-08, 09-10, 09-11, 09-12, phase-10, phase-13]

actuals:
  tokens: 4565
  tasks: 2
  commits: 2
plan_head_before: 8706d902bbe60593d380b97111eb76b8e6d1e760
plan_head_after: 409a5d6bd0d3e18b2c88ee0b246bfcdd4be408a0

tech-stack:
  added: []
  patterns:
    - "cloud path is a separate branch in init(); the legacy path is untouched byte for byte"
    - "single store for the state document; plan document read by kind and created on first sign-in"
    - "harness init script sets USJ_CONFIG before the app script; Phase 8 specs opt out with backend null"

key-files:
  created:
    - tests/support/cloud-data.ts
    - tests/cloud/login.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/app.ts
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/cloud-harness.spec.ts
    - tests/cloud/probes-cloud.spec.ts
    - tests/cloud/guard-cloud.spec.ts

key-decisions:
  - "Cloud switch convention: window.USJ_CONFIG = { backend: 'pocketbase' } placed before the app script; the client address is always location.origin, so no domain, IP or port is in the repo. Phase 13 deployment supplies the same one-line config (mechanism decided there). Reversible: only readConfig/init and one harness init script read it, so a meta tag or other injection would change those two spots."
  - "SDK_SRI = sha256-lMHgMreDlS9pif90JW7JdEDQ7PDCTtuVdfjIcWywSp8=, recomputed with node from tools/probe/page/vendor/SHA256SUMS (94c1e032...cb04a9f hex converted to base64) and equal to the plan value; static-server still verifies SHA256SUMS at startup."
  - "One store, not makeDocStore(kind) twice: only the state document is saved; the plan document is only read by kind (and created on first sign-in) because plan editing is not in Phase 9, so a second store would have no save caller. Split into a second {label, load, save} store when a later phase saves plans; the interface is unchanged."
  - "Account plan loads before state is normalized (usePlan then normalize), satisfying the Phase 7 orphan-progress hand-off."

patterns-established:
  - "setStatus(t, st): optional second argument sets data-state; omitted removes it, so the legacy path never has data-state"
  - "Cloud login errors use textContent in #login-err; 400 means wrong credentials, anything else means unreachable"

requirements-completed: []

coverage:
  - id: D1
    description: "A configured page shows the login page, signs a synthetic account in, and lands in the app with state status 已同步 and the account records in the week view (ACCT-01 skeleton)"
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 a synthetic account signs in on the login page and lands in the app with its server state"
        status: pass
    human_judgment: false
  - id: D2
    description: "A log recorded on the cloud path is PATCHed to the own state document with only data and writer and the status returns to 已同步 (SYNC-01 skeleton)"
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#SYNC-01 a log recorded on the cloud path is uploaded to the state document with only data and writer"
        status: pass
    human_judgment: false
  - id: D3
    description: "First sign-in creates the synthetic default plan document and an empty state document; goals show P1 to P7 (PLAN-01 empty skeleton)"
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#PLAN-01 a first sign-in creates the state document and a plan document holding the synthetic default plan"
        status: pass
    human_judgment: false
  - id: D4
    description: "An existing session refreshes auth (auth-refresh 200) on reload and does not show the login page again"
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 a signed-in session survives a page reload"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy path and Phase 8 harness specs unchanged: SAFE-02 baseline, three config-seam cases, account and local storage, smoke, and the cloud harness, probe and guard specs"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts, tests/e2e/storage, tests/e2e/smoke.spec.ts (22 passed); tests/cloud login, cloud-harness, probes-cloud, guard-cloud (17 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual fit of the login page (spacing, 44px targets on narrow screens, dark theme) against UI-SPEC S1"
    verification: []
    human_judgment: true
    rationale: "No test asserts the layout or theme rendering of the login page; only structure and behavior are covered. The show-password toggle is structure only here (behavior in 09-12)."

duration: "~7 min (start time not recorded; from STATE.md 08:12:46Z to 08:19:50Z)"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 01: Cloud Tracer Summary

**Cloud path for the single-file app: USJ_CONFIG switch, same-origin PocketBase SDK 0.28.1 with pinned SRI, login page, per-kind document load with first-sign-in creation, auth refresh on start, and PATCH of data and writer only, all proven against the fake server.**

## Performance

- **Duration:** ~7 min
- **Started:** ~2026-11-09T08:13Z (not recorded precisely)
- **Completed:** 2026-11-09T08:19:50Z
- **Tasks:** 2
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- `USJ_CONFIG.backend === "pocketbase"` turns on the cloud path (`CLOUD`, `cloudInit`, `loadSdk`, `showLogin`, `onLogin`, `enterApp`, `cloudSave`); `null` or unset keeps v1 behavior and never requests the SDK; any other value still shows the "存储配置无效" status.
- Login page `#login` per UI-SPEC S1 (no links inside, structure only for the password toggle), 401-only login expiry via `authRefresh`, `autoCancellation(false)`, SDK script with `integrity`.
- First sign-in creates the plan document (`normalizePlan(DEFAULT_PLAN)`) and the state document (`normalize({})`); plan is applied before state is normalized.
- AppHarness cloud mode: `backend` (default pocketbase) and `login` options, `submitLogin`, `login`, cloud-aware `ready()`; Phase 8 harness specs open with `backend: null`; one shared `syntheticState`.
- 4 new cases in `tests/cloud/login.spec.ts`; test:cloud login + Phase 8 harness specs 17 passed, default legacy selection 22 passed, 0 flaky.

## Task Commits

1. **Task 1: tracer (switch, SDK, login, per-kind docs, cloud save)** - `c9d70fa` (feat)
2. **Task 2: first-sign-in document creation and authRefresh on start** - `409a5d6` (feat)

**Plan metadata:** committed after this summary (docs: complete plan)

## Files Created/Modified

- `us-journey-tracker.html` - login markup and CSS, `CLOUD` switch, `setStatus(t, st)`, `/* cloud */` section
- `tests/support/app.ts` - cloud options `backend` and `login`, `submitLogin`, `login`, `installUsjConfig`, new ready conditions
- `tests/support/cloud-data.ts` - `syntheticState(label, extra?)`
- `tests/support/strings.ts` - `STATUS_CLOUD_SYNCED`, `LOGIN_ERR_CREDENTIALS`, `LOGIN_ERR_UNREACHABLE`
- `tests/support/constants.ts` - `APP_SHA256` updated in each task commit
- `tests/cloud/login.spec.ts` - ACCT-01 (2), SYNC-01, PLAN-01 cases
- `tests/cloud/cloud-harness.spec.ts`, `probes-cloud.spec.ts`, `guard-cloud.spec.ts` - explicit `backend: null`; harness spec uses the shared builder

## Decisions Made

See `key-decisions` in the frontmatter: cloud switch convention and reversibility, SRI value and how it was checked, single store instead of `makeDocStore(kind)`, plan-before-state ordering.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both tasks passed their verify commands on the first run (no retries, no flaky cases).

## Known Stubs

None. (The `.pw-toggle` button is intentionally structure only per the plan; its behavior is planned for 09-12. Not recorded in the broken-windows ledger because it is a planned hand-off, not a defect.)

## Threat Flags

None. All new surface (same-origin `/api` calls, same-origin SDK) is covered by T-09-01 to T-09-04 in the plan's threat model. Mitigations in place: SRI-pinned SDK, address from `location.origin`, `cloudSave` sends only `data` and `writer`, login email and errors via `textContent`, privacy check passed on both staged commits.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 09-02 (INFRA-03, remove Google fonts, SDK tamper contrast case, full test:cloud).
- ACCT-01, PLAN-01, SYNC-01 are skeletons only; no requirement is marked complete here (ACCT-01 closes in 09-12, PLAN-01 and SYNC-01 in 09-10). TEST-02 is not marked.
- Concerns: none blocking. Index-conflict handling on simultaneous first sign-in is 09-07; baseline comparison in 09-08; local cache in 09-05.

## Self-Check: PASSED

- Created files exist: `tests/support/cloud-data.ts`, `tests/cloud/login.spec.ts`.
- Commits `c9d70fa` and `409a5d6` are ancestors of HEAD; `commits: 2` measured from the ledger base `8706d90`.
- Task verify commands re-run: all REPORT OK, privacy check passed on both staged sets. No pocketbase process was started.

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
