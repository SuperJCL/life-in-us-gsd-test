// 1794096200_server_settings.js —— 服务器设置迁移（Phase 13，13-05，SEC-02、OPS-01；D-01、D-03、D-04）
//
// 用途：PocketBase 首次启动时自动执行，把线上服务器的日志、限流、代理 IP 头、备份计划和应用名一次定好。
// 不含任何凭据：SMTP 账号口令、发件人地址、S3（R2）凭据和端点、超级用户邮箱都由所有者在后台填（D-02），
// 所以本文件里没有这些项。
//
// 为什么放在 deploy/pb_migrations/，而不是 pb/pb_migrations/：
//   后者是本机一次性实例、pb/rules.expected.json 和隔离脚本共用的“应用契约”；打开限流会干扰隔离脚本。
// 为什么这里不打开超级用户的 OTP / MFA：
//   要等所有者在后台收到测试邮件之后再手动打开，否则邮件发不出去会把人锁在门外（13-12）。
// 时间：PocketBase 的 cron 一律按 UTC 计算，19:00 UTC = 北京时间 03:00；服务器时区不用改。
// trustedProxy 的头名必须与 nginx 的 proxy_set_header X-Real-IP $remote_addr 一致（13-07）。
// 以后要改：加一个新时间戳的迁移，或由所有者在后台改。
migrate((app) => {
  const s = app.settings()

  // 日志：留 30 天、记客户端 IP、不记账号 id（D-03）
  s.logs.maxDays = 30
  s.logs.logIP = true
  s.logs.logAuthId = false

  // 只信 nginx 设置的 X-Real-IP，限流和日志才按真实客户端 IP 算
  s.trustedProxy.headers = ["X-Real-IP"]

  // 限流：后台登录每个 IP 60 秒 5 次（更具体的规则优先）；后四条是 0.41.1 的默认规则，原样保留
  s.rateLimits.enabled = true
  s.rateLimits.rules = [
    { label: "_superusers:auth", duration: 60, maxRequests: 5 },
    { label: "*:auth", duration: 3, maxRequests: 2 },
    { label: "*:create", duration: 5, maxRequests: 20 },
    { label: "/api/batch", duration: 1, maxRequests: 3 },
    { label: "/api/", duration: 10, maxRequests: 300 },
  ]

  // 每天自动备份并保留最新 30 份（D-04）
  s.backups.cron = "0 19 * * *"
  s.backups.cronMaxKeep = 30

  // 自动备份文件名里会带应用名
  s.meta.appName = "usj"

  app.save(s)
}, (app) => {
  // 不写回滚：要改设置就加新迁移。
})
