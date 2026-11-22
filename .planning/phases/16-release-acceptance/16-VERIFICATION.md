---
phase: 16-release-acceptance
verified: 2026-11-22T18:00:00Z
status: passed
score: 5/5 must-haves verified（其中 2 条实际达成，3 条按所有者决定豁免，见 overrides）
covered_files:
  - .planning/phases/16-release-acceptance/16-01-PLAN.md
  - .planning/phases/16-release-acceptance/16-01-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-02-PLAN.md
  - .planning/phases/16-release-acceptance/16-02-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-03-PLAN.md
  - .planning/phases/16-release-acceptance/16-03-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-04-PLAN.md
  - .planning/phases/16-release-acceptance/16-04-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-05-PLAN.md
  - .planning/phases/16-release-acceptance/16-05-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-06-PLAN.md
  - .planning/phases/16-release-acceptance/16-06-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-07-PLAN.md
  - .planning/phases/16-release-acceptance/16-07-SUMMARY.md
  - .planning/phases/16-release-acceptance/16-08-PLAN.md
  - .planning/phases/16-release-acceptance/16-08-SUMMARY.md
  - deploy/server/03-configure-pocketbase.sh
  - deploy/server/04-start-pocketbase.sh
  - deploy/server/06-install-site.sh
  - deploy/server/restore-drill.sh
  - deploy/site/sw.js
  - us-journey-tracker.html
covered_digest: "v4:sha256:959e22c00f08a600f8020715ce2b76daf28641e2885312e92bb6188b6735dbe5"
behavior_unverified: 0
overrides_applied: 3
overrides:
  - must_have: "两台真实设备分别在中国大陆和美国网络下验收：记一笔几秒内同步到另一台设备，断网时能记录，联网后自动上传；断网刷新、断网冷启动和添加到主屏幕都正常；Phase 10、11、12、14 推迟的人工验收项逐项有结论"
    reason: "所有者 2026-11-18 决定不做总体验收（原话「我决定不做测试」），选择「只跳过验收，照常上线」（16-CONTEXT D-19）。没有人做真机检查；以接受的风险登记，由 cloud 用例的离线冷启动、更新提示和 CSP 覆盖。以后可按 16-ACCEPTANCE.md 补做任何一项（reversible）。"
    accepted_by: "项目所有者（聊天决定，记录于 16-CONTEXT D-19）"
    accepted_at: "2026-11-18T00:00:00Z"
  - must_have: "新功能真机验收：用新建的合成测试账号走一遍空计划起步和从示例里挑；在手机和电脑上记训练、看趋势图，跨设备同步"
    reason: "同上，D-19 跳过。N、W、B-5、B-6 全部记为「不适用」，第二个测试账号没有建。空计划起步、从示例里挑、训练记录和趋势图只有自动化用例覆盖（Phase 14、15 的 cloud 和 e2e 用例），没有真机结论。"
    accepted_by: "项目所有者（聊天决定，记录于 16-CONTEXT D-19）"
    accepted_at: "2026-11-18T00:00:00Z"
  - must_have: "所有者把自己从原 Artifact 导出的旧备份和种子计划导入自己的账号，数据对应正确（以前的力量历史出现在趋势图里）；之后删除测试账号"
    reason: "所有者 2026-11-22 决定先不迁移旧数据，只轻量试用这个记录系统（原话「我觉得这个可以先不做」），导入后恢复演练也先不做（16-CONTEXT D-20，覆盖 D-13、D-14、D-15）。J-1 到 J-7、K、L 记为「不适用」。旧数据仍在所有者自己的旧备份里，可以以后补做（reversible）。"
    accepted_by: "项目所有者（聊天决定，记录于 16-CONTEXT D-20）"
    accepted_at: "2026-11-22T00:00:00Z"
---

# Phase 16: 新版本上线与总体验收 Verification Report

