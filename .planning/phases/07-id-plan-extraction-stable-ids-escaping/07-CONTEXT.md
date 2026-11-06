# Phase 7: 计划外置、稳定 id 与转义（Plan Extraction, Stable IDs & Escaping） - Context

**Gathered:** 2026-11-06
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段把个人计划从 `us-journey-tracker.html` 的代码里移出去：目标组、任务、力量项、每周健身目标和基础预设都改为从一个 `plan` 对象读取，代码里只内置一份合成的示例计划 `DEFAULT_PLAN`。

另外三项：
- 现有任务 id 冻结不变。
- 所有插值进页面的值一律按纯文本显示。
- 加载和导入的数据先经过 id 白名单校验。

v1 的 154 条用例在改动后的应用上照样通过。之后，去个人化的应用文件进入公开仓库，隐私检查改为从本地种子文件读取个人词条。

本阶段不接任何后端，不改界面，也不改四个视图的操作方式。

</domain>

<decisions>
## Implementation Decisions

### 沿用的决定（来自路线图和 v2.0 调研，本次不再讨论）

- 示例计划与原计划**同形状**，以保住 154 条用例。要保持一致的有：
  - 组数，以及组号 `P1`–`P7`；
  - 每组的任务数；
  - 每组所属的类别；
  - 力量项的个数和 id（`bench`、`squat`、`dead`、`pull`）；
  - 每个类别的预设个数；
  - 每周健身目标的两个数字这一结构。
- 内置目标组和任务的 id 冻结为 `P<n>`、`P<n>-<i>`：
  - 以后新增的项用 `g-`、`t-`、`l-` 前缀；
  - 判断“自定义待办”改为查计划，不再用 `/^P\d-\d+$/` 看 id 形状；
  - 现有自定义待办的 id 是 `c-<uid>`，白名单必须继续接受它们。
- 5 个类别显示名和 `LEGACY` 旧类别名是结构性标签，留在代码里，不外置。
- 预设标签保持两层：基础列表放在计划里，用户自己的增减放在 `state.presets` 里。composer 不改。
- 加入 `USJ_CONFIG` 配置缝。没配后端时走旧的 `window.claude` / localStorage 路径，v1 用例全部走这条路径。
- sha256 基线随应用改动**有意识地**更新：改了应用却没更新基线时，护栏必须失败。
- 四个视图的界面和操作方式不变。

### 示例计划写什么

- **D-01：** `DEFAULT_PLAN` 用**通用、像样的例子**，不用“示例任务 1”这种占位字。
  - 内容仍覆盖语言、专业、健身、求职几块，加上“其他”组。
  - 理由：克隆仓库的人，以及 Phase 9 之后新建的账号，都会把它当作初始计划。占位字太空洞，没法用。
- **D-02：** 措辞与原计划**完全不同**：示例里不能出现任何与原计划相同、含汉字且至少 4 个字的字符串。
  - 验收方法：把去个人化的应用文件放进暂存区，在本地种子文件已加载的情况下跑隐私检查，必须通过。
- **D-03：** 力量项的处理：
  - 两三个字的通用动作名可以保留；更长、且与原文相同的名称要改写；
  - 目标值和默认值换成整数的通用数字；
  - 原计划里所有与体重挂钩的备注一律去掉，换成通用说明或留空。

### 哪些原文算个人内容

- **D-04：** 原计划里含汉字、至少 4 个字的词条**全部算个人内容**，看起来很通用的预设标签也算。示例计划里一律改写。
  - **不新增**放行名单或豁免机制，隐私检查保持最严格。
- **D-05：** 不受影响的只有三类：5 个类别显示名、`LEGACY` 旧类别名、两三个字的通用动作名。
- **D-06：** 规则 D 的个人词条来源改为本地种子文件，再叠加 `private/denylist.txt`。
  - 规则 D **不再**从应用文件里提取词条，否则示例计划会挡住应用文件自己的提交。

### 坏数据怎么处理

