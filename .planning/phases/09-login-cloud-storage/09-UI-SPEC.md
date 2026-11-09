---
phase: "09"
slug: login-cloud-storage
status: approved
shadcn_initialized: false
preset: none
created: "2026-11-08"
---

# Phase 9 — UI Design Contract（登录与云端存储）

> 本阶段在现有单文件应用上**只增加**新界面：登录页、状态栏的状态文案、编辑门控的视觉、横幅与提示、退出确认框、冲突留底入口、容量警告、首次登录等待态。四个视图（本周、日历、目标、时间线）的布局和操作方式不变。
> 全部文案为简体中文。代码、选择器、标识符保持英文。
> Phase 10 直接沿用“状态栏五种状态”和“远端更新提示”两节，不另做设计。
> 上游来源：09-CONTEXT.md（D-01 到 D-11 和 Claude's Discretion 已锁定，本文件不重新讨论）；ARCHITECTURE.md §Q5、§Q3（与 CONTEXT 冲突处以 CONTEXT 为准：D-03 连不上时只读、D-08 到 D-10 冲突留底）；现有 `us-journey-tracker.html` 的样式与 `toast()`、`setStatus()`、`<dialog id="editor">`。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 HTML/CSS/JS 单文件，没有 React，没有组件库，不适用 shadcn；`components.json` 不存在，已核对） |
| Preset | not applicable |
| Component library | none |
| Icon library | none（不引入图标字体和图标库；只用文字、`‹ ›` 这类现有字符和 CSS 画的小圆点） |
| Font | 标题和数字 `var(--serif)`；去掉 Google 字体 `<link>` 后，`--serif` 实际落在 `"Songti SC","STSong",Georgia,serif`；正文 `var(--sans)`（系统字体栈，不变） |

字体收尾（INFRA-03 的一部分）：把 `:root` 里 `--serif` 的值改成 `"Songti SC","STSong",Georgia,serif`（去掉 `"Noto Serif SC"`），同时删除开头三行 Google Fonts 的 `<link>`。不新增任何外部资源（无 CDN、无网络字体、无图标字体）。

全部新界面复用现有 CSS 自定义属性。**本阶段不新增任何颜色 token**，因此浅色和深色主题（`prefers-color-scheme` 和 `[data-theme]`）自动一致，不需要在两处各补一份。

---

## Spacing Scale

新界面只使用下列 4 的倍数；与现有布局里已有的 12 保持一致，不引入 6、10、14、18、22 这类奇数间距。

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 状态点与文字的间隙、行内微调 |
| sm | 8px | 紧凑元素间距（按钮之间、标签与输入框之间） |
| 12 | 12px | 组件内部间距（横幅内文字与按钮的间距、表单字段之间），沿用现有 `gap:12px` |
| md | 16px | 默认间距（横幅外边距、对话框内段落间距） |
| lg | 24px | 登录卡片内边距、对话框内边距上限 |
| xl | 32px | 登录页标题与卡片之间 |
| 2xl | 48px | 登录页上下留白（手机）、等待态卡片上下留白 |
| 3xl | 64px | 登录页上下留白（桌面） |

Exceptions:
- 登录页输入框、“登录”按钮、对话框按钮、等待态按钮在 ≤560px 时最小高度 44px（触控目标）。
- 横幅里的按钮最小高度 36px（桌面和手机相同）。
- 工具栏里的 `.ghost` 按钮（退出登录、下载留底）保持现有尺寸，不放大，避免改变现有排版。
- 对话框的 20px 内边距沿用 `dialog#editor` 现有值（新对话框与它共用规则，不单独改）。
- 继承值（命名例外，来自现有组件，新界面复用但不改，也不当作本阶段新增的间距 token）：

  | 名称 | 值 | 来自 | 用在 |
  |------|-----|------|------|
  | inherit-gap-12 | 12px | 现有 `gap:12px`；等同上表 12 | 横幅、表单字段间距 |
  | inherit-dialog-pad | 20px | `dialog#editor` 内边距 | `dialog#confirm`、登录页左右内边距 |
  | inherit-toolbar-gap | 6px | `.toolbar` 的 `gap:6px` | `退出登录`、`下载留底`、`.who` 所在的工具栏 |
  | inherit-toast | 内边距 8px 16px，按钮间隙 14px | `.toast` | 新提示复用现有 `toast()` |
  | inherit-btn-pad | `.ghost` 5px 10px、`.primary` 7px 14px、`.danger` 6px 12px | 现有按钮类 | 新按钮直接用这些类，不改内边距（仅按“最小高度”规则加高） |

---

## Typography

新界面只用下面 **4 个字号、2 个字重（400、600）**。所有覆盖都写在新界面自己的选择器里（`#login`、`#boot`、`#syncbar`、`dialog#confirm`、`#logoutBtn`、`#snapshotBtn`、`.who`、`.toast[data-cloud]`），**不改** `.ghost`、`.title h1`、`.ed-h h3`、`.toast button` 等现有全局规则，四个现有视图的字号和字重与今天完全一样。

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / 状态行 / 说明 / 工具栏新按钮（`退出登录`、`下载留底`、`.who`）/ 显示密码按钮 | 12px | 400 | 1.55 |
| Body（横幅、对话框正文、提示、表单标签、错误文字、新界面里的按钮） | 14px | 400；`.primary` 按钮和需要强调的词 600 | 1.55 |
| Input / Heading（输入框文字；对话框标题、等待态标题） | 16px | 输入框 400；标题 600（衬线 `var(--serif)`） | 输入框 1.55；标题 1.2 |
| Display（仅登录页应用名） | `clamp(26px,4vw,34px)` | 600（衬线） | 1.2 |

字号为 12、14、16 和 Display 共 4 个；字重为 400 和 600 共 2 个。新界面里**不出现** 13px、15px、19px、800、700 和浏览器默认粗体。

落到选择器（全部为新界面自己的规则）：
```css
/* 新界面容器：先把继承的 body 15px 压到 14px，再按角色逐项覆盖 */
:is(#login,#boot,dialog#confirm){font-size:14px;line-height:1.55}
:is(#login,#boot,#syncbar,dialog#confirm) button{font-size:14px}   /* 选择器 (1,0,1) 高于 .ghost (0,1,0)，所以覆盖 13px，且只在新界面内 */
#login h1{font-family:var(--serif);font-weight:600;font-size:clamp(26px,4vw,34px);line-height:1.2;margin:0}   /* 不复用 .title h1 的 800 */
#boot h2,dialog#confirm .ed-h h3{font-family:var(--serif);font-weight:600;font-size:16px;line-height:1.2;margin:0}   /* 不用 19px / 默认粗体 */
#login input{font-size:16px}    /* 桌面和手机都是 16px：一条规则，不再有手机单独的例外；同时防止 iOS 聚焦时放大 */
#logoutBtn,#snapshotBtn,.who,#login .pw-toggle{font-size:12px}   /* 现有 .ghost 是 13px；新工具栏按钮明确按 12px 渲染，与工具栏里现有 13px 按钮差 1px，可接受 */
.toast[data-cloud] button{font-weight:600}   /* toast() 传了 ms（即本阶段所有新提示）时加 data-cloud；现有 700 的按钮不动 */
```
说明：
- 工具栏里 `退出登录` 与 `下载留底` 渲染为 **12px / 400**，行内的 `.who` 也是 12px。旧的 `导出日历 CSV`、`备份`、`恢复` 仍是 13px，没有改动。
- 横幅按钮、对话框按钮、登录按钮、等待态按钮一律 14px；`.primary` 为 600，`.ghost` 和 `.danger` 没设字重，保持 400。
- 状态行里的行内按钮（`立即重试`、`重试`）12px 400，带下划线。
- 输入框文字一律 16px，对话框和等待态标题一律 16px 600 衬线；二者靠字重和字体族区分，不再用 19px。
- 衬线字体回退后，字重 600 在 Songti 里会落到粗体，视觉差别很小，这在调研阶段已被所有者接受，不再调整。
- 邮箱、错误提示等用户可见字符串一律用 `textContent` 或 `esc()` 写入，不拼进 `innerHTML`。

