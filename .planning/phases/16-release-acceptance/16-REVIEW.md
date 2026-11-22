---
phase: 16-release-acceptance
reviewed: 2026-11-22T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - PRIVACY.md
  - deploy/README.md
  - deploy/build-site.mjs
  - deploy/make-acceptance-data.mjs
  - deploy/server-check.mjs
  - deploy/server-config-check.mjs
  - deploy/server/03-configure-pocketbase.sh
  - deploy/server/04-start-pocketbase.sh
  - deploy/server/06-install-site.sh
  - deploy/server/restore-drill.sh
  - deploy/site/manifest.webmanifest
  - deploy/site/sw.js
  - deploy/verify-site.mjs
  - tests/README.md
  - tests/cloud/sw-update.spec.ts
  - tests/e2e/platform/app-integrity.spec.ts
  - tests/e2e/platform/deploy-tools.spec.ts
  - tests/e2e/platform/site-assets.spec.ts
  - tests/mocks/PB-CONTRACT.md
  - tests/support/constants.ts
  - tests/support/static-server.cjs
  - tools/pb/isolation-check.mjs
  - us-journey-tracker.html
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-11-22
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

审查范围是 Phase 16 的代码提交（b070095、2603994、f82b915、043df17、d471fff、9f5cf0f、2866882、6c26e3c、5f46303、d2321bb）的改动，以及改动涉及的上下文。`us-journey-tracker.html` 只看了 16-03 的更新按钮兜底刷新（`swUpdate`）及其周边，没有看健身页和 lb/kg 的改动。按要求没有运行任何测试，没有读 `private/`，没有连接任何服务器。

没有发现必须阻断发布的问题（0 个 BLOCKER）。逐项核对的结果如下。

- `06-install-site.sh` 的两步 reload 顺序是对的：过渡 CSP 的 install、`nginx -t`、reload，再换链接，再装最终 CSP，再 `nginx -t` 加 reload。每一步失败都会走 `rollback`，回滚会放回旧链接和旧 CSP 并 reload。`csp_union` 里只用了 POSIX awk 的写法，没有发现 gawk 与 mawk 行为不同的地方。
- `03` 的 `NEED_CHANGE` 改名已经全部替换，没有残留。工具文件变化不再要求停服务，迁移、钩子、环境文件仍要求停服务。
- `restore-drill.sh` 的 40 小时判断在写演练备份之前，快照边界、`compared` 至少为 1 的逻辑自洽。
- 静态服务器的版本开关加头之后，跨站页面确实改不了它：带自定义头的 fetch 会先发预检 OPTIONS，而服务器对非 GET/HEAD 一律回 405。
- 隐私检查：被审文件里没有真实域名、IP、邮箱或本机绝对路径，出现的地址都是文档保留地址。
- `APP_SHA256` 与当前 `us-journey-tracker.html` 的 sha256 一致。

有 4 个值得修的 WARNING：新增的 `caches.delete` 在特定情形下会删掉正在使用的缓存；F-11 新探测只看状态码；ACCT03-6/7 没有锁住声称"实测"的状态码；4 秒兜底刷新有静默丢稿窗口。另有 4 个 INFO。

## Warnings

### WR-01: sw.js 安装失败时 `caches.delete(CACHE)` 可能删掉正在使用的外壳缓存（16-03 IN-08 引入）

**File:** `deploy/site/sw.js:15-19`，关联 `deploy/build-site.mjs:167-172`、`deploy/build-site.mjs:210`
**Issue:** IN-08 在 install 失败时执行 `caches.delete(CACHE)`，意图是清掉"这次建了一半的缓存"。但缓存名只由 `V` 决定，而 `shellVersion` 只哈希页面、CSP 头、SDK、清单和图标，不含 `sw.js` 自己的内容。所以只改 `sw.js` 逻辑（比如这次改 activate 过滤条件）、其余外壳不变时，新 worker 的 `V` 与正在运行的旧 worker 相同，两者共用同一个 `usj-shell-<V>` 缓存。此时新 worker 因网络抖动取不到某个外壳文件，`catch` 会删掉旧 worker 正在用的完整缓存，旧 worker 退化成每次走网络，离线外壳随之失效，直到下一次安装成功。注释说"旧版本继续用"，在这种情形下并不成立。
**Fix:** 二选一，建议两个都做。
```js
// sw.js：只删这次安装自己新建的缓存
e.waitUntil((async () => {
  const existed = await caches.has(CACHE);
  try {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error(u); return c.put(u, r); })));
  } catch (err) {
    if (!existed) await caches.delete(CACHE);
    throw err;
  }
})());
```
并让 `shellVersion` 把去掉版本占位后的 `sw.js` 模板文本也喂进哈希，这样 `sw.js` 一变，版本和缓存名就跟着变。

### WR-02: F-11 的匿名注册探测只看状态码，任何一层的 403 都算通过（16-02 IN-09）

**File:** `deploy/verify-site.mjs:207-221`、`deploy/verify-site.mjs:694-705`
**Issue:** 改成缺字段请求之后，`anonSignupVerdict` 只按状态码判定：403 即"规则锁住"。PocketBase 规则放开时会返回 400，所以区分是成立的。但 403 也可能来自 nginx、其他中间层或站点配置问题，这时 F-11 会在没有真正碰到 PocketBase 规则的情况下报通过。旧实现真的发一次注册请求，这一点更严格。F-11 是"匿名注册被拒"这条安全验收项，只看状态码比较弱。
**Fix:** 让 `anonSignupVerdict` 同时看响应体。PocketBase 的拒绝体是带 `status`、`message`、`data` 字段的 JSON，只有解析出 `status === 403` 且 `data` 是对象才算锁住，否则返回 `{ ok: false, note: '403 不像来自 PocketBase' }`。自检里补一条"纯文本 403 不通过"的用例。

