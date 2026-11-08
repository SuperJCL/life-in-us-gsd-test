# Phase 6: 采购与中美可达性实测 - Pattern Map

**Mapped:** 2026-11-07
**Files analyzed:** 约 30（新建 24，修改 6）
**Analogs found:** 11 / 30 有真实 analog；其余（nginx、systemd、PocketBase 迁移、服务器 sh 脚本）无 analog，见 No Analog Found

隐私说明：本文件不含服务器 IP、域名、令牌、密码。一律写 `<domain>`、`<server-ip>`、`usj`。所有 analog 路径都已核对为 git 跟踪文件（`git ls-files` 非空）：`tools/privacy/privacy-check.mjs`、`tools/plan/extract-plan.mjs`、`tools/test-report/check-report.mjs`、`.githooks/pre-commit`、`.githooks/pre-push`、`.gitattributes`、`.gitignore`、`PRIVACY.md`、`tests/README.md`。`us-journey-tracker.html` 在本仓库可能仍被忽略，只作风格参考（`esc()` 在第 423 行），不是被修改对象。

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最接近的 analog | 匹配度 |
|---|---|---|---|---|
| `tools/privacy/privacy-check.mjs`（改：规则 F、G、H、规则 A 扩展、规则 D 大小写、`loadPlanTerms(roots)`、自检） | utility | batch | 同文件自身（`RULES`、`checkPath`、`scanText`、`runSelfTest`） | exact |
| `.gitignore`（改：pb_data 等） | config | — | 同文件“隐私护栏”分段（第 1-35 行） | exact |
| `.gitattributes`（改：加 `tools/probe/server/** text eol=lf`、`*.sh text eol=lf`） | config | — | 同文件第 1-4 行 | exact |
| `PRIVACY.md`（改：§2 表、§3 规则、§5 局限、夹具写法小节） | doc | — | 同文件 §2、§3、§5 | exact |
| `tools/probe/summarize.mjs`（新，带 `--self-test`） | utility（本地 CLI） | transform | `tools/test-report/check-report.mjs` | exact |
| `tools/probe/README.md`（新） | doc | — | `tests/README.md` | role-match |
| `tools/probe/page/index.html`（新） | component | request-response + event-driven（SSE） | `us-journey-tracker.html` 的 `esc()` 与内联脚本风格 | role-match |
| `tools/probe/page/probe.js`（新，纯函数部分可在 Node 自检） | utility | event-driven | `tools/test-report/check-report.mjs` 的纯函数 + `selfTest` 分离 | role-match |
| `tools/probe/page/config.example.js`（新，占位） | config | — | 无直接 analog；占位写法沿用规则 G 的放行表 | partial |
| `tools/probe/page/vendor/pocketbase.iife.js` + README（新，记 sha256） | vendor | — | 无 | none |
| `tools/probe/server/01..06-*.sh`（新，LF） | script | batch | `.githooks/pre-commit`（POSIX sh、fail closed 的风格） | partial |
| `tools/probe/server/verify.sh`（新） | script | request-response | `.githooks/pre-commit` | partial |
| `tools/probe/server/export-results.py`（新） | script | file-I/O | 无（仓库里没有 Python） | none |
| `tools/probe/server/pocketbase.service` | config | — | 无 | none |
| `tools/probe/server/nginx/usj-probe.conf`、`usj-probe-locations.conf` | config | streaming（SSE） | 无 | none |
| `tools/probe/server/pb_migrations/probe_schema.js.tpl`、`probe_user.js.tpl` | migration | CRUD | 无 | none |
| `.planning/phases/06-.../06-PROBE-RESULTS.md`（新） | doc | — | 无（格式由 RESEARCH § 结果文档的格式给出） | none |
| `.planning/PROJECT.md`、`REQUIREMENTS.md`、`ROADMAP.md`、`.claude/CLAUDE.md`（改：D-01） | doc | — | 各自现有段落 | exact |

## Pattern Assignments

### `tools/privacy/privacy-check.mjs`（utility，batch）— 规则 F、G、H 与规则 A 扩展

**Analog：** 同文件。新规则按现有格式追加，不另起结构。

