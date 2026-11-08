---
phase: 06-procurement-reachability-probe
plan: 02
subsystem: planning-docs
tags: [docs, provider, domain-suffix, nginx, certbot, claude-md, d-01, d-02, d-08, d-13, d-15]

requires:
  - phase: 06-procurement-reachability-probe
    provides: 06-CONTEXT.md 的 D-01、D-02、D-08、D-13、D-15 决定
provides:
  - "PROJECT.md、REQUIREMENTS.md、ROADMAP.md、.claude/CLAUDE.md 的服务商、域名后缀、Web 服务器写法与所有者实际选择一致（阿里云轻量应用服务器香港、Porkbun 托管的 .vip 域名、nginx 加 certbot）"
  - "INFRA-02 的结果改为 Phase 10 和 Phase 13 的输入，不再按实测决定去留（D-08）"
  - "ROADMAP Phase 6 成功标准 2 带 certbot renew --dry-run 条款，成功标准 4 分三部分写结论；Notes 补上 /_/ 的加固口径（D-13）"
  - "STATE.md 的 D-15 待办：前端 SDK 改用 0.28.1，Phase 8、9 规划时一并改 0.28.2 的三处引用"
affects: [06-09, 06-10, 08-fake-pb-server-fixtures, 10-offline-realtime-sync, 13-deployment]

actuals:
  tokens: 1500
  tasks: 2
  commits: 2
plan_head_before: ab6ea8e25a1da4e2104585933679083ab8881496
plan_head_after: d4f639980414f86d00131b737ae6ae6e91f58443

tech-stack:
  added: []
  patterns:
    - "CLAUDE.md 的 Project 段只经 generate-claude-md --output 到临时目录再拷标记之间的内容，其余段落与基线 blob 逐字相同"

key-files:
  created: []
  modified:
    - .planning/PROJECT.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
    - .claude/CLAUDE.md

key-decisions:
  - "不论实测结果都继续用阿里云香港（D-08）：INFRA-02 和 ROADMAP Phase 6 目标、成功标准 4 都改成“作为 Phase 10、13 的输入”"
  - "Web 服务继续用服务器上已有的 nginx 加 certbot（D-02）：PROJECT Key Decisions 新增一行，Phase 13 的 Research 行和 Notes 以 Phase 6 验证过的 nginx 参数为准"
  - "SDK 0.28.1 的后续修改只记待办，不在本计划改 ROADMAP 共同约束和 Phase 8 成功标准 3（D-15）"

patterns-established:
  - "规划文档里只写“服务器”“域名”“.vip 后缀”“阿里云轻量应用服务器香港”“Porkbun”，不写真实 IP、域名、www 子域名"

requirements-completed: [INFRA-01, INFRA-02]

coverage:
  - id: D1
    description: "PROJECT.md、REQUIREMENTS.md、.claude/CLAUDE.md 不再出现原调研推荐的云厂商名字，都写阿里云；INFRA-02 写 Phase 10 和 Phase 13；PROJECT.md 没有带反引号的旧域名后缀、有 .vip"
    requirement: INFRA-01
    verification:
      - kind: command
        ref: "任务 1 的 <verify><automated>（grep 组合加 blob 521fb3f 比对）"
        status: pass
    human_judgment: false
  - id: D2
    description: ".claude/CLAUDE.md 去掉 Project 段后与基线 blob 521fb3f 去掉 Project 段后逐字相同"
    requirement: INFRA-01
    verification:
      - kind: command
        ref: "任务 1 verify 里的 node 比对（strip 后全等，退出码 0）"
        status: pass
    human_judgment: false
  - id: D3
    description: "ROADMAP 没有旧服务商、旧 Web 服务器、旧域名后缀、续费或换商家的说法；Phase 13 有 nginx；有 certbot renew --dry-run；Phase 6 有限流；成功标准 4 有 Phase 10"
    requirement: INFRA-02
    verification:
      - kind: command
        ref: "任务 2 的 <verify><automated>"
        status: pass
    human_judgment: false
  - id: D4
    description: "STATE.md 有同时包含 0.28.1 和 D-15 的待办"
    requirement: INFRA-02
    verification:
      - kind: command
        ref: "任务 2 verify 的最后一段 grep"
        status: pass
    human_judgment: false
  - id: D5
    description: "措辞对应的事实（HTTPS 能打开、证书自动续期、大陆三网和美国实测）本计划只改写文字，实际验证在 06-09 和 06-10"
    requirement: INFRA-01
    verification: []
    human_judgment: true
    rationale: "INFRA-01、INFRA-02 的事实要靠 06-09、06-10 的实测证明，本计划只对齐规划文档的措辞"

duration: 2min
completed: 2026-11-08
status: complete
---

# Phase 6 Plan 02: 规划文档的服务商、域名后缀和 Web 服务器改成所有者实际选择 Summary

