# Phase 11: 导出、导入与迁移 - Pattern Map

**Mapped:** 2026-11-10
**Files analyzed:** 12
**Analogs found:** 12 / 12（行号为 HEAD 近似值，改动前重新 grep）

## File Classification

| 新增/修改文件 | 角色 | 数据流 | 最近的类比 | 匹配度 |
|---|---|---|---|---|
| `us-journey-tracker.html`：备份包装与识别 | utility | transform | `importProblem` / `normalize`（:525-546） | exact |
| `us-journey-tracker.html`：Blob 导出（JSON、CSV、B7） | utility | file-I/O | `snapDownload`（:1010-1027）、`csvCell`（:1757） | exact |
| `us-journey-tracker.html`：导入摘要确认 | component | request-response | `confirmBox`（:1235） | exact |
| `us-journey-tracker.html`：导入快照槽和“撤销导入”入口 | store + component | event-driven | `snapKey`/`snapGet`/`snapShow`/`keepConflict`（:991-998） | exact |
| `us-journey-tracker.html`：导入与撤销的写入路径 | controller | CRUD | `commit`（:607）、`importJson` change 处理（:1773） | role-match |
| `tools/plan/migrate-backup.mjs`（新，名称由规划定） | utility | batch | `tools/plan/extract-plan.mjs` | exact |
| `tests/e2e/io/export.spec.ts`、`import.spec.ts`、`known-bugs.spec.ts`（v1） | test | file-I/O | 同名现有文件 | exact |
| `tests/e2e/security/state-validation.spec.ts`（v1；N3 在 :38-39） | test | transform | 自身 | exact |
| `tests/cloud/*.spec.ts` 新增 export/import/undo/migration | test | request-response | `tests/cloud/conflict-snapshot.spec.ts` | exact |
| `tests/support/strings.ts`、`constants.ts`（APP_SHA256） | config | — | 自身 | exact |
| `tests/KNOWN-BUGS.md` | docs | — | 自身（B2 在 :35，N3 在 :38） | exact |
| `PRIVACY.md`、`tools/privacy/privacy-check.mjs`（仅在文件名规则变化时） | config | — | quick 261109-inq 的现有规则 | role-match |

## Pattern Assignments

### 备份包装与识别（`us-journey-tracker.html`，transform）

**类比：** `importProblem(raw)`（:525-543）。它是白名单式校验，返回 `null` 或出问题的字段名：

```js
function importProblem(raw){
  if(!isObj(raw))return null;
  const items=c=>Array.isArray(c)?c:isObj(c)?Object.values(c):[];
  ...
  for(const l of items(raw.logs))if(!isObj(l)||typeof l.id!=="string"||!LOG_ID_RE.test(l.id)||!okDate(l.date))return "log";
  ...
  return null;
}
```

**注意：**
- `importProblem` 对非对象返回 `null`，而且 `{}` 也返回 `null`，这就是 N3 的成因（`state-validation.spec.ts:38-39` 现在断言 `{}` 和 `{logs:[]}` 返回 `null`）。
- 新增外层识别函数，例如 `classifyBackup(raw)`，返回 `{kind:"full"|"plan"|"legacy", plan, state}` 或 `null`。拒绝在这里做，`importProblem` 保持为内层校验。
- 识别顺序（D-01 到 D-03）：先看格式标识，再看里面有没有 plan 和 state，否则按旧 state 的已知字段做类型检查（至少一个字段存在且类型正确），其余返回 `null`。
- 计划部分走 `normalizePlan`（:459），应用走 `usePlan`（:488-494），记录部分走 `importProblem` 再 `normalize`。
- **字段名确认：** 规划在写死包装字段名之前必须停下来让所有者确认（CONTEXT 的 one-way 决定）。示例是 `{app, format:2, exportedAt, plan, state}`。
- 孤儿进度计数（D-07）：对比 `normalize` 前后的 `tasks` 键数，或对照 `planIds` 数；注意 `normalize` 会丢弃孤儿键（:544-545 的注释），所以要在 normalize 之前按 `planIds` 计数。

### Blob 导出（file-I/O）

**类比：** `snapDownload`（:1010-1027）。

