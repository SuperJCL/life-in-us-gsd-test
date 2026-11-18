# Phase 16: 新版本上线与总体验收（Release & Acceptance） - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Phase Boundary

本阶段分四步，交付 v2.0 的上线和唯一一次总体验收：

1. **发布修复版本。** 先修完 13-REVIEW 剩下的 17 条发现，再按 OPS-03 的升级步骤发一次修复版本，同时把新的恢复演练脚本装到服务器上。含 Phase 14、15 的版本 `0ba1339903f1` 已在 13-14 上线，本阶段不再为 Phase 14、15 单独部署。
2. **总体验收。** 所有者在中国大陆和美国网络下的两台真实设备上，按一份中文清单，用测试账号走完。清单里包括前面各阶段推迟的人工验收项，以及空计划起步和健身页。
3. **迁移真实数据。** 所有者把自己的旧数据迁进正式账号，然后删掉测试账号；导入后跑一次恢复演练，证明含真实数据的备份能恢复。
4. **收口。** 跑 `npm test` 和 `npm run test:cloud` 全量；OPS-04、TEST-02 收口。

不在本阶段：
- 新功能。
- 提高 HSTS。
- PocketBase 本体升级。
- 服务器结构变化（新增迁移、改 nginx 位置块）。验收中发现必须改服务器结构的问题时例外，见 D-11。

</domain>

<decisions>
## Implementation Decisions

> 所有者 2026-11-17 收到四个待定问题（上线前修哪些审查发现、验收怎么走、发现问题怎么办、迁移之后的收尾），选择不讨论，交给推荐做法。下面 D-01 到 D-18 都是**所有者未选讨论、按推荐定、可以再改**。

### 上线前的修复和发布

- **D-01:** 13-REVIEW 剩下的 17 条在 Phase 16 的发布之前**一次修完**。理由：STATE 原本建议"下次升级前处理 WR-01..03、WR-05..08"，而本阶段本来就要发一次版来装新演练脚本，这次发布就是"下次升级"。各条修法如下：
  - **WR-01（换页面和换 CSP 之间有窗口）：** CSP 切换要对 Service Worker 原子，不能让 SW 预缓存"新页面 + 旧 CSP"。具体做法见 Claude's Discretion。
  - **WR-02：** `shellVersion` 把 CSP 头文本也算进去；自检加一条"只改 `buildCsp` 的一个指令，版本号就变"。
  - **WR-03：** 03 只在迁移、钩子或环境文件要变时才要求先停 PocketBase；`pb-admin.sh` 和 `restore-drill.sh` 的安装放到这个检查之外。**本阶段装新演练脚本时不停线上服务，靠的就是这一条。**
  - **WR-05：** 只把 README 第 8 节改成如实说明"PocketBase 本体升级目前没有脚本"，不做升级自动化（见 Deferred）。
  - **WR-06：** HSTS 期望值提成一个常量，`verify-site.mjs`、`server-check.mjs` 和两个头文件的检查共用；本阶段**不提高** HSTS。
  - **WR-07：** 恢复演练要拒绝过旧的备份（超过 40 小时就失败），要求 `compared >= 1`，`row is None` 单独计数，不混进 mismatch。
  - **WR-08：** 04 覆盖 unit 文件之前先留备份，失败时放回；README 第 9 节的回滚步骤与之对应。
  - **IN-02：** 点「点此更新」之后加兜底刷新，避免横幅停在「正在更新…」。验收 E 项会走到这条路径。
  - **IN-03：** 不改代码。首日误报已不适用（已经部署过）；"次日看 R2 和邮箱"已在清单的 I-4。
  - **IN-04：** 只改 README 第 2 节，写明错误日志在上游出错时会带 `?token=`（短时有效）。
  - **IN-05、IN-06、IN-07、IN-10、IN-11：** 按 13-REVIEW 的建议改。IN-11 包括 `deploy-tools.spec.ts` 改为从 `BUNDLE_COUNT` 计算文件数，不再写死 `(33 files)`。
  - **IN-08：** 删掉 manifest 里的 `description`，不新增需要所有者过目的文案。
  - **IN-09：** verify-site 的 F-11 改成不会在线上创建账号的探测方式。

