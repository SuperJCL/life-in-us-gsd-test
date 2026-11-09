# Phase 9 — UI Review（登录与云端存储）

**Audited:** 2026-11-09
**Baseline:** `09-UI-SPEC.md`（status: approved，2026-11-08）
**Screenshots:** skipped（没有开发服务器；本次按指令只做代码审计，未启动任何服务，未运行 Playwright）
**Interaction captures:** off（`workflow.ui_interaction_capture` 关闭）

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | UI-SPEC 的文案逐字在代码里找到；只有 S6 的远端更新文案按路线图留到 Phase 10 |
| 2. Visuals | 3/4 | 375px 下冲突提示的 toast 宽度被 `left:50%` 压到约 187px；换账号确认框的正文被误设为弱化色 |
| 3. Color | 3/4 | 色彩 token 与 60/30/10 分配符合契约；深色主题的对比度没有被任何证据验证（UAT 第 1 项待人工） |
| 4. Typography | 3/4 | 新界面的按钮缺少 14px 规则，实际渲染为 13px 或 UA 默认 13.33px；旧视图标题字体的变化未记录为接受 |
| 5. Spacing | 3/4 | 登录页和横幅基本落在 4 的倍数；启动等待卡片的进度条沿用了 10px 外边距 |
| 6. Experience Design | 3/4 | 门控、对账、登录错误、退出确认、留底、容量警告的状态与契约一致；窄屏和深色的体验仍需人工确认 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **冲突提示的 toast 在手机宽度下被挤窄** — 这是唯一一条需要用户点“下载留底”才能挽回数据的提示，文字和按钮会被挤在约 187px 的列里，换行很多，而 UI-SPEC E4 要求它在 375px 下完整可读。修复：在 `us-journey-tracker.html:212` 之后加一行 `.toast[data-cloud]{width:max-content;max-width:calc(100vw - 32px)}`（只作用于本阶段的 toast，不影响旧路径的 toast），然后在 375px 宽度下核对（对应 UAT 第 2 项）。
2. **传统路径（Claude Artifact）的标题字体已经改变，但没有记录为接受** — `--serif` 去掉了 `Noto Serif SC`（`us-journey-tracker.html:16`），四个旧视图的 `.title h1`、`.counter .n`、`.wk-head h2` 等标题会落到 Songti SC / Georgia。09-02-SUMMARY 记录了“所有者已接受外观”，但那是针对云端路径的；IN-06 在 `09-REVIEW-DISPOSITION.md` 里仍是 `open`。修复：要么在 09-VERIFICATION 里写明这是所有者接受的视觉变化，要么只在 `CLOUD` 为真时才去掉字体。
3. **新界面的按钮字号不是 14px** — UI-SPEC 的 Typography 节要求 `:is(#login,#boot,#syncbar,dialog#confirm) button{font-size:14px}`，代码里只有 `#login button`（`us-journey-tracker.html:252`）。`#syncbar` 的按钮（`知道了`、`重试`）因为 `.ghost` 写死 13px 而渲染为 13px；`#bootRetry` 的 `.primary` 和退出确认框的 `仍然退出` 没有字号，渲染为浏览器默认的约 13.33px。修复：在 `us-journey-tracker.html:252` 后加 `:is(#syncbar,#boot,dialog#confirm) button{font-size:14px}`；同时把 `:172` 的 `.bar` 外边距在启动卡片里改为 12px（见 Pillar 5）。

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

契约文案逐字核对，全部找到：

- 登录页：`请填写邮箱和密码`、`邮箱或密码不对，请检查后重试`、`连不上服务器，请检查网络后重试`、`尝试次数太多，请过几分钟再试`、`登录中…`、`登录后，记录会在你的手机和电脑之间同步`、`账号由管理员开通。忘记密码请联系管理员。`
- 对账与状态：`正在和服务器对账…`、`网络较慢，还在连…`、`连不上服务器，暂时只能查看，不能修改`、`保存失败：修改仍在本机，下次修改或重新打开时会再上传`、`保存失败：数据超过容量上限（4 MB）`、`本机空间不够，这次修改没能保存，请先别关闭页面`
- 横幅：`网络较慢，还在连…现在还不能修改。`、`连不上服务器，现在只能查看上次的内容，不能修改。`、`数据超过了云端容量上限，新修改存不上了，请联系管理员。`、`本机空间不够，没能在本机保存这次修改。上传成功之前请别关闭或刷新页面。`、`另一台设备上的修改被覆盖了，但本机空间不够，没能留底。请到另一台设备上核对被覆盖的内容。`、`保存空间快满了：已用 {pct}%（上限 4 MB）。…`
- 提示与对话框：`已更新为其他设备上的最新内容`、`另一台设备上的修改被覆盖，已在本机留底`、`已开始下载留底，本机不再保留副本`、`留底生成失败，本机副本仍然保留`、`退出登录？`、`换账号登录？`、`不退出 / 仍然退出`、`不换账号 / 仍然登录`
- 等待态：`正在加载你的数据…`、`第一次登录需要先从服务器取数据`、`连不上服务器` + `请检查网络，然后重试`

