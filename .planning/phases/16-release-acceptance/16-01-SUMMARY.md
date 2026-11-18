---
phase: 16-release-acceptance
plan: 01
subsystem: infra
tags: [deploy, nginx, csp, pocketbase, systemd, restore-drill, server-check, bash, awk, sqlite]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: "13-REVIEW 的 WR-01、WR-03、WR-07、WR-08 四条发现；03、04、06、restore-drill.sh 和 server-check 的 C-01 到 C-23"
provides:
  - "06 分两步 reload 切换 CSP（csp_union 合并新旧哈希，CSP_TRANSITION=done|skipped），任何时刻页面都能在当时的 CSP 下运行"
  - "03 只在迁移、钩子、环境文件要变时要求先停 PocketBase（NEED_STOPPED），装工具文件不停线上服务"
  - "04 覆盖 unit 之前备份成 pocketbase.service.usj-backup.<UTC 时间戳>，失败路径先放回再 disable"
  - "恢复演练：备份超过 40 小时失败、至少比对 1 份文档、按快照边界比对、线上已删除的文档单独计入 DRILL_DOCS_MISSING_LIVE"
  - "server-check 新增 C-24（实际运行 06 的 csp_union）、C-25，扩充 C-07、C-20、C-22；自检从 224 条增加到 274 条"
affects: [16-02, 16-05, 16-08]

actuals:
  tokens: 17155
  tasks: 3
  commits: 3

plan_head_before: ce9fc928e9ceb0c66fe0a1f441236bf4c4450252
plan_head_after: f82b915b6889c4740b9b188192ed682d6a629334

tech-stack:
  added: []
  patterns:
    - "server-check 用 funcBody 取出 shell 函数体，在临时目录里用 bash 实际运行（C-18 的 awk 先例推广到 C-24）"
    - "自检的坏用例一律用“锚点失效就抛错”的包装（g06s、g04s、g03s、gd），改动没生效时不会被当成通过"
    - "恢复演练的核对 Python 用快照时刻 snap（恢复库里最晚的写入时间）做比对边界，不用备份文件的上传完成时间"

key-files:
  created: []
  modified:
    - deploy/server/06-install-site.sh
    - deploy/server/03-configure-pocketbase.sh
    - deploy/server/04-start-pocketbase.sh
    - deploy/server/restore-drill.sh
    - deploy/server-check.mjs
    - deploy/README.md

key-decisions:
  - "WR-01 选 06 两步 reload：先装 csp_union 生成的过渡 CSP 并 reload、sleep 2，再换符号链接，再装最终 CSP 并 reload；上传包文件数不变，sw.js 不动"
  - "csp_union 的 awk 只用 POSIX 写法（split、substr、index），不依赖 gawk 扩展，服务器上的 mawk 也能跑"
  - "restore-drill 的快照边界 snap 取 users 的 created、updated 和 journey_docs 的 updated 里最大的；恢复库为空才退回备份时间"
  - "新增 C-22 条款：rdocs 的每一处拆分都必须是 5 个字段，静态地守住已知问题"

