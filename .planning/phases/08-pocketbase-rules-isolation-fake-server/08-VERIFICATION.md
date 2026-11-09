---
phase: 08-pocketbase-rules-isolation-fake-server
verified: 2026-11-08T12:00:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-01-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-01-SUMMARY.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-02-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-02-SUMMARY.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-03-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-03-SUMMARY.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-04-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-04-SUMMARY.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-05-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-05-SUMMARY.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-06-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-06-SUMMARY.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-07-PLAN.md"
  - ".planning/phases/08-pocketbase-rules-isolation-fake-server/08-07-SUMMARY.md"
  - "package.json"
  - "pb/pb_migrations/1794096000_users_lockdown.js"
  - "pb/pb_migrations/1794096100_journey_docs.js"
  - "pb/rules.expected.json"
  - "playwright.cloud.config.ts"
  - "tests/PROBES.md"
  - "tests/cloud/cloud-harness.spec.ts"
  - "tests/cloud/guard-cloud.spec.ts"
  - "tests/cloud/pb-contract.spec.ts"
  - "tests/cloud/probes-cloud.spec.ts"
  - "tests/mocks/PB-CONTRACT.md"
  - "tests/mocks/pb-runtime.ts"
  - "tests/mocks/pb-samples/realtime.json"
  - "tests/mocks/pb-samples/rest.json"
  - "tests/mocks/pb-server.ts"
  - "tests/support/app.ts"
  - "tests/support/constants.ts"
  - "tests/support/static-server.cjs"
  - "tests/support/test.ts"
  - "tools/pb/isolation-check.mjs"
  - "tools/pb/lib/instance.mjs"
  - "tools/pb/lib/normalize.cjs"
  - "tools/pb/lib/scenarios.cjs"
  - "tools/pb/migration-check.mjs"
  - "tools/pb/record-samples.mjs"
covered_digest: "v4:sha256:1c9ba350fd8301f373d507d862a71d58e2368a5601409ed36d503c80a1428eab"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 8: PocketBase 规则、隔离与假服务器 验证报告

**阶段目标：** 集合和规则写成可重放的迁移文件，并在一次性的本机真实 PocketBase 上用两个合成账号证明：网页上无法注册，账号之间读不到也改不了对方的数据。同时有一台按真实协议样本做成的 Node 侧假 PocketBase 和 cloud 测试模式，后面的云端功能可以先写测试再写代码，测试时不碰任何真实服务器。
**验证时间：** 2026-11-08
**状态：** passed（Phase 8 范围内）
**再验证：** 否，首次验证

> 重要说明：**TEST-02 整条需求目前并未满足**。ROADMAP（Phase 8 Notes）、CONTEXT 和 REQUIREMENTS.md 都把它定义为“Phase 8 打基础，Phase 9–12 各自补 cloud 用例，Phase 13 全量收口”。本阶段验证的是基础部分（cloud 入口、同源 SDK、假服务器、护栏、PROBE-9、协议样本、契约自测），基础部分全部成立。REQUIREMENTS.md 里 TEST-02 保持 Pending 是正确的，不是 Phase 8 的缺口。

## 验证方式

没有采信 SUMMARY。直接读了迁移文件、规则快照、隔离脚本、假服务器、契约自测、护栏、PROBES.md、PB-CONTRACT.md，并实际运行：

- `node tools/pb/isolation-check.mjs`（本人亲自运行一次，约 19 秒）：真实 PocketBase 0.41.1 一次性实例，输出 `ISOLATION OK 48/48`，0 条 FAIL；运行前后 `tasklist` 都没有 pocketbase.exe 进程。
- `node tools/pb/migration-check.mjs`：`MIGRATIONS MATCH`；`--self-test`：`MIGRATION SELF-TEST OK 19`。
- `node tools/pb/record-samples.mjs --check`：`SAMPLES CLEAN 2`。
- `node tools/pb/isolation-check.mjs --self-test`、`node tools/pb/fetch-local-pb.mjs --self-test`：均 OK。
- `node tools/privacy/privacy-check.mjs --self-test`（193 项）、`--all`（312 个文件）、`node tools/privacy/hook-drill.mjs`：全部通过。
- `playwright test --config=playwright.cloud.config.ts --list`：列出 44 条 cloud 用例（只列出，没有运行，遵照要求不重跑 Playwright 套件）。
- 未下载任何东西，没有 ssh，没有读 private/ 或 tools/pb/bin/ 的内容（只做了 `ls` 计数和 `git check-ignore`）。

