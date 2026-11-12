---
phase: 13-deploy-hardening-acceptance
plan: 07
subsystem: server-templates
tags: [nginx, security-headers, access-log, logrotate, site-install, restore-drill, static-check, sec-02, ops-01, ops-03]

requires:
  - phase: 13-deploy-hardening-acceptance
    provides: 13-04 的构建输出（site/、usj-csp.conf、BUILD_VERSION、SHA256SUMS）；13-05 的 trustedProxy.headers=["X-Real-IP"]、备份 cron 和 R2 设置迁移；13-06 的上传目录约定、入口检查、server-check.mjs 的 CHECKS 数组
  - phase: 6-procurement-reachability-probe
    provides: 探针的 nginx 位置块参数（实时连接）、anchor-block.awk、05/06 脚本的结构
provides:
  - deploy/server/nginx/usj-app.conf：server 层指令加 9 个位置块
  - deploy/server/nginx/usj-headers-common.conf、usj-headers-proxy.conf：两套安全响应头
  - deploy/server/nginx/usj-log-format.conf：http 层的 log_format usj（用 $uri，不含查询串）
  - deploy/server/nginx/anchor-block.awk：与 Phase 6 逐字节相同
  - deploy/server/05-nginx-app.sh：挂片段、换探针 include、装 logrotate、ERR 回滚
  - deploy/server/06-install-site.sh：核对后装版本目录、mv -T 原子切换、同一次构建的 CSP 头
  - deploy/server/logrotate/usj-nginx：按天、保留 30 个
  - deploy/server/restore-drill.sh：D-05 的服务器端恢复演练（带“只有测试账号”的机械守卫）
  - deploy/server-check.mjs：C-13..C-22，总计 22 项静态检查、191 条自检
affects: [13-08 README 和构建（SHA256SUMS 必须带上 server/nginx 下 5 个文件、server/logrotate/usj-nginx、server/restore-drill.sh）, 13-09, 13-10, 13-11 执行 05 和 06, 13-13 第一次真正运行恢复演练, 13-15 验收]

actuals:
  tokens: 24400
  tasks: 2
  commits: 2
plan_head_before: 8064255d56a7100cf6c37747af8ca072d79c4c09
plan_head_after: e6fd9b94f8fee4ba1b12f335a7ef634be1e53315

tech-stack:
  added: []
  patterns:
    - "nginx 片段只在 certbot 的 443 块里加一行 include，位置块里每个 add_header 都带 always 并显式 include 头文件（上层 add_header 在位置里有自己的 add_header 时不继承）"
    - "先备份、后挂 trap rollback ERR；写同目录临时文件再 mv -T；EXIT trap 清临时文件；成功才解除 ERR trap 再做不可逆的清理"
    - "会改东西之前先算出“要不要改”，没有要改的就报 already（05、06 重跑安全）"
    - "server-check 把 nginx 配置拆成 server 层行和 location 块（parseConf），按位置块核对 include、IP 头、请求体、日志"
    - "恢复演练的守卫在任何复制、建目录、systemd-run 之前，静态检查按行序证明这个顺序"

key-files:
  created:
    - deploy/server/nginx/usj-app.conf
    - deploy/server/nginx/usj-headers-common.conf
    - deploy/server/nginx/usj-headers-proxy.conf
    - deploy/server/nginx/usj-log-format.conf
    - deploy/server/nginx/anchor-block.awk
    - deploy/server/05-nginx-app.sh
    - deploy/server/06-install-site.sh
    - deploy/server/logrotate/usj-nginx
    - deploy/server/restore-drill.sh
  modified:
    - deploy/server-check.mjs

