# Requirements: 在美国的日子 — v2.0 多账号云端版

**Defined:** 2026-11-06
**Core Value:** 3 个人各自在手机和电脑上随时记一笔：记录按账号隔离、不会丢失，并且在设备之间实时同步，中国和美国都能访问。

v1.0 的需求已归档到 `.planning/milestones/v1.0-REQUIREMENTS.md`。本文件的编号延续 v1.0：已有类别（IO、BUG）接着编号，新类别从 01 开始。

## v2.0 Requirements

### 服务器与可达性（INFRA）

- [x] **INFRA-01**：所有者在阿里云轻量应用服务器香港开出服务器、在 Porkbun 买好 `.vip` 域名后，网址能通过 HTTPS 打开，证书自动申请、自动续期（服务器上已有 nginx 和 certbot）。
- [x] **INFRA-02**：在晚高峰（20:00–23:00）分别从中国大陆电信、联通、移动和美国网络实测打开页面、登录和实时同步，结果记录下来，作为 Phase 10 和 Phase 13 的输入（不论结果都继续用阿里云香港）。（范围按所有者 2026-11-08 的 D-10 修订缩减：美国 1 次短测 + 国内三网拨测基线（非晚高峰），没有国内浏览器实测，详见 06-PROBE-RESULTS.md）
- [x] **INFRA-03**：页面不加载中国大陆可能打不开的外部资源：去掉 Google 字体，PocketBase SDK 与页面同源托管、固定版本。

### 账号与登录（ACCT）

- [x] **ACCT-01**：用户用账号和密码登录；刷新页面或重开浏览器后仍保持登录。
- [x] **ACCT-02**：用户可以退出登录；退出后，本机不留该账号的缓存数据。
- [x] **ACCT-03**：账号只能由所有者在后台创建，网页上无法注册新账号。
- [x] **ACCT-04**：每个账号只能读写自己的数据，用别的账号读不到、也改不了。这一点要在真实 PocketBase 上用合成账号验证。
- [x] **ACCT-05**：登录过期时，本机还没上传的修改不会丢；重新登录后继续上传。

### 云端存储、离线与实时同步（SYNC）

- [x] **SYNC-01**：用户的记录、复盘、任务进度和力量历史存在服务器上；换一台设备登录，看到的是同一份数据。
- [x] **SYNC-02**：同一账号在另一台设备上的修改，几秒内自动出现在这台设备上，并且不打断正在输入的草稿或打开的编辑框。
- [x] **SYNC-03**：断网时照样可以记录，界面显示待上传的数量；联网后自动上传。
- [x] **SYNC-04**：状态栏如实显示当前状态：已同步、保存中、离线、失败重试、登录过期。
- [x] **SYNC-05**：打开应用时先和服务器对账，再允许编辑，免得过期缓存覆盖其他设备的新数据。真冲突时以最后保存的为准，被覆盖的那一版在本机留底，可以下载。
- [x] **SYNC-06**：保存失败会自动重试，不会悄悄丢掉（修 B5）；加载完成之前的编辑也不会被丢弃（修 B3）。

### 个人计划（PLAN）

- [x] **PLAN-01**：每个账号的个人计划都存在自己的账号里，包括目标组、任务、力量项、每周健身目标和预设标签；应用代码里只剩一份合成的示例计划。
- [ ] **PLAN-02**：用户可以在“编辑计划”页增删改目标组、任务、力量项、每周健身目标和基础预设标签，并调整顺序。
- [ ] **PLAN-03**：删除已经有进度的目标组、任务或力量项时，改为归档，日历和时间线里已完成的记录不会消失。
- [ ] **PLAN-04**：编辑计划用草稿方式，点保存才生效，可以取消；离开时如有未保存的修改会提示；保存后其他设备同步。
- [x] **PLAN-05**：现有任务 id 保持不变，旧备份导入后，任务进度仍然对应到正确的任务。

### 导出、导入与迁移（IO，延续 v1.0 编号）

- [x] **IO-06**：用户可以在手机和电脑上下载自己账号的 JSON 备份和日历 CSV，不再依赖 Claude 的下载能力。
- [x] **IO-07**：导入前先识别文件格式。不是备份的文件（包括 `{}`）直接拒绝并提示，数据保持不变（修 N3）。
- [x] **IO-08**：导入前显示摘要并要求确认；导入之前自动留一份快照，导入后可以撤销。
- [ ] **IO-09**：所有者能把原 Artifact 导出的旧备份导入到自己的新账号，记录和计划进度都对应正确。迁移流程先用合成文件演练。
- [x] **IO-10**：取消导入后，可以再次选择同一个文件（修 B2）。

### 安全与隐私（SEC）

- [x] **SEC-01**：用户输入的文字在页面上显示时都经过转义；导入文件里或同步过来的恶意脚本不会执行。
- [ ] **SEC-02**：网站发出 CSP 和安全响应头；后台管理入口启用强密码、两步验证和登录限流。
- [x] **SEC-03**：公开仓库里不出现服务器地址、域名、密钥、后台密码、个人计划文字或真实数据；隐私检查为此新增对应规则。
- [x] **SEC-04**：去掉个人计划后的应用程序放进公开仓库。克隆后不配服务器也能跑测试和本地体验，看到的是示例计划和空记录。

