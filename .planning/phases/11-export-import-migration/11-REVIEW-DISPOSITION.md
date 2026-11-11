---
phase: 11
review: 11-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "备份里 `done: true` 但没有 `doneDate` 的任务能通过导入校验，之后目标页渲染抛错，账号打不开"
  - id: WR-01
    severity: warning
    disposition: open
    title: "导入只含计划的文件或完整备份后，对不上新计划的自定义待办在目标页消失，摘要和迁移脚本都不提示"
  - id: WR-02
    severity: warning
    disposition: open
    title: "导入时计划缓存写失败的话，撤销不会恢复计划，只恢复记录，却提示“恢复成了导入前的样子”"
  - id: WR-03
    severity: warning
    disposition: open
    title: "导入发生在一次上传途中时，这次上传的收尾把 `opsOk` 重置成 true，之后撞上别处的新版本会静默覆盖，不留底"
  - id: IN-01
    severity: info
    disposition: open
    title: "迁移脚本的旧备份相对路径在 `chdir(root)` 之后按仓库根目录解析"
  - id: IN-02
    severity: info
    disposition: open
    title: "`importProblem` 开头的注释和 `if(!isObj(raw))return null` 在云端和旧路径上已经走不到"
  - id: IN-03
    severity: info
    disposition: open
    title: "登录换账号时导入快照被静默清除，只有退出登录会提示"
  - id: IN-04
    severity: info
    disposition: open
    title: "旧路径拒绝只含计划的文件时，toast 用默认的 1800 毫秒，提示一整句话读不完"
  - id: IN-05
    severity: info
    disposition: open
    title: "账号计划文档无效（回落到示例计划）时，导出的“完整备份”里写的是示例计划"
open: 9
total: 9
recorded: 2026-11-11T08:55:46.005Z
---

# Phase 11: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
