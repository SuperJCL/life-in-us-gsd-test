# Phase 10 — UI Review（离线与实时同步）

**Audited:** 2026-11-10
**Baseline:** `09-UI-SPEC.md`（status: approved，2026-11-08）的 §S2（状态栏五种状态和文案总表）、§S4（横幅）、§S5（提示）、§S6（远端更新提示）；Phase 10 没有自己的 UI-SPEC，按 `10-CONTEXT.md` 的 D-01 到 D-08 与 Claude's Discretion 核对。
**Screenshots:** not captured（本机 localhost:3000、5173、8080 均无应用响应，按指令只做代码审计，未启动任何服务，未运行 Playwright）
**Interaction captures:** off（`workflow.ui_interaction_capture` 关闭）
**Scope:** 只审 Phase 10 新增或改动的界面：状态行的五种状态与“立即重试”行内按钮、`expired` 横幅与“重新登录”、远端更新横幅与提示、D-06 加回提示、离线可编辑的启动路径（不再是只读的连不上）。四个既有视图不在审计范围内。

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 契约文案逐字存在；但离线和重试文案在“没有待上传修改”时也写“修改已存在本机”“保存失败”，与事实不符 |
| 2. Visuals | 3/4 | 远端更新横幅、过期横幅、状态行圆点结构清楚；D-06 提示替换“已保存”提示，手机宽度未经截图核对 |
| 3. Color | 3/4 | 没有新增颜色 token；info 横幅用 accent 符合 S4；深色主题仍无证据（与 Phase 9 相同的待测项） |
| 4. Typography | 4/4 | 12 / 14 / 16 与 Display 四个字号，400 / 600 两个字重；Phase 9 指出的按钮 14px 问题已修（`us-journey-tracker.html:242`） |
| 5. Spacing | 4/4 | 横幅 `margin:16px 0 0`、`padding:12px 16px`、`gap:12px`；`#boot .bar` 已改为 `12px 0 8px`；`.status button` 的 `4px 8px` 在刻度上 |
| 6. Experience Design | 3/4 | 状态机、离线编辑、过期不丢、远端挂起与“现在更新”、D-06 都已接通；离线和重试的文案在无修改时误导用户，见 Top 3 第 1、2 条 |

**Overall: 20/24**

判定：没有 BLOCKER（没有 1 分的支柱，也没有阻断任务完成的缺陷）。全部为 WARNING 或 INFO。

---

## Top 3 Priority Fixes

1. **离线状态行在没有待上传修改时仍写“修改已存在本机”** — 用户会以为自己的改动还没上传，实际上没有任何改动。`showSync()` 在 `net==="offline"` 时直接用 `T_OFFLINE(n)`，没有判断 `docs.state.dirty`（`us-journey-tracker.html:1049-1058`，文案常量在 `:1045`）。修复：当 `n===0` 且 `!docs.state.dirty` 时改用不含“修改已存在本机”的文案，例如 `离线，联网后自动检查更新`；该文案需要先加入 `09-UI-SPEC.md` 的 S2 总表并经所有者确认，不能直接改字。

2. **后台对账失败时状态行写“保存失败”，即使没有任何修改** — 有缓存的启动、离线后的后台重试（`requestSync("boot")`，`:1057`）只是在查询服务器，并没有保存任何东西，却显示 `保存失败，修改仍在本机，N 秒后自动重试` 和“立即重试”。用户会误以为数据丢了风险。修复：在 `retrying` 分支加 `docs.state.dirty` 判断，无待上传修改时用另一句中性文案（例如 `连不上服务器，{s} 秒后自动再试`），同样需要先写入契约并经所有者确认。

3. **契约和代码的文案对照表不完整，且登录页应用名与契约不一致** — (a) D-06 的提示 `这条记录在另一台设备上被删除，已按你的修改重新加回`（`us-journey-tracker.html:1364`、`:1677`）不在 `09-UI-SPEC.md` 的 S5 提示表里，只在 CONTEXT 里确认过；(b) 登录页和标题写的是 `计划手记`（`us-journey-tracker.html:6`、`:290`），而 S1 的 Display 文本和 CLAUDE.md 的应用名是 `在美国的日子`。两者都需要所有者确认后同步到契约，避免以后的审计按不同的基线判断。应用名问题不属于 Phase 10 的改动，但登录页在本阶段仍会被同一个审计看到。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**正面证据（逐字核对，代码中存在）：**

