---
phase: 09-login-cloud-storage
plan: 11
subsystem: auth
tags: [login-expiry, session, authRefresh, playwright, fake-pocketbase, synthetic-data]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 login page and authRefresh startup path; 09-04 openDevice; 09-06 reconcile with usj:v2 cache; 09-07 dirty-cache upload
provides:
  - "#loginNotice on the login card: warn-tone expired notice, second line only when this device holds unsent work of the last account"
  - "showLogin(err, notice) second parameter and the loginNotice()/hasUnsent() helpers"
  - "Startup expiry from two sources only: authRefresh 401, or the stored token's own exp (no request sent)"
  - "AppHarness.open login: 'session' and openDevice storageState option"
  - "tests/cloud/session.spec.ts with four ACCT-01 session cases"
affects: [09-12, 09-14, phase-10]

plan_head_before: 74a517de1870efb64828b9e93bb67f8fa48615a3
plan_head_after: 53d359aa526f2e5ec3df2b8b6c11f735a56231de
actuals:
  tokens: 11500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Expiry never deletes usj:v2: keys or clears dirty: only pb.authStore.clear() runs"
    - "Unsent work is read for the last user from localStorage (lastUser), not from me, which is null on the login page"

key-files:
  created:
    - tests/cloud/session.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/app.ts
    - tests/support/devices.ts

key-decisions:
  - "The 401 branch in startReconcile already cleared the token and showed the login page; the change only passes the expired notice and leaves the cache untouched (it was already untouched)."
  - "hasUnsent() counts a dirty state cache, a dirty plan cache or a kept snapshot of the last account, so a plan edit kept through expiry also gets the second line."
  - "A stored token that is non-empty but fails isValid is cleared and shown as expired without any request; an empty token still goes to the plain login page with no notice."

patterns-established:
  - "Reopened-browser proof: page.context().storageState() into openDevice({ storageState }) and open({ login: 'session' })"

requirements-completed: []

coverage:
  - id: D1
    description: "authRefresh 401 at startup returns to the login page with the warn notice (two lines), clears only the token and keeps the dirty cache with the unsent edit"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-01 an auth-refresh 401 at startup returns to the login page with the expired notice and keeps the unsent edit of this account"
        status: pass
    human_judgment: false
  - id: D2
    description: "Signing in again with the same account reconciles and uploads the edit kept through the expiry; notice hidden, no confirm dialog"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-01 signing in again with the same account uploads the edit kept through the expiry"
        status: pass
    human_judgment: false
  - id: D3
    description: "A token past its local exp shows the one-line expired notice with no request sent and the cache kept"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-01 a token past its local expiry shows the expired notice without contacting the server"
        status: pass
    human_judgment: false
  - id: D4
    description: "A new context with the saved storage state stays signed in, shows no login page and refreshes the login once (auth-refresh 200)"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-01 a session survives closing and reopening the browser"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy path unchanged: app-integrity (SAFE-02), storage and smoke on the default config; login and reconcile-gate cloud cases still pass"
    verification:
      - kind: e2e
        ref: "npm test -- tests/e2e/platform/app-integrity.spec.ts tests/e2e/storage tests/e2e/smoke.spec.ts (22 passed); test:cloud session+login+reconcile-gate (18 passed)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 11: Login expiry and session persistence Summary

