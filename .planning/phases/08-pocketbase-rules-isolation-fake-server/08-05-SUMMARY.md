---
phase: 08-pocketbase-rules-isolation-fake-server
plan: 05
subsystem: testing
tags: [pocketbase, isolation, realtime, sse, negative-control, replay, acct-03, acct-04, test-04]

requires:
  - phase: 08-pocketbase-rules-isolation-fake-server
    provides: 08-01 的迁移与 pb/rules.expected.json、rules-snapshot.mjs；08-04 的已批准并钉死哈希的 pocketbase.exe 与 withInstance
provides:
  - "tools/pb/isolation-check.mjs：47 个编号的账号隔离断言矩阵，`npm run pb:isolation`，最后一行 ISOLATION OK 47/47；--self-test、--observe"
  - "tools/pb/lib/sse-client.mjs：零依赖的 openSse、subscribe"
  - "反向对照 NEG-1（6 个检查函数在故意写错的集合上必须报出泄漏）和 REPLAY-1（第二个全新实例的规则快照逐字一致）"
  - "实测状态码和错误码（见下表），供 08-06 的 PB-CONTRACT.md 抄录"
affects: [08-06, 08-07, phase-09, phase-13]

plan_head_before: ef6388708d361e6290f7749cc91f551ec7879984
plan_head_after: 7920319d8fd4c71b43fefc049c6e91e2bbc731fb

estimate:
  tokens: 85000
  raw_tokens: 85000
  tasks: 3
  confidence: low
actuals:
  tokens: 14300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "check(id, name, fn, { write, readback, expect })：写类断言登记时必须带回读函数，每条同时断言状态码（和错误码）与超级用户回读"
    - "共享检查实现 + 目标描述：真实集合和泄漏集合跑同一份函数，NEG-1 靠它证明检查不是空转"
    - "实时断言 = 正向对照事件到达 + 静默 1.5 秒 + 没有目标记录的 id"

key-files:
  created:
    - tools/pb/isolation-check.mjs
    - tools/pb/lib/sse-client.mjs
  modified:
    - package.json
    - tests/README.md

key-decisions:
  - "没有发现规则漏洞：字段修饰符键（owner+、+owner、owner-、kind+）和 owner、kind 普通键一样被 :isset = false 拦下（404），迁移、pb/rules.expected.json、migration-check.mjs 一项都没改"
  - "ACCT04-7 和 ACCT04-19、-20 的“创建被拒”用超级用户临时清空槽位后再测，避免被 (owner, kind) 唯一索引的 400 掩盖，测完恢复"
  - "ACCT04-20 的无效令牌改动签名段末字符时让改动落在有效位上（末位 base64url 有填充位，只改低两位会解出同样的字节），并用 auth-refresh 401 自证令牌确实无效"
  - "NEG-1 里的 RT 检查要求确实看到了不该看的事件（leaked），不能只因为对照事件没到就算报出泄漏"

patterns-established:
  - "输出只含编号、规则名、状态码、错误码；--observe 多打一行 OBS，也只含数字状态码和错误码"

requirements-completed: [ACCT-03, ACCT-04, TEST-04]

coverage:
  - id: D1
    description: "ACCT-03：匿名注册、已登录注册、自删、删 B 的账号都被拒（403），每条超级用户回读确认没变；ACCT03-5 在开放集合上匿名注册成功（200）证明探测不是空转"
    requirement: "ACCT-03"
    verification:
      - kind: integration
        ref: "npm run pb:isolation 连续两遍 ISOLATION OK 47/47（ACCT03-1 到 ACCT03-5、ACCT04-25）"
        status: pass
    human_judgment: false
  - id: D2
    description: "ACCT-04：A 读不到、列不出、改不了、删不掉 B 的文档；owner、kind 防改写（含字段修饰符）；4 MiB 上限；唯一；未登录和无效令牌；users 记录隔离；实时隔离（journey_docs 和 users 两个集合）"
    requirement: "ACCT-04"
    verification:
      - kind: integration
        ref: "npm run pb:isolation 连续两遍 ISOLATION OK 47/47（ACCT04-1 到 ACCT04-26、RT-1 到 RT-7、TOK-1、TOK-2、D5-1 到 D5-5）"
        status: pass
    human_judgment: false
  - id: D3
    description: "TEST-04：手动入口、前提核对（哈希）、一次性实例、不进默认测试；反向对照 NEG-1 和重放 REPLAY-1"
    requirement: "TEST-04"
    verification:
      - kind: integration
        ref: "NEG-1（6 个检查全部报出泄漏）、REPLAY-1（diff12、diff1e、diff2e 均为 0）；isolation-check.mjs --self-test（ISOLATION SELF-TEST OK）；playwright 配置和 tests/e2e、tests/cloud 里没有引用隔离脚本"
        status: pass
    human_judgment: false

