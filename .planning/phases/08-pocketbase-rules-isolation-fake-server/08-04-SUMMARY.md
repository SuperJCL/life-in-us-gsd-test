---
phase: 08-pocketbase-rules-isolation-fake-server
plan: 04
subsystem: testing
tags: [pocketbase, local-instance, sha256-pin, owner-approval, smoke, loopback, test-04]

requires:
  - phase: 08-pocketbase-rules-isolation-fake-server
    provides: 08-01 的两个迁移、pb/rules.expected.json、rules-snapshot.mjs（snapshotFromLive、diffSnapshots）和 migration-check.mjs
provides:
  - "tools/pb/fetch-local-pb.mjs：所有者批准后的一次性下载，三项核对，只解出 exe；--self-test 不联网"
  - "tools/pb/lib/instance.mjs：PB_EXE_PATH、PB_EXE_SHA256（已钉死）、verifyExe、verifyExeAt、freePort、serveArgs、withInstance；CLI --self-test、--smoke"
  - "tools/pb/PB-LOCAL.md：版本、来源、zip 与 exe 的 sha256、信任模型、批准记录、运行与清理说明"
  - "tools/pb/bin/pocketbase.exe：留存在被 git 忽略的目录里的已批准程序（不进仓库）"
affects: [08-05, 08-06, 08-07, phase-09, phase-10]

plan_head_before: 3c8583bf66520016fa433d1baa7cb1b4a4667d1a
plan_head_after: 85284f302fed335215ca52cef1106c50740889bd

estimate:
  tokens: 65000
  raw_tokens: 65000
  tasks: 3
  confidence: low
actuals:
  tokens: 8000
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "核对优先：没有批准参数不下载，没有钉死的 exe 不运行，每次启动前核对 exe 的 sha256"
    - "一次性实例：127.0.0.1 随机端口、系统临时目录、低优先级、超级用户随机且只在内存、结束时停进程并删目录"

key-files:
  created:
    - tools/pb/fetch-local-pb.mjs
    - tools/pb/lib/instance.mjs
    - tools/pb/PB-LOCAL.md
  modified:
    - .gitignore

key-decisions:
  - "所有者批准下载 0.41.1 Windows 版一次；单一来源的信任模型与 06 D-16 相同，残余风险已如实告知并被接受"
  - "Task 3 没有做任何调和：迁移、快照、沙箱模型一项都没改，smoke 第一次就全过"
  - "TEST-04 不在本计划标记完成：账号隔离的真实验证是 08-05，本计划只提供实例和 exe 钉死"

patterns-established:
  - "withInstance 回调多给两个只读字段 dir（临时目录，smoke 的清理检查用）和 port（回环检查用），都不打印"

requirements-completed: []

coverage:
  - id: D1
    description: "核对优先的路径在下载前打通：留存目录被忽略、下载脚本没批准就拒绝、哈希核对自检、没有钉死的 exe 时实例拒绝运行"
    requirement: "TEST-04"
    verification:
      - kind: unit
        ref: "fetch-local-pb.mjs --self-test（FETCH SELF-TEST OK）、instance.mjs --self-test（INSTANCE SELF-TEST OK）；不带参数退出码 2；没有程序时 --smoke 退出码 2；git check-ignore 覆盖 tools/pb/bin/"
        status: pass
    human_judgment: false
  - id: D2
    description: "所有者在 blocking-human 检查点批准下载；一次下载，三项核对通过，只解出 pocketbase.exe，exe 的 sha256 钉进 instance.mjs 和 PB-LOCAL.md"
    requirement: "TEST-04"
    verification:
      - kind: manual
        ref: "检查点原话“批准下载 (Recommended)”（2026-11-08）；fetch-local-pb.mjs --approved 输出 PB DOWNLOAD OK；第二次运行输出 PB ALREADY PRESENT"
        status: pass
    human_judgment: true
  - id: D3
    description: "真实 0.41.1 上 instance smoke：迁移已应用、快照一致、限流关闭回读、只监听回环、临时目录已删、没有残留进程"
    requirement: "TEST-04"
    verification:
      - kind: integration
        ref: "node tools/pb/lib/instance.mjs --smoke（INSTANCE SMOKE OK，连跑两次）；tasklist 无 pocketbase.exe；node tools/pb/migration-check.mjs 仍为 MIGRATIONS MATCH"
        status: pass
    human_judgment: false

duration: 约 40min
completed: 2026-11-08
status: complete
---

# Phase 8 Plan 04: 本机一次性 PocketBase 的批准下载、钉死与 smoke Summary

**经所有者批准下载一次 PocketBase 0.41.1 Windows 版，三项核对通过后只留存 pocketbase.exe（sha256 钉在 instance.mjs 和 PB-LOCAL.md），真实实例上 smoke 一次全过：迁移已应用、规则与快照一致、只监听回环、清理干净。**

## Performance

- **Duration:** 约 40 分钟（含检查点等待之外的执行时间）
- **Tasks:** 3（Task 1 tracer，Task 2 检查点，Task 3 auto）
- **Files:** 新建 3 个，修改 1 个（`.gitignore`）
- **Commits:** 2（measured：`git rev-list --count 3c8583b..HEAD`，Task 2 是检查点、没有提交）

## 所有者批准记录（Task 2，blocking-human）

