---
phase: "09"
fixed_at: 2026-11-09T00:00:00Z
review_path: .planning/phases/09-login-cloud-storage/09-SECURITY.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 9: Security Fix Report

**Fixed at:** 2026-11-09
**Source review:** `.planning/phases/09-login-cloud-storage/09-SECURITY.md` (Open Threats)
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (T-09-18 high, T-09-21 medium)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### T-09-18: a real conflict overwrote the other device's data without a kept copy

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/mocks/pb-server.ts`, `tests/mocks/PB-CONTRACT.md`, `tests/cloud/conflict-snapshot.spec.ts`, `tests/cloud/pb-faults.spec.ts`
**Commit:** 43c8b90
**Status:** fixed: requires human verification (logic change)
**Applied fix:**
- `cloudSave` now keeps the other device's version silently with `keepConflict` right after `getOne` detects a real conflict (server version newer than the base, writer not this page, content different from the upload) and BEFORE `update`. WR-01's own-write and equal-content exclusions are unchanged.
- The notice is no longer tied to that one save. The result of `keepConflict` goes into a module variable `snapPending` (null, true or false). The first upload that succeeds afterwards calls `conflictNotice` once and clears it. This covers the lost-answer case, where the next save no longer sees a conflict (same `writer`, same content) but the copy exists and was never announced. If the copy was downloaded in between, a successful copy is not announced. A newer conflict replaces the single copy and the pending value (D-09). `resetSession` clears `snapPending`. D-08..D-11 are unchanged.
- If the update fails, the copy stays without a notice. The next successful save or the next start announces it, or shows the toolbar entry, without duplicating the copy. The startup reconcile path already kept first and is untouched.
- Fake server: new explicit fault mode `lose-answer`. `handle()` applies the request (it appears in `requests`, deliveries are sent), the browser-side response is aborted with `route.abort('connectionreset')`, and `faultHits` records status 0. It is listed in PB-CONTRACT section 10 as unrecorded test-only behaviour, not an intentional deviation.
- Tests: the existing refused-PATCH case in `conflict-snapshot.spec.ts` now expects a silent copy (content is the other device's version, no toast, toolbar entry hidden) and then the notice after the next successful save. New case "overwrite reached the server but the answer was lost": the server holds the second device's version, the other device's version is kept as the snapshot, there is no notice yet, and after the next successful save the toast with the download button and the toolbar entry appear and the kept copy is unchanged. New self-test for the switch in `pb-faults.spec.ts`. Both conflict cases fail against the pre-fix app (verified once, app restored, not committed).

### T-09-21: the startup reconcile uploaded an over-limit cache without a capacity check

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/capacity.spec.ts`
**Commit:** 6a214d8
**Applied fix:**
- `sizeCheck` was split into `sizeOf`, `showTooLarge` and the existing throwing check, which now shares them. In `reconcileOnce`, `resolve()` measures the local version before the create call and before the update call. Over 4 MiB nothing is sent. The result is marked `held`.
- A held document keeps its cache record untouched (dirty, old `base`, same `seq`), so a later save still detects a conflict against the newer server version and keeps it then. In memory `docs.*` is `dirty: true` with the old base, and the page shows the local data.
- After the commit the page shows the existing banner (`toolarge`) and the status `保存失败：数据超过容量上限（4 MB）` with `data-state="toolarge"` instead of "已同步". The reconcile no longer throws here, so there is no retry loop and no "连不上服务器". The page is editable. A later save still goes through `sizeCheck`.
- Tests: two new `capacity.spec.ts` cases. (a) An over-limit dirty cache on reload sends no PATCH and no create, the server content is unchanged, `data-state="toolarge"`, the toolarge banner without the unreachable banner or buttons, the cache is still dirty and the gate is open. (b) The same when the server state document is gone (`dropDocs`): no create is sent. Both fail against the pre-fix app (status stayed `slow`, the PATCH or create went out).

## Verification

- Where verification ran: the main checkout (`workflow.use_worktrees` is false), so the numbers can be reproduced from this tree.
- Targeted runs (below-normal priority, `--workers=1`): conflict-snapshot, pb-faults, pb-contract (46 passed); conflict-snapshot, capacity, reconcile-gate, multi-device (29 passed).
- One full `npm run test:cloud` at the end: 114 passed, 0 failed (110 before plus 4 new). The default full `npm test` was not run (the orchestrator does).
- Final `APP_SHA256`: `b55b472cedee0bfedffaaa9d92bcb5821ff8009b7cf9549910e96cb032acc354` (updated in the same commit as each app edit; the five anchors each appear exactly once).
- `node tools/privacy/privacy-check.mjs --staged` printed `隐私检查通过` before both commits. Only synthetic data was added.

## Notes for the reviewer

- Logic changes: both fixes need a human look. In particular, the toolbar entry stays hidden while a copy is kept but not yet announced (it appears with the notice, as before WR-01 in the startup path).
- If the plan document (not the state document) is the held one, the next state save clears the toolarge banner, because `sizeCheck` only measures the state. A plan over 4 MiB is not reachable in Phase 9 (plan editing arrives later), so this was left alone.
- T-09-36 (AR-02) wording "every conflict the app can detect is kept" is now true again for the save path and the startup path.

---

_Fixed: 2026-11-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
