# Phase 11 — UI Review（导出、导入与迁移）

**Audited:** 2026-11-11
**Baseline:** `09-UI-SPEC.md`（status: approved，2026-11-08）的 §S3（编辑门控放行名单）、§S4（横幅）、§S5（提示）、§S7（退出确认框）、§S8（工具栏留底按钮）、§Typography、§Spacing、§Color、§无障碍；Phase 11 没有自己的 UI-SPEC，文案语气、确认框、提示时长和门控规则按 `11-CONTEXT.md` 的 D-01 到 D-10 与 Claude's Discretion 核对；Phase 9 没覆盖的地方用抽象六支柱标准。
**Screenshots:** not captured（代码审计。云端导入、撤销和退出确认都需要登录后的假服务器状态，本次审计没有启动浏览器或服务；视觉结论均标注为代码推断，375px 与深色主题仍需人工截图核对）
**Interaction captures:** off（`workflow.ui_interaction_capture` 关闭）
**Scope:** 只审 Phase 11 改动的界面，代码范围为 `git diff d5d9eeb..HEAD -- us-journey-tracker.html`：导入摘要确认框（`confirmBox` 的 `warn` 行 `p.cf-warn` 与摘要行）、导入 / 拒绝 / 大小上限 / 撤销 toast 及其文案常量、`#undoImportBtn` 与撤销确认（含 `T_UNDO_MORE`）、退出确认框的 `T_CF_UNDO` 行、两个导出按钮在所有环境显示、`.toolbar` 在 375px 的换行、旧路径只含计划文件的拒绝提示。

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | 文案常量集中且与 `tests/support/strings.ts` 逐字一致；但导出按钮的 tooltip 写“可导入 Google 日历 / Outlook”，与所有者“CSV 只作备用导出”的决定相反，而且它在云端路径第一次对用户可见；Phase 11 新文案未写进任何 UI 契约 |
| 2. Visuals | 3/4 | 摘要高亮行、撤销按钮与留底按钮沿用 Phase 9 的视觉；但两个暖色按钮并排后提示层级变弱，旧路径的长提示在 375px 下会被挤成窄列换行 |
| 3. Color | 3/4 | 没有新增颜色 token；但 `cf-warn` 把警告色当背景底色用，超出 S4 对中性提示色“只用于色条、边框、状态点”的规定；深色主题没有证据 |
| 4. Typography | 4/4 | 新增控件只用 12px（工具栏）和 14px（对话框正文），字重沿用 400 / 600；没有新增 13、15、19px 或 700、800 |
| 5. Spacing | 3/4 | `p.cf-warn` 新增 `padding:6px 10px`，6 和 10 是 Phase 9 明令不引入的奇数间距；其余新间距在 4 的倍数上 |
| 6. Experience Design | 2/4 | 导入入口在键盘上不可达（BLOCKER）；门控期间导出按钮被禁用、`恢复` 被静默禁用且外观不变；撤销在无改动时不确认即撤回整次导入 |

**Overall: 18/24**

**判定：有 1 个 BLOCKER。** 键盘用户无法触发“恢复”（导入）。该缺陷不是 Phase 11 新引入的结构（v1 就是 `<label>` 包住隐藏的 `<input type=file>`），但 Phase 11 第一次在云端路径放开了这个入口（`us-journey-tracker.html:336`；CONTEXT 记录 Phase 9 时云端路径在 `:735` 隐藏了这个入口，本阶段放开），因此它现在阻断云端导入任务的键盘完成路径。其余为 WARNING。

---

## Top 3 Priority Fixes

1. **键盘用户无法导入（BLOCKER）** — `恢复` 是 `<label class="ghost">`（`us-journey-tracker.html:336`），里面的 `<input type="file" class="hidden">` 是 `display:none !important`（`.hidden`，`:70`），label 本身不可聚焦，没有任何键盘路径能打开文件选择。用户只能用鼠标或触摸导入，与 IO-07、IO-10 的云端导入要求冲突。修复：把 label 换成真正的 `<button type="button" id="importBtn" class="ghost">恢复</button>`，点击时调用 `$("importJson").click()`；`#importJson` 保留隐藏；这样它也自动进入 `applyGate` 的按钮列表（见第 2 条）。

