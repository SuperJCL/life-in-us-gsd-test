---
phase: 16-release-acceptance
plan: 02
subsystem: infra
tags: [deploy, hsts, csp, verify-site, server-check, build-site, pocketbase, isolation-check, readme]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: "13-REVIEW 的 WR-02、WR-05、WR-06、IN-04、IN-05、IN-09、IN-10、IN-11 八条发现；build-site、verify-site、server-check、server-config-check 和 deploy-tools.spec"
  - phase: 16-release-acceptance
    provides: "16-01 的 server-check C-24、C-25 和 274 条自检（本计划在它之上继续加）"
provides:
  - "HSTS 期望值只有一个来源 HSTS_MAX_AGE（build-site 导出，verify-site 的页面头检查和 server-check 的 C-17 共用）"
  - "外壳版本号把 CSP 头文本算进去；inlineBlocks 不再把 data-src 当外部脚本"
  - "verify-site 的 F-11 改用缺字段注册请求，判定常量 F11_LOCKED_STATUS=403、F11_OPEN_STATUS=400 取自本机 PocketBase 0.41.1 上 ACCT03-6、ACCT03-7 的实测"
  - "isolation-check 50 条断言；server-config-check 的 restoreEnv；deploy-tools.spec 从 BUNDLE_COUNT 算文件数"
  - "README 第 2、8、12、15 节与脚本行为一致，第 15 节指向 16-ACCEPTANCE.md"
affects: [16-05, 16-06, 16-08]

actuals:
  tokens: 8800
  tasks: 3
  commits: 3

plan_head_before: a1721414fb8ecf15a2c3ba16a01846fe9abe53ba
plan_head_after: 9f5cf0faf249e8c9465f518b9bc212f11c01b982

tech-stack:
  added: []
  patterns:
    - "检查脚本的期望值从 build-site 导出的常量引入，不在各脚本里各写一份字面值"
    - "线上检查的探测请求要在本机一次性实例上用 --observe 实测状态码，再把实测值写成常量，并在自检里断言“锁住”和“放开”两个码不同"
    - "限流或上游出错（429、5xx）的探测结果归为 inconclusive，先重试，仍不确定才报 FAIL，并说明不代表规则有问题"

key-files:
  created: []
  modified:
    - deploy/build-site.mjs
    - deploy/verify-site.mjs
    - deploy/server-check.mjs
    - deploy/server-config-check.mjs
    - deploy/README.md
    - tests/e2e/platform/deploy-tools.spec.ts
    - tools/pb/isolation-check.mjs
    - tests/mocks/PB-CONTRACT.md

key-decisions:
  - "HSTS_MAX_AGE 留 86400，两个 nginx 头文件不改；verify-site 取出 max-age 的整数后要求恰好相等，更大的数（含 864000）也不算通过"
  - "F-11 的缺字段探测在本机实测得到 L=403、O=400，两者不同，所以按计划改 F-11；不需要走“L 等于 O 就停下”的偏离路径"
  - "anonSignupVerdict 对 429 和 5xx 返回 inconclusive，F-11 等 5 秒、15 秒各重试一次，三次都不确定才 FAIL，note 说明不代表注册规则有问题"
  - "ACCT03-6、ACCT03-7 的断言不预设状态码，只要求 4xx（不含 429）且账号数不变；具体码由 --observe 的 OBS 行读出再写进 verify-site"

