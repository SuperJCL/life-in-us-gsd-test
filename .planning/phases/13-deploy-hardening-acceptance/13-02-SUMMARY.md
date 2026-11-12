---
phase: 13-deploy-hardening-acceptance
plan: 02
subsystem: pwa-assets
tags: [manifest, icons, apple-touch-icon, noindex, service-worker, playwright, ops-04]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-01 的 sw.js SHELL、SHELL_PATHS、静态服务器 SITE_DIR 和两档护栏白名单
provides:
  - deploy/site/manifest.webmanifest：「计划手记」清单（192/512 any、512 maskable 三个独立条目）
  - deploy/site/icons/ 下 4 个「记」字 PNG（RGB，无透明通道），由本机 Edge 离线渲染
  - deploy/make-icons.mjs：一次性图标渲染脚本（断网、低优先级、零依赖去 alpha）
  - 应用 head 的 manifest、icon、apple-touch-icon、theme-color、noindex 五个标签
  - sw.js 的 SHELL 含清单和 4 个图标，缓存内容仍恰好等于 SHELL_PATHS
affects: [13-04 构建脚本, 13-07 nginx, 13-15 总体验收]

actuals:
  tokens: 6200
  tasks: 2
  commits: 3
plan_head_before: dc62e723eb7fa0788090977a50f61926954c0db7
plan_head_after: 2e884a34d0236b940863e63c1eed8ea0bd0b8e21

tech-stack:
  added: []
  patterns:
    - "图标由已装的 Playwright 加本机 Edge 渲染，浏览器网络全挡；截图若带 alpha，用 node:zlib 解滤波后按颜色类型 2 重编码"
    - "护栏对清单和图标请求用 route.fetch() 加 fulfill 应答，不受 context.setOffline 影响，等同真实断网时由 Service Worker 缓存答出"

key-files:
  created:
    - deploy/make-icons.mjs
    - deploy/site/manifest.webmanifest
    - deploy/site/icons/icon-192.png
    - deploy/site/icons/icon-512.png
    - deploy/site/icons/icon-maskable-512.png
    - deploy/site/icons/apple-touch-icon-180.png
    - tests/e2e/platform/site-assets.spec.ts
  modified:
    - us-journey-tracker.html
    - deploy/site/sw.js
    - tests/support/constants.ts
    - tests/support/static-server.cjs
    - tests/support/test.ts
    - tests/cloud/same-origin.spec.ts

key-decisions:
  - "SHELL 和 SHELL_PATHS 的扩充从 Task 2 提前到 Task 1：head 一带上清单和图标，断网时它们就必须来自缓存，否则 sw-offline 的 console.error 条数对不上"
  - "护栏对清单和图标走 route.fetch 加 fulfill：浏览器取图标的时机不受页面脚本和 page.clock 控制，断网之后才取到会多出一条 ERR_INTERNET_DISCONNECTED"
  - "syncOnce 在共享令牌已被另一个标签页清空时直接返回，让本标签页自己的 storage 事件按“另一个标签页退出登录”处理"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "清单名为「计划手记」，三个独立图标条目；4 个 PNG 尺寸与声明一致、RGB 无透明通道"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/site-assets.spec.ts#OPS-04 the web app manifest names the app and lists 192, 512 and maskable icons that exist with matching sizes (D-09)"
        status: pass
    human_judgment: false
  - id: D2
    description: "页面 head 带 manifest、icon、apple-touch-icon、theme-color、noindex 各一个，sw.js 的 SHELL 等于 SHELL_PATHS"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/site-assets.spec.ts#OPS-04 the page links the manifest, the icons, the theme color and noindex, and the Service Worker precaches exactly the shell"
        status: pass
    human_judgment: false
  - id: D3
    description: "断网时清单和图标也来自缓存（缓存条目恰好等于 SHELL_PATHS），云端页面仍只请求同源"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-offline.spec.ts#OPS-04 the Service Worker caches only the app shell and never answers /api requests (D-07)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/same-origin.spec.ts#INFRA-03 the cloud page requests only its own origin while signing in, loading and saving"
        status: pass
    human_judgment: false
  - id: D4
    description: "图标的观感（「记」字居中、没有方块字）和 iOS 主屏幕安装"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "本机用 Read 看过 192 那张；iOS 主屏幕上的 apple-touch-icon 表现（假设 A9）留给 13-15 总体验收的 D 项"

duration: 约 2 小时
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 02: 主屏幕清单和图标 Summary

**应用现在可以添加到手机主屏幕：「计划手记」清单加 4 个深蓝底白色「记」字 PNG（本机 Edge 离线渲染、RGB 无透明通道），head 带齐五个标签并补上 noindex，Service Worker 把清单和图标一起预缓存。**

