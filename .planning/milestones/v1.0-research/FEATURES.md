# Feature Research

**Domain:** 单文件个人追踪器（`us-journey-tracker.html`）的浏览器端到端测试套件，外加 Claude Artifact API（`db` / `user` / `downloads`）mock
**Researched:** 2026-11-01
**Confidence:** HIGH（应用行为全部来自逐行阅读 `us-journey-tracker.html`，669 行）；MEDIUM（个别 Playwright API 行为来自既有知识，未在本机运行验证，已在正文逐条标注）

## 研究范围与读法

- 这里的 "feature" 指 **测试套件要覆盖的交互**，加上 mock 与 fixture 层要支持的能力。行为期望全部取自源码，不是取自推测。源码行号写作 `L<n>`。
- 本文**不抄录**应用里属于所有者个人计划的内容（目标组任务文字、力量目标数值、预设标签文字）。目标组用 `P1`–`P7` 加序号指代，预设标签用 "某类别第 n 个" 指代，力量项用 id（`bench` / `squat` / `dead` / `pull`）指代。测试应从 DOM 读取这些值，不要写死。
- 已知问题编号（在"已知 bug 对照表"里展开）：`B1` 草稿丢失，`B2` 取消导入后无法重选，`B3` 加载完成前的编辑被丢弃，`B4` 复盘末尾 ~1.4 s 丢失，`B5` 保存失败不重试（延期），`B6` 导入 XSS，`B7` CSV 公式注入，`B8` 导入校验过浅，`B9` 跨午夜不更新，`B10` 位置 id，`B11` 加载失败回退（延期），`B12` 256 KiB（延期）。`N1`–`N3` 是本次阅读源码**新发现**、未写入 CONCERNS.md 的行为，在没有实际运行确认前置信度为 MEDIUM。

## Feature Landscape

### Table Stakes（缺了就不能算"近乎完整的交互覆盖"）

复杂度：LOW = 一个 spec 内几行；MEDIUM = 需要夹具/辅助函数或多步状态；HIGH = 需要特殊机制（拖拽、时钟、对话框、跨视图）。

#### A. 基础设施（所有其他测试的前置）

| ID | Feature | Why Expected | Complexity | Notes |
|----|---------|--------------|------------|-------|
| F-1 | 网络护栏：拦截所有非本地请求（含 `fonts.googleapis.com` / `fonts.gstatic.com`），并断言**没有**任何请求逃逸 | PROJECT.md 硬约束：绝不接触 claude.ai 或生产存储 | LOW | 做成自动 fixture（每个测试都带）。页面 `<link>` 引用了 Google Fonts（L7–L9），被拦截后应用必须照常渲染，这本身就是一条断言 |
| F-2 | 固定时钟 + 固定时区/语言 | `today()`、计数器、本周、过期判断、日历 `today`/`sel` 全部依赖 `new Date()`（L333） | MEDIUM | `page.clock.setFixedTime(...)` 只固定 `Date`，保留真实计时器（需要 Playwright ≥1.45，MEDIUM 置信度）。防抖（600 ms / 800 ms）和 toast（1.8 s / 5 s）用的是真实 `setTimeout`，因此等待要靠轮询存储或 `.on` 类，不要睡眠 |
| F-3 | 页面错误护栏：每个测试自动监听 `pageerror` 和 `console.error`，出现即失败 | 渲染器抛错会让界面画一半（见 B8）；这是最便宜的回归网 | LOW | 对已知会抛错的 `test.fail` 用例，在用例内显式豁免 |
| F-4 | 冒烟：空存储启动 → 四个标签都能切换、状态行显示本地标签、计数器显示"先设置抵达日期"、导出按钮隐藏 | 对应 PROJECT.md 核心价值 "一条命令验证四视图能渲染" | LOW | 初始 DOM 见 L229–L294；初始状态行 "正在加载…" 之后变为存储标签 |
| F-5 | `openApp(page, {mode, seed, today})` 辅助函数：local / account 两种模式，种子数据，固定时钟 | 所有 spec 共用，避免每个文件重复拼装 | MEDIUM | 注意 `addInitScript` 在 **reload 时会再次执行**：种子必须带保护（例如 localStorage 已有键就不再写入），否则"刷新后数据仍在"的测试会被种子覆盖 |

#### B. 页头（抵达日期与天数计数器）

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| HDR-1 | 无抵达日期 | `#counter` 显示 "先设置抵达日期"；`#arrival` 值为空（L446） | LOW | |
| HDR-2 | 设置抵达日期 = 今天 | 计数器 "来美国第 **1** 天"（`days = round((今天-抵达)/天)+1`，L444–L445） | LOW | 边界值 |
| HDR-3 | 抵达日期在过去 | "来美国第 N 天"，N = 天数差 + 1（例：今天 03-18，抵达 03-17 → 第 2 天） | LOW | 跨 DST（美东 3 月 8 日）靠 `Math.round`，可用美东时区做一条可选用例 |
| HDR-4 | 抵达日期在未来 | "还有 N 天出发"，N = `1-days` = 抵达与今天的天数差（抵达明天 → "还有 1 天出发"，`days` 为 0 走此分支） | LOW | |
| HDR-5 | 清空日期 | 回到 "先设置抵达日期"；`state.arrival=""` | LOW | |
| HDR-6 | 联动：设置抵达日期后 `renderAll()` | 本周标题变 "来美国第 N 周"（L452）；日历抵达日格子带 `.arr` 类（"抵美" 徽标是 `::after` 伪元素，只能断言类或 computed style，**不能按文字查**）；日面板副标题 "来美国第 N 天"（`sel>=arrival`）否则 "YYYY 年"（L497） | MEDIUM | 同时是跨视图联动的样本 |
| HDR-7 | 持久化 | 修改后等防抖落盘，刷新后值仍在 | LOW | 合并进 PER-1 |

