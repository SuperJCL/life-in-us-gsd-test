---
phase: 09-login-cloud-storage
plan: 05
subsystem: sync
tags: [local-cache, reconcile, edit-gate, toast, pocketbase, playwright]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 cloud path (cloudInit, enterApp, cloudSave, setStatus), 09-03 fault switches (hold), 09-04 shared harness
provides:
  - per-account local cache usj:v2:<user id>:plan|state with value { id, base, dirty, seq, data } (costly, Phase 10 reuses it)
  - reconcile table rows 1-4 (server only, clean cache same updated, clean cache older than server, missing server document)
  - edit gate body[data-gate] with applyGate(), GATE_ALLOW, GATE_BLOCK and a window capture guard
  - toast(m, act, ms) third argument and data-cloud; D-04 notice
  - savefailed status line for failed cloud saves
affects: [09-06, 09-07, 09-08, 09-09, 09-13, 09-14, phase-10]

actuals:
  tokens: 7400
  tasks: 2
  commits: 2
plan_head_before: a89c1bd45c3b0a80fcf8d301bc3dd292160b0918
plan_head_after: 6acaa4e6a83ed8b1f0685a81dceaae4ac9a5db35

tech-stack:
  added: []
  patterns:
    - "all new behavior is on the CLOUD branch or conditional on body[data-gate]; the legacy path never has data-gate and toast() without ms is unchanged"
    - "gate marks are recorded per element in data-gated tokens (d disabled, a aria-disabled and tabindex, g draggable) so release restores only what the gate changed"
    - "the cache is written synchronously by persist() before the 600 ms debounced upload; cloudSave clears dirty only if seq did not move during the upload"

key-files:
  created:
    - tests/cloud/reconcile-gate.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/KNOWN-BUGS.md

key-decisions:
  - "Cache key and value (costly, Phase 10 reuses): usj:v2:<user id>:state and :plan hold { id, base, dirty, seq, data }, base is the server-issued updated stamp, data is the normalized object; usj:v2:lastUser holds the id. The old local-mode key us-journey-tracker-v1 is never reused. All keys of one account share the prefix usj:v2:<id>: so 09-13/09-14 can delete them as a group."
  - "authRefresh moved from cloudInit into enterApp(refresh) so the cached content renders and the gate goes up before the refresh request; a 401 clears the token, me and docs, and shows the login page."
  - "applyGate also runs at the end of renderTimeline (not in the plan's list): the timeline filter calls renderTimeline alone and would otherwise rebuild unmarked data-edit entries during the gate."
  - "applyGate skips controls that are already disabled so the empty-draft record button is not enabled again on release; the gate CSS adds body[data-gate] .primary:disabled{opacity:.4}, because the spec's generic gate rule is more specific than .primary:disabled and would have made it .55."
  - "showLogin calls setGate(null) so a failed reconcile does not leave a gate behind a hidden shell."

patterns-established:
  - "Compare cache and server content with canon() (key-sorted JSON), so a reordered object with the same content does not trigger the D-04 notice"
  - "Gate tests run under a manual clock; hold the list request with the 09-03 switch and release after the assertions; filter writes to journey_docs POST/PATCH (auth-refresh is also a POST)"

requirements-completed: []

