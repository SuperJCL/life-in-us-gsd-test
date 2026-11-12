---
phase: 13-deploy-hardening-acceptance
plan: 04
subsystem: site-build-csp
tags: [csp, sha256, build-site, cssom, service-worker-version, playwright, sec-02, ops-04]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-01 的 sw.js（__BUILD_VERSION__ 占位）；13-02 的清单和 4 个图标；13-03 的更新横幅和测试静态服务器
  - phase: 9-cloud-login
    provides: USJ_CONFIG 的约定（backend 为 pocketbase，地址取 location.origin）和同源加载的 SDK
provides:
  - deploy/build-site.mjs：normalizeNl、cspHash、inlineBlocks、injectConfig、buildCsp、cspConf、shellVersion、sdkPinnedHash、sumsOf、buildSite、checkOutDir；CLI --out、--self-test
  - 构建输出 site/（index.html、sw.js、manifest.webmanifest、icons、vendor）、server/nginx/usj-csp.conf、BUILD_VERSION、SHA256SUMS
  - 应用目标页的进度条改成 data-w 加一次 CSSOM 赋值（goalsBars）
  - tests/cloud/csp.spec.ts：2 条 SEC-02 用例
affects: [13-07 nginx 站点安装, 13-08 verify-site 和服务器脚本, 13-10, 13-11 上传, 13-15 总体验收]

actuals:
  tokens: 7200
  tasks: 2
  commits: 3
plan_head_before: 0a32679bfb155f1bc1e390936e03131f1c75ec0d
plan_head_after: 8482e7019d43344c7d704bc3e6e82dcd355240a2

tech-stack:
  added: []
  patterns:
    - "发布版页面和 CSP 头出自同一次构建：哈希从最终页面的内联块（按浏览器归一后的 LF 文字）算出，直接写进 nginx 头文件"
    - "进度条模板只写 data-w，每次整页重画后统一 el.style.width 赋值，style-src-attr 'none' 下照常显示"
    - "CSP 用例跑真实 CLI，用页面级 route 把 / 换成构建出的页面并带上头文件里的同一条头；初始化脚本收集 securitypolicyviolation"
    - "外壳版本 = 页面、SDK、清单、4 个图标的 sha256 前 12 位；文本一律先归一成 LF，所以版本不随检出换行变化"

key-files:
  created:
    - deploy/build-site.mjs
    - tests/cloud/csp.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/expect-from-fixture.ts
    - tests/support/goals.ts

key-decisions:
  - "选 RESEARCH 推荐的严格方案（哈希加 style-src-attr 'none'），不用 unsafe- 折中；策略里没有任何 unsafe- 关键字"
  - "仓库里的页面保持本地版；USJ_CONFIG 只在构建输出的 index.html 里，作为主内联脚本之前单独的一行小脚本"
  - "构建里的文本（页面、sw.js、清单、SDK 校验文件）一律归一成 LF 再算哈希和版本；图标和 SDK 保持原字节"
  - "goalsBars() 在两个分支（空计划只显示已归档区、正常分支）重画之后都调用，因为 archivedHTML() 的进度条在两个分支里都会出现"

requirements-completed: [SEC-02, OPS-04]

coverage:
  - id: D1
    description: "发布版页面在它自己的 CSP 下，登录、四个视图、编辑计划页改名保存、导出备份、选文件导入全程零 securitypolicyviolation、零 console 违规；目标页进度条宽度照常显示"
    requirement: SEC-02
    verification:
      - kind: e2e
        ref: "tests/cloud/csp.spec.ts#SEC-02 the built site page runs under its Content-Security-Policy without a violation through sign-in, the four views, the plan editor, export and import"
        status: pass
    human_judgment: false
  - id: D2
    description: "反向对照：策略里去掉样式哈希后页面的内联样式被拦，恰好一条 style-src 违规和一条 console.error，证明零违规断言不是空转"
    requirement: SEC-02
    verification:
      - kind: e2e
        ref: "tests/cloud/csp.spec.ts#SEC-02 a page block whose hash is missing from the policy is blocked and reported, so the zero-violation check is not vacuous"
        status: pass
    human_judgment: false
  - id: D3
    description: "构建可重复、可自检：同一输入两次构建 SHA256SUMS 逐字节相同，版本号 12 位十六进制并写进 sw.js，输出目录限制，SDK 钉死值核对"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "node deploy/build-site.mjs --self-test (SELF-TEST OK (24 cases))"
        status: pass
      - kind: other
        ref: "两次 node deploy/build-site.mjs --out test-results/13-04-a 和 13-04-b；cmp SHA256SUMS；sha256sum -c --strict；--out deploy 退出 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "线上 nginx 实际发出这条头、浏览器在真实线上页面上零违规（本计划只到本机层面）"
    requirement: SEC-02
    verification: []
    human_judgment: true
    rationale: "nginx 安装在 13-07，线上逐个比对哈希在 13-08 的 verify-site，真机核对在 13-15 总体验收"