patterns-established:
  - "server-check 的自检传函数、verify-site 的自检传已算好的值：新用例照各自的写法，别混用（本次差点在 verify-site 里传了函数，会永远算通过，已改正）"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "HSTS 期望值单一来源（WR-06）：常量和两个头文件一起改成一年时 C-17 通过，只改常量或只改头文件都失败；verify-site 的页面头检查随常量变化"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/server-check.mjs --self-test（SELF-TEST OK (277 cases)）；node deploy/verify-site.mjs --self-test（SELF-TEST OK (58 cases)）；node deploy/server-check.mjs（PASS C-17）"
        status: pass
    human_judgment: false
  - id: D2
    description: "外壳版本号含 CSP 头文本（WR-02）、data-src 内联脚本进 CSP 哈希（IN-10）"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/build-site.mjs --self-test（SELF-TEST OK (35 cases)，含 只改 buildCsp 的一个指令，版本号就变、内联块：data-src 属性不算外部脚本）"
        status: pass
    human_judgment: false
  - id: D3
    description: "deploy-tools.spec 的文件数由 BUNDLE_COUNT + 1 算出（IN-11）；恢复环境变量时原来没有的键被删掉（IN-05）"
    requirement: "OPS-04"
    verification:
      - kind: integration
        ref: "tests/e2e/platform/deploy-tools.spec.ts 的两条 OPS-03 用例（check-report 两次都是 REPORT OK expected=2 flaky=0 unexpected=0）；node deploy/server-config-check.mjs --self-test（SELF-TEST OK (33 cases)）"
        status: pass
    human_judgment: false
  - id: D4
    description: "F-11 不在线上建账号（IN-09）：缺字段请求，判定常量取自本机一次性 PocketBase 0.41.1 上 ACCT03-6（403）、ACCT03-7（400）的实测"
    requirement: "OPS-04"
    verification:
      - kind: integration
        ref: "node tools/pb/isolation-check.mjs --observe：PASS ACCT03-6、PASS ACCT03-7，最后一行 ISOLATION OK 50/50"
        status: pass
      - kind: unit
        ref: "verify-site 自检 匿名注册探测：实测的锁住状态码算通过…、匿名注册探测：429 和 5xx 算不确定…"
        status: pass
    human_judgment: true
    rationale: "prohibition（线上检查不创建账号、不写账号数据）的状态是 verification: judgment：F-11 现在只发缺字段请求，本机已证明规则放开时也被校验拒绝且账号数不变，但对线上站点的实际运行要等 16-05 之后的 --stage full 由所有者确认"
  - id: D5
    description: "README 第 2、8、12、15 节与脚本和事实一致（IN-04、WR-05、WR-06、D-04），C-23 仍通过"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/server-check.mjs（PASS C-23，最后一行 SERVER-CHECK OK (25 checks)）"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-11-18
status: complete
---

# Phase 16 Plan 02: 本机部署工具和文档修复（WR-02、WR-05、WR-06、IN-04、IN-05、IN-09、IN-10、IN-11）Summary

**HSTS 期望值收成一个常量 `HSTS_MAX_AGE`，两个检查脚本共用；外壳版本号含 CSP；F-11 改用缺字段请求，判定码 403/400 取自本机 PocketBase 0.41.1 的实测，不会在线上建账号；README 的日志、升级和验收说明与事实一致。**

## Performance

- **Duration:** 约 10 分钟
- **Started:** 2026-11-18T05:41:21Z（UTC，本机时区 -08:00 下是 11-17 晚上）
- **Completed:** 2026-11-18T05:50:35Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- **WR-06（HSTS）：** `deploy/build-site.mjs` 导出 `HSTS_MAX_AGE = 86400`。`verify-site` 的 `checkPageHeaders(get, hstsMaxAge = HSTS_MAX_AGE)` 从头值里取出 `max-age=` 后的整数，要求恰好等于期望值，不再用子串包含。`server-check` 的 `c17`、两个头文件夹具、CHECKS 标题、`loadContext` 和 `goodContext` 都用这个常量；两个检查脚本里一天 HSTS 的字面值现在出现 0 次。两个 nginx 头文件没有改（本阶段不提高 HSTS）。
- **WR-02：** `shellVersion` 在页面之后、SDK 之前把 `cspConfText` 算进哈希，`buildSite` 传入它；新自检“只改 buildCsp 的一个指令，版本号就变”。外壳版本号因此整体变化一次，这是预期的。
- **IN-10：** `inlineBlocks` 的否定先行改成 `(?![^>]*\\ssrc\\s*=)`：`<script data-src=…>` 仍算内联块，它的哈希进 CSP；`<script  src = "y">` 这类带空白的写法仍算外部脚本。
- **IN-11：** `deploy-tools.spec.ts` 动态 `import` build-site 取 `BUNDLE_COUNT`，构建行的期望是 `${BUNDLE_COUNT + 1} files`，不再写死 `(33 files)`。
- **IN-05：** `server-config-check` 新增导出函数 `restoreEnv(old)`，`runLocal` 的 finally 改用它；自检“原来没有的键被删掉而不是写成 undefined”。
- **IN-09（F-11）：** `isolation-check` 新增 ACCT03-6（锁住的 users，请求体 `{}`）和 ACCT03-7（放开的 `users_open`，请求体 `{}`），断言只要求 4xx（不含 429）且账号数不变。`verify-site` 新增 `F11_LOCKED_STATUS = 403`、`F11_OPEN_STATUS = 400` 和纯函数 `anonSignupVerdict`；F-11 改发请求体 `{}` 的注册请求，不再生成邮箱和口令，通过后照旧检查匿名列 `journey_docs` 为空。F-11 标题和全量检查的 19 项总数不变。
- **README：** 第 8 节 HSTS 和第 12 节 HSTS 都指向 `HSTS_MAX_AGE` 并要求“同一次批准”改常量和两个头文件；第 2 节日志如实写明错误日志在上游出错时含完整请求行（包括 `?token=`，令牌短时有效）；第 8 节“PocketBase 版本”如实说明本体升级没有脚本；第 15 节指向 `16-release-acceptance/16-ACCEPTANCE.md`。

