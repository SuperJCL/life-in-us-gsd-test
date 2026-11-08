# 线路实测工具说明

## 1. 用途和边界

这里是 Phase 6 的线路实测工具：一个探针页，加上把 PocketBase 和探针页装到服务器上的脚本，以及汇总实测结果的脚本。目的是在中国大陆三家运营商和美国实际打开一次，量出首屏、登录和实时推送的表现，给 Phase 10 和 Phase 13 当输入。

- 只用于 Phase 6 的实测，只用合成的探针账号，不放任何真实数据。
- 探针站点上的数据都是合成的，Phase 13 正式部署时会整体重装，不需要迁移。
- 不论实测结果如何，服务器都继续用（D-08）；结果只决定“已知限制”和兜底参数。

## 2. 隐私约定

本仓库会公开，所以：

- 仓库里不写域名和 IP。给测试的人的链接一律写成 `https://<域名>/probe/`，真实域名由所有者私下发给测试的人。
- 服务器上的任何输出（脚本输出、日志、截图转录）先经 `node tools/privacy/redact.mjs` 过滤，再贴给别人或写进文档。
- 探针页不收集个人信息：没有自由文本，不上传 User-Agent 原文（只上传 chrome、safari、edge、firefox、wechat、other 的粗分类），不上传 IP，也不记录测试的人是谁。
- 探针账号的邮箱和口令只存在于服务器上的 `config.js`，该文件由服务器脚本生成并被 git 忽略；仓库里只有占位的 `config.example.js`。
- 截图、多点测速站的结果页和 mtr 的完整输出都不进仓库，只转录汇总数字。

## 3. 目录

| 路径 | 放什么 |
|------|--------|
| `tools/probe/page/` | 探针页：`index.html`、`probe.js`、`config.example.js`；`vendor/` 里是固定版本的 PocketBase JS SDK（见 `vendor/README.md`） |
| `tools/probe/server/` | 服务器脚本、systemd 服务文件、nginx 片段和迁移文件（经 ssh 执行，见第 4 节） |
| `tools/probe/schema.json` | 探针结果字段和规则的唯一定义：迁移文件、探针页、导出脚本都按它比对 |
| `tools/probe/schema-check.mjs` | 字段契约比对器：`--migration`、`--page`、`--export`、`--self-test` |
| `tools/probe/summarize.mjs` | 把导出的结果 JSON 汇总成表，带 `--self-test` |
| `tools/probe/verify-site.mjs` | 站点验证脚本（由 06-09 加入） |

探针页的字段检查：`node tools/probe/schema-check.mjs --page tools/probe/page/probe.js`，一致时输出 `SCHEMA MATCH page`。

## 4. 服务器步骤和批准流程（D-04）

会改动服务器的步骤都按这个流程走：

1. 先把完整脚本发给所有者，同时给出每个文件的 sha256；
2. 所有者回复“可以”；
3. 执行前，在本机和服务器上都按批准清单再核对一遍 sha256，只上传批准清单里的文件；
4. 再用 `ssh -o BatchMode=yes usj` 执行，并把输出（经 `redact.mjs` 过滤）报告给所有者。

只读的 `00-status.sh` 不需要批准，它经 `bash -s` 从标准输入运行，从不存到服务器上。

脚本清单：

- `00-status.sh`：只读状态检查。
- 批次 A：`01-swap.sh`、`02-install-pocketbase.sh`、`03-configure-pocketbase.sh` 和两个迁移文件（探针集合、探针账号）。
- 批次 B：`04-start-pocketbase.sh`、`05-nginx-probe.sh`、`06-install-probe-page.sh`、`pocketbase.service`、nginx 片段和锚点检查 awk，以及探针页文件。

回滚要点：nginx 步骤失败会自动恢复带时间戳的备份并 reload；PocketBase 的回滚是停掉并禁用服务、删除 unit 文件，保留 `/var/lib/pocketbase`（里面只有合成数据）。探针期间不重启服务器。

## 5. 测量范围

探针页在第 15、45、105、195、315、495 秒各写一条打点、再等自己收到推送。相邻打点之间最长安静 180 秒，所以它测的是“安静不超过 180 秒时，推送是否丢失”。

PocketBase 的实时连接没有心跳，空闲 5 分钟会被服务器断开，这一点不由打点直接测到，只能从页面记录下来的掉线（drop）和重连（reconnect）事件里间接观察。结论里照此表述，不夸大。

页面记录的掉线时刻是“SDK 注意到的时刻”，不是网络真正断开的时刻。

## 6. 超级用户（D-05）

PocketBase 后台的超级用户由所有者在阿里云网页终端里运行下面这一条命令，邮箱和口令都在终端里输入，Claude 看不到，也不记录：

```bash
sudo -u pocketbase bash -c 'read -r -p "邮箱: " EM; read -rs -p "口令: " PW; echo; /opt/pocketbase/pocketbase --dir=/var/lib/pocketbase/pb_data superuser upsert "$EM" "$PW"; unset EM PW'
```

它以 pocketbase 用户执行，口令不进任何文件。

## 7. 给测试人的一页说明

1. 打开所有者私下发给你的链接（形如 `https://<域名>/probe/`）。
2. 用系统自带的浏览器，或平时常用的浏览器。每次新开一个标签页，或者用无痕窗口。
3. 选运营商（电信、联通、移动、美国）和网络类型（手机 4G、家宽、其他）。
4. 点“开始”。
5. 约 10 分钟内不要锁屏、不要切后台、不要换网络（比如从 Wi-Fi 切到 4G）。
6. 看到摘要后截图。截图里不要带地址栏。
7. 结果会自动上传。如果屏幕上提示“上传失败”，请截图这一屏发给组织测试的人。

所有者自己确认流程时，在链接后面加 `?dur=90`，跑一次约 90 秒的短测试。`dur` 可以在 60 到 600 之间调，默认 600 秒；短测试的结果因为时长不足，汇总时自动不算有效。

## 8. 测试安排（D-10、D-18）

- 至少测 3 个晚上，北京时间 20:00–23:00；其中最好有一个周五或周六晚。
- 每个晚上，电信、联通、移动各至少测 2 次，两次间隔至少 30 分钟；尽量一次手机 4G、一次家宽，3 个晚上里两种网络都要出现。
- 美国以美国本地时间 20:00–23:00 为主；再在北京晚高峰时段（美国的早晨）补测几次。
- 另外用 itdog.cn、17ce 这类多点测速站对探针页做一次基线对比；美国侧跑一次 mtr（Windows 用 pathping）。多点测速站的节点多半是机房而不是家宽，只能当粗基线，不能代替真人测试。
- 截图和原始输出不进仓库，只转录数字：每个运营商分组的节点数、耗时中位数和 P90、失败节点数；mtr 只记最后一跳丢包率、平均耗时、跳数。
- 结果汇总：在服务器上只读导出 `probe_results`，在本机用 `node tools/probe/summarize.mjs` 生成汇总表，放进 Phase 6 目录前先过 `node tools/privacy/privacy-check.mjs --staged`。
