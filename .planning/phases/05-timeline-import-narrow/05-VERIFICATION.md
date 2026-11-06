---
phase: 05-timeline-import-narrow
verified: 2026-11-04T05:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".planning/phases/05-timeline-import-narrow/05-01-PLAN.md"
  - ".planning/phases/05-timeline-import-narrow/05-01-SUMMARY.md"
  - ".planning/phases/05-timeline-import-narrow/05-02-PLAN.md"
  - ".planning/phases/05-timeline-import-narrow/05-02-SUMMARY.md"
  - ".planning/phases/05-timeline-import-narrow/05-03-PLAN.md"
  - ".planning/phases/05-timeline-import-narrow/05-03-SUMMARY.md"
  - ".planning/phases/05-timeline-import-narrow/05-04-PLAN.md"
  - ".planning/phases/05-timeline-import-narrow/05-04-SUMMARY.md"
  - "tests/KNOWN-BUGS.md"
  - "tests/PROBES.md"
  - "tests/README.md"
  - "tests/e2e/io/import.spec.ts"
  - "tests/e2e/io/known-bugs.spec.ts"
  - "tests/e2e/narrow/narrow.spec.ts"
  - "tests/e2e/platform/probes.spec.ts"
  - "tests/e2e/timeline/timeline.spec.ts"
  - "tests/support/expect-from-fixture.ts"
  - "tests/support/import-file.ts"
  - "tests/support/strings.ts"
  - "tests/support/timeline.ts"
covered_digest: "v4:sha256:a3f5b73d8b87aee100c9458fe2d9c5ace7d6d05c0b018186e919533f834c31bd"
behavior_unverified: 0
overrides_applied: 0
coincidental_reliance_items: []
human_verification:
  - test: "确认判断型禁止项 P-1（TL-01、RESP-01 的隐私）：时间线完成计划条目的文字和标签、日历 chip 和计划条目的文字、内置任务原文，没有被读取、断言，也没有出现在失败消息、注解、SUMMARY 或提交信息里；窄屏用例没有截图和像素比较"
    expected: "验证者的非权威判断：成立。证据：timeline.ts 只在 page.evaluate 里读筛选按钮的值和 aria-pressed、月份标题、条目的 data-edit 或 data-edittask 的 id、.tl-date 日期、记录条目的 .tag（类别显示名，固定界面文案），对完成的计划不读文字也不读标签；timeline.spec.ts 里唯一的文字断言是空提示 TIMELINE_EMPTY（固定界面文案）；narrow.spec.ts 里没有 textContent、innerText、getByText、截图类调用，只读计算样式、位置、类名和日期属性；唯一的注解 scroll-end 只含 atTop 或 atBottom 加五个数字；privacy-check --all 退出 0（161 个文件，65 个个人计划词条）"
    why_human: "ADR-550 D3/D4：judgment 档禁止项在交互模式下需要人工逐项确认，验证者只能给出非权威的 LLM 判断。另外 Playwright 失败时写入 test-results/ 的截图、trace 和 error-context.md 会含页面全文，它们是本地且被 git 忽略的证据（Phase 1 的 D-02 决定），不属于终端输出，请确认你接受这一点"
  - test: "确认判断型禁止项 P-2（TL-01、IO-04 的透明）：期望值没有取自应用源码或运行中的页面，没有把导入时观察到的应用问题写成通过的特征化断言，B2、N3 没有在没复现时就标成已知 bug，也没有把“change 会再次触发”写成 B2 的期望"
    expected: "验证者的非权威判断：成立。证据：expect-from-fixture.ts、timeline.ts、import-file.ts 里 grep us-journey-tracker、readFileSync 均无命中；expectedTimeline 和 expectedNormalize 的规则写在注释里并对照应用行为（排序、筛选、月份标题、normalize 的各字段规则）一致；B2 标记用例只断言 #importJson 的 value 为空字符串，PROBE-8 的写死断言和 PROBES.md 说明 setInputFiles 每次都自己派发 change，所以“再选同一个文件没有反应”在 Playwright 里复现不了，这一点在 KNOWN-BUGS.md 的 B2 行如实写明；N3 标记用例选 toast 作为期望并在 spec 注释里写明理由，对照用例证明 {} 通过了 JSON.parse 和 normalize 并走到替换确认；[] 和字段类型错误的对象没有写任何断言，只在登记里注明同类、没有单独验证。去掉标记亲眼复现这一步，我没有重跑（资源限制），只核对了 05-04-SUMMARY 的记录、KNOWN-BUGS.md 的“已复现”描述，以及最终报告里 B2、N3 两条标记用例 expectedStatus 为 failed 且按预期失败、对照用例 passed"
    why_human: "同上。去掉标记复现是执行者的自述，验证者没有独立重跑，请确认你接受这一点"
  - test: "确认判断型禁止项 P-3（IO-04、IO-05、TL-02 的安全）：没有为了让用例通过而修改应用、fixture、test.ts 的护栏过滤规则、package.json、playwright.config.ts；导入文件只在内存里构造；预期内的控制台错误只用定向方式处理；没有写任何像备份的磁盘文件"
    expected: "验证者的非权威判断：成立。证据：从 Phase 5 第一个提交 c96c1cb 起，git log 对 us-journey-tracker.html、tests/fixtures、tests/support/test.ts、package.json、package-lock.json、playwright.config.ts、tests/support/app.ts、tests/mocks 没有任何提交；应用 sha256 与 constants.ts 里的 APP_SHA256 基线一致且 git ls-files 为空；tests/e2e/{timeline,io,narrow} 与 import-file.ts、timeline.ts 里没有 writeFile、appendFile、fs. 调用，也没有 console 调用；导入文件名全部以 synth- 开头，chooseImportFile 运行时检查；特殊数据（去掉健身记录、2025-12-31 记录）只在用例内存里构造；已知 bug 只在测试侧标记并登记，registry 护栏用例在最终报告里 passed"
    why_human: "同上"
  - test: "确认判断型禁止项 P-4（RESP-01 的范围和收尾安全）：窄屏没有用设备描述符、没有测拖拽、没有在窄屏下重复其他视图的完整断言；没有运行 complete-milestone、归档阶段目录、推送"
    expected: "验证者的非权威判断：成立。证据：narrow.spec.ts 只有 4 条用例，只用 test.use 的 viewport 520 × 900，无 devices、无拖拽、无截图；git 状态里没有归档目录或里程碑收尾提交，ROADMAP 里 Phase 5 的进度表仍是 In Progress（里程碑收尾等用户决定）。窄屏滚动用例的 at-bottom 分支无法区分 scrollIntoView 的 block 取值，已作为 IN-10 如实记录（见下“Gaps Summary”），请确认你接受这个黑盒约束下的弱点"
    why_human: "同上"
