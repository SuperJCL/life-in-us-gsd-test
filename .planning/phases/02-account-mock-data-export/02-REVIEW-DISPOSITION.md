---
phase: 02
review: 02-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "目标视图断言失败时，Playwright 的元素预览会把内置任务文字和力量项目备注打印出来"
  - id: IN-01
    severity: info
    disposition: open
    title: "README 第 10 节写“六项运行时探针”，实际有七项"
  - id: IN-02
    severity: info
    disposition: open
    title: "端口号 4789 在多处写死，没有用 `PORT` 常量"
  - id: IN-03
    severity: info
    disposition: open
    title: "IO-03 首个用例里“还没有任何写入”是单次采样，没有证明力"
  - id: IN-04
    severity: info
    disposition: open
    title: "“每个用例从空 mock 开始”的断言无法检测共享状态"
  - id: IN-05
    severity: info
    disposition: open
    title: "DATA-02 的“合成标记”检查会被注释满足"
  - id: IN-06
    severity: info
    disposition: open
    title: "`local-seed.json` 的读取在四个 spec 里各写了一份；CONTRACT.md 的未实现清单漏了一项"
  - id: IN-07
    severity: info
    disposition: open
    title: "`csv-masking.spec.ts` 第 5 条用例的名字和注释声称的覆盖，实际没有守住；`csvMismatch` 的兜底分支没有用例"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "`loadFixture` 的路径分隔符检查在 Windows 上放过了反斜杠"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "MOCK-05 反向对照只证明了 `expectAccountMode` 三项检查里的第一项"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "`AppHarness.open()` 在同一个 page 上第二次以账户模式调用，会让 mock 注入脚本抛 TypeError"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "MOCK-04 里 CSV 的 toast 断言可以靠 JSON 的 toast 残留通过"
open: 7
total: 12
recorded: 2026-11-03T20:15:14.649Z
---

# Phase 02: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 02-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| WR-02 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-03 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-04 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |
| WR-05 | warning | fixed | 02-REVIEW-FIX.iter2.md (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
