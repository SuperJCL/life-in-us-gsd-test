---
phase: 15-fitness-tab
plan: 02
subsystem: fitness-tab
tags: [fitness-log, per-field-errors, draft-protection, wodraft, offline-hint, undo, playwright, playwright-cloud]

requires:
  - phase: 15-fitness-tab
    provides: 15-01 的 state.workouts 数据形状、woPut / woDel / woFromDraft / workoutProblems、#fl 外壳和草稿 fl、tests/support/fitness.ts
  - phase: 12-plan-editor
    provides: pe-err 逐字段错误写法、confirmBox、goPlan
provides:
  - 记录区完整交互：逐字段校验（T_FL_ERR）、保存栏六档提示、组和动作的增删复制与撤销、照上次填和参考行、有氧行、放弃和换日期确认
  - 同一天再记并进当天、删除整次训练可撤销（commit(["wo:"+date], s=>woPut(s,date,gone))）
  - 草稿保护：renderAll 不冲掉草稿、别的设备改了同一天的提示、本机留底 wodraft 与恢复、beforeunload、离线提示
  - 纯函数 liftLast(s,id,before)（在纯函数段里）、activeCardio()
affects: [15-03 本周训练和趋势图, 15-04 力量目标卡搬家, 15-05 日历时间线导入导出, 15-06 编辑页和示例挑选, 15-07 收尾（完整套件、勾选需求）, Phase 16 总体验收]

actuals:
  tokens: 16458
  tasks: 3
  commits: 3

plan_head_before: d2826bb5879b9b65327b3999953858827553ac86
plan_head_after: ce881bfa9c3fa5137dcb300d1d05b126232236b9

tech-stack:
  added: []
  patterns:
    - "记录区草稿 fl={date,draft,orig,seen,tried,base,remote,restored}：draft 是输入框里的字符串，orig 是载入时的 JSON，base 是载入时这一天已保存内容的 JSON（和现在已保存的不同就说明别的设备改过）"
    - "renderFit(force)：flBusy()（草稿有内容或焦点在 #fl 里）时只做 flRemoteCheck()+flHint()，不重画；否则草稿没有内容就按 state 重新载入这一天再画；本机留底只在登录后第一次画时恢复"
    - "逐字段错误不重画整块：flErrs() 只切 aria-invalid 和 .pe-err 的 hidden 与文字；按住按钮时字段失焦不立刻显示错误（flPtr），抬起后补显示，免得错误行把按钮挤走丢掉这一下点击"
    - "草稿里的删除类操作（删一组、移除动作或有氧项）的撤销只改草稿，闭包里带日期和删除前的拷贝；整次训练的删除和撤销走 commit，同一个键 wo:<日期>"

key-files:
  created:
    - tests/cloud/fitness-log.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/support/fitness.ts
    - tests/e2e/fitness/log.spec.ts
    - tests/e2e/fitness/workouts-data.spec.ts

key-decisions:
  - "草稿不算 isBusy：远端更新照常应用，记录区自己跳过重画保住草稿（记录区有焦点时 isBusy 本来就为真）；如果 Phase 16 验收发现远端更新在健身页造成跳动，改为草稿有内容时算 busy 只需改 isBusy 一处"
  - "本机留底只在云端版（CLOUD&&me，键 cacheKey(\"wodraft\")，内容 {date,draft}），本地版没有账号 id，草稿只在内存里"
  - "同一天两台设备都改：以最后保存的为准；草稿有内容且这一天在别的设备上更新过时提示行第 2 档提醒覆盖风险，保存仍可用"
  - "保存栏提示第 3 档的圆点用 muted（UI-SPEC 的表），不是计划正文里的「无 tone」"
  - "草稿清空后在已保存的一天上点「保存修改」，等同删除整次训练（走 flDelete，带撤销 toast），不是悄悄存一个空天"

requirements-completed: []
requirements-advanced: [FIT-02, FIT-05]

