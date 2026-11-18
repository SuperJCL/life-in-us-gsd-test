---
phase: 13
review: 13-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "06 先换页面再 reload nginx，窗口内的新页面带着旧 CSP，而 SW 预缓存可能把这份坏页面永久缓存"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "外壳版本号不包含 CSP 头，只改 CSP 策略的发布不会到达老用户"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "03 只要有工具文件变化就要求停掉线上 PocketBase"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "迁移清单在 6 处硬编码，新增迁移会被静默漏装，而本机检查却会测到它"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "README 第 8 节写的 PocketBase 升级办法，被 02 自己拒绝，也过不了 C-10"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "README 说 HSTS 之后改一下头文件就行，但 verify-site 和 server-check 都把 86400 写死了"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "恢复演练可以空转通过：不检查备份新旧，也不要求真的逐份比对过文档"
  - id: WR-08
    severity: warning
    disposition: fixed
    title: "04 覆盖旧 unit 时不留备份，README 的回滚步骤「恢复旧 unit 文件」无处可恢复"
  - id: IN-01
    severity: info
    disposition: fixed
    title: "导入真实数据之后恢复演练永久被守卫挡住，Phase 16 之后没有任何办法再证明「备份能恢复」"
  - id: IN-02
    severity: info
    disposition: fixed
    title: "点「点此更新」后如果 SKIP_WAITING 没有引发 controllerchange，横幅会一直停在「正在更新…」且按钮不可点"
  - id: IN-03
    severity: info
    disposition: skipped
    title: "备份看门狗在没配好 SMTP 时静默，首次部署当天还会误报"
  - id: IN-04
    severity: info
    disposition: fixed
    title: "nginx 错误日志会记完整请求行，包括后台下载备份链接里的 `?token=`"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "`process.env.TEMP = undefined` 会变成字符串 \"undefined\""
  - id: IN-06
    severity: info
    disposition: fixed
    title: "SW 的 activate 删除源下所有不叫当前名字的缓存，并且「不留半套缓存」的注释不准确"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "测试静态服务器的版本开关是一个会改状态的 GET"
  - id: IN-08
    severity: info
    disposition: fixed
    title: "manifest 的 description 与 name 相同，是升级演练留下的占位"
  - id: IN-09
    severity: info
    disposition: fixed
    title: "verify-site 的 F-11 在锁定失效时会在线上真的创建一个账号"
  - id: IN-10
    severity: info
    disposition: fixed
    title: "inlineBlocks 的 `\\bsrc=` 判断会把 `data-src=` 之类的属性误当成外部脚本"
  - id: IN-11
    severity: info
    disposition: fixed
    title: "若干文档和测试里的陈旧引用与重复常量"
open: 0
total: 19
recorded: 2026-11-17T20:06:48.636Z
---

# Phase 13: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | fixed | Phase 16 16-01（b070095）：06 分两步 reload 切换 CSP——先装新旧哈希合并的过渡 CSP 并 reload，换符号链接，再装只含新哈希的最终 CSP 并 reload；任何时刻页面都能在当时的 CSP 下运行；README 第 8 节写明部署后立刻跑 --stage full |
| WR-02 | warning | fixed | Phase 16 16-02（d471fff）：shellVersion 把 CSP 头文本也算进去，自检加“只改 buildCsp 的一个指令，版本号就变” |
| WR-03 | warning | fixed | Phase 16 16-01（2603994）：03 只在迁移、钩子、环境文件要变时才要求先停 PocketBase，pb-admin.sh 和 restore-drill.sh 的安装放到这个检查之外 |
| WR-04 | warning | fixed | quick 261117-lwq (8e7e92a): build-site 自动收集迁移，server-check C-23 守住 03、04、00-status 和 README 的清单 |
| WR-05 | warning | fixed | Phase 16 16-02（9f5cf0f）：README 第 8 节如实说明 PocketBase 本体升级目前没有脚本，不做升级自动化 |
| WR-06 | warning | fixed | Phase 16 16-02（043df17）：HSTS 期望值提成常量 HSTS_MAX_AGE，verify-site 和 server-check 共用，数值仍是一天 |
| WR-07 | warning | fixed | Phase 16 16-01（f82b915）：三处都修了——备份超过 40 小时就失败；至少比对 1 份文档（compared 为 0 就失败）；按快照边界比对，线上已删除的文档单独计入 DRILL_DOCS_MISSING_LIVE，不混进 mismatch。残留：BACKUP_TS 只在恢复库是空的时候作退路，这条路上没有文档可比、compared 为 0，演练必然 FAIL，不会造成假通过 |
| WR-08 | warning | fixed | Phase 16 16-01（2603994）：04 覆盖 unit 文件之前先备份成 pocketbase.service.usj-backup.<UTC 时间戳>，失败时放回；README 第 9 节的回滚步骤与之对应 |
| IN-01 | info | fixed | quick 261117-lwq (d6dc94e): 恢复演练加导入后模式 --with-real-data（所有者 2026-11-17 选择），Phase 16 部署时装到服务器 |
| IN-02 | info | fixed | Phase 16 16-03（2866882）：点「点此更新」后 4 秒内没被接管就兜底刷新一次，并重新记录 APP_SHA256 |
| IN-03 | info | skipped | Phase 16 D-01：不改代码；首日误报已不适用（已经部署过），次日看 R2 和邮箱放在 16-ACCEPTANCE 的 L-1 |
| IN-04 | info | fixed | Phase 16 16-02（9f5cf0f）：README 第 2 节写明错误日志在上游出错时会带 ?token=（短时有效） |
| IN-05 | info | fixed | Phase 16 16-02（d471fff）：server-config-check 新增 restoreEnv，恢复环境变量时原来没有的键被删掉，不再写成字符串 undefined |
| IN-06 | info | fixed | Phase 16 16-03（6c26e3c）：sw.js 的 activate 只删自己的 usj-shell- 旧缓存，安装失败时删半套缓存，注释与行为一致 |
| IN-07 | info | fixed | Phase 16 16-03（6c26e3c）：测试静态服务器的版本开关要带 x-usj-test 头，没有头回 403 且不改版本 |
| IN-08 | info | fixed | Phase 16 16-03（6c26e3c）：manifest 删掉 description，不新增需要所有者过目的文案 |
| IN-09 | info | fixed | Phase 16 16-02（9f5cf0f）：verify-site 的 F-11 改用缺字段的注册请求，不再可能在线上创建账号（本机实例实测锁住 403、放开 400） |
| IN-10 | info | fixed | Phase 16 16-02（d471fff）：inlineBlocks 的外部脚本判断改成要求 src 前是空白，data-src 之类的属性仍算内联块 |
| IN-11 | info | fixed | Phase 16 16-02（d471fff、9f5cf0f）和 16-03（5f46303）：deploy-tools 用例从 BUNDLE_COUNT 算文件数，README、PRIVACY、tests/README 和 site-assets 注释的陈旧引用改与现状一致，验收清单引用改指 16-ACCEPTANCE |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
