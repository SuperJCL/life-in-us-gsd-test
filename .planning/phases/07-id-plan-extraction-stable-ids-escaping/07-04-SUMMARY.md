---
phase: 07-id-plan-extraction-stable-ids-escaping
plan: 04
subsystem: privacy-guards-and-publish
tags: [sec-04, privacy-check, rule-a, gitattributes, clean-clone, seed-gate]

requires:
  - phase: 07-01
    provides: "规则 D 改读本地种子、改名副本规则、种子闸门（fail closed）"
  - phase: 07-02
    provides: "DEFAULT_PLAN、冻结 id、extract-plan.mjs --check"
  - phase: 07-03
    provides: "USJ_CONFIG 配置缝、SAFE-02 反向对照、161 条完整套件"
provides:
  - "去个人化的 us-journey-tracker.html 第一次进入 git（本机提交，未推送）"
  - "规则 A：根目录应用放行，子目录同名文件和根目录改名副本仍被禁止"
  - ".gitignore 不再忽略应用，忽略 /us-journey-tracker.*.html；.gitattributes 固定应用为 LF"
  - "tests/e2e/platform/clean-clone.spec.ts 两条 SEC-04 用例；SAFE-03 的新忽略清单"
  - "缺文件提示、tests/README.md、PRIVACY.md、tests/KNOWN-BUGS.md、constants.ts 注释改为“应用在仓库里”"
  - "干净克隆里完整套件 163 条 expected、0 flaky、0 unexpected"
affects: [07-05, 07-06, 07-07, phase-09]

actuals:
  tokens: 6921
  tasks: 3
  commits: 1
plan_head_before: fa20a96301707ce25aea5b33572d01457835a3b2
plan_head_after: ad258c0c3ef53d0dd3e66acc85f0a3e01bb298ca

tech-stack:
  added: []
  patterns:
    - "护栏放行应用文件和应用第一次提交在同一次提交里；个人内容由规则 D（读种子）挡住，没有种子时由种子闸门以退出码 2 阻止"
    - "干净克隆验收：mktemp 临时目录、本机 git clone、目录联接借用 node_modules、先拆联接再删克隆"
    - "钩子文件不改（D-13），规则随检查器更新，用一次性克隆里的 pre-commit 直接运行来验收"

key-files:
  created:
    - tests/e2e/platform/clean-clone.spec.ts
    - us-journey-tracker.html
  modified:
    - .gitignore
    - .gitattributes
    - tools/privacy/privacy-check.mjs
    - tests/e2e/platform/repo-hygiene.spec.ts
    - tests/support/static-server.cjs
    - tests/support/constants.ts
    - tests/README.md
    - PRIVACY.md
    - tests/KNOWN-BUGS.md

key-decisions:
  - "规则 A 对根目录应用文件放行，且放在改名副本规则之前判断；子目录同名文件报“应用文件只能放在仓库根目录”"
  - "D-13：.githooks/* 不改，对象哈希保持 d826ca4；验收靠钩子仍 exec 检查器加一次性克隆里的 pre-commit 实跑"
  - "所有者批准示例计划的条件是先改两处文字（复盘占位提示、引体 note），改完直接提交"
  - "本阶段不推送，等待所有者确认推送"

requirements-completed: [SEC-04, TEST-01]

coverage:
  - id: D1
    description: "去个人化的应用被 git 跟踪、保持 LF，private/ 下的种子和原件副本仍被忽略、从未被跟踪"
    requirement: SEC-04
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/clean-clone.spec.ts#SEC-04 the de-personalized app is tracked with LF line endings and its private copies stay out of git"
        status: pass
    human_judgment: false
  - id: D2
    description: "不带任何服务器配置打开时看到示例计划和空记录"
    requirement: SEC-04
    verification:
      - kind: e2e
        ref: "tests/e2e/platform/clean-clone.spec.ts#SEC-04 a fresh start without any server shows the sample plan and no records"
        status: pass
    human_judgment: false
  - id: D3
    description: "干净克隆（无 private/、无服务器配置）里完整套件 163 条 expected、0 flaky，应用字节与 APP_SHA256 一致，8 条已知 bug 标记用例照旧预期失败"
    requirement: TEST-01
    verification:
      - kind: e2e
        ref: "npm test in a fresh clone, check-report.mjs --min-expected 163 -> REPORT OK expected=163 flaky=0 unexpected=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "隐私钩子仍然生效：一次性克隆里暂存三个禁止路径，pre-commit 退出码 1；没有种子时 --all 退出码 2，空种子后通过"
    requirement: SEC-04
    verification:
      - kind: other
        ref: "07-04-PLAN.md Task 3 verify 第三条命令（HOOK_STATUS=0）"
        status: pass
    human_judgment: false
  - id: D5
    description: "示例计划读起来像通用示例、不含个人内容（含短数字）"
    requirement: SEC-04
    verification: []
    human_judgment: true
    rationale: "机器只能判定共享片段和相同数字；所有者在检查点亲自看过并批准（附两处文字修改）"