duration: 约 50min
completed: 2026-11-09
status: complete
---

# Phase 8 Plan 05: 账号隔离断言脚本 Summary

**在一次性本机 PocketBase 0.41.1 上用两个合成账号逐条断言 47 个编号，连续两遍 `ISOLATION OK 47/47`：注册关闭、跨账号读写和实时事件都挡得住，反向对照证明检查不是空转，迁移在第二个全新实例上重放得到同样的规则。**

## Performance

- **Duration:** 约 50 分钟
- **Tasks:** 3（Task 1 tracer，Task 2、3 auto）
- **Files:** 新建 2 个（`tools/pb/isolation-check.mjs`、`tools/pb/lib/sse-client.mjs`），修改 2 个（`package.json`、`tests/README.md`）
- **Commits:** 3（measured：`git rev-list --count ef63887..HEAD`，在写本 SUMMARY 之前）
- **两遍完整运行的耗时：** 第一遍 17 秒、第二遍 19 秒（含实例启动、静默窗口和 REPLAY-1 的第二个实例）；脚本第一次实测运行（--observe）约 16 秒。运行结束后 `tasklist` 没有残留的 pocketbase.exe。

## 完成的任务

| Task | 内容 | Commit |
|------|------|--------|
| 1（tracer） | 一次性实例 → A、B 和文档 → ACCT03-1 到 -5 → `ISOLATION OK 5/5`；self-test、`pb:isolation`、README | c9a17b0 |
| 2 | ACCT04-1 到 -26、TOK-1、TOK-2、D5-1 到 -5、NEG-1（REST 部分）→ `ISOLATION OK 39/39`；实测定稿的值写死 | 9eefe96 |
| 3 | sse-client、RT-1 到 RT-7、NEG-1 加入 RT-1 和 RT-7 的泄漏对照、REPLAY-1 → 两遍 `ISOLATION OK 47/47` | 7920319 |

## 47 个编号的结果

两遍运行全部 PASS：ACCT03-1 到 -5、ACCT04-1 到 -26、TOK-1、TOK-2、D5-1 到 D5-5、RT-1 到 RT-7、NEG-1、REPLAY-1。

### RT-7（users 集合的实时订阅）

- 订阅者 A 以 A 的令牌订阅 `users/*` 和 B 账号记录的单条主题；超级用户先改 B、再改 A 的 `emailVisibility`（结束时恢复）。
- **对照事件按时到达：是**（ctrl:1，A 收到自己账号记录的事件）。
- **静默窗口内收到的事件数：0**（对照到达之后再静默 1.5 秒；A 的连接共 1 个业务事件，就是对照事件），没有出现 B 的 id。
- 同一个检查函数在 users_leaky（订阅者 X、目标 Y）上报出了泄漏。

### 反向对照

- **NEG-1：** ACCT04-1、ACCT04-3、ACCT04-4、ACCT04-5（journey_docs_leaky）、RT-1（journey_docs_leaky）、RT-7（users_leaky）6 个检查函数全部报出泄漏。RT 两个要求 `leaked` 为真（确实看到了不该看的事件），不是“对照没到所以失败”。
- **ACCT03-5：** 开放集合上匿名注册成功。
- **REPLAY-1：** `diff12:0`（两个实例的快照逐字一致）、`diff1e:0`、`diff2e:0`（都与 `pb/rules.expected.json` 一致）。第一个实例的快照取在全部断言之后，同时证明这些断言没有改动规则。