| 项目 | 内容 |
|------|------|
| 日期 | 2026-11-08 |
| 所有者的回答（原话） | “批准下载 (Recommended)”，即 approve |
| 向所有者出示的问题（原话） | “是否批准从维护者发布站下载一次 pocketbase_0.41.1_windows_amd64.zip（13,012,018 字节，sha256 fda68dcb…0b0580），只取出 pocketbase.exe 留在不进仓库的 tools/pb/bin/，用于本机临时实例和合成账号？来源只有这一个，核对指纹只能防下载损坏，和阶段 6 给服务器装 PocketBase 时一样。” |
| 批准前已出示 | 完整来源地址 `https://ganigeorgiev.com/meta/pocketbase/pocketbase/download/v0.41.1/`、文件名、大小、完整 sha256、单一来源的信任模型（GitHub 没有 v0.41.1 发布，D-03 交叉核对不适用，与 06 D-16 相同）、弱补强（linux_amd64 那一行对照 Phase 6 钉死值）、范围 |
| 文件名 | `pocketbase_0.41.1_windows_amd64.zip` |
| 大小 | 13,012,018 字节 |
| zip 的 sha256 | `fda68dcbb4812585cf32282a8e79c09f0b065c109c75d840f46d8fd8b59b0580` |
| 范围 | 只覆盖这一次下载（外加读取同站 checksums.txt）；以后每次运行只核对 exe 的哈希、不再下载；换版本需要重新批准 |

## 三项核对和 exe 钉死（Task 3）

`node tools/pb/fetch-local-pb.mjs --approved` 只运行一次，输出：

| 输出 | 结果 |
|------|------|
| `PB_ZIP_PINNED_MATCH=yes` | zip 的大小和 sha256 与钉死值一致 |
| `PB_CHECKSUMS_MATCH=yes` | checksums.txt 里 Windows 那一行恰好一行且一致；linux_amd64 那一行仍等于 Phase 6 钉死的值 |
| `PB_MEMBERS_OK=yes` | 成员名单里恰好一个顶层 `pocketbase.exe`，没有 `..`、绝对路径等可疑成员 |
| `PB_EXE_SHA256` | `f44191176f90382d5a03290496b23b333cf64cf6cb2024893cb39f3c10e46f7e` |
| `PB_EXE_BYTES` | 34,065,920 |
| 结尾 | `PB DOWNLOAD OK` |

exe 的 sha256 已写进 `tools/pb/lib/instance.mjs` 的 `PB_EXE_SHA256` 和 `tools/pb/PB-LOCAL.md`；`--self-test` 断言两处一致。第二次运行 `--approved` 打印 `PB ALREADY PRESENT`，没有联网、没有重新下载。`git ls-files tools/pb/bin` 为空，`git check-ignore` 覆盖 exe。

## smoke 结果（真实 0.41.1）

| 项 | 结果 |
|----|------|
| exe-sha256 | PASS |
| health | PASS |
| migrations-applied | PASS（serve 时迁移已应用：users 的 createRule 为 null，journey_docs 集合存在） |
| snapshot-match | PASS（`snapshotFromLive` 与 `pb/rules.expected.json` 的差异为空） |
| rate-limits | 观察行 `INFO rate-limits-default off`；`PASS rate-limits-off` |
| loopback-only | PASS（本机每个非回环 IPv4 地址都连不上这个端口） |
| cleanup | PASS（临时目录已删）；`tasklist` 没有残留的 pocketbase.exe；系统临时目录里没有 `usj-pb-` 残留 |
| 结尾 | `INSTANCE SMOKE OK`；输出里没有令牌形状（`eyJ`）和 `@example.` 邮箱 |

- **限流默认值（研究 A2）：** 新实例默认就是关闭的（`INFO rate-limits-default off`），所以 `ensureRateLimitsOff()` 返回 false、没有改动设置；A2 在 0.41.1 上成立。这只是观察值，不是通过条件；通过条件是 `rate-limits-off` 的超级用户回读为假，已 PASS。
- **08-01 留下的待确认项：** `users.fields.removeByName` 和 `users.authToken.duration` 在 0.41.1 上都能保存（迁移在 serve 时无错误应用），实例上 users 的非系统字段正好是 `created` 和 `updated`，由 snapshot-match 为空证明。
- 迁移在真实实例上没有报错，研究 A1（某个 JSVM 写法在 0.41.1 上不可用）没有出现。

## 调和

没有做。smoke 第一次运行就全部通过，`pb/rules.expected.json`、`tools/pb/migration-check.mjs` 和两个迁移都没有改动；`node tools/pb/migration-check.mjs` 仍输出 `MIGRATIONS MATCH`。

## 接口的增量扩展

`withInstance` 的回调除计划里的 `baseUrl`、`superuserToken`、`su()`、`ensureRateLimitsOff()` 之外，多给两个只读字段：`dir`（临时目录，smoke 的清理检查用）和 `port`（回环检查用）。两者都不会被打印。08-05、08-06 可以忽略它们。

## Deviations from Plan

None - plan executed exactly as written.

## Auth gates

Task 2 是 `checkpoint:decision`（`gate="blocking-human"`），所有者已回答批准；这是计划内的正常流程，不是偏差。

## Known Stubs

None.

## Threat Flags

None. 本计划新增的网络面只有一个：仅监听 127.0.0.1 随机端口的一次性实例，已在计划的威胁模型里（T-08-14）并由 smoke 的 loopback-only 验证。

## 给后续计划

- 08-05、08-06 直接用 `withInstance` 即可；同一时间只能有一个实例，运行前后用 `tasklist //FI "IMAGENAME eq pocketbase.exe"` 确认没有残留进程。
- 本机运行 PocketBase 没有弹出防火墙提示（实例只在回环地址上）。
- TEST-04 保持 Pending：账号隔离的真实验证由 08-05 完成。ACCT-03、ACCT-04 和 TEST-02 同样保持 Pending。

## Self-Check: PASSED

- FOUND: tools/pb/fetch-local-pb.mjs、tools/pb/lib/instance.mjs、tools/pb/PB-LOCAL.md、tools/pb/bin/pocketbase.exe（被忽略，未跟踪）
- FOUND: 4699200、85284f3 都是 HEAD 的祖先
