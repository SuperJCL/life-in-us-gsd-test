---
phase: 15-fitness-tab
plan: 01
subsystem: fitness-tab
tags: [workouts, cardio, normalize, commit-wo-key, fitness-tab, tracer, playwright, playwright-cloud]

requires:
  - phase: 14-plan-onboarding
    provides: emptyPlan、planUsedIds、pickSample、示例计划 DEFAULT_PLAN、云端同步骨架
  - phase: 12-plan-editor
    provides: normalizePlan 的力量项写法、编辑计划页（编辑计划页打开时 #tab-fit 也要隐藏）
provides:
  - 第五个标签「健身」（data-tab=fit）和 #tab-fit 外壳、UI-SPEC 的整段 CSS 骨架、门控属性 [data-wo] / [data-fit-ro] / [data-fl]
  - state.workouts 数据形状（按日期为键，一天一条）、同步键 wo:<日期>、纯函数 woMap / woPut / woDel / woFromDraft / workoutProblems / woSummary
  - normalize 的 workouts 段（非空才输出）、importProblem 的 "workout"、LEGACY_KEYS.workouts
  - 计划里可选的 cardio（r- 前缀 id、每次目标）、DEFAULT_PLAN 的三个示例有氧项、emptyPlan / planUsedIds 的有氧处理
  - 记录区最小完整路径：选力量项、记一组、保存训练、刷新读回、本周页「健身」行、点行回到健身页那一天
affects: [15-02 记录区其余交互, 15-03 本周训练和趋势图, 15-04 力量目标卡搬家, 15-05 日历时间线导入导出, 15-06 编辑页和示例挑选的有氧项, 15-07 收尾, Phase 16 上线顺序]

actuals:
  tokens: 14600
  tasks: 2
  commits: 2

plan_head_before: 9721123c3d72fee223c4413d9c27ec7c997a9682
plan_head_after: 4c9ad19854016169c1e06d48c196043ed1622958

tech-stack:
  added: []
  patterns:
    - "训练写入只走 commit([\"wo:\"+date], s=>woPut(s,date,day))：fn 整天覆盖、闭包带深拷贝、幂等、只碰这一天；键只是触及标记，合并靠重放"
    - "normalize / normalizePlan 对新字段「非空才输出」：旧用例的深度相等比较一行不改；读它们一律经 woMap(s) / planCardio(p)"
    - "记录区草稿：fl={date,draft,orig}，draft 是输入框里的字符串，orig 是载入时的 JSON；renderAll 经 renderFit(false) 在草稿有未保存内容或焦点在记录区时不重画"
    - "训练行不是文字记录：eventsOn 带 wo，不进 logs，没有 data-edit、不可拖动，点击经 document 捕获委托的 [data-wo] 分支进 goWo"

key-files:
  created:
    - tests/support/fitness.ts
    - tests/e2e/fitness/log.spec.ts
    - tests/e2e/fitness/workouts-data.spec.ts
    - tests/cloud/fitness-sync.spec.ts
  modified:
    - us-journey-tracker.html
    - tests/support/strings.ts
    - tests/support/constants.ts
    - tests/cloud/plan-editor.spec.ts
    - tests/e2e/data/plan-normalize.spec.ts

key-decisions:
  - "state.workouts[<YYYY-MM-DD>]={lifts:[{id,sets:[{w,r}]}],cardio:[{id,m,d?}]}，一天一条；同步键 wo:<日期>，写入整天覆盖"
  - "normalize / normalizePlan 只在非空时输出 workouts / cardio，不是总输出空键：v1 的 154 条、IO-03、conflict-snapshot 的键列表、迁移脚本自检都不用改"
  - "有氧 id 用 r- 前缀（CARDIO_ID_RE），示例有氧项冻结为 r-run、r-bike、r-walk；不用裸字母，免得和力量 id 同形"
  - "不做通用的未知键保留：保留未知键救不了已部署的旧页面，反而削弱 SEC-01 白名单；旧页面丢键的风险按 accept 登记，交给 Phase 16 的上线顺序"

