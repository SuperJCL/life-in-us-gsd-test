# PocketBase 协议契约：服务器 0.41.1 配 SDK 0.28.1

这份文档说明 `tests/mocks/pb-server.ts` 里的假 PocketBase 对齐了哪一版真实协议、实现了哪些端点、明确没实现哪些。依据不是想象，而是从本机真实 PocketBase 0.41.1 一次性实例上录下来的协议样本（`tests/mocks/pb-samples/rest.json` 和 `realtime.json`，共 28 个场景）。结构参照 v1 的 `tests/mocks/CONTRACT.md`。

假服务器只是真实服务器的复述：样本是真相，假服务器与样本不一致时，改假服务器，不改样本。

## 1. 版本

- **服务器 0.41.1 配 SDK 0.28.1。** PocketBase 内部是 SQLite，自带登录、权限和实时同步；本项目只用其中的 `users` 认证集合、`journey_docs` 集合和实时订阅。
- **服务器程序：** 经所有者批准下载的 Windows 版 0.41.1，exe 的 sha256 是 `f44191176f90382d5a03290496b23b333cf64cf6cb2024893cb39f3c10e46f7e`（与 `tools/pb/PB-LOCAL.md` 和 `tools/pb/lib/instance.mjs` 里钉死的值相同）。程序不进仓库，每次运行前核对。
- **SDK：** `tools/probe/page/vendor/pocketbase.iife.js`，sha256 是 `94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f`（与同目录 `SHA256SUMS` 相同）。
- **录制日期：** 2026-11-08（样本文件的 `meta.recordedOn` 同）。
- **录制脚本：** `tools/pb/record-samples.mjs`；**录制客户端：sdk-vm**，即在 `node:vm` 里运行已核对哈希的真实 SDK 0.28.1，请求的形状就是 SDK 发出的形状（研究 A5 成立，没有退回裸 fetch）。订阅请求和实时连接是例外，见第 6 节。
- **SDK 在真实令牌上能用：** 录制时把真实登录得到的令牌装进 SDK 的 `authStore`，`isValid` 为真（样本 `meta.sdkIsValidOnRealToken` 为 true）。假令牌要避开 base64url 字符，见第 5 节。

## 2. 录制方式与归一化

**录制。** 每个场景在一个一次性实例（127.0.0.1 随机端口、系统临时目录、低优先级，用完删除）里新建自己的一组合成账号和文档，场景之间不共享，前置状态只由该场景的 `setup` 决定。场景表是 `tools/pb/lib/scenarios.cjs`，它是录制和 08-07 契约自测共用的唯一输入：同一份场景、同一个 `resolveStep`。每个发请求的步骤带预期状态码 `expect`，录到的状态码与 `expect` 不同时不写任何文件、非零退出，所以样本里的状态码一定与场景意图一致。

**归一化。** 样本先归一化再写盘（`tools/pb/lib/normalize.cjs`，纯函数，录制和契约自测共用）：

| 内容 | 归一化后 | 说明 |
|------|----------|------|
| 令牌（键 `token` 的值，以及字符串里任意三段令牌形状） | `<JWT>` | 另记 `tokenClaims`：载荷的键集合、`type`、四舍五入到整小时的有效期秒数（本集合是 7776000，即 90 天） |
| 口令（键 `password`、`passwordConfirm`、`oldPassword`） | `<PASSWORD>` | 合成口令全部运行时随机 |
| `tokenKey`、`authToken` 里的密钥 | 丢弃 | |
| 记录 id（15 位小写字母数字的整词） | `<ID:n>` | 按首次出现编号，同一个值同一个占位 |
| 时间戳（`YYYY-MM-DD HH:mm:ss.SSSZ`，中间是空格） | `<TS>` | |
| `_pb_users_auth_` | `<USERS_COLLECTION_ID>` | |
| 其他 `pbc_` 加数字的集合 id | `<COLLECTION_ID:n>` | |
| 邮箱 | `user-a@example.com`、`user-b@example.com`… | 按首次出现编号，保留域名 |
| `clientId`（实时） | `<CLIENT_ID>` | 键 `clientId` 和登记过的值都换 |
| 超过 65536 字节的请求体字段 | `<OVERSIZE:字节数>` | 4 MiB 的数据在样本里只记字节数 |
| 请求的 `Authorization` 头 | 只记有没有（`hasAuth`） | 不记值 |

