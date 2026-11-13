# Phase 14: 新账号的计划起步 - Pattern Map

**Mapped:** 2026-11-12
**Files analyzed:** 9 个文件（1 个应用文件的 8 个改动点 + 测试侧文件）
**Analogs found:** 全部有同文件内的现成类比（无 "No Analog" 项）
**取证方式:** 只读静态阅读，未运行任何测试。所有路径均为 git 跟踪的源码（`us-journey-tracker.html`、`tests/**`）。行号取自当前工作树，改动前请重新 grep 确认。

## File Classification

| 新增/改动点 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `us-journey-tracker.html` `resolve()` 建档默认值 (~1215) | service（对账） | CRUD（首次建档） | 同处 `kind==="plan"?normalizePlan(DEFAULT_PLAN):...` | exact |
| `us-journey-tracker.html` `renderGoals` 空计划卡片 (~2171) | component（渲染） | request-response | 同处现有 `.pe-empty` 卡片 | exact |
| `us-journey-tracker.html` `$("goals")` 点击委托 (~2326) | controller | event-driven | 同处 `#planSampleBtn` 分支 | exact |
| `us-journey-tracker.html` `dialog#sample` + CSS + 挑选逻辑 | component（新对话框） | event-driven | `dialog#confirm` / `confirmBox` (CSS 324-327, 1545-1575) | role-match |
| `us-journey-tracker.html` `loadSampleDraft` 改为按勾选追加 (~2766) | service | transform | 现有 `loadSampleDraft` | exact |
| `us-journey-tracker.html` 卡片模式直接保存（复用 `savePlanDraft` 路径） | service | CRUD + 冲突处理 | `savePlanDraft` (~2866) | exact |
| `us-journey-tracker.html` 编辑页 `.pe-tools` 与 `#peSampleBtn` | component | event-driven | `renderPlanEditor` (~2468) 的 `pe-add` 按钮写法 | role-match |
| `us-journey-tracker.html` `T_PE_*` / `T_PK_*` 常量、`wkEmpty` 文案 (452, 2345) | config（文案） | — | 2345 行 `T_PE_EMPTY_*` | exact |
| `tests/support/strings.ts`、`tests/support/constants.ts`（`APP_SHA256`） | config（测试文案） | — | strings.ts 629-636 的 Phase 12-06 段 | exact |
| `tests/cloud/plan-editor-archive.spec.ts`（PLAN-02 用例，~328-430） | test | request-response | 同文件现有用例 | exact |
| 新增 `tests/cloud/plan-onboarding.spec.ts`（建议名） | test | event-driven | `tests/cloud/plan-editor-archive.spec.ts` + `tests/support/plan-editor.ts` | role-match |

## Pattern Assignments

### D-01 空计划建档：`us-journey-tracker.html` `resolve()`（~1215）

**现状（第 1215 行，唯一建档处）：**
```js
try{const d=await mk(kind,c?c.data:kind==="plan"?normalizePlan(DEFAULT_PLAN):normalize({}));return {sv:d,data:d.data,c}}
catch(e){if(!uniq(e))throw e;list=await coll.getFullList(sg);live();sv=list.find(d=>d.kind===kind);if(!sv)throw e}
```
**做法：** 只替换 `normalizePlan(DEFAULT_PLAN)` 这一个表达式，换成新的空计划构造（建议新增 `emptyPlan()`，放在 `usePlan` 附近，形如 `normalizePlan({...JSON.parse(JSON.stringify(DEFAULT_PLAN)),groups:[],lifts:[],presets:{}})`，保留 `fitGoal:[2,4]` 和 `fitNote`）。
- `c?c.data`（有缓存）和 `catch(uniq)` 重读分支不动（D-01 的另三种情况）。
- `usePlan(DEFAULT_PLAN)`（618 行脚本求值时、1951 行退出登录时）不动：本地版基线。
- 注意 `presets:{}` 要先对照 `normalizePlan`（578 行起）确认它对缺失类别键补空数组还是拒绝；用 `Grep -o "presets" ` 读 578-611 行验证后再定写法。`usePlan` 的失败兜底（`if(!n)n=normalizePlan(DEFAULT_PLAN)`，613 行）保持。
- 正面模式：现有的 1204-1208 行注释块说明了对账表，需要同步改注释里 "from DEFAULT_PLAN" 一句。