---

## Color

沿用现有调色板，不新增 token。60/30/10：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--paper)`（浅 `#F2F5F9` / 深 `#121826`） | 页面背景、登录页背景、输入框背景 |
| Secondary (30%) | `var(--surface)`（浅 `#FFFFFF` / 深 `#1A2234`） | 登录卡片、等待态卡片、横幅、新对话框 |
| Accent (10%) | `var(--c-lang)`（浅 `#0E7C7B` / 深 `#4FC1BF`） | 见下面 reserved 清单 |
| Destructive | `var(--red)`（浅 `#B4423A` / 深 `#E07A70`） | 仅用于：“仍然退出”按钮、登录错误文字、“连不上”和“容量超限”横幅的色条、状态点的错误态 |

Accent reserved for（新界面里只有这些地方用 accent）：
1. 键盘焦点环（现有 `:focus-visible`，不变）。
2. 状态行里“已同步”的小圆点。
3. 信息类横幅（`data-tone="info"`，如远端更新待应用）的左侧色条。
4. 等待态不定进度条的填充。

不使用 accent 的地方：“登录”按钮用现有 `.primary`（`--ink` 底），不用青色；这样与应用里其他主按钮一致。

中性提示色（警告）：`var(--c-job)`（琥珀色）。只用于色条、边框、状态点，**不用作文字颜色**（浅色主题下 `#A87000` 对 `#F2F5F9` 的对比度约 3.9:1，12–14px 文字不达标）。横幅正文一律用 `var(--ink)`。

对比度核对（正文）：`--ink` 对 `--surface`、`--paper` 两个主题都高于 12:1；`--red` 作文字对 `--paper` 约 5.1:1（浅色）；深色主题的 `--red` `#E07A70` 对 `#121826` 高于 6:1；`--muted`（状态行）对 `--paper` 浅色约 5:1。

色条与状态点的语气（tone）映射：

| tone | 变量 | 用于 |
|------|------|------|
| `ok` | `--c-lang` | 已同步 |
| `busy` | `--muted` | 保存中、正在对账 |
| `warn` | `--c-job` | 网络较慢、离线、失败重试、登录过期、容量警告、留底没存上 |
| `error` | `--red` | 连不上服务器（只读）、保存因容量超限失败 |
| `info` | `--c-lang` | 远端更新待应用、已在另一个标签页退出 |

---

## Surfaces（新界面的结构与位置）

### S1 登录页 `<section id="login">`

显示时机：云端路径下没有有效令牌时。显示时整个应用外壳（现有 `.wrap`）加 `.hidden`；不显示登录页时整个登录页加 `.hidden`。旧路径（没配 `USJ_CONFIG.backend`）永远不显示登录页，v1 的 154 条用例的界面不受影响。

布局：
- 整页：`min-height:100dvh`（不支持 `dvh` 的浏览器回退 `100vh`），背景 `--paper`，内容水平垂直居中，左右内边距 20px，上下 48px（桌面 64px），尊重 `env(safe-area-inset-*)`。
- 顶部：应用名 `<h1>在美国的日子</h1>`（Display，居中），下面一行说明 `<p>`：`登录后，记录会在你的手机和电脑之间同步`（14px，`--muted`，居中）。
- **视觉焦点**：整页只有一个深色实心块，就是卡片里的 `登录` 按钮（`.primary`，`--ink` 底，在 `--paper` 页面和 `--surface` 卡片上对比最强）；应用名 Display 是次要入口（视线先落在应用名，再沿卡片向下到 `登录`）。登录页上没有 accent 色，不与它争夺注意。
- 卡片：`.gate-card`，宽度 `min(400px,100%)`，背景 `--surface`，边框 `1px solid var(--line)`，圆角 12px，内边距 24px。与现有 `.panel` 同一族（圆角和边框一致），内边距因登录页独占一屏而用 24。
- 卡片内自上而下：
  1. 登录过期提示（仅过期时显示，见下），样式是 `.syncbar` 的 `warn` 变体放在卡片顶部。
  2. 邮箱字段：`<label>` 文字“邮箱”，下方 `<input type="email">`。
  3. 密码字段：`<label>` 文字“密码”，下方 `<input type="password">`，右侧叠一个小按钮“显示”（`class="ghost pw-toggle"`，12px）。
  4. 错误区 `<p id="login-err" role="alert">`：默认为空且不占高度（`:empty{display:none}`）。
  5. “登录”按钮：`.primary`，宽度 100%，最小高度 44px（手机），文字 14px 600（见 Typography 的 `#login button`）。
  6. 说明：`<p>` 12px `--muted` 居中：`账号由管理员开通。忘记密码请联系管理员。`
- **没有注册入口、没有“忘记密码”链接、没有“创建账号”链接。** 上面第 6 条只是纯文字，不是链接。

字段规格：

| 字段 | 属性 |
|------|------|
| 邮箱 | `type="email"` `name="email"` `autocomplete="username"` `inputmode="email"` `autocapitalize="none"` `autocorrect="off"` `spellcheck="false"` `required`；**始终预填上次成功登录的邮箱**（D-07，包括主动退出后）；没有上次邮箱时为空；不写 placeholder |
| 密码 | `type="password"` `name="password"` `autocomplete="current-password"` `required`；永远不预填 |
| 显示按钮 | `type="button"`，`aria-pressed="false"`，`aria-label="显示密码"`；点击后切换为 `type="text"`、文字“隐藏”、`aria-pressed="true"`、`aria-label="隐藏密码"`；提交成功、退出登录、页面隐藏时恢复为隐藏状态 |
| 表单 | `<form id="loginForm" novalidate>`；Enter 提交；不用浏览器自带的校验气泡（语言不受控），自己检查 |

输入框样式：复用现有 `input[type=text]` 的外观（`1px solid var(--line)`、圆角 8px、背景 `--paper`），文字 16px（桌面和手机相同），内边距 8px 12px；手机最小高度 44px。聚焦时沿用全局 `:focus-visible` 焦点环。

