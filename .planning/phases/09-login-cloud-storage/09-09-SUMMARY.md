---
phase: 09-login-cloud-storage
plan: 09
subsystem: sync
tags: [conflict, snapshot, capacity, banner, quota, download, playwright]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-08 keepConflict and snapDownload; 09-06 showBar/hideBar and the banner priority table; 09-05 cloudSave and flush
provides:
  - keepConflict shows a warn banner (snapfail, with an acknowledge button) instead of a success toast when the snapshot cannot be written
  - snapDownload keeps the kept version and the #snapshotBtn and toasts when Blob, object URL or the click throws
  - cloudSave measures the document in UTF-8 bytes against CLOUD_MAX (4,194,304) before any request; 70 percent warns once per page session, over the limit sends nothing and keeps the edit dirty in the local cache
  - bulkyState(label, targetBytes) in tests/support/cloud-data.ts
affects: [09-10, 09-11, 09-13, 09-14, phase-10, phase-11]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2
plan_head_before: dc41161364b44405a736ba03e08ade47c266b3d0
plan_head_after: 5961ac81c448409651552d5bb8919e9cad08d92f

tech-stack:
  added: []
  patterns:
    - "Failure branches are provoked in the page by init scripts on the second device only (Storage.prototype.setItem throwing for keys ending :snapshot; URL.createObjectURL throwing), never by filling the disk and never with an app-side test hook"
    - "Capacity check runs first in cloudSave, outside the network try/catch, so the thrown error keeps its own message and state field (toolarge) which the existing flush catch passes to setStatus"

key-files:
  created:
    - tests/cloud/capacity.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/cloud-data.ts
    - tests/cloud/conflict-snapshot.spec.ts

key-decisions:
  - "A snapshot write failure shows only the snapfail banner and returns false; the upload still goes ahead (last save wins). An older snapshot already on this device is left alone, so #snapshotBtn state is whatever it was before."
  - "The 70 percent warning is dismissed per page session through an in-memory flag; a reload shows it again while the document is still at or above 70 percent. Below 70 percent the warning is hidden again."
  - "The over-limit banner has no button and is cleared by the next save that measures under the limit."

patterns-established:
  - "Two-device failure recipe: install the failing stub with addInitScript on device two before second.app.open, then run the normal two-device conflict"

requirements-completed: [SYNC-05]

coverage:
  - id: D1
    description: "Snapshot write failure (localStorage quota): warn banner with the not-kept text and an acknowledge button, no conflict toast, no snapshot key, #snapshotBtn hidden, server keeps the last save, acknowledge hides the banner"
    requirement: SYNC-05
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 a kept version that does not fit in browser storage is reported by a banner instead of a success notice"
        status: pass
    human_judgment: false
  - id: D2
    description: "Download failure (createObjectURL throws): failure toast, snapshot key kept, #snapshotBtn still visible"
    requirement: SYNC-05
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 a failed download keeps the kept version and says so"
        status: pass
    human_judgment: false
  - id: D3
    description: "Capacity warning at about 72 percent: warn banner with the floor percentage computed independently from the server document, acknowledge hides it and it does not return on the next save"
    verification:
      - kind: e2e
        ref: "tests/cloud/capacity.spec.ts#SYNC-01 a save at 70 percent of the 4 MB limit shows the capacity warning once per page session"
        status: pass
    human_judgment: false
  - id: D4
    description: "Over the 4 MB limit: no PATCH after login, status line toolarge, non-dismissable error banner with no button, the change is in the local cache with dirty true, server document unchanged"
    verification:
      - kind: e2e
        ref: "tests/cloud/capacity.spec.ts#SYNC-01 a save over the 4 MB limit is not sent, keeps the change on this device and shows the over-limit banner"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy path unchanged: app-integrity, storage and smoke 22 cases pass (flaky 0) after each task, SAFE-02 baseline matches"
    verification:
      - kind: e2e
        ref: "npm test over tests/e2e/platform/app-integrity.spec.ts, tests/e2e/storage, tests/e2e/smoke.spec.ts (22 passed, twice)"
        status: pass
    human_judgment: false
  - id: D6
    description: "E10: the banner button wraps to the next line on a narrow screen and a 3-digit-or-less percentage wraps in .sb-msg"
    human_judgment: true
    rationale: "Layout backstop checked by a phone-width screenshot at acceptance, not asserted by a test; the wrapping CSS is from 09-06"

duration: "6 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 09: Failure Reporting and Capacity Guard Summary

**A snapshot that cannot be stored now shows a warn banner instead of a false "kept" toast, a failed download keeps the copy and its button, and cloudSave measures the document in UTF-8 bytes against 4,194,304: a 70 percent warning once per page session, and over the limit nothing is sent while the edit stays dirty in the local cache.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-11-09T09:28:46Z
- **Completed:** 2026-11-09T09:34:21Z (code), SUMMARY and state after
- **Tasks:** 2
- **Files modified:** 6 (1 created)

## Accomplishments

