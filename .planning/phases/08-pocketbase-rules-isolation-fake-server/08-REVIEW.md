---
phase: 08-pocketbase-rules-isolation-fake-server
reviewed: 2026-11-08T00:00:00Z
depth: standard
files_reviewed: 35
files_reviewed_list:
  - .gitattributes
  - .gitignore
  - package.json
  - pb/pb_migrations/1794096000_users_lockdown.js
  - pb/pb_migrations/1794096100_journey_docs.js
  - pb/rules.expected.json
  - playwright.cloud.config.ts
  - tests/PROBES.md
  - tests/README.md
  - tests/cloud/cloud-harness.spec.ts
  - tests/cloud/guard-cloud.spec.ts
  - tests/cloud/pb-contract.spec.ts
  - tests/cloud/probes-cloud.spec.ts
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/guardrails.spec.ts
  - tests/mocks/PB-CONTRACT.md
  - tests/mocks/pb-runtime.ts
  - tests/mocks/pb-samples/realtime.json
  - tests/mocks/pb-samples/rest.json
  - tests/mocks/pb-server.ts
  - tests/support/app.ts
  - tests/support/constants.ts
  - tests/support/static-server.cjs
  - tests/support/test.ts
  - tools/pb/PB-LOCAL.md
  - tools/pb/fetch-local-pb.mjs
  - tools/pb/isolation-check.mjs
  - tools/pb/lib/instance.mjs
  - tools/pb/lib/normalize.cjs
  - tools/pb/lib/rules-snapshot.mjs
  - tools/pb/lib/scenarios.cjs
  - tools/pb/lib/sse-client.mjs
  - tools/pb/migration-check.mjs
  - tools/pb/record-samples.mjs
  - tools/privacy/privacy-check.mjs
findings:
  critical: 0
  warning: 4
  info: 8
  total: 12
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-11-08
**Depth:** standard
**Files Reviewed:** 35
**Status:** issues_found

## Summary

本次审查覆盖 Phase 8 的两份 PocketBase 迁移、本机一次性实例工具链（下载核对、实例库、隔离脚本、录制脚本、归一化）、假 PocketBase 与页面侧假 EventSource、cloud 测试入口和收紧后的请求护栏，以及隐私检查器新增的入口判断。没有收到 structural findings，所以没有 `Structural Findings (fallow)` 一节。

已运行的离线自检全部通过：`migration-check`（含 `--self-test`，19 项）、`fetch-local-pb --self-test`、`instance --self-test`、`isolation-check --self-test`、`record-samples --self-test` 和 `--check`、`privacy-check --self-test`（193 项）。应用文件和 SDK 的 sha256 与钉死值一致；样本文件里没有令牌形状、真实邮箱或公网 IP。`tests/PROBES.md` 和 `tests/README.md` 只做了隐私扫描和与代码的对照，没有逐行审。

总体判断：迁移规则对读取、更新、删除、注册的隔离是扎实的（47 条断言覆盖面广，写类断言都带超级用户回读，还有反向对照）。归一化和写盘闸门对令牌的处理是对的：令牌值、口令、tokenKey、authToken.secret 都不会进入样本，闸门不放行。下载路径是先核对 zip 的大小和 sha256 再解压，zip 成员名单检查有效，没有发现在核对之前运行未核对二进制的路径。

主要问题有四个。

1. 创建规则对字段修饰符键没有被测过（WR-01，安全方向，未能证明也未能排除）。
2. 隔离脚本等几个“只在直接运行时执行入口”的脚本会在入口判断失败时静默退出 0。我用目录联接实测复现了。
3. 下载脚本把子进程的工作目录设成系统临时目录，存在可执行文件被抢先放置的风险。
4. 假服务器在同文档导航时会错误注销实时连接。

## Warnings

### WR-01: journey_docs 的 createRule 没有对字段修饰符键做过隔离断言，可能允许 A 以 B 的名义创建文档

