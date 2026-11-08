---
gsd_state_version: "1.0"
milestone: v2.0
milestone_name: 多账号云端版（Multi-account Cloud）
current_phase: 8
current_phase_name: PocketBase 规则、隔离与假服务器（Rules, Isolation & Fake Server）
status: planning
stopped_at: Phase 06 complete, ready to plan Phase 8
last_updated: "2026-11-08T18:24:41.893Z"
last_activity: 2026-11-08
last_activity_desc: Phase 06 complete, transitioned to Phase 8
state_head: ae0d8d3efcc912dc8ebd133cf316d984eb69b206
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 17
  completed_plans: 17
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-07 after Phase 7)

**Core value:** 3 个人各自在手机和电脑上随时记一笔：记录按账号隔离、不会丢失，并且在设备之间实时同步，中国和美国都能访问。
**Current focus:** Phase 6 — 采购与中美可达性实测（Procurement & Reachability Probe）

## Current Position

Phase: 8 — PocketBase 规则、隔离与假服务器（Rules, Isolation & Fake Server）
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-08 — Phase 06 complete, transitioned to Phase 8

Progress: [███░░░░░░░] 25%


## Performance Metrics

**Velocity:**
- Total plans completed: 37
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 4 | - | - |
| 2 | 5 | - | - |
| 3 | 4 | - | - |
| 4 | 3 | - | - |
| 5 | 4 | - | - |
| 7 | 7 | - | - |
| 06 | 10 | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 4 min | 3 tasks | 8 files |
| Phase 01 P02 | 7min | 2 tasks | 9 files |
| Phase 01 P03 | 16 min | 3 tasks | 6 files |
| Phase 01 P04 | 25 min | 2 tasks | 2 files |
| Phase 02 P01 | 12 min | 3 tasks | 10 files |
| Phase 02 P02 | 8 min | 2 tasks | 8 files |
| Phase 02 P03 | 11min | 3 tasks | 9 files |
| Phase 02 P05 | 13 min | 3 tasks | 4 files |
| Phase 02 P04 | 8min | 3 tasks | 5 files |
| Phase 03 P01 | 25 min | 2 tasks | 6 files |
| Phase 03 P04 | 20min | 2 tasks | 4 files |
| Phase 03 P02 | 32 min | 3 tasks | 8 files |
| Phase 03 P03 | 19 min | 3 tasks | 7 files |
| Phase 04 P01 | 11 min | 3 tasks | 9 files |
| Phase 04 P02 | 6 min | 2 tasks | 6 files |
| Phase 04 P03 | 11 min | 3 tasks | 7 files |
| Phase 05 P01 | 20 min | 2 tasks | 4 files |
| Phase 05 P02 | 25 min | 2 tasks | 4 files |
| Phase 05 P04 | 30 min | 2 tasks | 5 files |
| Phase 05 P03 | 25min | 3 tasks | 3 files |
| Phase 07 P01 | 45 min | 2 tasks | 3 files |
| Phase 07 P02 | 10 min | 2 tasks | 7 files |
| Phase 07 P03 | 9 min | 2 tasks | 5 files |
| Phase 07 P04 | 8 min | 3 tasks | 11 files |
| Phase 07 P05 | 12 min | 2 tasks | 5 files |
| Phase 07 P06 | 25min | 2 tasks | 4 files |
| Phase 07 P07 | 20 min | 2 tasks | 2 files |
| Phase 06 P01 | 7 min | 3 tasks | 2 files |
| Phase 06 P02 | 2 min | 2 tasks | 5 files |
| Phase 06 P03 | 8 min | 3 tasks | 3 files |
| Phase 06 P04 | 25min | 3 tasks | 5 files |
| Phase 06 P05 | 8 min | 3 tasks | 8 files |
| Phase 06 P06 | 20min | 3 tasks | 6 files |
| Phase 06 P07 | 25 min | 3 tasks | 7 files |
| Phase 06 P08 | multi-session | 3 tasks | 0 files |
| Phase 6 P09 | multi-session | 2 tasks | 1 files |
| Phase 6 P10 | multi-session | 4 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table. v1.0 的逐阶段决定已随归档保存在 `.planning/milestones/v1.0-phases/` 各阶段的 CONTEXT 和 SUMMARY 里。

