---
phase: 16-release-acceptance
plan: 04
subsystem: acceptance-prep
tags: [acceptance-checklist, synthetic-data, review-ledger, regression, playwright]

requires:
  - phase: 16-release-acceptance
    provides: "16-01、16-02、16-03 修完的 13-REVIEW 发现（提交哈希是台账的来源）"
provides:
  - "make-acceptance-data 另写 synth-backstop.json：20 个组、每组 50 项任务、3 条记录，被应用认成完整备份"
  - "16-ACCEPTANCE.md：唯一的总体验收清单，73 项，可选恰好 W-7、G-2、D-4、I-2"
  - "13-REVIEW-DISPOSITION.md 收口：18 条 fixed、IN-03 skipped、open 0"
  - "发布前本机全量回归通过：cloud 287 条、默认 239 条、server-check 25 项"
affects: [16-05, 16-06, 16-07, 16-08]

actuals:
  tokens: 21000
  tasks: 3
  commits: 2

plan_head_before: 6ed7e447f70306b57a85be7a863b066bb99528bf
plan_head_after: a5dbe3ab9cee2a178dd9b283be3b55f8c634b6cf

tech-stack:
  added: []
  patterns:
    - "合成文件的输出文件逐个用 git check-ignore 确认被忽略再写（含 test-results/）"
    - "全量套件用一个 node 包装器设 BELOW_NORMAL 优先级，cloud 用后台运行、默认套件前台运行，各自立刻 check-report 核对"

key-files:
  created:
    - .planning/phases/16-release-acceptance/16-ACCEPTANCE.md
  modified:
    - deploy/make-acceptance-data.mjs
    - .planning/phases/13-deploy-hardening-acceptance/13-REVIEW-DISPOSITION.md

key-decisions:
  - "backstop 的 20x50 正好是编辑页的上限 PLAN_MAX（groups 20、tasks 50），所以不需要缩小，也没有停下报告"
  - "合成文件的 git check-ignore 检查从只查 private/ 扩大到两个输出文件的实际路径，test-results/ 下同样先确认被忽略"
  - "清单把 H-2 放进“两台设备同时在场”一节，H 节只剩 H-1、H-3；I-4 编为 L-1，备注写明"

requirements-completed: [OPS-04, TEST-02]

duration: 约 55 分钟（含两条全量套件约 12 分钟）
completed: 2026-11-18
status: complete
---

# Phase 16 Plan 04: 验收清单、合成数据、台账收口和发布前全量回归 Summary

**G-2 的 backstop 合成数据一条命令生成，73 项的 16-ACCEPTANCE.md 写好，13-REVIEW 台账收口为 18 条 fixed、IN-03 skipped、open 0，发布前 cloud 287 条和默认 239 条全量都 REPORT OK。**

注意：frontmatter 的 `requirements-completed` 是照抄计划的 `requirements`，按编排者的要求，OPS-04 和 TEST-02 在 16-08 才收口，这里没有调用 `requirements.mark-complete`。

## 完成的任务

| 任务 | 说明 | 提交 |
|------|------|------|
| 1（tracer） | make-acceptance-data 另写 synth-backstop.json，三条自检 | `d2321bb` |
| 2 | 写 16-ACCEPTANCE.md；13-REVIEW-DISPOSITION.md 收口 | `a5dbe3a` |
| 3 | 发布前本机全量回归（没有提交，报告在被忽略的 test-results/） | 无 |

### Task 1：backstop 生成器输出

- `node deploy/make-acceptance-data.mjs --out test-results/16-04-acc` 打印：
  - `ACCEPTANCE DATA OK logs=12057 bytes=3307555`
  - `BACKSTOP OK groups=20 tasks=1000 logs=3 bytes=52254`
- 同一目录有非空的 `synth-large.json` 和 `synth-backstop.json`，`git check-ignore` 确认被忽略；私有目录 `private/acceptance/` 也被忽略。验证后已删除临时目录。
- 自检：`SELF-TEST OK (18 cases)`（新增三条 backstop 用例）。
- `OPS-03 the deploy tools pass their self-tests …`：REPORT OK expected=2 flaky=0 unexpected=0。
- 隐私检查通过。

