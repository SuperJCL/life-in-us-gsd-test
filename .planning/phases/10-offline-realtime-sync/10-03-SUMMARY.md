---
phase: 10-offline-realtime-sync
plan: 03
subsystem: sync
tags: [offline-boot, background-reconcile, conflict-notice, playwright, fake-pocketbase]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-01 的 requestSync/syncOnce/showSync/touched/退避重试；10-02 的假服务器开关（context 限定的 fault、request()、writes[].writer）"
provides:
  - "goBootOffline(r)：启动时有缓存且浏览器显示断网（立即）或对账 15 秒未完成（FAIL_MS）就放开编辑，状态 offline，1 秒后第一次后台对账"
  - "syncOnce 的完整后台对账表：先 plan 后 state；文档缺失就创建（唯一索引冲突重新列表）；干净且服务器更新就替换并提示；本机脏则整份上传，真冲突先静默留底"
  - "needRefresh：启动时欠下的 authRefresh 由第一次后台对账补做，401 走过期处理"
  - "cfShown：同一次同步或启动对账弹过冲突提示就不弹“已更新为其他设备上的最新内容”（IN-01）"
  - "tests/support/online.ts：installOnlineSwitch / setPageOnline"
affects: [10-04, 10-05, 10-06, 10-07, 10-08, 10-09]

actuals:
  tokens: 28000
  tasks: 2
  commits: 2
plan_head_before: 3d38577e48f919d4a05e6717d8f8b0a9a23705ed
plan_head_after: 07a991a40207cd5d7159e0cedfb058e87e368e13

tech-stack:
  added: []
  patterns:
    - "navigator.onLine 只作“不必等待”的提示：后台仍按退避尝试，能否连上以请求结果为准"
    - "bootOffline 为真期间所有失败都显示 offline，第一次成功收尾才清除"
    - "init script 把 navigator.onLine 改成读页面变量，用例用 setPageOnline 切换并派发 online/offline 事件"

key-files:
  created:
    - tests/support/online.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/cloud/offline-sync.spec.ts
    - tests/cloud/reconcile-gate.spec.ts

key-decisions:
  - "goBootOffline 自己排第一次后台对账（RETRY_STEPS[0]，requestSync('boot')），不复用 scheduleRetry：不需要倒计时 interval，retryIdx 置 1 后沿用退避序列"
  - "syncOnce 里 state 干净且服务器更新时，只有在列表返回时 state 仍干净且 seq 没变才替换；期间有了新修改就留给下一轮按脏处理（真冲突规则）"
  - "plan 的本机脏标记（容量 held 的情况）存在时后台对账不替换 plan；plan 在本阶段没有编辑入口，后台对账从不上传 plan"
  - "把 reconcileOnce 里局部的 uniq 提成顶层 uniqErr，syncOnce 与 reconcileOnce 共用，行为不变"

requirements-completed: [SYNC-03, SYNC-06]

coverage:
  - id: D1
    description: "有缓存、浏览器显示断网时打开：不推进时钟就离线可编辑（无门控、无横幅、statusOffline(0)），记一笔后 statusOffline(1)，online 事件后上传、已同步"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 opening the app with a cache while the browser reports offline allows editing at once"
        status: pass
    human_judgment: false
  - id: D2
    description: "联网时对账 15 秒未完成：3 秒仍是“网络较慢”加门控，15 秒转离线可编辑（不再只读、没有连不上横幅），期间记的一笔在服务器恢复后上传，服务器只有一条且没有留底（B3）；没有缓存的重试卡片不变"
    requirement: "SYNC-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-03 a reconcile not finished after about 15 seconds with a cache turns to offline editing and uploads the edits made meanwhile (B3)"
        status: pass
      - kind: e2e
        ref: "tests/cloud/reconcile-gate.spec.ts#SYNC-05 a first sign-in that cannot reach the server shows only the retry card with no account content"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-08：连不上服务器时刷新，待上传的修改和数量（touched 恰好是该记录的 log: 键）还在、可编辑，恢复联网后上传、数量归零"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 an offline edit survives a reload with its pending count and is uploaded later"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-03：设备二离线记一笔，设备一保存、另一个写入方改了计划；设备二联网后服务器是设备二的 state，留底含设备一的版本，冲突提示带下载入口留在屏幕上，计划按服务器更新"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-05 an offline edit over a newer server version is uploaded and the other version is kept here (D-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "IN-01：启动对账里 state 真冲突加计划干净更新时，冲突提示不被“已更新”替换（去掉 cfShown 检查后 D-03 和 IN-01 两条用例都会失败，已做变异验证）"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-05 a conflict notice found while opening the app is not replaced by the updated notice (IN-01)"
        status: pass
    human_judgment: false
  - id: D6
    description: "后台对账补齐对账表的两条路径：干净时替换为更新的服务器版本并提示且不写入；服务器 state 文档不见时用本机内容重建（恰好一次 POST）"
    requirement: "SYNC-06"
    verification:
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 a background sync takes in a newer server version when nothing is waiting to be uploaded and says so"
        status: pass
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-01 a background sync whose server state document is gone creates it again from the local content"
        status: pass
    human_judgment: false
  - id: D7
    description: "旧路径不变：app-integrity（含 SAFE-02）、storage、smoke 共 22 条通过"
    requirement: "SYNC-03"
    verification:
      - kind: e2e
        ref: "npm test（默认配置，workers=1，BELOW_NORMAL）app-integrity、storage、smoke：REPORT OK expected=22 flaky=0 unexpected=0"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 03: 离线启动与后台对账 Summary

