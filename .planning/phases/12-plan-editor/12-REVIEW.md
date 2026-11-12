---
phase: 12-plan-editor
reviewed: 2026-11-12T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - us-journey-tracker.html
  - tests/KNOWN-BUGS.md
  - tests/README.md
  - tests/cloud/account-data.spec.ts
  - tests/cloud/import-undo.spec.ts
  - tests/cloud/import.spec.ts
  - tests/cloud/plan-archive-view.spec.ts
  - tests/cloud/plan-editor-archive.spec.ts
  - tests/cloud/plan-editor-fit.spec.ts
  - tests/cloud/plan-editor-groups.spec.ts
  - tests/cloud/plan-editor-sync.spec.ts
  - tests/cloud/plan-editor.spec.ts
  - tests/e2e/data/backup-format.spec.ts
  - tests/e2e/data/plan-normalize.spec.ts
  - tests/e2e/goals/plan-entry.spec.ts
  - tests/e2e/security/escaping.spec.ts
  - tests/support/confirm.ts
  - tests/support/constants.ts
  - tests/support/goals.ts
  - tests/support/plan-editor.ts
  - tests/support/strings.ts
  - tools/plan/migrate-backup.mjs
findings:
  critical: 2
  warning: 2
  info: 3
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-11-12
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

本次审查以 `git diff 1cc442d..HEAD` 里应用的改动为主线（`normalizePlan` 放宽、归档派生数据、目标页「已归档」区、`#plan` 路由、编辑页草稿、`savePlanDraft`、`confirmBox` 的三选一扩展），并对照 12-CONTEXT.md 的 D-01 到 D-17，避免把已决定的行为当成缺陷。测试和迁移脚本的改动主要是跟随应用改动，只做了可靠性检查。

整体判断：草稿隔离、转义（`esc()`、id 正则）、离开确认、会话令牌（`live()`）和 D-07/D-08 的主流程写得扎实，没有发现注入类问题。发现 2 个会影响数据的问题：一个是 12-SECURITY.md 的 S-1（已确认属实），另一个是编辑页开着时「恢复」（导入）可以绕过 D-07 的冲突判断，保存草稿时静默覆盖导入的计划并删掉对应进度。另有 2 个行为缺口和 3 个小问题。

没有提供 `<structural_findings>`，所以没有「结构性发现」一节。没有收到外部审查证据。

## Critical Issues

### CR-01: 计划读不出来时选「用我的覆盖」，原始的读不出来的计划没有留底，提示却说已留底（12-SECURITY.md S-1，已确认）

**File:** `us-journey-tracker.html:2843-2850`（触发点），`us-journey-tracker.html:1239-1252`（`keepConflict`），`us-journey-tracker.html:2868-2869`（提示）

**Issue:** 触发路径：打开编辑页时账号计划读得出来；编辑期间另一台设备写入了一份 `normalizePlan` 拒绝的计划（`takeRemote` 之后 `keepOrphans` 为真，`plan` 变成示例计划）；保存时用户在 D-07 对话框选「用我的覆盖」。

`savePlanDraft` 先走 `if(keepOrphans)` 分支，`keepConflict("plan",{data:pc.data})` 把服务器上读不出来的那一份存成本机留底（`told:false`），并置 `unread=true`。紧接着走 `if(overwrite)kept=keepConflict("plan",{data:JSON.parse(JSON.stringify(plan))})`，此时 `plan` 是示例计划。`keepConflict` 里只有「未告知且类型不同」才会合并，同类型（都是 `plan`）则直接覆盖：第二次调用把第一次写的留底整个替换成了示例计划。用户最后收到的 toast 是 `T_PE_SAVED_UNREAD`（「原来读不出来的那一份已在本机留底」），下载到的却是示例计划。服务器上被覆盖的原版没有任何副本，这正是留底机制要防的数据丢失，而且提示是假话。

**Fix:** 读不出来的计划已经留过底时，不要再做覆盖分支的留底（两者要保存的是同一份服务器数据，后一份只会是示例计划）：

```js
let kept=null;
if(overwrite&&!unread)kept=keepConflict("plan",{data:JSON.parse(JSON.stringify(plan))});
```

