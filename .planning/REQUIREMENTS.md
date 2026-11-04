# Requirements: 在美国的日子 — 本地测试实验

**Defined:** 2026-11-01
**Core Value:** 不改应用代码、不接触原 Artifact 和真实数据，用一条命令就能在本地浏览器里自动验证四个视图都能正常渲染和交互。

## v1 Requirements

第一个里程碑的需求，每一条都会对应到路线图中的某个阶段。这里的“用户”指运行测试的开发者（你）；“应用”指 `us-journey-tracker.html`，它在本里程碑中始终保持不变。

### Environment

- [x] **ENV-01**: 开发者在项目目录运行一条命令（`npm test`），就能用本机 Edge 跑完全部测试，并得到一份本地 HTML 报告（不自动弹出）
- [x] **ENV-02**: 安装只增加项目内的 devDependency（`@playwright/test` 精确版本，加上 lockfile），不下载浏览器、不做全局安装、不改全局配置
- [x] **ENV-03**: 测试通过本地静态服务器加载页面，该服务器只监听 127.0.0.1，只提供 `us-journey-tracker.html`
- [x] **ENV-04**: 每次运行都固定“今天”、时区和语言，结果可以重复

### Safety

- [x] **SAFE-01**: 测试运行时所有外部网络请求都被拦截；一旦出现允许列表之外的外部请求，测试失败
- [x] **SAFE-02**: 测试能证明 `us-journey-tracker.html` 没被改动（与记录的 sha256 基线比对）
- [x] **SAFE-03**: 仓库通过 `.gitignore` 忽略测试产物和备份类 JSON；所有 fixture 都带合成数据标记，并有测试检查这一点
- [x] **SAFE-04**: 页面出现未预期的 JS 错误时，测试失败

### Claude API Mock

- [x] **MOCK-01**: 测试可以在“本地模式”下打开应用：没有 `window.claude`，可以预置 localStorage
- [x] **MOCK-02**: 测试可以在“账户模式”下打开应用：注入的 `window.claude` mock 按真实契约提供 `use("db")`、`use("user")`、`use("downloads")`（异步返回、命名空间冻结、未知名字返回 `null`），只实现正常路径
- [x] **MOCK-03**: 账户模式下，测试能读到 mock 记录的 db 读写，数据在页面刷新后仍然保留
- [x] **MOCK-04**: 账户模式下导出按钮会出现，测试能读到 `downloads.save` 收到的文件名和内容
- [x] **MOCK-05**: 测试能证明自己真的跑在账户模式（状态栏文案、读写记录、localStorage 中没有应用的键），不会因为应用静默回退到 localStorage 而误通过
- [x] **MOCK-06**: mock 对齐的契约版本（0.2.96）、已实现和未实现的部分，记录在仓库内的 `tests/mocks/CONTRACT.md`

### Synthetic Data

- [x] **DATA-01**: 提供一份合成的完整状态 fixture，覆盖：
  - 五个类别的记录；
  - 包含特殊字符的文本；
  - 已完成、已过期、今天到期、将来到期的任务；
  - 自定义待办；
  - 力量历史；
  - 本周复盘；
  - 预设标签的增删
- [x] **DATA-02**: 提供边界 fixture：旧类别名、最小状态、畸形导入文件

### Week View

- [x] **WEEK-01**: 本周视图正确渲染标题、日期范围、五个类别的统计和目标、7 天记录列
- [x] **WEEK-02**: 用户可以切换上一周、下一周、本周，并选中某一天作为记录日期
- [x] **WEEK-03**: 用户可以用“记一笔”记录：切换类别、用预设标签直接记录或预填、按 Ctrl+Enter 提交；记录会出现在对应日期并被保存
- [x] **WEEK-04**: 用户可以添加预设标签，在编辑模式下删除，并通过 toast 撤销删除
- [x] **WEEK-05**: 用户把一条记录拖到另一天后，记录日期改变并被保存
- [x] **WEEK-06**: 本周复盘文本会被保存，刷新后仍在

### Calendar View

- [x] **CAL-01**: 日历正确渲染月份网格：周日起始、今天高亮、抵达日标记、记录 chips 和 “+N”
- [x] **CAL-02**: 用户可以切换月份、回到今天，点格子选中日期（点相邻月份的格子会跳到那个月）
- [x] **CAL-03**: 日面板显示当天的记录、完成的计划和到期任务，用户可以在日面板里记一笔
- [x] **CAL-04**: 用户可以在日面板删除记录，并通过 toast 撤销

### Goals View

- [ ] **GOAL-01**: 目标视图渲染力量卡片和 P1–P7 目标组（完成计数、进度条）
- [ ] **GOAL-02**: 用户更新力量值（点保存按钮或按 Enter）后，显示最近的历史和达标提示
- [ ] **GOAL-03**: 用户勾选或取消任务；勾选时完成日期记为今天，进度随之更新
- [ ] **GOAL-04**: 用户可以设置截止日期，过期后显示“已过期”
- [ ] **GOAL-05**: 用户可以添加和删除自定义待办；内置任务没有删除按钮

### Timeline View

- [ ] **TL-01**: 时间线按月倒序列出记录和完成的计划；没有内容时显示空状态提示
- [ ] **TL-02**: 用户可以按类别筛选，也可以只看“完成的计划”

### Editor & Cross-view

- [x] **EDIT-01**: 用户从本周、日历、时间线点任意记录都能打开编辑弹窗，修改文字、类别、日期并保存后，所有视图同步更新
- [x] **EDIT-02**: 用户可以在编辑弹窗里删除记录并撤销；内容为空时不能保存
- [x] **EDIT-03**: 在完成计划的编辑弹窗里，用户可以修改完成日期，或改回未完成