2. **门控期间备份与恢复入口失效（WARNING，与 09-UI-SPEC S3 冲突）** — 导出两个按钮（`#exportCsv`、`#exportJson`，`:334`、`:335`）不在 `GATE_ALLOW`（`:887`），连不上服务器（只读）或对账中都会被 `applyGate` 禁用（`:889-895`）。恰恰是服务器连不上、用户最想先备份的时候，备份入口不可用；S3 的放行原则“只是看的入口照常可用”，以及同一工具栏里 `#snapshotBtn` 被放行的先例，都与此矛盾。11-08-SUMMARY 记录的这一决定是有意为之，但它与 09-UI-SPEC 的放行原则冲突，且没有写进契约。另外 `恢复` 的 `<input>` 被禁用后，`<label>` 外观不变（没有 `opacity`，也没有 `data-gated` 标记的视觉样式），点击后 `onImportFile` 直接静默返回（`:1401-1404`），没有任何提示。修复：把 `#exportCsv`、`#exportJson` 加入 `GATE_ALLOW`（并把契约 S3 的放行名单同步更新）；`恢复` 按第 1 条改成 button 后由 `applyGate` 统一变淡，并在门控时给出一句 toast 说明原因。

3. **旧路径的长提示在手机宽度下窄列换行，且一条新提示只显示 1.8 秒（WARNING）** — `.toast` 的宽度规则只对 `[data-cloud]` 生效（`:212-213`）。旧路径的 `toast(T_IMP_PLAN_LOCAL)`（`:1425`）、`T_IMP_TOO_BIG`（`:1406`，旧路径时 `ms` 为 `undefined`）没有 `data-cloud`，因此是 `position:fixed; left:50%` 的收缩宽度，在 375px 下可用宽度约为视口的一半，长句会被压成多行窄列；同时 `T_IMP_PLAN_LOCAL`（27 个字，含原因和怎么办）只显示 1800 毫秒，读不完。修复：把 `.toast{width:max-content;max-width:calc(100vw - 32px)}` 提到通用规则，或者让旧路径的新提示也传 `ms`（建议 4000）并加 `data-cloud`；注意这会改动 v1 旧提示的外观，需要在 v1 用例里一并核对。

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**正面证据（逐字核对，代码与 `tests/support/strings.ts` 一致）：**

- 摘要确认框：`导入这个文件？`、`不导入` / `导入`、`文件类型：新格式备份（计划和记录）`、`将替换：当前账号的计划和记录`、`记录 N 条（起 至 止）`、`复盘 N 周，完成的任务 N 项，力量记录 N 条`、`计划：目标组 N 个，任务 N 项，力量项 N 个`、`当前账号现有记录 N 条`、`导入前的数据会在这台设备上留一份，导入后可以撤销。`（`:1360-1395`；`strings.ts:401-445`）
- 旧备份 `将替换：当前账号的记录，计划不变`（D-02）与只含计划的 `将替换：当前账号的计划，记录不变`（D-03）都写清了“什么不变”，符合 Copywriting 原则“说清发生了什么”。
- 撤销：`撤销导入？`、`导入之后又有新的修改，撤销会把这些修改一起撤掉。`、`刚才确认的时候又收到了其他设备的修改，撤销也会把它们一起撤掉。`、`不撤销` / `仍然撤销`、`已撤销导入，恢复成了导入前的样子`（`:1376-1377`）。`T_UNDO_MORE` 只在确认框重开时才追加一行，符合 D-05。
- 退出确认的条件行 `这台设备上还能撤销上一次导入，退出后就不能撤销了。`（`:1710`）与契约 S7 的条件行语气一致。
- 拒绝和大小提示：`文件格式不对，请选择导出的备份 .json`、`文件太大（超过 5 MB），没有导入`、`数据超过容量上限（4 MB），没有导入`（`:1370`、`:1409`）。

