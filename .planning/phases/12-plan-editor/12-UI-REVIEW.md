# Phase 12 — UI Review（编辑计划页）

**Audited:** 2026-11-11
**Baseline:** 12-UI-SPEC.md（已批准，含 A1–A20 假设）+ 12-CONTEXT.md（D-01 至 D-17）
**Screenshots:** not captured（本次为代码审计，未启动开发服务器，也未运行截图探测；截图不是必需的，视觉像素层面的结论都标注为未验证）
**Interaction captures:** off（`interaction_capture: false`）

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 抽查的契约文案基本逐字一致；行内「上移/下移/删除」只有动词（契约已标 FLAG），`×` 只有 aria-label 没有可见文字 |
| 2. Visuals | 3/4 | 焦点层级正确（24px 标题 + 唯一深色块 `保存计划`）；禁用按钮看起来和可用按钮一样；`×` 是纯图标按钮 |
| 3. Color | 2/4 | 类别选择器选中态用类别色做整块底色，文字是 `--surface`，违反契约「类别色不作文字底、文字一律 --ink」，对比度不够 |
| 4. Typography | 3/4 | 作用域内 12/14/16/24 和 400/600 基本守住；归档区的 `×` 按钮是 15px，越出 4 个字号 |
| 5. Spacing | 3/4 | 作用域覆盖全部落在 4 的倍数上；375px 下 50 行任务和 toast 的截图核对（契约 backstop 项）未做，所以不给 4 |
| 6. Experience Design | 3/4 | 状态、校验、确认、撤销、离开保护、焦点回收、读屏播报都实现了；禁用态视觉缺失，归档区 `×` 触控目标太小 |

**Overall: 17/24**

没有任何支柱打到 1 分，也没有发现「让用户无法完成任务」的缺陷，因此本次没有 BLOCKER。以下问题全部归为 WARNING，但 Color 因为契约明确规定的一条规则被违反而降到 2 分。

---

## Top 3 Priority Fixes

1. **类别选择器选中态用类别色当底色，文字是白底色（Color，契约违规）** — 选中的「求职」按钮是 `--c-job`（浅色主题下 `#A87000`）底色加 `--surface` 文字，估算对比度约 4.1:1，低于 14px 正文 AA 的 4.5:1；「健身」用 `--c-fit` 更浅，更差。来源是全局规则 `.seg button[aria-pressed="true"]`（约第 115 行），编辑页没有覆盖它。 — 用户在低对比下读不清当前类别，屏幕阅读器之外的低视力用户也会受影响。 — 在 `CSS 骨架` 作用域里加：`#tab-plan .seg button[aria-pressed="true"]{background:var(--s);color:var(--ink);border-color:var(--c);box-shadow:inset 0 0 0 1px var(--c)}`（`--s` 由 `.k-*` 提供，是浅色底；`--ink` 文字；类别色只留在边框）。

2. **禁用按钮与可用按钮长得一样（Experience Design / Visuals）** — 全局只有 `.primary:disabled{opacity:.4;cursor:default}`（第 66 行），`.ghost` 和 `.danger` 没有 `:disabled` 规则；`button{cursor:pointer}`（第 39 行）让禁用按钮也显示手型光标；`.ghost:hover`（第 59 行）在禁用时照样变色。受影响的有：第一项的「上移」、最后一项的「下移」、已满 20 个组/50 项/8 个力量项/20 个标签时的「＋ 添加…」、归档超限时的「恢复」。用户会点一个没反应的按钮，只能靠旁边的小字「最多 20 个」才知道原因，而「上移」「下移」旁边没有任何解释。 — 在 `#tab-plan` 作用域里加：`#tab-plan button:disabled,.arch button:disabled{opacity:.4;cursor:not-allowed;color:var(--muted);border-color:var(--line)}`，并确认 `:hover` 不覆盖禁用态（覆盖规则的特异性要高于 `.ghost:hover`，即用 `#tab-plan button:disabled`）。

