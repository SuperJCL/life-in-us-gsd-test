---
phase: 10-offline-realtime-sync
plan: 05
subsystem: sync
tags: [session-expiry, checkAuth, goExpired, writer-id, sessionStorage, broadcastchannel, playwright, fake-pocketbase]

requires:
  - phase: 10-offline-realtime-sync
    provides: "10-01 的 requestSync/syncOnce/showSync/net；10-03 的 needRefresh 与 goBootOffline；10-04 的 commit/ops；Phase 9 的 expireToken、showLogin、loginNotice、onLogin 的同账号与换账号分支"
provides:
  - "checkAuth(signal)：authRefresh，只有 401 返回假并 goExpired，网络错误原样抛出"
  - "goExpired()：expireToken、net=expired、停重试、expired 状态行加 warn 横幅（带“重新登录”）；不动 state、缓存、touched、ops、留底"
  - "relogin()：resetSession 后进 Phase 9 登录页（邮箱预填、过期提示，有未上传修改加第二行）"
  - "syncOnce 的检测点：开始前本地 exp 已过、列表缺文档先 authRefresh、4xx（非 413、429）先 authRefresh、needRefresh 的 401"
  - "每标签页写入方 id：sessionStorage usj:v2:writer，BroadcastChannel hello/taken 发现复制标签页后重新生成"
affects: [10-06, 10-07, 10-08, 10-09]

actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: 9cc85146b79bd86b00ddb2147f0487e4a2b053ff
plan_head_after: 8302d269588d89bd8fdc89edf2fdd002ea63506a

tech-stack:
  added: []
  patterns:
    - "判断登录过期只看 authRefresh 的 401 或本地 exp；记录接口的 200 空列表和 4xx 先 authRefresh 排除令牌失效"
    - "过期不重置会话：用户继续记，persist 照常写缓存，net 为 expired 时 requestSync 直接返回"
    - "写入方 id 随标签页走（sessionStorage），重复由 BroadcastChannel 的 hello/taken 协商，不依赖定时器"

key-files:
  created:
    - tests/cloud/writer-id.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/support/strings.ts
    - tests/cloud/session.spec.ts

key-decisions:
  - "没有令牌但有过期标记（usj:v2:authExpired）时，cloudInit 也显示过期提示：会话中途过期后刷新页面，登录页仍说明是登录过期并带“本机还有没上传的修改”第二行；没有标记时仍是普通登录页"
  - "syncOnce 开头的本地 exp 检查会被 pagehide 的 flush 触发：刷新页面时旧页面可能 goExpired，靠上一条的标记让新页面显示正确的提示"
  - "列表缺任何一个文档（plan 或 state）就先 checkAuth，一次同步只查一次；checkAuth 失败（网络）按原错误走 syncOnce 的失败分类"
  - "4xx 分支排除 413（容量）、429（限流）和 authRefresh 自己失败的情况；令牌有效时不做特别处理，下一轮重试本来就会重新列表，文档确实不在就重建（IN-04）"
  - "goExpired 沿用 expireToken（先写过期标记再清令牌），其他标签页据此显示过期而不是退出；不新增不写标记的清令牌路径（IN-05 不处理）"

requirements-completed: [ACCT-05, SYNC-04]

