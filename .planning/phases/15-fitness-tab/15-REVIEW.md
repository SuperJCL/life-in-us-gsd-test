---
phase: 15-fitness-tab
reviewed: 2026-11-16T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - us-journey-tracker.html
  - tests/README.md
  - tests/cloud/account-data.spec.ts
  - tests/cloud/csp.spec.ts
  - tests/cloud/fitness-log.spec.ts
  - tests/cloud/fitness-sync.spec.ts
  - tests/cloud/migration.spec.ts
  - tests/cloud/offline-sync.spec.ts
  - tests/cloud/plan-archive-view.spec.ts
  - tests/cloud/plan-editor-archive.spec.ts
  - tests/cloud/plan-editor-cardio.spec.ts
  - tests/cloud/plan-editor-fit.spec.ts
  - tests/cloud/plan-editor.spec.ts
  - tests/cloud/plan-onboarding.spec.ts
  - tests/cloud/remote-update.spec.ts
  - tests/e2e/data/backup-format.spec.ts
  - tests/e2e/data/plan-normalize.spec.ts
  - tests/e2e/data/stable-ids.spec.ts
  - tests/e2e/data/synthetic-data.spec.ts
  - tests/e2e/fitness/charts-data.spec.ts
  - tests/e2e/fitness/charts.spec.ts
  - tests/e2e/fitness/goals.spec.ts
  - tests/e2e/fitness/history.spec.ts
  - tests/e2e/fitness/log.spec.ts
  - tests/e2e/fitness/views.spec.ts
  - tests/e2e/fitness/workouts-data.spec.ts
  - tests/e2e/goals/overview.spec.ts
  - tests/e2e/io/export.spec.ts
  - tests/e2e/narrow/narrow.spec.ts
  - tests/e2e/platform/clean-clone.spec.ts
  - tests/e2e/security/escaping.spec.ts
  - tests/e2e/security/state-validation.spec.ts
  - tests/fixtures/malformed-imports.ts
  - tests/fixtures/malicious-state.ts
  - tests/support/constants.ts
  - tests/support/edits.ts
  - tests/support/fitness.ts
  - tests/support/goals.ts
  - tests/support/plan-editor.ts
  - tests/support/plan-picker.ts
  - tests/support/strings.ts
findings:
  critical: 0
  warning: 4
  info: 8
  total: 12
status: issues_found
---

# Phase 15: 代码评审报告

**评审时间：** 2026-11-16
**深度：** standard
**评审文件数：** 41
**状态：** issues_found

## 摘要

评审范围是 Phase 15 相对 `9721123` 的改动：健身标签（记录区、本周训练和力量目标、趋势图、训练历史）、`state.workouts` 和计划 `cardio` 数据模型、同步键 `wo:<日期>`、计划编辑页有氧区、示例选择器有氧栏、导入导出，以及 15-07 对 `syncOnce` 的修改。应用文件逐段读了 diff 并回到源码核对；测试只抽查了新增的健身用例和共用读回函数，没有运行任何测试。`APP_SHA256` 与当前 `us-journey-tracker.html` 的 sha256 一致。

**没有发现阻断级（BLOCKER）问题。** 新增模板里的动态文字都经过 `esc()`，数值来自 `normalize` 之后的 state；CSV 导出的训练行也走 `csvCell`；退出登录会清掉 `wodraft`。

**重点复核结论：**

1. 15-07 的 `heldSlot` 修复（`us-journey-tracker.html:1891-1895`）逐条推演了四种竞态，修复本身成立：
   - 上传期间远端更新到达：实时事件和轮询只走 `requestSync`，合并成下一轮，不改 slot；`adoptTab` 会换掉 slot，此时 `pendRemote.state !== heldSlot`，不替换，正确。
   - 上传期间第二次本机编辑：`commit` 先 `takeRemote()` 清空 slot，上传完成后同样不替换；没有 `commit` 时 slot 被换成上传的 body，之后 `docAfter()` 只在它上面重放后来的操作，正确。
   - 上传失败：`heldSlot` 在 `await` 之前取到，失败走 catch，slot 和 `ops` 都原样保留，下一轮继续基于同一 slot，正确。
   - 中途重载：内存里的 slot 和 `ops` 丢失，缓存里是 `docAfter()` 的脏数据，行为同修复前，不是回归。
   - 日志和任务的同步没有新增路径：`heldSlot` 为空（绝大多数情况）时整段不执行。
   - 但同一类问题在 `!ssv` 创建分支里没有修，见 WR-01。
