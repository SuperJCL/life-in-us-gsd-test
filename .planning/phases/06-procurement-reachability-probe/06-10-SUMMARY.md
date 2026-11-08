---
phase: 06-procurement-reachability-probe
plan: 10
subsystem: infra
tags: [probe, export, sha256-approval, summarize, reachability, d-08, d-10-revision, privacy, boce]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-03 的 summarize.mjs 与 schema-check.mjs、06-09 的运行中的探针站点和所有者短测记录
provides:
  - "tools/probe/server/export-results.py：只读导出 probe_results 的脚本，sha256 被所有者批准并钉住，两次导出前都核对"
  - "06-PROBE-RESULTS.md：D-08 三部分结论、给 Phase 10 和 Phase 13 的输入、表 1 到表 4、与测试安排的核对"
  - "INFRA-02 按所有者 D-10 修订缩减后的范围完成：美国 1 次短测（无效）加国内三网非高峰拨测基线，没有国内浏览器实测"
affects: [10, 13]

actuals:
  tokens: 14000
  tasks: 4
  commits: 3
plan_head_before: afaef7f2f5bea8b10a2c906ab9ebbfb4bd3f0674
plan_head_after: ccc7326a18a1cbec0f4ce3fcf361f8f0268a0f3d

tech-stack:
  added: []
  patterns:
    - "导出脚本钉 sha256：同一条命令链里先 sha256sum -c --strict 核对，通过才运行 ssh，经 sudo -n python3 -I - 从标准输入运行"
    - "结果文档的表 1、表 2、附注由 summarize.mjs --block 生成并原样粘贴，verify 重跑并 diff"

key-files:
  created:
    - tools/probe/server/export-results.py
    - .planning/phases/06-procurement-reachability-probe/06-PROBE-RESULTS.md
  modified: []

key-decisions:
  - "D-10 修订（所有者 2026-11-08，已由 ccc7326 记录）：不做多晚实测，浏览器实测只算所有者在美国的 90 秒短测，国内三网用一次多点拨测基线代替；结论写“样本不足”，D-08 不变"
  - "itdog.cn 在美国打不开（403/522），所有者改用 boce.com 的拨测（网站测速加 Ping）；Ping 代替 tcping 443"
  - "Phase 10 的兜底轮询取保守档（页面可见时每 60 秒，重连后整份补拉），因为没有任何带 120 秒以上安静期的打点数据"
  - "INFRA-02 按缩减后的范围标记完成，并在 REQUIREMENTS.md 的该行追加范围说明"

patterns-established:
  - "只读导出：脚本在批准前写好并提交，批准钉在 sha256 上，脚本一改就要重新请批准"

requirements-completed: [INFRA-02]

coverage:
  - id: D1
    description: "导出脚本经所有者批准，两次导出前 sha256 核对通过，只读导出 probe_results（SCHEMA MATCH export）"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "sha256sum -c --strict --quiet 在两次导出前通过；node tools/probe/schema-check.mjs --export 输出 SCHEMA MATCH export；导出文件被 git 忽略"
        status: pass
    human_judgment: false
  - id: D2
    description: "结果文档的表 1、表 2、附注与对同一份导出重跑 summarize.mjs --block 逐字相同"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "Task 4 verify：diff --strip-trailing-cr 退出码 0（DIFF=0）；标记行各一行"
        status: pass
    human_judgment: false
  - id: D3
    description: "国内三网的实测只有非高峰多点拨测基线，没有浏览器实测；美国只有一次无效的 90 秒短测"
    requirement: INFRA-02
    verification:
      - kind: manual_procedural
        ref: "所有者 D-10 修订（2026-11-08）；所有者在 boce.com 跑网站测速和 Ping，数字由编排者转录；表 3、表 4 写入结果文档"
        status: pass
    human_judgment: true
    rationale: "实测范围是所有者的决定；D-06、D-07 对国内三网无法判定，如实记为样本不足"
  - id: D4
    description: "结果文档不含 IP、域名、邮箱或测速站原始输出，通过 redact --check 和 privacy-check --staged"
    requirement: INFRA-02
    verification:
      - kind: other
        ref: "node tools/privacy/redact.mjs --check < 结果文档 和 SUMMARY（退出码 0）；grep 无 IPv4、邮箱符号、域名后缀关键字、真实主机名；privacy-check --staged 退出码 0"
        status: pass
    human_judgment: false