初始焦点：邮箱已预填时聚焦密码框；邮箱为空时聚焦邮箱框。退出登录回到登录页后同样处理。

状态与错误（全部在卡片内，**不用 toast**，因为 toast 1.8 秒就消失，错误必须留着直到用户再次提交）：

| 情形 | 判定 | 显示 |
|------|------|------|
| 提交中 | 已点登录，等待响应 | 按钮 `disabled`、`aria-busy="true"`、文字“登录中…”；输入框保持可见但 `readonly`；超过约 15 秒按“连不上”处理 |
| 有一个字段为空 | 点击时本地检查 | 错误区：`请填写邮箱和密码`；焦点移到第一个空字段 |
| 邮箱或密码不对 | 服务器返回 400（鉴权失败） | 错误区：`邮箱或密码不对，请检查后重试`；密码框清空并聚焦，`aria-invalid="true"`；邮箱保留；不说明到底是哪一项错 |
| 连不上服务器 | 网络错误、超时、5xx | 错误区：`连不上服务器，请检查网络后重试`；邮箱和密码都保留，按钮恢复可点；**与“密码不对”用不同文案，并且不清空密码框** |
| 尝试次数太多 | 429 | 错误区：`尝试次数太多，请过几分钟再试` |
| 用户再次输入或再次提交 | — | 错误区清空；`aria-invalid` 移除 |

错误文字样式：14px 400，`color:var(--red)`，上边距 8px，不带图标（避免只靠颜色传达：错误本身有文字说明）。

登录过期提示（`authRefresh` 返回 401 之后进入登录页时显示，邮箱按 D-07 照常预填）：
- 位置：卡片顶部，`.syncbar` 的 `warn` 变体（见“横幅组件”），`role="status"`。
- 文案第一行：`登录已过期，请重新登录`
- 如果本机缓存里还有未上传的修改或留底（Claude's Discretion 已定：保留），加第二行：`本机还有没上传的修改，用同一账号登录后会自动上传。`
- 没有这第二行的数字（本阶段没有“待上传数量”，那是 Phase 10 的 SYNC-03）。

另一个标签页退出登录后，本标签页回到登录页时：卡片顶部显示 `info` 变体：`已在另一个标签页退出登录`（Assumption A5）。

### S2 状态栏（两个位置，同一份状态）

状态栏由两部分组成，二者始终同步：

1. **状态行**：现有 `<p class="status" id="status">`，位置不变（页面最底部，居中，12px，`--muted`）。每个状态都在这里写一行文字；给它加 `data-state` 属性并在文字前画一个 8px 圆点（见下）。它**不是** `aria-live` 区域（避免和横幅重复朗读）。
2. **顶部横幅** `#syncbar`：需要用户注意或点按钮的状态才显示（见“横幅组件”）。位置在 `header.top` 之后、`nav.tabs` 之前，在页面最上方可见，所以手机上不用滚到底就能看到“连不上服务器”和“重试”。

状态行样式：
```css
.status[data-state]::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--tone,var(--muted));margin-right:8px}
.status[data-state="synced"]{--tone:var(--c-lang)}
.status[data-state="saving"],.status[data-state="reconciling"]{--tone:var(--muted)}
.status[data-state="offline"],.status[data-state="retrying"],.status[data-state="savefailed"],.status[data-state="slow"],.status[data-state="expired"]{--tone:var(--c-job)}
.status[data-state="unreachable"],.status[data-state="toolarge"]{--tone:var(--red)}
.status button{background:none;border:0;color:var(--ink);text-decoration:underline;padding:4px 8px;font-size:12px}
```
圆点只是辅助；含义由文字承担。状态行允许内含**一个**行内文字按钮（如“立即重试”）。旧路径（Claude 或 localStorage）的状态文案（`store.label`、“保存失败：…”）保持原样，且不加 `data-state`。

#### 状态文案总表（Phase 9 的对账状态 + Phase 10 的五种状态；Phase 10 逐字沿用）

| key（`data-state`） | 状态行文字 | 顶部横幅 | 来源 / 阶段 |
|-----|-----|-----|-----|
| `reconciling` | `正在和服务器对账…` | 不显示 | D-01，Phase 9 |
| `slow` | `网络较慢，还在连…` | 显示，`warn`，无按钮：`网络较慢，还在连…现在还不能修改。` | D-02（约 3 秒后），Phase 9 |
| `unreachable` | `连不上服务器，暂时只能查看，不能修改` | 显示，`error`，带“重试”按钮：`连不上服务器，现在只能查看上次的内容，不能修改。`（按钮：重试） | D-03（约 15 秒后），Phase 9 |
| `synced` | `已同步` | 不显示 | SYNC-04，Phase 9 起对账成功即写入，Phase 10 沿用 |
| `saving` | `保存中…` | 不显示 | SYNC-04，Phase 10 |
| `offline` | `离线，修改已存在本机，联网后自动上传`；有数量时 `离线，{n} 项修改已存在本机，联网后自动上传` | 不显示（离线时用户仍可编辑，不需要打断） | SYNC-03/04，Phase 10 |
| `retrying` | `保存失败，修改仍在本机，{s} 秒后自动重试` 并内含行内按钮 `立即重试` | 不显示 | SYNC-06，Phase 10 |
| `savefailed` | `保存失败：修改仍在本机，下次修改或重新打开时会再上传` ；本机缓存也写不进去时改为 `保存失败：本机空间不够，这次修改没能保存，请先别关闭页面`（同一 `data-state`，并配合 `cachefail` 横幅） | 不显示（Phase 9 没有自动重试，不打断用户；修改仍留在本机缓存，下次修改或重新打开时会再上传） | Phase 9 的临时状态（非容量原因的云端保存失败）；Phase 10 做 SYNC-06 自动重试时由 `retrying` 取代，不再使用 |
| `expired` | `登录已过期，请重新登录` | 显示，`warn`，带“重新登录”按钮：`登录已过期，本机的修改还在，重新登录后会继续上传。`（按钮：重新登录） | SYNC-04/ACCT-05，Phase 10（Phase 9 启动时的过期直接进登录页，见 S1） |
| `toolarge` | `保存失败：数据超过容量上限（4 MB）` | 显示，`error`：`数据超过了云端容量上限，新修改存不上了，请联系管理员。` | 本阶段容量保护 |

规则：
- `reconciling` → `slow` → `unreachable` 是时间推进：0 秒起 `reconciling`；约 3 秒仍未完成改 `slow`（状态行和横幅同时变）；约 15 秒仍未完成改 `unreachable`。秒数是大约值，规划可微调，**不得在 3 秒内判失败**（D-02）。
- 对账成功：状态行写 `已同步`（`data-state="synced"`），横幅消失，放开编辑（见 S3）。
- 点“重试”：横幅按钮变 `disabled` 并显示“正在重试…”，状态行写 `正在和服务器对账…`，重新计时（3 秒、15 秒）；成功则放开编辑；再次失败回到 `unreachable`。
- `{n}`、`{s}` 是整数；`{s}` 向上取整，最小 1。
- 同时满足多个横幅条件时只显示一条，优先级从高到低：登录过期 > 连不上 > 网络较慢 > 容量超限 > 本机缓存写不进去 > 留底没存上 > 远端更新待应用 > 容量警告。优先级低的在高的消失后再出现。

