# Testing Patterns

**Analysis Date:** 2026-11-01

## Test Framework

**Current state:** there are no tests, no test runner, no fixtures and no CI. There is no `package.json`.

**Constraint:** all logic sits in one IIFE with no exports. Unit-testing functions such as `normalize`, `eventsOn` or `csvCell` directly would require pulling them out of the file, which is an application-code refactor and **needs approval first**.

## Test File Organization

None yet. Recommended layout once approved (none of it touches application code):

```text
tests/
├── fixtures/
│   └── synthetic-state.json     # invented data only, never a real backup
├── shims/
│   └── claude-runtime.js        # fake window.claude.use("db"|"user"|"downloads")
└── e2e/
    └── *.spec.ts                # Playwright browser tests
```

## Test Structure

**Recommended approach: black-box browser tests with Playwright.**
- Serve `us-journey-tracker.html` from a local static server, or load it from a `file://` URL.
- Use `page.addInitScript()` to inject a fake `window.claude` **before** the page script runs. This matches the real contract, where `window.claude` exists before any script. The shim can then simulate:
  - **local mode:** no `window.claude` (the default) → the `localStorage` store
  - **account mode:** `use("db")` returns an in-memory document store with `doc(path).get()`/`set()`, and `use("user")` returns `{ id: async () => "u_test" }`
  - **failure modes:** `get()` rejects (checks the silent fallback), `set()` rejects with `invalid_argument` (checks the 256 KiB cap path)
  - **downloads:** `save()` resolves, or rejects with `declined` or `rate_limited`, while recording `filename` and `data` for assertions
- Seed `localStorage["us-journey-tracker-v1"]` with **synthetic** fixture JSON.

## Mocking

- Mock only at the `window.claude` boundary and in `localStorage`. The app has no other external dependency besides Google Fonts, which can be blocked with `page.route` so tests are deterministic.
- Freeze time with Playwright's clock API (`page.clock.setFixedTime`), because `today()` drives the counter, the selected week and overdue flags.

## Fixtures and Factories

- **Synthetic data only.** Generate logs with invented text across all five categories, a fictional arrival date, a few completed and overdue tasks, a custom task, lift history and one weekly review.
- Never copy a real backup file into `tests/`.
- Include edge-case fixtures: legacy category names (`LEGACY` keys), missing optional fields, and malformed shapes for the import tests.

## Coverage

**Target:** behaviour coverage of the scenarios below, not line coverage, since there is no instrumentation without a build step.

## Test Types

**Unit Tests:**
- Not possible without extracting code (approval needed).

**Integration Tests:**
- Store selection in `init()`, persistence round trips (reload, then the same state), and the `normalize()` migrations seen through import.

**E2E Tests:**
- Recommended: Playwright (Chromium plus mobile emulation for the 560 px layout).
- Priority scenarios:
  1. Local mode: add a log, reload, the log is still there; the status line shows the browser-storage label.
  2. Account mode through the shim: load from `data/users/u_test/state` and save back after the debounce.
  3. Load failure: the app falls back to `localStorage` and the status label changes.
  4. Export buttons hidden without `downloads`, visible with it; check the CSV header, the `MM/DD/YYYY` dates and quoting of commas, quotes and newlines.
  5. JSON import: valid replace, cancelled confirm, malformed file.
  6. Editor: change text, category and date; delete with undo.
  7. Goals: check a task (done today), set a due date, see overdue styling, add and remove a custom task, update a lift.
  8. Week view: drag an entry to another day (desktop), weekly review persists.

## Common Patterns

**Async Testing:**
```typescript
// Saves are debounced 600 ms (review text 800 ms + 600 ms), so wait for storage, not for a fixed delay
await expect.poll(() => page.evaluate(() => localStorage.getItem("us-journey-tracker-v1"))).toContain("synthetic entry");
```

**Error Testing:**
```typescript
await page.addInitScript(() => { /* shim whose db.doc().set rejects {code:"invalid_argument"} */ });
await expect(page.locator("#status")).toContainText("保存失败");
```

---

*Testing analysis: 2026-11-01*