#### C. 本周视图

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| WK-1 | 默认渲染 | 周一至周日 7 个 `.day[data-wday]`；今天带 `.today` 且（初始）`.sel`；5 张 `.area` 卡（语言/专业/健身/求职/其他）；`#wkRange` 同月显示 "M月D日 – D日"，跨月显示 "M月D日 – M月D日"（L455） | LOW | 用跨月周（例如周一 03-30 – 周日 04-05）验证后一种 |
| WK-2 | 标题三态 | 有抵达日期且 `wk >= monday(抵达)` → "来美国第 N 周"；否则若 `wk` 是当前周 → "本周"；否则 "这一周"（L451–L453）。抵达日期之前的周显示 "这一周" | LOW | 需要夹具含 "抵达日期之前" 可翻到的周 |
| WK-3 | 上一周 / 下一周 / 本周 | `wk±7`，且 `wsel` 被重置为**新一周的周一**（不是今天）；"本周" 把 `wk` 设回本周一，`wsel` 设为今天；只重绘本周视图（`renderWeek`，L607–L609），日历选中不变；记一笔下方文字 "记录到 M月D日 周X" 随之变化 | MEDIUM | 两个导航按钮用 `aria-label` "上一周" / "下一周"，本周按钮文字是 "本周"（注意与标签页"本周"同名，需限定范围） |
| WK-4 | 类别计数 | 每类 `n` = 本周该类日志数 + 本周完成的、所属组归该类的计划数（L460）；P1→语言，P2–P5→专业，P6→求职，P7→其他；**健身没有目标组**，其计数只来自日志 | MEDIUM | 翻周后计数随周变化 |
| WK-5 | 目标行 | 健身行 "训练 N 天，目标 3～5 天"，N 为本周有健身日志的**不同日期数**，N≥3 时带 `.ok`；其他类 "N 天有记录"（不同日期数，不计完成的计划，L462–L463） | MEDIUM | 夹具要有一周健身 ≥3 天、另一周 <3 天 |
| WK-6 | 选中某天 | 点击 `.day` → 该列带 `.sel`，其余失去；记一笔文字变为该日期；`Enter` / `Space` 在聚焦的 `.day` 上等价（L611–L612） | LOW | `B1`：此时未提交的草稿丢失 |
| WK-7 | 列内条目 | 日志条目 `.ent`（文字已转义）；完成的计划条目 `.ent.done`，文字带 "✓ " 前缀；**到期的计划不显示在本周视图**（只在日历和日面板）；`.day` 的 `aria-label` 为 "M月D日，N 项，点击选为记录日期"（N = 日志 + 完成数） | LOW | 含 HTML 特殊字符的日志用来验证 `esc()` |
| WK-8 | 点击条目打开编辑器而不是选中日期 | 捕获阶段监听器 `stopPropagation`（L551–L552）：编辑弹窗打开，`wsel` 不变 | LOW | 这是 CONCERNS 里点名的 "delete / edit / select stay distinct" |
| WK-9 | 拖拽日志到另一天 | 目标日 `dragover` 时加 `.drop`；`drop` 后 `log.date` 变更、条目移到目标列、toast "已移到 M月D日"、持久化；拖到**同一天**：不改日期、无 toast、仅重绘本周；完成的计划条目**不可拖**（无 `draggable`）；`dragend` 清除 `.dragging` / `.drop`（L597–L605） | HIGH | 桌面 Chromium/Edge 上 `locator.dragTo()` 可驱动 HTML5 拖拽；备选是 `dispatchEvent('dragstart'/'dragover'/'drop', {dataTransfer})`，应用用内部变量 `dragId` 而不是读 `dataTransfer`（MEDIUM 置信度）。**触摸/移动模拟下不要测拖拽**（HTML5 DnD 不支持触摸） |
| WK-10 | 本周复盘 | `#review` 显示 `state.reviews[当前周一]`；输入后 800 ms 防抖写入 state、再 600 ms 防抖落盘；每周独立（键是该周周一的日期，输入时捕获周）；清空或只含空白时**删除该键**；存入的值**不做 trim**（L613） | MEDIUM | 等待要轮询存储。`B4`：输入后立刻刷新会丢失。`N2`：见下 |
| WK-11 | 本周视图中**没有**删除按钮 | 删除只能走日面板的 × 或编辑弹窗的 "删除" | LOW | 一条否定断言，防止以后误加 |

#### D. 记一笔 composer（本周 `w` 与日历日面板 `c` 各一个实例，行为相同，应对两处都测）

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| CMP-1 | 类别切换 | 5 个按钮（`aria-pressed`），默认 "语言"；切换后按钮状态、预设标签列表随类别更换；草稿保留；编辑/添加模式被重置；两个 composer 各自独立记录选中类别（`compCat.w` / `compCat.c`），且跨重绘保持（L342, L416） | LOW | |
| CMP-2 | 记录按钮可用性 | `#w-add` / `#c-add` 初始 `disabled`；文本去空白后非空才可用；纯空白保持禁用 | LOW | |
| CMP-3 | 记录一条 | 点 "记录"：以所选类别、目标日期（本周=`wsel`，日历=`sel`）新增日志，toast "已记录"，textarea 清空，条目出现在本周列 / 日历 chip / 日面板 / 时间线 / 对应类别计数（L411） | MEDIUM | 新日志 id 由 `uid()` 生成，按文字定位，别按 id |
| CMP-4 | `Ctrl+Enter`（及 `Meta+Enter`）记录；单独 `Enter` 换行 | `btn.click()`（L412）；按钮禁用时无效果 | LOW | Playwright 用 `Control+Enter` |
| CMP-5 | 预设标签：不以 "：" / ":" 结尾 → **直接记录** | 立即 `addLog`，toast "已记录：<标签>"，无需草稿（L419） | LOW | 例：语言类、健身类、求职类的后两个、"其他" 无预设 |
| CMP-6 | 预设标签：以 "：" / ":" 结尾 → **预填** | 不新增日志；textarea 为空 → 填入标签；非空 → "原文\n标签"；textarea 获得焦点，记录按钮变为可用（L420） | LOW | 例：专业类全部、求职类前三个。区分直接记录还是预填的判断就是 `fills()` 正则 |
| CMP-7 | 添加标签 | "+ 添加标签" → 出现 `#w-padd` 输入框并聚焦；`Enter` 提交：新标签追加在列表**末尾**，toast "已添加标签：x"，写入 `state.presets[类].add`；`Escape` 取消（不添加）；失焦也会提交；与现有标签重名 → toast "已经有这个标签了"；空串 → 什么也不做；`maxlength=30`（L429–L435） | MEDIUM | 提交用 `Enter` 而不是点别处：失焦提交会重绘 composer，随后的点击可能落空（flake 风险） |
| CMP-8 | 编辑模式 | "编辑" 切换为 "完成"，每个标签出现 "×"（`aria-label` "删除标签 x"），点标签本身**无效果**，提示文字变 "点 × 删除标签"（L394–L398, L418） | LOW | 某类无预设时（默认 "其他"）**没有** "编辑" 按钮，提示 "添加常做的事，以后点一下就能记录" |
| CMP-9 | 删除标签与撤销 | 删内置标签 → 记入 `hide`；删自定义标签 → 从 `add` 移除；toast "已删除标签：x" + "撤销"；撤销恢复整个 `presets[类]` 快照，composer 仍处于编辑模式（L423–L427） | MEDIUM | 再添加同名的已隐藏内置标签 → 取消隐藏并回到**原位置**，不会重复进 `add`（L432） |
| CMP-10 | 标签按类别隔离且持久化 | 加在某类的标签不出现在另一类；刷新后仍在 | LOW | |
| CMP-11 | 切类别 / 加标签 / 切编辑模式**保留草稿** | `refresh()` 保存并还原 textarea 值（L413） | LOW | 与 B1 形成对照：这三种保留，换日期不保留 |
| CMP-12 | 草稿跨日期保留（期望行为） | 期望：切换日期后草稿仍在。现状：被清空 | LOW | **`test.fail`（B1）**，本周与日历各一条；`N1` 说明触发面更宽 |

