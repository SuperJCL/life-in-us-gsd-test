# Phase 6 外部 API 覆盖决定

本阶段对接的外部 API 是 PocketBase 0.41.1 服务端（经 nginx 同源访问）和 PocketBase JS SDK 0.28.1（探针页同源托管的 iife 文件）。探针只用到下表里标为 INTEGRATE 的能力；其余能力与“测线路、测登录、测实时推送”无关，明确不接入。

| capability | decision | reason |
|------------|----------|--------|
| `GET /api/health`（健康检查） | INTEGRATE | 探针页测接口往返 5 次取中位数；verify-site F-06、状态脚本 PB_HEALTH（06-05、06-07） |
| `users` 集合 `auth-with-password`（SDK `collection('users').authWithPassword`） | INTEGRATE | D-09 的登录计时；verify-site F-09、F-14（限流 429）（06-05、06-07） |
| `probe_results` 记录创建（SDK `collection('probe_results').create`） | INTEGRATE | D-09 结果上传；verify-site F-10（06-05、06-07） |
| `probe_pings` 记录创建 | INTEGRATE | “自己写、自己收”的定时打点（06-05、06-07） |
| 实时订阅 `GET/POST /api/realtime`（SDK `realtime.subscribe`、`PB_CONNECT`、`onDisconnect`、带 filter 的集合订阅） | INTEGRATE | D-07 的实时连接与重连测量；verify-site F-13（06-05、06-07） |
| SDK `pb.filter()`、`autoCancellation(false)`、`authStore.clear()` | INTEGRATE | 订阅过滤、避免请求互相取消、每次真登录（06-05） |
| 记录列表、查看、修改、删除（probe_results、users） | INTEGRATE（只做反向验证） | 规则必须拒绝：verify-site F-08、F-11、F-12 断言非 2xx（06-07）；探针页本身不调用 |
| 后台 `/_/` 与 `_superusers` 认证 | INTEGRATE（只做可达性和限流验证） | D-13 探针阶段对公网开放；verify-site F-07 断言 200；超级用户由所有者在网页终端用 CLI 创建（D-05） |
| PocketBase CLI `superuser upsert`、`serve`、`--version` | INTEGRATE | 安装、启动和超级用户创建（06-06、06-07、06-08） |
| JS 迁移（`migrate`、`new Collection`、`app.settings()`） | INTEGRATE | 集合、规则、日志保留、代理头、限流都写在迁移里（06-06） |
| 文件上传与文件字段（`/api/files`） | OPT-OUT | 探针不需要上传文件 |
| OAuth2 登录、OTP、MFA | OPT-OUT | 探针只需要一个合成账号的口令登录；两步验证属于 Phase 13 的后台加固 |
| 邮件（验证邮件、找回口令、改邮箱） | OPT-OUT | 探针站点不配 SMTP，账号由迁移直接设为已验证 |
| 批量请求 `/api/batch` | OPT-OUT | 探针每次只写一条记录 |
| 超级用户管理 API（集合管理、设置、备份、日志、SQL 控制台） | OPT-OUT | 配置全部走迁移；结果用只读导出脚本取，不经管理 API |
| PocketBase 钩子（`pb_hooks`、`cronAdd`） | OPT-OUT | 打点由页面自写自收完成，不需要服务器端代码 |
| SDK `authRefresh`、`collection().getList/getOne` 等读取接口 | OPT-OUT | 探针账号按规则读不到结果；会话保持和读取属于 Phase 9 |
