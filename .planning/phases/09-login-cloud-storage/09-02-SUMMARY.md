---
phase: 09-login-cloud-storage
plan: 02
subsystem: infra
tags: [same-origin, fonts, sri, playwright-guard, probes, privacy]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 cloud switch, loadSdk with pinned SRI, login page, AppHarness cloud options
  - phase: 08-rules-isolation-fake-server
    provides: cloud guard policy, FONT_HOSTS, same-origin SDK pinned by sha256
provides:
  - app file with no external link (no Google Fonts links, no preconnect, serif falls back to Songti SC, STSong, Georgia)
  - cloud guard policy that records font hosts as violations (v1 keeps the font branch)
  - tests/cloud/same-origin.spec.ts with three INFRA-03 cases (same-origin requests, SDK SRI, tampered SDK contrast)
  - rewritten SAFE-01, SAFE-04 and PROBE-2c that still prove their original intent
affects: [09-05, 09-12, phase-10, phase-13]

actuals:
  tokens: 9825
  tasks: 2
  commits: 2
plan_head_before: 91e04bcffe85e6c043fefcb69ca70265bdebc21d
plan_head_after: 7427f15ca5d15c03866fcc14aac8584b13a4caa6

tech-stack:
  added: []
  patterns:
    - "guard policy split: cloud treats every non-app origin as a violation; v1 keeps the font branch as a self-proved expected-abort path"
    - "deliberately refused SDK: open({ sdkRefused: true }) makes ready() wait for the login page only"

key-files:
  created:
    - tests/cloud/same-origin.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/test.ts
    - tests/support/app.ts
    - tests/cloud/guard-cloud.spec.ts
    - tests/e2e/platform/guardrails.spec.ts
    - tests/e2e/platform/probes.spec.ts
    - tests/PROBES.md
    - tests/README.md

key-decisions:
  - "Font removal is final: no Google Fonts link and no preconnect in the app; serif headings fall back to Songti SC, STSong, Georgia (owner already accepted the look)."
  - "cloud policy returns violation for FONT_HOSTS; FONT_HOSTS constant and the console-noise filter stay, because the v1 policy and the rewritten SAFE-01 and SAFE-04 still use the font branch."
  - "Guard rewrites tighten rather than loosen: SAFE-01 now also asserts nothing external is requested on open; SAFE-04 makes its own font noise; PROBE-2c asserts zero font-host connections instead of only recording them."

patterns-established:
  - "Self-proving an expected-abort branch: the page fetches a synthetic path under the font host and the case asserts exactly one expectedAborts entry and no violations"
  - "A console.error whose source is the aborted font host lands in filteredConsoleNoise, not consoleErrors (unlike example.com aborts)"

requirements-completed: [INFRA-03]

