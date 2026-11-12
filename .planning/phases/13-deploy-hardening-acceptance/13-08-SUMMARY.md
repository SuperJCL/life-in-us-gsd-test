---
phase: 13-deploy-hardening-acceptance
plan: 08
subsystem: deploy-tooling
tags: [upload-bundle, verify-site, runbook, acceptance-checklist, synthetic-data, sec-02, ops-01, ops-03, ops-04]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-04 的构建输出（site/、usj-csp.conf、BUILD_VERSION、SHA256SUMS）；13-05 的迁移、钩子和实测的钥匙轮换步骤；13-06、13-07 的 deploy/server/ 全部模板和输出键
  - phase: 6-procurement-reachability-probe
    provides: tools/probe/verify-site.mjs 的骨架（parseServerEnv、SSE 解析、PASS/FAIL 行、退出码）和批准清单的上传做法
provides:
  - deploy/build-site.mjs：完整上传包（32 个文件加 SHA256SUMS），固定来源清单 BUNDLE_SOURCES，缺任何一个就失败
  - deploy/verify-site.mjs：--check-bundle（BD-01..BD-09）、--stage baseline|full（B-01..B-03、F-01..F-16）、--self-test（54 条）
  - tests/e2e/platform/deploy-tools.spec.ts：2 条 OPS-03 默认套件用例
  - deploy/README.md：部署、批准与上传、升级、回滚、备份与恢复、锁死恢复、风险、钥匙轮换的中文运行手册
  - deploy/make-acceptance-data.mjs：约 3.3 MB 的合成完整备份生成器（--self-test 15 条）
  - 13-ACCEPTANCE.md：A0 到 K 共 12 节、49 项的总体验收清单
affects: [13-09, 13-10, 13-11 构建上传包并运行 verify-site, 13-12, 13-13, 13-14, 13-15 总体验收]

actuals:
  tokens: 25800
  tasks: 3
  commits: 3
plan_head_before: 473458428ee359d77120fc8987eaca8e50a6cb19
plan_head_after: cba0d6c1fc6b142137d94fc355b431e25c80c5f6

tech-stack:
  added: []
  patterns:
    - "上传包由固定来源清单（BUNDLE_SOURCES）驱动，纯函数 buildSite 只在 extras 给了时才要求齐全，所以旧的 12 文件自检不变"
    - "verify-site 的 checkBundle 是纯函数（文件表加仓库读取函数加钉死哈希），自检用 buildSite 合成整个包再逐项改坏，证明每一项都不是空转通过"
    - "线上检查全部用 node:https 直接请求（不跟随跳转、不解压），响应头和 content-encoding 保持原样；输出只含编号、中文说明和 errTag"
    - "生成器通过 migrate-backup 导出的 evalApp 在应用纯函数段里组装备份，用 normalize、backupOf、classifyBackup，格式与应用一致"

key-files:
  created:
    - deploy/verify-site.mjs
    - deploy/README.md
    - deploy/make-acceptance-data.mjs
    - tests/e2e/platform/deploy-tools.spec.ts
    - .planning/phases/13-deploy-hardening-acceptance/13-ACCEPTANCE.md
  modified:
    - deploy/build-site.mjs
    - tests/README.md
    - PRIVACY.md
    - tools/probe/README.md

key-decisions:
  - "上传包的 21 个原样复制的来源写成字面量清单，生成的 11 个文件加 21 个共 32；验证脚本的 EXPECTED_PATHS 由同一份清单推出，两边不会漂移"
  - "验收大文件写成紧凑 JSON（不缩进）：缩进写法会超过导入的 5 MB 文件上限，而云端文档本来就按紧凑 JSON 的字节数算大小；约 3.3 MB 超过 4 MiB 的 70% 线，会出现容量提醒"
  - "F-14（www 跳转）解析不到 www 或证书不含 www 时记 PASS 并写“不适用”，能握手却不跳转才是 FAIL，与 05 的 WWW_REDIRECT=skipped 对应"
  - "--stage 阶段不在本计划运行：private/server.env 在本机存在，按项目规则不读不用，线上阶段只在 13-11 起的批准步骤里运行"

requirements-completed: [OPS-03, SEC-02, OPS-01, OPS-04]