#### E. 日历视图

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| CAL-1 | 默认渲染 | 标题 "YYYY 年 M 月"；表头 "日一二三四五六"（**周日在前**，与本周视图的周一在前不同）；格子是 `button.cell[data-date]`；当月外的格子带 `.out`；今天 `.today`；选中 `.sel`；抵达日 `.arr` | LOW | |
| CAL-2 | 格子数 | 第 36 个格子（下标 35）仍落在其他月份时停止 → **35 格**，否则 **42 格**（L485–L487） | MEDIUM | 用固定月份验证：2026 年 11 月为 35 格，2026 年 8 月为 42 格（均为本文推算，建议在 phase 中用 `new Date` 核对） |
| CAL-3 | 上/下个月 | `view` 移动一个月，**不改 `sel`**，日面板不变；跨年（12→1）标题正确 | LOW | `aria-label` "上个月" / "下个月" |
| CAL-4 | "今天" 按钮 | 回到当前月，`sel=today`，重绘日历与日面板（L617） | LOW | |
| CAL-5 | 点击格子 | `sel` 更新，面板标题 "M月D日 周X"；点击当月外的格子 → 视图跳到该月；格子 `aria-label` 为 "M月D日，N 条记录，N 项到期，N 项完成" | MEDIUM | `B1`（日历侧）：未提交草稿丢失 |
| CAL-6 | chip 渲染 | 顺序：日志、到期、完成；日志 chip 带类别色类；到期 chip `.due`；完成 chip `.done`；每格最多 3 个，超出显示 "+N"（`.more`）；已完成的计划**只**以 `.done` 出现在完成日，不再作为到期出现（L383–L384） | MEDIUM | 夹具需要某天 ≥4 个事件 |
| CAL-7 | 日面板分区 | "做过的事"（日志，空则 "这天还没有记录。"）；"完成的计划"（有才显示）；"这天到期"（有才显示，**不可点击编辑**） | LOW | |
| CAL-8 | 日面板记一笔 | 记录到 `sel`；chip 与列表同步出现 | LOW | 复用 CMP-* |
| CAL-9 | 日面板删除与撤销 | "×"（`aria-label` "删除这条记录"）：只删除，**不打开编辑器、不改选中**（捕获阶段 `stopImmediatePropagation`，L550）；toast "已删除这条记录" + "撤销"；撤销把日志插回**原下标**并 toast "已恢复"；5 s 内可撤销 | MEDIUM | |
| CAL-10 | 日面板条目点击 | 日志 `li[data-edit]` → 日志编辑器；完成的计划 `li[data-edittask]` → 计划编辑器 | LOW | |
| CAL-11 | 跨视图 | 在本周/目标页的改动在日历 chip 与日面板中同步 | MEDIUM | 归入 X-1 |

#### F. 目标视图

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| GL-1 | 默认渲染 | 4 张力量卡（`bench` / `squat` / `dead` / `pull`），`P1`–`P7` 七个目标组，每组 "已完成/总数"（`.cnt`）、进度条 `.bar i` 宽度 = 完成/总数；仅 `P2` 带说明文字（L520）。内置任务总数 38（P1:5, P2:12, P3:7, P4:4, P5:4, P6:5, P7:1，本文清点） | LOW | 数量从 DOM 读取，不要在 spec 里写死具体任务文字 |
| GL-2 | 力量更新 | 改 `#lf-<id>` 的值 → "保存" 按钮（`data-liftsave`）才显示（输入值与当前值相同时仍隐藏，L631–L632）；点击 "保存" **或**在输入框按 `Enter`：`cur` 更新，历史追加一条 `{date: 今天, v}`，toast "<名称>已更新为 <v>kg"（L626–L630）。**只改 `change`（失焦）不保存** | MEDIUM | 名称取自 DOM |
| GL-3 | 力量输入保护 | 空值 / 非数字 / 负数 / 等于当前值 → 仅重绘（输入回到当前值），无 toast、无历史（L627–L628） | LOW | Playwright `fill('-5')` 可输入负号，`min=0` 不阻止 |
| GL-4 | 力量历史 | 卡片显示 "最近：" + 最近 **3** 条 "M月D日 值"，用 "，" 连接；没有历史则显示该力量项的备注文字；**同一天二次更新替换**最后一条而不是追加；历史最多保留 30 条（超出丢弃最旧） | MEDIUM | 夹具需历史 ≥4 条才能验证 "只显示 3 条"；30 条上限是可选用例 |
| GL-5 | 达标 | 值 ≥ 目标 → toast "<名称>达标了"，进度条宽度封顶 100%（`min(100, …)`） | LOW | 为避免抄录目标数值，用一个极大值（如 9999）触发达标、用小值（如 1）触发未达标 |
| GL-6 | 勾选任务（完成） | `change` → `done=true`，`doneDate=今天`；行变 `.isdone`，显示 "完成于 M月D日"，截止日期输入框**消失**；组内计数 +1、进度条变长；toast "完成，已记到今天"；联动：本周类别计数、本周 `.ent.done`、时间线 "完成：…"、日历完成 chip（L623） | HIGH | 跨视图联动，归入 X-1 |
| GL-7 | 取消勾选 | `done=false`、`doneDate=""`，**保留原 `due`**；无 toast；再次勾选时 `doneDate` 是**新的今天**，不是原日期 | MEDIUM | |
| GL-8 | 截止日期 | `change` on `[data-due]` → 保存（可为空串清除）；`due < today`（严格小于）且未完成 → 标签 "已过期" 加 `.od`；`due == today` 显示 "截止" 且**不**过期；未来日期显示 "截止"；完成后日期输入框不显示（但 `due` 仍在 state 中）；到期任务出现在日历 `due` chip 与日面板 "这天到期"（L522–L525） | MEDIUM | 夹具需要：过期、今天到期（边界）、未来三种；`fill('YYYY-MM-DD')`，不要操作原生日期选择器 |
| GL-9 | 添加自定义待办 | 在 `[data-addto=P#]` 输入后按 `Enter` 或点 "添加"（`data-addbtn`）：新增 `{id:"c-…", group, text}`（先 trim，空白忽略）；输入框随重绘清空；分母 +1；新任务有 "×" 且无需刷新即可勾选/设日期（L633, L636） | MEDIUM | |
| GL-10 | 删除自定义待办 | 仅自定义任务显示 "×"（`aria-label` "删除待办"；内置任务无）；点击后任务及其 `state.tasks[id]` 一并删除；**无确认、无 toast、无撤销**；计数同步；已完成的自定义任务也显示 "×" | MEDIUM | 如果以后加撤销，这条用例应当改 |
| GL-11 | 进度条 | `.bar i` 的 `style.width` = 完成数/总数×100%；空组为 0 | LOW | 读取 inline style 断言 |
| GL-12 | 内置任务 id 契约（特征化测试） | 夹具里 `state.tasks["P2-3"]` 对应 P2 的第 3 个任务（`P<n>-<序号>`，L317） | LOW | 不是 bug 测试，而是锁定位置 id 这一隐性契约（`B10`） |

#### G. 时间线视图

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| TL-1 | 默认 "全部" | 日志 + 完成的计划（文字前缀 "完成："，标签显示组名如 "P2"，仅含有 `doneDate` 的）按日期**降序**；按月分组，标题 "YYYY 年 M 月"；每项显示 "M/D"、类别标签、文字；同日期内日志在前、计划在后（L533–L539） | MEDIUM | 夹具需跨 ≥2 个月、最好跨年 |
| TL-2 | 筛选 | 7 个按钮：全部、5 个类别、"完成的计划"，`aria-pressed` 标记选中；类别筛选只含该类日志（**不含**计划）；"完成的计划" 只含计划；筛选值在 `renderAll` 与切换标签后保持（模块级 `filter`） | LOW | |
| TL-3 | 空状态 | 无内容（或筛选后为空）→ "还没有内容。在“本周”里写下今天做过的事。" | LOW | 空存储夹具 |
| TL-4 | 打开编辑器 | 日志项 → 日志编辑器；"完成：" 项 → 计划编辑器；`Enter` / `Space` 等价（L553–L554） | LOW | |
| TL-5 | 编辑后重排 | 改日期后项目移到新月份/新顺序，旧月份标题在无项目时消失 | MEDIUM | 与 ED-4 联动 |

