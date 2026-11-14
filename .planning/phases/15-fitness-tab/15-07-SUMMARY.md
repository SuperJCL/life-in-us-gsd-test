---
phase: 15-fitness-tab
plan: 07
subsystem: fitness-tab
tags: [security, sec-01, sec-02, csp, multi-device-sync, narrow-layout, full-suites, phase-closeout, playwright, playwright-cloud]

requires:
  - phase: 15-fitness-tab
    provides: 15-01..15-06 的训练数据层、记录区、趋势图、力量目标卡、训练历史、其他视图的训练行、编辑页有氧项；10 的同步机制；13 的发布版页面和 CSP
provides:
  - "SEC-01 延续到训练和有氧项：恶意夹具（workouts、有氧 id 和名称、备注载荷）、绕过入口检查的渲染、载入修正、导入整份拒绝、源码门槛的 Phase 15 字段"
  - "渲染层对非标准形状的训练数据跳过不抛错（woSummary、flDraftOf、fhBody、wclean）"
  - "两台设备的训练合并和实时到达的云端用例；严格 CSP 下五个视图零违规；375 px 五个标签一行"
  - "同步修正：被服务器错误挡住的上传在没有冲突的重试里成功后，等待槽没有换成已上传的内容，导致本机操作从工作视图消失、下一次上传丢掉它们"
  - "tests/README.md 的健身页一节；两个完整套件（分片）全绿；FIT-01..FIT-05 标为完成"
affects: [Phase 16 总体验收（backstop 清单、新文案清单、上线顺序）]

actuals:
  tokens: 10370
  tasks: 3
  commits: 3

plan_head_before: 8d2ec2329c8df74871ceb3c29b7a8027281c3955
plan_head_after: 52c217ce95e987dd1fd38ce66b0b0a57ca82dab5

tech-stack:
  added: []
  patterns:
    - "注入检测器对应用自己画的元素开精确例外（#fh 下的 details.fh-item、#fc 下的 details.fc-data、.fc-pl 直接子级的 svg.fc-svg），用例另外断言它们的个数，同类的外来元素仍被发现"
    - "有氧项 id 在记录区由 flDraftOf 的正则先挡掉：恶意 id 不会成为属性值，用例断言「没有这个块」而不是「原样往返」"
    - "跨设备用例用 503（重试状态）而不是拒绝连接制造「A 暂时传不上去」，因为拒绝连接之后应用走 Phase 10 的 D-03（整份上传、对方版本留底）"

key-files:
  created: []
  modified:
    - us-journey-tracker.html
    - tests/support/constants.ts
    - tests/fixtures/malicious-state.ts
    - tests/fixtures/malformed-imports.ts
    - tests/e2e/security/escaping.spec.ts
    - tests/e2e/security/state-validation.spec.ts
    - tests/e2e/data/synthetic-data.spec.ts
    - tests/e2e/narrow/narrow.spec.ts
    - tests/cloud/csp.spec.ts
    - tests/cloud/fitness-sync.spec.ts
    - tests/README.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "三个坏训练备份单独导出为 MALFORMED_WORKOUT_IMPORTS，不并进 MALFORMED_IMPORTS：后者的条数（9）和类别（三类）被 import.spec 与 DATA-02 固定；DATA-02 用例扩展为同时检查新导出"
  - "跨设备「A 离线」用 503 而不是拒绝连接：拒绝连接后 opsOk 为假，应用走 D-03（整份上传、对方的版本只留在留底里），对方那天的训练不会留在服务器上；503 是重试状态，操作记录完整，联网后重放自己的按天写入。这是 Phase 10 已有的设计，本计划没有改"
  - "修同步里的 heldSlot：上传前取下 pendRemote.state，上传成功且槽没被别人换掉时把它换成已上传的 body（原来只有本趟 rebase 出来的槽才换）"

requirements-completed: [FIT-01, FIT-02, FIT-03, FIT-04, FIT-05]