human_confirmed: "2026-11-05 用户确认 P-1..P-4 全部成立"
---

# Phase 5: 时间线、导入与窄屏 验证报告

**Phase Goal:** 开发者能验证时间线视图、JSON 备份导入（确认、取消、错误文件、旧类别迁移）以及手机宽度下的关键布局，`npm test` 一次就能覆盖全部四个视图。
**Verified:** 2026-11-04
**Status:** human_needed
**Re-verification:** 否，首次验证

本阶段是测试脚手架阶段，交付物是 helper、spec、已知 bug 登记和约定文档，不是应用功能。所以“必须为真”指 ROADMAP 的 5 条成功标准：每条都要有真实的 helper 和 spec 代码，用例确实断言了那条行为，并且运行结果可信。验证以读代码、核对最终报告里的逐条状态为主，不采信 SUMMARY 的描述。按资源限制没有重跑完整套件。

**结论先说：** 5 条成功标准、5 项需求、四份计划的 must_haves 都被代码和运行结果证实，没有缺口，没有 BLOCKER。状态是 `human_needed` 只有一个原因：四份计划里有 12 条 `verification: judgment` 的禁止项，规则要求人工逐项确认、不能静默通过（与 Phase 4 同样的处理）。我把它们合并成 4 条给出非权威判断和证据，我的判断全部是“成立”。另有两点需要你知道的弱点（IN-10、IO-05 的日历视图覆盖），都不构成缺口，见下。

## Goal Achievement

### Observable Truths