- **D-02:** 本阶段计划内**只发一次修复版本**。上传包里有新页面、新 `sw.js`、新的 03、04、06，以及新 `restore-drill.sh`（含 IN-01 的导入后模式和 WR-07）。步骤沿用 OPS-03 和 README 第 5、8 节：
  1. 本机全量测试，然后构建，`--check-bundle` 离线核对。
  2. 所有者批准变化文件的 sha256 清单，然后上传。
  3. 每条服务器命令，所有者看过原文后当场确认。
  4. 运行 03：只装工具文件，不停 PocketBase（WR-03 修好之后）。
  5. 运行 06：换页面和 CSP。
  6. 跑 `verify-site --stage full` 和只读状态。

  04 的新模板随包上传，但本阶段不运行，除非要改 unit。

- **D-03:** 这次修复版本同时充当验收 E 项要用的"新版本"。设备甲上有 13-14 留下、一直没点的横幅；其他设备只要打开过 `0ba1339903f1`，发布后也会看到「有新版本」。E 项照做即可，**不另发无害版本**。

### 验收怎么走

- **D-04:** 在 Phase 16 目录新建 `16-ACCEPTANCE.md`，作为唯一的验收清单。
  - 底稿是 `13-ACCEPTANCE.md`。
  - 要补进去的：Phase 14 的 4 项（`14-UAT.md`）、Phase 15 的 8 项（`15-UAT.md`）、修复版本的部署结果和换版、用第二个测试账号走的空计划起步和从示例里挑（D-08）、导入后演练（D-15）。
  - `13-ACCEPTANCE.md` 原样保留作历史。`deploy/README.md` 第 15 节和 `site-assets.spec.ts` 里的引用改指新清单（与 IN-11 一起改）。

- **D-05:** 每一项标「必做」或「可选」。可选的有四项，其余都是必做：
  - 读屏和键盘：15-UAT 第 8 项。
  - UI-SPEC 的三条 backstop：G-2，合成数据由 Claude 准备。
  - 微信内置浏览器：D-4。
  - 后台故意输错口令：I-2。

- **D-06:** 顺序固定为：
  1. 发布修复版本。
  2. **每台设备先换成新版本**，把 E 项放到最前面。
  3. 再做其他各项：A–I，以及空计划起步和健身页。
  4. J：迁移真实数据。
  5. K：删除测试账号。
  6. 次日回看，跑导入后演练。

  第 2 步必须在前，因为设备甲在 13-14 之前打开过应用，很可能还缓存着 Phase 15 之前的 `a1159ad93165`；那个版本不认识训练数据，保存时会把训练冲掉（15-CONTEXT 的上线顺序风险）。所以任何训练相关的检查，都放在所有设备换版之后。

- **D-07:** 需要两台设备同时在场的项集中成一节，约一次时间一起做：B 同步、C-4 另一台设备看到、H-2 冲突三选一、15-UAT 第 6 项的跨设备训练同步。
  - 中国大陆那台设备可以由所有者本人，或所有者信任的人操作，只用测试账号，不碰后台。
  - 测试账号的口令由所有者自己交给对方，Claude 不经手。

- **D-08:** 空计划起步和从示例里挑（成功标准 3），用所有者在后台**新建的第二个测试账号**做。
  - 账号用 `test-` 开头的假邮箱，恢复演练的守卫才认它是测试账号。
  - 现有测试账号已经有计划文档（14-CONTEXT），看不到空计划卡片。
  - 两个测试账号都在 K 里删掉。

- **D-09:** 回报方式沿用 13-ACCEPTANCE 的格式。
  - 所有者按节在聊天里发「通过 / 问题 / 不适用」加现象，可以分几次发；Claude 随收随填进 `16-ACCEPTANCE.md`。
  - 回报和清单里都不带账号、邮箱、网址和真实内容。

### 发现问题怎么办

- **D-10:** **只有会丢数据或让数据出错的问题才挡住 J。** 这类问题包括：同步、离线、登录和账号隔离、导入导出、更新流程、训练记录的保存和同步、迁移。文案、样式、布局、无障碍和速度方面的问题记进「待修复」，不挡 J。

- **D-11:** 问题按类型处理：
  - **挡 J 的问题：** 在本阶段修。补一个修复计划，再发一次版（同样经批准、当场确认），然后只复查受影响的项，通过后才做 J。
  - **不挡 J 的问题：** J 之后合并成一次收尾发布（同样经批准、当场确认）。
  - **需要新功能或改服务器结构的问题：** 记进下个里程碑，不在本阶段做。

