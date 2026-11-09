---
phase: 09-login-cloud-storage
plan: 08
subsystem: sync
tags: [conflict, snapshot, download, last-save-wins, two-devices, playwright]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-07 keepConflict hook and complete reconcile table; 09-05 cache and cloudSave; 09-04 two-device harness
provides:
  - cloudSave reads the server document first and keeps the overwritten version when its updated differs from the local base
  - keepConflict(kind, doc) fills the 09-07 hook: single kept copy per account at usj:v2:<id>:snapshot = { kind, data }, conflict toast with a download button, standing #snapshotBtn
  - snapDownload(): state-shaped JSON through Blob and a download link, account-free file name, copy removed on download
affects: [09-09, 09-10, 09-11, phase-10, phase-11]

actuals:
  tokens: 9800
  tasks: 2
  commits: 2
plan_head_before: 1389bf8a950254de9f798ffa7b4cc8fbc7eb92a4
plan_head_after: 57340b9d9cc7ae21e6be1acd6242b387bd7da458

tech-stack:
  added: []
  patterns:
    - "The snapshot holds normalize(serverDoc.data) for state (normalizePlan for plan), so the downloaded file has exactly the backup shape: arrival, tasks, custom, logs, lifts, reviews, presets"
    - "snapShow() is the single place that toggles #snapshotBtn from the presence of the account's snapshot key; called on enterApp, after each reconcile commit, on keepConflict and after download"

key-files:
  created:
    - tests/cloud/conflict-snapshot.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts

key-decisions:
  - "The real-conflict decision point is cloudSave: getOne(docs.state.id) before the PATCH, and cur.updated !== docs.state.base means a conflict. The unchanged-server path costs one extra GET per save. A failed getOne counts as a failed save (status savefailed, edit stays dirty)."
  - "Download removes the snapshot immediately after the link click (D-10) and releases the object URL on the next tick; the failure branch is left to 09-09."
  - "keepConflict returns false and shows nothing when the localStorage write fails (the save-failed banner is 09-09)."

patterns-established:
  - "Two-device conflict recipe: device one and two open on the same account, device one saves first, device two saves second; the later save wins on the server and the earlier version lands in device two's snapshot key"

requirements-completed: []

coverage:
  - id: D1
    description: "Two devices on one account: the later save is what the server holds, the overwritten version is kept on the later device (kind state, logs hold the first entry and not the second), toast says so with the download button, #snapshotBtn is visible there and hidden on the other device"
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 a save over a newer server version keeps the last save, keeps the overwritten version on this device and says so"
        status: pass
    human_judgment: false
  - id: D2
    description: "Download writes a JSON file named 在美国的日子-留底-2026-03-18.json (no email or user id), top-level keys exactly the seven state keys, containing the first entry; the snapshot key is removed, the button hides and the 3000 ms toast shows"
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 downloading the kept version saves a state-shaped JSON file without any account identifier and removes it from this device"
        status: pass
    human_judgment: false
  - id: D3
    description: "A second conflict replaces the first kept copy: exactly one :snapshot key, holding the newer server version"
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 a newer conflict replaces the single kept version"
        status: pass
    human_judgment: false
  - id: D4
    description: "An unsent edit found at startup over a newer server version is uploaded, the server version is kept here, the conflict toast and #snapshotBtn show"
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 an unsent edit found at startup over a newer server version is uploaded and the server version is kept here"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full test:cloud passes (75 cases, flaky 0) and the legacy path is unchanged (app-integrity, export, storage, smoke: 28 cases, flaky 0; app-integrity and smoke again 12 cases after Task 2)"
    verification:
      - kind: e2e
        ref: "npm run test:cloud (75 passed); npm test over app-integrity, io/export, storage, smoke (28 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "E4: the longest notice (conflict toast with its download button) fits and wraps at 375 px and the button is tappable"
    human_judgment: true
    rationale: "Plan marks it a backstop: checked by a phone-width screenshot at acceptance, not asserted by a test"

duration: "~25 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 08: Conflict Snapshot Summary

**Two devices on one account now resolve as last save wins: before each upload the app reads the server document, and when its `updated` differs from the local base it keeps the overwritten version as the single local `usj:v2:<id>:snapshot` copy, says so in a toast with a download button plus a standing `下载留底` toolbar button, and the download is a state-shaped JSON file with an account-free name that removes the copy.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 4 (1 created)

## Accomplishments