duration: 三个任务提交跨度约 29 分钟（23:28 到 23:57，-0800），不含读代码和两个完整套件的运行
completed: 2026-11-13
status: complete
---

# Phase 15 Plan 07: 训练的安全、两台设备、严格 CSP、375 px 和完整套件 Summary

**SEC-01 延续到训练和有氧项（载入、导入、渲染三道关），两台设备记训练互不覆盖，健身页在严格 CSP 下零违规，375 px 下五个标签一行；顺带修了一个同步里会丢本机操作的缺陷；cloud 281 条和默认 236 条的完整套件（分片）全绿，FIT-01..FIT-05 标为完成。**

## Performance

- **Tasks:** 3（Task 1 是 tracer，Task 2、3 是 auto；每个任务测试和实现在同一次提交里）
- **Files:** 12 个文件有改动，`git diff 8d2ec23..HEAD` 共 +611 −33（不含本 SUMMARY 和状态提交）
- **Commits:** 3 个任务提交，measured：`git rev-list --count 8d2ec23..HEAD` = 3（写本文件时）
- **actuals.tokens:** 10370，按 chars/4 估算，新增行 41480 个字符（`git diff` 的 `+` 行，含测试和应用改动）；估算 110000，实际远低（定向取片段、分批运行）

## 规模说明

计划估算 110000，实际约 10k（按同一把尺子 chars/4）。差距的原因同前几个计划：用 grep 和 sed 取片段而不是整段读应用文件，测试批次定向运行。三个任务保持独立提交：Task 1 的应用改动（渲染层类型判断）和 Task 2 的应用改动（同步修正）互不依赖。

## Accomplishments

### Task 1（tracer，6a48817）：SEC-01 延续到训练和有氧项

- **夹具：** `maliciousState()` 加了 `workouts`：今天里力量条目 id 是 `ID_PAYLOAD`、组的 w 和 r 是脚本和标签载荷，合法的 `bench` 带一组 40 × 5 和一组 w 为 `IMG_PAYLOAD`，有氧条目 id 是 `WO_ID_PAYLOAD`（新导出常量）、m 是 `DQ_PAYLOAD`；日期载荷键一天；另外加了三天「形状不对」的数据（条目是 null 或字符串、`sets` 不是数组、天本身是字符串、`lifts` 是字符串且 `cardio` 是对象）。`lifts.squat` 带 `CUR_PAYLOAD`（bench 现在有训练，当前值由训练算出，手填载荷改由没有训练的 squat 验证）。`maliciousPlanValues()` 加了 `cardio[0].n` 和 `cardio[0].note`。
- **三个坏备份：** `MALFORMED_WORKOUT_IMPORTS`（日期键 `2026-02-31`、力量 id `L-bad`、有氧 id `run`），三个都带合成标记；`DATA-02` 用例扩展为也检查它们确实坏、不落盘。
- **escaping.spec：** 绕过入口检查的用例在健身页展开全部训练历史和数据表、把范围切到「全部」后 expectClean，往返检查加了 `woRow`（时间线里 `data-wo` 等于日期载荷的训练行）和 `woIdBlocked`（记录区没有以有氧 id 载荷为 `data-cardio` 的块），断言训练历史 5 条、bench 图一条线一个点；计划值用例和「每个字段」用例各多打开健身页并 expectClean，计划值用例给 `r-run` 记两天有氧，名称载荷在记录区、训练历史、本周、日面板、时间线的训练行里都是纯文字；新用例 `SEC-01 malicious cardio names and malformed workouts …`（不绕过入口检查，两个有氧项名称换成载荷，坏日期键、坏 id、非数字分钟被入口检查修掉，历史恰好两天、有氧周图一张）。
- **state-validation：** 新用例（页面用例，manual 时钟）：本机存着一天合法训练、一天坏日期键、一天混着坏 id 和越界数值（w 1001、r 0、m 0、d 0、21 组）→ 载入时不保存，三个坏备份导入时都显示格式错误、不弹确认框、没有保存，哨兵保存后 `workouts` 只剩合法的天和那一天里合法的部分（d 为 0 的有氧只去掉 d，第 21 组被截掉），全部记录 id 和文字原样。
- **应用的类型判断（用例证明需要才改）：** 第一次跑绕过入口检查的用例就出现 `Cannot read properties of null (reading 'sets')`（`woSummary`）。补了四处：`woSummary` 只取对象条目、`flDraftOf` 只取 id 合格的对象条目和对象组、`fhBody` 同样、`wclean` 不对非对象条目取 id；`renderFh` 经 `fhBody` 对非对象的天返回空串。`seriesOf`、`cardioWeeks`、`liftNow`、`liftLast`、`trainDays` 本来就有判断，没动。
- **BARE_TOKENS 新增的字段（注释「Phase 15 健身页」）：** `x.m`、`x.d`（有氧分钟和距离）、`z.w`、`z.r`（组的重量和次数）、`p.date`（趋势图点和数据表的日期）、`w.wk`（每周有氧图的周起点）、`date`（记录区的训练日期）、`c.id`（示例挑选的有氧项 id）、`R.n`、`R.note||""`、`R.target.v`（编辑页有氧卡）、`L.def`、`L.n||T_PE_UNNAMED`、`g.cat`、`d.fitNote||""`、`d.fitGoal[0]`、`d.fitGoal[1]`、`String(v)`、`String(v.v)`（力量目标卡和已归档区的当前值）、`woSummary(e.wo,plan)`、`woSummary(day,plan)`（训练行的结果文字）。没有加 `id`、`n`、`tg`、`name`、`desc`：它们是 `esc()` 之后的局部变量，裸写 `${id}` 在应用里是安全的，加进去会误报。门槛和去掉 esc 的对照都通过。
- **检测器的例外：** 应用自己画的 `#fh` 下的 `details.fh-item`、`#fc` 下的 `details.fc-data`、`.fc-pl` 直接子级的 `svg.fc-svg` 不算外来元素（用例另外断言个数）。

