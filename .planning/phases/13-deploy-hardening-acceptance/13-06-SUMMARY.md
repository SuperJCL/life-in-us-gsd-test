---
phase: 13-deploy-hardening-acceptance
plan: 06
subsystem: server-templates
tags: [pocketbase, systemd, encryption-key, deploy-scripts, static-check, ops-02, ops-03]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-05 的服务器设置迁移、探针清理迁移、备份看门狗钩子、钥匙轮换步骤和 X-Real-IP 头名
  - phase: 6-procurement-reachability-probe
    provides: tools/probe/server/ 下的探针脚本和 unit（本计划逐个改造）
provides:
  - deploy/server/pocketbase.service：应用站点的 unit（EnvironmentFile、迁移和钩子目录、automigrate 关、加密钥匙、CORS 源）
  - deploy/server/03-configure-pocketbase.sh、04-start-pocketbase.sh、pb-admin.sh：PocketBase 启动链
  - deploy/server/00-status.sh、01-swap.sh、02-install-pocketbase.sh、07-retire-probe.sh
  - deploy/server-check.mjs：C-01..C-12 的本机静态检查，加 78 条自检
affects: [13-07 nginx 与站点安装与恢复演练（沿用同一个入口检查和 server-check.mjs 的检查清单）, 13-08 README 和构建（上传包布局）, 13-09 清空或保留的决定, 13-10, 13-11, 13-12, 13-13]

actuals:
  tokens: 20000
  tasks: 2
  commits: 2
plan_head_before: 63566fb12f0d0d403c2e3d2288473fa544fa7827
plan_head_after: e954799a961e4a5621ae69e448193571e3445167

tech-stack:
  added: []
  patterns:
    - "上传目录是第一个参数 /tmp/usj-deploy.<随机>：入口检查格式、属主、权限 700、SHA256SUMS 恰好一行，再 sha256sum -c --strict"
    - "钥匙只在变量里：生成、长度检查、经 printf 管道交给 tee、unset；环境文件先写临时文件再 mv -T，不留写到一半的文件"
    - "会改东西之前先算出“要不要改”，没有要改的就报 already，所以重跑在服务运行时也安全"
    - "server-check 用纯函数检查加合成好坏片段自检；CHECKS 数组可由 13-07 继续追加"

key-files:
  created:
    - deploy/server/pocketbase.service
    - deploy/server/03-configure-pocketbase.sh
    - deploy/server/04-start-pocketbase.sh
    - deploy/server/pb-admin.sh
    - deploy/server/00-status.sh
    - deploy/server/01-swap.sh
    - deploy/server/02-install-pocketbase.sh
    - deploy/server/07-retire-probe.sh
    - deploy/server-check.mjs
  modified: []

key-decisions:
  - "03 在“没有任何东西要改”时不要求服务停着：先算 NEED_CHANGE，要改而服务在运行才拒绝；这样重跑 03 输出 already（OPS-03 adjacency）"
  - "02 的解压后 --version 带 --dir 指向临时目录，避免对着二进制旁边建 pb_data"
  - "07 的 --wipe 守卫在停服务前后各跑一次，库读不出来也拒绝"
  - "04 里 PB_SETTINGS_ENCRYPTED=no 只是报告，不当作失败（由 13-10 对照 13-05 的迁移结果判断）"

requirements-completed: [OPS-02, OPS-03]

