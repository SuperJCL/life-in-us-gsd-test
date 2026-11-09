---
phase: 09-login-cloud-storage
plan: 03
subsystem: testing
tags: [fake-pocketbase, fault-injection, playwright, console-error, test-infrastructure]

requires:
  - phase: 09-login-cloud-storage
    provides: 09-01 cloud harness (submitLogin, login page ids), 09-02 same-origin guard policy
  - phase: 08-rules-isolation-fake-server
    provides: FakePbServer, attach() route, handle() pure function, pb-contract.spec.ts
provides:
  - fault switches on FakePbServer (refuse, status, hold, times, clearFaults)
  - revokeTokens, beforeNext, dropDocs, docId, isAttached, faultHits
  - acknowledgeConsoleErrors shared helper
  - PB-CONTRACT.md section 10 (switches are not recorded contract)
affects: [09-05, 09-06, 09-07, 09-08, 09-09, 09-10, 09-11, 09-12, phase-10]

actuals:
  tokens: 8000
  tasks: 2
  commits: 2
plan_head_before: 9e210ae50e976189dbf092c4620ca0446c9bfadc
plan_head_after: 4fe8601e46a1534545d3bd96d099199134a4f0ba

tech-stack:
  added: []
  patterns:
    - "fault rules are matched in attach()'s route handler before handle(); handle() and request() stay pure and untouched"
    - "hold parks the request on a gate promise; release()/clearFaults() open it and await its completion promise, no timers"
    - "acknowledgeConsoleErrors: poll for the exact total, assert each fragment count, then guard.remove"

key-files:
  created:
    - tests/support/guard-ack.ts
    - tests/cloud/pb-faults.spec.ts
  modified:
    - tests/mocks/pb-server.ts
    - tests/mocks/PB-CONTRACT.md

key-decisions:
  - "release() on a hold rule also deactivates it (later requests are not held); on refuse and status rules it is a no-op. remove() leaves already-parked requests parked, as the plan states."
  - "hold records status 0 in faultHits (no injected status; the released response comes from handle()), same as refuse."
  - "beforeNext is not consumed by a request that a fault switch intercepts; it runs inside the same serve() path after a hold is released."
  - "A sixth self-test (times-less rule, regex path, remove, isAttached) was added so every public switch has a case; the plan listed five."

patterns-established:
  - "Injected failures are acknowledged by exact fragment and count: 'status of 429 ' style for HTTP codes, ERR_CONNECTION_REFUSED for refused connections"
  - "serve(route, request, url) is the ordinary page-request path (hook, handle, fulfill, deliver); the route handler only decides fault vs serve"

requirements-completed: []

coverage:
  - id: D1
    description: "A refuse switch opened by a case fails the real SDK login at the network layer, the login page shows the connection message and no token is stored"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 the refuse switch fails a page request at the network layer and the app shows the connection message"
        status: pass
    human_judgment: false
  - id: D2
    description: "status switch answers with an injected code and PocketBase-shaped body (429, 503) and expires after times"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 the status switch answers once with the injected status and a PocketBase-shaped error body"
        status: pass
    human_judgment: false
  - id: D3
    description: "hold keeps a request pending until release() or clearFaults(); the released response comes from handle()"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 the hold switch keeps a request pending until it is released"
        status: pass
    human_judgment: false
  - id: D4
    description: "revokeTokens makes auth-refresh 401 and record routes anonymous; re-login gives a new token and the documents again"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 revoking the tokens of an account makes auth-refresh answer 401 and record routes treat the token as anonymous"
        status: pass
    human_judgment: false
  - id: D5
    description: "beforeNext lets another actor create the document first (real unique-index 400), dropDocs deletes like a superuser, client delete stays 403"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-faults.spec.ts#TEST-02 the before-next hook and dropping documents let another actor change the server first"
        status: pass
    human_judgment: false
  - id: D6
    description: "Contract self-tests (29 cases) still pass unchanged; injected codes are not recorded as contract"
    verification:
      - kind: e2e
        ref: "tests/cloud/pb-contract.spec.ts (29 passed in both task runs, REPORT OK expected=35)"
        status: pass
    human_judgment: false

duration: "~7 min"
completed: 2026-11-09
status: complete
---

# Phase 9 Plan 03: Fault Injection Switches Summary

**FakePbServer now has explicit, timer-free error switches (refuse, status, hold, times, clearFaults, revokeTokens, beforeNext, dropDocs plus docId, isAttached, faultHits), each with a self-test, and PB-CONTRACT.md section 10 states they are test scaffolding, not recorded contract.**

## Performance

- **Duration:** ~7 min (2026-11-09T08:31:44Z to 08:38:16Z, plus state close-out)
- **Tasks:** 2
- **Files:** 4 (2 created, 2 modified); the app and `APP_SHA256` are untouched

## Accomplishments