patterns-established:
  - "改一个服务器脚本，就同步改 server-check 的检查函数、好夹具和坏用例，再改 README 对应一节"
  - "本机没有检查会运行的嵌入式 Python，改完之后抽出 heredoc，用合成 sqlite 库和 python -I 实际跑一遍"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "06 换页面时先装过渡 CSP 并 reload，再换符号链接，再装最终 CSP 并 reload（WR-01）；C-20 按行号核对顺序，C-24 在真实 csp_union 上逐字节核对合并结果"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/server-check.mjs（PASS C-20、C-24）；node deploy/server-check.mjs --self-test（SELF-TEST OK (274 cases)）"
        status: pass
    human_judgment: false
  - id: D2
    description: "03 的停服务条件只由迁移、钩子、环境文件决定，工具文件的安装在 is-active 检查之后照常执行（WR-03）"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/server-check.mjs（PASS C-25）"
        status: pass
    human_judgment: false
  - id: D3
    description: "04 覆盖 unit 之前备份，失败路径先放回、daemon-reload 再 disable（WR-08）"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/server-check.mjs（PASS C-07）"
        status: pass
    human_judgment: false
  - id: D4
    description: "恢复演练的 40 小时上限、compared 不小于 1、按快照边界比对、DRILL_DOCS_MISSING_LIVE（WR-07）；核对 Python 在合成 sqlite 库上实际运行通过"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "node deploy/server-check.mjs（PASS C-22）"
        status: pass
      - kind: other
        ref: "本机用 python -I 对合成 sqlite 库运行抽出的核对 Python 和 OK_ALL 判断块（见“偏差”第 1 条），7 组场景加 6 组 AGE_H 全部符合预期"
        status: pass
    human_judgment: false
  - id: D5
    description: "上传包仍是 32 个文件加 SHA256SUMS，服务器文件与仓库逐字节相同"
    requirement: "OPS-04"
    verification:
      - kind: integration
        ref: "tests/e2e/platform/deploy-tools.spec.ts 的两条 OPS-03 用例（check-report 三次都是 REPORT OK expected=2 flaky=0 unexpected=0）"
        status: pass
    human_judgment: false
  - id: D6
    description: "演练改动不写线上库、不停止或重启线上 PocketBase、带真实数据的副本不离开 0700 演练目录，输出只有 DRILL_ 开头的计数和 ok 类键（prohibition，verification: judgment）"
    requirement: "OPS-04"
    verification:
      - kind: unit
        ref: "C-22 的线上库只读、不对 pocketbase 单元做改动、输出键都带 DRILL_ 前缀三条条款继续通过"
        status: pass
    human_judgment: true
    rationale: "C-22 守住了静态形状，但“真实数据副本从不离开演练目录”要在 16-08 的真实演练里由所有者当场确认输出只有 DRILL_ 键"

duration: 15min
completed: 2026-11-17
status: complete
---

# Phase 16 Plan 01: 服务器脚本修复（WR-01、WR-03、WR-07、WR-08）Summary

**06 用 csp_union 合并新旧内联块哈希、两次 reload 夹住符号链接切换；03 装工具文件不再要求停 PocketBase；04 覆盖 unit 前留备份并在失败时放回；恢复演练在备份过旧、零比对、线上文档已删时不再空转通过；server-check 增到 25 项检查和 274 条自检。**

## Performance

- **Duration:** 约 15 分钟（执行开始时没有记录起点，按 `docs(16): start phase execution` 提交的 21:11 到第三个任务提交的 21:25，时区 -08:00）
- **Started:** 2026-11-17T21:11:02-08:00（起点提交时间）
- **Completed:** 2026-11-17T21:25:00-08:00（任务 3 提交时间）
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- **WR-01（06）：** 新增 `csp_union` 函数：把旧 `usj-csp.conf` 里独有的 `'sha256-…'` 源按旧文件顺序并进新策略的 `script-src` 和 `style-src`，`style-src` 有哈希就去掉 `'none'`。06 在已有旧 CSP、应用 include 已挂、新旧 CSP 不同时，先装过渡 CSP、`nginx -t`、reload、`sleep 2`，再 `ln -sfn` 加 `mv -T` 换链接，再装最终 CSP 走原有的 nginx -t 加 reload。全部在 `trap rollback ERR` 区间内，输出多一个 `CSP_TRANSITION=done|skipped`。
- **WR-03（03）：** 停服务变量改名 `NEED_STOPPED`，只由迁移 new、钩子 new、`$ENV_DIR` 或 `$HOOK_DIR` 不存在、环境文件缺失置位；删掉 `ADMIN_STATE`、`DRILL_STATE` 置位的那一行。本阶段装新演练脚本不停线上服务。
- **WR-08（04）：** `UNIT_BAK=""` 在 `fail_and_disable` 之前初始化；覆盖 unit 前 `cp -p` 备份成 `pocketbase.service.usj-backup.<UTC 时间戳>`；失败路径先放回、`daemon-reload`、打印备份名，再 `disable --now`。
- **WR-07（restore-drill）：** 最新自动备份超过 40 小时（或读不出时间）在写演练备份之前 die；`DRILL_DOCS_COMPARED` 小于 1 置 `OK_ALL=no`；线上已删除的文档单独计入新键 `DRILL_DOCS_MISSING_LIVE`；文档按恢复副本的 `updated` 比对（相等才 compared，线上更新算 changed，线上更旧算 mismatch）；用户比对的边界换成恢复库里最晚的写入时间 `snap`。
- **server-check：** 新增 C-24（取出 06 里的 `csp_union`，在 bash 里对五组合成输入运行，结果与 build-site 的 `cspConf(buildCsp(...))` 逐字节比对）和 C-25；扩充 C-07、C-20、C-22；GOOD_03、GOOD_04、GOOD_06、GOOD_DRILL 夹具和坏用例同步；自检 224 条到 274 条。
- **README：** 第 6、8、9、10 节同步（两步 reload 和“部署后立刻跑”、工具文件不停服务、unit 备份和手动回滚、演练的通过条件）。

