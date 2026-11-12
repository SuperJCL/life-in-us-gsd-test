# 部署运行手册

## 1. 用途和边界

这里是「计划手记」线上站点的部署模板、构建脚本和检查脚本，以及照着做的运行手册：把应用页面、PocketBase 和 nginx 配置装到所有者自己的阿里云香港轻量服务器上，之后升级、回滚、备份、恢复。

- 服务器、域名、邮箱、R2 账号都是所有者本人购买和注册的。**Claude 不代为注册、付款，也从不输入或读取**口令、SMTP 授权码、超级用户邮箱、R2 密钥和加密钥匙；这些都由所有者本人在阿里云网页终端或 PocketBase 后台里输入。
- 本目录只有模板和占位。真实的域名、IP、邮箱、钥匙只存在于所有者的服务器和本机被忽略的 `private/` 目录里，不进仓库。
- 服务器沿用 Phase 6 装好的那一台（swap、PocketBase 0.41.1 二进制和 `pocketbase` 用户、nginx、certbot 都保留）；应用的 Claude Artifact 原件始终不动。
- 会改动服务器的步骤一律走第 5 节的批准流程；只读的 `00-status.sh` 例外（它不存到服务器上）。

## 2. 隐私约定

- 文档和脚本里只写占位：`<domain>`、`192.0.2.x`、`$EM`、`$PW`、`<account-id>`。服务器地址在服务器上从 certbot 管理的那一行读出，不写进任何被跟踪的文件。
- 钥匙（`PB_ENCRYPTION_KEY`）只在服务器上生成，存在 `/etc/usj/pocketbase.env`，从不打印；邮箱授权码和 R2 令牌只填在 PocketBase 后台里，由 PocketBase 用这把钥匙加密保存。
- 本机构建输出写 `private/deploy-out/`，验收用的大文件写 `private/acceptance/`，都被 git 忽略，不提交。
- 线上检查和服务器输出一律经 `node tools/privacy/redact.mjs` 过滤再看、再贴、再写进文档，这样域名和 IP 不会出现在终端记录和规划文档里。
- 日志：nginx 访问日志记客户端 IP，保留 30 天，只在服务器上，格式里用 `$uri`，不含查询串（后台下载备份的链接带令牌，不会进日志）。nginx 错误日志也会记客户端 IP，按包默认保留约 14 天（IN-07），同样只在服务器上。PocketBase 请求日志保留 30 天，不记账号 id。
- 报告里（验收结论、SUMMARY）不写域名、IP、账号和真实内容。

## 3. 文件清单

| 路径 | 放什么 |
|------|--------|
| `deploy/build-site.mjs` | 构建脚本：从仓库页面生成发布版页面、nginx 的 CSP 头文件、带版本号的 `sw.js`，并把服务器文件和迁移收进上传包，写 `SHA256SUMS` |
| `deploy/verify-site.mjs` | `--check-bundle`（离线核对上传包）、`--stage baseline`、`--stage full`（线上检查）、`--self-test` |
| `deploy/server/` | 服务器上执行的脚本（00 到 07、`pb-admin.sh`、`restore-drill.sh`）、`pocketbase.service`、`nginx/`、`logrotate/` |
| `deploy/pb_migrations/`、`deploy/pb_hooks/` | 服务器设置迁移、探针清理迁移、备份看门狗钩子（应用的两个迁移在 `pb/pb_migrations/`） |
| `deploy/site/` | `sw.js` 模板、`manifest.webmanifest`、4 个主屏图标 |
| `deploy/server-check.mjs`、`deploy/server-config-check.mjs` | 服务器模板的静态检查，和在本机一次性 PocketBase 实例上的设置检查（都带 `--self-test`） |
| `deploy/make-acceptance-data.mjs` | 生成验收用的合成大备份（约 3.3 MB，全是 `SYNTH-` 开头的英文） |
| `private/deploy-out/` | 构建输出（上传包，32 个文件加 `SHA256SUMS`，被忽略） |

上传包的 32 个文件：站点 9 个（页面、`sw.js`、清单、4 个图标、SDK 和它的校验文件）、`server/` 17 个（10 个脚本和 unit、6 个 nginx 文件含生成的 `usj-csp.conf`、1 个 logrotate）、`pb_migrations/` 4 个、`pb_hooks/` 1 个、`BUILD_VERSION`。`00-status.sh` 不进包，只经标准输入运行。

## 4. 本机准备

