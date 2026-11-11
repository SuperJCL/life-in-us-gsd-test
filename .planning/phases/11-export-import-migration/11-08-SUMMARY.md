---
phase: 11-export-import-migration
plan: 08
subsystem: io
tags: [export, blob-download, backup-format, toolbar, playwright-downloads]

requires:
  - phase: 11-export-import-migration
    provides: "11-02 backupOf and the owner-confirmed wrapper (format 2, kind full), 11-07 shared import entry (classifyBackup, legacyImport, cloudImport)"
  - phase: 09-login-cloud-storage
    provides: "snapDownload Blob plus a[download] pattern and the conflict-snapshot download cases"
  - phase: 10-realtime-sync
    provides: "remoteView and applyView() rules for a pending remote update"
provides:
  - "blobDownload(name, text, type) and saveFile(name, text, type): one browser-native download path shared by the backup, the calendar CSV and the kept-copy download"
  - "JSON backup export in the new full-backup format on every path (legacy, Claude account, cloud), pending remote update applied first"
  - "Export buttons visible in every environment, .toolbar wraps"
  - "tests/support/download.ts downloadOf(page, click)"
affects: [11-09, 11-10, 11-11]

plan_head_before: 9ec7df758cfe78d3e7bee7ba61f72a7496d92f12
plan_head_after: 33f89b97d92666e8178aac9ae5e09afc95bf58c7

actuals:
  tokens: 8600
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One Blob + temporary <a download> function, object URL revoked 30 s later, returns false on failure"
    - "Specs that read a download open it only with test.use({ acceptDownloads: true }) in the spec or a describe; the config default stays false"
    - "downloadOf reads createReadStream() into memory and calls download.delete() in finally"

key-files:
  created:
    - tests/support/download.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/app.ts
    - tests/e2e/io/export.spec.ts
    - tests/e2e/io/import.spec.ts
    - tests/e2e/smoke.spec.ts
    - tests/e2e/storage/account-mode.spec.ts
    - tests/e2e/storage/config-seam.spec.ts

key-decisions:
  - "Export buttons are not added to GATE_ALLOW: while the edit gate is on (body[data-gate]) the two export buttons are disabled like every other non-listed control; only #snapshotBtn and #logoutBtn stay allowed. Plan did not ask for a change."
  - "The CSV data source stays 'current plan plus records' (allTasks() of the plan in use plus state.logs); no BOM, Blob type text/csv;charset=utf-8."

patterns-established:
  - "Exports apply a pending remote update first: if(remoteView)applyView() at the start of both export handlers"

requirements-completed: [IO-06]  # copied from the plan; REQUIREMENTS.md not yet marked (shared with 11-09, ready-ids blocked)

coverage:
  - id: D1
    description: "Both export buttons are visible in local, Claude account and cloud versions and downloads go through the browser; the Claude downloads capability is never called"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#IO-06 shows both export buttons in local mode and downloads the backup natively"
        status: pass
      - kind: e2e
        ref: "tests/e2e/storage/account-mode.spec.ts#MOCK-04 account mode shows both export buttons and downloads the files natively without the downloads capability"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/export.spec.ts#IO-06 exporting twice downloads two identical files and the Claude downloads capability is never called"
        status: pass
    human_judgment: false
  - id: D2
    description: "JSON backup is the agreed full-backup wrapper with the current plan and records, file name without any account identifier"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/e2e/io/export.spec.ts#IO-03 the JSON backup of the full fixture wraps the fixture without _synthetic together with the sample plan"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/import.spec.ts#IO-04 an exported JSON backup imported again restores exactly the exported data"
        status: pass
    human_judgment: false
  - id: D3
    description: "Calendar CSV equals the independent generator byte for byte, no BOM; nothing dated downloads nothing"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/e2e/io/export.spec.ts#IO-02 the calendar CSV export matches the spec-derived expectation byte for byte"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/export.spec.ts#IO-02 exporting the calendar with nothing dated shows the empty toast and downloads nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Kept-copy download still works after moving to blobDownload; cloud toolbar still fits at narrow width with the two extra buttons"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/cloud/conflict-snapshot.spec.ts#SYNC-05 downloading the kept version saves a state-shaped JSON file without any account identifier and removes it from this device"
        status: pass
      - kind: e2e
        ref: "tests/cloud/logout.spec.ts#ACCT-02 the toolbar shows the signed-in email on wide screens and hides it on narrow screens"
        status: pass
    human_judgment: false
  - id: D5
    description: "How the wrapped toolbar looks at phone widths (alignment, spacing) was not judged by eye"
    verification: []
    human_judgment: true
    rationale: "Tests assert that every button is visible and the page has no horizontal scroll; whether the wrapped layout looks acceptable needs a look"

