---
phase: 09-login-cloud-storage
plan: 13
subsystem: auth
tags: [logout, session-epoch, cross-tab, authStore-onChange, localStorage-cache-clear, toolbar, playwright, fake-pocketbase, synthetic-data]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-11 showLogin(err, notice), lastUser and session cases; 09-12 login form, usj:v2:lastEmail prefill and focus; 09-05/09-08 conflict snapshot and cache keys
provides:
  - "logout(): unsubscribe realtime (failure ignored), remove this account's state/plan/snapshot cache and lastUser, clear the token, reset the page, show the login page with the last email prefilled (D-06, D-07)"
  - "resetSession(): one reusable in-memory reset (sessionEpoch bump, timers, store/me/docs, empty state, DEFAULT_PLAN, cursors, gate, banners, toast, editor, toolbar, wrap) shared by logout and the other-tab sign-out"
  - "sessionEpoch: bumped on every sign-in and sign-out; flush() and cloudSave() check it after each await and then write no cache, no status and no page content"
  - "authStore.onChange handler: empty token in another tab signs this tab out with the info notice; another account reloads; a refreshed token of the same account changes nothing; authQuiet marks this tab's own token clears"
  - "Toolbar: .who (signed-in email, max-width 160px, hidden at 560px or less) and #logoutBtn (12px), both hidden on the legacy path"
  - "Five ACCT-02 cases in tests/cloud/logout.spec.ts and a README section 'Phase 9 的云端用例'"
affects: [09-14, phase-10, phase-13]

plan_head_before: 7b46c1fba1d5dfdbfb8cab6e709eff1ae6794712
plan_head_after: 13d13f1554b4217ab32ac6ddf23f342bc77aef26
actuals:
  tokens: 4500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Fixed logout order written literally in logout() (realtime.unsubscribe, then removeItem calls, then pb.authStore.clear) so a source-order test can check it"
    - "sessionEpoch captured before an await and compared after it; a mismatch returns silently instead of writing"
    - "authQuiet flag around this tab's own pb.authStore.clear() so onChange can tell it from another tab's sign-out"

key-files:
  created:
    - tests/cloud/logout.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/README.md

key-decisions:
  - "Logout does not call a separate clear helper for the token: pb.authStore.clear() stays literally inside logout() so the D-06 order is checkable in source."
  - "Another tab's sign-out resets only the in-memory state (that tab already removed the caches); it does not touch localStorage again."
  - "The 401-on-refresh path sets authQuiet around its own authStore.clear(), so the expired notice and the kept unsent edit still work (session.spec stays green)."
  - "The double-click case does not assert focus: the second click lands on the login page that has just replaced the toolbar."

patterns-established:
  - "Cross-tab cases use page.context().newPage() with its own fixed clock and new AppHarness(page2, { fake }) opened with login: 'session'; the context-level guard already covers the new page."
  - "White-box observation of Storage.prototype.removeItem is installed with addInitScript only inside the single test that needs it."

requirements-completed: []

coverage:
  - id: D1
    description: "Logout returns to the login page; no cache, plan cache, kept version or token of account A remains; the email stays prefilled; B signs in on the same page and sees nothing of A and has only B's cache keys"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 after logout no cache, kept version or token of account A remains and account B sees none of A's content"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-06 order: unsubscribe, then caches and kept version and lastUser, then token last (runtime removeItem order and source order)"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 logout unsubscribes first, then clears the caches and the kept version, and clears the token last"
        status: pass
    human_judgment: false
  - id: D3
    description: "A double click signs out once, and an unreachable server does not block logout"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 a double click on logout signs out once and an unreachable server does not block it"
        status: pass
    human_judgment: false
  - id: D4
    description: "Toolbar shows the signed-in email (title, 160px max width) on wide screens and hides it at 375px while the logout button stays"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 the toolbar shows the signed-in email on wide screens and hides it on narrow screens"
        status: pass
    human_judgment: false
  - id: D5
    description: "Logging out in one tab signs the other tab out with the info notice and the other tab writes nothing for the old account"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 logging out in one tab signs the other tab out with a notice and it writes nothing for the old account"
        status: pass
    human_judgment: false
  - id: D6
    description: "Legacy path unchanged: the toolbar and reset changes do not leak into the four v1 views, storage, smoke and export cases"
    verification:
      - kind: e2e
        ref: "npm test: tests/e2e/platform/app-integrity.spec.ts, storage, smoke, io/export, week, calendar, goals, timeline (93 passed)"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 13: Logout Summary