最后的 toast 分支保持 `if(unread)…else if(overwrite&&kept)…`，`unread` 为真时优先说「读不出来的那一份已留底」是准确的。另外建议补一条用例：打开时可读、编辑期间远端换成读不出来的计划、保存时选覆盖，断言留底下载出来是服务器原来那份数据而不是示例计划（现有 `tests/cloud/plan-editor.spec.ts:343` 只覆盖了「打开时就读不出来」的路径）。

### CR-02: 编辑页开着时「恢复」（导入）或「撤销导入」会绕过 D-07 冲突判断，保存草稿时静默覆盖导入的计划并删掉对应进度

**File:** `us-journey-tracker.html:2291`（`peChanged`），`us-journey-tracker.html:1604-1612`（`cloudImport`），`us-journey-tracker.html:1628-1652`（`applyImport`），`us-journey-tracker.html:1659`（`undoImport`），工具栏按钮在 `us-journey-tracker.html:424-431`

**Issue:** 「恢复」「撤销导入」「备份」等按钮在 `nav.tabs` 的工具栏里，编辑页打开时仍然可见可点；`cloudImport`、`undoImport` 只检查 `me` 和门控，不看 `pe`。`applyImport` 会 `usePlan(pv.plan)`、`docs.plan.dirty=true`、`seq++`，但不动 `docs.plan.base`（`base` 只在服务器上传成功或远端并入时前移）。而 D-07 的判断 `peChanged()` 要求 `docs.plan.base!==pe.base` 且内容不同，所以导入之后到第一次上传成功之前，`peChanged()` 为假。

后果：用户在编辑页里改了一半，点「恢复」导入一份备份（计划换成了文件里的），再点「保存计划」。不会弹三选一，也不会留底：草稿（基于导入前的旧计划）直接 `usePlan(np)`，并且 `outT/outC/outL` 按「导入的计划」和草稿的差集计算，导入文件里带来的任务进度、自定义待办、力量历史全部被 `commit` 删掉。导入前的数据有 importundo 副本，但导入文件本身的内容没有任何副本。（编辑页开着时，导出按钮里的 `applyView()` 也会立刻并入挂起的远端更新，和横幅里「保存或放弃后会自动更新」的说法相反；这种情况 `base` 会前移，D-07 保存时能兜住，但提示行要等下一次 `syncOnce` 才出现。）

**Fix:** 两处一起改：

1. `peChanged` 去掉对 `base` 的依赖，只看内容。pe 在保存时就关闭了，不存在「本机上一次保存的回声」，内容比较已经足够排除假阳性：

```js
function peChanged(){return !!pe&&canon(peNow())!==pe.orig}
```

2. 编辑页开着时不让导入和撤销导入悄悄进行（弹 toast「先保存或放弃计划修改」），或者至少在 `applyImport`、`undoImport`、`applyView` 并入后调用 `if(pe)peRemote()`，让提示行马上出现。补一条用例：编辑页里改动后导入含计划的文件，保存应弹出三选一并留底。

## Warnings

### WR-01: 预设标签的校验错误不会展开所在的折叠卡，保存时焦点落空

**File:** `us-journey-tracker.html:2384-2390`（`peCardOf`），`us-journey-tracker.html:2803-2807`（保存时展开和聚焦），`us-journey-tracker.html:2309-2310`（打开时已有问题）

**Issue:** `peCardOf` 对 `g:`、`t:`、`l:` 键返回所在卡片，对 `p:<类别键>:<下标>`（标签）直接返回 `null`。于是点「保存计划」时，含错误的预设类别卡如果是折叠的，`pe.open` 不会加入它，`peFocus(peFid(...))` 对 `[hidden]` 里的输入框调用 `focus()` 不起作用，焦点留在保存按钮上。用户只能从提示行的「有 N 处需要修改，已标在对应位置」和卡头的「有 n 处要改」自己猜在哪里。打开时就带着重复标签的计划（服务器或导入进来的计划，`normalizePlan` 不拒绝）也一样不会展开。`tests/cloud/plan-editor-fit.spec.ts:380-395` 的用例在卡展开的状态下保存，没有覆盖折叠情形。

**Fix:** 让 `peCardOf` 也认标签键：

```js
if(p[0]==="p")return "p:"+p[1];
```

（预设卡的 `data-key` 就是 `"p:"+C.k`，与 `pe.open` 里的键一致。）并补一条折叠后再保存的用例。

### WR-02: D-17 的数量和长度上限只靠按钮禁用和 `maxlength`，保存时不检查，超限的现有计划可以原样保存

