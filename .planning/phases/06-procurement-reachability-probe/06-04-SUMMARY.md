---
phase: 06-procurement-reachability-probe
plan: 04
subsystem: privacy
tags: [privacy, git-hooks, hook-drill, redact, gitignore, gitattributes, sec-03, d-11, d-12, d-18]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-01 的规则 F、G、H、规则 A 扩展和规则 D 不区分大小写（privacy-check.mjs）；06-CONTEXT.md 的 D-11、D-12、D-18
provides:
  - "tools/privacy/hook-drill.mjs：在一次性临时仓库里用真实的 pre-commit 和 pre-push 演练，输出 HOOK DRILL OK（ROADMAP Phase 6 成功标准 1 的证据）"
  - "tools/privacy/redact.mjs：服务器输出过滤器，默认过滤、--check、--init-env、--verify-env、--self-test（28 条）"
  - ".gitignore：pb_data、pb_backups、数据库、压缩包、PocketBase 程序和 tools/probe/page/config.js"
  - ".gitattributes：*.sh 和 tools/probe/** 固定 LF，tools/probe/page/vendor/** 不做换行转换"
  - "PRIVACY.md：规则 A 扩展、F、G、H、规则 D 局限与 IPv6 提醒、钩子演练和过滤器说明、夹具里怎么写假令牌和假口令"
affects: [06-05, 06-06, 06-07, 06-09, 06-10]

actuals:
  tokens: 8000
  tasks: 3
  commits: 3
plan_head_before: 117f3bfb4a34365af35e29f36bbf53a51a84c46c
plan_head_after: a16d16ef3931963f925d4efcfedc881fbfe01f2b

tech-stack:
  added: []
  patterns:
    - "演练脚本：违规历史在临时仓库启用钩子之前提交，之后只用 git config core.hooksPath 启用钩子，全程没有跳过钩子的参数"
    - "过滤器一遍扫完：server.env 和 denylist 的值组成一条按长度降序的交替正则，占位文字不会被再次替换"
    - "过滤器 fail closed：private/ 按当前 git 根目录找，找不到两份文件时退出码 2，绝不原样转发"

key-files:
  created:
    - tools/privacy/hook-drill.mjs
    - tools/privacy/redact.mjs
  modified:
    - .gitignore
    - .gitattributes
    - PRIVACY.md

key-decisions:
  - "演练取消暂存用 git reset -q 加按用例删除文件，不用 git reset --hard，也不用 git clean（计划写的是 reset --hard；临时仓库里两者效果相同，这样源码里也没有任何破坏性清理命令）"
  - "--check 和默认模式一样，找不到 server.env 和 denylist 时退出码 2（计划只写了默认模式）：没有值可比对时说“干净”会误导"
  - "IPv6 识别要求第一组是 2xxx 或 3xxx，并且写了 :: 或正好 8 组，避免把 23:59:59 这类时间当成地址"
  - "--init-env 在候选不是恰好一个时不猜，退出码 1；本机 denylist 就属于这种情况，见“待所有者处理”"

patterns-established:
  - "之后所有服务器步骤的输出先经 node tools/privacy/redact.mjs；要提交的 SUMMARY 先跑 --check"

requirements-completed: [SEC-03]

