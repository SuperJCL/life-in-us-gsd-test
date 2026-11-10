# Roadmap: 在美国的日子 — 本地测试实验

## Milestones

- ✅ **v1.0 本地测试环境（Local Test Harness）** — Phases 1–5（shipped 2026-11-05）
- 🚧 **v2.0 多账号云端版（Multi-account Cloud）** — Phases 6–13（in progress）

## Phases

<details>
<summary>✅ v1.0 本地测试环境（Local Test Harness）（Phases 1–5）— SHIPPED 2026-11-05</summary>

- [x] Phase 1: 测试环境、护栏与本地切片（Harness & Local Slice）（4/4 plans）— completed 2026-11-01
- [x] Phase 2: 账户模式、合成数据与导出（Account Mock, Data & Export）（5/5 plans）— completed 2026-11-03
- [x] Phase 3: 记一笔、编辑弹窗与本周视图（Composer, Editor & Week）（4/4 plans）— completed 2026-11-03
- [x] Phase 4: 日历与目标视图（Calendar & Goals）（3/3 plans）— completed 2026-11-03
- [x] Phase 5: 时间线、导入与窄屏（Timeline, Import & Narrow）（4/4 plans）— completed 2026-11-05

完整的阶段详情：`.planning/milestones/v1.0-ROADMAP.md`；需求归档：`.planning/milestones/v1.0-REQUIREMENTS.md`；阶段目录：`.planning/milestones/v1.0-phases/`。

</details>

### 🚧 v2.0 多账号云端版（Multi-account Cloud）（In Progress）

**Milestone Goal:** 把「在美国的日子」做成 3 个人各自登录、数据存在所有者自己的 PocketBase 服务器上、手机和电脑实时同步的网页应用，中国和美国都能访问。

**Overview:** 阶段按“不可逆程度”排序。所有者的采购和中美可达性实测最先启动，并且一直并行，因为它要等待，结果又决定服务器地区。代码部分先在 154 条 v1 用例的保护下做最大的重构：把个人计划移出代码、冻结任务 id、补上转义，去个人化的应用文件由此可以公开。接着在本机真实 PocketBase 上证明规则能隔离账号，并按真实协议样本做出假服务器，之后的云端功能都先写测试再写代码。然后依次接入登录和云端存储、离线和实时同步、严格的导入导出与迁移、编辑计划页。最后正式部署、加固、备份，并在中国大陆和美国的两台真实设备上验收。

**所有阶段共同遵守的约束：**
- 四个视图的界面和操作方式不变；新界面只有登录页和编辑计划页。状态栏文字、导入摘要确认和远端更新提示属于需求内的最小改动。
- 托管的 Claude Artifact 不访问、不修改、不发布。迁移只靠所有者自己导出的 JSON，原 Artifact 保持原样作后备。
- 测试只用合成数据，不连接任何真实服务器（包括所有者自己的服务器），运行时拦截所有外部请求。真实 PocketBase 只在一次性的本机实例上运行，不进默认的 `npm test`。
- 公开仓库里不放服务器地址、域名、密钥、后台密码、真实数据和个人计划文字。应用文件要等 Phase 7 去掉个人计划之后才能进仓库，提交和推送前照常跑隐私检查。
- 本机测试一律低优先级、1 个 worker、不并发；只装项目内的 npm devDependency，用本机 Edge，不下载浏览器。下载 PocketBase 二进制、在服务器上执行脚本，都要所有者事先批准。
- 购买、注册、付款和输入密码都由所有者本人完成；Claude 只写步骤和脚本。
- 前端保持原生单文件，不引入框架；PocketBase 固定 0.41.1，JS SDK 固定 0.28.1（同源托管的 pocketbase.iife.js，sha256 固定在 tools/probe/page/vendor/SHA256SUMS，06 D-15）。
- v1 的 154 条用例在每个阶段结束时都要通过（Phase 7 起走旧路径）。已知 bug 在本里程碑修好之前，继续按 `tests/KNOWN-BUGS.md` 的约定标记。

**Phase Numbering:**
- 整数阶段（6、7、8）：本里程碑计划内的工作，编号接着 v1.0 的 Phase 5
- 小数阶段（7.1、7.2）：计划之后紧急插入的工作（标注 INSERTED）

