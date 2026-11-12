// backup-watch.pb.js —— 备份看门狗（Phase 13，13-05，OPS-01；D-06 的第二半）
//
// 用途：PocketBase 自带的自动备份失败时会给所有超级用户发邮件（D-06 的第一半）。这个钩子补上另一种情况：
// 备份任务没有报错、但已经连续两天没有新的自动备份（例如备份被停掉、存储桶换了、清理把新备份删了）。
// 每天检查一次：自动备份列表为空，或最新一份超过 40 小时，就给所有超级用户发一封「计划手记：备份异常」邮件。
// 有新备份时不发邮件；发信失败只记日志，不让进程崩溃。
//
// 它只覆盖“PocketBase 在运行、但备份没做成”这一种情况：服务器整台不在时，这个钩子也不在。
// 验收清单里的“第二天去 R2 看有没有新备份”是人工兜底。
//
// 收件人在运行时从 _superusers 里取，仓库里没有任何邮箱；发件人用所有者在后台填的 meta.senderAddress。
// cron 按 UTC 计算：20:30 UTC 比 19:00 UTC 的自动备份晚 1.5 小时。
// JSVM 里处理函数看不到外层变量，所以所有逻辑（包括 STALE_H）都写在 cronAdd 的回调里。
cronAdd("usj-backup-watch", "30 20 * * *", () => {
  const STALE_H = 40 // 昨天没备份约 25 小时，连续两天没备份约 49 小时
  let newest = 0
  let problem = ""
  try {
    const fsys = $app.newBackupsFilesystem()
    try {
      for (const f of fsys.list("@auto_pb_backup_")) newest = Math.max(newest, f.modTime.unix())
    } finally {
      fsys.close()
    }
    const ageH = (Date.now() / 1000 - newest) / 3600
    if (newest === 0) problem = "备份列表里没有任何自动备份"
    else if (ageH > STALE_H) problem = "最近一份自动备份已是 " + Math.round(ageH) + " 小时前"
  } catch (e) {
    problem = "无法读取备份列表：" + e
  }
  if (!problem) return

  try {
    const to = $app.findAllRecords("_superusers").map((r) => ({ address: r.email() }))
    const s = $app.settings().meta
    $app.newMailClient().send(new MailerMessage({
      from: { address: s.senderAddress, name: s.senderName },
      to: to,
      subject: "计划手记：备份异常",
      text: problem,
    }))
  } catch (e) {
    $app.logger().error("backup-watch: 发邮件失败", "error", String(e))
  }
})
