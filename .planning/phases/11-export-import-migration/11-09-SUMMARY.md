---
phase: 11-export-import-migration
plan: 09
subsystem: io
tags: [export, csv-formula-injection, b7, kept-copy-wrapper, cloud-cases, toolbar-375]
requires:
  - phase: 11-export-import-migration
    provides: "11-02 backupOf and the owner-confirmed wrapper (plan kept-copy line `计划留底包装：改`), 11-04 kind full kept copy, 11-08 blobDownload/saveFile and tests/support/download.ts"
provides:
  - "tests/cloud/export.spec.ts: five cloud cases (JSON, CSV at 1280 and 375, no account identifier, 375 px toolbar, kept plan round trip)"
  - "csvCell B7 prefix in the app and in the independent generator, with a handwritten golden-row case"
  - "snapDownload writes a plan-only wrapper for kind plan kept copies"
  - "Test notes (README, CONTRACT, KNOWN-BUGS) in line with native downloads and B7 fixed"
affects: [11-10, 11-11]

plan_head_before: 9e2e30e14d69bce096e1ad6694e4780dcca96a11
plan_head_after: b20ee1430a14a24c17ecad511ecce535b6a6e240

actuals:
  tokens: 6500
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Cloud cases read downloads through downloadOf with a spec-level test.use({ acceptDownloads: true })"
    - "Kept copies are planted in localStorage after login and the page is reloaded so the toolbar button shows"
    - "csvCell: guard prefix first, then quote on comma, double quote, LF or CR"

key-files:
  created:
    - tests/cloud/export.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/expect-from-fixture.ts
    - tests/e2e/io/export.spec.ts
    - tests/README.md
    - tests/KNOWN-BUGS.md
    - tests/mocks/CONTRACT.md

key-decisions:
  - "Plan kept-copy wrapper: 计划留底包装：改 (copied from 11-02-SUMMARY), so kind plan kept copies download as backupOf(plan, null, now)"
  - "CSV gets no BOM and no calendar-import check (owner round-4 decision); B7 prefix only"
  - "CR is added to the characters that force quoting, so a cell starting with CR gets the prefix and is quoted"

requirements-completed: [IO-06]

coverage:
  - id: D1
    description: "Cloud JSON backup and calendar CSV download at 1280 and 375 wide, identical at both widths and equal to the account data"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/cloud/export.spec.ts#IO-06 the cloud version downloads the account's JSON backup at desktop and phone width"
        status: pass
      - kind: e2e
        ref: "tests/cloud/export.spec.ts#IO-06 the cloud version downloads the account's calendar CSV at desktop and phone width"
        status: pass
    human_judgment: false
  - id: D2
    description: "Exported file names and contents carry neither the account email nor id"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/cloud/export.spec.ts#IO-06 the exported files carry no account identifier"
        status: pass
    human_judgment: false
  - id: D3
    description: "At 375 px every toolbar button (including the kept-copy and undo buttons) is on screen and the page has no horizontal scroll"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/cloud/export.spec.ts#IO-06 the toolbar fits a 375 px wide screen with every button shown"
        status: pass
    human_judgment: false
  - id: D4
    description: "B7: cells starting with = + - @ tab or CR get a leading single quote; plain cells and dates unchanged; app and generator constrained by the same golden rows"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/e2e/io/export.spec.ts#IO-06 calendar cells that start with a formula character get a leading quote (B7)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/io/export.spec.ts#IO-02 the calendar CSV export matches the spec-derived expectation byte for byte"
        status: pass
    human_judgment: false
  - id: D5
    description: "A kept plan copy downloads as a plan-only file that the import accepts and replaces the plan with"
    requirement: IO-06
    verification:
      - kind: e2e
        ref: "tests/cloud/export.spec.ts#IO-06 a kept plan version downloads as a plan-only file that the import accepts"
        status: pass
    human_judgment: false
  - id: D6
    description: "How the wrapped toolbar looks at 375 px (alignment, spacing) was not judged by eye"
    verification: []
    human_judgment: true
    rationale: "Tests assert every button is inside the screen and no horizontal scroll; whether the wrapped layout looks good needs a look"

duration: ~55 min, mostly test runs (full cloud suite 4.7 min)
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 09: Cloud export cases, B7 and the plan kept-copy wrapper Summary

**The cloud version is proven to download the account's JSON backup and calendar CSV at 1280 and 375 wide (identical, equal to the account data, no account identifier, toolbar inside the screen); CSV formula cells now get a leading quote (B7), and a kept plan copy downloads as a plan-only file that the import takes back.**

## Performance

- **Tasks:** 3 (all `type="auto"`, one commit each; Task 2 is `tdd="true"`)
- **Files modified:** 7 modified, 1 created
- **Totals after this plan:** default suite **185** (`npx --no playwright test --list`, +1 B7 case), cloud suite **188** (+5 in `tests/cloud/export.spec.ts`). Full cloud run: 188 passed, REPORT OK, low priority, 1 worker.

## Accomplishments

