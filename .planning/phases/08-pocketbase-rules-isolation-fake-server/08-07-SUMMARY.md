---
phase: 08-pocketbase-rules-isolation-fake-server
plan: 07
subsystem: testing
tags: [pocketbase, contract-test, fake-server, playwright, protocol-samples, test-02]

requires:
  - phase: 08-pocketbase-rules-isolation-fake-server
    provides: 08-02 的 FakePbServer；08-03 的 cloud 护栏；08-06 的场景表、归一化函数、28 个协议样本和 PB-CONTRACT.md
provides:
  - "tests/cloud/pb-contract.spec.ts：28 条场景契约用例（TEST-02 contract <id> matches the real 0.41.1 sample）加 1 条版本一致性用例"
  - "按真实样本对齐后的 tests/mocks/pb-server.ts（列表顺序、字段错误的 params、writer 消息、无页面连接）"
  - "PB-CONTRACT.md 第 5 节：契约自测的结论和已修正差异表；tests/README.md：契约文档、样本、契约自测、重录命令"
  - "完整 npm run test:cloud：43 条全部通过，0 flaky"
affects: [phase-09, phase-10, phase-13]

plan_head_before: d190fa12a060552c5c81f1dcfe9eb4a95b34e414
plan_head_after: 72eb3f1f17cea0c29085b8cfbc51167446ccd2c5

estimate:
  tokens: 70000
  raw_tokens: 70000
  tasks: 2
  confidence: low
actuals:
  tokens: 6300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "契约自测与录制共用同一份场景表、resolveStep 和归一化，Node 侧直接调用 FakePbServer.handle()，不开浏览器"
    - "比较顺序：状态码（永不跳过）、顶层键、归一化正文、请求、令牌声明；偏差只按 `<步骤序号>.<点路径>` 登记且不能指向状态码"
    - "前置文档经 handle() 以 writer=setup 创建，与录制脚本的前置一致"

key-files:
  created:
    - tests/cloud/pb-contract.spec.ts
  modified:
    - tests/mocks/pb-server.ts
    - tests/mocks/PB-CONTRACT.md
    - tests/README.md

key-decisions:
  - "没有登记任何有意偏差：INTENTIONAL_DEVIATIONS 为空，所有差异都改假服务器去对齐样本"
  - "openConnection 接受 null 页面：契约自测不开浏览器，事件由 handle() 的 deliveries 返回；deliver() 遇到无页面连接时记进 deliveryErrors"
  - "列表新建的在前：依据是 list-own 样本里后建的 plan 排在先建的 state 之前；这只有一个两条记录的样本作依据，应用不应依赖列表顺序"

patterns-established:
  - "新增假服务器行为的顺序：先在真实实例上录样本，再加场景和契约用例，最后改假服务器"

requirements-completed: []

coverage:
  - id: D1
    description: "SC3 后半：28 个场景在全新的假服务器上执行同一组请求，状态码、顶层键、归一化正文和令牌声明与真实 0.41.1 样本一致；实时场景比较 PB_CONNECT、订阅状态码和事件"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "npm run test:cloud 的 28 条 TEST-02 contract <id> 用例（含 update-oversize、refresh-invalid-token、realtime-update-fields），REPORT OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "版本一致性：样本元数据、constants.ts、SHA256SUMS、PB-CONTRACT.md 都是服务器 0.41.1 配 SDK 0.28.1；样本里没有令牌开头的子串"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "TEST-02 the recorded samples carry no token shapes and pin server 0.41.1 with SDK 0.28.1"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC5（cloud 一侧）：完整 test:cloud 43 条全部按预期通过，低优先级、1 个 worker"
    requirement: "TEST-02"
    verification:
      - kind: e2e
        ref: "npm run test:cloud，check-report --min-expected 43，REPORT OK expected=43 flaky=0 unexpected=0（约 21 秒）"
        status: pass
    human_judgment: false

duration: 约 30min
completed: 2026-11-08
status: complete
---

# Phase 8 Plan 07: 契约自测与阶段收尾 Summary

**用录制脚本共用的场景表和归一化，在全新的假服务器上逐个执行 28 个场景，与真实 0.41.1 样本比较状态码、键集合、归一化正文和令牌声明；发现 4 处小差异并改假服务器对齐，没有登记任何有意偏差；完整 test:cloud 43 条全过。**

## Performance

- **Duration:** 约 30 分钟
- **Tasks:** 2（Task 1 tracer，Task 2 auto）
- **Files:** 新建 1 个，修改 3 个
- **Commits:** 2（measured：`git rev-list --count d190fa1..HEAD`，在写本 SUMMARY 之前）
- 完整 test:cloud 约 21 秒（19.5 秒测试加启动），低优先级、`--workers=1`；本计划只跑了这一次完整套件，Task 1 和 Task 2 的中间运行只跑 pb-contract.spec.ts。

## 完成的任务

| Task | 内容 | Commit |
|------|------|--------|
| 1（tracer） | 样本、场景表、resolveStep、FakePbServer.handle()、归一化、比较，auth-ok 一条打通；偏差登记机制就位；`REPORT OK expected=1` | 68c6186 |
| 2 | 28 个场景加版本一致性共 29 条；对齐假服务器；PB-CONTRACT.md 第 5 节；README；完整 test:cloud 43 条 | 72eb3f1 |

