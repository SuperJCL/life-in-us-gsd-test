---
phase: 08-pocketbase-rules-isolation-fake-server
plan: 02
subsystem: testing
tags: [playwright, pocketbase, fake-server, eventsource, sdk-sha256, cloud-harness]

requires:
  - phase: 06-connectivity-probe
    provides: 已批准、哈希固定的 PocketBase SDK 0.28.1（tools/probe/page/vendor/pocketbase.iife.js 和 SHA256SUMS）
  - phase: 08-pocketbase-rules-isolation-fake-server
    provides: 08-01 的迁移与规则快照（假服务器复述的规则出处）
provides:
  - "npm run test:cloud 与 playwright.cloud.config.ts：单独的 cloud 测试入口（USJ_TEST_MODE=cloud、workers 1）"
  - "静态服务器同源提供 /vendor/pocketbase.iife.js，启动时按 SHA256SUMS 核对，不一致在 listen 之前退出 1"
  - "tests/mocks/pb-server.ts：FakePbServer（登录、列表、查看、创建、更新、删除拒绝、auth-refresh、实时订阅与推送）"
  - "tests/mocks/pb-runtime.ts：页面侧 installFakeEventSource 和 __pbEsDeliver"
  - "AppHarness 的 cloud 模式、readonly fake、resolveHarnessMode()"
  - "8 条 TEST-02 cloud 用例，默认套件新增 1 条（ENV-03 拒绝启动的反向对照）"
affects: [08-03, 08-07, phase-09, phase-10, phase-13]

plan_head_before: 32ccf89f7921482c644ea2c060f98e7961d15a54
plan_head_after: 9af9121c2710a4ee725dad691bfe81fad075615a

estimate:
  tokens: 95000
  raw_tokens: 95000
  tasks: 3
  confidence: low
actuals:
  tokens: 15300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "REST 用 context.route 只接应用来源下的 /api/，SDK 的 fetch 原样运行；没实现的路径返回 null，由 route.fallback() 交回护栏"
    - "SSE 用页面侧假 EventSource（context.exposeBinding 握手），事件只由写入或显式 emit 触发，没有计时器"
    - "假令牌三段运行时拼接（标准 base64 去填充加随机签名段），exp 用假时钟"

key-files:
  created:
    - playwright.cloud.config.ts
    - tests/mocks/pb-server.ts
    - tests/mocks/pb-runtime.ts
    - tests/cloud/cloud-harness.spec.ts
  modified:
    - package.json
    - tests/support/static-server.cjs
    - tests/support/constants.ts
    - tests/support/app.ts
    - tests/e2e/platform/app-integrity.spec.ts

key-decisions:
  - "resolveHarnessMode 的 env 参数不设默认值，由 open() 显式传 process.env.USJ_TEST_MODE"
  - "故意制造的 4xx 在用例里先断言恰好是预期的几条 console.error，再用 guard.remove 删掉，不改护栏"
  - "同一个 context 的 attach 只能调用一次，页面关闭或整页导航时注销该页面的实时连接"

patterns-established:
  - "拒绝形态按研究的源码结论实现，每种都有 cloud 用例，并在 Node 侧回读确认数据没变"
  - "反向对照用例：临时目录里改一个字节的 SDK 副本证明静态服务器会拒绝启动，同一用例内先让未改动副本正常启动"

requirements-completed: []

coverage:
  - id: D1
    description: "cloud 入口：npm run test:cloud、playwright.cloud.config.ts，默认 playwright.config.ts 一个字节未改"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "npm run test:cloud（tests/cloud/cloud-harness.spec.ts，8 条，REPORT OK）"
        status: pass
    human_judgment: false
  - id: D2
    description: "真实 SDK 0.28.1 同源加载并经 sha256 核对；假服务器完成登录、读写、拒绝形态、无效令牌、订阅"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/cloud-harness.spec.ts 的 8 条 TEST-02 用例"
        status: pass
      - kind: e2e
        ref: "ENV-03 the static server serves only the app file and the pinned SDK / refuses to start when the SDK bytes differ from SHA256SUMS"
        status: pass
    human_judgment: false
  - id: D3
    description: "v1 不受影响：app-integrity、account-mode、smoke、mock-contract 四个 spec 共 27 条通过，应用文件哈希不变"
    verification:
      - kind: e2e
        ref: "npm test -- --workers=1 的四个 spec 子集（REPORT OK expected=27）"
        status: pass
    human_judgment: false