**An expired login (authRefresh 401 or the token's own exp) returns to the login page with a warn notice, keeps this account's unsent edits, and the same account's next sign-in uploads them; a reopened browser stays signed in.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-09
- **Tasks:** 2
- **Files modified:** 6 (one created)

## Accomplishments
- `#loginNotice` (`.syncbar`, `role="status"`, `data-tone="warn"`) at the top of the login card; one `<p>` per line, written with `textContent`. Second line `本机还有没上传的修改，用同一账号登录后会自动上传。` appears only when the last account on this device has a dirty state or plan cache, or a kept snapshot.
- Two expiry paths, both judged only by the login itself: an `authRefresh` 401 during the startup reconcile, and a stored token whose own `exp` has passed (cleared without sending any request). Record endpoints (200 empty list, 404, 400) are never used to decide expiry (PB-CONTRACT section 9).
- Expiry clears only the token; every `usj:v2:` key and the dirty flag stay. Signing in again as the same account takes the normal reconcile, which uploads the kept edit (server state contains it, cache dirty false, no `dialog#confirm`).
- Reopened browser: a new context with the saved storage state shows no login page, reaches synced, shows the synthetic record, and the fake server saw exactly one `auth-refresh` answering 200.
- Test helpers: `open({ login: 'session' })` waits for the app view without filling the form; `openDevice({ storageState })` passes it to `browser.newContext`.

## Task Commits

1. **Task 1 (tracer): 401 at startup, expired notice, cache kept, same-account re-login uploads** - `a69e3c7` (feat)
2. **Task 2: local exp without contacting the server, reopened browser stays signed in** - `53d359a` (feat)

**Plan metadata:** the docs commit that follows this summary.

## Files Created/Modified
- `us-journey-tracker.html` - `#loginNotice` markup and CSS, `hasUnsent()`, `loginNotice()`, `showLogin(err, notice)`, local-exp branch in `cloudInit`, notice hidden after a successful credential check
- `tests/support/constants.ts` - `APP_SHA256` updated in each app-changing commit
- `tests/support/strings.ts` - `LOGIN_EXPIRED`, `LOGIN_EXPIRED_UNSENT`
- `tests/support/app.ts` - `login: 'session'`
- `tests/support/devices.ts` - `storageState` option
- `tests/cloud/session.spec.ts` - four cases

## Decisions Made
- The 401 branch already cleared the token and showed the login page (09-06); this plan added the notice argument and the proof that nothing in the cache is removed.
- The unsent-work check covers the plan cache and snapshot as well as the state cache, since all three are this account's unsent or kept data.
- Console errors measured: the 401 case produces exactly 1 `status of 401 ` and 1 `ERR_CONNECTION_REFUSED` (the refused single-record read; the PATCH is never sent because the read fails first). The local-expiry case produces none because no request is sent. The re-login case produces the same 1 + 1 as the 401 case.

## Deviations from Plan

None - plan executed exactly as written. The new cases passed on the first run, so the plan's single targeted run per task was enough and no full suite was run (per the plan).

Tracer gate: the Task 1 verify (cloud and default-config parts) passed end to end immediately before the commit, so expansion to Task 2 proceeded.

## Issues Encountered
- `tests/support/app.ts` and `tests/support/devices.ts` are CRLF in the working tree; edits were made with CRLF-aware replacements so no file has mixed endings. Git's LF-to-CRLF warning for the other test files is pre-existing `core.autocrlf` behaviour.
- Mid-session expiry (found at save time inside the running app) is not handled here: it belongs to Phase 10 (ACCT-05), as the plan assumed.

## Verification Results
- Task 1 cloud run (session, login, reconcile-gate): 18 passed, REPORT OK, all four named titles present.
- Task 2 cloud run (session, login): 8 passed, REPORT OK, all four named titles present.
- Default config run (app-integrity, storage, smoke) after each task: 22 passed, REPORT OK, includes SAFE-02 and the TEST-01 backend-null case.
- Staged privacy check passed for both commits (rule D: 68 plan terms loaded).
- No pocketbase.exe process was started or left running (the fake server is in-process).

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema; the plan's T-09-24 and T-09-25 are mitigated and covered by the 401, local-exp and same-account re-login cases.

## Requirements

This plan closes no requirement (frontmatter `requirements` is empty). ACCT-01 is closed by 09-12.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- 09-12 can close ACCT-01; 09-14 handles signing in as a different account after expiry (the same `hasUnsent()` helper is reusable for the switch-account confirm).

## Self-Check: PASSED

- tests/cloud/session.spec.ts: FOUND
- Commits a69e3c7 and 53d359a: FOUND in HEAD history
- `id="loginNotice"`, `登录已过期，请重新登录`, `本机还有没上传的修改`, `authStore.token` in the app: FOUND; five anchors exactly once; APP_SHA256 equals the file sha256

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
