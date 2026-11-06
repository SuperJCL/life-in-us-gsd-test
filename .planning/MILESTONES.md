# Milestones

## v1.0 本地测试环境（Local Test Harness） (Shipped: 2026-11-05)

**Phases completed:** 5 phases, 20 plans, 10 tasks

**Key accomplishments:**
- Playwright 1.64.1 驱动本机 Edge 156，通过零依赖 127.0.0.1 静态服务器，在网络护栏、死代理和固定时钟保护下跑通本地模式 IO-01「记一笔、刷新后还在」往返用例
- 每道护栏都有故意违规的自检：外部请求、页面异常、console.error 会让用例失败，固定时钟、sha256 基线、单文件白名单、忽略规则和合成标记各有用例证明，缺少应用文件时服务器给出中文提示后以退出码 1 结束
- AppHarness 收拢本地模式用例（没有 window.claude、四个标签、导出按钮隐藏、种子 reload 不覆盖），六项探针每次运行都跑：解析层和死代理层都被证明，字体 preconnect 在这台 Edge 上没有发出，已如实记录为推断
- 中文 tests/README.md 写清了运行、看报告和网络护栏分层；连续两次交付配置运行 25 条用例结果完全一致且 flaky 为 0；隐私全量检查通过；用户亲自确认 UI 模式能回放 IO-01、show-report 能打开报告，全程没有任何安装提示
- 静态服务器加 Host 白名单和方法限制，guard 改为按条删除并覆盖 WebSocket 与后开的 page，“启动不写 localStorage”改用 manual 时钟证明，6 个 WARNING 与 4 个 INFO 修完并更新处置记录。
- 页面侧 `window.claude` mock（按契约 0.2.96，只做正常路径）加 Node 侧 MockBackend，经 `exposeBinding` 往返；AppHarness 新增可自证的账户模式，常驻反向对照和 PROBE-7 证明它不会静默回退，也证明 binding 在 init 阶段已可调用。
- 完整合成 fixture（11 条记录、各种任务状态、自定义待办、力量历史、复盘、预设标签）经账户 mock 加载并在本周、时间线、目标三个视图里找到；旧类别名、最小状态、内存里的畸形导入常量作为边界数据就位，全部期望值由推导函数得出。
- 账户模式下两种导出都经 downloads.save 进入 MockBackend 并在内存里比较：JSON 备份与去掉 _synthetic 的 fixture 和最新保存的文档深度相等；日历 CSV 与按规格独立生成的整份期望逐字相等，三行手写金标准同时约束应用和生成器；连续导出幂等，每个用例从空 mock 开始。
- 8 条契约自测证明 02-02 的 window.claude mock 符合运行时契约 0.2.96，没有发现偏差；tests/mocks/CONTRACT.md 写明版本、已实现条目（33 行逐字原文摘录，脚本核对）、未实现清单、mock 结构和重新核对步骤，README 新增“账户模式”一节。
- 按根节点参数化的 composer helper（本周 w、日历日面板 c）、只在 Node 侧比较的 toast helper 和统一两种存储模式的 `app.saved()`/`expectSaved()` 已就位；用它们完成六条 WEEK-03 和三条 WEEK-04 用例，内置预设只按序号在页面内操作，失败输出不含个人计划文字。
- 本周视图的标题、范围、五类计数、目标行和 7 列内容由独立推导逐项验证，周导航、选中某天、dragTo 拖放（断言保存后的日期）和复盘的保存与按周独立都有用例，B4 在 manual 时钟下登记为 test.fail 的一对用例。
- `editor(page)` helper 封装了编辑弹窗；用它从本周、日历、时间线三个入口修改记录并检查三个视图同步，在 manual 时钟下证明取消、Escape、点遮罩和空文字都不会保存，验证了删除加撤销和合成自定义计划的完成日期、改回未完成；README 补全了共享 helper 与已知 bug 约定。
- `knownBug` helper、B1 和 N1 两对用例、中文的 KNOWN-BUGS.md 登记表和双向核对的登记护栏已就位；两个 bug 都在去掉标记后亲眼复现，都用 `test.fail` 标记。
- 用 Date.UTC 独立推导月历网格和日面板，一次页面内读回整月逐格比较，覆盖 35、42 格、chip 顺序、月份导航、日面板分区、记一笔、删除加撤销和 5 秒过期，B1 在日历日面板的实例按成对用例登记，并新增 json 报告检查器让 flaky 无处藏身。
- 用独立的 expectedGroup 从 fixture 推导七个目标组，一次页面内读回整体比较；四张力量卡只读序号、LIFT_IDS 里的 id、数值和布尔，点保存、按 Enter、达标与不达标的 toast（只比较后缀和片段）、100% 上限和 manual 时钟下的“失焦和负数不保存”都有用例，全程不出现任何力量名称和目标数值。
- 内置任务只在页面内按位置 id 勾选、改截止日期并读回布尔、日期和固定文案，组计数、进度条和日历整月格子全部由保存后的状态推导；取消勾选、过去今天将来和清空的截止日期、自定义待办的增删（连同任务状态）和空白不添加都有用例，N1 在日面板删除记录和目标页勾选任务两种触发各补一对 test.fail 用例并登记，README 与 KNOWN-BUGS 的约定同步更新，Phase 4 的九项需求全部有用例。
- 时间线用一次页面内读回加独立推导 expectedTimeline 做比较：“全部”按月倒序、五个类别、“完成的计划”、两种空状态、跨年月份、新增记录和勾选待办后的联动共七条用例，完整套件 139 条全部通过、0 flaky。
- 导入用 synth- 内存文件加“先注册对话框、再选文件、poll 等消息”的固定顺序，覆盖确认替换、取消、四种非备份文件、导出再导入的往返和旧类别迁移五条用例，期望由 expectedNormalize 独立推导；完整套件 144 条全部通过、0 flaky。
- 520 × 900 视口下四条 RESP-01 用例（底部面板、圆点、纵向排列、选日滚动）全部通过，只读计算样式和位置；README 和 KNOWN-BUGS 做了里程碑收尾更新；最后一次完整套件 154 条通过、0 flaky。
- 先用 PROBE-8 证明 Playwright 复现不了“再选同一个文件没反应”，所以 B2 只断言确定性的 #importJson value；B2 和 N3 都先去掉标记亲眼复现，再按成对用例标 test.fail 并登记；完整套件 150 条通过、0 flaky。


