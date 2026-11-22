---
phase: quick-261121-uax
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - us-journey-tracker.html
  - tests/support/constants.ts
  - tests/support/fitness.ts
  - tests/support/strings.ts
  - tests/e2e/fitness/units.spec.ts
  - tests/cloud/fitness-sync.spec.ts
  - tests/README.md
autonomous: true
requirements: [QUICK-261121-uax]

estimate:
  tokens: 160000
  raw_tokens: 160000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "[设置范围] The fitness tab has a kg | lb switch (two .seg buttons with aria-pressed, keyboard usable); choosing a unit writes state.wu = 'kg' or 'lb' through commit(['wu'], ...), so it is saved and synced with the account data like every other field"
    - "[设置范围] normalize keeps wu only when it is exactly 'kg' or 'lb' and leaves the key out otherwise; a state without wu (old data, old Artifact backup, old page) reads as kg; LEGACY_KEYS and backup recognition are unchanged"
    - "[显示方式] Lift goal cards, the log form target and column header, the last-time line, the training history and the charts show weights in the chosen unit; cards, form target and history add the other unit in small grey text (.wu-alt, at most one decimal, no trailing .0); charts show the chosen unit only"
    - "[记录单位] With lb chosen, typing 135 for a kg lift stores 61.23 in state.workouts (format unchanged) and reopening the day shows 135 again; switching units with an unsaved draft converts the typed weights and keeps them unsaved"
    - "[记录单位] Reopening a saved day and saving it again never changes any stored weight; every lb value with up to one decimal and every kg value with up to two decimals reads back exactly as typed"
    - "[Discretion] Lifts whose unit is not a weight unit (for example 次) and the chart reps mode are unchanged in both modes; a lift whose own unit is lb converts the other way when kg is chosen"
    - "[设置范围] A JSON backup carries wu; importing it replaces wu with the rest of the state; importing an old backup or a backup with an invalid wu leaves kg"
    - "The default suite passes with at least 247 tests (239 before plus 8 new), the two cloud fitness specs pass including the new two-device case, and APP_SHA256 matches the edited app file"
  artifacts:
    - path: "us-journey-tracker.html"
      provides: "wuKind, wuConv, wuShow, wuOf, wuMain, wuLbl, wuAlt, wuIn pure helpers; normalize keeps wu; static kg | lb switch in #tab-fit; draft unit fl.u with flReunit; converted displays"
      contains: "const wuKind="
    - path: "tests/e2e/fitness/units.spec.ts"
      provides: "8 FIT-UNIT default-suite tests (pure helpers, normalize and backups, switch and cards, round-trip property, lb entry, reps and lb lifts, narrow 375 px, export and import)"
      contains: "FIT-UNIT"
    - path: "tests/cloud/fitness-sync.spec.ts"
      provides: "FIT-UNIT two-device case: the unit switch reaches the other device without a reload and converts its unsaved draft"
      contains: "FIT-UNIT the weight unit chosen on one device"
    - path: "tests/support/constants.ts"
      provides: "APP_SHA256 re-recorded for the edited app"
      contains: "APP_SHA256"
  key_links:
    - from: "[data-wu] click handler"
      to: "state.wu"
      via: "commit(['wu'], s => { s.wu = v }) then renderAll()"
      pattern: "commit\\(\\[\"wu\"\\]"
    - from: "normalize"
      to: "state.wu"
      via: "spread that keeps wu only for 'kg' or 'lb'"
      pattern: "s\\.wu===\"kg\"\\|\\|s\\.wu===\"lb\""
    - from: "flSave / flErrs / flHint"
      to: "woFromDraft / workoutProblems"
      via: "optional converter argument flCv() from the draft unit fl.u to the lift unit"
      pattern: "flCv\\(\\)"
    - from: "renderFit"
      to: "flReunit"
      via: "fl.u differs from wuOf(state) after a local or remote unit change"
      pattern: "flReunit\\("
---

<objective>
健身页的重量支持 kg 和 lb：健身页上一个 `kg | lb` 开关同时决定记录时输入的单位和显示的单位；显示时所选单位大字、另一种单位灰色小字换算；所选单位存在账号数据里随同步走。`state.workouts` 的格式不变，已有数据一条不改。

Purpose: 所有者在美国的健身房常见磅（lb）器械，记录时直接按 lb 填，同时看得到公斤换算；设置跟账号走，手机和电脑一致。
Output: 改过的 `us-journey-tracker.html`（纯函数、state 字段、开关、换算显示、草稿单位）、重新记录的 `APP_SHA256`、新的 `tests/e2e/fitness/units.spec.ts`（8 条）、一条 cloud 用例、测试 helper 和 README 的小改动。

Decision map (CONTEXT.md headings, cited in tasks as tags):
- [显示方式] 所选单位大字、灰色小字换算；覆盖记录表单位标注、训练历史、力量目标卡、趋势图；图表放不下小字时只显示所选单位。
- [记录单位] 一个开关管记录和显示；输入按所选单位理解，保存时换算成力量项自己的单位；workouts 格式不变；重开编辑来回换算稳定（135 lb 存了再打开仍是 135）；手填入口同样处理。
- [设置范围] 存在账号 state，只接受 "kg" / "lb"，normalize 保留、非法值丢掉，缺省 kg；导出带上、导入整份替换；LEGACY_KEYS 不受影响；旧页面丢字段的过渡现象写进 SUMMARY。
- [Discretion] 字段名 `wu`（state 顶层字符串，短键名）；1 kg = 2.20462262 lb；显示最多 1 位小数去掉 `.0`；kg / 公斤 按 kg，lb / lbs / 磅 按 lb，其余单位不换算；开关复用 `.seg`；计划编辑器不改；容量（vol）按所选单位换算。

