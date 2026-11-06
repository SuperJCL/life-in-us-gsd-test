# Architecture Research

**Domain:** 单文件原生 JS 应用 + PocketBase 云端后端（3 个账号、多设备实时同步、离线优先）
**Milestone:** v2.0 多账号云端版（在已有 v1.0 代码和测试平台之上集成）
**Researched:** 2026-11-05
**Confidence:** MEDIUM-HIGH（PocketBase 的规则、实时协议、JS SDK 行为已对照官方文档和 SDK 源码核实；少数项标为 MEDIUM/LOW，见各节和文末“待验证项”）

---

## 0. 结论速览（给路线图用）

| 议题 | 推荐 |
|------|------|
| 集合 | 内置 `users`（认证集合，`createRule = null`）+ 一个业务集合 `journey_docs`：每个账号两条记录（`kind = state` 与 `kind = plan`），JSON 字段 `data`，`owner` 关系字段，`(owner, kind)` 唯一索引 |
| 计划放哪 | **单独一条记录**，不放进 state：写入频率不同、冲突域不同、体积不同 |
| 隔离 | 全部靠 API 规则：`owner = @request.auth.id`；客户端无删除权限；禁止改 `owner`/`kind` |
| 体积 | 显式把 `data` 的 `maxSize` 调到 4 MiB（默认只有 1 MiB）；整文档写入保留，不做分片；留 `kind` 作为日后分片的扩展点 |
| 存储适配器 | 在现有 `{label, load, save}` 上加 `subscribe`、`sync`、`status`，由一个 `makeDocStore(kind)` 工厂产出 state 和 plan 两个实例 |
| 回声抑制 | 每次页面加载生成随机 `writer` 写进记录；实时订阅只取 `id,kind,writer,updated`，`writer` 是自己就忽略，否则再 `getOne` 取完整内容 |
| 合并到 `state` | **空闲时才应用**（编辑弹窗打开、有焦点输入框、有草稿、本机有未上传改动时先挂起），应用后 `renderAll()` |
| 离线 | 本地缓存用 localStorage（`pagehide` 时同步可写），“队列”退化成一个 `dirty` 位加最新整份文档；`updated` 一律用服务器给的值，不用客户端时钟 |
| 首次加载冲突 | 联网时先等服务器对账（最多约 3 秒）再允许编辑，避免“在过期缓存上编辑然后整份覆盖掉别的设备的新记录”这条最常见的丢数据路径 |
| 计划外置 | 5 个类别的名称和颜色键留在代码里，只外置 `presets`、`groups`、`lifts`、`fitGoal`；内置任务沿用 `P<n>-<i>` 作为**初始稳定 id**，新任务用 `t-<uid>` |
| 认证 | 登录页在 `init()` 之前；SDK 默认 `LocalAuthStore`；每次启动 `authRefresh()`；过期时保留本机缓存和未上传改动，只要求重新登录 |
| 部署 | Caddy（自动 HTTPS）→ PocketBase（只监听 127.0.0.1）→ `pb_public` 同源提供 HTML；systemd 守护；PocketBase 内置定时备份加异地 S3 兼容存储 |
| 测试 | “假服务器、真 SDK”：页面侧替换 `fetch` 和 `EventSource`，Node 侧 `FakePbServer` 经 `exposeBinding` 保存状态；v1 的 `window.claude` 路径保留，使 154 条用例原样运行 |

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  浏览器（手机 / 电脑，同一个 HTML）                                   │
├──────────────────────────────────────────────────────────────────────┤
│  登录页(#login)        四个视图 + 编辑计划页(#planEditor)  [新]       │
│       │                        │ render*()                            │
│       ▼                        ▼                                      │
│  boot()  [新，取代 init]   全局 state + 全局 plan [新]                │
│       │                        ▲        │ persist()/persistPlan()     │
│       ▼                        │        ▼                             │
│  ┌───────────────────── Sync 层 [新] ─────────────────────────────┐  │
│  │ makeDocStore(kind)： cache(localStorage) ⇄ pbStore ⇄ subscribe │  │
│  │ reconcile() · retry/backoff · idle-gated applyRemote()          │  │
│  └───────────────┬─────────────────────────────────────────────────┘  │
│                  │ 配置缝：USJ_CONFIG.backend（有 → cloud；无 → 旧路径）│
│   旧路径（保留）：localStore() / window.claude db                     │
├──────────────────┼───────────────────────────────────────────────────┤
│  pocketbase.umd.js（同源固定版本）   REST + SSE(/api/realtime)        │
└──────────────────┼───────────────────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼───────────────────────────────────────────────────┐
│  VPS（香港 / 东京）                                                   │
│  Caddy :443 ──► PocketBase 127.0.0.1:8090（systemd）                  │
│                   ├─ pb_public/   index.html、pocketbase.umd.js、sw.js │
│                   ├─ pb_migrations/  集合与规则（进 git）              │
│                   └─ pb_data/     SQLite + 备份（定时备份 → 异地）     │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities（新增 / 修改 / 不动）

| 组件 | 状态 | 职责 | 位置 |
|------|------|------|------|
| Config seam（`window.USJ_CONFIG`） | **新** | 决定走 cloud 还是旧路径；测试和本地开发都靠它切换 | HTML 顶部脚本 |
| Auth（登录页、`pb.authStore`、`authRefresh`、登出） | **新** | 取得并维持 token；过期时的降级 | HTML + SDK |
| `makeDocStore(kind)` / `pbStore` | **新** | `{label, load, save, subscribe, sync}`，一个 kind 一个实例 | HTML |
| Local cache（按用户分键的 localStorage） | **新**（复用 `localStore` 的写法） | 缓存最近一次服务器版本和未上传改动 | HTML |
| Sync controller（对账、重试、空闲应用） | **新** | 把 store 事件合并进 `state`/`plan` 并触发渲染 | HTML |
| `plan` 全局对象 + `normalizePlan` + `DEFAULT_PLAN`（合成示例） | **新**，取代 `CATS` 的 presets、`GROUPS`、`LIFTS`、`FIT_GOAL`、`BUILTIN`、`GCAT` | 所有 `render*`、`presetsFor`、`allTasks` 改为读 `plan` | HTML |
| 编辑计划页 | **新** | 增删改任务组、任务、力量项、预设标签；导入导出计划 JSON | HTML |
| `persist()`/`flush()` | **改** | 泛化成 `makeSaver(getValue, store)`，实例化两次（state、plan）；失败不再丢 `dirty` | HTML |
| `init()` | **改** | 变成 `boot()`：配置 → 认证 → 缓存先渲染 → 对账 → 订阅 | HTML |
| `normalize()` | **改** | 拆出 `normalizeState`；对 id、group、date 做格式校验（见 Q4） | HTML |
| 导出 / 导入 | **改** | 没有 `window.claude` 时用 Blob + `<a download>`；导入前自动保留旧版本快照 | HTML |
| 四个视图的模板、composer、editor 弹窗 | 基本不动 | 仅把常量引用换成 `plan.*`；`/^P\d-\d+$/` 自定义任务判断改为按 `state.custom` 成员判断 | HTML |
| PocketBase 集合、规则、迁移 | **新** | 服务器侧隔离与存储 | `pocketbase/pb_migrations/` |
| Caddy、systemd、备份、部署脚本 | **新** | 运维 | `deploy/` |
| `tests/mocks/pb-*`、`AppHarness` 的 `cloud` 模式 | **新 / 改** | 见 Q7 | `tests/` |
| v1 的 `window.claude` mock、`MockBackend` | 保留 | 让 v1 用例原样通过 | `tests/mocks/` |

### Recommended Project Structure

```
us-journey-tracker.html            # 修改（仍不进 git，见“隐私”一节）
vendor/pocketbase.umd.js           # 固定版本的 SDK（MIT），进 git，同源提供，不走 CDN
sw.js                              # 可选：只缓存应用外壳，解决冷启动离线
pocketbase/
  pb_migrations/                   # 集合、规则、索引，用 JS 迁移保存，进 git（不含数据）
  pb_hooks/                        # 可选：注册后自动建两条空记录
deploy/
  Caddyfile.template               # 占位符，不写真实域名
  usj-pocketbase.service           # systemd 单元模板
  deploy.sh                        # 从 .env.local 读真实地址（该文件被 git 忽略）
tools/
  plan/extract-plan.mjs            # 读本机未入库的旧 HTML，输出被忽略的 plan 文件
  pb-rules-check/                  # 对本机临时 PocketBase 跑隔离断言（手动，非默认）
tests/
  mocks/pb-server.ts               # Node 侧 FakePbServer（保存状态、记录请求、推送事件）
  mocks/pb-runtime.ts              # 页面侧：替换 fetch / EventSource
  mocks/PB-CONTRACT.md             # 对齐的 PocketBase 版本与已实现 / 未实现清单
  e2e/cloud/                       # 登录、对账、离线、实时、计划编辑
```

### Structure Rationale

- **SDK 放同源文件而不是内联或 CDN：** 内联约 40 KB（0.28.1 的 UMD 压缩后约 40 KB）会淹没本来就很密的 HTML；CDN 在中国不可靠，也会被 v1 的网络护栏拦住。同源文件让 `pb_public`、本地静态服务器和 Playwright 的路由都用同一路径。
- **迁移文件进 git：** 集合结构和规则是安全关键配置，应该可评审、可重放，并且能被隔离测试脚本反复验证；其中不含任何数据或密钥。
- **`deploy/` 只放模板：** 公开仓库不得出现服务器地址、域名、密钥（PROJECT 约束）。

---

## Q1. PocketBase 数据模型

### 集合

**`users`（内置认证集合）**

| 设置 | 值 | 依据 |
|------|----|------|
| `createRule` | `null` | `null` 表示只有 superuser 能执行，其他人 403（HIGH，官方规则文档）。新建的 `users` 默认可能允许公开注册，**必须显式改成 null 并用隔离测试断言**（MEDIUM：默认值未在文档中逐字核实） |
| `listRule` / `viewRule` | `id = @request.auth.id` | 只能看到自己 |
| `updateRule` | `id = @request.auth.id` | 可改自己的资料和密码 |
| `deleteRule` | `null` | 只有管理员能删账号 |
| 认证方式 | 只开密码；关 OAuth2、OTP、MFA | 3 个账号由管理员开，不需要别的入口 |
| 标识字段 | 保持 `email`（任意格式正确的地址即可，不需要真实邮箱） | 用 `username` 也行，但需要唯一索引（HIGH，官方认证文档）；3 个人没必要多一步 |
| token 有效期 | 显式设成 30–90 天 | 默认值未在官方文档中找到（LOW，14 天只见于第三方 wiki）；有效期显式设置后，每次启动 `authRefresh` 会续期 |

**`journey_docs`（base 集合）**

| 字段 | 类型 | 说明 |
|------|------|------|
| `owner` | relation → `users`，必填，maxSelect 1，`cascadeDelete = true` | 账号被删时文档一并删除 |
| `kind` | select（`state` \| `plan`），必填，maxSelect 1 | 一条记录一种文档；以后要分片可以加 `logs:2027` 这类取值 |
| `data` | JSON，**显式 `maxSize = 4194304`** | 默认上限 1 MiB（HIGH：JSVM 文档“If zero, a default limit of 1MB is applied”，源码 `DefaultJSONFieldMaxSize = 1<<20`）；超限会返回 `validation_json_size_limit` |
| `writer` | text，最长 40 | 本次写入的页面标识，只用于回声抑制（见 Q2）；不属于 state 格式 |
| `created` / `updated` | autodate（创建 / 创建+更新） | `updated` 是服务器时钟，对账只比较它，不看客户端时钟 |
| 索引 | `UNIQUE (owner, kind)` | 防止两台设备同时首次创建产生重复记录；后到者创建失败后改为 `getFullList` 再 `update` |

不要给 `data` 勾“必填”：JSON 字段的 required 会拒绝看起来为空的值（`{}`、`[]`、`null`）。state 和 plan 顶层都有键，所以即便勾了也不会触发，但没有必要冒险。

**为什么是一个业务集合（`kind`）而不是 `journey_state` + `journey_plan` 两个集合：**

- 一套规则、一份索引，规则写错的面积小一半，隔离测试也只要覆盖一个集合；
- 一个集合订阅（`'*'`）就能同时收到 state 和 plan 的变化，靠 `record.kind` 分派；
- 实时订阅的过滤由集合的 `listRule` 完成（单记录订阅按 `viewRule`），所以用户只会收到自己的事件（HIGH，官方实时文档）。

**为什么 plan 不放进 state：**

1. 写入频率差几个数量级：每记一笔就写 state，改计划一个月也不会有几次；放在一起，在手机上记一笔会和电脑上改计划互相覆盖整份文档（整份最后写入为准）。
2. 冲突域不同：计划编辑是“设计动作”，需要整页保存或显式保存；state 是“流水”，需要自动保存。
3. 体积：计划约几十 KB 以内，每次记一笔都带着它上传是浪费，也会放大实时推送。
4. 代价：state 里的 `tasks[id]` 引用 plan 里的任务 id，存在悬空引用的可能；用稳定 id 和“归档而不是删除已完成任务”解决（见 Q4）。

**被否决的方案：每条记录一个 PocketBase 记录（`logs` 集合）。** 它能做到逐条冲突解决、没有体积上限、增量推送，但会推翻现有的“改 `state` → `persist()` → `renderAll()`”闭环，导入导出、normalize、全部渲染函数都要重写，并且违反了需求里“沿用现有状态格式、每个账号一份记录”。留作 v3 如果整份文档的写放大成为问题。

### API 规则（`journey_docs`）

规则语义（HIGH，官方 API 规则文档）：`null` = 仅 superuser；空字符串 = 所有人；表达式 = 满足才放行；列表规则不满足返回 200 加空列表，创建不满足 400，查看 / 更新 / 删除不满足 404；superuser 不受规则约束。

| 规则 | 表达式 | 说明 |
|------|--------|------|
| `listRule` | `@request.auth.id != "" && owner = @request.auth.id` | 别人的记录在列表里不存在 |
| `viewRule` | 同上 | 别人的记录返回 404，与“不存在”无法区分 |
| `createRule` | `@request.auth.id != "" && @request.body.owner = @request.auth.id` | 规则只校验提交的 owner，不会自动填；不匹配返回 400 |
| `updateRule` | `owner = @request.auth.id && @request.body.owner:isset = false && @request.body.kind:isset = false` | 禁止改归属和类型（`:isset` 是官方修饰符，HIGH；组合写法 MEDIUM，需在隔离测试里证实） |
| `deleteRule` | `null` | 客户端永远不能删；账号被管理员删除时靠 `cascadeDelete` |

**可选加固：** 用 `pb_hooks` 的 `onRecordAfterCreateSuccess(..., "users")` 在管理员建账号时自动建好两条记录，客户端的 `createRule` 就可以直接设为 `null`，客户端只能 `update`。代价是服务器侧多一段 Playwright mock 测不到的代码，所以默认方案仍是客户端首次创建加唯一索引；要不要加固留给 discuss 阶段。

**管理员能看到一切：** superuser 不受规则约束，也能经后台读所有账号的 `data`。这是“数据在自己服务器上”的固有性质，需要在对 3 个使用者的说明里写明，而不是靠技术掩盖。

### 体积、增长与限制

- 现状：Artifact `db` 文档上限 256 KiB；估算每天约 5 条、每条 100–200 字节，一年约几百 KB 以内。从 Artifact 导出再导入的数据不会超过 256 KiB。
- 新上限：`maxSize = 4 MiB` 约等于 4 倍以上的当前上限，对 3 个人足够多年。**必须显式设置**，否则第一次超过 1 MiB 的保存会被 400 拒绝，而旧代码“失败不重试”会让用户以为已经保存。
- 真正的成本是写放大，不是上限：每次保存整份上传，且每次保存会产生一个实时事件。用 `fields` 只订阅元数据（见 Q2）把推送放大消掉；上传放大用 Caddy 的响应压缩缓解，请求体无法压缩，3 个人可以接受。
- 在 UI 状态栏加一个“已用约 X% / 4 MiB”的提示（只读 `JSON.stringify(state).length`），超过 70% 时给出提示，避免静默撞墙。
- 分片（`kind = logs:<year>`）是已留好的扩展点，**现在不做**。

---

## Q2. `pocketbase` 存储适配器与实时合并

### 适配器接口

现有接口是 `{label, load, save}`（`load` 返回对象或 `null`，`save` 接收整份对象）。扩展为：

```typescript
interface DocStore {
  label: string;                                   // 状态栏文案，随连接状态变化
  load(): Promise<{ data: object; updated: string } | null>;
  save(data: object): Promise<{ updated: string }>; // 抛错 = 保持 dirty，等待重试
  subscribe(onRemote: (rec: { data: object; updated: string }) => void): Promise<() => void>;
  sync(): Promise<void>;                            // 手动对账（重连、回到前台时调用）
}
// 工厂：同一条连接、两个 kind
const stateStore = makeDocStore(pb, 'state');
const planStore  = makeDocStore(pb, 'plan');
```

旧路径（`localStore()`、`window.claude` 的 `db`）原样保留为只有 `load/save` 的适配器；`subscribe` 缺省时控制器跳过订阅，所以 v1 路径不受影响。

### 订阅与回声抑制

PocketBase 实时通过 SSE：`GET /api/realtime` 先收到带 `clientId` 的 `PB_CONNECT`，再 `POST /api/realtime` 提交订阅主题；订阅在**第一次提交订阅时**绑定鉴权，之后用不同身份提交会返回 403；5 分钟没有消息服务器会主动断开，客户端会自动重连（HIGH，官方实时文档）。SDK 的重连间隔是 200/300/500/1000/1200/1500/2000 ms，之后保持 2 秒，次数无限；**每次（重）连接成功都会再触发一次 `PB_CONNECT` 监听**（HIGH，读自 SDK 源码 `RealtimeService.ts`）。实时**不补发**断线期间错过的事件，所以每次 `PB_CONNECT` 必须手动对账一次。

```javascript
const SESSION_ID = uid();                       // 每次页面加载一个，不放 localStorage（同浏览器多标签也要互相收到）

async function save(data) {
  const rec = await pb.collection('journey_docs')
    .update(recordId, { data, writer: SESSION_ID }, { requestKey: null });   // 关闭自动取消，见 Pitfall
  return { updated: rec.updated };
}

// 订阅时只要元数据，不把整份 data 推回给写入者自己
await pb.collection('journey_docs').subscribe('*', async (e) => {
  if (e.action === 'delete') return;
  const r = e.record;
  if (r.writer === SESSION_ID) return;          // 回声：自己的写入
  if (r.updated <= appliedUpdated[r.kind]) return;   // 乱序或重复
  const full = await pb.collection('journey_docs').getOne(r.id, { requestKey: null });
  applyRemote(r.kind, full);                    // 见下一节：空闲才应用
}, { fields: 'id,kind,writer,updated' });
```

- **为什么用 `writer` 而不是比较 `updated`：** 自己的 PATCH 响应可能晚于它引发的 SSE 事件到达，此时 `updated` 还没拿到，无法比较；`writer` 是写进记录里的，事件本身就自带，没有竞态。
- **为什么 `writer` 每次页面加载一个而不是每台设备一个：** 同一浏览器的两个标签页应该互相同步；如果共用设备 id，会把对方的写入当成回声丢掉。
- **`fields` 选项：** SDK 0.20 起实时订阅支持 `expand`/`filter`/`fields`（HIGH，SDK 变更记录）。是否对事件载荷生效需要在集成测试里确认（MEDIUM）；不生效时也只是推送变大，逻辑仍然正确，因为判断只用到这几个字段。
- **顺序：** 先订阅，再做首次读取；订阅期间到达的事件靠 `appliedUpdated` 去重。

### 把远端合并进全局 `state`，不破坏进行中的编辑

现状：`renderAll()` 全量重绘，会重置文本框（已知 N2、B1 行为），所以绝不能在用户输入时直接重绘。规则是**挂起，空闲再应用**：

```javascript
function isBusy() {
  return $('editor')?.open                                   // 编辑弹窗
      || isTyping()                                          // 焦点在 input/textarea/contenteditable
      || hasComposerDraft()                                  // 两个 composer 任一有未提交文字
      || reviewTimerPending                                  // 复盘 800ms 去抖中
      || docs.state.dirty || docs.state.saving;              // 本机有未上传改动
}

function applyRemote(kind, rec) {
  pending[kind] = rec;
  if (isBusy()) { showBanner('另一台设备有更新，编辑完成后自动应用 · 立即更新'); return; }
  flushPending();
}
function flushPending() {
  for (const kind of ['plan', 'state']) {                    // 先 plan 后 state
    const rec = pending[kind]; if (!rec) continue;
    delete pending[kind];
    if (kind === 'plan') plan = normalizePlan(rec.data); else state = normalize(rec.data);
    appliedUpdated[kind] = rec.updated; cacheWrite(kind, rec, /*dirty*/ false);
  }
  hideBanner(); renderAll();
}
// 重新检查的时机：editor 的 close 事件、document 的 focusout、composer 提交后、visibilitychange、2 秒间隔
```

- “本机有未上传改动”也算忙：此时远端事件与本机上传按整份最后写入为准，不在本机应用远端（见 Q3 的冲突说明）。
- 横幅上的“立即更新”是用户的明确选择，允许丢弃当前草稿；其余时候不动草稿。如果实现阶段发现 composer 的 `refresh()`（保留草稿的现有机制）可以复用，就在应用时顺带保留草稿，这条留给 plan-phase 核实。
- **整个 `state` 被替换是安全的：** 现有代码里 `load` 之后也是 `state = normalize(s)`，没有别处缓存旧引用。`wk`、`sel`、`view`、`filter` 这些界面游标不属于 state，应用远端后保持不变。

---

## Q3. 离线优先

### 本地缓存：用 localStorage，不用 IndexedDB

- `pagehide` 时只有同步写入才可靠（现有 `flush` 已经依赖这一点，CONCERNS 里写明 `db` 写入可能来不及完成）；IndexedDB 是异步的，页面关闭时可能丢。
- 文档大小在 4 MiB 以内；localStorage 容量约 5 MB 量级，**需要用测试断言保存失败（配额）会被显示出来**（旧代码的 `localStore.save` 已经会抛“浏览器存储不可用”）。如果将来逼近上限，再迁移到 IndexedDB，适配器接口不变。
- 键按用户分开：`usj:v2:<userId>:state`、`usj:v2:<userId>:plan`，值是 `{ data, baseUpdated, dirty, seq }`；另有 `usj:v2:lastUser`。**不复用** v1 的 `us-journey-tracker-v1`（那是旧本地模式的数据，保持原样，必要时提供一次性“导入旧本地数据”按钮）。
- 显式登出时清掉该用户的缓存；有 `dirty` 时先提示“有未上传的更改”。

### 脏位，不是队列

整份文档、最后写入为准，所以“队列”可以折叠成：最新的整份文档 + `dirty` + `seq`（本地每次修改加 1）。上传成功时只有 `seq` 没变才清 `dirty`（上传期间又改了就保持脏并立刻再传一次，这和现有 `flush` 的 `if(dirty)flush()` 一致）。

```javascript
function persist() { state_seq++; cacheWrite('state', { data: state, dirty: true });   // 同步，先落本机
                     clearTimeout(saveTimer); saveTimer = setTimeout(flush, 600); }
async function flush() {
  if (saving || !dirty) return;
  saving = true; const mySeq = state_seq;
  try {
    const { updated } = await store.save(clone(state));
    baseUpdated = updated; if (mySeq === state_seq) dirty = false;
    cacheWrite('state', { data: state, baseUpdated, dirty });
    retryDelay = 1000; setStatus(store.label);
  } catch (e) {
    setStatus('离线，改动已保存在本机，联网后自动上传');   // 保持 dirty
    scheduleRetry();                                        // 1s、2s、5s…封顶 60s
  }
  saving = false; if (dirty && !retryPending) flush();
}
```

这顺带修掉了 v1 已知问题“保存失败后不重试”（CONCERNS）。

### 重连检测

`navigator.onLine` 只是提示（captive portal、被干扰的链路下常常说谎），以请求是否成功为准。立即触发 `sync()` 的信号：

1. SDK 的 `PB_CONNECT`（每次重连都有，见上）；
2. `window` 的 `online` 事件；
3. `document` 的 `visibilitychange` 变为可见（手机后台会挂起 SSE）；
4. 重试定时器到期；
5. 任意一次请求成功。

`sync()` = 若本机 dirty 先上传，再用 `getOne(id, { fields: 'updated,writer' })` 查元数据，只有服务器更新时才取整份并走对账。这比每 5 分钟拉整份便宜。

### 首次加载 / 重连时的对账表

`local` = 缓存里的 `{data, baseUpdated, dirty}`，`server` = 服务器记录。比较一律用服务器签发的 `updated` 字符串（同一格式，可按字典序比较），不使用客户端时间。

| local | server | 动作 |
|-------|--------|------|
| 无 | 无 | 新账号：用 `DEFAULT_PLAN` 和空 state 创建两条记录 |
| 无 | 有 | 用服务器版本，写缓存 |
| 有且不脏 | `updated` 与 `baseUpdated` 相同 | 已同步，直接使用 |
| 有且不脏 | 更新 | 用服务器版本，写缓存 |
| 有且脏 | `updated` 与 `baseUpdated` 相同 | 正常的离线编辑：上传本机版本 |
| 有且脏 | 更新（真冲突） | **最后上传为准**：先把服务器版本存成 `usj:v2:<id>:conflict`（只保留最近一份），再上传本机版本，提示“已用本机版本覆盖较新的云端版本，旧版本可在设置里导出” |
| 有 | 无 | 首次登录但本机有数据（例如记录是登录前产生的）：上传本机版本创建记录 |

**这张表没有解决的最重要的丢数据路径：** 手机上的缓存已经过期三天，用户一打开就记一笔；此时本机是“脏 + 服务器更新”，按“最后上传为准”会把电脑上这三天的记录整份覆盖掉。这不是用户预期里的“两边同时离线编辑”，而是普通的先开应用再记录。所以：

- **联网时，对账完成前不允许编辑**：用缓存先渲染（秒开），但 composer 和编辑入口禁用，状态栏显示“同步中…”，最多等约 3 秒；超时或失败则放开编辑，按离线处理（此时才可能出现真冲突）。
- 这直接修掉 v1 已知问题“加载完成前的编辑被丢弃”在 cloud 路径上的对应形态。

**可选升级（需用户在 discuss 阶段决定，默认不做）：** 真冲突时对 `logs` 按 `id` 做并集合并，避免整天的记录被覆盖。没有墓碑时无法区分“被删除”和“对方没有”，所以删除过的记录可能复活；这比丢整天记录轻，但改变了“最后上传为准”的字面含义。

多标签：同一浏览器两个标签共享缓存，靠服务器和 SSE 同步；离线时两个标签各自写缓存会互相覆盖，属于低概率场景，写进已知限制，不另做跨标签锁。

### 冷启动离线与应用外壳

“断网先存本地”的字面场景是页面已打开后掉线。如果还要求**断网时能打开应用**（冷启动），单靠浏览器 HTTP 缓存不可靠，需要 Service Worker（`sw.js`，一个很小的同源文件，只缓存 HTML 和 SDK，不缓存 `/api/`）。这会让“单文件”变成“单文件加一个 sw.js 加一个 SDK”，需要在需求阶段明确是否纳入；本研究建议纳入，放在靠后的阶段。

---

## Q4. 计划外置

### 现状（只看结构，不复制个人内容）

- `CATS`：5 项，`{n 显示名, k 颜色键, presets[], direct?}`；`log.cat` 保存的是**显示名**；`.k-*` 样式按颜色键写在 CSS 里。
- `GROUPS`：7 项，`{p: "P1".."P7", name, cat, tasks: string[], note?}`；`BUILTIN` 由它生成，任务 id = `g.p + "-" + (i + 1)`。
- `LIFTS`：4 项，`{id, n, unit, def, target, note}`；`FIT_GOAL = [min, max]`。
- 引用点约 26 处，集中在 `presetsFor`、`allTasks`、`lift`、`normalize`、`renderWeek`、`renderGoals`、`renderTimeline`、editor 和 composer 的类别按钮，以及 `/^P\d-\d+$/` 的自定义任务判断。

### 目标数据形状

```typescript
type Plan = {
  v: 1;
  presets: { [catKey: string]: string[] };            // 类别名称和颜色保持在代码里，不外置
  groups: Array<{ id: string; name: string; cat: string; note?: string;
                  tasks: Array<{ id: string; text: string; archived?: boolean }> }>;
  lifts:  Array<{ id: string; n: string; unit: string; def: number; target: number; note?: string }>;
  fitGoal: [number, number];
};
```

- **类别不外置：** 5 个类别的名字写在每条历史记录里，改名会让旧记录“找不到类别”（`normalize` 会把未知类别改成“其他”）；颜色键和 CSS 绑定。只外置 `presets`。这一条与 PROJECT 里“类别显示名可以写进仓库”的决定一致。
- **示例计划：** `DEFAULT_PLAN` 是写在 HTML 里的**合成**常量，新账号首次登录时写入服务器；它同时是旧路径（local / claude）的默认计划。
- **形状兼容（一个需要决定的点）：** v1 的 154 条用例隐含依赖 7 个任务组、每组任务数、4 张力量卡、预设数量，以及 `tests/support/task-ids.ts` 里的位置 id。**让示例计划与原计划同形状（组数、每组任务数、力量项、类别预设数）**，v1 用例就几乎不用改；否则就要同步更新这些测试常量。推荐同形状，内容全部用合成文字。
- **隐私联动：** 个人计划文字移出 HTML 之后，HTML 本身不再含个人内容，`PRIVACY.md` 和隐私钩子里“应用文件不进 git”的规则可以重新评估。这是用户的决定，本研究不替用户决定，只标出来。
- **把用户自己的计划放进账号：** 不通过仓库。`tools/plan/extract-plan.mjs` 读取用户本机未入库的旧 HTML，把三个常量求值后写成被 git 忽略的 `plan.local.json`，再用编辑计划页的“导入计划”载入。另外两个人从示例计划开始自己编辑。

### 稳定 id 与迁移

1. **初始 id 沿用 `P<n>-<i>`**：`planFromLegacy(GROUPS)` 用与原代码完全相同的规则生成 id，所以 v1 导出的备份里的 `tasks["P3-2"]` 与新计划里的同一个任务一一对上，**导入的旧备份不需要改写任何 id**。
2. 编辑器新增的任务用 `t-<uid>`，新增的组用 `g-<uid>`；id 创建后永不改变；顺序用数组位置表示，所以重排不会影响完成状态（这直接解决 CONCERNS 里的“位置 id”问题）。
3. 删除：未完成的任务可以删；**已完成或设过截止日期的任务只能“归档”**（`archived: true`，不在目标页显示，但时间线和日历里“完成：…”的条目保留）。否则时间线里已完成的条目会因为找不到任务文字而变成空白或抛错。`state.tasks` 中孤儿 id 不清理。
4. `state.custom`（自定义待办，id 形如 `c-<uid>`）保持在 state 里，不并入 plan；判断是否自定义任务改为“在 `state.custom` 里”而不是正则。
5. `normalizePlan` 对 `id`、`group`、`cat` 用 `/^[A-Za-z0-9_-]{1,40}$/` 之类的白名单校验，不合格就拒绝整份计划。理由：计划文字和 id 现在会从服务器和编辑器进入 `innerHTML` 和 `data-*` 属性，CONCERNS 里列出的未转义插值点（`t.group`、`data-*`、`s.due`、力量 `cur`）这次被新功能直接碰到，**用校验保证它们天然安全，比在每个模板里补 `esc()` 改动更小**。文本字段继续走 `esc()`。
6. 计划的 `v` 字段留给将来迁移；state 也加 `v: 2`，`normalize` 只在缺失时补，不拒绝旧数据。

---

## Q5. 单文件里的认证流程

```
boot()
  ├─ cfg = window.USJ_CONFIG ?? readMeta()            # 无 backend → 旧路径，保持 v1 行为
  ├─ pb = new PocketBase(cfg.backend)                 # 默认 LocalAuthStore（localStorage，跨标签同步）
  ├─ lastUser = localStorage['usj:v2:lastUser']
  ├─ 有效 token ?
  │    是 → 显示应用外壳 → 用 lastUser 的缓存先渲染 → 后台 authRefresh()
  │    否且有 lastUser 缓存 → 以“离线只读缓存 + 登录横幅”进入（见下）
  │    否 → 显示 #login，隐藏应用
  └─ 登录成功 → 写 lastUser → 对账 → 订阅 → 放开编辑
```

- **登录页**是 HTML 里的一个 `<section id="login">`（邮箱、密码、一个按钮），应用外壳在拿到身份之前保持 `hidden`；v1 的布局和视图不变。错误提示用现有 toast：400 → “邮箱或密码不对”，网络失败 → “连不上服务器”。
- **token 存储：** SDK 默认 `LocalAuthStore` 使用 localStorage，没有 localStorage 时退回内存，并且通过 `storage` 事件在标签页之间同步登录状态（HIGH，SDK README / 变更记录 0.17.0）。不需要自己写。用 `pb.authStore.onChange` 处理另一个标签页登出。
- **刷新：** PocketBase token 无状态，没有服务器端登出接口，登出就是丢弃 token（HIGH，官方认证文档）。每次启动、之后每隔约 12 小时调用 `pb.collection('users').authRefresh()`；成功会拿到新的 `exp` 和最新用户资料，**不会让旧 token 失效**。
- **过期会话：**
  - `authRefresh` 返回 401/403/404（token 失效或账号被删）→ `authStore.clear()`，显示登录页和横幅，**不清本机缓存、不清 `dirty`**，文案写明“本机还有 N 条未上传的更改，登录后会自动上传”；
  - **离线时 token 已过期不能锁死应用**：只要存在 `lastUser` 的缓存，就允许从缓存打开并本机记录，恢复联网后上传若返回 401 再弹登录；
  - 不要因为 `authStore.isValid === false` 就丢缓存，它只检查 token 的本地 `exp`。
- **登出：** 顺序是 ① `await pb.realtime.unsubscribe()`（订阅清空后 SDK 会关掉 SSE，源码 `sendSubscriptions` 里 `!hasSubscriptionListeners → disconnect()`），② 清该用户缓存（有 `dirty` 先确认），③ `pb.authStore.clear()`，④ 显示登录页。**顺序不能反：** 实时连接在第一次订阅时绑定了身份，换账号后在旧连接上提交订阅会得到 403。
- **共用设备：** 3 个互相信任的使用者可以接受；缓存按用户分键，登出清理，不做更多。
- **SDK 自动取消：** SDK 默认把相同“方法 + 路径”的未完成请求自动取消（HIGH，README）。所有业务请求（`update`、`getOne`、`getFullList`）都传 `requestKey: null`，或在创建客户端后调用 `pb.autoCancellation(false)`，否则第二次保存会取消第一次，表现为偶发“丢保存”。

---

## Q6. 单台 VPS 的部署架构

**推荐：Caddy 在前，PocketBase 只监听 `127.0.0.1:8090`，由 PocketBase 的 `pb_public` 同源提供 HTML。**

| 选择 | 推荐 | 理由 |
|------|------|------|
| 谁终结 TLS | Caddy（自动签发和续期证书） | 自动 HTTPS；证书申请从香港/东京出口不依赖 ICP；PocketBase 不需要绑 80/443，也不需要 `setcap`（官方生产文档提到非 root 绑低端口的要求）。备选：PocketBase 直接 `serve <域名>` 也能自动签发（官方生产文档），进程更少，但没有访问日志、压缩和安全头的现成配置 |
| 谁提供 HTML | PocketBase `pb_public` | 同源 → 不需要 CORS，应用里 `backend` 默认就是 `location.origin`；部署 = 复制两个文件 |
| 实时 SSE 经过 Caddy | 不需要特别配置 | Caddy 对 `Content-Type: text/event-stream` 的响应会忽略 `flush_interval` 并立即刷新（HIGH，Caddy 官方文档）；读 / 写超时默认为无；建议设 `stream_close_delay 5m`，这样重载配置不会立刻掐断长连接 |
| 压缩 | Caddy `encode zstd gzip` | 减轻整份文档的下行体积 |
| 真实 IP | 在 PocketBase 设置里打开“用户 IP 代理头”（官方生产文档），否则限流和日志只看到 Caddy 的 127.0.0.1 |

```
# Caddyfile.template（占位符，不写真实域名）
{$SITE_DOMAIN} {
    encode zstd gzip
    reverse_proxy 127.0.0.1:8090 {
        stream_close_delay 5m
    }
}
```

**进程守护（systemd）**——官方生产文档给出的要点（HIGH）：`Restart=always`、`RestartSec=5s`、`LimitNOFILE=4096`；另外建议用独立的非 root 用户运行，`ExecStart` 里用 `serve --http=127.0.0.1:8090`，并设置 `GOMEMLIMIT`（官方建议用它做软内存上限，小内存 VPS 上尤其有用）。首个管理员用 `pocketbase superuser create` 创建。

**防火墙：** 只开 22、80、443；8090 不对外。给管理员后台（`/_/`）打开 superuser MFA/OTP，并按官方文档用 superuser IP 白名单（v0.38.0+）限制后台入口；打开内置限流（v0.23.0+），登录接口的阈值调严一些。

**备份（三层）：**
1. PocketBase 内置定时备份（设置 → Backups，cron 加保留份数），写到本机；
2. **异地**：内置备份支持 S3 兼容存储（官方生产文档），**用单独的桶**；单台 VPS 的磁盘不算备份；
3. 用户自己的 JSON 导出（每个账号一份，见 Q8 导出导入阶段）。

至少做一次“从备份恢复到新机器”的演练再宣布可用。`pb_data` 很小，官方文档提到的“5GB 以上换策略”在这里不适用。

**升级：** PocketBase 还没有 1.0，次版本升级可能有不兼容变化（官方变更记录里 v0.40.0 就有控制台命令退出码和 JSON 解析实现的警告）。不自动更新；升级前先手动触发备份，读变更记录，再用 `pocketbase update`。JS SDK 与服务器版本要配套（SDK 0.22 起只支持服务器 0.23+；0.28.x 的新接口面向 0.40+），所以 `vendor/pocketbase.umd.js` 固定版本，并在 `deploy/` 记录“服务器 X ↔ SDK Y”。

**版本现状（需要在部署时用 `--version` 复核）：** GitHub Releases 最新为 v0.40.6（2026-10-23）；官方文档站页眉显示 v0.41.1，两者不一致；npm 上 `pocketbase` SDK 最新为 0.28.2。**以部署时下载到的二进制为准，并把确切版本写进 `PB-CONTRACT.md`。**

**同一个 HTML 在本地如何继续工作：**

- 配置缝 `window.USJ_CONFIG`：`{ backend: string | null }`。
  - 有 `backend` → cloud 路径；
  - `backend: null` → 旧路径（localStorage / `window.claude`），v1 全部用例走这里；
  - 生产里 HTML 的 `<meta name="usj-backend" content="same-origin">`，等价于 `location.origin`；本地开发时在 `pocketbase/` 里用本机 PocketBase 的 `pb_public`（链接到仓库根）就是同源，不需要改文件。
- 测试里 `AppHarness` 总是**显式**写 `USJ_CONFIG`（init script），所以 spec 文件和默认行为都不依赖环境。
- 隔离验证需要一个本机临时 PocketBase 二进制（下载 = 安装，**需要用户批准**，不进默认 `npm test`）。

**中国可访问性的两个风险（均需在最早阶段验证）：**

1. **服务器和域名在中国大陆网络下的可达性与稳定性**（SSE 长连接是否被中途重置）是最大的未知项，MEDIUM/LOW，只能用真机在中国网络下实测。SDK 会无限重连并在每次 `PB_CONNECT` 对账，所以被重置只会造成延迟而不是丢数据。建议在编码阶段之前先部署一个只有 PocketBase 加静态页的最小站点做“可达性探针”，让中国的使用者实测。
2. **Google Fonts 的 `<link>` 在中国可能长时间挂起而不是快速失败**，而样式表链接是渲染阻塞的（MEDIUM，业界已知问题）。v1 只验证了“离线时优雅退化”。建议在前端阶段把字体链接改成不阻塞渲染（或自托管子集），并保留现有的系统字体回退。

---

## Q7. 测试架构

### 选择：“假服务器、真 SDK”

在页面里替换 `window.fetch`（只拦截发往 `USJ_CONFIG.backend` 的请求）和 `window.EventSource`，由 Node 侧的 `FakePbServer` 通过 `exposeBinding` 保存状态（与 v1 的 `MockBackend` 同构：刷新后数据仍在、用例直接读 Node 内存、不走网络）。真实的 `pocketbase.umd.js` 照常运行。

| 方案 | 结论 | 理由 |
|------|------|------|
| 假 SDK（替换 `window.PocketBase`） | 不选 | 会遮住 SDK 自己的行为：自动取消请求、`authStore` 持久化和跨标签同步、`PB_CONNECT` 时序，这些正是集成里最容易出错的部分 |
| **假 `fetch` + 假 `EventSource`，真 SDK** | **选** | 覆盖应用和 SDK 的真实交互；协议面很窄（见下表） |
| Playwright `route.fulfill` 做 REST + SSE | 不选 | `route.fulfill` 一次性返回完整响应，无法保持 SSE 长连接并随时推送事件 |
| 对真实 PocketBase 跑默认用例 | 不选 | 违反“测试不连真实服务器”；且需要安装二进制 |

假服务器需要实现的协议面（来自官方 API 文档，HIGH）：

| 端点 | 行为 |
|------|------|
| `POST /api/collections/users/auth-with-password` | 返回 `{token, record}`；token 要做成带 `exp` 的 JWT 形状（SDK 的 `isValid` 在本地解码 `exp`，MEDIUM），不需要签名 |
| `POST /api/collections/users/auth-refresh` | 返回新 token |
| `GET /api/collections/journey_docs/records` | 只返回当前用户的记录（模拟 `listRule`） |
| `GET/PATCH /api/collections/journey_docs/records/:id` | 模拟 `viewRule` / `updateRule`，`updated` 用假服务器自己的单调时钟 |
| `POST …/records` | 模拟 `createRule` 与唯一索引冲突（400） |
| `GET /api/realtime` | 假 `EventSource`：先发 `PB_CONNECT`（`lastEventId` 为 clientId），再按订阅推 `{action, record}` |
| `POST /api/realtime` | 记录订阅主题；认证不一致返回 403；`clientId` 无效返回 404 |

可注入的行为（对应 v1 登记的 ERR-01..04）：网络失败（`status 0`）、401、慢响应、断开并重连 SSE、同一时刻第二台设备写入。**多设备**：同一个 `FakePbServer` 挂两个 page，写入时向另一个 page 的假 `EventSource` 推事件，就能不靠真实网络测实时同步和回声抑制。

**护栏联动：** v1 的网络护栏（route、解析规则、死代理）不用改，因为假服务器不产生网络请求。新增一条：任何发往 `/api/` 的真实请求都让用例失败，证明假服务器覆盖了应用发出的全部调用。固定时钟和 `manual` 时钟继续用于推进去抖、重试退避和 token 刷新计时。

### 哪些 v1 用例原样保留

关键设计：**保留旧的 `window.claude` 与 `localStorage` 路径**，由 `USJ_CONFIG.backend = null` 选中。这样 v1 的 154 条用例不需要改 spec，只改 harness 和少数平台用例。

| v1 用例组 | 结局 | 说明 |
|-----------|------|------|
| `platform/guardrails`、`environment`、`repo-hygiene`、`known-bugs-registry` | 保持不变 | 与存储无关；已知 bug 修好后对应 `test.fail` 会变红，这是预期提醒 |
| `platform/app-integrity`（sha256 基线） | **必须改** | v2 本来就要修改应用；改成“更新基线时需要显式确认”，或改为只校验部署产物哈希 |
| `platform/probes` | 基本保持 | PROBE-7（`exposeBinding` 早于页面脚本可用）继续是 cloud mock 的前提；涉及 `window.claude` 的探针保持有效 |
| `platform/mock-contract` + `CONTRACT.md` | 保持（只要保留 claude 路径） | 另写 `PB-CONTRACT.md` 记录 PocketBase 版本和假服务器的实现清单 |
| `storage/account-mode` | 保持 | 它测的是旧的 claude `db` 路径；新增 `e2e/cloud/` 测 cloud 路径 |
| `data`、`week`、`editor`、`calendar`、`goals`、`timeline`、`narrow`、`io`、`smoke` | **spec 不变** | 视图与存储无关；通过 `AppHarness` 的映射继续工作 |
| 依赖内置计划的断言（组数、位置 id、预设序号） | 保持，前提是示例计划与原计划**同形状** | 见 Q4 的“形状兼容”；否则更新 `tests/support/task-ids.ts` 等常量 |
| 导出用例（读取 `app.backend.downloads`） | 不变 | cloud 模式下应用没有 `window.claude.downloads`，导出走 Blob + `<a download>`；harness 用 init script 包装 `URL.createObjectURL` 和 `HTMLAnchorElement.prototype.click` 记录文件名与内容，仍然落到同一个 `backend.downloads` 门面，不用 Playwright 的下载事件（保持 v1 D-16），也不需要在应用里加测试专用钩子 |

`AppHarness` 的改动：

- `open({ mode: 'local' | 'account' | 'cloud', … })` 新增 `'cloud'`；
- 环境变量（例如 `USJ_TEST_MODE=cloud`）把 `'account'` 映射成 cloud，用同一套 spec 在**生产路径**上完整回归一遍：`npm test` 默认走快速的旧路径，发布前跑 `npm run test:cloud`。这样全套不翻倍，又不会让“发布的路径没被全量测过”。
- `FakePbServer` 提供与 `MockBackend` 相同的门面（`reads`、`writes`、`downloads`、`lastState()`、`seed()`），`expectAccountMode()` 的三项检查换成 cloud 版：状态栏文案、读取的是自己的记录、localStorage 里只有按用户分键的缓存而没有旧键。

**新增的 cloud 专属用例：** 登录成功 / 失败、过期会话保留缓存、对账表的 7 行逐行、编辑门控（对账前不可编辑）、离线编辑后重连上传、真冲突产生 `conflict` 快照、双设备实时同步、回声被忽略、编辑弹窗和草稿期间远端更新被挂起、登出顺序、plan 编辑与同步、同时首次创建的唯一索引冲突处理。

### 假服务器测不到的东西：规则隔离

假服务器是**我们自己写的**规则模拟，不能证明真实 PocketBase 的规则表达式正确。隔离是本里程碑最关键的安全属性，所以需要一个**独立的、手动运行、默认不在 `npm test` 里**的集成脚本 `tools/pb-rules-check/`：对本机临时 PocketBase 用两个合成账号断言——

- 用户 A 读 / 列 / 改 B 的记录：列表为空，查看和更新返回 404；
- 创建 `owner = B` 的记录 → 400；改自己记录的 `owner` 或 `kind` → 被拒；
- 匿名创建 `users` 记录 → 403（证明没有开放注册）；
- 删除 `journey_docs` → 被拒；
- 超过 `maxSize` 的 `data` → 400，4 MiB 以内成功。

需要下载一个 PocketBase 二进制，属于“安装”，要先得到用户批准。在服务器规则变更后和首次上线前必须各跑一次。

---

## Architectural Patterns

### Pattern 1：配置缝（Config Seam）
**What:** 一个全局只读对象决定数据路径，旧路径永远可选。
**When:** 需要同时保留 v1 回归防线和新的生产路径。
**Trade-offs:** 保留了在生产里已经没有用的 `window.claude` 分支和代码（体积小，已被测试覆盖）；等 v2 稳定之后再决定删除。

### Pattern 2：合并成一个脏位的“离线队列”
**What:** 整份文档加最后写入为准，使得队列退化为最新文档 + `dirty` + `seq`。
**When:** 写入是整份替换、冲突策略是最后写入为准。
**Trade-offs:** 简单、`pagehide` 可靠；代价是真冲突只能整份覆盖，所以要有 `conflict` 快照和对账期编辑门控。

### Pattern 3：写者标记的回声抑制
**What:** 记录里带 `writer`，订阅只取元数据，是自己就丢弃，否则再取全文。
**Trade-offs:** 多一个字段和一次 `getOne`；换来没有竞态、也没有整份推回给写入者。

### Pattern 4：空闲时应用远端更新
**What:** 远端更新先放入 `pending`，满足“不在编辑”再 `renderAll()`。
**Trade-offs:** 另一台设备的更新可能延迟显示；用横幅说明并提供手动立即更新。

---

## Data Flow

### 记一笔（cloud 路径）

```
用户提交 → addLog() 改 state → persist(): 同步写 localStorage(dirty) → 600ms 去抖
  → flush() → pbStore.save(data) = PATCH journey_docs/:id {data, writer}
  → 响应 {updated} → baseUpdated=updated, dirty=false, 更新缓存
  → 服务器推送 SSE 事件给其他设备 → 它们 writer≠自己 → getOne → 空闲时 renderAll()
```

### 启动

```
boot → 配置 → 认证状态 → 用缓存先渲染（编辑禁用）→ subscribe（先）→ getFullList（state+plan 一次取回）
     → reconcile 表 → 放开编辑 → 状态栏显示同步状态
```

### 保存失败 / 掉线

```
save 抛错 → 保持 dirty → 状态栏“离线…” → 退避重试
     → PB_CONNECT / online / 回到前台 触发 sync() → 对账 → 上传
```

### 导出 / 导入

- 导出：JSON 备份 = 当前账号的 `state`（可选附带 `plan`）；没有 `window.claude` 时用 Blob + `<a download>`。CSV 导出的内容逻辑不变。
- 导入：沿用 `normalize` → `confirm()` → 整体替换 → `persist()`。**导入在云端会通过实时同步覆盖所有设备**，所以风险比 v1 高：
  - 先把被替换的旧版本存进本机的 `…:conflict` 式快照，并在确认框文案里说明可恢复；
  - v1 已知 bug **N3**（导入 `{}` 这类合法 JSON 会清空全部数据）和 **B2**（取消后同一文件无法再选）在这个里程碑里升级为“必须处理”，因为错误导入会同步丢掉三台设备上的数据；修好后对应的 `test.fail` 用例会变红，要同步改成正常断言。
  - 旧备份里的 `P<n>-<i>` id 因“初始 id 沿用”而无需迁移；旧类别名由 `normalize` 现有的 `LEGACY` 映射处理。

---

## Scaling Considerations

| 规模 | 调整 |
|------|------|
| 3 个账号（目标） | 单进程 PocketBase + SQLite 绰绰有余；1 vCPU / 1 GB 内存的小机器即可，瓶颈不在服务器 |
| 单个账号的数据量 | 4 MiB 的 JSON 上限；超过约 70% 时在状态栏提示；写放大靠压缩和 `fields` 订阅缓解；到瓶颈再按 `kind = logs:<year>` 分片 |
| 更多账号（> 几十） | 不在范围内；那时再考虑逐条记录模型、批量接口和限流策略 |

**第一个瓶颈：** 整份文档的上传大小（手机弱网下 1 MB 级别的 PATCH 会明显变慢）。先看压缩和去抖；再考虑分片。
**第二个瓶颈：** `renderAll()` 全量重绘，在几千条记录规模之前不需要优化（CONCERNS 已经评估过）。

---

## Anti-Patterns

### Anti-Pattern 1：在过期缓存上直接允许编辑
**What people do:** 先用缓存秒开并马上允许记录，后台再对账。
**Why it's wrong:** 整份最后写入为准时，过期缓存上的第一笔记录会覆盖别的设备的新记录。
**Do this instead:** 联网时对账完成前（最多约 3 秒）禁用编辑；离线才直接放开。

### Anti-Pattern 2：把 `navigator.onLine` 当作连接状态
**Why it's wrong:** 被干扰的链路和 captive portal 下它不可靠。
**Do this instead:** 以请求成败和 `PB_CONNECT` 为准，把 `online` 事件只当作“现在试一次”的触发器。

### Anti-Pattern 3：收到远端事件立刻 `renderAll()`
**Why it's wrong:** `renderAll()` 会重置文本框和打开中的编辑弹窗里的输入（v1 已知 N2/B1 行为）。
**Do this instead:** 空闲时应用（见 Q2）。

### Anti-Pattern 4：用客户端时钟比较新旧
**Why it's wrong:** 手机和电脑的时钟、时区不一致。
**Do this instead:** 只比较服务器给的 `updated`。

### Anti-Pattern 5：登出时先清 token 再退订
**Why it's wrong:** 旧 SSE 连接绑定了旧身份，换账号后订阅会得到 403。
**Do this instead:** 先 `realtime.unsubscribe()`，再清缓存，再 `authStore.clear()`。

### Anti-Pattern 6：保存和读取不关闭自动取消
**Why it's wrong:** SDK 会取消相同方法加路径的未完成请求，造成“丢保存”。
**Do this instead:** `requestKey: null`。

### Anti-Pattern 7：让客户端能删除记录或改 `owner`
**Why it's wrong:** 一条误操作或一次 XSS 就能破坏隔离。
**Do this instead:** `deleteRule = null`，`updateRule` 禁止改 `owner` 和 `kind`，并用隔离脚本断言。

---

## 阶段顺序建议（Q8）

依赖关系：计划外置是对 26 处引用的纯前端重构，**最先做**，并且完全可以用 v1 的 154 条用例验证；假服务器与 harness 必须先于 cloud 前端；服务器规则要早于 cloud 前端的联调，因为假服务器的保真度要用真实 PocketBase 校验；部署有用户购买的等待时间，所以可达性探针要最早启动。

| # | 阶段 | 新增 / 修改 | 依赖 | 研究旗标 |
|---|------|-------------|------|----------|
| 0 | **可达性探针（并行轨道）**：最小 PocketBase + 一个静态页部署到候选 VPS，中国和美国的使用者实测访问和 SSE 稳定性；顺带决定服务器商和域名 | 新：`deploy/` 雏形 | 用户购买服务器和域名（需用户本人完成） | 需要实测；这是最大的未知项 |
| 1 | **计划外置与稳定 id**（无后端）：`plan` 全局对象、`normalizePlan`、`DEFAULT_PLAN`（合成、与原计划同形状）、`P<n>-<i>` 初始 id、自定义待办判断改法、id 白名单校验、配置缝 `USJ_CONFIG`；旧路径作为后备 | 改：渲染函数、`normalize`、`presetsFor`、`allTasks`、`lift`；新：计划模型 | 无 | 标准重构；**门槛是 v1 全套 154 条通过** |
| 2 | **PocketBase 模式与规则 + 隔离脚本**：`users` 与 `journey_docs`、迁移文件、`maxSize`、索引、规则、`tools/pb-rules-check`；本机临时 PocketBase | 新：`pocketbase/`、`tools/pb-rules-check/` | 可与阶段 1 并行；下载二进制需用户批准 | 需要核实：`users` 默认 `createRule`、`updateRule` 的 `:isset` 组合、实时 `fields` 是否生效 |
| 3 | **假 PocketBase 服务器与 cloud harness**：`FakePbServer`、`pb-runtime`、`AppHarness` 的 `cloud` 模式、`PB-CONTRACT.md`、新护栏 | 新：`tests/mocks/pb-*`；改：`tests/support/app.ts`、`app-integrity` | 阶段 1（计划形状）；阶段 2 提供协议样本 | 低；v1 已有同构经验 |
| 4 | **登录与 cloud 存储（在线路径）**：登录页、`boot()`、`makeDocStore`、对账表前四行、首次创建、`authRefresh`、登出、`writer` 字段；同时修好首屏加载门控 | 新：Auth、`pbStore`、缓存；改：`init`、`persist`/`flush` | 阶段 1、2、3 | 标准；对账表需要逐行用例 |
| 5 | **离线优先**：`dirty` 位、退避重试、`online`/`visibilitychange`/`PB_CONNECT` 触发、真冲突快照、配额错误显示、`pagehide` | 改：`flush`、状态栏；新：重试与冲突模块 | 阶段 4 | 中等：要用 `manual` 时钟覆盖退避与去抖 |
| 6 | **实时同步**：订阅、回声抑制、空闲应用、横幅、双设备用例 | 新：Sync 控制器 | 阶段 4、5 | 中等：与真实 SSE 的差异靠阶段 2 的脚本和阶段 9 的真机验证 |
| 7 | **编辑计划页**：任务组 / 任务 / 力量项 / 预设标签的增删改与归档、计划导入导出、`extract-plan` 工具 | 新：计划编辑器、`tools/plan/` | 阶段 1、4（计划要能保存到云端）；最好在 6 之后（计划实时同步） | 这是工作量最大的 UI；需要 UI 设计契约 |
| 8 | **导出导入与数据迁移**：Blob 下载、按账号 JSON 备份、导入前快照、处理 N3 和 B2、从 Artifact 导出文件迁移的演练（只用合成文件） | 改：导出导入；新：快照 | 阶段 4 | 标准；N3/B2 修复要改 v1 的 `test.fail` |
| 9 | **正式部署**：Caddy、systemd、防火墙、内置备份加异地、`deploy/` 脚本、字体链接改造、可选 `sw.js` | 新：`deploy/`；改：HTML 头部 | 阶段 0 的结论、阶段 2 | 备份恢复演练和升级演练必须做；脚本执行前需用户批准 |
| 10 | **验收**：两台真实设备、中国和美国网络、`npm run test:cloud` 全量、隔离脚本对线上同版本再跑一次（只用合成账号）、文档 | — | 全部 | — |

**顺序理由：** 最大风险（重构渲染引用）先在最强的回归防线下完成；先有假服务器再写 cloud 前端，可以测试驱动；服务器规则先于联调，防止假服务器和现实偏离；实时放在离线之后，因为 `PB_CONNECT` 对账同时依赖两者；计划编辑器依赖云端存储，放在后面；部署前置的是“用户购买”这条长等待，而不是部署本身。

**研究旗标汇总：** 阶段 0（可达性）和阶段 7（编辑器 UI 设计）需要专门处理；阶段 2 需要用真实 PocketBase 证实 MEDIUM 项；其余是标准模式。

---

## Integration Points

### External Services

| 服务 | 集成方式 | 注意 |
|------|----------|------|
| PocketBase（自己的 VPS） | JS SDK（同源 UMD）走 REST + SSE | 固定服务器与 SDK 版本；SDK 需要 `requestKey: null` |
| Let's Encrypt | 由 Caddy 自动申请 | 需要域名解析到 VPS，80 和 443 可达 |
| S3 兼容对象存储（异地备份） | PocketBase 内置备份设置 | 使用单独的桶；密钥只放在服务器设置里，不进仓库 |
| Google Fonts | 现有 `<link>` | 在中国可能挂起，需要改成不阻塞或自托管 |
| Claude Artifact 托管版 | **不接触** | 迁移靠用户自己导出 JSON 再导入 |

### Internal Boundaries

| 边界 | 通信 | 注意 |
|------|------|------|
| `render*` ↔ `plan` / `state` | 直接读全局 | 只有 Sync 控制器可以整体替换这两个对象 |
| Sync 控制器 ↔ `DocStore` | 方法调用和回调 | 控制器不认识 PocketBase，只认识接口；旧路径适配器没有 `subscribe` |
| 应用 ↔ SDK | 仅 `pbStore` 内部 | 其他代码不得直接调用 `pb.*` |
| 应用 ↔ 假服务器 | `fetch`/`EventSource` 层 | 假服务器只模拟文档里写明的协议面 |
| 页面 ↔ Node（测试） | `exposeBinding`（同 v1） | 不产生网络请求，护栏不变 |

---

## 待验证项（LOW/MEDIUM，进入对应阶段前核实）

1. 新建 `users` 集合的默认 `createRule`（是否默认开放注册）——阶段 2 用隔离脚本断言。
2. `updateRule` 中 `@request.body.owner:isset = false` 与其他条件的组合行为——阶段 2。
3. 实时订阅的 `fields` 选项是否真的裁剪事件载荷——阶段 2；不生效时只影响带宽。
4. 认证 token 的默认有效期——阶段 2 直接显式设置。
5. SDK 的 `authStore.isValid` 如何解码 token——阶段 3 做假服务器时核对。
6. PocketBase 版本：Releases 最新 v0.40.6 与文档站页眉 v0.41.1 不一致——阶段 0/9 以下载到的二进制为准。
7. 中国网络下的可达性、SSE 稳定性、Google Fonts 挂起时长——阶段 0 实测。
8. 是否要求断网冷启动（Service Worker）——需求阶段由用户决定。
9. 真冲突时是否用 `logs` 并集合并代替整份覆盖——discuss 阶段由用户决定。
10. 示例计划与原计划是否同形状（决定 v1 常量是否需要更新），以及移除个人计划文字后应用文件是否可以入库——需求或讨论阶段由用户决定。

## Sources

- PocketBase 实时 API（SSE、`PB_CONNECT`、订阅鉴权、5 分钟断开）：https://pocketbase.io/docs/api-realtime/ — HIGH
- PocketBase API 规则与过滤（`null`/空串/表达式、`@request.*`、`:isset`、`:changed`）：https://pocketbase.io/docs/api-rules-and-filters/ — HIGH
- PocketBase 集合与字段类型：https://pocketbase.io/docs/collections/ — HIGH（JSON 字段限制页面未写，靠下一条）
- JSON 字段 `maxSize` 默认 1 MiB：https://pocketbase.io/jsvm/interfaces/core.JSONField.html 与上游源码 `core/field_json.go` — HIGH
- PocketBase 记录 API（端点、`fields`、批量）：https://pocketbase.io/docs/api-records/ — HIGH
- PocketBase 认证（无登出接口、`authRefresh` 不使旧 token 失效、标识字段需唯一索引）：https://pocketbase.io/docs/authentication/ — HIGH
- PocketBase 生产部署（systemd、Let's Encrypt、反向代理、备份、限流、`GOMEMLIMIT`、superuser IP 白名单）：https://pocketbase.io/docs/going-to-production/ — HIGH
- PocketBase JS 钩子（`onRecordAfterCreateSuccess` 等）：https://pocketbase.io/docs/js-event-hooks/ — HIGH
- PocketBase 变更记录：https://github.com/pocketbase/pocketbase/blob/master/CHANGELOG.md；Releases：https://github.com/pocketbase/pocketbase/releases — HIGH（版本号以复核为准）
- JS SDK README（`LocalAuthStore`、自动取消、`requestKey`、`beforeSend`）：https://github.com/pocketbase/js-sdk — HIGH
- JS SDK 变更记录（0.22 起要求服务器 0.23+、实时选项 0.20+、跨标签同步 0.17）：https://github.com/pocketbase/js-sdk/blob/master/CHANGELOG.md — HIGH
- JS SDK 实时源码（重连间隔、`PB_CONNECT`、无订阅即断开）：https://github.com/pocketbase/js-sdk/blob/master/src/services/RealtimeService.ts — HIGH
- Caddy `reverse_proxy`（`text/event-stream` 自动刷新、`stream_close_delay`、默认无超时）：https://caddyserver.com/docs/caddyfile/directives/reverse_proxy — HIGH
- npm `pocketbase` 最新版本 0.28.2；0.28.1 的 `dist/pocketbase.umd.js` 约 40 KB — HIGH（直接读取）
- 项目内部：`.planning/PROJECT.md`、`.planning/codebase/ARCHITECTURE.md`、`INTEGRATIONS.md`、`CONCERNS.md`、`TESTING.md`、`tests/README.md`、`tests/mocks/CONTRACT.md` — HIGH

---
*Architecture research for: 单文件原生 JS 应用 + PocketBase（v2.0 多账号云端版）*
*Researched: 2026-11-05*