回归门由编排器提供：默认套件 175/175、test:cloud 44/44（评审修复阶段），本人没有重跑。

## 目标达成情况

### 可观察的真值（ROADMAP 成功标准）

| # | 真值 | 状态 | 证据 |
|---|------|------|------|
| 1 | 在一次性本机 PB 0.41.1 上，隔离脚本用两个合成账号逐条断言全部通过：匿名注册被拒；A 读不到、列不出、改不了、删不掉 B 的文档；改 `owner`/`kind` 被拒；超 4 MiB 被拒；同账号同 `kind` 只一份；二进制只下载一次、留存在被忽略目录、每次运行前核对 sha256；只监听 127.0.0.1、数据放临时目录、用完删除 | VERIFIED | 本人实跑 `ISOLATION OK 48/48`。逐条看输出：ACCT03-1..5（匿名与已登录注册 403、自删 403、删他人账号 403、反向对照）；ACCT04-1..6（列表只有自己 2 条、filter 指向 B 得空列表、查看 B 404、更新 B 404 且不变、删除 B 403 且 B 还在、删除自己也 403）；ACCT04-7（owner=B 创建被拒且槽位空着）；ACCT04-8（同 kind 重复 400 `validation_not_unique`）；ACCT04-10..13（更新带 owner/kind、含修饰符键，404 且回读不变）；ACCT04-16/17（3.9 MiB 成功，超 4194304 字节 400）；RT-1..7（实时订阅不外泄）；NEG-1（对故意写错规则的集合，各检查都报出泄漏，说明断言不是空转）。`tools/pb/lib/instance.mjs` 钉死 `PB_EXE_SHA256`（行 34）并在每次启动前核对（行 40–53、不一致退出码 2），`--http=127.0.0.1:<随机端口>`、`mkdtemp(os.tmpdir())`、结束 `rmSync`、`os.setPriority(BELOW_NORMAL)`；`git check-ignore` 确认 `/tools/pb/bin/` 被忽略，目录里只有 1 个文件；08-04-SUMMARY 记录了所有者在 blocking-human 检查点的批准。 |
| 2 | 集合和规则只写在迁移文件里且只有结构；`users` 注册和自删除显式关闭、OAuth 和 OTP 关闭、令牌 90 天以上；对新实例重放得到同样的规则；隔离脚本不进默认 `npm test` | VERIFIED | `pb/pb_migrations/1794096000_users_lockdown.js`：`createRule = null`、`deleteRule = null`、`listRule/viewRule = "id = @request.auth.id"`、`updateRule` 含 `verified:isset = false && emailVisibility:isset = false`、`oauth2/otp/mfa/authAlert.enabled = false`、`authToken.duration = 7776000`（90 天）。`1794096100_journey_docs.js`：`deleteRule: null`、`updateRule` 禁止 `owner:isset`、`kind:isset`、`data.maxSize: 4194304`、`(owner, kind)` 唯一索引。两份迁移里没有任何记录、账号、邮箱、口令或令牌。REPLAY-1 通过：第二个全新实例上重放迁移得到的规则快照与第一个实例逐字一致，也与 `pb/rules.expected.json` 一致。`migration-check` 的篡改自检 19 项全过（说明规则被改动时会报警）。`playwright.config.ts` 的 `testDir` 是 `./tests/e2e`，`package.json` 里 `pb:isolation` 是独立脚本，默认 `npm test` 不包含隔离脚本和 cloud 用例。注：目录名是 `pb/pb_migrations/`（走 `--dir pb`），与 ROADMAP 的 `pb_migrations/` 只差父目录 `pb/`，不影响“只写在迁移文件里”。 |
| 3 | `PB-CONTRACT.md` 写明“服务器 0.41.1 配 SDK 0.28.1”并收录真实实例录下的样本（登录、刷新令牌、读取、创建、更新、唯一索引冲突、401、实时事件）；契约自测证明假服务器与样本一致 | VERIFIED | `tests/mocks/PB-CONTRACT.md` 第 1 节标题和正文含该字样与两个 sha256，第 3 节列出 28 个场景（auth-ok、refresh-ok、refresh-invalid-token 401 且为唯一 401、list/view/create/update/delete 各变体、create-duplicate-kind 的 `validation_not_unique`、realtime-connect/subscribe/update-fields/create-full 等）。`tests/mocks/pb-samples/{rest,realtime}.json` 存在且 `--check` 为 CLEAN。`tests/cloud/pb-contract.spec.ts` 对场景表逐个场景在全新 `FakePbServer` 上执行同一组请求（与录制共用 `scenarios.cjs`、`normalize.cjs`），比较状态码（永不进偏差登记）、顶层键、归一化正文、令牌声明；`INTENTIONAL_DEVIATIONS` 为空数组；场景数 28 + 版本一致性 1 = 29 条用例，已用 `--list` 确认；`handle()` 返回 null（未实现）直接抛错，不会当作“无差异”。SDK 文件 sha256 `94c1e032…4a9f` 本人重算，与 `SHA256SUMS`、`constants.ts`、PB-CONTRACT.md 三处一致。 |
| 4 | `AppHarness` cloud 模式：真实 SDK（同源、固定版本、记录 sha256）连假服务器完成登录、读写、订阅，实时由页面侧假 `EventSource` 承接；请求假服务器以外任何地址使 case 失败并有故意违规自检；`setOffline` 是否派发事件由探针确认并写进 PROBES.md | VERIFIED | `tests/support/app.ts` 有 `cloud` 模式（`mapMode`、`app.fake`）；`static-server.cjs` 同源提供 `/vendor/pocketbase.iife.js`，启动时核对 sha256，不一致拒绝启动；`tests/mocks/pb-runtime.ts` 的 `installFakeEventSource` 替换 `window.EventSource`。`cloud-harness.spec.ts` 9 条用例（登录与列表、创建与更新、拒绝他人/重复 kind/带 owner 或 kind 的更新/超大/删除、无效令牌按匿名、订阅只收到自己账号、同文档导航保持连接等）。`guard-cloud.spec.ts` 的 3 条用例做故意违规自检（未实现的 /api 路径、外部主机、非白名单应用路径、真实 EventSource），并断言 `classifyRequest` 在 cloud 与 v1 两档策略下的放行与违规集合。`tests/PROBES.md` 的 PROBE-9a/9b/9c 有结论：`setOffline` 真实改 `navigator.onLine` 并各派发一次 offline/online；但被 route 接住的请求和假 EventSource 投递不受其影响，已写明对 Phase 10 的含义。 |
| 5 | v1 用例照旧通过；cloud 用例有单独入口，同样低优先级、1 个 worker | VERIFIED（附提示） | `package.json` 有 `test:cloud`，指向 `playwright.cloud.config.ts`，后者 `testDir: ./tests/cloud`、`workers: 1`、展开基础配置。编排器报告默认套件 175/175（v1 的 154 条是其子集；Phase 7 起新增的用例在 175 之内）、cloud 44/44。`USJ_TEST_MODE` 只在 cloud 配置里设置，用例 `harness maps account mode to cloud only when USJ_TEST_MODE is cloud` 证明默认模式不被映射。提示：“低优先级”只是运行约定，`playwright.cloud.config.ts` 没有代码强制（与默认 `npm test` 对等，见下面 IN-07）；`isolation-check` 和 `record-samples` 则确实调用了 `os.setPriority`。 |