key-decisions:
  - "兜底 404 位置 `~ ^/` 也 include 通用头文件：这样“每个位置恰好 include 一个头文件”对 9 个位置一律成立，404 响应也带 nosniff、HSTS 等"
  - "05 重跑且没有要改的东西时只跑 nginx -t，输出 NGINX_RELOAD=skipped、CERTBOT_DRY_RUN=skipped、LOGROTATE_DRYRUN=skipped、NGINX_APP=already，不做无谓的 reload 和 certbot 干跑"
  - "logrotate 的 postrotate 写成 if [ -s /run/nginx.pid ]; then kill -USR1 …; fi：pid 文件不在时脚本不返回非 0，不让 logrotate 报错"
  - "恢复演练的临时单元加 InaccessiblePaths=/var/lib/pocketbase、ProtectSystem=strict、ReadWritePaths=演练目录、PrivateTmp、NoNewPrivileges：临时实例即使出错也碰不到线上库"
  - "恢复演练的 DRILL_USERS_MATCH 在 users 表没有 created 列时退化为“恢复库的用户 id 是线上用户 id 的子集”，不因为列缺失而误报"

requirements-completed: [SEC-02, OPS-01, OPS-03]

coverage:
  - id: D1
    description: "nginx 应用配置的 9 个位置块、两套响应头、IP 头、请求体上限、访问日志格式在模板层面成立（不含查询串，没有位置关闭访问日志，HSTS 一天）"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs（C-13 到 C-17 PASS）；--self-test SELF-TEST OK (191 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "05 只挂在 certbot 的 443 块（锚点恰好 1 行，anchor-block.awk 与 Phase 6 逐字节相同并在合成块上判定正确），ERR 回滚、同目录临时文件加 mv -T、探针片段在 certbot 干跑和 logrotate 干跑之后才删，www 跳转有两项只读判断"
    requirement: SEC-02
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs（C-18、C-19 PASS）；对真实 05 的变异（去掉 ERR trap）被 C-19 抓住"
        status: pass
    human_judgment: false
  - id: D3
    description: "06 在核对 SHA256SUMS 和 SDK 哈希之后才装、用 mv -T 原子切换、页面和 CSP 一起换、出错回滚；logrotate 保留 30 个"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs（C-20、C-21 PASS）；对真实 06 的变异（install 放到核对之前）被 C-20 抓住"
        status: pass
    human_judgment: false
  - id: D4
    description: "恢复演练的机械守卫：线上库有测试账号以外的账号或文档就 DRILL_GUARD=refused、非 0 退出、什么都不复制；线上库只以 mode=ro 打开；先关临时实例的 cron 和 SMTP 再列备份；结束后删除"
    requirement: OPS-01
    verification:
      - kind: other
        ref: "node deploy/server-check.mjs（C-22 PASS）；对真实脚本的三种变异（守卫放到 install 之后、停线上单元、线上库去掉 mode=ro）都被抓住；守卫和核对用的 python 在合成 SQLite 库上跑通（干净库 0 0，混入真实账号 1 1，核对输出 DOCS_MISMATCH=0）"
        status: pass
    human_judgment: false
  - id: D5
    description: "模板在真实服务器上的执行结果：nginx -t 与正则位置 ~ ^/ 和 certbot 块里原有 location / 共存（A18）、certbot 干跑、logrotate 干跑、www 跳转的两项判断、恢复接口在 systemd-run 临时单元里重启后保留钥匙（A17）、R2 令牌能写能删（A1）"
    requirement: OPS-01
    verification: []
    human_judgment: true
    rationale: "本计划只写模板、只做本机静态检查，不连服务器；05、06 在 13-11 执行，恢复演练在 13-13 第一次真正运行"

duration: 19min
completed: 2026-11-12
status: complete
---

# Phase 13 Plan 07: nginx 配置、站点安装与恢复演练模板 Summary

**写好了 deploy/server/ 的另一半：nginx 应用位置块加两套安全响应头加不含查询串的访问日志，05 把它挂进 certbot 的 443 块并带 ERR 回滚，06 把页面和 CSP 一起原子切换，restore-drill 在复制任何东西之前先只读检查线上库、有测试账号以外的数据就拒绝运行；22 项静态检查和 191 条自检全部通过，全程没有连服务器。**

## Performance

- **Duration:** 19 min（约 20:14 到 20:33 UTC）
- **Tasks:** 2（1 个 tracer，1 个 auto）
- **Files:** 10（9 个新增，1 个修改）

## Accomplishments

### server-check 的 22 项结果

```
PASS C-01 .. C-12   （13-06 已有，新脚本 05、06、restore-drill 自动被 C-01 到 C-04 覆盖）
PASS C-13 每个 location 恰好 include 两个头文件之一（静态位置 common、反代位置 proxy），= / 另 include usj-csp.conf，反代位置不重复也不覆盖 PocketBase 的头
PASS C-14 三个反代位置都有 X-Real-IP $remote_addr 和 HTTP/1.1；实时位置有关缓冲、3600s、1m；/api/ 是 5m
PASS C-15 日志格式用 $uri、不含查询串；server 层有 access_log，没有位置关闭访问日志
PASS C-16 nginx 文件里每条 add_header 都以 always; 结尾
PASS C-17 HSTS 是 max-age=86400，没有 includeSubDomains、preload
PASS C-18 anchor-block.awk 与 Phase 6 的逐字节相同，合成的 443 ssl 块输出 ANCHOR_BLOCK=443ssl、80 块不输出
PASS C-19 05 有 ERR 回滚、EXIT 清理、同目录临时文件加 mv -T、nginx -t、certbot 干跑、logrotate -d，删探针片段在干跑之后，www 跳转有两项只读判断
PASS C-20 06 的所有 install、ln、mv 都在 SHA256SUMS 和 SDK 哈希核对之后，切换用 mv -T，有 ERR 回滚和 nginx -t
PASS C-21 logrotate：/var/log/usj/*.log 按天、rotate 30、压缩、create 0640 www-data adm、USR1
PASS C-22 restore-drill：时间窗、127.0.0.1:8091、演练目录、RuntimeMaxSec=900、EXIT 清理、线上库只读、守卫在复制之前、先关 cron 和 SMTP 再列备份、输出键都带 DRILL_
SERVER-CHECK OK (22 checks)
```

`--self-test`：`SELF-TEST OK (191 cases)`（13-06 的 78 条加本计划 113 条，每项新检查至少一好一坏）。另外用一次性脚本对真实文件做了变异（05 去掉 ERR trap、06 把 install 放到核对之前、restore-drill 把 install 放到守卫之前、对线上 pocketbase 单元 stop、线上库去掉 mode=ro、实时位置请求体改大、日志格式改回 `$request`），都被相应检查抓住，确认不是空转通过。

### nginx 位置块清单（usj-app.conf，9 个）

| 位置 | 内容 | 头文件 |
|------|------|--------|
| `= /` | `root /var/www/usj/site; try_files /index.html =404;`、页面 CSP（include usj-csp.conf）、no-cache、gzip | common |
| `= /sw.js` | 最小 CSP（`default-src 'none'; connect-src 'self'`）、no-cache | common |
| `= /manifest.webmanifest` | `types { application/manifest+json webmanifest; }`、`default_type`、no-cache | common |
| `^~ /vendor/` | no-cache | common |
| `^~ /icons/` | `public, max-age=3600` | common |
| `= /api/realtime` | 反代 8090、HTTP/1.1、Connection 置空、关缓冲和缓存、关 gzip、读写超时 3600s、请求体 1m | proxy |
| `^~ /api/` | 反代、请求体 5m、读超时 60s、gzip json | proxy |
| `^~ /_/` | 反代、读超时 60s（PocketBase 自己发 CSP 等） | proxy |
| `~ ^/` | 其余路径一律 404 | common |

server 层：`access_log /var/log/usj/access.log usj;`、`server_tokens off;`、`include snippets/usj-www-redirect.conf;`。每个反代位置都 `proxy_set_header X-Real-IP $remote_addr`（覆盖客户端自带的同名头，与 13-05 的 trustedProxy.headers 一致）。没有任何位置关闭访问日志。

响应头：common 7 条（nosniff、Referrer-Policy、Permissions-Policy、X-Robots-Tag、HSTS `max-age=86400`、COOP same-origin、X-Frame-Options DENY），proxy 4 条（X-Robots-Tag、Referrer-Policy、Permissions-Policy、HSTS），全部带 always。

### 05-nginx-app.sh 的流程

入口检查（SHA256SUMS 核对 6 个文件）→ 只读前置（csp 片段和站点首页在、nginx.conf 的 http 块 include 了 conf.d、锚点恰好 1 行、anchor-block.awk 输出 `ANCHOR_BLOCK=443ssl`、www 两项判断）→ 本机临时目录里算出目标内容并判断要不要改（没有要改的：只跑 nginx -t，输出 `NGINX_APP=already`）→ 备份到 `/etc/nginx/usj-backup/<UTC 时间戳>/`（记下原本不存在的文件）→ `trap rollback ERR` → 建 `/var/log/usj`（root:adm 0750）、装日志格式、三个片段、logrotate 文件、生成 www 跳转片段 → 站点文件写到同目录临时文件，核对应用 include 恰好 1 行、探针 include 0 行，`mv -T` 替换 → `nginx -t` → reload → `certbot renew --dry-run` → `logrotate -d` → `trap - ERR` → 删探针片段。任何一步失败都恢复备份、删掉原本不存在的新文件、`nginx -t` 通过才 reload。

www 跳转：锚点行的 `server_name` 里同时有裸域名和 `www.<裸域名>`，并且 `getent ahosts www.<裸域名>` 有结果，才写入 `if ($host ~* ^www\.(.+)$) { return 301 https://$1$request_uri; }`（正则捕获，没有字面主机名）；否则片段里只有一行注释，输出 `WWW_REDIRECT=skipped`（13-11 执行后要把这个结果写进 SUMMARY，检查修订 1 的 info 项）。

### 06-install-site.sh 的流程

核对 `site/` 开头的所有文件、`usj-csp.conf`、`BUILD_VERSION`（12 位十六进制），再按 `site/vendor/SHA256SUMS` 核对 SDK → 装到 `/var/www/usj/releases/<版本>/`（同版本目录内容一致就跳过）→ 备份旧符号链接指向和旧 CSP → `trap rollback ERR` → 装新 CSP → `ln -sfn` 加 `mv -T` 原子切换 → 站点文件里已经有应用 include 才 `nginx -t` 加 reload → 解除 trap，只保留最近 3 个版本目录。输出 `SITE_VERSION`、`SITE_FILES`、`SITE_SWAP=done|already`、`CSP_CONF=installed|same`、`NGINX_RELOAD=done|skipped`。不删上传目录（13-11 最后一步删）。

### restore-drill 的输出键和每一步的风险控制

| 步骤 | 输出键 | 风险控制 |
|------|--------|----------|
| 1 时间窗 | `DRILL_WINDOW_OK=yes\|no` | 18:40–19:20 UTC 拒绝运行，避开 19:00 的自动备份（T-13-21） |
| 2 前置（只读） | - | 线上健康检查 200、演练目录不存在、usj-drill 不在运行、8091 空闲、环境文件在 |
| 2.5 守卫 | `DRILL_GUARD=ok\|refused` | 在任何复制、建目录、systemd-run 之前，以 pocketbase 用户 `mode=ro` 数非测试账号和非测试账号的文档；任一大于 0 或读不出来就非 0 退出，什么都没复制（T-13-40） |
| 3 EXIT trap | `DRILL_CLEANUP=done\|incomplete` | 无论成败，停 usj-drill、reset-failed、删演练目录（T-13-23） |
| 4 副本 | - | SQLite 备份接口从线上库只读连接复制一致副本；只在副本里关 mfa、otp、authAlert |
| 5-7 临时实例和登录 | - | 临时超级用户口令只在变量里，JSON 经标准输入，令牌写 0600 头文件；`RuntimeMaxSec=900`、`MemoryMax=300M`、不加载钩子、临时单元看不到线上数据目录 |
| 8 隔离 | `DRILL_TEMP_ISOLATED=yes` | PATCH 把 backups.cron 置空、smtp.enabled 置假，再读回确认；在列备份之前（T-13-21） |
| 9 列备份 | `DRILL_AUTO_BACKUPS`、`DRILL_NEWEST_AGE_H` | 0 个自动备份就失败 |
| 10 R2 写删 | `DRILL_R2_WRITE=ok`、`DRILL_R2_DELETE=ok` | `drill_` 前缀不带自动前缀，不被保留数清理；删不掉就失败（证明令牌没有删除权限，A1） |
| 11 恢复 | `DRILL_RESTORE=ok` | 官方恢复接口，key 的 `@` 编码成 `%40`，等 60 秒健康检查，随即停临时实例 |
| 12 核对 | `DRILL_INTEGRITY`、`DRILL_RESTORED_TEST_ONLY`、`DRILL_USERS_MATCH`、`DRILL_DOCS`、`DRILL_DOCS_COMPARED`、`DRILL_DOCS_MISMATCH`、`DRILL_DOCS_CHANGED_SINCE`、`DRILL_USERS_WITH_BOTH_DOCS` | 两边都 `mode=ro`；恢复库也必须只含测试账号；备份后没再改过的每份文档的 sha256 与线上一致 |
| 13 | `DRILL_RESULT=PASS\|FAIL` | 最后一行；任何一步失败都是 FAIL 并以 1 退出 |

线上实例和线上库只读、从不停止：脚本里没有对 `pocketbase` 单元的 stop、start、restart、disable，线上库只以 `mode=ro` 打开（C-22 逐项核对）。

## Task Commits

1. **Task 1（tracer）：nginx 应用配置、响应头、日志格式、05 和 C-13..C-19** - `0e248d6`（feat）
2. **Task 2：06、logrotate、restore-drill 和 C-20..C-22** - `e6fd9b9`（feat）

**计划元数据：** 见本 SUMMARY 之后的 docs 提交。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 一致性] 兜底 404 位置也 include 通用头文件**
- **Found during:** Task 1
- **Issue:** 计划要求“每个 location 恰好 include 两个头文件之一”，但最后的 `~ ^/` 只写 `return 404`，会让 C-13 要么对它开例外要么不成立。
- **Fix:** 404 位置也 include `usj-headers-common.conf`，C-13 对 9 个位置一视同仁；顺带让 404 响应也带 nosniff 和 HSTS。
- **Files modified:** deploy/server/nginx/usj-app.conf
- **Committed in:** 0e248d6

