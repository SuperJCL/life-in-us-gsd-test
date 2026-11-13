# Phase 15: 健身页（Fitness Tab）- Pattern Map

**Mapped:** 2026-11-13
**Files analyzed:** 14 个源码 / 工具 / 测试支持文件，外加 26 个受影响的现有 spec（见「现有测试盘点」）
**Analogs found:** 14 / 14（本阶段都在单文件应用内扩展，没有需要新建的源码文件；折线图 SVG 是唯一没有直接同类的部分）

> 行号以当前工作树 `us-journey-tracker.html`（3231 行）为准；Phase 14 之后行号已移动，写计划时请用函数名再核对一次。所有 analog 路径都是 git 已跟踪的源码（已用 `git ls-files` 核对）。
> 应用是一个近乎压缩的单文件，下面的摘录都截短到 200 字符以内的关键片段，不要整行照搬。

## File Classification

| 新增 / 修改的位置 | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `us-journey-tracker.html` 标签栏 + `<section id="tab-fit">` + `showTab` | route / view | request-response | 现有 `data-tab="tl"` 与 `#tab-tl`（485–492 行，536 行，`showTab` 2419 行） | exact |
| `us-journey-tracker.html` `state.workouts` + `normalize` / `importProblem` / `LEGACY_KEYS` / `backupCounts` | model | CRUD + transform | 同文件 `lifts` 的校验与规范化（`normalize` 738–793 行，`importProblem` 717–736 行，`LEGACY_KEYS` 796 行） | exact |
| `us-journey-tracker.html` 训练写入（`saveWorkout` / `deleteWorkout`，走 `commit(["wo:"+date], fn)`） | service | CRUD + event-driven（离线 ops、远端重放） | `addLog` / 删除记录的撤销（2111、2303–2304 行）、`saveLift`（2389 行） | exact |
| `us-journey-tracker.html` 记录区 `#fl`（草稿、校验、保存栏） | component | request-response | 编辑计划页的草稿与校验（`pe`、`peLiftCard`、`PE_ERR`、`peBar`，2411、2539–2625 行）；`renderKeep`（1984 行） | role-match |
| `us-journey-tracker.html` 本周训练 + 力量目标卡 `#fw` | component | transform | `renderGoals` 里的 `fit` 卡片（2234–2245 行）+ `goalsBars()`（2255 行）；`renderWeek` 的 `.area` 目标行（2186 行） | exact |
| `us-journey-tracker.html` 趋势图 `#fc`（纯函数取点 + SVG 绘制 + 翻页） | component | transform | 无同类（见 No Analog）；控件外观沿用 `.seg` 芯片组与 `renderTimeline` 的筛选按钮（2284–2286 行） | partial |
| `us-journey-tracker.html` 训练历史 `#fh` | component | transform | `renderTimeline`（2284–2297 行，月份分组 `.tl-month`）+ `archivedHTML` 的 `<details>`（2261 行） | role-match |
| `us-journey-tracker.html` 本周 / 日历 / 日面板 / 时间线里的「健身」行 + `eventsOn` | view | transform | `eventsOn`（2106 行）及其三个调用点：`renderWeek` `.ent`、`renderCal` chip、`renderDay` `.items`、`renderTimeline` `items` | exact |
| `us-journey-tracker.html` 计划形状 `cardio`（`normalizePlan`、`DEFAULT_PLAN`、`PLAN_MAX`、`planProblems`、`emptyPlan`、`planUsedIds`、`pickSample`） | model | CRUD | 同文件 `lifts` 全套（`normalizePlan` 651–656 行，`PLAN_MAX` 858 行，`planProblems` 884–893 行，`pickSample` 912–918 行） | exact |
| `us-journey-tracker.html` 编辑计划页「有氧项」区 + 力量项上限 20 | component | CRUD | `peLiftCard` / `peFitHTML` / `peAddLift` / `peUsedIds`（2584–2625 行） | exact |
| `us-journey-tracker.html` 示例挑选 `dialog#sample` 增加有氧一栏 | component | event-driven | `pkRender` / `pkRoom` / `pkPicked`（3065–3095 行） | exact |
| `us-journey-tracker.html` 门控、退出清理、CSV、`renderKeep`、`renderAll` | config / utility | event-driven | `GATE_ALLOW` / `GATE_BLOCK`（1153、1172 行）、清理列表（1125、2043 行）、`exportCsv`（3200 行） | exact |
| `tools/plan/migrate-backup.mjs` | utility | batch | 自身：它通过 `COMPOSE_EXPR` 在内存里求值应用的 `normalize` / `classifyBackup`（75–105 行），本阶段基本自动跟随 | exact |
| `tests/e2e/fitness/**`、`tests/cloud/fitness-*.spec.ts` + `tests/support/fitness.ts`（新增） | test | request-response | `tests/e2e/goals/lifts.spec.ts` + `tests/support/goals.ts`；云端用 `tests/cloud/plan-editor-fit.spec.ts` + `tests/support/plan-editor.ts`、`plan-picker.ts` | role-match |
| `tests/support/strings.ts`、`tests/support/constants.ts`（`APP_SHA256`） | config | — | 同文件现有条目（`TAB_LABELS` 15 行、`weekFitGoalLine` 564 行、`pkLimL` 736 行） | exact |

## Pattern Assignments

### 1. 标签栏与 `#tab-fit`（route / view）

**Analog:** `us-journey-tracker.html` 485–492 行、536 行、2418–2422 行

**标签栏**（485–490 行）：新标签放在 `data-tab="tl"` 之后、`.toolbar` 之前。
```html
<button role="tab" data-tab="tl" aria-selected="false">时间线</button>
<button role="tab" data-tab="fit" aria-selected="false">健身</button>
```

**面板容器**（536 行是 `<section id="tab-tl" class="hidden">`）：新增 `<section id="tab-fit" class="hidden" aria-labelledby="fit-h2">`，内部是 `h2.sr-only` 加四个 `section.panel`，由 `renderFit()` 用整页字符串模板写入。

**showTab**（2419–2422 行）：只改一个数组。
```js
function showTab(k){
  document.querySelectorAll("[data-tab]").forEach(x=>x.setAttribute("aria-selected",x.dataset.tab===k));
  ["wk","cal","goal","tl","plan"].forEach(x=>$("tab-"+x).classList.toggle("hidden",x!==k));
}
```
加 `"fit"`。`showTab("fit")` 之后再画趋势图（容器隐藏时 `clientWidth` 为 0）。`curTab()`（2418 行）读 `[data-tab][aria-selected="true"]`，自动支持；`closePlanEditor(tab)` 回到哪个标签也走 `showTab`。

**点击入口**（2297 行起 `document.querySelector("nav.tabs").addEventListener("click",…)`）：已按 `[data-tab]` 委托，且先过 `peLeave()`；不用改。

**CSS 注意**：`nav.tabs button{padding:10px 14px}`（60 行）；只在 `@media (max-width:560px)` 里追加 `padding:8px 12px;min-height:44px`（UI-SPEC S1）。

---

### 2. `state.workouts` 的数据形状与校验（model, CRUD + transform）

**Analog:** `normalize`（738–793 行）里的 `lifts` 段、`importProblem`（717–736 行）、`LEGACY_KEYS`（796 行）、`let state=…`（691 行）

**初始 state**（691 行）：
```js
let state={arrival:"",tasks:{},custom:[],logs:[],lifts:{},reviews:{},presets:{}};
```
加 `workouts:{}`。同样的字面量要 grep `lifts:{}` 全文核对（`normalize` 返回值 792 行也是固定形状）。