| # | Truth（ROADMAP 成功标准） | Status | Evidence |
|---|---|---|---|
| 1 | 时间线按月倒序列出记录和完成的计划，没有内容时显示空状态提示；按类别筛选、只看“完成的计划”时，只留下对应的条目 | ✓ VERIFIED | `timeline.spec.ts` 七条。TL-01 总览：`readTimeline` 一次读回筛选按钮、月份标题、条目（attr、id、所属月份、M/D 日期、记录的类别标签）和空提示，整体 `toEqual(expectedTimeline(fixture, FILTER_ALL))`，并有防空转断言（条目数等于记录数加 3、月份依次为 3 月、2 月、1 月、同一天先记录后计划）。TL-02：五个类别逐个点击，读回等于推导，只有被点按钮 aria-pressed 为 true，且每个类别的期望行都只有该类别的记录；切到本周再切回筛选保持；“完成的计划”后只剩 `data-edittask` 条目（内置 P 开头和自定义 c- 开头都有），点“全部”恢复。空状态：minimal-state 下七个筛选都只显示 TIMELINE_EMPTY；内存变体去掉健身记录后该类别显示空提示，其余筛选仍有条目。跨年：加 2025-12-31 的合成记录后月份标题为四个且倒序。联动：本周记一条、目标页勾选合成待办 c-synth-3 后，读回等于由保存后状态推导的结果，两条都落在 3/18。期望由 `expectedTimeline` 按注释里的规则独立写出，不读应用文件（grep 确认）。报告里 7 条全部 passed |
| 2 | 导入 JSON 备份的用例先注册对话框处理再操作，并断言提示文案：确认后全部数据被替换，取消后数据不变，选择非 JSON 文件时出现错误提示；导出后再导入，数据保持一致 | ✓ VERIFIED | `import.spec.ts` 五条。每条都先 `answerNextDialog`（`page.once('dialog')`）或 `recordDialogs`，再 `chooseImportFile`；确认框文案逐字比较 `CONFIRM_IMPORT`。确认：toast 为 `TOAST_RESTORED`，保存的状态 `toEqual(expectedNormalize(payload))`，本周不再有 synth-full- 记录、合成记录出现在其日期列、#arrival 等于备份值，时间线读回等于推导。取消（manual 时钟，推过 2 秒防抖）：写入次数不变、没有 toast、fixture 记录仍在，再用合成哨兵证明写入次数恰好加 1，且哨兵那次写入里其余记录 id 与 fixture 完全相同。非 JSON（三个 not-json 加 synth-null.json）：每个都出现 `TOAST_IMPORT_BAD_FORMAT`、不弹确认框、写入次数不变，哨兵证明数据仍是 fixture。往返：导出的原文（不重新序列化）作为内存文件导入并接受，保存的状态与导出备份深度相等，导出后新增的合成记录消失。导入文件在内存里构造，名字 synth- 开头，helper 运行时检查。报告里 5 条全部 passed |
| 3 | 导入带旧类别名的 fixture 后，记录被迁移到新的类别，并在各视图里按新类别显示 | ✓ VERIFIED（见下 IO-05 的范围说明） | `IO-05 importing a backup with legacy category names…`：导入 legacy-categories 后保存的状态等于 `expectedNormalize(legacy)`；每条记录的类别等于 `expectedCategory(原类别)`；防空转：至少 4 条真的变了，且有落到“其他”的。本周视图五张类别卡的计数等于 `weekCountsByCategory(保存后状态, 冻结周)`、每条记录在自己的日期列里恰好一次；时间线整体等于推导，每条 legacy 记录的标签是新类别名，按“专业”和“其他”筛选能找到被迁移的记录。覆盖的视图是本周和时间线，这两个视图按名字显示类别；日历 chip 只带 `k-<类别键>` 的颜色类、没有类别名，目标视图不显示记录类别，两者没有单独断言，但它们的数据来自同一份已断言的保存状态，我认为这足以满足需求，列为 ℹ️ Info。报告里 passed |
| 4 | 在手机宽度下，少量关键用例通过：编辑弹窗变成底部面板，日历 chips 变成圆点，本周日期纵向排列，选中某天后页面滚动到“记一笔” | ✓ VERIFIED（滚动一条有已记录的弱点，见 IN-10） | `narrow.spec.ts` 恰好 4 条，顶层 `test.use({ viewport: { width: 520, height: 900 } })`，每条先读回 innerWidth 与 innerHeight。底部面板：打开合成记录 synth-full-04 的弹窗，宽度与视口相差不超过 1px、左边贴住、下边与视口底相差不超过 1px、顶部在视口内，上两个圆角非 0px、下两个为 0px。圆点：每个 chip 计算 font-size 为 0px、圆角为 50%，记录 chip 宽高在 7px 上下 0.5px 内，记录、到期、完成三种至少各一个。纵向排列：`#days` 的 grid-template-columns 只有一列，7 个日期列依次是冻结周的周一到周日，左边缘相同、顶部严格递增、宽度与 `#days` 相同。选日滚动：用页面内读回的布局选出非今天、距离合适的日期列，先瞬时滚到 `#wkComp` 在视口下方 40px，断言日期头完整在视口内、`#wkComp` 在视口下方，点日期头后选中日变成它，用 `expect.poll` 等平滑滚动结束（scrollY 连续两次相同且比点击前大），再断言 `#wkComp` 贴近视口上沿，或页面已到底且 composer 顶部在视口内。最终报告里该用例的 scroll-end 注解为 `atBottom; 449,793,900,948,1848`（compTop、compBottom、innerHeight、scrollY、scrollHeight）：走的是 at-bottom 分支，滚动确实发生（点击前 composer 在视口外，点击后 composer 顶部在视口内且 scrollY 增加），但这一分支不能区分 `scrollIntoView` 的 block 取值。应用里该行为是 `pickDay` 在 innerWidth ≤ 900 时调用 `scrollIntoView({behavior:"smooth",block:"start"})`。成功标准要求的是“页面滚动到记一笔”，这个用例证明了；它不能证明 block 取值恰好是 start，已由 IN-10 如实记录。报告里 4 条全部 passed |
| 5 | 本阶段碰到的已知 bug（如取消导入后重选同一个文件没反应）按 Phase 3 的约定标记并登记。`npm test` 跑完全部用例时，除 `tests/KNOWN-BUGS.md` 登记的标记用例外全部通过，`us-journey-tracker.html` 的 sha256 仍与基线一致 | ✓ VERIFIED | 登记：`tests/KNOWN-BUGS.md` 新增 B2、N3 两行，标题用反引号且与 spec 逐字一致，登记护栏 `known-bugs-registry.spec.ts` 两条在最终报告里 passed。B2 一组三条（control、reset path、expected 加 `knownBug('B2'…)` 第一句），N3 一对。B2 的期望断言只用确定性的 `#importJson` 的 value 为空，不断言“change 会再次触发”；PROBE-8（`probes.spec.ts`，PROBES.md 已更新到 PROBE-1 至 PROBE-8）记录 Playwright 的 `setInputFiles` 每次都自己派发 change，所以用户看到的“再选同一个文件没有反应”在此复现不了，KNOWN-BUGS.md 的 B2 行如实写明。N3 按用户 2026-11-03 的决定标为已知 bug，ROADMAP 的 Notes 已更正。最终报告：154 条，`expected=154 flaky=0 unexpected=0`，每条只跑 1 次；8 条 expectedStatus 为 failed 的标记用例（week B1、N1、B4，calendar B1、N1，goals N1，io B2、N3）与登记表一一对应，全部按预期失败，其余 146 条为 passed。sha256 实测等于 `constants.ts` 的 `APP_SHA256` 与基线 2a954fd0…，`git ls-files` 对应用文件为空 |