#### H. 编辑弹窗（`<dialog id="editor">`，三处入口：本周条目、日面板、时间线）

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| ED-1 | 打开日志编辑器 | 标题 "编辑记录"；类别按钮（当前类 `aria-pressed=true`）；textarea 预填原文、**聚焦且光标在末尾**；日期输入预填原日期；按钮 "删除" / "取消" / "保存"；提示 "⌘/Ctrl + Enter 保存" | LOW | `showModal()`，断言 `#editor[open]` |
| ED-2 | 改文字并保存 | 点 "保存"：`text` 被 trim 后写回，弹窗关闭，toast "已保存"，所有视图同步 | LOW | |
| ED-3 | 改类别 | 点类别按钮会重绘弹窗，但**保留未保存的文字与日期**（`form.dataset.keep` / `kdate`，L569），并把焦点放回 textarea；保存后条目颜色与时间线标签更新 | MEDIUM | 先改文字、再改类别、检查文字仍在 |
| ED-4 | 改日期 | 日期与原值不同 → toast "已保存，移到 M月D日"；条目离开当前周/日面板，出现在新日期；清空日期输入 → 保留原日期，toast 为普通的 "已保存"（L575–L578） | MEDIUM | |
| ED-5 | `Ctrl+Enter` 保存 | 在 `#ed-text` 内触发保存（`Meta` 也可）；**在日期输入框内不触发** | LOW | |
| ED-6 | 空文字 | 不关闭弹窗，焦点回到 textarea，toast "内容不能为空，想删掉请点“删除”"，数据未改 | LOW | |
| ED-7 | 取消 / `Escape` / 点击遮罩 | 三者都关闭并丢弃修改；遮罩点击判断是 `e.target===dlg`（L594），**点到对话框内边距也会关闭** | LOW | `Escape` 是浏览器原生行为，不经过应用的 `close()`，残留的 `dataset.keep` 会在下次打开时被清掉 |
| ED-8 | 删除 | "删除" → 关闭弹窗并调用 `deleteLog`：toast "已删除这条记录" + "撤销"，撤销后日志回到原下标 | LOW | 归入 CAL-9 的撤销逻辑 |
| ED-9 | 计划编辑器 | 标题 "完成的计划"；显示组标签与任务文字；"完成日期" 预填 `doneDate`；"保存" 修改 `doneDate`（空值则不改，仍 toast "已保存"），日历 chip、本周计数、时间线排序、目标页 "完成于" 同步变化；**没有 `Ctrl+Enter`**（L582–L593） | MEDIUM | 特征化测试：明确它不支持 `Ctrl+Enter` |
| ED-10 | 标记为未完成 | `done=false, doneDate=""`，保留 `due`；弹窗关闭，toast "已改回未完成"；目标页复选框恢复未勾选；若有 `due` 则重新作为到期出现 | MEDIUM | |

#### I. Toast

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| TST-1 | 显示与消失 | `#toast`（`role=status`、`aria-live=polite`）加 `.on` 显示：普通消息 1.8 s，带动作消息 5 s 后移除 `.on` / `.act`；新 toast 立即替换旧的（L660–L663） | MEDIUM | **文字在消失后仍留在 DOM**（只是 `opacity:0`），且 Playwright 把 `opacity:0` 视为可见 → 用 `toHaveClass(/\bon\b/)` 与 `toHaveText`，不要用 `toBeVisible` |
| TST-2 | 撤销按钮 | 点击 "撤销"：清定时器、隐藏 toast、执行回调；删除日志的撤销后再弹 "已恢复" | LOW | 5 s 过期后残留的 "撤销" 按钮因 `pointer-events:none` 点不了，别用 `getByRole('button',{name:'撤销'})` 去匹配过期 toast |

#### J. 持久化与存储模式（mock 的主要消费方）

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| PER-1 | 本地模式往返 | 无 `window.claude`：新增日志 → 防抖 600 ms 后 `localStorage["us-journey-tracker-v1"]` 含该日志 → 刷新后仍在；状态行 "已保存在此浏览器中（换设备不会同步）" | MEDIUM | 用 `expect.poll` 读存储，不要睡眠 |
| PER-2 | 账户模式加载 | mock 的 `db.doc("data/users/<id>/state")` 返回种子 → 应用显示种子内容；状态行 "已同步保存到你的账户"（L373） | MEDIUM | 断言 `doc` 路径里的用户 id 来自 `user.id()` |
| PER-3 | 账户模式保存 | 改动后防抖落盘：mock 的 `set` 收到**完整状态**（7 个顶层键）；账户模式下 localStorage **不被写入** | MEDIUM | |
| PER-4 | 空文档 | `get()` 返回 `exists:false` → 默认空状态，应用可正常使用并保存 | LOW | |
| PER-5 | 导出按钮可见性 | 本地模式：`#exportCsv` / `#exportJson` 保持 `.hidden`；账户模式（`downloads` 解析成功）：显示；"恢复" 始终可见（L378） | LOW | |
| PER-6 | `normalize` 迁移 | 加载时旧类别映射：`学习`→专业，`活动社交`→求职，`生活` / `里程碑`→其他；未知类别→其他；缺失的顶层字段补默认值（L352） | MEDIUM | 通过种子数据**或**导入观察 |

#### K. 导出与导入

| ID | Feature | 期望结果（来自代码） | Complexity | Notes |
|----|---------|----------------------|------------|-------|
| EXP-1 | CSV 内容 | `downloads.save` 收到 `filename = "在美国的日子-日历.csv"`；首行 `Subject,Start Date,All Day Event,Description`；日志行：`[类别] 首行文字（≤80 字符）`、`MM/DD/YYYY`、`True`、完整原文；已完成计划（有 `doneDate`）→ `完成：<任务>`，描述 `P# 计划`；未完成且有 `due` → `截止：<任务>`；行用 `\n` 连接、**无末尾换行、无 BOM**；顺序：`state.logs` 的存储顺序（不按日期排序），再是内置任务、自定义任务；成功后 toast "已导出"（L642–L650） | MEDIUM | 夹具要有含逗号、双引号、换行、超过 80 字符的日志，才能验证 `csvCell` 引号规则（L640：只对 `"`、`,`、`\n` 加引号） |
| EXP-2 | CSV 空数据 | 没有日志也没有带日期的计划 → toast "还没有可导出的日期"，**不调用** `save` | LOW | 空存储夹具 |
| EXP-3 | JSON 备份 | `filename = "在美国的日子-备份-<今天>.json"`；`data` 是 `JSON.stringify(state, null, 2)`，解析后含 7 个键，且包含本会话中新做的改动；toast "已导出"（L651） | LOW | 日期取决于固定时钟 |
| IMP-1 | 确认导入 | 选中 `#importJson` 文件 → `confirm("用备份文件替换当前所有内容？")` → 接受后**整体替换** state，持久化，全部视图重绘，toast "已恢复"；旧类别被迁移（L656–L658） | HIGH | `input` 是隐藏的：用 `setInputFiles`（对隐藏 input 可用，MEDIUM 置信度）；**Playwright 默认自动关闭对话框，等价于点 "取消"** → 接受要先 `page.once('dialog', d => d.accept())` 并断言 `d.type()==='confirm'` 与 `d.message()` |
| IMP-2 | 取消导入 | 状态完全不变，无 toast；`input.value` 未被清空（`B2`） | MEDIUM | 断言**确定性的**期望：取消后 `input.value` 应为空 → `test.fail`。不要写 "再选同一文件应触发 change"：Playwright 的 `setInputFiles` 很可能总会派发 `change`，该 bug 在 Playwright 下不一定能复现（MEDIUM 置信度） |
| IMP-3 | 非 JSON 文件 | toast "文件格式不对，请选择导出的备份 .json"，不弹确认，状态不变 | LOW | 同样适用于 JSON 字面量 `null`（`normalize(null)` 抛错） |
| IMP-4 | 导出再导入往返 | 导出 JSON → 清空/改动 → 用刚导出的内容导入并确认 → 状态与导出时一致 | HIGH | 需要 mock 记录 `downloads.save` 的内容，再用 `setInputFiles({name, mimeType, buffer})` 回灌 |