- [x] **Phase 6: 采购与中美可达性实测（Procurement & Reachability Probe）** - 所有者买好香港服务器和域名，最小站点用 HTTPS 打开，晚高峰从大陆三网和美国实测；服务器地址和域名先被隐私检查挡住（所有者并行轨道） (completed 2026-11-08)
- [x] **Phase 7: 计划外置、稳定 id 与转义（Plan Extraction, Stable IDs & Escaping）** - 个人计划移出代码、只留合成示例计划，冻结任务 id，统一转义；154 条 v1 用例全过，去个人化的应用文件进入公开仓库 (completed 2026-11-07)
- [x] **Phase 8: PocketBase 规则、隔离与假服务器（Rules, Isolation & Fake Server）** - 用迁移文件定义集合和规则，在一次性本机 PocketBase 上证明账号隔离；按真实协议样本做出假服务器和 cloud 测试模式 (completed 2026-11-08)
- [x] **Phase 9: 登录与云端存储（Login & Cloud Storage）** - 登录、退出、会话保持；记录和个人计划按账号存在服务器上；先对账再允许编辑；页面只加载同源资源 (completed 2026-11-09)
- [ ] **Phase 10: 离线与实时同步（Offline & Realtime Sync）** - 断网先存、联网自动上传；同账号多设备几秒内同步且不毁草稿；状态栏五种状态；保存失败和登录过期都不丢数据
- [ ] **Phase 11: 导出、导入与迁移（Export, Import & Migration）** - 按账号导出 JSON 和 CSV；导入先识别、摘要确认、快照可撤销；修 N3、B2；旧 Artifact 备份的迁移先用合成文件演练
- [ ] **Phase 12: 编辑计划页（Plan Editor）** - 在应用里增删改、排序和归档个人计划，草稿式保存，跨设备同步
- [ ] **Phase 13: 部署、加固与验收（Deploy, Hardening & Acceptance）** - 正式部署、重启自恢复、每日异地备份和恢复演练、CSP 与后台加固、冷启动离线（含断网刷新）；两台真实设备在大陆和美国验收

## Phase Details

### Phase 6: 采购与中美可达性实测（Procurement & Reachability Probe）

**Goal:** 所有者买好香港服务器和域名后，一个只有 PocketBase 和探针页的最小站点能用域名通过 HTTPS 打开。晚高峰从中国大陆三网和美国实测过打开、登录和实时连接，结论写成实测结果、已知限制和做过的调整，作为 Phase 10 和 Phase 13 的输入（不论结果都继续用阿里云香港）。服务器地址、域名和凭据从出现那一刻起，就被隐私检查挡在公开仓库之外。
**Depends on:** Nothing（v2.0 第一个阶段；所有者并行轨道，代码部分做完后只等采购和实测）
**Requirements:** INFRA-01, INFRA-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. 域名和服务器地址出现之前，隐私检查已经能拦住它们：提交含真实域名、服务器 IP、PocketBase 令牌形状的字符串、后台密码、`pb_data` 目录或真实备份的改动时，pre-commit 和 pre-push 都会失败。真实值只记在被 git 忽略的本机清单里，每条新规则都有一条故意违规的自检。
  2. 服务器和域名由所有者本人购买（阿里云轻量应用服务器香港，Porkbun 托管的 `.vip` 域名），Claude 不注册、不付款、不输入密码。按所有者批准的步骤装好固定版本、核对过校验和的 PocketBase，由服务器上已有的 nginx 反向代理（实时连接关闭代理缓冲、用 HTTP/1.1、读超时足够长）后，用域名能通过 HTTPS 打开探针页；证书由已有的 certbot 自动续期，改过 nginx 之后 `certbot renew --dry-run` 仍然通过。
  3. 在 20:00–23:00 晚高峰，分别用中国大陆电信、联通、移动和美国网络打开探针页，用合成探针账号登录，并保持实时连接一段时间。每次的首屏时间、登录结果、实时连接是否中断都记录在阶段目录里，记录中不含服务器地址和域名。（2026-11-08 所有者修订 D-10，缩减了范围：实际只有美国 1 次 90 秒短测和国内三网的一次非晚高峰拨测基线，没有国内浏览器实测，详见 06-PROBE-RESULTS.md；国内真实设备的完整验收放到 Phase 13。）
  4. 根据实测写下结论，分实测结果、已知限制、做过的调整三部分（不论结果都继续用阿里云香港，不更换服务商），作为 Phase 10（重连后补拉、兜底轮询间隔）和 Phase 13 部署的输入。探针站点上只有合成探针账号，没有任何真实数据。
**Plans:** 10/10 plans complete
Plans:
**Wave 1**
- [x] 06-01-PLAN.md — 隐私检查新规则：令牌形状、口令赋值、公网 IPv4、数据目录和备份路径；规则 D 不区分大小写并有确定性自检（D-11、D-12、D-18）
- [x] 06-02-PLAN.md — 规划文档改成阿里云香港、`.vip`、nginx 加 certbot，结论交给 Phase 10/13；STATE 记 SDK 版本待办（D-01、D-02、D-08、D-13、D-15）
- [x] 06-03-PLAN.md — 探针结果字段契约 schema.json 与比对工具 schema-check.mjs；汇总脚本 summarize.mjs：判定、2/3 分级、时段、有效性过滤、可重跑复核的 --block 输出，带边界自检（D-06、D-07、D-18）

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-04-PLAN.md — 真实钩子演练 pre-commit 和 pre-push 都会失败（不绕过钩子）；.gitignore、.gitattributes、PRIVACY.md 同步；输出过滤器 redact.mjs

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-05-PLAN.md — 探针页（D-09，上传字段与 schema.json 一致）和所有者批准后下载的 SDK 0.28.1（D-15、D-17）
- [x] 06-06-PLAN.md — 只读状态脚本跑通 ssh 通道（D-04a）；批次 A 脚本（swap、安装 PocketBase、迁移和探针账号）；所有者按文件名和 sha256 批准（D-04）

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-07-PLAN.md — 外部检查 verify-site；批次 B 脚本（nginx 片段、锚点块检查与挂载、systemd unit、启动、探针页安装；依赖 06-05 的页面和 SDK）

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 06-08-PLAN.md — 只按批准清单上传并执行批次 A；所有者在网页终端建超级用户（D-05）；所有者按文件名和 sha256 批准批次 B

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 06-09-PLAN.md — 只按批准清单上传并执行批次 B，外部 14 项检查；所有者确认控制台防火墙并用 ?dur=90 自测

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 06-10-PLAN.md — 只读导出和汇总链路；所有者组织至少 3 个晚上的实测；结果文档（表格可重跑复核）和 D-08 三部分结论

