# Codebase Concerns

**Analysis Date:** 2026-11-01

Findings come from reading `us-journey-tracker.html`. None of them have been fixed. Any change to application code needs approval first.

## Tech Debt

**Positional ids for built-in tasks:**
- Issue: ids are `P<n>-<index+1>`, taken from each task's position in `GROUPS` (`us-journey-tracker.html:317`). Custom-task detection relies on the regex `/^P\d-\d+$/` (`us-journey-tracker.html:522`).
- Files: `us-journey-tracker.html`
- Impact: inserting, removing or reordering a built-in task silently moves saved done and due state onto different tasks.
- Fix approach: give each built-in task a stable explicit id, plus a one-time migration in `normalize()`.

**Single-file, single-closure design:**
- Issue: about 370 lines of JS in one IIFE with no exports. Rendering, state, persistence and events are all in one scope.
- Impact: no unit tests are possible, and any change risks side effects across views.
- Fix approach: (after approval) split it into modules or at least separate script sections, while keeping a one-file build output.

**Shallow validation in `normalize()`:**
- Issue: only top-level types are checked (`us-journey-tracker.html:347-354`). The fields inside log, task, lift and custom entries are trusted.
- Impact: a malformed import (a log without `date` or `text`, say) can throw inside a renderer and leave the UI half-drawn. See also Security below.

## Known Bugs

**Composer draft lost when choosing another day:**
- Symptoms: text typed in the "记一笔" (quick entry) composer disappears when you then click a different day (week view) or calendar cell.
- Files: `us-journey-tracker.html:610` (`pickDay`, then `renderWeek`, then `renderWkComp`), `us-journey-tracker.html:618-619` (calendar, then `renderDay`)
- Trigger: type a draft, then click another day.
- Workaround: pick the day first, then type. A category or tag change keeps the draft, because `refresh()` preserves it.

**Cancelled import cannot be retried with the same file:**
- Symptoms: after cancelling the "replace all content?" confirm, choosing the same file again does nothing.
- Files: `us-journey-tracker.html:657`. The `return` on cancel skips `e.target.value=""`, so the input's `change` event does not fire for the same file.
- Workaround: pick a different file first, or reload.

**Edits made before the first load completes are discarded:**
- Symptoms: changes made while the status line still shows "正在加载…" (loading) are overwritten when the stored state arrives.
- Files: `us-journey-tracker.html:369` (renders before load), `us-journey-tracker.html:360` (`flush` returns early while `store` is null), `us-journey-tracker.html:375` (state replaced)
- Trigger: hosted mode with a slow capability handshake, which can take up to about 10 s. It is effectively immediate locally.

**Last ~1.4 s of review text can be lost on close:**
- Symptoms: weekly-review typing just before closing the tab is not saved.
- Files: `us-journey-tracker.html:613` (800 ms debounce before `state` is updated) plus `us-journey-tracker.html:358` (600 ms save debounce). `pagehide` (`us-journey-tracker.html:664`) only flushes what is already in `state`.

**A failed save is not retried:**
- Files: `us-journey-tracker.html:360-361`. `dirty=false` is set before `await store.save()`. After a failure, nothing is saved until the next edit.

## Security Considerations

**HTML injection through a crafted backup file (self-XSS):**
- Risk: several values from imported JSON go into `innerHTML` without `esc()`: `t.group` (`us-journey-tracker.html:502-503`), log and task ids in `data-*` attributes (`us-journey-tracker.html:468-469`, `us-journey-tracker.html:501-502`, `us-journey-tracker.html:523-525`, `us-journey-tracker.html:533-534`), `s.due` (`us-journey-tracker.html:525`) and lift `cur` (`us-journey-tracker.html:513-515`). A crafted `.json` restore could run script in the page.
- Current mitigation: only files the user picks are imported, and text fields are escaped.
- Recommendations: escape every interpolated value, and validate imported entries in depth (types, `YYYY-MM-DD` dates, known groups and categories, numeric lifts).

