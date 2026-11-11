---
phase: 11-export-import-migration
plan: 06
subsystem: sync-import
tags: [import, undo, snapshot, localStorage, confirm, sync, playwright, cloud]

requires:
  - phase: 11-export-import-migration (11-01..11-05)
    provides: applyImport (takeRemote, preview, capacity check, plan replacement, commit(["import"])), importLines, importPreview/withPlan, adoptPlanTab storage branch
  - phase: 10-offline-realtime-sync
    provides: commit/ops/opsOk, pendRemote/takeRemote, isBusy and the confirm-time close listener, realtime updates
  - phase: 09-login-cloud-storage
    provides: confirmBox, the conflict snapshot slot (separate), logout and account-switch clearing (D-05, D-06)
provides:
  - "usj:v2:<account id>:importundo = {at, plan, state, after}: the account's plan data and records before the last import, plus the fingerprint of what the import produced; written before anything changes, an import that cannot write it is refused"
  - "undoKey(), undoGet(), undoShow(), undoPlanData(), dataPrint(p, s), async undoImport(); #undoImportBtn in the toolbar after #snapshotBtn; the import toast carries a 撤销导入 button (8000 ms)"
  - "D-05 re-check: a confirm before the undo when anything changed since the import, shown again with one extra line when more changes were synced in while it was open"
  - "logout, account switch and resetSession clear/hide the undo copy; the logout confirm gets a line; other tabs of the same browser follow through the storage event"
affects: [11-07, 11-08, 11-09, 11-10, 11-11]

actuals:
  tokens: 11100
  tasks: 2
  commits: 2
plan_head_before: 5ea5b0f943016715297fd4400abb1cbe8399a544
plan_head_after: 28675d7f48e7b7e2d85f1c68a520b6a26e7a7a1d

tech-stack:
  added: []
  patterns:
    - "the undo restore uses the import's own write path: takeRemote, usePlan + dirty plan cache, commit([\"import\"], whole-state replace), opsOk=false; state and plan are never replaced directly"
    - "re-check loop: confirm, take in the waiting remote version, recompute the fingerprint, confirm again while it differs from the one the user saw; the last comparison and the restore have no await between them"
    - "the fingerprint is stored as a string (FNV-1a 32 bit over canon) instead of a second copy of the imported data, so the local footprint of the slot is one copy of the data before the import"

key-files:
  created:
    - tests/cloud/import-undo.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/import.spec.ts

key-decisions:
  - "undoPlanData() takes the plan cache's data when it is readable and an object, else the working plan, on both sides (import time and undo time); the fingerprints always use the working plan and state"
  - "undoImport also stops when the slot was replaced while a confirm was open (the record's at changed, e.g. another tab imported) - the user confirmed an undo of different data"
  - "the account-switch case of the lifecycle test runs without the 换账号登录 confirm (account A has nothing unsent, so the existing rule asks nothing); the clearing runs on that path too and is asserted there"

requirements-completed: [IO-08]

