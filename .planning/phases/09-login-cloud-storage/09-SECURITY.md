---
phase: "09"
slug: "login-cloud-storage"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-09"
---

# Phase 09 — Security

> 本阶段的安全契约：威胁登记、已接受的风险和审计记录。

本阶段只在本机的假 PocketBase 上测试，不连接任何真实服务器。判断依据有三类：
- 应用和测试源码（行号以 HEAD ced49a7 为准，应用最后一次改动在 6a214d8）；
- 各 SUMMARY、09-REVIEW-FIX.md 里记录的执行结果；
- 编排者在 HEAD 上的运行记录：默认 `npm test` 175 条通过、`npm run test:cloud` 114 条通过（两条安全修复之后）、复核代理定向 39 条通过。

本文件不含服务器地址、域名、邮箱、口令或令牌。

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 浏览器 → 同源 PocketBase（生产经 nginx） | 登录凭据和账号数据跨越这里；客户端只认页面自己的来源 |
| 静态文件 → 浏览器执行 | 同源 SDK 是页面里唯一的外部代码 |
| 服务器数据 → DOM | state 和 plan 文档进入 innerHTML 渲染 |
| 仓库 → 公开 | 配置、测试、文档进入公开仓库 |
| 页面 → 第三方主机 | 字体、CDN 之类的外部请求会暴露访问并在大陆阻塞渲染 |
| 护栏 → 测试结论 | 改写护栏时若放宽断言，回归会悄悄变绿 |
| 用例 → 假服务器 | 注入开关决定页面看到的服务器行为 |
| 测试结论 → 后续阶段 | 开关写得比真实服务器宽松或说成真实行为，会让后续用例变绿而线上失败 |
| 第二个浏览器上下文 → 外部网络 | 新 context 不经过 fixture 的护栏装配 |
| 本机缓存 → 服务器 | 过期缓存一旦上传就会整份覆盖其他设备的新数据 |
| 用户输入 → 门控中的页面 | 键盘、拖拽、脚本派发的事件可能绕过 disabled |
| 共用设备的 localStorage | 缓存按账号分键，多个账号可能在同一浏览器出现 |
| 服务器响应 → 页面状态 | 晚到或过期的响应可能改写已经放弃的对账 |
| 网络质量 → 可用性 | 中国到香港的慢链路可能让对账超过 3 秒 |
| 两台设备 → 同一账号的首次创建 | 两边都可能以为服务器没有文档 |
| 本机脏缓存 → 服务器 | 本机修改上传时服务器可能已被另一台设备更新 |
| 两台设备 → 同一份服务器文档 | 整份文档、最后保存的为准，先保存的一方会被覆盖 |
| 本机留底 → 下载文件 | 被覆盖的版本离开应用、进入用户的文件系统 |
| 本机存储配额 → 留底 | 留底可能写不进 localStorage |
| 文档大小 → 服务器上限 | 整份文档随历史增长，超过 4 MiB 后保存会失败 |
| 账号 A 的数据 → 账号 B 的页面 | 同一浏览器、同一假服务器上的两个账号 |
| 示例计划 → 已有账号的 plan 文档 | 校验失败时的回退可能被误写回服务器 |
| 令牌（localStorage）→ 启动判断 | 过期判断错误会锁死用户或误删本机修改 |
| 存储状态 → 新的浏览器上下文 | 重开浏览器时令牌和缓存从磁盘恢复 |
| 用户 → 登录表单 → auth-with-password | 凭据跨越这里，错误响应可能泄露账号信息 |
| 共用设备的屏幕 | 明文密码和上次邮箱可能被旁人看到 |
| 同一浏览器的多个标签页 | 共享 localStorage 和令牌，各自持有内存状态 |
| 进行中的请求 → 退出之后 | 退出前发出的请求可能在退出后才返回 |
| 前一个账号的本机数据 → 下一个账号登录 | 换账号时清除前一个账号的数据 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-09-01 | Tampering | 同源 SDK 被替换或损坏 | high | mitigate | 动态 script 带 integrity（钉死的 sha256），static-server 启动时核对 SHA256SUMS；篡改对照用例在 09-02 证明被拒且不回退 | closed |
| T-09-02 | Information Disclosure | 服务器地址进入公开仓库（PITFALLS 19） | high | mitigate | 客户端地址取 location.origin，配置值只是字面量 pocketbase；每个任务暂存后跑隐私检查 | closed |
| T-09-03 | Tampering | 服务器来的 state、plan 进入 innerHTML（PITFALLS 11） | high | mitigate | 渲染前一律 normalizePlan、normalize，文字走 esc()；登录页的邮箱和错误用 textContent | closed |
| T-09-04 | Elevation of Privilege | 更新请求带 owner、kind 改写归属 | high | mitigate | cloudSave 只发 data 和 writer；服务器规则 :isset = false 兜底，用例以 PATCH 200 证明 | closed |
| T-09-05 | Information Disclosure | 合成凭据或令牌进入测试产物 | low | mitigate | 账号只来自 addUser（example.com、运行时随机口令）；test-results 被 git 忽略；暂存隐私检查 | closed |
| T-09-SC | Tampering | npm、pip、cargo 安装 | low | accept | 本计划不安装、不下载任何包；SDK 是已批准、哈希钉死的现有文件 | closed |
| T-09-06 | Information Disclosure | 第三方字体请求暴露访问并在大陆阻塞渲染（PITFALLS 4） | medium | mitigate | 删除三条字体 link；cloud 策略把字体主机记为违规；同源用例断言全程只请求同源；PROBE-2c 断言字体主机连接为 0 | closed |
| T-09-07 | Repudiation | 改写 SAFE-01、SAFE-04、PROBE-2c 时放宽了护栏 | medium | mitigate | SAFE-01 用页面主动 fetch 自证 font 分支；SAFE-04 由用例自己制造字体噪音；新标题和理由写进 SUMMARY | closed |
| T-09-08 | Repudiation | 注入的状态码被当成真实契约（PITFALLS 20） | medium | mitigate | PB-CONTRACT.md §10 标明每个开关的依据和“未经录制”；状态码不进 INTENTIONAL_DEVIATIONS；handle() 与契约自测不受开关影响 | closed |
| T-09-09 | Information Disclosure | 令牌或口令进入开关代码、用例或报告 | low | mitigate | 令牌运行时生成、revokeTokens 只删表项不打印；暂存隐私检查 | closed |
| T-09-10 | Spoofing | 第二台设备绕过护栏，向外部发请求而用例不失败 | medium | mitigate | openDevice 在任何导航之前用 attachGuard 挂同一个 guard.state；自检用例证明第二台设备的外部请求被记为违规 | closed |
| T-09-11 | Tampering | 过期缓存覆盖服务器新数据（PITFALLS 1、Anti-Pattern 1） | high | mitigate | 对账完成前门控禁止编辑、云端 flush 不上传；缓存干净而服务器更新时只采用不上传；比较只用服务器签发的 updated | closed |
| T-09-12 | Tampering | 门控被键盘、拖拽或脚本派发的事件绕过 | medium | mitigate | 控件 disabled 之外加 window 捕获守卫和 openEditor 早返回；安全网用例逐项尝试并断言没有写入 | closed |
| T-09-13 | Information Disclosure | 共用设备上留下别的账号的缓存 | medium | transfer | 缓存按用户 id 分键；退出和换账号时的清除在 09-13、09-14（D-06），本计划只保证键名可按账号整组删除 | closed |
| T-09-14 | Tampering | 截止后才到的响应改写页面 | medium | mitigate | AbortController 中止进行中的请求；run id 校验丢弃过期结果；用例证明 release 之后页面不变 | closed |
| T-09-15 | Denial of Service | 服务器慢或连不上时用户被锁死（PITFALLS 14） | medium | mitigate | 有缓存时只读显示上次内容、横幅和等待卡片都有重试；窗口内静默重试；Phase 10 再升级为断网可编辑 | closed |
| T-09-16 | Tampering | 首次创建竞争产生重复文档或覆盖另一台设备刚建的文档 | medium | mitigate | 服务器 (owner, kind) 唯一索引拒绝第二份；客户端得到 validation_not_unique 后重读并按对账表处理，没有缓存时只采用不写；竞争用例证明每种 kind 一份 | closed |
| T-09-17 | Tampering | 脏缓存在服务器更新后悄悄整份覆盖 | high | transfer | 本计划只留 keepConflict 钩子并照最后保存的为准上传；留底与告知在 09-08 补全并由其用例证明 | closed |
| T-09-18 | Tampering | 真冲突覆盖另一台设备的数据（PITFALLS 1） | high | mitigate | 上传前比对服务器 updated，真冲突时先留底再上传；toast 带下载按钮，工具栏常驻入口；用例覆盖两台设备、启动时冲突和替换 | closed |
| T-09-19 | Information Disclosure | 留底文件名带出邮箱或账号 id | medium | mitigate | 文件名只有应用名、种类和日期；用例断言不含邮箱和用户 id | closed |
| T-09-36 | Tampering | 读后写窗口：另一台设备的写入落在 cloudSave 的 getOne 和 PATCH 之间，被覆盖且没有留底 | low | accept | PocketBase 0.41.1 没有条件更新，整份文档最后保存为准是所有者锁定的决定；窗口只是一次往返，3 个用户各自账号，需同一账号两台设备几乎同时保存；Phase 10 的实时同步进一步缩小窗口；应用能察觉的冲突（读到的 updated 与基线不同、启动时缓存 dirty 且服务器更新）都照常留底；不加服务器端 hook（见“已接受的限制”） | closed |
| T-09-20 | Repudiation | 留底存不下却显示“已留底” | medium | mitigate | 写入失败只显示“没能留底”横幅、不弹成功提示、不显示下载按钮；用例用存储异常装置证明 | closed |
| T-09-21 | Denial of Service | 文档超过 4 MiB 后保存开始失败（PITFALLS 12） | medium | mitigate | 70% 提前警告；超过上限不发送请求、状态行和 error 横幅说明、修改留在本机缓存 | closed |
| T-09-22 | Information Disclosure | 一个账号看到另一个账号的计划或记录 | high | mitigate | 文档按 kind 和登录身份取，服务器规则隔离（Phase 8 已证）；用例对 A、B 做正向和负向断言，负向标记覆盖对方全部计划文字 | closed |
| T-09-23 | Tampering | 不合格的计划被示例计划改写到服务器 | medium | mitigate | usePlan 失败时只在页面和缓存里用 DEFAULT_PLAN，从不对 plan 文档写；用例断言 writes 里没有 plan 写入、服务器 plan 不变 | closed |
| T-09-24 | Spoofing | 依据记录接口状态码误判登录状态（PB-CONTRACT §9） | high | mitigate | 只看 authRefresh 的 401 和本地 exp；用例覆盖 401 和本地 exp 两条路径 | closed |
| T-09-25 | Tampering | 登录过期时清掉本机未上传的修改或留底 | medium | mitigate | 过期路径只清令牌、不删 `usj:v2:` 键、不清 dirty；用例断言缓存保留、同账号重新登录后上传 | closed |
| T-09-26 | Information Disclosure | 登录失败时透露哪一项错（账号枚举） | medium | mitigate | 400 只显示统一文案，邮箱保留、密码清空；用例断言文案 | closed |
| T-09-27 | Spoofing | 在线暴力尝试口令 | medium | transfer | 服务器端限流和后台加固属于 Phase 13 的 SEC-02；本计划只为 429 给出单独文案 | closed |
| T-09-28 | Elevation of Privilege | 已放弃的登录请求稍后成功，静默留下令牌 | medium | mitigate | AbortController 中止；放弃后仍收到成功就立即清令牌；用例断言 release 后没有令牌 | closed |
| T-09-29 | Information Disclosure | 明文密码在共用设备上被看到 | low | mitigate | 显示密码在提交成功、回到登录页、页面隐藏时恢复为隐藏 | closed |
| T-09-30 | Information Disclosure | 退出后留下前一个账号的数据（ACCT-02） | high | mitigate | D-06 顺序清除 state、plan、留底、lastUser 和令牌，并复位内存；用例断言没有 A 的键、B 看不到 A 的内容 | closed |
| T-09-31 | Information Disclosure | 另一个标签页在退出后继续为旧账号写缓存 | medium | mitigate | authStore.onChange 收到空令牌即本地退出并递增会话序号；令牌换成别的账号时重新加载；跨标签页用例证明 | closed |
| T-09-32 | Spoofing | 实时连接绑定旧身份，换账号后订阅被拒（Anti-Pattern 5） | medium | mitigate | 先 unsubscribe、再清缓存、最后清令牌；顺序用例加源码顺序检查 | closed |
| T-09-33 | Information Disclosure | 退出后登录页仍显示上次的邮箱（D-07） | low | accept | 所有者明确选择预填，接受共用设备时能看到上次邮箱的代价；邮箱只是登录标识，下一个账号登录后被替换 | closed |
| T-09-34 | Tampering | 退出后晚到的保存响应重新写出旧账号缓存 | medium | mitigate | 09-13 的会话序号校验，序号变了就不再写缓存或改 state；保存中退出的用例证明 | closed |
| T-09-35 | Information Disclosure | 换账号时前一个账号的数据未经确认被清掉，或清除后仍留在本机 | medium | mitigate | 有未上传数据时先确认；取消时丢弃新令牌、留在登录页；确认后先删前一个账号的 state、plan、snapshot 键再进入；换账号用例证明 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