**有缓存时打开应用不再只读：浏览器显示断网就立即、对账 15 秒未完成就转为离线可编辑，后台 syncOnce 补齐了先 plan 后 state 的完整对账表，真冲突按 D-03 本机为准加留底，cfShown 让冲突提示不被“已更新”提示顶掉（IN-01）。**

## Performance

- **Duration:** 约 15 min
- **Started:** 2026-11-10T07:27Z（按上一个提交推算）
- **Completed:** 2026-11-10T07:42Z
- **Tasks:** 2
- **Files modified:** 5（应用 1、支撑文件 2、cloud 用例 2，其中 online.ts 新建）

## Accomplishments

### 启动离线的两条入口

1. **浏览器已显示断网（D-02）：** `startReconcile` 在有缓存且 `navigator.onLine===false` 时，在设置门控、状态行之前直接 `goBootOffline(r)` 并返回，不等任何超时。
2. **对账 15 秒没完成（D-01）：** FAIL_MS 回调在有缓存时调用 `goBootOffline(r)`（原先是只读加连不上横幅）；没有缓存的分支（等待卡片、重试）一个字没改。SLOW_MS 的“网络较慢”不变。

`goBootOffline(r)`：`endRun(r)`、`clearRunUI()`、`setGate(null)`、`renderAll()`；置 `bootOffline=true`、`net="offline"`、`needRefresh=!!r.mode.refresh`；排一次 `RETRY_STEPS[0]` 后的 `requestSync("boot")`（retryIdx 置 1）；`showSync()` 用 enterApp 从缓存还原的 touched 显示数量。

### syncOnce 的完整后台对账表（先 plan 后 state）

| 项 | 情况 | 动作 |
|---|---|---|
| 启动欠账 | `needRefresh` | 先 `authRefresh`，成功才清；401 → `expireToken(); resetSession(); showLogin("","expired")`（不清缓存，T-10-09）；10-05 再改为继续可记 |
| plan | 服务器没有 | 用本机计划创建（`keepOrphans` 且有缓存时用缓存原样）；唯一索引冲突（400 `validation_not_unique`）重新列表后沿用服务器文档 |
| plan | 服务器 updated 与 `docs.plan.base` 不同且本机 plan 不脏 | `usePlan(sv.data)`、`keepOrphans=!ok`、写 plan 缓存、`state=normalize(state)`；内容与旧缓存确实不同才算 merged |
| state | 服务器没有 | `sizeCheck` 后用本机 state 创建（同样的唯一索引处理），按上传成功收尾 |
| state | 本机脏 | 照 10-01：真冲突（服务器更新、写入方不是本页、内容不同）先静默 `keepConflict`，上传，成功后 `conflictNotice` |
| state | 本机干净且服务器 updated 不同（列表返回时仍干净、seq 没变） | `state=normalize(sv.data)`、写干净缓存；内容不同才算 merged |
| 末尾 | `replaced` | `renderAll(); snapShow()` |
| 末尾 | `merged && !cfShown` | `toast("已更新为其他设备上的最新内容",null,4000)` |

### cfShown 的置位与检查点

- **置真：** `conflictNotice(kept)` 一进入就置真（无论 kept 真假）。
- **置假：** `syncOnce` 开始时（`trying=true;cfShown=false`）、`reconcileOnce` 开始时。
- **检查：** `syncOnce` 末尾的 `merged&&!cfShown`、`reconcileOnce` 末尾的 `changed&&!cfShown`。
- 变异验证：把两处检查去掉后，D-03 和 IN-01 两条用例都在“冲突提示仍在屏幕上”断言失败；放回后全部通过。

### 实测的 console.error 条数

| 用例 | 被拒请求 | 条数 |
|---|---|---|
| 打开即离线（SYNC-03） | 只有列表 GET 被拒（记一笔后的第一次后台尝试） | 按 `refused.hits` 确认（ERR_CONNECTION_REFUSED） |
| 刷新后数量仍在 | 刷新前的一次列表 GET；刷新后到 online 之前时钟不动，没有请求 | `listFault.hits + patchFault.hits`（PATCH 从未发出，因为列表先失败） |
| D-03（设备二） | 设备二记一笔后的第一次列表 GET | `listFault.hits + patchFault.hits`，只统计设备二（fault.context） |
| IN-01 | 刷新前记一笔后的第一次列表 GET | `listFault.hits + patchFault.hits` |
| 15 秒转离线（B3） | 用 hold 不用 refuse，没有 console.error；fulfillErrors 至多 1 条且路径是列表 | 0 |

