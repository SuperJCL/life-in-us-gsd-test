# Phase 11: 导出、导入与迁移（Export, Import & Migration） - Context

**Gathered:** 2026-11-10
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段交付：

- **下载备份：** 用户在手机宽度和桌面宽度下，都能用浏览器原生下载拿到本账号的 JSON 备份和日历 CSV，不再依赖 Claude 的 `downloads`（IO-06）。
- **导入前识别格式：** 不是备份的文件（`{}`、空数组、普通 JSON、非 JSON）直接拒绝并提示，数据不变（IO-07，修 N3）。
- **导入前确认并可撤销：** 先显示摘要并要求确认；导入前自动留快照，导入后可以撤销（IO-08）；取消导入后能再次选择同一个文件（IO-10，修 B2）。
- **迁移：** 原 Artifact 导出的旧备份连同所有者的种子计划能搬进新账号，流程先用合成文件演练（IO-09）。
- **翻转已知 bug 用例：** v1 里 N3、B2 的 `test.fail` 用例翻转为正常断言，`tests/KNOWN-BUGS.md` 同步更新（TEST-03）。

需求：IO-06、IO-07、IO-08、IO-09、IO-10、TEST-03。

**不在本阶段：**
- 所有者的真实迁移：在 Phase 13 线上部署之后进行，原 Artifact 保持原样作后备。
- 合并式导入（只加不覆盖）：调研列为不做，所有者采纳。
- 编辑计划页：Phase 12。本阶段的“只含计划的文件”导入为它铺路，但不做编辑界面。
- Web Share API 导出兜底、iOS 下载体验优化：留作以后。

</domain>

<decisions>
## Implementation Decisions

### 沿用的决定（来自路线图、调研和前几个阶段，本次不再讨论）

- **整份替换，不合并：** 导入一律替换，不做“只加不覆盖”的合并式导入。
- **深度校验：** 导入复用 Phase 7 的深度校验（`importProblem`、`normalize`、`normalizePlan`），任何一处不合格就整份拒绝，不做部分导入；加载、实时、导入三个入口共用同一套校验。
- **旧 id 直接对上：** 内置任务 id 冻结为 `P<n>`、`P<n>-<i>`（Phase 7），旧备份里的 `tasks["P3-2"]` 与按原规则生成的计划一一对应，导入旧备份不改写任何 id。
- **孤儿进度丢弃：** 找不到对应计划任务的进度键丢弃（Phase 7 所有者确认），本阶段的导入沿用。
- **下载：** 改用 Blob 加 `<a download>`，与 Phase 9 的留底下载相同；去掉 `window.__dl`；导出按钮在所有环境都显示。
- **文件名：** `计划手记-备份-<日期>.json`、`计划手记-日历.csv`，不含账号标识；隐私规则同时覆盖旧文件名和新文件名（quick 261109-inq）。
- **必修项：** 修 CSV 公式注入（B7）；修 N3、B2，并翻转对应的 `test.fail` 用例。
- **同步规则：** 导入和撤销都要走 Phase 10 的同步规则：
  - 改动经 `commit`，远端版本经挂起槽 `pendRemote`/`takeRemote()` 并入（10-REVIEW IN-05）；
  - 导入写入的 id 必须合法，不能让 `normalize` 每次生成新 id（10-REVIEW IN-06）；
  - 导入后上传到服务器，其他设备按 Phase 10 的规则收到更新。
- **数据和隐私：** 测试只用合成数据和假服务器；Claude 不读、不处理所有者的真实备份；原 Artifact 不访问、不修改。

### 导入时替换哪些内容

- **D-01:** 新格式备份（带格式标识的包装，里面有计划和记录）导入时，计划和记录都替换，确认框里写明两者都会被替换。
- **D-02:** 原 Artifact 的旧备份（裸 state：`arrival`、`tasks`、`custom`、`logs`、`lifts`、`reviews`、`presets`，没有计划、没有版本号）只替换记录，账号当前的计划不动。
- **D-03:** 接受只含计划的文件，导入时只替换计划，记录不动。
  - 它为 Phase 12 的“导入计划”铺路，也是迁移的一种可用方式（见 D-06 的备注）。