转交项的去向（审计已核实）：
- T-09-13 → 09-13（T-09-30，退出清缓存）和 09-14（T-09-35，换账号清缓存）。
- T-09-17 → 09-08（登记为 T-09-18）；“启动时缓存脏”这条路径在 HEAD 上已完整缓解。
- T-09-27 → Phase 13 的 SEC-02（登录限流和代理 IP 头）。

---

## 审计中发现并已修复的威胁

第一次审计（42704a8）留下 2 条未关闭，修复后第二次审计确认关闭：

- **T-09-18（Tampering，high）：** 代码审查的 WR-01 修复（f53301c）曾把普通保存路径改成“写入成功后才留底”。这样一来，写入已在服务器生效但响应丢失时，另一台设备的版本会被覆盖且不留底。**修复（43c8b90）：** `cloudSave` 在 `getOne` 判定真冲突后、`update` 之前，同步、静默地写入留底（第 993 行先于第 994 行，中间没有 await）；提示由 `snapPending` 推迟到下一次上传成功之后，只公告一次。启动时的对账路径（904 行先于 905 行）本来就是先留底。新的假服务器开关 `lose-answer` 在 pb-faults 里自检，并在 PB-CONTRACT §10 登记为测试专用。用例 conflict-snapshot.spec.ts:379（PATCH 被拒）和 :435（服务器已生效但响应丢失）。
- **T-09-21（DoS，medium）：** 启动对账上传未同步缓存时不检查大小。**修复（6a214d8）：** 创建前（897 行）和更新前（902 行）都先测大小，超过 4 MiB 时不发请求，缓存保持 dirty 和旧基线，页面显示 `toolarge` 状态和横幅，不再落到“连不上服务器”。用例 capacity.spec.ts:113、:151。

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-09-33 | 登录页一直预填上次成功登录的邮箱，退出后也保留（D-07）。退出只留这一项，下一个账号登录后替换。审计没有发现与此矛盾的证据 | 所有者（09-CONTEXT D-07） | 2026-11-08 |
| AR-02 | T-09-36 | 先读服务器版本、再 PATCH 之间有一次往返的空窗，PocketBase 0.41.1 没有条件更新，空窗里另一台设备的写入会被覆盖且不留底。整份以最后保存为准是锁定决定，只有 3 个用户，Phase 10 的实时同步会进一步缩小空窗。T-09-18 修好之后，应用能察觉的每一种冲突（普通保存路径和启动对账路径）都会先留底再上传，这句理由成立 | 计划阶段登记（09-08），待所有者确认 | 2026-11-09 |
| AR-03 | T-09-SC | 本阶段没有安装或下载任何东西：package.json、lock 文件、两个 Playwright 配置、vendor 目录、tools/pb 和 pb/ 都没有改动，SDK 哈希仍与 SHA256SUMS 一致 | 计划阶段的处置 | 2026-11-09 |

