# Coding Conventions

**Analysis Date:** 2026-11-01

## Naming Patterns

**Functions:**
- Short helpers of one to five characters: `$` (getElementById), `pad`, `ymd`, `parse`, `md`, `esc`, `uid`, `kOf`, `lift`, `tstate` (`us-journey-tracker.html:329-346`).
- Renderers are named `render<View>` (`renderWeek`, `renderCal`, `renderDay`, `renderGoals`, `renderTimeline`, `renderAll`).
- Actions use a plain verb: `addLog`, `deleteLog`, `addTask`, `saveLift`, `openEditor`, `openTaskEditor`, `persist`, `flush`.

**Variables:**
- Terse names: `wk` (Monday of the visible week), `wsel` (selected day in the week view), `sel` (selected day in the calendar), `view` (calendar month cursor), `dl`, `rvT`, `tt`.
- Constants are UPPER_CASE: `CATS`, `GROUPS`, `LIFTS`, `BUILTIN`, `LEGACY`, `FIT_GOAL`, `WD`, `CK`, `GCAT`.

**Data keys:**
- Short object keys in config: `n` (name), `k` (key), `p` (priority id), `def`, `cur`, `hist`.
- Persisted category values are **Chinese display names**, not keys.

## Code Style

- Dense, near-minified JavaScript: several statements per line and lines of 200+ characters. Indentation is one space at the top level of the IIFE.
- Semicolons are used throughout. Strings mostly use double quotes. HTML is built with template literals.
- `const` and arrow functions are preferred. `let` is used for mutable module state. There are no classes.
- CSS is compact too: one rule per line, custom properties for every color, and per-category variables `--c`/`--s` set by `.k-*` classes.

## Import Organization

- None. There are no modules. The only external resource is the Google Fonts `<link>`.

## Error Handling

- `try { … } catch (e) {}` around anything optional (capability resolution, `localStorage`, `dataTransfer`).
- The user sees errors as a `toast(message)` or in the status line through `setStatus`.
- Destructive actions offer **undo** through a toast action, for example deleting a log or a preset tag (`us-journey-tracker.html:548-549`, `us-journey-tracker.html:427`).
- Replacing all data on import asks first with a native `confirm()`.

## Logging

- None. The code makes no `console.*` calls.

## Comments

- Section banners only, in the form `/* ---------- saving ---------- */` and `// week`. There are no doc comments or inline explanations.

## Function Design

- Renderers return nothing and write to `innerHTML` of fixed container ids.
- `composer(p, date)` returns an HTML string. `bindComposer(root, p, getDate)` wires it up after insertion.
- Handlers mutate `state`, then call `persist()` and then `renderAll()` (or a narrower renderer) in that order.
- User text is passed through `esc()` before it enters markup.

## Module Design

- One IIFE closure. Nothing is exported, and nothing touches `window` apart from `window.__dl`.
- Accessibility attributes are written inline in the templates (`role`, `aria-label`, `aria-pressed`, `aria-selected`, `tabindex="0"` on clickable non-buttons, plus Enter/Space handlers).

---

*Convention analysis: 2026-11-01*