**File:** `pb/pb_migrations/1794096100_journey_docs.js:14`（断言缺口在 `tools/pb/isolation-check.mjs:557-572` 和 `:608-630`）
**Issue:** 创建规则是 `@request.auth.id != "" && @request.body.owner = @request.auth.id`。它比较的是请求体里原始的 `owner` 键。更新规则已经用 `@request.body.owner:isset = false` 挡住了 `owner+`、`+owner`、`owner-` 这类修饰符键（ACCT04-13 实测全部 404），但创建规则没有对应的保护，隔离脚本也没有“创建时带修饰符键”的断言：ACCT04-7 只测了 `owner=B` 单独出现。

我的推断（没有运行 PocketBase，所以不能证明）：PocketBase 在写入记录时会把 `owner+` 这样的键当作对 `owner` 的追加，而单值关系字段取列表里最后一个值。如果请求体是 `{owner: A, "owner+": B, kind: "state", data: ...}`，规则按原始键 `owner = A` 通过，写入时 `owner` 可能被改成 B（Go 的 map 遍历顺序随机，可能时有时无）。结果是 A 能在 B 还没有创建某个 kind 的文档时，抢先替 B 建一份内容由 A 决定的文档；B 之后无法再创建（唯一索引），只能更新那一份，而 B 的应用会读到 A 写的内容。这正好是本阶段要证明不存在的“账号 A 写入账号 B 的数据”。它是否成立取决于 PocketBase 0.41.1 的实际行为，必须用真实实例回答。

**Fix:** 先在 `isolation-check.mjs` 加断言，用真实实例定论，再决定是否改规则。

```js
// ACCT04-27：创建时同时带 owner=A 和修饰符键，槽位空着；B 的槽位用 freeSlot 清空，回读 owner 必须不是 B
check('ACCT04-27', 'A 创建时带 owner=A 加 owner+ 等于 B 的修饰符键，B 的槽位里不得出现记录', async (c) => {
  const restore = await freeSlot(c, 'b', 'plan');
  try {
    const seen = [];
    for (const extra of [{ 'owner+': c.B.id }, { '+owner': c.B.id }]) {
      for (let i = 0; i < 20; i += 1) { // map 遍历顺序随机，多试几次
        const r = await c.api('POST', '/api/collections/journey_docs/records', { token: c.A.token, body: { owner: c.A.id, kind: 'plan', data: { _synthetic: true }, ...extra } });
        seen.push(r.status);
        if (r.status === 200) await c.su('DELETE', recPath('journey_docs', r.json.id)); // 清掉，保持槽位空
      }
    }
    const n = await suCount(c, 'journey_docs', `owner="${c.B.id}" && kind="plan"`);
    return { pass: n === 0, detail: seen.slice(0, 40).join(',') };
  } finally { await restore(); }
}, { write: true, readback: countOf((c) => c.B.id) });
```

如果断言失败，规则本身不能靠 `:isset` 修（创建时 `owner` 必须出现）。可选做法是在服务器端用 `pb_hooks` 的 `onRecordCreateRequest` 强制 `e.record.set("owner", e.auth.id)`，同时把创建规则改成不再信任请求体里的 owner。无论结果如何，修饰符键断言都应该进入 `EXPECTED_IDS`，并同步写进 `PB-CONTRACT.md` 第 7 节。这条在 Phase 13 把迁移复制到服务器之前必须有定论。

### WR-02: 多个“只在直接运行时执行入口”的脚本在入口判断失败时静默退出 0（fail open）

**File:** `tools/pb/isolation-check.mjs:1160-1168`、`tools/pb/record-samples.mjs:568-569`、`tools/pb/lib/instance.mjs:366-367`、`tools/pb/fetch-local-pb.mjs:213-214`、`tools/pb/migration-check.mjs:303-305`
**Issue:** 这五个文件都用 `import.meta.url` 和 `process.argv[1]` 的字符串比较决定是否运行入口，不对两边做 `realpathSync`。一旦两者不一致（仓库路径经过目录联接或符号链接就会），脚本什么都不做、不打印任何内容、退出码 0。对 `npm run pb:isolation`、`record-samples --check`、`migration-check` 这类安全闸门，这是“没有运行”被当成“通过”。