### S3 编辑门控的视觉（D-01、D-03）

**目标：** 对账期间（`reconciling`、`slow`）和只读（`unreachable`）时，所有“能改数据”的入口不可用，所有“只是看”的入口照常可用；四个视图的布局不变；实现上不给每个按钮单独打补丁，因为应用每次改动都会 `innerHTML` 全量重绘。

机制（一处入口，三层）：

1. **一个状态位**：`document.body.dataset.gate` 取值 `reconciling` / `readonly`；放开后删除该属性。旧路径永远没有这个属性，所以 v1 外观不变。
2. **一个函数 `applyGate()`**：在 `renderAll()` 的末尾调用一次，并在门控状态变化时调用。它遍历应用外壳里的 `button, input, select, textarea`，除“放行名单”外全部设 `disabled`；给带 `role="button"` 或 `tabindex="0"` 的可点击条目（`[data-edit]`、`[data-edittask]` 等）设 `aria-disabled="true"` 和 `tabindex="-1"`；把 `draggable` 设为 `false`。放开时反向恢复（`renderAll()` 重绘即可，因为重绘会生成新的、未禁用的节点，然后再按当前门控状态应用一次）。
3. **一个捕获阶段的守卫**：门控期间在 `document` 上用捕获阶段拦截 `click`、`keydown`（Enter、Space）、`dragstart`、`drop`、`change`、`input`，对不在放行名单里的目标直接 `stopImmediatePropagation()` 和 `preventDefault()`。这是安全网，覆盖没有 `disabled` 属性的元素。另外 `openEditor()`、`openTaskEditor()` 在门控期间直接返回。

**放行名单（门控期间仍然可用）**，用一个常量选择器表示，不逐个按钮写：
- 视图切换：`nav.tabs [data-tab]`
- 周和月翻页：`#wkPrev, #wkNow, #wkNext, #prev, #todayBtn, #next`
- 时间线筛选：`.filters button`
- 选中某一天（只改选中态，不改数据）：本周的 `.day`、日历的 `.cell`
- 新增的 `#syncbar` 里的按钮、`#logoutBtn`、`#snapshotBtn`（下载留底）、登录页和等待态卡片里的全部控件

**被禁用的入口**（凡不在放行名单里的都禁用，包括但不限于）：记录输入框和类别按钮、预设标签（含添加、隐藏、编辑）、记录条目的编辑和删除、编辑弹窗入口、任务勾选、任务截止日期、自定义任务输入、拖拽、本周复盘文本框、力量值输入和保存、抵达日期输入、`恢复`（导入文件）按钮。

**禁用后的外观**（只写一套 CSS，限定在 `body[data-gate]` 下，所以不影响旧路径）：
```css
body[data-gate] :is(button,input,select,textarea):disabled{opacity:.55;cursor:not-allowed}
body[data-gate] .ghost[aria-disabled="true"]{opacity:.55;cursor:not-allowed}   /* 恢复 这个 label */
body[data-gate] [aria-disabled="true"]{cursor:default}
body[data-gate] .ent[aria-disabled="true"]:hover,
body[data-gate] .editable[aria-disabled="true"]:hover{filter:none;box-shadow:none}
```
- **内容本身不变淡**：记录条目、任务文字、统计数字保持完全清晰可读（用户正是要“先看上次的内容”）；只有输入框和按钮变淡到 55%，并且鼠标指针变成禁止样。
- 不加遮罩、不加锁图标、不改布局高度。
- 已有的 `.primary:disabled{opacity:.4}` 因选择器更具体，仍然生效，不被覆盖。
- 说明“为什么不能点”的文字不放在每个控件旁边，而放在顶部横幅（≥3 秒后）和状态行（立刻）。0–3 秒的对账通常很快，不为它多弹一个横幅，避免闪烁。

放开时：删除 `data-gate`，重新 `renderAll()`；焦点不强制移动。

### S4 横幅组件 `#syncbar`

一个常驻在 DOM 里的 `<div id="syncbar" class="syncbar hidden" role="status">`（先存在、再改内容，屏幕阅读器才会朗读），同一时刻只显示一条（优先级见 S2）。登录页卡片里的过期提示复用同一个 `.syncbar` 样式。

```css
.syncbar{--tone:var(--c-job);display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0 0;padding:12px 16px;
  background:var(--surface);color:var(--ink);font-size:14px;line-height:1.55;
  border:1px solid var(--line);border-left:4px solid var(--tone);border-radius:10px}
.syncbar[data-tone="error"]{--tone:var(--red)}
.syncbar[data-tone="info"]{--tone:var(--c-lang)}
.syncbar .sb-msg{flex:1 1 220px;min-width:0;word-break:break-word}
.syncbar button{min-height:36px;padding:4px 12px}   /* 沿用 .ghost 外观；主要动作（重试、重新登录）用 .primary */
```
- 文字在左，最多 1 到 2 个按钮在右；窄屏上按钮折到下一行，不挤压文字。
- 按钮：主要动作（`重试`、`重新登录`、`现在更新`）用 `.primary`；次要动作（`知道了`）用 `.ghost`。
- 无“关闭”叉号：能自己消失的状态（连上了、对账完成）自动消失；需要用户确认的（容量警告、留底没存上）带 `知道了`。
- 外边距与 `nav.tabs` 现有的上边距 20px 叠加，不改 `nav.tabs`。

横幅文案总表（本阶段会用到的全部横幅）：

| 横幅 | tone | 文案 | 按钮 |
|------|------|------|------|
| 网络较慢 | warn | `网络较慢，还在连…现在还不能修改。` | 无 |
| 连不上（只读） | error | `连不上服务器，现在只能查看上次的内容，不能修改。` | `重试`（`.primary`） |
| 登录过期（Phase 10 在应用内用） | warn | `登录已过期，本机的修改还在，重新登录后会继续上传。` | `重新登录`（`.primary`） |
| 容量超限 | error | `数据超过了云端容量上限，新修改存不上了，请联系管理员。` | 无（持续显示，直到容量降下来） |
| 本机缓存写不进去（`cachefail`，代码审查 WR-05 补充） | warn | `本机空间不够，没能在本机保存这次修改。上传成功之前请别关闭或刷新页面。` | `知道了`（`.ghost`）；下一次本机缓存写入成功时自动消失 |
| 留底没存上 | warn | `另一台设备上的修改被覆盖了，但本机空间不够，没能留底。请到另一台设备上核对被覆盖的内容。` | `知道了`（`.ghost`） |
| 远端更新待应用（Phase 10） | info | `其他设备有新的修改，稍后会自动更新。` | `现在更新`（`.primary`） |
| 容量警告（70%） | warn | `保存空间快满了：已用 {pct}%（上限 4 MB）。超过上限后新修改就存不上了，请联系管理员。` | `知道了`（`.ghost`） |

### S5 提示（toast）

