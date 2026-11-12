---
phase: 13-deploy-hardening-acceptance
plan: 01
subsystem: offline-shell
tags: [service-worker, offline, cache-storage, playwright, ops-04]

requires:
  - phase: 10-offline-sync
    provides: 本机待上传缓存和 `statusOffline(n)` 状态行，断网刷新后修改仍在、联网后上传
  - phase: 09-cloud-app
    provides: 云端模式 `CLOUD`、同源 SDK、`CLOUD_APP_PATHS` 护栏白名单
provides:
  - deploy/site/sw.js：只缓存应用外壳（`/` 和 SDK）的 Service Worker，版本占位 `__BUILD_VERSION__`，缓存名 `usj-shell-<版本>`
  - 应用在云端模式下注册 `/sw.js`（`swInit()`、`swReg`），本地版和 Artifact 不注册
  - 测试静态服务器的 `/sw.js`（占位换成 `test`）和 cloud 档护栏白名单里的 `SW_PATH`
  - tests/cloud/sw-offline.spec.ts：三条 OPS-04 用例
affects: [13-02 清单图标, 13-03 更新提示, 13-04 构建脚本, 13-07 nginx, 13-15 总体验收]

actuals:
  tokens: 3114
  tasks: 2
  commits: 1
plan_head_before: 32bbf45f80e3364c000df8a81d52ba027a8981ba
plan_head_after: cccc84844a34390d0d70e1108a9a40da1a515322

tech-stack:
  added: []
  patterns:
    - "Service Worker 只对 `/` 导航和 SHELL 路径 respondWith，其余交给网络，/api 和 /_/ 永不进缓存"
    - "新 worker 既不 skipWaiting 也不接管已打开的页面：首次安装不触发 controllerchange，新版本只在用户点击后生效"
    - "只在单个 spec 文件里 test.use({ serviceWorkers: 'allow' })，配置文件保持 block"

key-files:
  created:
    - deploy/site/sw.js
    - tests/cloud/sw-offline.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/static-server.cjs
    - tests/support/test.ts
    - tests/e2e/platform/app-integrity.spec.ts
    - .gitattributes

key-decisions:
  - "SHELL 本计划是 `/` 和 `/vendor/pocketbase.iife.js`，缓存名是 usj-shell-<版本>（测试里固定为 usj-shell-test）；13-02 再加清单和 4 个图标"
  - "`/sw.js` 只进 cloud 档护栏白名单，v1 档不加：本地版不注册"
  - "APP_SHA256 沿用本机的约定：对工作区文件（CRLF 检出）算哈希，与 SAFE-02 读到的字节一致"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "页面打开过一次之后断网刷新，应用从 Service Worker 缓存启动，待上传的修改和数量还在，联网后自动上传"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-offline.spec.ts#OPS-04 after one visit the app reloads offline from the Service Worker cache with its pending changes and count (D-07)"
        status: pass
    human_judgment: false
  - id: D2
    description: "断网时新开标签页（冷启动）进入应用并记一笔，联网后上传"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-offline.spec.ts#OPS-04 after one visit a new tab opens the app offline, records an entry and uploads it when the server is back (D-07)"
        status: pass
    human_judgment: false
  - id: D3
    description: "缓存里只有外壳、没有 /api 条目，离线时 /api/health 不会被 worker 答出来"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-offline.spec.ts#OPS-04 the Service Worker caches only the app shell and never answers /api requests (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "真机（手机）上断网打开的体验"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "本机用例只证明 Edge 里的行为；iOS Safari 和主屏幕应用的真机表现在 13-15 总体验收里核对"

duration: 16min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 01: 离线外壳 Service Worker Summary

**云端版打开过一次之后断网也能打开：Service Worker 只预缓存页面和 SDK，`/api/` 与 `/_/` 从不进缓存，断网刷新和冷启动新标签页都能进入应用、记录并在联网后上传。**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-12T17:44:47Z
- **Completed:** 2026-11-12T18:00:51Z
- **Tasks:** 2（tracer 加一个测试任务）
- **Files modified:** 8（2 个新增，6 个修改）

## Accomplishments

- `deploy/site/sw.js`：`install` 用 `fetch(u,{cache:'reload'})` 逐个预缓存，任一失败即安装失败；`activate` 删除旧版本缓存；只有收到 `SKIP_WAITING` 消息才 `skipWaiting()`；`fetch` 只对路径为 `/` 的导航和 SHELL 路径调用 `respondWith`。文件里没有 `clients.claim`，占位 `__BUILD_VERSION__` 恰好一处。
- 应用只在 `CLOUD` 为真、浏览器有 `serviceWorker` 并且是安全上下文时注册；`readConfig()`、`USJ`、`CLOUD` 三行没动；`serviceWorkers: 'block'` 下 `register()` 返回空，先判空后返回，不抛错也没有页面异常，现有 v1 和 cloud 用例全部照常通过。
- 测试静态服务器多放行 `/sw.js`（每次直接读 `deploy/site/sw.js`，把占位换成 `test`），启动时核对文件存在且占位恰好一处；其余路径仍是 404。
- 三条 OPS-04 用例首次运行即通过，证明了计划的假设：`serviceWorkers: 'allow'` 下 worker 不 `respondWith` 的 `/api` 请求仍由 `context.route` 的假服务器应答，无需让 worker 转发。