## Task Commits

1. **Task 1（tracer）：HSTS 期望值单一来源（WR-06）** - `043df17`（fix）
2. **Task 2：外壳版本号含 CSP、data-src、BUNDLE_COUNT、restoreEnv（WR-02、IN-10、IN-11、IN-05）** - `d471fff`（fix）
3. **Task 3：F-11 缺字段探测、ACCT03-6/7、README 第 2、8、15 节（IN-09、IN-04、WR-05、IN-11）** - `9f5cf0f`（fix）

**Plan metadata:** 见随后的 `docs(16-02)` 提交。

## 检查结果

- 五个部署工具自检的最后一行：build-site `SELF-TEST OK (35 cases)`（基线 33）、server-check `SELF-TEST OK (277 cases)`（16-01 之后是 274）、server-config-check `SELF-TEST OK (33 cases)`（基线 32）、verify-site `SELF-TEST OK (58 cases)`（16-01 之后是 54）、make-acceptance-data `SELF-TEST OK (15 cases)`；isolation-check 自检 `ISOLATION SELF-TEST OK`。
- `node deploy/server-check.mjs` 最后一行 `SERVER-CHECK OK (25 checks)`，C-17、C-23 都 PASS。
- `node tools/pb/isolation-check.mjs --observe`（本机一次性 PocketBase 0.41.1，已批准并钉死哈希的 `tools/pb/bin` 程序，没有下载任何东西）：

  | 编号 | 结果 | OBS |
  |------|------|-----|
  | ACCT03-6（锁住的 users，请求体 `{}`） | PASS | `status=403 code=-` |
  | ACCT03-7（放开的 users_open，请求体 `{}`） | PASS | `status=400 code=validation_required` |

  最后一行 `ISOLATION OK 50/50`；运行后没有残留的 PocketBase 进程。锁住 403、放开 400，都是 4xx 且不相同，所以 F-11 按计划改，没有走“L 等于 O”的偏离。
- `tests/e2e/platform/deploy-tools.spec.ts` 的两条 OPS-03 用例：任务 2 之后和三个任务做完之后各跑一次，`check-report.mjs` 都是 `REPORT OK expected=2 flaky=0 unexpected=0`（单 worker，低优先级，只跑这个文件）。
- 每次提交前 `privacy-check.mjs --staged` 都打印“隐私检查通过”；本计划没有运行 `verify-site --stage baseline|full`，没有 ssh，没有读 `private/`。

## Decisions Made

