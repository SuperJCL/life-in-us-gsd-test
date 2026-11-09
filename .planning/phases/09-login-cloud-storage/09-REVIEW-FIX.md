---
phase: 09-login-cloud-storage
fixed_at: 2026-11-09T00:00:00Z
review_path: .planning/phases/09-login-cloud-storage/09-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-11-09
**Source review:** .planning/phases/09-login-cloud-storage/09-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (2 critical, 7 warning; the 6 info findings were out of scope and left alone)
- Fixed: 9
- Skipped: 0

Every app-side fix is in `us-journey-tracker.html` only, with `APP_SHA256` updated in the same commit. The five anchor literals still appear exactly once (checked by script before each commit). The legacy (no-backend / `window.claude`) path is untouched: all new logic is behind `CLOUD`, `me` or `data-gate`, or only runs inside cloud-only functions. One shared exception is the new `keepOrphans` flag in `normalize`, which is always false unless cloud code sets it.

**Verification:** run in the main checkout (`workflow.use_worktrees` is false, so no worktree was created). Every new or changed test was run on its own spec file (below-normal priority, 1 worker), and each new test was also run once against the pre-fix app to confirm it fails there (the old app was restored afterwards; nothing of that was committed). One full `npm run test:cloud` ran at the end, result below. The default `npm test` was not run (the orchestrator runs it).

## Fixed Issues

### CR-01: logout only checked this tab's unsaved state

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/logout.spec.ts`
**Commit:** 6fd7aa9
**Status:** fixed: requires human verification (logic change)
**Applied fix:** `onLogoutClick` now uses `unsaved = hasUnsaved() || unsentOf(me).edits` and `snap = !!snapGet() || unsentOf(me).snap`, so a dirty cache or kept version written by another tab triggers the D-05 confirm. D-06 order and D-07 email prefill are unchanged. The cross-tab case in `logout.spec.ts` no longer encodes the silent delete: tab 2's save is refused (`PATCH` refuse) so its edit stays as a dirty cache, tab 1 must show the confirm, "stay" keeps both tabs and the token, "log out anyway" then signs tab 2 out with the info notice and writes nothing for the old account. Fails against the old app (no dialog).

### CR-02: invalid plan document made normalize drop task progress, and the first save uploaded it

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/account-data.spec.ts`
**Commit:** ac5f9c7
**Status:** fixed: requires human verification (logic change)
**Applied fix:** I chose the review's "keep keys" variant rather than a read-only gate. A module flag `keepOrphans` is set by the cloud callers (`enterApp` cached path, `reconcileOnce`) from `!usePlan(...)`; while it is true `normalize` keeps well-formed progress keys (`TASK_KEY_RE`) that are not in the fallback plan, so Phase 7 D-08 only drops orphans against the account's real, loaded plan. `resetSession` clears the flag. Also, an invalid plan document is now cached exactly as the server sent it, not as the normalized fallback; otherwise the second start would have read the fallback from a "clean" cache, treated it as the real plan and dropped the keys then. The legacy path never sets the flag. New test: state seeded with a personal-plan task key, a `P9-9` key and a default-plan key, plan document invalid; after the first save and after a reload plus a second save the server `tasks` equals the seed and the plan document is never written. Fails against the old app (keys missing).

### WR-01: cloudSave mistook its own write for another device and announced before the overwrite

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/conflict-snapshot.spec.ts`
**Commit:** f53301c
**Status:** fixed: requires human verification (logic change)
**Applied fix:** `cloudSave` calls the conflict path only when the server version is newer than the base, its `writer` is not this page's `WRITER`, and its content differs from the upload (`canon`). The kept copy and the notice now happen after `update` succeeded. `keepConflict` was split: it only writes the kept copy and returns whether that worked; the new `conflictNotice(kept)` shows the toast or the snapfail banner. D-08..D-11 are unchanged (single snapshot, deleted on download click, account-free filename). The same split applies to the startup reconcile path with one deliberate difference: there the kept copy is still written before the upload (an abandoned or superseded run could otherwise overwrite the server without ever keeping the other device's version) and only the notice waits for the successful `update` and `live()`. The writer check is applied there too. Two new tests: (a) a no-op `PATCH` by the same writer (a lost response) followed by a save keeps no version and shows no notice; (b) a refused `PATCH` on a stale base keeps no version and shows no toast, and the next successful save keeps it and announces it. Both fail against the old app.

### WR-02: onAuthChange was never registered after an SDK load failure

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/same-origin.spec.ts`
**Commit:** c19d942
**Applied fix:** `pb.authStore.onChange(onAuthChange)` moved into `startPb()` and removed from `cloudInit`. New test: tampered SDK first (page stays on the login page), route removed, sign in, then log out in a second tab; tab 1 must follow and show the other-tab notice. Fails against the old app.

