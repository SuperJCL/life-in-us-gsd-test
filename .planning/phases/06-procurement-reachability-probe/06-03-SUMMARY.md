---
phase: 06-procurement-reachability-probe
plan: 03
subsystem: tooling
tags: [probe, summarize, schema-contract, node, zero-dependency, d-06, d-07, d-10, d-18]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-CONTEXT.md 的 D-06、D-07、D-10、D-18；06-RESEARCH.md 的 Pattern 4 字段表和 Pattern 5 判定表
provides:
  - "tools/probe/schema.json：probe_results（28 个字段）、probe_pings（3 个字段）和五条规则的唯一定义"
  - "tools/probe/summarize.mjs：探针结果 JSON 到表 1、表 2、附注；--json、--block、--example、--example-data、--self-test（77 条）"
  - "tools/probe/schema-check.mjs：--migration、--page、--export 与 schema.json 逐项比对；--self-test（26 条）"
affects: [06-05, 06-06, 06-07, 06-10]

actuals:
  tokens: 11801
  tasks: 3
  commits: 3
plan_head_before: 3202a17d658963400281a90985daf6067deff5a3
plan_head_after: ecab89a7b4bb16b96ce8762eb6fde21349e62278

tech-stack:
  added: []
  patterns:
    - "零依赖 Node 脚本：只 import node: 内置模块，import.meta.url 判断入口，--self-test 用合成数据"
    - "字段契约只定义一次（schema.json），写入方、迁移、导出方由 schema-check.mjs 比对，汇总方按契约解析"
    - "汇总输出确定（不含当前时间，排序固定），--block 用开始/结束标记包住，可重跑并 diff"

key-files:
  created:
    - tools/probe/schema.json
    - tools/probe/summarize.mjs
    - tools/probe/schema-check.mjs
  modified: []

key-decisions:
  - "tz_offset_min 的含义定为“本地减 UTC 的分钟数”（北京为 480），与 06-05 的 -new Date().getTimezoneOffset() 一致；started_at 只接受带时区的 ISO 字符串，避免结果随运行机器的时区变化"
  - "空闲断开标注的基线取“上一条送达的打点”（push_ms 里对应位置不是数字的打点算丢失，没有就从连接时刻 0 算起），窗口 295–320 秒；只标注，不改变达标判定"
  - "有效性：缺 dur_s 按“短”、缺 hidden_ms 按“后台”处理；缺失的数字一律是 null，不当成 0"
  - "分级用整数运算（pass*3 >= total*2、pass*2 > total），没有浮点边界误差；表 1 判定列取首屏、登录、实时三项里最差的一级"

patterns-established:
  - "后面的计划不再从 RESEARCH 抄字段表：读 schema.json，或在 verify 里调用 schema-check.mjs"

requirements-completed: [INFRA-02]

coverage:
  - id: D1
    description: "schema.json 是 probe_results（28 个字段）和 probe_pings（3 个字段）的唯一定义，两个集合的 created 都是 autodate，只有 run_id、carrier、net、run 必填"
    requirement: INFRA-02
    verification:
      - kind: command
        ref: "任务 1 的 <verify><automated>（node 内联检查字段数、created、required 集合）"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-06、D-07、D-10、D-18 的判定（首屏 5000/5001、登录 3000/3001、重连 10000/10001、有效运行、2/3 与 1/2 分级、时段与夜）写成代码，边界两侧都有自检"
    requirement: INFRA-02
    verification:
      - kind: unit
        ref: "node tools/probe/summarize.mjs --self-test（SELF-TEST OK (77 cases)）"
        status: pass
    human_judgment: false
  - id: D3
    description: "表 1、表 2、附注输出确定；--block 输出两次逐字节相同，去掉首末标记行后与默认输出相同；--json 可解析"
    requirement: INFRA-02
    verification:
      - kind: command
        ref: "任务 2 的 <verify><automated>"
        status: pass
    human_judgment: false
  - id: D4
    description: "schema-check.mjs 能发现迁移、探针页、导出脚本与 schema.json 在缺字段、多字段、类型、必填、顺序、规则、属性上的任何差异"
    requirement: INFRA-02
    verification:
      - kind: unit
        ref: "node tools/probe/schema-check.mjs --self-test（SELF-TEST OK (26 cases)）"
        status: pass
    human_judgment: false
  - id: D5
    description: "schema.json 的字段写法（select、json、autodate 等）是否被真实 PocketBase 0.41.1 接受，要到 06-09 启动和 verify-site 才能证明；汇总规则是否符合所有者对“达标”的直觉要等 06-10 看真实数据"
    requirement: INFRA-02
    verification: []
    human_judgment: true
    rationale: "契约与迁移的一致由 schema-check 保证，但契约本身能否在真实服务器上生效、判定是否合理，本计划没有服务器可以验证"