- 状态行：`正在和服务器对账…`、`网络较慢，还在连…`、`保存中…`、`已同步`、`登录已过期，请重新登录`（`us-journey-tracker.html:697`、`:1045-1046`、`:861`）
- 横幅：`其他设备有新的修改，稍后会自动更新。` + `现在更新`（`:1362`）；`登录已过期，本机的修改还在，重新登录后会继续上传。` + `重新登录`（`:1090`）；`本机空间不够，没能在本机保存这次修改。上传成功之前请别关闭或刷新页面。` + `知道了`（`:813-815`）
- 提示：`已更新为其他设备上的最新内容`（`:984`、`:1363`，4000 毫秒，与 S5 一致）
- 过期登录页提示：`登录已过期，请重新登录` 与可选的 `本机还有没上传的修改，用同一账号登录后会自动上传。`（`:697`，`loginNotice` 在 `:711-712` 按条件显示）
- 等待态与对话框文案沿用 Phase 9，没有变化

**问题：**

- **WARNING — 离线文案在无修改时声称有修改。** `T_OFFLINE(n)` 在 `n=0` 时仍是 `离线，修改已存在本机，联网后自动上传`（`:1045`）。打开应用时若浏览器断网且没有任何待上传内容，或者后台对账失败但本机干净，这句话都会出现。这是事实性错误，不是风格问题。契约 S2 的 `offline` 行只定义了“有数量”和“有修改”两种情形，没有覆盖“没有修改”的情形。见 Top 3 第 1 条。
- **WARNING — 重试文案在无修改时写“保存失败”。** `showSync()` 的 `retrying` 分支（`:1057`）不检查脏标记，所以干净的缓存在后台对账失败时也显示 `保存失败，修改仍在本机，…`。见 Top 3 第 2 条。
- **INFO — D-06 提示未进入契约表。** `这条记录在另一台设备上被删除，已按你的修改重新加回` 已由所有者在规划核查中确认（CONTEXT D-06），但 `09-UI-SPEC.md` 的 S5 表和 Copywriting Contract 都没有这一行。建议补进契约，保证追溯。
- **INFO — 应用名与契约不一致。** `计划手记`（`us-journey-tracker.html:6`、`:290`、`:316`）对比 S1 的 `在美国的日子`。不属于 Phase 10 的改动，但需要所有者确认是否是有意改名。

### Pillar 2: Visuals (3/4)

**正面证据：**

- 状态行与横幅分工清楚：状态行始终同步文字，横幅只在需要注意或按钮时出现，`SB_ORDER` 的优先级与 S2 一致（`us-journey-tracker.html:848`）。
- `expired` 横幅 `warn` 色条、带一个 `.primary` 的 `重新登录`，与 S4 一致（`:268-272`，`:1090`）。
- 远端更新横幅使用 `info` 语气（`--c-lang` 色条）和唯一的 `现在更新` 按钮（`:1383`），不遮挡输入区域，符合 S6 的“不抢焦点”要求。
- 状态行圆点的颜色映射符合 S2 的 tone 表（`:262-266`）；`retrying` 和 `offline` 同为 `--c-job`，`saving` 与 `reconciling` 为 `--muted`，`synced` 为 `--c-lang`。
- `.status button`（`:267`）是 12px 无边框的下划线文字按钮，与 S2 的“行内按钮”定义一致。

**问题：**

- **WARNING — 远端更新横幅在页面顶部，用户正在输入时可能看不到。** 横幅位于 `header.top` 之后、`nav.tabs` 之前（`:323` 附近），而草稿输入框在视图内部。手机上若已滚动到底部，横幅可能不在视口内。契约 S6 允许顶部位置，但没有规定滚动后的可见性。需要在 375px 宽度下核对（UAT 项待做）。
- **INFO — D-06 提示替换了“已保存”提示。** `toast()` 是单槽，`queueMicrotask` 之后的 `T_LOG_READDED` 会立即替换 `已保存` 或 `已保存，移到 …`（`:1677`）。这是设计上的取舍：用户看到的是更重要的一条。但用户无法同时确认保存成功。可接受，记录在案。
- **INFO — 离线时没有常驻的离线横幅。** 按 S2 表设计，离线不显示横幅；唯一的信号是底部状态行，且它位于 `.wrap` 内部，页面很长时需要滚动。这与 S2 一致，不计为缺陷，但手机上的用户可能察觉不到离线状态。