仍然有效的工作方式：
- 测试一律低优先级、单 worker 运行，不同时跑两次，不做全盘扫描；`playwright.config.ts` 按用户决定保持默认值。
- 公开仓库：应用原文件、真实数据、本机路径、真实邮箱不进 git，提交和推送前都跑隐私检查；推送前要用户确认。
- 子代理不得运行 `npx --no playwright` 以外的任何 npx（AR-03-01 的教训）。

v2.0 路线图（2026-11-06）：
- 粒度 coarse，调研建议的 11 个阶段合并成 8 个：离线与实时合并为 Phase 10；验收并入部署（Phase 13）；规则与隔离脚本和假服务器合并为 Phase 8，让假服务器直接按真实实例录下的协议样本来做。规则与隔离（Phase 8）没有和登录与云端存储（Phase 9）合并。
- SEC-03 放在 Phase 6：域名和服务器地址一出现，隐私检查就要能拦住。SEC-04 放在 Phase 7：计划外置之后，应用文件才能进公开仓库。
- INFRA-03（去掉 Google 字体、SDK 同源）整体放在 Phase 9，因为页面从这一阶段起才加载 SDK。
- 需要阶段调研：Phase 6、8、10、13。需要 UI 设计契约：Phase 9（登录页和状态栏五种状态）、Phase 12（编辑计划页）。
- [Phase 07]: 07-01: rule D term source is the local seed plus private/denylist.txt; filter unchanged, no allowlist (D-04, D-06)
- [Phase 07]: 07-01: seedGate fails closed (exit 2) when the repo-root app file is in scope and no private/plan-seed.json exists; an empty seed is the explicit opt-in
- [Phase 07]: plan 对象形状 {v, presets, groups, lifts, fitGoal, fitNote}；normalizePlan 任何一处不合格整份返回 null，usePlan 回落到 DEFAULT_PLAN
- [Phase 07]: 自定义待办改为 planIds.has 判断；内置 id 冻结为显式字面量，新增项用 g-、t-、l- 前缀
- [Phase 07]: USJ_CONFIG 配置缝只读 backend 一个字段；backend 非 null 时 init 停在加载之前、store 保持 null，显示配置无效且不保存，不退回本地（Phase 9 在此接云端存储）
- [Phase 07]: 07-04: 规则 A 放行根目录应用文件，子目录同名文件和改名副本仍禁止；应用与护栏在同一次本机提交（ad258c0）里第一次进入 git，未推送，等待所有者确认推送
- [Phase 07]: 07-04: 所有者批准示例计划的条件是先改复盘占位提示和引体 note 两处文字；.githooks/* 不改（D-13），钩子验收靠一次性克隆里的 pre-commit 实跑
- [Phase 07]: 07-05：转义只在渲染时做，恶意字符串原样保存和显示；力量历史逐项 esc(x.v)，saveLift 的 toast 用字符串拼接
- [Phase 07]: 07-05：用只在内存里改应用的变体（page.route）分别证明渲染防线和检测器，源码门槛带去掉 esc 的对照
- [Phase 07]: 07-06: import whitelist rejects whole backup (only exemptions: non-plain-object top level, non-string arrival); load repairs, orphan progress keys dropped (owner confirmed)
- [Phase 07]: 07-06: orphan-key repair must run only after the account plan is known (Phase 9 hand-off note)
- [Phase 07]: 07-07: real-app case (no variant) proves both defenses together; plan values proven only by the 07-05 in-memory variant case; full suite 173 expected, 0 flaky; nothing pushed, awaiting owner confirmation
- [Phase 06]: 06-01: privacy rule G variable names must not look like secret keys assigned a string; renamed checker word list to CRED_WORDS instead of adding an exemption
- [Phase 06]: 06-01: live term self-test counts rule D findings only, since a denylist term can also trip rule H
- [Phase 06]: 06-02: 不论实测结果都继续用阿里云香港（D-08），Web 服务用已有 nginx 加 certbot（D-02）；SDK 0.28.1 改动只记待办（D-15）
- [Phase 06]: 06-03: tz_offset_min = local minus UTC (Beijing 480); probe page must upload -getTimezoneOffset(); started_at accepts only ISO with timezone — Deterministic local time and slot labels regardless of the machine running summarize.mjs
- [Phase 06]: 06-03: idle-disconnect flag baselines on the last delivered ping (lost pings excluded, else t=0), window 295-320 s, annotation only — A literal reading never fires with pings every <=180 s; lost pings are the only way idle disconnects show up
- [Phase 06]: 06-04: --check and default mode of redact.mjs both exit 2 when private/server.env and denylist are missing; IPv6 redaction needs a 2xxx/3xxx first group plus :: or 8 groups
- [Phase 06]: 06-05：探针页登录成功后才建立实时连接；打点照常发出，丢失记 null；结束时 authStore.clear()；SDK 固定 0.28.1（所有者批准，sha512/sha1 核对一致）
- [Phase 06]: 06-06：admin 免密 sudo 已确认（D-04a）；所有者对批次 A 选 approve-all，5 个文件按 sha256 清单批准，执行在 06-08；02 脚本头部注释一处不准确，按原样批准、不改
- [Phase 06]: 06-07: nginx 片段按 D-13 反代 /_/（不是 404），不在 server 层加指令，每个位置自带 add_header 和 access_log off
- [Phase 06]: 06-07: 批次 B 必须按 04、05、06 顺序执行，06 最后删除上传目录；04 的超级用户只读查询用 pocketbase 用户运行
- [Phase 06]: 06-08：批次 A 已执行，PocketBase 0.41.1 装好未启动，所有者自己建了超级用户（个数 1）；批次 B 的 10 个文件由所有者 approve-all 批准，执行在 06-09
- [Phase 6]: 06-09: batch B executed exactly as approved (3 sha256 checks passed); 00-status.sh settings read fixed (read-only, not in any approval batch)
- [Phase 6]: 06-10 导出批准（D-17）：所有者回复“批准”；sha256 行 9f9b63cefb2d5274e497593a3a9b492eea02a60a5e2228cdaec1c434a0b2b8d9 *tools/probe/server/export-results.py；命令为 set -o pipefail 后的 sha256sum -c --strict 核对链加 ssh -o BatchMode=yes usj 'sudo -n python3 -I -' < tools/probe/server/export-results.py > private/probe-results/<YYYYMMDD-HHMM>.json；输出位置 private/probe-results/（被 git 忽略）；共覆盖 2 次导出，第 1 次已用（文件 20261108-0929.json），第 2 次留给 Task 4；其他服务器到本机传输需另行批准
- [Phase 6]: 06-10 Task 2 完成：导出 #1 共 2 条（1 条 smoke，1 条所有者短测 dur_s=90、login_ok 为真、打点 2/2），summarize 三个标题齐全，短测和 smoke 都计为无效；不写 06-10-SUMMARY，计划保持打开
- [Phase 6]: D-10 修订（2026-11-08，所有者）：不做多晚实测；浏览器实测只算所有者在美国的那次 90 秒短测，另由所有者自己跑一次 itdog（HTTP 测速和 tcping 443）作为国内三网的基线；结论写明样本不足（国内没有真实浏览器数据），D-08 不变。详见 06-CONTEXT.md 的 D-10 修订
- [Phase 6]: 已知限制：所有者短测上传的 tz_offset_min 是 0。原因是探针页 bug（06-REVIEW CR-01：num() 把数字截成不小于 0），与浏览器设置无关；summarize 因此会把美国晚高峰记成其他时段。结果文档已写进已知限制和 Phase 13 修复项
- [Phase 6]: 推送检查加窄例外清单 tools/privacy/push-exceptions.txt（cae2c04）。只按「提交号+文件+行号」放行规则 H，只放行 08eb8dc 和 cd645d6 里 06-RESEARCH.md:767 那个已在 0fa5cea 改掉的示例地址；所有者选了这个办法，没有改写历史
- [Phase 6]: 06-10: INFRA-02 completed under the owner's D-10 revision (US 90 s short test, invalid; mainland carriers only an off-peak boce.com baseline, no browser data); D-08 stays on Alibaba Cloud HK; Phase 10 polling set to the conservative 60 s

### Pending Todos

所有者操作（Claude 不代办）：
- Phase 6：服务器和域名已买好（阿里云轻量应用服务器香港 + Porkbun 域名，DNS 和 HTTPS 已通，证书自动续期已验证；IP 和域名只记在被 git 忽略的 `private/denylist.txt`）。晚高峰实测已按 D-10 修订缩减并完成（06-10，见 06-PROBE-RESULTS.md）；Phase 13 要用国内三网和美国的真实设备做完整验收。
- Phase 8：批准下载 PocketBase 二进制（放临时目录，只用合成数据）。
- Phase 8、9（来自 Phase 6 D-15）：前端 SDK 不用 0.28.2，改用 0.28.1（探针页已用 0.28.1 并固定文件哈希，见 tools/probe/page/vendor/README.md）；Phase 8 规划时把 ROADMAP 共同约束、Phase 8 成功标准 3 和 .planning/research/STACK.md 里的 0.28.2 一起改。
- Phase 6、13：批准每个在服务器上执行的脚本，在服务器上输入凭据。
- Phase 13：开 Cloudflare R2 存储桶和密钥，从原 Artifact 导出自己的备份，用真实设备验收。

### Blockers/Concerns

- [Phase 6 执行时注意，来自规划]: 本机 Git Bash 的 `sha256sum` 输出 `<hash> *<file>`（路径前是星号，不是两个空格）。06-06、06-08 的批准清单按两个空格匹配，执行到那里会安全地停下（不会执行未批准的脚本）。派执行代理时要让它同时接受两种分隔（例如匹配 `[ *]`，或生成清单时用 `sha256sum --text`），这算阻塞问题的就地修正，不改批准流程。

没有阻塞项。v1.0 的遗留项（INFO、Phase 1 未做安全审计、IN-10）记在 `.planning/MILESTONES.md`。

- [方向变化，非阻塞]: 用户在 2026-11-05 决定下一个里程碑做多账号云端版。几个约束需要在新里程碑里重新讨论：
  - “不改应用”“不部署”“不用真实数据”“不引入框架”；
  - 原 Artifact 仍然不访问、不修改。
  - 已定：新约束写进 PROJECT.md 的 Constraints，v2.0 需求和路线图都按它来。
- [部署，调研中]: 用户希望中国和美国都能访问。查到的情况：Vercel 的 `*.vercel.app` 在中国大陆可能被屏蔽或限速，Vercel 官方建议用自定义域名；Firebase 在中国不可用；`supabase.co` 没查到 2026 年在中国被屏蔽的报告，需要实测；香港或东京的云服务器不需要 ICP 备案。
  - 已定（2026-11-07 更新，Phase 6 D-01 已落实）：所有者实际买的是阿里云轻量应用服务器香港（不是调研推荐的那家），服务器上已有 nginx 和 Let's Encrypt 证书，所有者选择继续用 nginx。规划文档里的服务商和 Web 服务器写法已在 Phase 6 改掉（D-01）。自托管 PocketBase 不变；不论实测结果都继续用阿里云香港（D-08）。
- [Phase 9，来自 Phase 7]: 加载时丢弃孤儿进度键的修正，必须等账号的计划加载完才能运行，不能对着还没加载的计划或兜底的示例计划跑，否则会把真实进度当孤儿删掉。
- [Phase 12，来自 Phase 7 审查]: WR-02（自定义待办的组不在当前计划里时看不到、删不掉）和 IN-05（`archived` 还没有行为）推迟到编辑计划页处理。
- ~~06-04: private/server.env missing~~ 已解决（2026-11-07）：所有者在会话中给过域名和 IP，编排器据此建好被忽略的 private/server.env，`redact.mjs --verify-env` 输出 ENV REDACTION OK。
- ~~waiting on 06-10 Task 3~~ 已解决（2026-11-08）：所有者按 D-10 修订做了一次 boce.com 拨测基线，06-10 完成；导出批准的两次已用完，再导出需另行批准

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | 把 .claude/CLAUDE.md 的 Project 段同步到 v2.0（只重新生成 Project 段，其余段落不变） | 2026-11-06 | e6c8c2c | — |
| 2 | privacy-check --push 加窄例外清单，放行已在 0fa5cea 修正的示例地址（2 处，规则 H），自检 193 项通过 | 2026-11-08 | cae2c04 | — |

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-11-08T18:04:43.343Z
Stopped at: Phase 06 complete, ready to plan Phase 8
Resume file: None

## Operator Next Steps

- Phase 7 已推送（所有者 2026-11-07 确认），安全审计 27/27 关闭（`07-SECURITY.md`）
- 下一阶段：`/gsd-discuss-phase 6`（晚高峰实测，并把服务器改成阿里云、nginx 的写法），或先 `/gsd-discuss-phase 8`（PocketBase 规则与假服务器，不依赖 Phase 6）