**Cross-cutting constraints:**
- 服务器 IP、域名、令牌、口令只在本机被忽略的 private/；服务器输出一律经 redact.mjs 过滤；每个改服务器的脚本先给所有者看全文和 sha256、批准后才执行（D-04）；只上传批准清单里的文件，上传前、上传后和执行前各核对一次 sha256，任何文件在它所属的批次被批准前都不出现在服务器上；不推送
**UI hint**: no
**Research:** 需要（`/gsd-plan-phase --research-phase 6`）— 大陆线路只有二手资料，测法要先定好：工具、时段、指标，以及怎样判断 SSE 被中途断开。
**Notes:**
- 所有者操作：购买服务器和域名、配置 DNS、在服务器上设置超级用户密码。Claude 只写步骤和脚本，脚本在服务器上执行前要所有者批准。
- 探针站点只用于实测，Phase 13 正式部署时可以重装。正式加固之前，`/_/` 后台对公网开放，只放合成数据，超级用户用强密码，打开 PocketBase 自带的限流；两步验证和超级用户 IP 白名单留到 Phase 13。
- 本阶段不阻塞 Phase 7、8：等待采购和实测期间，可以先规划和执行后面的阶段。

### Phase 7: 计划外置、稳定 id 与转义（Plan Extraction, Stable IDs & Escaping）

**Goal:** 应用代码里不再含个人计划：目标组、任务、力量项、每周健身目标和基础预设都从一个 `plan` 对象读取，内置的只有一份合成示例计划。现有任务 id 冻结不变，用户文字和导入数据一律按纯文本显示。v1 的 154 条用例在改动后的应用上照样通过，去个人化的应用文件因此可以进入公开仓库。
**Depends on:** Nothing（不依赖 Phase 6，可以先行）
**Requirements:** PLAN-05, SEC-01, SEC-04, TEST-01
**Success Criteria** (what must be TRUE):
  1. `npm test`（低优先级、1 个 worker）在改动后的应用上跑完 v1 的 154 条用例，结果与 v1.0 收尾时相同，8 条已知 bug 标记用例照旧。这些用例走旧的 `window.claude`/localStorage 路径；sha256 基线随应用改动有意识地更新，改了应用却没更新基线时护栏会失败。
  2. 内置目标组和任务的 id 仍是 `P<n>` 和 `P<n>-<i>`：导入旧格式的合成备份后，每项任务进度都对应回原来的任务。判断“自定义待办”改为查计划，不再看 id 形状；以后新增的项有不会撞上旧 id 的命名规则（`g-`/`t-`/`l-` 前缀）。
  3. 用合成的恶意数据打开四个视图和编辑弹窗时，没有脚本执行，也没有多出元素。恶意数据放在记录文字、任务名、组名、id、日期和力量当前值里，包括 `<script>`、`<img onerror>` 和用引号断开属性。id 不符合白名单格式的数据，在加载和导入时被拒绝或清洗。
  4. 所有者的原计划文字先提取到被 git 忽略的本地种子文件，应用代码里只剩一份与原计划同形状、只含通用占位文字的合成示例计划。隐私检查改为从这份种子读取个人词条，含个人计划文字的应用版本仍然提交不了。
  5. 去个人化的 `us-journey-tracker.html` 进入公开仓库：干净克隆后不配置任何服务器，`npm test` 能直接跑通，打开页面看到示例计划和空记录。`PRIVACY.md`、隐私钩子和缺文件提示同步更新。
**Plans:** 7/7 plans complete
Plans:
**Wave 1**
- [x] 07-01-PLAN.md — 原件副本、本地种子和提取工具；隐私检查的规则 D 改读种子（D-06、D-10、D-12）

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-02-PLAN.md — 合成的 DEFAULT_PLAN 和 plan 对象、冻结 id、自定义待办查计划、旧备份映射用例（只跑目标 spec）

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-03-PLAN.md — USJ_CONFIG 配置缝（D-11）、SAFE-02 基线反向对照；完整套件 161 条，154 条 v1 用例照旧

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-04-PLAN.md — 所有者检查示例计划后，去个人化的应用连同护栏和文档一次提交（不推送）；钩子验收；干净克隆跑通全部用例

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 07-05-PLAN.md — 渲染防线：所有插值转义，绕过入口检查时恶意数据仍只是文字（D-09）

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 07-06-PLAN.md — 入口防线：导入坏 id 或日期整份拒绝、加载时自动修正不丢记录文字（D-07、D-08；只跑目标 spec）

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 07-07-PLAN.md — 两道防线合在一起的真实应用用例、测试说明；完整套件 173 条

