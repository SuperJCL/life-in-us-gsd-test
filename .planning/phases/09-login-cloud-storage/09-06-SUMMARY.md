---
phase: 09-login-cloud-storage
plan: 06
subsystem: sync
tags: [reconcile, timeout, abort-controller, sync-banner, read-only, retry, boot-card, playwright]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-05 cache, reconcile table rows, setGate/applyGate, GATE_ALLOW (already allows #syncbar button); 09-03 fault switches (hold, status); 09-01 cloudInit, showLogin
provides:
  - startReconcile(mode, retrying) with SLOW_MS 3000, FAIL_MS 15000, RETRY_MS 5000, one AbortController per run, stale runs discarded
  - sync banner #syncbar (showBar, hideBar, fixed priority table) and status-line dots per data-state
  - read-only state (data-gate readonly) with a retry button after 15 s, cached content still visible
  - #boot first sign-in wait card (loading, slow, unreachable with a single retry button, no account content)
  - quiet in-window retries (failed attempt retried after 5 s, at most 3 attempts per run)
affects: [09-07, 09-08, 09-09, 09-11, phase-10]

actuals:
  tokens: 5400
  tasks: 2
  commits: 2
plan_head_before: a9185dcb665d3c6e752053a0a3500408ca611e48
plan_head_after: dfcaf3532285752b59aaff766e8f57350b69bd94

tech-stack:
  added: []
  patterns:
    - "reconcileOnce(r) does all network work first, calling live() after every await (throws STALE if the run is no longer current), then one synchronous commit block that touches plan, state, docs, cache, gate and DOM"
    - "a run ends at the 15 s deadline (abort, live=false, timers cleared) but stays as the current run so the retry can reuse its mode; success sets run to null"
    - "banner buttons are part of the banner spec (text, cls, disabled, fn), so a re-draw triggered by a lower-priority banner keeps the disabled retrying button"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/reconcile-gate.spec.ts

key-decisions:
  - "Timing constants: SLOW_MS 3000, FAIL_MS 15000, RETRY_MS 5000; a run makes at most 3 attempts (first, +5 s, +10 s when failures are instant); the 15 s deadline always wins."
  - "Banner priority (S2): expired > unreachable > slow > toolarge > snapfail > remote > sizewarn; only one is drawn. Only slow and unreachable are used in this plan; the rest are registered keys for later plans."
  - "A retry keeps the unreachable banner on screen with a disabled 正在重试… button while the new run is live (higher priority than slow, so the slow banner stays masked until a failure or success)."
  - "Boot-card retry: the card keeps its unreachable look with a disabled 正在重试… button for the whole retry; the title is not switched to the slow sentence during a retry (only on the first attempt)."
  - "enterApp now returns startReconcile(...); non-401 failures no longer fall back to the login page (09-01 temporary behavior replaced). 401 from authRefresh still clears the token and shows the login page."
  - "No online-event listener: connectivity retry is manual only, Phase 10 adds backoff."

patterns-established:
  - "Manual-clock timing cases wait for the observable start state (status line) before advancing the clock, because the timers are set in the same synchronous step as the status line"
  - "Late-response proof: hold the first request, let the deadline abort it, run a retry to success, then release the first request and assert the page, server state and requests are unchanged"

requirements-completed: []

coverage:
  - id: D1
    description: "A reconcile still running after 2.9 s shows nothing; at 3.1 s the status line is 网络较慢，还在连… and a warn banner without buttons appears while editing stays disabled; release returns to synced and hides the banner"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a reconcile still running after about 3 seconds shows the slow notice and keeps editing disabled"
        status: pass
    human_judgment: false
  - id: D2
    description: "At 15 s the held request is aborted, the session turns read-only (data-gate readonly, status unreachable, error banner with one 重试 button, cached content visible); 重试 disables at once and reads 正在重试…, a second click starts nothing, success releases editing, and the late response of the aborted request changes nothing and writes nothing"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a reconcile not finished after about 15 seconds turns read-only with a retry that restores editing once it succeeds"
        status: pass
    human_judgment: false
  - id: D3
    description: "A first sign-in with no cache shows only the #boot card (loading, slow at 3 s, unreachable at 15 s with a single 重试, no 退出登录, no account content); retry after recovery shows the app and hides the card"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a first sign-in that cannot reach the server shows only the retry card with no account content"
        status: pass
    human_judgment: false
  - id: D4
    description: "A single 503 inside the window is retried after 5 s and succeeds; the status line was never unreachable (observed with a MutationObserver) and no banner showed an error"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a server error inside the window is retried quietly and never reported as unreachable"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy path unchanged: SAFE-02, app-integrity, storage and smoke (22 cases) pass with the new baseline"
    verification:
      - kind: e2e
        ref: "npm test over tests/e2e/platform/app-integrity.spec.ts, tests/e2e/storage, tests/e2e/smoke.spec.ts (22 passed, flaky 0)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual look of the banner (tone border, wrapping of the button on narrow screens), the status-line dot and the moving progress bar on the wait card, against UI-SPEC S2, S4 and S10"
    verification: []
    human_judgment: true
    rationale: "No test asserts colors, wrapping, the animation or the reduced-motion behavior; only DOM state, text and tone attributes are covered."

duration: "~10 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 06: Reconcile Timing Summary

**Timed reconcile: 3 s slow notice, 15 s abort into a read-only state with a one-click retry, a first-sign-in wait card, and quiet in-window retries, with every late or replaced response discarded by run identity.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-11-09T08:59:55Z
- **Completed:** 2026-11-09T09:09:41Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Values: `SLOW_MS` = 3000, `FAIL_MS` = 15000, `RETRY_MS` = 5000. Each reconcile is one run with its own `AbortController`; every SDK call (authRefresh, getFullList, create) gets `{ signal }`; `live()` is checked after every await and the whole result is applied in one synchronous block, so an abandoned or replaced run cannot half-apply.
- Banner priority table (S2, implemented in `SB_ORDER`): expired, unreachable, slow, toolarge, snapfail, remote, sizewarn. `showBar`/`hideBar` draw only the highest one with `textContent` and `createElement`. This plan uses `slow` (warn, no button) and `unreachable` (error, one primary 重试).
- Cached session: 3 s slows the status line and shows the banner; 15 s aborts, switches the gate to `readonly`, status `连不上服务器，暂时只能查看，不能修改`, banner with 重试. 重试 turns into a disabled `正在重试…` and starts a fresh run; a failure restores the enabled button; success hides both banners, drops the gate and redraws.
- No cache: `#boot` card (`role="status"`, title, sub text, indeterminate bar, hidden retry). Slow title at 3 s; unreachable title, sub text, bar hidden, single retry at 15 s; retry behaves like the banner button; success hides the card and shows `.wrap`.
- Quiet retries: a failed non-401 attempt is retried after `RETRY_MS` while the run is current, up to 3 attempts; status stays reconciling or slow; the 15 s deadline stays the only way to declare unreachable.
- Status line gets the 8 px dot per `data-state` (CSS only, no new color token). Legacy path never sets `data-state`, so it is unchanged.
- Measured in tests: browser `console.error` count from the aborted requests is 0 (nothing to acknowledge); the only acknowledged errors are the injected 503 in the quiet-retry case (`status of 503 ` x 1). `app.fake.fulfillErrors` observed: 0 in the 15 s case and 0 in the boot-card case (annotation `observed` in the report); the cases still allow at most 1, listing path only.

## Task Commits

1. **Task 1 (tracer): banner, 3 s slow, 15 s abort and read-only, retry, late responses discarded** - `158a09b`
2. **Task 2: first sign-in wait card and quiet in-window retries** - `dfcaf35`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Own test asserted the wrong thing about the slow state in the quiet-retry case**
- **Found during:** Task 2
- **Issue:** the new case asserted that `slow` never appeared. Advancing the clock by 5 s passes the 3 s mark of the same run, so `slow` correctly appears; the spec says the state stays reconciling or slow.
- **Fix:** the case now asserts only that `unreachable` never appears (and that `reconciling` was seen). The plan's own assertions are unchanged.
- **Files modified:** tests/cloud/reconcile-gate.spec.ts
- **Commit:** dfcaf35 (the case was never committed with the wrong assertion)

**Total deviations:** 1 auto-fixed (Rule 1, test only). **Impact:** none on the app.

### Decisions beyond the plan text

- The quiet-retry case waits for the app to schedule the 5 s timer (a recorded `setTimeout` delay of 5000) before advancing the clock, so the clock cannot be advanced before the retry exists. The plan did not specify this wait; it removes a race, it does not weaken anything.
- Files in this repo are LF in the working tree (the task note said some were CRLF; all four edited files measured 0 CRLF), so edits kept LF.

## Known Stubs

None. `SB_ORDER` keys `expired`, `toolarge`, `snapfail`, `remote`, `sizewarn` are placeholders for later plans in the priority table only; no code shows them yet.

## Threat Flags

None beyond the plan's register: T-09-14 (late response) is mitigated by abort plus run identity and shown by the release-after-deadline case; T-09-15 (locked out when the server is slow) is mitigated by read-only display, retry in banner and card, and quiet retries.

## Requirements

None marked complete (plan `requirements` is empty). SYNC-05 is closed by 09-09; TEST-02 stays Pending.

## Issues Encountered

None in the app. The first run of the quiet-retry case failed on its own over-strict assertion (see Deviations).

## Self-Check: PASSED

- Files exist: us-journey-tracker.html, tests/support/constants.ts, tests/support/strings.ts, tests/cloud/reconcile-gate.spec.ts.
- Commits 158a09b and dfcaf35 are ancestors of HEAD; `plan_head_before..HEAD` count is 2.
- Verify commands: test:cloud reconcile-gate.spec.ts 8/8, REPORT OK (flaky 0); app-integrity, storage, smoke 22/22, REPORT OK (flaky 0) after each task; staged privacy check passed for both commits; APP_SHA256 equals the file hash; five anchors exactly once.