duration: 约 60min
completed: 2026-11-08
status: complete
---

# Phase 8 Plan 02: cloud 测试入口、同源 SDK 与 Node 侧假 PocketBase Summary

**真实 PocketBase SDK 0.28.1 同源加载（启动时按 SHA256SUMS 核对），在浏览器里对 Node 侧 FakePbServer 完成登录、读写、拒绝形态、无效令牌和实时订阅，实时由页面侧假 EventSource 承接；入口是单独的 `npm run test:cloud`（8 条用例全过）。**

## Performance

- **Duration:** 约 60 分钟
- **Tasks:** 3（1 个 tracer、2 个 auto/tdd）
- **Files:** 新建 4 个，修改 5 个
- **Commits:** 3（measured：`git rev-list --count 32ccf89..HEAD`）

## Accomplishments

- tracer 一次打通：`npm run test:cloud` → cloud 配置 → AppHarness cloud 模式 → 静态服务器同源提供并核对 SDK → 页面里的真实 SDK → `context.route` → `FakePbServer.handle()`。
- 静态服务器启动时读 SHA256SUMS（必须恰好一行）和 SDK 文件算 sha256，缺文件、行数不对或哈希不一致都在 listen 之前用中文提示退出 1，提示里只有仓库相对路径。
- 假服务器覆盖全部拒绝形态，并有用例逐条验证；每次拒绝之后 Node 侧回读，数据不变、writes 为空。
- 实时订阅：fields 裁剪、按订阅者当时的身份判定、只收本账号的变更，推送在响应 fulfill 之后，没有计时器。

## 假服务器实现的端点和每种拒绝形态的依据

依据是 08-RESEARCH 的源码结论（Pattern 3 的 ACCT04 行和 Pattern 6），08-07 用真实样本复核。

| 端点 | 行为 | 依据 |
|------|------|------|
| `POST users/auth-with-password` | 成功 200 `{record, token}`；失败 400 `Failed to authenticate.`（不是 401） | apis/record_auth_with_password.go |
| `POST users/auth-refresh` | 有效 200 带新令牌；无效或过期 401 `The request requires valid record authorization token.`（唯一返回 401 的接口） | 研究 Pitfall 1 |
| `GET journey_docs/records` | 只返回 owner 等于当前身份的文档；无效令牌当未登录，200 空列表；`skipTotal=1` 时 totalItems、totalPages 为 -1；page、perPage、skipTotal 之外的查询参数返回 null 交给护栏 | listRule 不满足返回 200 空列表 |
| `GET journey_docs/records/<id>` | 本人 200；别人、不存在、未登录 404 | viewRule 不满足 404 |
| `POST journey_docs/records` | 未登录或 owner 不是自己 400 `Failed to create record.`；kind 不在 state、plan 400 `validation_invalid_value`；writer 超过 40 字符 400 `validation_max_text_constraint`；data 超过 4194304 字节 400 `validation_json_size_limit`；(owner, kind) 重复 400，owner 和 kind 都是 `validation_not_unique` | createRule 不满足 400；字段校验；唯一索引 |
| `PATCH journey_docs/records/<id>` | 未登录、别人的、不存在、请求体带 owner 或 kind 键（值相同也算）一律 404；writer、data 上限同创建，消息 `Failed to update record.` | updateRule 里 `:isset = false`（研究 Pitfall 4） |
| `DELETE journey_docs/records/<id>` | 一律 403 `Only superusers can perform this action.`，连记录存不存在都不看 | deleteRule 为 null |
| `POST /api/realtime` | clientId 未知 404；同一连接换身份 403；成功 204 | 研究 Pattern 6 |

## 自动取消用例里 fulfillErrors 的观察值

`TEST-02 a request cancelled by the SDK does not fail the test` 的观察值是 `fulfillErrors=0`（写进了该用例的 annotation `observed`）：这次运行里被取消的那条列表请求在 abort 到达之前就已经 fulfill 完，没有抛错。用例按“最多 1 条、且只可能来自这条列表请求”断言，时序不同时抛出的异常会记进 fulfillErrors 而不是被吞掉；页面没有未捕获异常。