### Task 2（309f4f6）：两台设备、实时、严格 CSP、375 px

- **fitness-sync 两条新用例：** 设备 A 的上传被 503 挡住时在 03-16 记一次，设备 B（听不到 A）在 03-17 记一次；A 恢复后服务器上两天都在、内容原样；接着 A 先保存 03-18（两组）、B 没看到 A 的版本再保存 03-18（一组）→ 服务器上只有一个日期键、一个动作条目、是 B 的那一组，别的两天一天不少；两台设备最后的本周页三天都显示一组。另一条：两台设备都开着健身页，A 记 bench 今天 50 × 3 保存，B 不刷新就看到力量目标卡当前值 50、训练历史第一条是今天、趋势图最后一点是 50、本周页今天有训练行，B 正在填的另一个力量项草稿原样保留。
- **csp.spec：** 标题改为五个视图和训练；计划放 5 个力量项和 1 个有氧项，在健身页记一次训练（含有氧）、切换指标和范围、翻页、展开一条训练历史和一张图的数据表；断言零违规、`#tab-fit` 里除 `i[data-w]` 外没有元素带 style 属性、`#fc` 里没有 style、`#fw` 进度条宽度经 CSSOM 设上。力量目标卡搬走之后目标页的进度条全是 0%，所以种子里让一个目标组做完一项，保住「至少一个条不是 0%」的断言。
- **narrow.spec 新用例：** 375 × 800 下五个标签在同一行（offsetTop 相同）、每个至少 44 px 高、最右不超出视口、标签栏和整页都没有横向滚动；健身页四个面板上下不重叠且左对齐，`.fc-grid` 单列、一页三张图（offsetLeft 相同），五个范围芯片至少 44 px 高、不溢出。不需要改应用的样式。

### Task 3（52c217c）：README、完整套件、需求勾选