### 文件与用例

- `tests/support/online.ts`（新）：`installOnlineSwitch(arg)` 自包含 init script，用 `Object.defineProperty(Navigator.prototype,'onLine',…)` 读页面变量；`setPageOnline(page, on)` 改变量并派发 `online`/`offline`。头注释写明为什么不用 `setOffline(true)` 刷新。
- offline-sync.spec.ts：新增 4 条计划内用例（打开即离线、刷新后数量仍在、D-03、IN-01）加 2 条额外用例（后台干净替换、state 文档不见时重建）。
- reconcile-gate.spec.ts：Phase 9 的“15 秒只读”用例改写为 B3 用例，不再使用的 `BANNER_UNREACHABLE`、`BTN_RETRYING`、`STATUS_UNREACHABLE` 导入已删除。
- 验证：offline-sync + reconcile-gate + conflict-snapshot 共 32 条，REPORT OK（expected=32 flaky=0 unexpected=0）；默认配置 app-integrity、storage、smoke 22 条，REPORT OK，含 SAFE-02。两次暂存后隐私检查都打印“隐私检查通过”。

## Task Commits

1. **Task 1（tracer）：有缓存、浏览器显示断网时打开就离线可编辑** - `d93ec2a` (feat)
2. **Task 2：15 秒后转离线可编辑、后台对账补齐对账表、冲突提示不被“已更新”替换** - `07a991a` (feat)

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## TDD 记录（Task 2，tdd="true"）

- **RED：** 计划约束“每个任务一次提交”，没有单独的 test 提交。Task 1 的目标用例先写好，在 Task 1 之前的应用上单独运行，失败在 `toHaveAttribute('data-state','offline')`：期望 `offline`、实际 `reconciling`，是目标用例上的计划断言（语义评估：不是语法、夹具或零用例问题）。Task 2 的新用例和应用改动一起写出，随后做变异验证：去掉两处 `cfShown` 检查后 D-03 与 IN-01 两条用例失败（期望 true、实际 false），证明它们真正测到了提示顺序。因为没有产出独立的 RED 记录，未运行 `gsd_run check tdd-red-evidence`。
- **GREEN / REFACTOR：** 同一提交；把 `uniq` 提成顶层 `uniqErr` 属于提交内的小整理。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

None - 计划按原样执行。

### 计划之外的补充（非偏差）

- **两条额外用例：** 后台对账的“干净替换”和“文档重建”两条路径计划里没有专门用例，怕改了不测，补了两条（标题见上）。没有改变任何计划指定的断言。
- **提交署名：** 按执行环境给出的 `Co-Authored-By: Claude Sonnet 5.5`，与 10-01、10-02 一致。
- **提交所在分支：** 本计划是顺序执行器，直接在 main 工作树上提交（同 10-01、10-02）。

**Total deviations:** 0
**Impact on plan:** 无。

## Issues Encountered

- 无阻塞问题。Windows 下 `-g "A|B"` 会被 shell 当管道，单条过滤改用分开的两次运行；工作区里 spec 文件是 CRLF（index 为 LF），改动时按原行尾保留。
- 第一次用 heredoc 套 python 时 shell 引号出错，脚本没有执行、文件没有被改动；改为把脚本写到临时目录再运行。

## Known Stubs

无。

## Threat Flags

无。本计划没有新增网络端点或认证路径；T-10-08（过期缓存整份覆盖）由 D-03 用例覆盖，T-10-09（令牌失效）由 needRefresh 与 authing 的 401 处理承担，T-10-26（提示被替换）由 cfShown 加两条用例覆盖。

## User Setup Required

无——不需要任何外部服务配置。

## Next Phase Readiness

- 10-04 起：`persist()` 其余调用点接上条目键、成功后只保留上传开始之后才做的操作的键；本计划的 syncOnce 对账表在“本机脏”时仍是整份覆盖加留底（D-03），不做离线重做。
- 10-05：authRefresh 401 的启动过期处理改为继续可记（现在仍是 Phase 9 的回登录页）。
- 10-06：把 `已更新为其他设备上的最新内容` 的立即提示改成忙碌时挂起。
- 完整默认 `npm test` 与完整 `test:cloud` 按计划分别在 10-04 与 10-08/10-09 运行；本计划只跑了指定 spec。

## Self-Check: PASSED

- 文件都在：us-journey-tracker.html、tests/support/constants.ts、tests/support/online.ts、tests/cloud/offline-sync.spec.ts、tests/cloud/reconcile-gate.spec.ts。
- 提交都在当前分支：d93ec2a、07a991a；`git rev-list --count 3d38577..HEAD` 在写本文件前为 2。
- 验收：应用含 goBootOffline、navigator.onLine、bootOffline、needRefresh、cfShown；reconcile-gate.spec.ts 不再含 `turns read-only with a retry that restores editing`；五个锚点各一次；APP_SHA256 等于文件 sha256（faba6a87…e115）；online.ts 导出两个函数；每个任务暂存后隐私检查都打印“隐私检查通过”。

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