duration: 8min（本次续跑；Task 1 由前一个执行者完成）
completed: 2026-11-07
status: complete
---

# Phase 7 Plan 04: 去个人化应用进入仓库 Summary

**去个人化的 us-journey-tracker.html 与放行它的规则 A、.gitignore、eol=lf 规则在同一次本机提交里第一次进入 git，干净克隆里不配服务器就跑通 163 条用例，没有推送。**

## Performance

- **Duration:** 本次续跑约 8 分钟（续跑开始 2026-11-07T18:32Z，结束约 18:41Z）；Task 1 的时间不计入
- **Tasks:** 3（Task 1 tracer、Task 2 检查点、Task 3）
- **Files modified:** 11（一次提交）

## Accomplishments

- 规则 D 在 `--staged` 时加载 68 个个人计划词条（不少于 66），提交前和提交时（钩子）两次检查都通过；`--all` 在 194 个文件上通过。
- 应用文件随提交第一次被跟踪：HEAD 里的 blob 的 sha256 等于 HEAD 上 constants.ts 的 APP_SHA256；`git ls-files private` 为空。
- 隐私钩子验收（D-13）：两个钩子各恰好一行 exec 检查器，`.githooks` 对象哈希不变。一次性克隆里暂存 `sub/us-journey-tracker.html`、`us-journey-tracker.copy.html`、`private/synth-note.txt` 后，`sh .githooks/pre-commit` 退出码为 1，三个路径都以 `[A-forbidden-path]` 报出，子目录那一条的说明是“应用文件只能放在仓库根目录”。
- 种子闸门验收：同一个一次性克隆里没有种子时，`privacy-check.mjs --all` 退出码 2 且 stderr 提到 `private/plan-seed.json`；只在克隆里写空种子 `{"v":1,"plan":{}}` 后 `--all` 通过；主仓库没有建空种子，真实种子仍在原处。
- 干净克隆完整套件：163 条 expected、0 flaky、0 unexpected（`REPORT OK expected=163 flaky=0 unexpected=0`），含 8 条已知 bug 标记用例，两条 SEC-04 用例通过；克隆里应用字节与 APP_SHA256 一致、没有 private/。目录联接已拆除，临时目录已删除，主仓库 node_modules 完好。

## 所有者在检查点的回复

批准，条件是先改两处文字，其余示例计划原样通过：

- 本周复盘文本框（`id="review"`）的占位提示：整体换成与原应用无关的通用说法。
- `DEFAULT_PLAN.lifts` 里引体（`pull`）的 note：原文说“记录次数”，与单位 kg 矛盾，改为记录附加配重、徒手记 0。

没有改 id、单位、默认值和目标值。

## Task Commits

1. **Task 1: tracer（护栏改为“应用在仓库里”，连同应用一起暂存）** - 只暂存，不提交（计划如此）；由前一个执行者完成
2. **Task 2: 所有者检查点** - 无提交；所有者批准并要求改两处文字
3. **Task 3: 文字修改、文档、一次提交、验收** - `ad258c0`（feat）。Task 1 和 Task 3 的全部 11 个文件在这一次提交里。

**Plan metadata:** 见下方 docs 提交（SUMMARY、STATE、ROADMAP、REQUIREMENTS）。

## Files Created/Modified

- `us-journey-tracker.html` - 第一次被跟踪的去个人化应用（含两处所有者要求的文字修改）
- `.gitignore` - 不再忽略应用；新增 `/us-journey-tracker.*.html`；private/ 的说明列出种子和原件副本
- `.gitattributes` - `us-journey-tracker.html text eol=lf`
- `tools/privacy/privacy-check.mjs` - 规则 A：根目录应用放行，子目录同名文件禁止；自检正反例更新
- `tests/e2e/platform/repo-hygiene.spec.ts` - SAFE-03 忽略清单
- `tests/e2e/platform/clean-clone.spec.ts` - 两条 SEC-04 用例（新）
- `tests/support/static-server.cjs` - 缺文件提示改为“工作区不完整”
- `tests/support/constants.ts` - APP_SHA256 更新，APP_FILE_NAME 注释改为新现实
- `tests/README.md`、`PRIVACY.md`、`tests/KNOWN-BUGS.md` - 改为应用在仓库里、原计划只在本机种子里

