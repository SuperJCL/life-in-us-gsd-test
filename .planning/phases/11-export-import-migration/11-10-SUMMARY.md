---
phase: 11-export-import-migration
plan: 10
subsystem: io
tags: [migration-script, node-vm, privacy, counts-only, d-06, d-07]
requires:
  - phase: 11-export-import-migration
    provides: "11-01/11-02 classifyBackup, importPreview, backupCounts, backupOf, planCounts, withPlan and the owner-confirmed backup wrapper (format 2, kind full or plan)"
  - phase: 07-id-plan-extraction-stable-ids-escaping
    provides: "tools/plan/extract-plan.mjs (SEED_FILE, APP_FILE, pureSection, parseSeedJson), usePlan, importProblem, normalize with orphan-progress drop"
provides:
  - "tools/plan/migrate-backup.mjs: owner-run local script that merges the seed plan and an old Artifact backup into one new-format full backup (modes: default, --plan-only, --demo [dir], --self-test)"
  - "Exports: evalApp, composeMigration, composePlanOnly, demoInputs, reportLines, outputPath, demoDirAllowed, parseArgs, REASON_LINES, PROBLEM_FIELDS, SafeError"
  - "PRIVACY.md section 5: the script's two inputs, ignored outputs, counts-only printing, owner runs it in Phase 13"
affects: [11-11]

plan_head_before: 971c4979d896798199c2b39f4a411e56e72f601e
plan_head_after: 8bf58ecfe3147e1320a2ba5eab9a0e2ebdc59f35

actuals:
  tokens: 8300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Each call evaluates the app's pure section in a fresh vm context that carries only one string (the input JSON); the expression parses it as __in and returns a JSON-safe value"
    - "Only SafeError messages are ever printed; vm, file-system and unexpected errors print a fixed sentence (no path, no content)"
    - "Output path is built by outputPath(kind, ymd): fixed prefix, ymd validated, always under private/"

key-files:
  created:
    - tools/plan/migrate-backup.mjs
  modified:
    - PRIVACY.md

key-decisions:
  - "A file with a format key that does not classify (wrong app, format 9, bad plan) is reported as already-new, not as not-backup (plan: 'with a format identifier key -> already-new')"
  - "Parse errors never go through err.message of JSON.parse: both inputs use parseSeedJson (labels 种子 and 旧备份), and the top level prints a fixed sentence for anything that is not a SafeError"
  - "--demo directory check is case-sensitive inside the repo (Private/ and TEST-RESULTS/ are refused) so it cannot depend on how the file system or git treats case"
  - "The migration report prints no date range even though counts keeps from/to, so the file's own counts stay complete for any later caller"

requirements-completed: []  # IO-09 is also declared by 11-11; requirements.ready-ids decides (see below)

coverage:
  - id: D1
    description: "Migration script merges a synthetic seed plan and a synthetic old backup into a file the app reads back as a full backup, with hand-computed counts, the orphan progress dropped and old category names converted"
    requirement: IO-09
    verification:
      - kind: unit
        ref: "node tools/plan/migrate-backup.mjs --self-test (55 checks, last line 自检通过：55 项)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Inputs that are not an old Artifact backup (new-format file, {}, bad id or date, bad seed shape or plan) are refused by category with a fixed message, exit code 1, nothing written"
    requirement: IO-09
    verification:
      - kind: unit
        ref: "node tools/plan/migrate-backup.mjs --self-test (rejection and reportLines checks)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nothing from the inputs is printed: parse errors, report lines and failure lines carry no plan or record text; the self-test and --demo output contain no SYNTH text"
    requirement: IO-09
    verification:
      - kind: integration
        ref: "task 2 verify: --demo test-results/11-10-demo, last line MIGRATION OK, grep SYNTH on the output finds nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Output locations: real-input modes write only under private/ (git check-ignore first); --demo accepts only private/, test-results/ or a directory outside the repo"
    requirement: IO-09
    verification:
      - kind: unit
        ref: "node tools/plan/migrate-backup.mjs --self-test (outputPath, demoDirAllowed, parseArgs, check-ignore checks); verify: --demo tools/x exits non-zero and creates nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "The real run on the owner's seed and backup (Phase 13) was never done by Claude and is not covered here"
    requirement: IO-09
    verification: []
    human_judgment: true
    rationale: "By decision D-06 only the owner runs the default mode and --plan-only on real data; this plan can only prove the script on synthetic input"