**Score:** 5/5 成功标准已验证（0 条存在但未被行为证明）

### “`npm test` 一次覆盖全部四个视图”的核对

最终报告的 154 条用例按目录分布：`week/` 25 条、`calendar/` 17 条、`goals/` 16 条、`timeline/` 7 条，加上 `editor/` 8、`io/` 16、`narrow/` 4、`storage/` 7、`data/` 6、`platform/` 43、`smoke` 5 等。本周、日历、目标、时间线四个视图各自都有目录、有读回 helper、有期望推导，全部在同一份报告里；`skipped=0`，没有被跳过或过滤的用例。✓ 成立。

### 计划里的补充 must-haves（抽查结论）

| Must-have | Status | Evidence |
|---|---|---|
| 05-01 D-07：不读完成计划的文字和标签 | ✓ VERIFIED | 见 P-1 的证据；`readTimeline` 对 `attr === 'edittask'` 的条目只读 id、日期、所属月份，tag 恒为 null |
| 05-01 D-06：账户模式开局、strings.ts、只从 test.ts 导入、timeline.ts 不从 ./test 导入 | ✓ VERIFIED | 每条用例 `expectAccountMode`；`timeline.ts`、`import-file.ts` 对 `./test` 无导入（grep 确认）；9 个 spec 文件都从 `../../support/test` 导入 |
| 05-02 D-04/D-05：内存文件、synth- 文件名、先注册对话框处理 | ✓ VERIFIED | `chooseImportFile` 的正则检查；用到的文件名 synth-import、synth-cancel-import、synth-roundtrip、synth-legacy-import、synth-b2-import、synth-empty-object、synth-null 以及 MALFORMED_IMPORTS 里的名字，都以 synth- 开头 |
| 05-02：取消和非 JSON 用 manual 时钟证明没有保存 | ✓ VERIFIED | 见 truth 2；`expectOnlySentinelSaved` 用哨兵和写入次数加 1 证明 |
| 05-03：窄屏只有 4 条、不用设备描述符、不拖拽、不截图 | ✓ VERIFIED | 见 truth 4 和 P-4 |
| 05-03 D-14、D-15：README 与 KNOWN-BUGS 的收尾更新 | ✓ VERIFIED | README 目录表含 timeline 与 narrow 两行，io 与 support 两行已更新，timeline.ts、import-file.ts 的说明在，探针一节为 PROBE-1 到 PROBE-8；KNOWN-BUGS 的“里程碑收尾时的状态”一节列出已覆盖（B1、B2、B4、N1 三种触发、N3）和仍未验证（N1 的拖拽与改抵达日期、B3、B5 到 B12、与 N3 同类的输入） |
| 05-04：B2 对照用例的“没有写入”断言已删除 | ✓ VERIFIED | WR-02 修复后对照用例只断言文案、无 toast、记录仍在，并在注释里说明取消不保存由 IO-04 的 manual 时钟用例证明 |
| 05-04：N3 标记用例断言 toast 之后再断言没弹确认、记录仍在 | ✓ VERIFIED | WR-03 修复后读代码确认，`expectToast(TOAST_IMPORT_BAD_FORMAT)` 为第一句断言，之后 `dialogs` 为空且 `synth-full-04` 的计数为 1 |
| 阶段收尾：完整套件、sha256、隐私 | ✓ VERIFIED | 见下 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `tests/support/timeline.ts` | 时间线页内读回 | ✓ VERIFIED | 导出 `gotoTimeline`、`pickFilter`、`readTimeline`；只从 `@playwright/test` 和 `./strings` 导入；实质实现、被 timeline.spec 与 import.spec 使用 |
| `tests/support/import-file.ts` | 内存导入文件和确认框处理 | ✓ VERIFIED | 导出 `jsonImportFile`、`textImportFile`、`chooseImportFile`、`answerNextDialog`、`recordDialogs`；synth- 命名检查；被 import.spec 与 known-bugs.spec 使用 |
| `tests/support/expect-from-fixture.ts` | `expectedTimeline`、`expectedNormalize` | ✓ VERIFIED | 两个函数都是带规则注释的实质实现，不读应用文件 |
| `tests/support/strings.ts` | 筛选与导入文案常量 | ✓ VERIFIED | 含 `FILTER_DONE_TASKS` 等；用例里的界面文案只来自此处 |
| `tests/e2e/timeline/timeline.spec.ts` | TL-01、TL-02 七条 | ✓ VERIFIED | 七条标题与计划一致 |
| `tests/e2e/io/import.spec.ts` | IO-04、IO-05 五条 | ✓ VERIFIED | 五条标题与计划一致 |
| `tests/e2e/io/known-bugs.spec.ts` | B2 三条、N3 两条 | ✓ VERIFIED | 五条；两条标记用例第一句调用 `knownBug` |
| `tests/e2e/narrow/narrow.spec.ts` | RESP-01 四条 | ✓ VERIFIED | 四条 |
| `tests/e2e/platform/probes.spec.ts` | PROBE-8 | ✓ VERIFIED | 存在，最终报告中 passed（probes 目录共 10 条） |
| `tests/KNOWN-BUGS.md`、`tests/PROBES.md`、`tests/README.md` | 登记、结论、约定 | ✓ VERIFIED | 见补充 must-haves |
| `.planning/ROADMAP.md` | Notes 里 N3 一条与用户决定一致 | ✓ VERIFIED | 第 182 行为“用户已在 2026-11-03 决定算已知 bug（05-CONTEXT 的 D-02）” |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| timeline.spec.ts | timeline.ts | `readTimeline(page)` | ✓ WIRED | 每条用例的比较都经它 |
| timeline.spec.ts / import.spec.ts | expect-from-fixture.ts | `expectedTimeline(` | ✓ WIRED | 期望来自 fixture 或保存后的状态 |
| timeline.spec.ts | strings.ts | `FILTER_ALL`、`FILTER_DONE_TASKS`、`CATEGORY_NAMES` | ✓ WIRED | |
| import.spec.ts / known-bugs.spec.ts | import-file.ts | `answerNextDialog(page`、`chooseImportFile(` | ✓ WIRED | 先注册后选文件 |
| import.spec.ts | expect-from-fixture.ts | `expectedNormalize(` | ✓ WIRED | 确认和旧类别两条用例使用 |
| import.spec.ts | timeline.ts | `readTimeline(page)` | ✓ WIRED | 导入后用时间线证明各视图重绘 |
| narrow.spec.ts | editor.ts、calendar.ts | `openLog(`、`gotoCalendar(page)` | ✓ WIRED | |
| known-bugs.spec.ts 的两处标记 | KNOWN-BUGS.md | `knownBug('B2'`、`knownBug('N3'` | ✓ WIRED | 登记护栏在最终报告里 passed |
| KNOWN-BUGS.md | known-bugs-registry.spec.ts | 行首 `| B2 |`、`| N3 |` 和反引号标题 | ✓ WIRED | 双向核对通过 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| 各 spec 的“实际值” | 读回对象、保存的状态 | 真实 Edge 里运行的应用；保存来自账户模式 mock 后端收到的写入 | 是 | ✓ FLOWING |
| 各 spec 的“期望值” | `expectedTimeline`、`expectedNormalize`、`weekCountsByCategory` 的结果 | fixture、用例内存变体或 `app.saved()`，不来自页面读回 | 是 | ✓ FLOWING |

