---
phase: 16
review: 16-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "sw.js 安装失败时 `caches.delete(CACHE)` 可能删掉正在使用的外壳缓存（16-03 IN-08 引入）"
  - id: WR-02
    severity: warning
    disposition: open
    title: "F-11 的匿名注册探测只看状态码，任何一层的 403 都算通过（16-02 IN-09）"
  - id: WR-03
    severity: warning
    disposition: open
    title: "ACCT03-6/7 没有锁住声称\"实测\"的 403 和 400（16-02 IN-09）"
  - id: WR-04
    severity: warning
    disposition: open
    title: "点击更新后的 4 秒兜底刷新会静默丢掉这段时间里新输入的草稿（16-03 IN-02）"
  - id: IN-01
    severity: info
    disposition: open
    title: "04 覆盖 unit 之后、进入 `fail_and_disable` 之前的失败不会放回旧 unit，备份文件也不会清理（16-01 WR-08）"
  - id: IN-02
    severity: info
    disposition: open
    title: "restore-drill 的备份年龄正则接受负数"
  - id: IN-03
    severity: info
    disposition: open
    title: "C-24 用开发机的 awk 运行 `csp_union`，不是服务器上的 awk"
  - id: IN-04
    severity: info
    disposition: open
    title: "verify-site 的页面头检查接受带 includeSubDomains 或 preload 的 HSTS"
open: 8
total: 8
recorded: 2026-11-22T17:36:21.942Z
---

# Phase 16: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