duration: 32min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 04: 站点构建与严格 CSP Summary

**`deploy/build-site.mjs` 从仓库页面生成发布版页面（单独插入云端开关）、哈希放行内联块的严格 CSP 头文件和按外壳哈希定版本的 sw.js；目标页进度条改成 data-w 加 CSSOM 赋值，发布版在零 unsafe- 的策略下完整可用。**

## Performance

- **Duration:** 32 min（含一次完整 cloud 套件 11.3 分钟和一次完整默认套件 3.6 分钟）
- **Completed:** 2026-11-12
- **Tasks:** 2（tracer 加一个 TDD 任务）
- **Files modified:** 6（2 个新增，4 个修改）

## Accomplishments

- **最终的 CSP（哈希用占位代替）：** `default-src 'none'; script-src 'self' 'sha256-<配置脚本>' 'sha256-<主脚本>'; style-src 'sha256-<样式>'; style-src-attr 'none'; connect-src 'self'; img-src 'self'; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; object-src 'none'; frame-ancestors 'none'`。不含任何 unsafe- 开头的关键字。
- **应用：** 4 处进度条（两处力量项 `.lbar`、两处目标组 `.bar`，含已归档区）的内联宽度换成 `data-w`；`goalsBars()` 在两个分支的 `innerHTML` 之后统一赋 `style.width`。界面看起来没有变化。
- **构建输出的文件清单（12 个）：** `site/index.html`、`site/sw.js`、`site/manifest.webmanifest`、`site/icons/` 下 4 个 PNG、`site/vendor/pocketbase.iife.js`、`site/vendor/SHA256SUMS`、`server/nginx/usj-csp.conf`、`BUILD_VERSION`、`SHA256SUMS`。输出里没有域名、地址和密钥。
- **自检：** `--self-test` 最后一行 `SELF-TEST OK (24 cases)`（要求不少于 11）。
- **套件条数：** `--list` 确认 cloud 248、默认 195；完整 `npm run test:cloud` 248 passed，`REPORT OK expected=248 flaky=0 unexpected=0`（11.3 分钟）；完整默认 `npm test` 195 passed，`REPORT OK expected=195 flaky=0 unexpected=0`（3.6 分钟）。
- **外壳版本：** 当前构建的 `BUILD_VERSION` 为 `a1159ad93165`；两次构建 `SHA256SUMS` 逐字节相同，`sha256sum -c --strict` 全部 OK，`--out deploy` 退出码 2。

## Task Commits

1. **Task 1（tracer）：build-site 核心、data-w 加 CSSOM、第一条 CSP 用例、新的 APP_SHA256** - `ffd8b73`（feat）
2. **Task 2 RED：完整构建的自检用例（24 条里 10 条失败）和反向对照用例** - `a57e29b`（test）
3. **Task 2 GREEN：外壳版本、SDK 核对、SHA256SUMS、输出目录限制、CLI 完整输出** - `8482e70`（feat）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## TDD 说明