### 空计划卡片：`renderGoals`（~2171）

**现状：**
```js
if(planEmpty()){$("goals").innerHTML=`<div class="panel pe-empty"><h3>${T_PE_EMPTY_TITLE}</h3><p>${T_PE_EMPTY_BODY}</p>${CLOUD&&me?`<div class="pe-empty-act"><button type="button" class="primary" id="planEditBtn2">${T_PE_BTN}</button><button type="button" class="ghost" id="planSampleBtn">${T_PE_SAMPLE_BTN}</button></div>`:""}</div>`+archivedHTML();goalsBars();applyGate();return}
```
**做法：** 按 UI-SPEC S1：`planEditBtn2` 文字换 `T_PE_BTN2`（`自己建一份`），`planSampleBtn` 加 `aria-describedby="planSampleWhy"`，其后加 `<p class="pe-why" id="planSampleWhy" role="status"></p>`。仍是 `CLOUD&&me` 才渲染。
- 断网/过期变灰：每次渲染和每次状态行变化时用 `peBlock()`（2412 行）算原因；被挡住时 `setAttribute("aria-disabled","true")` + 写 `#planSampleWhy` 文字。门控期间（`document.body.dataset.gate`）不写说明（`applyGate` 1086 行会把按钮设成真 `disabled`）。
- 刷新触发点：和 `peBar()` 同一处状态行变化的位置。用 `Grep -n "peBar()"` 找出所有调用点（`peBar` 本体在 2417 行），在其中补一个 `peEmptyWhy()`（或同名）调用；注意 `peBar` 开头有 `if(!pe)return`，新函数不能放在它后面，因为卡片模式下没有 `pe`。

### 点击委托：`$("goals")` click（~2326）

**现状：**
```js
if(e.target.closest("#planEditBtn,#planEditBtn2")){goPlan();return}
if(e.target.closest("#planSampleBtn")){const had=!!pe;goPlan();if(!had&&pe)loadSampleDraft(false);return}
```
**做法：** `#planSampleBtn` 分支改为：若 `peBlock()` 非空 → `toast(原因映射到 T_PK_WHY_*, null, 3000); return`；否则 `openSamplePicker("card")`。toast 的第三参数 `ms` 必传（`toast(m,act,ms)`，2987 行，`ms!=null` 时才加 `data-cloud` 宽度规则）。
- `T_PK_WHY_*` 与 `T_PE_HINT_EXPIRED/OFFLINE` 是一一对应（过期优先，其余断网），可以先调 `peBlock()` 再按 `net==="expired"` 选句子。

### `dialog#sample` 新对话框 + 挑选逻辑

**Analog:** `dialog#confirm`（CSS 第 324-327、333 行；`confirmBox` 1545-1575）。

**CSS 复用点：**
```css
dialog#editor,dialog#confirm{border:1px solid var(--line);border-radius:14px;padding:20px;width:min(460px,calc(100vw - 24px));background:var(--surface);color:var(--ink)}
dialog#editor::backdrop,dialog#confirm::backdrop{background:rgba(10,16,30,.45)}
@media (max-width:560px){dialog#editor,dialog#confirm{margin:auto 0 0;width:100vw;max-width:100vw;border-radius:14px 14px 0 0;padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))}}
```
- 第 325 行把 `dialog#sample::backdrop` 加进同一选择器（不要新写 rgba 字面量，UI-SPEC 明确要求）。
- 新 CSS 块照 UI-SPEC「CSS 骨架」逐条放，位置紧跟 Phase 12 的作用域块（215-226 行，其 `:is(#tab-plan,.goals-bar,.pe-empty,.arch,dialog#confirm.pe)` 写法是同款作用域覆盖）。347 行 `:is(#login,#boot,dialog#confirm){font-size:14px...}` 一类全局字号规则也要决定是否把 `dialog#sample` 加进去（UI-SPEC 已在骨架里自带 `font-size:14px`，可以不加）。
- CSP：模板字符串内不得有 `style=""`（注意：`goalsBars()` 用 `i.style.width=...` 是 CSSOM 赋值，允许；字符串属性不允许）。

