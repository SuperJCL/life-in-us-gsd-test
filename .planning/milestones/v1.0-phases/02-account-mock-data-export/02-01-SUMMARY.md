---
phase: 02-account-mock-data-export
plan: 01
subsystem: testing
status: complete
tags: [guardrails, static-server, host-header, websocket, manual-clock, review-fixes, playwright]

requires:
  - phase: 01-harness-local-slice
    provides: "Phase 1 的静态服务器、guard、AppHarness、六项探针和 01-REVIEW 的 13 条发现"
provides:
  - "tests/support/static-server.cjs：Host 白名单（421）、方法限制（405）、error 处理"
  - "tests/support/test.ts：guard.remove(kind, match)，所有 page（含后开的）和 WebSocket 都受监控"
  - "三条新护栏自检、一条 Host/方法拒绝用例、一条 manual 时钟的“启动不写”用例"
  - "与 PROBES.md 一致的 README 第 6、7 节；更新后的 01-REVIEW-DISPOSITION.md（10 fixed，3 open）"
affects: [phase-02, phase-03, phase-04, phase-05]

actuals:
  tokens: 11000
  tasks: 3
  commits: 3
plan_head_before: 5a19d5fdb110237328e4e320de766b33c4df910c
plan_head_after: f653b03d5b3d9ce8864ce48ec83d071ea04db424

tech-stack:
  added: []
  patterns:
    - "护栏自检只用 guard.remove(kind, match) 按条删除，删除前先断言该类记录恰好是预期的"
    - "否定断言用 manual 时钟推过防抖，并带一条对照写入证明窗口确实推进了防抖"
    - "WebSocket 自检：确定性信号加 console 屏障，对 Edge 是否写 console.error 两种行为给同一结果"

key-files:
  created: []
  modified:
    - tests/support/static-server.cjs
    - tests/e2e/platform/app-integrity.spec.ts
    - tests/support/test.ts
    - tests/e2e/platform/guardrails.spec.ts
    - tests/e2e/smoke.spec.ts
    - tests/support/app.ts
    - tests/e2e/platform/probes.spec.ts
    - tests/PROBES.md
    - tests/README.md
    - .planning/phases/01-harness-local-slice/01-REVIEW-DISPOSITION.md

key-decisions:
  - "localhost:<PORT> 保留在 Host 白名单里：PROBE-2a 的对照浏览器要用它连到本机，其余 Host 一律 421"
  - "guard 不加 requestfailed 监听：context.route 先拦下每个 HTTP 请求，错误码恒为 ERR_BLOCKED_BY_CLIENT，监听永远不会触发也无法自证"
  - "preconnect 这类没有 Playwright 事件的连接，guard 无法报警；限制写进 test.ts 注释和 README 第 7 节，由解析层和死代理兜底"
  - "IN-02、IN-06、IN-07 按 D-10 保持 open"

requirements-completed: [SAFE-01, SAFE-04, ENV-03, MOCK-01]

coverage:
  - id: D1
    description: "静态服务器只对 127.0.0.1 和 localhost 的 Host、GET 和 HEAD 返回应用文件，伪造 Host 得到 421，其他方法得到 405"
    requirement: "ENV-03"
    verification:
      - kind: test
        ref: "tests/e2e/platform/app-integrity.spec.ts#ENV-03 the static server refuses foreign Host headers and non-GET methods"
        status: pass
    human_judgment: false
  - id: D2
    description: "guard 只能按条删除违规；WebSocket 和后开的 page 受监控；三条自检各自能失败"
    requirement: "SAFE-01, SAFE-04"
    verification:
      - kind: test
        ref: "tests/e2e/platform/guardrails.spec.ts（七条用例全部通过）；变异检查：去掉 websocket 监听或 context.on('page') 后对应自检变红"
        status: pass
    human_judgment: false
  - id: D3
    description: "本地模式启动时不写 localStorage，由 manual 时钟推过 600 ms 防抖后断言，并有对照写入"
    requirement: "MOCK-01"
    verification:
      - kind: test
        ref: "tests/e2e/smoke.spec.ts#MOCK-01 local mode leaves localStorage empty at startup even after timers pass the save debounce"
        status: pass
    human_judgment: false
  - id: D4
    description: "PROBE-2c 标题与断言一致，README 与 PROBES.md 对解析层的描述一致，处置记录 10 fixed 3 open"
    requirement: "ENV-03"
    verification:
      - kind: command
        ref: "Task 3 automated：grep 组合、处置记录 node 核对、npm test、privacy-check --all 全部退出 0"
        status: pass
    human_judgment: false
---

# Phase 2 Plan 01: 修复 Phase 1 审查发现并加固护栏 Summary

**静态服务器加 Host 白名单和方法限制，guard 改为按条删除并覆盖 WebSocket 与后开的 page，“启动不写 localStorage”改用 manual 时钟证明，6 个 WARNING 与 4 个 INFO 修完并更新处置记录。**

## 执行情况

- 开始：2026-11-03T18:32:31Z，结束：2026-11-03T18:44:56Z，约 12 分钟
- 3 个任务，3 个提交，修改 10 个文件，没有新增文件，没有新增依赖
- `us-journey-tracker.html` 的 sha256 与基线一致，全程未被跟踪

## 提交

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | baee7eb | WR-01、IN-03、IN-04：Host 白名单、方法限制、error 处理、ENV-03 新用例 |
| 2 | 0ace3c0 | WR-02、WR-05、WR-06、IN-05（种子保护）：guard.remove、WebSocket 与多 page、manual 时钟 |
| 3 | f653b03 | WR-03、WR-04、IN-01、IN-05（PROBE-5）：PROBE-2c 改写、README 与 PROBES.md 对齐、处置记录 |