requirements-completed: []
requirements-advanced: [FIT-01, FIT-02, FIT-04, FIT-05]

coverage:
  - id: D1
    description: "第五个标签「健身」：排在时间线之后，点它 #tab-fit 显示、其余四个视图隐藏，编辑计划页打开时它也隐藏"
    requirement: "FIT-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 a set recorded on the fitness tab is saved for today, shows as a fitness row in the week view and reopens from that row after a reload (D-05, D-06)"
        status: pass
      - kind: e2e
        ref: "tests/e2e/smoke.spec.ts#MOCK-01 opens in local mode without window.claude and switches all four tabs"
        status: pass
      - kind: e2e
        ref: "tests/cloud/plan-editor.spec.ts#PLAN-04 a group renamed in the plan editor is saved to the server and another device shows the new name (D-10)"
        status: pass
    human_judgment: true
    rationale: "375 px 下五个标签放得下、标签栏窄屏样式的观感由 15-07 的窄屏用例和 Phase 16 总体验收确认"
  - id: D2
    description: "tracer：在健身页点「＋ 卧推」、记一组 20 × 8、保存训练，state.workouts 恰好是当天一条，logs 一条不多；本周页当天多一行「健身 · 卧推（共 1 组）」，刷新后仍在，点它回到健身页那一天"
    requirement: "FIT-02"
    verification:
      - kind: e2e
        ref: "tests/e2e/fitness/log.spec.ts#FIT-02 a set recorded on the fitness tab is saved for today, shows as a fitness row in the week view and reopens from that row after a reload (D-05, D-06)"
        status: pass
    human_judgment: false
  - id: D3
    description: "云端 tracer：训练按 wo:<日期> 上传，服务器 state 文档的 workouts 等于写入值，同账号第二台设备的本周页有同一行"
    requirement: "FIT-05"
    verification:
      - kind: e2e
        ref: "tests/cloud/fitness-sync.spec.ts#FIT-05 a training saved on the fitness tab is uploaded under its per-day key and shows in the week view of another device of the same account"
        status: pass
      - kind: e2e
        ref: "tests/cloud/offline-sync.spec.ts#SYNC-03 the pending count counts each changed item once"
        status: pass
    human_judgment: false
  - id: D4
    description: "workouts 的 normalize（合格恒等、坏组坏条目坏天各自丢掉、重复 id 只留第一条、空的不输出键）、importProblem 的 workout、旧格式识别"
    requirement: "FIT-05"
    verification:
      - kind: unit
        ref: "tests/e2e/fitness/workouts-data.spec.ts#FIT-05 normalize keeps well-formed workouts unchanged, repairs bad values without dropping the day and leaves out an empty workouts map"
        status: pass
      - kind: unit
        ref: "tests/e2e/fitness/workouts-data.spec.ts#FIT-05 importProblem rejects workouts with a bad date key or a malformed lift or cardio id and accepts empty and well-formed ones"
        status: pass
    human_judgment: false
  - id: D5
    description: "woSummary（本周行的文字）、woPut / woDel 的幂等和只碰这一天、woFromDraft、workoutProblems"
    requirement: "FIT-04"
    verification:
      - kind: unit
        ref: "tests/e2e/fitness/workouts-data.spec.ts#FIT-04 woSummary names at most three lifts and two cardio items with the set total and counts the rest"
        status: pass
      - kind: unit
        ref: "tests/e2e/fitness/workouts-data.spec.ts#FIT-02 a whole-day workout write is idempotent and only touches its own date, and removing the last day drops the workouts key"
        status: pass
    human_judgment: false
  - id: D6
    description: "计划里可选的 cardio 和三个冻结 id 的示例有氧项，空计划没有有氧项，planUsedIds 含有氧 id"
    requirement: "FIT-01"
    verification:
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-05 normalizePlan accepts optional cardio items with r- ids and a per-session target and rejects malformed or duplicate ones (D-02)"
        status: pass
      - kind: unit
        ref: "tests/e2e/data/plan-normalize.spec.ts#PLAN-05 the sample plan carries the frozen cardio ids r-run, r-bike and r-walk and the empty plan has no cardio (D-02, 14 D-01)"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-11-13
