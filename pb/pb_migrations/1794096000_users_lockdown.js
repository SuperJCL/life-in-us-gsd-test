// 1794096000_users_lockdown.js —— users 加固（Phase 8，08-01，ACCT-03、D-04、D-05、D-06）
//
// 只有结构，不含任何记录、账号、邮箱、口令或令牌；Phase 13 原样复制到服务器。
// 本机用 node tools/pb/migration-check.mjs 比对（沙箱执行本文件，结果与 pb/rules.expected.json 一致）。
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  // 注册和删号关闭（默认 createRule 是空字符串 = 任何人都能注册）
  users.createRule = null
  users.deleteRule = null
  // 只看自己；本人只能改密码，不能改 verified、emailVisibility
  users.listRule = "id = @request.auth.id"
  users.viewRule = "id = @request.auth.id"
  users.updateRule = "id = @request.auth.id && @request.body.verified:isset = false && @request.body.emailVisibility:isset = false"
  users.manageRule = null

  // 只开邮箱加密码登录；OAuth2、OTP、MFA 明确关闭
  // authAlert 默认开启：新设备登录时 PocketBase 会尝试发提醒邮件，这里没有邮件配置，关掉
  users.passwordAuth.enabled = true
  users.passwordAuth.identityFields = ["email"]
  users.oauth2.enabled = false
  users.otp.enabled = false
  users.mfa.enabled = false
  users.authAlert.enabled = false

  // 90 天（秒）；PocketBase 允许范围 10 到 94670856
  users.authToken.duration = 7776000

  // 删掉 name、avatar：本人能改的只剩密码（D-05 修订），并去掉文件上传入口
  users.fields.removeByName("name")
  users.fields.removeByName("avatar")

  app.save(users)
}, (app) => {
  // 不写回滚：本机实例是一次性的，服务器由部署脚本整体重装。
})