3. **归档区的 `×` 删除待办按钮：15px、没有 44px 触控目标（Typography + Experience Design）** — `.x` 全局是 `font-size:15px;padding:0 2px`（第 104 行），在 `archivedHTML()` 的「没有所属目标组的待办」行里使用，落在 `details.arch` 作用域内，违反契约的 4 个字号（12/14/16/24）。它的 44px 触控规则只写在 `#tab-plan` 的媒体查询里，目标页的 `.arch` 不在其中，所以手机上只有约 15px 的点按区域。 — 手机用户很难点中，误删风险也高。 — 在 `.arch` 作用域里加：`.arch .x{font-size:16px;min-width:36px;min-height:36px;padding:0}`，并在 `@media (max-width:560px)` 里把 `min-width/min-height` 提到 44px；同时给按钮加 `title="删除待办"` 方便鼠标悬停。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**符合契约的部分（抽查）：**
- 页头说明、`保存计划`、`放弃这次修改`、`载入示例计划`、`计划是空的` 及其正文，与 UI-SPEC「Copywriting Contract」一致（`us-journey-tracker.html` 约 2267–2290 行的常量区）。
- 离开、退出、重新登录的确认文案与契约逐字一致（`放弃没保存的修改？`、`编辑计划页里有没保存的修改，退出后会丢失。`、`重新登录？`、`未保存的计划修改会丢失。`、`先不登录`、`仍然重新登录`）。
- 冲突三选一、D-08 询问框的按钮写的是动作加对象（`回去继续改`、`放弃我的修改，用新版`、`用我的覆盖`、`全部归档`、`连进度一起删`），没有出现泛称的「确定」「取消」「保存」。
- 扫描 `renderPlanEditor` 之后的编辑页代码（约 2262–2900 行）没有发现 `确定`、`取消`、`OK`、`提交` 等泛称按钮文字。
- 归档区的 `已归档（n）`、`已归档的任务`、`没有所属目标组的待办`、`未知目标组` 都已实现。

**发现的问题：**
- **行内动词按钮（WARNING）**：`上移`、`下移`、`删除`、`恢复`、`彻底删除` 的可见文字只有动词，对象靠同一行的输入框或卡片标题提供。`aria-label` 已写全对象（如 `上移任务：示例任务`），所以读屏没问题；契约的 Checker Sign-Off 已把它记为 FLAG，本次不重复扣分，但视觉上仍然靠就近关系。
- **`×` 按钮只有图标（WARNING）**：归档区的待办删除按钮只有 `×` 字符，`aria-label="删除待办"` 有，但没有 `title`，鼠标用户悬停看不到它是删除。

### Pillar 2: Visuals (3/4)

**符合的部分：**
- 焦点层级清楚：页面标题 `h2#pe-title` 24px，粘性栏里唯一的深色实心块是 `保存计划`（`.primary`，`--ink` 底），折叠卡和行内按钮是描边的次要层级。编辑页不使用 accent，符合契约。
- 折叠卡头部是整块可点的 `button.pe-toggle`，有 `▸/▾` 指示，展开状态有 `aria-expanded`。
- 空计划卡片是唯一的 `.panel.pe-empty`，`编辑计划` 是卡片里唯一的深色块，层级正确。

**发现的问题：**
- **禁用态视觉缺失（WARNING，与 Experience Design 相同的根因）**：见 Top 3 Fix 2。从视觉层级看，禁用的 `上移`、`＋ 添加目标组` 和可用的一模一样，用户无法从外观判断哪些能点。
- **`×` 图标按钮（WARNING）**：见 Pillar 1，没有 tooltip，视觉上不能说明用途。

### Pillar 3: Color (2/4)

**符合契约的部分：**
- 没有新增颜色 token。对编辑页、归档区、确认框的 `plan` 相关 CSS 与 JS 做了 `#xxxxxx` / `rgb(` 扫描，没有发现硬编码颜色。
- 警告色 `--c-job` 只用于冲突提示横幅的边框和粘性栏提示行的圆点（`#pe-hint[data-tone="warn"]{--tone:var(--c-job)}`），没有作文字色，也没有作整块底色。
- 红色 `--red` 只用于契约列出的破坏性按钮和校验错误文字。
- 编辑页的 accent（`--c-lang`）只用于键盘焦点环（全局 `:focus-visible`）。
- 60/30/10 的分布基本成立：`--paper` 是背景，`--surface` 是卡片和对话框，深色块只有保存按钮。

