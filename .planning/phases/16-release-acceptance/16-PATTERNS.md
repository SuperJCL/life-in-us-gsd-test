# Phase 16: 新版本上线与总体验收 - Pattern Map

**Mapped:** 2026-11-17
**Files analyzed:** 21 个要改或新建的文件
**Analogs found:** 21 / 21（大多是"改自己、照自己已有的写法"，因为本阶段是修复，不是新建）

所有路径都已是仓库里被 git 跟踪的源文件，没有镜像路径。没有读 `private/`，没有 ssh，没有跑测试。

## 对规划最重要的四个发现

1. **D-12 的趋势图断言已经在 `tests/cloud/migration.spec.ts` 里了。** 第 105-113 行（`gotoFitness` → `setRange(page,'all')` → `readCharts` → 断言 bench 的点全是 `old: true` 的空心点）就是 D-12 要补的东西，由 15-04 的提交带进来。规划时这一项应改成"核对已有断言仍然有效并跑绿"，不要重复添加。
2. **WR-04 和 IN-01 已由 quick 261117-lwq 修完**：迁移清单已自动枚举（`MIGRATION_DIRS`、`migrationSources`、`c23`），`restore-drill.sh` 已有 `--with-real-data`。`13-REVIEW-DISPOSITION.md` 里 WR-04 已是 fixed，IN-01 的状态也要核对，剩下才是 D-01 的 17 条。
3. **`BUNDLE_COUNT` 现在是 32**（上传包加 `SHA256SUMS` 共 33 个文件）。`deploy-tools.spec.ts:20` 写死的 `(33 files)` 此刻是对的，IN-11 要改成 `${BUNDLE_COUNT}` 不是因为错了，而是因为每加一个文件就会错。README §5 第 4 步也写死了"32 个加 SHA256SUMS"。
4. **`APP_SHA256` 的基线在 `tests/support/constants.ts:38`**，由 `tests/e2e/platform/app-integrity.spec.ts:19-22` 核对。改了 `us-journey-tracker.html`（IN-02）就必须在同一次提交里把新哈希写回这个常量。没有重新记录的脚本，用 `sha256sum us-journey-tracker.html`（或 app-integrity 失败信息里的实际值）手动取。

## File Classification

| 文件 | 角色 | 数据流 | 最接近的写法（analog） | 匹配度 |
|------|------|--------|------------------------|--------|
| `deploy/server/06-install-site.sh`（WR-01） | 服务器脚本 | 原子切换 | 自身 `:164-231`（rollback/trap/fail 骨架） | 自身 |
| `deploy/site/sw.js`（IN-06，可选 WR-01 install 核对） | service worker | request-response | 自身 `:15-21` | 自身 |
| `deploy/build-site.mjs`（WR-02、IN-10） | 构建工具 | transform | 自身 `shellVersion`、`inlineBlocks`、`selfTest` | 自身 |
| `deploy/server/03-configure-pocketbase.sh`（WR-03） | 服务器脚本 | 文件安装 | 自身 `:109-175`；`06` 的 `REL_SAME` 分支（"没变就跳过"） | 自身 |
| `deploy/server/04-start-pocketbase.sh`（WR-08） | 服务器脚本 | 文件安装 + 重启 | `06:164-197`（备份当前状态 + 挂回滚）；`05` 的 `/etc/nginx/usj-backup/` 备份 | role-match |
| `deploy/server/restore-drill.sh`（WR-07） | 服务器脚本 | batch 校验 | 自身 `:255-266`、`:315-380` | 自身 |
| `deploy/verify-site.mjs`（WR-06、IN-09） | 本机检查 | request-response | 自身 `checkPageHeaders`、F-11 | 自身 |
| `deploy/server-check.mjs`（WR-06、C-22、C-23） | 静态检查 | transform | 自身 `c17`、`c22`、`selfTest` 的 `gd()` 变异法 | 自身 |
| `deploy/server-config-check.mjs`（IN-05） | 本机检查 | batch | 自身 `:845-866` | 自身 |
| `deploy/site/manifest.webmanifest`（IN-08） | 配置 | — | 自身（删一个字段） | 自身 |
| `us-journey-tracker.html`（IN-02） | 前端 | event-driven | 自身 `swUpdate`（`:2430-2439`） | 自身 |
| `tests/support/static-server.cjs`（IN-07） | 测试支撑 | request-response | 自身 `:145-155`；`tests/cloud/sw-update.spec.ts` 的调用点 | 自身 |
| `tests/support/constants.ts`（`APP_SHA256`；若 IN-07 改调用方式也许要动 `SW_VERSION_CONTROL_PATH`） | 常量 | — | 自身 `:38`、`:72` | 自身 |
| `tests/e2e/platform/deploy-tools.spec.ts`、`site-assets.spec.ts`（IN-11） | 测试 | request-response | 自身；`BUNDLE_COUNT` 已被 `build-site.mjs` 导出 | 自身 |
| `tests/cloud/migration.spec.ts`（D-12） | 云端测试 | CRUD | 自身 `:105-113`（断言已存在）；`tests/e2e/fitness/charts.spec.ts:285-326` | exact |
| `deploy/README.md`、`PRIVACY.md`、`tests/README.md` | 文档 | — | 自身 | 自身 |
| `.planning/phases/16-release-acceptance/16-ACCEPTANCE.md`（新） | 验收清单 | — | `13-ACCEPTANCE.md` | exact |
| `.planning/phases/13-deploy-hardening-acceptance/13-REVIEW-DISPOSITION.md` | 台账 | — | 自身（`disposition: open` → `fixed`） | 自身 |

## Pattern Assignments

### `deploy/server/06-install-site.sh`（WR-01，服务器脚本，原子切换）

**Analog:** 自身。当前切换顺序在 `:205-230`，回滚骨架在 `:164-203`。