没有把读回当期望的自证。导入后的期望来自“被导入的内存文件”经 `expectedNormalize` 推导，再与 mock 后端实际收到的保存比较。

### Behavioral Spot-Checks

本阶段的可运行产物是 Playwright 用例。按资源限制没有重跑完整套件，使用下面几项：

| Behavior | Command | Result | Status |
|---|---|---|---|
| 完整套件的报告结论 | `node tools/test-report/check-report.mjs test-results/phase05-final.json --min-expected 154` | `REPORT OK expected=154 flaky=0 unexpected=0`；解析确认 154 条每条只跑 1 次、`skipped=0` | ✓ PASS |
| 本阶段 22 条新标题逐条状态 | 解析该报告的标题、状态、注解 | timeline 7、io/import 5、io/known-bugs 5、narrow 4、PROBE-8 1，全部在报告里；标记用例 B2、N3 的 expectedStatus 为 failed 且按预期失败，其余 passed | ✓ PASS |
| 已知 bug 与登记一致 | 同上 | 8 条标记用例与 KNOWN-BUGS.md 登记表一一对应，登记护栏 passed | ✓ PASS |
| 报告检查器自检 | `node tools/test-report/check-report.mjs --self-test` | `SELF-TEST OK` | ✓ PASS |
| 应用完整性 | `sha256sum` 对 `constants.ts` 的 `APP_SHA256`；`git ls-files` | 一致（2a954fd0…a1872），应用文件未被跟踪 | ✓ PASS |
| 受保护文件未被修改 | `git log` 从 c96c1cb 起对应用、tests/fixtures、test.ts、app.ts、tests/mocks、package.json、package-lock.json、playwright.config.ts | 无提交 | ✓ PASS |
| 隐私检查 | `node tools/privacy/privacy-check.mjs --self-test`、`--all` | 自检通过 69 项；`--all` 通过，161 个文件，65 个个人计划词条 | ✓ PASS |
| 防护 grep | `waitForTimeout`、可见性断言、`.check(`、截图、`setTimeout`、`fs.`、`console.`（timeline、io、narrow、timeline.ts、import-file.ts）；TBD、FIXME、XXX（tests、tools 的本阶段改动文件）；盘符路径和邮箱（本阶段改动文件，不含评审文档） | 无命中（“fakepath”只作为不带盘符的形式描述出现在 PROBES.md、KNOWN-BUGS.md、注释里） | ✓ PASS |

