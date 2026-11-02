---
phase: 01-harness-local-slice
plan: 03
subsystem: testing
tags: [playwright, probes, network-guard, resolver-rules, dead-proxy, appharness, localstorage-seed, clock-install]

requires:
  - phase: 01-harness-local-slice
    provides: "Plan 01 的 launchOptions 两层网络兜底、guard 与 frozenClock；Plan 02 的 guard.state 和 local-seed.json"
provides:
  - "AppHarness（open、ready、reload、persisted、expectPersisted）与 seedLocalStorageIfAbsent（没有才写）"
  - "test.ts 的 app fixture 和 clockMode option fixture（fixed 默认，manual 时 frozenClock 不动）"
  - "smoke.spec.ts 的 IO-01 两条、MOCK-01 两条本地模式用例"
  - "probes.spec.ts：PROBE-1 到 PROBE-6（PROBE-2 三条）每次 npm test 都运行"
  - "tests/PROBES.md：中文探针结论、证据和采用的方案，网络兜底一节只写已证明的层"
affects: [01-04, phase-02, phase-03, phase-04, phase-05]

actuals:
  tokens: 9500
  tasks: 3
  commits: 3
plan_head_before: acfdda43b092e7e8a17d850e451d7a49af49af15
plan_head_after: 260907d67c075147e13fee7c03d356ffcacd61cb

tech-stack:
  added: []
  patterns:
    - "所有 spec 只从 tests/support/test.ts 导入（类型也从那里再导出，spec 不直接导入 @playwright/test）"
    - "种子只用 addInitScript(fn, arg) 注入，并且“没有才写”，reload 不会覆盖新数据"
    - "持久化断言一律 app.expectPersisted，不用固定睡眠"
    - "需要手动时钟的用例用 test.use({ clockMode: 'manual' })，不混用 install 和 setFixedTime"
    - "拖放用 dragTo(..., { steps: 10 })"

key-files:
  created:
    - tests/support/app.ts
    - tests/e2e/platform/probes.spec.ts
    - tests/PROBES.md
  modified:
    - tests/support/test.ts
    - tests/support/strings.ts
    - tests/e2e/smoke.spec.ts

key-decisions:
  - "PROBE-2 解析层和代理层都已被用例证明，网络检查点（Task 3）未触发"
  - "解析层的证人不只用 localhost：加上 probe.localhost，并用一个只去掉解析规则的对照浏览器证明失败来自规则"
  - "preconnect 在这台 Edge 上没有被直接观察到，按计划应急办法改写用例标题；PROBES.md 如实写成推断，不写成已观察"
  - "Edge 自己的后台流量（bing、edge.microsoft）在录制代理里被观察到，说明连浏览器自发的连接也交给了代理"

patterns-established:
  - "探针只访问回环地址、.invalid 域名和只放行应用来源的录制代理 context"
  - "对照实验：断言一条保证之前，先用去掉该保证的对照证明它不是本来如此"

requirements-completed: [MOCK-01, IO-01, ENV-01, ENV-04, SAFE-01]

coverage:
  - id: D1
    description: "本地模式切片：没有 window.claude、四个标签切换、导出按钮隐藏、预置种子后 reload 不覆盖新数据"
    requirement: "MOCK-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#MOCK-01 opens in local mode without window.claude and switches all four tabs"
        status: pass
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#MOCK-01 starts from seeded synthetic localStorage and reload keeps newly saved data"
        status: pass
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#IO-01 keeps the export buttons hidden in local mode"
        status: pass
    human_judgment: false
  - id: D2
    description: "IO-01 往返用例改用 AppHarness 后照常通过"
    requirement: "IO-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#IO-01 saves an entry to localStorage and keeps it after reload"
        status: pass
    human_judgment: false
  - id: D3
    description: "两层浏览器网络兜底（解析层、死代理层）被用例证明，route 看不到的页面流量只会交给代理"
    requirement: "SAFE-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-2 --host-resolver-rules makes non-excluded hostnames unresolvable"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-2 the dead-end proxy rejects non-loopback traffic and still lets 127.0.0.1 load"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-2 route-invisible traffic only ever reaches the proxy (preconnect not observed on this Edge)"
        status: pass
    human_judgment: true
    rationale: "preconnect 本身没有被直接观察到（这台无界面 Edge 不发 preconnect），其保证是推断；需要用户知情"
  - id: D4
    description: "固定时钟在 reload 后保持；clock.install 加 pauseAt 的手动时钟模式可用"
    requirement: "ENV-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-3 setFixedTime survives page.reload()"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-6 clock.install with pauseAt keeps actionability checks working"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edge 156 无界面启动并记录版本；防抖保存时序和 HTML5 拖放探针有结论"
    requirement: "ENV-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-1 msedge launches headless and reports browser.version()"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-4 expect.poll observes the debounced localStorage save"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/probes.spec.ts#PROBE-5 dragTo drives HTML5 drag and drop in the week view"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-11-02
