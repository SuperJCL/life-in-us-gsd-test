# Pitfalls Research

**Domain:** 给现有单文件原生 JS HTML 应用（`us-journey-tracker.html`）补 Playwright 浏览器测试、`window.claude` mock 和交互测试套件（Windows 11、系统 Edge、`file://`、中文界面）
**Researched:** 2026-11-01
**Confidence:** MEDIUM-HIGH（应用行为来自逐行读源码，HIGH；Playwright 语义来自官方文档和 npm registry 元数据，HIGH；下列标了 LOW 的条目没有在本机运行验证，因为本次是只读研究，不能安装依赖或写入其他文件，需要 Phase 1 用 spike 验证）

> 约定：下文 "Phase 1" 指 harness + mock + fixtures + 第一个视图（本周）端到端；"Phase 2+" 指其余视图（日历、目标、时间线）以及导入导出、响应式等横切内容。文中的行号指 `us-journey-tracker.html`。

## 本机已核实的环境事实（影响多条 pitfall）

| 事实 | 来源 | 影响 |
|------|------|------|
| `@playwright/test@1.64.1`、`playwright@1.64.1` 的 npm `scripts` 为空（没有 postinstall），`npm i -D` 不会下载浏览器 | `npm view`（registry 元数据）| HIGH：只要不跑 `playwright install`，就不会下载或提权 |
| Playwright 1.64 针对的是 Chromium 156.0.8078.4、Edge/Chrome 155；本机 Edge 是 156.0.4314.58，目录里还留着 155.0.4283.62 和 156.0.4314.50 | release notes + 本机 `msedge.exe` | Edge 比 Playwright 测过的版本新一个大版本，官方说"支持 Stable 和 Beta 渠道"；Edge 会自动更新，可能在实验中途变化 |
| 本机 Windows 时区是 **Pacific Standard Time**（不是上海），区域是 zh-CN，PowerShell 控制台代码页 437 | PowerShell 查询 | 不指定 `timezoneId` 时，浏览器和 Node 都按太平洋时间。今天 2026-11-01 恰好是周日，也是美国夏令时结束日 |
| `npx playwright install msedge` 会在系统默认位置安装并"覆盖当前浏览器安装"（官方原话）；官方页面没有写是否需要管理员，但它走的是 Edge 安装器 | playwright.dev/docs/browsers | 本项目禁止执行；缺浏览器时报错信息会提示运行它，要忽略 |

## Critical Pitfalls

### Pitfall C1: 静默回退到 localStorage，mock 坏了测试照样绿（最大的假信心来源）

**What goes wrong:**
`init()`（L368-379）在任何一步失败时都不报错：`window.claude` 不存在、`use()` 返回 `null`、`user.id()` 返回 `null`、`ref.get()` 抛错，都会悄悄切到 `localStore()`。如果 mock 有笔误、`addInitScript` 没生效、`id()` 返回了 `null`，应用就跑在 localStorage 模式下，只检查界面的"账户模式"测试照样通过。

**Why it happens:**
应用的设计目标是"缺能力就降级"，这对用户是好事，对测试是陷阱：失败和成功在界面上几乎看不出区别，只有 `#status` 的文字不同（"已同步保存到你的账户" 对 "已保存在此浏览器中（换设备不会同步）"）。

**How to avoid:**
- 所有账户模式测试走同一个 fixture（例如 `accountPage`），fixture 在 `goto` 之后先 `await expect(page.locator('#status')).toHaveText('已同步保存到你的账户')`，再把页面交给测试。
- mock 记录调用日志（`get`/`set` 的路径和次数），测试里至少有一条断言"`get` 调用过一次、路径是 `data/users/<id>/state`、`set` 在保存后调用过"。
- 账户模式下断言 `localStorage['us-journey-tracker-v1']` 为 `null`（反过来证明没有走回退）。
- Phase 1 做一次变异检查：临时让 mock 的 `user.id()` 返回 `null`，确认账户模式测试必须变红，然后还原。

**Warning signs:**
账户模式测试从未因为 mock 改动而失败；状态行文字没有出现在任何断言里；`localStorage` 里出现了账户模式不该有的 key。

**Phase to address:** Phase 1

---

### Pitfall C2: mock 的 `use()` 时序和真实契约不一致（太早、太晚、太"完美"）

**What goes wrong:**
真实契约（claude.d.ts）的关键点：`window.claude` 在你的脚本运行前就存在，但**只有 `use`**；命名空间要到脚本第一次同步运行之后才通过 promise 到达，"不保证和 DOMContentLoaded 的先后"；`use("db")` 对可用能力是 memoized（同一个 promise 对象）；返回的命名空间是**冻结的**；不支持的名字返回 `null`；宿主不响应时 10 秒后返回 `null`。
常见的错误 mock：`use: async name => impl[name]`（microtask 内就 resolve，`renderAll()` 之前的空白期几乎不存在）；把 `db`、`user` 直接挂在 `window.claude` 上；每次 `use()` 返回新对象；返回可变对象。这样的 mock 会隐藏 CONCERNS.md 里的"加载完成前的编辑被覆盖"问题，也会让应用以后误用 `window.claude.db` 时仍然通过。

**Why it happens:**
`addInitScript` 保证 mock 先于页面脚本存在，作者容易顺手让一切同步可用；而且 `init()` 先 `renderAll()` 再 `await`，所以"晚一点 resolve"在应用里是完全合法的，只有故意延迟才能测到。

**How to avoid:**
- mock 只暴露 `window.claude = Object.freeze({ use })`，`use` 对 `db`/`user`/`downloads` 用缓存的 promise，其余名字 `Promise.resolve(null)`，命名空间用 `Object.freeze`。
- `use()` 至少隔一个 macrotask 才 resolve（`setTimeout(0)`），延迟做成可配置（默认几十毫秒，专门的"加载期编辑"测试用几百毫秒）。
- 加一个 `contract` 小测试，直接对 mock 调 `page.evaluate`，断言：`Object.keys(window.claude)` 只有 `use`、同名两次 `use` 是同一个 promise、命名空间 `Object.isFrozen`、未知名字为 `null`。
- 因为 init 脚本是 mock 的"宿主"，要写成**普通浏览器 JS（IIFE，无 import/export）**，用 `addInitScript({ path })` 加载时不会被转译（见 M10）。
- 在 mock 头部写明对齐的契约版本 `0.2.96`，并把用到的契约点写进 `tests/shims/CONTRACT.md`（见 M12）。

**Warning signs:**
mock 里没有任何 `setTimeout`；测试从不需要等 `#status` 就能点东西；`window.claude` 上有 `db` 属性。

**Phase to address:** Phase 1

---

### Pitfall C3: 快照形状错误、克隆/冻结语义丢失、mock 存储在 reload 后消失

**What goes wrong:**
应用依赖的形状只有这些：`db.doc(path).get()` 返回 `{ exists:boolean, data():object|undefined }`；`set(obj)` 返回 promise。常见错误：
1. 文档不存在时返回 `null` 或 `{ exists:false }` 但没有 `data` 方法；存在时把 `data` 写成属性而不是函数。应用的 `load` 会抛 `TypeError`，被 L375 的 `catch` 吞掉并切回 localStorage，错误又被 C1 掩盖。
2. `set()` 直接保存传入引用。真实运行时经过 postMessage，是结构化克隆；mock 不克隆，应用后续对 `state` 的修改会"穿透"进 mock 存储。
3. 返回的 `data()` 不冻结。应用在 L373 用 `JSON.parse(JSON.stringify(...))` 克隆，所以现在没问题，但应用是**非严格模式**，对冻结对象的写入会**静默失败**而不是抛错，所以冻结只能靠显式断言检查，不能指望报错。
4. mock 把文档放在页面内存里。`page.reload()` 后全部丢失，"保存后 reload 数据还在"这个核心场景测不了；如果为了图省事存进 `localStorage['us-journey-tracker-v1']`，又会和应用自己的回退存储混在一起（C1 的另一种形式）。

**Why it happens:**
Firestore 风格的 API 看起来简单，作者只实现"够用"的子集，没有对着 `DocumentSnapshot` 类型逐字段核对。

