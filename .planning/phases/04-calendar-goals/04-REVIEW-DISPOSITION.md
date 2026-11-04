---
phase: 04
review: 04-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "`judge` 被 `export`，但模块在导入时就会执行 `process.exit`（上一轮 IN-01，仍成立）"
  - id: IN-02
    severity: info
    disposition: open
    title: "`strings.ts` 的注释用应用源码行号做出处，会随应用变动失效（上一轮 IN-03，仍成立）"
  - id: IN-03
    severity: info
    disposition: open
    title: "力量 toast 的片段比较无法区分是哪一项力量被更新（上一轮 IN-04，仍成立）"
  - id: IN-04
    severity: info
    disposition: open
    title: "chip 类别类断言只能证明“互不相同”，不能发现类别之间被对调或统一换了映射"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "撤销 toast 的“5 秒”从未被钉住"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "N1 对照用例没有排除“标签往返本身清草稿”"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "`check-report.mjs` 对跳过、过滤、中断的用例没有设防"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`expectedCategory` 用 `in` 判断旧类别"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "chip 类别类只证明两处互相一致"
open: 4
total: 9
recorded: 2026-11-04T02:31:50.150Z
---

# Phase 04: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| WR-01 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 04-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
