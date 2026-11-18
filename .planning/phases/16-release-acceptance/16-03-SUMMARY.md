---
phase: 16-release-acceptance
plan: 03
subsystem: app-sw-tests
tags: [service-worker, update-flow, static-server, manifest, privacy-docs, playwright]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: "13-REVIEW 的 IN-02、IN-06、IN-07、IN-08、IN-11 五条发现；sw.js、sw-update.spec、静态服务器的版本开关"
provides:
  - "点「点此更新」后 4 秒内新版本没接管，页面自己刷新一次（swReloaded 防重复，只在点击和草稿确认之后）"
  - "sw.js 的 activate 只删 usj-shell- 开头的旧缓存，install 失败先删半套缓存再失败"
  - "清单不再有 description 字段"
  - "测试静态服务器的版本开关要 x-usj-test: 1 头，无头回 403 且版本不变"
  - "tests/README、site-assets.spec 注释、PRIVACY.md 与现状一致"
affects: [16-04, 16-05, 16-08]

actuals:
  tokens: 5750
  tasks: 3
  commits: 3

plan_head_before: 6017f0aa2119d23ea646c4c21bc0271fd362b5c7
plan_head_after: 5f4630363a6179e413aa8ae07e95d27677a0c6fb

tech-stack:
  added: []
  patterns:
    - "用 page.evaluate 包住 ServiceWorker.prototype.postMessage 丢掉 SKIP_WAITING，在真浏览器里复现“新版本没接管”"
    - "测试专用开关要自定义请求头：跨站页面发不出带自定义头的简单请求"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/sw-update.spec.ts
    - deploy/site/sw.js
    - deploy/site/manifest.webmanifest
    - tests/support/static-server.cjs
    - tests/e2e/platform/app-integrity.spec.ts
    - tests/README.md
    - tests/e2e/platform/site-assets.spec.ts
    - PRIVACY.md

key-decisions:
  - "IN-02 的兜底只写在 swGo=true 之后的一处，复用已有的 swReloaded，controllerchange 处理器不变"
  - "IN-08 选删掉 description（D-01），不新增需要所有者过目的文案"
  - "IN-07 选请求头方案：x-usj-test 不等于 1 就 403，格式检查放在头检查之后"

requirements-completed: [OPS-04, TEST-02]

coverage:
  - id: D1
    description: "IN-02：发出 SKIP_WAITING 后 4 秒没被接管就自己刷新一次，之后等待中的版本再次出现横幅；正常接管仍只刷新一次"
    requirement: "OPS-04"
    verification:
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts#OPS-04 if the new version never takes control after the update click, the page still reloads once on its own after about four seconds and offers the update again (IN-02)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts 的另外四条更新用例（含“点两次只刷新一次”和“有草稿先确认”）"
        status: pass
    human_judgment: false
  - id: D2
    description: "IN-02 改了应用，同一次提交重新记录 APP_SHA256，结构标记各一处、没有 style 属性"
    requirement: "OPS-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline"
        status: pass
    human_judgment: false
  - id: D3
    description: "IN-06：activate 只删 usj-shell- 前缀的旧缓存，install 失败时删半套缓存；版本占位仍恰好一处"
    requirement: "OPS-04"
    verification:
      - kind: command
        ref: "grep 前缀过滤和 caches.delete(CACHE)；__BUILD_VERSION__ 计数为 1；node --check deploy/site/sw.js"
        status: pass
      - kind: e2e
        ref: "tests/cloud/sw-update.spec.ts 和 sw-offline.spec.ts 的更新、离线、只缓存外壳用例"
        status: pass
    human_judgment: true
    rationale: "install 失败路径（外壳文件取不到时删半套缓存）没有自动化用例，由代码阅读和静态检查确认"
  - id: D4
    description: "IN-08：清单没有 description，名称仍是「计划手记」"
    requirement: "OPS-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/site-assets.spec.ts#OPS-04 the web app manifest names the app and lists 192, 512 and maskable icons that exist with matching sizes (D-09)"
        status: pass
    human_judgment: false
  - id: D5
    description: "IN-07：版本开关要 x-usj-test: 1 头，无头回 403 且版本不变，带头格式不对回 400"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#ENV-03 the static server's test version switch answers 403 without the x-usj-test header and leaves the served Service Worker version unchanged"
        status: pass
    human_judgment: false
  - id: D6
    description: "IN-11 的文档部分与 D-04：tests/README、site-assets.spec 注释、PRIVACY.md 小节顺序和 Phase 16"
    requirement: "TEST-02"
    verification:
      - kind: command
        ref: "任务 3 verify 的 grep 和 PRIVACY.md 小节号递增检查"
        status: pass
    human_judgment: false
  - id: D7
    description: "兜底刷新不在用户点「点此更新」之前发生，也不绕过有草稿时的确认（prohibition，verification: judgment）"
    requirement: "OPS-04"
    verification:
      - kind: e2e
        ref: "“有草稿先确认”用例继续通过；兜底的 setTimeout 只在 swGo=true 之后、swUpdate 里创建"
        status: pass
    human_judgment: true
    rationale: "代码结构保证兜底只在点击和确认之后创建，但“不绕过确认”靠阅读代码路径判断，按计划的 fallback 规则待核实"