沿用现有 `toast(m, act)`：屏幕底部居中、深色底、`aria-live="polite"`。唯一的改动是给 `toast` 加第三个可选参数 `ms`（显示时长，毫秒）：没传时保持现有值（无按钮 1800、有按钮 5000），v1 行为不变；传了 `ms`（即本阶段所有新提示）时，给 toast 元素加 `data-cloud`，用来把按钮字重限定为 600（见 Typography）。toast 文字沿用现有 14px。

| 提示 | 文案 | 按钮 | 时长 | 触发 |
|------|------|------|------|------|
| D-04 内容被更新 | `已更新为其他设备上的最新内容` | 无 | 4000 | 对账后用服务器版本替换了本机缓存，且两者确实不同。没有缓存（第一次在这台设备登录）或两者相同时不弹 |
| 远端更新已应用（Phase 10 沿用，文案逐字相同） | `已更新为其他设备上的最新内容` | 无 | 4000 | Phase 10 把挂起的远端更新应用之后 |
| D-08 冲突 | `另一台设备上的修改被覆盖，已在本机留底` | `下载留底` | 8000 | 真冲突，按最后保存的为准上传本机版本时 |
| 下载留底之后 | `已开始下载留底，本机不再保留副本` | 无 | 3000 | 点了 toast 里的 `下载留底` 或工具栏的 `下载留底` |
| 留底下载失败（点击后生成文件出错） | `留底生成失败，本机副本仍然保留` | 无 | 4000 | Blob 生成或点击下载抛错时，此时不删除留底 |

规则：
- 现有 toast 是单槽的，后来的提示替换先来的。冲突提示有 `下载留底` 按钮，如果 8 秒内被别的提示替换，用户仍可从常驻的“下载留底”入口取到，所以不做队列。
- D-04 和 D-08 不会同时出现（前者是服务器版本替换了缓存，后者是本机版本覆盖了服务器），不需要互斥逻辑。
- 带按钮的 toast 必须保持 `pointer-events:auto`（现有 `.toast.act` 已处理）。

### S6 远端更新提示（Phase 10 沿用的契约）

Roadmap 要求本阶段定好文案和位置。契约：
- **挂起时**（B 正在写草稿、编辑弹窗打开或焦点在输入框）：顶部横幅 `#syncbar`，`info` 变体，文案 `其他设备有新的修改，稍后会自动更新。`，右侧按钮 `现在更新`。位置在页面顶部，不挡住正在输入的区域，不打断焦点。
- **应用时**：横幅消失，弹 toast `已更新为其他设备上的最新内容`（4000 毫秒）。
- 草稿、编辑弹窗里的文字和光标位置不因提示出现而变化（这是 Phase 10 的行为要求，视觉上提示不使用模态框、不抢焦点、不移动页面内容的垂直位置超过横幅自身高度）。

### S7 退出登录

**入口位置**：现有 `.toolbar`（在 `nav.tabs` 末尾、`margin-left:auto`、已有 导出日历 CSV / 备份 / 恢复 的那一栏）的**最右端**，一个 `.ghost` 按钮 `退出登录`（`id="logoutBtn"`，按 12px / 400 渲染，见 Typography；其余尺寸和内边距保持 `.ghost` 现有值）。不放在标题区，不占用视图空间，手机上随工具栏换到下一行。

工具栏顺序（从左到右）：`下载留底`（仅有留底时）→ 现有的 `导出日历 CSV`、`备份`、`恢复`（这三个云端路径本阶段都不显示，原因见 Assumptions A8）→ 当前账号提示 → `退出登录`。

当前账号提示：在 `退出登录` 左边，一个 `<span class="who">`，12px 400，`--muted`，显示当前邮箱，`max-width:160px`，`overflow:hidden;text-overflow:ellipsis;white-space:nowrap`，`title` 属性放完整邮箱。≤560px 时隐藏（`display:none`），手机上账号信息只在退出确认框里显示。理由：3 个人共用设备时需要知道当前是谁，桌面有空间；手机空间紧，不加。

按钮按下后：
- 没有“未保存的修改”也没有“未下载的留底”：直接退出，不弹确认（D-05）。
- 否则弹退出确认框（见下）。
- 退出过程中（先退订、再清缓存、最后清令牌）按钮 `disabled`，文字“正在退出…”；完成后回到登录页，焦点到密码框（邮箱已预填）。
- 退出按钮在对账中、连不上（只读）时仍然可用，不被门控禁用。

**退出确认框**：新的 `<dialog id="confirm" role="alertdialog" aria-labelledby="cf-title" aria-describedby="cf-body">`，与 `dialog#editor` 共用同一套样式（把 CSS 选择器写成 `dialog#editor, dialog#confirm`，包括 ≤560px 的底部抽屉样式、`::backdrop`、圆角、边框），`showModal()` 打开，Esc 等同 `不退出`。不用原生 `confirm()`，因为它不能把按钮改成“仍然退出”，也不能分行写清楚会丢什么。

结构（内容用 `textContent` 写入）：
```
[标题]   退出登录？                                  <- .ed-h h3#cf-title
[正文]   当前账号：{email}                           <- 14px --muted
         有修改还没保存到服务器，退出后会丢失。       <- 仅有未保存修改时
         有一份另一台设备的旧版本留底还没下载，退出后会丢失。   <- 仅有留底时
[按钮]   （空白撑开）  不退出   仍然退出              <- .ed-foot
```
- 正文中的两行是**条件行**，哪一样存在就显示哪一样，两样都有就两行都显示，让用户知道丢什么。
- “没保存的修改”指防抖中、保存中或保存失败的修改（D-05）。
- `不退出`：`.ghost`，**默认焦点**（`autofocus`），防止误按 Enter 就丢数据；点它只关闭对话框，留在应用里。按钮文字写明用户选的是“不退出”，而不是泛称的“取消”。
- `仍然退出`：现有 `.danger` 样式（红色文字、描边），在 `不退出` 右侧。
- 手机（≤560px）：底部抽屉，两个按钮各占一半宽，最小高度 44px。
- 确认后按 D-06：先退订实时，再清该账号在本机的记录缓存、计划缓存和冲突留底，最后清令牌，回到登录页。**邮箱保留并预填**（D-07）。

**换账号登录确认框**（Claude's Discretion 已定：登录过期后用另一个账号登录，而前一个账号还有未上传的修改或留底时）：同一个 `dialog#confirm`，在凭据验证通过之后、清除前一个账号数据之前弹出：
```
[标题]   换账号登录？
[正文]   这台设备上还有 {上一个账号邮箱} 没上传的修改、没下载的留底，换账号登录后会被清除。
[按钮]   不换账号   仍然登录
```
- 正文里“没上传的修改”和“没下载的留底”也是条件词，按实际存在的写（只有一样就只写一样）。
- `不换账号`：丢弃刚拿到的令牌，留在登录页，保留输入的邮箱，清空密码；Esc 等同 `不换账号`；它是该对话框的默认焦点（`autofocus`）。
- `仍然登录`：用 `.danger` 样式。
- 同一账号重新登录（用户 id 相同）不弹这个框，直接对账并上传。

### S8 冲突留底（D-08 到 D-11）