## Task Commits

1. **Task 1（tracer）：06 的 CSP 原子切换（WR-01）、C-20 扩充、C-24** - `b070095`（fix）
2. **Task 2：03 的 NEED_STOPPED（WR-03）、04 的 unit 备份（WR-08）、C-25、C-07 扩充** - `2603994`（fix）
3. **Task 3：恢复演练的 40 小时、compared 下限、快照边界、MISSING_LIVE（WR-07）、C-22 扩充** - `f82b915`（fix）

**Plan metadata:** 见随后的 `docs(16-01)` 提交。

## Files Created/Modified

- `deploy/server/06-install-site.sh` - `csp_union` 函数、`CSP_TRANS` 分支、过渡 CSP 安装和两次 reload、`CSP_TRANSITION` 输出、头注释
- `deploy/server/03-configure-pocketbase.sh` - `NEED_STOPPED`，新的停服务报错文案，头注释
- `deploy/server/04-start-pocketbase.sh` - `UNIT_BAK`、覆盖前备份、`fail_and_disable` 放回旧 unit，头注释的回滚一段
- `deploy/server/restore-drill.sh` - 40 小时 die、`snap`、`missing_live`、5 列文档查询、`CMP` 判断、输出白名单
- `deploy/server-check.mjs` - c24、c25，扩充的 c07、c20、c22，夹具和 50 条新自检
- `deploy/README.md` - 第 6、8、9、10 节

## 检查结果

- `node deploy/server-check.mjs` 最后一行：`SERVER-CHECK OK (25 checks)`（C-07、C-08、C-20、C-22 到 C-25 都 PASS）
- `node deploy/server-check.mjs --self-test` 最后一行：`SELF-TEST OK (274 cases)`（基线 224）
- 其余四个工具的自检仍然通过：build-site 33、verify-site 54、server-config-check 32、make-acceptance-data 15
- `bash -n` 对 03、04、06、restore-drill.sh 全部通过；`deploy/server/00-status.sh` 没有改
- 两条 OPS-03 用例（`tests/e2e/platform/deploy-tools.spec.ts`）在三个任务各跑一次，`check-report.mjs` 都是 `REPORT OK expected=2 flaky=0 unexpected=0`（上传包仍是 32 个文件加 SHA256SUMS，服务器文件与仓库逐字节相同）
- 每次提交前 `privacy-check.mjs --staged` 都打印“隐私检查通过”

## Decisions Made

- 按 Claude's Discretion 选 06 两步 reload，不改 sw.js、不给上传包加文件（BUNDLE_COUNT 不变）。
- `csp_union` 用 POSIX awk（`index`、`substr`、`split`、`split("", arr)` 清数组），单引号用 `"\047"`，不用 gawk 才有的功能。服务器上默认的 awk 可能是 mawk。
- 04 的备份 `cp -p` 失败时（`set -e`）直接退出，此时还没有改任何东西，不走 `fail_and_disable`。
- C-20 里 `nginx -t` 和 `reload` 都内联写，不抽函数，保持“最后一个 nginx -t 在切换之后”的判断有效。

## Deviations from Plan

### 已知问题的处理（所有者 2026-11-17 批准时记录在 STATE.md，任务 3 里一并处理）

**1. [Rule 1 - Bug] 5 列查询会让 rdocs 的其余拆分报错，并补上本机实际运行的验证**
- **Found during:** Task 3（restore-drill.sh）
- **Issue:** 计划把恢复库的文档查询改成 5 列（加 `updated`），但脚本里另外三处仍按 4 个字段拆分 `rdocs`（原第 324、346、362 行）；本机没有任何检查会运行这段嵌入的 Python，不改会到 16-08 的服务器演练才暴露。
- **Fix:** 三处都改成 5 个字段（`for (_, o, _, _, _) in rdocs`、`for (doc_id, _owner, _kind, data, rupd) in rdocs:`、`for (_id, owner, kind, _data, _upd) in rdocs:`），新加的 `snap` 计算也是 5 个字段。静态上，C-22 新增条款“rdocs 的每一处拆分都必须是 5 个字段”，并加坏用例 `C-22 坏：rdocs 的拆分还是 4 个字段`。
- **Files modified:** `deploy/server/restore-drill.sh`、`deploy/server-check.mjs`
- **Verification:** 下面的本机运行。
- **Committed in:** `f82b915`

