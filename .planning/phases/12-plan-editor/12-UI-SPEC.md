---
phase: "12"
slug: plan-editor
status: approved
shadcn_initialized: false
preset: none
created: "2026-11-11"
---

# Phase 12 — UI Design Contract（编辑计划页）

> 本阶段在现有单文件应用上**只增加**：`#plan` 编辑页、目标页的「编辑计划」入口、目标页底部的「已归档」区、空计划状态，以及目标页、日历日面板、时间线、日历 CSV 里组标签的新写法（P 编号自动生成）。本周、日历、时间线三个视图的布局和操作方式不变；目标页的组、任务、力量项在没有归档、没有删光的情况下外观与今天一致。
> 全部文案为简体中文。代码、选择器、标识符保持英文。示例名称一律是通用占位（「示例目标组」「示例任务」），不出现真实计划文字。
> 上游来源：12-CONTEXT.md（D-01 到 D-17 已锁定，本文件不重新讨论；Claude's Discretion 各项在本文件定稿，见文末 Assumptions）；09-UI-SPEC.md（令牌、状态栏 S2、横幅 S4、`dialog#confirm`、toast 的约定，本阶段原样沿用）；11-UI-REVIEW.md（要避开的问题：键盘够不到的控件、375px 下的宽 toast、门控行为、奇数间距、警告色当底色、对话框在窄屏没有高度上限）；FEATURES.md §编辑计划页；现有 `us-journey-tracker.html` 的样式与渲染函数。
> 范围提醒：只做云端版；本地版（不登录）没有入口，打开 `#plan` 时回到目标页（D-13）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 HTML/CSS/JS 单文件，没有 React，没有组件库；`components.json` 不存在，已核对）。shadcn gate：不适用，技术栈不是 React/Next.js/Vite |
| Preset | not applicable |
| Component library | none |
| Icon library | none（不引入图标字体和图标库；只用文字按钮和 `▸ ▾` 这类系统字符画折叠指示） |
| Font | 标题和数字 `var(--serif)`，正文 `var(--sans)`（与现有一致，不新增字体，不加载任何外部资源） |

复用现有组件，不新建设计语言：`.panel`、`.ghost`、`.primary`、`.danger`、`.seg`（类别按钮）、`.syncbar`（横幅外观）、`.empty`、`.k-lang/.k-pro/.k-fit/.k-job/.k-oth`（类别色变量 `--c`/`--s`）、`<dialog id="confirm">`（`confirmBox`）、`toast()`。

**本阶段不新增任何颜色 token**，浅色、深色（`prefers-color-scheme` 和 `[data-theme]`）自动一致。

---

## Spacing Scale

只用 4 的倍数，与 09-UI-SPEC 一致，不引入 6、10、14、18、22。

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 行内按钮之间的间隙、折叠指示与文字的间隙 |
| sm | 8px | 同一行内控件间距、行与行之间、字段标签与输入框之间 |
| 12 | 12px | 卡片头部内边距、字段之间、粘性栏内边距（沿用现有 `gap:12px`） |
| md | 16px | 卡片内边距、分区标题与内容之间、横幅外边距 |
| lg | 24px | 分区与分区之间（`.pe-sec` 上边距）、空计划卡片内边距 |
| xl | 32px | 页面底部留白（保存栏之后） |
| 2xl | 48px | 不使用 |
| 3xl | 64px | 不使用 |

Exceptions:
- 触控目标：≤560px 时，编辑页里所有按钮、输入框、`.seg` 按钮、折叠开关最小高度 44px；桌面最小高度 36px（与 09 横幅按钮一致）。`目标页` 的 `编辑计划` 入口按钮和空计划卡片里的按钮在 ≤560px 同样 44px。
- 序号列宽 24px（任务行左侧的序号，与 4 的倍数一致）。
- **本契约声明的所有间距值（内边距、间隙、外边距）都在 4 的倍数上，没有"继承的奇数值"例外。** 现有组件（`.ghost` 5px 10px、`.primary` 7px 14px、`.danger` 6px 12px、`.panel` 18px、`.seg` 间隙 6px、`.empty` 6px 0、`dialog#confirm` 20px 内边距和 6px 段间距、归档区复用的 `.group` 18px、`.task` 间隙 10px 等）**不改全局规则**；新界面用**作用域覆盖**把它们落到 4 的倍数上，覆盖只在下面的作用域里生效，四个现有视图、目标页非归档部分、登录页、冲突留底、导入、撤销等现有对话框的外观与今天完全一样：

  | 作用域 | 覆盖 | 落地值 |
  |--------|------|--------|
  | `#tab-plan`、`.goals-bar`、`.pe-empty`、`.arch`、`dialog#confirm.pe` 里的 `.ghost`、`.danger` | 内边距、字号 | `padding:8px 12px;font-size:14px` |
  | 同上作用域里的 `.primary` | 内边距、字号 | `padding:8px 16px;font-size:14px` |
  | `#tab-plan .pe-act button`（行内上移、下移、删除、恢复、彻底删除） | 内边距、字号 | `padding:4px 8px;font-size:12px` |
  | `#tab-plan .panel`、`.pe-empty` | 内边距 | 编辑页面板 16px；空计划卡片 24px |
  | `#tab-plan .seg` | 间隙、按钮内边距、字号 | `gap:8px`；按钮 `padding:8px 12px;font-size:14px` |
  | `#tab-plan .empty`、`.pe-empty .empty` | 内边距 | `padding:8px 0` |
  | `.arch .group`、`.arch .group-h`、`.arch .task`、`.arch .task .meta`、`.arch .bar` | 内边距、间隙、外边距 | `padding:16px`；`gap:8px`；`gap:8px`；`gap:8px`；`margin:8px 0` |
  | `dialog#confirm.pe`（`confirmBox` 的 `scope:"plan"` 参数加这个 class，关闭时移除） | 内边距、段间距 | 桌面 `padding:24px`；≤560px `padding:24px 24px calc(24px + env(safe-area-inset-bottom,0px))`；`#cf-body p+p{margin-top:8px}` |

- 不属于本契约的现有部分保持原样、本契约既不声明也不使用它们的内部间距：日历日面板和时间线里的 `.tag`（只新增 `max-width` 和省略号）、现有 `.toast`、`.toolbar`、`.syncbar`（`#pe-notice` 直接复用，它的 12px 16px 内边距本来就在 4 的倍数上）、`nav.tabs`。
- `dialog#confirm` 正文新增 `max-height:50vh;overflow:auto`（补 11-UI-REVIEW 指出的窄屏、横屏无高度上限）。这条对所有 `dialog#confirm` 生效，不改变外观，只在内容超高时出现滚动。

---

## Typography

编辑页、目标页「已归档」区、空计划卡片和 Phase 12 的新对话框只用 **4 个字号（12、14、16、24）、2 个字重（400、600）**。所有规则限定在 `#tab-plan`、`.goals-bar`、`.arch`、`.pe-empty`、`dialog#confirm.pe` 这些作用域里，**不改** `.ghost`（现有 13px）、`.panel h3`、`.group-h` 等现有全局规则，三个现有视图和目标页非归档部分的字号字重与今天完全一样。

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / 提示行 / 计数 / 行内按钮（上移、下移、删除）/ 错误文字 / 序号 | 12px | 400 | 1.55 |
| Body（对话框正文、卡片里的说明、摘要文字、按钮文字、提示栏按钮） | 14px | 400；`.primary` 600 | 1.55 |
| Input / Heading（输入框文字；分区标题 `h3`、卡片标题、对话框标题、空计划标题） | 16px | 输入框 400；标题 600（衬线 `var(--serif)`） | 输入框 1.55；标题 1.2 |
| Display（仅编辑页标题 `h2`，与 `.wk-head h2` 同 24px） | 24px | 600（衬线） | 1.2 |

说明：
- 输入框文字一律 16px（桌面和手机相同），防止 iOS 聚焦时放大，沿用 09 的做法；标签文字 12px。
- `h2` 用 24px 600，不用 `.wk-head h2` 的默认粗体 700：规则写在 `#tab-plan .pe-head h2`。
- 卡片标题里的 `P1` 编号用 16px 600 衬线、文字色 `--ink`（不用类别色当文字，原因见 Color）。
- 上面作用域里**不出现** 11px、13px、15px、17px、18px、19px、28px、700、800。现有 `.ghost` 的 13px、`.primary` 继承的 15px，在作用域内一律被覆盖成 14px（见 Spacing 的覆盖表，同一条规则里）；`.seg` 按钮的 13px 同样覆盖成 14px。
- **目标页「已归档」区也落在这 4 个字号、2 个字重里，没有例外**：它是现有 `.group`、`.task`、`.lift` 的灰色只读版本，作用域覆盖如下（只在 `.arch` 里生效，主列表里的同名组件不变）：

  | 位置 | 覆盖后 |
  |------|--------|
  | `.arch .group-h h3`（归档组的组名） | 16px 600 衬线 |
  | `.arch-mark`（`已归档` 小标记）、`.arch .group-h .cnt`（完成数）、`.arch .note`、`.arch .task .meta`、`.arch .lift .hist`、`.arch .lift .lv small` | 12px 400 |
  | `.arch .task .tt`（任务文字）、`.arch .lift .ln`（力量项名称，600）、`.arch>summary` | 14px（`.ln` 600，其余 400） |
  | `.arch` 里的小标题（`已归档的任务`、`没有所属目标组的待办`） | 12px `--muted` 400，与编辑页 S5、S13 的小标题一致 |
  | `.arch .lift .lv`（当前值） | 16px 600 衬线（现有 28px 800 缩小，只读归档项不需要抢眼） |

- 日历日面板、时间线里的 `.tag`（现有 11px）是现有组件，只新增省略号，不在本契约的字号声明里。
- 所有计划文字、邮箱类字符串用 `textContent` 或 `esc()` 写入；id 进 `data-*` 前过 id 正则（沿用 Phase 7）。

---

## Color

