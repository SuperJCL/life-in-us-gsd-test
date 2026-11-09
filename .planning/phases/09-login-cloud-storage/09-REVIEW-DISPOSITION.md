---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "重新打开页面之后，自己上一次页面的写入会被当成“另一台设备”，并替换掉可能真正有用的留底"
  - id: WR-02
    severity: warning
    disposition: open
    title: "云端保存没有超时，一个挂住的 PATCH 会让后面的保存全部排队，`resetSession()` 也不重置 `saving`"
  - id: IN-01
    severity: info
    disposition: open
    title: "对账里先弹“已被覆盖”的 toast，随后可能被“已更新为其他设备上的最新内容”替换掉"
  - id: IN-02
    severity: info
    disposition: open
    title: "`cloudSave` 里的 `cur` 声明在 try 外面但只在 try 里用"
  - id: IN-03
    severity: info
    disposition: open
    title: "上一轮未处理的 INFO 仍然存在"
  - id: IN-04
    severity: info
    disposition: open
    title: "对账里“超限且服务器文档已被删除”的情况下，之后每次保存都读不到记录，直到重新打开"
  - id: IN-05
    severity: info
    disposition: open
    title: "过期标记键没有失效时间"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "logout only checked this tab's unsaved state"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "invalid plan document made normalize drop task progress, and the first save uploaded it"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "blob address revoked on the next tick after the click"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "no timeout on realtime.unsubscribe() during logout"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "persist() ignored cache write failures"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "the 401 branch bypassed resetSession and other tabs misreported an expiry"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "the gate test passed with the capture guard removed"
  - id: IN-06
    severity: info
    disposition: open
    title: "字体链接从应用里移除，传统路径（Claude Artifact）的标题字体也变了"
open: 8
total: 15
recorded: 2026-11-09T23:07:24.228Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| CR-01 | critical | fixed | 09-REVIEW-FIX.md (not in the current review) |
| CR-02 | critical | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-03 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-04 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-05 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-06 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| WR-07 | warning | fixed | 09-REVIEW-FIX.md (not in the current review) |
| IN-06 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