**Cross-cutting constraints:**
- D-12：私有原件副本没有被改动，哈希仍是 v1 基线；应用文件在本计划结束时仍未被 git 跟踪（07-04 才进仓库）

**UI hint**: no
**Research:** 不需要（标准重构；门槛是 154 条用例全部通过）
**Notes:**
- 要改约 26 处对 `GROUPS`/`BUILTIN`/`GCAT`/`LIFTS`/`FIT_GOAL` 的引用；同时加入 `USJ_CONFIG` 配置缝，没配服务器时走旧路径。
- 预设标签保持两层：基础列表在计划里，增减记录在 state 里，composer 不改。
- 原应用文件在改动前另留一份不进 git 的副本；四个视图的界面和操作方式不变。

### Phase 8: PocketBase 规则、隔离与假服务器（Rules, Isolation & Fake Server）

**Goal:** 集合和规则写成可重放的迁移文件，并在一次性的本机真实 PocketBase 上用两个合成账号证明：网页上无法注册，账号之间读不到也改不了对方的数据。同时有一台按真实协议样本做成的 Node 侧假 PocketBase 和 cloud 测试模式。后面的云端功能可以先写测试再写代码，测试时不碰任何真实服务器。
**Depends on:** Phase 7（假服务器和测试数据用新的计划形状）
**Requirements:** ACCT-03, ACCT-04, TEST-02, TEST-04
**Success Criteria** (what must be TRUE):
  1. 在一次性的本机 PocketBase 0.41.1 上，隔离脚本用两个合成账号逐条断言并全部通过：匿名注册被拒；A 读不到、列不出、改不了、删不掉 B 的文档；更新时改 `owner` 或 `kind` 被拒；超过 4 MiB 的数据被拒；同一账号的同一种 `kind` 只能有一份。Windows 版二进制经所有者批准后只下载一次，留存在被 git 忽略的 tools/pb/bin/，每次运行前核对 sha256；实例只监听 127.0.0.1，数据目录放系统临时目录，用完删除（D-02）。
  2. 集合和规则只写在 `pb_migrations/` 里，只有结构，没有数据：`users` 的注册和自删除被显式关闭，OAuth 和 OTP 关闭，令牌有效期 90 天以上。对新实例重放迁移，得到同样的规则。隔离脚本不进默认的 `npm test`，用完删除临时实例和数据（程序本身留存）。
  3. `PB-CONTRACT.md` 写明“服务器 0.41.1 配 SDK 0.28.1”，并收录从本机真实实例录下的协议样本：登录、刷新令牌、读取、创建、更新、唯一索引冲突、401（只有 auth-refresh 返回；记录接口对无效令牌按未登录处理，返回空列表、404 或 400）和实时事件。契约自测证明，Node 侧假服务器对同一组请求的回应与样本一致。
  4. `AppHarness` 新增 cloud 模式：真实的 PocketBase SDK（同源提供、固定版本、记录 sha256）在浏览器里连到假服务器，能完成登录、读写和订阅，实时连接由页面侧的假 `EventSource` 承接。请求假服务器以外的任何地址都会让用例失败，这道护栏有故意违规的自检。`context.setOffline` 是否派发 `online`/`offline` 事件，由探针确认并写进 `tests/PROBES.md`。
  5. v1 的 154 条用例照旧通过；cloud 用例有单独的入口（如 `npm run test:cloud`），同样低优先级、1 个 worker 运行。
**Plans:** 7/7 plans complete
Plans:
**Wave 1**
- [x] 08-01-PLAN.md — users 加固和 journey_docs 的迁移（只有结构）、node:vm 静态检查与规则快照、篡改自检；先修正 ROADMAP 和研究文档的过时内容（D-02、D-04、D-05、D-06）
- [x] 08-02-PLAN.md — test:cloud 入口、同源 SDK 加哈希护栏、AppHarness cloud 模式、FakePbServer（REST 加实时）和页面侧假 EventSource

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-03-PLAN.md — 护栏 cloud 策略和故意违规自检、PROBE-9（setOffline）、README 和 PROBES.md、补上 v1 的 WR-05，默认完整套件一次
- [x] 08-04-PLAN.md — 所有者批准下载 PocketBase 0.41.1 Windows 版（blocking-human）、核对留存、一次性实例库和真实实例 smoke（D-02、D-03、D-17）

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-05-PLAN.md — 隔离脚本：47 个编号的断言矩阵（注册关闭、跨账号读写、防改写、4 MiB、唯一、journey_docs 和 users 的实时订阅、D-05 自改密码、令牌失效）、反向对照、新实例重放对比

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 08-06-PLAN.md — 协议样本录制与归一化（28 个场景，三道自检）、隐私检查器可被 import、PB-CONTRACT.md

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 08-07-PLAN.md — 契约自测：假服务器逐场景对齐真实样本；阶段收尾的完整 test:cloud（默认 npm test 由阶段回归门运行）
**UI hint**: no
**Research:** 需要（`/gsd-plan-phase --research-phase 8`）— 要在真实实例上确认几个 MEDIUM 项：`:isset` 组合规则、订阅的 `fields` 是否裁剪载荷、新建 `users` 的默认规则、令牌有效期的设置方法。
**Notes:**
- 所有者批准点：下载 PocketBase 二进制（留存在被 git 忽略的 tools/pb/bin/，实例和数据放系统临时目录、用完删除，只用合成数据）。批准之前，隔离验证这部分停下等待；假服务器可以先做，但协议样本要等真实实例确认后才算定稿。SDK 文件不走 npm 依赖、不走 CDN，获取方式在计划阶段定，需要下载时同样先经所有者批准。
- 集合按调研结论设计：`journey_docs`，每个账号两条（`kind` 为 `state` 和 `plan`），`(owner, kind)` 唯一索引，`deleteRule = null`，另有 `writer` 字段用于回声抑制。
- TEST-02 在本阶段打好基础（假服务器、cloud 模式、护栏），Phase 9–12 各自为新功能补 cloud 用例，Phase 13 用全量运行收口。