*Accepted risks do not resurface in future audit runs.*

---

## 残余风险与注意事项（不阻塞，记下备查）

- **T-09-03：** 云端路径没有专门的恶意内容用例，转义依赖 Phase 7 对同一组渲染函数的转义用例。
- **T-09-24：** 858 行对对账中任何请求的 401 都按登录过期处理，不只是 `authRefresh`。按 PB-CONTRACT §9，实际效果相同。
- **T-09-27：** SEC-02 的措辞把限流绑在后台入口上。Phase 13 应写明普通用户的 `auth-with-password` 接口也要限流（PITFALLS:87 已有建议）。
- **T-09-29：** 页面隐藏时把密码框复位（699 行）没有用例覆盖。
- **T-09-31：** 另一个账号在别的标签页登录后本页重载的分支（659 行）没有用例覆盖。
- **T-09-32：** Phase 9 还没有实时订阅，退订 3 秒上限要到 Phase 10 才真正起作用。
- **T-09-34：** 对应用例分不清是会话计数守卫还是 `docs` 为空在起作用（审查 IN-04），但守卫在代码里。
- **T-09-18 残余（写入者标识每次打开都变）：** `WRITER` 在每次打开页面时重新生成。一条很少见的链条仍会丢掉另一台设备的留底：
  1. 发生真冲突，留底已写，上传在服务器生效但响应丢失；
  2. 用户又改了一处，这次保存也失败（或在 600 毫秒防抖内关了页面）；
  3. 重新打开页面；
  4. 启动对账把本机上一次的写入误认成别的设备的（写入者不同、基线也不同），于是用本机自己的旧版本替换了单份留底，提示也误说“另一台设备的修改已留底”。

  这不是回归：修复之前这条路径根本不留底。可行的修法是把最近一次上传的写入者标识存进缓存记录，启动时视为本机自己的写入。Phase 10 会重做保存和重试（SYNC-06），建议在那里一并处理。