### WR-03: ACCT03-6/7 没有锁住声称"实测"的 403 和 400（16-02 IN-09）

**File:** `tools/pb/isolation-check.mjs:603-627`，关联 `deploy/verify-site.mjs:207-212`、`tests/mocks/PB-CONTRACT.md:148`
**Issue:** 提交说明、`F11_*` 常量的注释和 PB-CONTRACT 都写"本机实测锁住是 403、放开是 400"，但这两条断言只要求 4xx 且非 429，账号数不变。也就是说，PocketBase 升级后状态码变了，`npm run pb:isolation` 仍然 50/50 通过，漂移要到上线后跑 `verify-site --stage full` 才暴露（会表现为"意外的状态码"或"规则好像放开了"的误报）。`verify-site` 自检里的 `F11_LOCKED_STATUS !== F11_OPEN_STATUS` 只是比较两个常量，不是比较实测值。README 要求换版本时重测，但没有任何自动检查兜底。
**Fix:** 让 ACCT03-6 断言 `r.status === 403`，ACCT03-7 断言 `r.status === 400`，并让常量从一处共享：`isolation-check.mjs` 里 `import { F11_LOCKED_STATUS, F11_OPEN_STATUS } from '../../deploy/verify-site.mjs'`（verify-site 只在直接运行时才执行主流程，导入没有副作用的话即可），或者反过来放到一个只含常量的小模块里两边导入。

### WR-04: 点击更新后的 4 秒兜底刷新会静默丢掉这段时间里新输入的草稿（16-03 IN-02）

**File:** `us-journey-tracker.html:2463`
**Issue:** `swUpdate` 在确认框之前检查了 `swUnsaved()`，之后设置 `swGo=true` 并发出 SKIP_WAITING。正常情况下 `controllerchange` 几乎立刻触发刷新，窗口很小。但兜底路径（新 worker 没接管）会让页面在点击 4 秒后无条件 `location.reload()`，这 4 秒里界面没有锁定，用户可能已经在记录框里输入了新文字，刷新会直接丢掉，而且不会再问一次。恰恰是"更新卡住"的异常路径，用户更可能继续操作。
**Fix:** 兜底刷新前重新检查：
```js
setTimeout(()=>{
  if(swReloaded)return;
  if(swUnsaved()){swGo=false;swBar(false);return}   // 有新草稿：撤回，恢复横幅，让用户自己决定
  swReloaded=true;location.reload();
},4000)
```
并在 sw-update 用例里补一条"兜底刷新前在记录框里输入文字，页面不刷新、横幅恢复"的用例。

## Info

### IN-01: 04 覆盖 unit 之后、进入 `fail_and_disable` 之前的失败不会放回旧 unit，备份文件也不会清理（16-01 WR-08）

**File:** `deploy/server/04-start-pocketbase.sh:150-162`
**Issue:** 旧 unit 的放回只写在 `fail_and_disable` 里，而它只在 `restart`、健康检查、绑定检查、enabled 检查失败时才调用。`install`、`daemon-reload`、`systemctl enable` 本身失败时，`set -e` 直接退出，新 unit 已经落盘、旧 unit 只留在备份里，需要手工放回。另外 `pocketbase.service.usj-backup.<时间戳>` 每次 unit 变化都会新增一份，没有任何保留数量上限。
**Fix:** 把 `fail_and_disable` 里"放回旧 unit"拆成独立函数，并用 `trap ... ERR` 在 `install` 到 `enable` 这一段里调用；备份只保留最近 3 份（沿用 06 里保留 3 个版本目录的做法）。

### IN-02: restore-drill 的备份年龄正则接受负数

**File:** `deploy/server/restore-drill.sh:273`
**Issue:** `^-?[0-9]+$` 让负的年龄（备份时间在未来，说明服务器时钟或备份时间戳不对）通过 40 小时判断。这种情况同样应当算"读不出可信的备份时间"。
**Fix:** 改成 `^[0-9]+$`，让负数落入失败分支。

### IN-03: C-24 用开发机的 awk 运行 `csp_union`，不是服务器上的 awk

**File:** `deploy/server-check.mjs:C-24`（`runCspUnion`，在 Git Bash 里运行）
**Issue:** C-24 的目的是"实际运行合并函数"，但跑的是开发机 bash 带的 awk（通常是 gawk），服务器是 Debian 系的话默认 awk 通常是 mawk。我通读过 `csp_union`，没有发现两者行为不同的写法（`split` 用字面分隔串、`substr`、`in`、`SUBSEP` 多维下标都是 POSIX），所以这里只是覆盖面的空白，不是已知缺陷。
**Fix:** 首次在服务器上运行 06 之前，让 `00-status.sh`（只读）或所有者批准的一次性命令用服务器 awk 跑一遍 C-24 同样的 5 组输入；或在 README 第 8 节注明这一点。

### IN-04: verify-site 的页面头检查接受带 includeSubDomains 或 preload 的 HSTS

**File:** `deploy/verify-site.mjs:110-113`
**Issue:** 新正则只核对 `max-age` 的数值，`max-age=86400; includeSubDomains; preload` 也会通过。静态的 C-17 禁止这两个指令，但线上实测不查，二者不一致。线上头是否被改过只有 verify-site 能发现。
**Fix:** 在 `has('strict-transport-security', ...)` 里再要求值去掉空白后恰好等于 `max-age=<n>`，即 `v.trim() === \`max-age=${hstsMaxAge}\``。

---

_Reviewed: 2026-11-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