## 实数

- `npx --no playwright test --list`：默认 **193** 条（与基线一致，本计划不加默认用例），cloud **242** 条（239 + sw-offline 三条）。
- 完整 `npm run test:cloud`：242 passed，`REPORT OK expected=242 flaky=0 unexpected=0`（5.6 分钟）。
- 完整默认 `npm test`（1 个 worker）：193 passed，`REPORT OK expected=193 flaky=0 unexpected=0`（3.2 分钟）。两次不并发、低优先级。
- sw.js 的 SHELL：`['/', '/vendor/pocketbase.iife.js']`；测试里的缓存名：`usj-shell-test`。
- `APP_SHA256` 新值 `c54c9a81b41b3757f6875fe7e0c5ce29381ccd32ebbfd16279afa781bfa8df0e`（对本机 CRLF 工作区文件计算，与此前基线约定一致）。

## Task Commits

1. **Task 1（tracer）：sw.js、云端模式注册、静态服务器 `/sw.js`、护栏放行、断网刷新用例** - `cccc848`（feat）
2. **Task 2：断网冷启动用例、/api 不进缓存用例、两个完整套件** - 没有单独的提交，见下面的偏差 1。

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## Files Created/Modified

- `deploy/site/sw.js` - 离线外壳 Service Worker
- `us-journey-tracker.html` - `swReg`、`swInit()`、`if(CLOUD)swInit();`
- `tests/support/constants.ts` - `SW_PATH`、`SW_TEST_VERSION`、`SW_CACHE_PREFIX`、`SHELL_PATHS`；新 `APP_SHA256`
- `tests/support/static-server.cjs` - `/sw.js` 版本替换，启动时核对
- `tests/support/test.ts` - `CLOUD_APP_PATHS` 加 `SW_PATH`
- `tests/cloud/sw-offline.spec.ts` - 三条 OPS-04 用例
- `tests/e2e/platform/app-integrity.spec.ts` - ENV-03 的临时副本里带上 `deploy/site/sw.js`
- `.gitattributes` - `deploy/** text eol=lf`、`deploy/site/icons/** -text`

## Decisions Made

- 冷启动用例里原页面关闭后新页面要自己 `clock.setFixedTime(FROZEN_NOW)`，否则令牌按真实日期判断已过期，应用会退回登录页。
- 第三条用例用假服务器的 refuse 开关让 `/api/health` 失败，而不是让假服务器应答：没有 refuse 时该路径会被护栏记为违规。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 三条用例一次写完，Task 2 没有独立提交**
- **Found during:** Task 1
- **Issue:** 计划把冷启动和“外壳以外不缓存”两条放在 Task 2；三条在同一个文件里，Task 1 写文件时已经全部写好并通过，Task 2 剩下的工作只是跑两个完整套件，没有文件改动可提交。
- **Fix:** 三条用例随 Task 1 的提交一起入库；Task 2 只做 `--list` 计数和两个完整套件的验证。
- **Files modified:** tests/cloud/sw-offline.spec.ts
- **Committed in:** cccc848

**2. [Rule 1 - Bug] ENV-03 的静态服务器临时副本缺 sw.js，用例失败**
- **Found during:** Task 1（默认套件子集）
- **Issue:** `tests/e2e/platform/app-integrity.spec.ts` 的 `buildCopy` 把静态服务器复制到临时目录，副本里没有 `deploy/site/sw.js`，新加的启动核对让“未改动的副本”启动失败（ENV-03 的对照那一步超时）。
- **Fix:** 副本里同样放一份 `deploy/site/sw.js`，让拒绝启动的原因仍然只可能是 SDK 哈希。
- **Files modified:** tests/e2e/platform/app-integrity.spec.ts
- **Verification:** app-integrity、guardrails、smoke 三个文件 20 条全过；完整默认套件 193 条通过。
- **Committed in:** cccc848

---

**Total deviations:** 2 auto-fixed（1 个 Rule 1，1 个 Rule 3）
**Impact on plan:** 都只涉及测试设施，没有改变计划的范围；应用和 sw.js 的行为与计划一致。

## Issues Encountered

None

## Known Stubs

无。

## Threat Flags

无新增攻击面：`/sw.js` 只是同源静态文件，worker 不碰 `/api/` 和 `/_/`，T-13-01、T-13-02、T-13-03 的缓解都有用例或精确白名单对应。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 13-02 可以直接把清单和 4 个图标加进 `SHELL` 和 `SHELL_PATHS`，缓存内容的用例自动覆盖。
- 13-03 的前提就位：首次安装没有 controller、不触发 controllerchange，新版本进入等待，`SKIP_WAITING` 消息已在 sw.js 里。
- 13-04 的构建脚本要换掉 sw.js 里唯一的 `__BUILD_VERSION__`。
- 真机上的断网打开留给 13-15 总体验收。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/site/sw.js、tests/cloud/sw-offline.spec.ts
- FOUND: commit cccc848（在 HEAD 的祖先里）