## Performance

- **Duration:** 约 2 小时（含一次 flaky 用例的定位）
- **Tasks:** 2（tracer 加一个测试任务）
- **Files modified:** 13（7 个新增，6 个修改）

## Accomplishments

- `deploy/make-icons.mjs`：`page.setContent` 渲染，背景 `#1B2740`、白色「记」、字重 800，字体栈 `"Noto Serif SC","Songti SC","STSong","SimSun","Microsoft YaHei",serif`；字号占边长 0.62（192、512、180），可遮罩图标 0.5；视口等于目标尺寸，`deviceScaleFactor` 1。浏览器网络用 `--host-resolver-rules`、死代理和 `page.route('**')` abort 三层挡住，进程低优先级。本机 Edge 直接输出颜色类型 2，所以去 alpha 的路径写好了但本次没有触发（脚本打印没有“已去 alpha”）。4 个文件分别是 3679、12072、10295、3591 字节；用 Read 看过 192 那张，字形是「记」、居中、无方块字。
- 清单按 RESEARCH §8 写：name 和 short_name 都是「计划手记」、lang `zh-CN`、id/start_url/scope 为 `/`、standalone、`#F2F5F9` 与 `#1B2740`，maskable 单独一条。
- 应用 head 在 `<title>` 之后加五个标签（manifest、icon、apple-touch-icon、theme-color、`noindex,nofollow`），改动保持 CRLF 工作区换行。
- 测试静态服务器精确放行清单（`application/manifest+json`）和 4 个图标（`image/png`），直接读 `deploy/site/`；其余 `/icons/…` 仍 404。两档护栏白名单都加了 `MANIFEST_PATH` 和 `ICON_PATHS`，原因写在注释里。
- sw.js 的 SHELL 为：页面、SDK、清单、icon-192、icon-512、icon-maskable-512、apple-touch-icon-180，`SHELL_PATHS` 同步。

## 实数

- `npx --no playwright test --list`：默认 **195** 条（193 加 site-assets 两条），cloud **242** 条。
- 完整 `npm run test:cloud`（1 个 worker，低优先级）：242 passed，`REPORT OK expected=242 flaky=0 unexpected=0`（5.7 分钟）。
- 完整默认 `npm test`（1 个 worker，低优先级）：195 passed，`REPORT OK expected=195 flaky=0 unexpected=0`（3.4 分钟）。两次不并发。
- `APP_SHA256` 现为 `fa70cffa9f55690776b1f8f60b62c64b1852c7a06fdc4e9cc27418b2f4959a0c`（对 CRLF 工作区文件计算）。

## INFRA-03 断言的放宽（原文和理由）

`tests/cloud/same-origin.spec.ts` 第一条用例，原来是：

```ts
const allowed = parsed.pathname === '/' || parsed.pathname === PB_SDK_PATH || parsed.pathname.startsWith('/api/');
```

现在在这三项之外只多接受同源的外壳文件：

```ts
const allowed =
  parsed.pathname === '/' ||
  parsed.pathname === PB_SDK_PATH ||
  parsed.pathname === MANIFEST_PATH ||
  parsed.pathname === SW_PATH ||
  ICON_PATHS.includes(parsed.pathname) ||
  parsed.pathname.startsWith('/api/');
```

理由：head 里的清单和图标链接、Service Worker 注册会产生这些同源的静态请求；`parsed.origin === APP_ORIGIN` 同源断言和护栏的两项断言（`expectedAborts`、`unexpectedRequests` 为空）没有动，所以“全程只向同源发请求”仍成立。

## Task Commits

1. **Task 1（tracer）：图标、清单、head 标签、静态服务器与护栏放行、manifest 用例（并带上 SHELL 扩充）** - `378e5f2`（feat）
2. **偏差修复：另一个标签页退出登录时的误报过期、护栏对清单图标的应答方式、新的 APP_SHA256** - `ef984af`（fix）
3. **Task 2：site-assets 第二条用例（head 链接和 SHELL 列表）** - `2e884a3`（test）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SHELL 和 SHELL_PATHS 的扩充提前到 Task 1**
- **Found during:** Task 1（cloud 子集）
- **Issue:** 计划把 sw.js 的 SHELL 扩充放在 Task 2，但 Task 1 的验证要求断网刷新用例通过。head 一带上清单和图标，断网刷新时它们不在缓存里，请求落到断开的网络，三条 sw-offline 用例都多出 console.error 而失败。
- **Fix:** Task 1 的提交里同时改 sw.js 的 SHELL 和 `SHELL_PATHS`；Task 2 只剩 site-assets 第二条用例和两个完整套件。
- **Files modified:** deploy/site/sw.js、tests/support/constants.ts
- **Verification:** same-origin 与 sw-offline 共 7 条通过
- **Committed in:** 378e5f2

