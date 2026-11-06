---
phase: 01-harness-local-slice
plan: 04
subsystem: testing
tags: [readme, determinism, json-reporter, privacy-check, ui-mode, show-report, human-verify]

requires:
  - phase: 01-harness-local-slice
    provides: "Plan 03 的 AppHarness、六项探针和 tests/PROBES.md；Plan 01、02 的配置、护栏和隐私钩子"
provides:
  - "tests/README.md：中文使用说明（运行、看报告、应用文件不在仓库里、护栏、浏览器问题、隐私、探针结论）"
  - "playwright.config.ts 的 PW_JSON_REPORT 可选 json 文件报告器（默认报告器仍是 list 加 html，open: 'never'）"
  - "阶段末人工验收结论：test:ui 能回放 IO-01，show-report 能打开报告，全程没有安装提示"
affects: [phase-02, phase-03, phase-04, phase-05]

actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: 6ee6ed80087e6e03ac461f1a638ebb0b27196be0
plan_head_after: bb501633b6eae6d3c800a7858792c9c48a1fc1c1

tech-stack:
  added: []
  patterns:
    - "确定性检查跑交付配置本身，只用 PW_JSON_REPORT 多写一个结果文件，命令行不传报告器参数"
    - "README 的网络护栏一节以 tests/PROBES.md 为准，只写已证明的层，推断单独标明"

key-files:
  created:
    - tests/README.md
  modified:
    - playwright.config.ts
    - tests/README.md

key-decisions:
  - "报告器默认不变（list 加 html，open: 'never'），json 只在设置 PW_JSON_REPORT 时追加，供收尾的确定性检查使用"
  - "README 把 preconnect 写成“由已证明的两层推断，没有被直接观察到”，与 PROBES.md 一致"
  - "用户在内嵌终端运行 show-report 时浏览器不会自动打开，README 补一条说明：手动打开终端打印的 localhost 地址"

requirements-completed: [ENV-01, ENV-04]

coverage:
  - id: D1
    description: "中文 tests/README.md 覆盖运行、看报告、应用文件、隐私规则、浏览器问题和网络护栏分层"
    requirement: "ENV-01"
    verification:
      - kind: command
        ref: "Task 1 automated: 13 个必须出现的字面量全部在 tests/README.md 中找到"
        status: pass
    human_judgment: false
  - id: D2
    description: "连续两次用交付配置运行 npm test，结果一致，flaky 和 unexpected 为 0，没有用到重试"
    requirement: "ENV-04"
    verification:
      - kind: command
        ref: "Task 1 automated: PW_JSON_REPORT 两次运行，两次 25 条 title=status 列表完全相同，playwright-report/index.html 重新生成"
        status: pass
    human_judgment: false
  - id: D3
    description: "隐私全量检查通过，应用文件未被跟踪且 sha256 不变"
    requirement: "ENV-01"
    verification:
      - kind: command
        ref: "node tools/privacy/privacy-check.mjs --all（52 个文件，退出 0）；sha256 与基线一致；git ls-files us-journey-tracker.html 为空"
        status: pass
    human_judgment: false
  - id: D4
    description: "UI 模式参数存在，show-report 由项目内的 Playwright 提供，不会去 registry 下载"
    requirement: "ENV-01"
    verification:
      - kind: command
        ref: "npm run --silent test:ui -- --help 退出 0 且含 --ui；npx --no playwright show-report --help 退出 0，没有 Need to install"
        status: pass
    human_judgment: false
  - id: D5
    description: "用户亲自用 npm run test:ui 回放 IO-01，用 npx playwright show-report 打开报告，全程无安装提示"
    requirement: "ENV-01"
    verification: []
    human_judgment: true
    rationale: "图形窗口和浏览器里的报告只能由人确认；用户回复 approved，UI 模式的浏览器品牌用户未在窗口上确认（按配置为 msedge）"

duration: 约 25min（含等待人工验收）
completed: 2026-11-02
status: complete
---

# Phase 1 Plan 04: 中文 README、阶段收尾与人工验收 Summary

**中文 tests/README.md 写清了运行、看报告和网络护栏分层；连续两次交付配置运行 25 条用例结果完全一致且 flaky 为 0；隐私全量检查通过；用户亲自确认 UI 模式能回放 IO-01、show-report 能打开报告，全程没有任何安装提示**

## Performance

- **Duration:** 约 25 min（20:09 到 20:34，本地时间，含等待人工验收）
- **Tasks:** 2（Task 1 自动任务；Task 2 为阶段末 blocking-human 检查点，已由用户批准）
- **Files modified:** 2（`tests/README.md` 新增，`playwright.config.ts` 修改）

## Accomplishments

- **README（Task 1）：** 按计划的 10 节顺序写成中文；13 个必须出现的字面量（`npm test`、`npm run test:ui`、`npx playwright show-report`、`npm ci --ignore-scripts`、`git config core.hooksPath .githooks`、`PW_CHANNEL`、`us-journey-tracker.html`、`PRIVACY.md`、`PROBES.md`、`--no-verify`、`npx playwright install`、`_synthetic`、`preconnect`）全部存在。网络护栏一节分三道写明，并写明 preconnect 是推断而不是直接观察（沿用 Plan 03 的结论）。
- **json 报告器：** `playwright.config.ts` 只在设置 `PW_JSON_REPORT` 时追加 `['json', { outputFile }]`；`list` 和 `['html', { open: 'never', ... }]` 保持原样，`launchOptions` 里的 args 和死代理没有动。
- **两次确定性运行：** 先删除 `playwright-report/`，再设置 `PW_JSON_REPORT` 连续跑两次交付配置的 `npm test`。两次都是 25 条通过，unexpected 0、flaky 0，没有用到重试；两次 `title=status` 列表逐字相同；`playwright-report/index.html` 由这两次运行重新生成，npm test 结束后没有自动弹出报告。
- **隐私全量检查：** `node tools/privacy/privacy-check.mjs --all` 覆盖 52 个文件，退出 0。应用文件 sha256 仍是基线 `2a954fd0…a1872`，`git ls-files us-journey-tracker.html` 为空。
- **两条只读帮助检查：** `npm run --silent test:ui -- --help` 退出 0 且输出含 `--ui`；`npx --no playwright show-report --help` 退出 0，没有出现 `Need to install`。

