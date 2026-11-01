# Codebase Structure

**Analysis Date:** 2026-11-01

## Directory Layout

```text
life-in-us-gsd-test/
├── us-journey-tracker.html   # the entire application (669 lines, ~50 KB)
├── .planning/                # GSD planning docs (this map); not application code
│   └── codebase/
├── .claude/                  # GSD tooling install (agents, commands, gsd-core); not application code
└── .git/                     # repository with no commits yet (branch master)
```

## Directory Purposes

- **Repository root:** holds the one application file. There is no `src/`, no assets and no tests.
- **`.planning/`:** GSD planning artifacts only.
- **`.claude/`:** the local GSD and Claude Code configuration. Do not treat it as app code.

## Key File Locations

Everything is in `us-journey-tracker.html`:

| Region | Lines |
|---|---|
| `<head>`: meta, title, Google Fonts | `us-journey-tracker.html:1-9` |
| Design tokens and light/dark themes | `us-journey-tracker.html:11-37` |
| Base and shared component CSS | `us-journey-tracker.html:38-69` |
| Week view CSS | `us-journey-tracker.html:71-108` |
| Composer CSS | `us-journey-tracker.html:110-127` |
| Calendar CSS | `us-journey-tracker.html:129-161` |
| Goals CSS | `us-journey-tracker.html:163-192` |
| Timeline, toast and editor CSS | `us-journey-tracker.html:194-226` |
| Header, tabs and toolbar markup | `us-journey-tracker.html:231-250` |
| Tab sections markup | `us-journey-tracker.html:252-289` |
| Status line, toast, editor dialog | `us-journey-tracker.html:291-294` |
| Config constants | `us-journey-tracker.html:298-325` |
| State and helpers | `us-journey-tracker.html:327-354` |
| Saving, store adapters, `init()` | `us-journey-tracker.html:356-379` |
| Shared queries (`eventsOn`, `addLog`) | `us-journey-tracker.html:381-387` |
| Composer and presets | `us-journey-tracker.html:389-437` |
| Renderers | `us-journey-tracker.html:439-541` |
| Global event wiring | `us-journey-tracker.html:543-554` |
| Editor dialog logic | `us-journey-tracker.html:556-594` |
| Drag and drop, plus week/calendar/goals/filter handlers | `us-journey-tracker.html:596-637` |
| Export and import | `us-journey-tracker.html:639-658` |
| Toast, `pagehide`, bootstrap | `us-journey-tracker.html:660-665` |

## Naming Conventions

- **Files:** kebab-case (`us-journey-tracker.html`).
- **Element ids:** short camelCase (`wkPrev`, `dayPanel`, `exportCsv`). Composer-scoped ids are prefixed with the instance (`w-text`, `c-add`, `w-padd`).
- **CSS classes:** short lowercase (`.wk-head`, `.ent`, `.chip`). Category theming uses `.k-<key>`, where the key is `lang`, `pro`, `fit`, `job` or `oth`.
- **Section ids:** `tab-<key>`, where the key is `wk`, `cal`, `goal` or `tl`.

## Where to Add New Code

The project currently has no module boundaries. Until a restructure is approved:
- A new view goes in a renderer function next to the others, called from `renderAll()`.
- A new persisted field goes in the default `state` (`us-journey-tracker.html:327`) **and** in `normalize()` (`us-journey-tracker.html:347-354`). Without the second change, the field is dropped on load and import.
- A new storage backend implements the `{label, load, save}` adapter and is chosen in `init()`.
- New config goes with the constants at the top of the IIFE. **Append** new built-in tasks at the end of a group's list; never insert or reorder them (positional ids).

## Special Directories

- `.planning/codebase/`: GSD codebase map (`STACK`, `INTEGRATIONS`, `ARCHITECTURE`, `STRUCTURE`, `CONVENTIONS`, `TESTING`, `CONCERNS`).

---

*Structure analysis: 2026-11-01*
