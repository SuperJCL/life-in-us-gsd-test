---
phase: 06-procurement-reachability-probe
plan: 01
subsystem: privacy-tooling
tags: [privacy, jwt-shape, secret-assign, ipv4, rule-a, rule-d, self-test]

requires:
  - phase: 07-id-plan-extraction-stable-ids-escaping
    provides: tools/privacy/privacy-check.mjs 的规则 A 到 E、种子闸门、pre-commit 和 pre-push 钩子（钩子只 exec 检查器，本计划不改钩子）
provides:
  - "规则 F（F-token-shape）：三段 base64url、前两段以 eyJ 开头的 JWT 形状，只输出位置和固定文案"
  - "规则 G（G-secret-assign）：密码类键名后面写着真实值（引号字面量、环境变量、ini/yaml 裸值、superuser 口令参数、PEM 私钥头），占位写法由导出的 isPlaceholder 放行"
  - "规则 H（H-public-ipv4）：公网 IPv4 形状，回环、私网、文档保留段、掩码和 N.0.0.0 放行"
  - "规则 A 扩展：pb_data、pb_backups、数据库扩展名、压缩包扩展名、pocketbase 程序文件禁止进入仓库"
  - "规则 D 不区分大小写（导出的 foldCase），loadPlanTerms(roots, { quiet }) 和 defaultRoots()，不依赖本机 private/ 的确定性自检（D-11）"
  - "PRIVACY_SELF_TEST_LIST=1 时 --self-test 逐项输出“通过：<名字>”"
affects: [06-04, 08-fake-pb-server-fixtures, 13-deployment]

actuals:
  tokens: 4060
  tasks: 3
  commits: 3
plan_head_before: c7b531ce379e8b5825e4c486e8e7409897d69532
plan_head_after: a0367a6f067f59037d22733542221814547eec91

tech-stack:
  added: []
  patterns:
    - "新规则 = RULES 表加一项 + 导出的纯函数 findX(line) 返回固定占位元素的数组 + scanText 只调用它，命中原文从不进入输出"
    - "自检样本全部运行时拼接（Buffer.from(...).toString('base64url')、数组 join、repeat、toUpperCase），源码里没有完整的命中字面量"
    - "规则 D 的确定性自检用 TEST-NET-3 地址、.example 域名和 os.tmpdir() 临时目录里的 private/denylist.txt"

key-files:
  created: []
  modified:
    - tools/privacy/privacy-check.mjs
    - .planning/phases/06-procurement-reachability-probe/06-RESEARCH.md

key-decisions:
  - "规则 G 的变量名不能写成含 secret 的名字再赋字符串：检查器源码里的词表常量一度被规则 G 自己命中，改名为 CRED_WORDS，不加豁免"
  - "实时词条自检只统计规则 D 的命中：词条本身（例如 denylist 里的服务器地址）可能同时命中规则 H，原先要求“恰好 1 条”会误判失败"
  - "占位判断里“属性访问”只对裸值放行（isPlaceholder 的 bare 选项），带引号的值不放行，避免把真实口令当代码表达式"

patterns-established:
  - "给 Phase 8 的提醒：以后夹具和假服务器里写假令牌、假口令要在运行时拼接，或写成 <…>、$变量、__大写占位__ 这类占位，不要写出完整字面量"
  - "文档里的示例地址只用 TEST-NET 保留段（192.0.2/24、198.51.100/24、203.0.113/24），不用任何非保留地址"

requirements-completed: [SEC-03]

