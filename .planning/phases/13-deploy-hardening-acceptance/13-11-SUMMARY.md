---
phase: 13-deploy-hardening-acceptance
plan: 11
subsystem: deploy-batch-2
tags: [deploy, pocketbase, nginx, csp, verify-site, owner-confirmation, ops-03]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-10 的第一批结果（探针退役、四个应用迁移、钩子、工具、加密钥匙环境文件、上传目录）
provides:
  - PocketBase 以正式 unit 运行（enabled、只绑回环、健康），设置在库里是密文，探针集合已由清理迁移删除
  - 站点（版本 a1159ad93165）和对应的 CSP 头已装好，/var/www/usj/site 指向对应的版本目录
  - nginx 挂上应用片段、安全响应头、访问日志格式和日志轮转，探针位置块已换掉，www 跳转已加
  - 上传目录已从服务器删除
  - 线上全量检查 VERIFY OK (19 checks)
affects: [13-12, 13-13, 13-14, 13-15]

actuals:
  tokens: 6000
  tasks: 3
  commits: 0
plan_head_before: 987ec44a36dac60d51a3681132c637134500d6b1
plan_head_after: 987ec44a36dac60d51a3681132c637134500d6b1

tech-stack:
  added: []
  patterns:
    - "只执行经批准并经即时确认的命令文件里的命令；每个脚本先 sha256sum -c 对清单行，再运行；输出一律先过 redact.mjs"
    - "本计划不改被跟踪的源文件，只改服务器；任务本身没有提交"

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-11-SUMMARY.md
  modified: []

key-decisions:
  - "钥匙只由所有者在自己的网页终端里保存；A12 选了保留，所以没有创建超级用户，只读个数 DB_SUPERUSERS_COUNT=1"
  - "WWW_REDIRECT=on：服务器确认 www 能解析且证书覆盖它，所以加了 www 跳转"

requirements-completed: []

duration: 约 15 分钟（本段执行）
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 11: 第二批部署 Summary

**经所有者即时确认后，第二批部署一次跑通：PocketBase 以正式配置启动并应用了四个应用迁移（设置变成密文、探针集合删除），站点和 CSP 装好，nginx 换上应用片段，上传目录已删，线上全量检查 19 项全部通过。**

## 即时确认（第二批）

- 确认时间：2026-11-12
- 所有者原话：“完成，钥匙已存好；确认执行第二批”
- 确认前所有者看到的内容：`test-results/13-11-batch2.txt` 的步骤 0–6 原文、每个脚本的清单行、每一步的通俗效果（含：中途失败时先删上传目录再停下；`--stage full` 会故意错 6 次后台口令，使所有者的 IP 约 60 秒内登不了后台，并有几次必须被拒绝的匿名写入）。所有者问过谁来执行，已告知：Claude 通过 ssh 执行，所有者只存钥匙和确认。
- 被确认的命令文件 sha256：`123e2be6a2696c9b0b2292e90a6bd2e0bece5ffb188be1c9a8bcf7924e9d4f1c`
- 批准清单（SHA256SUMS）自己的 sha256：`ac686d29b5f3b8c4a99f0fb4cc037d7e9132c73fd05f4acd7d9e0be9b56198b7`
- A12 选择：keep（“保留”）；批准选项：approve-all（“全部批准”）。
- 执行前本机核对：命令文件 sha256 与确认值一致；SHA256SUMS sha256 与批准值一致；只读状态 `PB_SERVICE_ACTIVE=inactive`、`DB_SUPERUSERS_COUNT=1`、`UPLOAD_DIRS=1`、`STATUS_DONE=1`；HEAD 为 987ec44。
- 所有者操作的完成情况：钥匙已由所有者在自己的网页终端保存（Claude 没有运行 `sudo cat`，没有读过环境文件）；A12 选了保留，所以没有创建超级用户（只读个数：`DB_SUPERUSERS_COUNT=1`）。

## 执行记录

