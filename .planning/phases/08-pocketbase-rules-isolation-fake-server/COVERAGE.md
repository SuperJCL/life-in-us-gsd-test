# API Coverage — PocketBase 0.41.1 服务端与 JS SDK 0.28.1（Phase 8）

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
>
> 本阶段对接的外部 API 有两样：一次性本机实例上的 PocketBase 0.41.1 服务端（隔离脚本、样本录制），以及同源提供的 JS SDK 0.28.1（cloud 测试模式里真实运行，连到 Node 侧假服务器）。下表的 INTEGRATE 指本阶段的迁移、隔离脚本、样本、假服务器或 cloud 用例里实际用到或实际断言的能力；“只做反向验证”表示断言它必须被拒绝。所有者的服务器在本阶段完全不碰。

| capability | decision | reason |
|---|---|---|
| `GET /api/health` | INTEGRATE | 一次性实例的就绪检查（08-04 instance.mjs） |
| `users` 的 `auth-with-password`（SDK `collection('users').authWithPassword`） | INTEGRATE | 隔离脚本登录、ACCT04-24；样本 auth-ok、auth-bad-password；假服务器与 cloud 用例的登录（08-02、08-05、08-06） |
| `users` 的 `auth-refresh`（SDK `authRefresh`） | INTEGRATE | TOK-2、D5-1 的令牌失效；样本 refresh-ok、refresh-invalid-token（唯一会返回 401 的接口）；假服务器（08-02、08-05、08-06） |
| `journey_docs` 记录列表、查看、创建、更新（SDK `getFullList`、`getList`、`getOne`、`create`、`update`） | INTEGRATE | 隔离矩阵 ACCT04；样本；假服务器和 cloud 用例的读写（08-02、08-05、08-06） |
| `journey_docs` 记录删除 | INTEGRATE（只做反向验证） | deleteRule 为 null，ACCT04-5、ACCT04-6 断言 403；样本 delete-own；假服务器同样 403 |
| `users` 记录列表、查看 | INTEGRATE | ACCT04-21、ACCT04-22（只能看自己）；假服务器不实现（样本没有，未实现路径由护栏报违规） |
| `users` 记录更新（本人改密码，必须带 `oldPassword`） | INTEGRATE | D-05 修订：D5-1 到 D5-5；改邮箱、改 `verified` 必须被拒；假服务器不实现，本阶段没有界面（D-07） |
| `users` 记录创建、删除 | INTEGRATE（只做反向验证） | ACCT03-1 到 ACCT03-4 断言 403；ACCT03-5 在临时开放集合上做反向对照 |
| 实时连接 `GET /api/realtime`、`PB_CONNECT`、`POST /api/realtime` 订阅（SDK `subscribe`、`unsubscribe`，含 `fields` 选项和单条订阅） | INTEGRATE | RT-1 到 RT-6（journey_docs）、RT-7（A 订阅 `users/*` 和 B 的单条主题收不到 B 的账号记录事件；NEG-1 在 users_leaky 上做反向对照）；样本 realtime-connect、realtime-subscribe、realtime-update-fields、realtime-create-full；假 `EventSource` 和假服务器的订阅（08-02、08-05、08-06） |
| `_superusers` 的 `auth-with-password` | INTEGRATE | 隔离脚本的超级用户回读；ACCT04-25 断言普通账号凭据登录失败 |
| 集合管理 API（`GET /api/collections/<name>`、`POST /api/collections`） | INTEGRATE（只由超级用户调用） | 规则快照与重放对比（REPLAY-1、instance smoke）、TOK-1；临时开放集合 ACCT03-5 和泄漏集合 NEG-1；ACCT04-25 断言普通账号 401/403 |
| 设置 API `GET /api/settings`、`PATCH /api/settings` | INTEGRATE（只由超级用户调用） | instance smoke 记录新实例限流默认值的观察值（研究 A2，`INFO rate-limits-default` 行，不作为通过条件）；ensureRateLimitsOff 只在临时实例上关闭限流，smoke 的 `rate-limits-off` 回读断言已关闭（通过条件）；ACCT04-25 断言普通账号 401/403 |
| 日志、备份 API（`/api/logs`、`/api/backups`） | INTEGRATE（只做反向验证） | ACCT04-25 断言普通账号 401/403；本阶段不读日志、不做备份 |
| 系统集合 `_authOrigins`、`_externalAuths` 的列表 | INTEGRATE（只做反向验证） | ACCT04-26：A 列不出 B 的记录 |
| PocketBase 命令行 `serve`（`--http=127.0.0.1:<端口>`、`--dir`、`--migrationsDir`、`--hooksDir`、`--automigrate=false`）、创建超级用户的子命令 | INTEGRATE | 一次性实例的启动和超级用户（08-04）；超级用户口令运行时随机，只走参数数组 |
| JS 迁移（`migrate`、`new Collection`、`findCollectionByNameOrId`、`fields.removeByName`、认证集合选项） | INTEGRATE | `pb/pb_migrations/` 的两个迁移文件（08-01），在真实实例上应用并对比快照 |
| SDK `authStore`（`isValid`、`clear`）、`autoCancellation`、`ClientResponseError` | INTEGRATE | cloud 用例检查登录状态、自动取消不让用例失败、错误形状（08-02） |
| OAuth2 登录、OTP、MFA | OPT-OUT | 迁移里显式关闭（ACCT-03 只允许所有者在后台开账号）；快照断言三者都是关闭的 |
| 邮件流程（`request-verification`、`request-password-reset`、`request-email-change`、`confirm-email-change`） | OPT-OUT | D-05 修订：邮箱只由所有者在后台改，地址不真实、不配 SMTP；密码由所有者在后台重置（REQUIREMENTS Out of Scope） |
| `GET /api/collections/users/auth-methods`（SDK `listAuthMethods`） | OPT-OUT | not needed：登录方式固定为邮箱加密码，应用和测试都不需要查询 |
| 超级用户代登录（impersonate） | OPT-OUT | not needed：隔离脚本用超级用户令牌回读即可，不需要代登录 |
| 文件 API `/api/files` 与文件字段 | OPT-OUT | `users.avatar` 在迁移里删除，`journey_docs` 没有文件字段 |
| 批量请求 `/api/batch` | OPT-OUT | not needed：每次保存只写一份文档 |
| 定时任务与钩子（`pb_hooks`、`cronAdd`） | OPT-OUT | 隔离和同步都不需要服务器端代码；一次性实例的 `--hooksDir` 指向空的临时目录 |
| SDK 的 `files`、`backups`、`logs`、`crons`、`settings`、`health` 服务 | OPT-OUT | 都是超级用户或运维接口，应用和 cloud 用例不调用；实例健康检查用裸 `fetch` |