Choices made under [Discretion] (record them in the SUMMARY):
- Field: `state.wu`, top-level string, written by sync key `wu` (same pattern as `commit(["arrival"], ...)`).
- Display rounding: converted values use `wuShow` (at most 1 decimal). A value shown in the lift's own unit keeps today's exact text (so existing kg-mode texts stay byte-identical). This is why 60 kg shows its grey conversion as 132.3 lb (the CONTEXT example 132 was illustrative; the 1-decimal rule decides).
- Input round-trip: the input box shows the shortest decimal (0 to 3 places) in the draft unit that converts back to exactly the stored number (`wuIn`). Verified at planning time by brute force: every one-decimal lb value 0..1000 on a kg lift and every two-decimal kg value 0..453.59 on a lb lift read back exactly; for every stored two-decimal value 0..1000 in either direction, reopen then save stores the same number. Two-decimal lb values typed for a kg lift can read back as a neighbouring two-decimal value that stores the same kg number (0.01 kg storage is coarser than 0.01 lb); accepted, stated in the SUMMARY.
- Charts show the chosen unit only (axis ticks, target label, reading line, data table, aria label), because the reading line is rewritten as plain text on every pointer move and the SVG has no room for grey text.
- The last-time line in the log form shows numbers in the chosen unit without a grey conversion (it is a compact list; the column header names the unit).
- History lift lines get the unit in the name part, for example 卧推（kg）：40 × 8，42.5 × 6, followed by a grey range of the other unit, for example ≈ 88.2～93.7 lb; lines with only bodyweight sets and lifts with a non-weight unit stay exactly as today.
- No live per-row conversion next to each set input (the set row is already full at 375 px).
- There is no hand-entry input for lift values any more (Phase 15 D-15 removed it); the hand-entered history points that still exist in state.lifts are converted wherever they are displayed (card fallback value, chart points).
- The goals tab (archived lift line) and the plan editor keep showing the lift's own unit, per the task boundary.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.claude/CLAUDE.md
@.planning/quick/261121-uax-lb-kg/261121-uax-CONTEXT.md
@tests/README.md

Code map (find by content; line numbers drift):
- Pure section of the app runs from the line starting `const CATS=` to `/* ---------- saving ---------- */`; tests evaluate it with `loadAppPure(names)` from `tests/support/app-source.ts`. New pure helpers go in the workouts block right after `const woR2=` so they are testable.
- `woFromDraft(d)` and `workoutProblems(d)` sit right after `woR2`; `liftNow`, `seriesOf` follow. `normalize(s)` ends with `return {arrival:..., tasks, custom, logs, lifts, reviews, presets, ...(Object.keys(wo).length?{workouts:wo}:{})};`. `LEGACY_KEYS`, `legacyShape`, `classifyBackup`, `backupOf` follow it.
- `commit(keys, fn)` is the only state writer; single-key example: `$("arrival").addEventListener("change", ... commit(["arrival"], s=>{s.arrival=v}); renderAll() ...)`.
- `GATE_ALLOW` lists controls that stay usable during the reconcile gate; anything else under `.wrap` is disabled by `applyGate()`. The new switch is an edit, so it must NOT be added to `GATE_ALLOW`.
- Fitness markup: `<section id="tab-fit">` with `#fl` (log form), `#fw` (week and lift goal cards), `#fc` (charts), `#fh` (history), `#fl-live` (polite live region).
- Fitness CSS: `#tab-fit .seg{gap:8px} #tab-fit .seg button{...min-height:36px}`, pressed style uses `--s`/`--c` from a `.k-fit` ancestor; the narrow media block gives `#tab-fit .seg button` min-height 44px; `.fw-lv small{...}`.
- Fitness JS (section `/* ---------- fitness tab (Phase 15) ---------- */`): `flDraftOf(day)`, `flOpen(date)`, `flKeep()` / `flRestore()` (local draft backup `usj:v2:<id>:wodraft`, cloud only), `flTryRestore()`, `flErrs()`, `flHint()`, `flLastText(l)`, `flExHTML(x,i)` (uses `u=L?L.unit:"kg"` for `T_FL_COL_W(u)`, `T_FL_LBL_W(n,j+1,u)`, `T_FL_TARGET(L.target,u)`), `renderFl()`, `renderFw()` (`.fw-lv` and `.fw-tg`), `fhBody(day)` with `T_FH_LIFT`, `renderFit(force)`, `flSave()`, the `filllast` action that copies `last.sets` with `String(z.w)`.
- Charts (section `/* ---------- fitness charts (Phase 15-03) ---------- */`): `fcUnit(L,mode,m)`, `fcSub(L,mode,m)`, `fcSer(id)` (wraps `seriesOf`), `renderFc()`, the per-figure drawing function that reads `L.target` for `showT`, the target line label `T_FC_TARGET(fcFmt(L.target),L.unit)`, `T_FC_ARIA(...)`, `T_FC_READ(...)`.
- Test helpers: `tests/support/fitness.ts` (`gotoFitness`, `flAddLift`, `flFillSet`, `flSave`, `readFl`, `readLiftGoals`, `readCharts`, `readHistory`, `flError`), `tests/support/app-variant.ts` (`serveAppVariant`; the in-memory plan edit pattern is in `tests/e2e/fitness/charts.spec.ts`: find `function normalizePlan(` and prepend `DEFAULT_PLAN.lifts.push({...});`), `tests/support/import-file.ts`, `tests/support/download.ts`, `tests/support/backup-files.ts`, examples in `tests/e2e/io/import.spec.ts` and `tests/e2e/io/export.spec.ts`; the two-device cloud pattern is the test `FIT-05 a training saved on one device appears on the other device's fitness tab, history and charts without a reload` in `tests/cloud/fitness-sync.spec.ts` (`openDevice`, `syntheticPlan(label, 1)` gives lift `l-<label>1`, unit kg, def 10, target 20).
- Sample plan lifts (local default suite): bench 卧推 kg def 20 target 40; squat kg 25/50; dead kg 50/100; pull 引体 kg 4/12. Factor F = 2.20462262. Worked values: 40 kg shows 88.2 lb; 60 kg shows 132.3 lb; 135 lb stores 61.23 kg and `wuIn(61.23,"kg","lb")` is "135"; `wuIn(20,"kg","lb")` is "44.1"; `wuIn(25,"kg","lb")` is "55.12"; `wuIn(40,"kg","lb")` is "88.18"; 25 kg displays as 55.1 lb; 30 kg displays as 66.1 lb; 10 kg displays as 22 lb; 4 kg displays as 8.8 lb.

