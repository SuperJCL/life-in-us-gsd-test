# Phase 12: 编辑计划页（Plan Editor） - Context

**Gathered:** 2026-11-11
**Status:** Ready for planning（规划前先做 UI 设计契约 `/gsd-ui-phase 12`，路线图要求）

<domain>
## Phase Boundary

在云端版里加一个「编辑计划」页（`#plan` 路由，从目标页进入，不加第五个标签）。用户在这里管理自己账号的目标组、任务、力量项、每周健身目标和基础预设标签：新增、修改、删除，并用上移、下移调整顺序。编辑是草稿式的，点保存才生效，点取消计划完全不变；有进度的项删除时改为归档，归档项可以恢复，也可以彻底删除。保存后同一账号的其他设备几秒内按新计划显示，正在编辑的另一台设备的草稿不被冲掉。

对应需求：PLAN-02、PLAN-03、PLAN-04。路线图已排除：跨组移动、拖拽排序（PLAN-F1）、“恢复默认计划”、可编辑的类别。预设仍是两层：本页只改计划里的基础列表，「记一笔」里的添加和隐藏照旧记在 state 里。

</domain>

<decisions>
## Implementation Decisions

### 删除与归档（所有者讨论决定）
- **D-01:** 删除时先看有没有进度。任务的进度是「已完成」或「设了截止日期」（`state.tasks[id]` 的 done、due）。没有进度的任务直接从草稿里移除（点「取消」能找回）。有进度的任务删除时弹确认，写明会归档，确认后标为归档。目标组下任何任务有进度、或者组里有自定义待办时，删组也改为归档。力量项有历史记录（`state.lifts[id].hist` 非空）时删除改为归档。
- **D-02:** 归档项可以在编辑页的「已归档」区恢复，也可以「彻底删除」。彻底删除要再确认一次，写明连进度一起删、日历和时间线里对应的完成记录也会消失；组的确认框还要写明组里有几条自定义待办会一起删掉。彻底删除是用户明确操作，不违反 Phase 7 D-08（D-08 禁止的是程序自动删含文字的条目）。
- **D-03:** 归档的组、任务、力量项在**目标页底部**一个可折叠的「已归档」分组里**变灰、只读**显示（不能打勾、不能改截止日期、不能记力量），不计入「本周」的计数和目标页的完成数。归档力量项的历史在这里只读显示。日历和时间线里已完成的记录照常显示（路线图成功标准 2）。
- **D-04:** 设了截止日期、还没完成的任务被归档后，日历上**不再显示**它的截止提醒，日历 CSV 导出也不带这些截止项。截止日期仍保存在数据里，恢复后提醒回来。
- **D-05:** 组里的自定义待办**跟着组一起归档**：留在原组，一起变灰、一起恢复。顺带修掉 Phase 7 的 WR-02：`group` 找不到对应组的自定义待办也放进「已归档」区显示，能看到、也能删。
- **D-06:** 组、任务、力量项都要能标归档。现在 `normalizePlan` 只在任务上保留 `archived`，组和力量项会把它丢掉，标了归档的任务在目标页也照样显示（Phase 7 IN-05）；本阶段补齐这三处的行为。 — **Reversibility:** costly — 计划文档的形状被 format 2 备份（Phase 11 D-02 选项 A，单向格式）、`normalizePlan`、迁移脚本 `tools/plan/migrate-backup.mjs` 和大量用例沿用；字段只增不改，但服务器上存下的计划一旦带了这些字段，以后要去掉就得迁移已存的计划和备份。

