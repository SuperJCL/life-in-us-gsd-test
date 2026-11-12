---
phase: 12-plan-editor
plan: 08
subsystem: phase-closeout-tests-readme
tags: [tests-readme, full-suites, phase-closeout, owner-acceptance, playwright]

requires:
  - phase: 12-plan-editor
    provides: 12-01 到 12-07 的六个 cloud spec、plan-entry.spec.ts、plan-editor.ts、readArchived、confirmMid
provides:
  - tests/README.md 的「Phase 12 的云端用例」一节：六个 cloud spec 各自覆盖的内容、默认套件的 plan-entry 用例、编辑页用例的写法
  - 目录表更新：tests/cloud 行列出六个新 spec，tests/e2e/goals 行加 plan-entry.spec.ts，tests/support 行加 plan-editor.ts 和 readArchived，第 13 节加 confirmMid
  - 阶段收尾证据：完整 cloud 套件 231 条和完整默认套件 193 条都 REPORT OK
affects: [phase-12-verification, phase-13]

actuals:
  tokens: 2600
  tasks: 2
  commits: 1
plan_head_before: 0c8c159587dd0080633bb36665d791e82504bfdc
plan_head_after: a7fc2f792cb8ca9b96f0df4b6c91923582ef22e0

tech-stack:
  added: []
  patterns:
    - "README 的阶段小节仿照 Phase 10、11：新 spec 逐个写覆盖内容，再写 helper 的用法和约定"

key-files:
  created: []
  modified:
    - tests/README.md

key-decisions:
  - "README 里编辑页字段键按应用实际写：力量项字段是 l:<力量项 id>:n、:unit、:def、:target、:note（计划文字里写的 l:<id>:target 是其中一个），另有 fit:note"
  - "第 14、15 节没有把 WR-02 或 IN-05 写成未修复，所以不改；已修复的说明放在新的一节末尾并指向 KNOWN-BUGS.md"

requirements-completed: [PLAN-02, PLAN-03, PLAN-04]

status: complete

coverage:
  - id: D1
    description: "tests/README.md 写明 Phase 12 的六个 cloud spec、plan-entry.spec.ts、plan-editor.ts 和编辑页用例的写法"
    requirement: PLAN-02
    verification:
      - kind: command
        ref: "grep -qF 对 11 个关键词（Phase 12 的云端用例、六个 spec 文件名、plan-entry.spec.ts、plan-editor.ts、confirmMid、readArchived）全部命中；暂存隐私检查打印“隐私检查通过”"
        status: pass
    human_judgment: false
  - id: D2
    description: "完整 npm run test:cloud：231 条 REPORT OK，含四条指定标题"
    requirement: PLAN-04
    verification:
      - kind: e2e
        ref: "npm run test:cloud（低优先级、1 个 worker）；REPORT OK expected=231 flaky=0 unexpected=0"
        status: pass
    human_judgment: false
  - id: D3
    description: "完整默认 npm test：193 条 REPORT OK，含 SAFE-02、plan-entry、SEC-01、BUG-01 四条指定标题"
    requirement: PLAN-02
    verification:
      - kind: e2e
        ref: "npm test -- --workers=1（低优先级）；REPORT OK expected=193 flaky=0 unexpected=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "所有者在真实 Edge 里验收编辑计划页：三条 UI-SPEC backstop、暗色主题、本阶段新写的文案"
    requirement: PLAN-04
    verification: []
    human_judgment: true
    rationale: "按 workflow.human_verify_mode: end-of-phase，由编排者收进阶段验收（UAT），所有者在真实 Edge 里完成；本计划不等待，视为“稍后满足”"
---

# Phase 12 Plan 08: 阶段收尾——测试说明与两个完整套件 Summary

测试说明补上「Phase 12 的云端用例」一节和目录表；完整 cloud 套件 231 条、完整默认套件 193 条各跑一次全部通过；所有者的真实 Edge 验收清单整理好，交给阶段验收。

## 完成了什么

- **Task 1（提交 `a7fc2f7`）：** `tests/README.md` 目录表的 tests/cloud、tests/e2e/goals、tests/support 三行同步，第 13 节 `import-file.ts` 条目后加 `confirmMid`，新增一节「Phase 12 的云端用例」。该节逐个写六个 cloud spec 的覆盖内容，写默认套件的 `plan-entry.spec.ts` 和 `plan-normalize.spec.ts` 新增的四条单元用例，并写编辑页用例的写法：`data-pefield` 键（`g:<id>:name`、`t:<tid>:text`、`l:<id>:<字段>`、`fit:min`/`fit:max`/`fit:note`、`p:<键>:<序号>`）、`data-peact` 加 `data-pekey`、`readEditor` 只返回键和布尔、`readGroups` 只读主列表而「已归档」区用 `readArchived`、`confirmMid`、`app.fake.request(…, { writer: 'synth-other-writer' })`。文件原来是 CRLF 行尾，编辑时保持。
- **Task 2：** 两个完整套件各跑一次，不并发，低优先级、1 个 worker。