- `tests/README.md` 加「健身页（Phase 15）的用例」一节（spec 清单、helper、数据形状、同步键和本机键、被删除和被取代的 helper、5xx 与离线的合并规则、检测器例外）。
- 完整套件结果见下节；两个套件都通过之后才勾选 FIT-01..FIT-05（列表和 Traceability 表，末尾的 Last updated 改成本日加「FIT-01..FIT-05 complete (Phase 15)」）。

## 两个完整套件的结果（分片运行）

全部用低优先级、单 worker 的包装；每个分片一次、各自一份报告，运行后立刻用 `check-report.mjs`（不带标题和 `--min-expected`）核对，都打印 `REPORT OK`，并把报告拷到仓库外的临时目录。分片是项目约束要求的（单次完整运行放不进一个 Bash 调用），所以计划 verify 里的单报告 `--min-expected` 换成了下面的汇总脚本（仓库外的一次性脚本）：对每个套件把各分片的 `stats.expected` 相加，要求每个分片 `unexpected` 和 `flaky` 为 0，并要求计划 Task 3 verify 列出的每个标题恰好在一个分片里作为通过的 spec 出现。

| 套件 | 分片 | expected | unexpected | flaky |
|------|------|----------|------------|-------|
| cloud | 1/3 | 94 | 0 | 0 |
| cloud | 2/3 | 94 | 0 | 0 |
| cloud | 3/3 | 93 | 0 | 0 |
| **cloud 合计** | | **281**（下限 279） | 0 | 0 |
| 默认 | 1/2 | 118 | 0 | 0 |
| 默认 | 2/2 | 118 | 0 | 0 |
| **默认合计** | | **236**（下限 232） | 0 | 0 |

- 汇总脚本的结论：cloud 的 12 个必须标题、默认的 13 个必须标题各恰好在一个分片里通过，`ALL OK`。
- 条数比计划多：cloud 281 比 279 多 2，默认 236 比 232 多 4。15-06 SUMMARY 已记录 plan-editor-cardio 多一条、plan-onboarding 多一条（cloud 的 2）；默认多出的 4 条是前几个计划超出计划数的用例（没有逐条核对来源），下限是下限，不影响；本计划自己的默认用例都按计划写了（Task 1 两条、Task 2 一条）。v1 的 154 条都在默认套件里通过（SEC-04、TEST-01）。
- **已知偶发用例**（plan-onboarding 的 PLAN-07 离线用例 `while offline the pick button on the empty plan card…`）：在 cloud 分片 2/3 里一次通过，没有超时、没有重试，flaky 为 0。本阶段没有让它更糟。

## 定向运行结果（Task 1–2）