duration: 5min
completed: 2026-11-18
status: complete
---

# Phase 16 Plan 03: 应用、Service Worker、测试设施和隐私文档修复（IN-02、IN-06、IN-07、IN-08、IN-11）Summary

**点「点此更新」后新版本 4 秒内没接管就自己刷新一次；sw.js 只删自己的缓存并在安装失败时清掉半套缓存；清单去掉 description；测试静态服务器的版本开关要带 `x-usj-test: 1` 头；测试和隐私文档跟上现状。**

## Performance

- **Duration:** 约 5 分钟
- **Started:** 2026-11-18T05:29:18Z
- **Completed:** 2026-11-18T05:33:20Z（SUMMARY 之前最后一个任务提交完成）
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- **IN-02（应用）：** `swUpdate` 里发消息那一句改成带花括号的 `if(w){w.postMessage({type:"SKIP_WAITING"});setTimeout(()=>{if(!swReloaded){swReloaded=true;location.reload()}},4000)}else location.reload();`。兜底只出现一次，在 `swGo=true` 之后，controllerchange 处理器不变（它刷新时已把 `swReloaded` 置真，兜底不会再刷新）。上方说明注释补了一句 4 秒兜底。没有新增常量和用户可见文案。
- **新的 `APP_SHA256`：** `efa9038dc698dea77ccfed99a068f51bb26062d4b40d078907246062caa476ba`（旧值 `cc2b07d6…31ff`），和应用改动在同一次提交里。五个结构标记各一处、没有 `style="`、没有 CR。
- **IN-06（sw.js）：** activate 的过滤改成 `k.startsWith('usj-shell-') && k !== CACHE`；install 链末尾加 `.catch((err) => caches.delete(CACHE).then(() => { throw err; }))`；注释同步。版本占位仍恰好一处。
- **IN-08（清单）：** 删掉 `description`，其余字段和顺序不变，`name`、`short_name` 仍是「计划手记」。
- **IN-07（静态服务器）：** 版本开关分支开头先看 `x-usj-test`，不等于 `1` 回 403，版本不变；带头时照旧（格式对 204、不对 400）。sw-update 的 `setVersion` 带头，文件头说明同步。
- **IN-11 与 D-04（文档）：** tests/README 的放行路径写全、版本开关写明带头、csp.spec 说明改成五个视图；site-assets.spec 注释指向 `16-ACCEPTANCE.md`；PRIVACY.md 真实迁移写成 Phase 16，小节号改成 7、8、9。

## Task Commits

1. **Task 1（tracer）：IN-02 兜底刷新、重新记录 APP_SHA256、新 cloud 用例** - `2866882`（fix）
2. **Task 2：IN-06、IN-08、IN-07 和新的 ENV-03 用例** - `6c26e3c`（fix）
3. **Task 3：IN-11 的文档部分、D-04** - `5f46303`（docs）

**Plan metadata:** 见随后的 `docs(16-03)` 提交。

## 两条新用例

| 用例 | 套件 | 结果 |
|------|------|------|
| `OPS-04 if the new version never takes control after the update click, the page still reloads once on its own after about four seconds and offers the update again (IN-02)` | cloud（`tests/cloud/sw-update.spec.ts`） | 通过（5.6s，两次运行都通过） |
| `ENV-03 the static server's test version switch answers 403 without the x-usj-test header and leaves the served Service Worker version unchanged` | 默认（`tests/e2e/platform/app-integrity.spec.ts`） | 通过（270ms） |

