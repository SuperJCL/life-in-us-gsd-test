---
phase: 02-account-mock-data-export
plan: 05
subsystem: testing
status: complete
tags: [claude-mock, contract-0.2.96, contract-self-test, CONTRACT.md, account-mode, README, playwright]

requires:
  - phase: 02-account-mock-data-export
    provides: "02-02 的 window.claude mock（claude-runtime.ts、claude-backend.ts）和 AppHarness 账户模式"
provides:
  - "tests/support/constants.ts 的 CLAUDE_CONTRACT_VERSION = '0.2.96'"
  - "tests/e2e/platform/mock-contract.spec.ts：8 条契约自测（MOCK-02 六条、MOCK-04 一条、MOCK-06 一条）"
  - "tests/mocks/CONTRACT.md：版本、已实现条目（含 33 条逐字原文摘录和覆盖用例）、未实现清单、mock 结构、重新核对步骤"
  - "tests/README.md 的第 11 节“账户模式”，目录表新增 tests/mocks/ 和 tests/e2e/storage/"
affects: [02-04, phase-03, phase-04, phase-05]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3
plan_head_before: 33a3cc3dd632ddd81631d861db1b6a3c9fee166b
plan_head_after: e008aee6a962379605444a949583822d00d39166

tech-stack:
  added: []
  patterns:
    - "契约摘录用脚本核对：把 .d.ts 注释的换行和行首星号去掉后合成连续文本，逐行检查 CONTRACT.md 的引用块是不是它的子串"
    - "契约自测在页面里 evaluate，只返回布尔、字符串和数组，断言都在 Node 侧做"
    - "MOCK-06 用例读取 CONTRACT.md，版本号只从 CLAUDE_CONTRACT_VERSION 取，并拒绝本机路径形式"

key-files:
  created:
    - tests/mocks/CONTRACT.md
    - tests/e2e/platform/mock-contract.spec.ts
  modified:
    - tests/support/constants.ts
    - tests/README.md

key-decisions:
  - "契约自测没有暴露 mock 的偏差，tests/mocks/claude-runtime.ts 没有改动，仍然没有导入语句、拒绝分支、错误码或延迟"
  - "CONTRACT.md 里 window.claude 本身被冻结写成“比契约更严的 mock 选择”：契约只规定 resolve 出来的命名空间是冻结的"
  - "README 的账户模式一节放在最后，作为第 11 节，不重排已有章节，避免其他文档对第 7、8 节的引用失效"

requirements-completed: [MOCK-02, MOCK-04, MOCK-06]

coverage:
  - id: D1
    description: "契约自测：window.claude 只有冻结的 use，未知名字（含继承来的名字）resolve null；use() 异步且对已提供的能力 memoize；命名空间、引用、快照冻结且快照形状为 id、exists、data、metadata；db.doc() 路径文法同步抛 TypeError；user.id() 默认返回合成 id、配置为 null 时返回 null"
    requirement: "MOCK-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-02 window.claude exposes only a frozen use() and unknown names resolve null"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-02 use() is asynchronous and memoizes served capabilities"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-02 namespaces, document references and snapshots are frozen and shaped like DocumentSnapshot"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-02 db.doc() enforces the document path grammar synchronously"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-02 user.id() resolves the configured synthetic id"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-02 user.id() resolves null when the mock is configured without an id"
        status: pass
    human_judgment: false
  - id: D2
    description: "downloads.save 接受 string、Blob、ArrayBuffer 三种 data，都返回冻结的 saved 结果，app.backend.downloads 记录解码后的文本"
    requirement: "MOCK-04"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-04 downloads.save accepts string, Blob and ArrayBuffer data and resolves status saved"
        status: pass
    human_judgment: false
  - id: D3
    description: "CONTRACT.md 写明契约 0.2.96、已实现条目、未实现清单、mock 结构和重新核对步骤，不含本机路径；用例核对版本号与常量一致"
    requirement: "MOCK-06"
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/mock-contract.spec.ts#MOCK-06 tests/mocks/CONTRACT.md names contract 0.2.96 and lists what the mock does not implement"
        status: pass
    human_judgment: true
    rationale: "用例只核对版本号、关键词和路径形式；CONTRACT.md 的原文摘录是否逐字正确，靠执行时的脚本核对（33 行 0 处不符），文档是否讲清楚需要人读"
  - id: D4
    description: "README 的账户模式一节：怎么打开、就绪条件、怎么读记录、expectAccountMode 和反向对照、契约文档位置；目录表新增两行"
    verification: []
    human_judgment: true
    rationale: "文档内容只能用 grep 检查关键词是否出现，是否讲得清楚要人读"

