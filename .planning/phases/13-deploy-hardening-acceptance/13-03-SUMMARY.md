---
phase: 13-deploy-hardening-acceptance
plan: 03
subsystem: pwa-update
tags: [service-worker, update-banner, skip-waiting, confirm, playwright, ops-04]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-01 的 sw.js（SKIP_WAITING、不自动接管）和 swInit；13-02 的清单、图标、SHELL_PATHS
  - phase: 10-offline-sync
    provides: 待上传的修改存在本机缓存里，刷新后照常上传
provides:
  - 应用里的更新流程：swOffer、swUpdate、swUnsaved、swBar；SB_ORDER 末尾的 update 键；T_SW_* 文案
  - controllerchange（点击后只刷新一次、别的标签页激活时只显示横幅）和 visibilitychange（回到前台时 reg.update()）监听
  - beforeunload 在更新已确认时不再拦（planDirty()&&!swGo）
  - 测试静态服务器的 GET /__test/sw-version/<v>（只供测试，改内存里的 sw.js 版本）
  - tests/cloud/sw-update.spec.ts：4 条 OPS-04 用例
affects: [13-04 构建脚本, 13-07 nginx, 13-15 总体验收]

actuals:
  tokens: 6270
  tasks: 2
  commits: 3
plan_head_before: 781ab1f25eca4a3ebe5915ff4ae292d7a6e10b2d
plan_head_after: b1c9d463faac3f0891e41d2ce33bbc9a78354e18

tech-stack:
  added: []
  patterns:
    - "新版本由测试静态服务器自己变（Playwright 拦截不了 worker 的更新请求）：request fixture 调版本开关，页面里 registration.update() 去取，每条用例 finally 调回 test"
    - "更新横幅走现有 #syncbar 的 showBar，键 update 排在 SB_ORDER 最后；点击后 swGo 为真，controllerchange 才刷新，且用 swReloaded 只刷新一次"
    - "确认框复用 confirmBox；swAsk 防止确认期间重入，swGo 防连点"

key-files:
  created:
    - tests/cloud/sw-update.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/static-server.cjs
    - tests/support/constants.ts
    - tests/support/strings.ts

key-decisions:
  - "点了「点此更新」后按钮立刻 disabled 并显示「正在更新…」，选「先不更新」时恢复成可点的「点此更新」；确认框期间 swOffer 不重画横幅（swAsk）"
  - "swUnsaved 编辑计划页打开时只看真正的草稿：isBusy 在那时恒为真，所以只检查 planDirty() 和两个「记一笔」框里有没有非空白文字"
  - "两个标签页的用例在 A 点更新之前让浏览器断网：刷新后对账才会立刻转离线，否则联网状态下读列表被拒要等约 15 秒才转离线"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "新版本发布后，已打开的页面显示信息类横幅「有新版本」「点此更新」，点之前不刷新；点了之后新 worker 接管、页面刷新一次、缓存只剩新版本"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts#OPS-04 a new version shows the update banner and its button switches to the new cache and reloads into the new version (D-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "有未保存的修改（「记一笔」草稿、编辑计划页的改动）时点更新先弹「现在更新？」；先不更新保留草稿和横幅，仍然更新只刷新一次且不弹浏览器离开提示"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts#OPS-04 the update asks first while a composer draft or unsaved plan changes exist, keeps them when cancelled and reloads after confirming (D-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "两个标签页都显示横幅，只有点击的那个刷新；待上传的修改刷新后仍在并上传到服务器，恰好一条"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts#OPS-04 with two tabs open both show the update banner, only the tab that clicks reloads, and a change waiting for upload is uploaded after the reload (D-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "连点两次「点此更新」只刷新一次（主框架只导航一次）"
    requirement: OPS-04
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts#OPS-04 clicking the update button twice reloads the page once (D-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "横幅「有新版本」「点此更新」和确认框「现在更新？」的文案、位置，以及真机（装在主屏幕的应用）上的更新体验"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "新文案按计划留给 13-15 总体验收请所有者表态；真机上的更新提示在总体验收的 E 项核对"

duration: 23min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 03: 有新版本，点此更新 Summary

**新版本发布后，已打开或装在主屏幕的应用在 `#syncbar` 显示「有新版本」「点此更新」，所有者点了才刷新；有未保存的修改先问「现在更新？」；待上传的修改刷新后照常上传，两个标签页互不干扰。**

## Performance

- **Duration:** 23 min（含两个完整套件之外的一次完整 cloud 运行 8 分钟）
- **Started:** 2026-11-12T18:47:53Z
- **Completed:** 2026-11-12T19:11:00Z
- **Tasks:** 2（tracer 加一个 TDD 任务）
- **Files modified:** 5（1 个新增，4 个修改）