沿用现有调色板，60/30/10：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--paper)` | 页面背景、粘性保存栏背景、输入框背景 |
| Secondary (30%) | `var(--surface)` | 折叠卡片、空计划卡片、对话框 |
| Accent (10%) | `var(--c-lang)` | 见下面 reserved 清单（本阶段不新增 accent 用途） |
| Destructive | `var(--red)` | 仅用于：`删除`、`彻底删除`、`用我的覆盖`、`放弃我的修改，用新版`、`连进度一起删` 按钮文字；输入框校验错误文字；卡片头部的 `需要修改` 标记 |

Accent reserved for：
1. 键盘焦点环（现有 `:focus-visible`，不变）。
2. 目标页 `.group.k-lang` 等现有类别色（语言类的现有用途，不变）。
3. 状态行 `已同步` 小圆点（现有，不变）。

编辑页自己**不使用 accent**：`保存计划` 用现有 `.primary`（`--ink` 底，与登录页、横幅一致）。

警告色 `var(--c-job)`：只用于色条、边框、圆点（冲突提示横幅的左色条、粘性栏提示行的圆点），**不作文字色，也不作整块底色**（11-UI-REVIEW 的结论）。冲突提示正文用 `--ink`。

类别色（`--c`/`--s`，来自 `.k-*`）：编辑页里**只**用于组卡片的 4px 左边框和类别标签的底色（`--s`），文字一律 `--ink`；原因：`--c-job` 在浅色主题对 `--surface` 约 3.9:1，不够 14–16px 文字。类别靠文字（`语言`、`专业`…）区分，不靠颜色。

归档项的「变灰」：不用 `opacity`（会拉低文字对比度），而是令 `--c:var(--c-oth);--s:var(--c-oth-s)`，正文用 `--muted`（对 `--surface` 浅色约 5:1）。

对比度核对：`--ink`/`--muted` 对 `--surface`/`--paper` 两个主题都不低于现有应用已验收的水平；`--red` 文字对 `--surface` 浅色约 5.1:1，深色高于 6:1。

---

## Surfaces

### S1 路由、入口与页面外壳

**入口（仅云端版，D-13）**
- 目标页 `#goals` 顶部加一行 `.goals-bar`：右对齐一个 `.ghost` 按钮 `编辑计划`（`id="planEditBtn"`）。键盘可达（真 `<button>`，不是 label）。
- 在 `GATE_ALLOW` 之外：对账中、连不上只读时按钮被现有 `applyGate` 禁用（变淡 55%），说明在顶部横幅，不再单独解释（沿用 09 S3）。
- 目标页是空计划时，这个按钮被空计划卡片里的 `编辑计划`（`.primary`）取代，不重复出现（见 S11）。
- 本地版：整行不渲染。

**路由**
- 点入口：`location.hash="#plan"`（压入历史），显示编辑页，滚动到顶部，焦点移到 `h2#pe-title`（`tabindex="-1"`）。
- 编辑页是 `<section id="tab-plan" class="hidden">`，放在 `#tab-tl` 之后，在 `.wrap` 里。显示它时：四个标签页按钮 `aria-selected="false"`，`#tab-wk/#tab-cal/#tab-goal/#tab-tl` 都加 `.hidden`。**顶部标题区、`#syncbar`、`nav.tabs`（含工具栏）都保持可见**——因为 D-09 要求「切换标签」是离开编辑页的一条路径。
- 点任一标签、浏览器返回键、退出登录、重新登录：都先经 S8 的「离开确认」（有未保存修改时），再离开。离开后显示用户点的那个标签；返回键离开时显示进来之前的那个标签。
- 离开确认被拒绝时，回到编辑页并把地址栏恢复为 `#plan`（用户看到页面没动）。
- 保存计划或放弃修改离开后：清掉 `#plan`（不留编辑页历史），显示目标页，焦点回到 `#planEditBtn`（若已不存在，回到目标页容器 `#goals`，`tabindex="-1"`）。
- 刷新页面或直接打开 `#plan`：草稿不保留（D-09）。云端版在登录、对账完成之后，按当前计划重新打开编辑页（草稿是空白的新草稿）；本地版和未登录时回到目标页（本地版不弹提示）。
- 编辑页的内容只由编辑页自己的函数渲染；`renderAll()`、`applyView()`、`takeRemote()` 之后的重绘**必须跳过 `#tab-plan`**，否则远端更新会冲掉草稿（D-07、Success Criteria 4）。

**页面结构（自上而下）**

```
.pe-head   h2#pe-title「编辑计划」 + 一句说明
#pe-bar    粘性保存栏：提示行 #pe-hint（左） + 放弃这次修改 + 保存计划（右）
#pe-notice 冲突提示横幅（仅"计划在别的设备上改过了"时出现）
section 目标组     h3 + 计数 + 折叠卡列表 + 添加
section 健身       h3 + 每周健身目标 + 力量项折叠卡列表 + 添加
section 基础预设标签  h3 + 说明 + 5 个类别折叠卡
details#pe-archived 已归档（n）——没有归档项时整块不渲染
```

分区顺序按使用频率排：目标组最常改放最前，其次是力量项和健身目标，预设标签最少改放后面，归档区最后。

**焦点：** 编辑页只有一个深色实心块，就是粘性栏里的 `保存计划`（`.primary`，`--ink` 底），视线先落到 24px 的页面标题，再沿粘性栏落到 `保存计划`；折叠卡片、行内按钮都是浅色描边，是次要层级；编辑页不使用 accent。目标页空计划卡片的焦点是卡片里的 `编辑计划`（`.primary`，卡片里唯一的深色块）。

页头说明（14px，`--muted`）：`改动先存在这一页，点「保存计划」才生效；点「放弃这次修改」，计划完全不变。`

### S2 粘性保存栏 `#pe-bar`

- `position:sticky; top:env(safe-area-inset-top,0px); z-index:3`；背景 `--paper`，下边框 `1px solid var(--line)`，内边距 12px 0，外边距 16px 0。在 toast（z-index 5）和对话框（顶层）之下。
- 放顶部而不是底部：toast 在屏幕底部居中，底部粘性栏会盖住 `已从草稿移除…撤销` 这类带按钮的提示。
- 左：`#pe-hint`（`role="status"`，12px，`flex:1 1 auto;min-width:0`，允许换行）。右：`放弃这次修改`（`.ghost`）、`保存计划`（`.primary`，`id="pe-save"`）。≤560px 按钮最小高度 44px，两个按钮不换行；提示行占剩余宽度（375px 下约 200px，约 16 个字一行）。
- 提示行按优先级只显示一条（高在上），圆点沿用 `.status[data-state]::before` 的 8px 圆点画法（`--tone`），条件和文字见下表。
- 最长的容量超限提示在 375px 下可换到 3 行，保存栏随之长高，按钮保持垂直居中。

| 优先级 | 条件 | 提示行文字 | 圆点 tone | 保存按钮 |
|--------|------|-----------|----------|---------|
| 1 | 登录已过期（D-12） | `登录已过期，重新登录后再保存` | warn | 不可用（见下） |
| 2 | 断网、连不上服务器（D-11） | `联网后再保存` | warn | 不可用（见下） |
| 3 | 上一次点保存没成功（容量超限） | `保存失败：计划超过容量上限（4 MB）。请先删掉一些内容，或联系管理员。` | error | 可用 |
| 4 | 点保存时校验没通过 | `有 {n} 处需要修改，已标在对应位置` | error | 可用 |
| 5 | 别的设备改过计划（D-07） | `计划在别的设备上改过了` | warn | 可用 |
| 6 | 有未保存的修改 | `有没保存的修改` | muted（无色圆点用 `--muted`） | 可用 |
| 7 | 没有修改 | `还没有修改` | 无圆点 | 不可用（`disabled`，没有修改就没有东西可保存） |

- **保存按钮在断网、过期时的写法（D-11、D-12）**：用 `aria-disabled="true"`，**不用** `disabled`，外观同 `.primary:disabled`（`opacity:.4;cursor:not-allowed`），保持在 Tab 顺序里，并 `aria-describedby="pe-hint"`；点击或按 Enter 不执行保存，只弹 toast 重复同一句原因。这样键盘和读屏用户也能知道为什么不能保存（`disabled` 会让按钮跳出 Tab 顺序，原因无处可读）。联网或重新登录后恢复为正常按钮，`#pe-hint` 是 live 区域，会读出新状态。
- 第 7 条（没有修改）是真 `disabled`，因为没有原因需要解释，`放弃这次修改` 仍可用。
- 「断网、连不上服务器」的判定与状态行一致：`data-state` 为 `offline`、`retrying`、`unreachable`、`slow` 之一。
- 编辑页在断网时**可以打开、可以改草稿**，只是不能保存（Claude's Discretion 定稿）。
- 点 `保存计划` 后按钮 `disabled`、`aria-busy="true"`、文字 `保存中…`，防止连点；本机写入是同步的，通常看不到这个状态，流程完成后离开编辑页。

### S3 折叠卡片 `.pe-card`（编辑页的统一积木）

目标组、力量项、预设类别三种东西都用同一个折叠卡，只是里面的字段不同。

```html
<div class="pe-card k-pro" data-key="…">
  <div class="pe-card-h">
    <button type="button" class="pe-toggle" aria-expanded="false" aria-controls="pe-b-…">
      <span class="pe-chev" aria-hidden="true"></span><span class="pe-no">P2</span><span class="pe-name">示例目标组</span>
    </button>
    <span class="pe-sum">专业 · 5 项</span>   <!-- 12px --muted -->
    <span class="pe-bad hidden">有 1 处要改</span>  <!-- 12px --red，有校验错误时显示 -->
    <div class="pe-act"> 上移 下移 </div>
  </div>
  <div class="pe-body" id="pe-b-…" role="group" aria-labelledby="…" hidden>…</div>
</div>
```

