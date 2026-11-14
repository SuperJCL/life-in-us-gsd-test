# Phase 15 — UI Review（健身页）

**Audited:** 2026-11-14
**Baseline:** `15-UI-SPEC.md`（已批准，2026-11-13，gsd-ui-checker 第 3 轮通过）
**Screenshots:** not captured（code-only audit：没有运行中的开发服务器，项目禁止 npx 与浏览器下载）
**Interaction captures:** off（`workflow.ui_interaction_capture` 为 false）
**审计范围:** 只读静态审计 `us-journey-tracker.html`（4208 行）的健身页相关 CSS、模板和渲染函数；没有运行测试，没有修改应用源码。

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 合同里的关键文案已逐条核对存在（21 条抽样全部命中）；13 条「UI-SPEC 之外」的文案待所有者过目 |
| 2. Visuals | 2/4 | 375px 力量目标卡实际为单列（合同写两列）；本周训练面板标题只有 `sr-only`，视觉上没有标题 |
| 3. Color | 3/4 | 健身页自身没有新增颜色字面量，全部走 token；深浅色下图表对比度没有证据，延后到 Phase 16 |
| 4. Typography | 3/4 | `#tab-fit` 范围内的字号、字重符合 12/14/16/24 与 400/600；历史月份标题复用的 `.tl-month` 是 18px，超出声明 |
| 5. Spacing | 3/4 | 健身页新规则都是 4 的倍数；`.tl-month` 的 `margin:22px 0 8px` 是非 4 倍数，在历史里生效 |
| 6. Experience Design | 3/4 | 状态覆盖、草稿保护、撤销、焦点与 aria 基本齐全；窄屏保存栏顺序与合同相反，历史展开入口缺少可见指示 |

**Overall: 17/24**

BLOCKER 级别的问题：静态审计未发现。下面的问题都是 WARNING，但其中第 1、2、3 条建议在 Phase 16 验收前修掉。

---

## Top 3 Priority Fixes

1. **训练历史的展开入口没有可见指示** — 用户看不出某次训练可以点开看组明细和「修改 / 删除」入口。CSS `.fh-item>summary{display:flex}`（`us-journey-tracker.html:543`）在 Chromium 和 Safari 上会去掉原生展开三角（按已知浏览器行为判断，未在浏览器中核对）；仓库里没有任何 `::before` 或 `::marker` 补偿。 — 修复：给 `.fh-item>summary` 加一个 CSS 伪元素三角（`▸` / `▾`，写法同 `.fw-chev`，用 `[open]` 切换），或者把 summary 改回 `display:list-item` 的布局再用 grid 放摘要。

2. **窄屏（≤560px）保存栏的顺序与合同相反** — 合同 S3 要求自上而下 `保存训练` → `放弃未保存的内容` → `删除这次训练`；实际 DOM 顺序是 `#fl-hint` → `放弃` → `删除这次训练` → `保存训练`（`us-journey-tracker.html:2752` 插入放弃按钮，`:2794` 渲染删除与保存），`.fl-bar button{flex:1 1 100%}`（`:560`）按 DOM 顺序竖排。结果：375px 下主按钮在最下面，紧挨着它上面的是红色的 `删除这次训练`，误触风险高，而且视觉顺序和 Tab 顺序不一致（WCAG 2.4.3 的问题）。 — 修复：在 `@media (max-width:560px)` 里给 `#fl-save` 设 `order:-1`（同时让 `#flDiscard` 排第二、`#flDelete` 排第三），或者在 DOM 里把保存按钮放到删除前，同时修正 Tab 顺序。

