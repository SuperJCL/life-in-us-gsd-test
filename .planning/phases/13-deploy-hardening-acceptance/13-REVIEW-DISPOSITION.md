---
phase: 13
review: 13-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "06 先换页面再 reload nginx，窗口内的新页面带着旧 CSP，而 SW 预缓存可能把这份坏页面永久缓存"
  - id: WR-02
    severity: warning
    disposition: open
    title: "外壳版本号不包含 CSP 头，只改 CSP 策略的发布不会到达老用户"
  - id: WR-03
    severity: warning
    disposition: open
    title: "03 只要有工具文件变化就要求停掉线上 PocketBase"
  - id: WR-04
    severity: warning
    disposition: open
    title: "迁移清单在 6 处硬编码，新增迁移会被静默漏装，而本机检查却会测到它"
  - id: WR-05
    severity: warning
    disposition: open
    title: "README 第 8 节写的 PocketBase 升级办法，被 02 自己拒绝，也过不了 C-10"
  - id: WR-06
    severity: warning
    disposition: open
    title: "README 说 HSTS 之后改一下头文件就行，但 verify-site 和 server-check 都把 86400 写死了"
  - id: WR-07
    severity: warning
    disposition: open
    title: "恢复演练可以空转通过：不检查备份新旧，也不要求真的逐份比对过文档"
  - id: WR-08
    severity: warning
    disposition: open
    title: "04 覆盖旧 unit 时不留备份，README 的回滚步骤「恢复旧 unit 文件」无处可恢复"
  - id: IN-01
    severity: info
    disposition: open
    title: "导入真实数据之后恢复演练永久被守卫挡住，Phase 16 之后没有任何办法再证明「备份能恢复」"
  - id: IN-02
    severity: info
    disposition: open
    title: "点「点此更新」后如果 SKIP_WAITING 没有引发 controllerchange，横幅会一直停在「正在更新…」且按钮不可点"
  - id: IN-03
    severity: info
    disposition: open
    title: "备份看门狗在没配好 SMTP 时静默，首次部署当天还会误报"
  - id: IN-04
    severity: info
    disposition: open
    title: "nginx 错误日志会记完整请求行，包括后台下载备份链接里的 `?token=`"
  - id: IN-05
    severity: info
    disposition: open
    title: "`process.env.TEMP = undefined` 会变成字符串 \"undefined\""
  - id: IN-06
    severity: info
    disposition: open
    title: "SW 的 activate 删除源下所有不叫当前名字的缓存，并且「不留半套缓存」的注释不准确"
  - id: IN-07
    severity: info
    disposition: open
    title: "测试静态服务器的版本开关是一个会改状态的 GET"
  - id: IN-08
    severity: info
    disposition: open
    title: "manifest 的 description 与 name 相同，是升级演练留下的占位"
  - id: IN-09
    severity: info
    disposition: open
    title: "verify-site 的 F-11 在锁定失效时会在线上真的创建一个账号"
  - id: IN-10
    severity: info
    disposition: open
    title: "inlineBlocks 的 `\\bsrc=` 判断会把 `data-src=` 之类的属性误当成外部脚本"
  - id: IN-11
    severity: info
    disposition: open
    title: "若干文档和测试里的陈旧引用与重复常量"
open: 19
total: 19
recorded: 2026-11-17T20:06:48.636Z
---

# Phase 13: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| WR-08 | warning | open | - |
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
| IN-11 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