**对话框开关模式（照 `confirmBox`）：** `showModal()`、`cancel`/`close` 事件、`back=document.activeElement` 关闭时回焦、`cfDlg.onclick=e=>{if(e.target===cfDlg)cfDlg.close()}` 点背景关闭、`{once:true}` 监听。区别：`dialog#sample` 是独立 `<dialog>`，复选框列表由 JS 生成；保存中（`aria-busy`）时 `cancel` 事件 `preventDefault()`。
- 用户文字一律 `esc()`；示例名来自 `DEFAULT_PLAN` 常量，但仍走 `esc()`。
- 复选框 `data-pk="g:P2"` / `data-pk="l:bench"`，值只是示例 id，不写进计划。

**同名标记数据源：** 卡片模式用 `plan`（当前工作计划，`activeGroups()`/`activeLifts()`，参见 634 行 `planEmpty`）；编辑页模式用 `pe.draft`（过滤 `!g.archived`）。名额：`PLAN_MAX.groups`（20）、`PLAN_MAX.lifts`（8），2468 行以后已有 `gs.length>=PLAN_MAX.groups` 的用法可抄。

### `loadSampleDraft` 重构（~2766）

**现状（可直接抄 id 生成部分）：**
```js
function loadSampleDraft(fromEditor){
  if(!pe||pe.draft.groups.some(g=>!g.archived)||pe.draft.lifts.some(l=>!l.archived))return;
  const u=peUsedIds(),nid=p=>{let id;do{id=p+uid()}while(u.has(id));u.add(id);return id};
  const smp=JSON.parse(JSON.stringify(DEFAULT_PLAN));
  smp.groups.forEach(g=>{g.id=nid("g-");g.tasks.forEach(t=>{t.id=nid("t-")});pe.draft.groups.push(g)});
  smp.lifts.forEach(l=>{l.id=nid("l-");pe.draft.lifts.push(l)});
  renderPlanEditor();peBar();
  if(fromEditor){const h=$("pe-h-groups");if(h)h.focus()}
  peSay(T_PE_SAMPLE_LOADED);
  toast(T_PE_SAMPLE_LOADED,null,4000);
}
```
**做法：** 改为纯拷贝函数（如 `pickSample(sel, usedIds)` 返回新 groups/lifts，只含勾选项，不带 presets，id 用 `nid`），供两种模式共用：
- 编辑页模式：去掉 "草稿里没有未归档项才执行" 的早退（`return` 那行），把返回的项 push 到 `pe.draft`，`renderPlanEditor();peBar()`，焦点到第一个新卡片的 `.pe-toggle`（`scrollIntoView({block:"center",behavior:"auto"})`），`peSay(...)` 写 `#pe-live`（`peSay` 在 2431 行，`#pe-live` 在 493 行），`toast(T_PK_DRAFTED..., null, 4000)`。新卡片不加入 `pe.open`（保持折叠）。
- 卡片模式没有 `pe`，`peUsedIds()`（2512 行，依赖 `pe.origIds/pe.draft/pe.gone`）不能直接用；需要一个基于 `plan`（含已归档项）的 id 集合，参照 `peUsedIds` 的收集方式，用 `plan.groups/tasks/lifts` 的 id 集合。

### 卡片模式直接保存：复用 `savePlanDraft`（~2866）

