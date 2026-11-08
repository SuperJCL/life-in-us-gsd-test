# 隐私说明

## 1. 为什么需要这份文档

本仓库会公开到 GitHub。公开之后，内容可能被缓存、fork 或索引，无法收回。因此：

- 仓库里不能出现本机路径、真实邮箱、真实数据或个人计划文字（D-09）。
- 应用文件 `us-journey-tracker.html` 已经去掉个人计划，只含合成的示例计划，所以它在仓库里；所有者的原计划只留在本机（D-10）。提交或推送应用文件需要本机有种子 `private/plan-seed.json`，没有种子时隐私检查会阻止（见 § 5 的种子闸门）。

为了避免靠自觉，仓库带了一套自动检查：`.gitignore` 先把这些文件挡在门外，pre-commit 和 pre-push 钩子再做第二、第三道检查。

## 2. 永远不提交的内容

| 内容 | 原因 |
|------|------|
| 应用文件的改名副本 `us-journey-tracker.*.html`（原件副本只放 `private/`） | 可能带着原来的个人计划（D-12） |
| 真实备份 `*备份*.json`，以及应用导出的 `在美国的日子-*.json`、`在美国的日子-*.csv` | 含真实数据 |
| `private/` 目录 | 本机私有内容，例如 `private/denylist.txt`、`private/plan-seed.json`（原计划种子）和 `private/us-journey-tracker.original.html`（原应用的副本） |
| `.claude/settings.local.json` 和 GSD 安装文件 | 本机设置；`.claude/` 下只跟踪 `.claude/CLAUDE.md`（D-12） |
| `.agents/`、`.codex/` 和根目录的 `AGENTS.md` | 其他 AI 工具的安装文件，里面有含本机用户名的绝对路径；`.gitignore` 忽略它们，规则 A 也会拦下强行暂存的这些路径 |
| `.env*` | 环境变量和密钥 |
| PocketBase 数据目录 `pb_data/`、`pb_backups/`、数据库文件（`*.db`、`*.db-wal`、`*.db-shm`、`*.sqlite`）、压缩包和 PocketBase 程序文件 | 含真实数据或备份；程序文件不该进仓库（规则 A 和 `.gitignore` 双重拦截） |
| 探针页的 `tools/probe/page/config.js` | 由服务器脚本生成，含探针账号凭据；仓库里只放占位的 `config.example.js` |
| `test-results/`、`playwright-report/`、`blob-report/` | 截图和 trace 会拍到个人计划文字（D-02），失败证据只留在本地 |
| 文件内容里的本机绝对路径、真实邮箱和个人计划文字 | 由检查器的规则 B、C、D 拦截 |

## 3. 自动检查怎么工作

检查器是 `tools/privacy/privacy-check.mjs`，只用 Node.js 内置模块，不需要安装任何依赖。

规则：