**Timeline:** 2026-11-01 → 2026-11-05
**Requirements:** 43/43 v1 requirements complete
**Closeout type:** override_closeout
**Known verification overrides:** 4 newly acknowledged, 0 carried forward
- Phase 1–4 的 VERIFICATION.md 在收尾时被判为过期（stale）：后续阶段改过它们覆盖的共享文件（tests/README.md、tests/KNOWN-BUGS.md、tests/PROBES.md、tests/support/expect-from-fixture.ts、strings.ts 等）。每个阶段当时都验证通过；最终全套运行在 HEAD 上 `REPORT OK expected=154 flaky=0 unexpected=0`，包含 Phase 1–4 的全部用例。用户在 2026-11-05 选择记录后直接收尾，不重验。

**Deferred（非阻塞）:**
- 代码审查 INFO 未处理：Phase 1 有 3 条，Phase 2 有 7 条，Phase 3 有 8 条，Phase 4 有 4 条，Phase 5 有 10 条（见各阶段 *-REVIEW-DISPOSITION.md）。
- Phase 1 没有 SECURITY.md（安全审计未运行）；Phase 2–5 均为 threats_open 0。
- IN-10：窄屏选日滚动用例分不出 scrollIntoView 的 block 取值（黑盒约束下无法消除）。
- 原 Phase 6（个人内容外置加本地私有查看页）已移除，被下一个里程碑的多账号云端版取代。

---
