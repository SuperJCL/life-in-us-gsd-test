---
phase: 10
review: 10-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "进行中的 `syncOnce` 不会被退出登录或会话重置中止，`authRefresh` 的迟到应答可以把令牌重新存回来"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "重试倒计时每秒重建一次“立即重试”按钮，键盘焦点丢失，慢一点的点击会落空"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "一轮同步（读两份完整文档加上传）共用一个 15 秒超时，大文档在慢线路上会永远超时"
  - id: IN-01
    severity: info
    disposition: skipped
    title: "带缓存时已经没有路径能到达“连不上、只读”的横幅，相关代码已成死代码"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "离线或保存失败期间，每次编辑都会立即发起一次请求，并推进退避档位"
  - id: IN-03
    severity: info
    disposition: fixed
    title: "`sizeCheck` 量的是 `state`，上传的却是 `docAfter()`"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "一个标签页发现登录过期，其他标签页会被直接送到登录页，草稿丢失"
  - id: IN-05
    severity: info
    disposition: skipped
    title: "导入路径绕过 `commit`，以后若在云端放开导入会和挂起槽冲突"
  - id: IN-06
    severity: info
    disposition: skipped
    title: "`normalize` 对非法 id 的记录每次生成新的随机 id，`remoteDiffers()` 会永远为真"
open: 0
total: 9
recorded: 2026-11-10T17:36:15.345Z
---

# Phase 10: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 10-REVIEW-FIX.md |
| WR-02 | warning | fixed | 10-REVIEW-FIX.md |
| WR-03 | warning | fixed | 10-REVIEW-FIX.md |
| IN-01 | info | skipped | 10-REVIEW-FIX.md |
| IN-02 | info | fixed | 10-REVIEW-FIX.md |
| IN-03 | info | fixed | 10-REVIEW-FIX.md |
| IN-04 | info | fixed | 10-REVIEW-FIX.md |
| IN-05 | info | skipped | 10-REVIEW-FIX.md |
| IN-06 | info | skipped | 10-REVIEW-FIX.md |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