### Phase 9: 登录与云端存储（Login & Cloud Storage）

**Goal:** 用户用所有者在后台开好的账号登录后，记录、复盘、任务进度、力量历史和自己的个人计划都从服务器读写，换一台设备登录看到的是同一份数据。打开应用时先和服务器对账，再允许编辑，过期缓存不会覆盖别处的新数据。页面只加载同源资源。
**Depends on:** Phase 7, Phase 8
**Requirements:** ACCT-01, ACCT-02, SYNC-01, SYNC-05, PLAN-01, INFRA-03
**Success Criteria** (what must be TRUE):
  1. 用户在登录页输入账号和密码进入应用，刷新页面或关掉浏览器再打开后仍保持登录。登录页没有注册入口，密码错误时有明确提示。
  2. 用户退出登录后回到登录页，本机不再留有该账号的记录缓存、计划缓存和令牌。另一个合成账号随后在同一浏览器登录，看不到前一个账号的任何内容。
  3. 账号 A 在一台设备上记一笔、写复盘、勾选任务、保存力量值后，在另一台设备登录 A，看到同一份数据，四个视图按 A 自己的计划显示。账号 B 登录后看到的是 B 自己的计划和记录。
  4. 联网打开应用时，与服务器对账完成之前不能编辑（通常不超过约 3 秒）。本机缓存比服务器旧时以服务器为准，旧缓存不会被上传。真冲突时以最后保存的为准，被覆盖的那一版留在本机，用户可以下载。
  5. 打开云端版时，浏览器只向同源发请求：Google 字体的 `<link>` 已去掉，PocketBase SDK 从同源加载、版本固定。v1 的 154 条用例仍然通过，字体相关的探针和护栏随之调整。
**Plans:** 14/14 plans complete
Plans:
**Wave 1**
- [x] 09-01-PLAN.md — 云端 tracer（USJ_CONFIG 开关、同源 SDK 加 SRI、登录、按 kind 读取文档、云端保存），首次登录补建文档与启动时 authRefresh

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 09-02-PLAN.md — INFRA-03 收口：去掉 Google 字体、cloud 策略把字体主机记为违规、改写 v1 护栏和探针、同源与 SRI 用例

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 09-03-PLAN.md — 假服务器的显式错误注入开关（refuse、status、hold、revokeTokens、beforeNext、dropDocs）与各自自检

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 09-04-PLAN.md — 第二台设备的测试设施（openDevice、共享假服务器与护栏），跨设备读到同一份数据

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 09-05-PLAN.md — 本机缓存、对账表前几行、编辑门控与安全网、对账更新提示（D-01、D-04），B3 在云端路径修复

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 09-06-PLAN.md — 对账的时间推进：横幅、3 秒变慢、15 秒只读加重试、首次登录等待卡片、窗口内静默重试（D-02、D-03）

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 09-07-PLAN.md — 对账表其余行：缓存脏上传、用缓存重建、首次创建竞争、连刷幂等

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 09-08-PLAN.md — 真冲突留底与下载、单份替换、启动时冲突（D-08、D-09、D-10、D-11）

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 09-09-PLAN.md — 留底存不下、下载失败的如实告知与容量保护（SYNC-05 收口）

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 09-10-PLAN.md — 按账号计划、跨设备四个视图、不合格计划不被改写（SYNC-01、PLAN-01 收口）

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 09-11-PLAN.md — 登录过期保留本机修改、本地过期判定、重开浏览器保持登录

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 09-12-PLAN.md — 登录表单全部状态、上次邮箱预填、显示密码（ACCT-01 收口）

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 09-13-PLAN.md — 退出登录（D-06、D-07）、重复点击与离线退出、工具栏账号、跨标签页退出、README 总览