**规则表**（第 44-50 行，加三个键，规则编号沿用字母）：
```javascript
export const RULES = {
  A: 'A-forbidden-path',
  B: 'B-abs-path',
  C: 'C-email',
  D: 'D-plan-term',
  E: 'E-author-email',
  // 新增：F: 'F-token-shape', G: 'G-secret-assign', H: 'H-public-ipv4'
};
```

**规则 A 扩展（路径）**（`checkPath`，第 54-71 行）。在 `if (base.startsWith('.env'))` 之前插入，沿用“返回原因字符串，否则 null”：
```javascript
if (base.startsWith('.env')) return '环境变量文件不能进入仓库';
return null;
```
新增判断用 RESEARCH § SEC-03 的 `DB_EXT`、`ARCHIVE_EXT`、段名 `pb_data`/`pb_backups`、文件名 `pocketbase`/`pocketbase.exe`。不要按 “backup” 词拦（`tests/fixtures/legacy-positional-backup.json` 是已跟踪的合成夹具）；不拦 `pb_migrations/`、`pb_hooks/`、`pb_public/`。同时在自检的 `pathPos`/`pathNeg`（第 592-604 行）各补正反例。

**规则 B/C 的扫描格式：新规则在 `scanText` 里逐行追加**（第 154-172 行）。命中只给位置、规则名、固定文案，不带原文：
```javascript
const emails = findEmails(line);
if (emails.length > 0) {
  findings.push({ location: where, rule: RULES.C, message: `疑似真实邮箱 ${emails[0]}` });
}
```
规则 F 的 message 固定为 `疑似令牌（JWT 形状）`；规则 G 固定文案，不带键名之外的任何值；规则 H 只写 `公网 IPv4 形状`，不写地址。`findX(line)` 做成导出的纯函数（沿用 `findAbsPaths`、`findEmails` 的写法），`scanText` 只调用。

**规则 D 大小写（D-18）**：当前第 166-171 行
```javascript
for (let t = 0; t < terms.length; t += 1) {
  if (line.includes(terms[t])) {
```
改为对 `line` 与词条同时 `toLowerCase()` 后再 `includes`（预先把 terms 小写化一次，避免每行重复）。`message` 仍只输出 `#${t + 1}`。

**`loadPlanTerms(roots)`**（第 395-422 行）：当前内部自己算 `roots`；改成 `loadPlanTerms(roots = defaultRoots())`，默认行为不变，这样自检能用临时目录里的 `private/denylist.txt`。

**自检写法**（`runSelfTest`，第 570-584 行）：`expect(name, ok)` 累计，样本运行时用 `join` 拼接，源码里不出现完整命中字面量。新增 F/G 样本也要这样写，否则检查器过不了自己：
```javascript
const expect = (name, ok) => { total += 1; if (!ok) failures.push(name); };
const winFwd = ['C:', 'Users', name, 'x'].join('/');
```
JWT 样本用 `Buffer.from(JSON.stringify({...})).toString('base64url')` 在运行时拼；密码样本拼成 `['pass', 'word'].join('') + '="' + ... + '"'`；同样要有“输出不含样本原文”的断言，抄第 611-615 行 `规则 B 输出不含用户名` 的形状。规则 D 的确定性自检（D-11）用 TEST-NET-3（`203.0.113.x`）和 `*.example` 合成值，抄 RESEARCH § 规则 D 的自检 的 6 条用例表。

**占位放行 `isPlaceholder`**：新函数，规则表见 RESEARCH § 规则 G。风格参考 `isAllowedEmail`（第 97-108 行：返回布尔，先排除白名单再返回 false）。

**入口与退出码**（第 788-818 行）不动：规则命中走 `result.findings` → 退出码 1，内部错误退出码 2。

---

### `.gitignore`（config）

**Analog：** 同文件分段注释风格（第 1-35 行）。

```
# --- 环境变量与密钥 ---
.env*
```
在其后按同样的“# --- 说明 ---”分段新增：`pb_data/`、`pb_backups/`、`*.db`、`*.db-wal`、`*.db-shm`、`*.sqlite`、`*.sqlite3`、`/pocketbase`、`pocketbase.exe`、`pocketbase_*.zip`、`tools/probe/page/config.js`，段首注释指回 `PRIVACY.md`。不要写裸 `pocketbase`（会连目录一起忽略）。

---

### `.gitattributes`（config）

**Analog：** 同文件第 1-4 行，每条前有一行中文注释说明原因。

