---
phase: "14"
slug: plan-onboarding
status: draft
shadcn_initialized: false
preset: none
created: "2026-11-12"
---

# Phase 14 — UI Design Contract（新账号的计划起步）

> 本阶段在现有单文件应用上**只增加**：目标页空计划卡片里的一对新按钮、一个新的「从示例里挑」挑选对话框 `dialog#sample`、编辑计划页里一个随时可用的「从示例添加」入口，以及配套文案。本周、日历、时间线三个视图和目标页有计划时的外观不变；不碰健身界面（Phase 15），不改 5 个固定类别。
> 全部文案为简体中文，代码、选择器、标识符保持英文。示例名称是 `DEFAULT_PLAN` 里的通用占位，可以直接显示；文案里不出现任何真实计划文字、人名、服务器地址、域名。
> 上游来源：14-CONTEXT.md（D-01 到 D-09 已锁定，本文件不重新讨论；Claude's Discretion 各项在本文件定稿，见文末 Assumptions）；12-UI-SPEC.md（令牌、间距、字号、按钮层级、焦点、`dialog#confirm` 与底部面板规则、文案语气，本阶段原样沿用并扩展）；12-UI-REVIEW.md（要避开的问题：选中态用类别色当底色、禁用按钮看起来可用、点击区域小于 44px、作用域外的字号）；现有 `us-journey-tracker.html` 的样式与渲染函数。
> 范围提醒：只做云端版（`CLOUD&&me`）。本地版没有这些按钮，仍然显示示例计划（SEC-04、12 D-13）。

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none（原生 HTML/CSS/JS 单文件；`components.json` 不存在，已用 `ls components.json` 核对）。shadcn gate：不适用，技术栈不是 React/Next.js/Vite |
| Preset | not applicable |
| Component library | none |
| Icon library | none（不引入图标；只用文字按钮和浏览器自带的复选框） |
| Font | 标题 `var(--serif)`，正文 `var(--sans)`（与现有一致，不新增字体，不加载外部资源） |

复用现有组件：`.panel.pe-empty`、`.primary`、`.ghost`、`.seg` 的类别色变量（`.k-lang/.k-pro/.k-fit/.k-job/.k-oth` 提供 `--c`/`--s`）、`.arch-mark` 的描边小标记外观、`.pe-count`、`.pe-lim`、`<dialog id="editor">` 的底部面板做法、`toast()`、`#pe-live`。唯一的新组件是 `dialog#sample`（一个独立的 `<dialog>`，不是 `confirmBox`：它装的是复选框列表，不是文字段落）。

**本阶段不新增任何颜色 token**，深色、浅色（`prefers-color-scheme` 和 `[data-theme]`）自动一致。

**CSP 约束（硬性）**：模板字符串里不写任何 `style=""` 属性；对话框高度、行布局全部靠 `<style>` 块里的 class 规则；挑选列表的每一行只带 class 和 `data-*`，没有动态尺寸。

---

## Spacing Scale

只用 4 的倍数，与 12-UI-SPEC 一致。

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | 行内小标记之间的上下间隙、说明行与名称之间 |
| sm | 8px | 行与行之间、按钮与按钮之间、图例与列表之间 |
| 12 | 12px | 复选框与文字之间、底部栏内控件的间隙 |
| md | 16px | 对话框内分区之间、挑选行的左右内边距、底部栏上内边距 |
| lg | 24px | 对话框内边距、两个分区之间 |
| xl | 32px | 不使用 |
| 2xl | 48px | 不使用（桌面对话框与屏幕上下留白合计 48px，写在 `max-height` 里） |
| 3xl | 64px | 不使用 |

Exceptions:
- 复选框本身 20×20px（4 的倍数）。
- 触控目标：≤560px 时，挑选行、底部栏两个按钮、空计划卡片两个按钮最小高度 44px；桌面最小 36px（与 12 一致）。整行是一个 `<label>`，点行内任何位置都能勾选，所以点击区域是整行，不是 20px 的方框。
- 所有新增间距都落在 4 的倍数上，没有"继承的奇数值"例外。`.ghost`、`.primary` 在新作用域里用覆盖规则落到 `8px 12px` 和 `8px 16px`（见 CSS 骨架），不改全局规则。
- `dialog#sample` 自己的 `padding:0`，内边距拆给头、体、脚三块各自管，这样体可以单独滚动。

---

## Typography

新界面只用 **3 个字号（12、14、16）、2 个字重（400、600）**，是 12-UI-SPEC 那 4 个字号（12、14、16、24）的子集（本阶段没有 24px 标题）。规则限定在 `.pe-empty`、`dialog#sample`、`#tab-plan .pe-tools` 里。

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / 图例（分区小标题）/ 计数 / 任务数和目标值 / 类别小标记 / 「计划里已有同名」标记 / 底部提示行 / 原因提示行 | 12px | 图例 600，其余 400 | 1.55 |
| Body（对话框说明、空计划卡片正文、按钮文字、挑选行里的名称） | 14px | 名称 600，其余 400；`.primary` 600 | 1.55 |
| Heading（对话框标题、空计划卡片标题） | 16px | 600（衬线 `var(--serif)`） | 1.2 |

说明：
- 作用域里不出现 11、13、15、17、18、19、24、28px 和 700、800 字重。
- 对话框标题与 `dialog#confirm .ed-h h3` 一致（16px 600 衬线）；分区图例用 12px 600 `--muted`，比 14px 600 的行内名称小，层级清楚：标题 > 名称 > 图例和说明。
- 所有示例名称、类别文字用 `esc()` 写入。

---

## Color

沿用现有调色板，60/30/10：

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `var(--paper)` | 页面背景 |
| Secondary (30%) | `var(--surface)` | 空计划卡片、`dialog#sample` 底色、挑选行底色 |
| Accent (10%) | `var(--c-lang)` | 见下面 reserved 清单（本阶段不新增 accent 用途） |
| Destructive | `var(--red)` | 本阶段**不使用**：往计划里添加东西不是破坏性操作，也没有确认框 |

Accent reserved for：
1. 键盘焦点环（全局 `:focus-visible`，不变；挑选行另加一圈同色行焦点环，见 CSS 骨架）。
2. 现有类别色（`.k-lang` 等）的现有用途，不变。
3. 状态行 `已同步` 小圆点（现有，不变）。