### Pillar 3: Color (3/4)

**正面证据：**

- 没有新增颜色 token；新界面只使用 `--paper`、`--surface`、`--ink`、`--muted`、`--line`、`--red`、`--c-job`、`--c-lang`（`us-journey-tracker.html:10-32`，新规则在 `:241-284`）。
- accent 的使用符合 S1 保留清单：`info` 横幅色条（`:270`）和状态行“已同步”圆点（`:263`）。
- `--c-job` 只用于色条和圆点，没有用作文字色（`:265`）。
- `expired` 和 `unreachable`、`toolarge` 的语气映射与 S2 的表一致。

**问题：**

- **WARNING — 深色主题没有证据。** 与 Phase 9 的 `09-UI-REVIEW.md` 相同：契约只给了浅色主题的对比度，深色的 `--c-job` 作为色条、`--red` 作为错误文字的对比度没有计算。Phase 10 新增的状态行文字（`--muted` 与 `--ink`）同样没有深色验证。Phase 9 的 UAT 第 1 项仍是 pending，本阶段没有关闭它。

### Pillar 4: Typography (4/4)

**正面证据（代码与契约逐条核对）：**

- 字号只有 12、14、16 和 Display：状态按钮 `.status button` 12px（`:267`）；横幅与 toast 14px（`:268`、`:208`）；`#boot h2` 16px 600 衬线（`:277`）；`#login h1` Display（`:242` 所在规则区）。
- 字重只有 400 和 600：`.toast[data-cloud] button{font-weight:600}`（`:212`）；横幅按钮沿用 `.primary` 的 600。
- Phase 9 指出的“新界面按钮不是 14px”已修：`:242` 的 `:is(#syncbar,#boot,dialog#confirm) button{font-size:14px}` 已存在，覆盖 `知道了`、`重试`、`仍然退出`、`#bootRetry`。
- Phase 9 指出的 `#boot .bar` 10px 外边距已改为 `12px 0 8px`（`:279`）。
- 没有发现 13px、15px、19px 或 700 / 800 字重被用在 Phase 10 的新界面上。

**问题：** 无。

### Pillar 5: Spacing (4/4)

**正面证据：**

- 横幅 `margin:16px 0 0`、`padding:12px 16px`、`gap:12px`（`us-journey-tracker.html:268`），全部是 4 的倍数或契约指定的 12。
- `.syncbar button{min-height:36px;padding:4px 12px}`（`:272`）符合契约的横幅按钮最小高度。
- `.status button{padding:4px 8px}`（`:267`）在刻度上。
- 启动卡片 `#boot .bar{margin:12px 0 8px}`（`:279`）、`#boot .primary{margin-top:16px}`（`:282`）符合 S10。
- 没有发现新增的 6、10、14、18、22 等奇数间距。

**问题：** 无。INFO：`.status` 的 `margin-top:28px`（`:207`）是 Phase 9 之前就有的旧值，不在本阶段改动范围内。

### Pillar 6: Experience Design (3/4)

**正面证据：**

- 离线可编辑（D-01、D-02）：`goBootOffline` 在有缓存时放开门控、清掉横幅、设置 `net="offline"`，并安排一次后台重试（`us-journey-tracker.html:903-911`）。3 秒“网络较慢”和 15 秒转离线的时间线与 D-02 一致（`:884-891`）。
- 没有缓存时仍是等待卡片和 `重试`，没有 `退出登录`（`:885`、`:890`，A6）。
- `expired` 不丢数据：`goExpired()` 只改网络状态和横幅，不动 `state`、缓存、`touched`、`ops`（`:1084-1092`）；之后不再发请求，直到重新登录（`:1093`）。过期后的登录页会带上过期提示和“未上传”第二行（`:697`、`:711`）。
- 远端更新：挂起到 `pendRemote`，忙碌时显示横幅，空闲或点按钮时通过 `applyView` 应用并 `renderKeep()` 保留草稿和焦点（`:1362-1400`）。`isBusy` 覆盖草稿、对话框、新标签输入、未提交的复盘和力量值（`:1367-1380`）。
- D-06：保存时若记录在远端已被删除，先接收挂起版本，再以同一 id 加回并提示（`:1670-1677`）。点删除时不提示。
- 冲突留底和下载留底的 toast、按钮、常驻入口与 Phase 9 契约一致；`cacheNote` 在缓存写入失败时显示 `cachefail` 横幅，并在下一次写入成功时自动消失（`:812-815`）。
- 门控的 `reconciling` 与 `readonly` 外观沿用 Phase 9，离线放开后门控被删除（`:906`）。

