# Claude Artifact 运行时契约对齐说明

这份文档说明 `tests/mocks/` 里的 `window.claude` mock 对齐了哪一版契约、实现了哪些条目、明确没实现哪些条目。账户模式的所有用例（Phase 2 到 Phase 5）都建立在这个 mock 上，所以 mock 必须对着真实契约，而不是对着想象中的宿主（MOCK-06）。

## 1. 对齐的版本

- **契约版本：0.2.96**，与 `tests/support/constants.ts` 里的 `CLAUDE_CONTRACT_VERSION` 一致。`tests/e2e/platform/mock-contract.spec.ts` 里的 MOCK-06 用例每次 `npm test` 都会读这份文件，核对版本号和关键条目。
- **来源：** Claude Code 自带的 artifact-capabilities 技能提供的类型定义，共四个文件：`claude.d.ts`、`db.d.ts`、`user.d.ts`、`downloads.d.ts`。
- **原文摘录的写法：** 下面引用块里的英文都逐字取自上面四个文件，只把类型注释里的换行和行首的星号去掉，合成连续的句子，用词和标点不改。每组引用块前面的“来源”行写明取自哪个文件。引用块之外的中文是本项目自己的说明，不是契约原文。
- **mock 的位置：** 页面侧 `tests/mocks/claude-runtime.ts`，Node 侧 `tests/mocks/claude-backend.ts`。两者只做正常路径（D-02）：没有拒绝、错误码、限流或加载延迟。错误路径属于 v2 的 ERR-01 到 ERR-04。

## 2. 已实现的条目

每个条目先给契约原文，再写 mock 怎么实现、哪条用例覆盖。用例标题里的需求编号对应 `.planning/REQUIREMENTS.md`。

### 2.1 `window.claude` 与 `use()`（claude.d.ts）

**条目 1：`window.claude` 上只有 `use`。**

来源：claude.d.ts

> Inside a viewer the page is framed and `window.claude` exists before any of your script runs.

> This contract promises nothing on it but `use`: treat `window.claude.db`, `window.claude.room` and every other capability member as `undefined` at every moment.

- mock：`installClaudeMock` 经 `addInitScript` 在页面脚本运行前定义 `window.claude`，值是只含 `use` 的冻结对象，属性不可配置、不可写。
- 说明：契约没有要求 `window.claude` 本身被冻结，这是 mock 比契约更严的选择（D-03），目的是让应用误改它时立刻暴露。
- 用例：`MOCK-02 window.claude exposes only a frozen use() and unknown names resolve null`。

**条目 2：`use()` 的时序，命名空间不会在调用它的同步代码里到达。**

来源：claude.d.ts

> The namespace arrives later, through the promise, once the viewer has answered and the module has loaded — never during your script's first synchronous run, and not ordered against `DOMContentLoaded` either way, so don't assume the DOM is complete when it resolves.

- mock：`use(name)` 返回一个已经 resolve 的 Promise，`then` 回调只会在微任务里执行，不会在调用 `use` 的同步代码里执行。没有用定时器拖延（定时器会被 manual 时钟卡住）。
- 用例：`MOCK-02 use() is asynchronous and memoizes served capabilities`。

**条目 3：对可用能力的 memoize。**

来源：claude.d.ts

> For a capability this view serves the promise is memoized — every `use("db")` yields the same promise object; a name not served resolves `null` (with no stable promise identity).

- mock：用 `Map` 缓存每个能力的 Promise，所以同一个名字总是同一个 Promise、同一个命名空间对象；没有提供的名字每次返回一个新的 `null` Promise，和契约括号里的“没有稳定的 Promise 身份”一致。
- 用例：`MOCK-02 use() is asynchronous and memoizes served capabilities`。

**条目 4：命名空间是冻结的。**

来源：claude.d.ts

> The resolved namespace is platform-owned and read-only: a frozen object whose members are the capability's functions.

- mock：`db`、`user`、`downloads` 三个命名空间都经 `Object.freeze` 冻结。
- 用例：`MOCK-02 namespaces, document references and snapshots are frozen and shaped like DocumentSnapshot`。

**条目 5：未知名字 resolve `null`。**

来源：claude.d.ts

> an unknown name is a compile error in typed authoring and resolves `null` at runtime.