本阶段的颜色规则：
- **选中态不靠类别色当文字底**（12-UI-REVIEW Top 1）：被勾选的挑选行用 `--s`（浅色底）加 `--ink` 文字，边框换成 `--c`；类别色只出现在 4px 左边框、类别小标记的边框和选中行的底。文字一律 `--ink` 或 `--muted`。选中与否不只靠颜色：复选框本身有对勾，读屏读 `checked`。
- 复选框 `accent-color:var(--ink)`（深色实心加反色对勾，浅深两个主题都清楚），不用 accent。
- 「计划里已有同名」标记：描边 `--line`，文字 `--muted`，与 `.arch-mark` 同一外观；不用警告色（它不是错误，仍然可以再加）。
- 警告色 `var(--c-job)` 只用于圆点（空计划卡片上的原因提示、对话框底部提示行的圆点），不作文字色，不作整块底色。
- 空计划卡片的焦点：卡片里唯一的深色块是 `自己建一份`（`.primary`，`--ink` 底）；`从示例里挑` 是 `.ghost` 浅色描边。挑选对话框里唯一的深色**按钮**是确认按钮；列表里勾上的复选框（`accent-color:var(--ink)`）也是深色小块，但它们是列表内的状态标记，不和按钮争焦点，列表里没有别的深色元素。
- 禁用外观（12-UI-REVIEW Top 2）：`opacity:.4;cursor:not-allowed`，且悬停不变色；真 `disabled` 和 `aria-disabled="true"` 两种写法都要覆盖到（见 CSS 骨架）。

---

## Surfaces

### S1 目标页空计划卡片（改 12-UI-SPEC S11 第 6 项）

```html
<div class="panel pe-empty">
  <h3>计划是空的</h3>
  <p>目标页还没有目标组和力量项。你可以自己建一份，也可以从示例里挑需要的，没挑的不会加进来。</p>
  <div class="pe-empty-act">
    <button type="button" class="primary" id="planEditBtn2">自己建一份</button>
    <button type="button" class="ghost" id="planSampleBtn" aria-describedby="planSampleWhy">从示例里挑</button>
    <p class="pe-why" id="planSampleWhy" role="status"></p>
  </div>
</div>
```

- **层级**：`自己建一份` 是主按钮（`.primary`，卡片里唯一的深色块），`从示例里挑` 是次按钮（`.ghost`）。顺序先主后次，与 14-CONTEXT D-04 的写法一致。按钮 id 沿用 `planEditBtn2`、`planSampleBtn`（只改文字和行为，降低测试改动量）。
- **`自己建一份`**：行为同现在的 `编辑计划`（`goPlan()`，进编辑计划页）。断网和登录过期时**仍然可用**（编辑页断网可打开可改草稿，12 A6）。
- **`从示例里挑`**：打开挑选对话框（卡片模式，见 S2、S3）。
- **断网或登录过期时（Claude's Discretion 定稿：变灰加说明，不是点了再提示）**：
  - 判断沿用保存栏同一个函数 `peBlock()`（`net==="expired"` 优先，其次状态行 `data-state` 为 `offline`、`retrying`、`unreachable`、`slow`）。
  - 被挡住时按钮用 `aria-disabled="true"`（不用 `disabled`），保持在 Tab 顺序里，外观 `opacity:.4;cursor:not-allowed`，悬停不变色；`#planSampleWhy`（`role="status"`，12px `--muted`，前面 8px `--c-job` 圆点）写出原因：断网 `联网后才能从示例里挑`；过期 `登录已过期，重新登录后才能从示例里挑`。没被挡住时 `#planSampleWhy` 为空，用 `:empty{display:none}` 隐藏（元素始终在 DOM 里，读屏才能读到后来变化的文字）。
  - 点击或按 Enter 不打开对话框，只弹 toast 重复同一句原因（`ms=3000`），与 12 的保存按钮一致。
  - 联网或重新登录后，说明消失、按钮恢复；这个更新由状态行变化时同一处触发（和 `peBar()` 刷新保存栏的触发点一致），不依赖整页重绘。
  - **全局门控**（对账中、连不上只读，`data-gate`）仍由现有 `applyGate` 把它设成真 `disabled`（变淡），原因在顶部横幅，不另写说明（沿用 12 S1）。门控优先于断网说明：门控期间不显示 `#planSampleWhy`。
- **窄屏**（≤560px）：两个按钮各占一行全宽，主按钮在上，最小高度 44px；`#planSampleWhy` 在按钮下面占一整行。桌面两个按钮同一行，间距 8px，原因行换到按钮下面。
- 卡片其余规则沿用 12：24px 内边距，标题 16px 600 衬线，正文 14px，卡片之后仍显示「已归档」区（如果有）。
- 本地版（`!(CLOUD&&me)`）：按钮整行不渲染，同现状。

### S2 挑选对话框 `dialog#sample`（新）

**形式（Claude's Discretion 定稿）**：桌面是居中的模态对话框，宽 `min(520px,calc(100vw - 24px))`；≤560px 是贴底的底部面板（同 `dialog#editor` 的做法：`margin:auto 0 0;width:100vw;border-radius:14px 14px 0 0`），最高 90% 屏高。内容多时**只有中间的列表滚动，标题和底部按钮始终可见**（对话框 `display:flex;flex-direction:column`，最大高度桌面 `100vh - 48px`、窄屏 90vh，列表区 `overflow:auto`）。

**结构**（自上而下）：

```html
<dialog id="sample" aria-labelledby="pk-title" aria-describedby="pk-desc">
  <form method="dialog">
    <div class="pk-head"><h3 id="pk-title">从示例里挑</h3><p id="pk-desc">…</p></div>
    <div class="pk-body">
      <fieldset class="pk-sec"><legend>目标组<span class="pe-count">共 7 个</span></legend>
        <p class="pe-lim pk-lim" id="pk-lim-g" hidden></p>
        <ul class="pk-list">
          <li><label class="pk-item k-pro"><input type="checkbox" data-pk="g:P2" aria-describedby="pk-d-g-P2">
            <span><span class="pk-name">编程基础复习</span>
            <span class="pk-meta" id="pk-d-g-P2"><span class="pk-chip">专业</span><span>12 项任务</span><span class="pk-dup">计划里已有同名组</span></span></span></label></li>
        </ul></fieldset>
      <fieldset class="pk-sec"><legend>力量项<span class="pe-count">共 4 个</span></legend>…
        <label class="pk-item k-fit">…<span class="pk-name">卧推</span><span class="pk-meta"><span>目标 40 kg</span></span>…</fieldset>
    </div>
    <div class="pk-foot"><p id="pk-hint" role="status"></p><button type="button" class="ghost" id="pkCancel">先不添加</button><button type="button" class="primary" id="pkOk" aria-disabled="true" aria-describedby="pk-hint">添加并保存</button></div>
  </form>
</dialog>
```

**标题和说明（按入口不同，两种模式）**

| 模式 | 标题 | 说明（14px `--muted`） | 确认按钮 |
|------|------|------|---------|
| 卡片模式（从空计划卡片进） | `从示例里挑` | `示例是一份通用的样本计划。勾选要用的，点「添加并保存」就加进你的计划；没勾的不会加。` | `添加并保存` |
| 编辑页模式（从编辑页进） | `从示例添加` | `勾选要用的，点「添加所选项」会加到这一页的草稿末尾，点「保存计划」后才生效；没勾的不会加。` | `添加所选项` |

标题和打开它的按钮文字一致，用户能认出自己点的是哪个入口。

