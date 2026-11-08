---
phase: 06-procurement-reachability-probe
plan: 06
subsystem: infra
tags: [ssh, bash-s, pocketbase, migrations, swap, sha256-approval, d-04, d-04a, d-13, d-14, d-16, d-17, privacy]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-03 的 tools/probe/schema.json 和 schema-check.mjs（迁移字段与规则的唯一来源和比对工具）
  - phase: 06-procurement-reachability-probe
    provides: 06-04 的 redact.mjs 输出过滤器、.gitattributes 的 LF 规则、config.js 的 .gitignore 规则
  - phase: 06-procurement-reachability-probe
    provides: 06-01 的服务器访问通道（ssh 别名 usj）
provides:
  - "tools/probe/server/00-status.sh：只读状态报告（KEY=VALUE，最后一行 STATUS_DONE=1），经 ssh bash -s 从标准输入运行，已在真实服务器上跑通"
  - "批次 A 的 3 个脚本（01-swap.sh、02-install-pocketbase.sh、03-configure-pocketbase.sh）和 2 个迁移文件（probe_schema.js、probe_user.js.tpl），已写好、已通过本机静态检查、已经所有者批准，但没有上传、没有执行"
  - "## 批次 A 批准清单（sha256sum 格式）：06-08 上传前、上传后、每个脚本执行前核对的唯一依据"
affects: [06-07, 06-08, 06-09, 06-10]

actuals:
  tokens: 7200
  tasks: 3
  commits: 2
plan_head_before: fe4d7330a533ffc7da25737be4dce473eb050e27
plan_head_after: df88dae4f80e9b33dd5ec97526237158e6041658

tech-stack:
  added: []
  patterns:
    - "只读脚本经标准输入运行（ssh -o BatchMode=yes usj 'bash -s' < 脚本），不存到服务器；输出经 redact.mjs 才显示"
    - "改服务器的脚本：先下载并通过两项哈希核对，才建用户和目录；口令只在服务器上随机生成，写进 0600 / 0644 的文件，不上命令行、不打印"
    - "批准清单用 sha256sum 原样输出；06-08 在上传前、上传后、执行前三次核对"

key-files:
  created:
    - tools/probe/server/00-status.sh
    - tools/probe/server/01-swap.sh
    - tools/probe/server/02-install-pocketbase.sh
    - tools/probe/server/03-configure-pocketbase.sh
    - tools/probe/server/pb_migrations/probe_schema.js
    - tools/probe/server/pb_migrations/probe_user.js.tpl
  modified: []

key-decisions:
  - "D-04a 已确认：admin 免密 sudo（SUDO_NOPASSWD=yes），批次 A 由执行者经 ssh 执行，不需要 owner-runs"
  - "所有者选择 approve-all：批次 A 的 5 个文件按清单里的 sha256 全部批准，执行放在 06-08"
  - "02 脚本里的头部注释有一处不准确（说 --version 检查在改动系统之前，实际在安装之后），所有者按原样批准，不改文件（改了会使已批准的 sha256 失效），记为以后修订的备注"

patterns-established:
  - "先批准、再上传、再执行：批准文本逐个列出文件名和 sha256，上传只打包清单里的文件"

requirements-completed: []  # INFRA-01 要求网址能经 HTTPS 打开，06-06 只做了脚本和批准，未满足；留给 06-09 之后判定

coverage:
  - id: D1
    description: "只读 00-status.sh 经 ssh bash -s 在真实服务器上跑通，输出过滤后以 STATUS_DONE=1 结尾，确认免密 sudo、nginx 锚点唯一、8090 空闲"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "ssh -o BatchMode=yes usj 'bash -s' < tools/probe/server/00-status.sh | node tools/privacy/redact.mjs（SUDO_NOPASSWD=yes、NGINX_ANCHOR_COUNT=1、STATUS_DONE=1）"
        status: pass
    human_judgment: false
  - id: D2
    description: "批次 A 的 3 个脚本和 2 个迁移文件通过本机静态检查（bash -n、LF、无 set -x、双哈希、SCHEMA MATCH migration）和隐私检查"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "Task 2 的 verify 命令；node tools/probe/schema-check.mjs --migration tools/probe/server/pb_migrations/probe_schema.js (SCHEMA MATCH migration)；node tools/privacy/privacy-check.mjs --staged"
        status: pass
    human_judgment: false
  - id: D3
    description: "所有者对批次 A 的批准（approve-all）及 5 个文件的 sha256 批准清单"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "cd tools/probe && sha256sum -c --strict（5 个文件全部 OK）；git diff --quiet HEAD -- tools/probe/server"
        status: pass
    human_judgment: false
  - id: D4
    description: "迁移里 trustedProxy、rateLimits 的 JS 属性名和 new Collection 的字段写法在真实 PocketBase 0.41.1 上能运行"
    requirement: INFRA-01
    verification: []
    human_judgment: true
    rationale: "本机没有 PocketBase；这些写法第一次在真实 0.41.1 上运行是 06-09 启动服务时（研究假设 A6、A7），只能到那时由实际运行结果判定"