coverage:
  - id: D1
    description: "完整上传包：站点 9、server/ 17、pb_migrations/ 4、pb_hooks/ 1、BUILD_VERSION 共 32 个文件加覆盖它们的 SHA256SUMS；缺来源文件就失败；00-status.sh 不进包"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "node deploy/build-site.mjs --out test-results/13-08-bundle（SHA256SUMS 32 行，sha256sum -c --strict 通过，server/00-status.sh 不存在）；node deploy/build-site.mjs --self-test（SELF-TEST OK (28 cases)，含缺任一来源文件抛错）"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-site --check-bundle 离线核对上传包 9 项（校验和、固定清单、与仓库逐字节相同、CSP 哈希与内联块一一对应、无 unsafe-、sw.js 版本、云端开关和 noindex、SDK 钉死值、无公网 IP 和外部邮箱）"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "node deploy/verify-site.mjs --check-bundle test-results/13-08-bundle（BUNDLE OK (9 checks)）；node deploy/verify-site.mjs --self-test（SELF-TEST OK (54 cases)，每项 BD 都有改坏的反例）"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/deploy-tools.spec.ts#OPS-03 a fresh build is a complete upload bundle whose CSP matches its page and whose server files match the repository"
        status: pass
    human_judgment: false
  - id: D3
    description: "verify-site 的线上阶段（baseline 3 项、full 19 项）已写好，只在本地桩上验证了请求和 SSE 解析函数；没有对真实站点运行"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "node deploy/verify-site.mjs --self-test（响应头、CSP 比对、gzip、PB_CONNECT、CORS、www 跳转、限流判定的纯函数）；一次性本机桩（127.0.0.1）验证 request 和 sseConnect"
        status: pass
    human_judgment: true
    rationale: "线上 19 项要在 13-11 起对真实站点运行（--stage full 会连发 6 次失败的后台登录，只在批准的步骤里运行）"
  - id: D4
    description: "deploy/README.md 写清用途与边界、隐私、批准与上传、首次部署顺序、所有者操作、升级、回滚、备份与恢复、锁死恢复、风险、钥匙轮换、不做的事；不含域名、IP、邮箱、钥匙"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "Task 2 的 19 个关键词 grep 全部命中；隐私检查通过（staged，1 个文件）"
        status: pass
    human_judgment: true
    rationale: "手册是否清楚、可照做，要在 13-09 起所有者真正按它操作时判断"
  - id: D5
    description: "13-ACCEPTANCE.md 总体验收清单 A0–K（D-12、D-13）和 make-acceptance-data.mjs 生成的约 3.3 MB 合成大备份"
    requirement: OPS-01
    verification:
      - kind: other
        ref: "Task 3 的清单关键词 grep 全部命中；node deploy/make-acceptance-data.mjs --self-test（SELF-TEST OK (15 cases)）；--out test-results/13-08-acc 写出 3307552 字节、12058 条记录"
        status: pass
    human_judgment: true
    rationale: "清单本身的逐项结论由所有者在 13-15 总体验收时填写"
  - id: D6
    description: "完整的默认套件仍然全绿，条数从 195 变成 197"
    requirement: OPS-03
    verification:
      - kind: e2e
        ref: "npm test（PW_JSON_REPORT 报告，check-report --min-expected 197）：REPORT OK expected=197 flaky=0 unexpected=0"
        status: pass
    human_judgment: false

duration: 18min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 08: 上传包、站点检查脚本、运行手册与总体验收清单 Summary

**build-site 现在产出完整的 32 文件上传包，verify-site 在本机离线用 9 项核对它（服务器文件与仓库逐字节相同、CSP 哈希与页面内联块一一对应），并带着写好但还没对真实站点运行过的线上 19 项；再加中文运行手册、49 项的总体验收清单和约 3.3 MB 的合成大备份生成器。默认套件 197 条全绿。全程没有连服务器。**

## Performance

- **Duration:** 18 min（按提交时间，约 12:35 到 12:53）
- **Tasks:** 3（1 个 tracer，2 个 auto）
- **Files:** 9（5 个新增，4 个修改）

## Accomplishments

### 上传包的文件清单（32 个加 SHA256SUMS）

| 位置 | 个数 | 内容 |
|------|------|------|
| `site/` | 9 | `index.html`、`sw.js`、`manifest.webmanifest`、4 个图标、`vendor/pocketbase.iife.js`、`vendor/SHA256SUMS` |
| `server/` | 17 | 脚本和 unit 10 个（01 到 07、`pb-admin.sh`、`restore-drill.sh`、`pocketbase.service`）、nginx 6 个（`anchor-block.awk`、`usj-app.conf`、两个头文件、`usj-log-format.conf`、生成的 `usj-csp.conf`）、`logrotate/usj-nginx` 1 个 |
| `pb_migrations/` | 4 | `pb/pb_migrations/` 的 2 个加 `deploy/pb_migrations/` 的 2 个 |
| `pb_hooks/` | 1 | `backup-watch.pb.js` |
| 根 | 1 | `BUILD_VERSION` |