### Task 2：清单和台账

- 16-ACCEPTANCE.md：一级说明加 16 节，共 73 个编号项（A0 8、E 6、A 3、B 6、C 4、H-2 1、D 4、N 6、W 7、G 5、H 2、F 4、I 3、J 8、K 3、L 3），16 行“结论：”。
- 可选恰好 4 项：W-7、G-2、D-4、I-2。E 排在 A0 之后、A 之前；J-1 才让所有者建正式账号，准备事项写明正式账号先不要建；L-1 的备注写了“原 CONTEXT 写作 I-4，本清单编为 L-1”；文末有 D-18 的已接受风险表（11 行）和朋友账号说明；没有网址、域名、账号、邮箱和真实内容。
- 13-REVIEW-DISPOSITION.md：16 条新标 fixed（Source 写了 Phase 16 计划号、提交前 7 位和一句修法），WR-04、IN-01 不动，共 18 条 fixed；IN-03 skipped 并写理由；`open: 0`。WR-07 的 Source 写明三处都修了和 `BACKUP_TS` 的残留。
- 隐私检查通过。

### Task 3：发布前全量回归

提交状态：`git status --porcelain -- us-journey-tracker.html deploy tests tools` 为空，测试的代码就是 HEAD `a5dbe3a` 上的代码。

- **cloud：** `npm run test:cloud`，一次完整运行（没有分片），用后台运行、BELOW_NORMAL、1 个 worker，约 7 分钟。报告 `test-results/16-04-t3c.json`。
  `REPORT OK expected=287 flaky=0 unexpected=0`；`--min-expected 287` 通过；SEC-02 CSP、两条 OPS-04（离线、更新）、IN-02 兜底、SYNC-01、IO-09 合成迁移用例六个关键标题都在。
- **默认：** `npm test -- --workers=1`，前台起、超过 3 分钟后被系统转到后台，BELOW_NORMAL，约 4.5 分钟。报告 `test-results/16-04-t3v.json`。
  `REPORT OK expected=239 flaky=0 unexpected=0`；SAFE-02、两条 OPS-03、ENV-03、BUG-01 五个关键标题都在。
- **server-check：** `SERVER-CHECK OK (25 checks)`。
- 两条套件依次跑，没有并发；没有连真实服务器。

## 偏差

无，按计划执行。有几处写法上的小选择：

- 计划只要求对 `private/` 做 `git check-ignore`；生成器现在对两个输出文件的实际路径都检查，`test-results/` 也不例外（比计划更严）。
- 台账里 IN-05、IN-10 的修法按 16-02-SUMMARY 的实际写法记录（restoreEnv、`src` 前要求空白），不是 13-REVIEW 的原文建议。

## 已知存根

无。

## 威胁面

没有新增网络端点、认证路径或信任边界；合成文件只写被忽略的目录，文字全部 `SYNTH-1316 ` 或 `SYNTH-1307 ` 开头（自检核对）。

## 给后续计划的提示

- 16-05 构建的就是这次测过的 HEAD `a5dbe3a` 之后的代码（只多 SUMMARY、STATE、ROADMAP 的提交，不改应用、deploy、tests、tools）；构建前再确认一次这四处没有未提交改动。
- 16-ACCEPTANCE.md 的 A0-1、A0-6 引用 16-05 的输出键（`VERIFY OK (19 checks)`、`DRILL_TOOL=installed`），16-05 的实际输出若有变化要同步改清单。
- 16-01 的提示：导入后演练要用测试账号删完之后的那次自动备份；19:00 UTC 备份到演练之间不要改数据（清单 L 节已写）。

## Self-Check: PASSED

- 文件存在：`deploy/make-acceptance-data.mjs`、`16-ACCEPTANCE.md`、`13-REVIEW-DISPOSITION.md`。
- 提交存在于 HEAD 的祖先：`d2321bb`、`a5dbe3a`；`git rev-list --count 6ed7e44..HEAD` 在 SUMMARY 提交之前为 2，与 frontmatter 的 `commits: 2` 一致。
- 各任务的 verify 命令全部通过（Task 1、2 的自动检查，Task 3 的两条全量加 server-check）。