coverage:
  - id: D1
    description: "tracer：打开已有训练的日子 → 加动作、复制上一组 → 半填报错（逐字段、焦点、提示行）→ 改好保存（同一天合并，只有一个日期键）→ 删除整次训练 → 撤销，不再弹 toast"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 recording again on a day that already has a training merges into it, a half-filled set is flagged next to its field, and the whole training can be deleted with an undo (D-06, A5, SC2)"
        status: pass
      - kind: unit
        ref: "tests/e2e/fitness/workouts-data.spec.ts#FIT-02 workoutProblems reports each rule at its limit and one step past it and ignores a fully empty set (A5, A19)"
        status: pass
    human_judgment: false
  - id: D2
    description: "组和动作的其余交互：不自动预填、照上次填、20 组上限、删一组和移除动作的撤销、放弃要确认且默认焦点在安全按钮、保存栏空草稿和已保存时 aria-disabled、徒手 0 保存后参考行写「徒手」、芯片与空状态文案"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 sets are added, copied from the previous set, filled from the last training and deleted with an undo, with the last-training line and the 20-set limit (D-01, A3)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 removing an exercise with content offers an undo, and discarding asks first and restores the saved training (A22)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 the save button is not available for an empty draft or an unchanged saved day, the chip rows say when everything is added, and a bodyweight set saved as 0 reads 徒手 (D-01, S3)"
        status: pass
    human_judgment: false
  - id: D3
    description: "有氧行：时长必填、距离选填、整块空报错、已加进的不在芯片行里、全部加完显示说明"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 a cardio item needs a duration and takes an optional distance, and an empty cardio row is reported instead of dropped (D-02, A5)"
        status: pass
    human_judgment: false
  - id: D4
    description: "计划里没有力量项和有氧项时整个记录区只剩一行说明和「去编辑计划添加动作」（只有云端版有入口），点入口进编辑计划页，回来草稿还在"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/fitness-log.spec.ts#FIT-02 a plan without lifts or cardio shows one empty line with the plan editor entry, which opens the plan editor and keeps the draft (D-03, S3)"
        status: pass
    human_judgment: false
  - id: D5
    description: "换日期确认：草稿有内容时改日期框或从本周训练行进入先弹确认，拒绝时日期框恢复原值；切标签不确认、草稿留着"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 picking another date with unsaved content asks first and keeps the date when declined, while switching tabs keeps the draft without asking (S3, A2)"
        status: pass
    human_judgment: false
  - id: D6
    description: "草稿保护：别的设备更新同一天时草稿不被冲掉且提示行换成覆盖风险；本机留底 500 ms 后写入、刷新后恢复并显示「已恢复上次没保存的内容。」、退出登录后清掉"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/cloud/fitness-log.spec.ts#FIT-02 an unsaved draft survives a remote update and a reload, says the day changed on another device and is cleared on sign-out (S3, A2)"
        status: pass
    human_judgment: false
  - id: D7
    description: "离线：断网时记录区照常可用，保存后提示行写离线说明、缓存里 touched 含 wo:<日期>、联网后上传；对账门控时写入控件真 disabled，本周训练行仍能切到健身页"
    requirement: "FIT-05"
    verification:
      - kind: e2e
        ref: "tests/cloud/fitness-log.spec.ts#FIT-02 while offline a training is saved with the offline hint and uploaded later, and while the edit gate is on the logging controls are disabled and the fitness rows still open the tab (A23, S9)"
        status: pass
    human_judgment: false
  - id: D8
    description: "375 px 下组行一行放得下、20 组时页面滚动且保存栏不被虚拟键盘盖住、真机上页面被系统回收后留底恢复"
    requirement: "FIT-02"
    verification: []
    human_judgment: true
    rationale: "backstop：需要真机，交给 Phase 16 总体验收"

duration: 28min
completed: 2026-11-13
status: complete
---

# Phase 15 Plan 02: 记录区做全 Summary