status: complete
---

# Phase 1 Plan 03: 本地模式切片与运行时探针 Summary

**AppHarness 收拢本地模式用例（没有 window.claude、四个标签、导出按钮隐藏、种子 reload 不覆盖），六项探针每次运行都跑：解析层和死代理层都被证明，字体 preconnect 在这台 Edge 上没有发出，已如实记录为推断**

## Performance

- **Duration:** 16 min
- **Started:** 2026-11-02T03:51:59Z
- **Completed:** 2026-11-02T04:08:09Z
- **Tasks:** 3（Task 1、2 完成；Task 3 为条件检查点，未触发）
- **Files modified:** 6（3 个新增，3 个修改）

## Accomplishments

- `npm test` 共 25 条用例全部通过，连续运行 4 次没有 flaky，没有用到重试。
- 本地模式切片完整：MOCK-01 两条、IO-01 两条；种子用 `addInitScript(seedLocalStorageIfAbsent, ...)` 注入，reload 后种子条目和新条目同时还在。
- 六项探针都有结论并留在仓库里（`probes.spec.ts` 加 `tests/PROBES.md`）；没有一项需要回退到备选方案，也没有一项推翻已有假设。
- 应用文件 sha256 仍是基线 `2a954fd0…a1872`，`git ls-files us-journey-tracker.html` 为空。

## 网络检查点（Task 3）：未触发

PROBE-2 同时证明了两层，所以没有停下来询问用户，也没有在任何时候暂停运行 `npm test`。

- **解析层：已证明**（`PROBE-2 --host-resolver-rules ...`）。`localhost` 和 `probe.localhost` 都是 `ERR_NAME_NOT_RESOLVED`，`127.0.0.1` 返回 404；一个只去掉解析规则的对照浏览器里 `localhost` 返回 404，证明失败来自规则而不是 DNS 本来就查不到。
- **代理层：已证明**（`PROBE-2 the dead-end proxy ...`）。`http://` 和 `https://` 的 `probe.invalid` 都是 `ERR_PROXY_CONNECTION_FAILED`，`127.0.0.1` 照常 404。端口 9 没有被占用，`DEAD_PROXY_SERVER` 保持不变。
- **录制代理（第 3 条）录到的 CONNECT 行：** `www.bing.com:443`（3 条）、`edge.microsoft.com:443`（2 条）、`probe.invalid:80`（1 条，WebSocket 对照）。字体主机的 CONNECT 为 0 条。

## Accepted Warnings 的处理情况

**Warning 4（PROBE-2 解析层的证人不能只有 localhost）：已处理，并如实写明边界。**

- 证人增加了 `probe.localhost`，并新增“去掉规则的对照浏览器”：对照里 `localhost` 能解析并返回 404，所以两个名字的失败可以归因于规则。
- 边界：凡是走死代理的主机名，浏览器不会在本机解析目标名，所以没有一个“经过代理、又能证明解析层”的名字。这类主机名的保证由代理层提供，PROBES.md 明确这样写，没有声称解析层覆盖它们。
- 没有任何回退把断言改写成“观察到什么就断言什么”。第 3 条用例按计划应急办法改了标题，但它断言的仍是一个具体保证（WebSocket 对照行必须出现在录制代理），不是观察值。
- preconnect 没有被直接观察到，PROBES.md 写成推断而不是事实。