`00-status.sh` 不进包。构建输出 `BUILD OK a1159ad93165 (33 files)`（32 个加 SHA256SUMS）；`sha256sum -c --strict` 通过。

### verify-site 的检查编号表

| 编号 | 检查 |
|------|------|
| BD-01 | 校验和全部通过，恰好 32 行 |
| BD-02 | 固定清单的文件都在，没有多余的文件 |
| BD-03 | 服务器文件和迁移与仓库逐字节相同 |
| BD-04 | CSP 的脚本和样式哈希与页面内联块一一对应（用 build-site 导出的 `inlineBlocks`、`cspHash`） |
| BD-05 | 策略含 `style-src-attr`、`frame-ancestors`、`default-src` 的 `'none'`，没有 `unsafe-` |
| BD-06 | `sw.js` 带着 BUILD_VERSION，不含占位 |
| BD-07 | 页面恰好一处云端开关脚本和一处 robots noindex |
| BD-08 | SDK 等于钉死的 sha256 |
| BD-09 | 文本文件里没有 127.0.0.1 和文档地址段以外的 IPv4，没有 `@example.com` 以外的邮箱 |
| B-01..B-03 | HTTPS 可达、http 跳到 https、8090 外网不通（`--stage baseline` 只做这三项） |
| F-01 | `/` 200 且响应头齐全（CSP、nosniff、Referrer-Policy、Permissions-Policy、HSTS 一天、noindex、DENY、no-cache） |
| F-02 | 线上 CSP 哈希与线上页面内联块一一对应，恰好一处云端开关 |
| F-03 | 线上策略含 `style-src-attr 'none'`、`frame-ancestors 'none'`，没有 `unsafe-` |
| F-04 | `/sw.js` 类型、no-cache、最小 CSP、12 位版本号（本机有构建版本号时相等） |
| F-05 | 清单类型 `application/manifest+json`，name 是「计划手记」 |
| F-06 | 4 个图标 200 且 `image/png` |
| F-07 | SDK 的 sha256 等于钉死值 |
| F-08 | `/probe/`、`/probe/config.js`、`/index.nginx-debian.html`、`/no-such-path` 都是 404（D-10） |
| F-09 | `/api/health` 200 且带 X-Robots-Tag |
| F-10 | `/_/` 200，带 PocketBase 自己的 CSP（含 frame-ancestors），不是页面的 CSP |
| F-11 | 匿名注册被拒，匿名读 `journey_docs` 拿不到记录 |
| F-12 | `/api/realtime` 是 `text/event-stream`，10 秒内收到带 clientId 的 PB_CONNECT |
| F-13 | 别的源不被放行，本站源得到同值 |
| F-14 | www 跳转到裸域名（www 能解析且证书覆盖时；否则记 PASS 并写“不适用”） |
| F-15 | 页面 gzip |
| F-16 | 后台登录连发 6 次，前 5 次不是 429，第 6 次 429（最后跑，本机 IP 的后台登录等 60 秒） |

`--check-bundle` 最后一行 `BUNDLE OK (9 checks)`；`--stage baseline` 最后一行 `VERIFY OK (3 checks)`；`--stage full` 最后一行 `VERIFY OK (19 checks)`。

### 默认套件

`npx --no playwright test --list`：197 条（195 加 deploy-tools 两条）。完整 `npm test`（低优先级、1 个 worker）：`REPORT OK expected=197 flaky=0 unexpected=0`，含两条 deploy-tools 用例（新标题）和 `SAFE-02 us-journey-tracker.html matches the recorded sha256 baseline`。

### 验收清单的节和条目数

A0（6）、A（3）、B（4）、C（4）、D（4）、E（4）、F（4）、G（5，对应 12-UAT.md 推迟的 5 项）、H（3）、I（4）、J（5）、K（3），共 12 节、49 项；每节一张表（编号、操作、期望、结论、备注），每节末尾一行“结论：”。

### README

