// 1794096150_retire_probe.js —— 探针清理迁移（Phase 13，13-05，D-10 的“保留路线”）
//
// 用途：Phase 6 的探针站点在服务器上留下了两个集合（probe_pings、probe_results）和一个合成探针账号。
// 所有者在 13-09 选择“保留 Phase 6 的数据库和超级用户”时，把本迁移和应用迁移一起装上去，
// PocketBase 第一次启动就把它们删掉。所有者选择“清空数据库”时，本迁移在全新库上什么也不做。
//
// 只删什么：
//   - 集合 probe_pings、probe_results（不存在就跳过）；
//   - users 里邮箱严格匹配 probe-<8 位十六进制>@example.com 的记录，删之前再用正则核对一次。
// 不删别的用户：真实账号用的是所有者自己的地址，不会匹配。
//
// 本机演练：node deploy/server-config-check.mjs --local retire（按服务器上的真实顺序：探针迁移先应用、
// 文件删掉、再加应用迁移和本迁移）。
migrate((app) => {
  // 先删打点，再删结果；各自不存在就跳过
  for (const name of ["probe_pings", "probe_results"]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch (e) {
      // 集合不存在：全新库，什么也不做
    }
  }

  // 探针账号：先按过滤条件取候选，再用严格正则二次核对
  const PROBE = /^probe-[0-9a-f]{8}@example\.com$/
  let candidates = []
  try {
    candidates = app.findRecordsByFilter("users", "email ~ 'probe-' && email ~ '@example.com'", "", 0, 0)
  } catch (e) {
    // users 集合不存在或没有候选：什么也不做
  }
  for (const record of candidates) {
    if (PROBE.test(record.email())) app.delete(record)
  }
}, (app) => {
  // 不写回滚：被删的只是合成探针数据。
})