**Warning 5（Task 2 范围大）：已处理。** 分三次提交：Task 1 单独一次；Task 2 拆成“探针用例加 clockMode”和“PROBES.md”两次，PROBES.md 按小节分次写入（中间用续写标记，最后已移除）。

## Task Commits

1. **Task 1: AppHarness 收拢本地模式，补齐 MOCK-01 和 IO-01 的切片** - `6f47d04`（feat）
2. **Task 2a: 六项运行时探针和 clockMode option fixture** - `417ee08`（feat）
3. **Task 2b: tests/PROBES.md 探针结论** - `260907d`（docs）
4. **Task 3: 条件检查点** - 未触发，无提交

三次提交都通过 pre-commit 隐私钩子（分别为 4、2、1 个文件），没有使用 `--no-verify`。

## 各探针结论（详见 tests/PROBES.md）

| 探针 | 结论 | 备选方案 |
|------|------|----------|
| PROBE-1 | 通过，`browser.version()` 为 156.0.4314.58 | 未用 |
| PROBE-2 | 解析层和代理层都通过；preconnect 未被直接观察到，标题按应急办法改写 | 仅标题改写，没有回退断言 |
| PROBE-3 | `setFixedTime` 在 reload 后保持（前后都是 1773835200000） | 未用 |
| PROBE-4 | 三次保存耗时 1012、960、975 ms，在 500 到 5000 ms 内 | 未用 |
| PROBE-5 | 方案 A（`dragTo`，`steps: 10`）一次通过，B、C 没有尝试 | 未用 |
| PROBE-6 | `clock.install` 加 `pauseAt` 加 `runFor(1800)` 可用 | 未用 |

## Files Created/Modified

- `tests/support/app.ts` - AppHarness 与“没有才写”的种子函数；本阶段只支持 local 模式
- `tests/support/test.ts` - 新增 `app` fixture、`clockMode` option fixture，并再导出 `Browser`、`Page` 类型
- `tests/support/strings.ts` - 新增 `TAB_LABELS`
- `tests/e2e/smoke.spec.ts` - 四条本地模式用例，全部改用 `app` fixture
- `tests/e2e/platform/probes.spec.ts` - PROBE-1 到 PROBE-6
- `tests/PROBES.md` - 中文探针结论，含网络兜底一节

## Decisions Made

- 对照浏览器只去掉解析规则、保留死代理：这样对照实验本身也不会让 Edge 的后台流量出网。
- 状态码用 `response` 事件读取：回环地址上的空 404 响应会让 `page.goto` 抛 `ERR_HTTP_RESPONSE_CODE_FAILURE`，拿不到返回值里的状态码。
- 类型从 `tests/support/test.ts` 再导出，保证 `tests/e2e` 下没有任何文件直接导入 `@playwright/test`。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 对照浏览器继承了配置里的解析规则和死代理**
- **Found during:** Task 2（第一次运行 PROBE-2 第 1 条）
- **Issue:** 我设想的“没有规则的对照”用 `playwright.chromium.launch({ channel })` 启动，但 `@playwright/test` 会把配置里的 `launchOptions` 作为默认值合并进去，对照浏览器同样带着规则，`localhost` 照样解析失败，对照失去意义。
- **Fix:** 启动时显式传 `args: []`（浅合并，替换掉规则），死代理保持继承。这样对照里 `localhost` 返回 404，同时 Edge 后台流量仍然只会到死代理。
- **Files modified:** tests/e2e/platform/probes.spec.ts
- **Verification:** 对照返回 404，其余断言不变；连续多次完整运行通过
- **Commit:** 417ee08

**2. [Rule 1 - Bug] `goto` 对回环 404 抛错，状态码取不到**
- **Found during:** Task 2（诊断运行）
- **Issue:** 计划写“`goto(...)` 返回状态码 404”，实际 `127.0.0.1` 下的空 404 响应会让 `goto` 抛 `ERR_HTTP_RESPONSE_CODE_FAILURE`。
- **Fix:** 增加 `visit()` 辅助函数，从 `response` 事件取状态码，同时保留导航错误文本。
- **Files modified:** tests/e2e/platform/probes.spec.ts
- **Commit:** 417ee08

