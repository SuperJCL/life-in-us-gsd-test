# Phase 1: 测试环境、护栏与本地切片（Harness & Local Slice） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-01
**Phase:** 1-测试环境、护栏与本地切片（Harness & Local Slice）
**Areas discussed:** 运行体验, GitHub 与隐私（用户中途提出）, 语言与命名

---

## 运行体验

### 快捷脚本（多选）

| Option | Description | Selected |
|--------|-------------|----------|
| test:ui | Playwright UI 模式，可以逐步回放每个操作 | ✓ |
| test:headed | 弹出 Edge 窗口，能看着测试运行 | |
| test:debug | 用 Playwright Inspector 逐步调试 | |
| report | 打开上一次的 HTML 报告 | |

### 失败证据

| Option | Description | Selected |
|--------|-------------|----------|
| 失败时留 trace + 截图 | 只在失败时保留，排查最方便 | ✓ |
| 只留截图 | 体积小，但看不到操作过程 | |
| 什么都不留 | 隐私最大化 | |

### 报告

| Option | Description | Selected |
|--------|-------------|----------|
| 终端列表 + HTML 报告 | HTML 报告不自动弹出 | ✓ |
| 只要终端输出 | 不生成 HTML | |
| 失败时自动打开报告 | Playwright 默认行为，会卡住命令行 | |

### 重试

| Option | Description | Selected |
|--------|-------------|----------|
| 不重试（推荐） | 不稳定的测试会立刻暴露 | |
| 重试 1 次 | 偶发失败不影响结果，报告里标为 flaky | ✓ |

**Notes:** 用户选了重试 1 次。CONTEXT.md 规定 flaky 的用例一律当缺陷处理。

---

## GitHub 与隐私

用户在讨论中途提出：想把项目放到 GitHub 上，以后由 Claude 负责维护隐私，最好有一套在本地保存和显示信息的机制。

| Question | Options | Selected |
|----------|---------|----------|
| 仓库可见性 | 私有（推荐） / 公开 | 公开 |
| 应用文件 | 暂不上库（推荐） / 原样上库 | 暂不上库 |
| 本地机制（多选） | 提交前隐私检查 / 个人内容外置 / 私有目录 + 查看页 | 三项都选 |
| 作者邮箱 | 换成 noreply 代替地址（推荐） / 保持 gmail | 换成代替地址（用户先问了这是什么，听完解释后再选） |
| 外置和私有目录放在哪里 | 下一个里程碑（推荐） / 加进当前里程碑 | 加进当前里程碑 |
| 护栏和推送的时机 | 讨论完第 1 阶段再做（推荐） / 现在先做 | 讨论完再做 |

**Notes:** 用户不清楚提交作者邮箱是什么，Claude 解释了它的作用和 noreply 地址后，用户才做了选择。

---

## 语言与命名

| Question | Options | Selected |
|----------|---------|----------|
| 测试标题语言 | 中文（推荐） / 英文 | 英文 |
| 标题带需求编号 | 带（推荐） / 不带 | 带 |
| 注释和说明文档语言 | 中文（推荐） / 英文 | 中文 |
| 编程语言 | TypeScript（推荐） / JavaScript | TypeScript |

---

## Claude's Discretion

- 探针失败怎么办（用户没选这个话题）：Edge 驱动不了就停下来问用户；其他探针失败时直接改用 SUMMARY.md 里的备选方案，结论记在 `tests/PROBES.md`。
- `tests/` 的目录细节、helper 怎么拆、`tests/README.md` 的结构。

## Deferred Ideas

- 新增第 6 阶段：个人内容外置，加上本地私有目录和查看页（要改应用，用户同意放进当前里程碑）。
- `/gsd-quick`：建立隐私护栏、清理文档、改用 noreply 地址并重写提交、推送到公开仓库。