**列表内容**（来自常量 `DEFAULT_PLAN`，每次打开时现生成，不缓存；顺序与示例一致）：

- 目标组分区，图例 `目标组` + 计数 `共 {n} 个`（12px 400 muted）。每行：
  - 名称（14px 600，`--ink`，`overflow-wrap:anywhere`，可换行）；
  - 说明行（12px muted，可换行）：类别小标记（描边 `--c`，文字 `--ink`，圆角 999px，如 `专业`）+ `{n} 项任务`；
  - 若计划里已有同名组：再加一个描边小标记 `计划里已有同名组`（见下）。
  - **整组挑**：不能展开逐条挑任务；说明行就是全部信息（D-05）。
- 力量项分区，图例 `力量项` + `共 {n} 个`。每行：名称 + 说明行 `目标 {target} {unit}`（如 `目标 40 kg`）；同名时加 `计划里已有同名力量项`。
- 行外观：`.pk-item`，`--surface` 底，`1px solid var(--line)`，圆角 12px，**左边框 4px `var(--c)`**（组用 `.k-*` 类别色，力量项用 `.k-fit`），内边距 12px 16px，复选框 20px 在左，列间 12px，行间 8px。选中：底色换 `--s`，边框换 `--c`，文字不变。
- 两个分区之间 24px。分区内先是图例，再是（有上限提示时的）一行 `.pk-lim`，再是列表。

**打开时的状态（D-06）**：所有复选框都**不勾**；确认按钮 `aria-disabled="true"`；底部提示行写 `先勾选要加入的项`。每次打开都重置，不记住上次的勾选。

**「计划里已有同名」标记（Claude's Discretion 定稿）**
- 比较对象：目标计划里**未归档**的目标组名（卡片模式是当前计划，编辑页模式是**草稿**，包括本次编辑中已经从示例加进来的）；力量项按名称同理。比较前去掉首尾空格，区分大小写，完全相等才算。已归档的同名项不算。
- 标记文字：目标组 `计划里已有同名组`；力量项 `计划里已有同名力量项`。12px 400 `--muted`，描边 `--line`，圆角 4px，内边距 `0 8px`（与 `.arch-mark` 同一外观）。是文字，不只是颜色。
- **仍然可以勾选再加一份**，复选框不禁用；读屏通过 `aria-describedby` 读到说明行和标记。
- 不改计划文档的形状（不加「来自示例」字段）。

**数量上限（12 D-17，防止加到超限）**
- 对话框打开时算出目标里还剩多少名额：目标组 `20 − 未归档组数`、力量项 `8 − 未归档力量项数`（归档项不占名额，12 A10）。
- 某个分区里已勾选的项数等于剩余名额时，该分区**其余未勾选的行变为真 `disabled`**（`opacity:.4;cursor:not-allowed`），取消一个勾选后恢复。
- 分区图例下出现一行 `.pk-lim`（12px muted），说明原因：名额还有但示例比名额多时 `目标组最多 20 个，还能再加 {k} 个`；名额为 0 时 `目标组已满（20 个），先删掉一个再添加`。力量项同理，数字换成 8。没有这种情况时这一行不渲染（`hidden`）。
- 被禁用的复选框 `aria-describedby` 指向这一行，读屏能知道原因。

**底部栏 `.pk-foot`**
- 左：`#pk-hint`（`role="status"`，12px muted，`flex:1 1 160px;min-width:0`，允许换行）。右：`先不添加`（`.ghost`，`id="pkCancel"`）、确认按钮（`.primary`，`id="pkOk"`）。
- 确认按钮不可用时用 `aria-disabled="true"`（不用 `disabled`），保持在 Tab 顺序里，`aria-describedby="pk-hint"`，点击或按 Enter 不执行；原因就在旁边的提示行，所以不另弹 toast（仅"被挡住"那两种情况弹，见下表）。
- 提示行按优先级只显示一条：

| 优先级 | 条件 | 提示行文字 | 圆点 tone | 确认按钮 |
|--------|------|-----------|----------|---------|
| 1 | 卡片模式，登录已过期 | `登录已过期，重新登录后再保存` | warn | 不可用，点击弹同一句 toast（`ms=3000`） |
| 2 | 卡片模式，断网、连不上 | `联网后再保存` | warn | 不可用，点击弹同一句 toast |
| 3 | 卡片模式，上一次点确认时计划超过容量上限 | `保存失败：计划超过容量上限（4 MB）。请先删掉一些内容，或联系管理员。` | error | 可用 |
| 4 | 一项都没勾 | `先勾选要加入的项` | 无圆点 | 不可用（无 toast） |
| 5 | 勾了至少一项 | `已选 {g} 个目标组、{l} 个力量项`（为 0 的部分省略，如只勾了目标组写 `已选 2 个目标组`） | 无圆点 | 可用 |

- 优先级 1、2 的文字**逐字复用** 12 保存栏的 `T_PE_HINT_EXPIRED`、`T_PE_HINT_OFFLINE`，优先级 3 复用 `T_PE_HINT_TOOLARGE`，不再另写一套。
- 编辑页模式没有优先级 1、2、3：编辑页模式只改草稿，断网和过期照样可以挑（保存时才受限，12 D-11、D-12）。
- ≤560px：提示行占满一整行（`flex:1 1 100%`），两个按钮在下面一行各占一半宽（`flex:1`），最小高度 44px，底部内边距 `calc(24px + env(safe-area-inset-bottom,0px))`。

**键盘与读屏**
- 对话框用 `showModal()`，`aria-labelledby="pk-title"`、`aria-describedby="pk-desc"`；是普通 `dialog`，不是 `alertdialog`（不是警告类确认）。
- 每个分区是 `<fieldset>` 加 `<legend>`，读屏读出"目标组，分组"，再逐个读复选框。每个复选框的可访问名称是行内名称，说明行和「已有同名」标记通过 `aria-describedby` 读出（如 `编程基础复习，复选框，未选中，专业，12 项任务，计划里已有同名组`）。
- 打开时焦点落在第一个未禁用的复选框（目标组第一行）。Tab 顺序：各复选框 → `先不添加` → 确认按钮。空格键勾选或取消；在复选框上按 Enter 什么都不做（这一页不是靠回车提交）。按钮是 `type="button"`，对话框里的 `<form method="dialog">` 不会被回车提交。
- Esc、点背景都等同 `先不添加`：关闭、不改任何东西、不弹提示。确认按钮正在保存（`aria-busy`）时 Esc 和点背景被忽略（`cancel` 事件 `preventDefault()`），防止保存途中关掉。
- 关闭后焦点回到打开它的按钮（`#planSampleBtn` 或 `#peSampleBtn`）；确认成功后的焦点见 S3、S4。
- 底部提示行是 live 区域，每次勾选变化读出新的 `已选…`（polite）。
- 动效：无动画。选中态是瞬时切换；现有 `prefers-reduced-motion` 规则已覆盖。

### S3 卡片模式确认之后：直接保存（D-07）