- **D-07：导入备份**
  - 只要有条目的 id 或日期不符合白名单格式，就**整份拒绝**：用 toast 提示，`state` 保持不变。
  - 约束：v1 的 154 条用例结果必须不变，包括 8 条已知 bug 标记用例（其中有 N3：导入 `{}`；B2：取消后不能重选同一文件）。
  - 如果某个 v1 畸形导入用例的现有行为与“整份拒绝”冲突，就先保持 v1 行为，把行为改变推迟到 Phase 11（IO-07）。
- **D-08：读取已存数据**
  - 启动时从 localStorage 或 claude `db` 读到的数据**不整份拒绝**，而是**自动修正**：
    - 不合格的 id 换成安全的 id，`state.tasks` 里对应的进度键一起迁移；无法对应到任何任务的进度键直接丢弃；
    - 不合格的日期、数值字段清掉，或回落到默认值；
    - **记录文字一条不删**。
  - 理由：整份拒绝会让页面变空，下次保存还可能把原有数据覆盖掉。
- **D-09：** 双重防线，两者不互相替代：
  - 白名单校验在入口挡掉坏数据；
  - 渲染时，所有插值进 `innerHTML` 和属性的值都要转义。这包括 id、`group`、`due`、力量当前值、组名、任务名和备注。

### 提取出的计划怎么用

- **D-10：** 一个本地提取工具把所有者的原计划写进一份被 git 忽略的种子文件，放在 `private/` 下。这份种子文件只有两个用途：
  1. 规则 D 的词条来源；
  2. Phase 12/13 把所有者的计划搬进账号时，从这里取。
- **D-11：** 本机打开应用时，看到的仍是示例计划。本阶段**不做**“本地加载、显示我的计划”的入口。
  - 所有者目前实际使用的是托管的 Claude Artifact，云端版上线前不受影响。
- **D-12：** 改动应用之前，先把原应用文件另存一份到 `private/`，这份副本不进 git。提取工具从这份副本读取。

### Claude's Discretion

下面这些由 Claude 或规划阶段决定：
- 示例计划的具体文字（需满足 D-01 到 D-05）；
- 种子文件的文件名和格式（建议用 JSON）；
- 提取工具的位置（调研建议 `tools/plan/extract-plan.mjs`）；
- id 白名单正则的具体写法；
- D-08 的具体修正规则；
- sha256 基线机制怎么改造。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段范围与需求
- `.planning/ROADMAP.md` § Phase 7：目标、5 条成功标准和 Notes（约 26 处常量引用、两层预设、原文件副本）
- `.planning/REQUIREMENTS.md`：PLAN-05、SEC-01、SEC-04、TEST-01
- `.planning/PROJECT.md`：v2.0 约束（隐私、公开仓库、只用合成数据）

### v2.0 调研
- `.planning/research/ARCHITECTURE.md` § Q4 计划外置（目标数据形状、稳定 id 与迁移、`normalizePlan` 白名单）、§ Pattern 1 配置缝、§ Q7 测试架构 “哪些 v1 用例原样保留”
- `.planning/research/SUMMARY.md` § Phase 7，以及冲突表里“示例计划形状”这一行
- `.planning/research/PITFALLS.md` § Pitfall 9（位置 id）、§ Pitfall 10（计划文字泄漏到公开仓库）、§ Pitfall 11（XSS 变成持久化缺口）

### 现有代码分析
- `.planning/codebase/CONCERNS.md` § “HTML injection through a crafted backup file”：没有转义的插值位置清单
- `.planning/codebase/ARCHITECTURE.md`、`.planning/codebase/CONVENTIONS.md`：渲染、事件委托和命名约定
- `.planning/codebase/TESTING.md`

### 测试与护栏
- `tests/support/constants.ts`：`APP_SHA256` 和 `APP_FILE_NAME`
- `tests/e2e/platform/app-integrity.spec.ts`：SAFE-02 sha256 护栏；ENV-03 规定静态服务器只提供应用文件
- `tests/support/task-ids.ts`：用例依赖的内置任务 id（`P1-1`、`P1-2`、`P2-1`、`P2-2`、`P3-1`）和力量 id（`bench`、`squat`）
- `tests/support/goals.ts` 文件头：用例从不读取计划文字，只读组号、计数、id 和进度条
- `tests/support/strings.ts` 文件头：不能抄计划文字；类别名属于例外
- `tests/support/static-server.cjs`：缺少应用文件时的报错，需要随 D-10 之后的新情况更新
- `tests/fixtures/malformed-imports.ts`、`tests/KNOWN-BUGS.md`：D-07 的约束来源
- `tests/README.md`：说明了应用文件不在仓库里，需要同步更新

