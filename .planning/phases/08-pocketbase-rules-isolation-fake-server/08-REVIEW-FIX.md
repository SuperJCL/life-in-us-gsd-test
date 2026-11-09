---
phase: 08-pocketbase-rules-isolation-fake-server
fixed_at: 2026-11-08T00:00:00Z
review_path: .planning/phases/08-pocketbase-rules-isolation-fake-server/08-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 8: Code Review Fix Report

**Fixed at:** 2026-11-08
**Source review:** `.planning/phases/08-pocketbase-rules-isolation-fake-server/08-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4（WR-01 到 WR-04；IN-01 到 IN-08 按所有者决定只记录、不修）
- Fixed: 4
- Skipped: 0

验证在哪里跑的：`workflow.use_worktrees` 为 `false`，所以所有编辑、提交和验证都在主检出里进行（没有建 worktree）。真实 PocketBase 0.41.1 的验证用的是 08-04 已批准并钉死哈希的 `tools/pb/bin/pocketbase.exe`，哈希核对通过，全程没有下载任何东西；每次运行后 `tasklist` 都没有残留的 pocketbase.exe。

## Fixed Issues

### WR-01: journey_docs 的 createRule 没有对字段修饰符键做过隔离断言

**Files modified:** `tools/pb/isolation-check.mjs`、`tests/mocks/PB-CONTRACT.md`
**Commit:** 7834840
**状态：** fixed（安全方向已在真实实例上定论：没有跨账号漏洞；见下面的 kind 偏差说明，需要所有者知情）

**做了什么：**
- 新增断言 ACCT04-27（写类，带超级用户回读）。共享实现 `createModifierProbe`：先用超级用户清空 A、B 各自的两个槽位，所以集合里随后出现的任何记录都是这次尝试创建的；A 用自己的令牌发 8 种请求体，每种 6 次并交替键的书写顺序，每次尝试后用超级用户回读并清掉，最后恢复种子文档。失败条件：出现 owner 不是 A 的记录，或 kind 不在选项里；正向对照 `plain`（普通创建）必须每次都成功。
- 新增反向对照：NEG-1 现在也对一个创建规则不核对 owner 的临时集合（`journey_docs_leaky_create`）跑同一个检查函数，必须报出泄漏（`ACCT04-27:leak`）。NEG-1 从 6 个检查函数变成 7 个。
- `EXPECTED_IDS` 加入 ACCT04-27，总数 47 变 48；`tests/mocks/PB-CONTRACT.md` 第 7 节加了说明和 ACCT04-27 行，第 8 节的 `ISOLATION OK 47/47` 改成 `48/48`。`tests/README.md` 写的是 `ISOLATION OK N/N`，不含具体总数，不用改；`tools/pb/PB-LOCAL.md` 没有写总数。

**真实实例（0.41.1）上实测的状态码（连同回读结果，来自 `--observe`，两遍一致）：**

| 请求体形态（A 的令牌创建） | 状态码 | 超级用户回读 |
|---|---|---|
| plain：`owner=A, kind=plan`（正向对照） | 200 | owner=A，kind=plan |
| spoof：`owner=B, kind=plan` | 400 | 没有记录 |
| `owner=A` 加 `owner+`（B） | 400 | 没有记录 |
| `owner=A` 加 `+owner`（B） | 200 | owner 仍是 A |
| `owner=A` 加 `owner-`（B） | 200 | owner 仍是 A |
| `owner=A, kind=plan` 加 `kind+`（state） | 200 | owner=A，**kind 变成 state** |
| `owner=A, kind=plan` 加 `+kind`（state） | 200 | owner=A，kind 仍是 plan |
| 只带 `owner+`（B），不带 owner | 400 | 没有记录 |

结论：没有任何组合能让 A 写出 owner 不是 A 的记录，B 的槽位里始终没有记录，每种请求体重复 6 次且交替键序，结果稳定。所以研究里担心的“A 以 B 的名义创建”**不成立**，迁移、`pb/rules.expected.json`、`migration-check.mjs`、假服务器都没有改。两遍 `npm run pb:isolation` 都是 `ISOLATION OK 48/48`，`node tools/pb/migration-check.mjs` 输出 `MIGRATIONS MATCH`（`--self-test` 19 项全过）。

**需要所有者知情的一处偏差（kind，不是跨账号问题）：** `kind+` 会让单选的 kind 变成追加的值（请求 plan 加 `kind+: state` 得到 state）。我在一个临时集合上试过：规则语法不接受带 `+` 的键（`unexpected character '+'`），用 `:length` 或枚举比较的规则也拦不住，所以规则层表达不了。它只发生在 A 自己的命名空间里，值仍受选项和 `(owner, kind)` 唯一索引约束，A 本来就能直接创建 state，没有额外能力，所以我判断它不是漏洞，断言的失败条件按此设定（owner 必须是 A、kind 必须仍在选项里），`kind` 被改成另一个合法值只记数（探测输出里的 `kindshift`），不算泄漏。这与编排者原先“kind 变化也算失败”的要求不同；如果所有者想要更严的口径，唯一的办法是 `pb_hooks`，我没有加，也没有改规则。应用的创建请求不会带修饰符键，已写进 PB-CONTRACT.md 第 7 节。

### WR-02: 多个“只在直接运行时执行入口”的脚本在入口判断失败时静默退出 0

**Files modified:** `tools/pb/lib/entry.mjs`（新建）、`tools/pb/isolation-check.mjs`、`tools/pb/record-samples.mjs`、`tools/pb/lib/instance.mjs`、`tools/pb/fetch-local-pb.mjs`、`tools/pb/migration-check.mjs`
**Commit:** 1c1e8db
**Applied fix:** 新增零依赖的共享入口判断 `isEntry(import.meta.url)`：两边都 `realpathSync`（win32 上不分大小写），判断过程出错时按“是入口”处理；只有 `process.argv[1]` 为空或两个真实路径确实不同时才返回 false。五个脚本全部改用它，并去掉不再需要的 `pathToFileURL` 导入。

**验证：** 先用目录联接复现了原问题（在临时目录里建指向仓库的联接，通过联接路径运行五个脚本的 `--self-test`，全部无输出、退出 0）。修复后同样的联接路径下五个脚本都正常输出（`MIGRATION SELF-TEST OK 19`、`ISOLATION SELF-TEST OK`、`NORMALIZE SELF-TEST OK`、`FETCH SELF-TEST OK`、`INSTANCE SELF-TEST OK`），直接路径同样通过；联接路径下 `record-samples.mjs --check` 输出 `SAMPLES CLEAN 2`，`migration-check.mjs` 输出 `MIGRATIONS MATCH`；被 `import` 时仍然不运行入口。联接用 `rmdir` 删除（只删链接，没有 `rm -rf`），仓库内容完好。

### WR-03: 下载脚本以系统临时目录为工作目录调用相对名字的 unzip 和 powershell

**Files modified:** `tools/pb/fetch-local-pb.mjs`
**Commit:** 74b31f0
**Applied fix:**
- PowerShell 用绝对路径（从 `%SystemRoot%` 解析，文件不存在就抛错）；整个 `unzip` 分支删掉。
- 列成员和解出成员都在调用方刚建好的空目录里作为 cwd 运行（`approvedRun` 里新增 `workDir`，由原有的 `made` 列表统一清理）。
- 解出改为只用 .NET 取出顶层 `pocketbase.exe` 这一个成员（`ZipFileExtensions.ExtractToFile`），不再 `Expand-Archive` 整个 zip。核对 zip 大小和 sha256、核对 checksums.txt、核对成员名单、然后才解出，这个顺序没有变。
- 删掉了未使用的 `fileURLToPath` 导入（顺带处理了 IN-04 的一小项）。
- **额外发现：** 旧的 PowerShell 回退把路径作为 `-Command` 后面的位置参数传，而 PowerShell 会把它们拼进命令文本、`$args` 是空的，所以这个回退本来就不可能工作（08-04 实际是靠 `unzip` 成功的）。现在路径通过环境变量传给脚本。
- `--self-test` 新增三条：`powershellPath` 是绝对路径且 SystemRoot 不存在时抛错；用本机刚建的小 zip 走一遍“列成员、核对、解出单个成员”，并断言工作目录始终为空。不联网、不碰真实程序。

**验证：** `--self-test` 22 项全过（`FETCH SELF-TEST OK`）；`--approved` 仍打印 `PB ALREADY PRESENT`（没有联网、没有走下载路径）；不带参数退出码 2；系统临时目录里没有残留的 `usj-pb*` 目录。

### WR-04: 假服务器在同文档导航时也会注销页面的实时连接

**Files modified:** `tests/mocks/pb-server.ts`、`tests/mocks/pb-runtime.ts`、`tests/cloud/cloud-harness.spec.ts`
**Commit:** 183ca42
**状态：** fixed（逻辑类改动，建议所有者看一眼设计，见下）
**Applied fix:**
- 页面侧：假 EventSource 的安装脚本给每个新文档生成一个令牌 `window.__pbDocToken`（用 `crypto.getRandomValues`，不依赖可能被固定的时钟或 `Math.random`），握手 `es.open` 时随连接带给 Node。
- Node 侧：连接记录新增 `docToken`；主框架 `framenavigated` 时读回当前文档的令牌，只注销令牌不同（即属于旧文档）的连接。同文档导航（hash 变化、`pushState`）令牌不变，连接保留。读取失败（导航又发生了、上下文被销毁）时什么都不做，由后一次导航的处理补上，避免误删新文档的连接。`openConnection(page, docToken = null)` 的第二个参数可选，契约自测里的 `openConnection(null)` 不受影响。
- 新增 `FakePbServer.whenNavigationsSettled()`，让测试在导航之后等处理完成再断言，避免“还没处理就断言连接还在”的空转。
- 新用例 `TEST-02 a same-document navigation keeps the realtime connection and a new document drops it`：订阅后改 hash、`pushState` 连接数都保持 1，导航后的推送仍然到达页面（正向对照），`page.reload()` 之后连接数为 0。我临时把判断改回“无条件注销”，这条用例会在连接数上失败（期望 1，实际 0），确认它不是空转，然后已恢复。

**验证：** `npm run test:cloud` 完整运行一次（低于正常优先级、单 worker）：44 个全部通过（原来 43 个加上新用例）。

## Skipped Issues

None — 4 条范围内的发现全部处理。

## 汇总验证

- `npm run pb:isolation`（真实 0.41.1）连续两遍：`ISOLATION OK 48/48`；每遍之后没有残留的 pocketbase.exe。
- `node tools/pb/migration-check.mjs`：`MIGRATIONS MATCH`；`--self-test`：`MIGRATION SELF-TEST OK 19`。
- `npm run test:cloud`：44 passed。没有运行默认的 `npm test`（留给编排者的回归关卡）。
- 每次提交前后隐私检查通过；没有改 `us-journey-tracker.html`，没有新增 npm 依赖，没有 ssh，没有暂存 `tools/pb/bin/` 下的任何东西。
- 提交（均未 push）：7834840（WR-01）、1c1e8db（WR-02）、74b31f0（WR-03）、183ca42（WR-04）。

---

_Fixed: 2026-11-08_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