**How to avoid:**
- `get()` 的返回对象 `Object.freeze`，字段严格是 `id`、`exists`、`data()`、`metadata:{fromCache:false,hasPendingWrites:false}`，`data()` 在 `exists:false` 时返回 `undefined`，存在时返回深冻结的 JSON 克隆。
- `set()` 先 `JSON.parse(JSON.stringify(x))` 再保存；顶层不是普通对象时直接抛 `TypeError`（这是契约违反，不是"错误路径模拟"，不违反"只做正常路径"的范围）。
- `doc(path)` 校验路径语法（偶数段、字符集），应用传入的是 `data/users/<id>/state`，4 段，合法；未 await 的 id（`[object Promise]`）会让真实运行时抛 `TypeError`，mock 也应该抛。
- mock 存储放在 `sessionStorage` 或 localStorage 的**独立前缀 key**（例如 `__claude_mock__:db`），不碰 `us-journey-tracker-v1`；测试通过 `page.evaluate` 读取它来断言保存结果。sessionStorage 在同一标签页 reload 后保留，但不会泄漏到别的 context。
- 种子数据只在首次加载时写入（见 C4）。

**Warning signs:**
账户模式测试里"reload 后数据还在"这类断言缺失或总是靠 localStorage 通过；mock 里有 `return null` 表示"不存在"。

**Phase to address:** Phase 1

---

### Pitfall C4: `addInitScript` 播种在每次导航（包括 reload）都会重新执行，覆盖应用刚保存的数据

**What goes wrong:**
`addInitScript` 在**每次**文档创建时运行。如果用它写 `localStorage.setItem('us-journey-tracker-v1', seed)`，那么 `page.reload()` 后应用保存的内容立刻被种子覆盖，"保存后 reload 数据仍在"的测试要么假失败（数据被冲掉），要么在用错断言时假通过。mock 的种子文档同理。

**Why it happens:**
把"初始化"和"每次页面加载"混为一谈；init 脚本没有"只运行一次"的语义。

**How to avoid:**
- 种子写入加守卫：`if (!sessionStorage.getItem('__seeded__')) { ...写入...; sessionStorage.setItem('__seeded__','1') }`（sessionStorage 随标签页存活，reload 保留，每个新 context 是空的）。
- 或者：先 `goto`，用 `page.evaluate` 写入种子，再 `reload`。应用启动时不会主动写存储，所以这样是安全的。
- 注意先 `goto` 再 `page.evaluate(() => localStorage...)` 才行：在 `about:blank` 上访问 localStorage 会抛 `SecurityError`。
- 参数传递：`addInitScript(fn, arg)` 的 `arg` 只在传函数时有效，传 `{ path }` 时不支持参数。所以先用一个函数形式写入 `window.__MOCK_CFG__ = {...}`，再注入路径形式的 mock 脚本（MEDIUM，来自对官方文档的记忆，未逐字核对）。

**Warning signs:**
同一个"保存后 reload"测试在播种后总是失败；测试里 `reload()` 后看到的是 fixture 的原始内容；播种代码里没有守卫。

**Phase to address:** Phase 1

---

### Pitfall C5: 时间冻结方式选错、时区被主机悄悄决定、DST 边界

**What goes wrong:**
应用所有的"今天"都来自 `new Date()`（L333），本地日期、周一起始、"今天"高亮（`.today`）、过期判断（`s.due<t` 是字符串比较）、"来美国第 N 天"、日历 `view` 都依赖它。
- `page.clock.setFixedTime` 只固定 `Date.now()`/`new Date()`，**定时器照常走**，官方称之为推荐做法；`page.clock.install` 会接管 `Date`、`setTimeout`、`setInterval`、`requestAnimationFrame`、`performance` 等，之后用 `runFor`/`fastForward`/`pauseAt` 控制。官方文档说明 `pauseAt` 之后"除非调用 runFor、fastForward、pauseAt 或 resume，否则不会触发任何定时器"。如果为了"冻结时间"在全局用 `install` + `pauseAt`，600 ms 保存去抖、800 ms 复盘去抖、1.8 s/5 s toast 都不会触发，`expect.poll(localStorage)` 永远等不到。
- 官方文档没有说明字符串时间用哪个时区解析，示例是 `new Date('2024-02-02T10:00:00')`，即**解析发生在 Node 主机的本地时区**。本机主机时区是 Pacific，如果 fixture 里的"今天"写成无偏移的字符串，换一台机器日期可能差一天。
- 本机不是中国时区，也不是应用实际使用的美国东部；不设 `timezoneId` 就是 Pacific。
- 应用的日期运算本身对 DST 是安全的（天数用 `Math.round(.../864e5)`，加日用 `setDate`），所以 DST 测试不是为了抓 bug，而是为了"证明没有 bug"，漏掉就等于没有回归保护。
- 日历格子是**周日起始**（`WD="日一二三四五六"`，`start.setDate(1-view.getDay())`），本周视图是**周一起始**（L335），两个视图不一致；日历是 35 格还是 42 格取决于月份（L487）。

**Why it happens:**
把"冻结时间"理解成一个开关；忽略 Node 和浏览器各有一个时区；假设"周一起始"对全应用成立。

**How to avoid:**
- 默认 fixture：`setFixedTime` + 固定 `timezoneId`，**在 `goto` 之前**调用（官方所有示例都是先设置再 `goto`；`install` 必须先于其他 clock 调用）。同一个测试里不要混用 `install` 和 `setFixedTime`。
- 只有"去抖"和"跨午夜"两类测试使用 `install({ time })` + `runFor(1500)`，专门写在一个 `describe` 里。验证：`runFor` 能触发在推进期间由前面的定时器新调度的定时器（保存是 600 ms 嵌套在 800 ms 里）。如果在 `pauseAt` 之后动作卡在"等待元素稳定"，先怀疑 clock，用 `resume` 排查（LOW，需要 spike）。
- 时间值一律传 `Date`/毫秒数，用 `Date.UTC(2026, 2, 11, 12)`（正午 UTC），这样无论 `timezoneId` 是上海还是纽约，日期都是同一天。
- 默认 `timezoneId: 'America/New_York'`（应用的真实使用场景），固定日期选在周三（例如 2026-03-11，DST 已于 3-8 开始）；抵达日期放在 DST 之前（例如 2026-02-20），"第 N 天"的断言顺便覆盖春季拨快。另加一个 `describe` 用 11 月 1 日前后的日期覆盖秋季拨慢。
- 周日（`getDay()===0`）属于上一周，周一是新一周的开始，fixture 要有落在这两天的记录。日历测试单独断言 35 格（如 2026-02）和 42 格（如 2026-08，8 月 1 日是周六）。
- 不要依赖真实日期：2026-11-01 既是周日又是美国 DST 结束日，没冻结时间的测试今天恰好会踩在边界上。

**Warning signs:**
测试在深夜或周日才失败；`page.waitForTimeout` 越加越多；换机器后"第 N 天"差 1；有人在全局 `beforeEach` 里调用了 `clock.install`。

**Phase to address:** Phase 1（fixture 和默认时区）；Phase 2+ 日历（周日起始、35/42 格）、目标（过期判断）

---

### Pitfall C6: 去抖保存——断言太早、reload 丢数据、本地和账户模式行为不同

**What goes wrong:**
`persist()` 延迟 600 ms 才 `flush`；周复盘 `input` 先等 800 ms 才写进 `state`（L613），再等 600 ms 保存，合计约 1.4 s。
- 动作后立刻读 localStorage 或 mock 存储，读到旧值。
- 本地模式下，`persist()` 之后马上 `page.reload()` **不会**丢数据：`pagehide` 会调用 `flush`，`localStorage.setItem` 在 async 函数的第一个 await 之前同步执行。但复盘文字在 800 ms 内 reload **会丢**（`state` 还没更新，这是 CONCERNS.md 的已知问题）。
- 账户模式下，`pagehide` 里发起的 `ref.set` 可能在卸载前完成不了。如果 mock 通过异步桥（`exposeBinding`）写到 Node 端，是否丢数据取决于时序，测试会时好时坏；如果 mock 在调用时同步写入页面存储，则永远不丢，又与真实不一致。
- 用 `waitForTimeout(700)` 是双重错误：慢，而且在慢机器上仍然会失败。

**Why it happens:**
没读 L357-363 和 L613；把"保存"当成同步。