duration: ~40 min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 08: Native downloads for export Summary

**Backup, calendar CSV and kept-copy download now all go through one Blob download function; the backup is the owner-agreed full-backup wrapper (also on the legacy and Claude-account paths), pending remote updates are applied first, the Claude downloads bypass is deleted, and both export buttons show in every environment with a wrapping toolbar.**

## Performance

- **Duration:** ~40 min, mostly test runs (full default suite 3.4 min, full cloud suite 4.6 min)
- **Completed:** 2026-11-11T07:47Z
- **Tasks:** 2 (both `type="auto"`, one commit each)
- **Files modified:** 8 modified, 1 created

## Accomplishments

- **Deleted Claude download code:** `async function save(filename,data)` (the `declined` / `rate_limited` handling went with it), the `window.__dl` assignment, and in Task 2 the whole `use("downloads")` lookup in `init` plus the `hidden` class on `#exportCsv` and `#exportJson`. `grep -c '__dl'` and `grep -c 'use("downloads")'` on the app are both 0 (were 2 and 1).
- **`blobDownload(name, text, type)`** (export section of the app): Blob, object URL, temporary `<a download>` click, URL revoked 30 s later, returns `true`; on a throw it revokes the URL it made and returns `false`. **`saveFile(name, text, type)`** wraps it and toasts "已导出" or "导出不可用".
- **blobDownload call sites (3):** `snapDownload` (kept copy, failure toast and "do not delete the kept copy" unchanged), `#exportCsv` and `#exportJson` through `saveFile`.
- **JSON backup:** `saveFile("计划手记-备份-"+today()+".json", JSON.stringify(backupOf(plan,state,new Date().toISOString()),null,2), "application/json")`. Legacy, Claude-account and cloud all write the new format (D-10). `if(remoteView)applyView()` runs first in both export handlers (T-11-23).
- **CSV:** same rows as before (logs, then `allTasks()` done/due rows), `saveFile("计划手记-日历.csv", ..., "text/csv;charset=utf-8")`, no BOM, `csvCell` untouched (B7 is 11-09).
- **Toolbar:** `.toolbar` now `flex-wrap:wrap;justify-content:flex-end` (gap unchanged).
- **Round trip (D-10):** exporting on the legacy path and importing the same text replaces only records; saved state equals `backup.state`.

## Task Commits

1. **Task 1: native Blob download, new-format JSON, shared blobDownload** - `23dbad1` (feat)
2. **Task 2: export buttons in every environment, wrapping toolbar** - `33f89b9` (feat)

**Plan metadata:** the docs commit that adds this file.

## Test titles before and after

| Before | After |
|--------|-------|
| `IO-03 the JSON backup of the full fixture equals the fixture without _synthetic and the seeded document` | `IO-03 the JSON backup of the full fixture wraps the fixture without _synthetic together with the sample plan` |
| `IO-03 the JSON backup equals the latest saved document after a change` | unchanged (now compares `backup.state`) |
| `MOCK-04 exporting twice records two identical downloads and every test starts with an empty mock` | `IO-06 exporting twice downloads two identical files and the Claude downloads capability is never called` |
| `IO-02 exporting the calendar with nothing dated shows the empty toast and saves nothing` | `IO-02 exporting the calendar with nothing dated shows the empty toast and downloads nothing` (title not named in the plan, see deviations) |
| `MOCK-04 account mode shows both export buttons and records what downloads.save receives` | `MOCK-04 account mode shows both export buttons and downloads the files natively without the downloads capability` |
| `IO-01 keeps the export buttons hidden in local mode` | `IO-06 shows both export buttons in local mode and downloads the backup natively` |
| other export and import titles (the CSV byte case, the golden rows, `IO-04 an exported JSON backup imported again ...`) | unchanged |

## Hand-offs for later plans (11-09 onward)