coverage:
  - id: D1
    description: "PocketBase 启动链模板（unit、03、04、pb-admin）彼此一致：同一组 --dir、--migrationsDir、--hooksDir、--automigrate=false、--encryptionEnv，同一个环境文件路径；钥匙只在服务器上生成且从不打印"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs (SERVER-CHECK OK (12 checks)，其中 C-04 到 C-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phase 6 遗留缺陷的修法在位：WR-07（fstab 先于 already）、WR-08（restart 加失败 disable --now）、IN-09（上传目录取自第一个参数并核对 SHA256SUMS）、IN-11（先对解压出的程序跑 --version）"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs C-04、C-07、C-09、C-10 PASS；--self-test SELF-TEST OK (78 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "07 的 --wipe 守卫、00-status 只读、02 的钉死 sha256 与 Phase 6 相同"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs C-10、C-11、C-12 PASS"
        status: pass
    human_judgment: false
  - id: D4
    description: "模板在真实服务器上的执行结果：重启后开机自恢复（enabled、Restart=always、fstab 的 swap）、重跑 already、钥匙真的不出现在日志里"
    requirement: OPS-02
    verification: []
    human_judgment: true
    rationale: "本计划只写模板、只做本机静态检查，不连服务器；真实执行在 13-10、13-11，重启验证在 13-12"

duration: 8min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 06: PocketBase 一侧的服务器模板与本机静态检查 Summary

**把 Phase 6 的探针脚本改成 deploy/server/ 下的正式模板（环境文件加密钥匙、迁移和钩子目录、restart 加失败 disable --now、重跑 already、清空有守卫），用 deploy/server-check.mjs 的 12 项静态检查和 78 条自检核对它们彼此一致，全程不连服务器。**

## Performance

- **Duration:** 8 min（20:04 到 20:12 UTC）
- **Tasks:** 2（1 个 tracer，1 个 auto）
- **Files:** 9（全部新增）

## Accomplishments

- **unit：** `Description=PocketBase (计划手记)`，`EnvironmentFile=/etc/usj/pocketbase.env`，ExecStart 一行带 `--migrationsDir`、`--hooksDir`、`--hooksWatch=false`、`--hooksPool=3`、`--automigrate=false`、`--encryptionEnv=PB_ENCRYPTION_KEY`、`--origins=${USJ_ORIGIN}`；沙箱项、`Restart=always`、`MemoryHigh/MemoryMax`、`GOMEMLIMIT=256MiB` 原样保留；没有写着密钥值的 `Environment=` 行。
- **03：** 入口检查 → 前置只读检查 → 才改动。站点地址从 certbot 管理的那一行取不带 `www.` 的名字，取不到就退出 1；钥匙用 `openssl rand -hex 16` 生成、核对长度、经管道交给 `tee` 写进临时文件、核对后 `mv -T`，已有环境文件只核对不覆盖；迁移、钩子同名不同内容退出 1。
- **04：** 前置全部只读（二进制、data.db、超级用户、环境文件、4 个迁移、钩子），unit 内容不同才装并 `daemon-reload`，`enable` 加 `restart`；30 秒健康检查、只绑回环、`is-enabled`；任何一项失败都 `disable --now`，日志里令牌形状、安装链接和主机名换成占位。
- **pb-admin.sh：** 只许 pocketbase 用户，读环境文件里的钥匙并核对长度，以和 unit 相同的参数 `exec`；头注释如实写明口令会在命令执行的瞬间出现在进程参数里（IN-06）。
- **00-status：** 只读 KEY=VALUE，含新增的 `UPTIME_S`、`SWAP_FSTAB`、`NGINX_CONFD_INCLUDED`、`NGINX_SERVER_ADD_HEADER`、`PB_ENV_*`、`DB_SU_OTP/MFA`、`DB_SETTINGS_ENCRYPTED`、`DB_USERS_NONTEST`、`DB_DOCS_NONTEST`、`SITE_VERSION`、`UPLOAD_DIRS` 等，最后一行 `STATUS_DONE=1`。
- **01/02/07：** 01 把 fstab 补写挪到 already 之前；02 先对解压出的程序跑 `--version` 再 install，already 路径仍核对 zip 的 sha256 和程序与 zip 里成员字节相同；07 的 `--wipe` 有守卫，`--keep` 保留库。

### server-check 的 12 项结果

```
PASS C-01 每个 deploy/server/*.sh 都通过 bash -n
PASS C-02 首行 #!/usr/bin/env bash、有 set -euo pipefail、没有开启命令回显
PASS C-03 头注释都有“输出”和“回滚”
PASS C-04 读上传文件的脚本从 $1 取 usj-deploy. 目录并对 SHA256SUMS 跑 sha256sum -c，没有写死的 Phase 6 上传目录
PASS C-05 unit 与 pb-admin.sh 的 --dir、--migrationsDir、--hooksDir、--automigrate=false、--encryptionEnv 逐项相同，环境文件路径一致
PASS C-06 unit 有 Restart=always、User=pocketbase、MemoryMax=，除 GOMEMLIMIT 外没有别的 Environment= 行
PASS C-07 04 有 systemctl restart，失败路径有 disable --now
PASS C-08 03 用 openssl rand -hex 16 生成钥匙、核对长度 32，钥匙不进 echo 和别的命令参数
PASS C-09 01 补写 fstab 的位置在 SWAP=already 之前（WR-07）
PASS C-10 02 在 install 之前对解压出的程序跑 --version（IN-11），两个钉死的 sha256 与 Phase 6 的相同
PASS C-11 07 的 --wipe 在 rm -rf 之前有非探针数据守卫，邮箱正则与清理迁移里的相同
PASS C-12 00-status 只读（没有改动命令），最后一个 kv 是 STATUS_DONE
SERVER-CHECK OK (12 checks)
```

`--self-test`：`SELF-TEST OK (78 cases)`（每项检查至少一好一坏）。

### 各脚本的输出键清单

| 脚本 | 输出键 |
|------|--------|
| 00-status.sh | SUDO_NOPASSWD、OS、UPTIME_S、MEM_TOTAL_MB、MEM_AVAILABLE_MB、SWAP_TOTAL_MB、SWAPFILE_ACTIVE、SWAP_FSTAB、NGINX_ACTIVE、NGINX_ENABLED、CERTBOT_TIMER、CERTBOT_TIMER_ENABLED、NGINX_TEST、NGINX_CONFD_INCLUDED、NGINX_ANCHOR_COUNT、NGINX_SERVER_ADD_HEADER、NGINX_PROBE_INCLUDE、NGINX_APP_INCLUDE、NGINX_LOG_FORMAT、LOGROTATE_USJ、PB_USER、PB_BINARY_VERSION、PB_SERVICE_ACTIVE、PB_SERVICE_ENABLED、PB_HEALTH、PB_LISTEN_LOOPBACK_ONLY、PB_ENV_FILE、PB_ENV_MODE、PB_KEY_LEN_OK、PB_ORIGIN_SET、PB_MIGRATIONS_APP、PB_MIGRATIONS_PROBE、PB_HOOKS、DRILL_DIR、PB_ADMIN_TOOL、DRILL_TOOL、DRILL_UNIT、PB_RSS_MB、SITE_VERSION、SITE_FILES、PROBE_PAGE_DIR、UPLOAD_DIRS、DB、DB_COLLECTIONS_PROBE、DB_SUPERUSERS_COUNT、DB_USERS_COUNT、DB_DOCS_COUNT、DB_USERS_NONTEST、DB_DOCS_NONTEST、DB_SU_OTP、DB_SU_MFA、DB_SETTINGS_ENCRYPTED、STATUS_DONE |
| 01-swap.sh | SWAP_FSTAB=present\|added、SWAP=created\|already、SWAP_TOTAL_MB |
| 02-install-pocketbase.sh | 安装：PB_SHA256_PINNED_MATCH、PB_SHA256_CHECKSUMS_MATCH、PB_INSTALL=done、PB_BINARY_VERSION；already：PB_ZIP_SHA256_MATCH、PB_BINARY_MATCHES_ZIP、PB_INSTALL=already、PB_BINARY_VERSION |
| 03-configure-pocketbase.sh | PB_ENV_FILE=created\|kept、PB_KEY_LEN_OK=yes、PB_ORIGIN_SET=yes、PB_MIGRATIONS_APP=4、PB_HOOKS=1、PB_ADMIN_TOOL=installed\|same、DRILL_TOOL=installed\|same、PB_CONFIGURE=done\|already |
| 04-start-pocketbase.sh | PB_UNIT=updated\|same、PB_START=done、PB_SERVICE_ENABLED=enabled、PB_LISTEN_LOOPBACK_ONLY=yes、PB_SETTINGS_ENCRYPTED=yes\|no、PB_RSS_MB、MEM_AVAILABLE_MB |
| 07-retire-probe.sh | PB_SERVICE_ACTIVE=inactive、PROBE_MIGRATIONS_REMOVED、PROBE_PAGE=removed\|absent、PB_DATA=wiped\|kept、PROBE_RETIRE=done\|already |

### 上传目录的约定（13-07、13-08、13-10、13-11 照此）

- 上传目录是 `/tmp/usj-deploy.<随机>`，由 `mktemp -d` 建（0700，属于当前用户），**第一个参数**传给读上传文件的脚本（03、04，13-07 的 05、06 同样）。
- 入口检查：格式匹配 `^/tmp/usj-deploy\.[A-Za-z0-9]+$`、不是符号链接、属主是当前用户、权限 700、有 `SHA256SUMS`；脚本自己要读的每个文件在 SHA256SUMS 里恰好一行（两个空格和 ` *` 两种分隔都接受），并在上传目录里 `sha256sum -c --strict` 通过，之后才做任何改动。
- 03 读：`pb_migrations/` 下 4 个文件（`1794096000_users_lockdown.js`、`1794096100_journey_docs.js`、`1794096150_retire_probe.js`、`1794096200_server_settings.js`）、`pb_hooks/backup-watch.pb.js`、`server/pb-admin.sh`、`server/restore-drill.sh`；04 读：`server/pocketbase.service`。
- 不读上传文件的脚本：00（经标准输入）、01、02（下载）、07、pb-admin.sh。

## Task Commits

1. **Task 1（tracer）：启动链模板和 server-check C-01..C-08** - `2ed9d51`（feat）
2. **Task 2：00-status、01-swap、02-install、07-retire-probe 和 C-09..C-12** - `e954799`（feat）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 重跑安全] 03 只在“要改东西”时才要求服务停着**
- **Found during:** Task 1
- **Issue:** 计划写“PocketBase 服务不在运行”为入口检查；但 truths 又要求重跑输出 already。照字面写，服务在运行时重跑 03 会被拒绝，输出不了 already。
- **Fix:** 前置阶段先算出是否有东西要改（环境文件缺、迁移或钩子缺、工具缺或不同、目录缺）；要改而服务在运行才退出 1，什么都不用改时照常输出 `PB_CONFIGURE=already`。
- **Files modified:** deploy/server/03-configure-pocketbase.sh
- **Verification:** `bash -n` 通过；C-01..C-08 通过（未在服务器上执行）
- **Committed in:** 2ed9d51