**How to avoid:**
- 固定模式：`await expect.poll(() => page.evaluate(() => localStorage.getItem('us-journey-tracker-v1'))).toContain('合成文本')`（账户模式读 mock 存储的独立 key），不用固定延迟。
- 保存类断言封装成一个 helper（`expectSaved(page, predicate)`），所有视图共用。
- 不要用 reload 去"逼"保存。专门写一个 `@known-bug` 测试：fill 复盘后立刻 reload，断言文字丢失（见 C10）。
- mock 的 `set()` 在调用时同步把值写入页面存储（持久化 key），再异步 resolve。这样 reload 内的保存结果是确定的，并在 CONTRACT.md 里写明"真实运行时卸载时可能丢写，这里不模拟"。
- 需要确定性的去抖测试用 `clock.install` + `runFor(1500)`（见 C5）。

**Warning signs:**
测试里出现 `waitForTimeout`；复盘测试偶尔失败；账户模式的 reload 测试和本地模式结果不一致。

**Phase to address:** Phase 1（helper 和一个端到端往返）；Phase 2+ 在每个视图复用

---

### Pitfall C7: 原生 `confirm()` 被 Playwright 自动取消，导入"看起来什么都没发生"

**What goes wrong:**
官方文档：没有 `page.on('dialog')` 监听器时，所有对话框都被自动 dismiss，`confirm()` 返回 `false`。导入流程是 `setInputFiles` → `FileReader.onload`（异步）→ `confirm(...)`（L657）。如果监听器在 `setInputFiles` **之后**才注册，或者根本没注册，应用会走"取消"分支，状态不变，测试在断言"已恢复"时超时，作者容易误判成应用或 fixture 的问题。反过来，注册了监听器但忘记 `accept()`/`dismiss()`，页面会卡死（官方：动作会 stall）。

**Why it happens:**
`confirm` 在异步回调里触发，和触发它的 Playwright 动作之间没有可等待的同步点。

**How to avoid:**
- 在 `setInputFiles` 之前注册 `page.once('dialog', d => d.accept())`，并断言 `dialog.message()` 等于 `用备份文件替换当前所有内容？`（全角问号，直接从源码复制）；取消分支用 `d.dismiss()`。
- 用 `Promise.all([page.waitForEvent('dialog'), input.setInputFiles(...)])` 的写法保证监听先于动作。
- 之后等 toast（`已恢复`）或状态变化，不要等固定时间。
- 注意取消分支会跳过 L657 的 `e.target.value=""`（已知 bug，见 C10）。

**Warning signs:**
导入测试偶尔超时；对话框 `message()` 从未被断言；测试里有"对话框处理器"但没有被 await。

**Phase to address:** Phase 2+（导入导出，横切，建议放在第一个涉及导入的 phase）

---

### Pitfall C8: toast 断言——`toBeVisible()` 永远为真，撤销点击与 1.8 s/5 s 计时赛跑

**What goes wrong:**
`.toast` 始终在 DOM 里，用 `opacity:0` + `pointer-events:none` 隐藏，`.on` 类显示（L207-209）。官方 actionability 文档明确写"`opacity:0` 的元素**被视为可见**"，所以 `expect(page.locator('#toast')).toBeVisible()` 在 toast 没出现时也通过；`not.toBeVisible()` 永远不通过。另外：
- toast 的 `textContent` 把消息和"撤销"按钮文字拼在一起（"已删除这条记录撤销"），`toHaveText('已删除这条记录')` 精确匹配会失败，要用 `toContainText`。
- 只有 `.act` 时才有 `pointer-events:auto`；撤销按钮在 5 s 后（`tt` 计时器）会变成不可点击，Playwright 会等"接收事件"检查直到超时，报错像是找不到元素。
- 同一个 `#toast` 元素被复用：任何新的 `toast()` 都会清空并替换内容，所以在 5 s 内再触发别的操作，之前拿到的撤销按钮定位器就失效了；撤销本身也会触发新的 toast（"已恢复"）。
- 慢机器上，"删除后 5 秒内点撤销"在真实计时器下可能擦边。

**Why it happens:**
把"存在于 DOM"当成"可见"；toast 是单例元素。

**How to avoid:**
- 断言用 `toHaveClass(/\bon\b/)` 加 `toContainText`；消失用 `not.toHaveClass(/\bon\b/)`。
- 撤销用 `page.locator('#toast.act button')`，点击前不要有其他操作。
- 过期场景用 `clock.install` + `runFor(5001)` 确定性地测，不要 `waitForTimeout(5000)`。
- 配置 `reducedMotion: 'reduce'`（应用对它把 `transition` 设为 `none`）消除 `.2s` 淡入淡出对"稳定性"检查的干扰。

**Warning signs:**
toast 测试"从来没失败过"；撤销测试偶尔超时并提示 `intercepts pointer events`。

**Phase to address:** Phase 1（本周视图含删除、撤销、拖拽 toast）；Phase 2+ 复用同一个 helper

---

### Pitfall C9: Google Fonts 导致 goto 挂起，以及"拦截所有外部请求"并不等于没有外部连接

**What goes wrong:**
`<link rel="stylesheet" href="https://fonts.googleapis.com/...">`（L9）是渲染阻塞的，`page.goto` 默认等 `load`。本机是 zh-CN/中国网络环境，Google Fonts 很可能被屏蔽或超时，而不是立刻失败。没拦截时，每个测试的 `goto` 可能挂起到超时，表现是整套测试"随机"变慢或失败。
- 拦截要在 **`goto` 之前**、在 **context 级别**设置，并且用 `route.abort()`（立即失败），不要用延迟的 `fulfill`。
- `<link rel="preconnect">`（L7-8）是浏览器发起的 socket 预连接，**可能不经过 Playwright 的请求拦截**。搜索没有找到官方对此的说明（LOW），所以不要假设 `page.route` 能阻止对 Google 域名的连接尝试。
- 项目硬性约束是"不接触 claude.ai"，也不应该接触任何外网。

**Why it happens:**
把 `page.route` 当成网络隔离。

**How to avoid:**
- `context.route(/^https?:\/\//, r => r.abort())` 放进共享 fixture，所有测试自动继承；`file://` 不受影响。
- 额外的网络层兜底：在 `launchOptions.args` 加 `--host-resolver-rules=MAP * ~NOTFOUND` 让浏览器对所有域名解析失败（Edge 是 Chromium，支持该开关；需要在 Phase 1 spike 验证 Edge 接受它）。
- 全局 fixture 收集 `page.on('request')`，断言所有 `http(s)` 请求的主机都在白名单（只有 `fonts.googleapis.com`、`fonts.gstatic.com`，且都是被 abort 的），出现其他主机（尤其是 `claude.ai`）直接让测试失败。
- 配置里 `waitUntil` 保持默认也可以，因为 abort 是立即的；如果仍然慢，改成 `domcontentloaded` + 等待 `#status`。
- 字体请求被 abort 会在控制台产生 `Failed to load resource`，全局的 `console.error` 收集器要过滤这条。

**Warning signs:**
`goto` 偶尔超过 10 s；没有网络时测试通过、联网时失败；日志里出现 `claude.ai` 以外但不在白名单的主机。

**Phase to address:** Phase 1

---

### Pitfall C10: 已知 bug 的标记方式——`test.fail` 会掩盖别的失败，有些 bug 不一定能复现

**What goes wrong:**
官方：`test.fail()` 运行测试并要求它失败，否则"Playwright will complain"（官方没有写明具体怎么报告）；`test.fixme()` 不运行。
- 用 `test.fail` 标记整个测试，只要测试**因为任何原因**失败（选择器写错、mock 坏了、fixture 过期），它都会"按预期失败"并显示为通过，真正的缺陷被掩盖。
- `test.fixme` 完全不运行，失去回归信号。
- 本项目有的 bug 不一定能用 Playwright 复现（见下表）。

**How to avoid:**
- **特征化测试（characterization test）**：断言**当前的错误行为**（例如草稿确实被清空），测试通过表示 bug 仍然存在，修复 bug 时测试变红，提醒更新；同时用 `test.info().annotations.push({ type: 'known-bug', description: 'CONCERNS.md: …' })` 做标注，标题加 `@known-bug` 标签，便于 `--grep`/`--grep-invert`。
- 只有"期望的正确行为"那一半才用 `test.fail()`，并且断言要窄（只断言那一个症状），先用一个不带 `fail` 的对照断言证明测试前提成立。
- 每个已知 bug 在 `tests/KNOWN-BUGS.md` 里登记：来源、复现步骤、期望行为、当前行为。

