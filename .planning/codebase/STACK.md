# Technology Stack

**Analysis Date:** 2026-11-01

## Languages

**Primary:**
- HTML5 + CSS3 + JavaScript (ES2019 baseline: `Object.fromEntries`, `async`/`await`, template literals, spread). All three are inline in the single file `us-journey-tracker.html`:
  - CSS: `us-journey-tracker.html:10-227`
  - Markup: `us-journey-tracker.html:229-294`
  - Script (one IIFE): `us-journey-tracker.html:296-667`

**Secondary:**
- None.

**UI language:** Simplified Chinese (`<html lang="zh-CN">`). Every string is hard-coded inline in markup and template literals. There is no i18n layer.

## Runtime

**Environment:**
- A modern evergreen browser. The app needs `<dialog>`/`showModal()`, `localStorage`, `FileReader`, HTML5 drag and drop, `confirm()`, and the CSS features `env(safe-area-inset-*)`, `clamp()` and `color-scheme`.
- **Original host:** the claude.ai Artifact viewer (a framed page). There, `window.claude.use(name)` exists before the script runs. This analysis checked the calls against the platform's runtime contract 0.2.96 type definitions.
- **Local:** open the file directly or serve it from any static file server. There is no server-side code.

**Package Manager:**
- None. There is no `package.json`, lockfile or `node_modules`.

## Frameworks

**Core:**
- None. The app uses plain DOM APIs and renders by assigning template-literal strings to `innerHTML`.

**Testing:**
- None (see `TESTING.md`).

**Build/Dev:**
- None. There is no bundler, transpiler, linter or formatter.

## Key Dependencies

**Critical:**
- **Claude Artifact runtime capabilities** `db`, `user` and `downloads`, reached through `window.claude.use(name)`. All three are optional at runtime, and the app falls back when they are absent (see `INTEGRATIONS.md`).
- **Browser `localStorage`**, key `us-journey-tracker-v1`. This is the fallback persistence and the only persistence when the app runs locally (`us-journey-tracker.html:365-367`).

**Infrastructure:**
- **Google Fonts CSS** for `Noto Serif SC` weights 600/800 (`us-journey-tracker.html:7-9`). It is used only for headings and numbers, and falls back to the system fonts `Songti SC`, `STSong` and Georgia.

## Configuration

**Environment:**
- No environment variables and no config files.
- All configuration lives in script constants:
  - `CATS`: 5 categories with quick-entry preset tags (`us-journey-tracker.html:298-304`)
  - `LEGACY`: map from an older category scheme to the current one (`us-journey-tracker.html:307`)
  - `GROUPS`: built-in goal groups P1–P7 with task lists, which are personal plan content (`us-journey-tracker.html:308-316`)
  - `LIFTS`: four strength targets (`us-journey-tracker.html:319-324`)
  - `FIT_GOAL`: training days per week, `[3,5]` (`us-journey-tracker.html:325`)

**Build:**
- None.

## Platform Requirements

**Development:**
- Any OS with a modern browser.
- Optionally a static server (Node or Python) so the page has a stable `http://localhost:<port>` origin. `localStorage` is scoped per origin, and `file://` origin behaviour differs between browsers.

**Production:**
- The original deployment is a published Claude Artifact. That is **out of scope for this project**: do not modify, republish or read its data.
- This local test project runs the single HTML file in a local browser only.

---

*Stack analysis: 2026-11-01*
*Update after major dependency changes*