coverage:
  - id: D1
    description: "The app file has no Google Fonts links, preconnect or external src/href, and the serif stack no longer names Noto Serif SC"
    requirement: INFRA-03
    verification:
      - kind: e2e
        ref: "tests/cloud/same-origin.spec.ts#INFRA-03 the page loads the pinned SDK from its own origin with a subresource integrity hash"
        status: pass
      - kind: other
        ref: "Task 1 verify: grep counts fonts.g=0, (src|href)=https?:=0, Noto Serif SC=0, new serif stack=1, APP_SHA256 matches"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cloud page requests only its own origin while signing in, loading and saving; the guard records no expected aborts and no violations"
    requirement: INFRA-03
    verification:
      - kind: e2e
        ref: "tests/cloud/same-origin.spec.ts#INFRA-03 the cloud page requests only its own origin while signing in, loading and saving"
        status: pass
    human_judgment: false
  - id: D3
    description: "Exactly one same-origin SDK script whose integrity equals the pinned sha256"
    requirement: INFRA-03
    verification:
      - kind: e2e
        ref: "tests/cloud/same-origin.spec.ts#INFRA-03 the page loads the pinned SDK from its own origin with a subresource integrity hash"
        status: pass
    human_judgment: false
  - id: D4
    description: "A tampered SDK is refused: login page with the unreachable message, no local state key, no window.PocketBase, no request to another origin"
    requirement: INFRA-03
    verification:
      - kind: e2e
        ref: "tests/cloud/same-origin.spec.ts#INFRA-03 a tampered SDK is refused by the integrity check and the app never falls back to another origin or to local storage"
        status: pass
    human_judgment: false
  - id: D5
    description: "cloud classifyRequest returns violation for font hosts while v1 still returns font"
    requirement: INFRA-03
    verification:
      - kind: e2e
        ref: "tests/cloud/guard-cloud.spec.ts#TEST-02 classifyRequest allows only the app page, the app file and the SDK under the cloud policy"
        status: pass
    human_judgment: false
  - id: D6
    description: "Rewritten SAFE-01, SAFE-04 and PROBE-2c still prove their intent (font branch, noise filter, proxy delivery plus zero font-host connections); SAFE-02 baseline updated"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/guardrails.spec.ts#SAFE-01 opening the app requests no font host and no external host; #SAFE-04 console.error is reported while aborted-font noise is filtered; tests/e2e/platform/probes.spec.ts#PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy and the app opens no font-host connection; app-integrity#SAFE-02"
        status: pass
    human_judgment: false
  - id: D7
    description: "Serif headings and numbers look acceptable with the system fallback fonts on real devices"
    verification: []
    human_judgment: true
    rationale: "No test asserts typography; the owner already accepted the fallback look when deciding to drop the Google font."
  - id: D8
    description: "Full test:cloud suite: 51 cases pass, 0 flaky"
    verification:
      - kind: other
        ref: "npm run test:cloud (below-normal priority, 1 worker): REPORT OK expected=51 flaky=0 unexpected=0"
        status: pass
    human_judgment: false

duration: "~6 min (start 2026-11-09T08:22:58Z, end 08:29Z)"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 02: Same-Origin Only Summary

**The app no longer loads Google Fonts or any external resource; the cloud guard treats font hosts as violations, the SDK is pinned by SRI and a tampered copy leaves the app on the login page, and SAFE-01, SAFE-04 and PROBE-2c were rewritten to stay at least as strict.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-11-09T08:22:58Z
- **Completed:** ~2026-11-09T08:29Z
- **Tasks:** 2
- **Files modified:** 10 (1 created, 9 modified)

## Accomplishments

- Removed the two preconnect links and the Google Fonts stylesheet link from `us-journey-tracker.html`; `--serif` is now `"Songti SC","STSong",Georgia,serif`. `APP_SHA256` updated in the same commit.
- `classifyRequest` returns `violation` for `FONT_HOSTS` under the cloud policy; v1 keeps `font`. The attachGuard comment no longer claims the app has preconnect.
- New `tests/cloud/same-origin.spec.ts` (3 cases): every request is same-origin and limited to `/`, the SDK path and `/api/`; exactly one SDK script with the pinned integrity, plus a static read of the app file; tampered SDK refused with the integrity error, login page and `连不上服务器，请检查网络后重试`, no local state key, no `window.PocketBase`, no foreign request.
- Rewritten guards (titles and reasons below). PROBES.md and README no longer describe an app preconnect and list the new cloud specs and the `backend: null` and `sdkRefused` notes.
- Full `npm run test:cloud`: 51 passed (44 from Phase 8, 4 from 09-01, 3 here), 0 flaky.

## Renamed or rewritten guards (T-09-07)

| Before | After | Why it is not a loosening |
|--------|-------|---------------------------|
| `SAFE-01 opening the app only aborts the allowlisted font hosts` | `SAFE-01 opening the app requests no font host and no external host` | Asserts `expectedAborts` and `unexpectedRequests` are both empty on open, then the page fetches a synthetic path under the font host and the case requires exactly that one `expectedAborts` entry and no violation, so the font branch is still proven live |
| `SAFE-04 console.error is reported while aborted-font noise is filtered` (title kept) | same title | The case now inserts its own font stylesheet link, so the noise filter is still exercised; remaining assertions unchanged |
| `PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy (preconnect not observed on this Edge)` | `PROBE-2 WebSocket traffic that route cannot see is delivered to the proxy and the app opens no font-host connection` | The WebSocket proxy-delivery assertion is kept; font-host CONNECT lines went from record-only to asserted zero (`fontHostObserved === false`, no font lines), an INFRA-03 regression check |