没有对任何测试做变异或去标记重跑（资源限制）。去掉标记的亲眼复现只核对了 05-04 的记录、KNOWN-BUGS.md 的描述和报告里的 expectedStatus，已在 P-2 里声明。

### Probe Execution

SKIPPED：本阶段计划没有声明 `probe-*.sh` 类探针。（PROBE-1 到 PROBE-8 是 Playwright 用例，已包含在完整套件里。）

### Requirements Coverage

PLAN frontmatter 的 requirements 字段合起来是 TL-01、TL-02（05-01）、IO-04、IO-05（05-02、05-04）、RESP-01（05-03）。REQUIREMENTS.md 的追踪表把这 5 项全部映射到 Phase 5，没有孤立需求。

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TL-01 | 05-01 | 时间线按月倒序列出记录和完成的计划；没有内容时显示空状态提示 | ✓ SATISFIED | timeline.spec.ts 的总览、空状态、跨年、联动用例 |
| TL-02 | 05-01 | 按类别筛选，也可以只看“完成的计划” | ✓ SATISFIED | timeline.spec.ts 的类别、完成计划、无记录类别用例 |
| IO-04 | 05-02、05-04 | 导入确认后替换，取消不变，非 JSON 提示错误 | ✓ SATISFIED | import.spec.ts 的确认、取消、非 JSON、往返；B2、N3 已登记 |
| IO-05 | 05-02 | 带旧类别名的数据导入后迁移到新类别 | ✓ SATISFIED | import.spec.ts 的 IO-05 用例 |
| RESP-01 | 05-03 | 手机宽度下四处关键布局 | ✓ SATISFIED | narrow.spec.ts 四条 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| 本阶段 tests、tools 的改动文件 | - | TBD、FIXME、XXX、固定睡眠、可见性断言、`.check(`、截图 | - | 无命中 |
| 三轮评审的 10 条 INFO（见 05-REVIEW-DISPOSITION.md，状态 open） | - | IN-01 到 IN-10 | ℹ️ Info | 见下，均不阻塞 |

