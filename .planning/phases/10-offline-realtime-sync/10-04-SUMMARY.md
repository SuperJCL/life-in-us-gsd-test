---
phase: 10-offline-realtime-sync
plan: 04
subsystem: sync
tags: [commit-ops, pending-count, idempotent-runs, opsOk, sentOps, playwright, fake-pocketbase]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-01 的 persist(...keys)/touched/syncOnce；10-03 的离线启动、后台对账表、cfShown"
provides:
  - "commit(keys, fn)：改 state 的唯一入口，fn 立即在当前 state 上执行，云端路径把 {keys, fn} 记入顶层 ops 再以键调用 persist"
  - "条目键：log:<id>、task:<id>、review:<周一>、lift:<id>、custom:<id>、preset:<类别>|<标签>、arrival、import"
  - "sentOps：每条上传路径在构造上传数据的同一段同步代码里记下 ops.length，成功后只移除这一段前缀，touched 改为剩余操作的键"
  - "opsOk：任何一步的 offline 失败置假，上传成功置真，打开后取 !dirty，resetSession 置真"
  - "tests/support/edits.ts：makeOneEditOfEachKind(page, label)，供 10-07 的重放用例复用"
affects: [10-05, 10-06, 10-07, 10-08, 10-09]

actuals:
  tokens: 22000
  tasks: 2
  commits: 2
plan_head_before: ca3c85744eaa457e67e62fc4d477dc1dad00c431
plan_head_after: 33e238c52728bb822fdeb101d5da58846d44951f

tech-stack:
  added: []
  patterns:
    - "每个改 state 的处理函数取好值后调用 commit(keys, fn)；fn 只改传入的 state，按 id 或键定位，写绝对值，不读 DOM、不调用 persist、渲染或 toast"
    - "上传成功只移除已上传的前缀，上传途中才做的操作留在 ops 里并单独计数"
    - "opsOk 的规则只写在 syncOnce 统一 catch 的 offline 分支里，不写在上传那一步"

key-files:
  created:
    - tests/support/edits.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/offline-sync.spec.ts

key-decisions:
  - "commit 的第二个参数在应用里命名为 fn：顶层已有变量 run（对账运行），用 fn 避免遮蔽；预设添加处理里原有的局部 const commit 改名为 finish，让顶层 commit 可见"
  - "把 pstate(cat) 拆成 pstateOf(s, cat) 加一行包装，让预设的 run 读传入的 state 而不是全局 state"
  - "预设删除撤销只恢复这一个标签：原来在 add 里就按原下标（不超过长度）插回，因删除被加进 hide 的就从 hide 去掉，不再整体还原类别快照"
  - "完成任务弹窗的“保存”在日期为空时不再调用 persist（旧路径那次零改动保存没有可见效果），避免云端给一个没有改动的操作计数"

requirements-completed: [SYNC-03, SYNC-02]

coverage:
  - id: D1
    description: "上传途中又记的一笔在第一笔上传成功后单独计数：状态 statusOffline(1)，缓存 touched 恰好是第二笔的 log: 键，服务器有第一笔没有第二笔，联网后两笔各恰好一条、touched 清空"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 an edit made while an upload is in flight stays pending alone after that upload succeeds"
        status: pass
    human_judgment: false
  - id: D2
    description: "七类条目各改一次（复盘、记录 A 改文字、记录 B 删除再撤销、任务勾选再取消、力量值、自定义待办、预设标签、开始日期）离线时状态 statusOffline(8)、touched 恰好 8 个键且七类前缀都出现；联网后全部上传、数量归零、任务回到未完成"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 the pending count counts each changed item once"
        status: pass
    human_judgment: false
  - id: D3
    description: "已上传的操作离开 ops、run 全部幂等并按 id 或键定位（SYNC-02 前提）：重放本身由 10-07 的用例证明"
    requirement: "SYNC-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 an edit made while an upload is in flight stays pending alone after that upload succeeds"
        status: pass
    human_judgment: true
    rationale: "本计划只证明已上传的前缀离开 ops；run 的幂等性靠写法和 10-07 的重放用例（两次执行、已含修改的 state 上执行）才能完整证明，这里按代码审阅"
  - id: D4
    description: "旧路径不变：完整默认 npm test 176 条全部通过，含 SAFE-02；app-integrity、storage、smoke 22 条通过"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "npm test（默认配置，workers=1，BELOW_NORMAL）：REPORT OK expected=176 flaky=0 unexpected=0"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 04: commit(keys, run) 与条目去重计数 Summary

**每个改 state 的处理函数都改走 commit(keys, fn)：键进 touched 做按条目去重的待上传数量，幂等的 fn 进 ops 作为 D-04 重做的基础；上传成功只移除这次上传带走的前缀，所以上传途中又做的一笔单独计数。**

## Performance

- **Duration:** 约 14 min
- **Started:** 2026-11-10T07:44Z
- **Completed:** 2026-11-10T07:58Z
- **Tasks:** 2
- **Files modified:** 4（应用 1、支撑文件 2、cloud 用例 1，其中 edits.ts 新建）