2. 安全审计提到的 `renderFh` 选择器：**确认存在，但不可触发**，归为 Info，见 IN-01。

下面是 4 条警告和 8 条提示。

## Warnings

### WR-01: 15-07 的 slot 替换只修了更新分支，创建分支留着同一个丢操作的缺口

**File:** `us-journey-tracker.html:1867-1873`、`us-journey-tracker.html:1906-1910`
**Issue:** 15-07 之后，`update` 成功时会把留在 `pendRemote.state` 里的旧 slot 换成刚上传的 body（1891-1895）。但服务器上没有 state 文档时走 `!ssv` 分支：`cb=docAfter()`（建立在 slot 上）、`sentOps=ops.length`、`make("state",cb)`，成功后 `up=ssv`，然后在 1910 行 `ops.splice(0,sentOps)`，**没有**对 slot 做同样的替换。推演：第一轮 `clash && opsOk` 时 `rebaseState` 放入 slot S1，上传因 404 失败（文档被管理员删了），第二轮列表里没有 state 文档，创建成功，S1 还留在 slot 里，已上传的操作已从 `ops` 里移除。之后用户下一次 `commit` 调 `takeRemote()`，`state=docAfter()` 就是 S1 加上（此时为空的）`ops`，那些本机编辑从工作视图里消失，再下一次上传又把它们从服务器上丢掉。这正是 15-07 描述的症状，只是触发条件更窄（服务器上的文档在两轮之间被删），所以是警告而不是阻断。
**Fix:** 把替换逻辑提成一个小函数，更新分支和创建分支都用：
```js
const heldSlot=pendRemote.state;           // 在 await 之前取
const made=await make("state",cb);          // 创建分支
ssv=made.d;
if(made.made){up=ssv;if(heldSlot&&pendRemote.state===heldSlot){pendRemote.state={data:cb,updated:up.updated};gotRemote=true}}
```
并在 `tests/cloud/` 补一条用例：slot 存在时 state 文档被删，下一轮创建后本机编辑仍在。

### WR-02: 距离和重量在校验之后才四舍五入，保存的值可能变成 0

**File:** `us-journey-tracker.html:874-879`、`us-journey-tracker.html:899`
**Issue:** `workoutProblems` 用原始输入检查距离 `v<=0`（899 行），`woFromDraft` 才用 `woR2` 取两位小数（879 行）。填 `0.004` 公里：校验通过，保存的是 `d: 0`。随后的表现不一致：当前会话里训练历史显示「0 公里」（`T_FH_CARDIO` 用 `d!=null` 判断），刷新或远端合并经过 `normalize` 后，`fin(x.d)&&x.d>0` 不成立，距离被悄悄丢掉，历史行变成没有距离。力量重量同理：`0.004` 会被存成 `0`，也就是「徒手」，趋势图随之可能切到按次数的模式（`seriesOf` 的 `reps` 判断）。小数位只有两位是产品约定，但「合法输入变成另一种含义」是数据错误。
**Fix:** 校验改成对舍入后的值判断：
```js
if(!woBlank(x.d)){const v=Number(x.d);if(!isFinite(v)||woR2(v)<=0||v>WO_MAX.d)P("fc:"+k+":d","drange")}
```
重量一栏：输入不是精确的 0 但舍入后是 0 时报 `wrange`（或在文案里写明至少 0.01）。补一条 `workouts-data.spec.ts` 的边界用例。

### WR-03: 「全部」范围的有氧周柱图按最早日期逐周生成，日期很早的导入数据会拖垮页面

**File:** `us-journey-tracker.html:973-989`、`us-journey-tracker.html:3138-3158`、`us-journey-tracker.html:3048`
**Issue:** `cardioWeeks(s,"all",t)` 从最早一条有氧记录所在的周一一周一周补到本周，没有上限。`realDate` 只要求格式和日历日期合法，`0100-01-01` 这样的键能通过 `importProblem` 和 `normalize`。一份带这种日期的导入文件会让「全部」范围生成十万级的槽位：`fcDrawCd` 写出同样数量的 `<rect>`，`fcCdHTML` 写出同样数量的表格行，而且每次 `renderAll` 都重画，`fcCd()` 每次渲染还会再调用 `cardioWeeks` 两次。时间范围保存在 `localStorage`（`FC_KEY`），所以选过「全部」后重新打开页面仍然卡住，用户很难自己恢复。触发条件是数据异常，但这是有恢复成本的整页冻结。
**Fix:** 二选一：（a）`cardioWeeks` 里把起点钳到最近 N 周（例如 520 周），超出的合并或忽略；（b）在 `normalize` 和 `importProblem` 里限制训练日期的合理范围（例如不早于 2000-01-01）。同时让 `fcCd()` 只算一次、传给 `fcCdHTML` 和 `fcDrawCd`。