**发现的问题（需要修复）：**
- **类别选择器选中态的底色违反契约（WARNING，本支柱的主要问题）**：编辑页的类别 `.seg` 按钮带 `k-${c.k}` 类，选中时全局规则 `.seg button[aria-pressed="true"]{background:var(--c);border-color:var(--c);color:var(--surface)}`（约第 115 行）生效。这意味着：
  - 「求职」选中时是 `--c-job`（浅色 `#A87000`）底色加 `--surface` 文字，估算对比度约 4.1:1（以 `#A87000` 和浅色 `--surface` 估算，未逐一核对 surface 的实际值），低于 14px 正文的 AA 4.5:1。
  - 「健身」选中时是 `--c-fit`（`#EE8B66`）底色，对比度更低。
  - 契约 Color 一节明确写了：编辑页里类别色只用于 4px 左边框和类别标签底色（`--s`），文字一律 `--ink`；`--c-job` 不作整块底色。这里两条都违反了。
  - 契约 Color 一节还写了 `--c-job` 在浅色主题对 `--surface` 约 3.9:1，不够 14–16px 文字，这里用作文字承载底色，正是它要避免的情况。
- **对比度的估算说明**：以上比值是按 WCAG 公式估算的，不是截图取色得到的；修复后应重新核对。

### Pillar 4: Typography (3/4)

**符合契约的部分：**
- 作用域内的规则限定在 `#tab-plan`、`.goals-bar`、`.arch`、`.pe-empty`、`dialog#confirm.pe`，全局 `.ghost`（13px）、`.panel h3`、`.group-h` 没有被修改。
- 扫描编辑页作用域的 CSS（约 200–290 行），没有出现 11/13/15/17/18/19/28px 或 700/800 字重。
- 标题 `h2` 是 24px 600 衬线，分区标题 `h3` 是 16px 600，正文 14px，辅助 12px，符合 4 个字号 2 个字重。
- 输入框文字 16px，防止 iOS 聚焦放大，符合契约。

**发现的问题：**
- **归档区 `×` 按钮是 15px（WARNING）**：全局 `.x{...font-size:15px...}`（第 104 行），在 `details.arch` 作用域内没有被覆盖。契约 Typography 一节写明「上面作用域里不出现 15px」，`.arch` 是作用域之一。修复见 Top 3 Fix 3。
- **契约未覆盖的现有组件（不扣分，但需知晓）**：日历日面板和时间线里的 `.tag`（11px）按契约属于现有组件，只加了省略号，不计入本阶段。

### Pillar 5: Spacing (3/4)

**符合契约的部分：**
- 作用域覆盖表里的所有声明值都是 4 的倍数：`.ghost/.danger` 8px 12px、`.primary` 8px 16px、行内按钮 4px 8px、面板 16px、空计划卡片 24px、`#pe-bar` 12px 0 与 16px 0 外边距、卡片头 12px 16px、卡片内容 0 16px 16px、卡片间距 8px、分区间距 24px。
- 对话框 `dialog#confirm.pe` 桌面 24px、手机 `24px 24px calc(24px + env(safe-area-inset-bottom,0px))`，段间距 8px，符合契约。
- 行布局 `grid-template-columns:24px minmax(0,1fr) auto`，桌面与手机两套，与 S4 一致。

**发现的问题：**
- **未在 375px 下核对（契约 backstop 项）**：契约把 50 行任务（E3）和带按钮的 toast 在 375px 下的表现列为 `🧪 backstop`，要求截图核对。本次没有截图，所以不能确认 44px 触控目标和按钮不挤压，因此不给 4 分。
- **负外边距（信息项，不扣分）**：`.pe-body>.pe-err{margin:-8px 0 12px}` 用了负外边距，数值本身是 4 的倍数，与契约不冲突，但它依赖相邻元素的间距，后续改动容易出错。

### Pillar 6: Experience Design (3/4)