> Resolves the capability's namespace once this view can run the capability's code, or `null` when it cannot: the capability is not served on this view, was not granted at initialization, or its module failed to load.

- mock：名字表用 `Map.has` 判断，所以 `toString`、`constructor` 这类对象上继承来的名字也返回 `null`。`room` 等本 mock 没有提供的能力同样返回 `null`，对应“not served on this view”。
- 用例：`MOCK-02 window.claude exposes only a frozen use() and unknown names resolve null`。

### 2.2 `db`（db.d.ts）

**条目 6：PATH GRAMMAR，路径写错时同步抛 `TypeError`。**

来源：db.d.ts

> PATH GRAMMAR (shared by every ref). A document path has an EVEN number of slash-separated segments — the last is the document id, the joined rest is its collection (`tasks/t1`, or nested: `boards/b1/columns/c2`).

> Segments use letters, digits, and `_ - . ~ : @ +` only (never `.` or `..` alone); at most 200 bytes per segment, 1000 bytes and 16 segments per path.

> `doc()`, `collection()` and the builders on refs THROW a `TypeError` synchronously for a path that breaks this grammar (its message names the broken rule; for parity, the segment count) — a programming error to fix where the path is written, not a store condition to handle; building a ref never touches the network.

> it is async, and an un-awaited promise is not a valid path segment, so the builder throws

- mock：`db.doc(path)` 在返回引用之前同步检查：偶数段、至少 2 段、至多 16 段，每段只含字母、数字和 `_ - . ~ : @ +`，不是单独的 `.` 或 `..`，每段最长 200、整条最长 1000；违反任何一条就抛 `TypeError`，消息写明是哪一条。没有一次网络往返（建引用不触发 binding）。长度按字符而不是字节计，见 3.2。
- 用例：`MOCK-02 db.doc() enforces the document path grammar synchronously`。覆盖奇数段、空字符串、未 await 的 Promise 变成的字符串段、`.` 和 `..` 段、201 字符段、18 段、超长路径，以及合法路径（包括段长 200、段数 16 的边界和全部特殊字符）返回正确的 `id` 和 `path`。

**条目 7：`DocumentReference` 的 `get` 和整体替换的 `set`。**

来源：db.d.ts

> Read once. Absence is NOT an error — branch on `exists`.

> Write the WHOLE document, creating it (and the store) if absent — a full replace, Firestore-style.

- mock：`get()` 经 binding 读 Node 侧 `MockBackend` 的文档，文档不存在时返回 `exists: false` 的快照，不抛错；`set(data)` 整体替换文档，返回 `undefined`，文档不存在时就创建。引用本身（`id`、`path`、方法）是冻结的。
- 用例：`MOCK-02 namespaces, document references and snapshots are frozen and shaped like DocumentSnapshot`（读取和引用冻结）；写入的往返由 `tests/e2e/storage/account-mode.spec.ts` 里的 MOCK-03 用例覆盖。

**条目 8：`DocumentSnapshot` 的四个字段和冻结。**

来源：db.d.ts

> One document, as reads and snapshots deliver it. Delivered snapshots and their `data()` are frozen;

> The last segment of the document's path.

> False covers both a missing document and one this viewer cannot see — deliberately indistinguishable.

> The document body; `undefined` when `exists` is false.

- mock：快照恰好有 `id`、`exists`、`data`、`metadata` 四个字段；`id` 是路径的最后一段；不存在的文档 `exists` 为 `false`、`data()` 为 `undefined`；快照、`data()` 返回的对象（含嵌套对象）和 `metadata` 都被递归冻结，同一个快照多次调用 `data()` 返回同一个对象。`metadata` 恒为 `{ fromCache: false, hasPendingWrites: false }`，见 3.2。
- 用例：`MOCK-02 namespaces, document references and snapshots are frozen and shaped like DocumentSnapshot`。

**条目 9：每个查看者自己的路径 `data/users/<id>/...`。**

来源：db.d.ts

> Address the viewer's subtree as `data/users/<id>/...` using the AWAITED value of {@link Claude.user.id}

