---
phase: 07-id-plan-extraction-stable-ids-escaping
reviewed: 2026-11-07T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - .gitattributes
  - .gitignore
  - PRIVACY.md
  - tests/KNOWN-BUGS.md
  - tests/README.md
  - tests/e2e/data/plan-normalize.spec.ts
  - tests/e2e/data/stable-ids.spec.ts
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/clean-clone.spec.ts
  - tests/e2e/platform/repo-hygiene.spec.ts
  - tests/e2e/security/escaping.spec.ts
  - tests/e2e/security/id-whitelist.spec.ts
  - tests/e2e/security/state-validation.spec.ts
  - tests/e2e/storage/config-seam.spec.ts
  - tests/fixtures/legacy-positional-backup.json
  - tests/fixtures/malicious-state.ts
  - tests/support/app-source.ts
  - tests/support/app-variant.ts
  - tests/support/constants.ts
  - tests/support/static-server.cjs
  - tests/support/strings.ts
  - tests/support/task-ids.ts
  - tools/plan/extract-plan.mjs
  - tools/privacy/privacy-check.mjs
  - us-journey-tracker.html
findings:
  critical: 0
  warning: 7
  info: 8
  total: 15
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-11-07
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

本次审查覆盖第 7 阶段的全部改动：应用里的 `DEFAULT_PLAN` / `normalizePlan` / `usePlan`、冻结 id、`USJ_CONFIG` 配置缝、SEC-01 转义与导入白名单、加载时修正，以及隐私检查器（规则 D 读本地种子、种子闸门、根目录应用文件放行）和计划提取工具。

整体判断：没有发现必须阻止交付的严重问题（CR 为 0）。已核对的事实：

- `us-journey-tracker.html` 的 sha256 与 `tests/support/constants.ts` 的 `APP_SHA256` 一致。
- 应用里 `innerHTML` 插值逐处检查过，剩下没包 `esc()` 的都是常量、数字或经 `ymd()` 生成的日期，没有发现可利用的注入点。
- 白名单、加载修正、种子闸门的主路径与 D-07、D-08、D-13 的描述一致。
- 没有读取 `private/`。

但有 7 条值得修的警告：
- 隐私检查器本身有两处能让内容绕过扫描或在报错里带出种子文字（WR-03、WR-04）。
- `normalizePlan` 用 `CK[g.cat]` 判断类别，会放过原型链上的键（WR-01）。
- 加载修正对“自定义待办的组不在计划里”和“日期格式合法但不存在”两类坏数据没有处理（WR-02、WR-06）。
- `--all` 在没有 HEAD 时直接崩溃（WR-05）。
- `.gitignore` 没覆盖 GSD 安装的 `.agents/`、`.codex/`（WR-07）。

## Warnings

### WR-01: `normalizePlan` 用 `CK[g.cat]` 判断类别，`constructor`、`__proto__` 之类的原型链键会被放行

**File:** `us-journey-tracker.html:373`（同源问题：`us-journey-tracker.html:300` 的 `kOf`）
**Issue:** `CK` 是普通对象（`Object.fromEntries` 的结果）。`!CK[g.cat]` 对 `"constructor"`、`"toString"`、`"__proto__"` 都是假，所以 `cat:"constructor"` 的组会通过 `normalizePlan`。`normalize()` 里处理记录类别时已经用了 `own(CK, …)`，这里却没用，两处不一致。放行之后：

- `planCat[g.id]` 变成 `"constructor"`。
- `kOf("constructor")` 返回 `CK.constructor`（一个函数，因为 `||"oth"` 不会触发）。
- `renderGoals`、`renderDay`、`renderTimeline` 把 `k-${kOf(...)}` 直接写进 `class` 属性，页面上出现 `class="group k-function Object() { [native code] }"`。

这条路径现在没有外部入口（D-11），不会被触发。但 `normalizePlan` 的存在理由就是挡住 Phase 12/13 服务器来的不可信计划（D-09 的入口防线），而 `plan-normalize.spec.ts` 的“拒绝”变体里没有这一类，所以回归不会被发现。