- 默认全部**折叠**（20 个组一眼看全，也方便只调顺序）；新添加的卡自动展开并聚焦第一个输入框。展开状态只属于当前页面打开期间的界面状态，不属于草稿，不影响「有没有修改」。
- 头部：左边是一个**整块可点**的 `<button class="pe-toggle">`（`aria-expanded`、`aria-controls`），内含 `▸/▾` 指示（CSS 伪元素，展开时换 `▾`，无动画）、编号（组才有，16px 600 衬线）、名称（16px 600 衬线，超长单行省略，`title` 放全名；名称为空时显示灰色 `（未命名）`）。右边是摘要（12px muted）、错误标记、`上移`/`下移`。
- 卡片外观：`--surface` 底，`1px solid var(--line)`，圆角 12px，**左边框 4px `var(--c)`**（类别色，仅组卡片和预设类别卡片有；力量项卡片用 `--c-fit`）；卡片之间 8px。头部内边距 12px 16px，展开内容内边距 0 16px 16px。
- 卡片头部的 `上移`/`下移` 是**同级重排**：组在未归档的组之间重排，力量项在未归档的力量项之间重排；预设类别卡片**没有**上下移（五个类别的顺序固定在代码里）。
- 展开内容里的删除按钮在内容末尾（`删除这个目标组` / `删除这个力量项`，`.danger`），不放在头部，避免折叠状态下误触。

### S4 行 `.pe-row`（任务行、预设标签行共用）

```html
<li class="pe-row">
  <span class="pe-n" aria-hidden="true">1</span>
  <label class="sr-only" for="pe-t-…">任务 1</label>
  <input type="text" id="pe-t-…" maxlength="200" value="示例任务" aria-describedby="pe-e-…">
  <div class="pe-act">
    <button type="button" class="ghost" aria-label="上移任务：示例任务">上移</button>
    <button type="button" class="ghost" aria-label="下移任务：示例任务">下移</button>
    <button type="button" class="danger" aria-label="删除任务：示例任务">删除</button>
  </div>
  <p class="pe-err" id="pe-e-…" hidden></p>
</li>
```

- 桌面：`grid-template-columns:24px minmax(0,1fr) auto`，输入框与三个按钮同一行。
- ≤560px：`grid-template-columns:24px minmax(0,1fr)`，三个按钮落到第二行（`grid-column:2`，各占三分之一宽，`min-height:44px`），错误文字在第三行。
- 按钮是**文字**「上移」「下移」「删除」，不用箭头图标：对非技术用户最清楚，也满足读屏的「可见文字包含在名称里」。`aria-label` 以可见文字开头并带上对象。 行内小按钮的可见文字只有动词，对象由同一行的输入框内容（或归档区里同一行的名称、卡片头部的标题）提供；`aria-label` 一律写全对象。卡片内容末尾的 `删除这个目标组`、`删除这个力量项` 和确认框按钮则直接写出对象。
- 第一项的 `上移`、最后一项的 `下移` 为 `disabled`。
- `.sr-only` 是本阶段新增的一条小工具规则：`position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap`（现有文件里没有）。
- 输入框里按 Enter：不提交、不换行、不新增行（这一页不是 `<form>`）。想加一行用 `＋ 添加任务`。

### S5 各分区的字段（D-15、D-17）

**目标组（分区 `h3`：`目标组`，旁边计数 `{n}/20`，12px muted）**

组卡片头部摘要：`{类别} · {n} 项`（n 为未归档任务数）。展开内容自上而下：

| 控件 | 规格 |
|------|------|
| 名称 | `<label class="f">名称</label>` + `input[type=text]`，`maxlength="40"`，必填；字数达到 32 时在右下角出现 `{n}/40` 计数（12px muted） |
| 类别 | `.seg` 五个按钮（`语言 专业 健身 求职 其他`，`aria-pressed`，`role="group"`、`aria-label="类别"`，沿用 `openEditor` 和 composer 的写法）；只能五选一，必有一个选中 |
| 备注 | `<textarea>` 可选，`maxlength="200"`，`min-height:64px`，字数达到 160 出现计数 |
| 任务列表 | 小标题 `任务`（12px muted）+ `{n}/50` 计数 + `<ul class="pe-rows">`（S4 的行），每行 `maxlength="200"`，字数达到 160 出现 `{n}/200` |
| 添加任务 | `.ghost` `＋ 添加任务`；达到 50 项时按钮 `disabled`，旁边 12px muted 文字 `最多 50 项` |
| 删除 | `.danger` `删除这个目标组`，在内容最末，规则见 S6 |

任务数为 0 时列表区显示 `.empty`：`这个目标组还没有任务。`

分区末尾：`.ghost` `＋ 添加目标组`；达到 20 个时 `disabled`，旁边 12px muted `最多 20 个`。新组默认类别 `其他`，名称为空，展开并聚焦名称。

**健身分区（`h3`：`健身`）**

1. 面板 `每周健身目标`（一个 `.panel` 样式面板，不折叠，因为只有三个字段）：
   - `最少` `input[type=number]`，`inputmode="numeric"`，`min="0" max="7" step="1"`，宽 96px，后缀文字 `天`。
   - `最多` 同上。两个并排，窄屏也并排（各 96px 加后缀，够宽）。
   - `健身说明`：`<textarea>` 可选 `maxlength="200"`，对应 `fitNote`，显示在目标页力量目标卡的备注位置。
   - 校验见 S6。
2. 力量项卡片列表，分区内的小标题 `力量项`，计数 `{n}/8`。卡片头部摘要：`{目标值} {单位}`。展开内容：

| 控件 | 规格 |
|------|------|
| 名称 | 文本，`maxlength="40"`，必填 |
| 单位 | 文本，`maxlength="8"`，必填，不写 placeholder，旁边 12px muted 示例文字 `例如 kg、次` |
| 目标值 | `input[type=number]`，`inputmode="decimal"`，`min="0" step="any"`，必须大于 0 |
| 默认起始值 | 同上，必须不小于 0 |
| 备注 | 文本域，可选，`maxlength="200"` |
| 删除 | `.danger` `删除这个力量项`，规则见 S6 |

   末尾 `.ghost` `＋ 添加力量项`；达到 8 个 `disabled` 加 `最多 8 个`。新力量项单位默认空。

**基础预设标签（`h3`：`基础预设标签`）**

- 说明（12px muted，常显）：`这里改的是基础标签。在「记一笔」里自己加的标签、隐藏的标签不受影响。`
- 五张类别卡（`语言 专业 健身 求职 其他`，各带 `--c` 左边框，**无**上下移），摘要 `{n} 个标签`。展开后是 S4 的行（每个标签一行：`input[type=text]`，`maxlength="30"`，必填；`上移` `下移` `删除`）。
- 删除标签：直接从草稿移除（标签没有"进度"，不走确认），弹撤销 toast（S9）。
- 添加：`.ghost` `＋ 添加标签`；每个类别最多 20 个，满了 `disabled` 加 `最多 20 个`（Discretion 定稿）。
- 同一类别里不能有重复标签（比较时去掉首尾空格，区分大小写）：重复时在重复的那一行出现错误 `这个分类里已经有这个标签了`。
- 基础标签与用户自己在「记一笔」里添加的标签重名时，`presetsFor` 合并后**去重，只留第一个（基础的）**，不会出现两个相同的标签按钮（Discretion 定稿，代码改动在 `presetsFor`）。
- 类别没有标签时显示 `.empty`：`这个类别还没有基础标签。`

### S6 校验与上限（D-17，Success Criteria 3）

- **硬上限靠输入限制**：名称 40、任务文字 200、备注 200、标签 30、单位 8 都用 `maxlength`，输入或粘贴超出时被截断，不出现"超长但不让保存"的状态；数量上限（组 20、每组任务 50、力量项 8、每类标签 20）靠**添加按钮在满时 `disabled` 加旁边的文字**，不靠保存时才报错。归档项**不占**数量上限；恢复一个归档项会超出上限时，`恢复` 按钮 `disabled`，旁边 12px muted 文字 `目标组已满（20 个），先删掉一个再恢复`（任务、力量项同理，数字换成对应的上限）。
- **空值和数值规则在保存时检查，并就近提示**：

| 字段 | 错误文字（12px，`--red`，输入框下方，`aria-describedby` 关联，输入框 `aria-invalid="true"`） |
|------|------|
| 组名称为空 | `请填写目标组名称` |
| 任务内容为空 | `请填写任务内容` |
| 力量项名称为空 | `请填写力量项名称` |
| 力量项单位为空 | `请填写单位` |
| 目标值不是大于 0 的数 | `目标值要大于 0` |
| 默认起始值不是不小于 0 的数 | `起始值不能小于 0` |
| 标签为空 | `请填写标签内容` |
| 标签重复 | `这个分类里已经有这个标签了` |
| 每周健身天数不是 0 到 7 的整数 | `请填 0 到 7 之间的整数` |
| 最少大于最多 | `最少天数不能大于最多天数`（显示在两个输入框下方，同时标记两个） |

- 一个字段在**失去焦点后**或**点过保存之后**才显示错误（避免刚开始输入就红）；输入变得合法时错误立即消失。
- 点 `保存计划` 时有错误：不保存；**自动展开**所有含错误的折叠卡，在卡片头部显示 `有 {n} 处要改`（红色文字，不只是颜色：文字本身说明），粘性栏提示行写 `有 {n} 处需要修改，已标在对应位置`，焦点移到页面上第一个出错的字段并滚动到可见。
- 空白的新行（刚点了添加还没填）按"内容为空"报错，不会被悄悄丢掉。

### S7 删除、归档、恢复、彻底删除（D-01、D-02，编辑页）

所有这些操作**只改草稿**，点 `保存计划` 才生效；确认框里要写明这一点。判断"有没有进度"用草稿打开时的数据（保存前再按最新进度查一遍见 S9 的 D-08）。草稿里刚新增、还没保存过的项没有进度，一律直接移除。

