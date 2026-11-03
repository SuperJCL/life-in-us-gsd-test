---
phase: 02-account-mock-data-export
reviewed: 2026-11-03T00:00:00Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - tests/PROBES.md
  - tests/README.md
  - tests/e2e/data/synthetic-data.spec.ts
  - tests/e2e/io/export.spec.ts
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/guardrails.spec.ts
  - tests/e2e/platform/mock-contract.spec.ts
  - tests/e2e/platform/probes.spec.ts
  - tests/e2e/smoke.spec.ts
  - tests/e2e/storage/account-mode.spec.ts
  - tests/fixtures/full-state.json
  - tests/fixtures/legacy-categories.json
  - tests/fixtures/malformed-imports.ts
  - tests/fixtures/minimal-state.json
  - tests/mocks/CONTRACT.md
  - tests/mocks/claude-backend.ts
  - tests/mocks/claude-runtime.ts
  - tests/support/app.ts
  - tests/support/constants.ts
  - tests/support/expect-from-fixture.ts
  - tests/support/fixture-files.ts
  - tests/support/static-server.cjs
  - tests/support/strings.ts
  - tests/support/task-ids.ts
  - tests/support/test.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-03
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

本次审查覆盖 Phase 2 新增的账户模式 mock（页面侧 `claude-runtime.ts`、Node 侧 `claude-backend.ts`）、`AppHarness` 的账户模式、合成 fixture 和导出（CSV/JSON）用例。审查时对照了应用源码里相关的函数（`normalize`、`init`、`flush`、导出处理函数、`allTasks`、目标视图的渲染），只读，没有改动。

另外在本机把 `io`、`data`、`storage` 三个目录和 `mock-contract.spec.ts` 用 `--repeat-each=4 --retries=0` 跑了一遍：96 条全部通过，没有观察到 flaky。

**隐私（本次审查的重点）：没有发现问题。** 在 `tests/` 下 grep 绝对机器路径、真实邮箱、用户名，没有命中（命中的只有 `127.0.0.1`、`localhost`、`.invalid`、`example.com` 这类无害主机名）。所有 fixture 文字都以 `SYNTH-` 开头；`full-state.json` 里的力量数值与应用 LIFTS 的 `def`、`target` 都不重合；`task-ids.ts` 只放 id；`strings.ts` 里只有界面文案、类别显示名和 LEGACY 旧类别名（D-12 允许）。

**未发现 BLOCKER。** 5 条 WARNING 集中在：断言的反向对照只覆盖了一部分、导出失败时会把个人计划文字打印出来、`loadFixture` 的路径检查在 Windows 上有缺口、harness 重复 `open()` 会让 mock 注入脚本抛异常、两处用例的断言可以空转。

## Warnings

### WR-01: 导出用例失败时，内置任务文字（个人计划）会被完整打印到终端和 HTML 报告

**File:** `tests/e2e/io/export.spec.ts:57-70`
**Issue:** 用例按 D-14 在运行时从目标页读出内置任务文字，放进内存里的 `Map`，并声明“不写文件、不进 annotation 或控制台”。但第 70 行是 `expect(data).toBe(expected)`：这两个字符串都包含全部有日期的内置任务文字。一旦断言失败（例如应用改了 CSV 格式），Playwright 会把 expected 和 received 的整段文本打进终端输出、HTML 报告和 `error-context`。D-14 的约束在失败路径上被破坏。仓库公开，如果以后接入 CI，日志里就会出现个人计划文字。`playwright-report/` 和 `test-results/` 虽然被 git 忽略，终端和 CI 日志不受这个保护。
**Fix:** 比较之前先把内置任务文字换成占位符，让失败输出里只有 id，不含正文。例如：
```ts
// 把页面读到的任务文字在两边都替换成 <task:ID>，比较的是结构，不是正文
const mask = (csv: string) =>
  [...texts].reduce((acc, [id, t]) => acc.split(t).join(`<task:${id}>`), csv);
expect(mask(data)).toBe(mask(expected));
```
或者逐行比较，失败消息里只带行号和行内的非任务列。

### WR-02: `loadFixture` 的路径分隔符检查在 Windows 上放过了反斜杠