**3. [Rule 2 - Missing critical functionality] 解析层证人和边界声明**
- **Found during:** Task 2（处理 Accepted Warning 4）
- **Issue:** 计划只用 `localhost` 作证人，它在 `PROXY_BYPASS` 里。
- **Fix:** 加 `probe.localhost` 和对照浏览器；PROBES.md 写明经代理的主机名不由解析层保证。
- **Files modified:** tests/e2e/platform/probes.spec.ts、tests/PROBES.md
- **Commit:** 417ee08、260907d

**4. [Rule 3 - Blocking] 类型导入违反“tests/e2e 不直接导入 @playwright/test”**
- **Found during:** Task 2 验收检查
- **Issue:** probes.spec.ts 需要 `Browser`、`Page` 类型，直接导入会让验收 grep 失败，也违反“只从 tests/support/test.ts 导入”的约定。
- **Fix:** 在 test.ts 里再导出这两个类型，spec 从那里导入。
- **Files modified:** tests/support/test.ts、tests/e2e/platform/probes.spec.ts
- **Commit:** 417ee08

**5. [自己引入后立即修掉] 一次写文件时转义出错**
- 用 shell 内联脚本追加 PROBE-3 到 PROBE-6 时，正则里的 `\b` 被写成了退格字符，PROBE-6 的 toast 断言失败。改成正常的 `\b` 后通过，错误版本没有提交。

**Total deviations:** 4 项计划相关的自动修复（2 个 Rule 1，1 个 Rule 2，1 个 Rule 3），另有 1 项自己引入并立即修复的书写错误。**Impact:** 都在探针内部，没有改变计划的结论，也没有触发任何检查点。

## Issues Encountered

- `PROBE-2 --host-resolver-rules` 用例因为要多启动一个对照浏览器，单条耗时约 8 到 11 秒，是目前最慢的用例；完整 `npm test` 约 30 秒，在 30 秒单用例超时之内且稳定。
- 提交时 git 提示 `LF will be replaced by CRLF`，只是换行符警告，不影响内容和隐私钩子。
- 工作区里有一个未跟踪的 `.planning/state.json`（执行开始前就存在），不属于本计划，没有处理。

## Known Stubs

None.

## Threat Flags

None - 新增内容都在计划的 threat_model 里（T-01-13、T-01-14、T-01-15、T-01-18、T-01-19）。录制代理只监听 127.0.0.1 随机端口，只读每个连接的第一行后销毁，不转发。没有任何探针请求外部主机。

## Flagged Assumptions（沿用计划，仍需人工复核）

- MOCK-01：localStorage 里是坏 JSON 时应用会静默回退为空状态，这条边界没有覆盖（research 的 D-8，Should-have）。
- IO-01：pagehide 补救写入、存储写满等边界没有覆盖。

## Next Phase Readiness

- Plan 04 的 README 应写明：preconnect 在这台 Edge 上没有被直接观察到，保证是推断（见 PROBES.md 的网络兜底一节）；以及 Edge 后台流量（bing、edge.microsoft）被观察到只交给代理。
- Phase 2 要验证 `exposeBinding` 在页面脚本运行前是否可用（PROBES.md 末尾已注明）。
- 没有阻塞项。

## Self-Check: PASSED

- `tests/support/app.ts`、`tests/e2e/platform/probes.spec.ts`、`tests/PROBES.md` 都存在于磁盘；提交 `6f47d04`、`417ee08`、`260907d` 都是 HEAD 的祖先。
- 重跑 Task 1、2 的 `<automated>` 与 acceptance_criteria 命令全部通过：`npm test` 25 条通过无 flaky；PROBES.md 含 PROBE-1 到 PROBE-6、`browser.version()`、`1.64.1`、`preconnect`、`死代理`；PROBE-2 非注释行至少 3 行；没有探针直接请求字体主机；无本机路径。
- 应用文件 sha256 不变。