### WR-04: 门控期间从本周页跳到别的日子，记录区会被重画成可编辑的控件

**File:** `us-journey-tracker.html:2886-2899`（`flSwitch`、`goWo`）、`us-journey-tracker.html:1490-1495`（`applyGate`）
**Issue:** 启动对账或连不上服务器时 `body[data-gate]` 为真，记录区控件应当是真 `disabled`（`tests/cloud/fitness-log.spec.ts:171-185` 在测）。`GATE_ALLOW` 放行 `[data-wo]`，所以门控期间点本周页的训练行会走 `goWo`：`showTab("fit")`（它调 `renderFit` 并在末尾 `applyGate`），随后 `flSwitch(date)` 在日期不同时执行 `flOpen(date);renderFl()`。`renderFl` 自己不调 `applyGate`，于是新画出来的输入框和按钮是可用的。`gateGuard`（1508-1514）会吞掉 `[data-fl]` 的 click、input、change，数据不会被写进去，但界面上输入框看起来能编辑、输入的字符又不进草稿，保存按钮点了没反应，是个让人困惑的半可用状态。现有用例点的是今天的那一行，`date===fl.date` 时 `flSwitch` 提前返回，没有覆盖这条路径。
**Fix:** 在 `renderFl` 末尾（或 `flSwitch` 重画之后）调用 `applyGate()`；`renderFh`、`renderFc` 被点击处理函数直接调用时同理。补一条用例：门控期间点另一天的训练行，断言 `#fl-save` 和 `#fl [data-fl-add]` 仍是 `disabled`。

## Info

### IN-01: `renderFh` 用原始 `dataset.fh` 拼选择器（审计提到的问题：确认存在，不可触发）

**File:** `us-journey-tracker.html:2843`、`us-journey-tracker.html:2873`（`fhDelete` 里的 `sum`）
**Issue:** `renderFh` 用 `'.fh-item[data-fh="'+a.parentNode.dataset.fh+'"]>summary'` 恢复焦点，`fhDelete` 的 `sum` 也是同样拼法，都没有像 `fcFocusKey`（3085 行）那样用 `CSS.escape`。写法不一致是真的；但我追了所有写入 `state.workouts` 的路径：载入、导入、远端合并（`takeRemote`、`docAfter`、`normUnder`）、另一个标签页的缓存（`adoptTab`）都经过 `normalize`，它只保留 `realDate` 的键（1083-1100 行）；本机写入的日期来自 `fl.date`，只由 `realDate` 校验过的值设置。所以 `data-fh` 恒为 `YYYY-MM-DD`，选择器不会抛异常。如果将来有路径绕过 `normalize`，`querySelector` 抛 `SyntaxError` 会让整个 `renderAll` 中断，所以值得顺手统一。
**Fix:** 两处都改成 `'.fh-item[data-fh="'+CSS.escape(d)+'"]>summary'`。

### IN-02: 同一动作块的错误段落和某一组的错误段落可能 id 相同

**File:** `us-journey-tracker.html:2768-2769`
**Issue:** 每组的错误段落 id 是 `fl-e-${id}-${j}`，整个动作块的错误段落 id 是 `fl-e-${id}`。力量项 id 允许 `l-[A-Za-z0-9_-]{1,40}`，所以 `l-a`（第 0 组）和 `l-a-0` 的块级错误会得到同一个 id `fl-e-l-a-0`。计划编辑页生成的 id 是 `l-`+`uid()`（没有连字符），正常使用碰不到，只有手工构造或导入的计划才会撞。撞了之后 `flErrs` 的 `$()` 取到第一个元素，错误显示在错误的位置，`aria-describedby` 也指错。
**Fix:** 块级错误段落改用不同前缀，例如 `fl-ex-e-${id}`，同步改 `flErrs` 里的 `$("fl-e-"+id)` 和 `tests/support/fitness.ts` 的 `flError`（它读 `fl-e-<id>-<j>`，不受影响）。

### IN-03: `normalize` 先登记 id 再校验内容，同 id 的第二条合格记录会被连带丢掉

