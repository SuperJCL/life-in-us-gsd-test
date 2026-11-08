---
phase: 06
review: 06-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "探针页把负的 tz_offset_min 截成 0，美国侧运行的本地时间全部算错"
  - id: CR-02
    severity: critical
    disposition: open
    title: "登录失败的结果无法上传，即使上传也会被汇总排除，登录达标率因此虚高"
  - id: WR-01
    severity: warning
    disposition: open
    title: "PocketBase 的数字字段缺值时存成 0，汇总把“没测到”当成真实的 0"
  - id: WR-02
    severity: warning
    disposition: open
    title: "verify-site 的 F-11 用不存在的记录 id，无法证明 view、update、delete 规则是锁死的"
  - id: WR-03
    severity: warning
    disposition: open
    title: "重复记录没有去重；同一页面第二次测试会复用首次加载的计时"
  - id: WR-04
    severity: warning
    disposition: open
    title: "上传失败后结果只能靠截图，没有本地留存或更久的重试"
  - id: WR-05
    severity: warning
    disposition: open
    title: "schema-check 不验证迁移里最关键的安全设置，“SCHEMA MATCH”会给出虚假的放心"
  - id: WR-06
    severity: warning
    disposition: open
    title: "redact.mjs 在 private 文件存在但没有任何值时放行原文（fail open）"
  - id: WR-07
    severity: warning
    disposition: open
    title: "01-swap.sh 在 swap 已启用时直接退出，不补写 fstab（只在重跑时有影响）"
  - id: WR-08
    severity: warning
    disposition: open
    title: "04-start-pocketbase.sh 的失败路径只 stop 不 disable，重跑也不会重启服务（只在重跑时有影响）"
  - id: WR-09
    severity: warning
    disposition: open
    title: "05-nginx-probe.sh 没有 ERR trap，中途出错会留下半改状态（只在重跑时有影响）"
  - id: WR-10
    severity: warning
    disposition: open
    title: "探针账号口令公开，任何人都能无限新建 probe_results，汇总没有异常检测"
  - id: IN-01
    severity: info
    disposition: open
    title: "源码里含字面的 BOM 字符"
  - id: IN-02
    severity: info
    disposition: open
    title: "PRIVACY.md 章节顺序是 7、9、8"
  - id: IN-03
    severity: info
    disposition: open
    title: "redact.mjs 和 verify-site.mjs 只在当前仓库根目录找 private/，与 privacy-check 不一致"
  - id: IN-04
    severity: info
    disposition: open
    title: "verify-site.mjs 用 process.exit 结束，输出被管道时最后几行可能丢失"
  - id: IN-05
    severity: info
    disposition: open
    title: "F-13 的“收到推送”条件会被别人的打点满足"
  - id: IN-06
    severity: info
    disposition: open
    title: "README 里的超级用户命令把口令放在了命令行参数里"
  - id: IN-07
    severity: info
    disposition: open
    title: "nginx 片段的两个小缺口"
  - id: IN-08
    severity: info
    disposition: open
    title: "anchor-block.awk 的边界和 05 脚本里没有用到的变量"
  - id: IN-09
    severity: info
    disposition: open
    title: "上传目录放在固定的 /tmp 路径，核对哈希到 sudo 使用之间有窗口（只在重跑时有影响）"
  - id: IN-10
    severity: info
    disposition: open
    title: "隐私检查器规则 C 和 G 的两个放行口子"
  - id: IN-11
    severity: info
    disposition: open
    title: "02-install-pocketbase.sh 的头注释与实际顺序不符（只在重跑时有影响）"
  - id: IN-12
    severity: info
    disposition: open
    title: "privacy-check 静默忽略不以 -- 开头的多余参数"
open: 24
total: 24
recorded: 2026-11-08T18:15:37.821Z
---

# Phase 06: Code Review Disposition

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
| WR-08 | warning | open | - |
| WR-09 | warning | open | - |
| WR-10 | warning | open | - |
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
| IN-12 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