coverage:
  - id: D1
    description: "真实的 pre-commit 和 pre-push 在临时仓库里拦下令牌形状、口令赋值、pb_data、压缩包备份、denylist 里的合成域名和 IP、公网 IPv4 形状；干净的提交和推送通过；输出里没有样本原文；临时目录被删除"
    requirement: SEC-03
    verification:
      - kind: command
        ref: "node tools/privacy/hook-drill.mjs（HOOK DRILL OK）和任务 1 的 <verify><automated>"
        status: pass
    human_judgment: false
  - id: D2
    description: ".gitignore 忽略数据目录、数据库、压缩包、根目录 pocketbase 程序和探针 config.js，不误伤 tools/pocketbase/、vendor SDK、unit 文件和 legacy 备份夹具；.gitattributes 让 tools/probe 为 LF、vendor 为 text: unset"
    requirement: SEC-03
    verification:
      - kind: command
        ref: "任务 2 的 <verify><automated>（git check-ignore、git check-attr、PRIVACY.md 关键字）"
        status: pass
      - kind: e2e
        ref: "tests/e2e/platform/repo-hygiene.spec.ts#SAFE-03 .gitignore ignores test artifacts and backup-style JSON（REPORT OK expected=3 flaky=0 unexpected=0）"
        status: pass
    human_judgment: false
  - id: D3
    description: "redact.mjs 的替换、大小写、长值优先、--check 判定、候选解析和 fail closed 都有合成数据自检"
    requirement: SEC-03
    verification:
      - kind: unit
        ref: "node tools/privacy/redact.mjs --self-test（SELF-TEST OK (28 cases)）"
        status: pass
      - kind: command
        ref: "在没有 private/ 的临时目录里运行默认模式和 --check，退出码都是 2"
        status: pass
    human_judgment: false
  - id: D4
    description: "private/server.env（USJ_DOMAIN、USJ_IP）尚未生成：本机 denylist 里没有恰好一个 .vip 域名词条，--init-env 按计划不猜、退出码 1；--verify-env 因此还没有对真实值跑过"
    requirement: SEC-03
    verification: []
    human_judgment: true
    rationale: "需要所有者手动建 private/server.env（两行），然后运行 node tools/privacy/redact.mjs --verify-env 确认输出 ENV REDACTION OK"
  - id: D5
    description: "PRIVACY.md 的新增说明是否准确、易懂"
    requirement: SEC-03
    verification: []
    human_judgment: true
    rationale: "文字说明没有测试可以断言，需要所有者阅读"

duration: 约 25 分钟
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 04: 钩子演练、忽略与换行规则、输出过滤器 Summary

**用真实的 pre-commit 和 pre-push 在临时仓库里演练出全部违规都被拦下（HOOK DRILL OK），同步了忽略规则、LF 规则和 PRIVACY.md，并做好 fail closed 的输出过滤器 redact.mjs；本机的 private/server.env 因 denylist 里没有 .vip 域名词条而需要所有者手动建。**

## 做了什么

- **任务 1（tracer）：** `tools/privacy/hook-drill.mjs` 在 `os.tmpdir()` 下建一次性仓库，把 privacy-check.mjs 和两个钩子按原字节拷进去。违规历史（令牌、口令、pb_data、提交说明里带域名的提交）在钩子启用之前提交到 `drill-history` 分支；之后只用 `git config core.hooksPath .githooks` 启用钩子，再做 pre-commit 和 pre-push 演练。样本全部运行时拼接，输出里没有样本原文，结束时删除临时目录。主仓库的暂存区为空，`.githooks` 的对象哈希不变（d826ca4）。
- **任务 2：** `.gitignore` 新增 PocketBase 数据、数据库、压缩包、程序文件和探针 `config.js` 两节；`.gitattributes` 新增 `*.sh`、`tools/probe/**` 的 LF 和 `tools/probe/page/vendor/**` 的 `-text`（写在 `tools/probe/**` 之后才能覆盖）；PRIVACY.md 的 § 2、§ 3、§ 7 同步，并新增 § 9“夹具里怎么写假令牌和假口令”。
- **任务 3：** `tools/privacy/redact.mjs`：默认过滤、`--check`、`--init-env`、`--verify-env`、`--self-test`。

### 钩子演练的原样输出（不含样本）

```
PASS clean commit accepted
PASS pre-commit token [F-token-shape]
PASS pre-commit password [G-secret-assign]
PASS pre-commit pb_data [A-forbidden-path]
PASS pre-commit archive [A-forbidden-path]
PASS pre-commit domain [D-plan-term]
PASS pre-commit ip [D-plan-term]
PASS pre-commit public-ip [H-public-ipv4]
PASS clean push accepted
PASS pre-push [F-token-shape]
PASS pre-push [G-secret-assign]
PASS pre-push [A-forbidden-path]
PASS pre-push [D-plan-term]
PASS pre-push [D-plan-term] 提交说明
PASS no sample text in hook output
PASS temp directory removed
HOOK DRILL OK
```