- **Snapshot not stored (T-09-20):** `keepConflict` catches the `localStorage.setItem` failure and calls `showBar("snapfail", ...)` with the S4 text and a `知道了` ghost button, then returns false: no toast, no `#snapshotBtn` change, the upload continues so the server keeps the last save. On a successful write it also clears any earlier `snapfail` banner.
- **Download failure (D-10, E4, E7):** `snapDownload` wraps Blob, `createObjectURL` and the click; on any throw it releases the object URL if one was made, toasts `留底生成失败，本机副本仍然保留` (4000 ms) and returns before the snapshot key is removed, so the key and the button stay.
- **Capacity guard (T-09-21, S9):** `CLOUD_MAX=4194304`; `sizeCheck(s)` runs at the start of `cloudSave`, before the `getOne` and the PATCH. Over the limit: `toolarge` error banner (no button), `sizewarn` hidden, an error with message `数据超过容量上限（4 MB）` and `state: "toolarge"` is thrown. Because `flush` already passed `e.state` to `setStatus` (09-05), the status line shows `保存失败：数据超过容量上限（4 MB）` with `data-state="toolarge"`; the plan's flush change was therefore already in place and no edit to `flush` was needed. At 70 percent or more the `sizewarn` banner shows `已用 {floor pct}%` with `知道了`, which sets an in-memory flag for the rest of the page session.
- **Test numbers:** the 70 percent case seeds `bulkyState('big', floor(4194304 * 0.72))` (about 3.02 MB, 1 million Chinese characters in 50 records of up to 20000 characters; shown percentage 72). The over-limit case seeds 4,190,304 bytes (4,000 under the limit) and then records a text of about 9 KB. **The local cache write succeeded in both cases** (cache record about 2 MB and 2.8 MB of UTF-16), so the over-limit case could assert `dirty: true` and the new record in `usj:v2:<id>:state`; the 09-05 convention (a failed cache write is silent, upload proceeds) was not exercised.

## Task Commits

1. **Task 1 (tracer): snapshot-not-kept banner and download failure handling** - `626f10e`
2. **Task 2: capacity guard with 70 percent warning and over-limit refusal** - `5961ac8`

## Files Created/Modified

- `us-journey-tracker.html` - `keepConflict` failure banner, `snapDownload` failure branch, `CLOUD_MAX`, `sizeAck`, `sizeCheck`, call at the top of `cloudSave`
- `tests/support/constants.ts` - `APP_SHA256` updated in both commits
- `tests/support/strings.ts` - `TOAST_SNAPSHOT_FAILED`, `BANNER_SNAPSHOT_NOT_KEPT`, `BTN_ACK`, `STATUS_TOO_LARGE`, `BANNER_TOO_LARGE`, `bannerCapacity(pct)`
- `tests/support/cloud-data.ts` - `bulkyState(label, targetBytes)` (lands within 3 bytes below the target, records dated outside the frozen week)
- `tests/cloud/conflict-snapshot.spec.ts` - two new cases (six in the file)
- `tests/cloud/capacity.spec.ts` - new, two cases

## Decisions Made

See `key-decisions`. The sync-bar button object uses the field `text` (that is what `drawBar` reads), not `label` as the plan's pseudo-code wrote; toasts use `label`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan defect] Button field name in the banner definitions**
- **Found during:** Task 1
- **Issue:** The plan writes the banner buttons as `{ label, cls, fn }`, but `drawBar` (09-06) reads `x.text`; a `label` field would render an empty button.
- **Fix:** Used `{ text: "知道了", cls: "ghost", fn }`, matching the existing `unreachBar`.
- **Files modified:** us-journey-tracker.html
- **Commit:** 626f10e

**2. [Execution note] flush catch already passes the error state**
- The plan's Task 2 step to change `flush()` was a no-op: 09-05 already calls `setStatus(..., e && e.state)`. Nothing edited there; the legacy path has no state field so it is unchanged (legacy 22/22 after each task).

**Total deviations:** 1 plan-text defect fixed, 1 no-op noted. **Impact:** none on scope.

### Execution notes

- Verify command sets ran 22 legacy cases (app-integrity, storage, smoke) in both tasks; both required titles were present, REPORT OK flaky 0. Task 1 ran conflict-snapshot alone (6 cases); Task 2 ran capacity plus conflict-snapshot (8 cases). The full `test:cloud` was not run (09-10, per the plan).
- No PocketBase process was started; no pocketbase process is running.
- Files in the working tree are LF; git prints its usual LF/CRLF notice.

## Known Stubs

None.

## Threat Flags

None beyond the register: T-09-20 mitigated (banner-only, no toast, no button, no key; case with a storage exception stub); T-09-21 mitigated (70 percent warning, nothing sent over the limit, status and error banner, change kept in cache; both cases).

## Requirements

SYNC-05 is closed by this plan. First half (reconcile before editing, stale cache never overwrites newer data): 09-05, 09-06, 09-07. Second half (real conflict last save wins, overwritten version kept locally and downloadable): 09-08 plus this plan's failure reporting. SYNC-01 is closed by 09-10; TEST-02 stays Pending.

## Issues Encountered

None. E10 (banner button wrapping and the wrapped percentage text at phone width) is left for the acceptance-time screenshot check, as planned.

## Self-Check: PASSED

- Files exist: us-journey-tracker.html, tests/cloud/capacity.spec.ts, tests/cloud/conflict-snapshot.spec.ts, tests/support/constants.ts, tests/support/strings.ts, tests/support/cloud-data.ts.
- Commits 626f10e and 5961ac8 are ancestors of HEAD; `plan_head_before..HEAD` count is 2.
- Verify: conflict-snapshot 6/6 REPORT OK; capacity plus conflict-snapshot 8/8 REPORT OK; legacy 22/22 REPORT OK twice (SAFE-02 and TEST-01 unsupported-backend titles present); staged privacy check passed twice; APP_SHA256 equals the file hash; five anchors exactly once; `CLOUD_MAX`, `TextEncoder`, `没能留底`, `留底生成失败，本机副本仍然保留` present in the app; `export function bulkyState` present.