**normalize 的返回值是固定形状，会丢掉不认识的键**（792 行）：
```js
return {arrival:…,tasks,custom,logs,lifts,reviews,presets};
```
这是 15-CONTEXT 里「旧页面丢键」风险的根源。新增 `workouts` 必须在这里显式返回。UI-SPEC 建议保留未知键，由 planner 决定；最小做法是只加 `workouts`，不做通用保留。

**lifts 的规范化写法，直接照抄**（773–779 行）：
```js
const lifts=Object.fromEntries(Object.keys(isObj(s.lifts)?s.lifts:{}).filter(k=>LIFT_ID_RE.test(k)&&isObj(s.lifts[k])).map(k=>{
  const r={...s.lifts[k]};
  if(r.cur!==undefined&&!fin(r.cur))delete r.cur;
  if(r.hist!==undefined)r.hist=Array.isArray(r.hist)?r.hist.filter(x=>isObj(x)&&okDate(x.date)&&fin(x.v)):[];
  return [k,r];
}));
```
`workouts` 用同样的 `Object.fromEntries(Object.keys(...).filter(realDate)...)`：键必须是 `realDate`（按日期键 `wo:<日期>` 的键是 commit 的 key，文档里存 `workouts[<日期>]`）；动作 id 过 `LIFT_ID_RE`，有氧 id 过新的 `CARDIO_ID_RE`（建议 `/^r-[A-Za-z0-9_-]{1,40}$/`，不和 `P`、`g-`、`t-`、`l-`、`c-` 撞）；组 `{w,r}` 限 `0≤w≤1000`、`1≤r≤999` 整数、每动作最多 20 组；有氧 `m` 1–1440 整数、`d` 可选 >0 且 ≤1000。非法的组 / 项丢掉，不丢整天（和 lifts 的 hist 过滤一致）。正则常量放在 565 行附近那一行。

**importProblem 的写法**（717–736 行）：对容器里「能识别出的条目」逐个检查，返回短原因字符串。
```js
const items=c=>Array.isArray(c)?c:isObj(c)?Object.values(c):[];
for(const l of items(raw.logs))if(!isObj(l)||typeof l.id!=="string"||!LOG_ID_RE.test(l.id)||!okDate(l.date))return "log";
…
const L=raw.lifts;
if(L!==null&&typeof L==="object")for(const k of Object.keys(L)){
  if(!LIFT_ID_RE.test(k)||!isObj(L[k]))return "lift";
```
加一段 `raw.workouts`：键不是 `realDate`、动作 / 有氧 id 不合规返回 `"workout"`。数值范围的修正交给 `normalize`（载入和导入共用，对合格数据恒等）。

**白名单**（796 行）：
```js
const LEGACY_KEYS={arrival:v=>typeof v==="string",tasks:isObj,lifts:isObj,reviews:isObj,custom:Array.isArray,logs:Array.isArray,presets:v=>isObj(v)&&Object.values(v).every(isObj)};
```
加 `workouts:isObj`。`legacyShape`（797–801 行）要求「至少出现一个已知键且出现的每个都类型对」，所以带 `workouts` 的 format 2 备份仍通过，只含 `workouts` 的文件也会被认出。

**摘要计数**（`backupCounts` 826–832 行）：现在有 `liftEntries`。加 `workouts`（训练天数）并同步导入确认框的摘要文案（`importPreview` 在 834 行附近，文案常量在 Phase 11 的 `T_IMP_*` 一带，需 grep `liftEntries`）。

**liftHistoryCount**（855 行）：现在只数 `state.lifts[id].hist`。编辑计划页判断「有历史的力量项只能归档」（2705、2744、2776、2801、2904、2910 行）依赖它。训练记录引用了某力量项时也要算作历史：让它再加上 `workouts` 里引用该 id 的天数，否则用户能「直接删除」有训练记录的动作。有氧项需要对称的 `cardioHistoryCount`。

---

### 3. 训练的写入、同步与撤销（service, CRUD + event-driven）

**Analog:** `commit`（935 行）、`persist`（922 行）、`addLog`（2111 行）、删除记录 + 撤销 toast（2303–2304 行）、`saveLift`（2389–2394 行）

**commit 的契约**（935 行与其上方注释 924–925 行）：
```js
function commit(keys,fn){takeRemote();fn(state);if(CLOUD&&me&&docs.state)ops.push({keys,fn});persist(...keys);if(remoteView)applyView(true)}
```
- 键只是「触及标记」：`persist` 把它们放进 `docs.state.touched`（922 行），真正的合并靠重放：`docAfter()`（1921 行附近）对挂起的远端 state 先 `normUnder`，再对 `ops` 逐个 `o.fn(s)`。所以**没有按键类型解释键的代码**，`"wo:"+date` 这个键不需要登记任何地方。
- 注释要求 fn 必须**幂等、按 id 或键定位、不读 DOM、不调 persist / render / toast，闭包里带齐写入值**。训练的 fn 就是 `s.workouts[date]=<整天的深拷贝>`（整天覆盖，D-06 一天一条，键就是日期），删除是 `delete s.workouts[date]`，撤销是把删前的深拷贝写回。重放在远端新版本上执行时，`s.workouts` 可能不存在（旧文档），fn 里先 `s.workouts=s.workouts||{}`。
- 重放前远端 state 会经 `normUnder` → `normalize`，所以 `workouts` 不进 `normalize`，远端带来的训练会被丢。

**写入加撤销 toast 的写法，照抄**（2303–2304 行）：
```js
const gone=JSON.parse(JSON.stringify(state.logs[i]));commit(["log:"+id],s=>{s.logs=s.logs.filter(l=>l.id!==id)});renderAll();
toast("已删除这条记录",{label:"撤销",fn:()=>{commit(["log:"+id],s=>{if(!s.logs.some(l=>l.id===id))s.logs.splice(Math.min(i,s.logs.length),0,JSON.parse(JSON.stringify(gone)))});renderAll();toast("…")}});
```
`toast(msg, act, ms)`（3221 行）：`act={label,fn}`，传 `ms` 时 toast 带 `data-cloud` 属性并按 `ms` 毫秒消失，`ms` 缺省撤销 toast 是 5000、普通 1800。UI-SPEC 的 6000 / 5000 / 3000 直接传 `ms`。注意：`ms!=null` 会设 `data-cloud`，和 12、14 阶段云端 toast 一致。

**saveLift 要去掉的东西**（2389–2394 行）以及 `$("goals").addEventListener("input",…data-lift…)`（2395 行起）、`renderKeep` 里的 `[data-liftsave]` 保留逻辑（1989、1993 行）和 `lf-` 恢复。`state.lifts` 变成只读历史来源。

**门控**：`flush()`（936 行附近）在 `data-gate` 时直接 return；写入在门控期间应被 `GATE_BLOCK` 拦截，见「Shared Patterns / 门控」。

---

### 4. 记录区 `#fl`（component, request-response，草稿）

**Analog:** 编辑计划页的草稿会话（`pe`，2539 行 `renderPlanEditor`，`PE_ERR` 2411 行，`peBar`，`peLiftCard` 2603–2617 行）；全量重绘时保住输入的 `renderKeep`（1984–1997 行）

**折叠 / 校验 / 错误文字写法，照抄**（`peLiftCard`，2606–2614 行）：每个字段有 `<label>`、`data-pefield`、`aria-describedby="pe-e-…"`、紧跟一个 `<p class="pe-err" id="pe-e-…" hidden></p>`；校验结果由 `planProblems` 风格的纯函数产出 `[{key,code}]`，再由渲染层映射到 `PE_ERR[code]`。训练的校验也按这个结构：一个纯函数 `workoutProblems(draft)` 返回 `[{key,code}]`（可单测），错误文案放 `T_FL_ERR` 常量表。