- **识别规则：**
  - 有格式标识的包装按新格式，再按包装里的内容分成“计划加记录”和“只含计划”；
  - 否则若是对象，且旧 state 的已知字段里至少有一个、类型正确，就当作旧备份；
  - 其余一律拒绝。
  - 包装的具体字段名由规划确定，调研给的示例是 `{ app, format: 2, exportedAt, plan, state }`。
  - **Reversibility:** one-way — 备份文件格式一旦发布，用户手里就会有这种文件；以后改格式必须继续兼容旧文件。规划在确定字段名之前要停下来让所有者确认。

### 撤销导入

- **D-04:** 导入前把当前数据存一份快照，保存在导入的这台设备上，一直保留到下一次导入或退出登录，刷新页面后仍在。
  - 导入后，页面上常驻一个“撤销导入”入口，位置与 Phase 9 的“下载留底”入口相同，在导出按钮那一栏。
  - 只有导入的这台设备能撤销；撤销本身像普通修改一样经同步上传，其他设备随后跟着恢复。
  - 退出登录时，快照和本账号的其他本机数据一起清掉（沿用 Phase 9 D-05、D-06 的退出流程）；有未撤销的快照时，退出确认要不要提及它由规划决定。
  - 撤销成功后快照就用完了，入口随之消失。“保留到下一次导入或退出登录”指的是还没撤销时能保留多久（所有者 2026-11-10 规划核查时确认）。
- **D-05:** 撤销把数据恢复成导入前的样子。导入之后如果又有新修改，先弹确认框说明这些修改会一起被撤掉，确认后才撤销。

### 迁移（所有者的旧数据搬进新账号）

- **D-06:** 迁移用一个本机脚本，把种子计划 `private/plan-seed.json`（Phase 7 的提取工具 `tools/plan/extract-plan.mjs` 生成，格式 `{ _seed, v, plan }`）和所有者从原 Artifact 导出的旧备份合成一个新格式备份，所有者再在应用里一次导入。
  - 脚本只读这两个输入，旧备份的路径由所有者在命令行给出；输出写进被 git 忽略的 `private/`。
  - 脚本只打印计数和校验结果，从不打印计划或记录的原文。
  - 合成时按 D-07 检查对不上计划的任务进度，并把计数打印出来。
  - **Claude 不运行这个脚本处理真实数据：** 本阶段只写脚本，并用合成的旧备份和合成种子计划测试它；Phase 13 由所有者本人在本机运行。
  - 备注：D-03 的“只含计划的文件”仍然支持，所以“先导入计划、再导入旧备份”的两步做法也能用，但不是推荐的迁移路径。
- **D-07:** 导入旧备份（或合成文件）时，如果有任务进度对不上当前计划，摘要里醒目提示，例如“N 条任务进度对不上当前计划，导入后会丢弃，建议先导入计划”，用户仍可确认导入。
  - 按 Phase 7 的规则丢弃这些进度；原文件还在，先导入计划再导一次就能找回。
- **D-08:** 演练分两层：
  - 用例用合成的旧备份和合成种子计划，在假服务器上跑完整流程：合成文件、导入、摘要、撤销。导入后记录、复盘、任务进度和力量历史都对应到正确的任务和日期（成功标准 4）。
  - 所有者验收时，像 Phase 9 那样在本机真实 Edge 里用合成文件走一遍，体验摘要和撤销。

### 旧路径（规划核查时补充，所有者 2026-11-10 确认）

旧路径指没配云端的本地模式，也就是 Claude、localStorage 路径。v1 用例和克隆仓库后在本机试用的人走这条路径。

- **D-09:** 导入前的摘要确认、快照和“撤销导入”只在云端版做。
  - 旧路径只修 N3 和 B2，导出改成浏览器下载，导入确认继续用系统原生的确认框和原文案。
  - IO-08 在旧路径上由所有者豁免，所有者实际用的是云端版。