## Accomplishments

- **更新流程（应用）：** `swOffer()` 在页面已有 controller 时才显示横幅（首次安装不显示）；`swInit` 里 `r.waiting` 已存在、`updatefound` 后新 worker 变 `installed` 都会调用它；`visibilitychange` 变为 visible 时 `r.update().catch(()=>{})`。`swUpdate()` 把按钮换成 disabled 的「正在更新…」，有等待中的 worker 就 `postMessage({type:"SKIP_WAITING"})`，`controllerchange` 里 `swGo` 为真才 `location.reload()`（`swReloaded` 保证只一次）；没有等待中的 worker（别的标签页已激活）直接刷新。不是自己点的 `controllerchange` 只调 `swOffer()`，本标签页从不自动刷新。
- **确认：** `swUnsaved()` 为真时先 `confirmBox`（「现在更新？」，按钮「先不更新」「仍然更新」）；选先不更新恢复横幅按钮，草稿原样留着。`beforeunload` 改为 `planDirty()&&!swGo`：已在确认框里同意丢掉修改，浏览器自带的离开提示不再弹第二次。
- **测试设施：** 静态服务器的 `GET /__test/sw-version/<v>`：`v` 匹配 `^[a-z0-9]{1,16}$` 回 204 并改内存里的版本，否则 400，`/__test/` 下其他路径 404；仍只绑回环、只接受两个 Host，不读写文件。
- **4 条用例：** 横幅与切换、草稿先确认（含编辑计划页那一段，期间没有 dialog 事件）、两个标签页加待上传、连点两次（在同一个任务里点旧按钮两次，再对新按钮强制点一次，`framenavigated` 只记一次）。

## swUnsaved 的判断规则（给 13-15 和以后的维护者）

1. `planDirty()` 为真（编辑计划页有改动）：要确认。
2. 编辑计划页没打开：`isBusy()` 为真就要确认（对话框开着、「记一笔」框里有字、新标签输入框开着、文本框里有光标、未提交的周复盘、未保存的力量值、待办输入框里有字）。
3. 编辑计划页打开着（`isBusy` 那时恒为真）：只看 `w-text`、`c-text` 有没有非空白文字。
4. 已经记下、还没上传的修改在本机缓存里，不算未保存：刷新后照常上传，所以点更新不为它们确认（两个标签页用例证明）。

## 横幅和确认框的最终文案（交给 13-15 请所有者表态）

- 横幅：`有新版本`；按钮 `点此更新`；点击后按钮 `正在更新…`（disabled）。`data-tone="info"`，按钮样式同远端更新横幅的「现在更新」（`primary`）。
- 确认框标题：`现在更新？`
- 正文第一行：`有没保存的修改，更新会刷新页面，这些修改会丢失。`
- 正文第二行：`已经记下、还没上传的修改不受影响，刷新后会照常上传。`
- 按钮：`先不更新`（取消）、`仍然更新`（确认，danger 外观）。

## 实数

- `npx --no playwright test --list --config=playwright.cloud.config.ts`：cloud **246** 条（242 加本计划 4 条）；默认套件仍 195 条（本计划不加默认用例）。
- 完整 `npm run test:cloud`（1 个 worker，低优先级）：246 passed，`REPORT OK expected=246 flaky=0 unexpected=0`（8.0 分钟），含本计划 4 条、`PLAN-04 closing the page with unsaved plan changes raises the browser leave prompt (D-09)` 和 `SYNC-02 a remote change waits with a notice while this device is busy and is applied once it is idle`。
- Task 1 子集（sw-update、sw-offline、remote-update）14 条 `REPORT OK`；默认子集（app-integrity、site-assets）9 条、（app-integrity、goals）24 条 `REPORT OK`，SAFE-02 与 PLAN-02 本地版用例通过。
- `APP_SHA256` 现为 `d50b625b291fe462d9c883a318acd97624166ec4e062ca75a2f3e6c221eec6c1`（对 CRLF 工作区文件计算，沿用 13-01 起的约定）。

## Task Commits

1. **Task 1（tracer）：版本开关、更新横幅、SKIP_WAITING 加刷新一次、第一条用例** - `20d67c4`（feat）
2. **Task 2 RED：确认框用例（在 Task 1 的应用上失败）、两标签页和连点两次用例、CF 文案常量** - `5d3c7ad`（test）
3. **Task 2 GREEN：swUnsaved、先确认、beforeunload 不再拦已确认的更新、新的 APP_SHA256** - `b1c9d46`（feat）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## TDD 说明