Baselines recorded at planning time (HEAD fe02b20): `sha256(us-journey-tracker.html)` = efa9038d…76ba equals `APP_SHA256`; `npx --no playwright test --list` reports `Total: 239 tests in 49 files`; the identifiers `wuKind`, `data-wu`, `wu-alt`, `wconv`, `flReunit` occur 0 times in the app.

Execution rules (from CONTEXT.md 项目约束 and STATE.md):
- Local repo only: no server contact, no upload, no deploy, no `npx` except `npx --no playwright`, nothing downloaded.
- Keep the app file LF-only and free of `style=` attributes (CSP `style-src-attr 'none'`); colours and sizes go through classes.
- Every interpolation of plan or state values into markup goes through `esc(...)` (SEC-01 source gate in `tests/e2e/security/escaping.spec.ts` lists bare tokens such as `L.unit`, `L.target`, `z.w`, `String(v.v)`).
- Run tests only through the BELOW_NORMAL wrapper in the verify commands, one worker, never two runs at once; do not edit `playwright.config.ts`. A full default run takes about 5 minutes: give the Bash call a 600000 ms timeout.
- Each task ends with one commit that lists explicit paths only (`git add -- <paths>`), includes `tests/support/constants.ts` whenever the app changed, passes the hooks (no `--no-verify`), and ends with the line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never stage `.planning/milestones/**`, `.planning/state.json`, `.impeccable/`, `.planning/ui-reviews/`, `private/`, `test-results/`. Committed text contains no local absolute paths, server addresses, domains, keys, real data or personal plan text; tests use `SYNTH-` names or sample-plan ids only and never put lift names into failure messages.
- Write the SUMMARY in segments (no single write over about 120 lines); the quick workflow commits the SUMMARY and STATE, not these task commits.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Tracer — kg | lb switch saved in account state, lift goal cards in the chosen unit</name>
  <files>us-journey-tracker.html, tests/support/constants.ts, tests/support/fitness.ts, tests/support/strings.ts, tests/e2e/fitness/units.spec.ts</files>
  <behavior>
    - FIT-UNIT wuKind, wuConv and wuShow recognise kg and lb unit texts, convert both ways and show at most one decimal: wuKind maps "kg", " KG ", "公斤" to "kg" and "lb", "LBS", "磅" to "lb", and "次", "", "kgs", 5 to null; wuConv(60,"kg","lb") is close to 132.2773572 and wuConv(135,"lb","kg") close to 61.2349; wuConv returns its input when either unit is null or both are equal; wuShow(132.2773572) is "132.3", wuShow(60) is "60"; wuMain(40,"kg","kg") "40", wuMain(40,"kg","lb") "88.2", wuMain(40,"次","lb") "40"; wuLbl("kg","lb") "lb", wuLbl("公斤","kg") "公斤", wuLbl("次","lb") "次", wuLbl("kg",null) "kg"; wuAlt(60,"kg","kg") "≈ 132.3 lb", wuAlt(135,"lb","lb") "≈ 61.2 kg", wuAlt(0,"kg","kg") "", wuAlt(5,"次","kg") ""; wuOf({}) "kg", wuOf({wu:"lb"}) "lb", wuOf({wu:"LB"}) "kg"
    - FIT-UNIT normalize keeps only kg or lb as the weight unit and backup recognition is unchanged: normalize keeps wu "lb" and "kg"; for "LB", 1, null, {} and "<b>" the result has no own wu key; a synthetic state without wu gives a result without a wu key; Object.keys(LEGACY_KEYS) equals [arrival, tasks, lifts, reviews, custom, logs, presets, workouts]; classifyBackup(backupOf(plan, stateWithWuLb, at)) is kind full with state.wu "lb"; a bare legacy object {arrival:"", logs:[], wu:"lb"} is still kind legacy; {wu:"lb"} alone is still null
    - FIT-UNIT the kg and lb switch on the fitness tab is saved with the account data and the lift goal cards show the chosen unit with the other unit in small grey text: seed bench training 2026-03-16 [[40,3]]; kg pressed by default; bench card value "40", unit " kg", target "目标 40 kg", valueAlt and targetAlt "≈ 88.2 lb"; click lb: lb pressed, #fl-live says 重量单位已切换为 lb, app.saved().wu becomes "lb", saved workouts deep-equal the seed; bench card "88.2", " lb", "目标 88.2 lb", alts "≈ 40 kg"; pull card (no training, def 4) "8.8", alt "≈ 4 kg"; focus stays on the clicked switch button; app.reload() keeps lb; clicking kg saves wu "kg" and the card is back to "40"
  </behavior>
  <action>