coverage:
  - id: D1
    description: "An import keeps the plan and records from before it on this device (a slot of its own); an import that cannot keep it is refused with a clear toast and changes nothing (T-11-14)"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 an import is refused when the data before it cannot be kept on this device"
        status: pass
    human_judgment: false
  - id: D2
    description: "After an import the toolbar and the import toast offer 撤销导入; the undo returns the server's plan and records to the state before the import, the other device follows and never shows the entry"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 an import can be undone on this device, the server returns to the data before it and the other device follows (D-04)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-05: an undo after later edits asks first and undoes them too; cancelling changes nothing"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 undoing after later edits asks first and undoes them too (D-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-05: a change synced in while the undo confirm is open is named in a second confirm before anything is undone; the server keeps it until then; cancelling keeps it"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 a change synced in while the undo confirm is open asks again before it is undone (D-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Lifecycle: the entry survives a reload and the next import replaces the copy; logout and an account switch clear it and the logout confirm says the undo will be lost (T-11-13); another tab of the same browser shows and hides the button; a remote change waiting at import time is restored by the undo"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 the undo entry survives a reload and is replaced by the next import"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 logout and switching accounts clear the import undo copy and the logout confirm says the undo will be lost"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 the undo entry shows and hides in another tab of the same browser"
        status: pass
      - kind: e2e
        ref: "tests/cloud/import-undo.spec.ts#IO-08 the undo restores a remote change that was waiting when the import was made"
        status: pass
    human_judgment: false
  - id: D6
    description: "The sync core and the Phase 9/10 behaviour are unchanged: the full cloud suite passes after the change (logout, session, reconcile-gate, realtime, capacity, import, conflict snapshot)"
    requirement: IO-08
    verification:
      - kind: e2e
        ref: "npm run test:cloud (full, 183 cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Wording and placement of the new toolbar entry, toast and confirm lines read naturally in the real Edge with a synthetic file (owner acceptance in the phase's closing plan)"
    verification: []
    human_judgment: true
    rationale: "Tone and button placement are judged by the owner in the real browser; the cases only compare the strings byte for byte"

duration: 55min
completed: 2026-11-10
status: complete
---

# Phase 11 Plan 06: Import undo Summary

**Every cloud import now keeps the plan and records from before it on the importing device (a slot of its own, refused if it cannot be stored), and 撤销导入 restores them through the import's own write path, asking first about every change present at that moment, including ones synced in while the confirm was open.**

## Performance

- **Duration:** about 55 min
- **Completed:** 2026-11-10
- **Tasks:** 2
- **Files modified:** 5 (1 created)

## Accomplishments

- **Slot** `usj:v2:<account id>:importundo = {at, plan, state, after}` (`undoKey()`, `undoGet()` accepts only object `plan`/`state` and string `at`/`after`; anything else is null). It sits right after `snapDownload` and is independent of the conflict slot `:snapshot` (Phase 9 D-09 still holds: one kept conflict copy per account).
- **Where it is written in `applyImport`:** after `takeRemote()`, the preview and the capacity check (`tooLarge`), and before the plan is replaced or `commit` runs. `plan` = `undoPlanData()` (plan cache data when readable, else the working plan), `state` = deep copy of the working state (which already contains a remote version that was waiting: `takeRemote()` ran first), `after` = `dataPrint` of the plan and records the import produces (`withPlan(pv.plan, ...)` when the file has a plan, else the working plan). `localStorage.setItem` throwing means `renderKeep()`, `toast(T_IMP_NO_UNDO, null, 6000)` and return, nothing changed. Success ends with `undoShow()` and `toast(T_IMPORTED, {label: T_UNDO_BTN, fn: undoImport}, 8000)`. A new import overwrites the slot.
- **`dataPrint(p, s)`:** FNV-1a 32 bit over the UTF-16 code units of `canon({p, s})`, returned as 8 hex digits (placed right after `canon`). Used only for equality; nothing but the string is stored. The slot holds one copy of the pre-import data and no copy of the imported data.
- **`undoImport()` flow:** no slot, no session, or the edit gate on: return. Record the session epoch, `fold()` (`takeRemote()`; when it took something, `remoteView=false`, hide the remote bar, `renderKeep()`), `seen = dataPrint(plan, state)`. When `seen !== rec.after`: loop { `await confirmBox(...)` with lines `[T_UNDO_CHANGED]` (first time) or `[T_UNDO_CHANGED, T_UNDO_MORE]` (afterwards); stop on no/epoch change/`me` gone/gate on/slot gone or replaced (`at` differs); `fold()` again (the confirm-time `cfDlg` close listener may already have applied a change that arrived while it was open, or it is still in the waiting slot); recompute the fingerprint; leave the loop when it equals `seen`, else `seen = now` and ask again }. With nothing changed since the import there is no confirm and no await at all. The restore follows with no await after the last comparison: when the plan data differs from `undoPlanData()` it does `keepOrphans = !usePlan(rec.plan)`, plan dirty, seq + 1, `cachePut("plan", ...)`; then `commit(["import"], whole-state replace)`, `opsOk = false`, banner `cacheNote(false)` when the plan did not reach the cache, `removeItem(undoKey())` (used up, D-04), `undoShow()`, `renderKeep()`, `toast(T_UNDONE, null, 4000)`.
- **Toolbar:** `<button class="ghost hidden" id="undoImportBtn" ...>撤销导入</button>` after `#snapshotBtn`; the CSS rule is `#snapshotBtn,#undoImportBtn{...}` (same tone, 12px); not in `GATE_ALLOW` (disabled during the edit gate). `undoShow()` is called from `enterApp`, after the reconcile pass and from `resetSession` (hide).
- **Summaries:** `importLines` ends all three kinds with `T_IMP_UNDO_NOTE` (after any orphan highlight line, not highlighted).
- **Lifecycle (Task 2):** `logout()` and the account-switch login clear `["state","plan","snapshot","importundo"]` (before the token is cleared, D-06 order unchanged); `onLogoutClick` asks when `unsaved || snap || undo` and adds `T_CF_UNDO` after the account, unsaved and snapshot lines; the `storage` listener calls `undoShow()` for the account's `importundo` key and returns (other tabs of the same browser).
- **Tests:** 8 new cloud cases in `tests/cloud/import-undo.spec.ts`; the summary arrays in `tests/cloud/import.spec.ts` end with `IMPORT_UNDO_NOTE`.

## Task Commits

1. **Task 1: undo slot, button and toast, undoImport with the D-05 re-check** - `2a559c7` (feat)
2. **Task 2: lifecycle (logout, account switch, other tabs, logout confirm line)** - `28675d7` (feat)

**Plan metadata:** recorded in the docs commit that follows this summary.

## Files Created/Modified

- `us-journey-tracker.html` - slot functions, `dataPrint`, `applyImport` write, `undoImport`, button and CSS, summary line, logout/switch clearing, logout confirm line, storage-event branch
- `tests/support/constants.ts` - APP_SHA256 re-recorded in both tasks (now `2a82a8fc...`, the Task 2 file)
- `tests/support/strings.ts` - `BTN_UNDO_IMPORT`, `IMPORT_UNDO_NOTE`, `TOAST_IMPORT_NO_UNDO`, `CONFIRM_UNDO_TITLE`, `CONFIRM_UNDO_CHANGED`, `CONFIRM_UNDO_MORE`, `BTN_UNDO_CANCEL`, `BTN_UNDO_OK`, `TOAST_UNDONE`, `CONFIRM_LOGOUT_UNDO`
- `tests/cloud/import.spec.ts` - summary arrays end with `IMPORT_UNDO_NOTE`; the orphan-line assertion checks the last two lines
- `tests/cloud/import-undo.spec.ts` - new, 8 cloud cases

## Decisions Made

See key-decisions. No change to the owner's decisions D-01..D-10; D-04 (slot kept until the next import or logout, used up by a successful undo), D-05 (named confirm before undoing later changes) and D-09 (undo cloud-only; the legacy path never writes a slot and `undoShow()` hides the button there) are implemented as written.

## Deviations from Plan

None - plan executed exactly as written.

The TDD order was followed per task: the four Task 1 cases were run first against the old app and all four failed on their planned assertions (toast button absent, no `#undoImportBtn`, import not refused); Task 2 was run against the Task 1 app: the logout/switch case and the two-tab case failed, while the reload/replace case and the waiting-remote case already passed (they exercise behaviour that follows from Task 1's design). One commit per task, as in 11-01..11-05.

Mutation check for the hard D-05 requirement: with `if(cur===seen)break;` replaced by `break;` the case `IO-08 a change synced in while the undo confirm is open asks again before it is undone (D-05)` fails (the undo goes ahead without the second confirm) and the other three Task 1 cases still pass; the line was restored before the commit.

## Issues Encountered

- A Python edit script run in Git Bash on Windows wrote CRLF line endings into `us-journey-tracker.html` and the new spec at one point (the repo and SAFE-02 expect LF). It was noticed through `git diff --stat` warnings and fixed (converted back to LF, then the later edits wrote bytes with `newline=''`) before APP_SHA256 was recorded and before any commit. The committed files are LF.
- `test-results/` is cleared by every Playwright run, so a log file written there during the full run disappeared; the `check-report` result (the plan's gate) was unaffected.
- A first mutation run passed `-g` with a space-containing title through the `node -e` wrapper and the filter split; it was repeated without `-g` (spec file only).

## Verification

- Task 1 gate: `import-undo`, `import`, `import-sync`, `conflict-snapshot` specs: 31 passed, `REPORT OK expected=31 flaky=0 unexpected=0` with the four Task 1 titles and the 11-01 legacy import title. Default config: `app-integrity` 7 passed `REPORT OK` with SAFE-02; extra check `tests/e2e/io` 16 passed `REPORT OK` (the known-bug `test.fail` rows included).
- Task 2 gate, full cloud suite (`npm run test:cloud`, no spec arguments, below-normal priority, 1 worker): `REPORT OK expected=183 flaky=0 unexpected=0` with the 8 titles of this plan. 158 + 4 (11-01) + 4 (11-03) + 8 (11-04) + 1 (11-05) + 8 (this plan) = 183. Default config `app-integrity`: `REPORT OK`, SAFE-02 present. Fast feedback before the full run: import-undo + logout + session, 27 passed with `--retries=0`.
- Anchors present exactly once each; `"snapshot","importundo"` appears twice (logout and account switch); `GATE_ALLOW` does not contain `undoImportBtn`; APP_SHA256 equals the file's sha256 in both commits; the staged privacy check printed 隐私检查通过 for both commits.

## Hand-offs for later plans

- **Slot:** key `usj:v2:<account id>:importundo`, value `{at: ISO string, plan: plan data object, state: records object, after: 8-hex fingerprint string}`; written only by `applyImport`; removed by a successful `undoImport`, by `logout()`, by the account-switch login (both lists are `["state","plan","snapshot","importundo"]`) and overwritten by the next import. Cloud only; the legacy path never writes it.
- **Functions:** `undoKey()`, `undoGet()` (null on any invalid shape), `undoShow()` (`CLOUD && me && undoGet()`), `undoPlanData()`, `dataPrint(p, s)`, `async undoImport()`. `applyImport`'s order is now: takeRemote, remoteView off and bar hidden, preview, `tooLarge`, **slot write (refuse on failure)**, plan replacement, `commit(["import"], run)`, `opsOk=false`, plan-cache banner, `undoShow()`, `renderKeep()`, toast with `撤销导入`.
- **Button and toast:** `#undoImportBtn` (aria-label and title "撤销导入：恢复成导入前的样子"); import toast 8000 ms with a `撤销导入` button; undo toast `T_UNDONE` 4000 ms. A later plan that exports/imports (11-07..11-11) must keep `GATE_ALLOW` free of this button and keep calling `undoShow()` where it calls `snapShow()` on entry.
- **Strings (app constant -> tests/support/strings.ts):** `T_UNDO_BTN` -> `BTN_UNDO_IMPORT`, `T_IMP_UNDO_NOTE` -> `IMPORT_UNDO_NOTE`, `T_IMP_NO_UNDO` -> `TOAST_IMPORT_NO_UNDO`, `T_UNDO_TITLE` -> `CONFIRM_UNDO_TITLE`, `T_UNDO_CHANGED` -> `CONFIRM_UNDO_CHANGED`, `T_UNDO_MORE` -> `CONFIRM_UNDO_MORE`, `T_UNDO_NO` -> `BTN_UNDO_CANCEL`, `T_UNDO_YES` -> `BTN_UNDO_OK`, `T_UNDONE` -> `TOAST_UNDONE`, `T_CF_UNDO` -> `CONFIRM_LOGOUT_UNDO`. Every cloud import summary now ends with `IMPORT_UNDO_NOTE` (specs that compare summary lines must expect it).
- **Test helpers:** no new support modules; the spec uses `app.fake.request` for the other writer, `readConfirm` polled for the re-shown confirm (the old dialog closes asynchronously, so poll instead of `confirmOk` when a second confirm follows), `page.addInitScript` to make `Storage.prototype.setItem` throw for the `:importundo` key.
- **Totals after this plan:** cloud 183, default 181 (unchanged; the new cases are cloud-only).

## Known limitation

The slot is the complete plan and records as they were before the import, and the local cache keeps the imported plan and records as well, so at the moment of an import this account occupies about twice its data size in the browser's local storage; with data close to the browser's quota an import is therefore refused (`T_IMP_NO_UNDO`, with a case proving a clear toast and no change at all). Where exactly that happens depends on the browser's quota; this plan does not measure that number (no verification command exists for it), so this section is qualitative only. A second limit: the fingerprint is 32 bits, so a change that leaves the fingerprint identical (about 1 in 4 billion) would not be asked about; the undo is also only one level (the most recent import, used up by one undo, not redoable).

## Known Stubs

None.

## Threat Flags

None. T-11-13 (copy left behind after logout or account switch) is mitigated and covered by `IO-08 logout and switching accounts clear the import undo copy...`; T-11-14 (import without a kept copy) by `IO-08 an import is refused when the data before it cannot be kept on this device`; T-11-15 (undo erasing changes the user was not told about, including ones synced in during the confirm) by the two D-05 cases and the mutation check; T-11-16 stays accepted as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-07. IO-08 is marked complete (no later plan of this phase declares it; `requirements.ready-ids` reported it ready).

## Self-Check: PASSED

- Files found: us-journey-tracker.html, tests/support/constants.ts, tests/support/strings.ts, tests/cloud/import.spec.ts, tests/cloud/import-undo.spec.ts
- Commits found: 2a559c7, 28675d7
