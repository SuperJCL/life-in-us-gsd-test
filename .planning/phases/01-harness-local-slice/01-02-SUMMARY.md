---
phase: 01-harness-local-slice
plan: 02
subsystem: testing
tags: [playwright, guardrails, network-guard, page-errors, frozen-clock, sha256, static-server, gitignore, synthetic-fixtures]

requires:
  - phase: 01-harness-local-slice
    provides: "Plan 01 的 guard 与 frozenClock、静态服务器、constants/strings、IO-01 冒烟用例"
provides:
  - "guard 的完整形态：GuardState（五个数组）、GuardHandle（state、reset）、guardViolations，teardown 与自检共用"
  - "SAFE-01、SAFE-04、ENV-04 的故意违规自检（guardrails.spec.ts、environment.spec.ts）"
  - "SAFE-02 sha256 基线、ENV-03 单文件白名单、路径穿越和只监听回环地址的运行时证据（app-integrity.spec.ts）"
  - "SAFE-03 忽略规则与 _synthetic 标记检查，含负例（repo-hygiene.spec.ts，导出 findUnmarkedFixtures）"
  - "静态服务器缺少应用文件时 exit 1 并输出中文提示（MISSING_APP_MESSAGE）"
  - "tests/fixtures/local-seed.json 最小合成种子，供 Plan 03 使用"
affects: [01-03, 01-04, phase-02, phase-03, phase-04, phase-05]

actuals:
  tokens: 5750
  tasks: 2
  commits: 2
plan_head_before: 005bd19532fd8e54f0122eff440971ba2351c557
plan_head_after: a40ae0343fca993e0735799673eb8b47b6e34b97

tech-stack:
  added: []
  patterns:
    - "guard 状态用 expect.poll 等待显式信号，再做其余断言；“应为空”的断言由 teardown 的 guardViolations 兜底"
    - "故意违规的自检最后调用 guard.reset()，且只在这类自检里调用"
    - "需要原始路径到达服务器时，用 node:http 发请求，不用会规范化路径的客户端"
    - "fixtures 目录下每个文件都带 _synthetic 标记，新增 fixture 自动纳入检查"

key-files:
  created:
    - tests/e2e/platform/guardrails.spec.ts
    - tests/e2e/platform/environment.spec.ts
    - tests/e2e/platform/app-integrity.spec.ts
    - tests/e2e/platform/repo-hygiene.spec.ts
    - tests/fixtures/local-seed.json
  modified:
    - tests/support/test.ts
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/support/static-server.cjs

key-decisions:
  - "SAFE-04 的页面异常自检改用 queueMicrotask 抛出，不用 setTimeout：冻结时钟下定时器回调里的异常只会变成 console.error，不会触发 pageerror"
  - "ENV-03 的运行时证据在计划要求之外多加两个用例：原始 node:http 路径穿越请求，以及对本机非回环地址的连接必须失败"
  - "字体噪音过滤只靠 msg.location().url 的主机判断，应急 1、应急 2 和 favicon 规则都没有触发"

patterns-established:
  - "用例标题英文加需求编号开头，注释中文，只从 tests/support/test.ts 导入"
  - "改动应用行为之外的假设（如时钟接管定时器）先用诊断用例实测，再把结论写进注释和 SUMMARY"

requirements-completed: [SAFE-01, SAFE-02, SAFE-03, SAFE-04, ENV-03, ENV-04]

coverage:
  - id: D1
    description: "页面 fetch 外部地址会被 abort、记入 unexpectedRequests，并让 guardViolations 非空；打开应用时只有字体主机被 abort"
    requirement: "SAFE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/guardrails.spec.ts#SAFE-01 a page fetch to example.com is blocked and reported as a guard violation"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/guardrails.spec.ts#SAFE-01 opening the app only aborts the allowlisted font hosts"
        status: pass
    human_judgment: false
  - id: D2
    description: "未捕获的页面异常和 console.error 都会让 guardViolations 非空；字体 abort 产生的噪音被过滤且有可轮询的信号"
    requirement: "SAFE-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/guardrails.spec.ts#SAFE-04 an uncaught page error is reported as a guard violation"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/guardrails.spec.ts#SAFE-04 console.error is reported while aborted-font noise is filtered"
        status: pass
    human_judgment: false
  - id: D3
    description: "页面时钟冻结在 2026-03-18 美东周三，语言 zh-CN；应用渲染“本周”、“3月16日 – 22日”并高亮冻结日"
    requirement: "ENV-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/environment.spec.ts#ENV-04 the page clock is frozen at 2026-03-18 noon UTC in America/New_York with zh-CN"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/environment.spec.ts#ENV-04 the app renders the frozen current week"
        status: pass
    human_judgment: false
  - id: D4
    description: "应用文件 sha256 等于基线；缺少应用文件时服务器 exit 1 并输出中文提示（用临时目录副本验证，没有动真实文件）"
    requirement: "SAFE-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline"
        status: pass
      - kind: other
        ref: "临时目录副本运行 static-server.cjs：exit=1，输出含“放到仓库根目录”"
        status: pass
    human_judgment: false
  - id: D5
    description: "静态服务器只提供一个文件：白名单外和各种路径穿越写法都是 404；只监听 127.0.0.1"
    requirement: "ENV-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#ENV-03 the static server serves only the app file"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#ENV-03 raw traversal paths reach the static server and are refused"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/app-integrity.spec.ts#ENV-03 the static server listens on 127.0.0.1 only"
        status: pass
    human_judgment: false
  - id: D6
    description: ".gitignore 忽略测试产物、备份类 JSON 和应用文件；fixtures 全部带 _synthetic 标记，缺标记会被报出来"
    requirement: "SAFE-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/repo-hygiene.spec.ts#SAFE-03 .gitignore ignores test artifacts and backup-style JSON"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/repo-hygiene.spec.ts#SAFE-03 every file under tests/fixtures carries the _synthetic marker"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/repo-hygiene.spec.ts#SAFE-03 the marker check reports a fixture without the marker"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-11-02
