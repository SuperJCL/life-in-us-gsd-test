---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 07
subsystem: security-testing
tags: [sec-01, sec-04, test-01, escaping, real-app-case, readme, full-suite, privacy]

requires:
  - phase: 07-05
    provides: "渲染转义、readInjection、maliciousState()、变体用例和源码门槛"
  - phase: 07-06
    provides: "入口防线：导入白名单 importProblem、加载时的深度修正 normalize"
provides:
  - "escaping.spec.ts 的第五条 SEC-01 用例：磁盘上的真实应用（没有任何内存变体）用合成恶意数据开局，两道防线合在一起成立"
  - "tests/README.md 里 tests/e2e/security/ 目录、loadAppPure 和 serveAppVariant 两个白盒 helper、导入白名单的说明"
  - "本阶段最后一次完整套件：173 条 expected、0 flaky、0 unexpected；全量隐私检查通过；没有推送"
affects: [phase-09, phase-11]

actuals:
  tokens: 12000
  tasks: 2
  commits: 2
plan_head_before: f104ee5cfb77d4fcc6f27f19d7e05092f9d34d3f
plan_head_after: 28f0d866fcd0e98da51f359837c3e098d585b899

tech-stack:
  added: []
  patterns:
    - "两道防线（入口修正、渲染转义）各自用变体证明，再用一条不带变体的真实应用用例证明合在一起"
    - "真实应用用例的期望（id、日期格式）在用例里独立写出，不从应用里取"

key-files:
  created: []
  modified:
    - tests/e2e/security/escaping.spec.ts
    - tests/README.md

key-decisions:
  - "真实应用用例只放状态数据；计划值的载荷由 07-05 的计划值变体用例证明，两条在完整套件里常驻"
  - "本计划不改应用，APP_SHA256 不变，用例第一次运行就通过，没有需要修的防线缺口"

requirements-completed: [SEC-01, TEST-01, SEC-04]

coverage:
  - id: D1
    description: "真实应用上两道防线合在一起：四个视图和两个编辑弹窗没有脚本执行、没有多出元素，恶意文字原样显示，坏 id 和日期已修正，保存的数据只含合格的 id 和日期、记录文字都在"
    requirement: SEC-01
    verification:
      - kind: e2e
        ref: "tests/e2e/security/escaping.spec.ts#SEC-01 malicious text in every field renders as plain text in the four views and both editors"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/README.md 说明 security 目录、两个白盒 helper 和导入白名单（含点名的 v1 输入）"
    requirement: SEC-01
    verification:
      - kind: other
        ref: "grep -qF 'tests/e2e/security/' / 'loadAppPure' / 'serveAppVariant' tests/README.md"
        status: pass
    human_judgment: false
  - id: D3
    description: "完整套件 173 条 expected、0 flaky，v1 的 154 条含 8 条已知 bug 标记用例照旧，本阶段新增的 19 条通过"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "npm test（低优先级、单 worker）+ tools/test-report/check-report.mjs --min-expected 173：REPORT OK expected=173 flaky=0 unexpected=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "全量隐私检查通过；private/ 不在仓库里；本阶段没有推送"
    requirement: SEC-04
    verification:
      - kind: other
        ref: "node tools/privacy/privacy-check.mjs --all；git ls-files private；git cat-file -e origin/main:us-journey-tracker.html"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 07: 两道防线合在一起的真实应用用例、README 说明与阶段末完整套件 Summary

**不带任何内存变体的真实应用用合成恶意数据开局：四个视图和两个编辑弹窗没有脚本执行、没有多出元素，恶意文字原样显示，坏 id 和日期已被入口修正，保存的数据只含合格 id 和日期、五条记录文字都在；完整套件 173 条一次通过（0 flaky），全量隐私检查通过，未推送。**

## Performance

- **Duration:** 约 20 分钟（含 3.4 分钟的完整套件）
- **Completed:** 2026-11-07T19:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **真实应用用例（Task 1，tracer）：** `SEC-01 malicious text in every field renders as plain text in the four views and both editors`。不调用 serveAppVariant，账户模式加 maliciousState() 开局：
  - `readInjection` 在 8 个位置都干净（flag 0、带标记元素 0、多出元素 0、带 on 属性元素 0、脚本数 1）：本周、日历（今天的日面板）、目标、时间线、composer（语言类别）、记录编辑弹窗（标签注入那条记录）、完成计划弹窗（今天完成的自定义待办）、哨兵保存之后。
  - 本周：标签注入和脚本载荷按原样出现在条目文字里；复盘文本框的值等于标签注入载荷；页面上没有 `dataset.edit` 等于 id 载荷的元素。
  - 目标：双引号载荷是那条待办的文字；没有 `dataset.task` 等于坏待办 id 的元素。
  - composer：语言类别的预设标签里有标签注入载荷，文字和 `data-preset` 属性都原样往返。
  - 记一条哨兵后的保存数据：记录 id 全部匹配 `^[A-Za-z0-9_-]{1,64}$`、日期全部匹配合格日期格式（正则在用例里独立写出）；五条合成记录的文字都在（共 6 条含哨兵）；待办 4 条，id 都以 `c-` 开头。