- 本机装有 Node（只用 `node:` 内置模块，不需要 npm 安装任何东西）和 Git 自带的 bash、`sha256sum`、`tar`、`ssh`。
- `private/server.env` 里有 `USJ_DOMAIN`、`USJ_IP` 两个键（`node tools/privacy/redact.mjs --init-env` 可以从 `private/denylist.txt` 生成）；`ssh` 配置里有名为 `usj` 的主机别名（密钥登录，`BatchMode`）。
- 每次发布前先在本机跑完整测试（`npm test`）、构建、离线核对：

```bash
node deploy/build-site.mjs                                # 输出到 private/deploy-out
node deploy/verify-site.mjs --check-bundle private/deploy-out   # 最后一行 BUNDLE OK (9 checks)
```

`--check-bundle` 核对九件事：校验和全部通过且恰好 32 行；固定清单的文件都在；服务器文件和迁移与仓库逐字节相同（所有者批准的文本就是要执行的文本）；CSP 的哈希与页面内联块一一对应；没有 `unsafe-` 关键字；`sw.js` 带着 `BUILD_VERSION`；页面恰好一处云端开关和一处 noindex；SDK 等于钉死值；文本文件里没有公网 IP 和 `example.com` 以外的邮箱。

## 5. 批准清单与上传流程（沿用 Phase 6-08 的做法）

1. **批准清单**就是 `private/deploy-out/SHA256SUMS`（外加这个文件自己的 sha256）。所有者逐个看过每个脚本和配置的全文之后批准；批准只覆盖清单里的文件和这些 sha256。清单之外的文件不上传。
2. **上传前**在本机核对：

```bash
cd private/deploy-out && sha256sum -c --strict SHA256SUMS
```

3. **上传。** 在服务器上建一个随机目录（0700，属于当前用户），本机只打包清单里的路径，经 ssh 解到该目录：

```bash
UP="$(ssh -o BatchMode=yes usj 'mktemp -d /tmp/usj-deploy.XXXXXXXX')"
tar -C private/deploy-out -cf - <清单里的路径> | ssh -o BatchMode=yes usj "tar -xf - -C $UP"
```

4. **上传后**在服务器上再核对一次，并比对文件数（等于清单行数，32 个加 `SHA256SUMS`）：

```bash
ssh -o BatchMode=yes usj "cd $UP && sha256sum -c --strict SHA256SUMS && find . -type f | wc -l"
```

5. **执行。** 每个脚本在同一条 ssh 里先核对自己那一行，再以 `bash server/<脚本> <上传目录>` 执行；脚本入口自己也会核对上传目录里的 `SHA256SUMS`。解析清单时**两种分隔符都要接受**：两个空格，和空格加星号（本机 Git Bash 的 `sha256sum` 输出的是星号那种）。
6. **批次最后删上传目录**（`rm -rf "$UP"`）。
7. 任何一项不一致（哈希、文件数、清单外的文件）就**停下来重新请批准**，不要自行修正。
8. 整批批准之后，**每一批会改动服务器的命令**（上传和 01/02/07/03，04/06/05，重启，恢复演练，升级里的 06）执行前，执行者都要把要执行的命令原文和对应的清单行**再贴一次，所有者在那个检查点再确认一次才执行**。批准一整批不等于每一条命令都已经过目。
9. 只读的 `00-status.sh` 不需要批准，从标准输入运行，从不存到服务器上：`ssh -o BatchMode=yes usj 'bash -s' < deploy/server/00-status.sh | node tools/privacy/redact.mjs`。
10. 每次下载（例如换 PocketBase 版本）也要先批准。

## 6. 首次部署顺序

从 Phase 6 的探针升级到应用，顺序固定：

