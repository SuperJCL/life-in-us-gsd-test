# External Integrations

**Analysis Date:** 2026-11-01

## APIs & External Services

**Claude Artifact runtime (`window.claude.use`):**
The app calls three capabilities. Each is optional: `use()` resolves `null`, or `window.claude` is missing altogether, whenever the page is not running inside the claude.ai viewer.

| Capability | Where | Calls made | Contract notes (runtime 0.2.96) | When absent |
|---|---|---|---|---|
| `db` | `us-journey-tracker.html:371-373` | `db.doc("data/users/"+id+"/state")`, then `ref.get()` once at startup and `ref.set(state)` on every debounced save | `set` replaces the whole document (last writer wins, no transactions). A document can be at most **256 KiB** and 32 levels deep. `data/users/<id>/` is private to each viewer, the owner included. Errors include `invalid_argument`, `resource_exhausted`, `quota_exceeded`, `unavailable` and `revoked`. | Falls back to `localStorage` |
| `user` | `us-journey-tracker.html:371-372` | `user.id()` only, used to build the db path | `id()` resolves `null` unless the page declares `capabilities:{user:{}}`, and also when the viewer is signed out or a guest without an identity. It never rejects. | No id, so falls back to `localStorage` even when `db` exists |
| `downloads` | `us-journey-tracker.html:377-378`, `us-journey-tracker.html:652-655` | `downloads.save({filename, data})` for the CSV and JSON exports | The viewer sees a confirmation and may decline. Errors include `declined`, `rate_limited`, `rejected_extension`, `too_large`, `bad_request` and `unavailable`. `csv` and `json` are on the allowlist. | Export buttons stay hidden (`us-journey-tracker.html:246-247`), so **there is no backup path locally** |

**Capabilities the hosted artifact must have declared (inferred):** `{db:{}, user:{}, downloads:true}`. This is inferred from the code and has not been checked against the hosted manifest, which is out of scope.

**Not used:** `onSnapshot` (no live sync), `update`, collection queries, `user.profiles/isOwner/canEdit/can`, `permissions`, and every other capability.

**How the store is chosen** (`init()`, `us-journey-tracker.html:368-379`):
1. `renderAll()` with the empty default state.
2. `Promise.all([use("db"), use("user")])`. Errors are swallowed.
3. If both are present, `id = await user.id()`.
4. If `db` and `id` are both set, use the account store (label: synced to account). Otherwise use `localStore()` (label: saved in this browser, not synced).
5. `store.load()`. **If it throws, the app silently switches to `localStorage`** and loads from there.
6. `use("downloads")`. If it is non-null, the app stores it in the global `window.__dl` and reveals the export buttons.

**Google Fonts:**
- `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;800` plus `preconnect` hints (`us-journey-tracker.html:7-9`).
- Offline, the page renders with system serif fonts and works normally.

## Data Storage

**Databases:**
- **Hosted:** one Claude Artifact `db` document per viewer at `data/users/<viewerId>/state`, holding the entire app state as one JSON object.
- **Local:** `localStorage["us-journey-tracker-v1"]`, holding the same JSON object.
- Both stores go through one adapter shape: `store = {label, load(): Promise<state|null>, save(state): Promise<void>}` (`us-journey-tracker.html:365-367`, `us-journey-tracker.html:373`). This is the existing seam for a local replacement.

**State schema** (as `normalize()` checks it, `us-journey-tracker.html:347-354`; only top-level types are validated):
```text
arrival : "YYYY-MM-DD" | ""
tasks   : { [taskId]: { done?: boolean, doneDate?: "YYYY-MM-DD"|"", due?: "YYYY-MM-DD" } }
custom  : [ { id: "c-<uid>", group: "P1".."P7", text: string } ]
logs    : [ { id: "<uid>", date: "YYYY-MM-DD", text: string, cat: <category display name> } ]
lifts   : { [liftId]: { cur: number, hist: [ { date, v } ] (last 30) } }
reviews : { [mondayYmd]: string }
presets : { [categoryName]: { add: string[], hide: string[] } }
```
- Built-in task ids are **positional**: `P<group>-<index+1>` (`us-journey-tracker.html:317`). See `CONCERNS.md`.
- Category values in `logs[].cat` are Chinese display names (语言 language, 专业 CS/professional, 健身 fitness, 求职 job search, 其他 other), not stable keys.

**File Storage:**
- **Export (hosted only):** `在美国的日子-日历.csv`, with columns `Subject, Start Date, All Day Event, Description` for Google Calendar or Outlook import (`us-journey-tracker.html:642-650`), and `在美国的日子-备份-<date>.json`, a pretty-printed copy of the full state (`us-journey-tracker.html:651`).
- **Import (always visible):** a `.json` file read with `FileReader`, passed through `normalize()`, confirmed with `confirm()`, and then replaces the entire state (`us-journey-tracker.html:656-658`).

**Caching:**
- None beyond `localStorage`.

## Authentication & Identity

**Auth Provider:**
- Only the Claude Artifact viewer's own identity, through `user.id()`. The app has no login.
- Locally there is no identity: a single user per browser origin.

## Monitoring & Observability

**Error Tracking:**
- None. Save errors go to the status line (`setStatus`, `us-journey-tracker.html:361`). Other errors show a toast or are swallowed.

**Logs:**
- None (no `console` usage).

## CI/CD & Deployment

**Hosting:**
- Original: a published Claude Artifact, which is **out of scope**: do not touch, republish or deploy.
- Local test project: the file on disk only.

**CI Pipeline:**
- None.

## Environment Configuration

**Required env vars:**
- None.

**Secrets location:**
- None. The code contains no keys, tokens or endpoints besides Google Fonts.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

**Lifecycle hook:**
- `window.addEventListener("pagehide", flush)` (`us-journey-tracker.html:664`). It saves `localStorage` reliably, because that write is synchronous. A `db` write started here may not finish before the page unloads.

---

*Integration audit: 2026-11-01*