| 任务 | 批次 | 结果 |
|------|------|------|
| 1 | 绕过入口检查的用例 | 首次 1 失败（`woSummary` 遇到 null 条目抛错，`liftCur` 因 bench 有训练而不再是手填值，记录区没有带载荷 id 的有氧块）；补应用的类型判断、改夹具和断言后通过 |
| 1 | 源码门槛 | 加了 Phase 15 字段后一次通过（误加 `-g` 未加引号导致一次多跑，改了运行器，没有影响结果） |
| 1 | 计划值、每个字段、新的有氧用例、state-validation 新用例 | 各一次或两次通过（计划值用例的 `hasLeafText` 作用域多了一个 `*` 层，改作用域） |
| 1 | 计划 verify：tests/e2e/security、synthetic-data、app-integrity | 25 通过（`REPORT OK expected=25`） |
| 2 | 云端：fitness-sync 两条新用例 | 首次失败三轮：A 的故障没限定上下文把 B 也挡住；改限定 A 之后发现同步缺陷（见偏差 1）；修后通过 |
| 2 | 云端：csp | 首次 1 失败（目标页进度条全是 0%），种子里让一个目标组做完一项后通过 |
| 2 | 默认：narrow（含新用例）、app-integrity | 12 通过（`REPORT OK expected=12`）；新用例首次失败是标签选择器连工具栏按钮一起数了 11 个，改成 `:scope > button[role=tab]` |
| 2 | 云端 plan verify：fitness-sync、csp、fitness-log、realtime-sync | 14 通过（`REPORT OK expected=14`） |
| 2 | 云端同步回归（改了应用的同步代码之后）：offline-sync、remote-update | 26 通过（`REPORT OK expected=26`） |
| 2 | 云端同步回归：conflict-snapshot、multi-device、reconcile-gate、import-sync、plan-editor-sync、writer-id、pb-faults | 54 通过（`REPORT OK expected=54`） |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 重试成功的上传没有把等待槽换成已上传的内容，本机操作随后消失**
- **Found during:** Task 2（`FIT-05 trainings saved on two devices on different days …`）
- **Issue:** 设备 A 的上传被 503 挡住，设备 B 此时写了服务器；A 的后台同步在重试里把 B 的版本放进等待槽（`rebaseState`）并重放了自己的操作，但这一趟的上传又失败了。之后 A 重试时服务器版本已经是槽里那份（`ssv.updated===docs.state.base`），没有冲突，不再 rebase，所以 `slot` 变量是空的；上传成功后「把槽换成已上传的 body」那一句只在 `slot` 非空时执行，槽里仍是 B 的旧版本，而 A 的操作已经从 `ops` 里划掉。结果 A 的工作视图没有自己刚记的那一天，A 的下一次上传把它从服务器上也丢了（用例里 03-16 的训练在 A 保存 03-18 之后就不在服务器上了）。这是 Phase 10 的同步缺陷，对记录、任务等所有数据同样成立，不只是训练。
- **Fix:** `syncOnce` 上传前取下 `pendRemote.state`（`heldSlot`），上传成功且槽没被别人换掉时把它换成已上传的 body。本趟 rebase 出来的槽仍然是同一个对象，行为不变。
- **Files modified:** us-journey-tracker.html、tests/support/constants.ts（`APP_SHA256` 重新记录）
- **Verification:** 新用例通过；offline-sync、remote-update、conflict-snapshot、multi-device、reconcile-gate、import-sync、plan-editor-sync、writer-id、pb-faults 共 80 条同步相关用例和之后的完整 cloud 套件都通过。
- **Commit:** 309f4f6

**2. [Rule 1 - Bug] 渲染层遇到非对象条目会抛错**
- **Found during:** Task 1（绕过入口检查的用例）
- **Issue:** `woSummary` 对 null 条目取 `.sets`、`flDraftOf` 对 null 条目取 `.id`、`fhBody` 对非对象的天或条目取字段，页面抛 TypeError（计划的 behavior 就写了「渲染函数遇到非标准形状时跳过、不报错」）。
- **Fix:** 见 Accomplishments 的「应用的类型判断」。`wclean`（planCommit 清理训练）同样不再对非对象条目取 id。
- **Files modified:** us-journey-tracker.html
- **Commit:** 6a48817

### 与计划文字不同的地方（不是缺陷）