**关键模式（照抄顺序，不要另写一套）：**
```js
const blk=peBlock();
if(blk){toast(blk,null,3000);return}
...
const ep=sessionEpoch,live=()=>pe===s&&ep===sessionEpoch;
...
let overwrite=false;
if(peChanged()){
  const r=await confirmBox({title:T_PE_CF_TITLE,lines:[T_PE_CF_L1,T_PE_CF_L2,T_PE_CF_L3,T_PE_CF_L4],cancel:T_PE_BACK,mid:{text:T_PE_TAKE,cls:"danger"},ok:T_PE_OVERWRITE,scope:"plan"});
  if(!live())return;
  if(r===false){back();return}
  if(r==="mid"){closePlanEditor("goal");toast(T_PE_TAKEN,null,6000);return}
  overwrite=true;merge();
}
...
if(sizeOf(np)>CLOUD_MAX){s.tooLarge=true;showTooLarge();back();return}
...
let kept=null;
if(overwrite&&!unread)kept=keepConflict("plan",{data:JSON.parse(JSON.stringify(plan))});
...
usePlan(np);keepOrphans=false;
docs.plan.dirty=true;docs.plan.seq=(docs.plan.seq||0)+1;
```
**做法（高风险点，规划时要拆成独立任务）：** `savePlanDraft` 内部强依赖 `pe`（`s.draft`、`s.busy`、`s.tooLarge`、`planDirty()`、`peChanged()`、`peGoneHit`、`closePlanEditor`、`peBar`）。两条路线：
1. 最小侵入：卡片模式临时构造一个 `pe` 草稿（`peOpen` 同款初始化，不渲染编辑页，不改 location hash），把勾选项追加进去，调用提炼出来的"保存核心"；
2. 提炼 `savePlanDraft` 的 5-10 步为 `commitPlan(np,{overwrite,keepConflict...})`，两处共用。
无论哪条，必须保留：`peBlock()` 的 toast 拦截、`sizeOf(np)>CLOUD_MAX` 兜底、`confirmBox` 的 `mid` + `scope:"plan"` 三选一（改用 UI-SPEC S3 的 `回去继续挑` / `放弃我的选择，用新版` / `用我的覆盖` 措辞，`T_PK_CF_*` 新常量）、`keepConflict("plan",...)` 留底和 `T_PE_SAVED_KEPT` toast（`ms=8000`，取代成功 toast）。成功后保持在目标页：`renderAll()`，焦点到 `$("planEditBtn")||$("goals")`（参考 2396 行 `if(k==="goal"){const b=$("planEditBtn")||$("planEditBtn2");(b||$("goals")).focus()}`）。
- `confirmBox` 在已有对话框开着时会返回 false（`if(cfDlg.open){res(false);return}`），但 `dialog#sample` 是另一个元素，叠加 `showModal()` 在 Chromium 里是允许的（UI-SPEC 假定可叠）；测试要覆盖冲突分支。

### 编辑页入口 `.pe-tools` / `#peSampleBtn`（`renderPlanEditor` ~2468）

**Analog：** `renderPlanEditor` 里 `<button type="button" class="ghost pe-add" data-peact="addgroup" ...>` 的按钮渲染与 `peRoot` 的 `data-peact` 委托。新入口不走 `data-peact`（它不属于草稿动作），用固定 id `peSampleBtn`，点击处理放在 `peRoot` 现有 click 委托里（用 `Grep -n 'peRoot.addEventListener("click"'` 定位）。
- 同时**删除**目标组分区空计划时的 `data-peact="sample"` 按钮及其分支（Grep `peact="sample"` / `case "sample"`）。
- Tab 顺序：保存栏（`#pe-bar`）→ `.pe-tools` → 各分区，即把 `.pe-tools` 插在 `#pe-notice` 后、第一个分区前。

### 文案常量（~2345、452）

**现状（2345 行）：**
```js
const T_PE_EMPTY_TITLE="计划是空的",T_PE_EMPTY_BODY="目标页还没有目标组和力量项。你可以自己建一份，也可以先载入示例计划，再慢慢改。",T_PE_SAMPLE_BTN="载入示例计划",T_PE_SAMPLE_LOADED="已载入示例的目标组和力量项，点「保存计划」后生效",T_GOALS_NO_LIFTS=...
```
**做法：** 改 `T_PE_EMPTY_BODY`、`T_PE_SAMPLE_BTN`；删 `T_PE_SAMPLE_LOADED`（Grep 确认 `loadSampleDraft` 之外没有其他引用）；新增 `T_PE_BTN2`、`T_PK_*`。`wkEmpty`（452 行，HTML 里的硬编码文字，不是 T_ 常量）按 UI-SPEC S5 改文案，同步 `WEEK_EMPTY_PLAN`。`T_PE_HINT_EXPIRED/OFFLINE/TOOLARGE`（2411 行）逐字复用。

## 测试侧

### `tests/support/strings.ts` 与 `tests/support/constants.ts`

