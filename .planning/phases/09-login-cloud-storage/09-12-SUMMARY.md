---
phase: 09-login-cloud-storage
plan: 12
subsystem: auth
tags: [login-form, abort-controller, rate-limit, show-password, prefill, playwright, fake-pocketbase, synthetic-data]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 login page and authWithPassword; 09-03 fake-server fault switches; 09-11 showLogin(err, notice), session cases and lastUser
provides:
  - "Login submit with a busy flag (one sign-in at a time), AbortController signal and the FAIL_MS abort; a success arriving after the abort clears the token"
  - "Separate login messages: 400 credentials, 429 rate limit, network error / timeout / 5xx unreachable; aria-invalid and aria-describedby wiring"
  - "Local empty-field check, usj:v2:lastEmail prefill with initial focus (D-07), show-password toggle that resets on success, login page and pagehide"
  - "Seven new ACCT-01 login cases (login.spec.ts now 11); full test:cloud 93 passed"
affects: [09-13, 09-14, phase-10, phase-13]

plan_head_before: c297a643764c33cf973a682c1cee7b92de4def40
plan_head_after: e602fd8591aa21b30625c9ffb21d4fda2ae6ebf4
actuals:
  tokens: 5200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Busy flag plus AbortController timer around authWithPassword; busy is released before enterApp so the hidden login page never keeps a disabled button"
    - "prefillLogin() runs from showLogin, so first open, logout and expiry all prefill the email, clear the password and reset the show-password toggle"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/login.spec.ts

key-decisions:
  - "aria-invalid is set only on the password box and only for a 400; unreachable and rate-limit errors keep both inputs and set no aria-invalid."
  - "Busy is released right after authWithPassword settles (before enterApp), because enterApp hides the login page synchronously."
  - "lastEmail stores the trimmed email typed at the successful sign-in, and is not written for an abandoned (late) success."
  - "The 15 s timeout test sits in a nested describe with test.use({ clockMode: 'manual' }) so the other login cases keep the fixed clock."

patterns-established:
  - "Login failure cases use the fake server's times:1 refuse / status switches in sequence on one page; the timeout case uses hold plus the manual clock's runFor(15000)"

requirements-completed: [ACCT-01]

coverage:
  - id: D1
    description: "Wrong password shows the unified message, clears and focuses only the password, sets aria-invalid, keeps the email; typing clears the error"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 a wrong password says the email or password is wrong, clears only the password and keeps the email"
        status: pass
    human_judgment: false
  - id: D2
    description: "Refused connection, 503 and 429 each show their own message and keep both inputs"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 an unreachable server, a server error and a rate limit each show their own message and keep both fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "A sign-in with no answer after 15 s (manual clock) is reported as unreachable with the busy appearance first; a late answer neither signs in nor leaves a token"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 a sign-in with no answer after about 15 seconds is reported as unreachable and a late answer does not sign in"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicking twice and pressing Enter during a sign-in sends exactly one request"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 submitting twice sends one sign-in request"
        status: pass
    human_judgment: false
  - id: D5
    description: "The login page has no links and two buttons, prefills the last signed-in email with focus on the password, and the first open focuses the email"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 the login page has no registration or password-reset entry and prefills the last signed-in email"
        status: pass
    human_judgment: false
  - id: D6
    description: "Empty or partly empty submit is reported locally, focuses the first empty field and sends no request"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 empty fields are reported locally and focus the first empty field"
        status: pass
    human_judgment: false
  - id: D7
    description: "Show-password toggle changes type, text, aria-pressed and aria-label, and returns to hidden after a successful sign-in"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "tests/cloud/login.spec.ts#ACCT-01 the password can be shown and is hidden again after a submit"
        status: pass
    human_judgment: false
  - id: D8
    description: "Long email and error text stay inside the card (min-width:0 on inputs, overflow-wrap:anywhere on the error area)"
    requirement: ACCT-01
    verification: []
    human_judgment: true
    rationale: "CSS-only change checked by reading the rule; no test renders a very long address, and the owner can see it on a phone-width login page in the plan 09-14 walkthrough"
  - id: D9
    description: "The show-password reset on pagehide is wired (window pagehide listener inside cloudInit)"
    requirement: ACCT-01
    verification: []
    human_judgment: true
    rationale: "A pagehide event cannot be raised faithfully by the test harness; covered by code reading only"

duration: 25min
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 12: Login form completion Summary