```js
let url=null;
try{
  url=URL.createObjectURL(new Blob([JSON.stringify(snap.data,null,2)],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
}catch(e){
  if(url)try{URL.revokeObjectURL(url)}catch(x){}
  toast("留底生成失败，本机副本仍然保留",null,4000);return;
}
setTimeout(()=>URL.revokeObjectURL(url),30000);
```

- 用它替换 `save()`（:1769-1772，现在依赖 `window.__dl.save`，并处理 `declined` 和 `rate_limited`）。同时删除 :643-644 的 `downloads` 解析和 `window.__dl`，让两个导出按钮默认不带 `hidden`（它们现在靠 :644 的 `classList.remove("hidden")` 显示）。
- CSV 要用 `type:"text/csv"`，建议加 BOM（Google 和 Outlook 对中文 CSV 的需要，由规划定）。文件名 `计划手记-备份-<today()>.json`、`计划手记-日历.csv`。
- B7：在 `csvCell`（:1757）里先做前缀，再做引号包裹：

```js
function csvCell(s){s=String(s);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
```

  以 `= + - @ \t \r` 开头的单元格加前缀（例如单引号），再进入原有引号逻辑。注意 `usDate` 生成的日期以数字开头，不会被误伤。
- 数据来源改为“当前计划加记录”：现有 `exportCsv`（:1759-1767）已用 `allTasks()` 和 `tstate`，保留。
- 新格式 JSON 导出：包装里放当前计划和 state，不再是裸 `JSON.stringify(state)`（:1768）。

### 导入摘要确认（component）

**类比：** `confirmBox(o)`（:1235 起），签名 `{title, lines[], who?}`，文字一律 `textContent`，取消是默认焦点，返回 `Promise<boolean>`：

```js
function confirmBox(o){
  return new Promise(res=>{
    if(cfDlg.open){res(false);return}
    ...
    $("cf-title").textContent=o.title;
    o.lines.forEach((t,i)=>{const p=document.createElement("p");...p.textContent=t;body.appendChild(p)});
```

- 摘要的每一行作为 `lines` 的一项。对不上计划的进度条数（D-07）单独一行；`confirmBox` 的 `who` 只加样式给第一行，要醒目提示可能需要新增一个可选字段，规划自行决定。
- 文案集中成常量，同步到 `tests/support/strings.ts`（见下）。
- 拒绝：直接 `toast("文件格式不对，请选择导出的备份 .json")`，不弹框，数据不变。
- **注意 `confirmBox` 定义在 :1235，导入处理在 :1773，在同一个 IIFE 内，因此可直接调用。**
- v1 旧路径目前用原生 `confirm()`（:1774）。把 v1 和云端统一到 `confirmBox` 会改动 v1 用例（它们大概用 `page.on("dialog")`），规划按改动量定。

### 导入快照槽和“撤销导入”入口（store + component，event-driven）

**类比：** :991-1000 的留底槽，一账号一个槽，存在 localStorage：

```js
const snapKey=()=>cacheKey("snapshot");
function snapGet(){try{const r=JSON.parse(localStorage.getItem(snapKey()));return r&&typeof r==="object"&&r.data&&typeof r.data==="object"?r:null}catch(e){return false}}
function snapShow(){$("snapshotBtn").classList.toggle("hidden",!(CLOUD&&me&&snapGet()))}
function keepConflict(kind,doc){
  ...
  try{localStorage.setItem(snapKey(),JSON.stringify({kind,data}));return true}catch(e){return false}
}
```

（上面 `snapGet` 的 catch 返回 `null`，以文件为准。）

- 新增独立的槽，例如 `cacheKey("importundo")`，存 `{plan, state, at}`，不与 `snapshot` 共用（CONTEXT 明确要求两个独立槽位）。
- `keepConflict` 返回 `true/false`，调用方据此处理失败。导入也这样：快照存不下（`setItem` 抛错）就拒绝导入并 toast 明确说明（CONTEXT 的 discretion：不能悄悄失败）。
- “撤销导入”按钮：参照 `$("snapshotBtn")`（:993、:1028）在导出按钮那一栏加一个常驻按钮，用同样的 `hidden` 切换。启动时、登录后调用显示函数（找 `snapShow()` 的调用点并照加）。
- **退出登录清除：** 找 `resetSession`/logout 里清缓存的那一步（grep `cacheKey` 和 `removeItem`），把新槽一起清。logout.spec.ts 是对应的断言位置。
- 撤销要经 `commit`（见下），导入之后如果有新改动，先 `confirmBox` 说明这些改动会一起被撤掉（D-05）。判断“有新改动”：快照里保存一个导入后状态的指纹，或在导入后每次 `commit` 置标志，规划选其一。

