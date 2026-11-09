---
phase: quick-261109-inq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements: [QUICK-261109-inq]

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "D-01: the browser tab title, the login card heading #login-title and the page header h1 all read 计划手记"
    - "D-01: exports download as 计划手记-日历.csv, 计划手记-备份-<date>.json, 计划手记-留底-<date>.json and 计划手记-计划留底-<date>.json"
    - "D-02: the header label reads 开始日期; the counter reads 先设置开始日期 with no start date, 第 N 天 on or after it and 还有 N 天开始 before it; the week title reads 第 N 周 and the calendar day panel subtitle reads 第 N 天"
    - "D-03: state.arrival, every localStorage / PocketBase key, the file name us-journey-tracker.html, the subtitle and all CSS are unchanged, and an old JSON backup with an arrival field still imports and fills the start-date input"
    - "D-04: git ignores and privacy-check rule A blocks both the old 在美国的日子-*.json/csv and the new 计划手记-*.json/csv export names; the checker self-test and the SAFE-03 spec prove both"
    - "D-05: the synthetic malformed-import names look like neither the old nor the new app export names"
    - "Full default suite (at least 176 expected) and full cloud suite (at least 114 expected) pass with 0 unexpected and 0 flaky, run one after the other at below-normal priority with one worker"
  artifacts:
    - path: "us-journey-tracker.html"
      provides: "new display name, neutral wording and new export filenames"
      contains: "计划手记-日历.csv"
    - path: "tools/privacy/privacy-check.mjs"
      provides: "rule A blocks both export prefixes; self-test covers both"
      contains: "计划手记-"
    - path: ".gitignore"
      provides: "ignores both export prefixes"
      contains: "计划手记-*.csv"
    - path: "tests/support/strings.ts"
      provides: "verbatim copies of the new app strings"
      contains: "FILENAME_CSV = '计划手记-日历.csv'"
    - path: "tests/support/constants.ts"
      provides: "APP_SHA256 baseline of the edited app"
    - path: "tests/e2e/week/week-view.spec.ts"
      provides: "header case covering title, h1, login heading, label and the three counter states"
      contains: "the header shows the app name, the start-date label and a neutral day counter"
  key_links:
    - from: "tests/support/strings.ts"
      to: "us-journey-tracker.html"
      via: "verbatim copies of filename, title prefix and day prefix literals"
      pattern: "计划手记"
    - from: "tests/support/constants.ts APP_SHA256"
      to: "us-journey-tracker.html bytes"
      via: "SAFE-02 sha256 baseline, updated in the same commit as the app"
      pattern: "APP_SHA256"
    - from: ".gitignore"
      to: "tools/privacy/privacy-check.mjs checkPath and PRIVACY.md section 2 table"
      via: "same export-name pattern set (old and new) on all three guard layers"
      pattern: "计划手记-"
---

<objective>
Rename the app's display name to 计划手记 and replace the US-specific wording in the page with neutral wording, without changing features, positions, data fields, keys or layout. The privacy guard learns the new export filenames first, so there is never a commit where the app emits a filename the guard does not block.