### 其他验证结果

- SAFE-03：`repo-hygiene.spec.ts` 低优先级、单 worker 运行，`REPORT OK expected=3 flaky=0 unexpected=0`，含 “SAFE-03 .gitignore ignores test artifacts and backup-style JSON”。
- redact 自检：`SELF-TEST OK (28 cases)`。
- 没有 private/ 的临时目录里，默认模式和 `--check` 的退出码都是 2。
- 对本机 denylist（只数不显示）：每个词条的原样、大写、`www.` 前缀写法过滤后都不再出现，`--check` 对过滤前的文本报有命中、对过滤后的文本为 0。
- privacy-check 自检仍为 183 项全过；三次提交都经过 pre-commit 钩子（没有绕过）。

## 待所有者处理（private/server.env）

`node tools/privacy/redact.mjs --init-env` 退出码 1，没有生成 `private/server.env`。原因是本机 denylist 共 2 个词条：1 个公网 IPv4，另 1 个是不含点的纯字母数字词条，没有 `.vip` 结尾的域名词条，所以域名候选是 0 个，按计划“不猜”。这是计划预先写明的情形（“不满足时要所有者手动建 server.env”）。

所有者需要手动建 `private/server.env`（被 `private/` 规则忽略），两行：

```
USJ_DOMAIN=<服务器域名>
USJ_IP=<服务器公网 IPv4>
```

建好后运行 `node tools/privacy/redact.mjs --verify-env`，应输出 `ENV REDACTION OK`。在此之前，默认过滤仍然可用（它同样读 denylist），但域名只会被替换成 `<term>` 而不是 `<domain>`，`--verify-env` 也没有对真实值跑过。06-06 起需要这两个值的步骤依赖这个文件。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 缺失的关键行为] `--check` 在没有 private 文件时也拒绝**
- **Found during:** 任务 3
- **Issue:** 计划只要求默认模式在两份文件都没有时退出码 2；`--check` 若在没有值可比对时返回“干净”，会给出虚假的安全感（T-06-09）。
- **Fix:** `--check` 同样退出码 2。
- **Files modified:** tools/privacy/redact.mjs
- **Commit:** a16d16e

**2. [实现细节] 演练取消暂存的写法**
- **Found during:** 任务 1
- **Issue:** 计划写 `git reset -q --hard HEAD` 并清理未跟踪文件；执行规则里禁止 `git clean` 和 `reset --hard` 这类整树清理命令。
- **Fix:** 用 `git reset -q`（只取消暂存）加按用例 `rmSync` 删除这个用例写的文件。临时仓库里效果相同。
- **Files modified:** tools/privacy/hook-drill.mjs
- **Commit:** 9d47834

**3. [提交署名] 署名行改为运行时要求的写法**
- **Found during:** 任务 1
- **Issue:** 第一次提交误用了任务说明里写的署名行，运行时要求的是 Claude Sonnet 5.5。
- **Fix:** 本地提交（未推送）改写提交说明，后两次提交直接用正确署名。
- **Commit:** 9d47834

**Total deviations:** 3（1 个 Rule 2，2 个实现细节）。**Impact:** 无范围变化；任务 3 的验收里 `private/server.env` 一项等所有者手动建文件（见上节）。

## Authentication Gates

无。

## Known Stubs

无。

## Threat Flags

无新增攻击面。hook-drill 只在临时目录里写文件，redact 只读本机 private/，都不联网。

## Issues Encountered

`private/server.env` 无法由 `--init-env` 生成（见“待所有者处理”）。其余验收项全部通过。

## Next Phase Readiness

Ready for 06-05（探针页）和 06-06（服务器脚本）。06-06 起读取 `private/server.env` 的步骤要先有这个文件。

## Self-Check: PASSED