两处告知：
1. **当下**：toast（S5），文案 `另一台设备上的修改被覆盖，已在本机留底`，按钮 `下载留底`，8 秒。
2. **常驻入口**：工具栏里的 `下载留底`（`id="snapshotBtn"`），`.ghost` 外观加提示色：
   ```css
   #snapshotBtn{color:var(--ink);background:var(--c-job-s);border-color:var(--c-job)}   /* 字号 12px、字重 400，见 Typography */
   ```
   文字用 `--ink`（不用 `--c-job`，对比度不够），底和边框用警告色，让它在一排灰色 `.ghost` 里可见但不刺眼。
   - 位置：工具栏最左，紧挨“导出日历 CSV / 备份”那一栏（D-08 的建议）。
   - 只在存在留底时显示（`.hidden` 切换），点击或点 toast 里的 `下载留底` 都会触发同一个函数。
   - 属性：`aria-label="下载留底：另一台设备上的旧版本，下载后会从本机删除"`，`title` 同文。
   - 在门控期间仍可点（放行名单）。
   - 不显示留底时间、大小或次数（只有 1 份，D-09）。
3. **下载行为**：点击后生成 JSON 文件（Blob + `<a download>`，云端没有 Claude 的 `downloads`），**立即**从本机删除留底，按钮随之消失（D-10）；弹 toast `已开始下载留底，本机不再保留副本`。
4. **文件名**：不含邮箱和任何账号标识（D-11）：`在美国的日子-留底-YYYY-MM-DD.json`（`state` 文档）；`plan` 文档的留底用 `在美国的日子-计划留底-YYYY-MM-DD.json`。日期是下载当天的本地日期，与现有备份文件名一致。
5. **文件内容**：`state` 用与现有“备份”相同的整份 state 形状，Phase 11 的导入可以恢复它（D-11）。
6. **存不下留底**（localStorage 配额不够等）：不能悄悄失败，显示 `留底没存上` 横幅（S4），并且不弹“已在本机留底”的 toast（那是假话）。

### S9 容量警告（roadmap 必修项）

- 触发：保存前计算文档序列化后的字节数，达到上限（4 MiB = 4,194,304 字节）的 70%（约 2,936,013 字节）或以上。
- 显示：`#syncbar`，`warn`，文案 `保存空间快满了：已用 {pct}%（上限 4 MB）。超过上限后新修改就存不上了，请联系管理员。`，按钮 `知道了`（`.ghost`）。`{pct}` 为向下取整的整数，如 `72`。
- 点“知道了”：本次页面打开期间不再显示；刷新后若仍超过 70% 再显示。
- 超过 100%：保存失败，状态行 `保存失败：数据超过容量上限（4 MB）`（`data-state="toolarge"`），横幅换成 `error` 变体，文案见 S4，不可关闭；数据仍保存在本机缓存里，不丢。
- 不阻止用户继续查看和编辑。
- 单位对用户写“MB”，不写“MiB”，避免术语。

### S10 首次登录 / 没有缓存的等待态

显示时机（D-01）：这台设备第一次登录，或退出后重新登录，本机没有该账号的缓存，因此没有内容可显示。应用外壳 `.wrap` 保持 `.hidden`，显示 `#boot`，与登录页同一版式（居中、`.gate-card`）。**不渲染空的四个视图。**

结构：
- **视觉焦点**：加载中是不定进度条（整张卡片上唯一用 accent 色的元素）；连不上时是 `重试` 按钮（`.primary`，卡片里唯一的深色实心块）。标题 `<h2>`（Heading 16px 600 衬线）是文字入口。
- 标题（Heading 16px 600 衬线）：`正在加载你的数据…`
- 副文字（14px 400 `--muted`）：`第一次登录需要先从服务器取数据`
- 不定进度条：现有 `.bar` 的外观，4px 高，里面的 `i` 用 `--c-lang`，宽 40%，从左向右循环平移；`prefers-reduced-motion:reduce` 时不动，固定显示 40% 宽。
- 约 3 秒仍未完成：标题改 `网络较慢，还在连…`（副文字保留）。
- 约 15 秒仍未完成（D-03，没有缓存）：标题改 `连不上服务器`，副文字改 `请检查网络，然后重试`，进度条隐藏，只显示 `重试`（`.primary`）一个按钮。**不放 `退出登录`**（D-03：没有缓存时只显示连不上和重试；服务器连不上时退出也无法换成另一次成功的登录，按钮没有用处）。没有任何账号内容。
- 对账成功：`#boot` 隐藏，`.wrap` 显示并渲染四个视图，状态行 `已同步`；因为没有缓存，不弹 D-04 的 toast。
- 无障碍：标题所在容器 `role="status"`，文案变化会被朗读。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA（登录页） | `登录`（提交中 `登录中…`） |
| Empty state（本阶段） | 登录后的各视图空状态沿用现有文案，本阶段不改；没有缓存时的等待态：标题 `正在加载你的数据…`，副文字 `第一次登录需要先从服务器取数据` |
| Error: 凭据不对 | `邮箱或密码不对，请检查后重试` |
| Error: 连不上服务器（登录页） | `连不上服务器，请检查网络后重试` |
| Error: 连不上服务器（应用内，只读） | 状态行 `连不上服务器，暂时只能查看，不能修改`；横幅 `连不上服务器，现在只能查看上次的内容，不能修改。` + 按钮 `重试` |
| Error: 表单未填 | `请填写邮箱和密码` |
| Error: 尝试过多 | `尝试次数太多，请过几分钟再试` |
| Notice: 登录过期（登录页） | `登录已过期，请重新登录`；若有未上传内容再加 `本机还有没上传的修改，用同一账号登录后会自动上传。` |
| Notice: 内容被更新（D-04） | toast `已更新为其他设备上的最新内容` |
| Notice: 冲突（D-08） | toast `另一台设备上的修改被覆盖，已在本机留底` + `下载留底` |
| Notice: 留底没存上 | 横幅 `另一台设备上的修改被覆盖了，但本机空间不够，没能留底。请到另一台设备上核对被覆盖的内容。` + `知道了` |
| Notice: 容量警告 | `保存空间快满了：已用 {pct}%（上限 4 MB）。超过上限后新修改就存不上了，请联系管理员。` |
| Destructive confirmation: 退出登录 | 标题 `退出登录？`；条件行 `有修改还没保存到服务器，退出后会丢失。` / `有一份另一台设备的旧版本留底还没下载，退出后会丢失。`；按钮 `不退出` / `仍然退出` |
| Destructive confirmation: 换账号登录 | 标题 `换账号登录？`；正文 `这台设备上还有 {上一个账号邮箱} 没上传的修改、没下载的留底，换账号登录后会被清除。`；按钮 `不换账号` / `仍然登录` |
| 工具栏按钮 | `退出登录`、`下载留底` |
| 登录页说明 | 副标题 `登录后，记录会在你的手机和电脑之间同步`；页脚 `账号由管理员开通。忘记密码请联系管理员。` |

