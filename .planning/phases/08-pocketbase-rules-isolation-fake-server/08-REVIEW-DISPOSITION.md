---
phase: 08
review: 08-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "journey_docs 的 createRule 没有对字段修饰符键做过隔离断言，可能允许 A 以 B 的名义创建文档"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "多个“只在直接运行时执行入口”的脚本在入口判断失败时静默退出 0（fail open）"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "下载脚本以系统临时目录为工作目录调用相对名字的 unzip 和 powershell，存在可执行文件被抢先放置的风险"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "假服务器在同文档导航时也会注销页面的实时连接"
  - id: IN-01
    severity: info
    disposition: open
    title: "规则快照把 relation 字段的目标集合一律写成 `<users>`，目标集合不被核对"
  - id: IN-02
    severity: info
    disposition: open
    title: "users 的更新规则没有显式写 email，也没有断言 tokenKey 等系统字段的自改"
  - id: IN-03
    severity: info
    disposition: open
    title: "实例库的清理失败是静默的，也没有强制“同一时间只有一个实例”"
  - id: IN-04
    severity: info
    disposition: open
    title: "下载脚本的几处小问题"
  - id: IN-05
    severity: info
    disposition: open
    title: "隐私检查器的入口判断在 `process.argv[1]` 缺失时按“被导入”处理，与注释里的 fail closed 说法不一致"
  - id: IN-06
    severity: info
    disposition: open
    title: "cloud 护栏自检断言了 Chromium 控制台消息的完整原文"
  - id: IN-07
    severity: info
    disposition: open
    title: "README 说 test:cloud “低优先级”，但配置里没有实现"
  - id: IN-08
    severity: info
    disposition: open
    title: "测试工具里几处小的健壮性问题"
open: 8
total: 12
recorded: 2026-11-09T02:58:33.306Z
---

# Phase 08: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | 7834840 (08-REVIEW-FIX.md) |
| WR-02 | warning | fixed | 1c1e8db (08-REVIEW-FIX.md) |
| WR-03 | warning | fixed | 74b31f0 (08-REVIEW-FIX.md) |
| WR-04 | warning | fixed | 08-REVIEW-FIX.md |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
