# Phase 7: 计划外置、稳定 id 与转义 - Pattern Map

**Mapped:** 2026-11-06
**Files analyzed:** 17（新建 6，修改 11）
**Analogs found:** 16 / 17（`USJ_CONFIG` 配置缝在代码里没有现成 analog，见 No Analog Found）

隐私说明：本文件不含 CATS/GROUPS/LIFTS/FIT_GOAL 里的任何文字（任务、组名、备注、预设、力量项名称、目标值、默认值）。这些常量只按字段名、个数和行号描述。本文件没有 RESEARCH.md 可依赖，技术背景取自 `.planning/research/ARCHITECTURE.md` § Q4、§ Pattern 1、§ Q7。所有路径均为仓库相对路径，且都已核对为 git 跟踪文件（`us-journey-tracker.html` 本身目前仍被 git 忽略，是本阶段要改的对象，不是 analog）。

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最接近的 analog | 匹配度 |
|---|---|---|---|---|
| `us-journey-tracker.html`（改：`plan` / `normalizePlan` / `DEFAULT_PLAN`） | config + model | transform | 同文件 `normalize()`（347-353）、`allTasks()`/`lift()`（344-346） | exact |
| `us-journey-tracker.html`（改：`normalize` 深度修正，D-08） | utility | transform | 同文件 `normalize()` 里的 `LEGACY` 迁移（352） | exact |
| `us-journey-tracker.html`（改：渲染转义，D-09） | component | request-response（string 模板进 innerHTML） | 同文件 goals 视图里已转义的 `esc(x.text)`（517-526） | exact |
| `us-journey-tracker.html`（改：导入白名单，D-07） | controller | file-I/O | 同文件导入处理（639-658 区间） | exact |
| `us-journey-tracker.html`（新增：`USJ_CONFIG` 配置缝） | config | request-response | 同文件 `store` 适配器（356-379、366-367） | role-match |
| `tools/plan/extract-plan.mjs`（新） | utility（本地 CLI） | file-I/O + transform | `tools/privacy/privacy-check.mjs` 的 `readBlock`/`extractPlanTerms`（178-234） | exact |
| `tools/privacy/privacy-check.mjs`（改：规则 A、规则 D、`--self-test`） | utility | batch | 同文件自身 | exact |
| `.gitignore`、`PRIVACY.md`、`.githooks/*`（改） | config | — | `.gitignore` 现有“隐私护栏”分段 | exact |
| `tests/support/constants.ts`（改：`APP_SHA256`） | config | — | 同文件 36-38 行 | exact |
| `tests/e2e/platform/app-integrity.spec.ts`（改：SAFE-02、ENV-03） | test | request-response | 同文件自身 | exact |
| `tests/support/static-server.cjs`（改：缺文件报错） | utility | request-response | 同文件 11-19 行 | exact |
| `tests/README.md`（改） | config（文档） | — | 同文件现有“应用文件不在仓库里”段落 | exact |
| `tests/e2e/security/escaping.spec.ts`（新：恶意数据渲染） | test | request-response | `tests/e2e/data/synthetic-data.spec.ts` + `tests/e2e/io/import.spec.ts` | role-match |
| `tests/e2e/security/id-whitelist.spec.ts`（新：导入拒绝、加载修正） | test | file-I/O | `tests/e2e/io/import.spec.ts`、`tests/e2e/storage/account-mode.spec.ts` | exact |
| `tests/e2e/data/stable-ids.spec.ts`（新：旧备份映射） | test | transform | `tests/e2e/data/synthetic-data.spec.ts` | role-match |
| `tests/e2e/platform/clean-clone.spec.ts`（新：示例计划 + 空记录） | test | request-response | `tests/e2e/platform/repo-hygiene.spec.ts` + `tests/e2e/platform/app-integrity.spec.ts` | role-match |
| `tests/fixtures/malicious-state.ts`（新：恶意载荷）、`tests/fixtures/legacy-positional-backup.json`（新） | fixture | — | `tests/fixtures/malformed-imports.ts`、`tests/fixtures/full-state.json` | exact |

