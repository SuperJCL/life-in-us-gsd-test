---
phase: 08-pocketbase-rules-isolation-fake-server
plan: 03
subsystem: testing
tags: [playwright, guard, classifyRequest, cloud-policy, setOffline, probe-9, wr-05]

requires:
  - phase: 08-pocketbase-rules-isolation-fake-server
    provides: 08-02 的 cloud 入口、FakePbServer（未实现的 /api 路径 route.fallback()）、AppHarness 的 cloud 模式
provides:
  - "tests/support/test.ts：classifyRequest、guardPolicy、attachGuard、V1_APP_PATHS、CLOUD_APP_PATHS"
  - "cloud 策略：应用来源下只放行 /、/us-journey-tracker.html、/vendor/pocketbase.iife.js；假服务器没接住的 /api/* 记为违规"
  - "v1 策略补上 WR-05：应用来源下只放行 / 和 /us-journey-tracker.html"
  - "tests/cloud/guard-cloud.spec.ts：单元断言加四种 cloud 故意违规自检"
  - "tests/cloud/probes-cloud.spec.ts：PROBE-9a、9b、9c；结论写进 tests/PROBES.md"
affects: [08-07, phase-09, phase-10, phase-13]

plan_head_before: 13b88a2d93f8903ee9d5fa06033f0f4b1657294d
plan_head_after: 8cce44c5e560b9289eb4f0c5af2343aff4f60d71

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 3
  confidence: low
actuals:
  tokens: 9400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "护栏分类是纯函数 classifyRequest(url, policy)，route 处理函数和单元断言共用；策略由 USJ_TEST_MODE 决定"
    - "attachGuard(context, state, policy, firstPage) 可用于任何 context，第二台“设备”复用同一套策略（给 Phase 10）"
    - "假服务器后注册先匹配，没接住的 /api 经 route.fallback() 落回护栏记违规"

key-files:
  created:
    - tests/cloud/guard-cloud.spec.ts
    - tests/cloud/probes-cloud.spec.ts
  modified:
    - tests/support/test.ts
    - tests/e2e/platform/guardrails.spec.ts
    - tests/PROBES.md
    - tests/README.md

key-decisions:
  - "guardPolicy 用剩余参数区分“没传”和“传了 undefined”：没传读 USJ_TEST_MODE，显式 undefined 表示没设置"
  - "没有加 BROWSER_AUTO_PATHS：收紧后 /favicon.ico 没有被报违规"
  - "PROBE-9 的断言写死为观察值，不依赖 setOffline 的其他用例"

patterns-established:
  - "故意违规自检：先 poll 到恰好是预期的那几条，再 guard.remove；被 abort 的请求产生的 console.error 也按条数和原文核对后删除"

requirements-completed: []

coverage:
  - id: D1
    description: "cloud 护栏：classifyRequest 两档白名单，四种故意违规都被报告（假服务器不认识的 /api、外部主机、应用来源非白名单路径、真实 EventSource）"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/guard-cloud.spec.ts 的 3 条 TEST-02 用例（cloud 子集 REPORT OK expected=11，含 08-02 的 8 条）"
        status: pass
    human_judgment: false
  - id: D2
    description: "PROBE-9：setOffline 改 navigator.onLine 并各派发一次 offline、online；route 接住的 fetch 和假 EventSource 不受影响"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/probes-cloud.spec.ts 的 PROBE-9a、9b、9c（与 guard-cloud 一起 REPORT OK expected=6，连跑两次稳定）"
        status: pass
    human_judgment: false
  - id: D3
    description: "v1 护栏补上 WR-05，默认完整套件 175 条全过，154 条 v1.0 用例和 8 条已知 bug 标记照旧"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "npm test -- --workers=1（REPORT OK expected=175 flaky=0 unexpected=0）"
        status: pass
    human_judgment: false

duration: 约 45min
completed: 2026-11-08
status: complete
---

# Phase 8 Plan 03: cloud 护栏、PROBE-9 与 v1 护栏收紧 Summary

**护栏抽成纯函数 `classifyRequest` 加 `attachGuard`，cloud 配置下只许假服务器（四种故意违规自检都会报警），v1 补上应用来源路径白名单（WR-05）；PROBE-9 证明 `setOffline` 会改 `navigator.onLine` 和事件，但管不到 route 接住的请求和假 EventSource。**

## Performance

- **Duration:** 约 45 分钟
- **Tasks:** 3（1 个 tracer，2 个 auto）
- **Files:** 新建 2 个，修改 4 个
- **Commits:** 3（measured：`git rev-list --count 13b88a2..HEAD`）

## Accomplishments

