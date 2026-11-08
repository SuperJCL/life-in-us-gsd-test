---
phase: 06-procurement-reachability-probe
plan: 09
subsystem: infra
tags: [ssh, pocketbase, nginx, certbot, systemd, sse, sha256-approval, verify-site, firewall, d-02, d-03, d-04, d-13, privacy]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-08 的批次 B 批准清单（10 个文件的 sha256，approve-all）、已装好的 PocketBase 0.41.1、所有者建的超级用户
  - phase: 06-procurement-reachability-probe
    provides: 06-07 的 04/05/06 脚本、unit、nginx 片段、探针页和 verify-site.mjs
provides:
  - "服务器上运行中的探针站点：PocketBase 以 systemd 服务运行并开机自启，只听本机回环；nginx 挂上探针位置块；探针页已装好；两个探针迁移已生效"
  - "verify-site full 阶段 14/14 通过（F-01 到 F-14），F-13 实时推送 199 ms"
  - "所有者确认控制台防火墙：TCP 22、80、443 加一条 ICMP，8090 不在列表；所有者短测已上传"
  - "交给 Phase 13 的数字：可用内存、swap、PocketBase 内存、certbot dry-run、F-13 延迟"
affects: [06-10, 13]

actuals:
  tokens: 9000
  tasks: 2
  commits: 1
plan_head_before: eaf4f4fbeac993cb54a144135d8140b14cea23ee
plan_head_after: e3ba17cef7cb70f9b0b54a7499188df3b95a47ed

tech-stack:
  added: []
  patterns:
    - "批次执行：本机 sha256sum -c → 只打包清单文件上传 → 服务器 sha256sum -c 加文件数比对 → 每个脚本在同一条 ssh 里先核对自己那一行再执行 → 删除上传目录"
    - "只读状态脚本只经 ssh 的标准输入运行，不放在服务器上，不属于任何批准批次"

key-files:
  created: []
  modified:
    - tools/probe/server/00-status.sh

key-decisions:
  - "批次 B 按 06-08 的批准清单原样执行（approve-all，10 个文件），三道哈希核对全部通过，没有重新请批准"
  - "00-status.sh 的设置读取修正（Rule 1）不属于批次 A 或批次 B：它只读、从不上传到服务器，只通过 ssh 标准输入运行"
  - "所有者短测记录以 06-10 Task 1 的只读导出核对 dur_s 与 login_ok 为准；毫秒数所有者未报，不编造"

patterns-established:
  - "只读状态脚本的修正不进批准清单：脚本不落盘到服务器，每次从本机经标准输入送过去"

requirements-completed: [INFRA-01]

coverage:
  - id: D1
    description: "批次 B 按批准清单上传并依次执行 04、05、06，三个脚本全部成功，上传目录已删除"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "本机 sha256sum -c、服务器 sha256sum -c 加文件数、每个脚本同一条 ssh 内再核对；输出经 redact（PB_START=done、ANCHOR_BLOCK=443ssl、NGINX_RELOAD=done、CERTBOT_DRY_RUN=ok、PROBE_PAGE=done、UPLOAD_DIR=absent）"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify-site full 阶段 14 项全部通过（HTTPS、跳转、8090 外部关闭、/_/ 公开、规则、SSE、限流）"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "node tools/probe/verify-site.mjs --stage full | node tools/privacy/redact.mjs（PASS F-01..F-14，VERIFY OK (14 checks)）；redact --check 退出码 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "只读状态：服务、绑定、nginx、certbot、迁移设置、账号数全部符合预期"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "ssh usj 'bash -s' < tools/probe/server/00-status.sh | node tools/privacy/redact.mjs（STATUS_DONE=1，全部期望键符合）；redact --check 退出码 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "所有者确认阿里云控制台防火墙只放行 TCP 22/80/443 和一条 ICMP，8090 不在列表；执行者另用只读 ss 确认公网侧监听只有 22/80/443"
    requirement: INFRA-01
    verification:
      - kind: manual_procedural
        ref: "所有者回复“完成”，追问后答“除了这三个还有个-1”、协议列为 ICMP；ss -Htln / ss -Hduln 只读核对"
        status: pass
    human_judgment: true
    rationale: "控制台防火墙是 Claude 看不到的外层，只能由所有者确认；ss 只能证明服务器自身的监听"
  - id: D5
    description: "所有者用 ?dur=90 在自己的浏览器里完整跑过一次探针页并显示已上传"
    requirement: INFRA-02
    verification:
      - kind: manual_procedural
        ref: "所有者回复“完成”；执行者只读状态里 DB_PROBE_RESULTS_COUNT 1→2、DB_PROBE_PINGS_COUNT 1→3，说明短测记录已上传"
        status: pass
    human_judgment: true
    rationale: "只覆盖所有者自己的网络和浏览器；dur_s 与 login_ok 的精确核对在 06-10 Task 1；INFRA-02 的晚高峰多网实测在 06-10"
  - id: D6
    description: "00-status.sh 能正确读出 PocketBase 0.41.1 的设置（_params 表按 id 取行）"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "修正后重跑只读状态：DB_SETTINGS_LOGS_MAXDAYS=2、DB_SETTINGS_LOGIP=false、DB_SETTINGS_TRUSTED_PROXY_XREALIP=yes、DB_SETTINGS_RATELIMITS=true；orchestrator 复核 diff 并重跑，结果一致"
        status: pass
    human_judgment: false