1. `00-status.sh`（只读，看现状）。
2. `01-swap.sh`、`02-install-pocketbase.sh`（都可重跑，已经做过就输出 already）。
3. `07-retire-probe.sh --wipe` 或 `--keep`：**所有者在 13-09 单独选**，执行前再确认一次。`--wipe` 清空库（探针数据和 Phase 6 建的超级用户都没了，不可回滚；守卫挡住任何非探针数据）；`--keep` 保留库和里面的超级用户，探针集合和探针账号由清理迁移 `1794096150_retire_probe.js` 在下次启动时删掉，所以 `--keep` 依赖 03 把那个迁移一起装上。
4. `03-configure-pocketbase.sh <上传目录>`：在服务器上用 `openssl rand -hex 16` 生成钥匙写进 `/etc/usj/pocketbase.env`（不打印），装迁移、钩子、`pb-admin.sh` 和恢复演练脚本。
5. **所有者存钥匙：** 在网页终端运行 `sudo cat /etc/usj/pocketbase.env`，只抄 `PB_ENCRYPTION_KEY` 那一行进密码管理器。Claude 不看这行。
6. （选了 `--wipe` 时）**所有者建超级用户**，见第 7 节。
7. `04-start-pocketbase.sh <上传目录>`：装 unit、启动、30 秒健康检查。
8. `06-install-site.sh <上传目录>`：装页面和 CSP、原子切换。
9. `05-nginx-app.sh <上传目录>`：把应用位置块挂进 certbot 的 443 块。**06 必须在 05 之前**（05 的前置要求页面和 CSP 片段已经装好）。05 输出 `WWW_REDIRECT=on|skipped`：`skipped` 表示证书不含 `www.` 或 `www.` 解析不到，没有加跳转；要把这个结果记进 SUMMARY。
10. 删上传目录。
11. 本机运行 `node deploy/verify-site.mjs --stage full 2>&1 | node tools/privacy/redact.mjs`，最后一行应是 `VERIFY OK (19 checks)`。

`--stage baseline` 只做三项（HTTPS 可达、http 跳到 https、8090 外网不通），随时可以跑。`--stage full` 的最后一项会连发 6 次失败的后台登录，让本机所在 IP 的后台登录等 60 秒；两次运行间隔至少 60 秒。

## 7. 所有者的操作

这些都由所有者本人在网页终端或后台里做，Claude 不经手任何口令和授权码。

**建超级用户**（网页终端；`--wipe` 之后或第一次需要时）：

```bash
sudo -u pocketbase bash -c 'IFS= read -r -p "超级用户邮箱: " EM; IFS= read -rs -p "口令: " PW; echo; /usr/local/sbin/pb-admin.sh superuser upsert "$EM" "$PW"; unset EM PW'
```

注意（IN-06）：口令在命令执行的那一瞬间会短暂出现在 `pb-admin.sh` 的进程参数里（同一台服务器上有权限的用户用 `ps` 能看到）。服务器上只有所有者一个人使用，这个风险被接受；不要在别人也登录的机器上做。

**邮件（SMTP）和两步验证，顺序不能反：**

1. 在后台「设置 → 邮件设置」填发件人和 SMTP（所有者现有的邮箱，授权码在邮箱的设置里生成；服务器出事时这个授权码也要换，见第 12 节）。
2. 点「发送测试邮件」，并且**确实在邮箱里收到**。注意：SMTP 不通时登录页的“发送验证码”照样返回成功、界面一切正常，只是邮件永远不来。
3. 收到之后，才去 `_superusers` 集合的选项里打开 OTP 和 MFA。反过来会把自己锁在后台外面（锁死的恢复见第 11 节）。
4. 退出后重新登录一次，走完“口令 → 邮件码”。

**R2 备份：**

- 在 Cloudflare 建一个**私有**桶；建一个 API 令牌，权限选 Object Read & Write，**只限这一个桶**。
- 可选：给桶加生命周期规则，前缀 `@auto_pb_backup_`，约 35 天后删除，作为 PocketBase 自己清理之外的双保险。
- 在后台「设置 → 备份」：打开 S3，端点 `https://<account-id>.r2.cloudflarestorage.com`，region 填 `auto`，打开 force path style，填桶名、令牌的 Access Key 和 Secret。保存后点测试连接。
- 令牌和桶只存在 R2 和 PocketBase 的加密设置里；R2 令牌不要放进任何文件。

**建测试账号：** 在后台 `users` 集合新建账号，假邮箱必须是 `test-` 开头、`@example.com` 结尾，例如 `test-1@example.com`；「验证」置为真。恢复演练的守卫靠这个约定认出测试账号：不符合约定的账号都会被当成真实账号。

## 8. 升级

- **应用（页面）：** 改仓库 → 本机 `npm test` → 构建（`node deploy/build-site.mjs`）→ `--check-bundle` → 只批准变了的文件和 06（从 `SHA256SUMS` 对比上次）→ 运行 06：页面和 CSP 一起换，原子切换 → `verify-site --stage full`。已经打开的应用下一次回到前台会出现「有新版本」横幅。同一个构建部署两次，版本号不变，不会出现更新提示。
- **nginx 结构变化**（位置块、响应头）：只批准变了的 nginx 文件和 05；05 自带备份、`nginx -t`、`certbot renew --dry-run`、`logrotate -d`，失败自动恢复。
- **PocketBase 版本：** 改 `02-install-pocketbase.sh` 里钉死的下载地址和 sha256、改版本号，**所有者批准下载**（D-17）；先在本机一次性实例上用新版本重跑 `npm run pb:isolation` 和 `node deploy/server-config-check.mjs --local`。
- HSTS 现在是一天（`max-age=86400`）：验收通过、见过一次真实的证书续期之后，再改 `usj-headers-common.conf` 和 `usj-headers-proxy.conf` 里的值提高（走批准），不要一开始就设很长。