duration: ~25 min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 10: Migration script Summary

**tools/plan/migrate-backup.mjs merges the seed plan and an old Artifact backup into one new-format full backup under private/, reusing the app's own pure functions through node:vm, printing counts only, and refusing anything that is not an old backup by category; it was proven with a 55-check self-test and a synthetic --demo, never on real data.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-11-11T08:15Z
- **Tasks:** 2 (two commits)
- **Files:** 1 created, 1 modified (the app file is untouched, APP_SHA256 stays valid)

## Accomplishments

- **Core (Task 1, `37ab52d`).** `evalApp` cuts the pure section with `pureSection` and runs it in a fresh vm context carrying only the input JSON string (5 s timeout, result by JSON round trip). `composeMigration(html, seedText, legacyText, now)` calls `usePlan(seed plan)`, `classifyBackup`, `importProblem`, `importPreview` (which applies the Phase 7 orphan-progress drop), `backupOf` and reads the result back through `classifyBackup` (must be kind full). `composePlanOnly` does the same without records. `reportLines` prints counts and fixed sentences only. `demoInputs` holds the synthetic seed and old backup (text starts with `SYNTH-`).
- **Modes and locations (Task 2, `8bf58ec`).** Default, `--plan-only`, `--demo [dir]`, `--self-test`. `outputPath` and `demoDirAllowed` are exported and self-tested; default and plan-only run `git check-ignore` on the output path before reading anything.
- **PRIVACY.md** section 5 states the two inputs, the ignored outputs, counts-only printing, who runs it and when, and that the migration files in `private/` can be deleted after the import.

## Modes and output paths

| Command | Reads | Writes |
|---|---|---|
| `node tools/plan/migrate-backup.mjs <old backup>` | `private/plan-seed.json`, the given backup, the app file | `private/计划手记-迁移-<local date>.json` (full backup) |
| `node tools/plan/migrate-backup.mjs --plan-only` | `private/plan-seed.json`, the app file | `private/计划手记-计划-<local date>.json` (plan-only file) |
| `node tools/plan/migrate-backup.mjs --demo [dir]` | the app file only (no private file) | `synth-legacy-backup.json`, `synth-plan-seed.json`, `synth-migrated.json`, `synth-plan-only.json` in the dir; default dir `private/migration-demo`; inside the repo only `private/` and `test-results/` (case-sensitive), outside the repo any dir |
| `node tools/plan/migrate-backup.mjs --self-test` | the app file | nothing |

Unknown or surplus arguments print the usage line and exit 1.

## Fixed rejection messages (stderr, exit 1, no output file)

| Reason | Message |
|---|---|
| `seed-shape` | 种子文件格式不对：缺少 plan 对象 |
| `seed-plan` | 种子里的计划没有通过应用的计划校验 |
| `already-new` | 这个文件已经是新格式，不需要迁移 |
| `not-backup` | 这个文件不是原 Artifact 的旧备份：认不出任何已知字段，或者字段类型不对 |
| `problem:<field>` | 旧备份没有通过导入检查：<字段>，字段是 记录（log）、自定义待办（custom）、任务进度（task）、力量记录（lift）、复盘（review）、开始日期（arrival） |
| `roundtrip` | 合成出的文件没有通过读回校验，已停止，没有写任何文件 |

Other fixed sentences: 种子 / 旧备份 `JSON 解析失败（已隐去内容），位置 N`; `应用纯函数段求值失败（已隐去详情）`; `未预期的错误（已隐去详情）`; `找不到旧备份文件`; `找不到 private/plan-seed.json：请先运行 node tools/plan/extract-plan.mjs 生成种子`; `private/ 没有被 git 忽略，已停止`.

Success output (counts only): `记录 N 条、复盘 N 周、完成的任务 N 项、力量记录 N 条` / `计划 N 组、N 项任务、N 个力量项` / `对不上计划的任务进度 N 条（已丢弃，先导入计划再导一次可以找回）` / `已写入 <repo-relative path>` / `MIGRATION OK`. Plan-only output has no record line and no orphan line.

## Self-test

55 items (Task 1: 44, Task 2: 11), last line `自检通过：55 项`: evalApp, composition counts against hand computation (3 logs, 2 reviews, 2 done, 2 lift entries, 2 groups, 4 tasks, 1 lift, 1 orphan), key order and read-back, orphan absent, categories converted, ids kept, 13 rejection cases plus 6 bad seed shapes, plan-only, no-leak checks over parse errors and every report line, `outputPath`, `demoDirAllowed` (including `..` tricks, similar prefixes, case, outside the repo), check-ignore of the output paths, `parseArgs`.