**2. [Rule 2 - 重跑安全] 05 在没有要改的东西时不做 reload 和 certbot 干跑**
- **Found during:** Task 1
- **Issue:** 计划写重跑“输出 NGINX_APP=already（照样跑 nginx -t）”，但没有说明 reload、certbot 干跑和 logrotate 干跑怎么处理。
- **Fix:** 先在本机临时目录算出每个目标文件的内容并与现状比较；全部相同（含探针片段已不存在）就只跑 `nginx -t`，其余键输出 `skipped`，`NGINX_APP=already`。
- **Files modified:** deploy/server/05-nginx-app.sh
- **Committed in:** 0e248d6

**3. [Rule 2 - 失败安全] 05 和 06 加 `set -E`，rollback 先解除 ERR trap 并有幂等标志**
- **Found during:** Task 1、Task 2
- **Issue:** bash 里 ERR trap 默认不被函数和命令替换继承；rollback 自己出错会递归；显式失败路径（fail）与 ERR trap 可能回滚两次。
- **Fix:** `set -E`；rollback 第一行 `trap - ERR`，并用 `ROLLED_BACK` 标志保证只回滚一次；`fail()` 先回滚再 `exit 1`。
- **Files modified:** deploy/server/05-nginx-app.sh、deploy/server/06-install-site.sh
- **Committed in:** 0e248d6、e6fd9b9

