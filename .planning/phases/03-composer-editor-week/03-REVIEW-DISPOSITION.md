---
phase: 03
review: 03-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "composer helper 里有两个没有使用的成员"
  - id: IN-02
    severity: info
    disposition: open
    title: "用魔法下标取类别"
  - id: IN-03
    severity: info
    disposition: open
    title: "用 `JSON.stringify` 比较“其余内容没变”，对键顺序敏感"
  - id: IN-04
    severity: info
    disposition: open
    title: "已知 bug 登记护栏的两处缺口"
  - id: IN-05
    severity: info
    disposition: open
    title: "README 对标记用例在列表里的显示描述不准确"
  - id: IN-06
    severity: info
    disposition: open
    title: "选中类名的正则过松"
  - id: IN-07
    severity: info
    disposition: open
    title: "“改回未完成”用例没有先确认复选框原本是勾选的"
  - id: IN-08
    severity: info
    disposition: open
    title: "README 的“时间与保存”一节没有跟上 manual 时钟的新用法"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "“没有写入”的检查在 `runFor` 后立刻采样，异步到达的多余写入会漏检"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "类别显示名字面量写在 spec 里"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "带撤销的 toast 只有 5 秒，撤销窗口靠真实时间"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "B4 标记用例的“立即刷新”路径没有任何不带标记的用例证明它本身可用"
open: 8
total: 12
recorded: 2026-11-03T23:46:31.402Z
---

# Phase 03: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| WR-01 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 03-REVIEW-FIX.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