- Tracer: `fault({ mode: 'refuse' })` opened by a case, intercepted in `attach()`'s route handler before `handle()`, aborted with `connectionrefused`; the real SDK inside the page fails and the app login page shows `连不上服务器，请检查网络后重试` with no `pocketbase_auth` left in localStorage.
- `acknowledgeConsoleErrors(guard, expected)` in `tests/support/guard-ack.ts` generalises the 4xx helper from cloud-harness.spec to any exact fragment and count.
- Remaining switches and six self-test cases in `tests/cloud/pb-faults.spec.ts`; `handle()` stayed a pure function and `pb-contract.spec.ts` (29 cases) passes unchanged.
- `PB-CONTRACT.md` section 4 now points to section 10 for network failure, 5xx and hang; section 10 lists each switch with its basis and says injected codes are never deviations.

## Switch interfaces

| Switch | Interface | Notes |
|---|---|---|
| refuse | `fault({ method, path: string \| RegExp, mode: 'refuse', times? }): PbFaultHandle` | `route.abort('connectionrefused')`; not in `requests`; `faultHits` status 0 |
| status | `fault({ ..., mode: 'status', status, times? })` | `route.fulfill` with `{ status, message, data: {} }`; message `Too Many Requests.` for 429, `Something went wrong while processing your request.` for 5xx, `Injected failure.` otherwise |
| hold | `fault({ ..., mode: 'hold' })` | parks the request; `handle.release()` (also stops holding) or `clearFaults()`; promise resolves after parked requests finish |
| times | field on `PbFault` | auto-expires after N hits; absent means unlimited |
| handle | `{ hits, release(), remove() }` | `remove()` does not free parked requests |
| `clearFaults()` | `Promise<void>` | removes every rule, opens every gate, awaits completion |
| `revokeTokens(userIndex)` | `void` | deletes that account's token-table entries only (TOK-2, D5-1) |
| `beforeNext(method, path, fn)` | `void` | one-shot, runs before `handle()` for the next matching request; response still from `handle()` |
| `dropDocs(userIndex, kind?)` | `void` | same as superuser delete; client delete is still 403 |
| `docId(userIndex, kind)` / `isAttached(context)` / `faultHits` | read-only | |

## Observed console.error text (Chromium, measured)

One per intentional failure, nothing else:

- refuse: `Failed to load resource: net::ERR_CONNECTION_REFUSED` (1 per refused request)
- 429: `Failed to load resource: the server responded with a status of 429 (Too Many Requests)`
- 503: `... status of 503 (Service Unavailable)`
- 401: `... status of 401 (Unauthorized)`
- 400: `... status of 400 (Bad Request)`
- 403 (client delete): same shape with `status of 403 `

Fragments used in assertions: `ERR_CONNECTION_REFUSED`, `status of 429 `, `status of 503 `, `status of 401 `, `status of 400 `, `status of 403 ` (trailing space included).

## Task Commits

1. **Task 1: tracer, refuse switch, console.error helper** - `da102d1` (test)
2. **Task 2: remaining switches, self-tests, contract section 10** - `4fe8601` (test)

## Files Created/Modified

- `tests/mocks/pb-server.ts` - fault rules, `serve()` split out of the route handler, new public methods and types
- `tests/support/guard-ack.ts` - `acknowledgeConsoleErrors`
- `tests/cloud/pb-faults.spec.ts` - six switch self-tests
- `tests/mocks/PB-CONTRACT.md` - section 4 line, new section 10

## Decisions Made

See `key-decisions`: release() semantics, hold status 0, beforeNext not consumed by intercepted requests, sixth case.

## Deviations from Plan

None - plan executed exactly as written. (One additive item, not a deviation: a sixth self-test covering a times-less regex-path rule, `remove()` and `isAttached`, so every public switch has a case.)

## Issues Encountered

None. Both verify commands passed on the first run, 35 passed, 0 flaky. Line endings were preserved: `pb-server.ts` and `PB-CONTRACT.md` stay CRLF in the working tree; the two new files are LF like the other cloud specs.

## Known Stubs

None.

## Threat Flags

None. No new network surface; all switches live in test code. T-09-08 mitigated (section 10 marks each switch as unrecorded, no `INTENTIONAL_DEVIATIONS` entry, `handle()` unchanged); T-09-09 mitigated (no token or password in code, `revokeTokens` prints nothing, privacy check passed on both staged sets).

## Authentication Gates

None.

## User Setup Required

None.

## Next Phase Readiness

- Ready for 09-04 (full `test:cloud` runs there; this plan ran only the two specs).
- No requirement is marked complete here (frontmatter `requirements` is empty); TEST-02 stays open.
- No pocketbase process was started.

## Self-Check: PASSED

- Created files exist: `tests/support/guard-ack.ts`, `tests/cloud/pb-faults.spec.ts`.
- Commits `da102d1` and `4fe8601` are ancestors of HEAD; `commits: 2` measured from the ledger base `9e210ae`.
- Task verify commands re-run in full: REPORT OK expected=35 flaky=0 unexpected=0; privacy check passed on both staged sets.

---
*Phase: 09-login-cloud-storage*
*Completed: 2026-11-09*