IN-02 用例的做法：`openControlled`，`deliver` 一个 `v3` 等横幅，用 `page.evaluate` 包住 `ServiceWorker.prototype.postMessage` 丢掉 `SKIP_WAITING`，记录主框架导航和点击前时间，点按钮，等 `load`（15 秒超时），断言从点击到刷新至少 3500 毫秒、导航恰好 1 次，刷新后横幅再次出现，再等 500 毫秒导航仍是 1 次，`finally` 里调回 `SW_TEST_VERSION`。

## 检查结果

| 运行 | 报告 | REPORT 行 |
|------|------|-----------|
| 任务 1 cloud（sw-update、sw-offline、csp，10 条） | `test-results/16-03-t1c.json` | `REPORT OK expected=10 flaky=0 unexpected=0` |
| 任务 1 默认（app-integrity、escaping、smoke，18 条） | `test-results/16-03-t1v.json` | `REPORT OK expected=18 flaky=0 unexpected=0` |
| 任务 2 cloud（同三个 spec，10 条） | `test-results/16-03-t2c.json` | `REPORT OK expected=10 flaky=0 unexpected=0` |
| 任务 2 默认（app-integrity、site-assets、deploy-tools，12 条） | `test-results/16-03-t2v.json` | `REPORT OK expected=12 flaky=0 unexpected=0` |

- 全部运行经低优先级包装（`PRIORITY_BELOW_NORMAL`）、1 个 worker、不并发、只跑计划点名的 spec，没有跑全套。
- 每次提交前 `privacy-check.mjs --staged` 都打印“隐私检查通过”；三个提交的署名行都在。
- 任务 3 的 grep 检查全部通过（`DOC_OK`）。

## Decisions Made

- 兜底刷新放在 `swUpdate` 里 `postMessage` 之后，不放 controllerchange：这样“没点就不刷新、有草稿先确认”的路径不受影响。
- IN-08 删字段而不是写文案（D-01）。
- 静态服务器先检查头再检查格式，所以无头请求即使版本格式不对也回 403。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tests/README 里 v1 策略的放行路径也不准确**
- **Found during:** Task 3
- **Issue:** 计划只要求把 cloud 策略写全；同一句里 v1 策略写的是“只放行 `/` 和 `/us-journey-tracker.html`”，而 `tests/support/test.ts` 的 `V1_APP_PATHS` 还放行清单和 4 个主屏图标。只改 cloud 半句会留下一半的错话。
- **Fix:** 同一句里把 v1 半句也按 `V1_APP_PATHS` 写全。
- **Files modified:** `tests/README.md`
- **Commit:** `5f46303`

**Total deviations:** 1 auto-fixed（Rule 1）。**Impact:** 只改了计划本来就在改的那一句文档，没有扩大范围。

## Issues Encountered

None。

## Notes for Later Plans

- `deploy/README.md` 第 201 行附近仍提到「13-15 总体验收」和 `13-ACCEPTANCE.md`（13-REVIEW 的 IN-11 同一条发现），它不在本计划的 `files_modified` 里，没有改；16-04 写 `16-ACCEPTANCE.md` 时需要有人把它指过去。
- 历史的 `.planning/phases/08-*` 文件里仍写“PRIVACY.md § 9”指假令牌那一节，现在是 § 8；这些是历史计划文档，没有改。
- 设备甲上缓存的旧页面没有 IN-02 的兜底：E 项如果在设备甲上停在「正在更新…」，关掉标签页重开即可（16-04 写进清单）。新兜底从换到修复版本之后的下一次更新起作用。
- sw.js 的“install 失败先删半套缓存”没有自动化用例（需要让外壳某个文件 404 的静态服务器变体），目前靠静态检查和阅读代码确认。

## Known Stubs

None。

## Threat Flags

None：没有新增网络端点、认证路径或信任边界上的文件访问；版本开关只是更严格（要自定义头）。

## Self-Check: PASSED

- 10 个改动文件都存在；`2866882`、`6c26e3c`、`5f46303` 都是 HEAD 的祖先。
- `commits: 3` 来自 `git rev-list --count 6017f0a..HEAD`（账本文件里记录的起点），不是叙述出来的。
- 任务 1 到 3 的 acceptance_criteria 都重新核对通过（静态检查 `STATIC_OK`、`DOC_OK`，四次运行都是 REPORT OK）。
