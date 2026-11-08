---
phase: 06-procurement-reachability-probe
plan: 08
subsystem: infra
tags: [ssh, pocketbase, swap, sha256-approval, superuser, d-03, d-04, d-05, d-14, d-16, d-17, privacy]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-06 的批次 A 批准清单（5 个文件的 sha256）和 00-status.sh
  - phase: 06-procurement-reachability-probe
    provides: 06-07 的批次 B 文件（04/05/06 脚本、unit、nginx 片段、anchor-block.awk、探针页）和 verify-site.mjs
provides:
  - "服务器上已有 1 GB swap、PocketBase 0.41.1（双重哈希核对通过）、数据目录、2 个探针迁移、config.js、pocketbase 系统用户；服务未启动，8090 空闲"
  - "所有者在网页终端自己建好的超级用户（个数 1，邮箱和口令不经 Claude、不记录）"
  - "本机被忽略的 private/pocketbase/ 下的核对过的 zip 副本"
  - "## 批次 B 批准清单（approve-all，10 个文件的 sha256）：06-09 上传、核对和执行的唯一依据"
affects: [06-09, 06-10]

actuals:
  tokens: 6000
  tasks: 3
  commits: 0
plan_head_before: e0905f95e6f014195e17a7596acc75264ec06566
plan_head_after: e0905f95e6f014195e17a7596acc75264ec06566

tech-stack:
  added: []
  patterns:
    - "批次执行：本机 sha256sum -c → 只打包清单文件上传 → 服务器 sha256sum -c 加文件数比对 → 每个脚本在同一条 ssh 里先核对自己那一行再执行 → 删除上传目录"
    - "口令只在人手里：超级用户由所有者在网页终端用 read -rs 包装的命令创建，Claude 只读个数"

key-files:
  created: []
  modified: []

key-decisions:
  - "批次 A 已按批准清单执行；SWAP、PB_INSTALL、PB_CONFIGURE 全部成功，没有任何哈希不符"
  - "所有者对批次 B 选择 approve-all（回复“全部批准”）：10 个文件按下面的 sha256 全部批准，执行放在 06-09"
  - "04 脚本健康检查失败时只停止、不禁用服务：为保住已批准的 sha256 不改文件，所有者已接受"

patterns-established:
  - "先批准、再上传、再执行：批准文本逐个列出文件名和 sha256，上传只打包清单里的文件"

# INFRA-01 要求网址能经 HTTPS 打开；本计划只装好 PocketBase 和建了超级用户，批次 B 在 06-09 才执行，所以这里不标完成
requirements-completed: []

coverage:
  - id: D1
    description: "批次 A 在服务器上按批准清单执行（swap、PocketBase 0.41.1、迁移和 config.js），只读状态确认，服务未启动"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "ssh -o BatchMode=yes usj 'bash -s' < tools/probe/server/00-status.sh | node tools/privacy/redact.mjs（SWAPFILE_ACTIVE=yes、PB_USER=present、PB_BINARY_VERSION=0.41.1、PB_MIGRATIONS=2、PROBE_CONFIG_JS=present、PB_SERVICE_ACTIVE=absent、PORT_8090=free、STATUS_DONE=1）"
        status: pass
    human_judgment: false
  - id: D2
    description: "核对过的 zip 副本取回本机，sha256 等于钉死值，被 git 忽略"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "sha256sum private/pocketbase/pocketbase_0.41.1_linux_amd64.zip；git check-ignore；git status --porcelain -- private 无输出"
        status: pass
    human_judgment: false
  - id: D3
    description: "所有者自己创建超级用户，之后只读状态 DB_SUPERUSERS_COUNT=1"
    requirement: INFRA-01
    verification:
      - kind: manual_procedural
        ref: "阿里云网页终端 superuser upsert；随后 00-status.sh 的 DB_SUPERUSERS_COUNT=1"
        status: pass
    human_judgment: true
    rationale: "创建动作和口令只在所有者手里，Claude 只能核对个数，无法也不应核对邮箱和口令"
  - id: D4
    description: "所有者对批次 B 的批准（approve-all）及 10 个文件的 sha256 批准清单"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "cd tools/probe && sha256sum -c --strict（10 个文件全部 OK）；git diff --quiet HEAD -- tools/probe"
        status: pass
    human_judgment: false
  - id: D5
    description: "两个 JS 探针迁移在真实 0.41.1 上首次 serve 时能被应用，健康检查 30 秒内通过"
    requirement: INFRA-01
    verification: []
    human_judgment: true
    rationale: "迁移尚未应用（superuser upsert 只跑了系统迁移）；第一次真正应用是 06-09 里 04 脚本的首次 serve，只能到那时由 00-status 和 verify-site full 判定"