duration: 约 20min
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 06: 批次 A 服务器脚本与所有者批准 Summary

**打通“本机脚本 → ssh bash -s → 服务器 → redact 过滤后输出”的只读通道，确认免密 sudo 和 nginx 锚点唯一；写好批次 A 的 swap、PocketBase 安装（双重 sha256 核对）、迁移与随机探针账号配置三个脚本和两个迁移文件，并由所有者按 5 个文件的 sha256 全部批准（approve-all），服务器上尚未发生任何改动。**

## Performance

- **Duration:** 约 20 分钟（含前一个执行者完成的 Task 1、Task 2 和本次续跑）
- **Completed:** 2026-11-08T06:40Z 前后
- **Tasks:** 3（Task 3 为所有者检查点）
- **Files modified:** 6（全部为新建）

## Accomplishments

- tracer：`00-status.sh` 只读，经标准输入运行，不存到服务器；最后一行 `STATUS_DONE=1` 证明跑到了结尾。服务器上除这次只读检查外，没有任何变化。
- 批次 A 的 5 个文件写好并通过本机检查；`probe_schema.js` 与 `schema.json` 逐项一致（`SCHEMA MATCH migration`）。
- 所有者批准了批次 A；批准清单写在下面，06-08 只按它上传和执行。

## 00-status.sh 过滤后的输出（原样）

经 `node tools/privacy/redact.mjs` 过滤，一行一个 KEY=VALUE：

```text
SUDO_NOPASSWD=yes
OS=Ubuntu 24.04.5 LTS
ARCH=x86_64
MEM_TOTAL_MB=894
MEM_AVAILABLE_MB=443
SWAP_TOTAL_MB=0
SWAPFILE_ACTIVE=no
DISK_ROOT_AVAIL_GB=25
NTP_SYNC=yes
NGINX_ACTIVE=active
CERTBOT_TIMER=active
NGINX_TEST=ok
NGINX_SITE=default
NGINX_ANCHOR_COUNT=1
NGINX_PROBE_INCLUDE=absent
PORT_8090=free
PB_USER=absent
PB_BINARY_VERSION=absent
PB_MIGRATIONS=0
PROBE_CONFIG_JS=absent
PROBE_PAGE_FILES=0
PB_SERVICE_ACTIVE=absent
PB_SERVICE_ENABLED=absent
PB_HEALTH=n/a
PB_MEMORY_CURRENT_MB=n/a
PB_RSS_MB=n/a
DB=absent
STATUS_DONE=1
```

要点：免密 sudo 可用（D-04a 满足）；内存只有 894 MB、可用 443 MB、没有 swap，所以 01-swap.sh 有必要；根分区可用 25 GB；nginx 配置测试通过，certbot 锚点行正好 1 条；8090 空闲；PocketBase 的用户、程序、迁移、config.js 都还没有。

## 批次 A 批准清单

所有者选择：**approve-all（三个脚本全部批准）**，回复原话“全部批准 (Recommended)”。批准日期：2026-11-08（UTC；本地时间 2026-11-07）。

批准只覆盖下面 5 个文件、这些 sha256（`sha256sum` 格式，路径相对 `tools/probe`）。清单之外的文件（00-status.sh、批次 B 的任何文件、pocketbase.service、nginx 片段、探针页）都不在批准范围内，不上传。续跑开始时已在本机重新核对：`cd tools/probe && sha256sum -c --strict` 五个文件全部 OK，`git diff --quiet HEAD -- tools/probe/server` 成立（文件与提交 df88dae 一致）。

```text
acd9ae1c608eede851f2eecc69bc63f823f01a4b583ed716d0e9c676b3dc249d  server/01-swap.sh
b999df0127920c48371277f8c7072c56fe76ed71744d8590c5508c95a94789d5  server/02-install-pocketbase.sh
9d42a48b590f8067587f80ff45a225219f6e39b13f00836b1f428bf925fb0640  server/03-configure-pocketbase.sh
7f90f9603a598d4763de4e45d54b2744d61860c7c08cee9bc5f777061628f3cb  server/pb_migrations/probe_schema.js
4234d5eb1896ef075420fbf2d16b71a78fe644737913a66f5db4aa032b1ed189  server/pb_migrations/probe_user.js.tpl
```

给 06-08 的说明：

- 本机 Git Bash 的 `sha256sum` 输出是 `<hash> *<file>`（星号），而上面的清单用两个空格。**之后所有解析这份清单的步骤都要同时接受两种分隔**（`  ` 和 ` *`，例如匹配 `[ *]`，或用 `sha256sum --text` 重新生成清单再比对哈希和路径）。这算阻塞问题的就地修正，不改批准流程，也不改被批准的文件内容。
- 上传前在本机、上传后在服务器上各核对一次，并确认上传目录里的文件数等于 5；每个脚本执行前，在同一条 ssh 里再核对它自己的那一行。任何一项不一致就停下，重新请求批准。
- 06-08 执行 02 之后，会把服务器上核对过的 zip 用 scp 取回本机被忽略的 `private/pocketbase/`（这次批准也包含 D-17 的下载）。
- 不做的事（属于批次 B，06-08 另行批准）：不启动 PocketBase、不改 nginx、不碰 certbot 和所有者装的 Node/PM2。
- 回滚：swapoff 并删除 /swapfile、恢复 fstab 备份；删除 /opt/pocketbase、/var/lib/pocketbase、/var/www/usj/probe/config.js 和 pocketbase 用户（只有合成数据）。