**4. [Rule 2 - 失败安全] logrotate 的 postrotate 用 if 而不是 `[ … ] && kill`**
- **Found during:** Task 2
- **Issue:** RESEARCH 的写法在 nginx 的 pid 文件不存在时让 postrotate 脚本返回非 0，logrotate 会报错。
- **Fix:** `if [ -s /run/nginx.pid ]; then kill -USR1 "$(cat /run/nginx.pid)"; fi`；C-21 仍核对 `kill -USR1`。
- **Files modified:** deploy/server/logrotate/usj-nginx
- **Committed in:** e6fd9b9

**5. [Rule 2 - 隔离加固] 恢复演练的临时单元看不到线上数据目录**
- **Found during:** Task 2
- **Issue:** 计划已经限制了临时实例的内存和时长，但临时实例带着线上的钥匙和 R2 设置，如果启动参数写错，理论上能打开线上库。
- **Fix:** `systemd-run` 加 `InaccessiblePaths=/var/lib/pocketbase`、`ProtectSystem=strict`、`ReadWritePaths=<演练目录>`、`PrivateTmp`、`NoNewPrivileges`；演练目录 `/var/lib/pocketbase-drill` 不在被屏蔽的路径下。这些属性在 13-13 第一次真正运行时才能验证，失败时演练输出 FAIL，线上不受影响。
- **Files modified:** deploy/server/restore-drill.sh
- **Committed in:** e6fd9b9