## Pattern Assignments

### `us-journey-tracker.html` — `plan` 对象、`normalizePlan`、`DEFAULT_PLAN`（config + model，transform）

**Analog：** 同文件 `allTasks()` / `lift()` / `normalize()`，行 344-353。

**读取入口**（行 344-346，这三个函数是任务和力量数据的唯一读取口，改成读 `plan`）：
```javascript
function allTasks(){return BUILTIN.concat(state.custom||[])}
function tstate(id){return state.tasks[id]||{}}
function lift(id){const L=LIFTS.find(x=>x.id===id);return Object.assign({cur:L.def,hist:[]},state.lifts[id]||{})}
```

**常量形状（只列字段，不抄内容）：** 行 298-325 定义 `CATS`（每项含 `n`、`k`、`presets` 数组、`direct` 等字段，共 5 个类别）、`GROUPS`（7 组，字段 `p`、`cat`、`name`、`note`、`tasks`）、`BUILTIN`（由 `GROUPS` 展开，id 为 `P<n>-<i>`，行 317）、`GCAT`（组号到类别，行 318）、`LIFTS`（4 项，字段 `id`、`name`、`note`、`unit`、`target`、`def`）、`FIT_GOAL`（两个数字，行 325）。`DEFAULT_PLAN` 必须与它们同形状：7 组、每组任务数、每组类别、4 个力量 id（`bench`、`squat`、`dead`、`pull`）、每类预设个数、两个周目标数字，全部保持一致，才能保住 154 条用例。

**引用点（改动清单）：** `CATS` 预设部分 298、305、391、401、403、459、530、563；`GROUPS` 308、317、318、517；`BUILTIN` 317、344；`GCAT` 318、460、469、502、534、585；`LIFTS` 319、346、511、626；`FIT_GOAL` 325、462。

**`normalizePlan` 照 `normalize()` 的写法：** 单个函数、入口只信类型、返回新对象。加白名单正则校验 id（`P\d+`、`P\d+-\d+`、`g-…`、`t-…`、`l-…`、`c-…`）。此处只建议结构，具体正则由规划决定：
```javascript
function normalize(s){
  const o={arrival:typeof s.arrival==="string"?s.arrival:"",tasks:s.tasks&&typeof s.tasks==="object"?s.tasks:{},
    custom:Array.isArray(s.custom)?s.custom:[],logs:Array.isArray(s.logs)?s.logs:[],
    ...};
  o.logs.forEach(l=>{if(LEGACY[l.cat])l.cat=LEGACY[l.cat];if(!CK[l.cat])l.cat="其他"});
  return o;
}
```

**自定义待办判断**（行 522，改成查计划，不再看 id 形状）：
```javascript
const custom=!/^P\d-\d+$/.test(x.id);
```
新增自定义待办仍是 `"c-"+uid()`（行 633），白名单必须接受 `c-` 开头的现有 id。

**命名约定（CLAUDE.md）：** 常量 UPPER_CASE（`DEFAULT_PLAN`），可变状态小写（`plan`），短键 `n`/`k`/`p`；代码风格是紧凑单行 IIFE，不引入类和模块。

---

### `us-journey-tracker.html` — `normalize` 深度修正（D-08，读取已存数据，transform）

**Analog：** 同文件 `normalize()` 的 `LEGACY` 迁移那一行（352）：就地改写、不删记录。
```javascript
o.logs.forEach(l=>{if(LEGACY[l.cat])l.cat=LEGACY[l.cat];if(!CK[l.cat])l.cat="其他"});
```
照这个写法逐条修正：不合格的 id 换成 `uid()` 生成的安全 id（`state.tasks` 里对应键一起迁移，找不到任务的键直接丢弃）；不合格的日期、数值清掉或回落默认值；**记录文字一条不删**。

