# Phase 5: 时间线、导入与窄屏（Timeline, Import & Narrow） - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Mode:** smart discuss（自动模式）。用户在 2026-11-03 选择第 3–5 阶段的灰区“直接采用推荐”，以下推荐答案全部按已接受记录。N3 的期望行为由用户另外决定过（算已知 bug）。

<domain>
## Phase Boundary

本阶段是这个测试里程碑的最后一个阶段，交付四部分：

- **时间线视图：**
  - 按月倒序列出记录和完成的计划；
  - 没有内容时显示空状态；
  - 可以按类别筛选，也可以只看“完成的计划”。
- **JSON 备份导入：**
  - 确认后全部数据被替换，取消后数据不变；
  - 选非 JSON 文件时出现错误提示；
  - 导出后再导入，数据保持一致；
  - 带旧类别名的数据导入后迁移到新类别。
- **手机宽度（约 520 × 900）下的关键布局：**
  - 编辑弹窗变成底部面板；
  - 日历 chip 变成圆点；
  - 本周日期纵向排列；
  - 选中某天后页面滚动到“记一笔”。
- **本阶段的已知 bug：** B2 和 N3。

阶段结束时，`npm test` 跑完全部用例，除了 `tests/KNOWN-BUGS.md` 里登记的标记用例，其余全部通过；`us-journey-tracker.html` 的 sha256 仍等于基线。

需求：TL-01、TL-02、IO-04、IO-05、RESP-01。

本阶段不做：
- 修改应用；
- mock 的错误路径和加载延迟（v2）；
- 拖拽和窄屏下的拖拽；
- Phase 6（个人内容外置）。

</domain>

<decisions>
## Implementation Decisions

### 沿用的已定决定（来自 ROADMAP、用户决定和前四个阶段，不再讨论）
- **D-01:** B2（取消导入后，再选同一个文件没有反应）先做一个小 spike，确认 `setInputFiles` 对同一个文件是否还会派发 `change`。
  - 应用的成因：取消时 `return` 跳过了 `e.target.value=""`（约 656–658 行）。
  - 期望断言写成确定性的：取消后 `#importJson` 的 `value` 应该为空。能复现就用 `knownBug(...)` 标记成 `test.fail`。
  - 不要去断言“`change` 会再次触发”，这在 Playwright 里很可能总会派发，结果不稳定。
  - 只有确实无法稳定复现时，才用 fixme，并写明原因。
- **D-02:** N3（导入 `{}` 这类合法 JSON 并确认后，全部数据被清空）由用户在 2026-11-03 决定算已知 bug：期望应用拒绝这类不像备份的文件。用例分两条：
  - 对照用例：证明导入流程确实走到了处理函数。比如断言出现了确认对话框，或者出现了某个 toast；只断言与 bug 无关的前提。
  - `test.fail` 标记用例：只断言一条期望的正确行为，即“确认后 fixture 的记录仍然存在”或“出现格式错误提示”，二选一，由规划者决定。

  登记到 `tests/KNOWN-BUGS.md` 时，CONCERNS.md 里没有单独的 N3 条目，照 N1 的写法注明最接近的条目（导入校验过浅，research 的 B8），并保留 FEATURES.md 已知 bug 对照表里 N3 这个出处。
- **D-03:** 窄屏只用 `viewport`（约 520 × 900），不用设备描述符，也不测拖拽。
- **D-04:** 文件输入用内存 buffer，即 `setInputFiles({ name, mimeType, buffer })`。磁盘上不放任何像备份的文件；内存里的文件名也用合成名字，不含“备份”，也不以“在美国的日子-”开头。
- **D-05:** 导入用例要先注册对话框处理（`page.once('dialog', …)`），再触发导入，并断言确认框的文案。文案放在 `strings.ts`。
- **D-06:** 前几个阶段的约定照用：
  - 账户模式加 `full-state.json`；
  - 用 `expectSaved` 和 `app.saved()` 断言保存；
  - 需要推进计时器的用例才用手动时钟，并且不和 `setFixedTime` 混用；
  - 测试标题用英文并以需求编号开头，注释和文档用中文；
  - spec 只从 `tests/support/test.ts` 导入；
  - 资源限制：低优先级、1 个 worker，每份计划最多跑一次全套，用 `tools/test-report/check-report.mjs` 判定结果；
  - 除 `npx --no playwright` 外不跑任何 npx，不安装任何东西。
