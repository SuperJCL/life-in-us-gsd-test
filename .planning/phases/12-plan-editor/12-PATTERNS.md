# Phase 12: 编辑计划页（Plan Editor） - Pattern Map

**Mapped:** 2026-11-11
**Files analyzed:** 14 (1 app file with 16 code areas, plus tests and tools)
**Analogs found:** 14 / 14 (the app has no router, `beforeunload` or sticky-bar code, so those parts are only partial matches)
**Line numbers** are for the current `us-journey-tracker.html`. Several differ from the line numbers cited in CONTEXT.md, so the numbers below are the ones to use.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `us-journey-tracker.html` `normalizePlan` / `usePlan` (461-498) | utility (validation) | transform | itself, extended | exact |
| same file, new `#tab-plan` section and `renderPlanEditor` and draft model | component + store | CRUD (draft), event-driven | `openEditor` (1952-1979) plus `renderGoals` (1900-1920) | role-match |
| same file, plan save (`savePlanDraft`) | service | request-response + batch | `applyImport` (1443-1467) | exact for the write steps |
| same file, `confirmBox` (1340-1358) with `okClass`, `scope`, `mid` | component (dialog) | request-response | itself | exact |
| same file, `isBusy` / `renderAll` / `renderKeep` / `applyView` / `takeRemote` / `hasUnsaved` | controller | event-driven | itself | exact |
| same file, conflict version check (`syncOnce` 1248-1255) | service | pub-sub | itself | exact |
| same file, `renderGoals`, `renderDay`, `renderTimeline`, CSV, `renderWeek` | component | transform | itself | exact |
| same file, `presetsFor` (1785) | utility | transform | itself | exact |
| same file, `#plan` route, `beforeunload`, tab clicks (1937-1939) | controller | event-driven | tab click handler (1937-1939) | partial |
| same file, sticky bar and `#pe-notice` | component | event-driven | `showBar`/`drawBar` (915-926) | role-match |
| same file, CSS and `<dialog id="confirm">` markup | config | n/a | existing `.syncbar`, `.group`, `dialog#confirm` rules | role-match |
| `tests/e2e/data/plan-normalize.spec.ts` (modify) | test | transform | itself | exact |
| new `tests/cloud/plan-editor*.spec.ts` | test | request-response | `tests/cloud/import-sync.spec.ts`, `offline-sync.spec.ts` | exact |
| new `tests/support/plan-editor.ts` | test helper | request-response | `tests/support/goals.ts`, `confirm.ts` | exact |
| `tests/support/constants.ts` (`APP_SHA256`, line 38) | config | n/a | itself | exact |
| `tests/KNOWN-BUGS.md`, `tests/README.md`, `tools/plan/migrate-backup.mjs` | docs / tool | n/a | itself | check only |

## Pattern Assignments

### Plan validation: `normalizePlan` (461-489) and `usePlan` (493-498) (D-06, D-16)

Edit these in place.

- **Empty groups (D-16).** Line 462 rejects `!p.groups.length`. Drop only that clause. Keep `Array.isArray`.
- **Archived flag on groups and lifts (D-06).** Task `archived` is validated and kept at 471-473. Copy that exact shape to groups (475) and lifts (481).

Copy for tasks (lines 471-473):
```js
if(t.archived!==undefined&&typeof t.archived!=="boolean")return null;
const o={id:t.id,text:t.text};if(t.archived!==undefined)o.archived=t.archived;tasks.push(o);
```
Groups (475) and lifts (481) build their output objects with no `archived` today. Add the same conditional.

Other code to re-check after `groups.length` is relaxed:
- `usePlan`'s fallback (494) uses `ok=!!n`. An empty plan is now valid.
- `classifyBackup` (about 600-620) uses `normalizePlan` to recognise a plan file.
- `importProblem` and `planCounts` (636).
- The `fitGoal` check (486) needs no change.

New helpers to add in the same pure section (it feeds `loadAppPure` and `pureSection`):
- `groupLabel(g)`: `P{n}` counted over unarchived groups, else the group name.
- `activeGroups`, `activeLifts`.
- A progress predicate over `state.tasks[id]` with `done`/`due`.

`usePlan` also builds `planTasks`, `planIds` and `planCat` (495-496). Archived tasks stay in `planTasks` so that `normalize` does not drop their progress at 576. Filter them at render time instead: in `allTasks()` (520, 2063-2065) and in `renderGoals`. `planCat[t.group]` at 1853 and 1862 must tolerate a missing group (S12). `lift()` (522) throws for an id that is not in the plan, so guard it.