## Accomplishments

### commit(keys, fn) 与 ops / opsOk / sentOps

```
let ops=[],opsOk=true;
function commit(keys,fn){fn(state);if(CLOUD&&me&&docs.state)ops.push({keys,fn});persist(...keys)}
```

- **旧路径：** CLOUD 为假时 commit 只执行 fn 再 persist，键被忽略，可见行为不变。
- **sentOps 的位置（两条上传路径，都在构造上传数据的同一段同步代码里）：**
  1. 创建路径：`sizeCheck(state); sentOps=ops.length; make("state", JSON.parse(JSON.stringify(state)))`。
  2. 更新路径：`const body=JSON.parse(JSON.stringify(state)); sentOps=ops.length;`（紧接在构造 body 之后，早于 keepConflict 和 coll.update）。
  创建时撞唯一索引（made 为假）后走更新路径会再记一次。10-07 的“重做后上传”将沿用同样的写法。
- **上传成功收尾：** `ops.splice(0,sentOps); opsOk=true; docs.state.touched=[...new Set(ops.flatMap(o=>o.keys))]`，然后照旧“seq 没变才清 dirty”，再写缓存。上传失败时 ops 不动。
- **opsOk：** syncOnce 统一 catch 里 `net==="offline"` 时置假，不论失败在 authRefresh、列表、创建还是上传；retrying 不改；enterApp 和 reconcileOnce 的 settle 之后取 `!docs.state.dirty` 并重置 ops；resetSession 清空 ops 并置真。

### commit 改写过的调用点（键和 run 的幂等写法）

| 调用点 | 键 | run 的幂等写法 |
|---|---|---|
| `addLog`（含预设一点即记） | `log:<id>` | id 先生成；`logs` 里已有这个 id 就不加入，加入的是记录的拷贝 |
| `deleteLog` | `log:<id>` | `logs=logs.filter(l=>l.id!==id)` |
| 删除的撤销 | `log:<id>` | id 不在才按 `Math.min(i, logs.length)` 插回操作发生时保存的拷贝 |
| 编辑弹窗保存 | `log:<id>` | 点击时取好文字、类别、日期，run 按 id 找到记录写入这三个值，找不到不做事 |
| 编辑弹窗删除 | `log:<id>` | 走 deleteLog |
| 拖拽 drop | `log:<id>` | 目标日期在 drop 时取好，按 id 改日期 |
| 目标页勾选 | `task:<id>` | 勾选值取 `e.target.checked`、当天日期在 change 时取好，写 `{...tasks[id], done:值, doneDate:值?当天:""}`，不取反 |
| 目标页截止日期 | `task:<id>` | 写入取好的值，合并 `tasks[id]` 当前值 |
| 完成任务弹窗“标记为未完成”、“保存” | `task:<id>` | 写 done 为假、doneDate 为空；有日期时写入该日期；都合并传入 state 的 `tasks[id]` |
| 每周复盘（800ms 防抖到期） | `review:<周一>` | 文字和周在输入时取好；有文字就写入，空白就 delete 这一周 |
| `saveLift` | `lift:<id>` | 数值和当天日期在保存时取好；基于传入 state 的这一项写 cur，hist 最后一条是当天就替换、否则追加，保留最近 30 条；校验失败和数值未变的早退路径不 commit |
| `addTask` | `custom:<id>` | id 先生成；`custom` 里已有这个 id 就不重复加 |
| 删除自定义待办 | `custom:<id>` | 按 id 过滤并 `delete tasks[id]`，只计 1 项 |
| 预设删除 | `preset:<类别>\|<标签>` | 确保不在 add 里；内置标签确保在 hide 里且不重复 |
| 预设删除的撤销 | `preset:<类别>\|<标签>` | 原来在 add 里就按原下标插回（已有则不动）；因删除加进 hide 的就从 hide 去掉；只动这一个标签 |
| 预设添加 | `preset:<类别>\|<标签>` | 在 hide 里就从 hide 去掉，否则确保在 add 里且不重复 |
| 开始日期 | `arrival` | 写入取好的值 |
| 导入（云端隐藏） | `import` | 直接以键调用 persist，不走 commit |

改写后应用里没有零参数的 persist 调用（`persist()` 在 HEAD 有 19 处，现在 0 处）；`commit([` 共 17 处。每个处理函数原有的 toast、渲染调用顺序和文字不变。

### 用例与共用操作序列

- `tests/support/edits.ts`（新）：`makeOneEditOfEachKind(page, label)`，顺序固定：复盘 + `runFor(800)`，之后在时钟暂停时做记录 A（并在弹窗里改文字）、记录 B（弹窗删除后用 toast 撤销）、目标页首个任务勾选再取消、首个力量项保存新值、首个组加自定义待办、本周 composer 加预设标签、改开始日期；返回用到的文字、id 和键信息。文件头注释写明只用合成文字、调用方须使用 manual 时钟。
- `SYNC-03 an edit made while an upload is in flight stays pending alone after that upload succeeds`（Task 1）。
- `SYNC-03 the pending count counts each changed item once`（Task 2）：八个键、七类前缀、联网后全部上传、任务回到未完成、数量归零。