3. **375px 的力量目标卡只有一列，且本周训练面板没有可见标题** — 合同 S6 写的是「375px 下两列」，实际 `.fw-lifts{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}`（`:507`）在内容宽 301px 时只能放 1 列（2×160+12=332 > 301）；这一块会变成很长的单列卡片，与合同不符。同时 `#fw-title` 是 `h3.sr-only`（`:2812`），而合同 S2 要求每个面板标题是可见的 `h3`（16px 600 衬线），`#fl-title`（`:2780`）、`#fh-title`（`:2845`）、`#fc-title`（`:3063`）都是可见的，只有 (b) 面板不一致。 — 修复：`.fw-lifts` 的最小宽改为 140px（2×140+12=292 ≤ 301，375px 下两列），并把 `#fw-title` 的 `sr-only` 去掉，改为和其他面板一样的可见 `h3`（或者在合同里明确改为无可见标题，并同步改 S2）。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**已核对存在的合同文案（抽样 21 条，全部在 `us-journey-tracker.html` 中命中）：**
- 保存栏提示：`现在没有网络，训练会先存在这台设备上，联网后自动同步。`（`T_FL_HINT_OFFLINE`）
- 草稿覆盖提示：`这一天的训练刚在别的设备上更新了。`（`T_FL_HINT_REMOTE`）
- 训练历史空状态：`还没有训练记录。在上面记下第一次训练吧。`
- 记录区整体空状态：`计划里还没有力量项和有氧项，先去编辑计划添加动作，才能记录训练。`
- 校验：`这个动作还没有记录任何一组，填一组或移除这个动作`、`请填写时长（分钟）`、`距离要大于 0，不超过 1000`、`目标要大于 0`、`请填写有氧项名称`
- 确认框：`换一天记录？`、`归档这个有氧项？`
- 图表：`每个训练日取最重的一组。虚线是计划里的目标重量。`、`空心点是以前手填的记录，没有次数。`、`只有一次记录，再练几次就能看出变化。`、`徒手动作（重量都是 0）改看次数。`
- 周趋势：`按周合计，周一到周日算一周。`、`还没有力量项，可以在「编辑计划」里添加。`（复用 `T_GOALS_NO_LIFTS`）
- 组数上限：`最多 20 组`（出现 2 处）、toast `训练已保存`、`已删除` 前缀

**待所有者过目的文案（来自 15-01 至 15-07 SUMMARY，合同之外）：**
- `T_FW_TITLE`「本周训练和力量目标」（只给读屏，见 Visuals 发现）
- `T_FW_BAR_ARIA`「{名称}进度」
- `T_FC_CD_ARIA`（有氧柱形图的 `aria-label`）、`T_FC_REPS`（「单组最多次数 / 总次数」）
- 日历 CSV 的 Subject 前缀 `[健身]`（沿用文字记录的写法）
- 有氧项上下移的 `aria-label`「上移有氧项：{名称}」等
- 其他 SUMMARY 列出的读屏文案

这些不是缺陷，但按合同它们需要所有者在 Phase 16 确认。

**扣分原因：** 合同之外的文案数量不少，且没有逐条经所有者确认；另外合同 S3 的 `已删除的力量项` 之类回退文案（`T_FIT_GONE_L`）只在数据异常时出现，没有写进合同。

### Pillar 2: Visuals (2/4)

1. **375px 力量目标卡为单列（合同不符）**
   - 合同：`.fw-lifts` 在 375px 下两列（S6、Visuals 表 E8 的 overflow 行）。
   - 实际：`us-journey-tracker.html:507` `.fw-lifts{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}`。375px 视口下 `.wrap` 左右各 20px（`:46`），`#tab-fit .panel` 内边距 16px（`:452`）加边框 1px，内容宽约 301px；2×160+12 = 332 > 301，所以只能 1 列。
   - 影响：20 张卡时页面明显变长；合同里「两列」的承诺没有兑现。
   - 修复见 Top 3 第 3 条。

2. **本周训练面板没有可见标题**
   - 合同 S2 写「每个面板标题是 `h3`（16px 600 衬线）」。`#fl`、`#fc`、`#fh` 的标题可见，`#fw` 的 `h3#fw-title` 是 `sr-only`（`us-journey-tracker.html:2812`）。
   - 影响：(b) 面板在视觉上是「说明按钮 + 本周训练 h4 + 力量目标 h4」，没有和其他三块一致的标题层级。

3. **日历里的 `.chip.k-fit` 等旧组件** 沿用原有的 11px chip（`us-journey-tracker.html:150`），不在健身页作用域内，合同 S9 也没有规定日历 chip 的字号，不算违反；记录在此，供 Phase 16 目视核对。

**已确认的正面项：**
- 历史折叠面板、动作块、有氧行、力量目标卡都用了合同规定的类（`.fl-ex.k-fit`、`.fl-cd.k-fit`、`.fw-lift.k-fit`、`figure.fc.k-fit`）。
- 「保存训练」是整页唯一的实心深色块（`.primary`，`--ink` 底），焦点层级符合合同 Color 节。

### Pillar 3: Color (3/4)