偏差与备注（不扣分）：

- INFO：UI-SPEC S6 的远端更新提示（`其他设备有新的修改，稍后会自动更新。` / `现在更新`）在代码里不存在。路线图把它定为 Phase 9 的“契约”，实现属于 Phase 10（SYNC-02），与 `coverage` 和 S2 的 `expired`/`remote` 留白一致，不计为缺陷。
- INFO：`知道了` 是泛称按钮（UI-SPEC 检查员已标 FLAG，所有者未改），保留。

### Pillar 2: Visuals (3/4)

正面证据：

- 登录页的视觉焦点唯一：`.primary` 深色实心 `登录` 按钮（`us-journey-tracker.html:253`），页面上没有 accent 色抢注意力，与 S1 一致。
- 首次登录等待卡片：accent 只用在不定进度条上，`重试` 是卡片里唯一的深色实心按钮，与 S10 一致。

问题：

- **WARNING — 冲突 toast 在手机宽度下被挤窄。** `.toast`（`us-journey-tracker.html:208`）是 `position:fixed; left:50%` 且没有 `max-width` 或 `width`。对这类绝对定位元素，收缩包裹宽度的可用宽度是 `视口宽 - left`，即 375px 下约 187px。`toast()` 在 D-08 冲突时传入 `{label:"下载留底"}` 和 8000ms（`us-journey-tracker.html:949`），文字 `另一台设备上的修改被覆盖，已在本机留底`（19 个字）加上按钮会被压进约 155px 的内容列，多行换行，且因为 `bottom` 固定在底部，可能遮住状态行。这是代码推断，需要 UAT 第 2 项在 375px 下确认。修复见优先级第 1 条。
- **WARNING — 换账号确认框的正文被误设为弱化色。** `#cf-body p:first-child{color:var(--muted)}`（`us-journey-tracker.html:225`）是为退出框里的 `当前账号：…` 行写的，但换账号框的正文只有一行，正好是 `p:first-child`，所以关键的“会被清除”警告被渲染为 `--muted`。UI-SPEC 的 S7 要求正文用 `--ink`。修复：给 `当前账号` 行加一个类名（例如 `class="cf-acct"`），把规则改为 `#cf-body .cf-acct{color:var(--muted)}`。

### Pillar 3: Color (3/4)

正面证据：

- 没有新增颜色 token，新界面只用 `--paper`、`--surface`、`--ink`、`--muted`、`--line`、`--red`、`--c-job`、`--c-lang`（`us-journey-tracker.html:10-32`）。
- 色调映射与 S2 一致：`.syncbar[data-tone="error"]` 用 `--red`，`info` 用 `--c-lang`，默认 `warn` 用 `--c-job`（`us-journey-tracker.html:265-267`）；`--c-job` 只作色条和状态点，没有作文字色。
- accent 的使用限定在契约清单里：焦点环（全局）、已同步的圆点、info 色条、等待态进度条。登录页没有 accent。
- `#snapshotBtn` 使用 `--c-job-s` 底和 `--c-job` 边、`--ink` 字（`us-journey-tracker.html:60`），与 S8 一致。

问题：

- **WARNING — 深色主题的对比度没有任何证据。** UI-SPEC 只在浅色主题下给出了对比度数字；深色主题只说“自动一致”，没有计算。代码审计无法验证渲染结果。UAT 第 1 项（深色主题下的登录页、横幅和确认框）仍是 `pending`，因此本项不能给 4 分。

### Pillar 4: Typography (3/4)

正面证据：

- 新界面的字号只有 12、14、16 和 Display（`clamp(26px,4vw,34px)`），字重只有 400 和 600（`us-journey-tracker.html:240-258`、`273-279`、`60-62`）。
- 标题：`#login h1`（600 衬线）、`#boot h2` 与 `dialog#confirm .ed-h h3`（600 衬线 16px）符合契约，没有用旧 `.title h1` 的 800。
- 旧视图的字号未改动（`.ghost` 13px 仍然保留给旧的导出、备份按钮）。

问题：

- **WARNING — 新界面按钮的字号不符合契约。** UI-SPEC 明确写着“新界面里不出现 13px”，并给出了 `:is(#login,#boot,#syncbar,dialog#confirm) button{font-size:14px}`。代码只实现了 `#login button`。结果：`#syncbar` 的 `知道了` / `重试`（`us-journey-tracker.html:269`，`.ghost` 写死 13px）、`dialog#confirm` 的 `不退出`（`.ghost`，13px）、`仍然退出`（`.danger` 无字号，浏览器默认约 13.33px）、`#bootRetry`（`.primary` 无字号）都不是 14px。修复见优先级第 3 条。
- **WARNING — 旧视图标题字体已变化，未记录为接受。** `--serif` 去掉 `"Noto Serif SC"`（`us-journey-tracker.html:16`），影响所有旧视图的衬线标题和数字（`.title h1` 第 46 行、`.counter .n` 第 49 行、`.area .v` 第 81 行、`.wk-head h2` 第 74 行、`.lift .lv` 第 187 行等）。这与 CONTEXT 的“四个视图的界面不变”有细微出入。09-02-SUMMARY 记录的“所有者已接受外观”只针对云端路径；IN-06 仍是 `open`。