## 9. 回滚

- **站点：** `/var/www/usj/site` 是指向 `/var/www/usj/releases/<版本>` 的符号链接，保留最近 3 个版本。把链接指回上一个版本（`ln -sfn` 加 `mv -T` 的原子写法，同 06）；页面的 CSP 从 `/etc/nginx/usj-backup/` 里最近的备份恢复；`nginx -t` 通过后 reload。页面和 CSP 必须一起回退，否则浏览器会拦下内联脚本（白屏）。
- **nginx：** 05 每次改动前备份到 `/etc/nginx/usj-backup/<UTC 时间戳>/`，失败自动恢复；手动回滚就是把那里的文件放回原处、`nginx -t`、reload。
- **PocketBase：** `systemctl disable --now pocketbase`，恢复旧 unit 文件，`systemctl daemon-reload`。`/var/lib/pocketbase` 里的数据不删。
- **探针清空（`--wipe`）不可回滚**，所以它由所有者单独决定，守卫只放行探针数据。

## 10. 备份与恢复

- **时间：** PocketBase 的定时任务一律按 UTC 解释，自动备份是 `0 19 * * *`，也就是北京时间 03:00。保留最新 30 份（只清理名字以 `@auto_pb_backup_` 开头的备份）。打开 S3 之后备份**只存 R2**，服务器本机不留副本。
- **失败提醒：** 备份失败时 PocketBase 自己给超级用户发信（前提是 SMTP 已配置且测试邮件成功）；另有看门狗钩子在 20:30 UTC 检查，最新自动备份超过 40 小时没有新的，就发一封「计划手记：备份异常」。看门狗只在 PocketBase 运行时有效。
- **手动备份不会被自动清理：** 后台「创建备份」建的备份不带 `@auto_pb_backup_` 前缀，不在保留 30 份的清理范围内，要手动删。恢复演练产生的 `drill_` 开头的备份同理。
- **恢复演练：** 在服务器上运行（网页终端，所有者操作）：

```bash
sudo /usr/local/sbin/usj-restore-drill
```

  它在 `127.0.0.1:8091` 起一个临时实例（`systemd-run`，最长 15 分钟，限内存），用线上库的**只读副本**起步（沿用里面加密保存的 R2 设置，所有者不用再填一遍密钥），从 R2 取最新的自动备份恢复进去，再只读核对，最后删掉临时实例和副本。线上实例和线上库只读、从不停止。输出键都以 `DRILL_` 开头，最后一行 `DRILL_RESULT=PASS` 才算通过。
- **时间窗：** 18:40–19:20 UTC 之间脚本拒绝运行（避开 19:00 的自动备份，不让临时实例和线上同时碰 R2）。
- **守卫（所有者 2026-11-12 的决定）：** 演练只在**线上库里只有测试账号**（邮箱 `test-…@example.com`）时才运行。脚本在复制任何东西之前，先只读检查线上库：有任何别的账号或文档，就输出 `DRILL_GUARD=refused`、非 0 退出、什么都不复制。所以**导入真实数据之后它就不能再用了**，这是预期的；演练必须在导入真实数据之前做。
- **真正需要恢复线上库时：** 先在后台手动建一份当前备份，再用后台「备份」页的恢复（会覆盖线上库）。恢复用的钥匙必须是同一把 `PB_ENCRYPTION_KEY`（见第 12 节）。
- **次日回看：** 备份出了问题不一定有邮件（整台服务器不在时没有任何东西能发信）。验收后第二天去 R2 看一眼，里面应出现新的 `@auto_pb_backup_…`。

## 11. 两步验证锁死的恢复

邮件收不到、登录页要验证码时：在网页终端运行

```bash
sudo -u pocketbase /usr/local/sbin/pb-admin.sh superuser otp "$EM"
```

得到一个 id 和 8 位码（180 秒有效），在登录页选「一次性密码」方式输入。登录之后立刻去查 SMTP 设置，发测试邮件。

## 12. 风险