**PE_ERR 常量表的位置与写法**（2411 行）：`const PE_ERR={gname:"请填写目标组名称",…}`。新文案进 `T_…` 常量并同步 `tests/support/strings.ts`（这是项目既有约定）。

**草稿不被全量重绘冲掉**：`renderAll`（2164 行）会无条件重画所有标签。`#tab-plan` 靠 `renderKeep` 保住焦点，计划编辑页不被 `renderAll` 触及。记录区要在 `renderFit()` 里：草稿有未保存内容或记录区里有焦点时跳过 `#fl` 的重画（UI-SPEC S3），其余分区照常重画。不要把 `[data-liftsave]` 那套搬到这里。

**确认框**：`confirmBox({title,lines,cancel,ok,scope?,okClass?})`（1615 行），返回 `Promise<boolean>`，取消键默认焦点，Esc 等同取消。「换一天记录？」「放弃没保存的内容？」直接调用，`ok` 缺省是 `.danger`，符合 UI-SPEC。`scope:"plan"` 只给计划编辑页，这里不传。

**本机留底键**：见「Shared Patterns / 退出清理」，`usj:v2:<uid>:wodraft`。

**beforeunload**：`pe` 已有同类逻辑（grep `beforeunload`），照抄注册 / 注销方式。

---

### 5. 本周训练、力量目标卡 `#fw`（component, transform）

**Analog:** `renderGoals` 里的 `fit` 卡片（2234–2245 行）

