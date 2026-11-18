---
phase: quick-261117-lwq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - deploy/build-site.mjs
  - deploy/verify-site.mjs
  - deploy/server-check.mjs
  - deploy/server/restore-drill.sh
  - deploy/README.md
autonomous: true
requirements: [QUICK-261117-lwq]

estimate:
  tokens: 110000
  raw_tokens: 110000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "D-01 (WR-04): every *.js file in pb/pb_migrations and deploy/pb_migrations reaches the upload bundle as pb_migrations/<name> without editing build-site.mjs, and BUNDLE_COUNT follows; a temporary probe migration produces a 34-file build"
    - "D-01: with today's four migrations the bundle is file-for-file identical to the pre-change build (BUILD OK 0ba1339903f1 (33 files), diff -r empty)"
    - "D-01: node deploy/server-check.mjs prints SERVER-CHECK OK (23 checks) on today's tree and FAIL C-23 as soon as the migration file set differs from the bundle list, the 03 MIGRATIONS list or PB_MIGRATIONS_APP count, the 04 or 00-status loop list, or the README file counts"
    - "D-02: deploy/server/03-configure-pocketbase.sh, 04-start-pocketbase.sh and 00-status.sh are byte-for-byte identical to commit af34dce"
    - "D-03 (IN-01): restore-drill.sh with no argument behaves as today (non-test data gives DRILL_GUARD=refused) and prints DRILL_MODE=test-only; --with-real-data is the only accepted argument; any other argument, or more than one, prints DRILL_ARGS=refused then DRILL_RESULT=FAIL and exits 1 before anything is read, copied or started"
    - "D-03: in real-data mode an unreadable live DB is still refused, non-test data prints DRILL_GUARD=real-data-present and continues, DRILL_RESTORED_TEST_ONLY=skipped, and the integrity, user-set, doc-sha256 and both-docs checks are unchanged; output stays DRILL_ KEY=VALUE lines only"
    - "D-03: server-check C-22 fails on every listed regression of the new argument handling (self-test mutations prove each one)"
    - "D-04: deploy/README.md describes both drill modes, when to use each, on-the-spot owner confirmation, the 18:40-19:20 UTC window, installation only in the Phase 16 deployment via the owner-approved SHA256SUMS manifest, and the WR-03 caveat that reinstalling through 03 stops PocketBase"
    - "Side effect: a build after the change differs from the pre-change build only in server/restore-drill.sh and its SHA256SUMS line; BUILD_VERSION and every other bundle file are identical"
  artifacts:
    - path: "deploy/build-site.mjs"
      provides: "MIGRATION_DIRS enumeration feeding BUNDLE_SOURCES, derived BUNDLE_COUNT, sourcesProblem guard, self-test cases"
      contains: "MIGRATION_DIRS"
    - path: "deploy/server-check.mjs"
      provides: "C-23 migration-list consistency check with fixtures and mutations; C-22 extended for argument handling and modes"
      contains: "export function c23"
    - path: "deploy/server/restore-drill.sh"
      provides: "test-only (no argument) and real-data (--with-real-data) modes"
      contains: "DRILL_MODE="
    - path: "deploy/verify-site.mjs"
      provides: "comment and self-test label no longer carry literal counts; paths still derived from BUNDLE_SOURCES"
    - path: "deploy/README.md"
      provides: "enumeration note for the bundle; both drill modes and the Phase 16 installation note"
      contains: "--with-real-data"
  key_links:
    - from: "deploy/build-site.mjs BUNDLE_SOURCES / BUNDLE_COUNT"
      to: "deploy/verify-site.mjs EXPECTED_PATHS and BD-01..BD-03"
      via: "existing import; derived automatically once BUNDLE_SOURCES is enumerated"
      pattern: "BUNDLE_SOURCES"
    - from: "deploy/build-site.mjs BUNDLE_SOURCES / BUNDLE_COUNT"
      to: "deploy/server-check.mjs loadContext -> c23"
      via: "new static import from ./build-site.mjs"
      pattern: "from './build-site.mjs'"
    - from: "deploy/server-check.mjs c23"
      to: "deploy/server/03-configure-pocketbase.sh, 04-start-pocketbase.sh, 00-status.sh, deploy/README.md"
      via: "text parse of MIGRATIONS=, PB_MIGRATIONS_APP=, the for-m-in loops and the README counts"
      pattern: "PB_MIGRATIONS_APP"
    - from: "deploy/server/restore-drill.sh MODE"
      to: "verify heredoc (env DRILL_MODE) and the shell OK_ALL check"
      via: "DRILL_RESTORED_TEST_ONLY=skipped in real-data mode, yes required in test-only mode"
      pattern: "DRILL_RESTORED_TEST_ONLY"
    - from: "deploy/server-check.mjs c22"
      to: "deploy/server/restore-drill.sh argument block and guard block"
      via: "static order and shape checks"
      pattern: "DRILL_ARGS=refused"
---

<objective>
Fix two Phase 13 code-review findings from `.planning/phases/13-deploy-hardening-acceptance/13-REVIEW.md` (sections `### WR-04` and `### IN-01`). Nothing in this task connects to, uploads to, or runs anything on the real server.

Decision IDs (from the orchestrator's task description and the owner's decision of 2026-11-17, locked, do not revisit):
- D-01 (WR-04): `deploy/build-site.mjs` enumerates `pb/pb_migrations/*.js` and `deploy/pb_migrations/*.js` (sorted, bundle path `pb_migrations/<name>`), derives `BUNDLE_COUNT`, and `deploy/server-check.mjs` gains one static check (C-23) with self-test mutations that the migration file set equals every hardcoded copy (03 `MIGRATIONS=` and `PB_MIGRATIONS_APP=<n>`, 04 loop, 00-status loop, verify-site, server-config-check, README counts).
- D-02 (hard constraint): `deploy/server/03-configure-pocketbase.sh`, `04-start-pocketbase.sh` and `00-status.sh` stay byte-for-byte unchanged (they are deployed on the live server).
- D-03 (IN-01, owner decision 2026-11-17 "加导入后模式"): `deploy/server/restore-drill.sh` keeps today's behaviour with no argument and accepts exactly one argument `--with-real-data` (post-import mode) with the guard, output and cleanup rules below; C-22 checks the new argument handling.
- D-04: `deploy/README.md` documents both modes; the updated drill script is installed only in the Phase 16 deployment (owner-approved SHA256SUMS manifest), not now; the README notes the WR-03 caveat.