## 阶段末人工验收（Task 2）

用户回复 **approved**。编排者整理的三点观察：

1. **`npm run test:ui`：** UI 模式窗口打开，IO-01 能运行，并能逐步回放，每一步都有页面快照。没有安装提示。
2. **`npx playwright show-report`：** 查看服务正常启动，打印 `Serving HTML report at http://localhost:9323. Press Ctrl+C to quit.`。但**浏览器没有自动打开**：用户是在 Claude 桌面应用内嵌的 PowerShell 终端里运行的。编排者随后在浏览器里打开 `http://localhost:9323`，确认报告能加载（Passed 1、Failed 0、Flaky 0；IO-01 带 “View Trace”），用户看到后批准。全程没有安装提示。
3. **UI 模式实际用的浏览器：** 用户不确定。按配置为 msedge（`PW_CHANNEL` 未设置，`channel` 默认 `msedge`），用户未在窗口上确认品牌。这里记为“按配置为 msedge；用户未在窗口上确认品牌”，没有当作已验证的事实。

针对第 2 点，README 的“看报告”一节补了一条说明：如果没有自动打开浏览器（例如在内嵌终端里），手动打开终端打印的 `http://localhost:9323` 地址，查看服务会一直运行到按 Ctrl+C。

## Task Commits

1. **Task 1: 中文 tests/README.md 与 PW_JSON_REPORT 报告器，阶段收尾检查** - `f4eb5c3`（docs）
2. **Task 2: 阶段末人工验收** - 检查点已由用户批准，无代码提交；验收中发现的现象以单独的小提交写进 README：`bb50163`（docs）

两次提交都通过 pre-commit 隐私钩子，没有使用 `--no-verify`。

## Files Created/Modified

- `tests/README.md` - 中文使用说明；第二次提交增加“没有自动打开浏览器时”的一条说明
- `playwright.config.ts` - 追加 `PW_JSON_REPORT` 条件 json 文件报告器，中文注释说明它只服务于收尾检查

## Decisions Made

- 确定性检查跑的是交付配置本身，不在命令行覆盖报告器；这样 list 和 html 照常工作，json 只多写一个文件。
- 为 flaky 做的修复：无。两次运行都没有 flaky，所以没有改动任何用例或配置来“修稳定”。
- 用户验收中发现的“浏览器没有自动打开”不算缺陷：这是 `open: 'never'` 加内嵌终端的预期表现，只补文档，不改配置。

## Deviations from Plan

None - plan executed exactly as written.

补充说明（不是偏离）：Task 2 里“报告在本机浏览器里打开”这一步，用户的环境没有自动打开浏览器，由编排者手动打开地址完成了确认；README 已按此补充说明（计划的 Task 2 action 本来就允许在 README 里补充说明）。

## Issues Encountered

- `show-report` 在内嵌终端里不会自动打开浏览器，已用 README 说明处理。
- UI 模式的浏览器品牌用户没有在窗口上确认；只有“按配置为 msedge”这一条推断。
- 提交时 git 提示 `LF will be replaced by CRLF`，只是换行符警告。
- 工作区里有一个未跟踪的 `.planning/state.json`（执行开始前就存在），不属于本计划，没有处理。

## Known Stubs

None.

## Threat Flags

None - 本计划只新增文档和一个只写文件的报告器；没有新增网络端点、认证路径或信任边界上的结构变更。T-01-16（用两次一致运行代替重试掩盖）、T-01-17（README 禁止 install 类命令并给出 PW_CHANNEL 替代）、T-01-20（隐私全量检查通过）、T-01-21（`npx --no` 只读检查，人工验收全程无安装提示）都已按计划处理。

## Flagged Assumptions（沿用计划，仍需人工复核）

- UI 模式用的是 Edge 还是 Chrome 没有被人眼确认，只有配置层面的推断。
- `preconnect` 在无界面 Edge 上没有被直接观察到，“到不了字体主机”由解析规则加死代理推断（见 PROBES.md）。

## Next Phase Readiness

- Phase 1 的四个计划都已执行完毕，可以进入阶段验证（`/gsd-verify-work 1`）。
- Phase 2 要验证 `exposeBinding` 在页面脚本运行前是否可用（见 PROBES.md 末尾）。
- 没有阻塞项。

## Self-Check: PASSED

- `tests/README.md`、`playwright.config.ts` 存在于磁盘；提交 `f4eb5c3`、`bb50163` 都是 HEAD 的祖先。
- `commits: 2` 由账本文件 `gsd-plan-head-before-01-04` 测得（`6ee6ed8..bb50163`）。
- README 的 13 个字面量、`PW_JSON_REPORT` 与 `open: 'never'` 仍在；应用文件 sha256 不变且未被跟踪。