status: complete
---

# Phase 15 Plan 01: 健身页 tracer 和数据模型 Summary

**第五个标签「健身」上线最细的一条完整路径：记一组、「保存训练」经 `commit(["wo:"+date])` 写进按日期的 `state.workouts`，本机和服务器都拿到，刷新后读回，本周页出现「健身 · 卧推（共 1 组）」一行，点它回到健身页那一天；同时一次定下训练和有氧项的数据形状、校验、导入白名单。**

## Performance

- **Duration:** 约 35 分钟
- **Tasks:** 2（Task 1 为 tracer，Task 2 为 auto）
- **Files:** 9 个（4 个新增，5 个修改）
- **Commits:** 2 个任务提交，measured：`git rev-list --count 9721123..4c9ad19` = 2

## 规模说明

计划估算 130k，超过 100k 的建议线。仍然保持一个计划、2 个任务，原因：tracer 必须在同一次提交里穿过数据（workouts 形状和 normalize）、写入（flSave 与 woPut）、同步（wo:<日期> 键、云端上传和第二台设备）、渲染（记录区和本周行）和其他视图（eventsOn、门控、点回健身页）五层，拆开就失去「一条最细路径先打通」的意义；数据模型的其余部分（importProblem、LEGACY_KEYS、计划 cardio、示例有氧项）都是纯函数段里的小改动，和单元用例一起放在 Task 2。实际改动按 chars/4 估算约 14.6k tokens（新增行 58293 字符），远低于估算；估算偏高的原因是按「应用文件整段读取加多轮回归」计，实际用了 `sed` 取片段和定向运行。

## Accomplishments

- **标签和外壳：** 标签栏多出「健身」（排在时间线之后），`#tab-fit` 含 `h2.sr-only`、`section#fl`、`#fl-live`、`#fc-live`；`showTab` 数组加 `"fit"`，切到健身页时 `renderFit(true)`；UI-SPEC 的整段 CSS 骨架放进 `</style>` 之前（改写了首行注释，应用内 `style="` 仍为 0）；`GATE_ALLOW` 加 `[data-wo],[data-fit-ro]`、`GATE_BLOCK` 加 `[data-fl]`。
- **数据形状：** `state.workouts[YYYY-MM-DD]={lifts:[{id,sets:[{w,r}]}],cardio:[{id,m,d?}]}`，同步键 `wo:<日期>`；`WO_MAX={sets:20,w:1000,r:999,m:1440,d:1000}`；`CARDIO_ID_RE=/^r-[A-Za-z0-9_-]{1,40}$/`。
- **纯函数（都在纯函数段里，`loadAppPure` 可直接求值）：**
  - `woMap(s)`：`s.workouts` 不是对象就当 `{}`
  - `planCardio(p)`：`p.cardio` 不是数组就当 `[]`
  - `woPut(s, date, day)`：两个数组都空等同 `woDel`；否则 `s.workouts` 不是对象先建成 `{}`，再把这一天整个换成 `day` 的 JSON 深拷贝；只读写参数、不碰 DOM、不调 persist
  - `woDel(s, date)`：删掉这一天，删到最后一天时连 `workouts` 键一起去掉
  - `woFromDraft(d)`：草稿（字符串）转成要保存的一天，整行空的组丢掉、没有组的动作丢掉、保持顺序、`Math.round(Number(v+"e2"))/100` 取两位（22.555 存成 22.56，直接 `*100` 会得到 22.55 的浮点陷阱，所以走指数写法）
  - `workoutProblems(d)`：返回 `[{key,code}]`，key 为 `fl:<动作>:<组>:w|r`、`fl:<动作>:ex`、`fc:<有氧>:m|d`，code 为 `wnone/wrange/rnone/rint/exnone/slimit/mnone/mint/drange`
  - `woSummary(day, plan)`：S9 的一行文字