- **D-07:** 失败输出不能打印个人计划文字（Phase 2–4 的约定）。时间线里“完成的计划”条目显示“完成：”加内置任务原文，日历 chip 也带原文。所以对这类元素：
  - 只在页面内读回 id、类名、日期和数量，在 Node 侧做比较；
  - 不用定位器做动作，不用文字断言，也不用可见性断言；
  - 只有合成记录、合成自定义任务和固定界面文案可以用普通断言。

### 时间线（TL-01、TL-02）
- **D-08:** 用例放在 `tests/e2e/timeline/`。期望值由新的独立推导函数得出，例如在 `expect-from-fixture.ts` 里加 `expectedTimeline(state, filter)`，规则是：
  - 选“全部”时，显示全部记录，再加上已完成并且有完成日期的计划；
  - 选某个类别时，只显示这个类别的记录；
  - 选“完成的计划”时，只显示已完成的计划；
  - 按日期倒序排列，每个月前面有一个月份标题（“YYYY 年 M 月”）；
  - 条目上的日期格式是 `M/D`，这个 helper 已经有了（`timelineDateLabel`）。

  断言只比较读回的 `data-edit` / `data-edittask` id 顺序、月份标题和日期。
- **D-09:** 筛选按钮是 `#filters [data-filter]`，值来自 `strings.ts` 里的类别常量、“全部”和“完成的计划”。被按下的按钮带 `aria-pressed="true"`，其他的是 `false`。
- **D-10:** 空状态：用 `minimal-state.json` 打开，或者选一个没有记录的类别，`#timeline .empty` 显示空状态文案，文案放在 `strings.ts`。

### 导入（IO-04、IO-05）
- **D-11:** 用例放在 `tests/e2e/io/import.spec.ts`，覆盖六种情况：
  - **确认替换：** 导入一个合成备份，接受确认框后，保存下来的状态等于这个备份经 `normalize` 规则推导出的结果，并且出现 toast “已恢复”。
  - **取消：** 拒绝确认框后数据不变，用手动时钟加写入次数证明没有保存。
  - **非 JSON：** 用 `malformed-imports.ts` 里的内容，出现格式错误提示，数据不变。
  - **往返：** 导出 JSON（读 `downloads.save` 的记录），再把这份内容作为内存文件导入，接受后数据与导出前深度相等。
  - **旧类别迁移：** 导入 `legacy-categories.json`，记录被迁移到新类别（期望用 `expectedCategory` 推导），并在本周视图或时间线里按新类别显示。
  - **控制台：** 如果哪种导入情况会产生预期内的 console.error，用 `guard.remove` 定向处理，不放宽过滤规则（Phase 1 test.ts 的注释）。

### 窄屏（RESP-01）
- **D-12:** 用例放在 `tests/e2e/narrow/`，文件里写 `test.use({ viewport: { width: 520, height: 900 } })`。断言都通过 `page.evaluate` 读计算样式或位置，不靠截图：
  - 编辑弹窗是底部面板：`dialog#editor` 的宽度约等于视口宽度，下边缘贴住视口底部；
  - 日历 chip 是圆点：计算样式的 font-size 为 0，宽高约 7px；
  - 本周日期纵向排列：`.days` 只有一列，各日期列的 x 坐标相同、y 坐标递增；
  - 选中某天后滚动到“记一笔”：点击后 `#wkComp` 的顶部进入视口。应用用的是平滑滚动，所以用 `expect.poll` 等待，不用固定 sleep。
- **D-13:** 窄屏只做少量关键用例（4 条左右），不在窄屏下重复其他视图的完整断言。

### 阶段收尾
- **D-14:** 更新 `tests/README.md`，加上时间线、导入、窄屏三个目录，以及导入用例的注意事项：
  - 内存文件；
  - 先注册对话框处理；
  - B2 和 N3 两个已知 bug。
- **D-15:** 更新 `tests/KNOWN-BUGS.md`，加上 B2 和 N3 两行，并把“以后的阶段”一节改成里程碑收尾时的状态：哪些已知 bug 已经覆盖，哪些仍未验证（N1 的拖拽和改抵达日期触发、B3、B5–B10 等）。
- **D-16:** 本阶段最后一次全套运行：
  - 用 `check-report.mjs --min-expected <总数>`，确认除了登记过的标记用例以外全部通过、0 flaky；
  - 确认应用文件的 sha256 等于基线；
  - 隐私全量检查通过。