**CSV formula injection:**
- Risk: log text that starts with `=`, `+`, `-` or `@` is written to the CSV as is (`us-journey-tracker.html:640-649`). The file targets calendar import, but opening it in a spreadsheet would evaluate those cells.
- Recommendations: low priority. Prefix risky cells with `'` if spreadsheet use matters. `csvCell` also leaves bare `\r` unquoted.

**Personal content embedded in source:**
- Risk: `GROUPS` and `LIFTS` contain the owner's personal study, job-search and fitness plan (`us-journey-tracker.html:308-324`). Planning docs, fixtures and screenshots should not copy it.
- Recommendations: use synthetic data in tests. Moving the built-in plan into data rather than code is optional.

## Performance Bottlenecks

**Full re-render on each change:**
- Problem: `renderAll()` rebuilds all six regions. The calendar runs `eventsOn()` for up to 42 cells, each scanning all logs and tasks.
- Files: `us-journey-tracker.html:440`, `us-journey-tracker.html:382-386`, `us-journey-tracker.html:484-492`
- Cause: no memoization and no per-view dirty tracking.
- Improvement path: not needed at the current scale (fine up to a few thousand logs). Index logs by date if it ever becomes slow.

## Fragile Areas

**Capture-phase event delegation:**
- Files: `us-journey-tracker.html:550-554`
- Why fragile: three document-level capture listeners use `stopImmediatePropagation` and `stopPropagation` to decide between delete, edit and day selection. Their order matters.
- Safe modification: add new clickable entry types through `data-*` attributes, and test that delete, edit and select stay distinct.

**Store fallback logic:**
- Files: `us-journey-tracker.html:368-379`
- Why fragile: if loading from the account fails, the app quietly switches to `localStorage` for the session. New edits then go to the browser only, and the account copy is not updated. The user sees only a different status label.
- Test coverage: none.

## Scaling Limits

**Single-document storage (hosted):**
- Current capacity: all state lives in one `db` document, `data/users/<id>/state`.
- Limit: Claude Artifact `db` documents are capped at **256 KiB**. Logs, reviews and history only grow. At roughly 5 entries a day of 100–200 bytes each, plus weekly reviews, the cap could be reached in about one to two years of heavy use (an estimate). After that, every save fails with `invalid_argument`.
- Scaling path: split the state (for example one document per month of logs), prune, or, for a local build, use IndexedDB or file-based storage.

**Multi-device / multi-tab:**
- Current capacity: the state is loaded once and saved as a whole document, with no `onSnapshot`.
- Limit: two open tabs or devices overwrite each other's changes (last writer wins).
- Scaling path: subscribe and merge, or record a version and detect conflicts.

## Dependencies at Risk

**Claude Artifact runtime:**
- Risk: hosted persistence and export depend on `window.claude.use` and the `db`/`user`/`downloads` contract. Outside claude.ai none of these exist.
- Impact: locally the app works with `localStorage`, but **export and backup buttons never appear**, so local data can be restored but not backed up.
- Migration plan: a local adapter layer, with a `Blob` plus `<a download>` for exports and optionally IndexedDB or the File System Access API for storage, chosen when `window.claude` is absent.

**Google Fonts:**
- Risk: a network dependency for the heading font. It degrades gracefully. Self-hosting is optional.

## Missing Critical Features

**Local backup/export:**
- Problem: without `downloads`, the app offers no way to get data out (`us-journey-tracker.html:377-378`).
- Blocks: safe local use. A cleared browser profile loses everything.

**Day rollover:**
- Problem: `wk` and `sel` are computed once at load (`us-journey-tracker.html:341`). A tab left open past midnight keeps the previous day selected for new entries.

## Test Coverage Gaps

**Everything:**
- What's not tested: all functionality, since no tests exist.
- Files: `us-journey-tracker.html`
- Risk: regressions in persistence, import and date math would go unnoticed.
- Priority: High. Start with persistence, store selection, import and export (see `TESTING.md`).

---

*Concerns audit: 2026-11-01*