**Phase Goal:** 把含 Phase 14、15 的新版本按升级步骤部署到服务器，然后所有者在中国大陆和美国的两台真实设备上做一次总体验收（之前推迟的人工验收项、新账号的计划起步和健身页都在里面），最后把自己的旧数据搬进新账号、删掉测试账号。
**Verified:** 2026-11-22
**Status:** passed（按所有者决定 D-19、D-20 修订后的目标）
**Re-verification:** No — initial verification

## 先说结论：哪些真做了，哪些是所有者豁免的

**这个结论不是「原目标全部达成」。** 原目标有三段，只有第一段和收口的全量测试是实际做到的；真机总体验收和旧数据迁移没有做，是所有者明确放弃的，在这里记为「豁免」（owner waiver / 接受的风险），**不记为已完成**。

| 原目标的部分 | 结果 | 依据 |
|---|---|---|
| 把新版本按升级步骤部署到服务器 | **实际达成** | 16-05 发布 84d1fc754072，之后 quick 261121-uax 又发布 f99fb5fa3d7d；各自线上全量检查 `VERIFY OK (19 checks)`，只读状态正常（见下，服务器部分我没有重新连接核对） |
| 先让所有设备换成新版本（J 的安全前提 E-5） | **实际达成（所有者确认）** | 所有者 2026-11-22 确认每台设备、每个标签页都能看到「健身」标签和 kg/lb 开关；T-16-24 据此关闭 |
| 两条全量套件通过，OPS-04、TEST-02 收口 | **实际达成** | 我重新用 check-report 核对了 16-08 的两份 JSON 报告：cloud 288、默认 247，flaky 0、unexpected 0、skipped 0 |
| 两台真机、中美网络的总体验收（含 Phase 10–15 推迟的人工项、空计划起步、健身页真机） | **所有者豁免（D-19）** | 没有任何真机结论；所有 A–I、N、W、G 项记为「不适用」 |
| 把旧数据搬进新账号 | **所有者豁免（D-20）** | J-1 到 J-7 不适用；没有迁移 |
| 删掉测试账号 | **结果上已成立，但不是按计划做的** | K 记为不适用；只读状态 `DB_USERS_COUNT=1`、`DB_USERS_NONTEST=1`，线上只剩一个非测试账号。这是 SUMMARY 记录的只读状态，我没有连服务器复核；SUMMARY 没有说明这个账号是怎么建、测试账号是怎么删的 |
| 带真实数据的恢复演练（L） | **所有者豁免（D-20）** | 新增的接受风险：含真实数据的备份没有在真实数据上演练过恢复 |

阶段「完成」的含义因此是：**发布完成、自动化回归完成、真机验收和迁移被所有者放弃。** `16-ACCEPTANCE.md` 的「待修复：无」不代表没有问题，只是没人去找。

## Goal Achievement

### Observable Truths

