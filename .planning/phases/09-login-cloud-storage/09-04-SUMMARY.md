---
phase: 09-login-cloud-storage
plan: 04
subsystem: testing
tags: [playwright, multi-device, fake-pocketbase, guard, test-infrastructure]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 cloud harness (login helper, composer), 09-03 isAttached and acknowledgeConsoleErrors
provides:
  - openDevice helper (second independent browser context on the shared fake server, same guard state and policy, fixed clock)
  - AppHarness constructor option fake for sharing one FakePbServer
  - tests/cloud/multi-device.spec.ts (2 cases)
  - README section on the three cloud facilities (fault switches, openDevice, acknowledgeConsoleErrors)
affects: [09-07, 09-08, 09-10]

actuals:
  tokens: 5200
  tasks: 2
  commits: 2
plan_head_before: 21b27643c993362adb81841d2c4491110cdf073a
plan_head_after: 9dd399d264fc6037a54f5ff02d90a7ab4eb78296

tech-stack:
  added: []
  patterns:
    - "second device = browser.newContext with explicit base options + attachGuard on the shared guard.state before any navigation; caller closes the context in finally"
    - "shared FakePbServer: open() adds no accounts by default and skips attach() when the context is already attached"

key-files:
  created:
    - tests/support/devices.ts
    - tests/cloud/multi-device.spec.ts
  modified:
    - tests/support/app.ts
    - tests/README.md

key-decisions:
  - "openDevice closes the new context itself if setup (newPage, attachGuard, clock) throws, so a failed setup does not leak a context; on success the caller owns it."
  - "The shared flag is derived from whether opts.fake was passed to the AppHarness constructor (not from the fake having users), as the plan describes."

patterns-established:
  - "Violations on the second device are removed from the shared guard by content only after asserting the exact expected list, then the matching ERR_BLOCKED_BY_CLIENT console.error is acknowledged"

requirements-completed: []

coverage:
  - id: D1
    description: "A second device (independent context, same fake server, same guards) signed in to account A shows the entry the first device recorded and uploaded"
    verification:
      - kind: e2e
        ref: "tests/cloud/multi-device.spec.ts#SYNC-01 a second device signed in to the same account loads what the first device saved"
        status: pass
    human_judgment: false
  - id: D2
    description: "An external request made by the second device is recorded as a violation in the shared guard state"
    verification:
      - kind: e2e
        ref: "tests/cloud/multi-device.spec.ts#TEST-02 a second device reports its own external request through the shared guard"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full test:cloud run, no regression in earlier cases"
    verification:
      - kind: e2e
        ref: "npm run test:cloud (REPORT OK expected=59 flaky=0 unexpected=0)"
        status: pass
    human_judgment: false

duration: "~15 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 04: Second Device and Multi-Device Foundation Summary

**`openDevice` builds a second independent browser context on the shared FakePbServer with the same guard state, policy, base options and fixed clock, and the first multi-device case shows device two loading the entry device one saved.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files:** 4 (2 created, 2 modified); the app, the playwright config and `APP_SHA256` are untouched

## Accomplishments

- Tracer (SYNC-01 second slice): device one signs in as account A, records `SYNTH-0904 device one entry`, the test waits for it in `fake.lastState(0)` and takes its id; `openDevice` opens device two, which signs in as the same account and shows the entry with that `data-edit` id in the week view.
- `AppHarness` takes `{ fake }`; with a shared fake `open()` defaults to 0 new users, writes a seed only when one is given, and skips `attach()` when `fake.isAttached(context)`.
- `openDevice(opts)` options: `browser`, `guard`, `fake` (required), `clock` (`'fixed'` default or `'none'`), `acceptDownloads` (default false), `viewport` (default 1280x800). It sets baseURL, locale, timezone, light colour scheme, reduced motion and `serviceWorkers: 'block'` explicitly, calls `attachGuard(context, guard.state, guardPolicy(), page)` before any navigation, then fixes the clock. Returns `{ context, page, app }`.
- TEST-02 self-check: an external `fetch` from device two lands in the shared `guard.state.unexpectedRequests`, is removed by content after an exact-list assertion, and its `ERR_BLOCKED_BY_CLIENT` console.error is acknowledged.
- README: section 5 lists `pb-faults.spec.ts` and `multi-device.spec.ts`; section 7 points the second-device sentence to `openDevice`; section 13 has a three-item note (fault switches with PB-CONTRACT.md section 10, `openDevice` with the caller-closes-the-context rule, `acknowledgeConsoleErrors`).

## Test counts

Full `npm run test:cloud`: **59 passed**, REPORT OK expected=59 flaky=0 unexpected=0. The plan text says 58; that figure assumed 09-03 added five cases, but 09-03 added six (its summary notes the sixth). 51 + 6 + 2 = 59. The `--min-expected 58` floor in the verify command was met. This was the only full suite run in this plan; the default `npm test` was not run.

## Task Commits

1. **Task 1: tracer, shared-fake option, openDevice, first multi-device case** - `f0d588c` (test)
2. **Task 2: second-device guard self-check, README cloud facilities, full test:cloud** - `9dd399d` (test)

## Files Created/Modified

- `tests/support/devices.ts` - `openDevice`
- `tests/cloud/multi-device.spec.ts` - two cases
- `tests/support/app.ts` - constructor `fake` option, shared-open behaviour
- `tests/README.md` - cloud facilities notes

## Decisions Made

See `key-decisions`. Line endings: all four files are CRLF in the working tree like their siblings; new files were written CRLF and edits preserved CRLF (no mixed endings).

## Deviations from Plan

None - plan executed exactly as written. (Count note above: 59 cases ran instead of the plan's 58, because the plan's arithmetic missed 09-03's sixth case; not a code deviation.)

## Issues Encountered

One shell-quoting slip while editing README (backticks inside a double-quoted `node -e` string) corrupted the README and spec in the working tree and ran a stray `npm run` that failed with "Missing script". Nothing was staged or committed; both files were restored with `git checkout -- <file>` and re-edited from a script file. No effect on the committed result.

## Known Stubs

None.

## Threat Flags

None. No new network surface. T-09-10 mitigated: `openDevice` attaches the guard before any navigation on the same `guard.state`, and the self-check case proves a second-device external request is recorded. T-09-SC accepted: nothing installed or downloaded. No pocketbase process was started.

## Authentication Gates

None.

## User Setup Required

None.

## Next Phase Readiness

- `openDevice` is ready for 09-07 (multi-device scenarios), 09-08 (real conflicts between two devices) and 09-10 (four views across devices).
- No requirement marked complete (frontmatter `requirements` empty); SYNC-01 closes in 09-10, TEST-02 stays open.

## Self-Check: PASSED

- Created files exist: `tests/support/devices.ts`, `tests/cloud/multi-device.spec.ts`.
- Commits `f0d588c` and `9dd399d` are ancestors of HEAD; `commits: 2` measured from ledger base `21b2764`.
- Both task verify commands passed in full (REPORT OK expected=5 and expected=59, flaky=0; privacy check passed on both staged sets).

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