**2. [Rule 2 - 失败安全] 环境文件先写临时文件再换名**
- **Found during:** Task 1
- **Issue:** 计划是先 `install /dev/null` 再 `tee` 写。`tee` 中途失败会留下空的或写一半的环境文件，下次重跑会因钥匙缺失而退出，需要人工清理。
- **Fix:** 写到 `/etc/usj/pocketbase.env.new`，核对钥匙行数和长度后 `mv -T` 换名，核对失败就删掉临时文件；最终文件要么不存在要么完整。
- **Files modified:** deploy/server/03-configure-pocketbase.sh
- **Committed in:** 2ed9d51

**3. [Rule 2 - 失败安全] 07 的守卫在 rm -rf 之前再数一次**
- **Found during:** Task 2
- **Issue:** 计划只在前置阶段数一次。停服务之前到 `rm -rf` 之间库里理论上还可能写入。
- **Fix:** 停服务之后、`rm -rf` 之前再调用一次同一个守卫；读不出来的情况也按有数据处理（拒绝）。
- **Files modified:** deploy/server/07-retire-probe.sh
- **Committed in:** e954799

**4. [Rule 2 - 失败安全] 02 解压后的 --version 带 --dir 指向临时目录**
- **Found during:** Task 2
- **Issue:** 在 `mktemp` 目录里直接运行解压出的程序，PocketBase 可能在二进制旁边建 `pb_data`。
- **Fix:** 加 `--dir="$T/data"`，目录随 `trap` 一起删除。
- **Files modified:** deploy/server/02-install-pocketbase.sh
- **Committed in:** e954799