**得分：** 5/5 项真值已验证（0 项仅存在但行为未验证）

### 需求覆盖

| 需求 | 来源计划 | 描述 | 状态 | 证据 |
|------|----------|------|------|------|
| ACCT-03 | 08-01、08-05 | 账号只能由所有者创建，网页无法注册 | SATISFIED | `users.createRule = null`、`deleteRule = null`；真实实例上 ACCT03-1..5 全过（匿名与已登录注册均 403，账号数不变，反向对照在 createRule 为空的集合上匿名注册成功，证明检查会发现问题） |
| ACCT-04 | 08-01、08-05 | 每个账号只能读写自己的数据，在真实 PocketBase 上用合成账号验证 | SATISFIED | ACCT04-1..27、RT-1..7、D5-*、TOK-* 共 48 项真实实例断言；覆盖 `users`、`journey_docs`、系统集合、实时订阅、字段修饰符键 |
| TEST-04 | 08-04、08-05 | 一次性本机 PocketBase 上用合成账号验证隔离，下载需用户批准，不进默认 `npm test` | SATISFIED | 所有者批准记录在 08-04-SUMMARY.md 和 PB-LOCAL.md；哈希钉死并每次核对；`npm run pb:isolation` 独立入口；临时实例与数据用完删除 |
| TEST-02 | 08-02、08-03、08-06、08-07 | 基于模拟 PocketBase 的测试，覆盖登录、云端存取、离线、实时、导入导出、编辑计划；不连真实服务器 | **整条未满足，Phase 8 基础部分已满足**（按设计） | 基础：cloud 入口、同源 SDK 加哈希护栏、假服务器（REST 加实时）、cloud 护栏及自检、PROBE-9、协议样本、契约自测，均已验证。登录、离线、同步、导入导出、编辑计划的用例还不存在，因为应用尚无对应云端功能；Phase 9–12 补用例，Phase 13 收口。REQUIREMENTS.md 保持 Pending，正确。 |