coverage:
  - id: D1
    description: "会话中途令牌在服务器端失效：保存时列表 200 空，authRefresh 401 后状态 expired、warn 横幅只有“重新登录”、输入仍可用；再记一笔写进缓存；60 秒内没有新请求，只有 1 条 401；点“重新登录”登录页预填邮箱、提示两行；同账号重新登录后服务器含两条记录，没有换账号确认"
    requirement: "ACCT-05"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-05 an expiry found while saving keeps editing here, shows the expired status and banner, and uploads after signing in again with the same account"
        status: pass
    human_judgment: false
  - id: D2
    description: "本地令牌在会话中途过了 exp：下一次同步之前判过期，不发请求，状态 expired、横幅带“重新登录”、缓存脏且含新记录"
    requirement: "ACCT-05"
    verification:
      - kind: e2e
        ref: "tests/cloud/session.spec.ts#ACCT-05 a token that passes its local expiry during the session is reported as expired without asking the server"
        status: pass
    human_judgment: false
  - id: D3
    description: "答复丢失后再改一笔并刷新：不判冲突、没有留底、没有冲突提示，#snapshotBtn 隐藏，服务器上两条记录各一条"
    requirement: "SYNC-04"
    verification:
      - kind: e2e
        ref: "tests/cloud/writer-id.spec.ts#SYNC-05 a reload after a save whose answer was lost keeps no version and shows no conflict notice"
        status: pass
    human_judgment: false
  - id: D4
    description: "复制标签页带着同一个写入方 id：很快换成新 id，第一个标签页不变；两个标签页的写入 writer 不同；复制标签页刷新后 writer 不变"
    requirement: "SYNC-04"
    verification:
      - kind: e2e
        ref: "tests/cloud/writer-id.spec.ts#SYNC-02 a duplicated tab gets its own writer id and a reload keeps it"
        status: pass
    human_judgment: false
  - id: D5
    description: "旧路径和 Phase 9 的既有行为不变：app-integrity（含 SAFE-02）、storage、smoke 22 条通过；logout、reconcile-gate、offline-sync、multi-device、conflict-snapshot 通过"
    requirement: "ACCT-05"
    verification:
      - kind: e2e
        ref: "npm test（默认配置，workers=1，BELOW_NORMAL）app-integrity、storage、smoke：REPORT OK expected=22"
        status: pass
    human_judgment: false
  - id: D6
    description: "4xx（404 等）分支先 authRefresh 的代码路径：本计划没有专门用例（fake 对失效令牌的 200 空列表由 D1 覆盖），按代码审阅"
    requirement: "ACCT-05"
    verification: []
    human_judgment: true
    rationale: "更新返回 404 且令牌有效时的重新列表重建没有单独用例；10-07、10-08 的完整 test:cloud 会间接经过，但没有断言它"

duration: 14min
completed: 2026-11-10
status: complete
---

# Phase 10 Plan 05: 会话中途登录过期与每标签页写入方 id Summary

**登录在用着用着过期时不再被踢回登录页：authRefresh 的 401 或本地 exp 才算过期，过期后本机照常记、状态行与 warn 横幅提示“重新登录”、不再发请求，同账号重新登录后上传；写入方 id 改为每个标签页一个存进 sessionStorage，复制标签页由 BroadcastChannel 发现重复后换新，答复丢失后刷新不再误留底。**

## Performance

- **Duration:** 约 14 min
- **Started:** 2026-11-10T08:01Z
- **Completed:** 2026-11-10T08:15Z
- **Tasks:** 2
- **Files modified:** 5（应用 1、支撑文件 2、cloud 用例 2，其中 writer-id.spec.ts 新建）

## Accomplishments

### 过期的检测点

| 检测点 | 条件 | 动作 |
|---|---|---|
| syncOnce 开头 | `pb.authStore.isValid` 为假（本地 exp 已过或令牌已被清） | goExpired，不发请求 |
| 列表之后 | 没有 plan 或没有 state 文档（失效令牌的列表是 200 空） | `checkAuth(ctrl.signal)`：401 → goExpired；200 才继续按“文档缺失”创建（T-10-12） |
| catch | 记录请求返回 4xx，非 413、非 429、不是 authRefresh 自己失败 | `checkAuth`（独立的 AbortController，SYNC_MS 超时）：401 → goExpired；有效则落到原来的 retrying 与重试，下一轮重新列表（IN-04） |
| catch | needRefresh 的 authRefresh 返回 401（10-03 的离线启动路径） | 改为 goExpired，不再 resetSession 回登录页，离线可编辑期间发现过期同样继续可记 |

启动对账（reconcileOnce）里的过期仍走 Phase 9 的登录页，本计划没有改。

### goExpired 保留与停止的东西

- **保留：** `me`、`docs`、`state`、touched、ops、opsOk、本机缓存和留底一个都没碰；`persist` 照常写缓存，用户继续记。
- **做的事：** `expireToken()`（先写 `usj:v2:authExpired` 再静默清令牌，其他标签页据此显示过期登录页而不是退出）、`net="expired"`、`trying=false`、`stopRetry()`、`cdLeft=0`；状态行 `登录已过期，请重新登录`（data-state expired）；`showBar("expired", {tone: warn, msg: BANNER_EXPIRED, btns: [重新登录 primary]})`。
- **停止：** `requestSync` 在 `net==="expired"` 时直接返回，保存、online 事件、立即重试都不再发请求（用例确认 60 秒内请求数不变）。
- **relogin：** `resetSession(); showLogin("","expired")`，登录页邮箱预填、过期提示，`hasUnsent()` 为真时加第二行；同账号登录走 onLogin 现有直接 enterApp 的分支，对账表上传脏缓存；换账号走现有确认框。

