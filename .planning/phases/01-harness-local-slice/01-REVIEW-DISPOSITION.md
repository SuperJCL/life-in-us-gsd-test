---
phase: 01
review: 01-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "静态服务器不校验 Host 头，存在 DNS rebinding 读取应用文件的窗口"
  - id: WR-02
    severity: warning
    disposition: open
    title: "`guard.reset()` 会清空全部五个数组，会同时吞掉同一用例里真正的违规"
  - id: WR-03
    severity: warning
    disposition: open
    title: "PROBE-2c 的标题和说明声称“只会到达代理”，但用例无法对泄漏回归报警"
  - id: WR-04
    severity: warning
    disposition: open
    title: "README 对解析层的描述与 PROBES.md 的实测结果矛盾"
  - id: WR-05
    severity: warning
    disposition: open
    title: "对第 2 层、第 3 层的违规，护栏不会让任何用例失败"
  - id: WR-06
    severity: warning
    disposition: open
    title: "MOCK-01 对“启动时不写 localStorage”只做了单次采样的否定断言"
  - id: IN-01
    severity: info
    disposition: open
    title: "PROBE-1 硬编码了最低浏览器主版本 155"
  - id: IN-02
    severity: info
    disposition: open
    title: "端口在多处重复写死，没有从 `PORT` 派生"
  - id: IN-03
    severity: info
    disposition: open
    title: "`canConnect('::1')` 在 IPv6 被禁用的机器上是空转；`test.skip` 会连带跳过其后的 IPv6 检查"
  - id: IN-04
    severity: info
    disposition: open
    title: "静态服务器没有 `error` 处理，客户端中途断开时文件流不会被销毁"
  - id: IN-05
    severity: info
    disposition: open
    title: "`seedLocalStorageIfAbsent` 没有保护 `localStorage` 访问；PROBE-5 内联了一份与 fixture 文件重复的种子"
  - id: IN-06
    severity: info
    disposition: open
    title: "`findUnmarkedFixtures` 从 spec 文件里导出；`expectPersisted` 的谓词抛错会终止轮询"
  - id: IN-07
    severity: info
    disposition: open
    title: "其他小问题"
open: 13
total: 13
recorded: 2026-11-02T04:43:25.585Z
---

# Phase 01: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