duration: 多段执行（含所有者操作的等待）
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 10: 导出批准、探针结果汇总与 D-08 结论 Summary

**所有者批准了固定 sha256 的只读导出脚本，两次导出用掉一次后又用掉第二次，得到 2 条记录（1 条冒烟、1 条美国 90 秒短测，都不计入达标率）；在所有者 D-10 修订下，06-PROBE-RESULTS.md 写成：国内三网“样本不足”（只有非高峰的 boce.com 拨测基线，没有浏览器实测），美国短测按 dur_s ≥ 590 的规则无效，D-08 结论是继续用阿里云香港，给 Phase 10 的兜底轮询取保守的每 60 秒，并写明国内电信和联通往返约 300–400 毫秒。**

## Performance

- **Completed:** 2026-11-08
- **Tasks:** 4（Task 1 检查点、Task 2 tracer、Task 3 所有者操作、Task 4 结果文档）
- **Files created:** 2（`tools/probe/server/export-results.py`、`06-PROBE-RESULTS.md`）

## 导出批准（D-17）

- **所有者的选项：** 回复“批准”，批准的是检查点里贴出全文的 export-results.py。批准覆盖 2 次导出（Task 2 一次、Task 4 一次），其他任何服务器到本机的传输要另行批准。
- **批准的 sha256 那一行（与检查点里贴出的逐字相同）：**

```text
9f9b63cefb2d5274e497593a3a9b492eea02a60a5e2228cdaec1c434a0b2b8d9 *tools/probe/server/export-results.py
```

- **批准的命令（Git Bash，先 `set -o pipefail`，核对和导出在同一条命令链里）：**

```text
P=private/probe-results/export-results.py.sha256 && test "$(grep -c . $P)" -eq 1 && grep -qE '^[0-9a-f]{64} [ *]tools/probe/server/export-results\.py$' $P && sha256sum -c --strict --quiet $P && ssh -o BatchMode=yes usj 'sudo -n python3 -I -' < tools/probe/server/export-results.py > private/probe-results/<YYYYMMDD-HHMM>.json
```

- **输出位置和文件名格式：** 只写在本机被 git 忽略的 `private/probe-results/`，文件名 `<YYYYMMDD-HHMM>.json`（运行时的本机时间）；导出文件不暂存、不提交。
- **两次导出实际生成的文件：**

| 次 | 文件名 | sha256 核对 | ssh 退出码 | 记录数 |
|----|--------|-------------|-----------|--------|
| 1（Task 2） | `20261108-0929.json` | 通过 | 0 | 2（1 冒烟、1 短测） |
| 2（Task 4） | `20261108-1001.json` | 通过 | 0 | 2（1 冒烟、1 短测） |

批准的两次导出已全部用完。之后没有运行任何其他 ssh 命令；没有再导出的批准。第二次导出与第一次内容逐字节相同（`cmp` 一致），说明两次之间没有任何新上传。

## Task 记录

### Task 1：导出脚本和所有者批准（提交 211ae76）

export-results.py 在检查点前写好并提交（`schema-check --export` 输出 SCHEMA MATCH export，含 `mode=ro` 和 `probe_results`，没有对用户、超级用户、日志表的查询）；sha256 钉在被忽略的 `private/probe-results/export-results.py.sha256`。所有者核对全文后批准。

### Task 2：tracer，导出 #1 和短测核对（提交 dd8d2b9，只改 STATE）