**PROJECT、REQUIREMENTS、ROADMAP、CLAUDE.md 的服务商、域名后缀和 Web 服务器写法统一为阿里云轻量应用服务器香港、Porkbun 托管的 `.vip` 域名、nginx 加 certbot；实测结论改为 Phase 10、13 的输入（不论结果都继续用阿里云香港）；STATE 记下前端 SDK 改用 0.28.1 的待办。**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-08T05:52:04Z
- **Completed:** 2026-11-08T05:54:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Task 1（tracer）：服务商事实从 PROJECT.md 一路打通到 REQUIREMENTS.md 的 INFRA-01/02 和重新生成的 CLAUDE.md Project 段，任务 1 的 `<verify>` 一次通过，随后展开 Task 2。
- PROJECT.md 改了五处：目标列表的“部署”行；Constraints 的“部署”；Key Decisions 里“香港或东京云服务器”行的结果（改为“已定：阿里云香港”）、服务器行（改为所有者实际购买、不论实测结果都不更换，结果“已购买”）、域名行（后缀 `.vip`，DNS 托管在 Porkbun，结果“已购买”）；表格里 D-13 那一行之后新增一行“Web 服务继续用服务器上已有的 nginx 和 certbot”，结果 Pending（Phase 6 验证参数）。
- REQUIREMENTS.md 改了三处：INFRA-01（阿里云轻量应用服务器香港、`.vip` 域名、服务器上已有 nginx 和 certbot）；INFRA-02 句尾（结果作为 Phase 10 和 Phase 13 的输入，不论结果都继续用阿里云香港）；文末 Last updated 改为 2026-11-08 并注明 Phase 6 D-01。
- ROADMAP.md 改了六处：Phase 6 Goal 去掉“试用期内决定续费还是换商家”，改为实测结果、已知限制、做过的调整，作为 Phase 10 和 Phase 13 的输入；成功标准 2（阿里云香港加 `.vip`、已有 nginx 反代、实时连接关闭代理缓冲、HTTP/1.1、读超时足够长、certbot 自动续期、改过 nginx 之后 `certbot renew --dry-run` 仍然通过）；成功标准 4（三部分结论、Phase 10 的重连后补拉和兜底轮询间隔、Phase 13 部署）；Notes 的 `/_/` 那条（对公网开放、只放合成数据、强密码、打开 PocketBase 自带的限流，两步验证和 IP 白名单留到 Phase 13）；Phase 13 的 Research 行（nginx 反代 SSE 的长期表现，以 Phase 6 验证过的参数为起点）；Phase 13 Notes 第一条（nginx 加 certbot、PocketBase 只监听 127.0.0.1、systemd 非 root、`Restart=always`、`GOMEMLIMIT`、内存上限、DNS 只做解析、`noindex`）。
- `.claude/CLAUDE.md`：只有 Project 段里的“部署”约束一行跟着 PROJECT.md 变了，其余段一个字节没动。
- STATE.md 两处：Pending Todos 新增 D-15 的 SDK 版本待办；Blockers/Concerns 里“[部署，调研中]”的子项改成过去时（规划文档里的服务商和 Web 服务器写法已在 Phase 6 改掉）。

## generate-claude-md 和 CLAUDE.md

- `generate-claude-md` 接受了 `--output`，输出到 `mktemp -d` 目录下的临时文件，运行后 `git status` 显示 `.claude/CLAUDE.md` 没有被改动。
- 只把生成文件里 `<!-- GSD:project-start source:PROJECT.md -->` 到 `<!-- GSD:project-end -->` 之间的内容拷进 `.claude/CLAUDE.md`；临时目录和脚本随后删除。
- 去掉 Project 段后，文件与基线 blob 521fb3f 逐字相同（任务 1 verify 的 node 比对退出码 0）。Project 段内与基线的差异只有“部署”约束那一行，外加生成器在 `GSD:project-end` 标记前多出的一个空行（标记之内，不在比对范围外）。

## STATE 待办原文

> - Phase 8、9（来自 Phase 6 D-15）：前端 SDK 不用 0.28.2，改用 0.28.1（探针页已用 0.28.1 并固定文件哈希，见 tools/probe/page/vendor/README.md）；Phase 8 规划时把 ROADMAP 共同约束、Phase 8 成功标准 3 和 .planning/research/STACK.md 里的 0.28.2 一起改。

## Task Commits

1. **Task 1：tracer——PROJECT、REQUIREMENTS 和 CLAUDE.md 的服务商事实** - `16396a9`（docs）
2. **Task 2：ROADMAP Phase 6、13 和 STATE 待办** - `d4f6399`（docs）

**Plan metadata:** 见本 SUMMARY 之后的 docs 提交。

## Files Created/Modified

- `.planning/PROJECT.md` - 目标、Constraints、Key Decisions 的服务商、域名后缀和 nginx 写法
- `.planning/REQUIREMENTS.md` - INFRA-01、INFRA-02 新措辞，Last updated
- `.planning/ROADMAP.md` - Phase 6 Goal、成功标准 2 和 4、Notes；Phase 13 Research 行和 Notes
- `.planning/STATE.md` - D-15 待办，部署子项改为过去时
- `.claude/CLAUDE.md` - 重新生成的 Project 段

## Decisions Made

- 照 D-08，INFRA-02 和 ROADMAP 里所有“按实测决定续费或换商家”的说法都改成“作为 Phase 10、13 的输入”。
- 照 D-02，Web 服务器统一为 nginx 加 certbot，Phase 13 以 Phase 6 验证过的参数为起点。
- 照 D-15，SDK 版本号的三处引用不在本计划改，只在 STATE 记待办。

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None。pre-commit 钩子两次都通过（规则 D 加载 68 个词条）。

## Known Stubs

无。

## Threat Flags

无。本计划只改文档，没有新增网络端点、认证路径或信任边界；全文没有写真实 IP、域名或 www 子域名，也没有读 `private/`。

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-09、06-10 去验证措辞背后的事实：HTTPS 能打开、`certbot renew --dry-run` 通过、大陆三网和美国晚高峰实测。
- INFRA-01、INFRA-02 在 REQUIREMENTS.md 里保持 Pending，等 06-09、06-10 证明后再勾选。

## Self-Check: PASSED

- 五个修改过的文件都存在，且在两个提交里。
- 两个提交都在当前分支上：`16396a9`、`d4f6399`。
- 重新跑了任务 1 和任务 2 的 `<verify>` 和 acceptance_criteria：均退出码 0，CLAUDE.md 与基线 blob 521fb3f 去掉 Project 段后逐字相同。

---
*Phase: 06-procurement-reachability-probe*
*Completed: 2026-11-08*
