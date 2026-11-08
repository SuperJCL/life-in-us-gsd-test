// probe_schema.js —— 探针站点的集合、规则和设置（Phase 6，06-06，D-13）
//
// 用途：PocketBase 启动时自动执行。03-configure-pocketbase.sh 把它安装成 <时间戳>_probe_schema.js。
// 字段和规则以 tools/probe/schema.json 为准，本机用
//   node tools/probe/schema-check.mjs --migration tools/probe/server/pb_migrations/probe_schema.js
// 比对，必须输出 SCHEMA MATCH migration。改字段先改 schema.json，不要只改这里。
// 不含任何凭据；探针账号在另一个迁移文件里（probe_user.js.tpl，服务器上生成）。
migrate((app) => {
  // 1) 内置 users：关掉自助注册、自助修改和自助删号（默认 createRule 为空字符串 = 任何人都能注册；
  //    updateRule 不收的话，拿到公开口令的人能改掉探针账号的口令）
  const users = app.findCollectionByNameOrId("users")
  users.createRule = null
  users.updateRule = null
  users.deleteRule = null
  app.save(users)

  // 2) 探针结果：登录的探针账号只能新建，不能列出、查看、修改、删除
  //    数字和布尔字段不设 required（数字的“必填”意味着非零，drops = 0、login_ok = false 会被拒）
  app.save(new Collection({
    type: "base",
    name: "probe_results",
    listRule: null,
    viewRule: null,
    createRule: "@request.auth.id != \"\"",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "run_id", required: true, max: 40 },
      { type: "select", name: "carrier", required: true, maxSelect: 1, values: ["telecom", "unicom", "mobile", "us"] },
      { type: "select", name: "net", required: true, maxSelect: 1, values: ["cell4g", "home", "other"] },
      { type: "select", name: "browser", maxSelect: 1, values: ["chrome", "safari", "edge", "firefox", "wechat", "other"] },
      { type: "text", name: "started_at", max: 40 },
      { type: "number", name: "tz_offset_min", min: -840, max: 840 },
      { type: "number", name: "dur_s", min: 0, max: 3600 },
      { type: "text", name: "nav_type", max: 20 },
      { type: "text", name: "fs_src", max: 20 },
      { type: "number", name: "first_screen_ms", min: 0, max: 600000 },
      { type: "number", name: "ttfb_ms", min: 0, max: 600000 },
      { type: "number", name: "load_ms", min: 0, max: 600000 },
      { type: "number", name: "dns_ms", min: 0, max: 600000 },
      { type: "number", name: "connect_ms", min: 0, max: 600000 },
      { type: "number", name: "tls_ms", min: 0, max: 600000 },
      { type: "number", name: "sdk_ms", min: 0, max: 600000 },
      { type: "number", name: "api_rtt_ms", min: 0, max: 600000 },
      { type: "number", name: "login_ms", min: 0, max: 600000 },
      { type: "bool", name: "login_ok" },
      { type: "number", name: "rt_connect_ms", min: 0, max: 600000 },
      { type: "number", name: "hidden_ms", min: 0, max: 3600000 },
      { type: "number", name: "drops", min: 0, max: 1000 },
      { type: "number", name: "max_reconnect_ms", min: 0, max: 3600000 },
      { type: "number", name: "pings_ok", min: 0, max: 100 },
      { type: "number", name: "pings_total", min: 0, max: 100 },
      { type: "json", name: "push_ms", maxSize: 4000 },
      { type: "json", name: "events", maxSize: 20000 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  }))

  // 3) 打点：登录的探针账号可以新建，也可以订阅（订阅走 listRule 和 viewRule）；不能修改、删除；只有合成数据
  app.save(new Collection({
    type: "base",
    name: "probe_pings",
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.id != \"\"",
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "run", required: true, max: 40 },
      { type: "number", name: "seq", min: 0, max: 100 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
  }))

  // 4) 设置：日志只留 2 天、不记 IP、不记 authId；把 X-Real-IP 当作用户真实 IP（nginx 会设置这个头）；
  //    打开 PocketBase 自带的限流
  const s = app.settings()
  s.logs.maxDays = 2
  s.logs.logIP = false
  s.logs.logAuthId = false
  s.trustedProxy.headers = ["X-Real-IP"]
  s.rateLimits.enabled = true
  app.save(s)
}, (app) => {
  // 探针站点可以重装（Phase 13 正式部署时整体重装），所以不写回滚。
})