**孤儿需求：** 无。REQUIREMENTS.md 映射到 Phase 8 的是 ACCT-03、ACCT-04、TEST-02、TEST-04，四个 ID 都被至少一份计划的 `requirements` 字段认领。

### 评审遗留项（WR-01）对 ACCT-04 的影响

评审指出 `journey_docs` 创建时 `kind+` 修饰符键可以让 A 在**自己的账号内**把 `kind` 从 plan 改成 state，规则语法无法表达禁止。本人判断：**不影响 ACCT-04**。理由：创建规则要求 `@request.body.owner = @request.auth.id`，且 ACCT04-27 在真实实例上用 8 种修饰符键请求体、每种 6 次并交替键序，由超级用户回读，没有出现 owner 不是 A 的记录；该项还带反向对照（对一个创建规则不核对 owner 的临时集合，NEG-1 必须报出泄漏）。`kind+` 只能影响创建者自己的那一份文档的类型，不能触碰 B 的数据。所有者已于 2026-11-08 接受（STATE.md 有记录）。Phase 9 的客户端写入只发合法的 kind，且创建时遇唯一索引冲突会重新读取再更新，因此这一偏差在正常使用中不会出现。

### 关键连线

| 起点 | 终点 | 方式 | 状态 |
|------|------|------|------|
| `pb/pb_migrations/*.js` | 真实实例的规则 | `isolation-check` 把迁移放进一次性实例并回读规则 | WIRED（REPLAY-1 一致） |
| `pb/rules.expected.json` | 迁移文件 | `migration-check` 在 `node:vm` 沙箱执行迁移并比对 | WIRED（MIGRATIONS MATCH） |
| `scenarios.cjs` / `normalize.cjs` | 录制脚本与契约自测 | 同一份模块被两边 `require` | WIRED |
| `static-server.cjs` | SDK 文件 | 启动前核对 sha256，不一致拒绝启动 | WIRED |
| `tests/support/test.ts` 护栏 | cloud 策略 | `classifyRequest`/`guardPolicy` 按 `USJ_TEST_MODE` 选档 | WIRED |
| 假 `EventSource` | `FakePbServer` | Node 经 `page.evaluate` 投递，订阅按账号过滤 | WIRED（cloud-harness 订阅用例） |