Tracer 的 `<verify>` 在 Task 1 提交后重跑通过（app-integrity 与 probes 共 13 条，再跑完整 `npm test`），随即展开 Task 2、3。

## 每条发现的处置

| 编号 | 处置 | 做了什么 |
|------|------|----------|
| WR-01 | fixed | `ALLOWED_HOSTS` 只含 `127.0.0.1:PORT` 和 `localhost:PORT`，其余 421；只接受 GET 和 HEAD，其余 405；ENV-03 用原始 `node:http` 请求证明（含对照） |
| WR-02 | fixed | 去掉一次清空的方法，改为 `guard.remove(kind, match)`；所有自检删除前先断言该类记录恰好等于预期；新自检证明只删匹配项 |
| WR-03 | fixed | PROBE-2c 新标题只描述已断言的事实；字体主机的等待只吞 `expect.poll` 超时错误；注释和 PROBES.md 写明发现不了绕过代理的直连 |
| WR-04 | fixed | README 第 7 节解析层描述改为只对直连的回环名实测过；经过代理的名字由代理层保证（`ERR_PROXY_CONNECTION_FAILED`） |
| WR-05 | fixed | `attach(page)` 覆盖 pageerror、console、websocket，并用 `context.on('page')` 覆盖后开的 page；两条新自检；preconnect 无法报警的限制写进 test.ts 注释和 README |
| WR-06 | fixed | 删掉单次采样；新增 manual 时钟用例：`runFor(2000)` 之后状态仍为 null，再记一笔、`runFor(2000)` 后能读到，证明窗口推进了防抖 |
| IN-01 | fixed | PROBE-1 去掉主版本下限，只断言格式 |
| IN-03 | fixed | ENV-03 监听用例不再中途跳过；没有局域网地址时记 note annotation；IPv6 一项注释为弱断言 |
| IN-04 | fixed | `server.on('error')` 只输出中文提示和错误码；`res.on('close')` 销毁文件流 |
| IN-05 | fixed | `seedLocalStorageIfAbsent` 用 try/catch 保护；PROBE-5 改读 `local-seed.json` 并只覆盖 logs |
| IN-02、IN-06、IN-07 | open | 按 D-10 保持 open |

## 观察值

- **`wsConsoleErrors=1`**：这台 Edge 会为失败的 WebSocket 连接写一条 console.error，内容是 `WebSocket connection to 'ws://probe.invalid/' failed: ... net::ERR_PROXY_CONNECTION_FAILED`。用例的断言对有无这条消息给出同一个结果，没有因观察值改动。
- **`fontHostObserved=false`**：PROBE-2c 里字体主机的 CONNECT 为 0 条（`fontHostLines=0`），与 PROBES.md 记录的“这台 Edge 没有观察到 preconnect”一致。
- **稳定性**：每个任务结束都跑完整 `npm test`（共三次，26、30、30 条通过，没有 flaky）；Task 2 的两个 spec 连续运行两次都通过；`node tools/privacy/privacy-check.mjs --all` 退出 0（64 个文件）。
- **变异检查**（临时改动，已还原，没有提交）：把 `websocket` 监听改名后 WebSocket 自检变红；去掉 `context.on('page')` 后第二个 page 的自检因超时变红。两条新自检都能失败。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 被 route abort 的 fetch 还会产生一条 console.error，自检必须按条处理它**
- **Found during:** Task 2（第一次运行 guardrails 自检）
- **Issue:** `SAFE-01 a page fetch to example.com ...` 和新的 `guard.remove ...` 自检在删掉外部请求记录后，teardown 仍报出 `console.error：Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector`（每个被拦截的 fetch 一条，不含 URL，来源不是字体主机，过滤规则不会吞掉它）。以前一次清空全部记录的 `reset()` 把这条副产物悄悄抹掉了，这正好印证了 WR-02：清空全部会掩盖自检里没人核对过的记录。计划里的断言没有预见到这一点。
- **Fix:** 没有放宽过滤规则。两条自检在删除外部请求之后，先 `expect.poll` 等到 consoleErrors 恰好是预期条数（1 条、2 条），核对每条都含 `ERR_BLOCKED_BY_CLIENT`，再用 `guard.remove('consoleErrors', 'ERR_BLOCKED_BY_CLIENT')` 按内容删除并断言返回值。remove 自检里这一步放在“违规清单恰好一条”的断言之前。
- **Files modified:** tests/e2e/platform/guardrails.spec.ts
- **Commit:** 0ace3c0

**Total deviations:** 1 auto-fixed（1 个 Rule 1）。**Impact:** 仅限自检用例内部，护栏本身的规则和 teardown 断言不变；`guard.remove(` 的调用点因此比计划写的九处多两处。

## 其他说明

- 工作区文件的行尾是 CRLF（`core.autocrlf=true`），索引里是 LF；脚本改文件时保留了原行尾，提交的 diff 没有行尾噪音。
- 计划验证命令里 `grep -nE "^\s*(test|testInfo)\.skip\("` 与 `reset(` 检查全部满足。

## Known Stubs

None。本计划只修测试平台，没有产生占位数据或未接线的组件。

## Threat Flags

None。没有引入计划威胁清单之外的新网络端点、认证路径或信任边界；T-02-01 到 T-02-06 的缓解都已落地（T-02-SC：没有新增依赖，没有运行任何安装命令）。

## Next Phase Readiness

后面的账户模式、合成数据和导出计划可以直接在加固后的 guard 下写用例：需要豁免自检里的故意违规时，用 `guard.remove(kind, match)`，并先断言该类记录恰好是预期的。

## Self-Check: PASSED

- 修改的 10 个文件全部存在
- 提交 baee7eb、0ace3c0、f653b03 都在当前分支上
- 三个任务的验收命令全部通过；`npm test` 退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