**健身页记录区做完整：逐字段校验和保存栏六档提示、同一天再记并进当天、组和动作的增删复制与撤销、照上次填、有氧行、放弃和换日期确认，加上草稿不被同步、刷新和换日期冲掉（本机留底 wodraft、离线提示），整次训练删除和撤销走同一个 `wo:<日期>` 键。**

## Performance

- **Duration:** 约 28 分钟（2026-11-13 21:34Z 到 22:02Z）
- **Tasks:** 3（Task 1 为 tracer，Task 2、3 为 auto）
- **Files:** 7 个（1 个新增，6 个修改）
- **Commits:** 3 个任务提交，measured：`git rev-list --count d2826bb..ce881bf` = 3
- **actuals.tokens:** 16458，按 chars/4 估算，新增行 65833 字符（`git diff d2826bb..HEAD` 的 `+` 行）

## 规模说明

计划估算 150k，超过 100k 的建议线。仍然是一个计划、三个任务，原因照计划的「规模」段：三个任务各自独立提交、各自定向运行；拆成两个计划会让第二个计划在第一个的半成品记录区上开工（Task 2、3 都要在 Task 1 的 flErrs / flHint / flSave 上继续写）。实际改动约 16.5k tokens，远低于估算，原因同 15-01：用 `sed` 取片段和定向运行，没有整段读取应用文件。

## Accomplishments

- **逐字段错误（Task 1）：** `T_FL_ERR` 九条；`flErrs()` 把 `workoutProblems` 的键映射到输入框（点过保存或字段失焦过才显示，同一行两个错误只写重量那条，输入合法立刻消失，不重画整块）；保存有问题时焦点到第一个出错的输入框并 `scrollIntoView`。
- **保存栏提示（Task 1、3）：** `flHint()` 按优先级只写一条，最终六档：1 点过保存但校验没过（error）> 2 草稿有内容且这一天在别的设备上更新过（warn）> 3 有没保存的内容（muted）> 4 断网 / 连不上，状态行 `data-state` 为 offline、retrying、unreachable、slow（warn，不挡保存）> 5 草稿空且这一天没保存过 > 6 已保存没有改动。保存按钮的 `aria-disabled` 只看「草稿空且没保存过」或「已保存且没改动」，与显示哪一档无关，点击直接返回，不弹 toast、焦点不丢。
- **同一天合并和删除（Task 1）：** 打开已有训练的日子载入已保存的各组，状态行写 `T_FL_STATE_SAVED`；保存是 `commit(["wo:"+date], s=>woPut(s,date,day))` 整天覆盖，所以 state 里始终只有一个日期键。`flDelete()` 不弹确认，toast 带「撤销删除」（6000 ms），撤销用同一个键 `woPut(s,date,gone)` 写回，撤销之后不再弹 toast，只写 `#fl-live`。
- **组和动作（Task 1、2）：** 复制上一组（随输入实时开关的真 disabled）、删一组和移除动作（块里有内容才弹撤销 toast，5000 ms；撤销只改草稿，闭包里带日期，换了日期就什么都不做）、20 组上限、焦点规则按 UI-SPEC（删一组 → 下一行重量框，没有就上一行，再没有就「＋ 添加一组」）。
- **参考行和照上次填（Task 2）：** 纯函数段新增 `liftLast(s,id,before)`，只取日期严格早于所选日期的最近一天；表单不自动预填，「照上次填」只在有上次、且这个动作所有组都空时出现，输入后消失。
- **有氧行和空状态（Task 2）：** `activeCardio()`；有氧行时长必填、距离选填、整块空报错；归档的力量项和有氧项在旧训练里带「已归档」小标记；芯片行、各分区的空状态文案、计划里什么都没有时整个记录区换成一行说明；「去编辑计划添加动作」只在 `CLOUD&&me` 渲染（带 id 的只有一个）。
- **放弃、换日期（Task 2、3）：** 放弃和换日期都走 `confirmBox`，取消键默认有焦点；`flSwitch(date)` 供日期框和 `goWo` 共用，拒绝时日期框恢复原值，切标签不确认。
- **草稿保护（Task 3）：** 见下面两节。