duration: 多段执行（含所有者操作的等待）
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 08: 批次 A 执行、超级用户与批次 B 批准 Summary

**按批准清单在服务器上执行批次 A（1 GB swap、PocketBase 0.41.1 双重哈希核对安装、2 个探针迁移、config.js），zip 副本取回本机并核对；所有者自己建好超级用户（个数 1）；批次 B 的 10 个文件经所有者 approve-all 批准，清单记在下面，服务未启动，批次 B 留给 06-09 执行。**

## Performance

- **Completed:** 2026-11-08T07:11Z 前后
- **Tasks:** 3（Task 1 tracer、Task 2 所有者操作、Task 3 所有者批准）
- **Files modified:** 0（仓库没有源文件改动；服务器和本机被忽略目录有改动，见下）

## Accomplishments

- tracer：批次 A 的 3 个脚本依次成功执行，每一步都先核对哈希；服务器上没有留下上传目录，也没有批次 B 的任何产物。
- PocketBase 0.41.1 已装好（钉死 sha256 和 checksums.txt 两项核对都是 yes），尚未启动；nginx、certbot、PM2 没动。
- 超级用户由所有者在阿里云网页终端创建（D-05），邮箱和口令没有经过 Claude，也没有记录在任何地方。
- 批次 B 的 10 个文件获得批准，清单已记录；本继续运行开头已重新核对 10 个 sha256 全部 OK，`tools/probe` 与 HEAD 一致。

## Task 1 记录（已脱敏，原样）

### sha256 核对

- 本机上传前 `sha256sum -c --strict` 5/5 OK（上传前紧接着又核对了一次）。
- 上传：`tar -C tools/probe -cf - <批准清单里的 5 个路径>`，只打包清单里的文件。
- 服务器上传后 `sha256sum -c --strict --quiet -` OK，文件数 5。
- 每个脚本在同一条 ssh 里先核对自己那一行再执行，三个都 OK。

### 脚本输出（过滤后）

01-swap.sh（退出码 0）：

```text
SWAP=created
SWAP_TOTAL_MB=1023
```

02-install-pocketbase.sh（退出码 0）：

```text
PB_SHA256_PINNED_MATCH=yes
PB_SHA256_CHECKSUMS_MATCH=yes
PB_INSTALL=done
PB_BINARY_VERSION=0.41.1
```

03-configure-pocketbase.sh（退出码 0）：

```text
PB_MIGRATIONS=2
PROBE_CONFIG_JS=present
PB_CONFIGURE=done
```

上传目录已删除；服务器上没有批次 B 的产物；PocketBase 没有启动；nginx、certbot、PM2 没动。

### Task 1 之后的 00-status 输出（过滤后，原样）

```text
SUDO_NOPASSWD=yes
OS=Ubuntu 24.04.5 LTS
ARCH=x86_64
MEM_TOTAL_MB=894
MEM_AVAILABLE_MB=470
SWAP_TOTAL_MB=1023
SWAPFILE_ACTIVE=yes
DISK_ROOT_AVAIL_GB=24
NTP_SYNC=yes
NGINX_ACTIVE=active
CERTBOT_TIMER=active
NGINX_TEST=ok
NGINX_SITE=default
NGINX_ANCHOR_COUNT=1
NGINX_PROBE_INCLUDE=absent
PORT_8090=free
PB_USER=present
PB_BINARY_VERSION=0.41.1
PB_MIGRATIONS=2
PROBE_CONFIG_JS=present
PROBE_PAGE_FILES=1
PB_SERVICE_ACTIVE=absent
PB_SERVICE_ENABLED=absent
PB_HEALTH=n/a
PB_MEMORY_CURRENT_MB=n/a
PB_RSS_MB=n/a
DB=absent
STATUS_DONE=1
```

### zip 副本

- 本机 `private/pocketbase/pocketbase_0.41.1_linux_amd64.zip`：sha256 = `7504ec99a85fe405fc9941b4d94bdea20733b53707c8251b66fd0daa1444347e`，等于钉死值；被 git 忽略；`git status --porcelain -- private` 无输出。

## Task 2 记录

所有者在阿里云网页终端用 `read -rs` 包装的命令建了超级用户（D-05）。邮箱和口令没有经过 Claude，也没有记录在任何文件里。之后只读 00-status（已脱敏）：