- **RED：** 自检用例在只有 Task 1 构建的脚本上运行，`SELF-TEST FAIL (10 of 24)`，失败项正是版本、sw 模板、SDK 核对、SHA256SUMS、输出清单、确定性这些新行为。反向对照用例在 Task 1 的构建上本来就能通过（它只依赖 Task 1 已有的哈希和策略），它固定的是“零违规断言不是空转”，不是 RED 的触发点。
- **GREEN：** 补全 `buildSite` 等函数后自检 24 条全过。
- **REFACTOR：** 无。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 进度条宽度经 CSSOM 赋值后被浏览器规整成 6 位有效数字，旧的测试期望值不再相等**
- **Found during:** Task 1（默认套件的目标页用例）
- **Issue:** `i.style.width = "16.666666666666664%"` 读回的 style 属性是 `16.6667%`，GOAL-01、GOAL-03、GOAL-04、GOAL-05 里 6 条用例的 `barPct` 逐值比较失败（视觉上没有差别）。
- **Fix:** `tests/support/expect-from-fixture.ts` 的期望值按同样的精度算（`toPrecision(6)`）；`goals.ts` 只改注释。csp.spec 里比较 data-w 和 style.width 也用数值容差（小于 0.001）。
- **Files modified:** tests/support/expect-from-fixture.ts、tests/support/goals.ts
- **Verification:** 目标页、安全、app-integrity 子集 34 条 REPORT OK，随后完整默认套件 195 条 REPORT OK
- **Committed in:** ffd8b73

**2. [Rule 1 - Bug] 反向对照用例里 console.error 的措辞与预期不同**
- **Found during:** Task 2（RED 之前先跑反向对照用例）
- **Issue:** 本机 Edge 对被拦的内联样式写的是 `Applying inline style violates the following Content Security Policy directive ...`，不是 `Refused to apply inline style`。
- **Fix:** `acknowledgeConsoleErrors` 的片段改成 `Applying inline style violates the following Content Security Policy directive`，仍精确到 1 条。
- **Files modified:** tests/cloud/csp.spec.ts
- **Committed in:** a57e29b

**3. [Rule 2 - 范围补充] goalsBars() 在空计划分支也要调用**
- **Found during:** Task 1
- **Issue:** 计划只写“正常分支那次 innerHTML 之后”加一句；但空计划分支的 `innerHTML` 也拼了 `archivedHTML()`，里面有进度条，不加会让已归档区的进度条宽度为 0。
- **Fix:** 抽成 `goalsBars()`，两个分支都调用；`i[data-w]` 仍恰好 1 处、`data-w="` 恰好 4 处。
- **Files modified:** us-journey-tracker.html
- **Committed in:** ffd8b73

---

**Total deviations:** 3 auto-fixed（2 个 Rule 1，1 个 Rule 2）
**Impact on plan:** 都是为了让计划的目标成立（测试精度、措辞、归档区进度条），没有加范围。

## Issues Encountered

- 写构建脚本补丁时，用脚本替换文本的方式把 `\n` 和 `\S` 写坏过一次（语法错误），已用 `node --check` 发现并改正，没有提交过坏文件。
- 没有留下排查用的临时文件；测试结束后没有遗留 `msedge.exe`（带 remote-debugging-pipe）或 `find.exe` 进程。

## Known Stubs

无。

## Threat Flags

无新增攻击面：本计划只加构建脚本（本机运行、只写 `private/deploy-out` 或 `test-results/` 下的目录、只读仓库里的固定文件）。T-13-06 的缓解（策略只放 `'self'` 和哈希、`style-src-attr 'none'`、无 unsafe-）和 T-13-07 的缓解（页面与头同一次构建）已在本机层面有用例和自检对应；T-13-08 的 `frame-ancestors 'none'` 已在策略里，由 13-07 的 nginx 发出。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 13-07 的 nginx 安装只需 include `server/nginx/usj-csp.conf` 并把 `site/` 放到站点目录；13-08 的 verify-site 在线上逐个比对内联块哈希和 `BUILD_VERSION`；服务器脚本、迁移、钩子在 13-08 起加进同一个构建输出。
- `deploy/build-site.mjs --out` 只接受 `private/deploy-out` 或 `test-results/` 下的目录。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/build-site.mjs、tests/cloud/csp.spec.ts
- FOUND: commits ffd8b73、a57e29b、8482e70（都在 HEAD 的祖先里）
- 两个任务的验收命令全部通过（grep 检查、段标记各一次、APP_SHA256 一致、构建与自检、`--out deploy` 退出 2、两个完整套件 REPORT OK、隐私检查通过）