| 已知问题（CONCERNS.md）| 能否用 Playwright 复现 | 注意 |
|------------------------|------------------------|------|
| 切换日期丢草稿（L610/L618）| 能：往 `#w-text` 输入，再点另一天，文本框被清空；日历同理 `#c-text` | 类别/标签切换不丢（`refresh()` 保留）|
| 取消导入后同一文件无反应（L657）| **不确定（LOW）**：Chromium 对同一文件不触发 `change`，但 `setInputFiles` 的路径形式和内存 buffer 形式分发事件的方式可能不同，需要 spike | 在导入 phase 开头先做一个 10 分钟的 spike，再决定写成特征化测试还是只记录 |
| 加载完成前的编辑被覆盖（L369/L375）| 只有 mock 的 `use()` 延迟足够长才能复现 | 依赖 C2 的可配置延迟 |
| 复盘最后约 1.4 s 丢失（L613）| 能：fill 复盘后立即 reload | 本地和账户模式都会丢 |
| 保存失败不重试（L360）| 属于 mock 错误路径，**本里程碑不做** | 见 M13 |
| 内置任务用位置 id（L317）| 黑盒不能复现 | fixture 的 `tasks` key 就是位置 id，见 C11 |
| 日期不随午夜翻转（L341）| 能：`clock.install` + `fastForward('24:00:00')` | "今天"高亮不更新，特征化 |
| 导入 JSON 的 XSS（L502 等）| 能，但要用无害载荷 | 见 Security Mistakes |
| CSV 的 `\r` 不加引号、公式注入 | 能：断言导出内容 | 见 M14 |

**Warning signs:**
有测试被标成 `test.fail` 但从来没人看过它为什么失败；`test.fixme` 数量越来越多；CONCERNS.md 的条目没有对应的测试或登记。

**Phase to address:** Phase 1（建立约定和 `KNOWN-BUGS.md` 模板，先登记草稿丢失）；Phase 2+ 各视图按需补充

---

### Pitfall C11: 真实数据或个人内容进入仓库、fixture、截图或 trace

**What goes wrong:**
- 原目录里存在过真实备份文件（文件名不记录），如果它重新出现在项目根目录，`git add .` 会把它提交。
- 应用源码里的 `GROUPS`/`LIFTS` 本身就是个人学习、求职、健身计划（L308-324，CONCERNS.md 也提醒过）。**目标视图的截图、`toHaveScreenshot` 基线、trace、HTML 报告**都会带上这些文字，其中有真实项目名。
- 测试和 fixture 里把内置任务文字复制过来当选择器，也会把个人内容复制进仓库。
- 拿真实备份的结构当 fixture 模板，容易把真实日志一起带进来。

**How to avoid:**
- `.gitignore` 增加：`node_modules/`、`test-results/`、`playwright-report/`、`blob-report/`、`*备份*.json`、`在美国的日子-*.json`。这应当是 Phase 1 的第一次提交。
- 不使用 `toHaveScreenshot` 基线；调试截图只存在 `test-results/`（被忽略）。
- 内置任务不要用文字定位，用位置 id 属性（`[data-task="P1-1"]`）或"第几个分组的第几个复选框"，并把这几个 id 集中放在一个常量文件里，注明"位置 id，随源码任务顺序变化"。
- fixture 全部手写，带一个标记字段（例如顶层 `"_synthetic": "fixture, invented data"`；`normalize()` 会丢弃未知键，所以不会影响应用），再加一个小测试遍历 `tests/fixtures/*.json` 断言都有该标记；日志文字用明显的虚构内容（"练习虚构对话 A"）。
- 导入测试使用 `setInputFiles({ name, mimeType, buffer })` 的内存文件，不要在磁盘上放"看起来像真备份"的文件。
- 提交前检查：`git status` 里不应出现 `*备份*`。

**Warning signs:**
`git status` 出现 `*备份*.json`；仓库里有 `*-snapshots/` 目录；fixture 文本里出现真实项目名、真实公司名。

**Phase to address:** Phase 1（`.gitignore`、fixture 约定、标记测试）；Phase 2+ 目标视图要特别注意

---

### Pitfall C12: 安装和版本耦合——脚手架会下载浏览器、加 CI 工作流；系统 Edge 自动更新

**What goes wrong:**
- `npm init playwright@latest` 会提示下载浏览器、生成示例测试和 GitHub Actions 工作流，和"不下载浏览器、不做 CI"的约束冲突。`npx playwright install [msedge]` 会走安装器，覆盖系统 Edge，可能要管理员权限，也违反"没有全局安装"。
- 本机 Edge 是 156，Playwright 1.64 测试的是 155；Edge 自动更新后，某天 Playwright 通过 CDP 的行为可能变化。目录里留有多个旧版本文件夹，说明它在更新。
- `channel: 'msedge'` 的 headless 使用"新 headless"实现（更接近有头模式），与默认的 chrome-headless-shell 不同；HTML5 拖放和 `<dialog>` 在新 headless 下应该可用，但需要在 Phase 1 实测（LOW）。
- 绝不要用 `launchPersistentContext` 指向 Edge 的真实用户数据目录。

**How to avoid:**
- 手写 `package.json` 和 `playwright.config.ts`（TS 由 Playwright 自己转译，不需要 `tsconfig` 构建步骤）。用 `npm i -D -E @playwright/test@1.64.1`（`-E` 精确版本），提交 `package-lock.json`；`engines.node` 写 `>=20`。
- 配置里 `use: { channel: 'msedge' }`，全局不要出现 `playwright install`；README 写一句"若报找不到浏览器，不要运行 install，先检查 Edge 路径"。
- Phase 1 的冒烟测试打印并记录 `browser.version()`（写进报告或 README），以后遇到莫名失败先对照版本；需要时用精确版本回退 Playwright 或更新到下一个版本。
- 默认 `headless: true`（一条命令无窗口），提供 `--headed` 的调试说法，两种模式在 Phase 1 各跑一次拖拽测试确认一致。
- HTML 报告用 `['html', { open: 'never' }]`：官方默认 `on-failure` 会在失败时自动打开并提供报告服务，会让"一条命令运行全部测试"卡住。
- `retries: 0`、`forbidOnly: true`，不用重试掩盖不稳定。

**Warning signs:**
`npm install` 后出现 `~/AppData/Local/ms-playwright`；仓库出现 `.github/`；测试跑完终端不退出。

**Phase to address:** Phase 1

---

## Moderate Pitfalls

### Pitfall M1: HTML5 拖放用 `locator.dragTo` 不可靠
**What goes wrong:** `dragTo` 的行为是"悬停源、mousedown、移动到目标、mouseup"，默认 `steps: 1` 只发一次 `mousemove`。官方指出 `dragover` "至少需要两次鼠标移动才能在所有浏览器里触发"。本应用的放置目标需要 `dragover` 里 `e.preventDefault()`（L601-602），否则 `drop` 不会触发；`dragover` 还要求 `dragId` 已被 `dragstart` 设置。
- `drop` 之后 `renderAll()` 会重绘，源元素已被移除，`dragend` 不会冒泡到 `#days`，不能用 `.dragging` 类是否消失做断言。
- 拖到同一天只会 `renderWeek()`，没有 toast，也没有 `persist`。
- 设备描述符（`devices['Pixel 7']` 等）带 `hasTouch/isMobile`，触摸没有原生 HTML5 拖放，不要用设备描述符做窄屏测试。
**Prevention:** 先用 `dragTo(target, { steps: 10 })`；不稳时改成手动序列：`hover(source)` → `mouse.down()` → `hover(target)` → 再 `hover(target)` → `mouse.up()`（官方推荐的两次移动）。最后兜底是 `evaluateHandle(() => new DataTransfer())` + `dispatchEvent('dragstart'/'dragover'/'drop', { dataTransfer })`，应用对 `setData` 有 try/catch，所以合成事件也可行；兜底方案必须在测试里注明，因为它没有走真实指针路径。断言放在结果上：条目出现在目标日、toast 含 `已移到 M月D日`、保存的数据中日期变化。
**Warning signs:** 拖放测试时好时坏；条目没有移动但没有报错；只在 headless 失败。
**Phase to address:** Phase 1（本周视图含拖放，尽早 spike，在有头和无头两种模式下确认）