**Fix:**
```js
// 常量区，CK 之后
const hasCat=n=>Object.prototype.hasOwnProperty.call(CK,n);
const kOf=n=>hasCat(n)?CK[n]:"oth";
// normalizePlan 里
if(!pObj(g)||!pStr(g.id)||!GROUP_ID_RE.test(g.id)||gids.has(g.id)||!pStr(g.cat)||!hasCat(g.cat)||...)return null;
```
并在 `plan-normalize.spec.ts` 的 `variants` 里加 `['category named constructor', p => p.groups[0].cat = 'constructor']`、`'__proto__'` 两条。

### WR-02: 自定义待办的 `group` 只校验格式、不校验是否在当前计划里，合格但不存在的组会让待办在目标页“消失”

**File:** `us-journey-tracker.html:437`、`us-journey-tracker.html:476`（现象在 `us-journey-tracker.html:671`、`us-journey-tracker.html:613`）
**Issue:** `importProblem` 和 `normalize` 只用 `GROUP_ID_RE` 检查 `custom[].group`。`P9`、`g-xxx` 这样格式合格、但当前计划里没有的组会原样保留，而且 `cids` 里有它，对应的进度键也保留。`renderGoals` 只按 `plan.groups` 遍历，所以这条待办在目标页不显示，也删不掉；周视图的类别计数 `planCat[t.group]` 为 `undefined`，不计入任何类别；日历和时间线却仍会显示它的到期和完成（标签里是那个不存在的组号）。`state-validation.spec.ts:265` 甚至把“`g-synth1` 在换回 `DEFAULT_PLAN` 后仍保留”当成期望行为写了下来。数据没有丢，但用户看不到、改不了，D-08 说的“坏数据自动修正”在这里没做到。

**Fix:** 在 `normalize` 里用当前计划判断，不在计划里的组一律落到“其他”组：
```js
const gset=new Set(plan.groups.map(g=>g.id));
if(typeof r.group!=="string"||!GROUP_ID_RE.test(r.group)||!gset.has(r.group))r.group=oth;
```
同时把 `state-validation.spec.ts:265` 的期望改成 `'P7'`（或当前计划的“其他”组），并加一条 `group:"P9"` 的变体。

### WR-03: 种子 JSON 损坏时，`err.message` 可能把种子里的计划文字原样打印到终端

**File:** `tools/privacy/privacy-check.mjs:369`、`tools/privacy/privacy-check.mjs:750`；`tools/plan/extract-plan.mjs:349`、`tools/plan/extract-plan.mjs:537`
**Issue:** `JSON.parse` 在较新的 Node 里报错时，消息会带上出错位置附近的原文片段（形如 `Unexpected token …, "…片段…" is not valid JSON`）。`seedTerms(readFileSync(seedPath))` 和 `runCheck` 里的 `JSON.parse(readFileSync(SEED_FILE))` 都不捕获，错误一路冒到入口，被 `${err.message}` 原样写进 stderr。种子里全是所有者的计划文字，而这两个工具的约定是“从不输出计划原文”（文件头注释和 PRIVACY.md 都这样写）。终端输出常被复制进日志、issue 或规划文档，这正是仓库公开后要防的泄露路径。

**Fix:** 在读取处把解析错误换成固定文案，不透传原始消息：
```js
function parseSeed(text) {
  try { return JSON.parse(text); }
  catch { throw new Error('种子文件不是合法的 JSON（已隐去内容）'); }
}
```
`seedTerms` 与 `runCheck` 都改用它；入口的 `catch` 对其他来源的错误保持现状即可。

### WR-04: 含 NUL 字节的文件被整个跳过，UTF-16 编码的文本（例如 PowerShell 重定向生成的文件）能绕过规则 B、C、D