不经过编辑页草稿，但**复用编辑页的保存路径**（`savePlanDraft` 的校验、断网和过期限制、冲突处理、容量检查，不另写一套）。流程：

1. 点 `添加并保存`：按钮变 `disabled`、`aria-busy="true"`、文字 `保存中…`，`先不添加` 也不可点；挑选对话框**保持打开**直到出结果。
2. 若被 `peBlock()` 挡住：不保存，提示行显示优先级 1 或 2 的文字，按钮恢复，对话框不关。
3. 目标名额检查（S2 已在界面上拦住，这里是兜底）；用最新本机计划算，超限不保存。
4. 取最新远端版本；**计划被别的设备改过** → 弹冲突三选一（下面的挑选版措辞）。三个出口：
   - `回去继续挑`（`.ghost`，默认焦点，Esc 等同）：关闭这个确认框，回到挑选对话框，勾选保留，什么都不变。关闭前先把第 1 步的忙碌状态撤掉：`添加并保存` 恢复可点（去掉 `disabled` 和 `aria-busy`，文字改回 `添加并保存`），`先不添加` 也恢复可点，Esc 和点背景重新生效；然后焦点回到 `添加并保存`。
   - `放弃我的选择，用新版`（`.danger`）：关闭挑选对话框，应用远端新计划，留在目标页，toast `已改用别的设备上的新计划，你挑的项没有加`（`ms=6000`）。
   - `用我的覆盖`（`.danger`）：继续保存；被盖掉的那一版按 Phase 9 D-10 和 11-09 存成本机留底，成功后 toast 用 12 S9 的 `计划已保存，别的设备上的那一版已在本机留底` + `下载留底`（`ms=8000`），**取代**下面的成功 toast（不叠两条）。留底存不下时走 12 的 `留底没存上` 横幅，成功 toast 照常。
5. 容量超限：不关对话框，提示行显示优先级 3 的文字，按钮恢复。
6. 保存成功：关闭挑选对话框，**留在目标页**，目标页立刻重绘出勾选的组和力量项（卡片被换成正常的目标页，入口行 `.goals-bar` 出现）；弹 toast；焦点移到 `#planEditBtn`（已经渲染出来了；做不到则到 `#goals`，`tabindex="-1"`）。页面不滚动。

**冲突三选一的挑选版措辞**（沿用 12 S9 的结构，只改"草稿"一词：这里没有编辑页草稿）：

| 标题 | `计划在别的设备上改过了` |
|------|------|
| 正文 | `你挑选示例的这段时间里，别的设备保存了新的计划。` / `用我的覆盖：把你挑的项加进你看到的这份计划再保存；别的设备上的那一版会在本机留一份，可以下载。` / `放弃我的选择，用新版：不加你挑的项，改用别的设备上的新计划。` / `回去继续挑：回到挑选列表，什么都不变。` |
| 按钮（从左到右） | `回去继续挑`（`.ghost`，默认焦点，Esc 等同） / `放弃我的选择，用新版`（`.danger`） / `用我的覆盖`（`.danger`） |

用 `confirmBox` 的 `mid` 参数和 `scope:"plan"`（12 S10），不新增对话框能力。确认框叠在挑选对话框上面，关闭后焦点回到挑选对话框里触发它的 `添加并保存`。

**成功 toast（卡片模式）**：`已加入 {g} 个目标组、{l} 个力量项，计划已保存`（为 0 的部分省略：`已加入 3 个目标组，计划已保存`），`ms=4000`。保存途中失败或掉线走现有脏标记加退避重试，状态行照常显示，不弹额外提示（沿用 12 S8）。

**新增项的写入规则（D-08）**：只拷贝勾选的组和力量项；每个组换新的 `g-` id，组里每条任务换新的 `t-` id，每个力量项换新的 `l-` id（沿用 `loadSampleDraft` 的 `peUsedIds` 加 `uid()`），不复用 `P1`、`bench` 等示例 id；追加到未归档组和力量项的末尾；**不带任何快捷词**（D-02），不动 `presets`、`fitGoal`、`fitNote`。组的 `note`、力量项的 `unit`、`def`、`target`、`note` 照示例拷贝。

### S4 编辑计划页的「从示例添加」（新，随时可用）

**位置（Claude's Discretion 定稿）**：放在 `#pe-bar` / `#pe-notice` 下面、第一个分区之前，单独一行 `.pe-tools`：左边 `.ghost` 按钮 `从示例添加`（`id="peSampleBtn"`），右边一句 12px `--muted` 说明 `需要的目标组和力量项，可以随时从示例里挑。`。窄屏下按钮占一整行全宽（44px 高），说明换到下一行。这一行不粘性，随页面滚走。

- 为什么放页面级，而不是目标组分区里：示例里既有目标组也有力量项，一个入口放在"目标组"分区里会让人以为只能加目标组。Tab 顺序仍是保存栏 → 这一行 → 各分区（与 12 无障碍一节一致）。
- **总是可用**：计划不空也能用；断网、登录过期也能用（只改草稿，不保存）。不受 `peBlock()` 影响。
- **取代** 12 里的 `载入示例计划`：目标组分区在空计划时的那个 `.ghost` `载入示例计划`（`data-peact="sample"`）删除；`loadSampleDraft` 的「全部拷贝」改成「只拷贝勾选的项」，供两个入口共用。

**确认之后（编辑页模式）**：
1. 勾选的组和力量项（新 id，规则同 S3）**追加到草稿末尾**，不单独保存。重绘编辑页，保存栏提示行立即变 `有没保存的修改`，保存按钮可用。
2. 新加的卡片**保持折叠**（不像 `＋ 添加目标组` 那样自动展开：一次可能加好几个，全展开会把页面撑得很长）。
3. 关闭挑选对话框。**焦点移到第一个被添加的卡片的折叠开关 `.pe-toggle`**（有组加组，否则是第一个新力量项），并把它滚动到视野中央（`prefers-reduced-motion` 下用 `behavior:"auto"`，不用平滑滚动）。
4. toast `已加到草稿：{g} 个目标组、{l} 个力量项，点「保存计划」后生效`（为 0 的部分省略），`ms=4000`；同时写入 `#pe-live`：`已添加到草稿：{g} 个目标组、{l} 个力量项`。
5. 之后和草稿里的其他修改一样：可以删除、重排、点 `放弃这次修改` 整体撤回；不会单独保存。
6. 如果编辑页上已经有校验错误提示（`pe.tried`），不受影响；新加的项来自合法的示例，不会新增错误。

### S5 其他页面的文字

- **本周页空计划提示**（改 12 S12，因为 `载入示例计划` 已不存在）：`当前计划是空的，这里只统计你记下的内容。可以在「目标」页建一份计划，或从示例里挑。`（Claude's Discretion 定稿：要改。位置、`.empty` 样式、仅空计划时显示，均不变。）
- **目标页局部空提示**（`还没有力量项，可以在「编辑计划」里添加。` / `还没有目标组，可以在「编辑计划」里添加。`）：**不改**。用户进了编辑页就会看到 `从示例添加`，不需要在这两行里再提它。（Claude's Discretion 定稿。）
- **编辑页目标组分区的空提示**（`还没有目标组。`）：不改。
- 登录页、横幅、状态行、四个视图其余文字不动。

