# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — 本地测试环境（Local Test Harness）

**Shipped:** 2026-11-05
**Phases:** 5 | **Plans:** 20 | **Sessions:** 2

### What Was Built
- 项目内 Playwright 1.64.1 驱动本机 Edge，`npm test` 一条命令跑完 154 条用例。用例覆盖本周、日历、目标、时间线四个视图，以及编辑弹窗、导入导出和窄屏布局。
- 测试安全护栏：外网三层拦截、固定时钟、页面错误护栏、应用 sha256 基线，每一道都有故意违规的自检。
- 按运行时契约 0.2.96 实现的 `window.claude` mock，账户模式可以自证；合成 fixture 加上从 fixture 推导期望值的 helper。
- 已知 bug 约定：每个 bug 一条对照用例加一条窄断言的 `test.fail`，登记表和测试双向核对。B1、N1、B4、B2、N3 共 8 条标记用例。
- 公开仓库的隐私护栏：pre-commit 和 pre-push 隐私检查，失败输出不打印个人计划文字；报告检查脚本拒绝 flaky 和部分运行。

### What Worked
- **探针先行：** 不确定的运行时行为（binding 时机、拖放、`setInputFiles` 是否触发 change）先用 PROBE 当场验证，再写进计划，避免把猜测写成断言。
- **期望值独立推导：** 期望值从 fixture 推导，不读应用源码，黑盒测试因此真正独立。
- **代码审查 `--auto` 循环：** 每个阶段都抓到了实质问题，比如失败输出泄漏、空转断言、flaky 检测漏洞，最多 3 轮就收敛。
- **自动推进：** 用户把讨论题委托给推荐答案，只在产品行为和风险决定上停下（N3、T-03-SC、人工验证项），Phase 2–5 得以长时间无人值守地跑完。

### What Was Inefficient
- **资源占用：** 早期并行跑测试和子代理的全盘扫描导致用户电脑卡顿，后来改成低优先级、单 worker、不并发。
- **意外的 npx：** 一次误跑 `npx tsc` 拉了空壳包（AR-03-01），之后所有派发都禁止 npx。
- **验证报告过期：** 共享文件（README、KNOWN-BUGS、expect-from-fixture）被后续阶段反复修改，导致 Phase 1–4 的验证报告在收尾时全部过期，只能以最终全套运行为准、记为 override。
- **方向变化：** Phase 6 加进路线图后很快被新方向取代，加入后又移除，做了些无用功。

### Patterns Established
- 失败输出也不能泄漏个人内容：用 `page.evaluate` 按 id 或序号读回，在 Node 侧做布尔或脱敏比较。
- “没有保存”的证明：manual 时钟推过防抖窗口，比较写入次数，再用哨兵写入证明窗口确实推进过。
- 每次运行都写 JSON 报告，由 `check-report.mjs --min-expected` 判定，拒绝 flaky、skipped 和部分运行。
- 测试一律低优先级、单 worker，每份计划最多跑一次全套。

### Key Lessons
1. 共享的文档和 helper 应尽早定形，或者不放进早期阶段验证报告的覆盖范围，否则后续阶段一改就会让前面的报告过期。
2. 给子代理的派发提示里必须写明资源和安装禁令（不并发、不全盘扫描、不用 npx），不能指望它们自己克制。
3. 公开仓库的隐私问题要在第 1 阶段之前就建好钩子；“失败输出”和“提交内容”同样需要防护。
4. 用户的使用场景可能在中途改变（本地文件 → 多账号云端），路线图后期的阶段先只写方向，不要过早细化。

### Cost Observations
- Model mix: 编排用 opus，执行器、审查、验证、审计子代理大多用 sonnet（具体比例未统计）
- Sessions: 2
- Notable: Phase 2–5 在一次自动运行里完成；每个阶段的子代理开销主要花在计划检查、代码审查和验证上。

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 2 | 5 | 首个里程碑；Phase 3–5 讨论委托给推荐答案，自动推进 |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | 154 | 43/43 需求 | 0（只加了 `@playwright/test` 一个 devDependency） |

### Top Lessons (Verified Across Milestones)

1. （待后续里程碑验证）