### 迁移和收尾

- **D-12:** J 之前，先在当前版本上用合成文件**再走一次迁移**，跑自动用例，用 cloud 套件里的假服务器。
  - 原因：Phase 15 改了数据模型，而现有的 IO-09 用例（`tests/cloud/migration.spec.ts`）只核对"力量记录还在"，没看健身页。
  - 要补一条断言：迁移后，旧的力量历史出现在健身页的趋势图里（成功标准 4、FIT-04）。
  - 全程只用合成数据，Claude 不读真实备份。

- **D-13:** J 照 13-CONTEXT D-13 做：
  1. 所有者在本机运行 `node tools/plan/migrate-backup.mjs <旧备份.json>`。
  2. 用正式账号登录，导入生成的文件。
  3. 核对记录条数、日期范围、完成任务数和力量记录数，并看一眼健身页趋势图里有以前的力量历史。
  4. 在后台手动建一份备份。

  旧备份里没有训练记录，不需要迁移训练。Claude 只记录所有者口述的结论和"计数一致与否"。

- **D-14:** K（在后台删除两个测试账号，并看一眼 R2 里没有 `drill_` 开头的文件）在 J 核对通过、手动备份建好之后马上做。

- **D-15:** 导入之后，等第一次自动备份（每天 19:00 UTC）完成，再运行一次导入后恢复演练 `sudo usj-restore-drill --with-real-data`。
  - 和 I-4 的次日回看放在同一天。
  - 所有者当场确认后才运行，避开 18:40–19:20 UTC。
  - 通过条件包括 WR-07 新加的检查：备份不超过 40 小时，至少比对过一份文档。
  - 输出只有 `DRILL_` 开头的键。
  - 跑通后，"备份能恢复"在真实数据上也得到证明（OPS-01 的意图，对应 IN-01 当初的理由）。
  - **Reversibility:** reversible —— 演练只在服务器 0700 的临时目录里起临时实例，结束即删，不改线上库和自动备份。

- **D-16:** 两个朋友的账号由所有者在 K 之后自己去后台开，不算验收项，也不挡阶段完成。朋友第一次登录如果有问题，再报给 Claude。

- **D-17:** 收口：
  - `npm test` 和 `npm run test:cloud` 全量通过：依次跑、低优先级、1 个 worker。
  - C、D 项通过后，OPS-04 标完成。
  - TEST-02 随全量通过收口。

- **D-18:** 清单最后附一节**可选**的「待你确认的已接受风险」，每条配一句白话说明。所有者不回复，就维持现在"已接受"的登记，不挡阶段完成。这一节包括：
  - Phase 9 的 AR-02。
  - Phase 10 的 WR-01、WR-03 写法，AR-02、AR-03，三处体验问题，以及 IN-01 死代码删不删。
  - Phase 11 的 AR-01、AR-02。

### 沿用的决定（不再讨论）

- **数据和隐私：** 先测试账号、后真实数据；真实数据由所有者本人在本机迁移，Claude 不读、不运行默认模式的迁移脚本（13-CONTEXT D-13，Phase 11 D-06）。验收结论里不带账号、邮箱、网址和真实内容（D-12）。
- **服务器操作：** 服务器上每个脚本先批准精确的 sha256 清单，执行前所有者看原文当场确认；只读检查不用批准；所有服务器输出经 `node tools/privacy/redact.mjs`。Claude 不输入、不读取口令、SMTP 授权码、超级用户邮箱、R2 密钥和加密钥匙，也不登录后台。
- **恢复演练：** 不在 18:40–19:20 UTC 运行；默认（只测）模式遇到测试账号以外的数据就拒绝；导入后模式只接受唯一参数 `--with-real-data`（quick 261117-lwq）。
- **更新提示：** 点了才刷新，有草稿先确认（13-CONTEXT D-08）。主屏名称「计划手记」和图标（D-09）进 E-4 表态。
- **本机测试：** 低优先级、1 个 worker、不并发；只用 `npx --no playwright`；不下载东西；不改 playwright 的 `workers`。
- **提交：** 明确路径；不用 `--no-verify`；每次推送要所有者明确同意；每次改应用都重新记录 `APP_SHA256`。
- **上线顺序：** 所有设备换成新版本之后，才能记第一条训练、迁移真实数据（Phase 15，T-15-04 按接受登记）。

### Claude's Discretion