**现有顺序**（`:205-230`）：先 `install` 新 CSP 到 `$CSP_DST`（nginx 还没读）→ `mv -T` 换符号链接（对新请求立刻生效）→ `nginx -t` + `reload`（CSP 这时才生效）。窗口就在后两步之间。

**回滚骨架，新增的"过渡 CSP"步骤必须挂在同一套 rollback 下**（`:176-203`）：
```bash
ROLLED_BACK=no
rollback() {
  trap - ERR
  if [ "$ROLLED_BACK" = "yes" ]; then return 0; fi
  ROLLED_BACK=yes
  ...  # 符号链接放回、CSP 放回、nginx -t 通过再 reload
}
trap rollback ERR
fail() { echo "错误：$1" >&2; rollback; exit 1; }
```

**D-01 推荐做法（两步 reload，Claude's Discretion 里的第一种）**：
1. 把"旧哈希 ∪ 新哈希"的过渡 CSP 写进 `$CSP_DST`，`nginx -t` + `reload`。旧哈希来自 `$CSP_OLD`（`:165-170` 已经把旧文件备份成 `$LOCAL_TMP/csp.old`，`CSP_ABSENT=yes` 时没有旧哈希，就直接装最终 CSP）。
2. `ln -sfn` + `mv -T` 换链接（`:217-218` 原样）。
3. 装只含新哈希的最终 CSP（`$CSP_SRC`），`nginx -t` + `reload`。
- 每次 reload 都复用 `:222-230` 的写法（`app_included` 判断、`nginx -t` 失败走 `fail`、`systemctl reload` 失败走 `fail`）。
- 输出末尾（`:245-249`）的键保持不变，另外加一个键如 `CSP_TRANSITION=done|skipped`（保持 `NAME=value` 形态），并同步 `server-check` 里对 06 输出键的检查（见下文 C 系列）。
- 失败时 `rollback` 已经能把 CSP 和链接都放回。过渡 CSP 装好之后任何一步失败，回滚的是 `$CSP_OLD`，所以不用新增回滚分支，只要保证新步骤都在 `trap rollback ERR` 生效的区间内（`:197` 之后、`:231 trap - ERR` 之前）。
- 过渡 CSP 的生成可以放在 `build-site.mjs`（给构建多产出一个文件会改 `BUNDLE_COUNT`），也可以由 06 在服务器上从 `$CSP_OLD` 和 `$CSP_SRC` 里提取 `'sha256-...'` 用 awk/sed 拼出。前者要多一个上传文件和多一条 BD 检查，后者只改 06 但 06 里的文本处理要经 `server-check` 的静态检查。规划二选一并写进计划。

**README §8 必须写**：部署后立刻跑 `verify-site --stage full`（D-01）。

---

### `deploy/site/sw.js`（IN-06，可选 WR-01 的 install 核对，service worker）

**Analog:** 自身（37 行，一次读完）。

**现有 install / activate**（`:15-21`）：
```js
self.addEventListener('install', (e) => e.waitUntil(
  caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) =>
    // cache:'reload' 绕过 HTTP 缓存 ... 任何一个取不到就抛错，安装失败，不留半套缓存
    fetch(u, { cache: 'reload' }).then((r) => { if (!r.ok) throw new Error(u); return c.put(u, r); }))))));

self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
```
**IN-06 的改法**（来自 13-REVIEW）：
```js
ks.filter((k) => k.startsWith('usj-shell-') && k !== CACHE)
```
再把 `:17` 的注释改成"安装失败，旧版本继续用；残留的半套缓存在下次 activate 时删除"，或在失败时 `caches.delete(CACHE)`。

**可选的 WR-01 核对**：只对 `u === '/'` 的响应，读 `r.headers.get('content-security-policy')`，检查它含页面每个内联块的 sha256，不含就 `throw`。注意 sw.js 里只有 `V` 一个占位，且必须恰好出现一次（`build-site.mjs` 的 `slots !== 1` 检查，`static-server.cjs` 启动时也核对）；`/` 的内联块哈希要在运行时从响应体算（`crypto.subtle`），所以实现比 06 的两步 reload 重。D-01 允许只做 06 两步。**任何 sw.js 字节变化都会让 BD-06 和 sw 测试继续要求版本占位恰好一处。**

**测试对应**：`tests/cloud/sw-offline.spec.ts`、`tests/cloud/sw-update.spec.ts`。

---

### `deploy/build-site.mjs`（WR-02、IN-10，构建工具，transform）

**Analog:** 自身。

**WR-02：`shellVersion`**（`:128-135` 附近）。当前签名 `shellVersion({ indexHtml, sdk, manifest, icons })`，调用点在 `buildSite` 的 `:~207`，而 `cspConfText` 在 `buildSite` 里更早就算好了（`:~198`）。改法：
```js
export function shellVersion({ indexHtml, sdk, manifest, icons, cspConfText }) {
  const h = createHash('sha256');
  h.update(Buffer.from(indexHtml, 'utf8'));
  h.update(Buffer.from(cspConfText, 'utf8')); // 新增
  h.update(sdk);
  ...
}
// buildSite 内：shellVersion({ indexHtml, sdk, manifest: manifestText, icons, cspConfText })
```
注意：改了 `shellVersion` 的输入，哈希必然变一次（所有旧版本号失效），这是预期的；`site-assets.spec.ts` 和 `deploy-tools.spec.ts` 都只匹配 `[0-9a-f]{12}`，不会失败。同一文件里 `selfTest` 之外有没有别的调用 `shellVersion` 的地方，规划时要 `grep -n shellVersion deploy tests` 一遍。