- 规则 A（`A-forbidden-path`）：文件路径属于上表中不能提交的类型。根目录的应用文件放行（它已去个人化，个人内容由规则 D 挡住），子目录里的同名文件和改名副本一律禁止。
- 规则 B（`B-abs-path`）：内容里出现 Windows、macOS 或 Linux 的本机用户目录路径。`<用户名>`、`...`、`$USER` 这类占位写法不算。
- 规则 C（`C-email`）：内容里出现真实邮箱。GitHub noreply 地址、example.com 系列地址和 `@2x.png` 这类文件名不算。
- 规则 A 的扩展：路径里有 `pb_data` 或 `pb_backups` 目录、文件是数据库（`.db`、`.db-wal`、`.db-shm`、`.db-journal`、`.sqlite`、`.sqlite3`）、压缩包（`.zip`、`.tar`、`.tgz`、`.gz`、`.bz2`、`.xz`、`.7z`、`.rar`），或文件名正好是 `pocketbase`、`pocketbase.exe` 时一律禁止。不按 “backup” 这个词拦（`tests/fixtures/legacy-positional-backup.json` 是合成夹具），`pb_migrations/`、`pb_hooks/`、`pb_public/` 照常放行。
- 规则 D（`D-plan-term`）：内容里出现个人计划词条，不区分大小写。词条只在运行时读取，仓库里不保存。服务器的 IP 和域名也记在本机 `private/denylist.txt`，由这条规则拦截，提交说明里写了也会被推送检查挡住。
- 规则 E（`E-author-email`）：提交的作者或提交者邮箱不是 GitHub noreply 地址。只在推送时检查。
- 规则 F（`F-token-shape`）：内容里出现令牌形状：三段 base64url、前两段以 `eyJ` 开头、每段至少 10 位（PocketBase 的登录令牌就是这个形状）。没有签名段、只有两段和 `eyJ...` 这类省略写法不报。
- 规则 G（`G-secret-assign`）：密码类键名后面写着真实值。键名词表是 `password`、`passwd`、`pwd`、`secret`、`encryption_key`、`api_key`、`apikey`、`private_key`、`access_key`；覆盖引号字面量、`export` 和 systemd `Environment=` 的环境变量、ini 或 yaml 的裸值、`superuser create|upsert|update` 命令里的口令参数和私钥头 `BEGIN … PRIVATE KEY`。占位写法放行：少于 6 个字符、`<…>`、全星号、全 `x`、`...`、以 `$` 开头的变量、`{{…}}`、`%NAME%`、`__NAME__`、含 `change_me`、`placeholder`、`redacted`、`dummy`、`your-` 的值、`null`、`true`、`false`、`process.env`、`os.environ`；ini 或 yaml 的裸值还放行 `a.b.c` 这类属性访问。反引号不当引号，所以 markdown 行内代码不会误报。
- 规则 H（`H-public-ipv4`）：内容里出现公网 IPv4 形状。放行的保留段是 `0.`、`10.`、`127.`、`255.`、`169.254.`、`172.16.`–`172.31.`、`192.168.`、文档段 `192.0.2.`、`198.51.100.`、`203.0.113.`，以及 `N.0.0.0`（浏览器版本串）。五段版本号和某段超过 255 的也不算。

钩子：

- pre-commit 运行 `--staged`，检查暂存区里的文件。
- pre-push 运行 `--push`，检查即将推送的每个提交，包括作者和提交者邮箱、提交说明和文件内容。
- 两个钩子只调用检查器，规则随检查器更新，钩子文件本身不改。

推送时要求作者和提交者邮箱都是 GitHub noreply 地址。可以只在本仓库设置：`git config user.email "<ID>+<用户名>@users.noreply.github.com"`。

输出不会泄露内容：

- 规则 D 只输出“个人计划词条 #N”。
- 规则 B 的用户名显示为 `<用户名>`，规则 C 和 E 的邮箱只保留首字母。
- 规则 F、G、H 只输出位置、规则名和固定文案，不输出令牌、口令、键名或地址。

手动检查：

- 全量检查：`node tools/privacy/privacy-check.mjs --all`
- 自检：`node tools/privacy/privacy-check.mjs --self-test`
- 钩子演练：`node tools/privacy/hook-drill.mjs` 在 `os.tmpdir()` 下的一次性仓库里真跑 pre-commit 和 pre-push，确认令牌、口令、数据库、压缩包、域名和 IP 都会被拦下，干净的提交和推送照常通过，最后一行是 `HOOK DRILL OK`。演练的样本全部运行时拼接，不打印；违规历史在启用钩子之前提交，演练不绕过任何钩子，结束后删除临时目录。
- 输出过滤：`tools/privacy/redact.mjs` 把服务器步骤的输出、探针结果和要提交的文档里的域名、服务器 IP 和令牌替换成占位，`--check` 只报告是否还有敏感值（详见该文件的文件头）。

## 4. 克隆后怎么启用

钩子保存在 `.githooks/`，克隆后需要手动启用一次：

```sh
git config core.hooksPath .githooks
```