## Task Commits

1. **Task 1: tracer (fonts removed, cloud guard, SAFE rewrites, same-origin specs)** - `2208417` (feat)
2. **Task 2: PROBE-2c, PROBES.md and README closeout, full test:cloud** - `7427f15` (test)

**Plan metadata:** committed after this summary (docs: complete plan)

## Files Created/Modified

- `us-journey-tracker.html` - three head links removed, serif fallback stack
- `tests/support/constants.ts` - `APP_SHA256`
- `tests/support/test.ts` - cloud policy font hosts are violations; comment wording
- `tests/support/app.ts` - `open({ sdkRefused })` (see deviation)
- `tests/cloud/guard-cloud.spec.ts` - cloud font host expectation is `violation`
- `tests/cloud/same-origin.spec.ts` - new, 3 INFRA-03 cases
- `tests/e2e/platform/guardrails.spec.ts` - SAFE-01 and SAFE-04 rewrites
- `tests/e2e/platform/probes.spec.ts`, `tests/PROBES.md`, `tests/README.md` - PROBE-2c and wording

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

**1. [Rule 3 - Blocking] AppHarness could not open a page whose SDK is refused on purpose**
- **Found during:** Task 1 (tampered SDK case)
- **Issue:** `AppHarness.ready()` for the login view waits for `typeof window.PocketBase === 'function'`; with a tampered SDK it never becomes true, so `app.open` would hang until timeout. `tests/support/app.ts` was not in the plan's file list.
- **Fix:** Added an optional `sdkRefused` open option; when set, the login-view ready check waits for `#login` only. Default behavior is unchanged.
- **Files modified:** `tests/support/app.ts`
- **Commit:** `2208417`

**2. [Rule 1 - Bug] SAFE-01 console.error expectation was wrong for a font-host fetch**
- **Found during:** Task 1 (first run of the rewritten SAFE-01 failed twice with 0 consoleErrors)
- **Issue:** The plan expected the aborted font-host fetch to leave one `ERR_BLOCKED_BY_CLIENT` console.error in `consoleErrors` to be removed with `guard.remove`. Unlike the example.com fetch, the message's source is the font host itself, so the guard's noise filter correctly moves it to `filteredConsoleNoise`.
- **Fix:** The case now waits for exactly one `filteredConsoleNoise` entry containing `ERR_BLOCKED_BY_CLIENT` and asserts `consoleErrors` is empty. This is stricter (it also proves the noise filter) and needs no `guard.remove`.
- **Files modified:** `tests/e2e/platform/guardrails.spec.ts`
- **Commit:** `2208417`

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1). **Impact:** no scope change; both are test-support details inside the plan's intent.

## Issues Encountered

None beyond the two deviations. Note for the next phase run: Playwright working copies of several test files are CRLF (git normalizes to LF), so scripted edits should preserve line endings.

## Known Stubs

None.

## Threat Flags

None. The change removes external surface (T-09-06); T-09-07 mitigated as listed above; T-09-SC accepted (no installs or downloads). The privacy check passed on both staged commits. No pocketbase process was started.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- INFRA-03 is closed by this plan (proof: the three `same-origin.spec.ts` cases plus the full 51-case test:cloud run). TEST-02 is not marked complete.
- The default `npm test` full run is left to the phase regression gate (expected 175 cases; two titles changed, count unchanged).
- Ready for 09-03 and the later plans in the wave order.

## Self-Check: PASSED

- Created file exists: `tests/cloud/same-origin.spec.ts`.
- Commits `2208417` and `7427f15` are ancestors of HEAD; `commits: 2` measured from ledger base `91e04bc`.
- Task verify commands: all REPORT OK (10 + 23 + 10 + 51 cases), privacy check passed on both staged sets, no pocketbase process running.

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
