---
phase: 11-export-import-migration
plan: 11
subsystem: io
tags: [migration-rehearsal, cloud-tests, readme, probes, phase-close, d-06, d-08]
requires:
  - phase: 11-export-import-migration
    provides: "11-10 tools/plan/migrate-backup.mjs (--demo, --self-test); 11-01/11-03/11-06 summary lines and #undoImportBtn; 11-07 B2/N3 fixes; 11-09 B7 and the export spec"
provides:
  - "tests/cloud/migration.spec.ts: the D-08 rehearsal case and the script self-test case"
  - "tests/README.md: Phase 11 cloud-case section, migration script usage, B2/N3 fixed wording"
  - "tests/PROBES.md: PROBE-8 conclusion for Phase 11 (cancel path clears the value)"
affects: [phase-11-uat, phase-13]

plan_head_before: fd5296df8f36e331f4ed843717d4e91b47d9103a
plan_head_after: e04a18c934626149db7c24df8b07e9ad697d8afe

actuals:
  tokens: 5200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "A cloud case runs the real CLI as a child process (execFileSync, process.execPath) in a directory under testInfo.outputPath, reads back the synthetic files it wrote, and removes the directory in finally"
    - "Expected summary counts and server data are computed in the spec from the synthetic legacy backup and seed (no call into the script's functions)"

key-files:
  created:
    - tests/cloud/migration.spec.ts
  modified:
    - tests/README.md
    - tests/PROBES.md

key-decisions:
  - "The rehearsal imports synth-migrated.json (already normalized by the script), so the summary has no highlighted orphan line; the orphan count is checked on the script's printed output instead (1 dropped, id P9-1 computed independently)"
  - "Goals-page checks read only ids and done flags through the existing goals helpers; lift history through liftHistoryEquals; the timeline through readTimeline against expectedTimeline(server state)"

requirements-completed: [IO-09]

coverage:
  - id: D1
    description: "A synthetic legacy backup and seed plan composed by the migration script import into a new account on the fake server: summary counts, plan, records (ids, dates, migrated categories), reviews, task progress without the orphan, strength history, goals view, strength card and timeline all match values computed from the synthetic inputs"
    requirement: IO-09
    verification:
      - kind: e2e
        ref: "tests/cloud/migration.spec.ts#IO-09 a synthetic legacy backup and seed plan composed by the migration script import into a new account with every record, review, progress and strength entry in place, and the import can be undone (D-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Undoing the rehearsal import returns the server plan and records to the state before the import"
    requirement: IO-09
    verification:
      - kind: e2e
        ref: "tests/cloud/migration.spec.ts (same case, last step)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Script self-test runs from the cloud suite, exits 0, prints the pass line and no SYNTH text; the demo output directory is removed after the case"
    requirement: IO-09
    verification:
      - kind: e2e
        ref: "tests/cloud/migration.spec.ts#IO-09 the migration script self-test passes and prints only counts; verify: find test-results -type d -name migration-demo is empty"
        status: pass
    human_judgment: false
  - id: D4
    description: "tests/README.md and tests/PROBES.md describe the Phase 11 cases, the migration script and the B2/N3/PROBE-8 fixes"
    requirement: IO-09
    verification:
      - kind: command
        ref: "Task 2 verify: grep checks for the five phrases, old wording count 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner rehearsal in real Edge with the synthetic demo files at desktop and phone width, including the two downloads"
    requirement: IO-09
    verification: []
    human_judgment: true
    rationale: "D-08 requires the owner to experience the summary and undo in real Edge; whether the summary reads clearly and how Edge shows the downloads can only be judged by a person"
  - id: D6
    description: "The real migration of the owner's own seed and backup (Phase 13)"
    requirement: IO-09
    verification: []
    human_judgment: true
    rationale: "D-06: only the owner runs the default mode and --plan-only on real data; nothing here covers it"

duration: ~40 min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 11: Synthetic migration rehearsal and phase close Summary

**A cloud case runs the migration script's --demo as a child process, imports the synthetic composed file into a new account on the fake server, checks the summary counts, plan, records, reviews, task progress, strength history, goals view and timeline against values computed independently from the synthetic inputs, and undoes the import; the README and PROBES now describe Phase 11, and both full suites pass (default 185, cloud 190).**

## Performance

- **Duration:** about 40 min (most of it the two full suite runs)
- **Completed:** 2026-11-11
- **Tasks:** 2 (two commits)
- **Files:** 1 created, 2 modified (the app and the migration script are untouched)

## Accomplishments