- **RED：** 确认框用例在 Task 1 的应用上失败，失败点正是计划的断言：有「记一笔」草稿时点更新，页面直接刷新，`dialog#confirm` 一直没打开（`readConfirm` 的 `open` 为 true 超时）。两个标签页和连点两次两条用例在 Task 1 的应用上本来就能过（Task 1 已有 `swGo` 防连点，且待上传的修改不需要确认），它们是对这两条行为的固定，不是 RED 的触发点。本计划是 `type: execute`，没有走 `tdd-red-evidence` 分类器，语义判断由上面的失败点给出。
- **GREEN：** 加 `swUnsaved`、`swAsk`、确认流程和 `beforeunload` 的 `!swGo`，4 条用例全过（33 秒），随后完整 cloud 套件 246 条通过。
- **REFACTOR：** 无。

## Files Created/Modified

- `us-journey-tracker.html` - `swBar`、`swOffer`、`swUnsaved`、`swUpdate`、`swInit` 里的监听；`SB_ORDER` 末尾 `update`；`T_SW_*` 文案；`beforeunload` 加 `!swGo`
- `tests/support/static-server.cjs` - 只供测试的版本开关
- `tests/support/constants.ts` - `SW_VERSION_CONTROL_PATH`、新的 `APP_SHA256`
- `tests/support/strings.ts` - `BANNER_SW_UPDATE`、`BTN_SW_UPDATE`、`BTN_SW_UPDATING`、`CF_SW_*`
- `tests/cloud/sw-update.spec.ts` - 4 条 OPS-04 用例

## Decisions Made

- 点击后按钮立刻显示「正在更新…」并 disabled；选先不更新时恢复「点此更新」。确认框开着的时候 `swOffer` 不重画横幅（`swAsk`），避免按钮被别的标签页的 `controllerchange` 重新点亮。
- 编辑计划页打开时 `swUnsaved` 只看 `planDirty()` 和两个「记一笔」框的真实草稿，因为 `isBusy()` 在那时恒为真，直接用会让没有任何修改的编辑页也被拦。
- 两个标签页用例在 A 点更新前 `context.setOffline(true)`（新 worker 已装好在等待，外壳来自缓存），刷新后对账立刻转离线；`setOffline(false)` 派发 online 后上传。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 两个标签页用例里，刷新后的状态行要等约 15 秒才转离线**
- **Found during:** Task 2（RED 阶段先跑该用例）
- **Issue:** 计划写的是“只 refuse PATCH”。联网状态下刷新，对账读列表被拒，状态行先「正在和服务器对账…」再「网络较慢」，要等约 15 秒才转离线，超出断言的 5 秒，也逼近用例的 30 秒总时限。
- **Fix:** 用例里同时 refuse 读列表和 PATCH（`listFault` 加 `patchFault`，控制台错误按两者命中数之和确认），并在 A 点更新之前 `context.setOffline(true)`，让刷新后对账立刻转离线；撤掉故障后 `setOffline(false)` 派发 online 触发上传。待上传数量、只有 A 刷新、B 不自动刷新、服务器恰好一条这些断言都保留。
- **Files modified:** tests/cloud/sw-update.spec.ts
- **Verification:** 该用例单独 `--retries=0` 通过；完整 cloud 套件 246 条 flaky=0
- **Committed in:** 5d3c7ad

---

**Total deviations:** 1 auto-fixed（1 个 Rule 3）
**Impact on plan:** 只涉及用例的写法，被测行为和断言内容与计划一致，没有改应用、没有加范围。

## Issues Encountered

- 第一次写这份 SUMMARY 时误把 `APP_SHA256` 写成了占位值，立即按 `tests/support/constants.ts` 里的真值更正，未提交过错误值。
- 无其他问题；没有留下排查用的临时文件，测试结束后没有遗留的 `msedge.exe` 或 `find.exe` 进程。

## Known Stubs

无。

## Threat Flags

无新增攻击面：版本开关只在测试静态服务器里（精确前缀、格式检查、只改内存里的一个字符串、仍只绑 127.0.0.1 和两个 Host），线上 nginx 没有这个路径（T-13-05）；更新前的确认、取消后留在原页面、待上传的修改跨刷新保留、别的标签页不被动刷新都有用例对应（T-13-04）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 13-04 的构建脚本替换 sw.js 里的 `__BUILD_VERSION__` 之后，同一个构建部署两次版本号不变（edge OPS-04 idempotency）；本计划的连点两次用例是它的另一半。
- 13-15 总体验收请所有者对上面的横幅和确认框文案表态，并在真机（装在主屏幕的应用）上核对更新提示。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: tests/cloud/sw-update.spec.ts
- FOUND: commits 20d67c4、5d3c7ad、b1c9d46（都在 HEAD 的祖先里）
- 计划的两个任务的验收命令全部通过（grep 检查、段标记各一次、APP_SHA256 一致、报告 REPORT OK、隐私检查通过）
