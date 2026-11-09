---
phase: 09-login-cloud-storage
plan: 14
subsystem: auth
tags: [logout-confirm, switch-account-confirm, dialog, confirmBox, session-epoch, playwright, fake-pocketbase, synthetic-data]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-13 logout(), resetSession(), sessionEpoch, #logoutBtn; 09-11 hasUnsent(), lastUser and expiry flow; 09-12 login form and lastEmail; 09-05/09-08 kept version (snapshot) keys
provides:
  - "dialog#confirm (shares the dialog#editor styles, bottom sheet at 560px or less) and confirmBox({title, lines, cancel, ok}) resolving true only for the ok button"
  - "hasUnsaved(): save debounce waiting, save running, dirty state or plan cache, or the weekly review still in its debounce (rvPending)"
  - "D-05 logout confirm: asks only when something would be lost, names the account and the lines that apply, then calls logout()"
  - "Switch-account confirm at sign-in: asks when the previous account has unsent edits or a kept version, otherwise clears silently; same account never asks"
  - "Four new ACCT-02 cases in tests/cloud/logout.spec.ts (nine in the file)"
affects: [phase-10, phase-13]

plan_head_before: 030214b1d1bb69d8546ae255c0b89c008b2dce99
plan_head_after: ed63dc407c9a5ac0171b700bb8aaa1bb669c6ebf
actuals:
  tokens: 7100
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One shared dialog for both confirms; text always written with textContent; cancel button is the default focus and Esc, backdrop click and cancel all resolve false"
    - "unsentOf(id) reads another account's cache flags without needing me; hasUnsent() and the switch confirm both use it"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/logout.spec.ts
    - tests/cloud/session.spec.ts
    - tests/cloud/reconcile-gate.spec.ts

key-decisions:
  - "The confirm never waits for a running save; a save answering after the user chose to sign out is stopped by sessionEpoch (09-13)."
  - "hasUnsaved() also counts a dirty plan cache, not only the state cache, so a future plan edit is protected the same way."
  - "On a cancelled switch-account confirm the new token is cleared inside the authQuiet window, the typed email is kept, the password is emptied and focus goes to the password box."

patterns-established:
  - "Tests that need the confirm dialog to be absent check dialog#confirm[open], because the element is always in the page from this plan on"
  - "Tests that look for logout text on a page that must not offer it count only visible text"

requirements-completed: []

coverage:
  - id: D1
    description: "Logout with an unsent edit asks first; the stay button, Escape and the backdrop keep the session; the ok button signs out and the unsent edit is not on the server"
    requirement: "ACCT-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 logout with an unsent edit asks first and the stay button keeps the session"
        status: pass
    human_judgment: false
  - id: D2
    description: "Logout while a save is in flight: the confirm shows the unsaved line and a save answering later writes no cache key or lastUser"
    requirement: "ACCT-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 logout during a save leaves no cache behind when the save answers later"
        status: pass
    human_judgment: false
  - id: D3
    description: "A kept version that was not downloaded is named in the logout confirmation (without the unsaved line), and signing out removes it"
    requirement: "ACCT-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 logout with a kept version that was not downloaded names it in the confirmation"
        status: pass
    human_judgment: false
  - id: D4
    description: "Signing in as another account after an expiry asks before clearing the unsent data of the previous account; no keeps the page and cache, yes clears A and enters B"
    requirement: "ACCT-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 signing in as another account after an expiry asks before clearing the unsent data of the previous account"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy path unchanged by the shared dialog styles and the review flag (editor, narrow, smoke, week, calendar, goals, timeline, io, storage)"
    verification:
      - kind: e2e
        ref: "npm test: app-integrity, editor, narrow, smoke, week, calendar, goals, timeline (89 passed); storage, smoke, app-integrity (22 passed); io (16 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Dark theme look of the login page, banners and confirm dialog, and the longest 375px notice"
    verification: []
    human_judgment: true
    rationale: "Visual judgment of colour and wrapping; the plan lists it as a manual acceptance check (backstop)"

duration: 36min
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 14: Logout and Switch-Account Confirmation Summary