**正面（已核对）：**
- 健身页相关 CSS（`us-journey-tracker.html:446-562`）内没有颜色字面量（`#xxx` 或 `rgb()`）。
- 类别色只用于左边框、折线、柱、点、进度条填充和已选芯片的底与边框（`--c`、`--s`），文字用 `--ink` / `--muted`。
- 红色只用于删除类按钮（`.fl-rm`、`#flDelete`）和校验错误（`.pe-err`、`[aria-invalid]`）。
- 没有 `:has()` 依赖；选中态靠 `[aria-pressed="true"]`（`:458`）。
- 深色主题通过 `--c-fit: #EE8B66` 等 token 自动切换（`:30`、`:37`）。

**扣分原因（WARNING）：**
- 合同 Color 节写「`--c-fit` 对 `--surface` 浅色 `#C2522D`、深色 `#EE8B66` 都高于 3:1」。这个对比度数字在代码和合同里都没有证据，只是断言；图表的线、点、柱完全依赖这个值。
- 空心的「没训练」日点用 `--line` 描边（`:504`），和 `--surface` 的对比度没有核对；它和实心点的区别同时靠形状和颜色，合同允许，但颜色一侧没有证据。
- 这两项需要在浅色和深色下目视核对，标记为 `needs_human_review`，不算通过。

### Pillar 4: Typography (3/4)

**正面（已核对 `us-journey-tracker.html:446-562`）：**
- `font-size` 只出现 12px、14px、16px、24px（健身页作用域内），`font-weight` 只有 400 和 600。
- 输入框 16px，防止 iOS 聚焦放大（`:461`）。
- 标签栏 15px 属于现有组件，合同已声明为例外。

**扣分原因（WARNING）：**
- 训练历史的月份标题复用了 `.tl-month`，它的规则是 `font-size:18px;margin:22px 0 8px`（`us-journey-tracker.html:357`），在 `#fh` 里以 `<div class="tl-month">`（`:2850`）生效。合同 Typography 节明确写「作用域里不出现 11、13、15、17、18、19、28px」，而 S8 又要求复用 `.tl-month`，这两条本身互相矛盾，实现选择了复用，结果违反了字号声明。
- 修复：在 `#fh` 里加 `#tab-fit .tl-month{font-size:16px;margin:16px 0 8px}`（16px 是合同的 Input/Heading 字号），并同步修正合同 S8 的复用说明。

### Pillar 5: Spacing (3/4)

**正面：** 健身页新增的 margin、padding、gap 值都在 4 的倍数上（8、12、16、24、32、4），`#tab-fit .panel+.panel{margin-top:24px}`（`:453`）与合同一致。≤560px 的 `.fl-cols`、`.fl-set` 网格列宽（`:555`）和合同的 375px 计算一致。

**扣分原因（WARNING）：**
- `.tl-month` 的 `margin:22px 0 8px`（`:357`）中 22px 不是 4 的倍数，合同 Spacing 节写「本阶段所有新增间距都落在 4 的倍数上」。修复见 Typography 的同一条规则。
- 561 到 900px 的平板：`.fc-grid` 是两列（`:519`），合同 A20 写「每张约 280–360px 宽，够画」。实际计算：视口 561px 时，`.wrap` 内容宽 521px，`.panel` 内宽 487px，两列加 16px 间距后每列约 235px，去掉 `.fc` 的 12px 内边距和 1px 边框后，图宽只有约 209px；视口 900px 时图宽约 379px。合同的下界 280px 不成立。
  - 209px 宽的图里 4 张图各有坐标、目标标注和读数行，可以画，但标题行 `fc-h`（名称 + 小标）会挤；有氧柱形图 53 周时槽宽约 3px，柱子几乎连成一片。
  - 这一条需要目视（平板宽度），标记为 `needs_human_review`；合同的 280px 数字应改正。

### Pillar 6: Experience Design (3/4)

**正面（已核对）：**
- 空、错误、部分填写、满、只读、门控状态都有对应的类和文案（`renderFl`、`renderFw`、`renderFc`、`renderFh`）。
- 草稿保护：`beforeunload`（`:3859`）、换日期确认（`换一天记录？`）、放弃确认、本机留底键 `usj:v2:<用户 id>:wodraft`（`:2662`）。
- 撤销 toast 覆盖删除整次训练、删除一组、移除动作。
- 键盘：所有按钮都是原生 `button`，`aria-disabled` 与真 `disabled` 的分工符合合同（`:459`、`:460`）。
- 读屏：`#fl-live`、`#fc-live` 常驻；图表有 `role="img"` 摘要和原生 `details` 数据表。
- 触控：≤560px 的 `.ghost`、`.primary`、`.seg button`、`.fl-chip`、输入框、`summary` 最小高度 44px（`:554`）；桌面 36px（`:455`）。
- 没有 `style` 属性（全文件检索为空）；宽度通过 `i.style.width` 的 CSSOM 写入（`:2829`）。这满足严格 CSP 的要求。