```
# 系统级 core.autocrlf=true 会在检出时把钩子转成 CRLF，sh 解释器随后会报错，所以固定为 LF
.githooks/** text eol=lf
```
新增同格式两条：`tools/probe/server/** text eol=lf`、`*.sh text eol=lf`。注释写明原因：服务器脚本经 `ssh usj 'bash -s' < 文件` 执行，CRLF 会让 bash 报 `\r` 错。

---

### `tools/probe/summarize.mjs`（utility，transform）

**Analog：** `tools/test-report/check-report.mjs`（零依赖小 CLI）。

**文件头**（第 1-29 行）：shebang、用途段、用法段、判定列表、退出码、隐私约定，全中文注释，只 import `node:` 内置模块：
```javascript
#!/usr/bin/env node
// Playwright json 报告检查器：零依赖，只使用 node: 内置模块。
// ...
// 用法：
//   node tools/test-report/check-report.mjs <报告文件> [...]
//   node tools/test-report/check-report.mjs --self-test
// 退出码：0 通过；1 不通过（包括报告缺失或不是合法 JSON、参数不合法）。
// 隐私约定：只打印计数和标题 ...
import { readFileSync } from 'node:fs';
```
**入口分支**（第 125、228-251 行）：`selfTest()` 单独函数；`if (argv[0] === '--self-test') return selfTest();`；`process.exit(main(process.argv.slice(2)))`；用法错误输出 `usage:` 一行并返回 1。
**对 summarize 的要求：** 输入是从服务器导出的探针结果 JSON；输出 markdown 汇总表，只出现运营商、网络类型、`run_id` 前 4 位，不出现 IP、域名。判定按 D-06、D-07、D-18（每家运营商至少三分之二的次数达标）。自检只用合成数据。

**纯函数导出模式**可参考 `tools/plan/extract-plan.mjs` 第 22-40 行：`export const` 常量 + `export function` 纯函数，`pathToFileURL` 判断是否作为脚本直接运行，这样 `probe.js` 里的统计函数也能在 Node 里被 import 自检。

---

### `tools/probe/page/index.html` 与 `probe.js`（component，event-driven）

**Analog：** `us-journey-tracker.html`（纯 HTML/JS、无 CDN、无框架、IIFE、`esc()`）。

**转义函数**（第 423 行，探针页凡是把结果或运营商名放进 `innerHTML` 都走它；能用 `textContent` 就不用 innerHTML）：
```javascript
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
```
**约定（来自 CLAUDE.md Conventions）：** 一个 IIFE、不往 `window` 挂东西、`try { … } catch (e) {}` 包住可选能力（`localStorage`、`EventSource`）、错误用屏幕上的状态行显示而不是 `console.*`、辅助函数短名。**不同点：** 探针页用相对地址（`/api/...`、`./vendor/pocketbase.iife.js`、`./config.js`），不写域名；不引 Google Fonts（Pitfall 4，第三方资源被墙）；SDK 同源托管；不收集个人信息。D-09 的流程（选运营商和网络类型 → 测首屏 → 登录计时 → 10 分钟实时连接 → 上传 + 屏幕摘要）按 RESEARCH § Pattern 5 实现。

---

### `tools/probe/server/*.sh`（script，batch）

**Analog（仅风格）：** `.githooks/pre-commit`。

```sh
#!/bin/sh
# pre-commit 钩子：运行隐私检查器的 --staged 模式。
# 找不到 node 或检查器出错时一律阻止提交（fail closed）。
cd "$(git rev-parse --show-toplevel)" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "找不到 node，已阻止提交，请安装 Node.js 后重试" >&2
  exit 1
fi
exec node tools/privacy/privacy-check.mjs --staged
```
沿用：首行 shebang、文件头中文注释说明用途和失败策略、前置条件检查后失败信息写 stderr 并非零退出（fail closed）。**不同点：** 服务器脚本用 bash（经 `bash -s` 执行），开头 `set -euo pipefail`，不得 `set -x`，不回显口令；LF 行尾由 `.gitattributes` 保证。逐步顺序和每步内容见 RESEARCH § 安装与配置顺序 S0-S7（S1 双重校验哈希、S4 失败自动恢复 nginx 备份且 `certbot renew --dry-run` 必须成功）。

---