### Persistence & Import/Export

- [x] **IO-01**: 本地模式下数据保存到 localStorage，刷新后仍在；导出按钮隐藏
- [x] **IO-02**: 账户模式下导出的日历 CSV 内容正确（表头、MM/DD/YYYY 日期、引号和逗号转义）
- [x] **IO-03**: 导出的 JSON 备份内容与当前状态一致
- [ ] **IO-04**: 用户导入 JSON 备份时，确认后全部数据被替换；取消则数据不变；选择非 JSON 文件时提示错误
- [ ] **IO-05**: 带旧类别名的数据导入后，会迁移到新的类别

### Responsive

- [ ] **RESP-01**: 在手机宽度下，少量关键用例通过：编辑弹窗变成底部面板、日历 chips 变成圆点、本周日期纵向排列、选中某天后滚动到“记一笔”

### Known Bugs

- [x] **BUG-01**: 测试碰到的已知 bug 用统一方式标记：一条窄断言加上 `test.fail` 或 `test.fixme`，并附 `known-bug` 注解；登记在 `tests/KNOWN-BUGS.md`，与 `.planning/codebase/CONCERNS.md` 对应；不修改应用

## v2 Requirements

已经识别，但不放进本次路线图。

### Mock Error Paths

- **ERR-01**: mock 可以模拟 db 读取失败，测试验证应用回退到 localStorage
- **ERR-02**: mock 可以模拟 db 保存失败（如 `invalid_argument`），测试验证状态栏的错误提示
- **ERR-03**: mock 可以模拟下载被拒绝（`declined`）和限流（`rate_limited`）
- **ERR-04**: mock 可以模拟加载延迟，用来复现“加载完成前的编辑被丢弃”

### Extra Coverage

- **XTRA-01**: 键盘操作路径（Enter/Space 激活、Escape 关闭）
- **XTRA-02**: 暗色模式配色检查
- **XTRA-03**: 安全探针（导入备份导致的 HTML 注入、CSV 公式注入），载荷必须无害
- **XTRA-04**: `file://` 直接打开文件的冒烟测试

### App Fixes（后续里程碑）

- **FIX-01**: 修复 `.planning/codebase/CONCERNS.md` 中的问题：转义与导入校验、草稿丢失、导入重置、保存重试、复盘丢失、任务 id 依赖顺序、存储大小上限、本地导出等

## Out of Scope

| Feature | Reason |
|---------|--------|
| 修改 `us-journey-tracker.html` | 本里程碑只做黑盒测试；改应用要放到后续里程碑并单独批准 |
| 访问、修改、重新发布托管的 Claude Artifact | 保护原应用 |
| 真实个人数据、连接生产存储 | 隐私和安全；只用合成数据 |
| 发布、部署、CI 流水线 | 本实验只在本地运行 |
| React、Next.js 或其他框架 | 保持原有的单文件结构，用户明确要求 |
| 全局安装、下载 Playwright 浏览器、改全局配置 | 用户明确要求，未经批准不做 |
| 像素截图对比 | 会把个人计划内容带进快照和报告 |
| 跨浏览器矩阵 | 只用本机 Edge；Chrome 只作为备用通道 |

## Traceability

需求和阶段的对应关系，由路线图生成时填写。每条 v1 需求只对应一个阶段。

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 1 | Complete |
| ENV-02 | Phase 1 | Complete |
| ENV-03 | Phase 1 | Complete |
| ENV-04 | Phase 1 | Complete |
| SAFE-01 | Phase 1 | Complete |
| SAFE-02 | Phase 1 | Complete |
| SAFE-03 | Phase 1 | Complete |
| SAFE-04 | Phase 1 | Complete |
| MOCK-01 | Phase 1 | Complete |
| MOCK-02 | Phase 2 | Complete |
| MOCK-03 | Phase 2 | Complete |
| MOCK-04 | Phase 2 | Complete |
| MOCK-05 | Phase 2 | Complete |
| MOCK-06 | Phase 2 | Complete |
| DATA-01 | Phase 2 | Complete |
| DATA-02 | Phase 2 | Complete |
| WEEK-01 | Phase 3 | Complete |
| WEEK-02 | Phase 3 | Complete |
| WEEK-03 | Phase 3 | Complete |
| WEEK-04 | Phase 3 | Complete |
| WEEK-05 | Phase 3 | Complete |
| WEEK-06 | Phase 3 | Complete |
| CAL-01 | Phase 4 | Complete |
| CAL-02 | Phase 4 | Complete |
| CAL-03 | Phase 4 | Complete |
| CAL-04 | Phase 4 | Complete |
| GOAL-01 | Phase 4 | Pending |
| GOAL-02 | Phase 4 | Pending |
| GOAL-03 | Phase 4 | Pending |
| GOAL-04 | Phase 4 | Pending |
| GOAL-05 | Phase 4 | Pending |
| TL-01 | Phase 5 | Pending |
| TL-02 | Phase 5 | Pending |
| EDIT-01 | Phase 3 | Complete |
| EDIT-02 | Phase 3 | Complete |
| EDIT-03 | Phase 3 | Complete |
| IO-01 | Phase 1 | Complete |
| IO-02 | Phase 2 | Complete |
| IO-03 | Phase 2 | Complete |
| IO-04 | Phase 5 | Pending |
| IO-05 | Phase 5 | Pending |
| RESP-01 | Phase 5 | Pending |
| BUG-01 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-01*
*Last updated: 2026-11-01 after roadmap creation（traceability 已填写）*