### 两台设备同时改计划（所有者讨论决定）
- **D-07:** 编辑期间如果另一台设备保存了计划，草稿不动，编辑页顶部出现提示「计划在别的设备上改过了」。点保存时弹框三选一：**用我的覆盖**（被盖掉的那一版在本机留底、可以下载，沿用 Phase 9 D-10 的留底和 11-09 的计划留底包装）/ **放弃我的修改、用新版** / **回去继续改**。现有代码在挂起远端计划时会把 `docs.plan.base` 前移（`us-journey-tracker.html:1248-1255`），之后保存草稿会静默覆盖且不留底——草稿必须记住自己打开时的计划版本，保存时据此判断。
- **D-08:** 保存时按最新的进度再查一遍：草稿里直接移除的项（当时没有进度），如果保存前在别的设备上刚有了进度，**保存前先问所有者**：列出这些项，让所有者选择改为归档还是连进度一起删。
- **D-09:** 草稿**不跨刷新保留**：只在页面开着时存在，刷新或被系统关掉就没了。在应用里离开编辑页（切换标签、返回键、退出登录）时如有未保存的修改先确认；页面关闭和刷新用 `beforeunload` 尽量提示（手机上不保证弹出）。
- **D-10:** 点保存**直接生效**，不再显示改动摘要；保存后回到目标页，提示「计划已保存」。归档和彻底删除在点的当时已经确认过。

### 离线和本地版（所有者讨论决定）
- **D-11:** 断网或连不上服务器时**不让保存**：保存按钮变灰并提示「联网后再保存」，草稿留在页面上，联网后按钮恢复。
- **D-12:** 登录过期时同样不让保存：按钮变灰并提示「登录已过期，重新登录后再保存」，草稿留在页面上；如果重新登录会离开编辑页，先提醒「未保存的计划修改会丢失」。
- **D-13:** **只做云端版**。不登录的本地版没有「编辑计划」入口，仍用示例计划；本地版打开 `#plan` 时回到目标页（与 Phase 11 D-09“旧路径只是回归防线”一致）。

### 组的编号和可改范围（所有者未选讨论，按推荐定，可以再改）
- **D-14:** 目标页上组的编号**按顺序自动生成** P1、P2……（只数未归档的组），不再直接显示组 id。新组的 `g-…` id 不出现在界面上。现有 7 个组的 id 正好是 P1–P7，初始显示不变。日历日面板、时间线和日历 CSV 里显示组的地方（`us-journey-tracker.html:1895-1896、1927、2064-2065`）同样改用生成的编号或组名，不显示原始 id。
- **D-15:** 可改的内容：组的名称、类别（只能从 5 个里选）、备注；任务文字；力量项的名称、单位、目标值（正数）、默认起始值（非负数）、备注；每周健身目标（两个整数，最小值 ≤ 最大值）和健身说明 `fitNote`；每个类别的基础预设标签（增、改、删、排序）。改任务文字不影响进度（id 不变），时间线里已完成的记录显示新文字。
- **D-16:** **允许把计划删光**（0 个组、0 个力量项）。目标页和本周页要能显示空状态；只在计划为空时提供「载入示例计划」。现在 `normalizePlan` 拒绝空的 `groups`（`us-journey-tracker.html:462`），无效计划会退回示例计划，需要改。 — **Reversibility:** costly — `normalizePlan` 的有效性同时用于导入识别（`classifyBackup`）、`usePlan` 的退回逻辑和迁移脚本，放宽后这几处的判断都要跟着核对。
- **D-17:** 规模上限：目标组 ≤ 20，每组任务 ≤ 50，力量项 ≤ 8，名称约 40 字，任务文字约 200 字（取自 `.planning/research/FEATURES.md:96`）。空名称或超出上限时不能保存，并就近提示。

### 已有决定（沿用，不再讨论）
- 入口走 `#plan` 路由，从目标页进入，不加第五个标签；只用上移/下移排序（路线图成功标准 1、Notes）。
- 新项用 `g-`/`t-`/`l-` 前缀的新 id，已有 id 不变（路线图成功标准 5；Phase 7 D-01..D-04）。
- 5 个类别固定在代码里（Phase 7）。找不到对应任务的进度键会被丢弃（Phase 7，所有者再次确认），所以有进度的项只能归档。
- 计划是单独一份 `kind: plan` 文档，整份以最后保存为准，被覆盖的一版留底（Phase 9）；远端更新先挂起、空闲时先 plan 后 state 应用（Phase 10 D-04..D-06）；修改经 `commit`，远端版本只经 `pendRemote`/`takeRemote()` 并入（Phase 11）。
- 保存计划要做 `applyImport` 做的那几步：`docs.plan.dirty=true; docs.plan.seq++; cachePut("plan",…)`，再自己调 `requestSync("save")`，因为 `persist` 只管 state（`11-03-SUMMARY.md:144`）。