必备真值取自 ROADMAP 的 5 条成功标准（合同），再合并各计划的 must_haves。

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 新版本按 OPS-03 的升级步骤部署：上传包离线核对校验和，所有者看过命令原文后即时确认，只跑升级脚本；线上检查全部通过；已经打开的旧页面出现「有新版本」提示，点更新后换成新版本 | ✓ VERIFIED | 部署：16-05-SUMMARY 记录 22 行批准清单、`sha256sum -c --strict`、所有者 06:54 UTC 批准并当场确认七条命令原文、03 只装工具文件且 PocketBase 没停、06 分两步 reload、线上全量检查 19 项全过；服务器上演练脚本哈希等于批准清单。第二次发布（261121-uax）同样 13 行清单、只跑 06、`VERIFY OK (19 checks)`。代码侧：`06-install-site.sh` 有 `csp_union` 与 `CSP_TRANSITION`，`restore-drill.sh` 有 40 小时和 `DRILL_DOCS_COMPARED`，`04` 有 unit 备份，`verify-site.mjs` 用 `HSTS_MAX_AGE` 常量，都在仓库里。更新提示和换版：cloud 报告里 8 条 OPS-04 用例（含更新先确认、IN-02 兜底刷新、离线冷启动）全部 expected；E-5 由所有者确认所有设备已是新版本。服务器侧的结果我没有重新连接（受约束），依据是记录在案的只读运行 |
| 2 | 两台真实设备分别在中国大陆和美国网络下验收：同步、断网记录、断网刷新、冷启动、添加到主屏幕；Phase 10、11、12、14 推迟的人工验收项逐项有结论 | ✓ PASSED (override) | 没有做。D-19，所有者 2026-11-18 豁免。**这不是达成。** 自动化替代：cloud 套件 SYNC-01（13 条）、OPS-04（8 条）、SEC-02（2 条）全部通过，但它们是假服务器和本机 Edge，不是真机和真实网络 |
| 3 | 新功能真机验收：空计划起步和从示例里挑；手机和电脑记训练、看趋势图，跨设备同步 | ✓ PASSED (override) | 没有做。D-19 豁免。**这不是达成。** 自动化替代：默认套件中 47 条 FIT- 用例、14 条 PLAN- 用例、cloud 的 fitness-sync 用例全部 expected；没有真机结论 |
| 4 | 所有者导入旧备份和种子计划，数据对应正确（力量历史出现在趋势图）；之后删除测试账号 | ✓ PASSED (override) | 没有做迁移。D-20，所有者 2026-11-22 豁免。**这不是达成。** 仅有的相关证据：J-0（合成文件迁移用例 IO-09，cloud 报告里 3 条 IO-09 全部 expected，含趋势图空心点断言）。测试账号在只读状态里已不存在（见上表） |
| 5 | 最后 `npm test` 和 `npm run test:cloud` 全量通过 | ✓ VERIFIED | 我用 check-report 重核：cloud `REPORT OK expected=288 flaky=0 unexpected=0`，默认 `REPORT OK expected=247 flaky=0 unexpected=0`；两份报告 skipped 为 0，spec 数与 expected 相等（288、247）；报告中 SEC-02、OPS-04、SYNC-01、IO-09、SAFE-02、OPS-03、ENV-03、BUG-01 相关用例无一非 expected。`git diff --quiet 208e1da HEAD -- us-journey-tracker.html deploy tests tools` 成功（无改动），HEAD 的代码就是测过的代码；`APP_SHA256` 常量与应用文件实际 sha256 一致（57be604b…ea908fd）；两份报告的文件时间在 2026-11-22，晚于 208e1da 的提交时间 |

**Score:** 5/5（2 条实际 VERIFIED，3 条 PASSED (override)）。没有 PRESENT_BEHAVIOR_UNVERIFIED 的真值：真值 1 中涉及状态转换的更新提示由已通过的具名 cloud 用例覆盖。

注：「默认套件 247 条通过」里包含 6 条已知 bug 用例按预期失败（test.fail 标记），check-report 把它们算作 expected，这是项目既有的登记方式（KNOWN-BUGS）。

### Deferred Items

无。后续阶段（Phase 16 是 v2.0 最后一个阶段）没有覆盖被豁免的内容；被豁免项靠「以后随时可按 `16-ACCEPTANCE.md` 补做」，不是路线图上的后续阶段。

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `deploy/server/06-install-site.sh` | CSP 原子切换（WR-01） | ✓ VERIFIED | 有 `csp_union`、两步 reload、`CSP_TRANSITION` 输出 |
| `deploy/server/03-configure-pocketbase.sh` | 只装工具不停服务（WR-03） | ✓ VERIFIED | 16-05 实测 PocketBase 全程运行；静态检查 C-25 在默认套件通过 |
| `deploy/server/restore-drill.sh` | 拒绝过旧备份、compared≥1（WR-07） | ✓ VERIFIED | 有 `AGE_H -gt 40` 与 `DRILL_DOCS_COMPARED`（有一个 INFO：年龄正则接受负数，见 REVIEW IN-02） |
| `deploy/server/04-start-pocketbase.sh` | unit 先备份（WR-08） | ✓ VERIFIED | 有 `cp -p` 备份与失败放回（REVIEW IN-01：部分失败路径不放回，INFO） |
| `deploy/site/sw.js`、`us-journey-tracker.html` | IN-02 兜底刷新、IN-06 | ✓ VERIFIED | cloud 的 OPS-04 IN-02 用例通过（REVIEW WR-01、WR-04 见下） |
| `.planning/phases/16-release-acceptance/16-ACCEPTANCE.md` | 唯一验收清单，每项有结论 | ✓ VERIFIED | 每项都有「通过」或「不适用」，写明了 D-19、D-20；没有伪造「通过」 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| 构建产物 | 服务器上的站点 | 批准清单 → 上传 → 06 | ✓ WIRED | 清单哈希、命令哈希、服务器上的演练脚本哈希与批准一致（16-05-SUMMARY） |
| 发布 | 设备换版 | 「有新版本」→ 点更新 → E-5 | ✓ WIRED（自动化加所有者确认） | cloud 更新用例通过；所有者确认设备已换版；真机的横幅和点更新 E-1 到 E-4 没有做 |
| 全量套件 | REQUIREMENTS 的 OPS-04、TEST-02 | 16-08 | ✓ WIRED | REQUIREMENTS 里两条已勾选，追踪表为 `Phase 16 | Complete` |