```js
const fit=`<div class="group k-fit"><div class="group-h"><span class="p">健身</span><h3>力量目标</h3></div>
  <p class="note">${esc(plan.fitNote)}</p>
  ${activeLifts().length?"":`<p class="empty">${T_GOALS_NO_LIFTS}</p>`}<div class="lifts">${activeLifts().map(L=>{const s=lift(L.id),pct=Math.min(100,(s.cur/L.target)*100);
    …<div class="lbar"><i data-w="${pct}"></i></div>
```
- 整块从 `renderGoals` 删掉（`fit+` 从 2248 行那串拼接里去掉，`planEmpty()` 分支 2246 行不变），在 `renderFit` 里重写成只读的 `.fw-lift`。当前值取「最近一次训练里最重一组」，没有训练时回落到 `lift(id).cur`（712 行，`Object.assign({cur:L.def,hist:[]},state.lifts[id]||{})`，已经带 `def` 回落，不用另写）。
- `T_GOALS_NO_LIFTS`（现有常量）在两处都复用；归档的力量项不渲染（用 `activeLifts()`，797 行）。
- **进度条**：`goalsBars()`（2255 行）用 CSSOM 画宽度，因为 `style-src-attr 'none'`：
  ```js
  function goalsBars(){$("goals").querySelectorAll("i[data-w]").forEach(i=>{i.style.width=i.getAttribute("data-w")+"%"})}
  ```
  新增 `fitBars()` 对 `#tab-fit` 做同样的事，`renderFit` 末尾调用。注意 `goalsBars` 只查 `#goals`，所以目标页上的归档条仍然正常。
- **本周训练天数**：要和 `renderWeek` 的 `.area` 目标行是同一个数（见下一节）。写一个共用函数 `trainDays(from,to)`，返回「`workouts` 的日期 ∪ `cat==="健身"` 日志日期」的 `Set`，两处都调用，避免两个口径。

---

### 6. 「健身」行进入本周 / 日历 / 日面板 / 时间线（view, transform）

**Analog:** `eventsOn`（2106–2110 行）及四个调用点

```js
function eventsOn(date){
  const logs=state.logs.filter(l=>l.date===date);const due=[],done=[];
  allTasks().forEach(t=>{…});
  return {logs,due,done};
}
```
- 给返回值加 `wo`（那一天的训练或 `null`），并提供 `woSummary(w)`（UI-SPEC S9，动作名最多 3 个、有氧最多 2 个，超出写 `等 {n} 项`）。**不要**把训练塞进 `logs`：`logs` 项带 `data-edit`，会被编辑器、拖拽和 `applyGate` 的 `[data-edit]` 规则（1158 行）当成可编辑记录。
- **renderWeek**（2183–2200 行）：
  - 目标行 2186 行要改成并集：
    ```js
    if(C.n==="健身"){const d=new Set(logs.filter(l=>l.cat==="健身").map(l=>l.date)).size;goal=`<div class="goal ${d>=plan.fitGoal[0]?"ok":""}">训练 ${d} 天，目标 …`}
    ```
    把 `d` 换成 `trainDays(wk,end).size`。`weekFitGoalLine`（`tests/support/strings.ts` 564 行）的文案格式不变。
  - 日列 `.ent`（2191–2193 行）：在 `ents` 里加 `<div class="ent wo k-fit" data-wo="${date}" tabindex="0" role="button" aria-label="…">`，不加 `draggable`、不加 `data-edit`。
- **renderCal**（2206–2217 行）：在 `chips` 数组里加一枚 `<span class="chip k-fit">…</span>`，单行省略；`aria-label` 里的计数文案（2216 行）要不要加训练由 UI-SPEC S9 定。
- **renderDay**（2220–2231 行）：`做过的事` 那一节之前或之后加训练行，同样用 `data-wo`，没有训练不渲染。
- **renderTimeline**（2284–2297 行）：`items` 是 `{date,text,tag,k,attr}`，训练行直接 push 一项，`attr:'data-wo="…"'`，`tag:"健身"`，`k:"fit"`。筛选条件：`filter==="全部"||filter==="健身"` 时加入（现有 `filter` 是类别名字符串，`opts` 在 2285 行，不需要新按钮）。行 class 是 `tl-item k-${it.k} editable`（2294 行），测试用选择器要求 `.tl-item.wo`，所以 item 加一个 `cls:"wo"` 字段拼进去。
- **点击跳转**：在 `document` 上现有的 `data-edit` 委托（grep `closest("[data-edit]")` 附近）旁边加一个 `[data-wo]` 委托：`showTab("fit")`，载入该日期，焦点到 `#fl-title`。草稿有未保存内容时先走「换一天记录？」确认。
- **门控**：`[data-wo]` 是只读导航，要放进 `GATE_ALLOW`，别用 `data-edit`（`applyGate` 会给 `[data-edit]` 加 `aria-disabled` 并让它不可点）。

---

### 7. 计划里的 `cardio` 与力量项上限（model, CRUD）

**Analog:** `lifts` 在 `normalizePlan` / `PLAN_MAX` / `planProblems` / `emptyPlan` / `planUsedIds` / `pickSample` 里的全部写法

**normalizePlan**（633–658 行）。`lifts` 是必填数组（634 行 `!Array.isArray(p.lifts)` 直接返回 null）；`cardio` **必须可选**，旧计划（含 Phase 12、14 保存的计划和迁移脚本的种子计划）没有这个键，缺省当 `[]`。力量项的校验是模板：
```js
for(const l of p.lifts){
  if(!pObj(l)||!pStr(l.id)||!LIFT_ID_RE.test(l.id)||lids.has(l.id)||!pStr(l.n)||!pStr(l.unit)||!pNum(l.def)||!pNum(l.target)||l.target<=0)return null;
  if(l.note!==undefined&&!pStr(l.note))return null;
  if(l.archived!==undefined&&typeof l.archived!=="boolean")return null;
  lids.add(l.id);const o={id:l.id,n:l.n,unit:l.unit,def:l.def,target:l.target,note:…};if(l.archived!==undefined)o.archived=l.archived;lifts.push(o);
}
```
有氧项：`id` 过 `CARDIO_ID_RE`、不重复，`n` 字符串，`note` 可选字符串，`target` 可选 `{kind:"km"|"min",v:有限数且>0}`，`archived` 可选布尔。返回值（657 行）末尾加 `cardio`。注意：**id 唯一性要和 lifts 的 `lids` 分开**，有氧 id 前缀不同，不会撞。`usePlan`（664 行）和 `peCanon`/`canon`（`planDirty` 比较，2413 行）使用 `plan` 的整体 JSON，所以 `cardio` 会自动进入「有没有改动」的比较，但要确认 `canon` 里键序不依赖形状。

**DEFAULT_PLAN**（571–632 行，lifts 在 612–616 行）：在 `lifts` 之后加 `cardio:[{id:"run",…}]`——注意 id 必须过新正则：UI-SPEC 说示例有氧项走新前缀，而 `DEFAULT_PLAN.lifts` 用的是裸字母 id（`bench`、`squat`）。`pickSample` 会换成 `r-` 前缀的新 id，所以示例的内置 id 可用 `r-run`、`r-bike`、`r-walk` 这类，或用 `[a-z]{1,16}` 的裸字母并让 `CARDIO_ID_RE` 同样接受（和 `LIFT_ID_RE` 565 行的写法一致：`/^([a-z]{1,16}|r-[A-Za-z0-9_-]{1,40})$/`）。**要在计划里决定一次**；因为 `stable-ids.spec.ts` 冻结示例计划的 id，选好后写进测试。

**PLAN_MAX**（858 行）：
```js
const PLAN_MAX={groups:20,tasks:50,lifts:8,tags:20,name:40,text:200,note:200,tag:30,unit:8};
```
`lifts:8` 改 20，新增 `cardio:20`。测试逐字比较了这个对象：`tests/e2e/data/plan-normalize.spec.ts:255`。

**planProblems**（860–893 行）：`lifts` 段是模板，`la++===PLAN_MAX.lifts` 报 `llimit`。照抄一段给 `cardio`：名称为空 `cname`、超长 `nlong`、`target` 设了但 `v<=0` 报 `ctarget`、超数量 `climit`。码值要进 `PE_ERR`（2411 行）。

**emptyPlan**（904 行）：`s.lifts=[]` 后加 `s.cardio=[]`；`planUsedIds`（906 行）加有氧 id；`pickSample`（909–918 行）加有氧段（`nid("r-")`）并返回 `{groups,lifts,cardio}`。`planCounts`（823 行）和导入摘要同步加 `cardio` 计数（影响 `backup-format.spec.ts`、`tests/cloud/migration.spec.ts` 里 `planCounts` 的逐字比较）。

**文案里的 8**：`T_PE_LIM_LIFTS="最多 8 个"`（2414 行）、`PE_ERR.llimit`、`T_PE_AR_LIM` 的 `力量项最多 8 个，请先删掉或归档多余的`（grep `力量项最多`）、恢复上限 `力量项已满（8 个）…`、挑选框 `T_PK_LIM_L` / `T_PK_FULL_L`（3042 行附近）都是字面写死的 8，要改成 20，并同步 `tests/support/strings.ts`（`PE_LIMIT_LIFTS` 573 行、`PE_ERR_LIFT_LIMIT` 592 行、`PE_RESTORE_LIMIT_LIFTS` 627 行、`pkLimL` 736 行、`PK_FULL_L` 737 行）。`T_PE_ARCH_LIFT_BODY` 的文字不含数字，不用改（但它说「归档后目标页只读显示它的历史」，搬走卡片后措辞要重新核对，见 S10）。

---

### 8. 编辑计划页的有氧项区（component, CRUD）

**Analog:** `peLiftCard` / `peFitHTML` / `peAddLift` / `peLift` / `peUsedIds`（2584–2625 行）及其事件分发（`data-peact="addlift"|"dellift"|"toggle"`，2744、2772–2776、2801、2824 行的归档 / 删除 / 恢复流程）

要复制的四处：
1. **卡片**（2603–2617 行）：`<div class="pe-card k-fit" data-key="l:${id}">` 折叠头 + `pe-body`，字段用 `data-pefield="l:${i}:n"` 这类三段键，分发在 `data-pefield` 的 input 处理里（grep `data-pefield` 找到写回草稿的代码）。有氧用 `c:` 前缀（`data-key="c:${id}"`、`data-pefield="c:${i}:n"`），注意与现有 `"g:"`、`"l:"`、`"p:"` 键前缀不冲突，且 `pe.open`、`pe.seen`、`pe.gone` 里按 key 区分种类的地方（2705–2744 行的 `kind==="lift"` 分支）要加 `"cardio"` 分支。
2. **新增**（`peAddLift` 2599–2603 行）：
   ```js
   const u=peUsedIds();let id;do{id="l-"+uid()}while(u.has(id));
   pe.draft.lifts.push({id,n:"",unit:"",def:0,target:"",note:""});
   pe.open.add("l:"+id);renderPlanEditor();peBar();peFocus("pe-f-l-"+id+"-n");peSay(T_PE_LIVE_ADDED_LIFT);
   ```
   有氧：`id="r-"+uid()`，`{id,n:"",note:""}`（`target` 缺省）。`peUsedIds`（2584 行）要把有氧 id 加进 `u`（含 `pe.gone` 里的），`pe.origIds` 的构建（grep `origIds:`）也要加。
3. **上限**（2623 行）：`ls.length>=PLAN_MAX.lifts` 控制按钮 `disabled` 和 `.pe-lim` 文案，力量项这里随 `PLAN_MAX.lifts` 自动变 20；有氧同样用 `PLAN_MAX.cardio`，文案「最多 20 个」。
4. **归档 / 删除**（Phase 12 D-01：有历史只能归档）：有氧项有训练记录（`cardioHistoryCount`）时只能归档；归档的有氧项不占名额、不出现在记录区芯片，但旧训练里照常显示并带 `已归档` 标记（样式 `.arch-mark`，213 行）。归档区列表（2772–2776 行）加有氧段。

`peFitHTML`（2619–2625 行）是整段的容器：在力量项之后追加有氧小标题和卡片列表即可。

---

### 9. 示例挑选 `dialog#sample` 加有氧栏（component, event-driven）

**Analog:** `pkRender` / `pkRoom` / `pkPicked` / `pkHint`（3065–3115 行）

`pkRender` 里 `lifts` 栏是模板：对比计划取未归档项、同名检测（`data-dup`）、名额 `room.l=Math.max(0,PLAN_MAX.lifts-al.length)`、渲染 `<label class="pk-item k-fit"><input type="checkbox" data-pk="l:${L.id}"…>`。有氧栏：`data-pk="c:${id}"`（注意 `pkPicked` 用 `k.startsWith("l:")` 计数，所以前缀用 `"c:"`，且别和 `"g:"` 混）；`room.c=PLAN_MAX.cardio-ac.length`。

`pkRoom`（3077 行）是一个按前缀循环的数组：
```js
[["g",pk.room.g],["l",pk.room.l]].forEach(([k,r])=>{ … input[data-pk^="k:"] … lid="pk-lim-"+k
```
加 `["c",pk.room.c]` 和对应的 `#pk-lim-c` 元素。`pkPicked`（3095 行）加 `c` 计数；`pkParts(g,l)`（3043 行，`T_PK_PICKED`、`T_PK_DONE`、`T_PK_DRAFTED` 都经它）要加第三个参数，为 0 的部分省略。`pickSample(keys,used)` 返回 `cardio`，两个确认函数（卡片模式保存、编辑页模式追加草稿，`openSamplePicker` 之后的 `pkConfirm` 一类函数）都要把 `cardio` 并进计划。

---

### 10. 趋势图（component, transform）—— 没有同类

见「No Analog Found」。外围可以复用：
- 控件：`.seg` 芯片组（119–120 行）；`#tab-plan .seg button[aria-pressed="true"]{background:var(--s);color:var(--ink);border-color:var(--c)}`（208 行）是 UI-SPEC 选中态的现成写法，复制成 `#tab-fit .seg`。
- 筛选按钮的渲染 + 委托（`renderTimeline` 2285–2286 行，`aria-pressed` + `data-filter`）：指标 / 范围芯片用同样的 `aria-pressed="${…}"` + `data-fc-metric` / `data-fc-range`。
- 进度条之外的所有宽度、颜色一律走 class 或 SVG 属性，不写 `style=""`（`style-src-attr 'none'`，`tests/cloud/csp.spec.ts` 会检查）。

**纯函数**（UI-SPEC 要求可单测）：`seriesOf(workouts, lifts, liftId, metric, range, today)` 返回 `[{date,v,old}]`，只读参数、不碰 DOM。单测的加载方式：`tests/e2e/data/plan-normalize.spec.ts` 顶部的 `loadAppPure(NAMES)`（`const NAMES=['DEFAULT_PLAN','normalizePlan',…]`，10 行）会按名字从应用源码里抽函数，新函数名要登记进新的 NAMES。

---

### 11. 训练历史 `#fh`（component, transform）

**Analog:** `renderTimeline`（2284–2297 行，按月分组）+ `archivedHTML` 的 `<details class="arch" id="goalsArch">`（2278–2282 行，展开状态存在模块变量 `goalsArchOpen`，重绘不收起）

月份小标题直接用 `<div class="tl-month">${esc(yyyy)} 年 ${+mm} 月</div>`（2292 行）。每次训练一个 `<details class="fh-item"><summary>`；展开状态要跨 `renderAll` 保持，和 `goalsArchOpen` 一样放进模块变量（按日期的 `Set`）。「显示更早的记录」每次多 20 次，计数放模块变量。

---

## Shared Patterns

### 门控（对账中 / 连不上只读）
**Source:** `us-journey-tracker.html` 1153–1180 行
```js
const GATE_ALLOW="nav.tabs [data-tab],#wkPrev,…,#exportCsv,#exportJson";
function applyGate(){ … document.querySelectorAll(".wrap button,.wrap input,.wrap select,.wrap textarea").forEach(el=>{if(el.disabled||el.matches(GATE_ALLOW))return;el.disabled=true;markGate(el,"d")}) … }
const GATE_BLOCK="[data-edit],…,[data-lift],[data-liftsave],[data-addto],[data-addbtn],[data-peact]";
function gateGuard(e){ … if(t.closest(GATE_BLOCK)||!t.closest(GATE_ALLOW+",.day")){e.stopImmediatePropagation();e.preventDefault()} }
```
**这里有一个陷阱，必须在计划里写明**：`GATE_BLOCK` 含 `[data-lift]`。UI-SPEC 的 `.fl-ex[data-lift]` 和 `.fc[data-lift]` 都用了这个属性，门控期间点到它们内部的任何元素（包括应该保持可用的趋势图「查看数据」、翻页）会被 `gateGuard` 的 `t.closest(GATE_BLOCK)` 吞掉。两个办法选一个：(a) 力量目标卡搬走、`saveLift` 删除之后，把 `[data-lift]` 和 `[data-liftsave]` 从 `GATE_BLOCK` 删掉（目标页上不再有这两个属性）；(b) 新元素改用别的属性名（如 `data-fx`）。UI-SPEC 的选择器清单里写了 `.fl-ex[data-lift]`、`.fc[data-lift][data-mode]`，如选 (a) 就不用改清单，但要确保 `[data-lift]` 不再出现在 `GATE_BLOCK`，并让 `[data-fl]` 承担记录区写入控件的拦截。
- 记录区写入控件统一加 `data-fl`，加进 `GATE_BLOCK`；图表控件、说明按钮、历史 `summary`、`[data-wo]` 行统一加 `data-fit-ro`，在 `GATE_ALLOW` 里写 `[data-fit-ro]`。`applyGate`（1155 行）的 `.wrap button,input,select,textarea` 选择器已覆盖健身页（在 `.wrap` 内）。
- `renderAll()`（2164 行）末尾已调用 `applyGate()`，`renderFit` 末尾也要调用（和 `renderGoals` 一致）。
- `setGate(false)`（1163 行）按 `data-gated` 恢复，不用改。

### 退出登录 / 换账号时的本机缓存清理
**Source:** 1125 行与 2043 行
```js
["state","plan","snapshot","importundo"].forEach(k=>{try{localStorage.removeItem("usj:v2:"+prevId+":"+k)}catch(err){}});
["state","plan","snapshot","importundo"].forEach(k=>{try{localStorage.removeItem(cacheKey(k))}catch(e){}});
```
两处都加 `"wodraft"`。设备偏好键 `usj:fit:range`、`usj:fit:note` 不进清单（UI-SPEC 明确不随账号清理）。`tests/cloud/logout.spec.ts` 里如果逐个核对被清的键，要加这一键（该文件没有改动的必要，除非它断言完整清单，实施时 grep `importundo`）。

### toast / 状态行 / 读屏
**Source:** `toast(m,act,ms)`（3221 行），`setStatus(t,st,btn)`（945 行，`data-state` 值：`offline`、`retrying`、`unreachable`、`slow` 等，见 `peBlock()` 2483 行的判断）。记录区提示行第 4 档（断网）的判断逻辑照抄 `peBlock()` 的后半（只判网络，不挡保存）。

### 转义与 id 进属性
所有用户文字走 `esc()`；id 写进 `data-*` 前用 id 正则校验（`LOG_ID_RE`、`LIFT_ID_RE`、新增的 `CARDIO_ID_RE`）。SEC-01 的 `tests/e2e/security/escaping.spec.ts` 会「绕过入口检查」直接把恶意 state 灌进来，所以渲染层也必须转义（不能只靠 `normalize`）。

### CSV 与 JSON 导出
**Source:** `exportCsv`（3200–3210 行）
```js
state.logs.forEach(l=>rows.push(["["+l.cat+"] "+l.text.split("\n")[0].slice(0,80),usDate(l.date),"True",l.text]));
```
训练日加一行：`["[健身] "+woSummary(w), usDate(date), "True", woSummary(w)]`，经现有 `csvCell`（3184 行，会给 `=+-@` 开头加引号）。`rows.length===1` 的空导出提示（3207 行）要把训练日算进去。JSON 导出是 `backupOf(plan,state,…)`（814 行）直接序列化 `state`，`workouts` 随 `normalize` 的返回值自动带上，不用单独改。

### 全局 CSS 的作用域写法
**Source:** `#tab-plan` 的覆盖（208、219、293 行）：`#tab-plan .seg button[…]`、`#tab-plan :is(input,textarea,.seg button,.pe-toggle){min-height:44px}`。`#tab-fit` 用同样的方式，不改全局 `.ghost`、`.primary`、`.seg button`、`.panel`。`.k-fit{--c:var(--c-fit);--s:var(--c-fit-s)}`（48 行）已有。

---

## 现有测试盘点（会坏或需要改的）

每条给出文件和 test 标题。「必改」是不改必红；「建议」是为了覆盖新行为而补。

### (a) 力量卡离开目标页（`#goals input[data-lift]`、`data-liftsave`、`#lf-*`、`.lift`、`saveLift` toast）

| 文件 | 用例 | 处理 |
|---|---|---|
| `tests/e2e/goals/lifts.spec.ts` | 整个文件 5 条：`GOAL-02 the save button appears only after the value changes and hides again for the current value`；`GOAL-02 saving with the button appends today to the history, shows the last three and saves the value`；`GOAL-02 pressing Enter saves a small value with the updated toast`；`GOAL-02 a very large value reaches the target, caps the bar at 100% and shows the reached toast`；`GOAL-02 blurring the field or entering a negative value saves nothing` | 必改：删除（D-15 去掉手填框），换成健身页上「当前值由训练记录算」的用例（FIT-03 / D-15）。文件头里的「定位器动作豁免」注释一并更新 |
| `tests/e2e/goals/overview.spec.ts` | `GOAL-01 every lift card hides its save button and shows a value, bar and history consistent with the fixture`（调用 `readLifts`） | 必改：搬到健身页，改读 `.fw-lift`；同文件 `GOAL-01 the seven goal groups…` 不受影响 |
| `tests/support/goals.ts` | `readLifts`（读 `#goals .lift`、`input[data-lift]`、`[data-liftsave]`，78–120 行）、`liftHistoryEquals`（`#lf-<id>` 的 `.hist`，111 行以后）、类型 `LiftCardRead` | 必改：保留函数名对归档卡 `.lift.arch-l[data-arch]` 的读法，或新增 `readLiftGoals`（读 `#tab-fit .fw-lift`）。`gotoGoals` 不变 |
| `tests/support/edits.ts` | `makeOneEditOfEachKind`，91–97 行：`#goals input[data-lift]` 填值回车，断言 `#goals #lf-<id>` | 必改：改成在健身页保存一次训练（键 `wo:<日期>`），断言 `#tab-fit` 的当前值或保存按钮状态。该函数被 `tests/cloud/offline-sync.spec.ts` 和 `tests/cloud/remote-update.spec.ts` 使用；文件头 7 行注释里的键列表 `lift:` 改成 `wo:`（`lift:` 键不再产生）。需要确认两个 spec 里是否按「每种键各一个」的数量断言（`touched` 数量，grep `touched`） |
| `tests/cloud/remote-update.spec.ts` | `SYNC-02 finishing an action while a remote change waits applies it first and keeps both edits (D-04)`（259–270 行，「四、保存力量值」：`#goals input[data-lift]`、回车、断言 `lastState(0).lifts[liftId].cur`） | 必改：该步骤换成在健身页保存训练（草稿「忙」→ 横幅 → 点 `#fl-save`），断言 `lastState(0).workouts[<日期>]`。同一用例里其它步骤（复盘、开始日期等）保留 |
| `tests/cloud/account-data.spec.ts` | `SYNC-01 records, a review, a task tick and a lift value saved on one device show up in all four views on another device`（87–88 行 `#lf-l-a1`、`[data-liftsave]`；124 行 `readLifts(p,['l-a1'])`） | 必改：标题的「lift value」和「four views」要改；力量值改成训练记录，另一台设备在健身页核对；「all four views」按 5 个视图 |
| `tests/cloud/plan-editor-fit.spec.ts` | `PLAN-02 the weekly fitness goal, the fitness note and a new lift edited in the plan editor are saved and shown on the goals and week views (D-15)`（107 行 `#lf-${newId}` 值 `2.5`；106 行 `readLifts`）；`PLAN-02 a loaded plan whose values break the editor rules…`（209 行 `#lf-l-pv1`） | 必改：「shown on the goals」改成健身页的 `.fw-lift`；`fitNote` 现在显示在 `#fw-note`（健身页）而不是目标页 `.note` |
| `tests/cloud/plan-archive-view.spec.ts` | `PLAN-03 archived tasks and lifts are listed read-only in the archived area and left out of the goals and week counts (D-03)`（150–151 行 `#lf-l-al2`、`#lf-l-al1`） | 必改：「未归档的照常在」改成断言健身页 `.fw-lift`；归档区只读行（`.lift.arch-l`）的断言保留 |
| `tests/cloud/plan-onboarding.spec.ts` | `PLAN-07 a new account picks one sample group and one lift from the empty plan card and they are saved with new ids and shown on the goals page (D-01, D-07, D-08)`（153 行 `#goals .lift` count 1）；`PLAN-07 a plan picked from the empty plan card on one device shows on another device of the same account (SC4)`（1009 行同） | 必改：力量项现在显示在健身页，改成 `#tab-fit .fw-lift` count 1（需要先切到健身页） |
| `tests/e2e/data/synthetic-data.spec.ts` | `DATA-01 the full fixture renders logs, task states, custom todos, lift history, the weekly review, preset tags and the arrival date`（164–167 行 `#lf-${id}` 值 `lift.cur`、`#goals .lift … .hist`） | 必改：力量值和 hist 改在健身页验证（`.fw-lift` 当前值，没有训练时回落到手填 `cur`；历史点在趋势图里是空心点） |
| `tests/e2e/security/escaping.spec.ts` | `SEC-01 with the entry checks bypassed every renderer still escapes ids, dates and values`（121 行 `#lf-bench` 的 `value` 属性 === `CUR_PAYLOAD`） | 必改：`liftCur` 这个往返断言要换成别的载体（健身页没有输入框），`CUR_PAYLOAD` 的用途要重新设计；同时 `openTab` 增加 `'fit'`，`expectClean(page,'健身')`，`maliciousState()`（`tests/fixtures/malicious-state.ts`）加入恶意的 `workouts`（键、id、数值、日期） |
| `tests/e2e/platform/clean-clone.spec.ts` | `SEC-04 a fresh start without any server shows the sample plan and no records`（68 行 `readLifts`） | 必改：只读 `.lift` 的部分跟着 `readLifts` 改 |
| `tests/e2e/data/stable-ids.spec.ts` | `PLAN-05 the sample plan keeps the frozen positional group and task ids`（36 行 `readLifts`） | 必改：同上；并补一条冻结示例有氧项 id 的断言 |
| `tests/cloud/csp.spec.ts` | 「四个视图」循环（78 行 `['wk','cal','goal','tl']`）与 `#goals i[data-w]` 检查 | 建议：循环加 `'fit'`；加 `#tab-fit` 里没有 `style` 属性的断言（含 SVG 元素）和 `i[data-w]` 经 CSSOM 赋值的断言 |

### (b) 第五个标签

| 文件 | 用例 | 处理 |
|---|---|---|
| `tests/support/strings.ts` | `TAB_LABELS = { wk, cal, goal, tl }`（15 行） | 必改：加 `fit: '健身'`。注意下面几个文件**遍历这个对象**，加了就自动覆盖第五个标签 |
| `tests/e2e/smoke.spec.ts` | 遍历 `Object.keys(TAB_LABELS)`，点每个标签并断言 `#tab-${k}` 可见、其余隐藏（61–69 行） | 无需改（加 `fit` 后自动覆盖 `#tab-fit`），但它依赖 `id` 是 `tab-fit`，与 UI-SPEC 一致 |
| `tests/cloud/plan-editor.spec.ts` | 67–68 行：`for (const k of ['wk','cal','goal','tl']) await expect(page.locator('#tab-'+k)).toBeHidden()`（编辑计划页打开时四个面板都隐藏）；125 行的 `tab` 辅助函数 | 必改：数组加 `'fit'`（否则打开编辑页后 `#tab-fit` 不隐藏会漏检） |
| `tests/cloud/csp.spec.ts` | 78 行同上数组 | 见上，建议加 `'fit'` |
| `tests/e2e/security/escaping.spec.ts` | `openTab(page,'cal'|'goal'|'tl')` 逐个（72–75 行，`TAB_LABELS[key]`） | 加一次 `openTab(page,'fit')` |
| `tests/e2e/narrow/narrow.spec.ts` | 4 条 `RESP-01 at phone width …`，没有标签栏宽度断言 | 建议：新增 `RESP-01 at 375px the five tabs fit without horizontal scroll`（`nav.tabs` 的 `scrollWidth <= clientWidth`），以及每页 3 张图（UI-SPEC 7）的用例 |
| 按位置选标签的用例 | 全部用 `getByRole('tab', {name, exact:true})`（见各 spec），没有 `nth()` / `.tabs button` 按位置选 | 无需改（已 grep 核对：没有 `toHaveCount(4)` 之类的标签计数断言） |

### (c) `PLAN_MAX.lifts` 变 20

| 文件 | 用例 | 处理 |
|---|---|---|
| `tests/e2e/data/plan-normalize.spec.ts` | 255 行：`expect(plain(PLAN_MAX)).toEqual({ groups: 20, tasks: 50, lifts: 8, … })`（在 `PLAN-02 planProblems checks lift values and weekly fitness days and ignores archived lifts (D-15, D-17)` 内，258 行起） | 必改：`lifts: 20, cardio: 20`；同文件 L258 起的用例里若构造「第 9 个力量项报 `llimit`」的数据，要改成第 21 个 |
| `tests/cloud/plan-editor-fit.spec.ts` | `PLAN-02 lift and weekly fitness values outside the rules block saving with the error next to the field, and the add button stops at 8 lifts (D-15, D-17)`（128 行；136–140 行：`ed.lifts.length` 为 8，`PE_LIMIT_LIFTS`，计数 8/8） | 必改：标题和数据改 20；合成 20 个力量项；`PE_LIMIT_LIFTS` 文案跟 `strings.ts` |
| `tests/cloud/plan-editor-archive.spec.ts` | `PLAN-03 an archived group carries its custom to-dos, a task archived on its own stays archived when the group is restored, and restore is disabled when the list is full (D-05, A10, A11)`（249 行注释、264 行 `for i=2..8` 循环补力量项、284 行 `PE_RESTORE_LIMIT_LIFTS`） | 必改：循环到 20，注释与 `PE_RESTORE_LIMIT_LIFTS` 同步 |
| `tests/cloud/plan-onboarding.spec.ts` | `PLAN-07 the picker stops at the group and lift limits and says how many more fit, archived items not counting (A7, 12 D-17)`（727 行起；731 行注释 + 735 行 `l-lm${i}` 到 `i===8` 归档）；`PLAN-07 picks that would push the plan over the cloud limit are not saved and the picker says so (D-07, 12 D-17)`（459 行起，若依赖力量项数量） | 必改：「7 个未归档 + 1 归档 → 还能加 1 个」改成「19 + 1 → 还能加 1 个」，其余断言的 `pkLimL(1)`、`PK_FULL_L` 文案同步 |
| `tests/support/strings.ts` | `PE_LIMIT_LIFTS`（573）、`PE_ERR_LIFT_LIMIT`（592）、`PE_RESTORE_LIMIT_LIFTS`（627）、`pkLimL`（736）、`PK_FULL_L`（737） | 必改：8 → 20（与应用里常量逐字一致） |

### (d) 计划加 `cardio`、state 加 `workouts`

| 文件 | 用例 | 处理 |
|---|---|---|
| `tests/e2e/io/export.spec.ts` | `IO-03 the JSON backup of the full fixture wraps the fixture without _synthetic together with the sample plan`（`expect(backup.state).toEqual(withoutSynthetic(fixture))`，约 46、56 行）；`IO-03 the JSON backup equals the latest saved document after a change`（148 行起） | **重要决策**：`normalize` 返回固定形状，如果它无条件返回 `workouts:{}`，这些深度相等比较会因多出一个空键而红，波及 `tests/fixtures/full-state.json`、`local-seed.json`、`minimal-state.json`、`legacy-*.json`。二选一并写进计划：(1) 在 `normalize` 里只在非空时输出 `workouts`（`workouts` 空对象就省略），旧用例不改；(2) 无条件输出，所有 fixture 补 `"workouts": {}`。倾向 (1)，对现有 154 条回归影响最小，但要让读 `state.workouts` 的代码都带默认值 |
| `tests/cloud/conflict-snapshot.spec.ts` | 163 行：`expect(Object.keys(file).sort()).toEqual(['arrival','custom','lifts','logs','presets','reviews','tasks'])`（留底文件的键） | 同上：方案 (1) 不改，方案 (2) 加 `'workouts'` |
| `tests/e2e/data/plan-normalize.spec.ts` | 19、138、191、333、358 行的 5 条（`normalizePlan accepts the sample plan…`、`…keeps archived on groups and lifts and accepts an empty plan`、`…accepting any finite lift start value…`、`PLAN-06 emptyPlan has no groups, lifts or base tags…`、`PLAN-07 pickSample copies only the chosen sample groups and lifts…`）；365 行 `expect(Object.keys(r).sort()).toEqual(['groups','lifts'])`（`pickSample` 返回值的键） | 必改：`pickSample` 返回 `{groups,lifts,cardio}`，365 行改键列表并扩充用例；`emptyPlan` 用例要加 `cardio` 为空；新增 `normalizePlan` 对 `cardio` 的接受 / 拒绝用例（缺省键、重复 id、`target.v<=0`、`archived` 非布尔） |
| `tests/e2e/data/backup-format.spec.ts` | `IO-08 backupCounts and importPreview count records, weeks, done tasks, strength entries and dropped progress`（53 行）；`IO-07 classifyBackup reads the agreed wrapper…`（108 行）；`IO-08 backupOf writes the agreed wrapper and classifyBackup reads it back unchanged`（172 行） | 必改：`backupCounts` 新增 `workouts` 计数后，逐字比较的对象要加键；`planCounts` 加 `cardio` 后同理；172 行「读回不变」要用带 `workouts` / `cardio` 的数据再跑一遍 |
| `tests/e2e/security/state-validation.spec.ts` | `SEC-01 the import check rejects any malformed id or date and accepts well-formed, empty and type-mismatched backups`（23 行）；`SEC-01 stored data with malformed ids, dates and values is repaired on load without losing any log text`（115 行）；`PLAN-05 backups with g-, t- and l- prefixed ids pass the import check and survive normalize`（262 行） | 必改 / 建议：补 `workouts` 的非法键 / 非法日期被 `importProblem` 拒绝；非法数值（重量 -1、次数 0 或小数、组数 21）被 `normalize` 修正；262 行补 `r-` 前缀 |
| `tests/e2e/security/id-whitelist.spec.ts` | `SEC-01 importing a backup with a malformed id or date is rejected as a whole and changes nothing`（47 行）；`SEC-01 loading stored data with malformed ids keeps every log text and saves only compliant ids`（89 行） | 建议：加带坏 `workouts` 的整体拒绝用例 |
| `tests/fixtures/malformed-imports.ts`、`tests/fixtures/malicious-state.ts` | SEC-01 夹具 | 必改：各加 `workouts` 的坏样本（恶意文字作动作 id、坏日期键、`<img onerror>` 作有氧项名称写进计划） |
| `tests/cloud/migration.spec.ts` | `IO-09 a synthetic legacy backup and seed plan composed by the migration script import into a new account with every record, review, progress and strength entry in place, and the import can be…`（35 行）；`IO-09 the migration script self-test passes and prints only counts`（139 行，跑 `migrate-backup.mjs --self-test`） | 迁移脚本通过 `COMPOSE_EXPR` 在内存里求值应用的 `normalize` / `classifyBackup`（`tools/plan/migrate-backup.mjs` 75–105 行），所以 `workouts` 自动经过白名单；要核对的是 `self-test` 里写死的计数断言（405 行 `ok.counts.groups===2 && … lifts===1`、415 行的 `state` 字段断言、`planCounts` 的比较）：如果 `planCounts` 加了 `cardio`，它们的字符串比较要加一项。旧备份没有训练数据，迁移结果不带 `workouts` 或带空对象，随上面方案 (1) / (2) 走 |
| `tests/cloud/import.spec.ts`、`tests/cloud/import-sync.spec.ts`、`tests/cloud/import-undo.spec.ts` | 约 289 行 `fitGoal:[1,3]` 的合成计划和各自的摘要确认框用例 | 建议：摘要里加「训练 N 天」（若 `importPreview` 摘要加了这一项）；撤销导入（`importundo` 缓存）要核对 `workouts` 一并被还原 |
| `tests/support/cloud-data.ts` | `syntheticPlan(label, groupCount)`（39 行起）、`syntheticState`（5 行） | 建议：`syntheticPlan` 加可选 `cardioCount`；新增 `syntheticWorkouts(label, days)`，日期在冻结周 2026-03-16 到 2026-03-22 内 |
| `tests/cloud/export.spec.ts`、`tests/e2e/io/export.spec.ts`、`tests/support/expect-from-fixture.ts` | `IO-02 the calendar CSV export matches the spec-derived expectation byte for byte`（e2e，63 行）及云端 `export.spec.ts` | CSV 加训练日行后，`expect-from-fixture.ts` 的「按规格推导」要同步（该函数从 fixture 推导期望行）；fixture 没有 `workouts` 时不变，需要新增一个带训练的 fixture 或内联数据，并加黄金行 |
| `tests/e2e/platform/csv-masking.spec.ts` | CSV 公式前缀转义 | 建议：加「训练摘要里动作名以 `=` 开头也加 `'`」 |
| `tests/e2e/week/week-view.spec.ts`（及 `tests/cloud/plan-editor-fit.spec.ts` 111 行 `weekFitGoalLine(0,3,5)`） | 周视图目标行断言 | 现有用例无训练数据，数字不变；**新增**「训练日并集」用例：同一天既有训练又有健身文字记录只算一次（D-07）、仅有文字的日子照样算 |
| `tests/e2e/timeline/timeline.spec.ts`、`tests/e2e/calendar/day-panel.spec.ts`、`tests/e2e/calendar/grid.spec.ts` | 视图断言 | 现有用例无训练数据不受影响；建议新增：时间线 `健身` 筛选含训练行、日历 chip 与日面板行、点行进入健身页（`.ent.wo[data-wo]`、`.tl-item.wo[data-wo]`） |
| `tests/e2e/platform/app-integrity.spec.ts`、`tests/support/constants.ts` | `APP_SHA256`（38 行） | 必改：每次改应用都要重新记录 |

### (e) 示例挑选加有氧栏

| 文件 | 用例 | 处理 |
|---|---|---|
| `tests/cloud/plan-onboarding.spec.ts` | 109 行 `boxes` `toHaveCount(11)`（7 个组 + 4 个力量项）；863–864 行 `legends` `toEqual([PK_SEC_GROUPS+pkCount(7), PK_SEC_LIFTS+pkCount(4)])` | 必改：复选框 11 → 14，`legends` 加第三项 `PK_SEC_CARDIO+pkCount(3)`（`strings.ts` 新增 `PK_SEC_CARDIO`） |
| `tests/support/plan-picker.ts` | `PickerState`（`checked`、`disabled`、`dup`、`limG`、`limL`）；`readPicker` 的 `lim(id)` 读 `pk-lim-g` / `pk-lim-l` | 必改：加 `limC`；`pick(page,key)` 的注释里补 `c:<示例有氧项 id>` |
| `tests/cloud/plan-onboarding.spec.ts` 其余 PLAN-07 用例 | `…marks sample groups and lifts whose names are already in the draft…`（680 行）、`…sample items added in the plan editor go to the end of the draft collapsed…`（612 行）、`…work offline, follow the sample order…`（795 行）、`PLAN-07 at 375 px the picker is a bottom sheet…`（917 行） | 建议：每条加有氧项的断言；`T_PK_PICKED` / `T_PK_DONE` 现在是三参数（`pkParts(g,l,c)`），`strings.ts` 里 `pkPicked`、`pkDone` 等镜像函数同步（为 0 的部分省略，原来的断言不变） |
| `tests/e2e/data/plan-normalize.spec.ts` | `PLAN-07 pickSample copies only the chosen sample groups and lifts in sample order with new ids and no tags (D-05, D-08)`（358 行） | 必改：见 (d) |
| `tests/support/plan-editor.ts` | 编辑页 helper（力量项的 `addlift`、字段键 `l:<id>:n` 等） | 建议：加有氧项的 helper（`addCardio`、`c:<id>:n`） |

### 新增的测试位置（建议）

- `tests/e2e/fitness/`（本地路径，默认套件）：纯函数 `seriesOf` 的单测（最大重量、Epley、总训练量、徒手判断、范围边界）、`workoutProblems` 校验、记录 / 保存 / 删除撤销、一天一条并入、翻页（4 / 3 张，`page.setViewportSize`）、`normalize` / `importProblem` 的 `workouts`、`.fc-pt[data-date][data-v]` 读属性。
- `tests/cloud/fitness-sync.spec.ts`（fake PocketBase）：离线记训练 → 联网上传、两台设备在不同日子记训练互不覆盖、同一天冲突时最后写入覆盖（和 SYNC 现有规则一致）、门控期间图表可用而记录区只读、退出清掉 `wodraft`。
- helper 放 `tests/support/fitness.ts`，参考 `tests/support/goals.ts` 的「一次 `page.evaluate` 读回布尔和数值，不把个人文字带回 Node」写法；文案镜像放 `tests/support/strings.ts`。

---

## No Analog Found

| 位置 | Role | Data Flow | 原因 |
|---|---|---|---|
| 趋势图 SVG 绘制（折线、虚线目标、柱形、读数竖线、`ResizeObserver` 重绘） | component | transform | 应用里没有任何 SVG 或图表代码，也没有 `ResizeObserver` / `matchMedia` 的使用。只能按 15-UI-SPEC S7 的几何规则新写：坐标用属性，颜色走 class，宽度读 `clientWidth` 写进 `viewBox` |
| 每页张数（`matchMedia("(max-width:560px)")`）与翻页 | component | event-driven | 现有响应式只靠 CSS 断点。`narrow.spec.ts` 用 `page.setViewportSize` 的写法可以作测试参考 |
| `pointermove` 读数 | component | event-driven | 应用里没有指针事件处理（只有 click、keydown、drag），按 UI-SPEC 新写，改 `<line>` 的 `x1 x2` 属性而不是 `style` |
| 草稿本机留底 `wodraft`（500ms 防抖写 `localStorage`） | utility | file-I/O | 最近的是 `rvT`/`rvJob`（复盘的防抖提交，grep `rvPending`）和 `usj:v2:<uid>:*` 缓存的读写函数 `cacheGet` / `cachePut`（grep 定义），可以照它们的 try/catch 与键命名，但留底内容是新的 |

## Metadata

**Analog search scope:** `us-journey-tracker.html`（全文，按函数名定位）、`tools/plan/migrate-backup.mjs`、`tests/e2e/**`、`tests/cloud/**`、`tests/support/**`、`tests/fixtures/**`
**Files scanned:** 约 60 个（按 grep 命中的 spec 和 helper 逐个定位到用例标题；没有运行任何测试）
**Pattern extraction date:** 2026-11-13
