---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 03
subsystem: app-config-seam
tags: [usj-config, config-seam, sha256-baseline, safe-02, full-suite]

requires:
  - phase: 07-02
    provides: "DEFAULT_PLAN、plan 对象、新的 APP_SHA256、BUILTIN_GROUP_SIZES"
provides:
  - "应用里的 USJ_CONFIG 配置缝：readConfig 只读 backend，null 走旧路径，其他值显示配置无效并停在加载之前（应用文件仍未被 git 跟踪）"
  - "STATUS_BACKEND_UNSUPPORTED 常量，文字与应用逐字相同"
  - "3 条配置缝用例（tests/e2e/storage/config-seam.spec.ts）"
  - "SAFE-02 的新失败文案和 1 条反向对照用例"
  - "新的 APP_SHA256（随应用改动在同一次提交里更新）"
  - "完整套件 161 条 expected、0 flaky、0 unexpected 的验收"
affects: [07-04, 07-05, 07-06, phase-09]

actuals:
  tokens: 4500
  tasks: 2
  commits: 2
plan_head_before: b21f8b86d3d47748416e85d279af310c53d33c3f
plan_head_after: 8e556295ac488cc100f5aec7052c0594fa45202e

tech-stack:
  added: []
  patterns:
    - "配置缝：window.USJ_CONFIG 由 readConfig 只读 backend 一个字段，非 null 时 init 停在加载之前，store 保持 null，flush 什么都不写"
    - "配置在 app.open 或 page.goto 之前用 page.addInitScript(fn, 参数) 注入"
    - "基线反向对照：只在内存里改一个字节算哈希，断言不等于 APP_SHA256，不写盘"

key-files:
  created:
    - tests/e2e/storage/config-seam.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/e2e/platform/app-integrity.spec.ts

key-decisions:
  - "readConfig 在 window.USJ_CONFIG 是对象且 backend 不是 null 或 undefined 时返回 {backend}，其他情况一律 {backend:null}；不读 backend 以外的任何字段（D-11：配置带不进计划）"
  - "backend 非 null 时 init 在第一次 renderAll 之后设置状态栏并 return，store 保持 null，不会悄悄退回本地；Phase 9 在这里接云端存储"
  - "配了不支持后端时导出按钮保持隐藏（init 在到达 downloads 分支之前就返回了）"

patterns-established:
  - "每次改应用都在同一次提交里更新 APP_SHA256；SAFE-02 失败文案明确要求这样做"

requirements-completed: [TEST-01, SEC-04]

coverage:
  - id: D1
    description: "USJ_CONFIG 配置缝：没配或 backend 为 null 时走旧的 localStorage 路径，配置里的 plan 被忽略，目标页仍是 7 组和位置 id"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "tests/e2e/storage/config-seam.spec.ts#TEST-01 USJ_CONFIG with backend null keeps the old local storage path and ignores a plan in the config"
        status: pass
    human_judgment: false
  - id: D2
    description: "backend 为 null 时账户模式照旧（expectAccountMode 通过）"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "tests/e2e/storage/config-seam.spec.ts#TEST-01 USJ_CONFIG with backend null keeps the old claude account path"
        status: pass
    human_judgment: false
  - id: D3
    description: "不支持的后端：状态栏显示配置无效，推过防抖后 localStorage 没有应用的键，导出按钮仍隐藏，目标页仍是 7 组"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "tests/e2e/storage/config-seam.spec.ts#TEST-01 an unsupported USJ_CONFIG backend shows the config error and saves nothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "SAFE-02 反向对照：内存里改一个字节后哈希不等于 APP_SHA256，磁盘文件不变；失败文案改为要求在同一次提交里更新基线"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#SAFE-02 a one-byte change to the app no longer matches the baseline"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline"
        status: pass
    human_judgment: false
  - id: D5
    description: "v1 的 154 条用例在改动后的应用上走旧路径全部通过（8 条已知 bug 标记用例仍是预期失败），完整套件 161 条 expected、0 flaky"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "npm test -- --workers=1（低优先级）加 tools/test-report/check-report.mjs --min-expected 161（REPORT OK expected=161 flaky=0 unexpected=0）"
        status: pass
    human_judgment: false
  - id: D6
    description: "没有任何本机加载所有者计划的入口：配置只读 backend，用例给配置带合成计划，目标页仍是示例计划"
    requirement: SEC-04
    verification:
      - kind: e2e
        ref: "tests/e2e/storage/config-seam.spec.ts#TEST-01 USJ_CONFIG with backend null keeps the old local storage path and ignores a plan in the config"
        status: pass
    human_judgment: false