### Data-Flow Trace (Level 4)

不适用：本阶段是发布、验收记录和部署脚本，没有新增渲染动态数据的组件。

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| cloud 全量报告 | `node tools/test-report/check-report.mjs <16-08 cloud JSON> --min-expected 288` | `REPORT OK expected=288 flaky=0 unexpected=0` | ✓ PASS |
| 默认全量报告 | `node tools/test-report/check-report.mjs <16-08 default JSON> --min-expected 247` | `REPORT OK expected=247 flaky=0 unexpected=0` | ✓ PASS |
| 关键用例逐条非 expected 计数 | 用 node 逐个标题片段统计 | SEC-02、OPS-04、SYNC-01、IO-09、SAFE-02、OPS-03、ENV-03、BUG-01、FIT-、PLAN-0 的非 expected 数都是 0 | ✓ PASS |
| HEAD 与测试代码一致 | `git diff --quiet 208e1da HEAD -- us-journey-tracker.html deploy tests tools` | 退出码 0，之后只有 `.planning/` 文档变化 | ✓ PASS |

（按约束没有运行任何测试套件；以上用 16-08 的全量套件 JSON 报告作为证据。直接按带前缀的短标题调用 check-report 会报「title not run」，因为它要求标题完全相等；这是我传参方式的问题，不是用例缺失，改用上面的片段统计已确认。）

### Probe Execution

SKIPPED：本阶段没有声明 `probe-*.sh` 探针，不适用。恢复演练脚本只安装、未运行（D-20 取消了导入后演练）。

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| OPS-04 | 16-01 到 16-08（全部八份计划的 frontmatter） | 页面打开过一次后，断网时也能打开（冷启动离线），也可以添加到手机主屏幕 | ✓ SATISFIED（自动化覆盖；真机部分被所有者豁免） | cloud 报告 8 条 OPS-04 用例全部通过（离线冷启动、更新先确认、IN-02 兜底刷新等）；真机的冷启动和添加到主屏幕没有所有者确认，按 D-19 作为接受的风险登记。REQUIREMENTS 里按「自动化覆盖加所有者放弃真机验收」标为完成，这个标注如实 |
| TEST-02 | 16-03、16-04、16-08 | 基于模拟 PocketBase 的测试，覆盖登录、云端存取、离线、实时同步、导入导出、编辑计划；不连真实服务器 | ✓ SATISFIED | cloud 288 条、默认 247 条全量通过，flaky 0、unexpected 0；测试全程拦截外部请求 |

Phase 16 在路线图和 REQUIREMENTS 追踪表里只映射了这两个 ID，八份计划的 `requirements` 字段合起来恰好覆盖它们；没有被遗漏的（ORPHANED）需求。

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 本阶段修改过的文件 | — | `TBD`/`FIXME`/`XXX` 债务标记 | — | 没有。唯一命中的是 `05-nginx-app.sh` 里 `mktemp` 模板的 `XXXXXX`，这是文件名模板，不是债务标记，而且该文件不在本阶段改动范围 |

### Code Review 遗留（均不挡阶段，记为警告）

