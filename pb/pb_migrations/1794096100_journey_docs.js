// 1794096100_journey_docs.js —— journey_docs 集合（Phase 8，08-01，ACCT-04）
//
// 只有结构，不含任何记录、账号、邮箱、口令或令牌；Phase 13 原样复制到服务器。
// 本机用 node tools/pb/migration-check.mjs 比对（沙箱执行本文件，结果与 pb/rules.expected.json 一致）。
migrate((app) => {
  const users = app.findCollectionByNameOrId("users")

  app.save(new Collection({
    type: "base",
    name: "journey_docs",
    // 每个账号只能读写自己的记录；不允许删除（数据不会因为误操作丢失）
    listRule: "@request.auth.id != \"\" && owner = @request.auth.id",
    viewRule: "@request.auth.id != \"\" && owner = @request.auth.id",
    createRule: "@request.auth.id != \"\" && @request.body.owner = @request.auth.id",
    updateRule: "@request.auth.id != \"\" && owner = @request.auth.id && @request.body.owner:isset = false && @request.body.kind:isset = false",
    deleteRule: null,
    fields: [
      { type: "relation", name: "owner", required: true, collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "select", name: "kind", required: true, maxSelect: 1, values: ["state", "plan"] },
      // 不勾 required：JSON 字段的必填会拒绝 {} 之类“看起来为空”的值
      { type: "json", name: "data", maxSize: 4194304 },
      { type: "text", name: "writer", max: 40 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: ["CREATE UNIQUE INDEX `idx_journey_docs_owner_kind` ON `journey_docs` (`owner`, `kind`)"],
  }))
}, (app) => {
  // 不写回滚：本机实例是一次性的，服务器由部署脚本整体重装。
})