- **D-10:** 旧路径导出也改成新格式备份，所以旧路径导入时同样接受新格式完整备份，以保证导出再导入能对上：
  - 新格式完整备份只替换记录，本地模式的计划固定是示例计划；
  - 只含计划的文件拒绝，并说明原因；
  - 加 5 MB 的文件大小上限。
  - 这些是旧路径上除 N3、B2、Blob 导出之外仅有的行为变化，所有者已批准。

### Claude's Discretion

所有者没有选择讨论“导入前的摘要确认”，以下由规划按此执行，可以微调：

- **摘要内容：**
  - 文件类型（新格式、旧备份、只含计划）；
  - 将替换什么（计划、记录或两者）；
  - 记录条数和日期范围；
  - 复盘的周数、完成的任务数、力量记录数；
  - 计划的目标组数、任务数、力量项数；
  - 当前账号现有的记录条数；
  - 对不上计划的任务进度条数（D-07）。
- **确认框形式：** 沿用 Phase 9 的 `confirmBox` 对话框（文字一律用 textContent，取消是默认焦点），不再用浏览器原生 `confirm()`；v1 旧路径要不要也换成同一个对话框，由规划根据 v1 用例的改动量决定。新增的文案按 09-UI-SPEC 的语气写，集中成常量，并同步到 `tests/support/strings.ts`。
- **拒绝提示：** 非备份文件直接 toast 提示并保持数据不变，不弹确认框。
- **B2：** 无论导入成功、取消还是被拒绝，都清空文件框的值。
- **CSV 公式注入（B7）：** 以 `=`、`+`、`-`、`@`、制表符、回车开头的单元格加前缀，具体写法由规划定。日历 CSV 主要导入 Google 日历和 Outlook，前缀可能会显示在少数这类标题里，写进已知限制。
- **文件大小上限：** 例如 5 MB；云端文档本身的上限是 4 MB（Phase 9 容量保护），超出时按 Phase 9 的容量提示处理。
- **快照存储：** 导入快照与 Phase 9 的冲突留底是两个独立的槽位；本机空间不够、快照存不下时，要明确告诉用户并拒绝导入，不能悄悄失败。
- **旧路径：** v1 的 Claude、localStorage 路径同样修 N3 和 B2（成功标准 2 要求 v1 的 `test.fail` 翻转），导出改成 Blob 下载后，v1 依赖 `downloads` mock 的导出用例要相应调整。
- **CSV 的数据来源：** 改成“当前计划加记录”。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段范围与需求
- `.planning/ROADMAP.md` §Phase 11：目标、4 条成功标准、Notes（Blob 下载、去掉 `window.__dl`、B7；三种文件；共用 Phase 7 深度校验；真实迁移在 Phase 13）
- `.planning/REQUIREMENTS.md`：IO-06、IO-07、IO-08、IO-09、IO-10、TEST-03 的原文

### 调研
- `.planning/research/FEATURES.md` §5“按账号导出与导入”：
  - 5.1 格式兼容与识别规则；
  - 5.2 导入计划还是记录；
  - 5.3 安全措施；
  - 5.4 导出；
  - 5.5 迁移顺序，本阶段按 D-06 改为合成一个文件。
- `.planning/research/SUMMARY.md`：N3、B7、导入快照与撤销的定位，“明确不做”清单（合并式导入）
- `.planning/research/ARCHITECTURE.md` §Q4：稳定 id 与迁移，旧备份 id 不需要改写