对象的键按字典序处理：服务器返回的键序不稳定（带 `fields` 的事件里每次不同），排序后样本可复现，占位编号也稳定。连续三次录制的结果逐字节相同。

**自检（写盘前的闸门、反向对照、闸门自身的自检）和 `--check`：**

1. 写盘前对整个输出调用隐私检查器导出的 `findTokenShapes`，并检查没有令牌开头的子串；任一命中就不写文件、非零退出。
2. 反向对照（`node tools/pb/record-samples.mjs --self-test`）：用运行时拼接的令牌形状，证明归一化前被命中、归一化后为零。
3. 闸门本身有自检：遇到未归一化的令牌时返回失败并且没有写出文件。
4. `node tools/pb/record-samples.mjs --check` 对样本目录每个文件跑隐私检查器的 `scanText`，规则 B、C、F、G、H 命中为零，并核对场景 id 与场景表一致。

**为什么不加放行名单。** 07 D-04 的决定：所有者不接受放行名单；规则 F 会拦下令牌形状，所以解法是让样本里根本没有令牌，而不是让检查器放行。

## 3. 已实现的端点

每行一个端点和行为，末列是对应的场景 id（样本里有该场景的完整请求和响应）。

| 端点 | 行为 | 场景 id |
|------|------|---------|
| `POST /api/collections/users/auth-with-password` | 成功 200，返回 `token` 和 `record` | auth-ok |
| 同上 | 口令错误 400（不是 401），消息 `Failed to authenticate.` | auth-bad-password |
| `POST /api/collections/users/auth-refresh` | 有效令牌 200，返回新令牌 | refresh-ok |
| 同上 | 无效令牌 401，**这是唯一返回 401 的接口** | refresh-invalid-token |
| `GET /api/collections/journey_docs/records` | 只返回本人的文档，200 | list-own |
| 同上 | 未登录 200 空列表 | list-anonymous |
| 同上 | 无效令牌按未登录处理，200 空列表（不是 401） | list-invalid-token |
| `GET /api/collections/journey_docs/records/<id>` | 本人的 200 | view-own |
| 同上 | 别人的 404 | view-other |
| 同上 | 未登录 404 | view-anonymous |
| `POST /api/collections/journey_docs/records` | 以自己为 owner 创建，200（不是 201） | create-own |
| 同上 | 同一个 kind 再建，400，owner 和 kind 的错误码都是 `validation_not_unique` | create-duplicate-kind |
| 同上 | 以别人为 owner，400，data 为空（拒绝来自创建规则） | create-other-owner |
| 同上 | kind 不在选项里，400，kind 的错误码 `validation_invalid_value` | create-invalid-kind |
| 同上 | 未登录，400 | create-anonymous |
| `PATCH /api/collections/journey_docs/records/<id>` | 只带 data 和 writer，200 | update-own |
| 同上 | 请求体带 owner 键（即使值相同），404 | update-owner-key |
| 同上 | 请求体带 kind 键，404 | update-kind-key |
| 同上 | 别人的文档，404 | update-other |
| 同上 | data 超过 4194304 字节，400，data 的错误码 `validation_json_size_limit` | update-oversize |
| 同上 | writer 超过 40 个字符，400，writer 的错误码 `validation_max_text_constraint` | update-writer-too-long |
| `DELETE /api/collections/journey_docs/records/<id>` | 一律 403，消息 `Only superusers can perform this action.` | delete-own |
| `GET /api/realtime` | 建立 SSE 连接，第一个事件 `PB_CONNECT` | realtime-connect |
| `POST /api/realtime` | 提交订阅，204 | realtime-subscribe |
| 同上 | 没有对应连接的 clientId，404 | realtime-subscribe-unknown-client |
| 同上 | 同一个 clientId 换成别人的令牌再提交，403 | realtime-subscribe-other-identity |
| SSE 事件推送 | 订阅带 `fields` 选项：更新事件的 record 只剩指定字段 | realtime-update-fields |
| SSE 事件推送 | 订阅不带选项：创建事件带完整 record | realtime-create-full |