## 契约自测发现并修掉的差异（逐场景）

Task 2 第一次运行 29 条里 4 条失败（其余 25 条一次通过，包括全部 6 个实时场景），都是 08-02 按源码记忆写错的细节，改假服务器、没有动样本：

| 场景 | 差异 | 修正 |
|------|------|------|
| list-own | 假服务器按创建顺序返回，样本里后建的 plan 在先建的 state 之前 | 列表新建的在前（更新不改变顺序） |
| create-invalid-kind | kind 的错误缺 `params.value` | 补上 |
| update-oversize | data 的错误缺 `params.maxSize` | 补上 `4194304` |
| update-writer-too-long | 消息是 `Must be less than 40 character(s).`，缺 `params.max` | 改为 `Must be no more than 40 character(s).`，补上 `params: { max: 40 }` |

所有状态码一次对上，没有出现假服务器比真实实例宽松的情况。另外两条 08-06 点名要复核的实时消息（`Missing or invalid client id.`、`The current and the previous request authorization don't match.`）与样本一致。

## 登记的有意偏差

**无。** `INTENTIONAL_DEVIATIONS` 为空数组；PB-CONTRACT.md 第 5 节写明“契约自测未发现额外偏差”，并保留原有的表示层偏差（令牌不签名且用标准 base64、假时钟、确定性 id、超大请求体只记字节数）。这些原有偏差本来就不在比较范围内：id 和时间戳经归一化后相同，令牌只比声明，请求体超大字段在归一化时换成字节数。

## 阶段收尾的不变量

| 检查 | 结果 |
|------|------|
| 完整 test:cloud（`--min-expected 43` 加 11 个代表性标题） | REPORT OK expected=43 flaky=0 unexpected=0 |
| `playwright.config.ts` 的 blob | 仍是 `3bd913baf7872a993425449ebd1e11510603ac34`，工作区无改动 |
| `us-journey-tracker.html` | sha256 仍是 APP_SHA256 基线，无改动 |
| `node tools/pb/migration-check.mjs` | MIGRATIONS MATCH |
| `node tools/pb/record-samples.mjs --check` | SAMPLES CLEAN 2 |
| `node tools/pb/isolation-check.mjs --self-test` | ISOLATION SELF-TEST OK |
| `node tools/privacy/privacy-check.mjs --all` | 通过（307 个文件）；两次暂存检查也通过，没有加放行名单 |
| `git ls-files tools/pb/bin` | 空 |

## 默认 npm test 的收尾回归

**本计划没有运行默认完整 `npm test`。** 按计划，execute-phase 的阶段回归门在最后一个计划完成后统一运行（完整 `npm test`，预期 175 条，其中 154 条 v1 用例和 8 条已知 bug 标记）。本计划改的 `tests/mocks/pb-server.ts` 在默认套件里只经 `tests/support/app.ts` 导入、不被 v1 用例调用；导入层面的错误在完整 test:cloud 里同样会暴露，这次没有。

## TEST-02 仍为 Pending

**TEST-02 在 Phase 8 只完成基础部分**（cloud 入口、同源 SDK、假服务器、护栏、协议样本和契约自测）。Phase 9–12 要各自补 cloud 用例（登录、云端存取、离线、实时同步、导入导出、编辑计划），Phase 13 收口。阶段验证不能把整条 TEST-02 当作已满足；REQUIREMENTS.md 里 TEST-02 保持 Pending，本计划没有标完成。

契约只覆盖本阶段实现的行为：Phase 9–12 新增的假服务器行为必须先在真实实例上录样本、再加契约用例；v1 用例映射到 cloud（`USJ_TEST_MODE`）要等 Phase 9 应用接上云端才实际运行。

## Deviations from Plan

None - 计划按原样执行。几处小的实现选择，不算偏离：

- `openConnection` 的签名加了 `Page | null`：计划的接口里写了 `openConnection(page | null)`，但 08-02 的实现不接受 null，所以补上了（跳过页面关闭和导航的监听，`deliver()` 遇到无页面连接时记进 `deliveryErrors`，不吞掉）。
- 比较里多比了一项归一化后的请求（计划只要求状态码、键集合、正文、令牌声明）：用来证明 resolveStep 和 `<ID:n>` 编号与录制时一致，没有引入任何放宽。
- 版本一致性用例里多了一段偏差登记的健全性检查（场景存在、有原因、路径不能指向状态码），不改变用例条数。
- 令牌开头子串在 spec 里写成 `'ey' + 'J'`，避免源码里出现该子串。

## Auth gates

None。

## Known Stubs

None。

## Threat Flags

None。本计划没有新增网络端点或信任边界；样本和契约文档里没有令牌、口令、地址，没有加任何放行名单。

## Self-Check: PASSED

- FOUND: tests/cloud/pb-contract.spec.ts、tests/mocks/pb-server.ts、tests/mocks/PB-CONTRACT.md、tests/README.md
- FOUND commits: 68c6186、72eb3f1 都是 HEAD 的祖先
- `playwright.config.ts`、`us-journey-tracker.html`、`tests/support/*`、`tests/mocks/pb-samples/*`、`tools/pb/*` 相对 plan_head_before 没有改动