**File:** `tests/support/fixture-files.ts:8`
**Issue:** 正则 `/[\/]/` 只匹配正斜杠，注释和报错文案声称“name 不能带路径分隔符”。本项目的平台是 Windows，`..\\package.json` 这样的名字满足 `endsWith('.json')`，也不含 `/`，会通过检查，`path.join` 随后把它解析到 `tests/fixtures` 之外。目前所有调用方传的都是字面量，所以现在不会出问题，但这个守卫是错的，后面如果有人把参数改成变量就会暴露。
**Fix:**
```ts
if (!name.endsWith('.json') || path.basename(name) !== name) {
  throw new Error(`loadFixture 只接受 tests/fixtures 下的 .json 文件名：${name}`);
}
```
`path.basename` 在 Windows 上同时识别两种分隔符。

### WR-03: MOCK-05 反向对照只证明了 `expectAccountMode` 三项检查里的第一项

**File:** `tests/e2e/storage/account-mode.spec.ts:62-75`（被测代码 `tests/support/app.ts:113-124`）
**Issue:** `expectAccountMode` 做三件事：reads 次数和路径、状态栏文案、localStorage 没有应用的键。D-07 要求常驻反向对照来证明“校验不是永远通过”。但这条用例在 `userId: null` 时 reads 为空，第一项同步失败，`rejects.toThrow()` 就满足了，后两项从来没有被执行到。也就是说“状态栏检查”和“localStorage 为空检查”如果被写成永远通过（比如把 `toBeNull()` 改成 `toBeDefined()`），没有任何用例会变红。`rejects.toThrow()` 也没有限定错误内容，任何原因的抛错都算通过。
**Fix:** 补两条针对性的对照，各只破坏一项：
```ts
// 状态栏：reads 满足，但页面是本地文案 -> 必须失败于状态栏那一项
// localStorage：账户模式下手动 localStorage.setItem(STATE_KEY, '{}') -> 必须失败于第三项
await expect(app.expectAccountMode()).rejects.toThrow(/localStorage/);
```
同时用 `toThrow(/…/)` 限定消息，防止被别的错误顶替。

### WR-04: `AppHarness.open()` 在同一个 page 上第二次以账户模式调用，会让 mock 的注入脚本抛 TypeError

**File:** `tests/support/app.ts:61-64`，`tests/mocks/claude-runtime.ts:122-127`
**Issue:** 每次 `open({mode:'account'})` 都再调用一次 `page.addInitScript(installClaudeMock, …)`，脚本会累积。导航时这些脚本依次执行，第二个脚本的 `Object.defineProperty(window, 'claude', {…, configurable:false})` 要重定义一个不可配置、不可写的属性，值不同，会抛 `TypeError: Cannot redefine property: claude`，成为页面未捕获异常，被 guard 当成违规。`bindingExposed` 已经为“同一个 page 只能注册一次 binding”做了防护，但 init script 没有同样的防护。Phase 3 到 5 如果需要在同一用例里换 `userId` 或重新 `open`，会得到一个很难理解的 pageerror。`store` 字段和 `backend.seed` 也会在重复调用时静默覆盖。
**Fix:** 在 harness 里显式拒绝或做成幂等：
```ts
private opened = false;
async open(opts = {}) {
  if (this.opened) throw new Error('AppHarness.open 每个用例只能调用一次；换配置请新开一个 page');
  this.opened = true;
  …
}
```

### WR-05: MOCK-04 里 CSV 的 toast 断言可以靠 JSON 的 toast 残留通过

**File:** `tests/e2e/storage/account-mode.spec.ts:122-140`
**Issue:** JSON 和 CSV 导出成功后弹出的 toast 文案都是“已导出”，而 toast 要显示约 1800 ms。流程是：点 JSON，断言 toast 有 `on` 且含“已导出”；紧接着点 CSV，poll 到 `downloads.length === 2`，再断言 toast 有 `on` 且含“已导出”。第二组断言在 JSON toast 还没消失的窗口内就能通过，并不能证明 CSV 导出弹过 toast。`export.spec.ts` 里“没有可导出的日期”那条因为文案不同没有这个问题。
**Fix:** 在点 CSV 之前先等 toast 消失（`await expect(toast).not.toHaveClass(/\bon\b/)`，保存用例本身是 fixed 时钟，toast 会自然消失），或者这条用例用 manual 时钟，在第一次断言后 `runFor(2000)` 再点 CSV。

## Info

### IN-01: README 第 10 节写“六项运行时探针”，实际有七项