coverage:
  - id: D1
    description: "A returning session renders the cached content first with every editing control disabled and the status line reconciling; view-only controls stay usable; editing is released and the status returns to synced after the reconcile, with no write sent"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a returning session renders the cached content with editing disabled until the reconcile finishes"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cache older than the server is replaced by the server version, nothing is uploaded, the cache is rewritten clean and the D-04 notice shows"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a stale cache is replaced by the newer server version without being uploaded and a notice is shown"
        status: pass
    human_judgment: false
  - id: D3
    description: "The same server version (updated equal) is used as is with no notice and no upload (PLAN-01 adjacency)"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 an unchanged server version is used as is with no notice and no upload"
        status: pass
    human_judgment: false
  - id: D4
    description: "Clicks, keys, drags, scripted checkbox clicks and scripted input and change events during the reconcile change nothing and send no write (guard removal was checked to fail this case)"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 clicks, keys and drags on editing controls during the reconcile change nothing and send no write"
        status: pass
    human_judgment: false
  - id: D5
    description: "Legacy path unchanged: SAFE-02, known-bugs registry, app-integrity, storage, smoke, week composer and drag, and all four view directories (74 cases)"
    verification:
      - kind: e2e
        ref: "npm test over tests/e2e/platform/known-bugs-registry, app-integrity, week, calendar, goals, timeline (74 passed, 0 flaky); earlier subset over app-integrity, storage, smoke, week/composer, week/drag (29 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual look of the disabled state (55% fade, not-allowed cursor, no layout shift) and of the toast against UI-SPEC S3 and S5"
    verification: []
    human_judgment: true
    rationale: "No test asserts opacity, cursor or layout height; only the disabled state and the guard behavior are covered."

duration: "~12 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 05: Reconcile Gate Summary

**Per-account local cache that renders first, a body[data-gate] edit gate with a capture-phase safety net, and reconcile rows that adopt a newer server version without ever uploading the old cache, with a 4000 ms notice when content was replaced.**

## Accomplishments

- Cache layer: `cacheKey`, `cacheGet`, `cachePut` (quota errors swallowed, no console), value `{ id, base, dirty, seq, data }`, `usj:v2:lastUser`. `persist()` writes the state cache synchronously and bumps `seq`; `cloudSave` clears `dirty` only when `seq` did not change during the upload, rewrites the cache, and on failure throws a `savefailed` error so the status line reads `保存失败：修改仍在本机，下次修改或重新打开时会再上传` with `data-state="savefailed"` (legacy errors keep no data-state).
- Reconcile rows implemented (plan first, then state): server only, or no cache, uses the server version; clean cache with `base === updated` is used as is; clean cache and different `updated` adopts the server version and rewrites the cache (never uploads), counting as "content updated" only when the canonical JSON differs; missing server document keeps the 09-01 create. Finishing releases the gate, writes `已同步`, redraws, and shows the D-04 toast (`ms` 4000).
- Gate: `setGate`/`applyGate`, `GATE_ALLOW` (tabs, week and month paging, timeline filters, `.cell`, `#syncbar button`, `#logoutBtn`, `#snapshotBtn`; `.day` is allowed by the guard), `GATE_BLOCK` (15 data-attribute selectors), window capture guard for click, Enter/Space, dragstart, drop, change, input, early return in `openEditor` and `openTaskEditor`, flush returns while gated. `applyGate()` is called from `renderAll`, `renderWeek`, `renderDay`, `renderGoals` and `renderTimeline`.
- `toast(m, act, ms)`: `ms` sets `data-cloud` and the duration; without it the structure and the 1800/5000 ms durations are unchanged.
- tests/KNOWN-BUGS.md B3 now notes the D-01 fix on the cloud path (table untouched).

## Task Commits

1. **Task 1 (tracer): cached session renders behind the gate, then reconciles** - `7d4eec4`
2. **Task 2: capture guard, block list, same-version case, B3 note** - `6acaa4e`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] applyGate also at the end of renderTimeline**
- **Found during:** Task 1
- **Issue:** the timeline filter buttons call `renderTimeline()` alone; the plan only hooks `renderAll`, `renderWeek`, `renderDay`, `renderGoals`, so the rebuilt `data-edit`/`data-edittask` entries would lose their `aria-disabled` and `tabindex -1` marks during the gate.
- **Fix:** one `applyGate()` call at the end of `renderTimeline` (a no-op without `data-gate`).
- **Files modified:** us-journey-tracker.html
- **Commit:** 7d4eec4