Decision IDs (the owner's chat decisions 1-5, locked, do not revisit): D-01 new display name in title, login heading, header h1 and the four export filename prefixes; D-02 neutral wording; D-03 unchanged items and old backups still import; D-04 privacy guard keeps the old patterns and adds the new ones; D-05 tests follow the new strings and the synthetic-name protection covers the new prefix.

Purpose: the app is no longer tied to one country, and real-data exports under the new name can never reach the public GitHub repo.
Output: edited app, guard files, test strings, APP_SHA256 baseline, one new header test case.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@PRIVACY.md
@package.json

Grounded facts (measured at HEAD 2da28ea while planning):
- Lines of us-journey-tracker.html that hold the old name or US wording, exactly 12: 6, 289, 315, 317, 319, 957, 1152, 1153, 1159, 1204, 1358, 1360. No other line in the app has this wording (aria-labels, toasts and titles were checked).
- us-journey-tracker.html is LF only (0 CR bytes; .gitattributes pins eol=lf). Current sha256 c4f37e1bed5ea737a639a4ecf2197eb2e8a7f654e993a51df6b3c6251899005f equals APP_SHA256 in tests/support/constants.ts line 38.
- `node tools/privacy/privacy-check.mjs --self-test` prints `自检通过：193 项` at HEAD.
- `git check-ignore` does not ignore 计划手记-日历.csv or 计划手记-留底-2026-03-18.json at HEAD; it does ignore 在美国的日子-日历.csv.
- Baseline suite sizes from 09-VERIFICATION at HEAD: default `npm test` 175 passed, `npm run test:cloud` 114 passed.
- No test asserts the header label, the header counter, the document title or the login heading today; the week title, day-panel subtitle and export filenames are asserted through constants in tests/support/strings.ts (consumers: tests/e2e/week/week-view.spec.ts, tests/support/expect-from-fixture.ts, tests/e2e/io/export.spec.ts, tests/e2e/storage/account-mode.spec.ts, tests/cloud/conflict-snapshot.spec.ts).
- The proven test command shape (09-14) is the node wrapper that sets PRIORITY_BELOW_NORMAL and spawns `npm test -- --workers=1 <paths>` with PW_JSON_REPORT, followed by `node tools/test-report/check-report.mjs <report> [--min-expected N] [titles...]`.

Machine and repo rules for the executor:
- Tests at below-normal priority, one worker, never two test runs at once. No `npx` other than `npx --no playwright`. No downloads, no new dependencies.
- Stage explicit paths only. Never stage `.planning/milestones/**`, `.planning/state.json`, `.impeccable/` or the unrelated modified `.planning/phases/09-login-cloud-storage/09-UAT.md`. Never `--no-verify`. Do not push.
- Each commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; the author email is the GitHub noreply address already configured.
- `.planning/**` and `.claude/CLAUDE.md` keep the historical project name; do not edit them for this task.
</context>

<!-- planner-discipline-allow: 美国 -->
<!-- planner-discipline-allow: 抵达 -->
<!-- planner-discipline-allow: 出发 -->

<tasks>

<task type="tracer">
  <name>Task 1: Guard first — the new export names are ignored and blocked on every guard layer, the old names stay blocked</name>
  <files>.gitignore, tools/privacy/privacy-check.mjs, PRIVACY.md, tests/e2e/platform/repo-hygiene.spec.ts, tests/e2e/data/synthetic-data.spec.ts</files>
  <read_first>
    - .gitignore lines 1-12 (the backup and export block)
    - tools/privacy/privacy-check.mjs lines 64-91 (checkPath, rule A) and lines 766-781 (self-test pathPos / pathNeg lists)
    - PRIVACY.md line 17 (section 2 table row for exports)
    - tests/e2e/platform/repo-hygiene.spec.ts lines 55-78 (SAFE-03 mustBeIgnored list and its control list)
    - tests/e2e/data/synthetic-data.spec.ts lines 209-222 (DATA-02 malformed name checks)
  </read_first>
  <action>
Why this is the tracer: the one path this task proves end to end is "a file named the way the renamed app will name its exports can never reach the public repo". It crosses every guard layer the task touches (.gitignore, the pre-commit checker's rule A, the checker self-test, the SAFE-03 regression spec, the PRIVACY.md table), and it lands before Task 2 makes the app emit those names. Per D-04, keep every old rule; only add.

1. .gitignore: directly under the two existing old-name export lines (lines 9-10), add `计划手记-*.json` and `计划手记-*.csv`, in that order, with one short comment line above them saying these are the export names after the app rename and that the old-name lines stay because old exports remain on the owner's machine. Do not add a leading slash (the old patterns match at any depth; the new ones must too). The new backup name also matches the existing `*备份*.json` line; keep both, that is fine.

2. tools/privacy/privacy-check.mjs, rule A (per D-04): replace the single old-prefix condition at line 77 with a module-level constant `EXPORT_PREFIXES` holding the old prefix and `计划手记-` (both with the trailing hyphen), placed next to DB_EXT_RE / ARCHIVE_EXT_RE, and a condition in checkPath that returns the same message as today ('应用导出文件含真实数据，不能进入仓库') when the base name starts with any prefix in EXPORT_PREFIXES and ends with .json or .csv. Keep the condition at the same position in checkPath (after the 备份 rule, before the private rule). One short comment on the constant: old-name exports still exist on the owner's machine, so both prefixes are blocked.
   Self-test (same file, pathPos list around line 771): add exactly five positives: `计划手记-日历.csv`, `计划手记-留底-2026-03-18.json`, `计划手记-计划留底-2026-03-18.json`, `sub/计划手记-x.json`, and the old-name snapshot `在美国的日子-留底-2026-03-18.json`. Keep the existing old-name `在美国的日子-x.csv` positive. Add exactly one negative to pathNeg: `docs/计划手记-说明.md` (proves the rule is limited to .json/.csv). The self-test total must go from 193 to 199.

3. PRIVACY.md line 17: rewrite the row so it lists the app exports under both names, new first, for example: 真实备份 `*备份*.json`，以及应用导出的 `计划手记-*.json`、`计划手记-*.csv` 和改名前的 `在美国的日子-*.json`、`在美国的日子-*.csv`. Keep the reason column 含真实数据. No other PRIVACY.md change.

4. tests/e2e/platform/repo-hygiene.spec.ts, test 'SAFE-03 .gitignore ignores test artifacts and backup-style JSON': add to mustBeIgnored, next to the two existing old-name entries, the four new names `计划手记-备份-2026-03-18.json`, `计划手记-日历.csv`, `计划手记-留底-2026-03-18.json`, `计划手记-计划留底-2026-03-18.json`, plus the old snapshot names `在美国的日子-留底-2026-03-18.json` and `在美国的日子-计划留底-2026-03-18.json`. Keep the two existing old-name entries. Add `docs/计划手记-说明.md` to the control list of paths that must NOT be ignored (proves the new patterns are not over-broad). Do not change the test title.

5. tests/e2e/data/synthetic-data.spec.ts, test 'DATA-02 malformed import payloads stay in memory, carry the synthetic marker and are really malformed' (per D-05): what the old-prefix check protects is that a synthetic malformed-import file name never looks like a real app export (so it cannot be mistaken for, or masked by the ignore rules of, real data). Keep the old-prefix startsWith check and add the same `startsWith('计划手记-')` check right after it, both expecting false. Update the comment above them to say the names look like neither a backup nor an app export under the old or the new app name.

Write nothing to disk that looks like a real export; `git check-ignore` works on paths that do not exist.
  </action>
  <verify>
    <automated>st="$(node tools/privacy/privacy-check.mjs --self-test)" && n="$(printf '%s\n' "$st" | sed -n 's/^自检通过：\([0-9]*\) 项$/\1/p')" && test "$n" -ge 199 && ig="$(git check-ignore 计划手记-日历.csv 计划手记-备份-2026-03-18.json 计划手记-留底-2026-03-18.json 计划手记-计划留底-2026-03-18.json 在美国的日子-日历.csv 在美国的日子-留底-2026-03-18.json)" && test "$(printf '%s\n' "$ig" | wc -l)" -eq 6 && ! git check-ignore -q docs/计划手记-说明.md && test "$(grep -cF '计划手记-*.json' PRIVACY.md)" -ge 1 && test "$(grep -cF '在美国的日子-*.json' PRIVACY.md)" -ge 1 && rm -f test-results/261109-inq-t1.json && PW_JSON_REPORT=test-results/261109-inq-t1.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/e2e/platform/repo-hygiene.spec.ts tests/e2e/data/synthetic-data.spec.ts && node tools/test-report/check-report.mjs test-results/261109-inq-t1.json "SAFE-03 .gitignore ignores test artifacts and backup-style JSON" "DATA-02 malformed import payloads stay in memory, carry the synthetic marker and are really malformed" && node tools/privacy/privacy-check.mjs --all</automated>
    <fails_when>self-test below 199 or failing; any of the six export names not ignored; the .md control ignored; PRIVACY.md missing either name; SAFE-03 or DATA-02 failing or flaky; full privacy check reports a finding</fails_when>
  </verify>
  <done>Self-test prints 自检通过：199 项; git ignores all four new and both checked old export names but not docs/计划手记-说明.md; SAFE-03 and DATA-02 pass with 0 flaky; `--all` privacy check passes. Committed as one commit (suggested subject: `chore(privacy): block 计划手记 export files alongside the old export names`), staging exactly the five files of this task; the pre-commit privacy check passes without bypass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The app shows 计划手记 with neutral wording and exports under the new names; test strings, baseline and a header case follow</name>
  <files>us-journey-tracker.html, tests/support/strings.ts, tests/support/constants.ts, tests/e2e/week/week-view.spec.ts, tests/support/expect-from-fixture.ts, tests/e2e/calendar/day-panel.spec.ts</files>
  <read_first>
    - us-journey-tracker.html lines 1-8, 286-322, 950-960, 1148-1162, 1200-1206, 1355-1361 (every line listed in the context block; read nothing else of the app)
    - tests/support/strings.ts lines 26-34, 88-100, 176-184, 300-306
    - tests/support/constants.ts lines 36-38 (APP_SHA256)
    - tests/e2e/week/week-view.spec.ts lines 1-45 (imports) and 118-192 (openWeek helper and the WEEK-01 title case)
    - tests/cloud/reconcile-gate.spec.ts lines 190-200 (the pattern for setting #arrival and dispatching change)
    - tests/support/expect-from-fixture.ts lines 249 and 414 (comments only)
    - tests/e2e/calendar/day-panel.spec.ts line 84 (comment only)
  </read_first>
  <behavior>
    - Header case, start date = today (2026-03-18 frozen): document title, header h1 and #login-title read 计划手记; label.arrival reads 开始日期 and contains #arrival; #counter .lbl texts are [第, 天] and #counter .n is 1
    - Header case, start date 2026-03-25 (after today): #counter .lbl texts are [还有, 天开始] and #counter .n is 7
    - Header case, start date cleared: #counter reads 先设置开始日期 and has no .n element
    - Header case: neither header.top nor #login text contains 美国, 抵达 or 出发
    - Existing WEEK-01 arrival-week title, CAL-03 day-panel subtitle, IO-02 CSV name, IO-03 / MOCK-04 backup name and SYNC-05 snapshot name cases pass with the new constants
    - SAFE-02 passes with the new APP_SHA256; IO-04 import of a backup with an arrival field still fills #arrival
  </behavior>
  <action>
RED first: in tests/support/strings.ts add the new constants and change the existing ones (below), add the header case to tests/e2e/week/week-view.spec.ts, run it and see it fail against the unedited app. Then GREEN: edit the app and the baseline. Do not write the old wording into any new or edited comment anywhere (comments must quote the new UI text).

A. tests/support/strings.ts (per D-05; every value is a verbatim copy of the app literal):
   - FILENAME_CSV (line 30) becomes '计划手记-日历.csv'; FILENAME_BACKUP_FROZEN (line 33) becomes '计划手记-备份-2026-03-18.json'; FILENAME_SNAPSHOT_FROZEN (line 304) becomes '计划手记-留底-2026-03-18.json'.
   - WEEK_TITLE_ARRIVAL_PREFIX (line 92) and DAY_SUB_ARRIVAL_PREFIX (line 180) both become '第 ' (with the trailing space); the suffix constants stay. Rewrite their comments (lines 91 and 179) so they quote the new wording 第 N 周 / 第 N 天 and call the date 开始日期 (state.arrival).
   - Add, near the top with the other app-wide strings: APP_NAME = '计划手记' (document title, login heading and header h1), START_DATE_LABEL = '开始日期', COUNTER_UNSET = '先设置开始日期', COUNTER_DAY_PREFIX = '第', COUNTER_DAY_SUFFIX = '天', COUNTER_BEFORE_PREFIX = '还有', COUNTER_BEFORE_SUFFIX = '天开始', each with a one-line comment in the file's existing style (应用源码逐字复制).

B. tests/e2e/week/week-view.spec.ts: add one test right after the existing 'WEEK-01 the title reads the arrival week, ...' case, titled exactly 'WEEK-01 the header shows the app name, the start-date label and a neutral day counter'. Open with the file's openWeek helper and the full-state fixture with arrival set to FROZEN_TODAY. Assert: expect(page).toHaveTitle(APP_NAME); page.locator('header.top h1') toHaveText(APP_NAME); page.locator('#login-title') toHaveText(APP_NAME) (the login card is hidden in account mode; toHaveText reads text content and does not need visibility); page.locator('label.arrival') toHaveText(START_DATE_LABEL) and page.locator('label.arrival #arrival') toHaveCount(1); page.locator('#counter .lbl') toHaveText([COUNTER_DAY_PREFIX, COUNTER_DAY_SUFFIX]) and page.locator('#counter .n') toHaveText('1'). Then set #arrival to '2026-03-25' using the reconcile-gate.spec.ts pattern (evaluate: assign value, dispatch a bubbling change event) and assert .lbl is [COUNTER_BEFORE_PREFIX, COUNTER_BEFORE_SUFFIX] and .n is '7'. Then set #arrival to '' the same way and assert #counter toHaveText(COUNTER_UNSET) and #counter .n toHaveCount(0). Finally read textContent of header.top and of #login and expect neither to match the regex of the three old words (country name, arrive, depart) listed in the behavior block. Import the new constants from ../../support/strings. Do not touch the fixture file: tests/fixtures/full-state.json holds a synthetic log text containing the old arrive word, which is user data, not UI wording, and the header region does not render it.

C. us-journey-tracker.html (per D-01, D-02, D-03; change only the 12 lines listed in the context block, keep every expression, id, class and the LF line endings):
   - line 6 title text, line 289 #login-title text, line 315 header h1 text: 计划手记.
   - line 317: the label's text before the input becomes 开始日期 (keep the trailing space, class arrival and the input unchanged).
   - lines 319 and 1153: the counter placeholder span text becomes 先设置开始日期.
   - line 1152: in the days>0 branch the first .lbl span text becomes 第 (the .n and the trailing 天 span unchanged); in the else branch the trailing .lbl span text becomes 天开始 (还有 and .n unchanged).
   - line 1159: the week title template's text before the interpolation becomes `第 ` so the result reads 第 N 周 (the computation unchanged).
   - line 1204: the day-panel template's text before the interpolation becomes `第 ` so the result reads 第 N 天 (the computation and the year branch unchanged).
   - line 957: the two snapshot prefixes become 计划手记-计划留底- and 计划手记-留底-.
   - line 1358: the CSV name becomes 计划手记-日历.csv. line 1360: the JSON backup prefix becomes 计划手记-备份-.
   - Do NOT change: state.arrival or any arrival id/class, the storage key us-journey-tracker-v1, any PocketBase collection or usj:v2 cache key, the subtitle 语言、专业、健身、求职，每天记一点, any CSS, normalize/import logic (old backups keep importing because the arrival field name is unchanged).
   - After editing, check the whole file once more for the three old words; per the owner, anything ambiguous is reported in the SUMMARY instead of guessed (at planning time there was nothing beyond the 12 lines).

D. tests/support/constants.ts line 38: set APP_SHA256 to the sha256 of the edited app file (`sha256sum us-journey-tracker.html`), in the same commit as the app (SAFE-02 rule).

E. Comment-only updates that quote the old UI wording: tests/support/expect-from-fixture.ts lines 249 and 414 and tests/e2e/calendar/day-panel.spec.ts line 84 now quote 第 N 周 / 第 N 天 (and 第 1 天 for the start day). Comments that merely use the old arrive word as the name of the arrival data field (reconcile-gate, grid, synthetic-data, import, state-validation, week-view, constants.ts, KNOWN-BUGS.md) stay as they are; list them in the SUMMARY as intentionally unchanged. English test titles that say "arrival" stay.

Run the verify block before committing: its diff gate reads the uncommitted change of the app against the Task 1 commit. Then commit as one commit (suggested subject: `feat(app): rename the app to 计划手记 and use neutral start-date wording`), staging exactly the six files of this task. The pre-commit privacy check runs with the app file staged; it needs the local seed (present at planning time). If it reports any finding (for example a rule D plan term matching new text), stop and report the rule and number only; do not bypass and do not edit the seed or denylist.
  </action>
  <verify>
    <automated>node -e 'const s=require("fs").readFileSync("us-journey-tracker.html","utf8");const c=(t)=>s.split(t).length-1;const want=[["计划手记",7],["id=\"login-title\">计划手记",1],["class=\"arrival\">开始日期 ",1],[">先设置开始日期",2],["class=\"lbl\">第",1],["class=\"lbl\">天开始",1],["`第 ${Math.round(",2],["\"计划手记-计划留底-\":\"计划手记-留底-\"",1],["save(\"计划手记-日历.csv\"",1],["save(\"计划手记-备份-\"+today()+\".json\"",1],["state.arrival",11],["语言、专业、健身、求职，每天记一点",1],["us-journey-tracker-v1",1]];const bad=want.filter(([t,n])=>c(t)!==n).map(([t,n])=>t+" want "+n+" got "+c(t));if(/美国|抵达|出发/.test(s))bad.push("old wording present");if(s.includes("\r"))bad.push("CR present");if(bad.length){console.error("SOURCE GATE FAIL\n"+bad.join("\n"));process.exit(1)}console.log("SOURCE GATE OK")' && d="$(git diff -U0 --no-color -- us-journey-tracker.html)" && printf '%s\n' "$d" | node -e 'const d=require("fs").readFileSync(0,"utf8");const want=[6,289,315,317,319,957,1152,1153,1159,1204,1358,1360];const got=[];let ok=true;for(const m of d.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)){const a=+m[1],b=m[2]===undefined?1:+m[2],c=m[4]===undefined?1:+m[4];if(b!==c)ok=false;for(let i=0;i<b;i++)got.push(a+i)}if(!ok||got.join()!==want.join()){console.error("DIFF GATE FAIL old lines "+got.join());process.exit(1)}console.log("DIFF GATE OK")' && ! grep -rqF '来美国' tests && f="$(grep -rlF '在美国的日子' tests)" && test "$(printf '%s\n' "$f" | sort | tr '\n' ' ')" = "tests/e2e/data/synthetic-data.spec.ts tests/e2e/platform/repo-hygiene.spec.ts " && rm -f test-results/261109-inq-t2.json && PW_JSON_REPORT=test-results/261109-inq-t2.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/e2e/platform/app-integrity.spec.ts tests/e2e/week/week-view.spec.ts tests/e2e/calendar/day-panel.spec.ts tests/e2e/io/export.spec.ts tests/e2e/io/import.spec.ts tests/e2e/storage/account-mode.spec.ts tests/e2e/smoke.spec.ts && node tools/test-report/check-report.mjs test-results/261109-inq-t2.json "SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline" "WEEK-01 the header shows the app name, the start-date label and a neutral day counter" "WEEK-01 the title reads the arrival week, the current week or a generic label depending on the arrival date" "CAL-03 a day without entries shows the empty hint and days before and on arrival show the year or day one" "IO-02 the calendar CSV export matches the spec-derived expectation byte for byte" "IO-03 the JSON backup of the full fixture equals the fixture without _synthetic and the seeded document" "IO-04 accepting the import confirm replaces all data with the backup" "MOCK-04 account mode shows both export buttons and records what downloads.save receives" && rm -f test-results/261109-inq-t2c.json && PW_JSON_REPORT=test-results/261109-inq-t2c.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['run','test:cloud','--',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/cloud/conflict-snapshot.spec.ts && node tools/test-report/check-report.mjs test-results/261109-inq-t2c.json "SYNC-05 downloading the kept version saves a state-shaped JSON file without any account identifier and removes it from this device" && node tools/privacy/privacy-check.mjs --all</automated>
    <fails_when>any source gate count differs (baseline at HEAD: 0 occurrences of 计划手记, 12 lines with the old wording, 11 state.arrival, 0 CR); the app diff touches other than the 12 listed lines; a test file still quotes the old week/day prefix or the old app name outside the two guard specs; any listed e2e or cloud case fails, is filtered out or is flaky; the privacy check reports a finding</fails_when>
  </verify>
  <done>The app shows 计划手记 in the tab title, login card and header; the header reads 开始日期 and the counter, week title and day panel use 第 N 天 / 还有 N 天开始 / 第 N 周 / 第 N 天; exports use the four new names; APP_SHA256 matches; the new header case and the listed existing cases pass with 0 flaky; one commit with exactly the six files of this task, privacy check passing.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| owner's working tree → public GitHub repo | real-data exports may sit in the repo folder; anything staged can be published and never recalled |
| app source → owner's real data | the rename must not change field names or keys, or the owner's existing data and backups stop loading |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-Q261109-01 | Information disclosure | .gitignore, privacy-check rule A, new 计划手记-* exports | high | mitigate | Task 1 adds both new patterns to .gitignore and EXPORT_PREFIXES to checkPath before Task 2 makes the app emit them; self-test positives and SAFE-03 entries prove it |
| T-Q261109-02 | Information disclosure | old-name exports still on the owner's disk | high | mitigate | old .gitignore lines and the old prefix stay (D-04); self-test keeps the old positive and adds the old snapshot name; SAFE-03 keeps and adds old names |
| T-Q261109-03 | Information disclosure | new app text vs. private plan terms (rule D) | low | mitigate | the pre-commit privacy check runs with the app staged and the local seed; any finding stops the commit and is reported by rule and number only, never bypassed |
| T-Q261109-04 | Tampering | SAFE-02 baseline / line endings | low | mitigate | APP_SHA256 updated in the same commit; source gate asserts 0 CR bytes; diff gate limits the app change to the 12 listed lines |
| T-Q261109-05 | Denial of service (data) | state.arrival, storage and cache keys, import path | medium | mitigate | D-03 forbids changing them; source gate counts state.arrival (11) and us-journey-tracker-v1 (1); IO-04 import case and full suites run |
| T-Q261109-SC | Tampering | npm/pip/cargo installs | high | accept | no package installs or downloads in this task |
</threat_model>

<verification>
After both task commits, run the two full suites one after the other (never at the same time), each at below-normal priority with one worker. Do not lower a gate: if a count gate fails only on --min-expected, report the actual numbers.

1. Default suite (baseline 175 at HEAD plus the one new header case):
   rm -f test-results/261109-inq-full.json && PW_JSON_REPORT=test-results/261109-inq-full.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1'],{stdio:'inherit',shell:true});process.exit(r.status??1)" && node tools/test-report/check-report.mjs test-results/261109-inq-full.json --min-expected 176
2. Cloud suite (baseline 114 at HEAD), only after step 1 finished:
   rm -f test-results/261109-inq-cloud.json && PW_JSON_REPORT=test-results/261109-inq-cloud.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['run','test:cloud'],{stdio:'inherit',shell:true});process.exit(r.status??1)" && node tools/test-report/check-report.mjs test-results/261109-inq-cloud.json --min-expected 114
3. node tools/privacy/privacy-check.mjs --all passes; `git status --short` shows no staged or committed file outside the eleven files of this plan (the pre-existing untracked and modified planning files stay untouched).
</verification>

<success_criteria>
- D-01: tab title, login heading, header h1 and the four export filenames use 计划手记.
- D-02: no 美国 / 抵达 / 出发 text left in us-journey-tracker.html; label, counter, week title and day panel use the neutral wording.
- D-03: data field, keys, file name, subtitle and CSS unchanged; old backups import (IO-04).
- D-04: old and new export names ignored and blocked; self-test 199; SAFE-03 proves both.
- D-05: test strings follow the app; DATA-02 rejects both prefixes; new header case passes.
- Full default suite at least 176 expected and full cloud suite at least 114 expected, 0 unexpected, 0 flaky; two commits, nothing pushed.
- SUMMARY lists the intentionally unchanged items: data-field comments in tests, the synthetic fixture log text, English test titles, the `.arrival` class and `#arrival` id, the probe tool's carrier name (tools/probe, not part of the app), and planning docs.
</success_criteria>

<output>
Create `.planning/quick/261109-inq-rename-app-title-and-neutral-wording/261109-inq-SUMMARY.md` when done
</output>