**File:** `tools/privacy/privacy-check.mjs:138-142`、`tools/privacy/privacy-check.mjs:174-177`
**Issue:** `isBinary` 只要前 8000 字节里有一个 `0` 就判为二进制，`scanBuffer` 直接返回空。Windows PowerShell 5 的 `>` 重定向默认写 UTF-16LE（带 BOM），文本里每隔一个字节就是 NUL，于是任何 `.md`、`.txt`、`.json` 只要是这样生成的，规则 B（本机路径）、C（邮箱）、D（计划词条）全都不扫就放行；规则 A 只看路径，也拦不住。第 7 阶段让“提交应用文件”靠这道检查兜底，而本机恰好是 Windows + PowerShell。这是一道“最后防线”上的真实缺口，不是风格问题。

**Fix:** 先识别 UTF-16 BOM 并解码，再扫描；对没有 BOM、但扩展名是文本类（`FILE_EXTENSIONS` 里已有一份）的含 NUL 文件，不要跳过，去掉 NUL 后照常扫描：
```js
export function scanBuffer(location, buffer, terms = []) {
  let text;
  if (buffer[0] === 0xff && buffer[1] === 0xfe) text = buffer.toString('utf16le');
  else if (buffer[0] === 0xfe && buffer[1] === 0xff) text = Buffer.from(buffer).swap16().toString('utf16le');
  else if (isBinary(buffer)) return textExtension(location) ? scanText(location, buffer.toString('utf8').replace(/\0/g, ''), terms) : [];
  else text = buffer.toString('utf8');
  return scanText(location, text, terms);
}
```
并在 `--self-test` 里加一条 UTF-16LE 正例（样本运行时拼接，同现有写法）。

### WR-05: `runAll` 在仓库没有任何提交时直接崩溃，下面处理“没有 HEAD”的分支是死代码

**File:** `tools/privacy/privacy-check.mjs:406-415`
**Issue:** 第 406 行无条件执行 `git ls-tree -r … HEAD`。没有 HEAD 时（刚 `git init`、第一次提交之前）这条命令以 128 退出，`execFileSync` 抛错，整个 `--all` 以退出码 2 结束。紧随其后的 `hasHead` 判断（`rev-parse --verify`）和 `hasHead ? head : []` 本意就是兜住这种情况，但因为 `head` 已经在判断之前求值，永远走不到。第一次提交前用 `--all` 做全量检查恰好是“应用文件第一次提交”这个场景。

**Fix:** 把 `ls-tree` 放进判断后面：
```js
const headPaths = hasHead ? gitPathList(['ls-tree', '-r', '-z', '--name-only', 'HEAD']) : [];
```
`hasHead` 的定义移到它前面。

### WR-06: `DATE_RE` 接受不存在的日期（`2026-02-31`、`2026-04-31`），修正和导入白名单都放过，这些记录在周和日历视图里看不到

**File:** `us-journey-tracker.html:305`（使用处 `us-journey-tracker.html:436`、`us-journey-tracker.html:457`、`us-journey-tracker.html:484`、`us-journey-tracker.html:448`）
**Issue:** 正则只限制月 01-12、日 01-31，没做日历校验。`2026-02-31` 通过白名单、也不被加载修正改写。`eventsOn(date)` 用字符串相等比较，而周和日历视图的日期都是 `ymd(真实日期)`，永远不会生成 `2026-02-31`，所以这条记录只在时间线里出现；时间线里点开编辑弹窗，`<input type="date" value="2026-02-31">` 是无效值，显示为空。抵达日期若是 `2026-02-31`，`parse()` 会算成 3 月 3 日，计数器和“第 N 周”都跟着错。这与 SEC-01 要的“日期格式合格”不是一回事：格式合格但语义无效。

**Fix:** 在 `okDate` 一类的统一入口里加一次往返校验，并让 `importProblem`、`normalize` 都用它：
```js
const realDate=v=>typeof v==="string"&&DATE_RE.test(v)&&ymd(parse(v))===v;
```
`importProblem` 的 `okDate`/`optDate`、`normalize` 的 `okDate`、`arrival` 判断和复盘键判断都改用 `realDate`，并在两个 spec 里各加一条 `2026-02-31` 的变体。

