---
phase: 07-id-plan-extraction-stable-ids-escaping
fixed_at: 2026-11-07T12:00:00Z
review_path: .planning/phases/07-id-plan-extraction-stable-ids-escaping/07-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-11-07
**Source review:** `.planning/phases/07-id-plan-extraction-stable-ids-escaping/07-REVIEW.md`
**Iteration:** 1

**Summary:**
- 范围内的发现：7 条（Critical 0，Warning 7；`fix_scope = critical_warning`）
- 已修复：6 条（WR-01、WR-03、WR-04、WR-05、WR-06、WR-07）
- 跳过：1 条（WR-02，按编排器的处置推迟到 Phase 12）
- Info（IN-01 到 IN-08）和未编号的 `doneDate` 备注不在本轮范围内，留给处置台账。

**运行方式：** `workflow.use_worktrees = false`，所以没有建隔离工作树，所有修改和提交都在主工作区（`main` 分支）完成，没有临时分支，没有恢复标记文件。没有推送。

**验证位置：** 全部验证（定向用例、全量用例、两个工具的 `--self-test`、`--all`、`--check`）都在主工作区运行，可以直接在当前目录复现。

## Fixed Issues

### WR-01: `normalizePlan` 和 `kOf` 放过原型链上的类别名

**Files modified:** `us-journey-tracker.html`、`tests/support/constants.ts`、`tests/e2e/data/plan-normalize.spec.ts`
**Commit:** 0b3e4d4
**Status:** fixed: requires human verification（判断条件类修改，语法检查通不出语义错误）
**Applied fix:** 新增 `hasCat`（对 `CK` 做自有属性检查），`kOf`、`normalizePlan` 的类别判断、`normalize` 里记录类别的判断都改用它，与 `normalize` 原来的 `own()` 写法一致。`plan-normalize.spec.ts` 的拒绝变体里加了 `constructor`、`__proto__`、`toString` 三条。`APP_SHA256` 在同一次提交里更新。

### WR-06: `DATE_RE` 接受不存在的日期

**Files modified:** `us-journey-tracker.html`、`tests/support/constants.ts`、`tests/e2e/security/state-validation.spec.ts`、`tests/e2e/security/id-whitelist.spec.ts`
**Commit:** e8e9028
**Status:** fixed: requires human verification（判断条件类修改）
**Applied fix:** 在 `parse` 之后加 `realDate = v => 字符串 && DATE_RE 通过 && ymd(parse(v)) === v`，往返不相等的日期（`2026-02-31`、`2026-04-31`、非闰年的 `2026-02-29`）视为无效。`importProblem` 的 `okDate`/`optDate`、复盘键、抵达日期，以及 `normalize` 的 `okDate` 和抵达日期都改用它。结果与 D-07、D-08 一致：导入遇到不存在的日期整份拒绝；加载时修正只把记录日期改成今天、把任务的 `due`/`doneDate` 和抵达日期清空，不删任何带文字的记录。新增用例：`state-validation.spec.ts` 里 7 个导入拒绝变体，加一段“修正后保留记录文字、闰日 `2024-02-29` 保留”的断言；`id-whitelist.spec.ts` 的页面级导入拒绝变体里加了不存在的记录日期和抵达日期。v1 的五个点名输入和 8 个已知 bug 标记结果不变（全量用例通过）。`APP_SHA256` 在同一次提交里更新。
**一处行为变化需要知道：** 四位年份小于 100（如 `0050-01-01`）经 `new Date` 会映射到 19xx，往返不相等，现在也会被判为无效。这类日期本来就没有实际用途。

### WR-03: 种子 JSON 损坏时 `err.message` 可能带出种子文字

**Files modified:** `tools/privacy/privacy-check.mjs`、`tools/plan/extract-plan.mjs`
**Commits:** e7d68e6、8ca48a5（后一个补回第一次提交里丢失的正则反斜杠，让位置数字能显示，并加了对位置的自检断言）
**Applied fix:** 两个工具各加一个 `parseSeedJson`：解析失败时抛出固定文案 `private/plan-seed.json JSON 解析失败（已隐去内容）`，如果 `err.message` 末尾有 `at position N (line L column C)` 就只取这几个数字附在后面，绝不透传原始消息。`seedTerms`（规则 D）和 `extract-plan.mjs --check` 都改用它，退出码保持 fail-closed（privacy-check 2，extract-plan 1）。两个 `--self-test` 各加一条：用四种合成的坏 JSON（样本文字运行时拼接）断言报错含 `JSON 解析失败`、位置数字，且不含样本文字。

### WR-04: 含 NUL 字节的文件被整个跳过，UTF-16 文本绕过规则 B、C、D