| 对象 | 条件 | 点 `删除` 之后 |
|------|------|---------------|
| 任务 | 没有进度（未完成且没设截止日期） | 直接从草稿移除，弹撤销 toast |
| 任务 | 已完成或设了截止日期 | 弹确认框（归档），确认后标为归档，移到「已归档」区 |
| 目标组 | 所有任务都没有进度，且没有自定义待办 | 直接移除，弹撤销 toast |
| 目标组 | 任一任务有进度，或组里有自定义待办 | 弹确认框（归档），整组连同自定义待办标为归档 |
| 力量项 | `state.lifts[id].hist` 为空 | 直接移除，弹撤销 toast |
| 力量项 | 有历史记录 | 弹确认框（归档） |

**直接移除**：行或卡片消失，toast `已从草稿移除：{短名}` + `撤销移除`（`ms=5000`，短名超过 10 字截断加 `…`，保证 375px 下一行放得下）。焦点移到下一行的输入框（没有下一行就到上一行，再没有就到该列表的 `＋ 添加…` 按钮）。点 `撤销移除` 把项放回原来的位置。点 `放弃这次修改`（保存栏）整份草稿丢弃也能找回。

**确认框**（`confirmBox`，规则：默认焦点在左边的安全按钮；Esc 或点背景等同安全按钮）：

| 场景 | 标题 | 正文（每条一个段落） | 左按钮（安全） | 右按钮 |
|------|------|------|------|------|
| 归档任务 | `归档这个任务？` | `「{任务文字}」{状态}。` / `归档后它会变灰，放到目标页底部的「已归档」里，不能再勾选；日历和时间线里的完成记录照常显示。` / `可以在编辑页的「已归档」里恢复。点「保存计划」后生效。` | `不归档` | `归档任务`（`.primary`） |
| 归档目标组 | `归档这个目标组？` | `「{组名}」里有{统计}。` / `整组会变灰，放到目标页底部的「已归档」里，自定义待办跟着一起归档；日历和时间线里的完成记录照常显示。` / `可以在编辑页的「已归档」里恢复。点「保存计划」后生效。` | `不归档` | `归档目标组`（`.primary`） |
| 归档力量项 | `归档这个力量项？` | `「{名称}」有 {n} 条力量记录。` / `归档后目标页只读显示它的历史，不能再记录新的重量。` / `可以在编辑页的「已归档」里恢复。点「保存计划」后生效。` | `不归档` | `归档力量项`（`.primary`） |

- `{状态}`：已完成写 `已完成`；只设了截止日期写 `设了截止日期（{M月D日}）`，并在第二段后面补一句 `它在日历上的截止提醒也会先隐藏，恢复后回来。`（D-04）。
- `{统计}`：把非零的部分用 `、` 连起来：`{a} 项已完成`、`{b} 项设了截止日期`、`{c} 个自定义待办`。
- 引号里的文字超过 30 字时截断加 `…`。
- 归档**不是**破坏性操作（可恢复），所以确认按钮用 `.primary` 而不是红色 `.danger`；这需要给 `confirmBox` 加一个可选参数 `okClass`（默认 `danger`，现有调用不变）。

**恢复**（在「已归档」区点 `恢复`）：项回到主列表，**组排到最后、任务排到原组末尾、力量项排到最后**（Discretion 定稿）；toast `已恢复：{短名}`（`ms=3000`）；焦点移到「已归档」区里下一个 `恢复`，没有了就到 `已归档` 摘要。恢复不需要确认。

**彻底删除**（在「已归档」区点 `彻底删除`，要再确认一次，`.danger` 红色按钮）：

| 对象 | 标题 | 正文 | 左按钮 | 右按钮 |
|------|------|------|------|------|
| 任务 | `彻底删除这个任务？` | `「{任务文字}」的进度（{状态}）会一起删除。` / `日历和时间线里对应的完成记录也会消失。` / `点「保存计划」后生效，保存之后无法找回；点「放弃这次修改」可以撤回这次删除。` | `不删除` | `彻底删除任务` |
| 目标组 | `彻底删除这个目标组？` | `「{组名}」和它的 {n} 项任务会被彻底删除。` / `任务的进度会一起删除，日历和时间线里对应的完成记录也会消失。` / （有自定义待办时）`组里的 {c} 个自定义待办也会一起删除。` / `点「保存计划」后生效，保存之后无法找回；点「放弃这次修改」可以撤回这次删除。` | `不删除` | `彻底删除目标组` |
| 力量项 | `彻底删除这个力量项？` | `「{名称}」的 {n} 条力量记录会一起删除。` / `点「保存计划」后生效，保存之后无法找回；点「放弃这次修改」可以撤回这次删除。` | `不删除` | `彻底删除力量项` |

保存时，彻底删除的力量项同时删掉 `state.lifts[id]` 的历史（Discretion 定稿，防止数据里一直残留）。

### S8 保存计划、放弃修改和离开（D-09、D-10）

**保存计划**：校验通过 → 按 S9 的顺序（取最新远端进度、冲突三选一、D-08 复查）→ 写入计划（`docs.plan.dirty=true; docs.plan.seq++; cachePut("plan",…)`，再 `requestSync("save")`）→ 离开编辑页回到目标页 → toast `计划已保存`（`ms=3000`）。点保存**直接生效**，不显示改动摘要（D-10）。上传途中失败或掉线走现有脏标记加退避重试，状态行照常显示 `保存失败…自动重试` 或 `离线…`，不弹额外提示。

**放弃这次修改**：没有未保存修改时直接离开；有未保存修改时弹「离开确认」；确认后丢弃整份草稿，计划完全不变。

**离开确认**（切换标签、浏览器返回键、`放弃这次修改` 按钮这三条离开编辑页的路径都用它；退出登录和重新登录各有专用文案，见下）：

| 标题 | 正文 | 左按钮（安全，默认焦点） | 右按钮 |
|------|------|------|------|
| `放弃没保存的修改？` | `计划页里的修改还没有保存，现在离开会丢失。` | `继续编辑` | `放弃修改`（`.danger`） |

**退出登录**：现有退出确认框在编辑页有未保存修改时，也要弹，并增加一条条件行（和 `T_CF_UNSAVED` 等并列，哪样存在就显示哪样）：`编辑计划页里有没保存的修改，退出后会丢失。`

**登录已过期后点横幅的 `重新登录`**（D-12）：编辑页有未保存修改时，先弹确认：

| 标题 | 正文 | 左按钮（安全，默认焦点） | 右按钮 |
|------|------|------|------|
| `重新登录？` | `未保存的计划修改会丢失。` | `先不登录` | `仍然重新登录`（`.danger`） |

**页面关闭、刷新**：有未保存修改时设 `beforeunload`（`preventDefault()` 加 `returnValue=""`），浏览器弹自带提示，文字不可定制；手机浏览器不保证弹出，已被所有者接受（D-09）。没有修改时不设。

「有没有未保存的修改」= 草稿与打开时拿到的计划按内容比较**不相等**。展开、折叠不算修改。改了又改回原样不算修改。

### S9 两台设备同时改计划（D-07、D-08，Discretion 定稿）

**草稿记住自己打开时的计划版本**（计划文档的 `updated`/`base`），保存时据此判断，不能用被 `pendRemote.plan` 前移后的 `docs.plan.base`。

**编辑期间远端保存了计划**：草稿不动；出现两处提示：
1. 粘性栏提示行（优先级 5）：`计划在别的设备上改过了`。
2. 编辑页顶部横幅 `#pe-notice`（紧跟在粘性栏下面，不粘性；`.syncbar` 外观，`data-tone="warn"`，**没有按钮**）：`计划在别的设备上改过了。你的草稿没有变，点「保存计划」时可以选择怎么处理。`

**编辑页打开期间，全局的 `#syncbar` 远端更新横幅**（`其他设备有新的修改，稍后会自动更新。` + `现在更新`）要换成无按钮的变体：`其他设备有新的修改，保存或放弃计划编辑后会自动更新。`（`info`，没有 `现在更新`），因为此时应用远端更新会换掉计划。四个视图的远端更新照旧挂起，编辑页关闭后按 Phase 10 规则应用（先 plan 后 state）。

**点保存的顺序**（每一步通过才进入下一步）：
1. 校验（S6）。
2. `takeRemote()` 取到最新进度，再判断打开后计划有没有被别的设备改过。
3. 计划被改过 → **三选一对话框**。
4. 草稿里直接移除的项现在是否有了进度 → **D-08 询问框**。
5. 容量检查（4 MB）。通过后写入。

**三选一对话框**（`dialog#confirm` 加第三个按钮，见 S10）：

| 标题 | `计划在别的设备上改过了` |
|------|------|
| 正文 | `你打开编辑页之后，别的设备保存了新的计划。` / `用我的覆盖：保存你现在这份草稿；别的设备上的那一版会在本机留一份，可以下载。` / `放弃我的修改，用新版：丢掉你的草稿，改用别的设备上的新计划。` / `回去继续改：回到编辑页，什么都不变。` |
| 按钮（从左到右） | `回去继续改`（`.ghost`，默认焦点，Esc 等同） / `放弃我的修改，用新版`（`.danger`） / `用我的覆盖`（`.danger`） |

- `用我的覆盖`：继续保存流程（后面还可能遇到 D-08 询问）。保存时被盖掉的那一版按 Phase 9 D-10 和 11-09 的计划留底包装存成本机留底；离开编辑页后弹 toast `计划已保存，别的设备上的那一版已在本机留底` + `下载留底`（`ms=8000`）。留底存不下时不弹这条，改弹 `计划已保存`，并显示现有的 `留底没存上` 横幅（09 S4），不说假话。
- `放弃我的修改，用新版`：丢掉草稿，应用远端计划（`takeRemote()`），**离开编辑页回到目标页**，toast `已改用别的设备上的新计划，你的修改没有保存`（`ms=6000`）。
- `回去继续改`：关闭对话框，留在编辑页，草稿不变，提示继续显示。下次点保存再弹一次。

**D-08 询问框**（一个框列出全部，Discretion 定稿；没有这种项时不弹）：