### WR-07: `.gitignore` 没有覆盖 GSD 安装出来的 `.agents/`、`.codex/` 和 `AGENTS.md`，而它们含本机用户名的绝对路径

**File:** `.gitignore:15-18`（对应 PRIVACY.md 第 19 行“GSD 安装文件”一栏）
**Issue:** 现在 `git status` 里 `.agents/`、`.codex/`、`AGENTS.md` 都是未跟踪且未忽略。`.codex/agents/*.toml` 里已经有含本机用户名的 Windows 绝对路径。PRIVACY.md 写的是“GSD 安装文件不进仓库”，但 `.gitignore` 只处理了 `.claude/`。现在靠的是暂存时规则 B 报错来拦，也就是任何一次 `git add -A` 都会让提交失败，需要人工把这些路径从暂存区拿出来；万一哪天有一份文件没命中规则 B，就会被带进公开仓库。规则 A 的 `checkPath` 也没有这几个路径。

**Fix:** 在 `.gitignore` 里加：
```
# --- 其他 AI 工具的安装文件（含本机路径，不进仓库）---
.agents/
.codex/
AGENTS.md
```
同时在 `checkPath` 里把 `.agents`、`.codex` 加成禁止的路径段（和 `private` 同一处理），并更新 PRIVACY.md 第 2 节的表格。如果所有者想保留 `AGENTS.md`，就只忽略前两项，并在 PRIVACY.md 里说明。

## Info

### IN-01: `planTerm` 在两个文件里各写一份，靠注释“改一处要改两处”维护，没有测试把它们绑在一起

**File:** `tools/privacy/privacy-check.mjs:212-219`、`tools/plan/extract-plan.mjs:86-92`
**Issue:** 两份实现今天相同。但规则 D 实际用的是 privacy-check 里那份，`--check` 报告用的是 extract-plan 里那份；任何一份改了而另一份没改，`--check` 通过的计划也可能被规则 D 拦住（或反过来）。`privacy-check.mjs` 没有 `import.meta.url` 入口守卫，所以不能被 import，这是重复的原因。
**Fix:** 给 `privacy-check.mjs` 加和 `extract-plan.mjs` 一样的入口守卫，把 `planTerm` 放进一个共享的小模块（例如 `tools/lib/plan-term.mjs`）；短期内至少在两个 `--self-test` 里放同一组样例，保证两份结果一致。

### IN-02: `extract-plan.mjs` 的正则里写着一个肉眼看不到的 BOM 字面量

**File:** `tools/plan/extract-plan.mjs:267`
**Issue:** `linesOf` 里 `replace(...)` 的正则 `^` 后面跟的是字面的 U+FEFF 字符，不是转义写法；编辑器不显示它，复制粘贴或重新保存时容易丢失，行为改变却看不出来。`privacy-check.mjs:145` 写的是转义 `\uFEFF`。
**Fix:** 改成 `replace(/^\uFEFF/, '')`，或直接复用同一个 `splitLines`。

### IN-03: `tests/KNOWN-BUGS.md` 末尾的“里程碑收尾时的状态”已经与第 7 阶段的现实不符

**File:** `tests/KNOWN-BUGS.md:28-51`
**Issue:** 文档开头和约定已更新为“修复之前保持现状”，但收尾一节仍写着“本测试里程碑不修改应用，所有已知 bug 保持现状”，并把 B6（导入 XSS）、B8（导入校验过浅）、B10（位置 id）列在“仍未验证”里。第 7 阶段已经转义了所有插值、加了导入白名单、冻结了内置 id；B6、B10 实际已修，B8 对 id 和日期已修，对“值的含义”仍未覆盖。读文档的人会以为这些还在。
**Fix:** 在这一节标明“截至 v1.0 收尾”，另加一小段“第 7 阶段之后”，把 B6、B10 标为已由 SEC-01、PLAN-05 修复，B8 标为部分修复（id 和日期格式）。