#### L. 跨视图联动

| ID | Feature | 期望结果 | Complexity | Notes |
|----|---------|----------|------------|-------|
| X-1 | 一处改动，四处同步 | 例：在本周记一条 → 本周列、类别计数、日历 chip、日面板（若选中同一天）、时间线都出现；在目标页勾选 → 本周计数、日历、时间线同步；编辑日期 → 四处位置同步（`renderAll`，L440） | HIGH | 只做 3–4 条代表性联动，不要对每个视图×每个动作做笛卡尔积 |
| X-2 | 视图间选择状态相互独立 | `wsel`（本周）与 `sel`（日历）互不影响；`filter` 不随其他视图变化 | LOW | |

### Differentiators（有价值，不是"缺了就算不完整"）

| ID | Feature | Value Proposition | Complexity | Notes |
|----|---------|-------------------|------------|-------|
| D-1 | **移动视口专项**（≤560 px，另加 ≤900 px、≤720 px 各一条） | 这些断点是应用显式设计的：≤560 px 日历 chip 变成 7 px 圆点（`font-size:0`，文字仍在 DOM，`toHaveText` 仍可用）、`.more` 与 "抵美" 徽标隐藏、编辑弹窗变底部抽屉、`.hint` 隐藏；≤900 px 本周列表变单列，且 `pickDay` 会 `scrollIntoView` 记一笔面板（L610）；≤720 px 类别卡变 3 列 | MEDIUM | 用 `test.use({ viewport })` 即可，不需要真机；只做布局断言（computed style / 元素是否在视口内），不拖拽 |
| D-2 | 键盘操作路径 | 应用专门处理了键盘：`.day`、`.ent`、日面板 `li`、时间线项都是 `tabindex=0 role=button`，`Enter` / `Space` 激活；`Ctrl+Enter` 记录/保存；力量与待办输入框 `Enter` 提交；`Escape` 关闭弹窗、取消添加标签 | MEDIUM | **标签页没有方向键切换**（ARCHITECTURE.md 已指出）→ 不要把方向键当期望行为；若要记录这个缺口，用 `test.fixme` |
| D-3 | 以角色/名称为主的选择器 | `getByRole` 本身就是一次无障碍检查：标签页 `role=tab`+`aria-selected`、分段按钮 `aria-pressed`、toast `role=status`、`dialog` 的 `aria-labelledby`、力量输入有 `<label for>`、多处 `aria-label` | LOW | 作为写法约定，而不是单独的 spec。**不建议**引入 `@axe-core/playwright`（又一个 npm 依赖，且很可能在颜色对比等项上引出大量与本里程碑无关的告警） |
| D-4 | 暗色模式渲染检查 | `page.emulateMedia({colorScheme:'dark'})` 后 `body` 背景为 `--paper` 的暗色值（#121826）；`[data-theme="light"]` 在暗色偏好下覆盖回浅色；界面**没有**主题开关（只能由偏好或属性决定） | LOW | 用 computed style 断言，不用截图 |
| D-5 | 错误/控制台/请求三合一护栏的**统计报告** | F-1、F-3 的断言结果进报告，而不是只失败 | LOW | 属于基础设施的延伸 |
| D-6 | 美东时区 + 跨 DST 的计数器与周标题 | 抵达日期在 3 月 8 日（美东 DST 开始）之前、"今天" 在之后，验证 `Math.round` 对天数/周数的容错（L444, L452） | LOW | 应用面向美国用户，这是最贴近真实的时区 |
| D-7 | 力量历史 30 条上限与同日替换 | 需要 30 条历史的夹具 | LOW | GL-4 的扩展 |
| D-8 | `localStorage` 内容损坏 | 非法 JSON → 视为空状态（`localStore.load` 吞掉异常，L366），应用仍可用 | LOW | 这不是 mock 错误路径，属于本地模式的正常健壮性 |
| D-9 | mock 加载延迟选项 + `B3` 用例 | 延迟 `use("db")` / `get()` 的解析（仍属正常路径，只是慢），在 "正在加载…" 期间编辑 → 加载完成后被覆盖 → `test.fail` | MEDIUM | 仅在 mock 带可配置延迟时才有意义；价值有限，放后 |
| D-10 | 导入的安全探针（`B6`、`B8`） | 构造无害的合成载荷（例如让 `window.__xss` 置位），期望不执行脚本 / 期望坏结构被拒绝且状态不变 → `test.fail` | MEDIUM | 载荷只改页面内的标志位，不外连；每个测试上下文的 localStorage 相互隔离 |
| D-11 | CSV 公式注入（`B7`） | 日志以 `=`、`+`、`-`、`@` 开头 → 期望被中和 → `test.fail`；另有裸 `\r` 未加引号的一条 | LOW | |
| D-12 | 跨午夜（`B9`） | 页面打开期间把固定时钟推到次日并触发重绘：期望 "今天" 高亮与记一笔默认日期更新；现状 `wk` / `wsel` / `sel` 不变（L341） | MEDIUM | 构造较牵强，优先级最低 |
| D-13 | `data-theme` 之外的 `prefers-reduced-motion` | 过渡被关闭（L226） | LOW | 极低价值，可略 |