**IN-10：`inlineBlocks`**（`:88-90`）：
```js
const re = new RegExp(`<${tag}(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
// 改成 (?![^>]*\\ssrc\\s*=)
```
并加一条自检：`<script data-src="x">…</script>` 仍然算内联块。

**自检的形状**（`selfTest`，`:292-`，所有新增用例照这个写）：
```js
const results = [];
const expect = (name, fn) => {
  let ok = false;
  try { ok = fn() === true; } catch { ok = false; }
  results.push([name, ok]);
};
const a = () => buildSite(synthInputs());
expect('buildCsp：不含 unsafe- 开头的关键字', () => !a().cspHeader.includes('unsafe-'));
```
WR-02 要加的用例，照"确定性"那条的写法（`:~325`）：用 `synthInputs()` 构建一次，再把 `buildCsp` 的一个指令改掉重算 `shellVersion`，断言两次版本不同。因为 `buildCsp` 是纯函数且 `buildSite` 内部直接调用，最小办法是直接调 `shellVersion` 两次，只改 `cspConfText`（把 `connect-src 'self'` 换成 `connect-src 'self' x`）。`expect` 返回值必须严格 `=== true`。

---

### `deploy/server/03-configure-pocketbase.sh`（WR-03，服务器脚本）

**Analog:** 自身，`:109-131`（置 `NEED_CHANGE`）和 `:171-175`（要求先停服务）。

**现状**：
```bash
NEED_CHANGE=no
... 迁移 new → NEED_CHANGE=yes；钩子 new → NEED_CHANGE=yes
ADMIN_STATE=...; DRILL_STATE=...
if [ "$ADMIN_STATE" != same ] || [ "$DRILL_STATE" != same ]; then NEED_CHANGE=yes; fi   # :130，要删
if ! sudo -n test -d "$ENV_DIR" ... || ! sudo -n test -d "$HOOK_DIR" ...; then NEED_CHANGE=yes; fi
...
else NEED_CHANGE=yes   # ENV_STATE=missing（:168）
...
if [ "$NEED_CHANGE" = yes ] && systemctl is-active --quiet pocketbase ...; then ... exit 1; fi  # :172
```
**改法**：把 `:130` 那一行删掉，`NEED_CHANGE` 只由迁移、钩子、环境文件目录和环境文件缺失置位（建议同时改名 `NEED_STOPPED`，让名字说明含义）。`:217-226` 的 `pb-admin.sh` 和 `restore-drill.sh` 安装块保持不动，它们已经在停服务检查之后的"改动"区；规划要确认：服务在运行时，这两个安装块仍会被执行（不再被 `exit 1` 挡住）。`:228-231` 的 `DONE=already` 判断保持。

**输出键**（`:233-239`）保持不变：`PB_ENV_FILE`、`PB_KEY_LEN_OK`、`PB_ORIGIN_SET`、`PB_MIGRATIONS_APP=4`、`PB_HOOKS=1`、`PB_ADMIN_TOOL`、`DRILL_TOOL`。**注意 `PB_MIGRATIONS_APP=4` 和 `MIGRATIONS` 清单（`:77`）由 `c23` 守着，WR-03 不要动它们。**

**对应的静态检查**：`server-check.mjs` 里检查 03 的函数（grep `03-configure` 找）；要新增一条自检：03 不能再有 `ADMIN_STATE`/`DRILL_STATE` 置位 `NEED_CHANGE` 的写法，且 `pb-admin.sh`/`restore-drill.sh` 的 `install` 行在 `is-active` 检查之后仍在。

---

### `deploy/server/04-start-pocketbase.sh`（WR-08，服务器脚本）

**Analog:** `06-install-site.sh:164-203`（备份当前状态 + 失败时放回），骨架在本文件 `:128-149`。

**现状**（`:128-149`）：
```bash
fail_and_disable() {
  echo "错误：$1 已执行 systemctl disable --now pocketbase。最近日志（...）：" >&2
  sudo -n journalctl -u pocketbase -n 20 --no-pager </dev/null 2>&1 | sed -E '...' >&2 || true
  sudo -n systemctl disable --now pocketbase </dev/null || true
  exit 1
}
NEW_SUM=...; OLD_SUM=...
PB_UNIT=same
if [ "$NEW_SUM" != "$OLD_SUM" ]; then
  sudo -n install -o root -g root -m 0644 "$UNIT_SRC" "$UNIT_DST" </dev/null   # 直接覆盖，无备份
  sudo -n systemctl daemon-reload </dev/null
  PB_UNIT=updated
fi
```
**改法**（13-REVIEW 的 Fix）：在 `install` 之前
```bash
UNIT_BAK=""
if [ "$NEW_SUM" != "$OLD_SUM" ] && sudo -n test -f "$UNIT_DST" </dev/null; then
  UNIT_BAK="$UNIT_DST.usj-backup.$(date -u +%Y%m%dT%H%M%SZ)"
  sudo -n cp -p "$UNIT_DST" "$UNIT_BAK" </dev/null
fi
```
`fail_and_disable` 里在 `disable --now` 之前：若 `UNIT_BAK` 非空，`cp -p` 放回、`daemon-reload`，错误信息里打印备份文件名（备份文件名不含敏感信息）。`restart` 用旧 unit 再试一次是可选的。
**要点**：`fail_and_disable` 定义在 `:129`，`UNIT_BAK` 要在它之前初始化为空串，否则 `set -u` 下失败路径会报未绑定变量。**README §9 的 PocketBase 回滚要同步**：写成"把 `…/pocketbase.service.usj-backup.<时间戳>` 放回，`daemon-reload`"。

---

### `deploy/server/restore-drill.sh`（WR-07，服务器脚本，batch 校验）

**Analog:** 自身。

**备份年龄**（`:255-262`）：Python 算出 `AGE_H`，shell 里 `read` 进来、`echo "DRILL_NEWEST_AGE_H=$AGE_H"`，之后只有 `[ "$N_AUTO" -lt 1 ]` 一个判断。在 `:263` 的 `die` 判断旁加：
```bash
if [ "$AGE_H" -gt 40 ]; then
  die "最新的自动备份已经超过 40 小时。"
fi
```
`die` 的用法同 `:225-226`：`... || die "中文原因。"`。

**逐份比对**（`:339-352`，Python 在 `<<'PY'` 里）：
```python
compared = 0; mismatch = 0; changed = 0
for (doc_id, _owner, _kind, data) in rdocs:
    row = live.execute("select updated, data from journey_docs where id = ?", (doc_id,)).fetchone()
    if row is None:
        mismatch += 1          # WR-07：改成 missing_live += 1
    elif row[0] <= ts:
        compared += 1
        if digest(row[1]) != digest(data): mismatch += 1
    else:
        changed += 1
```
改法：加 `missing_live = 0`，`row is None` 时 `missing_live += 1`，加 `out["DRILL_DOCS_MISSING_LIVE"] = missing_live`；输出白名单（`:~371` 的 `case "$line" in DRILL_INTEGRITY=*|...`）里加这个键，否则不会打印。
**通过条件**（`:~376` 附近，`OK_ALL` 判断，本次没完整读到，规划时 `sed -n 370,406p` 看全）：加 `compared >= 1`，并保证输出键都带 `DRILL_` 前缀（C-22 要求）。`--with-real-data` 模式同样适用。
**注意：** 备份时间边界（13-REVIEW 的第 3 点）不在 D-01 的修法里，只要求 `row is None` 单独计数和 `compared >= 1`、40 小时。

**对应的静态检查**：`server-check.mjs` 的 `c22`（`:728-`）。新增条款写在 `c22` 里，照它的写法（`codeLines(text)`、`code.includes(...)`、`problems.push(...)`）。自检用 `gd()`（`:1693-1698`）：
```js
const gd = (fn) => mutate(good, 'restore-drill.sh', (t) => {
  const u = fn(t);
  if (u === t) throw new Error('锚点失效，改动没有生效');
  return u;
});
expect('C-22 坏：没有端口', () => fails(c22, gd((t) => t.replace('127.0.0.1:8091', '127.0.0.1:8092'))));
```
**重要：** `good` 夹具里的合成 `restore-drill.sh` 是 `goodContext()` 里一段内嵌文本（`server-check.mjs:~1138` 附近开始的合成夹具区，13-REVIEW 说"后面是自检用的合成夹具"）。给真脚本加东西之后，必须同步改这段合成夹具，否则 `好的合成上下文在 C-02 到 C-23 全部通过`（`:1447`）会红。每加一个 c22 条款就加一条"好"（已被 `:1699` 覆盖）和一条"坏"用例，坏用例用 `gd` 把新条款对应的那一行替换掉。

---

### `deploy/verify-site.mjs`（WR-06、IN-09，本机检查，request-response）

**Analog:** 自身。

**WR-06：** `checkPageHeaders`（`:98-113`）里 `has('strict-transport-security', (v) => v.includes('max-age=86400'));`。提一个常量。建议放在 `deploy/build-site.mjs` 导出（`verify-site` 已经 import 它的 `BUNDLE_COUNT`、`BUNDLE_SOURCES`、`CONFIG_LINE`），例如 `export const HSTS_MAX_AGE = 86400;`，两个检查脚本都 import；自检里 `:790` 的 `'max-age=86400'` 夹具和 `:799` 的反例也用这个常量（`'max-age=31536000'` 作反例可保留）。**注意 `server-check.mjs` 目前不 import `build-site.mjs`，它读文本做静态检查，保持"不执行被检查的代码"的风格；若要共享常量，规划选一个地方（例如新的 `deploy/constants.mjs`）并让两个检查脚本和 build-site 都 import，不要在 `server-check` 里为此执行 build 逻辑。**

**IN-09：F-11**（`:675-681`）：
```js
await run('F-11', '匿名注册被拒，匿名读不到任何文档', async () => {
  const pw = hex(12);
  const reg = await request(`${base}/api/collections/users/records`, { method: 'POST', json: { email: `anon-${hex(4)}@example.com`, password: pw, passwordConfirm: pw } });
  if (isOk(reg.status)) return { ok: false, note: '匿名注册成功了' };
  const list = await request(`${base}/api/collections/journey_docs/records`);
  return anonListEmpty(list.status, list.body.toString('utf8')) ? true : { ok: false, note: '匿名读到了记录' };
});
```
改法（13-REVIEW）：把注册请求改成缺字段的请求（例如 body 只有 `{}`，或缺 `passwordConfirm`）：`createRule` 不放开时 PocketBase 返回 403，放开时返回 400（校验失败）且不创建记录。判定写成"状态必须是 403（或 401），400 视为规则没锁（FAIL，但没有创建账号）"。**要先确认 PocketBase 对缺字段的 POST 在规则拒绝时是 403**（`tests/cloud/pb-contract.spec.ts` 和 `tools/pb/` 的隔离检查里有真实 PocketBase 的返回形状，可以用 `npm run pb:isolation` 一类的本机一次性实例验证，**不在本次映射范围内运行**）。同时保留失败 note 提醒"请在后台删除 `anon-` 开头的账号"作为兜底。F-11 的 note 不能写入邮箱。
**自检**（`:765-`，形状见下）：F-11 是联网项，`selfTest` 里只能测纯函数（`anonListEmpty`、`isOk`）；新判定逻辑如果抽成纯函数（例如 `anonSignupVerdict(status)`），就能加自检。

**自检形状**（`:765-770`）：
```js
function selfTest() {
  let total = 0;
  const failures = [];
  const expect = (name, ok) => { total += 1; if (!ok) failures.push(name); };   // 注意：这里 ok 是布尔值，不是函数
  expect('缺一个头能发现', checkPageHeaders((n) => lacking[n] ?? null).join() === 'permissions-policy');
```
`--check-bundle` 的变异检查用 `mutated(base, path, fn)`（`:752-764`）改一个文件并让 `SHA256SUMS` 跟着变，再用 `failIds(...)` 断言只有指定的 BD 项失败，如 `expect('BD-06：...', failIds(mutated(syn, 'site/sw.js', ...)) === 'BD-06')`。

**BD 检查的编号**：`BD-01..BD-09`，格式 `add('BD-0N', '中文标题', () => {...})`（`:296-364`）。WR-02 如果想在 `--check-bundle` 里验"版本号包含 CSP"，新增一项要同步改 `BUNDLE OK (9 checks)`（`deploy-tools.spec.ts:21`）、`verify-site.mjs` 头注释、README。**推荐不新增 BD 项**，只在 `build-site` 自检里加用例。

---

### `deploy/server-check.mjs`（WR-06 的 `c17`；C-22、C-23 与每处服务器脚本改动同步）

**Analog:** 自身。

**`c17`**（`:527-546`）：
```js
for (const l of hsts) if (l.trim() !== 'add_header Strict-Transport-Security "max-age=86400" always;') problems.push(`${name} 的 HSTS 不是 max-age=86400`);
```
把 `86400` 换成共享常量，同时 `:1138`、`:1148` 的合成夹具、`:1613-1618` 的 C-17 自检、`CHECKS` 里 C-17 的标题（`:948`）里的字面值都改用同一个常量或模板字符串。

**`CHECKS` 表**（`:931-`）的形状：
```js
{ id: 'C-17', title: '...', run: c17 },
```
每个检查函数返回问题字符串数组，空数组算通过（`passes = fn(ctx).length === 0`）。

**同步清单（规划必须逐条对应）：**

| 改动 | 要同步的静态检查 |
|------|------------------|
| 06 两步 reload（WR-01） | 06 的检查函数（`grep -n "06-install-site" deploy/server-check.mjs`）：新增"CSP 过渡步骤在 `mv -T` 之前、最终 CSP 在之后、都在 `trap rollback ERR` 区间内"；合成夹具里的 06 文本同步 |
| 03 的 NEED_CHANGE（WR-03） | 03 的检查函数（同法找）；合成夹具同步 |
| 04 的备份（WR-08） | 04 的检查函数：unit 备份在 `install` 之前、`fail_and_disable` 里有放回；README §9 文字 |
| restore-drill（WR-07） | `c22` 加：`AGE_H` 上限、`compared` 下限、`DRILL_DOCS_MISSING_LIVE` 在输出白名单里 |
| 迁移清单不变 | `c23` 不需要动；若上传包文件数变（例如新增过渡 CSP 文件）才要改 README 的文件数，`c23` 会对照 |
| 所有新增的检查标题 | 改了 `CHECKS` 的标题但不改 id；总数 23 不变时，`好的合成上下文在 C-02 到 C-23 全部通过` 的数组不用改，新增 C-24 才要改 |

**自检的形状**（`:1426-1445`、`:1447`）：
```js
const expect = (name, cond) => { n += 1; let ok = false; try { ok = cond() === true; } catch { ok = false; } if (!ok) { bad += 1; console.log(`FAIL 自检：${name}`); } };
const good = goodContext(bash);
const passes = (fn, ctx) => fn(ctx).length === 0;
const fails = (fn, ctx) => fn(ctx).length > 0;
expect('C-17 坏：HSTS 一年', () => fails(c17, mutate(good, 'nginx/usj-headers-common.conf', (t) => t.replace('max-age=86400', 'max-age=31536000'))));
```
`mutate(good, 文件名, 变换)` 返回新上下文；用 `gd`（C-22）这样的局部包装保证"锚点失效就抛错"，避免替换没生效却被当成通过。

---

### `deploy/server-config-check.mjs`（IN-05，本机检查）

**Analog:** 自身，`:845-866`。当前：
```js
const oldTemp = { TEMP: process.env.TEMP, TMP: process.env.TMP };
...
} finally {
  process.env.TEMP = oldTemp.TEMP;
  process.env.TMP = oldTemp.TMP;
  fs.rmSync(SCRATCH, ...);
}
```
改成（13-REVIEW 原文）：
```js
for (const k of ['TEMP', 'TMP']) { if (oldTemp[k] === undefined) delete process.env[k]; else process.env[k] = oldTemp[k]; }
```
这个文件的自检（`--self-test`）不覆盖 `runLocal`，可以在 `selfTest` 里加一条：抽出一个小函数 `restoreEnv(old)`，传入 `{TEMP: undefined}` 之后 `'TEMP' in process.env === false`。

---

### `deploy/site/manifest.webmanifest`（IN-08）

删掉 `"description": "计划手记"`（`:4`）。注意：清单字节变了，版本号会变，这是预期的。`tests/e2e/platform/site-assets.spec.ts` 有清单内容的断言，规划时 `grep -n description tests/e2e/platform/site-assets.spec.ts tests/cloud` 确认没有断言 `description`。

---

### `us-journey-tracker.html`（IN-02，前端，event-driven）

**Analog:** 自身，`swUpdate`（`:2430-2439`）：
```js
async function swUpdate(){
  if(swGo||swAsk)return;
  swAsk=true;swBar(true);
  if(swUnsaved()){ ... if(!ok){swAsk=false;swBar(false);return} }
  swAsk=false;swGo=true;
  const w=swReg&&swReg.waiting;
  if(w)w.postMessage({type:"SKIP_WAITING"});else location.reload();
}
```
`swReloaded` 已在 `:2420` 声明（`let swReg=null,swGo=false,swAsk=false,swReloaded=false;`），`controllerchange` 处理器在 `:2443`。IN-02 的兜底（13-REVIEW 的写法）放在 `postMessage` 之后：
```js
if(w){w.postMessage({type:"SKIP_WAITING"});setTimeout(()=>{if(!swReloaded){swReloaded=true;location.reload()}},4000)}else location.reload();
```
文件的风格：致密、一行多语句、双引号、分号、无注释。要新增的文字不要新建字符串常量（不需要用户可见文案）。

**必须同时做的：**
1. 重新记录 `tests/support/constants.ts:38` 的 `APP_SHA256`（同一次提交，见 `app-integrity.spec.ts:21` 的信息）。
2. 新增一条 cloud 用例：`tests/cloud/sw-update.spec.ts` 里仿现有用例，用 `page.evaluate` 让 `swReg.waiting.postMessage` 变成空操作（或把 `SKIP_WAITING` 吃掉），断言 4 秒（可用 `page.clock` 快进，若该文件已用时钟；否则 `expect.poll` 等待）后页面自动 reload。写之前先读 `sw-update.spec.ts` 的头部和一个现有用例，复用它的 `finally` 里把版本调回 `test` 的规则（`tests/README.md:282`）。
3. 构建出来的页面哈希会变，版本号也会变；`BD-04` 会重算内联块哈希，不需要手改。

---

### `tests/support/static-server.cjs`（IN-07，测试支撑，request-response）

**Analog:** 自身，`:145-155`：
```js
} else if (pathname.startsWith(SW_VERSION_CONTROL_PATH)) {
  const v = pathname.slice(SW_VERSION_CONTROL_PATH.length);
  if (/^[a-z0-9]{1,16}$/.test(v)) { swVersion = v; res.writeHead(204, { 'cache-control': 'no-store' }); } else { res.writeHead(400); }
  res.end(); return;
}
```
**改法**（13-REVIEW 二选一）：
- 方案 A：只接受 `POST`。现有的"对非 GET/HEAD 返回 405"在更靠前的位置（规划时 `grep -n "405" tests/support/static-server.cjs`），要给这个路径放开 `POST` 并让它的 `GET` 返回 405；
- 方案 B：要求固定自定义请求头（如 `x-usj-test: 1`），否则 403。跨站页面发不出带自定义头的简单请求。

方案 B 改动最小（调用方只加一个 header）。**调用方只有 `tests/cloud/sw-update.spec.ts`**（`grep -rn "sw-version\|SW_VERSION_CONTROL_PATH" tests` 找到的就是它，通过 `request` fixture），加上 `tests/README.md:282` 的说明要同步改成 `POST` 或"带头"。`constants.ts:72` 的 `SW_VERSION_CONTROL_PATH` 保持。

---

### `tests/e2e/platform/deploy-tools.spec.ts` 和 `site-assets.spec.ts`（IN-11，测试）

**Analog:** 自身；`BUNDLE_COUNT` 已由 `deploy/build-site.mjs` 导出（`:~83`）。

**现状**（`deploy-tools.spec.ts:19-22`）：
```ts
expect(lastLine(run([script('build-site.mjs'), '--out', bundle]))).toMatch(/^BUILD OK [0-9a-f]{12} \(33 files\)$/);
expect(lastLine(run([script('verify-site.mjs'), '--check-bundle', bundle]))).toBe('BUNDLE OK (9 checks)');
```
**改法**（13-REVIEW 的 Fix）：这个 spec 是 `.ts`，`build-site.mjs` 是 `.mjs`，Playwright 的 TS 加载器能 import `.mjs`，但保险的做法是用动态 `await import(pathToFileURL(script('build-site.mjs')).href)` 取 `BUNDLE_COUNT`（先在本机 `npx --no playwright test tests/e2e/platform/deploy-tools.spec.ts` 低优先级验证一遍，规划里写进验证步骤）：
```ts
const { BUNDLE_COUNT } = await import(pathToFileURL(script('build-site.mjs')).href);
...toMatch(new RegExp(`^BUILD OK [0-9a-f]{12} \\(${BUNDLE_COUNT + 1} files\\)$`));
```
`BUILD OK ... (N files)` 的 N 含 `SHA256SUMS`（所以是 `BUNDLE_COUNT + 1`，当前 32+1=33）。该 spec 现在是同步函数，改成 `async`。
`site-assets.spec.ts:2` 的注释 "13-15 总体验收" 改成 "Phase 16 总体验收（16-ACCEPTANCE.md）"。

---

### `tests/cloud/migration.spec.ts`（D-12，云端测试，CRUD）

**Analog:** 自身 + `tests/e2e/fitness/charts.spec.ts:285-326`。

**状态：趋势图断言已经存在**（`migration.spec.ts:105-113`）：
```ts
await gotoFitness(page);
await setRange(page, 'all');
const benchHist = (legacy.lifts.bench.hist as Array<{ date: string; v: number }>)
  .slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  .map((h) => [h.date, String(h.v), true]);