**File:** `us-journey-tracker.html:792-824`（`PLAN_MAX`、`planProblems`），`us-journey-tracker.html:2442-2459`（`peAddGroup`、`peAddTask`、`peAddLift` 不判断上限）

**Issue:** D-17 写明「空名称或超出上限时不能保存」。`planProblems` 只检查空名称、数值范围和标签，不检查组数 ≤ 20、每组任务 ≤ 50、力量项 ≤ 8、标签 ≤ 20，也不检查名称、任务文字的长度。`normalizePlan` 对这些都不设限，所以通过导入、迁移脚本或其他入口进来的超限计划（比如 25 个目标组、超长任务文字）在编辑页里计数显示 25/20、添加按钮禁用，但「保存计划」照样成功；预填的超长值不会被 `maxlength` 截断也不会报错。名称和任务文字保存时也不做 trim，`"  学英语 "` 原样存下（只有判空用了 trim）。12-SECURITY.md 的 S-3 记录了函数内不判断上限这一点，但保存关口缺失是更实质的缺口。

**Fix:** 在 `planProblems` 里补上数量和长度检查（新增 `code`，在 `PE_ERR` 里加对应文案，键用该分区的标题字段或添加按钮），例如：

```js
const act=p.groups.filter(g=>!g.archived);
if(act.length>PLAN_MAX.groups)out.push({key:"g:"+act[PLAN_MAX.groups].id+":name",code:"glimit"});
// 同理：每组未归档任务数、力量项数、标签数、各字段 String(x).length>PLAN_MAX.*
```

保存时 `np` 对名称和文字 `trim()` 一次，或者在 D-17 里明确不 trim 并在 `PE_ERR` 之外说明。

## Info

### IN-01: 清空组备注会让「没有任何修改」的草稿被判为有修改

**File:** `us-journey-tracker.html:2714-2716`，`us-journey-tracker.html:2285`（`planDirty`）

**Issue:** 输入处理里 `if(e.target.value==="")delete g.note;else g.note=e.target.value;`。计划里本来存的是 `note:""`（`normalizePlan` 保留 `g.note!==undefined` 的空串）时，用户在备注框里输入再删光，草稿的 `note` 键被删掉，`canon(pe.draft)!==pe.orig` 为真：「有没保存的修改」亮起，离开时还会弹确认，但屏幕上看不出任何变化。

**Fix:** 空串时按原来有没有 `note` 键处理，或在 `planDirty` 比较前统一把空 `note` 去掉（`canon` 之前对两边做同一种规整）。

### IN-02: 保存或放弃后用 `replaceState` 去掉 `#plan`，留下一条重复的历史记录

**File:** `us-journey-tracker.html:2298-2302`（`goPlan` 的 `pushState`），`us-journey-tracker.html:2321`（`closePlanEditor` 的 `replaceState`）

**Issue:** 进入时 `pushState("#plan")` 新增一条历史记录，离开时把这条记录改写成不带 hash 的同一地址。历史栈变成 `[/, /]`，用户保存后按浏览器返回键，地址不变、没有 `hashchange`，页面毫无反应，要按第二次才真正离开。手机上返回键是常用操作。

**Fix:** 应用内离开（保存、放弃、切换标签）时若 `history.state` 是进入时自己 push 的那一条，调用 `history.back()` 回退（`hashchange` 处理里已有 `pe` 为空时直接返回的保护），而不是 `replaceState`。

### IN-03: `readArchived` 把没有历史的力量项的备注当成一条历史

**File:** `tests/support/goals.ts:231-238`（`liftHistCounts`），对应应用 `us-journey-tracker.html` 的 `archivedHTML` 里 `<div class="hist">${h||esc(L.note)}</div>`

**Issue:** 归档力量项没有历史记录时，应用把备注文字放进同一个 `.hist` 元素。helper 用 `text.split('，').length` 计数，备注里含全角逗号（示例计划的力量项备注都含「，」）时，0 条历史会读成 2 条。现有用例使用的合成计划备注不含「，」所以没有失败，但换成含逗号的备注就会得到错误的计数而不报警。

**Fix:** 应用里让历史和备注用不同元素（例如备注用 `.note`），helper 只读 `.hist`；或者 helper 只在有 `data-hist` 计数属性时取值。

---

_Reviewed: 2026-11-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