### Anti-Features（明确**不要**测、不要建）

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| 像素级截图对比（`toHaveScreenshot`） | 看起来能"一次性覆盖视觉" | Google Fonts 被拦截后回退字体因机器而异（标题字体 Noto Serif SC 不一定存在）；暗色/亮色、日期、"今天" 都会使基线漂移；若误用真实数据，截图会把个人内容固化进仓库 | computed style / 类名 / 几何位置断言；截图只作为失败时 trace 的附件，绝不作为断言 |
| 对托管 Artifact（claude.ai）跑测试 | "更真实" | 违反硬约束，且会碰到生产存储和真实数据 | 本地副本 + `window.claude` mock |
| 使用任何真实备份或真实个人数据 | 夹具编起来麻烦 | 隐私；PROJECT.md 明确禁止 | 自己编造的合成 fixture |
| 把 `GROUPS` 任务文字、力量目标数值、预设标签文字抄进 spec 或 fixture | 断言写起来更直观 | 把所有者的个人计划复制进了仓库和报告 | 计数从 DOM 读；达标用极大值触发；预设按 "第 n 个 + 是否以 ：结尾" 选取 |
| mock 的错误路径（`get` 失败、`set` 失败、下载被拒、限流） | 覆盖 `B5` / `B11` / `B12` | 用户已明确延期；一旦现在做就扩大范围 | mock 设计成可扩展的配置对象，但这个里程碑不实现、不测试这些分支（`declined` / `rate_limited` 也不测） |
| 修复已知 bug 或把 bug 当作正确行为断言 | "让测试变绿" | 里程碑不改应用；把 bug 写成期望会让修复后测试反而变红 | 对已知 bug 写**正确期望** + `test.fail`（修好后 Playwright 会提示 "expected to fail but passed"）；无法稳定复现的用 `test.fixme` |
| 为了可测性改应用（暴露 `window.__test`、抽函数做单元测试） | 想测 `normalize` / `eventsOn` / `csvCell` | 违反 "不改应用" 约束 | 全部走黑盒：通过 UI 与导入导出间接覆盖 |
| `waitForTimeout` 等固定睡眠 | 防抖/toast 要等 | 慢且脆 | 轮询存储（`expect.poll`）、断言 `.on` 类、必要时 `clock` |
| 触摸/移动模拟下的拖拽，IME 输入，原生日期选择器 UI，真实文件选择框，真实下载 | "更真实" | HTML5 DnD 不支持触摸；其余在 Playwright 下不稳定或无意义 | 桌面视口测拖拽；日期用 `fill('YYYY-MM-DD')`；文件用 `setInputFiles`；下载由 mock 捕获 |
| 多标签 / 多设备并发（最后写入者胜出）、256 KiB 上限 | CONCERNS.md 里有 | 属于已知限制，且前者不是单页交互，后者属错误路径 | 留给后续里程碑 |
| 跨浏览器矩阵（Firefox、WebKit） | 常规做法 | 未安装，且禁止下载浏览器到用户级缓存 | 只跑 `channel: 'msedge'` |
| 行覆盖率插桩 | 想要一个数字 | 无构建步骤，没有插桩手段（TESTING.md 已说明） | 以 "交互清单（本文 ID）覆盖" 作为度量 |
| 对 5 个类别 × 3 个视图 × 每个动作做笛卡尔积 | 追求 "完整" | 用例爆炸，几乎全是重复 | 每种行为选 1–2 个代表类别；类别差异只在 CMP-5/6/8 与 WK-5 里单独测 |

## Mock 层必须支持的能力

应用对 `window.claude` 的全部依赖（L371–L378, L653）：

| 能力 | 应用如何调用 | mock 要求 |
|------|--------------|-----------|
| `window.claude.use(name)` | `await`/`Promise.all` 解析 `"db"`、`"user"`；`use("downloads").catch(...)` | **必须返回 Promise**（`async` 函数）：应用对 `downloads` 直接链 `.catch`，返回非 Promise 会抛 `TypeError`（L377）。任何一个名字解析失败应用都会回退本地存储，所以三个都要能解析 |
| `user.id()` | `await user.id()` | 返回稳定的合成 id，如 `"u_test_synthetic"` |
| `db.doc(path)` | `path = "data/users/<id>/state"` | `get()` 返回 `{exists: boolean, data(): object}`（`exists` 是**属性**，不是方法）；`set(obj)` 返回 Promise。要记录每次 `set` 的路径与载荷，供断言 |
| `downloads.save({filename, data})` | `data` 为**字符串**（CSV 或 JSON 文本） | 正常路径 resolve；记录 `filename` 与 `data` 供断言（EXP-1/EXP-3/IMP-4） |
| 无 `window.claude` | 走 `localStorage` | 同一套测试在 "不注入 mock" 时必须能跑，且导出按钮保持隐藏 |
| 种子与持久 | — | 能预置文档（含 `exists:false`）；**`page.reload()` 后数据仍在**（把文档放在 Node 侧，或用不与应用冲突的 storage 键，例如 `__mock_db__`）；调用日志对测试可读 |
| 注入时机 | `init()` 在脚本末尾同步启动（L665） | 必须用 `addInitScript`（文档开始前）注入，而不是页面加载后 |
| 可选：加载延迟 | — | 仅 D-9 需要；可先不做，但配置对象要留位置 |

注意：应用**不使用** `onSnapshot`，mock 不需要实现订阅。

## Fixture 必须包含的内容

用一个静态基础 JSON（绝对日期，配合固定时钟）加小的覆盖辅助函数，比按相对日期生成更易读。**全部为合成数据**；所有 id 只用字母、数字和连字符（应用把 id 未转义地放进 `data-*` 属性，见 B6）。

建议固定"今天"为 **2026-03-18（周三）**，周为 03-16（周一）– 03-22（周日）；抵达日期 **2026-01-12（周一）**。据此推算：计数器 "来美国第 66 天"，本周标题 "来美国第 10 周"（均为本文手算，落地时请用脚本核对）。

| 内容 | 具体要求 | 服务于 |
|------|----------|--------|
| 抵达日期 | 上述日期；另备"无抵达日期"、"抵达=今天"、"抵达=明天"、"抵达=昨天"变体 | HDR-1…6, WK-2, CAL-1/5 |
| 五个类别的日志 | 每类至少 1 条；本周内跨 ≥4 个不同日期；健身日志覆盖 ≥3 个不同日期（达标，`.ok`），另一周只有 1–2 天（未达标） | WK-4/5, CAL-6, TL-1/2 |
| 特殊文本的日志 | 含 `<b>&"'`（验证转义）；含逗号；含双引号；含换行（多行）；超过 80 字符；以 `=` 开头；纯中文长句 | WK-7, EXP-1, D-11 |
| 某天 ≥4 个事件 | 日志 + 到期 + 完成混合，使日历出现 "+N" | CAL-6 |
| 跨月的周 | 另一周跨越月末（如 03-30 – 04-05） | WK-1 |
| 多月/跨年日志 | 至少两个月，最好含上一年 | TL-1, CAL-3 |
| 旧类别名日志 | 各一条 `学习`、`活动社交`、`生活`、`里程碑`，外加一条未知类别 | PER-6, IMP-1 |
| 已完成任务 | ≥1 个本周完成（`doneDate` 在本周）；≥1 个更早月份完成；覆盖 P1（→语言）、某个 P2–P5（→专业）、P6（→求职）、P7（→其他）至少各一个，以便验证类别归属；其中一个同时保留 `due` | WK-4/7, GL-6/7, TL-1 |
| 过期 / 今天到期 / 未来到期 | 各至少 1 个未完成任务：`due` < 今天、`due` = 今天、`due` > 今天 | GL-8, CAL-6/7 |
| 自定义待办 | ≥2 个，分属不同组；其中 1 个带 `due`，1 个已完成（带 `doneDate`）；id 形如 `c-xxxx` | GL-9/10, CAL-6 |
| 力量历史 | 4 个 id（`bench`/`squat`/`dead`/`pull`）；其中一个历史 ≥4 条（验证只显示 3 条）；一个 `cur` ≥ 目标（进度条 100%）；一个**没有**记录（显示默认值与备注）；另一个变体里最后一条历史日期 = 固定的今天（同日替换） | GL-1…5 |
| 复盘 | 键为 **周一日期**：当前周一条（多行中文）、上一周一条 | WK-10 |
| 预设标签 | `presets` 以**类别中文名**为键：一类带 `add`（自定义标签）与 `hide`（隐藏某个内置标签，用 "第 n 个" 方式指定）；"其他" 类带至少一个 `add`，同时另备"其他"无任何自定义标签的默认情形（验证无 "编辑" 按钮） | CMP-5…10 |
| 空状态 | 无键 / `{}` | F-4, TL-3, EXP-2, PER-4 |
| 导入用文件 | ① 合法完整备份（可由导出回灌）；② 含旧类别；③ 非 JSON 文本；④ JSON 字面量 `null`；⑤ 结构坏（日志缺 `date`）；⑥ `{}`（见 N3）；⑦ 无害的 XSS 探针 | IMP-1…4, D-10 |
| 总大小 | 远小于 256 KiB | — |