### 两个套件的条数和结果

| 套件 | `--list` 实数 | 期望 | 完整运行的最后一行 |
|------|---------------|------|--------------------|
| 默认 `npm test` | 193 | 193 | `REPORT OK expected=193 flaky=0 unexpected=0`（193 passed，约 4.0 分钟） |
| `npm run test:cloud` | 231 | 231 | `REPORT OK expected=231 flaky=0 unexpected=0`（231 passed，约 6.7 分钟） |

两次的指定标题都在报告里：cloud 的四条（D-10 改组名、D-07 编辑期间另一台设备保存、D-02 彻底删除、编辑后导出再导入）和默认的四条（SAFE-02、PLAN-02 本地版无入口、SEC-01、BUG-01）。

## 待所有者在阶段验收中完成

human-check 不由本计划完成，也不等待所有者；按 `human_verify_mode: end-of-phase`，由编排者收进阶段验证，所有者在真实 Edge（假服务器、合成账号）里做。**状态：待所有者在阶段验收中完成**（每一项都尚无结论）。

走查流程（桌面和 375 宽度各一遍）：目标页点「编辑计划」→ 改组名、加组、加任务、上移下移、改每周健身目标、加力量项、改基础标签 → 删一个没有进度的任务（看「撤销移除」）、删一个已完成的任务（看归档确认）→ 在「已归档」区恢复一项、彻底删除一项 → 切换标签和按返回键看离开确认 → 保存，看第二个浏览器窗口几秒内按新计划显示 → 再在第二个窗口打开编辑页、第一个窗口保存，看第二个窗口的提示和三选一 → 换一个服务器计划读不出来的合成账号，看顶部提示，保存后看留底 toast 和「下载留底」→ 导入带“目标组不在计划里”的自定义待办的合成旧备份，读摘要那一句，导入后在目标页「已归档」区找到它。

各计划留给真实浏览器的项：

| 来源 | 待看的内容 |
|------|-----------|
| 12-02 | 导入摘要里自定义待办那一句（「N 条自定义待办的目标组不在计划里，导入后放在目标页底部的「已归档」里。」）；「已归档」区的灰色外观（窄屏、暗色） |
| 12-03 | 粘性保存栏、折叠卡外观（窄屏、暗色）；三句新文案 `T_PE_UNREAD`、`T_PE_UNREAD_NOKEEP`、`T_PE_SAVED_UNREAD`（含「计划已保存，原来读不出来的那一份已在本机留底」） |
| 12-04 | 错误行出现时机和页面下移感；「撤销移除」toast 在窄屏的位置；归档确认框的措辞；20 个组 × 50 项任务的滚动 |
| 12-05 | 错误行、两个天数框同时标红、8 张力量卡的折叠外观（窄屏、暗色） |
| 12-06 | 编辑页「已归档」区折叠外观和长名称单行省略（窄屏下按钮落到第二行、各占一半宽）；三种彻底删除确认框的措辞和红色按钮；上限时「恢复」旁的说明；空计划卡片和本周说明在 375px 下的换行；载入示例计划后的草稿外观 |
| 12-07 | 三选一和 D-08 对话框在 375px 下三个按钮竖排全宽；`#pe-notice` 横幅；三行的容量超限提示下保存栏的高度；D-08 的文字（`T_PE_D8_*`）和「计划已保存，别的设备上的那一版已在本机留底」 |
| UI-SPEC backstop | E2 20 组 × 50 项任务的列表一屏可扫读、展开一组后粘性栏不遮内容（375px 和桌面截图）；E3 50 行任务在 375px 下每行两行高、按钮 44px 触控目标、「上移」「下移」「删除」不挤压；E10 带按钮的两条 toast 在 375px 下完整显示、可换行、按钮可点 |
| 暗色主题 | 编辑页（含展开的卡片）、三选一对话框、目标页「已归档」区，文字对比度够用、不拿警告色当底色 |

所有者 2026-11-11 已确认、不再列入验收的五件事：本周日期列照常显示归档任务的完成记录而分类计数不算它们；找不到组的待办截止提醒照常显示；新力量项的目标值初始为空、必须填写；数值规则只在编辑页；读不出来的账号计划先留底再替换。

截图由编排者在合成账号、假服务器上生成，不进仓库。所有者对每一项的结论（通过，或记为问题交给后续修复）在阶段验收里记录，不在本计划里改应用。

## Deviations from Plan

None - plan executed exactly as written。（plan 里写的字段键 `l:<id>:target` 与应用一致；README 里补全了同一张力量项卡的其他字段键，属于文档详细程度，不是行为偏差。）

## Known Stubs

None。本计划只改 `tests/README.md`，没有应用代码、没有 stub。

## Threat Flags

None。

## Self-Check: PASSED

- `tests/README.md` 存在，含全部 11 个关键词；提交 `a7fc2f7` 在当前分支上。
- `us-journey-tracker.html` 和所有测试文件未改动（本计划只提交了 `tests/README.md`）。
- 提交后没有意外删除的文件。