Task 1（只读 tracer）和 Task 2（所有者操作加即时确认）在前一段会话完成，没有提交（按设计）。Task 3 在本段会话完成，命令与 `test-results/13-11-batch2.txt` 步骤 0–6 逐字相同，没有增加、跳过、调整顺序或改动任何命令或脚本。服务器输出全部先经 `node tools/privacy/redact.mjs`。上传目录 `/tmp/usj-deploy.mOiWUaan`（只有随机后缀，不是秘密）已在步骤 4 删除。

| 步骤 | 内容 | 过滤后的输出 | 与预期 |
| ---- | ---- | ------------ | ------ |
| 0 | 确认上传目录（只读） | 只列出一个目录 `/tmp/usj-deploy.mOiWUaan`；`sha256sum -c --strict` 通过，文件数 33 | 通过 |
| 1 | 04-start-pocketbase | `PB_UNIT=updated`、`PB_START=done`、`PB_SERVICE_ENABLED=enabled`、`PB_LISTEN_LOOPBACK_ONLY=yes`、`PB_SETTINGS_ENCRYPTED=yes`、`PB_RSS_MB=35`、`MEM_AVAILABLE_MB=432` | 一致 |
| 2 | 06-install-site | `SITE_VERSION=a1159ad93165`、`SITE_FILES=9`、`SITE_SWAP=done`、`CSP_CONF=installed`、`NGINX_RELOAD=skipped` | 一致 |
| 3 | 05-nginx-app | `NGINX_TEST=ok`、`NGINX_RELOAD=done`、`CERTBOT_DRY_RUN=ok`、`LOGROTATE_DRYRUN=ok`、`ANCHOR_BLOCK=443ssl`、`NGINX_APP_INCLUDE=1`、`NGINX_PROBE_INCLUDE=0`、`PROBE_SNIPPET=removed`、`WWW_REDIRECT=on`、`NGINX_APP=done` | 一致 |
| 4 | 删上传目录 | 无输出，退出 0 | 通过 |
| 5 | 只读状态 | 见下 | 一致（两处格式说明见“与计划的偏差”） |
| 6 | `verify-site.mjs --stage full`（只运行一次） | 见下 | `VERIFY OK (19 checks)` |

**`WWW_REDIRECT=on`**：服务器确认 www 能解析且证书也覆盖它，所以加了 www 跳转（F-14 随之为真的通过，不是“不适用”）。
**`SITE_VERSION=a1159ad93165`**：等于 13-09 记下的 `BUILD_VERSION`。

### 只读状态（步骤 5，过滤后的关键值）

`STATUS_DONE=1`、`PB_SERVICE_ACTIVE=active`、`PB_SERVICE_ENABLED=enabled`、`PB_HEALTH=ok`、`PB_LISTEN_LOOPBACK_ONLY=yes`、`PB_ENV_FILE=present`、`PB_ENV_MODE=root:pocketbase 640`、`PB_KEY_LEN_OK=yes`、`PB_ORIGIN_SET=yes`、`PB_MIGRATIONS_APP=4`、`PB_MIGRATIONS_PROBE=0`、`PB_HOOKS=1`、`PB_ADMIN_TOOL=present`、`DRILL_TOOL=present`、`DRILL_DIR=absent`、`DRILL_UNIT=inactive`、`PROBE_PAGE_DIR=absent`、`DB=present`、`DB_COLLECTIONS_PROBE=no`、`DB_SUPERUSERS_COUNT=1`、`DB_USERS_COUNT=0`、`DB_DOCS_COUNT=0`、`DB_USERS_NONTEST=0`、`DB_DOCS_NONTEST=0`、`DB_SETTINGS_ENCRYPTED=yes`、`DB_SU_OTP=off`、`DB_SU_MFA=off`、`NGINX_ACTIVE=active`、`NGINX_ENABLED=enabled`、`NGINX_TEST=ok`、`NGINX_CONFD_INCLUDED=yes`、`NGINX_ANCHOR_COUNT=1`、`NGINX_SERVER_ADD_HEADER=no`、`NGINX_PROBE_INCLUDE=absent`、`NGINX_APP_INCLUDE=present`、`NGINX_LOG_FORMAT=present`、`LOGROTATE_USJ=present`、`SITE_VERSION=a1159ad93165`、`SITE_FILES=9`、`UPLOAD_DIRS=0`、`PB_RSS_MB=35`、`MEM_AVAILABLE_MB=465`、`SWAP_TOTAL_MB=1023`、`PB_BINARY_VERSION=0.41.1`、`CERTBOT_TIMER=active`。输出经 `redact.mjs --check`：clean。