**2. [Rule 1 - Bug] Gate CSS would have faded the empty-draft record button to 55%**
- **Found during:** Task 1
- **Issue:** `body[data-gate] :is(button,...):disabled` is more specific than `.primary:disabled{opacity:.4}`, contradicting the spec's statement that `.4` stays; also, restoring blindly would have enabled the always-disabled record button.
- **Fix:** `applyGate` skips controls that are already disabled; added `body[data-gate] .primary:disabled{opacity:.4}`.
- **Files modified:** us-journey-tracker.html
- **Commit:** 7d4eec4

**3. [Rule 3 - Blocking] authRefresh moved into enterApp**
- **Found during:** Task 1
- **Issue:** the plan wants the cached content rendered and gated before `authRefresh`, but `cloudInit` ran the refresh first.
- **Fix:** `cloudInit` calls `enterApp(true)`; `enterApp` renders the cache, then refreshes (401 clears the token and shows login), then loads documents. Login path calls `enterApp()` without refresh as before. `showLogin` also clears the gate.
- **Files modified:** us-journey-tracker.html
- **Commit:** 7d4eec4

**Total deviations:** 3 auto-fixed (1 Rule 1, 1 Rule 2, 1 Rule 3). **Impact:** none on scope; all inside the cloud path or gated by `data-gate`.

### Known gap (planned for 09-07)

A cache with `dirty: true` is not reconciled here. In that case the server version is shown in memory, nothing is uploaded, and the dirty cache record is left untouched in storage (not overwritten) so 09-07 can handle "dirty cache" rows. A first edit afterwards rewrites the cache record. Not covered by a case in this plan, as the plan assigns those rows to 09-07.

## Cache and Reconcile Reference (costly, Phase 10 reuses)

| Item | Value |
|------|-------|
| Keys | `usj:v2:<user id>:state`, `usj:v2:<user id>:plan`, `usj:v2:lastUser` |
| Value | `{ id, base, dirty, seq, data }`; `base` = server-issued `updated`; `data` = normalized object |
| Implemented rows | server only / no cache -> server; clean + same updated -> cache; clean + newer server -> server, no upload, notice if content differs; no server doc -> create |
| Not implemented (09-07) | dirty cache, rebuild from cache, first-create race |
| GATE_ALLOW | `nav.tabs [data-tab]`, `#wkPrev`, `#wkNow`, `#wkNext`, `#prev`, `#todayBtn`, `#next`, `.filters button`, `.cell`, `#syncbar button`, `#logoutBtn`, `#snapshotBtn` (guard also lets `.day` through) |
| GATE_BLOCK | `[data-edit]`, `[data-edittask]`, `[data-dellog]`, `[data-deltask]`, `[data-preset]`, `[data-pdel]`, `[data-padd]`, `[data-pedit]`, `[data-ccat]`, `[data-task]`, `[data-due]`, `[data-lift]`, `[data-liftsave]`, `[data-addto]`, `[data-addbtn]` |

## Requirements

None marked complete (plan `requirements` is empty). SYNC-05 is closed by 09-09; TEST-02 stays Pending.

## Threat Flags

None. New surface is the local cache in localStorage (T-09-13, keyed by user id, removal on logout in 09-13/09-14) and the gate (T-09-11, T-09-12 mitigated and tested).

## Known Stubs

None.

## Issues Encountered

None. The first run of the stale-cache and first gate cases failed once because the write filter counted the `auth-refresh` POST; the helper now counts only `journey_docs` POST/PATCH (test fix, no app change).

## Self-Check: PASSED

- Created and modified files exist on disk: tests/cloud/reconcile-gate.spec.ts, us-journey-tracker.html, tests/support/constants.ts, tests/support/strings.ts, tests/KNOWN-BUGS.md.
- Commits 7d4eec4 and 6acaa4e are ancestors of HEAD; `plan_head_before..HEAD` count is 2.
- Verify commands: reconcile-gate + login 8/8, REPORT OK (flaky 0); legacy subset 29/29 and 74/74 (min-expected 74), REPORT OK; staged privacy check passed for both commits; APP_SHA256 equals the file hash.