## 草稿不算 busy 的决定和验证

决定：`isBusy` 没有加任何条件，只在它上方补了一句注释。远端更新照常应用（`applyView` → `renderKeep` → `renderAll` → `renderFit(false)`），由 `flBusy()` 让记录区自己跳过重画；这样健身房里一直开着的草稿不会把所有远端更新挡在「现在更新」横幅后面。数字框和日期框有焦点时 `isBusy` 本来就为真，远端更新先等着。

验证：
- 云端用例 `FIT-02 an unsaved draft survives a remote update and a reload ...`：设备 A 填一组（不保存、焦点移开），设备 B 保存同一天；A 的本周页出现 B 的训练行（更新已应用），A 的记录区那一组还在，提示行是第 2 档（`data-tone="warn"`），保存仍可用。
- `logout`、`remote-update`、`reconcile-gate`、`fitness-sync` 的全部现有用例照常通过（36 条，0 失败），草稿不算 busy 没有改变它们的行为。

## 本机留底的形状和恢复检查

- **形状：** `localStorage["usj:v2:<用户 id>:wodraft"] = {date, draft}`，`draft` 是 `{lifts:[{id,sets:[{w,r}]}], cardio:[{id,m,d}]}`，值都是输入框里的字符串。只在 `CLOUD&&me` 时写；草稿每次变化（输入、结构变化）500 ms 防抖后写入，草稿回到和已保存相同时删掉。
- **清掉的时机：** 保存、删除整次训练、放弃、确认换日期；退出登录（`logout` 的清理列表）和换账号（登录页的清理列表）两处都加了 `"wodraft"`（源码里 `"importundo","wodraft"` 恰好 2 处）；`resetSession` 里 `clearTimeout`、`fl=null`、`flRestoreDone=false`。
- **恢复：** `flTryRestore()` 在登录后 state 读进来（`docs.state` 有了）第一次画健身页时看一眼，每个会话只看一次。`flRestore()` 先检查：`date` 是真实日期且不晚于今天、`draft.lifts` 和 `draft.cardio` 是数组且各不超过 64 项、力量项 id 过 `LIFT_ID_RE`、有氧项 id 过 `CARDIO_ID_RE` 且同类里不重复、每个动作最多 20 组、每个值是不超过 20 字的字符串；不合格直接删掉，合格但和已保存内容一样也删掉。合格的才载入，`#fl-state` 写 `T_FL_STATE_RESTORED`；恢复的草稿仍要过 `workoutProblems` 才能保存，渲染一律 `esc()`（T-15-06）。
- **beforeunload：** 现有 `planDirty()&&!swGo` 那一行旁边加了 `flDirty()&&!swGo`，恰好 1 处。

## 定向运行结果

默认套件（`npm test -- --workers=1`，低优先级包装）：

| 运行 | 内容 | 结果 |
|------|------|------|
| Task 1 | tests/e2e/fitness、app-integrity、escaping | 20 条，0 失败（`REPORT OK expected=20 flaky=0 unexpected=0`） |
| Task 2 | 同上，加 4 条本地用例 | 24 条，0 失败（`REPORT OK expected=24`） |
| Task 3 | tests/e2e/fitness、tests/e2e/week、app-integrity、escaping | 51 条，0 失败（`REPORT OK expected=51 flaky=0 unexpected=0`；其中 3 条 BUG-01 的 expected-fail 是原本的已知缺陷标记，不算失败） |

cloud 套件（`npm run test:cloud -- --workers=1`，低优先级包装）：

| 运行 | 内容 | 结果 |
|------|------|------|
| Task 2 | fitness-log、fitness-sync、plan-editor | 11 条，0 失败（`REPORT OK expected=11`） |
| Task 3 | fitness-log、fitness-sync、logout、remote-update、reconcile-gate | 36 条，0 失败（`REPORT OK expected=36 flaky=0 unexpected=0`） |