要点：探针集合已不在（`DB_COLLECTIONS_PROBE=no`，探针时期的测试账号 `DB_USERS_NONTEST` 回到 0）；设置已是密文（`DB_SETTINGS_ENCRYPTED=yes`）；`DB_SU_OTP=off`、`DB_SU_MFA=off`（超级用户的两步验证还没开，这是 13-12 要处理的，不属于本计划）。

### 线上全量检查（步骤 6，过滤后的 19 行）

```
PASS B-01 HTTPS 可达（DNS 和 TLS 正常）
PASS B-02 http 跳转到 https
PASS B-03 8090 从外面连不上 CLOSED
PASS F-01 / 返回 200 且响应头齐全（CSP、nosniff、Referrer-Policy、Permissions-Policy、HSTS 一天、noindex、DENY、no-cache）
PASS F-02 线上 CSP 的哈希与线上页面内联块一一对应，页面恰好一处云端开关
PASS F-03 线上策略含 style-src-attr 'none'、frame-ancestors 'none'，没有 unsafe- 关键字
PASS F-04 /sw.js 200、JavaScript 类型、no-cache、带 default-src none 的 CSP、含 12 位版本号
PASS F-05 /manifest.webmanifest 的类型是 application/manifest+json，name 是「计划手记」
PASS F-06 4 个主屏图标都是 200 且 image/png
PASS F-07 SDK 文件的 sha256 等于钉死值
PASS F-08 探针路径和未知路径都是 404（D-10）
PASS F-09 /api/health 返回 200 且带 X-Robots-Tag
PASS F-10 /_/ 返回 200，带 PocketBase 自己的 CSP（含 frame-ancestors）而不是页面的 CSP
PASS F-11 匿名注册被拒，匿名读不到任何文档
PASS F-12 SSE：10 秒内收到带 clientId 的 PB_CONNECT
PASS F-13 CORS：别的源不被放行，本站源得到同值
PASS F-14 www 跳转到裸域名（www 能解析且证书覆盖它时；否则不适用）
PASS F-15 页面带 Accept-Encoding: gzip 时返回 gzip
PASS F-16 后台登录连发 6 次，前 5 次不是 429，第 6 次 429（本机 IP 的后台登录会等 60 秒）
VERIFY OK (19 checks)
```

输出经 `redact.mjs --check`：clean。`--stage full` 只运行了一次，没有重跑。F-16 故意错了 6 次后台口令，所以**所有者在步骤 6 之后约 60 秒内不要登录 PocketBase 后台**，等一分钟再登。这些请求没有写任何记录。

## 对照计划验收标准

- 状态最后一行 `STATUS_DONE=1`，且 `PB_SERVICE_ACTIVE=active`、`PB_SERVICE_ENABLED=enabled`、`PB_LISTEN_LOOPBACK_ONLY=yes`、`DB_SETTINGS_ENCRYPTED=yes`、`DB_COLLECTIONS_PROBE=no`、`NGINX_TEST=ok`、`NGINX_APP_INCLUDE=present`、`NGINX_PROBE_INCLUDE=absent`、`NGINX_LOG_FORMAT=present`、`LOGROTATE_USJ=present`、`UPLOAD_DIRS=0`、`SITE_VERSION` 等于 `BUILD_VERSION`：满足。`PB_HEALTH` 的写法见偏差 2（语义满足）。
- `verify-site --stage full` 最后一行 `VERIFY OK (19 checks)`，过滤后的输出经 `redact.mjs --check` 干净：满足。
- 即时确认记录在案、命令文件 sha256 与确认值一致、SHA256SUMS sha256 与批准值一致：满足。
- 线上 `/probe/` 是 404（F-08）；CSP 与页面一致（F-02、F-03）；匿名写被拒（F-11）；SSE 正常（F-12）；CORS 只放行本站（F-13）；后台登录第 6 次 429（F-16）：满足。