### 导入与撤销的写入路径（controller，CRUD）

**类比：** `commit(keys, fn)`（:607）：

```js
function commit(keys,fn){takeRemote();fn(state);if(CLOUD&&me&&docs.state)ops.push({keys,fn});persist(...keys);if(remoteView)applyView(true)}
```

- 现在的导入直接 `state=s;persist("import");renderAll()`（:1774），绕过 `commit`，这是 10-REVIEW IN-05。改成 `commit(keys, st=>{替换内容})`，让 `takeRemote()` 先并入挂起的远端版本；`fn` 会被重放（ops），所以必须是**确定性的、幂等的**：闭包里放已经 normalize 好的数据，不要在 fn 里再调用 `normalize`（它会为缺 id 的条目生成新 id，10-REVIEW IN-06）。
- 计划的替换要看 `docs.plan` 与 `usePlan` 的现有路径（grep `usePlan(` 和 `keys` 里 "plan" 的用法，例如 :1146、:1375 附近），照 Phase 10 对计划的同步方式。keys 的取值要看现有 `commit(` 调用点。
- 把 `e.target.value=""` 放到 `finally`（B2）：现有代码只在 `onload` 的末尾清，取消时 `return` 抢先了。

### 迁移脚本（batch，file-I/O）

**类比：** `tools/plan/extract-plan.mjs`

- 头部注释的结构：模式列表、隐私约定、退出码（:1-18）。照写。
- 零依赖，只用 `node:` 内置模块（:20-24）：`existsSync, readFileSync, writeFileSync, mkdirSync`、`dirname`、`pathToFileURL`。
- 常量导出：`export const SEED_FILE = 'private/plan-seed.json'`（:29），迁移脚本直接复用或 import 它。
- 种子 JSON 解析：`parseSeedJson(text, label)`（:69 起）已经做到“解析失败绝不透传 `err.message`，只输出位置数字”，旧备份的解析同样要这样做，可以直接 import 复用。
- 纯函数加 `--self-test`（合成数据）的结构，带 `pathToFileURL` 的 main 判断。读文件末尾的 main 部分照搬。
- 输出：只写 `private/` 下，只打印计数和校验结果，从不打印计划或记录原文；旧备份路径来自命令行参数；对不上计划的进度条数打印出来（D-06、D-07）。
- 需要共享应用里的校验逻辑：用 `evalSection(html, expr)`（:61）从 `us-journey-tracker.html` 的 `PURE_START`/`PURE_END` 之间求值。**注意：** `importProblem`、`normalize`、`normalizePlan` 是否在这一段里要先确认（`PURE_END` 是 `/* ---------- saving ---------- */`，而 `importProblem` 在 :525，大概率在其后，需要核对）。如果不在，则脚本里只做形状检查加计数，不复用校验函数，不要为了复用而改应用的段落边界。
- 自检用合成旧备份和合成种子；不要把任何个人文字写进脚本。

### 测试（v1 和云端）

**v1：** 按 `tests/README.md:198` 的约定，bug 用例由一条对照加一条 `test.fail`，用 `knownBug(id, summary)`（`tests/support/test.ts`）标记。翻转时删掉 `knownBug` 调用和 `test.fail` 标记，保留断言；对照用例保留。涉及：
- `tests/e2e/io/known-bugs.spec.ts`（B2：取消后 `#importJson` 的 value 为空字符串；N3：导入 `{}` 数据不变）。
- `tests/e2e/security/state-validation.spec.ts:38-39`：现在断言 `importProblem({})` 与 `importProblem({logs:[]})` 为 `null`，必须随行为变化改。如果识别在外层完成，`importProblem` 本身可以不变，改断言目标为新函数。
- `tests/PROBES.md` PROBE-8：应用在取消路径上清空 input 后，该探针会变红（`tests/PROBES.md:129` 明说），必须一并更新。
- `tests/e2e/io/export.spec.ts`：依赖 `app.backend.downloads` 读取导出内容（README:47），改成 Blob 下载后需要改用 Playwright 的 `page.waitForEvent('download')`；cloud 类用例参考 `conflict-snapshot.spec.ts` 的“下载用例只给第二台设备开 `acceptDownloads`”，以及 `readFile` 读下载文件。
- `tests/KNOWN-BUGS.md`：B2 在 :35、N3 在 :38、同类输入在 :51，按“已修复”格式更新。