### 隐私护栏
- `tools/privacy/privacy-check.mjs`：
  - 规则 A：`checkPath` 禁止 `us-journey-tracker.html` 进入仓库；
  - 规则 D：`extractPlanTerms` / `loadPlanTerms` 目前从应用文件的 `CATS`、`GROUPS`、`LIFTS` 块提取词条；
  - `--self-test` 里有对应的自检。
- `.gitignore`：其中的 `/us-journey-tracker.html` 和 `private/` 两条
- `.githooks/pre-commit`、`.githooks/pre-push`
- `PRIVACY.md` § 1、§ 2、§ 5：描述了应用文件不进仓库（D-10）和规则 D 的词条来源

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `esc()`（`us-journey-tracker.html:339`）：现有的 HTML 转义函数，所有插值都可以统一用它。
- `normalize()`（`us-journey-tracker.html:347-353`）：现有的 state 规整入口，只校验顶层类型。D-08 的深度修正、白名单校验和新的 `normalizePlan` 都从这里扩展。
- `uid()`（`us-journey-tracker.html:338`）：生成新 id 时可以复用。

### Established Patterns
- 计划常量集中定义在 `us-journey-tracker.html:298-325`，被下面这些行引用：
  - `CATS`（预设部分）：298、305、391、401、403、459、530、563
  - `GROUPS`：308、317、318、517
  - `BUILTIN`：317、344
  - `GCAT`：318、460、469、502、534、585
  - `LIFTS`：319、346、511、626
  - `FIT_GOAL`：325、462
- 自定义待办靠正则 `/^P\d-\d+$/` 判断（`us-journey-tracker.html:522`），新增的自定义待办 id 是 `"c-"+uid()`（`us-journey-tracker.html:633`）。
- 每次改动都整页重绘：处理函数先改 `state`，再 `persist()`，再 `renderAll()`。`plan` 也照这个模式接入。
- 只有一个 IIFE，不使用模块，也没有构建步骤。应用必须保持单文件，直接打开就能运行。

### Integration Points
- `allTasks()` 和 `lift()`（`us-journey-tracker.html:344-346`）是任务和力量数据的读取入口，改为读 `plan`。
- 目标视图渲染（`us-journey-tracker.html:517-526`）把组号、id、`due` 和 `s.cur` 直接插进 HTML，是转义改造的重点。
- 隐私工具的规则 A 和规则 D、`.gitignore`、`static-server.cjs` 的缺文件报错、`tests/README.md`、`PRIVACY.md` 都默认应用文件不在仓库里。应用进入仓库时，这些要一起改。

</code_context>

<specifics>
## Specific Ideas

- 公开仓库里的示例计划要让克隆的人一看就懂这个应用怎么用，读起来像一份真实但通用的计划。
- 所有者看重隐私检查保持最严格，宁可多改写，也不加放行名单。

</specifics>

<deferred>
## Deferred Ideas

- 本地加载、显示所有者自己计划的入口：不做，由云端账号（Phase 9 之后）取代。
- 删除有进度的项改为归档（`archived`）的行为和界面：Phase 12（PLAN-03）。本阶段的 `normalizePlan` 可以先接受这个字段，但不做相关行为。
- 去掉 Google 字体：Phase 9（INFRA-03）。
- 导入前识别格式、显示摘要、留快照、支持撤销，以及 N3 和 B2 的修复：Phase 11（IO-07、IO-08、IO-10）。
- 新账号是否另给一份更小的示例计划：Phase 9 再定。D-01 默认新账号用 `DEFAULT_PLAN`。
- CSV 公式注入：不在本里程碑，归入 CONC-F1。

</deferred>

---

*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Context gathered: 2026-11-06*