---

**Total deviations:** 4 auto-fixed（都是 Rule 2，加固，没有加范围）
**Impact on plan:** 没有改变任何输出键或计划要求的行为，只是让“重跑 already”和“失败不留残局”在脚本里真的成立。

## Issues Encountered

- 无阻塞问题。`bash -n` 用 Git 自带的 bash（经 `git --exec-path` 推出路径），首次运行 `--self-test` 和真实检查都一次通过；我另外用一次性脚本对真实文件做了变异（加重定向、去掉守卫、改 sha256、让钥匙进 echo、去掉 sha256sum -c），都被相应检查抓住，确认不是空转通过。
- 没有启动 Playwright、PocketBase 或任何长时间进程，结束后没有遗留的 `pocketbase.exe`、`msedge.exe` 或 `find.exe`。

## Known Stubs

无。

## Threat Flags

无新增攻击面：本计划只新增将在 13-10、13-11 经所有者批准后才执行的模板和只读的本机检查脚本，计划的威胁登记 T-13-14 到 T-13-18 和 T-13-SC 已覆盖。本机证据：T-13-14（钥匙不外泄）是 C-08；T-13-15（上传文件被换）是 C-04 和每个脚本的入口 `sha256sum -c`；T-13-16（误清空）是 C-11；T-13-17（钥匙丢失起不来）是 04 的启动前核对和 03 的“从不覆盖钥匙”；T-13-18（模板里的域名）是 03 从证书块读站点地址加隐私检查通过；T-13-SC 是 02 钉死的两个 sha256 和 already 路径的核对（C-10）。