两个完整套件按计划在 15-07 的最后一个任务各跑一次，本计划没有跑。

## 本计划新增的用户可见文案（交给 Phase 16 总体验收由所有者过目）

以下全部逐字取自 15-UI-SPEC 的 Copywriting Contract，并镜像在 `tests/support/strings.ts`（来源常量名写在注释里）：

| 常量 | 文案 |
|------|------|
| `T_FL_STATE_SAVED` / `T_FL_STATE_RESTORED` | 这一天已经记过训练，改动保存后会更新。 / 已恢复上次没保存的内容。 |
| `T_FL_DELETE` / `T_FL_DELETED` / `T_FL_UNDO_DEL` | 删除这次训练 / 已删除 {M月D日} 的训练 / 撤销删除 |
| `T_FL_LIVE_UNDONE`（读屏） | 已撤销：{原文} |
| `T_FL_COPY` / `T_FL_FILL_LAST` | 复制上一组 / 照上次填 |
| `T_FL_HINT_DIRTY` / `T_FL_HINT_EMPTY` / `T_FL_HINT_SAVED` | 有没保存的内容 / 先添加动作或有氧项，再保存 / 已保存 |
| `T_FL_HINT_REMOTE` / `T_FL_HINT_OFFLINE` | 这一天的训练刚在别的设备上更新了。保存会覆盖它；想先看新版，就放弃未保存的内容。 / 现在没有网络，训练会先存在这台设备上，联网后自动同步。 |
| `T_FL_ERR` 九条 | 请填写重量，徒手动作填 0 / 重量要在 0 到 1000 之间 / 请填写次数 / 次数要是 1 到 999 之间的整数 / 这个动作还没有记录任何一组，填一组或移除这个动作 / 最多 20 组 / 请填写时长（分钟） / 时长要是 1 到 1440 之间的整数 / 距离要大于 0，不超过 1000 |
| `T_FL_DEL_SET` / `T_FL_DEL_SET_ARIA` | 删除 / 删除{名称}第 {n} 组 |
| `T_FL_SET_DELETED` / `T_FL_LIVE_SET_DELETED` | 已删除第 {n} 组 / 已删除{名称}第 {n} 组 |
| `T_FL_SET_LIMIT` | 最多 20 组 |
| `T_FL_LAST` / `T_FL_LAST_MORE` / `T_FL_LAST_NONE` / `T_FL_BW` | 上次（{M月D日}）：{各组} / …共 {n} 组 / 还没有这个动作的训练记录。 / 徒手 |
| `T_FL_RM_LIFT` / `T_FL_RM_CARDIO` | 移除这个动作 / 移除这个有氧项 |
| `T_FL_REMOVED` / `T_FL_UNDO_RM` | 已移除：{名称，超过 10 字截断加…} / 撤销移除 |
| `T_FL_DISCARD` 和确认框 | 放弃未保存的内容；放弃没保存的内容？ / 这次训练填的内容还没有保存，放弃后会恢复成上次保存的样子。 / 继续填写 / 放弃内容 |
| `T_FL_CF_DATE_T` 和确认框 | 换一天记录？ / 这次训练填的内容还没有保存，换日期会丢掉。 / 先不换 / 丢掉并换日期 |
| 有氧分区 | 有氧；点一下有氧项，加进这次训练；目标 每次 {n} 公里 / 目标 每次 {n} 分钟；时长（分钟）；距离（公里，选填）；已归档（小标记，复用 `T_ARCH_MARK`） |
| 空状态 | 计划里还没有力量项。 / 计划里还没有有氧项。 / 计划里的力量项都已加进这次训练。 / 计划里的有氧项都已加进这次训练。 / 计划里还没有力量项和有氧项，先去编辑计划添加动作，才能记录训练。 / 去编辑计划添加动作 |

### UI-SPEC 之外新增的文案（需要所有者特别确认）