- **WR-01 的具体做法：** 有三种选择：06 分两步 reload（先装"旧哈希 ∪ 新哈希"的过渡 CSP，切换符号链接，再装只含新哈希的最终 CSP）；SW 在 `install` 时核对响应头里的 CSP 含有页面每个内联块的哈希；或者两者都做。无论哪种，README 第 8 节都要写明"部署后立刻跑 `--stage full`"。
- **修复的组织：** 修复的计划怎么拆、按什么顺序做、自检用例怎么写，由规划决定。约束是 03、04、06、`restore-drill.sh` 的改动要在 server-check（C-22、C-23 等）和自检里有对应。
- **清单编排：** `16-ACCEPTANCE.md` 的编号、分节和白话说明的措辞，沿用 13-ACCEPTANCE 的表格格式。
- **确认设备已换版：** 不改界面，用现有行为判断，例如重开之后不再出现横幅；具体写法进清单。
- **合成数据：** G-2 backstop 所需合成数据的生成方式；F-4 继续用 `deploy/make-acceptance-data.mjs`。
- **线上全量检查的时间：** `verify-site --stage full` 会故意输错 6 次后台口令，让所有者所在 IP 的后台登录等 60 秒，也会做几次匿名写入。安排时间时，不要放在所有者马上要登录后台之前。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 阶段范围和需求
- `.planning/ROADMAP.md` 的 "Phase 16" —— 目标、5 条成功标准、Notes（种子、测试账号、上线前提）
- `.planning/REQUIREMENTS.md` —— OPS-04（真机部分）、TEST-02（全量收口）
- `.planning/phases/16-release-acceptance/16-SEED-from-13-15.md` —— 原 13-15 的计划（3 个任务、威胁 T-13-34..36、两条全量套件的命令和最低条数），规划起点

### 验收清单和推迟的人工项
- `.planning/phases/13-deploy-hardening-acceptance/13-ACCEPTANCE.md` —— A0–K 底稿（D-04）
- `.planning/phases/13-deploy-hardening-acceptance/13-UAT.md` —— 6 项推迟检查
- `.planning/phases/10-offline-realtime-sync/10-UAT.md` —— 第 1 项（两台真机"几秒内"同步）
- `.planning/phases/12-plan-editor/12-UAT.md` —— 推迟的 5 项（G 节）
- `.planning/phases/14-plan-onboarding/14-UAT.md` —— 推迟的 4 项
- `.planning/phases/15-fitness-tab/15-UAT.md` —— 推迟的 8 项

### 前面阶段的决定
- `.planning/phases/13-deploy-hardening-acceptance/13-CONTEXT.md` —— D-05（演练和守卫）、D-08（更新提示）、D-09（主屏）、D-12（清单）、D-13（测试账号在先）
- `.planning/phases/14-plan-onboarding/14-CONTEXT.md` —— 现有测试账号已有计划文档；新文案进总体验收
- `.planning/phases/15-fitness-tab/15-CONTEXT.md` —— 上线顺序风险（旧页面冲掉 `workouts` 和 `cardio`）

### 要修的审查发现
- `.planning/phases/13-deploy-hardening-acceptance/13-REVIEW.md` —— 17 条 open 发现的原文和修法（D-01）
- `.planning/phases/13-deploy-hardening-acceptance/13-REVIEW-DISPOSITION.md` —— 处理台账，修完逐条改成 fixed
- `.planning/quick/261117-lwq-13-review-wr-04-in-01/261117-lwq-SUMMARY.md` —— WR-04、IN-01 的修法；新演练脚本还没装到服务器