3 条 WARNING（WR-01 窄屏终态条件、WR-02 B2 对照的“没有写入”断言、WR-03 N3 标记用例的断言）已修复，我读了对应代码，修复到位（见补充 must-haves 与 truth 4）。

### Human Verification Required

四条合并的判断型禁止项确认，见 frontmatter 的 `human_verification`（P-1 隐私、P-2 透明、P-3 安全、P-4 范围与收尾安全）。我的非权威判断均为“成立”。没有需要人眼看的视觉判断：窄屏布局由计算样式和位置断言，不依赖主观观感。

### Gaps Summary

没有缺口，没有 BLOCKER，没有 WARNING。需要你知道的三个弱点，都是已记录的 Info，不影响目标达成：

1. **IN-10 窄屏选日滚动用例的 at-bottom 分支不能区分 `block` 取值。** 最终报告里这条用例走的就是 at-bottom 分支（`#wkComp` 是窄屏下页面最后一块，滚不到顶）。它证明了“点日期后页面滚动，composer 顶部进入视口”，但如果应用把 `block:"start"` 改成 `"nearest"` 或 `"end"`，这个用例仍会通过。黑盒约束下（不改页面 DOM）无法消除，已在 spec 注释和评审记录里如实写明。
2. **IO-05 的“各视图”实际覆盖本周和时间线。** 日历 chip 只带类别颜色类、不带类别名，目标视图不显示记录类别，所以没有单独断言；它们依赖的是同一份已断言的保存状态。
3. **文档小瑕疵（IN-05、IN-06、IN-07 等）**：README 对 `import-file.ts` 数据形状的描述与实现略有出入，KNOWN-BUGS.md 同时把 B8 列为未验证又说 N3 的根因是 B8，PROBES.md 的记录日期没有随 PROBE-8 更新。另有 IN-02：`expectedTimeline` 的两处规则与应用不完全等价，只对规整输入成立，所以不能当成对任意畸形输入的规格。

已知 bug N3（导入 `{}` 并确认后数据被清空）按用户决定登记为已知 bug，有对照用例加 `test.fail` 标记用例，应用保持只读。

---

_Verified: 2026-11-04_
_Verifier: Claude (gsd-verifier)_
