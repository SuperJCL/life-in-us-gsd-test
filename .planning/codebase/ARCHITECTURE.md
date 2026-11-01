# Architecture

**Analysis Date:** 2026-11-01

## System Overview

```text
us-journey-tracker.html  (single file, no build)
├── <style>  design tokens (:root) + light/dark themes + component CSS
├── <body>   static shell: header, 4 tab <section>s, status line, toast, <dialog id="editor">
└── <script> one IIFE
     ├── constants      CATS, LEGACY, GROUPS→BUILTIN, LIFTS, FIT_GOAL
     ├── state          one mutable object `state` + UI cursors (view, sel, wk, wsel, filter, compCat)
     ├── persistence    persist() → debounce 600 ms → flush() → store.save(clone(state))
     │                    store = account adapter (Claude db + user)  |  localStore() (localStorage)
     ├── render         renderAll() = header + week + calendar + day panel + goals + timeline (innerHTML)
     ├── interaction    delegated listeners on document / containers, keyed by data-* attributes
     ├── editor         <dialog> for editing a log or a completed task
     └── export/import  CSV + JSON through Claude downloads (if present); JSON import through FileReader
```

## Component Responsibilities

| Component | Responsibility | Location |
|---|---|---|
| Header | Arrival date input; "day N in the US" or "N days until departure" counter | `us-journey-tracker.html:441-447` |
| Week tab | Per-category counts and goals for the week, 7 day columns of entries, drag an entry to another day, weekly review textarea, composer | `us-journey-tracker.html:449-479` |
| Calendar tab | Month grid with chips for logs, due tasks and done tasks; day panel with composer and lists | `us-journey-tracker.html:481-505` |
| Goals tab | Strength-lift tracker with history; goal groups P1–P7 with checkboxes, due dates, custom tasks and progress bars | `us-journey-tracker.html:507-527` |
| Timeline tab | Reverse-chronological feed grouped by month, filtered by category | `us-journey-tracker.html:529-541` |
| Composer | Category picker, preset tags (add/hide/edit), free-text entry. Instantiated twice: `w` (week) and `c` (calendar) | `us-journey-tracker.html:389-437` |
| Editor dialog | Edit a log's text, category and date, or delete it; edit a completed task's date or un-complete it | `us-journey-tracker.html:556-594` |
| Persistence | Debounced whole-state save behind the `store` adapter | `us-journey-tracker.html:356-379` |
| Export/Import | CSV calendar export, JSON backup, JSON restore | `us-journey-tracker.html:639-658` |
| Toast | Transient message with an optional undo action | `us-journey-tracker.html:660-663` |

## Pattern Overview

**Overall:** a single-file, vanilla-JS, state-then-re-render app.

**Key Characteristics:**
- One global mutable `state` object. Handlers mutate it directly, then call `persist()` and `renderAll()`.
- Rendering is idempotent string templating into `innerHTML`. Every change triggers a full re-render of all tabs, including hidden ones.
- Events are handled by delegation on `document` and on tab containers, using `data-*` attributes (`data-edit`, `data-edittask`, `data-dellog`, `data-task`, `data-due`, `data-preset`, …). Some listeners run in the capture phase and use `stopPropagation`.
- Storage sits behind a three-member adapter `{label, load, save}`. This is the only abstraction boundary in the code.
- Derived data (events on a date, weekly counts) is recomputed on each render by scanning `state.logs` and `allTasks()`.

## Layers

| Layer | Contents | Depends on |
|---|---|---|
| Static config | `CATS`, `GROUPS`, `LIFTS` and the other constants | — |
| Pure helpers | date math (`ymd`, `parse`, `addDays`, `monday`, `md`), `esc`, `uid`, `normalize`, `eventsOn`, `presetsFor` | config |
| State + persistence | `state`, `persist`, `flush`, `store`, `init` | helpers, Claude runtime / `localStorage` |
| Views | `render*` functions, `composer`, `presetsHTML` | state, helpers |
| Controllers | event listeners, `bindComposer`, editor, drag and drop, export/import | everything above |

These layers are conceptual. Everything shares one closure scope and nothing is exported, so no layer can be imported or tested on its own.

## Data Flow