列表请求的查询参数与 SDK 的 `getFullList` 一致：`page=1&perPage=1000&skipTotal=1`，此时 `totalItems` 和 `totalPages` 都是 -1。

## 4. 明确没实现的

- `users` 记录的列表、查看、更新（包括改密码）、创建、删除。
- 集合、设置、日志、备份等超级用户接口。
- 文件、批量请求、OAuth2、OTP、MFA、邮件流程。
- 网络失败、5xx、SSE 断开、乱序事件（Phase 9、10 按需补）。
- 未实现的路径一律交回护栏，由护栏报违规，不会悄悄返回一个看似正常的响应。

## 5. 假服务器的有意偏差

- 令牌不签名；头和载荷用去掉填充的标准 base64（SDK 的 `isValid` 用原生 `atob` 解码，原生 `atob` 不接受 base64url 里的 `-` 和 `_`，所以假令牌不能用 base64url）。真实令牌没有这个问题，已在录制里用真实令牌验证过。
- 时间用假时钟：从 `FROZEN_NOW` 起，每次写入加 1 毫秒。
- 记录 id 是确定性的，不是随机的 15 位字符。
- 超大请求体在样本里只记字节数。
- **契约自测（08-07，`tests/cloud/pb-contract.spec.ts`）的结论：没有登记任何额外的有意偏差**（`INTENTIONAL_DEVIATIONS` 为空）。28 个场景在状态码、顶层键集合、归一化后的正文和令牌声明上都与真实 0.41.1 样本一致。
- 偏差只能是表示层的；状态码和“拒绝与否”永远不能登记为有意偏差，不一致就改假服务器，不改样本。

契约自测发现并已改掉的差异（都是假服务器按源码记忆写错的细节，已对齐样本）：

| 场景 | 差异 | 修正 |
|------|------|------|
| list-own | 假服务器按创建顺序返回，样本里后建的 plan 排在先建的 state 前面 | 列表新建的在前（更新不改变顺序） |
| create-invalid-kind | kind 的错误缺 `params.value` | 补上 `params: { value }` |
| update-oversize | data 的错误缺 `params.maxSize` | 补上 `params: { maxSize: 4194304 }` |
| update-writer-too-long | writer 的消息是 `Must be less than 40 character(s).`，缺 `params.max` | 消息改为 `Must be no more than 40 character(s).`，补上 `params: { max: 40 }` |

列表顺序只有 list-own 一个两条记录的样本作依据：应用不应依赖列表顺序，要按 `kind` 取 state 和 plan。

## 6. 实时的线上格式

- SSE 的每个事件由 `id:`、`event:`、`data:` 三行加一个空行组成。
- 第一个事件的名字是 `PB_CONNECT`：`id` 是 clientId，`data` 是 clientId 的 JSON（键 `clientId`）。
- 之后 SDK 取 `PB_CONNECT` 事件的 `lastEventId` 作为 clientId，再 `POST /api/realtime`，请求体 `{ clientId, subscriptions: [...] }`；成功是 204，没有响应体。
- 订阅串是 `journey_docs/*`；带选项时是 `journey_docs/*?options=` 加 URL 编码的 `{"query":{"fields":"id,kind,writer,updated"}}`。SDK 0.28.1 提交的订阅列表只含这些订阅串。
- 记录事件的名字是订阅串原样（含 `?options=`）；`data` 是 `{ action, record }` 的 JSON，`action` 是 `create`、`update` 或 `delete`；事件的 `id` 是 clientId。
- `fields` 选项裁剪 record：样本里更新事件的 record 恰好是 id、kind、writer、updated 四个键；不带选项时是完整 record（含 collectionId、collectionName、created、data、id、kind、owner、updated、writer）。
- 订阅提交的错误响应：clientId 未知 404，消息 `Missing or invalid client id.`；同一个 clientId 换身份 403，消息 `The current and the previous request authorization don't match.`。这两条消息 08-02 是按源码记忆写的，现在有真实样本，08-07 复核。
- 录制时 `POST /api/realtime` 用的是录制脚本自己的 fetch，不是 SDK 的实时服务（它需要 `EventSource`）；目的是拿到 404 和 403 的响应体。连接用 `tools/pb/lib/sse-client.mjs` 的 `openSse`。