**6. [Rule 2 - 稳健] 06 对真目录、同版本不同内容、不安全路径的拒绝**
- **Found during:** Task 2
- **Issue:** 计划没有写这三种异常：`/var/www/usj/site` 是真目录时 `mv -T` 链接会失败；同一版本号不应出现不同内容；SHA256SUMS 里的路径来自上传包。
- **Fix:** 改动之前就拒绝（退出 1）：site 是真目录；正在使用的版本目录内容与上传的不一致；站点文件路径含 `..` 或不安全字符；必需文件（index.html、sw.js、manifest、SDK 和它的 SHA256SUMS）缺一不可。
- **Files modified:** deploy/server/06-install-site.sh
- **Committed in:** e6fd9b9

**7. [Rule 2 - 稳健] DRILL_USERS_MATCH 在 users 表没有 created 列时的退化**
- **Found during:** Task 2
- **Issue:** 计划按“线上创建时间不晚于备份时间”过滤用户，但我无法在本机确认 PocketBase 的 users 集合一定有 created 列（journey_docs 有，迁移里明确写了）。
- **Fix:** 读 `PRAGMA table_info(users)`：有 created 列就按计划比较两个 id 集合相等；没有就比较“恢复库的用户 id 是线上用户 id 的子集”，不因为列缺失而误报。13-13 第一次运行时如果走了退化分支，要在报告里写明。
- **Files modified:** deploy/server/restore-drill.sh
- **Committed in:** e6fd9b9