### Draft model, `#tab-plan` renderer and field editing (component, CRUD on a draft)

**Analog:** `openEditor` (1952-1979) for draw/redraw while keeping typed values. `renderGoals` (1900-1920) for template-literal output.

Imports and idioms to copy:
- `esc()` on every plan text.
- `data-*` handlers.
- `.seg` category buttons with `aria-pressed`.
- Redraw that keeps the typed value.

Copy for the `.seg` category picker (1957):
```js
<div class="seg" role="group" aria-label="类别">${CATS.map(c=>`<button type="button" class="k-${c.k}" aria-pressed="${c.n===cat}" data-edcat="${esc(c.n)}">${esc(c.n)}</button>`).join("")}</div>
```
Copy for the redraw that keeps the typed value (1963):
```js
form.querySelectorAll("[data-edcat]").forEach(b=>b.onclick=()=>{form.dataset.keep=$("ed-text").value;...;cat=b.dataset.edcat;draw();$("ed-text").focus()});
```
The editor page needs its own `draw`. Do not call `renderAll` from it. `renderKeep` (1698-1710) is the pattern for "full redraw, then restore the focused element and cursor". Do the same for `#tab-plan`: save `activeElement.id` and the selection, redraw, restore.

Draft rules from the spec:
- Draft = a deep copy of `plan`, with `openedBase = docs.plan.base` captured at open (S9).
- Compare drafts with `canon()`. `canon` is used at 1495 and 1657.
- Never use `docs.plan.base` at save time, because 1252 moves it forward.

### Saving the plan (service, whole-document replacement)

**Analog:** `applyImport` (1443-1467), plus `undoImport` (1493-1499).

Core write sequence to copy (1454-1458). In the editor save, replace `pv.plan` with the draft:
```js
if(pv.plan&&docs.plan){
  usePlan(pv.plan);keepOrphans=false;
  docs.plan.dirty=true;docs.plan.seq=(docs.plan.seq||0)+1;
  planCached=cachePut("plan",{...docs.plan,data:pv.plan});
}
const J=JSON.stringify(pv.state);
commit(["import"],s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,JSON.parse(J))});
opsOk=false;
if(!planCached)cacheNote(false);
```
Notes for the editor:
- Start with `takeRemote()` (1444). `commit` calls it too (672).
- State changes in the save: archiving or permanent-deleting changes progress and lift history. Pass them through `commit([...],fn)` with the id as the key, as `deleteLog` does (1941).
- Normalize the state under the new plan before the commit. `applyImport` does this with `importPreview` and `withPlan` (630-634, 649-658). The new `usePlan` must run before any render (see "the order matters" at 1438).
- `persist` only covers state (662). After the plan write, call `requestSync("save")` yourself.
- Size check before write: `tooLarge(pv)` at 1448 and `T_IMP_TOO_LARGE`. Copy the shape for the 4 MiB check.
- Local copy of the overwritten version (D-07): reuse the snapshot mechanism (`snapPending` / `snapGet` / `conflictNotice`, 1246) and `blobDownload` (2044-2055) with `backupOf`. The Phase 9 D-10 / 11-09 plan wrapper is what writes the kept copy.
- Permanent-deleted lift: `delete s.lifts[id]` inside the commit fn. `normalize` only filters by id format at 583, so it will not drop it.
- Orphan progress for deleted tasks is dropped by `normalize` at 576 when `keepOrphans` is false. A permanent task delete relies on this. An archived task stays in `planIds`, so its progress is kept.

### `confirmBox` extension (1340-1358) (S10)

Existing function body (excerpt, 1343-1357):
```js
const back=document.activeElement,cancel=$("cfCancel"),okb=$("cfOk");let val=false;
$("cf-title").textContent=o.title;
const body=$("cf-body");body.textContent="";
o.lines.forEach((t,i)=>{const p=document.createElement("p");if(i===0&&o.who)p.className="cf-who";if(o.warn&&o.warn.includes(i))p.classList.add("cf-warn");p.textContent=t;body.appendChild(p)});
cancel.textContent=o.cancel;okb.textContent=o.ok;
cancel.onclick=()=>cfDlg.close();
okb.onclick=()=>{val=true;cfDlg.close()};
cfDlg.onclick=e=>{if(e.target===cfDlg)cfDlg.close()};
cfDlg.addEventListener("close",()=>{cancel.onclick=okb.onclick=cfDlg.onclick=null;...res(val)},{once:true});
```
Add:
- `okClass`: set `okb.className`, and restore the default on close.
- `scope`: toggle the `pe` class on `cfDlg`, and remove it in the `close` handler.
- `mid`: a `#cfMid` button wired like `okb`, with `val="mid"`. Add the button to the `<dialog id="confirm">` markup near line 385 and add `.three` to `.ed-foot`.