### Claude's Discretion
- spec 文件怎么拆、helper 叫什么名字、N3 的窄断言选哪一种（D-02），由规划者决定。
- B2 的 spike 结论写进 `tests/PROBES.md` 还是 KNOWN-BUGS.md，由规划者决定。

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/support/app.ts`：提供 `open({ mode:'account', seed })`、`saved()`、`expectSaved()`、`backend`（含 `downloads` 记录）、`expectAccountMode()`，同一页面只能 `open` 一次。
- `tests/support/toast.ts`：`expectToast`、`expectToastPrefix`、`expectToastSuffix`、`expectToastContains`、`expectToastGone`、`undo`。
- `tests/support/test.ts`：提供 `knownBug()`、`guard`（`guard.remove` 定向删除）、`clockMode: 'manual'`。
- `tests/support/expect-from-fixture.ts`：已有 `expectedCategory`、`timelineDateLabel`、`csvMismatch`/`maskTaskTexts`、`expectedCalendarCsv`、`monthGrid`、`eventsOnDate`、`expectedGroup` 等。
- `tests/support/fixture-files.ts`：`loadFixture`、`withoutSynthetic`。
- `tests/fixtures/`：完整状态 `full-state.json`、旧类别名 `legacy-categories.json`、最小状态 `minimal-state.json`；`malformed-imports.ts` 里是只放在内存里的畸形导入内容。
- `tests/e2e/io/export.spec.ts`：读取 JSON 和 CSV 导出记录的写法，导入的往返用例可以直接参照。
- `tools/test-report/check-report.mjs`：支持 `--min-expected`，并拒绝 flaky、跳过和部分运行。
- `tests/KNOWN-BUGS.md` 和登记护栏，护栏是双向核对的。

### Established Patterns
- 时间线由 `renderTimeline`（`us-journey-tracker.html` 约 529–541 行）渲染：
  - 筛选按钮是 `#filters [data-filter]`，带 `aria-pressed`；
  - 条目是 `.tl-item`，记录带 `data-edit`，完成的计划带 `data-edittask`；
  - 每个条目里有 `.tl-date`（`M/D`）、`.tag`、`.li-text`；月份标题是 `.tl-month`（“YYYY 年 M 月”）；
  - 没有内容时显示 `#timeline .empty`。
- 导入（约 656–658 行）：
  - `#importJson` 的 change 事件触发 `FileReader` 读文件，接着 `JSON.parse`，然后 `normalize`，再弹 `confirm(...)`；
  - 用户确认后，替换整个 state，然后 `persist`，再 `renderAll`，最后 toast “已恢复”；
  - 解析出错时 toast 格式错误；
  - 只有不走 `return` 的路径才会执行 `e.target.value=""`，这就是 B2。
- 断点：
  - 900px 以下：`.days` 变成一列，`pickDay` 在 `innerWidth<=900` 时用平滑滚动滚到 `#wkComp`（约 610 行）；
  - 820px 以下：日历布局变成一列；
  - 560px 以下：chip 变成圆点（约 148–152 行），编辑弹窗变成底部面板（约 213 行），任务行换一种布局（约 180 行）。

  读源码时用 grep 定位后按行号区间读，不要读约 298–330 行的个人计划常量。

### Integration Points
- 新目录：`tests/e2e/timeline/`、`tests/e2e/narrow/`；新文件：`tests/e2e/io/import.spec.ts`。
- 本阶段结束时，这个测试里程碑的 5 个阶段全部完成。Phase 6（个人内容外置）用户已同意放进当前里程碑，但还没加进 ROADMAP。所以本阶段之后**不执行** `complete-milestone`，等用户决定。

</code_context>

<specifics>
## Specific Ideas

- 往返用例的意义：证明导出的 JSON 能原样恢复，这正好对应“导出后再导入，数据保持一致”这条成功标准。
- B2 的窄断言：取消后 `#importJson` 的 `value === ''`。对照用例：取消后数据不变，并且确认框确实出现过。

</specifics>

<deferred>
## Deferred Ideas

- mock 的错误路径和加载延迟（ERR-01..04）、B3：v2。
- N1 的拖拽和改抵达日期两种触发、research 里的 B5–B10、导入 XSS（B6）和 CSV 公式注入（B7）：后续里程碑（修 bug 的里程碑）。
- Phase 6：个人内容外置，加上本地私有目录和查看页。

</deferred>