- **服务器出事（D-02）：** 邮箱授权码、R2 令牌和加密钥匙都存在这台服务器上（授权码和令牌由 PocketBase 用钥匙加密保存，钥匙在 `/etc/usj/pocketbase.env`）。服务器被入侵或怀疑泄露时，三样都要换：邮箱的授权码（在邮箱设置里重新生成）、R2 令牌（作废并新建）、`PB_ENCRYPTION_KEY`（第 13 节）。
- **钥匙丢失：** 没有钥匙、钥匙不对、长度不是 32 个字符，PocketBase 一启动就退出，`systemd` 会反复重启（`systemctl status` 里是 `activating (auto-restart)`）。恢复演练和恢复备份也必须用同一把钥匙。所以第一次部署后要把 `PB_ENCRYPTION_KEY` 存进密码管理器。
- **HSTS：** 现在是 `max-age=86400`（一天），不加 includeSubDomains 和 preload。验收通过并见过一次真实续期后再提高。
- **iPhone：** 在 Safari 里直接用（没有添加到主屏幕）的网站，7 天不用，Safari 会清掉这个网站在本机的所有数据，包括还没上传的修改。请添加到主屏幕使用；离线时间长时要尽快联网。
- **微信内置浏览器：** 不保证离线和主屏安装可用；请用系统浏览器（Safari、Edge、Chrome）。
- **只用裸域名：** 请只用裸域名访问。DNS 和证书都包含 `www.` 时，`www.` 会 301 跳转到裸域名；不包含时不跳转，`www.` 地址不要用。两个地址的本机缓存和待上传的修改互不相通。
- **日志里的 IP：** 访问日志（30 天）和错误日志（约 14 天）都会记客户端 IP，只在服务器上，不会进仓库和报告。
- **看门狗的盲区：** 看门狗是 PocketBase 里的定时任务，整台服务器不在时它也不在；那种情况只能靠所有者第二天去 R2 看。
- **后台对公网开放：** `/_/` 对公网开放，防线是强口令、邮件验证码（OTP 加 MFA）和每个 IP 60 秒 5 次的登录限流。

## 13. 钥匙轮换

照着本机在一次性 0.41.1 实例上实测过的步骤做。前提：新旧钥匙都是 32 个十六进制字符，只放在 `/etc/usj/pocketbase.env`，不打印。**每一步都要所有者批准，执行前再确认一次。**

1. **停服务。** `systemctl stop pocketbase`。
2. **在服务器上备份 `pb_data`**（整个目录复制一份到安全位置，轮换出问题时用）。
3. **删掉 `_params` 里的 settings 行。** 库在停着的状态下，在 `pocketbase` 用户下对 `pb_data/data.db` 执行 `DELETE FROM _params WHERE id = 'settings'`（`sqlite3` 或同等工具）。
4. **写新钥匙。** 把 `/etc/usj/pocketbase.env` 里 `PB_ENCRYPTION_KEY` 那一行换成新值（用 `openssl rand -hex 16` 在服务器上生成，不打印）。
5. **以新时间戳复制一份服务器设置迁移。** 把 `1794096200_server_settings.js` 复制成 `<当前秒数>_server_settings_reapply.js`（`date +%s` 作前缀，放进 `pb_migrations/`）。
6. **启动。** `systemctl start pocketbase`。PocketBase 先用默认设置重建 settings 行，再由重放的迁移写成密文。
7. **所有者重新填 SMTP 和 S3。** 第 3 步删掉的是整行设置：后台里填过的 SMTP、S3（R2）凭据、发件人、两步验证开关之类都会丢；要重新填写，并重新发测试邮件确认能收到。
8. 把新钥匙存进密码管理器，作废旧钥匙。

实测结果：新钥匙启动成功、超级用户（在 `_superusers` 里，不受影响）能登录、设置读回正确、`_params` 里 settings 又是密文；之后用旧钥匙启动，进程以非 0 退出。旧备份文件里带的设置是用旧钥匙加密的，恢复旧备份时要用旧钥匙。

## 14. 不做的事

- **后台 IP 白名单不默认开**：所有者在中美两地使用，IP 经常变，白名单会把自己挡在外面。
- **后台只经 SSH 隧道访问**是一个推迟的想法，这一版没有做。
- 没有开放注册：账号由所有者在后台新建。
- 不为微信内置浏览器做专门适配。

## 15. 和验收的关系

总体验收的清单在 `.planning/phases/13-deploy-hardening-acceptance/13-ACCEPTANCE.md`：先用临时测试账号做 A 到 I（含会删数据的操作），确认没有问题后，所有者在本机运行 `node tools/plan/migrate-backup.mjs <旧备份.json>` 迁移真实数据；恢复演练在导入真实数据之前完成。