Existing callers still pass only `{title,lines,cancel,ok}`, so the default path must not change. `isBusy` (1666) treats `cfDlg.open` as busy, and `cfDlg.addEventListener("close",...)` (1711) calls `maybeApplyView`. `resetSession` closes the dialog (1727). Do not break either.

### Busy, render and remote-view integration (controller)

**Analog:** `isBusy` (1665-1677), `renderAll` (1833), `applyView` (1688-1695), `takeRemote` (1646-1654), `hasUnsaved` (1716), `onLogoutClick` (1760+).

- `isBusy`: add as the first line `if(planEditing)return true;`, matching the `dlg.open||cfDlg.open||rvPending` line at 1666.
- `renderAll` (1833) and `renderKeep` (1698): `renderAll` only calls the six renderers, so `#tab-plan` is naturally skipped as long as the editor draws only from its own function. Do not add `#tab-plan` to a renderer.
- The editor opening takes `takeRemote()` first, so the draft starts from the latest plan and `openedBase` is that plan's `docs.plan.base`.
- `maybeApplyView` (1678): the `showBar("remote",...)` call uses `btns:[{text:"现在更新",...}]`. When the editor is open, use `{tone:"info",msg:<S9 no-button text>}` with no `btns`. `drawBar` (917-926) already supports a missing `btns`.
- `hasUnsaved` (1716): do **not** add the draft here. It means "unsent to server" and is read at logout. Add a separate `planDirty()` and a new line in the logout confirm, next to `T_CF_UNSAVED` (1717, shown 1760+).
- `resetSession` (1722-1742): clear the draft, `planEditing`, the hash, and close the editor.
- `beforeunload`: new. Put it next to `window.addEventListener("pagehide",flush)` at 2082.
- Route: new. Hooking `hashchange`/`popstate` is new; the nearest analog is the tab click handler (1937-1939):
```js
document.querySelector("nav.tabs").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(!b)return;
  document.querySelectorAll("[data-tab]").forEach(x=>x.setAttribute("aria-selected",x===b));
  ["wk","cal","goal","tl"].forEach(k=>$("tab-"+k).classList.toggle("hidden",k!==b.dataset.tab))});
```
  Add `"plan"` to the hidden list. When leaving the editor, run the leave confirm first.

### Remote plan arriving during editing (D-07) (1248-1255)

Existing code:
```js
if(psv.updated!==docs.plan.base&&!docs.plan.dirty){
  pendRemote.plan={data:psv.data,updated:psv.updated};
  const np=normalizePlan(psv.data);
  docs.plan={id:psv.id,base:psv.updated,dirty:false,seq:docs.plan.seq||0};
  if(!cachePut("plan",{...docs.plan,data:np||psv.data}))dropCache("plan");
  gotRemote=true;
}
```
This is the reason for `openedBase`. After this block, `docs.plan.base` equals the remote version. Compare `pendRemote.plan.updated !== openedBase` to decide whether to show `#pe-notice`. After the call, trigger the editor's notice refresh. Hook this next to where `remoteView` is set (search for `gotRemote`). The overwrite save must run the `takeRemote()` and the kept-copy step so the overwritten version is kept.

### Goals view, day panel, timeline, CSV, week view (D-03, D-04, D-14, S11, S12)

All lines are current.

- **`renderGoals` (1900-1920).**
  - The group header prints `esc(g.id)` at 1912. Replace with the generated `P{n}` over unarchived groups.
  - The add-task input's `aria-label` (1919) uses `esc(g.id)`. Change it to the group name.
  - The `ts` filter at 1911 uses `allTasks().filter(x=>x.group===g.id)`. Skip archived groups, and skip archived tasks in the active list.
  - Copy for the group-list structure to reuse in `.arch` (1912-1914) and the lift card (1904-1909). The archived version drops inputs and buttons.
  - The custom-task delete button is `data-deltask` (1918), shown when `!planIds.has(x.id)`.
  - Custom tasks whose `group` is not in the plan go in the archived section (WR-02).
  - The fit card uses `plan.fitNote` and `plan.lifts.map`. Add the empty-lift and empty-plan states.