- mock：账户模式下应用读写的路径是 `data/users/<id>/state`，`<id>` 来自 `user.id()` 的合成值（路径常量见 `tests/support/constants.ts` 里的 `ACCOUNT_DOC_PATH`）。路径隔离没有实现，见 3.2。
- 用例：`tests/e2e/storage/account-mode.spec.ts` 的 MOCK-03 和 MOCK-05 用例核对读取的路径；`MOCK-02 user.id() resolves the configured synthetic id` 核对 id 本身。

### 2.3 `user`（user.d.ts）

**条目 10：`user.id()` 永不 reject，没有身份时是 `null`。**

来源：user.d.ts

> ONE rule for the whole namespace: every read resolves a value and NEVER REJECTS

> optional data (id, email) is null; never an absent key, never undefined.

> null = no identity here.

- mock：`user.id()` 返回配置里的合成 id（默认 `synth-user-0001`），配置为 `null` 时返回 `null`，从不 reject。`null` 时应用会退回本地模式，常驻的反向对照用例就是靠它证明账户模式的校验不是永远通过（D-07）。
- 用例：`MOCK-02 user.id() resolves the configured synthetic id`、`MOCK-02 user.id() resolves null when the mock is configured without an id`，以及 `tests/e2e/storage/account-mode.spec.ts` 的 MOCK-05 反向对照。

### 2.4 `downloads`（downloads.d.ts）

**条目 11：`save` 的 `SaveRequest`（`filename`、`data` 的几种类型）和 `SaveResult` 的 `saved`。**

来源：downloads.d.ts

> Suggested filename with extension.

> data: string | Blob | ArrayBuffer | ArrayBufferView;

> Strings encode UTF-8.

> `"saved"` = viewer accepted and the file was handed to the host's save surface

- mock：`save({ filename, data })` 接受字符串、`Blob`、`ArrayBuffer` 和 `ArrayBufferView`，统一解码成文本交给 Node 侧 `MockBackend.downloads` 记录（用例直接读它，D-09），然后返回冻结的、只有 `status` 字段的 `SaveResult`，值恒为 `saved`。
- 用例：`MOCK-04 downloads.save accepts string, Blob and ArrayBuffer data and resolves status saved`（`ArrayBufferView` 没有单独的用例，它和 `ArrayBuffer` 走同一条解码分支）；账户模式下应用导出时的文件名和内容由 `tests/e2e/storage/account-mode.spec.ts` 的 MOCK-04 用例核对。

## 3. 明确没实现的条目

这一节是未实现清单，每一项 mock 都**没有**实现。原因只有两种：本里程碑只做正常路径（D-02），错误路径、限流和延迟属于 v2 的 ERR-01 到 ERR-04；或者应用没有用到。读到这里的用例作者不要假设 mock 会表现出这些行为。

### 3.1 claude.d.ts

- **加载延迟，以及宿主不响应时 10 秒后返回 `null`。** mock 的 `use()` 立刻 resolve，没有延迟，也没有超时分支（属于加载延迟，v2）。
- **能力开关。** 契约里能力可能“not served”或“not granted”，mock 的 `db`、`user`、`downloads` 三个能力总是提供，没有开关（只做正常路径）。
- **其余能力。** 契约 0.2.96 的类型定义里还有 `artifact`（旧写法 `self`）、`assets`、`comments`、`files`、`mcp`、`permissions`、`room`、`sample`，分别在 `artifact.d.ts`、`self.d.ts`、`assets.d.ts`、`comments.d.ts`、`files.d.ts`、`mcp.d.ts`、`permissions.d.ts`、`room.d.ts`、`sample.d.ts` 里。mock 都没有提供，`use()` 对它们 resolve `null`（应用没有用到）。

来源：claude.d.ts

> Framed by a host that never answers, it resolves `null` after 10 s.

### 3.2 db.d.ts

