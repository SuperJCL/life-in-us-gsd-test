---
phase: 10-offline-realtime-sync
fixed_at: 2026-11-10T00:00:00Z
review_path: .planning/phases/10-offline-realtime-sync/10-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 6
skipped: 3
status: partial
---

# Phase 10: 代码审查修复报告

**Fixed at:** 2026-11-10
**Source review:** .planning/phases/10-offline-realtime-sync/10-REVIEW.md
**Iteration:** 1

**Summary:**
- 范围内的发现：9 项（3 项 warning，6 项 info，`fix_scope: all`）
- 已修复：6 项（WR-01、WR-02、WR-03、IN-02、IN-03、IN-04）
- 已跳过：3 项（IN-01、IN-05、IN-06）

所有应用侧改动都只在 `us-journey-tracker.html`，每个改动应用的提交都在同一个提交里重新记录了 `tests/support/constants.ts` 的 `APP_SHA256`。没有新增任何界面文案，没有改任何契约字符串，D-01 到 D-08 的行为没有变。旧路径（无后端或 `window.claude`）没有动：新逻辑都在 `CLOUD`、`me` 或只在云端函数里运行。

## 验证

- **验证环境：** 全部在主检出（`workflow.use_worktrees` 为 false，没有建 worktree）里运行，所以数字可以直接在当前工作树复现。
- **每个行为修复的新用例**都在修复前的应用（`git show HEAD:us-journey-tracker.html` 临时还原，没有提交）上单独运行过，确认会失败；然后还原修复版再通过。
- 测试一律以 BELOW_NORMAL 优先级、1 个 worker 运行，没有并发。`playwright.config.ts` 没有动。
- **完整 `npm run test:cloud`：158 条通过**（3.1 分钟，没有 flaky、没有失败）。
- **默认配置：** `npm test -- --workers=1` 带上了 `app-integrity`、`storage`、`smoke` 的路径参数，但参数没有缩小范围，实际跑了整个默认套件：**176 条通过**（含预期失败的已知 bug 用例，它们计为通过），其中 `tests/e2e/platform/app-integrity.spec.ts`、`tests/e2e/storage` 和 `tests/e2e/smoke.spec.ts` 都在内。编排器之后的整套回归门槛照常运行。

## Fixed Issues

### WR-01: 进行中的 `syncOnce` 不会被退出登录或会话重置中止，`authRefresh` 的迟到应答可以把令牌重新存回来

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/session.spec.ts`
**Commit:** 83adc9d
**Status:** fixed: requires human verification（竞态逻辑）
**Applied fix:** 新增模块级集合 `syncCtrls` 以及 `mkCtrl()`、`abortSync()`。`syncOnce` 的主控制器和 4xx 之后 `checkAuth` 用的控制器 `c2` 都登记进去，`finally` 里移除。`resetSession()` 在 `sessionEpoch++` 之后、`logout()` 在 `authQuiet=true` 之后都调用 `abortSync()`；`requestSync` 和同步循环在 `loggingOut` 期间不再发起新一轮，`syncOnce` 的 catch 在 `loggingOut` 时直接返回，所以退出期间被中止的请求不会被当成“离线”或“重试”去排计时器。`checkAuth(signal, ep)` 增加会话参数：只有 `ep===sessionEpoch` 且不在退出中时，401 才会走 `goExpired()`，并且返回值是 `ep===sessionEpoch`。新增两个用例（`session.spec.ts`，manual 时钟）：服务器删掉 state 文档、后台同步读到缺文档后先 `authRefresh`，这条请求被 `hold` 挂住，期间点退出，再放行：(a) 令牌有效时 `pocketbase_auth` 仍为空、刷新页面仍是登录页；(b) 令牌被撤销时登录页没有“登录已过期”提示、没有同步横幅、`usj:v2:authExpired` 没有被写回。两条在修复前的应用上都失败（令牌被写回、过期标记被写回）。

### WR-02: 重试倒计时每秒重建一次“立即重试”按钮，键盘焦点丢失，慢一点的点击会落空

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/offline-sync.spec.ts`
**Commit:** 9321601
**Applied fix:** `setStatus` 在状态行已经是“一个文字节点 + 同一个按钮”时，只更新文字节点的 `nodeValue` 并把 `onclick` 指向新的处理函数，按钮节点保持不动；其他情况仍然整行重建（按钮改用 `onclick` 赋值，与 `addEventListener` 等价）。句子仍是 `#status` 的第一个文字节点，`tests/support/strings.ts` 的约定不变。新增用例：倒计时走一秒之后，按钮是同一个节点、仍有焦点，点击仍然有效（去掉故障后已同步）。修复前的应用上失败。

