---
phase: 12
review: 12-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "计划读不出来时选「用我的覆盖」，原始的读不出来的计划没有留底，提示却说已留底（12-SECURITY.md S-1，已确认）"
  - id: CR-02
    severity: critical
    disposition: open
    title: "编辑页开着时「恢复」（导入）或「撤销导入」会绕过 D-07 冲突判断，保存草稿时静默覆盖导入的计划并删掉对应进度"
  - id: WR-01
    severity: warning
    disposition: open
    title: "预设标签的校验错误不会展开所在的折叠卡，保存时焦点落空"
  - id: WR-02
    severity: warning
    disposition: open
    title: "D-17 的数量和长度上限只靠按钮禁用和 `maxlength`，保存时不检查，超限的现有计划可以原样保存"
  - id: IN-01
    severity: info
    disposition: open
    title: "清空组备注会让「没有任何修改」的草稿被判为有修改"
  - id: IN-02
    severity: info
    disposition: open
    title: "保存或放弃后用 `replaceState` 去掉 `#plan`，留下一条重复的历史记录"
  - id: IN-03
    severity: info
    disposition: open
    title: "`readArchived` 把没有历史的力量项的备注当成一条历史"
open: 7
total: 7
recorded: 2026-11-12T04:09:43.085Z
---

# Phase 12: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