**本机运行（额外执行的检查，没有加成永久测试文件）：**

- 做法：用一个放在会话临时目录里的 Python 脚本（不进仓库），按正则从 `restore-drill.sh` 取出三段文本：`VERIFY="$(runuser … python3 -I - <<'PY'` 到 `PY` 之间的核对 Python；其后 `OK_ALL=yes` 到 `if [ "$OK_ALL" != "yes" ]` 之前的 shell 判断块；40 小时判断的三行。把核对 Python 里的两个库路径换成工作目录里的相对 URI（`file:live.db?mode=ro`、`file:rest.db?mode=ro`），每组场景现建两个合成 sqlite 库（恢复副本 `rest.db` 和“线上”`live.db`；`users(id,email,created,updated)`、`journey_docs(id,owner,kind,data,updated)`；用户都是合成的 `test-…@example.com`，真实数据场景用一个不符合 test- 约定的合成账号），用 `python -I` 运行（Python 3.12，命令是 `python`，不是 `python3`），再用 bash 运行抽出的 shell 判断块。全程不碰真实服务器和真实数据，没有 ssh。
- 命令形态：`PYTHONIOENCODING=utf-8 python <临时目录>/drill_harness.py <仓库根目录> <临时工作目录>`，最后一行 `ALL SYNTHETIC CHECKS PASSED`，退出码 0。
- 结果（只摘 DRILL_ 键，“OK_ALL”是 shell 判断块的结论）：

| 场景 | DRILL_MODE | COMPARED | MISMATCH | CHANGED_SINCE | MISSING_LIVE | USERS_MATCH | RESTORED_TEST_ONLY | OK_ALL |
|------|-----------|----------|----------|---------------|--------------|-------------|--------------------|--------|
| A 未改动 2 份、快照之后改过 1 份、线上已删除 1 份、快照之后新增 1 个用户 | test-only | 2 | 0 | 1 | 1 | yes | yes | yes |
| B 同一 updated 但内容不同、线上比恢复副本更旧 | test-only | 3 | 2 | 0 | 0 | yes | yes | no |
| C 快照之后、备份上传完成之前改过 1 份（旧逻辑会误判） | test-only | 3 | 0 | 1 | 0 | yes | yes | yes |
| D 全部文档快照之后都改过，没有可比的 | test-only | 0 | 0 | 4 | 0 | yes | yes | no |
| E 备份之后线上删了一个账号 | test-only | 2 | 0 | 0 | 2 | no | yes | no |
| E2 线上多出一个快照之前创建的用户 | test-only | 4 | 0 | 0 | 0 | no | yes | no |
| F1 恢复库含非测试账号 | test-only | 6 | 0 | 0 | 0 | yes | no | no |
| F2 同样的数据，导入后模式 | real-data | 6 | 0 | 0 | 0 | yes | skipped | yes |
| G 恢复库是空的（snap 退回备份时间，不报错） | test-only | 0 | 0 | 0 | 0 | yes | yes | no |

- 覆盖了要求的场景：未改动文档（A 的 compared 加 sha 一致）、快照之后改过（A、C 的 changed）、线上缺失（A 的 missing_live）、两种 DRILL_MODE（F1 对 F2）。场景 C 是 WR-07 第 3 处的回归：旧逻辑按上传时间会把这份文档当成已比对，因内容不同误报不一致，新逻辑算 changed。
- 40 小时判断：`AGE_H` 为 12、40、-3 通过，41、abc、空串都 `die`（退出 1）。

**2. [Rule 2 - Missing critical] 把“恢复库为空”和 `ts` 的格式差异考虑进快照边界**
- **Found during:** Task 3
- **Issue:** 计划只说恢复库是空的时候退回备份时间；R2 返回的 `modified` 是 `2026-11-17T10:30:00Z`（带 `T`），PocketBase 库里的时间是 `2026-11-17 10:00:00.000Z`（空格），直接比字符串会错位。
- **Fix:** 退路写成 `ts.replace("T", " ")`；场景 G 验证了空库不报错。
- **Files modified:** `deploy/server/restore-drill.sh`
- **Committed in:** `f82b915`