status: complete
---

# Phase 1 Plan 02: 护栏自检 Summary

**每道护栏都有故意违规的自检：外部请求、页面异常、console.error 会让用例失败，固定时钟、sha256 基线、单文件白名单、忽略规则和合成标记各有用例证明，缺少应用文件时服务器给出中文提示后以退出码 1 结束**

## Performance

- **Duration:** 7 min
- **Tasks:** 2
- **Files modified:** 9（5 个新增，4 个修改）

## Accomplishments

- guard 的 teardown 与四条 SAFE 自检共用 `guardViolations`，自检证明的失败路径就是真实用例走的失败路径。
- `npm test` 共 14 条用例全部通过，连续 3 次运行没有 flaky，IO-01 冒烟用例没有回归。
- 应用文件 sha256 仍等于基线 `2a954fd0…a1872`，`git ls-files us-journey-tracker.html` 为空，`git ls-files .claude` 只有 `.claude/CLAUDE.md`，`.gitignore` 没有改动也没有重复条目。
- “文件缺失”分支只用 mktemp 目录里的服务器副本验证，真实应用文件没有被移动、改名或删除。

## Task Commits

1. **Task 1: 网络、页面错误和时钟三道护栏的自检** - `9f9107c`（feat）
2. **Task 2: 应用完整性、缺失提示、服务器白名单和仓库卫生** - `a40ae03`（feat）

两次提交都通过 pre-commit 隐私钩子（Task 1 输出「隐私检查通过（staged，4 个文件）」，Task 2 为 5 个文件），没有使用 `--no-verify`。

## 实测记录（计划要求写入的内容）

**favicon 应急规则：未触发。** 正常打开应用时 consoleErrors 为空，Edge 没有为 `/favicon.ico` 报控制台错误，所以 route 里没有加 `favicon.ico` 的 204 规则，静态服务器的 404 规则保持不变。

**字体噪音在 Edge 156 上的实际表现：** 字体请求被 abort 后，Edge 会输出一条 console.error，文本为 `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector`，`msg.location().url` 正好是被 abort 的字体样式表地址 `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@600;800&display=swap`。因此只靠 `FONT_HOSTS` 的主机判断就能过滤，应急 1（location.url 为空）和应急 2（根本没有噪音）都没有触发，噪音确实产生，并被记入 `filteredConsoleNoise`，自检先轮询到它再断言 consoleErrors 为空。

## Accepted Warnings 的处理情况（STATE.md 的 6 条计划检查警告）

1. **ENV-03「只监听 127.0.0.1」的运行时证据：已补上。** 新增用例 `ENV-03 the static server listens on 127.0.0.1 only`：先确认 127.0.0.1 能连通（对照），再对本机所有非回环 IPv4 地址和 `::1` 发起连接，必须连不上。在这台机器上局域网地址是超时而不是被拒绝（虚拟网卡/防火墙丢包），超时和拒绝都算“没连上”。另外用一个绑定在 0.0.0.0 的对照服务器验证过：同样的连接逻辑对 4 个局域网地址全部返回“已连通”，所以如果服务器误绑 0.0.0.0，这条用例会失败。本机没有非回环地址时，该用例会 skip（有注释说明）。
2. **`/%2e%2e/` 路径穿越可能被客户端规范化：已处理。** 新增用例 `ENV-03 raw traversal paths reach the static server and are refused`，用 `node:http` 发原始请求（不规范化路径），覆盖 `/%2e%2e/package.json`、`/%2E%2E/package.json`、`/../package.json`、`/..%2fpackage.json`、`/us-journey-tracker.html/../package.json`、`/%2e%2e/%2e%2e/.git/config`，全部返回 404。计划里指定的 `request` fixture 版本也保留了。
3. **SAFE-04 控制台过滤的应急规则：** 见上节，全都没有触发。