**load 路径与导入路径要分开：** 导入走“整份拒绝”（D-07，toast，`state` 不变），load 走“自动修正”（D-08）。两者共用同一套白名单正则，但 load 不调用拒绝分支。`store.load` 的现有错误处理（行 366：`try{…}catch(e){return null}`）保持不变。

---

### `us-journey-tracker.html` — 渲染转义（D-09，component，string 模板进 innerHTML）

**Analog：** 目标视图 517-526，同一段里已经对 `x.text` 使用 `esc()`，没转义的是下面这些插值：`${g.name}`、`${g.note}`、`${g.p}`、`data-task="${x.id}"`、`data-due="${x.id}"`、`data-deltask="${x.id}"`、`value="${s.due||""}"`、`data-addto="${g.p}"`、`aria-label="给${g.p}…"`。

**已有的转义函数**（行 339，直接复用）：
```javascript
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
```

**已转义的写法（照抄）**（行 523-524）：
```javascript
<input type="checkbox" data-task="${x.id}" ${s.done?"checked":""} aria-label="${esc(x.text)}">
<span class="tt">${esc(x.text)}</span>
```
改成 `data-task="${esc(x.id)}"`。力量当前值（`s.cur`，约 511 区段）、`due`、`group` 同样包 `esc()`。必须覆盖的清单在 `.planning/codebase/CONCERNS.md` § “HTML injection through a crafted backup file”。数字插值（如进度条宽度）要么保证是数字，要么也包 `esc()`。

**注意：** 转义不能改变渲染结果，v1 的 154 条用例照样要过。`data-*` 属性读回后与原值相同，因为浏览器会反转义。

---

### `us-journey-tracker.html` — 导入白名单（D-07，controller，file-I/O）

**Analog：** 同文件导入处理（639-658 区间），流程是 `FileReader.readAsText` → `JSON.parse` → `normalize` → `confirm()` → 替换 `state` → `persist()` → `renderAll()`；解析或 `normalize` 失败走 catch，显示“格式错误”toast（`TOAST_IMPORT_BAD_FORMAT`）。新增的 id、日期白名单检查放在 `normalize` 之后、`confirm()` 之前，失败时走同一条 toast 路径，不弹确认框，`state` 保持不变。

**v1 约束：** N3（导入 `{}`）和 B2（取消后不能重选同一文件）是已知 bug，`tests/KNOWN-BUGS.md` 行 25、26 登记了它们；这两条的现有行为（`{}` 通过校验并走到确认）不能因为白名单而改变。与“整份拒绝”冲突的 v1 畸形导入用例保持 v1 行为，推迟到 Phase 11（IO-07）。注意白名单只检查有内容的条目，空对象没有条目可检查，自然不触发拒绝。

---

### `us-journey-tracker.html` — `USJ_CONFIG` 配置缝（config，request-response）

**Analog（部分）：** `store` 适配器，行 356-379。没配后端时走旧的 `window.claude` / localStorage 路径，v1 全部用例走这条。

**现有适配器结构**（行 366-367，localStorage 兜底）：
```javascript
load:async()=>{try{const v=localStorage.getItem(K);return v?JSON.parse(v):null}catch(e){return null}},
save:async s=>{try{localStorage.setItem(K,JSON.stringify(s))}catch(e){throw new Error("浏览器存储不可用")}}}}
```
能力解析（行 371，`window.claude` 缺失时回落）：
```javascript
try{[db,user]=await Promise.all([window.claude?window.claude.use("db"):null,window.claude?window.claude.use("user"):null])}catch(e){}
```
`USJ_CONFIG` 读取放在这两处之前：`window.USJ_CONFIG` 不存在或没有后端字段时，什么都不做。本阶段不接后端，只放缝。读取要包 `try{…}catch(e){}`（CLAUDE.md 的可选能力约定）。