expect(benchHist.length, '合成旧备份的 bench 有历史').toBeGreaterThan(0);
const benchChart = (await readCharts(page)).find((c) => c.lift === 'bench');
expect(benchChart?.pts.map((p) => [p.date, p.v, p.old]), 'bench 趋势图的点都是以前手填的空心点').toEqual(benchHist);
```
它的帮助函数来自 `tests/support/fitness.ts`：`gotoFitness`（`:9`）、`setRange`（`:197`）、`readCharts`（`:142`，返回 `ChartRead`，`pts: {date, v, old, cx}`）。`charts.spec.ts` 的 FIT-04 写法是 `bench.pts.map((p) => [p.date, p.v, p.old])`，两者一致。

**规划要做的是：** 核对这段仍然通过（只跑 `npx --no playwright test --config=playwright.cloud.config.ts --workers=1 tests/cloud/migration.spec.ts`，低优先级）。如果觉得 D-12 还缺什么，可以补两条：(1) 图例（`bench.hasLegend` 为真，`bench.notes` 等于 `FC_LEGEND`，需要从 `tests/support/strings.ts` import `FC_LEGEND`）；(2) 范围用默认的"1 个月"时合成旧历史不在范围内的提示（可选）。不要新建文件。

---

### `deploy/README.md`、`PRIVACY.md`、`tests/README.md`（文档）

| 位置 | 改什么 |
|------|--------|
| README §2（`:12-20`） | IN-04：把"令牌不会进日志"改成"访问日志不含查询串；错误日志在上游出错时含完整请求行（含 `?token=`，短时有效），保留约 14 天" |
| README §5 第 4 步（`:~65`） | "32 个加 `SHA256SUMS`"改成不写死数字，写"等于清单行数（`BUNDLE_COUNT`，见 `build-site.mjs`）加 `SHA256SUMS`"；`c23` 对照 README 的文件数，改文字前先看 `c23` 怎么匹配（`server-check.mjs:845-`），改完要同步它的正则和自检 |
| README §8 PocketBase 版本（`:128`） | WR-05：如实写"PocketBase 本体升级目前没有自动化脚本；需要新增一个批准后的 `02b-upgrade-pocketbase.sh`（备份 pb_data、停服务、换二进制、04）。02 会拒绝升级，且 C-10 要求钉死值与 Phase 6 相同"。不要再写"改 02 里的下载地址" |
| README §8 应用 / HSTS（`:126`、`:129`） | WR-01："部署后立刻跑 `--stage full`，并在两台设备上各看一次页面"；WR-06："改共享常量和两个头文件，同一次批准" |
| README §9 PocketBase（`:135`） | WR-08：对应 04 的 unit 备份 |
| README §15（`:202-204`） | 改指 `.planning/phases/16-release-acceptance/16-ACCEPTANCE.md`；"A 到 I"的叙述同步 |
| PRIVACY.md（`:91`、`:110-119`） | 第 91 行 "Phase 13" → "Phase 16"；§7、§9、§8 的顺序改成 §7、§8、§9（同时检查文内互相引用的节号） |
| tests/README.md（`:86`、`:283`） | `:86` 把放行路径写全（`CLOUD_APP_PATHS` 的内容见 `tests/support/constants.ts`）；`:283` "四个视图" → "五个视图" |

README 的文件计数和 `c23` 的关系是本阶段最容易踩的坑：任何改 README 里数字或措辞的地方，都先跑 `node deploy/server-check.mjs`（只读静态检查，很轻）确认 C-23 还通过。

---

### `.planning/phases/16-release-acceptance/16-ACCEPTANCE.md`（新建，验收清单）

**Analog:** `.planning/phases/13-deploy-hardening-acceptance/13-ACCEPTANCE.md`（exact）。

**格式**：开头段落（用途、两台设备、先测试账号后真实数据、怎么回报、需要准备的东西），然后每节一个二级标题加表格：
```markdown
## A0 前置（Claude 已做，所有者确认）