**Analog：** strings.ts 第 629-636 行（Phase 12-06 段）。
```ts
export const PE_EMPTY_BODY = '目标页还没有目标组和力量项。你可以自己建一份，也可以先载入示例计划，再慢慢改。';
export const BTN_LOAD_SAMPLE = '载入示例计划';
export const TOAST_SAMPLE_LOADED = '已载入示例的目标组和力量项，点「保存计划」后生效';
export const WEEK_EMPTY_PLAN = '当前计划是空的，这里只统计你记下的内容。可以在「目标」页载入示例计划或编辑计划。';
```
- 逐字复制应用里的新文案（注释写明来源常量名）。`BTN_LOAD_SAMPLE` 改值为 `从示例里挑`（或改名 `BTN_PICK_SAMPLE`，同步 spec import）；`TOAST_SAMPLE_LOADED` 删除；`PE_EMPTY_BODY`、`WEEK_EMPTY_PLAN` 改值；新增 `BTN_PLAN_BUILD`（`自己建一份`）、`T_PK_*` 对应项。注意 `BTN_PLAN_EDIT` 在 plan-editor-archive.spec 的 `#planEditBtn2` 断言处（~373 行）要换成新的 `自己建一份` 常量，因为 `#planEditBtn`（有计划时的入口行）仍用 `编辑计划`。
- `APP_SHA256`（constants.ts:38）每次改 `us-journey-tracker.html` 后重新记录，是应用改完之后的最后一步。

### 受 D-01 影响的 `tests/cloud/**`（"首次登录自动建 DEFAULT_PLAN" 依赖清单）

**判断依据：** `app.open({mode:'cloud', seed, plan, login})` 里 `plan` 给了才会 `putDoc(user,'plan',...)`（`tests/mocks/pb-server.ts:186-192`、`tests/support/app.ts:121`）。只给 `seed`（state）不给 `plan` 时，服务器没有计划文档，首登建档（现状是 DEFAULT_PLAN，D-01 后是空计划）。

**确定会失败，必须改：**
- `tests/cloud/login.spec.ts:78-91`（用例 `PLAN-01 a first sign-in creates the state document and a plan document holding the synthetic default plan`）：断言 `app.fake.lastPlan(0)` 等于 `SEED_PLAN`、目标页 P1 到 P7。要改成断言空计划（`groups:[]`、`lifts:[]`、`presets` 全空、`fitGoal:[2,4]`、`fitNote` 保留）和目标页是空计划卡片。同文件 `SEED_PLAN`（行 29）和其他显式带 `plan: SEED_PLAN` 的用例（如 ACCT-01，行 94）不受影响。
- `tests/cloud/plan-editor-archive.spec.ts` 约 328-430 行用例 `PLAN-02 an emptied plan shows the empty plan card ...`：中段（~357-376）断言编辑页 `act(page,'sample')` 有 `BTN_LOAD_SAMPLE` 文字、`#planSampleBtn` 文字、`#planEditBtn2` 文字；后段（~396-426）是点 `#planSampleBtn` 进编辑页草稿、`TOAST_SAMPLE_LOADED`、7 组 4 力量项、`expect(ed.fit).toEqual({min:'1',max:'3'})`。需整体改写成两个入口各自的行为（见下），且该用例的 `plan` 来自 `syntheticPlan`，已显式放置，所以前半段的"自己清空计划"逻辑可保留。
- `tests/cloud/import.spec.ts`：全部 13 个 `open` 都没有 `plan:`，且多处用 `P2-1`/`P3-1` 等示例任务 id 的旧格式备份（行 87、149、235、473-495）和断言 `readGroups` 的 `doneIds` 含 `P2-1`（行 489、495）。旧备份（format 1）导入"计划不变"，依赖服务器上已有 DEFAULT_PLAN，D-01 后这些任务不在计划里，进度会按孤立处理或不显示。**需逐个用例核对**，通常的修法是 `open` 时加 `plan: SEED_PLAN`（该文件需要增加 `loadAppPure(['normalizePlan','DEFAULT_PLAN'])` 并生成 `SEED_PLAN`，抄 `login.spec.ts:27-29`）。
- `tests/cloud/migration.spec.ts:35-122`（IO-09）：脚本合成的 `synth-plan-seed.json` 是整份计划文档，导入时计划被替换，理论上不受影响，但行 112-122 的 `expect(groups.map(g=>g.code)).toEqual(expect.arrayContaining(['P1','P2']))` 和 `bench` 历史的 P1/bench 来自旧备份，需确认这条路径是否先靠示例计划；**列为需核对**。

