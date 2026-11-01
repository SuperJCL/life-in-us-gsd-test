# 在美国的日子 — 本地测试实验

## What This Is

「在美国的日子」是一个从 Claude Artifact 导出的个人单文件网页应用（`us-journey-tracker.html`），用来每天记录语言、专业、健身、求职方面的进展，有本周、日历、目标、时间线四个视图。本项目是一次 **GSD 工作流学习实验**：在本地副本上为它搭建 Playwright 浏览器测试环境和 Claude Artifact API（`db` / `user` / `downloads`）的 mock，用合成数据验证现有功能。原托管的 Claude Artifact 始终保持不动。

## Core Value

不改应用代码、不接触原 Artifact 和真实数据，用一条命令就能在本地浏览器里自动验证四个视图都能正常渲染和交互。

## Requirements

### Validated

<!-- 现有应用已具备的能力（从代码推断，见 .planning/codebase/）。本里程碑只测试，不改动。 -->

- ✓ 设置抵达日期，页头显示“来美国第 N 天”或“还有 N 天出发” — existing
- ✓ 本周视图：五个类别的本周统计和目标、7 天记录列、点选某天补记、拖拽记录换日期、本周复盘文本 — existing
- ✓ 日历视图：月历格子显示记录/到期/完成标记，切换月份，选中某天后在日面板记录和查看 — existing
- ✓ 目标视图：四项力量目标的当前值和历史，P1–P7 目标组的任务勾选、截止日期、过期提示、自定义待办增删、进度条 — existing
- ✓ 时间线视图：按月倒序列出记录和完成的计划，按类别筛选 — existing
- ✓ 记一笔：类别切换、预设标签一键记录或预填、标签的添加/删除/撤销 — existing
- ✓ 编辑弹窗：修改记录的文字、类别、日期，删除并可撤销；修改完成计划的日期或改回未完成 — existing
- ✓ 存储：在 Claude 中用 `db` 按用户保存一个文档，没有 `window.claude` 时回退到 `localStorage` — existing
- ✓ 导出日历 CSV 和 JSON 备份（需要 `downloads`），从 JSON 备份恢复 — existing

### Active

<!-- 第一个里程碑：只搭测试，不改应用。 -->

- [ ] 本地 Playwright 测试环境：项目内 npm devDependency，使用本机 Edge，一条命令运行全部测试并生成报告
- [ ] Claude Artifact API mock：在页面脚本运行前注入假的 `window.claude`，模拟 `db`、`user`、`downloads` 的正常路径；也能测试“没有 `window.claude`”的本地模式
- [ ] 合成测试数据：自己编造的 fixture，覆盖五个类别、完成/到期/过期任务、自定义待办、力量历史、本周复盘
- [ ] 四个视图（本周、日历、目标、时间线）的渲染和交互测试，覆盖尽量完整（包括编辑弹窗、拖拽、撤销、导入导出）
- [ ] 测试安全护栏：测试运行时拦截所有外部网络请求，只用合成数据，绝不连接生产存储

### Out of Scope

- 修改 `us-journey-tracker.html` 应用源码 — 本里程碑是黑盒测试；代码改动放到以后的里程碑，并需要单独批准
- 修复 `.planning/codebase/CONCERNS.md` 里列出的问题（XSS、草稿丢失、导入重置、保存重试、任务 id 依赖顺序、256 KiB 上限等） — 留作后续里程碑
- mock 的错误路径（db 读取或保存失败、下载被拒绝、限流等） — 按用户选择，本里程碑只做正常路径
- 访问、修改、重新发布托管的 Claude Artifact — 保护原应用
- 使用真实个人数据或连接生产存储 — 隐私和安全
- 发布、部署、CI 流水线 — 本实验只在本地运行
- 引入 React、Next.js 或其他框架 — 保持原单文件结构
- 全局安装或改全局配置（包括下载 Playwright 浏览器到用户级缓存） — 未经批准不做

## Context

- **现有代码：** 只有一个文件 `us-journey-tracker.html`（669 行，HTML、CSS、JS 都在里面，没有构建、没有依赖、没有测试）。详细分析在 `.planning/codebase/`（STACK、INTEGRATIONS、ARCHITECTURE、STRUCTURE、CONVENTIONS、TESTING、CONCERNS）。
- **Claude API 依赖：** `window.claude.use("db")` 读写 `data/users/<id>/state` 一个文档；`use("user")` 只用 `id()`；`use("downloads")` 只用 `save({filename, data})`。三者都可能是 `null`，应用已有回退逻辑。真实接口契约参考了 Artifact 运行时 0.2.96 的类型定义。
- **本地行为：** 直接打开文件时没有 `window.claude`，应用用 `localStorage`（key `us-journey-tracker-v1`），导出按钮不会出现，只有“恢复”可用。
- **已知问题会影响测试：** 比如在本周视图打草稿后再点别的日期，草稿会丢失；取消导入后再选同一个文件没反应。测试应该描述当前真实行为，碰到已知 bug 时标记出来（例如 Playwright 的 `test.fail` / `test.fixme`），而不是去改应用。
- **界面语言：** 全中文，测试选择器会用到中文文本和 ARIA 标签。
- **环境：** Windows 11，Node v24.20.0，npm 11.19.0，已安装 Microsoft Edge 和 Google Chrome。
- **Git：** 仓库在 `master` 分支，还没有任何提交。
- **之前存在过的真实备份文件**（文件名不记录）现在已不在目录中，从未被读取；测试中禁止使用任何真实备份。

## Constraints

- **应用源码**：本里程碑不修改 `us-journey-tracker.html` — 学习 GSD 并保护原 Artifact，测试必须是黑盒
- **托管 Artifact**：不访问、不修改、不发布 — 原应用只存在于 claude.ai 上
- **数据**：只用合成数据，不连接任何生产存储 — 隐私
- **技术栈**：不引入 React、Next.js 等框架；测试用 Playwright Test — 用户明确要求
- **安装**：只在项目内安装 npm devDependency；用本机 Edge（`channel: 'msedge'`），不下载浏览器；任何全局安装或配置改动都要先批准 — 用户明确要求
- **网络**：测试运行时拦截所有外部请求（包括 Google Fonts） — 结果可重复，并确保不会碰到线上服务
- **流程**：生成项目计划和路线图后停下，等用户批准再执行 — 用户明确要求

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 第一个里程碑只做测试，不改应用代码 | 学习完整 GSD 流程，同时保证原 Artifact 和应用代码安全 | — Pending |
| 用本机 Edge（`channel: 'msedge'`）跑 Playwright | 不下载浏览器、不做全局安装 | — Pending |
| Mock 只做正常路径 | 用户选择；错误路径的测试留到后续 | — Pending |
| 视图交互覆盖尽量完整 | 用户选择；包括编辑弹窗、拖拽、撤销、导入导出 | — Pending |
| 只用合成数据 | 隐私，不触碰真实个人数据 | — Pending |
| 已知 bug 不修，在测试里标记 | 控制范围；修复留到后续里程碑 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-01 after initialization*