### Claude's Discretion
- 「已归档」区在编辑页里的位置和折叠方式、归档项恢复后排在哪里（建议回到原组末尾），由 UI 设计契约定。
- D-08 的询问框是逐项选择还是统一选择（建议一个框列出全部，两个按钮：全部归档 / 连进度一起删）。
- 断网时能不能打开编辑页：建议可以打开、可以改草稿，只是不能保存（D-11）。
- 联网时点了保存、上传途中失败或掉线：走现有的脏标记加退避重试，不丢；断网规则只管点保存的那一刻。
- 编辑页打开时算“忙”：四个视图的远端更新照旧挂起，远端计划只触发 D-07 的提示，不改草稿；保存或取消离开编辑页后再按 Phase 10 的规则应用。保存前先 `takeRemote()` 拿到最新进度再做 D-08 的复查。
- 打开编辑页受现有“先对账再编辑”门控约束（`GATE_ALLOW`），对账完成前入口不可用。
- 预设标签基础列表的数量上限（输入框现有 `maxlength="30"`），以及基础列表和用户自己加的标签重名时去重（`presetsFor`，`us-journey-tracker.html:1785`）。
- 归档的组在 P 编号之外怎么标（例如“已归档”），以及日历和时间线里归档组的标签写法。
- 彻底删除力量项时同时删掉 `state.lifts[id]` 的历史（现在 `normalize` 只按 id 格式保留它，`us-journey-tracker.html:583`，不删就会一直留在数据里）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 范围和需求
- `.planning/ROADMAP.md` §「Phase 12: 编辑计划页」 — 目标、5 条成功标准、Notes（不做跨组移动、拖拽、恢复默认计划；预设两层）、需要 UI 设计契约
- `.planning/REQUIREMENTS.md` — PLAN-02、PLAN-03、PLAN-04；PLAN-F1（拖拽、跨组移动，未来）；类别不可编辑（Out of Scope）

### 计划格式和 id（Phase 7）
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-CONTEXT.md` — 计划形状、id 规则（`P<n>`/`P<n>-<i>` 冻结，新项加前缀）、预设两层、孤儿进度丢弃、`archived` 留给 Phase 12
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-REVIEW.md` — WR-02（找不到组的自定义待办看不到、删不掉）、IN-05（`archived` 没有行为）
- `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-REVIEW-DISPOSITION.md` — 这两条推迟到编辑计划页的理由

### 存储、同步和导入（Phase 9–11）
- `.planning/phases/09-login-cloud-storage/09-CONTEXT.md` — 计划是单独文档、整份最后保存为准、留底、保存前查大小（4 MiB，70% 预警）、可复用的弹窗
- `.planning/phases/10-offline-realtime-sync/10-CONTEXT.md` — 远端更新挂起、空闲时先 plan 后 state；D-04 重做只覆盖 state 操作；D-07 待上传计数
- `.planning/phases/11-export-import-migration/11-CONTEXT.md` — 备份格式 format 2（单向）、只含计划的导入（D-03）、经 `commit` 和挂起槽的规则
- `.planning/phases/11-export-import-migration/11-03-SUMMARY.md` — 编辑计划时保存计划的步骤（`docs.plan.dirty`、`seq`、`cachePut`、`requestSync`）