## 7. 规则语义

拒绝有四种形态，不是统一的 401：

| 形态 | 状态码 | 出现在 |
|------|--------|--------|
| 锁定规则（规则为空值，只有超级用户能做） | 403 | 删除（delete-own）；注册账号、删除账号 |
| 列表规则不满足 | 200，空列表 | list-anonymous、list-invalid-token；别人的记录在列表里被过滤掉（list-own） |
| 查看或更新规则不满足 | 404 | view-other、view-anonymous、update-other、update-owner-key、update-kind-key |
| 创建规则不满足 | 400，data 为空 | create-other-owner、create-anonymous |

- **401 只来自 `auth-refresh`**（refresh-invalid-token）。对记录接口，无效或过期的令牌被当作未登录：列表是 200 空、查看和更新是 404、删除是 403、创建是 400。所以应用判断“登录是否过期”要看 `authRefresh` 的结果或本地令牌的 exp，不能看记录接口的状态码。
- **`:isset = false` 连相同值也拒。** 更新规则里写的是 `@request.body.owner:isset = false` 和 `@request.body.kind:isset = false`，只看请求体里有没有这个键；带原值的 owner 一样是 404（update-owner-key）。所以客户端更新只能发 `data` 和 `writer`。08-05 还实测过带字段修饰符的键（`owner+`、`+owner`、`owner-`、`kind+`）同样是 404，回读不变。
- **唯一冲突：** `(owner, kind)` 有唯一索引；重复创建时 data 里 owner 和 kind 的错误码都是 `validation_not_unique`（create-duplicate-kind）。
- **改密码或后台重置密码会轮换 tokenKey，旧令牌立即失效**：旧令牌的 `auth-refresh` 是 401，新口令登录 200，旧口令登录 400。
- **创建成功的状态码是 200，不是 201**（create-own、realtime-create-full；08-05 的 ACCT03-5 在开放集合上匿名注册成功也是 200）。

以下状态码和错误码来自 08-05 的真实实例实测，已写死进隔离断言：

| 编号 | 行为 | 实测 |
|------|------|------|
| ACCT03-1、-2 | 匿名或已登录账号创建 users 记录 | 403，无字段错误码 |
| ACCT03-3、-4 | A 删除自己或 B 的账号 | 403 |
| ACCT03-5 | 创建规则为空的认证集合上匿名注册 | 200 |
| ACCT04-1、-2 | 列表 | 200，条数按规则过滤 |
| ACCT04-3 | A 查看 B 的文档 | 404 |
| ACCT04-4 | A 更新 B 的文档 | 404 |
| ACCT04-5、-6 | 删除 B 的、自己的文档 | 403 |
| ACCT04-7 | A 以 B 为 owner 创建（槽位空着） | 400，data 为空（没有 `validation_not_unique`，确系规则在挡） |
| ACCT04-8 | A 以自己为 owner 创建已存在的 kind | 400，owner 和 kind 的错误码都是 `validation_not_unique` |
| ACCT04-9 | kind 不在选项里 | 400，kind 的错误码 `validation_invalid_value` |
| ACCT04-10、-11、-12 | 更新时带 owner 为 B、另一种 kind、与原值相同的 owner | 全部 404 |
| ACCT04-13 | 修饰符键 `owner+`、`+owner`、`owner-`、`kind+` | 全部 404，回读不变 |
| ACCT04-14 | 合法 data 和 writer 更新 | 200，`updated` 变了 |
| ACCT04-15 | writer 41 个字符 | 400，writer 的错误码 `validation_max_text_constraint` |
| ACCT04-16 | 3.9 MiB 的 data | 200 |
| ACCT04-17 | 4194304 加 1024 字节的 data | 400，data 的错误码 `validation_json_size_limit` |
| ACCT04-18 | 未登录列表 | 200 空列表 |
| ACCT04-19 | 未登录查看、更新、删除、创建 | 404、404、403、400 |
| ACCT04-20 | 无效令牌的列表、查看、更新、删除、创建 | 200 空、404、404、403、400，都不是 401；同一令牌 `auth-refresh` 是 401 |
| ACCT04-21、-22、-23 | users：列表、看 B、改 B | 200 只有自己 1 条、404、404 |
| ACCT04-24 | 登录和刷新 | 200、200 |
| ACCT04-25 | A 读超级用户记录、集合、设置、日志、备份接口 | 五个都是 403；用 A 的凭据登录超级用户集合是 400 |
| ACCT04-26 | A 列第三方登录相关的系统集合 | 200，没有 B 的记录 |
| TOK-1 | 令牌有效期 | 集合的令牌有效期 7776000 秒；登录令牌的剩余有效期在 90 天上下一天内 |
| D5-1 | A 带正确旧口令改密码 | 200；旧令牌 `auth-refresh` 401；新口令登录 200；旧口令登录 400 |
| D5-2 | 缺旧口令 | 400，`validation_required` |
| D5-3 | 旧口令不对 | 400，`validation_invalid_old_password` |
| D5-4 | 改 verified 或 emailVisibility | 404、404，回读不变 |
| D5-5 | 改 email | 400，`validation_values_mismatch`，回读不变 |
| TOK-2 | 超级用户重置 B 的密码 | 200；B 的旧令牌 `auth-refresh` 401；新口令登录 200 |
| RT-1 | 订阅 `journey_docs/*` | 204；对照事件到达，静默 1.5 秒内没有 B 的 id |
| RT-2 | 单条主题 | 204；B 的变更收不到 |
| RT-3 | 未登录连接 | 204；收到 0 个事件 |
| RT-4 | `fields=id,kind,writer,updated` | 204；事件 record 的键恰好是这 4 个 |
| RT-5 | 同一 clientId 换 B 的令牌再提交 | 403（第一次提交 204） |
| RT-6 | 不存在的 clientId | 404 |