**可能受影响（需读一遍上下文再定）：**
- `tests/cloud/remote-update.spec.ts:255-264`：`gotoGoals(sp)` 后 `#goals input[data-lift]` `.first()` 取力量项输入框，只 `seed`，没有 `plan`（该文件 `plan:` 只出现 1 次）。D-01 后空计划下没有力量项输入框，会超时。需要给对应 `open` 补 `plan`。
- `tests/cloud/import-undo.spec.ts:268-276`、`tests/cloud/import-sync.spec.ts:335-344`、`tests/cloud/offline-sync.spec.ts:509-511`、`tests/cloud/conflict-snapshot.spec.ts`（无 `plan:`，11 个 `open`）：这些主要用 `syntheticPlan`、导入的计划或检查日志文本；`import-undo` 的 `codesBefore` 是和 `planBefore.groups` 比较（可能为空数组也相等）。**风险低，但要核对是否有"组数 > 0"的隐含前提**。
- `tests/cloud/export.spec.ts:75-83`：计划文档不合格时显示示例计划并提示（`TOAST_EXPORTED_SAMPLE_PLAN`），走的是 `usePlan` 的 `if(!n)n=normalizePlan(DEFAULT_PLAN)` 兜底，不受 D-01 影响；其余用例已带 `plan:`。
- `tests/cloud/account-data.spec.ts:136-150`（"不合格计划显示默认计划且不被覆盖"）：同上走兜底，不变。行 26 的 `app.fake.seed(syntheticState('b'), {userIndex:1})` 只有 state，用户 b 首登会建空计划，核对它后面是否看目标页。
- `tests/cloud/logout.spec.ts`、`tests/cloud/cloud-harness.spec.ts`、`tests/cloud/reconcile-gate.spec.ts`、`tests/cloud/pb-faults.spec.ts`、`tests/cloud/probes-cloud.spec.ts`：大多只 seed state，不看目标页；`reconcile-gate.spec.ts` 自带 `SEED_PLAN`（行 30）。**低风险**。`logout` 之后恢复 DEFAULT_PLAN 的行为（1951 行）不变。
- `tests/e2e/**`（默认套件，本地版）：不配服务器仍显示示例计划，不受影响，但 `APP_SHA256` 改变会触发 `tests/e2e/platform` 里的哈希基线（`clean-clone.spec.ts` 等）。

**显式放置计划文档的 analog（新用例用这些）：**
```ts
// tests/cloud/login.spec.ts:27-29（放示例计划）
const { normalizePlan, DEFAULT_PLAN } = loadAppPure(['normalizePlan', 'DEFAULT_PLAN']);
const SEED_PLAN = JSON.parse(JSON.stringify(normalizePlan(DEFAULT_PLAN)));
await app.open({ mode: 'cloud', seed: syntheticState('a'), plan: SEED_PLAN, login: 0 });
// tests/cloud/plan-editor-archive.spec.ts:48-52（放合成计划）
const plan: any = syntheticPlan('rs', 2);   // tests/support/cloud-data.ts:39
await app.open({ mode: 'cloud', seed, plan, login: 0 });
// 在运行中途放置/删除：app.fake.seed(state, {userIndex, plan}) 或 app.fake.dropDocs(userIndex, 'plan')（pb-server.ts:186, 368）
```
- 想测"首登建空计划"：`app.open({mode:'cloud', users:1, login:0})` 不传 `seed`（`login.spec.ts:78-91` 同款）；`app.fake.lastPlan(0)` 读服务器计划。
- 想让 `seed` 的账号首登建空计划：只传 `seed` 不传 `plan`。

### 新增 spec 建议：`tests/cloud/plan-onboarding.spec.ts`

