# 隐私说明

## 1. 为什么需要这份文档

本仓库会公开到 GitHub。公开之后，内容可能被缓存、fork 或索引，无法收回。因此：

- 仓库里不能出现本机路径、真实邮箱、真实数据或个人计划文字（D-09）。
- 应用文件 `us-journey-tracker.html` 的源码里写死了个人计划，所以它只留在本机，不进入 git（D-10）。

为了避免靠自觉，仓库带了一套自动检查：`.gitignore` 先把这些文件挡在门外，pre-commit 和 pre-push 钩子再做第二、第三道检查。

## 2. 永远不提交的内容

| 内容 | 原因 |
|------|------|
| 应用文件 `us-journey-tracker.html` | 源码里写死了个人计划（D-10） |
| 真实备份 `*备份*.json`，以及应用导出的 `在美国的日子-*.json`、`在美国的日子-*.csv` | 含真实数据 |
| `private/` 目录 | 本机私有内容，例如 `private/denylist.txt` |
| `.claude/settings.local.json` 和 GSD 安装文件 | 本机设置；`.claude/` 下只跟踪 `.claude/CLAUDE.md`（D-12） |
| `.env*` | 环境变量和密钥 |
| `test-results/`、`playwright-report/`、`blob-report/` | 截图和 trace 会拍到个人计划文字（D-02），失败证据只留在本地 |
| 文件内容里的本机绝对路径、真实邮箱和个人计划文字 | 由检查器的规则 B、C、D 拦截 |

## 3. 自动检查怎么工作

检查器是 `tools/privacy/privacy-check.mjs`，只用 Node.js 内置模块，不需要安装任何依赖。

规则：

- 规则 A（`A-forbidden-path`）：文件路径属于上表中不能提交的类型。
- 规则 B（`B-abs-path`）：内容里出现 Windows、macOS 或 Linux 的本机用户目录路径。`<用户名>`、`...`、`$USER` 这类占位写法不算。
- 规则 C（`C-email`）：内容里出现真实邮箱。GitHub noreply 地址、example.com 系列地址和 `@2x.png` 这类文件名不算。
- 规则 D（`D-plan-term`）：内容里出现个人计划词条。词条只在运行时读取，仓库里不保存。
- 规则 E（`E-author-email`）：提交的作者或提交者邮箱不是 GitHub noreply 地址。只在推送时检查。

钩子：

- pre-commit 运行 `--staged`，检查暂存区里的文件。
- pre-push 运行 `--push`，检查即将推送的每个提交，包括作者和提交者邮箱、提交说明和文件内容。

推送时要求作者和提交者邮箱都是 GitHub noreply 地址。可以只在本仓库设置：`git config user.email "<ID>+<用户名>@users.noreply.github.com"`。

输出不会泄露内容：

- 规则 D 只输出“个人计划词条 #N”。
- 规则 B 的用户名显示为 `<用户名>`，规则 C 和 E 的邮箱只保留首字母。

手动检查：

- 全量检查：`node tools/privacy/privacy-check.mjs --all`
- 自检：`node tools/privacy/privacy-check.mjs --self-test`

## 4. 克隆后怎么启用

钩子保存在 `.githooks/`，克隆后需要手动启用一次：

```sh
git config core.hooksPath .githooks
```

这条命令只影响本仓库，不要加 `--global`。钩子需要 Node.js；找不到 Node.js 时，钩子会阻止提交和推送，而不是放行。启用后可以运行 `node tools/privacy/privacy-check.mjs --self-test` 确认检查器工作正常。

## 5. 本地 `private/` 目录和 `private/denylist.txt`

- `private/` 和其中的 `private/denylist.txt` 都被 git 忽略，只存在于本机。
- denylist 每行一个词条，`#` 之后是注释，空行会被忽略。
- 规则 D 的词条在运行时从本地应用文件的 CATS、GROUPS、LIFTS 中提取（含汉字、至少 4 个字），再加上 denylist 里的词条。仓库里不写死任何词条。
- 两个来源都没有时，规则 D 会跳过并在 stderr 提示，不算失败。

## 6. 不要绕过检查

禁止用 `git commit --no-verify` 或 `git push --no-verify` 绕过检查。遇到误报时，应该改写内容，或者调整本地的 denylist，而不是跳过钩子。

## 7. 局限

钩子在客户端运行，仍然可能被跳过或没有启用。建议在 GitHub 账号设置里打开 “Keep my email addresses private” 和 “Block command line pushes that expose my email”，让服务器端再挡一道。

## 8. 后续计划

应用文件在第 6 阶段（Phase 6，计划中）把个人内容外置之前，只在本机保存。这一节只说明计划，本仓库目前没有实现任何外置内容。