Write the three tests above first in the new file tests/e2e/fitness/units.spec.ts (exact titles as in behavior, imports in the style of tests/e2e/fitness/goals.spec.ts, header comment in Chinese like the other fitness specs, synthetic data only) and run them red. Then implement:

1. Pure helpers, inserted right after `const woR2=` in the workouts block (pure section), with one short Chinese block comment in the existing style. `WU_LB=2.20462262` (1 kg in lb) [Discretion]. `wuKind(unit)`: non-string gives null; trim and lower-case; "kg" or "公斤" gives "kg"; "lb", "lbs" or "磅" gives "lb"; anything else null [Discretion]. `wuConv(v,from,to)`: returns v unchanged when from or to is falsy or they are equal; kg to lb multiplies by WU_LB, lb to kg divides; no rounding. `wuShow(v)`: String of v rounded to one decimal (Math.round(v*10)/10), which drops a trailing .0 by itself [Discretion]. `wuOf(s)`: "lb" only when s is an object whose wu is exactly "lb", else "kg" [设置范围]. `wuMain(v,unit,u)`: when v is not a finite number return String(v); with k=wuKind(unit), if k and u and k differs from u return wuShow(wuConv(v,k,u)), else String(v) (the lift's own unit keeps today's exact text). `wuLbl(unit,u)`: u when k and u and k differs from u, else unit. `wuAlt(v,unit,u)`: "" when k is null, v is not a finite number or v is 0; otherwise with o = "kg" when u is "lb" else "lb", return "≈ " + wuShow(wuConv(v,k,o)) + " " + o.

2. normalize [设置范围]: append to the returned object a spread that adds wu only when s.wu is exactly "kg" or "lb" (write the condition as s.wu==="kg"||s.wu==="lb"); otherwise the key stays absent, so existing deep-equality tests are unaffected. Do not touch LEGACY_KEYS, legacyShape, importProblem or classifyBackup.

3. Static switch markup [记录单位, Discretion]: inside section#tab-fit, after the sr-only h2 and before section#fl, add a div with classes fit-unit and k-fit containing a span id wu-l class fit-unit-l with text 重量单位 and a div class seg role group aria-labelledby wu-l holding two type=button buttons with data-wu kg and data-wu lb, texts kg and lb, aria-pressed true on kg and false on lb. Static markup keeps keyboard focus on the button across re-renders. Do not add the buttons to GATE_ALLOW (it is an account-data edit and must be disabled during the reconcile gate like the other write controls). CSS next to the existing #tab-fit .seg rules: .fit-unit as a right-aligned wrapping flex row with an 8px gap and 12px bottom margin; .fit-unit-l 14px in var(--muted); .wu-alt in var(--muted), var(--sans), 12px, weight 400, inline-block with a small left margin (no leading space in its text), plus a .fw-lv .wu-alt rule so the card's .fw-lv small rule does not enlarge it. No style attributes.

4. Fitness JS: constant T_WU_LIVE as a function of u returning 重量单位已切换为 followed by a space and u; function renderWu() that sets aria-pressed on the two [data-wu] buttons from wuOf(state), called first thing in renderFit(force). A click listener on the .fit-unit container: the closest [data-wu] button, v its data-wu; ignore anything that is not "kg" or "lb" or equals wuOf(state); otherwise commit(["wu"], s=>{s.wu=v}) (sync key wu, same pattern as arrival) [设置范围], then renderAll(), then write T_WU_LIVE(v) into #fl-live.

5. Lift goal cards in renderFw [显示方式]: with u=wuOf(state), the .fw-lv content becomes esc(wuMain(v.v,L.unit,u)), then the existing small holding a space and esc(wuLbl(L.unit,u)), then the grey alternative; .fw-tg becomes esc(T_FW_TARGET(wuMain(L.target,L.unit,u),wuLbl(L.unit,u))) followed by the grey alternative for L.target. Add a UI helper in the fitness section, wuAltH(v,unit,u), returning a small element with class wu-alt wrapping esc(wuAlt(v,unit,u)) or "" when wuAlt is empty. Keep the unit small before the .wu-alt small so the first small in .fw-lv is still the unit. Progress percentage stays computed in the lift's own unit.

6. tests/support/fitness.ts readLiftGoals: target becomes the .fw-tg text with any .wu-alt descendant excluded (clone the node, remove .wu-alt, read textContent); add valueAlt and targetAlt to LiftGoalRead (textContent of .fw-lv .wu-alt and .fw-tg .wu-alt, "" when missing, null for ids outside the list like the other fields). Existing expected values in goals.spec.ts, stable-ids.spec.ts, synthetic-data.spec.ts, clean-clone.spec.ts and cloud specs stay as they are.

7. tests/support/strings.ts: mirror the new app texts verbatim (WU_LABEL 重量单位, wuLive(u), and a wuAltText(v,u) helper producing "≈ v u") with a comment naming the app constants, in the file's existing style.

8. Re-record APP_SHA256 in tests/support/constants.ts as the sha256 of the edited app file bytes (LF).

