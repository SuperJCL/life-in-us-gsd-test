---
phase: 08-pocketbase-rules-isolation-fake-server
plan: 01
subsystem: database
tags: [pocketbase, migrations, access-rules, node-vm, rules-snapshot]

requires:
  - phase: 06-connectivity-probe
    provides: 已在 0.41.1 上跑通的迁移写法（probe_schema.js）和 schema-check.mjs 的沙箱检查模式
provides:
  - pb/pb_migrations/ 下的两个只含结构的迁移：users 加固、journey_docs 集合
  - pb/rules.expected.json 规则快照，供 08-04、08-05 对真实实例做重放对比
  - tools/pb/lib/rules-snapshot.mjs 的 snapshotFromSaved、snapshotFromLive、diffSnapshots、stable
  - tools/pb/migration-check.mjs：静态检查、不变量、--migrations、--expected、--self-test
  - 修正后的 ROADMAP 和三份研究文档（SDK 0.28.1、iife 文件名、pb/ 目录、401 只来自 auth-refresh）
affects: [08-02, 08-03, 08-04, 08-05, phase-09, phase-13]

plan_head_before: 23473ec38d42b7d5f3704831f111db0da64fc9f7
plan_head_after: 68c7e7652288dcfc2fcf190f5125cd46b3670afa

estimate:
  tokens: 55000
  tasks: 3
actuals:
  tokens: 10700
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "迁移只有结构，在 node:vm 沙箱里执行并归一成规则快照，与仓库里的快照文件比较"
    - "沙箱与真实实例共用同一个快照归一化函数（重放对比）"

key-files:
  created:
    - pb/pb_migrations/1794096000_users_lockdown.js
    - pb/pb_migrations/1794096100_journey_docs.js
    - pb/rules.expected.json
    - tools/pb/lib/rules-snapshot.mjs
    - tools/pb/migration-check.mjs
  modified:
    - .gitattributes
    - .planning/ROADMAP.md
    - .planning/research/STACK.md
    - .planning/research/SUMMARY.md
    - .planning/research/ARCHITECTURE.md

key-decisions:
  - "迁移目录用 pb/pb_migrations/，因为 .gitignore 第 52 行忽略根目录的同名 PocketBase 目录"
  - "沙箱不提供 app.settings，也不提供记录接口：迁移碰应用设置会报 migration-error，保存非集合对象会报 data-in-migration"
  - "快照里 users 只比 created、updated 两个非系统字段，name、avatar 被迁移删掉"

patterns-established:
  - "检查器输出只含集合名、键名和差异种类，不打印文件内容和路径"

requirements-completed: [ACCT-03, ACCT-04]

coverage:
  - id: D1
    description: "users 迁移：注册和自删除关闭、manageRule 为 null、只开邮箱加密码登录、OAuth2/OTP/MFA/authAlert 关闭、90 天令牌、本人只能改密码"
    requirement: "ACCT-03"
    verification:
      - kind: unit
        ref: "node tools/pb/migration-check.mjs（MIGRATIONS MATCH）和 --self-test（19 条全过）"
        status: pass
    human_judgment: false
  - id: D2
    description: "journey_docs 迁移：只能读写自己的记录、不能删除、owner 和 kind 创建后不可改、4 MiB 上限、(owner, kind) 唯一索引"
    requirement: "ACCT-04"
    verification:
      - kind: unit
        ref: "node tools/pb/migration-check.mjs（MIGRATIONS MATCH）和 --self-test（19 条全过）"
        status: pass
    human_judgment: false
  - id: D3
    description: "规划文档里过时内容已更正（ROADMAP、STACK、SUMMARY、ARCHITECTURE）"
    verification:
      - kind: other
        ref: "08-01-PLAN.md Task 3 的 automated 命令（grep 断言加隐私检查）"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-08
status: complete
---

# Phase 8 Plan 01: 迁移、规则快照与静态检查 Summary

**users 加固和 journey_docs 两个只含结构的 PocketBase 迁移，配 node:vm 沙箱规则快照检查（MIGRATIONS MATCH，19 条自检全过），并更正了规划文档里的 SDK 版本、文件名和目录名。**

## Performance

- **Duration:** 约 25 分钟
- **Tasks:** 3（1 个 tracer、2 个 auto）
- **Files:** 新建 5 个，修改 5 个
- **Commits:** 3（measured：`git rev-list --count 23473ec..HEAD`）

## Accomplishments

- tracer 一次打通：两个迁移 → 沙箱 → 快照归一化 → 与 pb/rules.expected.json 比较，输出 `MIGRATIONS MATCH`。
- 检查器同时比对快照和不依赖快照的不变量；`--self-test` 对真实迁移源码做 18 种篡改加 1 条正向对照，全部通过。
- `--migrations` 反向对照成立：把开放注册写进临时副本，检查器退出 1 并报出 `MIGRATIONS MISMATCH users.createRule rule`。
- `.gitattributes` 追加 `pb/** text eol=lf`（Phase 13 在 Linux 上使用）。
- ROADMAP、STACK、SUMMARY、ARCHITECTURE 的过时写法已改。