### Pitfall M2: `<dialog>.showModal()`、焦点、重绘
**What goes wrong:** 编辑器 `dialog#editor` 打开后，背景是 inert。点击背景元素会超时而不是触发。点击 backdrop（`e.target===dlg`）会关闭，`Escape` 触发原生 `cancel`，两者都**不**走应用的 `close()`（不清理 `form.dataset.keep`）。类别按钮点击会调用 `draw()` 重写整个表单（L569），之前拿到的元素定位器和 `ElementHandle` 会失效；日志编辑和任务编辑共用 `#ed-date`、`#ed-save`、`#ed-cancel` 这些 id。关闭后焦点是否回到触发元素取决于该元素是否还在 DOM（重绘后通常不在）。
**Prevention:** 一律用定位器而不是 `ElementHandle`；用 `getByRole('dialog')`（名称来自 `aria-labelledby` 指向的 `#ed-title`，但 `draw()` 会重建它，断言前先等待）或 `locator('dialog#editor[open]')`；关闭断言用 `not.toHaveAttribute('open', '')`；`showModal` 后断言 `#ed-text` 获得焦点；保存快捷键用 `press('Control+Enter')`；backdrop 点击用 `page.mouse.click(2, 2)`（对话框之外的角落）；不要断言"关闭后焦点回到哪里"，那取决于浏览器。窄屏（≤560 px）对话框变底部面板，按钮位置变化，不要使用硬编码坐标。
**Warning signs:** `locator.click` 提示被其他元素拦截；类别切换后下一步操作找不到元素。
**Phase to address:** Phase 1（编辑弹窗，从本周视图进入）

### Pitfall M3: 隐藏的 `<input type=file>` 在 `<label>` 里
**What goes wrong:** `#importJson` 带 `class="hidden"`（`display:none !important`），在 `label` 里。点击 label 会打开系统原生的文件选择器，测试会卡住（无头模式下没有 UI 但也不会触发 `change`）。
**Prevention:** 直接 `page.locator('#importJson').setInputFiles(...)`：官方 actionability 表里 `setInputFiles` 不要求可见、稳定或可接收事件，所以隐藏元素也可以；它也不检查 `accept=".json,application/json"`，所以测试"拒绝非 JSON"必须自己构造文件内容。若一定要走 label，使用 `Promise.all([page.waitForEvent('filechooser'), label.click()])`。注意 `confirm()` 在异步的 `onload` 里触发（见 C7），所以事件顺序是 `setInputFiles` → 对话框 → toast。"格式不对"toast 只在**无效 JSON 或 `null`** 时出现；`{}`、`[]`、字符串、数字都能通过 `normalize()`，并会在确认后把全部内容替换成空状态。这是应用的弱校验，属于 CONCERNS.md 的"validation 太浅"，要写进特征化测试而不是当作"畸形文件"测试。
**Warning signs:** 导入测试在 `click` 上卡住；"畸形文件"测试没有出现错误 toast。
**Phase to address:** Phase 2+（导入导出）

### Pitfall M4: 捕获阶段监听器和 `stopPropagation`，影响点击落在哪里
**What goes wrong:** L550-554 有三个 document 级捕获监听器：`[data-dellog]` 用 `stopImmediatePropagation` 并阻止默认行为；`[data-edit]`/`[data-edittask]` 用 `stopPropagation` 打开编辑器；键盘 `Enter`/空格同理。结果：
- 点击周视图里的记录不会触发 `#days` 的点击，也就**不会**调用 `pickDay`，所选日期不变；而点击日格空白处才会选日。
- 日面板里的 `li[data-edit]` 同时是 `role="button"` 并且内含 `button.x`（删除）。`locator.click()` 点的是元素中心，可能落在 `×` 上；嵌套的交互元素也让 `getByRole('button', { name: ... })` 出现歧义。
- `×` 按钮既有 `data-dellog` 又在 `data-edit` 容器里，只有靠第一个捕获监听器才不会同时打开编辑器。
**Prevention:** 为每条记录同时写"点击文字打开编辑器"、"点击 ×（`getByRole('button', { name: '删除这条记录' })`）删除，且编辑器**不**打开"、"键盘 Enter 打开编辑器"三条测试；点击位置用 `position` 或直接定位到内部元素（`.li-text`、`button.x`）；不使用 `force: true`。
**Warning signs:** 点击删除后编辑器也弹出；点击记录后日期选择发生了变化。
**Phase to address:** Phase 1（周视图）；Phase 2+ 日历日面板、时间线

### Pitfall M5: 中文选择器、全角标点和重复文字
**What goes wrong:**
- 同样的文字出现在多处：`本周` 既是页签、`#wkNow` 按钮、`#wkTitle`，也是 `本周复盘` 的子串；类别名 `语言/专业/健身/求职/其他` 同时出现在周视图作曲区、日历日面板作曲区、时间线筛选、面积卡片和 `.tag`；`getByText` 会匹配**隐藏页签里的元素**（`display:none` 的 `#tab-cal`），而 `getByRole` 默认忽略它们。字符串 `name` 默认是大小写不敏感的**子串**匹配，`腿` 会匹配多个按钮。
- 全角标点：预设标签 `LeetCode：`（全角冒号 U+FF1A）、toast `已记录：…`、`完成：…`、aria-label `编辑：…`、`，` 分隔；应用的 `fills()` 同时接受 `：` 和 `:`，但文案里是全角。周范围 `wkRange` 用的是**en dash（U+2013）** 加空格，不是连字符。
- 无编号化：`md()` 输出 `3月5日`（不补零）。
- Windows 控制台代码页（本机 PowerShell 报告 437，中国区常见是 936）会让 list 报告里的中文变成乱码；测试文件必须是无 BOM 的 UTF-8。
**Prevention:** 所有定位器先用 `#tab-wk`、`#tab-goal`、`#editor`、`#dayPanel`、`#filters` 等 id 限定范围；按钮用 `getByRole('button', { name, exact: true })`；从源码**复制**含标点的字符串（不要手敲），范围用正则 `/[–-]/`；把用到的文案集中放进 `tests/support/strings.ts`，这样以后改文案只改一处；用 `['list'], ['html', { open: 'never' }]` 作为报告器，乱码时看 HTML 报告，或在 Git Bash/Windows Terminal（UTF-8）里运行。
**Warning signs:** `strict mode violation: resolved to N elements`；一个测试在窄屏或切换页签后找到隐藏元素；终端出现 `�`。
**Phase to address:** Phase 1（建立约定和 `strings.ts`）；Phase 2+ 持续

### Pitfall M6: 响应式布局改变 DOM 行为
**What goes wrong:** 应用有多个断点：900 px（周布局单列、`pickDay` 额外调用 `scrollIntoView({behavior:'smooth'})`）、820 px（日历布局）、720 px（面积卡片 3 列）、560 px（任务网格、对话框变底部面板、`.ed-foot .hint` 被隐藏）。Playwright 默认视口 1280×720，只覆盖桌面。窄屏测试里，平滑滚动期间元素"不稳定"会让点击重试；`.hint` 在 ≤560 px `display:none`，对它的 `toBeVisible` 会失败；拖放在单列堆叠布局里的坐标和桌面不同。
**Prevention:** 默认桌面视口固定为 `1280×800`；再设一个 `narrow` 项目（`viewport: { width: 520, height: 900 }`，**不要**用设备描述符，见 M1），只用 `--grep @narrow` 跑少量测试：周视图选日期并滚动、编辑弹窗底部面板、目标任务网格；配置 `colorScheme: 'light'`（应用有 `prefers-color-scheme: dark` 样式）和 `reducedMotion: 'reduce'` 保证可复现。不要为了窄屏把整个套件复制一遍。
**Warning signs:** 同一个测试桌面通过、窄屏失败；点击时出现 `element is not stable`。
**Phase to address:** Phase 2+（横切，建议放在周视图和目标视图之后的一个小 phase，或并入目标视图）