- **normalize：** workouts 段照 lifts 段写法，合格数据恒等；只在非空时输出 `workouts`（`...(Object.keys(wo).length?{workouts:wo}:{})`）。
- **记录区最小路径：** `fl` 会话、`flDraftOf` / `flOpen` / `renderFl` / `renderFit` / `flSave` / `goWo`；芯片行加动作、`＋ 添加一组`、重量和次数输入框、保存按钮的 `aria-disabled`。
- **其他视图：** `eventsOn` 带 `wo`；本周页日期列追加 `.ent.wo.k-fit[data-wo]`（不可拖动、没有 data-edit），点击和 Enter / Space 经 document 捕获委托进 `goWo`，不触发本周列的 pickDay。
- **数据模型收尾：** `importProblem` 的 `"workout"`、`LEGACY_KEYS.workouts`、`normalizePlan` 的可选 cardio、`DEFAULT_PLAN` 的三个示例有氧项、`emptyPlan` 的 `s.cardio=[]`、`planUsedIds` 含有氧 id。
- **测试：** 本地 tracer、云端 tracer（含第二台设备）、6 条纯函数单元（计划写 4 条，另加 1 条 `workoutProblems`）加 plan-normalize 的 2 条有氧用例；`tests/support/fitness.ts` 的共用操作；plan-editor 用例的数组加 `'fit'`。

## 「非空才输出」的决定

`normalize` 的返回值是固定形状，现有用例大量做深度相等比较。总是输出 `workouts:{}` 会让下面这些旧用例因为多一个空键而红；只在非空时输出，它们一行没改，定向运行全部通过：

- `tests/e2e/io/export.spec.ts` 的 IO-03（备份 state 与 fixture 深度相等）
- `tests/cloud/conflict-snapshot.spec.ts` 的留底文件键列表
- `tests/cloud/login.spec.ts` 的 PLAN-01（空计划逐字比较，`normalizePlan` 对 `cardio` 用同一规则）
- 迁移脚本自检 IO-09、`tests/e2e/data` 整个目录、v1 的旧用例

代价是读 `state.workouts` 的代码一律经 `woMap(s)`、读有氧项一律经 `planCardio(p)`，写入一律经 `woPut` / `woDel`。

## 旧页面丢键的风险（T-15-04，accept，交给 Phase 16）

已部署的 Phase 14 版本加载含 `workouts` / `cardio` 的数据时，`normalize` / `normalizePlan` 会丢掉这两个键，随后保存就会冲掉它们。**这是接受的风险**：风险来自旧代码，新代码改不了它；通用的「保留未知键」救不了已部署的旧页面，反而会削弱 SEC-01 的白名单；本阶段只在本机开发，线上只有测试账号。Phase 16 的 ROADMAP 备注（提交 dcb9a0f）已经带上上线前提：**所有设备都换成新版本之后，才记第一条训练、才迁移真实数据。**

## 定向运行结果

默认套件（`npm test -- --workers=1`，低优先级包装）：

| 运行 | 内容 | 结果 |
|------|------|------|
| Task 1 | log.spec、app-integrity、escaping、smoke、week 目录 | 44 条，0 失败（`REPORT OK expected=44 flaky=0 unexpected=0`；其中 3 条 BUG-01 的 expected-fail 用例是原本的已知缺陷标记，不算失败） |
| Task 2 | workouts-data.spec、`tests/e2e/data`、state-validation、id-whitelist、export、app-integrity | 47 条，0 失败 |