- 2 条记录：1 条冒烟（run_id 以 verify- 开头），1 条所有者短测（run 前 4 位 4084）。
- 短测数字：dur_s 90，首屏 856 ms，登录 262 ms（成功），接口 RTT 179 ms，建连 372 ms，掉线 0，打点 2/2，推送延迟中位 177 ms。
- 浏览器上报 `tz_offset_min` 为 0，而所有者的电脑设的是美国太平洋时间，所以 summarize 把本地时刻记成 16:44（按 UTC），时段是“其他时段”。已写进已知限制和 Phase 13 的修复项。
- summarize 三个标题齐全，短测和冒烟都计为无效（短运行、冒烟运行）。

### Task 3：所有者操作，按 D-10 修订回答

所有者决定（2026-11-08，原话）：“我觉得不需要测那么多次了，就这一次就行了”；被问到时选择“只补一次 itdog”（修订记录在 ccc7326 的 06-CONTEXT 里）。itdog.cn 在美国打不开（403/522），所有者改用 boce.com 的拨测：先网站测速（HTTP），再 Ping（不是 TCPing）。时间约 2026-11-08 17:50 UTC，约北京时间 2026-11-09 01:50，非晚高峰。原始粘贴含服务器 IP，没有进入任何文件；转录数字如下（全部节点都解析到中国香港阿里云）。

- HTTP（总时间）：电信 31 节点 31 成功，中位 1.91 秒、P90 3.03 秒；移动 31 节点 30 成功 1 超时，中位 1.28 秒、P90 2.19 秒；联通 30 节点 30 成功，中位 2.04 秒、P90 2.83 秒。
- Ping（延迟，列含义是假设的）：电信 29 节点，中位 359 ms、P90 412 ms；移动 29 节点（1 个解析失败），中位 197 ms、P90 235 ms，9 个节点低于 100 ms；联通 28 节点（1 个解析失败），中位 382 ms、P90 578 ms，1 个节点 20% 丢包，其余 0%。
- 美国侧 mtr：未做。上传失败：无。所有者没有补充已知限制。

### Task 4：导出 #2 和结果文档（提交见下）

- 第二次导出（`20261108-1001.json`）后用 `summarize.mjs --block` 生成表 1、表 2、附注，原样贴入 06-PROBE-RESULTS.md，verify 重跑 diff 退出码 0。
- 06-PROBE-RESULTS.md 含：D-08 三部分结论、给 Phase 10 和 Phase 13 的输入、表 1 到表 4、附注标题、与测试安排的核对。
- 结论要点：继续用阿里云香港；国内三网 D-06、D-07 记为样本不足（无浏览器实测，D-10 已按所有者决定修订）；美国短测按有效运行规则无效；180 秒的测量范围说明已写入。

## 结论摘要（D-08）

1. **实测结果：** 国内三网无浏览器数据，样本不足；非高峰拨测基线显示 HTTP 单次请求中位约 1.3–2 秒，Ping 全部几乎 0% 丢包。美国短测各项数字很好（首屏 856 ms、登录 262 ms、掉线 0、推送 177 ms），但只有 90 秒，无效。
2. **已知限制：** 无国内浏览器数据；基线是一次非高峰；美国只有 90 秒短测；tz_offset_min=0 使美国时段分类不准；电信和联通往返约 300–400 ms，路线很可能绕路；打点安静期最长 180 秒，5 分钟空闲断开没有被直接测到。
3. **做过的调整：** nginx 实时连接参数（关缓冲、HTTP/1.1、读超时 3600 秒）实测期间无改动；D-10 范围修订和 itdog 换 boce、Ping 代替 tcping；00-status.sh 的修正（e3ba17c）；推送例外清单（cae2c04）。
4. **给 Phase 10：** 整份补拉；页面可见时每 60 秒轮询（保守档，因为没有 120 秒以上安静期的数据）；F-13 为 199 ms，短测推送中位 177 ms；请求要批量合并，避免碎请求。
5. **给 Phase 13：** 06-09 的内存、swap、certbot、防火墙数字；`/_/` 加固；探针站点可重装；真实设备验收；探针页时区上报的修复项。

## Task Commits