- **T-09-18 小注：** 响应丢失之后如果用户不再修改，留底会一直静默，工具栏入口也隐藏，直到下一次保存成功或重新打开；退出确认框仍会提醒有留底。另外，留底写入失败（存储已满）后，如果在下一次保存成功之前就重新打开，“没能留底”横幅不会再出现，因为 `snapPending` 只在内存里。T-09-20 没被违反：页面从不声称有留底。
- **T-09-21 小注：** 如果被拦下的是计划文档，下一次保存记录时 `sizeCheck` 会清掉横幅；Phase 9 没有编辑计划的入口，计划不可能超过 4 MiB。被拦下且服务器上没有记录文档时，`docs.state.id` 仍是被删文档的 id，重新打开之前的一次未超限保存会以 `savefailed` 失败，不丢数据，重新打开后会重建文档。
- **未登记的新键：** WR-06 修复（a110311）新增了 localStorage 键 `usj:v2:authExpired`，值只有 "1"，不含账号标识。

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-09 | 37 | 35 | 2（1 条阻塞） | gsd-security-auditor（ASVS L1，block_on high；逐条核对，只做只读检查：隐私自检 193 项、`--all` 365 个文件通过，SDK 哈希与 SRI 重算一致） |
| 2026-11-09 | 37 | 37 | 0 | gsd-security-auditor 复审（T-09-18、T-09-21 修复后；复查了修复触及的 T-09-11、14、17、19、20、23、34 和 3 条接受的风险，`--all` 隐私检查通过） |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-09（AR-02 仍待所有者确认）