### WR-03: 一轮同步（读两份完整文档加上传）共用一个 15 秒超时，大文档在慢线路上会永远超时

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/offline-sync.spec.ts`, `tests/README.md`
**Commit:** 4311d01
**Status:** fixed: requires human verification（超时参数的取值是判断，不是唯一解）
**Applied fix:** 新增 `syncLimit()`：`SYNC_MS * min(4, 1 + slowRuns)`，再加 `min(60000, floor(sizeOf(state)/102400) * 3000)`，也就是每 100 KB 多 3 秒（最多多 60 秒），连续超时的轮次再放宽到最多 4 倍基础值；成功一轮或 `resetSession` 后 `slowRuns` 归零。小于 100 KB 的文档仍是 15 秒，所以已有的 15 秒用例不受影响。`checkAuth` 的单独超时没有改。新增用例：400 KB 的文档（限制 15 + 9 = 24 秒），挂起保存请求，过了 15 秒仍是“保存中”，再过 9.2 秒转为 `retrying`，放行后恢复已同步；修复前的应用上在 15 秒处就变成 `retrying`，用例失败。`tests/README.md` 的 Phase 10 已知限制里补了“慢线路上的大文档”一条（接近 4 MB 的文档在有效吞吐很低的线路上仍可能一直超时）。

### IN-02: 离线或保存失败期间，每次编辑都会立即发起一次请求，并推进退避档位

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/offline-sync.spec.ts`
**Commit:** 4b6298b
**Applied fix:** 新增 `bumpReq`：`requestSync(reason)` 在 `reason!=="save"`（定时器、立即重试、`online`、拉取、启动）时置位，`syncOnce` 开头取走并清零。`scheduleRetry(bump)` 只有在 `bump` 为真，或这是第一次失败（`retryIdx===0`）时才推进 `retryIdx`，所以编辑触发的失败不再消耗 1、2、5、10、30、60 的档位，第一次失败仍按 1 秒。编辑触发的探测请求本身保留（记完马上上传是有用的）。`resetSession` 里复位。新增用例：503 故障期间连续记 4 条，等待稳定在 2 秒；每个保存都落到服务器（恢复后一条不少）。修复前的应用上第三次编辑起变成 5 秒，用例失败。重复运行 3 次稳定。

### IN-03: `sizeCheck` 量的是 `state`，上传的却是 `docAfter()`

**Files modified:** `us-journey-tracker.html`, `tests/support/constants.ts`, `tests/cloud/capacity.spec.ts`
**Commit:** 938ed46
**Applied fix:** 有冲突检查的更新分支在计算完 `body`（含 `rebaseState` 之后）、`update` 之前加 `sizeCheck(body)`；创建分支先算出 `cb=docAfter()` 的深拷贝，再 `sizeCheck(cb)` 并用同一份上传。原来对工作 `state` 的提前检查保留（超限且脏的设备本来就不读列表）。新增用例：另一台设备把接近上限的内容存到服务器上，本机只记一条约 15 KB 的小记录，叠上去超限：状态行是 `toolarge`，不发 PATCH，修改留在本机缓存、标记为未上传。修复前的应用上这个请求被发出、被服务器拒绝，状态停在 `saving`，用例失败。

### IN-04: 一个标签页发现登录过期，其他标签页会被直接送到登录页，草稿丢失

**Files modified:** `tests/README.md`
**Commit:** 97e0b35
**Applied fix:** 采用审查给出的两个方案里的第一个：在 `tests/README.md` 的“Phase 10 的已知限制”里写明，其他标签页没提交的草稿和内存里的操作记录会丢，已写进本机缓存的修改不丢；“过期后仍可继续记”只对发现过期的那个标签页成立。没有改应用行为（改成让其他标签页也进入 `expired` 状态会动到 `onAuthChange`，是行为改动，而且需要新的界面决定）。

## Skipped Issues

### IN-01: 带缓存时已经没有路径能到达“连不上、只读”的横幅，相关代码已成死代码

**File:** `us-journey-tracker.html:873, 884, 865`
**Reason:** skipped: 删除会去掉 09-UI-SPEC §S4 的一条契约字符串（“连不上服务器，现在只能查看上次的内容，不能修改。”）。本次的规则是不改任何契约字符串，而且审查自己也提供了“在 CONTEXT 里注明保留”的替代方案。我核对过调用关系，审查的判断是对的：带缓存的 `unreachBar` 只能从 `onRetry` 到达，而它的唯一入口正是这条横幅上的按钮，`bootRetry` 按钮只在无缓存时出现。这些代码无害，建议由所有者决定是删除还是保留。`tests/cloud/capacity.spec.ts` 里仍有对 `BANNER_UNREACHABLE` 的负向断言。
**Original issue:** `SB_ORDER` 里的 `"unreachable"`、`unreachBar` 和 `startReconcile` 里 `if(retrying)showBar("unreachable",…)` 对带缓存的路径都是死代码。

### IN-05: 导入路径绕过 `commit`，以后若在云端放开导入会和挂起槽冲突

**File:** `us-journey-tracker.html:1758`（现在约 1774 行）
**Reason:** skipped: deferred to Phase 11 (import is not enabled on the cloud path yet)。补充判断：这不是一个小而独立的改动。云端的整份替换要同时决定 `touched` 条目键怎么记、`ops` 和 `opsOk` 怎么处理、`remoteView` 横幅怎么收、冲突时是整份覆盖还是重做，这些是 Phase 11 导入语义的一部分；入口在云端被隐藏，所以任何测试都碰不到这条路径，现在加的代码无法验证。
**Original issue:** `importJson` 的处理是 `state=s;persist("import");renderAll()`，没有经过 `commit`，也不会 `takeRemote()`，挂起槽里有远端版本时导入内容会被 `docAfter()` 丢掉。

### IN-06: `normalize` 对非法 id 的记录每次生成新的随机 id，`remoteDiffers()` 会永远为真

**File:** `us-journey-tracker.html:556, 1340-1361`（现在约 1373 行）
**Reason:** skipped: 触发条件是服务器文档里有应用自己不会写的非法 id（例如以后迁移写入的记录），现在不可达；正确的修法在写入侧（Phase 11 迁移时补齐 id）。在应用侧要么让 `normalize` 用确定性的回退 id，要么在 `remoteDiffers` 里比较前规范化两边的 id，前者会改变 v1 导入和加载对坏 id 的现有行为（Phase 7 的 id 迁移用例依赖它），后者要在 `canon` 之外另写一套比较，都不是小而安全的改动。已记入 Phase 11 迁移的输入：迁移写入前补齐记录 id。
**Original issue:** `docAfter()` 每次对服务器数据重新 `normalize`，没有合法 `id` 的日志每次都生成新的随机 id，所以 `canon(docAfter())!==canon(state)` 恒为真，横幅反复出现。

---

_Fixed: 2026-11-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
