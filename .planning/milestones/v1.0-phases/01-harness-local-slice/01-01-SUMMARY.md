---
phase: 01-harness-local-slice
plan: 01
subsystem: testing
tags: [playwright, msedge, static-server, network-guard, frozen-clock, localstorage]

requires: []
provides:
  - "package.json 与 package-lock.json：@playwright/test 精确锁定 1.64.1，scripts 只有 test 和 test:ui"
  - "playwright.config.ts：msedge 通道、webServer、list+html 报告器、时区与语言、--host-resolver-rules 与无条件死代理"
  - "tests/support/static-server.cjs：零依赖、只监听 127.0.0.1、只提供一个文件的静态服务器"
  - "tests/support/test.ts：唯一的 test/expect 出口，auto fixture guard 与 frozenClock"
  - "tests/support/constants.ts 与 strings.ts：常量与界面中文文案的唯一来源"
  - "tests/e2e/smoke.spec.ts：IO-01 本地模式往返用例（记一笔、poll localStorage、reload、断言 DOM）"
affects: [01-02, 01-03, 01-04, phase-02, phase-03, phase-04, phase-05]

actuals:
  tokens: 3250
  tasks: 3
  commits: 1
plan_head_before: 8504f092b0f9c53b524e45a091247f7ed6b6c836
plan_head_after: 12d6bd9ec35c4f31411214af543cb3c48491fe77

tech-stack:
  added: ["@playwright/test 1.64.1 (devDependency, exact pin)"]
  patterns:
    - "所有 spec 只从 tests/support/test.ts 导入 test 和 expect"
    - "auto fixture：guard（单个 context.route 分流）与 frozenClock（导航前 setFixedTime）"
    - "浏览器级网络兜底写在 launchOptions：--host-resolver-rules 加死代理 127.0.0.1:9"
    - "持久化断言顺序：先等状态行就绪，再 expect.poll localStorage，最后 reload 并断言 DOM"

key-files:
  created:
    - package.json
    - package-lock.json
    - playwright.config.ts
    - tests/support/static-server.cjs
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/support/test.ts
    - tests/e2e/smoke.spec.ts
  modified: []

key-decisions:
  - "按计划保留 launchOptions.proxy 死代理；它与 127.0.0.1:4789 的页面加载共存，没有出现 ERR_PROXY_CONNECTION_FAILED，不需要触发规则 4 检查点"
  - "Edge 156.0.4314.58 无需任何下载即可被 Playwright 1.64.1 驱动，Task 3 检查点未触发"

patterns-established:
  - "中文注释加英文标识符：注释、说明文档用中文，变量、文件、目录名用英文"
  - "合成文本用 SYNTH- 前缀，不含任何个人计划文字"

requirements-completed: [ENV-01, ENV-02, ENV-03, ENV-04, SAFE-01, IO-01]

coverage:
  - id: D1
    description: "npm test 用本机 Edge 无界面跑通 IO-01 往返用例，并生成不自动打开的 HTML 报告"
    requirement: "ENV-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#IO-01 saves an entry to localStorage and keeps it after reload"
        status: pass
    human_judgment: false
  - id: D2
    description: "依赖集合、锁文件和无浏览器缓存证明安装方式合规（精确 1.64.1，无 tsconfig，无 ms-playwright 目录，无全局 playwright）"
    requirement: "ENV-02"
    verification:
      - kind: other
        ref: "npm ls --all; node -e 校验 package.json 形态; test ! -e $LOCALAPPDATA/ms-playwright"
        status: pass
    human_judgment: false
  - id: D3
    description: "页面来自 127.0.0.1:4789 的零依赖静态服务器，reuseExistingServer 为 false"
    requirement: "ENV-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts（页面经 webServer 加载）"
        status: pass
    human_judgment: true
    rationale: "冒烟用例只证明白名单路径能加载；404、路径穿越和只监听回环地址的运行时证据由 Plan 02 补上，计划检查已把此项列为接受的警告"
  - id: D4
    description: "固定时钟与 guard 的 teardown 断言从第一次运行起生效（日期 2026-03-18、无白名单外请求）"
    requirement: "ENV-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts（落盘 date 等于 2026-03-18）"
        status: pass
    human_judgment: false
  - id: D5
    description: "浏览器级网络兜底（--host-resolver-rules 与死代理）已配置并与本地页面共存"
    requirement: "SAFE-01"
    verification: []
    human_judgment: true
    rationale: "这两层的实际拦截效果由 Plan 03 的 PROBE-2 断言；本计划只证明配置存在且不阻止 127.0.0.1"

duration: 4min
completed: 2026-11-02
status: complete
---

# Phase 1 Plan 01: Walking Skeleton Summary

**Playwright 1.64.1 驱动本机 Edge 156，通过零依赖 127.0.0.1 静态服务器，在网络护栏、死代理和固定时钟保护下跑通本地模式 IO-01「记一笔、刷新后还在」往返用例**

## Performance

- **Duration:** 4 min（Task 2 恢复执行起算；Task 1 检查点的等待时间不计入）
- **Started:** 2026-11-02T03:33:30Z
- **Completed:** 2026-11-02T03:37:07Z
- **Tasks:** 3（Task 1 为检查点，已批准；Task 2 完成；Task 3 为条件检查点，未触发）
- **Files modified:** 8（全部为新增）

## Accomplishments