## 与计划的偏差

**1. [格式差异，非服务器问题] `PB_ENV_MODE` 的输出写法**
- **发现于：** Task 3 步骤 5（沿用 13-10 的偏差）
- **问题：** `00-status.sh` 输出 `PB_ENV_MODE=root:pocketbase 640`（属主属组加权限位），不是计划写的 `640`。权限位确实是 640，属主 `root:pocketbase` 正是 D-02 要的。
- **处理：** 没有改服务器或脚本；按语义判定通过。

**2. [格式差异，非服务器问题] `PB_HEALTH` 的输出写法**
- **发现于：** Task 3 步骤 5
- **问题：** 命令文件的预期和计划的验收标准写 `PB_HEALTH=200`，而 `deploy/server/00-status.sh` 只会输出 `ok`、`fail` 或 `n/a`（用 `curl -fsS` 访问本机 `/api/health`，成功才是 `ok`）。实际输出 `PB_HEALTH=ok`，等于健康检查成功（HTTP 2xx）。另一个独立证据：F-09 在公网上看到 `/api/health` 返回 200。
- **处理：** 没有改服务器或脚本；按语义判定通过。如果有人原样复跑计划 Task 3 的自动化核对，`grep -qx 'PB_HEALTH=200'` 会因字面不同而判失败，请以本节为准（后续计划的核对应改用 `PB_HEALTH=ok`）。
- **影响：** 无。

除此之外：计划按原样执行。没有认证关卡，没有自动修复，没有第 4 条规则（架构）问题。

## 给后续计划和所有者的交接

- **网址已经可以打开**（站点、PocketBase、证书都正常）。还没有普通账号，13-12 建测试账号。
- **所有者待办：** 步骤 6 之后约 60 秒内不要登录 PocketBase 后台（F-16 的 6 次错误登录触发限流）。钥匙已由所有者自己保存，Claude 没有读过。
- **13-12 要知道：** `DB_SU_OTP=off`、`DB_SU_MFA=off`，超级用户的两步验证还没开，成功标准 3 的两步验证部分在 13-12 处理；`DB_USERS_COUNT=0`，没有任何普通账号；服务器上的上传目录已删，本机的 `private/deploy-out/` 原样保留。
- **OPS-02、OPS-03、SEC-02 保持 Pending：** 13-12 至 13-15 还会继续声称它们，本计划不勾选。

## Known Stubs

None. 本计划只在服务器上执行批准过的脚本，没有改被跟踪的源文件。

## Threat Flags

无新增攻击面。T-13-29（钥匙、超级用户邮箱和口令进入 Claude 的上下文）已缓解：钥匙只由所有者在自己的网页终端保存，Claude 没有运行 `sudo cat`、没有读环境文件、没有创建超级用户；状态只输出长度是否正确和个数。T-13-SC：没有安装任何系统包，PocketBase 沿用已核对的 0.41.1。T-13-38 由 Task 2 的即时确认缓解，记录见顶部。

## Self-Check: PASSED

- 命令文件 sha256 `123e2be6…d4f1c` 和 `SHA256SUMS` sha256 `ac686d29…198b7` 在执行前复核一致。
- 步骤 0–6 的每个退出码和输出都已与该步骤的预期核对；步骤 6 只运行一次，`VERIFY OK (19 checks)`。
- 本计划没有任务提交（`commits: 0`，由 `git rev-list --count 987ec44..HEAD` 测得，纯服务器操作加文档）；本 SUMMARY 作为单独的文档提交。