**File:** `us-journey-tracker.html:1089`、`us-journey-tracker.html:1095`
**Issue:** 力量动作在 `ls0.add(x.id)` 之后才检查 `sets`，有氧项在 `cs0.add(x.id)` 之后才检查 `m`。同一天里同 id 出现两次、第一条不合格（组全被过滤、时长不是整数）时，第二条合格的也被当作重复丢掉。注释说「只留第一条」，行为符合注释，但丢的是合格数据而保留的是不合格的，且不合格的那条自己也被丢，结果一条都没留。只发生在已经损坏的数据上。
**Fix:** 把 `ls0.add` / `cs0.add` 挪到条目通过校验、真正 push 之前。

### IN-04: `fcGo` 里的局部常量 `me` 遮住了全局的用户 id `me`

**File:** `us-journey-tracker.html:3093`
**Issue:** `const me=$(d<0?"fcPrev":"fcNext")` 在函数内遮住了模块里表示当前用户的 `me`（`CLOUD&&me` 到处在用）。现在函数里没有用到全局 `me`，不是 bug，但以后在这个函数里加一行 `CLOUD&&me` 就会拿到按钮元素，永远为真。
**Fix:** 改名为 `self` 或 `btn`。

### IN-05: 训练历史里重画后，焦点在展开内容里的按钮上会丢失

**File:** `us-journey-tracker.html:2843`、`us-journey-tracker.html:2858`
**Issue:** `renderFh` 只为 `#fhMore` 和 `summary` 保存并恢复焦点；焦点在展开后的「修改这次训练」或「删除这次训练」按钮上时（键盘用户），远端同步触发的 `renderAll` 会重写 `#fh` 的 `innerHTML`，焦点落到 `body`。
**Fix:** 在 `fk` 的计算里再加两种：`[data-wo]` 和 `[data-fhdel]` 按钮，用 `.fh-item[data-fh="…"] [data-wo]` 之类的选择器恢复（配合 IN-01 用 `CSS.escape`）。

### IN-06: `log.spec.ts` 用真实的 700 ms 等待和一条几乎不会失败的断言来确认「没有保存」

**File:** `tests/e2e/fitness/log.spec.ts:166-168`
**Issue:** `await page.waitForTimeout(700)` 等保存防抖（600 ms），随后断言 `unsaved === null || JSON.stringify(savedWorkouts(unsaved)) === JSON.stringify(seed.workouts)`。固定等待在慢机器上可能不够一个周期，断言又允许 `null`（什么都没存），所以即使保存被错误地触发在时钟之外也不容易暴露。同一目录里其他用例大多用手动时钟。
**Fix:** 改用 `clockMode: 'manual'`，`page.clock.runFor(1_000)` 之后再断言；`null` 的分支去掉，用 `seed` 里应有的 `workouts` 做严格相等。

### IN-07: 导入摘要的「计划」一行不统计有氧项

**File:** `us-journey-tracker.html:1142`、`us-journey-tracker.html:1987`
**Issue:** `planCounts` 只返回目标组、任务、力量项，`T_IMP_PLAN` 也只写这三项。带有氧项的备份导入时，确认框里看不到会替换多少个有氧项，而训练天数那一行（`T_IMP_WO`）是 Phase 15 新加的，两者不对称。
**Fix:** `planCounts` 增加 `cardio:planCardio(p).length`，`T_IMP_PLAN` 在大于 0 时多写「有氧项 n 个」，同步更新 `tests/support/strings.ts` 的 `importPlanLine` 和相关用例。

### IN-08: 草稿里的动作被远端计划更新删掉后，仍可保存成孤儿记录

**File:** `us-journey-tracker.html:2901-2915`（`flSave`）、`us-journey-tracker.html:2666-2681`（`flRestore`）
**Issue:** `flSave` 和 `flRestore` 都只用 `LIFT_ID_RE` / `CARDIO_ID_RE` 检查 id，不检查它是否还在当前计划里。草稿开着的时候，另一台设备永久删除了这个力量项，本机草稿保存后会写入指向不存在项目的训练，之后一直显示为「已删除的力量项」，界面上没有办法清理。本机留底恢复也一样。
**Fix:** `flSave` 之前用 `plan.lifts` 和 `planCardio(plan)` 过滤掉不在计划里的条目（归档的仍保留），或者在保存前提示并剔除。

---

_评审时间：2026-11-16_
_评审者：Claude (gsd-code-reviewer)_
_深度：standard_