- **`blobDownload(name, text, type)`** returns boolean; `saveFile(name, text, type)` returns nothing and shows the toast. Both are plain function declarations in the export section, hoisted, so earlier code (snapDownload) calls them.
- **Export file names:** `计划手记-备份-<today>.json`, `计划手记-日历.csv`; kept copies stay `计划手记-留底-<日期>.json` and `计划手记-计划留底-<日期>.json`. 11-09 wraps the plan kept copy (switch to the plan wrapper) inside `snapDownload`: the data passed to `blobDownload` is `JSON.stringify(snap.data,null,2)` today, so that is the single place to change.
- **Where `snapDownload` goes now:** it calls `blobDownload(name, JSON.stringify(snap.data,null,2), "application/json")` and, on `false`, shows "留底生成失败，本机副本仍然保留" without deleting the kept copy.
- **Download test helper:** `tests/support/download.ts` `downloadOf(page, click) -> {filename, text}`; waits for the download event while running `click`, reads UTF-8 text from `createReadStream()`, deletes the temp file in `finally`. The spec (or a `test.describe`) must set `test.use({ acceptDownloads: true })`; for a second device from `openDevice` use `openDevice({ acceptDownloads: true })` as conflict-snapshot does. Cloud cases for 11-09 can use `downloadOf(device.page, ...)`.
- **`tests/support/app.ts`:** only the `ready()` comment changed (export buttons always shown since Phase 11, readiness is the status bar); both account-mode visibility assertions kept.
- **Gate:** the export buttons are disabled while `body[data-gate]` is set (they are not in `GATE_ALLOW`). 11-09 cloud cases that export must do so outside a gate.
- **Stale comment left on purpose:** `tests/e2e/storage/account-mode.spec.ts` near the MOCK-05 case still says the export buttons show "because the app only looks at the downloads capability". It is not in Task 2's file list; a later plan that touches the file may fix the wording.
- **Totals after this plan:** default suite **184** (`npx --no playwright test --list`, unchanged: IO-01 and MOCK-04 rewritten, IO-03 renamed, one title renamed), cloud suite **183** (unchanged, no new cloud case).

## Run results

- Task 1: default subset (io, storage, app-integrity) 36 tests, REPORT OK; cloud subset (conflict-snapshot, import) 20 tests, REPORT OK.
- RED before the app change: the rewritten `export.spec.ts` failed on all six cases with `page.waitForEvent: Test timeout` (no download event, because the old app used the Claude bypass). RED is a missing-behaviour timeout rather than an assertion on content.
- Task 2: full default `npm test` 184 expected, REPORT OK (the five `BUG-01` known-bug cases show as expected failures, as before); full `npm run test:cloud` 183 expected, REPORT OK, both low priority and 1 worker, run one after the other.
- Privacy check passed on both staged sets.

## Decisions Made

- Export buttons stay out of `GATE_ALLOW` (see key-decisions).
- `exportedAt` uses the page clock (`new Date().toISOString()`), so the fixed test clock gives `new Date(FROZEN_NOW).toISOString()` exactly.

## Deviations from Plan

### TDD gate note

**1. [Process] One commit per task, RED observed but not committed separately**
- Same as 11-01 and 11-02: the plan fixes one commit per task. The rewritten export cases were run against the unchanged app first and failed on the missing download event; the implementation then made them pass. A TDD gate audit will see `feat(11-08)` commits only.

### Auto-fixed issues

**2. [Rule 1 - Bug in my own edit] Duplicate `text` binding in export.spec.ts**
- **Found during:** Task 1 RED run (SyntaxError: Identifier 'text' has already been declared).
- **Fix:** destructure the download as `{ text: file }` in the case that already has a local `text`.
- **Files modified:** tests/e2e/io/export.spec.ts. **Committed in:** `23dbad1`.

**3. [Plan wording] One extra title rename**
- The plan lists the test titles to rename; the "nothing dated" case now counts download events instead of reading mock records, so its title (`... saves nothing`) was changed to `... downloads nothing`. Nothing in any verify line refers to the old title.
- **Files modified:** tests/e2e/io/export.spec.ts. **Committed in:** `23dbad1`.

**Total deviations:** 1 process note, 1 self-fix, 1 title rename. **Impact:** none on behavior or scope.

## Issues Encountered

None beyond the self-fix above. A first attempt to write an edit script through a shell heredoc failed on quoting; the script was written with the Write tool instead (no repo state affected).

## Known Stubs

None.

## Threat Flags

None. No new endpoint or input path. T-11-20 (account identifier in file name or content): the backup is `backupOf(plan,state,at)`, which reads no account data, and the file name is a fixed prefix plus the date; the export unit cases assert the exact key list and file names (the cloud-side assertion on email and id is 11-09). T-11-22 (temp files): `downloadOf` deletes in `finally`. T-11-23 (pending remote update): both handlers call `applyView()` first.

## Requirements

IO-06 is also declared by 11-09, so `requirements.ready-ids` reported it blocked and REQUIREMENTS.md was not changed; it becomes ready when 11-09 finishes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-09 (cloud cases at two widths, CSV formula injection B7, plan kept-copy wrapper). Note the edit gate disables the export buttons, and `snapDownload` is the one place for the plan wrapper.

## Self-Check

Created and modified files exist; commits `23dbad1` and `33f89b9` are ancestors of HEAD; APP_SHA256 equals the file hash; `commits: 2` measured from the ledger base `9ec7df7`.

## Self-Check: PASSED

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