我在本机用目录联接实测：通过联接路径运行 `node <联接>/pb/migration-check.mjs`、`--self-test`、`isolation-check.mjs --self-test` 和 `record-samples.mjs --check`，全部无输出、退出 0。同一个联接路径下，`privacy-check.mjs` 因为已经用 `realpathSync` 做了 fail closed 的入口判断，照常运行。也就是说同一个问题在隐私检查器里已经修过，这里没有沿用。

**Fix:** 把 `privacy-check.mjs` 的 `isEntryScript` 抽成共享小函数（放到 `tools/pb/lib/`，零依赖），五个入口都用它，并且判断失败时按“是入口”处理：

```js
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isEntry(metaUrl) {
  try {
    if (!process.argv[1]) return false;
    let self = realpathSync(fileURLToPath(metaUrl));
    let entry = realpathSync(resolve(process.argv[1]));
    if (process.platform === 'win32') { self = self.toLowerCase(); entry = entry.toLowerCase(); }
    return self === entry;
  } catch {
    return true; // 判断不了时宁可运行
  }
}
// 用法：if (isEntry(import.meta.url)) { ... }
```

### WR-03: 下载脚本以系统临时目录为工作目录调用相对名字的 unzip 和 powershell，存在可执行文件被抢先放置的风险

**File:** `tools/pb/fetch-local-pb.mjs:127`、`:129-138`、`:145`、`:149-153`
**Issue:** `spawnSync('unzip', …, { cwd: os.tmpdir() })` 和 `spawnSync('powershell.exe', …, { cwd: os.tmpdir() })` 用的都是不带路径的名字。在 Windows 上 libuv 解析可执行文件时会先在子进程的 `cwd` 里找，再找 PATH。`os.tmpdir()` 是用户可写、含大量来源不明文件的共享目录；这里恰恰在处理刚下载的数据。同一个用户的任何程序只要在临时目录里放一个 `unzip.exe` 或 `powershell.exe`，就会被这个脚本运行。zip 的 sha256 核对发生在调用之前，保护不了这一步。风险限于本机同用户，而且是一次性脚本，所以我定为 Warning，不是 Critical。

**Fix:** 不要让工作目录里的文件参与解析，并优先用系统自带程序的绝对路径：

```js
const SYS = process.env.SystemRoot || 'C:\\Windows';
const POWERSHELL = path.join(SYS, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
// cwd 用刚建好的空目录（zipDir 或 outDir），不要用 os.tmpdir()
spawnSync(POWERSHELL, [...], { encoding: 'utf8', cwd: emptyDir, windowsHide: true });
```

`unzip` 在 Windows 上不是系统自带程序，建议整个去掉 `unzip` 分支，只用 PowerShell 的 `System.IO.Compression`（列成员和解出单个成员都能做），少一个来路不明的程序，也少一条分支要测。

### WR-04: 假服务器在同文档导航时也会注销页面的实时连接

**File:** `tests/mocks/pb-server.ts:194-202`
**Issue:** `openConnection` 给页面挂了 `page.on('framenavigated', …)`，主框架一导航就删掉该页面的全部连接。按 Playwright 的行为，`framenavigated` 对 hash 变化和 `history.pushState` 这类同文档导航同样会触发（我没有实际跑浏览器验证，这是依据文档和 Playwright 已知行为的判断）。页面里的假 EventSource 实例这时还活着，但 Node 侧已经删了连接：之后的写入会在 `deliveryErrors` 里记“连接已注销”，页面收不到事件，订阅断言会超时或误报。目前单文件应用没有用 hash 路由，所以现在不触发；Phase 9 到 10 一旦用 hash 或 pushState，就会让实时用例无故失败，而且失败信息指向假服务器而不是真正原因。