### 验证结果

| 验证 | 结果 |
|---|---|
| Task 1：test:cloud offline-sync + multi-device | REPORT OK expected=13 flaky=0 unexpected=0（含三个指定标题） |
| Task 1：默认配置 app-integrity、storage、smoke | REPORT OK expected=22（含 SAFE-02） |
| Task 2：test:cloud offline-sync + account-data | REPORT OK expected=16 flaky=0 unexpected=0（含三个指定标题） |
| Task 2：完整默认 `npm test` | REPORT OK expected=176 flaky=0 unexpected=0，含 SAFE-02，`--min-expected 176` 通过 |
| 两次暂存后隐私检查 | 都打印“隐私检查通过” |

## Task Commits

1. **Task 1（tracer）：commit(keys, run)、ops、记录类处理函数、sentOps** - `702f205` (feat)
2. **Task 2：其余处理函数改走 commit、七类条目去重计数、edits.ts** - `33e238c` (feat)

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## TDD 记录（Task 2，tdd="true"）

- **RED：** 计划约束“每个任务一次提交”，没有单独的 test 提交。两个目标用例都先于应用改动写出并在旧应用上运行：Task 1 的用例失败在 `toHaveText(statusOffline(1))`，期望 1 项、实际 2 项（上传成功后第一笔的键没有离开 touched）；Task 2 的用例失败在 `toHaveText(statusOffline(8))`，期望 8 项、实际 2 项（只有记录类写了键）。两处都是目标用例上的计划断言，不是语法、夹具或零用例问题（语义评估）。因为没有产出独立的 RED 记录文件，未运行 `gsd_run check tdd-red-evidence`。
- **GREEN：** 同一提交，目标用例通过，完整默认套件 176 条通过。**REFACTOR：** `pstate` 拆成 `pstateOf` 加包装、预设添加里的局部 `commit` 改名为 `finish`，都在提交内。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

None - 计划按原样执行。

### 计划之外的小处理（非偏差，已在提交里）

- **局部 commit 改名：** 预设添加处理里本来就有 `const commit=()=>{...}`，会遮蔽顶层 commit，改名为 `finish`（含三处调用）。
- **参数名：** 应用里 commit 的第二个参数叫 `fn`，避免遮蔽顶层的 `run`；验收的 `function commit(` 和 `commit([` 模式不受影响。
- **完成任务弹窗保存且日期为空：** 旧代码仍会调用一次无改动的 persist；现在不 commit，云端不会为一个没有改动的操作计数。完整默认套件 176 条结果不变。

**Total deviations:** 0
**Impact on plan:** 无。

## Issues Encountered

- 用 `-g "<标题>"` 经 `node -e` 的 spawnSync（shell:true）传参时引号丢失，过滤变成多个无关的文件过滤词，实际跑了整套 cloud 用例（RED 那一次 82 条，1 条失败）；之后的验证都用计划里写的命令，没有影响结果。
- spec 文件在工作区是 CRLF，追加用例时按 CRLF 写入。

## Known Stubs

无。

## Threat Flags

无。本计划没有新增网络端点或认证路径；T-10-10（commit 重构改变旧路径行为）由完整默认套件 176 条通过加按 id 定位的 run 承担，T-10-27（重做时再次执行已上传的操作）的第一层机制（上传成功只移除已上传的前缀）由 Task 1 的用例证明，第二层（run 幂等）由写法保证，重放用例在 10-07。

## User Setup Required

无——不需要任何外部服务配置。

## Next Phase Readiness

- 10-05：authRefresh 401 的启动过期处理改为继续可记；本计划的 ops 与 opsOk 对它没有影响。
- 10-06、10-07：`ops`（每项 `{keys, fn}`）、`opsOk`、`sentOps` 和幂等的 fn 已就位；10-07 的重放在“重做后上传”路径上沿用 `sentOps=ops.length` 的写法，复用 `tests/support/edits.ts` 的 `makeOneEditOfEachKind`。
- 编辑弹窗保存找不到记录时本计划不做任何事，10-06 改为加回。
- 完整 `test:cloud` 在 10-08、10-09 运行。

## Self-Check: PASSED

- 文件都在：us-journey-tracker.html、tests/support/constants.ts、tests/support/edits.ts、tests/cloud/offline-sync.spec.ts。
- 提交都在当前分支：702f205、33e238c；`git rev-list --count ca3c857..HEAD` 在写本文件前为 2。
- 验收：应用含 `function commit(`、`opsOk`、`sentOps`；五个锚点各一次；`persist()` 为 0 处；`commit([` 17 处；APP_SHA256 等于文件 sha256；edits.ts 导出 makeOneEditOfEachKind；每个任务暂存后隐私检查都打印“隐私检查通过”。

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