### 写入方 id

- `let WRITER=uid()` 移出 SDK 常量行；仅 `CLOUD` 为真时才碰 sessionStorage：读 `usj:v2:writer`（长度不超过 40）沿用，没有就写入当前值；读取抛异常则退回每次加载一个。
- **复制标签页发现：** 开 `BroadcastChannel("usj:v2:writer")` 和本次加载的随机 nonce，加载后发 `{t:"hello",w,n}`；收到别人的 hello 且 `w` 等于自己的 WRITER → 回 `{t:"taken",w,n}`；收到 taken 且 `w` 等于自己的 → `WRITER=uid()`、写回 sessionStorage、再发 hello。两个副本同时发现对方时各自抽新的随机 id，仍不相同；原标签页的 id 不变。不依赖定时器。
- 冲突判断（对账的 `clash`、syncOnce 的真冲突）仍用 `writer!==WRITER`，读的是当前值。旧路径不读写 sessionStorage、不建频道。

### 实测的 console.error 条数

| 用例 | 条数 |
|---|---|
| ACCT-05 会话中途过期（保存） | 1（authRefresh 的 `status of 401 `；列表 200 空不产生） |
| SYNC-05 答复丢失后刷新 | 1（`ERR_CONNECTION_RESET`，那条 PATCH） |
| ACCT-05 本地 exp | 0（不发请求） |
| SYNC-02 复制标签页 | 0 |

### 验证结果

| 验证 | 结果 |
|---|---|
| Task 1：test:cloud session + logout + reconcile-gate | REPORT OK expected=29 flaky=0 unexpected=0（含四个指定标题） |
| Task 1：默认配置 app-integrity、storage、smoke | REPORT OK expected=22（含 SAFE-02） |
| Task 1 额外：offline-sync + multi-device + conflict-snapshot | 24 条通过（offline-sync 部分），其余同批通过 |
| Task 2：test:cloud writer-id + conflict-snapshot + session | REPORT OK expected=19 flaky=0 unexpected=0（含三个指定标题） |
| Task 2：默认配置 app-integrity、storage、smoke | REPORT OK expected=22（含 SAFE-02） |
| 两次暂存后隐私检查 | 都打印“隐私检查通过” |

## Task Commits

1. **Task 1：会话中途登录过期——继续可记、expired 状态与横幅、重新登录后同账号上传** - `6c5bdad` (feat)
2. **Task 2：写入方 id 每个标签页一个、刷新不变，复制标签页重新生成（WR-01）** - `8302d26` (feat)

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## TDD 记录（两个任务都是 tdd="true"）

- **Task 1 RED：** 计划约束“每个任务一次提交”，没有单独的 test 提交。两条新用例先于应用改动写出并在旧应用上运行（session.spec.ts，5 条通过、2 条失败）：本地 exp 那条失败在 `toHaveText(LOGIN_EXPIRED)`，期望过期、实际 `已同步`；保存时过期那条在同一断言上失败。都是目标用例上的计划断言，不是语法、夹具或零用例问题（语义评估）。没有产出独立 RED 记录文件，未运行 `gsd_run check tdd-red-evidence`。
- **Task 2 RED：** 临时把应用换回 HEAD 版本运行 writer-id.spec.ts：答复丢失那条失败在 `snapshot` 应为 null、实际有一份留底（正是 WR-01），复制标签页那条失败在 `sessionStorage['usj:v2:writer']` 应有值、实际 null；都是计划断言。随后恢复应用。
- **GREEN：** 各自同一提交，目标用例通过，两批默认套件的 22 条也通过。**REFACTOR：** 无。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 刷新页面时旧页面的 pagehide 触发 goExpired，新页面登录页没有过期提示**
- **Found during:** Task 1（既有用例 `ACCT-01 a token past its local expiry shows the expired notice without contacting the server` 失败）
- **Issue:** 该用例在登录后把时间拨到第 91 天再刷新；旧页面的 `pagehide` 会 `flush` → `requestSync` → syncOnce 开头的本地 exp 检查 → goExpired，清掉令牌，新页面看到“没有令牌”就显示普通登录页，没有过期提示。会话中途过期后用户直接刷新页面也是同一个情形（登录页不说明是过期，也不提示本机还有没上传的修改）。
- **Fix:** `cloudInit` 在没有令牌时读 `usj:v2:authExpired` 标记，有就用 `showLogin("","expired")`；没有标记仍是普通登录页。标记由 expireToken 先写，下次成功登录时清除（Phase 9 既有行为），所以退出登录后不会显示过期提示。
- **Files modified:** us-journey-tracker.html
- **Verification:** 该用例和 Phase 9 的其余过期用例通过；session、logout、reconcile-gate 共 29 条通过
- **Committed in:** 6c5bdad