---

## Copywriting Contract

新增或改动的所有字符串。每一条对应一个 `T_…` 常量，写进 `tests/support/strings.ts`。命名建议：新增用 `T_PK_` 前缀，改动的沿用原名。**删除** `T_PE_SAMPLE_LOADED`（旧 toast 和旧按钮一起被取代）。

| Element | Copy |
|---------|------|
| Primary CTA（空计划卡片） | `自己建一份`（`T_PE_BTN2`，新；`T_PE_BTN` = `编辑计划` 保留给目标页入口行） |
| Secondary（空计划卡片） | `从示例里挑`（改 `T_PE_SAMPLE_BTN`，原值 `载入示例计划`） |
| Secondary（编辑页） | `从示例添加`（`T_PK_ADD_BTN`，新） |
| Empty state heading | `计划是空的`（不变） |
| Empty state body | `目标页还没有目标组和力量项。你可以自己建一份，也可以从示例里挑需要的，没挑的不会加进来。`（改 `T_PE_EMPTY_BODY`） |
| 卡片按钮不可用原因（断网） | `联网后才能从示例里挑`（`T_PK_WHY_OFFLINE`） |
| 卡片按钮不可用原因（过期） | `登录已过期，重新登录后才能从示例里挑`（`T_PK_WHY_EXPIRED`） |
| 编辑页入口说明 | `需要的目标组和力量项，可以随时从示例里挑。`（`T_PK_TOOLS_NOTE`） |
| 对话框标题 | 卡片模式 `从示例里挑`；编辑页模式 `从示例添加`（`T_PK_TITLE_CARD`、`T_PK_TITLE_EDIT`） |
| 对话框说明 | 卡片模式 `示例是一份通用的样本计划。勾选要用的，点「添加并保存」就加进你的计划；没勾的不会加。`；编辑页模式 `勾选要用的，点「添加所选项」会加到这一页的草稿末尾，点「保存计划」后才生效；没勾的不会加。` |
| 分区图例 | `目标组`、`力量项`；计数 `共 {n} 个` |
| 行说明 | 目标组：类别小标记（如 `专业`）后面接 `{n} 项任务`；力量项：`目标 {target} {unit}`（如 `目标 40 kg`） |
| 已有同名标记 | `计划里已有同名组`；`计划里已有同名力量项` |
| 分区上限提示 | `目标组最多 20 个，还能再加 {k} 个`；`目标组已满（20 个），先删掉一个再添加`；力量项同理（8 个） |
| 底部提示 | 无勾选 `先勾选要加入的项`；有勾选 `已选 {g} 个目标组、{l} 个力量项`（为 0 的部分省略） |
| 确认按钮 | 卡片模式 `添加并保存`（保存中 `保存中…`）；编辑页模式 `添加所选项` |
| 取消按钮 | `先不添加`（两种模式相同；不写泛称的「取消」） |
| Error state（保存不了） | 复用 12：`联网后再保存`；`登录已过期，重新登录后再保存`；`保存失败：计划超过容量上限（4 MB）。请先删掉一些内容，或联系管理员。` |
| Error state（卡片按钮被挡） | 点击时 toast 重复上面两条 `T_PK_WHY_*` 之一 |
| Notice（冲突，卡片模式） | 标题 `计划在别的设备上改过了`；正文和按钮见 S3 的表（`回去继续挑` / `放弃我的选择，用新版` / `用我的覆盖`） |
| 成功 toast（卡片模式） | `已加入 {g} 个目标组、{l} 个力量项，计划已保存`（`T_PK_DONE`） |
| 成功 toast（编辑页模式） | `已加到草稿：{g} 个目标组、{l} 个力量项，点「保存计划」后生效`（`T_PK_DRAFTED`） |
| 放弃新版 toast（卡片模式） | `已改用别的设备上的新计划，你挑的项没有加` |
| 读屏播报（编辑页模式） | `已添加到草稿：{g} 个目标组、{l} 个力量项` |
| 本周页空计划提示 | `当前计划是空的，这里只统计你记下的内容。可以在「目标」页建一份计划，或从示例里挑。`（改 `wkEmpty`） |
| Destructive confirmation | 本阶段没有破坏性操作：往计划里添加东西可以随时在编辑页删除，所以不弹确认框。冲突三选一里的两个 `.danger` 按钮沿用 12 的规则 |

文案原则沿用 12 和 09：用「你」「别的设备」，不用技术词（草稿版本、同步冲突、缓存）；按钮是"动词 + 对象"（`自己建一份`、`从示例里挑`、`添加并保存`、`添加所选项`、`先不添加`），不写泛称的「保存」「取消」「确定」；每条提示说清发生了什么，能自救时说怎么办；示例名称只用 `DEFAULT_PLAN` 里的通用占位。「草稿」一词在 12 里已经使用（`已从草稿移除`），这里沿用。新文案全部列入 Phase 16 总体验收清单，由所有者过目。

`{g}`、`{l}` 是整数，用阿拉伯数字，没有单复数问题（中文）。

### toast 总表（本阶段新增；一律传 `ms`，让云端宽度规则 `.toast[data-cloud]{width:max-content;max-width:calc(100vw - 32px)}` 生效）

| 场景 | 文案 | 按钮 | ms |
|------|------|------|----|
| 卡片模式保存成功 | `已加入 {g} 个目标组、{l} 个力量项，计划已保存` | 无 | 4000 |
| 卡片模式保存成功且覆盖了别的设备的版本 | 12 的 `计划已保存，别的设备上的那一版已在本机留底`（取代上一行） | `下载留底` | 8000 |
| 卡片模式放弃我的选择 | `已改用别的设备上的新计划，你挑的项没有加` | 无 | 6000 |
| 编辑页模式添加到草稿 | `已加到草稿：{g} 个目标组、{l} 个力量项，点「保存计划」后生效` | 无 | 4000 |
| 点了不可用的 `从示例里挑`（断网 / 过期） | `联网后才能从示例里挑` / `登录已过期，重新登录后才能从示例里挑` | 无 | 3000 |
| 点了不可用的 `添加并保存`（断网 / 过期） | `联网后再保存` / `登录已过期，重新登录后再保存` | 无 | 3000 |

12 的 `T_PE_SAMPLE_LOADED` toast（`已载入示例的目标组和力量项，点「保存计划」后生效`）随旧按钮删除。

---

## UI Considerations

> 由 ui-phase 的状态覆盖检查生成。元素共 6 个：E1 目标页空计划卡片的按钮和说明、E2 挑选对话框的目标组列表、E3 挑选对话框的力量项列表、E4 挑选对话框的底部栏（提示行和确认按钮）、E5 编辑页的 `从示例添加` 入口行、E6 本阶段新增的 toast。空状态和错误状态的**文案**在上面的 Copywriting Contract 和 S1 到 S4，这里只交代状态覆盖并引用它们。