## 实测定稿的状态码和错误码（给 08-06 的 PB-CONTRACT.md）

以下全部已经写死进断言，不是“观察到什么断言什么”；安全属性（被拒且回读不变）同时成立。

| 编号 | 行为 | 实测 |
|------|------|------|
| ACCT03-1、-2 | 匿名或已登录账号 POST users 记录 | 403，无字段错误码 |
| ACCT03-3、-4 | A 删除自己或 B 的账号 | 403 |
| **ACCT03-5** | **createRule 为空的认证集合上匿名注册（创建成功的状态码）** | **200**（不是 201；08-06 的 create-own 要核对） |
| ACCT04-1、-2 | 列表 | 200；条数按规则过滤，被隐藏的记录超级用户读得到 |
| ACCT04-3 | A 查看 B 的文档 | 404 |
| ACCT04-4 | A 更新 B 的文档 | 404 |
| ACCT04-5、-6 | 删除 B 的、自己的文档 | 403 |
| ACCT04-7 | A 以 owner=B 创建（槽位空着） | 400，data 为空（没有 `validation_not_unique`，确系规则在挡） |
| ACCT04-8 | A 以 owner=A 创建已存在的 kind | 400，owner 和 kind 的错误码都是 `validation_not_unique` |
| ACCT04-9 | kind 不在选项里 | 400，kind 的错误码 `validation_invalid_value` |
| ACCT04-10、-11、-12 | 更新时带 owner=B、另一种 kind、与原值相同的 owner | 全部 404（相同值也拒）；客户端更新时只能发 `data` 和 `writer` |
| **ACCT04-13** | **修饰符键 `owner+`、`+owner`、`owner-`、`kind+`** | **全部 404，回读 owner、kind 不变（规则里的 `:isset = false` 对修饰符键同样成立）** |
| ACCT04-14 | 合法 data 和 writer 更新 | 200，`updated` 变了 |
| ACCT04-15 | writer 41 个字符 | 400，writer 的错误码 `validation_max_text_constraint` |
| ACCT04-16 | 3.9 MiB（4089446 字节）的 data | 200 |
| ACCT04-17 | 4194304 + 1024 字节的 data | 400，data 的错误码 `validation_json_size_limit` |
| ACCT04-18 | 未登录列表 | 200 空列表 |
| ACCT04-19 | 未登录查看、更新、删除、创建 | 404、404、403、400（空槽位上创建也是 400） |
| ACCT04-20 | 无效令牌的列表、查看、更新、删除、创建 | 200 空、404、404、403、400，都不是 401；同一令牌 auth-refresh 是 401 |
| ACCT04-21、-22、-23 | users：列、看 B、改 B | 200 只有自己 1 条、404、404 |
| ACCT04-24 | 登录和刷新 | 200、200（返回体有 token 和含本人邮箱的 record） |
| ACCT04-25 | A 读 `_superusers` 记录、`/api/collections`、`/api/settings`、`/api/logs`、`/api/backups` | 五个都是 403；用 A 的凭据登录 `_superusers` 是 400 |
| ACCT04-26 | A 列 `_authOrigins`、`_externalAuths` | 200，没有 B 的记录（超级用户先给 B 造了一条第三方登录记录，确认不是空转；provider 要用合法值，`iso` 这类自造值会被 400 拒绝） |
| TOK-1 | 令牌有效期 | 集合 `authToken.duration` 为 7776000；登录令牌 `exp - 当前秒` 在 90 天 ±1 天内 |
| D5-1 | A 带正确 oldPassword 改密码 | 200；旧令牌 auth-refresh 401；新口令登录 200；旧口令登录 400 |
| D5-2 | 缺 oldPassword | 400，`validation_required` |
| D5-3 | oldPassword 不对 | 400，`validation_invalid_old_password` |
| D5-4 | 改 verified 或 emailVisibility | 404、404，回读不变 |
| D5-5 | 改 email | 400，`validation_values_mismatch`，回读不变 |
| TOK-2 | 超级用户重置 B 的密码 | 200；B 的旧令牌 auth-refresh 401；新口令登录 200 |
| RT-1 | 订阅 `journey_docs/*` | 订阅提交 204；对照事件到达，静默 1.5 秒内没有 B 的 id |
| RT-2 | 单条主题 | 204；B 的变更收不到，A 自己的收得到 |
| RT-3 | 未登录连接 | 204；收到 0 个事件，A 的连接收到对照事件 |
| RT-4 | `fields=id,kind,writer,updated` | 204；事件 record 的键恰好是这 4 个 |
| RT-5 | 同一 clientId 换 B 的令牌再提交 | 403（第一次提交 204） |
| RT-6 | 不存在的 clientId | 404 |