- **Task 1:** `tests/cloud/export.spec.ts` with four cases. No change to the app was needed: all four passed against the 11-08 implementation (toolbar wrap already fits 375 px with both extra buttons).
- **B7 rule (csvCell, app and generator):** a cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a single English quote in front of it; after that the cell is quoted when it contains a comma, a double quote, LF or CR (inner double quotes doubled). Plain text (`SYNTH-...`) and the date cells are untouched. No BOM. In practice only the description cell is affected, because the subject cell starts with `[category] ` and task rows start with the fixed 完成：/截止： prefix.
- **Plan kept copy:** `计划留底包装：改` (line copied from 11-02-SUMMARY). `snapDownload` writes `backupOf(snap.data, null, new Date().toISOString())` for `kind==="plan"`; `kind "state"` stays a bare state (D-02, imported as an old backup); `kind "full"` (11-04) downloads its data unchanged (already a full backup). The file name stays `计划手记-计划留底-<日期>.json`.
- **Notes:** README section 5 and 12 (download event, `acceptDownloads`, B7 rule and golden rows), section 11 (ready condition, `app.backend.downloads` stays empty); CONTRACT 2.4 gets `Phase 11 起应用不再调用 downloads`; KNOWN-BUGS lists B7 as fixed with its regression title and the leading-quote limitation, and B6 as covered by Phase 7 escaping (list items, no numbered table rows).

## Task Commits

1. **Task 1: cloud export cases** - `7062e88` (feat)
2. **Task 2: B7 and plan kept-copy wrapper** - `5e516b4` (feat, APP_SHA256 re-recorded in the same commit)
3. **Task 3: test notes** - `b20ee14` (docs)

**Plan metadata:** the docs commit that adds this file.

## Hand-offs for later plans (11-10, 11-11)

- **csvCell rule** is the B7 rule above; the app's `csvCell` and `tests/support/expect-from-fixture.ts` `csvCell` implement it independently, and the golden rows in `IO-06 calendar cells that start with a formula character get a leading quote (B7)` bind both.
- **Plan kept-copy wrapper:** `snapDownload` is the only place; wrapper keys `app, format, kind, exportedAt, plan` (no `state`). Phase 9/10 downloads are unaffected for state copies.
- **PRIVACY / README:** this plan wrote the three test notes only (tests/README.md, tests/mocks/CONTRACT.md, tests/KNOWN-BUGS.md). Nothing was written to the root README or PRIVACY file: the user-facing documentation of the new export format, the `恢复` accepting plan-only files and the B7 quote is left to 11-11.
- **Stale comment** near MOCK-05 in `tests/e2e/storage/account-mode.spec.ts` was not touched (file not in this plan's list).
- **Gate:** export buttons are disabled while the edit gate is on; the cloud cases export after login and sync.
- **Totals after this plan:** default 185, cloud 188.

## Known Limitations

- Plan kept copies downloaded in Phase 9 or 10 (bare plan objects named `计划手记-计划留底-<日期>.json`) are rejected by the import with the format error (11-02 recognition rules). To use one: wrap it by hand as a plan-only file (`{"app":"us-journey-tracker","format":2,"kind":"plan","exportedAt":"<ISO time>","plan":<the bare plan>}`, fields per 11-02-SUMMARY "备份格式决定"), or export a fresh backup on the original device.
- B7: the leading single quote shows in the few calendar titles or descriptions that begin with a formula character (also in tools that do not treat them as formulas). Recorded in tests/KNOWN-BUGS.md.
- iOS home-screen apps open `<a download>` through the system preview or share sheet; a Web Share fallback is a deferred idea.

## Decisions Made

- Plan kept-copy wrapper "改" applied (decision line copied above); the kept-plan cloud case is therefore mandatory and present.
- CR joins the quoting characters so a CR-leading cell is both guarded and quoted; the golden row for it is handwritten.
- Toolbar case plants the kept copy with `told: true` and reloads, instead of an init script, so no stale copy comes back after the download.

## Deviations from Plan

### TDD gate note

**1. [Process] One commit per task; RED observed for B7 only**
- The B7 case was run against the unchanged app first and failed on the planned assertion (`应用导出缺少金标准行`, golden row with `'=SYNTH-B7 sum`). The kept-plan cloud case was written after the `snapDownload` change, so its RED was not observed. Plan fixes one commit per task, so no `test(11-09)` commit exists; a TDD gate audit will see `feat(11-09)` commits only.

### Auto-fixed issues

**2. [Rule 1 - Bug in my own test] Compared the server's raw seed with the normalized export**
- **Found during:** Task 1 first runs. `app.fake.lastState(0)` and `lastPlan(0)` are the raw seeds (with `_synthetic` and without normalized defaults) because nothing was saved yet; I had asserted them equal to the export.
- **Fix:** compare `expectedNormalize(lastState)` and the plan without `_synthetic` instead. No change to the expectation about the app.
- **Files modified:** tests/cloud/export.spec.ts. **Committed in:** `7062e88`.

**Total deviations:** 1 process note, 1 self-fix. **Impact:** none on behavior or scope. The app needed no fix for Task 1.

## Issues Encountered

None beyond the self-fix above.

## Known Stubs

None.

## Threat Flags

None. T-11-21 (CSV formula injection) is mitigated by the B7 prefix with golden-row coverage of app and generator; T-11-20 (account identifier in exported files) is covered by `IO-06 the exported files carry no account identifier` and the kept-plan case checks the same for the wrapper.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 11-10. The user-facing documentation of the export format, plan-only restore, B7 and the Phase 9/10 kept-plan limitation is for 11-11.

## Self-Check

Created file `tests/cloud/export.spec.ts` exists; commits `7062e88`, `5e516b4`, `b20ee14` are ancestors of HEAD; APP_SHA256 equals the app file hash and the five anchors occur once each; privacy check passed on every staged set; `commits: 3` measured from the ledger base `9e2e30e`.

## Self-Check: PASSED

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