**问题：**

- **WARNING — 离线和重试状态的文案与实际数据不符（见 Pillar 1）。** 用户会因为“保存失败”而去找丢失的数据，或者因为“修改已存在本机”而误以为未上传的内容一直在，这两种误导都直接影响用户对“是否安全”的判断。
- **WARNING — 窄屏和深色的体验仍是 pending。** 远端横幅的可见性、D-06 提示在 375px 的完整显示、离线状态在手机上的可察觉性，都需要在真实屏幕宽度下核对；本次代码审计不能替代。
- **INFO — 离线 `offline` 状态下门控已放开，但 `unreachable` 横幅文案仍在代码里。** `unreachBar` 的文案 `现在只能查看上次的内容，不能修改`（`:876`）只在 `retrying` 路径上出现，而 `retrying` 只能由横幅上的按钮触发，因此对有缓存的启动路径几乎不可达。不影响用户，记录在案，可在清理时删除。
- **INFO — 无缓存等待卡片下，状态行文字 `连不上服务器，暂时只能查看，不能修改`（`:861`）写了“只能查看”，但此时没有任何内容可看。** 状态行位于 `.wrap` 内，等待卡片显示时 `.wrap` 是隐藏的，所以用户看不到这句话。不影响界面，但文案与场景不符，契约 S2 的 `unreachable` 行可以在下次修订时区分。

---

## Registry Safety

Registry audit: 0 third-party blocks checked（`components.json` 不存在，UI-SPEC 的 Registry Safety 为 none）。唯一的外部代码是已批准的 PocketBase SDK，同源加载并钉 sha256，不属于 UI 组件的审查范围。

---

## Files Audited

- `us-journey-tracker.html`
  - CSS：`:6-7`（应用名 title）、`:60-63`（`#snapshotBtn`、`#logoutBtn`、`.who`）、`:207-213`（toast 与 `data-cloud`）、`:223-226`（`#cf-body`）、`:241-242`（字号规则）、`:262-284`（状态点、状态按钮、横幅、等待卡片）
  - HTML：`:289-312`（登录页与等待卡片）、`:323`（`#syncbar`）、`:331-336`（工具栏）、`:379`（`#status`）、`:383`（`dialog#confirm`）
  - JS：`:597`（`persist`）、`:617`（`setStatus`）、`:645-660`（WRITER 与 BroadcastChannel）、`:680-745`（登录与过期提示）、`:770-830`（缓存、门控、横幅、`SB_ORDER`）、`:843-935`（对账与离线转换）、`:1040-1100`（状态行、重试、过期）、`:1200-1215`（失败分类）、`:1362-1400`（远端挂起与 `isBusy`）、`:1670-1677`（D-06 保存）
- `.planning/phases/09-login-cloud-storage/09-UI-SPEC.md`（审计基线）
- `.planning/phases/09-login-cloud-storage/09-UI-REVIEW.md`（上一次审计，Phase 9 指出的 Top 3 已在代码中修复）
- `.planning/phases/10-offline-realtime-sync/10-CONTEXT.md`（D-01 到 D-08）
- `.planning/phases/10-offline-realtime-sync/10-01-SUMMARY.md` 至 `10-09-SUMMARY.md`（搜索 UI、文案、偏差相关条目；10-01 至 10-09 的 PLAN 只用于确认意图，未逐条核对）
- `.planning/ui-reviews/.gitignore`（截图存放的 git 安全闸门已执行，已确认 `*.png` 等与 `interaction/` 被忽略，未产生截图）