1. **Task 1：导出脚本** - `211ae76`（feat）
2. **Task 2：tracer，导出 #1 与短测核对** - `dd8d2b9`（docs，只改 STATE）
3. **Task 3：所有者操作（D-10 修订）** - 无提交；修订由编排者在 `ccc7326` 里记录
4. **Task 4：结果文档、SUMMARY、需求和状态** - 随后的 `docs(06-10)` 提交

`commits: 3` 是本计划自己的提交：211ae76、dd8d2b9 和这次 docs(06-10) 提交。`cae2c04`（隐私检查的推送例外清单）和 `ccc7326`（D-10 修订记录）是编排者的提交，位于计划的起止之间，不计入。`plan_head_after` 是写本文件时的 HEAD（`ccc7326`），不含这次 docs 提交本身。

## Files Created/Modified

仓库内：

- `tools/probe/server/export-results.py`：只读导出脚本（Task 1）。
- `.planning/phases/06-procurement-reachability-probe/06-PROBE-RESULTS.md`：结果文档（Task 4）。
- `.planning/phases/06-procurement-reachability-probe/06-10-SUMMARY.md`：本文件。
- `.planning/REQUIREMENTS.md`、`.planning/STATE.md`、`.planning/ROADMAP.md`：需求和状态更新。

仓库外（被忽略）：`private/probe-results/export-results.py.sha256`、`20261108-0929.json`、`20261108-1001.json`。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

**计划范围被所有者修订（不是执行者偏离）：** 计划的 Task 3（至少 3 个晚上、三网加美国的真实浏览器晚高峰实测，加美国侧 mtr）和对应的验收标准，被所有者 2026-11-08 的 D-10 修订取代。结果是：

- 国内三网没有浏览器实测，D-06、D-07 对国内记为样本不足；
- 美国只有 1 次 90 秒短测，无效；
- 多点基线用 boce.com 的网站测速和 Ping，在北京时间凌晨（非高峰）做，不是 itdog.cn，也没有 tcping 443；
- 美国侧 mtr 没做；
- Task 4 的“与测试安排的核对”一节改为按修订后的安排核对（实际只有 1 条冒烟和 1 条短测，没有新记录）。

执行者自己没有偏离计划，没有触发 Rule 1 到 4。

### 记录在案的

- INFRA-02 的原文要求“晚高峰、电信/联通/移动和美国都实测”，按缩减后的范围标记完成，并在 REQUIREMENTS.md 的该行追加了范围说明，没有隐瞒缩减。

## Issues Encountered

- 所有者短测的 `tz_offset_min` 为 0，与电脑设的美国太平洋时间不符；探针页的时区取值需要核对，已写进结果文档的 Phase 13 修复项。
- itdog.cn 在美国返回 403/522，改用 boce.com。

## Known Stubs

无。

## Threat Flags

无新增：本计划涉及的信任边界（服务器到本机的导出、以 root 运行的脚本、结果文档公开、转录数据）都在计划的威胁登记里（T-06-27、T-06-28、T-06-34、T-06-SC）。

## 需求状态

| 需求 | 状态 | 依据 |
|------|------|------|
| INFRA-02 | 完成（按所有者 D-10 修订缩减后的范围） | 结果文档含美国 1 次短测（无效）和国内三网非高峰拨测基线；没有国内浏览器实测，详见 06-PROBE-RESULTS.md |

## User Setup Required

无新增。

## Next Phase Readiness

- Phase 6 的 10 个计划都已有 SUMMARY；阶段本身的验收（代码审查、验证）由编排者接着做。
- Phase 10 和 Phase 13 的输入在 06-PROBE-RESULTS.md 里。

## Self-Check: PASSED

- 提交 `211ae76`、`dd8d2b9` 存在于当前分支。
- `tools/probe/server/export-results.py` 和 `06-PROBE-RESULTS.md` 存在。
- 两次导出前 `sha256sum -c --strict --quiet` 都通过；第二次导出后没有再运行任何 ssh。
- 结果文档与 SUMMARY 都经 `node tools/privacy/redact.mjs --check` 退出码 0，且不含 IPv4、邮箱符号、域名后缀关键字和真实主机名。