9. Run the verify command; when green, commit with explicit paths: us-journey-tracker.html, tests/support/constants.ts, tests/support/fitness.ts, tests/support/strings.ts, tests/e2e/fitness/units.spec.ts. Suggested message: feat(quick-261121-uax): 健身页重量单位开关存进账号数据，力量目标卡按所选单位显示并附换算.
  </action>
  <verify>
    <automated>rm -f test-results/uax-t1.json && PW_JSON_REPORT=test-results/uax-t1.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/e2e/fitness/ tests/e2e/security/escaping.spec.ts tests/e2e/data/stable-ids.spec.ts tests/e2e/data/synthetic-data.spec.ts && node tools/test-report/check-report.mjs test-results/uax-t1.json "FIT-UNIT wuKind, wuConv and wuShow recognise kg and lb unit texts, convert both ways and show at most one decimal" "FIT-UNIT normalize keeps only kg or lb as the weight unit and backup recognition is unchanged" "FIT-UNIT the kg and lb switch on the fitness tab is saved with the account data and the lift goal cards show the chosen unit with the other unit in small grey text" && node -e "const c=require('crypto'),f=require('fs');const h=c.createHash('sha256').update(f.readFileSync('us-journey-tracker.html')).digest('hex');process.exit(f.readFileSync('tests/support/constants.ts','utf8').includes(\"APP_SHA256 = '\"+h+\"'\")?0:1)" && grep -c 'commit(\["wu"\]' us-journey-tracker.html</automated>
  </verify>
  <done>The three Task 1 tests pass together with every existing fitness, escaping, stable-ids and synthetic-data test (REPORT OK); clicking lb on the fitness tab saves state.wu "lb", the lift goal cards show the chosen unit with a grey conversion, kg mode texts read by the existing helpers are unchanged, APP_SHA256 matches the app, and the commit contains only the five listed paths.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Log form input in the chosen unit with stable round-trip, history and charts converted</name>
  <files>us-journey-tracker.html, tests/support/constants.ts, tests/e2e/fitness/units.spec.ts</files>
  <behavior>
    - FIT-UNIT wuIn reads back every one-decimal lb value and every two-decimal kg value exactly and reopening then saving never changes a stored weight (loadAppPure: wuIn, wuConv, woR2, woFromDraft, workoutProblems): for x = 0, 0.1, ..., 1000 (integer steps i/10) wuIn(woR2(wuConv(x,"lb","kg")),"kg","lb") equals String(x); for x = i/100 up to 453.59 wuIn(woR2(wuConv(x,"kg","lb")),"lb","kg") equals String(x); for every stored s = i/100 in 0..1000, woR2(wuConv(Number(wuIn(s,"kg","lb")),"lb","kg")) equals s and woR2(wuConv(Number(wuIn(s,"lb","kg")),"kg","lb")) equals s; wuIn(61.23,"kg","lb") "135", wuIn(20,"kg","lb") "44.1", wuIn(22.555,"kg","kg") "22.555", wuIn(5,null,"lb") "5"; woFromDraft of bench "135" x "5" with a lb-to-kg converter stores w 61.23; workoutProblems with that converter accepts "1000", reports wrange for "1000.5" and for "0.01" (0.01 lb passes the plain check but stores 0 kg, so this exercises the converter branch); for a lb lift with a kg-to-lb converter "453.59" passes and "453.6" reports wconv; both functions called without the converter give exactly today's results (the existing workouts-data.spec.ts tests stay green unchanged)
    - FIT-UNIT a weight typed in lb is stored in kg and reads back exactly when reopened, also after switching units with an unsaved draft: switch to lb, add bench, column header 重量（lb）, fill 135 x 5, save: saved workouts[today] bench set {w:61.23,r:5}; readFl shows "135"; switch kg shows "61.23"; switch lb shows "135"; in kg add squat, fill 20 x 8 without saving, switch lb: squat shows "44.1", #flDiscard still present (draft still unsaved), save: squat stored w 20; in lb, typing 1000.5 and saving shows the wrange error text 重量要在 0 到 1000 之间
    - FIT-UNIT the log form, history and charts use the chosen unit, a lift counted in reps stays unchanged and a lift kept in lb converts the other way: variant adds SYNTH lifts l-synthr (unit 次, def 5, target 20) and l-synthp (unit lbs, def 45, target 135); seed 2026-03-16 bench [[25,5],[30,3]], l-synthr [[10,8]], l-synthp [[135,5]]; kg mode: l-synthp card "61.2" " kg" alt "≈ 135 lb", target "目标 61.2 kg"; l-synthr card "10" " 次" with no alt; lb mode: bench card "66.1" " lb" alt "≈ 30 kg"; l-synthp "135" " lbs" alt "≈ 61.2 kg"; l-synthr unchanged; bench last-time line 上次（3月16日）：55.1 × 5，66.1 × 3; column headers 重量（lb） for bench, 重量（lbs） for l-synthp, 重量（次） for l-synthr; history item 2026-03-16 bench line text 卧推（lb）：55.1 × 5，66.1 × 3 with grey ≈ 25～30 kg, l-synthr line unchanged without grey text; bench chart sub "最大重量 · lb", target label "目标 88.2 lb", reading "最新：3月16日　66.1 lb", last point "66.1"; back in kg mode, typing 61.23 for l-synthp and saving stores 134.99 and reopening shows "61.23"
    - FIT-UNIT the fitness tab in lb has no horizontal overflow at 375 px and the unit switch stays usable: viewport 375 x 800, bench training seeded, lb chosen, bench added to the draft with a value; documentElement and #tab-fit scrollWidth not above clientWidth; every .fw-lift scrollWidth not above its clientWidth; both [data-wu] buttons visible with a bounding box height of at least 44
  </behavior>
  <action>