- tracer 一次打通：`USJ_TEST_MODE=cloud` → `guardPolicy()` → `attachGuard` 里的 `classifyRequest` → 假服务器 `route.fallback()` 回来的 `/api/collections/nope/records` 被记违规。用例同时断言 `app.fake.requests` 里没有这条请求（假服务器放手、护栏接住）。
- 四种 cloud 故意违规都被报告，且只删掉自己制造的那几条：假服务器不认识的 `/api` 路径、外部主机、应用来源的 `/package.json`、真实 `EventSource('/api/realtime')`。
- v1 策略收紧：应用来源下只放行 `/` 和 `/us-journey-tracker.html`，新增 `SAFE-01 a fetch to a non-allowlisted path on the app origin is reported as a guard violation`。
- 默认完整套件（本计划唯一一次）175 条 expected、0 flaky、0 unexpected（173 条基线加 08-02 的 ENV-03 反向对照加本计划的 SAFE-01），其中 v1.0 交付时的 154 条 v1 用例和 8 条已知 bug 标记照旧通过；`playwright.config.ts` blob 与应用文件 sha256 都没变。

## 运行条数

| 运行 | 范围 | 结果 |
|------|------|------|
| Task 1 cloud | guard-cloud 加 cloud-harness | REPORT OK expected=11 |
| Task 1 v1 子集 | guardrails、smoke、environment | REPORT OK expected=14 |
| Task 2 cloud 子集 | guard-cloud 加 probes-cloud | REPORT OK expected=6，连跑两次稳定 |
| Task 3 cloud | guard-cloud | REPORT OK expected=3 |
| Task 3 默认完整套件 | `npm test -- --workers=1` | REPORT OK expected=175，flaky=0 |

没有跑完整的 `test:cloud`（留给 08-07 收尾）。全部以低优先级、单 worker 运行，没有并发。

## PROBE-9 的观察值与给 Phase 10 的结论

观察值先记进 `probe` annotation，看清后写死断言，连跑两次稳定。

| 探针 | 观察值 |
|------|--------|
| 9a | 初始 `onLine` true、online 0、offline 0；`setOffline(true)` 后 `onLine` false、offline 1、online 0；`setOffline(false)` 后 `onLine` true、online 1、offline 1 |
| 9b | 离线时对 `/api/collections/journey_docs/records` 的同源 fetch 是 `resolved:200`，假服务器收到了请求，没有 console.error 和违规记录 |
| 9c | 离线时 Node 侧更新自己账号的文档，页面订阅收到恰好 1 条 `update`，投递错误为空 |

给 Phase 10 的结论（已写进 tests/PROBES.md 的 `## PROBE-9`）：

- `setOffline` 会真实改 `navigator.onLine` 并各派发一次 offline、online 事件，依赖浏览器在线状态的应用分支可以用它触发。
- 但它管不到 route 接住的请求（9b），也管不到假 EventSource（9c）。所以请求失败、5xx、SSE 断开要由假服务器自己的开关显式制造，不能指望 `setOffline`。
- 结论只对本机 Edge 156 和 Playwright 1.64.1 成立，版本变化要重跑。

Phase 8 的其他用例里没有使用 `setOffline`。

## favicon

没有观察到 `/favicon.ico` 违规：收紧后的 cloud 子集运行和默认完整套件（175 条）里，无界面 Edge 都没有自动请求它，teardown 的 guard 没有报任何违规。因此没有加 `BROWSER_AUTO_PATHS`，白名单里没有任何额外条目。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] guardPolicy 的默认参数让“传 undefined”的单元断言在 cloud 配置下失败**
- **Found during:** Task 1（cloud 运行里 `guardPolicy(undefined)` 返回了 cloud）
- **Issue:** 计划的签名 `env = process.env.USJ_TEST_MODE` 里，显式传入 `undefined` 会被默认值顶替成 cloud 配置下的环境变量，而用例要求 `guardPolicy(undefined)` 为 v1（与 08-02 里 `resolveHarnessMode` 同一个坑）。
- **Fix:** 用剩余参数 `...args: [env?: string | undefined]` 区分“没传”和“传了 undefined”：没传读 `USJ_TEST_MODE`，所以 guard fixture 里的 `guardPolicy()`（计划验证里按字面核对）不变。
- **Files modified:** tests/support/test.ts
- **Commit:** 67c5f79

**2. [说明] 三条 cloud 自检的 console.error 观察值**
- 真实 EventSource、外部主机、`/package.json` 三条被 abort 的请求各写一条 `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector`（原文三条相同），用例按 `toEqual` 核对条数和原文后再删除。真实 EventSource 的 `onerror` 触发，结果为 `error`。

## Known Stubs

None。

## Threat Flags

None。本计划只收紧护栏和加探针，没有新增网络端点或信任边界；暂存后的隐私检查三次都通过，没有加放行名单。

## 需求状态

TEST-02 在 Phase 8 只完成基础部分（入口、同源 SDK、假服务器、护栏策略和 PROBE-9），Phase 9–12 补用例，Phase 13 收口。本计划没有在 REQUIREMENTS.md 里标记 TEST-02 完成，它仍为 Pending。

## Self-Check: PASSED

- FOUND: tests/cloud/guard-cloud.spec.ts、tests/cloud/probes-cloud.spec.ts、tests/support/test.ts 导出 classifyRequest、guardPolicy、attachGuard
- FOUND commits: 67c5f79、347a966、8cce44c
- `playwright.config.ts`、`us-journey-tracker.html`、`tests/support/app.ts`、`tests/mocks/*` 相对 plan_head_before 没有改动
