---
phase: 13-deploy-hardening-acceptance
plan: 10
subsystem: deploy-batch-1
tags: [deploy, pocketbase, probe-retire, encryption-key, migrations, hooks, owner-confirmation, ops-03]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-09 经所有者批准的上传包清单（SHA256SUMS）、A12 选择（keep）、approve-all
provides:
  - 服务器上的第一批改动：探针退役（保留数据库）、四个应用迁移、备份看门狗钩子、pb-admin.sh 和恢复演练脚本、PocketBase 加密钥匙环境文件
  - 上传目录（保留到 13-11 使用）
  - PocketBase 停在 inactive，等第 11 波（13-11）接手
affects: [13-11, 13-12, 13-13, 13-14, 13-15]

actuals:
  tokens: 4000
  tasks: 3
  commits: 0
plan_head_before: fe4140c3b9019508648010e4173f66096b98e638
plan_head_after: fe4140c3b9019508648010e4173f66096b98e638

tech-stack:
  added: []
  patterns:
    - "只执行经批准并经即时确认的命令文件里的命令；每条脚本先 sha256sum -c 对清单行，再运行；输出一律先过 redact.mjs"
    - "本计划不改被跟踪的源文件，只改服务器；任务本身没有提交"

key-files:
  created:
    - .planning/phases/13-deploy-hardening-acceptance/13-10-SUMMARY.md
  modified: []

key-decisions:
  - "07 只接受一个参数，所以按 `bash server/07-retire-probe.sh --keep` 执行，不带上传目录；计划正文里“07 加上传目录”的写法与脚本不符，以脚本为准（所有者在即时确认前已被告知）"
  - "上传目录保留到 13-11，本批不删它"

requirements-completed: []

duration: 约 20 分钟（本段执行）
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 10: 第一批部署 Summary

**经所有者即时确认后，第一批部署一次跑通：探针退役但数据库原样保留，四个应用迁移、备份看门狗钩子、管理工具、恢复演练脚本和加密钥匙环境文件都已装好，PocketBase 停在 inactive 等第 11 波。**

## 即时确认（第一批）

- 确认时间：2026-11-12
- 所有者原话：“确认执行第一批”
- 确认前所有者看到的内容：`test-results/13-10-batch1.txt` 的步骤 1–9 原文、每个脚本的清单行、每一步的通俗效果；07 只接受一个参数，所以按 `bash server/07-retire-probe.sh --keep` 执行（不带上传目录）；01、02 也不带上传目录；步骤 8 之后所有者自己的待办（在阿里云网页终端里用 `sudo cat /etc/usj/pocketbase.env` 保存 `PB_ENCRYPTION_KEY` 那一行，Claude 不读）。
- 被确认的命令文件 sha256：`d01a23b7bca4ab9226fa642e6e1d2892962d06f70f187582d3474999b392feeb`
- 批准清单（SHA256SUMS）自己的 sha256：`ac686d29b5f3b8c4a99f0fb4cc037d7e9132c73fd05f4acd7d9e0be9b56198b7`
- A12 选择：keep（所有者原话：“保留”）；批准选项：approve-all（“全部批准”）。
- 执行前本机核对：命令文件 sha256 与确认值一致；SHA256SUMS sha256 与批准值一致；`sha256sum -c --strict` 通过；HEAD 为 fe4140c。

## 执行记录

Task 1（只读 tracer）和 Task 2（即时确认）在上一段会话完成，没有提交（按设计）。Task 3 在本段会话完成，命令和 `test-results/13-10-batch1.txt` 步骤 1–9 逐字相同，没有增加、跳过、调整顺序或改动任何命令或脚本。服务器输出全部先经 `node tools/privacy/redact.mjs`。

**上传目录（13-11 要用）：** `/tmp/usj-deploy.mOiWUaan`（只有随机后缀，不是秘密；上传包 33 个文件仍在里面）。

| 步骤 | 内容 | 过滤后的输出 | 与预期 |
| ---- | ---- | ------------ | ------ |
| 1 | 建上传目录（0700 随机目录），本机核对格式 | 路径匹配 `^/tmp/usj-deploy\.[A-Za-z0-9]{8}$` | 通过 |
| 2 | 本机核对 SHA256SUMS 自己的 sha256 和全部文件 | 无输出，退出 0 | 通过 |
| 3 | 上传 32 个批准过的文件加 SHA256SUMS | 无输出，退出 0 | 通过 |
| 4 | 服务器上再核对一次（`sha256sum -c --strict`，文件数 33） | 无输出，退出 0 | 通过 |
| 5 | 01-swap（清单行核对后运行） | `SWAP_FSTAB=present`、`SWAP=already`、`SWAP_TOTAL_MB=1023` | 一致，什么都没改 |
| 6 | 02-install-pocketbase（只核对） | `PB_ZIP_SHA256_MATCH=yes`、`PB_BINARY_MATCHES_ZIP=yes`、`PB_INSTALL=already`、`PB_BINARY_VERSION=0.41.1` | 一致 |
| 7 | 07-retire-probe `--keep` | `PB_SERVICE_ACTIVE=inactive`、`PROBE_MIGRATIONS_REMOVED=2`、`PROBE_PAGE=removed`、`PB_DATA=kept`、`PROBE_RETIRE=done` | 一致 |
| 8 | 03-configure-pocketbase | `PB_ENV_FILE=created`、`PB_KEY_LEN_OK=yes`、`PB_ORIGIN_SET=yes`、`PB_MIGRATIONS_APP=4`、`PB_HOOKS=1`、`PB_ADMIN_TOOL=installed`、`DRILL_TOOL=installed`、`PB_CONFIGURE=done` | 一致；钥匙没有出现在任何输出里 |
| 9 | 只读状态（`00-status.sh`） | 见下 | 一致（见下面的一处格式说明） |

