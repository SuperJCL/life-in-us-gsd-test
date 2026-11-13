# Phase 14 — UI Review（新账号的计划起步）

**Audited:** 2026-11-12
**Baseline:** `14-UI-SPEC.md`（UI 设计契约，已批准）加 `14-CONTEXT.md` 锁定的决定 D-01 到 D-09
**Screenshots:** not captured（code-only audit；没有开发服务器，项目禁止 npx 和浏览器下载）
**Interaction captures:** off（`interaction_capture: false`）。交互相关的结论全部来自代码阅读，不是实测。
**Scope:** 只审计本阶段新增或改动的界面：目标页空计划卡片、`dialog#sample`（卡片模式和编辑页模式）、编辑计划页的 `.pe-tools` 入口行、本周页空计划提示、本阶段的 toast。其余视图不在范围内。

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | 全部 `T_PK_*` 和改动的 `T_PE_*` 文案与 UI-SPEC 的 Copywriting Contract 逐条一致；示例名只用 `DEFAULT_PLAN` 的占位 |
| 2. Visuals | 3/4 | 桌面端空计划卡片和编辑页入口按钮按 CSS 推算高约 30px，低于 UI-SPEC 规定的桌面最小 36px |
| 3. Color | 3/4 | 只用已有 token，无新颜色字面量；但选中态依赖 `:has()`，深浅色选中态和 375px 底部面板都未验证（人工项） |
| 4. Typography | 3/4 | 新作用域内 `.ghost` 继承全局 13px，违反 UI-SPEC「作用域里不出现 13px」 |
| 5. Spacing | 3/4 | 新增的按钮沿用全局 `.ghost`（5px 上下内边距）和 `.primary`（7px），违反「只用 4 的倍数」 |
| 6. Experience Design | 3/4 | 断网、过期、冲突、容量、门控、键盘、焦点回退都有代码路径；`pkSave` 在 `!np` 分支静默失败，没有任何反馈 |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **挑选入口和编辑页入口的按钮尺寸和字号偏离契约** — 用户在桌面上看到的按钮偏小、字号 13px，和同页其他 14px 控件不齐，点击区域也低于 36px — 在 `#planSampleBtn`、`#peSampleBtn` 的作用域里补规则：`.pe-empty-act .ghost,#tab-plan .pe-tools .ghost{font-size:14px;padding:8px 12px;min-height:36px}`，`.pe-empty-act .primary{min-height:36px;padding:8px 16px}`。这些规则只放在 Phase 14 的作用域里，不改全局 `.ghost`。
2. **`pkSave` 的 `!np` 分支静默失败** — `normalizePlan` 返回空值时，`pkSave` 只调用 `pkBusy(false)` 并直接 `return`，按钮恢复但对话框不说明任何原因，用户不知道为什么没有保存 — 在该分支加一句已有的错误提示（例如复用 `T_PE_HINT_TOOLARGE` 之外的通用失败文案，并写入 `#pk-hint`，`data-tone="error"`），或至少 `toast`。新文案需要进 `tests/support/strings.ts` 并进 Phase 16 清单。
3. **选中态的唯一视觉和读屏通道依赖 `:has()`** — 在不支持 `:has()` 的旧浏览器里，勾选的行没有 `--s` 底色和 `--c` 边框，只剩复选框的对勾；UI-SPEC 的 Typography/Color 规则默认这一状态清楚可见 — 在 `pkRender` 里同时给 `label.pk-item` 加 `is-on` class（由 `change` 事件同步），CSS 改用 `.pk-item.is-on` 作为主选择器，`:has()` 保留为增强。

---

## Detailed Findings

### Pillar 1: Copywriting (4/4)

逐条核对 UI-SPEC 的 Copywriting Contract，代码里的字符串一致：