**问题：**

- **WARNING — 导出按钮的 tooltip 与所有者的决定相反。** `#exportCsv` 的 `title="可导入 Google 日历 / Outlook"`（`:334`）。所有者在 CONTEXT（规划核查第 4 轮）明确写明：“所有者不把日历 CSV 导入任何日历，CSV 只作备用导出”。这句话在 v1 的 `title` 里就存在，但 Phase 11 之前云端路径隐藏了这个按钮，Phase 11 第一次让云端用户看到它的 tooltip。修复：改成与决定一致的说明，例如 `备用导出：表格软件可以打开的日历表`，并把新文字同步到 `strings.ts`。
- **WARNING — 新文案没有进入任何 UI 契约。** Phase 11 没有 UI-SPEC；CONTEXT 要求“新增的文案按 09-UI-SPEC 的语气写，集中成常量，并同步到 `tests/support/strings.ts`”。第二项已完成，但 `09-UI-SPEC.md` 的 S5 提示表和 Copywriting Contract 里没有任何 Phase 11 的提示（导入成功、撤销成功、大小上限、撤销确认、旧路径拒绝）。这与 10-UI-REVIEW 指出的追溯问题相同。修复：在 09-UI-SPEC 增加一个 Phase 11 的附录段，列出上面的文案并由所有者确认。
- **WARNING — 两个拒绝文案缺“怎么办”。** `T_IMP_NO_UNDO`（`本机空间不够，没能留下导入前的数据，所以没有导入`，`:1375`）和 `T_IMP_TOO_LARGE`（`数据超过容量上限（4 MB），没有导入`，`:1370`）只说发生了什么。Copywriting 原则要求“能自救时说怎么办”：前者可以写“先在设备上清理空间，再重新导入”，后者按 S9 写“请联系管理员”。
- **INFO — 摘要里的日期是 ISO 格式。** `importLogsLine` 直接输出 `2026-02-10 至 2026-03-17`（`:1362`），而应用其他地方的日期是 `3月16日` 这类中文格式。不影响理解，但与应用风格不一致。
- **INFO — 确认框标题 `导入这个文件？` 没有说出后果。** 后果写在正文里，但按钮是红色 `danger` 的 `导入`。这与 S7 的“标题写清要做什么”不完全一致，可接受。
- **INFO — 旧路径的原生 `confirm()` 文案 `用备份文件替换当前所有内容？`** 与云端摘要框的语气不同，这是 D-09 的所有者决定，记录在案。

### Pillar 2: Visuals (3/4)

**正面证据：**

- 撤销按钮 `#undoImportBtn` 与留底按钮 `#snapshotBtn` 共用一条 CSS 规则（`:60`），12px、`--ink` 文字、`--c-job-s` 底、`--c-job` 边框，与 S8 的常驻入口一致。
- 两个按钮都带 `aria-label` 和 `title`，`aria-label` 以可见文字开头（`撤销导入：…`），满足 WCAG 2.5.3 的“标签包含在名称中”。
- 摘要确认框的高亮行 `p.cf-warn`（`:227`）除了底色和左边框，还用文字“建议先导入计划”或“导入后会丢弃”承载含义，不是只靠颜色。
- 工具栏顺序在 `#snapshotBtn` 之后放 `#undoImportBtn`，再接导出，符合 D-04 的“在导出按钮那一栏”。

**问题：**