duration: 8min
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 03: 探针结果汇总器与字段契约 Summary

**零依赖的 summarize.mjs 把导出的探针结果 JSON 按 D-06/D-07/D-10/D-18 汇总成表 1、表 2 和附注（确定输出、可 --block 重跑复核），schema.json 把 probe_results 和 probe_pings 的字段收成唯一定义，schema-check.mjs 让迁移、探针页和导出脚本逐项对齐它。**

## Performance

- **Duration:** 8 min
- **Started:** 2026-11-08T05:56:39Z
- **Completed:** 2026-11-08T06:05:00Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Task 1（tracer）：schema.json → 按契约解析（json 字段接受数组或 JSON 字符串，缺失为 null）→ 逐次判定 → 按运营商 × 网络分组 → 表 1，一次打通；自检 29 条。
- Task 2：补齐表 2、时段与夜、按运营商合计与分级、空闲断开标注、附注、`--json`、`--block`、`--example-data`；自检增至 77 条。
- Task 3：schema-check.mjs 三个模式加 schema.json 自身的一致性检查；自检 26 条，含死循环迁移在超时后报告而不挂住。

## 自检条数

| 脚本 | 条数 | 命令 |
|------|------|------|
| summarize.mjs | 77 | `node tools/probe/summarize.mjs --self-test` |
| schema-check.mjs | 26 | `node tools/probe/schema-check.mjs --self-test` |

## 判定和分级的最终写法（对照决定）

| 决定 | 写法 |
|------|------|
| D-06 首屏 | `first_screen_ms ≤ 5000`（5000 达标、5001 不达标、缺失不达标） |
| D-06 登录 | `login_ok === true` 且 `login_ms ≤ 3000`（3000 达标、3001 不达标、登录失败不达标） |
| D-07 实时 | `pairDrops` 把 drop 与随后的 reconnect 按顺序配对。连续型：`drops` 为 0、events 里没有 drop、`pings_total > 0` 且 `pings_ok === pings_total`。重连型：每个计数的掉线都出现在 events 里、都有配对的重连、`ms ≤ 10000`（10000 达标、10001 不达标；没有 ms 时用两个时刻之差），并且打点全部收到。未配对的掉线、`drops` 比 events 里的 drop 多、任何打点丢失都不达标 |
| D-10 有效运行 | `dur_s ≥ 590`、`hidden_ms === 0`、`nav_type === 'navigate'`、`run_id` 不以 `verify-` 开头、有 carrier 和 net；无效原因取 `short / hidden / not-navigate / smoke / missing`，不计入表 1，在附注里按原因计数 |
| D-18 分级 | 每家运营商按有效运行的达标率：≥ 2/3 合格，> 1/2 且 < 2/3 临界，≤ 1/2 不合格，0 次有效为样本不足；表 1 的判定列取三项里最差的一级，每家运营商一行“合计”，D-18 的“至少三分之二”按这一行判定 |
| D-18 时段 | 本地时间 = `started_at` + `tz_offset_min`；本地 20:00–22:59 为晚高峰：`tz_offset_min` 为 480 记“北京晚高峰”，运营商为美国记“美国本地晚高峰”，其余“其他时段”；“夜”取本地日期，凌晨 0–5 点算前一晚 |

## 合成数据集覆盖的情形

`--example` 和 `--example-data` 用同一份内置数据（21 条，只在代码里构造，run_id 都是 `exNN-synthetic`）：

- 四家运营商（电信、联通、移动、美国）、手机 4G 与家宽两种网络。
- 三种分级都出现：电信手机 4G 为不合格（实时 1/2），联通为临界（实时 3/5），其余为合格。
- 实时的几种情形：掉线后无重连、4.2 秒重连（重连型达标）、12 秒重连（不达标）、打点丢失加疑似服务器空闲断开。
- 登录失败一次；首屏 6200 毫秒一次；首屏恰好 5000 毫秒一次。
- 时段：北京晚高峰、美国本地晚高峰、其他时段。
- `push_ms` 和 `events` 写成 JSON 字符串的一条；schema 之外的键一条（`legacy_x`）。
- 无效运行五种各一条：短、后台、非冷加载、冒烟、缺运营商。