coverage:
  - id: D1
    description: "规则 F：JWT 形状（头段、载荷段、签名段各不少于 10 位）被拦，没有签名段、两段式、省略写法和短段不拦；输出不含令牌"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "node tools/privacy/privacy-check.mjs --self-test（规则 F 正例 JSON 字段值、Bearer 头、查询串；反例四条；输出不含令牌）"
        status: pass
    human_judgment: false
  - id: D2
    description: "规则 G 和 isPlaceholder：真实形状的口令赋值被拦，占位写法放行；输出不含口令"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "node tools/privacy/privacy-check.mjs --self-test（规则 G 正例 9 条、反例 13 条、占位判断 2 条）"
        status: pass
    human_judgment: false
  - id: D3
    description: "规则 H：公网 IPv4 形状被拦，保留段、掩码、N.0.0.0 和五段版本号放行；输出不含地址"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "node tools/privacy/privacy-check.mjs --self-test（规则 H 正例 3 条、反例 10 条）"
        status: pass
    human_judgment: false
  - id: D4
    description: "规则 A 扩展：数据目录、数据库、压缩包、PocketBase 程序文件被拦，迁移、钩子、public 目录、legacy 备份夹具放行"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "node tools/privacy/privacy-check.mjs --self-test（规则 A 新增正例 11 条、反例 7 条）"
        status: pass
    human_judgment: false
  - id: D5
    description: "规则 D 不区分大小写，并有不依赖本机 private/ 的确定性自检（地址、域名、大写域名、提交说明、临时目录 denylist）"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "PRIVACY_SELF_TEST_LIST=1 node tools/privacy/privacy-check.mjs --self-test（通过：规则 D：大写域名变体命中 #2）"
        status: pass
    human_judgment: false
  - id: D6
    description: "新规则对全部被跟踪文件 0 命中，检查器自身通过自己的 --staged 和 --all，没有放行名单"
    requirement: SEC-03
    verification:
      - kind: integration
        ref: "node tools/privacy/privacy-check.mjs --all（223 个文件，规则 D 加载 68 个词条）；三次提交都经 pre-commit 钩子的 --staged"
        status: pass
    human_judgment: false
  - id: D7
    description: "钩子实跑演练（pre-commit 和 pre-push 真正失败）不在本计划范围，由 06-04 完成"
    requirement: SEC-03
    verification: []
    human_judgment: true
    rationale: "ROADMAP Phase 6 成功标准 1 的钩子证据由 06-04 在临时仓库里实跑取得；本计划只证明检查器规则本身"

duration: 7min
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 01: 隐私检查器新增令牌、口令、公网地址、数据文件规则 Summary

**隐私检查器新增规则 F（JWT 形状）、规则 G（密码类赋值加占位判断）、规则 H（公网 IPv4 形状），规则 A 扩展到 PocketBase 数据目录、数据库、压缩包和程序文件，规则 D 改为不区分大小写并补上不依赖本机 private/ 的确定性自检；自检从 100 项增加到 183 项，全部被跟踪文件仍然 0 命中。**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-08T05:43:10Z
- **Completed:** 2026-11-08T05:50:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- 规则 F 端到端打通（tracer）：规则表、导出的 `findTokenShapes`、`scanText` 调用、自检正反例和“输出不含令牌”断言。
- 规则 G 和规则 H：`isPlaceholder`、`findSecretAssign`、`findPublicIpv4` 三个导出纯函数；报告文案固定（“疑似写死的口令或密钥”“公网 IPv4 形状”），不带键名以外的任何内容、不带地址。
- 规则 A 扩展、规则 D 不区分大小写（`foldCase`）、`loadPlanTerms(roots, { quiet })`，以及规则 D 的确定性自检：TEST-NET-3 地址、`.example` 域名、大写域名变体、提交说明、临时目录里的 denylist。
- 自检项数：Task 1 之后 110 项，Task 2 之后 159 项，Task 3 之后 183 项（基线 100 项）。
- `--all`：223 个文件通过（计划写的是 222，计划之后又多了一个被跟踪文件），规则 D 加载 68 个词条，没有加任何放行名单或豁免路径。
- 06-RESEARCH.md 第 767 行（规则 D 自检表里“不相关地址”那一格）的非保留地址改写成 TEST-NET-2 的 `198.51.100.7`，这是 `--all` 唯一的一处规则 H 命中。除此之外没有改别的文档。

## Task Commits

1. **Task 1：规则 F（tracer）** - `3ed495e`（feat）
2. **Task 2：规则 G、规则 H，改写研究文档一处反例** - `0fa5cea`（feat）
3. **Task 3：规则 A 扩展、规则 D 不区分大小写、loadPlanTerms(roots)、确定性自检** - `a0367a6`（feat）

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

Tracer 门槛：Task 1 的 `<verify>` 在每个模式下都是纯自动化，已重跑并通过，随后展开 Task 2、3。