## 两个迁移的最终规则字符串

users（1794096000_users_lockdown.js）：

- createRule：null；deleteRule：null；manageRule：null
- listRule、viewRule：`id = @request.auth.id`
- updateRule：`id = @request.auth.id && @request.body.verified:isset = false && @request.body.emailVisibility:isset = false`
- passwordAuth：enabled 为 true，identityFields 为 ["email"]；oauth2、otp、mfa、authAlert 的 enabled 都是 false
- authToken.duration：7776000（90 天）；删掉 name、avatar 两个字段

journey_docs（1794096100_journey_docs.js）：

- listRule、viewRule：`@request.auth.id != "" && owner = @request.auth.id`
- createRule：`@request.auth.id != "" && @request.body.owner = @request.auth.id`
- updateRule：`@request.auth.id != "" && owner = @request.auth.id && @request.body.owner:isset = false && @request.body.kind:isset = false`
- deleteRule：null
- 字段：owner（relation 到 users、必填、maxSelect 1、cascadeDelete）、kind（select：state、plan，必填）、data（json，maxSize 4194304，不必填）、writer（text，max 40）、created、updated（autodate）
- 索引：`CREATE UNIQUE INDEX idx_journey_docs_owner_kind ON journey_docs (owner, kind)`

## users 默认模型的推断依据（供 08-04 对真实实例核对）

沙箱里的 users 默认模型按 PocketBase v0.40.6 源码推断（migrations/1640988000_init.go、core/collection_model_auth_options.go），没有在 0.41.1 上实测：

- createRule 为空字符串；listRule、viewRule、updateRule、deleteRule 都是 `id = @request.auth.id`；manageRule 为 null；authRule 为空字符串
- authToken.duration 432000；passwordAuth 开、identityFields ["email"]；oauth2、otp、mfa 关；authAlert 开
- 系统字段：id、password、tokenKey、email、emailVisibility、verified；非系统字段：name（text，max 255）、avatar（file）、created、updated（autodate）

08-04 的冒烟要确认两点：`users.fields.removeByName`、`users.authToken.duration` 等 JSVM 写法在 0.41.1 上能保存（研究假设 A1）；超级用户读到的 users 快照里非系统字段正好是 created、updated，且 `snapshotFromLive` 与 `rules.expected.json` 无差异。

## 自检

`node tools/pb/migration-check.mjs --self-test` 输出 `MIGRATION SELF-TEST OK 19`：1 条正向对照加 18 种篡改（开放注册、删 deleteRule、放开 manageRule、令牌 5 天、开 OAuth2/OTP/MFA/authAlert、updateRule 去掉 verified、不再删 name、不再删 avatar、journey_docs listRule 去掉 owner、updateRule 去掉 kind 的 isset、deleteRule 放开、maxSize 改小、去掉唯一索引、保存记录、改应用设置）。每条都要求结果含有对应的集合键或 `data-in-migration`、`migration-error`。

## 文档修正了哪些行

- ROADMAP.md：第 36 行（共同约束，SDK 0.28.1 加 sha256 出处）；Phase 8 的 SC1（二进制留存在 tools/pb/bin/）、SC2（程序留存、实例和数据用完删除）、SC3（配 SDK 0.28.1；401 只来自 auth-refresh）；Notes 的所有者批准点一条。
- STACK.md：Core Technologies 的 SDK 行（0.28.1，06 D-15）、Installation 的下载注释、Version Compatibility 行；“数据模型（建议）”标题下加“已过时（Phase 8）”引用块。
- SUMMARY.md：分歧表“SDK 版本与文件”和“SDK 与服务器配套”两行（原两侧写法标注“修正前”）；Recommended Stack 的两处 SDK 版本。
- ARCHITECTURE.md：6 处 umd 文件名改为 pocketbase.iife.js；迁移目录改为 pb/pb_migrations/（含目录树、本机开发和阶段表三处）；令牌有效期一行；离线 401 一行补注；FakePbServer 的拦截方式改为 context.route 加页面侧假 EventSource；多设备改为两个 browser context；资料来源里补 06 D-15。

## Deviations from Plan

None - 计划按原样执行。小的实现选择（不算偏离）：沙箱额外提供一个空的 `Record` 构造函数，使“保存记录”稳定地报 `data-in-migration`，而不是 ReferenceError；自检在替换前把源码统一成 LF，以防 Windows 检出 CRLF 时目标文本对不上。

## Known Stubs

None。

## Threat Flags

None。迁移里没有记录、账号、邮箱、口令或令牌，也没有 app.settings；暂存后的隐私检查三次都通过。

## Self-Check: PASSED

- FOUND: pb/pb_migrations/1794096000_users_lockdown.js、pb/pb_migrations/1794096100_journey_docs.js、pb/rules.expected.json、tools/pb/lib/rules-snapshot.mjs、tools/pb/migration-check.mjs
- FOUND commits: 48e82ea、b65e497、68c7e76