duration: 约 9 分钟
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 03: USJ_CONFIG 配置缝与基线反向对照 Summary

**应用加入只读 backend 一个字段的 USJ_CONFIG 配置缝：没配后端走旧路径，配了不支持的后端显示配置无效且不保存、不退回本地；SAFE-02 加上内存改一个字节的反向对照；完整套件 161 条 expected、0 flaky。**

## Performance

- **Duration:** 约 9 分钟（约 18:08Z 到 18:18Z）
- **Completed:** 2026-11-07T18:18Z
- **Tasks:** 2（Task 1 为 tracer）
- **Files modified:** 5（1 个新建、4 个修改；应用文件本身仍未被 git 跟踪，不在提交里）

## Accomplishments

- **配置缝的行为（三种配置各自的结果）：**
  - 没有 USJ_CONFIG，或 `{backend: null}`（哪怕另带 plan）：走旧的 `window.claude` / localStorage 路径，一字未改；本地模式记一笔能保存，目标页仍是 DEFAULT_PLAN 的 7 组和位置 id，配置里的 plan 被忽略。
  - `{backend: null}` 加账户 mock：账户模式照旧，`expectAccountMode` 通过。
  - `{backend: 'synth-backend'}`：状态栏显示 `STATUS_BACKEND_UNSUPPORTED`；记一笔并把 manual 时钟推过 600 ms 防抖后 localStorage 里没有应用的键，状态栏文案不变，两个导出按钮仍带 hidden 类，目标页仍是 7 组。
- **应用改动：** 在 saving 一节之后、`init()` 之前加了 `/* ---------- config ---------- */` 横幅、`readConfig()` 和 `const USJ=readConfig();`；`init()` 在第一次 `renderAll()` 之后加一句：`USJ.backend!==null` 时 `setStatus(...)` 并 return。`readConfig` 用 try/catch 读 `window.USJ_CONFIG`，只读 `backend`。
- **新的 APP_SHA256：** `7f57f04a3eed1a51b01b3133c367b0115225275bb3ee614bc2b73708b92a209b`（旧值 `6dbc1ff66026981f007f7bec310256af95c6e0f102c57bc438aa129f404338eb`），随 Task 1 的提交一起更新。
- **SAFE-02：** 失败文案改为“应用与基线不一致：确认改动是有意的之后，在同一次提交里更新 tests/support/constants.ts 的 APP_SHA256”，逻辑不变；新增反向对照：原样哈希等于基线，内存里把最后一个字节异或 1 后不等于基线，磁盘文件不变。
- **完整套件（本计划唯一的一次）：** 低优先级、单 worker，`REPORT OK expected=161 flaky=0 unexpected=0`。161 = v1 的 154 + 07-02 的 3 + 本计划的 4（3 条配置缝加 1 条 SAFE-02 反向对照）。8 条已知 bug 标记用例（B1、B1 calendar、N1、N1 delete、N1 goals、B4、B2、N3）都在 check-report 的标题清单里并仍按预期失败计为通过，没有一条意外通过。7 条新用例标题和 SAFE-02 基线标题全部通过。
- **受保护路径和私有原件：** Playwright 配置、package 文件、test.ts、app.ts、mocks、check-report、.githooks 的对象哈希与阶段前一致且工作区无改动；私有原件副本哈希仍是 v1 基线；应用文件仍未被 git 跟踪。