- `npm test` 在仓库根目录无界面跑完 `tests/e2e/smoke.spec.ts`，连续 3 次全部通过，没有 flaky，`playwright-report/index.html` 生成且不自动弹出。
- 安装全程没有下载浏览器，也没有全局安装：`$LOCALAPPDATA/ms-playwright` 不存在，`npm ls -g --depth=0` 里没有 playwright，仓库根目录没有 tsconfig.json。
- `npm ls --all` 显示 `@playwright/test` → `playwright` → `playwright-core`，三者都是 1.64.1，没有 UNMET 或 invalid；`package-lock.json` 三个条目都锁定 1.64.1。
- 无条件的死代理（`http://127.0.0.1:9`，bypass 只有 `127.0.0.1,localhost`）与 `127.0.0.1:4789` 的页面共存，页面正常加载，IO-01 通过。
- 应用文件 `us-journey-tracker.html` 未被跟踪、未被修改，sha256 仍是基线 `2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872`。

## 版本记录

- Edge：156.0.4314.58（`chromium.launch({ channel: 'msedge' })` 的 `browser.version()`）
- Playwright：1.64.1（`@playwright/test`、`playwright`、`playwright-core` 一致）
- Node：v24.20.0，npm：11.19.0

## Task 1 确认结论

用户在检查点回复 `approved`，同意用 `npm install --ignore-scripts` 把 `@playwright/test@1.64.1` 安装进项目。只读的 `npm view` 查询已核对：三个包版本都是 1.64.1，license 为 Apache-2.0，repository 指向 github.com/microsoft/playwright，maintainers 为 Microsoft 账号，没有 install、preinstall、postinstall 脚本，依赖链是精确版本的 `@playwright/test` → `playwright` → `playwright-core`。

## Task 3 是否触发

**Edge 检查点未触发。** Task 2 的 `npm test` 第一次运行就用 msedge（156.0.4314.58）通过，没有出现找不到 Edge 发行版、提示运行 playwright install 或启动超时的情况。全程没有运行任何安装器，也没有改用 Chrome。

## Task Commits

1. **Task 1: 安装前确认包合法性（blocking-human 检查点）** - 无提交（只做只读查询，用户已批准）
2. **Task 2: Walking Skeleton（type=tracer）** - `12d6bd9`（feat）；提交经过 pre-commit 隐私钩子，输出「隐私检查通过（staged，8 个文件）」，没有使用 `--no-verify`
3. **Task 3: 条件检查点（Edge 无法驱动时）** - 未触发，无提交

**Tracer feedback gate:** 非 auto 模式，`HUMAN_VERIFY_MODE=end-of-phase`，tracer 的 `<verify>` 只有 `<automated>`，所以提交后重新跑了 `npm test`、`npm ls --all` 和环境断言，全部通过，记录「Tracer verified end-to-end — expanding」，没有合成人工检查点。

**Plan metadata:** 见本计划随后的 docs 提交。

## Files Created/Modified

- `package.json` - 私有包，scripts 只有 test 和 test:ui，devDependencies 只有 `@playwright/test` 1.64.1
- `package-lock.json` - npm 生成的锁文件，只含 registry 元数据
- `playwright.config.ts` - msedge 通道、webServer（reuseExistingServer: false）、list+html 报告器、时区与语言、浏览器级网络兜底
- `tests/support/static-server.cjs` - 只提供 `/` 与 `/us-journey-tracker.html`，其余 404，监听 127.0.0.1
- `tests/support/constants.ts` - PORT、APP_ORIGIN、STATE_KEY、FROZEN_NOW、DEAD_PROXY_SERVER、PROXY_BYPASS 等常量
- `tests/support/strings.ts` - STATUS_LOCAL、TOAST_RECORDED、CAT_LANGUAGE
- `tests/support/test.ts` - 唯一出口，auto fixture guard 与 frozenClock
- `tests/e2e/smoke.spec.ts` - IO-01 往返用例

## Decisions Made

- 死代理放在 `launchOptions.proxy`（浏览器级）而不是 `use.proxy`，这样后续探针手动创建的 context 也自动带上；实测与回环页面共存，保留不动。
- guard 的 fixture 返回 `{ expectedAborts, unexpectedRequests }`，Plan 02 可以在同一个 fixture 里补页面错误收集并暴露状态。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- 提交时 git 提示 `LF will be replaced by CRLF`（Windows 的 autocrlf 设置），只是换行符警告，不影响内容和隐私钩子，没有处理。

## Accepted Warnings 的处理情况（STATE.md 的 6 条计划检查警告）

- 与本计划相关的是「01-01 的部分 truths 写的是配置字面量」：已用 `grep -F` 逐条核对了全部配置字面量，同时用真实的 `npm test` 运行验证行为，二者都通过。
- ENV-03「只监听 127.0.0.1」的运行时证据：本计划只在代码里写了 `listen(PORT, '127.0.0.1')`，运行时证据留给 Plan 02。
- 其余 4 条（路径穿越检查、SAFE-04 控制台过滤、PROBE-2 解析层证人、01-03 Task 2 范围）属于 Plan 02 和 Plan 03，本计划不涉及。

## Known Stubs

None.

## Threat Flags

None - 本计划新增的静态服务器、死代理和 guard 均已在计划的 threat_model 中（T-01-02、T-01-03、T-01-05）。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 02 可以直接在 `tests/support/test.ts` 的 guard 里补页面错误收集，并为静态服务器补 404 与路径穿越检查。
- Plan 03 的 PROBE-2 需要证明 `--host-resolver-rules` 和死代理的实际拦截效果；本计划只证明配置存在且不阻止 127.0.0.1。
- 没有阻塞项。

## Self-Check: PASSED

- 8 个文件都存在于磁盘并已被提交；提交 `12d6bd9` 是 HEAD 的祖先。
- 重跑 Task 2 的全部 `<automated>` 与 acceptance_criteria 命令，全部通过。

---
*Phase: 01-harness-local-slice*
*Completed: 2026-11-02*