文案常量都在 Copywriting Contract 里，下面这几处只是把已有文案用在了合同没明确写的读屏播报上，只读屏用户听得到，界面上看不到：

| 位置 | 文案 | 说明 |
|------|------|------|
| `#fl-live`：加有氧项后 | 已添加动作：{有氧项名称} | 复用 `T_FL_LIVE_ADDED`，合同只写了力量动作的播报，有氧项这里也说「动作」 |
| `#fl-live`：删除整次训练后 | 已删除 {M月D日} 的训练 | 复用 `T_FL_DELETED`（toast 是 6000 ms 会消失，读屏需要一条常驻播报） |
| `#fl-live`：移除动作或有氧项后（含块里没内容、不弹 toast 的情况） | 已移除：{名称} | 复用 `T_FL_REMOVED` |
| `#fl-live`：撤销删除一组、撤销移除之后 | 已撤销：已删除第 {n} 组 / 已撤销：已移除：{名称} | 合同只写「已撤销：…」，这里用「已撤销：」加原来那条文案拼成 |

## UI-SPEC 的 backstop 项（交给 Phase 16 总体验收，真机核对）

- **375 px 下组行：** 「序号 + 重量 + × + 次数 + 删除」一行放得下，两个输入框各约 80 px 能放下 `122.5` 和 `999`（CSS 骨架里窄屏是 `24px minmax(0,1fr) 16px minmax(0,1fr) 44px`，本计划给每行补上了「删除」按钮，用例只在桌面视口验证过没有被挤坏）。
- **虚拟键盘：** 20 组时页面可以滚动、底部保存栏不被虚拟键盘盖住；`scrollIntoView({block:"center"})` 在真机虚拟键盘弹出时的效果。
- **触控：** ≤560px 所有按钮、输入框、芯片 44 px 高（样式是 15-01 的 CSS 骨架，本计划新增的按钮都套用了它）。
- **手指按住按钮时的错误显示：** `flPtr` 的写法用 pointer 事件，用例用的是鼠标；真机手指点按「保存训练」时，字段失焦不应该把按钮挤走。
- **系统回收页面后恢复：** 在健身房切应用、页面被系统回收后重新打开，`wodraft` 能把已填的组带回来（用例只覆盖了刷新）。
- **`beforeunload`：** 手机浏览器不保证弹出离开提示（同编辑计划页的 12 D-09，所有者已接受）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 字段失焦时错误行把按钮挤走，这一下点击丢了**
- **Found during:** Task 1（tracer 用例里「清空次数后点保存」没有保存、也没有聚焦）
- **Issue:** 点「保存训练」时，鼠标按下先让次数框失焦，focusout 立刻显示错误行，保存栏被挤到下面，抬起时已不在按钮上，`click` 没有触发。真机上手指点按也会这样
- **Fix:** 记录区里按下按钮（`pointerdown`）期间字段失焦只记进 `fl.seen`，不立刻显示错误；`pointerup` 之后（点击处理完，`setTimeout 0`）再补显示。保存本身会设 `fl.tried` 并显示全部错误
- **Files modified:** us-journey-tracker.html
- **Commit:** 6645a2a

**2. [Rule 1 - Bug] 焦点在记录区里时 renderAll 跳过重画，焦点离开后表单一直是旧版**
- **Found during:** Task 3（设计 flBusy 时的推演）
- **Issue:** 草稿没有内容、焦点停在记录区里（例如保存之后停在「已保存」按钮上）时，别的设备改了这一天，renderAll 因为焦点在里面跳过重画，焦点离开后也没有人补画
- **Fix:** `#fl` 的 `focusout`：草稿没有内容、焦点移到记录区外、而这一天已保存的版本和 `fl.base` 不同时，按新版重画
- **Files modified:** us-journey-tracker.html
- **Commit:** ce881bf

### 计划之外的补充和取舍