**云端新用例：** 参照 `tests/cloud/conflict-snapshot.spec.ts`：
- 头部注释说明范围，只用合成账号和合成数据（:1-6）。
- 导入：

```ts
import { test, expect } from '../support/test';
import { syntheticState } from '../support/cloud-data';
import { openDevice, type Device } from '../support/devices';
import { expectToast } from '../support/toast';
import { acknowledgeConsoleErrors } from '../support/guard-ack';
import { FROZEN_NOW } from '../support/constants';
import { ... } from '../support/strings';
```

- 双设备：`openDevice({ browser, guard, fake: app.fake, clock: 'none', acceptDownloads })`，第二台用 manual 时钟（`openSecond`，:36-50）。验证“导入后另一台设备收到更新”“撤销后另一台跟着恢复”可用同样的双设备方式。
- 导入文件用 `tests/support/import-file.ts` 和 `fixture-files.ts` 的现有辅助（v1 的合成文件以 `synth-` 开头，文件只在内存里构造）。
- 合成旧备份加合成种子的整条迁移演练（D-08）：脚本的 `--self-test` 加一个调用脚本导出函数的用例，把结果导入到云端用例中检查记录、复盘、任务进度、力量历史对应正确。

### `tests/support/strings.ts`、`constants.ts`

- 新增的所有文案先在应用里写成常量，再同步到 `strings.ts`（导出名的风格见 conflict-snapshot 的 `BANNER_SNAPSHOT_NOT_KEPT`、`BTN_DOWNLOAD_SNAPSHOT`、`TOAST_CONFLICT`、`FILENAME_SNAPSHOT_FROZEN`、`statusOffline` 函数形式）。
- 改应用的同一个提交里重新记录 `APP_SHA256`（`tests/support/constants.ts`），这是 CONTEXT 的强制要求。

## Shared Patterns

### 用户文本进 DOM
**来源：** `confirmBox` 的 `textContent`；`esc()`。**适用：** 摘要里的所有文字（文件名、计数）。

### 所有改动 state 的路径
**来源：** `commit`（:607）。**适用：** 导入、撤销。不要直接 `state=...;persist(...)`。

### 本机槽位与失败处理
**来源：** `keepConflict` 返回布尔（:995-998）。**适用：** 导入快照的写入，失败即拒绝导入。

### 隐私
**来源：** `tools/plan/extract-plan.mjs` 头部。**适用：** 迁移脚本、测试、文档。不读不引用 `private/plan-seed.json` 内容；不写服务器地址、域名、邮箱、令牌。

## No Analog Found

无完全无类比的文件。以下点需要规划自行决定，没有现成做法：

| 点 | 说明 |
|---|---|
| 导入后“有新改动”的检测（D-05） | 仓库里没有对应机制，需新增指纹或标志。 |
| CSV 的 BOM 和 MIME | 现有代码只处理引号，没有编码处理。 |
| `confirmBox` 的醒目提示行 | 现有只有 `who` 一种样式，可能要扩展。 |

## Metadata

**Analog search scope:** `us-journey-tracker.html`（目标行段）、`tools/plan/`、`tests/cloud/`、`tests/support/`、`tests/e2e/io/`、`tests/KNOWN-BUGS.md`、`tests/PROBES.md`
**Files scanned:** 约 12 个
**Pattern extraction date:** 2026-11-10
**未核实项：** 类比文件的“git 已跟踪”状态没有逐个用 `git ls-files` 核对（它们都是仓库内的常规源码路径，没有 `.gsd` 镜像）；`logout` 清缓存的具体行号、`usePlan` 在计划同步里的调用点、`importProblem` 是否位于 `extract-plan.mjs` 的求值段之内，均需规划阶段 grep 确认。