**Files modified:** `tools/privacy/privacy-check.mjs`
**Commit:** cb580cd
**Status:** fixed: requires human verification（识别 UTF-16 用了启发式阈值）
**Applied fix:** 新增 `utf16Kind` 和 `decodeUtf16`，`scanBuffer` 先识别再解码再扫描。识别方法有两种：UTF-16 的 BOM（`FF FE`、`FE FF`）；没有 BOM 时看 NUL 的奇偶分布：一个奇偶位上有至少 4 个且占字符数 2% 以上的 NUL，另一个奇偶位上不到它的一半（汉字如 `U+4E00` 的低字节本来就是 0，所以不能要求为 0）。真二进制两个奇偶位上 NUL 数量相当，仍然按原来的方式跳过；只有零星 NUL 的文件同样跳过。`--self-test` 新增：LE/BE 各带 BOM 和不带 BOM 共 4 个样本，都要命中规则 B、C、D、行号正确、输出不含用户名和词条；干净的 UTF-16 文本不报告；一个伪随机二进制和一个零星 NUL 的文件仍被跳过。
**需要人工确认：** 没有 BOM、且几乎全是汉字（ASCII 占比低于 2%）的 UTF-16 文件仍可能被当作二进制跳过。PowerShell 5 的重定向都带 BOM，所以主要场景已覆盖。

### WR-05: `--all` 在没有任何提交时崩溃

**Files modified:** `tools/privacy/privacy-check.mjs`
**Commit:** 23a8f20
**Applied fix:** `runAll` 先判断 `hasHead`，只有 HEAD 存在才执行 `git ls-tree`，没有 HEAD 时 `headPaths` 为空，只检查暂存区。因为 `--self-test` 被要求不依赖 git 状态，没有往里加用例；改用手工验证：在草稿目录里新建空仓库、暂存一个合成文件，运行 `--all`，退出码 0，输出“隐私检查通过（all，1 个文件）”。

### WR-07: `.gitignore` 没有覆盖 `.agents/`、`.codex/`、`AGENTS.md`

**Files modified:** `.gitignore`、`PRIVACY.md`、`tools/privacy/privacy-check.mjs`
**Commit:** c0387f0
**Applied fix:** `.gitignore` 新增 `.agents/`、`.codex/`、`AGENTS.md` 三项（放在“其他 AI 工具的安装文件”小节，`git check-ignore` 已确认三项都命中）；`PRIVACY.md` 第 2 节表格加一行并说明规则 A 也会拦下强行暂存的这些路径；按审查报告的建议，`checkPath` 也加了这三个路径（只拦仓库根目录的 `.agents`、`.codex` 和根目录的 `AGENTS.md`，`docs/AGENTS.md`、`src/codex/x.ts` 这类不拦），`--self-test` 加了正例和反例。这三个目录和文件的内容没有读取、移动或删除。

## Skipped Issues

### WR-02: 自定义待办的 `group` 不在当前计划里时，在目标页看不到也删不掉

**File:** `us-journey-tracker.html:437`、`us-journey-tracker.html:476`
**Reason:** skipped（按编排器的处置推迟到 Phase 12，计划编辑器和归档）。在固定的 `DEFAULT_PLAN`（P1 到 P7）下，不在计划里的组只可能来自手工改过的备份；怎样显示或重新归属这类待办是计划编辑器的设计问题；D-08 也不允许删除带用户文字的条目。`state-validation.spec.ts` 里“`g-synth1` 换回 `DEFAULT_PLAN` 后仍保留”的期望没有改动。
**Original issue:** `importProblem` 和 `normalize` 只用 `GROUP_ID_RE` 检查 `custom[].group`，格式合格但当前计划里没有的组（如 `P9`）原样保留；`renderGoals` 只按 `plan.groups` 遍历，所以这条待办在目标页不显示、无法删除，周视图的类别计数也不计入。

## 验证记录

| 项目 | 结果 |
|------|------|
| 定向用例（`plan-normalize`、`app-integrity`、`security/`、`data/`、`platform/`） | 全部通过，`REPORT OK`（17 条、25 条、46 条三次） |
| 全量用例（`--workers=1`，低优先级启动，`--min-expected 173`） | `REPORT OK expected=173 flaky=0 unexpected=0` |
| `node tools/plan/extract-plan.mjs --check` | `CHECK OK` |
| `node tools/plan/extract-plan.mjs --self-test` | 自检通过：46 项 |
| `node tools/privacy/privacy-check.mjs --self-test` | 自检通过：100 项（修改前 83 项） |
| `node tools/privacy/privacy-check.mjs --all` | 隐私检查通过（all，204 个文件） |

- 全量用例数仍是 173：WR-01、WR-06 的新用例都是加在已有用例里的变体，没有新增 `test()`，所以期望数没有变化。
- 07-05 的“没有未转义插值”源码闸门在每次应用改动后都通过；四个视图的界面和操作没有改动。
- `APP_SHA256` 在每次应用改动（WR-01、WR-06）的同一次提交里更新。

## 其他说明

- 提交说明末尾的署名行用的是本次运行时指示的 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`，与任务文本里写的 Opus 5.5 不同，原因是以运行时为准。
- WR-03 在第一次提交（e7d68e6）里，因为写入脚本时反斜杠被吞掉，位置数字没有显示，随后用 8ca48a5 补正；两个提交都保留，没有改写历史。
- REVIEW-FIX.md 本身没有提交，由编排器处理。

---

_Fixed: 2026-11-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