## 默认套件新增 1 条

app-integrity.spec.ts：ENV-03 原用例改名为 `ENV-03 the static server serves only the app file and the pinned SDK`（加了 SDK 的断言），新增 `ENV-03 the static server refuses to start when the SDK bytes differ from SHA256SUMS`。默认套件 173 → 174（08-03 跑完整套件时核对）。cloud 用例只在 `npm run test:cloud` 里运行，默认 `npm test` 的 testDir 仍是 `./tests/e2e`。

## 留给后续计划的事项

- **08-03：** 护栏的 cloud 策略。现在未实现的路径经 `route.fallback()` 回到 v1 的护栏，应用来源下是 `route.continue()`，落到静态服务器的 404；08-03 要把它收紧成违规记录。`tests/support/test.ts` 本计划没改。
- **08-07：** 用真实样本复核错误消息文字和记录形状（`Missing or invalid client id.` 和 `The current and the previous request authorization don't match.` 两条实时消息是按源码记忆写的，要特别核对），偏差写进 PB-CONTRACT.md。
- **Phase 9/10：** 应用接上云端后改 `AppHarness.ready()` 的 cloud 就绪条件；v1 账户用例到那时才对 `account → cloud` 映射有意义；网络失败、5xx、SSE 断开、乱序事件不在本阶段。
- **TEST-02 在 Phase 8 只完成基础部分**（入口、同源 SDK、假服务器、实时骨架）；Phase 9–12 补用例，Phase 13 收口。所以 REQUIREMENTS.md 里 TEST-02 仍为 Pending，本计划没有标完成。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resolveHarnessMode 的 env 默认值让纯函数用例在 cloud 配置下失败**
- **Found during:** Task 2（cloud 运行里 `account` 加 `undefined` 返回了 cloud）
- **Issue:** 计划的签名 `env: string | undefined = process.env.USJ_TEST_MODE` 里，传入 `undefined` 会被默认值顶替成 `cloud`，而用例要求 `resolveHarnessMode('account', undefined)` 为 `account`。
- **Fix:** 去掉默认值，`open()` 显式传 `process.env.USJ_TEST_MODE`。行为与计划要求一致。
- **Files modified:** tests/support/app.ts
- **Commit:** 36305ba

**2. [Rule 3 - Blocking] 故意制造的 4xx 被护栏当成 console.error 违规**
- **Found during:** Task 2
- **Issue:** Chromium 为每个 4xx 响应写一条 `Failed to load resource` 的 console.error，护栏会让拒绝形态和 401 的用例失败；护栏（test.ts）本计划不能改。
- **Fix:** 用例里先断言恰好是预期的那几条（按状态码和条数），再用 `guard.remove('consoleErrors', ...)` 删掉，其他违规仍然会让用例失败。
- **Files modified:** tests/cloud/cloud-harness.spec.ts
- **Commit:** 36305ba

**3. [说明] TDD 提交粒度**
- 计划要求每个任务一次提交，所以没有分开的 test/feat 提交，本计划 `type: execute`，不适用 TDD 门禁。Task 2 先写用例并观察到 4 条按计划断言失败（含新用例不存在的 `resolveHarnessMode`），再实现。Task 3 的用例与实现同时写好，没有单独的 RED 运行；补做了一次变异检查：临时去掉“订阅者身份等于 owner”的判定，隔离用例按预期失败，随后已还原。取消用例在 RED 时就已通过，因为取消路径的 try/catch 在 Task 1 已实现。

## Known Stubs

None。`downloads` 恒为空是计划规定的（导出在 Phase 11 才写入），不是遗漏。

## Threat Flags

None。cloud 用例只在 127.0.0.1 的应用来源内往返；假令牌和口令都在运行时生成，源码里没有字面量；暂存后的隐私检查三次都通过，没有加放行名单。

## Self-Check: PASSED

- FOUND: playwright.cloud.config.ts、tests/mocks/pb-server.ts、tests/mocks/pb-runtime.ts、tests/cloud/cloud-harness.spec.ts
- FOUND commits: 12e3c67、36305ba、9af9121
- `playwright.config.ts`、`us-journey-tracker.html`、`tests/support/test.ts`、`tools/probe/page/vendor/` 相对 plan_head_before 没有改动