- **README（Task 2）：** § 5 目录表新增 `tests/e2e/security/`；§ 13 新增 `app-source.ts`（loadAppPure）和 `app-variant.ts`（serveAppVariant）两条白盒 helper 说明；§ 15 新增“导入白名单”：坏 id 或日期整份拒绝；容器里能识别出条目就检查，只剩顶层不是普通对象和非字符串 arrival 两条豁免；点名的 v1 输入（`{}`、`{ logs: [] }`、`null`、`[]`、synth-wrong-types.json）保持 v1 结果，与 N3 同类，Phase 11 处理；加载时只修正不拒绝，记录文字不删。
- **完整套件（本计划唯一一次，低优先级、单 worker、PW_JSON_REPORT）：** `REPORT OK expected=173 flaky=0 unexpected=0`，用时 3.4 分钟。check-report 点名的标题全部实际运行并通过：本阶段新增的 SEC-01、PLAN-05、SEC-04、TEST-01 用例（含 07-05 的计划值用例）、两条 SAFE-02，以及 8 条已知 bug 标记用例（B1 两条、N1 三条、B4、B2、N3，它们是预期失败，仍然是预期失败，没有变红）。
- **全量隐私检查：** `privacy-check.mjs --all` 通过（202 个文件）；`extract-plan.mjs --check` 为 CHECK OK。
- **不变量：** playwright.config.ts、package.json、package-lock.json、tests/support/test.ts、tests/support/app.ts、tests/mocks、check-report.mjs、.githooks 的对象哈希与阶段前一致；`us-journey-tracker.html`、tests、tools、PRIVACY.md 没有未提交改动；`git ls-files private` 为空；origin/main 上没有应用文件。
- **未推送，等待所有者确认推送。** 本阶段（07-04 以来）的应用改动和测试都只在本机 main 上，没有运行任何推送命令。

## Task Commits

1. **Task 1（tracer）：两道防线合在一起的真实应用用例** - `fa3c1cf`（test）
2. **Task 2：README 说明** - `28f0d86`（docs）

**Plan metadata:** 见下方 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）。

## Files Created/Modified

- `tests/e2e/security/escaping.spec.ts` - 第五条 SEC-01 用例，加文件头注释里对应的一段，新增 composer、SCRIPT_PAYLOAD、DQ_PAYLOAD 的导入
- `tests/README.md` - 目录表一行、两个白盒 helper、导入白名单一条

## Decisions Made

- 真实应用用例只放状态数据，不碰计划值（计划值没有外部入口，D-11，由 07-05 的计划值变体用例证明）。
- 提交署名用本会话运行时给出的 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`（计划文字里的 Opus 5.5 只是示例）。

## Deviations from Plan

None - plan executed exactly as written。用例第一次运行就通过，两道防线没有缺口，应用没有改动，APP_SHA256 不变。

## Issues Encountered

- 第一次写入新用例时 shell 里的 heredoc 嵌套出了一个多余警告，但文件改动正确（五个 SEC-01 标题、导入齐全）；之后的运行和提交内容没有受影响。
- 完整套件结束后，我额外启动的一个等待循环没有用到（运行本身已完成），没有产生任何测试运行。

## Known Stubs

None - 没有占位或空数据流入界面。

## Threat Flags

None - 本计划只改测试和说明文档，没有新的网络端点、认证路径或信任边界上的改动。T-07-24 由真实应用用例关闭，T-07-25 由“origin/main 上没有应用文件、没有运行任何推送命令”关闭，T-07-SC 没有新增依赖也没有运行安装命令。

## Next Phase Readiness

- Phase 7 的 7 份计划都已完成，可以进入阶段验证（`/gsd-verify-work`）。
- 推送公开仓库需要所有者另外明确确认；推送前的检查由 pre-push 钩子再做一次。
- 给 Phase 9 的提醒（见 07-06）：计划和状态分开加载之后，孤儿进度键修正要在账户计划已知之后才能运行。

## Self-Check: PASSED

- `tests/e2e/security/escaping.spec.ts`、`tests/README.md` 存在；提交 `fa3c1cf`、`28f0d86` 是 HEAD 的祖先；五条 SEC-01 用例的目标运行和完整套件都是 REPORT OK；`private/` 没有被暂存，没有推送。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