**Wave 14** *(blocked on Wave 13 completion)*
- [x] 09-14-PLAN.md — 退出确认框（D-05）、保存中退出、换账号确认（ACCT-02 收口），阶段收尾的完整 test:cloud
**UI hint**: yes
**Research:** 不需要专项研究。需要 UI 设计契约（`/gsd-ui-phase 9`）：登录页，以及状态栏五种状态（已同步、保存中、离线、失败重试、登录过期）和远端更新提示的文案与位置，Phase 10 直接沿用这份契约。
**Notes:**
- 这些必修项随本阶段落地：`pb.autoCancellation(false)`；每次联网启动都调用 `authRefresh()`；登出顺序是先退订、再清缓存、最后清令牌；去掉 `init()` 里“加载失败就静默回退本机”的逻辑；保存前检查文档大小，超过上限的 70% 时提示。
- 账号第一次登录时，由客户端创建自己的两份文档；遇到唯一索引冲突，就重新读取再更新。
- 用例都跑在 Phase 8 的假服务器上，多台设备用独立的浏览器上下文模拟。

### Phase 10: 离线与实时同步（Offline & Realtime Sync）

**Goal:** 断网时照常记录，联网后自动上传。同一账号在另一台设备上的修改，几秒内出现在这台设备上，并且不打断正在写的草稿或打开的编辑框。状态栏始终如实显示同步状态，保存失败和登录过期都不会丢数据。
**Depends on:** Phase 9
**Requirements:** ACCT-05, SYNC-02, SYNC-03, SYNC-04, SYNC-06
**Success Criteria** (what must be TRUE):
  1. 断网后用户照常记一笔、改记录、勾选任务，状态栏显示“离线”和待上传的数量。连不上服务器时刷新页面（页面仍从本机加载、服务器连不上），待上传的修改和数量还在；恢复联网后自动上传，数量归零，另一台设备随后能看到。真正断网时刷新也能打开页面，由 Phase 13 的 Service Worker 负责（所有者 2026-11-10 确认，10-CONTEXT D-08）。
  2. 设备 A 的修改几秒内出现在同一账号的设备 B 上。B 正在写草稿、打开编辑框或焦点在输入框里时，远端更新先挂起并给出提示，等 B 空闲后再应用，草稿和编辑框里的内容不丢。B 自己的保存不会回声成一次远端更新。
  3. 实时连接断开再重连、页面回到前台、重新联网时，都会整份对账，断开期间别的设备做的修改不会漏掉。
  4. 状态栏在已同步、保存中、离线、失败重试、登录过期五种状态之间如实切换，每种状态都有用例在假服务器上触发并检查文案。服务器暂时出错时保存会自动退避重试，修改不会被悄悄丢掉（修 B5）；应用加载完成之前做的修改也不会丢（修 B3）。
  5. 登录过期时状态栏提示重新登录，本机未上传的修改保留。用同一账号重新登录后继续上传，服务器上的数据包含过期期间的修改。
**Plans:** 9 plans
Plans:
**Wave 1**
- [ ] 10-01-PLAN.md — 离线先存与自动重试 tracer：单线程同步入口（Promise 在覆盖本次请求的同步结束后才 resolve）、offline 与待上传数量、retrying 倒计时与立即重试、15 秒超时（B5、WR-02）；移除旧保存函数和 cloudStore 的 save 字段；Phase 9 保存失败用例迁移；完整默认 npm test

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 10-02-PLAN.md — 假服务器的实时断开、实时拒绝、按设备的故障和写入方记录；PROBE-10 用本地来源回答调研问题（与 10-01 文件不重叠，但都跑 test:cloud，按单 worker、不并发排在其后）

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 10-03-PLAN.md — 打开时连不上也能记（D-01、D-02）、离线后的真冲突留底（D-03）、连不上服务器时刷新后数量仍在（D-08、B3）；冲突提示不被替换（IN-01）

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 10-04-PLAN.md — 每个修改经 commit 报告条目（D-07）；已上传的操作离开操作记录、run 幂等（重做的前提）；任何一步离线失败都使 opsOk 为假（离线重连走 D-03）；完整默认 npm test

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 10-05-PLAN.md — 用着用着登录过期不丢、重新登录后上传（ACCT-05）；写入方 id 每个标签页一个（WR-01）

**Wave 6** *(blocked on Wave 5 completion)*
- [ ] 10-06-PLAN.md — 远端更新：60 秒拉取与立即对账、远端版本进挂起槽、忙碌挂起空闲应用（横幅期间局部重绘也不显示远端内容）、D-04 重做、D-05 现在更新、D-06 加回

**Wave 7** *(blocked on Wave 6 completion)*
- [ ] 10-07-PLAN.md — 在线晚一步保存两边都保留（以挂起槽里的服务器版本为底重做）；重做不重放已上传的操作（回归用例）；列表请求离线失败后重连仍走 D-03（回归用例）；Phase 9 留底用例改为离线构造

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 10-08-PLAN.md — 实时订阅：几秒内同步、回声抑制；受实时影响的用例改为确定写法，完整 test:cloud

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 10-09-PLAN.md — 实时断开重连整份对账、首次连接失败后重新订阅、过期时退订；同一浏览器两个标签页离线互不丢修改（storage 事件）；README 与 KNOWN-BUGS，完整 test:cloud 和默认 npm test