两种种子形态：本地模式写入 `localStorage["us-journey-tracker-v1"]`（字符串）；账户模式写入 mock 文档（对象）。内容必须是**同一份** JSON。

## 已知 bug 对照表

| Bug | 来源 | 会触发它的用例 | 建议标记 | 可确定性 / 备注 |
|-----|------|----------------|----------|-----------------|
| **B1** 草稿在换日期时丢失 | CONCERNS（L610, L618–L619） | CMP-12：在 `#w-text` 输入后点另一天；在 `#c-text` 输入后点另一日历格子 | `test.fail`（本周、日历各 1 条） | 确定性强：断言草稿仍在，现状为空且 "记录" 禁用 |
| **N1** 草稿丢失的触发面更宽（新发现） | 本次阅读：`renderAll` → `renderWeek` → `renderWkComp`、`renderDay`（L440, L475–L479, L495） | 带草稿时：点**直接记录**的预设标签、在目标页勾选任务、删除日志、拖拽、改抵达日期，两个 composer 的草稿都会被清空 | 并入 B1 的 `test.fail`，用例说明里写明 | MEDIUM（未运行确认）。只有切类别 / 加标签 / 切编辑模式会保留草稿（CMP-11） |
| **B2** 取消导入后无法重选同一文件 | CONCERNS（L657） | IMP-2 | `test.fail`：断言取消后 `input.value` 为空 | 不要断言 "change 再次触发"，Playwright 很可能总会派发 `change`，复现不稳定（MEDIUM） |
| **B3** 首次加载完成前的编辑被丢弃 | CONCERNS（L369, L360, L375） | D-9：需要 mock 的加载延迟 | `test.fail`（可选） | 本地模式几乎瞬时，只有带延迟的 mock 才能稳定复现 |
| **B4** 复盘末尾 ~1.4 s 丢失 | CONCERNS（L613, L358, L664） | WK-10：输入复盘后立即 `page.reload()` | `test.fail`：期望刷新后文字仍在 | 较确定：`fill` 瞬间完成，远小于 800 ms 防抖 |
| **N2** 复盘在防抖期间被其他重绘还原 / 被后续输入取消（新发现） | 本次阅读：`renderWeek` 在 `#review` 失焦时执行 `rv.value=state.reviews[wk]`（L472）；复盘防抖只有一个全局 `rvT`（L613） | 输入复盘后 <800 ms 内点别的日期/记一笔 → 文本框显示回旧值（state 之后仍会写入新值）；在 A 周输入后 <800 ms 切到 B 周再输入 → A 周的文字永远不会保存 | **不单独写用例**；规则：输入复盘后先等落盘再继续其他操作 | MEDIUM（仅阅读推断，未运行确认） |
| **B5** 保存失败不重试 | CONCERNS（L360–L361） | 需要 mock 的 `set` 拒绝 | **延期**（错误路径） | 本里程碑不测 |
| **B6** 导入 XSS | CONCERNS（L468–L469, L501–L502, L513–L515, L523–L525, L533–L534） | D-10：把无害探针放进 `tasks["P1-1"].due`、自定义任务 `id`、`group` 等字段导入 | `test.fail`：断言 `window.__xss` 未置位 | 可选，价值在于留下回归基线 |
| **B7** CSV 公式注入 / 裸 `\r` | CONCERNS（L640–L649） | D-11 | `test.fail` | 低优先级 |
| **B8** 导入校验过浅 | CONCERNS（L347–L354） | D-10：日志缺 `date` 的备份。**阅读推断**：用户确认后 `state` 已被替换并持久化，随后 `renderTimeline` 在 `it.date.slice` 处抛错，被 `catch` 捕获显示 "文件格式不对…"，所以**界面提示失败、数据却已被替换** | `test.fail`：期望弹出错误、状态不变；用例内豁免 `pageerror` 护栏 | MEDIUM（推断，需运行确认）。时间线只有 1 项时不会走比较函数，但 `it.date.slice` 仍会抛 |
| **N3** `{}` / `[]` / 任何非 `null` 的 JSON 都能通过 `normalize`，确认后清空全部数据（新发现） | 本次阅读：`normalize` 对缺失字段给默认值（L347–L354）；只有 `null` 会抛 | IMP-3 的补充 | `test.fixme`（期望行为尚无定论：拒绝，还是只是警告） | 如实记录为现状，让产品方决定 |
| **B9** 跨午夜不更新 | CONCERNS（L341） | D-12 | `test.fail`（可选） | 优先级最低 |
| **B10** 内置任务位置 id | CONCERNS（L317, L522） | GL-12 特征化测试，不是 bug 测试 | 无（普通通过用例） | 作为"以后重排 GROUPS 会让它变红"的哨兵 |
| **B11 / B12** 加载失败回退 / 256 KiB | CONCERNS | 需要 mock 错误 | **延期** | |
| 本地模式没有导出 | CONCERNS（缺失的关键功能） | PER-5 | 无（描述现状：按钮隐藏） | |

## Playwright 观察注意事项（本应用特有）

1. **Toast 消失后文字仍在 DOM，且 `opacity:0` 在 Playwright 眼里算可见**：用 `.on` 类与 `toHaveText`，别用 `toBeVisible`。
2. **`confirm()` 默认被自动关闭（等于取消）**：接受导入必须先注册 `page.once('dialog', …)`。
3. **`addInitScript` 在每次导航/刷新都会执行**：种子写入必须有保护，mock 的文档要能在 reload 后保留。
4. **优先 `clock.setFixedTime`，不要 `clock.install`**：前者保留真实计时器，防抖与 toast 自然工作；`install` 会冻结所有计时器，需要手动 `runFor`。
5. **每次 `renderAll()` 都会重建 composer、日面板、本周列、目标页的全部 DOM**：不要持有 `ElementHandle`，每次用 `locator` 重新定位；输入框在重绘后是新元素。
6. **本周与日历各有一个 composer，标签文字重复**：用 `#wkComp` / `#dayPanel` 限定范围；隐藏的标签页是 `display:none`，不会出现在可访问性树里，所以 `getByRole` 天然只匹配当前可见视图。
7. **稳定的选择器**：`#arrival`、`#counter`、`#wkPrev` / `#wkNow` / `#wkNext`、`#wkTitle`、`#wkRange`、`#areas`、`#days`、`#review`、`#prev` / `#todayBtn` / `#next`、`#monthTitle`、`#grid`、`#dayPanel`、`#goals`、`#filters`、`#timeline`、`#status`、`#toast`、`#editor`、`#exportCsv` / `#exportJson` / `#importJson`、`#w-text` / `#w-add` / `#c-text` / `#c-add`，以及 `[data-wday]`、`[data-date]`、`[data-edit]`、`[data-edittask]`、`[data-dellog]`、`[data-task]`、`[data-due]`、`[data-lift]`、`[data-liftsave]`、`[data-addto]`、`[data-addbtn]`、`[data-deltask]`、`[data-filter]`、`[data-ccat]`、`[data-preset]`、`[data-pedit]`、`[data-padd]`、`[data-pdel]`、`[data-edcat]`、`#ed-text` / `#ed-date` / `#ed-save` / `#ed-cancel` / `#ed-del` / `#ed-undone`。夹具里的 id 是固定的，可以直接用 `[data-edit="log-001"]`；应用运行时新增的条目按文字定位。
8. **"抵美" 徽标是 CSS 伪元素**，只能断言 `.cell.arr`。
9. **日期输入一律 `fill('YYYY-MM-DD')`**，它会同时触发 `input` 与 `change`；不要操作原生日期选择器。
10. **日历周日在前，本周视图周一在前**：写周几相关的期望时不要混淆。
11. **力量与待办的 `change`（失焦）不会保存**，只有 "保存" 按钮或 `Enter`；测试要显式触发。
12. 以上 Playwright 行为（`setFixedTime`、`dragTo` 驱动 HTML5 拖拽、`setInputFiles` 作用于隐藏 input 与是否派发 `change`、`opacity:0` 的可见性）来自既有知识，**MEDIUM 置信度**，应在 STACK / 搭建阶段对已装版本核实。