15 节：用途与边界、隐私约定、文件清单、本机准备、批准与上传（含修订 1 的“每一批执行前再确认一次”）、首次部署顺序（06 在 05 之前）、所有者的操作、升级、回滚、备份与恢复（含恢复演练的守卫和 18:40–19:20 UTC 时间窗）、两步验证锁死的恢复、风险、钥匙轮换（13-05 实测步骤，含轮换会丢后台设置的后果）、不做的事、和验收的关系。

## Task Commits

1. **Task 1（tracer）：完整上传包、verify-site、deploy-tools.spec.ts** - `e6a0156`（feat）
2. **Task 2：deploy/README.md** - `81a8260`（docs）
3. **Task 3：验收清单、合成大备份生成器、测试和隐私说明、探针退役注记** - `cba0d6c`（feat）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## Deviations from Plan

None - plan executed exactly as written.

补充说明（不是偏差）：

- `deploy/verify-site.mjs` 在写入后被项目的格式化工具重排成约 900 行（内容没变）；自检、`--check-bundle` 和默认套件都是在重排后的文件上通过的。
- 计划验收项“不带 `private/server.env` 运行 `--stage full` 时退出码 2”：本机存在这个文件，按计划写的条件（有就跳过，不读内容）和项目规则跳过了。退出码 2 的代码路径（缺文件或缺键）和用法错误（无参数）已核对：无参数运行退出 2。
- BD-09 对 SDK 压缩文件也做了扫描，真实包上没有误报；没有给 SDK 开例外。

## Issues Encountered

- 第一次用 here-document 往 `build-site.mjs` 打补丁时 shell 引号出错，没有写入任何内容（`git status` 确认文件未改），之后改用编辑工具。
- 测试结束后没有遗留 `pocketbase.exe`、`find.exe` 或带 `remote-debugging-pipe` 的 `msedge.exe`（后者计数为 0；剩下的 Edge 进程是所有者自己的）。

## Known Stubs

无。

## Threat Flags

无新增攻击面：本计划新增的是只在所有者本机运行的构建和检查脚本，以及公开的文档。T-13-24（README、验收清单只写占位，暂存后隐私检查通过）、T-13-25（verify-site 的说明里没有 URL、主机名、IP；异常只给类名或 code；运行时经 redact.mjs）、T-13-26（BD-03 逐字节、BD-01 校验和、BD-09 拦公网 IP 和外部邮箱，各有改坏的反例）都有本机证据；T-13-SC 本计划没有安装或下载任何东西。

## User Setup Required

None - 本计划没有任何外部服务配置。

## Next Phase Readiness

- 13-09 起：按 README 第 5 节构建（`node deploy/build-site.mjs`）、`--check-bundle` 通过后把 `private/deploy-out/SHA256SUMS` 交给所有者批准；上传和每条改服务器的命令执行前都要再贴一次、所有者再确认一次。
- 13-11：对真实站点运行 `--stage baseline`，部署完成后 `--stage full 2>&1 | node tools/privacy/redact.mjs`，要看到 `VERIFY OK (19 checks)`；两次 full 之间至少间隔 60 秒；05 输出 `WWW_REDIRECT=skipped` 时，F-14 应显示“不适用”。
- 13-13：恢复演练必须在导入真实数据之前做（守卫会拒绝非测试账号的库）。
- 13-15：F 项的大文件由所有者运行 `node deploy/make-acceptance-data.mjs --out private/acceptance` 生成（或让 Claude 生成，写在被忽略的 `private/acceptance/`）；G 项的三条 backstop 需要大量合成数据，必要时让 Claude 准备。
- 线上检查的真实网络行为（`node:https` 的头处理、F-12 的 SSE、F-14 的 DNS 和 TLS 判断、F-16 的限流次数）只在本机桩上验证过请求和 SSE 解析；第一次对真实站点运行时才是真正的验证，失败时先看是检查写法还是站点配置的问题。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/verify-site.mjs、deploy/README.md、deploy/make-acceptance-data.mjs、tests/e2e/platform/deploy-tools.spec.ts、.planning/phases/13-deploy-hardening-acceptance/13-ACCEPTANCE.md、deploy/build-site.mjs（已修改）
- FOUND: commits e6a0156、81a8260、cba0d6c（都在 HEAD 的祖先里）；`git rev-list --count` 实测 3
- 三个任务的验收命令全部通过；`--check-bundle` 最后一行 `BUNDLE OK (9 checks)`；两个自检脚本 `SELF-TEST OK`；默认套件 `REPORT OK expected=197`；每次暂存后隐私检查通过
