---
phase: 07
review: 07-REVIEW.md
titles: json
findings:
  - id: IN-01
    severity: info
    disposition: open
    title: "`planTerm` 在两个文件里各写一份，靠注释“改一处要改两处”维护，没有测试把它们绑在一起"
  - id: IN-02
    severity: info
    disposition: open
    title: "`extract-plan.mjs` 的正则里写着一个肉眼看不到的 BOM 字面量"
  - id: IN-03
    severity: info
    disposition: open
    title: "`tests/KNOWN-BUGS.md` 末尾的“里程碑收尾时的状态”已经与第 7 阶段的现实不符"
  - id: IN-04
    severity: info
    disposition: open
    title: "重复的记录 id 和自定义待办 id 不去重，后一条无法编辑或删除"
  - id: IN-05
    severity: info
    disposition: deferred
    title: "`archived` 字段被校验、被保留，但没有任何地方使用，`planTasks` 还把它丢掉了"
  - id: IN-06
    severity: info
    disposition: open
    title: "`--all` 对已暂存的文件读工作区版本，而不是暂存区版本"
  - id: IN-07
    severity: info
    disposition: open
    title: "denylist 的匹配区分大小写，且词条里不能出现 `#`"
  - id: IN-08
    severity: info
    disposition: open
    title: "`legacyPlan` 把原件里 `<p class=\"note\">` 的原始 HTML 文本当作 `fitNote`，实体不会被还原"
  - id: WR-01
    severity: warning
    disposition: fixed
    title: "`normalizePlan` 用 `CK[g.cat]` 判断类别，`constructor`、`__proto__` 之类的原型链键会被放行"
  - id: WR-02
    severity: warning
    disposition: deferred
    title: "自定义待办的 `group` 只校验格式、不校验是否在当前计划里，合格但不存在的组会让待办在目标页“消失”"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "种子 JSON 损坏时，`err.message` 可能把种子里的计划文字原样打印到终端"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "含 NUL 字节的文件被整个跳过，UTF-16 编码的文本（例如 PowerShell 重定向生成的文件）能绕过规则 B、C、D"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "`runAll` 在仓库没有任何提交时直接崩溃，下面处理“没有 HEAD”的分支是死代码"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "`DATE_RE` 接受不存在的日期（`2026-02-31`、`2026-04-31`），修正和导入白名单都放过，这些记录在周和日历视图里看不到"
  - id: WR-07
    severity: warning
    disposition: fixed
    title: "`.gitignore` 没有覆盖 GSD 安装出来的 `.agents/`、`.codex/` 和 `AGENTS.md`，而它们含本机用户名的绝对路径"
open: 7
total: 15
recorded: 2026-11-07T00:00:00.000Z
---

# Phase 07: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | deferred | Phase 12（PLAN-03 归档行为）再接上 `archived`；本阶段按 CONTEXT 只接受这个字段，不做行为 |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| WR-01 | warning | fixed | 07-REVIEW-FIX.md（`0b3e4d4`） |
| WR-02 | warning | deferred | 07-REVIEW-FIX.md 记为 skipped：计划固定为 P1–P7 时，孤儿组只能来自手工构造的备份；怎么显示或迁移这类待办是 Phase 12 编辑计划页的设计问题，D-08 又不允许删带文字的条目 |
| WR-03 | warning | fixed | 07-REVIEW-FIX.md（`e7d68e6`、`8ca48a5`） |
| WR-04 | warning | fixed | 07-REVIEW-FIX.md（`cb580cd`） |
| WR-05 | warning | fixed | 07-REVIEW-FIX.md（`23a8f20`） |
| WR-06 | warning | fixed | 07-REVIEW-FIX.md（`e8e9028`） |
| WR-07 | warning | fixed | 07-REVIEW-FIX.md（`c0387f0`） |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.

**修复后的验证：** 全量 `REPORT OK expected=173 flaky=0 unexpected=0`（低优先级、1 个 worker）；`privacy-check.mjs --self-test` 100 项通过、`--all` 通过；`extract-plan.mjs --check` 为 CHECK OK。

**审查里另记、未单列编号的一点：** `normalize` 清掉已完成任务的非法 `doneDate` 后，该任务仍为 `done:true`，目标页会显示“完成于 0月0日”，且不进时间线和周计数。状态：open，和 IN-04 一起留给之后的数据修正工作。