**Analog：** `tests/cloud/plan-editor-archive.spec.ts`（用例结构、`app.open`、`expectToast`、`savePlan`、`readEditor`、`readGroupIds`）与 `tests/support/plan-editor.ts`（`openEditor`、`card`、`expand`、`act`、`readEditor`；隐私约束：定位器按 `data-*` 取，不读计划文字）。
- 需要新增的 helper 放 `tests/support/`（建议 `plan-picker.ts`，同样只能从 `@playwright/test` 和 `./strings` 导入以免与 `./test` 循环）：`openPicker`、`checkItem(page,'g:P2')`、`readPicker`（返回 `hint`、`okDisabled`、`checked`、`dup`、`disabled` 列表等布尔和编号，不返回示例文字以外的个人文字）。
- 断言要点（来自 UI-SPEC 的测试提示）：`toBeDisabled()` 会把 `aria-disabled="true"` 也算作不可用，所以另需断言"点击不打开对话框 / 不保存、只弹 toast"；断网用 `tests/support/online.ts`（`app.fake.fault(...)` / `refuseRealtime`，读该文件确认现成开关）；冲突用 `app.fake.beforeNext('POST'|'PATCH', ...)`（pb-server.ts:363，参考 `reconcile-gate.spec.ts:483`）；过期用 `app.fake.revokeTokens(userIndex)`（pb-server.ts:354）。
- 覆盖面：首登建空计划（含 `presets` 全空、`fitGoal`）、已有计划文档的账号不变、卡片两按钮文字、挑选默认全不勾且确认不可用、挑选并直接保存（新 id 前缀 `g-/t-/l-`、不带 presets、toast `T_PK_DONE`）、同名标记、名额上限（20/8，归档不占名额）、编辑页 `#peSampleBtn` 追加到草稿且不单独保存、`放弃这次修改` 能撤回、断网/过期（卡片变灰、编辑页仍可用）、冲突三选一三个出口、窄屏 375px 底部面板（`page.setViewportSize`，参考现有 narrow 用例）。

## Shared Patterns

### 保存路径限制（断网/过期/冲突/容量）
**Source:** `us-journey-tracker.html:2411-2415`（`peBlock`）、`2866-2935`（`savePlanDraft`）
**Apply to:** 卡片模式确认按钮、`#planSampleBtn`、`#planSampleWhy`、`#pk-hint`
```js
function peBlock(){
  if(net==="expired")return T_PE_HINT_EXPIRED;
  return ["offline","retrying","unreachable","slow"].includes($("status").getAttribute("data-state"))?T_PE_HINT_OFFLINE:"";
}
```

### 带 `ms` 的 toast
**Source:** `us-journey-tracker.html:2987`
**Apply to:** 本阶段全部新 toast（4000/6000/8000/3000）。`toast(m,act,ms)`，`ms!=null` 时加 `data-cloud` 宽度规则。

### 三选一确认框
**Source:** `confirmBox`（1545-1575），调用样例在 `savePlanDraft` 的 `mid:{text,cls:"danger"}` + `scope:"plan"`。返回值：`false`（取消/Esc/点背景）、`"mid"`、`true`。
**Apply to:** 卡片模式冲突处理，`T_PK_CF_*` 新常量。

### 渲染与 id 生成
**Source:** `renderPlanEditor`（2468）、`peUsedIds`（2512）、`uid`（649 行 `const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7)`）
**Apply to:** 两种模式的新 id（D-08）。

### 转义
**Source:** `esc()`。所有文案、示例名、类别文字经 `esc()` 写入模板字符串；模板里不写 `style=""`（CSP）。

### 测试文案同源
**Source:** `tests/support/strings.ts`；`T_…` 常量逐字复制；每次改应用重新记录 `APP_SHA256`。

## No Analog Found

无。唯一没有同类的是"带复选框列表、可滚动、底部固定按钮的 `<dialog>`"，已用 `dialog#confirm` 的外壳 + UI-SPEC 的 CSS 骨架组合；规划时以 UI-SPEC 为准。

## Metadata

**Analog search scope:** `us-journey-tracker.html`（锚点行 452、516-618、634、649、1086、1204-1215、1545-1575、2171、2326、2345、2396、2411-2431、2468、2512、2766、2866-2935、2987、CSS 215-226、324-348）、`tests/cloud/*.spec.ts`（31 个文件）、`tests/support/*.ts`、`tests/mocks/pb-server.ts`
**Files scanned:** 约 45
**Pattern extraction date:** 2026-11-12