**2. [Rule 1 - Bug] 我自己写的 checkAuth 调用传错了参数**
- **Found during:** Task 1 调试（状态变成离线而不是过期）
- **Issue:** `checkAuth(sg)` 传的是 `{signal}` 对象而不是 AbortSignal，fetch 在发请求前就抛 TypeError（status 0），被当成离线。
- **Fix:** 改为 `checkAuth(ctrl.signal)`；临时调试用的 console 输出和调试 spec 已删除，没有进入提交。
- **Files modified:** us-journey-tracker.html
- **Verification:** 两条 ACCT-05 用例通过
- **Committed in:** 6c5bdad

### 计划之外的小处理（非偏差）

- **session.spec.ts 第二条用例：** 计划写“login 0；setSystemTime”，实际加了 `pauseAt(FROZEN_NOW + 60_000)`，与同文件其他 manual 用例一致，之后 `setSystemTime` 再 `runFor(1_000)` 触发保存防抖。
- **writer-id.spec.ts 第二个标签页：** 第二个标签页用固定时钟，保存防抖需要在它上面也 `runFor(1_000)`（第一次没加，上传不到服务器，补上后通过）。
- **额外验证：** 因为改了“列表缺文档”的路径，另外跑了 offline-sync、multi-device、conflict-snapshot（计划只要求 session、logout、reconcile-gate）。
- **提交所在分支：** 顺序执行器，直接在 main 工作树上提交（同 10-01 至 10-04）。

**Total deviations:** 2 auto-fixed（2 Rule 1，其中一个是我自己引入后立刻修掉的）
**Impact on plan:** 第一条补上了“过期之后刷新页面”的提示，属于 ACCT-05 的一部分，没有改变任何计划指定的断言。

## Issues Encountered

- 4xx（404 等，令牌有效时）分支的 checkAuth 没有专门用例；fake 服务器对失效令牌的表现是 200 空列表，那条路径由 D1 覆盖。已在 coverage 的 D6 里标成需人工判断。

## Known Stubs

无。

## Threat Flags

无。没有新增网络端点；新增的 authRefresh 调用是对既有端点的读性质调用。T-10-12（空列表与 404 误判）由先 checkAuth 和 D1 覆盖，T-10-13（过期丢本机修改）由 goExpired 不清任何本机状态和 D1 的“同账号重新登录后上传”覆盖，T-10-14（过期后不停发请求）由 requestSync 的 expired 早退和 D1 的 60 秒无请求断言覆盖，T-10-15、T-10-16 由 D3、D4 覆盖。

## User Setup Required

无——不需要任何外部服务配置。

## Next Phase Readiness

- 10-06：`net` 现在有 `"expired"`；忙碌时挂起“已更新为其他设备上的最新内容”的实现不受影响。
- 10-07：`goExpired` 不清 ops；离线重放用例若涉及过期，ops 在 `relogin` 的 resetSession 后清空，重新登录靠缓存和对账上传（D-03）。
- 完整 `test:cloud` 在 10-08、10-09 运行。

## Self-Check: PASSED

- 文件都在：us-journey-tracker.html、tests/support/constants.ts、tests/support/strings.ts、tests/cloud/session.spec.ts、tests/cloud/writer-id.spec.ts。
- 提交都在当前分支：6c5bdad、8302d26；`git rev-list --count 9cc8514..HEAD` 在写本文件前为 2。
- 验收：应用含 `checkAuth`、`goExpired`、`本机的修改还在`、`usj:v2:writer`、`sessionStorage`、`BroadcastChannel`；五个锚点各一次；APP_SHA256 等于文件 sha256；每个任务暂存后隐私检查都打印“隐私检查通过”。

---
*Phase: 10-offline-realtime-sync*
*Completed: 2026-11-10*