- **`renderDay` (1895-1896)**: `esc(t.group)` becomes `groupLabel`. `e.due` must exclude archived tasks. Find where `eventsOn` filters and exclude archived groups and tasks there.
- **`renderTimeline` (1927)**: `tag:t.group` becomes `groupLabel`. `planCat[t.group]` stays.
- **CSV (2063-2065)**: `t.group+" 计划"` becomes a label. Skip the `s.due` branch for archived tasks. The done branch stays.
- **`renderWeek` (1851-1853, 1862)**: `planCat[...]` tolerates a missing group (use `||"其他"`). Archived tasks count nothing because the completion count must skip them (D-03). Add an empty line under `.wk-head` (S12).
- **`allTasks()` (520)** is used everywhere. Keep it returning all tasks, and add `activeTasks()`. Check each caller: 1851, 1911, 1927, 2063, and any in `eventsOn`.
- `presetsFor` (1785), copy and extend with a de-dup:
```js
function presetsFor(cat){const C=CATS.find(c=>c.n===cat),s=pstate(cat);return (plan.presets[C.k]||[]).filter(x=>!s.hide.includes(x)).concat(s.add)}
```
  Add `.filter((x,i,a)=>a.indexOf(x)===i)` at the end.

### Toasts and undo (S7, D-10)

**Analog:** `deleteLog` (1941-1942). It is the existing remove-then-undo-toast pattern.
```js
toast("已删除这条记录",{label:"撤销",fn:()=>{commit([...],s=>{...splice(Math.min(i,s.logs.length),0,...)});renderAll();toast("已恢复")}})
```
`toast(m,act,ms)` is at 2078-2081. Any call with `ms` sets `data-cloud` (a cloud-version toast style). Pass `ms` for all plan editor toasts. The draft-removal undo only edits the draft (it does not call `commit`), and restores the item at its old index.

### Gate and sync bar (S1, D-11, D-12)

- `GATE_ALLOW` (889): do not add `#planEditBtn` (spec: disabled in the gate). `applyGate` disables every `.wrap button/input`, so `#tab-plan` controls are disabled too. Decide if that is intended while `data-gate` is set. `GATE_BLOCK` (903) lists the `data-*` attributes to block, so add any new action attributes there.
- Offline/expired state for the save button: read `$("status").getAttribute("data-state")` (the same attribute `persist` reads at 662), and `sbs.expired` for the expired state. Poll it via `showSync`/`drawBar`, or hook the same place that updates `#status`.
- `#pe-notice` copies `.syncbar` appearance and uses `data-tone="warn"` (see `drawBar`, 917-926).

### Tests

- **`tests/e2e/data/plan-normalize.spec.ts`**
  - Uses `loadAppPure(NAMES)` with `NAMES=['DEFAULT_PLAN','normalizePlan','usePlan','allTasks']`.
  - Builds variants as `JSON.parse(JSON.stringify(DEFAULT_PLAN))`, with `plain()` for the vm round trip.
  - Update the existing "rejects empty groups" case, and add accepts for empty plans and for `archived` on groups and lifts.
  - New pure helpers (`groupLabel` and the others) go into `NAMES` here.
- **New `tests/cloud/plan-editor*.spec.ts`**
  - Open with `app.open({ mode: 'cloud', seed: syntheticState('a'), plan: syntheticPlan('o', 1), login: 0 })` (`offline-sync.spec.ts`, `import-sync.spec.ts`).
  - Use `page.clock.install` and `pauseAt` with `FROZEN_NOW` and `runFor` for time.
  - Second device: `openDevice({ browser, guard, fake: app.fake, clock: 'none' })`.
  - Remote plan edit, `offline-sync.spec.ts` 394-399. This is the D-07 setup:
```ts
async function otherWriterEditsPlan(app: { fake: any }, suffix: string) {
  const data = app.fake.lastPlan(0);
  data.groups[0].tasks[0].text += suffix;
  const res = await app.fake.request(0, 'PATCH', `${LIST_PATH}/${app.fake.docId(0, 'plan')}`, { data, writer: 'synth-other-writer' });
  expect(res.status).toBe(200);
}
```
  - Suppress the page's realtime when the page must not "hear" a write: `app.fake.refuseRealtime(true, page)` and `await app.fake.dropRealtime(page)`.
  - Faults for offline save: `app.fake.fault({ method:'PATCH', path:..., mode:'refuse', context })`.
  - Imports from `import-sync.spec.ts`: `confirmCancel, confirmOk, readConfirm` from `../support/confirm`, `acknowledgeConsoleErrors` from `../support/guard-ack`, `expectToast` from `../support/toast`, strings from `../support/strings`.
  - Existing `strings.ts` constants hold UI copy. Add the new Phase 12 copy there.