### Pitfall M7: localStorage 隔离和 `file://` 与 `http://localhost` 的来源差异
**What goes wrong:**
- Playwright 默认每个测试一个全新的 `BrowserContext`，localStorage 天然隔离；但如果有人为了"复用登录"用了 `storageState` 或 `launchPersistentContext`，状态会泄漏，指向真实 Edge 配置目录更是严重问题（C12）。
- `file://` 页面的 localStorage 在同一 context 里所有 `file://` URL 共享一个来源；换成 `http://localhost` 来源不同，同一份种子数据是看不到的。
- `file://` 页面不能用 `page.route` 拦截主页面加载（只能拦截它发起的 `http(s)` 请求）。
- 不要为了用 `http://` 引入静态服务器（`webServer`），Windows 上进程树清理和端口冲突会带来额外问题；`file://` 就足够，而真实契约也写明"保存为文件的页面没有 `window.claude`"，与本地模式完全一致。
- Windows 路径要用 `pathToFileURL(path.resolve(...)).href`，不要手拼 `file:///C:\...`。
- 托管环境里页面运行在沙盒 iframe 里，localStorage 行为可能不同（LOW，没有验证），所以 `file://` 的结果不能推出托管环境的行为。
**Prevention:** 一个 `appUrl` 常量，来自 `pathToFileURL`；不用 `storageState`、不用持久 context；在 Phase 1 的冒烟测试里断言新 context 的 localStorage 为空。
**Warning signs:** 测试顺序一变结果就变；`goto` 的 URL 里出现反斜杠或 `%`。
**Phase to address:** Phase 1

### Pitfall M8: `Date.now()` 生成的 id 和重复文本
**What goes wrong:** `uid()` 是 `Date.now().toString(36)` 加 5 位随机字符。固定时间下前缀相同，冲突概率极低但存在；真正的问题是：id 不可预测，所以测试**不能**用 `data-edit` 的值定位；同一测试里创建两条同文本记录，`aria-label="编辑：…"` 重复，触发严格模式违规。顺序是插入顺序（`Array.sort` 稳定，时间线按日期降序，同日保持插入顺序），不是 id 顺序。
**Prevention:** 用文本或 aria-label 定位，并保证每个测试内文本唯一；需要断言顺序时用 fixture 里手写的 id 和固定顺序；不要断言 id 的格式；用 `locator.filter({ hasText })` 缩小范围。
**Warning signs:** `strict mode violation` 出现在"添加后再添加同一条"的测试里。
**Phase to address:** Phase 1

### Pitfall M9: 导出按钮的可见性断言太早会"假通过"
**What goes wrong:** `downloads` 在 `store.load()` **之后**才 resolve（L377），所以导出按钮出现得比状态行晚。本地模式下"按钮是隐藏的"这条断言如果在 `init()` 完成之前执行，会因为按钮本来就还没出现而**瞬间通过**，即使应用其实会显示它们。反过来，账户模式的"按钮出现"需要自动等待。
**Prevention:** 隐藏断言前先 `await expect(status).toHaveText('已保存在此浏览器中（换设备不会同步）')`（此时 init 已走到 `setStatus`，但 `downloads` 还在后面）。更稳的做法：mock 对 `downloads` 的 `use` 也走可配置延迟，本地模式则等一个已知的完成信号（`#status` 文字加一次 `page.evaluate(() => new Promise(r => setTimeout(r, 0)))` 之后），并在 Phase 1 用变异检查（让 mock 在本地模式里也提供 `downloads`，该测试必须变红）。
**Warning signs:** "本地模式没有导出按钮"测试从未失败过。
**Phase to address:** Phase 2+（导入导出）；Phase 1 的状态等待 helper

### Pitfall M10: init 脚本的形式和 Playwright 的转译边界
**What goes wrong:** `addInitScript({ path })` 读取文件内容原样注入，**不会转译 TypeScript、不支持 import/export**；路径是相对**当前工作目录**解析的，从别的目录运行 `npx playwright test` 会找不到文件。TESTING.md 推荐的位置 `tests/shims/claude-runtime.js` 是对的，要保持为普通 JS。
**Prevention:** 路径用 `path.join(__dirname, ...)`（或 `import.meta.dirname`）；shim 里只放 IIFE；配置经由函数形式的 init 脚本写 `window.__MOCK_CFG__`（见 C4）。
**Warning signs:** `SyntaxError: Unexpected token 'export'` 在页面控制台；换目录运行就找不到 shim。
**Phase to address:** Phase 1

### Pitfall M11: 目标视图的细节
**What goes wrong:** 勾选任务触发 `change` 事件，`doneDate` 设为"今天"（冻结日期），并 `renderAll()` 重绘；截止日期是 `type=date` 输入，`fill('2026-03-12')` 在 Chromium 里可行，必须是 `YYYY-MM-DD`；过期是字符串比较 `s.due<t`；力量输入框的 `input` 事件让"保存"按钮出现，值与当前相同时不保存；`hist` 保留最近 30 条，同一天再次保存是覆盖最后一条；自定义待办的删除按钮 `aria-label="删除待办"` 不唯一，需要限定在对应行；位置 id 让 fixture 的 `tasks` key 依赖源码里的任务顺序。
**Prevention:** 用冻结日期的 fixture 构造"已完成、未完成、今天到期、已过期"四种状态，期望值从 fixture 推导；自定义待办按文本行限定；力量测试覆盖：改值 → 保存按钮出现 → Enter 保存 → toast `卧推已更新为 …kg` → 达标时 `…达标了`。
**Warning signs:** 删除了错误的待办；过期标记在换日期后消失。
**Phase to address:** Phase 2+（目标视图）

### Pitfall M12: mock 随真实契约漂移（长期）
**What goes wrong:** 契约文件在 `AppData/Local/Temp/claude/bundled-skills/2.1.309/<hash>/artifact-capabilities/0.2.96/`，这个路径带版本号和哈希，Claude Code 升级后会消失；mock 一旦和契约脱节，所有账户模式测试都是对着一个想象中的宿主在验证。
**Prevention:** 在仓库内写 `tests/shims/CONTRACT.md`：记录对齐的版本 `0.2.96`、本 mock 实现的契约条目（`use` memoize、冻结命名空间、`DocumentSnapshot` 形状、`set` 整体替换、`downloads.save` 的参数和 `{status:'saved'}`、扩展名白名单）、**明确没有实现**的条目（`onSnapshot`、错误码、速率限制），以及重新核对的步骤。再加一个 `contract` spec（C2）自动检查。`downloads.save` 的 mock 需要校验文件名扩展名在白名单（`csv`、`json` 等）、`data` 非空，并能处理 `string/Blob/ArrayBuffer`（应用现在只传字符串，但以后可能变）。
**Warning signs:** CONTRACT.md 的版本号落后于 Artifact 运行时；mock 里没有一条注释指向契约。
**Phase to address:** Phase 1（建立）；每次里程碑结束时复核

### Pitfall M13: 范围蔓延——TESTING.md 推荐的失败模式和本里程碑"只做正常路径"冲突
**What goes wrong:** TESTING.md 的优先场景 3（加载失败回退）和 `Error Testing` 示例（`set()` 拒绝 `invalid_argument`）属于 mock 错误路径，而 PROJECT.md 明确把它们列为 Out of Scope。执行者按 TESTING.md 做会超范围；反过来，完全不留扩展点会让以后加错误路径要重写 mock。
**Prevention:** 计划里明确"错误路径不做"；mock 的内部结构（`impl[name]` 表和每个方法的钩子）保持可扩展，但不实现拒绝逻辑；`KNOWN-BUGS.md` 里把"保存失败不重试"、"加载失败回退"登记为"待后续里程碑"。
**Warning signs:** mock 里出现 `reject`；测试标题里出现 `invalid_argument`。
**Phase to address:** Phase 1（计划阶段）

### Pitfall M14: CSV/JSON 导出的断言
**What goes wrong:** 导出走 `window.__dl.save({ filename, data })`，不是浏览器下载，所以没有 Playwright 的 `download` 事件；断言要读 mock 记录的调用。CSV 行用 `\n` 连接，日期是 `MM/DD/YYYY`，主题截取第一行的前 80 个字符，`csvCell` 只对 `",\n` 加引号，裸 `\r` 不加；以 `=+-@` 开头的内容不转义；`rows.length===1`（没有数据）时是 toast `还没有可导出的日期` 而不是调用 `save`。`window.__dl` 是应用设置的全局变量，不要靠它判断，用 mock 的调用日志。
**Prevention:** 合成数据故意包含逗号、双引号、换行、`=` 开头、全角字符，精确比较 CSV 文本；`备份` 的文件名含 `today()`，必须在冻结时间下断言；JSON 备份断言 `JSON.parse(data)` 与当前状态深度相等；空状态测试单独写。
**Warning signs:** 导出测试在不同日期失败；等待了不存在的 `download` 事件。
**Phase to address:** Phase 2+（导入导出）