### IN-04: 重复的记录 id 和自定义待办 id 不去重，后一条无法编辑或删除

**File:** `us-journey-tracker.html:461-479`
**Issue:** `normalize` 只替换格式不合格的 id。两条格式合格、但 id 相同的记录会都保留；`openEditor`、`deleteLog` 用 `find`/`findIndex`，永远命中第一条，第二条点开的是第一条的编辑弹窗。两条同 id 的自定义待办还会共享同一份进度。D-08 没要求处理，但“id 唯一”是后面所有 `data-edit`、`data-task` 查找的前提。
**Fix:** 在 `logs` 和 `custom` 的 `map` 里用一个 `Set` 记录已见 id，重复的按“不合格”处理，换新 id（自定义待办要同时维护 `idMap`，复用现有逻辑）。

### IN-05: `archived` 字段被校验、被保留，但没有任何地方使用，`planTasks` 还把它丢掉了

**File:** `us-journey-tracker.html:379-381`、`us-journey-tracker.html:402`
**Issue:** `normalizePlan` 接受并保留 `t.archived`，测试也断言它被保留；但 `usePlan` 构造 `planTasks` 时只取 `id`、`group`、`text`，渲染也不看它，所以一个 `archived:true` 的任务照样显示在目标页上。名字暗示“归档后不显示”，现状是静默无效。
**Fix:** 如果它是给 Phase 12 预留的，就在代码注释里写明“预留，当前不影响显示”；否则在 `renderGoals` 的 `ts` 过滤里跳过已归档且未完成的任务，并补一条页面用例。

### IN-06: `--all` 对已暂存的文件读工作区版本，而不是暂存区版本

**File:** `tools/privacy/privacy-check.mjs:437-442`
**Issue:** 对 `stagedSet` 里的路径，先 `readFileSync` 工作区文件，读不到才回退到 `git show :path`。如果文件暂存之后又被改过，扫描的是工作区内容，而真正会被提交的是暂存区内容，两者可能不同。`--staged`（钩子实际用的）读的是暂存区，所以不影响拦截，只是 `--all` 的结果对“即将提交的内容”不准。
**Fix:** 直接用 `git(['show', ':' + path])`，不要读工作区；文件在工作区不存在的情况本来就由暂存区版本覆盖。

### IN-07: denylist 的匹配区分大小写，且词条里不能出现 `#`

**File:** `tools/privacy/privacy-check.mjs:267-274`、`tools/privacy/privacy-check.mjs:165`
**Issue:** `denylist.txt` 里放的是 IP 和域名。域名不区分大小写，文本里写成 `Example.VIP` 就不会命中小写词条；同一个词的全角写法也不会命中。`parseDenylist` 用 `split('#')[0]` 去注释，含 `#` 的词条（例如带片段的 URL）会被截断。
**Fix:** 对 denylist 词条（不含种子里的汉字词条）用 `toLowerCase()` 比较行内容；注释改为要求 `#` 前有空白或在行首，或者在 PRIVACY.md 里写明限制。

### IN-08: `legacyPlan` 把原件里 `<p class="note">` 的原始 HTML 文本当作 `fitNote`，实体不会被还原

**File:** `tools/plan/extract-plan.mjs:79-81`
**Issue:** `([^<]*)` 取的是 HTML 源码文本。如果原文含 `&amp;`、`&lt;` 之类的实体，种子里的 `fitNote` 就是转义后的形式；Phase 12/13 把它作为纯文本放进账号后再经 `esc()` 渲染，会被二次转义成 `&amp;amp;`。另外它还会原样写进种子，规则 D 的词条也带着实体。目前原文是否含实体无法在不读 `private/` 的前提下确认，所以只作为提示。
**Fix:** 取出之后做一次实体还原（至少 `&amp; &lt; &gt; &quot; &#39;`），再写入种子；并在 `--self-test` 里加一条含实体的合成样例。

---

_Reviewed: 2026-11-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