- **WARNING — 两个暖色按钮并排，提示层级变弱。** 工具栏里 `下载留底`（待下载的旧版本）和 `撤销导入`（导入后可撤销）都是 `--c-job-s` 底、`--c-job` 边框。S8 的意图是“一排灰色 `.ghost` 里有一个提示，但不刺眼”；现在有两个提示同时出现，用户分不清哪个更紧急。修复：撤销按钮保留普通 `.ghost` 外观，只在 `title` 与 `aria-label` 里说明，或者给撤销一个不同的中性样式（不用 warn 色），让 `下载留底` 仍是唯一的 warn 按钮。
- **WARNING — 旧路径的 toast 在 375px 下窄列换行（代码推断，待截图核对）。** `.toast` 是 `position:fixed; left:50%`，宽度按收缩规则取 `min(max-content, 可用宽度)`，可用宽度是视口的一半左右。只有 `[data-cloud]` 的 toast 有 `width:max-content`（`:213`）。旧路径的 `T_IMP_PLAN_LOCAL`（27 字）和 `T_IMP_TOO_BIG`（16 字）会被压成多行。修复见 Top 3 第 3 条。
- **WARNING — 工具栏在 375px 的换行未核对（backstop）。** 工具栏现在最多 6 个控件加一个 `.who`（≤560px 隐藏），`.toolbar` 是 `flex-wrap`，按 `nav.tabs` 的规则换行，估计占 2 到 3 行，并与 4 个标签页按钮同处一个 `nav.tabs`（`:326`、`:57`）。没有截图无法确认是否挤压标签页。验收时需要在 375px 截图核对。
- **INFO — 摘要确认框在窄屏的高度没有上限。** `dialog#confirm` 在 ≤560px 是底部抽屉（`:221`），没有 `max-height` 或 `overflow`。摘要最多 7 行加标题和按钮，竖屏 375×667 足够；横屏手机（约 667×375）可能超出视口顶端而被截断。记录为待核对。
- **INFO — 确认框里的 `cf-warn` 行是唯一的高亮，符合 D-07 的“醒目”要求。** 视觉上它比其他行重，这是预期。

### Pillar 3: Color (3/4)

**正面证据：**

- 没有新增颜色 token。新规则只使用 `--ink`、`--c-job`、`--c-job-s`、`--red`（既有 token，`:13`、`:25`、`:32`）。
- 文字颜色全部是 `--ink`，没有把 `--c-job` 当文字色（对比度不够，S1 已禁止）。
- 深色主题下 `--c-job-s` 为 `#3A2E16`，`--ink` 为浅色（`:25`、`:32`），高亮行的对比度应当足够，但没有计算。

**问题：**

- **WARNING — 警告色被用作对话框行的底色，超出契约。** S4 规定中性提示色“只用于色条、边框、状态点”；`#cf-body p.cf-warn{background:var(--c-job-s)}`（`:227`）把它用作一整行的底色。S8 允许 `#snapshotBtn` 用 `--c-job-s` 底，但那是按钮的既定例外，不是对话框文本行的先例。效果上是合理的，但要么写进契约，要么改成只用左边框加 `--c-job` 色条，底色保持 `--surface`。
- **WARNING — 深色主题没有证据（与 Phase 9、Phase 10 相同的待测项）。** S 契约要求 `colorScheme:'dark'` 下看一眼登录、横幅和确认框。Phase 11 的摘要确认框和撤销确认框还没有这次核对。
- **INFO — 工具栏同时出现两个 warn 色按钮，见 Visuals。**

### Pillar 4: Typography (4/4)

**正面证据（代码逐条核对）：**

- 新增的字号只有 12px（`#undoImportBtn`，`:60`）和 14px（`#cf-body`，`:223`；对话框按钮由 `dialog#confirm` 的 `button{font-size:14px}` 覆盖）。
- 字重只用 600（`.toast[data-cloud] button`，`:212`；`dialog#confirm .ed-h h3` 16px 600，`:222`）和 400。
- 摘要确认框的标题沿用 Phase 9 的 16px 600 衬线（`dialog#confirm .ed-h h3`）；`cf-warn` 行是 14px 400。
- 没有发现 13px、15px、19px 或 700、800 用在 Phase 11 的新控件上。

**问题：**

- **INFO — 旧路径的 toast 按钮是 700 字重。** `.toast button{font-weight:700}`（`:211`）是 v1 的既有规则。Phase 11 新增的撤销按钮在云端路径走 `[data-cloud]`，字重是 600，符合契约；旧路径没有新的按钮 toast，所以不新增问题。记录在案。

### Pillar 5: Spacing (3/4)

