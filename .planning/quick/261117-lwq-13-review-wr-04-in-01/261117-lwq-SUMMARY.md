---
phase: quick-261117-lwq
plan: 01
subsystem: deploy
tags: [deploy, bundle, server-check, restore-drill, review-fix]
requires: []
provides:
  - "build-site enumerates pb/pb_migrations and deploy/pb_migrations into the upload bundle (MIGRATION_DIRS, migrationSources, sourcesProblem, derived BUNDLE_COUNT)"
  - "server-check C-23: migration file set equals every hardcoded copy"
  - "restore-drill.sh post-import mode --with-real-data, checked by C-22"
affects: [deploy/build-site.mjs, deploy/verify-site.mjs, deploy/server-check.mjs, deploy/server/restore-drill.sh, deploy/README.md]
key-files:
  modified:
    - deploy/build-site.mjs
    - deploy/verify-site.mjs
    - deploy/server-check.mjs
    - deploy/server/restore-drill.sh
    - deploy/README.md
decisions:
  - "D-01 (WR-04): bundle migrations are enumerated from the two directories; C-23 guards the copies that cannot follow automatically"
  - "D-02: 03-configure-pocketbase.sh, 04-start-pocketbase.sh, 00-status.sh byte-for-byte unchanged since af34dce"
  - "D-03 (IN-01): restore-drill accepts exactly one optional argument --with-real-data"
  - "D-04: README documents both modes; the new drill script is installed only in the Phase 16 deployment"
metrics:
  duration: "about 45 min"
  completed: 2026-11-17
status: complete
commits: 2
plan_head_before: af34dce1bd0f595683da01f2b59ef743c1c7ea35
plan_head_after: d6dc94e8c1c7612009bb2dd0ebbc16a589f5f1cc
actuals:
  tokens: 14000
  tasks: 3
  commits: 2
---

# Quick 261117-lwq: 13-REVIEW WR-04 and IN-01 Summary

build-site now collects every `*.js` of `pb/pb_migrations` and `deploy/pb_migrations` into the upload bundle and derives `BUNDLE_COUNT`, a new server-check C-23 fails when any hardcoded copy of the migration list or the README counts drifts, and the restore drill gained the post-import mode `--with-real-data`.

## Task commits

| Task | Commit | What |
|------|--------|------|
| 1 (tracer) | 8e7e92a | fix(quick-261117-lwq): enumerate bundle migrations from the migration directories and add server-check C-23 (13-REVIEW WR-04) - build-site.mjs, verify-site.mjs, server-check.mjs, README.md |
| 2 | d6dc94e | feat(quick-261117-lwq): restore drill post-import mode --with-real-data, checked by C-22 (13-REVIEW IN-01) - restore-drill.sh, server-check.mjs, README.md |
| 3 | none | verification only (bundle diff and tool sweep), no tracked change |

## Automated verify results (exact final lines)

Task 1 `<automated>` (exit 0, every step passed):
- `node deploy/build-site.mjs --self-test` -> `SELF-TEST OK (33 cases)`
- `node deploy/server-check.mjs --self-test` -> `SELF-TEST OK (212 cases)` (at that commit)
- `node deploy/server-check.mjs` -> `SERVER-CHECK OK (23 checks)`
- `node deploy/verify-site.mjs --self-test` -> `SELF-TEST OK (54 cases)`
- build to a throwaway test-results directory -> `BUILD OK 0ba1339903f1 (33 files)`; `diff -r` against the pre-change baseline empty; `node deploy/verify-site.mjs --check-bundle` -> `BUNDLE OK (9 checks)`
- temporary probe migration in `pb/pb_migrations` -> `... (34 files)`, the probe file present under `pb_migrations/` in the bundle, `FAIL C-23` printed by server-check; probe removed again (trap) and `git diff --quiet af34dce` on 03, 04, 00-status exit 0

Task 2 `<automated>` (exit 0): `bash -n` OK; server-check self-test `SELF-TEST OK (224 cases)`; `SERVER-CHECK OK (23 checks)`; local smoke with `id` and `curl` shadowed: `--bogus`, `--with-real-data --with-real-data` and `--with-real-data=1` each print exactly `DRILL_ARGS=refused`, `DRILL_RESULT=FAIL`, `RC=1`; `--with-real-data` prints `DRILL_MODE=real-data` first, no argument prints `DRILL_MODE=test-only` first, the no-argument run still ends `DRILL_RESULT=FAIL` (health check stub); README contains `--with-real-data`; 03, 04, 00-status unchanged.

Task 3 `<automated>` (every step passed):
- post-change build `BUILD OK 0ba1339903f1 (33 files)`, `BUNDLE OK (9 checks)`, BUILD_VERSION identical, exactly two changed SHA256SUMS lines (both `server/restore-drill.sh`, old and new hash), `diff -rq` reported exactly two files (SHA256SUMS and server/restore-drill.sh); both throwaway directories deleted
- sweep: build-site `SELF-TEST OK (33 cases)`, verify-site `SELF-TEST OK (54 cases)`, server-config-check `SELF-TEST OK (32 cases)` (file untouched), server-check `SELF-TEST OK (224 cases)`, `SERVER-CHECK OK (23 checks)`
- changed since af34dce under deploy, pb, tests, tools, us-journey-tracker.html: exactly the five planned files; `git status --porcelain` for those paths empty; no `test-results/lwq-*` left

## Side effect

The bundle's SHA256SUMS changes only in the `server/restore-drill.sh` line; BUILD_VERSION 0ba1339903f1 and every other bundle file are identical (proved by the Task 3 build diff). The bundle still has 33 files.

## Things to remember

- `tests/e2e/platform/deploy-tools.spec.ts` still hardcodes `(33 files)` and was not edited. It must be updated together with any future migration (the bundle then has 34 files).
- The updated drill script reaches the server only in the Phase 16 deployment (owner-approved SHA256SUMS manifest); the server still runs the no-argument version. Reinstalling through 03 currently stops PocketBase even for tool-only changes (13-REVIEW WR-03); the README says so and the Phase 16 plan must account for it.
- 03-configure-pocketbase.sh, 04-start-pocketbase.sh and 00-status.sh are byte-for-byte unchanged since af34dce (`git diff --quiet af34dce` exit 0 in every task and in the final sweep). Adding a migration now needs the 03 `MIGRATIONS` list and `PB_MIGRATIONS_APP`, the 04 and 00-status loops and the README counts changed together; C-23 fails until they match.
- Self-test counts now: build-site 33 (was 28), server-check 224 (was 191), verify-site 54 and server-config-check 32 (unchanged).

## Deviations from Plan

None - plan executed exactly as written. Small implementation choices inside the plan: C-23 problem strings name only migration files; the existing C-22 self-test cases "没有恢复后的测试账号检查" and "没有 DRILL_RESULT" were switched to `replaceAll` because the new code adds second occurrences of those tokens, and the "refused 分支以 0 退出" case was re-anchored on the new guard shape (all as the plan describes for the first two). Every existing C-22 mutation case still fails for the intended reason under the throw-on-stale `gd` helper.

## Known Stubs

None.

## Threat Flags

None. No new network endpoints, auth paths or file access beyond the planned drill argument handling (covered by T-Q261117-03 to -06).

## Self-Check: PASSED

- FOUND commits 8e7e92a and d6dc94e (both ancestors of HEAD; `git rev-list --count af34dce..HEAD` is 2)
- All five modified files exist and are committed; working tree clean for deploy, pb, tests, tools and the app file
- Both commit messages end with the Co-Authored-By line