cloud 套件（`npm run test:cloud -- --workers=1`，低优先级包装）：

| 运行 | 内容 | 结果 |
|------|------|------|
| Task 1 | fitness-sync、plan-editor、offline-sync | 26 条，0 失败 |
| Task 2 | login、plan-onboarding、conflict-snapshot、migration | 41 条，0 失败 |

两个完整套件按计划在 15-07 的最后一个任务各跑一次，本计划没有跑。

## 本计划新增的用户可见文案（交给 Phase 16 总体验收由所有者过目）

以下全部逐字取自 15-UI-SPEC 的 Copywriting Contract，并镜像在 `tests/support/strings.ts`（来源常量名写在注释里）：

| 常量 | 文案 |
|------|------|
| 标签 | 健身（静态 HTML）；`h2.sr-only` 同名 |
| `T_FL_TITLE_TODAY` / `T_FL_TITLE_DAY` | 今天的训练 / `{M月D日}的训练` |
| `T_FL_DATE` | 日期 |
| `T_FL_SEC_LIFT` | 力量 |
| `T_FL_CAP_LIFT` | 点一下动作名，加进这次训练 |
| `T_FL_ADD_SET` | ＋ 添加一组 |
| `T_FL_SAVE` / `T_FL_SAVE_EDIT` | 保存训练 / 保存修改 |
| `T_FL_SAVED`（toast 和读屏） | 训练已保存 |
| `T_FL_TARGET` | 目标 {target} {unit} |
| `T_FL_COL_W` / `T_FL_COL_R` | 重量（{unit}） / 次数 |
| `T_FL_LBL_W` / `T_FL_LBL_R`（读屏标签） | {名称}第 {n} 组重量（{unit}） / {名称}第 {n} 组次数 |
| `T_FL_ADD_ARIA` | 添加动作：{名称}（芯片文字是 `＋ {名称}`） |
| `T_FL_LIVE_ADDED`（读屏） | 已添加动作：{名称} |
| `T_FIT_ROW` / `T_FIT_ROW_ARIA` | 健身 · {摘要} / 打开健身页查看这次训练：{摘要} |
| `woSummary` 的片段 | 、 / 等 {n} 项 / （共 {s} 组） / {名称} {m} 分钟 / （{d} 公里） / 用 ` · ` 连接两段 |
| 复用 `T_PE_HINT_ERRORS` | 有 {n} 处需要修改，已标在对应位置（点保存但校验没过时显示在 `#fl-hint`） |

### UI-SPEC 之外新增的文案（需要所有者特别确认）

| 常量 | 文案 | 出现的条件 |
|------|------|-----------|
| `T_FIT_GONE_L` | 已删除的力量项 | 训练里的力量项 id 在计划里找不到（计划里被彻底删除，或只含计划的导入、离线重放遇到别的设备已删） |
| `T_FIT_GONE_C` | 已删除的有氧项 | 同上，有氧项 |

另有一处不是文案、但会显示在界面上的回退：训练里引用的力量项在计划里找不到时，记录区的单位暂用 `kg`（计划里有它才用它自己的单位），目标不显示。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 现有用例对 `planUsedIds` 大小的断言要跟着计划的要求改**
- **Found during:** Task 2
- **Issue:** 计划要求 `planUsedIds` 含有氧 id，`tests/e2e/data/plan-normalize.spec.ts` 里已有的 PLAN-07 pickSample 用例断言 `planUsedIds(DEFAULT_PLAN).size` 是 `7 + 任务数 + 4`，示例计划多了 3 个有氧项后该数变成 `+ 3`
- **Fix:** 断言改成 `7 + totalTasks + 4 + 3`，注释写明「含有氧项」；该文件本来就在 Task 2 的文件清单里
- **Files modified:** tests/e2e/data/plan-normalize.spec.ts
- **Commit:** 4c9ad19