**Cross-cutting constraints:**
- 只改云端路径，旧路径和 v1 用例不变；每次改应用都在同一次提交里重新记录 APP_SHA256；测试一律低优先级、1 个 worker、不并发；服务器侧故障只用假服务器开关，`setOffline` 只派发 online/offline 事件
**UI hint**: no
**Research:** 需要（`/gsd-plan-phase --research-phase 10`）— SSE 断线后是否补发、`PB_CONNECT` 之后的对账时机、`fields` 对事件载荷的效果，以及断网和退避在 manual 时钟下怎么测。状态栏和远端更新提示沿用 Phase 9 的 UI 设计契约，不另做。
**Notes:**
- 先做离线，再加实时：`dirty` 和 `seq` 落盘，保存失败不清脏标记，首次对账之前不上传；之后再加订阅，按 `kind` 分派，用 `writer` 抑制回声，空闲时才应用远端更新。
- 拉取是基线，实时只是加速；断网恢复、重连、回到前台都走同一套对账。
- 冲突仍以整份文档最后保存的为准；logs 按 id 合并是 SYNC-F1，留到以后。

### Phase 11: 导出、导入与迁移（Export, Import & Migration）

**Goal:** 用户在手机和电脑上都能下载自己账号的 JSON 备份和日历 CSV。导入先识别格式、显示摘要，确认后才替换；导入前自动留快照，导入后可以撤销。所有者能把原 Artifact 导出的旧备份连同个人计划搬进新账号，整个流程先用合成文件演练过。
**Depends on:** Phase 9（导入后要写入服务器；云端版里没有 Claude 的 `downloads`）
**Requirements:** IO-06, IO-07, IO-08, IO-09, IO-10, TEST-03
**Success Criteria** (what must be TRUE):
  1. 云端版在手机宽度和桌面宽度下，都能用浏览器原生下载拿到本账号的 JSON 备份和日历 CSV，不再依赖 Claude 的 `downloads`；文件内容与当前账号的数据一致。
  2. 选择不是备份的文件（包括 `{}`、空数组、普通 JSON 和非 JSON）时直接拒绝并提示，账号数据保持不变（修 N3）。v1 中 N3 和 B2 的 `test.fail` 用例翻转为正常通过的断言，`tests/KNOWN-BUGS.md` 同步更新。
  3. 选择有效备份后，先显示摘要（记录条数、日期范围、计划项数等）并要求确认。确认后替换并同步到服务器，导入前的数据自动留一份快照，用户可以撤销这次导入。取消导入后，能再次选择同一个文件（修 B2）。
  4. 原 Artifact 导出的旧格式备份（裸 state、旧类别名）和所有者的种子计划可以导入新账号：用合成的旧备份和合成种子计划演练，导入后记录、复盘、任务进度和力量历史都对应到正确的任务和日期。生成种子计划的脚本只在本机运行，输出文件被 git 忽略。
**Plans:** TBD
**UI hint**: no
**Research:** 不需要
**Notes:**
- 导出改用 Blob 下载，去掉 `window.__dl`；顺带修 CSV 公式注入（B7，调研列为必修）。
- 导入区分三种文件：新的包装格式、旧的裸 state、非备份。加载、实时和导入共用 Phase 7 的深度校验。
- 所有者的真实迁移在 Phase 13 线上部署之后进行，原 Artifact 保持原样作后备。

### Phase 12: 编辑计划页（Plan Editor）

**Goal:** 用户在应用的“编辑计划”页管理自己的目标组、任务、力量项、每周健身目标和基础预设标签，可以增删改，也可以调整顺序。编辑是草稿式的，点保存才生效，也可以取消。删除有进度的项时改为归档，历史不丢。保存后，同一账号的其他设备同步更新。
**Depends on:** Phase 10（计划跨设备同步）, Phase 11（严格导入和计划格式）
**Requirements:** PLAN-02, PLAN-03, PLAN-04
**Success Criteria** (what must be TRUE):
  1. 用户从应用里进入“编辑计划”页（走 `#plan` 路由，不新增第五个标签），能新增、改名、删除目标组、任务、力量项、每周健身目标和基础预设标签，并用上移、下移调整顺序。保存后，四个视图按新计划显示。
  2. 删除已经有进度的目标组、任务或力量项时，它被归档而不是硬删：日历和时间线里已完成的记录、力量历史仍然显示，归档的项可以恢复。
  3. 点取消后，计划完全不变；有未保存的修改时离开页面会先确认；空名称或超出规模上限的输入不能保存，并有提示。
  4. 在一台设备上保存计划后，同一账号的另一台设备几秒内按新计划显示。另一台设备如果正在编辑计划，它的草稿不会被远端更新冲掉。
  5. 新增的项拿到 `g-`/`t-`/`l-` 前缀的新 id，已有 id 保持不变；编辑计划后导出再导入，任务进度仍然对应到正确的任务。