Applicable state considerations resolved: 21 covered, 3 backstop, 0 unresolved（另有若干项不适用，理由见表后）

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | E1 空计划卡片 | ✅ covered | 没有未归档的组和力量项时整页换成 `计划是空的` 卡片，给 `自己建一份` 和 `从示例里挑` 两个入口（S1） |
| loading | E1 空计划卡片 | ✅ covered | 对账中、只读时 `从示例里挑` 被现有全局门控设为 `disabled`，原因在顶部横幅；不新增加载态（S1） |
| error | E1 空计划卡片 | ✅ covered | 断网或登录过期时 `从示例里挑` 用 `aria-disabled` 变灰，按钮下方显示原因，点击弹同一句 toast；`自己建一份` 仍可用（S1） |
| long-text | E1 空计划卡片 | ✅ covered | 正文在窄屏自然换行；两个按钮 375px 下各占一行全宽，文字固定且很短（S1） |
| populated | E2 目标组列表 | ✅ covered | 7 个示例目标组，每行有名称、类别小标记、任务数；总高超过屏幕时只有中间列表滚动，标题和底部按钮始终可见（S2） |
| partial | E2 目标组列表 | ✅ covered | 计划里已有同名的组：该行显示 `计划里已有同名组` 标记，仍可勾选再加一份（S2） |
| overflow | E2 目标组列表 | ✅ covered | 名称 `overflow-wrap:anywhere` 可换行；列表区 `overflow:auto`；对话框桌面最大高度 `100vh − 48px`，窄屏 90vh（S2） |
| zero-one-many | E2 目标组列表 | ✅ covered | 勾 0 个时确认不可用，提示 `先勾选要加入的项`；勾 1 个或多个提示 `已选 {g} 个目标组…`；名额不足时多余的行 `disabled` 并说明原因（S2） |
| long-text | E2 目标组列表 | ✅ covered | 名称和说明行都可换行，不截断；类别小标记和任务数在一行放不下时折到下一行（`flex-wrap`，S2） |
| populated | E3 力量项列表 | ✅ covered | 4 个示例力量项，每行有名称和 `目标 {target} {unit}`（S2） |
| partial | E3 力量项列表 | ✅ covered | 同名力量项显示 `计划里已有同名力量项`，仍可勾选（S2） |
| overflow | E3 力量项列表 | ✅ covered | 与目标组共用一个滚动的列表区，两个分区之间 24px（S2） |
| zero-one-many | E3 力量项列表 | ✅ covered | 勾选数量决定提示行；名额 `8 − 未归档力量项数`，满了其余行 `disabled` 加 `力量项已满（8 个），先删掉一个再添加`（S2） |
| long-text | E3 力量项列表 | ✅ covered | 同 E2：名称、说明行可换行（S2） |
| error | E4 底部栏 | ✅ covered | 卡片模式：过期、断网时确认按钮 `aria-disabled` 加对应提示；容量超限留在对话框并显示 `保存失败：计划超过容量上限（4 MB）…`；冲突走三选一，三个出口都有明确结果（S2、S3） |
| loading | E4 底部栏 | ✅ covered | 卡片模式点确认后按钮 `disabled`、`aria-busy="true"`、文字 `保存中…`，`先不添加` 不可点，Esc 和点背景被忽略，防连点和中途关闭（S2、S3） |
| zero-one-many | E4 底部栏 | ✅ covered | 提示行 0 项、仅组、仅力量项、两者都有四种写法，为 0 的部分省略（S2） |
| long-text | E4 底部栏 | ✅ covered | 最长的容量超限提示在 375px 下占满一行并换行，按钮在下一行各占一半宽（S2） |
| overflow | E4 底部栏 | ✅ covered | 窄屏提示行 `flex:1 1 100%`，按钮 `flex:1`，底部内边距含 `env(safe-area-inset-bottom)`（S2） |
| long-text | E5 编辑页入口行 | ✅ covered | 按钮文字和说明都是固定短文字，不含用户数据；窄屏下按钮占一整行全宽（44px 高），说明换到下一行并可再换行（S4） |
| zero-one-many | E6 toast | ✅ covered | 数量为 0 的部分省略，只加了组或只加了力量项各有自己的写法（S3、S4） |
| populated | E2、E3 对话框整体 | 🧪 backstop | 375px 下底部面板：11 行加两个图例时列表可滚动，最后一行不被底部按钮盖住，底部按钮在 iOS 安全区之上；验收时在 375px 截图核对 |
| populated | E2、E3 选中态 | 🧪 backstop | 浅色和深色主题下，选中行的 `--s` 底加 `--ink` 文字、复选框对勾、焦点环都清楚，类别色没有被当文字底；验收时用 `colorScheme:'dark'` 各看一眼 |
| long-text | E6 toast | 🧪 backstop | 375px 下 `已加到草稿：3 个目标组、2 个力量项，点「保存计划」后生效` 和 `已加入 …，计划已保存` 完整显示、可换行；验收时在手机宽度截图核对 |