文案原则：
- 用“你/本机/其他设备”，不用技术词（令牌、同步冲突、缓存）。
- 每条错误都说清“发生了什么”，并在能自救时说“怎么办”。
- 不出现真实邮箱、域名、IP 或具体人名；`联系管理员` 是泛称，不写联系方式。文档和测试里的示例邮箱只用 `example.com`（如 `alice@example.com`）。

---

## UI Considerations

> 由 ui-phase 第 9.5 步的状态覆盖检查生成（10 个元素，按元素类型筛出 36 项；元素类型已人工校正，去掉了分类器误判的“列表”“表单”）。空状态和错误状态的**文案**在上面的 Copywriting Contract，这里只交代状态覆盖并引用那些文案。所有者 2026-11-08 确认按此写入。

Applicable state considerations resolved: 30 covered, 1 backstop, 0 unresolved（另有 5 项不适用，理由见表后）

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E1 登录表单 | ✅ covered | 有上次邮箱时预填并聚焦密码框，没有时邮箱为空并聚焦邮箱框；任一项为空点登录时显示 `请填写邮箱和密码`，焦点移到第一个空字段（S1） |
| loading | E1 登录表单 | ✅ covered | 提交中按钮 `disabled`、`aria-busy="true"`、文字 `登录中…`，输入框 `readonly`；约 15 秒无响应按“连不上服务器”处理（S1、A12） |
| error | E1 登录表单 | ✅ covered | 凭据不对、连不上、尝试过多各用 Copywriting 里的独立文案，显示在卡片内错误区；凭据不对清空并聚焦密码框，连不上保留两项输入；错误一直保留到再次输入或提交（S1） |
| partial | E1 登录表单 | ✅ covered | 只填了一项时按空字段处理：显示 `请填写邮箱和密码`，焦点到没填的那一项（S1） |
| long-text | E1 登录表单 | ✅ covered | 很长的邮箱在输入框内水平滚动，不撑宽卡片（卡片宽 `min(400px,100%)`）；错误文字在卡片内换行 |
| loading | E2 状态栏与横幅 | ✅ covered | 对账开始即写状态行 `正在和服务器对账…`（`data-state="reconciling"`），0–3 秒不显示横幅；约 3 秒后状态行和横幅同时变为“网络较慢”（S2） |
| error | E2 状态栏与横幅 | ✅ covered | 约 15 秒仍未完成时横幅为 `error` 语气并带 `重试`；点重试后按钮 `disabled` 并显示 `正在重试…`，重新计时，再失败回到连不上（S2） |
| overflow | E2 状态栏与横幅 | ✅ covered | 同一时刻只显示一条横幅，按 S2 的固定优先级；低优先级的在高优先级消失后再出现；窄屏时按钮折到下一行（S2、S4） |
| long-text | E2 状态栏与横幅 | ✅ covered | 横幅正文 `.sb-msg` 为 `flex:1 1 220px`、`word-break:break-word`，不挤压按钮；状态行居中、允许换行（S4） |
| loading | E3 编辑门控 | ✅ covered | 对账中（`body[data-gate="reconciling"]`）所有改数据的控件 `disabled` 并变淡到 55%，内容文字保持清晰；查看类控件（放行名单）照常可用（S3） |
| error | E3 编辑门控 | ✅ covered | 连不上时门控转为 `readonly`，外观与对账中相同，原因由顶部横幅说明；重试成功后删除 `data-gate` 并重绘，放开编辑（S3） |
| error | E4 提示 | ✅ covered | 生成留底文件出错时弹 `留底生成失败，本机副本仍然保留`，留底不删除、`下载留底` 按钮保留（S5、S8） |
| long-text | E4 提示 | 🧪 backstop | 最长的提示（冲突提示加 `下载留底` 按钮）在 375px 宽度下完整显示、可换行、按钮可点；验收时在手机宽度截图核对 |
| loading | E5 退出登录 | ✅ covered | 退出过程中（退订、清缓存、清令牌）按钮 `disabled`、文字 `正在退出…`，完成后回到登录页，焦点在密码框（S7） |
| error | E5 退出登录 | ✅ covered | 退订失败（比如断网）不阻止退出：照样清掉该账号的本机缓存、留底和令牌，回到登录页（所有者确认的补充做法） |
| overflow | E5 退出登录 | ✅ covered | ≤560px 时确认框为底部抽屉，`不退出` 和 `仍然退出` 各占一半宽、最小高度 44px（S7） |
| long-text | E5 退出登录 | ✅ covered | 确认框里的邮箱 `word-break:break-word`，不撑破对话框宽度 |
| loading | E6 换账号确认 | ✅ covered | 在凭据验证通过之后、清除前一个账号数据之前弹出；弹出期间登录按钮保持 `登录中…`，用户选择后才继续（S7） |
| overflow | E6 换账号确认 | ✅ covered | 与退出确认框共用 `dialog#confirm` 的底部抽屉样式，两个按钮各占一半宽（S7） |
| long-text | E6 换账号确认 | ✅ covered | 正文里上一个账号的邮箱 `word-break:break-word` |
| error | E7 下载留底按钮 | ✅ covered | Blob 生成或触发下载抛错时不删除留底，按钮保留，弹 `留底生成失败，本机副本仍然保留`（S8） |
| long-text | E7 下载留底按钮 | ✅ covered | 按钮文字固定为 `下载留底`；工具栏按 `nav.tabs` 现有规则换行（S7、S8） |
| loading | E8 首次登录等待卡片 | ✅ covered | 不定进度条循环平移；约 3 秒标题改 `网络较慢，还在连…`；`prefers-reduced-motion` 下进度条静止（`#boot .bar i`）（S10） |
| error | E8 首次登录等待卡片 | ✅ covered | 约 15 秒仍未完成：标题 `连不上服务器`、副文字 `请检查网络，然后重试`、进度条隐藏，只显示 `重试`（D-03，S10） |
| overflow | E8 首次登录等待卡片 | ✅ covered | 卡片宽 `min(400px,100%)`，水平垂直居中，窄屏单列，尊重安全区（S1、S10） |
| long-text | E8 首次登录等待卡片 | ✅ covered | 标题和副文字都是固定短句，在卡片内换行 |
| overflow | E9 工具栏当前账号邮箱 | ✅ covered | `.who` 最大宽 160px，单行省略，`title` 放完整邮箱；≤560px 隐藏（S7） |
| long-text | E9 工具栏当前账号邮箱 | ✅ covered | 同上：长邮箱只显示开头加省略号，悬停看完整邮箱 |
| error | E10 容量警告 | ✅ covered | 超过 100% 时保存失败，状态行 `data-state="toolarge"`，横幅换成不可关闭的 `error` 变体，数据仍留在本机缓存（S9） |
| overflow | E10 容量警告 | ✅ covered | 横幅按钮在窄屏折到下一行，不挤压文字（S4） |
| long-text | E10 容量警告 | ✅ covered | `{pct}` 是不超过 3 位的整数，文案固定；`.sb-msg` 自动换行 |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