Add the four tests above to tests/e2e/fitness/units.spec.ts first (exact titles; the variant uses the charts.spec.ts pattern of prepending DEFAULT_PLAN.lifts.push before function normalizePlan(; compare lift names only by equality, never in messages; read history and form texts with page.evaluate in the spec when the shared readers do not expose them, splitting the main text from .wu-alt), run them red, then implement:

1. Pure helper wuIn(s,k,u) next to the Task 1 helpers [记录单位]: when s is not a finite number, or k or u is falsy, or k equals u, return String(s) (today's text); otherwise for d from 0 to 3 take c = the converted value wuConv(s,k,u) rounded to d decimals and return String(c) as soon as woR2(wuConv(c,u,k)) equals s; if none matches (only for stored numbers with more than two decimals, possible from imports) return String(woR2(wuConv(s,k,u))). One Chinese comment line states why this is stable: the returned text always saves back to the same stored number, one-decimal lb and two-decimal kg inputs come back exactly.

2. Optional converter for woFromDraft(d,cv) and workoutProblems(d,cv) [记录单位]: cv(id,w) returns the weight in the lift's own unit. Without cv both behave exactly as today. woFromDraft with cv stores woR2(cv(x.id,Number(z.w))). workoutProblems with cv: after the existing weight check passes, let s=woR2(cv(x.id,w)); a non-zero w with s equal to 0 reports wrange; s above WO_MAX.w reports the new code wconv. Add wconv to T_FL_ERR with the text 换算成这个动作自己的单位后超过 1000.

3. Draft unit fl.u [记录单位]: flOpen sets fl.u = wuOf(state). Helper flK(id) gives wuKind of the plan lift's unit (null for a lift no longer in the plan). flDraftOf(day,u) builds weight strings with wuIn(z.w,flK(x.id),u) (u null keeps String(z.w)). flCv() returns a converter from fl.u to flK(id) via wuConv (identity when fl.u is null, the kind is null or equal). Pass flCv() to every workoutProblems call (flErrs, flHint, flSave) and to woFromDraft in flSave. The filllast action fills weights with wuIn(z.w,flK(ex.id),fl.u). Local draft backup: flKeep stores {date,draft,u:fl.u}; flRestore reads u as "kg" or "lb" else null (an older backup without u holds each lift's own unit), compares with flDraftOf(saved,u) and sets fl.u on the restored session.

4. flReunit(nu) [记录单位]: convert fl.draft and fl.orig (parse, convert, stringify) from fl.u to nu. For each set of a lift with kind k (skip lifts with null kind): when the trimmed w string is a number that would pass the weight checks of workoutProblems under the old unit (finite, 0 to 1000, non-zero not stored as 0, converted not above WO_MAX.w), replace it with wuIn(woR2(wuConv(w,fl.u,k)),k,nu); leave every other string exactly as typed. Then set fl.u = nu. A clean draft stays clean and an unsaved draft stays unsaved. In renderFit, right after flTryRestore(), compute ru as fl existing with fl.u different from wuOf(state); when ru call flReunit(wuOf(state)) and add ru to the condition that re-renders the log form (force||rs||ru||!flBusy()). When the focused element was inside #fl before that re-render, focus the element with the same id afterwards if it exists. This covers both a local click and a unit change arriving from another device.

5. Log form display in flExHTML [显示方式]: with du = wuOf(state), the unit label is wuLbl(L.unit,fl.u) for T_FL_COL_W and T_FL_LBL_W (lifts gone from the plan keep "kg"); the legend target becomes esc(T_FL_TARGET(wuMain(L.target,L.unit,du),wuLbl(L.unit,du))) followed by wuAltH(L.target,L.unit,du). flLastText takes the lift unit and shows each non-zero weight as wuMain(z.w,unit,du) (bodyweight stays 徒手); in kg mode its text is unchanged. Input max stays 1000 in the draft unit.

6. History fhBody [显示方式]: for a lift line whose plan lift has a weight kind and at least one non-zero set, sets show wuMain(z.w,f.unit,du), the text uses a new constant T_FH_LIFT_U(n,u,s) giving n（u）：s with u = wuLbl(f.unit,du), and after the escaped text add a small wu-alt element with ≈ lo～hi o (lo and hi are the smallest and largest non-zero weights converted to the other unit o with wuShow; just one value when they are equal). Lines with only bodyweight sets, lifts with non-weight units and gone lifts keep T_FH_LIFT exactly as today. Everything through esc.

7. Charts [显示方式, Discretion]: helper fcLift(L) returns L, or a copy with unit du and target r1(wuConv(L.target,k,du)) when the lift's kind k exists and differs from du; use it wherever the chart code reads L.unit or L.target (fcSub and fcUnit calls in renderFc, the per-figure drawing function's showT test, target line label and aria text). fcSer(id) converts every point value with r1(wuConv(p.v,k,du)) only when ser.mode is "weight" and k differs from du; reps mode is untouched. Volume (vol) is converted the same way, its unit text follows from fcLift (lb×次). No grey text in charts. In kg mode all chart output is identical to today.