duration: 多段执行（含所有者操作的等待）
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 09: 批次 B 执行、外部验收与所有者防火墙和短测确认 Summary

**按 06-08 批准的清单上传并执行批次 B（04 启动 PocketBase、05 挂 nginx、06 装探针页），verify-site full 阶段 14/14 通过（F-13 实时推送 199 ms），只读状态全部符合预期；所有者确认控制台防火墙只有 TCP 22/80/443 加一条 ICMP、8090 不在列表，并完成了 ?dur=90 短测（记录已上传）。INFRA-01 在此完成，INFRA-02 留给 06-10。**

## Performance

- **Completed:** 2026-11-08
- **Tasks:** 2（Task 1 tracer，Task 2 所有者操作）
- **Files modified:** 1（`tools/probe/server/00-status.sh`，Rule 1 修正，见 Deviations）

## Accomplishments

- tracer：批次 B 三个脚本一次通过。PocketBase 现在是开机自启的 systemd 服务，只听本机回环；nginx 加了一行 include，`nginx -t` 和 `certbot renew --dry-run` 都通过；探针页 4 个文件已装好。
- 从公网第一次完整走通“浏览器 → HTTPS → nginx → PocketBase → SSE”：verify-site full 阶段 F-01 到 F-14 全部 PASS。
- 服务器上没有留下上传目录；批次 B 之外的文件（批次 A 的文件、00-status.sh、config.example.js、vendor 的 LICENSE.md 和 README.md）没有上传。
- 所有者确认控制台防火墙并完成短测；执行者的只读核对显示短测记录已进入数据库。

## Task 1 记录（已脱敏）

### 批次 B 执行与 sha256 核对

批次 B 严格按 06-08-SUMMARY 的 `## 批次 B 批准清单`（approve-all，10 个文件）执行：

- 上传前在本机用清单核对；
- 只打包清单里的 10 个路径上传；
- 上传后在服务器上核对清单并比对文件数；
- 每个脚本在同一条 ssh 里先核对自己那一行再执行。

没有任何哈希不符，不需要重新请批准。

### 04-start-pocketbase.sh

- 创建了 systemd unit 的符号链接。
- 两个探针 JS 迁移在第一次 `serve` 时应用，与 06-08 的迁移时机发现一致，研究假设 A6、A7 在真实 0.41.1 上成立。

```text
PB_JOURNAL_SUSPECT_LINES=0
PB_START=done
PB_SERVICE_ENABLED=enabled
PB_MEMORY_CURRENT_MB=9
PB_RSS_MB=33
MEM_AVAILABLE_MB=444
```

### 05-nginx-probe.sh

```text
ANCHOR_BLOCK=443ssl
NGINX_PROBE_INCLUDE=present
NGINX_TEST=ok
NGINX_RELOAD=done
CERTBOT_DRY_RUN=ok
CERTBOT_TIMER_NEXT=Mon 2026-11-09 11:07:17
```

### 06-install-probe-page.sh

```text
PROBE_CONFIG_JS=present
PROBE_PAGE=done
PROBE_PAGE_FILES=4
UPLOAD_DIR=absent
```

### verify-site full 阶段（14 项，原样）

```text
PASS F-01 /probe/ 返回 200 且带四个安全头
PASS F-02 服务器上的 SDK 文件哈希等于 vendor/SHA256SUMS
PASS F-03 /probe/config.js 可读且含探针账号
PASS F-04 http 跳转到 https
PASS F-05 8090 从外面连不上 CLOSED
PASS F-06 /api/health 返回 200
PASS F-07 /_/ 返回 200 且是网页（D-13 对公网开放）
PASS F-08 匿名注册被拒
PASS F-09 探针账号能登录
PASS F-10 能新建 probe_results（drops=0、login_ok=false）
PASS F-11 不能列出、查看、修改、删除 probe_results
PASS F-12 不能修改自己的用户记录
PASS F-13 SSE：2 秒内收到 PB_CONNECT，订阅后新建打点 3 秒内收到推送 199ms
PASS F-14 连续 3 次错误口令登录至少一次 429（限流） 1/3
VERIFY OK (14 checks)
```