## Files Created/Modified

- `tools/privacy/privacy-check.mjs` - 规则 F、G、H，规则 A 扩展，规则 D 折叠大小写，`defaultRoots`、`loadPlanTerms(roots, { quiet })`，`PRIVACY_SELF_TEST_LIST`，以及对应自检
- `.planning/phases/06-procurement-reachability-probe/06-RESEARCH.md` - 第 767 行一格的示例地址改成 TEST-NET-2（只改这一处）

## Decisions Made

- 规则 G 命中检查器自己的词表常量（变量名含 secret、值是一串字符串），改名为 `CRED_WORDS` 解决，不加豁免。
- 实时词条自检改为只看规则 D 的命中，因为词条本身可能同时命中别的规则。
- `isPlaceholder` 的属性访问放行只对裸值生效。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 规则 G 命中检查器自己的源码**
- **Found during:** Task 2
- **Issue:** `--all` 在 `privacy-check.mjs` 里报规则 G：词表常量的名字含 secret，值是用竖线连起来的一串字符串，形状正好是“密码类键名加引号字面量”
- **Fix:** 把常量改名为 `CRED_WORDS`，不改规则、不加放行
- **Files modified:** tools/privacy/privacy-check.mjs
- **Verification:** `--all` 退出码 0；自检通过
- **Committed in:** `0fa5cea`

**2. [Rule 1 - Bug] 实时词条自检在新规则下误判失败**
- **Found during:** Task 2
- **Issue:** `--self-test` 报“实时词条自检：共 68 个，失败 1 个”。自检要求每个词条所在的行恰好 1 条命中，但本机词条之一同时命中规则 H，变成 2 条（只判断了数量，没有打印词条）
- **Fix:** 该自检只统计规则 D 的命中（`filter((x) => x.rule === RULES.D)`），其余逻辑不变
- **Files modified:** tools/privacy/privacy-check.mjs
- **Verification:** `--self-test` 通过，实时词条自检仍然 68 个全过
- **Committed in:** `0fa5cea`

---

**Total deviations:** 2 auto-fixed（2 个 Rule 1）
**Impact on plan:** 两处都是新规则引入的自身冲突，改动都限于检查器自身，不放宽规则，不影响隐私保证。

## Issues Encountered

- Task 3 第一次应用补丁时，用一个多行字符串去匹配 `loadPlanTerms` 里的 stderr 输出段失败（补丁脚本在写盘前就报错，没有改动文件）；改成匹配 `if (seedPath || denyPath) {` 这一行再改写，第二次应用成功。
- 阶段内改写过的文档位置：06-RESEARCH.md 第 767 行（仅此一处）。

## Known Stubs

无。

## Threat Flags

无新增的网络端点、认证路径或信任边界；本计划只改一个零依赖的本地 node 脚本和一处文档文字。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 钩子的实跑演练（pre-commit 和 pre-push 真正失败）由 06-04 完成；钩子文件没有改，新规则随检查器自动生效。
- Phase 8 的提醒：假服务器和夹具里不能写完整的 JWT 形状字符串或明文口令，要像本计划的自检一样在运行时拼接，或写成 `<…>`、`$变量`、`__大写占位__`。
- 已知局限（06-04 写进 PRIVACY.md）：形状规则拦不住拆开写、编码过、带前导零或十六进制写法的地址和域名；IPv6 地址要所有者手动加进 denylist；规则 G 的键名词表之外的密钥名不会被识别。

## Self-Check: PASSED

- 修改的文件都存在：tools/privacy/privacy-check.mjs、06-RESEARCH.md
- 三个提交都在当前分支上：`3ed495e`、`0fa5cea`、`a0367a6`
- 重新跑了每个任务的 acceptance_criteria 和 `<verify>`：`--self-test` 183 项通过，默认输出 1 行，列表模式有且只有 1 行“通过：规则 D：大写域名变体命中 #2”；`--all` 223 个文件 0 命中，规则 D 加载 68 个词条；源码里没有完整 JWT 形状字面量；06-RESEARCH.md 没有 203.0.114.x，有 198.51.100.7。

---
*Phase: 06-procurement-reachability-probe*
*Completed: 2026-11-08*