**Logout that unsubscribes, clears this account's caches, kept version and token in a fixed order, resets the page and prefills the last email, plus a minimal cross-tab sign-out guarded by a session counter**

## Performance

- **Duration:** about 33 min
- **Completed:** 2026-11-09
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 5 (one created)

## Accomplishments

- **Logout order and reset (Task 1, tracer).** `logout()` returns at once if a logout is running or no account is signed in. Otherwise it disables `#logoutBtn` with the text `正在退出…`, then runs in this order. `await pb.realtime.unsubscribe()` (any failure ignored), then `removeItem` for `usj:v2:<me>:state|plan|snapshot` and `usj:v2:lastUser` (`lastEmail` is kept, D-07), then `pb.authStore.clear()`. `resetSession()` follows, then `showLogin("")`, which prefills the email and focuses the password box, then the button text and state are restored. `resetSession()` bumps `sessionEpoch`, clears the save and weekly-review timers and `dirty`, ends the reconcile run, nulls `store`/`me`/`docs`, sets `state=normalize({})` and `usePlan(DEFAULT_PLAN)`, resets the cursors (`view`, `sel`, `wk`, `wsel`, `filter`) and the composer state, calls `setGate(null)`, clears every banner and the toast, closes and empties the editor dialog, hides `#snapshotBtn`, `#logoutBtn`, `.who` and `.wrap`, and calls `renderAll()`.
- **Session counter placement.** `sessionEpoch` is bumped in `enterApp` and `resetSession`. It is checked in `flush()` (after the save await, so no status text is written for a gone session) and in `cloudSave()` (after `getOne`, which gates `keepConflict`, and after `update`, which gates the `docs.state` mutation and `cachePut`). Reconcile runs were already protected by `live()`: `resetSession` calls `endRun(run)`, so a late reconcile step throws STALE and writes nothing.
- **Toolbar (S7).** `.who` (email as text and `title`, `max-width:160px`, ellipsis, hidden at 560px or less) and `#logoutBtn` (12px/400) sit at the right end of `.toolbar`. Both are hidden by default, so the legacy path never shows them.
- **Cross-tab sign-out, three cases (Task 2).** `pb.authStore.onChange(onAuthChange)` is registered in `cloudInit`. The handler does nothing while `authQuiet` is set or no account is signed in. Case 1: token empty, so `resetSession()` then `showLogin("", "other-tab")`, which shows `#loginNotice` with `data-tone="info"` and the text `已在另一个标签页退出登录`. Case 2: the token belongs to a different account, so `location.reload()`. Case 3: same account with a new token (another tab's `authRefresh`), so nothing happens.
- **Tests.** `tests/cloud/logout.spec.ts` has five ACCT-02 cases. The cross-tab case leaves a pending edit (live debounce timer) in the second tab before the first tab logs out, then watches for 1.2 s that no `usj:v2:<A id>:` key reappears.
- **README.** The `tests/cloud/` row now lists every Phase 9 spec. A new section `Phase 9 的云端用例` covers the `open` options (`backend`, `login` index or `'session'`), `openDevice`, the fault switches, `acknowledgeConsoleErrors`, manual clocks for 3 s and 15 s, the local cache keys, and that the v1 four-view mapping to `test:cloud` belongs to Phase 13 (TEST-02).
- **Offline logout console errors.** Measured 0 `console.error` entries when every `/api/` path is refused: with no realtime subscription, `unsubscribe()` sends no request. The case asserts `guard.state.consoleErrors` and `pageErrors` are empty.
- **Requirements.** This plan closes no requirement (`requirements: []`). ACCT-02 is closed by 09-14. No requirement was marked; `requirements.ready-ids` was not run because there are no IDs.

## Task Commits

1. **Task 1 (tracer): logout, clear order, reset, session counter, toolbar** - `fdbbee7` (feat)
2. **Task 2: cross-tab sign-out, edge cases, README overview** - `13d13f1` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `us-journey-tracker.html` - `logout()`, `resetSession()`, `showWho()`, `sessionEpoch`, `onAuthChange` and `authQuiet`, `other-tab` login notice, toolbar HTML and CSS, epoch checks in `flush` and `cloudSave`
- `tests/cloud/logout.spec.ts` - five ACCT-02 cases (new)
- `tests/support/constants.ts` - `APP_SHA256` updated in each task commit
- `tests/support/strings.ts` - `BTN_LOGOUT`, `BTN_LOGGING_OUT`, `NOTICE_OTHER_TAB`
- `tests/README.md` - cloud spec list and the Phase 9 cloud section (CRLF preserved)

## Decisions Made

- `pb.authStore.clear()` stays literally inside `logout()` rather than behind a helper, so the D-06 order can be asserted against the source text as the plan asks.
- The other-tab sign-out resets memory only. The signing-out tab already removed the account's caches, so touching localStorage again would be redundant.
- The 401-on-refresh path in `startReconcile` now sets `authQuiet` around its own `authStore.clear()`. Without it the new handler would read that clear as another tab's logout and reset the page, losing the expired notice.
- Realtime unsubscribe failure and an epoch change during the unsubscribe await are both handled: a failure is ignored, and an epoch change (another tab signed out meanwhile) skips the clearing because that sign-out already reset the session.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Case 1 test compared all localStorage keys, but B's token legitimately exists**
- **Found during:** Task 1 (first targeted run)
- **Issue:** The assertion that only B's keys exist listed `pocketbase_auth` as a stray key; the plan text limits the check to keys starting with `usj:v2:`.
- **Fix:** Filter the key list by the `usj:v2:` prefix before comparing.
- **Files modified:** tests/cloud/logout.spec.ts
- **Verification:** logout.spec.ts passes
- **Committed in:** fdbbee7

**2. [Rule 1 - Bug] Double-click case asserted focus in the password box**
- **Found during:** Task 2 (first targeted run)
- **Issue:** `dblclick()` delivers a second click after the page has already switched to the login page; that click lands on the page and takes focus off the password box, so the focus assertion was wrong for this case (not an app defect). The plan's list for this case does not include focus.
- **Fix:** Removed the focus assertion from the double-click case; focus after logout stays asserted in the first case. Added a count of `pocketbase_auth` removals (must be exactly 1) to prove a single sign-out.
- **Files modified:** tests/cloud/logout.spec.ts
- **Verification:** all five cases pass
- **Committed in:** 13d13f1

**3. [Rule 2 - Missing critical] Reset also clears the toast text, editor contents and sync-bar state**
- **Found during:** Task 1 (implementation, against the ACCT-02 prohibition that B must see nothing of A)
- **Issue:** The plan's reset list did not name the toast text or the editor form markup; a finished toast or a closed editor still holds the previous account's text in the DOM.
- **Fix:** `resetSession()` empties the toast text, closes and empties the editor form, and also clears the composer state and `sizeAck`.
- **Files modified:** us-journey-tracker.html
- **Verification:** the page-HTML assertion in case 1 passes
- **Committed in:** fdbbee7

---

**Total deviations:** 3 auto-fixed (2 test-side bugs, 1 missing critical clean-up)
**Impact on plan:** No scope change; all within the logout path and its tests.

## Issues Encountered

None beyond the deviations above. The `LF will be replaced by CRLF` git warnings on `constants.ts` and `strings.ts` are the repository's existing line-ending conversion; the working files were not mixed.

## Verification Results

- test:cloud, Task 1: logout, login, session specs, 17 passed, REPORT OK, flaky 0.
- test:cloud, Task 2: logout, login, session specs, 20 passed, REPORT OK, flaky 0.
- Default config, Task 1: app-integrity, storage, smoke, io/export, week, calendar, goals, timeline, 93 passed (floor was 93), REPORT OK, flaky 0, with the SAFE-02, IO-01, WEEK-01, CAL-01, GOAL-01 and TL-01 titles present.
- Default config, Task 2: app-integrity, storage, smoke, 22 passed, REPORT OK.
- Anchors `const CATS=`, saving banner, `function normalize(s){`, `const esc=`, `function normalizePlan(` each appear exactly once; `APP_SHA256` matches the file in both commits.
- Staged privacy check printed `隐私检查通过` for both commits. No full suite was run in this plan (full test:cloud is at the end of 09-14).

## Known Stubs

None.

## Threat Flags

None. The only new surface is a localStorage-backed `authStore.onChange` listener inside the existing trust boundary (same browser, same token key), already covered by T-09-31.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 09-14 can put the D-05 confirmation dialog in front of `#logoutBtn`'s click handler (`logout` is the function to call on confirm) and use `hasUnsent()` for the second line of the dialog; it also closes ACCT-02.
- Open edge for 09-14: logout while a save is in flight (the epoch check keeps the old save from writing, but the dirty-edit confirmation belongs there).

## Self-Check: PASSED

- FOUND: tests/cloud/logout.spec.ts, .planning/phases/09-login-cloud-storage/09-13-SUMMARY.md
- FOUND commits: fdbbee7, 13d13f1 (both ancestors of HEAD)

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