## Owner's Phase 13 steps (not run by Claude)

One-sentence pre-check: before the real run, run `node tools/plan/migrate-backup.mjs --self-test` and confirm it ends with 自检通过；if the real run is refused, read the printed category and compare it with the message table above to see which kind of problem it is.

1. One step: `node tools/plan/migrate-backup.mjs <path of the old backup>` writes `private/计划手记-迁移-<date>.json`; import that one file in the app once.
2. Two steps (D-03): `node tools/plan/migrate-backup.mjs --plan-only` writes `private/计划手记-计划-<date>.json`; import it first, then import the old backup, or run step 1 afterwards. If progress was dropped (the orphan line is above 0), the original file is untouched, so import the plan first and export again to get the progress back.
3. After the import is done the files in `private/` may be deleted.

## Hand-offs for 11-11 (synthetic migration rehearsal)

- Drive the script through `--demo test-results/<own dir>`: it writes `synth-migrated.json` (kind full, 3 logs, 2 reviews, 2 done, 2 lift entries, plan 2/4/1, 1 orphan dropped) and `synth-plan-only.json` (kind plan), plus the inputs `synth-legacy-backup.json` and `synth-plan-seed.json`. Output is always counts only; a rehearsal case can compare the printed lines with these numbers and import the files in the cloud page like any other backup.
- The same synthetic data is available in code: `import { demoInputs, composeMigration, composePlanOnly } from '../../tools/plan/migrate-backup.mjs'` returns `{ seed, legacy }`; `composeMigration(html, JSON.stringify(seed), JSON.stringify(legacy), now)` gives `{ ok, file, counts }`. `now` is passed in, so output is deterministic.
- To rehearse the refused cases feed a text through `composeMigration` (for example `{}` gives `not-backup`, the produced full backup gives `already-new`); use `--demo` with an unlisted dir (for example `tools/x`) to see exit code 1.
- The real-input modes are not rehearsed anywhere: they read `private/`, which the executor must never touch.
- Date in the output name is the local date; `exportedAt` is the UTC time of the run.

## Task Commits

1. **Task 1: migration script core and self-test** - `37ab52d` (feat)
2. **Task 2: modes, output locations and PRIVACY.md** - `8bf58ec` (feat)

**Plan metadata:** the docs commit that adds this file.

## Decisions Made

See key-decisions above. Nothing new needed owner input; D-06 and D-07 are followed as written.

## Deviations from Plan

### TDD gate note

**1. [Process] No separate RED commits**
- **Why:** the plan fixes one commit per task and the script is a new file, so there was no earlier state to run a failing test against; the self-test and the code were written together and the self-test was run until it passed (44 then 55 items, first run green). A TDD gate audit will see two `feat(11-10)` commits and no `test(11-10)` commit.
- **Impact:** none on behavior; a green-on-first-run self-test was cross-checked by printing the counts and the task keys of the synthetic result by hand (counts 3/2/2/2, 2/4/1, orphans 1, kept keys `P1-1,P2-1,c-synthcustom`).

### Auto-fixed issues

None - plan executed as written otherwise.

**Total deviations:** 1 process note. **Impact:** none.

## Issues Encountered

None. Verify commands for both tasks passed on the first run; the privacy check printed 隐私检查通过 for each staging. Commits were made on `main` by the same rule earlier plans used.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register (T-11-24 to T-11-28): no network, no new dependency, no new input path in the app. The script reads `private/plan-seed.json` and one owner-given file only when the owner runs the default mode or `--plan-only`.

## User Setup Required

None for this plan. The real migration is an owner step in Phase 13 (see above).

## Requirements

IO-09 is also declared by 11-11; it is marked complete only when `requirements.ready-ids` reports it ready.

## Next Phase Readiness

Ready for 11-11 (migration rehearsal cases and the phase's full suite).

## Self-Check: PASSED

`tools/plan/migrate-backup.mjs` exists; commits `37ab52d` and `8bf58ec` are ancestors of HEAD; `us-journey-tracker.html` is unchanged since `971c497`; both tasks' verify commands and acceptance criteria were run and passed; no file under `private/` was opened or written by the executor and the default mode and `--plan-only` were never run.

---
*Phase: 11-export-import-migration*
*Completed: 2026-11-11*