```text
DB_SUPERUSERS_COUNT=1
DB_USERS_COUNT=0
DB_COLLECTIONS_PROBE=no
DB_USERS_RULES_LOCKED=no
DB_SETTINGS_*=n/a
PB_SERVICE_ACTIVE=absent
PB_SERVICE_ENABLED=absent
PORT_8090=free
NGINX_TEST=ok
NGINX_PROBE_INCLUDE=absent
NGINX_ANCHOR_COUNT=1
MEM_AVAILABLE_MB=438
SWAPFILE_ACTIVE=yes
STATUS_DONE=1
```

超级用户：已建（个数 1）。

### 迁移时机的发现

两个 JS 探针迁移此时还没有应用（`DB_COLLECTIONS_PROBE=no`、`DB_USERS_RULES_LOCKED=no`）：`superuser upsert` 只跑了系统迁移。它们会在 04-start-pocketbase.sh 里第一次 `serve` 启动时应用。这不冲突：

- 04 的前置检查只需要二进制、data.db 和 `_superusers` 至少 1 个。
- 05、06 和 verify-site 对启动前状态没有假设。
- 06-09 的验收清单检查的是启动之后的状态。
- 两个迁移只依赖系统自带的 `users` 集合，它已经存在。

仍然是假设的部分：首次 `serve` 会应用 JS 迁移，且 30 秒内健康检查通过。06-09 里用 00-status 和 verify-site full 确认。

## 批次 B 批准清单

所有者选择：**approve-all（三个脚本全部批准）**，回复原话“全部批准”。批准日期：2026-11-08（UTC；本地时间 2026-11-07）。

批准只覆盖下面 10 个文件、这些 sha256（`sha256sum` 格式，两个空格，路径相对 `tools/probe`）。清单之外的文件（批次 A 的文件、00-status.sh、config.example.js、vendor 的 LICENSE.md 和 README.md）都不在批准范围内，不上传；本机没有 config.js，凭据也不会上传。批准前执行者已重新核对：10 个文件全部 OK，`tools/probe` 与 HEAD 一致。本继续运行开头又核对了一次：`cd tools/probe && sha256sum -c --strict` 十个全部 OK，`git diff --quiet HEAD -- tools/probe` 成立。

```text
e9974aedb785b206a1238352bcfa4a1d7313e9c34448982bd9bb4fc269155c8a  server/04-start-pocketbase.sh
e665e58eb657c3eb3168f28d29127b470664aba873bdfd4f77c45784076bf6b7  server/05-nginx-probe.sh
8a1d8295fd39932dcbbb1f76d02911310db834f69d37206d81fe61c389a82705  server/06-install-probe-page.sh
fb60e1755ff13f118c3b257e29c29829d271816b3c18c21079612d35f1c5f172  server/pocketbase.service
dee8b5458804313034d8b7cc4e8301e55f49494feeea5a04ae733fc57ebabeef  server/nginx/usj-probe-locations.conf
87d929b5a1adabe0dc10b7eb3fbd13feb085f83951a965156716946c7b9e8928  server/nginx/anchor-block.awk
1260efc4c7f7d059f5c92692f16d9b8d174c8cfbf3582f782c555d676221cb9f  page/index.html
b71a8063f36463e8c5e025c55901c742c541991d0814f7d7477c0b6e6f44aebe  page/probe.js
94c1e032b783952f6989ff74256ec97440d0ecf0c24edb9575f8c8716cb04a9f  page/vendor/pocketbase.iife.js
b799f1c9c9fb20e77f9ffe693a05ed17cbf2123dc6315bdeb8f9106dc363311a  page/vendor/SHA256SUMS
```

### 执行顺序和服务器上的改动（向所有者说明过）

执行顺序 04 → 05 → 06：

- 04：确认已有超级用户后安装 systemd 服务并启动；PocketBase 只听 127.0.0.1:8090，以 pocketbase 用户运行，内存上限 400M（D-03、D-14）。
- 05（D-02）：确认 certbot 锚点恰好 1 行并在 `listen 443 ssl` 的 server 块里，才加一行 include，挂上实时连接、`/api/`、`/_/`、`/probe/` 四个位置；先备份；`nginx -t` 或 `certbot renew --dry-run` 失败就自动恢复备份。
- 06：核对 SDK 哈希后把探针页装到 `/var/www/usj/probe/`，最后删除上传目录。

### 给 06-09 的说明