### 部署和演练
- `deploy/README.md` —— 第 2 节（隐私）、第 5 节（批准清单与上传）、第 8 节（升级）、第 9 节（回滚）、第 10 节（备份与恢复、两种演练模式）、第 15 节（和验收的关系）
- `.planning/phases/13-deploy-hardening-acceptance/13-13-SUMMARY.md` —— 恢复演练的实际运行和输出
- `.planning/phases/13-deploy-hardening-acceptance/13-14-SUMMARY.md` —— 升级演练：线上 `a1159ad93165` → `0ba1339903f1`；设备甲的横幅留到验收
- `PRIVACY.md` —— 隐私规则；IN-11 要改的陈旧引用也在这里

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `deploy/build-site.mjs`：构建上传包（`shellVersion`、`buildCsp`、`migrationSources`、`BUNDLE_COUNT`、`--check-bundle`）。WR-02、IN-10 在这里改。
- `deploy/server/03-configure-pocketbase.sh`：装迁移、钩子、`pb-admin.sh` 和 `restore-drill.sh`（装到 `/usr/local/sbin`）。WR-03 在这里改。
- `deploy/server/06-install-site.sh`：换页面和 CSP，用符号链接原子切换，保留最近 3 个版本目录。WR-01 在这里改。
- `deploy/server/04-start-pocketbase.sh`：WR-08 在这里改。
- `deploy/server/00-status.sh`：只读状态，最后一行是 `STATUS_DONE=1`。
- `deploy/server/restore-drill.sh`：已有导入后模式 `--with-real-data`。WR-07 在这里改；D-15 用它。
- `deploy/site/sw.js`：外壳缓存和更新。WR-01（可选的安装时核对）、IN-06 在这里改。
- `deploy/verify-site.mjs`：`--stage baseline` 是只读的三项，`--stage full` 有 19 项。WR-06、IN-09 在这里改。
- `deploy/server-check.mjs`：23 项静态检查，带自检。修完要同步 C-22、C-23 等相关检查。
- `deploy/make-acceptance-data.mjs`：生成 F-4 用的合成大文件，输出到被忽略的 `private/acceptance/`。
- `tools/plan/migrate-backup.mjs`：所有者本机迁移用。里面没有 `workouts`，因为旧备份里没有训练记录。
- `tests/cloud/migration.spec.ts`：IO-09 的合成迁移用例。D-12 的趋势图断言加在这里，或加在相邻的文件里。
- `tests/e2e/fitness/charts.spec.ts`：已有"手填力量历史显示为空心点"的用例（FIT-04），可以借用它的断言写法。
- `us-journey-tracker.html` 的 `swUpdate`：IN-02 的兜底刷新加在这里，改完重新记录 `APP_SHA256`。

### Established Patterns
- **服务器步骤：** 批准清单 → 上传 → 逐个核对 → 当场确认原命令 → 输出经 redact → 只读检查收尾。
- **演练输出：** 只输出 `DRILL_` 开头的数字和 ok 类键，不输出邮箱、口令和内容。
- **测试账号：** 邮箱匹配 `^test-[a-z0-9-]+@example\.com$`，恢复演练的守卫靠这个识别。
- **验收清单：** 中文表格，列为「编号 / 操作 / 期望 / 结论 / 备注」，每节末尾有「结论：」行。
- **两个全量套件：** 依次跑，`PW_JSON_REPORT` 写进 `test-results/`，用 `tools/test-report/check-report.mjs` 核对最低条数和关键用例。

### Integration Points
- 修复版本上线后，打开过 `0ba1339903f1` 的设备，以及设备甲上更早的版本，都会出现「有新版本」，这就是验收 E 项的入口。
- 导入后演练依赖新的 `restore-drill.sh` 已由 03 装到服务器（D-02）。
- 第二个测试账号由所有者在后台新建（D-08），Claude 不经手。

</code_context>

<specifics>
## Specific Ideas

- 所有者 2026-11-12："我后续都不参与验收 到时候总体完成并部署到服务器上以后我再来做总体的验收"。所以清单要能一次走完、步骤要白话；推迟下来的各阶段人工项都并进这一份清单。
- 所有者 2026-11-17 把四个待定问题都交给推荐做法（"No preference"）。规划时如果某条推荐需要所有者额外操作，例如新建第二个测试账号、约两台设备同时在场，要在交给所有者的说明里写清楚。

</specifics>

<deferred>
## Deferred Ideas

- **提高 HSTS：** README 计划在"验收通过、见过一次真实的证书续期之后"再提高。本阶段只做 WR-06 的常量，提高本身另行批准。
- **PocketBase 本体升级脚本：** WR-05 的第二种修法，例如新增 `02b-upgrade-pocketbase.sh`。等到真的要升级 PocketBase 时再做。
- **SYNC-F1「两台设备的离线修改都保留」：** Phase 15 留下的待决定项，已经列在 Future Requirements，留给下个里程碑。
- **探针页 CR-01、CR-02：** 只有将来重新用探针测速时才需要先修（Phase 6 审查）。

</deferred>

---

*Phase: 16-release-acceptance*
*Context gathered: 2026-11-17*