- **New `tests/support/plan-editor.ts`**
  - Model on `tests/support/goals.ts`, which only reads ids, counts and booleans in `page.evaluate` (privacy rule D-05) and never returns element handles.
  - Model `confirm.ts` on `readConfirm`/`confirmOk`. Extend with `#cfMid`.
  - Use synthetic plan text only (`SYNTH-` prefix).
- **Goals specs**
  - `tests/e2e/goals/{overview,tasks,lifts}.spec.ts` currently read `.p` as the group id (`readGroups` in `goals.ts`). With `P{n}` generated, the initial display of 7 groups does not change, so these should keep passing. Check them after the edit.
  - `tests/e2e/goals/known-bugs.spec.ts` and `tests/KNOWN-BUGS.md`: WR-02 (custom to-do whose group is missing) and IN-05 (archived task still shown) change behaviour. Update both files in the same plan.
  - `tests/e2e/week/presets.spec.ts` covers the preset de-dup.
- **`tests/support/constants.ts` line 38**: `export const APP_SHA256 = '...'`. It is checked by `tests/e2e/platform/app-integrity.spec.ts`. After the last app edit, recompute the hash and update the constant. Do this in the last task of each plan that edits the app file, or the integrity spec fails.

### Tools and docs

- **`tools/plan/migrate-backup.mjs`**
  - Calls `evalApp` (lines 58-69), which runs the app's pure section through `vm.runInNewContext` (via `pureSection` from `extract-plan.mjs`).
  - Any new helper added to the pure section must not reference the DOM or `window`. Helpers written in the pure section must not depend on anything defined after it.
  - The empty-groups change affects `usePlan` and the self-test (`--self-test`, line 235, 350+). Search the self-test for cases that expect an empty plan to be rejected, then update them.
  - Run `node tools/plan/migrate-backup.mjs --self-test` after the change (the planner schedules this; I did not run it).
- **`tests/README.md`**: update the list of specs if new spec files are added.

## Shared Patterns

### Text safety
Every plan text goes through `esc()` before it reaches `innerHTML` or an attribute. Confirm-dialog text and toasts use `textContent` (1344-1346, 2078). Ids put into `data-*` pass the id regexes first (`GROUP_ID_RE`, `PLAN_TASK_ID_RE`, `LIFT_ID_RE`, defined near line 395).

### Writing data
All state changes go through `commit(keys, fn)` (672). `fn` is idempotent and finds its target by id or key. The plan write is separate and follows `applyImport` (docs.plan.dirty, seq++, cachePut, requestSync). `persist` handles only state.

### Remote updates
Only `takeRemote()` (1646) brings remote data into the working data. The editor save calls it first.

### Dialogs
`confirmBox` for all new confirmations. The cancel button is the default focus, and Esc or a backdrop click resolves `false`.

### Copy and privacy in tests
Synthetic data only. No real plan text in assertion messages.

## No Analog Found

| File / part | Role | Data Flow | Reason |
|---|---|---|---|
| `#plan` hash route, `hashchange`/`popstate` handling | controller | event-driven | No `location.hash`, `hashchange`, `popstate` or `beforeunload` code exists. Use the tab click handler (1937-1939) as a structural base and RESEARCH-free spec S1/S8 for behaviour |
| Sticky save bar `#pe-bar` | component | event-driven | The nearest is `.syncbar` / `drawBar` (917-926), which is not sticky and has no live-status row |
| Draft vs original deep comparison | utility | transform | `canon()` (used at 1495, 1657) is the closest existing helper |
| Three-button dialog | component | request-response | `confirmBox` has two buttons only (S10 defines the extension) |

## Metadata

**Analog search scope:** `us-journey-tracker.html` (lines 395-2087), `tests/cloud/`, `tests/e2e/data/`, `tests/e2e/goals/`, `tests/support/`, `tools/plan/migrate-backup.mjs`.
**Tracked check:** all named analog paths are tracked source (checked `tests/support/*` and `tools/plan/*` with `git ls-files`); no gitignored mirrors are named.
**Not read:** `private/`, `test-results/`, any backup file. No tests were run.
**UI-SPEC coverage:** I read `12-UI-SPEC.md` lines 1-464 only (S1-S13). The remaining 266 lines (the CSS skeleton, selector and copy tables) were not read, so the planner should read them directly for exact selectors and CSS.
**Pattern extraction date:** 2026-11-11
