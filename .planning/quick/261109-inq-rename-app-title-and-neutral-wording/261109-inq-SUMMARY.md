---
phase: quick-261109-inq
plan: 01
subsystem: app-display-name-and-privacy-guard
tags: [rename, privacy, wording, tests]
status: complete
requirements: [QUICK-261109-inq]
key-files:
  modified:
    - .gitignore
    - PRIVACY.md
    - tools/privacy/privacy-check.mjs
    - tests/e2e/platform/repo-hygiene.spec.ts
    - tests/e2e/data/synthetic-data.spec.ts
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/e2e/week/week-view.spec.ts
    - tests/support/expect-from-fixture.ts
    - tests/e2e/calendar/day-panel.spec.ts
actuals:
  tasks: 2
  commits: 2
plan_head_before: 2da28ea9ca6c10951af8857d00fdb0126f5b27c7
plan_head_after: 4a5ab159a7645cfe6c052006f30bd0f872a2ec71
completed: 2026-11-09
---

# Quick 261109-inq: rename the app to 计划手记 and use neutral wording

The app now shows 计划手记 in the tab title, login heading and header h1, uses neutral start-date wording, and exports under 计划手记-* names. The privacy guard learned the new export names first.

## Commits

- d027265 chore(privacy): block 计划手记 export files alongside the old export names (Task 1, tracer)
- 4a5ab15 feat(app): rename the app to 计划手记 and use neutral start-date wording (Task 2)

## What changed

- Guard (Task 1): `.gitignore` ignores `计划手记-*.json` and `计划手记-*.csv` next to the old names; privacy-check rule A uses `EXPORT_PREFIXES` (old and new); self-test went from 193 to 199 items; PRIVACY.md table lists both names; SAFE-03 proves old and new names are ignored and `docs/计划手记-说明.md` is not; DATA-02 rejects both prefixes for synthetic malformed-import names.
- App (Task 2): exactly the 12 planned lines changed (title, login heading, h1, label 开始日期, counter 第 N 天 / 还有 N 天开始 / 先设置开始日期, week title 第 N 周, day-panel subtitle 第 N 天, four export filename prefixes). The diff gate confirmed only those lines.
- Tests: `tests/support/strings.ts` follows the app and has new constants (APP_NAME, START_DATE_LABEL, COUNTER_*); APP_SHA256 is now `9a33cbeda7e2144a5ad2745c9f8a69678a949a2ba012b54812a53894986cdba0`; new case "WEEK-01 the header shows the app name, the start-date label and a neutral day counter" (RED first against the unedited app, GREEN after the edit).

## Verification (real runs, below-normal priority, one worker, run one after the other)

- Default suite: 176 passed, 0 unexpected, 0 flaky (min-expected 176).
- Cloud suite: 114 passed, 0 unexpected, 0 flaky (min-expected 114).
- Task 1 verify: self-test 199, six export names ignored, SAFE-03 and DATA-02 pass; `privacy-check --all` passed (368 files).
- Task 2 verify: source gate and diff gate OK; 42 targeted e2e cases passed; cloud SYNC-05 snapshot spec 10 passed; `privacy-check --all` passed. Pre-commit privacy check passed on both commits without bypass.

## Deviations from Plan

None - plan executed as written. The pre-commit HEAD guard sees `main`; `git.allow_default_branch_commits` is `true` in `.planning/config.json` and the orchestrator dispatched a sequential executor on the main tree, so committing on main was allowed.

## Intentionally unchanged

- State field `state.arrival`, `#arrival` id, `.arrival` class, the storage key `us-journey-tracker-v1`, PocketBase and cache keys, the file name `us-journey-tracker.html`, the subtitle and all CSS. Old JSON backups with an `arrival` field still import (IO-04 passes).
- Comments in tests that use the old word only as the name of the arrival data field (reconcile-gate, grid, synthetic-data, import, state-validation, week-view, constants.ts, KNOWN-BUGS.md) and English test titles that say "arrival".
- `tests/fixtures/full-state.json`: a synthetic log text contains the old arrive word; it is user data, not UI wording.
- The probe tool's carrier name under `tools/probe`, and all `.planning/**` and `.claude/CLAUDE.md` (historical project name).
- Nothing ambiguous was found in the app beyond the 12 planned lines (the source gate found no old wording left).

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- d027265 and 4a5ab15 are ancestors of HEAD; the summary file exists; all eleven plan files are in the two commits; only the pre-existing unrelated 09-UAT.md change and untracked planning files remain in the working tree.