## User Setup Required

None - 本计划没有任何外部服务配置。钥匙由 03 在服务器上生成；所有者在 13-11 的检查点用网页终端自己读一次并存进密码管理器。

## Next Phase Readiness

- 13-07 的 05、06 沿用同一个入口检查（把 03/04 里的 `UP` 一段原样复制）；`restore-drill.sh` 必须在 13-08 的构建里进入 SHA256SUMS（路径 `server/restore-drill.sh`），否则 03 的入口检查会在改动之前退出 1。
- 13-07 往 `deploy/server-check.mjs` 的 `CHECKS` 数组继续追加（C-13 起）；本文件的 `loadContext` 已经把 `deploy/server/` 下所有 `.sh` 读进 `ctx.sh`，C-01 到 C-03 会自动覆盖新脚本。
- 13-09 的批准说明要点：07 的 `--wipe`（不可回滚，守卫挡住非探针数据）与 `--keep`（依赖 03 一起装的 `1794096150_retire_probe.js`）二选一；`00-status.sh` 的 `NGINX_SERVER_ADD_HEADER` 由 13-09 只读运行后告诉所有者。
- 假设（RESEARCH A7、本计划的 `--version` 假设）要在 13-10 才能验证：`--hooksPool=3` 的实际 RSS；`--version` 不需要钥匙。后者不成立时，02 的 already 路径改用 `pb-admin.sh --version`，到时停下重新请批准。
- 02 的 already 路径依赖 `/opt/pocketbase/dist/` 里保留着 Phase 6 的 zip；如果服务器上没有那个 zip，02 会退出 1，到时由所有者决定是否允许它重新下载核对。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/server/pocketbase.service、00-status.sh、01-swap.sh、02-install-pocketbase.sh、03-configure-pocketbase.sh、04-start-pocketbase.sh、07-retire-probe.sh、pb-admin.sh，以及 deploy/server-check.mjs
- FOUND: commits 2ed9d51、e954799（都在 HEAD 的祖先里）；`git rev-list --count` 实测 2
- 两个任务的验收命令全部通过；`node deploy/server-check.mjs` 最后一行 `SERVER-CHECK OK (12 checks)`；`--self-test` 最后一行 `SELF-TEST OK (78 cases)`；`deploy/server/` 里没有 `usj-probe-upload`；隐私检查通过