### 只读状态（步骤 9，过滤后的关键值）

`STATUS_DONE=1`、`PB_SERVICE_ACTIVE=inactive`、`PB_SERVICE_ENABLED=enabled`、`PB_ENV_FILE=present`、`PB_ENV_MODE=root:pocketbase 640`、`PB_KEY_LEN_OK=yes`、`PB_ORIGIN_SET=yes`、`PB_MIGRATIONS_APP=4`、`PB_MIGRATIONS_PROBE=0`、`PB_HOOKS=1`、`PB_ADMIN_TOOL=present`、`DRILL_TOOL=present`、`PROBE_PAGE_DIR=absent`、`SWAP_FSTAB=present`、`SWAPFILE_ACTIVE=yes`、`UPLOAD_DIRS=1`、`PB_BINARY_VERSION=0.41.1`、`DB=present`、`DB_COLLECTIONS_PROBE=yes`、`DB_SUPERUSERS_COUNT=1`、`DB_USERS_COUNT=1`、`DB_DOCS_COUNT=n/a`、`DB_USERS_NONTEST=1`、`DB_DOCS_NONTEST=0`、`DB_SETTINGS_ENCRYPTED=no`、`NGINX_ACTIVE=active`、`NGINX_TEST=ok`、`NGINX_PROBE_INCLUDE=present`、`NGINX_APP_INCLUDE=absent`、`SITE_FILES=0`、`DRILL_DIR=absent`、`DRILL_UNIT=inactive`、`PB_HEALTH=n/a`（PocketBase 已停）。

其余行（系统版本、内存、证书定时器等）与第一批之前相比没有变化。输出经 `redact.mjs --check`：clean。

数据库状态：`--keep` 按所有者的选择保留了探针时期的数据库和 Phase 6 的超级用户；探针集合还在（`DB_COLLECTIONS_PROBE=yes`），等 PocketBase 第一次启动时由清理迁移 `1794096150_retire_probe.js` 删除（13-11 起服务时发生）。`DB_SETTINGS_ENCRYPTED=no` 同理，等 `1794096200_server_settings.js` 在首次启动时处理，由 13-11 的启动后检查确认。

## 对照计划验收标准

- PocketBase 停止（`PB_SERVICE_ACTIVE=inactive`）：满足。
- 环境文件存在，钥匙长度合格，站点地址已设置：满足（`PB_ENV_FILE=present`、`PB_KEY_LEN_OK=yes`、`PB_ORIGIN_SET=yes`）。
- 四个应用迁移和一个钩子已装、探针迁移和探针页已没有：满足（4 / 1 / 0 / `PROBE_PAGE_DIR=absent`）。
- fstab 有 swap 行：满足。
- 上传目录恰好 1 个（保留到 13-11）：满足（`UPLOAD_DIRS=1`）。
- 输出经 `redact.mjs --check` 干净，SUMMARY 里没有钥匙、地址、邮箱：满足。

## 与计划的偏差

**1. [格式差异，非服务器问题] `PB_ENV_MODE` 的输出写法**
- **发现于：** Task 3 步骤 9
- **问题：** 计划 Task 3 的自动化核对用 `grep -qx 'PB_ENV_MODE=640'` 逐字匹配，而 `00-status.sh` 实际输出 `PB_ENV_MODE=root:pocketbase 640`（属主属组加权限位）。权限位确实是 640，属主 `root:pocketbase` 正是 D-02 要的（服务账号只读、不能改）。
- **处理：** 没有改服务器，没有改脚本；按语义（权限 640，属主 root:pocketbase）判定通过。如果有人原样复跑计划里的自动化核对，这一行会因为字面不同而判失败，请以本节为准。
- **影响：** 无。

**2. [计划文字与脚本不符，已在确认前告知所有者] 07 不接受上传目录参数**
- 计划正文写“07 加上传目录”，脚本只接受一个开关参数（多一个就退出 2）。按脚本执行 `bash server/07-retire-probe.sh --keep`，命令文件里有注明，所有者在确认前已看到。

除此之外：计划按原样执行。没有认证关卡，没有自动修复，没有第 4 条规则（架构）问题。

## 给后续计划和所有者的交接

- **所有者待办：** 在自己的阿里云网页终端里运行 `sudo cat /etc/usj/pocketbase.env`，把其中 `PB_ENCRYPTION_KEY=` 那一行保存到自己的密码管理器里。Claude 没有读过它，也不会读。弄丢它，已加密的服务器设置就解不开（13-11 的恢复演练和 13-14 会再提醒）。
- **13-11：** 用上面的上传目录 `/tmp/usj-deploy.mOiWUaan` 继续（04、06、05，然后删上传目录）。PocketBase 现在是停的，探针页和探针迁移已经没了；nginx 里的探针位置块（`NGINX_PROBE_INCLUDE=present`）还在，由后面的步骤换成应用的。
- **OPS-02、OPS-03 保持 Pending：** 13-11、13-14、13-15 还要继续完成它们，本计划不勾选。

## Known Stubs

None. 本计划只在服务器上执行批准过的脚本，没有改被跟踪的源文件。

## Threat Flags

无新增攻击面。T-13-38（不可回滚操作在所有者没看一眼时执行）由 Task 2 的即时确认缓解；本次确认记录见顶部。

## Self-Check: PASSED

- `private/deploy-out/SHA256SUMS` 的 sha256 与批准值一致；`test-results/13-10-batch1.txt` 的 sha256 与所有者确认的版本一致。
- 步骤 1–9 的每个退出码和输出都已与该步骤的预期核对。
- 本计划没有任务提交（`commits: 0`，由 `git rev-list --count fe4140c..HEAD` 测得）；本 SUMMARY 作为单独的文档提交。