**扣分原因（WARNING）：**
1. **窄屏保存栏顺序与合同相反**，见 Top 3 第 2 条。误触风险：红色的 `删除这次训练` 紧贴在 `保存训练` 上方。撤销 toast 可以补救（6000ms），所以不是 BLOCKER。
2. **历史展开入口缺少可见指示**，见 Top 3 第 1 条。
3. **图表在平板宽度下偏窄**，见 Spacing 发现。
4. **门控期间的只读入口**（`data-fit-ro`，共 9 处）和 `data-fl`（17 处）按合同规划实现，但没有运行门控用例，只能静态确认。

**需要 Phase 16 人工核对（不标为通过）：**
- 375px 下组行一行（序号、重量、×、次数、删除）是否真的放得下，以及 20 组时虚拟键盘是否盖住保存栏。
- 375px 下五个标签是否在一行、点击区域是否足够。
- 375px 下长 toast（如「已加入 3 个目标组、4 个力量项、3 个有氧项，计划已保存」）是否完整显示。
- 深色 / 浅色下图表的线、点、柱、目标虚线、读数竖线是否清楚（对应 Color 发现）。
- 真机手指拖动图表时，`touch-action:pan-y` 是否既能读数又能竖向滚动页面。
- 所有新文案（上面列出的合同之外的部分）。

---

## Registry Safety

`components.json` 不存在，shadcn 未初始化；合同 Registry Safety 表写明没有第三方 registry。跳过注册表审计，不添加本节的标记。

---

## Files Audited

- `us-journey-tracker.html`：健身页相关 CSS（约 446–562 行，含 `nav.tabs` 的 560px 规则在 449 行）；标签栏（约 608 行）；`#tab-fit` 外壳（约 660 行）；`renderFl`、`flExHTML`、`flCdHTML`、`renderFw`、`renderFc`、`fcDraw`（约 3097–3136 行）、`fcDrawCd`（约 3137–3155 行）、`fcCd`、`renderFh`（约 2840 行）、`woSummary`、`fitBars`（约 2829 行）、`fcPer`（约 3050 行）、`fwNoteToggle`；以及 `PLAN_MAX`、`WO_MAX`、`CARDIO_ID_RE`、`T_FL_*`、`T_FW_*`、`T_FC_*`、`T_FH_*`、`T_PE_CD_*`、`T_PK_*` 常量。
- `.planning/phases/15-fitness-tab/15-UI-SPEC.md`（全文，865 行）、`15-CONTEXT.md`。
- `.planning/phases/15-fitness-tab/15-01-SUMMARY.md` 至 `15-07-SUMMARY.md`（用于收集 backstop 清单和合同之外的文案）。
- 没有运行测试；没有启动开发服务器；没有截图；没有修改 `.gitignore` 或应用源码。

---

## 编排者核对（2026-11-14）

逐条对照代码和 15-UI-SPEC 复核了三条 Top 修复：

1. **历史展开入口没有可见指示：属实。** `us-journey-tracker.html:543` 的 `.fh-item>summary{display:flex;…}` 让 summary 不再是 list-item，浏览器自带的展开三角随之消失；仓库里没有补偿的伪元素。UI-SPEC S8 写明「用浏览器自带展开三角」。
2. **窄屏保存栏顺序：属实。** UI-SPEC 第 213 行要求 ≤560px 自上而下 `保存训练`、`放弃未保存的内容`、`删除这次训练`；实际按 DOM 顺序（放弃 → 删除 → 保存）竖排，主按钮在最下面。
3. **375px 力量目标卡单列：属实。** `.fw-lifts` 的 `minmax(160px,1fr)`（`:507`）在 375px 的内容宽度里只能排一列；UI-SPEC 第 309、660 行要求两列（契约里 160px 和「两列」本身就矛盾）。

这三条在代码审查之后用一次 gsd-fast 修复，再跑回归。`#fw-title` 只给读屏（文案已列入 Phase 16 待所有者过目的清单）、`.tl-month` 的 18px 和 22px、A20 的图宽估算是契约自身的问题，不改代码。