### Pillar 5: Spacing (3/4)

正面证据：

- 登录页：上下留白 48px（手机）和 64px（桌面），左右 `max(20px, env(safe-area-inset-*))`，卡片内边距 24px，卡片标题与卡片间距 8+24=32px，符合 S1。
- 横幅：`margin:16px 0 0`、`padding:12px 16px`、`gap:12px`，符合 S4。
- `#login-err` 上边距 8px、`.fine` 上边距 16px、`#bootSub` 上边距 8px、`#boot .primary` 上边距 16px，均在刻度上。

问题：

- **WARNING — 启动等待卡片的进度条使用了 10px 外边距。** `.bar{...margin:10px 0 8px}`（`us-journey-tracker.html:172`）被 `#bootBar`（HTML 第 305 行）直接使用。UI-SPEC 的刻度没有 10px，且明确写着“不引入 6、10、14、18、22 这类奇数间距”。修复：`#boot .bar{margin:12px 0 8px}`。
- INFO — `#login .pw-toggle{right:6px}`（`us-journey-tracker.html:250`）是契约刻度之外的值，但它是绝对定位的小按钮内缩，视觉影响很小，可以接受。

### Pillar 6: Experience Design (3/4)

正面证据：

- 门控三层齐全：`body[data-gate]` 开关（`us-journey-tracker.html:784-799`）、`applyGate()` 在 `renderAll()` 末尾调用（`:1144`）、捕获阶段的 `gateGuard`（`:801-809`）。放行名单与 S3 一致，`#logoutBtn`、`#snapshotBtn`、`#syncbar button` 都在名单里。
- 对账状态：`reconciling` → `slow`（约 3 秒）→ `unreachable`（约 15 秒）的时间推进正确（`:855-868`）；有缓存时只读，无缓存时等待卡片显示 `连不上服务器` + `重试`，且没有 `退出登录`（A6）。
- 登录：空字段聚焦空字段；凭据错误清空密码并 `aria-invalid`；连不上保留两项；429 有单独文案；提交中 `aria-busy` 与 `readonly`（`:712-760`）。
- 初始焦点：有上次邮箱时聚焦密码框，否则聚焦邮箱（`:690-695`）。
- 退出：只有存在未保存或留底时才弹确认（D-05）；默认焦点是 `不退出`（`cfCancel` 带 `autofocus`，`us-journey-tracker.html:379`）；Esc 等同不退出；关闭后焦点回到原元素。
- 退出后 `#importJson` 的父级隐藏（A8，`:700` 一带的 `cloudInit`），云端路径不会出现会绕过对账的 `恢复`。
- 留底：文件名不含账号标识（D-11）；生成失败时保留本机副本并提示（`:944-968`）。

问题：

- **WARNING — 冲突提示的完整性还需人工确认。** 见 Pillar 2 的 toast 宽度问题。这是 E4 的 backstop，代码审计无法给出“通过”。
- **INFO — `.status button` 的样式规则不存在。** S2 允许状态行内含一个行内按钮（`立即重试`）。Phase 9 没有任何状态使用它，所以不影响本阶段；Phase 10 的 `retrying` 状态需要补上。
- **WARNING — 窄屏和深色的体验验收仍是 pending。** UAT 的四个待测项（深色主题、375px 冲突提示、375px 容量横幅、真实浏览器下载留底）都是 `pending`，本次代码审计不能替代它们。

---

## Registry Safety

Registry audit: 0 third-party blocks checked（`components.json` 不存在，UI-SPEC 的 Registry Safety 为 none）。唯一的外部代码是已批准的 PocketBase SDK，同源加载并钉 sha256，不属于 UI 组件的审查范围。

---

## Files Audited

- `us-journey-tracker.html`（CSS 第 10-40、46-70、172-281 行；HTML 第 283-380 行；JS 第 590-1090 行，以及 `toast()` 第 1366 行，`renderAll()` 第 1144 行）
- `.planning/phases/09-login-cloud-storage/09-UI-SPEC.md`（审计基线）
- `.planning/phases/09-login-cloud-storage/09-CONTEXT.md`、`09-UAT.md`、`09-REVIEW.md`、`09-REVIEW-DISPOSITION.md`、`09-02-SUMMARY.md`（已知问题与接受记录）
- 09-01 至 09-14 的 SUMMARY 文件（只搜索 UI 相关的偏差记录）
- `.planning/ui-reviews/.gitignore`（截图存放的 git 安全闸门已执行，未产生截图）
