---
phase: 05
review: 05-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "时间线用例里有几条“防空转”断言对 `expectedTimeline` 自身是恒真的"
  - id: IN-02
    severity: info
    disposition: open
    title: "`expectedTimeline` 的两处规则与应用不完全等价，只对规整的输入成立"
  - id: IN-03
    severity: info
    disposition: open
    title: "IO-05 里写死了 fixture 的记录 id 和它们的目标类别"
  - id: IN-04
    severity: info
    disposition: open
    title: "默认时钟的导入用例里 `expectToast(TOAST_RESTORED)` 依赖约 1.8 秒的真实时间窗口"
  - id: IN-05
    severity: info
    disposition: open
    title: "README 对 `import-file.ts` 的数据形状描述与实现不一致"
  - id: IN-06
    severity: info
    disposition: open
    title: "KNOWN-BUGS.md 把 B8 列为“仍未验证”，同时 N3 一行又说 N3 的根因就是 B8"
  - id: IN-07
    severity: info
    disposition: open
    title: "PROBES.md 的记录日期没有随 PROBE-8 更新"
  - id: IN-08
    severity: info
    disposition: open
    title: "PROBE-8 里的裸 `catch {}` 会吞掉所有错误"
  - id: IN-09
    severity: info
    disposition: open
    title: "`probes.spec.ts` 里有一处类别显示名字面量违反“只在 strings.ts”规则（旧代码，不在 PROBE-8 范围）"
  - id: IN-10
    severity: info
    disposition: open
    title: "窄屏滚动用例的 at-bottom 分支无法区分 `block` 取值（已如实记录，在黑盒约束下无法消除）"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "窄屏滚动用例的终态条件 `|| atBottom` 在这个页面上过宽"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "B2 对照用例的“没有写入”断言在 600 ms 防抖窗口内必然成立"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "N3 标记用例只断言 toast，登记的“不弹确认、数据不变”没有被断言"
open: 10
total: 13
recorded: 2026-11-04T05:01:31.553Z
---

# Phase 05: Code Review Disposition

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
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| WR-01 | warning | fixed | 05-REVIEW-FIX.md (not in the current review) |
| WR-02 | warning | fixed | 05-REVIEW-FIX.iter2.md (not in the current review) |
| WR-03 | warning | fixed | 05-REVIEW-FIX.iter2.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