**正面证据：**

- `#cf-body p+p{margin-top:6px}`（`:225`）是 Phase 9 之前就有的旧规则（`d5d9eeb` 中已存在），不计入本阶段。
- `#undoImportBtn` 与 `#snapshotBtn` 共用 `.ghost` 的 `5px 10px` 内边距，符合 S 契约的继承值。
- 工具栏间距沿用 `.toolbar gap:6px`（`:57`），是既有继承值。

**问题：**

- **WARNING — 新增的 `padding:6px 10px` 是 Phase 9 明令不引入的奇数间距。** `#cf-body p.cf-warn{...padding:6px 10px;border-radius:6px}`（`:227`）。09-UI-SPEC 的 Spacing 节写明“只使用 4 的倍数……不引入 6、10、14、18、22 这类奇数间距”。修复：改成 `padding:8px 12px`（都是 4 的倍数，且 12 与契约的 `inherit-gap-12` 一致）。
- **INFO — 工具栏在窄屏的行距未核对。** 见 Visuals 的 backstop，375px 下的换行间距需要截图。

### Pillar 6: Experience Design (2/4)

**正面证据：**

- 摘要确认框按 D-01 到 D-03 区分三种文件，只替换契约中写明的内容；拒绝路径（`{}`、`[]`、非 JSON、类型不对）不弹确认，只弹 toast，数据不变（`onImportFile`，`:1401-1411`）。
- 文件框在 `finally` 里清空（`:1411`），取消、拒绝、成功都能再次选择同一个文件，符合 IO-10。
- 撤销按钮的显示由 `undoShow()` 统一控制（`:1112`），退出、换账号、另一标签页的 storage 事件都会刷新它（`:1520`）。
- 撤销在有后续修改时先弹确认，并且确认框重开时用 `T_UNDO_MORE` 说明新增的同步修改（`:1468-1501`），符合 D-05。
- 导入前先写快照，写不下就拒绝导入并提示（`:1446`），符合“不能悄悄失败”。
- 退出确认在存在撤销副本时追加 `T_CF_UNDO`（`:1760`），用户知道退出后不能再撤销。

**问题：**

- **BLOCKER — 键盘用户无法导入。** `恢复` 是 `<label>` 包住隐藏的 `<input type=file>`（`:336`），`.hidden{display:none !important}` 让 input 不可聚焦，label 不可聚焦也没有 `role`。Tab 顺序里没有任何可以触发文件选择的元素，因此键盘用户在云端路径无法完成导入（IO-07、IO-10 的核心路径）。该问题在 v1 就存在，但 Phase 11 第一次在云端路径放开导入入口，所以它现在阻断云端的任务完成。修复见 Top 3 第 1 条。
- **WARNING — 门控期间，导出按钮被禁用（与 09-UI-SPEC S3 冲突）。** 见 Top 3 第 2 条。11-08-SUMMARY 记录这是有意决定，但 S3 的放行名单原则要求“只是看”的入口保持可用，`#snapshotBtn` 的先例也是如此。
- **WARNING — 门控期间，`恢复` 静默失效且外观不变。** `applyGate` 只禁用 `button, input, select, textarea`（`:891`），`<label>` 不被禁用也不变淡；点击后 `onImportFile` 在 `document.body.dataset.gate` 时直接返回（`:1404`），没有 toast，用户得不到任何解释；文件框仍会在 finally 里清空（`:1411`）。用户会觉得按钮坏了。修复见 Top 3 第 2 条。
- **WARNING — 撤销在没有后续修改时不确认，且撤销不可逆。** `undoImport` 只有在 `seen!==rec.after` 时才弹确认（`:1473-1488`）。没有后续修改时，点一下 `撤销导入`（`:333`，`.ghost` 外观，与 `备份` 同排）就会整份替换回导入前的数据，成功后快照被删除（`:1497`），导入的数据不再留在本机，也没有“撤销撤销”。这符合 D-05 的字面规定，但对“整份替换”这种低频、高影响的操作来说，误点的代价很高。建议所有者决定：要么无论是否有改动都确认一次（文案用 `T_UNDO_TITLE` 与 `T_UNDO_CHANGED` 的变体），要么接受这一风险并记录在案。
- **WARNING — 旧路径的 1.8 秒长提示（`T_IMP_PLAN_LOCAL`）。** 这是 Phase 11 新增的拒绝原因，27 个字，只显示 1800 毫秒（`:1425` 没有传 `ms`）。CONTEXT 的 D-10 要求“说明原因”，但读不完的提示等于没说。修复见 Top 3 第 3 条。
- **WARNING — 日历 CSV 没有 BOM，在 Excel 等软件里打开中文会乱码（所有者已决定，记录在案）。** `csvCell`（`:2034`）为公式注入加前缀是正确的，但 CSV 本身是 UTF-8 无 BOM（`:2049`），在中文 Windows 的 Excel 里打开会出现乱码。CONTEXT 写明“不加 BOM，与原 Artifact 的导出一致；验收不做真实日历导入，只做逐字节比对”。但 B7 的前缀保护的恰恰是“在表格软件里打开 CSV 的人”，而他们会先看到乱码。建议所有者重新考虑是否加 BOM；这里不改决定，只记录后果。
- **INFO — 导入成功的 toast 只说“已导入”。** `TOAST_IMPORTED`（`:1460`）8000 毫秒，带 `撤销导入` 按钮，足够。摘要确认框已经给出了条数，符合预期。