**Fix:** 只在新文档导航时注销连接。最稳妥的做法是不靠导航事件，在页面侧的假 EventSource 每次新文档加载时发 `es.open` 之前先让 Node 清掉该页面上一代的连接：

```ts
// pb-server.ts：握手时先清掉这个 page 上已登记的连接
openConnection(page: Page | null) {
  if (page !== null) for (const [id, c] of this.connections) if (c.page === page && !this.liveOnPage(page, c)) this.connections.delete(id);
  ...
}
```

或者在 `framenavigated` 里只处理新文档导航：在页面里用 `performance.getEntriesByType('navigation')`/一个每文档唯一的 `window.__pbDoc` 令牌判断文档是否换了，换了才注销。无论哪种，加一条同文档导航后事件仍能送达的用例。

## Info

### IN-01: 规则快照把 relation 字段的目标集合一律写成 `<users>`，目标集合不被核对

**File:** `tools/pb/lib/rules-snapshot.mjs:45-49`
**Issue:** `normField` 对 relation 字段无条件写 `collectionId: '<users>'`，所以迁移里把 owner 指向别的集合、快照和 `rules.expected.json` 仍然一致。真实实例上，指错集合会让创建文档失败，隔离脚本的准备步骤就会报错，所以不会漏到上线，但静态检查和 REPLAY-1 本身证明不了这一点。
**Fix:** 沙箱里给默认 users 模型一个固定 id（例如 `'<users>'`），实例侧只在等于 users 集合 id 时写 `'<users>'`，否则保留原 id，让差异显现。

### IN-02: users 的更新规则没有显式写 email，也没有断言 tokenKey 等系统字段的自改

**File:** `pb/pb_migrations/1794096000_users_lockdown.js:14`（断言侧 `tools/pb/isolation-check.mjs:809-828`）
**Issue:** 本人改 email 被挡住靠的是 PocketBase 核心行为（D5-5 实测 400 `validation_values_mismatch`），不是规则。D5-4 只测了 `verified` 和 `emailVisibility`，没有测 `tokenKey`、`id`、`created`、`updated` 和带修饰符键的自改。我认为隐藏字段在核心里会被还原，但没有断言保证。
**Fix:** 规则里加 `&& @request.body.email:isset = false` 作为第二道保险（客户端改密码只发 `oldPassword`、`password`、`passwordConfirm`，不受影响；同步更新 `rules.expected.json` 和 `migration-check` 的篡改用例）。隔离脚本补一条：A 自己 PATCH `tokenKey`、`id`、`created` 后回读不变、旧令牌仍有效。

### IN-03: 实例库的清理失败是静默的，也没有强制“同一时间只有一个实例”

**File:** `tools/pb/lib/instance.mjs:132-138`、`:145-151`、`:239-241`
**Issue:** `removeDir` 重试 10 次后仍失败（例如进程还没退出，Windows 文件被占用）时只吞掉错误，不告诉调用者，临时目录（含合成数据）会留在系统临时目录里；只有 `--smoke` 检查了清理结果，隔离脚本和录制脚本不检查。进程被 SIGTERM 或关闭终端窗口杀掉时没有任何清理（`PB-LOCAL.md` 已写明要手动清理，这点是诚实的）。文档写的“同一时间只有一个实例”只是约定，没有锁；另外 `verifyExe()` 的哈希核对和之后两次 `spawn` 之间有一个很小的时间窗。
**Fix:** `removeDir` 失败时向 stderr 打一行固定文案（不带路径）；`withInstance` 在 `finally` 里返回前再检查一次目录是否还在，并让调用者可见。需要的话用 `fs.openSync(lock, 'wx')` 做一个简单的实例锁。

### IN-04: 下载脚本的几处小问题