其余 3 条（01-01 的配置字面量 truths、PROBE-2 解析层证人、01-03 Task 2 范围）属于 Plan 01 和 Plan 03，本计划不涉及。

## Decisions Made

- 页面异常自检用 `queueMicrotask` 抛出，不用计划里的 `setTimeout`（见下面的偏差）。
- ENV-03 在计划之外多加两个用例，把两条警告的运行时证据落在用例里，而不是只写在 SUMMARY。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SAFE-04 页面异常自检不能用 setTimeout 抛异常**
- **Found during:** Task 1（第一次运行 `npm test -- tests/e2e/platform`）
- **Issue:** 计划要求用 `setTimeout` 抛出 `new Error('SYNTH page error')`，并等 pageErrors 出现该条目。但页面时钟被 `setFixedTime` 接管后，定时器回调里的异常被 Playwright 的时钟控制器接住，通过 `console.error(e)` 输出，不会触发 `pageerror`。用例在 poll 处超时失败，随后那条 console.error 又在 `guard.reset()` 之后才到达，造成 teardown 的二次失败。用诊断用例对照确认：定时器抛出的异常只出现在 consoleErrors，`queueMicrotask` 抛出的异常只出现在 pageErrors。
- **Fix:** 改成在 `queueMicrotask` 里抛出，并在用例注释里写明原因。定时器里的异常仍然会被 guard 的 console.error 收集报出来，所以真实用例里这类错误不会漏掉，只是归类为 `console.error：` 而不是 `页面未捕获异常：`。
- **Files modified:** tests/e2e/platform/guardrails.spec.ts
- **Verification:** 连续 3 次 `npm test -- tests/e2e/platform`、2 次完整 `npm test` 全部通过，无 flaky
- **Commit:** 9f9107c

**2. [Rule 2 - Missing critical functionality] 补上 ENV-03 的运行时证据用例**
- **Found during:** Task 2（处理 STATE.md 的 Accepted Warnings 1 和 2）
- **Issue:** 计划里的 ENV-03 用例用 `request` fixture 发 `/%2e%2e/package.json`，客户端可能先把它规范化成 `/package.json`，测不到穿越处理；“只监听 127.0.0.1”只有代码字面量，没有运行时证据。
- **Fix:** 在 app-integrity.spec.ts 增加两个用例（原始 node:http 穿越请求；非回环地址连接必须失败，含对照）。
- **Files modified:** tests/e2e/platform/app-integrity.spec.ts
- **Verification:** 两个用例通过；用 0.0.0.0 绑定的对照服务器验证了第二个用例的判断逻辑会在误绑时失败
- **Commit:** a40ae03

另外一处小的格式调整：guardrails.spec.ts 里把多行的 `expect\n.poll(...)` 合并成一行，使计划里按行计数的验收 grep（`expect.poll` 至少 5 次）能数到，行为不变。

## Issues Encountered

- 第一次写 `static-server.cjs` 时，通过 Python 脚本插入的 `'\n'` 被写成了真实换行，导致 `node --check` 报语法错误；用 Edit 改成字面的 `\n` 后通过，未提交过错误版本。
- 提交时 git 提示 `LF will be replaced by CRLF`，只是换行符警告，不影响内容和隐私钩子。
- 工作区里有一个未跟踪的 `.planning/state.json`（执行开始前就存在），不属于本计划，没有处理。

## Known Stubs

None.

## Threat Flags

None - 本计划新增的内容都在计划的 threat_model 里（T-01-07 到 T-01-12）。路径穿越用例和回环监听用例只连接本机地址，没有访问外部主机。

## Next Phase Readiness

- Plan 03 的 PROBE-2 可以直接使用 `guard.state` 和 `guardViolations`；`tests/fixtures/local-seed.json` 已就位，且带 `_synthetic` 标记。
- 以后新增的 fixture 必须带 `_synthetic` 标记，否则 `SAFE-03 every file under tests/fixtures` 会失败。
- 没有阻塞项。

## Self-Check: PASSED

- 9 个文件都存在于磁盘并已被提交；提交 `9f9107c` 和 `a40ae03` 都是 HEAD 的祖先。
- 重跑两个任务的全部 `<automated>` 与 acceptance_criteria 命令，全部通过（`npm test` 14 条通过，无 flaky）。

---
*Phase: 01-harness-local-slice*
*Completed: 2026-11-02*