- **「A 离线」用 503，不用拒绝连接：** 计划写「设备 A 断网（照 SYNC-03 的写法）」。照那个写法（拒绝连接加 `setOffline`）之后应用把这次失败记成离线，`opsOk` 为假，联网时走 Phase 10 的 D-03：整份上传、对方的版本只留在留底里，所以 B 在 03-17 的训练不会留在服务器上。这是 Phase 10 已有的设计（`SYNC-05 an offline edit over a newer server version is uploaded and the other version is kept here (D-03)`），不是本阶段引入的，本计划没有动它。用例改用 503，它是重试状态，操作记录完整，联网后在对方的新版本上重放自己的按天写入，两边的日子都在，这正是计划的 truth。**交给 Phase 16：** 真机上手机真正断网（连接被拒）时，另一台设备在这期间记的训练只会出现在留底（顶栏「下载留底」）里，不在服务器上；所有者验收「离线再联网」时要知道这是现有规则。
- **`woIdBlocked` 代替 `woId`：** 计划写「记录区的有氧块 data-cardio 等于 WO_ID_PAYLOAD（布尔）」。记录区的草稿用 `flDraftOf` 先按 id 正则过滤，带载荷的有氧 id 过不了正则，本来就不会出现在记录区，所以用例断言「没有这个块」（布尔）。`woRow` 也不在本周页而在时间线：日期载荷不是真实日期，本周页不会选到它，时间线会列它。
- **记录区没有「力量目标卡当前值」的载荷往返：** bench 现在有训练，当前值取训练里最重一组，手填的 `CUR_PAYLOAD` 只在没有训练的力量项上显示，所以夹具里 `squat` 带这个载荷，用例改读 squat 的卡。
- **cardio[0].note 只靠 expectClean 和源码门槛：** 备注只显示在编辑计划页（云端版）的 textarea 里，本地版没有这个页面，`R.note||""` 已加进 BARE_TOKENS。
- **改了计划之外的一个文件：** `tests/e2e/data/synthetic-data.spec.ts`（DATA-02 用例检查新导出的坏训练备份），因为三个备份没有并进 `MALFORMED_IMPORTS`。

## 已知问题和遗留

- 同一天里第一个 bench 条目的 `sets` 坏了（不是数组）时，`normalize` 先按 id 去重再检查组，同一天里后面合法的 bench 条目会被丢掉（`seriesOf` 也只看第一个同 id 条目）。只在手改的坏数据里出现，界面不会产生这种数据；没有改。
- 本计划没有目视核对任何版面：深浅色、375 px 的图表、375 px 的长 toast 等全部在下面的 backstop 清单里交给 Phase 16。

## Known Stubs

None。扫描过本计划新增的应用和测试代码，没有空值硬编码流向界面、占位文字或 TODO / FIXME。

## Threat Flags

None。本计划新增的安全相关面都在计划的 threat_model 里：T-15-24（恶意夹具加绕过入口检查的渲染，渲染层对非标准形状跳过不抛错）、T-15-25（载入修正和导入整份拒绝，state-validation 新用例证明）、T-15-26（BARE_TOKENS 加 Phase 15 字段，去掉 esc 的对照通过）、T-15-27（两台设备改同一天以后保存的为准，用例证明只有一个日期键）、T-15-28（严格 CSP 下五个视图零违规，`#tab-fit` 没有内联样式）。

## 交给 Phase 16 总体验收的 backstop 清单（全阶段，目视或真机核对）

所有者在 Phase 16 做一次总体验收，下面各项自动化用例只量 DOM 和属性，没有目视。按计划分组：