| 标题 | `这些项刚在别的设备上有了进度` |
|------|------|
| 正文 | `你在草稿里删除了下面这些项，但它们刚在别的设备上有了进度：` / 每项一段，最多 8 段，超出写 `还有 {n} 项`：`任务「{文字}」（已完成）` / `任务「{文字}」（设了截止日期）` / `目标组「{组名}」（{统计}）` / `力量项「{名称}」（{n} 条记录）` / `要把它们归档，还是连进度一起删除？` |
| 按钮（从左到右） | `回去继续改`（`.ghost`，默认焦点，Esc 等同） / `全部归档`（`.primary`） / `连进度一起删`（`.danger`） |

- `回去继续改`：不保存，留在编辑页。
- `全部归档`：这些项标为归档再保存。`连进度一起删`：照草稿保存，对应进度一起删除。两个选择都是对列出的**全部**项生效，不逐项选（需要逐项处理的所有者可以回去改草稿）。

### S10 `dialog#confirm` 的小扩展（供 S7、S8、S9 共用）

现有 `confirmBox({title,lines,who,warn,cancel,ok})` 只有"安全按钮 + 红色确认按钮"两个按钮。本阶段扩展，现有调用的行为和外观不变：

1. 可选参数 `okClass`：默认 `danger`，传 `primary` 时确认按钮用 `.primary`（归档确认用）。 可选参数 `scope:"plan"`：给 `dialog#confirm` 加 class `pe`（对话框关闭时移除），启用 Spacing 覆盖表里 `dialog#confirm.pe` 的规则；Phase 12 的所有新确认框（含重新登录确认）都传它，现有的登录、退出、换账号、导入、撤销对话框不传，外观不变。
2. 可选参数 `mid: {text, cls}`：在 `#cfCancel` 和 `#cfOk` 之间多一个按钮 `#cfMid`（没有 `mid` 时 `.hidden`）。有 `mid` 时 `confirmBox` 的返回值：确认按钮 `true`，中间按钮 `"mid"`，其余关闭方式 `false`。`.ed-foot` 加 `.three` 变体：

```css
dialog#confirm .ed-foot.three{flex-wrap:wrap;justify-content:flex-end}
@media (max-width:560px){
  dialog#confirm .ed-foot.three{flex-direction:column;align-items:stretch}
  dialog#confirm .ed-foot.three button{flex:none;width:100%;min-height:44px}
}
dialog#confirm #cf-body{max-height:50vh;overflow:auto}
```
   桌面（对话框 460px）三个按钮一行放得下；手机底部抽屉里竖排，全宽，最安全的 `回去继续改` 在最上面。
3. 默认焦点仍在 `#cfCancel`。读屏沿用现有的 `role="alertdialog"`、`aria-labelledby`、`aria-describedby`。

### S11 目标页的变化（Phase 12 改动的现有视图）

1. **入口行** `.goals-bar`：见 S1。
2. **组编号 P1、P2…（D-14）**：`.group-h .p` 显示按当前顺序自动生成的 `P{n}`，只数未归档的组；新组、重排后的组都立刻按顺序重新编号。不再显示 `esc(g.id)`。初始 7 个组显示不变。`给P1添加待办` 这类 `aria-label` 改成 `给「{组名}」添加待办`（不再带编号，因为编号会变）。
3. **日历日面板、时间线、日历 CSV 里的组标签**：未归档的组显示 `P{n}`；已归档的组显示**组名**；自定义待办找不到所属组时显示 `未知目标组`。`.tag` 加 `max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`，组名很长时单行省略。注意这个取舍：P 编号是位置，重排后同一个组在时间线里的标签会变，名字不会。
4. **归档的任务不再在原组里显示**（修 Phase 7 IN-05）；归档的组整组不在主列表里显示。它们都出现在底部的「已归档」区。
5. **力量项为空**时，力量目标卡里只剩说明和一行 `.empty`：`还没有力量项，可以在「编辑计划」里添加。`；**目标组为空但有力量项**时，力量目标卡之后显示 `.empty`：`还没有目标组，可以在「编辑计划」里添加。`
6. **空计划**（没有未归档的组，也没有未归档的力量项）：整页替换为一张空计划卡片：

```html
<div class="panel pe-empty">
  <h3>计划是空的</h3>
  <p>目标页还没有目标组和力量项。你可以自己建一份，也可以先载入示例计划，再慢慢改。</p>
  <div class="pe-empty-act"><button class="primary" id="planEditBtn2">编辑计划</button><button class="ghost" id="planSampleBtn">载入示例计划</button></div>
</div>
```
   - 标题 16px 600 衬线（覆盖 `.panel h3` 的 19px），正文 14px，按钮之间 8px，≤560px 按钮最小高度 44px，两个按钮窄屏下各占一行全宽。
   - 这张卡之后仍然显示「已归档」区（如果有）。
   - `载入示例计划`：打开编辑页，草稿里加入示例的目标组和力量项（草稿立即变成"有未保存的修改"），toast `已载入示例的目标组和力量项，点「保存计划」后生效`（`ms=4000`）。**只在没有未归档的组和力量项时出现**，编辑页的目标组分区在同样条件下也出现一个 `.ghost` `载入示例计划`。载入的每一项都用**全新的** `g-`/`t-`/`l-` id（不复用 `P1`、`bench` 等示例 id，否则会撞上同 id 的归档项，也会接上旧进度）；预设标签、健身目标不动。
7. **「已归档」区**（`<details class="arch" id="goalsArch">`，放在所有组之后；`<summary>` 文字 `已归档（{n}）`，14px muted，最小高度 36px，用浏览器自带的展开三角，键盘和读屏原生可用；`n` = 归档的组 + 单独归档的任务 + 归档的力量项 + 找不到组的自定义待办的总数；`n=0` 时整块不渲染；默认折叠；展开状态只在页面打开期间保留）。里面自上而下：
   - **归档的组**：沿用 `.group` 的结构，加 `.arch-g`（灰色：`--c:var(--c-oth)`，文字 `--muted`）；头部不显示 P 编号，改显示 `已归档` 小标记（12px，描边，`--muted`）+ 组名 + 完成数 `{dn}/{n}`；任务一行一项，**没有勾选框、没有日期输入、没有添加待办输入、没有删除按钮**，每行只有文字加状态（`已完成于 3月16日`、`截止 3月20日`、`未完成`）；组里的自定义待办也这样列出，只读。
   - **单独归档的任务**（所在组没有归档的）：小标题 `已归档的任务`，每行 `{组名} · {任务文字}` 加状态，只读。
   - **归档的力量项**：沿用 `.lift` 外观变灰，显示名称、当前值 / 目标值，**完整**历史记录（`3月1日 20，3月8日 22.5，…`，不只是最近三条），没有数值输入和保存按钮。
   - **找不到所属组的自定义待办**（修 Phase 7 WR-02）：小标题 `没有所属目标组的待办`，每行文字加一个 `×` 删除按钮（`.x`，沿用现有 `data-deltask`，`aria-label="删除待办"`）。这是归档区里唯一能操作的东西，门控期间照常被禁用。
   - 归档项**不计入**「本周」页的计数、目标页的完成数（`{dn}/{n}` 只数未归档的组）。日历和时间线里已完成的记录照常显示；设了截止日期但没完成的归档任务，日历不再显示它的截止提醒，日历 CSV 也不带这些截止项，恢复后回来（D-04）。

### S12 本周页的空计划提示

仅当没有未归档的组、也没有未归档的力量项时，在 `.wk-head` 下面显示一行 `.empty`：`当前计划是空的，这里只统计你记下的内容。可以在「目标」页载入示例计划或编辑计划。`；其余有计划时不渲染。四个分类卡、七天列、复盘、记一笔都照常工作；`planCat` 里找不到的组按"其他"类别处理（不抛错）。

### S13 编辑页里的「已归档」区 `details#pe-archived`

- 位置：编辑页最底部；原生 `<details>`，`<summary>` 文字 `已归档（{n}）`，默认折叠；没有归档项时整块不渲染（Discretion 定稿）。
- 内容分三组（有哪组才显示哪组）：`目标组`、`任务`、`力量项`，每组一个小标题（12px muted）加列表。每行：左边是名称（组名/任务文字/力量项名称，单行省略，`title` 放全名）加说明（12px muted：`{类别} · {n} 项任务，其中 {m} 项已完成` / `来自「{组名}」· {状态}` / `{n} 条力量记录`），右边是 `恢复`（`.ghost`）和 `彻底删除`（`.danger`）。窄屏下按钮落到第二行，各占一半宽，最小高度 44px。
- 所属组也已归档的任务**不单独列出**，它们跟着组走；组恢复后，之前就被单独归档的任务会作为"任务"出现在这个区里。
- 恢复、彻底删除的规则见 S7。归档、恢复、彻底删除都改草稿，要保存才生效；归档区里的列表随草稿实时更新。

### S14 toast 总表（本阶段全部提示；一律传 `ms`，让云端宽度规则 `.toast[data-cloud]{width:max-content;max-width:calc(100vw - 32px)}` 生效，避免 11-UI-REVIEW 的 375px 窄列问题）

| 场景 | 文案 | 按钮 | ms |
|------|------|------|----|
| 保存成功 | `计划已保存` | 无 | 3000 |
| 用我的覆盖 | `计划已保存，别的设备上的那一版已在本机留底` | `下载留底` | 8000 |
| 放弃我的修改，用新版 | `已改用别的设备上的新计划，你的修改没有保存` | 无 | 6000 |
| 直接移除 | `已从草稿移除：{短名}` | `撤销移除` | 5000 |
| 恢复归档项 | `已恢复：{短名}` | 无 | 3000 |
| 载入示例 | `已载入示例的目标组和力量项，点「保存计划」后生效` | 无 | 4000 |
| 点了不可用的保存（断网） | `联网后再保存` | 无 | 3000 |
| 点了不可用的保存（过期） | `登录已过期，重新登录后再保存` | 无 | 3000 |