**The login form now has a busy state with one request at a time, a 15-second AbortController abort that discards late successes, separate messages for wrong credentials / rate limit / unreachable, local empty-field checks, last-email prefill with initial focus, and a show-password toggle that hides itself again.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-11-09T09:42:00Z (approximate; the start time was not captured at the first command)
- **Completed:** 2026-11-09T10:07:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Task 1 (tracer): the sign-in pipeline. `loginBusy` ignores a second submit, the button shows `登录中…` with `aria-busy`, both inputs are readonly, `authWithPassword(email, pw, { signal })` is aborted after `FAIL_MS` and reported as unreachable, and a success that arrives after giving up calls `pb.authStore.clear()`. 400 gives the unified credentials message (password cleared and focused, `aria-invalid`, email kept), 429 gives the rate message, everything else the unreachable message with both inputs kept. Typing in either field clears the error and `aria-invalid`.
- Task 2: `请填写邮箱和密码` local check with focus on the first empty field and no request or busy state; `usj:v2:lastEmail` written on success and prefilled by `showLogin` (focus on the password box when an email is prefilled, on the email box otherwise); `.pw-toggle` behaviour with reset on success, on `showLogin` and on `pagehide`; long-text CSS (`min-width:0`, `overflow-wrap:anywhere`).
- ACCT-01 is closed by this plan: proof is 09-01 (sign in, reload), 09-11 (expiry, reopened browser) and the seven new login cases here.

## Measured values (requested by the plan)

- **console.error counts:** wrong password 1 (`status of 400 `); the failure sequence 3 (1 refused connection `ERR_CONNECTION_REFUSED`, 1 `status of 503 `, 1 `status of 429 `); the timeout and double-submit cases 0.
- **fulfillErrors in the timeout case:** 0 (the plan allowed at most one; the assertion is `toEqual([])`).
- **Full test:cloud:** 93 passed, 0 flaky, 0 failed (plan floor 92; one earlier plan added a case beyond the plan's count). `--min-expected 92` and every listed title were satisfied.

## Task Commits

1. **Task 1: tracer, login submit pipeline** - `2aa36ad` (feat)
2. **Task 2: empty fields, last-email prefill, show password, full test:cloud** - `e602fd8` (feat)

**Plan metadata:** committed separately after this file (docs: complete plan).

## Files Created/Modified

- `us-journey-tracker.html` - busy flag and abort in `onLogin`, `clearLoginErr`, `prefillLogin`, `setPwShown`, `usj:v2:lastEmail`, `aria-describedby` on both inputs, two CSS properties
- `tests/support/constants.ts` - `APP_SHA256` updated in each task commit
- `tests/support/strings.ts` - `LOGIN_ERR_RATE`, `LOGIN_BUSY`, `LOGIN_ERR_EMPTY`, `PW_SHOW`, `PW_HIDE`, `PW_SHOW_LABEL`, `PW_HIDE_LABEL`
- `tests/cloud/login.spec.ts` - seven new ACCT-01 cases (11 in the file)

## Decisions Made

See `key-decisions` in the frontmatter. The wrong-entry text in the credentials case is built at runtime with `randomUUID()`; no password literal exists in source.

## Deviations from Plan

None - plan executed exactly as written. The timeout test uses a nested `describe` with `test.use({ clockMode: 'manual' })` instead of a file-wide switch (an implementation choice inside the plan's "manual clock" instruction, not a change of behaviour).

## Issues Encountered

None. All new cases passed on their first targeted run; the full cloud suite and the default-config regression runs (app-integrity, storage, smoke: 22 passed) passed on the first attempt in both tasks.

## Known Stubs

None.

## Threat Flags

None. The new surface (a `usj:v2:lastEmail` localStorage key holding an email) is the locked D-07 decision and sits inside the cloud branch only.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The login page is complete for SC1. 09-13 and 09-14 can rely on `showLogin` prefilling the email and resetting the password field.
- T-09-27 (online guessing) stays with Phase 13 SEC-02; this plan only gives 429 its own message.

## Self-Check: PASSED

- Files found: `us-journey-tracker.html`, `tests/cloud/login.spec.ts`, `tests/support/strings.ts`, `tests/support/constants.ts`
- Commits found: `2aa36ad`, `e602fd8`
- Task 1 verify: login + session specs 12 passed (REPORT OK), regression 22 passed, privacy check passed
- Task 2 verify: full test:cloud 93 passed (REPORT OK, `--min-expected 92`), regression 22 passed, privacy check passed
- No PocketBase process was started by this plan (all runs used the in-process fake server)

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