### 调研
- `.planning/research/FEATURES.md` §编辑计划页（约 84–101 行） — 每类操作的建议、规模上限、空计划、入口、草稿模型
- `.planning/research/ARCHITECTURE.md` — 已完成或有截止日期的任务只能归档（约 378 行）
- `.planning/research/PITFALLS.md` — 孤儿进度（约 234 行）、删除提示措辞（约 599 行）

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `<dialog id="editor">`（`us-journey-tracker.html:384`，`openEditor`/`openTaskEditor` 在 1950-1994）和 `<dialog id="confirm">`（385，`confirmBox` 在 1339-1358）：归档、彻底删除、保存冲突三选一、D-08 询问都可以用它们。
- `toast(m,act,ms)`（2078-2081）：「计划已保存」提示；带操作按钮的用法见 1820、1942。
- 计划留底下载：Phase 9 D-10 的留底机制和 11-09 的计划留底包装（`blobDownload`、`backupOf`）。
- `applyImport`（1454-1458）和 `undoImport`（1495-1499）是整份替换计划的现成写法。
- `normalizePlan`（461-489）、`usePlan`（493-498）、`planCounts`（636）、id 正则（395）。

### Established Patterns
- 改动一律经 `commit(keys, fn)`（672），它先 `takeRemote()`；`persist` 只管 state（662）。远端计划进 `pendRemote.plan`（1248-1255），`takeRemote`（1646-1654）先应用计划再重新整理 state，会丢掉已删任务的进度。
- `isBusy`（1665-1677）决定远端更新何时应用；现在不知道计划草稿的存在，`hasUnsaved`（1716）也不含草稿。`renderAll`/`applyView`（1678-1710）会整页重画，编辑页不能被它重画掉。
- 编辑门控 `GATE_ALLOW`/`applyGate`/`gateGuard`（889-914）；同步状态栏 `showBar`/`SB_ORDER`（915-926）。
- 所有计划文字渲染前经 `esc()`；id 进 `data-*` 前过 id 正则。

### Integration Points
- 目前文件里没有任何 `location.hash`、`hashchange`、`popstate`、`beforeunload` 或「编辑计划」代码，路由和离开确认都要新建。
- 目标页组标题直接显示 `esc(g.id)`（1912）；日面板、时间线、CSV 显示 `t.group`（1895-1896、1927、2064-2065）——D-14 要改这几处。
- 本周计数用 `planCat[t.group]`（1853）；自定义待办删除按钮只在 `!planIds.has` 时出现（1915）；`allTasks()`（520）、`lift()`（522，id 不在计划里会抛错）。
- 预设：基础列表 `plan.presets[catKey]`，用户层 `state.presets[类别名]={add,hide}`（1783），`presetsFor`（1785）合并，不去重。
- 本地版只保存 state（679），导入代码注明“这个版本不保存计划”（1372）——与 D-13 一致。
- 用例：cloud 侧已有 `tests/cloud/offline-sync.spec.ts` 的 `otherWriterEditsPlan`（约 394 行）可模拟远端改计划；计划相关 e2e 见 `tests/e2e/data/plan-normalize.spec.ts`、`tests/e2e/goals/*.spec.ts`、`tests/e2e/week/presets.spec.ts`。

</code_context>

<specifics>
## Specific Ideas

- 归档区要能看到“曾经做过什么”：灰色只读，而不是完全隐藏（所有者选择目标页变灰放最后）。
- 所有者希望保存流程简单：点保存就生效、不多一步摘要；但凡会丢进度的情况（彻底删除、D-08）都要先问。
- 所有者接受草稿不跨刷新保留，也接受断网时不能保存计划——改计划不是常用操作，宁可等联网。

</specifics>

<deferred>
## Deferred Ideas

- 草稿跨刷新保留（存本机、回来时问继续还是丢弃）：所有者这次选择不做，以后如果在手机上经常丢草稿再考虑。
- 断网时保存计划、联网后上传（和记录一样）：所有者这次选择不做。
- 跨组移动任务、拖拽排序：已在 REQUIREMENTS 的 PLAN-F1，留给以后。

</deferred>

---

*Phase: 12-plan-editor*
*Context gathered: 2026-11-11*