---

### `tools/plan/extract-plan.mjs`（utility，file-I/O + transform）

**Analog：** `tools/privacy/privacy-check.mjs` 的 `readBlock` 和 `extractPlanTerms`（178-234），已经会从 `const NAME = [` 之后做括号配平，收集字符串字面量。

**核心 pattern（行 178-201）：**
```javascript
function readBlock(html, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*\\[`).exec(html);
  if (!m) return [];
  let i = m.index + m[0].length;
  let depth = 1;
  const strings = [];
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      ...
```
提取工具需要的是结构（组、任务、力量项、预设），不只是词条，所以不能直接复用 `readBlock`。更稳的做法是从 D-12 的 `private/` 副本里切出常量块，在 `node:vm` 里求值，写成 JSON 种子。`private/` 已被 `.gitignore` 忽略，`checkPath` 的 `segments.includes('private')` 也会拦住它（行 49-62）。

**风格：** 纯函数 `export`，让 `--self-test` 和单元测试可以直接导入；中文提示文案；失败只输出计数和文件相对名，不打印计划原文（照 `loadPlanTerms` 的 `stderr` 写法，行 295-318）。工具里不要写个人文字，自检用 `privacy-check.mjs` 自检里的合成样例（行 530-535）作输入。

---

### `tools/privacy/privacy-check.mjs`（utility，batch）

**Analog：** 同文件自身。三处要改。

**规则 A（行 49-62）：** 现在直接禁止应用文件名：
```javascript
if (base === APP_FILE) return '应用文件只能留在本机，不能进入仓库';
```
去个人化的应用进入仓库后删除这一行和 `APP_FILE` 常量里与它相关的用途（行 30）。`--self-test` 里的规则 A 正反例（行 483-488，`pathPos`/`pathNeg`）要同步：应用文件路径从正例挪到反例。

**规则 D 词条来源（行 295-318 的 `loadPlanTerms`）：** 现在读应用文件：
```javascript
const htmlPath = firstExisting(APP_FILE);
if (htmlPath) add(extractPlanTerms(readFileSync(htmlPath, 'utf8')));
const denyPath = firstExisting(DENYLIST_FILE);
if (denyPath) add(parseDenylist(readFileSync(denyPath, 'utf8')));
```
改成：读 `private/` 下的种子 JSON（新增一个 `SEED_FILE` 常量，与 `DENYLIST_FILE` 同列于行 30-32），把里面的字符串按“含汉字且至少 4 个字”的规则筛成词条，再叠加 `private/denylist.txt`。`firstExisting` 已经会同时查当前目录和主工作树（`mainWorktreeRoot()`），在 worktree 里也能找到种子，保持不动。`TERM_BLOCK_NAMES` 和 `extractPlanTerms` 的块名提取不再用于应用文件（D-06）；是否保留给提取工具复用由规划决定。跳过时的 `stderr` 文案要改为“未找到种子文件或 denylist”。

**词条筛选规则不变（行 213-231）：**
```javascript
value = String(value).trim().replace(/[：:]$/, '').trim();
if (!/\p{Script=Han}/u.test(value)) continue;
if ([...value].length < 4) continue;
```

**`--self-test`（行 455 起；词条提取自检在 520-540）：** 现有自检用字符串 fixture 模拟应用文件。改成：对种子 JSON 的解析函数加同样风格的正反例，并增一条“规则 D 不再从应用文件提取词条”的反例。自检的 `expect(name, cond)` 风格照抄。行 568 的 `loadPlanTerms()` 实时检查要随来源改变。

---

### `.gitignore`、`PRIVACY.md`、`.githooks/*`

**Analog：** `.gitignore` 现有分段（行 1-10）：
```
# --- 应用文件（源码里写死了个人计划，D-10）---
/us-journey-tracker.html
...
# --- 本地私有目录（例如 private/denylist.txt）---
private/
```
删除 `/us-journey-tracker.html` 这一条及注释；`private/` 保留，并把注释里的例子扩到种子文件和原应用副本。`PRIVACY.md` § 1、§ 2、§ 5 同步改写（应用文件进入仓库、规则 D 的词条来源改为本地种子 + denylist）。`.githooks/pre-commit` 只是 `exec node tools/privacy/privacy-check.mjs --staged`（行 1-10），不需要改，除非检查器入口变化。

---

### `tests/support/constants.ts`（config）

**Analog：** 同文件 36-38 行。
```typescript
// 应用文件的 sha256 基线（SAFE-02）。这是本里程碑的基线，
// 只有在后续里程碑经用户批准修改应用时才能更新。
export const APP_SHA256 = '2a954fd0e41df78669bddda384f6307b09974fb32969be4d94e130d63a8a1872';
```
改应用后算出新哈希，替换常量，并把注释改为“Phase 7 经批准的基线；以后每次改应用都要有意识地更新”。`APP_FILE_NAME` 的注释（行 9，“不进 git”）也要改。

### `tests/e2e/platform/app-integrity.spec.ts`

**Analog：** 同文件。SAFE-02（行 13-19）：
```typescript
const digest = createHash('sha256').update(readFileSync(appFile)).digest('hex');
expect(digest, '...基线不一致：应用文件被改动过，本里程碑禁止修改应用').toBe(APP_SHA256);
```
改失败文案（现在写着“本里程碑禁止修改应用”，Phase 7 起不再成立），逻辑不变。要验收“改了应用却没更新基线时护栏必须失败”，可在此加一条反向对照：把一份内存里改过一个字节的副本算哈希，断言它不等于 `APP_SHA256`（只在内存里做，不写盘，照 `import-file.ts` 的内存构造约定）。ENV-03（行 21-42）：`request.get('/')` 响应文本含 `id="status"`，应用换成新文件后仍成立，不用改。

### `tests/support/static-server.cjs`

**Analog：** 同文件 11-19 行：
```javascript
const MISSING_APP_MESSAGE =
  '找不到 us-journey-tracker.html：这个应用文件不在 git 仓库里。请把本地的 us-journey-tracker.html 放到仓库根目录，再运行 npm test（说明见 tests/README.md）。';
if (!fs.existsSync(APP_FILE)) { process.stderr.write(MISSING_APP_MESSAGE + '\n'); process.exit(1); }
```
应用进入仓库后，文案不再说“不在 git 仓库里”，改为“文件缺失，请检查工作区是否完整”。保留“提示里不打印绝对路径”的约定。

---

### 新测试：`tests/e2e/security/escaping.spec.ts`（test，request-response 读回 DOM）

**Analog：** `tests/e2e/data/synthetic-data.spec.ts` 的结构（文件头导入、`SYNTH_PREFIX`、`({ page, app })` fixture 签名）和 `tests/support/goals.ts` 的读回方式（`page.evaluate` 只读 id、计数、类名，不读计划文字）。

**导入约定（synthetic-data.spec.ts 行 1-3 起）：**
```typescript
import { test, expect } from '../../support/test';
import { loadFixture } from '../../support/fixture-files';
import { FROZEN_TODAY } from '../../support/constants';
```
所有 spec 只能从 `../../support/test` 导入 `test` 和 `expect`（test.ts 头部注释，D-17）。该出口的两个 auto fixture（`guard`、`frozenClock`）会收集页面异常和 console.error，所以“恶意数据没有引起脚本执行”可以直接靠 guard 的 `pageErrors` 为空来证明，另外断言 `window` 上没有被设置的标记变量。

**打开应用：** `await app.open({ mode: 'account', seed })`（app.ts 行 46-89）。种子里放恶意字符串：`<script>`、`<img src=x onerror=…>`、带引号的属性断裂载荷，放在 log 文字、任务名（`state.custom[].text`）、`group`、`id`、`due`、`lifts.<id>.cur`、日期字段。每个视图（周、日历、目标、时间线）和编辑器对话框各断言一次：载荷以纯文本出现（`textContent` 等于原字符串），页面里没有对应的注入元素（`page.locator('img[src="x"]')` 数量为 0）。

**载荷放进 fixture 文件：** 照 `tests/fixtures/malformed-imports.ts` 的做法，TS 模块导出只读数组、带 `_synthetic` 风格标记（文件头注释“_synthetic：……只在内存里使用”），数据里带 `SYNTH` 前缀以便 SAFE-03 检查。

### 新测试：`tests/e2e/security/id-whitelist.spec.ts`（导入拒绝 + 加载修正）

**Analog：** `tests/e2e/io/import.spec.ts`，导入流程和 helper：

```typescript
import { answerNextDialog, chooseImportFile, jsonImportFile, recordDialogs, textImportFile } from '../../support/import-file';
import { expectToast, expectToastGone } from '../../support/toast';
import { TOAST_IMPORT_BAD_FORMAT, CONFIRM_IMPORT } from '../../support/strings';
```
**约定（import-file.ts 行 1-8、36-47）：** 内存构造文件，文件名必须以 `synth-` 开头；先 `answerNextDialog` 或 `recordDialogs`，再 `chooseImportFile`；确认框在 `FileReader.onload` 里才弹出，所以用 `expect.poll` 等消息，不要在 `setInputFiles` 返回后立刻断言。
- 拒绝用例：坏 id 备份 → 断言出现格式错误 toast、`recordDialogs` 返回数组为空、`await app.saved()` 为 null（没有保存）、原有记录仍显示。
- 修正用例：用 `app.open({ mode: 'account', seed: <含坏 id 的状态> })` 启动，断言页面仍有内容、记录文字全在（对照种子里的 `logs`）、`app.expectSaved(...)` 之后落盘的状态里 id 都合规。落盘读回用 `withoutSynthetic`（`tests/support/fixture-files.ts` 行 20-23）去掉 `_synthetic` 再比较。

### 新测试：`tests/e2e/data/stable-ids.spec.ts`（旧备份映射）

**Analog：** `tests/e2e/data/synthetic-data.spec.ts`；内置 id 来自 `tests/support/task-ids.ts`（`BUILTIN_TASK_IDS`、`LIFT_IDS`，行 7-16），其文件头约定“只放 id，不放任务文字”。新建 `tests/fixtures/legacy-positional-backup.json`（带 `_synthetic`，沿用旧格式 `P<n>-<i>` 键）：通过 `chooseImportFile` 导入后，断言这些进度键仍对应页面上同 id 的任务（读回方式见 `tests/support/goals.ts`，只读 id 和勾选状态）。期望值从 fixture 推导，不读应用代码，见 `tests/support/expect-from-fixture.ts` 的 `builtinTaskIds`、`taskBuckets`、`customTasks`。

### 新测试：`tests/e2e/platform/clean-clone.spec.ts`

**Analog：** `tests/e2e/platform/repo-hygiene.spec.ts`，已有 `isIgnored` 和 `listFiles` helper（行 8-31），用 `execFileSync('git', …, { cwd: repoRoot })`。新用例：`git ls-files` 含应用文件（现在被跟踪）；`app.open()` 不带种子时，目标页显示 7 组示例计划、周视图和时间线没有记录（按计数断言，不抄文字）。示例计划不含个人词条由隐私检查（D-02 的验收）而不是由本 spec 证明。

### 种子 fixture 文件

**Analog：** `tests/fixtures/malformed-imports.ts`（TS 导出常量、文件头说明）和 `tests/fixtures/full-state.json`（带 `_synthetic`）。SAFE-03 要求 `tests/fixtures` 下每个文件带 `SYNTHETIC_MARKER`（`constants.ts` 行 40-41，`repo-hygiene.spec.ts` 检查）。

---

## Shared Patterns

### 转义（D-09）
**Source：** `us-journey-tracker.html:339` 的 `esc()`
**Apply to：** 所有 `render*` 函数、`composer`、`presetsHTML`、编辑器对话框里每一个进入 `innerHTML` 或属性的值。引用点见 `.planning/codebase/CONCERNS.md` 的清单。

### 入口防线 + 渲染防线并存（D-09）
白名单校验在 `normalize`（load 修正）和导入处理（整份拒绝）里；转义在渲染里。两者互不替代，测试要分别证明。

### 测试模式（v1 约定，所有新 spec 复用）
**Source：** `tests/support/test.ts`、`tests/support/app.ts`
- spec 只从 `../../support/test` 导入；support 文件只从 `@playwright/test` 导入，避免循环引用（app.ts 头部注释）。
- 存储模式：`app.open()` 默认 local（页面没有 `window.claude`，种子写 localStorage，只在键不存在时写，见 `seedLocalStorageIfAbsent` 行 13-22）；`app.open({ mode: 'account', seed, userId })` 装 `window.claude` mock，种子写进 Node 侧 `MockBackend`（行 62-76）。`USJ_CONFIG` 要注入时，照同一个模式再加一个 `page.addInitScript(fn, arg)`，函数体自包含、传参数而不是拼字符串（app.ts 行 12 的注释）；`open()` 每个 AppHarness 只能调用一次。
- 读回：`app.persisted()`（落盘）、`app.saved()`（应用保存的最新状态，种子不算）、`app.expectSaved(pred, message)`（保存有 600 ms 防抖，用 `expect.poll`，不用固定睡眠）。默认 message 不含状态内容。
- 隐私：失败信息、断言文案里不放计划文字；类别名属于例外（`tests/support/strings.ts` 头注释）。

### 低优先级、机器判定的测试启动器（本机资源限制）
**Source：** v1 计划里已验证的命令，例如 `.planning/milestones/v1.0-phases/05-timeline-import-narrow/05-02-PLAN.md` 行 158、201；`tools/test-report/check-report.mjs`；`tests/README.md` 行 21。
```
rm -f test-results/<名>.json && PW_JSON_REPORT=test-results/<名>.json node -e "const os=require('os');os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);const r=require('child_process').spawnSync('npm',['test','--','--workers=1',...process.argv.slice(1)],{stdio:'inherit',shell:true});process.exit(r.status??1)" <spec 路径> && node tools/test-report/check-report.mjs test-results/<名>.json "<用例标题>" …
```
全量回归再加 `--min-expected N`，N 取 v1 的 154 条再加本阶段新增条数。`PW_JSON_REPORT` 由 `playwright.config.ts` 行 32-34 接入 json 报告器。验证计划里用这条命令；本映射阶段没有运行它。

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `USJ_CONFIG` 配置缝（应用内） | config | request-response | 代码里没有任何“按配置选后端”的先例；只有 `store` 适配器和 `window.claude` 可选能力解析可借形，实际写法见 `.planning/research/ARCHITECTURE.md` § Pattern 1 |
| 示例计划的具体文字 | config（数据） | — | 属于 Claude's Discretion（D-01 至 D-05）；analog 反而是要避开的：不能与原计划共享任何含汉字且至少 4 个字的字符串，验收靠“暂存区 + 本地种子已加载”下跑隐私检查通过 |

## Metadata

**Analog search scope：** `tests/support/`、`tests/e2e/**`、`tests/fixtures/`、`tools/privacy/`、`tools/test-report/`、`.githooks/`、`.gitignore`、`us-journey-tracker.html` 的 helper、`normalize`、goals 渲染、`store` 区段（只读结构）
**Files scanned：** 约 30
**Pattern extraction date：** 2026-11-06