verify-site 的副作用：在数据库里留下 1 条 probe_results 和 1 条 probe_pings 记录，都是合成数据（run_id 以 verify- 开头）。

### 批次 B 之后的 00-status 输出（修正后的脚本，原样）

`PORT_8090` 一行的值是仅本机回环地址（不写出具体地址）：

```text
SUDO_NOPASSWD=yes
OS=Ubuntu 24.04.5 LTS
ARCH=x86_64
MEM_TOTAL_MB=894
MEM_AVAILABLE_MB=426
SWAP_TOTAL_MB=1023
SWAPFILE_ACTIVE=yes
DISK_ROOT_AVAIL_GB=24
NTP_SYNC=yes
NGINX_ACTIVE=active
CERTBOT_TIMER=active
NGINX_TEST=ok
NGINX_SITE=default
NGINX_ANCHOR_COUNT=1
NGINX_PROBE_INCLUDE=present
PORT_8090=（仅本机回环）
PB_USER=present
PB_BINARY_VERSION=0.41.1
PB_MIGRATIONS=2
PROBE_CONFIG_JS=present
PROBE_PAGE_FILES=4
PB_SERVICE_ACTIVE=active
PB_SERVICE_ENABLED=enabled
PB_HEALTH=ok
PB_MEMORY_CURRENT_MB=12
PB_RSS_MB=34
DB_COLLECTIONS_PROBE=yes
DB_USERS_RULES_LOCKED=yes
DB_SETTINGS_LOGS_MAXDAYS=2
DB_SETTINGS_LOGIP=false
DB_SETTINGS_TRUSTED_PROXY_XREALIP=yes
DB_SETTINGS_RATELIMITS=true
DB_USERS_COUNT=1
DB_SUPERUSERS_COUNT=1
DB_PROBE_RESULTS_COUNT=1
DB_PROBE_PINGS_COUNT=1
STATUS_DONE=1
```

超级用户：已建（个数 1）。`free -m` 显示 swap 已用 0（批次 A 起 1 GB swap 一直在线）。

### 交给 Phase 13 的数字

| 项目 | 数值 |
|------|------|
| 内存总量 / 可用 | 894 MB / 426 MB（批次 B 之后）；04 脚本当时可用 444 MB |
| swap | 1023 MB，已用 0 |
| PocketBase 内存（systemd MemoryCurrent） | 9 MB（04 脚本）、12 MB（状态脚本） |
| PocketBase RSS | 33 MB（04 脚本）、34 MB（状态脚本） |
| certbot dry-run | ok；定时器下次触发 Mon 2026-11-09 11:07:17 |
| F-13 实时推送延迟 | 199 ms（阈值 3 s） |
| F-14 限流 | 3 次错误口令中 1 次返回 429 |

## Task 2 记录

### 所有者回复

- 第一次回复：“完成”。
- 追问防火墙是否只有 TCP 22/80/443（可含 ICMP）且没有 8090，所有者答：“除了这三个还有个-1”。再问那一行的协议列，所有者答：“ICMP”。
- 结论：控制台防火墙是 TCP 22、80、443 加一条 ICMP（端口列显示 -1），8090 不在列表，符合验收标准。
- 首屏和登录的毫秒数：所有者未报毫秒数；06-10 Task 1 的只读导出核对 dur_s 与 login_ok。
- 可选的后台（`/_/`）登录：未报告（可选项）。

### 执行者的只读核对（输出已脱敏）

- 重跑 00-status：DB_PROBE_RESULTS_COUNT 1→2，DB_PROBE_PINGS_COUNT 1→3，PB_SERVICE_ACTIVE=active，PB_HEALTH=ok，8090 仍只在本机回环，MEM_AVAILABLE_MB=443，STATUS_DONE=1。所有者的短测因此确实上传了，记为“已上传”；精确的 dur_s 和 login_ok 留给 06-10 Task 1。
- `ss -Htln`、`ss -Hduln`：对公网的 TCP 监听只有 22、80、443（IPv4 和 IPv6 各一份）；8090 和 DNS 只在本机回环；UDP 只有本机回环服务和 DHCP 客户端。所以即使不看控制台，服务器自身也没有暴露其他端口。（不记录任何地址。）

## Task Commits

1. **Task 1: tracer——执行批次 B，verify-site full 14 项和只读状态** - `e3ba17c`（fix：00-status.sh 的设置读取修正，见 Deviations）。批次 B 的上传和执行本身发生在服务器上，不产生仓库提交。
2. **Task 2: 所有者确认防火墙并短测（checkpoint:human-action, blocking-human）** - 无提交，记录在本文件