- **`onSnapshot`（文档和查询两种）。** 应用只调用 `db.doc(path).get()` 和 `set()`，不订阅，所以没有实现任何实时推送、`docChanges()`、`fromCache` 的变化。
- **集合与查询。** `db.collection()`、`DocumentReference.collection()`、`CollectionReference` 的 `doc(id?)` 和 `add()`，以及 `Query` 的 `where`、`orderBy`、`limit`、`get`。应用没有用到。
- **`update`、`delete`、`acquire`。** 只实现整体替换的 `set` 和读取的 `get`。
- **全部错误码和拒绝。** `DbError` 的 `invalid_argument`、`resource_exhausted`、`quota_exceeded`、`unavailable`、`revoked`、`not_granted`、`capability_disabled`、`capability_removed`、`transform_error` 一个都没有。唯一的“失败”是路径写错时 `doc()` 同步抛出的 `TypeError`，那是契约本身规定的编程错误，不是 `DbError`。
- **限流和预算。** 每个查看者的调用速率、订阅数上限（每个视图 64 个）、并发写入数、查询扫描量，对应 `resource_exhausted`，mock 不限制。
- **文档大小、嵌套深度和容量上限。** 单个文档 256 KiB、32 层嵌套，整个数据库 25,000 个文档，mock 不检查。
- **同一文档的写入顺序。** 契约要求调用方对同一个文档一次只写一个，并发写入过多时由平台以 `resource_exhausted` 拒绝；mock 不检测并发写，后到的覆盖先到的（和契约的“last-writer-wins”一致，但没有任何拒绝）。
- **`fromCache`、`hasPendingWrites` 恒为 `false`。** 契约里这两个字段在缓存和待确认写入时会是 `true`，mock 不模拟。
- **访问规则和 `data/users/` 的私有分区。** 契约规定别的查看者的子树读起来像不存在、写入被拒绝；mock 只有一个固定的合成用户，不做分区，任何合法路径都能读写。
- **长度按字节计。** 契约的路径长度上限（每段 200、整条 1000）按字节算，mock 按字符算。段文法只允许 ASCII，所以对合法路径两者相同，非 ASCII 字符会先被段文法拒绝。

来源：db.d.ts

> Subscribe to this document. `next` fires with the current state once the store answers, then on every change — including other viewers' writes, live.

> `resource_exhausted` — a budget: the per-viewer call rate, the subscription cap (64 per view), too many concurrent writes or active leases, or a query that scans too many documents.

> DOCUMENT BODIES are plain-JSON OBJECTS (not arrays or scalars at the top level): at most 256 KiB serialized and 32 levels deep.

> ONE WRITE AT A TIME per document, only when its data changed: await each `set`/`update` before the next to the same document;

> `fromCache: true` marks a view the store has not confirmed, such as a copy saved on an earlier visit, your own writes before the first read lands, a collection too large to read whole, or delivery during a connectivity gap.

### 3.3 user.d.ts

- **`me()`、`profiles()`、`name()`、`avatarUrl()`、`email()`。** 应用只用 `id()`。
- **`isOwner()`、`canEdit()`、`can()`、`search()`。** 应用没有用到。
- **能力声明和范围。** 契约里 `id()` 需要声明 `user` 能力，没有声明时 resolve `null`；mock 总是提供，`null` 只能靠配置得到（反向对照用例就是这样用的）。

### 3.4 downloads.d.ts

- **全部错误码和拒绝。** `rejected_extension`、`extension_not_enabled`、`too_large`、`declined`、`rate_limited`、`bad_request`、`request_unknown`、`not_signed`、`unavailable`、`not_granted`、`capability_disabled`、`capability_removed`、`transform_error` 一个都没有，`save` 永远 resolve。
- **限流。** 契约里已经有一个提示没关闭、最近提示太多、前一个 `mov` 还在检查，都会返回 `rate_limited`；mock 不限流，也没有“查看者确认”这个步骤，调用后直接 `saved`。
- **文件名清洗和扩展名白名单。** 契约会去掉不可见字符、合并空白、截到 240 字节，并检查扩展名；mock 原样记录文件名。
- **空内容校验。** 契约要求内容非空；mock 不检查。
- **`request` 字段和 `delivered` 结果。** 只在应答平台发起的导出请求时使用，应用用不到；`save` 只返回 `saved`。
- **`ArrayBuffer` 的转移。** 契约里传入的 `ArrayBuffer` 会被转移（调用后失效）；mock 只读取它，不会让它失效。

来源：downloads.d.ts

> `rate_limited` — a prompt is already open, too many recent prompts (each `mov` save that is checked counts as one, shown or not), or an earlier `mov` save still being checked; wait, then retry.

> It is sanitized (invisible characters dropped, repeated whitespace made one space, at most 240 bytes of UTF-8) and allowlist-checked; the viewer confirms the FINAL name, which may differ.