Expected side effect (state it in the SUMMARY): the bundle's `SHA256SUMS` changes only in the `server/restore-drill.sh` line; `BUILD_VERSION` (0ba1339903f1) and every other bundle file stay identical. Task 3 proves this by diffing a pre-change and a post-change build in throwaway `test-results/` directories.

Purpose: a migration added before Phase 16 can no longer be silently left out of the bundle and the server scripts, and the backup-restore drill stays usable after real data is imported.
Output: edited build-site, verify-site, server-check, restore-drill and README; two commits.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@.planning/phases/13-deploy-hardening-acceptance/13-REVIEW.md

Grounded facts (measured at HEAD af34dce while planning; working tree of deploy/, pb/, tools/probe/page/vendor and us-journey-tracker.html clean):
- Tool baselines: `node deploy/server-check.mjs --self-test` -> `SELF-TEST OK (191 cases)`; `node deploy/server-check.mjs` -> `SERVER-CHECK OK (22 checks)`; `node deploy/build-site.mjs --self-test` -> `SELF-TEST OK (28 cases)`; `node deploy/verify-site.mjs --self-test` -> `SELF-TEST OK (54 cases)`; `node deploy/server-config-check.mjs --self-test` -> `SELF-TEST OK (32 cases)`.
- `node deploy/build-site.mjs --out test-results/<dir>` -> `BUILD OK 0ba1339903f1 (33 files)`; SHA256SUMS has 32 lines; `node deploy/verify-site.mjs --check-bundle <dir>` -> `BUNDLE OK (9 checks)`. `test-results/` is gitignored. build-site's default output is `private/deploy-out`: ALWAYS pass `--out test-results/...`.
- sha256 at HEAD: 03-configure-pocketbase.sh `313b26a947f2563d44838a22ab68bcd30b967e309721c1315bf39453abf11b9a`, 04-start-pocketbase.sh `d2f9fd625e436ae822ecac825d423fb03e5f9724b723c0604c66fc12231fc799`, 00-status.sh `ebcbc137db8d0cffcdf58bf95f43df057feea0dd08c9b54d91dc12d2b76e5b2f`, restore-drill.sh `57a24b237a46cbc2bb2a7dbe1f8d1f11c9d7e4f52649e3bd7ad033997e639513`.
- Migration files today: `pb/pb_migrations/` has 1794096000_users_lockdown.js and 1794096100_journey_docs.js; `deploy/pb_migrations/` has 1794096150_retire_probe.js and 1794096200_server_settings.js. Combined sort by name equals today's BUNDLE_SOURCES order.
- Hardcoded copies: build-site.mjs lines 49-73 (four `pb_migrations/...` entries inside BUNDLE_SOURCES, `BUNDLE_COUNT = 32`, header comment lines 8-18 with counts); 03 line 77 `MIGRATIONS="..."`, line 18 comment `应用迁移 4 个文件`, line 24 comment and line 236 `echo "PB_MIGRATIONS_APP=4"`; 04 line 117 `for m in <4 names>; do`; 00-status line 180 (indented) `for m in <4 names>; do`; README line 28 (`应用的两个迁移`), line 32 (`32 个文件加 \`SHA256SUMS\``), line 34 (`上传包的 32 个文件` and `` `pb_migrations/` 4 个 ``), line 47 (`恰好 32 行`), line 65 (`32 个加 \`SHA256SUMS\``). Each of these four bundle-count phrases occurs exactly once in README today.
- verify-site.mjs hardcodes NO migration name: it imports BUNDLE_COUNT and BUNDLE_SOURCES from ./build-site.mjs (line 40), EXPECTED_PATHS is derived (line 62), BD-01 compares `entries.length !== BUNDLE_COUNT` (line 301); only the comment on line 51 (`生成的 11 个加原样复制的 21 个`) and the self-test label on line 864 (`固定清单：32 个路径…`) carry literal counts.
- server-config-check.mjs enumerates with readdirSync in makeMigrationsDir (lines 89-109; constants APP_MIGRATIONS line 35, DEPLOY_MIGRATIONS line 36). Its single-quoted migration literals: 1794096150_retire_probe.js (1x), 1794096200_server_settings.js (4x), plus 1794200000_probe_schema.js and 1794200001_probe_user.js, which the retire scenario writes into its own temp directory (they are not repo migrations). server-config-check.mjs is NOT edited by this task.
- tests/e2e/platform/deploy-tools.spec.ts runs the build CLI and expects `(33 files)`; with today's files that stays true. Not edited.
- server-check.mjs layout: helpers codeLines/headerText/funcBody; c22 at lines 722-810; CHECKS 813-836; loadContext 840-859 (ctx.sh holds every deploy/server/*.sh including 00-status.sh); fixtures GOOD_03 888-900, GOOD_04 902-910, GOOD_00 976-988, DRILL_EMAIL_RE and GOOD_DRILL 1142-1191; goodContext 1193-1221; mutate 1224-1231; selfTest from 1233 (first case "好的合成上下文在 C-02 到 C-22 全部通过" ~1251; C-22 cases ~1500-1530). `expect()` catches exceptions and counts them as a failed case.
- c22 facts the new code must respect: the guard read is the first line matching the mode=ro connect to the live data.db; the line containing `DRILL_GUARD=refused` must have `exit [1-9]` within the next 6 code lines and no `exit 0`; the first install/mkdir/cp/systemd-run/backup line must come after the guard; every `echo "KEY=` and `out["KEY"]` must start with `DRILL_`; the test email regex string must appear at least twice.
- restore-drill.sh layout: header comment lines 1-50; root check then `if [ "$#" -ne 0 ]` refusal at lines 73-80 (exit 2, no DRILL_ key); time window `HHMM=` line 83; guard heredoc 106-117 printing `bad_users bad_docs` or ERR, refusal 118-124; cleanup/trap 127-148; verify heredoc 263-335 (`runuser -u pocketbase -- env BACKUP_TS="$BACKUP_TS" python3 -I -`); shell OK_ALL checks 336-372.
- Git: system-wide core.autocrlf=true but tracked files are LF; `*.sh` pinned `eol=lf`. Edit with the Edit tool so LF is preserved.

Rules the executor must follow in every task:
- Never ssh, upload to, or contact the server; never read anything under `private/`; no downloads, no installs, no `npx` except `npx --no playwright`; no disk-wide scans.
- `us-journey-tracker.html` is not touched, so no Playwright suite is needed. Run only the deploy tool checks named in the verify blocks plus `bash -n`. server-check and server-config-check lower their own priority. Never run two checks or test runs at the same time; never change Playwright `workers`. Do not run `server-config-check.mjs --local` (needs a PocketBase instance).
- Do not edit anything under `.planning/phases/` (the orchestrator updates the review ledger afterwards). Do not edit 03, 04 or 00-status (D-02).
- No single Write/Edit longer than about 120 lines; write the SUMMARY in parts.
- Commits: stage explicit paths only; never stage `.planning/milestones/**`, `.planning/state.json`, `.impeccable/`, `.planning/ui-reviews/`, `private/`, `test-results/`; never `--no-verify` (a privacy pre-commit hook runs; if it reports a finding, stop and report rule and number only). No local absolute paths in committed files. No server address, domain, keys, passwords, real data or personal plan text anywhere. Each commit message ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: WR-04 end to end — the migration directories drive the bundle, and server-check C-23 guards every hardcoded copy</name>
  <files>deploy/build-site.mjs, deploy/verify-site.mjs, deploy/server-check.mjs, deploy/README.md</files>
  <precondition>`git diff --quiet af34dce -- deploy pb us-journey-tracker.html tools/probe/page/vendor` exits 0 (build inputs unchanged since planning).</precondition>
  <read_first>
    - deploy/build-site.mjs lines 1-75 (header, imports, BUNDLE_SOURCES, BUNDLE_COUNT), 156-192 (buildSite extras block), 300-350 (self-test cases about the bundle)
    - deploy/verify-site.mjs lines 40-62 and 860-866
    - deploy/server-check.mjs lines 1-30, 66-86 (codeLines, headerText), 722-860 (c22, CHECKS, loadContext), 878-990 (fixtures GOOD_03, GOOD_04, GOOD_00), 1193-1255 (goodContext, mutate, selfTest start)
    - deploy/server/03-configure-pocketbase.sh lines 15-25, 75-82, 234-237; deploy/server/04-start-pocketbase.sh lines 115-122; deploy/server/00-status.sh lines 177-184 (read only, never edit)
    - deploy/server-config-check.mjs lines 33-41 and 89-109 (read only)
    - deploy/README.md lines 24-66
  </read_first>
  <behavior>
    - build-site: migrationSources(synthetic lister) returns the .js files of both directories sorted by bundle path as [pb_migrations/<name>, <dir>/<name>] and ignores non-.js names
    - build-site: sourcesProblem reports a duplicate bundle path and a list without any pb_migrations/ entry; returns null for the real BUNDLE_SOURCES
    - build-site: BUNDLE_COUNT equals 7 + ICON_NAMES.length + BUNDLE_SOURCES.length (32 today); the real build is byte-identical to the pre-change build
    - server-check C-23 passes the good synthetic context and fails each of the 21 mutations listed in the action
    - real tree: SERVER-CHECK OK (23 checks); with a temporary extra migration file the build has 34 files and C-23 fails
  </behavior>
  <action>
Why this is the tracer: it proves the one path WR-04 is about, end to end — a migration file in a directory flows into the upload bundle with no list to edit, and every copy of the list that cannot follow automatically (03, 04, 00-status, README) is caught by one check — before Task 2 changes anything else.

0. Baseline (before any edit): `rm -rf test-results/lwq-before && node deploy/build-site.mjs --out test-results/lwq-before`; the last line must be `BUILD OK 0ba1339903f1 (33 files)`. Keep this directory for Task 3. Never build without `--out test-results/...`.

1. deploy/build-site.mjs (per D-01):
   - Add readdirSync to the node:fs import. Add `export const MIGRATION_DIRS` = the two repo-relative directories pb/pb_migrations and deploy/pb_migrations (single-quoted string literals, in that order).
   - Add pure `export function migrationSources(listDir)`: for each directory of MIGRATION_DIRS, every name returned by listDir(dir) that ends in `.js` becomes the pair [bundle path `pb_migrations/<name>`, source path `<dir>/<name>`]; return the pairs sorted by bundle path with the same code-unit comparator sumsOf uses (ties by source path, so a duplicate stays visible). Add a module-private real lister that reads join(ROOT, dir) with readdirSync withFileTypes, keeps regular files only, and returns [] when the directory is missing or unreadable (never throw at module load).
   - BUNDLE_SOURCES: keep the 16 server/ entries and the pb_hooks/backup-watch.pb.js entry literally; replace the four literal pb_migrations/ entries, at the same position, with a spread of migrationSources(real lister). Reword the comment above it (fixed list for server files and the hook; migrations enumerated from MIGRATION_DIRS).
   - Add `export function sourcesProblem(sources)`: returns null, or a fixed Chinese message for a duplicate bundle path (naming that path) or for a list with no entry starting with pb_migrations/ (naming the two directories). Call it first inside buildSite's `if (extras !== undefined)` block and throw BuildError with the message when it is not null.
   - BUNDLE_COUNT becomes 7 + ICON_NAMES.length + BUNDLE_SOURCES.length, with a comment naming the generated files (site/index.html, site/sw.js, the manifest, the vendor SDK and its SHA256SUMS, the icons, usj-csp.conf, BUILD_VERSION).
   - Header comment lines 8-18: drop the literal totals and the per-directory counts; say pb_migrations/ holds every *.js of the two directories (automatic, sorted, original names and bytes) and that server-check C-23 compares the server scripts' lists and the README counts with those directories. Do not write any migration file name into build-site.mjs, not even in a comment: C-23 rejects a 10-digit migration literal in this file.
   - Self-test: replace the case about "清单固定 21 个来源" with one asserting 17 non-migration entries, at least one pb_migrations/ entry and no 00-status; make the labels of the two cases that say 32 use the BUNDLE_COUNT value; add cases (a) migrationSources with a synthetic lister whose pb/pb_migrations holds 2_b.js, 1_a.js and notes.md and whose deploy/pb_migrations holds 3_c.js returns exactly the three pairs for 1_a, 2_b (pb dir) and 3_c (deploy dir) in that order; (b) sourcesProblem is not null when both synthetic directories hold the same name; (c) sourcesProblem is not null for a list without pb_migrations/ entries; (d) sourcesProblem(BUNDLE_SOURCES) is null; (e) the BUNDLE_COUNT identity. Total at least 33 cases.

2. deploy/verify-site.mjs: reword the comment on line 51 so it carries no literal counts (generated paths plus the files BUNDLE_SOURCES copies verbatim; counts come from build-site.mjs) and make the self-test label on line 864 show the BUNDLE_COUNT value instead of 32. No other change; no migration names.

3. deploy/server-check.mjs, new check C-23 (per D-01):
   - Add a static import of BUNDLE_COUNT and BUNDLE_SOURCES from ./build-site.mjs. Extend the header comment: C-23 also reads pb/pb_migrations and deploy/pb_migrations, deploy/README.md, verify-site.mjs, server-config-check.mjs, build-site.mjs and build-site's exported list; still no private/, no network.
   - Module constant SCENARIO_MIGRATIONS = the two names 1794200000_probe_schema.js and 1794200001_probe_user.js, commented as names server-config-check's retire scenario writes into its own temp directory.
   - loadContext adds `mig`: names = regular *.js files of both directories (duplicates kept); bundle = BUNDLE_SOURCES bundle paths starting with pb_migrations/, prefix stripped; bundleCount = BUNDLE_COUNT; buildSite, verifySite, configCheck, readme = the texts of deploy/build-site.mjs, deploy/verify-site.mjs, deploy/server-config-check.mjs, deploy/README.md.
   - `export function c23(ctx)` after c22, returning Chinese problem strings (they may name migration files, nothing else): (a) ctx.mig missing; (b) names empty, or a name present twice; (c) want = the sorted names; every list below is compared as a sorted list (duplicates count as a mismatch) and the message says which names are missing or extra; (d) mig.bundle vs want; (e) 03 (ctx.sh['03-configure-pocketbase.sh'], missing is a problem): exactly one code line (codeLines) of the form MIGRATIONS="…", whose whitespace-split tokens equal want; every PB_MIGRATIONS_APP=<n> in the whole text (header comment included) has n = want.length and at least one is a code line echo "PB_MIGRATIONS_APP=<n>"; every `应用迁移 <n> 个文件` in the whole text has n = want.length; (f) 04 and 00-status: exactly one code line per script of the form `for m in <tokens>; do` whose tokens all end in .js (leading spaces allowed; the 03 loops over $MIGRATIONS do not match), tokens equal want; (g) buildSite text has no match of the 10-digit migration name pattern `\b\d{10}_[A-Za-z0-9_]+\.js\b` and contains both single-quoted directory literals 'pb/pb_migrations' and 'deploy/pb_migrations'; (h) verifySite text has no such match, has a line where EXPECTED_PATHS is built with BUNDLE_SOURCES.map( and contains `entries.length !== BUNDLE_COUNT`; (i) configCheck text contains `path.join(REPO, 'pb', 'pb_migrations')`, `path.join(HERE, 'pb_migrations')` and `readdirSync(src)`, and every single-quoted 10-digit migration literal in it is in want or SCENARIO_MIGRATIONS; (j) readme: every `` `pb_migrations/` <n> 个 `` has n = want.length (at least one), and each of the four bundle-count phrases (<n> 个文件加 `SHA256SUMS`; 上传包的 <n> 个文件; 恰好 <n> 行; <n> 个加 `SHA256SUMS`) occurs at least once with every n = mig.bundleCount.
   - CHECKS: add C-23 with a title naming the compared lists (两个迁移目录的 .js = 上传包、03 的 MIGRATIONS 和 PB_MIGRATIONS_APP、04 和 00-status 的循环、README 的文件数；build-site、verify-site 不写死迁移名；server-config-check 只引用存在的迁移).
   - Fixtures: append to GOOD_03 a line MIGRATIONS="1000000001_a.js 1000000002_b.js" and a line echo "PB_MIGRATIONS_APP=2"; append to GOOD_04 a `for m in 1000000001_a.js 1000000002_b.js; do` loop whose body is a `sudo -n test -f "$MIG_DIR/$m" </dev/null` check that exits 1; insert into GOOD_00, before `kv STATUS_DONE 1`, an indented loop over the same two names whose body is `if root_run test -f "/var/lib/pocketbase/pb_migrations/$m" 2>/dev/null; then APP_MIG=$((APP_MIG + 1)); fi` (C-12 must stay green). Add GOOD_MIG {names and bundle = the two names, bundleCount 30, buildSite = a line declaring both directory literals, verifySite = the real EXPECTED_PATHS line plus a line containing `entries.length !== BUNDLE_COUNT`, configCheck = the two path.join constants, a readdirSync(src) loop line, a quoted 1000000002_b.js and a quoted 1794200000_probe_schema.js, readme = the four bundle-count phrases with 30 and `` `pb_migrations/` 2 个 ``}; goodContext gets mig: GOOD_MIG.
   - Self-test: the first case becomes "C-02 到 C-23" and includes c23. Add a C-23 section with helpers that throw when a mutation leaves the text or mig unchanged (expect() then reports the case as failed, so a stale anchor can never pass silently). Cases: good passes; fails when: bundle lacks a name; 03 MIGRATIONS lacks a name; 03 PB_MIGRATIONS_APP is 3; 03 has no MIGRATIONS line; 04 loop lacks a name; 04 has no loop; 00-status loop has an extra name; buildSite contains a quoted 10-digit migration name; buildSite lacks 'deploy/pb_migrations'; verifySite contains a 10-digit migration name; verifySite's EXPECTED_PATHS is a literal array; configCheck quotes a name that is in neither list; configCheck lacks readdirSync(src); readme says `` `pb_migrations/` 3 个 ``; readme says 恰好 31 行; readme lacks the "个加 `SHA256SUMS`" phrase; names hold a duplicate; names empty; mig missing; and the WR-04 scenario (a third name added to names and bundle while 03, 04, 00-status and README stay as they are).

4. deploy/README.md (per D-01): line 28 drops the count word (应用的迁移在 `pb/pb_migrations/`). In the paragraph on line 34 keep every existing number exactly as it is and add one sentence: build-site collects pb_migrations/ automatically from pb/pb_migrations and deploy/pb_migrations; a new migration also needs the 03 MIGRATIONS list and PB_MIGRATIONS_APP, the 04 and 00-status loops and the file counts in this section changed together (server-check C-23 fails until they match), and changing 03/04/00-status goes through owner approval. Do not add another "恰好 … 行" phrase anywhere in README.

5. Run the verify command, then commit only deploy/build-site.mjs, deploy/verify-site.mjs, deploy/server-check.mjs, deploy/README.md with the message `fix(quick-261117-lwq): enumerate bundle migrations from the migration directories and add server-check C-23 (13-REVIEW WR-04)`, body one line on what C-23 compares, ending with the Co-Authored-By line from the rules.
  </action>
  <verify>
    <automated>n1=$(node deploy/build-site.mjs --self-test | sed -n 's/^SELF-TEST OK (\([0-9]*\) cases)$/\1/p') && test "${n1:-0}" -ge 33 && n2=$(node deploy/server-check.mjs --self-test | sed -n 's/^SELF-TEST OK (\([0-9]*\) cases)$/\1/p') && test "${n2:-0}" -ge 212 && node deploy/server-check.mjs | tail -1 | grep -qx 'SERVER-CHECK OK (23 checks)' && node deploy/verify-site.mjs --self-test | tail -1 | grep -qx 'SELF-TEST OK (54 cases)' && rm -rf test-results/lwq-t1 && node deploy/build-site.mjs --out test-results/lwq-t1 | tail -1 | grep -qx 'BUILD OK 0ba1339903f1 (33 files)' && diff -r test-results/lwq-before test-results/lwq-t1 && node deploy/verify-site.mjs --check-bundle test-results/lwq-t1 | tail -1 | grep -qx 'BUNDLE OK (9 checks)' && rm -rf test-results/lwq-t1 && ( P=pb/pb_migrations/1999999999_lwq_probe.js; trap 'rm -f "$P"; rm -rf test-results/lwq-probe' EXIT; printf '// lwq probe\n' > "$P" && node deploy/build-site.mjs --out test-results/lwq-probe | tail -1 | grep -q ' (34 files)$' && test -f test-results/lwq-probe/pb_migrations/1999999999_lwq_probe.js && node deploy/server-check.mjs | grep -q '^FAIL C-23' ) && test ! -e pb/pb_migrations/1999999999_lwq_probe.js && git diff --quiet af34dce -- deploy/server/03-configure-pocketbase.sh deploy/server/04-start-pocketbase.sh deploy/server/00-status.sh</automated>
  </verify>
  <done>build-site enumerates the two migration directories and derives BUNDLE_COUNT; today's build is byte-identical to the baseline (BUILD OK 0ba1339903f1 (33 files), diff -r empty, BUNDLE OK (9 checks)); a temporary probe migration yields 34 files and FAIL C-23 and is removed again; server-check self-test at least 212 cases and SERVER-CHECK OK (23 checks); build-site self-test at least 33, verify-site self-test 54; 03, 04, 00-status unchanged; one commit with the four files.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: IN-01 — restore drill gains the post-import mode --with-real-data, and C-22 requires the new argument handling</name>
  <files>deploy/server/restore-drill.sh, deploy/server-check.mjs, deploy/README.md</files>
  <read_first>
    - deploy/server/restore-drill.sh in full (379 lines; header 1-50, entry 66-80, guard 105-125, verify 262-372)
    - deploy/server-check.mjs lines 722-810 (c22), 813-836 (CHECKS title), 1142-1191 (DRILL_EMAIL_RE, GOOD_DRILL), 1495-1532 (C-22 self-test cases)
    - deploy/README.md lines 72-76 and 138-160 (approval rule 8 and the backup and drill section), line 201
  </read_first>
  <behavior>
    - restore-drill: an unknown argument, two arguments, or `--with-real-data=1` print exactly DRILL_ARGS=refused then DRILL_RESULT=FAIL and exit 1, before the time window or any read
    - restore-drill: no argument prints DRILL_MODE=test-only first; `--with-real-data` prints DRILL_MODE=real-data first
    - restore-drill (static, via C-22): an unreadable live DB is refused in both modes; non-test data in real-data mode gives DRILL_GUARD=real-data-present; real-data mode reports DRILL_RESTORED_TEST_ONLY=skipped
    - server-check C-22 passes the updated GOOD_DRILL and fails each of the 12 new mutations and every existing one
  </behavior>
  <action>
1. deploy/server/restore-drill.sh (per D-03; nothing else in the script changes — time window, R2 write and delete, restore, cleanup, read-only rules and the DRILL_-only output stay as they are; do not fix WR-07 here):
   - Header comment: line 4 no longer says the script takes no arguments; it names the two modes, `sudo usj-restore-drill` (只测模式 test-only, the default) and `sudo usj-restore-drill --with-real-data` (导入后模式 real-data, owner decision 2026-11-17), and says any other argument, or more than one, prints DRILL_ARGS=refused and DRILL_RESULT=FAIL and exits 1 before anything is read, copied or started. In step 2.5 replace the sentence that claims real accounts and data can never enter the drill: in test-only mode they cannot; in real-data mode the read-only guard still runs, still refuses when the live DB cannot be read, prints DRILL_GUARD=real-data-present and continues when non-test data exists (DRILL_GUARD=ok when only test data exists); the read-only copy then holds real data, stays only in the 0700 drill directory and is deleted by the EXIT trap; the short-lived drill_ backup that step 10 writes to R2 is a backup of that copy, so it also contains real data (R2 already holds real-data automatic backups) and is deleted right after. Step 12: "恢复库只含测试账号" applies to test-only mode; real-data mode prints DRILL_RESTORED_TEST_ONLY=skipped. Output list: add DRILL_ARGS (only refused) and DRILL_MODE (test-only|real-data), note the values DRILL_GUARD ok|refused|real-data-present and DRILL_RESTORED_TEST_ONLY yes|no|skipped, keep the no-email/token/password sentence. Keep the 输出 and 回滚 lines (C-03).
   - Entry: keep the root check unchanged. Replace the old refuse-every-argument block with: `MODE=test-only`; an if whose condition is exactly `[ "$#" -gt 1 ] || { [ "$#" -eq 1 ] && [ "$1" != "--with-real-data" ]; }` and whose body is exactly four lines — echo "DRILL_ARGS=refused", one Chinese stderr line saying only the optional --with-real-data is accepted, echo "DRILL_RESULT=FAIL", exit 1; then set MODE=real-data when exactly one argument is present; then echo "DRILL_MODE=$MODE". All of it before the HHMM= time-window line; $1 is only read when $# is 1 (set -u).
   - Guard (keep the heredoc unchanged): replace the refusal block after it with GUARD_STATE=refused; `if [ "$GUARD" = "0 0" ]` sets GUARD_STATE=ok; an elif line `elif [ "$MODE" = "real-data" ] && [[ "$GUARD" =~ ^[0-9]+\ [0-9]+$ ]]; then` followed directly by the line GUARD_STATE=real-data-present (so ERR or any other output still refuses); fi; then `if [ "$GUARD_STATE" = "refused" ]` with exactly four body lines — echo "DRILL_GUARD=refused", one Chinese stderr line (live DB unreadable, or in test-only mode data other than test accounts exists; nothing copied; after importing real data use --with-real-data), echo "DRILL_RESULT=FAIL", exit 1; fi; then echo "DRILL_GUARD=$GUARD_STATE". C-22 needs the exit within 6 code lines of the refused line, so keep that body at four lines.
   - Verify heredoc: pass the mode in the env list (`env BACKUP_TS="$BACKUP_TS" DRILL_MODE="$MODE" python3 -I -`). Keep the TEST regex line. When os.environ["DRILL_MODE"] is real-data, set out["DRILL_RESTORED_TEST_ONLY"] to "skipped"; otherwise compute only_test and set "yes"/"no" exactly as today. All other out keys unchanged.
   - Shell check: the DRILL_RESTORED_TEST_ONLY case compares against an expected value that is yes in test-only mode and skipped in real-data mode; the other checks stay unchanged.

2. deploy/server-check.mjs, C-22 (per D-03; keep every existing rule):
   - Add rules: (a) a line containing DRILL_ARGS=refused exists; (b) the line immediately before it contains `"$#" -gt 1` and `"$1" != "--with-real-data"`; (c) the 5 code lines starting at it contain DRILL_RESULT=FAIL and an `exit [1-9]` line and no `exit 0` line; (d) it comes before the HHMM= line, before the guard read and before the first install/mkdir/cp/systemd-run/backup line (reuse iGuardRead and iFirstMut); (e) no code line matches the old `"$#" -ne 0` refusal; (f) a line `echo "DRILL_MODE=$MODE"` exists before the guard read, and the code has a MODE=test-only line and a MODE=real-data assignment; (g) a line containing GUARD_STATE=real-data-present exists and the line immediately before it contains `"$MODE" = "real-data"` and `=~ ^[0-9]+` (an unreadable DB must still refuse); (h) some line contains both DRILL_RESTORED_TEST_ONLY and skipped. Extend the C-22 title in CHECKS with: 只接受 --with-real-data（未知参数在一切读写之前拒绝）、DRILL_MODE、导入后模式读不出线上库仍拒绝.
   - Fixture: add a module constant DRILL_ARGS_BLOCK (the 5-line if block: the condition line from step 1, then echo "DRILL_ARGS=refused", echo "DRILL_RESULT=FAIL", exit 1, fi; trailing newline) and use it in GOOD_DRILL between the fail_early line and the HHMM= line, preceded by MODE=test-only and followed by `if [ "$#" -eq 1 ]; then MODE=real-data; fi` and echo "DRILL_MODE=$MODE". Replace GOOD_DRILL's guard refusal with the GUARD_STATE shape from step 1 (refused body: echo "DRILL_GUARD=refused", echo "x" >&2, exit 1), then fi, then echo "DRILL_GUARD=$GUARD_STATE", then the existing cleanup() lines. In the verify part keep the TEST line directly followed by out["DRILL_RESTORED_TEST_ONLY"] = "yes", then `if os.environ["DRILL_MODE"] == "real-data":` and an indented out["DRILL_RESTORED_TEST_ONLY"] = "skipped".
   - Self-test: make gd throw when the mutation leaves the text unchanged. Update the existing case "refused 分支以 0 退出" to anchor on the guard refusal followed by the echo "DRILL_GUARD=$GUARD_STATE" line, and make "没有恢复后的测试账号检查" replace every occurrence. Add 12 cases that must fail: DRILL_ARGS=refused renamed; the args branch exits 0; the args branch lacks DRILL_RESULT=FAIL; DRILL_ARGS_BLOCK moved after `trap cleanup EXIT`; the `"$#" -gt 1 || ` part removed; --with-real-data replaced by another word in the condition; an old `"$#" -ne 0` refusal appended; the DRILL_MODE echo removed; the DRILL_MODE echo moved after echo "DRILL_GUARD=$GUARD_STATE"; real-data-present renamed; the `=~` numeric test removed from the elif line; "skipped" replaced by "yes".

3. deploy/README.md section 10 (per D-04): rewrite the drill bullets (keep the time-window bullet, the real-restore bullet and the next-day bullet) so they say: two modes with both commands; 只测模式 (no argument) is for the time before real data exists and refuses (DRILL_GUARD=refused) when any non-test account or doc exists; 导入后模式 `--with-real-data` is for after the import, run manually (for example before a PocketBase upgrade or periodically), each run confirmed by the owner on the spot like every server-changing step (section 5 rule 8), never in 18:40-19:20 UTC (the script refuses anyway); in that mode the guard still reads the live DB read-only and refuses when it cannot, prints DRILL_GUARD=real-data-present, prints DRILL_RESTORED_TEST_ONLY=skipped and keeps every other check (integrity, user ids created no later than the backup, sha256 of docs not updated since, at least one user with both docs); the copy with real data stays in the 0700 drill directory and is deleted at exit; the short-lived drill_ backup in R2 contains a copy of real data (R2 already holds real-data automatic backups) and is deleted right away (delete it by hand in the admin if the script says it could not); output stays DRILL_ keys with counts or ok-style values, never emails, tokens or document content, and is still passed through the redact filter before pasting. Add an installation note: the server still runs the previous no-argument version; the updated script is installed through 03 as part of the Phase 16 deployment (owner-approved SHA256SUMS manifest), not now; reinstalling through 03 currently stops PocketBase even when only tool files such as this script changed (13-REVIEW WR-03), so the Phase 16 deployment plan must account for that. Update line 201 so it says the test-only drill is done before the import and the post-import mode is used afterwards. Keep every count that C-23 reads unchanged and add no "恰好 … 行" phrase.

4. Run the verify command (it includes a local smoke run of restore-drill.sh that shadows `id` and `curl` with shell functions so the script stops at the argument check or at the local health check; it reads, copies and starts nothing and contacts nothing). Commit only deploy/server/restore-drill.sh, deploy/server-check.mjs, deploy/README.md with the message `feat(quick-261117-lwq): restore drill post-import mode --with-real-data, checked by C-22 (13-REVIEW IN-01)`, ending with the Co-Authored-By line from the rules.
  </action>
  <verify>
    <automated>bash -n deploy/server/restore-drill.sh && n=$(node deploy/server-check.mjs --self-test | sed -n 's/^SELF-TEST OK (\([0-9]*\) cases)$/\1/p') && test "${n:-0}" -ge 224 && node deploy/server-check.mjs | tail -1 | grep -qx 'SERVER-CHECK OK (23 checks)' && S=deploy/server/restore-drill.sh && drill() { bash -c 'id(){ echo 0; }; curl(){ echo 000; }; export -f id curl; bash "$@"; echo "RC=$?"' _ "$S" "$@" 2>/dev/null; } && REF="$(printf 'DRILL_ARGS=refused\nDRILL_RESULT=FAIL\nRC=1')" && [ "$(drill --bogus)" = "$REF" ] && [ "$(drill --with-real-data --with-real-data)" = "$REF" ] && [ "$(drill --with-real-data=1)" = "$REF" ] && drill --with-real-data | head -1 | grep -qx 'DRILL_MODE=real-data' && drill | head -1 | grep -qx 'DRILL_MODE=test-only' && drill | tail -2 | head -1 | grep -qx 'DRILL_RESULT=FAIL' && grep -q -- '--with-real-data' deploy/README.md && git diff --quiet af34dce -- deploy/server/03-configure-pocketbase.sh deploy/server/04-start-pocketbase.sh deploy/server/00-status.sh</automated>
  </verify>
  <done>restore-drill.sh passes bash -n; bad arguments give exactly DRILL_ARGS=refused, DRILL_RESULT=FAIL and exit 1; no argument and --with-real-data print DRILL_MODE first; server-check self-test at least 224 cases and SERVER-CHECK OK (23 checks); README documents both modes, the Phase 16 installation and the WR-03 caveat; 03, 04, 00-status unchanged; one commit with the three files.</done>
</task>

<task type="auto">
  <name>Task 3: Prove the bundle side effect (only server/restore-drill.sh changes) and run the full deploy-tool sweep</name>
  <files>test-results/lwq-before/, test-results/lwq-after/ (throwaway, gitignored, deleted at the end; no tracked file changes)</files>
  <read_first>
    - test-results/lwq-before/SHA256SUMS (the baseline built in Task 1 step 0)
  </read_first>
  <action>
1. If test-results/lwq-before is missing (for example after a context reset), rebuild the baseline from the pre-change commit without touching the working tree: `rm -rf test-results/lwq-base-src && mkdir -p test-results/lwq-base-src && git -c core.autocrlf=false archive af34dce deploy pb tools/probe/page/vendor us-journey-tracker.html | tar -x -C test-results/lwq-base-src && node test-results/lwq-base-src/deploy/build-site.mjs --out test-results/lwq-base-src/test-results/out`, check its last line is `BUILD OK 0ba1339903f1 (33 files)`, then move test-results/lwq-base-src/test-results/out to test-results/lwq-before and delete test-results/lwq-base-src. (core.autocrlf must be off for the archive: the system setting is true and would turn LF files into CRLF, giving false differences.)
2. Build after the change: `rm -rf test-results/lwq-after && node deploy/build-site.mjs --out test-results/lwq-after`; then run the verify command. It requires: the same `BUILD OK 0ba1339903f1 (33 files)` line; `BUNDLE OK (9 checks)`; identical BUILD_VERSION; exactly two changed SHA256SUMS lines, both for server/restore-drill.sh (old and new hash); `diff -rq` reporting exactly two files (SHA256SUMS and server/restore-drill.sh); then it deletes both directories.
3. Sweep, one command at a time (never in parallel): build-site self-test at least 33 cases; verify-site self-test 54 cases; server-config-check self-test 32 cases (unchanged file, sanity); server-check self-test at least 224 cases and the real run `SERVER-CHECK OK (23 checks)`; 03/04/00-status unchanged since af34dce; the only tracked code files changed since af34dce are the five in files_modified; no tracked change left uncommitted under deploy/, pb/, tests/, tools/ or us-journey-tracker.html; no test-results/lwq-* directory left.
4. Write the SUMMARY in parts (no single write over about 120 lines). It must state the side effect in these words: the bundle's SHA256SUMS changes only in the server/restore-drill.sh line; BUILD_VERSION 0ba1339903f1 and every other bundle file are identical. Also record: the new self-test counts; that tests/e2e/platform/deploy-tools.spec.ts still hardcodes `(33 files)` and must be updated together with any future migration; that the updated drill script reaches the server only in the Phase 16 deployment (owner-approved manifest) and that 03 currently stops PocketBase for tool-only changes (WR-03); that 03, 04 and 00-status are byte-for-byte unchanged. No commit in this task (the orchestrator commits planning docs).
  </action>
  <verify>
    <automated>test -d test-results/lwq-before && rm -rf test-results/lwq-after && node deploy/build-site.mjs --out test-results/lwq-after | tail -1 | grep -qx 'BUILD OK 0ba1339903f1 (33 files)' && node deploy/verify-site.mjs --check-bundle test-results/lwq-after | tail -1 | grep -qx 'BUNDLE OK (9 checks)' && cmp -s test-results/lwq-before/BUILD_VERSION test-results/lwq-after/BUILD_VERSION && [ "$(diff test-results/lwq-before/SHA256SUMS test-results/lwq-after/SHA256SUMS | grep '^[<>]' | sed 's/^[<>] [0-9a-f]\{64\}  //' | LC_ALL=C sort | tr '\n' ' ')" = "server/restore-drill.sh server/restore-drill.sh " ] && [ "$(diff -rq test-results/lwq-before test-results/lwq-after | wc -l | tr -d ' ')" = 2 ] && diff -rq test-results/lwq-before test-results/lwq-after | grep -q 'server/restore-drill\.sh' && rm -rf test-results/lwq-before test-results/lwq-after && n1=$(node deploy/build-site.mjs --self-test | sed -n 's/^SELF-TEST OK (\([0-9]*\) cases)$/\1/p') && test "${n1:-0}" -ge 33 && node deploy/verify-site.mjs --self-test | tail -1 | grep -qx 'SELF-TEST OK (54 cases)' && node deploy/server-config-check.mjs --self-test 2>&1 | tail -1 | grep -qx 'SELF-TEST OK (32 cases)' && n2=$(node deploy/server-check.mjs --self-test | sed -n 's/^SELF-TEST OK (\([0-9]*\) cases)$/\1/p') && test "${n2:-0}" -ge 224 && node deploy/server-check.mjs | tail -1 | grep -qx 'SERVER-CHECK OK (23 checks)' && git diff --quiet af34dce -- deploy/server/03-configure-pocketbase.sh deploy/server/04-start-pocketbase.sh deploy/server/00-status.sh && CH="$(git diff --name-only af34dce HEAD -- deploy pb tests tools us-journey-tracker.html)" && [ "$(printf '%s\n' "$CH" | LC_ALL=C sort | tr '\n' ' ')" = "deploy/README.md deploy/build-site.mjs deploy/server-check.mjs deploy/server/restore-drill.sh deploy/verify-site.mjs " ] && test -z "$(git status --porcelain -- deploy pb tests tools us-journey-tracker.html)" && test -z "$(ls -d test-results/lwq-* 2>/dev/null)"</automated>
  </verify>
  <done>The post-change bundle differs from the pre-change bundle only in server/restore-drill.sh and its SHA256SUMS line; BUILD_VERSION 0ba1339903f1 unchanged; all deploy tool self-tests and the real server-check pass; exactly the five planned files changed since af34dce; throwaway directories deleted; SUMMARY written with the side-effect statement.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo templates → live server | 03/04/00-status and the bundle are what the owner approves and runs on the server; a silent gap or an unapproved byte change reaches production |
| live database → drill copy and R2 drill backup | in real-data mode real user data crosses into the drill directory and a short-lived R2 object |
| drill output → owner's terminal and planning docs | anything printed may be pasted into chats and documents |
| working tree → public GitHub repo | anything staged can be published and never recalled |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q261117-01 | Tampering | migration list in bundle and server scripts (WR-04) | high | mitigate | Task 1: build-site enumerates both directories; C-23 fails on any mismatch with 03, 04, 00-status, README; probe-migration run proves the bundle follows and C-23 fires |
| T-Q261117-02 | Tampering | 03/04/00-status on the live server (D-02) | high | mitigate | not in files_modified; `git diff --quiet af34dce` gate in every task and in the final sweep |
| T-Q261117-03 | Elevation / Tampering | restore-drill argument parsing | medium | mitigate | exactly one accepted argument; refusal before the time window, guard read and any mutation; C-22 rules (a)-(e) and mutations; local smoke run proves the refusal output and exit code |
| T-Q261117-04 | Tampering | real-data guard bypass when the live DB is unreadable | high | mitigate | real-data-present only when the guard printed two counts (`=~ ^[0-9]+\ [0-9]+$`); ERR still refuses; C-22 rule (g) and its mutation |
| T-Q261117-05 | Information disclosure | drill output in real-data mode | high | mitigate | output keys stay DRILL_-prefixed with counts or ok-style values; C-22 prefix rule unchanged; no emails, tokens or document content printed; README keeps the redact step |
| T-Q261117-06 | Information disclosure | real-data copy in the drill directory | medium | mitigate | existing 0700 pocketbase-owned drill directory, EXIT-trap deletion and RuntimeMaxSec unchanged and still checked by C-22 |
| T-Q261117-07 | Information disclosure | short-lived drill_ backup in R2 with real data | low | accept | R2 already stores real-data automatic backups under the same token; the drill deletes it immediately and tells the owner to delete it by hand if that fails; documented in header and README |
| T-Q261117-08 | Information disclosure | commits to the public repo | high | mitigate | explicit staging of the planned files only; privacy pre-commit hook never bypassed; private/ never read; no addresses, domains, keys or real data written |
| T-Q261117-09 | Denial of service | real-data drill overlapping the 19:00 UTC backup or a running site | low | mitigate | existing 18:40-19:20 UTC window and read-only live access unchanged; owner confirms each run on the spot (README) |
| T-Q261117-SC | Tampering | npm/pip/cargo installs | high | accept | no package installs or downloads in this task |
</threat_model>

<verification>
Task 3's verify command is the overall check. In addition, confirm by eye in the SUMMARY: `git log --oneline af34dce..HEAD` shows exactly the two task commits (plus any planning-doc commit the orchestrator makes), each ending with the Co-Authored-By line; `git status --short` shows no staged file and no change outside the pre-existing untracked planning files listed at the start of the session.
</verification>

<success_criteria>
- D-01: bundle migrations come from the two directories; BUNDLE_COUNT derived; C-23 guards 03, 04, 00-status, verify-site, server-config-check, build-site and README; SERVER-CHECK OK (23 checks).
- D-02: 03, 04, 00-status byte-for-byte unchanged since af34dce.
- D-03: restore-drill test-only behaviour unchanged with DRILL_MODE=test-only; --with-real-data is the only accepted argument; refusal rules, guard values, skipped restored-test-only check and DRILL_-only output as specified; C-22 enforces them.
- D-04: README documents both modes, when to use each, owner confirmation, the time window, Phase 16 installation and the WR-03 caveat.
- Side effect proven: only server/restore-drill.sh and its SHA256SUMS line differ between the pre-change and post-change bundles; BUILD_VERSION 0ba1339903f1 unchanged.
- Self-tests: build-site at least 33, verify-site 54, server-config-check 32, server-check at least 224.
</success_criteria>

<output>
Create `.planning/quick/261117-lwq-13-review-wr-04-in-01/261117-lwq-SUMMARY.md` when done
</output>