**2. [Rule 1 - Bug] 本周行的 `›` 被 `.ent span{flex:1}` 拉伸**
- **Found during:** Task 1
- **Issue:** UI-SPEC 的 `.wo-go{...margin-left:auto}` 优先级低于现有的 `.ent span{flex:1;min-width:0}`，`›` 会和文字平分宽度
- **Fix:** 选择器写成 `.ent .wo-go,.wo-go{...;flex:none}`；其余 CSS 骨架逐字照搬
- **Files modified:** us-journey-tracker.html
- **Commit:** 5127af8

### 计划之外的补充

**3. [Rule 2 - 缺失的关键验证] 多写了一条 `workoutProblems` 的单元用例**
- **Issue:** 计划的 4 条单元用例没有直接覆盖 `workoutProblems`（校验规则和键的约定 15-02 要用）
- **Fix:** 在 `tests/e2e/fitness/workouts-data.spec.ts` 加第 5 条 `FIT-02 workoutProblems reports half-filled rows, out-of-range values and empty blocks in page order with the agreed keys`
- **Commit:** 4c9ad19

### 实现时定下的小决定（不算偏离，记在这里给后面的计划）

- `renderFit(force)`：`renderAll` 传假值，草稿有未保存内容或焦点在 `#fl` 里时不重画记录区；`showTab`、`goWo`、`flSave` 传真值强制重画。没有未保存内容时，`renderFl` 会按 state 重新载入当天内容（别的设备改了当天训练能反映出来）。
- `flDraftOf` 对力量项 id、有氧项 id 各过一次 `LIFT_ID_RE` / `CARDIO_ID_RE`（id 写进 `data-*`、元素 id 之前先过正则，T-15-02）。
- `flSave` 校验没过时只写 `#fl-hint` 的汇总句并把焦点放到第一个出错的输入框；逐字段错误文字、`#fl-state` 的两句话、保存栏提示的六档优先级、放弃和删除按钮、换日期确认都留给 15-02（本计划的 `#fl-state`、`#fl-hint` 平时是空的）。
- 本计划没有 TDD 的单独红灯提交：任务虽然标了 `tdd="true"`，用例是和实现一起写的，第一次运行就全绿，所以 git 历史里是每个任务一次 `feat` 提交，没有先红后绿的拆分。

**Total deviations:** 2 auto-fixed（1 个旧用例断言跟随、1 个 CSS 优先级），1 个计划之外的补充用例。**Impact:** 没有范围蔓延；现有 v1 用例和其他 cloud 用例一行没改。

## Authentication Gates

无。

## Known Stubs

无会妨碍本计划目标的占位。`#fl-state`、`#fl-hint` 平时为空、保存栏只有一个按钮，是计划里明确留给 15-02 的部分，不是占位数据。

## Threat Flags

无新增的网络端点、认证路径或信任边界；`state.workouts` 和 `plan.cardio` 这两个新的不可信输入已经在计划的威胁表里（T-15-01、T-15-02、T-15-03 已按计划缓解并有用例证明，T-15-04 为 accept，T-15-05 每次提交前隐私检查通过）。

## Next Phase Readiness

15-02 可以直接在记录区上补：有氧分区、逐字段校验文字、状态行、保存栏提示、放弃 / 删除 / 撤销、换日期确认、本机留底。数据形状、同步键、纯函数和 `tests/support/fitness.ts` 的共用操作都已就位。

## Self-Check: PASSED

- 新增文件都存在：`tests/support/fitness.ts`、`tests/e2e/fitness/log.spec.ts`、`tests/e2e/fitness/workouts-data.spec.ts`、`tests/cloud/fitness-sync.spec.ts`
- 提交都在当前分支：5127af8（Task 1）、4c9ad19（Task 2）
- 两个任务的 `<verify>`（静态检查、cloud 定向运行、默认套件定向运行、暂存后的隐私检查）都通过