- **15-01 / 15-02（记录区）：** 375 px 下组行「序号 + 重量 + × + 次数 + 删除」一行放得下，两个输入框各约 80 px 能放下 `122.5` 和 `999`；20 组时页面可滚动、底部保存栏不被虚拟键盘盖住（`scrollIntoView({block:"center"})` 在真机的效果）；≤560 px 所有按钮、输入框、芯片 44 px 高；手指按住「保存训练」时字段失焦不把按钮挤走；系统回收页面后 `wodraft` 能把已填的组带回来（用例只覆盖刷新）；`beforeunload` 在手机浏览器不保证弹出（同编辑计划页，所有者已接受）。
- **15-03（趋势图）：** 浅色和深色主题下折线、空心点、目标虚线、柱形、读数竖线都清楚；375 px 下三张图上下排整页可读、五个范围芯片折成两行不横向滚动、每个 44 px 高；手指按住图时读数竖线和竖向滑动不互相吃掉（`touch-action:pan-y`）。
- **15-04（本周训练和力量目标）：** 浅色和深色主题下七个日点（实心 / 空心 / 今天的下划线）和力量卡进度条清楚；375 px 两列力量卡里长名称和备注换行、数字和单位分行、不撑破窄卡；健身说明按钮的箭头方向和点击区域，键盘聚焦和读屏播报；目标页搬家后只剩编辑计划按钮、目标组和已归档区，没有留空和错位；读屏把日点整组读成一句话、进度条读「{名称}进度」。
- **15-05（训练历史、其他视图、导入导出）：** 375 px 下历史的两个按钮各占一半宽、44 px 高，展开明细换行、长摘要不截断；日历 chip 的健身色和历史的分隔线在深浅色下可读，≤560 px 训练 chip 缩成点；读屏听到日历格末尾的「，有训练」、训练行「打开健身页查看这次训练：…」、「已显示更早的 {n} 次训练」；历史里删除后焦点到下一条（没有就上一条，再没有就标题）、撤销后回到这一条（UI-SPEC 没写，请按真实键盘确认）；门控期间历史可展开、「删除这次训练」被拦住、「修改这次训练」仍可点；用表格软件打开导出的日历 CSV 看「[健身] …」行的日期和全天事件，导入带训练的真实备份时摘要多一行「训练 {n} 天」是否自然。
- **15-06（编辑页有氧项和示例挑选）：** 375 px 长 toast（`已加入 3 个目标组、4 个力量项、3 个有氧项，计划已保存` 和 `已加到草稿：…，点「保存计划」后生效`，带撤销按钮的 `已从草稿移除：…` 也一样）完整显示、可以换行；示例挑选对话框最多 7 + 4 + 3 = 14 行加三个图例，列表区只滚动中间部分、最后一行不被底部按钮盖住；编辑页有氧项卡名称很长时卡片头单行省略、摘要和上移下移不挤出，每次目标三个按钮折行，已归档区新一组的说明行。
- **15-07（本计划）：** 375 px 下五个标签在一行（用例证明了，真机目视确认字号和点击区域）；真机上「手机断网再联网」的两台设备合并：真正断网时对方在这期间记的训练只在留底里（见上面「与计划文字不同的地方」）；记录区「几秒内」实时出现在另一台设备上的体感（路线图 Phase 16 成功标准 3）。

## 全阶段的新文案

### 在 15-UI-SPEC 的 Copywriting Contract 里的

逐字取自 UI-SPEC，应用里是 `T_…` 常量，`tests/support/strings.ts` 逐字镜像；各计划 SUMMARY 的「本计划新增的用户可见文案」一节有完整表格（15-01 记录区和空状态、15-02 草稿保护和离线提示、15-03 图表和翻页、15-04 本周训练和力量目标、15-05 历史和导入摘要、15-06 编辑页有氧项和示例挑选）。本计划没有新增用户文案。

### 在 UI-SPEC 之外的（逐条收集自 15-01..15-07，需要所有者特别过目）

| 来自 | 文案 | 出现的位置 |
|------|------|-----------|
| 15-01 | 已删除的力量项（`T_FIT_GONE_L`） | 训练里的力量项 id 在计划里找不到时的名字（彻底删除、只含计划的导入、离线重放遇到别的设备已删） |
| 15-01 | 已删除的有氧项（`T_FIT_GONE_C`） | 同上，有氧项 |
| 15-02 | 已添加动作：{有氧项名称} | `#fl-live` 读屏播报，加有氧项后（复用力量动作那句） |
| 15-02 | 已删除 {M月D日} 的训练 | `#fl-live`，删除整次训练后（toast 之外常驻的读屏播报） |
| 15-02 | 已移除：{名称} | `#fl-live`，移除动作或有氧项后 |
| 15-02 | 已撤销：已删除第 {n} 组 / 已撤销：已移除：{名称} | `#fl-live`，撤销之后 |
| 15-03 | 每周有氧总时长柱形图，{范围}，共 {n} 周，本周 {m} 分钟 | 柱形图 svg 的 `aria-label`（`T_FC_CD_ARIA`） |
| 15-03 | 单组最多次数 / 总次数 | 徒手图 svg `aria-label` 里的指标名（`T_FC_REPS`） |
| 15-04 | 本周训练和力量目标（读屏） | `#fw` 面板的 `h3.sr-only` 标题（`T_FW_TITLE`） |
| 15-04 | {名称}进度 | 进度条 `role="progressbar"` 的 `aria-label`（`T_FW_BAR_ARIA`） |
| 15-05 | ，有训练 | 日历格 `aria-label` 在这一天有训练时的末尾（`T_CAL_WO`） |
| 15-05 | 训练 {n} 天 | 导入确认框摘要的一行，只在备份里训练天数大于 0 时出现（`T_IMP_WO`） |
| 15-05 | [健身]（CSV 的 Subject 前缀） | 日历 CSV 里训练行，沿用文字记录行「[类别] 」的写法，不是界面文案 |
| 15-06 | 有氧项最多 20 个，请先删掉或归档多余的 | 保存时有氧项超过 20 个（导入或别的设备带来）的错误行 |
| 15-06 | 上移有氧项：{名称} / 下移有氧项：{名称} | 编辑页有氧项卡按钮的读屏名 |
| 15-06 | 恢复有氧项：{名称} / 彻底删除有氧项：{名称} | 已归档区按钮的读屏名 |