duration: 13min
completed: 2026-11-03
---

# Phase 2 Plan 05: 契约自测与 CONTRACT.md Summary

**8 条契约自测证明 02-02 的 window.claude mock 符合运行时契约 0.2.96，没有发现偏差；tests/mocks/CONTRACT.md 写明版本、已实现条目（33 行逐字原文摘录，脚本核对）、未实现清单、mock 结构和重新核对步骤，README 新增“账户模式”一节。**

## 执行情况

- 开始约 2026-11-03T19:10Z，结束 2026-11-03T19:23:05Z，约 13 分钟（开始时间按上一份计划的结束时间估算，没有当场记录）
- 3 个任务，3 个提交，新建 2 个文件，修改 2 个文件，没有新增依赖，没有运行任何安装命令
- `us-journey-tracker.html` 的 sha256 与基线一致，全程未被跟踪

## 提交

| 任务 | 提交 | 内容 |
|------|------|------|
| 1（tracer） | 33a0072 | CLAUDE_CONTRACT_VERSION、CONTRACT.md（版本、claude.d.ts 条目、未实现清单）、MOCK-02 window.claude 自测、MOCK-06 文档核对 |
| 2 | e4c7853 | 其余六条契约自测（use 时序与 memoize、冻结与快照形状、路径文法、user.id 两条、downloads.save 三种 data），CONTRACT.md 第 2 节补上 db、user、downloads |
| 3 | e008aee | CONTRACT.md 第 4、5 节（mock 结构、重新核对步骤），README 账户模式一节和目录表 |

Tracer 的 `<verify>` 是纯自动化命令（`HUMAN_VERIFY_MODE` 为 end-of-phase），提交前后都跑过：契约自测文件两条通过、第二条 grep 组合通过、完整 `npm test` 43 条通过、`privacy-check --all` 通过，随即展开 Task 2。

## precondition 与契约来源

- **precondition 满足：** 找到 0.2.96 的四个类型定义（claude.d.ts、db.d.ts、user.d.ts、downloads.d.ts），都存在且非空，只有一个版本目录，不需要 `cmp`。目录路径只在终端里使用，没有写进任何被跟踪的文件、提交信息或本文件。
- **原文摘录取自：** Claude Code 自带的 artifact-capabilities 技能，文件为 claude.d.ts、db.d.ts、user.d.ts、downloads.d.ts。
- **未实现清单还引用了同一技能里的这些文件名（只作为名字，没有摘录）：** artifact.d.ts、self.d.ts、assets.d.ts、comments.d.ts、files.d.ts、mcp.d.ts、permissions.d.ts、room.d.ts、sample.d.ts。
- **逐字核对：** 临时脚本（放在会话临时目录，没有进仓库）把四个 .d.ts 的注释去掉换行和行首星号后合成连续文本，逐行检查 CONTRACT.md 的 33 个引用行是不是它的子串：33 行，0 处不符。把其中一处大小写改掉做对照，脚本能报出不符，所以核对不是空转。

## 契约自测暴露的偏差

没有。8 条用例在第一次运行就全部通过，连续运行两次结果一致，`tests/mocks/claude-runtime.ts` 没有改动，仍然没有导入语句，也没有 `Promise.reject`、`setTimeout(`、`ok: false`。

## 与计划描述不一致的地方

**“明确没实现的条目”里，名字比计划多或叫法不同的：**

- db：计划只列了 `collection()`、`update`、`delete` 和查询。契约还有 `acquire`（短租约）、`DocumentReference.collection()`、`CollectionReference` 的 `doc(id?)` 和 `add()`，已在第 3.2 节补上。错误码按契约原文逐个列出：`invalid_argument`、`resource_exhausted`、`quota_exceeded`、`unavailable`、`revoked`、`not_granted`、`capability_disabled`、`capability_removed`、`transform_error`。
- user：计划列了 `me`、`profiles`、`isOwner`、`canEdit`、`can`、`search`。契约还有 `name()`、`avatarUrl()`、`email()`，已补上。
- downloads：计划列了 `declined`、`rate_limited`、`rejected_extension`、`too_large`、`bad_request`。契约还有 `extension_not_enabled`、`request_unknown`、`not_signed`、`unavailable` 和四个生命周期码，已补上。另外补了两项计划没写的行为：契约要求内容非空（mock 不检查），传入的 `ArrayBuffer` 会被转移而失效（mock 只读不转移）。
- claude：计划写“能力开关（三个能力总是提供）”。契约的说法是能力可能“not served”“not granted at initialization”或“module failed to load”，并且还有 artifact（旧写法 self）、assets、comments、files、mcp、permissions、room、sample 八个能力，mock 对它们 resolve `null`。这些来自 claude.d.ts 之外的 .d.ts 文件，已在文档里写出文件名。
- db 的访问规则和 `data/users/` 私有分区：计划没有列，契约规定别的查看者的子树读起来像不存在、写入被拒绝；mock 不做分区，已补上。

