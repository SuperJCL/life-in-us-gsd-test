// probe_user.js.tpl —— 合成探针账号的迁移模板（Phase 6，06-06）
//
// 只有占位，没有任何真实值。03-configure-pocketbase.sh 在服务器上用随机生成的值替换下面代码里的
// 邮箱和口令两个占位，装成 <时间戳+1>_probe_user.js（pocketbase 所有，权限 0600）。
// 这个账号的口令本来就是公开的（探针页的 config.js 里能读到），权限靠 probe_schema.js 里的规则收到最小：
// users 不能注册、修改、删除；探针账号只能新建结果、新建和订阅打点、读自己的用户记录。
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")
  const record = new Record(users)
  record.setEmail("__PROBE_EMAIL__")
  record.setPassword("__PROBE_PASSWORD__")
  record.setVerified(true)
  app.save(record)
}, (app) => {
  // 探针站点可以重装，不写回滚。
})