- 空计划卡片：标题 `计划是空的`（`T_PE_EMPTY_TITLE`），正文 `T_PE_EMPTY_BODY`，主按钮 `自己建一份`（`T_PE_BTN2`），次按钮 `从示例里挑`（`T_PE_SAMPLE_BTN`）。与契约一致。
- 原因行：`联网后才能从示例里挑`、`登录已过期，重新登录后才能从示例里挑`（`T_PK_WHY_OFFLINE`、`T_PK_WHY_EXPIRED`），由 `pkWhy()` 写入 `#planSampleWhy`。与契约一致。
- 对话框：卡片模式 `从示例里挑` / `添加并保存` / `保存中…`，编辑页模式 `从示例添加` / `添加所选项`，取消 `先不添加`。与契约一致。
- 提示行优先级：过期和断网复用 `T_PE_HINT_EXPIRED`、`T_PE_HINT_OFFLINE`，容量复用 `T_PE_HINT_TOOLARGE`，空选 `先勾选要加入的项`，已选 `已选 …`。与契约一致。
- 名额和同名：`目标组最多 20 个，还能再加 {k} 个`、`目标组已满（20 个），先删掉一个再添加`、力量项同理（8 个）、`计划里已有同名组`、`计划里已有同名力量项`。与契约一致。
- 冲突框：标题 `T_PE_CF_TITLE`，四行 `T_PK_CF_L1..L4`，按钮 `回去继续挑` / `放弃我的选择，用新版` / `用我的覆盖`。与契约一致。
- 本周页空计划提示（`index` 约第 504 行的 `#wkEmpty`）与 S5 一致。

扣分理由：无。注意 `pkSave` 的失败分支没有文案（见 Experience Design），这属于体验缺口，不是文案错误。文案的语气和可读性需要 Phase 16 人工看（见下方人工验收清单）。

### Pillar 2: Visuals (3/4)

**做得好的：**
- 空计划卡片的层级清楚：`自己建一份` 是卡片里唯一的深色块（`.primary`，`--ink` 底），`从示例里挑` 是 `.ghost` 描边。顺序与 D-04 一致。
- 对话框结构与 UI-SPEC S2 一致：头、可滚动的体、底部栏三段，`dialog#sample` 是 `flex` 列，只有列表滚动。
- 同名标记用描边小标记（`.pk-dup`，`--line` 描边，`--muted` 文字），不用警告色，与契约一致。
- 禁用外观统一为 `opacity:.4;cursor:not-allowed`，覆盖了真 `disabled` 和 `aria-disabled="true"` 两种写法。

**问题：**
- **桌面端按钮低于最小触控高度。** UI-SPEC 写明桌面最小 36px。空计划卡片和编辑页入口没有桌面端的 `min-height`（`.pe-empty-act button{min-height:44px}` 只在 `@media (max-width:560px)` 里，约第 293 行）。按全局 `.ghost`（`padding:5px 10px`，13px 字号）推算，高约 30px；`.primary`（`padding:7px 14px`）推算约 36px，边界。以上为 CSS 推算，未实测。
  - 位置：`us-journey-tracker.html` 约第 63 行（全局 `.ghost`）和第 279 行（`.pe-empty-act`）；`#tab-plan .pe-tools` 约第 308 行。
  - 修复：见 Top 3 的第 1 条。

### Pillar 3: Color (3/4)

**做得好的：**
- 没有新颜色字面量：新增 CSS 中没有 `#hex`、`rgb()`、`rgba()`（`rgba(10,16,30,.45)` 是把 `dialog#sample::backdrop` 并进已有遮罩选择器的既有字面量，不是新增）。
- 选中态按契约做：`--s` 底加 `--ink` 文字，边框换成 `--c`；类别色没有作为文字底。
- 警告色 `--c-job` 只用于 `.pe-why::before` 和 `#pk-hint[data-tone="warn"]` 的圆点；错误 `--red` 只用于 `#pk-hint[data-tone="error"]` 的圆点。
- 复选框 `accent-color:var(--ink)`，不用 accent。

**问题：**
- **选中态依赖 `:has()`。** `.pk-item:has(input:checked)`、`.pk-item:has(input:focus-visible)`、`.pk-item:has(input:disabled)` 是本阶段选中、焦点和禁用外观的唯一通道。旧版浏览器不支持 `:has()` 时，选中行没有底色和边框，焦点环也不显示（见 Top 3 第 3 条）。
- **类别色的出现密度。** 一个打开的挑选对话框里，11 行各有 4px 类别色左边框，另有 7 个类别小标记（`.pk-chip`）。UI-SPEC 允许这种用法，但它在一屏内是最密集的颜色区域。按 60/30/10 的意图，应在 Phase 16 的深色主题下看一眼是否喧宾夺主。这是人工项，不是本次扣分的唯一依据。
- **深色选中态未验证。** `--s` 在深色主题下的值和 `--ink` 文字的对比度，代码里无法判断。见人工验收清单。