- 按 D-01 保留 HSTS 一天，只收口期望值的来源，不提高数值。
- 缺字段请求的两个状态码按实测写成常量，而不是在代码里假设；换 PocketBase 版本时用 `isolation-check --observe` 重测（注释里写明）。
- 429 和 5xx 不当成“规则放开”也不当成“通过”：F-11 重试两次，三次都不确定才 FAIL，note 说明可隔一分钟重跑。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 新增的 verify-site 自检第一版传了函数而不是布尔值**
- **Found during:** Task 3
- **Issue:** verify-site 的 `expect(name, 布尔值)` 不会调用传进去的函数，我第一版把“匿名注册探测：实测的锁住状态码算通过…”写成了 `expect(name, () => …)`，这条自检会永远算通过。计划的执行约束里正好提醒过别混用，写的时候还是写错了。
- **Fix:** 改成先算好 `vOpen`、`v2xx`、`vOther` 再传布尔表达式；再跑自检，58 条全过。
- **Files modified:** `deploy/verify-site.mjs`
- **Verification:** `node deploy/verify-site.mjs --self-test` 最后一行 `SELF-TEST OK (58 cases)`
- **Committed in:** `9f5cf0f`（改在提交之前，没有出现有问题的提交）

**2. [Rule 2 - Missing critical] 给 verify-site 多加一条“只是以期望值开头的更大数也能发现”的自检，并让 server-check 多加“只改头文件不改常量”的坏用例**
- **Found during:** Task 1
- **Issue:** 计划要求“恰好等于”，但自检里只有一年这个反例，不能证明子串包含的旧写法已经去掉。server-check 只有“只改常量”的坏用例，缺反向的一半。
- **Fix:** verify-site 加 `HSTS 只是以期望值开头的更大数也能发现`（`max-age=${HSTS_MAX_AGE}0`）；server-check 加 `C-17 坏：只改头文件不改常量`。
- **Files modified:** `deploy/verify-site.mjs`、`deploy/server-check.mjs`
- **Committed in:** `043df17`

### 其他与计划字面不同的地方（不算偏差，记录以便核对）

- **PB-CONTRACT.md 多了一行 ACCT03-6、-7 的实测码**（403、400），放在“已写死进隔离断言”的表里，和 ACCT03-5 那行相邻；计划只要求把 48/48 改成 50/50。
- **isolation-check 的文件头用法说明没有写总数，** 所以只改了 EXPECTED_IDS、两条新断言和 PB-CONTRACT.md 里的 `ISOLATION OK 50/50`。

**Total deviations:** 2 auto-fixed（1 个 Rule 1，1 个 Rule 2）
**Impact on plan:** 都是本任务自己写出来的缺口，没有扩大范围；没有碰两个 nginx 头文件、`us-journey-tracker.html` 和 `APP_SHA256`。

## Issues Encountered

- Bash 工具会把命令里的反斜杠减半，用 Node 脚本批量改带 `\\` 的源码（正则、`join('\n')`）时锚点对不上；改成直接用 Edit 工具改这几处后解决。计划里 `grep -qF '(?![^>]*\\ssrc\\s*=)'` 这类验证命令在这个环境下也要写成四个反斜杠才能匹配到文件里的两个反斜杠（文件内容本身是对的：`\\ssrc\\s*=`）。

## Next Phase Readiness

- 16-05 发布时：新版本号会比 `0ba1339903f1` 之后的任何一版都不同（版本号现在含 CSP 头文本，这是预期的）；部署后立刻跑 `verify-site --stage full`，此时 F-11 只会发缺字段的注册请求，期望得到 403；如果得到 400 说明注册规则放开了（没有建账号），得到 2xx 才需要去后台删 `anon-` 开头的账号。
- 16-06 和 16-08 用的清单在 `16-ACCEPTANCE.md`；README 第 15 节已经指向它，文件本身由后面的计划新建。
- `site-assets.spec.ts` 里对 `13-ACCEPTANCE.md` 的引用不在本计划的 `files_modified` 里，没有改（D-04 提到要一起改指新清单，留给创建 `16-ACCEPTANCE.md` 的计划）。

## Known Stubs

None。

## Threat Flags

None：本计划只改本机检查脚本和文档；F-11 的探测请求比以前更保守（缺字段，不建账号），没有新增网络端点、认证路径或信任边界上的文件访问。

## Self-Check: PASSED

- 8 个改动的文件都存在；`043df17`、`d471fff`、`9f5cf0f` 都是 HEAD 的祖先。
- `commits: 3` 来自 `git rev-list --count a172141..HEAD`（账本文件里记录的起点），不是叙述出来的。