**File:** `tools/pb/fetch-local-pb.mjs:22`、`:109-124`、`:168`、`:198-201`
**Issue:** `fileURLToPath` 导入后没有用。`download()` 先把整个响应读进内存才比对大小，对恶意重定向目标没有上限（有超时，风险小）。解出的 exe 复制到 `PB_EXE_PATH` 之后没有立刻和 `PB_EXE_SHA256` 比，只是打印；复制到一半被中断会留下残缺文件，下次运行只提示“已有程序与钉死值不符”，没有说怎么处理。
**Fix:** 删掉未用的导入；先看 `content-length` 超过钉死大小就中止；复制后立即核对哈希，不符就删除并报错；残缺文件的提示里写明“删除 tools/pb/bin/pocketbase.exe 后重试”。

### IN-05: 隐私检查器的入口判断在 `process.argv[1]` 缺失时按“被导入”处理，与注释里的 fail closed 说法不一致

**File:** `tools/privacy/privacy-check.mjs:1159`
**Issue:** 注释说“只有确认是被 import 才跳过”，但 `if (!process.argv[1]) return false` 在没有 argv[1] 时直接跳过入口。钩子总是带路径调用，所以现实中不触发；我实测过联接路径下它仍会运行，其余分支是对的。
**Fix:** 注释改成准确的说法，或者把这一行的返回值改成与 `catch` 一致。

### IN-06: cloud 护栏自检断言了 Chromium 控制台消息的完整原文

**File:** `tests/cloud/guard-cloud.spec.ts:97`
**Issue:** 断言要求三条消息都等于 `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector`。结尾的 `.Inspector` 是 Edge 当前版本的实现细节，Edge 升级后会无故变红；v1 的 `guardrails.spec.ts` 用的是 `toContain('ERR_BLOCKED_BY_CLIENT')`，更稳。
**Fix:** 改成逐条 `toContain('ERR_BLOCKED_BY_CLIENT')`，保留条数断言。

### IN-07: README 说 test:cloud “低优先级”，但配置里没有实现

**File:** `tests/README.md:20`（对照 `package.json:8`、`playwright.cloud.config.ts`）
**Issue:** `test:cloud` 脚本只是 `playwright test --config=… --workers=1`，没有任何降低进程优先级的机制。`isolation-check` 和 `record-samples` 自己调了 `os.setPriority`，Playwright 的 runner 和 worker 没有。文档的承诺没有代码支撑，用户的电脑容易卡这条约束并没有被保证。
**Fix:** 要么在文档里说明需要用户自己用低优先级方式启动，要么在 `playwright.cloud.config.ts` 顶部加 `os.setPriority`（worker 继承 runner 的优先级）。

### IN-08: 测试工具里几处小的健壮性问题

**File:** `tools/pb/lib/sse-client.mjs:87-90`、`tests/mocks/pb-server.ts:323`、`tests/e2e/platform/app-integrity.spec.ts:229-246`
**Issue:**
- `openSse` 里的 `Promise.race` 超时 `setTimeout` 成功后没有清掉，进程要多等最多 `timeoutMs`（默认 10 秒）才自然退出；`record-samples` 靠自然退出，所以录制结束后会多挂十秒。
- `deliveriesFor` 里 `JSON.parse(rawOptions)` 没有保护，页面提交了畸形订阅选项时，之后任何一次写入都会在路由处理函数里抛错，请求挂到用例超时，而且错误信息指不到原因。
- ENV-03 的 SDK 钉死用例对 `goodChild.kill()` 之后没有等进程退出就在 `finally` 里 `rmSync` 临时目录，Windows 上偶发占用时会让用例随机失败。

**Fix:** 给竞速的定时器保存句柄并在成功后 `clearTimeout`；`JSON.parse` 包 `try/catch`，失败时记进 `deliveryErrors` 并跳过；`kill()` 后 `await once(child, 'exit')` 再删目录。

---

_Reviewed: 2026-11-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