<!-- Status vocabulary (locked by probe-core projectTruths):
     ✅ covered   → a plain truth string lifted into must_haves.truths
     🧪 backstop  → a flat scalar { statement, verification: backstop }; at verify time, no explicit
                    evidence → insufficient_spec → human_needed (never a silent pass, #1154)
     ⚠ unresolved → an explicit planner assumption (surfaced, never silently dropped)
     Rows are REPLACED (not appended) on a probe re-run — idempotent. -->

不适用（已排除，附理由）：
- E2/E3 · empty：列表来自代码里的常量 `DEFAULT_PLAN`，永远有 7 个目标组和 4 个力量项，没有空状态。
- E2/E3 · loading、error：列表是同步生成的，没有加载或失败（保存的失败在 E4）。
- E4 · populated、partial、empty：底部栏是一行提示加两个固定按钮，不显示数据列表。
- E5 编辑页入口行 · empty、loading、error、populated、partial、overflow、zero-one-many：一个固定短文字按钮加一句固定说明，不随数据变化，不会失败（只改草稿），断网和过期都不影响。long-text 不排除，见上表 E5 那一行。
- E1 · populated、partial、overflow、zero-one-many：一张静态说明卡加两个固定按钮，不显示数据列表。
- E6 · empty、loading、error、populated、partial、overflow：toast 是瞬时的单行或多行文字，没有数据列表；窄屏换行的情况见上面的 backstop 项。

补充：新界面全部只用已有 token，深色主题自动一致。挑选对话框的背景遮罩复用现有 `dialog#editor::backdrop,dialog#confirm::backdrop` 的规则（把 `dialog#sample::backdrop` 加进同一个选择器），不新增颜色字面量。

---

## 无障碍与动效

- **结构**：挑选对话框 `<dialog>` + `showModal()`（焦点被困在对话框里，背景不可操作）；两个分区各是 `<fieldset>`/`<legend>`；列表是 `<ul>/<li>`；每行是一个包着真 `<input type="checkbox">` 的 `<label>`。空计划卡片的原因行 `#planSampleWhy` 和对话框底部提示行 `#pk-hint` 都是 `role="status"`。
- **键盘**：Tab 顺序按视觉顺序（复选框们 → `先不添加` → 确认）；空格勾选；Enter 在复选框上无动作；Esc 关闭；被 `aria-disabled` 挡住的按钮保持在 Tab 顺序里，原因通过 `aria-describedby` 读出；真 `disabled` 的复选框（名额已满）移出 Tab 顺序，原因写在分区的 `.pk-lim` 里并通过 `aria-describedby` 读出。
- **焦点**：打开 → 第一个未禁用的复选框；取消、Esc、点背景 → 打开它的按钮；卡片模式保存成功 → `#planEditBtn`（做不到则 `#goals`）；编辑页模式确认 → 第一个新卡片的 `.pe-toggle`；冲突确认框关闭 → 回到挑选对话框里的 `添加并保存`。全部沿用全局 `:focus-visible` 焦点环（2px `--c-lang`）。
- **读屏**：对话框标题和说明在打开时被读出；每行读出名称、选中状态、说明行和「已有同名」标记；`#pk-hint` 读出已选数量或不可用原因；toast 保持现有 `aria-live="polite"`；编辑页模式再写一句进 `#pe-live`。
- **标签**：每个复选框有可见的行内名称作为 label；状态不靠颜色单独表达（对勾、`aria-checked` 语义、文字标记）。
- **触控**：≤560px 所有新增控件最小高度 44px；整行 `<label>` 是点击区域。
- **动效**：无新增动画；对话框打开、选中切换、滚动到新卡片都不加过渡；滚动在 `prefers-reduced-motion` 下用 `behavior:"auto"`。
- **窄屏**：单列；挑选对话框是贴底面板；空计划卡片两个按钮竖排；编辑页入口行按钮全宽。断点沿用现有 900 / 820 / 720 / 560，不新增断点。

---

## CSS 骨架（给执行器的选择器与关键规则，数值已按上面的 Spacing/Typography 定好）

```css
/* Phase 14. Scoped to .pe-empty / dialog#sample / #tab-plan .pe-tools; no global rule changes. No style="" attributes anywhere (CSP style-src-attr 'none'). */

/* S1: empty-plan card buttons (real disabled from the global gate and aria-disabled from offline/expired look the same) */
.pe-empty-act :is(button:disabled,[aria-disabled="true"]){opacity:.4;cursor:not-allowed}
.pe-empty-act .ghost:is(:disabled,[aria-disabled="true"]):hover{color:var(--muted);border-color:var(--line)}
.pe-why{flex:1 1 100%;margin:0;font-size:12px;line-height:1.55;color:var(--muted)}
.pe-why:empty{display:none}
.pe-why::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--c-job);margin-right:8px}

/* S4: editor entry row */
#tab-plan .pe-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 16px}
#tab-plan .pe-tools-note{font-size:12px;line-height:1.55;color:var(--muted)}

/* S2: picker dialog (backdrop: add dialog#sample::backdrop to the existing dialog#editor/#confirm backdrop selector) */
dialog#sample{border:1px solid var(--line);border-radius:14px;padding:0;width:min(520px,calc(100vw - 24px));max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);background:var(--surface);color:var(--ink);font-size:14px;line-height:1.55}
dialog#sample[open]{display:flex;flex-direction:column}
dialog#sample form{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}
dialog#sample :is(.ghost,.danger){padding:8px 12px;font-size:14px}
dialog#sample .primary{padding:8px 16px;font-size:14px}
.pk-head{padding:24px 24px 0}
.pk-head h3{font-family:var(--serif);font-weight:600;font-size:16px;line-height:1.2;margin:0}
.pk-head p{margin:8px 0 0;font-size:14px;color:var(--muted)}
.pk-body{flex:1 1 auto;min-height:0;overflow:auto;margin-top:16px;padding:16px 24px;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.pk-sec{border:0;margin:0;padding:0;min-width:0}
.pk-sec+.pk-sec{margin-top:24px}
.pk-sec legend{padding:0;margin-bottom:8px;font-size:12px;font-weight:600;color:var(--muted)}
.pk-sec legend .pe-count{margin-left:8px;font-weight:400}
.pk-lim{margin:0 0 8px}
.pk-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.pk-item{display:grid;grid-template-columns:20px minmax(0,1fr);gap:12px;align-items:start;min-height:36px;padding:12px 16px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--c);border-radius:12px;cursor:pointer}
.pk-item:has(input:checked){background:var(--s);border-color:var(--c)}   /* selected: --s fill + --ink text + --c border; never --c as a text background (12-UI-REVIEW) */
.pk-item:has(input:focus-visible){outline:2px solid var(--c-lang);outline-offset:2px}
.pk-item:has(input:disabled){opacity:.4;cursor:not-allowed}
.pk-item input{width:20px;height:20px;margin:0;accent-color:var(--ink)}
.pk-name{display:block;font-size:14px;font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.pk-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:4px;font-size:12px;font-weight:400;color:var(--muted)}
.pk-chip{padding:0 8px;border:1px solid var(--c);border-radius:999px;color:var(--ink)}   /* border, not fill: stays visible on a selected row (--s fill) */
.pk-dup{padding:0 8px;border:1px solid var(--line);border-radius:4px;color:var(--muted)}
.pk-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:16px 24px 24px}
#pk-hint{flex:1 1 160px;min-width:0;margin:0;font-size:12px;line-height:1.55;color:var(--muted)}
#pk-hint[data-tone]::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--tone,var(--muted));margin-right:8px}
#pk-hint[data-tone="warn"]{--tone:var(--c-job)} #pk-hint[data-tone="error"]{--tone:var(--red)}
.pk-foot button{min-height:36px}
.pk-foot :is(button:disabled,[aria-disabled="true"]){opacity:.4;cursor:not-allowed}
.pk-foot .ghost:is(:disabled,[aria-disabled="true"]):hover{color:var(--muted);border-color:var(--line)}
@media (max-width:560px){
  dialog#sample{margin:auto 0 0;width:100vw;max-width:100vw;max-height:90vh;max-height:90dvh;border-radius:14px 14px 0 0}
  .pk-item{min-height:44px}
  .pk-foot{padding:16px 24px calc(24px + env(safe-area-inset-bottom,0px))}
  #pk-hint{flex:1 1 100%}
  .pk-foot button{flex:1;min-height:44px}
  #tab-plan .pe-tools .ghost{flex:1 1 100%;min-height:44px}
}
```

挑选行的类别色靠给 `<label class="pk-item">` 加 `k-lang/k-pro/k-fit/k-job/k-oth`（由示例组的 `cat` 名称查 `CATS` 得到 `k`；力量项固定 `k-fit`），沿用现有 `.k-*` 对 `--c`/`--s` 的定义，不新增变量。

---

## 测试与实现提示（给 planner）

- 所有新增和改动的文案进 `T_…` 常量，并同步 `tests/support/strings.ts`；每次改应用都要重新记录 `tests/support/constants.ts` 的 `APP_SHA256`。
- Playwright 的 `toBeDisabled()` 把 `aria-disabled="true"` 也算作不可用，所以 `#planSampleBtn`（断网）、`#pkOk`（没勾选）用 `aria-disabled` 不影响用 `toBeDisabled()` 断言；点击行为要另断言"不打开对话框 / 不保存、只弹 toast"。
- 选择器：`#planEditBtn2`、`#planSampleBtn`、`#planSampleWhy`、`dialog#sample`、`#pk-title`、`#pk-hint`、`#pkCancel`、`#pkOk`、`.pk-item`、`input[data-pk="g:P2"]`（`g:` 目标组、`l:` 力量项，值是示例 id，只用来对应示例，不会写进计划）、`#peSampleBtn`。
- 受影响的现有用例（14-CONTEXT 已列）：`tests/cloud/plan-editor-archive.spec.ts` 里的「载入示例计划」用例改成新入口；断言 `载入示例计划`、`T_PE_SAMPLE_LOADED` 的地方一并改。
- 编辑页的 `loadSampleDraft(fromEditor)` 重构为「按勾选拷贝并追加」；卡片模式不经过 `pe` 草稿 UI，但复用 `savePlanDraft` 的校验、`peBlock()`、冲突、D-08 复查和容量检查。
- 保存栏的 `peBar()` 和卡片按钮的 `#planSampleWhy`、对话框 `#pk-hint` 的刷新，挂在同一处状态行变化的触发点上。

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none（Tool: none） | not required |
| 第三方 registry | none | not applicable |

本阶段不引入任何新的外部代码和资源。

---

## Assumptions (Claude's choice)

没有渠道向所有者提问；下列是 14-CONTEXT.md 没有规定、按"与已锁定决定和 12-UI-SPEC 最一致"选的做法。所有者有不同意见时改这里即可，planner 以这里为准。

| # | 选择 | 理由 |
|---|------|------|
| A1 | 空计划卡片里 `自己建一份` 是主按钮、`从示例里挑` 是次按钮 | 所有者的原话是"用不到的东西根本不要进朋友的账号"，默认路径是自己建；顺序与 D-04 一致；卡片里仍只有一个深色块 |
| A2 | `从示例里挑` 断网或过期时变灰加说明（`aria-disabled` + 可见原因 + 点击弹同一句 toast），不是"点了再提示" | 键盘和读屏用户也能知道原因；与 12 保存按钮的 A5 一致；14-CONTEXT 把它列为 Discretion |
| A3 | 挑选对话框桌面用居中对话框，≤560px 用贴底面板；中间列表滚动，标题和按钮固定 | 14-CONTEXT 指定"桌面对话框、手机底部面板"；11 个选项加两个标题在手机上放不下一屏 |
| A4 | 挑选对话框是独立的 `<dialog id="sample">`，不扩展 `confirmBox` | `confirmBox` 只装文字段落和两三个按钮；复选框列表要独立的滚动区和 fieldset 结构 |
| A5 | 同名标记按未归档的组名和力量项名精确比较（去首尾空格），标记文字 `计划里已有同名组` / `计划里已有同名力量项`，仍可再加 | 14-CONTEXT 允许"按组名标"；力量项照同一规则处理更一致；不为此改计划文档的形状 |
| A6 | 没有「全选」「全不选」按钮 | D-06 要求默认全不勾，示例只有 7 个组和 4 个力量项；不新增 14-CONTEXT 没有提的控件。以后朋友反馈再加 |
| A7 | 剩余名额不够时，其余未勾选行变真 `disabled` 并在图例下说明（目标组 20、力量项 8，归档项不占名额） | 12 D-17 和 A10 的"满了禁用加文字"的写法；不出现"选完点确认才报超限" |
| A8 | 卡片模式保存期间挑选对话框保持打开，出结果才关；冲突里 `回去继续挑` 回到列表，勾选保留 | 失败、冲突、容量超限都能留在原处重试，不丢用户的勾选 |
| A9 | 卡片模式的冲突三选一用"挑选版"措辞（`回去继续挑`、`放弃我的选择，用新版`），结构、按钮个数、留底规则全部沿用 12 S9 | 14-CONTEXT D-07 要求按现有冲突处理走；原文案里的"草稿""编辑页"在这条路径上不成立，不能说假话。**可选的更好做法**（不做，留给所有者以后决定）：冲突时把挑的项叠加到新版计划上，而不是二选一，因为"只追加新 id 的项"本来不会和别的设备的修改冲突 |
| A10 | 卡片模式保存成功后留在目标页，焦点回 `#planEditBtn`，页面不滚动 | 与 12 S1"保存后焦点回 `#planEditBtn`"一致；结果由 toast 播报，目标页本身就显示新增的项 |
| A11 | 编辑页的 `从示例添加` 放在保存栏下面的单独一行（`.pe-tools`），不放进目标组分区，也不挤进粘性保存栏 | 示例同时含目标组和力量项，不属于单个分区；粘性栏在 375px 下已经很挤；Tab 顺序仍是保存栏 → 这一行 → 分区 |
| A12 | 编辑页模式添加的卡片保持折叠，焦点落在第一个新卡片的折叠开关并滚动到中央，另有 toast 和读屏播报 | 一次可能加好几个，全部展开页面太长；落在新项上比落在标题上更能让用户看到结果（14-CONTEXT 允许两种） |
| A13 | 编辑页的 `从示例添加` 断网、过期时仍可用 | 编辑页本来就能断网改草稿（12 A6），只有保存受限 |
| A14 | 本周页空计划提示改成 `…可以在「目标」页建一份计划，或从示例里挑。`；目标页局部空提示和编辑页目标组空提示不改 | 旧文案提到的 `载入示例计划` 已不存在；其余两条仍然准确，不增加测试改动 |
| A15 | 不新增颜色、字号、字重和断点；字号只用 12/14/16，字重只用 400/600 | 保持与 12 一致，且 12-UI-REVIEW 的几条问题（选中态底色、禁用外观、点击区域）在这里一开始就按修正后的写法定下 |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: FLAG（非阻塞：勾选的复选框也是深色块、E5 长文字的排除理由；两条已在本文件改正）
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS
- [x] Dimension 7 Inventory Provenance: PASS（Tool: none，无组件清单，不适用）

另外按检查意见补了 S3 第 4 步：`回去继续挑` 先恢复 `添加并保存` 的可点状态，再把焦点放回去。

**Approval:** approved 2026-11-12（gsd-ui-checker：6 PASS、1 FLAG，无 BLOCK）