## 给后续计划的执行者

- **schema.json（28 + 3 个字段）：** 06-05 的 probe.js 里 `RESULT_FIELDS` 是除 `created` 之外的 27 个字段名、`PING_FIELDS` 是 `run`、`seq`；06-06 的迁移文件按 schema.json 的字段对象和五条规则写；06-10 的 export-results.py 里 `FIELDS` 是全部 28 个字段名（含 `created`）。
- **schema-check.mjs 三个模式：**
  - `node tools/probe/schema-check.mjs --migration <迁移文件>`：在 node:vm 沙箱里执行，桩对象有 `migrate`、`Collection`、`app.findCollectionByNameOrId`、`app.settings()`（任意深度可读写）、`app.save`；迁移里不能依赖这些之外的全局。
  - `node tools/probe/schema-check.mjs --page <probe.js>`：数组必须是 `const RESULT_FIELDS = [` 和 `const PING_FIELDS = [` 开头、只含字符串字面量和逗号（数组里不能有注释）。
  - `node tools/probe/schema-check.mjs --export <export-results.py>`：`FIELDS = [` 必须在行首，同样只含字符串字面量和逗号。
  - 一致输出 `SCHEMA MATCH <模式>` 退出 0；不一致逐条 `SCHEMA MISMATCH <模式>: <集合>.<字段> <差异种类>` 退出 1；用法错误或读不到文件退出 2。
- **tz_offset_min：** 06-05 必须上传 `-new Date().getTimezoneOffset()`（本地减 UTC，北京为 480），汇总才会得出正确的本地时刻和时段。
- **06-10：** `node tools/probe/summarize.mjs --block <导出文件>` 的输出原样贴进结果文档，重跑同一命令并 diff；`--json` 给出每家运营商的三项达标率和分级，用来写结论。

## Task Commits

1. **Task 1：tracer——字段契约 schema.json 与表 1** - `89b25fe`（feat）
2. **Task 2：表 2、时段、分级、空闲断开标注、附注、--json、--block** - `0e11303`（feat）
3. **Task 3：schema-check.mjs** - `ecab89a`（feat）

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## Deviations from Plan

### 小的实现选择（没有触发 Rule 1–4）

**1. 表 2 增加一列 `run`（run_id 前 4 位）**
- **原因：** 计划列出的列里没有 run_id，但标题写着“run_id 取前 4 位”，且 06-10 要人工核对夜数和次数（T-06-07）；加一列才让标题成立。
- **影响：** 只多一列，输出仍只含前 4 位（非字母数字字符替换为 `?`）。

**2. 空闲断开标注的基线用“送达的打点”**
- **原因：** 照字面“上一条打点发出后 295–320 秒”，而打点间隔最长 180 秒，普通 600 秒运行里永远不会触发；只有打点丢失时空闲断开才会出现，所以丢失的打点不算送达，没有送达的打点就从连接时刻 0 算起。字面情形（dur_s 很长、第 495 秒打点后 295–320 秒掉线）结果相同。
- **影响：** 只是标注，不改变达标判定。

**3. TDD 提交粒度**
- 计划规定每个任务一次提交，且自检是脚本内的 `--self-test`，不属于 tdd.md 能分类的报告格式，所以没有拆成 test 和 feat 两个提交。Task 2、Task 3 都先写完整自检并运行看到失败（`gradeRatio is not defined`、`loadSchema is not defined`），再实现到全过。

**Total deviations:** 0 个自动修复；3 个小的实现选择已在上面记录。

## Known Stubs

无。

## Threat Flags

无新增的网络端点、认证路径或信任边界。schema-check.mjs 用 node:vm 执行迁移文件，只在本机、只执行仓库内的迁移模板，沙箱里只有桩对象，带 2 秒超时。

## Issues Encountered

无。

## Self-Check: PASSED

- 三个文件都存在：tools/probe/schema.json、tools/probe/summarize.mjs、tools/probe/schema-check.mjs。
- 三个提交都在 HEAD 的祖先里：89b25fe、0e11303、ecab89a。
- 三个任务的 `<verify>` 和 `<acceptance_criteria>` 全部重跑通过（summarize 77 条 ≥ 34，schema-check 26 条 ≥ 14，`--block` 两次逐字节相同，无参数退出码分别为 1 和 2，暂存后 privacy-check 通过）。