8. Re-record APP_SHA256, run the verify command, then commit with explicit paths: us-journey-tracker.html, tests/support/constants.ts, tests/e2e/fitness/units.spec.ts. Suggested message: feat(quick-261121-uax): 记录表按所选单位输入并稳定换算，训练历史和趋势图按所选单位显示.
  </action>
  <verify>
    <automated>rm -f test-results/uax-t2.json && PW_JSON_REPORT=test-results/uax-t2.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/e2e/fitness/ tests/e2e/security/ tests/e2e/narrow/ && node tools/test-report/check-report.mjs test-results/uax-t2.json "FIT-UNIT wuIn reads back every one-decimal lb value and every two-decimal kg value exactly and reopening then saving never changes a stored weight" "FIT-UNIT a weight typed in lb is stored in kg and reads back exactly when reopened, also after switching units with an unsaved draft" "FIT-UNIT the log form, history and charts use the chosen unit, a lift counted in reps stays unchanged and a lift kept in lb converts the other way" "FIT-UNIT the fitness tab in lb has no horizontal overflow at 375 px and the unit switch stays usable" "FIT-02 workoutProblems reports half-filled rows, out-of-range values and empty blocks in page order with the agreed keys" && node -e "const c=require('crypto'),f=require('fs');const h=c.createHash('sha256').update(f.readFileSync('us-journey-tracker.html')).digest('hex');process.exit(f.readFileSync('tests/support/constants.ts','utf8').includes(\"APP_SHA256 = '\"+h+\"'\")?0:1)" && grep -c 'flReunit(' us-journey-tracker.html</automated>
  </verify>
  <done>All seven FIT-UNIT default tests so far pass with every existing fitness, security and narrow test (REPORT OK); lb input stores the lift's own unit with stable read-back, an unsaved draft converts on a unit switch, history and charts follow the chosen unit, 次 lifts are unchanged, nothing overflows at 375 px, APP_SHA256 matches, and the commit has only the three listed paths.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Backup round-trip, two-device sync case, README, full default suite</name>
  <files>tests/e2e/fitness/units.spec.ts, tests/cloud/fitness-sync.spec.ts, tests/README.md</files>
  <behavior>
    - FIT-UNIT a JSON backup carries the weight unit, importing it restores lb, and an old backup or an invalid value falls back to kg (default suite, local mode, mirrors tests/e2e/io/export.spec.ts and import.spec.ts): with lb chosen, #exportJson downloads a full backup whose state.wu is "lb" and whose workouts equal the saved ones; after switching to kg, importing that file (accept the native confirm as the existing import tests do) makes app.saved().wu "lb" and the lb button pressed; importing legacyBackup without wu makes the saved state have no wu key and kg pressed; importing a full backup whose state.wu is "LB" is accepted and leaves no wu key and kg pressed
    - FIT-UNIT the weight unit chosen on one device is uploaded with the state and switches the other device without a reload, converting its unsaved draft (cloud, appended to tests/cloud/fitness-sync.spec.ts): plan syntheticPlan('fu', 1); devices A and B both on the fitness tab, two realtime connections; B adds l-fu1 and types 20 x 8 without saving, then blurs; A clicks lb; app.fake.lastState(0).wu becomes "lb"; B without reload has the lb button pressed, readFl shows [{id:'l-fu1',sets:[{w:'44.1',r:'8'}]}], the l-fu1 card unit is " lb" with value "22"; B saves and lastState(0).workouts[FROZEN_TODAY] has l-fu1 set {w:20,r:8}
  </behavior>
  <action>
1. Add the default-suite backup test to tests/e2e/fitness/units.spec.ts and the cloud case to the end of tests/cloud/fitness-sync.spec.ts with the exact titles above [设置范围]. Reuse fullBackup, legacyBackup, jsonImportFile, chooseImportFile, downloadOf and the dialog helpers the existing import tests use; build files from synthetic state only; failure messages carry ids, dates, counts and booleans only. If any assertion shows the app does not behave as described (for example the import path drops wu), fix the app in this task, re-record APP_SHA256 and add us-journey-tracker.html and tests/support/constants.ts to this task's commit.

2. tests/README.md, section 健身页（Phase 15）的用例: add a bullet for units.spec.ts (pure unit helpers and round-trip property, normalize and backups, switch and goal cards, lb entry and draft conversion, 次 and lbs lifts, history and charts, 375 px, export and import), add the cloud case to the fitness-sync.spec.ts bullet, and in the 键名 bullet add the state field wu ("kg" or "lb", absent means kg) written with sync key wu. Chinese, existing style, no local paths.

3. Run the verify command. It runs the new default test, the two cloud fitness specs (targeted, one worker) and then one full default suite at BELOW_NORMAL with --min-expected 247 (239 before plus 8 new). Give the Bash call a 600000 ms timeout and run nothing else at the same time. If the full run fails, fix the cause and re-run only the failing spec until green, then repeat the full run once.

4. Commit with explicit paths: tests/e2e/fitness/units.spec.ts, tests/cloud/fitness-sync.spec.ts, tests/README.md (plus the app and constants only if step 1 required an app fix). Suggested message: test(quick-261121-uax): 重量单位随备份导出导入、两台设备同步的用例，README 补充.