另有一处不是文案、但会显示在界面上的回退（15-01）：训练里引用的力量项在计划里找不到时，记录区的单位暂用 `kg`、目标不显示。

## 旧页面丢键的风险（T-15-04）和上线顺序（交给 Phase 16）

已部署的 Phase 14 版本加载含 `workouts` / `cardio` 的数据时，`normalize` / `normalizePlan` 会丢掉这两个键，随后保存就会冲掉它们（详见 15-01 SUMMARY）。这是接受的风险，来自旧代码，新代码改不了。**上线顺序**已经写进 ROADMAP 的 Phase 16 备注（提交 dcb9a0f）：

1. 先让**所有打开的页面**（手机和电脑，三个人的所有设备）换成新版本（页面里的更新按钮或刷新，Service Worker 更新后重新载入）；
2. 然后才记第一次训练（健身页）；
3. 最后才迁移真实数据（导入带训练或有氧项的备份、`workouts` 进服务器）。

任何一台还开着旧版本的设备，只要在第 2、3 步之后保存一次，就会把服务器上的 `workouts`（和计划里的 `cardio`）冲掉。本阶段的完整套件都跑在新版本上，没有证明旧版本的行为，这一条靠上线顺序来管。

## 本计划对应用的改动（汇总）

只有两处，都是缺陷修正，没有新功能、新文案和新的样式：

1. 渲染层类型判断（Task 1）：`woSummary`、`flDraftOf`、`fhBody`、`wclean` 对非对象的条目、组和天跳过。
2. 同步修正（Task 2）：`syncOnce` 的 `heldSlot`。

`APP_SHA256` 在两次提交里各重新记录一次（LF 字节，应用文件无 CR，`style="` 计数 0，纯函数段五个标记各恰好一次，SAFE-02 通过）。

## Next Phase Readiness

Phase 15 的七个计划全部完成，FIT-01..FIT-05 在列表和 Traceability 表里都是完成。Phase 16（总体验收）需要：上面的 backstop 清单、新文案清单、上线顺序（先所有设备换新版本，再记训练，再迁移真实数据），以及真正断网时训练只在留底里的现有规则（Phase 10 的 D-03）。

## Self-Check: PASSED

- 新增 / 改动的文件都存在（应用、constants、两个夹具、escaping、state-validation、synthetic-data、narrow、csp、fitness-sync、README、REQUIREMENTS）。
- 三个任务提交都在当前 HEAD 的祖先里：6a48817（Task 1）、309f4f6（Task 2）、52c217c（Task 3）。
- 应用文件无 CR、`style="` 计数 0、纯函数段五个标记各恰好一次、`APP_SHA256` 按 LF 字节重新记录（SAFE-02 在两个完整套件里通过）。
- 工作区没有未提交的已跟踪文件改动。
