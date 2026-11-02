---
phase: 261101-mh6-privacy-guard-github-public
plan: 01
subsystem: privacy
tags: [privacy, git-hooks, gitignore, public-repo]
provides:
  - 基础 .gitignore（应用原文件、备份类 JSON、private/、.claude GSD 安装、测试产物）
  - 零依赖隐私检查器 tools/privacy/privacy-check.mjs（--staged / --all / --push / --self-test）
  - 版本化钩子 .githooks/pre-commit 与 .githooks/pre-push（本仓库 core.hooksPath）
  - 中文隐私说明 PRIVACY.md
  - 已提交文档中的本机路径与真实备份文件名清理
affects: [phase-01-harness-local-slice, phase-06]
actuals:
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [运行时从本地应用文件提取个人计划词条，词条不入库；输出只显示编号与脱敏信息]
key-files:
  created: [.gitignore, .gitattributes, .githooks/pre-commit, .githooks/pre-push, tools/privacy/privacy-check.mjs, PRIVACY.md]
  modified: [.planning/PROJECT.md, .planning/research/FEATURES.md, .planning/research/PITFALLS.md, .planning/research/SUMMARY.md, .planning/config.json]
key-decisions:
  - 用户决定：允许直接提交到默认分支（git.allow_default_branch_commits: true）
  - 用户决定：本仓库作者改为 SuperJCL <noreply 地址>（只改本仓库配置，不动全局）
completed: 2026-11-01
status: complete
---

# Quick Task 261101-mh6: 隐私护栏 Summary

**仓库现在有一套提交前和推送前的隐私检查：本机路径、真实邮箱、真实备份、应用原文件和个人计划文字都会被拦下。已跟踪文件全部扫描干净。**

## Performance
- **Tasks:** 3（全部完成并验证）
- **Files:** 新建 6 个，修改 5 个

## Accomplishments
- `node tools/privacy/privacy-check.mjs --self-test` 通过（69 项）。`--all` 扫描 26 个已跟踪文件，0 处问题；规则 D 加载了 65 个个人计划词条，只在运行时从本地应用文件提取，不写入仓库。
- 负面探针：暂存一个带本机绝对路径的文件，pre-commit 返回 1 并拦下，输出里不含用户名。
- pre-push 模拟：作者是非 noreply 邮箱的提交被拒绝（输出已脱敏）；noreply 身份的提交能通过。
- 清理了文档里的 4 处本机绝对路径和 2 处真实备份文件名。

## Commits
- `chore(privacy): add gitignore, privacy checker and git hooks`
- `docs(privacy): add PRIVACY.md and scrub local paths from planning docs`
- `chore(config): allow commits on the default branch`
- `chore(privacy): mark git hooks executable`。第一个提交用的是 pathspec 提交，丢了可执行位，这个提交把它补回来。

## Deviations
- **[Rule 1 - Bug] 根提交上 `--push` 失败。** `git diff-tree --root` 会把提交号混进路径列表。加上 `--no-commit-id` 后修好，并重新跑过验证。
- **提交被 GSD 拦下。** 执行者提交时，被受保护分支的检查拦住：默认分支不允许执行者直接提交。用户随后决定允许直接提交，并改用 SuperJCL 和 noreply 身份，提交由 orchestrator 完成。所有提交都经过了 pre-commit 钩子，没有使用 `--no-verify`。

## Follow-ups
- 推送前，orchestrator 要重写历史：把旧提交的作者改为 noreply，并清理旧提交里的本机路径和备份文件名。重写后用 `--push` 模拟扫描全部历史。
- pre-push 不检查 tag 对象的 tagger 信息和 tag 说明（已知局限）。
- 克隆仓库后需要运行 `git config core.hooksPath .githooks` 启用钩子（PRIVACY.md 里有说明）。