**File:** `tests/README.md:90`
**Issue:** PROBES.md 标题和表格已经是 PROBE-1 到 PROBE-7（Phase 2 新增了 PROBE-7），README 第 10 节还写“六项”，文档与事实不一致。
**Fix:** 改成“七项”，或者去掉数字。

### IN-02: 端口号 4789 在多处写死，没有用 `PORT` 常量

**File:** `tests/e2e/platform/probes.spec.ts:77-78`，`tests/support/constants.ts:7`
**Issue:** `APP_ORIGIN` 在 `constants.ts` 里手写了 `:4789`，PROBE-2 里又写了两个 `http://localhost:4789/...`。改端口时容易漏掉。`static-server.cjs` 另有一份 `process.env.PORT || 4789`（它是 CJS、不能导入 TS 常量，这一份可以接受）。
**Fix:** `export const APP_ORIGIN = \`http://127.0.0.1:${PORT}\`;`，探针里用模板字符串拼 `PORT`。

### IN-03: IO-03 首个用例里的“还没有任何写入”是单次采样，与项目自己的 WR-06 约定不一致

**File:** `tests/e2e/io/export.spec.ts:39-41`
**Issue:** smoke 和 account-mode 里专门用 manual 时钟把“启动不写存储”做成持续一个防抖窗口的断言（WR-06）。这里 `expect(app.backend.writes).toEqual([])` 是导出后立即采样，600 ms 防抖还没触发就会通过，所以它没有证明什么。这条断言实际上由 account-mode 的 manual 时钟用例负责，此处重复且无效。
**Fix:** 删掉这一行，或者把注释改成“启动不写 mock 由 MOCK-03 manual clock 用例证明”，避免读者误以为这里有证明力。

### IN-04: “每个用例从空 mock 开始”的断言无法检测到共享状态

**File:** `tests/e2e/io/export.spec.ts:149-156`
**Issue:** 用例标题宣称证明隔离，但检查的是本用例自己刚 `new` 出来的 `MockBackend`，必然为空。如果 `MockBackend` 将来改成静态共享状态，这三行仍然通过（要看到泄漏必须依赖同一 worker 里先跑过的别的用例，且文档 `docs` 是私有的，也没被检查）。
**Fix:** 把标题里“every test starts with an empty mock”去掉，或者用两个 `new MockBackend()` 实例直接断言互不影响。

### IN-05: DATA-02 的“合成标记”检查会被注释满足

**File:** `tests/e2e/data/synthetic-data.spec.ts:232`
**Issue:** `malformed-imports.ts` 第 1 行的注释就含 `_synthetic`，所以 `toContain('_synthetic')` 与文件内容是否真的带标记无关。JSON fixture 的标记由 `repo-hygiene.spec.ts` 解析 JSON 检查，这一条对 `.ts` 文件是形式检查。
**Fix:** 改为导入 `SYNTHETIC_MARKER` 并断言每条 `text` 要么以 `SYNTH` 开头要么含该标记；或者把这条断言删掉，避免给出虚假的保证。

### IN-06: `local-seed.json` 的读取在四个 spec 里各写了一份，没有走 `loadFixture`；mock 契约清单漏了一条未实现项

**File:** `tests/e2e/storage/account-mode.spec.ts:15-17`、`tests/e2e/platform/mock-contract.spec.ts:7-9`、`tests/e2e/smoke.spec.ts:65`、`tests/e2e/platform/probes.spec.ts:235`；`tests/mocks/CONTRACT.md:166-189`
**Issue:** 四处重复拼路径并 `JSON.parse`，`Log` 类型在两个 spec 里也各定义一遍；`fixture-files.ts` 已有 `loadFixture`，用它还能享受名字检查。另外，`CONTRACT.md` 第 3.2 节的未实现清单没有写明：契约规定文档顶层必须是 JSON 对象（数组和标量会被拒绝，见该文档第 185 行的引文），而 mock 的 `set()` 不校验，会把 `undefined`、`Date` 等值通过 `JSON.stringify` 静默改写。应用只写对象，所以现在没有影响，但“未实现”清单应当如实列出，免得后续用例作者误以为 mock 会替他们挡住。
**Fix:** 这四处改用 `loadFixture('local-seed.json')`；在 CONTRACT.md 第 3.2 节增加一项“顶层类型和值的 JSON 校验：mock 不检查”。

---

_Reviewed: 2026-11-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