### 文档同步：`PRIVACY.md`、`tests/README.md`（doc）

**`PRIVACY.md`：** 已有章节 `## 2. 永远不提交的内容`（第 12 行，表格）、`## 3. 自动检查怎么工作`（第 25 行，规则列表和“输出不会泄露内容”）、`## 5. 本地 private/ 目录…`（第 65 行）、`## 7. 局限`（第 82 行）。按 RESEARCH § PRIVACY.md 要同步的内容：§2 表加两行，§3 加规则 F、G、H 和规则 A 扩展，§5 或 §7 加规则 D 局限和 IPv6 提醒，另加“夹具里怎么写假令牌和假口令”小节。写法沿用该文件的中文说明体。

**`tools/probe/README.md`：** 参考 `tests/README.md` 的结构（用途、怎么运行、隐私约定）。内容只写相对路径和占位，不写域名。

---

### D-01 文档更新落点（只列位置，不含真实值）

| 文件 | 位置 | 改成 |
|---|---|---|
| `.planning/PROJECT.md` | 目标里的部署描述（约第 28 行）；Constraints 的“部署”（约第 172 行）；Key Decisions 里腾讯云和 `.com` 两条（约第 210-211 行） | 阿里云轻量应用服务器香港 + Porkbun 托管 `.vip`；Key Decisions 记“服务商以所有者实际购买为准”（D-01、D-08） |
| `.planning/REQUIREMENTS.md` | INFRA-01（约第 12 行）、INFRA-02（约第 13 行，“是否续费或换商家”的依据） | INFRA-01 改阿里云香港和 `.vip`；INFRA-02 改为 Phase 10、13 的输入 |
| `.planning/ROADMAP.md` | Phase 6 Goal（“决定续费还是换商家”）、成功标准 2、成功标准 4（第 63 行附近，“继续用香港、改东京，或换商家”）、Notes（第 69 行附近，`/_/` 那条已与 D-13 一致，只需核对）；Phase 13 的 Research 行和 Notes 里的 Caddy 参数（约第 222、224 行） | 按 D-01、D-02、D-08 改；Phase 13 nginx 参数以本阶段验证为准 |
| `.claude/CLAUDE.md` | Project 段的 Constraints“部署”一行（约第 23 行） | 只用 `generate-claude-md` 重新生成 Project 段；不手改 |
| `.planning/STATE.md` 待办 | 记一笔：Phase 9 的前端 SDK 不用 0.28.2（D-15），原写在 `.planning/research/STACK.md` | 新增待办条目 |

行号取自 RESEARCH，可能因其他编辑漂移，计划里先用 Grep 定位再改。`.planning/research/*.md` 不改（历史记录），可选在顶部加一行“部署部分已被 Phase 6 D-01/D-02 取代”。

## Shared Patterns