**3. [Rule 2 - 缺失的关键行为] 草稿清空后在已保存的一天上点「保存修改」**
- 保存栏按钮此时可用（草稿和已保存的不同），`woFromDraft` 得到空的一天，`woPut` 等同 `woDel`。直接存会悄悄丢掉整天且没有撤销，所以改成走 `flDelete()`（带「撤销删除」toast）。**Commit:** 6645a2a

**4. 提示行第 3 档的圆点：** 计划正文写「无 tone」，UI-SPEC 的表写圆点 muted，按 UI-SPEC 用 `data-tone="muted"`（`#fl-hint[data-tone]::before` 已有这条 CSS）。**Commit:** 6645a2a

**5. `flBusy` 写成函数声明：** 计划 verify 的静态检查按字面找 `function flBusy(`，所以不是 `const flBusy=()=>…`。**Commit:** ce881bf

**6. `goWo` 变成 `async`：** 它要 `await flSwitch(date)`，先 `showTab("fit")`（草稿有内容时 `showTab` 不会重载），拒绝换日期时留在健身页原来的日期；现有的两处委托调用不 await 返回值，行为不变。**Commit:** ce881bf

**7. 恢复的触发点：** 计划写「renderFl 在 fl 为空时恢复」。实际 `renderAll` 在登录前就会画一次健身页（`fl` 已经建成「今天」，`me` 和 `state` 还没有），所以改成 `flTryRestore()`：登录后 `docs.state` 有了第一次 `renderFit` 时看一眼，每个会话一次；这样 `orig` 和 `base` 是用读进来的 state 算的。**Commit:** ce881bf

**8. 测试用例的两处写法取舍：** 对账门控用例用了有两个力量项的计划（保存第一个之后，芯片行里还有第二个，才有 `[data-fl-add]` 可以验证真 disabled）；`FIT-02 recording again ...` 里「半填没有保存」用 700 ms 的等待覆盖保存防抖（`app.saved()` 在没有写入时返回 null）。

### 计划里的数目对不上

计划在「Artifacts」表里写「5 条新本地用例」，实际新增本地用例 6 条（tracer 1 + Task 2 的 4 条 + Task 3 的 1 条）加 1 条纯函数边界单元用例；云端 3 条。

**Total deviations:** 2 auto-fixed bugs（blur 挤走点击、焦点在里面时跳过重画不补画），1 个缺失行为补上（空草稿保存即删除），5 个取舍。**Impact:** 没有范围蔓延；现有 logout、remote-update、reconcile-gate、fitness-sync、week、escaping 用例一行没改。

## Authentication Gates

无。

## Known Stubs

无。

## Threat Flags

无新增的网络端点、认证路径或信任边界。T-15-06（wodraft 恢复的形状检查，不合格删掉）、T-15-07（wodraft 进两处清理列表、`resetSession` 清 `fl`，云端用例证明退出后键不在了）、T-15-09（20 组上限：按钮禁用 + `workoutProblems` 的 slimit + 恢复时的组数检查）已按计划缓解并有用例；T-15-08 为 accept（最后保存为准，第 2 档提示，两台设备同时改的用例在 15-07）；每次提交前隐私检查通过。

## Next Phase Readiness

记录区完整。15-03 可以直接在 `#tab-fit` 的 `#fw`、`#fc` 上做本周训练和趋势图；`liftLast` 和 `woMap` 已在纯函数段，可以直接 `loadAppPure`。15-07 要补的是两台设备同时改同一天的用例，并在最后跑两个完整套件和勾选 FIT-01 到 FIT-05。

## Self-Check: PASSED

- 新增文件存在：`tests/cloud/fitness-log.spec.ts`；`tests/e2e/fitness/log.spec.ts`、`tests/support/fitness.ts` 已更新
- 提交都在当前分支：6645a2a（Task 1）、a3df042（Task 2）、ce881bf（Task 3）
- 三个任务的 `<verify>`（静态检查、cloud 定向运行、默认套件定向运行、暂存后的隐私检查）都通过；`style="` 仍为 0，五个纯函数标记各恰好一次，`APP_SHA256` 已重新记录