- **Where a real conflict is decided:** `cloudSave` calls `pb.collection("journey_docs").getOne(id)` (no query parameters, matching the PB-CONTRACT view-own sample), compares `cur.updated` with `docs.state.base`, calls `keepConflict("state", cur)` on a difference, then PATCHes `{ data, writer }` as before. The startup path (dirty cache, different `updated`) already called `keepConflict` from 09-07's reconcile; it now works without further app change.
- **Snapshot format:** `localStorage["usj:v2:<user id>:snapshot"] = { kind: "state" | "plan", data }`, one copy per account, a new conflict overwrites it. `data` is `normalize(serverDoc.data)` (plan: `normalizePlan(...)`, falling back to the raw data), so the downloaded state file has exactly the seven backup keys.
- **Download:** Blob (`application/json`) plus a temporary `<a download>`; names are `在美国的日子-留底-YYYY-MM-DD.json` and `在美国的日子-计划留底-YYYY-MM-DD.json` (today's local date), with no email, user id or any account identifier. The copy is deleted right after the click, the button hides, the 3000 ms toast shows.
- **Standing button:** `#snapshotBtn` is first in `.toolbar`, `ghost hidden`, styled per S8; `snapShow()` toggles it from the presence of the key on enterApp, after each reconcile commit, on keepConflict and after download. It is already in `GATE_ALLOW`, so it works during the reconcile gate. Legacy mode never shows it (`CLOUD && me && snapshot`).
- **Accepted limitation (T-09-36, accept):** PocketBase 0.41.1 has no conditional update, so a write from another device landing between `cloudSave`'s `getOne` and its PATCH is overwritten without a snapshot. Last save wins is the owner's locked decision; the window is one round trip, there are 3 users each on their own account, and Phase 10's live sync narrows it further. Every conflict the app can see (read `updated` differs from base, or a dirty cache over a newer server at startup) keeps a snapshot.
- **Downloads in tests:** `acceptDownloads: true` is set only for the second device of the download case (`openDevice` option); the base config is unchanged. The file is read inside the case and the context is closed in `finally`, which removes Playwright's download copy.
- **Task 2 needed no app change:** replacement (same key overwritten) and the startup conflict path both worked after Task 1, so Task 2 only added the two cases; `us-journey-tracker.html` and `constants.ts` are not in its commit.

## Task Commits

1. **Task 1 (tracer): real conflict, snapshot, toast, standing button, download** - `1f111f0`
2. **Task 2: single-copy replacement and startup conflict cases** - `57340b9`

## Files Created/Modified

- `us-journey-tracker.html` - `#snapshotBtn` markup and CSS; `snapKey/snapGet/snapShow`, `keepConflict`, `snapDownload`; `cloudSave` reads the server version first
- `tests/support/constants.ts` - `APP_SHA256` updated in the Task 1 commit
- `tests/support/strings.ts` - `TOAST_CONFLICT`, `BTN_DOWNLOAD_SNAPSHOT`, `TOAST_SNAPSHOT_DOWNLOADED`, `FILENAME_SNAPSHOT_FROZEN`
- `tests/cloud/conflict-snapshot.spec.ts` - four cases

## Decisions Made

See `key-decisions`. Also: the extra GET per save did not break any existing cloud case; the full `test:cloud` (75 cases, floor 71 from 09-07 plus four new) passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan defect] Task 1 verify named a smoke case that its command does not run**
- **Found during:** Task 1 verify
- **Issue:** `check-report.mjs` was asked for `IO-01 keeps the export buttons hidden in local mode`, which lives in `tests/e2e/smoke.spec.ts`, but Task 1's `npm test` command ran only app-integrity, io/export and storage, so the report check failed with "title not run" although all 23 cases passed.
- **Fix:** Re-ran the same command with `tests/e2e/smoke.spec.ts` added (28 cases, REPORT OK, flaky 0). No assertion weakened, no title removed.
- **Files modified:** none
- **Commit:** n/a

**2. [Rule 1 - Plan defect] Replacement case flow adjusted so the plan's final assertion is true**
- **Found during:** Task 2 design
- **Issue:** Taken literally (device one records `third` without refreshing), device one's own base is stale after device two's save, so its save is also a conflict and the server then holds `first` and `third`; the planned "kept data contains third and not first" cannot hold.
- **Fix:** Device one reloads (picks up the server version, no conflict) before recording `third`. Then the second snapshot on device two holds the server version with `third` and without `first`. The case also asserts exactly one `:snapshot` key, that device one has no `#snapshotBtn`, and that the newer copy does not contain `fourth`.
- **Files modified:** tests/cloud/conflict-snapshot.spec.ts
- **Commit:** 57340b9

**Total deviations:** 2 (both plan-text defects, no behavior change). **Impact:** none on scope.

### Execution notes

- The case "an unsent edit found at startup" refuses PATCH and GET of the single record as planned; the refused `getOne` is the only request that reaches the browser as a connection error, so `acknowledgeConsoleErrors` counts exactly 1 `ERR_CONNECTION_REFUSED`.
- If `getOne` succeeds, a conflict is found and then the PATCH fails, the snapshot and toast have already been shown while the local version is still unsent. The next save retries, reads the same server version and rewrites the same snapshot, so nothing is lost; the toast wording ("overwritten") is early in that rare case. Left as is; 09-09 handles the save-failure surfaces.
- No PocketBase process was started; all tests use the fake server. Files in the working tree are LF; git prints its usual LF/CRLF notice.

## Known Stubs

None. The snapshot-write failure and download failure branches are intentionally absent here and belong to 09-09 (keepConflict returns false without a toast when the write throws; snapDownload has no failure branch yet).

## Threat Flags

None beyond the register: T-09-18 mitigated (compare before upload, snapshot first, toast plus standing button, cases for two devices, startup and replacement); T-09-19 mitigated (file name has only app name, kind and date; case asserts no email or user id); T-09-36 accepted as documented.

## Requirements

None marked complete (plan `requirements` is empty). SYNC-05 is closed by 09-09, SYNC-01 by 09-10; TEST-02 stays Pending.

## Issues Encountered

None. E4 (375 px display of the longest notice) is left for the acceptance-time screenshot check, as planned.

## Self-Check: PASSED

- Files exist: us-journey-tracker.html, tests/cloud/conflict-snapshot.spec.ts, tests/support/constants.ts, tests/support/strings.ts.
- Commits 1f111f0 and 57340b9 are ancestors of HEAD; `plan_head_before..HEAD` count is 2.
- Verify: test:cloud conflict-snapshot plus multi-device 4/4 and conflict-snapshot plus reconcile-gate 16/16 REPORT OK flaky 0; full test:cloud 75/75; legacy 28/28 (Task 1) and 12/12 (Task 2) REPORT OK; staged privacy check passed twice; APP_SHA256 equals the file hash; five anchors exactly once; `id="snapshotBtn"`, `getOne`, `createObjectURL`, `:snapshot`, `在美国的日子-留底-` present in the app.