**Plan metadata:** 随后的 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）。`commits: 1` 是写本文件时的实测值（`git rev-list --count eaf4f4f..HEAD`），不含这个 docs 提交。

## Files Created/Modified

仓库内：

- `tools/probe/server/00-status.sh`：设置读取修正（见 Deviations）。

仓库外：

- 服务器：`/etc/systemd/system/pocketbase.service`（符号链接）、`/etc/nginx/snippets/usj-probe-locations.conf`、站点文件里的一行 include（先备份到 `/etc/nginx/usj-backup/`）、`/var/www/usj/probe/`（4 个文件）；数据库里 verify-site 和所有者短测产生的合成记录。

## Decisions Made

见 frontmatter 的 key-decisions。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 00-status.sh 按不存在的 `key` 列查 `_params`，四个设置全部显示 n/a**

- **Found during:** Task 1（批次 B 之后的只读状态）
- **Issue:** PocketBase 0.41.1 把设置存在 `_params` 表 `id='settings'` 的一行里，表里没有 `key` 列，脚本的查询失败，DB_SETTINGS_* 四项全是 n/a，无法验证迁移设置是否生效；另外 logIP 和 rateLimits 是布尔值，需要打印 true/false。
- **Fix:** 先按 `id` 取行，取不到再试 `key`；logIP 和 rateLimits 打印 true/false。
- **Files modified:** `tools/probe/server/00-status.sh`
- **Verification:** 修正后重跑：DB_SETTINGS_LOGS_MAXDAYS=2、DB_SETTINGS_LOGIP=false、DB_SETTINGS_TRUSTED_PROXY_XREALIP=yes、DB_SETTINGS_RATELIMITS=true；orchestrator 复核 diff 并重跑，结果一致。
- **Commit:** `e3ba17c`
- **批准范围：** 00-status.sh 是只读脚本，从不上传到服务器，只通过 `ssh usj 'bash -s' < 文件` 运行，不属于批次 A 或批次 B 的批准清单，所以不需要重新请批准。

### 记录在案的副作用（不算偏离）

- verify-site full 阶段会写入 1 条 probe_results 和 1 条 probe_pings 合成记录（run_id 以 verify- 开头），这是计划里就说明的 smoke 记录。06-10 汇总时需要把它们和所有者的短测、正式实测区分开。

---

**Total deviations:** 1 auto-fixed（1 bug）
**Impact on plan:** 只影响只读状态脚本的显示，没有改动任何已批准的文件，也没有改变服务器上的任何东西。

## Issues Encountered

无其他问题。三个批次 B 脚本一次通过，没有哈希不符，没有触发回滚。

## Known Stubs

无。

## Threat Flags

无新增：本计划涉及的信任边界（公网到 nginx 到本机服务、控制台防火墙、公开的探针账号）都在计划的威胁登记里（T-06-25、T-06-26、T-06-33、T-06-SC）。

## 需求状态

| 需求 | 状态 | 依据 |
|------|------|------|
| INFRA-01 | 完成（本计划标记） | 经域名 HTTPS 打开探针页（F-01）；http 跳转 https（F-04）；PocketBase 健康检查经 nginx 返回 200（F-06）；所有者确认控制台防火墙；`certbot renew --dry-run` 通过，定时器仍有下次触发时间 |
| INFRA-02 | 保持 Pending | 所有者短测只证明页面在所有者的网络和浏览器里可用；晚高峰三网和美国的实测在 06-10 |

INFRA-01 仍存在的残余风险（计划的假设表已列出）：

- 证书真正到期续期要 60–90 天后才发生，现在只由 dry-run 和定时器间接证明。
- 服务器重启后的自恢复目前只看到 enabled；真正重启一次属于 Phase 13。

## User Setup Required

无新增。

## Next Phase Readiness

06-10 的待办：

- Task 1 的只读导出要核对所有者那条短测记录：dur_s 在 60–120 之间、login_ok 为真；并检查打点是否收到。
- 所有者没报首屏和登录的毫秒数：由导出数据补上，不依赖口头数字。
- 至少 3 个晚上、三网加美国的晚高峰实测，由所有者组织。
- 汇总时区分 verify-site 的 smoke 记录、所有者的短测记录和正式实测记录。
- INFRA-02 由 06-10 完成。

## Self-Check: PASSED

- 提交 `e3ba17c` 存在于当前分支（见下面的命令核对）。
- `commits: 1` 与实测一致（`git rev-list --count eaf4f4f..HEAD` 在写入时为 1）。
- 所有引用的 redact 输出（out04、out05、out06、outv、outS）在引用前都经 `node tools/privacy/redact.mjs --check` 退出码 0。
