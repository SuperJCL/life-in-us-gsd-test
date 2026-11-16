---
phase: 15
review: 15-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "15-07 的 slot 替换只修了更新分支，创建分支留着同一个丢操作的缺口"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "距离和重量在校验之后才四舍五入，保存的值可能变成 0"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "「全部」范围的有氧周柱图按最早日期逐周生成，日期很早的导入数据会拖垮页面"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "门控期间从本周页跳到别的日子，记录区会被重画成可编辑的控件"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "`renderFh` 用原始 `dataset.fh` 拼选择器（审计提到的问题：确认存在，不可触发）"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "同一动作块的错误段落和某一组的错误段落可能 id 相同"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "`normalize` 先登记 id 再校验内容，同 id 的第二条合格记录会被连带丢掉"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "`fcGo` 里的局部常量 `me` 遮住了全局的用户 id `me`"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "训练历史里重画后，焦点在展开内容里的按钮上会丢失"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "`log.spec.ts` 用真实的 700 ms 等待和一条几乎不会失败的断言来确认「没有保存」"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "导入摘要的「计划」一行不统计有氧项"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "草稿里的动作被远端计划更新删掉后，仍可保存成孤儿记录"
open: 0
total: 12
recorded: 2026-11-16T19:13:36.946Z
---

# Phase 15: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 15-REVIEW-FIX.md |
| WR-02 | warning | fixed | 15-REVIEW-FIX.md |
| WR-03 | warning | fixed | 15-REVIEW-FIX.md |
| WR-04 | warning | fixed | 15-REVIEW-FIX.md |
| IN-01 | info | fixed | 15-REVIEW-FIX.md |
| IN-02 | info | fixed | 15-REVIEW-FIX.md |
| IN-03 | info | fixed | 15-REVIEW-FIX.md |
| IN-04 | info | fixed | 15-REVIEW-FIX.md |
| IN-05 | info | fixed | 15-REVIEW-FIX.md |
| IN-06 | info | fixed | 15-REVIEW-FIX.md |
| IN-07 | info | fixed | 15-REVIEW-FIX.md |
| IN-08 | info | fixed | 15-REVIEW-FIX.md |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