不适用（已排除，附理由）：
- E3 编辑门控 · long-text：门控不新增文字，只改变现有控件是否可用；说明文字在横幅里，已由 E2 覆盖。
- E4 提示 · loading：提示是事件发生后的一次性消息，没有“加载中”。
- E6 换账号确认 · error：对话框本身没有异步操作；之后的登录和对账出错由 E1、E2 覆盖。
- E7 下载留底按钮 · loading：文件在本机同步生成，没有“加载中”。
- E10 容量警告 · loading：字节数在保存前同步计算，没有“加载中”。

补充（不属于上面的状态分类）：全部新界面只用已有 token，深色主题自动一致；验收时用 `colorScheme:'dark'` 打开登录页、横幅和确认框各看一眼。

---

## 无障碍与动效

- **焦点**：登录成功后焦点留在页面（不强制移动）；退出后到登录页密码框；登录失败聚焦密码框；对话框打开时默认焦点在非破坏性按钮（退出确认框是 `不退出`，换账号确认框是 `不换账号`）；关闭后焦点回到触发它的按钮。全部沿用全局 `:focus-visible` 焦点环（2px，`--c-lang`），不另做样式。
- **屏幕阅读器**：`#login-err` 为 `role="alert"`；`#syncbar` 和 `#boot` 标题容器为 `role="status"`；现有 toast 保持 `aria-live="polite"`；状态行不是 live 区域（避免和横幅重复）。
- **标签**：登录页每个字段有可见的 `<label>`，不依赖 placeholder；错误通过 `aria-describedby` 关联到字段。
- **键盘**：登录页 Tab 顺序为 邮箱 → 密码 → 显示 → 登录；Enter 提交；Esc 关闭对话框（等同 `不退出` / `不换账号`）。门控期间被禁用的控件移出 Tab 顺序（`disabled` 或 `tabindex="-1"`），放行名单里的控件保持可聚焦。
- **动效**：本阶段新增的动画只有等待态的不定进度条；`prefers-reduced-motion:reduce` 时静止（现有 `*{transition:none !important}` 已覆盖过渡，动画需单独写一条 `@media (prefers-reduced-motion:reduce){#boot .bar i{animation:none}}`）。其余新界面没有动画。
- **触控**：登录页控件和对话框按钮 ≤560px 时最小高度 44px；横幅按钮 36px（见 Spacing 例外）。
- **窄屏**：登录页单列；退出确认框 ≤560px 为底部抽屉（与编辑弹窗一致）；工具栏换行；横幅按钮折行。断点沿用现有 900 / 820 / 720 / 560，不新增断点。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none（没有 shadcn，Tool: none） | not required |
| 第三方 registry | none | not applicable |

唯一的外部代码是已批准的 PocketBase SDK 0.28.1 `pocketbase.iife.js`：同源加载，sha256 钉死（06-CONTEXT D-15，Phase 8 已提供 `/vendor/pocketbase.iife.js`）。它不是 UI 组件，不属于这一节的审查范围。

---

## Assumptions (Claude's choice)

没有渠道向用户提问；下列是 09-CONTEXT.md 没有规定、按“与现有应用和已锁定决定最一致”选的做法。规划或评审时若所有者有不同意见，改这里即可。

| # | 选择 | 理由 |
|---|------|------|
| A1 | 状态栏拆成“底部状态行 + 顶部横幅”两处，横幅只在需要注意或点按钮时出现，状态行始终同步写同样的文字 | 现有 `#status` 在页面最底部，手机上滚不到；D-03 要求有“重试”按钮，必须放在一眼能看见的位置。不移动、不改造现有状态行，只加一条横幅 |
| A2 | 对账前 3 秒不显示横幅，只让输入框变淡并写状态行 | 通常对账很快，避免横幅一闪而过 |
| A3 | 登录错误用卡片内的错误区，不用 toast（ARCHITECTURE §Q5 写的是 toast） | toast 1.8 秒就消失，用户可能没看清；CONTEXT 只要求文案区分，没有指定形式 |
| A4 | 登录页加“显示/隐藏密码”按钮 | 手机上输入密码容易出错 |
| A5 | 另一个标签页退出登录时，本标签页的登录页显示 `已在另一个标签页退出登录` | 否则用户看到莫名其妙回到登录页 |
| A6 | 没有缓存且连不上服务器时，等待态只放 `重试`，不放 `退出登录`（编排者已决定，不再讨论） | D-03 原文是“没有缓存时，只显示连不上和重试”；服务器连不上时退出登录也换不到另一次成功的登录，这个按钮没有用处。用户想换账号，可以在服务器恢复后进到应用里再退出 |
| A7 | 退出确认框和换账号确认框用新的 `dialog#confirm`，不用原生 `confirm()` | 原生框不能把按钮写成“仍然退出”，也不能分行说明会丢什么；样式与 `dialog#editor` 共用，没有新视觉语言 |
| A8 | 云端路径本阶段 `导出日历 CSV`、`备份` 和 `恢复`（导入）都保持隐藏；`下载留底` 是唯一新增的下载入口 | 前两个依赖 Claude 的 `downloads`（CONTEXT 的 Established Patterns 已说明）；`恢复` 会整份替换并立即上传，绕过对账和冲突留底，N3（导入 `{}` 清空数据）也还没修。完整的导出导入在 Phase 11 做，避免本阶段重复 |
| A9 | 当前账号邮箱只在桌面工具栏和确认框里显示，手机上隐藏 | 共用设备时需要知道是谁；手机空间紧 |
| A10 | `toast()` 增加可选的第三个参数 `ms`，不改变已有调用的行为 | D-04 的句子较长，1.8 秒读不完；冲突提示要留得久一点 |
| A11 | 容量警告“知道了”只在本次页面打开期间有效，刷新后超过 70% 仍会再提示 | 避免永久忽略一个会导致无法保存的问题，又不至于每次保存都弹 |
| A12 | 登录请求约 15 秒无响应按“连不上服务器”处理，与 D-02 的数值对齐 | 与对账超时一致，用户只需记一个数 |
| A13 | 留底存不下时显示横幅，不弹成功样子的 toast | “不能悄悄失败”（Claude's Discretion）；横幅需要用户点“知道了”才消失，避免错过 |
| A14 | 在 429（尝试次数太多）时给单独文案 | PocketBase 有内置限流，登录接口阈值被调严（ARCHITECTURE §Q6） |

---

## Checker Sign-Off

第 1 轮检查（2026-11-08）有 3 项阻塞：确认框按钮用了泛称的“取消”、新界面字号和字重超出上限、没有缓存且连不上时多放了“退出登录”（与 D-03 冲突）。修改 1 轮后第 2 轮检查通过；第 2 轮的建议里，减少动画的选择器、红色用途清单、“留底没存上”的下一步和云端隐藏“恢复”这 4 条已顺手改掉（A8）。

- [x] Dimension 1 Copywriting: FLAG（“知道了”偏泛称、“登录”是单个动词，均不阻塞）
- [x] Dimension 2 Visuals: FLAG（进度条关键帧没有写出，不阻塞；减少动画选择器已修正）
- [x] Dimension 3 Color: FLAG（红色用途清单已补“容量超限”）
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS（Tool: none，无组件清单，不适用）

**Approval:** approved 2026-11-08