- **Rehearsal case (Task 1, `fd3a4e1`).** `execFileSync(process.execPath, ['tools/plan/migrate-backup.mjs', '--demo', testInfo.outputPath('migration-demo')])`; the last output line is `MIGRATION OK` and the output has no `SYNTH`. The case reads back the synthetic legacy backup, seed and composed file, computes the expected counts itself, opens a new cloud account (sample plan, one record), imports the composed file as an in-memory file and checks the confirm text line by line (new-format kind, replace scope, 3 records 2026-01-06 to 2026-01-13, 2 review weeks / 2 done / 2 strength entries, plan 2/4/1, current 1, undo note, no highlighted line). After confirming it checks the server and the page, then clicks `#undoImportBtn` and checks the server is back to the plan and records before the import. The demo directory is removed in `finally`.
- **Self-test case.** `--self-test` from the cloud suite: exit 0, pass line, no `SYNTH`.
- **Docs (Task 2, `e04a18c`).** README: tools row names `migrate-backup.mjs`; the cloud row lists the five Phase 11 specs; new section "Phase 11 的云端用例" (what each spec covers, the script's `--self-test` and `--demo`, default mode and `--plan-only` owner-only in Phase 13); the B2/N3 notes (section 5 row, section 14 end, section 15 bullets) now say fixed in Phase 11 and point at the regression cases and `KNOWN-BUGS.md`. PROBES: the PROBE-8 table row and section say that before Phase 11 the value stayed after cancel and from Phase 11 the cancel path also clears it, the hard-coded assertion is now "value empty after cancel", the other three assertions are unchanged, and the "Playwright always dispatches change" conclusion stays.

## Data classes the rehearsal checks (independently computed from the synthetic inputs)

| Class | Check |
|---|---|
| Summary | kind full, replace scope, records and date range, review weeks, done count, strength entries, plan size, current records, undo note, no highlighted line |
| Plan on server | groups, tasks, strength item ids and text equal the seed plan |
| Records | ids and dates equal the legacy backup; old category names converted by `expectedCategory`; texts unchanged |
| Reviews | the same two weeks and texts |
| Task progress | equals the legacy progress minus the orphan `P9-1` (done P1-1 and the custom to-do, due date on P2-1) |
| Strength history | equals the legacy history; the card's history line equals `liftHistoryText` |
| Pages | goals view: P1-1 done, custom to-do done in P2, P2-1 has a due box; timeline equals `expectedTimeline(server state, all)` |
| Undo | server plan and state equal the values before the import, the button disappears |

## Suite totals (`playwright test --list`, then full runs, one after the other, below-normal priority, 1 worker)

- **Default:** `--list` 185 tests in 40 files; full `npm test`: `REPORT OK expected=185 flaky=0 unexpected=0` (floor 185).
- **Cloud:** `--list` 190 tests in 23 files; full `npm run test:cloud`: `REPORT OK expected=190 flaky=0 unexpected=0` (floor 189; the extra one is 11-09's kept-plan case, counted because 11-02's decision row is "改").
- Task 1 gate: `migration.spec.ts` + `import-undo.spec.ts` ran 10 cases, `REPORT OK expected=10 flaky=0 unexpected=0`; no `migration-demo` directory left; privacy check passed on both staged sets.

## Human-check items for phase UAT (owner, real Edge)

1. Run `node tools/plan/migrate-backup.mjs --demo` at low priority (files land in `private/migration-demo/`; synthetic only).
2. Open the cloud version (fake server, synthetic account) as in Phase 9's manual check, at desktop width and at phone width (375).
3. Choose `synth-migrated.json` and read the summary: it should state the file type, replace scope and each count; on the phone the text should wrap fully and the buttons be tappable. Import it.
4. Look at the goals, calendar, timeline and strength history: records, reviews, finished tasks and strength history sit on the right tasks and dates.
5. Click "撤销导入": the app returns to the state before the import and the "撤销导入" button goes away.
6. Click "备份" and "导出日历 CSV" and watch Edge's downloads: both files save normally and neither file name contains an email. The calendar CSV is a spare export only; the owner does not import it into a calendar and no calendar-import check is part of this (owner decision 2026-11-10).

## Left for Phase 13 (owner steps, not run by Claude)

See 11-10-SUMMARY "Owner's Phase 13 steps": run `node tools/plan/migrate-backup.mjs --self-test` first and confirm it ends with 自检通过; then either one step (`node tools/plan/migrate-backup.mjs <path of the old backup>`, import the one file) or two steps (`--plan-only`, import the plan, then import the old backup or run step 1). Check the printed counts against what the owner expects (the orphan line above 0 means progress was dropped; the original file is untouched, so import the plan first and export again). The files in `private/` may be deleted after the import.

## Task Commits

1. **Task 1: synthetic migration rehearsal and self-test cases** - `fd3a4e1` (test)
2. **Task 2: README and PROBES sync, full suites** - `e04a18c` (docs)

**Plan metadata:** the docs commit that adds this file.

## Decisions Made

See key-decisions above. Nothing new needed owner input.

## Deviations from Plan

None - plan executed exactly as written. The rehearsal case passed on its first run; its assertions were not weakened. The migration script and the app file were not touched.

## Issues Encountered

None. Both full suites passed on the first run. Note for later readers: a first attempt to write the README edit script through a shell heredoc failed on quoting (nothing was changed); it was redone from a file.

## Known Stubs

None.

## Threat Flags

None. The case only calls `--demo` and `--self-test`; the default mode and `--plan-only` were never run, no file under `private/` was opened, and no demo output was left behind (T-11-29 verified by the grep gate and the empty `find`).

## User Setup Required

None.

## Next Phase Readiness

Phase 11 plans are complete; ready for verification and the owner's real-Edge acceptance (list above), then Phase 12.

## Self-Check: PASSED

`tests/cloud/migration.spec.ts` exists; commits `fd3a4e1` and `e04a18c` are ancestors of HEAD; all acceptance criteria were re-run (grep gates, both titles in the report, no `migration-demo` directory, privacy lines, full suites OK with 190 and 185 expected).

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