## Decisions Made

- 规则 A 放行根目录应用文件，个人内容由规则 D 挡住；没有种子的机器由种子闸门以退出码 2 阻止。
- D-13：钩子文件不改，验收靠一次性克隆里钩子的实跑。
- 本阶段不推送。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 规则 A 的顺序补强（Task 1，前一个执行者）**
- **Found during:** Task 1
- **Issue:** 只把应用文件名从禁止清单挪走，根目录应用可能仍被后面的改名副本规则误报。
- **Fix:** 根目录应用文件先判定为放行，再走改名副本规则；自检增加根目录应用的反例和 `sub/` 同名文件的正例。
- **Files modified:** `tools/privacy/privacy-check.mjs`
- **Verification:** `--self-test` 82 条通过；`--staged` 通过；之后一次性克隆里三个禁止路径都被拦下。
- **Committed in:** `ad258c0`

**2. [所有者要求] 两处文字修改导致基线和文件改动（Task 2 之后）**
- **Found during:** Task 2 检查点之后
- **Issue:** 所有者批准的条件是先改复盘占位提示和引体 note。
- **Fix:** 只改这两处字符串；`extract-plan.mjs --check` 仍为 CHECK OK；工作区应用无 CR 字节；APP_SHA256 更新为新的 sha256；重新暂存；4 个 spec 的小范围运行 REPORT OK expected=16。
- **Files modified:** `us-journey-tracker.html`、`tests/support/constants.ts`
- **Committed in:** `ad258c0`

**3. [记录] 提交里的文件数仍是 11**
- 续跑说明预计 constants.ts 使清单变成 12 个，但计划 Task 3 自己的 5 个文件里本来就有 constants.ts（注释改动），所以提交里恰好还是 11 个路径，已核对 `git diff --cached --name-only`。strings.ts 没有改（两处文字都不在它里面）。

**4. [Rule 3 - Blocking] static-server.cjs 的工作区换行是 CRLF**
- **Found during:** Task 3
- **Issue:** 该文件工作区是 CRLF（索引里是 LF），按原样的 LF 文本替换匹配不到。
- **Fix:** 替换时先归一化为 LF，写回时恢复 CRLF；git 索引里仍是 LF。
- **Files modified:** `tests/support/static-server.cjs`

---

**Total deviations:** 4（1 bug 补强、1 所有者要求、1 记录、1 阻塞）
**Impact on plan:** 都没有改变隐私保证或 v1 用例结果；没有新增依赖，没有运行安装命令。

## Issues Encountered

- 提交之前单独运行了 tests/e2e/platform/known-bugs-registry.spec.ts，确认文档改动（KNOWN-BUGS.md 文件头）没有破坏登记护栏（REPORT OK expected=2）；完整套件仍只跑了干净克隆里的一次。

## 干净克隆证明的范围（已知缺口）

- **证明了什么：** 只靠被跟踪的文件就够——应用文件、测试、fixture、工具，以及未改动的 package.json 和 package-lock.json；克隆里没有 private/，不需要种子，也不连任何服务器。
- **没有证明什么：** 没有从 npm 源重新运行 `npm ci`，依赖借用了主仓库的 node_modules；只在 Windows 上验证。
- **以后怎样补上：** 经所有者批准后，在一次性克隆里运行 `npm ci` 再跑完整套件。

## Known Stubs

None - 应用里的示例计划是有意的合成内容，不是占位。

## Threat Flags

None - 没有新的网络端点、认证路径或信任边界上的结构改动。

## 推送状态

**未推送，等待所有者确认推送。** `origin/main` 上没有应用文件；本地分支领先 origin 的提交都没有推送。

## Next Phase Readiness

- 07-05（转义）、07-06、07-07 可以在应用已被跟踪的前提下继续；每次改应用都要在同一次提交里更新 APP_SHA256。
- 没有种子的机器提交或推送应用文件会被种子闸门以退出码 2 阻止，这是设计行为。

## Self-Check: PASSED

- `us-journey-tracker.html`、`tests/e2e/platform/clean-clone.spec.ts` 存在；提交 `ad258c0` 是 HEAD 的祖先；HEAD 里的应用 sha256 等于 APP_SHA256；`git ls-files private` 为空；`.githooks` 对象哈希不变；干净克隆 REPORT OK；联接已拆、主仓库 node_modules 完好。

---
*Phase: 07-id-plan-extraction-stable-ids-escaping*
*Completed: 2026-11-07*