**计划里的中文概括与契约原文在措辞或范围上不一致的地方：**

1. “同一文档并发写的检测”：契约里没有一个叫“检测”的机制。原文是调用方规则（`ONE WRITE AT A TIME per document`），并发写入过多时由 `resource_exhausted` 拒绝。文档写成“mock 不检测并发写，后到的覆盖先到的”，并引用了这两处原文。
2. “限流”：契约里有两处互不相干的限流。db 的是 `resource_exhausted`（每个查看者的调用速率、64 个订阅上限、并发写入、查询扫描量），downloads 的是 `rate_limited`（已经有一个提示没关闭、最近提示太多、前一个 `mov` 还在检查）。计划只概括了后者，文档两处都写了，`rate_limited` 一条按原文逐字引用，没有拿中文概括当原文。
3. “window.claude 被冻结”：计划把它写成契约条目。契约只规定 resolve 出来的命名空间是冻结的，没有要求 `window.claude` 本身冻结。文档写成“比契约更严的 mock 选择（D-03）”，没有把它当契约原文。
4. “长度上限”：契约按字节计，mock 按字符计（02-02 SUMMARY 已记录）。段文法只允许 ASCII，对合法路径两者相同。文档在第 3.2 节写明。
5. “save 的 request 字段和 delivered 结果”（02-02 SUMMARY 记录的第二条）：按计划写进第 3.4 节。

计划里其余项（`onSnapshot`、`fromCache` 和 `hasPendingWrites` 恒为 false、文档大小和嵌套深度、文件名清洗和扩展名白名单、加载延迟和 10 秒后返回 null、`rate_limited`）与契约原文的名字和范围一致。

## 观察值与稳定性

- 契约自测文件连续运行两次，8 条都通过，没有重试。
- 完整 `npm test` 在每个任务结束时都通过且没有 flaky（43 条、49 条、49 条）；`node tools/privacy/privacy-check.mjs --all` 退出 0（78、80、80 个文件）。
- MOCK-06 用例拒绝的路径形式：Windows 用户目录、macOS 用户目录、Linux 用户目录、`bundled-skills`、`AppData`；CONTRACT.md 里 `data/users/<id>` 一律用占位写法，没有写出带真实字母的 `/users/` 路径，因为验收命令的大小写不敏感正则会把它当成用户目录。

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None。本计划只产出测试用例和文档，没有占位数据或未接线的组件。

## Threat Flags

None。本计划没有新增网络端点、认证路径或信任边界上的文件访问。T-02-22 到 T-02-24 的缓解都已落地：8 条契约自测、33 行原文摘录脚本核对、MOCK-06 用例和 verify 的路径正则、runtime 没有改动且 grep 确认没有导入语句和错误路径；T-02-SC：没有新增依赖，没有运行安装命令。

## Next Phase Readiness

02-04 可以在 README 的第 11 节之后继续补充导出验证的说明（它依赖本计划）。后续阶段写账户模式用例时，直接照 README 第 11 节用 `app.open({ mode: 'account', seed })`、`app.backend` 和 `app.expectAccountMode()`；新增 mock 能力或升级契约版本时按 CONTRACT.md 第 5 节重新核对。

## Self-Check: PASSED

- tests/mocks/CONTRACT.md、tests/e2e/platform/mock-contract.spec.ts、tests/support/constants.ts、tests/README.md 存在
- 提交 33a0072、e4c7853、e008aee 都在当前分支上，`git rev-list --count` 从计划开始前的提交数到 HEAD 为 3
- 三个任务的验收命令全部通过；`npm test` 退出 0 且没有 flaky；`privacy-check --all` 退出 0；应用文件 sha256 与基线一致且未被跟踪