### WR-03: blob address revoked on the next tick after the click

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/conflict-snapshot.spec.ts`
**Commit:** ae708b3
**Applied fix:** only the revoke delay changed, 0 to 30000 ms. D-10 is kept as decided: the kept copy is still deleted on the click. New test (manual clock on the second device, `URL.revokeObjectURL` recorded): zero revokes after the click and at 29 s, exactly one at 31 s. Fails against the old app.

### WR-04: no timeout on realtime.unsubscribe() during logout

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/logout.spec.ts`
**Commit:** a37d082
**Applied fix:** `await Promise.race([pb.realtime.unsubscribe(), new Promise(r => setTimeout(r, UNSUB_MS))])` with `UNSUB_MS = 3000`. The source-order test (unsubscribe, then removal, then token clear) still holds. New test: the SDK's `RealtimeService.prototype.unsubscribe` is replaced by a never-resolving promise in the page (no server fault, no `setOffline`); manual clock; the button shows "正在退出…" and is disabled, nothing is cleared at 2.9 s, and at 3.1 s the login page is shown with caches and token gone and the button restored. This also gives `BTN_LOGGING_OUT` its first assertion (IN-02, partly). Fails against the old app (stays on "正在退出…").

### WR-05: persist() ignored cache write failures

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/support/strings.ts`, `tests/cloud/capacity.spec.ts`
**Commit:** fd806c9
**Applied fix:** `persist()` passes the `cachePut` result to a new `cacheNote(ok)`. On failure it sets `cacheFull`, shows a warn banner (`cachefail`, with an acknowledge button) and, if the upload then fails too, the status line says the edit was not kept (`T_NOCACHE`) instead of "修改仍在本机...". A later successful cache write or a fully uploaded state hides the banner and clears the flag. Related hazard fixed in the same change: a clean record that cannot be written (after a successful save, or in the reconcile settle step) is removed from the cache, so an older dirty record can never later be treated as unsent work and uploaded over newer server data. Note: the two new sentences (banner and status line) are not in 09-UI-SPEC.md; they are in `tests/support/strings.ts` as `BANNER_CACHE_FULL` and `STATUS_SAVE_FAILED_NO_CACHE`, and the UI-SPEC was not edited. New test: quota error injected for the state key only, upload refused once; banner and status shown, cache holds no trace of the edit, then after recovery the next save uploads both edits, clears the banner and leaves a clean cache. Fails against the old app.

### WR-06: the 401 branch bypassed resetSession and other tabs misreported an expiry

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/session.spec.ts`, `tests/README.md`
**Commit:** a110311
**Applied fix:** the 401 branch now runs `endRun`, `expireToken()`, `resetSession()` and `showLogin("", "expired")`. `resetSession` does not touch localStorage, so the account's caches are kept (expired login keeps the cache). `expireToken()` writes a marker key `usj:v2:authExpired` before clearing the token; `onAuthChange` reads it so other tabs show "登录已过期" instead of "已在另一个标签页退出登录"; a successful sign-in removes it. The local-exp expiry path at startup uses the same helper. The cloud save status line no longer prints a raw `e.message` for errors that carry no `state` (it says "未知错误"); the legacy path text is unchanged. New test: tab 1 reloads onto a revoked token; tab 1 shows the expired notice and no longer holds the account's records in the DOM, tab 2 shows the expired notice (not the other-tab one), the account's cache and the token behaviour are as decided, and the marker is gone after signing in again. Fails against the old app (records still in the DOM). `tests/README.md` lists the new key.

### WR-07: the gate test passed with the capture guard removed

**Files modified:** `tests/cloud/reconcile-gate.spec.ts`
**Commit:** 6112669
**Applied fix:** the test reads the local state cache when the gate starts and, before the reconcile is released, requires it to be identical (`dirty:false`, same `seq` and data). Proven locally once: with the guard skipped only for `#review` and `#arrival`, the old test version still passes (the gap the review described) and the new one fails on `dirty:true` / `seq:2`. That local weakening was restored and not committed. The Edit tool normalised this file's pre-existing mixed line endings to all CRLF in the working tree; the index form (LF, autocrlf) is unchanged and the diff is the 9 added lines only.

## Skipped Issues

None.

## Notes for the orchestrator

- Info findings IN-01..IN-06 were not touched, except that WR-04's test now asserts `BTN_LOGGING_OUT` (part of IN-02).
- Test notes: the fake server has no "answer lost after success" switch, so WR-01's own-write case is built by a Node-side no-op `PATCH` with the page's `writer` (read from the server record) between two page saves; no new switch was added to `tests/mocks/pb-server.ts`.
- Privacy: `node tools/privacy/privacy-check.mjs --staged` printed `隐私检查通过` before every commit. Only synthetic data was added.

## Final run

- Full `npm run test:cloud` (below-normal priority, 1 worker, run once after the last fix, main checkout): 110 passed, 0 failed, 0 retried, 0 flaky.
- Extra targeted run of the default config (not the full `npm test`): `tests/e2e/platform/app-integrity.spec.ts`, `tests/e2e/security/state-validation.spec.ts` and `tests/e2e/data`: 19 passed (SAFE-02 hash baseline matches the final app file; the `normalize` change did not disturb the Phase 7 unit cases).
- Final `APP_SHA256`: `2fddc13bac8a83a756364b048de1e8e2f7917741ade894fb46e08cfcb9c4f765`.

---

_Fixed: 2026-11-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