## Task Commits

1. **Task 1: tracer——只读 00-status.sh 经 ssh 跑通** - `4f15304`（feat）
2. **Task 2: 批次 A 的 3 个脚本和 2 个迁移文件** - `df88dae`（feat）
3. **Task 3: 所有者批准批次 A（checkpoint:decision, blocking-human）** - 无代码提交，批准记录在本文件

**Plan metadata:** 见随后的 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）

## Files Created/Modified

- `tools/probe/server/00-status.sh` - 只读状态报告，不在批准清单里，一直经标准输入运行
- `tools/probe/server/01-swap.sh` - 1 GB /swapfile（权限 600），fstab 先备份，不改 swappiness，已存在时什么也不做
- `tools/probe/server/02-install-pocketbase.sh` - PocketBase 0.41.1 固定哈希安装，双重核对，系统用户 pocketbase，不装系统包
- `tools/probe/server/03-configure-pocketbase.sh` - 先建 /var/www/usj/probe，再装两个迁移，随机生成合成探针账号并写 config.js，幂等
- `tools/probe/server/pb_migrations/probe_schema.js` - users 规则收紧，probe_results、probe_pings 两个集合，日志、代理头、限流设置
- `tools/probe/server/pb_migrations/probe_user.js.tpl` - 探针账号迁移模板，只含两个占位

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### 实现上比计划文字更保守的几处（前一个执行者记录，均属 Rule 2 范围内的加固）

1. **[Rule 2 - 加固] 02 脚本先下载并通过两项哈希核对，才创建任何用户或目录。** 下载到 mktemp 目录并核对 zip 的 sha256（钉死值）和 checksums.txt 那一行，之后才 useradd、建目录、安装；哈希不符时服务器上什么也没留下。
2. **[Rule 2 - 加固] curl 除 `--proto '=https' --tlsv1.2` 外，还加了 `--proto-redir '=https' --max-redirs 5 --max-time`。** 跳转同样只许 https，限制跳转次数和总耗时。
3. **[Rule 2 - 加固] 03 脚本的幂等判断检查三样东西**（schema 迁移、user 迁移、config.js）：三样都在输出 `PB_CONFIGURE=already`，只有部分在就报错退出，不重新生成。计划文字只检查 schema 迁移和 config.js 两样。
4. **[Rule 2 - 加固] 03 脚本从不把口令放在命令行上：** 用 bash 变量替换和 `printf | sudo tee` 写文件，口令不会出现在进程列表里。
5. **[Rule 2 - 加固] 01 脚本在 fallocate 之前先用权限 600 创建 /swapfile，** 不留下一个短暂可读的窗口。

### 已知备注（不改文件）

- **02 脚本头部注释的一处不准确：** 注释说“两项核对和 --version 检查都在改动系统之前完成”，实际 `--version` 检查在安装之后才运行（两项哈希核对确实在改动之前）。所有者已按原样批准这 5 个文件，改动 02 会使已批准的 sha256 失效，所以这次**不修改**，记为以后修订的备注：若将来因别的原因重新批准 02，顺手把注释改准确。

除此之外：计划按原文执行。没有认证门（免密 sudo 已在 Task 1 确认）。

## Issues Encountered

- `sha256sum` 在本机 Git Bash 输出带星号（`*文件名`），而批准清单是两个空格；已在“批次 A 批准清单”一节写明下游解析要两种分隔都接受，没有改被批准的任何文件。

## Known Stubs

无。`probe_user.js.tpl` 里的 `__PROBE_EMAIL__`、`__PROBE_PASSWORD__` 是有意保留的占位，由 03 脚本在服务器上替换。

## Threat Flags

无新增：本计划新增的信任边界（ssh 通道、维护者站点下载、服务器输出）都已在计划的威胁登记里（T-06-14、T-06-15、T-06-16、T-06-17、T-06-30、T-06-31）。

## User Setup Required

无。下一步是 06-07（nginx 片段与服务单元，批次 B 文件），然后 06-08 按上面的批准清单上传并执行批次 A；批次 B 在 06-08 另行批准。

## Next Phase Readiness

- 06-08 可以直接使用批准清单；进入 06-08 之前，批次 A 的 5 个文件不得改动（任何改动都要重新请批准）。
- 仍是假设的部分：迁移里 `trustedProxy`、`rateLimits` 的属性名和 `new Collection` 的字段写法要到 06-09 启动 PocketBase 时才在真实 0.41.1 上验证。

## Self-Check: PASSED

- 6 个文件（00-status.sh、01、02、03、probe_schema.js、probe_user.js.tpl）存在，提交 4f15304 和 df88dae 都是 HEAD 的祖先。
- 批准清单的 5 行 sha256 与磁盘文件一致（`sha256sum -c --strict` 全部 OK）。