**2. [Rule 1 - Bug] 断网用例里图标请求在断网之后才发出，多一条 console.error**
- **Found during:** Task 2（完整 cloud 套件）
- **Issue:** `PLAN-04 the save button is unavailable offline ...` 在 `context.setOffline(true)` 之后，浏览器才去取 `icon-192.png`（时机不由页面脚本和 `page.clock` 控制），护栏 `route.continue()` 走断开的网络，多出一条 `ERR_INTERNET_DISCONNECTED`，条数对不上。
- **Fix:** 护栏对 `MANIFEST_PATH` 和 `ICON_PATHS` 用 `route.fetch()` 加 `route.fulfill()` 应答，不受 `setOffline` 影响，效果等同真实断网时由 Service Worker 缓存答出；请求仍只发往同源静态服务器，失败时回退 `route.continue()`。
- **Files modified:** tests/support/test.ts
- **Verification:** plan-editor-sync、sw-offline、same-origin 共 16 条通过；完整 cloud 套件 242 条 flaky=0
- **Committed in:** ef984af

**3. [Rule 1 - Bug] 在另一个标签页退出登录，本标签页偶尔误报“登录已过期”（已有缺陷，现有用例暴露）**
- **Found during:** Task 2（完整 cloud 套件，`ACCT-02 a sign-in after the SDK failed to load at startup still follows a sign-out in another tab` 标为 flaky）
- **Issue:** 退出登录的标签页先删缓存键、最后清令牌（同一个任务里完成）。另一个标签页先收到缓存键的 storage 事件，调用 `requestSync("tab")`，`syncOnce` 开头 `!pb.authStore.isValid`（令牌已从共享存储里消失）就走 `goExpired()`，把退出登录报成“登录已过期”；只有本标签页恰好没有正在进行的同步时才发生，所以时有时无。我在 13-01 的应用文件上跑同一个文件 6 次也出现过 1 次失败，说明缺陷早已存在；加了 head 标签之后时序变化，频率升到约一半。
- **Fix:** `syncOnce` 开头加一行：令牌已经完全消失（`!pb.authStore.token`）时直接返回，由本标签页自己的令牌 storage 事件按“已在另一个标签页退出登录”处理；令牌存在但已过期的路径不变。修复后同一文件连跑 8 次全过（修复前 6 次里 3 到 4 次失败）。
- **Files modified:** us-journey-tracker.html、tests/support/constants.ts（APP_SHA256）
- **Verification:** 完整 cloud 242 条、完整默认 195 条都 flaky=0
- **Committed in:** ef984af

---

**Total deviations:** 3 auto-fixed（2 个 Rule 1，1 个 Rule 3）
**Impact on plan:** 偏差 1、2 只涉及测试设施和提交顺序；偏差 3 是应用里一行真实缺陷修复（用户在两个标签页之间退出登录时的提示），计划没有安排，但完整套件要求 flaky=0，所以在本计划内修复。没有新增用例，因为 ACCT-02 已经覆盖这条路径。

## Issues Encountered

- 第一次完整 cloud 运行有 1 条失败（PLAN-04，偏差 2），第二次有 1 条 flaky（ACCT-02，偏差 3），都已定位并修复，最后一次两个完整套件均为 REPORT OK。
- 排查用的临时调试用例 `tests/cloud/tmp-dbg.spec.ts` 已删除，没有提交。

## Known Stubs

无。

## Threat Flags

无新增攻击面：静态服务器新增的路径是精确白名单（清单和 4 个图标），仍只绑 127.0.0.1、只接受两个 Host；图标渲染全程断网，没有外部素材。T-13-37 的缓解有用例对应。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 13-04 的构建脚本要把清单和图标原样复制进发布目录，并保证 sw.js 的 SHELL 与 `SHELL_PATHS` 一致（site-assets 第二条用例逐项比较）。
- 13-07 的 nginx 要给 `/manifest.webmanifest` 发 `application/manifest+json`。
- 真机上的“添加到主屏幕”和 apple-touch-icon 表现（假设 A9）在 13-15 总体验收的 D 项核对。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/make-icons.mjs、deploy/site/manifest.webmanifest、4 个图标、tests/e2e/platform/site-assets.spec.ts
- FOUND: commits 378e5f2、ef984af、2e884a3（都在 HEAD 的祖先里）