排序、展开折叠、校验错误不弹 toast（排序用读屏 live 区域，错误在字段旁和保存栏）。

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA（编辑页） | `保存计划`（保存中 `保存中…`） |
| Primary CTA（目标页入口） | `编辑计划` |
| Secondary | `放弃这次修改`；`载入示例计划`；`＋ 添加目标组`、`＋ 添加任务`、`＋ 添加力量项`、`＋ 添加标签` |
| 行内按钮 | `上移`、`下移`、`删除`；`恢复`、`彻底删除`；`删除这个目标组`、`删除这个力量项` |
| Empty state heading（空计划） | `计划是空的` |
| Empty state body（空计划） | `目标页还没有目标组和力量项。你可以自己建一份，也可以先载入示例计划，再慢慢改。` + 按钮 `编辑计划`、`载入示例计划` |
| Empty（局部） | `这个目标组还没有任务。` / `这个类别还没有基础标签。` / `还没有力量项，可以在「编辑计划」里添加。` / `还没有目标组，可以在「编辑计划」里添加。` / 本周页 `当前计划是空的，这里只统计你记下的内容。可以在「目标」页载入示例计划或编辑计划。` |
| Error state（校验） | 见 S6 表；粘性栏 `有 {n} 处需要修改，已标在对应位置`，卡片头 `有 {n} 处要改` |
| Error state（保存不了） | `联网后再保存`；`登录已过期，重新登录后再保存`；`保存失败：计划超过容量上限（4 MB）。请先删掉一些内容，或联系管理员。`（同时显示 09 已有的容量超限横幅，它的正文 `数据超过了云端容量上限，新修改存不上了，请联系管理员。` 已经写了怎么办；提示行这句补上"先删掉一些内容"这条自己能做的） |
| Notice（冲突） | 提示行 `计划在别的设备上改过了`；横幅 `计划在别的设备上改过了。你的草稿没有变，点「保存计划」时可以选择怎么处理。` |
| Notice（远端更新，编辑页打开期间的全局横幅） | `其他设备有新的修改，保存或放弃计划编辑后会自动更新。` |
| Destructive confirmation: 离开 | `放弃没保存的修改？` / `计划页里的修改还没有保存，现在离开会丢失。` / `继续编辑` `放弃修改` |
| Destructive confirmation: 退出登录（新增条件行） | `编辑计划页里有没保存的修改，退出后会丢失。` |
| Destructive confirmation: 重新登录 | `重新登录？` / `未保存的计划修改会丢失。` / `先不登录` `仍然重新登录` |
| Destructive confirmation: 彻底删除 | 见 S7（任务 / 目标组 / 力量项各一份，按钮 `不删除` `彻底删除任务` `彻底删除目标组` `彻底删除力量项`） |
| Destructive confirmation: 冲突三选一 | 见 S9（`回去继续改` `放弃我的修改，用新版` `用我的覆盖`） |
| Destructive confirmation: D-08 | 见 S9（`回去继续改` `全部归档` `连进度一起删`） |
| Confirmation（归档，非破坏） | 见 S7（任务 / 目标组 / 力量项各一份，按钮 `不归档` `归档任务` `归档目标组` `归档力量项`） |
| 说明文字 | 页头 `改动先存在这一页，点「保存计划」才生效；点「放弃这次修改」，计划完全不变。`；预设说明 `这里改的是基础标签。在「记一笔」里自己加的标签、隐藏的标签不受影响。` |

文案原则（沿用 09）：用「你」「本机」「别的设备」，不用技术词（草稿版本、同步冲突、缓存）；每条错误说清发生了什么，能自救时说怎么办；每个按钮都是"动词 + 对象"，不写泛称的「保存」「取消」「确定」：保存栏用 `保存计划` 和 `放弃这次修改`，确认框里的按钮写明所选的动作（`不归档`、`归档任务`、`不删除`、`彻底删除任务`、`继续编辑`、`放弃修改`）。行内小按钮（`上移`、`下移`、`删除`、`恢复`、`彻底删除`）因为一行里放不下对象，由同一行的输入框内容或卡片标题提供对象，`aria-label` 里一律写全对象（如 `上移任务：示例任务`）；卡片内容末尾的删除按钮和归档确认框的按钮则直接写出对象。示例名称只用通用占位，不写任何真实计划文字。

---

## UI Considerations

> 由 ui-phase 的状态覆盖检查生成。元素共 12 个：E1 目标页入口与路由、E2 目标组折叠卡列表、E3 任务行列表、E4 力量项折叠卡列表、E5 每周健身目标表单、E6 基础预设标签列表、E7 编辑页「已归档」区、E8 目标页「已归档」区、E9 粘性保存栏、E10 确认与冲突对话框、E11 目标页空计划卡片、E12 本周页空计划提示。空状态和错误状态的**文案**在上面的 Copywriting Contract 和 S6，这里只交代状态覆盖并引用它们。

Applicable state considerations resolved: 48 covered, 3 backstop, 0 unresolved（另有 16 项不适用，理由见表后；其中 17 项 covered 和 8 项不适用是 checker 通过后由 ui-consideration-probe 引擎复核补上的）

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E2 目标组列表 | ✅ covered | 没有未归档的组时，编辑页目标组分区显示 `.empty`「还没有目标组」加 `＋ 添加目标组` 和 `载入示例计划`（S5） |
| empty | E3 任务行列表 | ✅ covered | 组里没有任务时显示 `这个目标组还没有任务。` 加 `＋ 添加任务`（S5） |
| empty | E4 力量项列表 | ✅ covered | 没有力量项时只剩 `＋ 添加力量项`；目标页力量目标卡显示 `还没有力量项，可以在「编辑计划」里添加。`（S5、S11） |
| empty | E6 预设标签 | ✅ covered | 类别里没有基础标签时显示 `这个类别还没有基础标签。` 加 `＋ 添加标签`（S5） |
| empty | E7 编辑页已归档区 | ✅ covered | 没有归档项时整块不渲染（S13） |
| empty | E8 目标页已归档区 | ✅ covered | `n=0` 时整块不渲染；有归档但主列表为空时，空计划卡片之后仍显示已归档区（S11） |
| empty | E11 空计划卡片 | ✅ covered | 没有未归档的组和力量项时整页换成 `计划是空的` 卡片，给 `编辑计划` 和 `载入示例计划`（S11） |
| empty | E12 本周页 | ✅ covered | 计划为空时本周页显示一行说明，其余功能照常（S12） |
| loading | E9 保存栏 | ✅ covered | 点保存后按钮 `disabled`、`aria-busy="true"`、文字 `保存中…`，防连点；本机写入是同步的，上传由状态行 `保存中…` 接管（S2） |
| error | E2–E6 各字段 | ✅ covered | 空名称、空内容、目标值不大于 0、起始值为负、天数不是 0–7 整数、最少大于最多、标签重复：字段下方 12px 红色文字加 `aria-invalid`，点保存时展开出错的卡片、聚焦第一个错误（S6） |
| error | E9 保存栏 | ✅ covered | 断网、连不上显示 `联网后再保存`，过期显示 `登录已过期，重新登录后再保存`，保存按钮 `aria-disabled`，点击只弹同一句 toast，草稿保留；容量超限显示 `保存失败：计划超过容量上限（4 MB）。请先删掉一些内容，或联系管理员。` 并留在编辑页（S2） |
| error | E10 冲突对话框 | ✅ covered | 别的设备改了计划：提示行加横幅提示，点保存弹三选一，三个出口都有明确结果，留底存不下时走 `留底没存上` 横幅（S9） |
| error | E1 入口 | ✅ covered | 对账中和只读时入口按钮被现有门控禁用；刷新或直接打开 `#plan` 在本地版和未登录时回到目标页（S1） |
| populated | E2 目标组列表 | 🧪 backstop | 20 个组、每组 50 项任务时全部折叠的列表一屏可扫读，展开一个组后滚动、粘性栏不遮住内容；验收时在 375px 和桌面截图核对 |
| populated | E3 任务行列表 | 🧪 backstop | 50 行任务在 375px 下每行两行高（输入框加按钮行），页面可滚动；验收时截图核对按钮 44px 触控目标和 `上移` `下移` `删除` 不挤压 |
| populated | E8 目标页已归档区 | ✅ covered | 展开后灰色、只读，没有任何输入控件，完成数只数未归档的组（S11） |
| partial | E5 健身目标 | ✅ covered | 只填了一个天数、或最少大于最多：两个字段都标红，错误文字写明原因（S6） |
| partial | E3 任务行列表 | ✅ covered | 刚点添加还没填的空行按「内容为空」报错，不被悄悄丢掉（S6） |
| partial | E2 折叠卡 | ✅ covered | 折叠的卡里有错误时，头部显示 `有 {n} 处要改`，保存时自动展开（S3、S6） |
| overflow | E2/E4/E6 卡片头 | ✅ covered | 名称超长时单行省略，`title` 放全名；摘要和 `上移` `下移` 不被挤出（`min-width:0`，S3） |
| overflow | E9 保存栏 | ✅ covered | 提示行允许换行，按钮不换行；375px 下提示行宽约 200px，最长的 `登录已过期，重新登录后再保存` 一行放得下（S2） |
| overflow | E10 对话框 | ✅ covered | `#cf-body` 加 `max-height:50vh;overflow:auto`，D-08 列表最多 8 段加 `还有 {n} 项`；窄屏三个按钮竖排全宽（S10） |
| overflow | E1/E3/E8 页面 | ✅ covered | 20 个组加 50 项任务靠页面滚动加折叠；保存栏粘性，不用内部滚动区（S1、S2、S3） |
| zero-one-many | E3 任务行列表 | ✅ covered | 只有一项时 `上移` `下移` 都 `disabled`；第一项的 `上移`、最后一项的 `下移` `disabled`；计数 `{n}/50` 在 0、1、多项下都读得通（S4） |
| zero-one-many | E2/E4 卡片 | ✅ covered | 同上，在未归档的组或力量项之间重排；数量满时 `＋ 添加…` `disabled` 加 `最多 {上限} 个`（S5、S6） |
| zero-one-many | E7/E8 已归档区 | ✅ covered | 摘要 `已归档（{n}）` 显示数量；1 个和多个同一写法，无复数问题（S11、S13） |
| long-text | E3 任务行 | ✅ covered | 任务内容最长 200 字，输入框单行横向滚动，达到 160 字显示 `{n}/200` 计数；确认框里引号内文字超过 30 字截断（S5、S7） |
| long-text | E2 组名、备注 | ✅ covered | 组名最长 40 字；备注文本域 `maxlength="200"` 可竖向拉伸（S5） |
| long-text | E8/E11 与日历、时间线标签 | ✅ covered | `.tag` 单行省略（`max-width:12em`），归档组的组名可能很长（S11） |
| long-text | E10 toast | 🧪 backstop | 带按钮的 `已从草稿移除：{短名}` 和 `计划已保存，别的设备上的那一版已在本机留底` 在 375px 下完整显示、可换行、按钮可点；验收时在手机宽度截图核对 |
| partial | E10 D-08 | ✅ covered | 项数超过 8 时显示 `还有 {n} 项`，两个确认按钮对全部项生效（S9） |
| zero-one-many | E6 预设标签 | ✅ covered | 每类别最多 20 个标签，满了 `＋ 添加标签` `disabled`；同类别不允许重复标签（S5） |
| error | E7 恢复 | ✅ covered | 恢复会超出数量上限时 `恢复` `disabled`，旁边文字说明先删掉一个（S6） |
| loading | E1 入口 | ✅ covered | 对账中入口 `disabled`（现有门控），对账完成后恢复，不额外加加载态（S1） |
| populated | E4 力量项列表 | ✅ covered | 最多 8 张折叠卡，默认折叠，头部摘要 `{目标值} {单位}`（S3、S5） |
| partial | E4 力量项卡 | ✅ covered | 名称、单位为空或目标值不是正数时就近提示（`请填写力量项名称`、`请填写单位` 等），不能保存（S6） |
| long-text | E4 力量项字段 | ✅ covered | 名称 `maxlength="40"`、单位 8、备注 200，超出被截断；卡片头名称单行省略（S3、S5、S6） |
| long-text | E5 健身说明 | ✅ covered | `健身说明` 文本域 `maxlength="200"`（S5） |
| populated | E6 预设标签 | ✅ covered | 每个类别最多 20 个标签，类别卡摘要 `{n} 个标签`，展开后每个标签一行（S5、A9） |
| partial | E6 预设标签 | ✅ covered | 标签为空时提示 `请填写标签内容`，不能保存（S6） |
| long-text | E6 预设标签 | ✅ covered | 每个标签 `maxlength="30"`，超出被截断（S5、S6） |
| populated | E7 编辑页已归档区 | ✅ covered | 默认折叠，摘要 `已归档（{n}）`；展开后按 `目标组`、`任务`、`力量项` 分组，有哪组才显示哪组（S13） |
| partial | E7 编辑页已归档区 | ✅ covered | 所属组也已归档的任务不单独列出，跟着组走；组恢复后，之前单独归档的任务作为「任务」留在这个区里（S13） |
| overflow | E7 编辑页已归档区 | ✅ covered | 每行名称单行省略，`title` 放全名，`恢复` 和 `彻底删除…` 按钮不被挤出（S13） |
| long-text | E7 编辑页已归档区 | ✅ covered | 同上，长组名、长任务文字单行省略（S13） |
| partial | E8 目标页已归档区 | ✅ covered | 归档的组带着它的任务和自定义待办一起显示；所在组没归档的任务单列在 `已归档的任务`；找不到所属组的待办单列在 `没有所属目标组的待办`（S11） |
| long-text | E9 保存栏 | ✅ covered | 提示行允许换行，最长的容量超限提示在 375px 下可换到 3 行，保存栏随之长高，按钮垂直居中（S2） |
| populated | E10 D-08 询问框 | ✅ covered | 每项一段，写明类型、文字和进度（`任务「{文字}」（已完成）` 等），最多 8 段（S9） |
| zero-one-many | E10 D-08 询问框 | ✅ covered | 1 项和多项同一写法；超过 8 项写 `还有 {n} 项`；没有这种项时不弹框（S9） |
| overflow | E12 本周页提示 | ✅ covered | 一行说明在窄屏自然换行，不截断（S12） |
| long-text | E12 本周页提示 | ✅ covered | 固定文案，在 375px 下最多换成两行（S12） |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