**符合契约、做得好的部分：**
- 状态覆盖完整：空计划卡片（`.panel.pe-empty`）、目标组为空（`.empty`）、任务为空（`这个目标组还没有任务。`）、力量项为空、预设标签为空、本周页空计划提示（`wkEmpty`）都实现了。
- 保存流程按契约的顺序走：校验 → `takeRemote()` → 三选一 → D-08 复查 → 4 MB 容量 → 写入。`savePlanDraft` 的入口对断网和过期返回同一句 toast，不静默失败。
- 保存按钮在断网和过期时使用 `aria-disabled`（不用 `disabled`），留在 Tab 顺序里，`aria-describedby="pe-hint"` 指向提示行，符合 A5 和 D-11、D-12。
- 提示行 `#pe-hint` 是 `role="status"`，断网、联网、校验数量变化都会被读出。
- 读屏区 `#pe-live` 是 `aria-live="polite"`，移动、移除、恢复、归档都有句子。
- 直接移除有 `撤销移除` toast，`ms=5000`。
- 离开保护：切换标签、返回键、放弃修改都经过 `peLeave()` 确认；`beforeunload` 在有未保存修改时设置；退出登录和重新登录各有专用文案。
- 焦点管理：进入编辑页焦点到 `h2#pe-title`；排序后焦点留在同一按钮；校验失败焦点到第一个错误字段；离开编辑页焦点回到 `#planEditBtn`。
- 确认框默认焦点在安全按钮（`cfCancel.focus()`），Esc 等同安全按钮；三选一在手机上竖排，安全按钮在最上面。
- `dialog#confirm #cf-body{max-height:50vh;overflow:auto}` 补上了窄屏和横屏的高度上限。

**发现的问题：**
- **禁用态没有视觉反馈（WARNING）**：见 Top 3 Fix 2。`.ghost:hover` 在禁用时仍生效，`cursor` 是 pointer。用户看到的是「可以点」，点了没有反应，只能靠旁边的小字判断原因，而「上移/下移」旁边没有任何小字。
- **归档区的 `×` 触控目标过小（WARNING）**：见 Top 3 Fix 3。`.arch` 里的 `×` 没有 44px 规则，手机上很难点中，而它是归档区唯一的删除入口。
- **归档区的 `×` 只有 aria-label（WARNING，与 Pillar 1 相同）**。
- **Registry**：契约 Registry Safety 一节写明没有第三方 registry，`components.json` 不存在，无需做注册表审计。

---

## Registry Safety

Registry audit: 0 third-party blocks checked（`components.json` 不存在，shadcn 未初始化，本节不适用）。

---

## Files Audited

- `.planning/phases/12-plan-editor/12-UI-SPEC.md`（契约，730 行，全部读过）
- `.planning/phases/12-plan-editor/12-CONTEXT.md`（D-01 至 D-17）
- `.planning/phases/12-plan-editor/12-01-SUMMARY.md` 至 `12-08-SUMMARY.md`（读了各自的 Accomplishments、Decisions、Deviations 段；12-08 的 Deviations 为 None）
- `us-journey-tracker.html`：
  - 样式块约第 58–59、66、104、108–115、195–199、201–290、302–307、310–312、333–334 行
  - 编辑页 HTML 约第 476–489 行（`#tab-plan`、`#pe-bar`、`#pe-notice`、`#pe-live`、`dialog#confirm` 与 `#cfMid`）
  - 脚本：目标页渲染与归档区 `archivedHTML()`（约 2098–2143 行），编辑页常量与渲染（约 2262–2500 行），归档区 `peArchivedHTML()`（约 2615–2643 行），`savePlanDraft` 与 `peBlock`/`peBar`（约 2341–2360 行、2795–2870 行），`confirmBox`（约 1520–1545 行），`toast`（约 2912 行）

**未做的事：** 没有截图（未启动开发服务器，未运行截图探测，未运行任何测试套件）；没有取色器实测对比度（对比度为估算）；没有核对 375px 下的实际布局；没有核对 `surface` 变量在两个主题下的实际值。

**Interaction captures:** off。Experience Design 的结论全部来自代码阅读，没有交互截图佐证。