### Pitfall M15: 全局 pageerror / 控制台错误监听缺失，渲染器抛错被应用吞掉
**What goes wrong:** 应用没有 `console` 输出，很多错误被 `catch(e){}` 吞掉；`normalize()` 只做顶层检查，坏的日志项（例如缺少 `date`）会通过导入，然后在 `renderTimeline` 的 `b.date.localeCompare` 处抛错，UI 画一半（`renderAll` 在 `renderTimeline` 之前已经渲染了别的区域），并且坏状态已经 `persist()`。普通测试看不到这个 `pageerror`。
**Prevention:** 全局 fixture 监听 `page.on('pageerror')` 和 `console.error`（过滤被 abort 的字体请求），默认让测试失败；"畸形导入"测试用显式 `expectPageError` 声明允许。
**Warning signs:** 界面不对但测试通过；导入后某个视图是空的。
**Phase to address:** Phase 1（建 fixture）；Phase 2+ 导入的畸形用例

## Minor Pitfalls

### Pitfall m1: 其他设置
**What goes wrong / Prevention:**
- 输出目录 `test-results/`、`playwright-report/` 未加入 `.gitignore`（C11 已覆盖）。
- 并行：每个 worker 一个浏览器，每个测试一个 context，系统 Edge 内存占用较高；本机用 `workers: 2` 起步，`fullyParallel: true` 前先确认隔离（M7）。
- `expect.poll` 默认超时 5 s，测试默认 30 s；去抖相关的等待不会超，但调试时不要靠加大超时去掩盖问题。
- 日期输入要用 `fill('YYYY-MM-DD')`；`pressSequentially` 不适合 `type=date`。
- `fill()` 对文本框只触发一次 `input`，会让去抖定时器只重置一次，这是预期的；"边输入边保存"不需要用 `pressSequentially`。
- `Ctrl+Enter` 用 `press('Control+Enter')`，应用同时接受 `metaKey`。
- 日历"今天"按钮和"高亮"只靠 `.today` 类（周视图的 `.day.today`、日历 `.cell.today`），断言类而不是颜色。
- `timezoneId`/`locale` 在 `use` 里设置（`locale: 'zh-CN'`），不要靠主机设置。

**Phase to address:** Phase 1 的配置清单

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `waitForTimeout(700)` 等待保存 | 省事 | 慢，且在慢机器上仍然偶发失败 | never（用 `expect.poll` 或 `clock.runFor`）|
| 整个测试 `test.fail()` 标记已知 bug | 报告变绿 | 掩盖其他失败，修复后才提示 | 只对窄断言的"期望行为"测试，且必须有对应的特征化测试 |
| mock 把文档放在页面内存 | 实现简单 | reload 测不了，或被迫借用 localStorage 混淆 | never |
| `toHaveScreenshot` 基线 | 视觉回归 | 把个人计划文字提交进仓库 | never（本项目）|
| 每个视图各自写保存等待 | 快 | 逻辑分叉，C6 的问题重复出现 | never（共用 `expectSaved`）|
| 用真实备份的结构做 fixture | 贴近真实 | 带入真实数据 | never |
| 从 TESTING.md 直接抄失败模式 | 覆盖更多 | 超出"只做正常路径"的范围 | 不适用本里程碑 |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `window.claude.use("db")` | 同步/微任务 resolve、不冻结、暴露在 `window.claude.db` | 宏任务延迟 resolve、memoize、冻结、只暴露 `use`（C2）|
| `db.doc().get()` | 缺失文档返回 `null`；`data` 是属性 | `{id, exists, data(), metadata}`，缺失时 `data()` 为 `undefined`（C3）|
| `db.doc().set()` | 不克隆、不要求对象 | JSON 克隆；非对象抛 `TypeError`；同步落盘到独立 key（C3、C6）|
| `use("user")` | `id()` 返回 `null` 或每次不同 | 稳定字符串，例如 `u_test`；`null` 只用于专门的"无账户"配置 |
| `use("downloads")` | 假设会触发浏览器下载事件 | 记录 `save` 调用，返回 `{status:'saved'}`，校验扩展名（M12、M14）|
| Google Fonts | 不拦截，或只靠 `page.route` | context 级 abort + `--host-resolver-rules` + 请求主机白名单（C9）|
| 系统 Edge | 运行 `playwright install` | 只用 `channel: 'msedge'`，精确固定版本，记录 `browser.version()`（C12）|
| `file://` | 手拼路径，或引入静态服务器 | `pathToFileURL`，不用 `webServer`（M7）|

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| 去抖等待用真实时间 | 每个保存类测试多 0.6-1.4 s | 大多数测试用 `expect.poll`；去抖专项用 `clock` | 约 100 个保存类测试时多出 1-2 分钟 |
| 每个测试启动一个新的 Edge | 启动慢、内存高 | 使用默认的 worker 共享浏览器、每测试一个 context | 并行 workers 较多时 |
| 窄屏项目复制全套测试 | 运行时间翻倍 | 只用 `@narrow` 标签的少量测试 | 套件超过 50 个测试时 |
| 目标视图 `renderAll` 全量重绘 | 极大数据量才慢 | fixture 控制在几十条，不需要压力测试 | 不是本里程碑的问题 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| 访问 `claude.ai` 或任何外网 | 违反硬约束，可能触碰生产存储 | 请求主机白名单 fixture（C9），测试代码里不出现 `claude.ai` 的 URL |
| XSS 测试用真实的脚本载荷 | 在 Edge 里执行任意代码 | 载荷只设置 `window.__xss = 1`（例如 `<img src=x onerror=...>`），不发请求；断言该标志；载荷只存在合成 fixture 里 |
| 用真实备份当 fixture | 隐私泄漏、提交真实数据 | `.gitignore`、标记字段检查、内存文件（C11）|
| 报告、trace、截图被提交 | 个人计划文字进入 git | 忽略输出目录，不用截图基线（C11）|
| 误用 `launchPersistentContext` 指向真实 Edge 配置 | 读写真实浏览数据 | 永远用 Playwright 创建的临时配置（C12）|

## UX Pitfalls（被测应用的体验特性对测试的影响）

| Pitfall | Test Impact | Better Approach |
|---------|-------------|-----------------|
| 应用失败时不提示、静默降级 | 测试无法从界面分辨成功和失败 | 状态行文字加 mock 调用日志同时断言（C1）|
| toast 单例、1.8 s/5 s 消失 | 撤销测试和断言容易错过 | `clock` 控制，类名断言（C8）|
| 日历周日起始、周视图周一起始 | 断言格数和星期顺序容易错 | 分别为两个视图写期望（C5）|

## "Looks Done But Isn't" Checklist