不适用（已排除，附理由）：
- E5 健身目标 · empty：三个字段永远有值（打开时带出当前计划的值），没有空状态。
- E5 健身目标 · loading：编辑页从内存里的计划构建草稿，没有异步加载。
- E2/E3/E4/E6 · loading：同上，草稿同步构建；排序、删除、归档都是同步改草稿。
- E7/E8 · loading：同上。
- E10 对话框 · loading：对话框本身没有异步动作；确认后的保存由 E9 的 `保存中…` 和状态行承担。
- E11/E12 · error：静态说明和按钮，没有可失败的加载或提交；按钮之后的错误由编辑页覆盖。
- E1 入口 · overflow：单个固定短文字按钮。
- E9 保存栏 · zero-one-many：按钮数量固定为两个。
- E1 入口 · long-text：按钮文字固定为 `编辑计划`，不随数据变化。
- E8 目标页已归档区 · error：只读显示内存里的数据，没有加载或提交，不会失败。
- E10 对话框 · empty：对话框只在有内容时打开（D-08 没有这种项时不弹，S9）。
- E11 空计划卡片 · loading / populated / partial / overflow / zero-one-many：一张静态说明卡加两个固定按钮，不显示数据列表；说明文字在窄屏自然换行。

补充（不属于上面的状态分类）：编辑页、空计划卡片和已归档区都只用已有 token，深色主题自动一致；验收时用 `colorScheme:'dark'` 打开编辑页（含展开的卡片和折叠状态）、冲突三选一框和目标页已归档区各看一眼。

---

## 无障碍与动效

- **结构**：每个分区 `<section aria-labelledby>`，分区标题是 `h3`，页面标题是 `h2`；折叠卡头部是真 `<button aria-expanded aria-controls>`，展开内容 `role="group"` 且 `aria-labelledby` 指向卡片名称；任务和标签用 `<ul>/<li>`；已归档区用原生 `<details>/<summary>`。
- **键盘**：Tab 顺序按视觉顺序：保存栏（放弃这次修改 → 保存计划）→ 各分区；卡片头部里先是折叠开关，再是 `上移` `下移`；行内先输入框再 `上移` `下移` `删除`。Enter 或 Space 触发折叠开关。Esc 关闭对话框（等同安全按钮）。第一项 `上移`、最后一项 `下移` 用 `disabled` 移出 Tab 顺序。
- **焦点**：进入编辑页焦点到 `h2#pe-title`；添加项后焦点到新项的第一个输入框；直接移除后焦点到下一行输入框（没有则上一行，再没有则 `＋ 添加…`）；**排序后焦点留在被移动那一行的同一个按钮上**（行重排后重新聚焦同一 `上移`/`下移`；如果这个按钮因到达首尾变成 `disabled`，焦点改到同一行的另一个排序按钮，再没有就到那一行的输入框）；校验失败焦点到第一个错误字段；离开编辑页焦点回到 `#planEditBtn`；对话框关闭后焦点回到触发它的按钮（沿用 `confirmBox`）。全部沿用全局 `:focus-visible` 焦点环（2px `--c-lang`）。
- **读屏**：一个常驻的 `<div id="pe-live" class="sr-only" aria-live="polite">`，操作之后写入一句话：`已上移：{名称}，现在是第 {k} 项，共 {n} 项`、`已下移：…`、`已从草稿移除：{名称}`、`已归档：{名称}`、`已恢复：{名称}`、`已添加：新的目标组`；`#pe-hint` 是 `role="status"`（断网、联网、过期、校验数量变化都会被读出）；`#pe-notice` 不是 live 区域（避免和 `#pe-hint` 重复朗读）；现有 toast 保持 `aria-live="polite"`。
- **标签**：每个字段有可见 `<label>`（任务行和标签行用 `.sr-only` 的 label `任务 {n}`、`标签 {n}`，行号可见）；错误通过 `aria-describedby` 关联，字段 `aria-invalid="true"`；上下移、删除的 `aria-label` 带上对象名称。
- **触控**：≤560px 所有编辑页控件最小高度 44px（Spacing 例外）；桌面最小 36px。
- **动效**：本阶段没有新增动画。折叠、展开、重排都是瞬时的，不加过渡；现有 `@media (prefers-reduced-motion:reduce){*{transition:none !important}}` 已覆盖。
- **窄屏**：单列；卡片头部在窄屏下摘要换到名称下一行（`flex-wrap`），`上移` `下移` 保持在头部右侧；任务行按 S4 折成两行；对话框三个按钮竖排。断点沿用现有 900 / 820 / 720 / 560，不新增断点。
- **深色主题**：只用现有 token，无单独处理。

---

## CSS 骨架（给执行器的选择器与关键规则，数值已按上面的 Spacing/Typography 定好）