---

## Registry Safety

Registry audit: 0 third-party blocks checked（`components.json` 不存在，UI-SPEC 的 Registry Safety 为 none）。唯一的外部代码是已批准的 PocketBase SDK，同源加载并钉 sha256，不属于 UI 组件的审查范围。

---

## Files Audited

- `us-journey-tracker.html`
  - CSS：`:57`（`.toolbar`）、`:60`（`#snapshotBtn,#undoImportBtn`）、`:61`（`#logoutBtn,.who`）、`:208-213`（toast 与 `data-cloud`）、`:219-227`（`dialog#confirm`、`#cf-body`、`p.cf-warn`）
  - HTML：`:326-338`（导航与工具栏：`#snapshotBtn`、`#undoImportBtn`、`#exportCsv`、`#exportJson`、`恢复` label、`#who`、`#logoutBtn`）、`:385`（`dialog#confirm`）
  - JS：`:887-895`（`GATE_ALLOW`、`applyGate`、`setGate`）、`:1112`（`undoShow`）、`:1137`（`T_OFFLINE`，仅作交叉参照）、`:1360-1395`（导入文案与 `importLines`）、`:1401-1411`（`onImportFile`）、`:1413-1423`（`cloudImport`）、`:1424-1435`（`legacyImport`）、`:1437-1466`（`applyImport`）、`:1468-1501`（`undoImport`）、`:1710`（`T_CF_*`）、`:1753-1763`（`onLogoutClick`）、`:2034-2066`（`csvCell`、`blobDownload`、`saveFile`、导出与导入的绑定）、`:2067`（`toast`）
- `tests/support/strings.ts`（`:391-471`，Phase 11 的文案常量，与应用逐字对照）
- `.planning/phases/09-login-cloud-storage/09-UI-SPEC.md`（审计基线：S3、S4、S5、S7、S8、S9、Typography、Spacing、Color、无障碍）
- `.planning/phases/09-login-cloud-storage/09-UI-REVIEW.md` 与 `10-UI-REVIEW.md`（格式参照；10-UI-REVIEW 的 Top 3 与本阶段无直接重叠，离线与重试文案问题仍然存在但不在 Phase 11 范围）
- `.planning/phases/11-export-import-migration/11-CONTEXT.md`、`11-01-SUMMARY.md` 至 `11-11-SUMMARY.md`（尤其 11-07、11-08 的门控与旧路径决定）
- `.planning/phases/11-export-import-migration/11-SECURITY.md`（仅核对导出文件不含账号标识、CSV 前缀的记录，未审安全结论）