### 运维（OPS）

- [ ] **OPS-01**：服务器每天自动备份数据库，并复制一份到服务器以外（Cloudflare R2）；做过一次恢复演练。
- [ ] **OPS-02**：服务器重启后，PocketBase 和 HTTPS 自动恢复，不需要手动操作。
- [ ] **OPS-03**：部署和升级有写好的步骤和脚本；PocketBase 固定版本，安装前核对校验和。
- [ ] **OPS-04**：页面打开过一次后，断网时也能打开（冷启动离线），也可以添加到手机主屏幕。

### 测试（TEST）

- [x] **TEST-01**：v1.0 的 154 条测试在新版应用上继续通过，走旧路径；应用 sha256 基线机制随应用改动更新。
- [ ] **TEST-02**：新增基于模拟 PocketBase 的测试，覆盖登录、云端存取、离线、实时同步、导入导出和编辑计划；测试运行时不连接任何真实服务器。
- [x] **TEST-03**：N3 和 B2 的已知 bug 用例翻转为正常通过的断言，`tests/KNOWN-BUGS.md` 同步更新。
- [x] **TEST-04**：在一次性的本机 PocketBase 上，用合成账号验证账号隔离。下载 PocketBase 二进制需要用户批准，这项验证不进默认的 `npm test`。

## Future Requirements

已确认但推迟，不在本里程碑的路线图里。

- **SYNC-F1**：冲突时，logs 按 id 取并集，并维护已删除列表（墓碑），避免另一台设备的新增记录被覆盖。
- **PLAN-F1**：计划页支持跨组移动任务、拖拽排序。
- **ACCT-F1**：在一个标签页退出后，其他标签页同步退出。
- **IO-F1**：导出失败时，用系统分享（Web Share API）兜底。
- **TEST-F1**：覆盖 mock 的错误路径，包括保存失败、限流、断网中途重置等。
- **CONC-F1**：处理 `.planning/codebase/CONCERNS.md` 里其余与本里程碑无关的问题。

## Out of Scope

| Feature | Reason |
|---------|--------|
| 开放注册、邀请码注册 | 用户选择由自己在后台开 3 个账号 |
| 查看别人的记录 | 用户选择各看各的，账号之间完全隔离 |
| 忘记密码邮件、第三方登录、多账号切换 | 3 个人自用，密码由所有者在后台重置 |
| 重做界面 | 保留现有四个视图，只新增登录页和编辑计划页 |
| 中国大陆的服务器 | 需要 ICP 备案；改用香港 |
| 访问、修改、重新发布托管的 Claude Artifact | 保护原应用；迁移只靠用户自己导出 JSON |
| 引入 React、Next.js 等前端框架 | 前端保持原生单文件，后端用 PocketBase |
| 原生手机 App、付费、广告、推送通知 | 3 个人自用，浏览器就够；Vercel 等免费方案已不再使用 |
| 字段级合并、版本历史、可编辑类别、“恢复默认计划”、合并式导入、应用内管理后台 | 复杂度高，与 3 人自用的核心价值无关 |
| CN2 GIA 等高价线路 | 超出预算，先用普通线路实测 |

## Traceability

每条 v2.0 需求只对应一个阶段。阶段详情见 `.planning/ROADMAP.md`。

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 6 | Complete |
| INFRA-02 | Phase 6 | Complete |
| INFRA-03 | Phase 9 | Complete |
| ACCT-01 | Phase 9 | Complete |
| ACCT-02 | Phase 9 | Complete |
| ACCT-03 | Phase 8 | Complete |
| ACCT-04 | Phase 8 | Complete |
| ACCT-05 | Phase 10 | Complete |
| SYNC-01 | Phase 9 | Complete |
| SYNC-02 | Phase 10 | Complete |
| SYNC-03 | Phase 10 | Complete |
| SYNC-04 | Phase 10 | Complete |
| SYNC-05 | Phase 9 | Complete |
| SYNC-06 | Phase 10 | Complete |
| PLAN-01 | Phase 9 | Complete |
| PLAN-02 | Phase 12 | Pending |
| PLAN-03 | Phase 12 | Pending |
| PLAN-04 | Phase 12 | Pending |
| PLAN-05 | Phase 7 | Complete |
| IO-06 | Phase 11 | Complete |
| IO-07 | Phase 11 | Complete |
| IO-08 | Phase 11 | Complete |
| IO-09 | Phase 11 | Pending |
| IO-10 | Phase 11 | Complete |
| SEC-01 | Phase 7 | Complete |
| SEC-02 | Phase 13 | Pending |
| SEC-03 | Phase 6 | Complete |
| SEC-04 | Phase 7 | Complete |
| OPS-01 | Phase 13 | Pending |
| OPS-02 | Phase 13 | Pending |
| OPS-03 | Phase 13 | Pending |
| OPS-04 | Phase 13 | Pending |
| TEST-01 | Phase 7 | Complete |
| TEST-02 | Phase 8 | Pending |
| TEST-03 | Phase 11 | Complete |
| TEST-04 | Phase 8 | Complete |

**Coverage:**
- v2.0 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-11-06*
*Last updated: 2026-11-08 after Phase 6 D-01 (provider, domain suffix and web server wording)*