---

**Total deviations:** 7 auto-fixed（都是 Rule 2，加固或补全，没有加范围、没有改任何输出键或计划要求的行为）
**Impact on plan:** 没有改变计划的输出键清单、文件清单或检查编号；只是让“重跑 already”“失败不留残局”“守卫先于复制”在脚本里真的成立。

## Issues Encountered

- 无阻塞问题。`awk` 在 Git 自带的 bash 里可用，C-18 因此能在本机用 Phase 6 的 anchor-block.awk 判定合成块。守卫和核对用的 python 在本机无法连真实库，所以我把三个 heredoc 提取出来，在合成的 SQLite 库上改路径后实际运行：干净库守卫输出 `0 0`，混入一个真实账号加一份文档后输出 `1 1`；核对输出 `DRILL_INTEGRITY=ok`、`DRILL_RESTORED_TEST_ONLY=yes`、`DRILL_USERS_MATCH=yes`、`DRILL_DOCS_MISMATCH=0`、`DRILL_USERS_WITH_BOTH_DOCS=2`。
- 没有连接服务器、没有 ssh、curl 或任何外部请求；没有读 `private/`；没有启动 Playwright 或 PocketBase；没有遗留 `pocketbase.exe`、`msedge.exe`、`find.exe` 子进程。

## Known Stubs