这条命令只影响本仓库，不要加 `--global`。钩子需要 Node.js；找不到 Node.js 时，钩子会阻止提交和推送，而不是放行。启用后可以运行 `node tools/privacy/privacy-check.mjs --self-test` 确认检查器工作正常。

## 5. 本地 `private/` 目录、本地种子和 `private/denylist.txt`

- `private/` 和其中的文件（`private/denylist.txt`、`private/plan-seed.json`、`private/us-journey-tracker.original.html`）都被 git 忽略，只存在于本机。
- denylist 每行一个词条，`#` 之后是注释，空行会被忽略。
- 规则 D 的词条在运行时从本地种子文件 `private/plan-seed.json` 里提取（只看其中的 `plan` 对象，含汉字、至少 4 个字、去掉结尾冒号），再加上 `private/denylist.txt` 里的词条。仓库里不写死任何词条，也不设放行名单或豁免。
- 种子由 `node tools/plan/extract-plan.mjs` 从 `private/us-journey-tracker.original.html` 生成。这份副本是改动应用之前另存的原应用文件（D-12），同样被 git 忽略。
- 规则 D 不读应用文件（D-06），所以应用里的示例计划不会挡住应用文件自己的提交。
- 示例计划与种子不能共享文字和数字：运行 `node tools/plan/extract-plan.mjs --check` 检查。它只输出字段路径、字符偏移、词条序号和行号，不输出计划文字；全部为 0 时输出 `CHECK OK`。
- 种子闸门（fail closed）：检查范围里（暂存区、待推送的提交或 `--all` 的范围）有根目录的 `us-journey-tracker.html`，而本机没有 `private/plan-seed.json` 时，检查以退出码 2 阻止提交或推送，因为规则 D 此时无法确认应用里不含个人计划。种子文件损坏同样以退出码 2 阻止。
- 没有个人计划的人可以手动建一份空种子 `{"v":1,"plan":{}}`，明确表示选择加入。空种子不加载任何词条，建了空种子的人自己负责应用里没有个人内容。
- 不涉及应用文件的提交不受闸门影响。此时没有种子也没有 denylist，规则 D 会跳过并在 stderr 提示，不算失败。
- 改了名的应用副本（`us-journey-tracker.*.html`）一律被规则 A 拦住，只能留在 `private/`。

## 6. 不要绕过检查

禁止用 `git commit --no-verify` 或 `git push --no-verify` 绕过检查。遇到误报时，应该改写内容，或者调整本地的 denylist，而不是跳过钩子。

## 7. 局限

钩子在客户端运行，仍然可能被跳过或没有启用。建议在 GitHub 账号设置里打开 “Keep my email addresses private” 和 “Block command line pushes that expose my email”，让服务器端再挡一道。

规则 D 是子串匹配：把域名或地址拆开写、带前导零写，或者写成十六进制的地址，都拦不住。IPv6 地址也不会自动识别：服务器的 nginx 监听了 IPv6，所有者要手动把服务器的 IPv6 地址加进 `private/denylist.txt`。真正的保护是不把这些值写进任何被跟踪的文件，检查器只是最后一道防线。

## 9. 夹具里怎么写假令牌和假口令

新规则上线后，测试夹具、假服务器和文档里不能出现完整的令牌或口令字面量，否则检查器会拦下自己的提交：

- JWT 形状的样本在运行时用 base64url 拼接：头和载荷用 `Buffer.from(JSON.stringify(...)).toString('base64url')` 生成，签名段留空或运行时生成。
- 测试口令写成 `<…>` 占位，或者在运行时用数组 `join` 拼接。
- 地址用 TEST-NET 保留段（`192.0.2.x`、`198.51.100.x`、`203.0.113.x`），域名用 `.example`。
- 需要“公网形状”的样本时，运行时拼接，不要把完整地址写进源码。

## 8. 后续计划

第 7 阶段（Phase 7）已把个人计划移出应用：应用里只有合成的示例计划，所有者的原计划只在本机的种子里，应用文件随仓库提供。应用文件第一次提交只在本机完成；推送到公开仓库之前仍要所有者另外确认。