### 反模式扫描

在本阶段改动的实现文件里，没有 `TBD`、`FIXME`、`XXX` 标记。迁移文件的回滚函数故意为空并有注释说明（一次性实例由部署脚本整体重装），属设计，不是占位。`us-journey-tracker.html` 的 sha256 与 `constants.ts` 的 `APP_SHA256` 一致，说明本阶段没有改应用。隐私检查器 `--all`（312 个文件）通过，本报告不含任何 IP（127.0.0.1 除外）、域名、邮箱、口令或令牌。

| 文件 | 位置 | 模式 | 严重性 | 影响 |
|------|------|------|--------|------|
| `tests/README.md` / `playwright.cloud.config.ts` | README 第 20 行 | 文档说“低优先级”，配置没有强制（评审 IN-07） | 提示 | 与默认 `npm test` 对等；靠运行时以低优先级启动；不阻塞 |
| `.planning/phases/08-.../08-REVIEW-DISPOSITION.md` | 表格 | WR-01、WR-02、WR-03 仍标 `open`，而 08-REVIEW-FIX.md 记为 fixed、STATE.md 记录了 WR-01 的定论 | 提示 | 纯记录不同步，代码已经修复；建议收尾时把这三行手工标为 `fixed`（Source 填 08-REVIEW-FIX.md） |

### 行为抽查

| 行为 | 命令 | 结果 | 状态 |
|------|------|------|------|
| 真实实例上账号隔离 | `node tools/pb/isolation-check.mjs` | `ISOLATION OK 48/48`，0 条 FAIL，进程无残留 | PASS |
| 迁移与规则快照一致 | `node tools/pb/migration-check.mjs` | `MIGRATIONS MATCH` | PASS |
| 迁移篡改自检 | `... --self-test` | `OK 19` | PASS |
| 样本无令牌形状 | `node tools/pb/record-samples.mjs --check` | `SAMPLES CLEAN 2` | PASS |
| 隐私检查 | `privacy-check --self-test` / `--all` / `hook-drill` | 全部通过 | PASS |
| cloud 用例数量 | `playwright test --config=playwright.cloud.config.ts --list` | 44 条 / 4 个文件 | PASS（只列出） |
| Playwright 套件 | 未运行（按要求） | 编排器：175/175 与 44/44 | 采信编排器 |

### 探针执行

本阶段的探针是 PROBE-9a/9b/9c，已含在上述 44 条 cloud 用例里，结果由编排器提供，本人未重跑；`tests/PROBES.md` 与 `probes-cloud.spec.ts` 逐项对得上。

### 需要人工验证的项目

无。本阶段不涉及视觉或真实设备行为；“服务器在中国和美国可达”属 Phase 6 与 Phase 13 的范围。

### 缺口摘要

没有阻塞性缺口。目标的每一部分都有实际证据：迁移文件可重放且规则逐字一致；真实 PocketBase 0.41.1 上 48 项隔离断言全过，并带反向对照证明断言会发现泄漏；假服务器与 28 个真实样本逐场景一致；cloud 模式、护栏和故意违规自检存在并经过用例。

两条提示（均不阻塞）：（1）评审处置表仍显示 WR-01 至 WR-03 为 `open`，与修复报告不同步；（2）“低优先级”只是约定，没有写进 cloud 配置，与默认套件一致。TEST-02 整条仍需 Phase 9–13 完成，这是计划内的安排。

---

_验证时间：2026-11-08_
_验证者：Claude（gsd-verifier）_