## 规则漏洞

没有发现。ACCT04-13（字段修饰符）是研究里标 [ASSUMED] 的最大风险点（A3），实测全部 404，回读不变，所以没有改 journey_docs 迁移、`pb/rules.expected.json`、`migration-check.mjs`，`node tools/pb/migration-check.mjs` 仍输出 `MIGRATIONS MATCH`，`--self-test` 仍全过。

## 限流默认值的观察

新实例的限流默认是关闭的（08-04 已记录 `INFO rate-limits-default off`）。本脚本开头仍调用 `ensureRateLimitsOff()`（本次没有改动设置）；两遍运行中密集登录没有被限流。

## Deviations from Plan

### 小的实现选择（不算偏离）

- ACCT04-7、ACCT04-19、ACCT04-20 的“创建被拒”：PocketBase 的唯一索引也会给 400，而 `journey_docs` 里 A、B 两种 kind 的槽位都已占用，只断言 400 会被唯一索引掩盖。这三条在超级用户临时清空对应槽位后再测，测完用超级用户恢复。ACCT04-7 还额外要求错误里没有 `validation_not_unique`。这是在计划的断言上加严，不是放宽。
- ACCT04-20 的篡改令牌：计划写“把签名段最后一个字符换掉”。base64url 的最后一个字符有填充位，只改低两位解出的字节相同，令牌可能仍然有效，所以改成让改动落在有效位上（字符表位置加 4），并用 auth-refresh 401 自证令牌确实无效。
- `--observe` 参数：多输出一行只含数字状态码和错误码的 OBS，用来记录“实测定稿”的值；默认输出仍然只有 PASS/FAIL 和规则名。
- self-test 里加了一条对本机假 SSE 服务器的解析测试（不需要 PocketBase）。

**Total deviations:** 0 条规则漏洞或计划偏差；以上均为加严或辅助。

## Auth gates

None。

## Known Stubs

None。

## Threat Flags

None。本计划没有新增网络面：仍然只是 08-04 已批准的、只监听 127.0.0.1 随机端口的一次性实例。

## 给后续计划

- 08-06 的 PB-CONTRACT.md 抄录上面的实测表，特别是：创建成功是 **200**（ACCT03-5 的反向对照实测，create-own 要核对）、规则不满足时列表 200 空、查看和更新 404、创建 400、锁定规则 403、`:isset = false` 连相同值和修饰符键也拒（404）、401 只出现在 `auth-refresh`。
- 实时：订阅在 `POST /api/realtime` 提交时按带的令牌定身份；`fields` 选项让事件 record 的键只剩指定的字段；换身份 403、未知 clientId 404；`users/*` 和 `users/<别人的 id>` 收不到别人的账号事件。
- Phase 13 对线上实例原样复用本脚本时，4 MiB 请求经 nginx 可能先撞到请求体上限（研究 A12）。
- TEST-02 保持 Pending（假服务器的契约自测在 08-06、08-07）。

## Self-Check: PASSED

- FOUND: tools/pb/isolation-check.mjs、tools/pb/lib/sse-client.mjs、package.json 的 pb:isolation、tests/README.md 的运行说明
- FOUND commits: c9a17b0、9eefe96、7920319 都是 HEAD 的祖先
- 两遍 `npm run --silent pb:isolation` 都是 `ISOLATION OK 47/47`；`tasklist` 没有 pocketbase.exe；暂存后隐私检查三次通过