| 编号 | 操作 | 期望 | 结论 | 备注 |
|------|------|------|------|------|
| A0-1 | 看 13-11 的报告：线上检查 `verify-site --stage full` | 部署完成，最后一行 `VERIFY OK (19 checks)` | | |
```
每节末尾有"结论："行。D-05 要求每项标「必做」或「可选」（四项可选：15-UAT 第 8 项读屏和键盘、G-2 三条 backstop、D-4 微信内置浏览器、I-2 后台故意输错口令）；D-06 的顺序是：发布修复版本 → E 项最前（每台设备换版）→ A–I 和空计划起步、健身页 → J 迁移 → K 删除测试账号 → 次日回看加导入后演练；D-07 把需要两台设备同时在场的项（B 同步、C-4、H-2、15-UAT 第 6 项）集中成一节；D-08 的第二个测试账号用于空计划起步和从示例里挑；D-18 末尾加可选的"待你确认的已接受风险"一节。

**输入材料**（规划时要读的，本次没有逐条读，避免加载过多）：`14-UAT.md`（4 项）、`15-UAT.md`（8 项）、`12-UAT.md`（5 项，G 节）、`13-UAT.md`（6 项）、`10-UAT.md`（第 1 项）。A0-1 的 `VERIFY OK (19 checks)` 要核对修复版本上线后是否仍是 19（IN-09 若改动了 F-11 但不增减项则不变）。
**隐私**：清单和回报里不写账号、邮箱、网址和真实内容；测试账号只描述为"`test-` 开头的假邮箱"。

---

### `.planning/phases/13-deploy-hardening-acceptance/13-REVIEW-DISPOSITION.md`

**Analog:** 自身。每条的形状：
```yaml
  - id: WR-01
    severity: warning
    disposition: open       # 修完改成 fixed；IN-03 改成 wontfix 或 n/a 并写理由（D-01 说不改代码）
    title: "..."