5. Write .planning/quick/261121-uax-lb-kg/261121-uax-SUMMARY.md in segments: what changed per decision tag, the Discretion choices listed in the objective (field wu, rounding, wuIn round-trip guarantee and the accepted two-decimal lb case, charts without grey text, last-time line without grey text, history format, no per-row live conversion, no hand-entry input exists, goals tab and plan editor unchanged), the accepted transition phenomenon from CONTEXT (a device still on the old page that saves the state drops wu and the unit falls back to kg; only this setting is affected, no training data), that nothing was deployed and the new version needs the separate owner-approved release, the test counts from the reports (default total, cloud specs run), any existing test or helper that changed and why (readLiftGoals now excludes .wu-alt from target and adds valueAlt and targetAlt), and the three commit hashes. No local absolute paths.
  </action>
  <verify>
    <automated>rm -f test-results/uax-t3.json test-results/uax-cloud.json test-results/uax-full.json && PW_JSON_REPORT=test-results/uax-t3.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/e2e/fitness/units.spec.ts && node tools/test-report/check-report.mjs test-results/uax-t3.json "FIT-UNIT a JSON backup carries the weight unit, importing it restores lb, and an old backup or an invalid value falls back to kg" && PW_JSON_REPORT=test-results/uax-cloud.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['run','test:cloud','--',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" tests/cloud/fitness-sync.spec.ts tests/cloud/fitness-log.spec.ts && node tools/test-report/check-report.mjs test-results/uax-cloud.json "FIT-UNIT the weight unit chosen on one device is uploaded with the state and switches the other device without a reload, converting its unsaved draft" && PW_JSON_REPORT=test-results/uax-full.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1'],{stdio:'inherit',shell:true});process.exit(r.status??1)" && node tools/test-report/check-report.mjs test-results/uax-full.json --min-expected 247</automated>
  </verify>
  <done>The backup test and the two-device cloud case pass, both cloud fitness specs pass, the full default suite reports REPORT OK with at least 247 tests, README documents the new spec and the wu field, the SUMMARY records the choices, the transition phenomenon and the counts, and every commit lists only explicit allowed paths with the Sonnet co-author line.</done>
</task>

</tasks>

<assumption_delta_decision>
- Signal family: chosen (the implicit constant "weights are in the lift's own unit" gains a chosen input and display unit).
- Primary noun: each strength lift's own unit (plan `L.unit`) stays the storage identity of every weight in `state.workouts` and `state.lifts`.
- Decision: no-change. The locked decision 记录单位 keeps the workouts format unchanged; `state.wu` is a presentation and input parameter converted at the edges (`wuIn`, `flCv`, `wuMain`, `fcLift`, `fcSer`), never a second storage unit. The Task 2 property test (every stored weight survives reopen and save in both directions) is the invariant that would go red if a later change stored weights in the chosen unit.
</assumption_delta_decision>

<threat_model>
ASVS level 1, block on high. No new endpoint, no server or deployment change; the new field travels inside the existing `journey_docs` state document, backups and local caches.

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| state document / local cache / imported backup to app | `state.wu` and weights arrive from the server, another device, the local cache or a user-chosen file and are untrusted |
| plan to markup | lift unit text `L.unit` is free text from the plan (any device or import) and is now interpolated into more places |
| draft input to stored data | numbers typed in the chosen unit are converted before they enter `state.workouts` |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-uax-01 | Tampering | normalize / wuOf (`state.wu` from server, cache or backup) | medium | mitigate | normalize keeps wu only for the exact strings "kg" and "lb"; wuOf treats anything else as kg; wu is never interpolated into markup (only the literals kg / lb are shown); Task 1 test covers "LB", 1, null, {} and "<b>" |
| T-uax-02 | Information disclosure (XSS) | renderFw, flExHTML, fhBody, chart labels (`L.unit`, converted numbers) | high | mitigate | every new interpolation goes through esc(); grey text is built by wuAltH which escapes its text; the existing SEC-01 source gate and malicious-plan render tests in tests/e2e/security/escaping.spec.ts run in Tasks 1 and 2 verify |
| T-uax-03 | Tampering (data integrity) | wuIn / woFromDraft / flReunit conversions | medium | mitigate | storage format unchanged; conversion only at the edges; Task 2 property test proves exact read-back and reopen-save idempotence over the whole value range; flReunit leaves invalid strings untouched |
| T-uax-04 | Denial of service / data loss | workoutProblems with converter (weights beyond WO_MAX after conversion) | medium | mitigate | the converted value is checked against WO_MAX.w (new code wconv) and non-zero inputs that would store 0 are rejected, so normalize never silently drops a saved set |
| T-uax-05 | Tampering (loss of a setting) | old page versions still deployed on other devices | low | accept | an old page's normalize drops wu and the unit falls back to kg; only this preference is affected, no training data; accepted in CONTEXT and recorded in the SUMMARY |
| T-uax-06 | Information disclosure | commits, tests and SUMMARY in the public repo | medium | mitigate | explicit-path commits with the privacy pre-commit hook (no --no-verify), synthetic SYNTH- data only, lift names compared by equality and never put in messages, no local absolute paths or server details |
| T-uax-SC | Tampering | npm/pip/cargo installs | high | accept | not applicable: this task installs no package and downloads nothing; existing devDependencies only |
</threat_model>

<verification>
- Task verifies: the targeted fitness, security, data and narrow runs report REPORT OK with the named FIT-UNIT titles; APP_SHA256 equals the sha256 of the edited app after Tasks 1 and 2.
- Final: one full default run at BELOW_NORMAL with one worker reports REPORT OK with --min-expected 247; the targeted cloud run of tests/cloud/fitness-sync.spec.ts and tests/cloud/fitness-log.spec.ts reports REPORT OK including the new two-device title.
- git log shows three task commits touching only the listed paths; git status shows the excluded paths still unstaged.
</verification>

<success_criteria>
- The fitness tab has a working kg | lb switch whose value is stored as state.wu in the account data and synced; absent or invalid values mean kg.
- Every weight on the fitness tab is shown in the chosen unit; goal cards, log form target and history show the other unit in grey; charts use the chosen unit; 次 lifts are unchanged.
- Typing in lb stores the lift's own unit with the workouts format unchanged, and saved values read back exactly (135 lb stays 135).
- Backups carry wu and imports replace it; LEGACY_KEYS unchanged.
- No server contact, nothing deployed; default suite at least 247 green; SUMMARY records the choices and the accepted transition phenomenon.
</success_criteria>

<output>
Create `.planning/quick/261121-uax-lb-kg/261121-uax-SUMMARY.md` when done
</output>