```css
/* editor page: only inside the scopes below, nothing here changes the existing views.
   Existing .ghost/.primary/.danger/.panel/.seg/.empty/dialog#confirm global rules stay untouched; these scoped overrides put the new surfaces on the 4-multiple grid and on the 12/14/16/24 sizes */
:is(#tab-plan,.goals-bar,.pe-empty,.arch,dialog#confirm.pe) :is(.ghost,.danger){padding:8px 12px;font-size:14px}
:is(#tab-plan,.pe-empty,dialog#confirm.pe) .primary{padding:8px 16px;font-size:14px}
#tab-plan .panel{padding:16px}
#tab-plan .seg{gap:8px} #tab-plan .seg button{padding:8px 12px;font-size:14px}
#tab-plan .empty,.pe-empty .empty{padding:8px 0}
dialog#confirm.pe{padding:24px}
dialog#confirm.pe #cf-body p+p{margin-top:8px}
@media (max-width:560px){dialog#confirm.pe{padding:24px 24px calc(24px + env(safe-area-inset-bottom,0px))}}
.arch .group{padding:16px} .arch .group-h{gap:8px} .arch .group-h h3{font-size:16px;font-weight:600}
.arch .group-h .cnt,.arch .note,.arch .task .meta,.arch .lift .hist,.arch .lift .lv small{font-size:12px;font-weight:400}
.arch .task{gap:8px} .arch .task .meta{gap:8px} .arch .task .tt{font-size:14px;font-weight:400}
.arch .bar{margin:8px 0} .arch .lift .ln{font-size:14px;font-weight:600}
.arch .lift .lv{font-size:16px;font-weight:600}
.sr-only{position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#tab-plan{max-width:800px;margin:0 auto;padding-bottom:32px}
#tab-plan .pe-head h2{font-family:var(--serif);font-weight:600;font-size:24px;line-height:1.2;margin:0}
#tab-plan .pe-head p{font-size:14px;color:var(--muted);margin:8px 0 0}
#pe-bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:3;display:flex;align-items:center;gap:12px;margin:16px 0;padding:12px 0;background:var(--paper);border-bottom:1px solid var(--line)}
#pe-hint{flex:1 1 auto;min-width:0;font-size:12px;line-height:1.55;color:var(--muted)}
#pe-hint[data-tone]::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--tone,var(--muted));margin-right:8px}
#pe-hint[data-tone="warn"]{--tone:var(--c-job)} #pe-hint[data-tone="error"]{--tone:var(--red)}
#pe-save[aria-disabled="true"]{opacity:.4;cursor:not-allowed}
#pe-notice{margin:0 0 16px}                                   /* reuses .syncbar */
.pe-sec{margin-top:24px}
.pe-sec>h3{display:flex;align-items:baseline;gap:8px;font-family:var(--serif);font-weight:600;font-size:16px;line-height:1.2;margin:0 0 8px}
.pe-count,.pe-sec .sub,.pe-sum,.pe-lim{font-family:var(--sans);font-weight:400;font-size:12px;color:var(--muted)}
.pe-card{background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--c,var(--line));border-radius:12px;margin-bottom:8px}
.pe-card-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px}
.pe-toggle{flex:1 1 160px;min-width:0;display:flex;align-items:baseline;gap:8px;min-height:36px;padding:0;background:none;border:0;text-align:left;color:var(--ink);font-family:var(--serif);font-weight:600;font-size:16px;line-height:1.2}
.pe-toggle .pe-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-chev::before{content:"▸"} .pe-toggle[aria-expanded="true"] .pe-chev::before{content:"▾"}
.pe-bad{font-size:12px;color:var(--red)}
.pe-body{padding:0 16px 16px}
.pe-body[hidden]{display:none}
.pe-body label.f{display:grid;gap:4px;font-size:12px;color:var(--muted);margin-bottom:12px}
#tab-plan :is(input[type=text],input[type=number],textarea){font-size:16px;line-height:1.55;width:100%;min-width:0;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink)}
#tab-plan [aria-invalid="true"]{border-color:var(--red)}
#tab-plan .tagpill{background:var(--s);color:var(--ink)}     /* category pill: text is --ink, never --c */
.pe-rows{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pe-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:8px;align-items:start}
.pe-row .pe-n{font-size:12px;color:var(--muted);padding-top:12px;text-align:right}
.pe-act{display:flex;gap:4px}
#tab-plan .pe-act button{font-size:12px;min-height:36px;padding:4px 8px}   /* (1,1,1): wins over the shared override above */
.pe-err{grid-column:2 / -1;margin:0;font-size:12px;color:var(--red)}
.panel.pe-empty{padding:24px}
.panel.pe-empty h3{font-family:var(--serif);font-weight:600;font-size:16px;line-height:1.2;margin:0 0 8px}
.pe-empty p{font-size:14px;margin:0 0 16px}
.pe-empty-act{display:flex;flex-wrap:wrap;gap:8px}
.goals-bar{display:flex;justify-content:flex-end;margin-bottom:12px}
.arch>summary{min-height:36px;padding:8px 0;font-size:14px;color:var(--muted);cursor:pointer}
.group.arch-g,.lift.arch-l{--c:var(--c-oth);--s:var(--c-oth-s);color:var(--muted)}
.arch-mark{font-size:12px;padding:0 8px;border:1px solid var(--line);border-radius:4px;color:var(--muted)}
.task.ro{grid-template-columns:1fr auto}
.tag{max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:560px){
  #tab-plan :is(input,textarea,.seg button,.pe-toggle),#tab-plan .pe-act button,#pe-bar button,#planEditBtn,.pe-empty-act button{min-height:44px}
  .pe-row{grid-template-columns:24px minmax(0,1fr)}
  .pe-act{grid-column:2}#tab-plan .pe-act button{flex:1}
  .pe-empty-act button{flex:1 1 100%}
}
```

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none（Tool: none） | not required |
| 第三方 registry | none | not applicable |

本阶段不引入任何新的外部代码和资源；唯一的外部代码仍是 Phase 9 已批准、同源加载并钉 sha256 的 PocketBase SDK（不属于 UI 组件审查范围）。

---

## Assumptions (Claude's choice)

没有渠道向所有者提问；下列是 12-CONTEXT.md 没有规定、按"与已锁定决定和 09-UI-SPEC 最一致"选的做法。所有者有不同意见时改这里即可，planner 以这里为准。

| # | 选择 | 理由 |
|---|------|------|
| A1 | 编辑页保留顶部标题区、`#syncbar` 和 `nav.tabs`，四个标签都不选中；点标签先过离开确认 | D-09 把"切换标签"列为离开路径；不加第五个标签 |
| A2 | 所有卡片（组、力量项、预设类别）默认折叠，新添加的自动展开 | 20 个组加 50 项任务时一屏能扫读和调顺序；校验失败会自动展开出错的卡 |
| A3 | 排序按钮是文字「上移」「下移」，在同级里重排，到头禁用 | 手机上可靠（FEATURES），对非技术用户比箭头清楚；符合路线图"不做拖拽" |
| A4 | 粘性保存栏放在页面**顶部**，提示行与保存计划、放弃这次修改同一行 | 底部会盖住带按钮的 toast；一处集中显示断网、过期、校验、冲突的原因 |
| A5 | 保存按钮在断网、过期时用 `aria-disabled`（可聚焦，点击弹 toast 说明），没有修改时才用真 `disabled` | 键盘和读屏用户能读到原因；11-UI-REVIEW 的"静默失效"教训 |
| A6 | 编辑页断网时可以打开、可以改草稿，只是不能保存 | Claude's Discretion 建议；D-11 只管点保存的那一刻 |
| A7 | 点 `放弃这次修改` 在有未保存修改时也弹离开确认 | 防止在手机上误触丢掉长时间的修改；D-09 只列了切换标签、返回键、退出登录，这里扩到「放弃这次修改」按钮（所有者 2026-11-11 确认） |
| A8 | 校验：数量上限靠添加按钮满时禁用，长度上限靠 `maxlength`，空值和数值在失焦后或点保存后报错 | 不出现"超长但不让保存"；不刚输入就红 |
| A9 | 备注 `maxlength` 200、每个类别基础标签最多 20、每周健身天数限 0–7 整数 | D-17 没写这三项；与任务文字上限、标签输入框现有 `maxlength="30"`、一周只有七天保持一致（所有者 2026-11-11 确认） |
| A10 | 归档项不占数量上限；恢复会超出上限时 `恢复` 禁用 | 否则归档的旧项会永远占着名额；文档体积由 4 MB 保护兜底（所有者 2026-11-11 确认） |
| A11 | 恢复：组和力量项排到最后，任务排到原组末尾；所属组也已归档的任务跟着组走，不单独列出 | Claude's Discretion 建议；避免"恢复了任务但组不在"的状态 |
| A12 | 归档确认按钮用 `.primary`（给 `confirmBox` 加 `okClass`），彻底删除、覆盖、放弃用 `.danger` | 归档可恢复，不应该和不可逆操作一样红 |
| A13 | D-08 询问框一个框列全部、三个按钮（回去继续改 / 全部归档 / 连进度一起删），多于 8 项折叠成 `还有 n 项` | Claude's Discretion 建议；加"回去继续改"是为了不强迫选择 |
| A14 | 冲突三选一框里「放弃我的修改，用新版」后**离开编辑页**回到目标页 | 与放弃修改一致、不需要重建草稿；想在新版上继续改，再点一次 `编辑计划`（所有者 2026-11-11 确认） |
| A15 | 编辑页打开期间，全局远端更新横幅换成无按钮的变体 `…保存或放弃计划编辑后会自动更新。` | `现在更新` 会应用远端计划，换掉正在编辑的基础 |
| A16 | `载入示例计划` 载入到**草稿**（要保存才生效），只载入目标组和力量项，所有项用全新 id；只在没有未归档的组和力量项时出现 | 与草稿式编辑一致；复用示例 id 会撞上归档项、接上旧进度 |
| A17 | 归档的组和日历、时间线、CSV 里显示组名，未归档的组显示 `P{n}`，找不到组的显示 `未知目标组` | 归档的组没有编号（编号只数未归档的组）；Claude's Discretion（所有者 2026-11-11 确认） |
| A18 | 本周页空计划提示一行文字，其余照常 | 本周页的计数不依赖组；只需要告诉用户为什么这里是空的 |
| A19 | 刷新时直接打开 `#plan`：云端版在对账后重新打开编辑页（新草稿），本地版和未登录回到目标页 | D-09 草稿不跨刷新保留；D-13 本地版没有入口 |
| A20 | 基础标签与用户自己加的标签重名时，`presetsFor` 去重只留基础的；基础列表内同类别不允许重复 | Claude's Discretion；避免出现两个相同的标签按钮 |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG（不阻断：行内 `上移` `下移` `删除` `恢复` 只有动词，对象由同一行提供，`aria-label` 写全）
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS（Tool: none，无组件清单，不适用）

**Approval:** approved 2026-11-11（gsd-ui-checker 第 2 轮复核；第 1 轮的 2 个 BLOCK 已在修订 1 中解决，复核提出的 3 处文字问题已由编排者顺手修正）
