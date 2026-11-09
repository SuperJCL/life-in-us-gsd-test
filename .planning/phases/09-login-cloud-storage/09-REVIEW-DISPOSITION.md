---
phase: 09
review: 09-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "退出登录只检查本标签页的未保存状态，另一个标签页没上传的修改被静默清掉"
  - id: CR-02
    severity: critical
    disposition: open
    title: "计划文档不合格时回落到示例计划，随后第一次保存会把状态里的任务进度永久改写到服务器"
  - id: WR-01
    severity: warning
    disposition: open
    title: "`cloudSave` 把自己的写入误判成他人覆盖，会冲掉真正的留底，并且在覆盖成功之前就报“已被覆盖”"
  - id: WR-02
    severity: warning
    disposition: open
    title: "SDK 首次加载失败后再登录，`onAuthChange` 从未注册，跨标签页登出和换账号重载都失效"
  - id: WR-03
    severity: warning
    disposition: open
    title: "留底下载在 `a.click()` 之后立即销毁 blob 地址并删除本机唯一副本"
  - id: WR-04
    severity: warning
    disposition: open
    title: "退出登录对 `realtime.unsubscribe()` 没有超时，Phase 10 接上实时之后会卡死退出并让 `authQuiet` 一直为真"
  - id: WR-05
    severity: warning
    disposition: open
    title: "`persist()` 忽略缓存写入失败，“修改仍在本机”的提示可能不是真的"
  - id: WR-06
    severity: warning
    disposition: open
    title: "令牌过期（401）分支绕过 `resetSession()`，状态和界面残留，原始错误文字会漏到状态行"
  - id: WR-07
    severity: warning
    disposition: open
    title: "“SYNC-05 clicks, keys and drags…” 的第 6、7 步在守卫失效时也会通过，用例没有证明标题声称的内容"
  - id: IN-01
    severity: info
    disposition: open
    title: "`SB_ORDER` 里的 `expired`、`remote` 没有任何地方设置"
  - id: IN-02
    severity: info
    disposition: open
    title: "`strings.ts` 里有两个只定义、没人用的常量"
  - id: IN-03
    severity: info
    disposition: open
    title: "`tests/support/app.ts` 顶部的注释块贴错了位置"
  - id: IN-04
    severity: info
    disposition: open
    title: "几条用例的标题强于它们实际证明的内容"
  - id: IN-05
    severity: info
    disposition: open
    title: "`session.spec.ts` 同一用例里混用 `clock.install` 和 `setFixedTime`"
  - id: IN-06
    severity: info
    disposition: open
    title: "字体链接从应用里移除，传统路径（Claude Artifact）的标题字体也变了"
open: 15
total: 15
recorded: 2026-11-09T10:55:33.454Z
---

# Phase 09: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