### 其他与计划字面不同的地方（不算偏差，记录以便核对）

- **已有 C-20 坏用例的锚点随夹具更新。** GOOD_06 现在在切换和 `nginx -t` 之间多了一行最终 CSP 的 install，所以 `C-20 坏：切换没有用 mv -T` 的锚点改成接 `sudo -n install`；`C-20 坏：没有 trap - ERR` 的锚点改成接 `echo`（夹具末尾多了 `CSP_TRANSITION` 输出）；`C-20 坏：没有装 CSP 头` 改用 `replaceAll`（现在 CSP_SRC 的 install 在夹具里出现两次）。三条仍然因为原来的原因失败。
- **C-07 的 disable 位置用 `sudo -n systemctl disable --now pocketbase` 匹配，** 不用裸的 `disable --now`，因为 `fail_and_disable` 的错误提示文字里也有这几个字，会让“放回在 disable 之前”的判断永远成立。
- **README 第 9 节多写了一句首次安装失败（没有旧 unit、也就没有备份）时只 disable、删 unit 再 daemon-reload，** 与 04 头注释的回滚一段一致。
- **自检条数：** 计划要求大于 224，实际 274。

---

**Total deviations:** 2 auto-fixed（1 个 Rule 1，1 个 Rule 2），加 1 项额外执行的本机检查
**Impact on plan:** 都是任务 3 自己的改动会引入的缺口，没有扩大范围；没有新增文件，没有碰 `00-status.sh`、`us-journey-tracker.html`、`APP_SHA256`。

## Issues Encountered

- 第一次用 Python 脚本批量改 JS 时，反斜杠转义出错导致锚点不匹配（脚本在写盘前就抛错，没有留下半改的文件）。改成先把改动脚本写进文件再运行后解决。
- 第一次写 06 时 awk 里的 `"\047"` 被错误地展开成单引号，`bash -n` 立刻报错；直接修正后通过，并由 C-24 在真实函数上证明输出正确。

## Recommendation（需要所有者或后续计划决定）

- **本机运行验证用的脚本没有进仓库。** 嵌入在 `restore-drill.sh` 里的核对 Python 目前只有这次手工验证和 16-08 的服务器演练会运行它。如果希望以后改这段 Python 时也有回归保护，建议新增一个仓库内的小工具（例如 `deploy/` 下的 `drill-verify-check.mjs` 或放进 server-check 的自检，用 `python -I` 和合成 sqlite 库跑上面的 9 组场景，找不到 Python 时跳过）。这不在本计划的 `files_modified` 里，所以没有加。
- **README 第 10 节的提醒：** 导入后演练要用删完测试账号之后的那次自动备份，否则 `DRILL_USERS_MATCH` 会是 no（场景 E 就是这种情况）。这条已经写进 README，16-ACCEPTANCE 的编排需要对应。

## Next Phase Readiness

- 16-05 发布时：03 只装工具文件且不停 PocketBase，06 换页面和 CSP 没有窗口（输出 `CSP_TRANSITION=done`；如果线上 `usj-csp.conf` 不是 build-site 的两行格式，06 会 `fail` 回滚、什么都不切换，16-05 要停下报告），新演练脚本带 WR-07 的通过条件。
- 16-08 的服务器演练：输出多一个 `DRILL_DOCS_MISSING_LIVE`；`DRILL_DOCS_COMPARED` 必须大于等于 1，所以备份之后文档不能全被改过。

## Known Stubs

None。

## Threat Flags

None：没有新增网络端点、认证路径或信任边界上的文件访问；`csp_union` 只读上传目录和 `/etc/nginx/snippets/usj-csp.conf` 的本地备份副本，结果写进 06 自己的 0700 临时目录。

## Self-Check: PASSED

- 6 个改动的文件都存在；`b070095`、`2603994`、`f82b915` 都是 HEAD 的祖先；`00-status.sh` 无改动。
- `commits: 3` 来自 `git rev-list --count ce9fc92..HEAD`（账本文件里记录的起点），不是叙述出来的。