16-REVIEW 的结论是 0 个 BLOCKER、4 个 WARNING、4 个 INFO；16-REVIEW-DISPOSITION 里 8 条都还是 `open`，没有人分流。按本阶段所有者决定和审查结论，它们不挡完成，但需要所有者之后决定修不修：

| ID | 严重度 | 内容 | 我的判断 |
|----|--------|------|----------|
| WR-01 | WARNING | `sw.js` 安装失败时 `caches.delete(CACHE)` 可能删掉正在使用的外壳缓存 | 只在「只改 sw.js 逻辑、外壳版本号没变」的发布里触发；离线可用性受影响，数据不丢 |
| WR-02 | WARNING | F-11 匿名注册探测只看 403，任何一层的 403 都算通过 | 线上检查灵敏度问题 |
| WR-03 | WARNING | ACCT03-6/7 没有锁住声称「实测」的 403、400 | PocketBase 升级后的漂移要到上线后才暴露 |
| WR-04 | WARNING | 点更新后 4 秒兜底刷新会静默丢掉这几秒内新输入的草稿 | 涉及未保存草稿，属于 D-10 里「更新流程」类；窗口很小、只在兜底路径触发，不是已保存数据丢失。如果所有者要补做真机验收，这条值得先修 |
| IN-01 到 IN-04 | INFO | 04 部分失败不放回 unit；演练年龄正则接受负数；C-24 用开发机 awk；HSTS 检查接受 includeSubDomains | 低风险 |

### Human Verification Required

无新增项。所有者已明确放弃真机验收和迁移（D-19、D-20），再把它们列成待办会和所有者的决定冲突。以下是**接受的风险**，这里只作记录，不是阻塞项：

1. 两台真机上的同步速度、断网和冷启动、添加到主屏幕（尤其 iPhone 的 7 天清理）、中国大陆网络下的打开速度，都没有经过真机确认（D-19）。
2. Phase 10 到 15 推迟下来的人工检查（文案、暗色主题、375 px、读屏）没有所有者的结论（D-19）。
3. 空计划起步、从示例里挑、健身页和训练记录没有真机验收（D-19）。
4. 含真实数据的备份没有在真实数据上演练过恢复，要到第一次真的需要恢复时才知道顺不顺利（D-20）。当前线上已有一个非测试账号：只测模式的演练守卫遇到非测试数据会拒绝运行，所以今后验证备份只能用 `--with-real-data` 模式，而这个模式在本阶段没有跑过。唯一通过的恢复演练是 13-13 在还没有真实数据时做的只测模式。
5. 线上现在有 1 个非测试账号，但没有人记录它是怎么建的、测试账号是怎么删的（K 记为不适用）。每天 19:00 UTC 的自动备份和失败邮件仍是唯一的保障。

### Gaps Summary

没有阻塞性缺口。按所有者修订后的目标（发布、设备换版确认、全量回归收口），目标已达成。需要所有者或编排者知道的几点：

- **目标被所有者缩小了，不是被满足了。** 真机总体验收和旧数据迁移是所有者的明确决定（D-19、D-20），验收记录对此如实记为「不适用」，没有伪造通过。
- **簿记还没跟上（建议在关闭阶段时一并更新）：** `ROADMAP.md` 里 Phase 16 仍显示「6/8 plans executed」，16-07、16-08 的计划复选框没勾，阶段列表里 Phase 16 仍是 `[ ]`；`STATE.md` 的状态还是 executing，`stopped_at` 停在 16-07 的检查点，进度 91%。这些不影响代码，但会让后续命令误判阶段没完。
- **ROADMAP 成功标准 2、3、4 的字面内容没有被满足**，只能靠 override 记为豁免。如果将来想把它们当成已完成，需要所有者按 `16-ACCEPTANCE.md` 补做。
- 服务器侧的事实（线上版本、`VERIFY OK`、账号数）来自 SUMMARY 里的只读状态和检查输出，我没有连服务器重新核对（受约束）。

---

_Verified: 2026-11-22_
_Verifier: Claude (gsd-verifier)_