## Task Commits

1. **Task 1（tracer）：USJ_CONFIG 配置缝从注入到存储一次打通** - `7dce65b`（feat；提交里是 constants.ts、strings.ts 和新 spec，应用文件被忽略）
2. **Task 2：SAFE-02 的新文案和反向对照** - `8e55629`（test）

**Plan metadata:** 由紧随其后的 docs 提交记录（本 SUMMARY 加 STATE、ROADMAP、REQUIREMENTS 更新）。

## Files Created/Modified

- `us-journey-tracker.html` - config 横幅、`readConfig`、`USJ`；init 里不支持的后端分支（未被 git 跟踪）。
- `tests/support/constants.ts` - 新的 APP_SHA256。
- `tests/support/strings.ts` - 新增 `STATUS_BACKEND_UNSUPPORTED`。
- `tests/e2e/storage/config-seam.spec.ts` - 新建；三条 TEST-01 用例。
- `tests/e2e/platform/app-integrity.spec.ts` - SAFE-02 新失败文案和反向对照用例。

## Decisions Made

- 不支持的后端分支放在第一次 `renderAll()` 之后：页面先显示示例计划的空壳视图，状态栏明确提示配置无效；store 保持 null，所以 `flush` 和 `pagehide` 都不会写任何东西。
- 配置缝不提供任何带计划进来的入口（D-11）；用例给配置带了一份合成计划来证明被忽略。

## Deviations from Plan

None - plan executed exactly as written。

补充说明（不算偏离）：
- 本会话的提交署名行按运行时要求是 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`，与计划里写的 Opus 署名不同，以运行时为准。
- Task 2 第一次尝试用 node 脚本按字面串替换 spec 文本时没有命中（文件是 CRLF 行尾，换行不匹配），脚本抛错后没有写入任何内容，改用 Edit 工具后正常；随后的验证命令里第一次 SAFE-02 反向对照标题“未运行”也源于此，不是用例问题。

## Issues Encountered

None。

## Known Stubs

无。

## Threat Flags

无新增网络、认证或文件访问面。USJ_CONFIG 是页面外部注入的只读配置，计划威胁登记册（T-07-07、T-07-22）已覆盖，对应的缓解都有用例证明。

## 假设与未覆盖

- 配置缝只放缝，没有任何后端接入；Phase 9 在 init 的这个分支里接云端存储，那时才需要 `backend` 取值的约定和对应用例。
- 本计划的中间提交带着新的 APP_SHA256，而应用要到 07-04 才进 git，所以单独克隆这些提交时 SAFE-02 会失败；这是计划里已知并接受的取舍。
- 完整套件结果以 check-report 判定的 expected 为准，没有逐条比较耗时和注解（计划里已记录为假设）。

## User Setup Required

None - no external service configuration required。

## Next Phase Readiness

- 07-04 可以把应用提交进 git（同时更新规则 A 和 `.gitignore`），并做示例计划的人工检查点。
- 07-05、07-06 的转义和白名单可以继续用 `loadAppPure`。
- 没有阻塞项。

## Self-Check: PASSED

- `tests/e2e/storage/config-seam.spec.ts` 存在；应用文件存在且未被跟踪；应用 sha256 等于 APP_SHA256。
- 提交 `7dce65b`、`8e55629` 都在 HEAD 的祖先链上；`git rev-list --count` 得到 2。
- 两个任务的 verify 命令全部通过：静态检查、配置缝加冒烟加应用完整性（REPORT OK expected=13）、app-integrity（REPORT OK expected=6）、完整套件（REPORT OK expected=161）、受保护路径不变量。
- 本 SUMMARY 和提交说明里没有原计划的文字或个人数字。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