**dialog#confirm with a shared confirmBox that protects logout (unsaved edits, undownloaded kept version) and switch-account sign-in, with the late-save safety proven by an in-flight save case**

## Performance

- **Duration:** about 36 min
- **Started:** 2026-11-09T10:23:52Z
- **Completed:** 2026-11-09T10:36Z
- **Tasks:** 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 6

## Accomplishments

- **Confirm dialog.** `dialog#confirm` follows `dialog#editor`: shared border, radius, width, backdrop and the bottom sheet at 560px or less. Title is a 16px serif, the body is 14px with `word-break:break-word` and only the first line muted, and the two buttons each take half the width with a 44px minimum height on narrow screens. `confirmBox()` writes every line with `textContent`, puts focus on the cancel button, resolves false for cancel, Esc and a backdrop click, true only for the ok button, and returns focus to the opener.
- **Logout confirm (D-05).** `#logoutBtn` now calls `onLogoutClick()`. When `hasUnsaved()` is true or this account has a kept version, it asks with `退出登录？`, `当前账号：{email}` and the lines that apply, buttons `不退出` and `仍然退出`. Otherwise it signs out at once. It never waits for a save. `hasUnsaved()` counts `savePending` (a debounce waiting, cleared at the start of `flush`), `saving`, a dirty `docs.state` or `docs.plan`, and `rvPending` (set on review input, cleared in the debounce callback).
- **Save in flight.** After `仍然退出` the 09-13 session counter stops a late save from writing the cache, and the new case holds the PATCH, signs out, releases it and watches 1.2 s that no `usj:v2:<A>:` key and no `lastUser` appears.
- **Switch-account confirm.** In `onLogin`, once the credentials pass and before entering, if `lastUser` differs from the new id and the previous account has unsent edits or a kept version, the button keeps `登录中…` and the same dialog asks `换账号登录？` (`不换账号` default, `仍然登录` danger). No clears the new token, keeps the email, empties the password and stays on the login page. Yes, or no unsent data at all, removes the previous account's state, plan and snapshot keys before entering. The same account never asks. `hasUnsent()` was refactored onto `unsentOf(id)`.
- **Tests.** Four new cases in `tests/cloud/logout.spec.ts`; strings added to `tests/support/strings.ts` verbatim from UI-SPEC; `APP_SHA256` updated.

## Task Commits

1. **Task 1 (tracer): logout confirm and in-flight save** - `6c79d97` (feat)
2. **Task 2: test fixes after the full cloud run** - `ed63dc4` (test)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `us-journey-tracker.html` - `dialog#confirm`, shared CSS, `confirmBox`, `hasUnsaved`, `onLogoutClick`, `unsentOf`, switch-account confirm in `onLogin`, `savePending` and `rvPending` flags
- `tests/support/constants.ts` - `APP_SHA256`
- `tests/support/strings.ts` - confirm texts, buttons, `switchBody()`
- `tests/cloud/logout.spec.ts` - four new cases, two earlier cases go through the confirm
- `tests/cloud/session.spec.ts` - `dialog#confirm[open]` instead of any `dialog#confirm`
- `tests/cloud/reconcile-gate.spec.ts` - visible-only count for the logout label

## Decisions Made

- No wait for a running save in the logout confirm; the session counter is the safeguard.
- A dirty plan cache also counts as unsaved.
- Cancelled switch-account confirm focuses the empty password box.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two 09-13 cases plant a kept version and then click logout**
- **Found during:** Task 1 (design check before the first run)
- **Issue:** The planted `snapshot` key is an undownloaded kept version, so logout now asks first; the cases would have waited for a login page that never appears.
- **Fix:** Both cases assert the snapshot line in `#cf-body` and click `仍然退出`; every original assertion is kept.
- **Files modified:** tests/cloud/logout.spec.ts
- **Committed in:** 6c79d97

**2. [Rule 1 - Bug] session.spec.ts counted any `dialog#confirm`**
- **Found during:** Task 2 (full test:cloud)
- **Issue:** The assertion assumed the element does not exist; it is always in the page from this plan on.
- **Fix:** Count `dialog#confirm[open]` (the intent is that no confirm is shown).
- **Files modified:** tests/cloud/session.spec.ts
- **Committed in:** ed63dc4