- [ ] **账户模式测试：** 常缺"确实走了 mock"的证明——验证状态行为 `已同步保存到你的账户`、mock 调用日志有 `get`/`set`、`us-journey-tracker-v1` 为空
- [ ] **变异检查：** 临时让 mock 的 `user.id()` 返回 `null`、让本地模式也提供 `downloads`，对应测试必须变红
- [ ] **保存往返：** 常缺 reload 后重新读取——验证 reload 后界面显示保存的内容，且没有被 init 种子覆盖（C4）
- [ ] **导入：** 常缺对话框消息和取消分支——验证 `dialog.message()`、接受和取消各一条
- [ ] **toast：** 常用 `toBeVisible` 误判——验证断言用的是 `.on` 类
- [ ] **拖放：** 常缺"数据里日期真的变了"——验证保存后的状态，而不只是界面
- [ ] **时间：** 常缺固定时区——验证 `timezoneId` 在配置里，日期用 UTC 正午构造
- [ ] **网络：** 常缺白名单——验证有一条测试在有外部请求时会失败
- [ ] **已知 bug：** 常缺登记——验证 CONCERNS.md 的每一条要么有特征化测试要么在 `KNOWN-BUGS.md` 里有说明
- [ ] **仓库卫生：** 常缺 `.gitignore`——验证 `git status` 没有 `*备份*`、`test-results/`、`playwright-report/`、`node_modules/`
- [ ] **一条命令：** 常缺 `open: 'never'`——验证 `npx playwright test` 在失败时也会退出

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| C1 静默回退掩盖 | LOW | 给账户 fixture 加状态行等待和调用日志断言，重跑变异检查 |
| C3/C4 存储形状或播种覆盖 | MEDIUM | 重写 mock 存储和守卫，重跑所有往返测试 |
| C5 时区错误 | LOW | 在配置里固定 `timezoneId`，把 fixture 日期改成 UTC 正午 |
| C9 外网请求泄漏 | MEDIUM | 加 `--host-resolver-rules` 和主机白名单，检查报告和 trace 里的请求 |
| C11 真实数据已提交 | HIGH | 立即停止，重写历史（需要用户批准）；这是本项目最重要的预防项 |
| C12 Edge 更新后不兼容 | MEDIUM | 记录版本，先升级 Playwright 的小版本，不下载浏览器 |
| M12 mock 漂移 | MEDIUM | 重读契约，更新 CONTRACT.md 和 `contract` spec |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| C1 静默回退 | Phase 1 | 变异检查：`id()` 返回 `null` 时账户测试变红 |
| C2 mock 时序 | Phase 1 | `contract` spec 通过；延迟配置存在 |
| C3 快照形状 / 持久化 | Phase 1 | reload 往返测试通过，localStorage 的应用 key 为空 |
| C4 播种覆盖 | Phase 1 | reload 后看到的是应用保存的数据，不是 fixture |
| C5 时间/时区 | Phase 1；日历、目标 Phase 2+ | 同一套测试在不同主机时区下结果一致；35/42 格和 DST 用例 |
| C6 去抖保存 | Phase 1 | 没有 `waitForTimeout`；`expectSaved` helper |
| C7 confirm | Phase 2+（导入）| `dialog.message()` 被断言；接受/取消各一条 |
| C8 toast | Phase 1 | 全部 toast 断言基于 `.on`；撤销过期用 clock 测 |
| C9 网络 | Phase 1 | 外部主机白名单 fixture；故意请求外部主机时测试失败 |
| C10 已知 bug | Phase 1 建约定；Phase 2+ 补充 | `KNOWN-BUGS.md` 与 CONCERNS.md 对账 |
| C11 真实数据 | Phase 1 | `.gitignore` 到位；fixture 标记测试；无截图基线 |
| C12 安装/版本 | Phase 1 | `package-lock.json` 提交；无 `ms-playwright` 缓存目录；`open: 'never'` |
| M1 拖放 | Phase 1（spike）| 有头/无头各跑一次 |
| M2 dialog/焦点 | Phase 1 | 编辑弹窗的打开、保存、取消、backdrop、Escape 测试 |
| M3 隐藏文件输入 | Phase 2+（导入）| 直接对 `#importJson` 设置文件；畸形用例分三类 |
| M4 捕获阶段 | Phase 1；Phase 2+ | 删除时编辑器不弹出；点击记录不改所选日期 |
| M5 中文选择器 | Phase 1 | `strings.ts` 存在；定位器都有范围限定 |
| M6 响应式 | Phase 2+ | `@narrow` 项目运行并通过 |
| M7 存储/来源 | Phase 1 | 新 context 的 localStorage 为空；`pathToFileURL` |
| M8 id/重复文本 | Phase 1 | 没有测试依赖 `data-edit` 的值 |
| M9 导出按钮可见性 | Phase 2+（导入导出）| 变异检查：本地模式提供 `downloads` 时测试变红 |
| M10 init 脚本形式 | Phase 1 | 从仓库外的目录运行也能找到 shim |
| M11 目标视图 | Phase 2+（目标）| 四种任务状态均由 fixture 推导期望值 |
| M12 mock 漂移 | Phase 1 建立；每里程碑复核 | CONTRACT.md 与 `contract` spec |
| M13 范围蔓延 | Phase 1（计划）| mock 里没有 `reject` |
| M14 导出断言 | Phase 2+ | CSV 精确比较，含特殊字符 |
| M15 pageerror | Phase 1 | 全局 fixture 存在；畸形导入显式允许 |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1：配置和安装 | C12：脚手架下载浏览器、加 CI；Edge 版本漂移 | 手写 `package.json`/config，精确固定版本，`open: 'never'`，记录 `browser.version()` |
| Phase 1：mock | C1、C2、C3、M10、M12 | 静默回退证明、宏任务延迟、冻结的命名空间、独立存储 key、CONTRACT.md |
| Phase 1：fixture | C4、C5、C11 | 播种守卫、UTC 正午、`timezoneId`、标记字段、`.gitignore` |
| Phase 1：本周视图 | C6、C8、M1、M2、M4、M8 | `expectSaved`、`.on` 类断言、拖放 spike、编辑弹窗、捕获阶段用例 |
| Phase 2+：日历 | C5、M4 | 周日起始、35/42 格、日面板的捕获阶段 |
| Phase 2+：目标 | C5、M11、C11 | 过期判断、位置 id 集中管理、不复制个人任务文字 |
| Phase 2+：时间线 | M5 | 筛选按钮范围限定、`完成：` 全角冒号 |
| Phase 2+：导入导出 | C7、M3、M9、M14、C10 | 对话框先注册、`setInputFiles` 直接用、等待 init 后再断言隐藏、CSV 精确比较、取消后重试的 spike |
| Phase 2+：响应式 | M6 | `@narrow` 项目，不用设备描述符 |

## Sources

- Playwright 官方文档：browsers（msedge 渠道、新 headless、`install` 覆盖系统浏览器、版本支持说明）https://playwright.dev/docs/browsers — HIGH
- Playwright 官方文档：clock（`setFixedTime` 与 `install` 的区别、`pauseAt`/`runFor`/`fastForward`、调用顺序）https://playwright.dev/docs/clock — HIGH
- Playwright 官方文档：dialogs（无监听器自动 dismiss、监听器不处理会 stall）https://playwright.dev/docs/dialogs — HIGH
- Playwright 官方文档：actionability（`opacity:0` 视为可见；`setInputFiles` 不做 actionability 检查）https://playwright.dev/docs/actionability — HIGH
- Playwright 官方文档：input（文件上传、拖放两次移动）https://playwright.dev/docs/input — HIGH
- Playwright 官方文档：Locator API（`dragTo` 的 `steps`、`sourcePosition`、`targetPosition`）https://playwright.dev/docs/api/class-locator — HIGH
- Playwright 官方文档：test-annotations（`test.fail`/`fixme`/自定义注解/标签）https://playwright.dev/docs/test-annotations — HIGH（`test.fail` 意外通过时的具体报告方式官方未写明）
- Playwright 官方文档：test-reporters（HTML 报告 `open` 默认 `on-failure`）https://playwright.dev/docs/test-reporters — HIGH（是否阻塞终端官方未写明，按实际经验处理）
- Playwright 官方 release notes（1.64 的 Chromium 156.0.8078.4 / Edge 155）https://playwright.dev/docs/release-notes — HIGH
- npm registry 元数据：`@playwright/test@1.64.1`、`playwright@1.64.1`、`playwright-core@1.64.1`（无 install 脚本；node >=20）— HIGH
- 本机检查：Edge 156.0.4314.58、Windows 时区 Pacific Standard Time、区域 zh-CN、控制台代码页 437 — HIGH
- 项目源码和规划文档：`us-journey-tracker.html`、`.planning/PROJECT.md`、`.planning/codebase/{CONCERNS,TESTING,INTEGRATIONS}.md` — HIGH
- Artifact 运行时契约 0.2.96：`claude.d.ts`、`db.d.ts`、`downloads.d.ts` — HIGH
- 搜索结果（相关但不是直接证据）：Chromium 对同一文件不触发 `change`（Matrix React SDK 的 BrowserWorkarounds 注释、WebKit Bugzilla 63929）— LOW（没有 Playwright 的专门报告）；Playwright `preconnect` 是否被 `page.route` 拦截没有找到资料 — LOW

### 本次研究中未验证（需要 Phase 1 spike）

- Edge 156 是否接受 `--host-resolver-rules=MAP * ~NOTFOUND`（以及它是否能阻止 `preconnect`）
- `msedge` 新 headless 下 HTML5 拖放、`<dialog>`、`setInputFiles` 与有头模式是否一致
- `clock.install` + `pauseAt` 后 Playwright 自己的"稳定"检查是否仍然正常
- `setInputFiles` 的路径形式和内存 buffer 形式在同一文件重复选择时是否都触发 `change`（决定"取消导入后无法重试"能否复现）
- `addInitScript(fn, arg)` 对 `{ path }` 形式不支持参数的说法（来自记忆，未逐字核对）

---
*Pitfalls research for: Playwright 测试和 Claude Artifact API mock（单文件原生 JS 应用，Windows + 系统 Edge）*
*Researched: 2026-11-01*