### 命中只输出位置和编号，不输出原文
**Source：** `tools/privacy/privacy-check.mjs` 第 160-168 行、第 210-212 行（`formatFinding`）
**Apply to：** 规则 F、G、H，以及探针工具的一切输出（`summarize.mjs`、`verify.sh`）
```javascript
findings.push({ location: where, rule: RULES.D, message: `个人计划词条 #${t + 1}` });
export function formatFinding(f) {
  return `${f.location} [${f.rule}] ${f.message}`;
}
```

### 样本运行时拼接，源码里不出现完整命中字面量
**Source：** `tools/privacy/privacy-check.mjs` 第 579-589 行
**Apply to：** 所有新自检；Phase 8 假服务器的 JWT 夹具；任何含假口令的测试
```javascript
const winFwd = ['C:', 'Users', name, 'x'].join('/');
const company = `${name}@${['corp-mail', 'com'].join('.')}`;
```

### 零依赖、中文头注释、`--self-test`、退出码约定
**Source：** `tools/privacy/privacy-check.mjs` 第 1-20 行；`tools/test-report/check-report.mjs` 第 1-29 行
**Apply to：** `summarize.mjs`、任何新的 `tools/probe/*.mjs`。只用 `node:` 内置模块；0 通过、1 发现问题、2 内部错误（仅隐私检查器用 2）。

### fail closed 与钩子
**Source：** `.githooks/pre-commit`、`.githooks/pre-push`（只调用检查器，不改钩子，Phase 7 D-13）
**Apply to：** 所有新规则。成功标准 1 的证据可用 RESEARCH 提到的一次性演练脚本（临时仓库 + 四种违规），也可只保留 `--self-test`。

### 隐私约束
**Apply to：** 全部新文件。被跟踪文件、提交说明、规划文档里不写真实 IP、域名、令牌、密码；探针页源码只用相对地址；`config.js`（含合成探针账号凭据）被 `.gitignore` 忽略，仓库里只放 `config.example.js` 占位。D-17：任何下载（包括本机核对用）都放在所有者批准的脚本或检查点之后。

## No Analog Found

仓库里没有对应的现成文件，计划应直接用 RESEARCH.md 的设计：

| 文件 | 角色 | 数据流 | 原因 / 依据 |
|---|---|---|---|
| `tools/probe/server/nginx/usj-probe.conf`、`usj-probe-locations.conf` | config | streaming（SSE） | 仓库没有任何 nginx 配置。按 RESEARCH § Pattern 1（两个 include 文件，只在 certbot 的 443 块加一行；`proxy_http_version 1.1`、`proxy_buffering off`、长读超时；挡 `/_/` 的按名字和按集合 id 两种写法需按 D-13 改为对公网开放后重新核对）和 Pitfalls 1、4、8、9 |
| `tools/probe/server/pocketbase.service` | config | — | 无 systemd unit 先例。按 RESEARCH § Pattern 2（非 root、只听 `127.0.0.1`、`GOMEMLIMIT`、cgroup 内存上限，D-03、D-14） |
| `tools/probe/server/pb_migrations/probe_schema.js.tpl`、`probe_user.js.tpl` | migration | CRUD | 无 PocketBase 迁移先例（仓库没有 `pb_migrations/`）。按 RESEARCH § Pattern 4；用户文件只含 `__PROBE_EMAIL__` / `__PROBE_PASSWORD__` 占位，避免触发规则 G；Pitfall 7（数字字段不要 `required`） |
| `tools/probe/server/01..06-*.sh` 的具体逻辑 | script | batch | 仓库只有两个 3-8 行的钩子，无部署脚本先例；只借风格 |
| `tools/probe/server/export-results.py` | script | file-I/O | 仓库没有 Python；按 RESEARCH，经 ssh 标准输入运行，只读导出 |
| `tools/probe/page/vendor/pocketbase.iife.js` | vendor | — | 第三方文件。版本按 D-15 在规划时确定（不是 0.28.2），固定 sha256 记在旁边的 README，下载前经所有者批准（D-17） |
| `tools/probe/page/config.example.js` | config | — | 无同类占位文件；邮箱和密码写成 `<…>`，放行表见规则 G |
| `06-PROBE-RESULTS.md` | doc | — | 无同类结果文档；格式见 RESEARCH § 结果文档的格式（结论 D-08 三部分 + 表 1-4 + 附注） |

## 其他提醒给规划者

- 本阶段**不改** `us-journey-tracker.html`，也不新增 `tests/e2e` 用例；探针实测是人工测试，不进 `npm test`（CONTEXT code_context）。如果给 `summarize.mjs` 或 `probe.js` 加本地测试，用 `--self-test` 自检，不需要 Playwright。
- 对 Phase 8 的约束：新规则 F 上线后，假服务器和夹具里不能写出完整 JWT 字面量，必须运行时拼接（见 Shared Patterns）。
- 规则 G 的误报基线：RESEARCH 实测对 210 个已跟踪文件命中 0；去掉了反引号作为引号，否则 `.planning/research/PITFALLS.md` 会误报。新建文件后用 `node tools/privacy/privacy-check.mjs --all` 再核一遍。
- SDK 的 vendor 文件体积大、是压缩代码，须确认它不触发新旧规则（RESEARCH 对 0.28.2 实测为 0；D-15 换版本后必须重测）。

## Metadata

**Analog search scope：** `tools/`、`.githooks/`、`.gitattributes`、`.gitignore`、`PRIVACY.md`、`tests/README.md`、`us-journey-tracker.html`（仅 `esc()`）、`.planning/phases/07-*/07-PATTERNS.md`（格式）
**Files scanned：** 约 12（完整读取 `privacy-check.mjs`；其余读头部和相关行）
**Pattern extraction date：** 2026-11-07