- 上传前在本机、上传后在服务器上各用这份清单核对一次，并确认上传目录里的文件数等于 10；每个脚本执行前，在同一条 ssh 里再核对它自己的那一行。任何一项不一致就停下，重新请批准。
- 上传命令只打包清单里的 10 个路径：`tar -C tools/probe -cf - <10 个路径> | ssh -o BatchMode=yes usj 'rm -rf /tmp/usj-probe-upload && mkdir -m 700 /tmp/usj-probe-upload && tar -xf - -C /tmp/usj-probe-upload'`。
- 本机 Git Bash 的 `sha256sum` 输出是 `<hash> *<file>`（星号），而上面的清单用两个空格。**解析这份清单的步骤要同时接受两种分隔**（`  ` 和 ` *`，例如匹配 `[ *]`）。不改被批准的文件内容，也不改批准流程。
- `tools/probe/page/vendor/SHA256SUMS` 里的路径相对 `page/vendor/`，要核对它必须先进入那个目录。
- 回滚：`systemctl disable --now pocketbase` 并删除 unit；用 `/etc/nginx/usj-backup/` 里的备份恢复站点文件、删除片段、reload；删除 `/var/www/usj/probe/` 下的页面文件。

### 所有者已知晓并接受的四点

1. `/_/`（管理后台）按 D-13 对公网开放，强口令是主要防线。
2. `config.js` 含合成探针账号，按设计可被公开下载；它不是真实账号，里面只有合成数据。
3. 05 的 `certbot renew --dry-run` 用 Let's Encrypt 的 staging 环境，不会替换现有证书。
4. 04 的健康检查失败时会停止脚本但不禁用服务；为保住已批准的 sha256 不改文件，这一点按现状接受。

## Task Commits

本计划不改被跟踪的源文件，所以没有任务提交（`files_modified: []`，`commits: 0` 是实测值）。

1. **Task 1: tracer——执行批次 A、只读确认、取回 zip** - 无提交（服务器和本机被忽略目录的改动）
2. **Task 2: 所有者建超级用户（checkpoint:human-action）** - 无提交
3. **Task 3: 所有者批准批次 B（checkpoint:decision, blocking-human）** - 无代码提交，批准记录在本文件

**Plan metadata:** 见随后的 docs 提交（SUMMARY、STATE、ROADMAP）

## Files Created/Modified

仓库内：无（只有本 SUMMARY）。

仓库外：

- 服务器：`/swapfile`、`/etc/fstab`（已备份）、`/opt/pocketbase/`、`/var/lib/pocketbase/`、`/var/www/usj/probe/config.js`、`pocketbase` 系统用户。
- 本机仅本地：`private/pocketbase/pocketbase_0.41.1_linux_amd64.zip`（被 git 忽略）。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 本机 Git Bash 的 `sha256sum --text -c` 报错，改用普通 `sha256sum -c`**

- **Found during:** Task 1（上传前的本机核对）
- **Issue:** `sha256sum --text -c` 报 “meaningless when verifying”，无法用来核对清单。
- **Fix:** 改用普通 `sha256sum -c --strict` 配两个空格的清单；哈希和路径的核对效果相同。
- **Files modified:** 无
- **Verification:** 5/5 OK、10/10 OK

---

**Total deviations:** 1 auto-fixed（1 blocking）
**Impact on plan:** 只是核对命令的写法，批准流程、被批准的文件和核对强度都没有变。

## Issues Encountered

无其他问题。批次 A 三个脚本全部一次通过，没有 HASH MISMATCH。

## Known Stubs

无。

## Threat Flags

无新增：本计划涉及的信任边界（批准的脚本与实际执行的脚本、所有者到网页终端到 PocketBase 的口令通道、服务器输出到 SUMMARY）都在计划的威胁登记里（T-06-22、T-06-23、T-06-24、T-06-SC）。

## User Setup Required

无新增。批次 B 已批准，由 06-09 执行；批准的 10 个文件在 06-09 开始前不得改动，任何改动都要重新请批准。

## Next Phase Readiness

- 06-09 可以直接使用上面的批次 B 批准清单：上传、依次执行 04 → 05 → 06，然后运行 verify-site 的 full 阶段。
- INFRA-01 在 06-09 验证 HTTPS 和探针站点后才算完成，这里不标记。
- 仍是假设的部分：JS 迁移（`trustedProxy`、`rateLimits`、`new Collection` 的写法）和首次 `serve` 的健康检查，要到 06-09 才在真实 0.41.1 上验证。

## Self-Check: PASSED

- 批次 B 批准清单的 10 行 sha256 与磁盘文件一致（`sha256sum -c --strict` 全部 OK，`tools/probe` 与 HEAD 一致）。
- `commits: 0` 与实测一致（`git rev-list --count e0905f9..HEAD` 在写入时为 0，没有未提交的源文件改动）。
