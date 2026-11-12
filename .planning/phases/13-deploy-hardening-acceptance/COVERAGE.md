# Phase 13 外部 API 覆盖决定

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

本阶段对接的外部接口有四类：PocketBase 0.41.1 服务端（管理 API、JSVM 钩子 API、命令行，经 nginx 同源访问或在服务器本机调用）、Cloudflare R2（S3 兼容，只经 PocketBase 内置的备份功能访问）、所有者邮箱的 SMTP（只经 PocketBase 的邮件功能访问）、浏览器的 Service Worker / Cache Storage / Web App Manifest 接口。应用本身的记录读写、实时同步和 SDK 用法在 Phase 9–12 已接入，本阶段不改。

| capability | decision | reason |
|---|---|---|
| PocketBase `GET/PATCH /api/settings`（日志、限流、trustedProxy、备份、SMTP、S3） | INTEGRATE | 13-04 本机核对和改设置；13-06 恢复演练里关临时实例的 cron 和 SMTP；线上的无密钥设置由迁移下发，含密钥的由所有者在后台填（D-02、D-04） |
| PocketBase JS 迁移里的 `app.settings()`、`app.save()`、`app.findCollectionByNameOrId`、`app.delete`、记录查找 | INTEGRATE | 服务器设置迁移和探针清理迁移（13-04） |
| PocketBase 备份 API（`GET /api/backups`、`POST /api/backups`、`DELETE /api/backups/{key}`、`POST /api/backups/{key}/restore`） | INTEGRATE | 恢复演练（13-06 脚本、13-11 运行）；13-04 本机列出自动备份 |
| PocketBase 备份下载（`GET /api/backups/{key}?token=`） | OPT-OUT | D-05：真实数据不下载到所有者或 Claude 的电脑；访问日志不记查询串（13-06） |
| PocketBase 定时任务 API（`GET /api/crons`、`POST /api/crons/{id}`） | INTEGRATE | 13-04 在本机实例上运行看门狗和内置自动备份任务 |
| PocketBase 日志 API（`GET /api/logs`） | INTEGRATE | 13-04 核对日志记的是代理头给的 IP（只输出布尔） |
| PocketBase `_superusers` 口令登录（`auth-with-password`） | INTEGRATE | 13-04 本机和 13-07 线上的限流阈值检查；恢复演练的临时超级用户 |
| PocketBase 超级用户 OTP / MFA（`request-otp`、`auth-with-otp`、集合选项） | INTEGRATE | D-01：所有者在后台打开并用邮件验证码登录（13-10）；脚本只读开关状态 |
| PocketBase 命令行 `serve`、`superuser upsert`、`superuser otp`、`--version`、`--encryptionEnv`、`--origins`、`--hooksPool`、`--automigrate` | INTEGRATE | unit、pb-admin.sh、恢复演练、钥匙轮换演练（13-04、13-05、13-06） |
| PocketBase JSVM 钩子 API（`cronAdd`、`$app.newBackupsFilesystem()`、`fsys.list`、`$app.findAllRecords`、`$app.newMailClient().send`、`MailerMessage`、`$app.logger()`） | INTEGRATE | 备份看门狗（D-06，13-04） |
| PocketBase `GET /api/health`、`/api/realtime`、匿名记录创建与列表 | INTEGRATE | 健康检查和线上核对（13-05、13-07、13-09） |
| PocketBase 集合导入导出 API、集合增删改 API | OPT-OUT | 集合结构只经迁移文件下发（Phase 8 已定），后台不手改；`--automigrate=false` |
| PocketBase 文件 API（`/api/files`） | OPT-OUT | 应用没有文件字段 |
| PocketBase OAuth2、普通账号的 OTP/MFA | OPT-OUT | 范围外：3 个普通账号不开两步验证（D-01，账号用的是收不到邮件的假邮箱） |
| PocketBase 超级用户 IP 白名单 | OPT-OUT | 所有者在中美两地使用，不作为默认（RESEARCH Security Domain）；README 写明 |
| PocketBase 批量请求 `/api/batch` | OPT-OUT | 本阶段不新增数据写入路径；限流规则里保留默认的 `/api/batch` 条目 |
| Cloudflare R2：经 PocketBase 的 PutObject、GetObject、ListObjects、DeleteObject | INTEGRATE | 每日备份、保留 30 份时的清理、恢复演练的读写删（D-04、D-05） |
| Cloudflare R2：建桶、API 令牌、生命周期规则 | OPT-OUT | 由所有者在 Cloudflare 控制台操作（D-04），代码不调用 Cloudflare 管理 API |
| SMTP 发信（经 PocketBase 邮件功能） | INTEGRATE | 验证码、备份失败告警、看门狗邮件（D-01、D-02、D-06）；13-04 用本机收件端核对 |
| SMTP 收信 | OPT-OUT | 不需要；所有者自己看邮箱 |
| 浏览器 Service Worker 注册与更新（`register`、`updatefound`、`waiting`、`postMessage`、`skipWaiting`、`controllerchange`、`update()`） | INTEGRATE | D-07、D-08（13-01、13-02） |
| 浏览器 Cache Storage（`caches.open`、`put`、`match`、`keys`、`delete`） | INTEGRATE | 只缓存应用外壳（13-01） |
| Web App Manifest 与 apple-touch-icon | INTEGRATE | 添加到主屏幕（D-09，13-01） |
| `beforeinstallprompt` 自定义安装按钮 | OPT-OUT | 不需要：用浏览器自带的“添加到主屏幕”；iOS 上也没有这个事件 |
| Background Sync、Push、Periodic Sync | OPT-OUT | 范围外：离线上传沿用 Phase 10 的页面内重试，不做推送 |
| CSP 违规上报（`report-to` / `report-uri`） | OPT-OUT | 不需要服务器端收集；测试里用 `securitypolicyviolation` 事件和 verify-site 核对 |