**3. [Rule 1 - Bug] reconcile-gate.spec.ts counted hidden logout text**
- **Found during:** Task 2 (full test:cloud)
- **Issue:** `getByText('退出登录')` also resolves the toolbar button, which has been in the page, hidden, since 09-13 (09-13 never ran this spec).
- **Fix:** Count only visible matches (`.locator('visible=true')`).
- **Files modified:** tests/cloud/reconcile-gate.spec.ts
- **Committed in:** ed63dc4

**4. [Process] Task 2 application code was committed with Task 1**
- The switch-account confirm, the kept-version case and the switch case were written before the Task 1 verify, so `6c79d97` holds them and the Task 2 commit holds only the two test fixes. No code is missing; the per-task split is not clean.

---

**Total deviations:** 3 auto-fixed (all test-side assumptions, Rule 1), 1 process note
**Impact on plan:** No change to the app behaviour in the plan.

## Issues Encountered

- **The one full test:cloud run did not end in REPORT OK.** It ran 102 cloud tests: 100 passed and 2 failed (deviations 2 and 3). After the fixes I re-ran both whole spec files (reconcile-gate and session, 16 passed) but did not repeat the full suite, because the owner allows only one full suite in this plan. The full report file was overwritten by the later runs, so the literal `check-report --min-expected 101` command was not satisfied. No ACCT-02 case was among the failures.
- **ACCT-02 was not marked complete** in REQUIREMENTS.md for that reason. A confirming `npm run test:cloud` (expected 102 passed) followed by `requirements.mark-complete ACCT-02` closes it.

## Verification Results

- test:cloud logout.spec.ts: 9 passed, REPORT OK, flaky 0, with the two Task 1 titles and the five 09-13 titles.
- Default config, Task 1: app-integrity, editor, narrow, smoke, week, calendar, goals, timeline: 89 passed, REPORT OK, with SAFE-02, WEEK-06, WEEK-01, CAL-01, GOAL-01 and TL-01.
- Default config, Task 2: app-integrity, storage, smoke: 22 passed, REPORT OK. Extra targeted run of tests/e2e/io (native `confirm()` next to `id="confirm"`): 16 passed.
- Anchors each appear once; `APP_SHA256` matches the file; staged privacy checks printed `隐私检查通过` for both commits; `privacy-check.mjs --all` passed (359 files).
- The default full `npm test` was not run (execute-phase regression gate runs it after this plan; v1 154 cases are inside its 175).

## Orchestrator Follow-up (2026-11-09)

- The execute-phase orchestrator ran the plan's exact Task 2 `<automated>` command once more after this plan's two test fixes (same below-normal-priority wrapper, `--workers=1`, no code change in between): **102 passed, REPORT OK expected=102 flaky=0 unexpected=0**, `--min-expected 101` and every listed title found.
- ACCT-02 was then marked complete through the Shared-ID gate (`requirements.ready-ids` → `ready: [ACCT-02]`, `requirements.mark-complete ACCT-02`). TEST-02 stays Pending.
- This confirming run is a second full `test:cloud` for this plan, recorded as a known exception to the one-full-suite-per-plan rule (the first run had two stale assertions that the plan's own DOM change broke).

## Known Stubs

None.

## Threat Flags

None. The only new surface is the confirm dialog inside the existing page; T-09-34 and T-09-35 are mitigated and covered by the in-flight save and switch-account cases.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Two manual acceptance checks remain: dark theme look of the login page, banners and confirm dialog, and the longest 375px notice.
- ~~A confirming full `npm run test:cloud` is still needed before ACCT-02 is marked.~~ Done by the orchestrator (see Orchestrator Follow-up).
- Phase 9 plans are complete; the phase regression gate and verification come next.

## Self-Check: PASSED

- FOUND: .planning/phases/09-login-cloud-storage/09-14-SUMMARY.md, tests/cloud/logout.spec.ts
- FOUND commits: 6c79d97, ed63dc4 (ancestors of HEAD)

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