无。

## Threat Flags

无新增攻击面：本计划只新增将在 13-11、13-13 经所有者批准后才执行的模板和只读的本机检查。计划的威胁登记本机证据：T-13-19（日志不含令牌）是 C-15；T-13-20（配置出错导致全站不可用）是 C-19 的回滚顺序；T-13-21（演练往 R2 写自动备份或发邮件）是 C-22 的 PATCH 先于列备份、时间窗、RuntimeMaxSec；T-13-22（请求体上限）是 C-14 的 5m；T-13-40（演练读到真实数据）是 C-22 的守卫先于复制；T-13-23（演练留下副本）是 C-22 的 EXIT 清理；T-13-SC 本计划不安装任何东西。

## User Setup Required

None - 本计划没有任何外部服务配置。

## Next Phase Readiness

- **13-08（构建和 README）：** 构建输出的 `SHA256SUMS` 必须包含 `server/nginx/usj-app.conf`、`usj-headers-common.conf`、`usj-headers-proxy.conf`、`usj-log-format.conf`、`anchor-block.awk`，`server/logrotate/usj-nginx`，以及 `server/restore-drill.sh`（03 的入口检查要它）；05 和 06 自己不被 SHA256SUMS 核对（它们是被执行的，不是被读取的），所有者批准的是脚本内容。README 要写：HSTS 先用一天，验收通过并见过一次真实续期后再提高；nginx 错误日志按包默认保留约 14 天（访问日志 30 天，IN-07）；`WWW_REDIRECT=skipped` 的含义。
- **13-11（执行 05、06）：** 先 06 后 05（05 的前置要求 csp 片段和站点首页已装好）；05 的输出里要记下 `WWW_REDIRECT=on|skipped`。
- **13-13（恢复演练）：** 只有测试账号的数据才许演练；第一次运行才能验证 A17（restore 在 systemd-run 的临时单元里重启后仍保留钥匙）、A1（R2 令牌能写能删）、`InaccessiblePaths` 不影响临时实例、users 表有没有 created 列（走哪个分支）。守卫拒绝时的处理由 13-13 决定。
- **假设 A18**（正则位置 `~ ^/` 与 certbot 块里原有 `location /` 共存不报重名）由 05 里的 `nginx -t` 在服务器上第一次核对，失败会自动回滚。

---
*Phase: 13-deploy-hardening-acceptance*
*Completed: 2026-11-12*

## Self-Check: PASSED

- FOUND: deploy/server/nginx/usj-app.conf、usj-headers-common.conf、usj-headers-proxy.conf、usj-log-format.conf、anchor-block.awk；deploy/server/05-nginx-app.sh、06-install-site.sh、restore-drill.sh；deploy/server/logrotate/usj-nginx；deploy/server-check.mjs
- FOUND: commits 0e248d6、e6fd9b9（都在 HEAD 的祖先里）；`git rev-list --count` 实测 2
- 两个任务的验收命令全部通过；`node deploy/server-check.mjs` 最后一行 `SERVER-CHECK OK (22 checks)`；`--self-test` 最后一行 `SELF-TEST OK (191 cases)`；`cmp` 确认 anchor-block.awk 与 Phase 6 相同；隐私检查通过；新文件里除 127.0.0.1 外没有 IP 地址，没有域名