### 前几个阶段的决定与契约
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-CONTEXT.md`：
  - D-10、D-12：种子文件 `private/plan-seed.json` 的来源与用途；
  - 导入白名单整份拒绝；
  - 孤儿进度丢弃。
- `.planning/phases/09-login-cloud-storage/09-CONTEXT.md`：
  - D-05、D-06：退出流程；
  - D-08 到 D-11：留底和 Blob 下载、文件名不含账号标识。
- `.planning/phases/09-login-cloud-storage/09-UI-SPEC.md`：横幅、提示、确认框的视觉和文案语气，新文案照此写。
- `.planning/phases/10-offline-realtime-sync/10-CONTEXT.md`：同步规则 D-03、D-04 和挂起槽。
- `.planning/phases/10-offline-realtime-sync/10-REVIEW.md` 的 IN-05、IN-06，以及 `10-REVIEW-FIX.md` 里跳过它们的理由，本阶段处理。

### 代码与测试
- `us-journey-tracker.html`（行号为 HEAD 近似值，改动前重新 grep）：
  - `importProblem`（:525）、`normalize`（:546）、`normalizePlan`（:459）、`usePlan` 和 `planIds`（:488-494）；
  - `commit`（:607）；
  - 留底 `snapKey`、`keepConflict`、`snapDownload`（:991-1010）；
  - `confirmBox`（:1235）；
  - 导出导入：`csvCell`、`exportCsv`、`exportJson`、`importJson`（:1757-1775），`window.__dl`（:644），云端路径隐藏导入入口（:735）。
- `tools/plan/extract-plan.mjs`：种子提取工具，迁移脚本复用它的隐私约定：只读 `private/`、只输出计数。
- `tests/e2e/io/export.spec.ts`、`tests/e2e/io/import.spec.ts`、`tests/e2e/io/state-validation.spec.ts`：v1 的导出导入用例，N3、B2 的 `test.fail` 在这里。
- `tests/KNOWN-BUGS.md`：N3、B2 的登记，翻转后同步更新。
- `PRIVACY.md`、`tools/privacy/privacy-check.mjs`：`private/` 被 git 忽略，备份文件名规则。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `importProblem(raw)` 加 `normalize(s)`：Phase 7 的导入白名单，任何一处不合格整份拒绝。新格式包装、只含计划的文件在外面加一层识别即可复用。
- `normalizePlan(p)`、`usePlan(p)`：计划校验与应用，只含计划的导入和新格式里的计划部分都走它。
- `confirmBox(o)`：Phase 9 的共用对话框（退出确认、换账号确认），摘要确认可以复用。
- 留底槽 `snapKey`、`keepConflict`、`snapDownload`：Blob 下载和“常驻入口”的做法，可作为导入快照和“撤销导入”入口的参照。
- `commit(keys, fn)`：Phase 10 起所有改动 state 的统一入口，导入和撤销应接到这里，或接到同等效果的路径（IN-05）。
- `tools/plan/extract-plan.mjs` 的写法（零依赖、只读 `private/`、只输出计数、带 `--self-test`）：迁移脚本照此写。

### Established Patterns
- 处理函数改 state 后调用 `persist` 和 `renderAll`。云端路径经 `commit` 记录 ops，经 `requestSync` 上传。
- 用户文本一律 `esc()` 或 textContent。
- 改应用必须在同一提交里重新记录 `APP_SHA256`。
- 测试低优先级、单 worker；合成文件只在内存里构造，文件名以 `synth-` 开头（v1 约定）。

### Integration Points
- 导出按钮：云端路径现在因为没有 `window.__dl` 而隐藏，改成 Blob 后在所有环境显示，v1 账户模式的导出用例要调整。
- 导入入口：云端路径在 :735 被隐藏，本阶段在云端放开。
- 导入后上传：经 Phase 10 的 `requestSync`，其他设备经实时或拉取收到更新（挂起槽规则照旧）。
- 退出登录：清本账号缓存的那一步要连导入快照一起清。

</code_context>

<specifics>
## Specific Ideas

- 所有者更想要“一次导入搞定迁移”，不想分两步，所以由本机脚本合成一个文件。但脚本要由所有者本人运行，Claude 不碰真实备份。
- 撤销要稳妥：导入是少见但影响整份数据的操作，快照留到下一次导入或退出登录。

</specifics>

<deferred>
## Deferred Ideas

- Web Share API 导出兜底、iOS 主屏幕应用的下载体验：调研列为以后优化。
- 所有者的真实迁移：Phase 13 上线后进行，本阶段只做脚本和演练。

</deferred>

---

*Phase: 11-export-import-migration*
*Context gathered: 2026-11-10*