**Plans:** TBD
**UI hint**: yes
**Research:** 不需要专项研究。需要 UI 设计契约（`/gsd-ui-phase 12`）：这是本里程碑工作量最大的界面，涉及排序、归档、草稿和校验。
**Notes:**
- 不做跨组移动和拖拽排序（PLAN-F1），也不做“恢复默认计划”。
- 预设仍是两层：本页只改基础列表，composer 里的增删照旧记在 state 里。

### Phase 13: 部署、加固与验收（Deploy, Hardening & Acceptance）

**Goal:** 应用正式部署到所有者的服务器：重启后自动恢复，每天自动备份并复制到异地，网站和后台入口都已加固。页面打开过一次后断网也能打开（包括断网时刷新页面，承接 Phase 10 的 D-08），也能添加到手机主屏幕。最后在中国大陆和美国的两台真实设备上验收同步与离线，所有者把自己的旧数据搬进新账号。
**Depends on:** Phase 6（实测结论和服务器）, Phase 12（前端定型）
**Requirements:** OPS-01, OPS-02, OPS-03, OPS-04, SEC-02
**Success Criteria** (what must be TRUE):
  1. 部署和升级按写好的步骤和 `deploy/` 模板脚本完成，服务器地址和密钥只在仓库外填写。PocketBase 固定 0.41.1，安装前核对校验和；每个脚本在服务器上执行前都经所有者批准。真的重启一次服务器后，PocketBase 和 HTTPS 自动恢复，不需要手动操作。
  2. 服务器每天自动备份数据库，并复制一份到 Cloudflare R2。做过一次恢复演练：用异地备份恢复出一个新实例，合成账号的数据完整。
  3. 网站响应带 CSP 和安全响应头，在 CSP 下四个视图、登录和编辑计划都正常工作。后台超级用户使用强密码和两步验证，登录有限流，代理 IP 头配置正确。用与线上相同的版本和迁移，在一次性实例上重跑隔离脚本（只用合成账号），全部通过。
  4. 页面打开过一次后，断网时重新打开也能进入应用并记录（冷启动离线）；断网时刷新页面也能打开，待上传的修改和数量还在（Phase 10 只验证了“连不上服务器时刷新”，见 10-CONTEXT D-08）；手机上可以把它添加到主屏幕；应用更新后，缓存会换成新版本。
  5. 两台真实设备分别在中国大陆和美国网络下验收：记一笔几秒内同步到同账号的另一台设备，断网时能记录，联网后自动上传。所有者把自己从原 Artifact 导出的旧备份和种子计划导入自己的账号，数据对应正确。最后 `npm test` 和 `npm run test:cloud` 全量通过。
**Plans:** TBD
**UI hint**: no
**Research:** 需要（`/gsd-plan-phase --research-phase 13`）— CSP 能否用哈希兼容单文件里的内联脚本、nginx 反代 SSE 的长期表现（以 Phase 6 验证过的参数为起点）、CORS 的默认行为、Service Worker 的缓存更新策略。
**Notes:**
- nginx（certbot 管证书）按 Phase 6 验证过的参数反代 PocketBase：实时连接的位置关闭代理缓冲、HTTP/1.1、长读超时；PocketBase 只监听 127.0.0.1，由 systemd 以非 root 用户运行（`Restart=always`、`GOMEMLIMIT`、内存上限）；DNS 只做解析；页面加 `noindex`。
- 冷启动离线的用例要单独放开 Playwright 的 `serviceWorkers: 'block'`。
- 所有者操作：在服务器上输入凭据、开 R2 存储桶和密钥、用真实设备验收、从原 Artifact 导出自己的备份。Claude 不接触真实数据，验收只记结论。

## Progress

**Execution Order:**
阶段按数字顺序执行：6 → 7 → 8 → 9 → 10 → 11 → 12 → 13。Phase 6 在等待采购和实测期间不阻塞 Phase 7、8；它的结论在 Phase 13 之前必须到位。

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. 测试环境、护栏与本地切片 | v1.0 | 4/4 | Complete | 2026-11-01 |
| 2. 账户模式、合成数据与导出 | v1.0 | 5/5 | Complete | 2026-11-03 |
| 3. 记一笔、编辑弹窗与本周视图 | v1.0 | 4/4 | Complete | 2026-11-03 |
| 4. 日历与目标视图 | v1.0 | 3/3 | Complete | 2026-11-03 |
| 5. 时间线、导入与窄屏 | v1.0 | 4/4 | Complete | 2026-11-05 |
| 6. 采购与中美可达性实测 | v2.0 | 10/10 | Complete    | 2026-11-08 |
| 7. 计划外置、稳定 id 与转义 | v2.0 | 7/7 | Complete    | 2026-11-07 |
| 8. PocketBase 规则、隔离与假服务器 | v2.0 | 7/7 | Complete    | 2026-11-08 |
| 9. 登录与云端存储 | v2.0 | 14/14 | Complete    | 2026-11-09 |
| 10. 离线与实时同步 | v2.0 | 0/9 | Not started | - |
| 11. 导出、导入与迁移 | v2.0 | 0/TBD | Not started | - |
| 12. 编辑计划页 | v2.0 | 0/TBD | Not started | - |
| 13. 部署、加固与验收 | v2.0 | 0/TBD | Not started | - |