### Primary Request Path (record an entry)
1. The user types in the composer, or clicks a preset tag (`bindComposer`, `us-journey-tracker.html:408-436`).
2. `addLog(date, cat, text)` pushes `{id: uid(), date, text, cat}` to `state.logs` (`us-journey-tracker.html:387`).
3. `persist()` marks the state dirty and starts a 600 ms debounce. `renderAll()` repaints every view.
4. `flush()` deep-clones the state with a JSON round trip and calls `store.save(...)`. The status line shows the store's label or an error (`us-journey-tracker.html:359-363`).

### Startup / load
1. `renderAll()` with the default empty state, so the shell appears immediately.
2. Resolve the `db` and `user` capabilities, then choose the account store or `localStore()`.
3. `store.load()`, then `normalize()`, which validates top-level types and migrates `LEGACY` categories. Then `renderAll()` again.
4. Resolve `downloads` and, if present, reveal the export buttons.

### Export
- CSV: build rows from logs, done tasks and due tasks; quote cells with `csvCell`; format dates as `MM/DD/YYYY`; call `window.__dl.save({filename, data})`.
- JSON: `JSON.stringify(state, null, 2)` through the same `save()`.

### Import
- `FileReader.readAsText`, `JSON.parse`, `normalize`, `confirm()`, then **replace** the entire `state`, then `persist()` and `renderAll()`.

## Key Abstractions

- **`state`**: the one source of truth, whose schema is in `INTEGRATIONS.md`.
- **`store` adapter**: `{label: string, load(): Promise<object|null>, save(obj): Promise<void>}`.
- **Task**: a built-in task (positional id `P<n>-<i>` from `GROUPS`) or a custom one (`c-<uid>`). Per-task progress lives separately in `state.tasks[id]`.
- **Log**: a dated free-text entry with a category. Logs are the main user data and grow without bound.
- **Composer instance `p`**: `"w"` or `"c"`. Its UI state is kept in `compCat[p]`, `compEdit[p]` and `compAdding[p]`.

## Entry Points

- `init()` at the end of the IIFE (`us-journey-tracker.html:665`).
- `window` `pagehide` triggers `flush()` (`us-journey-tracker.html:664`).

## Architectural Constraints

- **Single file, no build:** the artifact format required one self-contained HTML file. Any local tooling must keep that file working when opened directly.
- **Optional runtime:** every Claude capability may be `null`, and the app must keep working without them. It already does for `db` and `user`; without `downloads` it loses export.
- **Whole-state persistence:** every save rewrites the entire state, which ties document size to all history (see `CONCERNS.md`).
- **Load once, write blindly:** there is no subscription and no merge, so the last writer wins across tabs and devices.

## Anti-Patterns

### Positional identifiers for built-in tasks
Ids come from array position (`us-journey-tracker.html:317`). Inserting or reordering a task in `GROUPS` silently attaches saved progress to the wrong task.

### Full re-render on every change
`renderAll()` rebuilds every tab's DOM. This is acceptable at the current size, but it throws away transient UI state such as composer drafts and focus.

### Global side channel
`window.__dl` stores the downloads namespace on the page's global object (`us-journey-tracker.html:378`).

## Error Handling

- **Save:** errors are caught in `flush` and shown as "保存失败：<message>" ("save failed") in the status line. There is no retry: `dirty` is cleared before the save starts.
- **Load:** an error falls back to `localStorage` silently. Only the status label changes.
- **Capability resolution:** errors are swallowed (`catch(e){}`).
- **Export:** `declined` is ignored, `rate_limited` shows a "wait" toast, and anything else shows an "export unavailable" toast.
- **Import:** a parse or `normalize` failure shows a "wrong file format" toast.

## Cross-Cutting Concerns

- **Escaping:** most user text goes through `esc()` before going into `innerHTML`. Ids, `group`, `due` and `cur` values do not (see `CONCERNS.md`).
- **Dates:** local `YYYY-MM-DD` strings compared as text. Weeks start on Monday (`monday()`).
- **Accessibility:** ARIA roles and labels on tabs, buttons and entries; `aria-live` on the toast; `:focus-visible` outline; `prefers-reduced-motion` respected. The tabs have no `tabpanel` or arrow-key behaviour.
- **Theming:** CSS custom properties with a dark palette, applied through `prefers-color-scheme` and `[data-theme]`. The UI has no theme toggle.
- **Responsive:** breakpoints at 900, 820, 720 and 560 px. On mobile, calendar chips shrink to dots and the editor becomes a bottom sheet.

---

*Architecture analysis: 2026-11-01*