### Pillar 4: Typography (3/4)

**做得好的：**
- `dialog#sample` 作用域内只用 12、14、16 三个字号和 400、600 两个字重，与 UI-SPEC 的字号表一致（标题 16px 600 衬线，名称 14px 600，图例和说明 12px）。
- 没有 700、800 字重。

**问题：**
- **13px 字号出现在新作用域里。** `#planSampleBtn`（`.pe-empty-act` 内）和 `#peSampleBtn`（`#tab-plan .pe-tools` 内）是 `.ghost`，继承全局 `.ghost{font-size:13px}`（约第 63 行）。这两个按钮都没有被 Phase 14 的规则覆盖到 14px。UI-SPEC 的 Typography 节明确写「作用域里不出现 13px」，CSS 骨架也没有给这两个按钮设字号，所以是骨架遗漏。
  - 修复：见 Top 3 第 1 条。
- **字号和字重的其余部分**：`.primary`（`#planEditBtn2`）字号没有显式设置，继承正文字号，在 Phase 14 作用域里可接受，但不是契约写明的 14px，建议显式写出。

### Pillar 5: Spacing (3/4)

**做得好的：**
- 对话框间距都是 4 的倍数：`.pk-head` 24px，`.pk-body` 16px/24px，`.pk-sec+.pk-sec` 24px，`.pk-list` 间距 8px，`.pk-foot` 16px/24px。
- 窄屏底部栏用 `calc(24px + env(safe-area-inset-bottom,0px))`，符合契约。
- 挑选行 `padding:12px 16px`，`grid-template-columns:20px`，复选框 20×20，符合契约。
- `.pe-tools` 间距 `8px 12px`，`margin:0 0 16px`，符合契约。

**问题：**
- **按钮内边距不是 4 的倍数。** 空计划卡片和编辑页入口的按钮用全局 `.ghost`（`padding:5px 10px`）和 `.primary`（`padding:7px 14px`）。UI-SPEC 的 Spacing 节写明「所有新增间距都落在 4 的倍数上，没有继承的奇数值例外」。`5px`、`7px` 都违反。
  - 修复：见 Top 3 第 1 条（`8px 12px` 和 `8px 16px`）。
- **窄屏的 `.pk-foot` 按钮内边距被手工覆盖为 12px。** 这是 14-03 为了等宽加的补丁（`dialog#sample .pk-foot button{padding-left:12px;padding-right:12px}`，约第 348 行）。它是 4 的倍数，但说明骨架的 `.ghost` 与 `.primary` 内边距不一致，建议统一写在骨架里，而不是在窄屏补丁里修。

### Pillar 6: Experience Design (3/4)

**做得好的：**
- 状态覆盖充分：空计划、断网（`peBlock()`，`aria-disabled`，原因行可见，点击只弹 toast）、登录过期（优先级最高）、全局门控（真 `disabled`，原因在横幅）、容量超限（留在对话框，`T_PE_HINT_TOOLARGE`）、冲突三选一（回去继续挑保留勾选，覆盖留底，放弃改用新版）。
- 保存中：`pkBusy(true)` 设 `disabled`、`aria-busy`、`保存中…`，`cancel` 事件在忙碌时 `preventDefault()`，遮罩点击也被忽略。
- 键盘：Enter 在复选框上被阻止提交；焦点打开时落在第一个可用复选框；关闭后焦点回到打开它的按钮。
- 编辑页模式：不经过 `planCommit`，只改草稿，断网和过期照样可以挑；焦点移到第一个新卡片的折叠开关，并 `scrollIntoView({behavior:"auto"})`，尊重 `prefers-reduced-motion`。
- 名额：达到上限时其余行真 `disabled`，说明行通过 `aria-describedby` 读出。