## Feature Dependencies

```
F-1 网络护栏 ─┐
F-2 固定时钟 ─┼─requires──> F-5 openApp 辅助函数 ──> 所有 spec
F-3 错误护栏 ─┘

Mock 层 ──requires──> F-5（addInitScript 注入）
Fixture 层 ──requires──> F-2（固定"今天"）

PER-2/3（账户模式）──requires──> Mock.db + Mock.user
EXP-1/2/3、IMP-4、PER-5 ──requires──> Mock.downloads
IMP-1…4 ──requires──> 对话框处理 + setInputFiles + 合成导入文件

CMP-*（composer）──requires──> WK-3（选择日期）与 CAL-5（日面板）
ED-*（编辑器）──requires──> 夹具日志，或先经 CMP-3 创建
CAL-9 / ED-8（撤销）──requires──> TST-1/2（toast 辅助）
WK-9（拖拽）──requires──> 夹具里有本周日志
GL-6 / GL-8 ──requires──> F-2（今天 / 过期判断）
X-1（跨视图）──requires──> WK、CAL、GL、TL 各自的基础用例已稳定
IMP-4（往返）──requires──> EXP-3 + IMP-1

D-1 移动 ──enhances──> WK-6、CAL-1、ED-*（同一批用例换视口）
D-9（加载延迟）──requires──> Mock 的延迟选项（可选）
D-10 / D-11 ──requires──> IMP-1 / EXP-1 已可用
```

### Dependency Notes

- **F-2 先于一切含日期的断言**：计数器、本周标题、过期、`.today`、导出文件名中的日期都依赖 "今天"，不先固定时钟，这些测试一周后就会失败。
- **Mock 先于 account 模式测试，但 local 模式测试不依赖 mock**：可以先落地 local 路径（F-4、PER-1、四个视图），再接 mock。
- **CMP-* 被两处复用**：把 composer 行为写成"对 `w` 与 `c` 两个根节点参数化"的辅助函数，避免写两遍。
- **ED-* 与 TL-5、X-1 交叉**：编辑日期是最容易暴露跨视图不一致的动作，应放在基础视图用例之后。
- **B1 / B2 / B4 的 `test.fail` 与对应的"正常"用例互不依赖**：正常行为（CMP-11 草稿在切类别时保留）和 bug 行为（CMP-12）分开写，否则修复后很难看出是哪一半变了。

## MVP Definition

### Launch With（本里程碑的"做完"线）

- [ ] F-1…F-5 基础设施与 mock/fixture — 没有它们其余全部无法稳定运行
- [ ] 本周（WK-1…WK-11）、composer（CMP-1…CMP-12）— 最高频交互，且 B1 在此
- [ ] 日历（CAL-1…CAL-10）— 含删除与撤销
- [ ] 目标（GL-1…GL-12）— 力量、勾选、截止、自定义待办
- [ ] 时间线（TL-1…TL-5）与编辑弹窗（ED-1…ED-10）、toast（TST-1/2）
- [ ] 持久化与存储模式（PER-1…PER-6）、导出（EXP-1…3）、导入（IMP-1…4）
- [ ] 跨视图 3–4 条（X-1/X-2）
- [ ] 已知 bug 标记：B1（+N1）、B2、B4 用 `test.fail`；N3 用 `test.fixme`；B5 / B11 / B12 不做

### Add After Validation（本里程碑内的收尾，时间允许再做）

- [ ] D-1 移动视口专项 — 断点是应用显式设计的，成本低
- [ ] D-2 键盘路径、D-4 暗色模式 — 各一两条
- [ ] D-6 美东时区、D-7 / D-8 — 几乎零成本的边界补充
- [ ] D-10 / D-11 安全探针 — 留下 B6 / B7 / B8 的回归基线

### Future Consideration（以后的里程碑）

- [ ] mock 错误路径（B5、B11、B12，`declined`、`rate_limited`）— 用户已明确延期
- [ ] D-9 加载延迟（B3）、D-12 跨午夜（B9）— 需要 mock 扩展或牵强的构造
- [ ] 方向键的标签页无障碍 — 属于改应用，而不是测试
- [ ] 多标签并发、256 KiB

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| F-1…F-5 基础设施 | HIGH | MEDIUM | P1 |
| 本周 + composer（WK、CMP） | HIGH | MEDIUM | P1 |
| 日历（CAL）含删除撤销 | HIGH | MEDIUM | P1 |
| 目标（GL） | HIGH | MEDIUM | P1 |
| 时间线 + 编辑弹窗 + toast（TL、ED、TST） | HIGH | MEDIUM | P1 |
| 持久化（PER）与 mock 账户模式 | HIGH | MEDIUM | P1 |
| 导出（EXP） | HIGH | MEDIUM | P1 |
| 导入（IMP）含往返 | HIGH | HIGH | P1 |
| 拖拽（WK-9） | MEDIUM | HIGH | P1（用户明确要求；若不稳定降级为 `dispatchEvent` 方案） |
| 跨视图联动（X-1） | HIGH | HIGH | P1（3–4 条即可） |
| 已知 bug 标记（B1/B2/B4） | MEDIUM | LOW | P1 |
| D-1 移动视口 | MEDIUM | MEDIUM | P2 |
| D-2 键盘路径 | MEDIUM | MEDIUM | P2 |
| D-4 暗色模式 | LOW | LOW | P2 |
| D-6 / D-7 / D-8 | LOW | LOW | P2 |
| D-10 / D-11 安全探针 | MEDIUM | MEDIUM | P2 |
| D-9 / D-12 | LOW | MEDIUM | P3 |

**Priority key:** P1 = 本里程碑必须；P2 = 时间允许就做；P3 = 以后。

## Sources

- `us-journey-tracker.html`（只读，全文阅读；HIGH 置信度，本文所有行为期望均出自此文件）
- `.planning/PROJECT.md`、`.planning/codebase/ARCHITECTURE.md`、`.planning/codebase/CONCERNS.md`、`.planning/codebase/TESTING.md`（项目约束与已知问题）
- Playwright 相关行为（`clock.setFixedTime`、`dragTo`、`setInputFiles`、对话框默认处理、`opacity:0` 的可见性）：既有知识，MEDIUM 置信度，未在本次研究中联网核实或运行，需要在 STACK / 搭建阶段验证
- 本文没有做竞品分析：这是为单个已有应用设计测试覆盖，不存在竞品功能可对比

---
*Feature research for: 单文件个人追踪器的 Playwright 测试覆盖与 Claude Artifact API mock*
*Researched: 2026-11-01*