## 8. 重新核对的步骤

换 PocketBase 或 SDK 的版本时：

1. 先经所有者批准（程序和 SDK 都是单一来源，哈希核对只能防下载损坏）；
2. `npm run pb:isolation`：重新断言账号隔离，最后一行应是 `ISOLATION OK 47/47`；
3. `node tools/pb/record-samples.mjs`：重新录制，最后一行 `SAMPLES WRITTEN 28`；录到的状态码与场景表的 `expect` 不同时会以 `STATUS MISMATCH` 中止，先查原因，不改 `expect` 去迁就；
4. `node tools/pb/record-samples.mjs --check`：最后一行 `SAMPLES CLEAN 2`；
5. 08-07 的契约自测：让假服务器对同一份场景表产生响应，与新样本比对状态码、键集合和归一化后的正文。

## 9. 给后续阶段的输入

**Phase 9（应用接上云端）**

- 用 SDK 时调用 `pb.autoCancellation(false)`，否则同一路径的请求会互相取消。
- SDK 0.28.1 不给普通用户自动续期（自动续期只注册给超级用户集合）。应用要在每次联网启动时调用 `authRefresh`；这更正了 D-06 里“常用时客户端会自动续期”的说法。
- 更新只发 `data` 和 `writer`，不要把整条记录（含 owner、kind）回传，否则整条请求 404（update-owner-key、update-kind-key）。
- 首次登录由客户端创建两份文档（state 和 plan）；遇到唯一冲突（400，错误码 `validation_not_unique`）就重新读取再更新。

**Phase 10（实时同步和错误处理）**

- 判断登录过期，看 `authRefresh` 的结果或本地令牌的 exp，不看记录接口的状态码（记录接口对无效令牌返回 200 空、404、400，不返回 401）。保存时遇到 404 要先排除“令牌失效”（比如在别的设备上改过密码）。
- 断网和 SSE 断开由假服务器显式触发（见 PROBE-9），不靠计时器，也不要用 `setOffline` 去模拟。
- 带 `fields` 的订阅，更新事件的 record 只有被选的字段；需要完整文档时要重新读取。

**Phase 13（上线收口）**

- 经 nginx 时，4 MiB 的 PATCH 可能先撞到请求体大小上限，要对着服务器的 nginx 配置核实（研究 A12）。
- 实时订阅会校验提交订阅的请求与 SSE 连接来自同一个客户端 IP，nginx 的代理头要配对。
- 线上用同一个隔离脚本复验账号隔离。