**问题：**
- **`pkSave` 的 `!np` 分支静默失败。** `const np=normalizePlan(draft); if(!np){pkBusy(false);return}` 没有任何提示，对话框保持打开，按钮恢复，用户看不到原因（Top 3 第 2 条）。这是本阶段唯一一条没有反馈的失败路径。
- **`pkSave` 的 `blk` 分支与 UI-SPEC S3 步骤 2 略有出入。** 契约写「提示行显示优先级 1 或 2 的文字，按钮恢复，对话框不关」。代码里 `pkSave` 的 `if(blk){toast(blk,null,3000);return}` 只弹 toast，没有更新 `#pk-hint`。实际上 `#pkOk` 带 `aria-disabled` 时点击已经被挡住，所以用户通常走不到这里；但如果 `peBlock()` 在按钮点击和 `pkSave` 之间才变化，提示行不会刷新，只能靠 `setStatus` 的 `pkHint()` 刷新。风险低，但与契约文字不一致，建议改成 `pkHint()` 调用。
- **`:has()` 的降级**（见 Color 和 Top 3 第 3 条）。
- **没有 `pk-dup` 的读屏播报差异。** 同名标记通过 `aria-describedby` 读出，符合契约。但勾选一个 `data-dup` 行时没有额外提示，用户只能靠标记判断。契约允许这样，不扣分，记录在此。

---

## Registry Safety

未启用 shadcn（`components.json` 不存在，UI-SPEC 的 Registry Safety 表无第三方 registry）。本次不执行 registry 审计。

---

## 人工验收清单（Phase 16，不计入通过）

以下项目没有自动判断，按所有者决定推迟到 Phase 16 总体验收，本报告**不**把它们算作通过：

1. 375px 下挑选对话框的底部面板外观：最后一行是否被底部按钮盖住，底部按钮是否在 iOS 安全区之上（`env(safe-area-inset-bottom)` 在桌面 Chromium 中为 0，只能在真机看）。
2. 浅色和深色主题下选中行（`--s` 底加 `--ink` 文字）、复选框对勾、`:focus-visible` 焦点环是否清楚，类别色是否没有被当文字底。
3. 手机宽度下长 toast（`已加到草稿：3 个目标组、2 个力量项，点「保存计划」后生效`、`已加入 … 计划已保存`）是否完整显示、可换行。
4. 本阶段全部新文案的语气和观感（空计划卡片、对话框、冲突框、原因行、toast、本周页提示）。
5. 深色主题下的整体清晰度，以及 Color 节提到的类别色密度。
6. 旧版浏览器（不支持 `:has()`）下选中态是否可用（修复前后都需要人工确认）。

---

## Files Audited

- `us-journey-tracker.html`：
  - CSS：约第 276–352 行（Phase 14 作用域，含 `.pe-empty-act`、`.pe-why`、`#tab-plan .pe-tools`、`dialog#sample`、`.pk-*`、窄屏规则）；全局 `.ghost`、`.primary`、`button`、`dialog#editor`、`dialog#confirm`、`.toast` 的既有规则（约第 44–70、216–231、361–400 行）。
  - 标记：约第 553 行（`dialog#sample` 静态外壳）；约第 541–544 行（`#pe-bar`、`#pe-notice`、`#pe-main` 的顺序）；约第 504 行（`#wkEmpty`）。
  - 渲染和交互：`renderGoals` 空计划分支（约第 2240 行）；`renderPlanEditor` 的 `.pe-tools`（约第 2546 行）；`peRoot` 点击委托（约第 2565 行）；`peBlock`（约第 2481 行）；`pickSample`（约第 910 行）；`planCommit`（约第 2927 行）；`planSavedToast`（约第 2959 行）；`pkWhy`、`openSamplePicker`、`pkRender`、`pkRoom`、`pkHint`、`pkBusy`、`pkAddToDraft`、`pkSave`、事件绑定（约第 3027–3175 行）。
  - 文案常量：约第 2414–2427、2480 行（`T_PE_*`），约第 3022–3041 行（`T_PK_*`）。
  - 样式检查：`style="` 属性出现次数为 0（符合 CSP `style-src-attr 'none'`）；`载入示例计划`、`T_PE_SAMPLE_LOADED`、`loadSampleDraft` 已无残留。
- `.planning/phases/14-plan-onboarding/14-UI-SPEC.md`（审计基线）
- `.planning/phases/14-plan-onboarding/14-CONTEXT.md`
- `.planning/phases/14-plan-onboarding/14-01-SUMMARY.md`、`14-02-SUMMARY.md`、`14-03-SUMMARY.md`
- `.planning/phases/14-plan-onboarding/14-01-PLAN.md`、`14-02-PLAN.md`、`14-03-PLAN.md`（按摘要对照意图，未逐条核对）

未执行：截图、交互捕获、npx、测试运行、.gitignore 修改。本报告未提交。