```
WR-04 已经是 `fixed`。D-01 的 17 条里 IN-03 是"不改代码"，要在台账里写明理由（首日误报已不适用，次日回看在清单 I-4），不要标成 fixed。规划时先 `sed -n 1,200p` 读完整个台账，看是否有 `note`/`fixed_in` 之类的字段，沿用同一形状。

---

## Shared Patterns

### 服务器脚本的公共写法
**来源：** `06-install-site.sh`、`03-configure-pocketbase.sh`、`04-start-pocketbase.sh`
**适用：** 所有改动的 03、04、06、restore-drill
- 每条改系统的命令都是 `sudo -n ... </dev/null`；
- 错误信息用中文、不带敏感值、`echo "错误：..." >&2` 后 `exit 1`；
- 输出只有固定的 `KEY=value` 行；
- `set -euo pipefail` 且没有 `set -x`（`hasTraceOption` 会抓）；
- 比较文件用 `file_state`（`03:98-107`，`new`/`same`/`differ`）。

### 上传包与批准流程（Phase 16 发布要复用）
**来源：** `deploy/README.md` §5（`:49-77`）
1. 批准清单 = `private/deploy-out/SHA256SUMS`（加它自己的 sha256），所有者看过变化文件全文后批准，只覆盖清单里的文件；
2. 上传前本机 `sha256sum -c --strict SHA256SUMS`；
3. 服务器上 `mktemp -d`（0700）→ 本机 `tar -C private/deploy-out -cf - <路径> | ssh ... "tar -xf - -C $UP"`；
4. 上传后在服务器再核对，并比对文件数；
5. 每个脚本以 `bash server/<脚本> <上传目录>` 执行，脚本入口自己核对 `SHA256SUMS`（`03:55-75` 的 `verify_uploads` 接受两种分隔符）；
6. 批次最后 `rm -rf "$UP"`；
7. 不一致就停下重新请批准；
8. 每条会改服务器的命令执行前，原文和对应清单行再贴一次，所有者当场确认；
9. 只读 `00-status.sh` 经标准输入运行：`ssh ... 'bash -s' < deploy/server/00-status.sh | node tools/privacy/redact.mjs`；
10. 所有服务器输出过 `redact`。

D-02 的上传包：新页面、新 `sw.js`、新的 03、04、06、新 `restore-drill.sh`；04 随包上传但不运行。运行顺序 03（只装工具文件，不停 PocketBase，WR-03 之后）→ 06 → `verify-site --stage full` + 只读状态。`--stage full` 会故意输错 6 次后台口令，让所有者所在 IP 的后台登录等 60 秒，安排时避开所有者要登录后台的时刻。

### 自检（self-test）统一形状
三个文件（`build-site.mjs`、`server-check.mjs`、`verify-site.mjs`）和 `server-config-check.mjs`、`make-acceptance-data.mjs` 都是：`--self-test` 参数，纯函数加内存里的合成夹具，不读 `private/`，最后一行 `SELF-TEST OK (N cases)`。`deploy-tools.spec.ts:13-17` 逐个跑这五个并用正则 `^SELF-TEST OK \(\d+ cases\)$` 核对，所以**新增用例不需要改测试**，只要仍打印这一行。
- build-site：`expect(name, () => 布尔)`，结果收集进 `results`；
- server-check：`expect(name, () => 布尔)`，失败打印 `FAIL 自检：<name>`，用 `good`/`mutate`/`passes`/`fails`；
- verify-site：`expect(name, 布尔值)`，失败收进 `failures`。
注意前两者传函数，verify-site 传已算好的布尔值，别混用。

### 云端测试装置
**来源：** `playwright.cloud.config.ts`、`tests/mocks/pb-server.ts`（`FakePbServer`）、`tests/cloud/cloud-harness.spec.ts`
- `playwright.cloud.config.ts` 展开基础配置，设 `process.env.USJ_TEST_MODE = 'cloud'`、`testDir: './tests/cloud'`、`workers: 1`；`package.json` 里 `test:cloud` 是 `playwright test --config=playwright.cloud.config.ts --workers=1`；
- 用例用 fixture：`test, expect` 从 `tests/support/test`，`app.open({ mode: 'cloud', seed: syntheticState('x'), login: 0, users: N })` 开页面，`app.fake` 是假服务器（`seed`、`lastState(i)`、`lastPlan(i)`、`users`）；
- 真实 PocketBase SDK 0.28.1 在浏览器里同源加载，REST 由 Node 侧 `FakePbServer` 接应；
- 故意制造的 4xx 要用 `guard.remove(...)` 声明（`cloud-harness.spec.ts:10-19`），否则 console.error 会让用例失败；
- 只用合成数据，从不读 `private/`。

### 本机验证命令（低优先级，不并发）
- 单个文件：`npx --no playwright test <文件>`（默认套件，`testDir ./tests/e2e`）；
- cloud 单个文件：`npx --no playwright test --config=playwright.cloud.config.ts --workers=1 <文件>`；
- 轻量检查可以随时跑：`node deploy/build-site.mjs --self-test`、`node deploy/server-check.mjs`、`node deploy/server-check.mjs --self-test`、`node deploy/verify-site.mjs --self-test`；
- 最后全量：`npm test`、`npm run test:cloud` 依次跑，用 `tools/test-report/check-report.mjs` 核对（D-17）。

## No Analog Found

| 文件 | 角色 | 数据流 | 原因 |
|------|------|--------|------|
| 06 的"过渡 CSP"如何由服务器拼出 | 服务器脚本 | transform | 仓库里没有在 shell 里合并两份 CSP 哈希的先例；规划要在"build-site 多产出一个过渡文件（改 `BUNDLE_COUNT`、BD 检查、README 文件数）"和"06 里用 awk/grep 提取 `sha256-` 并拼接"之间选一个。前者更易自检，后者上传包不变 |
| sw.js 的 install 时核对 CSP 头 | service worker | request-response | 没有先例；用 `crypto.subtle` 算响应体的内联块哈希需要新测试，D-01 允许不做 |
| 修复版本的"确认设备已换版"的清单写法 | 文档 | — | 没有界面变化可借（Claude's Discretion）；用"重开之后不再出现横幅"的现有行为写进清单 |

## Metadata

**Analog 搜索范围：** `deploy/`、`deploy/server/`、`deploy/site/`、`tests/cloud/`、`tests/support/`、`tests/e2e/platform/`、`tests/e2e/fitness/charts.spec.ts`、`tests/mocks/pb-server.ts`、`playwright.cloud.config.ts`、`us-journey-tracker.html` 的 `swUpdate` 附近
**扫描的文件数：** 约 25 个（大文件都用 grep 定位后只读相关区间）
**未逐行读的：** `server-check.mjs` 的合成夹具区（`:1100-1425`）、`restore-drill.sh` 的最后 30 行通过条件、`00-status.sh`、`05-nginx-app.sh`、`14-UAT.md`、`15-UAT.md`、`12-UAT.md`、`13-UAT.md`、`13-REVIEW-DISPOSITION.md` 全文；规划前需要补读这几处
**Pattern 提取日期：** 2026-11-17
